/**
 * Rutas de Cocina y KDS del Buffet
 * - KDS genérico por sector
 * - Cocina (KDS)
 * - Barra (bebidas)
 */
import express from 'express'
import prisma from '../../lib/prisma.js'
import { authAdmin, checkPermiso } from '../../middleware/auth.js'
import { notificarItemListo } from '../../services/socketService.js'

const router = express.Router()

// ============================================================================
// KDS GENÉRICO (por tipo de impresora/sector)
// ============================================================================

/**
 * GET /kds/sectores
 * Obtener sectores disponibles para KDS
 */
router.get('/kds/sectores', authAdmin, async (req, res) => {
  try {
    const sectores = await prisma.sectorBuffet.findMany({
      where: { activo: true },
      orderBy: { orden: 'asc' },
      select: { id: true, codigo: true, nombre: true, icono: true, color: true }
    })

    res.json({ success: true, data: sectores })
  } catch (error) {
    console.error('Error al listar sectores:', error)
    res.status(500).json({ success: false, error: 'Error al listar sectores' })
  }
})

/**
 * GET /kds/:sector/pendientes
 * Items pendientes para un sector específico (incluye LISTOS recientes para vista Kanban)
 */
router.get('/kds/:sector/pendientes', authAdmin, async (req, res) => {
  try {
    const { sector } = req.params
    const { incluirListos } = req.query

    const sectorId = parseInt(sector)
    const sectorData = await prisma.sectorBuffet.findFirst({
      where: isNaN(sectorId)
        ? { codigo: sector.toUpperCase(), activo: true }
        : { id: sectorId, activo: true }
    })

    if (!sectorData) {
      return res.json({ success: true, data: [] })
    }

    const destinos = await prisma.destinoImpresion.findMany({
      where: {
        impresora: { sectorId: sectorData.id, activo: true }
      },
      select: { categoriaMenuId: true }
    })
    const categoriasIds = destinos.map(d => d.categoriaMenuId)

    if (categoriasIds.length === 0) {
      return res.json({ success: true, data: [] })
    }

    let estadosPendientes = []
    if (sectorData.codigo === 'BARRA') {
      estadosPendientes = ['ENVIADO_BARRA', 'EN_PREPARACION']
    } else if (sectorData.codigo === 'COCINA') {
      estadosPendientes = ['ENVIADO_COCINA', 'EN_PREPARACION']
    } else {
      estadosPendientes = ['ENVIADO_COCINA', 'ENVIADO_BARRA', 'EN_PREPARACION']
    }

    // Incluir LISTO si se solicita (para vista Kanban)
    if (incluirListos === 'true') {
      estadosPendientes.push('LISTO')
    }

    // Filtro de tiempo para items LISTOS (últimos 30 minutos)
    const hace30Min = new Date(Date.now() - 30 * 60 * 1000)

    const itemsComanda = await prisma.itemComanda.findMany({
      where: {
        estado: { in: estadosPendientes },
        productoBuffet: { categoriaMenuId: { in: categoriasIds } },
        OR: [
          { estado: { not: 'LISTO' } },
          { listoAt: { gte: hace30Min } }
        ]
      },
      include: {
        productoBuffet: { include: { categoriaMenu: true } },
        comanda: { include: { mesa: true } }
      },
      orderBy: { enviadoCocinaAt: 'asc' }
    })

    const itemsTakeAway = await prisma.itemPedidoTakeAway.findMany({
      where: {
        estado: { in: estadosPendientes },
        productoBuffet: { categoriaMenuId: { in: categoriasIds } }
      },
      include: {
        productoBuffet: { include: { categoriaMenu: true } },
        pedido: true
      },
      orderBy: { createdAt: 'asc' }
    })

    const pendientes = [
      ...itemsComanda.map(item => ({
        id: item.id,
        tipo: 'COMANDA',
        origen: `Mesa ${item.comanda.mesa.numero}`,
        origenId: item.comanda.id,
        producto: item.productoBuffet.nombre,
        categoria: item.productoBuffet.categoriaMenu?.nombre,
        cantidad: item.cantidad,
        observaciones: item.observaciones,
        estado: item.estado,
        horaEnvio: item.enviadoCocinaAt,
        listoAt: item.listoAt,
        tiempoEspera: item.enviadoCocinaAt ? Math.floor((new Date() - new Date(item.enviadoCocinaAt)) / 60000) : 0
      })),
      ...itemsTakeAway.map(item => ({
        id: item.id,
        tipo: 'TAKEAWAY',
        origen: `Take Away ${item.pedido.numero}`,
        origenId: item.pedido.id,
        producto: item.productoBuffet.nombre,
        categoria: item.productoBuffet.categoriaMenu?.nombre,
        cantidad: item.cantidad,
        observaciones: item.observaciones,
        estado: item.estado,
        horaEnvio: item.createdAt,
        tiempoEspera: Math.floor((new Date() - new Date(item.createdAt)) / 60000)
      }))
    ].sort((a, b) => new Date(a.horaEnvio) - new Date(b.horaEnvio))

    res.json({ success: true, data: pendientes })
  } catch (error) {
    console.error('Error al listar pendientes KDS:', error)
    res.status(500).json({ success: false, error: 'Error al listar pendientes' })
  }
})

