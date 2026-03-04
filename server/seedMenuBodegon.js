/**
 * Script para poblar categorías vacías con platos típicos de bodegón argentino
 * Ejecutar con: node seedMenuBodegon.js
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Platos típicos de bodegón argentino por categoría
// Códigos de la base de producción: SAND, PIZZ, EMPA, MINU, ENSA, POST, CAFE, GOLO, PANI, HELA, COMB, DESA
const platosPorCategoria = {
  // Sandwiches y Hamburguesas (SAND)
  'SAND': [
    { nombre: 'Lomito Completo', precio: 5500, descripcion: 'Lomo, jamón, queso, huevo, lechuga y tomate' },
    { nombre: 'Milanesa al Pan', precio: 4500, descripcion: 'Milanesa con lechuga, tomate y mayonesa' },
    { nombre: 'Hamburguesa Completa', precio: 4000, descripcion: 'Hamburguesa con queso, lechuga, tomate y papas' },
    { nombre: 'Tostado J&Q', precio: 2500, descripcion: 'Jamón y queso tostado' },
    { nombre: 'Carlitos', precio: 3000, descripcion: 'Jamón y queso caliente' },
    { nombre: 'Super Pancho', precio: 2000, descripcion: 'Pancho con papas fritas' }
  ],
  // Pizzas (PIZZ)
  'PIZZ': [
    { nombre: 'Muzzarella', precio: 5500, descripcion: 'Pizza con muzzarella y aceitunas' },
    { nombre: 'Napolitana', precio: 6000, descripcion: 'Muzzarella, tomate y ajo' },
    { nombre: 'Fugazzeta', precio: 6500, descripcion: 'Doble masa con cebolla y queso' },
    { nombre: 'Calabresa', precio: 6500, descripcion: 'Con longaniza calabresa' },
    { nombre: 'Especial', precio: 7000, descripcion: 'Jamón, morrones y aceitunas' }
  ],
  // Empanadas (EMPA)
  'EMPA': [
    { nombre: 'Empanada de Carne', precio: 1200, descripcion: 'Empanada de carne cortada a cuchillo' },
    { nombre: 'Empanada J&Q', precio: 1200, descripcion: 'Empanada de jamón y queso' },
    { nombre: 'Empanada de Pollo', precio: 1200, descripcion: 'Empanada de pollo' },
    { nombre: 'Empanada Caprese', precio: 1200, descripcion: 'Tomate, albahaca y muzzarella' },
    { nombre: 'Docena de Empanadas', precio: 12000, descripcion: 'Docena de empanadas surtidas' }
  ],
  // Minutas (MINU)
  'MINU': [
    { nombre: 'Milanesa Napolitana', precio: 7500, descripcion: 'Milanesa con jamón, queso y salsa' },
    { nombre: 'Milanesa c/Papas', precio: 6500, descripcion: 'Milanesa con papas fritas' },
    { nombre: 'Milanesa a Caballo', precio: 7000, descripcion: 'Milanesa con dos huevos fritos' },
    { nombre: 'Suprema Maryland', precio: 8000, descripcion: 'Suprema con banana, durazno y papas' },
    { nombre: 'Papas Fritas', precio: 2500, descripcion: 'Porción de papas fritas' },
    { nombre: 'Papas con Cheddar', precio: 3500, descripcion: 'Papas fritas con cheddar y panceta' }
  ],
  // Ensaladas (ENSA)
  'ENSA': [
    { nombre: 'Ensalada Mixta', precio: 2500, descripcion: 'Lechuga, tomate y cebolla' },
    { nombre: 'Ensalada César', precio: 4500, descripcion: 'Lechuga, pollo, parmesano y croutons' },
    { nombre: 'Ensalada Completa', precio: 4000, descripcion: 'Lechuga, tomate, huevo, zanahoria y choclo' }
  ],
  // Postres (POST)
  'POST': [
    { nombre: 'Flan Casero', precio: 3000, descripcion: 'Flan con dulce de leche y crema' },
    { nombre: 'Panqueques c/DDL', precio: 3500, descripcion: 'Dos panqueques con dulce de leche' },
    { nombre: 'Vigilante', precio: 3000, descripcion: 'Queso y dulce de batata' },
    { nombre: 'Ensalada de Frutas', precio: 2500, descripcion: 'Frutas de estación con crema' },
    { nombre: 'Brownie c/Helado', precio: 4000, descripcion: 'Brownie de chocolate con helado' }
  ],
  // Cafetería (CAFE)
  'CAFE': [
    { nombre: 'Café', precio: 1200, descripcion: 'Café express' },
    { nombre: 'Café con Leche', precio: 1500, descripcion: 'Café con leche' },
    { nombre: 'Cortado', precio: 1300, descripcion: 'Café cortado' },
    { nombre: 'Submarino', precio: 2000, descripcion: 'Chocolate en leche caliente' },
    { nombre: 'Té', precio: 1200, descripcion: 'Té con limón o leche' },
    { nombre: 'Capuccino', precio: 2000, descripcion: 'Capuccino con espuma' }
  ],
  // Golosinas y Snacks (GOLO)
  'GOLO': [
    { nombre: 'Alfajor', precio: 800, descripcion: 'Alfajor de chocolate' },
    { nombre: 'Barrita de Cereal', precio: 700, descripcion: 'Barrita de cereal' },
    { nombre: 'Papas Chips', precio: 1500, descripcion: 'Bolsa de papas chips' },
    { nombre: 'Maní', precio: 1000, descripcion: 'Maní salado' }
  ],
  // Panificados (PANI)
  'PANI': [
    { nombre: 'Medialuna', precio: 800, descripcion: 'Medialuna de manteca' },
    { nombre: 'Facturas (x3)', precio: 2000, descripcion: 'Tres facturas surtidas' },
    { nombre: 'Tostadas c/Manteca', precio: 1500, descripcion: 'Tostadas con manteca y mermelada' },
    { nombre: 'Budín', precio: 1200, descripcion: 'Porción de budín casero' }
  ],
  // Helados (HELA)
  'HELA': [
    { nombre: 'Helado 1/4 kg', precio: 3500, descripcion: 'Helado artesanal 1/4 kg' },
    { nombre: 'Helado 1/2 kg', precio: 6000, descripcion: 'Helado artesanal 1/2 kg' },
    { nombre: 'Cucurucho', precio: 2500, descripcion: 'Cucurucho 2 bochas' },
    { nombre: 'Vasito', precio: 2000, descripcion: 'Vasito 2 bochas' }
  ],
  // Combos/Promos (COMB)
  'COMB': [
    { nombre: 'Combo Hamburguesa', precio: 5500, descripcion: 'Hamburguesa + papas + gaseosa' },
    { nombre: 'Combo Milanesa', precio: 7500, descripcion: 'Milanesa + papas + gaseosa' },
    { nombre: 'Combo Familiar', precio: 15000, descripcion: 'Pizza grande + empanadas (6) + gaseosa 1.5L' },
    { nombre: 'Promo Merienda', precio: 3500, descripcion: 'Café + medialuna + jugo' }
  ],
  // Desayuno/Merienda (DESA)
  'DESA': [
    { nombre: 'Desayuno Simple', precio: 3000, descripcion: 'Café o té + tostadas con manteca y mermelada' },
    { nombre: 'Desayuno Completo', precio: 4500, descripcion: 'Café + jugo + tostadas + medialunas' },
    { nombre: 'Merienda Dulce', precio: 3500, descripcion: 'Café con leche + facturas (2)' },
    { nombre: 'Tostado + Café', precio: 3500, descripcion: 'Tostado de jamón y queso + café' }
  ]
}

async function main() {
  console.log('Buscando categorías vacías...\n')

  // Obtener todas las categorías activas
  const categorias = await prisma.categoriaMenu.findMany({
    where: { activo: true },
    include: {
      productos: {
        where: { activo: true }
      }
    },
    orderBy: { orden: 'asc' }
  })

  // Contador para generar códigos únicos
  let codigoCounter = Date.now() % 10000 // Usar timestamp para unicidad

  let productosCreados = 0

  for (const categoria of categorias) {
    const tieneProductos = categoria.productos.length > 0
    console.log(`${tieneProductos ? '✓' : '✗'} ${categoria.nombre} (${categoria.codigo}): ${categoria.productos.length} productos`)

    if (!tieneProductos) {
      // Buscar platos para esta categoría
      const platos = platosPorCategoria[categoria.codigo]

      if (platos) {
        console.log(`  → Agregando ${platos.length} platos de bodegón...`)

        for (const plato of platos) {
          // Generar código único: primeras 3 letras de categoría + contador
          codigoCounter++
          const codigo = `${categoria.codigo}${String(codigoCounter).padStart(4, '0')}`

          // Crear producto base
          const producto = await prisma.producto.create({
            data: {
              codigo: codigo,
              nombre: plato.nombre,
              descripcion: plato.descripcion,
              precioVenta: plato.precio,
              activo: true
            }
          })

          // Crear producto buffet
          await prisma.productoBuffet.create({
            data: {
              productoId: producto.id,
              categoriaMenuId: categoria.id,
              nombre: plato.nombre,
              descripcion: plato.descripcion,
              precio: plato.precio,
              disponible: true,
              activo: true,
              tiposVenta: ['BUFFET', 'TAKEAWAY']
            }
          })

          console.log(`    + ${plato.nombre} - $${plato.precio}`)
          productosCreados++
        }
      } else {
        console.log(`  → No hay platos definidos para esta categoría`)
      }
    }
  }

  console.log(`\n✅ Proceso completado. ${productosCreados} productos creados.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
