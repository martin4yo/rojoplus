/**
 * Servicio MP para Tienda Online (Checkout Pro / preferences).
 *
 * external_reference format: "clubix-tienda-{tenantId}-{uuid}"
 *
 * El access token se pasa como parámetro (es por-tenant, no global).
 */
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago'

function getClient(accessToken) {
  if (!accessToken) {
    throw new Error('Access token de Mercado Pago no configurado para este tenant')
  }
  return new MercadoPagoConfig({ accessToken })
}

/**
 * Crea una preferencia de pago para un PedidoTienda.
 * @param {Object} args
 * @param {string} args.accessToken - Token MP del tenant
 * @param {Array}  args.items - [{ title, quantity, unit_price }]
 * @param {string} args.externalReference - clubix-tienda-{tenantId}-{uuid}
 * @param {Object} args.payer - { name, email }
 * @param {string} args.frontendUrl - URL pública del sitio del tenant
 * @param {string} args.tenantSlug - slug del tenant (para componer notification_url)
 * @param {string} args.statementDescriptor - texto que aparece en el extracto MP (≤22 chars)
 */
export async function crearPreferenciaTienda({
  accessToken,
  items,
  externalReference,
  payer,
  frontendUrl,
  tenantSlug,
  statementDescriptor,
}) {
  const client = getClient(accessToken)
  const preference = new Preference(client)

  const body = {
    items: items.map(it => ({
      title: String(it.title).slice(0, 250),
      quantity: Number(it.quantity),
      unit_price: Number(Number(it.unit_price).toFixed(2)),
      currency_id: 'ARS',
    })),
    payer: {
      name: payer?.name || '',
      email: payer?.email || '',
    },
    external_reference: externalReference,
    back_urls: {
      success: `${frontendUrl}/tienda/checkout/exito?ref=${encodeURIComponent(externalReference)}`,
      failure: `${frontendUrl}/tienda/checkout/error?ref=${encodeURIComponent(externalReference)}`,
      pending: `${frontendUrl}/tienda/checkout/pendiente?ref=${encodeURIComponent(externalReference)}`,
    },
    statement_descriptor: (statementDescriptor || 'CLUBIX TIENDA').slice(0, 22),
    payment_methods: { installments: 6 },
  }

  // Notification URL incluye tenantSlug para que el webhook sepa qué tenant es
  // (sin tener que consultar la API de MP con un token global)
  const baseUrl = process.env.PUBLIC_URL || ''
  if (baseUrl && !baseUrl.includes('localhost') && tenantSlug) {
    body.notification_url = `${baseUrl}/api/webhooks/mercadopago/${encodeURIComponent(tenantSlug)}`
  }
  if (!body.back_urls.success.includes('localhost')) {
    body.auto_return = 'approved'
  }

  const result = await preference.create({ body })
  return {
    id: result.id,
    initPoint: result.init_point,
    sandboxInitPoint: result.sandbox_init_point,
  }
}

/**
 * Obtiene un pago de MP usando el access token del tenant.
 */
export async function obtenerPagoTienda(accessToken, paymentId) {
  const client = getClient(accessToken)
  const payment = new Payment(client)
  return await payment.get({ id: paymentId })
}

export default { crearPreferenciaTienda, obtenerPagoTienda }
