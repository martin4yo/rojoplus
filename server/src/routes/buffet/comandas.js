/**
 * Rutas de Comandas del Buffet
 * - CRUD de comandas
 * - Gestión de items
 * - Envío a cocina
 * - Facturación y cobro
 */
import express from 'express'
import prisma from '../../lib/prisma.js'
import { authAdmin, checkPermiso } from '../../middleware/auth.js'
import { generarAsientoAutomatico } from '../asientos.js'
import {
  notificarNuevaComanda,
  notificarCuentaPedida,
  notificarMesaCobrada
} from '../../services/socketService.js'
import {
  generarAsientoFacturaVenta,
  generarAsientoReciboCobro,
  resolverCuentaCashId
} from '../../services/asientosContables.js'
import {
  generarNumeroComanda,
  generarNumeroMC,
  generarNumeroMovimientoCaja,
  recalcularTotalesComanda
} from './helpers.js'
import { enviarImpresion } from './impresoras.js'
import { descontarStockVentaBuffet } from '../../services/buffetStockService.js'

const router = express.Router()

// ============================================================================
// FUNCIONES DE IMPRESIÓN
// ============================================================================

/**
 * Genera comandos ESC/POS para imprimir comanda
 * @param {Object} comanda - Datos de la comanda
 * @param {Array} items - Items a imprimir
 * @param {string} sectorNombre - Nombre del sector destino (COCINA, BARRA, etc)
 */
function generarComandaESCPOS(comanda, items, sectorNombre = 'COCINA') {
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

  // Número de mesa - GRANDE Y DESTACADO
  buffer.push(GS, 0x21, 0x11) // Doble tamaño (alto y ancho)
  buffer.push(ESC, 0x45, 0x01) // Negrita
  buffer.push(...Buffer.from(`MESA ${comanda.mesa?.numero || '?'}\n`))
  buffer.push(GS, 0x21, 0x00) // Tamaño normal
  buffer.push(ESC, 0x45, 0x00) // Fin negrita

  // Nombre del cliente/socio - DESTACADO
  const nombreCliente = comanda.socio?.apellidoNombre || comanda.observaciones || comanda.nombreGrupo || null
  if (nombreCliente) {
    buffer.push(ESC, 0x45, 0x01) // Negrita
    buffer.push(...Buffer.from(`${nombreCliente}\n`))
    buffer.push(ESC, 0x45, 0x00)
  }

  buffer.push(...Buffer.from(`Comanda #${comanda.numero || comanda.id}\n`))
  buffer.push(...Buffer.from(`Hora: ${new Date().toLocaleTimeString('es-AR')}\n`))
  buffer.push(...Buffer.from(`${LINEA_DASH}\n`))

  // Alinear a la izquierda
  buffer.push(ESC, 0x61, 0x00)

  // Items - SIN negrita
  for (const item of items) {
    const nombre = item.productoBuffet?.nombre || 'Producto'
    const cantidad = item.cantidad || 1
    buffer.push(...Buffer.from(`${cantidad}x ${nombre.toUpperCase()}\n`))

    // Mostrar opciones seleccionadas (agregadas)
    if (item.opcionesSeleccionadas && item.opcionesSeleccionadas.length > 0) {
      for (const opSel of item.opcionesSeleccionadas) {
        const opcionNombre = opSel.opcion?.productoRef?.nombre || opSel.opcion?.nombre || 'Opción'
        const cantOp = opSel.cantidad > 1 ? `${opSel.cantidad}x ` : ''
        buffer.push(...Buffer.from(`   + ${cantOp}${opcionNombre.toUpperCase()}\n`))
      }
    }

    // Mostrar opciones removidas (ingredientes quitados)
    if (item.opcionesRemovidas) {
      try {
        const removidas = typeof item.opcionesRemovidas === 'string'
          ? JSON.parse(item.opcionesRemovidas)
          : item.opcionesRemovidas
        if (Array.isArray(removidas)) {
          for (const opRem of removidas) {
            buffer.push(...Buffer.from(`   - SIN ${(opRem.nombre || '').toUpperCase()}\n`))
          }
        }
      } catch (e) {}
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
 * Imprime comanda en los destinos correspondientes según categoría
 */
async function imprimirComandaPorDestinos(db, comanda, items) {
  try {
    console.log(`[Print] Iniciando impresión. Items: ${items.length}`)

    // Agrupar items por destino de impresión
    const itemsPorDestino = new Map()

    for (const item of items) {
      const producto = item.productoBuffet
      if (!producto?.categoriaMenuId) continue

      const destino = await db.destinoImpresion.findFirst({
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
          sectorNombre: destino.impresora.sector?.nombre || destino.impresora.nombre || 'COCINA',
          items: []
        })
      }
      itemsPorDestino.get(impresoraId).items.push(item)
    }

    console.log(`[Print] Impresoras a usar: ${itemsPorDestino.size}`)

    // Imprimir en cada destino
    for (const [impresoraId, data] of itemsPorDestino) {
      if (!data.impresora.imprimirComanda) {
        console.log(`[Print] Impresora ${data.impresora.nombre} tiene comandas desactivadas, omitiendo`)
        continue
      }
      console.log(`[Print] Enviando a impresora ${data.impresora.nombre} (sector: ${data.sectorNombre})`)
      const ticketData = generarComandaESCPOS(comanda, data.items, data.sectorNombre)
      const base64Data = ticketData.toString('base64')
      const resultado = await enviarImpresion(impresoraId, base64Data, 'COMANDA')
      console.log(`[Print] Resultado: ${JSON.stringify(resultado)}`)
    }
  } catch (error) {
    console.error('[Print] Error:', error)
  }
}

// ============================================================================
// COMANDAS - Listado y CRUD
// ============================================================================

/**
 * GET /comandas
 * Listar comandas
 */
router.get('/comandas', authAdmin, checkPermiso('BUFFET_VER'), async (req, res) => {
  try {
    const { estado, mesaId, fecha } = req.query

    const where = {}
    if (estado) where.estado = estado
    if (mesaId) where.mesaId = parseInt(mesaId)
    if (fecha) {
      const fechaInicio = new Date(fecha)
      fechaInicio.setHours(0, 0, 0, 0)
      const fechaFin = new Date(fecha)
      fechaFin.setHours(23, 59, 59, 999)
      where.horaApertura = { gte: fechaInicio, lte: fechaFin }
    }

    const comandas = await req.db.comanda.findMany({
      where,
      orderBy: { horaApertura: 'desc' },
      include: {
        mesa: true,
        socio: { select: { id: true, nroSocio: true, apellidoNombre: true } },
        items: { include: { productoBuffet: true } },
        atendedor: { select: { id: true, nombre: true } }
      }
    })

    res.json({ success: true, data: comandas })
  } catch (error) {
    console.error('Error al listar comandas:', error)
    res.status(500).json({ success: false, error: 'Error al listar comandas' })
  }
})

/**
 * GET /comandas/:id
 * Obtener comanda por ID
 */
router.get('/comandas/:id', authAdmin, checkPermiso('BUFFET_VER'), async (req, res) => {
  try {
    const { id } = req.params

    const comanda = await req.db.comanda.findUnique({
      where: { id: parseInt(id) },
      include: {
        mesa: true,
        socio: { select: { id: true, nroSocio: true, apellidoNombre: true } },
        items: {
          include: {
            productoBuffet: { include: { categoriaMenu: true } },
            opcionesSeleccionadas: {
              include: { opcion: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        atendedor: { select: { id: true, nombre: true } },
        cerrador: { select: { id: true, nombre: true } },
        movimientosCaja: true
      }
    })

    if (!comanda) {
      return res.status(404).json({ success: false, error: 'Comanda no encontrada' })
    }

    res.json({ success: true, data: comanda })
  } catch (error) {
    console.error('Error al obtener comanda:', error)
    res.status(500).json({ success: false, error: 'Error al obtener comanda' })
  }
})

/**
 * POST /comandas
 * Abrir comanda en mesa
 */
router.post('/comandas', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { mesaId, socioId, observaciones, centroCostoId } = req.body

    const mesa = await req.db.mesa.findUnique({ where: { id: mesaId } })
    if (!mesa) {
      return res.status(404).json({ success: false, error: 'Mesa no encontrada' })
    }

    // Para mesas NO comunitarias, verificar que no haya comanda abierta
    if (!mesa.esComunal) {
      const comandaExistente = await req.db.comanda.findFirst({
        where: { mesaId, estado: { in: ['ABIERTA', 'EN_PREPARACION', 'CUENTA_PEDIDA'] } }
      })

      if (comandaExistente) {
        return res.status(400).json({ success: false, error: 'La mesa ya tiene una comanda abierta' })
      }
    }

    const numero = await generarNumeroComanda(req.db)

    const comanda = await req.db.comanda.create({
      data: {
        numero,
        mesaId,
        socioId,
        observaciones,
        centroCostoId,
        atendidoPor: req.admin.id
      },
      include: { mesa: true, socio: true }
    })

    await req.db.mesa.update({
      where: { id: mesaId },
      data: { estado: 'OCUPADA' }
    })

    res.status(201).json({ success: true, data: comanda })
  } catch (error) {
    console.error('Error al crear comanda:', error)
    res.status(500).json({ success: false, error: 'Error al crear comanda' })
  }
})

/**
 * PUT /comandas/:id
 * Actualizar datos de comanda (socio, observaciones)
 */
router.put('/comandas/:id', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { id } = req.params
    const { socioId, observaciones } = req.body

    const comanda = await req.db.comanda.findUnique({ where: { id: parseInt(id) } })

    if (!comanda) {
      return res.status(404).json({ success: false, error: 'Comanda no encontrada' })
    }

    if (comanda.estado === 'CERRADA' || comanda.estado === 'ANULADA') {
      return res.status(400).json({ success: false, error: 'No se puede editar una comanda cerrada' })
    }

    const comandaActualizada = await req.db.comanda.update({
      where: { id: parseInt(id) },
      data: {
        socioId: socioId || null,
        observaciones: observaciones || null
      },
      include: {
        socio: { select: { id: true, nombre: true, apellido: true, apellidoNombre: true, nroSocio: true } },
        mesa: true,
        items: {
          include: { productoBuffet: true },
          orderBy: { createdAt: 'asc' }
        }
      }
    })

    res.json({ success: true, data: comandaActualizada })
  } catch (error) {
    console.error('Error al actualizar comanda:', error)
    res.status(500).json({ success: false, error: 'Error al actualizar comanda' })
  }
})

/**
 * DELETE /comandas/:id
 * Eliminar comanda vacía
 */
router.delete('/comandas/:id', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { id } = req.params

    const comanda = await req.db.comanda.findUnique({
      where: { id: parseInt(id) },
      include: { items: true, mesa: true }
    })

    if (!comanda) {
      return res.status(404).json({ success: false, error: 'Comanda no encontrada' })
    }

    if (comanda.items && comanda.items.length > 0) {
      return res.status(400).json({ success: false, error: 'No se puede eliminar una comanda con items. Anule los items primero.' })
    }

    if (comanda.estado === 'CERRADA' || comanda.estado === 'ANULADA') {
      return res.status(400).json({ success: false, error: 'No se puede eliminar una comanda cerrada o anulada' })
    }

    await req.db.comanda.delete({ where: { id: parseInt(id) } })

    const otrasComandas = await req.db.comanda.findFirst({
      where: {
        mesaId: comanda.mesaId,
        estado: { in: ['ABIERTA', 'EN_PREPARACION', 'CUENTA_PEDIDA'] }
      }
    })

    if (!otrasComandas) {
      await req.db.mesa.update({
        where: { id: comanda.mesaId },
        data: { estado: 'LIBRE' }
      })
    }

    res.json({ success: true, message: 'Comanda eliminada' })
  } catch (error) {
    console.error('Error al eliminar comanda:', error)
    res.status(500).json({ success: false, error: 'Error al eliminar comanda' })
  }
})

