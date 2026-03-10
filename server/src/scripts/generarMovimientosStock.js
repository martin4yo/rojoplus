import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '../../.env') })

const prisma = new PrismaClient()

/**
 * Extrae la cantidad de unidades por bulto/caja de la descripción del producto
 */
function extraerUnidadesPorBulto(descripcion) {
  const numberAtEnd = descripcion.match(/(\d+)\.00\s*$/)
  if (numberAtEnd) {
    const unidades = parseInt(numberAtEnd[1], 10)
    return unidades === 0 ? 1 : unidades
  }

  const patterns = [
    /[xX]\s*(\d+)\s*[uU][nN]?\s/,
    /[xX]\s*(\d+)\s*[uU]$/,
    /(\d+)[xX]\d+g/,
  ]

  for (const pattern of patterns) {
    const match = descripcion.match(pattern)
    if (match && match[1]) {
      return parseInt(match[1], 10)
    }
  }

  return 1
}

// Datos de la factura FCAEL_567271-567271.PDF
const articulosFactura = [
  { codigo: '13364', cantidad: 8, descripcion: 'CEREAL MIX FRUT/CHOC x26g 12.00', precioUnitario: 550.26, precioPublico: 932.14 },
  { codigo: '12625', cantidad: 8, descripcion: 'CEREAL MIX LIGHT YOG/FRU x28g 12.00', precioUnitario: 550.26, precioPublico: 932.14 },
  { codigo: '12626', cantidad: 8, descripcion: 'CEREAL MIX YOGURT/FRUT x28g 12.00', precioUnitario: 550.26, precioPublico: 932.14 },
  { codigo: '1009', cantidad: 10, descripcion: 'CHO ROCKLETS X20G 1.00', precioUnitario: 558.21, precioPublico: 945.61 },
  { codigo: '3274', cantidad: 10, descripcion: 'ROCKLETS x 40g 0.00', precioUnitario: 1060.43, precioPublico: 1796.37 },
  { codigo: '10350', cantidad: 2, descripcion: 'CHOC. LEC/ALM COFLER 55g 0.00', precioUnitario: 2260.38, precioPublico: 3829.08 },
  { codigo: '10352', cantidad: 2, descripcion: 'CHOC.LEC C/CONF COFLER 55G 7.07', precioUnitario: 2100.58, precioPublico: 3558.37 },
  { codigo: '10353', cantidad: 2, descripcion: 'COFLER CHOCOLINAS X 55G 7.07', precioUnitario: 2100.58, precioPublico: 3558.37 },
  { codigo: '3465', cantidad: 10, descripcion: 'OBLEA BONoBON LECHE x30g 1.00', precioUnitario: 669.74, precioPublico: 1134.54 },
  { codigo: '3466', cantidad: 10, descripcion: 'OBLEA BONoBON BCA.x30g 1.00', precioUnitario: 669.74, precioPublico: 1134.54 },
  { codigo: '12394', cantidad: 2, descripcion: 'COFLER YOGUR FRUTILLA X 64 GS 7.07', precioUnitario: 2100.58, precioPublico: 3558.37 },
  { codigo: '13342', cantidad: 6, descripcion: 'OBLEA ARCOR x20G 0.00', precioUnitario: 418.59, precioPublico: 709.09 },
  { codigo: '12145', cantidad: 5, descripcion: 'ROCKLETS MANI C/CHOC X 40 GS 1.00', precioUnitario: 1060.43, precioPublico: 1796.37 },
  { codigo: '2528', cantidad: 1, descripcion: 'CHUP.MR. POPS FRUTAL x50 u 10.00', precioUnitario: 4287.68, precioPublico: 145.27 },
  { codigo: '4013', cantidad: 1, descripcion: 'TURRON ARCOR x 50 u 25.00', precioUnitario: 8381.69, precioPublico: 283.97 },
  { codigo: '6072', cantidad: 6, descripcion: 'CELOFAN LECHE 25Gr 0.00', precioUnitario: 781.37, precioPublico: 1323.64 },
  { codigo: '3792', cantidad: 8, descripcion: 'CEREAL MIX LIGHT MANZ.x23Gr 12.00', precioUnitario: 550.26, precioPublico: 932.14 },
  { codigo: '13358', cantidad: 5, descripcion: 'ALF. MINITORTA X 69G 8.46', precioUnitario: 936.65, precioPublico: 1586.70 },
  { codigo: '14884', cantidad: 5, descripcion: 'ALF. BON O BON TRIPLE x60Gr 25.00', precioUnitario: 767.41, precioPublico: 1300.01 },
  { codigo: '15074', cantidad: 6, descripcion: 'ROCKLETS COOKIE x35g 0.00', precioUnitario: 1060.43, precioPublico: 1796.37 },
  { codigo: '13359', cantidad: 5, descripcion: 'ALF. MINITORTA BROWNI X 71.5 GS 8.46', precioUnitario: 936.65, precioPublico: 1586.70 },
  { codigo: '6596', cantidad: 5, descripcion: 'ALFAJOR COFLER BLOCK 25.00', precioUnitario: 767.41, precioPublico: 1300.01 },
  { codigo: '3750', cantidad: 2, descripcion: 'ALFAJOR BYN 3.0 NEGRO x73.5g 8.46', precioUnitario: 936.65, precioPublico: 1586.70 },
  { codigo: '4848', cantidad: 5, descripcion: 'ALF. TOFI 3 NEGRO x73g 8.46', precioUnitario: 936.65, precioPublico: 1586.70 },
  { codigo: '9919', cantidad: 2, descripcion: 'ALFAJOR BYN 3.0 BLANCO 8.46', precioUnitario: 936.65, precioPublico: 1586.70 },
  { codigo: '11283', cantidad: 5, descripcion: 'COFLER.BLOCK X 110 GS 15.00', precioUnitario: 2561.77, precioPublico: 4339.64 },
  { codigo: '15007', cantidad: 5, descripcion: 'ALF. CHOCOTORTA x71.5g 46.16', precioUnitario: 550.90, precioPublico: 933.22 },
  { codigo: '4303', cantidad: 5, descripcion: 'ALF. BON O BON LECHE x40g 25.00', precioUnitario: 468.98, precioPublico: 794.44 },
  { codigo: '4305', cantidad: 5, descripcion: 'ALF. BON O BON BCO x40g 25.00', precioUnitario: 468.98, precioPublico: 794.44 },
  { codigo: '1002', cantidad: 8, descripcion: 'CEREAL MIX PASION.CHOC x23g 12.00', precioUnitario: 550.26, precioPublico: 932.14 },
  { codigo: '6020', cantidad: 1, descripcion: 'ROLLO MOGUL x 12u 12.00', precioUnitario: 3963.63, precioPublico: 559.53 },
  { codigo: '11803', cantidad: 1, descripcion: 'MR.POPS EVOLU.CHERRY X 24 UN 0.00', precioUnitario: 4014.91, precioPublico: 283.39 },
  { codigo: '11809', cantidad: 1, descripcion: 'MR.POPS EVOL.BLUEBERRY X 24 UN 0.00', precioUnitario: 4014.94, precioPublico: 283.39 },
  { codigo: 'BCG1002', cantidad: 10, descripcion: 'BOLS EUCALIPTU X100g 0.00', precioUnitario: 661.16, precioPublico: 1120.01 },
  { codigo: 'BMG1001', cantidad: 10, descripcion: 'BOLSA MORAS X80G 0.00', precioUnitario: 661.16, precioPublico: 1120.01 },
  { codigo: 'BMG1002', cantidad: 10, descripcion: 'BOLSA DIENTES X80G 0.00', precioUnitario: 661.16, precioPublico: 1120.01 },
  { codigo: '15110', cantidad: 1, descripcion: 'TUB.MOGUL MAX TWIST 24x25g 0.00', precioUnitario: 8319.50, precioPublico: 587.22 },
  { codigo: '10129', cantidad: 1, descripcion: 'MENTHOPLUS CHERRY X 12 U 15.00', precioUnitario: 4016.59, precioPublico: 567.01 },
  { codigo: '10132', cantidad: 1, descripcion: 'MENTHOPLUS MENTA X 12U 15.00', precioUnitario: 4016.59, precioPublico: 567.01 },
  { codigo: '15405', cantidad: 1, descripcion: 'TOP LINE 7 ATOM.STRONG x16u 0.00', precioUnitario: 9128.42, precioPublico: 966.47 },
  { codigo: '1999', cantidad: 1, descripcion: 'MOGUL OSITOS 12x30g 0.00', precioUnitario: 4983.98, precioPublico: 703.57 },
  { codigo: 'BMG1005', cantidad: 10, descripcion: 'BOLSA TUBITO TUTI x70g 1.00', precioUnitario: 661.16, precioPublico: 800.00 },
  { codigo: 'BCG1006', cantidad: 10, descripcion: 'BOLSA J.BUTTON x100g 0.00', precioUnitario: 661.16, precioPublico: 1120.01 },
  { codigo: 'BCG1007', cantidad: 10, descripcion: 'BOLSA MOGUL CONITO X95g 0.00', precioUnitario: 661.16, precioPublico: 1120.01 },
  { codigo: '13023', cantidad: 1, descripcion: 'MOGUL OSO EXTREME 10x50g 0.00', precioUnitario: 6723.44, precioPublico: 1138.95 },
  { codigo: '2001', cantidad: 1, descripcion: 'MOGUL TIBURON 12x30g 0.00', precioUnitario: 4983.98, precioPublico: 703.57 },
  { codigo: '14336', cantidad: 2, descripcion: 'SURTIDO DIVERSION x400gr 10.00', precioUnitario: 1606.98, precioPublico: 2722.22 },
  { codigo: '13783', cantidad: 2, descripcion: 'MANA VAINILLA X 136GS 1.00', precioUnitario: 765.23, precioPublico: 1296.30 },
  { codigo: '13781', cantidad: 2, descripcion: 'MANA CON LECHE X 136G 1.00', precioUnitario: 765.23, precioPublico: 1296.30 },
  { codigo: '13782', cantidad: 3, descripcion: 'MANA LIMON X 136 GS 0.00', precioUnitario: 765.23, precioPublico: 1296.30 },
  { codigo: '13326', cantidad: 3, descripcion: 'MANA RELL VAI/FRU X 152G 0.00', precioUnitario: 988.42, precioPublico: 1674.38 },
  { codigo: '13325', cantidad: 3, descripcion: 'MANA RELL LIMON X 152G 0.00', precioUnitario: 988.42, precioPublico: 1674.38 },
  { codigo: '11074', cantidad: 3, descripcion: 'GALLETITAS ROCKLET X 118 GS 0.00', precioUnitario: 1084.07, precioPublico: 1836.41 },
  { codigo: '13989', cantidad: 6, descripcion: 'FORMIS VAI/FRU X 72 GS 1.00', precioUnitario: 523.83, precioPublico: 887.37 },
  { codigo: '13991', cantidad: 6, descripcion: 'FORMIS CHO/DDL. X 72 GS 1.00', precioUnitario: 523.83, precioPublico: 887.37 },
  { codigo: '14772', cantidad: 2, descripcion: 'SURTIDO BAGLEY x400gr 10.00', precioUnitario: 2008.72, precioPublico: 3402.79 },
  { codigo: '9419', cantidad: 5, descripcion: 'OPERA SIMPLE X 55G 0.00', precioUnitario: 510.15, precioPublico: 864.19 },
  { codigo: '9341', cantidad: 3, descripcion: 'OPERA SIMPLE X92G 0.00', precioUnitario: 733.34, precioPublico: 1242.28 },
  { codigo: '13965', cantidad: 3, descripcion: 'MERENGADAS X 88 G 1.00', precioUnitario: 956.54, precioPublico: 1620.38 },
  { codigo: '14351', cantidad: 2, descripcion: 'RUMBA x110g 0.00', precioUnitario: 956.54, precioPublico: 1620.38 },
  { codigo: '14353', cantidad: 2, descripcion: 'AMOR X110G 0.00', precioUnitario: 956.54, precioPublico: 1620.38 },
  { codigo: '10174', cantidad: 2, descripcion: 'REX X 75G 0.00', precioUnitario: 819.89, precioPublico: 1388.89 },
  { codigo: '1732', cantidad: 2, descripcion: 'KESITAS ESTUCHE x 125g 1.00', precioUnitario: 1339.15, precioPublico: 2268.52 },
  { codigo: '10173', cantidad: 3, descripcion: 'KESITAS X 75 GR 0.00', precioUnitario: 819.89, precioPublico: 1388.89 },
  { codigo: '7198', cantidad: 2, descripcion: 'REX ESTUCHE X125G 1.00', precioUnitario: 1339.15, precioPublico: 2268.52 },
  { codigo: '14744', cantidad: 2, descripcion: 'PORTEÑITAS X 139G 0.00', precioUnitario: 829.00, precioPublico: 1404.33 },
  { codigo: '6973', cantidad: 2, descripcion: 'SALADIX PIZZA x 100Gr 1.00', precioUnitario: 1020.30, precioPublico: 1728.39 },
  { codigo: '7167', cantidad: 2, descripcion: 'SALADIX JAMON x 100Gr 1.00', precioUnitario: 1020.30, precioPublico: 1728.39 },
  { codigo: '3746', cantidad: 2, descripcion: 'SALADIX DUO x80g 1.00', precioUnitario: 1020.30, precioPublico: 1728.39 },
  { codigo: '12963', cantidad: 3, descripcion: 'SALADIX CROSS ORIG.X67 1.00', precioUnitario: 710.53, precioPublico: 1203.64 },
  { codigo: '15314', cantidad: 3, descripcion: 'PAPA FRITA CRE/CEB x72g 56.80', precioUnitario: 661.19, precioPublico: 1120.04 },
  { codigo: '15315', cantidad: 3, descripcion: 'PAPA FRITA CHEDDAR x72g 56.80', precioUnitario: 661.19, precioPublico: 1120.04 },
  { codigo: '15316', cantidad: 3, descripcion: 'PAPA FRITA ORIGINAL x80g 56.80', precioUnitario: 661.19, precioPublico: 1120.04 },
  { codigo: '14377', cantidad: 3, descripcion: 'GALL. COFLER RELL CHO/VAI x85g 18.07', precioUnitario: 626.95, precioPublico: 1062.05 },
  { codigo: '14378', cantidad: 3, descripcion: 'GALL. COFLER RELL VAI/CHO x85g 18.07', precioUnitario: 626.95, precioPublico: 1062.05 },
  { codigo: '14380', cantidad: 3, descripcion: 'GALL. COFLER RELL. BOB x85g 18.07', precioUnitario: 626.95, precioPublico: 1062.05 },
  { codigo: '15406', cantidad: 1, descripcion: 'TOPLINE 7 XPLOS. MINT x16u 0.00', precioUnitario: 8917.76, precioPublico: 944.17 }
]

