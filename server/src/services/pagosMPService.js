/**
 * Procesa un pago de cuotas aprobado por MercadoPago.
 * Usado tanto por el webhook como por la verificación al volver al portal.
 *
 * Hace exactamente lo mismo que la cobranza manual:
 *  1. Crea el Pago
 *  2. Marca los Cargos como PAGADOS
 *  3. Crea el MovimientoCaja
 *  4. Actualiza el saldo de la caja
 *  5. Genera el PDF del recibo
 *  6. Envía el email con PDF adjunto
 */

import { generarReciboPagoPDF } from './pdfGenerator.js'
import { enviarReciboPago } from './email.js'

/**
 * @param {object} db         - cliente Prisma tenant-scoped
 * @param {number} tenantId
 * @param {object} linkPago   - registro LinkPago completo
 * @param {object} payment    - objeto pago devuelto por la API de MP
 * @param {object} [tenant]   - objeto tenant (para logoUrl)
 */
export async function procesarPagoCuotasMP(db, tenantId, linkPago, payment, tenant = null) {
  const cargosIds = JSON.parse(linkPago.cargosIds || '[]')
  if (!Array.isArray(cargosIds) || cargosIds.length === 0) return null

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
        // ── Número de recibo ──────────────────────────────────────────────
        const rows = await tx.$queryRaw`
          SELECT COALESCE(MAX(CAST(numero AS INTEGER)), 0)::int AS max_num
          FROM pagos WHERE tenant_id = ${tenantId} AND numero ~ '^[0-9]+$'
        `
        const numero = String(Number(rows?.[0]?.max_num || 0) + 1).padStart(8, '0')

        // ── Crear Pago ────────────────────────────────────────────────────
        const pago = await tx.pago.create({
          data: {
            numero,
            socioId: linkPago.socioId,
            montoTotal: parseFloat(payment.transaction_amount),
            montoRecibido: parseFloat(payment.transaction_amount),
            medioPagoId: medioPago?.id || null,
            cajaId: linkPago.cajaId || null,
            nroOperacion: String(payment.id),
            fechaOperacion: payment.date_approved ? new Date(payment.date_approved) : new Date(),
            comprobanteNro: String(payment.id),
            comprobanteTipo: 'MERCADOPAGO',
            linkPagoId: linkPago.id,
            origen: 'PORTAL_SOCIO',
            observaciones: `Pago online MercadoPago - ${payment.payment_method_id || 'N/A'}`,
            registradoPor: 1,
            estado: 'CONFIRMADO',
          },
        })

        // ── Marcar cargos como PAGADOS ────────────────────────────────────
        const cargosMP = await tx.cargo.findMany({
          where: { id: { in: cargosIds } },
          include: { conceptoTesoreria: true },
        })
        await tx.cargo.updateMany({
          where: { id: { in: cargosIds } },
          data: { estado: 'PAGADO', fechaPago: new Date(), pagoId: pago.id },
        })

        // ── MovimientoCaja ────────────────────────────────────────────────
        if (linkPago.cajaId) {
          const caja = await tx.caja.findUnique({
            where: { id: linkPago.cajaId },
            select: { id: true, cuentaContableId: true, requiereConciliacion: true, saldoActual: true },
          })

          if (caja) {
            // Actualizar saldo
            await tx.caja.update({
              where: { id: caja.id },
              data: { saldoActual: { increment: parseFloat(payment.transaction_amount) } },
            })

            // Crear movimiento solo si la caja tiene cuenta contable
            if (caja.cuentaContableId) {
              const anio = new Date().getFullYear()
              const prefijo = `MV-${anio}-`
              const ultimoMov = await tx.movimientoCaja.findFirst({
                where: { numero: { startsWith: prefijo } },
                orderBy: { numero: 'desc' },
              })
              const siguiente = ultimoMov
                ? (parseInt(ultimoMov.numero.split('-').pop()) || 0) + 1
                : 1
              const numeroMov = `${prefijo}${String(siguiente).padStart(5, '0')}`

              const movMP = await tx.movimientoCaja.create({
                data: {
                  numero: numeroMov,
                  cajaId: caja.id,
                  cuentaContableId: caja.cuentaContableId,
                  medioPagoId: medioPago?.id || null,
                  fecha: new Date(),
                  tipo: 'INGRESO',
                  concepto: 'Cobranza MercadoPago',
                  monto: parseFloat(payment.transaction_amount),
                  descripcion: `Pago cuotas portal - Recibo ${numero}`,
                  pagoId: pago.id,
                  registradoPor: 1,
                  conciliado: !caja.requiereConciliacion,
                },
              })

              // ItemMovimientoCaja — un ítem por concepto de cargo
              const gruposMP = {}
              for (const c of cargosMP) {
                const key = c.conceptoTesoreriaId ?? 'sin'
                if (!gruposMP[key]) {
                  gruposMP[key] = {
                    conceptoTesoreriaId: c.conceptoTesoreriaId,
                    cuentaContableId: c.conceptoTesoreria?.cuentaContableId ?? caja.cuentaContableId,
                    centroCostoId: c.centroCostoId ?? null,
                    monto: 0,
                  }
                }
                gruposMP[key].monto += Number(c.montoTotal)
              }
              const gruposMPArr = Object.values(gruposMP)
              const totalMP = gruposMPArr.reduce((s, g) => s + g.monto, 0)
              const montoTotal = parseFloat(payment.transaction_amount)
              let montoAsigMP = 0
              for (let i = 0; i < gruposMPArr.length; i++) {
                const g = gruposMPArr[i]
                const esUltimo = i === gruposMPArr.length - 1
                const montoItem = esUltimo
                  ? Math.round((montoTotal - montoAsigMP) * 100) / 100
                  : Math.round(montoTotal * (totalMP > 0 ? g.monto / totalMP : 1 / gruposMPArr.length) * 100) / 100
                if (montoItem <= 0) continue
                montoAsigMP += montoItem
                await tx.itemMovimientoCaja.create({
                  data: {
                    movimientoCajaId: movMP.id,
                    conceptoTesoreriaId: g.conceptoTesoreriaId,
                    cuentaContableId: g.cuentaContableId,
                    centroCostoId: g.centroCostoId,
                    monto: montoItem,
                    descripcion: `Cobranza MercadoPago - Recibo ${numero}`,
                    orden: i,
                  }
                })
              }
            }
          }
        }

        // ── Fetch completo para PDF y email ───────────────────────────────
        return tx.pago.findFirst({
          where: { id: pago.id },
          include: {
            socio: {
              select: {
                id: true, nroSocio: true, apellidoNombre: true,
                documento: true, email: true,
                domicilio: true, calle: true, ciudad: true,
              },
            },
            medioPago: { select: { id: true, nombre: true } },
            caja: { select: { nombre: true } },
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
      const esConflicto = err?.code === 'P2002' && err?.meta?.target?.includes('numero')
      if (!esConflicto || intento === 2) throw err
      await new Promise(r => setTimeout(r, 20 + Math.floor(Math.random() * 60)))
    }
  }

  if (!pagoCompleto) return null

  console.log(`[MP] Pago ${pagoCompleto.numero} registrado — socio ${linkPago.socioId}, monto ${payment.transaction_amount}`)

  // ── PDF + Email (en background, no bloquea) ───────────────────────────
  ;(async () => {
    let pdfBuffer = null
    let pdfFilename = `recibo-${pagoCompleto.numero}.pdf`
    try {
      const configList = await db.configuracion.findMany({
        where: { clave: { in: ['CLUB_NOMBRE', 'CLUB_DIRECCION', 'CLUB_TELEFONO'] } },
        select: { clave: true, valor: true },
      })
      const configMap = Object.fromEntries(configList.map(c => [c.clave, c.valor]))
      if (tenant?.logoUrl) configMap.CLUB_LOGO_URL = tenant.logoUrl

      pdfBuffer = await generarReciboPagoPDF(pagoCompleto, 'Portal MercadoPago', configMap)

      const nombreSocio = (pagoCompleto.socio?.apellidoNombre || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_')
      pdfFilename = `recibo-${pagoCompleto.numero}${nombreSocio ? '-' + nombreSocio : ''}.pdf`
    } catch (err) {
      console.error('[MP] Error generando PDF del recibo:', err.message)
    }

    enviarReciboPago(pagoCompleto, db, pdfBuffer ? { pdfBuffer, pdfFilename } : {})
      .catch(err => console.error('[MP] Error enviando recibo por email:', err.message))
  })()

  return pagoCompleto
}
