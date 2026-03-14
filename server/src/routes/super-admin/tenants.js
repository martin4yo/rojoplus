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
 * POST /api/super-admin/tenants
 * Crear un nuevo tenant
 */
router.post('/', async (req, res) => {
  try {
    const { nombre, subdomain, email, telefono, direccion, ciudad, provincia, codigoPostal, descripcion, slogan, plan, maxSocios, maxAdmins, timezone, moneda } = req.body

    // Validaciones
    if (!nombre || !subdomain) {
      return res.status(400).json({ error: 'nombre y subdomain son requeridos' })
    }

    // Verificar que el subdomain sea único
    const existing = await prisma.tenant.findUnique({ where: { subdomain } })
    if (existing) {
      return res.status(409).json({ error: 'El subdomain ya existe' })
    }

    const tenant = await prisma.tenant.create({
      data: {
        nombre,
        subdomain,
        slug: subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        email,
        telefono,
        direccion,
        ciudad,
        provincia,
        codigoPostal,
        descripcion,
        slogan,
        plan: plan || 'TRIAL',
        maxSocios,
        maxAdmins,
        timezone: timezone || 'America/Argentina/Buenos_Aires',
        moneda: moneda || 'ARS',
        estado: 'PENDING_APPROVAL',
        activo: false
      }
    })

    res.status(201).json(tenant)
  } catch (error) {
    console.error('Error creating tenant:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * PUT /api/super-admin/tenants/:id
 * Actualizar un tenant
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { nombre, email, telefono, direccion, ciudad, provincia, codigoPostal, descripcion, slogan, plan, maxSocios, maxAdmins, timezone, moneda } = req.body

    const tenant = await prisma.tenant.update({
      where: { id: parseInt(id) },
      data: {
        nombre,
        email,
        telefono,
        direccion,
        ciudad,
        provincia,
        codigoPostal,
        descripcion,
        slogan,
        plan,
        maxSocios,
        maxAdmins,
        timezone,
        moneda
      }
    })

    res.json(tenant)
  } catch (error) {
    console.error('Error updating tenant:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/super-admin/tenants/register
 * Registro público de nuevo tenant
 */
router.post('/register', async (req, res) => {
  try {
    const { nombre, subdomain, email, telefono, direccion, ciudad, provincia, codigoPostal, descripcion, slogan, razonSocial, cuit, adminData } = req.body

    // Validaciones
    if (!nombre || !subdomain || !email || !adminData) {
      return res.status(400).json({ error: 'Campos requeridos faltando' })
    }

    // Verificar que el subdomain sea único
    const existing = await prisma.tenant.findUnique({ where: { subdomain } })
    if (existing) {
      return res.status(409).json({ error: 'El subdomain ya existe' })
    }

    // Crear o buscar admin
    let admin = await prisma.admin.findUnique({
      where: { email: adminData.email }
    })

    if (!admin) {
      // Crear nuevo admin (TODO: agregar hash de contraseña)
      admin = await prisma.admin.create({
        data: {
          nombre: adminData.nombre,
          email: adminData.email,
          nombreUsuario: adminData.nombreUsuario || adminData.email.split('@')[0],
          password: adminData.password, // TODO: hashear con bcrypt
          activo: true
        }
      })
    }

    // Crear tenant en estado PENDING_APPROVAL
    const tenant = await prisma.tenant.create({
      data: {
        nombre,
        subdomain,
        slug: subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        email,
        telefono,
        direccion,
        ciudad,
        provincia,
        codigoPostal,
        descripcion,
        slogan,
        razonSocial,
        cuit,
        plan: 'TRIAL',
        maxSocios: 100,
        maxAdmins: 5,
        timezone: 'America/Argentina/Buenos_Aires',
        moneda: 'ARS',
        estado: 'PENDING_APPROVAL',
        activo: false,
        tenantUsuarios: {
          create: {
            adminId: admin.id,
            rol: 'ADMIN'
          }
        }
      },
      include: {
        tenantUsuarios: true
      }
    })

    // TODO: Enviar email de confirmación

    res.status(201).json({
      success: true,
      message: 'Registro enviado. Pendiente de aprobación.',
      tenant
    })
  } catch (error) {
    console.error('Error registering tenant:', error)
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
