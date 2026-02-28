import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Simular lo que hace el endpoint GET /api/admin/menu

  // 1. Verificar que hay items
  const count = await prisma.menuItem.count();
  console.log('Total items en BD:', count);

  // 2. Obtener admin
  const admin = await prisma.admin.findFirst({
    where: { email: 'admin@rojoplus.com' },
    include: { rol: true }
  });

  console.log('\nAdmin:', admin?.email);
  console.log('Rol ID:', admin?.rolId);
  console.log('Es Super Admin:', admin?.rol?.esSuperAdmin);

  // 3. Simular query del endpoint
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
  });

  console.log('\nItems padres encontrados:', menuItems.length);

  // 4. Verificar el filtro canAccess para Super Admin
  const esSuperAdmin = admin?.rol?.esSuperAdmin || false;

  function canAccess(item) {
    if (esSuperAdmin) return true;
    if (item.soloSuperAdmin) return false;
    const itemRoles = item.roles.map(r => r.rolId);
    if (itemRoles.length === 0) return false;
    return false; // No tiene rol asignado
  }

  const filtered = menuItems.filter(item => canAccess(item));
  console.log('Items después de filtro:', filtered.length);

  if (filtered.length > 0) {
    console.log('\nPrimeros 3 items:');
    filtered.slice(0, 3).forEach(item => {
      console.log(`  - ${item.titulo} (${item.url || 'sin url'})`);
    });
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
