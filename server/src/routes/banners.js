/**
 * Rutas de Banners y Sponsors
 * - CRUD de sponsors (auspiciantes)
 * - CRUD de banners publicitarios
 * - Métricas de impresiones y clics
 */

import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { authAdmin } from '../middleware/auth.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// Configurar multer para upload de imágenes de banners
const uploadDirBanners = path.join(__dirname, '../../uploads/banners')
if (!fs.existsSync(uploadDirBanners)) {
  fs.mkdirSync(uploadDirBanners, { recursive: true })
}

// Configurar multer para upload de logos de sponsors
const uploadDirSponsors = path.join(__dirname, '../../uploads/sponsors')
if (!fs.existsSync(uploadDirSponsors)) {
  fs.mkdirSync(uploadDirSponsors, { recursive: true })
}

const storageBanners = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirBanners)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = path.extname(file.originalname)
    cb(null, 'banner-' + uniqueSuffix + ext)
  }
})

const storageSponsors = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirSponsors)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = path.extname(file.originalname)
    cb(null, 'sponsor-' + uniqueSuffix + ext)
  }
})

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
  const mimetype = allowedTypes.test(file.mimetype)
  if (extname && mimetype) {
    return cb(null, true)
  }
  cb(new Error('Solo se permiten imágenes (jpg, png, gif, webp)'))
}

const uploadBanner = multer({
  storage: storageBanners,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB máximo
  fileFilter
})

const uploadSponsor = multer({
  storage: storageSponsors,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB máximo para logos
  fileFilter
})

// =============================================================================
// RUTAS PÚBLICAS (sin autenticación)
// =============================================================================

/**
 * GET /api/public/banners
 * Obtener banners activos para mostrar en el sitio público
 */
router.get('/public/banners', asyncHandler(async (req, res) => {
  const { ubicacion, tipo } = req.query
  const now = new Date()

  // Filtro de fechas: banner vigente o sin fechas definidas
  const fechaFilter = {
    OR: [
      { fechaInicio: null, fechaFin: null },
      { fechaInicio: { lte: now }, fechaFin: null },
      { fechaInicio: null, fechaFin: { gte: now } },
      { fechaInicio: { lte: now }, fechaFin: { gte: now } }
    ]
  }

  // Construir where con AND para combinar filtros correctamente
  const where = {
    activo: true,
    AND: [fechaFilter]
  }

  // Filtro de ubicación: si tiene la ubicación en el array o el array está vacío (= todas)
  if (ubicacion) {
    where.AND.push({
      OR: [
        { ubicaciones: { has: ubicacion } },
        { ubicaciones: { isEmpty: true } }
      ]
    })
  }

  if (tipo) {
    where.tipo = tipo
  }

  const banners = await req.prisma.banner.findMany({
    where,
    include: {
      sponsor: {
        select: {
          id: true,
          nombre: true,
          logo: true,
          sitioWeb: true
        }
      }
    },
    orderBy: { orden: 'asc' }
  })

  res.json({ success: true, data: banners })
}))

/**
 * POST /api/public/banners/:id/impresion
 * Registrar impresión de un banner (se llama cuando se muestra)
 */
router.post('/public/banners/:id/impresion', asyncHandler(async (req, res) => {
  const { id } = req.params

  await req.prisma.banner.update({
    where: { id: parseInt(id) },
    data: { impresiones: { increment: 1 } }
  })

  res.json({ success: true })
}))

/**
 * POST /api/public/banners/:id/clic
 * Registrar clic en un banner
 */
router.post('/public/banners/:id/clic', asyncHandler(async (req, res) => {
  const { id } = req.params

  const banner = await req.prisma.banner.update({
    where: { id: parseInt(id) },
    data: { clics: { increment: 1 } },
    select: { linkDestino: true }
  })

  res.json({ success: true, linkDestino: banner.linkDestino })
}))

/**
 * GET /api/public/sponsors
 * Obtener sponsors activos para mostrar en el sitio
 */
router.get('/public/sponsors', asyncHandler(async (req, res) => {
  const sponsors = await req.prisma.sponsor.findMany({
    where: { activo: true },
    select: {
      id: true,
      nombre: true,
      logo: true,
      sitioWeb: true
    },
    orderBy: { nombre: 'asc' }
  })

  res.json({ success: true, data: sponsors })
}))

// =============================================================================
// RUTAS ADMIN - SPONSORS
// =============================================================================

/**
 * GET /api/admin/sponsors
 * Listar todos los sponsors
 */
router.get('/admin/sponsors', authAdmin, asyncHandler(async (req, res) => {
  const { activo, search } = req.query

  const where = {}

  if (activo !== undefined) {
    where.activo = activo === 'true'
  }

  if (search) {
    where.OR = [
      { nombre: { contains: search, mode: 'insensitive' } },
      { razonSocial: { contains: search, mode: 'insensitive' } },
      { contactoNombre: { contains: search, mode: 'insensitive' } }
    ]
  }

  const sponsors = await req.prisma.sponsor.findMany({
    where,
    include: {
      _count: {
        select: { banners: true }
      }
    },
    orderBy: { nombre: 'asc' }
  })

  res.json({ success: true, data: sponsors })
}))

