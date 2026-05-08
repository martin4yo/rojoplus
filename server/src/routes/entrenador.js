/**
 * Rutas del Portal del Entrenador.
 * Acceso vía magic link (email o WhatsApp). Sesión persistente con cookie
 * `entrenador_sid` (30 días sliding, igual que socio).
 *
 * Bloques implementados:
 *   1) Login + datos personales + mis categorías + plantel + asistencia + entrenamientos
 *   2) Convocatorias a partidos
 *   3) Chat con socios
 */

import { Router } from 'express'
import crypto from 'crypto'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { authEntrenador, tienePermisoCategoria } from '../middleware/authEntrenador.js'
import { enviarMagicLinkEntrenador, enviarEmail } from '../services/email.js'
import { enviarWhatsApp } from '../services/whatsappService.js'
import { getTenantFrontendUrl } from '../lib/tenantUrl.js'
import {
  crearSesion, validarSesion, revocarSesion, listarSesionesActivas,
  setSesionCookie, clearSesionCookie, SESSION_COOKIE,
} from '../services/sesionEntrenadorService.js'

const router = Router()

// ════════════════════════════════════════════════════════════════════════════
// AUTH (público)
// ════════════════════════════════════════════════════════════════════════════

// Buscar entrenador por email o documento.
// Matchea contra Entrenador.email/documento (legacy) Y contra Entidad.email/documento
// (nuevo modelo unificado), así funciona pre y post migración.
async function buscarEntrenador(db, valor) {
  const trim = (valor || '').trim()
  if (!trim) return null
  const SELECT = {
    id: true, nombre: true, apellido: true, email: true, telefono: true,
    documento: true, activo: true,
    entidad: { select: { id: true, razonSocial: true, email: true, telefono: true, documento: true } },
  }

  if (trim.includes('@')) {
    return db.entrenador.findFirst({
      where: {
        OR: [
          { email: { equals: trim, mode: 'insensitive' } },
          { entidad: { email: { equals: trim, mode: 'insensitive' } } },
        ],
      },
      select: SELECT,
    })
  }

  return db.entrenador.findFirst({
    where: {
      OR: [
        { documento: trim },
        { entidad: { documento: trim } },
      ],
    },
    select: SELECT,
  })
}

// POST /api/entrenador/enviar-link-acceso
router.post('/enviar-link-acceso', asyncHandler(async (req, res) => {
  const { valor, canal = 'email' } = req.body
  if (!valor?.trim()) throw new AppError('Ingresá email o documento', 400, 'VALIDATION_ERROR')
  if (!['email', 'whatsapp'].includes(canal)) throw new AppError('Canal inválido', 400, 'VALIDATION_ERROR')

  const entrenador = await buscarEntrenador(req.db, valor)
  if (!entrenador) throw new AppError('No se encontró un entrenador con esos datos', 404, 'NOT_FOUND')
  if (!entrenador.activo) throw new AppError('El entrenador está inactivo. Contactá al club.', 403, 'INACTIVO')

  // Resolver email/teléfono con fallback a la Entidad asociada
  const emailEfectivo = entrenador.email || entrenador.entidad?.email
  const telefonoEfectivo = entrenador.telefono || entrenador.entidad?.telefono

  if (canal === 'email' && !emailEfectivo) {
    throw new AppError('No tenés email registrado. Probá con WhatsApp o contactá al club.', 400, 'NO_EMAIL')
  }
  if (canal === 'whatsapp' && !telefonoEfectivo) {
    throw new AppError('No tenés teléfono registrado. Probá con email.', 400, 'NO_PHONE')
  }

  const token = crypto.randomBytes(32).toString('hex')
  const exp = new Date(); exp.setHours(exp.getHours() + 24)
  await req.db.entrenador.update({
    where: { id: entrenador.id },
    data: { tokenPortal: token, tokenPortalExpira: exp },
  })

  const portalLink = `${getTenantFrontendUrl(req.tenant)}/portal-entrenador/${token}`
  const nombreSaludo = entrenador.nombre || entrenador.entidad?.razonSocial?.split(' ')[0] || 'Entrenador'

  if (canal === 'whatsapp') {
    await enviarWhatsApp({
      db: req.db,
      telefono: telefonoEfectivo,
      texto: `Hola ${nombreSaludo}! Tu link de acceso al Portal del Entrenador:\n\n${portalLink}\n\nVálido por 24 horas.`,
      ignorarHorario: true,
    })
    const masked = telefonoEfectivo.replace(/(\d{3})\d+(\d{3})/, '$1****$2')
    return res.json({ success: true, data: { canal: 'whatsapp', destino: masked } })
  }

  await enviarMagicLinkEntrenador(
    { ...entrenador, email: emailEfectivo, tenantId: req.tenantId },
    token, req.db, req.tenantId
  )
  const masked = emailEfectivo.replace(/(.{2})(.*)(@.*)/, '$1***$3')
  return res.json({ success: true, data: { canal: 'email', destino: masked } })
}))

