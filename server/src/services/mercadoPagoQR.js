/**
 * Servicio de integración con Mercado Pago QR Dinámico (Point / In-Store Orders).
 *
 * Flujo:
 *   1. crearOrdenQRDinamica → arma una orden QR en MP con monto pre-cargado.
 *      MP devuelve un payload (qr_data) que el frontend renderiza como QR.
 *   2. El cliente escanea con Cuenta DNI / MODO / MP / etc y paga.
 *   3. MP dispara webhook a notification_url con payment.id.
 *   4. Se consulta el pago con obtenerPago(paymentId) para validar estado y monto.
 *   5. cancelarOrdenQRDinamica elimina la orden en MP (permite generar otra nueva).
 *
 * Variables de entorno:
 *   MERCADOPAGO_ACCESS_TOKEN - token del vendedor (por ahora global; se moverá a per-tenant).
 *   MP_POS_VENTANILLA        - external_pos_id para la ventanilla (default: 'clubix-ventanilla').
 *   MP_STORE_VENTANILLA      - external_store_id opcional (default: 'clubix-principal').
 *   PUBLIC_URL               - URL pública del backend (para notification_url del webhook).
 */

const MP_BASE = 'https://api.mercadopago.com'

function resolveAccessToken(accessToken) {
  const token = accessToken || process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!token) throw new Error('Mercado Pago no está configurado (falta accessToken)')
  return token
}

async function mpFetch(path, options = {}, accessToken) {
  const url = `${MP_BASE}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${resolveAccessToken(accessToken)}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!res.ok) {
    const msg = data?.message || data?.error || res.statusText
    console.error(`[MP] ${options.method || 'GET'} ${path} → ${res.status}:`, data)
    const err = new Error(`MP ${res.status}: ${msg}`)
    err.status = res.status
    err.body = data
    throw err
  }
  return data
}

/**
 * Obtiene el user_id (collector) asociado al access token.
 * Cache por token.
 */
const _collectorIdCache = new Map()
export async function getCollectorId(accessToken) {
  const tok = resolveAccessToken(accessToken)
  if (_collectorIdCache.has(tok)) return _collectorIdCache.get(tok)
  const user = await mpFetch('/users/me', {}, tok)
  _collectorIdCache.set(tok, user.id)
  return user.id
}

/**
 * Crea un QR dinámico con monto pre-cargado y devuelve el payload qr_data.
 *
 * @param {Object} params
 * @param {string} params.externalReference - ID único nuestro (p.ej. UUID de VentaEventoQRPendiente)
 * @param {number} params.monto - Monto total en ARS
 * @param {string} params.title - Descripción visible al pagador
 * @param {Array}  params.items - [{ title, quantity, unit_price }]
 * @param {string} [params.externalPosId] - default process.env.MP_POS_VENTANILLA
 * @param {string} [params.notificationUrl] - override del webhook (default PUBLIC_URL/api/webhooks/mercadopago)
 * @returns {Promise<{ qr_data: string, in_store_order_id: string, external_pos_id: string }>}
 */
export async function crearOrdenQRDinamica({
  externalReference,
  monto,
  title,
  items,
  externalPosId,
  notificationUrl,
  accessToken,
}) {
  const collectorId = await getCollectorId(accessToken)
  const posId = externalPosId || process.env.MP_POS_VENTANILLA || 'clubix-ventanilla'
  const notifUrl = notificationUrl
    || `${process.env.PUBLIC_URL || 'http://localhost:3000'}/api/webhooks/mercadopago`

  const body = {
    external_reference: externalReference,
    title: title?.slice(0, 150) || 'Venta',
    description: title?.slice(0, 250) || undefined,
    total_amount: Number(Number(monto).toFixed(2)),
    items: (items || [{ title: title || 'Venta', quantity: 1, unit_price: monto, unit_measure: 'unit', total_amount: monto }])
      .map(it => ({
        title: String(it.title).slice(0, 150),
        quantity: Number(it.quantity),
        unit_price: Number(Number(it.unit_price).toFixed(2)),
        unit_measure: it.unit_measure || 'unit',
        total_amount: Number(Number(it.unit_price * it.quantity).toFixed(2)),
      })),
    notification_url: notifUrl && !notifUrl.includes('localhost') ? notifUrl : undefined,
  }

  const path = `/instore/orders/qr/seller/collectors/${collectorId}/pos/${encodeURIComponent(posId)}/qrs`
  const res = await mpFetch(path, { method: 'PUT', body: JSON.stringify(body) }, accessToken)
  return { ...res, external_pos_id: posId, collector_id: collectorId }
}

/**
 * Borra la orden QR dinámica asociada a un POS (para cancelar o preparar un nuevo cobro).
 */
export async function borrarOrdenQRDinamica({ externalPosId, accessToken }) {
  const collectorId = await getCollectorId(accessToken)
  const posId = externalPosId || process.env.MP_POS_VENTANILLA || 'clubix-ventanilla'
  const path = `/instore/qr/seller/collectors/${collectorId}/pos/${encodeURIComponent(posId)}/orders`
  try {
    return await mpFetch(path, { method: 'DELETE' }, accessToken)
  } catch (err) {
    if (err.status === 404) return null
    throw err
  }
}

/**
 * Consulta los detalles de un pago por ID (para confirmar monto y estado).
 */
export async function obtenerPago(paymentId, accessToken) {
  return await mpFetch(`/v1/payments/${paymentId}`, {}, accessToken)
}

/**
 * Busca pagos por external_reference (fallback si el webhook se perdió).
 */
export async function buscarPagosPorReferencia(externalReference, accessToken) {
  const qs = new URLSearchParams({ external_reference: externalReference })
  const res = await mpFetch(`/v1/payments/search?${qs}`, {}, accessToken)
  return res?.results || []
}

/**
 * Asegura que el POS existe en la cuenta MP. Si no existe, lo crea.
 */
export async function asegurarPOS({ externalPosId, name, storeId, accessToken }) {
  const posId = externalPosId || process.env.MP_POS_VENTANILLA || 'clubix-ventanilla'
  try {
    const res = await mpFetch(`/pos?external_id=${encodeURIComponent(posId)}`, {}, accessToken)
    const existente = (res?.results || [])[0]
    if (existente) return existente
  } catch (err) {
    // Continúa a crearlo
  }
  const body = {
    name: name || 'Clubix Ventanilla',
    external_id: posId,
    ...(storeId && { store_id: storeId }),
    category: 621102,
  }
  return await mpFetch('/pos', { method: 'POST', body: JSON.stringify(body) }, accessToken)
}

export default {
  getCollectorId,
  crearOrdenQRDinamica,
  borrarOrdenQRDinamica,
  obtenerPago,
  buscarPagosPorReferencia,
  asegurarPOS,
}
