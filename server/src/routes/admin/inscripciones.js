import { Router } from 'express'
import * as XLSX from 'xlsx'
import { asyncHandler, AppError } from '../../middleware/errorHandler.js'
import { authAdmin } from '../../middleware/auth.js'
import { resolverPeriodoAlta } from '../../lib/cuotasPeriodoAlta.js'
import { buildSocioSearchFilter } from '../../lib/socioSearch.js'

const router = Router()

// INSCRIPCIONES - CRUD Completo
// ============================================================================

/**
 * GET /api/admin/inscripciones
 * Listar todas las inscripciones con filtros
 */
router.get('/inscripciones', authAdmin, asyncHandler(async (req, res) => {
  const {
    actividadId,
    categoriaId,
    estado,
    socioId,
    search,
    q,
    page = 1,
    limit = 50
  } = req.query

  const searchTerm = search || q

  const pageNum = Math.max(1, parseInt(page) || 1)
  const limitNum = Math.max(1, parseInt(limit) || 50)
  const skip = (pageNum - 1) * limitNum

  // Construir filtros
  const where = {}

  if (estado) {
    where.estado = estado
  }

  if (socioId) {
    where.socioId = parseInt(socioId)
  }

  if (categoriaId) {
    where.categoriaActividadId = parseInt(categoriaId)
  }

  if (actividadId) {
    where.categoriaActividad = {
      actividadId: parseInt(actividadId)
    }
  }

  const socioFilter = buildSocioSearchFilter(searchTerm)
  if (socioFilter) where.socio = socioFilter

  const [inscripciones, total] = await Promise.all([
    req.db.inscripcion.findMany({
      where,
      include: {
        socio: {
          select: {
            id: true,
            nroSocio: true,
            apellidoNombre: true,
            documento: true,
            fechaNacimiento: true,
            email: true,
            celular: true
          }
        },
        categoriaActividad: {
          include: {
            actividad: true
          }
        }
      },
      orderBy: [
        { fechaInicio: 'desc' }
      ],
      skip,
      take: limitNum
    }),
    req.db.inscripcion.count({ where })
  ])

  // Calcular edad de cada socio
  const inscripcionesConEdad = inscripciones.map(insc => {
    const edad = Math.floor((new Date() - new Date(insc.socio.fechaNacimiento)) / (365.25 * 24 * 60 * 60 * 1000))
    return {
      ...insc,
      socio: {
        ...insc.socio,
        edad
      }
    }
  })

  res.json({
    success: true,
    data: inscripcionesConEdad,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    }
  })
}))

/**
 * POST /api/admin/inscripciones
 * Crear nueva inscripción con validaciones
 */