// GET /api/entrenador/validar-token/:token — valida magic link + crea sesión
router.get('/validar-token/:token', asyncHandler(async (req, res) => {
  const { token } = req.params
  const entrenador = await req.db.entrenador.findFirst({
    where: { tokenPortal: token },
    select: { id: true, nombre: true, apellido: true, email: true, activo: true, tokenPortalExpira: true, fotoStaff: true },
  })
  if (!entrenador) throw new AppError('Token inválido o expirado', 401, 'INVALID_TOKEN')
  if (entrenador.tokenPortalExpira && entrenador.tokenPortalExpira < new Date()) {
    throw new AppError('El link expiró. Solicitá uno nuevo.', 401, 'EXPIRED_TOKEN')
  }
  if (!entrenador.activo) throw new AppError('Entrenador inactivo', 403, 'INACTIVO')

  // Crear sesión persistente
  const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || null
  const userAgent = req.headers['user-agent'] || null
  const { token: sessionToken, expiresAt } = await crearSesion(req.db, {
    entrenadorId: entrenador.id, tenantId: req.tenantId, ip, userAgent,
  })
  setSesionCookie(res, sessionToken, expiresAt)

  res.json({
    success: true,
    data: {
      id: entrenador.id, nombre: entrenador.nombre, apellido: entrenador.apellido,
      email: entrenador.email, fotoStaff: entrenador.fotoStaff,
    },
  })
}))

// GET /api/entrenador/sesion/check
router.get('/sesion/check', asyncHandler(async (req, res) => {
  const cookieToken = req.cookies?.[SESSION_COOKIE]
  if (!cookieToken) return res.json({ success: true, data: { autenticado: false } })
  const sesion = await validarSesion(req.db, cookieToken)
  if (!sesion) {
    clearSesionCookie(res)
    return res.json({ success: true, data: { autenticado: false } })
  }
  const entrenador = await req.db.entrenador.findUnique({
    where: { id: sesion.entrenadorId },
    select: { id: true, nombre: true, apellido: true, activo: true },
  })
  if (!entrenador?.activo) {
    clearSesionCookie(res)
    return res.json({ success: true, data: { autenticado: false } })
  }
  return res.json({ success: true, data: { autenticado: true, entrenador } })
}))

// POST /api/entrenador/sesion/cerrar
router.post('/sesion/cerrar', asyncHandler(async (req, res) => {
  const cookieToken = req.cookies?.[SESSION_COOKIE]
  if (cookieToken) await revocarSesion(req.db, cookieToken)
  clearSesionCookie(res)
  res.json({ success: true })
}))

// ════════════════════════════════════════════════════════════════════════════
// PROTECTED — todo lo siguiente requiere authEntrenador
// ════════════════════════════════════════════════════════════════════════════

router.use(authEntrenador)

// GET /api/entrenador/me — datos del entrenador
router.get('/me', asyncHandler(async (req, res) => {
  const e = await req.db.entrenador.findUnique({
    where: { id: req.entrenador.id },
    select: {
      id: true, nombre: true, apellido: true, email: true, telefono: true,
      documento: true, especialidad: true, fotoStaff: true,
    },
  })
  res.json({ success: true, data: e })
}))

