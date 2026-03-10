import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function mantenerSoloProductosFactura() {
  try {
    console.log('🧹 MANTENER SOLO PRODUCTOS DE LA FACTURA\n')

    // Fecha de hoy (productos de la factura)
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    // ============================================
    // 1. IDENTIFICAR PRODUCTOS A MANTENER
    // ============================================
    console.log('📦 Identificando productos de la factura (creados hoy)...')

    const productosFactura = await prisma.producto.findMany({
      where: {
        productoBuffet: null,
        createdAt: {
          gte: hoy
        }
      }
    })

    console.log(`   ✓ ${productosFactura.length} productos de la factura identificados\n`)

    const idsAMantener = productosFactura.map(p => p.id)

    // ============================================
    // 2. IDENTIFICAR PRODUCTOS A BORRAR
    // ============================================
    console.log('🗑️  Identificando productos del kiosco a eliminar...')

    const productosABorrar = await prisma.producto.findMany({
      where: {
        productoBuffet: null,
        id: {
          notIn: idsAMantener
        }
      },
      include: {
        variantes: true
      }
    })

    console.log(`   ⚠️  ${productosABorrar.length} productos viejos del kiosco a borrar\n`)

    if (productosABorrar.length === 0) {
      console.log('✅ No hay productos viejos para eliminar\n')
      return
    }

    // ============================================
    // 3. BORRAR PRODUCTOS VIEJOS
    // ============================================
    console.log('🗑️  Borrando productos viejos...')

    let contador = 0
    for (const producto of productosABorrar) {
      // Borrar variantes primero
      await prisma.productoVariante.deleteMany({
        where: { productoId: producto.id }
      })

      // Borrar fotos si existen
      await prisma.productoFoto.deleteMany({
        where: { productoId: producto.id }
      })

      // Borrar el producto
      await prisma.producto.delete({
        where: { id: producto.id }
      })

      contador++

      if (contador % 20 === 0) {
        console.log(`   ... ${contador} productos borrados`)
      }
    }

    console.log(`   ✓ ${contador} productos viejos borrados\n`)

    // ============================================
    // 4. RESUMEN FINAL
    // ============================================
    const totalProductos = await prisma.producto.count()
    const totalBuffet = await prisma.producto.count({
      where: { productoBuffet: { isNot: null } }
    })
    const totalKiosco = await prisma.producto.count({
      where: { productoBuffet: null }
    })
    const totalVariantes = await prisma.productoVariante.count()

    console.log('════════════════════════════════════════════════════════════')
    console.log('✅ LIMPIEZA COMPLETADA')
    console.log('════════════════════════════════════════════════════════════')
    console.log(`🗑️  Productos eliminados: ${contador}`)
    console.log(`📊 Total productos: ${totalProductos}`)
    console.log(`🍽️  Productos Buffet: ${totalBuffet}`)
    console.log(`🏪 Productos Kiosco (factura): ${totalKiosco}`)
    console.log(`📦 Total variantes: ${totalVariantes}`)
    console.log('════════════════════════════════════════════════════════════\n')

    // Mostrar algunos ejemplos de productos mantenidos
    console.log('Ejemplos de productos del kiosco mantenidos:')
    const ejemplos = await prisma.producto.findMany({
      where: { productoBuffet: null },
      take: 5,
      include: { variantes: true }
    })
    ejemplos.forEach(p => {
      console.log(`  - ${p.nombre} (${p.codigo}) - Variantes: ${p.variantes.length}`)
    })
    console.log('')

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

mantenerSoloProductosFactura()
