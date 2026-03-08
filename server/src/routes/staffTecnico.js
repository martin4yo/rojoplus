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

// Configurar directorio de uploads para fotos de staff
const uploadDir = path.join(__dirname, '../../uploads/staff')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

// Configurar multer para fotos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = path.extname(file.originalname)
    cb(null, 'staff-' + uniqueSuffix + ext)
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
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB máximo
  fileFilter
})

// Todas las rutas requieren autenticación de admin
router.use(authAdmin)

/**
 * GET /api/admin/staff-tecnico
 * Listar staff técnico con filtros
 */
router.get('/', checkPermiso('STAFF_TECNICO_VER'), asyncHandler(async (req, res) => {
  const { actividadId, categoriaId, rol, activo, search } = req.query

  const where = {}

  if (actividadId) {
    where.actividadId = parseInt(actividadId)
  }

  if (categoriaId) {
    where.categoriaActividadId = parseInt(categoriaId)
  }

  if (rol) {
    where.rol = rol
  }

  if (activo !== undefined) {
    where.activo = activo === 'true'
  }

  if (search) {
    where.OR = [
      { nombre: { contains: search, mode: 'insensitive' } },
      { apellido: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } }
    ]
  }

  const staff = await prisma.staffTecnico.findMany({
    where,
    include: {
      actividad: {
        select: {
          id: true,
          nombre: true,
          codigo: true
        }
      },
      categoriaActividad: {
        select: {
          id: true,
          nombre: true,
          codigo: true
        }
      }
    },
    orderBy: [
      { activo: 'desc' },
      { orden: 'asc' },
      { apellido: 'asc' }
    ]
  })

  res.json({
    success: true,
    data: staff.map(s => ({
      ...s,
      nombreCompleto: `${s.nombre} ${s.apellido}`
    }))
  })
}))

/**
 * GET /api/admin/staff-tecnico/:id
 * Obtener detalle de un miembro del staff
 */
router.get('/:id', checkPermiso('STAFF_TECNICO_VER'), asyncHandler(async (req, res) => {
  const { id } = req.params

  const staff = await prisma.staffTecnico.findUnique({
    where: { id: parseInt(id) },
    include: {
      actividad: {
        select: {
          id: true,
          nombre: true,
          codigo: true
        }
      },
      categoriaActividad: {
        select: {
          id: true,
          nombre: true,
          codigo: true
        }
      },
      _count: {
        select: {
          mensajes: true
        }
      }
    }
  })

  if (!staff) {
    throw new AppError('Staff no encontrado', 404)
  }

  res.json({
    success: true,
    data: {
      ...staff,
      nombreCompleto: `${staff.nombre} ${staff.apellido}`
    }
  })
}))

/**
 * POST /api/admin/staff-tecnico
 * Crear miembro del staff técnico
 */
router.post('/', checkPermiso('STAFF_TECNICO_CREAR'), asyncHandler(async (req, res) => {
  const {
    actividadId,
    categoriaActividadId,
    nombre,
    apellido,
    rol,
    foto,
    email,
    telefono,
    biografia,
    orden
  } = req.body

  // Validaciones
  if (!nombre || !apellido || !rol) {
    throw new AppError('Nombre, apellido y rol son requeridos', 400)
  }

  // Validar que existe la actividad
  if (actividadId) {
    const actividad = await prisma.actividad.findUnique({
      where: { id: parseInt(actividadId) }
    })
    if (!actividad) {
      throw new AppError('Actividad no encontrada', 404)
    }
  }

  // Validar que existe la categoría (si se especifica)
  if (categoriaActividadId) {
    const categoria = await prisma.categoriaActividad.findUnique({
      where: { id: parseInt(categoriaActividadId) }
    })
    if (!categoria) {
      throw new AppError('Categoría no encontrada', 404)
    }
  }

  // Validar email si se proporciona
  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      throw new AppError('Email inválido', 400)
    }
  }

  // Roles válidos
  const rolesValidos = ['ENTRENADOR', 'AYUDANTE', 'PREPARADOR_FISICO', 'COORDINADOR', 'DIRECTOR_TECNICO']
  if (!rolesValidos.includes(rol)) {
    throw new AppError(`Rol inválido. Debe ser uno de: ${rolesValidos.join(', ')}`, 400)
  }

  const staff = await prisma.staffTecnico.create({
    data: {
      actividadId: actividadId ? parseInt(actividadId) : null,
      categoriaActividadId: categoriaActividadId ? parseInt(categoriaActividadId) : null,
      nombre,
      apellido,
      rol,
      foto: foto || null,
      email: email || null,
      telefono: telefono || null,
      biografia: biografia || null,
      orden: orden || 0
    },
    include: {
      actividad: {
        select: { id: true, nombre: true }
      },
      categoriaActividad: {
        select: { id: true, nombre: true }
      }
    }
  })

  res.status(201).json({
    success: true,
    message: 'Staff técnico creado correctamente',
    data: staff
  })
}))

