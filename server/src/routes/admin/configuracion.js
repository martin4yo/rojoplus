import { Router } from 'express'
import { asyncHandler, AppError } from '../../middleware/errorHandler.js'
import { authAdmin } from '../../middleware/auth.js'

const router = Router()

// GET /api/admin/cobradores - Listado de cobradores
router.get('/cobradores', authAdmin, asyncHandler(async (req, res) => {
  const cobradores = await req.db.cobrador.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' },
  })

  res.json({
    success: true,
    data: cobradores.map(c => ({
      ...c,
      comisionPct: Number(c.comisionPct),
    })),
  })
}))

// ============================================================================
// TABLAS AUXILIARES DE SOCIOS
// ============================================================================

// --- TIPOS DE SOCIO ---

// GET /api/admin/tipos-socio
router.get('/tipos-socio', authAdmin, asyncHandler(async (req, res) => {
  const { activo } = req.query
  const where = activo !== undefined ? { activo: activo === 'true' } : {}

  const tipos = await req.db.tipoSocio.findMany({
    where,
    include: {
      conceptoTesoreria: { select: { id: true, codigo: true, nombre: true } },
    },
    orderBy: { orden: 'asc' },
  })

  res.json({ success: true, data: tipos })
}))

// GET /api/admin/tipos-socio/:id
router.get('/tipos-socio/:id', authAdmin, asyncHandler(async (req, res) => {
  const tipo = await req.db.tipoSocio.findUnique({
    where: { id: parseInt(req.params.id) },
    include: {
      conceptoTesoreria: { select: { id: true, codigo: true, nombre: true } },
    },
  })
  if (!tipo) throw new AppError('Tipo de socio no encontrado', 404, 'NOT_FOUND')
  res.json({ success: true, data: tipo })
}))

// POST /api/admin/tipos-socio
router.post('/tipos-socio', authAdmin, asyncHandler(async (req, res) => {
  const { codigo, nombre, descripcion, cuotaMensual, conceptoTesoreriaId, color, orden } = req.body

  if (!codigo || !nombre) {
    throw new AppError('Código y nombre son requeridos', 400, 'VALIDATION_ERROR')
  }

  const existente = await req.db.tipoSocio.findFirst({ where: { codigo } })
  if (existente) throw new AppError('Ya existe un tipo con ese código', 400, 'DUPLICATE')

  const tipo = await req.db.tipoSocio.create({
    data: {
      codigo,
      nombre,
      descripcion,
      cuotaMensual: cuotaMensual ? parseFloat(cuotaMensual) : null,
      conceptoTesoreriaId: conceptoTesoreriaId ? parseInt(conceptoTesoreriaId) : null,
      color,
      orden: orden || 0,
    },
    include: {
      conceptoTesoreria: { select: { id: true, codigo: true, nombre: true } },
    },
  })

  res.status(201).json({ success: true, data: tipo })
}))

// PUT /api/admin/tipos-socio/:id
router.put('/tipos-socio/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { codigo, nombre, descripcion, cuotaMensual, conceptoTesoreriaId, color, orden, activo } = req.body

  const existente = await req.db.tipoSocio.findUnique({ where: { id: parseInt(id) } })
  if (!existente) throw new AppError('Tipo de socio no encontrado', 404, 'NOT_FOUND')

  if (codigo && codigo !== existente.codigo) {
    const duplicado = await req.db.tipoSocio.findFirst({ where: { codigo } })
    if (duplicado) throw new AppError('Ya existe un tipo con ese código', 400, 'DUPLICATE')
  }

  const tipo = await req.db.tipoSocio.update({
    where: { id: parseInt(id) },
    data: {
      codigo: codigo ?? existente.codigo,
      nombre: nombre ?? existente.nombre,
      descripcion: descripcion !== undefined ? descripcion : existente.descripcion,
      cuotaMensual: cuotaMensual !== undefined ? (cuotaMensual ? parseFloat(cuotaMensual) : null) : existente.cuotaMensual,
      conceptoTesoreriaId: conceptoTesoreriaId !== undefined ? (conceptoTesoreriaId ? parseInt(conceptoTesoreriaId) : null) : existente.conceptoTesoreriaId,
      color: color !== undefined ? color : existente.color,
      orden: orden !== undefined ? orden : existente.orden,
      activo: activo !== undefined ? activo : existente.activo,
    },
    include: {
      conceptoTesoreria: { select: { id: true, codigo: true, nombre: true } },
    },
  })

  res.json({ success: true, data: tipo })
}))

// DELETE /api/admin/tipos-socio/:id
router.delete('/tipos-socio/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  // Verificar si hay socios usando este tipo
  const sociosConTipo = await req.db.socio.count({
    where: { tipoSocioRelId: parseInt(id) },
  })

  if (sociosConTipo > 0) {
    throw new AppError(`No se puede eliminar, hay ${sociosConTipo} socio(s) con este tipo`, 400, 'HAS_RELATIONS')
  }

  await req.db.tipoSocio.delete({ where: { id: parseInt(id) } })
  res.json({ success: true, data: { mensaje: 'Tipo de socio eliminado' } })
}))

// --- CATEGORÍAS DE SOCIO ---

// GET /api/admin/categorias-socio
router.get('/categorias-socio', authAdmin, asyncHandler(async (req, res) => {
  const { activo } = req.query
  const where = activo !== undefined ? { activo: activo === 'true' } : {}

  const categorias = await req.db.categoriaSocio.findMany({
    where,
    orderBy: { orden: 'asc' },
  })

  res.json({
    success: true,
    data: categorias.map(c => ({
      ...c,
      porcentajeDescuento: c.porcentajeDescuento ? Number(c.porcentajeDescuento) : 0,
    })),
  })
}))

// GET /api/admin/categorias-socio/:id
router.get('/categorias-socio/:id', authAdmin, asyncHandler(async (req, res) => {
  const categoria = await req.db.categoriaSocio.findUnique({
    where: { id: parseInt(req.params.id) },
  })
  if (!categoria) throw new AppError('Categoría de socio no encontrada', 404, 'NOT_FOUND')
  res.json({
    success: true,
    data: { ...categoria, porcentajeDescuento: categoria.porcentajeDescuento ? Number(categoria.porcentajeDescuento) : 0 },
  })
}))

// POST /api/admin/categorias-socio
router.post('/categorias-socio', authAdmin, asyncHandler(async (req, res) => {
  const { codigo, nombre, descripcion, porcentajeDescuento, color, orden } = req.body

  if (!codigo || !nombre) {
    throw new AppError('Código y nombre son requeridos', 400, 'VALIDATION_ERROR')
  }

  const existente = await req.db.categoriaSocio.findFirst({ where: { codigo } })
  if (existente) throw new AppError('Ya existe una categoría con ese código', 400, 'DUPLICATE')

  const categoria = await req.db.categoriaSocio.create({
    data: {
      codigo,
      nombre,
      descripcion,
      porcentajeDescuento: porcentajeDescuento ? parseFloat(porcentajeDescuento) : 0,
      color,
      orden: orden || 0,
    },
  })

  res.status(201).json({ success: true, data: categoria })
}))

// PUT /api/admin/categorias-socio/:id
router.put('/categorias-socio/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { codigo, nombre, descripcion, porcentajeDescuento, color, orden, activo } = req.body

  const existente = await req.db.categoriaSocio.findUnique({ where: { id: parseInt(id) } })
  if (!existente) throw new AppError('Categoría de socio no encontrada', 404, 'NOT_FOUND')

  if (codigo && codigo !== existente.codigo) {
    const duplicado = await req.db.categoriaSocio.findFirst({ where: { codigo } })
    if (duplicado) throw new AppError('Ya existe una categoría con ese código', 400, 'DUPLICATE')
  }

  const categoria = await req.db.categoriaSocio.update({
    where: { id: parseInt(id) },
    data: {
      codigo: codigo ?? existente.codigo,
      nombre: nombre ?? existente.nombre,
      descripcion: descripcion !== undefined ? descripcion : existente.descripcion,
      porcentajeDescuento: porcentajeDescuento !== undefined ? parseFloat(porcentajeDescuento) : existente.porcentajeDescuento,
      color: color !== undefined ? color : existente.color,
      orden: orden !== undefined ? orden : existente.orden,
      activo: activo !== undefined ? activo : existente.activo,
    },
  })

  res.json({ success: true, data: categoria })
}))

// DELETE /api/admin/categorias-socio/:id
router.delete('/categorias-socio/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const sociosConCategoria = await req.db.socio.count({
    where: { categoriaSocioId: parseInt(id) },
  })

  if (sociosConCategoria > 0) {
    throw new AppError(`No se puede eliminar, hay ${sociosConCategoria} socio(s) con esta categoría`, 400, 'HAS_RELATIONS')
  }

  await req.db.categoriaSocio.delete({ where: { id: parseInt(id) } })
  res.json({ success: true, data: { mensaje: 'Categoría de socio eliminada' } })
}))

