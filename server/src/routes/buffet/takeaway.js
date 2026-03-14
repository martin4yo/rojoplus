/**
 * Rutas de Pedidos Take Away del Buffet
 * - CRUD de pedidos para llevar
 * - Gestión de items
 * - Facturación y cobro
 */
import express from 'express'
import prisma from '../../lib/prisma.js'
import { authAdmin, checkPermiso } from '../../middleware/auth.js'
import { generarAsientoAutomatico } from '../asientos.js'
import {
  generarAsientoFacturaVenta,
  generarAsientoReciboCobro
} from '../../services/asientosContables.js'
import {
  generarNumeroPedido,
  generarNumeroMC,
  recalcularTotalesPedido
} from './helpers.js'
import { enviarImpresion } from './impresoras.js'

const router = express.Router()

// ============================================================================
// FUNCIONES DE IMPRESIÓN PARA TAKEAWAY
// ============================================================================

/**
 * Genera comandos ESC/POS para imprimir comanda de TakeAway
 * Usa el mismo formato que las comandas del Buffet
 */
function generarComandaTakeAwayESCPOS(pedido, items, sectorNombre = 'TAKE AWAY') {
  const ESC = 0x1B
  const GS = 0x1D
  const buffer = []
  const LINEA = '='.repeat(48)
  const LINEA_DASH = '-'.repeat(48)

  // Inicializar
  buffer.push(ESC, 0x40)

  // Título centrado con nombre del sector
  buffer.push(ESC, 0x61, 0x01) // Centrar
  buffer.push(ESC, 0x45, 0x01) // Negrita
  buffer.push(...Buffer.from(`*** ${sectorNombre.toUpperCase()} ***\n`))
  buffer.push(ESC, 0x45, 0x00) // Fin negrita

  buffer.push(...Buffer.from(`${LINEA}\n`))

  // Número de pedido - GRANDE Y DESTACADO
  buffer.push(GS, 0x21, 0x11) // Doble tamaño (alto y ancho)
  buffer.push(ESC, 0x45, 0x01) // Negrita
  buffer.push(...Buffer.from(`PEDIDO #${pedido.numero}\n`))
  buffer.push(GS, 0x21, 0x00) // Tamaño normal
  buffer.push(ESC, 0x45, 0x00) // Fin negrita

  // Nombre del cliente - DESTACADO
  const nombreCliente = pedido.socio?.apellidoNombre || pedido.nombreCliente || null
  if (nombreCliente) {
    buffer.push(ESC, 0x45, 0x01) // Negrita
    buffer.push(...Buffer.from(`${nombreCliente}\n`))
    buffer.push(ESC, 0x45, 0x00)
  }

  buffer.push(...Buffer.from(`Hora: ${new Date().toLocaleTimeString('es-AR')}\n`))
  buffer.push(...Buffer.from(`${LINEA_DASH}\n`))

  // Alinear a la izquierda
  buffer.push(ESC, 0x61, 0x00)

  // Items - SIN negrita (igual que buffet)
  for (const item of items) {
    const nombre = item.productoBuffet?.nombre || 'Producto'
    const cantidad = item.cantidad || 1
    buffer.push(...Buffer.from(`${cantidad}x ${nombre.toUpperCase()}\n`))

    // Mostrar opciones seleccionadas
    if (item.opcionesSeleccionadas && item.opcionesSeleccionadas.length > 0) {
      for (const opSel of item.opcionesSeleccionadas) {
        // Usar nombre del producto referenciado si existe, sino el nombre de la opción
        const opcionNombre = opSel.opcion?.productoRef?.nombre || opSel.opcion?.nombre || 'Opción'
        const cantOp = opSel.cantidad > 1 ? `${opSel.cantidad}x ` : ''
        buffer.push(...Buffer.from(`   + ${cantOp}${opcionNombre.toUpperCase()}\n`))
      }
    }

    // Mostrar opciones removidas (ingredientes que vienen por defecto y se quitaron)
    if (item.opcionesRemovidas) {
      try {
        const removidas = typeof item.opcionesRemovidas === 'string'
          ? JSON.parse(item.opcionesRemovidas)
          : item.opcionesRemovidas
        if (Array.isArray(removidas)) {
          for (const removida of removidas) {
            const nombreRemovido = removida.nombre || 'Ingrediente'
            buffer.push(...Buffer.from(`   - SIN ${nombreRemovido.toUpperCase()}\n`))
          }
        }
      } catch (e) {
        console.error('Error parseando opcionesRemovidas:', e)
      }
    }

    if (item.observaciones) {
      buffer.push(...Buffer.from(`   >> ${item.observaciones}\n`))
    }
  }

  // Línea final
  buffer.push(...Buffer.from(`${LINEA}\n`))

  // Avance de papel (6 líneas) antes de corte para fácil manipulación
  buffer.push(...Buffer.from('\n\n\n\n\n\n'))
  buffer.push(GS, 0x56, 0x00) // Corte

  return Buffer.from(buffer)
}

