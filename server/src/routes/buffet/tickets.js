/**
 * Rutas de Tickets del Buffet
 * - Regenerar tickets de ventas
 * - Menú público
 */
import express from 'express'
import prisma from '../../lib/prisma.js'
import { authAdmin, checkPermiso } from '../../middleware/auth.js'
import { generarTicketFiscal, generarTicketCuenta } from '../../services/thermalPrinter.js'
import { enviarImpresion } from './impresoras.js'

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
 * GET /preview-ticket/:tipo/:id
 * Preview de ticket sin imprimir
 */
router.get('/preview-ticket/:tipo/:id', authAdmin, checkPermiso('BUFFET_COBRAR', 'BUFFET_KIOSCO'), async (req, res) => {
  try {
    const { tipo, id } = req.params
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
        descripcion: item.productoBuffet?.nombre || item.nombre || 'Producto',
        cantidad: item.cantidad,
        precio: parseFloat(item.precioUnitario),
        precioUnitario: parseFloat(item.precioUnitario),
        subtotal: parseFloat(item.subtotal)
      }))

      const comprobante = await prisma.comprobanteElectronico.findFirst({
        where: { comandaId: parseInt(id) }
      })

      // Si hay comprobante fiscal, obtener datos de empresa y QR
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
          tipoDocCliente: comprobante.tipoDocReceptor || 99,
          docCliente: comprobante.cuitReceptor || '',
          cae: comprobante.cae
        })

        responseData = {
          comanda: {
            id: comanda.id,
            numero: comanda.numero,
            mesa: comanda.mesa,
            total: Number(comanda.total)
          },
          items: itemsFormateados,
          comprobante: {
            tipo: comprobante.tipo,
            tipoAfip: comprobante.tipoAfip,
            puntoVenta: comprobante.puntoVenta,
            numero: comprobante.numero,
            fecha: comprobante.fecha,
            cae: comprobante.cae,
            fechaVtoCae: comprobante.fechaVtoCae,
            nombreReceptor: comprobante.nombreReceptor || 'Consumidor Final',
            tipoDocReceptor: comprobante.tipoDocReceptor || 99,
            docReceptor: comprobante.cuitReceptor,
            condicionIvaReceptor: comprobante.condicionIvaReceptor || 5,
            neto: Number(comprobante.neto),
            iva: Number(comprobante.iva21 || 0),
            total: Number(comprobante.total)
          },
          qrUrl,
          empresa: {
            razonSocial: config.razonSocial,
            domicilio: config.domicilioFiscal,
            cuit: config.cuit,
            condicionIva: config.condicionIva,
            iibb: 'EXENTO',
            inicioActividades: config.inicioActividades
          },
          medioPago: comanda.metodoPago || 'VARIOS'
        }
      } else {
        responseData = {
          comanda: {
            id: comanda.id,
            numero: comanda.numero,
            mesa: comanda.mesa,
            total: Number(comanda.total)
          },
          items: itemsFormateados,
          comprobante: null,
          medioPago: comanda.metodoPago || 'VARIOS'
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
        descripcion: item.productoBuffet?.nombre || 'Producto',
        cantidad: item.cantidad,
        precio: parseFloat(item.precioUnitario),
        precioUnitario: parseFloat(item.precioUnitario),
        subtotal: parseFloat(item.subtotal)
      }))

      const comprobante = await prisma.comprobanteElectronico.findFirst({
        where: { pedidoTakeawayId: parseInt(id) }
      })

      // Si hay comprobante fiscal, obtener datos de empresa y QR
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
          tipoDocCliente: comprobante.tipoDocReceptor || 99,
          docCliente: comprobante.cuitReceptor || '',
          cae: comprobante.cae
        })

        responseData = {
          pedido: {
            id: pedido.id,
            numero: pedido.numero,
            nombreCliente: pedido.nombreCliente,
            total: Number(pedido.total)
          },
          items: itemsFormateados,
          comprobante: {
            tipo: comprobante.tipo,
            tipoAfip: comprobante.tipoAfip,
            puntoVenta: comprobante.puntoVenta,
            numero: comprobante.numero,
            fecha: comprobante.fecha,
            cae: comprobante.cae,
            fechaVtoCae: comprobante.fechaVtoCae,
            nombreReceptor: comprobante.nombreReceptor || 'Consumidor Final',
            tipoDocReceptor: comprobante.tipoDocReceptor || 99,
            docReceptor: comprobante.cuitReceptor,
            condicionIvaReceptor: comprobante.condicionIvaReceptor || 5,
            neto: Number(comprobante.neto),
            iva: Number(comprobante.iva21 || 0),
            total: Number(comprobante.total)
          },
          qrUrl,
          empresa: {
            razonSocial: config.razonSocial,
            domicilio: config.domicilioFiscal,
            cuit: config.cuit,
            condicionIva: config.condicionIva,
            iibb: 'EXENTO',
            inicioActividades: config.inicioActividades
          },
          medioPago: pedido.metodoPago || 'VARIOS'
        }
      } else {
        responseData = {
          pedido: {
            id: pedido.id,
            numero: pedido.numero,
            nombreCliente: pedido.nombreCliente,
            total: Number(pedido.total)
          },
          items: itemsFormateados,
          comprobante: null,
          medioPago: pedido.metodoPago || 'VARIOS'
        }
      }
    } else {
      return res.status(400).json({ success: false, error: 'Tipo de venta inválido' })
    }

    res.json({ success: true, ...responseData })
  } catch (error) {
    console.error('Error obteniendo preview de ticket:', error)
    res.status(500).json({ success: false, error: 'Error al obtener preview' })
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
      select: {
        id: true,
        codigo: true,
        nombre: true,
        descripcion: true,
        color: true,
        icono: true,
        productos: {
          where: {
            activo: true,
            disponible: true,
            tiposVenta: { has: 'BUFFET' }
          },
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

    // Filtrar categorías que no tienen productos
    const categoriasConProductos = categorias.filter(c => c.productos.length > 0)

    res.json({ success: true, data: categoriasConProductos })
  } catch (error) {
    console.error('Error al obtener menú público:', error)
    res.status(500).json({ success: false, error: 'Error al obtener menú' })
  }
})

