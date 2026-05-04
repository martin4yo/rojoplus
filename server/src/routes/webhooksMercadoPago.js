/**
 * Webhook (IPN) de Mercado Pago para QR dinámico.
 *
 * MP llama a este endpoint cuando se acredita un pago.
 * Formatos que envía MP:
 *   Query:  ?type=payment&data.id=1234  (o ?topic=payment&id=1234)
 *   Body:   { id, type, action, data: { id }, user_id, live_mode, ... }
 *
 * El external_reference del pago tiene formato: clubix-ventanilla-{tenantId}-{uuid}
 * Desde ahí extraemos el tenant y ejecutamos la venta en su DB.
 */

import express from 'express'
import { v4 as uuidv4 } from 'uuid'
import { PrismaClient } from '@prisma/client'
import { obtenerPago } from '../services/mercadoPagoQR.js'
import { obtenerPagoTienda } from '../services/mercadoPagoTienda.js'
import { generarNumeroMovimientoCaja } from './buffet/helpers.js'
import { procesarPagoTienda } from '../services/procesarPagoTienda.js'

const router = express.Router()
const globalPrisma = new PrismaClient()

/**
 * Detecta el contexto del externalReference y devuelve { contexto, tenantId }.
 *   clubix-ventanilla-{tenantId}-... → { contexto: 'ventanilla', tenantId }
 *   clubix-tienda-{tenantId}-...     → { contexto: 'tienda', tenantId }
 *   otro                              → { contexto: null }
 */
function parseExternalRef(ref) {
  if (!ref || typeof ref !== 'string') return { contexto: null, tenantId: null }
  const m = ref.match(/^clubix-(ventanilla|tienda)-(\d+)-/)
  if (!m) return { contexto: null, tenantId: null }
  return { contexto: m[1], tenantId: parseInt(m[2]) }
}

// Compat con código previo
function parseTenantFromExternalRef(ref) {
  const { contexto, tenantId } = parseExternalRef(ref)
  return contexto === 'ventanilla' ? tenantId : null
}

/**
 * Cuando el .env no tiene el token o no matchea, busca en los tenants
 * configurados en Configuracion (modulo='PAGOS') uno que pueda obtener el pago.
 * Ineficiente pero solo se usa como fallback en el webhook legacy.
 */
async function intentarObtenerPagoConTenants(paymentId) {
  const cfgs = await globalPrisma.configuracion.findMany({
    where: { modulo: 'PAGOS', clave: 'MP_ACCESS_TOKEN' },
    select: { tenantId: true, valor: true },
  })
  for (const cfg of cfgs) {
    if (!cfg.valor) continue
    try {
      const pago = await obtenerPago(paymentId, cfg.valor)
      if (pago) return pago
    } catch {
      // probar siguiente
    }
  }
  return null
}

/**
 * POST /api/webhooks/mercadopago
 * MP envía múltiples tipos de notificación; nos interesan los de 'payment'.
 */
router.post('/mercadopago', express.json(), async (req, res) => {
  // Responder 200 rápido para que MP no reintente excesivamente
  // Procesamiento async; errores se logean pero no se devuelven a MP
  try {
    const type = req.query.type || req.query.topic || req.body?.type || req.body?.topic
    const paymentId = req.query['data.id'] || req.query.id || req.body?.data?.id || req.body?.id

    console.log(`[MP Webhook] type=${type} paymentId=${paymentId}`)

    if (type !== 'payment' || !paymentId) {
      return res.status(200).json({ received: true, ignored: true })
    }

    // Ack inmediato
    res.status(200).json({ received: true })

    // Procesar pago
    procesarPagoMP(paymentId).catch(err => {
      console.error('[MP Webhook] Error procesando pago:', err)
    })
  } catch (err) {
    console.error('[MP Webhook] Error general:', err)
    if (!res.headersSent) res.status(200).json({ received: true, error: err.message })
  }
})

// Algunos SDKs de MP usan GET para pings de verificación
router.get('/mercadopago', (req, res) => {
  res.json({ status: 'ok' })
})

/**
 * POST /api/webhooks/mercadopago/:tenantSlug
 * Webhook por-tenant para tienda online. Usa el access token del tenant
 * (resuelto a partir del slug) para consultar el pago en MP.
 */
router.post('/mercadopago/:tenantSlug', express.json(), async (req, res) => {
  const { tenantSlug } = req.params
  try {
    const type = req.query.type || req.query.topic || req.body?.type || req.body?.topic
    const paymentId = req.query['data.id'] || req.query.id || req.body?.data?.id || req.body?.id

    console.log(`[MP Webhook][Tienda:${tenantSlug}] type=${type} paymentId=${paymentId}`)

    if (type !== 'payment' || !paymentId) {
      return res.status(200).json({ received: true, ignored: true })
    }

    res.status(200).json({ received: true })

    procesarPagoTiendaWebhook(tenantSlug, paymentId).catch(err => {
      console.error(`[MP Webhook][Tienda:${tenantSlug}] Error:`, err)
    })
  } catch (err) {
    console.error('[MP Webhook][Tienda] Error general:', err)
    if (!res.headersSent) res.status(200).json({ received: true, error: err.message })
  }
})

