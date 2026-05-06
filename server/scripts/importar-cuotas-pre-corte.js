/**
 * =============================================================================
 * IMPORTACIÓN HISTÓRICA DE CUOTAS PRE-CORTE — importar-cuotas-pre-corte.js
 * =============================================================================
 *
 * Complementa `importar-cuotas.js` trayendo a Clubix las cuotas anteriores
 * al corte de importación (1/4/2025). Brio fue activo hasta el 30/4/2026 y
 * tiene historia desde 2018; la importación principal sólo trajo a partir
 * de 1/4/2025.
 *
 * DIFERENCIAS CON importar-cuotas.js:
 *   - Filtro: Fecha Gen. < 1/4/2025 (anteriores al corte) — los posteriores ya están.
 *   - Salta filas ANTICIPO SOCIOS (Brio las usa como cuenta de paso, generan
 *     duplicación contable; igual criterio que la limpieza de anticipos).
 *   - Est. Cuota = FINANCIADO → cargo ANULADO (la cuota original fue reemplazada
 *     por un plan de pago con cuotas propias en Brio, esas cuotas vienen como
 *     filas separadas con Tipo Cuota=FINANCIADO).
 *   - Est. Cuota = NOTA DE CRÉDITO → cargo ANULADO.
 *   - Est. Cuota = PAGADA → cargo PAGADO + Pago vinculado (MedioPago/Caja MIGRACION_BRIO).
 *   - Est. Cuota = PENDIENTE → cargo PENDIENTE.
 *   - origen = 'MIGRACION_BRIO_HISTORICO' (distinto de MIGRACION_BRIO,
 *     no se mezcla con la importación principal).
 *   - Idempotente: borra cargos+pagos+movimientos con origen MIGRACION_BRIO_HISTORICO
 *     antes de insertar.
 *
 * USO:
 *   cd server
 *   node scripts/importar-cuotas-pre-corte.js --tenant sportivopilar --dry-run
 *   node scripts/importar-cuotas-pre-corte.js --tenant sportivopilar --apply
 * =============================================================================
 */

import XLSX from 'xlsx'
import { PrismaClient } from '@prisma/client'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const prisma = new PrismaClient()

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : null
}
function flag(name) { return process.argv.includes(`--${name}`) }

const TENANT_SLUG = arg('tenant') || 'sportivopilar'
const CORTE_STR = arg('corte') || '2025-04-01'
const CORTE = new Date(CORTE_STR + 'T00:00:00') // exclusive: importa solo Fecha Gen. < CORTE
const APPLY = flag('apply')
const DRY_RUN = !APPLY
const ORIGEN = 'MIGRACION_BRIO_HISTORICO'

function fmt(n) {
  return Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function excelDateToJS(val) {
  if (val == null || val === '') return null
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val
  if (typeof val === 'number') return val > 0 ? new Date((val - 25569) * 86400 * 1000) : null
  const s = String(val).trim()
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/)
  if (m) {
    let [, d, mo, y] = m.map(Number)
    if (y < 100) y = y >= 50 ? 1900 + y : 2000 + y
    const dt = new Date(y, mo - 1, d)
    return isNaN(dt.getTime()) ? null : dt
  }
  const dt = new Date(s)
  return isNaN(dt.getTime()) ? null : dt
}

