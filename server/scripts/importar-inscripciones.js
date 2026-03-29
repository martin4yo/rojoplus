/**
 * Script para importar inscripciones de socios a actividades desde ActividadesStatus.xlsx
 * IMPORTANTE: Ejecutar DESPUÉS de importar-actividades.js
 * Ejecutar con: node scripts/importar-inscripciones.js
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
  if (!val) return new Date()
  if (typeof val === 'number') return new Date((val - 25569) * 86400 * 1000)
  const parsed = new Date(val)
  return isNaN(parsed.getTime()) ? new Date() : parsed
}

async function importarInscripciones() {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } })
    if (!tenant) throw new Error(`Tenant "${TENANT_SLUG}" no encontrado`)
    const tenantId = tenant.id
    console.log(`Tenant: ${tenant.nombre} (id=${tenantId})`)

    // Limpiar inscripciones del tenant
    console.log('\nLimpiando inscripciones...')
    const deleted = await prisma.inscripcion.deleteMany({ where: { tenantId } })
    console.log(`  Inscripciones eliminadas: ${deleted.count}`)

    // Leer Excel con encabezados reales (fila 2, índice 2)
    const filePath = path.join(__dirname, '../../brio/ActividadesStatus.xlsx')
    const workbook = XLSX.readFile(filePath)
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(sheet, { range: 2 })

    console.log(`Registros en el Excel: ${data.length}`)

    // Cargar categorías del tenant indexadas por código (ACTIVIDAD_CATEGORIA)
    const categorias = await prisma.categoriaActividad.findMany({
      where: { tenantId },
      include: { actividad: true }
    })
    const categoriasPorCodigo = new Map()
    categorias.forEach(c => {
      categoriasPorCodigo.set(c.codigo, c)
    })
    console.log(`Categorías cargadas: ${categorias.length}`)

    // Cargar socios del tenant indexados por nroSocio
    const socios = await prisma.socio.findMany({
      where: { tenantId },
      select: { id: true, nroSocio: true }
    })
    const sociosPorNro = new Map()
    socios.forEach(s => {
      if (s.nroSocio) sociosPorNro.set(s.nroSocio.toString().trim(), s)
    })
    console.log(`Socios cargados: ${socios.length}`)

    let importados = 0
    let duplicados = 0
    let errores = 0
    const erroresDetalle = []

    for (let i = 0; i < data.length; i++) {
      const row = data[i]

      const nroSocio = row['Nro Socio']?.toString().trim()
      const actividadNombre = row['Actividad']?.toString().trim()
      const categoriaNombre = row['Cat. Actividad']?.toString().trim()
      const becado = row['Becado']?.toString().toUpperCase() === 'SI'
      const federado = row['Federado']?.toString().toUpperCase() === 'SI'
      const generaCuota = row['Genera Cuota']?.toString().toUpperCase() !== 'NO'
      const porcentaje = parseFloat(row['Porcentaje']) || 100
      const importe = parseFloat(row['Importe']) || 0
      const fechaAltaRaw = row['Fecha de Alta Actividad']

      if (!nroSocio || !actividadNombre || !categoriaNombre) continue

      // Buscar socio
      const socio = sociosPorNro.get(nroSocio)
      if (!socio) {
        errores++
        erroresDetalle.push(`Fila ${i + 3}: Socio ${nroSocio} no encontrado`)
        continue
      }

      // Buscar categoría por código compuesto ACTIVIDAD_CATEGORIA
      const catCodigo = (actividadNombre.toUpperCase().replace(/\s+/g, '_') + '_' +
        categoriaNombre.toUpperCase().replace(/\s+/g, '_')).substring(0, 50)

      const categoria = categoriasPorCodigo.get(catCodigo)
      if (!categoria) {
        errores++
        erroresDetalle.push(`Fila ${i + 3}: Categoría "${categoriaNombre}" de actividad "${actividadNombre}" no encontrada (código: ${catCodigo})`)
        continue
      }

      const fechaInicio = excelDateToJS(fechaAltaRaw)

      // Verificar duplicado
      const existente = await prisma.inscripcion.findFirst({
        where: { tenantId, socioId: socio.id, categoriaActividadId: categoria.id, estado: 'ACTIVA' }
      })
      if (existente) {
        duplicados++
        continue
      }

      try {
        await prisma.inscripcion.create({
          data: {
            tenantId,
            socioId: socio.id,
            categoriaActividadId: categoria.id,
            fechaInicio,
            fechaInscripcion: fechaInicio,
            becado,
            federado,
            exentoCuota: !generaCuota,
            porcentajeCuota: porcentaje,
            estado: 'ACTIVA',
            observaciones: importe > 0 ? `Importe original: $${importe}` : null,
          }
        })
        importados++
        if (importados % 50 === 0) console.log(`  Procesados: ${importados}...`)
      } catch (err) {
        errores++
        erroresDetalle.push(`Fila ${i + 3}: Error al crear inscripción socio ${nroSocio} - ${err.message}`)
      }
    }

    console.log('\n' + '='.repeat(50))
    console.log('LISTO')
    console.log(`Inscripciones importadas: ${importados}`)
    console.log(`Duplicados omitidos:      ${duplicados}`)
    console.log(`Errores:                  ${errores}`)

    if (erroresDetalle.length > 0) {
      const muestra = erroresDetalle.slice(0, 20)
      console.log('\nDetalle de errores:')
      muestra.forEach(e => console.log(`  - ${e}`))
      if (erroresDetalle.length > 20) console.log(`  ... y ${erroresDetalle.length - 20} más`)
    }

    const total = await prisma.inscripcion.count({ where: { tenantId, estado: 'ACTIVA' } })
    console.log(`\nTotal inscripciones activas en BD (${TENANT_SLUG}): ${total}`)

  } catch (error) {
    console.error('Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

importarInscripciones()
