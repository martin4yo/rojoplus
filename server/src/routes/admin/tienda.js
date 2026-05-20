/**
 * Administración del módulo Tienda Online.
 *
 * Mount: /api/admin/tienda
 *
 * Pedidos:
 *   GET    /tienda/pedidos                    - lista paginada + filtros
 *   GET    /tienda/pedidos/kanban             - agrupado por estado para vista Kanban
 *   GET    /tienda/pedidos/:id                - detalle
 *   POST   /tienda/pedidos/:id/cambiar-estado - { nuevoEstadoId, nota }
 *   POST   /tienda/pedidos/:id/cancelar       - libera stock (si presencial-pago, también)
 *   POST   /tienda/pedidos/:id/notas          - agregar nota admin
 *
 * Estados configurables:
 *   GET    /tienda/estados                    - lista estados + transiciones
 *   POST   /tienda/estados                    - crear estado
 *   PUT    /tienda/estados/:id                - editar
 *   DELETE /tienda/estados/:id                - borrar (no si tiene pedidos)
 *   POST   /tienda/estados/transiciones       - { desdeId, hastaId }
 *   DELETE /tienda/estados/transiciones/:id   - borrar transición
 *
 * Productos publicables:
 *   GET    /tienda/productos                  - lista
 *   PUT    /tienda/productos/:id              - { publicarEnTienda, destacadoTienda, precioOfertaTienda, descripcionTienda }
 *
 * Configuración:
 *   GET    /tienda/configuracion              - parámetros TIENDA
 *   PUT    /tienda/configuracion              - actualizar parámetros
 */
import { Router } from 'express'
import { asyncHandler, AppError } from '../../middleware/errorHandler.js'
import { authAdmin } from '../../middleware/auth.js'
import { PEDIDO_TIENDA_INCLUDE, leerParametrosTienda } from '../tienda/helpers.js'
import { enviarCambioEstadoTienda } from '../../services/email.js'

const router = Router()

// ===========================================================================
// PEDIDOS
// ===========================================================================

