import prisma from '../lib/prisma.js';

/**
 * Extrae el tenant basándose en el subdomain del host
 * Inserta req.tenant y req.tenantId en el request
 */
export async function extractTenant(req, res, next) {
  try {
    const host = req.get('host');
    const subdomain = extractSubdomain(host);

    if (!subdomain) {
      return res.status(400).json({
        error: 'No se pudo identificar el tenant',
        code: 'TENANT_REQUIRED'
      });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { subdomain }
    });

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
    const subdomain = extractSubdomain(host);

    if (!subdomain) {
      // No hay subdomain, continuar sin tenant
      req.tenant = null;
      req.tenantId = null;
      return next();
    }

    const tenant = await prisma.tenant.findUnique({
      where: { subdomain }
    });

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
 * Middleware para validar que el usuario es super-admin
 */
export function requireSuperAdmin(req, res, next) {
  if (!req.user?.esSuperAdmin) {
    return res.status(403).json({
      error: 'Acceso denegado: requiere permisos de super-admin'
    });
  }
  next();
}
