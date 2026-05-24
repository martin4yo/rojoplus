import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

/**
 * Puebla CategoriaMenu.imagen con imágenes genéricas de Unsplash según el código.
 * Por defecto solo completa las categorías que tienen imagen en null (no pisa fotos
 * subidas desde el admin). Con --force sobreescribe todas.
 *
 * Uso:
 *   node src/scripts/poblarImagenesCategoriasBuffet.js --tenant sportivopilar
 *   node src/scripts/poblarImagenesCategoriasBuffet.js --tenant sportivopilar --force
 *   node src/scripts/poblarImagenesCategoriasBuffet.js --tenant sportivopilar --dry
 */

const SIZE = '?w=800&h=600&fit=crop'

// Mapa código → id de foto Unsplash (mismos usados en el fallback de MenuBuffet.jsx)
const FOTOS = {
  CAFE: '1509042239860-f550ce710b93',
  DESAY: '1533089860892-a7c6f0a88666',
  COMIDAS: '1504674900247-0877df9cc836',
  MINUTAS: '1585325701956-60dd9c8553bc',
  SANDW: '1568901346375-23c9450c58cd',
  HAMB: '1571091718767-18b5b1457add',
  EMP: '1604467794349-0b74285de7e7',
  PIZZA: '1565299624946-b28f40a0ae38',
  ENSALADAS: '1512621776951-a57141f2eefd',
  BEBIDAS: '1581006852262-e4307cf6283a',
  CERVEZA: '1608270586620-248524c67de9',
  POSTRES: '1488477181946-6428a0291777',
  HUERTAS: '1542838132-92c53300491e',
  KIOSCO: '1621939514649-280e2ee25f60',
  // Aliases por si el club usa los códigos cortos del mapa viejo
  SAND: '1568901346375-23c9450c58cd',
  PIZZ: '1565299624946-b28f40a0ae38',
  EMPA: '1604467794349-0b74285de7e7',
  MINU: '1585325701956-60dd9c8553bc',
  ENSA: '1512621776951-a57141f2eefd',
  POST: '1488477181946-6428a0291777',
  DESA: '1533089860892-a7c6f0a88666',
}

function url(codigo) {
  const id = FOTOS[codigo]
  return id ? `https://images.unsplash.com/photo-${id}${SIZE}` : null
}

function arg(name) {
  const i = process.argv.indexOf(name)
  return i !== -1 ? (process.argv[i + 1] || true) : null
}

async function main() {
  const slug = arg('--tenant') || 'sportivopilar'
  const force = !!arg('--force')
  const dry = !!arg('--dry')

  const prisma = new PrismaClient()
  try {
    const tenant = await prisma.tenant.findFirst({
      where: { OR: [{ slug }, { subdomain: slug }] },
      select: { id: true, slug: true, nombre: true },
    })
    if (!tenant) {
      console.error(`✖ Tenant "${slug}" no encontrado`)
      process.exit(1)
    }
    console.log(`Tenant: ${tenant.nombre} (id=${tenant.id})  force=${force}  dry=${dry}\n`)

    const cats = await prisma.categoriaMenu.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, codigo: true, nombre: true, imagen: true },
      orderBy: { orden: 'asc' },
    })

    let actualizadas = 0, saltadas = 0, sinFoto = 0
    for (const c of cats) {
      const nueva = url(c.codigo)
      if (!nueva) {
        console.log(`  -  ${c.codigo.padEnd(12)} ${c.nombre}: sin imagen genérica para este código`)
        sinFoto++
        continue
      }
      if (c.imagen && !force) {
        console.log(`  ·  ${c.codigo.padEnd(12)} ${c.nombre}: ya tiene imagen, se salta`)
        saltadas++
        continue
      }
      if (!dry) {
        await prisma.categoriaMenu.update({ where: { id: c.id }, data: { imagen: nueva } })
      }
      console.log(`  ✔  ${c.codigo.padEnd(12)} ${c.nombre}: ${nueva}`)
      actualizadas++
    }

    console.log(`\n${dry ? '[DRY] ' : ''}Actualizadas: ${actualizadas} | Saltadas (ya tenían): ${saltadas} | Sin foto genérica: ${sinFoto}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