router.get('/tienda/pedidos', authAdmin, asyncHandler(async (req, res) => {
  const {
    estadoId, paymentStatus, q, page = '1', perPage = '50', desde, hasta,
  } = req.query

  const where = {}
  if (estadoId) where.estadoId = parseInt(estadoId)
  if (paymentStatus) where.paymentStatus = String(paymentStatus)
  if (q) {
    where.OR = [
      { numero: { contains: q, mode: 'insensitive' } },
      { compradorNombre: { contains: q, mode: 'insensitive' } },
      { compradorEmail: { contains: q, mode: 'insensitive' } },
    ]
  }
  if (desde || hasta) {
    where.createdAt = {}
    if (desde) where.createdAt.gte = new Date(desde)
    if (hasta) where.createdAt.lte = new Date(hasta)
  }

  const take = Math.min(parseInt(perPage) || 50, 200)
  const skip = (parseInt(page) || 1 - 1) * take

  const [items, total] = await Promise.all([
    req.db.pedidoTienda.findMany({
      where,
      include: PEDIDO_TIENDA_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    req.db.pedidoTienda.count({ where }),
  ])

  res.json({ success: true, data: { items, total, page: parseInt(page), perPage: take } })
}))

router.get('/tienda/pedidos/kanban', authAdmin, asyncHandler(async (req, res) => {
  // Devuelve: { estados: [...], pedidosPorEstado: { [estadoId]: [pedido,...] } }
  const estados = await req.db.estadoPedidoTienda.findMany({
    where: { activo: true },
    orderBy: { ordenKanban: 'asc' },
  })

  const estadosNoFinales = estados.filter(e => !e.isFinal).map(e => e.id)
  const estadosFinales = estados.filter(e => e.isFinal).map(e => e.id)

  // Pedidos abiertos (en estados no-finales) últimos 90 días
  // + pedidos finales de los últimos 14 días
  const haceNoventa = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const haceCatorce = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

  const pedidos = await req.db.pedidoTienda.findMany({
    where: {
      OR: [
        { estadoId: { in: estadosNoFinales }, createdAt: { gte: haceNoventa } },
        { estadoId: { in: estadosFinales }, createdAt: { gte: haceCatorce } },
      ],
    },
    include: {
      estado: true,
      items: {
        select: { id: true, cantidad: true, snapshotNombre: true, snapshotTalle: true, snapshotImagen: true },
      },
      socio: { select: { id: true, nroSocio: true, apellidoNombre: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })

  const pedidosPorEstado = {}
  for (const e of estados) pedidosPorEstado[e.id] = []
  for (const p of pedidos) {
    if (pedidosPorEstado[p.estadoId]) pedidosPorEstado[p.estadoId].push(p)
  }

  res.json({ success: true, data: { estados, pedidosPorEstado } })
}))

router.get('/tienda/pedidos/:id', authAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id)
  const pedido = await req.db.pedidoTienda.findUnique({
    where: { id },
    include: PEDIDO_TIENDA_INCLUDE,
  })
  if (!pedido) throw new AppError('Pedido no encontrado', 404)
  res.json({ success: true, data: pedido })
}))

router.post('/tienda/pedidos/:id/cambiar-estado', authAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id)
  const { nuevoEstadoId, nota } = req.body || {}
  if (!nuevoEstadoId) throw new AppError('nuevoEstadoId requerido', 400)

  const pedido = await req.db.pedidoTienda.findUnique({
    where: { id },
    include: { estado: true },
  })
  if (!pedido) throw new AppError('Pedido no encontrado', 404)

  if (pedido.estadoId === nuevoEstadoId) {
    return res.json({ success: true, data: pedido }) // no-op
  }

  // Validar transición permitida
  const transicion = await req.db.transicionEstadoTienda.findUnique({
    where: {
      tenantId_desdeId_hastaId: {
        tenantId: req.tenantId, desdeId: pedido.estadoId, hastaId: nuevoEstadoId,
      },
    },
  })
  if (!transicion) {
    throw new AppError('Transición no permitida desde el estado actual', 400, 'TRANSITION_FORBIDDEN')
  }

  const nuevoEstado = await req.db.estadoPedidoTienda.findUnique({ where: { id: nuevoEstadoId } })
  if (!nuevoEstado) throw new AppError('Estado destino no existe', 404)

  await req.db.pedidoTienda.update({
    where: { id },
    data: {
      estadoId: nuevoEstadoId,
      historial: {
        create: {
          estadoId: nuevoEstadoId,
          registradoPor: req.admin?.id || null,
          nota: nota || null,
          tenantId: req.tenantId,
        },
      },
    },
  })

  // Si pasa a estado final no-permite-facturar (CANCELADO) → liberar reservas y MovimientoStock no se descuenta
  if (nuevoEstado.isFinal && !nuevoEstado.permiteFacturar) {
    await req.db.reservaStock.updateMany({
      where: { pedidoTiendaId: id, estado: { in: ['ACTIVA', 'CONFIRMADA'] } },
      data: { estado: 'CANCELADA', liberadoEn: new Date() },
    })
  }

  // Notificar al comprador si el estado tiene notificaCliente=true
  if (nuevoEstado.notificaCliente) {
    try {
      await enviarCambioEstadoTienda({
        pedidoTienda: pedido,
        estadoNuevo: nuevoEstado,
        tenantId: req.tenantId,
        db: req.db,
        mensajePersonalizado: nota || null,
      })
    } catch (err) {
      console.error('[Tienda Admin] Error enviando email cambio estado:', err.message)
    }
  }

  const actualizado = await req.db.pedidoTienda.findUnique({
    where: { id },
    include: PEDIDO_TIENDA_INCLUDE,
  })
  res.json({ success: true, data: actualizado })
}))

