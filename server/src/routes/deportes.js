import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { authAdmin } from '../middleware/auth.js'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { notificarNuevoEntrenamiento } from '../services/notificacionService.js'

const router = Router()
const prisma = new PrismaClient()

// Todas las rutas requieren autenticacion de admin
router.use(authAdmin)

// =============================================================================
// TIPOS DE ESPACIO (Configuracion)
// =============================================================================

// GET /api/admin/tipos-espacio - Listar tipos de espacio
router.get('/tipos-espacio', asyncHandler(async (req, res) => {
  const { activo } = req.query

  const where = {}
  if (activo !== undefined) where.activo = activo === 'true'

  const tipos = await prisma.tipoEspacio.findMany({
    where,
    orderBy: { orden: 'asc' },
    include: {
      _count: {
        select: { espacios: true }
      }
    }
  })

  res.json({ success: true, data: tipos })
}))

// GET /api/admin/tipos-espacio/:id - Detalle de tipo
router.get('/tipos-espacio/:id', asyncHandler(async (req, res) => {
  const { id } = req.params

  const tipo = await prisma.tipoEspacio.findUnique({
    where: { id: parseInt(id) },
    include: {
      _count: {
        select: { espacios: true }
      }
    }
  })

  if (!tipo) {
    throw new AppError('Tipo de espacio no encontrado', 404)
  }

  res.json({ success: true, data: tipo })
}))

// POST /api/admin/tipos-espacio - Crear tipo
router.post('/tipos-espacio', asyncHandler(async (req, res) => {
  const { codigo, nombre, descripcion, orden } = req.body

  if (!codigo || !nombre) {
    throw new AppError('Codigo y nombre son requeridos', 400)
  }

  // Verificar codigo unico
  const existente = await prisma.tipoEspacio.findUnique({ where: { codigo } })
  if (existente) {
    throw new AppError('Ya existe un tipo con ese codigo', 400)
  }

  // Si no se especifica orden, poner al final
  let ordenFinal = orden
  if (ordenFinal === undefined) {
    const ultimo = await prisma.tipoEspacio.findFirst({ orderBy: { orden: 'desc' } })
    ordenFinal = (ultimo?.orden || 0) + 1
  }

  const tipo = await prisma.tipoEspacio.create({
    data: {
      codigo: codigo.toUpperCase(),
      nombre,
      descripcion: descripcion || null,
      orden: ordenFinal
    }
  })

  res.status(201).json({ success: true, data: tipo })
}))

// PUT /api/admin/tipos-espacio/:id - Actualizar tipo
router.put('/tipos-espacio/:id', asyncHandler(async (req, res) => {
  const { id } = req.params
  const { codigo, nombre, descripcion, orden, activo } = req.body

  const existente = await prisma.tipoEspacio.findUnique({ where: { id: parseInt(id) } })
  if (!existente) {
    throw new AppError('Tipo de espacio no encontrado', 404)
  }

  // Verificar codigo unico si cambio
  if (codigo && codigo !== existente.codigo) {
    const duplicado = await prisma.tipoEspacio.findUnique({ where: { codigo } })
    if (duplicado) {
      throw new AppError('Ya existe un tipo con ese codigo', 400)
    }
  }

  const tipo = await prisma.tipoEspacio.update({
    where: { id: parseInt(id) },
    data: {
      codigo: codigo ? codigo.toUpperCase() : existente.codigo,
      nombre: nombre || existente.nombre,
      descripcion: descripcion !== undefined ? descripcion : existente.descripcion,
      orden: orden !== undefined ? orden : existente.orden,
      activo: activo !== undefined ? activo : existente.activo
    }
  })

  res.json({ success: true, data: tipo })
}))

// DELETE /api/admin/tipos-espacio/:id - Eliminar tipo
router.delete('/tipos-espacio/:id', asyncHandler(async (req, res) => {
  const { id } = req.params

  const tipo = await prisma.tipoEspacio.findUnique({
    where: { id: parseInt(id) },
    include: {
      _count: {
        select: { espacios: true }
      }
    }
  })

  if (!tipo) {
    throw new AppError('Tipo de espacio no encontrado', 404)
  }

  // Verificar que no tenga espacios asociados
  if (tipo._count.espacios > 0) {
    throw new AppError('No se puede eliminar un tipo con espacios asociados', 400)
  }

  await prisma.tipoEspacio.delete({ where: { id: parseInt(id) } })

  res.json({ success: true, message: 'Tipo de espacio eliminado correctamente' })
}))

// =============================================================================
// ESPACIOS DEPORTIVOS
// =============================================================================

// GET /api/admin/espacios-deportivos - Listar espacios
router.get('/espacios-deportivos', asyncHandler(async (req, res) => {
  const { activo, tipoEspacioId } = req.query

  const where = {}
  if (activo !== undefined) where.activo = activo === 'true'
  if (tipoEspacioId) where.tipoEspacioId = parseInt(tipoEspacioId)

  const espacios = await prisma.espacioDeportivo.findMany({
    where,
    orderBy: { nombre: 'asc' },
    include: {
      tipoEspacio: true,
      actividades: {
        select: { id: true, codigo: true, nombre: true }
      }
    }
  })

  res.json({ success: true, data: espacios })
}))

// GET /api/admin/espacios-deportivos/:id - Detalle de espacio
router.get('/espacios-deportivos/:id', asyncHandler(async (req, res) => {
  const { id } = req.params

  const espacio = await prisma.espacioDeportivo.findUnique({
    where: { id: parseInt(id) },
    include: {
      tipoEspacio: true,
      actividades: {
        select: { id: true, codigo: true, nombre: true, color: true }
      },
      horariosDisponibilidad: {
        orderBy: { diaSemana: 'asc' }
      }
    }
  })

  if (!espacio) {
    throw new AppError('Espacio no encontrado', 404)
  }

  res.json({ success: true, data: espacio })
}))

// POST /api/admin/espacios-deportivos - Crear espacio
router.post('/espacios-deportivos', asyncHandler(async (req, res) => {
  const { codigo, nombre, tipoEspacioId, capacidad, cubierto, iluminacion, descripcion, actividadIds } = req.body

  if (!codigo || !nombre || !tipoEspacioId) {
    throw new AppError('Codigo, nombre y tipo son requeridos', 400)
  }

  // Verificar codigo unico
  const existente = await prisma.espacioDeportivo.findUnique({ where: { codigo } })
  if (existente) {
    throw new AppError('Ya existe un espacio con ese codigo', 400)
  }

  // Verificar que el tipo existe
  const tipoExiste = await prisma.tipoEspacio.findUnique({ where: { id: parseInt(tipoEspacioId) } })
  if (!tipoExiste) {
    throw new AppError('Tipo de espacio no encontrado', 400)
  }

  const espacio = await prisma.espacioDeportivo.create({
    data: {
      codigo,
      nombre,
      tipoEspacioId: parseInt(tipoEspacioId),
      capacidad: capacidad ? parseInt(capacidad) : null,
      cubierto: cubierto || false,
      iluminacion: iluminacion !== false,
      descripcion: descripcion || null,
      actividades: actividadIds?.length ? {
        connect: actividadIds.map(id => ({ id: parseInt(id) }))
      } : undefined
    },
    include: {
      tipoEspacio: true,
      actividades: {
        select: { id: true, codigo: true, nombre: true }
      }
    }
  })

  res.status(201).json({ success: true, data: espacio })
}))

