/**
 * Script para agregar imágenes de ejemplo a los productos del buffet
 * Ejecutar con: DATABASE_URL="postgresql://postgres:Q27G4B98@localhost:5434/rojoplus_db?schema=public" node updateImagenesProductos.js
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Imágenes de Unsplash por tipo de producto (palabras clave en el nombre)
const imagenesPorPalabraClave = {
  // Sandwiches y hamburguesas
  'lomito': 'https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=400&h=300&fit=crop',
  'milanesa al pan': 'https://images.unsplash.com/photo-1619881590738-a111d176d906?w=400&h=300&fit=crop',
  'hamburguesa': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop',
  'tostado': 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&h=300&fit=crop',
  'carlitos': 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&h=300&fit=crop',
  'pancho': 'https://images.unsplash.com/photo-1612392062631-94e8e6c0f56e?w=400&h=300&fit=crop',

  // Pizzas
  'muzzarella': 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop',
  'napolitana': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop',
  'fugazzeta': 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=300&fit=crop',
  'calabresa': 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400&h=300&fit=crop',
  'especial': 'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=400&h=300&fit=crop',

  // Empanadas
  'empanada': 'https://images.unsplash.com/photo-1604467794349-0b74285de7e7?w=400&h=300&fit=crop',
  'docena': 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=400&h=300&fit=crop',

  // Minutas
  'milanesa napolitana': 'https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?w=400&h=300&fit=crop',
  'milanesa c/papas': 'https://images.unsplash.com/photo-1585325701956-60dd9c8553bc?w=400&h=300&fit=crop',
  'milanesa a caballo': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=400&h=300&fit=crop',
  'suprema': 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&h=300&fit=crop',
  'papas fritas': 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=300&fit=crop',
  'papas con cheddar': 'https://images.unsplash.com/photo-1585109649139-366815a0d713?w=400&h=300&fit=crop',

  // Ensaladas
  'ensalada mixta': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop',
  'ensalada césar': 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=400&h=300&fit=crop',
  'ensalada completa': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&h=300&fit=crop',

  // Postres
  'flan': 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop',
  'panqueques': 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=300&fit=crop',
  'vigilante': 'https://images.unsplash.com/photo-1486427944299-d1955d23e34d?w=400&h=300&fit=crop',
  'ensalada de frutas': 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=400&h=300&fit=crop',
  'brownie': 'https://images.unsplash.com/photo-1564355808539-22fda35bed7e?w=400&h=300&fit=crop',

  // Cafetería
  'café': 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop',
  'cortado': 'https://images.unsplash.com/photo-1485808191679-5f86510681a2?w=400&h=300&fit=crop',
  'submarino': 'https://images.unsplash.com/photo-1517578239113-b03992dcdd25?w=400&h=300&fit=crop',
  'té': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&h=300&fit=crop',
  'capuccino': 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&h=300&fit=crop',

  // Golosinas
  'alfajor': 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&h=300&fit=crop',
  'barrita': 'https://images.unsplash.com/photo-1622484211148-c51c84ad2d53?w=400&h=300&fit=crop',
  'papas chips': 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400&h=300&fit=crop',
  'maní': 'https://images.unsplash.com/photo-1567892320421-1c657571ea4a?w=400&h=300&fit=crop',

  // Panificados
  'medialuna': 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&h=300&fit=crop',
  'facturas': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=300&fit=crop',
  'tostadas': 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400&h=300&fit=crop',
  'budín': 'https://images.unsplash.com/photo-1586788224331-947f68671cf1?w=400&h=300&fit=crop',

  // Helados
  'helado': 'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=400&h=300&fit=crop',
  'cucurucho': 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=400&h=300&fit=crop',
  'vasito': 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=400&h=300&fit=crop',

  // Combos
  'combo': 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=400&h=300&fit=crop',
  'promo': 'https://images.unsplash.com/photo-1561758033-d89a9ad46330?w=400&h=300&fit=crop',

  // Desayuno
  'desayuno': 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=400&h=300&fit=crop',
  'merienda': 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop',

  // Bebidas
  'gaseosa': 'https://images.unsplash.com/photo-1581006852262-e4307cf6283a?w=400&h=300&fit=crop',
  'coca': 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&h=300&fit=crop',
  'sprite': 'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=400&h=300&fit=crop',
  'fanta': 'https://images.unsplash.com/photo-1624517452488-04869289c4ca?w=400&h=300&fit=crop',
  'agua': 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&h=300&fit=crop',
  'jugo': 'https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?w=400&h=300&fit=crop',
  'cerveza': 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=400&h=300&fit=crop',
  'vino': 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&h=300&fit=crop',
  'fernet': 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&h=300&fit=crop',
}

// Imágenes por defecto según categoría
const imagenesPorCategoria = {
  'SAND': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop',
  'PIZZ': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop',
  'EMPA': 'https://images.unsplash.com/photo-1604467794349-0b74285de7e7?w=400&h=300&fit=crop',
  'MINU': 'https://images.unsplash.com/photo-1585325701956-60dd9c8553bc?w=400&h=300&fit=crop',
  'ENSA': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop',
  'POST': 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop',
  'CAFE': 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop',
  'GOLO': 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=400&h=300&fit=crop',
  'PANI': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=300&fit=crop',
  'HELA': 'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=400&h=300&fit=crop',
  'COMB': 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=400&h=300&fit=crop',
  'DESA': 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=400&h=300&fit=crop',
  'GASE': 'https://images.unsplash.com/photo-1581006852262-e4307cf6283a?w=400&h=300&fit=crop',
  'AGJU': 'https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?w=400&h=300&fit=crop',
  'ALCO': 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&h=300&fit=crop',
}

function buscarImagen(nombreProducto, codigoCategoria) {
  const nombreLower = nombreProducto.toLowerCase()

  // Buscar por palabra clave en el nombre
  for (const [keyword, url] of Object.entries(imagenesPorPalabraClave)) {
    if (nombreLower.includes(keyword)) {
      return url
    }
  }

  // Si no encuentra, usar imagen de la categoría
  return imagenesPorCategoria[codigoCategoria] || null
}

async function main() {
  console.log('Actualizando imágenes de productos...\n')

  // Obtener todos los productos buffet con su categoría
  const productos = await prisma.productoBuffet.findMany({
    where: { activo: true },
    include: {
      categoriaMenu: true
    }
  })

  let actualizados = 0

  for (const prod of productos) {
    const imagen = buscarImagen(prod.nombre, prod.categoriaMenu?.codigo)

    if (imagen && !prod.imagen) {
      await prisma.productoBuffet.update({
        where: { id: prod.id },
        data: { imagen }
      })
      console.log(`✓ ${prod.nombre} → imagen asignada`)
      actualizados++
    } else if (prod.imagen) {
      console.log(`- ${prod.nombre} → ya tiene imagen`)
    } else {
      console.log(`✗ ${prod.nombre} → sin imagen disponible`)
    }
  }

  console.log(`\n✅ Proceso completado. ${actualizados} productos actualizados.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
