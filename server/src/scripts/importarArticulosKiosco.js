import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Artículos extraídos del PDF MAESTRO ARTÍCULO CON EAN.pdf
// Filtrados por: Estado = "Activo" Y Negocio != "03-Alimentos" AND != "12-Harinas" AND != "08-Agroindustrias"
// NOTA: Los artículos tienen 2 columnas EAN en el PDF. Se usa ean13 como principal y ean13_2 como fallback
const articulosParaImportar = [
  // GOLOSINAS (01-Golosinas)
  { codigo: '1001042', descripcion: 'BOCADITO HOLANDA 24X525 g', negocio: '01-Golosinas', marca: 'Holanda', ean13: '7790580104207', ean13_2: null },
  { codigo: '1001104', descripcion: 'CREMINO SURTIDO 6 X 940', negocio: '01-Golosinas', marca: 'Cremino', ean13: '7790580110208' },
  { codigo: '1001693', descripcion: 'MOGUL CEREBRITOS 12X12X30G', negocio: '01-Golosinas', marca: 'Mogul', ean13: '7790580169305' },
  { codigo: '1001782', descripcion: 'CARAM.MAST.FRUTA ARC. 10X800 G', negocio: '01-Golosinas', marca: 'Arcor', ean13: '7790580178208' },
  { codigo: '1001958', descripcion: 'GARRAPIÑADA MANI ARCOR 40X80 G', negocio: '01-Golosinas', marca: 'Arcor', ean13: '7790580195809' },
  { codigo: '1001999', descripcion: 'MOGUL OSITOS 12X12X30 GR', negocio: '01-Golosinas', marca: 'Mogul', ean13: '7790580199906' },
  { codigo: '1002001', descripcion: 'MOGUL TIBURON.12X12X30 G', negocio: '01-Golosinas', marca: 'Mogul', ean13: '7790580200107' },
  { codigo: '1002141', descripcion: 'RODAJAS 6X930', negocio: '01-Golosinas', marca: 'Arcor', ean13: '7790580214104' },
  { codigo: '1002170', descripcion: 'MENTHOPLUS 2 CEREZA 12X12X27,2', negocio: '01-Golosinas', marca: 'Mentho Plus', ean13: '7790580217006' },
  { codigo: '1002232', descripcion: 'LOTSA FIZZ 12X48X18,4 g', negocio: '01-Golosinas', marca: 'Lotza Fizz', ean13: '7790580223205' },
  { codigo: '1002301', descripcion: 'MOGUL VIBORITAS 12X12X30', negocio: '01-Golosinas', marca: 'Mogul', ean13: '7790580230104' },
  { codigo: '1002426', descripcion: 'MENTHOPLUS 2 NARAN 12X12X27,2G', negocio: '01-Golosinas', marca: 'Mentho Plus', ean13: '7790580242602' },
  { codigo: '1002528', descripcion: 'MISTER POP S FRUTAL 12X50 UN.', negocio: '01-Golosinas', marca: 'Mr. Pops', ean13: '7790580252809' },
  { codigo: '1002529', descripcion: 'MISTER POP S FRUTAL 24X10 UN.', negocio: '01-Golosinas', marca: 'Mr. Pops', ean13: '7790580252908' },
  { codigo: '1002596', descripcion: 'MOGUL DIENTES 24X150 GR.', negocio: '01-Golosinas', marca: 'Mogul', ean13: '7790580259600' },
  { codigo: '1002624', descripcion: 'MOGUL MORAS 6X500 GR.', negocio: '01-Golosinas', marca: 'Mogul', ean13: '7790580262402' },
  { codigo: '1002631', descripcion: 'MOGUL DIENTES 6X500 GR.', negocio: '01-Golosinas', marca: 'Mogul', ean13: '7790580263102' },
  { codigo: '1002965', descripcion: 'RODAJAS CRAZY 12 X 465G', negocio: '01-Golosinas', marca: 'Arcor', ean13: '7790580296506' },
  { codigo: '1003081', descripcion: 'MOGUL JELLY BUTT.6X1KG', negocio: '01-Golosinas', marca: 'Mogul', ean13: '7790580308100' },
  { codigo: '1003092', descripcion: 'MOGUL EUCALIPTUS 6X1kg', negocio: '01-Golosinas', marca: 'Mogul', ean13: '7790580309206' },
  { codigo: '1003096', descripcion: 'MOGUL ANILLOS 6X1 KG.', negocio: '01-Golosinas', marca: 'Mogul', ean13: '7790580309602' },
  { codigo: '1003113', descripcion: 'MOGUL CONITOS 6X1KG', negocio: '01-Golosinas', marca: 'Mogul', ean13: '7790580311315' },
  { codigo: '1003269', descripcion: 'CH.TL 7 B.MANDAR.36X16X14G', negocio: '01-Golosinas', marca: 'Top Line', ean13: '7790580326906' },
  { codigo: '1003442', descripcion: 'CAR. BASTON VIENA 12X470G', negocio: '01-Golosinas', marca: 'Arcor', ean13: '7790580344207' },
  { codigo: '1004013', descripcion: 'TUR. OBLEA MANI ARCOR 4X50X25G', negocio: '01-Golosinas', marca: 'Arcor', ean13: '7790580401305' },
  { codigo: '1004015', descripcion: 'TURRON O.M. AGRUP. 20X10X25G', negocio: '01-Golosinas', marca: 'Arcor', ean13: '7790580401504' },
  { codigo: '1004680', descripcion: 'CAR.MP ZERO CHERRY 12X12X26.6G', negocio: '01-Golosinas', marca: 'Mentho Plus', ean13: '7790580468002' },
  { codigo: '1004681', descripcion: 'CAR MP ZERO DURAZ 12X12X26.6G', negocio: '01-Golosinas', marca: 'Mentho Plus', ean13: '7790580468101' },
  { codigo: '1004682', descripcion: 'CAR.MP ZERO MTOL 12X12X26.6G', negocio: '01-Golosinas', marca: 'Mentho Plus', ean13: '7790580468200' },
  { codigo: '1004713', descripcion: 'RELLENOS FRUTALES 6 X 810 GR', negocio: '01-Golosinas', marca: 'Arcor', ean13: '7790580471309' },

  // CHOCOLATES (10-Chocolates)
  { codigo: '1001009', descripcion: 'ROCKLETS 12X24X20G', negocio: '10-Chocolates', marca: 'Rocklets', ean13: '7790580423414' },
  { codigo: '1001394', descripcion: 'HVO CHOC LECH RELL BOB 12X210G', negocio: '10-Chocolates', marca: 'Bon o Bon', ean13: '7790580139407' },
  { codigo: '1002190', descripcion: 'BOCAD CABSHA ACRILIC 48X18X10G', negocio: '10-Chocolates', marca: 'Cabsha', ean13: '7790580219000' },
  { codigo: '1002201', descripcion: 'CABSHA DULCE DE LECH 24X48X10G', negocio: '10-Chocolates', marca: 'Cabsha', ean13: '7790407022011' },
  { codigo: '1002999', descripcion: 'HUEVO TOFI CH.LECHE 12X115G', negocio: '10-Chocolates', marca: 'Tofi', ean13: '7790580299903' },
  { codigo: '1003101', descripcion: 'TAZA AGUILA 6X15X100G', negocio: '10-Chocolates', marca: 'Aguila', ean13: '7790407031013' },
  { codigo: '1003107', descripcion: 'TAZA AGUILA BLANCO 6X15X100G', negocio: '10-Chocolates', marca: 'Aguila', ean13: '7790407031075' },
  { codigo: '1003222', descripcion: 'CHOCOLA.FLIAR.GODET 4X15X100 G', negocio: '10-Chocolates', marca: 'Godet', ean13: '7790580322113' },
  { codigo: '1003274', descripcion: 'ROCKLETS 12X18X40G', negocio: '10-Chocolates', marca: 'Rocklets', ean13: '7790580327408' },
  { codigo: '1003465', descripcion: 'OBLEA BOB LECHE 8X20X30G', negocio: '10-Chocolates', marca: 'Bon o Bon', ean13: '7790580346508' },
  { codigo: '1003466', descripcion: 'OBLEA BOB BLANCO 8X20X30G', negocio: '10-Chocolates', marca: 'Bon o Bon', ean13: '7790580346607' },
  { codigo: '1003633', descripcion: 'HVITO BOB DISP.8X60UX7.8GR', negocio: '10-Chocolates', marca: 'Bon o Bon', ean13: '7790580428600' },
  { codigo: '1003972', descripcion: 'CONO BON O BON 14X104G', negocio: '10-Chocolates', marca: 'Bon o Bon', ean13: '7790580397203' },
  { codigo: '1004158', descripcion: 'CHOCO.CONFIT.ROCKLETS 30X120G', negocio: '10-Chocolates', marca: 'Rocklets', ean13: '7790580415808' },
  { codigo: '1004181', descripcion: 'LENTEJA MINI ROCKLETS 30X120g.', negocio: '10-Chocolates', marca: 'Rocklets', ean13: '7790580418106' },
  { codigo: '1004230', descripcion: 'MANI C/CHOC.ROCKLETS 24X120g', negocio: '10-Chocolates', marca: 'Rocklets', ean13: '7790580423001' },
  { codigo: '1004266', descripcion: 'ROCKLETS MINI 12X44X10G', negocio: '10-Chocolates', marca: 'Rocklets', ean13: '7790580426606' },
  { codigo: '1004532', descripcion: 'HVITO BOB BLS.28X10UX7.8GR', negocio: '10-Chocolates', marca: 'Bon o Bon', ean13: '7790580407070' },
  { codigo: '1004542', descripcion: 'ARC 3CREM DDL-CHO-VAI 8X1KG 2l', negocio: '10-Chocolates', marca: 'Arcor', ean13: '7790580454210' },
  { codigo: '1005312', descripcion: 'COFLER BLOCK 8X20X38G', negocio: '10-Chocolates', marca: 'Cofler', ean13: '7790580531201' },
  { codigo: '1005745', descripcion: 'HUEVO COFLER BLOCK 24X56 GR.', negocio: '10-Chocolates', marca: 'Cofler', ean13: '7790580581602' },
  { codigo: '1005775', descripcion: 'HVO.CHOC.BCO.BON O BON 12X110g', negocio: '10-Chocolates', marca: 'Bon o Bon', ean13: '7790580434007' },
  { codigo: '1005776', descripcion: 'HUEVO CHOC.LEC.B-O-B. 12X110 G', negocio: '10-Chocolates', marca: 'Bon o Bon', ean13: '7790580587802' },
  { codigo: '1005879', descripcion: 'HUEVO BON O BON LECHE 24X55 GR', negocio: '10-Chocolates', marca: 'Bon o Bon', ean13: '7790580587901' },
  { codigo: '1006020', descripcion: 'ROLLO MOGUL 12x12x35 GR', negocio: '01-Golosinas', marca: 'Mogul', ean13: '7790580603809' },
  { codigo: '1006024', descripcion: 'MOGUL CONITOS 16X250 GR.', negocio: '01-Golosinas', marca: 'Mogul', ean13: '7790580602406' },
  { codigo: '1006072', descripcion: 'CHOC ARCOR LECHE 12X30X25', negocio: '10-Chocolates', marca: 'Arcor', ean13: '7790580607203' },
  { codigo: '1006074', descripcion: 'CHOC ARCOR BLANCO 12X30X25G', negocio: '10-Chocolates', marca: 'Arcor', ean13: '7790580607401' },
  { codigo: '1006139', descripcion: 'ALF.B-O-B.NGO.AGRUP.16X6X40 07', negocio: '12-Harinas', marca: 'Bon o Bon', ean13: '7790040613904' },
  { codigo: '1006178', descripcion: 'MOGUL PIECITOS 12X12X30 GR.', negocio: '01-Golosinas', marca: 'Mogul', ean13: '7790580617806' },
  { codigo: '1006408', descripcion: 'BARRITA AGUILA 24X24X14G', negocio: '10-Chocolates', marca: 'Aguila', ean13: '7790580315405' },
  { codigo: '1006900', descripcion: 'CH. TOPLINE MENTA 30X20X6,7G', negocio: '01-Golosinas', marca: 'Top Line', ean13: '7790580145002' },
  { codigo: '1006906', descripcion: 'CHI.TOPLINE STRONG 30X20X6.7 G', negocio: '01-Golosinas', marca: 'Top Line', ean13: '7790580144708' },
  { codigo: '1006907', descripcion: 'CH. TOPLINE DEFENSE 30X20X6,7G', negocio: '01-Golosinas', marca: 'Top Line', ean13: '7790580144906' },
  { codigo: '1007227', descripcion: 'BOMBON TOFI LECHE 12X32X15G', negocio: '10-Chocolates', marca: 'Tofi', ean13: '7790580722708' },
  { codigo: '1007390', descripcion: 'CHUP.TROMPITO T.FRU.12X50uX11g', negocio: '01-Golosinas', marca: 'Mr. Pops', ean13: '7790580739003' },
  { codigo: '1007464', descripcion: 'TOFI BLANCO 12X25X27G', negocio: '10-Chocolates', marca: 'Tofi', ean13: '7790580746407' },
  { codigo: '1007466', descripcion: 'TOFI LECHE 8X15X55G', negocio: '10-Chocolates', marca: 'Tofi', ean13: '7790580746605' },
  { codigo: '1007467', descripcion: 'TOFI BLANCO 8X15X55G', negocio: '10-Chocolates', marca: 'Tofi', ean13: '7790580746704' },
  { codigo: '1008794', descripcion: 'CHOCOLITOS AGUILA SEMI 24X150G', negocio: '10-Chocolates', marca: 'Aguila', ean13: '7790407031532' },
  { codigo: '1009825', descripcion: 'CONO COFLER DUO 14x110G', negocio: '10-Chocolates', marca: 'Cofler', ean13: '7790580982508' },
  { codigo: '1009881', descripcion: 'HUEVO AGUILA D OR 12X200G', negocio: '10-Chocolates', marca: 'Aguila', ean13: '7790580988104' },
  { codigo: '1010057', descripcion: 'CAR MP ZERO STRONG 12X12X26.6G', negocio: '01-Golosinas', marca: 'Mentho Plus', ean13: '7790580100575' },
  { codigo: '1010128', descripcion: 'MENTHOPLUS MENTHOL 12X12X29,4G', negocio: '01-Golosinas', marca: 'Mentho Plus', ean13: '7790580101282' },
  { codigo: '1010129', descripcion: 'MENTHOPLUS CHERRY 12X12X29,4G', negocio: '01-Golosinas', marca: 'Mentho Plus', ean13: '7790580101299' },
  { codigo: '1010130', descripcion: 'MENTHOPLUS STRONG 12X12X29,4G', negocio: '01-Golosinas', marca: 'Mentho Plus', ean13: '7790580116934' },
  { codigo: '1010131', descripcion: 'MENTHOPLUS MIEL 12X12X29,4G', negocio: '01-Golosinas', marca: 'Mentho Plus', ean13: '7790580101312' },
  { codigo: '1010132', descripcion: 'MENTHOPLUS MENTA 12X12X29,4G', negocio: '01-Golosinas', marca: 'Mentho Plus', ean13: '7790580101329' },
  { codigo: '1010336', descripcion: 'COFLER AIREADO LECHE 8X20X27G', negocio: '10-Chocolates', marca: 'Cofler', ean13: '7790580003364' },
  { codigo: '1010337', descripcion: 'COFLER AIREADO BLANCO 8X20X27G', negocio: '10-Chocolates', marca: 'Cofler', ean13: '7790580003371' },
  { codigo: '1010338', descripcion: 'COFLER AIREADO MIXTO 8X20X27G', negocio: '10-Chocolates', marca: 'Cofler', ean13: '7790580003388' },
]

