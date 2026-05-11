/**
 * Rutas públicas (sin autenticación)
 * - Solicitud de alta de nuevos socios
 * - Registro de comercios
 * - etc.
 */

import express from 'express'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { enviarEmailConTemplate } from '../services/notificacionService.js'
import { getTenantFrontendUrl } from '../lib/tenantUrl.js'

const router = express.Router()

/**
 * POST /api/public/solicitud-socio
 * Crear una nueva solicitud de alta de socio desde formulario público
 */
router.post('/solicitud-socio', asyncHandler(async (req, res) => {
  const {
    apellidos,
    nombres,
    documento,
    fechaNacimiento,
    direccionCalle,
    direccionNumero,
    localidad,
    telefono,
    email,
    actividadesSeleccionadas,
    tieneEnfermedades,
    detalleEnfermedades,
    tutorApellidos,
    tutorNombres,
    tutorDocumento,
    tutorTelefono
  } = req.body

  // Validaciones básicas
  if (!apellidos || !nombres || !documento || !fechaNacimiento ||
      !direccionCalle || !direccionNumero || !localidad || !telefono ||
      !email) {
    throw new AppError('Todos los campos obligatorios deben ser completados', 400)
  }

  // Validar formato de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    throw new AppError('El email no tiene un formato válido', 400)
  }

  // Validar que no exista una solicitud pendiente con el mismo documento
  const solicitudExistente = await req.db.solicitudSocio.findFirst({
    where: {
      documento,
      estado: 'PENDIENTE'
    }
  })

  if (solicitudExistente) {
    throw new AppError('Ya existe una solicitud pendiente con este número de documento', 400)
  }

  // Validar que no exista un socio activo con el mismo documento
  const socioExistente = await req.db.socio.findFirst({
    where: {
      documento,
      estadoSocioRel: { esSocioActivo: true }
    }
  })

  if (socioExistente) {
    throw new AppError('Ya existe un socio activo con este número de documento', 400)
  }

  // Calcular si es menor de edad (< 18 años)
  const fechaNac = new Date(fechaNacimiento)
  const edad = Math.floor((new Date() - fechaNac) / (365.25 * 24 * 60 * 60 * 1000))
  const esMenor = edad < 18

  // Si es menor, validar que tenga datos del tutor
  if (esMenor && (!tutorApellidos || !tutorNombres || !tutorDocumento || !tutorTelefono)) {
    throw new AppError('Los menores de 18 años deben proporcionar datos del tutor', 400)
  }

  // Crear la solicitud
  const solicitud = await req.db.solicitudSocio.create({
    data: {
      apellidos,
      nombres,
      documento,
      fechaNacimiento: new Date(fechaNacimiento),
      direccionCalle,
      direccionNumero,
      localidad,
      telefono,
      email,
      actividadesSeleccionadas: JSON.stringify(actividadesSeleccionadas || []),
      tieneEnfermedades: tieneEnfermedades === 'Si' || tieneEnfermedades === true,
      detalleEnfermedades: tieneEnfermedades === 'Si' ? detalleEnfermedades : null,
      tutorApellidos: esMenor ? tutorApellidos : null,
      tutorNombres: esMenor ? tutorNombres : null,
      tutorDocumento: esMenor ? tutorDocumento : null,
      tutorTelefono: esMenor ? tutorTelefono : null,
      estado: 'PENDIENTE'
    }
  })

  // Enviar email de confirmación al solicitante
  try {
    const clubNombre = (await req.db.configuracion.findFirst({
      where: { clave: 'CLUB_NOMBRE' }
    }))?.valor || 'Club Sportivo Pilar'

    const actividadesTexto = Array.isArray(actividadesSeleccionadas) && actividadesSeleccionadas.length > 0
      ? actividadesSeleccionadas.join(', ')
      : 'Ninguna'

    await enviarEmailConTemplate('SOLICITUD_RECIBIDA', email, {
      nombreCompleto: `${nombres} ${apellidos}`,
      clubNombre,
      numeroSolicitud: solicitud.id,
      actividadesSeleccionadas: actividadesTexto
    }, req.db)
  } catch (emailError) {
    console.error('Error enviando email de confirmación:', emailError)
    // No fallar la solicitud si el email falla
  }

  // Notificar a los administradores
  try {
    const emailsAdmin = await req.db.admin.findMany({
      where: { activo: true },
      select: { email: true }
    })

    const clubNombre = (await req.db.configuracion.findFirst({
      where: { clave: 'CLUB_NOMBRE' }
    }))?.valor || 'Club Sportivo Pilar'

    const actividadesTexto = Array.isArray(actividadesSeleccionadas) && actividadesSeleccionadas.length > 0
      ? actividadesSeleccionadas.join(', ')
      : 'Ninguna'

    const baseUrl = getTenantFrontendUrl(req.tenant)
    for (const admin of emailsAdmin) {
      await enviarEmailConTemplate('NOTIF_NUEVA_SOLICITUD', admin.email, {
        nombreCompleto: `${nombres} ${apellidos}`,
        documento,
        email,
        telefono,
        actividadInscripcion: actividadesTexto,
        numeroSolicitud: solicitud.id,
        urlGestion: `${baseUrl}/admin/solicitudes/${solicitud.id}`
      }, req.db)
    }
  } catch (emailError) {
    console.error('Error notificando a administradores:', emailError)
    // No fallar la solicitud si el email falla
  }

  res.status(201).json({
    success: true,
    message: 'Solicitud enviada correctamente. Recibirás una respuesta en las próximas 48 horas.',
    solicitud: {
      id: solicitud.id,
      estado: solicitud.estado,
      fechaSolicitud: solicitud.fechaSolicitud
    }
  })
}))

