import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { asyncHandler } from '../../middleware/errorHandler.js'
import { authAdmin } from '../../middleware/auth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const router = Router()

// Imágenes del hero subidas por el club. Mismo directorio que usa el panel
// super-admin para logos/hero, servido estáticamente desde /uploads.
const uploadDirTenants = path.join(__dirname, '../../../uploads/tenants')
if (!fs.existsSync(uploadDirTenants)) {
  fs.mkdirSync(uploadDirTenants, { recursive: true })
}

const uploadHero = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDirTenants),
    // El tenantId va en el nombre para que un club no pueda pisar los archivos
    // de otro, y el timestamp para que convivan varias imágenes del carousel.
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg'
      cb(null, `tenant-${req.tenantId}-hero-${Date.now()}${ext}`)
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Solo se permiten imágenes'))
  }
})

/**
 * GET /api/admin/branding
 * Obtener configuración de branding del tenant actual
 */
router.get('/', asyncHandler(async (req, res) => {
  const { tenantId } = req

  const tenant = await req.db.tenant.findUnique({
    where: { id: tenantId },
    select: {
      logoUrl: true,
      faviconUrl: true,
      colores: true,
      nombre: true,
      slogan: true
    }
  })

  if (!tenant) {
    return res.status(404).json({ error: 'Tenant no encontrado' })
  }

  res.json({ data: tenant })
}))

/**
 * PUT /api/admin/branding/colores
 * Actualizar la paleta de colores del tenant
 * Body: { colores: { primario: '#...', ... } }
 */
router.put('/colores', asyncHandler(async (req, res) => {
  const { tenantId } = req
  const { colores } = req.body

  // Validar que sea un objeto
  if (!colores || typeof colores !== 'object') {
    return res.status(400).json({ error: 'colores debe ser un objeto' })
  }

  // Validar colores en formato hex
  const colorRegex = /^#[0-9A-F]{6}$/i
  for (const [key, value] of Object.entries(colores)) {
    if (!colorRegex.test(value)) {
      return res.status(400).json({
        error: `Color inválido para ${key}: ${value}`
      })
    }
  }

  const tenant = await req.db.tenant.update({
    where: { id: tenantId },
    data: { colores }
  })

  res.json({
    success: true,
    colores: tenant.colores
  })
}))

/**
 * PUT /api/admin/branding/logo
 * Actualizar URL del logo
 * Body: { logoUrl: 'https://...' }
 */
router.put('/logo', asyncHandler(async (req, res) => {
  const { tenantId } = req
  const { logoUrl } = req.body

  if (!logoUrl || typeof logoUrl !== 'string') {
    return res.status(400).json({ error: 'logoUrl es requerido y debe ser string' })
  }

  // Validar que sea una URL válida
  try {
    new URL(logoUrl)
  } catch (e) {
    return res.status(400).json({ error: 'logoUrl no es una URL válida' })
  }

  const tenant = await req.db.tenant.update({
    where: { id: tenantId },
    data: { logoUrl }
  })

  res.json({
    success: true,
    logoUrl: tenant.logoUrl
  })
}))

/**
 * PUT /api/admin/branding/favicon
 * Actualizar URL del favicon
 * Body: { faviconUrl: 'https://...' }
 */
router.put('/favicon', asyncHandler(async (req, res) => {
  const { tenantId } = req
  const { faviconUrl } = req.body

  if (!faviconUrl || typeof faviconUrl !== 'string') {
    return res.status(400).json({ error: 'faviconUrl es requerido y debe ser string' })
  }

  try {
    new URL(faviconUrl)
  } catch (e) {
    return res.status(400).json({ error: 'faviconUrl no es una URL válida' })
  }

  const tenant = await req.db.tenant.update({
    where: { id: tenantId },
    data: { faviconUrl }
  })

  res.json({
    success: true,
    faviconUrl: tenant.faviconUrl
  })
}))

/**
 * GET /api/admin/branding/hero-images
 * Obtener lista de imágenes del carousel hero
 */
router.get('/hero-images', asyncHandler(async (req, res) => {
  const { tenantId } = req
  const config = await req.db.tenantConfiguracion.findUnique({
    where: { tenantId_clave: { tenantId, clave: 'HERO_IMAGES' } }
  })
  let images = []
  if (config?.valor) {
    try { images = JSON.parse(config.valor) } catch {}
  }
  res.json({ data: images })
}))

