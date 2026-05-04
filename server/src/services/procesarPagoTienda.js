/**
 * Procesa un pago aprobado de Mercado Pago para un PedidoTienda.
 *
 * Flujo en la transacción:
 *   1. Validar PedidoTienda existe y paymentStatus == 'pending'
 *   2. Crear Pedido interno (estado='PENDIENTE_TIENDA' o lo que corresponda)
 *   3. Crear MovimientoCaja en la caja TIENDA_CAJA_ID
 *   4. Marcar reservas ACTIVA → CONFIRMADA (sin TTL)
 *   5. Si comprador es invitado → upsert Entidad CLIENTE
 *   6. Marcar PedidoTienda paymentStatus='paid' + estado=CONFIRMADO
 *   7. Notificar (fuera de la TX)
 */
import { v4 as uuidv4 } from 'uuid'
import prisma from '../lib/prisma.js'
import { generarNumeroMovimientoCaja, generarNumeroMC } from '../routes/buffet/helpers.js'
import { enviarPedidoConfirmadoTienda } from './email.js'
import { getIO } from './socketService.js'

const globalPrisma = prisma

/**
 * @param {Object} pago - payload de MP /v1/payments/:id
 * @param {number} tenantId
 * @returns {Promise<{ pedidoTiendaId: number, pedidoId: number, movCajaId: number } | null>}
 */
