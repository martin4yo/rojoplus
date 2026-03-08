import express from 'express'
import prisma from '../lib/prisma.js'
import { authAdmin, checkPermiso } from '../middleware/auth.js'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// Configurar directorio de uploads
const uploadDir = path.join(__dirname, '../../uploads/noticias-deportivas')
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
    cb(null, 'noticia-deportiva-' + uniqueSuffix + ext)
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

// Todas las rutas requieren autenticación de admin
router.use(authAdmin)

/**
 * GET /api/admin/noticias-deportivas
 * Listar noticias deportivas con filtros
 */
router.get('/', checkPermiso('NOTICIAS_DEPORTIVAS_VER'), asyncHandler(async (req, res) => {
  const { actividadId, categoriaId, tipo, destacada, activo, search, limit = 50, offset = 0 } = req.query

  const where = {}

  if (actividadId) {
    where.actividadId = parseInt(actividadId)
  }

  if (categoriaId) {
    where.categoriaId = parseInt(categoriaId)
  }

  if (tipo) {
    where.tipo = tipo
  }

  if (destacada !== undefined) {
    where.destacada = destacada === 'true'
  }

  if (activo !== undefined) {
    where.activo = activo === 'true'
  }

  if (search) {
    where.OR = [
      { titulo: { contains: search, mode: 'insensitive' } },
      { copete: { contains: search, mode: 'insensitive' } },
      { contenido: { contains: search, mode: 'insensitive' } }
    ]
  }

  const [noticias, total] = await Promise.all([
    prisma.noticiaDeportiva.findMany({
      where,
      include: {
        actividad: {
          select: {
            id: true,
            nombre: true,
            codigo: true
          }
        },
        categoria: {
          select: {
            id: true,
            nombre: true,
            codigo: true
          }
        }
      },
      orderBy: [
        { destacada: 'desc' },
        { fechaPublicacion: 'desc' }
      ],
      take: parseInt(limit),
      skip: parseInt(offset)
    }),
    prisma.noticiaDeportiva.count({ where })
  ])

  res.json({
    success: true,
    data: noticias,
    pagination: {
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: total > parseInt(offset) + parseInt(limit)
    }
  })
}))

/**
 * GET /api/admin/noticias-deportivas/:id
 * Obtener detalle de una noticia
 */
router.get('/:id', checkPermiso('NOTICIAS_DEPORTIVAS_VER'), asyncHandler(async (req, res) => {
  const { id } = req.params

  const noticia = await prisma.noticiaDeportiva.findUnique({
    where: { id: parseInt(id) },
    include: {
      actividad: {
        select: {
          id: true,
          nombre: true,
          codigo: true
        }
      },
      categoria: {
        select: {
          id: true,
          nombre: true,
          codigo: true
        }
      }
    }
  })

  if (!noticia) {
    throw new AppError('Noticia no encontrada', 404)
  }

  res.json({
    success: true,
    data: noticia
  })
}))

/**
 * POST /api/admin/noticias-deportivas
 * Crear noticia deportiva
 */
router.post('/', checkPermiso('NOTICIAS_DEPORTIVAS_CREAR'), asyncHandler(async (req, res) => {
  const {
    actividadId,
    categoriaId,
    titulo,
    copete,
    contenido,
    imagen,
    autor,
    destacada,
    tipo
  } = req.body

  // Validaciones
  if (!titulo || !contenido) {
    throw new AppError('Título y contenido son requeridos', 400)
  }

  // Validar tipo
  const tiposValidos = ['NOTICIA', 'COMUNICADO', 'RESULTADO']
  if (tipo && !tiposValidos.includes(tipo)) {
    throw new AppError(`Tipo inválido. Debe ser uno de: ${tiposValidos.join(', ')}`, 400)
  }

  // Validar que existe la actividad (si se especifica)
  if (actividadId) {
    const actividad = await prisma.actividad.findUnique({
      where: { id: parseInt(actividadId) }
    })
    if (!actividad) {
      throw new AppError('Actividad no encontrada', 404)
    }
  }

  // Validar que existe la categoría (si se especifica)
  if (categoriaId) {
    const categoria = await prisma.categoriaActividad.findUnique({
      where: { id: parseInt(categoriaId) }
    })
    if (!categoria) {
      throw new AppError('Categoría no encontrada', 404)
    }
  }

  const noticia = await prisma.noticiaDeportiva.create({
    data: {
      actividadId: actividadId ? parseInt(actividadId) : null,
      categoriaId: categoriaId ? parseInt(categoriaId) : null,
      titulo,
      copete: copete || null,
      contenido,
      imagen: imagen || null,
      autor: autor || null,
      destacada: destacada || false,
      tipo: tipo || 'NOTICIA'
    },
    include: {
      actividad: {
        select: { id: true, nombre: true }
      },
      categoria: {
        select: { id: true, nombre: true }
      }
    }
  })

  res.status(201).json({
    success: true,
    message: 'Noticia deportiva creada correctamente',
    data: noticia
  })
}))