// --- ESTADOS DE SOCIO ---

// GET /api/admin/estados-socio
router.get('/estados-socio', authAdmin, asyncHandler(async (req, res) => {
  const { activo } = req.query
  const where = activo !== undefined ? { activo: activo === 'true' } : {}

  const estados = await req.db.estadoSocio.findMany({
    where,
    orderBy: { orden: 'asc' },
  })

  res.json({ success: true, data: estados })
}))

// GET /api/admin/estados-socio/:id
router.get('/estados-socio/:id', authAdmin, asyncHandler(async (req, res) => {
  const estado = await req.db.estadoSocio.findUnique({
    where: { id: parseInt(req.params.id) },
  })
  if (!estado) throw new AppError('Estado de socio no encontrado', 404, 'NOT_FOUND')
  res.json({ success: true, data: estado })
}))

// POST /api/admin/estados-socio
router.post('/estados-socio', authAdmin, asyncHandler(async (req, res) => {
  const { codigo, nombre, descripcion, color, permiteDescuentos, permiteIngresoMolinete, esSocioActivo, rolVigencia, orden } = req.body

  if (!codigo || !nombre) {
    throw new AppError('Código y nombre son requeridos', 400, 'VALIDATION_ERROR')
  }

  // Validar rolVigencia
  const rolValido = rolVigencia == null || rolVigencia === '' || ['AL_DIA', 'BLOQUEADO'].includes(rolVigencia)
  if (!rolValido) throw new AppError('rolVigencia inválido (AL_DIA, BLOQUEADO o null)', 400, 'VALIDATION_ERROR')

  // Validar unicidad por tenant del rol AL_DIA / BLOQUEADO
  if (rolVigencia === 'AL_DIA' || rolVigencia === 'BLOQUEADO') {
    const otro = await req.db.estadoSocio.findFirst({ where: { rolVigencia } })
    if (otro) throw new AppError(`Ya hay un estado marcado como ${rolVigencia}: "${otro.nombre}"`, 400, 'DUPLICATE_ROL')
  }

  const existente = await req.db.estadoSocio.findFirst({ where: { codigo } })
  if (existente) throw new AppError('Ya existe un estado con ese código', 400, 'DUPLICATE')

  const estado = await req.db.estadoSocio.create({
    data: {
      codigo,
      nombre,
      descripcion,
      color,
      permiteDescuentos: permiteDescuentos || false,
      permiteIngresoMolinete: permiteIngresoMolinete || false,
      esSocioActivo: esSocioActivo !== undefined ? esSocioActivo : true,
      rolVigencia: rolVigencia || null,
      orden: orden || 0,
    },
  })

  res.status(201).json({ success: true, data: estado })
}))

// PUT /api/admin/estados-socio/:id
router.put('/estados-socio/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { codigo, nombre, descripcion, color, permiteDescuentos, permiteIngresoMolinete, esSocioActivo, rolVigencia, orden, activo } = req.body

  const existente = await req.db.estadoSocio.findUnique({ where: { id: parseInt(id) } })
  if (!existente) throw new AppError('Estado de socio no encontrado', 404, 'NOT_FOUND')

  if (codigo && codigo !== existente.codigo) {
    const duplicado = await req.db.estadoSocio.findFirst({ where: { codigo } })
    if (duplicado) throw new AppError('Ya existe un estado con ese código', 400, 'DUPLICATE')
  }

  // Validar rolVigencia y su unicidad por tenant
  let rolVigenciaFinal = existente.rolVigencia
  if (rolVigencia !== undefined) {
    const v = rolVigencia === '' ? null : rolVigencia
    const rolValido = v == null || ['AL_DIA', 'BLOQUEADO'].includes(v)
    if (!rolValido) throw new AppError('rolVigencia inválido (AL_DIA, BLOQUEADO o null)', 400, 'VALIDATION_ERROR')
    if (v === 'AL_DIA' || v === 'BLOQUEADO') {
      const otro = await req.db.estadoSocio.findFirst({
        where: { rolVigencia: v, NOT: { id: parseInt(id) } },
      })
      if (otro) throw new AppError(`Ya hay un estado marcado como ${v}: "${otro.nombre}"`, 400, 'DUPLICATE_ROL')
    }
    rolVigenciaFinal = v
  }

  const estado = await req.db.estadoSocio.update({
    where: { id: parseInt(id) },
    data: {
      codigo: codigo ?? existente.codigo,
      nombre: nombre ?? existente.nombre,
      descripcion: descripcion !== undefined ? descripcion : existente.descripcion,
      color: color !== undefined ? color : existente.color,
      permiteDescuentos: permiteDescuentos !== undefined ? permiteDescuentos : existente.permiteDescuentos,
      permiteIngresoMolinete: permiteIngresoMolinete !== undefined ? permiteIngresoMolinete : existente.permiteIngresoMolinete,
      esSocioActivo: esSocioActivo !== undefined ? esSocioActivo : existente.esSocioActivo,
      rolVigencia: rolVigenciaFinal,
      orden: orden !== undefined ? orden : existente.orden,
      activo: activo !== undefined ? activo : existente.activo,
    },
  })

  res.json({ success: true, data: estado })
}))

// DELETE /api/admin/estados-socio/:id
router.delete('/estados-socio/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const sociosConEstado = await req.db.socio.count({
    where: { estadoSocioId: parseInt(id) },
  })

  if (sociosConEstado > 0) {
    throw new AppError(`No se puede eliminar, hay ${sociosConEstado} socio(s) con este estado`, 400, 'HAS_RELATIONS')
  }

  await req.db.estadoSocio.delete({ where: { id: parseInt(id) } })
  res.json({ success: true, data: { mensaje: 'Estado de socio eliminado' } })
}))

// --- CATEGORIAS DE CARGO ---

// GET /api/admin/categorias-cargo
router.get('/categorias-cargo', authAdmin, asyncHandler(async (req, res) => {
  const { activo } = req.query
  const where = activo !== undefined ? { activo: activo === 'true' } : {}

  const categorias = await req.db.categoriaCargo.findMany({
    where,
    orderBy: { orden: 'asc' },
  })

  res.json({ success: true, data: categorias })
}))

// GET /api/admin/categorias-cargo/:id
router.get('/categorias-cargo/:id', authAdmin, asyncHandler(async (req, res) => {
  const categoria = await req.db.categoriaCargo.findUnique({
    where: { id: parseInt(req.params.id) },
  })
  if (!categoria) throw new AppError('Categoría de cargo no encontrada', 404, 'NOT_FOUND')
  res.json({ success: true, data: categoria })
}))

// POST /api/admin/categorias-cargo
router.post('/categorias-cargo', authAdmin, asyncHandler(async (req, res) => {
  const { codigo, nombre, descripcion, color, orden } = req.body

  if (!codigo || !nombre) {
    throw new AppError('Código y nombre son requeridos', 400, 'VALIDATION_ERROR')
  }

  const existente = await req.db.categoriaCargo.findFirst({ where: { codigo } })
  if (existente) throw new AppError('Ya existe una categoría con ese código', 400, 'DUPLICATE')

  const categoria = await req.db.categoriaCargo.create({
    data: {
      codigo,
      nombre,
      descripcion,
      color,
      orden: orden || 0,
    },
  })

  res.status(201).json({ success: true, data: categoria })
}))

// PUT /api/admin/categorias-cargo/:id
router.put('/categorias-cargo/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { codigo, nombre, descripcion, color, orden, activo } = req.body

  const existente = await req.db.categoriaCargo.findUnique({ where: { id: parseInt(id) } })
  if (!existente) throw new AppError('Categoría de cargo no encontrada', 404, 'NOT_FOUND')

  if (codigo && codigo !== existente.codigo) {
    const duplicado = await req.db.categoriaCargo.findFirst({ where: { codigo } })
    if (duplicado) throw new AppError('Ya existe una categoría con ese código', 400, 'DUPLICATE')
  }

  const categoria = await req.db.categoriaCargo.update({
    where: { id: parseInt(id) },
    data: {
      codigo: codigo ?? existente.codigo,
      nombre: nombre ?? existente.nombre,
      descripcion: descripcion !== undefined ? descripcion : existente.descripcion,
      color: color !== undefined ? color : existente.color,
      orden: orden !== undefined ? orden : existente.orden,
      activo: activo !== undefined ? activo : existente.activo,
    },
  })

  res.json({ success: true, data: categoria })
}))

// DELETE /api/admin/categorias-cargo/:id
router.delete('/categorias-cargo/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const existente = await req.db.categoriaCargo.findUnique({ where: { id: parseInt(id) } })
  if (!existente) throw new AppError('Categoría de cargo no encontrada', 404, 'NOT_FOUND')

  const cargosConCategoria = await req.db.cargo.count({
    where: { categoria: existente.codigo },
  })

  if (cargosConCategoria > 0) {
    throw new AppError(`No se puede eliminar, hay ${cargosConCategoria} cargo(s) con esta categoría`, 400, 'HAS_RELATIONS')
  }

  await req.db.categoriaCargo.delete({ where: { id: parseInt(id) } })
  res.json({ success: true, data: { mensaje: 'Categoría de cargo eliminada' } })
}))

