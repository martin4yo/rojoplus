/**
 * Artículos de prueba para el tenant "sanandres":
 *   - Merchandising para vender por la tienda online (Producto + variantes
 *     talle/color con stock, publicarEnTienda = true)
 *   - Productos de buffet y de kiosco (Producto + ProductoBuffet, con su
 *     categoría de menú y su variante UNICA para que lleven stock)
 *
 * Sigue las convenciones del tenant de referencia: las variantes de artículos
 * que no tienen talle usan talle/color "UNICA" y sku "<codigo>-UNICA".
 *
 * Idempotente: saltea todo producto cuyo código ya exista en el tenant.
 *
 * Uso:
 *   node scripts/seedArticulosSanAndres.js            # dry-run
 *   node scripts/seedArticulosSanAndres.js --apply
 *   DATABASE_URL="postgresql://...:5436/..." node scripts/seedArticulosSanAndres.js --apply
 */
import { PrismaClient } from '@prisma/client'
import 'dotenv/config'

const prisma = new PrismaClient()
const SUBDOMAIN = 'sanandres'
const APPLY = process.argv.includes('--apply')

const CATEGORIAS_PRODUCTO = [
  { codigo: 'MERCH', nombre: 'Merchandising' },
  { codigo: 'BUFFET', nombre: 'Buffet' },
  { codigo: 'KIOSCO', nombre: 'Kiosco' },
]

const CATEGORIAS_MENU = [
  { codigo: 'CAFE', nombre: 'Cafetería', color: '#8B5E3C', orden: 1 },
  { codigo: 'SANDW', nombre: 'Sándwiches', color: '#D97706', orden: 2 },
  { codigo: 'HAMB', nombre: 'Hamburguesas', color: '#B45309', orden: 3 },
  { codigo: 'PIZZA', nombre: 'Pizzas y Empanadas', color: '#DC2626', orden: 4 },
  { codigo: 'BEBIDAS', nombre: 'Bebidas', color: '#0EA5E9', orden: 5 },
  { codigo: 'POSTRES', nombre: 'Postres', color: '#DB2777', orden: 6 },
  { codigo: 'KIOSCO', nombre: 'Kiosco', color: '#65A30D', orden: 7 },
]

// ── Merchandising (tienda online) ────────────────────────────────────
// talles: lista de { talle, color?, stock }
const TALLES_ROPA = ['S', 'M', 'L', 'XL', 'XXL']
const TALLES_HOCKEY = ['XS', 'S', 'M', 'L', 'XL']

const MERCHANDISING = [
  {
    codigo: 'MERCH-001', nombre: 'Camiseta oficial de rugby', precioCompra: 28000, precioVenta: 72000,
    descripcionTienda: 'Camiseta titular de juego, tela piqué reforzada, escudo bordado. Modelo 2026.',
    destacado: true,
    variantes: TALLES_ROPA.map(t => ({ talle: t, color: 'Azul', stock: 12 })),
  },
  {
    codigo: 'MERCH-002', nombre: 'Camiseta oficial de hockey', precioCompra: 26000, precioVenta: 68000,
    descripcionTienda: 'Camiseta de juego de hockey, tela deportiva liviana con secado rápido.',
    destacado: true,
    variantes: TALLES_HOCKEY.map(t => ({ talle: t, color: 'Azul', stock: 10 })),
  },
  {
    codigo: 'MERCH-003', nombre: 'Buzo con capucha del club', precioCompra: 34000, precioVenta: 89000,
    descripcionTienda: 'Buzo frisado con capucha y bolsillo canguro, escudo estampado en el pecho.',
    variantes: [
      ...TALLES_ROPA.map(t => ({ talle: t, color: 'Azul', stock: 8 })),
      ...TALLES_ROPA.map(t => ({ talle: t, color: 'Gris', stock: 6 })),
    ],
  },
  {
    codigo: 'MERCH-004', nombre: 'Short de rugby', precioCompra: 14000, precioVenta: 38000,
    descripcionTienda: 'Short de juego con cordón interno, tela resistente al agarre.',
    variantes: TALLES_ROPA.map(t => ({ talle: t, color: 'Azul', stock: 15 })),
  },
  {
    codigo: 'MERCH-005', nombre: 'Medias de juego', precioCompra: 6000, precioVenta: 16000,
    descripcionTienda: 'Medias largas de juego con puño elastizado.',
    variantes: [
      { talle: '34-38', color: 'Azul', stock: 20 },
      { talle: '39-43', color: 'Azul', stock: 20 },
      { talle: '44-47', color: 'Azul', stock: 10 },
    ],
  },
  {
    codigo: 'MERCH-006', nombre: 'Gorra del club', precioCompra: 7500, precioVenta: 21000,
    descripcionTienda: 'Gorra de gabardina con escudo bordado y cierre regulable.',
    variantes: [{ talle: 'UNICA', color: 'Azul', stock: 30 }],
  },
  {
    codigo: 'MERCH-007', nombre: 'Bufanda tartán', precioCompra: 9000, precioVenta: 26000,
    descripcionTienda: 'Bufanda tejida con el tartán del club, guiño a la herencia escocesa.',
    destacado: true, precioOferta: 19900,
    variantes: [{ talle: 'UNICA', color: 'Azul', stock: 25 }],
  },
  {
    codigo: 'MERCH-008', nombre: 'Botella térmica 750ml', precioCompra: 12000, precioVenta: 32000,
    descripcionTienda: 'Botella de acero inoxidable, mantiene frío 12 horas. Escudo grabado.',
    variantes: [
      { talle: 'UNICA', color: 'Azul', stock: 18 },
      { talle: 'UNICA', color: 'Blanco', stock: 12 },
    ],
  },
  {
    codigo: 'MERCH-009', nombre: 'Mochila deportiva', precioCompra: 22000, precioVenta: 58000,
    descripcionTienda: 'Mochila con compartimento para botines y bolsillo para notebook.',
    variantes: [{ talle: 'UNICA', color: 'Azul', stock: 14 }],
  },
  {
    codigo: 'MERCH-010', nombre: 'Pelota de rugby n°5', precioCompra: 18000, precioVenta: 45000,
    descripcionTienda: 'Pelota de match tamaño 5, laminada, con el escudo del club.',
    precioOferta: 37900,
    variantes: [{ talle: 'UNICA', color: 'Azul', stock: 16 }],
  },
]