/**
 * POST /api/public/solicitud-socio/:id/familiar
 * Agregar un familiar a una solicitud existente
 */
router.post('/solicitud-socio/:id/familiar', asyncHandler(async (req, res) => {
  const { id } = req.params
  const {
    apellidos,
    nombres,
    documento,
    fechaNacimiento,
    parentesco,
    actividadesSeleccionadas // Array de strings: ["Basquet", "Futbol 11"]
  } = req.body

  // Validaciones básicas
  if (!apellidos || !nombres || !documento || !fechaNacimiento || !parentesco) {
    throw new AppError('Todos los campos obligatorios deben ser completados', 400)
  }

  if (!['CONYUGE', 'HIJO'].includes(parentesco)) {
    throw new AppError('Parentesco inválido. Debe ser CONYUGE o HIJO', 400)
  }

  // Verificar que la solicitud existe y está PENDIENTE
  const solicitud = await req.db.solicitudSocio.findUnique({
    where: { id: parseInt(id) }
  })

  if (!solicitud) {
    throw new AppError('Solicitud no encontrada', 404)
  }

  if (solicitud.estado !== 'PENDIENTE') {
    throw new AppError('No se pueden agregar familiares a una solicitud ya procesada', 400)
  }

  // Verificar que no exista un familiar con el mismo documento en esta solicitud
  const familiarExistente = await req.db.familiarSolicitud.findFirst({
    where: {
      solicitudSocioId: parseInt(id),
      documento
    }
  })

  if (familiarExistente) {
    throw new AppError('Ya existe un familiar con este número de documento en esta solicitud', 400)
  }

  // Crear el familiar
  const familiar = await req.db.familiarSolicitud.create({
    data: {
      solicitudSocioId: parseInt(id),
      apellidos,
      nombres,
      documento,
      fechaNacimiento: new Date(fechaNacimiento),
      parentesco,
      actividadesSeleccionadas: JSON.stringify(actividadesSeleccionadas || [])
    }
  })

  res.status(201).json({
    success: true,
    message: 'Familiar agregado correctamente',
    data: {
      ...familiar,
      actividadesSeleccionadas: JSON.parse(familiar.actividadesSeleccionadas)
    }
  })
}))

/**
 * GET /api/public/solicitud-socio/:id/familiares
 * Obtener la lista de familiares de una solicitud
 */
router.get('/solicitud-socio/:id/familiares', asyncHandler(async (req, res) => {
  const { id } = req.params

  const familiares = await req.db.familiarSolicitud.findMany({
    where: { solicitudSocioId: parseInt(id) },
    orderBy: { createdAt: 'asc' }
  })

  // Parsear el JSON de actividades para cada familiar
  const familiaresConActividades = familiares.map(f => ({
    ...f,
    actividadesSeleccionadas: JSON.parse(f.actividadesSeleccionadas)
  }))

  res.json({
    success: true,
    data: familiaresConActividades
  })
}))

/**
 * DELETE /api/public/solicitud-socio/:id/familiar/:familiarId
 * Eliminar un familiar de una solicitud
 */