router.post('/inscripciones', authAdmin, asyncHandler(async (req, res) => {
  const {
    socioId,
    categoriaActividadId,
    centroCostoId,
    exentoCuota = false,
    porcentajeCuota = 100,
    fechaInicio
  } = req.body

  // Validaciones básicas
  if (!socioId || !categoriaActividadId) {
    throw new AppError('socioId y categoriaActividadId son requeridos', 400)
  }

  if (!centroCostoId) {
    throw new AppError('El Centro de Costo es obligatorio', 400, 'CC_REQUIRED')
  }

  // Verificar que el socio existe y está activo
  const socio = await req.db.socio.findUnique({
    where: { id: parseInt(socioId) },
    include: { categoriaSocioRel: true }
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404)
  }

  const estadosValidos = ['ACTIVO', 'VIGENTE']
  if (!estadosValidos.includes(socio.estado)) {
    throw new AppError(`El socio no está activo (estado: ${socio.estado})`, 400)
  }

  // Verificar que la categoría existe y está activa
  const categoria = await req.db.categoriaActividad.findUnique({
    where: { id: parseInt(categoriaActividadId) },
    include: {
      actividad: { include: { conceptoTesoreria: true } }
    }
  })

  if (!categoria) {
    throw new AppError('Categoría de actividad no encontrada', 404)
  }

  if (!categoria.activo) {
    throw new AppError('La categoría no está activa', 400)
  }

  // Validar edad del socio
  const edad = Math.floor((new Date() - new Date(socio.fechaNacimiento)) / (365.25 * 24 * 60 * 60 * 1000))

  if (categoria.edadMinima && edad < categoria.edadMinima) {
    throw new AppError(
      `El socio tiene ${edad} años. Edad mínima requerida: ${categoria.edadMinima} años`,
      400
    )
  }

  if (categoria.edadMaxima && edad > categoria.edadMaxima) {
    throw new AppError(
      `El socio tiene ${edad} años. Edad máxima permitida: ${categoria.edadMaxima} años`,
      400
    )
  }

  // Validar cupo máximo
  if (categoria.cupoMaximo && categoria.cupoMaximo > 0) {
    const inscriptosActivos = await req.db.inscripcion.count({
      where: {
        categoriaActividadId: parseInt(categoriaActividadId),
        estado: 'ACTIVA'
      }
    })

    if (inscriptosActivos >= categoria.cupoMaximo) {
      throw new AppError(
        `Cupo completo para ${categoria.nombre}. Máximo: ${categoria.cupoMaximo} inscriptos`,
        400
      )
    }
  }

  // Verificar que no esté ya inscripto en esta categoría
  const inscripcionExistente = await req.db.inscripcion.findFirst({
    where: {
      socioId: parseInt(socioId),
      categoriaActividadId: parseInt(categoriaActividadId),
      estado: 'ACTIVA'
    }
  })

  if (inscripcionExistente) {
    throw new AppError('El socio ya está inscripto en esta categoría', 400)
  }

  // Crear la inscripción
  const inscripcion = await req.db.inscripcion.create({
    data: {
      socioId: parseInt(socioId),
      categoriaActividadId: parseInt(categoriaActividadId),
      centroCostoId: parseInt(centroCostoId),
      fechaInicio: fechaInicio ? new Date(fechaInicio) : new Date(),
      estado: 'ACTIVA',
      exentoCuota: exentoCuota === true || exentoCuota === 'true',
      porcentajeCuota: parseFloat(porcentajeCuota) || 100
    },
    include: {
      socio: {
        select: {
          id: true,
          nroSocio: true,
          apellidoNombre: true,
          email: true
        }
      },
      categoriaActividad: {
        include: {
          actividad: true
        }
      }
    }
  })

  // Generar cargo de la cuota de actividad para el período correspondiente
  // según el día de corte configurado (mes corriente o siguiente).
  let cargoGenerado = null
  if (!inscripcion.exentoCuota) {
    const periodo = await resolverPeriodoAlta(req.db)
    const actividad = categoria.actividad

    // Determinar monto: concepto de tesorería de la actividad → categoría → actividad
    let montoBase = actividad.conceptoTesoreria?.cuotaMensual
      ? Number(actividad.conceptoTesoreria.cuotaMensual)
      : (categoria.cuotaMensual ? Number(categoria.cuotaMensual)
      : (actividad.cuotaMensual ? Number(actividad.cuotaMensual) : 0))

    if (montoBase > 0) {
      const pctInsc = parseFloat(porcentajeCuota) || 100
      if (pctInsc !== 100) montoBase = montoBase * (pctInsc / 100)

      const descuentoPct = socio.categoriaSocioRel?.porcentajeDescuento
        ? Number(socio.categoriaSocioRel.porcentajeDescuento)
        : 0
      const montoBonificacion = montoBase * (descuentoPct / 100)
      const montoTotal = montoBase - montoBonificacion

      // Verificar que no exista ya un cargo para esa categoría + período (anti-duplicado)
      const yaExiste = await req.db.cargo.findFirst({
        where: {
          socioId: parseInt(socioId),
          categoriaActividadId: parseInt(categoriaActividadId),
          periodoId: periodo.id,
        }
      })

      if (!yaExiste && montoTotal > 0) {
        cargoGenerado = await req.db.cargo.create({
          data: {
            socio: { connect: { id: parseInt(socioId) } },
            periodo: { connect: { id: periodo.id } },
            categoriaActividad: { connect: { id: parseInt(categoriaActividadId) } },
            ...(actividad.conceptoTesoreriaId ? {
              conceptoTesoreria: { connect: { id: actividad.conceptoTesoreriaId } }
            } : {}),
            categoria: 'CUOTA_ACTIVIDAD',
            descripcion: `${actividad.nombre} - ${categoria.nombre} - ${periodo.nombre}`,
            montoOriginal: montoBase,
            montoBonificacion,
            montoTotal,
            estado: 'PENDIENTE',
            fechaVencimiento: periodo.fechaVencimiento,
            origen: 'ALTA_INSCRIPCION',
            motivoBonificacion: descuentoPct > 0 ? `Descuento por categoría: ${descuentoPct}%` : null,
          }
        })
      }
    }
  }

  // Auditoría
  const { registrarEvento: regAuditInsc } = await import('../../services/auditoriaService.js')
  await regAuditInsc(req.db, {
    socioId: parseInt(socioId), tenantId: req.tenantId,
    evento: 'INSCRIPCION_ACT',
    detalle: {
      inscripcionId: inscripcion.id,
      actividad: categoria.actividad?.nombre,
      categoria: categoria.nombre,
      cargoGeneradoId: cargoGenerado?.id || null,
    },
    origen: 'UI', usuarioId: req.admin.id,
  })

  res.status(201).json({
    success: true,
    message: `${socio.apellidoNombre} inscripto en ${categoria.nombre}${cargoGenerado ? ` — cuota ${cargoGenerado.descripcion} generada` : ''}`,
    data: inscripcion,
    cargoGenerado,
  })
}))