/**
 * GET /kds/expo/todos
 * Vista EXPO: todos los items de todos los sectores
 */
router.get('/kds/expo/todos', authAdmin, async (req, res) => {
  try {
    const hace30Min = new Date(Date.now() - 30 * 60 * 1000)

    const itemsComanda = await prisma.itemComanda.findMany({
      where: {
        estado: { in: ['ENVIADO_COCINA', 'ENVIADO_BARRA', 'EN_PREPARACION', 'LISTO'] },
        OR: [
          { estado: { not: 'LISTO' } },
          { listoAt: { gte: hace30Min } }
        ]
      },
      include: {
        productoBuffet: { include: { categoriaMenu: true } },
        comanda: { include: { mesa: true } }
      },
      orderBy: { enviadoCocinaAt: 'asc' }
    })

    const itemsTakeAway = await prisma.itemPedidoTakeAway.findMany({
      where: {
        estado: { in: ['ENVIADO_COCINA', 'ENVIADO_BARRA', 'EN_PREPARACION', 'LISTO'] }
      },
      include: {
        productoBuffet: { include: { categoriaMenu: true } },
        pedido: true
      },
      orderBy: { createdAt: 'asc' }
    })

    const todos = [
      ...itemsComanda.map(item => ({
        id: item.id,
        tipo: 'COMANDA',
        origen: `Mesa ${item.comanda.mesa.numero}`,
        origenId: item.comanda.id,
        producto: item.productoBuffet.nombre,
        categoria: item.productoBuffet.categoriaMenu?.nombre,
        cantidad: item.cantidad,
        observaciones: item.observaciones,
        estado: item.estado,
        horaEnvio: item.enviadoCocinaAt,
        listoAt: item.listoAt,
        tiempoEspera: item.enviadoCocinaAt ? Math.floor((new Date() - new Date(item.enviadoCocinaAt)) / 60000) : 0
      })),
      ...itemsTakeAway.map(item => ({
        id: item.id,
        tipo: 'TAKEAWAY',
        origen: `Take Away ${item.pedido.numero}`,
        origenId: item.pedido.id,
        producto: item.productoBuffet.nombre,
        categoria: item.productoBuffet.categoriaMenu?.nombre,
        cantidad: item.cantidad,
        observaciones: item.observaciones,
        estado: item.estado,
        horaEnvio: item.createdAt,
        tiempoEspera: Math.floor((new Date() - new Date(item.createdAt)) / 60000)
      }))
    ].sort((a, b) => new Date(a.horaEnvio) - new Date(b.horaEnvio))

    res.json({ success: true, data: todos })
  } catch (error) {
    console.error('Error al listar todos items KDS:', error)
    res.status(500).json({ success: false, error: 'Error al listar items' })
  }
})

/**
 * PUT /kds/items/:id/entregar
 * Marcar item como entregado (sale de la vista KDS)
 */