// PUT /api/admin/espacios-deportivos/:id - Actualizar espacio
router.put('/espacios-deportivos/:id', asyncHandler(async (req, res) => {
  const { id } = req.params
  const { codigo, nombre, tipoEspacioId, capacidad, cubierto, iluminacion, descripcion, activo, actividadIds } = req.body

  const existente = await prisma.espacioDeportivo.findUnique({ where: { id: parseInt(id) } })
  if (!existente) {
    throw new AppError('Espacio no encontrado', 404)
  }

  // Verificar codigo unico si cambio
  if (codigo && codigo !== existente.codigo) {
    const duplicado = await prisma.espacioDeportivo.findUnique({ where: { codigo } })
    if (duplicado) {
      throw new AppError('Ya existe un espacio con ese codigo', 400)
    }
  }

  // Verificar que el tipo existe si se cambio
  if (tipoEspacioId && tipoEspacioId !== existente.tipoEspacioId) {
    const tipoExiste = await prisma.tipoEspacio.findUnique({ where: { id: parseInt(tipoEspacioId) } })
    if (!tipoExiste) {
      throw new AppError('Tipo de espacio no encontrado', 400)
    }
  }

  const espacio = await prisma.espacioDeportivo.update({
    where: { id: parseInt(id) },
    data: {
      codigo: codigo || existente.codigo,
      nombre: nombre || existente.nombre,
      tipoEspacioId: tipoEspacioId ? parseInt(tipoEspacioId) : existente.tipoEspacioId,
      capacidad: capacidad !== undefined ? (capacidad ? parseInt(capacidad) : null) : existente.capacidad,
      cubierto: cubierto !== undefined ? cubierto : existente.cubierto,
      iluminacion: iluminacion !== undefined ? iluminacion : existente.iluminacion,
      descripcion: descripcion !== undefined ? descripcion : existente.descripcion,
      activo: activo !== undefined ? activo : existente.activo,
      actividades: actividadIds !== undefined ? {
        set: actividadIds.map(actId => ({ id: parseInt(actId) }))
      } : undefined
    },
    include: {
      tipoEspacio: true,
      actividades: {
        select: { id: true, codigo: true, nombre: true }
      }
    }
  })

  res.json({ success: true, data: espacio })
}))

// DELETE /api/admin/espacios-deportivos/:id - Eliminar espacio
router.delete('/espacios-deportivos/:id', asyncHandler(async (req, res) => {
  const { id } = req.params

  const espacio = await prisma.espacioDeportivo.findUnique({
    where: { id: parseInt(id) },
    include: {
      _count: {
        select: { entrenamientos: true, partidos: true }
      }
    }
  })

  if (!espacio) {
    throw new AppError('Espacio no encontrado', 404)
  }

  // Verificar que no tenga entrenamientos o partidos asociados
  if (espacio._count.entrenamientos > 0 || espacio._count.partidos > 0) {
    throw new AppError('No se puede eliminar un espacio con entrenamientos o partidos asociados', 400)
  }

  await prisma.espacioDeportivo.delete({ where: { id: parseInt(id) } })

  res.json({ success: true, message: 'Espacio eliminado correctamente' })
}))

// =============================================================================
// HORARIOS DE DISPONIBILIDAD
// =============================================================================

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']

// GET /api/admin/espacios-deportivos/:id/horarios - Listar horarios de un espacio
router.get('/espacios-deportivos/:id/horarios', asyncHandler(async (req, res) => {
  const { id } = req.params

  const horarios = await prisma.horarioDisponibilidad.findMany({
    where: { espacioDeportivoId: parseInt(id) },
    orderBy: { diaSemana: 'asc' }
  })

  res.json({ success: true, data: horarios })
}))

// POST /api/admin/espacios-deportivos/:id/horarios - Crear horario
router.post('/espacios-deportivos/:id/horarios', asyncHandler(async (req, res) => {
  const { id } = req.params
  const { diaSemana, horaInicio, horaFin } = req.body

  if (diaSemana === undefined || !horaInicio || !horaFin) {
    throw new AppError('Dia, hora inicio y hora fin son requeridos', 400)
  }

  if (diaSemana < 0 || diaSemana > 6) {
    throw new AppError('Dia de semana invalido (0-6)', 400)
  }

  // Verificar que el espacio existe
  const espacio = await prisma.espacioDeportivo.findUnique({ where: { id: parseInt(id) } })
  if (!espacio) {
    throw new AppError('Espacio no encontrado', 404)
  }

  // Verificar que no exista horario para ese dia
  const existente = await prisma.horarioDisponibilidad.findUnique({
    where: {
      espacioDeportivoId_diaSemana: {
        espacioDeportivoId: parseInt(id),
        diaSemana: parseInt(diaSemana)
      }
    }
  })
  if (existente) {
    throw new AppError(`Ya existe un horario para ${DIAS_SEMANA[diaSemana]}`, 400)
  }

  const horario = await prisma.horarioDisponibilidad.create({
    data: {
      espacioDeportivoId: parseInt(id),
      diaSemana: parseInt(diaSemana),
      horaInicio,
      horaFin
    }
  })

  res.status(201).json({ success: true, data: horario })
}))

// PUT /api/admin/espacios-deportivos/:espacioId/horarios/:horarioId - Actualizar horario
router.put('/espacios-deportivos/:espacioId/horarios/:horarioId', asyncHandler(async (req, res) => {
  const { espacioId, horarioId } = req.params
  const { horaInicio, horaFin, activo } = req.body

  const horario = await prisma.horarioDisponibilidad.findFirst({
    where: {
      id: parseInt(horarioId),
      espacioDeportivoId: parseInt(espacioId)
    }
  })

  if (!horario) {
    throw new AppError('Horario no encontrado', 404)
  }

  const updated = await prisma.horarioDisponibilidad.update({
    where: { id: parseInt(horarioId) },
    data: {
      horaInicio: horaInicio || horario.horaInicio,
      horaFin: horaFin || horario.horaFin,
      activo: activo !== undefined ? activo : horario.activo
    }
  })

  res.json({ success: true, data: updated })
}))

// DELETE /api/admin/espacios-deportivos/:espacioId/horarios/:horarioId - Eliminar horario
router.delete('/espacios-deportivos/:espacioId/horarios/:horarioId', asyncHandler(async (req, res) => {
  const { espacioId, horarioId } = req.params

  const horario = await prisma.horarioDisponibilidad.findFirst({
    where: {
      id: parseInt(horarioId),
      espacioDeportivoId: parseInt(espacioId)
    }
  })

  if (!horario) {
    throw new AppError('Horario no encontrado', 404)
  }

  await prisma.horarioDisponibilidad.delete({ where: { id: parseInt(horarioId) } })

  res.json({ success: true, message: 'Horario eliminado correctamente' })
}))

// POST /api/admin/espacios-deportivos/:id/horarios/bulk - Guardar horarios masivamente
router.post('/espacios-deportivos/:id/horarios/bulk', asyncHandler(async (req, res) => {
  const { id } = req.params
  const { horarios } = req.body // Array de { diaSemana, horaInicio, horaFin, activo }

  if (!Array.isArray(horarios)) {
    throw new AppError('Se esperaba un array de horarios', 400)
  }

  // Verificar que el espacio existe
  const espacio = await prisma.espacioDeportivo.findUnique({ where: { id: parseInt(id) } })
  if (!espacio) {
    throw new AppError('Espacio no encontrado', 404)
  }

  // Eliminar horarios existentes
  await prisma.horarioDisponibilidad.deleteMany({
    where: { espacioDeportivoId: parseInt(id) }
  })

  // Crear nuevos horarios
  if (horarios.length > 0) {
    await prisma.horarioDisponibilidad.createMany({
      data: horarios.map(h => ({
        espacioDeportivoId: parseInt(id),
        diaSemana: parseInt(h.diaSemana),
        horaInicio: h.horaInicio,
        horaFin: h.horaFin,
        activo: h.activo !== false
      }))
    })
  }

  // Obtener horarios actualizados
  const updated = await prisma.horarioDisponibilidad.findMany({
    where: { espacioDeportivoId: parseInt(id) },
    orderBy: { diaSemana: 'asc' }
  })

  res.json({ success: true, data: updated })
}))