// GET /api/entrenador/mis-categorias — categorías activas del entrenador con contador de inscriptos
router.get('/mis-categorias', asyncHandler(async (req, res) => {
  const ahora = new Date()
  const rels = await req.db.entrenadorCategoria.findMany({
    where: {
      entrenadorId: req.entrenador.id,
      fechaDesde: { lte: ahora },
      OR: [{ fechaHasta: null }, { fechaHasta: { gt: ahora } }],
    },
    include: {
      categoriaActividad: {
        include: {
          actividad: { select: { id: true, nombre: true, color: true } },
          _count: { select: { inscripciones: { where: { estado: 'ACTIVA' } } } },
        },
      },
    },
  })
  const categorias = rels.map(r => ({
    id: r.categoriaActividad.id,
    nombre: r.categoriaActividad.nombre,
    actividad: r.categoriaActividad.actividad?.nombre || '',
    actividadId: r.categoriaActividad.actividad?.id,
    color: r.categoriaActividad.actividad?.color,
    rol: r.rol,
    cantInscriptos: r.categoriaActividad._count?.inscripciones || 0,
    edadMinima: r.categoriaActividad.edadMinima,
    edadMaxima: r.categoriaActividad.edadMaxima,
    sexo: r.categoriaActividad.sexo,
  }))
  res.json({ success: true, data: categorias })
}))

// Helper: chequea permiso o tira 403
async function ensureCategoria(req, categoriaId) {
  const ok = await tienePermisoCategoria(req.db, req.entrenador.id, categoriaId)
  if (!ok) throw new AppError('No tenés permiso sobre esta categoría', 403, 'FORBIDDEN')
}

// GET /api/entrenador/categorias/:id/plantel — socios inscriptos activos
router.get('/categorias/:id/plantel', asyncHandler(async (req, res) => {
  await ensureCategoria(req, req.params.id)
  const inscripciones = await req.db.inscripcion.findMany({
    where: { categoriaActividadId: parseInt(req.params.id), estado: 'ACTIVA' },
    include: {
      socio: {
        select: {
          id: true, nroSocio: true, apellidoNombre: true, email: true, celular: true,
          fechaNacimiento: true, fotoUrl: true, aptaFisicaVigente: true, aptaFisicaVence: true,
          esMenor: true, emergenciaNombre1: true, emergenciaTel1: true,
        },
      },
    },
    orderBy: { socio: { apellidoNombre: 'asc' } },
  })
  const items = inscripciones.map(i => {
    let edad = null
    if (i.socio.fechaNacimiento) {
      const diff = Date.now() - new Date(i.socio.fechaNacimiento).getTime()
      edad = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))
    }
    return { ...i.socio, edad, inscripcionId: i.id, fechaInicio: i.fechaInicio }
  })
  res.json({ success: true, data: items })
}))

// ── Entrenamientos ─────────────────────────────────────────────────────────

// GET /api/entrenador/categorias/:id/entrenamientos?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
router.get('/categorias/:id/entrenamientos', asyncHandler(async (req, res) => {
  await ensureCategoria(req, req.params.id)
  const where = { categoriaActividadId: parseInt(req.params.id) }
  if (req.query.desde || req.query.hasta) {
    where.fecha = {}
    if (req.query.desde) where.fecha.gte = new Date(req.query.desde)
    if (req.query.hasta) where.fecha.lte = new Date(req.query.hasta + 'T23:59:59')
  } else {
    // Por default últimos 30 días + próximos 30
    const desde = new Date(); desde.setDate(desde.getDate() - 30)
    const hasta = new Date(); hasta.setDate(hasta.getDate() + 30)
    where.fecha = { gte: desde, lte: hasta }
  }
  const items = await req.db.entrenamiento.findMany({
    where,
    include: {
      espacio: { select: { nombre: true } },
      _count: { select: { asistencias: true } },
    },
    orderBy: { fecha: 'desc' },
  })
  res.json({ success: true, data: items })
}))

