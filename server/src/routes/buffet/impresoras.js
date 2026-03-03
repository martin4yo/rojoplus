/**
 * Rutas de Sectores e Impresoras del Buffet
 * - CRUD de sectores (cocina, barra, etc)
 * - CRUD de impresoras térmicas
 * - Configuración de destinos de impresión
 */
import express from 'express'
import prisma from '../../lib/prisma.js'
import { authAdmin, checkPermiso } from '../../middleware/auth.js'

const router = express.Router()

// ============================================================================
// SECTORES DE BUFFET
// ============================================================================

/**
 * GET /sectores
 * Listar sectores
 */
router.get('/sectores', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const sectores = await prisma.sectorBuffet.findMany({
      orderBy: { orden: 'asc' },
      include: { impresoras: true }
    })
    res.json({ success: true, data: sectores })
  } catch (error) {
    console.error('Error al listar sectores:', error)
    res.status(500).json({ success: false, error: 'Error al listar sectores' })
  }
})

/**
 * GET /sectores/activos
 * Listar sectores activos (para KDS)
 */
router.get('/sectores/activos', authAdmin, checkPermiso('BUFFET_VER'), async (req, res) => {
  try {
    const sectores = await prisma.sectorBuffet.findMany({
      where: { activo: true },
      orderBy: { orden: 'asc' },
      include: {
        impresoras: {
          where: { activo: true }
        }
      }
    })
    res.json({ success: true, data: sectores })
  } catch (error) {
    console.error('Error al listar sectores activos:', error)
    res.status(500).json({ success: false, error: 'Error al listar sectores' })
  }
})

/**
 * POST /sectores
 * Crear sector
 */
router.post('/sectores', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { codigo, nombre, icono, color, orden } = req.body

    const sector = await prisma.sectorBuffet.create({
      data: { codigo: codigo.toUpperCase(), nombre, icono, color, orden: orden || 0 }
    })

    res.status(201).json({ success: true, data: sector })
  } catch (error) {
    console.error('Error al crear sector:', error)
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, error: 'Ya existe un sector con ese código' })
    }
    res.status(500).json({ success: false, error: 'Error al crear sector' })
  }
})

/**
 * PUT /sectores/:id
 * Actualizar sector
 */
router.put('/sectores/:id', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { id } = req.params
    const { codigo, nombre, icono, color, orden, activo } = req.body

    const sector = await prisma.sectorBuffet.update({
      where: { id: parseInt(id) },
      data: { codigo: codigo?.toUpperCase(), nombre, icono, color, orden, activo }
    })

    res.json({ success: true, data: sector })
  } catch (error) {
    console.error('Error al actualizar sector:', error)
    res.status(500).json({ success: false, error: 'Error al actualizar sector' })
  }
})

/**
 * DELETE /sectores/:id
 * Eliminar sector
 */
router.delete('/sectores/:id', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { id } = req.params

    const impresoras = await prisma.impresoraTermica.count({ where: { sectorId: parseInt(id) } })
    if (impresoras > 0) {
      return res.status(400).json({ success: false, error: 'No se puede eliminar un sector con impresoras asociadas' })
    }

    await prisma.sectorBuffet.delete({ where: { id: parseInt(id) } })

    res.json({ success: true, message: 'Sector eliminado' })
  } catch (error) {
    console.error('Error al eliminar sector:', error)
    res.status(500).json({ success: false, error: 'Error al eliminar sector' })
  }
})

// ============================================================================
// IMPRESORAS TÉRMICAS
// ============================================================================

/**
 * GET /impresoras
 * Listar impresoras
 */
router.get('/impresoras', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const impresoras = await prisma.impresoraTermica.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        sector: true,
        destinosImpresion: { include: { categoriaMenu: true } }
      }
    })

    res.json({ success: true, data: impresoras })
  } catch (error) {
    console.error('Error al listar impresoras:', error)
    res.status(500).json({ success: false, error: 'Error al listar impresoras' })
  }
})

/**
 * POST /impresoras
 * Crear impresora
 */
