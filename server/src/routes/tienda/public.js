/**
 * Rutas públicas de la Tienda Online (sin autenticación obligatoria).
 *
 * Mount: /api/tienda
 * Tenant: extractTenant aplicado en index.js
 *
 * Endpoints:
 *   GET  /productos             - listado público
 *   GET  /productos/:id         - detalle con variantes y disponibilidad
 *   POST /checkout              - crea PedidoTienda + reserva stock + preference MP
 *   GET  /pedidos/:externalRef  - estado del pedido (polling desde back_url)
 *   GET  /config                - info pública de tienda (titulos hero, dirección retiro, etc.)
 */
import express from 'express'
import { v4 as uuidv4 } from 'uuid'
import { asyncHandler, AppError } from '../../middleware/errorHandler.js'
import { crearPreferenciaTienda } from '../../services/mercadoPagoTienda.js'
import { getTenantFrontendUrl } from '../../lib/tenantUrl.js'
import { getMpAccessToken } from '../../lib/mercadoPagoConfig.js'
import { shopCustomerOptional, authShopCustomer } from '../../middleware/authShopCustomer.js'
import {
  generarNumeroPedidoTienda,
  obtenerDisponibilidadVariantes,
  calcularPrecio,
  leerParametrosTienda,
  PEDIDO_TIENDA_INCLUDE,
} from './helpers.js'

const router = express.Router()

// ---------------------------------------------------------------------------
// GET /api/tienda/config
// Datos públicos para renderizar la tienda (hero, retiro, etc.)
// ---------------------------------------------------------------------------
router.get('/config', asyncHandler(async (req, res) => {
  const params = await leerParametrosTienda(req.db)
  res.json({
    success: true,
    data: {
      habilitada: params.habilitada,
      tituloHero: params.tituloHero,
      subtituloHero: params.subtituloHero,
      retiroDireccion: params.retiroDireccion,
      retiroHorarios: params.retiroHorarios,
      permitirInvitados: params.permitirInvitados,
      reservaTtlMin: params.reservaTtlMin,
    },
  })
}))

// ---------------------------------------------------------------------------
// GET /api/tienda/productos
// Filtros: ?q=, ?categoriaId=, ?destacados=true, ?ofertas=true, ?orden=precio_asc|precio_desc|nombre
// ---------------------------------------------------------------------------
router.get('/productos', asyncHandler(async (req, res) => {
  const { q, categoriaId, destacados, ofertas, orden } = req.query

  const where = {
    publicarEnTienda: true,
    activo: true,
  }
  if (categoriaId) where.categoriaId = parseInt(categoriaId)
  if (destacados === 'true') where.destacadoTienda = true
  if (ofertas === 'true') where.precioOfertaTienda = { not: null }
  if (q) {
    where.OR = [
      { nombre: { contains: q, mode: 'insensitive' } },
      { codigo: { contains: q, mode: 'insensitive' } },
      { descripcionTienda: { contains: q, mode: 'insensitive' } },
    ]
  }

  let orderBy = [{ destacadoTienda: 'desc' }, { nombre: 'asc' }]
  if (orden === 'precio_asc') orderBy = [{ precioVenta: 'asc' }]
  else if (orden === 'precio_desc') orderBy = [{ precioVenta: 'desc' }]
  else if (orden === 'nombre') orderBy = [{ nombre: 'asc' }]

  const productos = await req.db.producto.findMany({
    where,
    include: {
      categoria: { select: { id: true, nombre: true } },
      fotos: { orderBy: [{ esPrincipal: 'desc' }, { orden: 'asc' }], take: 1 },
      variantes: {
        where: { activo: true },
        select: { id: true, talle: true, color: true, stockActual: true, precioVenta: true },
      },
    },
    orderBy,
  })

  // Calcular disponibilidad agregada
  const allVariantIds = productos.flatMap(p => p.variantes.map(v => v.id))
  const dispo = await obtenerDisponibilidadVariantes(req.db, allVariantIds)

  const data = productos.map(p => {
    const stockTotal = p.variantes.reduce((s, v) => s + (dispo.get(v.id)?.disponible || 0), 0)
    const { precio, precioLista, enOferta } = calcularPrecio(p, null)
    return {
      id: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
      descripcion: p.descripcionTienda || p.descripcion,
      categoria: p.categoria,
      foto: p.fotos[0]?.url || null,
      precio,
      precioLista,
      enOferta,
      destacado: p.destacadoTienda,
      tieneVariantes: p.variantes.length > 1,
      stockDisponible: stockTotal,
      sinStock: stockTotal === 0,
    }
  })

  res.json({ success: true, data })
}))

