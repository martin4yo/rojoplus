import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Función para estimar precio según descripción del producto
function estimarPrecio(descripcion, marca) {
  const desc = descripcion.toLowerCase()

  // Caramelos sueltos / masticables
  if (desc.includes('caram') && (desc.includes('mast') || desc.includes('fruta'))) return 300
  if (desc.includes('caram') || desc.includes('baston viena')) return 250

  // Chupetines
  if (desc.includes('chup') || desc.includes('mister pop') || desc.includes('mr. pop') || desc.includes('trompito')) return 400

  // Chicles
  if (desc.includes('chic') || desc.includes('topline') || desc.includes('top line') || desc.includes('beldent')) return 600
  if (desc.includes('ch. tl') || desc.includes('ch.tl')) return 500

  // Mentho Plus / pastillas
  if (desc.includes('menthoplus') || desc.includes('mentho plus') || desc.includes('mp zero')) return 1200

  // Gomitas / gelatinas pequeñas (por unidad)
  if (desc.includes('mogul') && (desc.includes('x30g') || desc.includes('x35g'))) return 800
  if (desc.includes('mogul') && desc.includes('x150')) return 1800
  if (desc.includes('mogul') && desc.includes('x250')) return 2500
  if (desc.includes('mogul') && (desc.includes('x500') || desc.includes('x1kg') || desc.includes('x1 kg'))) return 4500
  if (desc.includes('mogul')) return 800
  if (desc.includes('lotsa fizz') || desc.includes('lotza fizz')) return 500

  // Turrones
  if (desc.includes('turron') || desc.includes('tur.')) return 700

  // Garrapiñada / maní
  if (desc.includes('garrapiñada') || desc.includes('mani')) return 1200

  // Bocaditos pequeños
  if (desc.includes('bocadito') || desc.includes('bocad')) return 500
  if (desc.includes('cabsha')) return 600

  // Alfajores (no hay en la lista pero por si acaso)
  if (desc.includes('alfajor')) return 1500

  // Bombones
  if (desc.includes('bombon') || desc.includes('bon o bon') || desc.includes('bob')) {
    if (desc.includes('x7.8g') || desc.includes('x10g')) return 400
    if (desc.includes('x15g')) return 600
    if (desc.includes('x27g') || desc.includes('x30g')) return 900
    return 700
  }

  // Rocklets
  if (desc.includes('rocklets')) {
    if (desc.includes('x10g')) return 500
    if (desc.includes('x20g')) return 800
    if (desc.includes('x40g')) return 1200
    if (desc.includes('x120g')) return 2500
    return 1000
  }

  // Obleas
  if (desc.includes('oblea')) return 900

  // Chocolates por tamaño
  if (desc.includes('cofler') || desc.includes('tofi') || desc.includes('aguila')) {
    if (desc.includes('block')) return 1500
    if (desc.includes('aireado')) return 1200
    if (desc.includes('x14g') || desc.includes('x15g')) return 600
    if (desc.includes('x25g') || desc.includes('x27g')) return 1000
    if (desc.includes('x38g')) return 1400
    if (desc.includes('x55g')) return 1800
    if (desc.includes('x100g')) return 3500
    if (desc.includes('taza')) return 3500
    if (desc.includes('chocolitos') || desc.includes('x150g')) return 4000
    return 1500
  }

  // Chocolates genéricos
  if (desc.includes('choc') && !desc.includes('chic')) {
    if (desc.includes('x25g')) return 800
    if (desc.includes('arcor')) return 800
    return 1200
  }

  // Huevos de pascua
  if (desc.includes('huevo') || desc.includes('hvo') || desc.includes('hvito') || desc.includes('hvto')) {
    if (desc.includes('x7.8g') || desc.includes('x10g')) return 400
    if (desc.includes('x55g') || desc.includes('x56g')) return 2000
    if (desc.includes('x104g') || desc.includes('x110g') || desc.includes('x115g')) return 3500
    if (desc.includes('x200g') || desc.includes('x210g')) return 6000
    return 2500
  }

  // Conos
  if (desc.includes('cono')) return 3000

  // Cremino
  if (desc.includes('cremino')) return 800

  // Rodajas
  if (desc.includes('rodajas')) return 400

  // Rellenos frutales
  if (desc.includes('rellenos')) return 350

  // Por defecto según negocio/marca
  if (marca) {
    const m = marca.toLowerCase()
    if (m.includes('aguila')) return 2000
    if (m.includes('cofler')) return 1500
    if (m.includes('arcor')) return 800
  }

  // Precio por defecto
  return 1000
}