/**
 * PUT /api/admin/inscripciones/:id
 * Actualizar inscripción
 */
router.put('/inscripciones/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { exentoCuota, porcentajeCuota, observaciones, centroCostoId } = req.body

  const inscripcion = await req.db.inscripcion.findUnique({
    where: { id: parseInt(id) }
  })

  if (!inscripcion) {
    throw new AppError('Inscripción no encontrada', 404)
  }

  const inscripcionActualizada = await req.db.inscripcion.update({
    where: { id: parseInt(id) },
    data: {
      exentoCuota: exentoCuota !== undefined ? (exentoCuota === true || exentoCuota === 'true') : undefined,
      porcentajeCuota: porcentajeCuota !== undefined ? parseFloat(porcentajeCuota) : undefined,
      observaciones: observaciones !== undefined ? observaciones : undefined,
      centroCostoId: centroCostoId !== undefined ? parseInt(centroCostoId) : undefined,
    },
    include: {
      socio: {
        select: {
          id: true,
          nroSocio: true,
          apellidoNombre: true
        }
      },
      categoriaActividad: {
        include: {
          actividad: true
        }
      }
    }
  })

  res.json({
    success: true,
    message: 'Inscripción actualizada',
    data: inscripcionActualizada
  })
}))

/**
 * DELETE /api/admin/inscripciones/:id
 * Dar de baja inscripción
 */
router.delete('/inscripciones/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { motivo } = req.body

  const inscripcion = await req.db.inscripcion.findUnique({
    where: { id: parseInt(id) },
    include: {
      socio: true,
      categoriaActividad: {
        include: {
          actividad: true
        }
      }
    }
  })

  if (!inscripcion) {
    throw new AppError('Inscripción no encontrada', 404)
  }

  // Dar de baja (cambiar estado a INACTIVA)
  const inscripcionBaja = await req.db.inscripcion.update({
    where: { id: parseInt(id) },
    data: {
      estado: 'INACTIVA',
      fechaFin: new Date(),
      observaciones: motivo || 'Baja sin motivo especificado'
    }
  })

  // Auditoría
  const { registrarEvento } = await import('../../services/auditoriaService.js')
  await registrarEvento(req.db, {
    socioId: inscripcion.socioId, tenantId: req.tenantId,
    evento: 'BAJA_INSCRIPCION',
    detalle: {
      inscripcionId: parseInt(id),
      actividad: inscripcion.categoriaActividad?.actividad?.nombre,
      categoria: inscripcion.categoriaActividad?.nombre,
      motivo: motivo || null,
    },
    origen: 'UI', usuarioId: req.admin.id,
  })

  res.json({
    success: true,
    message: `${inscripcion.socio.apellidoNombre} dado de baja de ${inscripcion.categoriaActividad.nombre}`,
    data: inscripcionBaja
  })
}))

/**
 * GET /api/admin/categorias-actividad/:id/plantel
 * Ver plantel (inscriptos) de una categoría
 */
