/**
 * Setea porcentajeDescuento=100 en CategoriaSocio para las categorías que
 * no pagan cuota (VITALICIO, BECADO, INVITADO, EXTERNO).
 *
 * Uso:
 *   DATABASE_URL="..." node server/scripts/set-descuento-categorias.js --tenant sportivopilar
 *   DATABASE_URL="..." node server/scripts/set-descuento-categorias.js --tenant sportivopilar --apply
 *   DATABASE_URL="..." node server/scripts/set-descuento-categorias.js --tenant sportivopilar --apply --categorias VITALICIO,BECADO
 */
import { PrismaClient } from '@prisma/client'
import { arg, flag, resolveTenant } from './_lib/cli.js'

const prisma = new PrismaClient()

const DEFAULT_CATEGORIAS = ['VITALICIO', 'BECADO', 'INVITADO', 'EXTERNO']

async function main() {
  const tenant = await resolveTenant(prisma, 'set-descuento-categorias.js')
  const apply = flag('apply')
  const categoriasArg = arg('categorias')
  const objetivo = categoriasArg
    ? categoriasArg.split(',').map(s => s.trim().toUpperCase())
    : DEFAULT_CATEGORIAS

  console.log(`\nCategorías objetivo: ${objetivo.join(', ')}`)

  // Estado actual de TODAS las categorías del tenant
  const todas = await prisma.categoriaSocio.findMany({
    where: { tenantId: tenant.id },
    orderBy: { nombre: 'asc' },
  })

  console.log(`\nCategorias del tenant (${todas.length}):`)
  console.log(`  ${'id'.padEnd(5)} ${'nombre'.padEnd(25)} ${'codigo'.padEnd(20)} ${'desc%'.padStart(7)} ${'socios'.padStart(7)}`)
  for (const c of todas) {
    const cnt = await prisma.socio.count({ where: { tenantId: tenant.id, categoriaSocioId: c.id } })
    const flag = objetivo.some(o => c.nombre.toUpperCase() === o || c.codigo.toUpperCase() === o) ? ' ←' : ''
    console.log(`  ${String(c.id).padEnd(5)} ${c.nombre.padEnd(25)} ${(c.codigo ?? '').padEnd(20)} ${String(c.porcentajeDescuento ?? 0).padStart(7)} ${String(cnt).padStart(7)}${flag}`)
  }

  // Filtro de las que vamos a tocar
  const aActualizar = todas.filter(c =>
    objetivo.some(o => c.nombre.toUpperCase() === o || (c.codigo ?? '').toUpperCase() === o)
  )

  if (aActualizar.length === 0) {
    console.log(`\nNinguna categoría del tenant matchea con ${objetivo.join(', ')}. Nada que hacer.`)
    return
  }

  let totalSocios = 0
  for (const c of aActualizar) {
    totalSocios += await prisma.socio.count({ where: { tenantId: tenant.id, categoriaSocioId: c.id } })
  }

  console.log(`\nSe van a actualizar ${aActualizar.length} categorías → porcentajeDescuento=100`)
  console.log(`Impactará a ${totalSocios} socios (no van a recibir cargo de cuota social ni actividad).`)

  if (!apply) {
    console.log(`\nDry-run: no se modificó nada. Para aplicar: agregar --apply`)
    return
  }

  // Aplicar
  const r = await prisma.categoriaSocio.updateMany({
    where: { tenantId: tenant.id, id: { in: aActualizar.map(c => c.id) } },
    data: { porcentajeDescuento: 100 },
  })
  console.log(`\nActualizadas: ${r.count} categorías.`)

  console.log(`\nEstado final:`)
  for (const c of aActualizar) {
    const fresca = await prisma.categoriaSocio.findUnique({ where: { id: c.id } })
    console.log(`  id=${fresca.id} ${fresca.nombre} → desc=${fresca.porcentajeDescuento}%`)
  }
}

main()
  .catch(e => { console.error('ERROR:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
