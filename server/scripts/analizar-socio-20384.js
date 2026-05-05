/**
 * Análisis de saldo del socio 20384: BD (sportivopilar) vs brio/Actividades.xlsx
 * Lista cargos, pagos, aplicaciones de saldo y compara con el Excel.
 *
 * Uso: node scripts/analizar-socio-20384.js
 */

import XLSX from 'xlsx'
import { PrismaClient } from '@prisma/client'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const NRO_SOCIO = '20384'
const TENANT_SLUG = 'sportivopilar'
const FECHA_DESDE = new Date('2025-04-01')

const prisma = new PrismaClient()

function excelDateToJS(val) {
  if (!val) return null
  if (typeof val === 'number') return new Date((val - 25569) * 86400 * 1000)
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

function fmt(n) { return Number(n || 0).toFixed(2) }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('es-AR') : '-' }

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { subdomain: TENANT_SLUG } })
  if (!tenant) throw new Error(`Tenant ${TENANT_SLUG} no encontrado`)

  const socio = await prisma.socio.findFirst({
    where: { tenantId: tenant.id, nroSocio: NRO_SOCIO },
    select: { id: true, nroSocio: true, apellidoNombre: true, documento: true, estado: true, titularFamiliaId: true }
  })
  if (!socio) throw new Error(`Socio ${NRO_SOCIO} no encontrado en ${TENANT_SLUG}`)

  console.log(`\n═══ SOCIO #${socio.nroSocio} ${socio.apellidoNombre} (id=${socio.id}, doc=${socio.documento}) ═══\n`)

  // ═══ 1. CARGOS (BD) desde 1/4/2025 ═══
  const cargos = await prisma.cargo.findMany({
    where: { socioId: socio.id, fechaGeneracion: { gte: FECHA_DESDE } },
    orderBy: { fechaGeneracion: 'asc' },
    include: {
      periodo: { select: { nombre: true, anio: true, mes: true } },
      categoriaActividad: { include: { actividad: { select: { nombre: true } } } },
    }
  })

  console.log(`▼ CARGOS BD (${cargos.length}):`)
  console.log('Fecha       | Periodo  | Tipo            | Descripción                                    | Monto      | Estado     | Origen')
  console.log('-'.repeat(160))
  let totalCargado = 0, totalPagado = 0, totalPendiente = 0, totalAnulado = 0
  for (const c of cargos) {
    const tipo = c.categoria || c.tipoCuota || '-'
    const desc = (c.descripcion || c.categoriaActividad?.actividad?.nombre || '').slice(0, 46).padEnd(46)
    const periodo = (c.periodo?.nombre || `${c.periodo?.mes}/${c.periodo?.anio}` || '-').padEnd(8)
    const monto = Number(c.montoTotal)
    if (c.estado === 'PAGADO') totalPagado += monto
    else if (c.estado === 'PENDIENTE') totalPendiente += monto
    else if (c.estado === 'ANULADO') totalAnulado += monto
    totalCargado += monto
    console.log(`${fmtDate(c.fechaGeneracion).padEnd(11)} | ${periodo} | ${(tipo).padEnd(15)} | ${desc} | ${fmt(monto).padStart(10)} | ${(c.estado || '-').padEnd(10)} | ${c.origen || '-'}`)
  }
  console.log(`\n  Total cargado: ${fmt(totalCargado)}  |  Pagado: ${fmt(totalPagado)}  |  Pendiente: ${fmt(totalPendiente)}  |  Anulado: ${fmt(totalAnulado)}\n`)

  // ═══ 2. PAGOS (BD) desde 1/4/2025 ═══
  const pagos = await prisma.pago.findMany({
    where: { socioId: socio.id, fecha: { gte: FECHA_DESDE } },
    orderBy: { fecha: 'asc' },
    include: {
      mediosPago: { include: { medioPago: { select: { nombre: true } } } },
      saldosAplicados: { include: { saldoFavor: { select: { id: true, motivo: true, origen: true } } } },
      cargos: { select: { id: true, descripcion: true } },
    }
  })

  console.log(`▼ PAGOS BD (${pagos.length}):`)
  console.log('Fecha       | Recibo   | Total      | Recibido   | A cuenta   | Medios → Monto                      | Estado     | Saldos aplicados')
  console.log('-'.repeat(180))
  let totalPagosTotal = 0, totalPagosRecibido = 0, totalACuenta = 0, totalSaldoAplicadoEnPagos = 0
  for (const p of pagos) {
    const medios = p.mediosPago.map(m => `${m.medioPago?.nombre}: ${fmt(m.monto)}`).join(', ')
    const sa = p.saldosAplicados.map(s => `Saldo#${s.saldoFavorId}: ${fmt(s.monto)}`).join(', ')
    totalPagosTotal += Number(p.montoTotal)
    totalPagosRecibido += Number(p.montoRecibido)
    totalACuenta += Number(p.montoACuenta || 0)
    for (const s of p.saldosAplicados) totalSaldoAplicadoEnPagos += Number(s.monto)
    console.log(`${fmtDate(p.fecha).padEnd(11)} | ${(p.numero || '').padEnd(8)} | ${fmt(p.montoTotal).padStart(10)} | ${fmt(p.montoRecibido).padStart(10)} | ${fmt(p.montoACuenta || 0).padStart(10)} | ${(medios || '-').padEnd(35)} | ${(p.estado || '').padEnd(10)} | ${sa || '-'}`)
  }
  console.log(`\n  Suma total pagos: ${fmt(totalPagosTotal)}  |  Recibido: ${fmt(totalPagosRecibido)}  |  A cuenta: ${fmt(totalACuenta)}  |  Aplicado de saldos: ${fmt(totalSaldoAplicadoEnPagos)}\n`)

  // ═══ 3. SALDOS A FAVOR ═══
  const saldos = await prisma.saldoFavor.findMany({
    where: { socioId: socio.id },
    orderBy: { fecha: 'asc' },
    include: { aplicaciones: { include: { pago: { select: { numero: true, fecha: true } } } } }
  })

  console.log(`▼ SALDOS A FAVOR (${saldos.length}):`)
  console.log('Id   | Fecha       | Origen           | Motivo                          | Original    | Disponible  | Aplicaciones')
  console.log('-'.repeat(150))
  let totalSaldoOriginal = 0, totalSaldoDisponible = 0
  for (const s of saldos) {
    totalSaldoOriginal += Number(s.montoOriginal)
    totalSaldoDisponible += Number(s.montoDisponible)
    const aps = s.aplicaciones.map(a => `${fmt(a.monto)} → recibo ${a.pago?.numero}`).join(' | ')
    console.log(`${String(s.id).padEnd(4)} | ${fmtDate(s.fecha).padEnd(11)} | ${(s.origen || '').padEnd(16)} | ${(s.motivo || '-').slice(0, 30).padEnd(31)} | ${fmt(s.montoOriginal).padStart(11)} | ${fmt(s.montoDisponible).padStart(11)} | ${aps || '-'}`)
  }
  console.log(`\n  Total acreditado: ${fmt(totalSaldoOriginal)}  |  Disponible actual: ${fmt(totalSaldoDisponible)}\n`)

  // ═══ 4. CUENTA CORRIENTE — cómputo manual ═══
  // Saldo deudor = pendientes (cargado - pagado - anulado del lado de cuenta)
  // Saldo a favor reportado por la app = SUM(montoDisponible)
  console.log(`▼ RESUMEN`)
  console.log(`  Cargado: ${fmt(totalCargado)}`)
  console.log(`  Pagado en cargos: ${fmt(totalPagado)}`)
  console.log(`  Anulado en cargos: ${fmt(totalAnulado)}`)
  console.log(`  Pendiente: ${fmt(totalPendiente)}`)
  console.log(`  Saldo a favor disponible (BD): ${fmt(totalSaldoDisponible)}`)
  console.log(`  Saldo a favor original total: ${fmt(totalSaldoOriginal)}`)
  console.log(`  Saldo aplicado en pagos: ${fmt(totalSaldoAplicadoEnPagos)}`)
  console.log(`  → Diferencia (deberían matchear): orig - aplicado = ${fmt(totalSaldoOriginal - totalSaldoAplicadoEnPagos)} vs disponible ${fmt(totalSaldoDisponible)}\n`)

  // ═══ 5. EXCEL Actividades.xlsx ═══
  console.log(`▼ EXCEL brio/Actividades.xlsx`)
  const filePath = path.join(__dirname, '../../brio/Actividades.xlsx')
  const workbook = XLSX.readFile(filePath)
  console.log(`Sheets: ${workbook.SheetNames.join(', ')}`)

  // Probar primero sheet 0
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  // Probar varios offsets de encabezados
  let rows = []
  for (const range of [0, 1, 2, 3]) {
    const tmp = XLSX.utils.sheet_to_json(sheet, { range, defval: null })
    if (tmp.length > 0) {
      const keys = Object.keys(tmp[0])
      if (keys.some(k => /socio/i.test(k)) || keys.some(k => /apell/i.test(k))) {
        rows = tmp
        console.log(`  Headers fila ${range + 1}, columnas: ${keys.slice(0, 12).join(' | ')}${keys.length > 12 ? ' …' : ''}`)
        break
      }
    }
  }
  if (rows.length === 0) {
    rows = XLSX.utils.sheet_to_json(sheet, { defval: null })
    console.log(`  Sin detección de headers, columnas: ${Object.keys(rows[0] || {}).slice(0, 12).join(' | ')}`)
  }
  console.log(`  Filas totales: ${rows.length}`)

  // Detectar columna de nro socio
  const colNroSocio = Object.keys(rows[0] || {}).find(k => /nro\.?\s*socio|n.?\s*socio|socio$/i.test(k))
  const colApellido = Object.keys(rows[0] || {}).find(k => /apell/i.test(k))
  console.log(`  Columna nro socio: "${colNroSocio}", apellido: "${colApellido}"`)

  const filasSocio = rows.filter(r => {
    const v = r[colNroSocio]
    return v != null && String(v).trim() === NRO_SOCIO
  })
  console.log(`  Filas del socio ${NRO_SOCIO}: ${filasSocio.length}\n`)

  if (filasSocio.length > 0) {
    console.log(`Columnas del Excel: ${Object.keys(filasSocio[0]).join(' | ')}\n`)
    // Mostrar todas las filas del socio
    let totalImporteExcel = 0
    let totalCobradoExcel = 0
    for (const r of filasSocio) {
      // Heurística: buscar columnas comunes
      const fechaGen = r['Fecha Gen.'] || r['Fecha'] || r['Fecha Generacion'] || r['F.Gen']
      const periodo = r['Periodo'] || r['Período']
      const tipo = r['Tipo Cuota'] || r['Tipo'] || r['Tipo Concepto']
      const desc = r['Desc. Cuota'] || r['Descripcion'] || r['Concepto']
      const importe = parseFloat(r['Importe Real'] || r['Importe'] || r['Precio'] || 0) || 0
      const estado = r['Est. Cuota'] || r['Estado'] || r['EstadoCuota']
      const fechaCobro = r['Fecha Cobro'] || r['F.Cobro']
      const cobrado = parseFloat(r['Cobrado'] || 0) || 0
      totalImporteExcel += importe
      if (estado && /pag/i.test(estado)) totalCobradoExcel += importe
      const fechaGenJS = excelDateToJS(fechaGen)
      if (fechaGenJS && fechaGenJS < FECHA_DESDE) continue  // saltear anteriores al corte
      console.log(`  ${fmtDate(fechaGenJS)} | ${(periodo || '').toString().padEnd(8)} | ${(tipo || '-').toString().padEnd(15)} | ${(desc || '-').toString().slice(0, 40).padEnd(40)} | ${fmt(importe).padStart(10)} | ${(estado || '').toString().padEnd(12)} | F.Cobro: ${fmtDate(excelDateToJS(fechaCobro))}`)
    }
    console.log(`\n  Total importe Excel (todas filas): ${fmt(totalImporteExcel)}`)
    console.log(`  Total Excel marcado como pagado: ${fmt(totalCobradoExcel)}`)
  }
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
