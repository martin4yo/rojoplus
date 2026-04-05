import { Router } from 'express'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { authAdmin } from '../middleware/auth.js'
import { crearPreferenciaPago } from '../services/mercadopago.js'
import { v4 as uuidv4 } from 'uuid'
import {
  enviarConfirmacionReserva,
  enviarCancelacionReserva,
} from '../services/email.js'
import { crearReembolso } from '../services/mercadopago.js'

const router = Router()

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Genera el próximo código de reserva: RSV-YYYY-NNNNNN
 */
async function generarCodigoReserva(db, tenantId) {
  const year = new Date().getFullYear()
  const ultima = await db.reservaEspacio.findFirst({
    where: { tenantId, codigo: { startsWith: `RSV-${year}-` } },
    orderBy: { id: 'desc' },
  })
  const siguiente = ultima
    ? parseInt(ultima.codigo.split('-')[2]) + 1
    : 1
  return `RSV-${year}-${String(siguiente).padStart(6, '0')}`
}

/**
 * Obtiene la config de reserva para un espacio (cae a global si no hay específica).
 */
async function getConfig(db, tenantId, espacioId) {
  const especifica = await db.configReservaEspacio.findFirst({
    where: { tenantId, espacioId, activo: true },
  })
  if (especifica) return especifica
  return db.configReservaEspacio.findFirst({
    where: { tenantId, espacioId: null, activo: true },
  })
}

/**
 * Calcula el precio para un reservante dado su condición de socio.
 */
function calcularPrecio(config, esSocio) {
  if (!config) return { precio: 0, descuento: 0 }

  if (config.modoPrecio === 'FIJO') {
    const precioNoSocio = parseFloat(config.precioNoSocio || 0)
    const precioSocio = parseFloat(config.precioSocio || precioNoSocio)
    const precio = esSocio ? precioSocio : precioNoSocio
    const descuento = esSocio ? precioNoSocio - precioSocio : 0
    return { precio, descuento: Math.max(0, descuento) }
  }

  // DESCUENTO_PORCENTAJE
  const precioBase = parseFloat(config.precioBase || 0)
  const porc = esSocio ? (config.descuentoSocioPorc || 0) : 0
  const descuento = precioBase * (porc / 100)
  return { precio: precioBase - descuento, descuento }
}

/**
 * Genera slots para un día dado un espacio, marcando cuáles están disponibles.
 * Tiene en cuenta: HorarioDisponibilidad, ReservaEspacio (confirmadas/pendiente pago),
 * Entrenamiento, Partido, Evento y BloqueEspacio.
 */
async function calcularSlots(db, tenantId, espacioId, fecha) {
  const config = await getConfig(db, tenantId, espacioId)
  if (!config) return []

  const duracion = config.duracionSlotMin
  const cupos = config.cuposSimultaneos

  // Día de la semana (0=domingo … 6=sábado)
  const diaSemana = new Date(fecha + 'T12:00:00').getDay()

  // Buscar la franja horaria para este día
  let franjas = []
  try { franjas = JSON.parse(config.horariosConfig || '[]') } catch { franjas = [] }
  const franja = franjas.find(f => f.dias?.includes(diaSemana))
  if (!franja) return []

  // Generar todos los slots del día usando la franja correspondiente
  const slots = []
  let [hh, mm] = (franja.horaInicio || '08:00').split(':').map(Number)
  const [hhFin, mmFin] = (franja.horaFin || '22:00').split(':').map(Number)
  const minutosInicio = hh * 60 + mm
  const minutosFin = hhFin * 60 + mmFin

  for (let inicio = minutosInicio; inicio + duracion <= minutosFin; inicio += duracion) {
    const fin = inicio + duracion
    slots.push({
      horaInicio: `${String(Math.floor(inicio / 60)).padStart(2, '0')}:${String(inicio % 60).padStart(2, '0')}`,
      horaFin: `${String(Math.floor(fin / 60)).padStart(2, '0')}:${String(fin % 60).padStart(2, '0')}`,
      cuposTotal: cupos,
      cuposOcupados: 0,
      disponible: true,
      bloqueado: false,
      motivoBloqueo: null,
    })
  }

  const fechaDate = new Date(fecha)
  const fechaStr = fechaDate.toISOString().split('T')[0]

  // Reservas confirmadas / pendientes de pago
  const reservas = await db.reservaEspacio.findMany({
    where: {
      tenantId,
      espacioId,
      fecha: { gte: new Date(fechaStr), lt: new Date(new Date(fechaStr).getTime() + 86400000) },
      estado: { in: ['CONFIRMADA', 'PENDIENTE_PAGO'] },
    },
    select: { horaInicio: true, horaFin: true },
  })

  // Entrenamientos programados
  const entrenamientos = await db.entrenamiento.findMany({
    where: {
      tenantId,
      espacioId,
      fecha: { gte: new Date(fechaStr), lt: new Date(new Date(fechaStr).getTime() + 86400000) },
      estado: 'PROGRAMADO',
    },
    select: { horaInicio: true, horaFin: true },
  })

  // Partidos programados
  const partidos = await db.partido.findMany({
    where: {
      tenantId,
      espacioId,
      fecha: { gte: new Date(fechaStr), lt: new Date(new Date(fechaStr).getTime() + 86400000) },
      estado: { in: ['PROGRAMADO', 'EN_CURSO'] },
    },
    select: { hora: true },
  })

  // Eventos del espacio
  const eventos = await db.evento.findMany({
    where: {
      tenantId,
      espacioId,
      fecha: { gte: new Date(fechaStr), lt: new Date(new Date(fechaStr).getTime() + 86400000) },
      estado: { in: ['PROGRAMADO', 'EN_CURSO'] },
    },
    select: { hora: true, horaFin: true },
  })

  // Bloqueos manuales
  const bloqueos = await db.bloqueEspacio.findMany({
    where: {
      tenantId,
      espacioId,
      fecha: { gte: new Date(fechaStr), lt: new Date(new Date(fechaStr).getTime() + 86400000) },
    },
    select: { horaInicio: true, horaFin: true, motivo: true },
  })

  // Helper: minutos desde medianoche
  const toMin = (h) => {
    const [hh, mm] = h.split(':').map(Number)
    return hh * 60 + mm
  }

  // Helper: ¿dos rangos se solapan?
  const solapan = (a1, a2, b1, b2) => a1 < b2 && b1 < a2

  for (const slot of slots) {
    const sI = toMin(slot.horaInicio)
    const sF = toMin(slot.horaFin)

    // Bloqueos manuales
    for (const b of bloqueos) {
      if (solapan(sI, sF, toMin(b.horaInicio), toMin(b.horaFin))) {
        slot.bloqueado = true
        slot.disponible = false
        slot.motivoBloqueo = b.motivo || 'Bloqueado'
      }
    }
    if (slot.bloqueado) continue

    // Usos institucionales (entrenamientos, partidos, eventos) bloquean completamente
    const usoInstitucional = [
      ...entrenamientos.map((e) => ({ i: toMin(e.horaInicio), f: toMin(e.horaFin), motivo: 'Entrenamiento' })),
      ...partidos.map((p) => ({ i: toMin(p.hora), f: toMin(p.hora) + 120, motivo: 'Partido' })),
      ...eventos.map((e) => ({ i: toMin(e.hora), f: toMin(e.horaFin || e.hora) + 120, motivo: 'Evento' })),
    ]

    for (const uso of usoInstitucional) {
      if (solapan(sI, sF, uso.i, uso.f)) {
        slot.bloqueado = true
        slot.disponible = false
        slot.motivoBloqueo = uso.motivo
        break
      }
    }
    if (slot.bloqueado) continue

    // Contar cupos ocupados por reservas
    for (const r of reservas) {
      if (solapan(sI, sF, toMin(r.horaInicio), toMin(r.horaFin))) {
        slot.cuposOcupados++
      }
    }
    slot.disponible = slot.cuposOcupados < slot.cuposTotal
  }

  return slots
}

