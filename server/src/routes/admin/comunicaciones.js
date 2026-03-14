import { Router } from 'express'
import { asyncHandler, AppError } from '../../middleware/errorHandler.js'
import { authAdmin } from '../../middleware/auth.js'

const router = Router()

// ============================================
// CAMPAÑAS DE COMUNICACIÓN
// ============================================

// GET /api/admin/comunicaciones/campanas - Listar campañas
router.get('/campanas', authAdmin, asyncHandler(async (req, res) => {
  const {
    tipo,
    estado,
    page = 1,
    limit = 20
  } = req.query

  const skip = (parseInt(page) - 1) * parseInt(limit)

  const where = {}
  if (tipo) where.tipo = tipo
  if (estado) where.estado = estado

  const [campanas, total] = await Promise.all([
    req.prisma.campanaComunicacion.findMany({
      where,
      skip,
      take: parseInt(limit),
      include: {
        creadoPor: {
          select: {
            id: true,
            nombre: true,
            apellido: true
          }
        },
        emailTemplate: {
          select: {
            id: true,
            nombre: true,
            asunto: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    req.prisma.campanaComunicacion.count({ where })
  ])

  res.json({
    success: true,
    data: campanas,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  })
}))

// POST /api/admin/comunicaciones/campanas - Crear campaña
router.post('/campanas', authAdmin, asyncHandler(async (req, res) => {
  const {
    nombre,
    descripcion,
    tipo,
    canales,
    emailTemplateId,
    whatsappTemplate,
    smsTemplate,
    pushTemplate,
    segmentacion,
    fechaProgramada
  } = req.body

  // Validaciones
  if (!nombre || !tipo || !segmentacion) {
    throw new AppError('Faltan datos obligatorios', 400, 'VALIDATION_ERROR')
  }

  // Validar que tenga al menos un template según el canal
  const canalesArray = Array.isArray(canales) ? canales : JSON.parse(canales || '[]')

  if (canalesArray.includes('email') && !emailTemplateId) {
    throw new AppError('Debe seleccionar un template de email', 400, 'VALIDATION_ERROR')
  }

  if (canalesArray.includes('whatsapp') && !whatsappTemplate) {
    throw new AppError('Debe proporcionar un template de WhatsApp', 400, 'VALIDATION_ERROR')
  }

  // Calcular destinatarios según segmentación
  const segmentacionObj = typeof segmentacion === 'string' ? JSON.parse(segmentacion) : segmentacion
  const destinatarios = await calcularDestinatarios(req.prisma, segmentacionObj)

  const campana = await req.prisma.campanaComunicacion.create({
    data: {
      nombre,
      descripcion: descripcion || null,
      tipo,
      canales: JSON.stringify(canalesArray),
      emailTemplateId: emailTemplateId || null,
      whatsappTemplate: whatsappTemplate || null,
      smsTemplate: smsTemplate || null,
      pushTemplate: pushTemplate || null,
      segmentacion: typeof segmentacion === 'string' ? segmentacion : JSON.stringify(segmentacion),
      destinatarios: JSON.stringify(destinatarios),
      totalDestinatarios: destinatarios.length,
      estado: fechaProgramada ? 'PROGRAMADA' : 'BORRADOR',
      fechaProgramada: fechaProgramada ? new Date(fechaProgramada) : null,
      enviados: 0,
      abiertos: 0,
      clicks: 0,
      rebotados: 0,
      errores: 0,
      creadoPorId: req.user.id
    },
    include: {
      creadoPor: {
        select: {
          id: true,
          nombre: true,
          apellido: true
        }
      },
      emailTemplate: {
        select: {
          id: true,
          nombre: true,
          asunto: true
        }
      }
    }
  })

  res.json({
    success: true,
    data: campana,
    message: 'Campaña creada correctamente'
  })
}))

// Función auxiliar para calcular destinatarios
async function calcularDestinatarios(prisma, segmentacion) {
  const where = {}

  // Aplicar filtros de segmentación
  if (segmentacion.estado) {
    where.estado = { in: Array.isArray(segmentacion.estado) ? segmentacion.estado : [segmentacion.estado] }
  }

  if (segmentacion.categoria) {
    where.categoria = { in: Array.isArray(segmentacion.categoria) ? segmentacion.categoria : [segmentacion.categoria] }
  }

  if (segmentacion.edadMin || segmentacion.edadMax) {
    const hoy = new Date()
    where.fechaNacimiento = {}

    if (segmentacion.edadMax) {
      const fechaMin = new Date(hoy.getFullYear() - parseInt(segmentacion.edadMax), hoy.getMonth(), hoy.getDate())
      where.fechaNacimiento.gte = fechaMin
    }

    if (segmentacion.edadMin) {
      const fechaMax = new Date(hoy.getFullYear() - parseInt(segmentacion.edadMin), hoy.getMonth(), hoy.getDate())
      where.fechaNacimiento.lte = fechaMax
    }
  }

  if (segmentacion.deudores === true) {
    where.cargos = {
      some: {
        estado: 'PENDIENTE',
        fechaVencimiento: { lt: new Date() }
      }
    }
  }

  if (segmentacion.deudores === false) {
    where.OR = [
      { cargos: { none: {} } },
      {
        cargos: {
          every: {
            OR: [
              { estado: { not: 'PENDIENTE' } },
              { fechaVencimiento: { gte: new Date() } }
            ]
          }
        }
      }
    ]
  }

  // Buscar socios
  const socios = await prisma.socio.findMany({
    where,
    select: {
      id: true,
      nroSocio: true,
      apellidoNombre: true,
      email: true,
      celular: true
    }
  })

  return socios
}

// GET /api/admin/comunicaciones/campanas/:id - Detalle de campaña
router.get('/campanas/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const campana = await req.prisma.campanaComunicacion.findUnique({
    where: { id: parseInt(id) },
    include: {
      creadoPor: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
          email: true
        }
      },
      emailTemplate: {
        select: {
          id: true,
          nombre: true,
          asunto: true,
          cuerpo: true
        }
      },
      envios: {
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: {
          socio: {
            select: {
              id: true,
              nroSocio: true,
              apellidoNombre: true
            }
          }
        }
      }
    }
  })

  if (!campana) {
    throw new AppError('Campaña no encontrada', 404, 'NOT_FOUND')
  }

  res.json({
    success: true,
    data: campana
  })
}))

