/**
 * Rutas de Opciones de Productos del Buffet
 * - CRUD de grupos de opciones (ej: Guarnición, Infusión, Ingredientes)
 * - CRUD de opciones individuales (ej: Papas Fritas, Café, Lechuga)
 *
 * Casos de uso:
 * - Combos: "Milanesa con Guarnición" -> seleccionar 1 guarnición
 * - Infusiones: "Desayuno con 2 medialunas" -> seleccionar 1 infusión
 * - Armables: "Ensalada personalizada" -> seleccionar múltiples ingredientes
 */
import express from 'express'
import prisma from '../../lib/prisma.js'
import { authAdmin, checkPermiso } from '../../middleware/auth.js'

const router = express.Router()

// ============================================================================
// GRUPOS DE OPCIONES
// ============================================================================

/**
 * GET /productos/:productoId/grupos-opciones
 * Listar grupos de opciones de un producto
 */
router.get('/productos/:productoId/grupos-opciones', authAdmin, checkPermiso('BUFFET_VER', 'BUFFET_MESAS', 'BUFFET_KIOSCO'), async (req, res) => {
  try {
    const { productoId } = req.params

    const grupos = await prisma.grupoOpcionProducto.findMany({
      where: {
        productoBuffetId: parseInt(productoId),
        activo: true
      },
      orderBy: { orden: 'asc' },
      include: {
        opciones: {
          where: { activo: true },
          orderBy: { orden: 'asc' }
        }
      }
    })

    res.json({ success: true, data: grupos })
  } catch (error) {
    console.error('Error al listar grupos de opciones:', error)
    res.status(500).json({ success: false, error: 'Error al listar grupos de opciones' })
  }
})

/**
 * POST /productos/:productoId/grupos-opciones
 * Crear grupo de opciones para un producto
 */
router.post('/productos/:productoId/grupos-opciones', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { productoId } = req.params
    const { nombre, descripcion, tipo, obligatorio, minSelecciones, maxSelecciones, orden } = req.body

    if (!nombre) {
      return res.status(400).json({ success: false, error: 'El nombre es obligatorio' })
    }

    const grupo = await prisma.grupoOpcionProducto.create({
      data: {
        productoBuffetId: parseInt(productoId),
        nombre,
        descripcion,
        tipo: tipo || 'UNICA',
        obligatorio: obligatorio !== false,
        minSelecciones: minSelecciones || 1,
        maxSelecciones: maxSelecciones || 1,
        orden: orden || 0
      },
      include: { opciones: true }
    })

    res.status(201).json({ success: true, data: grupo })
  } catch (error) {
    console.error('Error al crear grupo de opciones:', error)
    res.status(500).json({ success: false, error: 'Error al crear grupo de opciones' })
  }
})

/**
 * PUT /grupos-opciones/:id
 * Actualizar grupo de opciones
 */
router.put('/grupos-opciones/:id', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { id } = req.params
    const { nombre, descripcion, tipo, obligatorio, minSelecciones, maxSelecciones, orden, activo } = req.body

    const grupo = await prisma.grupoOpcionProducto.update({
      where: { id: parseInt(id) },
      data: {
        nombre,
        descripcion,
        tipo,
        obligatorio,
        minSelecciones,
        maxSelecciones,
        orden,
        activo
      },
      include: { opciones: true }
    })

    res.json({ success: true, data: grupo })
  } catch (error) {
    console.error('Error al actualizar grupo de opciones:', error)
    res.status(500).json({ success: false, error: 'Error al actualizar grupo de opciones' })
  }
})

/**
 * DELETE /grupos-opciones/:id
 * Eliminar grupo de opciones
 */
router.delete('/grupos-opciones/:id', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { id } = req.params

    await prisma.grupoOpcionProducto.delete({ where: { id: parseInt(id) } })

    res.json({ success: true, message: 'Grupo de opciones eliminado' })
  } catch (error) {
    console.error('Error al eliminar grupo de opciones:', error)
    res.status(500).json({ success: false, error: 'Error al eliminar grupo de opciones' })
  }
})

// ============================================================================
// OPCIONES INDIVIDUALES
// ============================================================================

/**
 * POST /grupos-opciones/:grupoId/opciones
 * Crear opción en un grupo
 */
router.post('/grupos-opciones/:grupoId/opciones', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { grupoId } = req.params
    const { nombre, descripcion, precioAdicional, disponible, orden } = req.body

    if (!nombre) {
      return res.status(400).json({ success: false, error: 'El nombre es obligatorio' })
    }

    const opcion = await prisma.opcionProducto.create({
      data: {
        grupoId: parseInt(grupoId),
        nombre,
        descripcion,
        precioAdicional: precioAdicional || 0,
        disponible: disponible !== false,
        orden: orden || 0
      }
    })

    res.status(201).json({ success: true, data: opcion })
  } catch (error) {
    console.error('Error al crear opción:', error)
    res.status(500).json({ success: false, error: 'Error al crear opción' })
  }
})

/**
 * POST /grupos-opciones/:grupoId/opciones/bulk
 * Crear múltiples opciones de una vez
 */
router.post('/grupos-opciones/:grupoId/opciones/bulk', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { grupoId } = req.params
    const { opciones } = req.body

    if (!opciones || !Array.isArray(opciones) || opciones.length === 0) {
      return res.status(400).json({ success: false, error: 'Debe enviar un array de opciones' })
    }

    const creadas = await req.db.$transaction(
      opciones.map((op, index) =>
        prisma.opcionProducto.create({
          data: {
            grupoId: parseInt(grupoId),
            nombre: op.nombre,
            descripcion: op.descripcion,
            precioAdicional: op.precioAdicional || 0,
            disponible: op.disponible !== false,
            orden: op.orden ?? index
          }
        })
      )
    )

    res.status(201).json({ success: true, data: creadas })
  } catch (error) {
    console.error('Error al crear opciones:', error)
    res.status(500).json({ success: false, error: 'Error al crear opciones' })
  }
})

/**
 * PUT /opciones/:id
 * Actualizar opción
 */
router.put('/opciones/:id', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { id } = req.params
    const { nombre, descripcion, precioAdicional, disponible, orden, activo } = req.body

    const opcion = await prisma.opcionProducto.update({
      where: { id: parseInt(id) },
      data: {
        nombre,
        descripcion,
        precioAdicional,
        disponible,
        orden,
        activo
      }
    })

    res.json({ success: true, data: opcion })
  } catch (error) {
    console.error('Error al actualizar opción:', error)
    res.status(500).json({ success: false, error: 'Error al actualizar opción' })
  }
})

/**
 * DELETE /opciones/:id
 * Eliminar opción
 */
router.delete('/opciones/:id', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { id } = req.params

    await prisma.opcionProducto.delete({ where: { id: parseInt(id) } })

    res.json({ success: true, message: 'Opción eliminada' })
  } catch (error) {
    console.error('Error al eliminar opción:', error)
    res.status(500).json({ success: false, error: 'Error al eliminar opción' })
  }
})

/**
 * PUT /opciones/:id/disponibilidad
 * Cambiar disponibilidad rápido
 */
router.put('/opciones/:id/disponibilidad', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { id } = req.params
    const { disponible } = req.body

    const opcion = await prisma.opcionProducto.update({
      where: { id: parseInt(id) },
      data: { disponible }
    })

    res.json({ success: true, data: opcion })
  } catch (error) {
    console.error('Error al cambiar disponibilidad:', error)
    res.status(500).json({ success: false, error: 'Error al cambiar disponibilidad' })
  }
})

export default router