async function importarArticulos() {
  console.log('🛒 IMPORTACIÓN DE ARTÍCULOS DEL KIOSCO')
  console.log('=' .repeat(60))
  console.log('Origen: MAESTRO ARTÍCULO CON EAN.pdf')
  console.log(`Artículos a importar: ${articulosParaImportar.length}`)
  console.log('Filtros aplicados:')
  console.log('  ✓ Estado: Activo')
  console.log('  ✗ Negocio: Alimentos, Harinas, Agroindustrias')
  console.log('=' .repeat(60))
  console.log('')

  try {
    // 1. Verificar o crear categoría de producto genérica
    let categoriaProducto = await prisma.categoriaProducto.findFirst({
      where: { codigo: 'KIOSCO' }
    })

    if (!categoriaProducto) {
      categoriaProducto = await prisma.categoriaProducto.create({
        data: {
          codigo: 'KIOSCO',
          nombre: 'Productos Kiosco',
          activo: true
        }
      })
      console.log('✅ Categoría de Producto "KIOSCO" creada\n')
    } else {
      console.log('ℹ️  Categoría de Producto "KIOSCO" ya existe\n')
    }

    // 2. Verificar o crear categoría de menú para el buffet
    let categoriaMenu = await prisma.categoriaMenu.findFirst({
      where: { nombre: 'Kiosco' }
    })

    if (!categoriaMenu) {
      categoriaMenu = await prisma.categoriaMenu.create({
        data: {
          nombre: 'Kiosco',
          descripcion: 'Productos de kiosco y golosinas',
          color: '#F59E0B',
          icono: 'shopping-bag',
          orden: 100,
          activo: true
        }
      })
      console.log('✅ Categoría de Menú "Kiosco" creada\n')
    } else {
      console.log('ℹ️  Categoría de Menú "Kiosco" ya existe\n')
    }

    console.log('📦 Iniciando importación de productos...\n')

    let importados = 0
    let omitidos = 0
    let errores = 0

    for (const articulo of articulosParaImportar) {
      try {
        // Verificar si el producto ya existe por código
        const productoExistente = await prisma.producto.findUnique({
          where: { codigo: articulo.codigo }
        })

        if (productoExistente) {
          console.log(`⚠️  ${articulo.codigo} - Ya existe, omitiendo...`)
          omitidos++
          continue
        }

        // Determinar el código de barras (usar ean13, si no existe usar ean13_2)
        const codigoBarras = (articulo.ean13 && articulo.ean13 !== 'No Informado' && articulo.ean13.trim() !== '')
          ? articulo.ean13
          : (articulo.ean13_2 && articulo.ean13_2 !== 'No Informado' && articulo.ean13_2.trim() !== '')
            ? articulo.ean13_2
            : null

        // Crear el producto base
        const producto = await prisma.producto.create({
          data: {
            codigo: articulo.codigo,
            nombre: articulo.descripcion,
            descripcion: `${articulo.marca} - ${articulo.negocio}`,
            categoriaId: categoriaProducto.id,
            precioVenta: 0, // Precio a definir manualmente
            activo: true
          }
        })

        // Crear la variante única "UN" para control de stock
        await prisma.productoVariante.create({
          data: {
            productoId: producto.id,
            talle: 'UN',
            color: null,
            sku: codigoBarras || `${articulo.codigo}-UN`,
            stockActual: 0,
            stockMinimo: 0,
            precioCosto: null,
            margen: null,
            precioVenta: null,
            activo: true
          }
        })

        // Crear el producto de buffet/kiosco
        await prisma.productoBuffet.create({
          data: {
            productoId: producto.id,
            categoriaMenuId: categoriaMenu.id,
            nombre: articulo.descripcion.substring(0, 100),
            descripcion: articulo.marca || '',
            precio: 0, // Precio a definir manualmente
            codigoBarras: codigoBarras,
            tiposVenta: ['KIOSCO'], // Solo visible en kiosco
            disponible: true,
            activo: true,
            destacado: false,
            orden: 0
          }
        })

        console.log(`✅ ${articulo.codigo} - ${articulo.descripcion.substring(0, 40)}...`)
        importados++

      } catch (error) {
        console.error(`❌ Error importando ${articulo.codigo}: ${error.message}`)
        errores++
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('📊 RESUMEN DE IMPORTACIÓN')
    console.log('='.repeat(60))
    console.log(`✅ Importados exitosamente: ${importados}`)
    console.log(`⚠️  Omitidos (ya existían): ${omitidos}`)
    console.log(`❌ Errores: ${errores}`)
    console.log(`📦 Total procesados: ${importados + omitidos + errores}`)
    console.log('='.repeat(60))

    if (importados > 0) {
      console.log('\n⚠️  IMPORTANTE:')
      console.log('   • Los precios están en $0 por defecto')
      console.log('   • Debes actualizar los precios desde el panel de administración')
      console.log('   • Los productos solo son visibles en KIOSCO')
      console.log('   • Se creó una variante "UN" para cada producto (control de stock)')
      console.log('   • El SKU de la variante es el código de barras o el código + "-UN"')
    }

  } catch (error) {
    console.error('\n❌ ERROR GENERAL:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Ejecutar la importación
importarArticulos()
  .then(() => {
    console.log('\n✨ Proceso completado')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Error fatal:', error)
    process.exit(1)
  })