router.get('/mercadopago/:tenantSlug', (req, res) => {
  res.json({ status: 'ok', tenant: req.params.tenantSlug })
})

async function procesarPagoTiendaWebhook(tenantSlug, paymentId) {
  // Resolver tenant + access token
  const tenant = await globalPrisma.tenant.findUnique({
    where: { subdomain: tenantSlug },
    select: { id: true, slug: true, subdomain: true },
  })
  const tenantBySlug = tenant || await globalPrisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, slug: true, subdomain: true },
  })
  if (!tenantBySlug) {
    console.warn(`[MP Webhook][Tienda] Tenant no encontrado para slug=${tenantSlug}`)
    return
  }

  const cfg = await globalPrisma.configuracion.findUnique({
    where: { tenantId_clave: { tenantId: tenantBySlug.id, clave: 'TIENDA_MP_ACCESS_TOKEN' } },
  })
  const accessToken = cfg?.valor
  if (!accessToken) {
    console.warn(`[MP Webhook][Tienda] No hay access token MP para tenant ${tenantBySlug.id}`)
    return
  }

  let pago
  try {
    pago = await obtenerPagoTienda(accessToken, paymentId)
  } catch (err) {
    console.error(`[MP Webhook][Tienda] Error consultando pago ${paymentId}:`, err.message)
    return
  }
  if (!pago) return

  // Log + procesar
  await globalPrisma.shopWebhookLog.create({
    data: {
      source: 'MERCADOPAGO',
      paymentId: String(pago.id),
      externalReference: pago.external_reference,
      topic: 'payment',
      rawPayload: pago,
      processed: false,
      tenantId: tenantBySlug.id,
    },
  })

  try {
    const result = await procesarPagoTienda(pago, tenantBySlug.id)
    if (result) {
      await globalPrisma.shopWebhookLog.updateMany({
        where: { paymentId: String(pago.id), tenantId: tenantBySlug.id },
        data: { processed: true, processedAt: new Date() },
      })
    }
  } catch (err) {
    console.error(`[MP Webhook][Tienda] Error procesando:`, err)
    await globalPrisma.shopWebhookLog.updateMany({
      where: { paymentId: String(pago.id), tenantId: tenantBySlug.id },
      data: { hasError: true, errorMessage: err.message?.slice(0, 500) },
    })
  }
}

async function procesarPagoMP(paymentId) {
  // Sin saber el tenant todavía, intentamos primero con el .env como antes
  // (si está) para descubrir el external_reference y poder rutear
  let pago
  try {
    pago = await obtenerPago(paymentId, process.env.MERCADOPAGO_ACCESS_TOKEN)
  } catch (err) {
    // Posible: el token global no tiene acceso a este pago. Intentamos con
    // tokens de cada tenant hasta encontrar uno que matchee
    pago = await intentarObtenerPagoConTenants(paymentId)
  }

  if (!pago) {
    console.warn(`[MP Webhook] Pago ${paymentId} no encontrado en MP`)
    return
  }

  // Detectar contexto del externalReference y rutear
  const { contexto, tenantId } = parseExternalRef(pago.external_reference)

  if (contexto === 'tienda') {
    // Tienda usa la URL /mercadopago/:tenantSlug — si llegó acá es config legacy
    console.warn(`[MP Webhook] Pago de tienda llegó a la URL legacy. Usar /mercadopago/:tenantSlug`)
    return
  }

  if (contexto !== 'ventanilla' || !tenantId) {
    console.log(`[MP Webhook] Pago ${paymentId} sin external_reference reconocido (ref=${pago.external_reference})`)
    return
  }

  const venta = await globalPrisma.ventaEventoQRPendiente.findUnique({
    where: { externalReference: pago.external_reference }
  })
  if (!venta) {
    console.warn(`[MP Webhook] Venta pendiente no encontrada para ref=${pago.external_reference}`)
    return
  }

  if (venta.estado !== 'PENDIENTE') {
    console.log(`[MP Webhook] Venta ${venta.id} ya estaba en estado ${venta.estado}, ignorando`)
    return
  }

  if (pago.status !== 'approved') {
    console.log(`[MP Webhook] Pago ${paymentId} con status=${pago.status}, esperando confirmación`)
    return
  }

  // Validar monto coincidente
  const montoPagado = Number(pago.transaction_amount)
  const montoEsperado = Number(venta.monto)
  if (Math.abs(montoPagado - montoEsperado) > 0.01) {
    console.error(`[MP Webhook] ⚠ Monto no coincide: venta=${montoEsperado} pago=${montoPagado}`)
    // No seguir; un admin tiene que revisar manualmente
    return
  }

  await ejecutarVenta(venta, pago)
}

