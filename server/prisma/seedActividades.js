import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ============================================================================
// SEEDS DE ACTIVIDADES DEPORTIVAS
// ============================================================================

const actividades = [
  {
    codigo: 'FUT',
    nombre: 'Fútbol',
    descripcion: 'Fútbol 11 y fútbol reducido para todas las edades. Desarrollamos habilidades técnicas, tácticas y valores de equipo.',
    imagen: '/images/deportes/futbol.jpg',
    requiereAptaFisica: true,
    color: '#10B981',
    orden: 1,
    activo: true
  },
  {
    codigo: 'BAS',
    nombre: 'Básquet',
    descripcion: 'Básquetbol para todas las categorías. Formación integral en fundamentos técnicos y trabajo en equipo.',
    imagen: '/images/deportes/basquet.jpg',
    requiereAptaFisica: true,
    color: '#F59E0B',
    orden: 2,
    activo: true
  },
  {
    codigo: 'HOC',
    nombre: 'Hockey',
    descripcion: 'Hockey sobre césped. Técnica, estrategia y pasión por el deporte.',
    imagen: '/images/deportes/hockey.jpg',
    requiereAptaFisica: true,
    color: '#3B82F6',
    orden: 3,
    activo: true
  },
  {
    codigo: 'VOL',
    nombre: 'Vóley',
    descripcion: 'Voleibol para todas las edades. Desarrollo de coordinación, técnica y juego en equipo.',
    imagen: '/images/deportes/voley.jpg',
    requiereAptaFisica: true,
    color: '#EF4444',
    orden: 4,
    activo: true
  },
  {
    codigo: 'NAT',
    nombre: 'Natación',
    descripcion: 'Escuela de natación desde nivel inicial hasta avanzado. Clases en pileta cubierta climatizada.',
    imagen: '/images/deportes/natacion.jpg',
    requiereAptaFisica: true,
    color: '#06B6D4',
    orden: 5,
    activo: true
  },
  {
    codigo: 'TEN',
    nombre: 'Tenis',
    descripcion: 'Tenis para principiantes y avanzados. Técnica, estrategia y competencia.',
    imagen: '/images/deportes/tenis.jpg',
    requiereAptaFisica: true,
    color: '#84CC16',
    orden: 6,
    activo: true
  }
]

