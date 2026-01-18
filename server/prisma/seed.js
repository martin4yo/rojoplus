import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ============================================================================
// DATOS DE SEEDS
// ============================================================================

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

const tiposCuota = [
  { codigo: 'SOCIAL', nombre: 'Cuota Social', descripcion: 'Cuota de membresía del club' },
  { codigo: 'DEPORTIVA', nombre: 'Cuota Deportiva', descripcion: 'Cuota por actividad deportiva' },
];

const mediosPago = [
  { codigo: 'EFECTIVO', nombre: 'Efectivo', tipo: 'EFECTIVO', orden: 1 },
  { codigo: 'TRANSFERENCIA', nombre: 'Transferencia Bancaria', tipo: 'BANCO', requiereDatosBanco: true, orden: 2 },
  { codigo: 'DEBITO', nombre: 'Tarjeta de Débito', tipo: 'TARJETA', orden: 3 },
  { codigo: 'CREDITO', nombre: 'Tarjeta de Crédito', tipo: 'TARJETA', orden: 4 },
  { codigo: 'MERCADOPAGO', nombre: 'MercadoPago', tipo: 'VIRTUAL', orden: 5 },
  { codigo: 'MODO', nombre: 'MODO', tipo: 'VIRTUAL', orden: 6 },
  { codigo: 'DEBITO_AUTO', nombre: 'Débito Automático', tipo: 'BANCO', orden: 7 },
  { codigo: 'COBRADOR', nombre: 'Cobrador', tipo: 'COBRADOR', orden: 8 },
];

const deportes = [
  { codigo: 'FUT', nombre: 'Fútbol', orden: 1 },
  { codigo: 'BAS', nombre: 'Básquet', orden: 2 },
  { codigo: 'VOL', nombre: 'Vóley', orden: 3 },
  { codigo: 'NAT', nombre: 'Natación', orden: 4 },
  { codigo: 'HOC', nombre: 'Hockey', orden: 5 },
  { codigo: 'TEN', nombre: 'Tenis', orden: 6 },
  { codigo: 'PAD', nombre: 'Paddle', orden: 7 },
  { codigo: 'GIM', nombre: 'Gimnasia', orden: 8 },
];

const roles = [
  { codigo: 'SUPER_ADMIN', nombre: 'Super Administrador', descripcion: 'Acceso total al sistema', esSuperAdmin: true },
  { codigo: 'ADMIN', nombre: 'Administrador', descripcion: 'Administración general' },
  { codigo: 'TESORERO', nombre: 'Tesorero', descripcion: 'Gestión de caja y pagos' },
  { codigo: 'SECRETARIO', nombre: 'Secretario', descripcion: 'Gestión de socios y actividades' },
  { codigo: 'CONSULTA', nombre: 'Consulta', descripcion: 'Solo lectura' },
];

