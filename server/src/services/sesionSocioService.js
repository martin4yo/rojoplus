/**
 * Sesión persistente del socio en el portal ("recordar dispositivo").
 *
 * Cuando un magic link se valida exitosamente, se llama a `crearSesion()` que:
 *   - crea un registro en `SocioSession` con un token aleatorio (32 bytes hex)
 *   - guarda IP + userAgent
 *   - retorna el token (que se setea en cookie HttpOnly por 30 días)
 *
 * En cada visita al portal, `validarSesion()` verifica el token de la cookie:
 *   - si es válido y no revocado: actualiza `lastUsedAt` y `expiresAt` (sliding 30 días)
 *   - si caducó o fue revocado: retorna null (el front muestra magic link)
 *
 * Múltiples sesiones simultáneas por socio permitidas (mobile + desktop).
 */

import crypto from 'crypto'

const SESSION_COOKIE_NAME = 'socio_sid'
const SESSION_DURATION_DAYS = 30

export const SESSION_COOKIE = SESSION_COOKIE_NAME

function generarToken() {
  return crypto.randomBytes(32).toString('hex')
}

function calcularExpiracion() {
  const exp = new Date()
  exp.setDate(exp.getDate() + SESSION_DURATION_DAYS)
  return exp
}

/**
 * Crea una nueva sesión para el socio. Devuelve { token, expiresAt }.
 */
export async function crearSesion(db, { socioId, tenantId, ip, userAgent }) {
  const token = generarToken()
  const expiresAt = calcularExpiracion()
  await db.socioSession.create({
    data: {
      socioId, tenantId, token,
      ip: ip || null,
      userAgent: userAgent ? String(userAgent).slice(0, 500) : null,
      expiresAt,
    },
  })
  return { token, expiresAt }
}

/**
 * Valida una sesión por su token. Si es válida, hace sliding update y devuelve
 * el socioId. Sino devuelve null (no toca nada).
 */
export async function validarSesion(db, token) {
  if (!token) return null
  const ahora = new Date()
  const sesion = await db.socioSession.findUnique({
    where: { token },
    select: { id: true, socioId: true, tenantId: true, expiresAt: true, revokedAt: true },
  })
  if (!sesion) return null
  if (sesion.revokedAt) return null
  if (sesion.expiresAt < ahora) return null

  // Sliding update
  await db.socioSession.update({
    where: { id: sesion.id },
    data: { lastUsedAt: ahora, expiresAt: calcularExpiracion() },
  })
  return { socioId: sesion.socioId, tenantId: sesion.tenantId, sesionId: sesion.id }
}

/**
 * Revoca una sesión específica.
 */
export async function revocarSesion(db, token) {
  if (!token) return
  await db.socioSession.updateMany({
    where: { token, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

/**
 * Revoca todas las sesiones activas de un socio.
 */
export async function revocarTodasSesiones(db, socioId) {
  const r = await db.socioSession.updateMany({
    where: { socioId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  return r.count
}

/**
 * Lista las sesiones activas (no revocadas, no caducadas) de un socio.
 */
export async function listarSesionesActivas(db, socioId) {
  const ahora = new Date()
  return db.socioSession.findMany({
    where: { socioId, revokedAt: null, expiresAt: { gt: ahora } },
    select: { id: true, ip: true, userAgent: true, createdAt: true, lastUsedAt: true, expiresAt: true },
    orderBy: { lastUsedAt: 'desc' },
  })
}

/**
 * Helper: setea la cookie de sesión en la response.
 */
export function setSesionCookie(res, token, expiresAt) {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  })
}

/**
 * Helper: borra la cookie de sesión.
 */
export function clearSesionCookie(res) {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  })
}