/**
 * GET /config-impresoras
 * Obtiene la configuración de impresoras para tickets
 */
router.get('/config-impresoras', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const configs = await prisma.configuracion.findMany({
      where: {
        clave: {
          in: ['BUFFET_IMPRESORA_TICKETS', 'BUFFET_IMPRESORA_KIOSCO', 'BUFFET_IMPRESORA_TAKEAWAY']
        }
      }
    })

    const impresoras = await prisma.impresoraTermica.findMany({
      where: { activo: true },
      include: { sector: true },
      orderBy: { nombre: 'asc' }
    })

    const configMap = {}
    configs.forEach(c => {
      configMap[c.clave] = c.valor ? parseInt(c.valor) : null
    })

    res.json({
      success: true,
      data: {
        impresoras,
        config: {
          tickets: configMap['BUFFET_IMPRESORA_TICKETS'] || null,
          kiosco: configMap['BUFFET_IMPRESORA_KIOSCO'] || null,
          takeaway: configMap['BUFFET_IMPRESORA_TAKEAWAY'] || null
        }
      }
    })
  } catch (error) {
    console.error('Error obteniendo config impresoras:', error)
    res.status(500).json({ success: false, error: 'Error al obtener configuración' })
  }
})

/**
 * PUT /config-impresoras
 * Guarda la configuración de impresoras para tickets
 */
