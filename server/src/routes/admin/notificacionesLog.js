import { Router } from 'express'
import { asyncHandler, AppError } from '../../middleware/errorHandler.js'
import { authAdmin } from '../../middleware/auth.js'
import { procesarNotificacionesPendientes, notificarMorosidad } from '../../services/notificacionService.js'

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

// POST /api/admin/notificaciones-log/avisar-cuotas-vencidas
// Encola UN aviso por socio (al titular del grupo familiar) consolidando sus cuotas
// vencidas. El filtro define una "ventana de períodos" contada hacia atrás desde el
// período en curso (mes/año actual): si periodosVentana=3, mira los últimos 3 períodos
// (ej: mayo + abril + marzo si estamos en mayo). Avisa a los socios que tengan al menos
// 1 cargo PENDIENTE vencido en alguno de esos períodos.
// NO filtra por estado del socio.
//
// Body: {
//   dryRun: true|false (default true),
//   periodosVentana: 3,                // cuántos meses hacia atrás desde el actual
//   evitarReavisar: true,              // si ya hay MOROSIDAD enviada en últimos 7 días, omitir
// }
//
// Si MODO_DEMO está activo, los envíos van redirigidos a EMAIL_DEMO / WHATSAPP_DEMO_NUMERO.
router.post('/notificaciones-log/avisar-cuotas-vencidas', authAdmin, asyncHandler(async (req, res) => {
  const dryRun = req.body?.dryRun !== false   // default true
  const periodosVentana = Math.max(1, parseInt(req.body?.periodosVentana || 3))
  const evitarReavisar = req.body?.evitarReavisar !== false  // default true

  const hoy0 = new Date(); hoy0.setHours(0, 0, 0, 0)

  // Config demo (informativa, ya la respeta el servicio de envío)
  const [modoDemo, emailDemo, waDemo] = await Promise.all([
    req.db.configuracion.findFirst({ where: { clave: 'MODO_DEMO' } }),
    req.db.configuracion.findFirst({ where: { clave: 'EMAIL_DEMO' } }),
    req.db.configuracion.findFirst({ where: { clave: 'WHATSAPP_DEMO_NUMERO' } }),
  ])
  const demo = {
    activo: modoDemo?.valor === 'true',
    email: emailDemo?.valor || null,
    whatsapp: waDemo?.valor || null,
  }

  // Identificar los últimos N períodos contando desde el período actual hacia atrás.
  // Período actual = año/mes de hoy. Si no existe Periodo para el mes actual,
  // tomamos los N más recientes que existan.
  const anioActual = hoy0.getFullYear()
  const mesActual = hoy0.getMonth() + 1  // 1-12
  const periodos = await req.db.periodo.findMany({
    where: {
      OR: [
        { anio: { lt: anioActual } },
        { anio: anioActual, mes: { lte: mesActual } },
      ],
    },
    orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
    take: periodosVentana,
    select: { id: true, anio: true, mes: true, nombre: true },
  })

  if (periodos.length === 0) {
    return res.json({
      success: true,
      data: { dryRun: true, demo, candidatos: 0, yaNotificados: 0, aEncolar: 0, ejemplos: [], periodosEnVentana: [] },
    })
  }

  const periodoIds = periodos.map(p => p.id)
  const periodoLabels = periodos.map(p => p.nombre || `${String(p.mes).padStart(2,'0')}/${p.anio}`)

  // Cargos PENDIENTE vencidos cuyo periodoId esté en la ventana (sin filtro de estado del socio)
  const cargosCandidatos = await req.db.cargo.findMany({
    where: {
      estado: 'PENDIENTE',
      fechaVencimiento: { lt: hoy0, not: null },
      socioId: { not: null },
      periodoId: { in: periodoIds },
    },
    select: {
      id: true,
      montoTotal: true,
      fechaVencimiento: true,
      descripcion: true,
      socioId: true,
      socio: {
        select: {
          id: true, nroSocio: true, apellidoNombre: true,
          email: true, celular: true,
          titularFamiliaId: true,
          notifEmail: true, notifWhatsapp: true, notificarMorosidad: true,
          estadoSocioRel: { select: { codigo: true, nombre: true, rolVigencia: true, permiteIngresoMolinete: true } },
        },
      },
    },
    orderBy: { fechaVencimiento: 'asc' },
  })

  // Agrupar por socio titular (o socio individual si no tiene familia)
  // Acumula cuotas y monto adeudado.
  const porTitular = new Map() // titularId → { socio, cantidadCuotas, totalAdeudado, vencimientoMasViejo }
  const titularIdsNecesarios = new Set()
  for (const c of cargosCandidatos) {
    const tid = c.socio?.titularFamiliaId || c.socioId
    titularIdsNecesarios.add(tid)
    if (!porTitular.has(tid)) {
      porTitular.set(tid, { titularId: tid, socioCualquiera: c.socio, cantidadCuotas: 0, totalAdeudado: 0, vencimientoMasViejo: c.fechaVencimiento })
    }
    const g = porTitular.get(tid)
    g.cantidadCuotas++
    g.totalAdeudado += Number(c.montoTotal)
    if (c.fechaVencimiento < g.vencimientoMasViejo) g.vencimientoMasViejo = c.fechaVencimiento
  }

  // Cargar los titulares reales (puede ser distinto al socio del cargo)
  const titulares = await req.db.socio.findMany({
    where: { id: { in: [...titularIdsNecesarios] } },
    select: {
      id: true, nroSocio: true, apellidoNombre: true,
      email: true, celular: true,
      notifEmail: true, notifWhatsapp: true, notificarMorosidad: true,
      estadoSocioRel: { select: { codigo: true, nombre: true, rolVigencia: true, permiteIngresoMolinete: true } },
    },
  })
  const titularesMap = new Map(titulares.map(t => [t.id, t]))

  // Todos los socios con al menos 1 cuota vencida en la ventana de períodos
  let grupos = [...porTitular.values()]
    .map(g => ({ ...g, titular: titularesMap.get(g.titularId) || g.socioCualquiera }))

  const candidatos = grupos.length

  // Evitar reavisar: si ya hay MOROSIDAD enviada al titular en los últimos 7 días
  let yaNotificados = 0
  if (evitarReavisar && grupos.length > 0) {
    const hace7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const titularIds = grupos.map(g => g.titularId)
    const previos = await req.db.notificacionLog.findMany({
      where: {
        eventType: 'MOROSIDAD',
        socioId: { in: titularIds },
        enviado: true,
        error: null,
        fechaEnvio: { gte: hace7d },
      },
      select: { socioId: true },
    })
    const yaSet = new Set(previos.map(p => p.socioId))
    yaNotificados = grupos.filter(g => yaSet.has(g.titularId)).length
    grupos = grupos.filter(g => !yaSet.has(g.titularId))
  }

  // Ordenar: más viejos primero
  grupos.sort((a, b) => a.vencimientoMasViejo - b.vencimientoMasViejo)

  const ejemplos = grupos.slice(0, 15).map(g => ({
    socioId: g.titularId,
    socio: g.titular ? `#${g.titular.nroSocio} ${g.titular.apellidoNombre}` : '-',
    estado: g.titular?.estadoSocioRel?.codigo,
    bloqueado: g.titular?.estadoSocioRel?.rolVigencia === 'BLOQUEADO',
    cantidadCuotas: g.cantidadCuotas,
    totalAdeudado: g.totalAdeudado,
    vencimientoMasViejo: g.vencimientoMasViejo,
    flagSocio: g.titular?.notificarMorosidad !== false,
    tieneEmail: !!g.titular?.email && g.titular?.notifEmail !== false,
    tieneWA: !!g.titular?.celular && g.titular?.notifWhatsapp !== false,
  }))

  if (dryRun) {
    return res.json({
      success: true,
      data: {
        dryRun: true,
        demo,
        candidatos,
        yaNotificados,
        aEncolar: grupos.length,
        ejemplos,
        periodosEnVentana: periodoLabels,
      },
    })
  }

  // Encolar de verdad: un aviso por titular consolidando toda la deuda del grupo
  let encolados = 0, omitidos = 0, errores = 0
  for (const g of grupos) {
    try {
      const antes = await req.db.notificacionLog.count({
        where: { socioId: g.titularId, eventType: 'MOROSIDAD', enviado: false },
      })
      await notificarMorosidad(g.titularId)
      const despues = await req.db.notificacionLog.count({
        where: { socioId: g.titularId, eventType: 'MOROSIDAD', enviado: false },
      })
      if (despues > antes) encolados++
      else omitidos++  // el titular tenía notificarMorosidad=false u otro opt-out
    } catch (err) {
      errores++
      console.error(`Error encolando morosidad socio ${g.titularId}:`, err.message)
    }
  }

  res.json({
    success: true,
    data: {
      dryRun: false,
      demo,
      candidatos,
      yaNotificados,
      encolados,
      omitidos,
      errores,
      periodosEnVentana: periodoLabels,
      mensaje: 'Notificaciones encoladas. Andá a la cola y "Procesar ahora" para enviarlas.',
    },
  })
}))

export default router