// ─── Disponibilidad (pública) ────────────────────────────────────────────────

/**
 * GET /api/reservas/disponibilidad?espacioId=1&fecha=2026-04-10
 * Retorna slots del día con disponibilidad y precios.
 * Ruta pública — no requiere auth.
 */
router.get('/disponibilidad', asyncHandler(async (req, res) => {
  const { espacioId, fecha } = req.query
  if (!espacioId || !fecha) throw new AppError('espacioId y fecha son requeridos', 400)

  const db = req.db
  const tenantId = req.tenantId

  const espacio = await db.espacioDeportivo.findFirst({
    where: { id: parseInt(espacioId), tenantId, activo: true },
    select: { id: true, nombre: true, tipo: true },
  })
  if (!espacio) throw new AppError('Espacio no encontrado', 404)

  const config = await getConfig(db, tenantId, parseInt(espacioId))
  const slots = await calcularSlots(db, tenantId, parseInt(espacioId), fecha)

  const precioPorSlot = config ? calcularPrecio(config, false) : null

  res.json({
    espacio,
    fecha,
    config: config ? {
      duracionSlotMin: config.duracionSlotMin,
      cuposSimultaneos: config.cuposSimultaneos,
      horaInicio: config.horaInicio,
      horaFin: config.horaFin,
      diasHabilitados: config.diasHabilitados,
      modoPrecio: config.modoPrecio,
      precioSocio: config.precioSocio,
      precioNoSocio: config.precioNoSocio,
      precioBase: config.precioBase,
      descuentoSocioPorc: config.descuentoSocioPorc,
      politicaCancelacionHs: config.politicaCancelacionHs,
      permiteCancelacionOnline: config.permiteCancelacionOnline,
    } : null,
    precioPublico: precioPorSlot?.precio ?? 0,
    slots,
  })
}))

/**
 * GET /api/reservas/espacios
 * Lista los espacios con su config de reserva activa (para que el público elija).
 */
router.get('/espacios', asyncHandler(async (req, res) => {
  const db = req.db
  const tenantId = req.tenantId

  const [espacios, configGlobal] = await Promise.all([
    db.espacioDeportivo.findMany({
      where: { tenantId, activo: true },
      include: {
        tipoEspacio: { select: { nombre: true } },
        configReserva: { where: { tenantId, activo: true }, take: 1 },
      },
      orderBy: { nombre: 'asc' },
    }),
    db.configReservaEspacio.findFirst({
      where: { tenantId, espacioId: null, activo: true },
    }),
  ])

  const resultado = espacios
    .map((e) => ({
      id: e.id,
      nombre: e.nombre,
      tipo: e.tipoEspacio?.nombre || e.tipo,
      descripcion: e.descripcion,
      cubierto: e.cubierto,
      iluminacion: e.iluminacion,
      config: e.configReserva[0] || configGlobal || null,
    }))
    .filter((e) => e.config !== null) // solo espacios con config activa

  res.json(resultado)
}))

// ─── Crear reserva ───────────────────────────────────────────────────────────

/**
 * POST /api/reservas
 * Crea una reserva. Funciona para socio (token), público (sin token) y admin.
 * Body: { espacioId, fecha, horaInicio, esSocio, nombre, apellido, email, telefono, dni,
 *         metodoPago, observaciones, recurrente?, semanas?, socioToken? }
 */
