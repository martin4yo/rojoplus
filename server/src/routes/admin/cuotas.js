import { Router } from 'express'
import { asyncHandler, AppError } from '../../middleware/errorHandler.js'
import { authAdmin } from '../../middleware/auth.js'
import { enviarReciboPago } from '../../services/email.js'
import { generarAsientoPagoCuota } from '../../services/asientosContables.js'

const router = Router()

// Función helper para calcular recargo de un cargo
async function calcularRecargoCargo(prisma, cargo) {
  if (!cargo.fechaVencimiento || cargo.estado !== 'PENDIENTE') {
    return { recargo: 0, porcentaje: 0, diasMora: 0, montoConRecargo: Number(cargo.montoTotal) }
  }

  const hoy = new Date()
  const vencimiento = new Date(cargo.fechaVencimiento)
  const diasMora = Math.floor((hoy - vencimiento) / (1000 * 60 * 60 * 24))

  if (diasMora <= 0) {
    return { recargo: 0, porcentaje: 0, diasMora: 0, montoConRecargo: Number(cargo.montoTotal) }
  }

  const config = await prisma.configuracionRecargo.findFirst({
    where: { activo: true },
  })

  if (!config || Number(config.porcentaje) === 0) {
    return { recargo: 0, porcentaje: 0, diasMora, montoConRecargo: Number(cargo.montoTotal) }
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
  const montoConRecargo = Number(cargo.montoTotal) + recargo

  return { recargo, porcentaje: porcentajeRecargo, diasMora, montoConRecargo }
}

// ============================================
// PERIODOS
// ============================================

// GET /api/admin/periodos - Listar periodos de cuota
router.get('/periodos', authAdmin, asyncHandler(async (req, res) => {
  const { anio } = req.query

  const where = {}
  if (anio) where.anio = parseInt(anio)

  const periodos = await req.prisma.periodo.findMany({
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
      req.req.db.cargo.aggregate({
        where: { periodoId: periodo.id },
        _sum: { montoTotal: true },
        _count: { _all: true },
      }),
      req.req.db.cargo.aggregate({
        where: { periodoId: periodo.id, estado: 'PAGADO' },
        _sum: { montoTotal: true },
        _count: { _all: true },
      }),
      req.req.db.cargo.aggregate({
        where: { periodoId: periodo.id, estado: 'PENDIENTE' },
        _sum: { montoTotal: true },
        _count: { _all: true },
      }),
      req.req.db.cargo.aggregate({
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

  const periodo = await req.prisma.periodo.findUnique({
    where: { id: parseInt(id) },
  })

  if (!periodo) {
    throw new AppError('Periodo no encontrado', 404, 'NOT_FOUND')
  }

  const stats = await req.req.db.cargo.groupBy({
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
  const periodoExistente = await req.prisma.periodo.findFirst({
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
    const configDia = await req.prisma.configuracion.findUnique({
      where: { clave: 'CUOTA_DIA_VENCIMIENTO' }
    })
    const configMismoMes = await req.prisma.configuracion.findUnique({
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

  const periodo = await req.prisma.periodo.create({
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

  const periodo = await req.prisma.periodo.findUnique({
    where: { id: parseInt(id) },
  })

  if (!periodo) {
    throw new AppError('Periodo no encontrado', 404, 'NOT_FOUND')
  }

  // Verificar si hay cuotas pagadas
  const cuotasPagadas = await req.req.db.cargo.count({
    where: {
      periodoId: periodo.id,
      estado: 'PAGADO',
    },
  })

  if (cuotasPagadas > 0) {
    throw new AppError('No se puede eliminar: hay cuotas pagadas en este periodo', 400, 'HAS_PAYMENTS')
  }

  // Eliminar cuotas pendientes del periodo
  await req.req.db.cargo.deleteMany({
    where: { periodoId: periodo.id },
  })

  // Eliminar el periodo
  await req.prisma.periodo.delete({
    where: { id: periodo.id },
  })

  res.json({ success: true, message: 'Periodo eliminado correctamente' })
}))

// POST /api/admin/periodos/:id/generar - Generar cuotas para un periodo
router.post('/periodos/:id/generar', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const periodo = await req.prisma.periodo.findUnique({
    where: { id: parseInt(id) },
  })

  if (!periodo) {
    throw new AppError('Periodo no encontrado', 404, 'NOT_FOUND')
  }

  // Obtener socios que YA tienen cuota social en este periodo (pueden ser de planes de pago)
  const sociosConCuotaSocial = await req.req.db.cargo.findMany({
    where: {
      periodoId: periodo.id,
      categoria: 'CUOTA_SOCIAL'
    },
    select: { socioId: true }
  })
  const sociosConCuotaSocialIds = new Set(sociosConCuotaSocial.map(c => c.socioId))

  // Obtener cargos de actividad que YA existen en este periodo (socio + categoriaActividad)
  const cargosActividad = await req.req.db.cargo.findMany({
    where: {
      periodoId: periodo.id,
      categoria: 'CUOTA_ACTIVIDAD'
    },
    select: { socioId: true, categoriaActividadId: true }
  })
  const actividadesConCargo = new Set(cargosActividad.map(c => `${c.socioId}-${c.categoriaActividadId}`))

  // Obtener socios activos con sus relaciones
  const socios = await req.req.db.socio.findMany({
    where: {
      OR: [
        { estado: { contains: 'Activ', mode: 'insensitive' } },
        { estado: { contains: 'Vigent', mode: 'insensitive' } },
      ],
    },
    include: {
      tipoSocioRel: true,
      categoriaSocioRel: true,
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
      const esFamilia = socio.tipoSocio?.toLowerCase().includes('familia')
      const tipoCuota = esFamilia ? 'GRUPO_FAMILIAR' : 'SOCIO_UNICO'

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
    await req.req.db.cargo.createMany({ data: cargosACrear })
  }

  // Actualizar estado del periodo (solo si se generaron nuevas cuotas o es la primera vez)
  const totalCuotasPeriodo = await req.req.db.cargo.count({
    where: { periodoId: periodo.id }
  })

  if (totalCuotasPeriodo > 0) {
    await req.prisma.periodo.update({
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
      sociosActivos: socios.length,
      sociosSaltados,
      inscripcionesSaltadas,
      mensaje,
    },
  })
}))

// ============================================
// CUOTAS
// ============================================

// GET /api/admin/cuotas - Listar cuotas con filtros
router.get('/cuotas', authAdmin, asyncHandler(async (req, res) => {
  const { periodoId, socioId, familiaId, estado, page = 1 } = req.query
  const limit = 50
  const skip = (parseInt(page) - 1) * limit

  const where = {}
  if (periodoId) where.periodoId = parseInt(periodoId)
  if (socioId) where.socioId = parseInt(socioId)
  if (familiaId) where.grupoFamiliarId = parseInt(familiaId)
  if (estado) where.estado = estado

  const [cuotas, total] = await Promise.all([
    req.req.db.cargo.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ fechaVencimiento: 'desc' }, { id: 'desc' }],
      include: {
        socio: { select: { id: true, nroSocio: true, apellidoNombre: true } },
        periodo: { select: { id: true, nombre: true, anio: true, mes: true } },
        categoriaActividad: {
          select: {
            id: true,
            nombre: true,
            actividad: { select: { id: true, nombre: true } },
          },
        },
      },
    }),
    req.req.db.cargo.count({ where }),
  ])

  res.json({
    success: true,
    data: {
      data: cuotas,
      pagination: {
        page: parseInt(page),
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  })
}))

// GET /api/admin/cuotas/socio/:socioId - Cuotas de un socio
router.get('/cuotas/socio/:socioId', authAdmin, asyncHandler(async (req, res) => {
  const { socioId } = req.params
  const { estado } = req.query

  const where = { socioId: parseInt(socioId) }
  if (estado) where.estado = estado

  const cuotas = await req.req.db.cargo.findMany({
    where,
    orderBy: [{ fechaVencimiento: 'desc' }],
    include: {
      periodo: { select: { id: true, nombre: true, anio: true, mes: true } },
      categoriaActividad: {
        select: {
          id: true,
          nombre: true,
          actividad: { select: { id: true, nombre: true } },
        },
      },
      pago: { select: { id: true, numero: true, fecha: true } },
    },
  })

  // Calcular totales
  const pendientes = cuotas.filter(c => c.estado === 'PENDIENTE')
  const totalPendiente = pendientes.reduce((sum, c) => sum + Number(c.montoTotal), 0)

  res.json({
    success: true,
    data: {
      cuotas,
      resumen: {
        totalCuotas: cuotas.length,
        cuotasPendientes: pendientes.length,
        totalPendiente,
      },
    },
  })
}))

// GET /api/admin/cuotas/familia/:titularId - Cuotas de una familia
router.get('/cuotas/familia/:titularId', authAdmin, asyncHandler(async (req, res) => {
  const { titularId } = req.params
  const { estado, periodoId } = req.query

  const where = { grupoFamiliarId: parseInt(titularId) }
  if (estado) where.estado = estado
  if (periodoId) where.periodoId = parseInt(periodoId)

  const cuotas = await req.req.db.cargo.findMany({
    where,
    orderBy: [{ fechaVencimiento: 'desc' }, { socioId: 'asc' }],
    include: {
      socio: { select: { id: true, nroSocio: true, apellidoNombre: true } },
      periodo: { select: { id: true, nombre: true, anio: true, mes: true } },
      categoriaActividad: {
        select: {
          id: true,
          nombre: true,
          actividad: { select: { id: true, nombre: true } },
        },
      },
      pago: { select: { id: true, numero: true, fecha: true } },
    },
  })

  // Agrupar por socio
  const cuotasPorSocio = {}
  for (const cuota of cuotas) {
    const key = cuota.socioId
    if (!cuotasPorSocio[key]) {
      cuotasPorSocio[key] = {
        socio: cuota.socio,
        cuotas: [],
        totalPendiente: 0,
      }
    }
    cuotasPorSocio[key].cuotas.push(cuota)
    if (cuota.estado === 'PENDIENTE') {
      cuotasPorSocio[key].totalPendiente += Number(cuota.montoTotal)
    }
  }

  // Calcular total familia
  const pendientes = cuotas.filter(c => c.estado === 'PENDIENTE')
  const totalFamilia = pendientes.reduce((sum, c) => sum + Number(c.montoTotal), 0)

  res.json({
    success: true,
    data: {
      cuotasPorSocio: Object.values(cuotasPorSocio),
      resumen: {
        totalCuotas: cuotas.length,
        cuotasPendientes: pendientes.length,
        totalFamilia,
      },
    },
  })
}))

// GET /api/admin/cuotas/cobranza/:socioId - Obtener cuotas para cobranza (detecta familia automáticamente)
router.get('/cuotas/cobranza/:socioId', authAdmin, asyncHandler(async (req, res) => {
  const { socioId } = req.params
  const { periodoId, estado } = req.query

  // Obtener el socio con info de familia
  const socio = await req.req.db.socio.findUnique({
    where: { id: parseInt(socioId) },
    include: {
      miembrosFamilia: { select: { id: true, nroSocio: true, apellidoNombre: true } },
    },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'NOT_FOUND')
  }

  // Determinar si es grupo familiar o socio único
  // Es familia si: tiene miembros O pertenece a un titular
  const esFamilia = socio.miembrosFamilia?.length > 0 || socio.titularFamiliaId !== null
  const titularId = socio.titularFamiliaId || socio.id

  // Construir query - por defecto solo trae cuotas PENDIENTES (cobrables)
  const where = {}
  if (estado) {
    where.estado = estado
  } else {
    // Por defecto solo traer cuotas pendientes (cobrables)
    where.estado = 'PENDIENTE'
  }
  if (periodoId) where.periodoId = parseInt(periodoId)

  if (esFamilia) {
    // Buscar por grupo familiar
    where.grupoFamiliarId = titularId
  } else {
    // Buscar solo del socio
    where.socioId = socio.id
  }

  const cuotasRaw = await req.req.db.cargo.findMany({
    where,
    orderBy: [{ periodo: { anio: 'desc' } }, { periodo: { mes: 'desc' } }, { socioId: 'asc' }],
    include: {
      socio: { select: { id: true, nroSocio: true, apellidoNombre: true } },
      periodo: { select: { id: true, nombre: true, anio: true, mes: true } },
      categoriaActividad: {
        select: {
          id: true,
          nombre: true,
          actividad: { select: { id: true, nombre: true } },
        },
      },
    },
  })

  // Calcular recargo para cada cuota
  const cuotas = await Promise.all(cuotasRaw.map(async (cuota) => {
    const recargoCalc = await calcularRecargoCargo(req.prisma, cuota)
    return {
      ...cuota,
      recargoCalculado: recargoCalc.recargo,
      porcentajeRecargo: recargoCalc.porcentaje,
      diasMora: recargoCalc.diasMora,
      montoConRecargo: Number(cuota.montoTotal) + recargoCalc.recargo,
    }
  }))

  // Agrupar por socio para mostrar claramente
  const cuotasPorSocio = {}
  for (const cuota of cuotas) {
    const key = cuota.socioId
    if (!cuotasPorSocio[key]) {
      cuotasPorSocio[key] = {
        socio: cuota.socio,
        cuotas: [],
        total: 0,
        totalConRecargo: 0,
      }
    }
    cuotasPorSocio[key].cuotas.push(cuota)
    cuotasPorSocio[key].total += Number(cuota.montoTotal)
    cuotasPorSocio[key].totalConRecargo += cuota.montoConRecargo
  }

  // Obtener titular si es familia
  let titular = null
  if (esFamilia && titularId !== socio.id) {
    titular = await req.req.db.socio.findUnique({
      where: { id: titularId },
      select: { id: true, nroSocio: true, apellidoNombre: true },
    })
  } else if (esFamilia) {
    titular = { id: socio.id, nroSocio: socio.nroSocio, apellidoNombre: socio.apellidoNombre }
  }

  const totalGeneral = cuotas.reduce((sum, c) => sum + Number(c.montoTotal), 0)
  const totalRecargo = cuotas.reduce((sum, c) => sum + c.recargoCalculado, 0)
  const totalConRecargo = totalGeneral + totalRecargo

  res.json({
    success: true,
    data: {
      esFamilia,
      titular,
      sociosPorCobrar: Object.values(cuotasPorSocio),
      cuotas, // Lista plana para facilitar selección
      resumen: {
        cantidadSocios: Object.keys(cuotasPorSocio).length,
        cantidadCuotas: cuotas.length,
        totalGeneral,
        totalRecargo,
        totalConRecargo,
      },
    },
  })
}))

// ============================================
// PAGOS
// ============================================

// GET /api/admin/pagos - Listar pagos
router.get('/pagos', authAdmin, asyncHandler(async (req, res) => {
  const { socioId, desde, hasta, page = 1 } = req.query
  const limit = 50
  const skip = (parseInt(page) - 1) * limit

  const where = { estado: 'CONFIRMADO' }
  if (socioId) where.socioId = parseInt(socioId)
  if (desde || hasta) {
    where.fecha = {}
    if (desde) where.fecha.gte = new Date(desde)
    if (hasta) where.fecha.lte = new Date(hasta)
  }

  const [pagos, total] = await Promise.all([
    req.req.db.pago.findMany({
      where,
      skip,
      take: limit,
      orderBy: { fecha: 'desc' },
      include: {
        socio: { select: { id: true, nroSocio: true, apellidoNombre: true } },
        medioPago: { select: { id: true, nombre: true } },
        cuotas: {
          select: {
            id: true,
            montoTotal: true,
            periodo: { select: { nombre: true } },
          },
        },
      },
    }),
    req.req.db.pago.count({ where }),
  ])

  res.json({
    success: true,
    data: pagos,
    pagination: {
      page: parseInt(page),
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  })
}))

// GET /api/admin/pagos/:id - Detalle de pago
router.get('/pagos/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const pago = await req.req.db.pago.findUnique({
    where: { id: parseInt(id) },
    include: {
      socio: {
        select: {
          id: true,
          nroSocio: true,
          apellidoNombre: true,
          documento: true,
          email: true,
          celular: true,
        },
      },
      medioPago: true,
      cuotas: {
        include: {
          periodo: { select: { nombre: true } },
          categoriaActividad: {
            select: {
              nombre: true,
              actividad: { select: { nombre: true } },
            },
          },
        },
      },
    },
  })

  if (!pago) {
    throw new AppError('Pago no encontrado', 404, 'NOT_FOUND')
  }

  res.json({ success: true, data: pago })
}))

// POST /api/admin/pagos - Registrar pago
router.post('/pagos', authAdmin, asyncHandler(async (req, res) => {
  const { socioId, cuotaIds, medioPagoId, cajaId, montoRecibido, observaciones } = req.body

  if (!socioId || !cuotaIds || !cuotaIds.length || !medioPagoId || !cajaId) {
    throw new AppError('socioId, cuotaIds, medioPagoId y cajaId son requeridos', 400, 'VALIDATION_ERROR')
  }

  // Obtener cuotas a pagar (fuera de transacción para validar)
  const cuotasRaw = await req.req.db.cargo.findMany({
    where: {
      id: { in: cuotaIds.map(id => parseInt(id)) },
      estado: 'PENDIENTE',
    },
    include: {
      categoriaActividad: {
        include: {
          actividad: true,
          conceptoTesoreria: true,
        }
      }
    }
  })

  if (cuotasRaw.length !== cuotaIds.length) {
    throw new AppError('Algunas cuotas no existen o ya están pagadas', 400, 'INVALID_CUOTAS')
  }

  // Calcular recargo para cada cuota
  const cuotas = await Promise.all(cuotasRaw.map(async (cuota) => {
    const recargoCalc = await calcularRecargoCargo(req.prisma, cuota)
    return {
      ...cuota,
      recargoCalculado: recargoCalc.recargo,
    }
  }))

  // Calcular total incluyendo recargos
  const montoBase = cuotas.reduce((sum, c) => sum + Number(c.montoTotal), 0)
  const totalRecargo = cuotas.reduce((sum, c) => sum + c.recargoCalculado, 0)
  const montoTotal = montoBase + totalRecargo
  const montoRecibidoNum = parseFloat(montoRecibido) || montoTotal

  // Obtener caja seleccionada
  const caja = await req.req.db.caja.findUnique({
    where: { id: parseInt(cajaId) },
    include: { cuentaContable: true },
  })

  if (!caja) {
    throw new AppError('La caja seleccionada no existe', 400, 'CAJA_NO_ENCONTRADA')
  }

  if (!caja.activo) {
    throw new AppError('La caja seleccionada está inactiva', 400, 'CAJA_INACTIVA')
  }

  if (!caja.cuentaContableId) {
    throw new AppError('La caja seleccionada no tiene una cuenta contable configurada. Por favor, configurá la cuenta contable en Tesorería > Cajas.', 400, 'CAJA_SIN_CUENTA_CONTABLE')
  }

  // Todo dentro de una transacción
  const pagoCompleto = await req.prisma.$transaction(async (tx) => {
    // Generar número de recibo (dentro de transacción para evitar duplicados)
    const ultimoPago = await tx.pago.findFirst({
      orderBy: { id: 'desc' },
      select: { numero: true },
    })
    const nuevoNumero = ultimoPago
      ? String(parseInt(ultimoPago.numero) + 1).padStart(8, '0')
      : '00000001'

    // Crear pago
    const pago = await tx.pago.create({
      data: {
        numero: nuevoNumero,
        socioId: parseInt(socioId),
        grupo_familiar_id: cuotas[0].grupoFamiliarId,
        montoTotal,
        montoRecibido: montoRecibidoNum,
        montoACuenta: montoRecibidoNum > montoTotal ? montoRecibidoNum - montoTotal : 0,
        medioPagoId: parseInt(medioPagoId),
        cajaId: caja.id,
        observaciones,
        registradoPor: req.admin.id,
      },
    })

    // Actualizar cada cuota con su recargo y marcar como pagada
    for (const cuota of cuotas) {
      const nuevoMontoRecargo = Number(cuota.montoRecargo) + cuota.recargoCalculado
      const nuevoMontoTotal = Number(cuota.montoOriginal) + nuevoMontoRecargo - Number(cuota.montoBonificacion)

      await tx.cargo.update({
        where: { id: cuota.id },
        data: {
          estado: 'PAGADO',
          fechaPago: new Date(),
          pagoId: pago.id,
          montoRecargo: nuevoMontoRecargo,
          montoTotal: nuevoMontoTotal,
        },
      })
    }

    // Actualizar saldo de caja
    await tx.caja.update({
      where: { id: caja.id },
      data: { saldoActual: { increment: montoTotal } },
    })

    // Determinar el concepto de tesorería según el tipo de cargo
    let conceptoCobranza = null

    // Si hay cuotas de actividad, intentar usar el concepto específico de la actividad
    const cuotasActividad = cuotas.filter(c => c.categoria === 'CUOTA_ACTIVIDAD' && c.categoriaActividad)
    if (cuotasActividad.length > 0) {
      const categoriaActividad = cuotasActividad[0].categoriaActividad
      if (categoriaActividad?.conceptoTesoreriaId) {
        conceptoCobranza = await tx.conceptoTesoreria.findUnique({
          where: { id: categoriaActividad.conceptoTesoreriaId }
        })
      }
    }

    // Si no se encontró concepto específico, usar el fallback de configuración
    if (!conceptoCobranza) {
      const configConcepto = await tx.configuracion.findUnique({
        where: { clave: 'CONCEPTO_COBRANZA_CUOTAS' }
      })

      if (!configConcepto || !configConcepto.valor) {
        throw new AppError(
          'No se configuró el concepto de tesorería para cobranza de cuotas. Por favor, configuralo en Configuración > Configuración General.',
          400,
          'CONCEPTO_NO_CONFIGURADO'
        )
      }

      conceptoCobranza = await tx.conceptoTesoreria.findUnique({
        where: { id: parseInt(configConcepto.valor) }
      })
    }

    if (!conceptoCobranza) {
      throw new AppError(
        'No se pudo determinar el concepto de tesorería para esta cobranza. Por favor, configurá los conceptos en Configuración.',
        400,
        'CONCEPTO_NO_ENCONTRADO'
      )
    }

    if (!conceptoCobranza.activo) {
      throw new AppError(
        'El concepto de tesorería para esta cobranza está inactivo. Por favor, activalo o configurá otro.',
        400,
        'CONCEPTO_INACTIVO'
      )
    }

    // Crear MovimientoCaja para tracking de tesoreria
    const anioMov = new Date().getFullYear()
    const prefijoMov = `MV-${anioMov}-`
    const ultimoMov = await tx.movimientoCaja.findFirst({
      where: { numero: { startsWith: prefijoMov } },
      orderBy: { numero: 'desc' }
    })
    let siguienteMov = 1
    if (ultimoMov) {
      const partesMov = ultimoMov.numero.split('-')
      siguienteMov = (parseInt(partesMov[partesMov.length - 1]) || 0) + 1
    }
    const numeroMov = `${prefijoMov}${String(siguienteMov).padStart(5, '0')}`

    await tx.movimientoCaja.create({
      data: {
        numero: numeroMov,
        cajaId: caja.id,
        cuentaContableId: caja.cuentaContableId,
        fecha: new Date(),
        tipo: 'INGRESO',
        concepto: conceptoCobranza.nombre,
        monto: montoTotal,
        descripcion: `Cobranza cuotas socio #${socioId} - Recibo ${nuevoNumero}`,
        pagoId: pago.id,
        registradoPor: req.admin.id,
        // Si la caja requiere conciliación, el movimiento queda pendiente (conciliado=false)
        // Si no requiere, se marca como conciliado automáticamente
        conciliado: !caja.requiereConciliacion
      }
    })

    // Obtener pago con relaciones para respuesta
    return await tx.pago.findUnique({
      where: { id: pago.id },
      include: {
        socio: {
          select: {
            id: true,
            nroSocio: true,
            apellidoNombre: true,
            documento: true,
            email: true,
          },
        },
        medioPago: { select: { id: true, nombre: true } },
        cargos: {
          include: {
            periodo: { select: { nombre: true } },
            categoriaActividad: {
              select: {
                nombre: true,
                actividad: { select: { nombre: true } },
              },
            },
          },
        },
      },
    })
  })

  // Generar asiento contable automático (fuera de transacción, no debe fallar el pago)
  generarAsientoPagoCuota(req.prisma, {
    pago: pagoCompleto,
    caja,
    cargos: pagoCompleto.cargos || [],
    registradoPor: req.admin.id,
  }).catch(err => {
    console.error('Error generando asiento contable para pago:', err)
  })

  // Enviar recibo por email (fuera de transacción, async)
  enviarReciboPago(pagoCompleto).catch(err => {
    console.error('Error enviando recibo por email:', err)
  })

  res.status(201).json({ success: true, data: pagoCompleto })
}))

// ============================================
// CRUD MEDIOS DE PAGO
// ============================================

// GET /api/admin/medios-pago - Listar medios de pago
router.get('/medios-pago', authAdmin, asyncHandler(async (req, res) => {
  const { activo } = req.query
  const where = activo !== undefined ? { activo: activo === 'true' } : {}

  const medios = await req.prisma.medioPago.findMany({
    where,
    orderBy: { orden: 'asc' },
  })
  res.json({ success: true, data: medios })
}))

// GET /api/admin/medios-pago/:id - Obtener medio de pago por ID
router.get('/medios-pago/:id', authAdmin, asyncHandler(async (req, res) => {
  const medio = await req.prisma.medioPago.findUnique({
    where: { id: parseInt(req.params.id) },
  })
  if (!medio) throw new AppError('Medio de pago no encontrado', 404, 'NOT_FOUND')
  res.json({ success: true, data: medio })
}))

// POST /api/admin/medios-pago - Crear medio de pago
router.post('/medios-pago', authAdmin, asyncHandler(async (req, res) => {
  const { codigo, nombre, tipo, requiereDatosBanco, comisionPct, orden, activo, paraCaja, paraBuffet, paraKiosco, paraTakeaway } = req.body

  if (!codigo || !nombre) {
    throw new AppError('Código y nombre son requeridos', 400, 'VALIDATION_ERROR')
  }

  // Verificar código único
  const existente = await req.prisma.medioPago.findUnique({ where: { codigo } })
  if (existente) {
    throw new AppError('Ya existe un medio de pago con ese código', 400, 'DUPLICATE_CODE')
  }

  const medio = await req.prisma.medioPago.create({
    data: {
      codigo,
      nombre,
      tipo: tipo || 'EFECTIVO',
      requiereDatosBanco: requiereDatosBanco || false,
      comisionPct: comisionPct || 0,
      orden: orden || 0,
      activo: activo !== false,
      paraCaja: paraCaja !== false,
      paraBuffet: paraBuffet !== false,
      paraKiosco: paraKiosco !== false,
      paraTakeaway: paraTakeaway !== false,
    },
  })

  res.status(201).json({ success: true, data: medio })
}))

// PUT /api/admin/medios-pago/:id - Actualizar medio de pago
router.put('/medios-pago/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { codigo, nombre, tipo, requiereDatosBanco, comisionPct, orden, activo, paraCaja, paraBuffet, paraKiosco, paraTakeaway } = req.body

  const existente = await req.prisma.medioPago.findUnique({ where: { id: parseInt(id) } })
  if (!existente) throw new AppError('Medio de pago no encontrado', 404, 'NOT_FOUND')

  // Verificar código único (si cambió)
  if (codigo && codigo !== existente.codigo) {
    const duplicado = await req.prisma.medioPago.findUnique({ where: { codigo } })
    if (duplicado) {
      throw new AppError('Ya existe un medio de pago con ese código', 400, 'DUPLICATE_CODE')
    }
  }

  const medio = await req.prisma.medioPago.update({
    where: { id: parseInt(id) },
    data: {
      ...(codigo !== undefined && { codigo }),
      ...(nombre !== undefined && { nombre }),
      ...(tipo !== undefined && { tipo }),
      ...(requiereDatosBanco !== undefined && { requiereDatosBanco }),
      ...(comisionPct !== undefined && { comisionPct }),
      ...(orden !== undefined && { orden }),
      ...(activo !== undefined && { activo }),
      ...(paraCaja !== undefined && { paraCaja }),
      ...(paraBuffet !== undefined && { paraBuffet }),
      ...(paraKiosco !== undefined && { paraKiosco }),
      ...(paraTakeaway !== undefined && { paraTakeaway }),
    },
  })

  res.json({ success: true, data: medio })
}))

// DELETE /api/admin/medios-pago/:id - Eliminar medio de pago
router.delete('/medios-pago/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  // Verificar si hay pagos usando este medio
  const pagosConMedio = await req.req.db.pago.count({
    where: { medioPagoId: parseInt(id) },
  })

  if (pagosConMedio > 0) {
    throw new AppError(
      `No se puede eliminar: hay ${pagosConMedio} pagos registrados con este medio`,
      400,
      'HAS_DEPENDENCIES'
    )
  }

  await req.prisma.medioPago.delete({ where: { id: parseInt(id) } })
  res.json({ success: true, message: 'Medio de pago eliminado' })
}))

export default router
