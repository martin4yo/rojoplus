import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const rubros = [
  { nombre: 'Gastronomía', orden: 1 },
  { nombre: 'Indumentaria', orden: 2 },
  { nombre: 'Farmacia', orden: 3 },
  { nombre: 'Librería', orden: 4 },
  { nombre: 'Supermercado/Almacén', orden: 5 },
  { nombre: 'Ferretería', orden: 6 },
  { nombre: 'Electrónica', orden: 7 },
  { nombre: 'Servicios Profesionales', orden: 8 },
  { nombre: 'Belleza y Estética', orden: 9 },
  { nombre: 'Deportes', orden: 10 },
  { nombre: 'Automotor', orden: 11 },
  { nombre: 'Hogar y Decoración', orden: 12 },
  { nombre: 'Salud', orden: 13 },
  { nombre: 'Educación', orden: 14 },
  { nombre: 'Otros', orden: 99 },
];

const configuracion = [
  { clave: 'descuento_default', valor: '10', descripcion: 'Porcentaje de descuento sugerido para nuevos comercios' },
  { clave: 'nombre_club', valor: 'Club Sportivo Pilar', descripcion: 'Nombre del club' },
  { clave: 'slogan', valor: 'El Rojo de la Avenida', descripcion: 'Slogan del club' },
  { clave: 'slogan_app', valor: 'Rojo Plus convierte la pasión en consumo', descripcion: 'Slogan de la app' },
  { clave: 'email_notificaciones', valor: 'admin@clubsportivopilar.com', descripcion: 'Email para notificaciones' },
];

async function main() {
  console.log('🌱 Iniciando seed...');

  // Crear rubros
  console.log('📁 Creando rubros...');
  for (const rubro of rubros) {
    await prisma.rubro.upsert({
      where: { id: rubro.orden },
      update: rubro,
      create: rubro,
    });
  }
  console.log(`   ✓ ${rubros.length} rubros creados`);

  // Crear configuración
  console.log('⚙️  Creando configuración...');
  for (const config of configuracion) {
    await prisma.configuracion.upsert({
      where: { clave: config.clave },
      update: { valor: config.valor, descripcion: config.descripcion },
      create: config,
    });
  }
  console.log(`   ✓ ${configuracion.length} configuraciones creadas`);

  // Crear admin inicial
  console.log('👤 Creando admin inicial...');
  const passwordHash = await bcrypt.hash('admin123', 10);
  await prisma.admin.upsert({
    where: { email: 'admin@rojoplus.com' },
    update: {},
    create: {
      email: 'admin@rojoplus.com',
      passwordHash: passwordHash,
      nombre: 'Administrador',
      activo: true,
    },
  });
  console.log('   ✓ Admin creado: admin@rojoplus.com / admin123');

  console.log('');
  console.log('✅ Seed completado!');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
