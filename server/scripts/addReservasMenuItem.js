/**
 * Agrega el ítem de menú "Reservas" a la base de datos.
 * Correr con: node server/scripts/addReservasMenuItem.js
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Verificar si ya existe
  const existente = await prisma.menuItem.findFirst({
    where: { titulo: 'Reservas', parentId: null },
  })

  if (existente) {
    console.log('⊗ Ítem "Reservas" ya existe (id:', existente.id, ')')
    return
  }

  // Obtener todos los roles para asignar al nuevo ítem
  const roles = await prisma.rol.findMany()

  // Crear ítem padre
  const padre = await prisma.menuItem.create({
    data: {
      titulo: 'Reservas',
      icono: 'CalendarDays',
      orden: 13,
      activo: true,
      roles: {
        create: roles.map(r => ({ rolId: r.id })),
      },
    },
  })
  console.log('✓ Ítem padre "Reservas" creado (id:', padre.id, ')')

  // Crear hijos
  const hijos = [
    { titulo: 'Calendario', icono: 'CalendarDays', url: '/admin/reservas', orden: 1 },
    { titulo: 'Configuración', icono: 'Settings', url: '/admin/reservas/config', orden: 2 },
  ]

  for (const hijo of hijos) {
    const creado = await prisma.menuItem.create({
      data: {
        ...hijo,
        parentId: padre.id,
        activo: true,
        roles: {
          create: roles.map(r => ({ rolId: r.id })),
        },
      },
    })
    console.log(`  ✓ Sub-ítem "${hijo.titulo}" creado (id: ${creado.id})`)
  }

  console.log('\n✅ Listo. Recargá el admin para ver el menú actualizado.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
