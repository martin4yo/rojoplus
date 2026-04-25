/**
 * Accesos Rápidos (Favoritos) por usuario.
 * Cada admin tiene su propia lista de links favoritos por tenant,
 * agrupados opcionalmente en carpetas con presets de color.
 */
import { Router } from 'express'
import { authAdmin } from '../../middleware/auth.js'
import { asyncHandler, AppError } from '../../middleware/errorHandler.js'

const router = Router()
router.use(authAdmin)

const COLORES_CARPETA_VALIDOS = ['blue', 'green', 'purple', 'orange', 'slate']

// ─── FAVORITOS ────────────────────────────────────────────────────────────────

// GET /admin/favoritos - Listar favoritos del usuario actual
router.get('/favoritos', asyncHandler(async (req, res) => {
  const favoritos = await req.db.favoritoAcceso.findMany({
    where: { adminId: req.admin.id },
    orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
  })
  res.json({ success: true, data: favoritos })
}))

// POST /admin/favoritos - Crear favorito
router.post('/favoritos', asyncHandler(async (req, res) => {
  const { nombre, descripcion, icono, iconoColor, url, abreEnNuevaPestana, carpetaId } = req.body

  if (!nombre || !url) {
    throw new AppError('Nombre y URL son requeridos', 400)
  }

  // Validar carpeta si vino
  if (carpetaId) {
    const carpeta = await req.db.favoritoCarpeta.findFirst({
      where: { id: parseInt(carpetaId), adminId: req.admin.id },
    })
    if (!carpeta) throw new AppError('Carpeta inválida', 400)
  }

  // Asignar orden al final dentro del scope (carpeta o raíz)
  const max = await req.db.favoritoAcceso.aggregate({
    where: {
      adminId: req.admin.id,
      carpetaId: carpetaId ? parseInt(carpetaId) : null,
    },
    _max: { orden: true },
  })
  const ordenSiguiente = (max._max.orden || 0) + 1

  const favorito = await req.db.favoritoAcceso.create({
    data: {
      adminId: req.admin.id,
      carpetaId: carpetaId ? parseInt(carpetaId) : null,
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || null,
      icono: icono || 'Star',
      iconoColor: iconoColor || null,
      url: url.trim(),
      abreEnNuevaPestana: !!abreEnNuevaPestana,
      orden: ordenSiguiente,
    },
  })
  res.status(201).json({ success: true, data: favorito })
}))

// PUT /admin/favoritos/:id - Editar
router.put('/favoritos/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id)
  const { nombre, descripcion, icono, iconoColor, url, abreEnNuevaPestana, orden, carpetaId } = req.body

  const existente = await req.db.favoritoAcceso.findFirst({
    where: { id, adminId: req.admin.id },
  })
  if (!existente) {
    throw new AppError('Favorito no encontrado', 404)
  }

  if (carpetaId !== undefined && carpetaId !== null) {
    const carpeta = await req.db.favoritoCarpeta.findFirst({
      where: { id: parseInt(carpetaId), adminId: req.admin.id },
    })
    if (!carpeta) throw new AppError('Carpeta inválida', 400)
  }

  const favorito = await req.db.favoritoAcceso.update({
    where: { id },
    data: {
      ...(nombre !== undefined && { nombre: nombre.trim() }),
      ...(descripcion !== undefined && { descripcion: descripcion?.trim() || null }),
      ...(icono !== undefined && { icono }),
      ...(iconoColor !== undefined && { iconoColor: iconoColor || null }),
      ...(url !== undefined && { url: url.trim() }),
      ...(abreEnNuevaPestana !== undefined && { abreEnNuevaPestana: !!abreEnNuevaPestana }),
      ...(orden !== undefined && { orden: parseInt(orden) }),
      ...(carpetaId !== undefined && { carpetaId: carpetaId === null ? null : parseInt(carpetaId) }),
    },
  })
  res.json({ success: true, data: favorito })
}))