/**
 * Ejecuta la venta confirmada: crea MovimientoCaja, Entradas (USADA) e IngresoEntrada.
 * Todo en una sola transacción.
 */
async function ejecutarVenta(venta, pago) {
  const resultado = await globalPrisma.$transaction(async (tx) => {
    // Re-chequear estado para evitar doble ejecución por webhooks duplicados
    const actual = await tx.ventaEventoQRPendiente.findUnique({ where: { id: venta.id } })
    if (!actual || actual.estado !== 'PENDIENTE') {
      console.log(`[MP Webhook] Race: venta ${venta.id} ya estaba en ${actual?.estado}`)
      return null
    }

    const items = Array.isArray(venta.items) ? venta.items : JSON.parse(venta.items)
    const cantidadTotal = items.reduce((s, i) => s + i.cantidad, 0)

    // Cargar evento y caja
    const evento = await tx.evento.findUnique({ where: { id: venta.eventoId } })
    const caja = await tx.caja.findUnique({ where: { id: venta.cajaId } })
    const medioPago = await tx.medioPago.findUnique({ where: { id: venta.medioPagoId } })
    if (!evento || !caja || !medioPago) {
      throw new Error('Evento, caja o medio de pago no encontrado')
    }

    // Cuenta contable: usar la del concepto de tesorería del evento, o la default del medioPago/caja
    const cuentaContableId =
      evento.conceptoTesoreriaId
        ? (await tx.conceptoTesoreria.findUnique({
            where: { id: evento.conceptoTesoreriaId },
            select: { cuentaContableId: true }
          }))?.cuentaContableId
        : (medioPago.cuentaContableId || caja.cuentaContableId)

    if (!cuentaContableId) {
      throw new Error('No se pudo determinar cuenta contable para la venta QR')
    }

    const centroCostoId = evento.centroCostoId || caja.centroCostoId || null

    // Generar número de movimiento
    const nuevoNumero = await generarNumeroMovimientoCaja(tx)

    // Crear MovimientoCaja
    const movCaja = await tx.movimientoCaja.create({
      data: {
        numero: nuevoNumero,
        cajaId: venta.cajaId,
        tipo: 'INGRESO',
        cuentaContableId,
        centroCostoId,
        monto: venta.monto,
        medioPagoId: venta.medioPagoId,
        concepto: `Venta Ventanilla QR MP - ${evento.nombre}`,
        descripcion: `Ref MP: ${pago.id} - ${cantidadTotal} entrada(s)`,
        socioId: venta.socioId || null,
        comprobanteNro: String(pago.id),
        comprobanteTipo: 'MP_QR',
        registradoPor: venta.creadoPor,
        tenantId: venta.tenantId,
      }
    })

    // Actualizar saldo de caja
    await tx.caja.update({
      where: { id: venta.cajaId },
      data: { saldoActual: { increment: venta.monto } }
    })

    // Crear Entradas en estado USADA + IngresoEntrada
    for (const item of items) {
      for (let i = 0; i < item.cantidad; i++) {
        const entrada = await tx.entrada.create({
          data: {
            codigo: uuidv4(),
            eventoId: venta.eventoId,
            categoriaId: item.categoriaId,
            socioId: venta.socioId || null,
            nombreComprador: venta.nombreComprador,
            precio: item.precio,
            esSocio: !!venta.socioId,
            estado: 'USADA',
            canalVenta: 'VENTANILLA',
            vendidoPor: venta.creadoPor,
            movimientoCajaId: movCaja.id,
            tenantId: venta.tenantId,
          }
        })
        await tx.ingresoEntrada.create({
          data: {
            entradaId: entrada.id,
            eventoId: venta.eventoId,
            dispositivoId: venta.dispositivoId,
            validadoPor: venta.creadoPor,
            modoValidacion: 'VENTANILLA',
            tenantId: venta.tenantId,
          }
        })
      }
      await tx.categoriaEntrada.update({
        where: { id: item.categoriaId },
        data: { entradasVendidas: { increment: item.cantidad } }
      })
    }

    // Actualizar contadores del evento
    await tx.evento.update({
      where: { id: venta.eventoId },
      data: {
        entradasVendidas: { increment: cantidadTotal },
        entradasIngresadas: { increment: cantidadTotal },
      }
    })

    // Marcar venta como PAGADA
    await tx.ventaEventoQRPendiente.update({
      where: { id: venta.id },
      data: {
        estado: 'PAGADA',
        mpPaymentId: String(pago.id),
        pagadoEn: new Date(),
        movimientoCajaId: movCaja.id,
      }
    })

    return { movCajaId: movCaja.id, cantidadTotal }
  })

  if (resultado) {
    console.log(`[MP Webhook] ✅ Venta ${venta.id} PAGADA: ${resultado.cantidadTotal} entradas, movCaja=${resultado.movCajaId}`)
  }
}

export default router