router.delete('/solicitud-socio/:id/familiar/:familiarId', asyncHandler(async (req, res) => {
  const { id, familiarId } = req.params

  // Verificar que la solicitud está PENDIENTE
  const solicitud = await req.db.solicitudSocio.findUnique({
    where: { id: parseInt(id) }
  })

  if (!solicitud) {
    throw new AppError('Solicitud no encontrada', 404)
  }

  if (solicitud.estado !== 'PENDIENTE') {
    throw new AppError('No se pueden eliminar familiares de una solicitud ya procesada', 400)
  }

  // Verificar que el familiar pertenece a esta solicitud
  const familiar = await req.db.familiarSolicitud.findFirst({
    where: {
      id: parseInt(familiarId),
      solicitudSocioId: parseInt(id)
    }
  })

  if (!familiar) {
    throw new AppError('Familiar no encontrado', 404)
  }

  // Eliminar el familiar
  await req.db.familiarSolicitud.delete({
    where: { id: parseInt(familiarId) }
  })

  res.json({
    success: true,
    message: 'Familiar eliminado correctamente'
  })
}))

/**
 * GET /api/public/solicitud-socio/:id/verificar-token
 * Verificar que el solicitante puede acceder a la solicitud (simple validación por documento)
 */
router.post('/solicitud-socio/:id/verificar', asyncHandler(async (req, res) => {
  const { id } = req.params
  const { documento } = req.body

  const solicitud = await req.db.solicitudSocio.findFirst({
    where: {
      id: parseInt(id),
      documento
    },
    include: {
      familiares: true
    }
  })

  if (!solicitud) {
    throw new AppError('Solicitud no encontrada o documento incorrecto', 404)
  }

  res.json({
    success: true,
    data: {
      id: solicitud.id,
      estado: solicitud.estado,
      nombres: solicitud.nombres,
      apellidos: solicitud.apellidos,
      cantidadFamiliares: solicitud.familiares.length
    }
  })
}))

/**
 * GET /api/public/actividades
 * Obtener lista de actividades activas para mostrar en el sitio web
 */
router.get('/actividades', asyncHandler(async (req, res) => {
  const actividades = await req.db.actividad.findMany({
    where: {
      activo: true
    },
    include: {
      categorias: {
        where: { activo: true },
        select: {
          id: true,
          nombre: true,
          _count: {
            select: {
              inscripciones: true
            }
          }
        }
      }
    },
    orderBy: { nombre: 'asc' }
  })

  res.json({
    success: true,
    data: actividades.map(act => ({
      id: act.id,
      nombre: act.nombre,
      descripcion: act.descripcion,
      imagen: act.imagen,
      categorias: act.categorias.map(c => ({ id: c.id, nombre: c.nombre })),
      inscriptos: act.categorias.reduce((sum, cat) => sum + cat._count.inscripciones, 0)
    }))
  })
}))

/**
 * GET /api/public/actividades/:id
 * Detalle de una actividad para página pública
 */
router.get('/actividades/:id', asyncHandler(async (req, res) => {
  const { id } = req.params

  const actividad = await req.db.actividad.findUnique({
    where: { id: parseInt(id) },
    include: {
      categorias: {
        where: { activo: true },
        include: {
          horariosRecurrentes: {
            where: { activo: true },
            orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }]
          },
          _count: {
            select: {
              inscripciones: true
            }
          }
        }
      }
    }
  })

  if (!actividad || !actividad.activo) {
    throw new AppError('Actividad no encontrada', 404)
  }

  // Lookup separado de espacios (HorarioRecurrente.espacioId es FK suelta sin relación Prisma)
  const espacioIds = [...new Set(
    actividad.categorias.flatMap(c => c.horariosRecurrentes.map(h => h.espacioId).filter(Boolean))
  )]
  const espacios = espacioIds.length > 0
    ? await req.db.espacioDeportivo.findMany({ where: { id: { in: espacioIds } }, select: { id: true, nombre: true } })
    : []
  const espacioById = new Map(espacios.map(e => [e.id, e.nombre]))

  const totalInscriptos = actividad.categorias.reduce((sum, cat) => sum + cat._count.inscripciones, 0)

  res.json({
    id: actividad.id,
    nombre: actividad.nombre,
    descripcion: actividad.descripcion,
    imagen: actividad.imagen,
    inscriptos: totalInscriptos,
    categorias: actividad.categorias.map(cat => ({
      id: cat.id,
      nombre: cat.nombre,
      edadMinima: cat.edadMinima,
      edadMaxima: cat.edadMaxima,
      cupoMaximo: cat.cupoMaximo,
      genero: cat.genero,
      horarios: cat.horariosRecurrentes.map(h => ({
        diaSemana: h.diaSemana,
        horaInicio: h.horaInicio,
        horaFin: h.horaFin,
        espacio: h.espacioId ? (espacioById.get(h.espacioId) || null) : null,
      })),
      _count: cat._count
    }))
  })
}))

