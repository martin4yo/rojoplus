import { Router } from 'express'
import { asyncHandler } from '../middleware/errorHandler.js'
import { obtenerPago } from '../services/mercadopago.js'
import prisma from '../lib/prisma.js'
import { createTenantPrisma } from '../lib/tenantPrisma.js'
import { enviarReciboPago, enviarConfirmacionReserva } from '../services/email.js'
import { generarAsientoAutomatico } from './asientos.js'
import { v4 as uuidv4 } from 'uuid'

const router = Router()

async function generarNumeroPago(tx, tenantId) {
  const rows = await tx.$queryRaw`
    SELECT COALESCE(MAX(CAST(numero AS INTEGER)), 0)::int AS max_num
    FROM pagos
    WHERE tenant_id = ${tenantId}
      AND numero ~ '^[0-9]+$'
  `
  const ultimo = Number(rows?.[0]?.max_num || 0)
  return String(ultimo + 1).padStart(8, '0')
}

/**
 * Webhook de MercadoPago
 * POST /api/pagos/webhook/mercadopago
 *
 * Recibe notificaciones cuando hay cambios en el estado de un pago.
 * Siempre responde 200 para que MP no reintente (los errores se logean).
 */
router.post('/webhook/mercadopago', asyncHandler(async (req, res) => {
  const { type, data } = req.body

  console.log('[MercadoPago Webhook]', { type, dataId: data?.id })

  if (type !== 'payment') {
    return res.status(200).json({ success: true })
  }

  const paymentId = data.id

  try {
    const payment = await obtenerPago(paymentId)

    console.log('[MercadoPago Pago]', {
      id: payment.id,
      status: payment.status,
      external_reference: payment.external_reference,
      transaction_amount: payment.transaction_amount,
    })

    const externalRef = payment.external_reference
    let refParsed = null
    try { refParsed = JSON.parse(externalRef) } catch (_) {}

    // ── Reservas de espacio con external_reference JSON ───────────────────
    if (refParsed?.tipo === 'RESERVA') {
      if (payment.status !== 'approved') return res.status(200).json({ success: true })

      const reserva = await prisma.reservaEspacio.findUnique({
        where: { id: refParsed.reservaId },
        include: { espacio: { select: { nombre: true } } },
      })
      if (!reserva || reserva.estado !== 'PENDIENTE_PAGO') {
        return res.status(200).json({ success: true })
      }

      const db = createTenantPrisma(reserva.tenantId)

      const whereReservas = reserva.grupoRecurrenciaId
        ? { grupoRecurrenciaId: reserva.grupoRecurrenciaId, estado: 'PENDIENTE_PAGO' }
        : { id: reserva.id }

      await db.reservaEspacio.updateMany({
        where: whereReservas,
        data: { estado: 'CONFIRMADA', paymentIdMP: payment.id.toString() },
      })

      const cajaMercadoPago = await db.caja.findFirst({
        where: {
          OR: [
            { codigo: { contains: 'MERCADOPAGO', mode: 'insensitive' } },
            { codigo: { contains: 'MP', mode: 'insensitive' } },
            { nombre: { contains: 'MercadoPago', mode: 'insensitive' } },
          ],
        },
      })
      const conceptoReservas = await db.conceptoTesoreria.findFirst({
        where: {
          OR: [
            { codigo: { contains: 'RESERVA', mode: 'insensitive' } },
            { nombre: { contains: 'Reserva', mode: 'insensitive' } },
          ],
        },
        include: { cuentaContable: true },
      })
      if (cajaMercadoPago && conceptoReservas?.cuentaContableId) {
        await db.movimientoCaja.create({
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
          },
        })
      }
      if (reserva.email) {
        enviarConfirmacionReserva(reserva, db).catch(() => {})
      }
      console.log('[MercadoPago] Reserva confirmada:', reserva.codigo)
      return res.status(200).json({ success: true })
    }

    // ── LinkPago (cuotas y entradas) ──────────────────────────────────────
    const linkPagoId = parseInt(externalRef)
    if (!linkPagoId) {
      console.error('[MercadoPago] external_reference no reconocido:', externalRef)
      return res.status(200).json({ success: true })
    }

    // Buscar en global (sin tenant context) para obtener el tenantId
    const linkPago = await prisma.linkPago.findFirst({
      where: { id: linkPagoId },
    })
    if (!linkPago) {
      console.error('[MercadoPago] LinkPago no encontrado:', linkPagoId)
      return res.status(200).json({ success: true })
    }

    const db = createTenantPrisma(linkPago.tenantId)

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

    await db.linkPago.update({
      where: { id: linkPagoId },
      data: {
        estado: nuevoEstado,
        paymentId: payment.id.toString(),
        fechaPago: payment.status === 'approved' ? new Date() : null,
        paymentStatus: payment.status,
        paymentDetail: payment.payment_method_id || null,
      },
    })

    if (payment.status !== 'approved' || linkPago.estado === 'PAGADO') {
      return res.status(200).json({ success: true })
    }

    const datosCompra = JSON.parse(linkPago.cargosIds || '{}')

    // ── Entradas de evento ──────────────────────────────────────────────────
    if (datosCompra.tipo === 'ENTRADAS') {
      console.log('[MercadoPago] Procesando compra de entradas:', datosCompra)

      await db.$transaction(async (tx) => {
        const evento = await tx.evento.findUnique({
          where: { id: datosCompra.eventoId },
          include: { categorias: { where: { id: datosCompra.categoriaId } } },
        })
        if (!evento || evento.categorias.length === 0) throw new Error('Evento o categoría no encontrada')

        const socio = await tx.socio.findUnique({ where: { id: linkPago.socioId } })

        let cuentaContableId = null
        if (evento.conceptoTesoreriaId) {
          const concepto = await tx.conceptoTesoreria.findUnique({
            where: { id: evento.conceptoTesoreriaId },
            include: { cuentaContable: true },
          })
          cuentaContableId = concepto?.cuentaContableId
        }
        if (!cuentaContableId) {
          const conceptoDefault = await tx.conceptoTesoreria.findFirst({
            where: {
              OR: [
                { codigo: { contains: 'EVENTOS', mode: 'insensitive' } },
                { nombre: { contains: 'Eventos', mode: 'insensitive' } },
              ],
            },
            include: { cuentaContable: true },
          })
          cuentaContableId = conceptoDefault?.cuentaContableId
        }

        const cajaMercadoPago = await tx.caja.findFirst({
          where: {
            OR: [
              { codigo: { contains: 'MERCADOPAGO', mode: 'insensitive' } },
              { codigo: { contains: 'MP', mode: 'insensitive' } },
              { nombre: { contains: 'MercadoPago', mode: 'insensitive' } },
            ],
          },
        })
        if (!cajaMercadoPago) throw new Error('No se encontró la caja de MercadoPago')

        const movimientoCaja = await tx.movimientoCaja.create({
          data: {
            numero: `MOV-MP-${payment.id}`,
            cajaId: cajaMercadoPago.id,
            tipo: 'INGRESO',
            cuentaContableId,
            centroCostoId: evento.centroCostoId,
            monto: parseFloat(payment.transaction_amount),
            concepto: `Entradas MP - ${evento.nombre} - ${payment.payment_method_id}`,
            registradoPor: 1,
            comprobanteNro: payment.id.toString(),
            comprobanteTipo: 'MERCADOPAGO',
          },
        })

        if (cajaMercadoPago.cuentaContableId && cuentaContableId) {
          await generarAsientoAutomatico(tx, {
            fecha: new Date(),
            concepto: `Venta Entradas MP - ${evento.nombre} - ${socio?.apellidoNombre || ''}`,
            tipoOrigen: 'VENTA_ENTRADAS_MERCADOPAGO',
            origenId: movimientoCaja.id,
            registradoPor: 1,
            lineas: [
              {
                cuentaContableId: cajaMercadoPago.cuentaContableId,
                descripcion: `MercadoPago - ${payment.payment_method_id}`,
                debe: parseFloat(payment.transaction_amount),
                haber: 0,
                centroCostoId: evento.centroCostoId,
              },
              {
                cuentaContableId,
                descripcion: evento.nombre,
                debe: 0,
                haber: parseFloat(payment.transaction_amount),
                centroCostoId: evento.centroCostoId,
              },
            ],
          })
        }

        for (let i = 0; i < datosCompra.cantidad; i++) {
          await tx.entrada.create({
            data: {
              codigo: uuidv4(),
              eventoId: datosCompra.eventoId,
              categoriaId: datosCompra.categoriaId,
              socioId: linkPago.socioId,
              nombreComprador: socio?.apellidoNombre,
              documentoComprador: socio?.documento,
              emailComprador: socio?.email,
              celularComprador: socio?.celular,
              precio: datosCompra.precio,
              esSocio: datosCompra.esSocio,
              canalVenta: 'PORTAL_SOCIO',
              estado: 'VALIDA',
              movimientoCajaId: movimientoCaja.id,
            },
          })
        }

        await tx.evento.update({
          where: { id: datosCompra.eventoId },
          data: { entradasVendidas: { increment: datosCompra.cantidad } },
        })
        await tx.categoriaEntrada.update({
          where: { id: datosCompra.categoriaId },
          data: { entradasVendidas: { increment: datosCompra.cantidad } },
        })

        console.log('[MercadoPago] Entradas creadas:', { eventoId: datosCompra.eventoId, cantidad: datosCompra.cantidad })
      })

    // ── Reserva de espacio via LinkPago ──────────────────────────────────────
    } else if (datosCompra.tipo === 'RESERVA') {
      console.log('[MercadoPago] Procesando pago de reserva:', datosCompra)

      await db.$transaction(async (tx) => {
        const reserva = await tx.reservaEspacio.findUnique({
          where: { id: datosCompra.reservaId },
          include: { espacio: true },
        })
        if (!reserva) throw new Error('Reserva no encontrada')

        const whereReservas = reserva.grupoRecurrenciaId
          ? { grupoRecurrenciaId: reserva.grupoRecurrenciaId, estado: 'PENDIENTE_PAGO' }
          : { id: reserva.id, estado: 'PENDIENTE_PAGO' }

        await tx.reservaEspacio.updateMany({
          where: whereReservas,
          data: { estado: 'CONFIRMADA', paymentIdMP: payment.id.toString() },
        })

        const cajaMercadoPago = await tx.caja.findFirst({
          where: {
            OR: [
              { codigo: { contains: 'MERCADOPAGO', mode: 'insensitive' } },
              { codigo: { contains: 'MP', mode: 'insensitive' } },
              { nombre: { contains: 'MercadoPago', mode: 'insensitive' } },
            ],
          },
        })
        const conceptoReservas = await tx.conceptoTesoreria.findFirst({
          where: {
            OR: [
              { codigo: { contains: 'RESERVA', mode: 'insensitive' } },
              { nombre: { contains: 'Reserva', mode: 'insensitive' } },
            ],
          },
          include: { cuentaContable: true },
        })
        if (cajaMercadoPago && conceptoReservas?.cuentaContableId) {
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
            },
          })
        }
        console.log('[MercadoPago] Reserva confirmada:', reserva.codigo)
      })

    // ── Cuotas (caso principal) ──────────────────────────────────────────────
    } else {
      const cargosIds = Array.isArray(datosCompra) ? datosCompra : []
      if (cargosIds.length === 0) {
        console.warn('[MercadoPago] cargosIds vacío en LinkPago:', linkPago.id)
        return res.status(200).json({ success: true })
      }

      const medioPago = await db.medioPago.findFirst({
        where: {
          OR: [
            { codigo: { contains: 'MERCADOPAGO', mode: 'insensitive' } },
            { nombre: { contains: 'MercadoPago', mode: 'insensitive' } },
          ],
        },
      })

      let pagoCompleto = null
      for (let intento = 0; intento < 3; intento++) {
        try {
          pagoCompleto = await db.$transaction(async (tx) => {
            const numero = await generarNumeroPago(tx, linkPago.tenantId)

            const pago = await tx.pago.create({
              data: {
                numero,
                socioId: linkPago.socioId,
                montoTotal: parseFloat(payment.transaction_amount),
                montoRecibido: parseFloat(payment.transaction_amount),
                medioPagoId: medioPago?.id || null,
                cajaId: linkPago.cajaId || null,
                nroOperacion: payment.id.toString(),
                fechaOperacion: payment.date_approved ? new Date(payment.date_approved) : new Date(),
                comprobanteNro: payment.id.toString(),
                comprobanteTipo: 'MERCADOPAGO',
                linkPagoId: linkPago.id,
                origen: 'PORTAL_SOCIO',
                observaciones: `Pago online MercadoPago - ${payment.payment_method_id || 'N/A'}`,
                registradoPor: 1,
                estado: 'CONFIRMADO',
              },
            })

            await tx.cargo.updateMany({
              where: { id: { in: cargosIds } },
              data: {
                estado: 'PAGADO',
                fechaPago: new Date(),
                pagoId: pago.id,
              },
            })

            if (linkPago.cajaId) {
              await tx.caja.update({
                where: { id: linkPago.cajaId },
                data: { saldoActual: { increment: parseFloat(payment.transaction_amount) } },
              })
            }

            return tx.pago.findFirst({
              where: { id: pago.id },
              include: {
                socio: {
                  select: { id: true, nroSocio: true, apellidoNombre: true, documento: true, email: true },
                },
                medioPago: { select: { id: true, nombre: true } },
                cargos: {
                  include: {
                    periodo: { select: { nombre: true } },
                    categoriaActividad: {
                      select: { nombre: true, actividad: { select: { nombre: true } } },
                    },
                  },
                },
              },
            })
          })
          break
        } catch (err) {
          const esConflictoNumero = err?.code === 'P2002'
            && Array.isArray(err?.meta?.target)
            && err.meta.target.includes('numero')
          if (!esConflictoNumero || intento === 2) throw err
          await new Promise(r => setTimeout(r, 20 + Math.floor(Math.random() * 60)))
        }
      }

      if (pagoCompleto) {
        console.log('[MercadoPago] Pago registrado:', { id: pagoCompleto.id, numero: pagoCompleto.numero, cargos: cargosIds.length })
        enviarReciboPago(pagoCompleto, db).catch(err => {
          console.error('[MercadoPago] Error enviando recibo por email:', err)
        })
      }
    }

    res.status(200).json({ success: true })
  } catch (error) {
    console.error('[MercadoPago Webhook] Error procesando pago:', error)
    res.status(200).json({ success: false, error: error.message })
  }
}))

/**
 * Webhook de MODO
 * POST /api/pagos/webhook/modo
 */
router.post('/webhook/modo', asyncHandler(async (req, res) => {
  console.log('[MODO Webhook]', req.body)
  res.status(200).json({ success: true })
}))

export default router