async function generarMovimientosStock() {
  try {
    console.log('📦 GENERAR MOVIMIENTOS DE STOCK - FACTURA KIOSCO\n')

    // Buscar usuario admin
    const usuario = await prisma.admin.findUnique({
      where: { email: 'admin@sportivopilar.com.ar' }
    })

    if (!usuario) {
      throw new Error('Usuario admin@sportivopilar.com.ar no encontrado')
    }

    console.log(`✓ Usuario encontrado: ${usuario.nombre} (ID: ${usuario.id})\n`)

    let procesados = 0
    let errores = 0
    let stockTotal = 0

    console.log('📥 Generando movimientos de ingreso...\n')

    for (const articulo of articulosFactura) {
      try {
        // Buscar el producto por código
        const producto = await prisma.producto.findUnique({
          where: { codigo: articulo.codigo },
          include: {
            variantes: true
          }
        })

        if (!producto) {
          console.log(`  ❌ Producto ${articulo.codigo} no encontrado`)
          errores++
          continue
        }

        if (producto.variantes.length === 0) {
          console.log(`  ❌ Producto ${producto.nombre} sin variantes`)
          errores++
          continue
        }

        const variante = producto.variantes[0]

        // Calcular unidades por bulto y stock real
        const unidadesPorBulto = extraerUnidadesPorBulto(articulo.descripcion)
        const cantidadBultos = articulo.cantidad
        const stockIngreso = cantidadBultos * unidadesPorBulto

        // Crear movimiento de stock
        await prisma.movimientoStock.create({
          data: {
            productoVarianteId: variante.id,
            tipo: 'INGRESO',
            cantidad: stockIngreso,
            stockAnterior: 0,
            stockPosterior: stockIngreso,
            concepto: `Ingreso inicial - Factura FCAEL_567271 (${cantidadBultos} bultos × ${unidadesPorBulto} u)`,
            registradoPor: usuario.id
          }
        })

        // Actualizar stock de la variante
        await prisma.productoVariante.update({
          where: { id: variante.id },
          data: { stockActual: stockIngreso }
        })

        console.log(`  ✓ ${producto.nombre}: ${stockIngreso} unidades (${cantidadBultos} × ${unidadesPorBulto})`)
        procesados++
        stockTotal += stockIngreso

      } catch (error) {
        console.log(`  ❌ Error procesando ${articulo.codigo}: ${error.message}`)
        errores++
      }
    }

    console.log('\n════════════════════════════════════════════════════════════')
    console.log('✅ GENERACIÓN DE MOVIMIENTOS COMPLETADA')
    console.log('════════════════════════════════════════════════════════════')
    console.log(`📦 Productos procesados: ${procesados}`)
    console.log(`📊 Stock total ingresado: ${stockTotal} unidades`)
    console.log(`❌ Errores: ${errores}`)
    console.log('════════════════════════════════════════════════════════════\n')

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

generarMovimientosStock()