/**
 * GET /api/public/calendario
 * Obtener eventos del mes para calendario público
 * Query params: year, month
 */
router.get('/calendario', asyncHandler(async (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear()
  const month = parseInt(req.query.month) || new Date().getMonth() + 1

  // Fecha inicio y fin del mes
  const fechaInicio = new Date(year, month - 1, 1)
  const fechaFin = new Date(year, month, 0, 23, 59, 59)

  // Obtener partidos del mes
  const partidos = await req.db.partido.findMany({
    where: {
      fecha: {
        gte: fechaInicio,
        lte: fechaFin
      },
      estado: {
        not: 'CANCELADO'
      }
    },
    include: {
      categoria: {
        include: {
          actividad: true
        }
      }
    },
    orderBy: { fecha: 'asc' }
  })

  // Obtener entrenamientos del mes
  const entrenamientos = await req.db.entrenamiento.findMany({
    where: {
      fecha: {
        gte: fechaInicio,
        lte: fechaFin
      },
      estado: 'PROGRAMADO'
    },
    include: {
      categoria: {
        include: {
          actividad: true
        }
      }
    },
    orderBy: { fecha: 'asc' }
  })

  // Formatear eventos
  const eventos = [
    ...partidos.map(p => ({
      tipo: 'PARTIDO',
      fecha: p.fecha.toISOString(),
      hora: p.hora,
      titulo: `${p.categoria?.actividad?.nombre || 'Partido'} - ${p.categoria?.nombre || ''}`,
      lugar: p.lugar || 'Por confirmar',
      categoria: p.categoria?.nombre,
      rival: p.rival,
      esLocal: p.esLocal
    })),
    ...entrenamientos.map(e => ({
      tipo: 'ENTRENAMIENTO',
      fecha: e.fecha.toISOString(),
      hora: e.horaInicio,
      titulo: `Entrenamiento ${e.categoria?.actividad?.nombre || ''}`,
      lugar: e.lugar || 'Club',
      categoria: e.categoria?.nombre
    }))
  ].sort((a, b) => new Date(a.fecha) - new Date(b.fecha))

  res.json({ eventos })
}))

/**
 * GET /api/public/galeria
 * Obtener álbumes y fotos de la galería pública
 */
router.get('/galeria', asyncHandler(async (req, res) => {
  // Buscar si existen álbumes/galerías en la BD
  // Por ahora retornamos estructura vacía para que el frontend maneje el caso
  const albumes = []
  const fotos = []

  // Si en el futuro se implementa modelo Album/FotoGaleria:
  // const albumes = await req.db.album.findMany({
  //   where: { activo: true, publico: true },
  //   include: { _count: { select: { fotos: true } } },
  //   orderBy: { fecha: 'desc' }
  // })

  res.json({ albumes, fotos })
}))

/**
 * GET /api/public/galeria/album/:id
 * Obtener fotos de un álbum específico
 */
router.get('/galeria/album/:id', asyncHandler(async (req, res) => {
  const { id } = req.params

  // Por ahora retornamos array vacío
  // En el futuro cuando se implemente el modelo:
  // const fotos = await req.db.fotoGaleria.findMany({
  //   where: { albumId: parseInt(id), activo: true },
  //   orderBy: { orden: 'asc' }
  // })

  res.json({ fotos: [] })
}))

// =============================================================================
// ACTIVIDADES DEPORTIVAS
// =============================================================================

/**
 * Helper: Generar instancias de entrenamientos recurrentes en un rango de fechas
 */