// ==================== DESCUENTOS DISPONIBLES ====================

// GET /api/admin/descuentos-disponibles
router.get('/descuentos-disponibles', authAdmin, asyncHandler(async (req, res) => {
  const { activo } = req.query
  const where = activo !== undefined ? { activo: activo === 'true' } : {}

  const descuentos = await req.db.descuentoDisponible.findMany({
    where,
    orderBy: { orden: 'asc' },
  })

  res.json({ success: true, data: descuentos })
}))

// GET /api/admin/descuentos-disponibles/:id
router.get('/descuentos-disponibles/:id', authAdmin, asyncHandler(async (req, res) => {
  const descuento = await req.db.descuentoDisponible.findUnique({
    where: { id: parseInt(req.params.id) },
  })
  if (!descuento) throw new AppError('Descuento no encontrado', 404, 'NOT_FOUND')
  res.json({ success: true, data: descuento })
}))

// POST /api/admin/descuentos-disponibles
router.post('/descuentos-disponibles', authAdmin, asyncHandler(async (req, res) => {
  const { nombre, porcentaje, descripcion, orden } = req.body

  if (!nombre || porcentaje === undefined) {
    throw new AppError('Nombre y porcentaje son requeridos', 400, 'VALIDATION_ERROR')
  }

  if (porcentaje < 0 || porcentaje > 100) {
    throw new AppError('El porcentaje debe estar entre 0 y 100', 400, 'VALIDATION_ERROR')
  }

  const descuento = await req.db.descuentoDisponible.create({
    data: {
      nombre,
      porcentaje: parseFloat(porcentaje),
      descripcion,
      orden: orden || 0,
    },
  })

  res.status(201).json({ success: true, data: descuento })
}))

// PUT /api/admin/descuentos-disponibles/:id
router.put('/descuentos-disponibles/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { nombre, porcentaje, descripcion, orden, activo } = req.body

  const existente = await req.db.descuentoDisponible.findUnique({ where: { id: parseInt(id) } })
  if (!existente) throw new AppError('Descuento no encontrado', 404, 'NOT_FOUND')

  if (porcentaje !== undefined && (porcentaje < 0 || porcentaje > 100)) {
    throw new AppError('El porcentaje debe estar entre 0 y 100', 400, 'VALIDATION_ERROR')
  }

  const descuento = await req.db.descuentoDisponible.update({
    where: { id: parseInt(id) },
    data: {
      nombre: nombre ?? existente.nombre,
      porcentaje: porcentaje !== undefined ? parseFloat(porcentaje) : existente.porcentaje,
      descripcion: descripcion !== undefined ? descripcion : existente.descripcion,
      orden: orden !== undefined ? orden : existente.orden,
      activo: activo !== undefined ? activo : existente.activo,
    },
  })

  res.json({ success: true, data: descuento })
}))

// DELETE /api/admin/descuentos-disponibles/:id
router.delete('/descuentos-disponibles/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  // Verificar si hay comercios usando este descuento
  const comerciosConDescuento = await req.db.comercio.count({
    where: { descuentoDisponibleId: parseInt(id) },
  })

  if (comerciosConDescuento > 0) {
    throw new AppError(`No se puede eliminar, hay ${comerciosConDescuento} comercio(s) con este descuento`, 400, 'HAS_RELATIONS')
  }

  await req.db.descuentoDisponible.delete({ where: { id: parseInt(id) } })
  res.json({ success: true, data: { mensaje: 'Descuento eliminado' } })
}))

// POST /api/admin/descuentos-disponibles/inicializar - Crear descuentos por defecto para este tenant
router.post('/descuentos-disponibles/inicializar', authAdmin, asyncHandler(async (req, res) => {
  const DESCUENTOS_DEFAULT = [
    { nombre: '5% - Descuento Básico', porcentaje: 5, descripcion: 'Descuento inicial para comercios adheridos', orden: 1 },
    { nombre: '10% - Descuento Estándar', porcentaje: 10, descripcion: 'Descuento estándar más utilizado', orden: 2 },
    { nombre: '15% - Descuento Plus', porcentaje: 15, descripcion: 'Descuento intermedio atractivo', orden: 3 },
    { nombre: '20% - Descuento Premium', porcentaje: 20, descripcion: 'Descuento destacado para socios', orden: 4 },
    { nombre: '25% - Descuento Especial', porcentaje: 25, descripcion: 'Descuento promocional excepcional', orden: 5 },
    { nombre: '30% - Descuento VIP', porcentaje: 30, descripcion: 'Máximo descuento disponible', orden: 6 },
  ]

  const existentes = await req.db.descuentoDisponible.count({})
  if (existentes > 0) {
    return res.json({ success: true, data: { mensaje: `Ya existen ${existentes} descuentos para este tenant`, creados: 0 } })
  }

  await req.db.descuentoDisponible.createMany({
    data: DESCUENTOS_DEFAULT,
  })

  res.status(201).json({ success: true, data: { mensaje: 'Descuentos por defecto creados', creados: DESCUENTOS_DEFAULT.length } })
}))

// ==================== RUBROS ====================

// GET /api/admin/rubros
router.get('/rubros', authAdmin, asyncHandler(async (req, res) => {
  const { activo } = req.query
  const where = activo !== undefined ? { activo: activo === 'true' } : {}

  const rubros = await req.db.rubro.findMany({
    where,
    orderBy: { orden: 'asc' },
  })

  res.json({ success: true, data: rubros })
}))

// GET /api/admin/rubros/:id
router.get('/rubros/:id', authAdmin, asyncHandler(async (req, res) => {
  const rubro = await req.db.rubro.findUnique({
    where: { id: parseInt(req.params.id) },
  })
  if (!rubro) throw new AppError('Rubro no encontrado', 404, 'NOT_FOUND')
  res.json({ success: true, data: rubro })
}))

// POST /api/admin/rubros
router.post('/rubros', authAdmin, asyncHandler(async (req, res) => {
  const { nombre, orden } = req.body

  if (!nombre) {
    throw new AppError('El nombre es requerido', 400, 'VALIDATION_ERROR')
  }

  const rubro = await req.db.rubro.create({
    data: {
      nombre,
      orden: orden || 0,
    },
  })

  res.status(201).json({ success: true, data: rubro })
}))

// PUT /api/admin/rubros/:id
router.put('/rubros/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { nombre, orden, activo } = req.body

  const existente = await req.db.rubro.findUnique({ where: { id: parseInt(id) } })
  if (!existente) throw new AppError('Rubro no encontrado', 404, 'NOT_FOUND')

  const rubro = await req.db.rubro.update({
    where: { id: parseInt(id) },
    data: {
      nombre: nombre ?? existente.nombre,
      orden: orden !== undefined ? orden : existente.orden,
      activo: activo !== undefined ? activo : existente.activo,
    },
  })

  res.json({ success: true, data: rubro })
}))

// DELETE /api/admin/rubros/:id
router.delete('/rubros/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  // Verificar si hay comercios usando este rubro
  const comerciosConRubro = await req.db.comercio.count({
    where: { rubroId: parseInt(id) },
  })

  if (comerciosConRubro > 0) {
    throw new AppError(`No se puede eliminar, hay ${comerciosConRubro} comercio(s) con este rubro`, 400, 'HAS_RELATIONS')
  }

  await req.db.rubro.delete({ where: { id: parseInt(id) } })
  res.json({ success: true, data: { mensaje: 'Rubro eliminado' } })
}))

// ==================== CONCEPTOS DE TESORERIA ====================

// GET /api/admin/conceptos-tesoreria
router.get('/conceptos-tesoreria', authAdmin, asyncHandler(async (req, res) => {
  const { activo, tipo } = req.query
  const where = {}
  if (activo !== undefined) where.activo = activo === 'true'
  if (tipo) where.tipo = tipo

  const conceptos = await req.db.conceptoTesoreria.findMany({
    where,
    include: {
      cuentaContable: { select: { id: true, codigo: true, nombre: true } },
      centroCosto: { select: { id: true, codigo: true, nombre: true } },
    },
    orderBy: { orden: 'asc' },
  })

  res.json({ success: true, data: conceptos })
}))

// GET /api/admin/conceptos-tesoreria/:id
router.get('/conceptos-tesoreria/:id', authAdmin, asyncHandler(async (req, res) => {
  const concepto = await req.db.conceptoTesoreria.findUnique({
    where: { id: parseInt(req.params.id) },
    include: {
      cuentaContable: { select: { id: true, codigo: true, nombre: true } },
      centroCosto: { select: { id: true, codigo: true, nombre: true } },
    },
  })
  if (!concepto) throw new AppError('Concepto no encontrado', 404, 'NOT_FOUND')
  res.json({ success: true, data: concepto })
}))