/**
 * Imprime comanda de TakeAway en los destinos correspondientes
 */
async function imprimirComandaTakeAway(pedido, items) {
  try {
    console.log(`[Print TakeAway] Iniciando impresión. Items: ${items.length}`)

    // Agrupar items por destino de impresión
    const itemsPorDestino = new Map()

    for (const item of items) {
      const producto = item.productoBuffet
      if (!producto?.categoriaMenuId) continue

      const destino = await prisma.destinoImpresion.findFirst({
        where: { categoriaMenuId: producto.categoriaMenuId },
        include: {
          impresora: {
            include: { sector: true }
          }
        }
      })

      if (!destino || !destino.impresora) continue

      const impresoraId = destino.impresora.id
      if (!itemsPorDestino.has(impresoraId)) {
        itemsPorDestino.set(impresoraId, {
          impresora: destino.impresora,
          sectorNombre: destino.impresora.sector?.nombre || destino.impresora.nombre || 'TAKE AWAY',
          items: []
        })
      }
      itemsPorDestino.get(impresoraId).items.push(item)
    }

    console.log(`[Print TakeAway] Impresoras a usar: ${itemsPorDestino.size}`)

    // Imprimir en cada destino
    for (const [impresoraId, data] of itemsPorDestino) {
      console.log(`[Print TakeAway] Enviando a impresora ${data.impresora.nombre} (sector: ${data.sectorNombre})`)
      const ticketData = generarComandaTakeAwayESCPOS(pedido, data.items, data.sectorNombre)
      const base64Data = ticketData.toString('base64')
      const resultado = await enviarImpresion(impresoraId, base64Data, 'COMANDA_TAKEAWAY')
      console.log(`[Print TakeAway] Resultado: ${JSON.stringify(resultado)}`)
    }
  } catch (error) {
    console.error('[Print TakeAway] Error:', error)
  }
}

// ============================================================================
// PEDIDOS TAKE AWAY - Listado y CRUD
// ============================================================================

/**
 * GET /takeaway
 * Listar pedidos take away
 */
router.get('/takeaway', authAdmin, checkPermiso('BUFFET_VER'), async (req, res) => {
  try {
    const { estado, fecha } = req.query

    const where = {
      // Excluir pedidos de BARRA (solo mostrar TakeAway reales)
      NOT: {
        tipoVenta: 'BARRA'
      }
    }
    if (estado) where.estado = estado
    if (fecha) {
      const fechaInicio = new Date(fecha)
      fechaInicio.setHours(0, 0, 0, 0)
      const fechaFin = new Date(fecha)
      fechaFin.setHours(23, 59, 59, 999)
      where.horaRecibido = { gte: fechaInicio, lte: fechaFin }
    }

    const pedidos = await prisma.pedidoTakeAway.findMany({
      where,
      orderBy: { horaRecibido: 'desc' },
      include: {
        socio: { select: { id: true, nroSocio: true, apellidoNombre: true } },
        items: { include: { productoBuffet: true } },
        atendedor: { select: { id: true, nombre: true } }
      }
    })

    // Filtrar pedidos vacíos de barra que no están pagados/entregados
    const pedidosFiltrados = pedidos.filter(p => {
      const esVentaBarra = p.nombreCliente?.includes('Venta Barra') ||
                          p.observaciones?.toLowerCase().includes('venta rápida en barra')
      const tieneItems = p.items && p.items.length > 0
      const estaCerrado = ['PAGADO', 'ENTREGADO', 'CANCELADO'].includes(p.estado)

      // Excluir pedidos de barra vacíos que no están cerrados
      if (esVentaBarra && !tieneItems && !estaCerrado) {
        return false
      }

      return true
    })

    res.json({ success: true, data: pedidosFiltrados })
  } catch (error) {
    console.error('Error al listar pedidos:', error)
    res.status(500).json({ success: false, error: 'Error al listar pedidos' })
  }
})

/**
 * GET /takeaway/:id
 * Obtener pedido por ID
 */
