import prisma from '../lib/prisma.js'
import { createTenantPrisma } from '../lib/tenantPrisma.js'

/**
 * Autenticación de dispositivos físicos (molinete-service).
 *
 * Requiere 2 headers:
 *   - X-Tenant-Slug: slug del tenant (subdomain del club)
 *   - Authorization: Bearer <apiToken del dispositivo>
 *
 * Valida el par (tenant, apiToken) y deja seteado:
 *   req.tenant, req.tenantId, req.db (tenant-scoped), req.dispositivo
 *
 * También actualiza ultimoPing del dispositivo.
 */
export async function authDispositivo(req, res, next) {
  try {
    const slug = req.get('X-Tenant-Slug')
    const authHeader = req.get('Authorization') || ''
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : null

    if (!slug || !token) {
      return res.status(401).json({
        success: false,
        error: 'Headers X-Tenant-Slug y Authorization son obligatorios'
      })
    }

    const tenant = await prisma.tenant.findUnique({ where: { subdomain: slug } })
    if (!tenant || !tenant.activo) {
      return res.status(401).json({ success: false, error: 'Tenant inválido o inactivo' })
    }
    if (tenant.estado === 'SUSPENDED') {
      return res.status(403).json({ success: false, error: 'Tenant suspendido' })
    }

    const dispositivo = await prisma.dispositivoAcceso.findUnique({
      where: { apiToken: token }
    })

    if (!dispositivo || dispositivo.tenantId !== tenant.id || !dispositivo.activo) {
      return res.status(401).json({ success: false, error: 'Dispositivo no autorizado' })
    }

    req.tenant = tenant
    req.tenantId = tenant.id
    req.db = createTenantPrisma(tenant.id)
    req.dispositivo = dispositivo

    // Ping no bloqueante — si falla, que no aborte el request
    prisma.dispositivoAcceso
      .update({ where: { id: dispositivo.id }, data: { ultimoPing: new Date() } })
      .catch(() => {})

    next()
  } catch (error) {
    console.error('Error en authDispositivo:', error)
    res.status(500).json({ success: false, error: 'Error de autenticación' })
  }
}