/**
 * GET /api/admin/sponsors/:id
 * Obtener detalle de un sponsor
 */
router.get('/admin/sponsors/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const sponsor = await req.prisma.sponsor.findUnique({
    where: { id: parseInt(id) },
    include: {
      banners: {
        orderBy: { createdAt: 'desc' }
      }
    }
  })

  if (!sponsor) {
    throw new AppError('Sponsor no encontrado', 404)
  }

  res.json({ success: true, data: sponsor })
}))

/**
 * POST /api/admin/sponsors
 * Crear un nuevo sponsor
 */
router.post('/admin/sponsors', authAdmin, asyncHandler(async (req, res) => {
  const {
    nombre,
    razonSocial,
    cuit,
    contactoNombre,
    contactoEmail,
    contactoTelefono,
    direccion,
    logo,
    sitioWeb,
    observaciones
  } = req.body

  if (!nombre) {
    throw new AppError('El nombre es obligatorio', 400)
  }

  const sponsor = await req.prisma.sponsor.create({
    data: {
      nombre,
      razonSocial,
      cuit,
      contactoNombre,
      contactoEmail,
      contactoTelefono,
      direccion,
      logo,
      sitioWeb,
      observaciones
    }
  })

  res.status(201).json({ success: true, data: sponsor })
}))

/**
 * PUT /api/admin/sponsors/:id
 * Actualizar un sponsor
 */
router.put('/admin/sponsors/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const {
    nombre,
    razonSocial,
    cuit,
    contactoNombre,
    contactoEmail,
    contactoTelefono,
    direccion,
    logo,
    sitioWeb,
    observaciones,
    activo
  } = req.body

  const sponsor = await req.prisma.sponsor.update({
    where: { id: parseInt(id) },
    data: {
      nombre,
      razonSocial,
      cuit,
      contactoNombre,
      contactoEmail,
      contactoTelefono,
      direccion,
      logo,
      sitioWeb,
      observaciones,
      activo
    }
  })

  res.json({ success: true, data: sponsor })
}))

/**
 * DELETE /api/admin/sponsors/:id
 * Eliminar un sponsor (solo si no tiene banners)
 */
router.delete('/admin/sponsors/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  // Verificar si tiene banners
  const bannersCount = await req.prisma.banner.count({
    where: { sponsorId: parseInt(id) }
  })

  if (bannersCount > 0) {
    throw new AppError(`No se puede eliminar: tiene ${bannersCount} banners asociados`, 400)
  }

  await req.prisma.sponsor.delete({
    where: { id: parseInt(id) }
  })

  res.json({ success: true, message: 'Sponsor eliminado' })
}))

// =============================================================================
// RUTAS ADMIN - BANNERS
// =============================================================================

/**
 * POST /api/admin/banners/upload
 * Subir imagen para banner
 */
router.post('/admin/banners/upload', authAdmin, uploadBanner.single('imagen'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ninguna imagen' })
  }

  // Retornar la URL relativa de la imagen
  const imageUrl = `/uploads/banners/${req.file.filename}`
  res.json({
    success: true,
    url: imageUrl,
    filename: req.file.filename
  })
})

/**
 * POST /api/admin/sponsors/upload
 * Subir logo para sponsor
 */
router.post('/admin/sponsors/upload', authAdmin, uploadSponsor.single('imagen'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ninguna imagen' })
  }

  // Retornar la URL relativa del logo
  const imageUrl = `/uploads/sponsors/${req.file.filename}`
  res.json({
    success: true,
    url: imageUrl,
    filename: req.file.filename
  })
})

/**
 * GET /api/admin/banners
 * Listar todos los banners
 */
router.get('/admin/banners', authAdmin, asyncHandler(async (req, res) => {
  const { activo, tipo, sponsorId } = req.query

  const where = {}

  if (activo !== undefined) {
    where.activo = activo === 'true'
  }

  if (tipo) {
    where.tipo = tipo
  }

  if (sponsorId) {
    where.sponsorId = parseInt(sponsorId)
  }

  const banners = await req.prisma.banner.findMany({
    where,
    include: {
      sponsor: {
        select: {
          id: true,
          nombre: true
        }
      }
    },
    orderBy: [{ tipo: 'asc' }, { orden: 'asc' }]
  })

  res.json({ success: true, data: banners })
}))

/**
 * GET /api/admin/banners/estadisticas
 * Estadísticas generales de banners
 * IMPORTANTE: Esta ruta debe estar ANTES de /admin/banners/:id
 */
