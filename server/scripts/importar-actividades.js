/**
 * Script para importar actividades y categorías desde StatusActividades.xlsx
 * Ejecutar con: node scripts/importar-actividades.js
 */

import XLSX from 'xlsx'
import { PrismaClient } from '@prisma/client'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const prisma = new PrismaClient()

async function importarActividades() {
  try {
    // Leer el Excel
    const filePath = path.join(__dirname, '../../brio/StatusActividades.xlsx')
    const workbook = XLSX.readFile(filePath)
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(sheet)

    console.log(`Leyendo ${data.length} registros del Excel...`)

    // La primera fila tiene los nombres de columna, así que la usamos para mapear
    // __EMPTY = Actividad, __EMPTY_1 = Cat. Actividad

    // Extraer actividades únicas y sus categorías
    const actividadesMap = new Map()

    // Saltamos la primera fila (encabezados)
    for (let i = 1; i < data.length; i++) {
      const row = data[i]
      const actividadNombre = row['__EMPTY']?.toString().trim()
      const categoriaNombre = row['__EMPTY_1']?.toString().trim()

      if (!actividadNombre) continue

      // Si no existe la actividad, crearla
      if (!actividadesMap.has(actividadNombre)) {
        actividadesMap.set(actividadNombre, new Set())
      }

      // Agregar la categoría si existe
      if (categoriaNombre) {
        actividadesMap.get(actividadNombre).add(categoriaNombre)
      }
    }

    console.log(`\nActividades encontradas: ${actividadesMap.size}`)

    // Crear actividades y categorías en la base de datos
    let orden = 1
    for (const [actividadNombre, categoriasSet] of actividadesMap) {
      const codigo = actividadNombre.toUpperCase().replace(/\s+/g, '_')

      console.log(`\n[${orden}] Actividad: ${actividadNombre} (${codigo})`)
      console.log(`   Categorías: ${categoriasSet.size}`)

      // Crear o actualizar la actividad
      const actividad = await prisma.actividad.upsert({
        where: { codigo },
        update: { nombre: actividadNombre },
        create: {
          codigo,
          nombre: actividadNombre,
          requiereAptaFisica: true,
          activo: true,
          orden,
        },
      })

      // Crear las categorías
      let catOrden = 1
      for (const categoriaNombre of categoriasSet) {
        const catCodigo = categoriaNombre.toUpperCase().replace(/\s+/g, '_')

        console.log(`   - ${categoriaNombre} (${catCodigo})`)

        await prisma.categoriaActividad.upsert({
          where: { codigo: catCodigo },
          update: { nombre: categoriaNombre },
          create: {
            codigo: catCodigo,
            nombre: categoriaNombre,
            actividadId: actividad.id,
            activo: true,
            orden: catOrden,
          },
        })
        catOrden++
      }
      orden++
    }

    // Resumen final
    const totalActividades = await prisma.actividad.count()
    const totalCategorias = await prisma.categoriaActividad.count()

    console.log('\n' + '='.repeat(50))
    console.log('IMPORTACIÓN COMPLETADA')
    console.log('='.repeat(50))
    console.log(`Actividades: ${totalActividades}`)
    console.log(`Categorías: ${totalCategorias}`)

  } catch (error) {
    console.error('Error durante la importación:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

importarActividades()
