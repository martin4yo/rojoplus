import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma.js'
import { AppError } from './errorHandler.js'

const JWT_SECRET = process.env.JWT_SECRET || 'rojoplus-secret'

// Cache de permisos por rol (se invalida cada 5 minutos)
let permisosCache = {}
let lastCacheUpdate = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutos

async function getPermisosRol(rolId) {
  const now = Date.now()

  // Invalidar cache si expiró
  if (now - lastCacheUpdate > CACHE_TTL) {
    permisosCache = {}
    lastCacheUpdate = now
  }

  // Retornar de cache si existe
  if (permisosCache[rolId]) {
    return permisosCache[rolId]
  }

  // Cargar permisos del rol
  const rol = await prisma.rol.findUnique({
    where: { id: rolId },
    include: {
      permisos: {
        include: { permiso: true }
      }
    }
  })

  if (!rol) return []

  // Si es super admin, tiene todos los permisos
  if (rol.esSuperAdmin) {
    permisosCache[rolId] = ['*']
    return ['*']
  }

  const permisos = rol.permisos.map(pr => pr.permiso.codigo)
  permisosCache[rolId] = permisos
  return permisos
}

// Middleware para autenticar admin con JWT.
// Valida que el JWT pertenezca al tenant del request (excepto super-admin).
export function authAdmin(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Token no proporcionado', 401, 'AUTH_REQUIRED'))
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, JWT_SECRET)

    // Rechazar tokens preliminares (los del paso 1 del login antes de elegir tenant)
    if (decoded.tipo === 'temp') {
      return next(new AppError('Token temporal: seleccioná un tenant primero', 401, 'TEMP_TOKEN'))
    }

    // Super-admin tiene acceso global, no se valida tenant
    if (!decoded.esSuperAdmin) {
      // Para admins normales, el tenant del JWT debe coincidir con el del request
      const tenantIdRequest = req.tenant?.id ?? req.tenantId
      if (!tenantIdRequest) {
        return next(new AppError('Tenant no identificado en la request', 400, 'TENANT_REQUIRED'))
      }
      if (decoded.tenantId !== tenantIdRequest) {
        return next(new AppError('Tu token no tiene acceso a este tenant', 403, 'TENANT_FORBIDDEN'))
      }
    }

    req.admin = decoded
    next()
  } catch (err) {
    if (err instanceof AppError) return next(err)
    return next(new AppError('Token inválido', 401, 'AUTH_INVALID'))
  }
}

// Middleware para verificar permisos específicos
// Uso: router.get('/ruta', authAdmin, checkPermiso('SOCIOS_LISTAR'), handler)
export function checkPermiso(...permisosRequeridos) {
  return async (req, res, next) => {
    try {
      // Obtener admin completo con rol
      const admin = await prisma.admin.findUnique({
        where: { id: req.admin.id },
        select: { id: true, rolId: true, activo: true }
      })

      if (!admin || !admin.activo) {
        return next(new AppError('Usuario no encontrado o inactivo', 401))
      }

      // Sin rol asignado = sin permisos
      if (!admin.rolId) {
        return next(new AppError('No tiene permisos para esta acción', 403, 'FORBIDDEN'))
      }

      const permisosRol = await getPermisosRol(admin.rolId)

      // Super admin tiene todos los permisos
      if (permisosRol.includes('*')) {
        return next()
      }

      // Verificar si tiene al menos uno de los permisos requeridos
      const tienePermiso = permisosRequeridos.some(p => permisosRol.includes(p))

      if (!tienePermiso) {
        return next(new AppError('No tiene permisos para esta acción', 403, 'FORBIDDEN'))
      }

      next()
    } catch (err) {
      if (err instanceof AppError) return next(err)
      next(new AppError('Error verificando permisos', 500))
    }
  }
}

// Helper para verificar permisos sin middleware (para uso interno)
export async function tienePermiso(adminId, ...permisosRequeridos) {
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { rolId: true, activo: true }
  })

  if (!admin || !admin.activo || !admin.rolId) {
    return false
  }

  const permisosRol = await getPermisosRol(admin.rolId)

  if (permisosRol.includes('*')) {
    return true
  }

  return permisosRequeridos.some(p => permisosRol.includes(p))
}

// Función para invalidar cache (llamar después de modificar roles/permisos)
export function invalidarCachePermisos() {
  permisosCache = {}
  lastCacheUpdate = 0
}

// Middleware para autenticar comercio con token UUID
export async function authComercio(req, res, next) {
  const { token } = req.params

  if (!token) {
    throw new AppError('Token no proporcionado', 401, 'AUTH_REQUIRED')
  }

  const comercio = await req.prisma.comercio.findFirst({
    where: { token },
    include: { rubro: true },
  })

  if (!comercio) {
    throw new AppError('Token inválido', 401, 'AUTH_INVALID')
  }

  if (comercio.estado !== 'ACTIVO') {
    throw new AppError('Comercio inactivo', 401, 'COMERCIO_INACTIVO')
  }

  req.comercio = comercio
  next()
}

// Generar token JWT final (con tenantId + esSuperAdmin)
export function generateToken(admin, { tenantId, esSuperAdmin = false } = {}) {
  return jwt.sign(
    {
      id: admin.id,
      email: admin.email,
      tenantId: tenantId ?? null,
      esSuperAdmin,
      tipo: 'full',
    },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  )
}

// Generar token preliminar (después de validar credenciales pero antes de elegir tenant).
// Solo sirve para llamar a /select-tenant. Expiración corta.
export function generateTempToken(admin) {
  return jwt.sign(
    { id: admin.id, email: admin.email, tipo: 'temp' },
    JWT_SECRET,
    { expiresIn: '5m' }
  )
}

// Verificar un token preliminar (uso en /select-tenant)
export function verifyTempToken(token) {
  const decoded = jwt.verify(token, JWT_SECRET)
  if (decoded.tipo !== 'temp') {
    throw new AppError('Token preliminar inválido', 401, 'TEMP_TOKEN_INVALID')
  }
  return decoded
}
