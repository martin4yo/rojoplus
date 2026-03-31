import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'
import prisma from '../../lib/prisma.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// Directorio para logos de tenants
const uploadDirTenants = path.join(__dirname, '../../../uploads/tenants')
if (!fs.existsSync(uploadDirTenants)) {
  fs.mkdirSync(uploadDirTenants, { recursive: true })
}

// Configurar multer para logos de tenants
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDirTenants),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `tenant-${req.params.id}-logo${ext}`)
  }
})
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Solo se permiten imágenes'))
  }
})

/**
 * GET /api/super-admin/tenants
 * Listar todos los tenants con filtrado opcional
 */
router.get('/stats', async (req, res) => {
  try {
    const [tenantCount, adminCount, socioCount] = await Promise.all([
      prisma.tenant.count(),
      prisma.admin.count(),
      prisma.socio.count()
    ])
    const activeTenants = await prisma.tenant.count({ where: { activo: true } })
    res.json({ tenants: tenantCount, activeTenants, admins: adminCount, socios: socioCount })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

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
    const { nombre, email, telefono, direccion, ciudad, provincia, codigoPostal, descripcion, slogan, plan, maxSocios, maxAdmins, timezone, moneda, logoUrl, horarios, redesSociales } = req.body

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
        moneda,
        ...(logoUrl !== undefined && { logoUrl }),
        ...(horarios !== undefined && { horarios }),
        ...(redesSociales !== undefined && { redesSociales }),
        ...(req.body.heroImageUrl !== undefined && { heroImageUrl: req.body.heroImageUrl }),
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
      if (!adminData.password || adminData.password.length < 8) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' })
      }
      const hashedPassword = await bcrypt.hash(adminData.password, 12)
      admin = await prisma.admin.create({
        data: {
          nombre: adminData.nombre,
          email: adminData.email,
          nombreUsuario: adminData.nombreUsuario || adminData.email.split('@')[0],
          password: hashedPassword,
          activo: true,
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
 * POST /api/super-admin/tenants/:id/logo
 * Subir logo de un tenant
 */
const uploadHero = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDirTenants),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname)
      cb(null, `tenant-${req.params.id}-hero${ext}`)
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Solo se permiten imágenes'))
  }
})

router.post('/:id/hero', uploadHero.single('hero'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' })

    const heroImageUrl = `/uploads/tenants/${req.file.filename}`

    const tenant = await prisma.tenant.update({
      where: { id: parseInt(req.params.id) },
      data: { heroImageUrl }
    })

    res.json({ success: true, heroImageUrl, tenant })
  } catch (error) {
    console.error('Error subiendo hero:', error)
    res.status(500).json({ error: error.message })
  }
})

router.post('/:id/logo', upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' })
    }

    const logoUrl = `/uploads/tenants/${req.file.filename}`

    const tenant = await prisma.tenant.update({
      where: { id: parseInt(req.params.id) },
      data: { logoUrl }
    })

    res.json({ success: true, logoUrl, tenant })
  } catch (error) {
    console.error('Error subiendo logo:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/super-admin/stats
 * Estadísticas globales del sistema
 */
export default router