// ============================================================================
// ITEMS DE COMANDA
// ============================================================================

/**
 * POST /comandas/:id/items
 * Agregar items a comanda
 */
router.post('/comandas/:id/items', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { id } = req.params
    const { items } = req.body

    const comanda = await req.db.comanda.findUnique({ where: { id: parseInt(id) } })
    if (!comanda) {
      return res.status(404).json({ success: false, error: 'Comanda no encontrada' })
    }

    if (comanda.estado === 'CERRADA' || comanda.estado === 'ANULADA') {
      return res.status(400).json({ success: false, error: 'No se pueden agregar items a una comanda cerrada' })
    }

    if (comanda.estado === 'CUENTA_PEDIDA') {
      return res.status(400).json({ success: false, error: 'No se pueden agregar items, la cuenta ya fue pedida. Reabrí la comanda primero.' })
    }

    const itemsCreados = []

    for (const item of items) {
      const producto = await req.db.productoBuffet.findUnique({
        where: { id: item.productoBuffetId },
        include: { categoriaMenu: true }
      })
      if (!producto) continue

      // Determinar estado inicial según destino de impresión
      let estadoInicial = 'PENDIENTE'
      if (producto.categoriaMenuId) {
        const destino = await req.db.destinoImpresion.findFirst({
          where: { categoriaMenuId: producto.categoriaMenuId },
          include: { impresora: { include: { sector: true } } }
        })

        if (destino && destino.impresora && !destino.saltarControlCocina) {
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
          const opcion = await req.db.opcionProducto.findUnique({ where: { id: opSel.opcionId } })
          if (opcion) {
            precioAdicionalOpciones += Number(opcion.precioAdicional) * (opSel.cantidad || 1)
          }
        }
      }

      const precioUnitarioTotal = Number(producto.precio) + precioAdicionalOpciones
      const cantidad = item.cantidad || 1

      const itemCreado = await req.db.itemComanda.create({
        data: {
          comandaId: parseInt(id),
          productoBuffetId: item.productoBuffetId,
          cantidad,
          precioUnitario: precioUnitarioTotal,
          subtotal: precioUnitarioTotal * cantidad,
          observaciones: item.observaciones,
          estado: estadoInicial,
          // Guardar opciones removidas (ingredientes quitados) como JSON
          opcionesRemovidas: item.opcionesRemovidas && item.opcionesRemovidas.length > 0
            ? item.opcionesRemovidas
            : undefined,
          // Crear opciones seleccionadas si existen
          opcionesSeleccionadas: item.opcionesSeleccionadas && item.opcionesSeleccionadas.length > 0 ? {
            create: item.opcionesSeleccionadas.map(opSel => ({
              opcionId: opSel.opcionId,
              cantidad: opSel.cantidad || 1,
              precioAdicional: opSel.precioAdicional || 0,
              tenantId: req.tenantId
            }))
          } : undefined
        },
        include: {
          productoBuffet: true,
          opcionesSeleccionadas: { include: { opcion: { include: { productoRef: true } } } }
        }
      })

      itemsCreados.push(itemCreado)
    }

    await recalcularTotalesComanda(parseInt(id), req.db)

    // Imprimir comanda en los destinos correspondientes (si está habilitado)
    if (itemsCreados.length > 0) {
      const cfgComanda = await req.db.configuracion.findFirst({
        where: { clave: 'BUFFET_COMANDA_MESA' },
        select: { valor: true }
      })
      const debeImprimirComanda = cfgComanda ? cfgComanda.valor === 'true' : true
      if (debeImprimirComanda) {
        const comandaConMesa = await req.db.comanda.findUnique({
          where: { id: parseInt(id) },
          include: { mesa: true, socio: true }
        })
        // Ejecutar impresión de forma asíncrona (no bloquea la respuesta)
        imprimirComandaPorDestinos(req.db, comandaConMesa, itemsCreados)
      }
    }

    res.status(201).json({ success: true, data: itemsCreados })
  } catch (error) {
    console.error('Error al agregar items:', error)
    res.status(500).json({ success: false, error: 'Error al agregar items' })
  }
})

