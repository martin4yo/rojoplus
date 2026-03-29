/**
 * Script para importar actividades y categorías desde ActividadesStatus.xlsx
 * Crea la jerarquía Actividad → CategoriaActividad para el tenant sportivopilar
 * Ejecutar con: node scripts/importar-actividades.js
 */

import XLSX from 'xlsx'
import { PrismaClient } from '@prisma/client'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const prisma = new PrismaClient()
const TENANT_SLUG = 'sportivopilar'

async function importarActividades() {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } })
    if (!tenant) throw new Error(`Tenant "${TENANT_SLUG}" no encontrado`)
    const tenantId = tenant.id
    console.log(`Tenant: ${tenant.nombre} (id=${tenantId})`)

    // Limpiar tablas del tenant (orden: hijos primero por FK)
    console.log('\nLimpiando tablas...')
    const delInscripciones = await prisma.inscripcion.deleteMany({ where: { tenantId } })
    const delCategorias = await prisma.categoriaActividad.deleteMany({ where: { tenantId } })
    const delActividades = await prisma.actividad.deleteMany({ where: { tenantId } })
    console.log(`  Inscripciones eliminadas: ${delInscripciones.count}`)
    console.log(`  Categorías eliminadas:    ${delCategorias.count}`)
    console.log(`  Actividades eliminadas:   ${delActividades.count}`)

    // Leer Excel con encabezados reales (fila 2, índice 2)
    const filePath = path.join(__dirname, '../../brio/ActividadesStatus.xlsx')
    const workbook = XLSX.readFile(filePath)
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(sheet, { range: 2 })

    console.log(`Registros en el Excel: ${data.length}`)

    // Armar mapa Actividad → Set de Categorías
    const actividadesMap = new Map()
    for (const row of data) {
      const actividad = row['Actividad']?.toString().trim()
      const categoria = row['Cat. Actividad']?.toString().trim()
      if (!actividad) continue
      if (!actividadesMap.has(actividad)) actividadesMap.set(actividad, new Set())
      if (categoria) actividadesMap.get(actividad).add(categoria)
    }

    console.log(`\nActividades únicas: ${actividadesMap.size}`)
    for (const [act, cats] of actividadesMap) {
      console.log(`  - ${act}: ${cats.size} categorías`)
    }

    // Crear jerarquía en BD
    let ordenAct = 1
    for (const [actividadNombre, categoriasSet] of actividadesMap) {
      const codigo = actividadNombre.toUpperCase().replace(/\s+/g, '_').substring(0, 50)

      let actividad = await prisma.actividad.findFirst({ where: { codigo, tenantId } })
      if (!actividad) {
        actividad = await prisma.actividad.create({
          data: { tenantId, codigo, nombre: actividadNombre, requiereAptaFisica: true, activo: true, orden: ordenAct }
        })
        console.log(`\n[NUEVA] Actividad: ${actividadNombre}`)
      } else {
        console.log(`\n[EXISTE] Actividad: ${actividadNombre}`)
      }

      let ordenCat = 1
      for (const categoriaNombre of categoriasSet) {
        // Código único por tenant: prefijo con actividad para evitar colisiones
        const catCodigo = (codigo + '_' + categoriaNombre.toUpperCase().replace(/\s+/g, '_')).substring(0, 50)

        const catExistente = await prisma.categoriaActividad.findFirst({
          where: { codigo: catCodigo, tenantId }
        })
        if (!catExistente) {
          await prisma.categoriaActividad.create({
            data: { tenantId, codigo: catCodigo, nombre: categoriaNombre, actividadId: actividad.id, activo: true, orden: ordenCat }
          })
          console.log(`  + Categoría creada: ${categoriaNombre}`)
        } else {
          console.log(`  = Categoría existe: ${categoriaNombre}`)
        }
        ordenCat++
      }
      ordenAct++
    }

    const totalAct = await prisma.actividad.count({ where: { tenantId } })
    const totalCat = await prisma.categoriaActividad.count({ where: { tenantId } })

    console.log('\n' + '='.repeat(50))
    console.log('LISTO')
    console.log(`Actividades en BD (${TENANT_SLUG}): ${totalAct}`)
    console.log(`Categorías en BD (${TENANT_SLUG}): ${totalCat}`)

  } catch (error) {
    console.error('Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

importarActividades()