router.post('/', asyncHandler(async (req, res) => {
  const {
    espacioId, fecha, horaInicio,
    esSocio = false, socioId: socioIdParam,
    nombre, apellido, email, telefono, dni,
    metodoPago = 'MERCADOPAGO',
    observaciones,
    esRecurrente = false, semanas = 1,
  } = req.body

  if (!espacioId || !fecha || !horaInicio || !nombre || !apellido || !email) {
    throw new AppError('Faltan campos obligatorios', 400)
  }

  const db = req.db
  const tenantId = req.tenantId

  // Config y validación
  const config = await getConfig(db, tenantId, parseInt(espacioId))
  if (!config) throw new AppError('El espacio no tiene configuración de reservas', 400)

  // Verificar anticipación mínima
  const ahora = new Date()
  const fechaReserva = new Date(`${fecha}T${horaInicio}:00`)
  const diffHs = (fechaReserva - ahora) / 3600000
  if (diffHs < config.anticipacionMinHs) {
    throw new AppError(`Debe reservarse con al menos ${config.anticipacionMinHs}hs de anticipación`, 400)
  }

  const diffDias = (fechaReserva - ahora) / 86400000
  if (diffDias > config.anticipacionMaxDias) {
    throw new AppError(`Solo se puede reservar hasta ${config.anticipacionMaxDias} días de anticipación`, 400)
  }

  // Verificar disponibilidad del slot en la fecha solicitada
  const slots = await calcularSlots(db, tenantId, parseInt(espacioId), fecha)
  const slotElegido = slots.find((s) => s.horaInicio === horaInicio)
  if (!slotElegido) throw new AppError('El slot solicitado no existe para ese día', 400)
  if (!slotElegido.disponible) throw new AppError('El slot no está disponible', 409)

  const { precio, descuento } = calcularPrecio(config, esSocio)

  // Armar las fechas a reservar (recurrencia semanal)
  const fechasAReservar = []
  const grupoRecurrenciaId = esRecurrente && semanas > 1 ? uuidv4() : null
  const fechaBase = new Date(fecha)

  for (let i = 0; i < (esRecurrente ? semanas : 1); i++) {
    const fechaIter = new Date(fechaBase)
    fechaIter.setDate(fechaBase.getDate() + i * 7)
    const fechaIterStr = fechaIter.toISOString().split('T')[0]

    if (i > 0) {
      // Verificar disponibilidad de cada fecha futura también
      const slotsIter = await calcularSlots(db, tenantId, parseInt(espacioId), fechaIterStr)
      const slotIter = slotsIter.find((s) => s.horaInicio === horaInicio)
      if (!slotIter?.disponible) {
        throw new AppError(`El slot del ${fechaIterStr} no está disponible`, 409)
      }
    }
    fechasAReservar.push(fechaIterStr)
  }

  // Crear todas las reservas en una transacción
  const reservasCreadas = await db.$transaction(async (tx) => {
    const creadas = []
    for (const fechaItem of fechasAReservar) {
      const codigo = await generarCodigoReserva(tx, tenantId)
      const token = uuidv4()

      const reserva = await tx.reservaEspacio.create({
        data: {
          codigo,
          espacioId: parseInt(espacioId),
          fecha: new Date(fechaItem),
          horaInicio,
          horaFin: slotElegido.horaFin,
          duracionMin: config.duracionSlotMin,
          socioId: socioIdParam ? parseInt(socioIdParam) : null,
          nombreReserva: nombre,
          apellido,
          email,
          telefono,
          dni,
          esSocio,
          precioTotal: precio,
          descuentoAplicado: descuento,
          metodoPago,
          estado: metodoPago === 'EFECTIVO' || metodoPago === 'CORTESIA' ? 'CONFIRMADA' : 'PENDIENTE_PAGO',
          esRecurrente: esRecurrente && semanas > 1,
          grupoRecurrenciaId,
          observaciones,
          tokenCancelacion: token,
          creadaPorAdmin: false,
          tenantId,
        },
      })
      creadas.push(reserva)
    }
    return creadas
  })

  const reservaPrincipal = reservasCreadas[0]

  // Si el método es MercadoPago, crear preferencia de pago
  if (metodoPago === 'MERCADOPAGO' && precio > 0) {
    const espacio = await db.espacioDeportivo.findUnique({ where: { id: parseInt(espacioId) } })
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

    const preferencia = await crearPreferenciaPago({
      title: `Reserva ${espacio.nombre} - ${fecha} ${horaInicio}`,
      description: esRecurrente && semanas > 1 ? `${semanas} semanas (recurrente)` : `Turno ${horaInicio}-${slotElegido.horaFin}`,
      amount: precio * reservasCreadas.length,
      externalReference: JSON.stringify({ tipo: 'RESERVA', reservaId: reservaPrincipal.id }),
      payer: { email, name: `${nombre} ${apellido}` },
      notificationUrl: `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/pagos/webhook/mercadopago`,
      successUrl: `${baseUrl}/reservas/confirmacion?reserva=${reservaPrincipal.codigo}&status=success`,
      failureUrl: `${baseUrl}/reservas/confirmacion?reserva=${reservaPrincipal.codigo}&status=failure`,
      pendingUrl: `${baseUrl}/reservas/confirmacion?reserva=${reservaPrincipal.codigo}&status=pending`,
    })

    // Guardar preferenceId en la reserva principal
    await db.reservaEspacio.update({
      where: { id: reservaPrincipal.id },
      data: { linkPagoId: null }, // se actualizará en el webhook
    })

    return res.status(201).json({
      reservas: reservasCreadas,
      pago: {
        initPoint: preferencia.init_point,
        sandboxInitPoint: preferencia.sandbox_init_point,
        externalReference: `RESERVA-${reservaPrincipal.id}`,
      },
    })
  }

  // Enviar confirmación por email (EFECTIVO/CORTESIA se confirman al instante)
  if (email && reservaPrincipal.estado === 'CONFIRMADA') {
    const espacio = await db.espacioDeportivo.findUnique({ where: { id: parseInt(espacioId) }, select: { nombre: true } })
    enviarConfirmacionReserva({ ...reservaPrincipal, espacio }, db).catch(() => {})
  }

  res.status(201).json({ reservas: reservasCreadas, pago: null })
}))

