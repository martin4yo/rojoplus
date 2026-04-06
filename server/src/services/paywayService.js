/**
 * Payway (ex Decidir) — Servicio de integración API REST
 * Sandbox: https://developers.decidir.com/api/v2
 * Producción: https://live.decidir.com/api/v2
 *
 * Credenciales en ConfiguracionDebito:
 *   apiKey     → private key (cobros)
 *   apiSecret  → public key (tokenización server-side)
 *   codigoComercio → site_id
 *   ambiente   → SANDBOX | PRODUCCION
 */

const PAYWAY_URLS = {
  SANDBOX: 'https://developers.decidir.com/api/v2',
  PRODUCCION: 'https://live.decidir.com/api/v2'
}

// payment_method_id por marca de tarjeta (Payway Argentina)
const PAYMENT_METHOD_IDS = {
  VISA: 1,
  MASTERCARD: 15,
  AMEX: 6,
  CABAL: 63,
  NARANJA: 26,
  VISA_DEBITO: 31,
  MASTERCARD_DEBITO: 105
}

function getBaseUrl(configuracion) {
  return configuracion.ambiente === 'PRODUCCION'
    ? PAYWAY_URLS.PRODUCCION
    : PAYWAY_URLS.SANDBOX
}

async function paywayFetch({ url, method = 'GET', body, apiKey }) {
  const opts = {
    method,
    headers: {
      'apikey': apiKey,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    }
  }
  if (body) opts.body = JSON.stringify(body)

  const resp = await fetch(url, opts)
  const text = await resp.text()

  let data
  try { data = JSON.parse(text) } catch { data = { raw: text } }

  if (!resp.ok) {
    const msg = data?.error_type || data?.message || data?.raw || `HTTP ${resp.status}`
    const err = new Error(`Payway error: ${msg}`)
    err.status = resp.status
    err.paywayData = data
    throw err
  }

  return data
}

/**
 * Tokeniza una tarjeta usando la public key (server-side, válido en sandbox).
 * En producción esto se hace con el widget JS de Payway en el browser.
 */
export async function tokenizarTarjeta({ numero, vencimiento, titular, cvv, marca, configuracion }) {
  const baseUrl = getBaseUrl(configuracion)
  // Usar public key para tokenización
  const apiKey = configuracion.apiSecret || configuracion.apiKey

  const [mes, anio] = vencimiento.split('/')
  const cardHolderName = titular.trim().toUpperCase()

  const body = {
    card_number: numero.replace(/\s/g, ''),
    card_expiration_month: mes,
    card_expiration_year: `20${anio}`,
    security_code: cvv || '000',
    card_holder_name: cardHolderName,
    card_holder_identification: {
      type: 'dni',
      number: '00000000'
    }
  }

  const data = await paywayFetch({
    url: `${baseUrl}/tokens`,
    method: 'POST',
    body,
    apiKey
  })

  return {
    token: data.id,
    bin: data.bin,
    ultimosCuatro: data.last_four_digits,
    vencimientoAnio: data.expiration_year,
    vencimientoMes: data.expiration_month,
    titular: cardHolderName,
    marca
  }
}

/**
 * Realiza un cobro usando un token almacenado.
 * Retorna { paywayId, estado, monto, mensaje }
 */
export async function cobrarConToken({ token, monto, socioId, descripcion, marca, configuracion, referencia }) {
  const baseUrl = getBaseUrl(configuracion)
  const apiKey = configuracion.apiKey
  const siteId = configuracion.codigoComercio

  const paymentMethodId = PAYMENT_METHOD_IDS[marca] || PAYMENT_METHOD_IDS.VISA
  const montoEnteros = Math.round(parseFloat(monto) * 100) // Payway trabaja en centavos

  const siteTransactionId = referencia || `CLB-${siteId}-${Date.now()}-${socioId}`

  const body = {
    site_transaction_id: siteTransactionId,
    token,
    user_id: String(socioId),
    payment_method_id: paymentMethodId,
    amount: montoEnteros,
    currency: 'ARS',
    installments: 1,
    description: descripcion || 'Cuota mensual',
    payment_type: 'single',
    sub_payments: []
  }

  const data = await paywayFetch({
    url: `${baseUrl}/payments`,
    method: 'POST',
    body,
    apiKey
  })

  return normalizarRespuestaPago(data)
}

/**
 * Consulta el estado de un pago por su ID de Payway.
 */
export async function consultarPago({ paywayId, configuracion }) {
  const baseUrl = getBaseUrl(configuracion)
  const data = await paywayFetch({
    url: `${baseUrl}/payments/${paywayId}`,
    apiKey: configuracion.apiKey
  })
  return normalizarRespuestaPago(data)
}

/**
 * Normaliza la respuesta de Payway a un formato interno consistente.
 * estado: COBRADO | RECHAZADO | PENDIENTE
 */
function normalizarRespuestaPago(data) {
  // status: approved, rejected, pending, in_progress, reversed
  const estadoMap = {
    approved: 'COBRADO',
    rejected: 'RECHAZADO',
    pending: 'PENDIENTE',
    in_progress: 'PENDIENTE',
    reversed: 'RECHAZADO'
  }

  const estado = estadoMap[data.status] || 'PENDIENTE'

  // Código y motivo de rechazo
  let codigoRechazo = null
  let motivoRechazo = null
  if (data.status_details) {
    codigoRechazo = data.status_details.response?.reason?.id ||
                   data.status_details.error?.reason?.id ||
                   null
    motivoRechazo = data.status_details.response?.reason?.description ||
                   data.status_details.error?.reason?.description ||
                   null
  }
  if (!motivoRechazo && estado === 'RECHAZADO') {
    motivoRechazo = data.status_details?.denied_reason || 'Pago rechazado'
  }

  return {
    paywayId: data.id,
    siteTransactionId: data.site_transaction_id,
    estado,
    monto: data.amount ? data.amount / 100 : 0,
    moneda: data.currency,
    codigoRechazo: String(codigoRechazo || ''),
    motivoRechazo,
    autorizacion: data.status_details?.response?.autorizacion?.codigo || null,
    rawStatus: data.status,
    raw: data
  }
}

/**
 * Verifica la firma de un webhook de Payway.
 * Payway envía X-Consumer-Custom-ID como identificador del tenant.
 */
export function verificarWebhook(headers, body, siteId) {
  // Payway no firma con HMAC en v2 — verifica que el site_id coincida
  const bodySiteId = body?.site?.id || body?.data?.site?.id
  if (bodySiteId && siteId && String(bodySiteId) !== String(siteId)) {
    return false
  }
  return true
}

export { PAYMENT_METHOD_IDS }
