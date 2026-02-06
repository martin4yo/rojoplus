import webPush from 'web-push'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Configurar VAPID keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const vapidMailto = process.env.VAPID_MAILTO || 'mailto:socios@sportivopilar.com.ar'

if (vapidPublicKey && vapidPrivateKey) {
  webPush.setVapidDetails(vapidMailto, vapidPublicKey, vapidPrivateKey)
  console.log('Web Push configurado correctamente')
} else {
  console.warn('VAPID keys no configuradas - Push notifications deshabilitadas')
}

/**
 * Enviar notificación push a un socio específico
 * @param {number} socioId - ID del socio
 * @param {object} payload - Contenido de la notificación
 * @param {string} payload.title - Título de la notificación
 * @param {string} payload.body - Cuerpo del mensaje
 * @param {string} payload.icon - URL del icono (opcional)
 * @param {string} payload.url - URL a abrir al hacer click (opcional)
 * @param {string} payload.tag - Tag para agrupar notificaciones (opcional)
 */
export async function enviarNotificacionPush(socioId, payload) {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('Push notifications deshabilitadas - VAPID keys no configuradas')
    return { success: false, error: 'VAPID keys no configuradas' }
  }

  try {
    // Verificar si el socio tiene push notifications habilitadas
    const socio = await prisma.socio.findUnique({
      where: { id: socioId },
      select: { notificarPush: true }
    })

    if (!socio?.notificarPush) {
      return { success: false, error: 'Push notifications deshabilitadas para este socio' }
    }

    // Obtener todas las suscripciones activas del socio
    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        socioId,
        activa: true
      }
    })

    if (subscriptions.length === 0) {
      return { success: false, error: 'No hay suscripciones activas' }
    }

    // Preparar el payload
    const notificationPayload = JSON.stringify({
      title: payload.title || 'Rojo Plus',
      body: payload.body,
      icon: payload.icon || '/images/icon-192.png',
      badge: '/images/icon-192.png',
      url: payload.url || '/',
      tag: payload.tag || 'general',
      timestamp: Date.now()
    })

    // Enviar a todas las suscripciones
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth
              }
            },
            notificationPayload
          )
          return { success: true, subscriptionId: sub.id }
        } catch (error) {
          // Si la suscripción expiró o es inválida, desactivarla
          if (error.statusCode === 410 || error.statusCode === 404) {
            await prisma.pushSubscription.update({
              where: { id: sub.id },
              data: { activa: false }
            })
            console.log(`Suscripción ${sub.id} desactivada (expirada o inválida)`)
          }
          throw error
        }
      })
    )

    const exitosos = results.filter(r => r.status === 'fulfilled').length
    const fallidos = results.filter(r => r.status === 'rejected').length

    return {
      success: exitosos > 0,
      enviados: exitosos,
      fallidos,
      total: subscriptions.length
    }
  } catch (error) {
    console.error('Error enviando push notification:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Enviar notificación push a múltiples socios
 * @param {number[]} socioIds - IDs de los socios
 * @param {object} payload - Contenido de la notificación
 */
export async function enviarNotificacionPushMasiva(socioIds, payload) {
  const results = await Promise.allSettled(
    socioIds.map(socioId => enviarNotificacionPush(socioId, payload))
  )

  const exitosos = results.filter(r => r.status === 'fulfilled' && r.value.success).length
  const fallidos = results.filter(r => r.status === 'rejected' || !r.value?.success).length

  return {
    success: exitosos > 0,
    enviados: exitosos,
    fallidos,
    total: socioIds.length
  }
}

/**
 * Enviar notificación de cuota próxima a vencer
 * @param {number} socioId - ID del socio
 * @param {object} cargo - Datos del cargo
 */
export async function notificarCuotaProximaVencer(socioId, cargo) {
  return enviarNotificacionPush(socioId, {
    title: 'Cuota próxima a vencer',
    body: `Tu cuota de ${cargo.descripcion} vence el ${new Date(cargo.fechaVencimiento).toLocaleDateString('es-AR')}`,
    url: `/portal-socio/cuotas`,
    tag: 'cuota-proxima'
  })
}

/**
 * Enviar notificación de cuota vencida
 * @param {number} socioId - ID del socio
 * @param {object} cargo - Datos del cargo
 */
export async function notificarCuotaVencida(socioId, cargo) {
  return enviarNotificacionPush(socioId, {
    title: 'Cuota vencida',
    body: `Tu cuota de ${cargo.descripcion} venció. Regulariza tu situación para evitar recargos.`,
    url: `/portal-socio/cuotas`,
    tag: 'cuota-vencida'
  })
}

/**
 * Enviar notificación de pago confirmado
 * @param {number} socioId - ID del socio
 * @param {object} pago - Datos del pago
 */
export async function notificarPagoConfirmado(socioId, pago) {
  const monto = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS'
  }).format(pago.monto)

  return enviarNotificacionPush(socioId, {
    title: 'Pago confirmado',
    body: `Tu pago de ${monto} fue registrado exitosamente`,
    url: `/portal-socio/pagos`,
    tag: 'pago-confirmado'
  })
}

/**
 * Obtener la clave pública VAPID para el frontend
 */
export function getVapidPublicKey() {
  return vapidPublicKey
}

export default {
  enviarNotificacionPush,
  enviarNotificacionPushMasiva,
  notificarCuotaProximaVencer,
  notificarCuotaVencida,
  notificarPagoConfirmado,
  getVapidPublicKey
}
