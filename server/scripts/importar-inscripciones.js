/**
 * Script para importar inscripciones de socios a actividades desde StatusActividades.xlsx
 * Ejecutar con: node scripts/importar-inscripciones.js
 */

import XLSX from 'xlsx'
import { PrismaClient } from '@prisma/client'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const prisma = new PrismaClient()

async function importarInscripciones() {
  try {
    // Leer el Excel
    const filePath = path.join(__dirname, '../../brio/StatusActividades.xlsx')
    const workbook = XLSX.readFile(filePath)
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(sheet)

    console.log(`Leyendo ${data.length} registros del Excel...`)

    // Cargar todas las categorías de actividad en memoria para búsqueda rápida
    const categorias = await prisma.categoriaActividad.findMany({
      include: { actividad: true }
    })
    const categoriasPorCodigo = new Map()
    categorias.forEach(c => {
      categoriasPorCodigo.set(c.codigo, c)
      // También mapear por nombre para mayor flexibilidad
      categoriasPorCodigo.set(c.nombre.toUpperCase(), c)
    })

    // Cargar todos los socios en memoria
    const socios = await prisma.socio.findMany({
      select: { id: true, nroSocio: true }
    })
    const sociosPorNro = new Map()
    socios.forEach(s => {
      sociosPorNro.set(s.nroSocio, s)
    })

    console.log(`Categorías cargadas: ${categorias.length}`)
    console.log(`Socios cargados: ${socios.length}`)

    let importados = 0
    let errores = 0
    let duplicados = 0
    const erroresDetalle = []

    // Procesar cada fila (saltando la primera que son encabezados)
    for (let i = 1; i < data.length; i++) {
      const row = data[i]

      const nroSocio = row['__EMPTY_2']?.toString().trim()
      const categoriaNombre = row['__EMPTY_1']?.toString().trim()
      const becado = row['__EMPTY_13']?.toString().toUpperCase() === 'SI'
      const federado = row['__EMPTY_14']?.toString().toUpperCase() === 'SI'
      const generaCuota = row['__EMPTY_15']?.toString().toUpperCase() !== 'NO'
      const porcentaje = parseFloat(row['__EMPTY_18']) || 100
      const importe = parseFloat(row['__EMPTY_19']) || 0
      const fechaAltaStr = row['__EMPTY_20']

      // Validar datos requeridos
      if (!nroSocio || !categoriaNombre) {
        continue // Fila vacía o incompleta
      }

      // Buscar el socio
      const socio = sociosPorNro.get(nroSocio)
      if (!socio) {
        errores++
        erroresDetalle.push(`Fila ${i + 1}: Socio ${nroSocio} no encontrado`)
        continue
      }

      // Buscar la categoría
      const codigoCategoria = categoriaNombre.toUpperCase().replace(/\s+/g, '_')
      let categoria = categoriasPorCodigo.get(codigoCategoria)
      if (!categoria) {
        categoria = categoriasPorCodigo.get(categoriaNombre.toUpperCase())
      }
      if (!categoria) {
        errores++
        erroresDetalle.push(`Fila ${i + 1}: Categoría "${categoriaNombre}" no encontrada`)
        continue
      }

      // Parsear fecha de alta
      let fechaInicio = new Date()
      if (fechaAltaStr) {
        if (typeof fechaAltaStr === 'number') {
          // Excel serial date
          fechaInicio = new Date((fechaAltaStr - 25569) * 86400 * 1000)
        } else {
          const parsed = new Date(fechaAltaStr)
          if (!isNaN(parsed.getTime())) {
            fechaInicio = parsed
          }
        }
      }

      // Verificar si ya existe la inscripción
      const existente = await prisma.inscripcion.findFirst({
        where: {
          socioId: socio.id,
          categoriaActividadId: categoria.id,
          estado: 'ACTIVA'
        }
      })

      if (existente) {
        duplicados++
        continue
      }

      // Crear la inscripción
      try {
        await prisma.inscripcion.create({
          data: {
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

        if (importados % 50 === 0) {
          console.log(`  Procesados: ${importados}...`)
        }
      } catch (err) {
        errores++
        erroresDetalle.push(`Fila ${i + 1}: Error al crear inscripción - ${err.message}`)
      }
    }

    // Resumen final
    console.log('\n' + '='.repeat(50))
    console.log('IMPORTACIÓN COMPLETADA')
    console.log('='.repeat(50))
    console.log(`Inscripciones importadas: ${importados}`)
    console.log(`Duplicados omitidos: ${duplicados}`)
    console.log(`Errores: ${errores}`)

    if (erroresDetalle.length > 0 && erroresDetalle.length <= 20) {
      console.log('\nDetalle de errores:')
      erroresDetalle.forEach(e => console.log(`  - ${e}`))
    } else if (erroresDetalle.length > 20) {
      console.log(`\nPrimeros 20 errores:`)
      erroresDetalle.slice(0, 20).forEach(e => console.log(`  - ${e}`))
      console.log(`  ... y ${erroresDetalle.length - 20} más`)
    }

    // Estadísticas finales
    const totalInscripciones = await prisma.inscripcion.count({ where: { estado: 'ACTIVA' } })
    console.log(`\nTotal inscripciones activas en BD: ${totalInscripciones}`)

  } catch (error) {
    console.error('Error durante la importación:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

importarInscripciones()