// POST /api/entrenador/categorias/:id/entrenamientos — crear entrenamiento extra
router.post('/categorias/:id/entrenamientos', asyncHandler(async (req, res) => {
  await ensureCategoria(req, req.params.id)
  const { fecha, horaInicio, horaFin, tipo = 'EXTRA', observaciones, espacioId } = req.body
  if (!fecha || !horaInicio || !horaFin) {
    throw new AppError('fecha, horaInicio y horaFin son requeridos', 400, 'VALIDATION_ERROR')
  }
  const entrenamiento = await req.db.entrenamiento.create({
    data: {
      tenantId: req.tenantId,
      categoriaActividadId: parseInt(req.params.id),
      fecha: new Date(fecha),
      horaInicio, horaFin, tipo,
      observaciones: observaciones || null,
      estado: 'PROGRAMADO',
      espacioId: espacioId ? parseInt(espacioId) : null,
      registradoPor: req.entrenador.id,
    },
  })

  // Notificar a socios inscriptos (async, no bloquea respuesta)
  ;(async () => {
    try {
      const { notificarNuevoEntrenamiento } = await import('../services/notificacionService.js')
      if (typeof notificarNuevoEntrenamiento === 'function') {
        await notificarNuevoEntrenamiento(entrenamiento.id)
      }
    } catch (err) {
      console.error('[entrenador] Error notificando nuevo entrenamiento:', err.message)
    }
  })()

  res.status(201).json({ success: true, data: entrenamiento })
}))

// PATCH /api/entrenador/entrenamientos/:id — modificar/cancelar entrenamiento
router.patch('/entrenamientos/:id', asyncHandler(async (req, res) => {
  const ent = await req.db.entrenamiento.findUnique({
    where: { id: parseInt(req.params.id) },
    select: { id: true, categoriaActividadId: true, estado: true, tenantId: true },
  })
  if (!ent || ent.tenantId !== req.tenantId) throw new AppError('Entrenamiento no encontrado', 404, 'NOT_FOUND')
  await ensureCategoria(req, ent.categoriaActividadId)

  const { estado, motivoCancelacion, fecha, horaInicio, horaFin, observaciones, espacioId } = req.body
  const data = {}
  if (fecha) data.fecha = new Date(fecha)
  if (horaInicio) data.horaInicio = horaInicio
  if (horaFin) data.horaFin = horaFin
  if (observaciones !== undefined) data.observaciones = observaciones || null
  if (espacioId !== undefined) data.espacioId = espacioId ? parseInt(espacioId) : null
  if (estado) {
    data.estado = estado
    if (estado === 'CANCELADO') data.motivoCancelacion = motivoCancelacion || 'Cancelado por entrenador'
  }
  const actualizado = await req.db.entrenamiento.update({
    where: { id: ent.id }, data,
  })

  // Si se canceló: notificar
  if (estado === 'CANCELADO' && ent.estado !== 'CANCELADO') {
    ;(async () => {
      try {
        const { notificarCancelacionEntrenamiento } = await import('../services/notificacionService.js')
        if (typeof notificarCancelacionEntrenamiento === 'function') {
          await notificarCancelacionEntrenamiento(actualizado.id, req.db)
        }
      } catch (err) {
        console.error('[entrenador] Error notificando cancelación:', err.message)
      }
    })()
  }

  res.json({ success: true, data: actualizado })
}))

// ── Asistencia ─────────────────────────────────────────────────────────────

