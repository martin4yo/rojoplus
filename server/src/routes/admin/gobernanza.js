import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { fileURLToPath } from 'url'
import { authAdmin } from '../../middleware/auth.js'
import { asyncHandler, AppError } from '../../middleware/errorHandler.js'

const router = Router()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ============================================
// MULTER — subida de archivos
// ============================================

const makeStorage = (subfolder) => multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, `../../../../uploads/gobernanza/${subfolder}`)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${uuidv4()}${ext}`)
  },
})

const fileFilter = (req, file, cb) => {
  const allowed = [
    'application/pdf',
    'image/jpeg', 'image/jpg', 'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]
  if (allowed.includes(file.mimetype)) cb(null, true)
  else cb(new AppError('Tipo de archivo no permitido. Usar PDF, imagen, Word o Excel.', 400), false)
}

const uploadDocumento = multer({ storage: makeStorage('documentos'), fileFilter, limits: { fileSize: 20 * 1024 * 1024 } })
const uploadAdjunto  = multer({ storage: makeStorage('actas'),     fileFilter, limits: { fileSize: 20 * 1024 * 1024 } })

// Helper para eliminar archivo físico si existe
function eliminarArchivo(relPath) {
  if (!relPath) return
  const abs = path.join(__dirname, '../../../../uploads', relPath)
  if (fs.existsSync(abs)) fs.unlinkSync(abs)
}

// ============================================
// ACTAS DE REUNIÓN
// ============================================

router.get('/actas', authAdmin, asyncHandler(async (req, res) => {
  const { tipo, estado, anio } = req.query
  const where = {}
  if (tipo) where.tipo = tipo
  if (estado) where.estado = estado
  if (anio) {
    const y = parseInt(anio)
    where.fecha = { gte: new Date(`${y}-01-01`), lt: new Date(`${y + 1}-01-01`) }
  }
  const actas = await req.db.actaReunion.findMany({ where, orderBy: { fecha: 'desc' } })
  res.json(actas)
}))

router.get('/actas/:id', authAdmin, asyncHandler(async (req, res) => {
  const acta = await req.db.actaReunion.findFirst({ where: { id: parseInt(req.params.id) } })
  if (!acta) return res.status(404).json({ error: 'Acta no encontrada' })
  res.json(acta)
}))

router.post('/actas', authAdmin, asyncHandler(async (req, res) => {
  const { titulo, tipo, fecha, lugar, asistentes, temario, contenido, resoluciones, estado } = req.body
  const acta = await req.db.actaReunion.create({
    data: {
      titulo, tipo: tipo || 'COMISION', fecha: new Date(fecha),
      lugar, asistentes, temario, contenido, resoluciones,
      estado: estado || 'BORRADOR', creadoPor: req.admin?.id || null,
    },
  })
  res.status(201).json(acta)
}))

router.put('/actas/:id', authAdmin, asyncHandler(async (req, res) => {
  const { titulo, tipo, fecha, lugar, asistentes, temario, contenido, resoluciones, estado } = req.body
  const acta = await req.db.actaReunion.update({
    where: { id: parseInt(req.params.id) },
    data: {
      titulo, tipo,
      fecha: fecha ? new Date(fecha) : undefined,
      lugar, asistentes, temario, contenido, resoluciones, estado,
    },
  })
  res.json(acta)
}))

router.delete('/actas/:id', authAdmin, asyncHandler(async (req, res) => {
  const acta = await req.db.actaReunion.findFirst({ where: { id: parseInt(req.params.id) } })
  if (acta?.adjuntoUrl) eliminarArchivo(acta.adjuntoUrl)
  await req.db.actaReunion.delete({ where: { id: parseInt(req.params.id) } })
  res.json({ ok: true })
}))

// POST /actas/:id/adjunto — subir/reemplazar adjunto
router.post('/actas/:id/adjunto', authAdmin, uploadAdjunto.single('archivo'), asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('No se recibió archivo', 400)

  const acta = await req.db.actaReunion.findFirst({ where: { id: parseInt(req.params.id) } })
  if (!acta) {
    fs.unlinkSync(req.file.path)
    throw new AppError('Acta no encontrada', 404)
  }

  // Eliminar adjunto anterior si existe
  if (acta.adjuntoUrl) eliminarArchivo(acta.adjuntoUrl)

  const relPath = `gobernanza/actas/${req.file.filename}`
  const updated = await req.db.actaReunion.update({
    where: { id: parseInt(req.params.id) },
    data: { adjuntoUrl: relPath, adjuntoNombre: req.file.originalname },
  })
  res.json(updated)
}))

// DELETE /actas/:id/adjunto — eliminar adjunto
router.delete('/actas/:id/adjunto', authAdmin, asyncHandler(async (req, res) => {
  const acta = await req.db.actaReunion.findFirst({ where: { id: parseInt(req.params.id) } })
  if (!acta) throw new AppError('Acta no encontrada', 404)
  if (acta.adjuntoUrl) eliminarArchivo(acta.adjuntoUrl)
  await req.db.actaReunion.update({
    where: { id: parseInt(req.params.id) },
    data: { adjuntoUrl: null, adjuntoNombre: null },
  })
  res.json({ ok: true })
}))

// GET /actas/:id/descargar — descargar adjunto
router.get('/actas/:id/descargar', authAdmin, asyncHandler(async (req, res) => {
  const acta = await req.db.actaReunion.findFirst({ where: { id: parseInt(req.params.id) } })
  if (!acta?.adjuntoUrl) throw new AppError('Sin adjunto', 404)

  const filePath = path.join(__dirname, '../../../../uploads', acta.adjuntoUrl)
  if (!fs.existsSync(filePath)) throw new AppError('Archivo no encontrado en el servidor', 404)

  res.download(filePath, acta.adjuntoNombre || path.basename(acta.adjuntoUrl))
}))

// ============================================
// VOTACIONES
// ============================================

router.get('/votaciones', authAdmin, asyncHandler(async (req, res) => {
  const { estado } = req.query
  const where = {}
  if (estado) where.estado = estado
  const votaciones = await req.db.votacion.findMany({
    where, orderBy: { createdAt: 'desc' },
    include: { _count: { select: { votos: true } } },
  })
  res.json(votaciones)
}))

router.get('/votaciones/:id', authAdmin, asyncHandler(async (req, res) => {
  const votacion = await req.db.votacion.findFirst({
    where: { id: parseInt(req.params.id) },
    include: {
      votos: { include: { socio: { select: { id: true, nombre: true, apellido: true, nroSocio: true } } } },
    },
  })
  if (!votacion) return res.status(404).json({ error: 'Votación no encontrada' })

  const opciones = JSON.parse(votacion.opciones || '[]')
  const resultados = opciones.map(op => ({
    opcion: op,
    votos: votacion.votos.filter(v => v.opcion === op).length,
  }))
  res.json({ ...votacion, resultados })
}))

router.post('/votaciones', authAdmin, asyncHandler(async (req, res) => {
  const { titulo, descripcion, tipo, opciones, fechaInicio, fechaCierre, soloHabilitados } = req.body
  if (!opciones || !Array.isArray(opciones) || opciones.length < 2)
    return res.status(400).json({ error: 'Se requieren al menos 2 opciones' })

  const votacion = await req.db.votacion.create({
    data: {
      titulo, descripcion, tipo: tipo || 'SIMPLE',
      opciones: JSON.stringify(opciones),
      fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
      fechaCierre: fechaCierre ? new Date(fechaCierre) : null,
      soloHabilitados: soloHabilitados !== false,
      estado: 'BORRADOR', creadoPor: req.admin?.id || null,
    },
  })
  res.status(201).json(votacion)
}))

router.put('/votaciones/:id', authAdmin, asyncHandler(async (req, res) => {
  const { titulo, descripcion, tipo, opciones, fechaInicio, fechaCierre, soloHabilitados, estado } = req.body
  const data = { titulo, descripcion, tipo, estado }
  if (opciones) data.opciones = JSON.stringify(opciones)
  if (fechaInicio !== undefined) data.fechaInicio = fechaInicio ? new Date(fechaInicio) : null
  if (fechaCierre !== undefined) data.fechaCierre = fechaCierre ? new Date(fechaCierre) : null
  if (soloHabilitados !== undefined) data.soloHabilitados = soloHabilitados

  const votacion = await req.db.votacion.update({ where: { id: parseInt(req.params.id) }, data })
  res.json(votacion)
}))

router.delete('/votaciones/:id', authAdmin, asyncHandler(async (req, res) => {
  await req.db.votacion.delete({ where: { id: parseInt(req.params.id) } })
  res.json({ ok: true })
}))

router.post('/votaciones/:id/votar', authAdmin, asyncHandler(async (req, res) => {
  const votacionId = parseInt(req.params.id)
  const { socioId, opcion } = req.body

  const votacion = await req.db.votacion.findFirst({ where: { id: votacionId } })
  if (!votacion) return res.status(404).json({ error: 'Votación no encontrada' })
  if (votacion.estado !== 'ABIERTA') return res.status(400).json({ error: 'La votación no está abierta' })

  const opciones = JSON.parse(votacion.opciones || '[]')
  if (!opciones.includes(opcion)) return res.status(400).json({ error: 'Opción inválida' })

  const yaVoto = await req.db.votoRegistrado.findFirst({ where: { votacionId, socioId } })
  if (yaVoto) return res.status(409).json({ error: 'El socio ya registró su voto' })

  if (votacion.soloHabilitados) {
    const socio = await req.db.socio.findFirst({ where: { id: socioId, estado: 'ACTIVO' } })
    if (!socio) return res.status(403).json({ error: 'El socio no está habilitado para votar' })
  }

  const voto = await req.db.votoRegistrado.create({ data: { votacionId, socioId, opcion } })
  res.status(201).json(voto)
}))

router.delete('/votaciones/:id/votos/:socioId', authAdmin, asyncHandler(async (req, res) => {
  await req.db.votoRegistrado.deleteMany({
    where: { votacionId: parseInt(req.params.id), socioId: parseInt(req.params.socioId) },
  })
  res.json({ ok: true })
}))

router.get('/votaciones/:id/padron', authAdmin, asyncHandler(async (req, res) => {
  const votacionId = parseInt(req.params.id)
  const { buscar } = req.query

  const yaVotaron = await req.db.votoRegistrado.findMany({ where: { votacionId }, select: { socioId: true } })
  const idsYaVotaron = yaVotaron.map(v => v.socioId)

  const where = { estado: 'ACTIVO', id: { notIn: idsYaVotaron.length ? idsYaVotaron : [-1] } }
  if (buscar) {
    where.OR = [
      { nombre: { contains: buscar, mode: 'insensitive' } },
      { apellido: { contains: buscar, mode: 'insensitive' } },
      { nroSocio: { contains: buscar, mode: 'insensitive' } },
    ]
  }

  const socios = await req.db.socio.findMany({
    where, select: { id: true, nombre: true, apellido: true, nroSocio: true },
    orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }], take: 50,
  })
  res.json(socios)
}))

// ============================================
// DOCUMENTOS DEL CLUB
// ============================================

router.get('/documentos-club', authAdmin, asyncHandler(async (req, res) => {
  const { categoria } = req.query
  const where = {}
  if (categoria) where.categoria = categoria
  const docs = await req.db.documentoClub.findMany({ where, orderBy: { createdAt: 'desc' } })
  res.json(docs)
}))

// POST — subir nuevo documento con archivo
router.post('/documentos-club', authAdmin, uploadDocumento.single('archivo'), asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Se requiere un archivo', 400)
  const { nombre, descripcion, categoria, publico } = req.body
  if (!nombre) throw new AppError('El nombre es requerido', 400)

  const doc = await req.db.documentoClub.create({
    data: {
      nombre,
      descripcion,
      categoria: categoria || 'GENERAL',
      url: `gobernanza/documentos/${req.file.filename}`,
      nombreOriginal: req.file.originalname,
      mimeType: req.file.mimetype,
      tamano: req.file.size,
      publico: publico === 'true' || publico === true,
      creadoPor: req.admin?.id || null,
    },
  })
  res.status(201).json(doc)
}))

// PUT — actualizar metadatos (y opcionalmente reemplazar archivo)
router.put('/documentos-club/:id', authAdmin, uploadDocumento.single('archivo'), asyncHandler(async (req, res) => {
  const { nombre, descripcion, categoria, publico } = req.body
  const data = { nombre, descripcion, categoria, publico: publico === 'true' || publico === true }

  if (req.file) {
    const doc = await req.db.documentoClub.findFirst({ where: { id: parseInt(req.params.id) } })
    if (doc?.url) eliminarArchivo(doc.url)
    data.url = `gobernanza/documentos/${req.file.filename}`
    data.nombreOriginal = req.file.originalname
    data.mimeType = req.file.mimetype
    data.tamano = req.file.size
  }

  const doc = await req.db.documentoClub.update({ where: { id: parseInt(req.params.id) }, data })
  res.json(doc)
}))

// GET /documentos-club/:id/descargar
router.get('/documentos-club/:id/descargar', authAdmin, asyncHandler(async (req, res) => {
  const doc = await req.db.documentoClub.findFirst({ where: { id: parseInt(req.params.id) } })
  if (!doc?.url) throw new AppError('Documento sin archivo', 404)

  const filePath = path.join(__dirname, '../../../../uploads', doc.url)
  if (!fs.existsSync(filePath)) throw new AppError('Archivo no encontrado en el servidor', 404)

  res.download(filePath, doc.nombreOriginal || path.basename(doc.url))
}))

// DELETE — elimina registro y archivo físico
router.delete('/documentos-club/:id', authAdmin, asyncHandler(async (req, res) => {
  const doc = await req.db.documentoClub.findFirst({ where: { id: parseInt(req.params.id) } })
  if (doc?.url) eliminarArchivo(doc.url)
  await req.db.documentoClub.delete({ where: { id: parseInt(req.params.id) } })
  res.json({ ok: true })
}))

export default router
