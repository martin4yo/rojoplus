import { Router } from 'express'
import { asyncHandler, AppError } from '../../middleware/errorHandler.js'
import { authAdmin } from '../../middleware/auth.js'

const router = Router()

// ACTIVIDADES Y CATEGORÍAS DE ACTIVIDAD
// ============================================================================

// GET /api/admin/actividades - Listado de actividades con sus categorías
router.get('/actividades', authAdmin, asyncHandler(async (req, res) => {
  const { activo } = req.query
  const where = activo !== undefined ? { activo: activo === 'true' } : {}

  const actividades = await req.req.db.actividad.findMany({
    where,
    include: {
      categorias: {
        orderBy: { orden: 'asc' },
      },
      _count: {
        select: { categorias: true }
      }
    },
    orderBy: { orden: 'asc' },
  })

  res.json({
    success: true,
    data: actividades.map(a => ({
      ...a,
      cuotaMensual: a.cuotaMensual ? Number(a.cuotaMensual) : null,
      cantidadCategorias: a._count.categorias,
      categorias: a.categorias.map(c => ({
        ...c,
        cuotaMensual: c.cuotaMensual ? Number(c.cuotaMensual) : null,
      })),
    })),
  })
}))

// GET /api/admin/actividades/:id - Detalle de actividad
router.get('/actividades/:id', authAdmin, asyncHandler(async (req, res) => {
  const { soloActivas } = req.query
  const actividad = await req.req.db.actividad.findUnique({
    where: { id: parseInt(req.params.id) },
    include: {
      categorias: {
        where: soloActivas === 'true' ? { activo: true } : {},
        orderBy: { orden: 'asc' },
        include: {
          _count: { select: { inscripciones: { where: { estado: 'ACTIVA' } } } }
        }
      },
    },
  })

  if (!actividad) throw new AppError('Actividad no encontrada', 404, 'NOT_FOUND')

  res.json({
    success: true,
    data: {
      ...actividad,
      cuotaMensual: actividad.cuotaMensual ? Number(actividad.cuotaMensual) : null,
      categorias: actividad.categorias.map(c => ({
        ...c,
        cuotaMensual: c.cuotaMensual ? Number(c.cuotaMensual) : null,
        inscriptosActivos: c._count.inscripciones,
      })),
    },
  })
}))

// POST /api/admin/actividades - Crear actividad
router.post('/actividades', authAdmin, asyncHandler(async (req, res) => {
  const { codigo, nombre, descripcion, requiereAptaFisica, cuotaMensual, color, orden } = req.body

  if (!codigo || !nombre) {
    throw new AppError('Código y nombre son requeridos', 400, 'VALIDATION_ERROR')
  }

  const existente = await req.req.db.actividad.findUnique({ where: { codigo } })
  if (existente) throw new AppError('Ya existe una actividad con ese código', 400, 'DUPLICATE')

  const actividad = await req.req.db.actividad.create({
    data: {
      codigo,
      nombre,
      descripcion,
      requiereAptaFisica: requiereAptaFisica ?? true,
      cuotaMensual: cuotaMensual ? parseFloat(cuotaMensual) : null,
      color,
      orden: orden || 0,
    },
  })

  res.status(201).json({
    success: true,
    data: { ...actividad, cuotaMensual: actividad.cuotaMensual ? Number(actividad.cuotaMensual) : null }
  })
}))

// PUT /api/admin/actividades/:id - Actualizar actividad
router.put('/actividades/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { codigo, nombre, descripcion, requiereAptaFisica, cuotaMensual, color, orden, activo } = req.body

  const existente = await req.req.db.actividad.findUnique({ where: { id: parseInt(id) } })
  if (!existente) throw new AppError('Actividad no encontrada', 404, 'NOT_FOUND')

  if (codigo && codigo !== existente.codigo) {
    const duplicado = await req.req.db.actividad.findUnique({ where: { codigo } })
    if (duplicado) throw new AppError('Ya existe una actividad con ese código', 400, 'DUPLICATE')
  }

  const actividad = await req.req.db.actividad.update({
    where: { id: parseInt(id) },
    data: {
      codigo: codigo ?? existente.codigo,
      nombre: nombre ?? existente.nombre,
      descripcion: descripcion !== undefined ? descripcion : existente.descripcion,
      requiereAptaFisica: requiereAptaFisica !== undefined ? requiereAptaFisica : existente.requiereAptaFisica,
      cuotaMensual: cuotaMensual !== undefined ? (cuotaMensual ? parseFloat(cuotaMensual) : null) : existente.cuotaMensual,
      color: color !== undefined ? color : existente.color,
      orden: orden !== undefined ? orden : existente.orden,
      activo: activo !== undefined ? activo : existente.activo,
    },
  })

  res.json({
    success: true,
    data: { ...actividad, cuotaMensual: actividad.cuotaMensual ? Number(actividad.cuotaMensual) : null }
  })
}))

