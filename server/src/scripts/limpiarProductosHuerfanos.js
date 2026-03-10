import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function limpiarProductosHuerfanos() {
  try {
    console.log('🧹 LIMPIAR PRODUCTOS HUÉRFANOS\n')

    // ============================================
    // 1. IDENTIFICAR PRODUCTOS SIN VARIANTES
    // ============================================
    console.log('🔍 Identificando productos sin variantes...')

    const productosSinVariantes = await prisma.producto.findMany({
      where: {
        variantes: {
          none: {}
        },
        productoBuffet: null // No son del buffet actual
      },
      include: {
        categoria: true
      }
    })

    console.log(`   ⚠️  ${productosSinVariantes.length} productos huérfanos encontrados\n`)

    if (productosSinVariantes.length === 0) {
      console.log('✅ No hay productos huérfanos para limpiar\n')
      return
    }

    // ============================================
    // 2. BORRAR PRODUCTOS HUÉRFANOS
    // ============================================
    console.log('🗑️  Borrando productos huérfanos...')

    let contador = 0
    for (const producto of productosSinVariantes) {
      // Primero borrar fotos si existen
      await prisma.productoFoto.deleteMany({
        where: { productoId: producto.id }
      })

      // Luego borrar el producto
      await prisma.producto.delete({
        where: { id: producto.id }
      })
      contador++

      if (contador % 50 === 0) {
        console.log(`   ... ${contador} productos borrados`)
      }
    }

    console.log(`   ✓ ${contador} productos huérfanos borrados\n`)

    // ============================================
    // 3. RESUMEN FINAL
    // ============================================
    const totalProductos = await prisma.producto.count()
    const totalBuffet = await prisma.producto.count({
      where: {
        productoBuffet: { isNot: null }
      }
    })
    const totalKiosco = await prisma.producto.count({
      where: {
        productoBuffet: null
      }
    })
    const totalVariantes = await prisma.productoVariante.count()

    console.log('════════════════════════════════════════════════════════════')
    console.log('✅ LIMPIEZA COMPLETADA')
    console.log('════════════════════════════════════════════════════════════')
    console.log(`🗑️  Productos eliminados: ${contador}`)
    console.log(`📊 Total productos: ${totalProductos}`)
    console.log(`🍽️  Productos Buffet: ${totalBuffet}`)
    console.log(`🏪 Productos Kiosco: ${totalKiosco}`)
    console.log(`📦 Total variantes: ${totalVariantes}`)
    console.log('════════════════════════════════════════════════════════════\n')

    // Verificar que no queden productos sin variantes
    const verificacion = await prisma.producto.findMany({
      where: {
        variantes: { none: {} }
      }
    })

    if (verificacion.length > 0) {
      console.log(`⚠️  Aún quedan ${verificacion.length} productos sin variantes:`)
      verificacion.forEach(p => {
        console.log(`   - ${p.nombre} (${p.codigo})`)
      })
    } else {
      console.log('✅ Todos los productos tienen variantes\n')
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

limpiarProductosHuerfanos()