export async function procesarPagoTienda(pago, tenantId) {
  const externalRef = pago.external_reference
  const pedidoTienda = await globalPrisma.pedidoTienda.findUnique({
    where: { mpExternalReference: externalRef },
  })

  if (!pedidoTienda) {
    console.warn(`[Tienda Webhook] PedidoTienda no encontrado para ref=${externalRef}`)
    return null
  }
  if (pedidoTienda.tenantId !== tenantId) {
    console.error(`[Tienda Webhook] tenantId mismatch: pedido=${pedidoTienda.tenantId} ref=${tenantId}`)
    return null
  }
  if (pedidoTienda.paymentStatus !== 'pending') {
    console.log(`[Tienda Webhook] PedidoTienda ${pedidoTienda.id} ya estaba ${pedidoTienda.paymentStatus}, ignorando`)
    return null
  }
  if (pago.status !== 'approved') {
    console.log(`[Tienda Webhook] Pago ${pago.id} status=${pago.status}, esperando confirmación`)
    return null
  }

  // Validar monto
  const montoPagado = Number(pago.transaction_amount)
  const montoEsperado = Number(pedidoTienda.total)
  if (Math.abs(montoPagado - montoEsperado) > 0.01) {
    console.error(`[Tienda Webhook] Monto no coincide: pedido=${montoEsperado} pago=${montoPagado}`)
    await globalPrisma.shopWebhookLog.create({
      data: {
        source: 'MERCADOPAGO',
        paymentId: String(pago.id),
        externalReference: externalRef,
        rawPayload: pago,
        processed: false,
        hasError: true,
        errorMessage: `Monto no coincide: esperado=${montoEsperado} pagado=${montoPagado}`,
        tenantId,
      },
    })
    return null
  }

  // Cargar parámetros de tienda (caja, medio de pago, concepto)
  const params = await globalPrisma.configuracion.findMany({
    where: { tenantId, modulo: 'TIENDA' },
    select: { clave: true, valor: true },
  })
  const cfg = Object.fromEntries(params.map(p => [p.clave, p.valor]))
  const cajaId = cfg.TIENDA_CAJA_ID ? parseInt(cfg.TIENDA_CAJA_ID) : null
  const medioPagoId = cfg.TIENDA_MEDIO_PAGO_MP_ID ? parseInt(cfg.TIENDA_MEDIO_PAGO_MP_ID) : null

  if (!cajaId || !medioPagoId) {
    const msg = `Tienda mal configurada: cajaId=${cajaId} medioPagoId=${medioPagoId}`
    console.error(`[Tienda Webhook] ${msg}`)
    await globalPrisma.shopWebhookLog.create({
      data: {
        source: 'MERCADOPAGO',
        paymentId: String(pago.id),
        externalReference: externalRef,
        rawPayload: pago,
        processed: false,
        hasError: true,
        errorMessage: msg,
        tenantId,
      },
    })
    return null
  }

  // Cargar items con producto
  const items = await globalPrisma.itemPedidoTienda.findMany({
    where: { pedidoTiendaId: pedidoTienda.id },
    include: {
      productoVariante: { include: { producto: true } },
    },
  })

  // Resolver admin "sistema": el primer admin del tenant. Si no hay, fallback al primer admin global.
  const tu = await globalPrisma.tenantUsuario.findFirst({
    where: { tenantId, activo: true },
    orderBy: { id: 'asc' },
    select: { adminId: true },
  })
  let adminSistemaId = tu?.adminId
  if (!adminSistemaId) {
    const fallback = await globalPrisma.admin.findFirst({ orderBy: { id: 'asc' }, select: { id: true } })
    adminSistemaId = fallback?.id
  }
  if (!adminSistemaId) throw new Error('No se encontró un admin para registrar el movimiento')

  // TX
  const result = await globalPrisma.$transaction(async (tx) => {
    // Re-check estado
    const actual = await tx.pedidoTienda.findUnique({ where: { id: pedidoTienda.id } })
    if (!actual || actual.paymentStatus !== 'pending') return null

    // Cargar caja + medio de pago
    const caja = await tx.caja.findUnique({ where: { id: cajaId } })
    const medioPago = await tx.medioPago.findUnique({ where: { id: medioPagoId } })
    if (!caja || !medioPago) throw new Error('Caja o medio de pago no encontrado')

    const cuentaContableId = medioPago.cuentaContableId || caja.cuentaContableId
    if (!cuentaContableId) throw new Error('No se pudo determinar cuenta contable para la tienda')
    const centroCostoId = caja.centroCostoId || null

    // Resolver entidad: si no hay socio ni shopCustomer → upsert Entidad CLIENTE por email
    let entidadId = pedidoTienda.entidadId
    if (!entidadId && !pedidoTienda.socioId) {
      const existente = await tx.entidad.findFirst({
        where: { tenantId, email: pedidoTienda.compradorEmail, tipo: 'CLIENTE' },
      })
      if (existente) {
        entidadId = existente.id
      } else {
        // Generar código WEB-NNNN
        const lastEnt = await tx.entidad.findFirst({
          where: { tenantId, codigo: { startsWith: 'WEB-' } },
          orderBy: { codigo: 'desc' },
          select: { codigo: true },
        })
        let seq = 1
        if (lastEnt?.codigo) seq = (parseInt(lastEnt.codigo.split('-')[1] || '0') || 0) + 1
        const codigo = `WEB-${String(seq).padStart(4, '0')}`
        const nueva = await tx.entidad.create({
          data: {
            codigo,
            tipo: 'CLIENTE',
            razonSocial: pedidoTienda.compradorNombre,
            email: pedidoTienda.compradorEmail,
            telefono: pedidoTienda.compradorTelefono,
            tipoDocumento: 'DNI',
            documento: pedidoTienda.compradorDocumento,
            tenantId,
          },
        })
        entidadId = nueva.id
      }
    }

    // Crear MovimientoCaja
    const numeroMov = await generarNumeroMovimientoCaja(tx)
    const movCaja = await tx.movimientoCaja.create({
      data: {
        numero: numeroMov,
        cajaId,
        tipo: 'INGRESO',
        cuentaContableId,
        centroCostoId,
        monto: pedidoTienda.total,
        medioPagoId,
        concepto: `Tienda online - Pedido ${pedidoTienda.numero}`,
        descripcion: `Ref MP: ${pago.id}`,
        socioId: pedidoTienda.socioId || null,
        entidadId: entidadId || null,
        comprobanteNro: String(pago.id),
        comprobanteTipo: 'MP',
        registradoPor: adminSistemaId,
        tenantId,
      },
    })
    await tx.caja.update({
      where: { id: cajaId },
      data: { saldoActual: { increment: pedidoTienda.total } },
    })

    // Crear Pedido interno
    const numeroPed = `PED-${String(Date.now()).slice(-8)}-${String(pedidoTienda.id).padStart(4, '0')}`
    const pedidoInterno = await tx.pedido.create({
      data: {
        numero: numeroPed,
        socioId: pedidoTienda.socioId || null,
        entidadId: entidadId || null,
        fecha: new Date(),
        subtotal: pedidoTienda.subtotal,
        total: pedidoTienda.total,
        estado: 'PAGADO',
        observaciones: `Tienda online - WEB ${pedidoTienda.numero}`,
        registradoPor: adminSistemaId,
        tenantId,
        items: {
          create: items.map(it => ({
            productoVarianteId: it.productoVarianteId,
            descripcion: `${it.snapshotNombre}${it.snapshotTalle ? ` - ${it.snapshotTalle}` : ''}${it.snapshotColor ? ` ${it.snapshotColor}` : ''}`,
            cantidad: it.cantidad,
            precioUnitario: it.precioUnitario,
            subtotal: it.subtotal,
            tenantId,
          })),
        },
      },
    })

    // Confirmar reservas (quitar TTL)
    await tx.reservaStock.updateMany({
      where: { pedidoTiendaId: pedidoTienda.id, estado: 'ACTIVA' },
      data: { estado: 'CONFIRMADA' },
    })

    // Buscar estado CONFIRMADO
    const estadoConfirmado = await tx.estadoPedidoTienda.findUnique({
      where: { tenantId_codigo: { tenantId, codigo: 'CONFIRMADO' } },
    })

    // Actualizar PedidoTienda
    await tx.pedidoTienda.update({
      where: { id: pedidoTienda.id },
      data: {
        paymentStatus: 'paid',
        mpPaymentId: String(pago.id),
        pagadoEn: new Date(),
        pedidoId: pedidoInterno.id,
        entidadId: entidadId || null,
        estadoId: estadoConfirmado?.id || pedidoTienda.estadoId,
        historial: estadoConfirmado
          ? {
              create: {
                estadoId: estadoConfirmado.id,
                nota: `Pago aprobado ${pago.id}`,
                tenantId,
              },
            }
          : undefined,
      },
    })

    return {
      pedidoTiendaId: pedidoTienda.id,
      pedidoId: pedidoInterno.id,
      movCajaId: movCaja.id,
    }
  })

  if (result) {
    console.log(`[Tienda Webhook] OK pedido WEB=${pedidoTienda.numero} → PED interno ${result.pedidoId}, mov ${result.movCajaId}`)

    // Notificar al comprador (email)
    try {
      const pedidoFinal = await globalPrisma.pedidoTienda.findUnique({
        where: { id: pedidoTienda.id },
        include: { items: true },
      })
      if (pedidoFinal) {
        await enviarPedidoConfirmadoTienda({
          pedidoTienda: pedidoFinal,
          items: pedidoFinal.items,
          tenantId,
          db: globalPrisma,
        })
      }
    } catch (err) {
      console.error('[Tienda Webhook] Error enviando email de confirmación:', err.message)
    }

    // Emitir socket a admins (si Socket.io está activo)
    try {
      const io = getIO()
      io.to('destino:TIENDA').emit('tienda:nuevo-pedido', {
        pedidoTiendaId: result.pedidoTiendaId,
        pedidoInternoId: result.pedidoId,
        numero: pedidoTienda.numero,
        comprador: pedidoTienda.compradorNombre,
        total: Number(pedidoTienda.total),
        timestamp: new Date(),
      })
    } catch {} // Socket no inicializado o sin admins conectados — ignorar
  }
  return result
}
