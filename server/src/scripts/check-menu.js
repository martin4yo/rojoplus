import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('=== VERIFICACIÓN DE MENÚ ===\n')

  // 1. Contar items de menú
  const menuCount = await prisma.menuItem.count()
  console.log(`Total items en menu_items: ${menuCount}`)

  if (menuCount === 0) {
    console.log('\n⚠️  La tabla menu_items está VACÍA. Ejecuta el seed primero.')
    console.log('   Puedes hacerlo desde el frontend en /admin/configuracion/menu o llamando a POST /api/admin/menu/seed')
    await prisma.$disconnect()
    return
  }

  // 2. Mostrar algunos items
  const items = await prisma.menuItem.findMany({
    where: { parentId: null },
    take: 5,
    orderBy: { orden: 'asc' }
  })
  console.log('\nPrimeros 5 items padres:')
  items.forEach(item => {
    console.log(`  - ${item.titulo} (url: ${item.url || 'sin url'}, activo: ${item.activo})`)
  })

  // 3. Verificar admin
  const admin = await prisma.admin.findFirst({
    where: { email: 'admin@rojoplus.com' },
    include: {
      rol: {
        select: { id: true, nombre: true, codigo: true, esSuperAdmin: true }
      }
    }
  })

  console.log('\n=== ADMIN ===')
  if (admin) {
    console.log(`Email: ${admin.email}`)
    console.log(`Rol ID: ${admin.rolId}`)
    if (admin.rol) {
      console.log(`Rol: ${admin.rol.nombre} (${admin.rol.codigo})`)
      console.log(`Es Super Admin: ${admin.rol.esSuperAdmin}`)
    } else {
      console.log('⚠️  Admin no tiene rol asignado!')
    }
  } else {
    console.log('⚠️  No se encontró el admin admin@rojoplus.com')
  }

  // 4. Verificar todos los roles
  const roles = await prisma.rol.findMany({
    select: { id: true, nombre: true, codigo: true, esSuperAdmin: true, activo: true }
  })
  console.log('\n=== ROLES ===')
  roles.forEach(rol => {
    console.log(`  ${rol.id}: ${rol.nombre} (${rol.codigo}) - SuperAdmin: ${rol.esSuperAdmin}, Activo: ${rol.activo}`)
  })

  await prisma.$disconnect()
  console.log('\n✅ Verificación completada')
}

main().catch(e => {
  console.error('Error:', e)
  process.exit(1)
})