const permisos = [
  // Socios
  { codigo: 'SOCIOS_VER', nombre: 'Ver Socios', modulo: 'SOCIOS' },
  { codigo: 'SOCIOS_CREAR', nombre: 'Crear Socios', modulo: 'SOCIOS' },
  { codigo: 'SOCIOS_EDITAR', nombre: 'Editar Socios', modulo: 'SOCIOS' },
  { codigo: 'SOCIOS_ELIMINAR', nombre: 'Eliminar Socios', modulo: 'SOCIOS' },
  // Actividades
  { codigo: 'ACTIVIDADES_VER', nombre: 'Ver Actividades', modulo: 'ACTIVIDADES' },
  { codigo: 'ACTIVIDADES_GESTIONAR', nombre: 'Gestionar Actividades', modulo: 'ACTIVIDADES' },
  // Cuotas
  { codigo: 'CUOTAS_VER', nombre: 'Ver Cuotas', modulo: 'CUOTAS' },
  { codigo: 'CUOTAS_GENERAR', nombre: 'Generar Cuotas', modulo: 'CUOTAS' },
  { codigo: 'CUOTAS_BONIFICAR', nombre: 'Bonificar Cuotas', modulo: 'CUOTAS' },
  // Caja
  { codigo: 'CAJA_VER', nombre: 'Ver Caja', modulo: 'CAJA' },
  { codigo: 'CAJA_COBRAR', nombre: 'Registrar Cobros', modulo: 'CAJA' },
  { codigo: 'CAJA_MOVIMIENTOS', nombre: 'Registrar Movimientos', modulo: 'CAJA' },
  { codigo: 'CAJA_ANULAR', nombre: 'Anular Movimientos', modulo: 'CAJA' },
  // Reportes
  { codigo: 'REPORTES_VER', nombre: 'Ver Reportes', modulo: 'REPORTES' },
  { codigo: 'REPORTES_EXPORTAR', nombre: 'Exportar Reportes', modulo: 'REPORTES' },
  // Configuración
  { codigo: 'CONFIG_VER', nombre: 'Ver Configuración', modulo: 'CONFIG' },
  { codigo: 'CONFIG_EDITAR', nombre: 'Editar Configuración', modulo: 'CONFIG' },
  // Sistema
  { codigo: 'USUARIOS_GESTIONAR', nombre: 'Gestionar Usuarios', modulo: 'SISTEMA' },
  { codigo: 'COMERCIOS_GESTIONAR', nombre: 'Gestionar Comercios', modulo: 'SISTEMA' },
];

const cuentasContables = [
  // Ingresos
  { codigo: '4', nombre: 'INGRESOS', tipo: 'INGRESO', nivel: 1, esImputable: false },
  { codigo: '4.1', nombre: 'Ingresos por Cuotas', tipo: 'INGRESO', nivel: 2, esImputable: false, padreCodigo: '4' },
  { codigo: '4.1.01', nombre: 'Cuota Social', tipo: 'INGRESO', nivel: 3, esImputable: true, padreCodigo: '4.1' },
  { codigo: '4.1.02', nombre: 'Cuota Deportiva', tipo: 'INGRESO', nivel: 3, esImputable: true, padreCodigo: '4.1' },
  { codigo: '4.2', nombre: 'Otros Ingresos', tipo: 'INGRESO', nivel: 2, esImputable: false, padreCodigo: '4' },
  { codigo: '4.2.01', nombre: 'Eventos', tipo: 'INGRESO', nivel: 3, esImputable: true, padreCodigo: '4.2' },
  { codigo: '4.2.02', nombre: 'Alquiler Instalaciones', tipo: 'INGRESO', nivel: 3, esImputable: true, padreCodigo: '4.2' },
  { codigo: '4.2.99', nombre: 'Otros Ingresos', tipo: 'INGRESO', nivel: 3, esImputable: true, padreCodigo: '4.2' },

  // Egresos
  { codigo: '5', nombre: 'EGRESOS', tipo: 'EGRESO', nivel: 1, esImputable: false },
  { codigo: '5.1', nombre: 'Gastos de Personal', tipo: 'EGRESO', nivel: 2, esImputable: false, padreCodigo: '5' },
  { codigo: '5.1.01', nombre: 'Sueldos', tipo: 'EGRESO', nivel: 3, esImputable: true, padreCodigo: '5.1' },
  { codigo: '5.1.02', nombre: 'Cargas Sociales', tipo: 'EGRESO', nivel: 3, esImputable: true, padreCodigo: '5.1' },
  { codigo: '5.2', nombre: 'Gastos Operativos', tipo: 'EGRESO', nivel: 2, esImputable: false, padreCodigo: '5' },
  { codigo: '5.2.01', nombre: 'Servicios (Luz, Gas, Agua)', tipo: 'EGRESO', nivel: 3, esImputable: true, padreCodigo: '5.2' },
  { codigo: '5.2.02', nombre: 'Mantenimiento', tipo: 'EGRESO', nivel: 3, esImputable: true, padreCodigo: '5.2' },
  { codigo: '5.2.03', nombre: 'Limpieza', tipo: 'EGRESO', nivel: 3, esImputable: true, padreCodigo: '5.2' },
  { codigo: '5.3', nombre: 'Gastos Deportivos', tipo: 'EGRESO', nivel: 2, esImputable: false, padreCodigo: '5' },
  { codigo: '5.3.01', nombre: 'Equipamiento', tipo: 'EGRESO', nivel: 3, esImputable: true, padreCodigo: '5.3' },
  { codigo: '5.3.02', nombre: 'Indumentaria', tipo: 'EGRESO', nivel: 3, esImputable: true, padreCodigo: '5.3' },
  { codigo: '5.3.03', nombre: 'Traslados', tipo: 'EGRESO', nivel: 3, esImputable: true, padreCodigo: '5.3' },
  { codigo: '5.9', nombre: 'Otros Egresos', tipo: 'EGRESO', nivel: 2, esImputable: false, padreCodigo: '5' },
  { codigo: '5.9.99', nombre: 'Gastos Varios', tipo: 'EGRESO', nivel: 3, esImputable: true, padreCodigo: '5.9' },
];