// ── Buffet y kiosco ──────────────────────────────────────────────────
// tiposVenta: BUFFET (mesas) / TAKEAWAY / KIOSCO
const BUFFET = [
  { codigo: 'BUF-001', nombre: 'Café', categoria: 'CAFE', precio: 2500, costo: 700, tipos: ['BUFFET', 'TAKEAWAY'], menu: true, descripcion: 'Café expreso' },
  { codigo: 'BUF-002', nombre: 'Café con leche', categoria: 'CAFE', precio: 3200, costo: 1000, tipos: ['BUFFET', 'TAKEAWAY'], menu: true },
  { codigo: 'BUF-003', nombre: 'Submarino', categoria: 'CAFE', precio: 3800, costo: 1200, tipos: ['BUFFET', 'TAKEAWAY'], menu: true },
  { codigo: 'BUF-004', nombre: 'Medialuna', categoria: 'CAFE', precio: 1500, costo: 500, tipos: ['BUFFET', 'TAKEAWAY'], menu: true },

  { codigo: 'BUF-010', nombre: 'Sándwich de milanesa', categoria: 'SANDW', precio: 9500, costo: 3800, tipos: ['BUFFET', 'TAKEAWAY'], menu: true, destacado: true, descripcion: 'Con lechuga, tomate y mayonesa' },
  { codigo: 'BUF-011', nombre: 'Sándwich de lomo', categoria: 'SANDW', precio: 11500, costo: 4800, tipos: ['BUFFET', 'TAKEAWAY'], menu: true },
  { codigo: 'BUF-012', nombre: 'Tostado de jamón y queso', categoria: 'SANDW', precio: 5500, costo: 1900, tipos: ['BUFFET', 'TAKEAWAY'], menu: true },

  { codigo: 'BUF-020', nombre: 'Hamburguesa simple', categoria: 'HAMB', precio: 8500, costo: 3200, tipos: ['BUFFET', 'TAKEAWAY'], menu: true },
  { codigo: 'BUF-021', nombre: 'Hamburguesa completa', categoria: 'HAMB', precio: 10500, costo: 4200, tipos: ['BUFFET', 'TAKEAWAY'], menu: true, destacado: true, descripcion: 'Doble carne, cheddar, panceta, lechuga y tomate' },
  { codigo: 'BUF-022', nombre: 'Papas fritas', categoria: 'HAMB', precio: 6000, costo: 2000, tipos: ['BUFFET', 'TAKEAWAY'], menu: true },

  { codigo: 'BUF-030', nombre: 'Pizza muzzarella', categoria: 'PIZZA', precio: 13500, costo: 5000, tipos: ['BUFFET', 'TAKEAWAY'], menu: true },
  { codigo: 'BUF-031', nombre: 'Pizza especial', categoria: 'PIZZA', precio: 16500, costo: 6500, tipos: ['BUFFET', 'TAKEAWAY'], menu: true },
  { codigo: 'BUF-032', nombre: 'Empanada de carne', categoria: 'PIZZA', precio: 2200, costo: 800, tipos: ['BUFFET', 'TAKEAWAY'], menu: true },
  { codigo: 'BUF-033', nombre: 'Empanada de jamón y queso', categoria: 'PIZZA', precio: 2200, costo: 800, tipos: ['BUFFET', 'TAKEAWAY'], menu: true },

  { codigo: 'BUF-040', nombre: 'Gaseosa línea Coca-Cola 500ml', categoria: 'BEBIDAS', precio: 3500, costo: 1400, tipos: ['BUFFET', 'TAKEAWAY', 'KIOSCO'], menu: true },
  { codigo: 'BUF-041', nombre: 'Agua mineral 500ml', categoria: 'BEBIDAS', precio: 2500, costo: 900, tipos: ['BUFFET', 'TAKEAWAY', 'KIOSCO'], menu: true },
  { codigo: 'BUF-042', nombre: 'Cerveza tirada pinta', categoria: 'BEBIDAS', precio: 6500, costo: 2400, tipos: ['BUFFET'], menu: true, destacado: true },
  { codigo: 'BUF-043', nombre: 'Cerveza en lata 473ml', categoria: 'BEBIDAS', precio: 5500, costo: 2200, tipos: ['BUFFET', 'TAKEAWAY', 'KIOSCO'], menu: true },

  { codigo: 'BUF-050', nombre: 'Brownie con nuez', categoria: 'POSTRES', precio: 4200, costo: 1500, tipos: ['BUFFET', 'TAKEAWAY'], menu: true },
  { codigo: 'BUF-051', nombre: 'Helado (bocha)', categoria: 'POSTRES', precio: 3500, costo: 1200, tipos: ['BUFFET', 'TAKEAWAY'], menu: true },
]