// POST /api/admin/conceptos-tesoreria
router.post('/conceptos-tesoreria', authAdmin, asyncHandler(async (req, res) => {
  const { codigo, nombre, descripcion, tipo, usaEnCompras, usaEnVentas, usaEnTesoreria, cuentaContableId, centroCostoId, orden } = req.body

  if (!codigo || !nombre) {
    throw new AppError('Código y nombre son requeridos', 400, 'VALIDATION_ERROR')
  }
  if (!cuentaContableId) {
    throw new AppError('La cuenta contable es requerida', 400, 'VALIDATION_ERROR')
  }
  const existente = await req.db.conceptoTesoreria.findFirst({ where: { codigo } })
  if (existente) throw new AppError('Ya existe un concepto con ese código', 400, 'DUPLICATE')

  const concepto = await req.db.conceptoTesoreria.create({
    data: {
      codigo,
      nombre,
      descripcion,
      tipo: tipo || 'INGRESO',
      usaEnCompras: usaEnCompras || false,
      usaEnVentas: usaEnVentas || false,
      usaEnTesoreria: usaEnTesoreria !== false,
      cuentaContableId: parseInt(cuentaContableId),
      centroCostoId: centroCostoId ? parseInt(centroCostoId) : null,
      orden: orden || 0,
    },
    include: {
      cuentaContable: { select: { id: true, codigo: true, nombre: true } },
      centroCosto: { select: { id: true, codigo: true, nombre: true } },
    },
  })

  res.status(201).json({ success: true, data: concepto })
}))

// PUT /api/admin/conceptos-tesoreria/:id
router.put('/conceptos-tesoreria/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { codigo, nombre, descripcion, tipo, usaEnCompras, usaEnVentas, usaEnTesoreria, cuentaContableId, centroCostoId, orden, activo } = req.body

  const concepto = await req.db.conceptoTesoreria.update({
    where: { id: parseInt(id) },
    data: {
      codigo,
      nombre,
      descripcion,
      tipo,
      usaEnCompras,
      usaEnVentas,
      usaEnTesoreria,
      cuentaContableId: cuentaContableId ? parseInt(cuentaContableId) : null,
      centroCostoId: centroCostoId ? parseInt(centroCostoId) : null,
      orden,
      activo,
    },
    include: {
      cuentaContable: { select: { id: true, codigo: true, nombre: true } },
      centroCosto: { select: { id: true, codigo: true, nombre: true } },
    },
  })

  res.json({ success: true, data: concepto })
}))

// DELETE /api/admin/conceptos-tesoreria/:id
router.delete('/conceptos-tesoreria/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  // Verificar si hay tipos de socio o actividades usando este concepto
  const [tiposSocio, actividades, categorias] = await Promise.all([
    req.db.tipoSocio.count({ where: { conceptoId: parseInt(id) } }),
    req.db.actividad.count({ where: { conceptoId: parseInt(id) } }),
    req.db.categoriaActividad.count({ where: { conceptoId: parseInt(id) } }),
  ])

  if (tiposSocio > 0 || actividades > 0 || categorias > 0) {
    throw new AppError('No se puede eliminar, el concepto está en uso', 400, 'IN_USE')
  }

  await req.db.conceptoTesoreria.delete({ where: { id: parseInt(id) } })
  res.json({ success: true, data: { mensaje: 'Concepto eliminado' } })
}))

// ============================================
// PERIODOS DE CUOTA
// ============================================

// GET /api/admin/periodos - Listar periodos de cuota
router.get('/periodos', authAdmin, asyncHandler(async (req, res) => {
  const { anio } = req.query

  const where = {}
  if (anio) where.anio = parseInt(anio)

  const periodos = await req.db.periodo.findMany({
    where,
    orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
    include: {
      _count: { select: { cargos: true } },
    },
  })

  // Agregar estadísticas de cada periodo
  const periodosConStats = await Promise.all(periodos.map(async (periodo) => {
    const ahora = new Date()
    const [statsTotal, statsPagadas, statsPendientes, statsVencidas] = await Promise.all([
      req.db.cargo.aggregate({
        where: { periodoId: periodo.id },
        _sum: { montoTotal: true },
        _count: { _all: true },
      }),
      req.db.cargo.aggregate({
        where: { periodoId: periodo.id, estado: 'PAGADO' },
        _sum: { montoTotal: true },
        _count: { _all: true },
      }),
      req.db.cargo.aggregate({
        where: { periodoId: periodo.id, estado: 'PENDIENTE' },
        _sum: { montoTotal: true },
        _count: { _all: true },
      }),
      req.db.cargo.aggregate({
        where: {
          periodoId: periodo.id,
          estado: 'PENDIENTE',
          fechaVencimiento: { lt: ahora },
        },
        _sum: { montoTotal: true },
        _count: { _all: true },
      }),
    ])
    return {
      ...periodo,
      totalCuotas: statsTotal._count._all,
      montoTotal: Number(statsTotal._sum.montoTotal) || 0,
      cuotasPagadas: statsPagadas._count._all,
      montoPagado: Number(statsPagadas._sum.montoTotal) || 0,
      cuotasPendientes: statsPendientes._count._all,
      montoPendiente: Number(statsPendientes._sum.montoTotal) || 0,
      cuotasVencidas: statsVencidas._count._all,
      montoVencido: Number(statsVencidas._sum.montoTotal) || 0,
    }
  }))

  res.json({ success: true, data: periodosConStats })
}))

// GET /api/admin/periodos/:id - Detalle de un periodo
router.get('/periodos/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const periodo = await req.db.periodo.findUnique({
    where: { id: parseInt(id) },
  })

  if (!periodo) {
    throw new AppError('Periodo no encontrado', 404, 'NOT_FOUND')
  }

  const stats = await req.db.cargo.groupBy({
    by: ['estado'],
    where: { periodoId: periodo.id },
    _count: true,
    _sum: { montoTotal: true },
  })

  res.json({ success: true, data: { ...periodo, estadisticas: stats } })
}))

// POST /api/admin/periodos - Crear periodo de cuota
router.post('/periodos', authAdmin, asyncHandler(async (req, res) => {
  const { anio, mes, fechaVencimiento } = req.body

  if (!anio || !mes) {
    throw new AppError('anio y mes son requeridos', 400, 'VALIDATION_ERROR')
  }

  const anioInt = parseInt(anio)
  const mesInt = parseInt(mes)

  // Verificar si ya existe un periodo con el mismo año/mes
  const periodoExistente = await req.db.periodo.findFirst({
    where: { anio: anioInt, mes: mesInt }
  })

  // Si ya existe, devolverlo (puede haber sido creado por un plan de pagos)
  if (periodoExistente) {
    return res.status(200).json({
      success: true,
      data: {
        ...periodoExistente,
        existente: true
      }
    })
  }

  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const nombre = `${meses[mesInt - 1]} ${anio}`

  // Calcular fecha de vencimiento según configuración
  let fechaVenc
  if (fechaVencimiento) {
    // Si se proporciona fecha de vencimiento, usarla
    fechaVenc = new Date(fechaVencimiento)
  } else {
    // Obtener configuración
    const configDia = await req.db.configuracion.findFirst({
      where: { clave: 'CUOTA_DIA_VENCIMIENTO' }
    })
    const configMismoMes = await req.db.configuracion.findFirst({
      where: { clave: 'CUOTA_VENCE_MISMO_MES' }
    })

    const diaVencimiento = configDia ? parseInt(configDia.valor) : 10
    const venceMismoMes = configMismoMes ? configMismoMes.valor === 'true' : false

    // Calcular mes y año del vencimiento
    let mesVenc = mesInt
    let anioVenc = anioInt

    if (!venceMismoMes) {
      // Vencimiento en el mes siguiente
      mesVenc = mesInt + 1
      if (mesVenc > 12) {
        mesVenc = 1
        anioVenc = anioInt + 1
      }
    }

    // Crear fecha de vencimiento (mes es 0-indexed en JavaScript)
    fechaVenc = new Date(anioVenc, mesVenc - 1, diaVencimiento)
  }

  const periodo = await req.db.periodo.create({
    data: {
      anio: anioInt,
      mes: mesInt,
      nombre,
      fechaVencimiento: fechaVenc,
      estado: 'PENDIENTE',
    },
  })

  res.status(201).json({ success: true, data: periodo })
}))

// DELETE /api/admin/periodos/:id - Eliminar periodo (solo si no tiene pagos)
router.delete('/periodos/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const periodo = await req.db.periodo.findUnique({
    where: { id: parseInt(id) },
  })

  if (!periodo) {
    throw new AppError('Periodo no encontrado', 404, 'NOT_FOUND')
  }

  // Verificar si hay cuotas pagadas
  const cuotasPagadas = await req.db.cargo.count({
    where: {
      periodoId: periodo.id,
      estado: 'PAGADO',
    },
  })

  if (cuotasPagadas > 0) {
    throw new AppError('No se puede eliminar: hay cuotas pagadas en este periodo', 400, 'HAS_PAYMENTS')
  }

  // Eliminar cuotas pendientes del periodo
  await req.db.cargo.deleteMany({
    where: { periodoId: periodo.id },
  })

  // Eliminar el periodo
  await req.db.periodo.delete({
    where: { id: periodo.id },
  })

  res.json({ success: true, message: 'Periodo eliminado correctamente' })
}))