// ─── Portal socio ────────────────────────────────────────────────────────────

/**
 * GET /api/reservas/socio/:token
 * Mis reservas (portal socio).
 */
router.get('/socio/:token', asyncHandler(async (req, res) => {
  const db = req.db
  const tenantId = req.tenantId

  const socio = await db.socio.findFirst({
    where: { tokenPortal: req.params.token, tenantId },
    select: { id: true },
  })
  if (!socio) throw new AppError('Token inválido', 401)

  const { estado, futuras } = req.query
  const where = { tenantId, socioId: socio.id }
  if (estado) where.estado = estado
  if (futuras === 'true') where.fecha = { gte: new Date() }

  const reservas = await db.reservaEspacio.findMany({
    where,
    include: { espacio: { select: { nombre: true, tipo: true } } },
    orderBy: { fecha: 'asc' },
  })

  res.json(reservas)
}))

/**
 * POST /api/reservas/socio/:token
 * Crear reserva desde portal socio (pre-completa datos del socio).
 */
router.post('/socio/:token', asyncHandler(async (req, res) => {
  const db = req.db
  const tenantId = req.tenantId

  const socio = await db.socio.findFirst({
    where: { tokenPortal: req.params.token, tenantId },
  })
  if (!socio) throw new AppError('Token inválido', 401)

  // Inyectar datos del socio en el body y redirigir a la lógica principal
  req.body.esSocio = true
  req.body.socioId = socio.id
  req.body.nombre = req.body.nombre || socio.nombre
  req.body.apellido = req.body.apellido || socio.apellido
  req.body.email = req.body.email || socio.email
  req.body.telefono = req.body.telefono || socio.celular
  req.body.dni = req.body.dni || socio.dni

  // Llamar el handler principal reutilizando el router interno
  // (simplemente delegamos al POST /)
  const mockReq = Object.assign({}, req, { url: '/', path: '/' })

  // Re-ejecutar lógica de creación inline
  const {
    espacioId, fecha, horaInicio, metodoPago = 'MERCADOPAGO',
    observaciones, esRecurrente = false, semanas = 1,
  } = req.body

  if (!espacioId || !fecha || !horaInicio) {
    throw new AppError('Faltan campos obligatorios', 400)
  }

  const config = await getConfig(db, tenantId, parseInt(espacioId))
  if (!config) throw new AppError('El espacio no tiene configuración de reservas', 400)

  const ahora = new Date()
  const fechaReserva = new Date(`${fecha}T${horaInicio}:00`)
  const diffHs = (fechaReserva - ahora) / 3600000
  if (diffHs < config.anticipacionMinHs) {
    throw new AppError(`Debe reservarse con al menos ${config.anticipacionMinHs}hs de anticipación`, 400)
  }

  const slots = await calcularSlots(db, tenantId, parseInt(espacioId), fecha)
  const slotElegido = slots.find((s) => s.horaInicio === horaInicio)
  if (!slotElegido) throw new AppError('El slot solicitado no existe para ese día', 400)
  if (!slotElegido.disponible) throw new AppError('El slot no está disponible', 409)

  const { precio, descuento } = calcularPrecio(config, true)

  const grupoRecurrenciaId = esRecurrente && semanas > 1 ? uuidv4() : null
  const fechaBase = new Date(fecha)
  const fechasAReservar = []

  for (let i = 0; i < (esRecurrente ? semanas : 1); i++) {
    const fechaIter = new Date(fechaBase)
    fechaIter.setDate(fechaBase.getDate() + i * 7)
    fechasAReservar.push(fechaIter.toISOString().split('T')[0])
  }

  const reservasCreadas = await db.$transaction(async (tx) => {
    const creadas = []
    for (const fechaItem of fechasAReservar) {
      const codigo = await generarCodigoReserva(tx, tenantId)
      const reserva = await tx.reservaEspacio.create({
        data: {
          codigo,
          espacioId: parseInt(espacioId),
          fecha: new Date(fechaItem),
          horaInicio,
          horaFin: slotElegido.horaFin,
          duracionMin: config.duracionSlotMin,
          socioId: socio.id,
          nombreReserva: socio.nombre,
          apellido: socio.apellido,
          email: socio.email,
          telefono: socio.celular,
          dni: socio.dni,
          esSocio: true,
          precioTotal: precio,
          descuentoAplicado: descuento,
          metodoPago,
          estado: metodoPago === 'EFECTIVO' || metodoPago === 'CORTESIA' ? 'CONFIRMADA' : 'PENDIENTE_PAGO',
          esRecurrente: esRecurrente && semanas > 1,
          grupoRecurrenciaId,
          observaciones,
          tokenCancelacion: uuidv4(),
          creadaPorAdmin: false,
          tenantId,
        },
      })
      creadas.push(reserva)
    }
    return creadas
  })

  const reservaPrincipal = reservasCreadas[0]

  if (metodoPago === 'MERCADOPAGO' && precio > 0) {
    const espacio = await db.espacioDeportivo.findUnique({ where: { id: parseInt(espacioId) } })
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

    const preferencia = await crearPreferenciaPago({
      title: `Reserva ${espacio.nombre} - ${fecha} ${horaInicio}`,
      description: `Turno ${horaInicio}-${slotElegido.horaFin}`,
      amount: precio * reservasCreadas.length,
      externalReference: JSON.stringify({ tipo: 'RESERVA', reservaId: reservaPrincipal.id }),
      payer: { email: socio.email, name: `${socio.nombre} ${socio.apellido}` },
      notificationUrl: `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/pagos/webhook/mercadopago`,
      successUrl: `${baseUrl}/s/${req.params.token}/reservas?status=success&reserva=${reservaPrincipal.codigo}`,
      failureUrl: `${baseUrl}/s/${req.params.token}/reservas?status=failure&reserva=${reservaPrincipal.codigo}`,
      pendingUrl: `${baseUrl}/s/${req.params.token}/reservas?status=pending&reserva=${reservaPrincipal.codigo}`,
    })

    return res.status(201).json({
      reservas: reservasCreadas,
      pago: { initPoint: preferencia.init_point, sandboxInitPoint: preferencia.sandbox_init_point },
    })
  }

  // Email de confirmación para reservas no-MP
  if (reservaPrincipal.email && reservaPrincipal.estado === 'CONFIRMADA') {
    const espacio = await db.espacioDeportivo.findUnique({ where: { id: parseInt(espacioId) }, select: { nombre: true } })
    enviarConfirmacionReserva({ ...reservaPrincipal, espacio }, db).catch(() => {})
  }

  res.status(201).json({ reservas: reservasCreadas, pago: null })
}))