const KIOSCO = [
  { codigo: 'KIO-001', nombre: 'Alfajor de chocolate', categoria: 'KIOSCO', precio: 2000, costo: 800, tipos: ['KIOSCO'], menu: false },
  { codigo: 'KIO-002', nombre: 'Alfajor de dulce de leche', categoria: 'KIOSCO', precio: 2000, costo: 800, tipos: ['KIOSCO'], menu: false },
  { codigo: 'KIO-003', nombre: 'Barra de cereal', categoria: 'KIOSCO', precio: 1500, costo: 600, tipos: ['KIOSCO'], menu: false },
  { codigo: 'KIO-004', nombre: 'Chocolate con leche 40g', categoria: 'KIOSCO', precio: 2800, costo: 1100, tipos: ['KIOSCO'], menu: false },
  { codigo: 'KIO-005', nombre: 'Papas fritas snack 65g', categoria: 'KIOSCO', precio: 3000, costo: 1200, tipos: ['KIOSCO'], menu: false },
  { codigo: 'KIO-006', nombre: 'Chicles', categoria: 'KIOSCO', precio: 1200, costo: 450, tipos: ['KIOSCO'], menu: false },
  { codigo: 'KIO-007', nombre: 'Turrón', categoria: 'KIOSCO', precio: 1300, costo: 500, tipos: ['KIOSCO'], menu: false },
  { codigo: 'KIO-008', nombre: 'Galletitas dulces', categoria: 'KIOSCO', precio: 2600, costo: 1000, tipos: ['KIOSCO'], menu: false },
]