/**
 * PUT /api/admin/noticias-deportivas/:id
 * Actualizar noticia deportiva
 */
router.put('/:id', checkPermiso('NOTICIAS_DEPORTIVAS_EDITAR'), asyncHandler(async (req, res) => {
  const { id } = req.params
  const {
    actividadId,
    categoriaId,
    titulo,
    copete,
    contenido,
    imagen,
    autor,
    destacada,
    tipo,
    activo
  } = req.body

  const existente = await prisma.noticiaDeportiva.findUnique({
    where: { id: parseInt(id) }
  })

  if (!existente) {
    throw new AppError('Noticia no encontrada', 404)
  }

  // Validar tipo si se proporciona
  if (tipo) {
    const tiposValidos = ['NOTICIA', 'COMUNICADO', 'RESULTADO']
    if (!tiposValidos.includes(tipo)) {
      throw new AppError(`Tipo inválido. Debe ser uno de: ${tiposValidos.join(', ')}`, 400)
    }
  }

  const noticia = await prisma.noticiaDeportiva.update({
    where: { id: parseInt(id) },
    data: {
      actividadId: actividadId !== undefined ? (actividadId ? parseInt(actividadId) : null) : undefined,
      categoriaId: categoriaId !== undefined ? (categoriaId ? parseInt(categoriaId) : null) : undefined,
      titulo: titulo || existente.titulo,
      copete: copete !== undefined ? copete : existente.copete,
      contenido: contenido || existente.contenido,
      imagen: imagen !== undefined ? imagen : existente.imagen,
      autor: autor !== undefined ? autor : existente.autor,
      destacada: destacada !== undefined ? destacada : existente.destacada,
      tipo: tipo || existente.tipo,
      activo: activo !== undefined ? activo : existente.activo
    },
    include: {
      actividad: {
        select: { id: true, nombre: true }
      },
      categoria: {
        select: { id: true, nombre: true }
      }
    }
  })

  res.json({
    success: true,
    message: 'Noticia deportiva actualizada correctamente',
    data: noticia
  })
}))

/**
 * DELETE /api/admin/noticias-deportivas/:id
 * Eliminar noticia deportiva (soft delete)
 */
router.delete('/:id', checkPermiso('NOTICIAS_DEPORTIVAS_ELIMINAR'), asyncHandler(async (req, res) => {
  const { id } = req.params

  const existente = await prisma.noticiaDeportiva.findUnique({
    where: { id: parseInt(id) }
  })

  if (!existente) {
    throw new AppError('Noticia no encontrada', 404)
  }

  // Soft delete
  await prisma.noticiaDeportiva.update({
    where: { id: parseInt(id) },
    data: { activo: false }
  })

  res.json({
    success: true,
    message: 'Noticia deportiva eliminada correctamente'
  })
}))

/**
 * POST /api/admin/noticias-deportivas/upload
 * Upload de imagen para noticia deportiva
 */
router.post('/upload', checkPermiso('NOTICIAS_DEPORTIVAS_CREAR'), upload.single('imagen'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No se recibió ningún archivo'
    })
  }

  const imagenUrl = `/uploads/noticias-deportivas/${req.file.filename}`

  res.json({
    success: true,
    message: 'Imagen subida correctamente',
    data: {
      filename: req.file.filename,
      url: imagenUrl
    }
  })
})

export default router