// POST /api/admin/periodos/:id/generar - Generar cuotas para un periodo
router.post('/periodos/:id/generar', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const periodo = await req.db.periodo.findUnique({
    where: { id: parseInt(id) },
  })

  if (!periodo) {
    throw new AppError('Periodo no encontrado', 404, 'NOT_FOUND')
  }

  // Obtener socios que YA tienen cuota social en este periodo (pueden ser de planes de pago)
  const sociosConCuotaSocial = await req.db.cargo.findMany({
    where: {
      periodoId: periodo.id,
      categoria: 'CUOTA_SOCIAL'
    },
    select: { socioId: true }
  })
  const sociosConCuotaSocialIds = new Set(sociosConCuotaSocial.map(c => c.socioId))

  // Obtener cargos de actividad que YA existen en este periodo (socio + categoriaActividad)
  const cargosActividad = await req.db.cargo.findMany({
    where: {
      periodoId: periodo.id,
      categoria: 'CUOTA_ACTIVIDAD'
    },
    select: { socioId: true, categoriaActividadId: true }
  })
  const actividadesConCargo = new Set(cargosActividad.map(c => `${c.socioId}-${c.categoriaActividadId}`))

  // Obtener socios activos con sus relaciones
  const socios = await req.db.socio.findMany({
    where: { estadoSocioRel: { esSocioActivo: true } },
    include: {
      tipoSocioRel: true,
      categoriaSocioRel: true,
      _count: { select: { miembrosFamilia: true } },
      inscripciones: {
        where: { estado: 'ACTIVA' },
        include: {
          categoriaActividad: {
            include: { actividad: true },
          },
        },
      },
    },
  })

  const cargosACrear = []
  let sociosSaltados = 0
  let inscripcionesSaltadas = 0
  let sociosNoTitulares = 0
  let sociosSinCuotaMensual = 0

  for (const socio of socios) {
    // Calcular descuento por categoria
    const descuentoPct = socio.categoriaSocioRel?.porcentajeDescuento
      ? Number(socio.categoriaSocioRel.porcentajeDescuento)
      : 0

    // Determinar si debe pagar cuota social
    // Solo pagan: Titulares de familia (titularFamiliaId === null y tiene miembros)
    // O socios únicos (no pertenece a ninguna familia)
    const esTitularOUnico = !socio.titularFamiliaId

    // Verificar si ya tiene cuota social en este periodo (puede ser de plan de pagos)
    const yaTeníaCuotaSocial = sociosConCuotaSocialIds.has(socio.id)

    // Contar motivos de exclusión para diagnóstico
    if (!esTitularOUnico) {
      sociosNoTitulares++
    }
    if (!socio.tipoSocioRel?.cuotaMensual) {
      sociosSinCuotaMensual++
    }

    if (esTitularOUnico && socio.tipoSocioRel?.cuotaMensual && !yaTeníaCuotaSocial) {
      const montoBase = Number(socio.tipoSocioRel.cuotaMensual)
      const montoBonificacion = montoBase * (descuentoPct / 100)
      const montoTotal = montoBase - montoBonificacion

      // Determinar tipo de cuota: Grupo Familiar si tiene miembros, sino Socio Único
      const esTitularDeFamilia = (socio._count?.miembrosFamilia || 0) > 0
      const tipoCuota = esTitularDeFamilia ? 'GRUPO_FAMILIAR' : 'SOCIO_UNICO'

      cargosACrear.push({
        periodoId: periodo.id,
        socioId: socio.id,
        grupoFamiliarId: socio.titularFamiliaId || socio.id,
        categoria: 'CUOTA_SOCIAL',
        tipoCuota,
        descripcion: `Cuota Social - ${tipoCuota === 'GRUPO_FAMILIAR' ? 'Grupo Familiar' : 'Socio Único'}`,
        montoOriginal: montoBase,
        montoBonificacion,
        montoTotal,
        estado: 'PENDIENTE',
        fechaVencimiento: periodo.fechaVencimiento,
        origen: 'GENERACION_MASIVA',
        motivoBonificacion: descuentoPct > 0 ? `Descuento por categoría: ${descuentoPct}%` : null,
      })
    } else if (yaTeníaCuotaSocial) {
      sociosSaltados++
    }

    // Cargos por actividades (inscripciones activas)
    for (const inscripcion of socio.inscripciones) {
      // Saltar si está exento de cuota
      if (inscripcion.exentoCuota) continue

      // Verificar si ya tiene cargo para esta categoría de actividad en este periodo
      const claveActividad = `${socio.id}-${inscripcion.categoriaActividadId}`
      if (actividadesConCargo.has(claveActividad)) {
        inscripcionesSaltadas++
        continue
      }

      const categoria = inscripcion.categoriaActividad
      const actividad = categoria.actividad

      // Determinar monto: primero categoría, luego actividad
      let montoBase = categoria.cuotaMensual
        ? Number(categoria.cuotaMensual)
        : (actividad.cuotaMensual ? Number(actividad.cuotaMensual) : 0)

      // Aplicar porcentaje de inscripción si no es 100%
      if (inscripcion.porcentajeCuota && Number(inscripcion.porcentajeCuota) !== 100) {
        montoBase = montoBase * (Number(inscripcion.porcentajeCuota) / 100)
      }

      if (montoBase > 0) {
        const montoBonificacion = montoBase * (descuentoPct / 100)
        const montoTotal = montoBase - montoBonificacion

        cargosACrear.push({
          periodoId: periodo.id,
          socioId: socio.id,
          grupoFamiliarId: socio.titularFamiliaId || socio.id,
          categoria: 'CUOTA_ACTIVIDAD',
          categoriaActividadId: categoria.id,
          descripcion: `${actividad.nombre} - ${categoria.nombre}`,
          montoOriginal: montoBase,
          montoBonificacion,
          montoTotal,
          estado: 'PENDIENTE',
          fechaVencimiento: periodo.fechaVencimiento,
          origen: 'GENERACION_MASIVA',
          motivoBonificacion: descuentoPct > 0 ? `Descuento por categoría: ${descuentoPct}%` : null,
        })
      }
    }
  }

  // Crear todos los cargos en batch
  if (cargosACrear.length > 0) {
    await req.db.cargo.createMany({ data: cargosACrear })
  }

  // Actualizar estado del periodo (solo si se generaron nuevas cuotas o es la primera vez)
  const totalCuotasPeriodo = await req.db.cargo.count({
    where: { periodoId: periodo.id }
  })

  if (totalCuotasPeriodo > 0) {
    await req.db.periodo.update({
      where: { id: periodo.id },
      data: {
        estado: 'GENERADO',
        fechaGeneracion: new Date(),
        generadoPor: req.admin.id,
      },
    })
  }

  // Construir mensaje de respuesta
  let mensaje = ''
  if (cargosACrear.length === 0) {
    if (socios.length === 0) {
      mensaje = 'No hay socios activos para generar cuotas'
    } else if (sociosSaltados > 0 || inscripcionesSaltadas > 0) {
      mensaje = `No se generaron cuotas nuevas. ${sociosSaltados} socios y ${inscripcionesSaltadas} inscripciones ya tenían cuotas en este periodo.`
    } else {
      const detalles = []
      if (sociosNoTitulares > 0) detalles.push(`${sociosNoTitulares} son miembros de familia (no titulares)`)
      if (sociosSinCuotaMensual > 0) detalles.push(`${sociosSinCuotaMensual} tienen tipo de socio sin cuota mensual configurada`)
      mensaje = `No se generaron cuotas. ${socios.length} socios activos encontrados. ${detalles.length > 0 ? detalles.join(', ') + '.' : ''}`
    }
  } else {
    mensaje = `Se generaron ${cargosACrear.length} cuotas para ${socios.length} socios`
    if (sociosSaltados > 0 || inscripcionesSaltadas > 0) {
      mensaje += ` (${sociosSaltados} socios y ${inscripcionesSaltadas} inscripciones ya tenían cuotas)`
    }
  }

  res.json({
    success: true,
    data: {
      cuotasGeneradas: cargosACrear.length,
      sociosProcesados: socios.length,
      sociosSaltados,
      inscripcionesSaltadas,
      sociosNoTitulares,
      sociosSinCuotaMensual,
      mensaje,
    }
  })
}))
// ============================================
// CONFIGURACION DEL SISTEMA
// ============================================