// =============================================================================
// HORARIOS RECURRENTES (Templates semanales por categoría)
// =============================================================================

const DIAS_SEMANA_NOMBRES = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']

// GET /api/admin/horarios-recurrentes - Listar horarios recurrentes
router.get('/horarios-recurrentes', asyncHandler(async (req, res) => {
  const { categoriaActividadId, activo } = req.query

  const where = {}
  if (categoriaActividadId) where.categoriaActividadId = parseInt(categoriaActividadId)
  if (activo !== undefined) where.activo = activo === 'true'

  const horarios = await prisma.horarioRecurrente.findMany({
    where,
    orderBy: [{ categoriaActividadId: 'asc' }, { diaSemana: 'asc' }, { horaInicio: 'asc' }],
    include: {
      categoriaActividad: {
        include: { actividad: true }
      }
    }
  })

  res.json({ success: true, data: horarios })
}))

// GET /api/admin/horarios-recurrentes/:id - Detalle de horario recurrente
router.get('/horarios-recurrentes/:id', asyncHandler(async (req, res) => {
  const { id } = req.params

  const horario = await prisma.horarioRecurrente.findUnique({
    where: { id: parseInt(id) },
    include: {
      categoriaActividad: {
        include: { actividad: true }
      }
    }
  })

  if (!horario) {
    throw new AppError('Horario recurrente no encontrado', 404)
  }

  res.json({ success: true, data: horario })
}))

// POST /api/admin/horarios-recurrentes - Crear horario recurrente
router.post('/horarios-recurrentes', asyncHandler(async (req, res) => {
  const { categoriaActividadId, espacioId, diaSemana, horaInicio, horaFin } = req.body

  if (!categoriaActividadId || diaSemana === undefined || !horaInicio || !horaFin) {
    throw new AppError('Categoria, dia, hora inicio y hora fin son requeridos', 400)
  }

  // Verificar que la categoria existe
  const categoria = await prisma.categoriaActividad.findUnique({ where: { id: parseInt(categoriaActividadId) } })
  if (!categoria) {
    throw new AppError('Categoria de actividad no encontrada', 404)
  }

  // Verificar conflicto de horario en el mismo espacio (si se especifica)
  if (espacioId) {
    const conflicto = await prisma.horarioRecurrente.findFirst({
      where: {
        espacioId: parseInt(espacioId),
        diaSemana: parseInt(diaSemana),
        activo: true,
        OR: [
          { AND: [{ horaInicio: { lte: horaInicio } }, { horaFin: { gt: horaInicio } }] },
          { AND: [{ horaInicio: { lt: horaFin } }, { horaFin: { gte: horaFin } }] },
          { AND: [{ horaInicio: { gte: horaInicio } }, { horaFin: { lte: horaFin } }] }
        ]
      }
    })
    if (conflicto) {
      throw new AppError(`Ya existe un horario en ese espacio el ${DIAS_SEMANA_NOMBRES[diaSemana]} que se superpone`, 400)
    }
  }

  const horario = await prisma.horarioRecurrente.create({
    data: {
      categoriaActividadId: parseInt(categoriaActividadId),
      espacioId: espacioId ? parseInt(espacioId) : null,
      diaSemana: parseInt(diaSemana),
      horaInicio,
      horaFin
    },
    include: {
      categoriaActividad: {
        include: { actividad: true }
      }
    }
  })

  res.status(201).json({ success: true, data: horario })
}))

// PUT /api/admin/horarios-recurrentes/:id - Actualizar horario recurrente
router.put('/horarios-recurrentes/:id', asyncHandler(async (req, res) => {
  const { id } = req.params
  const { espacioId, diaSemana, horaInicio, horaFin, activo } = req.body

  const existente = await prisma.horarioRecurrente.findUnique({ where: { id: parseInt(id) } })
  if (!existente) {
    throw new AppError('Horario recurrente no encontrado', 404)
  }

  const horario = await prisma.horarioRecurrente.update({
    where: { id: parseInt(id) },
    data: {
      espacioId: espacioId !== undefined ? (espacioId ? parseInt(espacioId) : null) : existente.espacioId,
      diaSemana: diaSemana !== undefined ? parseInt(diaSemana) : existente.diaSemana,
      horaInicio: horaInicio || existente.horaInicio,
      horaFin: horaFin || existente.horaFin,
      activo: activo !== undefined ? activo : existente.activo
    },
    include: {
      categoriaActividad: {
        include: { actividad: true }
      }
    }
  })

  res.json({ success: true, data: horario })
}))

// DELETE /api/admin/horarios-recurrentes/:id - Eliminar horario recurrente
router.delete('/horarios-recurrentes/:id', asyncHandler(async (req, res) => {
  const { id } = req.params

  const horario = await prisma.horarioRecurrente.findUnique({ where: { id: parseInt(id) } })
  if (!horario) {
    throw new AppError('Horario recurrente no encontrado', 404)
  }

  await prisma.horarioRecurrente.delete({ where: { id: parseInt(id) } })

  res.json({ success: true, message: 'Horario recurrente eliminado correctamente' })
}))

// =============================================================================
// ENTRENAMIENTOS
// =============================================================================

// GET /api/admin/entrenamientos - Listar entrenamientos
router.get('/entrenamientos', asyncHandler(async (req, res) => {
  const { categoriaActividadId, espacioId, fechaDesde, fechaHasta, estado, actividadId } = req.query

  const where = {}
  if (categoriaActividadId) where.categoriaActividadId = parseInt(categoriaActividadId)
  if (espacioId) where.espacioId = parseInt(espacioId)
  if (estado) where.estado = estado

  // Filtro por rango de fechas
  if (fechaDesde || fechaHasta) {
    where.fecha = {}
    if (fechaDesde) where.fecha.gte = new Date(fechaDesde)
    if (fechaHasta) where.fecha.lte = new Date(fechaHasta)
  }

  // Filtro por actividad (a través de categoriaActividad)
  if (actividadId) {
    where.categoriaActividad = { actividadId: parseInt(actividadId) }
  }

  const entrenamientos = await prisma.entrenamiento.findMany({
    where,
    orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
    include: {
      categoriaActividad: {
        include: { actividad: true }
      },
      espacio: true,
      _count: {
        select: { asistencias: true }
      }
    }
  })

  res.json({ success: true, data: entrenamientos })
}))

// GET /api/admin/entrenamientos/:id - Detalle de entrenamiento
router.get('/entrenamientos/:id', asyncHandler(async (req, res) => {
  const { id } = req.params

  const entrenamiento = await prisma.entrenamiento.findUnique({
    where: { id: parseInt(id) },
    include: {
      categoriaActividad: {
        include: { actividad: true }
      },
      espacio: true,
      asistencias: {
        include: {
          socio: {
            select: { id: true, nroSocio: true, apellidoNombre: true, fotoUrl: true }
          }
        }
      }
    }
  })

  if (!entrenamiento) {
    throw new AppError('Entrenamiento no encontrado', 404)
  }

  res.json({ success: true, data: entrenamiento })
}))

