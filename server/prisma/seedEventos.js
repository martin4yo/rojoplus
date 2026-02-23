import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seedEventos() {
  console.log('🎫 Seeding Eventos...')

  try {
    // Buscar admin para creador
    const admin = await prisma.admin.findFirst({
      where: { email: 'admin@rojoplus.com' }
    })

    if (!admin) {
      console.log('⚠️  No se encontró admin. Ejecutar seed.js primero.')
      return
    }

    // Buscar espacio deportivo (cancha de fútbol)
    const espacio = await prisma.espacioDeportivo.findFirst({
      where: {
        tipo: { contains: 'Fútbol', mode: 'insensitive' }
      }
    })

    // Buscar un partido futuro (opcional)
    const partido = await prisma.partido.findFirst({
      where: {
        fecha: { gte: new Date() },
        evento: null // Sin evento vinculado
      }
    })

    // 1. EVENTO DEPORTIVO - Partido de Fútbol
    console.log('  → Creando evento deportivo (Partido Fútbol)...')
    const eventoFutbol = await prisma.evento.upsert({
      where: { codigo: 'EVT-FUT-001' },
      update: {},
      create: {
        codigo: 'EVT-FUT-001',
        nombre: 'Partido de Fútbol - Local vs Visitante',
        descripcion: 'Partido amistoso de fútbol. Entrada general con descuento para socios.',
        tipo: 'DEPORTIVO',
        fecha: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días desde hoy
        hora: '15:00',
        horaApertura: '14:00',
        horaFin: '17:00',
        estado: 'PROGRAMADO',
        espacioId: espacio?.id,
        ubicacion: espacio ? null : 'Cancha Principal',
        capacidadTotal: 500,
        entradasVendidas: 0,
        entradasIngresadas: 0,
        permiteSobreventa: false,
        ventasHabilitadas: true,
        partidoId: partido?.id,
        imagen: null,
        creadoPor: admin.id
      }
    })

    // Categorías para evento de fútbol
    console.log('    - Categorías de entrada...')
    await prisma.categoriaEntrada.upsert({
      where: { id: 1 },
      update: {},
      create: {
        eventoId: eventoFutbol.id,
        nombre: 'General',
        descripcion: 'Entrada general para tribunas',
        precioSocio: 500,
        precioNoSocio: 1000,
        capacidad: 400,
        entradasVendidas: 0,
        activo: true,
        orden: 1
      }
    })

    await prisma.categoriaEntrada.upsert({
      where: { id: 2 },
      update: {},
      create: {
        eventoId: eventoFutbol.id,
        nombre: 'VIP',
        descripcion: 'Entrada VIP con acceso a palco',
        precioSocio: 1500,
        precioNoSocio: 2500,
        capacidad: 100,
        entradasVendidas: 0,
        activo: true,
        orden: 2
      }
    })

    // 2. EVENTO SOCIAL - Cena de Fin de Año
    console.log('  → Creando evento social (Cena)...')
    const eventoSocial = await prisma.evento.upsert({
      where: { codigo: 'EVT-SOC-001' },
      update: {},
      create: {
        codigo: 'EVT-SOC-001',
        nombre: 'Cena de Fin de Año',
        descripcion: 'Cena bailable para despedir el año con música en vivo y espectáculos.',
        tipo: 'SOCIAL',
        fecha: new Date(new Date().getFullYear(), 11, 28), // 28 de diciembre
        hora: '21:00',
        horaApertura: '20:30',
        horaFin: '03:00',
        estado: 'PROGRAMADO',
        espacioId: null,
        ubicacion: 'Salón Principal',
        capacidadTotal: 300,
        entradasVendidas: 0,
        entradasIngresadas: 0,
        permiteSobreventa: true, // Permite sobreventa para eventos sociales
        ventasHabilitadas: true,
        partidoId: null,
        imagen: null,
        creadoPor: admin.id
      }
    })

    // Categorías para evento social
    console.log('    - Categorías de entrada...')
    await prisma.categoriaEntrada.upsert({
      where: { id: 3 },
      update: {},
      create: {
        eventoId: eventoSocial.id,
        nombre: 'Individual',
        descripcion: 'Entrada individual para la cena',
        precioSocio: 8000,
        precioNoSocio: 12000,
        capacidad: null, // Ilimitado
        entradasVendidas: 0,
        activo: true,
        orden: 1
      }
    })

    await prisma.categoriaEntrada.upsert({
      where: { id: 4 },
      update: {},
      create: {
        eventoId: eventoSocial.id,
        nombre: 'Pareja',
        descripcion: 'Entrada para dos personas',
        precioSocio: 15000,
        precioNoSocio: 22000,
        capacidad: null,
        entradasVendidas: 0,
        activo: true,
        orden: 2
      }
    })

    await prisma.categoriaEntrada.upsert({
      where: { id: 5 },
      update: {},
      create: {
        eventoId: eventoSocial.id,
        nombre: 'Mesa VIP (10 pax)',
        descripcion: 'Mesa VIP para 10 personas con ubicación preferencial',
        precioSocio: 80000,
        precioNoSocio: 120000,
        capacidad: 10, // Solo 10 mesas VIP
        entradasVendidas: 0,
        activo: true,
        orden: 3
      }
    })

    // 3. EVENTO RECREATIVO - Día del Niño
    console.log('  → Creando evento recreativo (Día del Niño)...')
    const eventoRecreativo = await prisma.evento.upsert({
      where: { codigo: 'EVT-REC-001' },
      update: {},
      create: {
        codigo: 'EVT-REC-001',
        nombre: 'Día del Niño - Fiesta Infantil',
        descripcion: 'Jornada recreativa con juegos, inflables, shows y regalos para los más chicos.',
        tipo: 'RECREATIVO',
        fecha: new Date(new Date().getFullYear() + 1, 7, 10), // 10 de agosto del próximo año
        hora: '14:00',
        horaApertura: '13:30',
        horaFin: '19:00',
        estado: 'PROGRAMADO',
        espacioId: null,
        ubicacion: 'Parque Principal',
        capacidadTotal: 200,
        entradasVendidas: 0,
        entradasIngresadas: 0,
        permiteSobreventa: false,
        ventasHabilitadas: true,
        partidoId: null,
        imagen: null,
        creadoPor: admin.id
      }
    })

    // Categorías para evento recreativo
    console.log('    - Categorías de entrada...')
    await prisma.categoriaEntrada.upsert({
      where: { id: 6 },
      update: {},
      create: {
        eventoId: eventoRecreativo.id,
        nombre: 'Niños (hasta 12 años)',
        descripcion: 'Entrada para niños hasta 12 años',
        precioSocio: 0, // Gratis para socios
        precioNoSocio: 2000,
        capacidad: 150,
        entradasVendidas: 0,
        activo: true,
        orden: 1
      }
    })

    await prisma.categoriaEntrada.upsert({
      where: { id: 7 },
      update: {},
      create: {
        eventoId: eventoRecreativo.id,
        nombre: 'Adultos',
        descripcion: 'Entrada para adultos acompañantes',
        precioSocio: 500,
        precioNoSocio: 1500,
        capacidad: 50,
        entradasVendidas: 0,
        activo: true,
        orden: 2
      }
    })

    // 4. EVENTO PASADO - Para testing de reportes (finalizado)
    console.log('  → Creando evento pasado (finalizado)...')
    const eventoPasado = await prisma.evento.upsert({
      where: { codigo: 'EVT-FUT-PAST' },
      update: {},
      create: {
        codigo: 'EVT-FUT-PAST',
        nombre: 'Partido Amistoso - Pasado',
        descripcion: 'Evento pasado para testing de reportes',
        tipo: 'DEPORTIVO',
        fecha: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 días atrás
        hora: '18:00',
        horaApertura: '17:00',
        horaFin: '20:00',
        estado: 'FINALIZADO',
        espacioId: espacio?.id,
        ubicacion: espacio ? null : 'Cancha Auxiliar',
        capacidadTotal: 300,
        entradasVendidas: 250,
        entradasIngresadas: 230,
        permiteSobreventa: false,
        ventasHabilitadas: false,
        partidoId: null,
        imagen: null,
        creadoPor: admin.id
      }
    })

    await prisma.categoriaEntrada.upsert({
      where: { id: 8 },
      update: {},
      create: {
        eventoId: eventoPasado.id,
        nombre: 'General',
        descripcion: 'Entrada general',
        precioSocio: 300,
        precioNoSocio: 600,
        capacidad: 300,
        entradasVendidas: 250,
        activo: false,
        orden: 1
      }
    })

    console.log('✅ Eventos seed completado')
    console.log(`   - ${eventoFutbol.nombre} (${eventoFutbol.tipo})`)
    console.log(`   - ${eventoSocial.nombre} (${eventoSocial.tipo})`)
    console.log(`   - ${eventoRecreativo.nombre} (${eventoRecreativo.tipo})`)
    console.log(`   - ${eventoPasado.nombre} (${eventoPasado.tipo} - FINALIZADO)`)
  } catch (error) {
    console.error('❌ Error en seed de eventos:', error)
    throw error
  }
}

async function main() {
  await seedEventos()
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