// GET /api/admin/sistema/configuracion - Obtener configuraciones del sistema
router.get('/sistema/configuracion', authAdmin, asyncHandler(async (req, res) => {
  const { modulo } = req.query

  const where = {}
  if (modulo) where.modulo = modulo

  const configuraciones = await req.db.configuracion.findMany({
    where,
    orderBy: [{ modulo: 'asc' }, { clave: 'asc' }],
  })

  res.json({ success: true, data: configuraciones })
}))

// GET /api/admin/sistema/configuracion/:clave - Obtener una configuración
router.get('/sistema/configuracion/:clave', authAdmin, asyncHandler(async (req, res) => {
  const { clave } = req.params

  const config = await req.db.configuracion.findFirst({
    where: { clave },
  })

  if (!config) {
    return res.status(404).json({ success: false, error: { message: 'Configuración no encontrada' } })
  }

  res.json({ success: true, data: config })
}))

// PUT /api/admin/sistema/configuracion/:clave - Actualizar o crear una configuración
router.put('/sistema/configuracion/:clave', authAdmin, asyncHandler(async (req, res) => {
  const { clave } = req.params
  const { valor, tipo, modulo, descripcion } = req.body

  // Verificar si existe y si es editable
  const existing = await req.db.configuracion.findFirst({
    where: { clave },
  })

  if (existing && !existing.editable) {
    return res.status(400).json({ success: false, error: { message: 'Esta configuración no es editable' } })
  }

  // Upsert: actualizar si existe, crear si no
  const updated = await req.db.configuracion.upsert({
    where: { tenantId_clave: { tenantId: req.tenantId, clave } },
    update: { valor: String(valor) },
    create: {
      clave,
      valor: String(valor),
      tipo: tipo || 'STRING',
      modulo: modulo || 'SISTEMA',
      descripcion: descripcion || null,
    },
  })

  res.json({ success: true, data: updated })
}))

// PUT /api/admin/sistema/modo-demo - Actualizar modo demo (shortcut)
router.put('/sistema/modo-demo', authAdmin, asyncHandler(async (req, res) => {
  const { activo, email, whatsappNumero } = req.body

  await req.db.configuracion.upsert({
    where: { tenantId_clave: { tenantId: req.tenantId, clave: 'MODO_DEMO' } },
    update: { valor: activo ? 'true' : 'false' },
    create: { clave: 'MODO_DEMO', valor: activo ? 'true' : 'false', tipo: 'BOOLEAN', modulo: 'SISTEMA', descripcion: 'Modo demo activo' },
  })

  if (email !== undefined) {
    await req.db.configuracion.upsert({
      where: { tenantId_clave: { tenantId: req.tenantId, clave: 'EMAIL_DEMO' } },
      update: { valor: email || '' },
      create: { clave: 'EMAIL_DEMO', valor: email || '', tipo: 'STRING', modulo: 'SISTEMA', descripcion: 'Email de prueba en modo demo' },
    })
  }

  if (whatsappNumero !== undefined) {
    await req.db.configuracion.upsert({
      where: { tenantId_clave: { tenantId: req.tenantId, clave: 'WHATSAPP_DEMO_NUMERO' } },
      update: { valor: whatsappNumero || '' },
      create: { clave: 'WHATSAPP_DEMO_NUMERO', valor: whatsappNumero || '', tipo: 'STRING', modulo: 'SISTEMA', descripcion: 'Número de WhatsApp de prueba en modo demo' },
    })
  }

  res.json({ success: true, data: { activo, email, whatsappNumero } })
}))

// GET /api/admin/sistema/modo-demo - Obtener estado del modo demo
router.get('/sistema/modo-demo', authAdmin, asyncHandler(async (req, res) => {
  const [modoDemo, emailDemo, waDemo] = await Promise.all([
    req.db.configuracion.findFirst({ where: { clave: 'MODO_DEMO' } }),
    req.db.configuracion.findFirst({ where: { clave: 'EMAIL_DEMO' } }),
    req.db.configuracion.findFirst({ where: { clave: 'WHATSAPP_DEMO_NUMERO' } }),
  ])

  res.json({
    success: true,
    data: {
      activo: modoDemo?.valor === 'true',
      email: emailDemo?.valor || '',
      whatsappNumero: waDemo?.valor || '',
    },
  })
}))

// ============================================
// CONFIGURACIÓN DE RECARGOS POR MORA
// ============================================

// GET /api/admin/configuracion-recargo - Obtener configuración de recargo
router.get('/configuracion-recargo', authAdmin, asyncHandler(async (req, res) => {
  const config = await req.db.configuracionRecargo.findFirst({
    where: { activo: true },
  })
  res.json({ success: true, data: config })
}))

// PUT /api/admin/configuracion-recargo - Actualizar configuración de recargo
router.put('/configuracion-recargo', authAdmin, asyncHandler(async (req, res) => {
  const { tipo, porcentaje, cadaDias, topeMaximo } = req.body

  if (!tipo || !['FIJO', 'ACUMULATIVO'].includes(tipo)) {
    throw new AppError('Tipo debe ser FIJO o ACUMULATIVO', 400, 'VALIDATION_ERROR')
  }

  if (porcentaje === undefined || porcentaje < 0) {
    throw new AppError('Porcentaje es requerido y debe ser >= 0', 400, 'VALIDATION_ERROR')
  }

  if (tipo === 'ACUMULATIVO' && (!cadaDias || cadaDias < 1)) {
    throw new AppError('Para tipo ACUMULATIVO, cadaDias es requerido y debe ser >= 1', 400, 'VALIDATION_ERROR')
  }

  // Desactivar configuraciones anteriores
  await req.db.configuracionRecargo.updateMany({
    where: { activo: true },
    data: { activo: false },
  })

  // Crear nueva configuración activa
  const config = await req.db.configuracionRecargo.create({
    data: {
      tipo,
      porcentaje: parseFloat(porcentaje),
      cadaDias: tipo === 'ACUMULATIVO' ? parseInt(cadaDias) : null,
      topeMaximo: topeMaximo ? parseFloat(topeMaximo) : null,
      activo: true,
    },
  })

  res.json({ success: true, data: config })
}))

// GET /api/admin/configuracion-descuento-anticipado
router.get('/configuracion-descuento-anticipado', authAdmin, asyncHandler(async (req, res) => {
  const claves = ['DESCUENTO_ANTICIPADO_ACTIVO', 'DESCUENTO_ANTICIPADO_PCT', 'DESCUENTO_ANTICIPADO_DIAS']
  const configs = await req.db.configuracion.findMany({ where: { clave: { in: claves } } })
  const map = Object.fromEntries(configs.map(c => [c.clave, c.valor]))
  res.json({
    success: true,
    data: {
      activo: map['DESCUENTO_ANTICIPADO_ACTIVO'] === 'true',
      porcentaje: parseFloat(map['DESCUENTO_ANTICIPADO_PCT'] || '0'),
      diasAnticipacion: parseInt(map['DESCUENTO_ANTICIPADO_DIAS'] || '0'),
    }
  })
}))

// PUT /api/admin/configuracion-descuento-anticipado
router.put('/configuracion-descuento-anticipado', authAdmin, asyncHandler(async (req, res) => {
  const { activo, porcentaje, diasAnticipacion } = req.body
  const updates = [
    { clave: 'DESCUENTO_ANTICIPADO_ACTIVO', valor: activo ? 'true' : 'false' },
    { clave: 'DESCUENTO_ANTICIPADO_PCT', valor: String(parseFloat(porcentaje) || 0) },
    { clave: 'DESCUENTO_ANTICIPADO_DIAS', valor: String(parseInt(diasAnticipacion) || 0) },
  ]
  for (const { clave, valor } of updates) {
    await req.db.configuracion.upsert({
      where: { tenantId_clave: { tenantId: req.tenantId, clave } },
      update: { valor },
      create: { clave, valor, tenantId: req.tenantId },
    })
  }
  res.json({ success: true })
}))

// GET /api/admin/configuracion-baja-asistencia
router.get('/configuracion-baja-asistencia', authAdmin, asyncHandler(async (req, res) => {
  const claves = ['ALERTA_BAJA_ASISTENCIA_ACTIVO', 'ALERTA_BAJA_ASISTENCIA_PCT', 'ALERTA_BAJA_ASISTENCIA_DIAS']
  const configs = await req.db.configuracion.findMany({ where: { clave: { in: claves } } })
  const map = Object.fromEntries(configs.map(c => [c.clave, c.valor]))
  res.json({
    success: true,
    data: {
      activo: map['ALERTA_BAJA_ASISTENCIA_ACTIVO'] === 'true',
      umbralPct: parseInt(map['ALERTA_BAJA_ASISTENCIA_PCT'] || '50'),
      diasVentana: parseInt(map['ALERTA_BAJA_ASISTENCIA_DIAS'] || '30'),
    }
  })
}))