// POST /api/admin/entrenamientos - Crear entrenamiento
router.post('/entrenamientos', asyncHandler(async (req, res) => {
  const { categoriaActividadId, espacioId, fecha, horaInicio, horaFin, tipo, observaciones } = req.body

  if (!categoriaActividadId || !fecha || !horaInicio || !horaFin) {
    throw new AppError('Categoria, fecha, hora inicio y hora fin son requeridos', 400)
  }

  // Verificar que la categoria existe
  const categoria = await prisma.categoriaActividad.findUnique({ where: { id: parseInt(categoriaActividadId) } })
  if (!categoria) {
    throw new AppError('Categoria de actividad no encontrada', 404)
  }

  // Verificar conflicto de horario en el espacio (si se especifica)
  if (espacioId) {
    const conflicto = await prisma.entrenamiento.findFirst({
      where: {
        espacioId: parseInt(espacioId),
        fecha: new Date(fecha),
        estado: { not: 'CANCELADO' },
        OR: [
          { AND: [{ horaInicio: { lte: horaInicio } }, { horaFin: { gt: horaInicio } }] },
          { AND: [{ horaInicio: { lt: horaFin } }, { horaFin: { gte: horaFin } }] },
          { AND: [{ horaInicio: { gte: horaInicio } }, { horaFin: { lte: horaFin } }] }
        ]
      },
      include: { categoriaActividad: true }
    })
    if (conflicto) {
      throw new AppError(`Ya existe un entrenamiento de ${conflicto.categoriaActividad.nombre} en ese espacio y horario`, 400)
    }
  }

  const entrenamiento = await prisma.entrenamiento.create({
    data: {
      categoriaActividadId: parseInt(categoriaActividadId),
      espacioId: espacioId ? parseInt(espacioId) : null,
      fecha: new Date(fecha),
      horaInicio,
      horaFin,
      tipo: tipo || 'REGULAR',
      observaciones: observaciones || null,
      registradoPor: req.admin.id
    },
    include: {
      categoriaActividad: {
        include: { actividad: true }
      },
      espacio: true
    }
  })

  res.status(201).json({ success: true, data: entrenamiento })
}))

// PUT /api/admin/entrenamientos/:id - Actualizar entrenamiento
router.put('/entrenamientos/:id', asyncHandler(async (req, res) => {
  const { id } = req.params
  const { espacioId, fecha, horaInicio, horaFin, tipo, observaciones, estado } = req.body

  const existente = await prisma.entrenamiento.findUnique({ where: { id: parseInt(id) } })
  if (!existente) {
    throw new AppError('Entrenamiento no encontrado', 404)
  }

  const entrenamiento = await prisma.entrenamiento.update({
    where: { id: parseInt(id) },
    data: {
      espacioId: espacioId !== undefined ? (espacioId ? parseInt(espacioId) : null) : existente.espacioId,
      fecha: fecha ? new Date(fecha) : existente.fecha,
      horaInicio: horaInicio || existente.horaInicio,
      horaFin: horaFin || existente.horaFin,
      tipo: tipo || existente.tipo,
      observaciones: observaciones !== undefined ? observaciones : existente.observaciones,
      estado: estado || existente.estado
    },
    include: {
      categoriaActividad: {
        include: { actividad: true }
      },
      espacio: true
    }
  })

  res.json({ success: true, data: entrenamiento })
}))

// POST /api/admin/entrenamientos/:id/cancelar - Cancelar entrenamiento
router.post('/entrenamientos/:id/cancelar', asyncHandler(async (req, res) => {
  const { id } = req.params
  const { motivo } = req.body

  const entrenamiento = await prisma.entrenamiento.findUnique({ where: { id: parseInt(id) } })
  if (!entrenamiento) {
    throw new AppError('Entrenamiento no encontrado', 404)
  }

  if (entrenamiento.estado === 'CANCELADO') {
    throw new AppError('El entrenamiento ya esta cancelado', 400)
  }

  const updated = await prisma.entrenamiento.update({
    where: { id: parseInt(id) },
    data: {
      estado: 'CANCELADO',
      motivoCancelacion: motivo || null
    },
    include: {
      categoriaActividad: {
        include: { actividad: true }
      },
      espacio: true
    }
  })

  res.json({ success: true, data: updated })
}))

// POST /api/admin/entrenamientos/:id/notificar - Notificar nuevo entrenamiento a inscriptos
router.post('/entrenamientos/:id/notificar', asyncHandler(async (req, res) => {
  const { id } = req.params

  const entrenamiento = await prisma.entrenamiento.findUnique({
    where: { id: parseInt(id) },
    include: {
      categoriaActividad: {
        include: { actividad: true }
      }
    }
  })

  if (!entrenamiento) {
    throw new AppError('Entrenamiento no encontrado', 404)
  }

  if (entrenamiento.estado === 'CANCELADO') {
    throw new AppError('No se puede notificar un entrenamiento cancelado', 400)
  }

  const notificados = await notificarNuevoEntrenamiento(parseInt(id))

  res.json({
    success: true,
    data: {
      notificados,
      mensaje: `Se notificó a ${notificados} socios sobre el entrenamiento`
    }
  })
}))

// DELETE /api/admin/entrenamientos/:id - Eliminar entrenamiento
router.delete('/entrenamientos/:id', asyncHandler(async (req, res) => {
  const { id } = req.params

  const entrenamiento = await prisma.entrenamiento.findUnique({
    where: { id: parseInt(id) },
    include: { _count: { select: { asistencias: true } } }
  })

  if (!entrenamiento) {
    throw new AppError('Entrenamiento no encontrado', 404)
  }

  if (entrenamiento._count.asistencias > 0) {
    throw new AppError('No se puede eliminar un entrenamiento con asistencias registradas. Cancele el entrenamiento en su lugar.', 400)
  }

  await prisma.entrenamiento.delete({ where: { id: parseInt(id) } })

  res.json({ success: true, message: 'Entrenamiento eliminado correctamente' })
}))

// POST /api/admin/entrenamientos/generar - Generar entrenamientos desde horarios recurrentes
router.post('/entrenamientos/generar', asyncHandler(async (req, res) => {
  const { categoriaActividadId, fechaDesde, fechaHasta } = req.body

  if (!fechaDesde || !fechaHasta) {
    throw new AppError('Fecha desde y fecha hasta son requeridas', 400)
  }

  const desde = new Date(fechaDesde)
  const hasta = new Date(fechaHasta)

  if (hasta < desde) {
    throw new AppError('La fecha hasta debe ser mayor a fecha desde', 400)
  }

  // Máximo 60 días para evitar generar demasiados registros
  const diffDays = Math.ceil((hasta - desde) / (1000 * 60 * 60 * 24))
  if (diffDays > 60) {
    throw new AppError('No se pueden generar entrenamientos para más de 60 días', 400)
  }

  // Obtener horarios recurrentes activos
  const whereHorarios = { activo: true }
  if (categoriaActividadId) whereHorarios.categoriaActividadId = parseInt(categoriaActividadId)

  const horariosRecurrentes = await prisma.horarioRecurrente.findMany({
    where: whereHorarios,
    include: { categoriaActividad: true }
  })

  if (horariosRecurrentes.length === 0) {
    throw new AppError('No hay horarios recurrentes configurados', 400)
  }

  const entrenamientosCreados = []
  const errores = []

  // Iterar por cada día del rango
  for (let d = new Date(desde); d <= hasta; d.setDate(d.getDate() + 1)) {
    const diaSemana = d.getDay() // 0=Domingo, 1=Lunes, etc.

    // Buscar horarios para este día
    const horariosDelDia = horariosRecurrentes.filter(h => h.diaSemana === diaSemana)

    for (const horario of horariosDelDia) {
      const fechaEntrenamiento = new Date(d)

      // Verificar si ya existe un entrenamiento para esa categoría, fecha y horario
      const existente = await prisma.entrenamiento.findFirst({
        where: {
          categoriaActividadId: horario.categoriaActividadId,
          fecha: fechaEntrenamiento,
          horaInicio: horario.horaInicio
        }
      })

      if (existente) {
        continue // Saltar si ya existe
      }

      // Verificar conflicto de espacio si hay espacio asignado
      if (horario.espacioId) {
        const conflicto = await prisma.entrenamiento.findFirst({
          where: {
            espacioId: horario.espacioId,
            fecha: fechaEntrenamiento,
            estado: { not: 'CANCELADO' },
            OR: [
              { AND: [{ horaInicio: { lte: horario.horaInicio } }, { horaFin: { gt: horario.horaInicio } }] },
              { AND: [{ horaInicio: { lt: horario.horaFin } }, { horaFin: { gte: horario.horaFin } }] }
            ]
          }
        })
        if (conflicto) {
          errores.push(`${fechaEntrenamiento.toISOString().split('T')[0]} ${horario.horaInicio}: Conflicto de espacio`)
          continue
        }
      }

      try {
        const nuevo = await prisma.entrenamiento.create({
          data: {
            categoriaActividadId: horario.categoriaActividadId,
            espacioId: horario.espacioId,
            fecha: fechaEntrenamiento,
            horaInicio: horario.horaInicio,
            horaFin: horario.horaFin,
            tipo: 'REGULAR',
            registradoPor: req.admin.id
          }
        })
        entrenamientosCreados.push(nuevo)
      } catch (err) {
        errores.push(`Error creando entrenamiento: ${err.message}`)
      }
    }
  }

  res.json({
    success: true,
    data: {
      creados: entrenamientosCreados.length,
      errores: errores.length,
      detalleErrores: errores
    }
  })
}))

