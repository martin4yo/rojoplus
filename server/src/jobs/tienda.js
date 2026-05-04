/**
 * Cron jobs del módulo Tienda Online.
 *
 * - expiracionReservas: cada 1 minuto, libera reservas activas con TTL vencido
 *   y marca PedidoTienda paymentStatus='expired' si nunca se completó el pago.
 */
import cron from 'node-cron'
import prisma from '../lib/prisma.js'

const expiracionReservasCron = cron.schedule('* * * * *', async () => {
  const ahora = new Date()
  try {
    // 1) Reservas ACTIVAS expiradas → EXPIRADA
    const expiradas = await prisma.reservaStock.updateMany({
      where: {
        estado: 'ACTIVA',
        expiraEn: { lt: ahora },
      },
      data: { estado: 'EXPIRADA', liberadoEn: ahora },
    })

    // 2) PedidoTienda con paymentStatus pending y expiraEn vencido → expired
    const pedidosExpirados = await prisma.pedidoTienda.findMany({
      where: {
        paymentStatus: 'pending',
        expiraEn: { lt: ahora },
      },
      select: { id: true, tenantId: true, estadoId: true },
    })

    if (pedidosExpirados.length > 0) {
      // Buscar estado CANCELADO por tenant para mover el pedido
      const tenantIds = [...new Set(pedidosExpirados.map(p => p.tenantId))]
      const cancelados = await prisma.estadoPedidoTienda.findMany({
        where: { tenantId: { in: tenantIds }, codigo: 'CANCELADO' },
      })
      const canceladoByTenant = Object.fromEntries(cancelados.map(c => [c.tenantId, c.id]))

      for (const p of pedidosExpirados) {
        const cancelId = canceladoByTenant[p.tenantId]
        await prisma.pedidoTienda.update({
          where: { id: p.id },
          data: {
            paymentStatus: 'expired',
            ...(cancelId && cancelId !== p.estadoId && {
              estadoId: cancelId,
              historial: {
                create: {
                  estadoId: cancelId,
                  nota: 'Pedido expirado: TTL de pago vencido sin confirmación',
                  tenantId: p.tenantId,
                },
              },
            }),
          },
        })
      }
    }

    if (expiradas.count > 0 || pedidosExpirados.length > 0) {
      console.log(`[Tienda Cron] reservas expiradas=${expiradas.count}, pedidos expirados=${pedidosExpirados.length}`)
    }
  } catch (err) {
    console.error('[Tienda Cron] Error en expiracionReservas:', err.message)
  }
}, { scheduled: false })

export function iniciarCronTienda() {
  console.log('🛍️  Cron tienda: expiración de reservas cada 1 min')
  expiracionReservasCron.start()
}

export function detenerCronTienda() {
  expiracionReservasCron.stop()
}
