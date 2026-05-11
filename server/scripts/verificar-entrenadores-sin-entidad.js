import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const huerfanos = await p.entrenador.findMany({
  where: { entidadId: null },
  select: { id: true, tenantId: true, nombre: true, apellido: true },
})
console.log(`Entrenadores sin entidadId (todos los tenants): ${huerfanos.length}`)
huerfanos.forEach(h => console.log(`  tenant=${h.tenantId} id=${h.id} ${h.nombre || ''} ${h.apellido || ''}`))
await p.$disconnect()