// =============================================================================
// ASISTENCIA A ENTRENAMIENTOS
// =============================================================================

// GET /api/admin/entrenamientos/:id/socios - Listar socios inscriptos en la categoria del entrenamiento
router.get('/entrenamientos/:id/socios', asyncHandler(async (req, res) => {
  const { id } = req.params

  const entrenamiento = await prisma.entrenamiento.findUnique({
    where: { id: parseInt(id) },
    include: { categoriaActividad: true }
  })

  if (!entrenamiento) {
    throw new AppError('Entrenamiento no encontrado', 404)
  }

  // Obtener inscripciones activas de la categoria
  const inscripciones = await prisma.inscripcion.findMany({
    where: {
      categoriaActividadId: entrenamiento.categoriaActividadId,
      estado: 'ACTIVA',
      fechaInicio: { lte: entrenamiento.fecha },
      OR: [
        { fechaFin: null },
        { fechaFin: { gte: entrenamiento.fecha } }
      ]
    },
    include: {
      socio: {
        select: {
          id: true,
          nroSocio: true,
          apellidoNombre: true,
          fotoUrl: true,
          documento: true
        }
      }
    },
    orderBy: { socio: { apellidoNombre: 'asc' } }
  })

  // Obtener asistencias ya registradas
  const asistencias = await prisma.asistencia.findMany({
    where: { entrenamientoId: parseInt(id) }
  })

  const asistenciasMap = new Map(asistencias.map(a => [a.socioId, a]))

  // Combinar inscripciones con asistencias
  const socios = inscripciones.map(ins => ({
    ...ins.socio,
    inscripcionId: ins.id,
    asistencia: asistenciasMap.get(ins.socioId) || null
  }))

  res.json({ success: true, data: socios })
}))

// POST /api/admin/entrenamientos/:id/asistencia - Guardar asistencia masiva
router.post('/entrenamientos/:id/asistencia', asyncHandler(async (req, res) => {
  const { id } = req.params
  const { asistencias } = req.body // Array de { socioId, estado, horaLlegada?, observaciones? }

  if (!Array.isArray(asistencias)) {
    throw new AppError('El campo asistencias debe ser un array', 400)
  }

  const entrenamiento = await prisma.entrenamiento.findUnique({
    where: { id: parseInt(id) }
  })

  if (!entrenamiento) {
    throw new AppError('Entrenamiento no encontrado', 404)
  }

  if (entrenamiento.estado === 'CANCELADO') {
    throw new AppError('No se puede registrar asistencia en un entrenamiento cancelado', 400)
  }

  const resultados = []

  for (const asist of asistencias) {
    const { socioId, estado, horaLlegada, observaciones } = asist

    if (!socioId || !estado) {
      continue
    }

    // Validar estado
    if (!['PRESENTE', 'AUSENTE', 'JUSTIFICADO', 'TARDE'].includes(estado)) {
      continue
    }

    try {
      const registro = await prisma.asistencia.upsert({
        where: {
          entrenamientoId_socioId: {
            entrenamientoId: parseInt(id),
            socioId: parseInt(socioId)
          }
        },
        update: {
          estado,
          horaLlegada: horaLlegada || null,
          observaciones: observaciones || null,
          registradoPor: req.admin.id
        },
        create: {
          entrenamientoId: parseInt(id),
          socioId: parseInt(socioId),
          estado,
          horaLlegada: horaLlegada || null,
          observaciones: observaciones || null,
          registradoPor: req.admin.id
        }
      })
      resultados.push(registro)
    } catch (err) {
      console.error(`Error guardando asistencia socio ${socioId}:`, err.message)
    }
  }

  // Actualizar estado del entrenamiento a FINALIZADO si tiene asistencias
  if (resultados.length > 0 && entrenamiento.estado === 'PROGRAMADO') {
    await prisma.entrenamiento.update({
      where: { id: parseInt(id) },
      data: { estado: 'FINALIZADO' }
    })
  }

  res.json({ success: true, data: { guardados: resultados.length } })
}))

// DELETE /api/admin/entrenamientos/:id/asistencia/:socioId - Eliminar asistencia individual
router.delete('/entrenamientos/:id/asistencia/:socioId', asyncHandler(async (req, res) => {
  const { id, socioId } = req.params

  await prisma.asistencia.delete({
    where: {
      entrenamientoId_socioId: {
        entrenamientoId: parseInt(id),
        socioId: parseInt(socioId)
      }
    }
  })

  res.json({ success: true, message: 'Asistencia eliminada' })
}))

// =============================================================================
// PARTIDOS
// =============================================================================

// GET /api/admin/partidos - Listar partidos
router.get('/partidos', asyncHandler(async (req, res) => {
  const { categoriaActividadId, actividadId, fechaDesde, fechaHasta, estado, condicion, tipo } = req.query

  const where = {}
  if (categoriaActividadId) where.categoriaActividadId = parseInt(categoriaActividadId)
  if (estado) where.estado = estado
  if (condicion) where.condicion = condicion
  if (tipo) where.tipo = tipo

  // Filtro por rango de fechas
  if (fechaDesde || fechaHasta) {
    where.fecha = {}
    if (fechaDesde) where.fecha.gte = new Date(fechaDesde)
    if (fechaHasta) where.fecha.lte = new Date(fechaHasta)
  }

  // Filtro por actividad (a través de categoriaActividad)
  if (actividadId) {
    where.categoriaActividad = { actividadId: parseInt(actividadId) }
  }

  const partidos = await prisma.partido.findMany({
    where,
    orderBy: [{ fecha: 'desc' }, { hora: 'asc' }],
    include: {
      categoriaActividad: {
        include: { actividad: true }
      },
      espacio: true,
      _count: {
        select: { convocados: true, estadisticas: true }
      }
    }
  })

  res.json({ success: true, data: partidos })
}))

// GET /api/admin/partidos/:id - Detalle de partido
router.get('/partidos/:id', asyncHandler(async (req, res) => {
  const { id } = req.params

  const partido = await prisma.partido.findUnique({
    where: { id: parseInt(id) },
    include: {
      categoriaActividad: {
        include: { actividad: true }
      },
      espacio: true,
      convocados: {
        include: {
          socio: {
            select: { id: true, nroSocio: true, apellidoNombre: true, fotoUrl: true }
          }
        },
        orderBy: { socio: { apellidoNombre: 'asc' } }
      },
      estadisticas: {
        include: {
          socio: {
            select: { id: true, nroSocio: true, apellidoNombre: true, fotoUrl: true }
          }
        },
        orderBy: { socio: { apellidoNombre: 'asc' } }
      }
    }
  })

  if (!partido) {
    throw new AppError('Partido no encontrado', 404)
  }

  res.json({ success: true, data: partido })
}))