router.get('/categorias-actividad/:id/plantel', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { incluirInactivos = false } = req.query

  const categoria = await req.db.categoriaActividad.findUnique({
    where: { id: parseInt(id) },
    include: {
      actividad: true
    }
  })

  if (!categoria) {
    throw new AppError('Categoría no encontrada', 404)
  }

  // Filtros de inscripciones
  const where = {
    categoriaActividadId: parseInt(id)
  }

  if (!incluirInactivos || incluirInactivos === 'false') {
    where.estado = 'ACTIVA'
  }

  const inscripciones = await req.db.inscripcion.findMany({
    where,
    include: {
      socio: {
        select: {
          id: true,
          nroSocio: true,
          apellidoNombre: true,
          documento: true,
          fechaNacimiento: true,
          email: true,
          celular: true,
          direccion: true
        }
      }
    },
    orderBy: [
      { socio: { apellidoNombre: 'asc' } }
    ]
  })

  // Calcular edad y agregar info adicional
  const plantel = inscripciones.map(insc => {
    const edad = Math.floor((new Date() - new Date(insc.socio.fechaNacimiento)) / (365.25 * 24 * 60 * 60 * 1000))
    return {
      ...insc,
      socio: {
        ...insc.socio,
        edad
      }
    }
  })

  // Obtener entrenadores asignados
  const entrenadores = await req.db.entrenadorCategoria.findMany({
    where: {
      categoriaActividadId: parseInt(id)
    },
    include: {
      entrenador: true
    }
  })

  res.json({
    success: true,
    data: {
      categoria: {
        id: categoria.id,
        nombre: categoria.nombre,
        actividad: categoria.actividad.nombre,
        edadMinima: categoria.edadMinima,
        edadMaxima: categoria.edadMaxima,
        cupoMaximo: categoria.cupoMaximo,
        cuotaMensual: categoria.cuotaMensual
      },
      plantel,
      entrenadores: entrenadores.map(ec => ec.entrenador),
      estadisticas: {
        totalInscriptos: plantel.length,
        activos: plantel.filter(p => p.estado === 'ACTIVA').length,
        inactivos: plantel.filter(p => p.estado === 'INACTIVA').length,
        cupoDisponible: categoria.cupoMaximo ? categoria.cupoMaximo - plantel.filter(p => p.estado === 'ACTIVA').length : null
      }
    }
  })
}))

/**
 * GET /api/admin/categorias-actividad/:id/plantel/excel
 * Exportar plantel a Excel
 */
router.get('/categorias-actividad/:id/plantel/excel', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const categoria = await req.db.categoriaActividad.findUnique({
    where: { id: parseInt(id) },
    include: {
      actividad: true
    }
  })

  if (!categoria) {
    throw new AppError('Categoría no encontrada', 404)
  }

  const inscripciones = await req.db.inscripcion.findMany({
    where: {
      categoriaActividadId: parseInt(id),
      estado: 'ACTIVA'
    },
    include: {
      socio: true
    },
    orderBy: [
      { socio: { apellidoNombre: 'asc' } }
    ]
  })

  // Preparar datos para Excel
  const data = inscripciones.map(insc => {
    const edad = Math.floor((new Date() - new Date(insc.socio.fechaNacimiento)) / (365.25 * 24 * 60 * 60 * 1000))
    return {
      'Nro Socio': insc.socio.nroSocio,
      'Apellido y Nombre': insc.socio.apellidoNombre,
      'DNI': insc.socio.documento,
      'Edad': edad,
      'Fecha Nacimiento': new Date(insc.socio.fechaNacimiento).toLocaleDateString('es-AR'),
      'Email': insc.socio.email || '',
      'Teléfono': insc.socio.celular || '',
      'Dirección': insc.socio.direccion || '',
      'Fecha Inicio': new Date(insc.fechaInicio).toLocaleDateString('es-AR'),
      'Exento Cuota': insc.exentoCuota ? 'Sí' : 'No',
      'Porcentaje Cuota': `${insc.porcentajeCuota}%`
    }
  })

  // Crear workbook
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(data)

  // Ajustar anchos de columnas
  const colWidths = [
    { wch: 12 }, // Nro Socio
    { wch: 30 }, // Apellido y Nombre
    { wch: 12 }, // DNI
    { wch: 6 },  // Edad
    { wch: 15 }, // Fecha Nacimiento
    { wch: 25 }, // Email
    { wch: 15 }, // Teléfono
    { wch: 30 }, // Dirección
    { wch: 15 }, // Fecha Inicio
    { wch: 12 }, // Exento Cuota
    { wch: 15 }  // Porcentaje Cuota
  ]
  ws['!cols'] = colWidths

  XLSX.utils.book_append_sheet(wb, ws, 'Plantel')

  // Generar buffer
  const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  // Nombre del archivo
  const filename = `Plantel_${categoria.actividad.nombre}_${categoria.nombre}_${new Date().toISOString().split('T')[0]}.xlsx`

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(excelBuffer)
}))

export default router