// ---------------------------------------------------------------------------
// GET /api/tienda/productos/:id
// ---------------------------------------------------------------------------
router.get('/productos/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id)
  if (Number.isNaN(id)) throw new AppError('ID inválido', 400)

  const producto = await req.db.producto.findFirst({
    where: { id, publicarEnTienda: true, activo: true },
    include: {
      categoria: { select: { id: true, nombre: true } },
      fotos: { orderBy: [{ esPrincipal: 'desc' }, { orden: 'asc' }] },
      variantes: {
        where: { activo: true },
        orderBy: [{ talle: 'asc' }, { color: 'asc' }],
      },
    },
  })

  if (!producto) throw new AppError('Producto no encontrado', 404)

  const dispo = await obtenerDisponibilidadVariantes(req.db, producto.variantes.map(v => v.id))

  const variantes = producto.variantes.map(v => {
    const { precio, precioLista, enOferta } = calcularPrecio(producto, v)
    const d = dispo.get(v.id) || { disponible: 0 }
    return {
      id: v.id,
      talle: v.talle,
      color: v.color,
      sku: v.sku,
      precio,
      precioLista,
      enOferta,
      stockDisponible: d.disponible,
      sinStock: d.disponible <= 0,
    }
  })

  const { precio, precioLista, enOferta } = calcularPrecio(producto, null)

  res.json({
    success: true,
    data: {
      id: producto.id,
      codigo: producto.codigo,
      nombre: producto.nombre,
      descripcion: producto.descripcionTienda || producto.descripcion,
      categoria: producto.categoria,
      fotos: producto.fotos.map(f => ({ id: f.id, url: f.url, esPrincipal: f.esPrincipal })),
      precio,
      precioLista,
      enOferta,
      destacado: producto.destacadoTienda,
      variantes,
    },
  })
}))

