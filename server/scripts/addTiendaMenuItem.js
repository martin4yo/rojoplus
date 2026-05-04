/**
 * Agrega el ítem de menú "Tienda" con sub-items.
 * Correr con: node server/scripts/addTiendaMenuItem.js
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const existente = await prisma.menuItem.findFirst({
    where: { titulo: 'Tienda', parentId: null },
  })

  if (existente) {
    console.log('⊗ Ítem "Tienda" ya existe (id:', existente.id, ')')
    return
  }

  const roles = await prisma.rol.findMany()

  const padre = await prisma.menuItem.create({
    data: {
      titulo: 'Tienda',
      icono: 'ShoppingBag',
      orden: 14,
      activo: true,
      roles: { create: roles.map(r => ({ rolId: r.id })) },
    },
  })
  console.log('✓ Ítem padre "Tienda" creado (id:', padre.id, ')')

  const hijos = [
    { titulo: 'Pedidos',       icono: 'Kanban',     url: '/admin/tienda/pedidos',       orden: 1 },
    { titulo: 'Productos',     icono: 'Tag',        url: '/admin/tienda/productos',     orden: 2 },
    { titulo: 'Estados',       icono: 'GitBranch',  url: '/admin/tienda/estados',       orden: 3 },
    { titulo: 'Configuración', icono: 'Settings',   url: '/admin/tienda/configuracion', orden: 4 },
  ]

  for (const hijo of hijos) {
    const creado = await prisma.menuItem.create({
      data: {
        ...hijo,
        parentId: padre.id,
        activo: true,
        roles: { create: roles.map(r => ({ rolId: r.id })) },
      },
    })
    console.log(`  ✓ Sub-ítem "${hijo.titulo}" creado (id: ${creado.id})`)
  }

  console.log('\n✅ Listo. Recargá el admin para ver el menú.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
