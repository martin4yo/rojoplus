import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding Eventos - Contabilidad...')

  // 1. Buscar o crear cuenta contable para eventos
  let cuentaEventos = await prisma.cuentaContable.findFirst({
    where: {
      OR: [
        { codigo: { contains: 'EVENTOS' } },
        { nombre: { contains: 'Eventos', mode: 'insensitive' } }
      ]
    }
  })

  if (!cuentaEventos) {
    console.log('Creando cuenta contable para eventos...')
    cuentaEventos = await prisma.cuentaContable.create({
      data: {
        codigo: '41.01.03',
        nombre: 'Ingresos por Eventos',
        tipo: 'INGRESO',
        nivel: 3,
        esImputable: true,
        activo: true,
        orden: 103
      }
    })
    console.log('✓ Cuenta contable creada:', cuentaEventos.codigo)
  } else {
    console.log('✓ Cuenta contable existente:', cuentaEventos.codigo)
  }

  // 2. Crear concepto de tesorería para eventos
  let conceptoEventos = await prisma.conceptoTesoreria.findFirst({
    where: {
      codigo: 'EVENTOS'
    }
  })

  if (!conceptoEventos) {
    console.log('Creando concepto de tesorería para eventos...')
    conceptoEventos = await prisma.conceptoTesoreria.create({
      data: {
        codigo: 'EVENTOS',
        nombre: 'Venta de Entradas a Eventos',
        descripcion: 'Ingresos por venta de entradas a eventos deportivos, sociales y recreativos',
        tipo: 'INGRESO',
        cuentaContableId: cuentaEventos.id,
        activo: true,
        usaEnTesoreria: true,
        usaEnVentas: true,
        orden: 100
      }
    })
    console.log('✓ Concepto de tesorería creado:', conceptoEventos.codigo)
  } else {
    console.log('✓ Concepto de tesorería existente:', conceptoEventos.codigo)
  }

  // 3. Crear centros de costo para eventos
  const centrosEventos = [
    {
      codigo: 'EVENTOS_DEPORTIVO',
      nombre: 'Eventos Deportivos',
      descripcion: 'Eventos relacionados con actividades deportivas'
    },
    {
      codigo: 'EVENTOS_SOCIAL',
      nombre: 'Eventos Sociales',
      descripcion: 'Eventos sociales y recreativos'
    },
    {
      codigo: 'EVENTOS_RECREATIVO',
      nombre: 'Eventos Recreativos',
      descripcion: 'Eventos de entretenimiento y recreación'
    }
  ]

  for (const centroData of centrosEventos) {
    let centro = await prisma.centroCosto.findFirst({
      where: { codigo: centroData.codigo }
    })

    if (!centro) {
      console.log(`Creando centro de costos: ${centroData.codigo}...`)
      centro = await prisma.centroCosto.create({
        data: {
          ...centroData,
          activo: true
        }
      })
      console.log('✓ Centro de costos creado:', centro.codigo)
    } else {
      console.log('✓ Centro de costos existente:', centro.codigo)
    }
  }

  console.log('\n✅ Seed de Eventos - Contabilidad completado!')
}

main()
  .catch((e) => {
    console.error('Error en seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
