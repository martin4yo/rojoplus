import { Router } from 'express'
import { asyncHandler, AppError } from '../../middleware/errorHandler.js'
import { authAdmin } from '../../middleware/auth.js'

const router = Router()

// ============================================
// GESTIONES DE COBRANZA
// ============================================

// GET /api/admin/cobranzas - Listar todas las gestiones de cobranza
router.get('/', authAdmin, asyncHandler(async (req, res) => {
  const {
    estado,
    prioridad,
    responsableId,
    page = 1,
    limit = 50,
    search
  } = req.query

  const skip = (parseInt(page) - 1) * parseInt(limit)

  // Construir filtros
  const where = {}

  if (estado) {
    where.estado = estado
  }

  if (prioridad) {
    where.prioridad = prioridad
  }

  if (responsableId) {
    where.responsableId = parseInt(responsableId)
  }

  if (search) {
    where.socio = {
      OR: [
        { apellidoNombre: { contains: search, mode: 'insensitive' } },
        { nroSocio: { contains: search } },
        { documento: { contains: search } }
      ]
    }
  }

  const [gestiones, total] = await Promise.all([
    req.req.db.gestionCobranza.findMany({
      where,
      skip,
      take: parseInt(limit),
      include: {
        socio: {
          select: {
            id: true,
            nroSocio: true,
            apellidoNombre: true,
            email: true,
            celular: true
          }
        },
        responsable: {
          select: {
            id: true,
            nombre: true,
            apellido: true
          }
        },
        _count: {
          select: { acciones: true }
        }
      },
      orderBy: [
        { prioridad: 'desc' },
        { diasAtraso: 'desc' }
      ]
    }),
    req.req.db.gestionCobranza.count({ where })
  ])

  res.json({
    success: true,
    data: gestiones,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  })
}))

// GET /api/admin/cobranzas/estadisticas - Estadísticas generales
router.get('/estadisticas', authAdmin, asyncHandler(async (req, res) => {
  const [
    totalGestiones,
    porPrioridad,
    porEstado,
    totalDeuda
  ] = await Promise.all([
    req.req.db.gestionCobranza.count(),
    req.req.db.gestionCobranza.groupBy({
      by: ['prioridad'],
      _count: true
    }),
    req.req.db.gestionCobranza.groupBy({
      by: ['estado'],
      _count: true
    }),
    req.req.db.gestionCobranza.aggregate({
      _sum: { montoDeuda: true }
    })
  ])

  res.json({
    success: true,
    data: {
      totalGestiones,
      totalDeuda: totalDeuda._sum.montoDeuda || 0,
      porPrioridad,
      porEstado
    }
  })
}))

// GET /api/admin/cobranzas/:id - Detalle de una gestión
router.get('/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const gestion = await req.req.db.gestionCobranza.findUnique({
    where: { id: parseInt(id) },
    include: {
      socio: {
        include: {
          cargos: {
            where: {
              estado: 'PENDIENTE',
              fechaVencimiento: { lt: new Date() }
            },
            orderBy: { fechaVencimiento: 'asc' }
          }
        }
      },
      responsable: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
          email: true
        }
      },
      acciones: {
        include: {
          responsable: {
            select: {
              id: true,
              nombre: true,
              apellido: true
            }
          }
        },
        orderBy: { fecha: 'desc' }
      }
    }
  })

  if (!gestion) {
    throw new AppError('Gestión no encontrada', 404, 'NOT_FOUND')
  }

  res.json({
    success: true,
    data: gestion
  })
}))

// POST /api/admin/cobranzas/:id/acciones - Registrar nueva acción
router.post('/:id/acciones', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const {
    tipo,
    resultado,
    contactado,
    observaciones,
    monto,
    promesaPago,
    proximaAccion,
    fechaProxima
  } = req.body

  const gestion = await req.req.db.gestionCobranza.findUnique({
    where: { id: parseInt(id) }
  })

  if (!gestion) {
    throw new AppError('Gestión no encontrada', 404, 'NOT_FOUND')
  }

  // Crear la acción
  const accion = await req.req.db.accionCobranza.create({
    data: {
      gestionId: parseInt(id),
      tipo,
      resultado,
      contactado: contactado || false,
      observaciones,
      monto: monto ? parseFloat(monto) : null,
      promesaPago: promesaPago ? new Date(promesaPago) : null,
      proximaAccion,
      fechaProxima: fechaProxima ? new Date(fechaProxima) : null,
      responsableId: req.user.id
    },
    include: {
      responsable: {
        select: {
          id: true,
          nombre: true,
          apellido: true
        }
      }
    }
  })

  // Actualizar la gestión
  const nuevoEstado =
    resultado === 'PROMESA_PAGO' ? 'PROMESA_PAGO' :
    resultado === 'SIN_RESPUESTA' ? 'NO_CONTACTADO' :
    resultado === 'PAGO_REALIZADO' ? 'RESUELTO' :
    contactado ? 'EN_GESTION' : gestion.estado

  await req.req.db.gestionCobranza.update({
    where: { id: parseInt(id) },
    data: {
      ultimaAccion: tipo,
      fechaUltimaAccion: new Date(),
      proximaAccion: proximaAccion || null,
      fechaProximaAccion: fechaProxima ? new Date(fechaProxima) : null,
      estado: nuevoEstado,
      recordatorioEnviado: false
    }
  })

  res.json({
    success: true,
    data: accion,
    message: 'Acción registrada correctamente'
  })
}))

// PUT /api/admin/cobranzas/:id - Actualizar gestión
router.put('/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { estado, responsableId, proximaAccion, fechaProximaAccion } = req.body

  const updated = await req.req.db.gestionCobranza.update({
    where: { id: parseInt(id) },
    data: {
      estado,
      responsableId: responsableId ? parseInt(responsableId) : null,
      proximaAccion,
      fechaProximaAccion: fechaProximaAccion ? new Date(fechaProximaAccion) : null,
      recordatorioEnviado: false
    },
    include: {
      socio: {
        select: {
          id: true,
          nroSocio: true,
          apellidoNombre: true
        }
      },
      responsable: {
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
    message: 'Gestión actualizada correctamente'
  })
}))

// DELETE /api/admin/cobranzas/:id - Eliminar gestión (solo si está resuelta)
router.delete('/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const gestion = await req.req.db.gestionCobranza.findUnique({
    where: { id: parseInt(id) }
  })

  if (!gestion) {
    throw new AppError('Gestión no encontrada', 404, 'NOT_FOUND')
  }

  if (gestion.estado !== 'RESUELTO') {
    throw new AppError('Solo se pueden eliminar gestiones resueltas', 400, 'INVALID_STATE')
  }

  await req.req.db.gestionCobranza.delete({
    where: { id: parseInt(id) }
  })

  res.json({
    success: true,
    message: 'Gestión eliminada correctamente'
  })
}))

export default router