const categorias = [
  // FÚTBOL
  { actividadCodigo: 'FUT', codigo: 'FUT-SUB8', nombre: 'Sub 8', edadMinima: 6, edadMaxima: 8 },
  { actividadCodigo: 'FUT', codigo: 'FUT-SUB10', nombre: 'Sub 10', edadMinima: 9, edadMaxima: 10 },
  { actividadCodigo: 'FUT', codigo: 'FUT-SUB12', nombre: 'Sub 12', edadMinima: 11, edadMaxima: 12 },
  { actividadCodigo: 'FUT', codigo: 'FUT-SUB14', nombre: 'Sub 14', edadMinima: 13, edadMaxima: 14 },
  { actividadCodigo: 'FUT', codigo: 'FUT-SUB16', nombre: 'Sub 16', edadMinima: 15, edadMaxima: 16 },
  { actividadCodigo: 'FUT', codigo: 'FUT-PRIMERA', nombre: 'Primera', edadMinima: 17, edadMaxima: null },

  // BÁSQUET
  { actividadCodigo: 'BAS', codigo: 'BAS-MINI', nombre: 'Mini Básquet', edadMinima: 6, edadMaxima: 10 },
  { actividadCodigo: 'BAS', codigo: 'BAS-SUB12', nombre: 'Sub 12', edadMinima: 11, edadMaxima: 12 },
  { actividadCodigo: 'BAS', codigo: 'BAS-SUB14', nombre: 'Sub 14', edadMinima: 13, edadMaxima: 14 },
  { actividadCodigo: 'BAS', codigo: 'BAS-SUB16', nombre: 'Sub 16', edadMinima: 15, edadMaxima: 16 },
  { actividadCodigo: 'BAS', codigo: 'BAS-CADETES', nombre: 'Cadetes', edadMinima: 17, edadMaxima: 19 },
  { actividadCodigo: 'BAS', codigo: 'BAS-MAYORES', nombre: 'Mayores', edadMinima: 20, edadMaxima: null },

  // HOCKEY
  { actividadCodigo: 'HOC', codigo: 'HOC-SUB10', nombre: 'Sub 10', edadMinima: 8, edadMaxima: 10, sexo: 'F' },
  { actividadCodigo: 'HOC', codigo: 'HOC-SUB12', nombre: 'Sub 12', edadMinima: 11, edadMaxima: 12, sexo: 'F' },
  { actividadCodigo: 'HOC', codigo: 'HOC-SUB14', nombre: 'Sub 14', edadMinima: 13, edadMaxima: 14, sexo: 'F' },
  { actividadCodigo: 'HOC', codigo: 'HOC-SUB16', nombre: 'Sub 16', edadMinima: 15, edadMaxima: 16, sexo: 'F' },
  { actividadCodigo: 'HOC', codigo: 'HOC-PRIMERA', nombre: 'Primera', edadMinima: 17, edadMaxima: null, sexo: 'F' },

  // VÓLEY
  { actividadCodigo: 'VOL', codigo: 'VOL-INFANTIL', nombre: 'Infantil', edadMinima: 8, edadMaxima: 12 },
  { actividadCodigo: 'VOL', codigo: 'VOL-CADETES', nombre: 'Cadetes', edadMinima: 13, edadMaxima: 16 },
  { actividadCodigo: 'VOL', codigo: 'VOL-JUVENIL', nombre: 'Juvenil', edadMinima: 17, edadMaxima: 21 },
  { actividadCodigo: 'VOL', codigo: 'VOL-MAYORES', nombre: 'Mayores', edadMinima: 22, edadMaxima: null },

  // NATACIÓN
  { actividadCodigo: 'NAT', codigo: 'NAT-INICIAL', nombre: 'Inicial', edadMinima: 4, edadMaxima: 6 },
  { actividadCodigo: 'NAT', codigo: 'NAT-INFANTIL', nombre: 'Infantil', edadMinima: 7, edadMaxima: 10 },
  { actividadCodigo: 'NAT', codigo: 'NAT-JUVENIL', nombre: 'Juvenil', edadMinima: 11, edadMaxima: 16 },
  { actividadCodigo: 'NAT', codigo: 'NAT-ADULTOS', nombre: 'Adultos', edadMinima: 17, edadMaxima: null },

  // TENIS
  { actividadCodigo: 'TEN', codigo: 'TEN-INICIAL', nombre: 'Inicial', edadMinima: 6, edadMaxima: 10 },
  { actividadCodigo: 'TEN', codigo: 'TEN-INTERMEDIO', nombre: 'Intermedio', edadMinima: 11, edadMaxima: 16 },
  { actividadCodigo: 'TEN', codigo: 'TEN-AVANZADO', nombre: 'Avanzado', edadMinima: 17, edadMaxima: null }
]