/**
 * PUT /api/admin/branding/hero-images
 * Guardar lista de imágenes del carousel hero
 * Body: { images: ['url1', 'url2', ...] }
 */
router.put('/hero-images', asyncHandler(async (req, res) => {
  const { tenantId } = req
  const { images } = req.body
  if (!Array.isArray(images)) {
    return res.status(400).json({ error: 'images debe ser un array' })
  }
  const valor = JSON.stringify(images.filter(Boolean))
  await req.db.tenantConfiguracion.upsert({
    where: { tenantId_clave: { tenantId, clave: 'HERO_IMAGES' } },
    create: { tenantId, clave: 'HERO_IMAGES', valor, tipo: 'JSON', descripcion: 'Imágenes del carousel hero' },
    update: { valor }
  })
  res.json({ success: true, images })
}))

/**
 * POST /api/admin/branding/hero-upload
 * Subir una imagen para el carousel del hero.
 * Devuelve la URL; agregarla al carousel es un PUT /hero-images aparte, así
 * el guardado del listado sigue teniendo un único camino.
 * Body: multipart/form-data con el campo `imagen`
 */
router.post(
  '/hero-upload',
  authAdmin,
  (req, res, next) => {
    uploadHero.single('imagen')(req, res, (err) => {
      if (!err) return next()
      const mensaje = err.code === 'LIMIT_FILE_SIZE'
        ? 'La imagen supera el límite de 5 MB'
        : err.message
      res.status(400).json({ error: mensaje })
    })
  },
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' })
    }
    res.json({ success: true, url: `/uploads/tenants/${req.file.filename}` })
  })
)

/**
 * GET /api/admin/branding/fecha-fundacion
 * Obtener la fecha de fundación del tenant
 */
router.get('/fecha-fundacion', asyncHandler(async (req, res) => {
  const { tenantId } = req
  const config = await req.db.tenantConfiguracion.findUnique({
    where: { tenantId_clave: { tenantId, clave: 'FECHA_FUNDACION' } }
  })
  res.json({ data: config?.valor || null })
}))

/**
 * PUT /api/admin/branding/fecha-fundacion
 * Guardar la fecha de fundación del tenant
 * Body: { fecha: 'YYYY-MM-DD' }
 */
router.put('/fecha-fundacion', asyncHandler(async (req, res) => {
  const { tenantId } = req
  const { fecha } = req.body
  if (!fecha || isNaN(new Date(fecha).getTime())) {
    return res.status(400).json({ error: 'fecha inválida' })
  }
  const valor = new Date(fecha).toISOString().split('T')[0]
  await req.db.tenantConfiguracion.upsert({
    where: { tenantId_clave: { tenantId, clave: 'FECHA_FUNDACION' } },
    create: { tenantId, clave: 'FECHA_FUNDACION', valor, tipo: 'STRING', descripcion: 'Fecha de fundación del club' },
    update: { valor }
  })
  res.json({ success: true, fecha: valor })
}))

/**
 * DELETE /api/admin/branding/logo
 * Eliminar logo (volver a por defecto)
 */
router.delete('/logo', asyncHandler(async (req, res) => {
  const { tenantId } = req

  await req.db.tenant.update({
    where: { id: tenantId },
    data: { logoUrl: null }
  })

  res.json({ success: true })
}))

/**
 * GET /api/admin/branding/default-colors
 * Obtener paleta de colores por defecto
 */
router.get('/default-colors', (req, res) => {
  const defaultColors = {
    primario: '#DC2626',
    primarioOscuro: '#991B1B',
    primarioClaro: '#FCA5A5',
    secundario: '#7C3AED',
    secundarioOscuro: '#5B21B6',
    secundarioClaro: '#C4B5FD',
    acento: '#22D3EE',
    exito: '#10B981',
    advertencia: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
    fondoPrincipal: '#FFFFFF',
    fondoSecundario: '#F9FAFB',
    textoPrincipal: '#111827',
    textoSecundario: '#6B7280',
    borde: '#E5E7EB'
  }

  res.json(defaultColors)
})

export default router