router.get('/takeaway/:id', authAdmin, checkPermiso('BUFFET_VER'), async (req, res) => {
  try {
    const { id } = req.params

    const pedido = await prisma.pedidoTakeAway.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          include: {
            productoBuffet: { include: { categoriaMenu: true } },
            opcionesSeleccionadas: {
              include: { opcion: true }
            }
          }
        },
        socio: {
          select: {
            id: true,
            nroSocio: true,
            apellido: true,
            nombre: true,
            apellidoNombre: true
          }
        },
        centroCosto: true
      }
    })

    if (!pedido) {
      return res.status(404).json({ success: false, error: 'Pedido no encontrado' })
    }

    // Recalcular estado según items si está EN_PREPARACION
    if (pedido.estado === 'EN_PREPARACION' && pedido.items.length > 0) {
      const todosProcesados = pedido.items.every(item =>
        ['LISTO', 'ENTREGADO', 'ANULADO'].includes(item.estado)
      )

      if (todosProcesados) {
        await prisma.pedidoTakeAway.update({
          where: { id: pedido.id },
          data: { estado: 'LISTO', horaListo: new Date() }
        })
        pedido.estado = 'LISTO'
        pedido.horaListo = new Date()
      }
    }

    res.json({ success: true, data: pedido })
  } catch (error) {
    console.error('Error al obtener pedido:', error)
    res.status(500).json({ success: false, error: 'Error al obtener pedido' })
  }
})

/**
 * POST /takeaway
 * Crear pedido take away
 */
router.post('/takeaway', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { nombreCliente, telefono, socioId, horaEstimada, observaciones, items, tipo, centroCostoId } = req.body

    // Validar campo requerido
    const nombreClienteFinal = nombreCliente || 'Sin nombre'

    const numero = await generarNumeroPedido()

    const pedido = await prisma.pedidoTakeAway.create({
      data: {
        numero,
        nombreCliente: nombreClienteFinal,
        telefono: telefono || null,
        socioId: socioId ? parseInt(socioId) : null,
        tipo: tipo || 'RETIRO',
        centroCostoId: centroCostoId ? parseInt(centroCostoId) : null,
        horaEstimada: horaEstimada ? new Date(horaEstimada) : null,
        observaciones: observaciones || null,
        atendidoPor: req.admin.id
      }
    })

    if (items && items.length > 0) {
      for (const item of items) {
        const producto = await req.db.productoBuffet.findUnique({ where: { id: item.productoBuffetId } })
        if (!producto) continue

        await prisma.itemPedidoTakeAway.create({
          data: {
            pedidoId: pedido.id,
            productoBuffetId: item.productoBuffetId,
            cantidad: item.cantidad || 1,
            precioUnitario: producto.precio,
            subtotal: Number(producto.precio) * (item.cantidad || 1),
            observaciones: item.observaciones
          }
        })
      }

      await recalcularTotalesPedido(pedido.id)
    }

    const pedidoCompleto = await prisma.pedidoTakeAway.findUnique({
      where: { id: pedido.id },
      include: { items: { include: { productoBuffet: true } } }
    })

    res.status(201).json({ success: true, data: pedidoCompleto })
  } catch (error) {
    console.error('Error al crear pedido:', error.message, error.stack)
    res.status(500).json({ success: false, error: error.message || 'Error al crear pedido' })
  }
})

// ============================================================================
// ITEMS DE PEDIDO TAKE AWAY
// ============================================================================

/**
 * POST /takeaway/:id/items
 * Agregar items a pedido take away
 */