const horarios = [
  // FÚTBOL SUB 8
  { categoriaCodigo: 'FUT-SUB8', diaSemana: 2, horaInicio: '16:00', horaFin: '17:30' }, // Martes
  { categoriaCodigo: 'FUT-SUB8', diaSemana: 4, horaInicio: '16:00', horaFin: '17:30' }, // Jueves
  { categoriaCodigo: 'FUT-SUB8', diaSemana: 6, horaInicio: '09:00', horaFin: '10:30' }, // Sábado

  // FÚTBOL SUB 10
  { categoriaCodigo: 'FUT-SUB10', diaSemana: 2, horaInicio: '17:00', horaFin: '18:30' },
  { categoriaCodigo: 'FUT-SUB10', diaSemana: 4, horaInicio: '17:00', horaFin: '18:30' },
  { categoriaCodigo: 'FUT-SUB10', diaSemana: 6, horaInicio: '10:00', horaFin: '11:30' },

  // FÚTBOL SUB 12
  { categoriaCodigo: 'FUT-SUB12', diaSemana: 2, horaInicio: '18:00', horaFin: '19:30' },
  { categoriaCodigo: 'FUT-SUB12', diaSemana: 4, horaInicio: '18:00', horaFin: '19:30' },
  { categoriaCodigo: 'FUT-SUB12', diaSemana: 6, horaInicio: '11:00', horaFin: '12:30' },

  // BÁSQUET MINI
  { categoriaCodigo: 'BAS-MINI', diaSemana: 1, horaInicio: '16:00', horaFin: '17:00' }, // Lunes
  { categoriaCodigo: 'BAS-MINI', diaSemana: 3, horaInicio: '16:00', horaFin: '17:00' }, // Miércoles
  { categoriaCodigo: 'BAS-MINI', diaSemana: 5, horaInicio: '16:00', horaFin: '17:00' }, // Viernes

  // BÁSQUET SUB 12
  { categoriaCodigo: 'BAS-SUB12', diaSemana: 1, horaInicio: '17:00', horaFin: '18:30' },
  { categoriaCodigo: 'BAS-SUB12', diaSemana: 3, horaInicio: '17:00', horaFin: '18:30' },
  { categoriaCodigo: 'BAS-SUB12', diaSemana: 5, horaInicio: '17:00', horaFin: '18:30' },

  // NATACIÓN INICIAL
  { categoriaCodigo: 'NAT-INICIAL', diaSemana: 2, horaInicio: '15:00', horaFin: '16:00' },
  { categoriaCodigo: 'NAT-INICIAL', diaSemana: 4, horaInicio: '15:00', horaFin: '16:00' },

  // NATACIÓN INFANTIL
  { categoriaCodigo: 'NAT-INFANTIL', diaSemana: 1, horaInicio: '16:00', horaFin: '17:00' },
  { categoriaCodigo: 'NAT-INFANTIL', diaSemana: 3, horaInicio: '16:00', horaFin: '17:00' },
  { categoriaCodigo: 'NAT-INFANTIL', diaSemana: 5, horaInicio: '16:00', horaFin: '17:00' }
]

const staff = [
  // FÚTBOL
  {
    actividadCodigo: 'FUT',
    categoriaCodigo: 'FUT-SUB10',
    nombre: 'Juan',
    apellido: 'Pérez',
    rol: 'DIRECTOR_TECNICO',
    email: 'juan.perez@club.com',
    telefono: '+54 11 2345-6789',
    biografia: 'Director técnico con 15 años de experiencia en formación de futbolistas. Ex jugador profesional.'
  },
  {
    actividadCodigo: 'FUT',
    categoriaCodigo: 'FUT-SUB10',
    nombre: 'Carlos',
    apellido: 'González',
    rol: 'AYUDANTE',
    email: 'carlos.gonzalez@club.com',
    telefono: '+54 11 2345-6790'
  },

  // BÁSQUET
  {
    actividadCodigo: 'BAS',
    categoriaCodigo: 'BAS-SUB12',
    nombre: 'María',
    apellido: 'Rodríguez',
    rol: 'ENTRENADOR',
    email: 'maria.rodriguez@club.com',
    telefono: '+54 11 2345-6791',
    biografia: 'Entrenadora nivel II CABB. Especializada en desarrollo de jugadores juveniles.'
  },

  // NATACIÓN
  {
    actividadCodigo: 'NAT',
    categoriaCodigo: null, // Staff general de natación
    nombre: 'Laura',
    apellido: 'Martínez',
    rol: 'COORDINADOR',
    email: 'laura.martinez@club.com',
    telefono: '+54 11 2345-6792',
    biografia: 'Coordinadora de natación. Profesora Nacional de Educación Física con especialización en deportes acuáticos.'
  }
]

const noticias = [
  {
    actividadCodigo: 'FUT',
    categoriaCodigo: null,
    titulo: '¡Gran inicio de temporada para nuestro fútbol!',
    copete: 'Todas las categorías comenzaron con entrenamientos y excelente convocatoria.',
    contenido: 'Comenzó la temporada 2026 para todas las categorías de fútbol del club. Con gran entusiasmo y compromiso, nuestros jugadores iniciaron los entrenamientos de pretemporada. Los cuerpos técnicos están trabajando arduamente para preparar el mejor plantel posible.',
    tipo: 'NOTICIA',
    destacada: true,
    autor: 'Comisión Deportiva'
  },
  {
    actividadCodigo: 'BAS',
    categoriaCodigo: null,
    titulo: 'Básquet: Nuevos horarios de entrenamiento',
    copete: 'A partir de marzo cambian los horarios de algunas categorías.',
    contenido: 'Informamos que a partir del 1 de marzo se modificarán los horarios de entrenamiento de las categorías Sub 14 y Sub 16. Consultar en secretaría los nuevos horarios.',
    tipo: 'COMUNICADO',
    destacada: false,
    autor: 'Secretaría'
  },
  {
    actividadCodigo: 'FUT',
    categoriaCodigo: 'FUT-SUB10',
    titulo: 'Sub 10: Victoria contundente en el clásico',
    copete: 'Nuestros chicos ganaron 4-1 en un gran partido.',
    contenido: 'En un partido vibrante, la Sub 10 de fútbol se impuso 4-1 ante el clásico rival. Destacaron Martín López con 2 goles y Tomás García con una gran actuación en el mediocampo. ¡Felicitaciones a todo el equipo!',
    tipo: 'RESULTADO',
    destacada: true,
    autor: 'Comisión Deportiva'
  }
]

