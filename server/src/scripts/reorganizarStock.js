import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function reorganizarStock() {
  try {
    console.log('🔧 REORGANIZAR MÓDULO DE STOCK\n')

    // ============================================
    // 1. BORRAR MOVIMIENTOS DE STOCK
    // ============================================
    console.log('🗑️  Borrando movimientos de stock...')
    const movimientos = await prisma.movimientoStock.deleteMany({})
    console.log(`   ✓ ${movimientos.count} movimientos borrados\n`)

    // ============================================
    // 2. BORRAR CATEGORÍAS EXISTENTES
    // ============================================
    console.log('🗑️  Borrando categorías existentes...')
    await prisma.categoriaProducto.deleteMany({})
    console.log('   ✓ Categorías borradas\n')

    // ============================================
    // 3. CREAR NUEVAS CATEGORÍAS
    // ============================================
    console.log('📦 Creando nuevas categorías...')

    const catMerchandising = await prisma.categoriaProducto.create({
      data: {
        codigo: 'MERCHANDISING',
        nombre: 'Merchandising',
        activo: true
      }
    })
    console.log('   ✓ Merchandising creada')

    const catBuffet = await prisma.categoriaProducto.create({
      data: {
        codigo: 'BUFFET',
        nombre: 'Buffet',
        activo: true
      }
    })
    console.log('   ✓ Buffet creada')

    const catKiosco = await prisma.categoriaProducto.create({
      data: {
        codigo: 'KIOSCO',
        nombre: 'Kiosco',
        activo: true
      }
    })
    console.log('   ✓ Kiosco creada\n')

    // ============================================
    // 4. ASIGNAR PRODUCTOS DEL BUFFET
    // ============================================
    console.log('🍽️  Asignando productos del Buffet...')

    // Obtener todos los productos que tienen ProductoBuffet
    const productosBuffet = await prisma.producto.findMany({
      where: {
        productoBuffet: {
          isNot: null
        }
      },
      select: { id: true, nombre: true }
    })

    let contadorBuffet = 0
    for (const producto of productosBuffet) {
      await prisma.producto.update({
        where: { id: producto.id },
        data: { categoriaId: catBuffet.id }
      })
      contadorBuffet++
    }
    console.log(`   ✓ ${contadorBuffet} productos asignados a Buffet\n`)

    // ============================================
    // 5. ASIGNAR PRODUCTOS DEL KIOSCO
    // ============================================
    console.log('🏪 Asignando productos del Kiosco...')

    // Obtener todos los productos que NO tienen ProductoBuffet
    const productosKiosco = await prisma.producto.findMany({
      where: {
        productoBuffet: null
      },
      select: { id: true, nombre: true }
    })

    let contadorKiosco = 0
    for (const producto of productosKiosco) {
      await prisma.producto.update({
        where: { id: producto.id },
        data: { categoriaId: catKiosco.id }
      })
      contadorKiosco++
    }
    console.log(`   ✓ ${contadorKiosco} productos asignados a Kiosco\n`)

    // ============================================
    // 6. RESETEAR STOCK DE TODOS LOS PRODUCTOS
    // ============================================
    console.log('📊 Reseteando stock de variantes...')
    const variantes = await prisma.productoVariante.updateMany({
      data: { stockActual: 0 }
    })
    console.log(`   ✓ ${variantes.count} variantes reseteadas\n`)

    // ============================================
    // 7. REPORTAR PRODUCTOS SIN VARIANTES
    // ============================================
    console.log('🔍 Verificando productos sin variantes...')
    const productosSinVariantes = await prisma.producto.findMany({
      where: {
        variantes: {
          none: {}
        }
      },
      include: {
        categoria: true,
        productoBuffet: true
      }
    })

    if (productosSinVariantes.length > 0) {
      console.log(`\n⚠️  ${productosSinVariantes.length} productos sin variantes encontrados:`)
      productosSinVariantes.forEach(p => {
        const tipo = p.productoBuffet ? 'BUFFET' : 'KIOSCO'
        console.log(`   - ${p.nombre} (${p.codigo}) [${tipo}]`)
      })
    } else {
      console.log('   ✓ Todos los productos tienen variantes')
    }

    // ============================================
    // 8. RESUMEN FINAL
    // ============================================
    const totalProductos = await prisma.producto.count()
    const totalVariantes = await prisma.productoVariante.count()

    console.log('\n════════════════════════════════════════════════════════════')
    console.log('✅ REORGANIZACIÓN COMPLETADA')
    console.log('════════════════════════════════════════════════════════════')
    console.log(`📦 Categorías creadas: 3`)
    console.log(`🍽️  Productos Buffet: ${contadorBuffet}`)
    console.log(`🏪 Productos Kiosco: ${contadorKiosco}`)
    console.log(`📊 Total productos: ${totalProductos}`)
    console.log(`📊 Total variantes: ${totalVariantes}`)
    console.log(`🗑️  Movimientos borrados: ${movimientos.count}`)
    console.log('════════════════════════════════════════════════════════════\n')

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

reorganizarStock()
