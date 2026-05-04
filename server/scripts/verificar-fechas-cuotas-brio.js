/**
 * =============================================================================
 * VERIFICAR Y CORREGIR fechaGeneracion DE CUOTAS MIGRADAS — verificar-fechas-cuotas-brio.js
 * =============================================================================
 *
 * Compara `fechaGeneracion` de los cargos con origen=MIGRACION_BRIO contra
 * la columna "Fecha Gen." del archivo brio/Cuotas.xlsx, y actualiza los que
 * tengan diferencia.
 *
 * USO:
 *   cd server
 *   node --env-file=.env scripts/verificar-fechas-cuotas-brio.js --tenant <slug>            (dry-run)
 *   node --env-file=.env scripts/verificar-fechas-cuotas-brio.js --tenant <slug> --apply    (aplica)
 *
 * MATCHING:
 *   key = socioId | mes | anio | descripcion | tipoCuota | montoTotal | estado
 *   - Si para una clave hay 1 fila Excel y 1 cargo DB → compara y actualiza.
 *   - Si hay N filas Excel y N cargos DB con misma fechaGen en Excel → actualiza todos.
 *   - Si los Excel del grupo difieren entre sí en fechaGen → se omite y se loguea.
 *   - Si la cantidad de Excel y de DB no coincide → se loguea y omite.
 * =============================================================================
 */

import XLSX from 'xlsx'
import { PrismaClient } from '@prisma/client'
import path from 'path'
import { fileURLToPath } from 'url'
import { arg, resolveTenant } from './_lib/cli.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')

function excelDateToJS(val) {
  if (val === null || val === undefined || val === '') return null
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val
  if (typeof val === 'number') {
    if (val <= 0) return null
    return new Date((val - 25569) * 86400 * 1000)
  }
  const s = String(val).trim()
  if (!s) return null
  const sLower = s.toLowerCase()
  if (['0','-','null','undefined','n/a'].includes(sLower)) return null
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/)
  if (m) {
    let [, d, mo, y] = m
    d = parseInt(d, 10); mo = parseInt(mo, 10); y = parseInt(y, 10)
    if (y < 100) y = y >= 50 ? 1900 + y : 2000 + y
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      const date = new Date(y, mo - 1, d)
      if (!isNaN(date.getTime())) return date
    }
  }
  const iso = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/)
  if (iso) {
    const y = parseInt(iso[1], 10), mo = parseInt(iso[2], 10), d = parseInt(iso[3], 10)
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      const date = new Date(y, mo - 1, d)
      if (!isNaN(date.getTime())) return date
    }
  }
  const parsed = new Date(s)
  return isNaN(parsed.getTime()) ? null : parsed
}

function parsePeriodo(periodoStr) {
  if (!periodoStr) return null
  const match = periodoStr.toString().match(/^(\d{1,2})\/(\d{4})$/)
  if (!match) return null
  return { mes: parseInt(match[1]), anio: parseInt(match[2]) }
}