router.put('/kds/items/:id/entregar', authAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { tipo } = req.body

    if (tipo === 'COMANDA') {
      await prisma.itemComanda.update({
        where: { id: parseInt(id) },
        data: { estado: 'ENTREGADO' }
      })
    } else {
      await prisma.itemPedidoTakeAway.update({
        where: { id: parseInt(id) },
        data: { estado: 'ENTREGADO' }
      })
    }

    res.json({ success: true, message: 'Item entregado' })
  } catch (error) {
    console.error('Error al entregar item:', error)
    res.status(500).json({ success: false, error: 'Error al actualizar item' })
  }
})

/**
 * PUT /kds/items/:id/preparando
 * Marcar item en preparación (genérico)
 */
router.put('/kds/items/:id/preparando', authAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { tipo } = req.body

    if (tipo === 'COMANDA') {
      await prisma.itemComanda.update({
        where: { id: parseInt(id) },
        data: { estado: 'EN_PREPARACION' }
      })
    } else {
      await prisma.itemPedidoTakeAway.update({
        where: { id: parseInt(id) },
        data: { estado: 'EN_PREPARACION' }
      })
    }

    res.json({ success: true, message: 'Item marcado en preparación' })
  } catch (error) {
    console.error('Error al marcar preparando:', error)
    res.status(500).json({ success: false, error: 'Error al actualizar item' })
  }
})

/**
 * PUT /kds/items/:id/listo
 * Marcar item listo (genérico)
 */
router.put('/kds/items/:id/listo', authAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { tipo } = req.body

    if (tipo === 'COMANDA') {
      const item = await prisma.itemComanda.update({
        where: { id: parseInt(id) },
        data: { estado: 'LISTO', listoAt: new Date() },
        include: {
          productoBuffet: true,
          comanda: { include: { mesa: true } }
        }
      })

      await notificarItemListo(item, item.comanda)
    } else {
      await prisma.itemPedidoTakeAway.update({
        where: { id: parseInt(id) },
        data: { estado: 'LISTO' }
      })
    }

    res.json({ success: true, message: 'Item marcado como listo' })
  } catch (error) {
    console.error('Error al marcar listo:', error)
    res.status(500).json({ success: false, error: 'Error al actualizar item' })
  }
})

/**
 * PUT /kds/items/:id/revertir
 * Retroceder item un estado (ENTREGADO → PREPARANDO, LISTO → PREPARANDO, PREPARANDO → NUEVO)
 * Usado para: errores de tap, comida fría que hay que recalentar, etc.
 */