const partidos = [
  {
    categoriaCodigo: 'FUT-SUB10',
    fecha: new Date('2026-02-15'),
    hora: '10:00',
    tipo: 'LIGA',
    condicion: 'LOCAL',
    rival: 'Club Atlético San Martín',
    golesLocal: null,
    golesVisitante: null,
    estado: 'PROGRAMADO'
  },
  {
    categoriaCodigo: 'FUT-SUB10',
    fecha: new Date('2026-02-08'),
    hora: '10:00',
    tipo: 'LIGA',
    condicion: 'LOCAL',
    rival: 'Club Sportivo Rivadavia',
    golesLocal: 4,
    golesVisitante: 1,
    estado: 'FINALIZADO'
  },
  {
    categoriaCodigo: 'FUT-SUB12',
    fecha: new Date('2026-02-16'),
    hora: '11:00',
    tipo: 'AMISTOSO',
    condicion: 'VISITANTE',
    rival: 'Club Unidos',
    ubicacion: 'Av. San Martín 1234, Pilar',
    golesLocal: null,
    golesVisitante: null,
    estado: 'PROGRAMADO'
  },
  {
    categoriaCodigo: 'BAS-SUB12',
    fecha: new Date('2026-02-20'),
    hora: '18:00',
    tipo: 'TORNEO',
    condicion: 'LOCAL',
    rival: 'Básquet Pilar',
    golesLocal: null,
    golesVisitante: null,
    estado: 'PROGRAMADO'
  }
]