router.put('/config-impresoras', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { tickets, kiosco, takeaway } = req.body

    const configs = [
      { clave: 'BUFFET_IMPRESORA_TICKETS', valor: tickets?.toString() || '', desc: 'Impresora para tickets de cobro' },
      { clave: 'BUFFET_IMPRESORA_KIOSCO', valor: kiosco?.toString() || '', desc: 'Impresora para tickets de kiosco' },
      { clave: 'BUFFET_IMPRESORA_TAKEAWAY', valor: takeaway?.toString() || '', desc: 'Impresora para tickets de take away' }
    ]

    for (const cfg of configs) {
      await prisma.configuracion.upsert({
        where: { clave: cfg.clave },
        update: { valor: cfg.valor },
        create: {
          clave: cfg.clave,
          valor: cfg.valor,
          descripcion: cfg.desc,
          modulo: 'BUFFET',
          tipo: 'NUMBER'
        }
      })
    }

    res.json({ success: true, message: 'Configuración guardada' })
  } catch (error) {
    console.error('Error guardando config impresoras:', error)
    res.status(500).json({ success: false, error: 'Error al guardar configuración' })
  }
})

/**
 * POST /imprimir-ticket
 * Imprime un ticket directamente a la impresora térmica
 * Body: { ticket: {...}, impresoraId?: number, tipoTicket?: string }
 */
router.post('/imprimir-ticket', authAdmin, checkPermiso('BUFFET_COBRAR'), async (req, res) => {
  try {
    const { ticket, impresoraId, tipoTicket } = req.body

    if (!ticket) {
      return res.status(400).json({ success: false, error: 'Ticket requerido' })
    }

    // Buscar impresora según configuración
    let impresora = null

    if (impresoraId) {
      impresora = await prisma.impresoraTermica.findUnique({
        where: { id: parseInt(impresoraId) }
      })
    } else {
      // Buscar en configuración según tipo de ticket (del parámetro o del ticket.tipo)
      const tipo = tipoTicket || ticket.tipo
      let configKey = 'BUFFET_IMPRESORA_TICKETS'
      if (tipo === 'KIOSCO') {
        configKey = 'BUFFET_IMPRESORA_KIOSCO'
      } else if (tipo === 'TAKEAWAY') {
        configKey = 'BUFFET_IMPRESORA_TAKEAWAY'
      }

      const config = await prisma.configuracion.findUnique({
        where: { clave: configKey }
      })

      if (config?.valor) {
        impresora = await prisma.impresoraTermica.findUnique({
          where: { id: parseInt(config.valor) }
        })
      }

      // Fallback: buscar impresora por sector o sin sector
      if (!impresora) {
        impresora = await prisma.impresoraTermica.findFirst({
          where: {
            activo: true,
            OR: [
              { sector: { codigo: 'CAJA' } },
              { sector: { codigo: 'TICKET' } },
              { sectorId: null }
            ]
          },
          include: { sector: true }
        })
      }
    }

    if (!impresora) {
      return res.status(400).json({
        success: false,
        error: 'No hay impresora de tickets configurada. Ve a Configuración > Impresoras de Tickets'
      })
    }

    // Generar comandos ESC/POS según tipo de ticket
    let ticketData

    console.log('[Ticket] Tipo:', ticket.tipo, 'CAE:', ticket.comprobante?.cae)

    if (ticket.tipo === 'FISCAL') {
      console.log('[Ticket] Generando ticket FISCAL con QR')
      ticketData = await generarTicketFiscal(ticket)
    } else {
      console.log('[Ticket] Generando ticket NO fiscal')
      ticketData = await generarTicketCuenta(ticket)
    }

    // Convertir a base64 para enviar al print-agent
    const ticketBase64 = Buffer.from(ticketData, 'binary').toString('base64')

    // Enviar a impresora
    const resultado = await enviarImpresion(impresora.id, ticketBase64, ticket.tipo || 'TICKET')

    if (resultado.success) {
      res.json({
        success: true,
        message: 'Ticket enviado a impresora',
        impresora: impresora.nombre,
        trabajoId: resultado.trabajoId
      })
    } else {
      res.status(400).json({ success: false, error: resultado.error })
    }
  } catch (error) {
    console.error('Error imprimiendo ticket:', error)
    res.status(500).json({ success: false, error: 'Error al imprimir ticket' })
  }
})

export default router
