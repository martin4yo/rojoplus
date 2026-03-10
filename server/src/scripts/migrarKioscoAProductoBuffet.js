import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '../../.env') })

const prisma = new PrismaClient()

async function migrarKioscoAProductoBuffet() {
  try {
    console.log('🔄 MIGRAR PRODUCTOS DE KIOSCO A ProductoBuffet\n')

    // 1. Buscar categoría de productos KIOSCO
    const categoriaProducto = await prisma.categoriaProducto.findFirst({
      where: { codigo: 'KIOSCO' }
    })

    if (!categoriaProducto) {
      console.log('❌ No se encontró la categoría KIOSCO')
      return
    }

    console.log(`✓ Categoría de producto encontrada: ${categoriaProducto.nombre}\n`)

    // 2. Buscar o crear categoría de menú KIOSCO
    let categoriaMenu = await prisma.categoriaMenu.findFirst({
      where: { codigo: 'KIOSCO' }
    })

    if (!categoriaMenu) {
      categoriaMenu = await prisma.categoriaMenu.create({
        data: {
          codigo: 'KIOSCO',
          nombre: 'Kiosco',
          descripcion: 'Productos de kiosco',
          color: '#10B981',
          orden: 999,
          activo: true
        }
      })
      console.log('✓ Categoría de menú KIOSCO creada\n')
    } else {
      console.log('✓ Categoría de menú KIOSCO encontrada\n')
    }

    // 3. Obtener todos los productos del kiosco
    const productosKiosco = await prisma.producto.findMany({
      where: {
        categoriaId: categoriaProducto.id
      },
      include: {
        variantes: true,
        productoBuffet: true
      }
    })

    console.log(`📦 ${productosKiosco.length} productos de kiosco encontrados\n`)

    // 4. Crear ProductoBuffet para cada uno
    let creados = 0
    let yaExisten = 0
    let errores = 0

    for (const producto of productosKiosco) {
      try {
        // Verificar si ya existe
        if (producto.productoBuffet) {
          console.log(`  ⊗ ${producto.nombre} - Ya existe en ProductoBuffet`)
          yaExisten++
          continue
        }

        // Crear ProductoBuffet
        await prisma.productoBuffet.create({
          data: {
            productoId: producto.id,
            categoriaMenuId: categoriaMenu.id,
            nombre: producto.nombre,
            descripcion: producto.descripcion,
            precio: producto.precioVenta || 0,
            codigoBarras: producto.codigo,
            tiposVenta: ['KIOSCO'],
            disponible: true,
            activo: producto.activo,
            orden: 0
          }
        })

        console.log(`  ✓ ${producto.nombre} - Creado en ProductoBuffet`)
        creados++

      } catch (error) {
        console.log(`  ❌ ${producto.nombre} - Error: ${error.message}`)
        errores++
      }
    }

    console.log('\n════════════════════════════════════════════════════════════')
    console.log('✅ MIGRACIÓN COMPLETADA')
    console.log('════════════════════════════════════════════════════════════')
    console.log(`✓ Productos creados en ProductoBuffet: ${creados}`)
    console.log(`⊗ Ya existían: ${yaExisten}`)
    console.log(`❌ Errores: ${errores}`)
    console.log(`📊 Total procesados: ${productosKiosco.length}`)
    console.log('════════════════════════════════════════════════════════════\n')

    // 5. Verificar
    const totalProductoBuffet = await prisma.productoBuffet.count({
      where: { tiposVenta: { has: 'KIOSCO' } }
    })

    console.log(`📊 Total productos con tipoVenta KIOSCO: ${totalProductoBuffet}\n`)

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

migrarKioscoAProductoBuffet()