function generarInstanciasEntrenamientos(horarios, fechaDesde, fechaHasta) {
  const instancias = []

  for (const horario of horarios) {
    let fecha = new Date(fechaDesde)

    // Avanzar hasta el primer día de la semana que coincida
    // diaSemana: 1=Lunes, 2=Martes, ..., 7=Domingo
    // getDay(): 0=Domingo, 1=Lunes, ..., 6=Sábado
    const diaObjetivo = horario.diaSemana === 7 ? 0 : horario.diaSemana

    while (fecha.getDay() !== diaObjetivo) {
      fecha.setDate(fecha.getDate() + 1)
    }

    // Generar instancias hasta la fecha final
    while (fecha <= fechaHasta) {
      instancias.push({
        id: `entrenamiento-${horario.id}-${fecha.toISOString().split('T')[0]}`,
        tipo: 'entrenamiento',
        fecha: new Date(fecha),
        hora: horario.horaInicio,
        horaInicio: horario.horaInicio,
        horaFin: horario.horaFin,
        titulo: `Entrenamiento ${horario.categoriaActividad.nombre}`,
        actividad: horario.categoriaActividad.actividad.nombre,
        actividadId: horario.categoriaActividad.actividadId,
        categoria: horario.categoriaActividad.nombre,
        categoriaId: horario.categoriaActividadId,
        diaSemana: horario.diaSemana
      })

      fecha.setDate(fecha.getDate() + 7) // Siguiente semana
    }
  }

  return instancias.sort((a, b) => a.fecha - b.fecha)
}

/**
 * Helper: Calcular rango de fechas según preset
 */
function calcularRangoFecha(preset) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  switch (preset) {
    case 'hoy':
      return {
        desde: new Date(hoy),
        hasta: new Date(hoy)
      }

    case 'esta-semana': {
      const desde = new Date(hoy)
      const diaActual = desde.getDay()
      const diasHastaLunes = diaActual === 0 ? -6 : 1 - diaActual
      desde.setDate(desde.getDate() + diasHastaLunes)

      const hasta = new Date(desde)
      hasta.setDate(hasta.getDate() + 6)

      return { desde, hasta }
    }

    case 'proxima-semana': {
      const desde = new Date(hoy)
      const diaActual = desde.getDay()
      const diasHastaLunes = diaActual === 0 ? 1 : 8 - diaActual
      desde.setDate(desde.getDate() + diasHastaLunes)

      const hasta = new Date(desde)
      hasta.setDate(hasta.getDate() + 6)

      return { desde, hasta }
    }

    case 'este-mes': {
      const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
      const hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)

      return { desde, hasta }
    }

    case 'proximo-mes': {
      const desde = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1)
      const hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 2, 0)

      return { desde, hasta }
    }

    default:
      // Por defecto: próximos 7 días
      return {
        desde: new Date(hoy),
        hasta: new Date(hoy.getTime() + 7 * 24 * 60 * 60 * 1000)
      }
  }
}

/**
 * GET /api/public/cronograma
 * Cronograma general de entrenamientos y partidos
 *
 * Query params:
 *   - actividadIds: "1,2,3" (IDs de actividades a filtrar)
 *   - categoriaIds: "5,8,12" (IDs de categorías a filtrar)
 *   - desde: "2026-02-10" (fecha inicio)
 *   - hasta: "2026-02-17" (fecha fin)
 *   - preset: "hoy|esta-semana|proxima-semana|este-mes|proximo-mes"
 *   - tipos: "entrenamientos,partidos,eventos" (tipos a incluir)
 */