router.post('/takeaway/:id/items', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { id } = req.params
    const { items } = req.body

    const pedido = await prisma.pedidoTakeAway.findUnique({ where: { id: parseInt(id) } })
    if (!pedido) {
      return res.status(404).json({ success: false, error: 'Pedido no encontrado' })
    }

    if (pedido.estado === 'PAGADO' || pedido.estado === 'ENTREGADO' || pedido.estado === 'CANCELADO') {
      return res.status(400).json({ success: false, error: 'No se pueden agregar items a este pedido' })
    }

    const itemsCreados = []

    for (const item of items) {
      const producto = await req.db.productoBuffet.findUnique({
        where: { id: item.productoBuffetId },
        include: { categoriaMenu: true }
      })
      if (!producto) continue

      let estadoInicial = 'PENDIENTE'
      if (producto.categoriaMenuId) {
        const destino = await prisma.destinoImpresion.findFirst({
          where: { categoriaMenuId: producto.categoriaMenuId },
          include: { impresora: { include: { sector: true } } }
        })

        if (destino && destino.impresora) {
          const codigoSector = destino.impresora.sector?.codigo
          if (codigoSector === 'COCINA') {
            estadoInicial = 'ENVIADO_COCINA'
          } else if (codigoSector === 'BARRA') {
            estadoInicial = 'ENVIADO_BARRA'
          }
        }
      }

      // Calcular precio adicional de opciones seleccionadas
      let precioAdicionalOpciones = 0
      if (item.opcionesSeleccionadas && item.opcionesSeleccionadas.length > 0) {
        for (const opSel of item.opcionesSeleccionadas) {
          const opcion = await prisma.opcionProducto.findUnique({ where: { id: opSel.opcionId } })
          if (opcion) {
            precioAdicionalOpciones += Number(opcion.precioAdicional) * (opSel.cantidad || 1)
          }
        }
      }

      const precioUnitarioTotal = Number(producto.precio) + precioAdicionalOpciones
      const cantidad = item.cantidad || 1

      const itemCreado = await prisma.itemPedidoTakeAway.create({
        data: {
          pedidoId: parseInt(id),
          productoBuffetId: item.productoBuffetId,
          cantidad,
          precioUnitario: precioUnitarioTotal,
          subtotal: precioUnitarioTotal * cantidad,
          observaciones: item.observaciones,
          estado: estadoInicial,
          // Guardar opciones removidas (ingredientes que vienen por defecto y se quitaron)
          opcionesRemovidas: item.opcionesRemovidas && item.opcionesRemovidas.length > 0
            ? item.opcionesRemovidas
            : undefined,
          // Crear opciones seleccionadas si existen
          opcionesSeleccionadas: item.opcionesSeleccionadas && item.opcionesSeleccionadas.length > 0 ? {
            create: item.opcionesSeleccionadas.map(opSel => ({
              opcionId: opSel.opcionId,
              cantidad: opSel.cantidad || 1,
              precioAdicional: opSel.precioAdicional || 0
            }))
          } : undefined
        },
        include: {
          productoBuffet: true,
          opcionesSeleccionadas: {
            include: {
              opcion: {
                include: { productoRef: true }
              }
            }
          }
        }
      })

      itemsCreados.push(itemCreado)
    }

    await recalcularTotalesPedido(parseInt(id))

    // Imprimir comanda en destinos correspondientes
    if (itemsCreados.length > 0) {
      const pedidoConSocio = await prisma.pedidoTakeAway.findUnique({
        where: { id: parseInt(id) },
        include: {
          socio: { select: { apellidoNombre: true } }
        }
      })
      imprimirComandaTakeAway(pedidoConSocio, itemsCreados)
    }

    res.status(201).json({ success: true, data: itemsCreados })
  } catch (error) {
    console.error('Error al agregar items:', error)
    res.status(500).json({ success: false, error: 'Error al agregar items' })
  }
})

/**
 * PUT /takeaway/:id/items/:itemId
 * Modificar cantidad de item
 */
router.put('/takeaway/:id/items/:itemId', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { id, itemId } = req.params
    const { cantidad } = req.body

    // Verificar estado del pedido
    const pedido = await prisma.pedidoTakeAway.findUnique({ where: { id: parseInt(id) } })
    if (!pedido) {
      return res.status(404).json({ success: false, error: 'Pedido no encontrado' })
    }
    if (['PAGADO', 'ENTREGADO', 'CANCELADO'].includes(pedido.estado)) {
      return res.status(400).json({ success: false, error: 'No se pueden modificar items de este pedido' })
    }

    const item = await prisma.itemPedidoTakeAway.findUnique({
      where: { id: parseInt(itemId) },
      include: { productoBuffet: true }
    })

    if (!item || item.pedidoId !== parseInt(id)) {
      return res.status(404).json({ success: false, error: 'Item no encontrado' })
    }

    if (item.estado !== 'PENDIENTE') {
      return res.status(400).json({ success: false, error: 'Solo se pueden modificar items pendientes' })
    }

    const nuevoSubtotal = Number(item.precioUnitario) * parseInt(cantidad)

    const itemActualizado = await prisma.itemPedidoTakeAway.update({
      where: { id: parseInt(itemId) },
      data: {
        cantidad: parseInt(cantidad),
        subtotal: nuevoSubtotal
      },
      include: { productoBuffet: true }
    })

    await recalcularTotalesPedido(parseInt(id))

    res.json({ success: true, data: itemActualizado })
  } catch (error) {
    console.error('Error al modificar item:', error)
    res.status(500).json({ success: false, error: 'Error al modificar item' })
  }
})

/**
 * DELETE /takeaway/:id/items/:itemId
 * Anular item
 */
router.delete('/takeaway/:id/items/:itemId', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { id, itemId } = req.params

    // Verificar estado del pedido
    const pedido = await prisma.pedidoTakeAway.findUnique({ where: { id: parseInt(id) } })
    if (!pedido) {
      return res.status(404).json({ success: false, error: 'Pedido no encontrado' })
    }
    if (['PAGADO', 'ENTREGADO', 'CANCELADO'].includes(pedido.estado)) {
      return res.status(400).json({ success: false, error: 'No se pueden anular items de este pedido' })
    }

    const item = await prisma.itemPedidoTakeAway.findUnique({
      where: { id: parseInt(itemId) }
    })

    if (!item || item.pedidoId !== parseInt(id)) {
      return res.status(404).json({ success: false, error: 'Item no encontrado' })
    }

    if (item.estado === 'ENTREGADO') {
      return res.status(400).json({ success: false, error: 'No se pueden anular items entregados' })
    }

    await prisma.itemPedidoTakeAway.update({
      where: { id: parseInt(itemId) },
      data: { estado: 'ANULADO' }
    })

    await recalcularTotalesPedido(parseInt(id))

    res.json({ success: true, message: 'Item anulado' })
  } catch (error) {
    console.error('Error al anular item:', error)
    res.status(500).json({ success: false, error: 'Error al anular item' })
  }
})

