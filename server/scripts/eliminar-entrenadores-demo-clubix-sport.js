/**
 * One-shot: elimina los Entrenadores demo de clubix-sport que no tienen
 * entidadId (datos seed sin Entidad asociada). Borra también sus sesiones
 * y asignaciones a categorías para evitar FK errors.
 *
 * Uso: node server/scripts/eliminar-entrenadores-demo-clubix-sport.js
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { subdomain: 'clubix-sport' } })
  if (!tenant) throw new Error("Tenant 'clubix-sport' no existe")

  const huerfanos = await prisma.entrenador.findMany({
    where: { tenantId: tenant.id, entidadId: null },
    select: { id: true },
  })
  const ids = huerfanos.map(e => e.id)
  console.log(`Entrenadores sin entidad en clubix-sport: ${ids.length}`)
  if (ids.length === 0) return

  const cats = await prisma.entrenadorCategoria.deleteMany({ where: { entrenadorId: { in: ids } } })
  console.log(`  EntrenadorCategoria eliminadas: ${cats.count}`)

  const ses = await prisma.entrenadorSession.deleteMany({ where: { entrenadorId: { in: ids } } })
  console.log(`  EntrenadorSession eliminadas: ${ses.count}`)

  const r = await prisma.entrenador.deleteMany({ where: { id: { in: ids } } })
  console.log(`  Entrenador eliminados: ${r.count}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
