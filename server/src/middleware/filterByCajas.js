import prisma from '../lib/prisma.js'

/**
 * Obtiene los IDs de cajas permitidos para un usuario admin
 *
 * @param {number} adminId - ID del admin
 * @returns {Promise<number[]|null>}
 *   - null: acceso total (super admin)
 *   - []: sin acceso (rol sin cajas asignadas)
 *   - [1,2,3]: acceso a cajas específicas
 *
 * @example
 * const cajasIds = await getUserAllowedCajas(req.admin.id)
 * if (cajasIds !== null) {
 *   where.cajaId = { in: cajasIds }
 * }
 */
export async function getUserAllowedCajas(adminId) {
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    include: {
      rol: {
        include: {
          cajas: { select: { cajaId: true } }
        }
      }
    }
  })

  // Super admin tiene acceso a todo
  if (admin?.rol?.esSuperAdmin) {
    return null
  }

  // Si no tiene rol o no tiene cajas asignadas, sin acceso
  if (!admin?.rol?.cajas || admin.rol.cajas.length === 0) {
    return []
  }

  // Retorna array de IDs de cajas permitidas
  return admin.rol.cajas.map(cr => cr.cajaId)
}

/**
 * Aplica filtro de cajas a un where de Prisma
 *
 * @param {Object} where - Objeto where de Prisma
 * @param {number[]|null} cajasIds - IDs de cajas permitidas o null para sin filtro
 * @param {string} field - Campo a filtrar (default: 'cajaId')
 * @returns {Object} Where modificado con el filtro
 *
 * @example
 * let where = { estado: 'ACTIVO' }
 * const cajasIds = await getUserAllowedCajas(req.admin.id)
 * where = applyCajasFilter(where, cajasIds)
 * // Si cajasIds es [], el filtro será { in: [] } que no retorna nada
 */
export function applyCajasFilter(where, cajasIds, field = 'cajaId') {
  if (cajasIds === null) {
    return where // Sin filtro - acceso total (super admin)
  }

  // Si es array vacío, retorna filtro que no matchea nada
  // Prisma con { in: [] } no retorna resultados
  return {
    ...where,
    [field]: { in: cajasIds }
  }
}

/**
 * Aplica filtro de cajas a un where de Prisma para relación anidada
 *
 * @param {Object} where - Objeto where de Prisma
 * @param {number[]|null} cajasIds - IDs de cajas permitidas
 * @param {string} relationPath - Path de la relación (ej: 'caja.id')
 * @returns {Object} Where modificado
 *
 * @example
 * where = applyCajasFilterNested(where, cajasIds, 'caja.id')
 */
export function applyCajasFilterNested(where, cajasIds, relationPath = 'caja.id') {
  if (cajasIds === null) {
    return where
  }

  const parts = relationPath.split('.')
  if (parts.length === 2) {
    const [relation, field] = parts
    return {
      ...where,
      [relation]: {
        [field]: { in: cajasIds }
      }
    }
  }

  return applyCajasFilter(where, cajasIds)
}

/**
 * Middleware que agrega las cajas permitidas al request
 * Uso: router.use(attachAllowedCajas)
 */
export async function attachAllowedCajas(req, res, next) {
  try {
    if (req.admin?.id) {
      req.allowedCajas = await getUserAllowedCajas(req.admin.id)
    }
    next()
  } catch (error) {
    next(error)
  }
}

/**
 * Middleware que restringe acceso solo a usuarios con cajas asignadas
 */
export async function requireCajaAccess(req, res, next) {
  try {
    const cajasIds = await getUserAllowedCajas(req.admin?.id)

    if (cajasIds !== null && cajasIds.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'No tiene cajas asignadas'
      })
    }

    req.allowedCajas = cajasIds
    next()
  } catch (error) {
    next(error)
  }
}

/**
 * Verifica si un usuario tiene acceso a una caja específica
 *
 * @param {number} adminId - ID del admin
 * @param {number} cajaId - ID de la caja a verificar
 * @returns {Promise<boolean>}
 */
export async function hasAccessToCaja(adminId, cajaId) {
  const cajasIds = await getUserAllowedCajas(adminId)

  // null significa acceso total
  if (cajasIds === null) {
    return true
  }

  return cajasIds.includes(cajaId)
}

/**
 * Middleware factory para verificar acceso a caja específica
 *
 * @param {string} cajaIdParam - Nombre del parámetro con el ID de caja (default: 'cajaId')
 */
export function checkCajaAccess(cajaIdParam = 'cajaId') {
  return async (req, res, next) => {
    try {
      const cajaId = parseInt(req.params[cajaIdParam] || req.body[cajaIdParam])

      if (!cajaId) {
        return res.status(400).json({
          success: false,
          error: 'ID de caja requerido'
        })
      }

      const hasAccess = await hasAccessToCaja(req.admin?.id, cajaId)

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'No tiene acceso a esta caja'
        })
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}

export default {
  getUserAllowedCajas,
  applyCajasFilter,
  applyCajasFilterNested,
  attachAllowedCajas,
  requireCajaAccess,
  hasAccessToCaja,
  checkCajaAccess
}
