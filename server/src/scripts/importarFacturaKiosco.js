/**
 * Script para importar artículos de factura de kiosco
 * - Lee factura FCAEL_567271-567271.PDF con artículos y cantidades
 * - Busca códigos EAN13 en MAESTRO ARTICULO CON EAN.pdf
 * - Crea productos que no existen
 * - Actualiza stock con ingreso
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno desde server/.env
dotenv.config({ path: join(__dirname, '../../.env') });

const prisma = new PrismaClient();

/**
 * Extrae la cantidad de unidades por bulto/caja de la descripción del producto
 * La factura tiene dos formatos:
 * 1. Número al final de descripción (ej: "CEREAL MIX x26g 12.00" → 12 unidades)
 * 2. En el texto (ej: "CHUP x50 u" → 50, "MR.POPS X 24 UN" → 24)
 */
function extraerUnidadesPorBulto(descripcion) {
  // Patrón 1: Número decimal al final (ej: "12.00", "25.00")
  const numberAtEnd = descripcion.match(/(\d+)\.00\s*$/);
  if (numberAtEnd) {
    const unidades = parseInt(numberAtEnd[1], 10);
    // Si es 0, significa venta unitaria (1 unidad)
    return unidades === 0 ? 1 : unidades;
  }

  // Patrón 2: "x50 u", "X 24 UN", "x12u", "12x30g" (unidades × peso)
  const patterns = [
    /[xX]\s*(\d+)\s*[uU][nN]?\s/,  // x50 u, X 24 UN
    /[xX]\s*(\d+)\s*[uU]$/,         // x12u al final
    /(\d+)[xX]\d+g/,                // 12x30g, 10x50g
  ];

  for (const pattern of patterns) {
    const match = descripcion.match(pattern);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
  }

  // Si no encuentra patrón, asumir unidad individual
  return 1;
}

/**
 * Redondea un precio al próximo múltiplo de 50 sin decimales
 * Ejemplos: 932.14 → 950, 1134.54 → 1150, 1586.70 → 1600
 */
function redondearPrecio(precio) {
  return Math.ceil(precio / 50) * 50;
}

// Datos extraídos de la factura FCAEL_567271-567271.PDF
// precioUnitario = precio del BULTO completo | precioPublico = precio sugerido UNITARIO
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
];

// Mapeo de códigos de artículo a EAN13 (extraído del maestro)
const codigosEAN = {
  '13364': '7790040100206',
  '12625': '7790580423414',
  '12626': '7790580423414',
  '1009': '7790580421007',
  '3274': '7790580327408',
  '10350': '7790580043407',
  '10352': '7790580003524',
  '10353': '7790580003531',
  '3465': '7790580346508',
  '3466': '7790580346607',
  '12394': '7790580123949',
  '13342': '7790580133429',
  '12145': '7790580121457',
  '2528': '7790580252809',
  '4013': '7790580401504',
  '6072': '7790580607203',
  '3792': '7790040379206',
  '13358': '7790040133570',
  '14884': '7790040613706',
  '15074': '7790580524104',
  '13359': '7790040133594',
  '6596': '7790040659605',
  '3750': '7790040375000',
  '4848': '7790040484801',
  '9919': '7790040991910',
  '11283': '7790580110031',
  '15007': '7790040150072',
  '4303': '7790040613706',
  '4305': '7790040613607',
  '1002': '7790040100206',
  '6020': '7790580603809',
  '11803': '7790580118037',
  '11809': '7790580118099',
  'BCG1002': '7790580611557',
  'BMG1001': '7790580611557',
  'BMG1002': '7790580611557',
  '15110': '7790580151188',
  '10129': '7790580101299',
  '10132': '7790580101329',
  '15405': '7790580154056',
  '1999': '7790580199906',
  'BMG1005': '7790580611556',
  'BCG1006': '7790580611557',
  'BCG1007': '7790580611556',
  '13023': '7790580123055',
  '2001': '7790580200107',
  '14336': '7790580134334',
  '13783': '7790040137837',
  '13781': '7790040137813',
  '13782': '7790040137820',
  '13326': '7790040133266',
  '13325': '7790040133259',
  '11074': '7790040110748',
  '13989': '7790040139893',
  '13991': '7790040139916',
  '14772': '7790040147720',
  '9419': '7790040941905',
  '9341': '7790040934105',
  '13965': '7790040132689',
  '14351': '7790040143517',
  '14353': '7790040143531',
  '10174': '7790040003569',
  '1732': '7790040173200',
  '10173': '7790040003606',
  '7198': '7790040719804',
  '14744': '7790040132689',
  '6973': '7790580697303',
  '7167': '7790580716707',
  '3746': '7790580716707',
  '12963': '7790040124899',
  '15314': '7790040153141',
  '15315': '7790040153158',
  '15316': '7790040153165',
  '14377': '7790040143777',
  '14378': '7790040143784',
  '14380': '7790040143807',
  '15406': '7790580154063'
};