/**
 * DELETE /api/reservas/socio/:token/:codigo
 * Cancelar reserva desde portal socio.
 */
router.delete('/socio/:token/:codigo', asyncHandler(async (req, res) => {
  const db = req.db
  const tenantId = req.tenantId

  const socio = await db.socio.findFirst({
    where: { tokenPortal: req.params.token, tenantId },
    select: { id: true },
  })
  if (!socio) throw new AppError('Token inválido', 401)

  const { cancelarGrupo = false } = req.body

  const reserva = await db.reservaEspacio.findFirst({
    where: { codigo: req.params.codigo, tenantId, socioId: socio.id },
  })
  if (!reserva) throw new AppError('Reserva no encontrada', 404)
  if (reserva.estado === 'CANCELADA') throw new AppError('La reserva ya está cancelada', 400)

  // Validar política de cancelación
  const config = await getConfig(db, tenantId, reserva.espacioId)
  if (config && !config.permiteCancelacionOnline) {
    throw new AppError('La cancelación online no está habilitada para este espacio', 400)
  }

  const ahora = new Date()
  const fechaReserva = new Date(`${reserva.fecha.toISOString().split('T')[0]}T${reserva.horaInicio}:00`)
  const diffHs = (fechaReserva - ahora) / 3600000
  const politicaHs = config?.politicaCancelacionHs ?? 24

  if (diffHs < politicaHs) {
    throw new AppError(`No se puede cancelar con menos de ${politicaHs}hs de anticipación`, 400)
  }

  // Determinar qué reservas cancelar
  let where = { id: reserva.id }
  if (cancelarGrupo && reserva.grupoRecurrenciaId) {
    where = {
      tenantId,
      grupoRecurrenciaId: reserva.grupoRecurrenciaId,
      fecha: { gte: new Date() },
      estado: { in: ['CONFIRMADA', 'PENDIENTE_PAGO'] },
    }
  }

  const reservasACancelar = await db.reservaEspacio.findMany({ where })

  // Reembolso MP si aplica
  let reembolsado = false
  if (reserva.metodoPago === 'MERCADOPAGO' && reserva.paymentIdMP) {
    try {
      await crearReembolso(reserva.paymentIdMP)
      reembolsado = true
    } catch (err) {
      console.error(`[Cancelación socio] Error reembolso MP reserva ${reserva.codigo}:`, err.message)
    }
  }

  await db.reservaEspacio.updateMany({
    where,
    data: {
      estado: 'CANCELADA',
      canceladoPor: 'SOCIO',
      fechaCancelacion: new Date(),
      motivoCancelacion: req.body.motivo || 'Cancelado por el socio',
      reembolsado,
    },
  })

  // Enviar email de cancelación
  if (reserva.email) {
    const reservaConEspacio = await db.reservaEspacio.findUnique({
      where: { id: reserva.id },
      include: { espacio: { select: { nombre: true } } },
    })
    enviarCancelacionReserva(reservaConEspacio, req.body.motivo, db).catch(() => {})
  }

  res.json({
    mensaje: 'Reserva(s) cancelada(s) correctamente',
    canceladas: reservasACancelar.length,
  })
}))

// ─── Cancelación pública por token de email ──────────────────────────────────

/**
 * POST /api/reservas/cancelar-token
 * Cancelación desde link de email para usuarios no socios.
 */
router.post('/cancelar-token', asyncHandler(async (req, res) => {
  const { tokenCancelacion, motivo } = req.body
  if (!tokenCancelacion) throw new AppError('Token requerido', 400)

  const db = req.db
  const tenantId = req.tenantId

  const reserva = await db.reservaEspacio.findFirst({
    where: { tokenCancelacion, tenantId },
  })
  if (!reserva) throw new AppError('Token de cancelación inválido', 404)
  if (reserva.estado === 'CANCELADA') throw new AppError('La reserva ya está cancelada', 400)

  const config = await getConfig(db, tenantId, reserva.espacioId)
  if (config && !config.permiteCancelacionOnline) {
    throw new AppError('La cancelación online no está habilitada', 400)
  }

  const ahora = new Date()
  const fechaReserva = new Date(`${reserva.fecha.toISOString().split('T')[0]}T${reserva.horaInicio}:00`)
  const diffHs = (fechaReserva - ahora) / 3600000
  const politicaHs = config?.politicaCancelacionHs ?? 24

  if (diffHs < politicaHs) {
    throw new AppError(`No se puede cancelar con menos de ${politicaHs}hs de anticipación`, 400)
  }

  // Reembolso MP si aplica
  let reembolsado = false
  if (reserva.metodoPago === 'MERCADOPAGO' && reserva.paymentIdMP) {
    try {
      await crearReembolso(reserva.paymentIdMP)
      reembolsado = true
    } catch (err) {
      console.error(`[Cancelación token] Error reembolso MP reserva ${reserva.codigo}:`, err.message)
    }
  }

  await db.reservaEspacio.update({
    where: { id: reserva.id },
    data: {
      estado: 'CANCELADA',
      canceladoPor: 'SOCIO',
      fechaCancelacion: new Date(),
      motivoCancelacion: motivo || 'Cancelado por el titular',
      reembolsado,
    },
  })

  // Enviar email de cancelación
  if (reserva.email) {
    const reservaConEspacio = await db.reservaEspacio.findUnique({
      where: { id: reserva.id },
      include: { espacio: { select: { nombre: true } } },
    })
    enviarCancelacionReserva({ ...reservaConEspacio, reembolsado }, motivo, db).catch(() => {})
  }

  res.json({ mensaje: 'Reserva cancelada correctamente', codigo: reserva.codigo })
}))