// PUT /api/admin/configuracion-baja-asistencia
router.put('/configuracion-baja-asistencia', authAdmin, asyncHandler(async (req, res) => {
  const { activo, umbralPct, diasVentana } = req.body
  const updates = [
    { clave: 'ALERTA_BAJA_ASISTENCIA_ACTIVO', valor: activo ? 'true' : 'false' },
    { clave: 'ALERTA_BAJA_ASISTENCIA_PCT', valor: String(parseInt(umbralPct) || 50) },
    { clave: 'ALERTA_BAJA_ASISTENCIA_DIAS', valor: String(parseInt(diasVentana) || 30) },
  ]
  for (const { clave, valor } of updates) {
    await req.db.configuracion.upsert({
      where: { tenantId_clave: { tenantId: req.tenantId, clave } },
      update: { valor },
      create: { clave, valor, tenantId: req.tenantId },
    })
  }
  res.json({ success: true })
}))

// GET /api/admin/configuracion-cumpleanios
router.get('/configuracion-cumpleanios', authAdmin, asyncHandler(async (req, res) => {
  const claves = ['CUMPLEANIOS_ACTIVO', 'CUMPLEANIOS_MENSAJE']
  const configs = await req.db.configuracion.findMany({ where: { clave: { in: claves } } })
  const map = Object.fromEntries(configs.map(c => [c.clave, c.valor]))
  res.json({
    success: true,
    data: {
      activo: map['CUMPLEANIOS_ACTIVO'] === 'true',
      mensaje: map['CUMPLEANIOS_MENSAJE'] || 'Feliz cumpleaños, {nombre}! El club te desea un excelente día.',
    }
  })
}))

// PUT /api/admin/configuracion-cumpleanios
router.put('/configuracion-cumpleanios', authAdmin, asyncHandler(async (req, res) => {
  const { activo, mensaje } = req.body
  const updates = [
    { clave: 'CUMPLEANIOS_ACTIVO', valor: activo ? 'true' : 'false' },
    { clave: 'CUMPLEANIOS_MENSAJE', valor: mensaje || 'Feliz cumpleaños, {nombre}! El club te desea un excelente día.' },
  ]
  for (const { clave, valor } of updates) {
    await req.db.configuracion.upsert({
      where: { tenantId_clave: { tenantId: req.tenantId, clave } },
      update: { valor },
      create: { clave, valor, tenantId: req.tenantId },
    })
  }
  res.json({ success: true })
}))

// Función para calcular recargo de un cargo
async function calcularRecargoCargo(prisma, cargo) {
  if (!cargo.fechaVencimiento || cargo.estado !== 'PENDIENTE') {
    return { recargo: 0, porcentaje: 0, diasMora: 0 }
  }

  const hoy = new Date()
  const vencimiento = new Date(cargo.fechaVencimiento)
  const diasMora = Math.floor((hoy - vencimiento) / (1000 * 60 * 60 * 24))

  if (diasMora <= 0) {
    return { recargo: 0, porcentaje: 0, diasMora: 0 }
  }

  const config = await prisma.configuracionRecargo.findFirst({
    where: { activo: true },
  })

  if (!config || Number(config.porcentaje) === 0) {
    return { recargo: 0, porcentaje: 0, diasMora }
  }

  let porcentajeRecargo = 0

  if (config.tipo === 'FIJO') {
    porcentajeRecargo = Number(config.porcentaje)
  } else {
    // ACUMULATIVO: porcentaje × (diasMora / cadaDias)
    const periodos = Math.floor(diasMora / config.cadaDias)
    porcentajeRecargo = periodos * Number(config.porcentaje)

    // Aplicar tope máximo si está definido
    if (config.topeMaximo && porcentajeRecargo > Number(config.topeMaximo)) {
      porcentajeRecargo = Number(config.topeMaximo)
    }
  }

  const montoOriginal = Number(cargo.montoOriginal)
  const recargo = Math.round(montoOriginal * porcentajeRecargo / 100)

  return { recargo, porcentaje: porcentajeRecargo, diasMora }
}

// GET /api/admin/cargos/:id/recargo - Calcular recargo de un cargo
router.get('/cargos/:id/recargo', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const cargo = await req.db.cargo.findUnique({
    where: { id: parseInt(id) },
  })

  if (!cargo) {
    throw new AppError('Cargo no encontrado', 404, 'NOT_FOUND')
  }

  const resultado = await calcularRecargoCargo(req.db, cargo)
  res.json({ success: true, data: resultado })
}))

// ============================================
// CONFIGURACIÓN FISCAL
// ============================================

// GET /api/admin/configuracion/fiscal - Obtener configuración fiscal/AFIP
router.get('/configuracion/fiscal', authAdmin, asyncHandler(async (req, res) => {
  // TODO: Implementar modelo ConfiguracionFiscal en Prisma
  // Por ahora devolver null para que no falle el frontend
  res.json({ success: true, data: null })
}))

// POST /api/admin/sistema/smtp/test - Testear conexión SMTP del tenant
router.post('/sistema/smtp/test', authAdmin, asyncHandler(async (req, res) => {
  const { getMailConfig } = await import('../../services/email.js')

  // Verificar primero si el tenant tiene configuración propia cargada
  const cfgItems = await req.db.configuracion.findMany({
    where: { clave: { in: ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'] } }
  })
  const cfg = Object.fromEntries(cfgItems.map(c => [c.clave, c.valor]))
  const usandoFallback = !cfg.SMTP_HOST || !cfg.SMTP_USER

  let transporter, from
  try {
    const mc = await getMailConfig(req.db)
    transporter = mc.transporter
    from = mc.from
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: `No se pudo construir la configuración SMTP: ${err.message}`,
      usandoFallback,
    })
  }

  try {
    await transporter.verify()
    res.json({
      success: true,
      message: usandoFallback
        ? 'Conexión SMTP exitosa (usando configuración global del servidor — el tenant no tiene SMTP propio cargado)'
        : 'Conexión SMTP exitosa',
      from,
      usandoFallback,
    })
  } catch (err) {
    // Diagnóstico amigable según el código de error de nodemailer
    let diagnostico = ''
    if (err.code === 'EAUTH') {
      diagnostico = ' Credenciales rechazadas: revisá usuario y contraseña. Si es Gmail, generá una "App Password" desde myaccount.google.com/apppasswords (requiere 2FA habilitado).'
    } else if (err.code === 'ECONNECTION' || err.code === 'ENOTFOUND') {
      diagnostico = ' No se pudo conectar al servidor: revisá el host y que la red permita salida al puerto SMTP.'
    } else if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKET') {
      diagnostico = ' Timeout o socket cerrado: el host no responde o el puerto está bloqueado por firewall.'
    } else if (err.code === 'EENVELOPE') {
      diagnostico = ' El servidor rechazó el remitente: revisá SMTP_FROM.'
    } else if (/wrong version|ssl|tls/i.test(err.message)) {
      diagnostico = ' Mismatch SSL/TLS: si el puerto es 465 marcá Secure=true, si es 587 marcá Secure=false.'
    }

    res.status(400).json({
      success: false,
      message: `Error SMTP (${err.code || 'desconocido'}): ${err.message}.${diagnostico}`,
      code: err.code || null,
      usandoFallback,
    })
  }
}))

// ============================================================================
// CRONS DEL SISTEMA - listado y switches individuales
// ============================================================================

// GET /api/admin/sistema/crons - Listar todos los crons con su estado para el tenant
router.get('/sistema/crons', authAdmin, asyncHandler(async (req, res) => {
  const { CRONS_CATALOGO } = await import('../../lib/cronsCatalogo.js')

  // Master pause
  const master = await req.db.configuracion.findFirst({ where: { clave: 'CRONS_PAUSADOS' }, select: { valor: true } })
  const masterPausado = master?.valor === 'true'

  // Cargar configs individuales
  const configKeys = CRONS_CATALOGO.map(c => c.configKey)
  const cfgs = await req.db.configuracion.findMany({
    where: { clave: { in: configKeys } },
    select: { clave: true, valor: true },
  })
  const cfgMap = Object.fromEntries(cfgs.map(c => [c.clave, c.valor]))

  const items = CRONS_CATALOGO.map(c => {
    const valor = cfgMap[c.configKey]
    const activoIndividual = valor != null ? valor === 'true' : c.defaultActivo
    return {
      key: c.key,
      label: c.label,
      descripcion: c.descripcion,
      horario: c.horario,
      configKey: c.configKey,
      activoIndividual,
      activoEfectivo: !masterPausado && activoIndividual,
    }
  })

  res.json({ success: true, data: { masterPausado, crons: items } })
}))