router.get('/cronograma', asyncHandler(async (req, res) => {
  const {
    actividadIds,
    categoriaIds,
    desde,
    hasta,
    preset,
    tipos = 'entrenamientos,partidos'
  } = req.query

  // Parsear arrays de IDs
  const actividades = actividadIds ? actividadIds.split(',').map(Number).filter(Boolean) : []
  const categorias = categoriaIds ? categoriaIds.split(',').map(Number).filter(Boolean) : []
  const tiposArray = tipos.split(',').map(t => t.trim())

  // Calcular rango de fechas
  let fechaDesde, fechaHasta

  if (preset) {
    const rango = calcularRangoFecha(preset)
    fechaDesde = rango.desde
    fechaHasta = rango.hasta
  } else {
    fechaDesde = desde ? new Date(desde) : new Date()
    fechaHasta = hasta ? new Date(hasta) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // +30 días
  }

  fechaDesde.setHours(0, 0, 0, 0)
  fechaHasta.setHours(23, 59, 59, 999)

  const resultado = {
    entrenamientos: [],
    partidos: [],
    eventos: []
  }

  // 1. ENTRENAMIENTOS (horarios recurrentes)
  if (tiposArray.includes('entrenamientos')) {
    const whereEntrenamientos = { activo: true }

    if (categorias.length > 0) {
      whereEntrenamientos.categoriaActividadId = { in: categorias }
    }

    let horarios = await req.db.horarioRecurrente.findMany({
      where: whereEntrenamientos,
      include: {
        categoriaActividad: {
          include: {
            actividad: true
          }
        }
      },
      orderBy: [
        { diaSemana: 'asc' },
        { horaInicio: 'asc' }
      ]
    })

    // Filtrar por actividades si se especificó
    if (actividades.length > 0) {
      horarios = horarios.filter(h =>
        actividades.includes(h.categoriaActividad.actividadId)
      )
    }

    // Generar instancias de entrenamientos en el rango de fechas
    resultado.entrenamientos = generarInstanciasEntrenamientos(
      horarios,
      fechaDesde,
      fechaHasta
    )
  }

  // 2. PARTIDOS
  if (tiposArray.includes('partidos')) {
    const wherePartidos = {
      fecha: {
        gte: fechaDesde,
        lte: fechaHasta
      }
    }

    if (categorias.length > 0) {
      wherePartidos.categoriaActividadId = { in: categorias }
    }

    let partidos = await req.db.partido.findMany({
      where: wherePartidos,
      include: {
        categoriaActividad: {
          include: {
            actividad: true
          }
        },
        espacio: true
      },
      orderBy: [
        { fecha: 'asc' },
        { hora: 'asc' }
      ]
    })

    // Filtrar por actividades
    if (actividades.length > 0) {
      partidos = partidos.filter(p =>
        actividades.includes(p.categoriaActividad.actividadId)
      )
    }

    resultado.partidos = partidos.map(p => ({
      id: p.id,
      tipo: 'partido',
      fecha: p.fecha,
      hora: p.hora,
      titulo: `${p.categoriaActividad.nombre} vs ${p.rival}`,
      actividad: p.categoriaActividad.actividad.nombre,
      actividadId: p.categoriaActividad.actividadId,
      categoria: p.categoriaActividad.nombre,
      categoriaId: p.categoriaActividadId,
      rival: p.rival,
      condicion: p.condicion,
      tipoPartido: p.tipo,
      ubicacion: p.ubicacion,
      espacio: p.espacio?.nombre,
      estado: p.estado,
      resultado: p.estado === 'FINALIZADO' ? {
        golesLocal: p.golesLocal,
        golesVisitante: p.golesVisitante
      } : null
    }))
  }

  res.json({
    success: true,
    filtros: {
      actividades,
      categorias,
      desde: fechaDesde,
      hasta: fechaHasta,
      tipos: tiposArray
    },
    data: resultado
  })
}))

/**
 * GET /api/public/actividades/:id/staff
 * Obtener staff técnico de una actividad (desde entrenadores)
 */
router.get('/actividades/:id/staff', asyncHandler(async (req, res) => {
  const { id } = req.params
  const { categoriaId } = req.query

  // Buscar entrenadores que:
  // 1. Tienen mostrarEnWeb = true
  // 2. Están asignados a categorías de esta actividad
  const whereCategoria = {
    activo: true
  }

  if (categoriaId) {
    whereCategoria.categoriaActividadId = parseInt(categoriaId)
  } else {
    // Obtener todas las categorías de esta actividad
    const categorias = await req.db.categoriaActividad.findMany({
      where: { actividadId: parseInt(id), activo: true },
      select: { id: true }
    })
    whereCategoria.categoriaActividadId = {
      in: categorias.map(c => c.id)
    }
  }

  const asignaciones = await req.db.entrenadorCategoria.findMany({
    where: {
      ...whereCategoria,
      entrenador: { mostrarEnWeb: true, activo: true },
    },
    include: {
      entrenador: {
        include: {
          entidad: { select: { razonSocial: true } },
        },
      },
      categoriaActividad: {
        select: {
          id: true,
          nombre: true,
          codigo: true
        }
      }
    },
    orderBy: [
      { entrenador: { ordenStaff: 'asc' } },
      { entrenador: { entidad: { razonSocial: 'asc' } } }
    ]
  })

  // Filtrar solo las asignaciones donde el entrenador existe y está visible
  const staffVisible = asignaciones
    .filter(a => a.entrenador && a.entrenador.mostrarEnWeb)
    .map(a => {
      const nombre = a.entrenador.entidad?.razonSocial || ''
      return {
        id: a.entrenador.id,
        nombre,
        nombreCompleto: nombre,
        rol: a.rol,
        foto: a.entrenador.fotoStaff,
        email: a.entrenador.emailPublico,
        telefono: a.entrenador.telefonoPublico,
        biografia: a.entrenador.biografiaStaff,
        categoria: {
          id: a.categoriaActividad.id,
          nombre: a.categoriaActividad.nombre,
          codigo: a.categoriaActividad.codigo
        }
      }
    })

  res.json({
    success: true,
    data: staffVisible
  })
}))

