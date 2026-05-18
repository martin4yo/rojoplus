import { Router } from 'express'
import { asyncHandler, AppError } from '../../middleware/errorHandler.js'
import { authAdmin } from '../../middleware/auth.js'
import { procesarNotificacionesPendientes } from '../../services/notificacionService.js'

const router = Router()

// Helper: clasifica estado según campos de NotificacionLog
function clasificarEstado(l) {
  if (l.enviado) {
    if (l.error && l.error.startsWith('MAX_INTENTOS_AGOTADO')) return 'FALLIDO_DEFINITIVO'
    if (l.error) return 'ENVIADO_CON_ERROR'
    return 'ENVIADO'
  }
  return l.error ? 'REINTENTANDO' : 'PENDIENTE'
}

// GET /api/admin/notificaciones-log
// Query: ?page=1&limit=50&tipo=EMAIL|WHATSAPP&estado=PENDIENTE|ENVIADO|REINTENTANDO|FALLIDO_DEFINITIVO&eventType=BLOQUEO_MOROSIDAD&desde=ISO&hasta=ISO
router.get('/notificaciones-log', authAdmin, asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1)
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200)
  const skip = (page - 1) * limit

  const where = {}
  if (req.query.tipo) where.tipo = req.query.tipo
  if (req.query.eventType) where.eventType = req.query.eventType
  if (req.query.desde) where.createdAt = { ...(where.createdAt || {}), gte: new Date(req.query.desde) }
  if (req.query.hasta) where.createdAt = { ...(where.createdAt || {}), lte: new Date(req.query.hasta) }

  if (req.query.estado === 'PENDIENTE') Object.assign(where, { enviado: false, error: null })
  if (req.query.estado === 'REINTENTANDO') Object.assign(where, { enviado: false, error: { not: null } })
  if (req.query.estado === 'ENVIADO') Object.assign(where, { enviado: true, error: null })
  if (req.query.estado === 'FALLIDO_DEFINITIVO') {
    Object.assign(where, { enviado: true, error: { startsWith: 'MAX_INTENTOS_AGOTADO' } })
  }

  const [total, logs] = await Promise.all([
    req.db.notificacionLog.count({ where }),
    req.db.notificacionLog.findMany({
      where,
      orderBy: [{ id: 'desc' }],
      skip,
      take: limit,
      include: { socio: { select: { id: true, nroSocio: true, apellidoNombre: true } } },
    }),
  ])

  res.json({
    success: true,
    data: {
      logs: logs.map(l => ({
        id: l.id,
        socio: l.socio ? { id: l.socio.id, nroSocio: l.socio.nroSocio, apellidoNombre: l.socio.apellidoNombre } : null,
        tipo: l.tipo,
        eventType: l.eventType,
        destinatario: l.destinatario,
        asunto: l.asunto,
        cuerpo: l.cuerpo,
        enviado: l.enviado,
        fechaEnvio: l.fechaEnvio,
        fechaProgramado: l.fechaProgramado,
        intentos: l.intentos,
        error: l.error,
        createdAt: l.createdAt,
        estado: clasificarEstado(l),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    },
  })
}))

// GET /api/admin/notificaciones-log/dashboard
// Resumen rápido de la cola: totales por estado, por evento, errores recientes.
router.get('/notificaciones-log/dashboard', authAdmin, asyncHandler(async (req, res) => {
  const ahora = new Date()
  const desde24h = new Date(ahora.getTime() - 24 * 60 * 60 * 1000)
  const desde7d = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [
    pendientes,
    reintentando,
    fallidos,
    enviadosHoy,
    fallidosUlt7d,
    porTipo24h,
    porEventoUlt7d,
  ] = await Promise.all([
    req.db.notificacionLog.count({ where: { enviado: false, error: null } }),
    req.db.notificacionLog.count({ where: { enviado: false, error: { not: null } } }),
    req.db.notificacionLog.count({ where: { enviado: true, error: { startsWith: 'MAX_INTENTOS_AGOTADO' } } }),
    req.db.notificacionLog.count({ where: { enviado: true, error: null, fechaEnvio: { gte: desde24h } } }),
    req.db.notificacionLog.count({ where: { error: { not: null }, createdAt: { gte: desde7d } } }),
    req.db.notificacionLog.groupBy({
      by: ['tipo'],
      where: { createdAt: { gte: desde24h } },
      _count: { _all: true },
    }),
    req.db.notificacionLog.groupBy({
      by: ['eventType'],
      where: { createdAt: { gte: desde7d } },
      _count: { _all: true },
    }),
  ])

  res.json({
    success: true,
    data: {
      pendientes,
      reintentando,
      fallidos,
      enviadosHoy,
      fallidosUlt7d,
      porTipo24h: porTipo24h.map(g => ({ tipo: g.tipo, count: g._count._all })),
      porEventoUlt7d: porEventoUlt7d.map(g => ({ eventType: g.eventType, count: g._count._all })),
    },
  })
}))

// POST /api/admin/notificaciones-log/:id/reintentar - reencolar para próximo intento inmediato
router.post('/notificaciones-log/:id/reintentar', authAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id)
  const log = await req.db.notificacionLog.findUnique({ where: { id } })
  if (!log) throw new AppError('Notificación no encontrada', 404, 'NOT_FOUND')
  const updated = await req.db.notificacionLog.update({
    where: { id },
    data: { enviado: false, intentos: 0, error: null, fechaProgramado: new Date(), fechaEnvio: null },
  })
  res.json({ success: true, data: updated })
}))

// POST /api/admin/notificaciones-log/procesar-ahora - dispara el procesador manualmente
router.post('/notificaciones-log/procesar-ahora', authAdmin, asyncHandler(async (req, res) => {
  const r = await procesarNotificacionesPendientes()
  res.json({ success: true, data: r })
}))

export default router