router.post('/impresoras', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { nombre, sectorId, ip, puerto } = req.body

    const impresora = await prisma.impresoraTermica.create({
      data: { nombre, sectorId: sectorId ? parseInt(sectorId) : null, ip, puerto: puerto || 9100 },
      include: { sector: true }
    })

    res.status(201).json({ success: true, data: impresora })
  } catch (error) {
    console.error('Error al crear impresora:', error)
    res.status(500).json({ success: false, error: 'Error al crear impresora' })
  }
})

/**
 * PUT /impresoras/:id
 * Actualizar impresora
 */
router.put('/impresoras/:id', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { id } = req.params
    const { nombre, sectorId, ip, puerto, activo } = req.body

    const impresora = await prisma.impresoraTermica.update({
      where: { id: parseInt(id) },
      data: {
        nombre,
        sectorId: sectorId !== undefined ? (sectorId ? parseInt(sectorId) : null) : undefined,
        ip,
        puerto,
        activo
      },
      include: { sector: true }
    })

    res.json({ success: true, data: impresora })
  } catch (error) {
    console.error('Error al actualizar impresora:', error)
    res.status(500).json({ success: false, error: 'Error al actualizar impresora' })
  }
})

/**
 * DELETE /impresoras/:id
 * Eliminar impresora
 */
router.delete('/impresoras/:id', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { id } = req.params

    await prisma.impresoraTermica.delete({ where: { id: parseInt(id) } })

    res.json({ success: true, message: 'Impresora eliminada' })
  } catch (error) {
    console.error('Error al eliminar impresora:', error)
    res.status(500).json({ success: false, error: 'Error al eliminar impresora' })
  }
})

/**
 * POST /impresoras/:id/test
 * Test de conexión a impresora
 */
router.post('/impresoras/:id/test', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { id } = req.params

    const impresora = await prisma.impresoraTermica.findUnique({ where: { id: parseInt(id) } })
    if (!impresora) {
      return res.status(404).json({ success: false, error: 'Impresora no encontrada' })
    }

    // TODO: Implementar test real de conexión ESC/POS
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
    if (!ipRegex.test(impresora.ip)) {
      return res.status(400).json({ success: false, error: 'IP inválida' })
    }

    res.json({ success: true, message: 'Conexión OK (simulada)' })
  } catch (error) {
    console.error('Error en test de impresora:', error)
    res.status(500).json({ success: false, error: 'Error en test de conexión' })
  }
})

// ============================================================================
// DESTINOS DE IMPRESIÓN
// ============================================================================

/**
 * GET /destinos-impresion
 * Listar destinos de impresión
 */
router.get('/destinos-impresion', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const destinos = await prisma.destinoImpresion.findMany({
      include: {
        categoriaMenu: true,
        impresora: true
      }
    })

    res.json({ success: true, data: destinos })
  } catch (error) {
    console.error('Error al listar destinos:', error)
    res.status(500).json({ success: false, error: 'Error al listar destinos' })
  }
})

/**
 * POST /destinos-impresion
 * Crear/Actualizar destino de impresión
 */
router.post('/destinos-impresion', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { categoriaMenuId, impresoraId } = req.body

    const destino = await prisma.destinoImpresion.upsert({
      where: {
        categoriaMenuId_impresoraId: { categoriaMenuId, impresoraId }
      },
      update: {},
      create: { categoriaMenuId, impresoraId }
    })

    res.json({ success: true, data: destino })
  } catch (error) {
    console.error('Error al crear destino:', error)
    res.status(500).json({ success: false, error: 'Error al crear destino' })
  }
})

/**
 * DELETE /destinos-impresion/:id
 * Eliminar destino de impresión
 */
router.delete('/destinos-impresion/:id', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { id } = req.params

    await prisma.destinoImpresion.delete({ where: { id: parseInt(id) } })

    res.json({ success: true, message: 'Destino eliminado' })
  } catch (error) {
    console.error('Error al eliminar destino:', error)
    res.status(500).json({ success: false, error: 'Error al eliminar destino' })
  }
})

export default router
