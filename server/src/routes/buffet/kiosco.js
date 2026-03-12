/**
 * Rutas de Kiosco (Venta Rápida) del Buffet
 * - Venta directa sin comanda
 * - Facturación
 */
import express from 'express'
import prisma from '../../lib/prisma.js'
import { authAdmin, checkPermiso } from '../../middleware/auth.js'
import { generarAsientoAutomatico } from '../asientos.js'
import {
  generarAsientoFacturaVenta,
  generarAsientoReciboCobro
} from '../../services/asientosContables.js'
import { generarNumeroMC } from './helpers.js'

const router = express.Router()

/**
 * POST /kiosco/venta
 * Venta directa kiosco (sin crear comanda)
 */
router.post('/kiosco/venta', authAdmin, checkPermiso('BUFFET_KIOSCO'), async (req, res) => {
  try {
    const {
      items,
      medioPagoId,
      cajaId,
      socioId,
      observaciones,
      propina,
      pagosParciales,
      emitirFactura,
      esVentaInterna,
      tipoComprobante,
      datosCliente,
      clienteId,
      tipoCliente
    } = req.body

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Debe agregar al menos un producto' })
    }

    // Calcular total de items
    let totalItems = 0
    const detalleItems = []
    const productosVenta = []

    for (const item of items) {
      const producto = await prisma.productoBuffet.findUnique({ where: { id: item.productoBuffetId } })
      if (!producto) continue

      const cantidad = item.cantidad || 1

      // Calcular precio adicional de opciones
      let precioAdicionalOpciones = 0
      const opcionesInfo = []

      if (item.opcionesSeleccionadas && item.opcionesSeleccionadas.length > 0) {
        for (const opSel of item.opcionesSeleccionadas) {
          const opcion = await prisma.opcionProducto.findUnique({
            where: { id: opSel.opcionId },
            include: { productoRef: true }
          })
          if (opcion) {
            precioAdicionalOpciones += Number(opcion.precioAdicional) * (opSel.cantidad || 1)
            const nombreOp = opcion.productoRef?.nombre || opcion.nombre
            opcionesInfo.push(`+ ${opSel.cantidad > 1 ? `${opSel.cantidad}x ` : ''}${nombreOp}`)
          }
        }
      }

      // Agregar opciones removidas
      if (item.opcionesRemovidas && item.opcionesRemovidas.length > 0) {
        for (const removida of item.opcionesRemovidas) {
          opcionesInfo.push(`- SIN ${removida.nombre}`)
        }
      }

      const precioUnitarioTotal = Number(producto.precio) + precioAdicionalOpciones
      const subtotal = precioUnitarioTotal * cantidad
      totalItems += subtotal

      // Construir nombre con opciones para detalle
      let nombreConOpciones = `${cantidad}x ${producto.nombre}`
      if (opcionesInfo.length > 0) {
        nombreConOpciones += ` (${opcionesInfo.join(', ')})`
      }
      detalleItems.push(nombreConOpciones)

      productosVenta.push({
        nombre: producto.nombre,
        cantidad,
        precioUnitario: precioUnitarioTotal,
        subtotal,
        opcionesInfo // Para el ticket
      })
    }

    const propinaMonto = propina && propina > 0 ? parseFloat(propina) : 0
    const totalFinal = totalItems + propinaMonto

    let cuentaContable = await prisma.cuentaContable.findFirst({
      where: { codigo: { contains: 'BUFFET' }, esImputable: true }
    })

    if (!cuentaContable) {
      cuentaContable = await prisma.cuentaContable.findFirst({
        where: { codigo: '4.1.1.01', esImputable: true }
      })
    }

    const usaPagosMultiples = pagosParciales && Array.isArray(pagosParciales) && pagosParciales.length > 0
    const movimientos = []

    if (usaPagosMultiples) {
      const totalPagos = pagosParciales.reduce((sum, pago) => sum + parseFloat(pago.monto), 0)

      if (Math.abs(totalPagos - totalFinal) > 0.01) {
        return res.status(400).json({
          success: false,
          error: `La suma de pagos (${totalPagos}) no coincide con el total (${totalFinal})`
        })
      }

      for (const pago of pagosParciales) {
        const medioPago = await prisma.medioPago.findUnique({ where: { id: parseInt(pago.medioPagoId) } })
        if (!medioPago) {
          return res.status(400).json({ success: false, error: `Medio de pago ${pago.medioPagoId} no encontrado` })
        }

        const caja = await prisma.caja.findUnique({ where: { id: parseInt(pago.cajaId || cajaId) } })
        if (!caja) {
          return res.status(400).json({ success: false, error: `Caja ${pago.cajaId || cajaId} no encontrada` })
        }

        const ultimoMov = await prisma.movimientoCaja.findFirst({ orderBy: { id: 'desc' } })
        const nuevoNumero = `MOV-${String((ultimoMov?.id || 0) + 1).padStart(8, '0')}`

        const movimiento = await prisma.movimientoCaja.create({
          data: {
            numero: nuevoNumero,
            cajaId: parseInt(pago.cajaId || cajaId),
            tipo: 'INGRESO',
            cuentaContableId: cuentaContable?.id || 1,
            centroCostoId: caja.centroCostoId,
            monto: parseFloat(pago.monto),
            concepto: `Kiosco - ${detalleItems.join(', ')} - ${medioPago.nombre}${propinaMonto > 0 ? ` + Propina` : ''}`,
            descripcion: observaciones,
            registradoPor: req.admin.id
          }
        })

        // Generar asiento contable automático
        await generarAsientoAutomatico(prisma, {
          fecha: new Date(),
          concepto: `Venta Kiosco - ${detalleItems.join(', ')} - ${medioPago.nombre}`,
          tipoOrigen: 'VENTA_KIOSCO',
          origenId: movimiento.id,
          registradoPor: req.admin.id,
          lineas: [
            {
              cuentaContableId: caja.cuentaContableId, // DEBE: Caja (aumenta activo)
              debe: parseFloat(pago.monto),
              haber: 0,
              descripcion: `Ingreso por venta kiosco`
            },
            {
              cuentaContableId: cuentaContable?.id || 1, // HABER: Ventas Kiosco (aumenta ingreso)
              debe: 0,
              haber: parseFloat(pago.monto),
              descripcion: `Venta kiosco - ${detalleItems.join(', ')}`
            }
          ]
        })

        movimientos.push(movimiento)
      }
    } else {
      const medioPago = await prisma.medioPago.findUnique({ where: { id: medioPagoId } })
      if (!medioPago) {
        return res.status(400).json({ success: false, error: 'Medio de pago no encontrado' })
      }

      const caja = await prisma.caja.findUnique({ where: { id: cajaId } })
      if (!caja) {
        return res.status(400).json({ success: false, error: 'Caja no encontrada' })
      }

      const ultimoMov = await prisma.movimientoCaja.findFirst({ orderBy: { id: 'desc' } })
      const nuevoNumero = `MOV-${String((ultimoMov?.id || 0) + 1).padStart(8, '0')}`

      const movimiento = await prisma.movimientoCaja.create({
        data: {
          numero: nuevoNumero,
          cajaId,
          tipo: 'INGRESO',
          cuentaContableId: cuentaContable?.id || 1,
          centroCostoId: caja.centroCostoId,
          monto: totalFinal,
          concepto: `Kiosco - ${detalleItems.join(', ')}${propinaMonto > 0 ? ` + Propina` : ''}`,
          descripcion: observaciones,
          registradoPor: req.admin.id
        }
      })

      // Generar asiento contable automático
      await generarAsientoAutomatico(prisma, {
        fecha: new Date(),
        concepto: `Venta Kiosco - ${detalleItems.join(', ')}`,
        tipoOrigen: 'VENTA_KIOSCO',
        origenId: movimiento.id,
        registradoPor: req.admin.id,
        lineas: [
          {
            cuentaContableId: caja.cuentaContableId, // DEBE: Caja (aumenta activo)
            debe: totalFinal,
            haber: 0,
            descripcion: `Ingreso por venta kiosco`
          },
          {
            cuentaContableId: cuentaContable?.id || 1, // HABER: Ventas Kiosco (aumenta ingreso)
            debe: 0,
            haber: totalFinal,
            descripcion: `Venta kiosco - ${detalleItems.join(', ')}`
          }
        ]
      })

      movimientos.push(movimiento)
    }

    let comprobanteFiscal = null
    let ticketBase64 = null
    let qrUrl = null

    if (emitirFactura && !esVentaInterna) {
      try {
        const { requestCAE, getLastAuthorizedNumber } = await import('../../services/afipWSFEService.js')
        const { getConfiguracionFiscal } = await import('../../services/afipWSAAService.js')
        const { generateQRData } = await import('../../services/afipQRService.js')
        const { renderTicketFiscal, toBase64 } = await import('../../services/ticketService.js')

        const config = await getConfiguracionFiscal()
        const cajaUsada = await prisma.caja.findUnique({ where: { id: cajaId || movimientos[0]?.cajaId } })
        const puntoVenta = cajaUsada?.puntoVentaAfip || 1
        const tipoAfip = tipoComprobante || 11

        const ultimoNumero = await getLastAuthorizedNumber(puntoVenta, tipoAfip)
        const numeroComprobante = ultimoNumero + 1

        const itemsFactura = productosVenta.map(item => ({
          descripcion: item.nombre,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          subtotal: item.subtotal,
          ivaRate: 21,
          ivaAmount: tipoAfip === 11 ? 0 : (item.subtotal * 21) / 121
        }))

        const subtotalNeto = tipoAfip === 11 ? totalFinal : itemsFactura.reduce((sum, i) => sum + (i.subtotal - i.ivaAmount), 0)
        const ivaTotal = tipoAfip === 11 ? 0 : itemsFactura.reduce((sum, i) => sum + i.ivaAmount, 0)

        const resultadoCAE = await requestCAE({
          puntoVenta,
          tipoComprobante: tipoAfip,
          numeroComprobante,
          fecha: new Date(),
          tipoDocCliente: datosCliente?.tipoDoc || 99,
          docCliente: datosCliente?.documento || '',
          condicionIvaCliente: datosCliente?.condicionIva || 5,
          subtotal: subtotalNeto,
          iva: ivaTotal,
          total: totalFinal,
          items: itemsFactura
        })

        const tiposNombre = { 1: 'FACTURA A', 6: 'FACTURA B', 11: 'FACTURA C' }

        comprobanteFiscal = await prisma.comprobanteElectronico.create({
          data: {
            tipo: tiposNombre[tipoAfip] || 'FACTURA C',
            tipoAfip,
            puntoVenta,
            numero: numeroComprobante,
            fecha: new Date(),
            cae: resultadoCAE.cae,
            fechaVtoCae: resultadoCAE.caeExpiration,
            cuitReceptor: datosCliente?.tipoDoc === 80 ? datosCliente.documento : null,
            nombreReceptor: datosCliente?.nombre || 'Consumidor Final',
            condicionIvaReceptor: datosCliente?.condicionIva === 1 ? 'IVA Responsable Inscripto' :
              datosCliente?.condicionIva === 6 ? 'Responsable Monotributo' : 'Consumidor Final',
            neto: subtotalNeto,
            iva21: ivaTotal,
            iva105: 0,
            total: totalFinal,
            cajaId: cajaId || movimientos[0]?.cajaId,
            emitidoPor: req.admin.id,
            estado: 'EMITIDO'
          }
        })

        qrUrl = generateQRData({
          cuit: config.cuit,
          tipoComprobante: tipoAfip,
          puntoVenta,
          numeroComprobante,
          importe: totalFinal,
          fecha: new Date(),
          tipoDocCliente: datosCliente?.tipoDoc || 99,
          docCliente: datosCliente?.documento || '',
          cae: resultadoCAE.cae
        })

        const ticketData = await renderTicketFiscal({
          empresa: { razonSocial: config.razonSocial, domicilio: config.domicilioFiscal, cuit: config.cuit, condicionIva: config.condicionIva, iibb: config.iibb || 'EXENTO', inicioActividades: config.inicioActividad ? new Date(config.inicioActividad).toLocaleDateString('es-AR') : null },
          comprobante: { tipo: tiposNombre[tipoAfip], tipoAfip, puntoVenta, numero: numeroComprobante, fecha: new Date(), cae: resultadoCAE.cae, fechaVtoCae: resultadoCAE.caeExpiration, cuit: config.cuit, nombreCliente: datosCliente?.nombre || 'Consumidor Final', subtotal: subtotalNeto, iva: ivaTotal, total: totalFinal },
          comanda: { numero: `K-${movimientos[0]?.id || Date.now()}` },
          items: itemsFactura
        })
        ticketBase64 = toBase64(ticketData)

        console.log(`[Kiosco] Factura emitida: ${tiposNombre[tipoAfip]} ${puntoVenta}-${numeroComprobante}`)
      } catch (facError) {
        console.error('Error emitiendo factura kiosco:', facError)
      }
    } else {
      try {
        const { renderTicketNoFiscal, toBase64 } = await import('../../services/ticketService.js')

        const ticketData = renderTicketNoFiscal({
          empresa: { razonSocial: 'CLUB SPORTIVO PILAR' },
          comanda: { numero: `K-${movimientos[0]?.id || Date.now()}`, origen: 'KIOSCO', metodoPago: 'VARIOS', total: totalFinal },
          items: productosVenta
        })
        ticketBase64 = toBase64(ticketData)
      } catch (ticketError) {
        console.error('Error generando ticket kiosco:', ticketError)
      }
    }

    // Integración contable
    let movimientoContableVenta = null
    let movimientoContableCobro = null

    if (emitirFactura || esVentaInterna) {
      try {
        const discriminaIva = comprobanteFiscal?.tipoAfip === 1
        const subtotalNeto = discriminaIva
          ? parseFloat(comprobanteFiscal?.neto || (totalFinal / 1.21))
          : totalFinal
        const ivaTotal = discriminaIva
          ? parseFloat(comprobanteFiscal?.iva21 || (totalFinal - subtotalNeto))
          : 0

        const tipoComprobanteNombre = comprobanteFiscal?.tipo || (esVentaInterna ? 'VENTA INTERNA' : 'TICKET')

        const cajaUsadaId = cajaId || movimientos[0]?.cajaId
        const cajaUsada = await prisma.caja.findUnique({
          where: { id: cajaUsadaId },
          include: { cuentaContable: true }
        })

        const medioPagoUsado = await prisma.medioPago.findUnique({
          where: { id: medioPagoId || pagosParciales?.[0]?.medioPagoId }
        })

        const numeroMCVenta = await generarNumeroMC()
        movimientoContableVenta = await prisma.movimientoContable.create({
          data: {
            numero: numeroMCVenta,
            tipo: 'FACTURA_VENTA',
            socioId: tipoCliente === 'SOCIO' && clienteId ? parseInt(clienteId) : (socioId ? parseInt(socioId) : null),
            entidadId: tipoCliente === 'ENTIDAD' && clienteId ? parseInt(clienteId) : null,
            fecha: new Date(),
            tipoComprobante: tipoComprobanteNombre,
            puntoVenta: comprobanteFiscal ? String(comprobanteFiscal.puntoVenta).padStart(4, '0') : null,
            numeroComprobante: comprobanteFiscal ? String(comprobanteFiscal.numero).padStart(8, '0') : null,
            subtotal: subtotalNeto,
            iva21: ivaTotal,
            iva105: 0,
            montoTotal: totalFinal,
            montoPagado: totalFinal,
            saldoPendiente: 0,
            estado: 'PAGADO',
            cajaId: cajaUsadaId,
            medioPago: medioPagoUsado?.nombre || 'VARIOS',
            centroCostoId: caja.centroCostoId,
            registradoPor: req.admin.id,
            observaciones: `Venta Kiosco - ${detalleItems.join(', ')}`
          },
          include: {
            socio: { select: { id: true, apellidoNombre: true } },
            entidad: { select: { id: true, razonSocial: true } }
          }
        })

        await generarAsientoFacturaVenta(prisma, {
          factura: {
            id: movimientoContableVenta.id,
            numero: numeroMCVenta,
            fecha: new Date(),
            tipoComprobante: tipoComprobanteNombre,
            puntoVenta: comprobanteFiscal?.puntoVenta,
            numeroComprobante: comprobanteFiscal?.numero,
            subtotal: subtotalNeto,
            iva21: ivaTotal,
            iva105: 0,
            montoTotal: totalFinal,
            centroCostoId: caja.centroCostoId,
            socio: movimientoContableVenta.socio,
            entidad: movimientoContableVenta.entidad
          },
          concepto: null,
          registradoPor: req.admin.id
        })

        const numeroMCCobro = await generarNumeroMC()
        movimientoContableCobro = await prisma.movimientoContable.create({
          data: {
            numero: numeroMCCobro,
            tipo: 'RECIBO_COBRO',
            socioId: tipoCliente === 'SOCIO' && clienteId ? parseInt(clienteId) : (socioId ? parseInt(socioId) : null),
            entidadId: tipoCliente === 'ENTIDAD' && clienteId ? parseInt(clienteId) : null,
            fecha: new Date(),
            tipoComprobante: 'RECIBO',
            movimientoPadreId: movimientoContableVenta.id,
            montoTotal: totalFinal,
            montoPagado: totalFinal,
            saldoPendiente: 0,
            estado: 'CONFIRMADO',
            cajaId: cajaUsadaId,
            medioPago: medioPagoUsado?.nombre || 'VARIOS',
            centroCostoId: caja.centroCostoId,
            registradoPor: req.admin.id,
            observaciones: `Cobro Venta Kiosco`
          }
        })

        await generarAsientoReciboCobro(prisma, {
          recibo: {
            id: movimientoContableCobro.id,
            numero: numeroMCCobro,
            fecha: new Date(),
            montoTotal: totalFinal,
            centroCostoId: caja.centroCostoId,
            socio: movimientoContableVenta.socio,
            entidad: movimientoContableVenta.entidad
          },
          caja: cajaUsada,
          registradoPor: req.admin.id
        })

        for (const mov of movimientos) {
          await prisma.movimientoCaja.update({
            where: { id: mov.id },
            data: { movimientoContableId: movimientoContableCobro.id }
          })
        }

        if (comprobanteFiscal) {
          await prisma.comprobanteElectronico.update({
            where: { id: comprobanteFiscal.id },
            data: { movimientoContableId: movimientoContableVenta.id }
          })
        }

        console.log(`[Kiosco] Integración con Ingresos completada`)
      } catch (mcError) {
        console.error('Error creando MovimientoContable/Asientos Kiosco:', mcError)
      }
    }

    res.json({
      success: true,
      data: {
        movimientos,
        total: totalFinal,
        items: detalleItems,
        propinaAplicada: propinaMonto > 0 ? propinaMonto : null,
        comprobante: comprobanteFiscal,
        ticket: ticketBase64,
        qrUrl
      }
    })
  } catch (error) {
    console.error('Error en venta kiosco:', error)
    res.status(500).json({ success: false, error: 'Error en venta kiosco' })
  }
})

export default router
