import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Mapeo de productos a fotos (usando Unsplash con keywords relevantes)
const fotosProductos = {
  // INDUMENTARIA
  'REM-OFI-2026': [
    'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&h=600&fit=crop', // red tshirt
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=600&fit=crop', // tshirt detail
  ],
  'REM-ENT-2026': [
    'https://images.unsplash.com/photo-1571945153237-4929e783af4a?w=600&h=600&fit=crop', // sports shirt
    'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=600&h=600&fit=crop', // training wear
  ],
  'REM-RETRO': [
    'https://images.unsplash.com/photo-1529374255404-311a2a4f1fd9?w=600&h=600&fit=crop', // vintage shirt
  ],
  'CAMP-INV': [
    'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&h=600&fit=crop', // jacket
    'https://images.unsplash.com/photo-1544923246-77307dd628b7?w=600&h=600&fit=crop', // hoodie jacket
  ],
  'BUZO-ALG': [
    'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&h=600&fit=crop', // hoodie
    'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=600&h=600&fit=crop', // sweatshirt
  ],
  'SHORT-OFI': [
    'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=600&h=600&fit=crop', // shorts
  ],
  'MED-OFI': [
    'https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?w=600&h=600&fit=crop', // socks
  ],
  'REM-NINO': [
    'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=600&h=600&fit=crop', // kids clothing
  ],

  // ACCESORIOS
  'GORRA-OFI': [
    'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=600&h=600&fit=crop', // cap
    'https://images.unsplash.com/photo-1534215754734-18e55d13e346?w=600&h=600&fit=crop', // baseball cap
  ],
  'GORRA-TRUCKER': [
    'https://images.unsplash.com/photo-1575428652377-a2d80e2277fc?w=600&h=600&fit=crop', // trucker hat
  ],
  'BUFANDA': [
    'https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?w=600&h=600&fit=crop', // scarf
  ],
  'LLAVERO-ESC': [
    'https://images.unsplash.com/photo-1628149455678-16f37bc392f4?w=600&h=600&fit=crop', // keychain
  ],
  'LLAVERO-PEL': [
    'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=600&h=600&fit=crop', // soccer ball keychain
  ],
  'PULSERA': [
    'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=600&h=600&fit=crop', // bracelet
  ],
  'BILLETERA': [
    'https://images.unsplash.com/photo-1627123424574-724758594e93?w=600&h=600&fit=crop', // wallet
  ],
  'MOCHILA': [
    'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=600&fit=crop', // backpack
    'https://images.unsplash.com/photo-1581605405669-fcdf81165afa?w=600&h=600&fit=crop', // sports bag
  ],
  'BOLSO-GYM': [
    'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=600&fit=crop', // gym bag
  ],

  // HOGAR Y COCINA
  'VASO-TERM': [
    'https://images.unsplash.com/photo-1577937927133-66ef06acdf18?w=600&h=600&fit=crop', // tumbler
  ],
  'MATE-CER': [
    'https://images.unsplash.com/photo-1558857563-c651f0d00ff9?w=600&h=600&fit=crop', // mate
  ],
  'MATE-VID': [
    'https://images.unsplash.com/photo-1593207746354-f3ec3dd10204?w=600&h=600&fit=crop', // mate glass
  ],
  'TAZA-MAG': [
    'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600&h=600&fit=crop', // magic mug
  ],
  'TAZA-CLB': [
    'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=600&h=600&fit=crop', // coffee mug
  ],
  'TERM-1L': [
    'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=600&h=600&fit=crop', // thermos
  ],
  'VASO-CERV': [
    'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=600&h=600&fit=crop', // beer glass
  ],
  'DELANTAL': [
    'https://images.unsplash.com/photo-1583394293214-28ez1c79f3a3?w=600&h=600&fit=crop', // apron
  ],

  // ESCOLAR
  'CUAD-T/D': [
    'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=600&h=600&fit=crop', // notebook
  ],
  'CARPETA': [
    'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&h=600&fit=crop', // folder
  ],
  'CARTUCHERA': [
    'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=600&h=600&fit=crop', // pencil case
  ],
  'LAPICERA': [
    'https://images.unsplash.com/photo-1585336261022-680e295ce3fe?w=600&h=600&fit=crop', // pens
  ],
}

async function main() {
  console.log('Agregando fotos a productos...')

  let totalFotos = 0

  for (const [codigo, urls] of Object.entries(fotosProductos)) {
    const producto = await prisma.producto.findUnique({
      where: { codigo },
      include: { fotos: true }
    })

    if (!producto) {
      console.log(`⚠ Producto ${codigo} no encontrado`)
      continue
    }

    // Eliminar fotos existentes
    if (producto.fotos.length > 0) {
      await prisma.productoFoto.deleteMany({
        where: { productoId: producto.id }
      })
    }

    // Crear nuevas fotos
    for (let i = 0; i < urls.length; i++) {
      await prisma.productoFoto.create({
        data: {
          productoId: producto.id,
          url: urls[i],
          orden: i,
          esPrincipal: i === 0
        }
      })
      totalFotos++
    }

    console.log(`✓ ${codigo}: ${urls.length} foto(s)`)
  }

  console.log(`\n✅ Total: ${totalFotos} fotos agregadas a ${Object.keys(fotosProductos).length} productos`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
