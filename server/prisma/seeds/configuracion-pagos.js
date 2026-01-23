import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seedConfiguracionPagos() {
  console.log('🔧 Seeding configuración de pagos...')

  const configuraciones = [
    {
      clave: 'PAGO_CBU',
      valor: '0000000000000000000000', // Reemplazar con CBU real
      descripcion: 'CBU para transferencias bancarias',
      modulo: 'PAGOS',
      tipo: 'STRING',
      editable: true,
    },
    {
      clave: 'PAGO_ALIAS',
      valor: 'sportivo.pilar', // Reemplazar con alias real
      descripcion: 'Alias para transferencias bancarias',
      modulo: 'PAGOS',
      tipo: 'STRING',
      editable: true,
    },
    {
      clave: 'PAGO_TELEFONO',
      valor: '+54 9 11 0000-0000', // Reemplazar con teléfono real
      descripcion: 'Teléfono/WhatsApp para enviar comprobantes de pago',
      modulo: 'PAGOS',
      tipo: 'STRING',
      editable: true,
    },
    {
      clave: 'PAGO_TITULAR',
      valor: 'Club Sportivo Pilar',
      descripcion: 'Titular de la cuenta bancaria',
      modulo: 'PAGOS',
      tipo: 'STRING',
      editable: true,
    },
  ]

  for (const config of configuraciones) {
    await prisma.configuracion.upsert({
      where: { clave: config.clave },
      update: {
        descripcion: config.descripcion,
        modulo: config.modulo,
        tipo: config.tipo,
        editable: config.editable,
      },
      create: config,
    })
    console.log(`  ✅ ${config.clave} configurado`)
  }

  console.log('✅ Configuración de pagos completada\n')
}

// Ejecutar
seedConfiguracionPagos()
  .then(() => {
    console.log('Seed completado')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Error en seed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
