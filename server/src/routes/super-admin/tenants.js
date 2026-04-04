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

// Precios estimados por modelo (USD por 1M tokens)
const PRECIOS_MODELOS = {
  'claude-haiku-4-5-20251001': { input: 0.80,  output: 4.00  },
  'claude-sonnet-4-6':         { input: 3.00,  output: 15.00 },
  'claude-opus-4-6':           { input: 15.00, output: 75.00 },
  'gpt-4o-mini':               { input: 0.15,  output: 0.60  },
  'gpt-4o':                    { input: 2.50,  output: 10.00 },
}

function calcularCosto(model, inputTokens, outputTokens) {
  const precio = PRECIOS_MODELOS[model] || { input: 1, output: 3 }
  return (inputTokens / 1_000_000 * precio.input) + (outputTokens / 1_000_000 * precio.output)
}

/**
 * GET /api/super-admin/tenants/uso
 * Dashboard de uso por tenant: socios, admins, última actividad, uso de IA
 */
router.get('/uso', async (req, res) => {
  try {
    const { desde, hasta } = req.query
    const fechaDesde = desde ? new Date(desde) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const fechaHasta = hasta ? new Date(hasta) : new Date()

    const tenants = await prisma.tenant.findMany({
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, subdomain: true, plan: true, estado: true, activo: true }
    })

    const datos = await Promise.all(tenants.map(async (tenant) => {
      const [socios, admins, ultimoPago, ultimoAcceso, aiLogs] = await Promise.all([
        prisma.socio.count({ where: { tenantId: tenant.id, estado: { in: ['ACTIVO', 'activo', 'VIGENTE', 'vigente'] } } }),
        prisma.tenantUsuario.count({ where: { tenantId: tenant.id } }),
        prisma.pago.findFirst({
          where: { tenantId: tenant.id },
          orderBy: { fecha: 'desc' },
          select: { fecha: true }
        }).catch(() => null),
        prisma.admin.findFirst({
          where: { tenantUsuarios: { some: { tenantId: tenant.id } } },
          orderBy: { lastLogin: 'desc' },
          select: { lastLogin: true }
        }).catch(() => null),
        prisma.aiUsageLog.groupBy({
          by: ['model', 'provider'],
          where: {
            tenantId: tenant.id,
            createdAt: { gte: fechaDesde, lte: fechaHasta }
          },
          _count: { id: true },
          _sum: { inputTokens: true, outputTokens: true }
        }).catch(() => [])
      ])

      const aiResumen = aiLogs.map(g => ({
        provider: g.provider,
        model: g.model,
        mensajes: g._count.id,
        inputTokens: g._sum.inputTokens || 0,
        outputTokens: g._sum.outputTokens || 0,
        costoUSD: calcularCosto(g.model, g._sum.inputTokens || 0, g._sum.outputTokens || 0)
      }))

      const aiTotales = aiResumen.reduce((acc, r) => ({
        mensajes: acc.mensajes + r.mensajes,
        inputTokens: acc.inputTokens + r.inputTokens,
        outputTokens: acc.outputTokens + r.outputTokens,
        costoUSD: acc.costoUSD + r.costoUSD,
      }), { mensajes: 0, inputTokens: 0, outputTokens: 0, costoUSD: 0 })

      return {
        ...tenant,
        socios,
        admins,
        ultimaActividad: ultimoPago?.fecha || ultimoAcceso?.lastLogin || null,
        ai: { ...aiTotales, breakdown: aiResumen }
      }
    }))

    res.json({ desde: fechaDesde, hasta: fechaHasta, tenants: datos })
  } catch (error) {
    console.error('Error obteniendo uso por tenant:', error)
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
 * POST /api/super-admin/tenants/:id/init-datos
 * Inicializar datos básicos de un tenant (solo llena tablas vacías)
 */
router.post('/:id/init-datos', async (req, res) => {
  const tenantId = parseInt(req.params.id)

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) return res.status(404).json({ error: 'Tenant no encontrado' })

  const resultado = {}

  // Helper: crear registros solo si la tabla está vacía para este tenant
  async function initSiVacia(model, clave, datos) {
    const count = await prisma[model].count({ where: { tenantId } })
    if (count > 0) {
      resultado[clave] = { skipped: true, existentes: count }
      return false
    }
    await prisma[model].createMany({ data: datos.map(d => ({ ...d, tenantId })) })
    resultado[clave] = { created: datos.length }
    return true
  }

  // ── 1. Plan de cuentas ──────────────────────────────────────────────────
  const ccCount = await prisma.cuentaContable.count({ where: { tenantId } })
  if (ccCount > 0) {
    resultado.cuentasContables = { skipped: true, existentes: ccCount }
  } else {
    // Cuentas padre (nivel 1)
    const padres = await Promise.all([
      prisma.cuentaContable.create({ data: { tenantId, codigo: '1', nombre: 'ACTIVO', tipo: 'ACTIVO', nivel: 1, esImputable: false, orden: 1 } }),
      prisma.cuentaContable.create({ data: { tenantId, codigo: '2', nombre: 'PASIVO', tipo: 'PASIVO', nivel: 1, esImputable: false, orden: 2 } }),
      prisma.cuentaContable.create({ data: { tenantId, codigo: '3', nombre: 'PATRIMONIO NETO', tipo: 'PATRIMONIO', nivel: 1, esImputable: false, orden: 3 } }),
      prisma.cuentaContable.create({ data: { tenantId, codigo: '4', nombre: 'INGRESOS', tipo: 'INGRESO', nivel: 1, esImputable: false, orden: 4 } }),
      prisma.cuentaContable.create({ data: { tenantId, codigo: '5', nombre: 'EGRESOS', tipo: 'EGRESO', nivel: 1, esImputable: false, orden: 5 } }),
    ])
    const [activo, pasivo, patrimonio, ingresos, egresos] = padres

    // Cuentas hijo (nivel 2)
    const hijos = await Promise.all([
      // Activo
      prisma.cuentaContable.create({ data: { tenantId, codigo: '1.1', nombre: 'Activo Corriente', tipo: 'ACTIVO', nivel: 2, padreId: activo.id, esImputable: false, orden: 10 } }),
      prisma.cuentaContable.create({ data: { tenantId, codigo: '1.2', nombre: 'Activo No Corriente', tipo: 'ACTIVO', nivel: 2, padreId: activo.id, esImputable: false, orden: 11 } }),
      // Pasivo
      prisma.cuentaContable.create({ data: { tenantId, codigo: '2.1', nombre: 'Pasivo Corriente', tipo: 'PASIVO', nivel: 2, padreId: pasivo.id, esImputable: false, orden: 20 } }),
      // Patrimonio
      prisma.cuentaContable.create({ data: { tenantId, codigo: '3.1', nombre: 'Capital Social', tipo: 'PATRIMONIO', nivel: 2, padreId: patrimonio.id, esImputable: true, orden: 30 } }),
      prisma.cuentaContable.create({ data: { tenantId, codigo: '3.2', nombre: 'Resultado del Ejercicio', tipo: 'PATRIMONIO', nivel: 2, padreId: patrimonio.id, esImputable: true, orden: 31 } }),
      // Ingresos
      prisma.cuentaContable.create({ data: { tenantId, codigo: '4.1', nombre: 'Cuotas Sociales', tipo: 'INGRESO', nivel: 2, padreId: ingresos.id, esImputable: true, orden: 40 } }),
      prisma.cuentaContable.create({ data: { tenantId, codigo: '4.2', nombre: 'Actividades Deportivas', tipo: 'INGRESO', nivel: 2, padreId: ingresos.id, esImputable: true, orden: 41 } }),
      prisma.cuentaContable.create({ data: { tenantId, codigo: '4.3', nombre: 'Buffet', tipo: 'INGRESO', nivel: 2, padreId: ingresos.id, esImputable: true, orden: 42 } }),
      prisma.cuentaContable.create({ data: { tenantId, codigo: '4.4', nombre: 'Mora y Recargos', tipo: 'INGRESO', nivel: 2, padreId: ingresos.id, esImputable: true, orden: 43 } }),
      prisma.cuentaContable.create({ data: { tenantId, codigo: '4.9', nombre: 'Otros Ingresos', tipo: 'INGRESO', nivel: 2, padreId: ingresos.id, esImputable: true, orden: 49 } }),
      // Egresos
      prisma.cuentaContable.create({ data: { tenantId, codigo: '5.1', nombre: 'Sueldos y Jornales', tipo: 'EGRESO', nivel: 2, padreId: egresos.id, esImputable: true, orden: 50 } }),
      prisma.cuentaContable.create({ data: { tenantId, codigo: '5.2', nombre: 'Servicios', tipo: 'EGRESO', nivel: 2, padreId: egresos.id, esImputable: true, orden: 51 } }),
      prisma.cuentaContable.create({ data: { tenantId, codigo: '5.3', nombre: 'Mantenimiento', tipo: 'EGRESO', nivel: 2, padreId: egresos.id, esImputable: true, orden: 52 } }),
      prisma.cuentaContable.create({ data: { tenantId, codigo: '5.4', nombre: 'Compras Buffet', tipo: 'EGRESO', nivel: 2, padreId: egresos.id, esImputable: true, orden: 53 } }),
      prisma.cuentaContable.create({ data: { tenantId, codigo: '5.9', nombre: 'Otros Egresos', tipo: 'EGRESO', nivel: 2, padreId: egresos.id, esImputable: true, orden: 59 } }),
    ])
    const [activoCte] = hijos

    // Cuentas hijo nivel 3 (Activo Corriente)
    await Promise.all([
      prisma.cuentaContable.create({ data: { tenantId, codigo: '1.1.1', nombre: 'Caja', tipo: 'ACTIVO', nivel: 3, padreId: activoCte.id, esImputable: true, orden: 100 } }),
      prisma.cuentaContable.create({ data: { tenantId, codigo: '1.1.2', nombre: 'Bancos', tipo: 'ACTIVO', nivel: 3, padreId: activoCte.id, esImputable: true, orden: 101 } }),
      prisma.cuentaContable.create({ data: { tenantId, codigo: '1.1.3', nombre: 'Deudores por Cuotas', tipo: 'ACTIVO', nivel: 3, padreId: activoCte.id, esImputable: true, orden: 102 } }),
    ])

    resultado.cuentasContables = { created: 5 + hijos.length + 3 }
  }

  // ── 2. Centros de costo ─────────────────────────────────────────────────
  await initSiVacia('centroCosto', 'centrosCosto', [
    { codigo: 'ADM', nombre: 'Administración', orden: 1 },
    { codigo: 'FUT', nombre: 'Fútbol', orden: 2 },
    { codigo: 'BAS', nombre: 'Básquet', orden: 3 },
    { codigo: 'VOL', nombre: 'Vóley', orden: 4 },
    { codigo: 'NAT', nombre: 'Natación', orden: 5 },
    { codigo: 'HOC', nombre: 'Hockey', orden: 6 },
    { codigo: 'TEN', nombre: 'Tenis', orden: 7 },
    { codigo: 'PAD', nombre: 'Paddle', orden: 8 },
    { codigo: 'GIM', nombre: 'Gimnasia', orden: 9 },
    { codigo: 'BUFFET', nombre: 'Buffet', orden: 10 },
  ])

  // ── 3. Conceptos de tesorería ───────────────────────────────────────────
  const conceptosCreados = await initSiVacia('conceptoTesoreria', 'conceptosTesoreria', [
    { codigo: 'COB-CUO', nombre: 'Cobranza de Cuotas',   tipo: 'INGRESO', usaEnTesoreria: true, usaEnVentas: false, usaEnCompras: false, orden: 1 },
    { codigo: 'COB-ACT', nombre: 'Cobranza Actividades', tipo: 'INGRESO', usaEnTesoreria: true, usaEnVentas: false, usaEnCompras: false, orden: 2 },
    { codigo: 'ING-MORA',nombre: 'Ingresos por Mora',    tipo: 'INGRESO', usaEnTesoreria: true, usaEnVentas: false, usaEnCompras: false, orden: 3 },
    { codigo: 'ING-BUF', nombre: 'Ingresos Buffet',      tipo: 'INGRESO', usaEnTesoreria: true, usaEnVentas: true,  usaEnCompras: false, orden: 4 },
    { codigo: 'OTR-ING', nombre: 'Otros Ingresos',       tipo: 'INGRESO', usaEnTesoreria: true, usaEnVentas: false, usaEnCompras: false, orden: 5 },
    { codigo: 'SUE',     nombre: 'Sueldos y Jornales',   tipo: 'EGRESO',  usaEnTesoreria: true, usaEnVentas: false, usaEnCompras: false, orden: 6 },
    { codigo: 'SERV',    nombre: 'Servicios',             tipo: 'EGRESO',  usaEnTesoreria: true, usaEnVentas: false, usaEnCompras: true,  orden: 7 },
    { codigo: 'MAN',     nombre: 'Mantenimiento',         tipo: 'EGRESO',  usaEnTesoreria: true, usaEnVentas: false, usaEnCompras: true,  orden: 8 },
    { codigo: 'COM',     nombre: 'Compras',               tipo: 'EGRESO',  usaEnTesoreria: true, usaEnVentas: false, usaEnCompras: true,  orden: 9 },
    { codigo: 'OTR-EGR', nombre: 'Otros Egresos',        tipo: 'EGRESO',  usaEnTesoreria: true, usaEnVentas: false, usaEnCompras: false, orden: 10 },
  ])

  // ── 4. Medios de pago ───────────────────────────────────────────────────
  await initSiVacia('medioPago', 'mediosPago', [
    { codigo: 'EFECTIVO',      nombre: 'Efectivo',           tipo: 'EFECTIVO',      activo: true,  orden: 1 },
    { codigo: 'TRANSFERENCIA', nombre: 'Transferencia',      tipo: 'TRANSFERENCIA', activo: true,  orden: 2 },
    { codigo: 'DEBITO',        nombre: 'Tarjeta Débito',     tipo: 'TARJETA',       activo: true,  orden: 3 },
    { codigo: 'CREDITO',       nombre: 'Tarjeta Crédito',    tipo: 'TARJETA',       activo: true,  orden: 4 },
    { codigo: 'MERCADOPAGO',   nombre: 'MercadoPago',        tipo: 'DIGITAL',       activo: true,  orden: 5 },
    { codigo: 'COBRADOR',      nombre: 'Por Cobrador',       tipo: 'EFECTIVO',      activo: false, orden: 6 },
    { codigo: 'DEBITO_AUTO',   nombre: 'Débito Automático',  tipo: 'DEBITO_AUTO',   activo: false, orden: 7 },
  ])

  // ── 5. Tipos de socio ───────────────────────────────────────────────────
  await initSiVacia('tipoSocio', 'tiposSocio', [
    { codigo: 'ACTIVO',    nombre: 'Socio Activo',    descripcion: 'Socio mayor de edad',          color: 'green', orden: 1 },
    { codigo: 'CADETE',    nombre: 'Socio Cadete',    descripcion: 'Menor de 18 años',             color: 'blue',  orden: 2 },
    { codigo: 'VITALICIO', nombre: 'Socio Vitalicio', descripcion: 'Sin cargo mensual',            color: 'gold',  orden: 3 },
    { codigo: 'ADHERENTE', nombre: 'Socio Adherente', descripcion: 'Sin acceso a instalaciones',   color: 'gray',  orden: 4 },
  ])

  // ── 6. Categorías de socio ──────────────────────────────────────────────
  await initSiVacia('categoriaSocio', 'categoriasSocio', [
    { codigo: 'REGULAR',  nombre: 'Regular',           porcentajeDescuento: 0,   orden: 1 },
    { codigo: 'JUBILADO', nombre: 'Jubilado',          porcentajeDescuento: 50,  orden: 2 },
    { codigo: 'PERSONAL', nombre: 'Personal del Club', porcentajeDescuento: 100, orden: 3 },
  ])

  // ── 7. Estados de socio ─────────────────────────────────────────────────
  await initSiVacia('estadoSocio', 'estadosSocio', [
    { codigo: 'VIGENTE',    nombre: 'Vigente',    color: '#16a34a', permiteDescuentos: true,  orden: 1 },
    { codigo: 'SUSPENDIDO', nombre: 'Suspendido', color: '#d97706', permiteDescuentos: false, orden: 2 },
    { codigo: 'BAJA',       nombre: 'Baja',       color: '#dc2626', permiteDescuentos: false, orden: 3 },
    { codigo: 'MOROSO',     nombre: 'Moroso',     color: '#9333ea', permiteDescuentos: false, orden: 4 },
  ])

  // ── 8. Vincular conceptos a tipos de socio (si ambos se acaban de crear) ──
  if (conceptosCreados) {
    const cobCuo  = await prisma.conceptoTesoreria.findFirst({ where: { tenantId, codigo: 'COB-CUO' } })
    const ingMora = await prisma.conceptoTesoreria.findFirst({ where: { tenantId, codigo: 'ING-MORA' } })
    if (cobCuo && ingMora) {
      await prisma.tipoSocio.updateMany({
        where: { tenantId, conceptoTesoreriaId: null },
        data: { conceptoTesoreriaId: cobCuo.id, conceptoMoraId: ingMora.id }
      })
      resultado.vinculacionConceptos = { done: true }
    }
  }

  // ── 9. Config: concepto cobranza por defecto ─────────────────────────────
  const cobCuoFinal = await prisma.conceptoTesoreria.findFirst({ where: { tenantId, codigo: 'COB-CUO' } })
  const ingMoraFinal = await prisma.conceptoTesoreria.findFirst({ where: { tenantId, codigo: 'ING-MORA' } })
  if (cobCuoFinal) {
    await prisma.tenantConfiguracion.upsert({
      where: { tenantId_clave: { tenantId, clave: 'CONCEPTO_COBRANZA_CUOTAS' } },
      create: { tenantId, clave: 'CONCEPTO_COBRANZA_CUOTAS', valor: String(cobCuoFinal.id), tipo: 'STRING' },
      update: {}
    })
  }
  if (ingMoraFinal) {
    await prisma.tenantConfiguracion.upsert({
      where: { tenantId_clave: { tenantId, clave: 'CONCEPTO_MORA' } },
      create: { tenantId, clave: 'CONCEPTO_MORA', valor: String(ingMoraFinal.id), tipo: 'STRING' },
      update: {}
    })
  }

  res.json({ success: true, tenant: tenant.nombre, resultado })
})

/**
 * GET /api/super-admin/tenants/:id/configuracion/:clave
 * Lee una clave de configuración de un tenant específico (tabla Configuracion)
 */
router.get('/:id/configuracion/:clave', async (req, res) => {
  try {
    const { id, clave } = req.params
    const config = await prisma.configuracion.findFirst({
      where: { tenantId: parseInt(id), clave }
    })
    res.json({ success: true, valor: config?.valor ?? null })
  } catch (error) {
    console.error('Error leyendo configuracion tenant:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/super-admin/tenants/:id/configuracion
 * Upsert de una clave de configuración para un tenant específico
 */
router.post('/:id/configuracion', async (req, res) => {
  try {
    const { id } = req.params
    const { clave, valor, tipo, modulo, descripcion } = req.body

    if (!clave || valor === undefined) {
      return res.status(400).json({ error: 'clave y valor son requeridos' })
    }

    const config = await prisma.configuracion.upsert({
      where: { tenantId_clave: { tenantId: parseInt(id), clave } },
      create: { tenantId: parseInt(id), clave, valor, tipo: tipo || 'STRING', modulo: modulo || 'GENERAL', descripcion },
      update: { valor, tipo: tipo || 'STRING', modulo: modulo || 'GENERAL', descripcion }
    })

    res.json({ success: true, config })
  } catch (error) {
    console.error('Error guardando configuracion tenant:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