router.post('/tienda/pedidos/:id/cancelar', authAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id)
  const { nota } = req.body || {}

  const pedido = await req.db.pedidoTienda.findUnique({
    where: { id },
    include: { estado: true },
  })
  if (!pedido) throw new AppError('Pedido no encontrado', 404)

  // Regla del negocio: si paymentStatus=paid y paymentMethod=MP → no se puede cancelar desde acá
  // (requiere reembolso en MP que es un flujo distinto). Sólo PRESENCIAL puede cancelarse.
  if (pedido.paymentStatus === 'paid' && pedido.paymentMethod === 'MP') {
    throw new AppError('Este pedido fue pagado por Mercado Pago — debe cancelarse vía reembolso desde MP', 400, 'CANNOT_CANCEL_MP_PAID')
  }

  const cancelado = await req.db.estadoPedidoTienda.findUnique({
    where: { tenantId_codigo: { tenantId: req.tenantId, codigo: 'CANCELADO' } },
  })
  if (!cancelado) throw new AppError('Estado CANCELADO no configurado', 500)

  await req.db.$transaction(async (tx) => {
    await tx.reservaStock.updateMany({
      where: { pedidoTiendaId: id, estado: { in: ['ACTIVA', 'CONFIRMADA'] } },
      data: { estado: 'CANCELADA', liberadoEn: new Date() },
    })
    await tx.pedidoTienda.update({
      where: { id },
      data: {
        estadoId: cancelado.id,
        paymentStatus: pedido.paymentStatus === 'pending' ? 'cancelled' : pedido.paymentStatus,
        historial: {
          create: {
            estadoId: cancelado.id,
            registradoPor: req.admin?.id || null,
            nota: nota || 'Cancelado desde admin',
            tenantId: req.tenantId,
          },
        },
      },
    })
  })

  const actualizado = await req.db.pedidoTienda.findUnique({
    where: { id },
    include: PEDIDO_TIENDA_INCLUDE,
  })
  res.json({ success: true, data: actualizado })
}))

router.post('/tienda/pedidos/:id/notas', authAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id)
  const { notasAdmin } = req.body || {}
  await req.db.pedidoTienda.update({
    where: { id },
    data: { notasAdmin: notasAdmin || null },
  })
  res.json({ success: true })
}))

// ===========================================================================
// ESTADOS CONFIGURABLES
// ===========================================================================

router.get('/tienda/estados', authAdmin, asyncHandler(async (req, res) => {
  const [estados, transiciones] = await Promise.all([
    req.db.estadoPedidoTienda.findMany({ orderBy: { ordenKanban: 'asc' } }),
    req.db.transicionEstadoTienda.findMany(),
  ])
  res.json({ success: true, data: { estados, transiciones } })
}))

router.post('/tienda/estados', authAdmin, asyncHandler(async (req, res) => {
  const data = req.body || {}
  if (!data.codigo || !data.nombre) throw new AppError('codigo y nombre requeridos', 400)

  // Garantizar único isInitial por tenant
  if (data.isInitial) {
    await req.db.estadoPedidoTienda.updateMany({ where: { isInitial: true }, data: { isInitial: false } })
  }

  const estado = await req.db.estadoPedidoTienda.create({
    data: {
      codigo: data.codigo,
      nombre: data.nombre,
      color: data.color || '#6B7280',
      isInitial: !!data.isInitial,
      isFinal: !!data.isFinal,
      permiteFacturar: !!data.permiteFacturar,
      autoFacturar: !!data.autoFacturar,
      notificaCliente: data.notificaCliente !== false,
      ordenKanban: data.ordenKanban || 0,
      activo: data.activo !== false,
      tenantId: req.tenantId,
    },
  })
  res.status(201).json({ success: true, data: estado })
}))

router.put('/tienda/estados/:id', authAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id)
  const data = req.body || {}

  if (data.isInitial) {
    await req.db.estadoPedidoTienda.updateMany({
      where: { isInitial: true, NOT: { id } },
      data: { isInitial: false },
    })
  }

  const estado = await req.db.estadoPedidoTienda.update({
    where: { id },
    data: {
      ...(data.nombre !== undefined && { nombre: data.nombre }),
      ...(data.color !== undefined && { color: data.color }),
      ...(data.isInitial !== undefined && { isInitial: !!data.isInitial }),
      ...(data.isFinal !== undefined && { isFinal: !!data.isFinal }),
      ...(data.permiteFacturar !== undefined && { permiteFacturar: !!data.permiteFacturar }),
      ...(data.autoFacturar !== undefined && { autoFacturar: !!data.autoFacturar }),
      ...(data.notificaCliente !== undefined && { notificaCliente: !!data.notificaCliente }),
      ...(data.ordenKanban !== undefined && { ordenKanban: data.ordenKanban }),
      ...(data.activo !== undefined && { activo: !!data.activo }),
    },
  })
  res.json({ success: true, data: estado })
}))

