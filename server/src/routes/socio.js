import { Router } from 'express'
import crypto from 'crypto'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { enviarMagicLinkSocio } from '../services/email.js'
import { enviarLinkPortal } from '../services/whatsappService.js'
import { crearPreferenciaPago } from '../services/mercadopago.js'
import { tokenizarTarjeta as paywayTokenizar } from '../services/paywayService.js'
import { generatePDF } from '../services/pdfGenerator.js'
import { getTenantFrontendUrl } from '../lib/tenantUrl.js'
import { getVapidPublicKey, enviarNotificacionPush } from '../services/webPush.js'

const router = Router()

// ==============================================================================
// BÚSQUEDA PÚBLICA (para obtener QR) - DEBE IR PRIMERO
// ==============================================================================

// POST /api/socio/enviar-qr - Enviar QR por email (seguro)
router.post('/enviar-qr', asyncHandler(async (req, res) => {
  const { busqueda } = req.body

  if (!busqueda || !busqueda.trim()) {
    throw new AppError('Ingresa tu número de socio o DNI', 400, 'VALIDATION_ERROR')
  }

  const socio = await req.db.socio.findFirst({
    where: {
      OR: [
        { nroSocio: busqueda.trim() },
        { documento: busqueda.trim() },
      ],
    },
    select: {
      id: true,
      nroSocio: true,
      apellidoNombre: true,
      email: true,
      tokenPortal: true,
      estado: true,
    },
  })

  if (!socio) {
    throw new AppError('No se encontró un socio con ese número o DNI', 404, 'SOCIO_NOT_FOUND')
  }

  // Verificar si está activo
  const estadoUpper = socio.estado?.toUpperCase() || ''
  const esActivo = estadoUpper.includes('ACTIV') || estadoUpper.includes('VIGENT')

  if (!esActivo) {
    throw new AppError('Tu membresía no está activa. Regulariza tu situación en el club.', 403, 'SOCIO_INACTIVO')
  }

  if (!socio.email) {
    throw new AppError('No tenés email registrado. Contacta al club para actualizarlo.', 400, 'NO_EMAIL')
  }

  if (!socio.tokenPortal) {
    throw new AppError('Error al obtener tu QR. Contacta al club.', 500, 'NO_TOKEN')
  }

  // Generar URL del QR y portal
  const baseUrl = getTenantFrontendUrl(req.tenant)
  const portalUrl = `${baseUrl}/portal-socio/${socio.tokenPortal}`
  const qrUrl = `${baseUrl}/s/${socio.tokenPortal}`

  // Enviar email con QR
  const { enviarEmailQRSocio } = await import('../services/email.js')
  await enviarEmailQRSocio({
    to: socio.email,
    socioNombre: socio.apellidoNombre,
    nroSocio: socio.nroSocio,
    qrUrl,
    portalUrl,
    db: req.db,
  })

  // Ocultar parte del email para la respuesta
  const emailOculto = socio.email.replace(/(.{2})(.*)(@.*)/, '$1***$3')

  res.json({
    success: true,
    message: 'QR enviado correctamente',
    data: {
      emailEnviado: emailOculto,
    },
  })
}))

// POST /api/socio/enviar-link-whatsapp - Enviar link de acceso al portal por WhatsApp
router.post('/enviar-link-whatsapp', asyncHandler(async (req, res) => {
  const { busqueda } = req.body

  if (!busqueda?.trim()) {
    throw new AppError('Ingresa tu número de socio o DNI', 400, 'VALIDATION_ERROR')
  }

  const socio = await req.db.socio.findFirst({
    where: {
      OR: [
        { nroSocio: busqueda.trim() },
        { documento: busqueda.trim() },
      ],
    },
    select: {
      id: true,
      nroSocio: true,
      apellidoNombre: true,
      celular: true,
      tokenPortal: true,
      estado: true,
    },
  })

  if (!socio) {
    throw new AppError('No se encontró un socio con ese número o DNI', 404, 'SOCIO_NOT_FOUND')
  }

  const estadoUpper = socio.estado?.toUpperCase() || ''
  const esActivo = estadoUpper.includes('ACTIV') || estadoUpper.includes('VIGENT')
  if (!esActivo) {
    throw new AppError('Tu membresía no está activa. Regulariza tu situación en el club.', 403, 'SOCIO_INACTIVO')
  }

  if (!socio.celular) {
    throw new AppError('No tenés celular registrado. Contacta al club para actualizarlo.', 400, 'NO_CELULAR')
  }

  if (!socio.tokenPortal) {
    throw new AppError('Error al obtener tu acceso. Contacta al club.', 500, 'NO_TOKEN')
  }

  const portalUrl = `${getTenantFrontendUrl(req.tenant)}/portal-socio/${socio.tokenPortal}`

  const { enviarWhatsApp } = await import('../services/whatsappService.js')
  const resultado = await enviarWhatsApp({
    db: req.db,
    telefono: socio.celular,
    texto: `Hola ${socio.apellidoNombre.split(',')[0].trim()}! Aquí está tu link de acceso al portal del socio:\n\n${portalUrl}\n\nGuardalo para acceder a tus datos, pagos y beneficios.`,
    ignorarHorario: true,
  })

  if (!resultado.enviado) {
    throw new AppError(
      resultado.motivo || 'No se pudo enviar por WhatsApp. Intentá por email.',
      503,
      'WA_NOT_AVAILABLE'
    )
  }

  // Ocultar parte del celular para la respuesta
  const celularOculto = socio.celular.replace(/(\d{3})\d+(\d{3})/, '$1****$2')

  res.json({
    success: true,
    message: 'Link enviado por WhatsApp correctamente',
    data: { celularEnviado: celularOculto },
  })
}))

// POST /api/socio/enviar-qr-whatsapp - Enviar imagen del QR por WhatsApp
router.post('/enviar-qr-whatsapp', asyncHandler(async (req, res) => {
  const { busqueda } = req.body

  if (!busqueda?.trim()) {
    throw new AppError('Ingresa tu número de socio o DNI', 400, 'VALIDATION_ERROR')
  }

  const socio = await req.db.socio.findFirst({
    where: {
      OR: [
        { nroSocio: busqueda.trim() },
        { documento: busqueda.trim() },
      ],
    },
    select: {
      id: true,
      nroSocio: true,
      apellidoNombre: true,
      celular: true,
      tokenPortal: true,
      estado: true,
    },
  })

  if (!socio) {
    throw new AppError('No se encontró un socio con ese número o DNI', 404, 'SOCIO_NOT_FOUND')
  }

  const estadoUpper = socio.estado?.toUpperCase() || ''
  const esActivo = estadoUpper.includes('ACTIV') || estadoUpper.includes('VIGENT')
  if (!esActivo) {
    throw new AppError('Tu membresía no está activa. Regularizá tu situación en el club.', 403, 'SOCIO_INACTIVO')
  }

  if (!socio.celular) {
    throw new AppError('No tenés celular registrado. Contactá al club para actualizarlo.', 400, 'NO_CELULAR')
  }

  if (!socio.tokenPortal) {
    throw new AppError('Error al obtener tu QR. Contactá al club.', 500, 'NO_TOKEN')
  }

  const qrUrl = `${getTenantFrontendUrl(req.tenant)}/s/${socio.tokenPortal}`

  // Leer color primario del branding del tenant (fallback rojo)
  const tenant = await req.db.tenant.findUnique({
    where: { id: req.tenantId },
    select: { colores: true },
  })
  const colores = tenant?.colores && typeof tenant.colores === 'object' ? tenant.colores : {}
  const colorPrimario = colores.primario || '#DC2626'

  // Generar QR como buffer PNG
  const QRCode = (await import('qrcode')).default
  const qrBuffer = await QRCode.toBuffer(qrUrl, {
    width: 400,
    errorCorrectionLevel: 'H',
    margin: 2,
    color: { dark: colorPrimario, light: '#FFFFFF' },
  })

  // Componer imagen final: fondo blanco + borde redondeado del color primario + QR centrado
  const { createCanvas, loadImage } = await import('canvas')
  const border = 16
  const radius = 18
  const qrSize = 400
  const totalSize = qrSize + border * 2

  const canvas = createCanvas(totalSize, totalSize)
  const ctx = canvas.getContext('2d')

  // Fondo blanco con borde redondeado
  ctx.fillStyle = '#FFFFFF'
  ctx.beginPath()
  ctx.roundRect(0, 0, totalSize, totalSize, radius)
  ctx.fill()

  // Borde de color primario
  ctx.strokeStyle = colorPrimario
  ctx.lineWidth = border
  ctx.beginPath()
  ctx.roundRect(border / 2, border / 2, totalSize - border, totalSize - border, radius - border / 2)
  ctx.stroke()

  // QR centrado
  const qrImage = await loadImage(qrBuffer)
  ctx.drawImage(qrImage, border, border, qrSize, qrSize)

  const imagenBase64 = canvas.toBuffer('image/png').toString('base64')

  const nombre = socio.apellidoNombre.split(',')[0].trim()
  const caption = `Hola ${nombre}! Este es tu código QR de socio N° ${socio.nroSocio}.\nPresentalo en comercios adheridos para obtener descuentos.`

  const { enviarWhatsAppImagen } = await import('../services/whatsappService.js')
  const resultado = await enviarWhatsAppImagen({
    db: req.db,
    telefono: socio.celular,
    imagenBase64,
    caption,
    ignorarHorario: true,
  })

  if (!resultado.enviado) {
    throw new AppError(
      resultado.motivo || 'No se pudo enviar por WhatsApp. Intentá por email.',
      503,
      'WA_NOT_AVAILABLE'
    )
  }

  const celularOculto = socio.celular.replace(/(\d{3})\d+(\d{3})/, '$1****$2')

  res.json({
    success: true,
    message: 'QR enviado por WhatsApp correctamente',
    data: { celularEnviado: celularOculto },
  })
}))

// ==============================================================================
// AUTENTICACIÓN - MAGIC LINK
// ==============================================================================