// PUT /api/admin/comunicaciones/campanas/:id - Actualizar campaña
router.put('/campanas/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const {
    nombre,
    descripcion,
    estado,
    fechaProgramada
  } = req.body

  const campana = await req.prisma.campanaComunicacion.findUnique({
    where: { id: parseInt(id) }
  })

  if (!campana) {
    throw new AppError('Campaña no encontrada', 404, 'NOT_FOUND')
  }

  // No permitir editar campañas ya enviadas
  if (campana.estado === 'ENVIADA' && estado !== 'ENVIADA') {
    throw new AppError('No se puede modificar una campaña ya enviada', 400, 'INVALID_STATE')
  }

  const updated = await req.prisma.campanaComunicacion.update({
    where: { id: parseInt(id) },
    data: {
      nombre: nombre || undefined,
      descripcion: descripcion !== undefined ? descripcion : undefined,
      estado: estado || undefined,
      fechaProgramada: fechaProgramada ? new Date(fechaProgramada) : undefined
    },
    include: {
      creadoPor: {
        select: {
          id: true,
          nombre: true,
          apellido: true
        }
      }
    }
  })

  res.json({
    success: true,
    data: updated,
    message: 'Campaña actualizada correctamente'
  })
}))

// POST /api/admin/comunicaciones/campanas/:id/enviar - Enviar campaña
router.post('/campanas/:id/enviar', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const campana = await req.prisma.campanaComunicacion.findUnique({
    where: { id: parseInt(id) },
    include: {
      emailTemplate: true
    }
  })

  if (!campana) {
    throw new AppError('Campaña no encontrada', 404, 'NOT_FOUND')
  }

  if (campana.estado === 'ENVIADA') {
    throw new AppError('Esta campaña ya fue enviada', 400, 'ALREADY_SENT')
  }

  // Obtener destinatarios
  const destinatarios = JSON.parse(campana.destinatarios || '[]')

  if (destinatarios.length === 0) {
    throw new AppError('No hay destinatarios para esta campaña', 400, 'NO_RECIPIENTS')
  }

  // Crear registros de envío para cada destinatario
  const canales = JSON.parse(campana.canales || '[]')

  for (const socio of destinatarios) {
    for (const canal of canales) {
      let destinatario = ''

      if (canal === 'email' && socio.email) {
        destinatario = socio.email
      } else if (canal === 'whatsapp' && socio.celular) {
        destinatario = socio.celular
      } else if (canal === 'sms' && socio.celular) {
        destinatario = socio.celular
      } else {
        continue // No tiene este canal disponible
      }

      await req.prisma.envioCampana.create({
        data: {
          campanaId: campana.id,
          socioId: socio.id,
          canal,
          destinatario,
          estado: 'PENDIENTE',
          abierto: false,
          clickeo: false,
          rebotado: false,
          intentos: 0
        }
      })
    }
  }

  // Actualizar estado de campaña
  await req.prisma.campanaComunicacion.update({
    where: { id: parseInt(id) },
    data: {
      estado: 'EN_CURSO',
      fechaEnvio: new Date()
    }
  })

  // TODO: Aquí se debe integrar con el servicio de envío real (email, WhatsApp, SMS)
  // Por ahora solo creamos los registros de envío

  res.json({
    success: true,
    message: 'Campaña enviada correctamente',
    data: {
      totalDestinatarios: destinatarios.length,
      canales
    }
  })
}))