// POST /api/admin/partidos - Crear partido
router.post('/partidos', asyncHandler(async (req, res) => {
  const { categoriaActividadId, fecha, hora, tipo, condicion, rival, ubicacion, espacioId, observaciones } = req.body

  if (!categoriaActividadId || !fecha || !hora || !condicion || !rival) {
    throw new AppError('Categoría, fecha, hora, condición y rival son requeridos', 400)
  }

  // Verificar que la categoría existe
  const categoria = await prisma.categoriaActividad.findUnique({ where: { id: parseInt(categoriaActividadId) } })
  if (!categoria) {
    throw new AppError('Categoría de actividad no encontrada', 404)
  }

  // Verificar conflicto de espacio si es local
  if (espacioId && condicion === 'LOCAL') {
    const conflicto = await prisma.partido.findFirst({
      where: {
        espacioId: parseInt(espacioId),
        fecha: new Date(fecha),
        hora,
        estado: { not: 'CANCELADO' }
      }
    })
    if (conflicto) {
      throw new AppError('Ya existe un partido en ese espacio, fecha y hora', 400)
    }
  }

  const partido = await prisma.partido.create({
    data: {
      categoriaActividadId: parseInt(categoriaActividadId),
      fecha: new Date(fecha),
      hora,
      tipo: tipo || 'LIGA',
      condicion,
      rival,
      ubicacion: ubicacion || null,
      espacioId: espacioId ? parseInt(espacioId) : null,
      observaciones: observaciones || null,
      registradoPor: req.admin.id
    },
    include: {
      categoriaActividad: {
        include: { actividad: true }
      },
      espacio: true
    }
  })

  res.status(201).json({ success: true, data: partido })
}))

// PUT /api/admin/partidos/:id - Actualizar partido
router.put('/partidos/:id', asyncHandler(async (req, res) => {
  const { id } = req.params
  const { fecha, hora, tipo, condicion, rival, ubicacion, espacioId, observaciones, estado } = req.body

  const existente = await prisma.partido.findUnique({ where: { id: parseInt(id) } })
  if (!existente) {
    throw new AppError('Partido no encontrado', 404)
  }

  const partido = await prisma.partido.update({
    where: { id: parseInt(id) },
    data: {
      fecha: fecha ? new Date(fecha) : existente.fecha,
      hora: hora || existente.hora,
      tipo: tipo || existente.tipo,
      condicion: condicion || existente.condicion,
      rival: rival || existente.rival,
      ubicacion: ubicacion !== undefined ? ubicacion : existente.ubicacion,
      espacioId: espacioId !== undefined ? (espacioId ? parseInt(espacioId) : null) : existente.espacioId,
      observaciones: observaciones !== undefined ? observaciones : existente.observaciones,
      estado: estado || existente.estado
    },
    include: {
      categoriaActividad: {
        include: { actividad: true }
      },
      espacio: true
    }
  })

  res.json({ success: true, data: partido })
}))

// POST /api/admin/partidos/:id/resultado - Cargar resultado
router.post('/partidos/:id/resultado', asyncHandler(async (req, res) => {
  const { id } = req.params
  const { golesLocal, golesVisitante } = req.body

  const partido = await prisma.partido.findUnique({ where: { id: parseInt(id) } })
  if (!partido) {
    throw new AppError('Partido no encontrado', 404)
  }

  if (partido.estado === 'CANCELADO') {
    throw new AppError('No se puede cargar resultado de un partido cancelado', 400)
  }

  const updated = await prisma.partido.update({
    where: { id: parseInt(id) },
    data: {
      golesLocal: golesLocal !== undefined ? parseInt(golesLocal) : null,
      golesVisitante: golesVisitante !== undefined ? parseInt(golesVisitante) : null,
      estado: 'FINALIZADO'
    },
    include: {
      categoriaActividad: {
        include: { actividad: true }
      },
      espacio: true
    }
  })

  res.json({ success: true, data: updated })
}))

// POST /api/admin/partidos/:id/suspender - Suspender partido
router.post('/partidos/:id/suspender', asyncHandler(async (req, res) => {
  const { id } = req.params
  const { motivo } = req.body

  const partido = await prisma.partido.findUnique({ where: { id: parseInt(id) } })
  if (!partido) {
    throw new AppError('Partido no encontrado', 404)
  }

  const updated = await prisma.partido.update({
    where: { id: parseInt(id) },
    data: {
      estado: 'SUSPENDIDO',
      observaciones: motivo ? `SUSPENDIDO: ${motivo}` : 'SUSPENDIDO'
    },
    include: {
      categoriaActividad: {
        include: { actividad: true }
      },
      espacio: true
    }
  })

  res.json({ success: true, data: updated })
}))

// POST /api/admin/partidos/:id/cancelar - Cancelar partido
router.post('/partidos/:id/cancelar', asyncHandler(async (req, res) => {
  const { id } = req.params
  const { motivo } = req.body

  const partido = await prisma.partido.findUnique({ where: { id: parseInt(id) } })
  if (!partido) {
    throw new AppError('Partido no encontrado', 404)
  }

  const updated = await prisma.partido.update({
    where: { id: parseInt(id) },
    data: {
      estado: 'CANCELADO',
      observaciones: motivo ? `CANCELADO: ${motivo}` : 'CANCELADO'
    },
    include: {
      categoriaActividad: {
        include: { actividad: true }
      },
      espacio: true
    }
  })

  res.json({ success: true, data: updated })
}))

// DELETE /api/admin/partidos/:id - Eliminar partido
router.delete('/partidos/:id', asyncHandler(async (req, res) => {
  const { id } = req.params

  const partido = await prisma.partido.findUnique({
    where: { id: parseInt(id) },
    include: {
      _count: { select: { convocados: true, estadisticas: true } }
    }
  })

  if (!partido) {
    throw new AppError('Partido no encontrado', 404)
  }

  // Eliminar convocatorias y estadísticas primero (cascade)
  await prisma.partido.delete({ where: { id: parseInt(id) } })

  res.json({ success: true, message: 'Partido eliminado correctamente' })
}))

// =============================================================================
// CONVOCATORIAS
// =============================================================================

// GET /api/admin/partidos/:id/convocados - Listar socios convocables y convocados
router.get('/partidos/:id/convocados', asyncHandler(async (req, res) => {
  const { id } = req.params

  const partido = await prisma.partido.findUnique({
    where: { id: parseInt(id) },
    include: { categoriaActividad: true }
  })

  if (!partido) {
    throw new AppError('Partido no encontrado', 404)
  }

  // Obtener inscripciones activas de la categoría
  const inscripciones = await prisma.inscripcion.findMany({
    where: {
      categoriaActividadId: partido.categoriaActividadId,
      estado: 'ACTIVA',
      fechaInicio: { lte: partido.fecha },
      OR: [
        { fechaFin: null },
        { fechaFin: { gte: partido.fecha } }
      ]
    },
    include: {
      socio: {
        select: {
          id: true,
          nroSocio: true,
          apellidoNombre: true,
          fotoUrl: true,
          documento: true
        }
      }
    },
    orderBy: { socio: { apellidoNombre: 'asc' } }
  })

  // Obtener convocatorias existentes
  const convocatorias = await prisma.convocatoria.findMany({
    where: { partidoId: parseInt(id) }
  })

  const convocatoriasMap = new Map(convocatorias.map(c => [c.socioId, c]))

  // Combinar inscripciones con convocatorias
  const socios = inscripciones.map(ins => ({
    ...ins.socio,
    inscripcionId: ins.id,
    convocatoria: convocatoriasMap.get(ins.socioId) || null
  }))

  res.json({ success: true, data: socios })
}))