function parsePeriodo(s) {
  if (!s) return null
  const m = s.toString().match(/^(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  return { mes: parseInt(m[1]), anio: parseInt(m[2]) }
}

function mapCategoria(tipoCuota, descCuota) {
  const tc = (tipoCuota || '').toUpperCase()
  if (tc === 'CUOTA SOCIAL') {
    return (descCuota || '').toUpperCase().includes('GRUPO FAMILIAR') ? 'TITULAR_FAMILIA' : 'SOCIO_UNICO'
  }
  const map = {
    'ACTIVIDAD':  'ACTIVIDAD',
    'CONCEPTO':   'CONCEPTO',
    'MOROSIDAD':  'MORA',
    'FINANCIADO': 'FINANCIADO',
  }
  return map[tc] || 'CONCEPTO'
}

function esAnticipoSocios(descCuota) {
  return (descCuota || '').toUpperCase().trim() === 'ANTICIPO SOCIOS'
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } })
  if (!tenant) throw new Error(`Tenant '${TENANT_SLUG}' no existe`)
  const tenantId = tenant.id

  const excelPath = path.join(__dirname, '../../brio/Cuotas.xlsx')

  console.log(`Tenant: ${TENANT_SLUG} (id=${tenantId})`)
  console.log(`Excel : ${excelPath}`)
  console.log(`Corte : Fecha Gen. < ${CORTE.toISOString().slice(0, 10)} (exclusive)`)
  console.log(`Modo  : ${DRY_RUN ? '🟡 DRY-RUN (no modifica BD)' : '🔴 APPLY (modifica BD)'}`)
  console.log()

  // ── Leer Excel ──────────────────────────────────────────────────────────────
  const wb = XLSX.readFile(excelPath)
  const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { range: 2 })
  console.log(`Filas totales en Excel: ${data.length}`)

  // ── Pre-clasificación (lectura) ─────────────────────────────────────────────
  const stats = {
    fueraDeCorte: 0,
    sinSocio: 0,
    anticipoSocios: 0,
    sinFecha: 0,
    aImportar: 0,
    pagada: 0,
    pendiente: 0,
    notaCredito: 0,
    financiado: 0,
    otroEstado: 0,
  }
  const filasFiltradas = []

  for (const row of data) {
    const fechaGen = excelDateToJS(row['Fecha Gen.'])
    if (!fechaGen) { stats.sinFecha++; continue }
    if (fechaGen >= CORTE) { stats.fueraDeCorte++; continue }

    const nroSocio = row['Nro. Socio']?.toString().trim()
    if (!nroSocio) { stats.sinSocio++; continue }

    const descCuota = row['Desc. Cuota']?.toString().trim()
    if (esAnticipoSocios(descCuota)) { stats.anticipoSocios++; continue }

    const estCuota = (row['Est. Cuota'] ?? '').toString().toUpperCase().trim()
    if (estCuota === 'PAGADA') stats.pagada++
    else if (estCuota === 'PENDIENTE') stats.pendiente++
    else if (estCuota === 'NOTA DE CRÉDITO' || estCuota === 'NOTA DE CREDITO') stats.notaCredito++
    else if (estCuota === 'FINANCIADO') stats.financiado++
    else stats.otroEstado++

    stats.aImportar++
    filasFiltradas.push(row)
  }

  console.log(`\n── Clasificación de filas ───────────────────────────────────────`)
  console.log(`  Fuera de corte (≥ ${CORTE.toISOString().slice(0,10)}): ${stats.fueraDeCorte}`)
  console.log(`  Sin fecha de generación:                       ${stats.sinFecha}`)
  console.log(`  Sin nro de socio:                              ${stats.sinSocio}`)
  console.log(`  ANTICIPO SOCIOS (saltadas):                    ${stats.anticipoSocios}`)
  console.log(`  ──────────────────────────────────────────────`)
  console.log(`  A importar:                                    ${stats.aImportar}`)
  console.log(`    PAGADA:                                      ${stats.pagada}`)
  console.log(`    PENDIENTE:                                   ${stats.pendiente}`)
  console.log(`    NOTA DE CRÉDITO:                             ${stats.notaCredito}`)
  console.log(`    FINANCIADO:                                  ${stats.financiado}`)
  console.log(`    Otros estados:                               ${stats.otroEstado}`)

  // ── Mapas auxiliares ────────────────────────────────────────────────────────
  const socios = await prisma.socio.findMany({
    where: { tenantId },
    select: { id: true, nroSocio: true },
  })
  const socioByNro = new Map()
  socios.forEach(s => { if (s.nroSocio) socioByNro.set(s.nroSocio.toString().trim(), s.id) })

  const actividades = await prisma.actividad.findMany({
    where: { tenantId },
    include: { categorias: { select: { id: true, nombre: true } } }
  })
  const actCatMap = new Map()
  for (const act of actividades) {
    const actNorm = act.nombre.toUpperCase().trim()
    for (const cat of act.categorias) {
      const catNorm = cat.nombre.toUpperCase().trim()
      actCatMap.set(`${actNorm}|${catNorm}`, cat.id)
      if (!actCatMap.has(`|${catNorm}`)) actCatMap.set(`|${catNorm}`, cat.id)
    }
  }

  // Conceptos de tesorería
  async function getOCreateConcepto(codigo, nombre) {
    let c = await prisma.conceptoTesoreria.findUnique({ where: { tenantId_codigo: { tenantId, codigo } } })
    if (!c && APPLY) {
      c = await prisma.conceptoTesoreria.create({ data: { tenantId, codigo, nombre, tipo: 'INGRESO', usaEnTesoreria: true } })
    }
    return c
  }
  const tiposSocio = await prisma.tipoSocio.findMany({ where: { tenantId } })
  const conceptoPorCategoria = new Map()
  for (const ts of tiposSocio) {
    const cod = ts.codigo.toUpperCase()
    if (cod === 'SOCIO_UNICO' || cod === 'TITULAR_FAMILIA') {
      if (ts.conceptoTesoreriaId) conceptoPorCategoria.set(cod, ts.conceptoTesoreriaId)
    }
  }
  const conceptoPorActividad = new Map()
  for (const act of actividades) {
    if (act.conceptoTesoreriaId) conceptoPorActividad.set(act.nombre.toUpperCase().trim(), act.conceptoTesoreriaId)
  }

  // ── Validación pre-import: socios faltantes ────────────────────────────────
  const sociosNoEnClubix = new Set()
  for (const row of filasFiltradas) {
    const nro = row['Nro. Socio']?.toString().trim()
    if (nro && !socioByNro.has(nro)) sociosNoEnClubix.add(nro)
  }
  if (sociosNoEnClubix.size > 0) {
    console.log(`\n⚠️  Socios en Brio que NO están en Clubix: ${sociosNoEnClubix.size}`)
    console.log(`   (sus filas se saltarán durante el import)`)
  }

  // ── Resumen económico esperado ─────────────────────────────────────────────
  let sumaPagadas = 0, sumaPendientes = 0
  for (const row of filasFiltradas) {
    const estCuota = (row['Est. Cuota'] ?? '').toString().toUpperCase().trim()
    const importe = Number(row['Importe Real'] || 0)
    if (estCuota === 'PAGADA') sumaPagadas += importe
    else if (estCuota === 'PENDIENTE') sumaPendientes += importe
  }
  console.log(`\n── Importes esperados ───────────────────────────────────────────`)
  console.log(`  Suma PAGADAS:    $${fmt(sumaPagadas)}`)
  console.log(`  Suma PENDIENTES: $${fmt(sumaPendientes)}`)

  if (DRY_RUN) {
    console.log(`\n🟡 DRY-RUN — no se modificó la BD. Re-correr con --apply para aplicar.\n`)
    return
  }

  // ── APPLY ───────────────────────────────────────────────────────────────────
  console.log(`\n🔴 APPLY: borrando importación histórica previa (origen=${ORIGEN})...`)
  const delMov = await prisma.movimientoCaja.deleteMany({
    where: { tenantId, pago: { origen: ORIGEN } }
  })
  const delPag = await prisma.pago.deleteMany({ where: { tenantId, origen: ORIGEN } })
  const delCar = await prisma.cargo.deleteMany({ where: { tenantId, origen: ORIGEN } })
  console.log(`  MovimientosCaja eliminados: ${delMov.count}`)
  console.log(`  Pagos eliminados:           ${delPag.count}`)
  console.log(`  Cargos eliminados:          ${delCar.count}`)

  // ── MedioPago/Caja/Admin para pagos históricos ─────────────────────────────
  let medioPagoMig = await prisma.medioPago.findFirst({ where: { tenantId, codigo: 'MIGRACION_BRIO' } })
  if (!medioPagoMig) {
    medioPagoMig = await prisma.medioPago.create({
      data: {
        tenantId, codigo: 'MIGRACION_BRIO', nombre: 'Migración Brio (histórico)', tipo: 'OTRO',
        activo: false, paraBuffet: false, paraCaja: false, paraKiosco: false, paraTakeaway: false,
      }
    })
  }
  let cajaMig = await prisma.caja.findFirst({ where: { tenantId, codigo: 'MIGRACION_BRIO' } })
  if (!cajaMig) {
    cajaMig = await prisma.caja.create({
      data: {
        tenantId, codigo: 'MIGRACION_BRIO', nombre: 'Migración Brio (histórico)', tipo: 'CAJA_GENERAL',
        activo: false, paraBuffet: false, paraCaja: false, paraKiosco: false, paraTakeaway: false,
      }
    })
  }
  const admin = await prisma.admin.findFirst({ select: { id: true } })
  if (!admin) throw new Error('No hay Admins en la BD.')
  const adminId = admin.id

  // Conceptos por defecto (creados si faltan)
  const cMora = await getOCreateConcepto('MORA_SOCIOS', 'Mora Socios')
  const cConcepto = await getOCreateConcepto('CONCEPTO_VARIOS', 'Concepto Varios')
  const cFinanciado = await getOCreateConcepto('FINANCIADO', 'Financiado')
  const cNC = await getOCreateConcepto('NOTA_CREDITO', 'Nota de Crédito')
  conceptoPorCategoria.set('MORA', cMora?.id)
  conceptoPorCategoria.set('CONCEPTO', cConcepto?.id)
  conceptoPorCategoria.set('FINANCIADO', cFinanciado?.id)
  conceptoPorCategoria.set('NOTA_CREDITO', cNC?.id)

  // ── Cache de períodos ───────────────────────────────────────────────────────
  const periodosCache = new Map()
  async function getOCreatePeriodo(mes, anio) {
    const key = `${anio}-${mes}`
    if (periodosCache.has(key)) return periodosCache.get(key)
    let p = await prisma.periodo.findFirst({ where: { mes, anio, tenantId } })
    if (!p) {
      const fechaVenc = new Date(anio, mes, 10) // día 10 del mes siguiente
      p = await prisma.periodo.create({
        data: {
          tenantId, mes, anio,
          nombre: `${String(mes).padStart(2, '0')}/${anio}`,
          fechaVencimiento: fechaVenc,
          estado: 'CERRADO',
        }
      })
    }
    periodosCache.set(key, p.id)
    return p.id
  }

  // ── Procesar filas ──────────────────────────────────────────────────────────
  console.log(`\nProcesando ${filasFiltradas.length} filas...`)
  let importados = 0, pagosCreados = 0, errores = 0, sinSocio = 0
  const erroresDetalle = []

  for (let i = 0; i < filasFiltradas.length; i++) {
    const row = filasFiltradas[i]
    const nroSocio = row['Nro. Socio']?.toString().trim()
    const tipoCuotaOrig = row['Tipo Cuota']?.toString().trim()
    const periodoStr = row['Periodo']?.toString().trim()
    const descCuota = row['Desc. Cuota']?.toString().trim()
    const precio = parseFloat(row['Precio']) || 0
    const porcentaje = parseFloat(row['Porc. Cuota']) || 1
    const importeReal = parseFloat(row['Importe Real']) || 0
    const estCuota = (row['Est. Cuota'] ?? '').toString().toUpperCase().trim()
    const fechaGen = excelDateToJS(row['Fecha Gen.'])
    const fechaCobro = excelDateToJS(row['Fecha Cobro'])

    const socioId = socioByNro.get(nroSocio)
    if (!socioId) { sinSocio++; continue }

    const periodoData = parsePeriodo(periodoStr)
    let periodoId = null
    if (periodoData) {
      try { periodoId = await getOCreatePeriodo(periodoData.mes, periodoData.anio) } catch {}
    }

    let categoria = mapCategoria(tipoCuotaOrig, descCuota)
    let categoriaActividadId = null
    if (tipoCuotaOrig?.toUpperCase() === 'ACTIVIDAD' && descCuota) {
      const sep = descCuota.indexOf(' - ')
      if (sep !== -1) {
        const actNorm = descCuota.substring(0, sep).toUpperCase().trim()
        const catNorm = descCuota.substring(sep + 3).toUpperCase().trim()
        categoriaActividadId = actCatMap.get(`${actNorm}|${catNorm}`) ?? actCatMap.get(`|${catNorm}`) ?? null
      }
      if (!categoriaActividadId) categoria = 'CONCEPTO'
    }

    const esNotaCredito = estCuota === 'NOTA DE CRÉDITO' || estCuota === 'NOTA DE CREDITO'
    const esFinanciado = estCuota === 'FINANCIADO'
    const esPagada = estCuota === 'PAGADA'
    const esPendiente = estCuota === 'PENDIENTE'

    // Estado del cargo:
    //   PAGADA       → PAGADO (+ creo Pago)
    //   PENDIENTE    → PENDIENTE
    //   NOTA CRÉDITO → ANULADO
    //   FINANCIADO   → ANULADO (la cuota original fue reemplazada por plan de pago)
    let estadoCargo
    if (esPagada) estadoCargo = 'PAGADO'
    else if (esPendiente) estadoCargo = 'PENDIENTE'
    else if (esNotaCredito || esFinanciado) estadoCargo = 'ANULADO'
    else estadoCargo = 'PENDIENTE' // fallback prudente

    const montoBase = precio * porcentaje || importeReal
    const montoOriginal = esNotaCredito ? -Math.abs(importeReal) : (montoBase || importeReal)
    const montoBonificacion = esNotaCredito ? 0 : Math.max(0, montoBase - importeReal)
    const montoTotal = esNotaCredito ? -Math.abs(importeReal) : importeReal

    if (esNotaCredito) categoria = 'NOTA_CREDITO'

    let conceptoTesoreriaId = conceptoPorCategoria.get(categoria) ?? null
    if (categoria === 'ACTIVIDAD' && descCuota) {
      const sep = descCuota.indexOf(' - ')
      const actNorm = sep !== -1 ? descCuota.substring(0, sep).toUpperCase().trim() : ''
      conceptoTesoreriaId = conceptoPorActividad.get(actNorm) ?? conceptoTesoreriaId
    }

    const fechaFallback = periodoData ? new Date(periodoData.anio, periodoData.mes - 1, 1) : new Date()
    const fechaGeneracionFinal = fechaGen || fechaFallback
    const fechaPagoFinal = esPagada ? (fechaCobro || fechaGen || fechaFallback) : null

    try {
      const cargoCreado = await prisma.cargo.create({
        data: {
          tenantId,
          socioId,
          periodoId,
          categoriaActividadId,
          conceptoTesoreriaId,
          descripcion: descCuota || tipoCuotaOrig || 'Cuota',
          categoria,
          tipoCuota: tipoCuotaOrig || null,
          montoOriginal,
          montoRecargo: 0,
          montoBonificacion,
          montoTotal,
          estado: estadoCargo,
          fechaGeneracion: fechaGeneracionFinal,
          fechaPago: fechaPagoFinal,
          origen: ORIGEN,
          observaciones: `Brio histórico: ${row['Categ. Socio'] || ''} | Est: ${row['Estado'] || ''} | EstCuota: ${estCuota}`,
        }
      })

      if (esPagada && montoTotal > 0) {
        const pago = await prisma.pago.create({
          data: {
            tenantId,
            numero: `MIGH-${cargoCreado.id}`,
            fecha: fechaCobro || fechaGen || fechaFallback,
            socioId,
            montoTotal,
            montoRecibido: montoTotal,
            montoACuenta: 0,
            medioPagoId: medioPagoMig.id,
            cajaId: cajaMig.id,
            estado: 'CONFIRMADO',
            origen: ORIGEN,
            observaciones: `Migración Brio histórico: ${descCuota || tipoCuotaOrig || ''} ${periodoStr || ''}`.trim(),
            registradoPor: adminId,
          }
        })
        await prisma.cargo.update({ where: { id: cargoCreado.id }, data: { pagoId: pago.id } })
        pagosCreados++
      }

      importados++
      if (importados % 1000 === 0) process.stdout.write(`\r  Importados: ${importados}...`)
    } catch (err) {
      errores++
      if (errores <= 20) erroresDetalle.push(`Fila ${i}: socio ${nroSocio} — ${err.message}`)
    }
  }

  // ── Resumen final ──────────────────────────────────────────────────────────
  console.log('\n')
  console.log('='.repeat(60))
  console.log('IMPORTACIÓN HISTÓRICA COMPLETA')
  console.log('='.repeat(60))
  console.log(`Cargos importados:     ${importados}`)
  console.log(`Pagos creados:         ${pagosCreados}`)
  console.log(`Sin socio:             ${sinSocio}`)
  console.log(`Errores:               ${errores}`)
  if (erroresDetalle.length > 0) {
    console.log(`\nDetalle de errores (primeros 20):`)
    erroresDetalle.forEach(e => console.log(`  - ${e}`))
  }

  const [pagados, pendientes, anulados] = await Promise.all([
    prisma.cargo.count({ where: { tenantId, origen: ORIGEN, estado: 'PAGADO' } }),
    prisma.cargo.count({ where: { tenantId, origen: ORIGEN, estado: 'PENDIENTE' } }),
    prisma.cargo.count({ where: { tenantId, origen: ORIGEN, estado: 'ANULADO' } }),
  ])
  console.log(`\nEn BD (origen=${ORIGEN}):`)
  console.log(`  Cargos PAGADOS:    ${pagados}`)
  console.log(`  Cargos PENDIENTES: ${pendientes}`)
  console.log(`  Cargos ANULADOS:   ${anulados}`)

  console.log(`\n✅ Done. Re-correr comparar-saldo-brio-vs-clubix.js para verificar.\n`)
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
