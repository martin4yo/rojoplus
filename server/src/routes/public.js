/**
 * Rutas públicas (sin autenticación)
 * - Solicitud de alta de nuevos socios
 * - Registro de comercios
 * - etc.
 */

import express from 'express'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { enviarEmailConTemplate } from '../services/notificacionService.js'

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
  const solicitudExistente = await req.prisma.solicitudSocio.findFirst({
    where: {
      documento,
      estado: 'PENDIENTE'
    }
  })

  if (solicitudExistente) {
    throw new AppError('Ya existe una solicitud pendiente con este número de documento', 400)
  }

  // Validar que no exista un socio activo con el mismo documento
  const socioExistente = await req.prisma.socio.findFirst({
    where: {
      documento,
      estado: 'ACTIVO'
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
  const solicitud = await req.prisma.solicitudSocio.create({
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
    const clubNombre = (await req.prisma.configuracion.findUnique({
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
    })
  } catch (emailError) {
    console.error('Error enviando email de confirmación:', emailError)
    // No fallar la solicitud si el email falla
  }

  // Notificar a los administradores
  try {
    const emailsAdmin = await req.prisma.admin.findMany({
      where: { activo: true },
      select: { email: true }
    })

    const clubNombre = (await req.prisma.configuracion.findUnique({
      where: { clave: 'CLUB_NOMBRE' }
    }))?.valor || 'Club Sportivo Pilar'

    for (const admin of emailsAdmin) {
      await enviarEmailConTemplate('NOTIF_NUEVA_SOLICITUD', admin.email, {
        nombreCompleto: `${nombres} ${apellidos}`,
        documento,
        email,
        telefono,
        actividadInscripcion,
        numeroSolicitud: solicitud.id,
        urlGestion: `${process.env.FRONTEND_URL}/admin/solicitudes/${solicitud.id}`
      })
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
  const solicitud = await req.prisma.solicitudSocio.findUnique({
    where: { id: parseInt(id) }
  })

  if (!solicitud) {
    throw new AppError('Solicitud no encontrada', 404)
  }

  if (solicitud.estado !== 'PENDIENTE') {
    throw new AppError('No se pueden agregar familiares a una solicitud ya procesada', 400)
  }

  // Verificar que no exista un familiar con el mismo documento en esta solicitud
  const familiarExistente = await req.prisma.familiarSolicitud.findFirst({
    where: {
      solicitudSocioId: parseInt(id),
      documento
    }
  })

  if (familiarExistente) {
    throw new AppError('Ya existe un familiar con este número de documento en esta solicitud', 400)
  }

  // Crear el familiar
  const familiar = await req.prisma.familiarSolicitud.create({
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

  const familiares = await req.prisma.familiarSolicitud.findMany({
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
  const solicitud = await req.prisma.solicitudSocio.findUnique({
    where: { id: parseInt(id) }
  })

  if (!solicitud) {
    throw new AppError('Solicitud no encontrada', 404)
  }

  if (solicitud.estado !== 'PENDIENTE') {
    throw new AppError('No se pueden eliminar familiares de una solicitud ya procesada', 400)
  }

  // Verificar que el familiar pertenece a esta solicitud
  const familiar = await req.prisma.familiarSolicitud.findFirst({
    where: {
      id: parseInt(familiarId),
      solicitudSocioId: parseInt(id)
    }
  })

  if (!familiar) {
    throw new AppError('Familiar no encontrado', 404)
  }

  // Eliminar el familiar
  await req.prisma.familiarSolicitud.delete({
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

  const solicitud = await req.prisma.solicitudSocio.findFirst({
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
  const actividades = await req.prisma.actividad.findMany({
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

  const actividad = await req.prisma.actividad.findUnique({
    where: { id: parseInt(id) },
    include: {
      categorias: {
        where: { activo: true },
        include: {
          horarios: {
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
      horarios: cat.horarios.map(h => ({
        diaSemana: h.diaSemana,
        horaInicio: h.horaInicio,
        horaFin: h.horaFin
      }))
    }))
  })
}))

export default router
