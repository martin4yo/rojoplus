import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createSuperAdmin() {
  try {
    console.log('🔐 Creando usuario Super Admin...\n');

    // Buscar o crear rol SUPER_ADMIN
    let superAdminRol = await prisma.rol.findUnique({
      where: { codigo: 'SUPER_ADMIN' }
    });

    if (!superAdminRol) {
      console.log('⚠️  Rol SUPER_ADMIN no existe, creándolo...');
      superAdminRol = await prisma.rol.create({
        data: {
          codigo: 'SUPER_ADMIN',
          nombre: 'Super Administrador',
          descripcion: 'Acceso total al sistema',
          esSuperAdmin: true,
          activo: true
        }
      });
      console.log('   ✓ Rol SUPER_ADMIN creado\n');
    }

    // Email y contraseña del nuevo admin
    const email = 'admin@sportivopilar.com.ar';
    const password = 'Sportivo2026!'; // Contraseña segura por defecto

    // Hashear contraseña
    const passwordHash = await bcrypt.hash(password, 10);

    // Crear o actualizar admin
    const admin = await prisma.admin.upsert({
      where: { email: email },
      update: {
        passwordHash: passwordHash,
        rolId: superAdminRol.id,
        activo: true,
        nombre: 'Administrador',
        apellido: 'Sportivo Pilar'
      },
      create: {
        email: email,
        passwordHash: passwordHash,
        nombre: 'Administrador',
        apellido: 'Sportivo Pilar',
        activo: true,
        rolId: superAdminRol.id
      }
    });

    console.log('✅ Usuario Super Admin creado/actualizado exitosamente!\n');
    console.log('📧 Email:', email);
    console.log('🔑 Contraseña:', password);
    console.log('\n⚠️  IMPORTANTE: Cambia esta contraseña después del primer login\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createSuperAdmin();
