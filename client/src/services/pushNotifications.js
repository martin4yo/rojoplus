const API_URL = '/api/socio'

/**
 * Verificar si el navegador soporta push notifications
 */
export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window
}

/**
 * Verificar si las notificaciones están permitidas
 */
export function getNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported'
  }
  return Notification.permission
}

/**
 * Solicitar permiso para notificaciones
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return { granted: false, error: 'Notificaciones no soportadas' }
  }

  const permission = await Notification.requestPermission()
  return { granted: permission === 'granted', permission }
}

/**
 * Obtener la clave pública VAPID del servidor
 */
export async function getVapidPublicKey(token) {
  try {
    const response = await fetch(`${API_URL}/${token}/push/vapid-key`)
    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || 'Error obteniendo VAPID key')
    }

    return data.data.vapidPublicKey
  } catch (error) {
    console.error('Error obteniendo VAPID key:', error)
    throw error
  }
}

/**
 * Convertir VAPID key a Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Suscribirse a push notifications
 */
export async function subscribeToPush(token) {
  try {
    if (!isPushSupported()) {
      throw new Error('Push notifications no soportadas en este navegador')
    }

    // Solicitar permiso
    const { granted } = await requestNotificationPermission()
    if (!granted) {
      throw new Error('Permiso de notificaciones denegado')
    }

    // Obtener VAPID key
    const vapidPublicKey = await getVapidPublicKey(token)

    // Esperar a que el service worker esté listo
    const registration = await navigator.serviceWorker.ready

    // Verificar si ya hay una suscripción
    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      // Crear nueva suscripción
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      })
    }

    // Enviar suscripción al servidor
    const subscriptionData = subscription.toJSON()
    const response = await fetch(`${API_URL}/${token}/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: subscriptionData.endpoint,
        keys: subscriptionData.keys
      })
    })

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || 'Error registrando suscripción')
    }

    return { success: true, subscriptionId: data.data.subscriptionId }
  } catch (error) {
    console.error('Error suscribiendo a push:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Cancelar suscripción de push notifications
 */
export async function unsubscribeFromPush(token) {
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()

    if (subscription) {
      // Cancelar en el navegador
      await subscription.unsubscribe()

      // Notificar al servidor
      await fetch(`${API_URL}/${token}/push/unsubscribe`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint })
      })
    }

    return { success: true }
  } catch (error) {
    console.error('Error cancelando suscripción push:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Obtener estado de suscripción push
 */
export async function getPushStatus(token) {
  try {
    const response = await fetch(`${API_URL}/${token}/push/status`)
    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error)
    }

    // Verificar suscripción local
    let suscritoLocalmente = false
    if (isPushSupported()) {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      suscritoLocalmente = !!subscription
    }

    return {
      ...data.data,
      suscritoLocalmente,
      permisoNotificaciones: getNotificationPermission()
    }
  } catch (error) {
    console.error('Error obteniendo estado push:', error)
    return {
      habilitado: false,
      suscripciones: 0,
      dispositivos: [],
      suscritoLocalmente: false,
      permisoNotificaciones: getNotificationPermission()
    }
  }
}

/**
 * Toggle push notifications
 */
export async function togglePushNotifications(token, habilitado) {
  try {
    const response = await fetch(`${API_URL}/${token}/push/toggle`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habilitado })
    })

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error)
    }

    // Si se habilita, intentar suscribirse
    if (habilitado) {
      await subscribeToPush(token)
    } else {
      await unsubscribeFromPush(token)
    }

    return { success: true }
  } catch (error) {
    console.error('Error toggling push notifications:', error)
    return { success: false, error: error.message }
  }
}

export default {
  isPushSupported,
  getNotificationPermission,
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  getPushStatus,
  togglePushNotifications
}