router.get('/admin/banners/estadisticas', authAdmin, asyncHandler(async (req, res) => {
  const now = new Date()

  // Total de banners activos
  const totalActivos = await req.prisma.banner.count({
    where: { activo: true }
  })

  // Banners por vencer (próximos 7 días)
  const porVencer = await req.prisma.banner.count({
    where: {
      activo: true,
      fechaFin: {
        gte: now,
        lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      }
    }
  })

  // Métricas agregadas
  const metricas = await req.prisma.banner.aggregate({
    _sum: {
      impresiones: true,
      clics: true
    },
    where: { activo: true }
  })

  // Top 5 banners por clics
  const topBanners = await req.prisma.banner.findMany({
    where: { activo: true },
    orderBy: { clics: 'desc' },
    take: 5,
    select: {
      id: true,
      titulo: true,
      impresiones: true,
      clics: true,
      sponsor: {
        select: { nombre: true }
      }
    }
  })

  // Ingresos del mes actual
  const mesActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const ingresosMes = await req.prisma.banner.aggregate({
    _sum: {
      montoMensual: true
    },
    where: {
      mesContratado: mesActual,
      pagado: true
    }
  })

  res.json({
    success: true,
    data: {
      totalActivos,
      porVencer,
      totalImpresiones: metricas._sum.impresiones || 0,
      totalClics: metricas._sum.clics || 0,
      ctr: metricas._sum.impresiones > 0
        ? ((metricas._sum.clics || 0) / metricas._sum.impresiones * 100).toFixed(2)
        : '0.00',
      topBanners,
      ingresosMes: ingresosMes._sum.montoMensual || 0
    }
  })
}))

/**
 * GET /api/admin/banners/:id
 * Obtener detalle de un banner
 */
router.get('/admin/banners/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const banner = await req.prisma.banner.findUnique({
    where: { id: parseInt(id) },
    include: {
      sponsor: true
    }
  })

  if (!banner) {
    throw new AppError('Banner no encontrado', 404)
  }

  res.json({ success: true, data: banner })
}))

/**
 * POST /api/admin/banners
 * Crear un nuevo banner
 */
router.post('/admin/banners', authAdmin, asyncHandler(async (req, res) => {
  const {
    titulo,
    sponsorId,
    tipo,
    ubicaciones,
    imagenDesktop,
    imagenMobile,
    linkDestino,
    textoAlt,
    orden,
    fechaInicio,
    fechaFin,
    montoMensual,
    mesContratado,
    pagado
  } = req.body

  if (!titulo || !imagenDesktop) {
    throw new AppError('Título e imagen desktop son obligatorios', 400)
  }

  // Helper para convertir strings vacíos a null
  const emptyToNull = (val) => (val === '' || val === undefined) ? null : val

  const banner = await req.prisma.banner.create({
    data: {
      titulo,
      sponsorId: sponsorId ? parseInt(sponsorId) : null,
      tipo: tipo || 'LATERAL_DERECHO',
      ubicaciones: Array.isArray(ubicaciones) ? ubicaciones : [],
      imagenDesktop,
      imagenMobile: emptyToNull(imagenMobile),
      linkDestino: emptyToNull(linkDestino),
      textoAlt: emptyToNull(textoAlt),
      orden: orden || 0,
      fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
      fechaFin: fechaFin ? new Date(fechaFin) : null,
      montoMensual: montoMensual ? parseFloat(montoMensual) : null,
      mesContratado: emptyToNull(mesContratado),
      pagado: pagado || false
    },
    include: {
      sponsor: {
        select: { id: true, nombre: true }
      }
    }
  })

  res.status(201).json({ success: true, data: banner })
}))

/**
 * PUT /api/admin/banners/:id
 * Actualizar un banner
 */
router.put('/admin/banners/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const {
    titulo,
    sponsorId,
    tipo,
    ubicaciones,
    imagenDesktop,
    imagenMobile,
    linkDestino,
    textoAlt,
    orden,
    activo,
    fechaInicio,
    fechaFin,
    montoMensual,
    mesContratado,
    pagado
  } = req.body

  // Helper para convertir strings vacíos a null
  const emptyToNull = (val) => (val === '' || val === undefined) ? null : val

  const banner = await req.prisma.banner.update({
    where: { id: parseInt(id) },
    data: {
      titulo,
      sponsorId: sponsorId ? parseInt(sponsorId) : null,
      tipo,
      ubicaciones: Array.isArray(ubicaciones) ? ubicaciones : [],
      imagenDesktop,
      imagenMobile: emptyToNull(imagenMobile),
      linkDestino: emptyToNull(linkDestino),
      textoAlt: emptyToNull(textoAlt),
      orden,
      activo,
      fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
      fechaFin: fechaFin ? new Date(fechaFin) : null,
      montoMensual: montoMensual ? parseFloat(montoMensual) : null,
      mesContratado: emptyToNull(mesContratado),
      pagado
    },
    include: {
      sponsor: {
        select: { id: true, nombre: true }
      }
    }
  })

  res.json({ success: true, data: banner })
}))

/**
 * DELETE /api/admin/banners/:id
 * Eliminar un banner
 */
router.delete('/admin/banners/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  await req.prisma.banner.delete({
    where: { id: parseInt(id) }
  })

  res.json({ success: true, message: 'Banner eliminado' })
}))

export default router