// ---------------------------------------------------------------------------
// POST /api/tienda/checkout
// Body: {
//   items: [{ productoVarianteId, cantidad }],
//   comprador: { nombre, email, telefono, documento? },
//   notasComprador?,
//   shopCustomerId? (si está logueado)
//   socioId? (si es socio logueado)
// }
// Devuelve: { initPoint, externalReference, expiraEn }
// ---------------------------------------------------------------------------
router.post('/checkout', shopCustomerOptional, asyncHandler(async (req, res) => {
  const { items, comprador, notasComprador } = req.body
  // Si está logueado, los datos sensibles vienen del JWT, no del body
  let shopCustomerId = null
  let socioId = null
  if (req.shopCustomer) {
    shopCustomerId = req.shopCustomer.customerId
    socioId = req.shopCustomer.socioId || null
  }

  // Validaciones básicas
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('El carrito está vacío', 400)
  }
  if (!comprador?.nombre || !comprador?.email) {
    throw new AppError('Datos del comprador incompletos', 400)
  }

  const params = await leerParametrosTienda(req.db)
  if (!params.habilitada) throw new AppError('La tienda no está habilitada', 503)

  // El access token MP es de configuración global del tenant, no del módulo Tienda
  let mpAccessToken
  try {
    mpAccessToken = await getMpAccessToken(req.db)
  } catch (err) {
    throw new AppError(
      'Mercado Pago no está configurado para este club. Andá a Configuración → Pagos → Mercado Pago.',
      503,
      'MP_NOT_CONFIGURED'
    )
  }

  if (!params.permitirInvitados && !shopCustomerId && !socioId) {
    throw new AppError('Es necesario iniciar sesión para comprar', 401)
  }

  // Deduplicar items por varianteId (sumar cantidades)
  const itemsAgrupados = new Map()
  for (const it of items) {
    const vid = parseInt(it.productoVarianteId)
    const cant = parseFloat(it.cantidad)
    if (!vid || !cant || cant <= 0) continue
    itemsAgrupados.set(vid, (itemsAgrupados.get(vid) || 0) + cant)
  }
  if (itemsAgrupados.size === 0) throw new AppError('No hay items válidos en el carrito', 400)

  const varianteIds = Array.from(itemsAgrupados.keys())
  const ttlMin = Number(params.reservaTtlMin) || 15
  const expiraEn = new Date(Date.now() + ttlMin * 60 * 1000)
  const externalReference = `clubix-tienda-${req.tenantId}-${uuidv4()}`

  // TX: validar stock + crear pedido + reservas en una sola transacción
  const result = await req.db.$transaction(async (tx) => {
    // Cargar variantes con su producto
    const variantes = await tx.productoVariante.findMany({
      where: { id: { in: varianteIds }, activo: true },
      include: {
        producto: {
          include: { fotos: { take: 1, orderBy: { orden: 'asc' } } },
        },
      },
    })
    if (variantes.length !== varianteIds.length) {
      throw new AppError('Alguno de los productos ya no está disponible', 409)
    }

    // Validar publicación en tienda
    for (const v of variantes) {
      if (!v.producto.publicarEnTienda || !v.producto.activo) {
        throw new AppError(`El producto "${v.producto.nombre}" ya no está disponible`, 409)
      }
    }

    // Calcular disponibilidad
    const dispo = await obtenerDisponibilidadVariantes(tx, varianteIds)
    const sinStock = []
    for (const v of variantes) {
      const d = dispo.get(v.id)
      const cant = itemsAgrupados.get(v.id)
      if (!d || d.disponible < cant) {
        sinStock.push({
          productoVarianteId: v.id,
          producto: v.producto.nombre,
          talle: v.talle,
          color: v.color,
          solicitado: cant,
          disponible: d?.disponible || 0,
        })
      }
    }
    if (sinStock.length) {
      const err = new AppError('Stock insuficiente para uno o más items', 409)
      err.code = 'STOCK_INSUFFICIENT'
      err.details = sinStock
      throw err
    }

    // Calcular subtotal/total con precios reales del backend
    let subtotal = 0
    const itemsParaCrear = []
    for (const v of variantes) {
      const cant = itemsAgrupados.get(v.id)
      const { precio } = calcularPrecio(v.producto, v)
      const sub = Number((precio * cant).toFixed(2))
      subtotal += sub
      itemsParaCrear.push({
        productoVarianteId: v.id,
        cantidad: cant,
        precioUnitario: precio,
        subtotal: sub,
        snapshotNombre: v.producto.nombre,
        snapshotTalle: v.talle,
        snapshotColor: v.color,
        snapshotSku: v.sku,
        snapshotImagen: v.producto.fotos[0]?.url || null,
        tenantId: req.tenantId,
      })
    }
    const total = Number(subtotal.toFixed(2))

    // Estado inicial
    const estadoInicial = await tx.estadoPedidoTienda.findFirst({
      where: { tenantId: req.tenantId, isInitial: true },
    })
    if (!estadoInicial) throw new AppError('Estado inicial de tienda no configurado', 500)

    const numero = await generarNumeroPedidoTienda(tx, req.tenantId)

    const pedido = await tx.pedidoTienda.create({
      data: {
        numero,
        estadoId: estadoInicial.id,
        shopCustomerId: shopCustomerId || null,
        socioId: socioId || null,
        compradorNombre: comprador.nombre,
        compradorEmail: comprador.email,
        compradorTelefono: comprador.telefono || null,
        compradorDocumento: comprador.documento || null,
        subtotal,
        total,
        paymentStatus: 'pending',
        paymentMethod: 'MP',
        mpExternalReference: externalReference,
        expiraEn,
        metodoEntrega: 'RETIRO_CLUB',
        notasComprador: notasComprador || null,
        ipComprador: req.ip || null,
        userAgent: req.get('user-agent')?.slice(0, 500) || null,
        items: { create: itemsParaCrear },
        historial: {
          create: {
            estadoId: estadoInicial.id,
            nota: 'Checkout iniciado',
            tenantId: req.tenantId,
          },
        },
        tenantId: req.tenantId,
      },
    })

    // Crear reservas con TTL
    for (const v of variantes) {
      const cant = itemsAgrupados.get(v.id)
      await tx.reservaStock.create({
        data: {
          productoVarianteId: v.id,
          pedidoTiendaId: pedido.id,
          cantidad: cant,
          estado: 'ACTIVA',
          expiraEn,
          motivo: 'TIENDA_CHECKOUT',
          tenantId: req.tenantId,
        },
      })
    }

    return { pedido, total, items: itemsParaCrear, variantes }
  })

  // Crear preferencia MP fuera de la TX (no participamos del TX si MP demora)
  let mpResult
  try {
    mpResult = await crearPreferenciaTienda({
      accessToken: mpAccessToken,
      items: result.items.map(it => ({
        title: `${it.snapshotNombre}${it.snapshotTalle ? ` - ${it.snapshotTalle}` : ''}${it.snapshotColor ? ` ${it.snapshotColor}` : ''}`,
        quantity: Number(it.cantidad),
        unit_price: Number(it.precioUnitario),
      })),
      externalReference,
      payer: { name: comprador.nombre, email: comprador.email },
      frontendUrl: getTenantFrontendUrl(req.tenant),
      tenantSlug: req.tenant?.slug || req.tenant?.subdomain,
      statementDescriptor: req.tenant?.nombre?.slice(0, 22) || 'CLUBIX TIENDA',
    })
  } catch (err) {
    console.error('[Tienda Checkout] Error creando preferencia MP:', err)
    // Liberar las reservas si MP falló
    await req.db.reservaStock.updateMany({
      where: { pedidoTiendaId: result.pedido.id, estado: 'ACTIVA' },
      data: { estado: 'CANCELADA', liberadoEn: new Date() },
    })
    await req.db.pedidoTienda.update({
      where: { id: result.pedido.id },
      data: { paymentStatus: 'cancelled' },
    })
    throw new AppError('No se pudo iniciar el pago en Mercado Pago', 502)
  }

  // Guardar el preferenceId + initPoint
  await req.db.pedidoTienda.update({
    where: { id: result.pedido.id },
    data: {
      mpPreferenceId: mpResult.id,
      mpInitPoint: mpResult.initPoint,
    },
  })

  res.json({
    success: true,
    data: {
      pedidoId: result.pedido.id,
      numero: result.pedido.numero,
      externalReference,
      total: result.total,
      initPoint: mpResult.initPoint,
      sandboxInitPoint: mpResult.sandboxInitPoint,
      expiraEn,
    },
  })
}))