const configuracionDebito = [
  {
    codigo: 'PRISMA',
    nombre: 'Prisma Medios de Pago',
    tipo: 'PROCESADOR',
    plataforma: 'PRISMA',
    formatoArchivo: 'TXT',
  },
  {
    codigo: 'PAYWAY',
    nombre: 'Payway',
    tipo: 'PROCESADOR',
    plataforma: 'PAYWAY',
    formatoArchivo: 'CSV',
  },
];

const configuracion = [
  // General
  { clave: 'CLUB_NOMBRE', valor: 'Club Sportivo Pilar', tipo: 'STRING', modulo: 'GENERAL', descripcion: 'Nombre del club' },
  { clave: 'CLUB_NOMBRE_CORTO', valor: 'CSP', tipo: 'STRING', modulo: 'GENERAL', descripcion: 'Siglas del club' },
  { clave: 'CLUB_SLOGAN', valor: 'El Rojo de la Avenida', tipo: 'STRING', modulo: 'GENERAL', descripcion: 'Slogan del club' },
  { clave: 'CLUB_CUIT', valor: '', tipo: 'STRING', modulo: 'GENERAL', descripcion: 'CUIT del club' },
  { clave: 'CLUB_DIRECCION', valor: '', tipo: 'STRING', modulo: 'GENERAL', descripcion: 'Dirección física' },
  { clave: 'CLUB_TELEFONO', valor: '', tipo: 'STRING', modulo: 'GENERAL', descripcion: 'Teléfono de contacto' },
  { clave: 'CLUB_EMAIL', valor: 'info@clubsportivopilar.com', tipo: 'STRING', modulo: 'GENERAL', descripcion: 'Email de contacto' },
  { clave: 'CLUB_WHATSAPP', valor: '', tipo: 'STRING', modulo: 'GENERAL', descripcion: 'WhatsApp' },

  // Branding
  { clave: 'COLOR_PRIMARIO', valor: '#DC2626', tipo: 'STRING', modulo: 'BRANDING', descripcion: 'Color primario' },
  { clave: 'COLOR_PRIMARIO_HOVER', valor: '#B91C1C', tipo: 'STRING', modulo: 'BRANDING', descripcion: 'Color primario hover' },
  { clave: 'COLOR_SECUNDARIO', valor: '#1F2937', tipo: 'STRING', modulo: 'BRANDING', descripcion: 'Color secundario' },
  { clave: 'COLOR_FONDO', valor: '#F9FAFB', tipo: 'STRING', modulo: 'BRANDING', descripcion: 'Color de fondo' },
  { clave: 'CLUB_LOGO_URL', valor: '/images/logo.png', tipo: 'IMAGE', modulo: 'BRANDING', descripcion: 'Logo principal' },

  // Redes Sociales
  { clave: 'SOCIAL_FACEBOOK', valor: '', tipo: 'STRING', modulo: 'BRANDING', descripcion: 'URL de Facebook' },
  { clave: 'SOCIAL_INSTAGRAM', valor: '', tipo: 'STRING', modulo: 'BRANDING', descripcion: 'URL de Instagram' },
  { clave: 'SOCIAL_TWITTER', valor: '', tipo: 'STRING', modulo: 'BRANDING', descripcion: 'URL de Twitter/X' },

  // Cuotas
  { clave: 'CUOTA_SOCIAL_INDIVIDUAL', valor: '15000', tipo: 'NUMBER', modulo: 'CUOTAS', descripcion: 'Monto cuota social individual' },
  { clave: 'CUOTA_SOCIAL_FAMILIAR', valor: '20000', tipo: 'NUMBER', modulo: 'CUOTAS', descripcion: 'Monto cuota social familiar' },
  { clave: 'CUOTA_DIA_VENCIMIENTO', valor: '10', tipo: 'NUMBER', modulo: 'CUOTAS', descripcion: 'Día de vencimiento de cuotas' },

  // Pagos Online
  { clave: 'PAGOS_MP_HABILITADO', valor: 'false', tipo: 'BOOLEAN', modulo: 'PORTAL', descripcion: 'MercadoPago habilitado' },
  { clave: 'PAGOS_MODO_HABILITADO', valor: 'false', tipo: 'BOOLEAN', modulo: 'PORTAL', descripcion: 'MODO habilitado' },

  // RojoPlus (comercios)
  { clave: 'DESCUENTO_DEFAULT', valor: '10', tipo: 'NUMBER', modulo: 'COMERCIOS', descripcion: 'Descuento sugerido para nuevos comercios' },
  { clave: 'SLOGAN_APP', valor: 'Rojo Plus convierte la pasión en consumo', tipo: 'STRING', modulo: 'COMERCIOS', descripcion: 'Slogan de RojoPlus' },
];