// POST /api/socio/enviar-link-acceso - Enviar Magic Link al socio
router.post('/enviar-link-acceso', asyncHandler(async (req, res) => {
  const { metodo, valor } = req.body // metodo: 'email' | 'dni' | 'whatsapp'

  if (!metodo || !valor) {
    throw new AppError('Método y valor son requeridos', 400, 'VALIDATION_ERROR')
  }

  // Buscar socio según método
  let where
  if (metodo === 'email') {
    where = { email: valor.trim().toLowerCase() }
  } else if (metodo === 'dni') {
    where = { documento: valor.trim() }
  } else if (metodo === 'whatsapp') {
    // Buscar en los 3 campos de teléfono
    const tel = valor.trim().replace(/\D/g, '')
    where = { OR: [{ celular: { contains: tel } }, { celularSecundario: { contains: tel } }, { telefonoFijo: { contains: tel } }] }
  } else {
    throw new AppError('Método inválido', 400, 'VALIDATION_ERROR')
  }

  const socio = await req.db.socio.findFirst({
    where,
    select: {
      id: true,
      nroSocio: true,
      apellidoNombre: true,
      email: true,
      documento: true,
      estado: true,
      celular: true,
      celularSecundario: true,
      telefonoFijo: true,
      notifWhatsapp: true,
    },
  })

  if (!socio) {
    throw new AppError('No se encontró un socio con esos datos', 404, 'SOCIO_NOT_FOUND')
  }

  if (metodo !== 'whatsapp' && !socio.email) {
    throw new AppError('Este socio no tiene email registrado. Contactá al club para actualizarlo', 400, 'NO_EMAIL')
  }

  if (metodo === 'whatsapp') {
    const telefono = socio.celular || socio.celularSecundario || socio.telefonoFijo
    if (!telefono) {
      throw new AppError('Este socio no tiene teléfono registrado. Contactá al club.', 400, 'NO_PHONE')
    }
  }

  // Verificar estado activo
  const estadoUpper = socio.estado?.toUpperCase() || ''
  const esActivo = estadoUpper.includes('ACTIV') || estadoUpper.includes('VIGENT')

  if (!esActivo) {
    throw new AppError('Tu membresía no está activa. Contactá al club para regularizar tu situación', 403, 'SOCIO_INACTIVO')
  }

  // Generar token único con expiración de 24 horas
  const token = crypto.randomBytes(32).toString('hex')
  const expiracion = new Date()
  expiracion.setHours(expiracion.getHours() + 24)

  // Guardar token en BD (usaremos tokenPortal + tokenPortalExpira)
  await req.db.socio.update({
    where: { id: socio.id },
    data: {
      tokenPortal: token,
      tokenPortalExpira: expiracion,
    },
  })

  const portalLink = `${getTenantFrontendUrl(req.tenant)}/portal-socio/${token}`

  if (metodo === 'whatsapp') {
    // Enviar solo por WhatsApp
    const telefono = socio.celular || socio.celularSecundario || socio.telefonoFijo
    await enviarLinkPortal({ db: req.db, socio: { ...socio, celular: telefono }, link: portalLink })
    const telOculto = telefono.replace(/(\d{3})\d+(\d{3})/, '$1****$2')
    res.json({
      success: true,
      message: 'Link de acceso enviado por WhatsApp',
      data: { telefonoEnviado: telOculto },
    })
    return
  }

  // Enviar email con Magic Link
  await enviarMagicLinkSocio(socio, token, req.db)

  // Enviar también por WhatsApp si el socio tiene el canal habilitado
  if (socio.notifWhatsapp && (socio.celular || socio.celularSecundario)) {
    req.db.configuracion.findFirst({ where: { clave: 'WHATSAPP_NOTIF_MAGIC_LINK' } })
      .then(flag => {
        if (flag?.valor !== 'false') {
          const tel = socio.celular || socio.celularSecundario
          enviarLinkPortal({ db: req.db, socio: { ...socio, celular: tel }, link: portalLink })
            .catch(err => console.error('Error enviando magic link por WA:', err.message))
        }
      })
      .catch(err => console.error('Error leyendo flag WA magic link:', err.message))
  }

  res.json({
    success: true,
    message: 'Link de acceso enviado a tu email',
  })
}))

// GET /api/socio/validar-token/:token - Validar token de Magic Link
router.get('/validar-token/:token', asyncHandler(async (req, res) => {
  const { token } = req.params

  const socio = await req.db.socio.findFirst({
    where: {
      tokenPortal: token,
    },
    select: {
      id: true,
      nroSocio: true,
      apellidoNombre: true,
      email: true,
      celular: true,
      documento: true,
      fechaNacimiento: true,
      domicilio: true,
      ciudad: true,
      provincia: true,
      estado: true,
      categoria: true,
      tipoSocio: true,
      tokenPortal: true,
      tokenPortalExpira: true,
      titularFamiliaId: true,
    },
  })

  if (!socio) {
    throw new AppError('Token inválido o expirado', 401, 'INVALID_TOKEN')
  }

  // Verificar expiración (si existe el campo)
  if (socio.tokenPortalExpira && socio.tokenPortalExpira < new Date()) {
    throw new AppError('El link de acceso expiró. Solicitá uno nuevo', 401, 'EXPIRED_TOKEN')
  }

  // Verificar estado activo
  const estadoUpper = socio.estado?.toUpperCase() || ''
  const esActivo = estadoUpper.includes('ACTIV') || estadoUpper.includes('VIGENT')

  res.json({
    success: true,
    data: {
      id: socio.id,
      nroSocio: socio.nroSocio,
      apellidoNombre: socio.apellidoNombre,
      email: socio.email,
      celular: socio.celular,
      documento: socio.documento,
      fechaNacimiento: socio.fechaNacimiento,
      domicilio: socio.domicilio,
      ciudad: socio.ciudad,
      provincia: socio.provincia,
      estado: socio.estado,
      categoria: socio.categoria,
      tipoSocio: socio.tipoSocio,
      tokenPortal: socio.tokenPortal,
      esActivo,
      titularFamiliaId: socio.titularFamiliaId,
    },
  })
}))

// ==============================================================================
// DATOS DEL SOCIO
// ==============================================================================

