/**
 * Rutas de Mesas del Buffet
 * - CRUD de mesas
 * - Asignación de mozos
 * - Estado de mesas
 */
import express from 'express'
import prisma from '../../lib/prisma.js'
import { authAdmin, checkPermiso } from '../../middleware/auth.js'

const router = express.Router()

// ============================================================================
// MESAS - Listados y Estado
// ============================================================================

/**
 * GET /mesas
 * Listar todas las mesas
 */
router.get('/mesas', authAdmin, checkPermiso('BUFFET_VER'), async (req, res) => {
  try {
    const { activo } = req.query

    const where = {}
    if (activo !== undefined) where.activo = activo === 'true'

    const mesas = await req.db.mesa.findMany({
      where,
      orderBy: { numero: 'asc' },
      include: {
        comandas: {
          where: { estado: { in: ['ABIERTA', 'EN_PREPARACION', 'CUENTA_PEDIDA'] } },
          include: {
            items: { include: { productoBuffet: true } },
            socio: { select: { id: true, nroSocio: true, apellidoNombre: true } }
          }
        }
      }
    })

    res.json({ success: true, data: mesas })
  } catch (error) {
    console.error('Error al listar mesas:', error)
    res.status(500).json({ success: false, error: 'Error al listar mesas' })
  }
})

/**
 * GET /mesas/estado
 * Estado de mesas para dashboard visual
 */
router.get('/mesas/estado', authAdmin, checkPermiso('BUFFET_VER'), async (req, res) => {
  try {
    const { misMesas } = req.query

    const where = { activo: true }

    if (misMesas === 'true') {
      where.mozoAsignadoId = req.admin.id
    }

    const mesas = await req.db.mesa.findMany({
      where,
      orderBy: { numero: 'asc' },
      include: {
        mozoAsignado: {
          select: { id: true, nombre: true, apellido: true }
        },
        comandas: {
          where: { estado: { in: ['ABIERTA', 'EN_PREPARACION', 'CUENTA_PEDIDA'] } },
          select: {
            id: true,
            numero: true,
            estado: true,
            horaApertura: true,
            total: true,
            observaciones: true,
            socio: { select: { nroSocio: true, apellidoNombre: true } },
            items: {
              select: { id: true, estado: true }
            },
            _count: { select: { items: true } }
          }
        }
      }
    })

    const mesasConInfo = mesas.map(mesa => ({
      id: mesa.id,
      numero: mesa.numero,
      nombre: mesa.nombre,
      capacidad: mesa.capacidad,
      zona: mesa.zona,
      estado: mesa.estado,
      esComunal: mesa.esComunal,
      mozoAsignado: mesa.mozoAsignado,
      comandas: mesa.comandas,
      comanda: mesa.comandas[0] || null,
      tiempoOcupada: mesa.comandas[0]?.horaApertura
        ? Math.floor((new Date() - new Date(mesa.comandas[0].horaApertura)) / 60000)
        : null
    }))

    res.json({ success: true, data: mesasConInfo })
  } catch (error) {
    console.error('Error al obtener estado mesas:', error)
    res.status(500).json({ success: false, error: 'Error al obtener estado' })
  }
})

/**
 * GET /mesas/:id
 * Obtener mesa por ID
 */
router.get('/mesas/:id', authAdmin, checkPermiso('BUFFET_VER'), async (req, res) => {
  try {
    const { id } = req.params

    const mesa = await req.db.mesa.findUnique({
      where: { id: parseInt(id) },
      include: {
        comandas: {
          where: { estado: { in: ['ABIERTA', 'EN_PREPARACION', 'CUENTA_PEDIDA'] } },
          include: {
            items: { include: { productoBuffet: true } },
            socio: { select: { id: true, nroSocio: true, apellidoNombre: true } }
          }
        }
      }
    })

    if (!mesa) {
      return res.status(404).json({ success: false, error: 'Mesa no encontrada' })
    }

    // Recalcular estado de comandas según items
    for (const comanda of mesa.comandas) {
      if (comanda.estado === 'EN_PREPARACION' && comanda.items.length > 0) {
        const todosProcesados = comanda.items.every(item =>
          ['LISTO', 'ENTREGADO', 'ANULADO'].includes(item.estado)
        )

        if (todosProcesados) {
          await req.db.comanda.update({
            where: { id: comanda.id },
            data: { estado: 'ABIERTA' }
          })
          comanda.estado = 'ABIERTA'
        }
      }
    }

    res.json({ success: true, data: mesa })
  } catch (error) {
    console.error('Error al obtener mesa:', error)
    res.status(500).json({ success: false, error: 'Error al obtener mesa' })
  }
})