// GET /api/entrenador/entrenamientos/:id/asistencia
router.get('/entrenamientos/:id/asistencia', asyncHandler(async (req, res) => {
  const ent = await req.db.entrenamiento.findUnique({
    where: { id: parseInt(req.params.id) },
    select: { id: true, categoriaActividadId: true, fecha: true, tenantId: true },
  })
  if (!ent || ent.tenantId !== req.tenantId) throw new AppError('Entrenamiento no encontrado', 404, 'NOT_FOUND')
  await ensureCategoria(req, ent.categoriaActividadId)

  const [asistencias, plantel] = await Promise.all([
    req.db.asistencia.findMany({
      where: { entrenamientoId: ent.id },
      include: { socio: { select: { id: true, apellidoNombre: true, fotoUrl: true } } },
    }),
    req.db.inscripcion.findMany({
      where: { categoriaActividadId: ent.categoriaActividadId, estado: 'ACTIVA' },
      include: { socio: { select: { id: true, apellidoNombre: true, fotoUrl: true } } },
      orderBy: { socio: { apellidoNombre: 'asc' } },
    }),
  ])
  const asistenciaPorSocio = new Map(asistencias.map(a => [a.socioId, a]))
  const items = plantel.map(i => ({
    socioId: i.socio.id,
    apellidoNombre: i.socio.apellidoNombre,
    fotoUrl: i.socio.fotoUrl,
    estado: asistenciaPorSocio.get(i.socio.id)?.estado || null,
    horaLlegada: asistenciaPorSocio.get(i.socio.id)?.horaLlegada || null,
    observaciones: asistenciaPorSocio.get(i.socio.id)?.observaciones || null,
    asistenciaId: asistenciaPorSocio.get(i.socio.id)?.id || null,
  }))
  res.json({ success: true, data: { entrenamiento: ent, items } })
}))

// POST /api/entrenador/entrenamientos/:id/asistencia — bulk upsert
// body: { items: [{ socioId, estado, horaLlegada?, observaciones? }] }
router.post('/entrenamientos/:id/asistencia', asyncHandler(async (req, res) => {
  const ent = await req.db.entrenamiento.findUnique({
    where: { id: parseInt(req.params.id) },
    select: { id: true, categoriaActividadId: true, tenantId: true },
  })
  if (!ent || ent.tenantId !== req.tenantId) throw new AppError('Entrenamiento no encontrado', 404, 'NOT_FOUND')
  await ensureCategoria(req, ent.categoriaActividadId)

  const items = Array.isArray(req.body.items) ? req.body.items : []
  if (items.length === 0) return res.json({ success: true, data: { count: 0 } })

  let count = 0
  for (const it of items) {
    if (!it.socioId || !it.estado) continue
    await req.db.asistencia.upsert({
      where: { entrenamientoId_socioId: { entrenamientoId: ent.id, socioId: parseInt(it.socioId) } },
      create: {
        tenantId: req.tenantId,
        entrenamientoId: ent.id,
        socioId: parseInt(it.socioId),
        estado: it.estado,
        horaLlegada: it.horaLlegada || null,
        observaciones: it.observaciones || null,
        registradoPor: req.entrenador.id,
      },
      update: {
        estado: it.estado,
        horaLlegada: it.horaLlegada || null,
        observaciones: it.observaciones || null,
      },
    })
    count++
  }
  res.json({ success: true, data: { count } })
}))

// ════════════════════════════════════════════════════════════════════════════
// BLOQUE 2: Convocatorias / Partidos
// ════════════════════════════════════════════════════════════════════════════

// GET /api/entrenador/categorias/:id/partidos
router.get('/categorias/:id/partidos', asyncHandler(async (req, res) => {
  await ensureCategoria(req, req.params.id)
  const desde = new Date(); desde.setDate(desde.getDate() - 30)
  const partidos = await req.db.partido.findMany({
    where: {
      categoriaActividadId: parseInt(req.params.id),
      fecha: { gte: desde },
    },
    include: {
      espacio: { select: { nombre: true } },
      campeonato: { select: { nombre: true } },
      _count: { select: { convocados: true } },
    },
    orderBy: { fecha: 'desc' },
  })
  res.json({ success: true, data: partidos })
}))

// POST /api/entrenador/partidos — crear partido
router.post('/partidos', asyncHandler(async (req, res) => {
  const { categoriaActividadId, fecha, hora, tipo = 'AMISTOSO', condicion, rival, ubicacion, espacioId, campeonatoId, observaciones } = req.body
  if (!categoriaActividadId || !fecha || !hora || !condicion || !rival) {
    throw new AppError('Faltan campos obligatorios', 400, 'VALIDATION_ERROR')
  }
  await ensureCategoria(req, categoriaActividadId)
  const partido = await req.db.partido.create({
    data: {
      tenantId: req.tenantId,
      categoriaActividadId: parseInt(categoriaActividadId),
      fecha: new Date(fecha),
      hora, tipo, condicion, rival,
      ubicacion: ubicacion || null,
      espacioId: espacioId ? parseInt(espacioId) : null,
      campeonatoId: campeonatoId ? parseInt(campeonatoId) : null,
      observaciones: observaciones || null,
      registradoPor: req.entrenador.id,
    },
  })
  res.status(201).json({ success: true, data: partido })
}))