router.put('/kds/items/:id/revertir', authAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { tipo, motivo } = req.body

    if (tipo === 'COMANDA') {
      const item = await prisma.itemComanda.findUnique({
        where: { id: parseInt(id) },
        include: {
          productoBuffet: {
            include: {
              categoriaMenu: {
                include: {
                  destinosImpresion: { include: { impresora: true } }
                }
              }
            }
          }
        }
      })

      if (!item) {
        return res.status(404).json({ success: false, error: 'Item no encontrado' })
      }

      let nuevoEstado
      const updateData = {}

      if (item.estado === 'ENTREGADO') {
        // Devolución: vuelve a preparación (ej: recalentar, rehacer)
        nuevoEstado = 'EN_PREPARACION'
        updateData.listoAt = null
        // Agregar motivo a observaciones si se proporciona
        if (motivo) {
          updateData.observaciones = item.observaciones
            ? `${item.observaciones} | DEVOLUCIÓN: ${motivo}`
            : `DEVOLUCIÓN: ${motivo}`
        }
      } else if (item.estado === 'LISTO') {
        nuevoEstado = 'EN_PREPARACION'
        updateData.listoAt = null
      } else if (item.estado === 'EN_PREPARACION') {
        // Determinar si va a COCINA o BARRA según el destino de impresión
        const destino = item.productoBuffet?.categoriaMenu?.destinosImpresion?.[0]?.impresora?.tipo
        nuevoEstado = destino === 'BARRA' ? 'ENVIADO_BARRA' : 'ENVIADO_COCINA'
      } else {
        return res.status(400).json({ success: false, error: 'No se puede retroceder desde este estado' })
      }

      updateData.estado = nuevoEstado

      await prisma.itemComanda.update({
        where: { id: parseInt(id) },
        data: updateData
      })
    } else {
      // TakeAway
      const item = await prisma.itemPedidoTakeAway.findUnique({
        where: { id: parseInt(id) },
        include: {
          productoBuffet: {
            include: {
              categoriaMenu: {
                include: {
                  destinosImpresion: { include: { impresora: true } }
                }
              }
            }
          }
        }
      })

      if (!item) {
        return res.status(404).json({ success: false, error: 'Item no encontrado' })
      }

      let nuevoEstado
      const updateData = {}

      if (item.estado === 'ENTREGADO') {
        nuevoEstado = 'EN_PREPARACION'
        if (motivo) {
          updateData.observaciones = item.observaciones
            ? `${item.observaciones} | DEVOLUCIÓN: ${motivo}`
            : `DEVOLUCIÓN: ${motivo}`
        }
      } else if (item.estado === 'LISTO') {
        nuevoEstado = 'EN_PREPARACION'
      } else if (item.estado === 'EN_PREPARACION') {
        const destino = item.productoBuffet?.categoriaMenu?.destinosImpresion?.[0]?.impresora?.tipo
        nuevoEstado = destino === 'BARRA' ? 'ENVIADO_BARRA' : 'ENVIADO_COCINA'
      } else {
        return res.status(400).json({ success: false, error: 'No se puede retroceder desde este estado' })
      }

      updateData.estado = nuevoEstado

      await prisma.itemPedidoTakeAway.update({
        where: { id: parseInt(id) },
        data: updateData
      })
    }

    res.json({ success: true, message: 'Item retrocedido al estado anterior' })
  } catch (error) {
    console.error('Error al revertir estado:', error)
    res.status(500).json({ success: false, error: 'Error al revertir estado' })
  }
})

// ============================================================================
// COCINA (KDS) - Mantener por compatibilidad
// ============================================================================

/**
 * GET /cocina/pendientes
 * Items pendientes para cocina
 */
router.get('/cocina/pendientes', authAdmin, checkPermiso('BUFFET_COCINA'), async (req, res) => {
  try {
    const destinosCocina = await prisma.destinoImpresion.findMany({
      where: { impresora: { tipo: 'COCINA', activo: true } },
      select: { categoriaMenuId: true }
    })
    const categoriasCocinaIds = destinosCocina.map(d => d.categoriaMenuId)

    const itemsComanda = await prisma.itemComanda.findMany({
      where: {
        estado: { in: ['ENVIADO_COCINA', 'EN_PREPARACION'] },
        productoBuffet: { categoriaMenuId: { in: categoriasCocinaIds } }
      },
      include: {
        productoBuffet: { include: { categoriaMenu: true } },
        comanda: { include: { mesa: true } }
      },
      orderBy: { enviadoCocinaAt: 'asc' }
    })

    const itemsTakeAway = await prisma.itemPedidoTakeAway.findMany({
      where: {
        estado: { in: ['EN_PREPARACION'] },
        productoBuffet: { categoriaMenuId: { in: categoriasCocinaIds } }
      },
      include: {
        productoBuffet: { include: { categoriaMenu: true } },
        pedido: true
      },
      orderBy: { createdAt: 'asc' }
    })

    const pendientes = [
      ...itemsComanda.map(item => ({
        id: item.id,
        tipo: 'COMANDA',
        origen: `Mesa ${item.comanda.mesa.numero}`,
        origenId: item.comanda.id,
        producto: item.productoBuffet.nombre,
        categoria: item.productoBuffet.categoriaMenu?.nombre,
        cantidad: item.cantidad,
        observaciones: item.observaciones,
        estado: item.estado,
        horaEnvio: item.enviadoCocinaAt,
        tiempoEspera: item.enviadoCocinaAt ? Math.floor((new Date() - new Date(item.enviadoCocinaAt)) / 60000) : 0
      })),
      ...itemsTakeAway.map(item => ({
        id: item.id,
        tipo: 'TAKEAWAY',
        origen: `Take Away ${item.pedido.numero}`,
        origenId: item.pedido.id,
        producto: item.productoBuffet.nombre,
        categoria: item.productoBuffet.categoriaMenu?.nombre,
        cantidad: item.cantidad,
        observaciones: item.observaciones,
        estado: item.estado,
        horaEnvio: item.createdAt,
        tiempoEspera: Math.floor((new Date() - new Date(item.createdAt)) / 60000)
      }))
    ].sort((a, b) => new Date(a.horaEnvio) - new Date(b.horaEnvio))

    res.json({ success: true, data: pendientes })
  } catch (error) {
    console.error('Error al listar pendientes cocina:', error)
    res.status(500).json({ success: false, error: 'Error al listar pendientes' })
  }
})