router.delete('/tienda/estados/:id', authAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id)
  const usados = await req.db.pedidoTienda.count({ where: { estadoId: id } })
  if (usados > 0) {
    throw new AppError(`No se puede borrar: hay ${usados} pedidos con este estado`, 409)
  }
  await req.db.estadoPedidoTienda.delete({ where: { id } })
  res.json({ success: true })
}))

router.post('/tienda/estados/transiciones', authAdmin, asyncHandler(async (req, res) => {
  const { desdeId, hastaId } = req.body || {}
  if (!desdeId || !hastaId) throw new AppError('desdeId y hastaId requeridos', 400)
  const t = await req.db.transicionEstadoTienda.create({
    data: { desdeId: parseInt(desdeId), hastaId: parseInt(hastaId), tenantId: req.tenantId },
  })
  res.status(201).json({ success: true, data: t })
}))

router.delete('/tienda/estados/transiciones/:id', authAdmin, asyncHandler(async (req, res) => {
  await req.db.transicionEstadoTienda.delete({ where: { id: parseInt(req.params.id) } })
  res.json({ success: true })
}))

// ===========================================================================
// PRODUCTOS PUBLICABLES
// ===========================================================================

router.get('/tienda/productos', authAdmin, asyncHandler(async (req, res) => {
  const { q, soloPublicados, soloOfertas } = req.query
  const where = { activo: true }
  if (q) {
    where.OR = [
      { nombre: { contains: q, mode: 'insensitive' } },
      { codigo: { contains: q, mode: 'insensitive' } },
    ]
  }
  if (soloPublicados === 'true') where.publicarEnTienda = true
  if (soloOfertas === 'true') where.precioOfertaTienda = { not: null }

  const productos = await req.db.producto.findMany({
    where,
    include: {
      categoria: { select: { id: true, nombre: true } },
      fotos: { take: 1, orderBy: [{ esPrincipal: 'desc' }, { orden: 'asc' }] },
      _count: { select: { variantes: true } },
    },
    orderBy: [{ destacadoTienda: 'desc' }, { nombre: 'asc' }],
  })
  res.json({ success: true, data: productos })
}))

router.put('/tienda/productos/:id', authAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id)
  const { publicarEnTienda, destacadoTienda, precioOfertaTienda, descripcionTienda } = req.body || {}

  const data = {}
  if (publicarEnTienda !== undefined) data.publicarEnTienda = !!publicarEnTienda
  if (destacadoTienda !== undefined) data.destacadoTienda = !!destacadoTienda
  if (precioOfertaTienda !== undefined) {
    data.precioOfertaTienda = precioOfertaTienda === null || precioOfertaTienda === ''
      ? null
      : Number(precioOfertaTienda)
  }
  if (descripcionTienda !== undefined) data.descripcionTienda = descripcionTienda || null

  const producto = await req.db.producto.update({ where: { id }, data })
  res.json({ success: true, data: producto })
}))

// ===========================================================================
// CONFIGURACIÓN
// ===========================================================================

router.get('/tienda/configuracion', authAdmin, asyncHandler(async (req, res) => {
  const params = await leerParametrosTienda(req.db)
  // Devolver también raw para edición desde UI
  const raw = await req.db.configuracion.findMany({
    where: { modulo: 'TIENDA' },
    orderBy: { clave: 'asc' },
  })
  res.json({ success: true, data: { params, raw } })
}))

router.put('/tienda/configuracion', authAdmin, asyncHandler(async (req, res) => {
  const updates = req.body || {}
  // updates es { CLAVE: 'valor', ... }
  for (const [clave, valor] of Object.entries(updates)) {
    if (!clave.startsWith('TIENDA_')) continue
    await req.db.configuracion.upsert({
      where: { tenantId_clave: { tenantId: req.tenantId, clave } },
      update: { valor: String(valor ?? '') },
      create: { clave, valor: String(valor ?? ''), modulo: 'TIENDA', tenantId: req.tenantId },
    })
  }
  const params = await leerParametrosTienda(req.db)
  res.json({ success: true, data: params })
}))