/**
 * PUT /comandas/:comandaId/items/:itemId
 * Modificar item de comanda
 */
router.put('/comandas/:comandaId/items/:itemId', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { comandaId, itemId } = req.params
    const { cantidad, observaciones } = req.body

    const item = await req.db.itemComanda.findUnique({
      where: { id: parseInt(itemId) },
      include: { productoBuffet: true }
    })

    if (!item || item.comandaId !== parseInt(comandaId)) {
      return res.status(404).json({ success: false, error: 'Item no encontrado' })
    }

    if (item.estado !== 'PENDIENTE') {
      return res.status(400).json({ success: false, error: 'Solo se pueden modificar items pendientes' })
    }

    const itemActualizado = await req.db.itemComanda.update({
      where: { id: parseInt(itemId) },
      data: {
        cantidad,
        subtotal: Number(item.precioUnitario) * cantidad,
        observaciones
      },
      include: { productoBuffet: true }
    })

    await recalcularTotalesComanda(parseInt(comandaId), req.db)

    res.json({ success: true, data: itemActualizado })
  } catch (error) {
    console.error('Error al modificar item:', error)
    res.status(500).json({ success: false, error: 'Error al modificar item' })
  }
})

/**
 * DELETE /comandas/:comandaId/items/:itemId
 * Anular item de comanda
 */
router.delete('/comandas/:comandaId/items/:itemId', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { comandaId, itemId } = req.params

    const item = await req.db.itemComanda.findUnique({ where: { id: parseInt(itemId) } })

    if (!item || item.comandaId !== parseInt(comandaId)) {
      return res.status(404).json({ success: false, error: 'Item no encontrado' })
    }

    if (item.estado === 'ENTREGADO') {
      return res.status(400).json({ success: false, error: 'No se pueden anular items entregados' })
    }

    await req.db.itemComanda.update({
      where: { id: parseInt(itemId) },
      data: { estado: 'ANULADO' }
    })

    await recalcularTotalesComanda(parseInt(comandaId), req.db)

    res.json({ success: true, message: 'Item anulado' })
  } catch (error) {
    console.error('Error al anular item:', error)
    res.status(500).json({ success: false, error: 'Error al anular item' })
  }
})

/**
 * POST /comandas/:comandaId/items/:itemId/entregar
 * Marcar item como entregado
 */
router.post('/comandas/:comandaId/items/:itemId/entregar', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { comandaId, itemId } = req.params

    const item = await req.db.itemComanda.findUnique({
      where: { id: parseInt(itemId) },
      include: { comanda: true }
    })

    if (!item || item.comandaId !== parseInt(comandaId)) {
      return res.status(404).json({ success: false, error: 'Item no encontrado' })
    }

    if (item.estado === 'ANULADO') {
      return res.status(400).json({ success: false, error: 'No se pueden entregar items anulados' })
    }

    if (item.estado === 'ENTREGADO') {
      return res.status(400).json({ success: false, error: 'El item ya fue entregado' })
    }

    const itemActualizado = await req.db.itemComanda.update({
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
// FLUJO DE COMANDA - Enviar, Pedir cuenta, Reabrir
// ============================================================================

/**
 * POST /comandas/:id/enviar-cocina
 * Enviar items pendientes a cocina
 */
router.post('/comandas/:id/enviar-cocina', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { id } = req.params

    const comanda = await req.db.comanda.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          where: { estado: 'PENDIENTE' },
          include: { productoBuffet: { include: { categoriaMenu: true } } }
        },
        mesa: true
      }
    })

    if (!comanda) {
      return res.status(404).json({ success: false, error: 'Comanda no encontrada' })
    }

    if (comanda.items.length === 0) {
      return res.status(400).json({ success: false, error: 'No hay items pendientes para enviar' })
    }

    await req.db.itemComanda.updateMany({
      where: { comandaId: parseInt(id), estado: 'PENDIENTE' },
      data: { estado: 'ENVIADO_COCINA', enviadoCocinaAt: new Date() }
    })

    const comandaActualizada = await req.db.comanda.update({
      where: { id: parseInt(id) },
      data: { estado: 'EN_PREPARACION' },
      include: { mesa: true }
    })

    notificarNuevaComanda(comandaActualizada, comanda.items).catch(err =>
      console.error('Error notificando nueva comanda:', err)
    )

    res.json({ success: true, message: 'Items enviados a cocina' })
  } catch (error) {
    console.error('Error al enviar a cocina:', error)
    res.status(500).json({ success: false, error: 'Error al enviar a cocina' })
  }
})

/**
 * POST /comandas/:id/pedir-cuenta
 * Solicitar cuenta (notifica al cajero)
 */
