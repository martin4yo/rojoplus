import express from 'express'
import prisma from '../../lib/prisma.js'

const router = express.Router()

/**
 * GET /api/super-admin/tenants
 * Listar todos los tenants con filtrado opcional
 */
router.get('/', async (req, res) => {
  try {
    const { estado, activo } = req.query

    const where = {}
    if (estado) where.estado = estado
    if (activo !== undefined) where.activo = activo === 'true'

    const tenants = await prisma.tenant.findMany({
      where,
      include: {
        tenantUsuarios: { include: { admin: true } },
        configuraciones: true
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json(tenants)
  } catch (error) {
    console.error('Error listing tenants:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/super-admin/tenants/:id
 * Obtener detalle de un tenant
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const tenant = await prisma.tenant.findUnique({
      where: { id: parseInt(id) },
      include: {
        tenantUsuarios: { include: { admin: true } },
        configuraciones: true
      }
    })

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant no encontrado' })
    }

    res.json(tenant)
  } catch (error) {
    console.error('Error fetching tenant:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/super-admin/tenants/:id/approve
 * Aprobar un tenant pendiente
 */
router.post('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params
    const adminId = req.user?.id

    const tenant = await prisma.tenant.update({
      where: { id: parseInt(id) },
      data: {
        estado: 'ACTIVE',
        activo: true,
        fechaAprobacion: new Date(),
        aprobadoPor: adminId
      },
      include: { tenantUsuarios: true }
    })

    res.json({ success: true, tenant })
  } catch (error) {
    console.error('Error approving tenant:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/super-admin/tenants/:id/reject
 * Rechazar un tenant pendiente
 */
router.post('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params
    const { razon } = req.body

    const tenant = await prisma.tenant.update({
      where: { id: parseInt(id) },
      data: {
        estado: 'CANCELLED',
        activo: false,
        motivoSuspension: razon || 'Rechazado por administrador'
      }
    })

    res.json({ success: true, tenant })
  } catch (error) {
    console.error('Error rejecting tenant:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/super-admin/tenants/:id/suspend
 * Suspender un tenant activo
 */
router.post('/:id/suspend', async (req, res) => {
  try {
    const { id } = req.params
    const { razon } = req.body

    const tenant = await prisma.tenant.update({
      where: { id: parseInt(id) },
      data: {
        estado: 'SUSPENDED',
        activo: false,
        fechaSuspension: new Date(),
        motivoSuspension: razon || 'Suspendido por administrador'
      }
    })

    res.json({ success: true, tenant })
  } catch (error) {
    console.error('Error suspending tenant:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * DELETE /api/super-admin/tenants/:id
 * Eliminar un tenant (CUIDADO: también elimina datos relacionados)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params

    // Verificar que no sea el tenant por defecto
    const tenant = await prisma.tenant.findUnique({
      where: { id: parseInt(id) }
    })

    if (tenant?.subdomain === 'sportivo-pilar') {
      return res.status(403).json({
        error: 'No se puede eliminar el tenant por defecto'
      })
    }

    await prisma.tenant.delete({
      where: { id: parseInt(id) }
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting tenant:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/super-admin/stats
 * Estadísticas globales del sistema
 */
router.get('/stats', async (req, res) => {
  try {
    const [tenantCount, adminCount, socioCount] = await Promise.all([
      prisma.tenant.count(),
      prisma.admin.count(),
      prisma.socio.count()
    ])

    const activeTenants = await prisma.tenant.count({
      where: { activo: true }
    })

    res.json({
      tenants: tenantCount,
      activeTenants,
      admins: adminCount,
      socios: socioCount
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
