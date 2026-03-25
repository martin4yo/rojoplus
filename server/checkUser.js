import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkUser() {
  try {
    const user = await prisma.admin.findFirst({
      where: { email: 'admin@sportivo.com.ar' },
      include: {
        rol: {
          include: {
            permisos: true
          }
        }
      }
    });

    console.log('=== USUARIO ===');
    if (user === null) {
      console.log('❌ Usuario NO encontrado');
    } else {
      console.log('✅ Email:', user.email);
      console.log('✅ Rol:', user.rol ? user.rol.nombre : 'SIN ROL');
      console.log('✅ Es Super Admin:', user.rol?.esSuperAdmin);
      console.log('✅ Permisos del rol:', user.rol?.permisos?.length || 0);
    }

    console.log('\n=== MENÚ ===');
    const menuItems = await prisma.menuItem.findMany({
      where: { parentId: null }
    });
    console.log('Items principales:', menuItems.length);

    if (user && user.rol && menuItems.length > 0) {
      console.log('\n=== PERMISOS DE MENÚ ===');
      const itemsConPermiso = await prisma.menuItemRol.findMany({
        where: {
          rolId: user.rol.id
        },
        include: {
          menuItem: true
        }
      });
      console.log('Items con acceso:', itemsConPermiso.length);
      if (itemsConPermiso.length > 0) {
        console.log('Ejemplos:');
        itemsConPermiso.slice(0, 5).forEach(item => {
          console.log('  -', item.menuItem.titulo);
        });
      }
    }

    await prisma.$disconnect();
  } catch (err) {
    console.error('Error:', err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkUser();
