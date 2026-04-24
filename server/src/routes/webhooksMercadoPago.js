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

const router = express.Router()
const globalPrisma = new PrismaClient()

// Extrae tenantId del externalReference "clubix-ventanilla-{tenantId}-{uuid}"
function parseTenantFromExternalRef(ref) {
  if (!ref || typeof ref !== 'string') return null
  const m = ref.match(/^clubix-ventanilla-(\d+)-/)
  return m ? parseInt(m[1]) : null
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

async function procesarPagoMP(paymentId) {
  const pago = await obtenerPago(paymentId)
  if (!pago) {
    console.warn(`[MP Webhook] Pago ${paymentId} no encontrado en MP`)
    return
  }

  const tenantId = parseTenantFromExternalRef(pago.external_reference)
  if (!tenantId) {
    console.log(`[MP Webhook] Pago ${paymentId} sin external_reference de ventanilla (ref=${pago.external_reference})`)
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
    const ultimo = await tx.movimientoCaja.findFirst({ orderBy: { id: 'desc' } })
    const nuevoNumero = `MOV-${String((ultimo?.id || 0) + 1).padStart(8, '0')}`

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