// Compara solo año/mes/día (ignora hora/zona horaria)
function mismaFecha(a, b) {
  if (!a || !b) return a === b
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

function fmtFecha(d) {
  if (!d) return 'null'
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function buildKey({ socioId, mes, anio, descripcion, tipoCuota, montoTotal, estado }) {
  const desc = (descripcion || '').toUpperCase().trim()
  const tipo = (tipoCuota || '').toUpperCase().trim()
  const monto = Number(montoTotal).toFixed(2)
  return `${socioId}|${mes}|${anio}|${desc}|${tipo}|${monto}|${estado}`
}

async function main() {
  const tenant = await resolveTenant(prisma, 'verificar-fechas-cuotas-brio.js')
  const tenantId = tenant.id
  console.log(`Tenant: ${tenant.slug} (id=${tenantId})`)
  console.log(`Modo: ${APPLY ? 'APPLY (escribe cambios)' : 'DRY-RUN (sin escribir)'}`)
  console.log('')

  // ── Excel ────────────────────────────────────────────────────────────────
  const filePath = path.join(__dirname, '../../brio/Cuotas.xlsx')
  const workbook = XLSX.readFile(filePath)
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { range: 2 })
  console.log(`Filas en Cuotas.xlsx: ${data.length}`)

  // Mapa nroSocio → socioId
  const socios = await prisma.socio.findMany({
    where: { tenantId },
    select: { id: true, nroSocio: true },
  })
  const sociosPorNro = new Map()
  socios.forEach(s => { if (s.nroSocio) sociosPorNro.set(s.nroSocio.toString().trim(), s.id) })

  // Construir grupos del Excel: key → [fechaGen, fechaGen, ...]
  const excelGrupos = new Map()
  let excelSinSocio = 0
  let excelSinPeriodo = 0
  let excelSinFecha = 0

  for (const row of data) {
    const nroSocio = row['Nro. Socio']?.toString().trim()
    if (!nroSocio) continue
    const socioId = sociosPorNro.get(nroSocio)
    if (!socioId) { excelSinSocio++; continue }
    const periodoData = parsePeriodo(row['Periodo']?.toString().trim())
    if (!periodoData) { excelSinPeriodo++; continue }

    const tipoCuotaOrig = row['Tipo Cuota']?.toString().trim() || ''
    const descCuota = row['Desc. Cuota']?.toString().trim() || ''
    const precio = parseFloat(row['Precio']) || 0
    const porcentaje = parseFloat(row['Porc. Cuota']) || 1
    const importeReal = parseFloat(row['Importe Real']) || 0
    const estCuota = row['Est. Cuota']?.toString().toUpperCase().trim()
    const fechaGen = excelDateToJS(row['Fecha Gen.'])

    const esNotaCredito = estCuota === 'NOTA DE CRÉDITO' || estCuota === 'NOTA DE CREDITO'
    const esPagado = estCuota === 'PAGADA' || esNotaCredito
    const montoBase = precio * porcentaje || importeReal
    const montoTotal = esNotaCredito ? -Math.abs(importeReal) : importeReal
    const estadoDb = esPagado ? 'PAGADO' : 'PENDIENTE'

    if (!fechaGen) { excelSinFecha++; continue }

    const key = buildKey({
      socioId,
      mes: periodoData.mes,
      anio: periodoData.anio,
      descripcion: descCuota || tipoCuotaOrig || 'Cuota',
      tipoCuota: tipoCuotaOrig || null,
      montoTotal,
      estado: estadoDb,
    })

    if (!excelGrupos.has(key)) excelGrupos.set(key, [])
    excelGrupos.get(key).push(fechaGen)
  }
  console.log(`Excel: claves únicas=${excelGrupos.size} | sin socio en DB=${excelSinSocio} | sin período válido=${excelSinPeriodo} | sin fechaGen=${excelSinFecha}`)

  // ── DB ───────────────────────────────────────────────────────────────────
  const cargos = await prisma.cargo.findMany({
    where: { tenantId, origen: 'MIGRACION_BRIO' },
    select: {
      id: true, socioId: true, descripcion: true, tipoCuota: true,
      montoTotal: true, estado: true, fechaGeneracion: true,
      periodo: { select: { mes: true, anio: true } },
    },
  })
  console.log(`Cargos MIGRACION_BRIO en DB: ${cargos.length}`)

  const dbGrupos = new Map()
  let dbSinPeriodo = 0
  for (const c of cargos) {
    if (!c.periodo) { dbSinPeriodo++; continue }
    const key = buildKey({
      socioId: c.socioId,
      mes: c.periodo.mes,
      anio: c.periodo.anio,
      descripcion: c.descripcion,
      tipoCuota: c.tipoCuota,
      montoTotal: c.montoTotal,
      estado: c.estado === 'ANULADO' ? 'PENDIENTE' : c.estado,
    })
    if (!dbGrupos.has(key)) dbGrupos.set(key, [])
    dbGrupos.get(key).push(c)
  }
  console.log(`DB: claves únicas=${dbGrupos.size} | sin período=${dbSinPeriodo}`)
  console.log('')

  // ── Comparar ─────────────────────────────────────────────────────────────
  let aActualizar = 0
  let okIguales = 0
  let omitidoMismatchCount = 0
  let omitidoFechasDistintas = 0
  let omitidoSinExcel = 0
  const updates = [] // {id, fechaGen}
  const ejemplosMismatch = []

  for (const [key, cargosDb] of dbGrupos.entries()) {
    const fechasExcel = excelGrupos.get(key)
    if (!fechasExcel || fechasExcel.length === 0) {
      omitidoSinExcel += cargosDb.length
      continue
    }

    if (fechasExcel.length !== cargosDb.length) {
      omitidoMismatchCount += cargosDb.length
      if (ejemplosMismatch.length < 5) {
        ejemplosMismatch.push(`key=${key} | excel=${fechasExcel.length} | db=${cargosDb.length}`)
      }
      continue
    }

    // Verificar si todas las fechas del Excel del grupo coinciden entre sí
    const todasIguales = fechasExcel.every(f => mismaFecha(f, fechasExcel[0]))
    if (!todasIguales) {
      omitidoFechasDistintas += cargosDb.length
      continue
    }
    const fechaCorrecta = fechasExcel[0]

    for (const c of cargosDb) {
      if (mismaFecha(c.fechaGeneracion, fechaCorrecta)) {
        okIguales++
      } else {
        aActualizar++
        updates.push({ id: c.id, fechaCorrecta, fechaActual: c.fechaGeneracion })
      }
    }
  }

  console.log('='.repeat(60))
  console.log('RESULTADO DE LA COMPARACIÓN')
  console.log('='.repeat(60))
  console.log(`OK (fechas ya coinciden):                 ${okIguales}`)
  console.log(`A actualizar (fechas distintas):          ${aActualizar}`)
  console.log(`Omitidos (no hay clave en Excel):         ${omitidoSinExcel}`)
  console.log(`Omitidos (cantidad excel ≠ db):           ${omitidoMismatchCount}`)
  console.log(`Omitidos (fechas Excel no uniformes):     ${omitidoFechasDistintas}`)
  if (ejemplosMismatch.length) {
    console.log('\nEjemplos de mismatch de cantidad:')
    ejemplosMismatch.forEach(e => console.log(`  - ${e}`))
  }

  if (aActualizar > 0) {
    console.log('\nEjemplos de updates (primeros 10):')
    updates.slice(0, 10).forEach(u => {
      console.log(`  cargo#${u.id}: ${fmtFecha(u.fechaActual)} → ${fmtFecha(u.fechaCorrecta)}`)
    })
  }

  if (!APPLY) {
    console.log('\nDRY-RUN: no se escribieron cambios. Re-ejecutar con --apply para aplicar.')
    return
  }

  if (updates.length === 0) {
    console.log('\nNo hay cambios para aplicar.')
    return
  }

  console.log(`\nAplicando ${updates.length} updates...`)
  let aplicados = 0
  for (const u of updates) {
    await prisma.cargo.update({
      where: { id: u.id },
      data: { fechaGeneracion: u.fechaCorrecta },
    })
    aplicados++
    if (aplicados % 500 === 0) process.stdout.write(`\r  Actualizados: ${aplicados}/${updates.length}...`)
  }
  console.log(`\nActualizados: ${aplicados}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
