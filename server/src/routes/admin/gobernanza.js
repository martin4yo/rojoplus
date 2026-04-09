import { Router } from 'express'
import { authAdmin } from '../../middleware/auth.js'
import { asyncHandler } from '../../middleware/errorHandler.js'

const router = Router()

// ============================================
// ACTAS DE REUNIÓN
// ============================================

// GET /admin/actas
router.get('/actas', authAdmin, asyncHandler(async (req, res) => {
  const { tipo, estado, anio } = req.query
  const where = {}
  if (tipo) where.tipo = tipo
  if (estado) where.estado = estado
  if (anio) {
    const y = parseInt(anio)
    where.fecha = { gte: new Date(`${y}-01-01`), lt: new Date(`${y + 1}-01-01`) }
  }

  const actas = await req.db.actaReunion.findMany({
    where,
    orderBy: { fecha: 'desc' },
  })
  res.json(actas)
}))

// GET /admin/actas/:id
router.get('/actas/:id', authAdmin, asyncHandler(async (req, res) => {
  const acta = await req.db.actaReunion.findFirst({
    where: { id: parseInt(req.params.id) },
  })
  if (!acta) return res.status(404).json({ error: 'Acta no encontrada' })
  res.json(acta)
}))

// POST /admin/actas
router.post('/actas', authAdmin, asyncHandler(async (req, res) => {
  const { titulo, tipo, fecha, lugar, asistentes, temario, contenido, resoluciones, adjuntoUrl, estado } = req.body
  const acta = await req.db.actaReunion.create({
    data: {
      titulo,
      tipo: tipo || 'COMISION',
      fecha: new Date(fecha),
      lugar,
      asistentes,
      temario,
      contenido,
      resoluciones,
      adjuntoUrl,
      estado: estado || 'BORRADOR',
      creadoPor: req.admin?.id || null,
    },
  })
  res.status(201).json(acta)
}))

// PUT /admin/actas/:id
router.put('/actas/:id', authAdmin, asyncHandler(async (req, res) => {
  const { titulo, tipo, fecha, lugar, asistentes, temario, contenido, resoluciones, adjuntoUrl, estado } = req.body
  const acta = await req.db.actaReunion.update({
    where: { id: parseInt(req.params.id) },
    data: {
      titulo,
      tipo,
      fecha: fecha ? new Date(fecha) : undefined,
      lugar,
      asistentes,
      temario,
      contenido,
      resoluciones,
      adjuntoUrl,
      estado,
    },
  })
  res.json(acta)
}))

// DELETE /admin/actas/:id
router.delete('/actas/:id', authAdmin, asyncHandler(async (req, res) => {
  await req.db.actaReunion.delete({ where: { id: parseInt(req.params.id) } })
  res.json({ ok: true })
}))

// ============================================
// VOTACIONES
// ============================================

// GET /admin/votaciones
router.get('/votaciones', authAdmin, asyncHandler(async (req, res) => {
  const { estado } = req.query
  const where = {}
  if (estado) where.estado = estado

  const votaciones = await req.db.votacion.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { votos: true } },
    },
  })
  res.json(votaciones)
}))