router.post('/comandas/:id/pedir-cuenta', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { id } = req.params
    const { imprimirTicket } = req.body

    const comanda = await req.db.comanda.findUnique({
      where: { id: parseInt(id) },
      include: {
        mesa: true,
        socio: true,
        items: {
          where: { estado: { not: 'ANULADO' } },
          include: { productoBuffet: true }
        }
      }
    })

    if (!comanda) {
      return res.status(404).json({ success: false, error: 'Comanda no encontrada' })
    }

    if (comanda.estado === 'CERRADA') {
      return res.status(400).json({ success: false, error: 'La comanda ya está cerrada' })
    }

    // Calcular descuento si el socio está al día
    let descuentoInfo = { porcentaje: 0, monto: 0 }
    if (comanda.socioId) {
      const configDescuento = await req.db.configuracion.findFirst({
        where: { clave: 'BUFFET_DESCUENTO_SOCIO' }
      })
      const descuentoPorcentaje = configDescuento ? parseFloat(configDescuento.valor) : 0

      if (descuentoPorcentaje > 0) {
        const cargoPendiente = await req.db.cargo.findFirst({
          where: {
            socioId: comanda.socioId,
            estado: 'PENDIENTE',
            fechaVencimiento: { lt: new Date() }
          }
        })

        if (!cargoPendiente) {
          descuentoInfo = {
            porcentaje: descuentoPorcentaje,
            monto: (Number(comanda.subtotal) * descuentoPorcentaje) / 100
          }
        }
      }
    }

    const comandaActualizada = await req.db.comanda.update({
      where: { id: parseInt(id) },
      data: { estado: 'CUENTA_PEDIDA' },
      include: { mesa: true, socio: true }
    })

    await req.db.mesa.update({
      where: { id: comanda.mesaId },
      data: { estado: 'CUENTA_PEDIDA' }
    })

    // Generar ticket de pre-cuenta
    let ticketBase64 = null
    if (imprimirTicket !== false) {
      try {
        const { renderTicketPreCuenta, toBase64 } = await import('../../services/ticketService.js')

        let mozoNombre = null
        if (comanda.creadoPorId) {
          const mozo = await req.db.admin.findUnique({
            where: { id: comanda.creadoPorId },
            select: { nombre: true, apellido: true }
          })
          if (mozo) mozoNombre = `${mozo.nombre} ${mozo.apellido || ''}`.trim()
        }

        const ticketData = renderTicketPreCuenta({
          comanda: { ...comanda, mozo: mozoNombre },
          items: comanda.items,
          descuento: descuentoInfo,
          socio: comanda.socio
        })

        ticketBase64 = toBase64(ticketData)
      } catch (ticketError) {
        console.error('Error generando ticket pre-cuenta:', ticketError)
      }
    }

    notificarCuentaPedida(comandaActualizada).catch(err =>
      console.error('Error notificando cuenta pedida:', err)
    )

    res.json({
      success: true,
      message: 'Cuenta solicitada',
      data: {
        comanda: comandaActualizada,
        descuento: descuentoInfo,
        totalEstimado: Number(comanda.subtotal) - descuentoInfo.monto,
        ticket: ticketBase64
      }
    })
  } catch (error) {
    console.error('Error al pedir cuenta:', error)
    res.status(500).json({ success: false, error: 'Error al pedir cuenta' })
  }
})

/**
 * POST /comandas/:id/reabrir
 * Reabrir comanda (volver de CUENTA_PEDIDA a EN_PREPARACION)
 */
router.post('/comandas/:id/reabrir', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { id } = req.params

    const comanda = await req.db.comanda.findUnique({
      where: { id: parseInt(id) },
      include: { mesa: true }
    })

    if (!comanda) {
      return res.status(404).json({ success: false, error: 'Comanda no encontrada' })
    }

    if (comanda.estado !== 'CUENTA_PEDIDA') {
      return res.status(400).json({ success: false, error: 'Solo se pueden reabrir comandas con cuenta pedida' })
    }

    const comandaActualizada = await req.db.comanda.update({
      where: { id: parseInt(id) },
      data: { estado: 'EN_PREPARACION' },
      include: {
        mesa: true,
        socio: { select: { id: true, nombre: true, apellido: true, apellidoNombre: true, nroSocio: true } },
        items: {
          where: { estado: { not: 'ANULADO' } },
          include: { productoBuffet: true },
          orderBy: { createdAt: 'asc' }
        }
      }
    })

    await req.db.mesa.update({
      where: { id: comanda.mesaId },
      data: { estado: 'OCUPADA' }
    })

    res.json({ success: true, message: 'Comanda reabierta', data: comandaActualizada })
  } catch (error) {
    console.error('Error al reabrir comanda:', error)
    res.status(500).json({ success: false, error: 'Error al reabrir comanda' })
  }
})

/**
 * POST /comandas/:id/cancelar
 * Cancelar comanda y liberar mesa (solo si no tiene items)
 */
router.post('/comandas/:id/cancelar', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { id } = req.params

    const comanda = await req.db.comanda.findUnique({
      where: { id: parseInt(id) },
      include: {
        mesa: true,
        items: { where: { estado: { not: 'ANULADO' } } }
      }
    })

    if (!comanda) {
      return res.status(404).json({ success: false, error: 'Comanda no encontrada' })
    }

    if (!['ABIERTA', 'EN_PREPARACION'].includes(comanda.estado)) {
      return res.status(400).json({ success: false, error: 'Solo se pueden cancelar comandas abiertas o en preparación' })
    }

    // Verificar que no tenga items (o todos estén anulados)
    if (comanda.items.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'No se puede cancelar una comanda con items. Anule los items primero o cobre la cuenta.'
      })
    }

    // Cerrar la comanda
    const comandaCancelada = await req.db.comanda.update({
      where: { id: parseInt(id) },
      data: {
        estado: 'CERRADA',
        horaCierre: new Date(),
        cerradoPor: req.admin.id,
        observaciones: comanda.observaciones
          ? `${comanda.observaciones} | Cancelada sin consumo`
          : 'Cancelada sin consumo'
      }
    })

    // Liberar la mesa
    await req.db.mesa.update({
      where: { id: comanda.mesaId },
      data: { estado: 'LIBRE' }
    })

    res.json({
      success: true,
      message: 'Comanda cancelada y mesa liberada',
      data: comandaCancelada
    })
  } catch (error) {
    console.error('Error al cancelar comanda:', error)
    res.status(500).json({ success: false, error: 'Error al cancelar comanda' })
  }
})

// ============================================================================
// DESCUENTOS Y COBRO
// ============================================================================

/**
 * GET /comandas/:id/descuento
 * Verificar descuento aplicable para una comanda
 */
