import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('=== VERIFICACIÓN MENÚ PARA ROL BUFFET ===\n')

  // 1. Buscar el rol buffet
  const rolBuffet = await prisma.rol.findFirst({
    where: {
      OR: [
        { codigo: 'buffet' },
        { codigo: 'BUFFET' },
        { nombre: { contains: 'Buffet', mode: 'insensitive' } }
      ]
    }
  })

  if (!rolBuffet) {
    console.log('❌ No se encontró el rol Buffet')
    await prisma.$disconnect()
    return
  }

  console.log(`Rol encontrado: ${rolBuffet.nombre} (ID: ${rolBuffet.id}, código: ${rolBuffet.codigo})`)
  console.log(`Es Super Admin: ${rolBuffet.esSuperAdmin}`)

  // 2. Buscar usuario ariel
  const ariel = await prisma.admin.findFirst({
    where: { email: { contains: 'ariel' } },
    include: { rol: true }
  })

  if (ariel) {
    console.log(`\nUsuario ariel: ${ariel.email}`)
    console.log(`Rol asignado: ${ariel.rol?.nombre} (ID: ${ariel.rolId})`)
  }

  // 3. Buscar items de menú asignados a este rol
  const menuItemsConRol = await prisma.menuItemRol.findMany({
    where: { rolId: rolBuffet.id },
    include: {
      menuItem: {
        select: { id: true, titulo: true, url: true, activo: true, parentId: true }
      }
    }
  })

  console.log(`\n=== ITEMS DE MENÚ ASIGNADOS AL ROL BUFFET ===`)
  console.log(`Total asignaciones: ${menuItemsConRol.length}`)

  if (menuItemsConRol.length === 0) {
    console.log('\n⚠️  El rol Buffet NO tiene ningún item de menú asignado!')
    console.log('   Debes asignar permisos en /admin/configuracion/menu')
  } else {
    console.log('\nItems asignados:')
    menuItemsConRol.forEach(mir => {
      const item = mir.menuItem
      console.log(`  - ${item.titulo} (${item.url || 'sin url'}) - activo: ${item.activo}, parentId: ${item.parentId}`)
    })
  }

  // 4. Simular el filtro del endpoint
  console.log('\n=== SIMULACIÓN DEL ENDPOINT GET /menu ===')

  const menuItems = await prisma.menuItem.findMany({
    where: {
      activo: true,
      parentId: null
    },
    include: {
      children: {
        where: { activo: true },
        include: {
          roles: { select: { rolId: true } }
        },
        orderBy: { orden: 'asc' }
      },
      roles: { select: { rolId: true } }
    },
    orderBy: { orden: 'asc' }
  })

  const userRoles = [rolBuffet.id]
  const esSuperAdmin = rolBuffet.esSuperAdmin

  function canAccess(item) {
    if (esSuperAdmin) return true
    if (item.soloSuperAdmin) return false
    const itemRoles = item.roles.map(r => r.rolId)
    if (itemRoles.length === 0) return false
    return userRoles.some(ur => itemRoles.includes(ur))
  }

  const filteredMenu = menuItems
    .filter(item => {
      // Si el padre tiene acceso directo
      if (canAccess(item)) return true
      // Si algún hijo tiene acceso
      if (item.children?.length > 0) {
        return item.children.some(child => canAccess(child))
      }
      return false
    })
    .map(item => ({
      ...item,
      children: item.children.filter(child => canAccess(child))
    }))
    .filter(item => item.url || (item.children && item.children.length > 0))

  console.log(`Items después del filtro: ${filteredMenu.length}`)

  if (filteredMenu.length > 0) {
    console.log('\nMenú resultante:')
    filteredMenu.forEach(item => {
      console.log(`  📁 ${item.titulo}`)
      if (item.children?.length > 0) {
        item.children.forEach(child => {
          console.log(`     └─ ${child.titulo}`)
        })
      }
    })
  } else {
    console.log('\n❌ El menú filtrado está VACÍO')
  }

  await prisma.$disconnect()
}

main().catch(e => {
  console.error('Error:', e)
  process.exit(1)
})