// ============================================================================
// MESAS - CRUD
// ============================================================================

/**
 * POST /mesas
 * Crear mesa
 */
router.post('/mesas', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { numero, nombre, capacidad, zona, esComunal } = req.body

    const existente = await req.db.mesa.findUnique({ where: { numero } })
    if (existente) {
      return res.status(400).json({ success: false, error: 'Ya existe una mesa con ese número' })
    }

    const mesa = await req.db.mesa.create({
      data: {
        numero,
        nombre: nombre || `Mesa ${numero}`,
        capacidad: capacidad || 4,
        zona,
        esComunal: esComunal || false
      }
    })

    res.status(201).json({ success: true, data: mesa })
  } catch (error) {
    console.error('Error al crear mesa:', error)
    res.status(500).json({ success: false, error: 'Error al crear mesa' })
  }
})

/**
 * PUT /mesas/:id
 * Actualizar mesa
 */
router.put('/mesas/:id', authAdmin, checkPermiso('BUFFET_CONFIG', 'BUFFET_MESAS'), async (req, res) => {
  try {
    const { id } = req.params
    const { numero, nombre, capacidad, zona, activo, esComunal, estado } = req.body

    const updateData = {}
    if (numero !== undefined) updateData.numero = numero
    if (nombre !== undefined) updateData.nombre = nombre
    if (capacidad !== undefined) updateData.capacidad = capacidad
    if (zona !== undefined) updateData.zona = zona
    if (activo !== undefined) updateData.activo = activo
    if (esComunal !== undefined) updateData.esComunal = esComunal
    if (estado !== undefined) updateData.estado = estado

    // Si se pasa a LIBRE, cerrar todas las comandas activas
    if (estado === 'LIBRE') {
      await req.db.comanda.updateMany({
        where: {
          mesaId: parseInt(id),
          estado: { in: ['ABIERTA', 'EN_PREPARACION', 'CUENTA_PEDIDA'] }
        },
        data: {
          estado: 'CERRADA',
          horaCierre: new Date(),
          cerradoPor: req.admin.id
        }
      })
    }

    const mesa = await req.db.mesa.update({
      where: { id: parseInt(id) },
      data: updateData
    })

    res.json({ success: true, data: mesa })
  } catch (error) {
    console.error('Error al actualizar mesa:', error)
    res.status(500).json({ success: false, error: 'Error al actualizar mesa' })
  }
})

/**
 * DELETE /mesas/:id
 * Eliminar mesa
 */
router.delete('/mesas/:id', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { id } = req.params

    const comandasActivas = await req.db.comanda.count({
      where: { mesaId: parseInt(id), estado: { in: ['ABIERTA', 'EN_PREPARACION', 'CUENTA_PEDIDA'] } }
    })

    if (comandasActivas > 0) {
      return res.status(400).json({ success: false, error: 'No se puede eliminar una mesa con comandas activas' })
    }

    await req.db.mesa.delete({ where: { id: parseInt(id) } })

    res.json({ success: true, message: 'Mesa eliminada' })
  } catch (error) {
    console.error('Error al eliminar mesa:', error)
    res.status(500).json({ success: false, error: 'Error al eliminar mesa' })
  }
})

/**
 * PUT /mesas/:id/estado
 * Cambiar estado de mesa
 */
