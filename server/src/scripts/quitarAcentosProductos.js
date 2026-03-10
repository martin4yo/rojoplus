/**
 * Script para quitar acentos de los nombres de productos del buffet
 * Uso: DATABASE_URL="postgresql://..." node server/src/scripts/quitarAcentosProductos.js
 */
import prisma from '../lib/prisma.js'

/**
 * Quita los acentos de un texto
 */
function quitarAcentos(texto) {
  if (!texto) return texto

  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

async function main() {
  try {
    console.log('🔍 Obteniendo productos...')

    const productos = await prisma.productoBuffet.findMany({
      select: {
        id: true,
        nombre: true
      }
    })

    console.log(`📦 Encontrados ${productos.length} productos`)

    const productosConAcentos = productos.filter(p => {
      const sinAcentos = quitarAcentos(p.nombre)
      return p.nombre !== sinAcentos
    })

    console.log(`✏️  ${productosConAcentos.length} productos tienen acentos`)

    if (productosConAcentos.length === 0) {
      console.log('✅ No hay productos con acentos para actualizar')
      return
    }

    console.log('\n📝 Cambios a realizar:')
    productosConAcentos.forEach(p => {
      console.log(`   ${p.nombre} → ${quitarAcentos(p.nombre)}`)
    })

    console.log('\n🔄 Actualizando productos...')

    let actualizados = 0
    for (const producto of productosConAcentos) {
      const nuevoNombre = quitarAcentos(producto.nombre)

      await prisma.productoBuffet.update({
        where: { id: producto.id },
        data: { nombre: nuevoNombre }
      })

      console.log(`   ✓ ${producto.nombre} → ${nuevoNombre}`)
      actualizados++
    }

    console.log(`\n✅ ${actualizados} productos actualizados correctamente`)

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
