/**
 * Cruza las inscripciones que el preview detecta como "faltantes de cargo de actividad"
 * contra el Excel brio/Cuotas.xlsx para entender si Brio les facturó o no.
 *
 * Uso:
 *   DATABASE_URL="..." node server/scripts/cruzar-actividades-faltantes.js --tenant sportivopilar --periodo 05/2026
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
  const tenant = await resolveTenant(prisma, 'cruzar-actividades-faltantes.js')
  const periodoStr = arg('periodo')
  if (!periodoStr) throw new Error('Falta --periodo MM/YYYY')
  const { mes, anio } = parsePeriodo(periodoStr)
  const excelPath = path.join(__dirname, '..', '..', 'brio', 'Cuotas.xlsx')

  // ── 1) Excel Brio: index de cuotas ACTIVIDAD por nroSocio en el período ──
  const wb = XLSX.readFile(excelPath)
  const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { range: 2 })
  const periodoTarget1 = `${String(mes).padStart(2, '0')}/${anio}`
  const periodoTarget2 = `${mes}/${anio}`

  // Map nroSocio → array de filas Brio actividad en el período
  const brioActividadPorSocio = new Map()
  // Set de nroSocio que tuvieron CUALQUIER cuota actividad en CUALQUIER período
  const sociosConActividadEnAlgunPeriodoBrio = new Set()
  // Por cada socio, también guardamos las actividad+categoria que tuvo en otros períodos
  const actividadesHistoricasPorSocio = new Map()

  for (const r of data) {
    const tipo = String(r['Tipo Cuota'] ?? '').toUpperCase().trim()
    if (tipo !== 'ACTIVIDAD') continue
    const nro = String(r['Nro. Socio'] ?? '').trim()
    if (!nro) continue
    const desc = String(r['Desc. Cuota'] ?? '').trim()
    const per = String(r['Periodo'] ?? '').trim()
    sociosConActividadEnAlgunPeriodoBrio.add(nro)

    if (!actividadesHistoricasPorSocio.has(nro)) actividadesHistoricasPorSocio.set(nro, new Set())
    actividadesHistoricasPorSocio.get(nro).add(desc)

    if (per === periodoTarget1 || per === periodoTarget2) {
      if (!brioActividadPorSocio.has(nro)) brioActividadPorSocio.set(nro, [])
      brioActividadPorSocio.get(nro).push({
        desc,
        estado: String(r['Est. Cuota'] ?? '').trim(),
        importe: parseFloat(r['Importe Real']) || 0,
      })
    }
  }
  console.log(`Excel Brio — cuotas actividad ${periodoTarget1}: ${[...brioActividadPorSocio.values()].flat().length}`)

  // ── 2) BD: replicar la lógica del preview de actividades ─────────────────
  const periodoBD = await prisma.periodo.findFirst({
    where: { tenantId: tenant.id, anio, mes }, select: { id: true },
  })
  const cargosAct = await prisma.cargo.findMany({
    where: { tenantId: tenant.id, periodoId: periodoBD.id, categoria: 'CUOTA_ACTIVIDAD' },
    select: { socioId: true, categoriaActividadId: true },
  })
  const setAct = new Set(cargosAct.map(c => `${c.socioId}-${c.categoriaActividadId}`))

  const inscripciones = await prisma.inscripcion.findMany({
    where: {
      tenantId: tenant.id,
      estado: 'ACTIVA',
      exentoCuota: false,
      socio: {
        estadoSocioRel: {
          OR: [
            { nombre: { contains: 'Activ', mode: 'insensitive' } },
            { nombre: { contains: 'Vigent', mode: 'insensitive' } },
          ],
        },
      },
    },
    select: {
      id: true,
      socioId: true,
      categoriaActividadId: true,
      porcentajeCuota: true,
      socio: {
        select: {
          nroSocio: true,
          apellidoNombre: true,
          fechaAlta: true,
          categoriaSocioRel: { select: { nombre: true, porcentajeDescuento: true } },
        },
      },
      categoriaActividad: {
        select: {
          nombre: true,
          cuotaMensual: true,
          actividad: {
            select: {
              nombre: true,
              cuotaMensual: true,
              conceptoTesoreria: { select: { cuotaMensual: true } },
            },
          },
        },
      },
    },
  })

  const faltantes = []
  for (const i of inscripciones) {
    if (setAct.has(`${i.socioId}-${i.categoriaActividadId}`)) continue
    let montoBase = i.categoriaActividad.actividad.conceptoTesoreria?.cuotaMensual
      ? Number(i.categoriaActividad.actividad.conceptoTesoreria.cuotaMensual)
      : (i.categoriaActividad.cuotaMensual ? Number(i.categoriaActividad.cuotaMensual)
      : (i.categoriaActividad.actividad.cuotaMensual ? Number(i.categoriaActividad.actividad.cuotaMensual) : 0))
    const pct = i.porcentajeCuota ? Number(i.porcentajeCuota) : 100
    if (pct !== 100) montoBase = montoBase * (pct / 100)
    const desc = i.socio.categoriaSocioRel?.porcentajeDescuento ? Number(i.socio.categoriaSocioRel.porcentajeDescuento) : 0
    const montoTotal = montoBase - montoBase * (desc / 100)
    if (montoTotal <= 0) continue
    faltantes.push({ insc: i, montoTotal })
  }
  console.log(`Faltantes detectados por preview (post-fix): ${faltantes.length}\n`)

  // ── 3) Cruce ─────────────────────────────────────────────────────────────
  const brioFacturado = []   // Brio les facturó la misma actividad → bug
  const brioOtraActividad = [] // Brio facturó otras actividades pero no esta
  const nuncaActividadBrio = []   // Nunca tuvieron actividad en Brio (alta nueva o nueva inscripción)

  for (const f of faltantes) {
    const nro = f.insc.socio.nroSocio
    const filasPeriodo = brioActividadPorSocio.get(nro) || []
    const actividadEsperada = `${f.insc.categoriaActividad.actividad.nombre} - ${f.insc.categoriaActividad.nombre}`.toUpperCase()

    const matchActividad = filasPeriodo.find(r => r.desc.toUpperCase() === actividadEsperada
      || r.desc.toUpperCase().includes(f.insc.categoriaActividad.nombre.toUpperCase()))

    if (matchActividad) {
      brioFacturado.push({ f, brio: matchActividad })
    } else if (filasPeriodo.length > 0) {
      brioOtraActividad.push({ f, brioOtras: filasPeriodo })
    } else if (sociosConActividadEnAlgunPeriodoBrio.has(nro)) {
      brioOtraActividad.push({ f, brioOtras: [] }) // tuvo actividad pero no en este período
    } else {
      nuncaActividadBrio.push(f)
    }
  }

  console.log(`=== Brio LE FACTURÓ la misma actividad en 05/2026: ${brioFacturado.length} ===`)
  console.log(`(Si > 0: el cargo Brio existe pero el preview no lo encuentra — bug)`)
  for (const x of brioFacturado) {
    console.log(`  socio ${x.f.insc.socio.nroSocio} ${x.f.insc.socio.apellidoNombre} → ${x.f.insc.categoriaActividad.actividad.nombre}/${x.f.insc.categoriaActividad.nombre} | Brio: "${x.brio.desc}" est=${x.brio.estado} $${x.brio.importe}`)
  }
  console.log()

  console.log(`=== Brio NO les facturó esta actividad en 05/2026: ${brioOtraActividad.length} ===`)
  console.log(`(Pero sí tuvieron OTRAS cuotas Brio: posiblemente inscripción reciente o cambio de categoría)`)
  for (const x of brioOtraActividad) {
    const altaInsc = x.f.insc.socio.fechaAlta?.toISOString()?.slice(0, 10) ?? '-'
    const cat = x.f.insc.socio.categoriaSocioRel?.nombre ?? '-'
    console.log(`  socio ${x.f.insc.socio.nroSocio} ${x.f.insc.socio.apellidoNombre} (catSocio=${cat}, alta=${altaInsc})`)
    console.log(`     → preview generaría: ${x.f.insc.categoriaActividad.actividad.nombre}/${x.f.insc.categoriaActividad.nombre} ($${x.f.montoTotal})`)
    if (x.brioOtras.length > 0) {
      for (const o of x.brioOtras) console.log(`     · Brio mismo período: "${o.desc}" est=${o.estado} $${o.importe}`)
    } else {
      const histo = actividadesHistoricasPorSocio.get(x.f.insc.socio.nroSocio)
      if (histo) console.log(`     · Brio (otros períodos): ${[...histo].slice(0, 5).join(' | ')}${histo.size > 5 ? '...' : ''}`)
    }
  }
  console.log()

  console.log(`=== NUNCA tuvieron cuota actividad en Brio: ${nuncaActividadBrio.length} ===`)
  console.log(`(Altas/inscripciones nuevas — Brio nunca les facturó nada de actividad)`)
  for (const f of nuncaActividadBrio) {
    const altaInsc = f.insc.socio.fechaAlta?.toISOString()?.slice(0, 10) ?? '-'
    const cat = f.insc.socio.categoriaSocioRel?.nombre ?? '-'
    console.log(`  socio ${f.insc.socio.nroSocio} ${f.insc.socio.apellidoNombre} (catSocio=${cat}, alta=${altaInsc}) → ${f.insc.categoriaActividad.actividad.nombre}/${f.insc.categoriaActividad.nombre} ($${f.montoTotal})`)
  }
  console.log()

  console.log(`Resumen:`)
  console.log(`  Brio le facturó la actividad : ${brioFacturado.length} ← deberían NO estar en el preview (revisar)`)
  console.log(`  Brio facturó otras / cambio  : ${brioOtraActividad.length} ← decisión: ¿generar?`)
  console.log(`  Inscripciones nuevas         : ${nuncaActividadBrio.length} ← legítimo generar`)
}

main()
  .catch(e => { console.error('ERROR:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
