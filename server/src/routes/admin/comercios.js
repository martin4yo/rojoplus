import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { asyncHandler, AppError } from '../../middleware/errorHandler.js'
import { authAdmin } from '../../middleware/auth.js'
import { enviarEmailAprobacion, enviarEmailRechazo, enviarEmailLinkAcceso } from '../../services/email.js'

const router = Router()

// GET /api/admin/comercios
router.get('/comercios', authAdmin, asyncHandler(async (req, res) => {
  const { estado, page = 1, limit = 20 } = req.query

  const where = estado ? { estado } : {}

  const [comercios, total, totalVentasGlobal] = await Promise.all([
    req.db.comercio.findMany({
      where,
      include: { rubro: true, _count: { select: { ventas: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit),
    }),
    req.db.comercio.count({ where }),
    req.db.venta.count(),
  ])

  res.json({
    success: true,
    data: {
      comercios: comercios.map(c => ({
        id: c.id,
        nombre: c.nombre,
        email: c.email,
        rubro: c.rubro?.nombre,
        estado: c.estado,
        descuentoPct: Number(c.descuentoPct),
        createdAt: c.createdAt,
        cantVentas: c._count.ventas,
        pctVentas: totalVentasGlobal > 0 ? Math.round((c._count.ventas / totalVentasGlobal) * 100 * 10) / 10 : 0,
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    },
  })
}))

// GET /api/admin/comercios/:id
router.get('/comercios/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const comercio = await req.db.comercio.findUnique({
    where: { id: parseInt(id) },
    include: { rubro: true },
  })

  if (!comercio) {
    throw new AppError('Comercio no encontrado', 404, 'NOT_FOUND')
  }

  // Stats
  const stats = await req.db.venta.aggregate({
    where: { comercioId: comercio.id },
    _count: true,
    _sum: { importeFinal: true },
  })

  res.json({
    success: true,
    data: {
      ...comercio,
      descuentoPct: Number(comercio.descuentoPct),
      acumDescuentoExtra: comercio.acumDescuentoExtra ? Number(comercio.acumDescuentoExtra) : null,
      totalVentas: stats._count,
      montoTotalVentas: Number(stats._sum.importeFinal) || 0,
    },
  })
}))

// POST /api/admin/comercios/:id/aprobar
router.post('/comercios/:id/aprobar', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const comercio = await req.db.comercio.update({
    where: { id: parseInt(id) },
    data: {
      estado: 'ACTIVO',
      token: uuidv4(),
      approvedAt: new Date(),
    },
  })

  // Enviar email con link de acceso
  try {
    await enviarEmailAprobacion(comercio, req.db)
  } catch (emailError) {
    console.error('Error enviando email de aprobación:', emailError)
  }

  res.json({
    success: true,
    data: {
      id: comercio.id,
      estado: comercio.estado,
      token: comercio.token,
      mensaje: 'Comercio aprobado. Se envió email con link de acceso.',
    },
  })
}))

// POST /api/admin/comercios/:id/rechazar
router.post('/comercios/:id/rechazar', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { motivo } = req.body

  const comercio = await req.db.comercio.update({
    where: { id: parseInt(id) },
    data: {
      estado: 'RECHAZADO',
      motivoRechazo: motivo,
    },
  })

  // Enviar email de rechazo
  try {
    await enviarEmailRechazo(comercio, motivo, req.db)
  } catch (emailError) {
    console.error('Error enviando email de rechazo:', emailError)
  }

  res.json({
    success: true,
    data: {
      id: comercio.id,
      estado: comercio.estado,
      mensaje: 'Comercio rechazado. Se envió email de notificación.',
    },
  })
}))

// PATCH /api/admin/comercios/:id
router.patch('/comercios/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { descuentoPct, acumulacionActiva, acumComprasReq, acumPeriodoDias, acumDescuentoExtra } = req.body

  const comercio = await req.db.comercio.update({
    where: { id: parseInt(id) },
    data: {
      descuentoPct,
      acumulacionActiva,
      acumComprasReq,
      acumPeriodoDias,
      acumDescuentoExtra,
    },
  })

  res.json({
    success: true,
    data: {
      id: comercio.id,
      mensaje: 'Comercio actualizado',
    },
  })
}))

// POST /api/admin/comercios/:id/desactivar
router.post('/comercios/:id/desactivar', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  await req.db.comercio.update({
    where: { id: parseInt(id) },
    data: { estado: 'INACTIVO' },
  })

  res.json({
    success: true,
    data: { mensaje: 'Comercio desactivado' },
  })
}))

// POST /api/admin/comercios/:id/reenviar-link
router.post('/comercios/:id/reenviar-link', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const comercio = await req.db.comercio.findUnique({
    where: { id: parseInt(id) },
  })

  if (!comercio) {
    throw new AppError('Comercio no encontrado', 404, 'NOT_FOUND')
  }

  if (!comercio.token) {
    throw new AppError('El comercio no tiene token de acceso', 400, 'NO_TOKEN')
  }

  // Enviar email con link de acceso
  try {
    await enviarEmailLinkAcceso(comercio, req.db)
  } catch (emailError) {
    console.error('Error enviando email:', emailError)
    throw new AppError('Error al enviar el email', 500, 'EMAIL_ERROR')
  }

  res.json({
    success: true,
    data: {
      mensaje: `Link de acceso reenviado a ${comercio.email}`,
    },
  })
}))

export default router
