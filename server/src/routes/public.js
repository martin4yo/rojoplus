/**
 * Rutas públicas (sin autenticación)
 * - Solicitud de alta de nuevos socios
 * - Registro de comercios
 * - etc.
 */

import express from 'express'
import { asyncHandler, AppError } from '../utils/errors.js'
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
    actividadInscripcion,
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
      !email || !actividadInscripcion) {
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
      actividadInscripcion,
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

    await enviarEmailConTemplate('SOLICITUD_RECIBIDA', email, {
      nombreCompleto: `${nombres} ${apellidos}`,
      clubNombre,
      numeroSolicitud: solicitud.id,
      actividadInscripcion
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

export default router