// POST /api/admin/partidos/:id/convocar - Convocar jugadores (masivo)
router.post('/partidos/:id/convocar', asyncHandler(async (req, res) => {
  const { id } = req.params
  const { socioIds } = req.body // Array de socioIds a convocar

  if (!Array.isArray(socioIds) || socioIds.length === 0) {
    throw new AppError('Debe enviar un array de socioIds', 400)
  }

  const partido = await prisma.partido.findUnique({ where: { id: parseInt(id) } })
  if (!partido) {
    throw new AppError('Partido no encontrado', 404)
  }

  const resultados = []

  for (const socioId of socioIds) {
    try {
      const convocatoria = await prisma.convocatoria.upsert({
        where: {
          partidoId_socioId: {
            partidoId: parseInt(id),
            socioId: parseInt(socioId)
          }
        },
        update: {},
        create: {
          partidoId: parseInt(id),
          socioId: parseInt(socioId)
        }
      })
      resultados.push(convocatoria)
    } catch (err) {
      console.error(`Error convocando socio ${socioId}:`, err.message)
    }
  }

  res.json({ success: true, data: { convocados: resultados.length } })
}))

// DELETE /api/admin/partidos/:id/convocar/:socioId - Quitar de convocatoria
router.delete('/partidos/:id/convocar/:socioId', asyncHandler(async (req, res) => {
  const { id, socioId } = req.params

  await prisma.convocatoria.delete({
    where: {
      partidoId_socioId: {
        partidoId: parseInt(id),
        socioId: parseInt(socioId)
      }
    }
  })

  res.json({ success: true, message: 'Jugador quitado de la convocatoria' })
}))

// PUT /api/admin/partidos/:partidoId/convocatoria/:socioId - Confirmar/rechazar convocatoria
router.put('/partidos/:partidoId/convocatoria/:socioId', asyncHandler(async (req, res) => {
  const { partidoId, socioId } = req.params
  const { confirmado, motivoRechazo } = req.body

  const convocatoria = await prisma.convocatoria.findUnique({
    where: {
      partidoId_socioId: {
        partidoId: parseInt(partidoId),
        socioId: parseInt(socioId)
      }
    }
  })

  if (!convocatoria) {
    throw new AppError('Convocatoria no encontrada', 404)
  }

  const updated = await prisma.convocatoria.update({
    where: {
      partidoId_socioId: {
        partidoId: parseInt(partidoId),
        socioId: parseInt(socioId)
      }
    },
    data: {
      confirmado,
      motivoRechazo: confirmado === false ? (motivoRechazo || null) : null
    },
    include: {
      socio: {
        select: { id: true, nroSocio: true, apellidoNombre: true }
      }
    }
  })

  res.json({ success: true, data: updated })
}))

// POST /api/admin/partidos/:id/notificar-convocados - Enviar notificaciones a convocados
router.post('/partidos/:id/notificar-convocados', asyncHandler(async (req, res) => {
  const { id } = req.params
  const { tipo, socioIds } = req.body // tipo: 'push', 'whatsapp', 'email', 'todos'

  if (!tipo) {
    throw new AppError('Debe especificar el tipo de notificación', 400)
  }

  const partido = await prisma.partido.findUnique({
    where: { id: parseInt(id) },
    include: {
      categoriaActividad: {
        include: { actividad: true }
      },
      espacio: true
    }
  })

  if (!partido) {
    throw new AppError('Partido no encontrado', 404)
  }

  // Obtener convocados a notificar
  const whereConvocados = { partidoId: parseInt(id) }
  if (socioIds && Array.isArray(socioIds) && socioIds.length > 0) {
    whereConvocados.socioId = { in: socioIds.map(id => parseInt(id)) }
  }

  const convocados = await prisma.convocatoria.findMany({
    where: whereConvocados,
    include: {
      socio: {
        select: {
          id: true,
          nroSocio: true,
          apellidoNombre: true,
          email: true,
          celular: true,
          tokenPortal: true,
          notificarPush: true
        }
      }
    }
  })

  if (convocados.length === 0) {
    throw new AppError('No hay convocados para notificar', 400)
  }

  // Preparar mensaje
  const fechaPartido = new Date(partido.fecha).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  })
  const actividad = partido.categoriaActividad.actividad.nombre
  const categoria = partido.categoriaActividad.nombre
  const condicionTexto = partido.condicion === 'LOCAL' ? 'de local' : 'de visitante'
  const lugar = partido.condicion === 'LOCAL'
    ? (partido.espacio?.nombre || 'La Caldera')
    : partido.ubicacion || 'A confirmar'

  const mensaje = `¡Fuiste convocado!\n\n` +
    `${actividad} - ${categoria}\n` +
    `vs ${partido.rival} (${condicionTexto})\n` +
    `${fechaPartido} - ${partido.hora}hs\n` +
    `Lugar: ${lugar}\n\n` +
    `Confirmá tu asistencia desde el portal del socio.`

  const resultados = {
    push: { enviados: 0, fallidos: 0 },
    whatsapp: { enviados: 0, pendientes: 0 },
    email: { enviados: 0, fallidos: 0 }
  }

  const ahora = new Date()

  for (const conv of convocados) {
    const socio = conv.socio
    const updateData = {}

    // Notificación Push
    if ((tipo === 'push' || tipo === 'todos') && socio.notificarPush) {
      try {
        // Buscar suscripción push del socio
        const suscripcion = await prisma.pushSubscription.findFirst({
          where: { socioId: socio.id }
        })

        if (suscripcion) {
          // Importar servicio de webPush dinámicamente
          const webPush = await import('../services/webPush.js')
          await webPush.enviarNotificacionPush(suscripcion, {
            title: `Convocatoria: ${actividad} vs ${partido.rival}`,
            body: `${fechaPartido} - ${partido.hora}hs (${condicionTexto})`,
            icon: '/images/icon-192.png',
            badge: '/images/icon-192.png',
            data: {
              url: `/s/${socio.tokenPortal}`,
              tipo: 'convocatoria',
              partidoId: partido.id
            }
          })
          updateData.notificadoPush = true
          updateData.fechaNotifPush = ahora
          resultados.push.enviados++
        }
      } catch (err) {
        console.error(`Error push socio ${socio.id}:`, err.message)
        resultados.push.fallidos++
      }
    }

    // WhatsApp (preparar link, no enviar directamente)
    if ((tipo === 'whatsapp' || tipo === 'todos') && socio.celular) {
      // Generar link de WhatsApp
      const celularLimpio = socio.celular.replace(/\D/g, '')
      const whatsappUrl = `https://wa.me/${celularLimpio}?text=${encodeURIComponent(mensaje)}`

      updateData.notificadoWhatsapp = false // Marcar como pendiente, el admin debe enviar manualmente
      updateData.fechaNotifWhatsapp = ahora
      resultados.whatsapp.pendientes++
    }

    // Email
    if ((tipo === 'email' || tipo === 'todos') && socio.email) {
      try {
        const emailService = await import('../services/email.js')
        await emailService.enviarEmail({
          to: socio.email,
          subject: `Convocatoria: ${actividad} vs ${partido.rival}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #DC2626;">¡Fuiste convocado!</h2>
              <p><strong>${actividad} - ${categoria}</strong></p>
              <p>vs ${partido.rival} (${condicionTexto})</p>
              <p><strong>Fecha:</strong> ${fechaPartido}</p>
              <p><strong>Hora:</strong> ${partido.hora}hs</p>
              <p><strong>Lugar:</strong> ${lugar}</p>
              <br>
              <p>Confirmá tu asistencia desde el portal del socio:</p>
              <a href="${process.env.FRONTEND_URL || 'https://sportivo.axiomacloud.com'}/s/${socio.tokenPortal}"
                 style="display: inline-block; padding: 12px 24px; background-color: #DC2626; color: white; text-decoration: none; border-radius: 8px;">
                Ir al Portal
              </a>
              <br><br>
              <p style="color: #666; font-size: 12px;">Club Sportivo Pilar - La Caldera</p>
            </div>
          `
        })
        updateData.notificadoEmail = true
        updateData.fechaNotifEmail = ahora
        resultados.email.enviados++
      } catch (err) {
        console.error(`Error email socio ${socio.id}:`, err.message)
        resultados.email.fallidos++
      }
    }

    // Actualizar convocatoria con estado de notificaciones
    if (Object.keys(updateData).length > 0) {
      await prisma.convocatoria.update({
        where: {
          partidoId_socioId: {
            partidoId: parseInt(id),
            socioId: socio.id
          }
        },
        data: updateData
      })
    }
  }

  res.json({
    success: true,
    data: {
      totalConvocados: convocados.length,
      resultados
    }
  })
}))

