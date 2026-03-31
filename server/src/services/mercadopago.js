import { MercadoPagoConfig, Preference } from 'mercadopago'

// Configuración de MercadoPago
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
})

/**
 * Crear preferencia de pago en MercadoPago
 * @param {Object} data - Datos del pago
 * @param {string} data.title - Título del pago
 * @param {string} data.description - Descripción del pago
 * @param {number} data.amount - Monto total
 * @param {number} data.quantity - Cantidad (default: 1)
 * @param {string} data.externalReference - Referencia externa (linkPagoId)
 * @param {Object} data.payer - Datos del pagador
 * @param {string} data.payer.email - Email del pagador
 * @param {string} data.payer.name - Nombre del pagador
 * @param {string} data.notificationUrl - URL de notificaciones (webhook)
 * @param {string} data.successUrl - URL de éxito
 * @param {string} data.failureUrl - URL de fallo
 * @param {string} data.pendingUrl - URL de pendiente
 * @returns {Promise<Object>} Preferencia creada con init_point
 */
export async function crearPreferenciaPago(data) {
  try {
    const preference = new Preference(client)

    // Validar URLs requeridos
    if (!data.successUrl || !data.failureUrl || !data.pendingUrl) {
      throw new Error(`URLs requeridos: success=${data.successUrl}, failure=${data.failureUrl}, pending=${data.pendingUrl}`)
    }

    const preferenceBody = {
      items: [
        {
          title: data.title,
          description: data.description || '',
          quantity: data.quantity || 1,
          unit_price: Number(data.amount),
          currency_id: 'ARS',
        },
      ],
      payer: {
        name: data.payer?.name || '',
        surname: '',
        email: data.payer?.email || '',
      },
      external_reference: data.externalReference,
      back_urls: {
        success: data.successUrl,
        failure: data.failureUrl,
        pending: data.pendingUrl,
      },
      statement_descriptor: 'CLUB SPORTIVO PILAR',
      payment_methods: {
        excluded_payment_methods: [],
        excluded_payment_types: [],
        installments: 1, // Solo pago en 1 cuota por defecto
      },
    }

    // Solo agregar notification_url si NO es localhost (para desarrollo sin ngrok)
    if (data.notificationUrl && !data.notificationUrl.includes('localhost')) {
      preferenceBody.notification_url = data.notificationUrl
      console.log('✅ Webhook habilitado:', data.notificationUrl)
    } else {
      console.log('⚠️  Webhook deshabilitado (localhost). En producción se habilitará automáticamente.')
    }

    // Solo agregar auto_return si NO es localhost (MP no lo permite con localhost)
    if (!data.successUrl.includes('localhost')) {
      preferenceBody.auto_return = 'approved'
      console.log('✅ Auto-retorno habilitado')
    } else {
      console.log('⚠️  Auto-retorno deshabilitado (localhost). El usuario deberá usar el botón "Volver" de Mercado Pago.')
    }

    console.log('🔷 Creando preferencia MercadoPago:', JSON.stringify(preferenceBody, null, 2))

    const result = await preference.create({
      body: preferenceBody,
    })

    console.log('✅ Preferencia creada exitosamente:', {
      id: result.id,
      init_point: result.init_point
    })

    return {
      id: result.id,
      init_point: result.init_point,
      sandbox_init_point: result.sandbox_init_point,
    }
  } catch (error) {
    console.error('Error creando preferencia MercadoPago:', error)
    throw new Error('Error al generar link de pago con MercadoPago')
  }
}

/**
 * Obtener información de un pago
 * @param {string} paymentId - ID del pago en MercadoPago
 * @returns {Promise<Object>} Información del pago
 */
export async function obtenerPago(paymentId) {
  try {
    const { Payment } = await import('mercadopago')
    const payment = new Payment(client)
    return await payment.get({ id: paymentId })
  } catch (error) {
    console.error('Error obteniendo pago MercadoPago:', error)
    throw new Error('Error al obtener información del pago')
  }
}

/**
 * Crear reembolso total de un pago en MercadoPago
 * @param {string} paymentId - ID del pago original en MercadoPago
 * @returns {Promise<Object>} Resultado del reembolso
 */
export async function crearReembolso(paymentId) {
  try {
    const { PaymentRefund } = await import('mercadopago')
    const refund = new PaymentRefund(client)
    const result = await refund.create({ payment_id: paymentId })
    console.log(`✅ Reembolso MP creado para pago ${paymentId}:`, result.id)
    return result
  } catch (error) {
    console.error(`❌ Error creando reembolso MP para pago ${paymentId}:`, error)
    throw new Error('Error al procesar el reembolso en MercadoPago')
  }
}

export default {
  crearPreferenciaPago,
  obtenerPago,
  crearReembolso,
}
