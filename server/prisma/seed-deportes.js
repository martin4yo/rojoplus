import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ============================================================================
// TIPOS DE ESPACIO
// ============================================================================

const tiposEspacio = [
  { codigo: 'CANCHA_FUTBOL_11', nombre: 'Cancha de Futbol 11', descripcion: 'Cancha reglamentaria de futbol 11', orden: 1 },
  { codigo: 'CANCHA_FUTBOL_7', nombre: 'Cancha de Futbol 7', descripcion: 'Cancha de futbol 7', orden: 2 },
  { codigo: 'CANCHA_FUTBOL_5', nombre: 'Cancha de Futbol 5', descripcion: 'Cancha de futbol 5 / futsal', orden: 3 },
  { codigo: 'GIMNASIO', nombre: 'Gimnasio', descripcion: 'Gimnasio cubierto para basquet, voley, etc.', orden: 4 },
  { codigo: 'PILETA', nombre: 'Pileta', descripcion: 'Pileta de natacion', orden: 5 },
  { codigo: 'SALON', nombre: 'Salon multiuso', descripcion: 'Salon para reuniones y eventos', orden: 6 },
  { codigo: 'VESTUARIO', nombre: 'Vestuario', descripcion: 'Vestuario y duchas', orden: 7 },
  { codigo: 'OTRO', nombre: 'Otro', descripcion: 'Otro tipo de espacio', orden: 99 },
]

// ============================================================================
// ESPACIOS DEPORTIVOS INICIALES
// Para un club con Futbol, Basquet y Voley
// ============================================================================

const espaciosDeportivos = [
  {
    codigo: 'CANCHA-11-A',
    nombre: 'Cancha de Futbol 11',
    tipoCodigo: 'CANCHA_FUTBOL_11',
    capacidad: 22,
    cubierto: false,
    iluminacion: true,
    descripcion: 'Cancha principal de futbol 11, cesped natural',
  },
  {
    codigo: 'CANCHA-7-A',
    nombre: 'Cancha de Futbol 7 A',
    tipoCodigo: 'CANCHA_FUTBOL_7',
    capacidad: 14,
    cubierto: false,
    iluminacion: true,
    descripcion: 'Cancha auxiliar de futbol 7',
  },
  {
    codigo: 'CANCHA-7-B',
    nombre: 'Cancha de Futbol 7 B',
    tipoCodigo: 'CANCHA_FUTBOL_7',
    capacidad: 14,
    cubierto: false,
    iluminacion: true,
    descripcion: 'Cancha auxiliar de futbol 7',
  },
  {
    codigo: 'CANCHA-5-A',
    nombre: 'Cancha de Futbol 5',
    tipoCodigo: 'CANCHA_FUTBOL_5',
    capacidad: 10,
    cubierto: true,
    iluminacion: true,
    descripcion: 'Cancha cubierta de futbol 5, piso sintetico',
  },
  {
    codigo: 'GIMNASIO-1',
    nombre: 'Gimnasio Principal',
    tipoCodigo: 'GIMNASIO',
    capacidad: 50,
    cubierto: true,
    iluminacion: true,
    descripcion: 'Gimnasio principal para basquet y voley',
  },
  {
    codigo: 'GIMNASIO-2',
    nombre: 'Gimnasio Auxiliar',
    tipoCodigo: 'GIMNASIO',
    capacidad: 30,
    cubierto: true,
    iluminacion: true,
    descripcion: 'Gimnasio auxiliar para entrenamientos',
  },
  {
    codigo: 'VESTUARIO-1',
    nombre: 'Vestuario Local',
    tipoCodigo: 'VESTUARIO',
    capacidad: 25,
    cubierto: true,
    iluminacion: true,
    descripcion: 'Vestuario principal para equipos locales',
  },
  {
    codigo: 'VESTUARIO-2',
    nombre: 'Vestuario Visitante',
    tipoCodigo: 'VESTUARIO',
    capacidad: 25,
    cubierto: true,
    iluminacion: true,
    descripcion: 'Vestuario para equipos visitantes',
  },
  {
    codigo: 'VESTUARIO-ARBS',
    nombre: 'Vestuario Arbitros',
    tipoCodigo: 'VESTUARIO',
    capacidad: 6,
    cubierto: true,
    iluminacion: true,
    descripcion: 'Vestuario exclusivo para arbitros',
  },
  {
    codigo: 'SALON-1',
    nombre: 'Salon de Usos Multiples',
    tipoCodigo: 'SALON',
    capacidad: 100,
    cubierto: true,
    iluminacion: true,
    descripcion: 'Salon para reuniones, eventos y actividades',
  },
]

async function main() {
  console.log('🏟️  Iniciando seed de deportes...\n')

  // Crear tipos de espacio
  console.log('📋 Creando tipos de espacio...')
  const tiposMap = {}
  for (const tipo of tiposEspacio) {
    const created = await prisma.tipoEspacio.upsert({
      where: { codigo: tipo.codigo },
      update: { nombre: tipo.nombre, descripcion: tipo.descripcion, orden: tipo.orden },
      create: tipo
    })
    tiposMap[tipo.codigo] = created.id
    console.log(`   ✓ ${tipo.nombre}`)
  }
  console.log(`   ${tiposEspacio.length} tipos creados/actualizados\n`)

  // Buscar actividades existentes para vincular
  const futbol = await prisma.actividad.findFirst({ where: { codigo: 'FUT' } })
  const basquet = await prisma.actividad.findFirst({ where: { codigo: 'BAS' } })
  const voley = await prisma.actividad.findFirst({ where: { codigo: 'VOL' } })

  console.log('📍 Creando espacios deportivos...')

  for (const espacio of espaciosDeportivos) {
    const { tipoCodigo, ...espacioData } = espacio

    // Obtener el tipoEspacioId del mapa
    const tipoEspacioId = tiposMap[tipoCodigo]
    if (!tipoEspacioId) {
      console.log(`   ⚠ Tipo ${tipoCodigo} no encontrado, saltando ${espacio.nombre}`)
      continue
    }

    // Determinar actividades a vincular segun el tipo de espacio
    let actividadIds = []

    if (tipoCodigo.startsWith('CANCHA_FUTBOL')) {
      if (futbol) actividadIds.push(futbol.id)
    } else if (tipoCodigo === 'GIMNASIO') {
      if (basquet) actividadIds.push(basquet.id)
      if (voley) actividadIds.push(voley.id)
    }
    // Los vestuarios y salones no se vinculan a actividades especificas

    const existing = await prisma.espacioDeportivo.findUnique({
      where: { codigo: espacio.codigo }
    })

    if (existing) {
      await prisma.espacioDeportivo.update({
        where: { codigo: espacio.codigo },
        data: {
          ...espacioData,
          tipoEspacioId,
          actividades: actividadIds.length > 0 ? {
            set: actividadIds.map(id => ({ id }))
          } : undefined
        }
      })
      console.log(`   ↻ ${espacio.nombre} actualizado`)
    } else {
      await prisma.espacioDeportivo.create({
        data: {
          ...espacioData,
          tipoEspacioId,
          actividades: actividadIds.length > 0 ? {
            connect: actividadIds.map(id => ({ id }))
          } : undefined
        }
      })
      console.log(`   ✓ ${espacio.nombre} creado`)
    }
  }

  console.log(`\n✅ Seed de deportes completado!`)
  console.log(`   ${tiposEspacio.length} tipos de espacio`)
  console.log(`   ${espaciosDeportivos.length} espacios deportivos`)
}

main()
  .catch((e) => {
    console.error('❌ Error en seed de deportes:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
