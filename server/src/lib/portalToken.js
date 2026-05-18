/**
 * Helper para asegurar que un socio tenga tokenPortal vigente.
 *
 * Antes había código que construía URLs `.../portal-socio/${socio.tokenPortal}`
 * asumiendo que el campo existía. Si era null (socio nuevo o sin login previo)
 * o estaba expirado, el link quedaba roto (404).
 *
 * Este helper:
 *   1. Si el socio ya tiene un token vigente → lo devuelve.
 *   2. Si no, genera uno nuevo, lo persiste en la DB y lo devuelve.
 *
 * Convención de token: 32 bytes hex (64 chars), consistente con actionExecutor
 * y con el endpoint admin que rota tokens.
 */

import crypto from 'crypto'
import prisma from './prisma.js'

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 días

/**
 * Asegura que el socio tenga tokenPortal vigente. Devuelve el token.
 *
 * @param {object} socio — debe tener `id` y opcionalmente `tokenPortal` /
 *                        `tokenPortalExpira` ya cargados (para evitar query
 *                        extra cuando viene fresco de la DB).
 * @returns {Promise<string>} token vigente.
 */
export async function ensurePortalToken(socio) {
  if (!socio?.id) {
    throw new Error('ensurePortalToken: socio.id requerido')
  }

  // Caso happy: viene cargado y vigente
  const expira = socio.tokenPortalExpira ? new Date(socio.tokenPortalExpira) : null
  const vigente = !expira || expira > new Date()
  if (socio.tokenPortal && vigente) {
    return socio.tokenPortal
  }

  // Falta o expiró: generar y persistir
  const nuevoToken = crypto.randomBytes(32).toString('hex')
  const nuevaExpira = new Date(Date.now() + TOKEN_TTL_MS)
  await prisma.socio.update({
    where: { id: socio.id },
    data: { tokenPortal: nuevoToken, tokenPortalExpira: nuevaExpira },
  })
  // Actualizamos el objeto in-place para que callers que reusen `socio` vean
  // el token nuevo sin tener que re-fetch.
  socio.tokenPortal = nuevoToken
  socio.tokenPortalExpira = nuevaExpira
  return nuevoToken
}