/**
 * DELETE /takeaway/:id
 * Eliminar/Anular pedido completo (solo si no está pagado o entregado)
 */
router.delete('/takeaway/:id', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { id } = req.params

    // Verificar que el pedido existe
    const pedido = await prisma.pedidoTakeAway.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: true
      }
    })

    if (!pedido) {
      return res.status(404).json({ success: false, error: 'Pedido no encontrado' })
    }

    // No permitir eliminar pedidos pagados o entregados
    if (['PAGADO', 'ENTREGADO'].includes(pedido.estado)) {
      return res.status(400).json({ success: false, error: 'No se puede eliminar un pedido pagado o entregado' })
    }

    // Eliminar el pedido (los items se eliminan en cascada)
    await prisma.pedidoTakeAway.delete({
      where: { id: parseInt(id) }
    })

    res.json({ success: true, message: 'Pedido eliminado correctamente' })
  } catch (error) {
    console.error('Error al eliminar pedido:', error)
    res.status(500).json({ success: false, error: 'Error al eliminar pedido' })
  }
})

/**
 * POST /takeaway/:id/items/:itemId/entregar
 * Marcar item como entregado
 */
router.post('/takeaway/:id/items/:itemId/entregar', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { id, itemId } = req.params

    const item = await prisma.itemPedidoTakeAway.findUnique({
      where: { id: parseInt(itemId) },
      include: { pedido: true }
    })

    if (!item || item.pedidoId !== parseInt(id)) {
      return res.status(404).json({ success: false, error: 'Item no encontrado' })
    }

    if (item.estado === 'ANULADO') {
      return res.status(400).json({ success: false, error: 'No se pueden entregar items anulados' })
    }

    if (item.estado === 'ENTREGADO') {
      return res.status(400).json({ success: false, error: 'El item ya fue entregado' })
    }

    const itemActualizado = await prisma.itemPedidoTakeAway.update({
      where: { id: parseInt(itemId) },
      data: {
        estado: 'ENTREGADO',
        entregadoAt: new Date()
      },
      include: { productoBuffet: true }
    })

    res.json({ success: true, data: itemActualizado })
  } catch (error) {
    console.error('Error al marcar item como entregado:', error)
    res.status(500).json({ success: false, error: 'Error al marcar item como entregado' })
  }
})

// ============================================================================
// FLUJO DE PEDIDO - Enviar, Listo, Entregar
// ============================================================================

/**
 * POST /takeaway/:id/enviar-cocina
 * Enviar a cocina
 */
router.post('/takeaway/:id/enviar-cocina', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { id } = req.params

    const pedido = await prisma.pedidoTakeAway.findUnique({
      where: { id: parseInt(id) },
      include: { items: { where: { estado: 'PENDIENTE' } } }
    })

    if (!pedido) {
      return res.status(404).json({ success: false, error: 'Pedido no encontrado' })
    }

    if (pedido.items.length === 0) {
      return res.status(400).json({ success: false, error: 'No hay items pendientes' })
    }

    await prisma.itemPedidoTakeAway.updateMany({
      where: { pedidoId: parseInt(id), estado: 'PENDIENTE' },
      data: { estado: 'EN_PREPARACION' }
    })

    await prisma.pedidoTakeAway.update({
      where: { id: parseInt(id) },
      data: { estado: 'EN_PREPARACION' }
    })

    res.json({ success: true, message: 'Pedido enviado a cocina' })
  } catch (error) {
    console.error('Error al enviar a cocina:', error)
    res.status(500).json({ success: false, error: 'Error al enviar a cocina' })
  }
})

/**
 * PUT /takeaway/:id/listo
 * Marcar pedido como listo
 */
router.put('/takeaway/:id/listo', authAdmin, checkPermiso('BUFFET_COCINA'), async (req, res) => {
  try {
    const { id } = req.params

    await prisma.itemPedidoTakeAway.updateMany({
      where: { pedidoId: parseInt(id), estado: 'EN_PREPARACION' },
      data: { estado: 'LISTO' }
    })

    const pedido = await prisma.pedidoTakeAway.update({
      where: { id: parseInt(id) },
      data: { estado: 'LISTO', horaListo: new Date() }
    })

    res.json({ success: true, data: pedido })
  } catch (error) {
    console.error('Error al marcar listo:', error)
    res.status(500).json({ success: false, error: 'Error al marcar listo' })
  }
})