// PUT /api/admin/sistema/crons/:cronKey - Activar/desactivar un cron específico
router.put('/sistema/crons/:cronKey', authAdmin, asyncHandler(async (req, res) => {
  const { CRONS_CATALOGO } = await import('../../lib/cronsCatalogo.js')
  const { cronKey } = req.params
  const { activo } = req.body

  const cron = CRONS_CATALOGO.find(c => c.key === cronKey)
  if (!cron) return res.status(404).json({ success: false, error: { message: 'Cron no encontrado' } })
  if (typeof activo !== 'boolean') {
    return res.status(400).json({ success: false, error: { message: 'activo (boolean) requerido' } })
  }

  await req.db.configuracion.upsert({
    where: { tenantId_clave: { tenantId: req.tenantId, clave: cron.configKey } },
    update: { valor: activo ? 'true' : 'false' },
    create: {
      clave: cron.configKey,
      valor: activo ? 'true' : 'false',
      tipo: 'BOOLEAN',
      modulo: 'CRONS',
      descripcion: cron.label,
    },
  })

  res.json({ success: true, data: { cronKey, activo } })
}))

// POST /api/admin/sistema/crons/:cronKey/test - Disparar el cron manualmente (limitado)
// Body: { limit: 5, canales: ['email','whatsapp'] }
router.post('/sistema/crons/:cronKey/test', authAdmin, asyncHandler(async (req, res) => {
  const { cronKey } = req.params
  const { limit = 5, canales = ['email', 'whatsapp'] } = req.body || {}
  const { CRONS_CATALOGO } = await import('../../lib/cronsCatalogo.js')
  const cron = CRONS_CATALOGO.find(c => c.key === cronKey)
  if (!cron) return res.status(404).json({ success: false, error: { message: 'Cron no encontrado' } })

  const max = Math.min(parseInt(limit) || 5, 20)
  const enviarEmail_ = canales.includes('email')
  const enviarWA_ = canales.includes('whatsapp')

  if (!enviarEmail_ && !enviarWA_) {
    return res.status(400).json({ success: false, error: { message: 'Debe seleccionar al menos un canal' } })
  }

  const { enviarEmail } = await import('../../services/email.js')
  const { enviarWhatsApp, obtenerTelefonoSocio } = await import('../../services/whatsappService.js')

  // 1) Resolver socios afectados según el cron
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const inicio = (n) => { const d = new Date(hoy); d.setDate(d.getDate() + n); return d }
  const fin = (n) => { const d = inicio(n); d.setHours(23, 59, 59, 999); return d }

  let registros = []

  switch (cronKey) {
    case 'CUOTAS_PROXIMAS': {
      const cfgDias = await req.db.configuracion.findFirst({ where: { clave: 'CUOTAS_PROXIMAS_DIAS' } })
      const dias = parseInt(cfgDias?.valor || '5')
      const cargos = await req.db.cargo.findMany({
        where: { estado: 'PENDIENTE', fechaVencimiento: { gte: inicio(dias), lte: fin(dias) }, socioId: { not: null } },
        include: { socio: true },
        take: max,
      })
      registros = cargos.map(c => ({
        socio: c.socio,
        asunto: `Recordatorio: tu cuota vence en ${dias} días`,
        html: `<p>Hola ${c.socio.apellidoNombre}, tu cuota <strong>${c.descripcion || '#' + c.id}</strong> por $${Number(c.montoTotal).toLocaleString('es-AR')} vence el ${new Date(c.fechaVencimiento).toLocaleDateString('es-AR')}.</p>`,
        wa: `Hola ${c.socio.apellidoNombre.split(',')[0]}, recordá que tu cuota vence el ${new Date(c.fechaVencimiento).toLocaleDateString('es-AR')} por $${Number(c.montoTotal).toLocaleString('es-AR')}.`,
      }))
      break
    }
    case 'CUOTAS_VENCIDAS': {
      const cargos = await req.db.cargo.findMany({
        where: { estado: 'PENDIENTE', fechaVencimiento: { gte: hoy, lt: inicio(1) }, socioId: { not: null } },
        include: { socio: true },
        take: max,
      })
      registros = cargos.map(c => ({
        socio: c.socio,
        asunto: `Tu cuota vence hoy`,
        html: `<p>Hola ${c.socio.apellidoNombre}, tu cuota <strong>${c.descripcion || '#' + c.id}</strong> por $${Number(c.montoTotal).toLocaleString('es-AR')} vence hoy.</p>`,
        wa: `Hola ${c.socio.apellidoNombre.split(',')[0]}, tu cuota vence HOY por $${Number(c.montoTotal).toLocaleString('es-AR')}.`,
      }))
      break
    }
    case 'MOROSIDAD_RECORDATORIO': {
      const hace15 = new Date(); hace15.setDate(hace15.getDate() - 15)
      const socios = await req.db.socio.findMany({
        where: {
          estadoSocioRel: { esSocioActivo: true },
          cargos: { some: { estado: 'PENDIENTE', fechaVencimiento: { lt: hace15 } } },
        },
        include: { cargos: { where: { estado: 'PENDIENTE', fechaVencimiento: { lt: new Date() } } } },
        take: max,
      })
      registros = socios.map(s => {
        const total = s.cargos.reduce((sum, c) => sum + Number(c.montoTotal), 0)
        return {
          socio: s,
          asunto: `Recordatorio: tenés cuotas vencidas`,
          html: `<p>Hola ${s.apellidoNombre}, tenés ${s.cargos.length} cuota(s) vencida(s) por un total de $${total.toLocaleString('es-AR')}. Por favor regularizá tu situación.</p>`,
          wa: `Hola ${s.apellidoNombre.split(',')[0]}, tenés ${s.cargos.length} cuota(s) vencida(s) por $${total.toLocaleString('es-AR')}. Regularizá tu situación.`,
        }
      })
      break
    }
    case 'CUMPLEANIOS': {
      const mes = hoy.getMonth() + 1
      const dia = hoy.getDate()
      const socios = await req.db.socio.findMany({
        where: { estadoSocioRel: { esSocioActivo: true }, fechaNacimiento: { not: null } },
        take: 100,
      })
      const cumple = socios.filter(s => {
        const fn = new Date(s.fechaNacimiento)
        return fn.getMonth() + 1 === mes && fn.getDate() === dia
      }).slice(0, max)
      const cfgMensaje = await req.db.configuracion.findFirst({ where: { clave: 'CUMPLEANIOS_MENSAJE' } })
      const tpl = cfgMensaje?.valor || 'Feliz cumpleaños, {nombre}! El club te desea un excelente día.'
      registros = cumple.map(s => {
        const nombre = (s.nombre || s.apellidoNombre.split(',').pop() || '').trim()
        const msg = tpl.replace(/\{nombre\}/g, nombre)
        return {
          socio: s,
          asunto: `Feliz cumpleaños!`,
          html: `<p>${msg}</p>`,
          wa: msg,
        }
      })
      break
    }
    case 'VIGENCIA_NOTIFICACION': {
      const socios = await req.db.socio.findMany({
        where: { estadoSocioRel: { rolVigencia: 'BLOQUEADO' } },
        take: max,
      })
      registros = socios.map(s => ({
        socio: s,
        asunto: `Tu acceso al club está restringido`,
        html: `<p>Hola ${s.apellidoNombre}, te informamos que tu acceso al club está temporalmente restringido por cuotas pendientes. Por favor contactanos para regularizar.</p>`,
        wa: `Hola ${s.apellidoNombre.split(',')[0]}, tu acceso al club está restringido por cuotas pendientes. Comunicate con secretaría.`,
      }))
      break
    }
    default:
      return res.status(400).json({
        success: false,
        error: { message: `El cron "${cronKey}" no soporta ejecución de test individual (es un proceso interno, no envía mensajes por socio).` }
      })
  }

  if (registros.length === 0) {
    return res.json({ success: true, data: { enviados: [], total: 0, mensaje: 'No se encontraron socios afectados por este cron en este momento.' } })
  }

  // 2) Enviar a cada uno
  const enviados = []
  for (const r of registros) {
    const item = {
      socioId: r.socio.id,
      nroSocio: r.socio.nroSocio,
      nombre: r.socio.apellidoNombre,
      email: { intentado: false, ok: false, motivo: null },
      whatsapp: { intentado: false, ok: false, motivo: null },
    }
    if (enviarEmail_) {
      item.email.intentado = true
      if (!r.socio.email) {
        item.email.motivo = 'Sin email'
      } else {
        try {
          await enviarEmail({ to: r.socio.email, subject: r.asunto, html: r.html, db: req.db })
          item.email.ok = true
        } catch (e) {
          item.email.motivo = e.message
        }
      }
    }
    if (enviarWA_) {
      item.whatsapp.intentado = true
      const tel = obtenerTelefonoSocio(r.socio)
      if (!tel) {
        item.whatsapp.motivo = 'Sin teléfono'
      } else {
        try {
          const resWA = await enviarWhatsApp({ db: req.db, telefono: tel, texto: r.wa, ignorarHorario: true })
          item.whatsapp.ok = resWA?.enviado === true
          if (!item.whatsapp.ok) item.whatsapp.motivo = resWA?.motivo || 'No enviado'
        } catch (e) {
          item.whatsapp.motivo = e.message
        }
      }
    }
    enviados.push(item)
  }

  res.json({ success: true, data: { total: enviados.length, enviados } })
}))

export default router
