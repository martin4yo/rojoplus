/**
 * Configuración de Mercado Pago a nivel TENANT.
 * Aplica a todos los pagos del tenant que se procesen por MP:
 * cuotas (LinkPago), ventanilla de eventos, tienda online, etc.
 *
 * Lee de la tabla Configuracion con modulo='PAGOS':
 *   MP_ACCESS_TOKEN  → access token del vendedor (TEST-... o APP_USR-...)
 *   MP_PUBLIC_KEY    → public key (para checkout brick / SDK frontend)
 *   MP_MODO_TEST     → 'true' | 'false' (informativo, no cambia el comportamiento técnico
 *                      — el token ya implica el modo)
 *
 * Fallback al .env (process.env.MERCADOPAGO_ACCESS_TOKEN, MERCADOPAGO_PUBLIC_KEY)
 * para compatibilidad con instalaciones legacy.
 */

/**
 * Lee la configuración MP del tenant desde Configuracion.
 * @param {*} db - cliente Prisma del tenant (req.db)
 * @returns {Promise<{ accessToken: string, publicKey: string, modoTest: boolean }>}
 */
export async function getMpConfig(db) {
  const params = await db.configuracion.findMany({
    where: { modulo: 'PAGOS' },
    select: { clave: true, valor: true },
  })
  const map = Object.fromEntries(params.map(p => [p.clave, p.valor]))

  const accessToken = map.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN || ''
  const publicKey = map.MP_PUBLIC_KEY || process.env.MERCADOPAGO_PUBLIC_KEY || ''
  const modoTest = map.MP_MODO_TEST === 'true'
    || (accessToken.startsWith('TEST-') ? true : false)
  const nombreComercio = map.MP_NOMBRE_COMERCIO || ''

  return { accessToken, publicKey, modoTest, nombreComercio }
}

/**
 * Igual que getMpConfig pero devuelve solo el access token.
 * Tira error si no está configurado.
 */
export async function getMpAccessToken(db) {
  const { accessToken } = await getMpConfig(db)
  if (!accessToken) {
    const err = new Error('Mercado Pago no está configurado para este tenant. Andá a Configuración → Pagos → Mercado Pago.')
    err.code = 'MP_NOT_CONFIGURED'
    err.status = 503
    throw err
  }
  return accessToken
}