// ===========================================================================
// CONFIGURACIÓN GLOBAL DE MERCADO PAGO (no es de tienda — es del tenant)
// ===========================================================================

router.get('/pagos/mercadopago', authAdmin, asyncHandler(async (req, res) => {
  const params = await req.db.configuracion.findMany({
    where: { modulo: 'PAGOS' },
    select: { clave: true, valor: true },
  })
  const map = Object.fromEntries(params.map(p => [p.clave, p.valor]))
  const accessToken = map.MP_ACCESS_TOKEN || ''
  const publicKey = map.MP_PUBLIC_KEY || ''
  const modoTest = map.MP_MODO_TEST === 'true' || (accessToken.startsWith('TEST-'))
  const cajaDefaultId = map.MP_CAJA_DEFAULT_ID ? parseInt(map.MP_CAJA_DEFAULT_ID) : null

  // No exponemos el token completo, solo prefijo + últimos chars
  const tokenMasked = accessToken
    ? `${accessToken.slice(0, 8)}…${accessToken.slice(-4)}`
    : ''

  // Listar cajas activas con MP configurado (para el selector)
  const cajas = await req.db.caja.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' },
    select: { id: true, codigo: true, nombre: true, tipo: true, mpStoreId: true, mpPosId: true },
  })

  res.json({
    success: true,
    data: {
      configurado: !!accessToken,
      modoTest,
      tokenMasked,
      tokenPrefijo: accessToken ? accessToken.split('-')[0] : '', // 'TEST' o 'APP_USR'
      publicKey, // public key se puede mostrar entera (no es secreto)
      tieneFallbackEnv: !!process.env.MERCADOPAGO_ACCESS_TOKEN,
      cajaDefaultId,
      cajas,
    },
  })
}))

router.put('/pagos/mercadopago', authAdmin, asyncHandler(async (req, res) => {
  const { accessToken, publicKey, modoTest } = req.body || {}

  // accessToken: si viene string vacío → borrar; si viene null/undefined → no tocar; sino → guardar
  if (accessToken !== undefined) {
    const valor = String(accessToken || '').trim()
    if (valor && !valor.startsWith('TEST-') && !valor.startsWith('APP_USR-')) {
      throw new AppError('El access token debe empezar con TEST- o APP_USR-', 400)
    }
    await req.db.configuracion.upsert({
      where: { tenantId_clave: { tenantId: req.tenantId, clave: 'MP_ACCESS_TOKEN' } },
      update: { valor },
      create: { clave: 'MP_ACCESS_TOKEN', valor, modulo: 'PAGOS', tenantId: req.tenantId },
    })
  }

  if (publicKey !== undefined) {
    await req.db.configuracion.upsert({
      where: { tenantId_clave: { tenantId: req.tenantId, clave: 'MP_PUBLIC_KEY' } },
      update: { valor: String(publicKey || '').trim() },
      create: { clave: 'MP_PUBLIC_KEY', valor: String(publicKey || '').trim(), modulo: 'PAGOS', tenantId: req.tenantId },
    })
  }

  if (modoTest !== undefined) {
    await req.db.configuracion.upsert({
      where: { tenantId_clave: { tenantId: req.tenantId, clave: 'MP_MODO_TEST' } },
      update: { valor: modoTest ? 'true' : 'false' },
      create: { clave: 'MP_MODO_TEST', valor: modoTest ? 'true' : 'false', modulo: 'PAGOS', tenantId: req.tenantId },
    })
  }

  // Caja default para recibir pagos MP (cuotas, etc). Su mpStoreId/mpPosId se mandan
  // a MP como metadata en cada preference para reconciliación.
  if (req.body?.cajaDefaultId !== undefined) {
    const valor = req.body.cajaDefaultId ? String(req.body.cajaDefaultId) : ''
    await req.db.configuracion.upsert({
      where: { tenantId_clave: { tenantId: req.tenantId, clave: 'MP_CAJA_DEFAULT_ID' } },
      update: { valor },
      create: { clave: 'MP_CAJA_DEFAULT_ID', valor, modulo: 'PAGOS', tenantId: req.tenantId },
    })
  }

  res.json({ success: true })
}))

export default router
