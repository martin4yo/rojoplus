import { Router } from 'express'
import bcrypt from 'bcryptjs'
import prisma from '../../lib/prisma.js'
import { asyncHandler, AppError } from '../../middleware/errorHandler.js'
import { generateToken, generateTempToken, verifyTempToken } from '../../middleware/auth.js'

const router = Router()

/**
 * POST /api/admin/login
 * Paso 1: valida credenciales y devuelve un token preliminar + lista de tenants accesibles.
 *
 * Body: { email, password }
 *
 * Respuesta:
 *   {
 *     tempToken: string (JWT 5min, solo sirve para /select-tenant),
 *     admin: { id, email, nombre, apellido },
 *     esSuperAdmin: boolean,
 *     tenants: [{ id, slug, subdomain, nombre, logoUrl, rolEnTenant, activoEnTenant }],
 *   }
 *
 * Si hay un solo tenant accesible, el frontend puede saltar directo a /select-tenant.
 * Si esSuperAdmin = true, además puede elegir "modo super-admin" sin tenant.
 */
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    throw new AppError('Email y contraseña son requeridos', 400, 'VALIDATION_ERROR')
  }

  const admin = await prisma.admin.findUnique({
    where: { email },
    include: { rol: { select: { id: true, codigo: true, nombre: true, esSuperAdmin: true } } },
  })

  if (!admin || !admin.activo) {
    throw new AppError('Credenciales inválidas', 401, 'AUTH_INVALID')
  }

  const validPassword = await bcrypt.compare(password, admin.passwordHash)
  if (!validPassword) {
    throw new AppError('Credenciales inválidas', 401, 'AUTH_INVALID')
  }

  const esSuperAdmin = admin.rol?.esSuperAdmin || false

  // Tenants accesibles para el usuario:
  //   - Super-admin: TODOS los tenants activos
  //   - Resto: solo aquellos donde tenga TenantUsuario(activo=true)
  let tenants = []
  if (esSuperAdmin) {
    const all = await prisma.tenant.findMany({
      where: { activo: true },
      select: { id: true, slug: true, subdomain: true, nombre: true, logoUrl: true },
      orderBy: { nombre: 'asc' },
    })
    tenants = all.map(t => ({ ...t, rolEnTenant: 'SUPER_ADMIN', activoEnTenant: true }))
  } else {
    const tus = await prisma.tenantUsuario.findMany({
      where: { adminId: admin.id, activo: true },
      include: {
        tenant: { select: { id: true, slug: true, subdomain: true, nombre: true, logoUrl: true, activo: true } },
      },
    })
    tenants = tus
      .filter(tu => tu.tenant?.activo)
      .map(tu => ({
        id: tu.tenant.id,
        slug: tu.tenant.slug,
        subdomain: tu.tenant.subdomain,
        nombre: tu.tenant.nombre,
        logoUrl: tu.tenant.logoUrl,
        rolEnTenant: tu.rol,
        activoEnTenant: tu.activo,
      }))
  }

  if (tenants.length === 0 && !esSuperAdmin) {
    throw new AppError('Tu usuario no tiene acceso a ningún club', 403, 'NO_TENANT_ACCESS')
  }

  const tempToken = generateTempToken(admin)

  res.json({
    success: true,
    data: {
      tempToken,
      admin: {
        id: admin.id,
        email: admin.email,
        nombre: admin.nombre,
        apellido: admin.apellido,
      },
      esSuperAdmin,
      tenants,
    },
  })
}))

/**
 * POST /api/admin/select-tenant
 * Paso 2: con un tempToken válido y un tenantId elegido, devuelve el JWT final.
 *
 * Body: { tempToken, tenantId }
 *   - Para super-admin: tenantId puede ser null (modo super-admin sin tenant)
 *
 * Respuesta:
 *   {
 *     token: string (JWT 8h),
 *     admin: { id, email, nombre, apellido, rol, esSuperAdmin },
 *     tenant: { id, slug, subdomain, nombre } | null,
 *   }
 */
router.post('/select-tenant', asyncHandler(async (req, res) => {
  const { tempToken, tenantId } = req.body

  if (!tempToken) {
    throw new AppError('Token temporal requerido', 400, 'TEMP_TOKEN_REQUIRED')
  }

  let decoded
  try {
    decoded = verifyTempToken(tempToken)
  } catch (err) {
    throw new AppError('Token temporal expirado o inválido. Volvé a loguearte.', 401, 'TEMP_TOKEN_INVALID')
  }

  const admin = await prisma.admin.findUnique({
    where: { id: decoded.id },
    include: { rol: { select: { id: true, codigo: true, nombre: true, esSuperAdmin: true } } },
  })
  if (!admin || !admin.activo) {
    throw new AppError('Usuario inactivo', 401, 'AUTH_INVALID')
  }

  const esSuperAdmin = admin.rol?.esSuperAdmin || false

  let tenant = null
  if (tenantId) {
    tenant = await prisma.tenant.findUnique({
      where: { id: parseInt(tenantId) },
      select: { id: true, slug: true, subdomain: true, nombre: true, activo: true },
    })
    if (!tenant || !tenant.activo) {
      throw new AppError('Tenant inválido o inactivo', 400, 'TENANT_INVALID')
    }

    if (!esSuperAdmin) {
      const tu = await prisma.tenantUsuario.findUnique({
        where: { tenantId_adminId: { tenantId: tenant.id, adminId: admin.id } },
      })
      if (!tu || !tu.activo) {
        throw new AppError('No tenés acceso a este club', 403, 'TENANT_FORBIDDEN')
      }
    }
  } else {
    // tenantId null solo permitido para super-admin
    if (!esSuperAdmin) {
      throw new AppError('Tenant requerido', 400, 'TENANT_REQUIRED')
    }
  }

  // Actualizar último login
  await prisma.admin.update({
    where: { id: admin.id },
    data: { lastLogin: new Date() },
  })

  const token = generateToken(admin, { tenantId: tenant?.id ?? null, esSuperAdmin })

  res.json({
    success: true,
    data: {
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        nombre: admin.nombre,
        apellido: admin.apellido,
        rol: admin.rol,
        esSuperAdmin,
      },
      tenant: tenant ? {
        id: tenant.id,
        slug: tenant.slug,
        subdomain: tenant.subdomain,
        nombre: tenant.nombre,
      } : null,
    },
  })
}))

export default router