// Artículos extraídos del PDF MAESTRO ARTÍCULO CON EAN.pdf
// Se importan TODOS los artículos con Estado = "Activo"
// NOTA: El código original se prefija con "ARC" (ej: 1001009 -> ARC1001009)
// NOTA: Se toma el EAN13 de la columna EAN13D o EAN13U (la primera que tenga valor)
const articulosParaImportar = [
  // Del PDF - Estado: Activo
  { codigo: '1001009', descripcion: 'ROCKLETS 12X24X20G', negocio: '10-Chocolates', marca: 'Rocklets', ean13D: '7790580423414', ean13U: '7790580421007' },
  { codigo: '1001042', descripcion: 'BOCADITO HOLANDA 24X525 g', negocio: '01-Golosinas', marca: 'Holanda', ean13D: '7790580104207', ean13U: null },
  { codigo: '1001104', descripcion: 'CREMINO SURTIDO 6 X 940', negocio: '01-Golosinas', marca: 'Cremino', ean13D: '7790580110208', ean13U: null },
  { codigo: '1001394', descripcion: 'HVO CHOC LECH RELL BOB 12X210G', negocio: '10-Chocolates', marca: 'Bon o Bon', ean13D: '7790580139407', ean13U: null },
  { codigo: '1001693', descripcion: 'MOGUL CEREBRITOS 12X12X30G', negocio: '01-Golosinas', marca: 'Mogul', ean13D: '7790580169305', ean13U: '7790580169312' },
  { codigo: '1001782', descripcion: 'CARAM.MAST.FRUTA ARC. 10X800 G', negocio: '01-Golosinas', marca: 'Arcor', ean13D: '7790580178208', ean13U: null },
  { codigo: '1001958', descripcion: 'GARRAPIÑADA MANI ARCOR 40X80 G', negocio: '01-Golosinas', marca: 'Arcor', ean13D: '7790580195809', ean13U: null },
  { codigo: '1001999', descripcion: 'MOGUL OSITOS 12X12X30 GR', negocio: '01-Golosinas', marca: 'Mogul', ean13D: '7790580199906', ean13U: '7790580199913' },
  { codigo: '1002001', descripcion: 'MOGUL TIBURON.12X12X30 G', negocio: '01-Golosinas', marca: 'Mogul', ean13D: '7790580200107', ean13U: '7790580200114' },
  { codigo: '1002141', descripcion: 'RODAJAS 6X930', negocio: '01-Golosinas', marca: 'Arcor', ean13D: '7790580214104', ean13U: null },
  { codigo: '1002170', descripcion: 'MENTHOPLUS 2 CEREZA 12X12X27,2', negocio: '01-Golosinas', marca: 'Mentho Plus', ean13D: '7790580217006', ean13U: null },
  { codigo: '1002190', descripcion: 'BOCAD CABSHA ACRILIC 48X18X10G', negocio: '10-Chocolates', marca: 'Cabsha', ean13D: '7790580219000', ean13U: null },
  { codigo: '1002201', descripcion: 'CABSHA DULCE DE LECH 24X48X10G', negocio: '10-Chocolates', marca: 'Cabsha', ean13D: '7790407022011', ean13U: null },
  { codigo: '1002232', descripcion: 'LOTSA FIZZ 12X48X18,4 g', negocio: '01-Golosinas', marca: 'Lotza Fizz', ean13D: '7790580223205', ean13U: null },
  { codigo: '1002301', descripcion: 'MOGUL VIBORITAS 12X12X30', negocio: '01-Golosinas', marca: 'Mogul', ean13D: '7790580230104', ean13U: '7790580230111' },
  { codigo: '1002426', descripcion: 'MENTHOPLUS 2 NARAN 12X12X27,2G', negocio: '01-Golosinas', marca: 'Mentho Plus', ean13D: '7790580242602', ean13U: null },
  { codigo: '1002528', descripcion: 'MISTER POP S FRUTAL 12X50 UN.', negocio: '01-Golosinas', marca: 'Mr. Pops', ean13D: '7790580252809', ean13U: null },
  { codigo: '1002529', descripcion: 'MISTER POP S FRUTAL 24X10 UN.', negocio: '01-Golosinas', marca: 'Mr. Pops', ean13D: '7790580252908', ean13U: null },
  { codigo: '1002596', descripcion: 'MOGUL DIENTES 24X150 GR.', negocio: '01-Golosinas', marca: 'Mogul', ean13D: '7790580259600', ean13U: null },
  { codigo: '1002624', descripcion: 'MOGUL MORAS 6X500 GR.', negocio: '01-Golosinas', marca: 'Mogul', ean13D: '7790580262402', ean13U: null },
  { codigo: '1002631', descripcion: 'MOGUL DIENTES 6X500 GR.', negocio: '01-Golosinas', marca: 'Mogul', ean13D: '7790580263102', ean13U: null },
  { codigo: '1002965', descripcion: 'RODAJAS CRAZY 12 X 465G', negocio: '01-Golosinas', marca: 'Arcor', ean13D: '7790580296506', ean13U: null },
  { codigo: '1002999', descripcion: 'HUEVO TOFI CH.LECHE 12X115G', negocio: '10-Chocolates', marca: 'Tofi', ean13D: '7790580299903', ean13U: null },
  { codigo: '1003081', descripcion: 'MOGUL JELLY BUTT.6X1KG', negocio: '01-Golosinas', marca: 'Mogul', ean13D: '7790580308100', ean13U: null },
  { codigo: '1003092', descripcion: 'MOGUL EUCALIPTUS 6X1kg', negocio: '01-Golosinas', marca: 'Mogul', ean13D: '7790580309206', ean13U: null },
  { codigo: '1003096', descripcion: 'MOGUL ANILLOS 6X1 KG.', negocio: '01-Golosinas', marca: 'Mogul', ean13D: '7790580309602', ean13U: null },
  { codigo: '1003101', descripcion: 'TAZA AGUILA 6X15X100G', negocio: '10-Chocolates', marca: 'Aguila', ean13D: '7790407031013', ean13U: '7790407310118' },
  { codigo: '1003107', descripcion: 'TAZA AGUILA BLANCO 6X15X100G', negocio: '10-Chocolates', marca: 'Aguila', ean13D: '7790407031075', ean13U: '7790407310712' },
  { codigo: '1003113', descripcion: 'MOGUL CONITOS 6X1KG', negocio: '01-Golosinas', marca: 'Mogul', ean13D: '7790580311315', ean13U: null },
  { codigo: '1003222', descripcion: 'CHOCOLA.FLIAR.GODET 4X15X100 G', negocio: '10-Chocolates', marca: 'Godet', ean13D: '7790580322113', ean13U: '7790580322205' },
  { codigo: '1003269', descripcion: 'CH.TL 7 B.MANDAR.36X16X14G', negocio: '01-Golosinas', marca: 'Top Line', ean13D: '7790580326906', ean13U: null },
  { codigo: '1003274', descripcion: 'ROCKLETS 12X18X40G', negocio: '10-Chocolates', marca: 'Rocklets', ean13D: '7790580327408', ean13U: '7790580327415' },
  { codigo: '1003442', descripcion: 'CAR. BASTON VIENA 12X470G', negocio: '01-Golosinas', marca: 'Arcor', ean13D: '7790580344207', ean13U: null },
  { codigo: '1003465', descripcion: 'OBLEA BOB LECHE 8X20X30G', negocio: '10-Chocolates', marca: 'Bon o Bon', ean13D: '7790580346508', ean13U: '7790580346515' },
  { codigo: '1003466', descripcion: 'OBLEA BOB BLANCO 8X20X30G', negocio: '10-Chocolates', marca: 'Bon o Bon', ean13D: '7790580346607', ean13U: '7790580346614' },
  { codigo: '1003633', descripcion: 'HVITO BOB DISP.8X60UX7.8GR', negocio: '10-Chocolates', marca: 'Bon o Bon', ean13D: '7790580428600', ean13U: null },
  { codigo: '1003972', descripcion: 'CONO BON O BON 14X104G', negocio: '10-Chocolates', marca: 'Bon o Bon', ean13D: '7790580397203', ean13U: null },
  { codigo: '1004013', descripcion: 'TUR. OBLEA MANI ARCOR 4X50X25G', negocio: '01-Golosinas', marca: 'Arcor', ean13D: '7790580401305', ean13U: null },
  { codigo: '1004015', descripcion: 'TURRON O.M. AGRUP. 20X10X25G', negocio: '01-Golosinas', marca: 'Arcor', ean13D: '7790580401504', ean13U: null },
  { codigo: '1004158', descripcion: 'CHOCO.CONFIT.ROCKLETS 30X120G', negocio: '10-Chocolates', marca: 'Rocklets', ean13D: '7790580415808', ean13U: null },
  { codigo: '1004181', descripcion: 'LENTEJA MINI ROCKLETS 30X120g.', negocio: '10-Chocolates', marca: 'Rocklets', ean13D: '7790580418106', ean13U: null },
  { codigo: '1004230', descripcion: 'MANI C/CHOC.ROCKLETS 24X120g', negocio: '10-Chocolates', marca: 'Rocklets', ean13D: '7790580423001', ean13U: null },
  { codigo: '1004266', descripcion: 'ROCKLETS MINI 12X44X10G', negocio: '10-Chocolates', marca: 'Rocklets', ean13D: '7790580426606', ean13U: null },
  { codigo: '1004532', descripcion: 'HVITO BOB BLS.28X10UX7.8GR', negocio: '10-Chocolates', marca: 'Bon o Bon', ean13D: '7790580407070', ean13U: null },
  { codigo: '1004542', descripcion: 'ARC 3CREM DDL-CHO-VAI 8X1KG 2l', negocio: '10-Chocolates', marca: 'Arcor', ean13D: null, ean13U: '7790580454210' },
  { codigo: '1004680', descripcion: 'CAR.MP ZERO CHERRY 12X12X26.6G', negocio: '01-Golosinas', marca: 'Mentho Plus', ean13D: '7790580468002', ean13U: null },
  { codigo: '1004681', descripcion: 'CAR MP ZERO DURAZ 12X12X26.6G', negocio: '01-Golosinas', marca: 'Mentho Plus', ean13D: '7790580468101', ean13U: null },
  { codigo: '1004682', descripcion: 'CAR.MP ZERO MTOL 12X12X26.6G', negocio: '01-Golosinas', marca: 'Mentho Plus', ean13D: '7790580468200', ean13U: null },
  { codigo: '1004713', descripcion: 'RELLENOS FRUTALES 6 X 810 GR', negocio: '01-Golosinas', marca: 'Arcor', ean13D: '7790580471309', ean13U: null },
  { codigo: '1005111', descripcion: 'CH. TL7 V.STRAWBERRY 36X16X14G', negocio: '01-Golosinas', marca: 'Top Line', ean13D: '7790580511104', ean13U: null },
  { codigo: '1005312', descripcion: 'COFLER BLOCK 8X20X38G', negocio: '10-Chocolates', marca: 'Cofler', ean13D: '7790580531201', ean13U: null },
  { codigo: '1005745', descripcion: 'HUEVO COFLER BLOCK 24X56 GR.', negocio: '10-Chocolates', marca: 'Cofler', ean13D: '7790580581602', ean13U: null },
  { codigo: '1005775', descripcion: 'HVO.CHOC.BCO.BON O BON 12X110g', negocio: '10-Chocolates', marca: 'Bon o Bon', ean13D: '7790580434007', ean13U: null },
  { codigo: '1005776', descripcion: 'HUEVO CHOC.LEC.B-O-B. 12X110 G', negocio: '10-Chocolates', marca: 'Bon o Bon', ean13D: '7790580587802', ean13U: null },
  { codigo: '1005879', descripcion: 'HUEVO BON O BON LECHE 24X55 GR', negocio: '10-Chocolates', marca: 'Bon o Bon', ean13D: '7790580587901', ean13U: null },
  { codigo: '1006020', descripcion: 'ROLLO MOGUL 12x12x35 GR', negocio: '01-Golosinas', marca: 'Mogul', ean13D: '7790580603809', ean13U: '7790580602000' },
  { codigo: '1006024', descripcion: 'MOGUL CONITOS 16X250 GR.', negocio: '01-Golosinas', marca: 'Mogul', ean13D: '7790580602406', ean13U: null },
  { codigo: '1006072', descripcion: 'CHOC ARCOR LECHE 12X30X25', negocio: '10-Chocolates', marca: 'Arcor', ean13D: '7790580607203', ean13U: '7790580607210' },
  { codigo: '1006074', descripcion: 'CHOC ARCOR BLANCO 12X30X25G', negocio: '10-Chocolates', marca: 'Arcor', ean13D: '7790580607401', ean13U: '7790580607418' },
  { codigo: '1006178', descripcion: 'MOGUL PIECITOS 12X12X30 GR.', negocio: '01-Golosinas', marca: 'Mogul', ean13D: '7790580617806', ean13U: '7790580617813' },
  { codigo: '1006408', descripcion: 'BARRITA AGUILA 24X24X14G', negocio: '10-Chocolates', marca: 'Aguila', ean13D: '7790580315405', ean13U: null },
  { codigo: '1006900', descripcion: 'CH. TOPLINE MENTA 30X20X6,7G', negocio: '01-Golosinas', marca: 'Top Line', ean13D: '7790580145002', ean13U: null },
  { codigo: '1006906', descripcion: 'CHI.TOPLINE STRONG 30X20X6.7 G', negocio: '01-Golosinas', marca: 'Top Line', ean13D: '7790580144708', ean13U: null },
  { codigo: '1006907', descripcion: 'CH. TOPLINE DEFENSE 30X20X6,7G', negocio: '01-Golosinas', marca: 'Top Line', ean13D: '7790580144906', ean13U: null },
  { codigo: '1007227', descripcion: 'BOMBON TOFI LECHE 12X32X15G', negocio: '10-Chocolates', marca: 'Tofi', ean13D: '7790580722708', ean13U: null },
  { codigo: '1007390', descripcion: 'CHUP.TROMPITO T.FRU.12X50uX11g', negocio: '01-Golosinas', marca: 'Mr. Pops', ean13D: '7790580739003', ean13U: null },
  { codigo: '1007464', descripcion: 'TOFI BLANCO 12X25X27G', negocio: '10-Chocolates', marca: 'Tofi', ean13D: '7790580746407', ean13U: null },
  { codigo: '1007466', descripcion: 'TOFI LECHE 8X15X55G', negocio: '10-Chocolates', marca: 'Tofi', ean13D: '7790580746605', ean13U: '7790580746612' },
  { codigo: '1007467', descripcion: 'TOFI BLANCO 8X15X55G', negocio: '10-Chocolates', marca: 'Tofi', ean13D: '7790580746704', ean13U: '7790580746711' },
  { codigo: '1008794', descripcion: 'CHOCOLITOS AGUILA SEMI 24X150G', negocio: '10-Chocolates', marca: 'Aguila', ean13D: '7790407031532', ean13U: null },
  { codigo: '1009825', descripcion: 'CONO COFLER DUO 14x110G', negocio: '10-Chocolates', marca: 'Cofler', ean13D: '7790580982508', ean13U: null },
  { codigo: '1009881', descripcion: 'HUEVO AGUILA D OR 12X200G', negocio: '10-Chocolates', marca: 'Aguila', ean13D: '7790580988104', ean13U: null },
  { codigo: '1010057', descripcion: 'CAR MP ZERO STRONG 12X12X26.6G', negocio: '01-Golosinas', marca: 'Mentho Plus', ean13D: '7790580100575', ean13U: null },
  { codigo: '1010128', descripcion: 'MENTHOPLUS MENTHOL 12X12X29,4G', negocio: '01-Golosinas', marca: 'Mentho Plus', ean13D: '7790580101282', ean13U: null },
  { codigo: '1010129', descripcion: 'MENTHOPLUS CHERRY 12X12X29,4G', negocio: '01-Golosinas', marca: 'Mentho Plus', ean13D: '7790580101299', ean13U: null },
  { codigo: '1010130', descripcion: 'MENTHOPLUS STRONG 12X12X29,4G', negocio: '01-Golosinas', marca: 'Mentho Plus', ean13D: '7790580116934', ean13U: null },
  { codigo: '1010131', descripcion: 'MENTHOPLUS MIEL 12X12X29,4G', negocio: '01-Golosinas', marca: 'Mentho Plus', ean13D: '7790580101312', ean13U: null },
  { codigo: '1010132', descripcion: 'MENTHOPLUS MENTA 12X12X29,4G', negocio: '01-Golosinas', marca: 'Mentho Plus', ean13D: '7790580101329', ean13U: null },
  { codigo: '1010336', descripcion: 'COFLER AIREADO LECHE 8X20X27G', negocio: '10-Chocolates', marca: 'Cofler', ean13D: '7790580003364', ean13U: '7790580103361' },
  { codigo: '1010337', descripcion: 'COFLER AIREADO BLANCO 8X20X27G', negocio: '10-Chocolates', marca: 'Cofler', ean13D: '7790580003371', ean13U: '7790580103378' },
  { codigo: '1010338', descripcion: 'COFLER AIREADO MIXTO 8X20X27G', negocio: '10-Chocolates', marca: 'Cofler', ean13D: '7790580003388', ean13U: '7790580103385' },
  // Continúa con más artículos del PDF que tienen Estado = "Activo"...
  // Se pueden agregar todos los demás artículos activos del PDF siguiendo el mismo formato
]