async function main() {
  console.log('🚀 Iniciando importación de factura de kiosco...\n');

  // 1. Buscar usuario admin
  const usuario = await prisma.admin.findUnique({
    where: { email: 'admin@sportivopilar.com.ar' }
  });

  if (!usuario) {
    throw new Error('Usuario admin@sportivopilar.com.ar no encontrado');
  }

  console.log(`✓ Usuario encontrado: ${usuario.nombre} (ID: ${usuario.id})\n`);

  // 2. Buscar o crear categoría KIOSCO
  let categoria = await prisma.categoriaProducto.findFirst({
    where: { codigo: 'KIOSCO' }
  });

  if (!categoria) {
    categoria = await prisma.categoriaProducto.create({
      data: {
        codigo: 'KIOSCO',
        nombre: 'KIOSCO',
        activo: true
      }
    });
    console.log('✓ Categoría KIOSCO creada\n');
  } else {
    console.log('✓ Categoría KIOSCO encontrada\n');
  }

  // 3. Buscar o crear categoría de menú para buffet
  let categoriaMenu = await prisma.categoriaMenu.findFirst({
    where: { codigo: 'KIOSCO' }
  });

  if (!categoriaMenu) {
    categoriaMenu = await prisma.categoriaMenu.create({
      data: {
        codigo: 'KIOSCO',
        nombre: 'KIOSCO',
        descripcion: 'Productos de kiosco',
        orden: 999,
        activo: true
      }
    });
    console.log('✓ Categoría de menú KIOSCO creada\n');
  } else {
    console.log('✓ Categoría de menú KIOSCO encontrada\n');
  }

  // 4. Procesar cada artículo de la factura
  let creados = 0;
  let actualizados = 0;
  let errores = 0;

  for (const articulo of articulosFactura) {
    try {
      console.log(`\n📦 Procesando: ${articulo.codigo} - ${articulo.descripcion}`);

      const ean13 = codigosEAN[articulo.codigo];
      if (!ean13) {
        console.log(`  ⚠️  No se encontró EAN13 para código ${articulo.codigo}`);
      }

      // Extraer unidades por bulto de la descripción
      const unidadesPorBulto = extraerUnidadesPorBulto(articulo.descripcion);
      const cantidadBultos = articulo.cantidad;

      // Calcular stock real en unidades
      const stockReal = cantidadBultos * unidadesPorBulto;

      // Calcular precio de costo unitario (precio del bulto / unidades por bulto)
      const precioCostoUnitario = articulo.precioUnitario / unidadesPorBulto;

      // El precio público ya es unitario, redondearlo a múltiplos de 100
      const precioVentaUnitario = redondearPrecio(articulo.precioPublico);

      console.log(`  📊 ${cantidadBultos} bulto(s) × ${unidadesPorBulto} unidades = ${stockReal} unidades totales`);
      console.log(`  💰 Costo unitario: $${precioCostoUnitario.toFixed(2)} | Venta unitario: $${precioVentaUnitario} (sugerido: $${articulo.precioPublico.toFixed(2)})`);

      // Calcular margen con precios unitarios
      let margen = 0;
      if (precioVentaUnitario > 0 && precioCostoUnitario > 0) {
        const margenCalculado = ((precioVentaUnitario - precioCostoUnitario) / precioVentaUnitario * 100);
        // Validar: margen debe estar entre -999.99 y 999.99 (límite de Decimal(5,2))
        if (margenCalculado < -999.99 || margenCalculado > 999.99) {
          console.log(`  ⚠️  Margen fuera de rango (${margenCalculado.toFixed(2)}%), usando 0`);
          margen = 0;
        } else {
          margen = parseFloat(margenCalculado.toFixed(2));
          console.log(`  📈 Margen: ${margen.toFixed(2)}%`);
        }
      }

      // Buscar si existe el producto
      let producto = await prisma.producto.findUnique({
        where: { codigo: articulo.codigo },
        include: {
          variantes: true,
          productoBuffet: true
        }
      });

      if (!producto) {
        // CREAR NUEVO PRODUCTO
        console.log('  🆕 Creando nuevo producto...');

        // Crear producto
        producto = await prisma.producto.create({
          data: {
            codigo: articulo.codigo,
            nombre: articulo.descripcion,
            categoriaId: categoria.id,
            precioCompra: precioCostoUnitario,
            precioVenta: precioVentaUnitario,
            margen: margen,
            activo: true
          }
        });

        // Crear variante UNICA
        const variante = await prisma.productoVariante.create({
          data: {
            productoId: producto.id,
            talle: 'UNICA',
            color: 'UNICA',
            sku: `${articulo.codigo}-UNICA`,
            stockActual: 0,
            stockMinimo: 0,
            precioCosto: precioCostoUnitario,
            precioVenta: precioVentaUnitario,
            margen: margen,
            activo: true
          }
        });

        // Crear ProductoBuffet para kiosco
        await prisma.productoBuffet.create({
          data: {
            productoId: producto.id,
            categoriaMenuId: categoriaMenu.id,
            nombre: articulo.descripcion,
            precio: precioVentaUnitario,
            disponible: true,
            activo: true,
            codigoBarras: ean13 || null,
            tiposVenta: ['KIOSCO']
          }
        });

        // Crear movimiento de stock (INGRESO)
        await prisma.movimientoStock.create({
          data: {
            productoVarianteId: variante.id,
            tipo: 'INGRESO',
            cantidad: stockReal,
            stockAnterior: 0,
            stockPosterior: stockReal,
            concepto: `Ingreso por factura FCAEL_567271-567271 (${cantidadBultos} bulto(s) × ${unidadesPorBulto} u/bulto)`,
            registradoPor: usuario.id
          }
        });

        // Actualizar stock actual de la variante
        await prisma.productoVariante.update({
          where: { id: variante.id },
          data: { stockActual: stockReal }
        });

        console.log(`  ✓ Producto creado con stock inicial: ${stockReal} unidades`);
        creados++;

      } else {
        // ACTUALIZAR PRODUCTO EXISTENTE
        console.log('  ♻️  Producto existente, actualizando...');

        // Actualizar precios del producto
        await prisma.producto.update({
          where: { id: producto.id },
          data: {
            precioCompra: precioCostoUnitario,
            precioVenta: precioVentaUnitario,
            margen: margen
          }
        });

        // Actualizar ProductoBuffet si no existe
        if (!producto.productoBuffet) {
          await prisma.productoBuffet.create({
            data: {
              productoId: producto.id,
              categoriaMenuId: categoriaMenu.id,
              nombre: articulo.descripcion,
              precio: precioVentaUnitario,
              disponible: true,
              activo: true,
              codigoBarras: ean13 || null,
              tiposVenta: ['KIOSCO']
            }
          });
          console.log('  ✓ ProductoBuffet creado');
        } else {
          // Actualizar precio y EAN si es necesario
          await prisma.productoBuffet.update({
            where: { productoId: producto.id },
            data: {
              precio: precioVentaUnitario,
              codigoBarras: ean13 || producto.productoBuffet.codigoBarras
            }
          });
        }

        // Buscar variante UNICA
        let variante = producto.variantes.find(v => v.talle === 'UNICA' && v.color === 'UNICA');

        if (!variante) {
          variante = await prisma.productoVariante.create({
            data: {
              productoId: producto.id,
              talle: 'UNICA',
              color: 'UNICA',
              sku: `${articulo.codigo}-UNICA`,
              stockActual: 0,
              stockMinimo: 0,
              precioCosto: precioCostoUnitario,
              precioVenta: precioVentaUnitario,
              margen: margen,
              activo: true
            }
          });
        }

        // Actualizar precios de variante
        await prisma.productoVariante.update({
          where: { id: variante.id },
          data: {
            precioCosto: precioCostoUnitario,
            precioVenta: precioVentaUnitario,
            margen: margen
          }
        });

        // Crear movimiento de stock (INGRESO)
        const stockAnterior = parseFloat(variante.stockActual.toString());
        const stockPosterior = stockAnterior + stockReal;

        await prisma.movimientoStock.create({
          data: {
            productoVarianteId: variante.id,
            tipo: 'INGRESO',
            cantidad: stockReal,
            stockAnterior: stockAnterior,
            stockPosterior: stockPosterior,
            concepto: `Ingreso por factura FCAEL_567271-567271 (${cantidadBultos} bulto(s) × ${unidadesPorBulto} u/bulto)`,
            registradoPor: usuario.id
          }
        });

        // Actualizar stock actual de la variante
        await prisma.productoVariante.update({
          where: { id: variante.id },
          data: { stockActual: stockPosterior }
        });

        console.log(`  ✓ Stock actualizado: ${stockAnterior} → ${stockPosterior} unidades`);
        actualizados++;
      }

    } catch (error) {
      console.error(`  ❌ Error procesando ${articulo.codigo}:`, error.message);
      errores++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN DE IMPORTACIÓN');
  console.log('='.repeat(60));
  console.log(`✓ Productos creados: ${creados}`);
  console.log(`♻️  Productos actualizados: ${actualizados}`);
  console.log(`❌ Errores: ${errores}`);
  console.log(`📦 Total procesados: ${articulosFactura.length}`);
  console.log('='.repeat(60));
}

main()
  .catch((e) => {
    console.error('❌ Error fatal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