// =============================================================================
// ESTADÍSTICAS DE PARTIDO
// =============================================================================

// GET /api/admin/partidos/:id/estadisticas - Obtener estadísticas del partido
router.get('/partidos/:id/estadisticas', asyncHandler(async (req, res) => {
  const { id } = req.params

  const estadisticas = await prisma.estadisticaPartido.findMany({
    where: { partidoId: parseInt(id) },
    include: {
      socio: {
        select: { id: true, nroSocio: true, apellidoNombre: true, fotoUrl: true }
      }
    },
    orderBy: { socio: { apellidoNombre: 'asc' } }
  })

  res.json({ success: true, data: estadisticas })
}))

// POST /api/admin/partidos/:id/estadisticas - Guardar estadísticas (masivo)
router.post('/partidos/:id/estadisticas', asyncHandler(async (req, res) => {
  const { id } = req.params
  const { estadisticas } = req.body // Array de { socioId, minutosJugados, goles, asistencias, tarjetaAmarilla, tarjetaRoja, esTitular }

  if (!Array.isArray(estadisticas)) {
    throw new AppError('El campo estadísticas debe ser un array', 400)
  }

  const partido = await prisma.partido.findUnique({ where: { id: parseInt(id) } })
  if (!partido) {
    throw new AppError('Partido no encontrado', 404)
  }

  const resultados = []

  for (const est of estadisticas) {
    const { socioId, minutosJugados, goles, asistencias, tarjetaAmarilla, tarjetaRoja, esTitular } = est

    if (!socioId) continue

    try {
      const registro = await prisma.estadisticaPartido.upsert({
        where: {
          partidoId_socioId: {
            partidoId: parseInt(id),
            socioId: parseInt(socioId)
          }
        },
        update: {
          minutosJugados: minutosJugados !== undefined ? parseInt(minutosJugados) : null,
          goles: goles !== undefined ? parseInt(goles) : 0,
          asistencias: asistencias !== undefined ? parseInt(asistencias) : 0,
          tarjetaAmarilla: tarjetaAmarilla !== undefined ? parseInt(tarjetaAmarilla) : 0,
          tarjetaRoja: tarjetaRoja !== undefined ? parseInt(tarjetaRoja) : 0,
          esTitular: esTitular !== undefined ? esTitular : false
        },
        create: {
          partidoId: parseInt(id),
          socioId: parseInt(socioId),
          minutosJugados: minutosJugados !== undefined ? parseInt(minutosJugados) : null,
          goles: goles !== undefined ? parseInt(goles) : 0,
          asistencias: asistencias !== undefined ? parseInt(asistencias) : 0,
          tarjetaAmarilla: tarjetaAmarilla !== undefined ? parseInt(tarjetaAmarilla) : 0,
          tarjetaRoja: tarjetaRoja !== undefined ? parseInt(tarjetaRoja) : 0,
          esTitular: esTitular !== undefined ? esTitular : false
        }
      })
      resultados.push(registro)
    } catch (err) {
      console.error(`Error guardando estadística socio ${socioId}:`, err.message)
    }
  }

  res.json({ success: true, data: { guardados: resultados.length } })
}))

// GET /api/admin/estadisticas/jugador/:socioId - Estadísticas acumuladas de un jugador
router.get('/estadisticas/jugador/:socioId', asyncHandler(async (req, res) => {
  const { socioId } = req.params
  const { temporada, actividadId } = req.query

  const where = { socioId: parseInt(socioId) }

  // Filtro por temporada (año)
  if (temporada) {
    const anio = parseInt(temporada)
    where.partido = {
      fecha: {
        gte: new Date(`${anio}-01-01`),
        lte: new Date(`${anio}-12-31`)
      }
    }
  }

  // Filtro por actividad
  if (actividadId) {
    where.partido = {
      ...where.partido,
      categoriaActividad: { actividadId: parseInt(actividadId) }
    }
  }

  const estadisticas = await prisma.estadisticaPartido.findMany({
    where,
    include: {
      partido: {
        include: {
          categoriaActividad: {
            include: { actividad: true }
          }
        }
      }
    },
    orderBy: { partido: { fecha: 'desc' } }
  })

  // Calcular totales
  const totales = {
    partidos: estadisticas.length,
    titularidades: estadisticas.filter(e => e.esTitular).length,
    minutosJugados: estadisticas.reduce((sum, e) => sum + (e.minutosJugados || 0), 0),
    goles: estadisticas.reduce((sum, e) => sum + e.goles, 0),
    asistencias: estadisticas.reduce((sum, e) => sum + e.asistencias, 0),
    tarjetasAmarillas: estadisticas.reduce((sum, e) => sum + e.tarjetaAmarilla, 0),
    tarjetasRojas: estadisticas.reduce((sum, e) => sum + e.tarjetaRoja, 0)
  }

  res.json({ success: true, data: { estadisticas, totales } })
}))

// GET /api/admin/estadisticas/ranking - Ranking de goleadores/asistencias
router.get('/estadisticas/ranking', asyncHandler(async (req, res) => {
  const { tipo, actividadId, categoriaActividadId, temporada, limite } = req.query

  const tipoRanking = tipo || 'goles' // goles, asistencias
  const limit = parseInt(limite) || 10

  let wherePartido = {}

  // Filtro por temporada
  if (temporada) {
    const anio = parseInt(temporada)
    wherePartido.fecha = {
      gte: new Date(`${anio}-01-01`),
      lte: new Date(`${anio}-12-31`)
    }
  }

  // Filtro por actividad
  if (actividadId) {
    wherePartido.categoriaActividad = { actividadId: parseInt(actividadId) }
  }

  // Filtro por categoría
  if (categoriaActividadId) {
    wherePartido.categoriaActividadId = parseInt(categoriaActividadId)
  }

  const estadisticas = await prisma.estadisticaPartido.groupBy({
    by: ['socioId'],
    where: {
      partido: wherePartido
    },
    _sum: {
      goles: true,
      asistencias: true,
      tarjetaAmarilla: true,
      tarjetaRoja: true,
      minutosJugados: true
    },
    _count: {
      id: true
    },
    orderBy: {
      _sum: {
        [tipoRanking]: 'desc'
      }
    },
    take: limit
  })

  // Obtener datos de los socios
  const socioIds = estadisticas.map(e => e.socioId)
  const socios = await prisma.socio.findMany({
    where: { id: { in: socioIds } },
    select: { id: true, nroSocio: true, apellidoNombre: true, fotoUrl: true }
  })

  const sociosMap = new Map(socios.map(s => [s.id, s]))

  const ranking = estadisticas.map((e, index) => ({
    posicion: index + 1,
    socio: sociosMap.get(e.socioId),
    partidos: e._count.id,
    goles: e._sum.goles || 0,
    asistencias: e._sum.asistencias || 0,
    tarjetasAmarillas: e._sum.tarjetaAmarilla || 0,
    tarjetasRojas: e._sum.tarjetaRoja || 0,
    minutosJugados: e._sum.minutosJugados || 0
  }))

  res.json({ success: true, data: ranking })
}))

export default router