const articulosReglamento = [
  // SECCIÓN GENERAL
  {
    seccion: 'GENERAL',
    titulo: 'Respeto a las instalaciones',
    contenido: 'Todos los miembros del club deben hacer un uso responsable de las instalaciones deportivas. Está prohibido dañar o mal utilizar el equipamiento y las áreas comunes.',
    orden: 1,
    requiereAceptacion: true
  },
  {
    seccion: 'GENERAL',
    titulo: 'Puntualidad',
    contenido: 'Es fundamental respetar los horarios establecidos para entrenamientos y actividades. La puntualidad es un valor que fomentamos en todos nuestros deportistas.',
    orden: 2,
    requiereAceptacion: false
  },
  {
    seccion: 'GENERAL',
    titulo: 'Vestimenta deportiva',
    contenido: 'Durante las actividades deportivas es obligatorio el uso de ropa y calzado adecuado. En el caso de deportes de equipo, se deberá usar el uniforme oficial del club.',
    orden: 3,
    requiereAceptacion: false
  },

  // SECCIÓN PADRES
  {
    seccion: 'PADRES',
    titulo: 'Respeto en entrenamientos y partidos',
    contenido: 'Los padres deben mantener un comportamiento respetuoso durante entrenamientos y competencias. No se permite ingresar al campo de juego ni dar indicaciones técnicas desde las tribunas.',
    orden: 1,
    requiereAceptacion: true
  },
  {
    seccion: 'PADRES',
    titulo: 'Comunicación con entrenadores',
    contenido: 'Para consultas o inquietudes, los padres deben solicitar una reunión con el entrenador en horarios fuera del entrenamiento. Se debe respetar el trabajo del cuerpo técnico.',
    orden: 2,
    requiereAceptacion: true
  },
  {
    seccion: 'PADRES',
    titulo: 'Apoyo positivo',
    contenido: 'Se espera que los padres brinden apoyo positivo a todos los jugadores, tanto del propio equipo como del rival. Insultos, gritos o gestos ofensivos no serán tolerados.',
    orden: 3,
    requiereAceptacion: true
  },

  // SECCIÓN JUGADORES
  {
    seccion: 'JUGADORES',
    titulo: 'Fair Play',
    contenido: 'El juego limpio es fundamental. Los jugadores deben respetar a compañeros, rivales, árbitros y entrenadores en todo momento.',
    orden: 1,
    requiereAceptacion: true
  },
  {
    seccion: 'JUGADORES',
    titulo: 'Compromiso con entrenamientos',
    contenido: 'Se espera asistencia regular a los entrenamientos. En caso de ausencia, se debe notificar al entrenador con anticipación.',
    orden: 2,
    requiereAceptacion: true
  },
  {
    seccion: 'JUGADORES',
    titulo: 'Cuidado del material deportivo',
    contenido: 'Los jugadores son responsables del cuidado del material deportivo asignado (pelotas, pecheras, equipamiento). Cualquier daño intencional será sancionado.',
    orden: 3,
    requiereAceptacion: false
  },

  // SECCIÓN ENTRENADORES
  {
    seccion: 'ENTRENADORES',
    titulo: 'Trato equitativo',
    contenido: 'Los entrenadores deben brindar oportunidades equitativas a todos los jugadores, independientemente de su nivel o habilidad.',
    orden: 1,
    requiereAceptacion: false
  },
  {
    seccion: 'ENTRENADORES',
    titulo: 'Comunicación con padres',
    contenido: 'Los entrenadores deben mantener una comunicación clara y respetuosa con los padres, estableciendo canales apropiados para consultas y reuniones.',
    orden: 2,
    requiereAceptacion: false
  },

  // SECCIÓN SANCIONES
  {
    seccion: 'SANCIONES',
    titulo: 'Faltas leves',
    contenido: 'Impuntualidad reiterada, mal uso de instalaciones. Sanción: Advertencia verbal.',
    orden: 1,
    requiereAceptacion: false
  },
  {
    seccion: 'SANCIONES',
    titulo: 'Faltas graves',
    contenido: 'Conducta antideportiva, falta de respeto a autoridades, daño intencional al equipamiento. Sanción: Suspensión de 1 a 4 encuentros.',
    orden: 2,
    requiereAceptacion: false
  },
  {
    seccion: 'SANCIONES',
    titulo: 'Faltas muy graves',
    contenido: 'Agresión física o verbal, conductas discriminatorias. Sanción: Suspensión temporal o baja definitiva del club.',
    orden: 3,
    requiereAceptacion: false
  },

  // SECCIÓN CONFLICTOS
  {
    seccion: 'CONFLICTOS',
    titulo: 'Mediación',
    contenido: 'Ante conflictos, se buscará primero una solución mediante el diálogo y la mediación del coordinador deportivo.',
    orden: 1,
    requiereAceptacion: false
  },
  {
    seccion: 'CONFLICTOS',
    titulo: 'Comité de convivencia',
    contenido: 'En casos que no se resuelvan por mediación, se elevará el caso al Comité de Convivencia del club, cuya decisión será definitiva.',
    orden: 2,
    requiereAceptacion: false
  }
]

