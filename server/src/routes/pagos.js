import { Router } from 'express'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { obtenerPago } from '../services/mercadopago.js'

const router = Router()

/**
 * Webhook de MercadoPago
 * POST /api/pagos/webhook/mercadopago
 *
 * Recibe notificaciones de MercadoPago cuando hay cambios en el estado del pago
 * Documentación: https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/additional-content/your-integrations/notifications/webhooks
 */
router.post('/webhook/mercadopago', asyncHandler(async (req, res) => {
  const { type, data } = req.body

  console.log('[MercadoPago Webhook]', {
    type,
    dataId: data?.id,
    body: req.body,
  })

  // MercadoPago envía diferentes tipos de notificaciones
  if (type === 'payment') {
    const paymentId = data.id

    try {
      // Obtener información completa del pago
      const payment = await obtenerPago(paymentId)

      console.log('[MercadoPago Pago]', {
        id: payment.id,
        status: payment.status,
        external_reference: payment.external_reference,
        transaction_amount: payment.transaction_amount,
      })

      // El external_reference contiene el ID del LinkPago
      const linkPagoId = parseInt(payment.external_reference)

      if (!linkPagoId) {
        console.error('[MercadoPago] No se encontró external_reference')
        return res.status(200).json({ success: true })
      }

      // Buscar el LinkPago
      const linkPago = await req.prisma.linkPago.findUnique({
        where: { id: linkPagoId },
      })

      if (!linkPago) {
        console.error('[MercadoPago] LinkPago no encontrado:', linkPagoId)
        return res.status(200).json({ success: true })
      }

      // Mapear estados de MercadoPago a nuestros estados
      const estadosMap = {
        approved: 'PAGADO',
        pending: 'PENDIENTE',
        in_process: 'PENDIENTE',
        rejected: 'RECHAZADO',
        cancelled: 'ANULADO',
        refunded: 'ANULADO',
        charged_back: 'ANULADO',
      }

      const nuevoEstado = estadosMap[payment.status] || 'PENDIENTE'

      // Actualizar LinkPago
      await req.prisma.linkPago.update({
        where: { id: linkPagoId },
        data: {
          estado: nuevoEstado,
          pagoId: payment.id.toString(),
          fechaPago: payment.status === 'approved' ? new Date() : null,
        },
      })

      // Si el pago fue aprobado, registrar el pago
      if (payment.status === 'approved' && linkPago.estado !== 'PAGADO') {
        // Parsear IDs de cargos
        const cargosIds = JSON.parse(linkPago.cargosIds || '[]')

        if (cargosIds.length > 0) {
          // Obtener los cargos
          const cargos = await req.prisma.cargo.findMany({
            where: {
              id: { in: cargosIds },
            },
          })

          // Crear el pago
          const pago = await req.prisma.pago.create({
            data: {
              socioId: linkPago.socioId,
              fecha: new Date(),
              monto: parseFloat(payment.transaction_amount),
              metodoPago: 'MERCADOPAGO',
              comprobante: `MP-${payment.id}`,
              observaciones: `Pago online via ${linkPago.plataforma}`,
            },
          })

          // Aplicar pago a cada cargo
          for (const cargo of cargos) {
            await req.prisma.aplicacionPago.create({
              data: {
                pagoId: pago.id,
                cargoId: cargo.id,
                monto: parseFloat(cargo.montoTotal),
              },
            })

            // Marcar cargo como PAGADO
            await req.prisma.cargo.update({
              where: { id: cargo.id },
              data: { estado: 'PAGADO' },
            })
          }

          console.log('[MercadoPago] Pago registrado exitosamente:', {
            pagoId: pago.id,
            cargos: cargosIds.length,
            monto: payment.transaction_amount,
          })

          // TODO: Enviar recibo por email al socio
        }
      }

      res.status(200).json({ success: true })
    } catch (error) {
      console.error('[MercadoPago Webhook] Error procesando pago:', error)
      // Siempre responder 200 para que MercadoPago no reintente
      res.status(200).json({ success: false, error: error.message })
    }
  } else {
    // Otros tipos de notificaciones (merchant_order, etc.)
    res.status(200).json({ success: true })
  }
}))

/**
 * Webhook de MODO (cuando esté disponible)
 * POST /api/pagos/webhook/modo
 */
router.post('/webhook/modo', asyncHandler(async (req, res) => {
  // TODO: Implementar webhook de MODO
  console.log('[MODO Webhook]', req.body)
  res.status(200).json({ success: true })
}))

export default router