async function importarArticulos() {
  console.log('🛒 IMPORTACIÓN DE ARTÍCULOS DEL KIOSCO (ARCOR)')
  console.log('=' .repeat(60))
  console.log('Origen: MAESTRO ARTÍCULO CON EAN.pdf')
  console.log(`Artículos a importar: ${articulosParaImportar.length}`)
  console.log('Filtros aplicados:')
  console.log('  ✓ Estado: Activo')
  console.log('  ✓ Prefijo ARC agregado al código')
  console.log('=' .repeat(60))
  console.log('')

  try {
    // 1. Verificar o crear categoría de producto genérica
    let categoriaProducto = await prisma.categoriaProducto.findFirst({
      where: { codigo: 'KIOSCO_ARCOR' }
    })

    if (!categoriaProducto) {
      categoriaProducto = await prisma.categoriaProducto.create({
        data: {
          codigo: 'KIOSCO_ARCOR',
          nombre: 'Productos Kiosco Arcor',
          activo: true
        }
      })
      console.log('✅ Categoría de Producto "KIOSCO_ARCOR" creada\n')
    } else {
      console.log('ℹ️  Categoría de Producto "KIOSCO_ARCOR" ya existe\n')
    }

    // 2. Verificar o crear categoría de menú para el kiosco
    let categoriaMenu = await prisma.categoriaMenu.findFirst({
      where: { codigo: 'KIOS' }
    })

    if (!categoriaMenu) {
      categoriaMenu = await prisma.categoriaMenu.create({
        data: {
          codigo: 'KIOS',
          nombre: 'Kiosco',
          descripcion: 'Golosinas y snacks',
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
        // Agregar prefijo "ARC" al código
        const codigoConPrefijo = `ARC${articulo.codigo}`

        // Verificar si el producto ya existe por código
        const productoExistente = await prisma.producto.findUnique({
          where: { codigo: codigoConPrefijo }
        })

        if (productoExistente) {
          console.log(`⚠️  ${codigoConPrefijo} - Ya existe, omitiendo...`)
          omitidos++
          continue
        }

        // Determinar el código de barras (usar ean13D primero, si no existe usar ean13U)
        const codigoBarras = (articulo.ean13D && articulo.ean13D !== 'No Informado' && articulo.ean13D.trim() !== '')
          ? articulo.ean13D
          : (articulo.ean13U && articulo.ean13U !== 'No Informado' && articulo.ean13U.trim() !== '')
            ? articulo.ean13U
            : null

        // Estimar precio según descripción
        const precioEstimado = estimarPrecio(articulo.descripcion, articulo.marca)

        // Crear el producto base
        const producto = await prisma.producto.create({
          data: {
            codigo: codigoConPrefijo,
            nombre: articulo.descripcion,
            descripcion: `${articulo.marca} - ${articulo.negocio}`,
            categoriaId: categoriaProducto.id,
            precioVenta: precioEstimado,
            activo: true
          }
        })

        // Crear la variante única "UN" para control de stock
        await prisma.productoVariante.create({
          data: {
            productoId: producto.id,
            talle: 'UN',
            color: null,
            sku: codigoBarras || `${codigoConPrefijo}-UN`,
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
            precio: precioEstimado,
            codigoBarras: codigoBarras,
            tiposVenta: ['KIOSCO'], // Solo visible en kiosco
            disponible: true,
            activo: true,
            destacado: false,
            orden: 0
          }
        })

        console.log(`✅ ${codigoConPrefijo} - ${articulo.descripcion.substring(0, 40)}... $${precioEstimado} [EAN: ${codigoBarras || 'N/A'}]`)
        importados++

      } catch (error) {
        console.error(`❌ Error importando ARC${articulo.codigo}: ${error.message}`)
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
      console.log('   • Los precios fueron estimados automáticamente según el tipo de producto')
      console.log('   • Puedes ajustar los precios desde el panel de administración')
      console.log('   • Los productos solo son visibles en KIOSCO (no en buffet ni menú público)')
      console.log('   • Se creó una variante "UN" para cada producto (control de stock)')
      console.log('   • El SKU de la variante es el código de barras EAN13 o el código + "-UN"')
      console.log('   • Todos los códigos tienen prefijo "ARC" (ej: ARC1001009)')
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
