import { Router } from 'express'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { obtenerPago } from '../services/mercadopago.js'
import { generarAsientoAutomatico } from './asientos.js'
import { v4 as uuidv4 } from 'uuid'
import { enviarConfirmacionReserva } from '../services/email.js'

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

      // El external_reference puede ser un número (LinkPago) o un JSON (reservas, etc.)
      let externalRef = payment.external_reference
      let refParsed = null
      try { refParsed = JSON.parse(externalRef) } catch (_) { /* no es JSON */ }

      // ── Reservas de espacio ──────────────────────────────────────────────
      if (refParsed?.tipo === 'RESERVA') {
        if (payment.status === 'approved') {
          const reserva = await req.db.reservaEspacio.findUnique({
            where: { id: refParsed.reservaId },
            include: { espacio: { select: { nombre: true } } },
          })

          if (reserva && reserva.estado === 'PENDIENTE_PAGO') {
            const whereReservas = reserva.grupoRecurrenciaId
              ? { grupoRecurrenciaId: reserva.grupoRecurrenciaId, estado: 'PENDIENTE_PAGO' }
              : { id: reserva.id }

            await req.db.reservaEspacio.updateMany({
              where: whereReservas,
              data: { estado: 'CONFIRMADA', paymentIdMP: payment.id.toString() },
            })

            // Movimiento de caja si hay caja MP configurada
            const cajaMercadoPago = await req.db.caja.findFirst({
              where: {
                OR: [
                  { codigo: { contains: 'MERCADOPAGO', mode: 'insensitive' } },
                  { codigo: { contains: 'MP', mode: 'insensitive' } },
                  { nombre: { contains: 'MercadoPago', mode: 'insensitive' } },
                ],
              },
            })
            const conceptoReservas = await req.db.conceptoTesoreria.findFirst({
              where: {
                OR: [
                  { codigo: { contains: 'RESERVA', mode: 'insensitive' } },
                  { nombre: { contains: 'Reserva', mode: 'insensitive' } },
                ],
              },
              include: { cuentaContable: true },
            })
            if (cajaMercadoPago && conceptoReservas?.cuentaContableId) {
              await req.db.movimientoCaja.create({
                data: {
                  numero: `MOV-MP-${payment.id}`,
                  cajaId: cajaMercadoPago.id,
                  tipo: 'INGRESO',
                  cuentaContableId: conceptoReservas.cuentaContableId,
                  monto: parseFloat(payment.transaction_amount),
                  concepto: `Reserva MP - ${reserva.espacio.nombre} - ${reserva.nombreReserva} ${reserva.apellido}`,
                  registradoPor: 1,
                  comprobanteNro: payment.id.toString(),
                  comprobanteTipo: 'MERCADOPAGO',
                  tenantId: reserva.tenantId,
                },
              })
            }
            // Enviar email de confirmación
            if (reserva.email) {
              enviarConfirmacionReserva(reserva, req.db).catch(() => {})
            }

            console.log('[MercadoPago] Reserva confirmada:', reserva.codigo)
          }
        }
        return res.status(200).json({ success: true })
      }

      // ── Flujo original (LinkPago: cuotas y entradas) ─────────────────────
      const linkPagoId = parseInt(externalRef)

      if (!linkPagoId) {
        console.error('[MercadoPago] No se encontró external_reference')
        return res.status(200).json({ success: true })
      }

      // Buscar el LinkPago
      const linkPago = await req.db.linkPago.findUnique({
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
      await req.db.linkPago.update({
        where: { id: linkPagoId },
        data: {
          estado: nuevoEstado,
          pagoId: payment.id.toString(),
          fechaPago: payment.status === 'approved' ? new Date() : null,
        },
      })

      // Si el pago fue aprobado, registrar el pago
      if (payment.status === 'approved' && linkPago.estado !== 'PAGADO') {
        // Parsear datos del LinkPago
        const datosCompra = JSON.parse(linkPago.cargosIds || '{}')

        // Verificar si es una compra de entradas
        if (datosCompra.tipo === 'ENTRADAS') {
          console.log('[MercadoPago] Procesando compra de entradas:', datosCompra)

          await req.db.$transaction(async (tx) => {
            // Obtener evento y categoría
            const evento = await tx.evento.findUnique({
              where: { id: datosCompra.eventoId },
              include: {
                categorias: {
                  where: { id: datosCompra.categoriaId }
                }
              }
            })

            if (!evento || evento.categorias.length === 0) {
              throw new Error('Evento o categoría no encontrada')
            }

            const categoria = evento.categorias[0]
            const socio = await tx.socio.findUnique({
              where: { id: linkPago.socioId }
            })

            // 1. Crear MovimientoCaja
            const numeroMovimiento = `MOV-MP-${payment.id}`

            // Obtener cuenta contable para eventos
            let cuentaContableId = null
            if (evento.conceptoTesoreriaId) {
              const concepto = await tx.conceptoTesoreria.findUnique({
                where: { id: evento.conceptoTesoreriaId },
                include: { cuentaContable: true }
              })
              cuentaContableId = concepto?.cuentaContableId
            }

            if (!cuentaContableId) {
              const conceptoDefault = await tx.conceptoTesoreria.findFirst({
                where: {
                  OR: [
                    { codigo: { contains: 'EVENTOS', mode: 'insensitive' } },
                    { nombre: { contains: 'Eventos', mode: 'insensitive' } }
                  ]
                },
                include: { cuentaContable: true }
              })
              cuentaContableId = conceptoDefault?.cuentaContableId
            }

            // Obtener caja de MercadoPago
            const cajaMercadoPago = await tx.caja.findFirst({
              where: {
                OR: [
                  { codigo: { contains: 'MERCADOPAGO', mode: 'insensitive' } },
                  { codigo: { contains: 'MP', mode: 'insensitive' } },
                  { nombre: { contains: 'MercadoPago', mode: 'insensitive' } }
                ]
              }
            })

            if (!cajaMercadoPago) {
              throw new Error('No se encontró la caja de MercadoPago')
            }

            const movimientoCaja = await tx.movimientoCaja.create({
              data: {
                numero: numeroMovimiento,
                cajaId: cajaMercadoPago.id,
                tipo: 'INGRESO',
                cuentaContableId: cuentaContableId,
                centroCostoId: evento.centroCostoId,
                monto: parseFloat(payment.transaction_amount),
                concepto: `Entradas MP - ${evento.nombre} - ${payment.payment_method_id}`,
                registradoPor: linkPago.socioId,
                comprobanteNro: payment.id.toString(),
                comprobanteTipo: 'MERCADOPAGO'
              }
            })

            // 2. Crear Asiento Contable
            if (cajaMercadoPago.cuentaContableId && cuentaContableId) {
              await generarAsientoAutomatico(tx, {
                fecha: new Date(),
                concepto: `Venta Entradas MP - ${evento.nombre} - ${socio.apellidoNombre}`,
                tipoOrigen: 'VENTA_ENTRADAS_MERCADOPAGO',
                origenId: movimientoCaja.id,
                registradoPor: linkPago.socioId,
                lineas: [
                  {
                    // DEBE: Cuenta de MercadoPago
                    cuentaContableId: cajaMercadoPago.cuentaContableId,
                    descripcion: `MercadoPago - ${payment.payment_method_id}`,
                    debe: parseFloat(payment.transaction_amount),
                    haber: 0,
                    centroCostoId: evento.centroCostoId
                  },
                  {
                    // HABER: Cuenta de ingreso por eventos
                    cuentaContableId: cuentaContableId,
                    descripcion: evento.nombre,
                    debe: 0,
                    haber: parseFloat(payment.transaction_amount),
                    centroCostoId: evento.centroCostoId
                  }
                ]
              })
            }

            // 3. Crear entradas
            for (let i = 0; i < datosCompra.cantidad; i++) {
              await tx.entrada.create({
                data: {
                  codigo: uuidv4(),
                  eventoId: datosCompra.eventoId,
                  categoriaId: datosCompra.categoriaId,
                  socioId: linkPago.socioId,
                  nombreComprador: socio.apellidoNombre,
                  documentoComprador: socio.documento,
                  emailComprador: socio.email,
                  celularComprador: socio.celular,
                  precio: datosCompra.precio,
                  esSocio: datosCompra.esSocio,
                  canalVenta: 'PORTAL_SOCIO',
                  estado: 'VALIDA',
                  movimientoCajaId: movimientoCaja.id
                }
              })
            }

            // 4. Actualizar contadores
            await tx.evento.update({
              where: { id: datosCompra.eventoId },
              data: { entradasVendidas: { increment: datosCompra.cantidad } }
            })

            await tx.categoriaEntrada.update({
              where: { id: datosCompra.categoriaId },
              data: { entradasVendidas: { increment: datosCompra.cantidad } }
            })

            console.log('[MercadoPago] Entradas creadas exitosamente:', {
              eventoId: datosCompra.eventoId,
              cantidad: datosCompra.cantidad,
              monto: payment.transaction_amount
            })
          })

          // TODO: Enviar entradas por email
        } else if (datosCompra.tipo === 'RESERVA') {
          // Procesar pago de reserva de espacio
          console.log('[MercadoPago] Procesando pago de reserva:', datosCompra)

          await req.db.$transaction(async (tx) => {
            const reserva = await tx.reservaEspacio.findUnique({
              where: { id: datosCompra.reservaId },
              include: { espacio: true },
            })
            if (!reserva) throw new Error('Reserva no encontrada')

            // Si hay grupo de recurrencia, confirmar todas las pendientes del grupo
            const whereReservas = reserva.grupoRecurrenciaId
              ? { grupoRecurrenciaId: reserva.grupoRecurrenciaId, estado: 'PENDIENTE_PAGO' }
              : { id: reserva.id, estado: 'PENDIENTE_PAGO' }

            await tx.reservaEspacio.updateMany({
              where: whereReservas,
              data: {
                estado: 'CONFIRMADA',
                paymentIdMP: payment.id.toString(),
              },
            })

            // Obtener caja de MercadoPago
            const cajaMercadoPago = await tx.caja.findFirst({
              where: {
                tenantId: linkPago.tenantId,
                OR: [
                  { codigo: { contains: 'MERCADOPAGO', mode: 'insensitive' } },
                  { codigo: { contains: 'MP', mode: 'insensitive' } },
                  { nombre: { contains: 'MercadoPago', mode: 'insensitive' } },
                ],
              },
            })

            if (cajaMercadoPago) {
              // Buscar cuenta contable para reservas
              const conceptoReservas = await tx.conceptoTesoreria.findFirst({
                where: {
                  tenantId: linkPago.tenantId,
                  OR: [
                    { codigo: { contains: 'RESERVA', mode: 'insensitive' } },
                    { nombre: { contains: 'Reserva', mode: 'insensitive' } },
                  ],
                },
                include: { cuentaContable: true },
              })

              if (conceptoReservas?.cuentaContableId) {
                await tx.movimientoCaja.create({
                  data: {
                    numero: `MOV-MP-${payment.id}`,
                    cajaId: cajaMercadoPago.id,
                    tipo: 'INGRESO',
                    cuentaContableId: conceptoReservas.cuentaContableId,
                    monto: parseFloat(payment.transaction_amount),
                    concepto: `Reserva MP - ${reserva.espacio.nombre} - ${reserva.nombreReserva} ${reserva.apellido}`,
                    registradoPor: 1,
                    comprobanteNro: payment.id.toString(),
                    comprobanteTipo: 'MERCADOPAGO',
                    tenantId: linkPago.tenantId,
                  },
                })
              }
            }

            console.log('[MercadoPago] Reserva confirmada:', reserva.codigo)
          })

        } else {
          // Procesar pago de cuotas (lógica original)
          const cargosIds = Array.isArray(datosCompra) ? datosCompra : []

          if (cargosIds.length > 0) {
            // Obtener los cargos
            const cargos = await req.db.cargo.findMany({
              where: {
                id: { in: cargosIds },
              },
            })

            // Crear el pago con datos de MercadoPago para conciliación
            const pago = await req.db.pago.create({
              data: {
                socioId: linkPago.socioId,
                fecha: new Date(),
                monto: parseFloat(payment.transaction_amount),
                metodoPago: 'MERCADOPAGO',
                comprobante: `MP-${payment.id}`,
                nroOperacion: payment.id.toString(), // ID de MP para conciliación
                fechaOperacion: payment.date_approved ? new Date(payment.date_approved) : new Date(),
                linkPagoId: linkPago.id, // Referencia al LinkPago
                observaciones: `Pago online via ${linkPago.plataforma} - Método: ${payment.payment_method_id || 'N/A'}`,
              },
            })

            // Aplicar pago a cada cargo
            for (const cargo of cargos) {
              await req.db.aplicacionPago.create({
                data: {
                  pagoId: pago.id,
                  cargoId: cargo.id,
                  monto: parseFloat(cargo.montoTotal),
                },
              })

              // Marcar cargo como PAGADO
              await req.db.cargo.update({
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
