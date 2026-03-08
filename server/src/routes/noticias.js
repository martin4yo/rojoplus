import express from 'express'
import prisma from '../lib/prisma.js'
import { authAdmin } from '../middleware/auth.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// Configurar directorio de uploads para noticias
const uploadDir = path.join(__dirname, '../../uploads/noticias')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

// Configurar multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = path.extname(file.originalname)
    cb(null, 'noticia-' + uniqueSuffix + ext)
  }
})

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Formato de imagen no permitido'), false)
  }
}

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB máximo
  fileFilter
})

// =============================================================================
// ENDPOINTS PÚBLICOS
// =============================================================================

/**
 * GET /api/public/noticias
 * Lista noticias publicadas (para el sitio público)
 */
router.get('/public/noticias', async (req, res) => {
  try {
    const { categoria, destacada, limit = 20, offset = 0 } = req.query

    const where = {
      publicada: true,
      fechaPublicacion: { lte: new Date() }
    }

    if (categoria) {
      where.categoria = categoria
    }

    if (destacada === 'true') {
      where.destacada = true
    }

    const [noticias, total] = await Promise.all([
      prisma.noticia.findMany({
        where,
        select: {
          id: true,
          titulo: true,
          slug: true,
          extracto: true,
          imagen: true,
          categoria: true,
          destacada: true,
          fechaPublicacion: true,
          autor: {
            select: { nombre: true, apellido: true }
          }
        },
        orderBy: { fechaPublicacion: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      prisma.noticia.count({ where })
    ])

    res.json({
      noticias,
      total,
      pages: Math.ceil(total / parseInt(limit))
    })
  } catch (error) {
    console.error('Error listando noticias públicas:', error)
    res.status(500).json({ error: 'Error al cargar noticias' })
  }
})

/**
 * GET /api/public/noticias/:slug
 * Detalle de una noticia por slug
 */
router.get('/public/noticias/:slug', async (req, res) => {
  try {
    const { slug } = req.params

    const noticia = await prisma.noticia.findFirst({
      where: {
        slug,
        publicada: true,
        fechaPublicacion: { lte: new Date() }
      },
      include: {
        autor: {
          select: { nombre: true, apellido: true }
        }
      }
    })

    if (!noticia) {
      return res.status(404).json({ error: 'Noticia no encontrada' })
    }

    // Obtener noticias relacionadas (misma categoría)
    const relacionadas = await prisma.noticia.findMany({
      where: {
        publicada: true,
        fechaPublicacion: { lte: new Date() },
        categoria: noticia.categoria,
        id: { not: noticia.id }
      },
      select: {
        id: true,
        titulo: true,
        slug: true,
        imagen: true,
        fechaPublicacion: true
      },
      orderBy: { fechaPublicacion: 'desc' },
      take: 3
    })

    res.json({ noticia, relacionadas })
  } catch (error) {
    console.error('Error obteniendo noticia:', error)
    res.status(500).json({ error: 'Error al cargar noticia' })
  }
})

// =============================================================================
// ENDPOINTS ADMIN (requieren autenticación)
// =============================================================================

/**
 * GET /api/admin/noticias
 * Lista todas las noticias (incluye borradores)
 */
router.get('/admin/noticias', authAdmin, async (req, res) => {
  try {
    const { categoria, publicada, busqueda, limit = 50, offset = 0 } = req.query

    const where = {}

    if (categoria) {
      where.categoria = categoria
    }

    if (publicada !== undefined) {
      where.publicada = publicada === 'true'
    }

    if (busqueda) {
      where.OR = [
        { titulo: { contains: busqueda, mode: 'insensitive' } },
        { extracto: { contains: busqueda, mode: 'insensitive' } }
      ]
    }

    const [noticias, total] = await Promise.all([
      prisma.noticia.findMany({
        where,
        include: {
          autor: {
            select: { id: true, nombre: true, apellido: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      prisma.noticia.count({ where })
    ])

    res.json({
      noticias,
      total,
      pages: Math.ceil(total / parseInt(limit))
    })
  } catch (error) {
    console.error('Error listando noticias admin:', error)
    res.status(500).json({ error: 'Error al cargar noticias' })
  }
})

/**
 * GET /api/admin/noticias/:id
 * Detalle de una noticia por ID (admin)
 */
router.get('/admin/noticias/:id', authAdmin, async (req, res) => {
  try {
    const { id } = req.params

    const noticia = await prisma.noticia.findUnique({
      where: { id: parseInt(id) },
      include: {
        autor: {
          select: { id: true, nombre: true, apellido: true }
        }
      }
    })

    if (!noticia) {
      return res.status(404).json({ error: 'Noticia no encontrada' })
    }

    res.json(noticia)
  } catch (error) {
    console.error('Error obteniendo noticia:', error)
    res.status(500).json({ error: 'Error al cargar noticia' })
  }
})

/**
 * POST /api/admin/noticias
 * Crear nueva noticia
 */
router.post('/admin/noticias', authAdmin, async (req, res) => {
  try {
    const {
      titulo,
      extracto,
      contenido,
      imagen,
      categoria,
      destacada,
      publicada,
      fechaPublicacion
    } = req.body

    if (!titulo || !contenido) {
      return res.status(400).json({ error: 'Título y contenido son requeridos' })
    }

    // Generar slug único
    let slug = generarSlug(titulo)
    const existeSlug = await prisma.noticia.findUnique({ where: { slug } })
    if (existeSlug) {
      slug = `${slug}-${Date.now()}`
    }

    const noticia = await prisma.noticia.create({
      data: {
        titulo,
        slug,
        extracto: extracto || null,
        contenido,
        imagen: imagen || null,
        categoria: categoria || 'INSTITUCIONAL',
        destacada: destacada || false,
        publicada: publicada || false,
        fechaPublicacion: publicada ? (fechaPublicacion ? new Date(fechaPublicacion) : new Date()) : null,
        autorId: req.admin.id
      },
      include: {
        autor: {
          select: { id: true, nombre: true, apellido: true }
        }
      }
    })

    res.status(201).json(noticia)
  } catch (error) {
    console.error('Error creando noticia:', error)
    res.status(500).json({ error: 'Error al crear noticia' })
  }
})

/**
 * PUT /api/admin/noticias/:id
 * Actualizar noticia
 */
router.put('/admin/noticias/:id', authAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const {
      titulo,
      extracto,
      contenido,
      imagen,
      categoria,
      destacada,
      publicada,
      fechaPublicacion
    } = req.body

    const noticiaExistente = await prisma.noticia.findUnique({
      where: { id: parseInt(id) }
    })

    if (!noticiaExistente) {
      return res.status(404).json({ error: 'Noticia no encontrada' })
    }

    // Si cambió el título, regenerar slug
    let slug = noticiaExistente.slug
    if (titulo && titulo !== noticiaExistente.titulo) {
      slug = generarSlug(titulo)
      const existeSlug = await prisma.noticia.findFirst({
        where: { slug, id: { not: parseInt(id) } }
      })
      if (existeSlug) {
        slug = `${slug}-${Date.now()}`
      }
    }

    // Si se está publicando por primera vez, establecer fecha
    let fechaPub = noticiaExistente.fechaPublicacion
    if (publicada && !noticiaExistente.publicada) {
      fechaPub = fechaPublicacion ? new Date(fechaPublicacion) : new Date()
    } else if (fechaPublicacion) {
      fechaPub = new Date(fechaPublicacion)
    }

    const noticia = await prisma.noticia.update({
      where: { id: parseInt(id) },
      data: {
        titulo: titulo || noticiaExistente.titulo,
        slug,
        extracto: extracto !== undefined ? extracto : noticiaExistente.extracto,
        contenido: contenido || noticiaExistente.contenido,
        imagen: imagen !== undefined ? imagen : noticiaExistente.imagen,
        categoria: categoria || noticiaExistente.categoria,
        destacada: destacada !== undefined ? destacada : noticiaExistente.destacada,
        publicada: publicada !== undefined ? publicada : noticiaExistente.publicada,
        fechaPublicacion: fechaPub
      },
      include: {
        autor: {
          select: { id: true, nombre: true, apellido: true }
        }
      }
    })

    res.json(noticia)
  } catch (error) {
    console.error('Error actualizando noticia:', error)
    res.status(500).json({ error: 'Error al actualizar noticia' })
  }
})

/**
 * DELETE /api/admin/noticias/:id
 * Eliminar noticia
 */
router.delete('/admin/noticias/:id', authAdmin, async (req, res) => {
  try {
    const { id } = req.params

    const noticia = await prisma.noticia.findUnique({
      where: { id: parseInt(id) }
    })

    if (!noticia) {
      return res.status(404).json({ error: 'Noticia no encontrada' })
    }

    await prisma.noticia.delete({
      where: { id: parseInt(id) }
    })

    res.json({ success: true, message: 'Noticia eliminada' })
  } catch (error) {
    console.error('Error eliminando noticia:', error)
    res.status(500).json({ error: 'Error al eliminar noticia' })
  }
})

/**
 * POST /api/admin/noticias/:id/publicar
 * Publicar o despublicar noticia
 */
router.post('/admin/noticias/:id/publicar', authAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { publicar } = req.body // true para publicar, false para despublicar

    const noticia = await prisma.noticia.findUnique({
      where: { id: parseInt(id) }
    })

    if (!noticia) {
      return res.status(404).json({ error: 'Noticia no encontrada' })
    }

    const updated = await prisma.noticia.update({
      where: { id: parseInt(id) },
      data: {
        publicada: publicar,
        fechaPublicacion: publicar && !noticia.fechaPublicacion ? new Date() : noticia.fechaPublicacion
      },
      include: {
        autor: {
          select: { id: true, nombre: true, apellido: true }
        }
      }
    })

    res.json(updated)
  } catch (error) {
    console.error('Error publicando noticia:', error)
    res.status(500).json({ error: 'Error al cambiar estado de publicación' })
  }
})

/**
 * POST /api/admin/noticias/upload
 * Subir imagen para noticia
 */
router.post('/admin/noticias/upload', authAdmin, upload.single('imagen'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ninguna imagen' })
  }

  // Retornar la URL relativa de la imagen
  const imageUrl = `/uploads/noticias/${req.file.filename}`
  res.json({
    success: true,
    url: imageUrl,
    filename: req.file.filename
  })
})

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Genera un slug URL-friendly a partir de un texto
 */
function generarSlug(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .replace(/[^a-z0-9\s-]/g, '') // Solo alfanuméricos, espacios y guiones
    .replace(/\s+/g, '-') // Espacios a guiones
    .replace(/-+/g, '-') // Múltiples guiones a uno
    .replace(/^-+|-+$/g, '') // Quitar guiones al inicio/fin
    .substring(0, 100) // Limitar longitud
}

export default router