/**
 * PUT /cocina/items/:id/preparando
 * Marcar item en preparación (cocina)
 */
router.put('/cocina/items/:id/preparando', authAdmin, checkPermiso('BUFFET_COCINA'), async (req, res) => {
  try {
    const { id } = req.params
    const { tipo } = req.body

    if (tipo === 'COMANDA') {
      await prisma.itemComanda.update({
        where: { id: parseInt(id) },
        data: { estado: 'EN_PREPARACION' }
      })
    } else {
      await prisma.itemPedidoTakeAway.update({
        where: { id: parseInt(id) },
        data: { estado: 'EN_PREPARACION' }
      })
    }

    res.json({ success: true, message: 'Item marcado en preparación' })
  } catch (error) {
    console.error('Error al marcar preparando:', error)
    res.status(500).json({ success: false, error: 'Error al actualizar item' })
  }
})

/**
 * PUT /cocina/items/:id/listo
 * Marcar item listo (cocina)
 */
router.put('/cocina/items/:id/listo', authAdmin, checkPermiso('BUFFET_COCINA'), async (req, res) => {
  try {
    const { id } = req.params
    const { tipo } = req.body

    if (tipo === 'COMANDA') {
      const item = await prisma.itemComanda.update({
        where: { id: parseInt(id) },
        data: { estado: 'LISTO', listoAt: new Date() },
        include: {
          productoBuffet: true,
          comanda: { include: { mesa: true, items: true } }
        }
      })

      notificarItemListo(item, item.comanda).catch(err =>
        console.error('Error notificando item listo:', err)
      )

      const otrosItemsPendientes = item.comanda.items.filter(i =>
        i.id !== item.id && !['LISTO', 'ENTREGADO', 'ANULADO'].includes(i.estado)
      )

      if (otrosItemsPendientes.length === 0 && item.comanda.estado === 'EN_PREPARACION') {
        await prisma.comanda.update({
          where: { id: item.comanda.id },
          data: { estado: 'ABIERTA' }
        })
      }
    } else {
      await prisma.itemPedidoTakeAway.update({
        where: { id: parseInt(id) },
        data: { estado: 'LISTO' }
      })
    }

    res.json({ success: true, message: 'Item marcado como listo' })
  } catch (error) {
    console.error('Error al marcar listo:', error)
    res.status(500).json({ success: false, error: 'Error al actualizar item' })
  }
})

// ============================================================================
// BARRA (bebidas)
// ============================================================================

/**
 * GET /barra/pendientes
 * Items pendientes para barra
 */