// GET /admin/votaciones/:id — incluye resultados
router.get('/votaciones/:id', authAdmin, asyncHandler(async (req, res) => {
  const votacion = await req.db.votacion.findFirst({
    where: { id: parseInt(req.params.id) },
    include: {
      votos: {
        include: { socio: { select: { id: true, nombre: true, apellido: true, nroSocio: true } } },
      },
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

// POST /admin/votaciones
router.post('/votaciones', authAdmin, asyncHandler(async (req, res) => {
  const { titulo, descripcion, tipo, opciones, fechaInicio, fechaCierre, soloHabilitados } = req.body
  if (!opciones || !Array.isArray(opciones) || opciones.length < 2) {
    return res.status(400).json({ error: 'Se requieren al menos 2 opciones' })
  }
  const votacion = await req.db.votacion.create({
    data: {
      titulo,
      descripcion,
      tipo: tipo || 'SIMPLE',
      opciones: JSON.stringify(opciones),
      fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
      fechaCierre: fechaCierre ? new Date(fechaCierre) : null,
      soloHabilitados: soloHabilitados !== false,
      estado: 'BORRADOR',
      creadoPor: req.admin?.id || null,
    },
  })
  res.status(201).json(votacion)
}))

// PUT /admin/votaciones/:id
router.put('/votaciones/:id', authAdmin, asyncHandler(async (req, res) => {
  const { titulo, descripcion, tipo, opciones, fechaInicio, fechaCierre, soloHabilitados, estado } = req.body
  const data = { titulo, descripcion, tipo, estado }
  if (opciones) data.opciones = JSON.stringify(opciones)
  if (fechaInicio !== undefined) data.fechaInicio = fechaInicio ? new Date(fechaInicio) : null
  if (fechaCierre !== undefined) data.fechaCierre = fechaCierre ? new Date(fechaCierre) : null
  if (soloHabilitados !== undefined) data.soloHabilitados = soloHabilitados

  const votacion = await req.db.votacion.update({
    where: { id: parseInt(req.params.id) },
    data,
  })
  res.json(votacion)
}))

// DELETE /admin/votaciones/:id
router.delete('/votaciones/:id', authAdmin, asyncHandler(async (req, res) => {
  await req.db.votacion.delete({ where: { id: parseInt(req.params.id) } })
  res.json({ ok: true })
}))

// POST /admin/votaciones/:id/votar — admin registra voto de un socio
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

  const voto = await req.db.votoRegistrado.create({
    data: { votacionId, socioId, opcion },
  })
  res.status(201).json(voto)
}))

// DELETE /admin/votaciones/:id/votos/:socioId — anular voto
router.delete('/votaciones/:id/votos/:socioId', authAdmin, asyncHandler(async (req, res) => {
  const votacionId = parseInt(req.params.id)
  const socioId = parseInt(req.params.socioId)
  await req.db.votoRegistrado.deleteMany({ where: { votacionId, socioId } })
  res.json({ ok: true })
}))

// GET /admin/votaciones/:id/padron — socios habilitados que aún no votaron
router.get('/votaciones/:id/padron', authAdmin, asyncHandler(async (req, res) => {
  const votacionId = parseInt(req.params.id)
  const { buscar } = req.query

  const yaVotaron = await req.db.votoRegistrado.findMany({
    where: { votacionId },
    select: { socioId: true },
  })
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
    where,
    select: { id: true, nombre: true, apellido: true, nroSocio: true },
    orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
    take: 50,
  })
  res.json(socios)
}))

// ============================================
// DOCUMENTOS DEL CLUB
// ============================================

// GET /admin/documentos-club
router.get('/documentos-club', authAdmin, asyncHandler(async (req, res) => {
  const { categoria } = req.query
  const where = {}
  if (categoria) where.categoria = categoria

  const docs = await req.db.documentoClub.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })
  res.json(docs)
}))

// POST /admin/documentos-club
router.post('/documentos-club', authAdmin, asyncHandler(async (req, res) => {
  const { nombre, descripcion, categoria, url, mimeType, tamano, publico } = req.body
  if (!nombre || !url) return res.status(400).json({ error: 'nombre y url requeridos' })

  const doc = await req.db.documentoClub.create({
    data: {
      nombre,
      descripcion,
      categoria: categoria || 'GENERAL',
      url,
      mimeType,
      tamano: tamano ? parseInt(tamano) : null,
      publico: publico === true,
      creadoPor: req.admin?.id || null,
    },
  })
  res.status(201).json(doc)
}))

// PUT /admin/documentos-club/:id
router.put('/documentos-club/:id', authAdmin, asyncHandler(async (req, res) => {
  const { nombre, descripcion, categoria, url, publico } = req.body
  const doc = await req.db.documentoClub.update({
    where: { id: parseInt(req.params.id) },
    data: { nombre, descripcion, categoria, url, publico },
  })
  res.json(doc)
}))

// DELETE /admin/documentos-club/:id
router.delete('/documentos-club/:id', authAdmin, asyncHandler(async (req, res) => {
  await req.db.documentoClub.delete({ where: { id: parseInt(req.params.id) } })
  res.json({ ok: true })
}))

export default router
