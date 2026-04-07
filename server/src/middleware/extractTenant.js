import prisma from '../lib/prisma.js';
import { authAdmin } from './auth.js';

/**
 * Extrae el tenant basándose en el subdomain del host
 * Inserta req.tenant y req.tenantId en el request
 */
export async function extractTenant(req, res, next) {
  try {
    const host = req.get('host');
    let subdomain = extractSubdomain(host);

    // Header X-Tenant-Slug tiene prioridad (enviado por el frontend desde el subdomain del browser)
    const tenantSlugHeader = req.get('X-Tenant-Slug');
    if (tenantSlugHeader) {
      subdomain = tenantSlugHeader;
    }

    // En desarrollo sin subdomain, usar tenant default para permitir acceso local
    if (!subdomain && process.env.NODE_ENV !== 'production') {
      subdomain = process.env.DEFAULT_TENANT_SUBDOMAIN || 'sportivopilar';
    }

    // Buscar tenant: primero por subdomain, luego por dominio custom
    let tenant = null;

    if (subdomain) {
      tenant = await prisma.tenant.findUnique({ where: { subdomain } });
    }

    // Si no se encontró por subdomain, intentar por dominio custom (ej: sportivopilar.com.ar)
    if (!tenant) {
      const hostSinPuerto = (host || '').split(':')[0];
      if (hostSinPuerto) {
        tenant = await prisma.tenant.findUnique({ where: { dominioCustom: hostSinPuerto } });
      }
    }

    if (!tenant) {
      return res.status(400).json({
        error: 'No se pudo identificar el tenant',
        code: 'TENANT_REQUIRED'
      });
    }

    if (!tenant || !tenant.activo) {
      return res.status(404).json({
        error: 'Club no encontrado o inactivo',
        code: 'TENANT_NOT_FOUND'
      });
    }

    if (tenant.estado === 'SUSPENDED') {
      return res.status(403).json({
        error: 'Club suspendido',
        code: 'TENANT_SUSPENDED'
      });
    }

    req.tenant = tenant;
    req.tenantId = tenant.id;
    next();
  } catch (error) {
    console.error('Error extracting tenant:', error);
    next(error);
  }
}

/**
 * Versión opcional de extractTenant que no falla si no hay subdomain
 * Útil para rutas públicas que pueden funcionar sin tenant
 */
export async function extractTenantOptional(req, res, next) {
  try {
    const host = req.get('host');
    const tenantSlugHeader = req.get('X-Tenant-Slug');
    const subdomain = tenantSlugHeader || extractSubdomain(host);

    let tenant = null;

    if (subdomain) {
      tenant = await prisma.tenant.findUnique({ where: { subdomain } });
    }

    // Intentar por dominio custom si no se encontró por subdomain
    if (!tenant) {
      const hostSinPuerto = (host || '').split(':')[0];
      if (hostSinPuerto) {
        tenant = await prisma.tenant.findUnique({ where: { dominioCustom: hostSinPuerto } });
      }
    }

    if (!tenant || !tenant.activo) {
      // Tenant no encontrado, continuar sin él
      req.tenant = null;
      req.tenantId = null;
      return next();
    }

    req.tenant = tenant;
    req.tenantId = tenant.id;
    next();
  } catch (error) {
    console.error('Error extracting tenant:', error);
    next(error);
  }
}

/**
 * Extrae el subdomain del host
 * Ej:
 *   - localhost:3000 → null (sin subdomain)
 *   - sportivo.localhost:3000 → sportivo
 *   - sportivo-pilar.clubix.com → sportivo-pilar
 *   - clubix.com → null
 *   - www.clubix.com → null
 */
function extractSubdomain(host) {
  // Desarrollo: sportivo.localhost:3000 → sportivo
  if (host.includes('localhost')) {
    const match = host.match(/^([^.]+)\.localhost/);
    return match ? match[1] : null;
  }

  // Producción: sportivo-pilar.clubix.com → sportivo-pilar
  const parts = host.split(':')[0].split('.');

  // Casos que no son subdomain
  if (parts.length <= 2) return null;  // clubix.com
  if (parts[0] === 'www') return null; // www.clubix.com

  return parts[0];
}

/**
 * Middleware para validar que el usuario es super-admin.
 * Debe usarse DESPUÉS de authAdmin.
 */
export async function requireSuperAdmin(req, res, next) {
  // Primero verificar JWT
  authAdmin(req, res, async (err) => {
    if (err) return next(err);

    try {
      const admin = await prisma.admin.findUnique({
        where: { id: req.admin.id },
        select: { rol: { select: { esSuperAdmin: true } } }
      });

      if (!admin?.rol?.esSuperAdmin) {
        return res.status(403).json({
          error: 'Acceso denegado: requiere permisos de super-admin'
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  });
}
