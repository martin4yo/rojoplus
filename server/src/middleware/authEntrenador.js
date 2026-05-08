/**
 * Middleware authEntrenador
 *
 * Valida la cookie de sesión del entrenador y popula `req.entrenador` con
 * `{ id, tenantId }`. Si no hay sesión válida, devuelve 401.
 */

import { SESSION_COOKIE, validarSesion, clearSesionCookie } from '../services/sesionEntrenadorService.js'
import { AppError } from './errorHandler.js'

export async function authEntrenador(req, res, next) {
  try {
    const cookieToken = req.cookies?.[SESSION_COOKIE]
    if (!cookieToken) {
      return next(new AppError('No autenticado', 401, 'NOT_AUTHENTICATED'))
    }
    const sesion = await validarSesion(req.db, cookieToken)
    if (!sesion) {
      clearSesionCookie(res)
      return next(new AppError('Sesión inválida o expirada', 401, 'SESSION_EXPIRED'))
    }
    if (sesion.tenantId !== req.tenantId) {
      // Sesión cruzada de otro tenant — bloquear
      clearSesionCookie(res)
      return next(new AppError('Sesión inválida', 401, 'TENANT_MISMATCH'))
    }
    req.entrenador = { id: sesion.entrenadorId, tenantId: sesion.tenantId, sesionId: sesion.sesionId }
    next()
  } catch (err) {
    next(err)
  }
}

/**
 * Helper: verifica que el entrenador esté asignado a la categoría dada.
 * Usado por endpoints de plantel/asistencia/convocatorias para asegurar que
 * el entrenador solo accede a sus propias categorías.
 *
 * Acepta categoria activa (sin fechaHasta o fechaHasta > hoy).
 */
export async function tienePermisoCategoria(db, entrenadorId, categoriaActividadId) {
  if (!entrenadorId || !categoriaActividadId) return false
  const ahora = new Date()
  const rel = await db.entrenadorCategoria.findFirst({
    where: {
      entrenadorId,
      categoriaActividadId: parseInt(categoriaActividadId),
      fechaDesde: { lte: ahora },
      OR: [
        { fechaHasta: null },
        { fechaHasta: { gt: ahora } },
      ],
    },
    select: { id: true },
  })
  return !!rel
}
