/**
 * Rutas de Notificaciones del Buffet
 * - Obtener notificaciones
 * - Marcar como vistas
 * - Historial
 */
import express from 'express'
import prisma from '../../lib/prisma.js'
import { authAdmin } from '../../middleware/auth.js'

const router = express.Router()

/**
 * GET /notificaciones
 * Obtener notificaciones no vistas del usuario actual
 */
router.get('/notificaciones', authAdmin, async (req, res) => {
  try {
    const adminId = req.admin.id
    const permisos = req.admin.permisos || []

    const destinos = []
    if (permisos.includes('BUFFET_COCINA')) destinos.push('COCINA')
    if (permisos.includes('BUFFET_BARRA')) destinos.push('BARRA')
    if (permisos.includes('BUFFET_COBRAR')) destinos.push('CAJA')

    const notificaciones = await req.db.notificacionBuffet.findMany({
      where: {
        OR: [
          { paraUsuarioId: adminId },
          { paraDestino: { in: destinos } },
          ...(permisos.some(p => p.startsWith('BUFFET_')) ? [{ paraUsuarioId: null, paraDestino: null }] : [])
        ],
        vistas: {
          none: { adminId }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    res.json({ success: true, data: notificaciones })
  } catch (error) {
    console.error('Error al obtener notificaciones:', error)
    res.status(500).json({ success: false, error: 'Error al obtener notificaciones' })
  }
})

/**
 * POST /notificaciones/:id/vista
 * Marcar notificación como vista
 */
router.post('/notificaciones/:id/vista', authAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const adminId = req.admin.id

    await req.db.notificacionVista.upsert({
      where: {
        notificacionId_adminId: {
          notificacionId: parseInt(id),
          adminId
        }
      },
      create: {
        notificacionId: parseInt(id),
        adminId
      },
      update: {}
    })

    res.json({ success: true, message: 'Notificación marcada como vista' })
  } catch (error) {
    console.error('Error al marcar notificación:', error)
    res.status(500).json({ success: false, error: 'Error al marcar notificación' })
  }
})

/**
 * POST /notificaciones/marcar-todas
 * Marcar todas las notificaciones como vistas
 */
router.post('/notificaciones/marcar-todas', authAdmin, async (req, res) => {
  try {
    const adminId = req.admin.id
    const permisos = req.admin.permisos || []

    const destinos = []
    if (permisos.includes('BUFFET_COCINA')) destinos.push('COCINA')
    if (permisos.includes('BUFFET_BARRA')) destinos.push('BARRA')
    if (permisos.includes('BUFFET_COBRAR')) destinos.push('CAJA')

    const notificaciones = await req.db.notificacionBuffet.findMany({
      where: {
        OR: [
          { paraUsuarioId: adminId },
          { paraDestino: { in: destinos } },
          ...(permisos.some(p => p.startsWith('BUFFET_')) ? [{ paraUsuarioId: null, paraDestino: null }] : [])
        ],
        vistas: {
          none: { adminId }
        }
      },
      select: { id: true }
    })

    if (notificaciones.length > 0) {
      await req.db.notificacionVista.createMany({
        data: notificaciones.map(n => ({
          notificacionId: n.id,
          adminId
        })),
        skipDuplicates: true
      })
    }

    res.json({ success: true, message: `${notificaciones.length} notificaciones marcadas como vistas` })
  } catch (error) {
    console.error('Error al marcar notificaciones:', error)
    res.status(500).json({ success: false, error: 'Error al marcar notificaciones' })
  }
})

/**
 * GET /notificaciones/historial
 * Historial de notificaciones (últimas 100)
 */
router.get('/notificaciones/historial', authAdmin, async (req, res) => {
  try {
    const adminId = req.admin.id
    const permisos = req.admin.permisos || []

    const destinos = []
    if (permisos.includes('BUFFET_COCINA')) destinos.push('COCINA')
    if (permisos.includes('BUFFET_BARRA')) destinos.push('BARRA')
    if (permisos.includes('BUFFET_COBRAR')) destinos.push('CAJA')

    const notificaciones = await req.db.notificacionBuffet.findMany({
      where: {
        OR: [
          { paraUsuarioId: adminId },
          { paraDestino: { in: destinos } },
          ...(permisos.some(p => p.startsWith('BUFFET_')) ? [{ paraUsuarioId: null, paraDestino: null }] : [])
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        vistas: {
          where: { adminId },
          select: { vistaAt: true }
        }
      }
    })

    const formateadas = notificaciones.map(n => ({
      ...n,
      vista: n.vistas.length > 0,
      vistaAt: n.vistas[0]?.vistaAt || null,
      vistas: undefined
    }))

    res.json({ success: true, data: formateadas })
  } catch (error) {
    console.error('Error al obtener historial:', error)
    res.status(500).json({ success: false, error: 'Error al obtener historial' })
  }
})

export default router
