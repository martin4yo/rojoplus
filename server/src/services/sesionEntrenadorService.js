/**
 * Sesión persistente del entrenador en el portal.
 * Mismo patrón que sesionSocioService pero para entrenadores.
 */

import crypto from 'crypto'

const SESSION_COOKIE_NAME = 'entrenador_sid'
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

export async function crearSesion(db, { entrenadorId, tenantId, ip, userAgent }) {
  const token = generarToken()
  const expiresAt = calcularExpiracion()
  await db.entrenadorSession.create({
    data: {
      entrenadorId, tenantId, token,
      ip: ip || null,
      userAgent: userAgent ? String(userAgent).slice(0, 500) : null,
      expiresAt,
    },
  })
  return { token, expiresAt }
}

export async function validarSesion(db, token) {
  if (!token) return null
  const ahora = new Date()
  const sesion = await db.entrenadorSession.findUnique({
    where: { token },
    select: { id: true, entrenadorId: true, tenantId: true, expiresAt: true, revokedAt: true },
  })
  if (!sesion) return null
  if (sesion.revokedAt) return null
  if (sesion.expiresAt < ahora) return null

  await db.entrenadorSession.update({
    where: { id: sesion.id },
    data: { lastUsedAt: ahora, expiresAt: calcularExpiracion() },
  })
  return { entrenadorId: sesion.entrenadorId, tenantId: sesion.tenantId, sesionId: sesion.id }
}

export async function revocarSesion(db, token) {
  if (!token) return
  await db.entrenadorSession.updateMany({
    where: { token, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

export async function revocarTodasSesiones(db, entrenadorId) {
  const r = await db.entrenadorSession.updateMany({
    where: { entrenadorId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  return r.count
}

export async function listarSesionesActivas(db, entrenadorId) {
  const ahora = new Date()
  return db.entrenadorSession.findMany({
    where: { entrenadorId, revokedAt: null, expiresAt: { gt: ahora } },
    select: { id: true, ip: true, userAgent: true, createdAt: true, lastUsedAt: true, expiresAt: true },
    orderBy: { lastUsedAt: 'desc' },
  })
}

export function setSesionCookie(res, token, expiresAt) {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  })
}

export function clearSesionCookie(res) {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  })
}