// POST /admin/favoritos/reordenar - aplica un reordenamiento en bloque
// Body: { carpetas?: [{id, orden}], favoritos?: [{id, carpetaId|null, orden}] }
// Valida que todos los ids pertenezcan al usuario y aplica todo en una transacción.
router.post('/favoritos/reordenar', asyncHandler(async (req, res) => {
  const { carpetas = [], favoritos = [] } = req.body || {}

  if (!Array.isArray(carpetas) || !Array.isArray(favoritos)) {
    throw new AppError('Payload inválido', 400)
  }

  // Validar pertenencia
  if (carpetas.length > 0) {
    const ids = carpetas.map(c => parseInt(c.id))
    const existentes = await req.db.favoritoCarpeta.findMany({
      where: { id: { in: ids }, adminId: req.admin.id },
      select: { id: true },
    })
    if (existentes.length !== ids.length) {
      throw new AppError('Alguna carpeta no pertenece al usuario', 403)
    }
  }

  if (favoritos.length > 0) {
    const ids = favoritos.map(f => parseInt(f.id))
    const existentes = await req.db.favoritoAcceso.findMany({
      where: { id: { in: ids }, adminId: req.admin.id },
      select: { id: true },
    })
    if (existentes.length !== ids.length) {
      throw new AppError('Algún favorito no pertenece al usuario', 403)
    }

    // Validar carpetaIds destino
    const carpetaIdsDestino = [
      ...new Set(favoritos.map(f => f.carpetaId).filter(v => v != null).map(v => parseInt(v))),
    ]
    if (carpetaIdsDestino.length > 0) {
      const okC = await req.db.favoritoCarpeta.findMany({
        where: { id: { in: carpetaIdsDestino }, adminId: req.admin.id },
        select: { id: true },
      })
      if (okC.length !== carpetaIdsDestino.length) {
        throw new AppError('Carpeta destino inválida', 400)
      }
    }
  }

  await req.db.$transaction([
    ...carpetas.map(c =>
      req.db.favoritoCarpeta.update({
        where: { id: parseInt(c.id) },
        data: { orden: parseInt(c.orden) },
      })
    ),
    ...favoritos.map(f =>
      req.db.favoritoAcceso.update({
        where: { id: parseInt(f.id) },
        data: {
          orden: parseInt(f.orden),
          carpetaId: f.carpetaId == null ? null : parseInt(f.carpetaId),
        },
      })
    ),
  ])

  res.json({ success: true })
}))

// DELETE /admin/favoritos/:id
router.delete('/favoritos/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id)
  const existente = await req.db.favoritoAcceso.findFirst({
    where: { id, adminId: req.admin.id },
  })
  if (!existente) {
    throw new AppError('Favorito no encontrado', 404)
  }
  await req.db.favoritoAcceso.delete({ where: { id } })
  res.json({ success: true })
}))

// ─── CARPETAS ─────────────────────────────────────────────────────────────────

// GET /admin/favoritos-carpetas
router.get('/favoritos-carpetas', asyncHandler(async (req, res) => {
  const carpetas = await req.db.favoritoCarpeta.findMany({
    where: { adminId: req.admin.id },
    orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
  })
  res.json({ success: true, data: carpetas })
}))

// POST /admin/favoritos-carpetas
router.post('/favoritos-carpetas', asyncHandler(async (req, res) => {
  const { nombre, color } = req.body
  if (!nombre) throw new AppError('Nombre requerido', 400)

  const colorFinal = COLORES_CARPETA_VALIDOS.includes(color) ? color : 'blue'

  const max = await req.db.favoritoCarpeta.aggregate({
    where: { adminId: req.admin.id },
    _max: { orden: true },
  })

  const carpeta = await req.db.favoritoCarpeta.create({
    data: {
      adminId: req.admin.id,
      nombre: nombre.trim(),
      color: colorFinal,
      orden: (max._max.orden || 0) + 1,
    },
  })
  res.status(201).json({ success: true, data: carpeta })
}))

// PUT /admin/favoritos-carpetas/:id
router.put('/favoritos-carpetas/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id)
  const { nombre, color, orden } = req.body

  const existente = await req.db.favoritoCarpeta.findFirst({
    where: { id, adminId: req.admin.id },
  })
  if (!existente) throw new AppError('Carpeta no encontrada', 404)

  if (color !== undefined && !COLORES_CARPETA_VALIDOS.includes(color)) {
    throw new AppError('Color inválido', 400)
  }

  const carpeta = await req.db.favoritoCarpeta.update({
    where: { id },
    data: {
      ...(nombre !== undefined && { nombre: nombre.trim() }),
      ...(color !== undefined && { color }),
      ...(orden !== undefined && { orden: parseInt(orden) }),
    },
  })
  res.json({ success: true, data: carpeta })
}))

// DELETE /admin/favoritos-carpetas/:id
// Los favoritos contenidos quedan sin carpeta (carpetaId = null) por onDelete: SetNull
router.delete('/favoritos-carpetas/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id)
  const existente = await req.db.favoritoCarpeta.findFirst({
    where: { id, adminId: req.admin.id },
  })
  if (!existente) throw new AppError('Carpeta no encontrada', 404)
  await req.db.favoritoCarpeta.delete({ where: { id } })
  res.json({ success: true })
}))

export default router
