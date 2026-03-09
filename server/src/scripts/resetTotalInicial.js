/**
 * RESET TOTAL INICIAL - Club Sportivo Pilar
 *
 * Borra TODO el módulo buffet/kiosco + financiero y carga el menú inicial.
 * Basado en las imágenes del menú real.
 *
 * ⚠️  ADVERTENCIA: Este script borra TODOS los datos de:
 *     - Comandas, pedidos, items
 *     - Movimientos de caja y contables
 *     - Asientos contables
 *     - Comprobantes electrónicos (facturas)
 *     - Productos y categorías del menú
 *
 * Ejecutar: cd server && node src/scripts/resetTotalInicial.js
 */

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('🚀 RESET TOTAL INICIAL - Club Sportivo Pilar\n')

  // ============================================
  // BORRAR TODO EL MÓDULO BUFFET + KIOSCO (RESET COMPLETO)
  // ============================================
  console.log('🗑️  Borrando todo el módulo buffet y kiosco...')

  // 1. Opciones seleccionadas en items
  await prisma.opcionItemComanda.deleteMany({})
  await prisma.opcionItemTakeAway.deleteMany({})
  console.log('  ✓ Opciones de items borradas')

  // 2. Items de comandas y takeaway
  await prisma.itemComanda.deleteMany({})
  await prisma.itemPedidoTakeAway.deleteMany({})
  console.log('  ✓ Items borrados')

  // 3. Comandas y pedidos takeaway
  await prisma.comanda.deleteMany({})
  await prisma.pedidoTakeAway.deleteMany({})
  console.log('  ✓ Comandas y pedidos borrados')

  // 4. Asientos contables
  await prisma.asientoLinea.deleteMany({})
  await prisma.asiento.deleteMany({})
  console.log('  ✓ Asientos contables borrados')

  // 5. Movimientos de caja (TODOS)
  await prisma.movimientoCaja.deleteMany({})
  console.log('  ✓ Movimientos de caja borrados')

  // 6. Movimientos contables (TODOS)
  await prisma.itemMovimiento.deleteMany({})
  await prisma.movimientoContable.deleteMany({})
  console.log('  ✓ Movimientos contables borrados')

  // 7. Comprobantes electrónicos
  await prisma.comprobanteElectronico.deleteMany({})
  console.log('  ✓ Comprobantes electrónicos borrados')

  // 6. Configuración de opciones
  await prisma.opcionProducto.deleteMany({})
  await prisma.grupoOpcionProducto.deleteMany({})
  console.log('  ✓ Grupos y opciones borrados')

  // 7. Destinos de impresión
  await prisma.destinoImpresion.deleteMany({})
  console.log('  ✓ Destinos de impresión borrados')

  // 8. Productos
  await prisma.productoBuffet.deleteMany({})
  console.log('  ✓ Productos borrados')

  // 9. Categorías del menú
  await prisma.categoriaMenu.deleteMany({})
  console.log('  ✓ Categorías borradas')

  // 10. Mesas (resetear estado)
  await prisma.mesa.updateMany({
    data: { estado: 'LIBRE' }
  })
  console.log('  ✓ Mesas reseteadas')

  console.log('\n  ✅ Módulo buffet + kiosco reseteado completamente\n')

  // ============================================
  // CATEGORÍAS DEL MENÚ (con colores distintos)
  // ============================================
  const categorias = {
    cafeteria: await prisma.categoriaMenu.create({
      data: { codigo: 'CAFE', nombre: 'Cafetería', color: '#8B4513', orden: 1, activo: true }
    }),
    desayunos: await prisma.categoriaMenu.create({
      data: { codigo: 'DESAY', nombre: 'Desayunos y Meriendas', color: '#F59E0B', orden: 2, activo: true }
    }),
    comidas: await prisma.categoriaMenu.create({
      data: { codigo: 'COMIDAS', nombre: 'Comidas al Plato', color: '#EF4444', orden: 3, activo: true }
    }),
    minutas: await prisma.categoriaMenu.create({
      data: { codigo: 'MINUTAS', nombre: 'Minutas', color: '#F97316', orden: 4, activo: true }
    }),
    sandwiches: await prisma.categoriaMenu.create({
      data: { codigo: 'SANDW', nombre: 'Sándwiches', color: '#84CC16', orden: 5, activo: true }
    }),
    hamburguesas: await prisma.categoriaMenu.create({
      data: { codigo: 'HAMB', nombre: 'Hamburguesas', color: '#DC2626', orden: 6, activo: true }
    }),
    empanadas: await prisma.categoriaMenu.create({
      data: { codigo: 'EMP', nombre: 'Empanadas', color: '#CA8A04', orden: 7, activo: true }
    }),
    pizzas: await prisma.categoriaMenu.create({
      data: { codigo: 'PIZZA', nombre: 'Pizzas', color: '#EA580C', orden: 8, activo: true }
    }),
    ensaladas: await prisma.categoriaMenu.create({
      data: { codigo: 'ENSALADAS', nombre: 'Ensaladas', color: '#22C55E', orden: 9, activo: true }
    }),
    bebidas: await prisma.categoriaMenu.create({
      data: { codigo: 'BEBIDAS', nombre: 'Bebidas', color: '#3B82F6', orden: 10, activo: true }
    }),
    cervezas: await prisma.categoriaMenu.create({
      data: { codigo: 'CERVEZA', nombre: 'Cervezas', color: '#EAB308', orden: 11, activo: true }
    }),
    postres: await prisma.categoriaMenu.create({
      data: { codigo: 'POSTRES', nombre: 'Postres', color: '#EC4899', orden: 12, activo: true }
    }),
    huertas: await prisma.categoriaMenu.create({
      data: { codigo: 'HUERTAS', nombre: 'Huertas del Pilar', color: '#10B981', orden: 13, activo: true }
    })
  }
  console.log('✅ Categorías creadas')

  // Contador para códigos únicos
  let codigoCounter = Date.now() % 100000

  // Helper para crear productos (crea Producto + ProductoBuffet)
  async function crearProducto(nombre, precio, categoriaId, opciones = {}) {
    codigoCounter++
    const codigo = `BUFF${String(codigoCounter).padStart(5, '0')}`

    // Crear producto base (inventario)
    const producto = await prisma.producto.create({
      data: {
        codigo,
        nombre,
        descripcion: opciones.descripcion || null,
        precioVenta: precio,
        activo: true
      }
    })

    // Crear producto buffet
    return prisma.productoBuffet.create({
      data: {
        productoId: producto.id,
        categoriaMenuId: categoriaId,
        nombre,
        descripcion: opciones.descripcion || null,
        precio,
        tiposVenta: opciones.tiposVenta || ['BUFFET', 'TAKEAWAY'],
        disponible: true,
        activo: true
      }
    })
  }

  // Helper para crear grupo de opciones
  async function crearGrupo(productoBuffetId, nombre, opciones = {}) {
    return prisma.grupoOpcionProducto.create({
      data: {
        productoBuffetId,
        nombre,
        descripcion: opciones.descripcion || null,
        tipo: opciones.tipo || 'UNICA',
        obligatorio: opciones.obligatorio !== false,
        minSelecciones: opciones.minSelecciones || 1,
        maxSelecciones: opciones.maxSelecciones || 1,
        orden: opciones.orden || 1
      }
    })
  }

  // Helper para crear opción
  async function crearOpcion(grupoId, nombre, opciones = {}) {
    return prisma.opcionProducto.create({
      data: {
        grupoId,
        nombre,
        precioAdicional: opciones.precioAdicional || 0,
        productoRefId: opciones.productoRefId || null,
        seleccionadoPorDefecto: opciones.seleccionadoPorDefecto || false,
        orden: opciones.orden || 1
      }
    })
  }

  // ============================================
  // CAFETERÍA
  // ============================================
  console.log('\n☕ Creando Cafetería...')

  // Café con opción de tamaño
  const cafe = await crearProducto('Café', 4000, categorias.cafeteria.id)
  const grupoCafe = await crearGrupo(cafe.id, 'Tamaño')
  await crearOpcion(grupoCafe.id, 'Simple', { orden: 1 })
  await crearOpcion(grupoCafe.id, 'Doble', { precioAdicional: 1000, orden: 2 })

  // Brownie con opción de tamaño
  const brownie = await crearProducto('Brownie', 3000, categorias.cafeteria.id)
  const grupoBrownie = await crearGrupo(brownie.id, 'Tamaño')
  await crearOpcion(grupoBrownie.id, 'Chico', { orden: 1 })
  await crearOpcion(grupoBrownie.id, 'Grande', { precioAdicional: 2000, orden: 2 })

  // Resto de cafetería (sin opciones)
  await crearProducto('Mate Cocido', 2000, categorias.cafeteria.id)
  await crearProducto('Té', 2000, categorias.cafeteria.id)
  await crearProducto('Cortado', 3500, categorias.cafeteria.id)
  await crearProducto('Café con Leche', 4500, categorias.cafeteria.id)
  await crearProducto('Capuchino', 5000, categorias.cafeteria.id)
  await crearProducto('Chocolatada', 4000, categorias.cafeteria.id)
  await crearProducto('Cindor', 2500, categorias.cafeteria.id)
  await crearProducto('Yogurt', 3500, categorias.cafeteria.id)
  await crearProducto('Exprimido de Naranja', 5000, categorias.cafeteria.id)
  await crearProducto('Licuado', 5000, categorias.cafeteria.id)
  await crearProducto('Medialunas (unidad)', 1000, categorias.cafeteria.id)
  await crearProducto('Sándwich de Miga', 2800, categorias.cafeteria.id)
  await crearProducto('Pebete', 2500, categorias.cafeteria.id)
  console.log('  ✓ Cafetería creada')

  // ============================================
  // POSTRES
  // ============================================
  console.log('\n🍰 Creando Postres...')
  await crearProducto('Chocotorta', 6000, categorias.postres.id)
  await crearProducto('Alfajor de Maicena', 2200, categorias.postres.id)
  await crearProducto('Alfajor de Chocolate Artesanal', 2300, categorias.postres.id)
  await crearProducto('Ensalada de Frutas', 4000, categorias.postres.id)
  console.log('  ✓ Postres creados')

  // ============================================
  // DESAYUNOS Y MERIENDAS (con opción de infusión)
  // ============================================
  console.log('\n🥐 Creando Desayunos y Meriendas...')

  const infusiones = [
    { nombre: 'Café', adicional: 0 },
    { nombre: 'Cortado', adicional: 0 },
    { nombre: 'Café con Leche', adicional: 0 },
    { nombre: 'Té', adicional: 0 },
    { nombre: 'Mate Cocido', adicional: 0 },
    { nombre: 'Chocolatada', adicional: 500 },
    { nombre: 'Capuchino', adicional: 800 }
  ]

  const desayunos = [
    { nombre: 'Desayuno Tostadas', descripcion: '2 tostadas con mermelada y queso crema + infusión', precio: 10000 },
    { nombre: 'Desayuno Completo', descripcion: '1 tostada, huevo revuelto, palta y jugo de naranja + infusión', precio: 12000 },
    { nombre: 'Desayuno Yogurt', descripcion: 'Yogurt con granola y frutas de estación + infusión', precio: 11000 },
    { nombre: 'Desayuno Medialunas', descripcion: '2 medialunas + infusión', precio: 4500 }
  ]

  for (const desayuno of desayunos) {
    const prod = await crearProducto(desayuno.nombre, desayuno.precio, categorias.desayunos.id, { descripcion: desayuno.descripcion })
    const grupo = await crearGrupo(prod.id, 'Infusión')
    for (let i = 0; i < infusiones.length; i++) {
      await crearOpcion(grupo.id, infusiones[i].nombre, { precioAdicional: infusiones[i].adicional, orden: i + 1 })
    }
  }
  console.log('  ✓ Desayunos creados')

  // ============================================
  // EMPANADAS
  // ============================================
  console.log('\n🥟 Creando Empanadas...')

  const saboresEmpanadas = [
    'Carne', 'Pollo', 'Jamón y Queso', 'Humita', 'Verdura',
    'Carne Picante', 'Roquefort', 'Caprese'
  ]

  const empanadaProductos = []
  for (const sabor of saboresEmpanadas) {
    const prod = await crearProducto(`Empanada de ${sabor}`, 2500, categorias.empanadas.id)
    empanadaProductos.push(prod)
  }

  // Docena con opciones
  const docena = await crearProducto('Docena de Empanadas', 25000, categorias.empanadas.id, { descripcion: 'Elegí 12 empanadas' })
  const grupoDocena = await crearGrupo(docena.id, 'Sabores', { descripcion: 'Elegí 12 empanadas', tipo: 'MULTIPLE', minSelecciones: 12, maxSelecciones: 12 })
  for (let i = 0; i < empanadaProductos.length; i++) {
    const nombreCorto = empanadaProductos[i].nombre.replace('Empanada de ', '')
    await crearOpcion(grupoDocena.id, nombreCorto, { productoRefId: empanadaProductos[i].id, orden: i + 1 })
  }
  console.log('  ✓ Empanadas creadas')

  // ============================================
  // COMIDAS AL PLATO
  // ============================================
  console.log('\n🍽️ Creando Comidas al Plato...')
  await crearProducto('Tortilla de Papa', 10000, categorias.comidas.id)
  await crearProducto('Revuelto Gramajo', 9000, categorias.comidas.id)
  await crearProducto('Omelet con Ensalada', 9000, categorias.comidas.id)
  await crearProducto('Tarta', 5000, categorias.comidas.id)
  console.log('  ✓ Comidas al Plato creadas')

  // ============================================
  // MINUTAS (con guarnición)
  // ============================================
  console.log('\n🍖 Creando Minutas...')

  const guarniciones = [
    { nombre: 'Papas Fritas', adicional: 0 },
    { nombre: 'Puré', adicional: 0 },
    { nombre: 'Ensalada Mixta', adicional: 0 },
    { nombre: 'Papas Rústicas', adicional: 500 },
    { nombre: 'Papas con Cheddar', adicional: 1000 }
  ]

  const milanesas = [
    { nombre: 'Milanesa de Carne con Guarnición', precio: 12000 },
    { nombre: 'Milanesa de Pollo con Guarnición', precio: 11000 },
    { nombre: 'Milanesa Napolitana con Guarnición', precio: 14000 },
    { nombre: 'Suprema con Guarnición', precio: 12000 },
    { nombre: 'Suprema Napolitana con Guarnición', precio: 14000 }
  ]

  for (const mila of milanesas) {
    const prod = await crearProducto(mila.nombre, mila.precio, categorias.minutas.id, { tiposVenta: ['BUFFET', 'TAKEAWAY'] })
    const grupo = await crearGrupo(prod.id, 'Guarnición')
    for (let i = 0; i < guarniciones.length; i++) {
      await crearOpcion(grupo.id, guarniciones[i].nombre, { precioAdicional: guarniciones[i].adicional, orden: i + 1 })
    }
  }

  // Minutas sin guarnición
  await crearProducto('Cono de Papas Fritas', 3000, categorias.minutas.id)
  await crearProducto('Nuggets (8 unidades)', 5000, categorias.minutas.id)
  await crearProducto('Aros de Cebolla (12 unidades)', 6000, categorias.minutas.id)
  await crearProducto('Papas con Cheddar', 5000, categorias.minutas.id)
  console.log('  ✓ Minutas creadas')

  // ============================================
  // PIZZAS (con tamaño)
  // ============================================
  console.log('\n🍕 Creando Pizzas...')

  const pizzas = [
    { nombre: 'Pizza Muzzarella', precioMedia: 5000, precioEntera: 10000 },
    { nombre: 'Pizza Napolitana', precioMedia: 5500, precioEntera: 11000 },
    { nombre: 'Pizza Fugazzeta', precioMedia: 5500, precioEntera: 11000 },
    { nombre: 'Pizza Calabresa', precioMedia: 6000, precioEntera: 12000 },
    { nombre: 'Pizza Jamón y Morrones', precioMedia: 6000, precioEntera: 12000 },
    { nombre: 'Pizza Especial', precioMedia: 6500, precioEntera: 13000 }
  ]

  // Precio base = pizza entera, opción "Media" resta la diferencia
  for (const pizza of pizzas) {
    const prod = await crearProducto(pizza.nombre, pizza.precioEntera, categorias.pizzas.id, { tiposVenta: ['BUFFET', 'TAKEAWAY'] })
    const grupo = await crearGrupo(prod.id, 'Tamaño')
    await crearOpcion(grupo.id, 'Entera', { orden: 1 })
    await crearOpcion(grupo.id, 'Media', { precioAdicional: -(pizza.precioEntera - pizza.precioMedia), orden: 2 })
  }
  console.log('  ✓ Pizzas creadas')

  // ============================================
  // SÁNDWICHES
  // ============================================
  console.log('\n🥪 Creando Sándwiches...')
  await crearProducto('Sándwich de Jamón y Queso', 2400, categorias.sandwiches.id)
  await crearProducto('Sándwich de Salame y Queso', 2500, categorias.sandwiches.id)
  await crearProducto('Sándwich de Milanesa Simple', 7000, categorias.sandwiches.id)
  await crearProducto('Sándwich de Milanesa Completo', 8000, categorias.sandwiches.id)
  await crearProducto('Sándwich de Bondiola', 5000, categorias.sandwiches.id)
  await crearProducto('Sándwich de Matambre', 4000, categorias.sandwiches.id)
  await crearProducto('Choripan', 4500, categorias.sandwiches.id)
  await crearProducto('Pancho', 2000, categorias.sandwiches.id)
  await crearProducto('Tostado', 3000, categorias.sandwiches.id)
  console.log('  ✓ Sándwiches creados')

  // ============================================
  // HAMBURGUESAS
  // ============================================
  console.log('\n🍔 Creando Hamburguesas...')

  // Hamburguesas simples (sin opciones)
  await crearProducto('Hamburguesa Simple', 4500, categorias.hamburguesas.id)
  await crearProducto('Hamburguesa con Queso', 5500, categorias.hamburguesas.id)
  await crearProducto('Hamburguesa con Jamón y Queso', 6000, categorias.hamburguesas.id)

  // Hamburguesa Completa (con ingredientes que se pueden quitar)
  const hambCompleta = await crearProducto('Hamburguesa Completa', 6000, categorias.hamburguesas.id, { descripcion: 'Lechuga, tomate, cebolla, jamón, queso y huevo' })
  const grupoIngredientes = await crearGrupo(hambCompleta.id, 'Ingredientes', { descripcion: 'Desmarcá lo que no querés', tipo: 'MULTIPLE', obligatorio: false, minSelecciones: 0, maxSelecciones: 10 })
  const ingredientesHamb = [
    { nombre: 'Lechuga', porDefecto: true },
    { nombre: 'Tomate', porDefecto: true },
    { nombre: 'Cebolla', porDefecto: true },
    { nombre: 'Jamón', porDefecto: true },
    { nombre: 'Queso', porDefecto: true },
    { nombre: 'Huevo Frito', porDefecto: true },
    { nombre: 'Panceta', porDefecto: false, adicional: 1500 },
    { nombre: 'Cheddar', porDefecto: false, adicional: 1000 }
  ]
  for (let i = 0; i < ingredientesHamb.length; i++) {
    const ing = ingredientesHamb[i]
    await crearOpcion(grupoIngredientes.id, ing.nombre, { precioAdicional: ing.adicional || 0, seleccionadoPorDefecto: ing.porDefecto, orden: i + 1 })
  }
  console.log('  ✓ Hamburguesas creadas')

  // ============================================
  // ENSALADAS
  // ============================================
  console.log('\n🥗 Creando Ensaladas...')
  await crearProducto('Ensalada Mixta', 5000, categorias.ensaladas.id)
  await crearProducto('Ensalada Completa', 8000, categorias.ensaladas.id)
  await crearProducto('Ensalada César', 9000, categorias.ensaladas.id)
  console.log('  ✓ Ensaladas creadas')

  // ============================================
  // BEBIDAS
  // ============================================
  console.log('\n🥤 Creando Bebidas...')

  // Gaseosas - productos separados por tamaño
  const gaseosas = [
    { nombre: 'Coca Cola', precioChica: 2000, precioGrande: 4500 },
    { nombre: 'Sprite', precioChica: 2000, precioGrande: 4500 },
    { nombre: 'Fanta', precioChica: 2000, precioGrande: 4500 }
  ]
  for (const gaseosa of gaseosas) {
    await crearProducto(`${gaseosa.nombre} Chica`, gaseosa.precioChica, categorias.bebidas.id)
    await crearProducto(`${gaseosa.nombre} Grande`, gaseosa.precioGrande, categorias.bebidas.id)
  }

  // Aguas - productos separados por tamaño
  await crearProducto('Agua Villamanaos Chica', 1000, categorias.bebidas.id)
  await crearProducto('Agua Villamanaos Grande', 1500, categorias.bebidas.id)

  // Bebidas sin opciones
  await crearProducto('Cepita Grande', 3000, categorias.bebidas.id)
  await crearProducto('Cepita Chico', 1800, categorias.bebidas.id)
  await crearProducto('Aquarius', 2000, categorias.bebidas.id)
  await crearProducto('Placer 500ml', 1000, categorias.bebidas.id)
  await crearProducto('Placer 1.5L', 1500, categorias.bebidas.id)
  await crearProducto('Agua Villavicencio', 1400, categorias.bebidas.id)
  await crearProducto('Powerade', 2000, categorias.bebidas.id)
  console.log('  ✓ Bebidas creadas')

  // ============================================
  // CERVEZAS
  // ============================================
  console.log('\n🍺 Creando Cervezas...')
  await crearProducto('Brahma', 2800, categorias.cervezas.id)
  await crearProducto('Heineken', 3500, categorias.cervezas.id)
  await crearProducto('Andes Rubia', 3000, categorias.cervezas.id)
  await crearProducto('Andes IPA', 3200, categorias.cervezas.id)
  await crearProducto('Corona', 5000, categorias.cervezas.id)
  await crearProducto('Quilmes', 2500, categorias.cervezas.id)
  console.log('  ✓ Cervezas creadas')

  // ============================================
  // PRODUCTOS HUERTAS DEL PILAR
  // ============================================
  console.log('\n🥬 Creando Huertas del Pilar...')
  await crearProducto('Ensalada Huertas', 8000, categorias.huertas.id, { descripcion: 'Ensalada premium de Huertas del Pilar' })
  await crearProducto('Wrap Huertas', 7500, categorias.huertas.id)
  await crearProducto('Tarta Huertas', 7500, categorias.huertas.id)
  await crearProducto('Frutas Huertas', 4000, categorias.huertas.id)
  console.log('  ✓ Huertas del Pilar creados')

  // ============================================
  // RESUMEN
  // ============================================
  const totalProductos = await prisma.productoBuffet.count()
  const productosConOpciones = await prisma.productoBuffet.count({
    where: { gruposOpciones: { some: {} } }
  })

  console.log('\n' + '═'.repeat(60))
  console.log('✅ SEED COMPLETADO')
  console.log('═'.repeat(60))
  console.log(`📦 Total productos: ${totalProductos}`)
  console.log(`⚙️  Productos con opciones: ${productosConOpciones}`)
  console.log('═'.repeat(60))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