/**
 * POST /takeaway/:id/entregar
 * Marcar pedido como entregado
 */
router.post('/takeaway/:id/entregar', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { id } = req.params

    const pedido = await prisma.pedidoTakeAway.findUnique({
      where: { id: parseInt(id) },
      include: { items: true }
    })

    if (!pedido) {
      return res.status(404).json({ success: false, error: 'Pedido no encontrado' })
    }

    if (pedido.estado === 'ENTREGADO') {
      return res.status(400).json({ success: false, error: 'El pedido ya fue entregado' })
    }

    if (pedido.estado !== 'PAGADO') {
      return res.status(400).json({ success: false, error: 'Solo se pueden entregar pedidos pagados' })
    }

    const pedidoActualizado = await prisma.pedidoTakeAway.update({
      where: { id: parseInt(id) },
      data: {
        estado: 'ENTREGADO',
        horaEntregado: new Date()
      }
    })

    res.json({ success: true, data: pedidoActualizado })
  } catch (error) {
    console.error('Error al marcar como entregado:', error)
    res.status(500).json({ success: false, error: 'Error al marcar como entregado' })
  }
})

// ============================================================================
// COBRO
// ============================================================================

/**
 * POST /takeaway/:id/cobrar
 * Cobrar pedido take away
 */