router.get('/comandas/:id/descuento', authAdmin, checkPermiso('BUFFET_COBRAR'), async (req, res) => {
  try {
    const { id } = req.params

    const comanda = await req.db.comanda.findUnique({
      where: { id: parseInt(id) },
      include: { socio: true }
    })

    if (!comanda) {
      return res.status(404).json({ success: false, error: 'Comanda no encontrada' })
    }

    let descuentoInfo = {
      aplicable: false,
      porcentaje: 0,
      monto: 0,
      motivo: null,
      socioAlDia: false
    }

    if (comanda.socioId) {
      const configDescuento = await req.db.configuracion.findFirst({
        where: { clave: 'BUFFET_DESCUENTO_SOCIO' }
      })

      const porcentajeDescuento = configDescuento ? parseFloat(configDescuento.valor) : 0

      if (porcentajeDescuento > 0) {
        const cargoPendiente = await req.db.cargo.findFirst({
          where: {
            socioId: comanda.socioId,
            estado: 'PENDIENTE',
            fechaVencimiento: { lt: new Date() }
          }
        })

        const socioAlDia = !cargoPendiente

        if (socioAlDia) {
          const montoDescuento = (Number(comanda.subtotal) * porcentajeDescuento) / 100
          descuentoInfo = {
            aplicable: true,
            porcentaje: porcentajeDescuento,
            monto: montoDescuento,
            motivo: `Descuento socio ${porcentajeDescuento}%`,
            socioAlDia: true
          }
        } else {
          descuentoInfo.motivo = 'El socio tiene cuotas vencidas'
          descuentoInfo.socioAlDia = false
        }
      }
    }

    res.json({ success: true, data: descuentoInfo })
  } catch (error) {
    console.error('Error verificando descuento:', error)
    res.status(500).json({ success: false, error: 'Error verificando descuento' })
  }
})

/**
 * POST /comandas/:id/cobrar
 * Cobrar comanda (con facturación opcional)
 */