// ============================================================================
// FUNCIONES DE SEED
// ============================================================================

async function main() {
  console.log('🌱 Iniciando seed...\n');

  // Rubros
  console.log('📁 Creando rubros...');
  for (const rubro of rubros) {
    await prisma.rubro.upsert({
      where: { id: rubro.orden },
      update: rubro,
      create: rubro,
    });
  }
  console.log(`   ✓ ${rubros.length} rubros creados`);

  // Tipos de Cuota
  console.log('💰 Creando tipos de cuota...');
  for (const tipo of tiposCuota) {
    await prisma.tipoCuota.upsert({
      where: { codigo: tipo.codigo },
      update: tipo,
      create: tipo,
    });
  }
  console.log(`   ✓ ${tiposCuota.length} tipos de cuota creados`);

  // Medios de Pago
  console.log('💳 Creando medios de pago...');
  for (const medio of mediosPago) {
    await prisma.medioPago.upsert({
      where: { codigo: medio.codigo },
      update: medio,
      create: medio,
    });
  }
  console.log(`   ✓ ${mediosPago.length} medios de pago creados`);

  // Deportes
  console.log('⚽ Creando deportes...');
  for (const deporte of deportes) {
    await prisma.deporte.upsert({
      where: { codigo: deporte.codigo },
      update: deporte,
      create: deporte,
    });
  }
  console.log(`   ✓ ${deportes.length} deportes creados`);

  // Roles
  console.log('👥 Creando roles...');
  for (const rol of roles) {
    await prisma.rol.upsert({
      where: { codigo: rol.codigo },
      update: rol,
      create: rol,
    });
  }
  console.log(`   ✓ ${roles.length} roles creados`);

  // Permisos
  console.log('🔐 Creando permisos...');
  for (const permiso of permisos) {
    await prisma.permiso.upsert({
      where: { codigo: permiso.codigo },
      update: permiso,
      create: permiso,
    });
  }
  console.log(`   ✓ ${permisos.length} permisos creados`);

  // Asignar todos los permisos al rol SUPER_ADMIN
  console.log('🔗 Asignando permisos a Super Admin...');
  const superAdminRol = await prisma.rol.findUnique({ where: { codigo: 'SUPER_ADMIN' } });
  const todosPermisos = await prisma.permiso.findMany();
  for (const permiso of todosPermisos) {
    await prisma.permisoRol.upsert({
      where: { rolId_permisoId: { rolId: superAdminRol.id, permisoId: permiso.id } },
      update: {},
      create: { rolId: superAdminRol.id, permisoId: permiso.id },
    });
  }
  console.log(`   ✓ ${todosPermisos.length} permisos asignados a Super Admin`);

  // Cuentas Contables
  console.log('📊 Creando plan de cuentas...');
  // Primero las cuentas raíz (sin padre)
  for (const cuenta of cuentasContables.filter(c => !c.padreCodigo)) {
    await prisma.cuentaContable.upsert({
      where: { codigo: cuenta.codigo },
      update: { nombre: cuenta.nombre, tipo: cuenta.tipo, nivel: cuenta.nivel, esImputable: cuenta.esImputable },
      create: { codigo: cuenta.codigo, nombre: cuenta.nombre, tipo: cuenta.tipo, nivel: cuenta.nivel, esImputable: cuenta.esImputable },
    });
  }
  // Luego las que tienen padre
  for (const cuenta of cuentasContables.filter(c => c.padreCodigo)) {
    const padre = await prisma.cuentaContable.findUnique({ where: { codigo: cuenta.padreCodigo } });
    await prisma.cuentaContable.upsert({
      where: { codigo: cuenta.codigo },
      update: { nombre: cuenta.nombre, tipo: cuenta.tipo, nivel: cuenta.nivel, esImputable: cuenta.esImputable, padreId: padre?.id },
      create: { codigo: cuenta.codigo, nombre: cuenta.nombre, tipo: cuenta.tipo, nivel: cuenta.nivel, esImputable: cuenta.esImputable, padreId: padre?.id },
    });
  }
  console.log(`   ✓ ${cuentasContables.length} cuentas contables creadas`);

  // Configuración de Débito
  console.log('🏦 Creando configuración de débito...');
  for (const config of configuracionDebito) {
    await prisma.configuracionDebito.upsert({
      where: { codigo: config.codigo },
      update: config,
      create: config,
    });
  }
  console.log(`   ✓ ${configuracionDebito.length} configuraciones de débito creadas`);

  // Configuración General
  console.log('⚙️  Creando configuración general...');
  for (const config of configuracion) {
    await prisma.configuracion.upsert({
      where: { clave: config.clave },
      update: { valor: config.valor, tipo: config.tipo, descripcion: config.descripcion, modulo: config.modulo },
      create: config,
    });
  }
  console.log(`   ✓ ${configuracion.length} configuraciones creadas`);

  // Admin inicial con rol Super Admin
  console.log('👤 Creando admin inicial...');
  const passwordHash = await bcrypt.hash('admin123', 10);
  await prisma.admin.upsert({
    where: { email: 'admin@rojoplus.com' },
    update: { rolId: superAdminRol.id },
    create: {
      email: 'admin@rojoplus.com',
      passwordHash: passwordHash,
      nombre: 'Administrador',
      apellido: 'Sistema',
      activo: true,
      rolId: superAdminRol.id,
    },
  });
  console.log('   ✓ Admin creado: admin@rojoplus.com / admin123');

  // Caja principal
  console.log('💵 Creando caja principal...');
  await prisma.caja.upsert({
    where: { codigo: 'CAJA-PRINCIPAL' },
    update: {},
    create: {
      codigo: 'CAJA-PRINCIPAL',
      nombre: 'Caja Principal',
      tipo: 'EFECTIVO',
      descripcion: 'Caja de efectivo principal del club',
      saldoInicial: 0,
      saldoActual: 0,
    },
  });
  console.log('   ✓ Caja principal creada');

  console.log('\n✅ Seed completado exitosamente!');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