// GET /api/socio/:tokenPortal - Obtener datos completos del socio
router.get('/:tokenPortal', asyncHandler(async (req, res) => {
  const { tokenPortal } = req.params

  const socio = await req.db.socio.findUnique({
    where: { tokenPortal },
    select: {
      id: true,
      nroSocio: true,
      apellidoNombre: true,
      email: true,
      celular: true,
      documento: true,
      fechaNacimiento: true,
      domicilio: true,
      ciudad: true,
      provincia: true,
      estado: true,
      categoria: true,
      tipoSocio: true,
      tokenPortal: true,
      titularFamiliaId: true,
      titularFamilia: {
        select: {
          id: true,
          nroSocio: true,
          apellidoNombre: true,
          documento: true,
          miembrosFamilia: {
            select: {
              id: true,
              nroSocio: true,
              apellidoNombre: true,
              documento: true,
              fechaNacimiento: true,
            },
            where: {
              estado: {
                contains: 'ACTIV',
              },
            },
          },
        },
      },
      miembrosFamilia: {
        select: {
          id: true,
          nroSocio: true,
          apellidoNombre: true,
          documento: true,
          fechaNacimiento: true,
        },
        where: {
          estado: {
            contains: 'ACTIV',
          },
        },
      },
    },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  const estadoUpper = socio.estado?.toUpperCase() || ''
  const esActivo = estadoUpper.includes('ACTIV') || estadoUpper.includes('VIGENT')

  const branding = req.tenant ? {
    nombre: req.tenant.nombre,
    slogan: req.tenant.slogan,
    logoUrl: req.tenant.logoUrl,
    faviconUrl: req.tenant.faviconUrl,
    colores: req.tenant.colores,
  } : null

  res.json({
    success: true,
    data: {
      ...socio,
      esActivo,
      branding,
      grupoFamiliar: socio.titularFamiliaId ? {
        titular: socio.titularFamilia,
        integrantes: socio.titularFamilia?.miembrosFamilia || [],
      } : socio.miembrosFamilia.length > 0 ? {
        titular: {
          id: socio.id,
          nroSocio: socio.nroSocio,
          apellidoNombre: socio.apellidoNombre,
          documento: socio.documento,
        },
        integrantes: socio.miembrosFamilia,
      } : null,
    },
  })
}))

// PUT /api/socio/:tokenPortal/perfil - Actualizar datos del socio
router.put('/:tokenPortal/perfil', asyncHandler(async (req, res) => {
  const { tokenPortal } = req.params
  const { email, celular, domicilio, ciudad, provincia } = req.body

  const socio = await req.db.socio.findUnique({
    where: { tokenPortal },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  // Actualizar datos permitidos
  const updated = await req.db.socio.update({
    where: { id: socio.id },
    data: {
      email: email?.trim().toLowerCase(),
      celular: celular?.trim(),
      domicilio: domicilio?.trim(),
      ciudad: ciudad?.trim(),
      provincia: provincia?.trim(),
    },
    select: {
      id: true,
      nroSocio: true,
      apellidoNombre: true,
      email: true,
      celular: true,
      domicilio: true,
      ciudad: true,
      provincia: true,
    },
  })

  res.json({
    success: true,
    data: updated,
    message: 'Datos actualizados correctamente',
  })
}))

// ==============================================================================
// ACTIVIDADES E INSCRIPCIONES
// ==============================================================================

// GET /api/socio/:tokenPortal/inscripciones - Obtener actividades del socio
router.get('/:tokenPortal/inscripciones', asyncHandler(async (req, res) => {
  const { tokenPortal } = req.params

  const socio = await req.db.socio.findUnique({
    where: { tokenPortal },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  const inscripciones = await req.db.inscripcion.findMany({
    where: {
      socioId: socio.id,
      estado: 'ACTIVA',
    },
    include: {
      categoriaActividad: {
        include: {
          actividad: {
            select: {
              id: true,
              codigo: true,
              nombre: true,
              descripcion: true,
            },
          },
          entrenadores: {
            include: {
              entrenador: {
                select: {
                  id: true,
                  nombre: true,
                  email: true,
                  telefono: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      fechaInscripcion: 'desc',
    },
  })

  const result = inscripciones.map(insc => ({
    id: insc.id,
    fechaInscripcion: insc.fechaInscripcion,
    fechaInicio: insc.fechaInicio,
    estado: insc.estado,
    actividad: insc.categoriaActividad.actividad.nombre,
    categoria: insc.categoriaActividad.nombre,
    descripcion: insc.categoriaActividad.descripcion,
    horarios: insc.categoriaActividad.horarios,
    cuotaMensual: insc.categoriaActividad.cuotaMensual,
    entrenador: insc.categoriaActividad.entrenadores[0]?.entrenador?.nombre || null,
    entrenadorEmail: insc.categoriaActividad.entrenadores[0]?.entrenador?.email || null,
    entrenadorCelular: insc.categoriaActividad.entrenadores[0]?.entrenador?.celular || null,
  }))

  res.json({
    success: true,
    data: result,
  })
}))

// GET /api/socio/:tokenPortal/actividades-disponibles - Obtener actividades disponibles
router.get('/:tokenPortal/actividades-disponibles', asyncHandler(async (req, res) => {
  const { tokenPortal } = req.params

  const socio = await req.db.socio.findUnique({
    where: { tokenPortal },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  // Obtener IDs de categorías en las que ya está inscripto
  const inscripciones = await req.db.inscripcion.findMany({
    where: {
      socioId: socio.id,
      estado: 'ACTIVA',
    },
    select: {
      categoriaActividadId: true,
    },
  })

  const categoriasInscriptas = inscripciones.map(i => i.categoriaActividadId)

  // Obtener categorías disponibles (no inscriptas, activas, con cupos)
  const categoriasDisponibles = await req.db.categoriaActividad.findMany({
    where: {
      activo: true,
      id: {
        notIn: categoriasInscriptas,
      },
      OR: [
        { cupoMaximo: null },
        {
          cupoMaximo: {
            gt: await req.db.inscripcion.count({
              where: {
                categoriaActividadId: { in: undefined }, // Se calculará por categoría
                estado: 'ACTIVA',
              },
            }),
          },
        },
      ],
    },
    include: {
      actividad: {
        select: {
          id: true,
          codigo: true,
          nombre: true,
          descripcion: true,
        },
      },
      entrenadores: {
        include: {
          entrenador: {
            select: {
              nombre: true,
            },
          },
        },
      },
      _count: {
        select: {
          inscripciones: {
            where: {
              estado: 'ACTIVA',
            },
          },
        },
      },
    },
    orderBy: [
      { actividad: { nombre: 'asc' } },
      { nombre: 'asc' },
    ],
  })

  const result = categoriasDisponibles
    .filter(cat => {
      // Filtrar las que tienen cupos disponibles
      const inscriptos = cat._count.inscripciones
      return !cat.cupoMaximo || inscriptos < cat.cupoMaximo
    })
    .map(cat => ({
      id: cat.id,
      actividad: cat.actividad.nombre,
      categoria: cat.nombre,
      descripcion: cat.descripcion,
      horarios: cat.horarios,
      cuotaMensual: cat.cuotaMensual,
      entrenador: cat.entrenadores[0]?.entrenador?.nombre || null,
      cuposDisponibles: cat.cupoMaximo ? cat.cupoMaximo - cat._count.inscripciones : null,
      cupoMaximo: cat.cupoMaximo,
    }))

  res.json({
    success: true,
    data: result,
  })
}))

// POST /api/socio/:tokenPortal/inscripciones - Inscribirse en una actividad
router.post('/:tokenPortal/inscripciones', asyncHandler(async (req, res) => {
  const { tokenPortal } = req.params
  const { categoriaActividadId } = req.body

  const socio = await req.db.socio.findUnique({
    where: { tokenPortal },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  // Verificar que la categoría existe y está activa
  const categoria = await req.db.categoriaActividad.findUnique({
    where: { id: parseInt(categoriaActividadId) },
    include: {
      _count: {
        select: {
          inscripciones: {
            where: { estado: 'ACTIVA' },
          },
        },
      },
    },
  })

  if (!categoria || !categoria.activa) {
    throw new AppError('Categoría no disponible', 400, 'CATEGORIA_NO_DISPONIBLE')
  }

  // Verificar cupos
  if (categoria.cupoMaximo && categoria._count.inscripciones >= categoria.cupoMaximo) {
    throw new AppError('No hay cupos disponibles', 400, 'SIN_CUPOS')
  }

  // Verificar que no esté ya inscripto
  const inscripcionExistente = await req.db.inscripcion.findFirst({
    where: {
      socioId: socio.id,
      categoriaActividadId: parseInt(categoriaActividadId),
      estado: 'ACTIVA',
    },
  })

  if (inscripcionExistente) {
    throw new AppError('Ya estás inscripto en esta actividad', 400, 'YA_INSCRIPTO')
  }

  // Crear inscripción
  const inscripcion = await req.db.inscripcion.create({
    data: {
      socioId: socio.id,
      categoriaActividadId: parseInt(categoriaActividadId),
      fechaInicio: new Date(),
      estado: 'ACTIVA',
    },
    include: {
      categoriaActividad: {
        include: {
          actividad: true,
        },
      },
    },
  })

  res.json({
    success: true,
    data: inscripcion,
    message: `Te inscribiste exitosamente en ${inscripcion.categoriaActividad.actividad.nombre} - ${inscripcion.categoriaActividad.nombre}`,
  })
}))

// POST /api/socio/:tokenPortal/inscripciones/:id/baja - Darse de baja de una actividad
router.post('/:tokenPortal/inscripciones/:id/baja', asyncHandler(async (req, res) => {
  const { tokenPortal, id } = req.params
  const { motivo } = req.body

  const socio = await req.db.socio.findUnique({
    where: { tokenPortal },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  const inscripcion = await req.db.inscripcion.findFirst({
    where: {
      id: parseInt(id),
      socioId: socio.id,
      estado: 'ACTIVA',
    },
  })

  if (!inscripcion) {
    throw new AppError('Inscripción no encontrada', 404, 'INSCRIPCION_NOT_FOUND')
  }

  // Dar de baja
  await req.db.inscripcion.update({
    where: { id: inscripcion.id },
    data: {
      estado: 'BAJA',
      fechaFin: new Date(),
      motivoFin: motivo || 'Baja solicitada por el socio desde el portal',
    },
  })

  res.json({
    success: true,
    message: 'Baja registrada correctamente',
  })
}))

// GET /api/socio/:tokenPortal/historial-asistencia - Historial de asistencia por actividad
router.get('/:tokenPortal/historial-asistencia', asyncHandler(async (req, res) => {
  const { tokenPortal } = req.params
  const dias = parseInt(req.query.dias || '90')

  const socio = await req.db.socio.findUnique({ where: { tokenPortal } })
  if (!socio) throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')

  const inscripciones = await req.db.inscripcion.findMany({
    where: { socioId: socio.id, estado: { in: ['ACTIVA', 'BAJA'] } },
    include: {
      categoriaActividad: {
        include: { actividad: { select: { nombre: true } } }
      }
    },
    orderBy: { fechaInscripcion: 'desc' }
  })

  const fechaDesde = new Date()
  fechaDesde.setDate(fechaDesde.getDate() - dias)
  fechaDesde.setHours(0, 0, 0, 0)

  const resultado = await Promise.all(
    inscripciones.map(async insc => {
      const categoriaId = insc.categoriaActividadId

      const entrenamientos = await req.db.entrenamiento.findMany({
        where: {
          categoriaActividadId: categoriaId,
          fecha: { gte: fechaDesde },
          estado: { not: 'CANCELADO' },
        },
        include: {
          asistencias: {
            where: { socioId: socio.id },
            select: { estado: true, horaLlegada: true }
          }
        },
        orderBy: { fecha: 'desc' }
      })

      const total = entrenamientos.length
      const presentes = entrenamientos.filter(e => e.asistencias[0]?.estado === 'PRESENTE').length
      const pct = total > 0 ? Math.round((presentes / total) * 100) : null

      return {
        inscripcionId: insc.id,
        actividad: insc.categoriaActividad.actividad.nombre,
        categoria: insc.categoriaActividad.nombre,
        estado: insc.estado,
        resumen: { total, presentes, ausentes: total - presentes, pct },
        entrenamientos: entrenamientos.map(e => ({
          id: e.id,
          fecha: e.fecha,
          horaInicio: e.horaInicio,
          horaFin: e.horaFin,
          tipo: e.tipo,
          asistencia: e.asistencias[0]?.estado || null,
          horaLlegada: e.asistencias[0]?.horaLlegada || null,
        }))
      }
    })
  )

  // Solo devolver inscripciones que tienen entrenamientos en el período (o todas las activas)
  const data = resultado.filter(r => r.estado === 'ACTIVA' || r.resumen.total > 0)

  res.json({ success: true, data })
}))

// ==============================================================================
// DASHBOARD
// ==============================================================================

// GET /api/socio/:tokenPortal/estado-cuenta - Obtener resumen de estado de cuenta
router.get('/:tokenPortal/estado-cuenta', asyncHandler(async (req, res) => {
  const { tokenPortal } = req.params

  const socio = await req.db.socio.findUnique({
    where: { tokenPortal },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  // Contar cuotas pendientes
  const cuotasPendientes = await req.db.cargo.count({
    where: {
      socioId: socio.id,
      estado: {
        in: ['PENDIENTE', 'VENCIDO'],
      },
    },
  })

  // Calcular monto total pendiente
  const cargos = await req.db.cargo.findMany({
    where: {
      socioId: socio.id,
      estado: {
        in: ['PENDIENTE', 'VENCIDO'],
      },
    },
  })

  const montoPendiente = cargos.reduce((sum, c) => sum + parseFloat(c.montoTotal), 0)

  // Contar actividades activas
  const actividadesActivas = await req.db.inscripcion.count({
    where: {
      socioId: socio.id,
      estado: 'ACTIVA',
    },
  })

  res.json({
    success: true,
    data: {
      cuotasPendientes,
      montoPendiente,
      actividadesActivas,
    },
  })
}))

// GET /api/socio/:tokenPortal/proximos-eventos - Obtener próximos entrenamientos/eventos
router.get('/:tokenPortal/proximos-eventos', asyncHandler(async (req, res) => {
  const { tokenPortal } = req.params

  const socio = await req.db.socio.findUnique({
    where: { tokenPortal },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  // Obtener inscripciones activas del socio
  const inscripciones = await req.db.inscripcion.findMany({
    where: {
      socioId: socio.id,
      estado: 'ACTIVA',
    },
    include: {
      categoriaActividad: {
        include: {
          actividad: true,
        },
      },
    },
  })

  // TODO: Cuando se implemente el sistema de eventos/horarios de entrenamientos,
  // aquí se devolverá la información real de los próximos eventos
  // Por ahora devolvemos array vacío
  const eventos = []

  res.json({
    success: true,
    data: eventos,
  })
}))

// ==============================================================================
// PAGOS Y CUOTAS
// ==============================================================================

// GET /api/socio/:tokenPortal/cuotas/pendientes - Obtener cuotas pendientes
router.get('/:tokenPortal/cuotas/pendientes', asyncHandler(async (req, res) => {
  const { tokenPortal } = req.params

  const socio = await req.db.socio.findUnique({
    where: { tokenPortal },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  const cargos = await req.db.cargo.findMany({
    where: {
      socioId: socio.id,
      estado: {
        in: ['PENDIENTE', 'VENCIDO'],
      },
    },
    include: {
      periodo: true,
      categoriaActividad: {
        include: {
          actividad: true,
        },
      },
    },
    orderBy: {
      fechaVencimiento: 'asc',
    },
  })

  const result = cargos.map(cargo => {
    // Determinar si está vencido
    const hoy = new Date()
    const vencido = cargo.fechaVencimiento && new Date(cargo.fechaVencimiento) < hoy

    return {
      id: cargo.id,
      concepto: cargo.descripcion || cargo.categoria,
      periodo: cargo.periodo?.nombre || null,
      anio: cargo.periodo?.anio || null,
      montoOriginal: cargo.montoOriginal,
      recargo: cargo.montoRecargo,
      bonificacion: cargo.montoBonificacion,
      montoTotal: cargo.montoTotal,
      fechaVencimiento: cargo.fechaVencimiento,
      estado: vencido ? 'VENCIDO' : 'PENDIENTE',
      tipo: cargo.categoria,
      actividad: cargo.categoriaActividad?.actividad?.nombre || null,
    }
  })

  res.json({
    success: true,
    data: result,
  })
}))

// GET /api/socio/:tokenPortal/pagos/historial - Obtener historial de pagos
router.get('/:tokenPortal/pagos/historial', asyncHandler(async (req, res) => {
  const { tokenPortal } = req.params

  const socio = await req.db.socio.findUnique({
    where: { tokenPortal },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  const pagos = await req.db.pago.findMany({
    where: {
      socioId: socio.id,
      estado: 'CONFIRMADO',
    },
    include: {
      medioPago: true,
      cargos: {
        include: {
          periodo: true,
          categoriaActividad: {
            include: {
              actividad: true,
            },
          },
        },
      },
    },
    orderBy: {
      fecha: 'desc',
    },
    take: 50,
  })

  const result = pagos.map(pago => ({
    id: pago.id,
    numero: pago.numero,
    fecha: pago.fecha,
    monto: pago.montoTotal,
    metodoPago: pago.medioPago?.nombre || 'No especificado',
    comprobante: pago.numero,
    concepto: pago.cargos.map(c => c.descripcion || c.categoria).join(', '),
    cargos: pago.cargos.map(c => ({
      concepto: c.descripcion || c.categoria,
      periodo: c.periodo?.nombre || null,
      monto: c.montoTotal,
    })),
  }))

  res.json({
    success: true,
    data: result,
  })
}))

// POST /api/socio/:tokenPortal/cuotas/:cuotaId/generar-link-pago - Generar link de pago
router.post('/:tokenPortal/cuotas/:cuotaId/generar-link-pago', asyncHandler(async (req, res) => {
  const { tokenPortal, cuotaId } = req.params
  const { metodoPago } = req.body // 'MERCADOPAGO' | 'MODO'

  const socio = await req.db.socio.findUnique({
    where: { tokenPortal },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  const cargo = await req.db.cargo.findFirst({
    where: {
      id: parseInt(cuotaId),
      socioId: socio.id,
      estado: {
        in: ['PENDIENTE', 'VENCIDO'],
      },
    },
    include: {
      periodo: true,
    },
  })

  if (!cargo) {
    throw new AppError('Cuota no encontrada', 404, 'CUOTA_NOT_FOUND')
  }

  // Crear registro de link de pago
  const linkPago = await req.db.linkPago.create({
    data: {
      socioId: socio.id,
      concepto: cargo.descripcion || cargo.categoria,
      descripcion: `Pago de ${cargo.descripcion || cargo.categoria}`,
      montoTotal: cargo.montoTotal,
      cargosIds: JSON.stringify([cargo.id]),
      plataforma: metodoPago,
      estado: 'PENDIENTE',
      initPoint: '', // Se actualiza después
      fechaExpiracion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
    },
  })

  let initPoint = ''

  if (metodoPago === 'MERCADOPAGO') {
    // Integración con MercadoPago
    const baseUrl = getTenantFrontendUrl(req.tenant)

    const periodo = cargo.periodo ? `${cargo.periodo.nombre}/${cargo.periodo.anio}` : ''

    const preferencia = await crearPreferenciaPago({
      title: cargo.descripcion || cargo.categoria,
      description: periodo ? `Cuota ${periodo}` : (cargo.descripcion || cargo.categoria),
      amount: parseFloat(cargo.montoTotal),
      quantity: 1,
      externalReference: linkPago.id.toString(),
      payer: {
        email: socio.email || 'socio@sportivo.com.ar',
        name: socio.apellidoNombre,
      },
      notificationUrl: `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/pagos/webhook/mercadopago`,
      successUrl: `${baseUrl}/s/${tokenPortal}?pago=exito`,
      failureUrl: `${baseUrl}/s/${tokenPortal}?pago=error`,
      pendingUrl: `${baseUrl}/s/${tokenPortal}?pago=pendiente`,
    })

    initPoint = preferencia.init_point
  } else if (metodoPago === 'MODO') {
    // TODO: Integrar con MODO cuando esté disponible
    initPoint = `https://ejemplo.com/modo/pagar`
  }

  // Actualizar link de pago con el init_point
  await req.db.linkPago.update({
    where: { id: linkPago.id },
    data: { initPoint },
  })

  res.json({
    success: true,
    data: {
      linkPago: initPoint,
      linkPagoId: linkPago.id,
    },
  })
}))

// POST /api/socio/:tokenPortal/cuotas/pagar-multiples - Generar link para pagar múltiples cuotas
router.post('/:tokenPortal/cuotas/pagar-multiples', asyncHandler(async (req, res) => {
  const { tokenPortal } = req.params
  const { cuotasIds, metodoPago } = req.body

  const socio = await req.db.socio.findUnique({
    where: { tokenPortal },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  if (!cuotasIds || cuotasIds.length === 0) {
    throw new AppError('Debe seleccionar al menos una cuota', 400, 'NO_CUOTAS')
  }

  const cargos = await req.db.cargo.findMany({
    where: {
      id: {
        in: cuotasIds.map(id => parseInt(id)),
      },
      socioId: socio.id,
      estado: {
        in: ['PENDIENTE', 'VENCIDO'],
      },
    },
    include: {
      periodo: true,
      categoriaActividad: {
        include: {
          actividad: true,
        },
      },
    },
  })

  if (cargos.length === 0) {
    throw new AppError('No se encontraron cuotas pendientes', 404, 'NO_CUOTAS')
  }

  const montoTotal = cargos.reduce((sum, c) => sum + parseFloat(c.montoTotal), 0)

  // Crear registro de link de pago
  const linkPago = await req.db.linkPago.create({
    data: {
      socioId: socio.id,
      concepto: `Pago de ${cargos.length} cuota(s)`,
      descripcion: cargos.map(c => c.descripcion || c.categoria).join(', '),
      montoTotal: montoTotal,
      cargosIds: JSON.stringify(cargos.map(c => c.id)),
      plataforma: metodoPago,
      estado: 'PENDIENTE',
      initPoint: '', // Se actualiza después
      fechaExpiracion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
    },
  })

  let initPoint = ''

  if (metodoPago === 'MERCADOPAGO') {
    // Integración con MercadoPago
    const baseUrl = getTenantFrontendUrl(req.tenant)

    const preferencia = await crearPreferenciaPago({
      title: `Pago de ${cargos.length} cuota(s)`,
      description: cargos.map(c => {
        const periodo = c.periodo ? `${c.periodo.nombre}/${c.periodo.anio}` : ''
        return `${c.descripcion || c.categoria}${periodo ? ' (' + periodo + ')' : ''}`
      }).join(', '),
      amount: montoTotal,
      quantity: 1,
      externalReference: linkPago.id.toString(),
      payer: {
        email: socio.email || 'socio@sportivo.com.ar',
        name: socio.apellidoNombre,
      },
      notificationUrl: `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/pagos/webhook/mercadopago`,
      successUrl: `${baseUrl}/s/${tokenPortal}?pago=exito`,
      failureUrl: `${baseUrl}/s/${tokenPortal}?pago=error`,
      pendingUrl: `${baseUrl}/s/${tokenPortal}?pago=pendiente`,
    })

    initPoint = preferencia.init_point
    console.log('💳 Link de pago generado:', initPoint)
  } else if (metodoPago === 'MODO') {
    // TODO: Integrar con MODO cuando esté disponible
    initPoint = `https://ejemplo.com/modo/pagar`
  }

  // Actualizar link de pago con el init_point
  await req.db.linkPago.update({
    where: { id: linkPago.id },
    data: { initPoint },
  })

  console.log('✅ Respuesta enviada al cliente:', {
    linkPago: initPoint,
    linkPagoId: linkPago.id,
    montoTotal: montoTotal.toString()
  })

  res.json({
    success: true,
    data: {
      linkPago: initPoint,
      linkPagoId: linkPago.id,
      montoTotal,
    },
  })
}))

// ==============================================================================
// CUENTA CORRIENTE DEL SOCIO
// ==============================================================================

// GET /api/socio/:token/cuenta-corriente - Estado de cuenta con cargos y pagos
router.get('/:token/cuenta-corriente', asyncHandler(async (req, res) => {
  const { token } = req.params
  const { incluirFamilia } = req.query

  const socio = await req.db.socio.findUnique({
    where: { tokenPortal: token },
    select: {
      id: true,
      nroSocio: true,
      apellidoNombre: true,
      titularFamiliaId: true,
      miembrosFamilia: { select: { id: true, nroSocio: true, apellidoNombre: true } },
    },
  })

  if (!socio) {
    throw new AppError('Token inválido', 404, 'INVALID_TOKEN')
  }

  // Determinar qué socios incluir
  let socioIds = [socio.id]
  if (incluirFamilia === 'true' && socio.miembrosFamilia?.length > 0) {
    socioIds = [socio.id, ...socio.miembrosFamilia.map(m => m.id)]
  }

  // Obtener cargos
  const cargos = await req.db.cargo.findMany({
    where: { socioId: { in: socioIds } },
    include: {
      periodo: { select: { nombre: true, mes: true, anio: true } },
      categoriaActividad: { select: { nombre: true, actividad: { select: { nombre: true } } } },
      socio: { select: { nroSocio: true, apellidoNombre: true } },
    },
    orderBy: { fechaGeneracion: 'asc' },
  })

  // Obtener pagos
  const pagos = await req.db.pago.findMany({
    where: { socioId: { in: socioIds } },
    include: {
      socio: { select: { nroSocio: true, apellidoNombre: true } },
    },
    orderBy: { fecha: 'asc' },
  })

  // Unificar movimientos
  const movimientos = []
  let movId = 1

  cargos.forEach(cargo => {
    let concepto = cargo.descripcion || cargo.tipoCuota || cargo.categoria || 'Cargo'
    let detalle = ''
    if (cargo.periodo) {
      detalle = cargo.periodo.nombre || `${cargo.periodo.mes}/${cargo.periodo.anio}`
    }
    if (cargo.categoriaActividad) {
      detalle += (detalle ? ' - ' : '') + `${cargo.categoriaActividad.actividad?.nombre || ''} ${cargo.categoriaActividad.nombre}`
    }
    movimientos.push({
      id: `C${cargo.id}`,
      tipo: 'DEBITO',
      fecha: cargo.fechaEmision,
      concepto,
      detalle: detalle || '-',
      estado: cargo.estado,
      debe: parseFloat(cargo.montoTotal || cargo.montoOriginal || 0),
      haber: 0,
      socioNombre: cargo.socio?.apellidoNombre,
      socioNro: cargo.socio?.nroSocio,
    })
  })

  pagos.forEach(pago => {
    movimientos.push({
      id: `P${pago.id}`,
      tipo: 'CREDITO',
      fecha: pago.fecha,
      concepto: 'Pago recibido',
      detalle: `${pago.medioPago || ''} - Recibo #${pago.nroRecibo || pago.id}`,
      estado: 'PAGADO',
      debe: 0,
      haber: parseFloat(pago.monto || 0),
      socioNombre: pago.socio?.apellidoNombre,
      socioNro: pago.socio?.nroSocio,
    })
  })

  // Ordenar por fecha
  movimientos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha))

  // Calcular saldo acumulado
  let saldo = 0
  movimientos.forEach(mov => {
    saldo += mov.debe - mov.haber
    mov.saldo = saldo
  })

  const totalDebe = movimientos.reduce((acc, m) => acc + m.debe, 0)
  const totalHaber = movimientos.reduce((acc, m) => acc + m.haber, 0)
  const cargosPendientes = cargos.filter(c => c.estado === 'PENDIENTE')
  const totalPendiente = cargosPendientes.reduce((acc, c) => acc + parseFloat(c.montoTotal || c.montoOriginal || 0), 0)

  res.json({
    success: true,
    data: {
      socio: {
        id: socio.id,
        nroSocio: socio.nroSocio,
        apellidoNombre: socio.apellidoNombre,
      },
      movimientos,
      resumen: {
        totalDebe,
        totalHaber,
        saldoFinal: saldo,
        totalPendiente,
        cargosPendientes: cargosPendientes.length,
      },
    },
  })
}))

// ==============================================================================
// CONFIGURACIÓN DE PAGOS (CBU, Alias, Teléfono)
// ==============================================================================

// GET /api/socio/:token/config-pagos
router.get('/:token/config-pagos', asyncHandler(async (req, res) => {
  const { token } = req.params

  // Validar socio
  const socio = await req.db.socio.findUnique({
    where: { tokenPortal: token },
    select: { id: true },
  })

  if (!socio) {
    throw new AppError('Token inválido', 404, 'INVALID_TOKEN')
  }

  // Obtener configuración de pagos
  const configs = await req.db.configuracion.findMany({
    where: {
      clave: {
        in: ['PAGO_CBU', 'PAGO_ALIAS', 'PAGO_TELEFONO', 'PAGO_TITULAR'],
      },
    },
  })

  const configMap = {}
  configs.forEach((c) => {
    configMap[c.clave] = c.valor
  })

  // Verificar si Parse está habilitado para este tenant
  const [parseFeature, parseKey] = await Promise.all([
    req.db.tenantConfiguracion.findFirst({ where: { clave: 'PLAN_FEATURE_PARSE' } }).catch(() => null),
    req.db.tenantConfiguracion.findFirst({ where: { clave: 'PARSE_API_KEY' } }).catch(() => null),
  ])
  const parseDisponible = parseFeature?.valor === 'true' && !!parseKey?.valor

  res.json({
    success: true,
    data: {
      cbu: configMap.PAGO_CBU || '',
      alias: configMap.PAGO_ALIAS || '',
      telefono: configMap.PAGO_TELEFONO || '',
      titular: configMap.PAGO_TITULAR || '',
      parseDisponible,
    },
  })
}))

// ==============================================================================
// INFORMAR PAGO MANUAL (transferencia)
// ==============================================================================

import fs from 'fs/promises'
import path from 'path'

// POST /api/socio/:token/informar-pago
router.post('/:token/informar-pago', asyncHandler(async (req, res) => {
  const { token } = req.params
  const { cuotasIds, monto, comprobante, comprobanteOriginal, observaciones } = req.body

  // Validar socio
  const socio = await req.db.socio.findUnique({
    where: { tokenPortal: token },
    select: { id: true, nroSocio: true, apellidoNombre: true },
  })

  if (!socio) {
    throw new AppError('Token inválido', 404, 'INVALID_TOKEN')
  }

  // Validar que cuotasIds sea un array válido
  if (!Array.isArray(cuotasIds) || cuotasIds.length === 0) {
    throw new AppError('Debe seleccionar al menos una cuota', 400, 'VALIDATION_ERROR')
  }

  // Validar monto
  if (!monto || parseFloat(monto) <= 0) {
    throw new AppError('Monto inválido', 400, 'VALIDATION_ERROR')
  }

  let comprobanteUrl = null

  // Guardar comprobante si existe
  if (comprobante) {
    try {
      // Crear directorio si no existe
      const uploadDir = path.join(process.cwd(), 'uploads', 'comprobantes')
      await fs.mkdir(uploadDir, { recursive: true })

      // Generar nombre único para el archivo
      const timestamp = Date.now()
      const randomStr = crypto.randomBytes(8).toString('hex')
      const ext = path.extname(comprobanteOriginal || '.jpg')
      const filename = `pago-${socio.nroSocio}-${timestamp}-${randomStr}${ext}`
      const filepath = path.join(uploadDir, filename)

      // Decodificar base64 y guardar
      const base64Data = comprobante.replace(/^data:image\/\w+;base64,/, '')
      await fs.writeFile(filepath, base64Data, 'base64')

      comprobanteUrl = `/uploads/comprobantes/${filename}`
    } catch (error) {
      console.error('Error guardando comprobante:', error)
      throw new AppError('Error al guardar el comprobante', 500, 'FILE_ERROR')
    }
  }

  // Crear registro de pago informado
  const pagoInformado = await req.db.pagoInformado.create({
    data: {
      socioId: socio.id,
      cuotasIds: JSON.stringify(cuotasIds),
      monto: parseFloat(monto),
      metodoPago: 'TRANSFERENCIA',
      comprobante: comprobanteUrl,
      comprobanteOriginal,
      observaciones,
      estado: 'PENDIENTE',
    },
  })

  res.json({
    success: true,
    message: 'Pago informado correctamente. Será procesado en breve.',
    pagoInformadoId: pagoInformado.id,
  })
}))

// POST /api/socio/:token/parse-comprobante — escanear imagen con OCR
router.post('/:token/parse-comprobante', asyncHandler(async (req, res) => {
  const { token } = req.params
  const { imagen, nombreArchivo } = req.body

  if (!imagen) throw new AppError('imagen requerida', 400)

  // Verificar socio
  const socio = await req.db.socio.findUnique({
    where: { tokenPortal: token },
    select: { id: true },
  })
  if (!socio) throw new AppError('Token inválido', 401)

  // Verificar feature habilitada
  const [parseFeature, parseKeyConfig] = await Promise.all([
    req.db.tenantConfiguracion.findFirst({ where: { clave: 'PLAN_FEATURE_PARSE' } }),
    req.db.tenantConfiguracion.findFirst({ where: { clave: 'PARSE_API_KEY' } }),
  ])

  if (parseFeature?.valor !== 'true' || !parseKeyConfig?.valor) {
    throw new AppError('Función de escaneo no disponible', 403)
  }

  const apiKey = parseKeyConfig.valor
  const parseApiUrl = process.env.PARSE_API_URL || 'https://api.axioma.cloud'

  // Convertir base64 a Buffer
  const base64Data = imagen.replace(/^data:image\/\w+;base64,/, '')
  const imageBuffer = Buffer.from(base64Data, 'base64')

  // Detectar mime type
  const ext = (nombreArchivo || 'comprobante.jpg').split('.').pop().toLowerCase()
  const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'

  // Llamar a Parse API con multipart
  const formData = new FormData()
  formData.append('file', new Blob([imageBuffer], { type: mimeType }), nombreArchivo || 'comprobante.jpg')

  const parseResponse = await fetch(`${parseApiUrl}/parse/document`, {
    method: 'POST',
    headers: { 'X-API-Key': apiKey },
    body: formData,
  })

  if (!parseResponse.ok) {
    const errText = await parseResponse.text().catch(() => '')
    console.error('[Parse] Error API:', parseResponse.status, errText)
    throw new AppError('Error al procesar el comprobante', 502)
  }

  const result = await parseResponse.json()

  res.json({
    success: true,
    data: {
      monto: result.monto ?? result.amount ?? null,
      fecha: result.fecha ?? result.date ?? null,
      referencia: result.referencia ?? result.reference ?? result.numero ?? null,
    },
  })
}))

// GET /api/socio/:tokenPortal/pagos/:pagoId/pdf - Descargar recibo de pago en PDF
router.get('/:tokenPortal/pagos/:pagoId/pdf', asyncHandler(async (req, res) => {
  const { tokenPortal, pagoId } = req.params

  // Verificar socio
  const socio = await req.db.socio.findUnique({
    where: { tokenPortal },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  // Buscar el pago
  const pago = await req.db.pago.findFirst({
    where: {
      id: parseInt(pagoId),
      socioId: socio.id,
    },
    include: {
      medioPago: true,
      cargos: {
        include: {
          periodo: true,
          categoriaActividad: {
            include: {
              actividad: true,
            },
          },
        },
      },
    },
  })

  if (!pago) {
    throw new AppError('Pago no encontrado', 404, 'PAGO_NOT_FOUND')
  }

  // Obtener configuración del club
  const configs = await req.db.configuracion.findMany({
    where: {
      clave: {
        in: ['CLUB_NOMBRE', 'CLUB_DIRECCION', 'CLUB_TELEFONO', 'CLUB_EMAIL', 'CLUB_LEMA'],
      },
    },
  })

  const configMap = {}
  configs.forEach(c => {
    configMap[c.clave] = c.valor
  })

  // Preparar datos para el PDF
  const pdfData = {
    clubNombre: configMap.CLUB_NOMBRE || 'Club Sportivo Pilar',
    clubLema: configMap.CLUB_LEMA || 'El Rojo de la Avenida',
    clubDireccion: configMap.CLUB_DIRECCION || '',
    clubTelefono: configMap.CLUB_TELEFONO || '',
    clubEmail: configMap.CLUB_EMAIL || '',
    numero: pago.numero,
    fecha: new Date(pago.fecha).toLocaleDateString('es-AR'),
    fechaGeneracion: new Date().toLocaleString('es-AR'),
    socioNombre: socio.apellidoNombre,
    socioNumero: socio.nroSocio,
    medioPago: pago.medioPago?.nombre || 'No especificado',
    nroOperacion: pago.nroOperacion || '-',
    montoTotal: pago.montoTotal.toFixed(2),
    items: pago.cargos.map(c => ({
      concepto: c.descripcion || c.categoria,
      periodo: c.periodo?.nombre || '-',
      monto: c.montoTotal.toFixed(2),
    })),
    observaciones: pago.observaciones || '',
  }

  // Generar PDF
  const pdfBuffer = await generatePDF(req.prisma, 'RECIBO', pdfData)

  // Enviar PDF
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="Recibo-${pago.numero}.pdf"`)
  res.send(pdfBuffer)
}))

// GET /api/socio/:tokenPortal/cuenta-corriente - Obtener cuenta corriente completa con saldo acumulado
router.get('/:tokenPortal/cuenta-corriente', asyncHandler(async (req, res) => {
  const { tokenPortal } = req.params
  const { desde, hasta, limite = 100 } = req.query

  // Verificar socio
  const socio = await req.db.socio.findUnique({
    where: { tokenPortal },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  // Construir filtros de fecha
  const filtroFecha = {}
  if (desde) {
    filtroFecha.gte = new Date(desde)
  }
  if (hasta) {
    filtroFecha.lte = new Date(hasta)
  }

  // Obtener cargos (débitos)
  const cargos = await req.db.cargo.findMany({
    where: {
      socioId: socio.id,
      ...(desde || hasta ? { fechaGeneracion: filtroFecha } : {}),
    },
    include: {
      periodo: true,
      categoriaActividad: {
        include: {
          actividad: true,
        },
      },
      pago: true,
    },
    orderBy: {
      fechaGeneracion: 'asc',
    },
    take: parseInt(limite),
  })

  // Obtener pagos (créditos)
  const pagos = await req.db.pago.findMany({
    where: {
      socioId: socio.id,
      estado: 'CONFIRMADO',
      ...(desde || hasta ? { fecha: filtroFecha } : {}),
    },
    include: {
      medioPago: true,
      cargos: true,
    },
    orderBy: {
      fecha: 'asc',
    },
    take: parseInt(limite),
  })

  // Combinar y ordenar movimientos cronológicamente
  const movimientos = []

  // Agregar cargos como débitos
  cargos.forEach(cargo => {
    movimientos.push({
      id: `cargo-${cargo.id}`,
      tipo: 'DEBITO',
      fecha: cargo.fechaGeneracion,
      concepto: cargo.descripcion || cargo.categoria,
      detalle: cargo.periodo?.nombre ||
        (cargo.categoriaActividad ?
          `${cargo.categoriaActividad.actividad.nombre} - ${cargo.categoriaActividad.nombre}` :
          ''),
      debe: cargo.montoTotal,
      haber: 0,
      estado: cargo.estado,
      pagoId: cargo.pagoId,
      vencimiento: cargo.fechaVencimiento,
    })
  })

  // Agregar pagos como créditos
  pagos.forEach(pago => {
    movimientos.push({
      id: `pago-${pago.id}`,
      tipo: 'CREDITO',
      fecha: pago.fecha,
      concepto: 'Pago recibido',
      detalle: `${pago.medioPago?.nombre || 'No especificado'} - ${pago.numero}`,
      debe: 0,
      haber: pago.montoTotal,
      estado: 'CONFIRMADO',
      pagoId: pago.id,
      cantidadCuotas: pago.cargos.length,
    })
  })

  // Ordenar por fecha
  movimientos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha))

  // Calcular saldo acumulado
  let saldo = 0
  const movimientosConSaldo = movimientos.map(mov => {
    saldo += Number(mov.debe) - Number(mov.haber)
    return {
      ...mov,
      saldo: saldo.toFixed(2),
    }
  })

  // Resumen
  const totalDebe = movimientos.reduce((sum, m) => sum + Number(m.debe), 0)
  const totalHaber = movimientos.reduce((sum, m) => sum + Number(m.haber), 0)
  const saldoFinal = totalDebe - totalHaber

  const cargosPendientes = cargos.filter(c => c.estado === 'PENDIENTE')
  const totalPendiente = cargosPendientes.reduce((sum, c) => sum + Number(c.montoTotal), 0)

  res.json({
    success: true,
    data: {
      movimientos: movimientosConSaldo,
      resumen: {
        totalDebe: totalDebe.toFixed(2),
        totalHaber: totalHaber.toFixed(2),
        saldoFinal: saldoFinal.toFixed(2),
        cantidadCargos: cargos.length,
        cantidadPagos: pagos.length,
        totalPendiente: totalPendiente.toFixed(2),
        cargosPendientes: cargosPendientes.length,
      },
      socio: {
        nombre: socio.apellidoNombre,
        nroSocio: socio.nroSocio,
      },
    },
  })
}))

// ==============================================================================
// DÉBITO AUTOMÁTICO
// ==============================================================================

// GET /api/socio/:tokenPortal/debito-automatico - Estado de adhesión al débito automático
router.get('/:tokenPortal/debito-automatico', asyncHandler(async (req, res) => {
  const { tokenPortal } = req.params

  const socio = await req.db.socio.findUnique({
    where: { tokenPortal },
    select: {
      id: true,
      debitoTipo: true,
      cbuDebito: true,
      bancoDebito: true,
      aliasDebito: true,
      tarjetaMarca: true,
      tarjetaUltimos4: true,
      tarjetaVencimiento: true,
      tarjetaToken: true,
      tarjetaTokenizador: true,
      enviaDebito: true,
      debitoVerificado: true,
    },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  // Determinar si tiene datos de adhesión (CBU o tarjeta)
  const tieneDatos = socio.cbuDebito || socio.tarjetaUltimos4

  // Determinar estado
  let estado = 'NO_ADHERIDO'
  if (tieneDatos) {
    if (socio.debitoVerificado && socio.enviaDebito) {
      estado = 'ACTIVO'
    } else if (!socio.debitoVerificado) {
      estado = 'PENDIENTE_APROBACION'
    } else if (!socio.enviaDebito) {
      estado = 'BAJA_PENDIENTE'
    }
  }

  // Preparar respuesta según tipo
  const tipo = socio.debitoTipo || (socio.cbuDebito ? 'CBU' : socio.tarjetaUltimos4 ? 'TARJETA' : null)

  res.json({
    success: true,
    data: {
      estado,
      tipo,
      // Datos CBU
      cbu: socio.cbuDebito ? `****${socio.cbuDebito.slice(-4)}` : null,
      banco: socio.bancoDebito,
      alias: socio.aliasDebito,
      // Datos Tarjeta
      tarjetaMarca: socio.tarjetaMarca,
      tarjetaUltimos4: socio.tarjetaUltimos4,
      tarjetaVencimiento: socio.tarjetaVencimiento,
      tokenizadoPayway: socio.tarjetaTokenizador === 'PAYWAY' && !!socio.tarjetaToken,
    },
  })
}))

// POST /api/socio/:tokenPortal/debito-automatico/solicitar - Solicitar adhesión al débito automático
router.post('/:tokenPortal/debito-automatico/solicitar', asyncHandler(async (req, res) => {
  const { tokenPortal } = req.params
  const { tipo, cbu, banco, alias, tarjetaNumero, tarjetaMarca, tarjetaVencimiento, tarjetaTitular } = req.body

  // Validar tipo
  if (!tipo || !['TARJETA', 'CBU'].includes(tipo)) {
    throw new AppError('Tipo de adhesión inválido', 400, 'VALIDATION_ERROR')
  }

  // Validaciones según tipo
  if (tipo === 'CBU') {
    if (!cbu || cbu.length !== 22) {
      throw new AppError('El CBU debe tener 22 dígitos', 400, 'VALIDATION_ERROR')
    }
    if (!banco) {
      throw new AppError('Debe indicar el banco', 400, 'VALIDATION_ERROR')
    }
    if (!/^\d{22}$/.test(cbu)) {
      throw new AppError('El CBU solo debe contener números', 400, 'VALIDATION_ERROR')
    }
  } else {
    // TARJETA
    if (!tarjetaNumero || tarjetaNumero.length < 13) {
      throw new AppError('Número de tarjeta inválido', 400, 'VALIDATION_ERROR')
    }
    if (!tarjetaMarca) {
      throw new AppError('Debe indicar la marca de la tarjeta', 400, 'VALIDATION_ERROR')
    }
    if (!tarjetaVencimiento || !/^\d{2}\/\d{2}$/.test(tarjetaVencimiento)) {
      throw new AppError('Vencimiento inválido (MM/AA)', 400, 'VALIDATION_ERROR')
    }
    if (!tarjetaTitular) {
      throw new AppError('Debe indicar el titular de la tarjeta', 400, 'VALIDATION_ERROR')
    }
  }

  const socio = await req.db.socio.findUnique({
    where: { tokenPortal },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  // Verificar que no esté ya activo
  if (socio.enviaDebito && socio.debitoVerificado) {
    throw new AppError('Ya estás adherido al débito automático', 400, 'ALREADY_ENROLLED')
  }

  // Preparar datos según tipo
  let updateData = {
    debitoTipo: tipo,
    debitoVerificado: false, // Pendiente de aprobación
    enviaDebito: false, // Se activa cuando el admin aprueba
  }

  if (tipo === 'CBU') {
    updateData = {
      ...updateData,
      cbuDebito: cbu,
      bancoDebito: banco,
      aliasDebito: alias || null,
      // Limpiar datos de tarjeta si existían
      tarjetaNumero: null,
      tarjetaMarca: null,
      tarjetaVencimiento: null,
      tarjetaUltimos4: null,
    }
  } else {
    // TARJETA
    const ultimos4 = tarjetaNumero.slice(-4)
    const { cvv } = req.body

    // Intentar tokenizar con Payway si hay configuración activa para este tenant
    let paywayToken = null
    let paywayUltimos4 = ultimos4
    try {
      const configPayway = await req.db.configuracionDebito.findFirst({
        where: { tenantId: req.tenantId, plataforma: 'PAYWAY', activo: true }
      })
      if (configPayway?.apiKey) {
        const tokenResult = await paywayTokenizar({
          numero: tarjetaNumero,
          vencimiento: tarjetaVencimiento,
          titular: req.body.tarjetaTitular,
          cvv: cvv || '000',
          marca: tarjetaMarca,
          configuracion: configPayway
        })
        paywayToken = tokenResult.token
        paywayUltimos4 = tokenResult.ultimosCuatro || ultimos4
      }
    } catch (err) {
      // Tokenización falló — continuar sin token (flujo PRISMA)
      console.warn('[Débito solicitar] Payway tokenización falló:', err.message)
    }

    updateData = {
      ...updateData,
      tarjetaNumero: tarjetaNumero,
      tarjetaMarca: tarjetaMarca,
      tarjetaVencimiento: tarjetaVencimiento,
      tarjetaUltimos4: paywayUltimos4,
      tarjetaToken: paywayToken,
      tarjetaTokenizador: paywayToken ? 'PAYWAY' : null,
      cbuDebito: null,
      bancoDebito: null,
      aliasDebito: null,
    }
  }

  // Actualizar socio con datos de débito
  await req.db.socio.update({
    where: { id: socio.id },
    data: updateData,
  })

  // Registrar en audit log
  const auditData = tipo === 'CBU'
    ? { tipo, banco, cbuUltimos4: cbu.slice(-4) }
    : { tipo, marca: tarjetaMarca, tarjetaUltimos4: tarjetaNumero.slice(-4) }

  await req.db.auditLog.create({
    data: {
      tabla: 'socio',
      registroId: socio.id,
      accion: 'SOLICITUD_DEBITO',
      datosNuevos: JSON.stringify(auditData),
      ip: req.ip,
    },
  })

  res.json({
    success: true,
    message: 'Solicitud de adhesión enviada. Será revisada por el club en las próximas 48 horas hábiles.',
  })
}))

// POST /api/socio/:tokenPortal/debito-automatico/baja - Solicitar baja del débito automático
router.post('/:tokenPortal/debito-automatico/baja', asyncHandler(async (req, res) => {
  const { tokenPortal } = req.params
  const { motivo } = req.body

  const socio = await req.db.socio.findUnique({
    where: { tokenPortal },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  if (!socio.cbuDebito || !socio.enviaDebito) {
    throw new AppError('No estás adherido al débito automático', 400, 'NOT_ENROLLED')
  }

  // Marcar como baja pendiente (el admin debe confirmar)
  await req.db.socio.update({
    where: { id: socio.id },
    data: {
      enviaDebito: false,
    },
  })

  // Registrar en audit log
  await req.db.auditLog.create({
    data: {
      tabla: 'socio',
      registroId: socio.id,
      accion: 'BAJA_DEBITO',
      datosNuevos: JSON.stringify({ motivo: motivo || 'No especificado' }),
      ip: req.ip,
    },
  })

  res.json({
    success: true,
    message: 'Solicitud de baja procesada. El débito automático ha sido desactivado.',
  })
}))

// ==============================================================================
// MENSAJERÍA - Chat con Entrenadores
// ==============================================================================

/**
 * GET /api/socio/:token/conversaciones
 * Obtener todas las conversaciones del socio con entrenadores
 */
router.get('/:token/conversaciones', asyncHandler(async (req, res) => {
  const { token } = req.params

  const socio = await req.db.socio.findFirst({
    where: { tokenPortal: token }
  })

  if (!socio) {
    throw new AppError('Token inválido', 401)
  }

  const conversaciones = await req.db.conversacion.findMany({
    where: {
      socioId: socio.id,
      estado: { not: 'CERRADA' }
    },
    include: {
      entrenador: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
          email: true
        }
      },
      categoriaActividad: {
        select: {
          id: true,
          nombre: true,
          actividad: {
            select: { nombre: true }
          }
        }
      },
      mensajes: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          contenido: true,
          createdAt: true,
          emisorTipo: true
        }
      }
    },
    orderBy: { ultimoMensaje: 'desc' }
  })

  // Formatear respuesta
  const resultado = conversaciones.map(conv => ({
    id: conv.id,
    entrenador: {
      id: conv.entrenador.id,
      nombre: `${conv.entrenador.nombre} ${conv.entrenador.apellido || ''}`.trim()
    },
    actividad: conv.categoriaActividad?.actividad?.nombre || null,
    categoria: conv.categoriaActividad?.nombre || null,
    asunto: conv.asunto,
    ultimoMensaje: conv.mensajes[0] || null,
    mensajesNoLeidos: conv.mensajesNoLeidos,
    estado: conv.estado,
    updatedAt: conv.ultimoMensaje || conv.createdAt
  }))

  res.json({ success: true, data: resultado })
}))

/**
 * POST /api/socio/:token/conversaciones
 * Crear una nueva conversación con un entrenador
 */
router.post('/:token/conversaciones', asyncHandler(async (req, res) => {
  const { token } = req.params
  const { entrenadorId, categoriaActividadId, asunto, mensaje } = req.body

  const socio = await req.db.socio.findFirst({
    where: { tokenPortal: token }
  })

  if (!socio) {
    throw new AppError('Token inválido', 401)
  }

  if (!entrenadorId || !mensaje) {
    throw new AppError('Entrenador y mensaje son requeridos', 400)
  }

  // Verificar que el entrenador existe
  const entrenador = await req.db.entrenador.findUnique({
    where: { id: parseInt(entrenadorId) }
  })

  if (!entrenador || !entrenador.activo) {
    throw new AppError('Entrenador no encontrado', 404)
  }

  // Verificar si ya existe una conversación con este entrenador
  let conversacion = await req.db.conversacion.findFirst({
    where: {
      socioId: socio.id,
      entrenadorId: parseInt(entrenadorId),
      categoriaActividadId: categoriaActividadId ? parseInt(categoriaActividadId) : null,
      estado: { not: 'CERRADA' }
    }
  })

  // Si no existe, crear nueva conversación
  if (!conversacion) {
    conversacion = await req.db.conversacion.create({
      data: {
        socioId: socio.id,
        entrenadorId: parseInt(entrenadorId),
        categoriaActividadId: categoriaActividadId ? parseInt(categoriaActividadId) : null,
        asunto: asunto || null,
        ultimoMensaje: new Date()
      }
    })
  }

  // Crear el primer mensaje
  const nuevoMensaje = await req.db.mensaje.create({
    data: {
      conversacionId: conversacion.id,
      emisorTipo: 'SOCIO',
      emisorId: socio.id,
      contenido: mensaje
    }
  })

  // Actualizar timestamp de la conversación
  await req.db.conversacion.update({
    where: { id: conversacion.id },
    data: { ultimoMensaje: new Date() }
  })

  res.status(201).json({
    success: true,
    data: {
      conversacionId: conversacion.id,
      mensaje: nuevoMensaje
    }
  })
}))

/**
 * GET /api/socio/:token/conversaciones/:id/mensajes
 * Obtener todos los mensajes de una conversación
 */
router.get('/:token/conversaciones/:id/mensajes', asyncHandler(async (req, res) => {
  const { token, id } = req.params

  const socio = await req.db.socio.findFirst({
    where: { tokenPortal: token }
  })

  if (!socio) {
    throw new AppError('Token inválido', 401)
  }

  // Verificar que la conversación pertenece al socio
  const conversacion = await req.db.conversacion.findFirst({
    where: {
      id: parseInt(id),
      socioId: socio.id
    },
    include: {
      entrenador: {
        select: {
          id: true,
          nombre: true,
          apellido: true
        }
      },
      categoriaActividad: {
        select: {
          nombre: true,
          actividad: { select: { nombre: true } }
        }
      }
    }
  })

  if (!conversacion) {
    throw new AppError('Conversación no encontrada', 404)
  }

  // Obtener mensajes
  const mensajes = await req.db.mensaje.findMany({
    where: { conversacionId: parseInt(id) },
    orderBy: { createdAt: 'asc' }
  })

  // Marcar como leídos los mensajes del entrenador
  await req.db.mensaje.updateMany({
    where: {
      conversacionId: parseInt(id),
      emisorTipo: 'ENTRENADOR',
      leido: false
    },
    data: {
      leido: true,
      fechaLeido: new Date()
    }
  })

  // Resetear contador de no leídos
  await req.db.conversacion.update({
    where: { id: parseInt(id) },
    data: { mensajesNoLeidos: 0 }
  })

  res.json({
    success: true,
    data: {
      conversacion: {
        id: conversacion.id,
        entrenador: `${conversacion.entrenador.nombre} ${conversacion.entrenador.apellido || ''}`.trim(),
        actividad: conversacion.categoriaActividad?.actividad?.nombre,
        categoria: conversacion.categoriaActividad?.nombre,
        asunto: conversacion.asunto
      },
      mensajes: mensajes.map(m => ({
        id: m.id,
        contenido: m.contenido,
        emisorTipo: m.emisorTipo,
        esPropio: m.emisorTipo === 'SOCIO',
        createdAt: m.createdAt,
        leido: m.leido
      }))
    }
  })
}))

/**
 * POST /api/socio/:token/conversaciones/:id/mensajes
 * Enviar un nuevo mensaje en una conversación existente
 */
router.post('/:token/conversaciones/:id/mensajes', asyncHandler(async (req, res) => {
  const { token, id } = req.params
  const { contenido } = req.body

  const socio = await req.db.socio.findFirst({
    where: { tokenPortal: token }
  })

  if (!socio) {
    throw new AppError('Token inválido', 401)
  }

  if (!contenido?.trim()) {
    throw new AppError('El mensaje no puede estar vacío', 400)
  }

  // Verificar que la conversación pertenece al socio
  const conversacion = await req.db.conversacion.findFirst({
    where: {
      id: parseInt(id),
      socioId: socio.id,
      estado: 'ACTIVA'
    }
  })

  if (!conversacion) {
    throw new AppError('Conversación no encontrada o cerrada', 404)
  }

  // Crear mensaje
  const mensaje = await req.db.mensaje.create({
    data: {
      conversacionId: parseInt(id),
      emisorTipo: 'SOCIO',
      emisorId: socio.id,
      contenido: contenido.trim()
    }
  })

  // Actualizar conversación
  await req.db.conversacion.update({
    where: { id: parseInt(id) },
    data: { ultimoMensaje: new Date(), mensajesNoLeidos: { increment: 1 } }
  })

  // Emitir al panel admin para que el entrenador reciba en tiempo real
  try {
    const { getIO } = await import('../services/socketService.js')
    getIO().emit('chat:nuevo-mensaje', {
      conversacionId: parseInt(id),
      mensaje: {
        id: mensaje.id,
        contenido: mensaje.contenido,
        emisorTipo: 'SOCIO',
        esPropio: false,
        createdAt: mensaje.createdAt
      },
      socioNombre: socio.apellidoNombre
    })
  } catch (e) {}

  res.status(201).json({
    success: true,
    data: {
      id: mensaje.id,
      contenido: mensaje.contenido,
      emisorTipo: mensaje.emisorTipo,
      esPropio: true,
      createdAt: mensaje.createdAt
    }
  })
}))

/**
 * GET /api/socio/:token/entrenadores-disponibles
 * Obtener entrenadores disponibles para contactar (de las actividades donde está inscripto)
 */
router.get('/:token/entrenadores-disponibles', asyncHandler(async (req, res) => {
  const { token } = req.params

  const socio = await req.db.socio.findFirst({
    where: { tokenPortal: token }
  })

  if (!socio) {
    throw new AppError('Token inválido', 401)
  }

  // Obtener categorías donde está inscripto el socio
  const inscripciones = await req.db.inscripcion.findMany({
    where: {
      socioId: socio.id,
      activo: true
    },
    select: {
      categoriaActividadId: true,
      categoriaActividad: {
        select: {
          id: true,
          nombre: true,
          actividad: { select: { id: true, nombre: true } }
        }
      }
    }
  })

  const categoriaIds = inscripciones.map(i => i.categoriaActividadId)

  // Obtener entrenadores de esas categorías
  const entrenadoresCategorias = await req.db.entrenadorCategoria.findMany({
    where: {
      categoriaActividadId: { in: categoriaIds },
      activo: true,
      entrenador: { activo: true }
    },
    include: {
      entrenador: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
          email: true
        }
      },
      categoriaActividad: {
        select: {
          id: true,
          nombre: true,
          actividad: { select: { nombre: true } }
        }
      }
    }
  })

  // Agrupar por entrenador
  const entrenadoresMap = new Map()
  entrenadoresCategorias.forEach(ec => {
    const key = ec.entrenador.id
    if (!entrenadoresMap.has(key)) {
      entrenadoresMap.set(key, {
        id: ec.entrenador.id,
        nombre: `${ec.entrenador.nombre} ${ec.entrenador.apellido || ''}`.trim(),
        email: ec.entrenador.email,
        categorias: []
      })
    }
    entrenadoresMap.get(key).categorias.push({
      id: ec.categoriaActividad.id,
      nombre: ec.categoriaActividad.nombre,
      actividad: ec.categoriaActividad.actividad.nombre
    })
  })

  res.json({
    success: true,
    data: Array.from(entrenadoresMap.values())
  })
}))

// ==============================================================================
// PREFERENCIAS DE NOTIFICACIONES
// ==============================================================================

// GET /api/socio/:token/preferencias-notificaciones
router.get('/:token/preferencias-notificaciones', asyncHandler(async (req, res) => {
  const { token } = req.params

  const socio = await req.db.socio.findUnique({
    where: { tokenPortal: token },
    select: {
      id: true,
      // Cuotas y General
      notificarCuotaProxVenc: true,
      notificarCuotaVencida: true,
      notificarMorosidad: true,
      notificarInscripcion: true,
      notificarNoticias: true,
      notificarPush: true,
      // Deportivas
      notificarConvocatoria: true,
      notificarRecordatorioPartido: true,
      notificarCancelacionEntreno: true,
      notificarNuevoEntrenamiento: true,
      // Canales
      notifEmail: true,
      notifWhatsapp: true,
    }
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  res.json({
    success: true,
    data: {
      canales: {
        email: socio.notifEmail,
        whatsapp: socio.notifWhatsapp,
      },
      cuotasYGeneral: {
        cuotaProximaVencer: socio.notificarCuotaProxVenc,
        cuotaVencida: socio.notificarCuotaVencida,
        recordatorioMorosidad: socio.notificarMorosidad,
        confirmacionInscripcion: socio.notificarInscripcion,
        noticiasClub: socio.notificarNoticias,
        notificacionesPush: socio.notificarPush
      },
      deportivas: {
        convocatoriaPartido: socio.notificarConvocatoria,
        recordatorioPartido: socio.notificarRecordatorioPartido,
        cancelacionEntrenamiento: socio.notificarCancelacionEntreno,
        nuevoEntrenamiento: socio.notificarNuevoEntrenamiento
      }
    }
  })
}))

// PUT /api/socio/:token/preferencias-notificaciones
router.put('/:token/preferencias-notificaciones', asyncHandler(async (req, res) => {
  const { token } = req.params
  const { canales, cuotasYGeneral, deportivas } = req.body

  const socio = await req.db.socio.findUnique({
    where: { tokenPortal: token },
    select: { id: true }
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  // Construir objeto de actualización
  const updateData = {}

  // Canales
  if (canales) {
    if (typeof canales.email === 'boolean') updateData.notifEmail = canales.email
    if (typeof canales.whatsapp === 'boolean') updateData.notifWhatsapp = canales.whatsapp
  }

  // Cuotas y General
  if (cuotasYGeneral) {
    if (typeof cuotasYGeneral.cuotaProximaVencer === 'boolean') {
      updateData.notificarCuotaProxVenc = cuotasYGeneral.cuotaProximaVencer
    }
    if (typeof cuotasYGeneral.cuotaVencida === 'boolean') {
      updateData.notificarCuotaVencida = cuotasYGeneral.cuotaVencida
    }
    if (typeof cuotasYGeneral.recordatorioMorosidad === 'boolean') {
      updateData.notificarMorosidad = cuotasYGeneral.recordatorioMorosidad
    }
    if (typeof cuotasYGeneral.confirmacionInscripcion === 'boolean') {
      updateData.notificarInscripcion = cuotasYGeneral.confirmacionInscripcion
    }
    if (typeof cuotasYGeneral.noticiasClub === 'boolean') {
      updateData.notificarNoticias = cuotasYGeneral.noticiasClub
    }
    if (typeof cuotasYGeneral.notificacionesPush === 'boolean') {
      updateData.notificarPush = cuotasYGeneral.notificacionesPush
    }
  }

  // Deportivas
  if (deportivas) {
    if (typeof deportivas.convocatoriaPartido === 'boolean') {
      updateData.notificarConvocatoria = deportivas.convocatoriaPartido
    }
    if (typeof deportivas.recordatorioPartido === 'boolean') {
      updateData.notificarRecordatorioPartido = deportivas.recordatorioPartido
    }
    if (typeof deportivas.cancelacionEntrenamiento === 'boolean') {
      updateData.notificarCancelacionEntreno = deportivas.cancelacionEntrenamiento
    }
    if (typeof deportivas.nuevoEntrenamiento === 'boolean') {
      updateData.notificarNuevoEntrenamiento = deportivas.nuevoEntrenamiento
    }
  }

  // Actualizar
  await req.db.socio.update({
    where: { id: socio.id },
    data: updateData
  })

  res.json({
    success: true,
    message: 'Preferencias actualizadas correctamente'
  })
}))

// GET /api/socio/:token/convocatorias - Listar convocatorias del socio
router.get('/:token/convocatorias', asyncHandler(async (req, res) => {
  const { token } = req.params
  const { estado } = req.query // 'pendiente', 'confirmada', 'rechazada', 'todas'

  const socio = await req.db.socio.findUnique({
    where: { tokenPortal: token },
    select: { id: true }
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  const where = { socioId: socio.id }

  // Filtrar por estado
  if (estado && estado !== 'todas') {
    if (estado === 'pendiente') {
      where.confirmado = null
    } else if (estado === 'confirmada') {
      where.confirmado = true
    } else if (estado === 'rechazada') {
      where.confirmado = false
    }
  }

  const convocatorias = await req.db.convocatoria.findMany({
    where,
    include: {
      partido: {
        include: {
          categoriaActividad: {
            include: {
              actividad: {
                select: {
                  id: true,
                  nombre: true,
                  codigo: true
                }
              }
            }
          },
          espacio: {
            select: {
              id: true,
              nombre: true
            }
          }
        }
      }
    },
    orderBy: {
      partido: {
        fecha: 'asc'
      }
    }
  })

  // Formatear respuesta
  const convocatoriasFormateadas = convocatorias.map(conv => ({
    id: conv.id,
    partidoId: conv.partidoId,
    confirmado: conv.confirmado,
    motivoRechazo: conv.motivoRechazo,
    partido: {
      id: conv.partido.id,
      fecha: conv.partido.fecha,
      hora: conv.partido.hora,
      equipoLocal: conv.partido.equipoLocal,
      equipoVisitante: conv.partido.equipoVisitante,
      esLocal: conv.partido.esLocal,
      lugar: conv.partido.espacio?.nombre || conv.partido.lugar,
      estado: conv.partido.estado,
      actividad: conv.partido.categoriaActividad.actividad.nombre,
      categoria: conv.partido.categoriaActividad.nombre
    },
    fechaConvocatoria: conv.createdAt
  }))

  res.json({
    success: true,
    data: convocatoriasFormateadas
  })
}))

// PUT /api/socio/:token/convocatorias/:partidoId - Confirmar o rechazar convocatoria
router.put('/:token/convocatorias/:partidoId', asyncHandler(async (req, res) => {
  const { token, partidoId } = req.params
  const { confirmado, motivoRechazo } = req.body

  if (typeof confirmado !== 'boolean') {
    throw new AppError('El campo confirmado es requerido y debe ser booleano', 400)
  }

  const socio = await req.db.socio.findUnique({
    where: { tokenPortal: token },
    select: { id: true, apellidoNombre: true, nroSocio: true }
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  // Buscar convocatoria
  const convocatoria = await req.db.convocatoria.findUnique({
    where: {
      partidoId_socioId: {
        partidoId: parseInt(partidoId),
        socioId: socio.id
      }
    },
    include: {
      partido: {
        include: {
          categoriaActividad: {
            include: {
              actividad: true
            }
          }
        }
      }
    }
  })

  if (!convocatoria) {
    throw new AppError('Convocatoria no encontrada', 404)
  }

  // Verificar que el partido no haya pasado
  const fechaPartido = new Date(convocatoria.partido.fecha)
  if (fechaPartido < new Date()) {
    throw new AppError('No se puede modificar la convocatoria de un partido que ya pasó', 400)
  }

  // Actualizar convocatoria
  const convocatoriaActualizada = await req.db.convocatoria.update({
    where: {
      partidoId_socioId: {
        partidoId: parseInt(partidoId),
        socioId: socio.id
      }
    },
    data: {
      confirmado,
      motivoRechazo: confirmado === false ? (motivoRechazo || null) : null
    }
  })

  res.json({
    success: true,
    message: confirmado ? 'Confirmaste tu asistencia al partido' : 'Rechazaste la convocatoria',
    data: convocatoriaActualizada
  })
}))

// =============================================================================
// PUSH NOTIFICATIONS
// =============================================================================

// GET /api/socio/:token/push/vapid-key
router.get('/:token/push/vapid-key', asyncHandler(async (req, res) => {
  const vapidPublicKey = getVapidPublicKey()
  if (!vapidPublicKey) throw new AppError('Push notifications no configuradas', 503)
  res.json({ success: true, data: { vapidPublicKey } })
}))

// GET /api/socio/:token/push/status
router.get('/:token/push/status', asyncHandler(async (req, res) => {
  const socio = await req.db.socio.findFirst({
    where: { tokenPortal: req.params.token },
    select: { id: true, notificarPush: true }
  })
  if (!socio) throw new AppError('Token inválido', 401)

  const suscripciones = await req.db.pushSubscription.findMany({
    where: { socioId: socio.id, activa: true },
    select: { id: true, userAgent: true, createdAt: true }
  })

  res.json({
    success: true,
    data: {
      habilitado: socio.notificarPush,
      suscripciones: suscripciones.length,
      dispositivos: suscripciones,
    }
  })
}))

// POST /api/socio/:token/push/subscribe
router.post('/:token/push/subscribe', asyncHandler(async (req, res) => {
  const { endpoint, keys } = req.body
  if (!endpoint || !keys?.p256dh || !keys?.auth) throw new AppError('Datos de suscripción inválidos', 400)

  const socio = await req.db.socio.findFirst({
    where: { tokenPortal: req.params.token },
    select: { id: true }
  })
  if (!socio) throw new AppError('Token inválido', 401)

  // Upsert por endpoint para evitar duplicados
  const existing = await req.db.pushSubscription.findFirst({
    where: { socioId: socio.id, endpoint }
  })

  let sub
  if (existing) {
    sub = await req.db.pushSubscription.update({
      where: { id: existing.id },
      data: { p256dh: keys.p256dh, auth: keys.auth, activa: true, userAgent: req.headers['user-agent'] || null }
    })
  } else {
    sub = await req.db.pushSubscription.create({
      data: {
        socioId: socio.id,
        tenantId: req.tenantId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: req.headers['user-agent'] || null,
        activa: true,
      }
    })
  }

  res.json({ success: true, data: { subscriptionId: sub.id } })
}))

// DELETE /api/socio/:token/push/unsubscribe
router.delete('/:token/push/unsubscribe', asyncHandler(async (req, res) => {
  const { endpoint } = req.body
  const socio = await req.db.socio.findFirst({
    where: { tokenPortal: req.params.token },
    select: { id: true }
  })
  if (!socio) throw new AppError('Token inválido', 401)

  if (endpoint) {
    await req.db.pushSubscription.updateMany({
      where: { socioId: socio.id, endpoint },
      data: { activa: false }
    })
  } else {
    // Desactivar todas
    await req.db.pushSubscription.updateMany({
      where: { socioId: socio.id },
      data: { activa: false }
    })
  }
  res.json({ success: true })
}))

// PUT /api/socio/:token/push/toggle
router.put('/:token/push/toggle', asyncHandler(async (req, res) => {
  const { habilitado } = req.body
  const socio = await req.db.socio.findFirst({
    where: { tokenPortal: req.params.token },
    select: { id: true }
  })
  if (!socio) throw new AppError('Token inválido', 401)

  await req.db.socio.update({
    where: { id: socio.id },
    data: { notificarPush: !!habilitado }
  })
  res.json({ success: true })
}))

export default router