// GET /api/entrenador/partidos/:id/convocatorias
router.get('/partidos/:id/convocatorias', asyncHandler(async (req, res) => {
  const partido = await req.db.partido.findUnique({
    where: { id: parseInt(req.params.id) },
    select: { id: true, categoriaActividadId: true, tenantId: true, fecha: true, hora: true, rival: true, condicion: true },
  })
  if (!partido || partido.tenantId !== req.tenantId) throw new AppError('Partido no encontrado', 404, 'NOT_FOUND')
  await ensureCategoria(req, partido.categoriaActividadId)

  const convocatorias = await req.db.convocatoria.findMany({
    where: { partidoId: partido.id },
    include: { socio: { select: { id: true, apellidoNombre: true, fotoUrl: true } } },
    orderBy: { socio: { apellidoNombre: 'asc' } },
  })
  res.json({ success: true, data: { partido, convocatorias } })
}))

// POST /api/entrenador/partidos/:id/convocatorias — bulk convocar (reemplaza convocados)
// body: { socioIds: [int] }
router.post('/partidos/:id/convocatorias', asyncHandler(async (req, res) => {
  const partido = await req.db.partido.findUnique({
    where: { id: parseInt(req.params.id) },
    select: { id: true, categoriaActividadId: true, tenantId: true },
  })
  if (!partido || partido.tenantId !== req.tenantId) throw new AppError('Partido no encontrado', 404, 'NOT_FOUND')
  await ensureCategoria(req, partido.categoriaActividadId)

  const socioIds = Array.isArray(req.body.socioIds) ? req.body.socioIds.map(Number).filter(Boolean) : []

  // Borrar convocados que ya no están + agregar nuevos
  const actuales = await req.db.convocatoria.findMany({
    where: { partidoId: partido.id }, select: { id: true, socioId: true },
  })
  const actualesIds = new Set(actuales.map(a => a.socioId))
  const aBorrar = actuales.filter(a => !socioIds.includes(a.socioId)).map(a => a.id)
  const aCrear = socioIds.filter(sid => !actualesIds.has(sid))

  if (aBorrar.length > 0) {
    await req.db.convocatoria.deleteMany({ where: { id: { in: aBorrar } } })
  }
  for (const sid of aCrear) {
    await req.db.convocatoria.create({
      data: { tenantId: req.tenantId, partidoId: partido.id, socioId: sid },
    })
  }

  // Disparar notificaciones a los nuevos convocados (async)
  if (aCrear.length > 0) {
    ;(async () => {
      try {
        const { notificarConvocatoriaPartido } = await import('../services/notificacionService.js')
        if (typeof notificarConvocatoriaPartido === 'function') {
          for (const sid of aCrear) {
            await notificarConvocatoriaPartido(partido.id, sid).catch(() => {})
          }
        }
      } catch (err) {
        console.error('[entrenador] Error notificando convocatorias:', err.message)
      }
    })()
  }

  res.json({ success: true, data: { creadas: aCrear.length, eliminadas: aBorrar.length } })
}))

// ════════════════════════════════════════════════════════════════════════════
// BLOQUE 3: Chat con socios
// ════════════════════════════════════════════════════════════════════════════

// GET /api/entrenador/conversaciones — conversaciones del entrenador
router.get('/conversaciones', asyncHandler(async (req, res) => {
  const conversaciones = await req.db.conversacion.findMany({
    where: { entrenadorId: req.entrenador.id, estado: 'ACTIVA' },
    include: {
      socio: { select: { id: true, apellidoNombre: true, fotoUrl: true } },
      categoriaActividad: { select: { nombre: true, actividad: { select: { nombre: true } } } },
    },
    orderBy: { ultimoMensaje: 'desc' },
  })
  res.json({ success: true, data: conversaciones })
}))