// ---------------------------------------------------------------------------
// GET /api/tienda/mis-pedidos  (autenticado)
// Lista los pedidos del shopCustomer logueado.
// ---------------------------------------------------------------------------
router.get('/mis-pedidos', authShopCustomer, asyncHandler(async (req, res) => {
  const customerId = req.shopCustomer.customerId
  const customer = await req.db.shopCustomer.findUnique({
    where: { id: customerId },
    select: { id: true, email: true, socioId: true },
  })
  if (!customer) throw new AppError('Sesión inválida', 401)

  // Vincular pedidos por shopCustomerId, socioId o email (legacy/guest reclamado)
  const pedidos = await req.db.pedidoTienda.findMany({
    where: {
      OR: [
        { shopCustomerId: customer.id },
        ...(customer.socioId ? [{ socioId: customer.socioId }] : []),
        { compradorEmail: customer.email },
      ],
    },
    include: {
      estado: { select: { codigo: true, nombre: true, color: true } },
      items: {
        select: {
          id: true, cantidad: true, precioUnitario: true, subtotal: true,
          snapshotNombre: true, snapshotTalle: true, snapshotColor: true, snapshotImagen: true,
        },
      },
      pedido: { select: { id: true, numero: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  res.json({ success: true, data: pedidos })
}))

// ---------------------------------------------------------------------------
// GET /api/tienda/pedidos/:externalRef
// Para que la página de éxito haga polling hasta que el webhook procesó el pago.
// ---------------------------------------------------------------------------
router.get('/pedidos/:externalRef', asyncHandler(async (req, res) => {
  const ref = req.params.externalRef
  const pedido = await req.db.pedidoTienda.findUnique({
    where: { mpExternalReference: ref },
    include: {
      estado: { select: { codigo: true, nombre: true, color: true } },
      items: {
        select: {
          id: true,
          cantidad: true,
          precioUnitario: true,
          subtotal: true,
          snapshotNombre: true,
          snapshotTalle: true,
          snapshotColor: true,
          snapshotImagen: true,
        },
      },
      pedido: { select: { id: true, numero: true } },
    },
  })

  if (!pedido) throw new AppError('Pedido no encontrado', 404)

  // No exponemos info sensible — solo lo necesario para la confirmation page
  res.json({
    success: true,
    data: {
      numero: pedido.numero,
      estado: pedido.estado,
      paymentStatus: pedido.paymentStatus,
      total: pedido.total,
      compradorNombre: pedido.compradorNombre,
      compradorEmail: pedido.compradorEmail,
      items: pedido.items,
      pagadoEn: pedido.pagadoEn,
      pedidoInternoNumero: pedido.pedido?.numero || null,
    },
  })
}))

export default router
