/**
 * Script para importar cuotas generadas desde Cuotas.xlsx
 * Crea registros en tabla cargos con su estado (PAGADO/PENDIENTE)
 *
 * Ejecutar con: node scripts/importar-cuotas.js
 * Prerequisito: Paso 1 (socios) completado
 */

import XLSX from 'xlsx'
import { PrismaClient } from '@prisma/client'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const prisma = new PrismaClient()
const TENANT_SLUG = 'sportivopilar'

function excelDateToJS(val) {
  if (!val) return null
  if (typeof val === 'number') return new Date((val - 25569) * 86400 * 1000)
  const parsed = new Date(val)
  return isNaN(parsed.getTime()) ? null : parsed
}

function parsePeriodo(periodoStr) {
  // Formato "05/2022"
  if (!periodoStr) return null
  const [mes, anio] = periodoStr.toString().split('/')
  if (!mes || !anio) return null
  return { mes: parseInt(mes), anio: parseInt(anio) }
}

function mapCategoria(tipoCuota) {
  const map = {
    'CUOTA SOCIAL': 'CUOTA_SOCIAL',
    'ACTIVIDAD':    'ACTIVIDAD',
    'CONCEPTO':     'CONCEPTO',
    'MOROSIDAD':    'MORA',
    'FINANCIADO':   'FINANCIADO',
  }
  return map[tipoCuota] || 'CONCEPTO'
}

async function importarCuotas() {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } })
    if (!tenant) throw new Error(`Tenant "${TENANT_SLUG}" no encontrado`)
    const tenantId = tenant.id
    console.log(`Tenant: ${tenant.nombre} (id=${tenantId})`)

    // Leer Cuotas.xlsx
    const filePath = path.join(__dirname, '../../brio/Cuotas.xlsx')
    const workbook = XLSX.readFile(filePath)
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { range: 2 })
    console.log(`Registros en Cuotas.xlsx: ${data.length}`)

    // Cargar socios del tenant indexados por nroSocio
    const socios = await prisma.socio.findMany({
      where: { tenantId },
      select: { id: true, nroSocio: true }
    })
    const sociosPorNro = new Map()
    socios.forEach(s => { if (s.nroSocio) sociosPorNro.set(s.nroSocio.toString().trim(), s.id) })
    console.log(`Socios en BD: ${sociosPorNro.size}`)

    // Limpiar cargos de migración del tenant
    console.log('\nLimpiando cargos existentes...')
    const deleted = await prisma.cargo.deleteMany({
      where: { tenantId, origen: 'MIGRACION_BRIO' }
    })
    console.log(`Cargos eliminados: ${deleted.count}`)

    // Cache de periodos
    const periodosCache = new Map()

    async function getOCreatePeriodo(mes, anio) {
      const key = `${anio}-${mes}`
      if (periodosCache.has(key)) return periodosCache.get(key)

      let periodo = await prisma.periodo.findFirst({
        where: { tenantId, mes, anio }
      })
      if (!periodo) {
        const fechaVencimiento = new Date(anio, mes, 10) // día 10 del mes siguiente
        periodo = await prisma.periodo.create({
          data: {
            tenantId,
            mes,
            anio,
            nombre: `${mes.toString().padStart(2,'0')}/${anio}`,
            fechaVencimiento,
            estado: 'CERRADO',
          }
        })
      }
      periodosCache.set(key, periodo.id)
      return periodo.id
    }

    let importados = 0
    let sinSocio = 0
    let errores = 0
    const erroresDetalle = []

    for (let i = 0; i < data.length; i++) {
      const row = data[i]

      const nroSocio = row['Nro. Socio']?.toString().trim()
      const tipoCuota = row['Tipo Cuota']?.toString().trim()
      const periodoStr = row['Periodo']?.toString().trim()
      const descripcion = row['Desc. Cuota']?.toString().trim()
      const precio = parseFloat(row['Precio']) || 0
      const porcentaje = parseFloat(row['Porc. Cuota']) || 1
      const importeReal = parseFloat(row['Importe Real']) || 0
      const estCuota = row['Est. Cuota']?.toString().toUpperCase()
      const fechaGen = excelDateToJS(row['Fecha Gen.'])
      const fechaCobro = excelDateToJS(row['Fecha Cobro'])

      if (!nroSocio) continue

      const socioId = sociosPorNro.get(nroSocio)
      if (!socioId) {
        sinSocio++
        continue
      }

      // Periodo
      let periodoId = null
      const periodoData = parsePeriodo(periodoStr)
      if (periodoData) {
        try {
          periodoId = await getOCreatePeriodo(periodoData.mes, periodoData.anio)
        } catch (e) {
          // ignorar error de periodo, continuar sin él
        }
      }

      const esPagado = estCuota === 'PAGADA'
      const montoOriginal = precio * porcentaje
      const montoBonificacion = Math.max(0, montoOriginal - importeReal)

      try {
        await prisma.cargo.create({
          data: {
            tenantId,
            socioId,
            periodoId,
            descripcion: descripcion || tipoCuota || 'Cuota',
            categoria: mapCategoria(tipoCuota),
            tipoCuota: tipoCuota || null,
            montoOriginal: montoOriginal || importeReal,
            montoRecargo: 0,
            montoBonificacion,
            montoTotal: importeReal,
            estado: esPagado ? 'PAGADO' : 'PENDIENTE',
            fechaGeneracion: fechaGen || new Date(),
            fechaPago: esPagado ? fechaCobro : null,
            origen: 'MIGRACION_BRIO',
            observaciones: `Migrado desde Brio. Estado socio: ${row['Estado'] || ''}`,
          }
        })
        importados++
        if (importados % 1000 === 0) console.log(`  Procesados: ${importados}...`)
      } catch (err) {
        errores++
        if (errores <= 20) erroresDetalle.push(`Fila ${i + 3}: socio ${nroSocio} - ${err.message}`)
      }
    }

    console.log('\n' + '='.repeat(50))
    console.log('LISTO')
    console.log(`Cargos importados:     ${importados}`)
    console.log(`Sin socio (saltados):  ${sinSocio}`)
    console.log(`Errores:               ${errores}`)
    if (erroresDetalle.length > 0) {
      console.log('\nDetalle errores:')
      erroresDetalle.forEach(e => console.log(`  - ${e}`))
    }

    const pagados = await prisma.cargo.count({ where: { tenantId, origen: 'MIGRACION_BRIO', estado: 'PAGADO' } })
    const pendientes = await prisma.cargo.count({ where: { tenantId, origen: 'MIGRACION_BRIO', estado: 'PENDIENTE' } })
    console.log(`\nEn BD — Pagados: ${pagados} | Pendientes: ${pendientes}`)

  } catch (error) {
    console.error('Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

importarCuotas()