// DELETE /api/admin/comunicaciones/campanas/:id - Eliminar campaña
router.delete('/campanas/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const campana = await req.prisma.campanaComunicacion.findUnique({
    where: { id: parseInt(id) }
  })

  if (!campana) {
    throw new AppError('Campaña no encontrada', 404, 'NOT_FOUND')
  }

  if (campana.estado === 'EN_CURSO' || campana.estado === 'ENVIADA') {
    throw new AppError('No se puede eliminar una campaña en curso o enviada', 400, 'INVALID_STATE')
  }

  await req.prisma.campanaComunicacion.delete({
    where: { id: parseInt(id) }
  })

  res.json({
    success: true,
    message: 'Campaña eliminada correctamente'
  })
}))

// GET /api/admin/comunicaciones/campanas/:id/estadisticas - Estadísticas de campaña
router.get('/campanas/:id/estadisticas', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const campana = await req.prisma.campanaComunicacion.findUnique({
    where: { id: parseInt(id) }
  })

  if (!campana) {
    throw new AppError('Campaña no encontrada', 404, 'NOT_FOUND')
  }

  const [
    totalEnvios,
    porCanal,
    porEstado,
    tasaApertura,
    tasaClicks
  ] = await Promise.all([
    req.prisma.envioCampana.count({
      where: { campanaId: parseInt(id) }
    }),
    req.prisma.envioCampana.groupBy({
      by: ['canal'],
      where: { campanaId: parseInt(id) },
      _count: true
    }),
    req.prisma.envioCampana.groupBy({
      by: ['estado'],
      where: { campanaId: parseInt(id) },
      _count: true
    }),
    req.prisma.envioCampana.count({
      where: {
        campanaId: parseInt(id),
        abierto: true
      }
    }),
    req.prisma.envioCampana.count({
      where: {
        campanaId: parseInt(id),
        clickeo: true
      }
    })
  ])

  const tasaAperturaPorc = totalEnvios > 0 ? (tasaApertura / totalEnvios) * 100 : 0
  const tasaClicksPorc = totalEnvios > 0 ? (tasaClicks / totalEnvios) * 100 : 0

  res.json({
    success: true,
    data: {
      totalEnvios,
      porCanal,
      porEstado,
      tasaApertura: tasaAperturaPorc.toFixed(2),
      tasaClicks: tasaClicksPorc.toFixed(2)
    }
  })
}))

export default router
