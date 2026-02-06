import { Router } from 'express'
import { getVapidPublicKey } from '../services/webPush.js'

const router = Router()

/**
 * GET /api/socio/:token/push/vapid-key
 * Obtener la clave pública VAPID para suscribirse
 */
router.get('/:token/push/vapid-key', async (req, res) => {
  try {
    const vapidKey = getVapidPublicKey()

    if (!vapidKey) {
      return res.status(503).json({
        success: false,
        error: 'Push notifications no configuradas'
      })
    }

    res.json({
      success: true,
      data: { vapidPublicKey: vapidKey }
    })
  } catch (error) {
    console.error('Error obteniendo VAPID key:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/socio/:token/push/subscribe
 * Registrar una nueva suscripción push
 */
router.post('/:token/push/subscribe', async (req, res) => {
  const { token } = req.params
  const { endpoint, keys } = req.body
  const prisma = req.prisma

  try {
    // Validar datos
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({
        success: false,
        error: 'Datos de suscripción incompletos'
      })
    }

    // Buscar socio por token
    const socio = await prisma.socio.findFirst({
      where: {
        tokenPortal: token,
        estado: 'ACTIVO'
      }
    })

    if (!socio) {
      return res.status(404).json({
        success: false,
        error: 'Socio no encontrado'
      })
    }

    // Verificar si ya existe esta suscripción
    const existente = await prisma.pushSubscription.findFirst({
      where: { endpoint }
    })

    if (existente) {
      // Actualizar la suscripción existente
      await prisma.pushSubscription.update({
        where: { id: existente.id },
        data: {
          socioId: socio.id,
          p256dh: keys.p256dh,
          auth: keys.auth,
          userAgent: req.headers['user-agent'],
          activa: true,
          updatedAt: new Date()
        }
      })

      return res.json({
        success: true,
        message: 'Suscripción actualizada',
        data: { subscriptionId: existente.id }
      })
    }

    // Crear nueva suscripción
    const subscription = await prisma.pushSubscription.create({
      data: {
        socioId: socio.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: req.headers['user-agent'],
        activa: true
      }
    })

    // Actualizar preferencia del socio
    await prisma.socio.update({
      where: { id: socio.id },
      data: { notificarPush: true }
    })

    res.json({
      success: true,
      message: 'Suscripción creada exitosamente',
      data: { subscriptionId: subscription.id }
    })
  } catch (error) {
    console.error('Error registrando suscripción push:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * DELETE /api/socio/:token/push/unsubscribe
 * Cancelar suscripción push
 */
router.delete('/:token/push/unsubscribe', async (req, res) => {
  const { token } = req.params
  const { endpoint } = req.body
  const prisma = req.prisma

  try {
    // Buscar socio por token
    const socio = await prisma.socio.findFirst({
      where: { tokenPortal: token }
    })

    if (!socio) {
      return res.status(404).json({
        success: false,
        error: 'Socio no encontrado'
      })
    }

    if (endpoint) {
      // Desactivar suscripción específica
      await prisma.pushSubscription.updateMany({
        where: {
          socioId: socio.id,
          endpoint
        },
        data: { activa: false }
      })
    } else {
      // Desactivar todas las suscripciones del socio
      await prisma.pushSubscription.updateMany({
        where: { socioId: socio.id },
        data: { activa: false }
      })
    }

    res.json({
      success: true,
      message: 'Suscripción cancelada'
    })
  } catch (error) {
    console.error('Error cancelando suscripción push:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/socio/:token/push/status
 * Obtener estado de suscripción push del socio
 */
router.get('/:token/push/status', async (req, res) => {
  const { token } = req.params
  const prisma = req.prisma

  try {
    // Buscar socio por token
    const socio = await prisma.socio.findFirst({
      where: { tokenPortal: token },
      select: {
        id: true,
        notificarPush: true,
        pushSubscriptions: {
          where: { activa: true },
          select: {
            id: true,
            userAgent: true,
            createdAt: true
          }
        }
      }
    })

    if (!socio) {
      return res.status(404).json({
        success: false,
        error: 'Socio no encontrado'
      })
    }

    res.json({
      success: true,
      data: {
        habilitado: socio.notificarPush,
        suscripciones: socio.pushSubscriptions.length,
        dispositivos: socio.pushSubscriptions.map(s => ({
          id: s.id,
          userAgent: s.userAgent?.substring(0, 100),
          fechaRegistro: s.createdAt
        }))
      }
    })
  } catch (error) {
    console.error('Error obteniendo estado push:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * PUT /api/socio/:token/push/toggle
 * Activar/desactivar notificaciones push para el socio
 */
router.put('/:token/push/toggle', async (req, res) => {
  const { token } = req.params
  const { habilitado } = req.body
  const prisma = req.prisma

  try {
    // Buscar socio por token
    const socio = await prisma.socio.findFirst({
      where: { tokenPortal: token }
    })

    if (!socio) {
      return res.status(404).json({
        success: false,
        error: 'Socio no encontrado'
      })
    }

    // Actualizar preferencia
    await prisma.socio.update({
      where: { id: socio.id },
      data: { notificarPush: habilitado }
    })

    // Si deshabilita, desactivar todas las suscripciones
    if (!habilitado) {
      await prisma.pushSubscription.updateMany({
        where: { socioId: socio.id },
        data: { activa: false }
      })
    }

    res.json({
      success: true,
      message: habilitado ? 'Push notifications habilitadas' : 'Push notifications deshabilitadas',
      data: { notificarPush: habilitado }
    })
  } catch (error) {
    console.error('Error toggling push notifications:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