router.post('/takeaway/:id/cobrar', authAdmin, checkPermiso('BUFFET_COBRAR'), async (req, res) => {
  try {
    const { id } = req.params
    const {
      medioPagoId,
      cajaId,
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

    const pedido = await prisma.pedidoTakeAway.findUnique({
      where: { id: parseInt(id) },
      include: { items: { include: { productoBuffet: true } } }
    })

    if (!pedido) {
      return res.status(404).json({ success: false, error: 'Pedido no encontrado' })
    }

    if (pedido.estado === 'PAGADO') {
      return res.status(400).json({ success: false, error: 'El pedido ya fue cobrado' })
    }

    if (pedido.estado === 'ENTREGADO') {
      return res.status(400).json({ success: false, error: 'El pedido ya fue entregado' })
    }

    if (pedido.estado === 'CANCELADO') {
      return res.status(400).json({ success: false, error: 'No se puede cobrar un pedido cancelado' })
    }

    const propinaMonto = propina && propina > 0 ? parseFloat(propina) : 0
    const totalFinal = Number(pedido.total) + propinaMonto

    // Agrupar items por cuenta contable del producto para asientos
    const itemsPorCuenta = {}
    for (const item of pedido.items) {
      const cuentaId = item.productoBuffet?.cuentaContableId
      if (!itemsPorCuenta[cuentaId]) {
        itemsPorCuenta[cuentaId] = 0
      }
      itemsPorCuenta[cuentaId] += Number(item.total)
    }

    // Cuenta contable fallback si no tiene configurada
    let cuentaContableFallback = await req.db.cuentaContable.findFirst({
      where: { codigo: { contains: 'BUFFET' }, esImputable: true }
    })
    if (!cuentaContableFallback) {
      cuentaContableFallback = await req.db.cuentaContable.findFirst({
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

        const caja = await req.db.caja.findUnique({ where: { id: parseInt(pago.cajaId || cajaId) } })
        if (!caja) {
          return res.status(400).json({ success: false, error: `Caja ${pago.cajaId || cajaId} no encontrada` })
        }

        const ultimoMov = await req.db.movimientoCaja.findFirst({ orderBy: { id: 'desc' } })
        const nuevoNumero = `MOV-${String((ultimoMov?.id || 0) + 1).padStart(8, '0')}`

        const movimiento = await req.db.movimientoCaja.create({
          data: {
            numero: nuevoNumero,
            cajaId: parseInt(pago.cajaId || cajaId),
            tipo: 'INGRESO',
            cuentaContableId: cuentaContable?.id || 1,
            centroCostoId: caja.centroCostoId,
            monto: parseFloat(pago.monto),
            concepto: `Take Away - Pedido ${pedido.numero} - ${medioPago.nombre}${propinaMonto > 0 ? ` + Propina` : ''}`,
            descripcion: observaciones,
            pedidoTakeAwayId: parseInt(id),
            registradoPor: req.admin.id
          }
        })

        // Generar asiento contable automático
        const lineasAsiento = [
          {
            cuentaContableId: caja.cuentaContableId, // DEBE: Caja (aumenta activo)
            debe: parseFloat(pago.monto),
            haber: 0,
            descripcion: `Ingreso por venta take away - ${medioPago.nombre}`
          }
        ]

        // Distribuir el monto del pago proporcionalmente entre las cuentas contables
        const totalPedido = Number(pedido.total)
        for (const [cuentaId, montoItems] of Object.entries(itemsPorCuenta)) {
          const cuentaContableId = cuentaId !== 'null' && cuentaId ? parseInt(cuentaId) : cuentaContableFallback?.id
          if (!cuentaContableId) continue

          // Proporción del monto de este pago que corresponde a esta cuenta
          const proporcion = montoItems / totalPedido
          const montoCuenta = parseFloat(pago.monto) * proporcion

          lineasAsiento.push({
            cuentaContableId,
            debe: 0,
            haber: montoCuenta,
            descripcion: `Venta take away - Pedido ${pedido.numero}`
          })
        }

        await generarAsientoAutomatico(prisma, {
          fecha: new Date(),
          concepto: `Venta Take Away - Pedido ${pedido.numero} - ${medioPago.nombre}`,
          tipoOrigen: 'VENTA_TAKEAWAY',
          origenId: movimiento.id,
          registradoPor: req.admin.id,
          lineas: lineasAsiento
        })

        movimientos.push(movimiento)
      }
    } else {
      const medioPago = await prisma.medioPago.findUnique({ where: { id: medioPagoId } })
      if (!medioPago) {
        return res.status(400).json({ success: false, error: 'Medio de pago no encontrado' })
      }

      const caja = await req.db.caja.findUnique({ where: { id: cajaId } })
      if (!caja) {
        return res.status(400).json({ success: false, error: 'Caja no encontrada' })
      }

      const ultimoMov = await req.db.movimientoCaja.findFirst({ orderBy: { id: 'desc' } })
      const nuevoNumero = `MOV-${String((ultimoMov?.id || 0) + 1).padStart(8, '0')}`

      const movimiento = await req.db.movimientoCaja.create({
        data: {
          numero: nuevoNumero,
          cajaId,
          tipo: 'INGRESO',
          cuentaContableId: cuentaContable?.id || 1,
          centroCostoId: caja.centroCostoId,
          monto: totalFinal,
          concepto: `Take Away - Pedido ${pedido.numero}${propinaMonto > 0 ? ` + Propina` : ''}`,
          descripcion: observaciones,
          pedidoTakeAwayId: parseInt(id),
          registradoPor: req.admin.id
        }
      })

      // Generar asiento contable automático
      const lineasAsiento = [
        {
          cuentaContableId: caja.cuentaContableId, // DEBE: Caja (aumenta activo)
          debe: totalFinal,
          haber: 0,
          descripcion: `Ingreso por venta take away - ${medioPago.nombre}`
        }
      ]

      // Distribuir el total entre las cuentas contables de los productos
      const totalPedido = Number(pedido.total)
      for (const [cuentaId, montoItems] of Object.entries(itemsPorCuenta)) {
        const cuentaContableId = cuentaId !== 'null' && cuentaId ? parseInt(cuentaId) : cuentaContableFallback?.id
        if (!cuentaContableId) continue

        // Proporción del total que corresponde a esta cuenta (incluye propina proporcionalmente)
        const proporcion = montoItems / totalPedido
        const montoCuenta = totalFinal * proporcion

        lineasAsiento.push({
          cuentaContableId,
          debe: 0,
          haber: montoCuenta,
          descripcion: `Venta take away - Pedido ${pedido.numero}`
        })
      }

      await generarAsientoAutomatico(prisma, {
        fecha: new Date(),
        concepto: `Venta Take Away - Pedido ${pedido.numero}`,
        tipoOrigen: 'VENTA_TAKEAWAY',
        origenId: movimiento.id,
        registradoPor: req.admin.id,
        lineas: lineasAsiento
      })

      movimientos.push(movimiento)
    }

    // Detectar si es venta de barra (venta instantánea)
    const esVentaBarra = pedido.nombreCliente?.includes('Venta Barra') ||
                        pedido.observaciones?.toLowerCase().includes('venta rápida en barra')

    const pedidoActualizado = await prisma.pedidoTakeAway.update({
      where: { id: parseInt(id) },
      data: {
        estado: esVentaBarra ? 'ENTREGADO' : 'PAGADO',
        propina: propinaMonto,
        total: totalFinal,
        horaPagado: new Date(),
        horaEntregado: esVentaBarra ? new Date() : null,
        esVentaInterna: esVentaInterna || false
      }
    })

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
        const cajaUsada = await req.db.caja.findUnique({ where: { id: cajaId || movimientos[0]?.cajaId } })
        const puntoVenta = cajaUsada?.puntoVentaAfip || 1
        const tipoAfip = tipoComprobante || 11

        const ultimoNumero = await getLastAuthorizedNumber(puntoVenta, tipoAfip)
        const numeroComprobante = ultimoNumero + 1

        const itemsFactura = pedido.items.map(item => ({
          descripcion: item.productoBuffet?.nombre || 'Producto',
          cantidad: item.cantidad,
          precioUnitario: parseFloat(item.precioUnitario),
          subtotal: parseFloat(item.subtotal),
          ivaRate: 21,
          ivaAmount: tipoAfip === 11 ? 0 : (parseFloat(item.subtotal) * 21) / 121
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
            pedidoTakeawayId: parseInt(id),
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
          comprobante: { tipo: tiposNombre[tipoAfip], tipoAfip, puntoVenta, numero: numeroComprobante, fecha: new Date(), cae: resultadoCAE.cae, fechaVtoCae: resultadoCAE.caeExpiration, cuit: config.cuit, nombreCliente: datosCliente?.nombre || 'Consumidor Final', total: totalFinal },
          comanda: pedidoActualizado,
          items: itemsFactura
        })
        ticketBase64 = toBase64(ticketData)

        console.log(`[TakeAway] Factura emitida: ${tiposNombre[tipoAfip]} ${puntoVenta}-${numeroComprobante}`)
      } catch (facError) {
        console.error('Error emitiendo factura takeaway:', facError)
      }
    } else {
      // Generar ticket NO fiscal - mismo formato que buffet
      try {
        const { renderTicketNoFiscal, toBase64 } = await import('../../services/ticketService.js')

        const itemsTicket = pedido.items.map(item => ({
          nombre: item.productoBuffet?.nombre || 'Producto',
          cantidad: item.cantidad,
          precioUnitario: parseFloat(item.precioUnitario),
          subtotal: parseFloat(item.subtotal)
        }))

        // Obtener nombre del cajero
        let cajeroNombre = null
        if (req.admin?.id) {
          const cajero = await prisma.admin.findUnique({
            where: { id: req.admin.id },
            select: { nombre: true, apellido: true }
          })
          if (cajero) cajeroNombre = `${cajero.nombre} ${cajero.apellido || ''}`.trim()
        }

        // Obtener nombre del medio de pago
        const medioPagoUsado = await prisma.medioPago.findUnique({
          where: { id: medioPagoId || pagosParciales?.[0]?.medioPagoId }
        })

        const ticketData = renderTicketNoFiscal({
          empresa: { razonSocial: 'CLUB SPORTIVO PILAR' },
          comanda: {
            ...pedidoActualizado,
            origen: 'TAKEAWAY',
            metodoPago: medioPagoUsado?.nombre || 'VARIOS',
            cobradoPor: cajeroNombre
          },
          items: itemsTicket
        })
        ticketBase64 = toBase64(ticketData)
        console.log(`[TakeAway] Ticket no fiscal generado para pedido ${pedido.numero}`)
      } catch (ticketError) {
        console.error('Error generando ticket takeaway:', ticketError)
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
        const cajaUsada = await req.db.caja.findUnique({
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
            socioId: tipoCliente === 'SOCIO' && clienteId ? parseInt(clienteId) : null,
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
            observaciones: `Venta TakeAway - Pedido ${pedido.numero}`
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
            socioId: tipoCliente === 'SOCIO' && clienteId ? parseInt(clienteId) : null,
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
            observaciones: `Cobro Venta TakeAway - Pedido ${pedido.numero}`
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
          await req.db.movimientoCaja.update({
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

        console.log(`[TakeAway] Integración con Ingresos completada para pedido ${pedido.numero}`)
      } catch (mcError) {
        console.error('Error creando MovimientoContable/Asientos TakeAway:', mcError)
      }
    }

    // Si es un pedido de BARRA, eliminarlo después de cobrar
    if (pedido.tipoVenta === 'BARRA') {
      try {
        await prisma.pedidoTakeAway.delete({
          where: { id: parseInt(id) }
        })
        console.log(`[TakeAway] Pedido BARRA ${pedido.numero} eliminado después de cobrar`)
      } catch (deleteErr) {
        console.error('Error eliminando pedido BARRA:', deleteErr)
        // No fallar el cobro si falla la eliminación
      }
    }

    res.json({
      success: true,
      data: {
        pedido: pedidoActualizado,
        movimientos,
        propinaAplicada: propinaMonto > 0 ? propinaMonto : null,
        comprobante: comprobanteFiscal,
        ticket: ticketBase64,
        qrUrl
      }
    })
  } catch (error) {
    console.error('Error al cobrar pedido:', error)
    res.status(500).json({ success: false, error: 'Error al cobrar pedido' })
  }
})

export default router
