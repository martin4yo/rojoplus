/**
 * Cruza la lista de socios que el preview detecta como "faltantes de cuota social"
 * contra el archivo brio/Cuotas.xlsx para entender de dónde sale el desfase.
 *
 * Para cada socio que recibiría cuota nueva, indica:
 *   - Si en el Excel Brio hay una cuota social de 05/2026 a su nombre.
 *   - Su estado, tipo de socio, fecha de alta y fecha de baja.
 *
 * Uso:
 *   DATABASE_URL="..." node server/scripts/cruzar-faltantes-vs-brio.js --tenant sportivopilar --periodo 05/2026
 */
import XLSX from 'xlsx'
import path from 'path'
import { fileURLToPath } from 'url'
import { PrismaClient } from '@prisma/client'
import { arg, resolveTenant } from './_lib/cli.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const prisma = new PrismaClient()

function parsePeriodo(s) {
  const m = s.match(/^(\d{1,2})\/(\d{4})$/)
  if (!m) throw new Error(`Periodo invalido: ${s}`)
  return { mes: parseInt(m[1]), anio: parseInt(m[2]) }
}

async function main() {
  const tenant = await resolveTenant(prisma, 'cruzar-faltantes-vs-brio.js')
  const periodoStr = arg('periodo')
  if (!periodoStr) throw new Error('Falta --periodo MM/YYYY')
  const { mes, anio } = parsePeriodo(periodoStr)
  const excelPath = path.join(__dirname, '..', '..', 'brio', 'Cuotas.xlsx')

  // ── 1) Excel Brio: nroSocio que tienen CUOTA SOCIAL en el período ────────
  const wb = XLSX.readFile(excelPath)
  const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { range: 2 })
  const periodoTarget1 = `${String(mes).padStart(2, '0')}/${anio}`
  const periodoTarget2 = `${mes}/${anio}`

  const sociosConCuotaSocialBrio = new Map() // nroSocio → estado, descCuota, importeReal
  for (const r of data) {
    const per = String(r['Periodo'] ?? '').trim()
    if (per !== periodoTarget1 && per !== periodoTarget2) continue
    const tipo = String(r['Tipo Cuota'] ?? '').toUpperCase().trim()
    if (tipo !== 'CUOTA SOCIAL') continue
    const nro = String(r['Nro. Socio'] ?? '').trim()
    if (!nro) continue
    sociosConCuotaSocialBrio.set(nro, {
      estado: String(r['Est. Cuota'] ?? '').trim(),
      desc: String(r['Desc. Cuota'] ?? '').trim(),
      importe: parseFloat(r['Importe Real']) || 0,
    })
  }
  console.log(`Excel Brio — cuotas sociales 05/2026: ${sociosConCuotaSocialBrio.size} (por nroSocio único)`)

  // ── 2) BD: replicar la query del preview ─────────────────────────────────
  const periodoBD = await prisma.periodo.findFirst({
    where: { tenantId: tenant.id, anio, mes }, select: { id: true },
  })
  const existentes = await prisma.cargo.findMany({
    where: { tenantId: tenant.id, periodoId: periodoBD.id, categoria: 'CUOTA_SOCIAL' },
    select: { socioId: true },
  })
  const existentesSet = new Set(existentes.map(c => c.socioId))

  // Filtra por FK (estadoSocioRel.nombre) — no por el string legacy `estado`.
  const socios = await prisma.socio.findMany({
    where: {
      tenantId: tenant.id,
      estadoSocioRel: {
        OR: [
          { nombre: { contains: 'Activ', mode: 'insensitive' } },
          { nombre: { contains: 'Vigent', mode: 'insensitive' } },
        ],
      },
    },
    include: {
      tipoSocioRel: { include: { conceptoTesoreria: true } },
      categoriaSocioRel: true,
      estadoSocioRel: { select: { nombre: true } },
    },
    orderBy: { apellidoNombre: 'asc' },
  })

  const faltantes = []
  for (const s of socios) {
    const esTitular = !s.titularFamiliaId
    const cuotaMensual = s.tipoSocioRel?.conceptoTesoreria?.cuotaMensual
      ? Number(s.tipoSocioRel.conceptoTesoreria.cuotaMensual)
      : Number(s.tipoSocioRel?.cuotaMensual || 0)
    if (existentesSet.has(s.id)) continue
    if (!esTitular) continue
    if (!cuotaMensual) continue
    faltantes.push(s)
  }
  console.log(`Faltantes detectados por preview: ${faltantes.length}\n`)

  // ── 3) Cruce ─────────────────────────────────────────────────────────────
  const enBrio = []      // faltantes que SÍ tienen cuota social en Brio (problema en BD/import)
  const noEnBrio = []    // faltantes que NO están en Brio (altas nuevas u otros)

  for (const s of faltantes) {
    const enBrioFila = sociosConCuotaSocialBrio.get(s.nroSocio)
    if (enBrioFila) enBrio.push({ s, brio: enBrioFila })
    else noEnBrio.push(s)
  }

  console.log(`=== Faltantes que SÍ tienen cuota en Excel Brio: ${enBrio.length} ===`)
  console.log(`(Si > 0: el cargo Brio existe en BD pero el preview no lo encuentra — bug a investigar)`)
  if (enBrio.length > 0 && enBrio.length <= 30) {
    for (const x of enBrio) {
      console.log(`  socioId=${x.s.id} nro=${x.s.nroSocio} ${x.s.apellidoNombre} estadoFK=${x.s.estadoSocioRel?.nombre ?? '<sin FK>'} tipoFK=${x.s.tipoSocioRel?.nombre ?? '<sin FK>'} | Brio: ${x.brio.estado} ${x.brio.desc} $${x.brio.importe}`)
    }
  } else if (enBrio.length > 30) {
    console.log(`  (mostrando primeros 20)`)
    for (const x of enBrio.slice(0, 20)) {
      console.log(`  socioId=${x.s.id} nro=${x.s.nroSocio} ${x.s.apellidoNombre} estadoFK=${x.s.estadoSocioRel?.nombre ?? '<sin FK>'} tipoFK=${x.s.tipoSocioRel?.nombre ?? '<sin FK>'} | Brio: ${x.brio.estado} ${x.brio.desc} $${x.brio.importe}`)
    }
  }
  console.log()

  console.log(`=== Faltantes que NO están en Excel Brio: ${noEnBrio.length} ===`)
  console.log(`(Altas nuevas / socios técnicos / Brio nunca les facturó)`)

  // Breakdown por estado y por fechaAlta vs fecha de cierre Brio
  // Última fila Brio para inferir fecha de cierre (último período presente)
  const fechasBrio = data.map(r => r['Fecha Gen.']).filter(Boolean)
  // No es trivial sin parsear, así que usamos el período: mostramos los socios por estado y si tienen fechaAlta posterior al período
  const finPeriodo = new Date(anio, mes, 0) // último día del período

  const byEstado = {}
  const altaPosterior = []
  const sospechosos = []
  for (const s of noEnBrio) {
    const estadoTexto = s.estadoSocioRel?.nombre ?? s.estado
    byEstado[estadoTexto] = (byEstado[estadoTexto] || 0) + 1
    if (s.fechaAlta && new Date(s.fechaAlta) > finPeriodo) {
      altaPosterior.push(s)
    } else if (s.apellidoNombre?.toUpperCase().includes('BUFFET')) {
      sospechosos.push(s)
    }
  }

  console.log(`\nBreakdown por estado:`)
  for (const [est, cnt] of Object.entries(byEstado).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${est.padEnd(25)} ${cnt}`)
  }

  console.log(`\nFaltantes con fechaAlta POSTERIOR al ${finPeriodo.toISOString().slice(0, 10)} (no deberían pagar 05/2026): ${altaPosterior.length}`)
  if (altaPosterior.length > 0 && altaPosterior.length <= 20) {
    for (const s of altaPosterior) {
      console.log(`  ${s.nroSocio} ${s.apellidoNombre} alta=${s.fechaAlta?.toISOString()?.slice(0, 10)}`)
    }
  }

  console.log(`\nSocios "técnicos" (BUFFET en el nombre): ${sospechosos.length}`)
  for (const s of sospechosos) {
    console.log(`  ${s.nroSocio} ${s.apellidoNombre}`)
  }

  // ── Análisis profundo de los 402 faltantes legítimos ────────────────────
  const sinTecnicos = noEnBrio.filter(s => !s.apellidoNombre?.toUpperCase().includes('BUFFET'))

  // Set de nroSocio que TUVIERON ALGUNA cuota social en Brio (cualquier período)
  const sociosConAlgunaCuotaSocialBrio = new Set()
  for (const r of data) {
    const tipo = String(r['Tipo Cuota'] ?? '').toUpperCase().trim()
    if (tipo !== 'CUOTA SOCIAL') continue
    const nro = String(r['Nro. Socio'] ?? '').trim()
    if (nro) sociosConAlgunaCuotaSocialBrio.add(nro)
  }

  // Cargar con info adicional (fechaBaja, categoriaSocio con descuento)
  const sociosFull = await prisma.socio.findMany({
    where: { tenantId: tenant.id, id: { in: sinTecnicos.map(s => s.id) } },
    include: { categoriaSocioRel: true, tipoSocioRel: true },
  })

  let conFechaBaja = 0
  let con100Descuento = 0
  let nuncaCuotaSocialBrio = 0
  const muestras = { conFechaBaja: [], con100Descuento: [], nuncaCuotaSocialBrio: [] }
  const categoriasContador = {}

  for (const s of sociosFull) {
    if (s.fechaBaja) {
      conFechaBaja++
      if (muestras.conFechaBaja.length < 5) muestras.conFechaBaja.push(s)
    }
    const desc = s.categoriaSocioRel?.porcentajeDescuento ? Number(s.categoriaSocioRel.porcentajeDescuento) : 0
    if (desc >= 100) {
      con100Descuento++
      if (muestras.con100Descuento.length < 5) muestras.con100Descuento.push(s)
    }
    const cat = s.categoriaSocioRel?.nombre || '<sin categoria>'
    categoriasContador[cat] = (categoriasContador[cat] || 0) + 1
    if (!sociosConAlgunaCuotaSocialBrio.has(s.nroSocio)) {
      nuncaCuotaSocialBrio++
      if (muestras.nuncaCuotaSocialBrio.length < 10) muestras.nuncaCuotaSocialBrio.push(s)
    }
  }

  console.log(`\n=== Análisis de los ${sinTecnicos.length} faltantes (sin BUFFET técnicos) ===`)
  console.log(`\nCon fechaBaja seteada (estado=VIGENTE pero baja!): ${conFechaBaja}`)
  for (const s of muestras.conFechaBaja) {
    console.log(`  ${s.nroSocio} ${s.apellidoNombre} alta=${s.fechaAlta?.toISOString()?.slice(0, 10)} baja=${s.fechaBaja?.toISOString()?.slice(0, 10)} motivoBaja=${s.motivoBaja ?? '-'}`)
  }

  console.log(`\nCon descuento 100% en categoria_socio: ${con100Descuento}`)
  for (const s of muestras.con100Descuento) {
    console.log(`  ${s.nroSocio} ${s.apellidoNombre} categoria=${s.categoriaSocioRel?.nombre} descuento=${s.categoriaSocioRel?.porcentajeDescuento}%`)
  }

  console.log(`\nNUNCA tuvieron cuota social en Brio (en ningún período): ${nuncaCuotaSocialBrio}`)
  console.log(`(Honorarios/vitalicios/jubilados internos/etc. — Brio nunca les facturó)`)
  for (const s of muestras.nuncaCuotaSocialBrio) {
    console.log(`  ${s.nroSocio} ${s.apellidoNombre} alta=${s.fechaAlta?.toISOString()?.slice(0, 10) ?? '-'} categoria=${s.categoriaSocioRel?.nombre ?? '-'} desc=${s.categoriaSocioRel?.porcentajeDescuento ?? 0}%`)
  }

  console.log(`\nDistribución por CategoriaSocio (todos los faltantes):`)
  for (const [cat, cnt] of Object.entries(categoriasContador).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat.padEnd(35)} ${cnt}`)
  }

  // Faltantes que SÍ tuvieron cuota social en Brio en otros períodos pero no en 05/2026
  const conHistoricoNoEnPeriodo = sociosFull.filter(s => sociosConAlgunaCuotaSocialBrio.has(s.nroSocio))
  console.log(`\n=== Tuvieron cuota social en otro período Brio pero no en 05/2026: ${conHistoricoNoEnPeriodo.length} ===`)
  console.log(`(Estos podrían ser bajas no marcadas en estado, o que dejaron de pagar antes)`)
  if (conHistoricoNoEnPeriodo.length > 0 && conHistoricoNoEnPeriodo.length <= 30) {
    for (const s of conHistoricoNoEnPeriodo) {
      console.log(`  ${s.nroSocio} ${s.apellidoNombre} alta=${s.fechaAlta?.toISOString()?.slice(0, 10) ?? '-'} baja=${s.fechaBaja?.toISOString()?.slice(0, 10) ?? '-'} cat=${s.categoriaSocioRel?.nombre ?? '-'}`)
    }
  } else if (conHistoricoNoEnPeriodo.length > 30) {
    console.log(`  (mostrando 20)`)
    for (const s of conHistoricoNoEnPeriodo.slice(0, 20)) {
      console.log(`  ${s.nroSocio} ${s.apellidoNombre} alta=${s.fechaAlta?.toISOString()?.slice(0, 10) ?? '-'} baja=${s.fechaBaja?.toISOString()?.slice(0, 10) ?? '-'} cat=${s.categoriaSocioRel?.nombre ?? '-'}`)
    }
  }
}

main()
  .catch(e => { console.error('ERROR:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