// GET /api/entrenador/conversaciones/:id/mensajes
router.get('/conversaciones/:id/mensajes', asyncHandler(async (req, res) => {
  const conv = await req.db.conversacion.findUnique({
    where: { id: parseInt(req.params.id) },
    select: { id: true, entrenadorId: true, socioId: true, tenantId: true },
  })
  if (!conv || conv.tenantId !== req.tenantId || conv.entrenadorId !== req.entrenador.id) {
    throw new AppError('Conversación no encontrada', 404, 'NOT_FOUND')
  }
  const mensajes = await req.db.mensaje.findMany({
    where: { conversacionId: conv.id },
    orderBy: { createdAt: 'asc' },
    take: 200,
  })
  // Marcar como leídos los mensajes recibidos
  await req.db.mensaje.updateMany({
    where: {
      conversacionId: conv.id,
      emisorTipo: 'SOCIO',
      leido: false,
    },
    data: { leido: true, fechaLeido: new Date() },
  })
  res.json({ success: true, data: mensajes })
}))

// POST /api/entrenador/conversaciones/:id/mensajes — enviar mensaje
router.post('/conversaciones/:id/mensajes', asyncHandler(async (req, res) => {
  const { contenido } = req.body
  if (!contenido?.trim()) throw new AppError('Mensaje vacío', 400, 'VALIDATION_ERROR')
  const conv = await req.db.conversacion.findUnique({
    where: { id: parseInt(req.params.id) },
    select: { id: true, entrenadorId: true, tenantId: true },
  })
  if (!conv || conv.tenantId !== req.tenantId || conv.entrenadorId !== req.entrenador.id) {
    throw new AppError('Conversación no encontrada', 404, 'NOT_FOUND')
  }
  const mensaje = await req.db.mensaje.create({
    data: {
      tenantId: req.tenantId,
      conversacionId: conv.id,
      emisorTipo: 'ENTRENADOR',
      emisorId: req.entrenador.id,
      contenido: contenido.trim(),
    },
  })
  await req.db.conversacion.update({
    where: { id: conv.id },
    data: { ultimoMensaje: new Date(), mensajesNoLeidos: { increment: 1 } },
  })
  res.status(201).json({ success: true, data: mensaje })
}))

// POST /api/entrenador/conversaciones — iniciar conversación con un socio
router.post('/conversaciones', asyncHandler(async (req, res) => {
  const { socioId, categoriaActividadId, asunto, contenido } = req.body
  if (!socioId || !contenido?.trim()) {
    throw new AppError('socioId y contenido son requeridos', 400, 'VALIDATION_ERROR')
  }
  if (categoriaActividadId) await ensureCategoria(req, categoriaActividadId)

  // Buscar conversación existente o crear
  let conv = await req.db.conversacion.findFirst({
    where: {
      socioId: parseInt(socioId),
      entrenadorId: req.entrenador.id,
      categoriaActividadId: categoriaActividadId ? parseInt(categoriaActividadId) : null,
    },
    select: { id: true },
  })
  if (!conv) {
    conv = await req.db.conversacion.create({
      data: {
        tenantId: req.tenantId,
        socioId: parseInt(socioId),
        entrenadorId: req.entrenador.id,
        categoriaActividadId: categoriaActividadId ? parseInt(categoriaActividadId) : null,
        asunto: asunto || null,
        ultimoMensaje: new Date(),
      },
      select: { id: true },
    })
  }
  await req.db.mensaje.create({
    data: {
      tenantId: req.tenantId,
      conversacionId: conv.id,
      emisorTipo: 'ENTRENADOR',
      emisorId: req.entrenador.id,
      contenido: contenido.trim(),
    },
  })
  await req.db.conversacion.update({
    where: { id: conv.id },
    data: { ultimoMensaje: new Date(), estado: 'ACTIVA' },
  })
  res.status(201).json({ success: true, data: { conversacionId: conv.id } })
}))

export default router