// ─── Admin ───────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/reservas
 * Lista de reservas con filtros para el admin.
 */
router.get('/admin', authAdmin, asyncHandler(async (req, res) => {
  const db = req.db
  const tenantId = req.tenantId
  const {
    espacioId, estado, fechaDesde, fechaHasta,
    socioId, search, page = 1, limit = 50,
  } = req.query

  const where = { tenantId }
  if (espacioId) where.espacioId = parseInt(espacioId)
  if (estado) where.estado = estado
  if (socioId) where.socioId = parseInt(socioId)
  if (fechaDesde || fechaHasta) {
    where.fecha = {}
    if (fechaDesde) where.fecha.gte = new Date(fechaDesde)
    if (fechaHasta) where.fecha.lte = new Date(fechaHasta)
  }
  if (search) {
    where.OR = [
      { codigo: { contains: search, mode: 'insensitive' } },
      { nombreReserva: { contains: search, mode: 'insensitive' } },
      { apellido: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [total, reservas] = await Promise.all([
    db.reservaEspacio.count({ where }),
    db.reservaEspacio.findMany({
      where,
      include: {
        espacio: { select: { nombre: true, tipo: true } },
        socio: { select: { nombre: true, apellido: true, nroSocio: true } },
      },
      orderBy: [{ fecha: 'desc' }, { horaInicio: 'asc' }],
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
    }),
  ])

  res.json({ total, page: parseInt(page), reservas })
}))

/**
 * GET /api/admin/reservas/calendario
 * Vista de calendario: todas las reservas de un rango de fechas, agrupadas por espacio.
 */
router.get('/admin/calendario', authAdmin, asyncHandler(async (req, res) => {
  const db = req.db
  const tenantId = req.tenantId
  const { fechaDesde, fechaHasta, espacioId } = req.query

  if (!fechaDesde || !fechaHasta) throw new AppError('fechaDesde y fechaHasta son requeridos', 400)

  const where = {
    tenantId,
    fecha: { gte: new Date(fechaDesde), lte: new Date(fechaHasta) },
    estado: { in: ['CONFIRMADA', 'PENDIENTE_PAGO'] },
  }
  if (espacioId) where.espacioId = parseInt(espacioId)

  const reservas = await db.reservaEspacio.findMany({
    where,
    include: {
      espacio: { select: { id: true, nombre: true } },
      socio: { select: { nombre: true, apellido: true, nroSocio: true } },
    },
    orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
  })

  // También traer bloqueos del período
  const bloqueos = await db.bloqueEspacio.findMany({
    where: {
      tenantId,
      fecha: { gte: new Date(fechaDesde), lte: new Date(fechaHasta) },
      ...(espacioId ? { espacioId: parseInt(espacioId) } : {}),
    },
    include: { espacio: { select: { id: true, nombre: true } } },
  })

  res.json({ reservas, bloqueos })
}))

// ─── Config por espacio (admin) ──────────────────────────────────────────────

/**
 * GET /api/admin/reservas/config
 * Lista configs (incluye global y por espacio).
 */
router.get('/admin/config', authAdmin, asyncHandler(async (req, res) => {
  const db = req.db
  const configs = await db.configReservaEspacio.findMany({
    where: { tenantId: req.tenantId },
    include: { espacio: { select: { nombre: true } } },
    orderBy: [{ espacioId: 'asc' }],
  })
  res.json(configs)
}))

/**
 * POST /api/admin/reservas/config
 * Crear config (global o por espacio).
 */
router.post('/admin/config', authAdmin, asyncHandler(async (req, res) => {
  const db = req.db
  const {
    espacioId, modoPrecio, precioBase, precioSocio, precioNoSocio,
    descuentoSocioPorc, duracionSlotMin, cuposSimultaneos,
    anticipacionMinHs, anticipacionMaxDias, politicaCancelacionHs,
    permiteCancelacionOnline, activo, horariosConfig,
  } = req.body
  const config = await db.configReservaEspacio.create({
    data: {
      tenantId: req.tenantId,
      modoPrecio, precioBase, precioSocio, precioNoSocio,
      descuentoSocioPorc, duracionSlotMin, cuposSimultaneos,
      anticipacionMinHs, anticipacionMaxDias, politicaCancelacionHs,
      permiteCancelacionOnline, activo,
      horariosConfig: typeof horariosConfig === 'string' ? horariosConfig : JSON.stringify(horariosConfig || []),
      ...(espacioId ? { espacio: { connect: { id: parseInt(espacioId) } } } : {}),
    },
  })
  res.status(201).json(config)
}))

/**
 * PUT /api/admin/reservas/config/:id
 * Actualizar config.
 */
router.put('/admin/config/:id', authAdmin, asyncHandler(async (req, res) => {
  const db = req.db
  const {
    espacioId, modoPrecio, precioBase, precioSocio, precioNoSocio,
    descuentoSocioPorc, duracionSlotMin, cuposSimultaneos,
    anticipacionMinHs, anticipacionMaxDias, politicaCancelacionHs,
    permiteCancelacionOnline, activo, horariosConfig,
  } = req.body
  const config = await db.configReservaEspacio.update({
    where: { id: parseInt(req.params.id) },
    data: {
      modoPrecio, precioBase, precioSocio, precioNoSocio,
      descuentoSocioPorc, duracionSlotMin, cuposSimultaneos,
      anticipacionMinHs, anticipacionMaxDias, politicaCancelacionHs,
      permiteCancelacionOnline, activo,
      horariosConfig: typeof horariosConfig === 'string' ? horariosConfig : JSON.stringify(horariosConfig || []),
      espacio: espacioId
        ? { connect: { id: parseInt(espacioId) } }
        : { disconnect: true },
    },
  })
  res.json(config)
}))

// ─── Bloqueos (admin) ────────────────────────────────────────────────────────

/**
 * GET /api/admin/reservas/bloqueos
 */
router.get('/admin/bloqueos', authAdmin, asyncHandler(async (req, res) => {
  const db = req.db
  const { espacioId, fechaDesde, fechaHasta } = req.query
  const where = { tenantId: req.tenantId }
  if (espacioId) where.espacioId = parseInt(espacioId)
  if (fechaDesde) where.fecha = { ...(where.fecha || {}), gte: new Date(fechaDesde) }
  if (fechaHasta) where.fecha = { ...(where.fecha || {}), lte: new Date(fechaHasta) }

  const bloqueos = await db.bloqueEspacio.findMany({
    where,
    include: { espacio: { select: { nombre: true } } },
    orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
  })
  res.json(bloqueos)
}))

/**
 * POST /api/admin/reservas/bloqueos
 */
router.post('/admin/bloqueos', authAdmin, asyncHandler(async (req, res) => {
  const db = req.db
  const { espacioId, fecha, horaInicio, horaFin, motivo } = req.body
  if (!espacioId || !fecha || !horaInicio || !horaFin) throw new AppError('Faltan campos', 400)

  const bloqueo = await db.bloqueEspacio.create({
    data: {
      espacioId: parseInt(espacioId),
      fecha: new Date(fecha),
      horaInicio,
      horaFin,
      motivo,
      tenantId: req.tenantId,
    },
  })
  res.status(201).json(bloqueo)
}))

/**
 * DELETE /api/admin/reservas/bloqueos/:id
 */
router.delete('/admin/bloqueos/:id', authAdmin, asyncHandler(async (req, res) => {
  const db = req.db
  await db.bloqueEspacio.delete({ where: { id: parseInt(req.params.id) } })
  res.json({ mensaje: 'Bloqueo eliminado' })
}))

// ─── Estadísticas (admin) ────────────────────────────────────────────────────

/**
 * GET /api/admin/reservas/estadisticas
 */
router.get('/admin/estadisticas', authAdmin, asyncHandler(async (req, res) => {
  const db = req.db
  const tenantId = req.tenantId
  const { fechaDesde, fechaHasta } = req.query

  const where = { tenantId }
  if (fechaDesde || fechaHasta) {
    where.fecha = {}
    if (fechaDesde) where.fecha.gte = new Date(fechaDesde)
    if (fechaHasta) where.fecha.lte = new Date(fechaHasta)
  }

  const [total, porEstado, porEspacio, ingresos] = await Promise.all([
    db.reservaEspacio.count({ where }),
    db.reservaEspacio.groupBy({
      by: ['estado'],
      where,
      _count: { id: true },
    }),
    db.reservaEspacio.groupBy({
      by: ['espacioId'],
      where: { ...where, estado: { in: ['CONFIRMADA', 'COMPLETADA'] } },
      _count: { id: true },
      _sum: { precioTotal: true },
    }),
    db.reservaEspacio.aggregate({
      where: { ...where, estado: { in: ['CONFIRMADA', 'COMPLETADA'] } },
      _sum: { precioTotal: true },
    }),
  ])

  const espaciosIds = porEspacio.map((p) => p.espacioId)
  const espacios = await db.espacioDeportivo.findMany({
    where: { id: { in: espaciosIds } },
    select: { id: true, nombre: true },
  })
  const espaciosMap = Object.fromEntries(espacios.map((e) => [e.id, e.nombre]))

  res.json({
    total,
    porEstado: Object.fromEntries(porEstado.map((e) => [e.estado, e._count.id])),
    porEspacio: porEspacio.map((e) => ({
      espacioId: e.espacioId,
      nombre: espaciosMap[e.espacioId] || `Espacio ${e.espacioId}`,
      cantidad: e._count.id,
      ingresos: e._sum.precioTotal || 0,
    })),
    ingresosTotal: ingresos._sum.precioTotal || 0,
  })
}))

/**
 * GET /api/admin/reservas/:id
 * Detalle de una reserva.
 */
router.get('/admin/:id', authAdmin, asyncHandler(async (req, res) => {
  const db = req.db
  const reserva = await db.reservaEspacio.findFirst({
    where: { id: parseInt(req.params.id), tenantId: req.tenantId },
    include: {
      espacio: true,
      socio: { select: { nombre: true, apellido: true, nroSocio: true, email: true, celular: true } },
    },
  })
  if (!reserva) throw new AppError('Reserva no encontrada', 404)
  res.json(reserva)
}))

/**
 * POST /api/admin/reservas
 * El admin crea una reserva manual (efectivo, cortesía, etc.).
 */
router.post('/admin', authAdmin, asyncHandler(async (req, res) => {
  const db = req.db
  const tenantId = req.tenantId
  const {
    espacioId, fecha, horaInicio,
    socioId, nombre, apellido, email, telefono, dni, esSocio = false,
    metodoPago = 'EFECTIVO', observaciones, esRecurrente = false, semanas = 1,
  } = req.body

  if (!espacioId || !fecha || !horaInicio || !nombre || !apellido || !email) {
    throw new AppError('Faltan campos obligatorios', 400)
  }

  const config = await getConfig(db, tenantId, parseInt(espacioId))
  const slots = await calcularSlots(db, tenantId, parseInt(espacioId), fecha)
  const slotElegido = slots.find((s) => s.horaInicio === horaInicio)
  if (!slotElegido) throw new AppError('Slot no existe para ese día', 400)
  if (!slotElegido.disponible) throw new AppError('Slot no disponible', 409)

  const { precio, descuento } = calcularPrecio(config, esSocio)
  const grupoRecurrenciaId = esRecurrente && semanas > 1 ? uuidv4() : null
  const fechaBase = new Date(fecha)
  const fechasAReservar = []

  for (let i = 0; i < (esRecurrente ? semanas : 1); i++) {
    const fi = new Date(fechaBase)
    fi.setDate(fechaBase.getDate() + i * 7)
    fechasAReservar.push(fi.toISOString().split('T')[0])
  }

  const reservasCreadas = await db.$transaction(async (tx) => {
    const creadas = []
    for (const fechaItem of fechasAReservar) {
      const codigo = await generarCodigoReserva(tx, tenantId)
      const reserva = await tx.reservaEspacio.create({
        data: {
          codigo,
          espacioId: parseInt(espacioId),
          fecha: new Date(fechaItem),
          horaInicio,
          horaFin: slotElegido.horaFin,
          duracionMin: config?.duracionSlotMin || 60,
          socioId: socioId ? parseInt(socioId) : null,
          nombreReserva: nombre,
          apellido,
          email,
          telefono,
          dni,
          esSocio,
          precioTotal: precio,
          descuentoAplicado: descuento,
          metodoPago,
          estado: 'CONFIRMADA',
          esRecurrente: esRecurrente && semanas > 1,
          grupoRecurrenciaId,
          observaciones,
          tokenCancelacion: uuidv4(),
          creadaPorAdmin: true,
          tenantId,
        },
      })
      creadas.push(reserva)
    }
    return creadas
  })

  const reservaPrincipal = reservasCreadas[0]
  if (email && reservaPrincipal) {
    const espacio = await db.espacioDeportivo.findUnique({ where: { id: parseInt(espacioId) }, select: { nombre: true } })
    enviarConfirmacionReserva({ ...reservaPrincipal, espacio }, db).catch(() => {})
  }

  res.status(201).json({ reservas: reservasCreadas })
}))

/**
 * PATCH /api/admin/reservas/:id/confirmar
 * Admin confirma una reserva pendiente de pago (ej: pago en mostrador).
 */
router.patch('/admin/:id/confirmar', authAdmin, asyncHandler(async (req, res) => {
  const db = req.db
  const reserva = await db.reservaEspacio.findFirst({
    where: { id: parseInt(req.params.id), tenantId: req.tenantId },
  })
  if (!reserva) throw new AppError('Reserva no encontrada', 404)
  if (reserva.estado !== 'PENDIENTE_PAGO') throw new AppError('La reserva no está pendiente de pago', 400)

  const updated = await db.reservaEspacio.update({
    where: { id: reserva.id },
    data: { estado: 'CONFIRMADA', metodoPago: req.body.metodoPago || reserva.metodoPago },
    include: { espacio: { select: { nombre: true } } },
  })

  if (updated.email) {
    enviarConfirmacionReserva(updated, db).catch(() => {})
  }

  res.json(updated)
}))

/**
 * PATCH /api/admin/reservas/:id/cancelar
 * Admin cancela una reserva.
 */
router.patch('/admin/:id/cancelar', authAdmin, asyncHandler(async (req, res) => {
  const db = req.db
  const tenantId = req.tenantId
  const { motivo, cancelarGrupo = false } = req.body

  const reserva = await db.reservaEspacio.findFirst({
    where: { id: parseInt(req.params.id), tenantId },
  })
  if (!reserva) throw new AppError('Reserva no encontrada', 404)
  if (reserva.estado === 'CANCELADA') throw new AppError('La reserva ya está cancelada', 400)

  let where = { id: reserva.id }
  if (cancelarGrupo && reserva.grupoRecurrenciaId) {
    where = {
      tenantId,
      grupoRecurrenciaId: reserva.grupoRecurrenciaId,
      fecha: { gte: new Date() },
      estado: { notIn: ['CANCELADA', 'COMPLETADA'] },
    }
  }

  // Reembolso MP si la reserva se pagó por ese medio
  let reembolsado = false
  if (reserva.metodoPago === 'MERCADOPAGO' && reserva.paymentIdMP) {
    try {
      await crearReembolso(reserva.paymentIdMP)
      reembolsado = true
    } catch (err) {
      console.error(`[Cancelación] Error reembolso MP reserva ${reserva.codigo}:`, err.message)
    }
  }

  await db.reservaEspacio.updateMany({
    where,
    data: {
      estado: 'CANCELADA',
      canceladoPor: 'ADMIN',
      fechaCancelacion: new Date(),
      motivoCancelacion: motivo || 'Cancelado por administrador',
      reembolsado,
    },
  })

  // Enviar email a la reserva principal
  if (reserva.email) {
    const reservaConEspacio = await db.reservaEspacio.findUnique({
      where: { id: reserva.id },
      include: { espacio: { select: { nombre: true } } },
    })
    enviarCancelacionReserva(reservaConEspacio, motivo, db).catch(() => {})
  }

  const canceladas = await db.reservaEspacio.count({ where })
  res.json({ mensaje: 'Reserva(s) cancelada(s)', canceladas })
}))

/**
 * PATCH /api/admin/reservas/:id/no-show
 * Marcar como no-show.
 */
router.patch('/admin/:id/no-show', authAdmin, asyncHandler(async (req, res) => {
  const db = req.db
  const reserva = await db.reservaEspacio.findFirst({
    where: { id: parseInt(req.params.id), tenantId: req.tenantId },
  })
  if (!reserva) throw new AppError('Reserva no encontrada', 404)
  if (reserva.estado !== 'CONFIRMADA') throw new AppError('Solo se pueden marcar como no-show reservas confirmadas', 400)

  const updated = await db.reservaEspacio.update({
    where: { id: reserva.id },
    data: { estado: 'NO_SHOW' },
  })
  res.json(updated)
}))

export default router