router.get('/barra/pendientes', authAdmin, checkPermiso('BUFFET_BARRA'), async (req, res) => {
  try {
    const destinosBarra = await prisma.destinoImpresion.findMany({
      where: { impresora: { tipo: 'BARRA', activo: true } },
      select: { categoriaMenuId: true }
    })
    const categoriasBarraIds = destinosBarra.map(d => d.categoriaMenuId)

    const itemsComanda = await prisma.itemComanda.findMany({
      where: {
        estado: { in: ['ENVIADO_COCINA', 'EN_PREPARACION'] },
        productoBuffet: { categoriaMenuId: { in: categoriasBarraIds } }
      },
      include: {
        productoBuffet: { include: { categoriaMenu: true } },
        comanda: { include: { mesa: true } }
      },
      orderBy: { enviadoCocinaAt: 'asc' }
    })

    const itemsTakeAway = await prisma.itemPedidoTakeAway.findMany({
      where: {
        estado: { in: ['EN_PREPARACION'] },
        productoBuffet: { categoriaMenuId: { in: categoriasBarraIds } }
      },
      include: {
        productoBuffet: { include: { categoriaMenu: true } },
        pedido: true
      },
      orderBy: { createdAt: 'asc' }
    })

    const pendientes = [
      ...itemsComanda.map(item => ({
        id: item.id,
        tipo: 'COMANDA',
        origen: `Mesa ${item.comanda.mesa.numero}`,
        origenId: item.comanda.id,
        producto: item.productoBuffet.nombre,
        categoria: item.productoBuffet.categoriaMenu?.nombre,
        cantidad: item.cantidad,
        observaciones: item.observaciones,
        estado: item.estado,
        horaEnvio: item.enviadoCocinaAt,
        tiempoEspera: item.enviadoCocinaAt ? Math.floor((new Date() - new Date(item.enviadoCocinaAt)) / 60000) : 0
      })),
      ...itemsTakeAway.map(item => ({
        id: item.id,
        tipo: 'TAKEAWAY',
        origen: `Take Away ${item.pedido.numero}`,
        origenId: item.pedido.id,
        producto: item.productoBuffet.nombre,
        categoria: item.productoBuffet.categoriaMenu?.nombre,
        cantidad: item.cantidad,
        observaciones: item.observaciones,
        estado: item.estado,
        horaEnvio: item.createdAt,
        tiempoEspera: Math.floor((new Date() - new Date(item.createdAt)) / 60000)
      }))
    ].sort((a, b) => new Date(a.horaEnvio) - new Date(b.horaEnvio))

    res.json({ success: true, data: pendientes })
  } catch (error) {
    console.error('Error al listar pendientes barra:', error)
    res.status(500).json({ success: false, error: 'Error al listar pendientes' })
  }
})

/**
 * PUT /barra/items/:id/preparando
 * Marcar item en preparación (barra)
 */
router.put('/barra/items/:id/preparando', authAdmin, checkPermiso('BUFFET_BARRA'), async (req, res) => {
  try {
    const { id } = req.params
    const { tipo } = req.body

    if (tipo === 'COMANDA') {
      await prisma.itemComanda.update({
        where: { id: parseInt(id) },
        data: { estado: 'EN_PREPARACION' }
      })
    } else {
      await prisma.itemPedidoTakeAway.update({
        where: { id: parseInt(id) },
        data: { estado: 'EN_PREPARACION' }
      })
    }

    res.json({ success: true, message: 'Item marcado en preparación' })
  } catch (error) {
    console.error('Error al marcar preparando:', error)
    res.status(500).json({ success: false, error: 'Error al actualizar item' })
  }
})

/**
 * PUT /barra/items/:id/listo
 * Marcar item listo (barra)
 */
router.put('/barra/items/:id/listo', authAdmin, checkPermiso('BUFFET_BARRA'), async (req, res) => {
  try {
    const { id } = req.params
    const { tipo } = req.body

    if (tipo === 'COMANDA') {
      const item = await prisma.itemComanda.update({
        where: { id: parseInt(id) },
        data: { estado: 'LISTO', listoAt: new Date() },
        include: {
          productoBuffet: true,
          comanda: { include: { mesa: true } }
        }
      })

      await notificarItemListo(item, item.comanda)
    } else {
      await prisma.itemPedidoTakeAway.update({
        where: { id: parseInt(id) },
        data: { estado: 'LISTO' }
      })
    }

    res.json({ success: true, message: 'Item marcado como listo' })
  } catch (error) {
    console.error('Error al marcar listo:', error)
    res.status(500).json({ success: false, error: 'Error al actualizar item' })
  }
})

export default router
