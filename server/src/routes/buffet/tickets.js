/**
 * Rutas de Tickets del Buffet
 * - Regenerar tickets de ventas
 * - Menú público
 */
import express from 'express'
import prisma from '../../lib/prisma.js'
import { authAdmin, checkPermiso } from '../../middleware/auth.js'

const router = express.Router()

/**
 * POST /regenerar-ticket/:tipo/:id
 * Regenerar ticket de venta
 */
router.post('/regenerar-ticket/:tipo/:id', authAdmin, checkPermiso('BUFFET_COBRAR', 'BUFFET_KIOSCO'), async (req, res) => {
  try {
    const { tipo, id } = req.params
    const { tipoTicket } = req.body

    const { generateQRData } = await import('../../services/afipQRService.js')

    let responseData = {}

    if (tipo === 'comanda') {
      const comanda = await prisma.comanda.findUnique({
        where: { id: parseInt(id) },
        include: {
          mesa: true,
          socio: { select: { nombre: true, apellido: true, nroSocio: true } },
          items: {
            where: { estado: { not: 'ANULADO' } },
            include: { productoBuffet: { select: { nombre: true } } }
          },
          atendedor: { select: { nombre: true, apellido: true } }
        }
      })

      if (!comanda) {
        return res.status(404).json({ success: false, error: 'Comanda no encontrada' })
      }

      const itemsFormateados = comanda.items.map(item => ({
        nombre: item.productoBuffet?.nombre || item.nombre || 'Producto',
        cantidad: item.cantidad,
        precio: parseFloat(item.precioUnitario),
        precioUnitario: parseFloat(item.precioUnitario),
        subtotal: parseFloat(item.subtotal)
      }))

      if (tipoTicket === 'cuenta') {
        responseData = {
          comanda: {
            id: comanda.id,
            numero: comanda.numero,
            mesa: comanda.mesa,
            createdAt: comanda.createdAt,
            subtotal: Number(comanda.subtotal),
            total: Number(comanda.total),
            mozo: comanda.atendedor ? `${comanda.atendedor.nombre} ${comanda.atendedor.apellido || ''}`.trim() : null
          },
          items: itemsFormateados,
          descuento: comanda.descuento > 0 ? { monto: Number(comanda.descuento) } : null,
          socio: comanda.socio
        }
      } else {
        const comprobante = await prisma.comprobanteElectronico.findFirst({
          where: { comandaId: parseInt(id) }
        })

        if (comprobante) {
          const { getConfiguracionFiscal } = await import('../../services/afipWSAAService.js')
          const config = await getConfiguracionFiscal()

          const qrUrl = generateQRData({
            cuit: config.cuit,
            tipoComprobante: comprobante.tipoAfip,
            puntoVenta: comprobante.puntoVenta,
            numeroComprobante: comprobante.numero,
            importe: Number(comprobante.total),
            fecha: new Date(comprobante.fecha),
            tipoDocCliente: 99,
            docCliente: comprobante.cuitReceptor || '',
            cae: comprobante.cae
          })

          responseData = {
            comprobante: {
              tipo: comprobante.tipo,
              tipoAfip: comprobante.tipoAfip,
              puntoVenta: comprobante.puntoVenta,
              numero: comprobante.numero,
              fecha: comprobante.fecha,
              cae: comprobante.cae,
              fechaVtoCae: comprobante.fechaVtoCae,
              nombreReceptor: comprobante.nombreReceptor || 'Consumidor Final',
              neto: Number(comprobante.neto),
              iva: Number(comprobante.iva21),
              total: Number(comprobante.total)
            },
            items: itemsFormateados,
            qrUrl,
            empresa: {
              razonSocial: config.razonSocial,
              domicilio: config.domicilioFiscal,
              cuit: config.cuit,
              condicionIva: config.condicionIva,
              iibb: 'EXENTO'
            },
            medioPago: 'VARIOS'
          }
        } else {
          responseData = {
            comanda: {
              numero: comanda.numero,
              mesa: comanda.mesa,
              total: Number(comanda.total)
            },
            items: itemsFormateados,
            medioPago: 'VARIOS'
          }
        }
      }
    } else if (tipo === 'takeaway') {
      const pedido = await prisma.pedidoTakeAway.findUnique({
        where: { id: parseInt(id) },
        include: {
          items: {
            include: { productoBuffet: { select: { nombre: true } } }
          }
        }
      })

      if (!pedido) {
        return res.status(404).json({ success: false, error: 'Pedido no encontrado' })
      }

      const itemsFormateados = pedido.items.map(item => ({
        nombre: item.productoBuffet?.nombre || 'Producto',
        cantidad: item.cantidad,
        precio: parseFloat(item.precioUnitario),
        precioUnitario: parseFloat(item.precioUnitario),
        subtotal: parseFloat(item.subtotal)
      }))

      const comprobante = await prisma.comprobanteElectronico.findFirst({
        where: { pedidoTakeawayId: parseInt(id) }
      })

      if (comprobante) {
        const { getConfiguracionFiscal } = await import('../../services/afipWSAAService.js')
        const config = await getConfiguracionFiscal()

        const qrUrl = generateQRData({
          cuit: config.cuit,
          tipoComprobante: comprobante.tipoAfip,
          puntoVenta: comprobante.puntoVenta,
          numeroComprobante: comprobante.numero,
          importe: Number(comprobante.total),
          fecha: new Date(comprobante.fecha),
          tipoDocCliente: 99,
          docCliente: comprobante.cuitReceptor || '',
          cae: comprobante.cae
        })

        responseData = {
          comprobante: {
            tipo: comprobante.tipo,
            tipoAfip: comprobante.tipoAfip,
            puntoVenta: comprobante.puntoVenta,
            numero: comprobante.numero,
            fecha: comprobante.fecha,
            cae: comprobante.cae,
            fechaVtoCae: comprobante.fechaVtoCae,
            nombreReceptor: comprobante.nombreReceptor || 'Consumidor Final',
            neto: Number(comprobante.neto),
            iva: Number(comprobante.iva21),
            total: Number(comprobante.total)
          },
          items: itemsFormateados,
          qrUrl,
          empresa: {
            razonSocial: config.razonSocial,
            domicilio: config.domicilioFiscal,
            cuit: config.cuit,
            condicionIva: config.condicionIva,
            iibb: 'EXENTO'
          },
          medioPago: 'VARIOS'
        }
      } else {
        responseData = {
          comanda: {
            numero: pedido.numero,
            total: Number(pedido.total)
          },
          items: itemsFormateados,
          medioPago: 'VARIOS'
        }
      }
    } else {
      return res.status(400).json({ success: false, error: 'Tipo de venta inválido' })
    }

    res.json({ success: true, data: responseData })
  } catch (error) {
    console.error('Error regenerando ticket:', error)
    res.status(500).json({ success: false, error: 'Error al regenerar ticket' })
  }
})

/**
 * GET /menu-publico
 * Menú público (sin autenticación)
 */
router.get('/menu-publico', async (req, res) => {
  try {
    const categorias = await prisma.categoriaMenu.findMany({
      where: { activo: true },
      orderBy: { orden: 'asc' },
      include: {
        productos: {
          where: { activo: true, disponible: true },
          orderBy: { orden: 'asc' },
          select: {
            id: true,
            nombre: true,
            descripcion: true,
            precio: true,
            imagen: true,
            destacado: true
          }
        }
      }
    })

    res.json({ success: true, data: categorias })
  } catch (error) {
    console.error('Error al obtener menú público:', error)
    res.status(500).json({ success: false, error: 'Error al obtener menú' })
  }
})

export default router