// DELETE /api/admin/actividades/:id - Eliminar actividad
router.delete('/actividades/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const categoriasCount = await req.prisma.categoriaActividad.count({
    where: { actividadId: parseInt(id) },
  })

  if (categoriasCount > 0) {
    throw new AppError(`No se puede eliminar, tiene ${categoriasCount} categoría(s) asociadas`, 400, 'HAS_RELATIONS')
  }

  await req.req.db.actividad.delete({ where: { id: parseInt(id) } })
  res.json({ success: true, data: { mensaje: 'Actividad eliminada' } })
}))

// --- CATEGORÍAS DE ACTIVIDAD ---

// GET /api/admin/categorias-actividad - Listado de categorías
router.get('/categorias-actividad', authAdmin, asyncHandler(async (req, res) => {
  const { actividadId, activo } = req.query
  const where = {}
  if (actividadId) where.actividadId = parseInt(actividadId)
  if (activo !== undefined) where.activo = activo === 'true'

  const categorias = await req.prisma.categoriaActividad.findMany({
    where,
    include: {
      actividad: { select: { id: true, codigo: true, nombre: true, cuotaMensual: true } },
      _count: { select: { inscripciones: { where: { estado: 'ACTIVA' } } } }
    },
    orderBy: [{ actividad: { orden: 'asc' } }, { orden: 'asc' }],
  })

  res.json({
    success: true,
    data: categorias.map(c => ({
      ...c,
      cuotaMensual: c.cuotaMensual ? Number(c.cuotaMensual) : null,
      cuotaEfectiva: c.cuotaMensual ? Number(c.cuotaMensual) : (c.actividad.cuotaMensual ? Number(c.actividad.cuotaMensual) : null),
      actividad: { ...c.actividad, cuotaMensual: c.actividad.cuotaMensual ? Number(c.actividad.cuotaMensual) : null },
      inscriptosActivos: c._count.inscripciones,
    })),
  })
}))

// GET /api/admin/categorias-actividad/:id - Detalle de categoría
router.get('/categorias-actividad/:id', authAdmin, asyncHandler(async (req, res) => {
  const categoria = await req.prisma.categoriaActividad.findUnique({
    where: { id: parseInt(req.params.id) },
    include: {
      actividad: { select: { id: true, codigo: true, nombre: true, cuotaMensual: true } },
      inscripciones: {
        where: { estado: 'ACTIVA' },
        include: { socio: { select: { id: true, nroSocio: true, apellidoNombre: true } } },
        orderBy: { socio: { apellidoNombre: 'asc' } },
      },
    },
  })

  if (!categoria) throw new AppError('Categoría no encontrada', 404, 'NOT_FOUND')

  res.json({
    success: true,
    data: {
      ...categoria,
      cuotaMensual: categoria.cuotaMensual ? Number(categoria.cuotaMensual) : null,
      cuotaEfectiva: categoria.cuotaMensual ? Number(categoria.cuotaMensual) : (categoria.actividad.cuotaMensual ? Number(categoria.actividad.cuotaMensual) : null),
      actividad: { ...categoria.actividad, cuotaMensual: categoria.actividad.cuotaMensual ? Number(categoria.actividad.cuotaMensual) : null },
    },
  })
}))

// POST /api/admin/categorias-actividad - Crear categoría
router.post('/categorias-actividad', authAdmin, asyncHandler(async (req, res) => {
  const {
    actividadId, codigo, nombre, descripcion, edadMinima, edadMaxima, sexo,
    cuotaMensual, diasEntrenamiento, horarioEntrenamiento, lugarEntrenamiento,
    cupoMaximo, orden
  } = req.body

  if (!actividadId || !codigo || !nombre) {
    throw new AppError('Actividad, código y nombre son requeridos', 400, 'VALIDATION_ERROR')
  }

  const existente = await req.prisma.categoriaActividad.findUnique({ where: { codigo } })
  if (existente) throw new AppError('Ya existe una categoría con ese código', 400, 'DUPLICATE')

  const actividad = await req.req.db.actividad.findUnique({ where: { id: parseInt(actividadId) } })
  if (!actividad) throw new AppError('Actividad no encontrada', 404, 'NOT_FOUND')

  const categoria = await req.prisma.categoriaActividad.create({
    data: {
      actividadId: parseInt(actividadId),
      codigo,
      nombre,
      descripcion,
      edadMinima: edadMinima ? parseInt(edadMinima) : null,
      edadMaxima: edadMaxima ? parseInt(edadMaxima) : null,
      sexo,
      cuotaMensual: cuotaMensual ? parseFloat(cuotaMensual) : null,
      diasEntrenamiento,
      horarioEntrenamiento,
      lugarEntrenamiento,
      cupoMaximo: cupoMaximo ? parseInt(cupoMaximo) : null,
      orden: orden || 0,
    },
    include: { actividad: { select: { id: true, codigo: true, nombre: true, cuotaMensual: true } } },
  })

  res.status(201).json({
    success: true,
    data: {
      ...categoria,
      cuotaMensual: categoria.cuotaMensual ? Number(categoria.cuotaMensual) : null,
      cuotaEfectiva: categoria.cuotaMensual ? Number(categoria.cuotaMensual) : (categoria.actividad.cuotaMensual ? Number(categoria.actividad.cuotaMensual) : null),
      actividad: { ...categoria.actividad, cuotaMensual: categoria.actividad.cuotaMensual ? Number(categoria.actividad.cuotaMensual) : null },
    },
  })
}))

