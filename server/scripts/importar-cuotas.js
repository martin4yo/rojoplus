/**
 * =============================================================================
 * IMPORTACIÓN DE CUOTAS DESDE BRIO — importar-cuotas.js
 * =============================================================================
 *
 * Lee Cuotas.xlsx (carpeta /brio) y crea registros en la tabla `cargos`.
 *
 * USO:
 *   cd server
 *   node scripts/importar-cuotas.js   (lee DATABASE_URL de server/.env)
 *
 * PREREQUISITOS:
 *   1. Socios ya importados para el tenant (importar-socios.js)
 *   2. Actividades y CategoriaActividad cargadas en el tenant (si hay cuotas ACTIVIDAD)
 *
 * CONFIGURACIÓN:
 *   Modificar TENANT_SLUG y PERIODO_DESDE_* según la ejecución.
 *
 * COMPORTAMIENTO:
 *   - Solo importa períodos estrictamente posteriores a PERIODO_DESDE (exclusive).
 *     Ej: PERIODO_DESDE_ANIO=2026, PERIODO_DESDE_MES=4 → importa desde mayo/2026.
 *   - Borra previamente los cargos de origen MIGRACION_BRIO del tenant (reemplazable).
 *   - Para Tipo Cuota = "ACTIVIDAD": intenta matchear Desc.Cuota con la combinación
 *     "ACTIVIDAD - CATEGORIA" definida en las tablas actividades/categorias_actividad.
 *     Si hay match → categoriaActividadId se setea y categoria = 'ACTIVIDAD'.
 *     Si no hay match → categoria = 'CONCEPTO', tipoCuota = texto original.
 *   - Para otros tipos (CUOTA SOCIAL, CONCEPTO, etc.): usa mapCategoria().
 *   - El campo tipoCuota siempre guarda el texto original de la columna "Tipo Cuota".
 *
 * COLUMNAS DEL EXCEL (fila 3 = headers, datos desde fila 4):
 *   Fecha Gen. | Forma Pago | Cobrador | Medio de Pago | Nro. Socio |
 *   Apellido Nombre | Celular | Categ. Socio | Tipo Cuota | Periodo |
 *   Desc. Cuota | Precio | Porc. Cuota | Importe Real | Estado |
 *   Generado | Est. Cuota | Fecha Cobro | Caja | Usuario | ...
 *
 * PARA REPETIR:
 *   1. Ajustar TENANT_SLUG al tenant destino.
 *   2. Ajustar PERIODO_DESDE_ANIO / PERIODO_DESDE_MES si se quiere otro corte.
 *   3. Ejecutar. Los cargos MIGRACION_BRIO del tenant se borran y re-importan.
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

// ── CONFIGURACIÓN ─────────────────────────────────────────────────────────────
// Tenant se pasa por --tenant <slug>
// Periodos por --desde-anio <año> --desde-mes <mes> (default: año actual y mes 4)
const PERIODO_DESDE_ANIO = parseInt(arg('desde-anio', String(new Date().getFullYear())))
const PERIODO_DESDE_MES  = parseInt(arg('desde-mes',  '4'))
// ─────────────────────────────────────────────────────────────────────────────

function excelDateToJS(val) {
  if (!val) return null
  if (typeof val === 'number') return new Date((val - 25569) * 86400 * 1000)
  const parsed = new Date(val)
  return isNaN(parsed.getTime()) ? null : parsed
}

function parsePeriodo(periodoStr) {
  // Formato "MM/YYYY"
  if (!periodoStr) return null
  const match = periodoStr.toString().match(/^(\d{1,2})\/(\d{4})$/)
  if (!match) return null
  return { mes: parseInt(match[1]), anio: parseInt(match[2]) }
}

function periodoPosteriorAlCorte(mes, anio) {
  return anio > PERIODO_DESDE_ANIO ||
    (anio === PERIODO_DESDE_ANIO && mes >= PERIODO_DESDE_MES)
}

function mapCategoria(tipoCuota, descCuota) {
  const tc = tipoCuota?.toUpperCase()
  if (tc === 'CUOTA SOCIAL') {
    return descCuota?.toUpperCase().includes('GRUPO FAMILIAR') ? 'TITULAR_FAMILIA' : 'SOCIO_UNICO'
  }
  const map = {
    'ACTIVIDAD':  'ACTIVIDAD',
    'CONCEPTO':   'CONCEPTO',
    'MOROSIDAD':  'MORA',
    'FINANCIADO': 'FINANCIADO',
  }
  return map[tc] || 'CONCEPTO'
}

async function importarCuotas() {
  try {
    // ── Tenant ────────────────────────────────────────────────────────────────
    const tenant = await resolveTenant(prisma, 'importar-cuotas.js')
    const tenantId = tenant.id
    console.log(`Filtro de período: desde ${PERIODO_DESDE_MES}/${PERIODO_DESDE_ANIO} en adelante`)

    // ── Leer Excel ────────────────────────────────────────────────────────────
    const filePath = path.join(__dirname, '../../brio/Cuotas.xlsx')
    const workbook = XLSX.readFile(filePath)
    // range:2 → los headers están en la fila 3 del archivo (índice 2), datos desde fila 4
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { range: 2 })
    console.log(`Registros en Cuotas.xlsx: ${data.length}`)

    // ── Socios ────────────────────────────────────────────────────────────────
    const socios = await prisma.socio.findMany({
      where: { tenantId },
      select: { id: true, nroSocio: true }
    })
    const sociosPorNro = new Map()
    socios.forEach(s => {
      if (s.nroSocio) sociosPorNro.set(s.nroSocio.toString().trim(), s.id)
    })
    console.log(`Socios en BD para tenant: ${sociosPorNro.size}`)

    // ── Actividades y categorías ──────────────────────────────────────────────
    // Mapa: "ACTIVIDAD_NOMBRE|CATEGORIA_NOMBRE" → CategoriaActividad.id
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
        // También solo por categoría (fallback)
        if (!actCatMap.has(`|${catNorm}`)) actCatMap.set(`|${catNorm}`, cat.id)
      }
    }
    console.log(`Actividades: ${actividades.length} | Combinaciones act+cat: ${actCatMap.size}`)

    // ── Conceptos de tesorería ────────────────────────────────────────────────
    // Asegura que existan los conceptos necesarios y construye el mapa categoria → conceptoId.
    // Para TipoSocio y Actividad: usa el concepto ya vinculado o crea uno y lo vincula.

    async function getOCreateConcepto(codigo, nombre) {
      let concepto = await prisma.conceptoTesoreria.findUnique({ where: { tenantId_codigo: { tenantId, codigo } } })
      if (!concepto) {
        concepto = await prisma.conceptoTesoreria.create({
          data: { tenantId, codigo, nombre, tipo: 'INGRESO', usaEnTesoreria: true }
        })
        console.log(`  Concepto creado: ${codigo}`)
      }
      return concepto
    }

    // Tipos de socio → concepto vinculado
    const tiposSocio = await prisma.tipoSocio.findMany({ where: { tenantId }, include: { conceptoTesoreria: true } })
    const conceptoPorCategoria = new Map() // categoria → conceptoTesoreriaId

    for (const ts of tiposSocio) {
      const cod = ts.codigo.toUpperCase()
      if (cod !== 'SOCIO_UNICO' && cod !== 'TITULAR_FAMILIA') continue
      let conceptoId = ts.conceptoTesoreriaId
      if (!conceptoId) {
        const c = await getOCreateConcepto(`CUOTA_${cod}`, ts.nombre)
        await prisma.tipoSocio.update({ where: { id: ts.id }, data: { conceptoTesoreriaId: c.id } })
        conceptoId = c.id
      }
      conceptoPorCategoria.set(cod, conceptoId)
    }

    // Actividades → concepto vinculado (mapa actNorm → conceptoId)
    const conceptoPorActividad = new Map() // actNorm → conceptoTesoreriaId
    const actividadesConConcepto = await prisma.actividad.findMany({ where: { tenantId } })
    for (const act of actividadesConConcepto) {
      const actNorm = act.nombre.toUpperCase().trim()
      let conceptoId = act.conceptoTesoreriaId
      if (!conceptoId) {
        const codigo = `CUOTA_${actNorm.replace(/\s+/g, '_').substring(0, 30)}`
        const c = await getOCreateConcepto(codigo, `Cuota ${act.nombre}`)
        await prisma.actividad.update({ where: { id: act.id }, data: { conceptoTesoreriaId: c.id } })
        conceptoId = c.id
      }
      conceptoPorActividad.set(actNorm, conceptoId)
    }

    // Conceptos generales para el resto de categorías
    const [conceptoMora, conceptoConcepto, conceptoFinanciado, conceptoNotaCredito] = await Promise.all([
      getOCreateConcepto('MORA_SOCIOS',   'Mora Socios'),
      getOCreateConcepto('CONCEPTO_VARIOS', 'Concepto Varios'),
      getOCreateConcepto('FINANCIADO',    'Financiado'),
      getOCreateConcepto('NOTA_CREDITO',  'Nota de Crédito'),
    ])
    conceptoPorCategoria.set('MORA',         conceptoMora.id)
    conceptoPorCategoria.set('CONCEPTO',     conceptoConcepto.id)
    conceptoPorCategoria.set('FINANCIADO',   conceptoFinanciado.id)
    conceptoPorCategoria.set('NOTA_CREDITO', conceptoNotaCredito.id)

    // ── Limpiar pagos y cargos de migración previos ───────────────────────────
    // Borrar primero los pagos (FK a cargo via cargo.pagoId) y MovimientosCaja asociados,
    // después los cargos. Si hay otras dependencias, fallarán acá.
    const deletedMovs = await prisma.movimientoCaja.deleteMany({
      where: { tenantId, observaciones: { startsWith: 'Migración Brio:' } }
    })
    const deletedPagos = await prisma.pago.deleteMany({
      where: { tenantId, origen: 'MIGRACION_BRIO' }
    })
    const deleted = await prisma.cargo.deleteMany({
      where: { tenantId, origen: 'MIGRACION_BRIO' }
    })
    console.log(`MovimientosCaja previos eliminados: ${deletedMovs.count}`)
    console.log(`Pagos previos eliminados:           ${deletedPagos.count}`)
    console.log(`Cargos previos eliminados:          ${deleted.count}`)

    // ── Setup para crear pagos históricos ─────────────────────────────────────
    // MedioPago, Caja y Admin necesarios para vincular cada pago migrado.
    let medioPagoMigracion = await prisma.medioPago.findFirst({
      where: { tenantId, codigo: 'MIGRACION_BRIO' }
    })
    if (!medioPagoMigracion) {
      medioPagoMigracion = await prisma.medioPago.create({
        data: {
          tenantId,
          codigo: 'MIGRACION_BRIO',
          nombre: 'Migración Brio (histórico)',
          tipo: 'OTRO',
          activo: false,
          paraBuffet: false, paraCaja: false, paraKiosco: false, paraTakeaway: false,
        }
      })
      console.log(`MedioPago creado: MIGRACION_BRIO (id=${medioPagoMigracion.id})`)
    }

    let cajaMigracion = await prisma.caja.findFirst({
      where: { tenantId, codigo: 'MIGRACION_BRIO' }
    })
    if (!cajaMigracion) {
      cajaMigracion = await prisma.caja.create({
        data: {
          tenantId,
          codigo: 'MIGRACION_BRIO',
          nombre: 'Migración Brio (histórico)',
          tipo: 'CAJA_GENERAL',
          activo: false,
          paraBuffet: false, paraCaja: false, paraKiosco: false, paraTakeaway: false,
        }
      })
      console.log(`Caja creada: MIGRACION_BRIO (id=${cajaMigracion.id})`)
    }

    // Admin para registradoPor — uso el primero disponible
    const admin = await prisma.admin.findFirst({ select: { id: true } })
    if (!admin) {
      throw new Error('No hay Admins en la base. Crear al menos uno antes de importar.')
    }
    const adminId = admin.id

    // ── Cache de períodos ─────────────────────────────────────────────────────
    // NOTA: Periodo tiene unique([anio, mes]) sin tenantId → periodos compartidos entre tenants.
    // Se busca/crea sin filtrar por tenant.
    const periodosCache = new Map()

    async function getOCreatePeriodo(mes, anio) {
      const key = `${anio}-${String(mes).padStart(2, '0')}`
      if (periodosCache.has(key)) return periodosCache.get(key)

      let periodo = await prisma.periodo.findFirst({ where: { mes, anio } })
      if (!periodo) {
        const fechaVencimiento = new Date(anio, mes, 10) // día 10 del mes siguiente
        periodo = await prisma.periodo.create({
          data: {
            tenantId,
            mes,
            anio,
            nombre: `${String(mes).padStart(2, '0')}/${anio}`,
            fechaVencimiento,
            estado: 'CERRADO',
          }
        })
      }
      periodosCache.set(key, periodo.id)
      return periodo.id
    }

    // ── Procesar filas ────────────────────────────────────────────────────────
    let importados = 0
    let saltadosPeriodo = 0
    let sinSocio = 0
    let errores = 0
    const erroresDetalle = []

    for (let i = 0; i < data.length; i++) {
      const row = data[i]

      const nroSocio    = row['Nro. Socio']?.toString().trim()
      const tipoCuotaOrig = row['Tipo Cuota']?.toString().trim()
      const periodoStr  = row['Periodo']?.toString().trim()
      const descCuota   = row['Desc. Cuota']?.toString().trim()
      const precio      = parseFloat(row['Precio']) || 0
      const porcentaje  = parseFloat(row['Porc. Cuota']) || 1
      const importeReal = parseFloat(row['Importe Real']) || 0
      const estCuota    = row['Est. Cuota']?.toString().toUpperCase().trim()
      const fechaGen    = excelDateToJS(row['Fecha Gen.'])
      const fechaCobro  = excelDateToJS(row['Fecha Cobro'])

      if (!nroSocio) continue

      // ── Filtro de período ─────────────────────────────────────────────────
      const periodoData = parsePeriodo(periodoStr)
      if (!periodoData || !periodoPosteriorAlCorte(periodoData.mes, periodoData.anio)) {
        saltadosPeriodo++
        continue
      }

      // ── Socio ─────────────────────────────────────────────────────────────
      const socioId = sociosPorNro.get(nroSocio)
      if (!socioId) {
        sinSocio++
        continue
      }

      // ── Período ───────────────────────────────────────────────────────────
      let periodoId = null
      try {
        periodoId = await getOCreatePeriodo(periodoData.mes, periodoData.anio)
      } catch (e) {
        // continuar sin periodo
      }

      // ── Categoría y tipo ─────────────────────────────────────────────────
      let categoria = mapCategoria(tipoCuotaOrig, descCuota)
      let categoriaActividadId = null

      if (tipoCuotaOrig?.toUpperCase() === 'ACTIVIDAD' && descCuota) {
        // Intentar parsear "NOMBRE ACTIVIDAD - NOMBRE CATEGORIA"
        const separadorIdx = descCuota.indexOf(' - ')
        if (separadorIdx !== -1) {
          const actNorm = descCuota.substring(0, separadorIdx).toUpperCase().trim()
          const catNorm = descCuota.substring(separadorIdx + 3).toUpperCase().trim()
          categoriaActividadId = actCatMap.get(`${actNorm}|${catNorm}`)
            ?? actCatMap.get(`|${catNorm}`) // fallback solo por categoría
            ?? null
        }
        if (!categoriaActividadId) {
          // Si no matchea, tratar como CONCEPTO para no perder el registro
          categoria = 'CONCEPTO'
        }
      }

      // ── Montos y estado ───────────────────────────────────────────────────
      const esNotaCredito = estCuota === 'NOTA DE CRÉDITO' || estCuota === 'NOTA DE CREDITO'
      const esPagado      = estCuota === 'PAGADA' || esNotaCredito

      const montoBase        = precio * porcentaje || importeReal
      const montoOriginal    = esNotaCredito ? -Math.abs(importeReal) : (montoBase || importeReal)
      const montoBonificacion = esNotaCredito ? 0 : Math.max(0, montoBase - importeReal)
      const montoTotal        = esNotaCredito ? -Math.abs(importeReal) : importeReal

      if (esNotaCredito) categoria = 'NOTA_CREDITO'

      // ── Concepto de tesorería ─────────────────────────────────────────────
      let conceptoTesoreriaId = conceptoPorCategoria.get(categoria) ?? null
      if (categoria === 'ACTIVIDAD' && descCuota) {
        const actNorm = descCuota.substring(0, descCuota.indexOf(' - ')).toUpperCase().trim()
        conceptoTesoreriaId = conceptoPorActividad.get(actNorm) ?? conceptoTesoreriaId
      }

      try {
        const cargoCreado = await prisma.cargo.create({
          data: {
            tenantId,
            socioId,
            periodoId,
            categoriaActividadId,
            conceptoTesoreriaId,
            descripcion:      descCuota || tipoCuotaOrig || 'Cuota',
            categoria,
            tipoCuota:        tipoCuotaOrig || null,
            montoOriginal,
            montoRecargo:     0,
            montoBonificacion,
            montoTotal,
            estado:           esPagado ? 'PAGADO' : 'PENDIENTE',
            fechaGeneracion:  fechaGen || new Date(),
            fechaPago:        esPagado ? (fechaCobro || fechaGen) : null,
            origen:           'MIGRACION_BRIO',
            observaciones:    `Brio: ${row['Categ. Socio'] || ''} | Est: ${row['Estado'] || ''}`,
          }
        })

        // Si está pagado y no es nota de crédito, crear el Pago histórico
        // y vincularlo al cargo. Sin esto la cuenta corriente del socio
        // mostraría todas las cuotas como saldo pendiente.
        if (esPagado && !esNotaCredito && montoTotal > 0) {
          const numeroPago = `MIG-${cargoCreado.id}`
          const pago = await prisma.pago.create({
            data: {
              tenantId,
              numero:         numeroPago,
              fecha:          fechaCobro || fechaGen || new Date(),
              socioId,
              montoTotal,
              montoRecibido:  montoTotal,
              montoACuenta:   0,
              medioPagoId:    medioPagoMigracion.id,
              cajaId:         cajaMigracion.id,
              estado:         'CONFIRMADO',
              origen:         'MIGRACION_BRIO',
              observaciones:  `Migración Brio: ${descCuota || tipoCuotaOrig || ''} ${periodoStr || ''}`.trim(),
              registradoPor:  adminId,
            }
          })
          await prisma.cargo.update({
            where: { id: cargoCreado.id },
            data:  { pagoId: pago.id }
          })
        }

        importados++
        if (importados % 500 === 0) process.stdout.write(`\r  Importados: ${importados}...`)
      } catch (err) {
        errores++
        if (errores <= 20) erroresDetalle.push(`Fila ${i + 3}: socio ${nroSocio} — ${err.message}`)
      }
    }

    // ── Resumen ───────────────────────────────────────────────────────────────
    console.log('\n')
    console.log('='.repeat(55))
    console.log('IMPORTACIÓN COMPLETA')
    console.log('='.repeat(55))
    console.log(`Importados:                ${importados}`)
    console.log(`Saltados (período ≤ ${PERIODO_DESDE_MES.toString().padStart(2,'0')}/${PERIODO_DESDE_ANIO}): ${saltadosPeriodo}`)
    console.log(`Sin socio (no en BD):      ${sinSocio}`)
    console.log(`Errores:                   ${errores}`)
    if (erroresDetalle.length > 0) {
      console.log('\nDetalle de errores:')
      erroresDetalle.forEach(e => console.log(`  - ${e}`))
    }

    // Conteos finales
    const [pagados, pendientes, actividad, pagosCreados] = await Promise.all([
      prisma.cargo.count({ where: { tenantId, origen: 'MIGRACION_BRIO', estado: 'PAGADO' } }),
      prisma.cargo.count({ where: { tenantId, origen: 'MIGRACION_BRIO', estado: 'PENDIENTE' } }),
      prisma.cargo.count({ where: { tenantId, origen: 'MIGRACION_BRIO', categoria: 'ACTIVIDAD' } }),
      prisma.pago.count({ where: { tenantId, origen: 'MIGRACION_BRIO' } }),
    ])
    console.log(`\nEn BD — Pagados: ${pagados} | Pendientes: ${pendientes} | Tipo ACTIVIDAD: ${actividad}`)
    console.log(`Pagos históricos creados: ${pagosCreados}`)

    // ── Actualizar cuotaMensual de TipoSocio y CategoriaActividad ─────────────
    // Calcula los valores máximos desde el Excel y los aplica al tenant.
    console.log('\n--- Actualizando cuotaMensual ---')

    // Calcular máximos desde el Excel
    let maxSocioUnico = 0
    let maxTitularFamilia = 0
    const maxPorActividad = new Map() // actNorm → importe máximo

    for (const row of data) {
      const tipo   = row['Tipo Cuota']?.toString().trim().toUpperCase()
      const desc   = row['Desc. Cuota']?.toString().trim().toUpperCase()
      const estado = row['Est. Cuota']?.toString().trim().toUpperCase()
      const importe = parseFloat(row['Importe Real']) || 0
      if ((estado !== 'PAGADA' && estado !== 'PENDIENTE') || importe <= 0) continue

      if (tipo === 'CUOTA SOCIAL' && desc) {
        if (desc.includes('GRUPO FAMILIAR')) {
          if (importe > maxTitularFamilia) maxTitularFamilia = importe
        } else {
          if (importe < 40000 && importe > maxSocioUnico) maxSocioUnico = importe
        }
      }

      if (tipo === 'ACTIVIDAD' && desc) {
        const actNorm = desc.split(' - ')[0].trim()
        if (!maxPorActividad.has(actNorm) || importe > maxPorActividad.get(actNorm)) {
          maxPorActividad.set(actNorm, importe)
        }
      }
    }

    // Actualizar cuotaMensual en los ConceptoTesoreria vinculados a TipoSocio
    for (const ts of tiposSocio) {
      const cod = ts.codigo.toUpperCase()
      let nuevo = null
      if (cod === 'SOCIO_UNICO' && maxSocioUnico > 0)        nuevo = maxSocioUnico
      if (cod === 'TITULAR_FAMILIA' && maxTitularFamilia > 0) nuevo = maxTitularFamilia
      if (nuevo !== null && ts.conceptoTesoreriaId) {
        await prisma.conceptoTesoreria.update({ where: { id: ts.conceptoTesoreriaId }, data: { cuotaMensual: nuevo } })
        console.log(`  TipoSocio ${ts.codigo} → concepto ${ts.conceptoTesoreriaId}: cuotaMensual = ${nuevo}`)
      }
    }

    // Actualizar cuotaMensual en los ConceptoTesoreria vinculados a Actividad
    for (const act of actividadesConConcepto) {
      const actNorm = act.nombre.toUpperCase().trim()
      const max = maxPorActividad.get(actNorm)
      if (!max || !act.conceptoTesoreriaId) continue
      await prisma.conceptoTesoreria.update({ where: { id: act.conceptoTesoreriaId }, data: { cuotaMensual: max } })
      console.log(`  Actividad ${act.nombre} → concepto ${act.conceptoTesoreriaId}: cuotaMensual = ${max}`)
    }
    console.log('--- cuotaMensual actualizado ---')

  } catch (error) {
    console.error('Error fatal:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

importarCuotas()
