import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { fileURLToPath } from 'url'
import { authAdmin } from '../middleware/auth.js'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'

const router = express.Router()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configurar almacenamiento de multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/adjuntos')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    const filename = `${uuidv4()}${ext}`
    cb(null, filename)
  }
})

// Filtrar tipos de archivo permitidos
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ]

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new AppError('Tipo de archivo no permitido. Permitidos: PDF, imágenes, Word, Excel, TXT, CSV', 400), false)
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB máximo
  }
})

// Tipos de comprobante válidos
const TIPOS_COMPROBANTE = {
  movimientoContable: 'movimientoContableId',
  movimientoCaja: 'movimientoCajaId',
  ordenCompra: 'ordenCompraId',
  pedido: 'pedidoId',
  asiento: 'asientoId',
  pago: 'pagoId'
}

/**
 * GET /api/admin/adjuntos/descargar/:adjuntoId
 * Descargar un adjunto
 * IMPORTANTE: Esta ruta debe ir ANTES de /:tipo/:id para evitar conflictos
 */
router.get('/descargar/:adjuntoId', authAdmin, asyncHandler(async (req, res) => {
  const { adjuntoId } = req.params

  const adjunto = await req.prisma.adjuntoComprobante.findUnique({
    where: { id: parseInt(adjuntoId) }
  })

  if (!adjunto) {
    throw new AppError('Adjunto no encontrado', 404)
  }

  const filePath = path.join(__dirname, '../../uploads/adjuntos', adjunto.nombreArchivo)

  if (!fs.existsSync(filePath)) {
    throw new AppError('Archivo no encontrado en el servidor', 404)
  }

  res.download(filePath, adjunto.nombreOriginal)
}))

/**
 * POST /api/admin/adjuntos/:tipo/:id
 * Subir adjunto a un comprobante
 */
router.post('/:tipo/:id', authAdmin, upload.single('archivo'), asyncHandler(async (req, res) => {
  const { tipo, id } = req.params

  if (!TIPOS_COMPROBANTE[tipo]) {
    throw new AppError('Tipo de comprobante inválido', 400)
  }

  if (!req.file) {
    throw new AppError('No se recibió ningún archivo', 400)
  }

  const campoId = TIPOS_COMPROBANTE[tipo]

  // Verificar que el comprobante exista
  const modelos = {
    movimientoContable: 'movimientoContable',
    movimientoCaja: 'movimientoCaja',
    ordenCompra: 'ordenCompra',
    pedido: 'pedido',
    asiento: 'asiento',
    pago: 'pago'
  }
  const modelo = modelos[tipo]

  const comprobante = await req.prisma[modelo].findUnique({
    where: { id: parseInt(id) }
  })

  if (!comprobante) {
    // Eliminar archivo si el comprobante no existe
    fs.unlinkSync(req.file.path)
    throw new AppError('Comprobante no encontrado', 404)
  }

  // Crear registro de adjunto
  const adjunto = await req.prisma.adjuntoComprobante.create({
    data: {
      [campoId]: parseInt(id),
      nombreOriginal: req.file.originalname,
      nombreArchivo: req.file.filename,
      rutaArchivo: `/uploads/adjuntos/${req.file.filename}`,
      tipoMime: req.file.mimetype,
      tamanio: req.file.size,
      subidoPor: req.admin.id
    },
    include: {
      admin: {
        select: { id: true, nombre: true, apellido: true }
      }
    }
  })

  res.status(201).json({
    success: true,
    data: adjunto
  })
}))

/**
 * GET /api/admin/adjuntos/:tipo/:id
 * Listar adjuntos de un comprobante
 */
router.get('/:tipo/:id', authAdmin, asyncHandler(async (req, res) => {
  const { tipo, id } = req.params

  if (!TIPOS_COMPROBANTE[tipo]) {
    throw new AppError('Tipo de comprobante inválido', 400)
  }

  const campoId = TIPOS_COMPROBANTE[tipo]

  const adjuntos = await req.prisma.adjuntoComprobante.findMany({
    where: {
      [campoId]: parseInt(id)
    },
    include: {
      admin: {
        select: { id: true, nombre: true, apellido: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  res.json({
    success: true,
    data: adjuntos
  })
}))

/**
 * DELETE /api/admin/adjuntos/:adjuntoId
 * Eliminar un adjunto
 */
router.delete('/:adjuntoId', authAdmin, asyncHandler(async (req, res) => {
  const { adjuntoId } = req.params

  const adjunto = await req.prisma.adjuntoComprobante.findUnique({
    where: { id: parseInt(adjuntoId) }
  })

  if (!adjunto) {
    throw new AppError('Adjunto no encontrado', 404)
  }

  // Eliminar archivo físico
  const filePath = path.join(__dirname, '../../uploads/adjuntos', adjunto.nombreArchivo)
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }

  // Eliminar registro de BD
  await req.prisma.adjuntoComprobante.delete({
    where: { id: parseInt(adjuntoId) }
  })

  res.json({
    success: true,
    message: 'Adjunto eliminado'
  })
}))

export default router