/**
 * PUT /api/admin/staff-tecnico/:id
 * Actualizar miembro del staff
 */
router.put('/:id', checkPermiso('STAFF_TECNICO_EDITAR'), asyncHandler(async (req, res) => {
  const { id } = req.params
  const {
    actividadId,
    categoriaActividadId,
    nombre,
    apellido,
    rol,
    foto,
    email,
    telefono,
    biografia,
    orden,
    activo
  } = req.body

  const existente = await prisma.staffTecnico.findUnique({
    where: { id: parseInt(id) }
  })

  if (!existente) {
    throw new AppError('Staff no encontrado', 404)
  }

  // Validar email si se proporciona
  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      throw new AppError('Email inválido', 400)
    }
  }

  // Validar rol si se proporciona
  if (rol) {
    const rolesValidos = ['ENTRENADOR', 'AYUDANTE', 'PREPARADOR_FISICO', 'COORDINADOR', 'DIRECTOR_TECNICO']
    if (!rolesValidos.includes(rol)) {
      throw new AppError(`Rol inválido. Debe ser uno de: ${rolesValidos.join(', ')}`, 400)
    }
  }

  const staff = await prisma.staffTecnico.update({
    where: { id: parseInt(id) },
    data: {
      actividadId: actividadId !== undefined ? (actividadId ? parseInt(actividadId) : null) : undefined,
      categoriaActividadId: categoriaActividadId !== undefined ? (categoriaActividadId ? parseInt(categoriaActividadId) : null) : undefined,
      nombre: nombre || existente.nombre,
      apellido: apellido || existente.apellido,
      rol: rol || existente.rol,
      foto: foto !== undefined ? foto : existente.foto,
      email: email !== undefined ? email : existente.email,
      telefono: telefono !== undefined ? telefono : existente.telefono,
      biografia: biografia !== undefined ? biografia : existente.biografia,
      orden: orden !== undefined ? orden : existente.orden,
      activo: activo !== undefined ? activo : existente.activo
    },
    include: {
      actividad: {
        select: { id: true, nombre: true }
      },
      categoriaActividad: {
        select: { id: true, nombre: true }
      }
    }
  })

  res.json({
    success: true,
    message: 'Staff técnico actualizado correctamente',
    data: staff
  })
}))

/**
 * DELETE /api/admin/staff-tecnico/:id
 * Eliminar miembro del staff (soft delete)
 */
router.delete('/:id', checkPermiso('STAFF_TECNICO_ELIMINAR'), asyncHandler(async (req, res) => {
  const { id } = req.params

  const existente = await prisma.staffTecnico.findUnique({
    where: { id: parseInt(id) }
  })

  if (!existente) {
    throw new AppError('Staff no encontrado', 404)
  }

  // Soft delete (marcar como inactivo)
  await prisma.staffTecnico.update({
    where: { id: parseInt(id) },
    data: { activo: false }
  })

  res.json({
    success: true,
    message: 'Staff técnico eliminado correctamente'
  })
}))

/**
 * POST /api/admin/staff-tecnico/upload
 * Upload de foto de staff
 */
router.post('/upload', checkPermiso('STAFF_TECNICO_CREAR'), upload.single('foto'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No se recibió ningún archivo'
    })
  }

  const fotoUrl = `/uploads/staff/${req.file.filename}`

  res.json({
    success: true,
    message: 'Foto subida correctamente',
    data: {
      filename: req.file.filename,
      url: fotoUrl
    }
  })
})

export default router