router.put('/mesas/:id/estado', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { id } = req.params
    const { estado } = req.body

    const estadosValidos = ['LIBRE', 'OCUPADA', 'CUENTA_PEDIDA', 'LIMPIEZA']
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ success: false, error: 'Estado inválido' })
    }

    if (estado === 'LIBRE') {
      await req.db.comanda.updateMany({
        where: {
          mesaId: parseInt(id),
          estado: { in: ['ABIERTA', 'EN_PREPARACION', 'CUENTA_PEDIDA'] }
        },
        data: {
          estado: 'CERRADA',
          horaCierre: new Date(),
          cerradoPor: req.admin.id
        }
      })
    }

    const mesa = await req.db.mesa.update({
      where: { id: parseInt(id) },
      data: { estado }
    })

    res.json({ success: true, data: mesa })
  } catch (error) {
    console.error('Error al cambiar estado de mesa:', error)
    res.status(500).json({ success: false, error: 'Error al cambiar estado' })
  }
})

// ============================================================================
// MOZOS - Asignación
// ============================================================================

/**
 * GET /mozos
 * Listar mozos disponibles para asignación
 */
router.get('/mozos', authAdmin, checkPermiso('BUFFET_VER'), async (req, res) => {
  try {
    const admins = await prisma.admin.findMany({
      where: {
        activo: true,
        rol: {
          permisos: {
            some: {
              permiso: { codigo: 'BUFFET_MESAS' }
            }
          }
        }
      },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        email: true,
        _count: {
          select: {
            mesasAsignadas: {
              where: { activo: true }
            }
          }
        }
      },
      orderBy: { nombre: 'asc' }
    })

    const mozos = admins.map(a => ({
      id: a.id,
      nombre: a.nombre,
      apellido: a.apellido,
      nombreCompleto: `${a.nombre} ${a.apellido || ''}`.trim(),
      email: a.email,
      mesasAsignadas: a._count.mesasAsignadas
    }))

    res.json({ success: true, data: mozos })
  } catch (error) {
    console.error('Error al listar mozos:', error)
    res.status(500).json({ success: false, error: 'Error al listar mozos' })
  }
})

/**
 * POST /mesas/:id/asignar-mozo
 * Asignar mozo a una mesa
 */
router.post('/mesas/:id/asignar-mozo', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { id } = req.params
    const { mozoId } = req.body

    const mesa = await req.db.mesa.update({
      where: { id: parseInt(id) },
      data: { mozoAsignadoId: mozoId ? parseInt(mozoId) : null },
      include: {
        mozoAsignado: {
          select: { id: true, nombre: true, apellido: true }
        }
      }
    })

    res.json({ success: true, data: mesa })
  } catch (error) {
    console.error('Error al asignar mozo:', error)
    res.status(500).json({ success: false, error: 'Error al asignar mozo' })
  }
})

/**
 * POST /mesas/asignar-masivo
 * Asignación masiva de mesas a mozos
 */
router.post('/mesas/asignar-masivo', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { asignaciones } = req.body

    const resultados = await Promise.all(
      asignaciones.map(({ mesaId, mozoId }) =>
        req.db.mesa.update({
          where: { id: parseInt(mesaId) },
          data: { mozoAsignadoId: mozoId ? parseInt(mozoId) : null }
        })
      )
    )

    res.json({ success: true, data: { actualizadas: resultados.length } })
  } catch (error) {
    console.error('Error en asignación masiva:', error)
    res.status(500).json({ success: false, error: 'Error en asignación masiva' })
  }
})

/**
 * POST /mesas/desasignar-todas
 * Desasignar todas las mesas (limpiar turno)
 */
router.post('/mesas/desasignar-todas', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const resultado = await req.db.mesa.updateMany({
      where: { activo: true },
      data: { mozoAsignadoId: null }
    })

    res.json({ success: true, data: { desasignadas: resultado.count } })
  } catch (error) {
    console.error('Error al desasignar mesas:', error)
    res.status(500).json({ success: false, error: 'Error al desasignar mesas' })
  }
})

export default router
