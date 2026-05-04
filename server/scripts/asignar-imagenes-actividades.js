/**
 * =============================================================================
 * ASIGNAR IMÁGENES A ACTIVIDADES — asignar-imagenes-actividades.js
 * =============================================================================
 *
 * Asigna URLs de Unsplash a las actividades de un tenant que no tienen imagen,
 * usando keywords del nombre. Si una actividad ya tiene imagen, no la pisa
 * (a menos que se pase --forzar).
 *
 * USO:
 *   cd server
 *   node --env-file=.env scripts/asignar-imagenes-actividades.js --tenant <slug>            (dry-run)
 *   node --env-file=.env scripts/asignar-imagenes-actividades.js --tenant <slug> --apply
 *   node --env-file=.env scripts/asignar-imagenes-actividades.js --tenant <slug> --apply --forzar
 * =============================================================================
 */

import { PrismaClient } from '@prisma/client'
import { arg, resolveTenant } from './_lib/cli.js'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')
const FORZAR = process.argv.includes('--forzar')

// URLs estables de Unsplash. Si alguna no carga, el usuario puede editar la
// actividad desde la UI y subir/pegar otra URL.
const POR_KEYWORD = [
  // [regex sobre nombre normalizado, url]
  [/basquet|basket/i,                  'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&h=600&fit=crop'],
  [/futsal/i,                          'https://images.unsplash.com/photo-1551958219-acbc608c6377?w=800&h=600&fit=crop'],
  [/futbol.*escuelita|escuelita.*futbol|infantil/i,
                                       'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&h=600&fit=crop'],
  [/futbol|soccer/i,                   'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&h=600&fit=crop'],
  [/voley|voleibol|volleyball/i,       'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&h=600&fit=crop'],
  [/taekwondo|karate|judo|artes.*marc/i,
                                       'https://images.unsplash.com/photo-1555597673-b21d5c935865?w=800&h=600&fit=crop'],
  [/natacion|natación|swimming/i,      'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800&h=600&fit=crop'],
  [/tenis|tennis/i,                    'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&h=600&fit=crop'],
  [/handball|hand ?ball/i,             'https://images.unsplash.com/photo-1574270981066-86a4e1d2f5fb?w=800&h=600&fit=crop'],
  [/hockey/i,                          'https://images.unsplash.com/photo-1565992441121-4367c2967103?w=800&h=600&fit=crop'],
  [/rugby/i,                           'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&h=600&fit=crop'],
  [/gimnasia|fitness|gym/i,            'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800&h=600&fit=crop'],
  [/yoga|pilates/i,                    'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=800&h=600&fit=crop'],
  [/atletismo|running|carrera/i,       'https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?w=800&h=600&fit=crop'],
  [/ciclismo|bicicleta|bike/i,         'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&h=600&fit=crop'],
]

// Imagen genérica de "deporte" si ningún keyword matchea.
const FALLBACK = 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&h=600&fit=crop'

function elegirImagen(nombre) {
  const n = (nombre || '').trim()
  for (const [rx, url] of POR_KEYWORD) {
    if (rx.test(n)) return url
  }
  return FALLBACK
}

async function main() {
  const tenant = await resolveTenant(prisma, 'asignar-imagenes-actividades.js')
  console.log(`Tenant: ${tenant.slug} (id=${tenant.id})`)
  console.log(`Modo: ${APPLY ? 'APPLY (escribe cambios)' : 'DRY-RUN (sin escribir)'}`)
  console.log(`Forzar (sobrescribir las que ya tienen imagen): ${FORZAR}`)
  console.log('')

  const acts = await prisma.actividad.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, nombre: true, imagen: true },
    orderBy: { nombre: 'asc' },
  })

  let aActualizar = 0
  let yaConImagen = 0
  const updates = []

  for (const a of acts) {
    if (a.imagen && !FORZAR) {
      yaConImagen++
      console.log(`  [SKIP]  ${a.id} ${a.nombre.padEnd(30)} — ya tiene imagen`)
      continue
    }
    const url = elegirImagen(a.nombre)
    updates.push({ id: a.id, nombre: a.nombre, url, anterior: a.imagen })
    aActualizar++
    console.log(`  [SET]   ${a.id} ${a.nombre.padEnd(30)} → ${url}`)
  }

  console.log('')
  console.log('='.repeat(60))
  console.log(`Total actividades:        ${acts.length}`)
  console.log(`Ya con imagen (omitidas): ${yaConImagen}`)
  console.log(`A actualizar:             ${aActualizar}`)

  if (!APPLY) {
    console.log('\nDRY-RUN: re-ejecutar con --apply para aplicar.')
    return
  }
  if (updates.length === 0) {
    console.log('\nNo hay cambios para aplicar.')
    return
  }
  for (const u of updates) {
    await prisma.actividad.update({ where: { id: u.id }, data: { imagen: u.url } })
  }
  console.log(`\nActualizados: ${updates.length}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