/**
 * GET /api/public/actividades/:id/noticias
 * Obtener noticias de una actividad
 */
router.get('/actividades/:id/noticias', asyncHandler(async (req, res) => {
  const { id } = req.params
  const { limit = 10, offset = 0, categoriaId } = req.query

  const where = {
    actividadId: parseInt(id),
    activo: true
  }

  if (categoriaId) {
    where.categoriaId = parseInt(categoriaId)
  }

  const noticias = await req.db.noticiaDeportiva.findMany({
    where,
    include: {
      categoria: {
        select: {
          id: true,
          nombre: true
        }
      }
    },
    orderBy: [
      { destacada: 'desc' },
      { fechaPublicacion: 'desc' }
    ],
    take: parseInt(limit),
    skip: parseInt(offset)
  })

  const total = await req.db.noticiaDeportiva.count({ where })

  res.json({
    success: true,
    data: noticias,
    pagination: {
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: total > parseInt(offset) + parseInt(limit)
    }
  })
}))

/**
 * GET /api/public/partidos/proximos
 * Obtener próximos partidos
 */
router.get('/partidos/proximos', asyncHandler(async (req, res) => {
  const { actividadId, categoriaId, limit = 10 } = req.query

  const where = {
    fecha: {
      gte: new Date()
    },
    estado: 'PROGRAMADO'
  }

  if (actividadId) {
    const actividad = await req.db.actividad.findUnique({
      where: { id: parseInt(actividadId) },
      include: {
        categorias: {
          select: { id: true }
        }
      }
    })

    if (actividad) {
      where.categoriaActividadId = {
        in: actividad.categorias.map(c => c.id)
      }
    }
  }

  if (categoriaId) {
    where.categoriaActividadId = parseInt(categoriaId)
  }

  const partidos = await req.db.partido.findMany({
    where,
    include: {
      categoriaActividad: {
        include: {
          actividad: true
        }
      },
      espacio: true
    },
    orderBy: [
      { fecha: 'asc' },
      { hora: 'asc' }
    ],
    take: parseInt(limit)
  })

  res.json({
    success: true,
    data: partidos.map(p => ({
      id: p.id,
      fecha: p.fecha,
      hora: p.hora,
      actividad: p.categoriaActividad.actividad.nombre,
      categoria: p.categoriaActividad.nombre,
      rival: p.rival,
      condicion: p.condicion,
      tipo: p.tipo,
      ubicacion: p.condicion === 'VISITANTE' ? p.ubicacion : (p.espacio?.nombre || 'A confirmar'),
      espacio: p.espacio
    }))
  })
}))

/**
 * GET /api/public/reglamento
 * Obtener reglamento de convivencia
 */
router.get('/reglamento', asyncHandler(async (req, res) => {
  const articulos = await req.db.articuloReglamento.findMany({
    where: { activo: true },
    orderBy: [
      { seccion: 'asc' },
      { orden: 'asc' }
    ]
  })

  // Agrupar por sección
  const porSeccion = articulos.reduce((acc, art) => {
    if (!acc[art.seccion]) {
      acc[art.seccion] = []
    }
    acc[art.seccion].push(art)
    return acc
  }, {})

  res.json({
    success: true,
    data: porSeccion
  })
}))

// GET /api/public/pagina/:slug — contenido editable de páginas del sitio
router.get('/pagina/:slug', asyncHandler(async (req, res) => {
  const { slug } = req.params
  const VALIDAS = ['historia']
  if (!VALIDAS.includes(slug)) return res.status(404).json({ error: 'Página no encontrada' })

  const clave = `PAGINA_${slug.toUpperCase()}`
  const config = await req.db.configuracion.findFirst({ where: { clave } })

  res.json({ success: true, data: config?.valor ? JSON.parse(config.valor) : null })
}))

export default router