async function main() {
  console.log('🌱 Iniciando seed de Actividades Deportivas...\n')

  // 1. Crear Actividades
  console.log('⚽ Creando actividades...')
  for (const act of actividades) {
    await prisma.actividad.upsert({
      where: { codigo: act.codigo },
      update: act,
      create: act
    })
  }
  console.log(`   ✓ ${actividades.length} actividades creadas\n`)

  // 2. Crear Categorías
  console.log('👥 Creando categorías...')
  for (const cat of categorias) {
    const actividad = await prisma.actividad.findUnique({
      where: { codigo: cat.actividadCodigo }
    })

    if (actividad) {
      await prisma.categoriaActividad.upsert({
        where: { codigo: cat.codigo },
        update: {
          actividadId: actividad.id,
          nombre: cat.nombre,
          edadMinima: cat.edadMinima,
          edadMaxima: cat.edadMaxima,
          sexo: cat.sexo || null
        },
        create: {
          actividadId: actividad.id,
          codigo: cat.codigo,
          nombre: cat.nombre,
          edadMinima: cat.edadMinima,
          edadMaxima: cat.edadMaxima,
          sexo: cat.sexo || null
        }
      })
    }
  }
  console.log(`   ✓ ${categorias.length} categorías creadas\n`)

  // 3. Crear Horarios Recurrentes
  console.log('📅 Creando horarios de entrenamiento...')
  for (const hor of horarios) {
    const categoria = await prisma.categoriaActividad.findUnique({
      where: { codigo: hor.categoriaCodigo }
    })

    if (categoria) {
      // Verificar si ya existe para no duplicar
      const existente = await prisma.horarioRecurrente.findFirst({
        where: {
          categoriaActividadId: categoria.id,
          diaSemana: hor.diaSemana,
          horaInicio: hor.horaInicio
        }
      })

      if (!existente) {
        await prisma.horarioRecurrente.create({
          data: {
            categoriaActividadId: categoria.id,
            diaSemana: hor.diaSemana,
            horaInicio: hor.horaInicio,
            horaFin: hor.horaFin
          }
        })
      }
    }
  }
  console.log(`   ✓ ${horarios.length} horarios creados\n`)

  // 4. Crear Staff Técnico
  console.log('👨‍🏫 Creando staff técnico...')
  for (const s of staff) {
    const actividad = await prisma.actividad.findUnique({
      where: { codigo: s.actividadCodigo }
    })

    let categoriaId = null
    if (s.categoriaCodigo) {
      const categoria = await prisma.categoriaActividad.findUnique({
        where: { codigo: s.categoriaCodigo }
      })
      categoriaId = categoria?.id
    }

    if (actividad) {
      await prisma.staffTecnico.create({
        data: {
          actividadId: actividad.id,
          categoriaActividadId: categoriaId,
          nombre: s.nombre,
          apellido: s.apellido,
          rol: s.rol,
          email: s.email,
          telefono: s.telefono,
          biografia: s.biografia || null
        }
      })
    }
  }
  console.log(`   ✓ ${staff.length} miembros del staff creados\n`)

  // 5. Crear Noticias Deportivas
  console.log('📰 Creando noticias deportivas...')
  for (const not of noticias) {
    const actividad = await prisma.actividad.findUnique({
      where: { codigo: not.actividadCodigo }
    })

    let categoriaId = null
    if (not.categoriaCodigo) {
      const categoria = await prisma.categoriaActividad.findUnique({
        where: { codigo: not.categoriaCodigo }
      })
      categoriaId = categoria?.id
    }

    if (actividad) {
      await prisma.noticiaDeportiva.create({
        data: {
          actividadId: actividad.id,
          categoriaId: categoriaId,
          titulo: not.titulo,
          copete: not.copete,
          contenido: not.contenido,
          tipo: not.tipo,
          destacada: not.destacada,
          autor: not.autor
        }
      })
    }
  }
  console.log(`   ✓ ${noticias.length} noticias creadas\n`)

  // 6. Crear Partidos
  console.log('🏆 Creando partidos...')

  // Necesitamos un admin existente para el campo registradoPor
  let adminId = 1
  const primerAdmin = await prisma.admin.findFirst()
  if (primerAdmin) {
    adminId = primerAdmin.id
  }

  for (const par of partidos) {
    const categoria = await prisma.categoriaActividad.findUnique({
      where: { codigo: par.categoriaCodigo }
    })

    if (categoria) {
      await prisma.partido.create({
        data: {
          categoriaActividadId: categoria.id,
          fecha: par.fecha,
          hora: par.hora,
          tipo: par.tipo,
          condicion: par.condicion,
          rival: par.rival,
          ubicacion: par.ubicacion || null,
          golesLocal: par.golesLocal,
          golesVisitante: par.golesVisitante,
          estado: par.estado,
          registradoPor: adminId
        }
      })
    }
  }
  console.log(`   ✓ ${partidos.length} partidos creados\n`)

  // 7. Crear Artículos de Reglamento
  console.log('📜 Creando reglamento de convivencia...')
  for (const art of articulosReglamento) {
    await prisma.articuloReglamento.create({
      data: art
    })
  }
  console.log(`   ✓ ${articulosReglamento.length} artículos de reglamento creados\n`)

  console.log('✅ Seed de Actividades Deportivas completado!\n')
}

main()
  .catch(e => {
    console.error('❌ Error en seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