// PUT /api/admin/categorias-actividad/:id - Actualizar categoría
router.put('/categorias-actividad/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const {
    actividadId, codigo, nombre, descripcion, edadMinima, edadMaxima, sexo,
    cuotaMensual, diasEntrenamiento, horarioEntrenamiento, lugarEntrenamiento,
    cupoMaximo, orden, activo
  } = req.body

  const existente = await req.prisma.categoriaActividad.findUnique({ where: { id: parseInt(id) } })
  if (!existente) throw new AppError('Categoría no encontrada', 404, 'NOT_FOUND')

  if (codigo && codigo !== existente.codigo) {
    const duplicado = await req.prisma.categoriaActividad.findUnique({ where: { codigo } })
    if (duplicado) throw new AppError('Ya existe una categoría con ese código', 400, 'DUPLICATE')
  }

  const categoria = await req.prisma.categoriaActividad.update({
    where: { id: parseInt(id) },
    data: {
      actividadId: actividadId ? parseInt(actividadId) : existente.actividadId,
      codigo: codigo ?? existente.codigo,
      nombre: nombre ?? existente.nombre,
      descripcion: descripcion !== undefined ? descripcion : existente.descripcion,
      edadMinima: edadMinima !== undefined ? (edadMinima ? parseInt(edadMinima) : null) : existente.edadMinima,
      edadMaxima: edadMaxima !== undefined ? (edadMaxima ? parseInt(edadMaxima) : null) : existente.edadMaxima,
      sexo: sexo !== undefined ? sexo : existente.sexo,
      cuotaMensual: cuotaMensual !== undefined ? (cuotaMensual ? parseFloat(cuotaMensual) : null) : existente.cuotaMensual,
      diasEntrenamiento: diasEntrenamiento !== undefined ? diasEntrenamiento : existente.diasEntrenamiento,
      horarioEntrenamiento: horarioEntrenamiento !== undefined ? horarioEntrenamiento : existente.horarioEntrenamiento,
      lugarEntrenamiento: lugarEntrenamiento !== undefined ? lugarEntrenamiento : existente.lugarEntrenamiento,
      cupoMaximo: cupoMaximo !== undefined ? (cupoMaximo ? parseInt(cupoMaximo) : null) : existente.cupoMaximo,
      orden: orden !== undefined ? orden : existente.orden,
      activo: activo !== undefined ? activo : existente.activo,
    },
    include: { actividad: { select: { id: true, codigo: true, nombre: true, cuotaMensual: true } } },
  })

  res.json({
    success: true,
    data: {
      ...categoria,
      cuotaMensual: categoria.cuotaMensual ? Number(categoria.cuotaMensual) : null,
      cuotaEfectiva: categoria.cuotaMensual ? Number(categoria.cuotaMensual) : (categoria.actividad.cuotaMensual ? Number(categoria.actividad.cuotaMensual) : null),
      actividad: { ...categoria.actividad, cuotaMensual: categoria.actividad.cuotaMensual ? Number(categoria.actividad.cuotaMensual) : null },
    },
  })
}))

// DELETE /api/admin/categorias-actividad/:id - Eliminar categoría
router.delete('/categorias-actividad/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const inscripcionesCount = await req.req.db.inscripcion.count({
    where: { categoriaActividadId: parseInt(id) },
  })

  if (inscripcionesCount > 0) {
    throw new AppError(`No se puede eliminar, tiene ${inscripcionesCount} inscripción(es)`, 400, 'HAS_RELATIONS')
  }

  await req.prisma.categoriaActividad.delete({ where: { id: parseInt(id) } })
  res.json({ success: true, data: { mensaje: 'Categoría eliminada' } })
}))

export default router