async function main() {
  const [{ d: db, port }] = await prisma.$queryRaw`select current_database() as d, inet_server_port() as port`
  const tenant = await prisma.tenant.findUnique({ where: { subdomain: SUBDOMAIN } })
  if (!tenant) {
    console.error(`❌ No existe el tenant "${SUBDOMAIN}" en ${db} (server port ${port})`)
    process.exitCode = 1
    return
  }
  const tenantId = tenant.id
  console.log(`Base   : ${db} (server port ${port})`)
  console.log(`Tenant : id=${tenantId} ${tenant.nombre}`)

  const yaProductos = await prisma.producto.count({ where: { tenantId } })
  const totalNuevos = MERCHANDISING.length + BUFFET.length + KIOSCO.length
  const totalVariantes = MERCHANDISING.reduce((s, m) => s + m.variantes.length, 0) + BUFFET.length + KIOSCO.length
  console.log(`Productos existentes: ${yaProductos}`)
  console.log(`A crear: ${CATEGORIAS_PRODUCTO.length} categorías de producto, ${CATEGORIAS_MENU.length} categorías de menú,`)
  console.log(`         ${MERCHANDISING.length} de merchandising, ${BUFFET.length} de buffet, ${KIOSCO.length} de kiosco (${totalVariantes} variantes)`)

  if (!APPLY) {
    console.log('\n(dry-run) Volvé a ejecutar con --apply para escribir.')
    return
  }

  // ── Categorías ─────────────────────────────────────────────────────
  const catProd = {}
  for (const c of CATEGORIAS_PRODUCTO) {
    const existente = await prisma.categoriaProducto.findUnique({ where: { tenantId_codigo: { tenantId, codigo: c.codigo } } })
    catProd[c.codigo] = existente ?? await prisma.categoriaProducto.create({ data: { ...c, tenantId, activo: true } })
  }
  console.log(`✓ Categorías de producto: ${Object.keys(catProd).join(', ')}`)

  const catMenu = {}
  for (const c of CATEGORIAS_MENU) {
    const existente = await prisma.categoriaMenu.findUnique({ where: { tenantId_codigo: { tenantId, codigo: c.codigo } } })
    catMenu[c.codigo] = existente ?? await prisma.categoriaMenu.create({ data: { ...c, tenantId, activo: true } })
  }
  console.log(`✓ Categorías de menú: ${Object.keys(catMenu).join(', ')}`)

  // ── Merchandising ──────────────────────────────────────────────────
  let merchCreados = 0, merchSalteados = 0, variantesCreadas = 0
  for (const m of MERCHANDISING) {
    const existente = await prisma.producto.findUnique({ where: { tenantId_codigo: { tenantId, codigo: m.codigo } } })
    if (existente) { merchSalteados++; continue }
    const producto = await prisma.producto.create({
      data: {
        tenantId,
        codigo: m.codigo,
        nombre: m.nombre,
        descripcion: m.descripcionTienda,
        categoriaId: catProd.MERCH.id,
        precioCompra: m.precioCompra,
        precioVenta: m.precioVenta,
        activo: true,
        aparecerEnCompras: true,
        publicarEnTienda: true,
        destacadoTienda: !!m.destacado,
        precioOfertaTienda: m.precioOferta ?? null,
        descripcionTienda: m.descripcionTienda,
      },
    })
    for (const v of m.variantes) {
      const sufijo = [v.talle, v.color].filter(Boolean).join('-').toUpperCase()
      await prisma.productoVariante.create({
        data: {
          tenantId,
          productoId: producto.id,
          talle: v.talle,
          color: v.color ?? null,
          sku: `${m.codigo}-${sufijo}`,
          stockActual: v.stock,
          stockMinimo: 2,
          precioCosto: m.precioCompra,
          precioVenta: m.precioVenta,
          activo: true,
        },
      })
      variantesCreadas++
    }
    merchCreados++
  }
  console.log(`✓ Merchandising: ${merchCreados} productos (${variantesCreadas} variantes)${merchSalteados ? `, ${merchSalteados} ya existían` : ''}`)

  // ── Buffet + kiosco ────────────────────────────────────────────────
  let buffetCreados = 0, buffetSalteados = 0
  for (const b of [...BUFFET, ...KIOSCO]) {
    const existente = await prisma.producto.findUnique({ where: { tenantId_codigo: { tenantId, codigo: b.codigo } } })
    if (existente) { buffetSalteados++; continue }
    const esKiosco = b.tipos.length === 1 && b.tipos[0] === 'KIOSCO'
    const producto = await prisma.producto.create({
      data: {
        tenantId,
        codigo: b.codigo,
        nombre: b.nombre,
        descripcion: b.descripcion ?? null,
        categoriaId: (esKiosco ? catProd.KIOSCO : catProd.BUFFET).id,
        precioCompra: b.costo,
        precioVenta: b.precio,
        activo: true,
        aparecerEnCompras: true,
        publicarEnTienda: false,
      },
    })
    // Variante UNICA para que el artículo lleve stock, igual que en el tenant de referencia
    await prisma.productoVariante.create({
      data: {
        tenantId,
        productoId: producto.id,
        talle: 'UNICA',
        color: 'UNICA',
        sku: `${b.codigo}-UNICA`,
        stockActual: esKiosco ? 40 : 25,
        stockMinimo: 5,
        precioCosto: b.costo,
        precioVenta: b.precio,
        activo: true,
      },
    })
    await prisma.productoBuffet.create({
      data: {
        tenantId,
        productoId: producto.id,
        categoriaMenuId: catMenu[b.categoria].id,
        nombre: b.nombre,
        descripcion: b.descripcion ?? null,
        precio: b.precio,
        disponible: true,
        destacado: !!b.destacado,
        publicarMenu: !!b.menu,
        tiposVenta: b.tipos,
        activo: true,
      },
    })
    buffetCreados++
  }
  console.log(`✓ Buffet y kiosco: ${buffetCreados} productos${buffetSalteados ? `, ${buffetSalteados} ya existían` : ''}`)

  console.log('\n✅ Artículos de prueba creados.')
}

main()
  .catch(e => { console.error('\n❌ Error:', e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
