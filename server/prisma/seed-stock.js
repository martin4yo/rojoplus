import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding Stock data...')

  // =============================================================================
  // CATEGORIAS
  // =============================================================================
  const categorias = await Promise.all([
    prisma.categoriaProducto.upsert({
      where: { codigo: 'INDUM' },
      update: {},
      create: { codigo: 'INDUM', nombre: 'Indumentaria' }
    }),
    prisma.categoriaProducto.upsert({
      where: { codigo: 'ACCES' },
      update: {},
      create: { codigo: 'ACCES', nombre: 'Accesorios' }
    }),
    prisma.categoriaProducto.upsert({
      where: { codigo: 'HOGAR' },
      update: {},
      create: { codigo: 'HOGAR', nombre: 'Hogar y Cocina' }
    }),
    prisma.categoriaProducto.upsert({
      where: { codigo: 'ESCOL' },
      update: {},
      create: { codigo: 'ESCOL', nombre: 'Escolar' }
    }),
  ])

  console.log(`✓ ${categorias.length} categorias creadas`)

  const [catIndum, catAcces, catHogar, catEscol] = categorias

  // =============================================================================
  // PRODUCTOS CON VARIANTES
  // =============================================================================

  const productos = [
    // INDUMENTARIA
    {
      codigo: 'REM-OFI-2026',
      nombre: 'Remera Oficial 2026',
      descripcion: 'Remera oficial del club temporada 2026. 100% algodon peinado.',
      categoriaId: catIndum.id,
      precioCompra: 8500,
      precioVenta: 18000,
      variantes: [
        { talle: 'XS', stockActual: 5, stockMinimo: 3 },
        { talle: 'S', stockActual: 12, stockMinimo: 5 },
        { talle: 'M', stockActual: 20, stockMinimo: 8 },
        { talle: 'L', stockActual: 18, stockMinimo: 8 },
        { talle: 'XL', stockActual: 10, stockMinimo: 5 },
        { talle: 'XXL', stockActual: 4, stockMinimo: 3 },
      ]
    },
    {
      codigo: 'REM-ENT-2026',
      nombre: 'Remera Entrenamiento 2026',
      descripcion: 'Remera de entrenamiento dry-fit. Ideal para actividad deportiva.',
      categoriaId: catIndum.id,
      precioCompra: 7000,
      precioVenta: 15000,
      variantes: [
        { talle: 'S', stockActual: 8, stockMinimo: 4 },
        { talle: 'M', stockActual: 15, stockMinimo: 6 },
        { talle: 'L', stockActual: 12, stockMinimo: 6 },
        { talle: 'XL', stockActual: 6, stockMinimo: 4 },
      ]
    },
    {
      codigo: 'REM-RETRO',
      nombre: 'Remera Retro Campeon 1998',
      descripcion: 'Remera conmemorativa del campeonato de 1998. Edicion limitada.',
      categoriaId: catIndum.id,
      precioCompra: 10000,
      precioVenta: 25000,
      variantes: [
        { talle: 'S', stockActual: 3, stockMinimo: 2 },
        { talle: 'M', stockActual: 5, stockMinimo: 3 },
        { talle: 'L', stockActual: 4, stockMinimo: 3 },
        { talle: 'XL', stockActual: 2, stockMinimo: 2 },
      ]
    },
    {
      codigo: 'CAMP-INV',
      nombre: 'Campera Invierno Oficial',
      descripcion: 'Campera abrigo con capucha. Interior de polar.',
      categoriaId: catIndum.id,
      precioCompra: 25000,
      precioVenta: 55000,
      variantes: [
        { talle: 'S', stockActual: 4, stockMinimo: 2 },
        { talle: 'M', stockActual: 8, stockMinimo: 4 },
        { talle: 'L', stockActual: 6, stockMinimo: 4 },
        { talle: 'XL', stockActual: 3, stockMinimo: 2 },
        { talle: 'XXL', stockActual: 2, stockMinimo: 2 },
      ]
    },
    {
      codigo: 'BUZO-ALG',
      nombre: 'Buzo Algodon con Capucha',
      descripcion: 'Buzo de algodon frisado con capucha y bolsillo canguro.',
      categoriaId: catIndum.id,
      precioCompra: 15000,
      precioVenta: 32000,
      variantes: [
        { talle: 'S', stockActual: 6, stockMinimo: 3 },
        { talle: 'M', stockActual: 10, stockMinimo: 5 },
        { talle: 'L', stockActual: 8, stockMinimo: 5 },
        { talle: 'XL', stockActual: 4, stockMinimo: 3 },
      ]
    },
    {
      codigo: 'SHORT-OFI',
      nombre: 'Short Oficial 2026',
      descripcion: 'Short oficial de juego temporada 2026.',
      categoriaId: catIndum.id,
      precioCompra: 5000,
      precioVenta: 12000,
      variantes: [
        { talle: 'S', stockActual: 10, stockMinimo: 4 },
        { talle: 'M', stockActual: 15, stockMinimo: 6 },
        { talle: 'L', stockActual: 12, stockMinimo: 6 },
        { talle: 'XL', stockActual: 5, stockMinimo: 3 },
      ]
    },
    {
      codigo: 'MED-OFI',
      nombre: 'Medias Oficiales',
      descripcion: 'Medias oficiales de juego. Pack x1 par.',
      categoriaId: catIndum.id,
      precioCompra: 2000,
      precioVenta: 5000,
      variantes: [
        { talle: 'UNICO', stockActual: 30, stockMinimo: 10 },
      ]
    },
    {
      codigo: 'REM-NINO',
      nombre: 'Remera Ninos Oficial 2026',
      descripcion: 'Remera oficial para ninos. 100% algodon.',
      categoriaId: catIndum.id,
      precioCompra: 6000,
      precioVenta: 12000,
      variantes: [
        { talle: '4', stockActual: 8, stockMinimo: 4 },
        { talle: '6', stockActual: 10, stockMinimo: 5 },
        { talle: '8', stockActual: 12, stockMinimo: 5 },
        { talle: '10', stockActual: 10, stockMinimo: 5 },
        { talle: '12', stockActual: 8, stockMinimo: 4 },
        { talle: '14', stockActual: 6, stockMinimo: 3 },
      ]
    },

    // ACCESORIOS
    {
      codigo: 'GORRA-OFI',
      nombre: 'Gorra Oficial Bordada',
      descripcion: 'Gorra con escudo bordado y ajuste trasero.',
      categoriaId: catAcces.id,
      precioCompra: 4000,
      precioVenta: 9500,
      variantes: [
        { talle: 'UNICO', stockActual: 25, stockMinimo: 10 },
      ]
    },
    {
      codigo: 'GORRA-TRUCKER',
      nombre: 'Gorra Trucker Roja/Negra',
      descripcion: 'Gorra estilo trucker con malla trasera.',
      categoriaId: catAcces.id,
      precioCompra: 3500,
      precioVenta: 8000,
      variantes: [
        { talle: 'UNICO', stockActual: 15, stockMinimo: 5 },
      ]
    },
    {
      codigo: 'BUFANDA',
      nombre: 'Bufanda Hinchada',
      descripcion: 'Bufanda de hincha con colores del club. 150cm.',
      categoriaId: catAcces.id,
      precioCompra: 3000,
      precioVenta: 7500,
      variantes: [
        { talle: 'UNICO', stockActual: 20, stockMinimo: 8 },
      ]
    },
    {
      codigo: 'LLAVERO-ESC',
      nombre: 'Llavero Escudo Metal',
      descripcion: 'Llavero de metal esmaltado con escudo del club.',
      categoriaId: catAcces.id,
      precioCompra: 800,
      precioVenta: 2500,
      variantes: [
        { talle: 'UNICO', stockActual: 50, stockMinimo: 15 },
      ]
    },
    {
      codigo: 'LLAVERO-PEL',
      nombre: 'Llavero Pelota',
      descripcion: 'Llavero con mini pelota de futbol con colores del club.',
      categoriaId: catAcces.id,
      precioCompra: 600,
      precioVenta: 1800,
      variantes: [
        { talle: 'UNICO', stockActual: 40, stockMinimo: 15 },
      ]
    },
    {
      codigo: 'PULSERA',
      nombre: 'Pulsera Silicona',
      descripcion: 'Pulsera de silicona con logo del club.',
      categoriaId: catAcces.id,
      precioCompra: 300,
      precioVenta: 1000,
      variantes: [
        { talle: 'UNICO', stockActual: 100, stockMinimo: 30 },
      ]
    },
    {
      codigo: 'BILLETERA',
      nombre: 'Billetera Oficial',
      descripcion: 'Billetera de cuero sintetico con escudo grabado.',
      categoriaId: catAcces.id,
      precioCompra: 4500,
      precioVenta: 12000,
      variantes: [
        { talle: 'UNICO', stockActual: 12, stockMinimo: 5 },
      ]
    },
    {
      codigo: 'MOCHILA',
      nombre: 'Mochila Deportiva',
      descripcion: 'Mochila deportiva con compartimento para botines.',
      categoriaId: catAcces.id,
      precioCompra: 12000,
      precioVenta: 28000,
      variantes: [
        { talle: 'UNICO', stockActual: 8, stockMinimo: 3 },
      ]
    },
    {
      codigo: 'BOLSO-GYM',
      nombre: 'Bolso Gym',
      descripcion: 'Bolso para gimnasio con logo del club.',
      categoriaId: catAcces.id,
      precioCompra: 8000,
      precioVenta: 18000,
      variantes: [
        { talle: 'UNICO', stockActual: 6, stockMinimo: 3 },
      ]
    },

    // HOGAR Y COCINA
    {
      codigo: 'VASO-TERM',
      nombre: 'Vaso Termico 500ml',
      descripcion: 'Vaso termico de acero inoxidable con tapa. Mantiene temperatura.',
      categoriaId: catHogar.id,
      precioCompra: 5000,
      precioVenta: 12000,
      variantes: [
        { talle: 'UNICO', stockActual: 20, stockMinimo: 8 },
      ]
    },
    {
      codigo: 'MATE-CER',
      nombre: 'Mate Ceramica con Escudo',
      descripcion: 'Mate de ceramica con escudo del club en relieve.',
      categoriaId: catHogar.id,
      precioCompra: 3500,
      precioVenta: 8500,
      variantes: [
        { talle: 'UNICO', stockActual: 15, stockMinimo: 5 },
      ]
    },
    {
      codigo: 'MATE-VID',
      nombre: 'Mate Vidrio Forrado',
      descripcion: 'Mate de vidrio forrado en cuero con logo.',
      categoriaId: catHogar.id,
      precioCompra: 4000,
      precioVenta: 9500,
      variantes: [
        { talle: 'UNICO', stockActual: 12, stockMinimo: 5 },
      ]
    },
    {
      codigo: 'TAZA-MAG',
      nombre: 'Taza Magica Escudo',
      descripcion: 'Taza magica que revela el escudo con liquido caliente.',
      categoriaId: catHogar.id,
      precioCompra: 2500,
      precioVenta: 6500,
      variantes: [
        { talle: 'UNICO', stockActual: 18, stockMinimo: 6 },
      ]
    },
    {
      codigo: 'TAZA-CLB',
      nombre: 'Taza Clasica 350ml',
      descripcion: 'Taza de ceramica con escudo y colores del club.',
      categoriaId: catHogar.id,
      precioCompra: 1500,
      precioVenta: 4000,
      variantes: [
        { talle: 'UNICO', stockActual: 25, stockMinimo: 10 },
      ]
    },
    {
      codigo: 'TERM-1L',
      nombre: 'Termo Acero 1 Litro',
      descripcion: 'Termo de acero inoxidable con logo grabado.',
      categoriaId: catHogar.id,
      precioCompra: 12000,
      precioVenta: 28000,
      variantes: [
        { talle: 'UNICO', stockActual: 8, stockMinimo: 3 },
      ]
    },
    {
      codigo: 'VASO-CERV',
      nombre: 'Vaso Cervecero 500ml',
      descripcion: 'Vaso de vidrio tipo pinta con escudo.',
      categoriaId: catHogar.id,
      precioCompra: 2000,
      precioVenta: 5500,
      variantes: [
        { talle: 'UNICO', stockActual: 20, stockMinimo: 8 },
      ]
    },
    {
      codigo: 'DELANTAL',
      nombre: 'Delantal Asador',
      descripcion: 'Delantal para asado con bolsillo y logo bordado.',
      categoriaId: catHogar.id,
      precioCompra: 5000,
      precioVenta: 12000,
      variantes: [
        { talle: 'UNICO', stockActual: 10, stockMinimo: 4 },
      ]
    },

    // ESCOLAR
    {
      codigo: 'CUAD-T/D',
      nombre: 'Cuaderno Tapa Dura A4',
      descripcion: 'Cuaderno tapa dura 84 hojas con escudo.',
      categoriaId: catEscol.id,
      precioCompra: 1500,
      precioVenta: 3500,
      variantes: [
        { talle: 'UNICO', stockActual: 30, stockMinimo: 10 },
      ]
    },
    {
      codigo: 'CARPETA',
      nombre: 'Carpeta N3 c/Anillos',
      descripcion: 'Carpeta numero 3 con anillos y tapa ilustrada.',
      categoriaId: catEscol.id,
      precioCompra: 2500,
      precioVenta: 6000,
      variantes: [
        { talle: 'UNICO', stockActual: 20, stockMinimo: 8 },
      ]
    },
    {
      codigo: 'CARTUCHERA',
      nombre: 'Cartuchera Doble Cierre',
      descripcion: 'Cartuchera de tela con doble cierre y bolsillos.',
      categoriaId: catEscol.id,
      precioCompra: 2000,
      precioVenta: 5000,
      variantes: [
        { talle: 'UNICO', stockActual: 15, stockMinimo: 5 },
      ]
    },
    {
      codigo: 'LAPICERA',
      nombre: 'Set Lapiceras x3',
      descripcion: 'Set de 3 lapiceras con colores del club.',
      categoriaId: catEscol.id,
      precioCompra: 800,
      precioVenta: 2000,
      variantes: [
        { talle: 'UNICO', stockActual: 25, stockMinimo: 10 },
      ]
    },
  ]

  let totalProductos = 0
  let totalVariantes = 0

  for (const prod of productos) {
    const { variantes, ...productoData } = prod

    const producto = await prisma.producto.upsert({
      where: { codigo: prod.codigo },
      update: {
        nombre: prod.nombre,
        descripcion: prod.descripcion,
        categoriaId: prod.categoriaId,
        precioCompra: prod.precioCompra,
        precioVenta: prod.precioVenta,
      },
      create: productoData
    })

    totalProductos++

    // Crear variantes
    for (const v of variantes) {
      // Buscar si ya existe
      const existente = await prisma.productoVariante.findFirst({
        where: {
          productoId: producto.id,
          talle: v.talle,
          color: v.color || null
        }
      })

      if (existente) {
        await prisma.productoVariante.update({
          where: { id: existente.id },
          data: {
            stockActual: v.stockActual,
            stockMinimo: v.stockMinimo,
          }
        })
      } else {
        await prisma.productoVariante.create({
          data: {
            productoId: producto.id,
            talle: v.talle,
            color: v.color || null,
            stockActual: v.stockActual,
            stockMinimo: v.stockMinimo,
          }
        })
      }
      totalVariantes++
    }
  }

  console.log(`✓ ${totalProductos} productos creados`)
  console.log(`✓ ${totalVariantes} variantes creadas`)

  // Resumen
  const resumen = await prisma.$queryRaw`
    SELECT
      cp.nombre as categoria,
      COUNT(DISTINCT p.id) as productos,
      COUNT(pv.id) as variantes,
      SUM(pv.stock_actual) as stock_total,
      SUM(pv.stock_actual * p.precio_venta) as valor_total
    FROM categorias_producto cp
    LEFT JOIN productos p ON p.categoria_id = cp.id
    LEFT JOIN producto_variantes pv ON pv.producto_id = p.id
    GROUP BY cp.id, cp.nombre
    ORDER BY cp.nombre
  `

  console.log('\n📊 Resumen por categoria:')
  console.table(resumen.map(r => ({
    Categoria: r.categoria,
    Productos: Number(r.productos),
    Variantes: Number(r.variantes),
    'Stock Total': Number(r.stock_total),
    'Valor ($)': Number(r.valor_total)?.toLocaleString()
  })))
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
