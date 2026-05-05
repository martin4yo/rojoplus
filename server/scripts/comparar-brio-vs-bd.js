/**
 * Compara cantidad de cuotas (sociales y de actividad) en el Excel brio/Cuotas.xlsx
 * contra los Cargo en la BD para un tenant y un período.
 *
 * Uso:
 *   DATABASE_URL="..." node server/scripts/comparar-brio-vs-bd.js --tenant sportivopilar --periodo 05/2026
 *   DATABASE_URL="..." node server/scripts/comparar-brio-vs-bd.js --tenant sportivopilar --periodo 05/2026 --excel brio/Cuotas.xlsx
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
  if (!m) throw new Error(`Periodo invalido: ${s} (esperado MM/YYYY)`)
  return { mes: parseInt(m[1]), anio: parseInt(m[2]) }
}

async function main() {
  const tenant = await resolveTenant(prisma, 'comparar-brio-vs-bd.js')
  const periodoStr = arg('periodo')
  if (!periodoStr) throw new Error('Falta --periodo MM/YYYY')
  const { mes, anio } = parsePeriodo(periodoStr)

  const excelRel = arg('excel') || 'brio/Cuotas.xlsx'
  const excelPath = path.isAbsolute(excelRel) ? excelRel : path.join(__dirname, '..', '..', excelRel)

  console.log(`Excel : ${excelPath}`)
  console.log(`Período: ${String(mes).padStart(2, '0')}/${anio}`)
  console.log(`Tenant : ${tenant.nombre} (id=${tenant.id})\n`)

  // ── 1) Excel ─────────────────────────────────────────────────────────────
  const wb = XLSX.readFile(excelPath)
  const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { range: 2 })
  console.log(`Excel: ${data.length} filas totales`)

  const enPeriodo = data.filter(r => {
    const p = String(r['Periodo'] ?? '').trim()
    return p === `${String(mes).padStart(2, '0')}/${anio}` || p === `${mes}/${anio}`
  })

  // Agrupar por Tipo Cuota
  const byTipoExcel = {}
  for (const r of enPeriodo) {
    const tipo = String(r['Tipo Cuota'] ?? '').toUpperCase().trim() || '<sin tipo>'
    if (!byTipoExcel[tipo]) byTipoExcel[tipo] = { total: 0, pagadas: 0, pendientes: 0, anuladas: 0, otros: 0 }
    byTipoExcel[tipo].total++
    const est = String(r['Est. Cuota'] ?? '').toUpperCase().trim()
    if (est === 'PAGADA') byTipoExcel[tipo].pagadas++
    else if (est === 'PENDIENTE') byTipoExcel[tipo].pendientes++
    else if (est === 'NOTA DE CRÉDITO' || est === 'NOTA DE CREDITO') byTipoExcel[tipo].anuladas++
    else byTipoExcel[tipo].otros++
  }

  console.log(`\nExcel — período ${String(mes).padStart(2, '0')}/${anio}: ${enPeriodo.length} filas`)
  console.log(`  ${'Tipo Cuota'.padEnd(22)} ${'Total'.padStart(8)} ${'Pagada'.padStart(8)} ${'Pendient'.padStart(9)} ${'NC'.padStart(5)} ${'Otros'.padStart(7)}`)
  for (const [tipo, c] of Object.entries(byTipoExcel)) {
    console.log(`  ${tipo.padEnd(22)} ${String(c.total).padStart(8)} ${String(c.pagadas).padStart(8)} ${String(c.pendientes).padStart(9)} ${String(c.anuladas).padStart(5)} ${String(c.otros).padStart(7)}`)
  }

  // ── 2) BD ────────────────────────────────────────────────────────────────
  const periodoBD = await prisma.periodo.findFirst({
    where: { tenantId: tenant.id, anio, mes },
    select: { id: true },
  })
  if (!periodoBD) {
    console.log(`\nBD: período ${String(mes).padStart(2, '0')}/${anio} no encontrado en tenant ${tenant.slug}`)
    return
  }

  const cargos = await prisma.cargo.findMany({
    where: { tenantId: tenant.id, periodoId: periodoBD.id },
    select: { categoria: true, tipoCuota: true, estado: true, origen: true },
  })

  const byCategoriaBD = {}
  for (const c of cargos) {
    const key = c.categoria ?? '<null>'
    if (!byCategoriaBD[key]) byCategoriaBD[key] = { total: 0, pagado: 0, pendiente: 0, anulado: 0, otros: 0, brio: 0, otrosOrigen: 0 }
    byCategoriaBD[key].total++
    if (c.estado === 'PAGADO') byCategoriaBD[key].pagado++
    else if (c.estado === 'PENDIENTE') byCategoriaBD[key].pendiente++
    else if (c.estado === 'ANULADO') byCategoriaBD[key].anulado++
    else byCategoriaBD[key].otros++
    if (c.origen === 'MIGRACION_BRIO') byCategoriaBD[key].brio++
    else byCategoriaBD[key].otrosOrigen++
  }

  console.log(`\nBD — período ${String(mes).padStart(2, '0')}/${anio} (periodoId=${periodoBD.id}): ${cargos.length} cargos`)
  console.log(`  ${'Categoria'.padEnd(22)} ${'Total'.padStart(8)} ${'Pagado'.padStart(8)} ${'Pendient'.padStart(9)} ${'Anulado'.padStart(8)} ${'Brio'.padStart(7)} ${'Otros'.padStart(7)}`)
  for (const [cat, c] of Object.entries(byCategoriaBD)) {
    console.log(`  ${cat.padEnd(22)} ${String(c.total).padStart(8)} ${String(c.pagado).padStart(8)} ${String(c.pendiente).padStart(9)} ${String(c.anulado).padStart(8)} ${String(c.brio).padStart(7)} ${String(c.otrosOrigen).padStart(7)}`)
  }

  // ── 3) Comparación agrupada (lo que importa para vos) ────────────────────
  const cuotaSocialExcel =
    (byTipoExcel['CUOTA SOCIAL']?.total || 0)
  const cuotaActividadExcel =
    (byTipoExcel['ACTIVIDAD']?.total || 0)

  const sumBD = (cats) => cats.reduce((s, k) => s + (byCategoriaBD[k]?.total || 0), 0)
  const cuotaSocialBD    = sumBD(['CUOTA_SOCIAL', 'SOCIO_UNICO', 'TITULAR_FAMILIA', 'GRUPO_FAMILIAR'])
  const cuotaActividadBD = sumBD(['CUOTA_ACTIVIDAD', 'ACTIVIDAD'])

  console.log(`\nComparación agrupada (todas las convenciones de categoría):`)
  console.log(`  Cuota social   — Excel: ${cuotaSocialExcel.toString().padStart(6)}   BD: ${cuotaSocialBD.toString().padStart(6)}   diferencia: ${(cuotaSocialBD - cuotaSocialExcel).toString().padStart(6)}`)
  console.log(`  Cuota actividad— Excel: ${cuotaActividadExcel.toString().padStart(6)}   BD: ${cuotaActividadBD.toString().padStart(6)}   diferencia: ${(cuotaActividadBD - cuotaActividadExcel).toString().padStart(6)}`)
}

main()
  .catch(e => { console.error('ERROR:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