router.post('/comandas/:id/cobrar', authAdmin, checkPermiso('BUFFET_COBRAR'), async (req, res) => {
  try {
    const { id } = req.params
    const {
      medioPagoId,
      cajaId,
      observaciones,
      aplicarDescuento,
      propina,
      pagosParciales,
      emitirFactura,
      esVentaInterna,
      datosCliente,
      clienteId,
      tipoCliente
    } = req.body

    const comanda = await req.db.comanda.findUnique({
      where: { id: parseInt(id) },
      include: {
        mesa: true,
        socio: true,
        items: {
          include: {
            productoBuffet: {
              include: { producto: { include: { conceptoVenta: true } } }
            }
          }
        }
      }
    })

    if (!comanda) {
      return res.status(404).json({ success: false, error: 'Comanda no encontrada' })
    }

    if (comanda.estado === 'CERRADA') {
      return res.status(400).json({ success: false, error: 'La comanda ya fue cobrada' })
    }

    // Validar acceso a la caja según el rol del usuario
    const admin = await req.db.admin.findUnique({
      where: { id: req.admin.id },
      include: {
        rol: { include: { cajas: { select: { cajaId: true } } } }
      }
    })

    if (admin?.rol && !admin.rol.esSuperAdmin && admin.rol.cajas.length > 0) {
      const cajasPermitidas = admin.rol.cajas.map(cr => cr.cajaId)
      const cajaIdPrincipal = cajaId || (pagosParciales?.[0]?.cajaId)

      if (cajaIdPrincipal && !cajasPermitidas.includes(parseInt(cajaIdPrincipal))) {
        return res.status(403).json({
          success: false,
          error: 'No tiene permiso para cobrar en esta caja'
        })
      }
    }

    // Calcular descuento si aplica
    let descuentoMonto = 0
    let descuentoPorcentaje = 0

    if (aplicarDescuento && comanda.socioId) {
      const configDescuento = await req.db.configuracion.findFirst({
        where: { clave: 'BUFFET_DESCUENTO_SOCIO' }
      })

      descuentoPorcentaje = configDescuento ? parseFloat(configDescuento.valor) : 0

      if (descuentoPorcentaje > 0) {
        const cargoPendiente = await req.db.cargo.findFirst({
          where: {
            socioId: comanda.socioId,
            estado: 'PENDIENTE',
            fechaVencimiento: { lt: new Date() }
          }
        })

        if (!cargoPendiente) {
          descuentoMonto = (Number(comanda.subtotal) * descuentoPorcentaje) / 100
        }
      }
    }

    // Calcular total con descuento y propina
    const propinaMonto = propina && propina > 0 ? parseFloat(propina) : 0
    const totalFinal = Number(comanda.subtotal) - descuentoMonto + propinaMonto

    // Agrupar items por cuenta contable del concepto de venta del producto para asientos
    // Excluir items anulados (subtotal 0, no generan ingreso)
    const itemsPorCuenta = {}
    for (const item of comanda.items) {
      if (item.estado === 'ANULADO') continue
      const cuentaId = item.productoBuffet?.producto?.conceptoVenta?.cuentaContableId
                    || item.productoBuffet?.cuentaContableId
      if (!itemsPorCuenta[cuentaId]) {
        itemsPorCuenta[cuentaId] = 0
      }
      itemsPorCuenta[cuentaId] += Number(item.subtotal)
    }

    // Cuenta contable fallback para items sin concepto configurado
    let cuentaContableFallback = await req.db.cuentaContable.findFirst({
      where: { codigo: { contains: 'BUFFET' }, esImputable: true }
    })
    if (!cuentaContableFallback) {
      cuentaContableFallback = await req.db.cuentaContable.findFirst({
        where: { codigo: '4.1.1.01', esImputable: true }
      })
    }
    // El fallback solo es obligatorio si algún item no tiene cuenta propia
    const algunItemSinCuenta = Object.keys(itemsPorCuenta).some(k => !k || k === 'null' || k === 'undefined')
    if (algunItemSinCuenta && !cuentaContableFallback) {
      return res.status(400).json({
        success: false,
        error: 'Hay productos sin cuenta contable de ventas configurada. Configure el concepto de venta en los productos o cree una cuenta con código 4.1.1.01.'
      })
    }

    // Centro de costo y concepto: del primer item no anulado que tenga concepto de venta
    const ccItemsFallback = comanda.items
      .filter(i => i.estado !== 'ANULADO')
      .map(i => i.productoBuffet?.producto?.conceptoVenta?.centroCostoId)
      .find(cc => cc != null) ?? null
    const conceptoVentaId = comanda.items
      .filter(i => i.estado !== 'ANULADO')
      .map(i => i.productoBuffet?.producto?.conceptoVenta?.id)
      .find(id => id != null) ?? null

    // Agrupar items por conceptoVenta para ItemMovimientoCaja
    const itemsPorConceptoVenta = {}
    for (const item of comanda.items) {
      if (item.estado === 'ANULADO') continue
      const cv = item.productoBuffet?.producto?.conceptoVenta
      const key = cv?.id ?? 'sin-concepto'
      if (!itemsPorConceptoVenta[key]) {
        itemsPorConceptoVenta[key] = {
          conceptoTesoreriaId: cv?.id ?? null,
          cuentaContableId: cv?.cuentaContableId ?? null,
          centroCostoId: cv?.centroCostoId ?? ccItemsFallback,
          monto: 0,
        }
      }
      itemsPorConceptoVenta[key].monto += Number(item.subtotal)
    }
    const gruposConcepto = Object.values(itemsPorConceptoVenta)
    const totalConceptos = gruposConcepto.reduce((s, g) => s + g.monto, 0)

    async function crearItemsBuffet(tx, movimientoId, montoMovimiento, caja) {
      let montoAsignado = 0
      for (let i = 0; i < gruposConcepto.length; i++) {
        const g = gruposConcepto[i]
        const esUltimo = i === gruposConcepto.length - 1
        const montoItem = esUltimo
          ? Math.round((montoMovimiento - montoAsignado) * 100) / 100
          : Math.round(montoMovimiento * (g.monto / totalConceptos) * 100) / 100
        if (montoItem <= 0) continue
        montoAsignado += montoItem
        await tx.itemMovimientoCaja.create({
          data: {
            tenantId: req.tenantId,
            movimientoCajaId: movimientoId,
            conceptoTesoreriaId: g.conceptoTesoreriaId,
            cuentaContableId: g.cuentaContableId || caja.cuentaContableId || cuentaContableFallback?.id,
            centroCostoId: g.centroCostoId || caja.centroCostoId,
            monto: montoItem,
            descripcion: `Venta Buffet - Comanda ${comanda.numero}`,
            orden: i,
          }
        })
      }
    }

    // Crear movimientos de caja
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
        const medioPago = await req.db.medioPago.findUnique({
          where: { id: parseInt(pago.medioPagoId) },
          include: { conceptoTesoreria: true }
        })
        if (!medioPago) {
          return res.status(400).json({ success: false, error: `Medio de pago ${pago.medioPagoId} no encontrado` })
        }

        const caja = await req.db.caja.findUnique({ where: { id: parseInt(pago.cajaId || cajaId) } })
        if (!caja) {
          return res.status(400).json({ success: false, error: `Caja ${pago.cajaId || cajaId} no encontrada` })
        }

        const nuevoNumero = await generarNumeroMovimientoCaja(req.db)

        const movimiento = await req.db.movimientoCaja.create({
          data: {
            numero: nuevoNumero,
            cajaId: parseInt(pago.cajaId || cajaId),
            tipo: 'INGRESO',
            cuentaContableId: caja.cuentaContableId || cuentaContableFallback?.id,
            centroCostoId: caja.centroCostoId ?? ccItemsFallback,
            monto: parseFloat(pago.monto),
            medioPagoId: medioPago.id,
            conceptoTesoreriaId: conceptoVentaId,
            concepto: `Venta Buffet - Comanda ${comanda.numero} - ${medioPago.nombre}${descuentoMonto > 0 ? ` (Desc. ${descuentoPorcentaje}%)` : ''}${propinaMonto > 0 ? ` + Propina` : ''}`,
            descripcion: observaciones,
            comandaId: parseInt(id),
            registradoPor: req.admin.id
          }
        })
        await crearItemsBuffet(req.db, movimiento.id, parseFloat(pago.monto), caja)

        // Generar asiento contable automático
        // DEBE: cuenta del concepto del medio de pago (ej: Caja Efectivo, Banco, etc.)
        const cuentaDebeBuffetMulti = resolverCuentaCashId(medioPago, caja)
        const lineasAsiento = [
          {
            cuentaContableId: cuentaDebeBuffetMulti,
            debe: parseFloat(pago.monto),
            haber: 0,
            centroCostoId: caja.centroCostoId ?? ccItemsFallback ?? null,
            descripcion: `Ingreso por venta buffet - ${medioPago.nombre}`
          }
        ]

        // Distribuir el monto del pago proporcionalmente entre las cuentas contables
        const totalComanda = Number(comanda.subtotal)
        for (const [cuentaId, montoItems] of Object.entries(itemsPorCuenta)) {
          const cuentaContableId = (cuentaId && cuentaId !== 'null' && cuentaId !== 'undefined') ? parseInt(cuentaId) : cuentaContableFallback?.id
          if (!cuentaContableId) continue

          // Proporción del monto de este pago que corresponde a esta cuenta
          const proporcion = montoItems / totalComanda
          const montoCuenta = parseFloat(pago.monto) * proporcion

          lineasAsiento.push({
            cuentaContableId,
            debe: 0,
            haber: montoCuenta,
            centroCostoId: caja.centroCostoId ?? ccItemsFallback ?? null,
            descripcion: `Venta buffet - Comanda ${comanda.numero}`
          })
        }

        await generarAsientoAutomatico(req.db, {
          fecha: new Date(),
          concepto: `Venta Buffet - Comanda ${comanda.numero} - ${medioPago.nombre}`,
          tipoOrigen: 'VENTA_BUFFET',
          origenId: movimiento.id,
          registradoPor: req.admin.id,
          lineas: lineasAsiento
        })

        movimientos.push(movimiento)
      }
    } else {
      const medioPago = await req.db.medioPago.findUnique({
        where: { id: parseInt(medioPagoId) },
        include: { conceptoTesoreria: true }
      })
      if (!medioPago) {
        return res.status(400).json({ success: false, error: 'Medio de pago no encontrado' })
      }

      const caja = await req.db.caja.findUnique({ where: { id: parseInt(cajaId) } })
      if (!caja) {
        return res.status(400).json({ success: false, error: 'Caja no encontrada' })
      }

      const nuevoNumero = await generarNumeroMovimientoCaja(req.db)

      const movimiento = await req.db.movimientoCaja.create({
        data: {
          numero: nuevoNumero,
          cajaId: parseInt(cajaId),
          tipo: 'INGRESO',
          cuentaContableId: caja.cuentaContableId || cuentaContableFallback?.id,
          centroCostoId: caja.centroCostoId ?? ccItemsFallback,
          monto: totalFinal,
          medioPagoId: medioPago.id,
          conceptoTesoreriaId: conceptoVentaId,
          concepto: `Venta Buffet - Comanda ${comanda.numero}${descuentoMonto > 0 ? ` (Desc. ${descuentoPorcentaje}%)` : ''}${propinaMonto > 0 ? ` + Propina` : ''}`,
          descripcion: observaciones,
          comandaId: parseInt(id),
          registradoPor: req.admin.id
        }
      })
      await crearItemsBuffet(req.db, movimiento.id, totalFinal, caja)

      // Generar asiento contable automático
      // DEBE: cuenta del concepto del medio de pago (ej: Caja Efectivo, Banco, etc.)
      const cuentaDebeBuffet = resolverCuentaCashId(medioPago, caja)
      const lineasAsiento = [
        {
          cuentaContableId: cuentaDebeBuffet,
          debe: totalFinal,
          haber: 0,
          centroCostoId: caja.centroCostoId ?? ccItemsFallback ?? null,
          descripcion: `Ingreso por venta buffet - ${medioPago.nombre}`
        }
      ]

      // Distribuir el total entre las cuentas contables de los productos
      const totalComanda = Number(comanda.subtotal)
      for (const [cuentaId, montoItems] of Object.entries(itemsPorCuenta)) {
        const cuentaContableId = cuentaId !== 'null' && cuentaId ? parseInt(cuentaId) : cuentaContableFallback?.id
        if (!cuentaContableId) continue

        // Proporción del total que corresponde a esta cuenta (incluye descuento y propina proporcionalmente)
        const proporcion = montoItems / totalComanda
        const montoCuenta = totalFinal * proporcion

        lineasAsiento.push({
          cuentaContableId,
          debe: 0,
          haber: montoCuenta,
          centroCostoId: caja.centroCostoId ?? ccItemsFallback ?? null,
          descripcion: `Venta buffet - Comanda ${comanda.numero}`
        })
      }

      await generarAsientoAutomatico(req.db, {
        fecha: new Date(),
        concepto: `Venta Buffet - Comanda ${comanda.numero}`,
        tipoOrigen: 'VENTA_BUFFET',
        origenId: movimiento.id,
        registradoPor: req.admin.id,
        lineas: lineasAsiento
      })

      movimientos.push(movimiento)
    }

    // Actualizar y cerrar comanda
    const comandaActualizada = await req.db.comanda.update({
      where: { id: parseInt(id) },
      data: {
        estado: 'CERRADA',
        descuento: descuentoMonto,
        propina: propinaMonto,
        total: totalFinal,
        horaCierre: new Date(),
        cerradoPor: req.admin.id,
        esVentaInterna: esVentaInterna || false
      }
    })

    // Descontar stock para productos que tienen variantes
    await descontarStockVentaBuffet(
      req.db,
      comanda.items.filter(i => i.estado !== 'ANULADO'),
      req.admin.id,
      `Venta Buffet - Comanda ${comanda.numero}`
    )

    // Variables para facturación
    let comprobanteFiscal = null
    let ticketBase64 = null
    let qrUrl = null

    // Emitir factura si se solicita y no es venta interna
    if (emitirFactura && !esVentaInterna) {
      try {
        const { requestCAE, getLastAuthorizedNumber } = await import('../../services/afipWSFEService.js')
        const { getConfiguracionFiscal } = await import('../../services/afipWSAAService.js')
        const { generateQRData } = await import('../../services/afipQRService.js')
        const { renderTicketFiscal, toBase64 } = await import('../../services/ticketService.js')

        const config = await getConfiguracionFiscal()

        const cajaUsada = await req.db.caja.findUnique({ where: { id: cajaId || movimientos[0]?.cajaId } })
        const puntoVenta = cajaUsada?.puntoVentaAfip || 1

        // Determinar tipo de comprobante según condición IVA
        let tipoAfip
        if (datosCliente?.condicionIva === 1 || datosCliente?.condicionIva === 6) {
          tipoAfip = 1 // Factura A
        } else {
          tipoAfip = 6 // Factura B
        }

        const ultimoNumero = await getLastAuthorizedNumber(puntoVenta, tipoAfip)
        const numeroComprobante = ultimoNumero + 1

        const itemsFactura = comanda.items.map(item => ({
          descripcion: item.productoBuffet?.nombre || item.nombre || 'Producto',
          cantidad: item.cantidad,
          precioUnitario: parseFloat(item.precioUnitario),
          subtotal: parseFloat(item.subtotal),
          ivaRate: 21,
          ivaAmount: tipoAfip === 6 ? 0 : (parseFloat(item.subtotal) * 21) / 121
        }))

        const discriminaIva = tipoAfip === 1
        const subtotalNeto = discriminaIva ? itemsFactura.reduce((sum, i) => sum + (i.subtotal - i.ivaAmount), 0) : totalFinal
        const ivaTotal = discriminaIva ? itemsFactura.reduce((sum, i) => sum + i.ivaAmount, 0) : 0

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

        const tiposNombre = {
          1: 'FACTURA A', 6: 'FACTURA B', 11: 'FACTURA C',
          2: 'NOTA DE DEBITO A', 7: 'NOTA DE DEBITO B', 12: 'NOTA DE DEBITO C',
          3: 'NOTA DE CREDITO A', 8: 'NOTA DE CREDITO B', 13: 'NOTA DE CREDITO C'
        }

        comprobanteFiscal = await req.db.comprobanteElectronico.create({
          data: {
            tipo: tiposNombre[tipoAfip] || 'FACTURA B',
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
            comandaId: parseInt(id),
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
          empresa: {
            razonSocial: config.razonSocial,
            domicilio: config.domicilioFiscal,
            cuit: config.cuit,
            condicionIva: config.condicionIva,
            iibb: config.iibb || 'EXENTO',
            inicioActividades: config.inicioActividad ? new Date(config.inicioActividad).toLocaleDateString('es-AR') : null
          },
          comprobante: {
            tipo: tiposNombre[tipoAfip],
            tipoAfip,
            puntoVenta,
            numero: numeroComprobante,
            fecha: new Date(),
            cae: resultadoCAE.cae,
            fechaVtoCae: resultadoCAE.caeExpiration,
            cuit: config.cuit,
            nombreCliente: datosCliente?.nombre || 'Consumidor Final',
            tipoDocCliente: datosCliente?.tipoDoc || 99,
            docCliente: datosCliente?.documento,
            subtotal: subtotalNeto,
            iva: ivaTotal,
            total: totalFinal
          },
          comanda: comandaActualizada,
          items: itemsFactura
        })

        ticketBase64 = toBase64(ticketData)

        console.log(`[Buffet] Factura emitida: ${tiposNombre[tipoAfip]} ${puntoVenta}-${numeroComprobante} CAE: ${resultadoCAE.cae}`)
      } catch (facError) {
        console.error('Error emitiendo factura:', facError)
      }
    } else if (esVentaInterna || !emitirFactura) {
      // Generar ticket NO fiscal
      try {
        const { renderTicketNoFiscal, toBase64 } = await import('../../services/ticketService.js')

        const itemsTicket = comanda.items.map(item => ({
          nombre: item.productoBuffet?.nombre || item.nombre || 'Producto',
          cantidad: item.cantidad,
          precioUnitario: parseFloat(item.precioUnitario),
          subtotal: parseFloat(item.subtotal)
        }))

        let cajeroNombre = null
        if (req.admin?.id) {
          const cajero = await req.db.admin.findUnique({
            where: { id: req.admin.id },
            select: { nombre: true, apellido: true }
          })
          if (cajero) cajeroNombre = `${cajero.nombre} ${cajero.apellido || ''}`.trim()
        }

        const medioPago = await req.db.medioPago.findUnique({ where: { id: medioPagoId || pagosParciales?.[0]?.medioPagoId } })

        const ticketData = renderTicketNoFiscal({
          empresa: { razonSocial: 'CLUB SPORTIVO PILAR' },
          comanda: {
            ...comandaActualizada,
            metodoPago: medioPago?.nombre || 'VARIOS',
            cobradoPor: cajeroNombre
          },
          items: itemsTicket
        })

        ticketBase64 = toBase64(ticketData)
        console.log(`[Buffet] Ticket no fiscal generado para comanda ${comanda.numero}`)
      } catch (ticketError) {
        console.error('Error generando ticket no fiscal:', ticketError)
      }
    }

    // Generar ticket de comanda
    let ticketComandaBase64 = null
    try {
      const { renderTicketPreCuenta, toBase64 } = await import('../../services/ticketService.js')

      const itemsTicket = comanda.items
        .filter(item => item.estado !== 'ANULADO')
        .map(item => ({
          nombre: item.productoBuffet?.nombre || item.nombre || 'Producto',
          cantidad: item.cantidad,
          precioUnitario: parseFloat(item.precioUnitario),
          subtotal: parseFloat(item.subtotal)
        }))

      let mozoNombre = null
      if (comanda.creadoPorId) {
        const mozo = await req.db.admin.findUnique({
          where: { id: comanda.creadoPorId },
          select: { nombre: true, apellido: true }
        })
        if (mozo) mozoNombre = `${mozo.nombre} ${mozo.apellido || ''}`.trim()
      }

      const ticketComandaData = renderTicketPreCuenta({
        comanda: {
          id: comanda.id,
          numero: comanda.numero,
          mesa: comanda.mesa,
          createdAt: comanda.createdAt,
          mozo: mozoNombre
        },
        items: itemsTicket,
        descuento: descuentoMonto > 0 ? { porcentaje: descuentoPorcentaje, monto: descuentoMonto } : null,
        socio: comanda.socio ? { nombre: comanda.socio.nombre, apellido: comanda.socio.apellido } : null
      })

      ticketComandaBase64 = toBase64(ticketComandaData)
    } catch (ticketError) {
      console.error('Error generando ticket comanda:', ticketError)
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

        const medioPagoUsado = await req.db.medioPago.findUnique({
          where: { id: medioPagoId || pagosParciales?.[0]?.medioPagoId }
        })

        // Crear MovimientoContable - Factura Venta
        const numeroMCVenta = await generarNumeroMC(req.db)
        movimientoContableVenta = await req.db.movimientoContable.create({
          data: {
            numero: numeroMCVenta,
            tipo: 'FACTURA_VENTA',
            socioId: tipoCliente === 'SOCIO' && clienteId ? parseInt(clienteId) : (comanda.socioId || null),
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
            centroCostoId: caja.centroCostoId ?? ccItemsFallback,
            registradoPor: req.admin.id,
            observaciones: `Venta Buffet - Comanda ${comanda.numero}${comanda.mesa ? ` - Mesa ${comanda.mesa.numero}` : ''}`
          },
          include: {
            socio: { select: { id: true, apellidoNombre: true } },
            entidad: { select: { id: true, razonSocial: true } }
          }
        })

        // Generar asiento de venta
        const asientoVenta = await generarAsientoFacturaVenta(req.db, {
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
            centroCostoId: caja.centroCostoId ?? ccItemsFallback,
            socio: movimientoContableVenta.socio,
            entidad: movimientoContableVenta.entidad
          },
          concepto: null,
          registradoPor: req.admin.id
        })

        if (asientoVenta) {
          console.log(`[Buffet] Asiento de venta creado: ${asientoVenta.numero}`)
        }

        // Crear MovimientoContable - Recibo Cobro
        const numeroMCCobro = await generarNumeroMC(req.db)
        movimientoContableCobro = await req.db.movimientoContable.create({
          data: {
            numero: numeroMCCobro,
            tipo: 'RECIBO_COBRO',
            socioId: tipoCliente === 'SOCIO' && clienteId ? parseInt(clienteId) : (comanda.socioId || null),
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
            centroCostoId: caja.centroCostoId ?? ccItemsFallback,
            registradoPor: req.admin.id,
            observaciones: `Cobro Venta Buffet - Comanda ${comanda.numero}`
          },
          include: {
            socio: { select: { id: true, apellidoNombre: true } },
            entidad: { select: { id: true, razonSocial: true } }
          }
        })

        // Generar asiento de cobranza
        const asientoCobro = await generarAsientoReciboCobro(req.db, {
          recibo: {
            id: movimientoContableCobro.id,
            numero: numeroMCCobro,
            fecha: new Date(),
            montoTotal: totalFinal,
            centroCostoId: caja.centroCostoId ?? ccItemsFallback,
            socio: movimientoContableCobro.socio,
            entidad: movimientoContableCobro.entidad
          },
          caja: cajaUsada,
          registradoPor: req.admin.id
        })

        if (asientoCobro) {
          console.log(`[Buffet] Asiento de cobranza creado: ${asientoCobro.numero}`)
        }

        // Vincular MovimientoCaja con MovimientoContable
        for (const mov of movimientos) {
          await req.db.movimientoCaja.update({
            where: { id: mov.id },
            data: { movimientoContableId: movimientoContableCobro.id }
          })
        }

        // Vincular ComprobanteElectronico
        if (comprobanteFiscal) {
          await req.db.comprobanteElectronico.update({
            where: { id: comprobanteFiscal.id },
            data: { movimientoContableId: movimientoContableVenta.id }
          })
        }

        console.log(`[Buffet] Integración con Ingresos completada para comanda ${comanda.numero}`)
      } catch (mcError) {
        console.error('Error creando MovimientoContable/Asientos:', mcError)
      }
    }

    // Liberar mesa
    const mesaActualizada = await req.db.mesa.update({
      where: { id: comanda.mesaId },
      data: { estado: 'LIMPIEZA' }
    })

    notificarMesaCobrada(mesaActualizada, comanda).catch(err =>
      console.error('Error notificando mesa cobrada:', err)
    )

    res.json({
      success: true,
      data: {
        comanda: comandaActualizada,
        movimientos,
        descuentoAplicado: descuentoMonto > 0 ? { porcentaje: descuentoPorcentaje, monto: descuentoMonto } : null,
        propinaAplicada: propinaMonto > 0 ? propinaMonto : null,
        comprobante: comprobanteFiscal,
        ticket: ticketBase64,
        ticketComanda: ticketComandaBase64,
        qrUrl
      }
    })
  } catch (error) {
    console.error('Error al cobrar comanda:', error)
    const statusCode = error.statusCode || 500
    const message = statusCode < 500 ? error.message : 'Error al cobrar comanda'
    res.status(statusCode).json({ success: false, error: message })
  }
})

/**
 * POST /comandas/:id/cerrar
 * Cerrar mesa (después de limpiar)
 */
router.post('/comandas/:id/cerrar', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { id } = req.params

    const comanda = await req.db.comanda.findUnique({
      where: { id: parseInt(id) },
      include: { mesa: true }
    })

    if (!comanda) {
      return res.status(404).json({ success: false, error: 'Comanda no encontrada' })
    }

    await req.db.comanda.update({
      where: { id: parseInt(id) },
      data: {
        estado: 'CERRADA',
        horaCierre: new Date(),
        cerradoPor: req.admin.id
      }
    })

    const comandasActivas = await req.db.comanda.count({
      where: {
        mesaId: comanda.mesaId,
        estado: { in: ['ABIERTA', 'EN_PREPARACION', 'CUENTA_PEDIDA'] }
      }
    })

    if (comandasActivas === 0) {
      await req.db.mesa.update({
        where: { id: comanda.mesaId },
        data: { estado: 'LIBRE' }
      })
    }

    res.json({ success: true, message: 'Mesa liberada' })
  } catch (error) {
    console.error('Error al cerrar mesa:', error)
    res.status(500).json({ success: false, error: 'Error al cerrar mesa' })
  }
})

export default router
