import { Router } from 'express'
import { asyncHandler, AppError } from '../../middleware/errorHandler.js'
import { authAdmin } from '../../middleware/auth.js'
import { enviarReciboPago } from '../../services/email.js'
import { generarAsientoPagoCuota } from '../../services/asientosContables.js'
import { notificarPago as notificarPagoWA, obtenerTelefonoSocio } from '../../services/whatsappService.js'
import { generarReciboPagoPDF } from '../../services/pdfGenerator.js'

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

// Función helper para calcular descuento por pago anticipado
async function calcularDescuentoAnticipado(prisma, cargo) {
  if (!cargo.fechaVencimiento || cargo.estado !== 'PENDIENTE') {
    return { descuento: 0, porcentaje: 0, diasRestantes: 0 }
  }

  const hoy = new Date()
  const vencimiento = new Date(cargo.fechaVencimiento)
  const diasRestantes = Math.floor((vencimiento - hoy) / (1000 * 60 * 60 * 24))

  if (diasRestantes <= 0) {
    return { descuento: 0, porcentaje: 0, diasRestantes: 0 }
  }

  const [cfgActivo, cfgPct, cfgDias] = await Promise.all([
    prisma.configuracion.findFirst({ where: { clave: 'DESCUENTO_ANTICIPADO_ACTIVO' } }),
    prisma.configuracion.findFirst({ where: { clave: 'DESCUENTO_ANTICIPADO_PCT' } }),
    prisma.configuracion.findFirst({ where: { clave: 'DESCUENTO_ANTICIPADO_DIAS' } }),
  ])

  if (cfgActivo?.valor !== 'true') return { descuento: 0, porcentaje: 0, diasRestantes }

  const pct = parseFloat(cfgPct?.valor || '0')
  const diasMin = parseInt(cfgDias?.valor || '0')

  if (pct === 0) return { descuento: 0, porcentaje: 0, diasRestantes }
  if (diasMin > 0 && diasRestantes < diasMin) return { descuento: 0, porcentaje: 0, diasRestantes }

  const descuento = Math.round(Number(cargo.montoOriginal) * pct / 100)
  return { descuento, porcentaje: pct, diasRestantes }
}

// ============================================
// PERIODOS
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

  // Verificar si ya existe un periodo con el mismo año/mes para este tenant
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

  const nombre = `${String(mesInt).padStart(2, '0')} / ${anio}`

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
    where: {
      OR: [
        { estado: { contains: 'Activ', mode: 'insensitive' } },
        { estado: { contains: 'Vigent', mode: 'insensitive' } },
      ],
    },
    include: {
      tipoSocioRel: { include: { conceptoTesoreria: true } },
      categoriaSocioRel: true,
      inscripciones: {
        where: { estado: 'ACTIVA' },
        include: {
          categoriaActividad: {
            include: { actividad: { include: { conceptoTesoreria: true } } },
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
    const cuotaSocialMonto = socio.tipoSocioRel?.conceptoTesoreria?.cuotaMensual
      ? Number(socio.tipoSocioRel.conceptoTesoreria.cuotaMensual)
      : Number(socio.tipoSocioRel?.cuotaMensual || 0)

    if (!cuotaSocialMonto) {
      sociosSinCuotaMensual++
    }

    if (esTitularOUnico && cuotaSocialMonto && !yaTeníaCuotaSocial) {
      const montoBase = cuotaSocialMonto
      const montoBonificacion = montoBase * (descuentoPct / 100)
      const montoTotal = montoBase - montoBonificacion

      if (montoTotal > 0) {
        const esFamilia = socio.tipoSocio?.toLowerCase().includes('familia')
        const tipoCuota = esFamilia ? 'GRUPO_FAMILIAR' : 'SOCIO_UNICO'

        cargosACrear.push({
          periodoId: periodo.id,
          socioId: socio.id,
          grupoFamiliarId: socio.titularFamiliaId || socio.id,
          categoria: 'CUOTA_SOCIAL',
          tipoCuota,
          conceptoTesoreriaId: socio.tipoSocioRel?.conceptoTesoreriaId || null,
          descripcion: `Cuota Social - ${tipoCuota === 'GRUPO_FAMILIAR' ? 'Grupo Familiar' : 'Socio Único'}`,
          montoOriginal: montoBase,
          montoBonificacion,
          montoTotal,
          estado: 'PENDIENTE',
          fechaVencimiento: periodo.fechaVencimiento,
          origen: 'GENERACION_MASIVA',
          motivoBonificacion: descuentoPct > 0 ? `Descuento por categoría: ${descuentoPct}%` : null,
        })
      }
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

      // Determinar monto: concepto de tesorería de la actividad → categoría → actividad (fallbacks)
      let montoBase = actividad.conceptoTesoreria?.cuotaMensual
        ? Number(actividad.conceptoTesoreria.cuotaMensual)
        : (categoria.cuotaMensual ? Number(categoria.cuotaMensual) : (actividad.cuotaMensual ? Number(actividad.cuotaMensual) : 0))

      // Aplicar porcentaje de inscripción si no es 100%
      if (inscripcion.porcentajeCuota && Number(inscripcion.porcentajeCuota) !== 100) {
        montoBase = montoBase * (Number(inscripcion.porcentajeCuota) / 100)
      }

      if (montoBase > 0) {
        const montoBonificacion = montoBase * (descuentoPct / 100)
        const montoTotal = montoBase - montoBonificacion

        if (montoTotal > 0) {
          cargosACrear.push({
            periodoId: periodo.id,
            socioId: socio.id,
            grupoFamiliarId: socio.titularFamiliaId || socio.id,
            categoria: 'CUOTA_ACTIVIDAD',
            categoriaActividadId: categoria.id,
            conceptoTesoreriaId: actividad.conceptoTesoreriaId || null,
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
  const { periodoId, socioId, familiaId, estado, q, page = 1 } = req.query
  const limit = 50
  const skip = (parseInt(page) - 1) * limit

  const where = {}
  if (periodoId) where.periodoId = parseInt(periodoId)
  if (socioId) where.socioId = parseInt(socioId)
  if (familiaId) where.grupoFamiliarId = parseInt(familiaId)
  if (estado) where.estado = estado
  if (q && q.trim()) {
    const term = q.trim()
    where.socio = {
      OR: [
        { apellidoNombre: { contains: term, mode: 'insensitive' } },
        { documento: { contains: term } },
        { nroSocio: { contains: term } },
      ],
    }
  }

  const [cuotas, total, agregadosPorEstado] = await Promise.all([
    req.db.cargo.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ socio: { apellidoNombre: 'asc' } }, { fechaVencimiento: 'asc' }],
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
    req.db.cargo.count({ where }),
    req.db.cargo.groupBy({
      where,
      by: ['estado'],
      _sum: { montoTotal: true },
      _count: { _all: true },
    }),
  ])

  // Construir totales agregados sobre TODO el filtro (no sólo la página actual)
  const totales = { total: 0, pagado: 0, pendiente: 0, cantTotal: total, cantPagado: 0, cantPendiente: 0 }
  for (const g of agregadosPorEstado) {
    const monto = Number(g._sum.montoTotal || 0)
    const cant = g._count._all || 0
    totales.total += monto
    if (g.estado === 'PAGADO') {
      totales.pagado += monto
      totales.cantPagado += cant
    } else if (g.estado === 'PENDIENTE') {
      totales.pendiente += monto
      totales.cantPendiente += cant
    }
  }

  res.json({
    success: true,
    data: {
      data: cuotas,
      totales,
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

  const cuotas = await req.db.cargo.findMany({
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

  const cuotas = await req.db.cargo.findMany({
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
  const socio = await req.db.socio.findUnique({
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

  // Si es miembro (no titular), cargar los miembros del titular para tener la lista completa
  let todosMiembros = socio.miembrosFamilia || []
  if (esFamilia && socio.titularFamiliaId) {
    const titular = await req.db.socio.findUnique({
      where: { id: titularId },
      include: { miembrosFamilia: { select: { id: true, nroSocio: true, apellidoNombre: true } } },
    })
    todosMiembros = titular?.miembrosFamilia || []
  }

  // Construir query - por defecto solo trae cuotas PENDIENTES (cobrables)
  const where = {}
  if (estado) {
    where.estado = estado
  } else {
    // Por defecto solo traer cuotas pendientes (cobrables)
    where.estado = 'PENDIENTE'
  }
  if (periodoId) {
    // Incluir cargos del período Y cargos sin período (masivos/manuales sin período asignado)
    where.AND = [
      { OR: [{ periodoId: parseInt(periodoId) }, { periodoId: null }] }
    ]
  }

  if (esFamilia) {
    // Buscar por grupo familiar (incluye cargos creados sin grupoFamiliarId)
    const allSocioIds = [titularId, ...todosMiembros.map(m => m.id)]
    where.OR = [
      { grupoFamiliarId: titularId },
      { socioId: { in: allSocioIds }, grupoFamiliarId: null },
    ]
  } else {
    // Buscar solo del socio
    where.socioId = socio.id
  }

  const cuotasRaw = await req.db.cargo.findMany({
    where,
    orderBy: [{ socio: { apellidoNombre: 'asc' } }, { periodo: { anio: 'desc' } }, { periodo: { mes: 'desc' } }],
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
      conceptoTesoreria: { select: { id: true, codigo: true, nombre: true } },
    },
  })

  // Calcular recargo y descuento anticipado para cada cuota
  const cuotas = await Promise.all(cuotasRaw.map(async (cuota) => {
    const [recargoCalc, descuentoCalc] = await Promise.all([
      calcularRecargoCargo(req.prisma, cuota),
      calcularDescuentoAnticipado(req.prisma, cuota),
    ])
    const montoFinal = Number(cuota.montoTotal) + recargoCalc.recargo - descuentoCalc.descuento
    return {
      ...cuota,
      recargoCalculado: recargoCalc.recargo,
      porcentajeRecargo: recargoCalc.porcentaje,
      diasMora: recargoCalc.diasMora,
      descuentoCalculado: descuentoCalc.descuento,
      porcentajeDescuentoAnticipado: descuentoCalc.porcentaje,
      diasRestantes: descuentoCalc.diasRestantes,
      montoConRecargo: montoFinal,
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
    titular = await req.db.socio.findUnique({
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
      sociosPorCobrar: Object.values(cuotasPorSocio).sort((a, b) =>
        a.socio.apellidoNombre.localeCompare(b.socio.apellidoNombre, 'es', { sensitivity: 'base' })
      ),
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
// ADELANTAR CUOTAS
// ============================================

/**
 * Helper: encuentra o crea un período (anio, mes) calculando vencimiento
 * desde la configuración del tenant. Devuelve el período.
 */
async function obtenerOCrearPeriodo(db, anio, mes, generadoPor) {
  const existente = await db.periodo.findFirst({ where: { anio, mes } })
  if (existente) return existente

  // Cargar config para calcular vencimiento (mismo cálculo que POST /periodos)
  const [configDia, configMismoMes] = await Promise.all([
    db.configuracion.findFirst({ where: { clave: 'CUOTA_DIA_VENCIMIENTO' } }),
    db.configuracion.findFirst({ where: { clave: 'CUOTA_VENCE_MISMO_MES' } }),
  ])
  const diaVenc = configDia ? parseInt(configDia.valor) : 10
  const venceMismoMes = configMismoMes ? configMismoMes.valor === 'true' : false

  let mesVenc = mes
  let anioVenc = anio
  if (!venceMismoMes) {
    mesVenc = mes + 1
    if (mesVenc > 12) { mesVenc = 1; anioVenc = anio + 1 }
  }
  const fechaVenc = new Date(anioVenc, mesVenc - 1, diaVenc)
  const nombre = `${String(mes).padStart(2, '0')} / ${anio}`

  return await db.periodo.create({
    data: {
      anio, mes, nombre,
      fechaVencimiento: fechaVenc,
      estado: 'PENDIENTE',
    },
  })
}

/**
 * Helper: arma los cargos a crear para un socio en un período dado, usando
 * la misma lógica que la generación masiva (cuota social + cuotas de actividad).
 */
function armarCargosParaSocio(socio, periodo) {
  const cargos = []
  const descuentoPct = socio.categoriaSocioRel?.porcentajeDescuento
    ? Number(socio.categoriaSocioRel.porcentajeDescuento)
    : 0

  // Cuota social: solo titulares o socios únicos
  const esTitularOUnico = !socio.titularFamiliaId
  const cuotaSocialMonto = socio.tipoSocioRel?.conceptoTesoreria?.cuotaMensual
    ? Number(socio.tipoSocioRel.conceptoTesoreria.cuotaMensual)
    : Number(socio.tipoSocioRel?.cuotaMensual || 0)

  if (esTitularOUnico && cuotaSocialMonto) {
    const montoBase = cuotaSocialMonto
    const montoBonificacion = montoBase * (descuentoPct / 100)
    const montoTotal = montoBase - montoBonificacion
    if (montoTotal > 0) {
      const esFamilia = socio.tipoSocio?.toLowerCase().includes('familia')
      const tipoCuota = esFamilia ? 'GRUPO_FAMILIAR' : 'SOCIO_UNICO'
      cargos.push({
        periodoId: periodo.id,
        socioId: socio.id,
        grupoFamiliarId: socio.titularFamiliaId || socio.id,
        categoria: 'CUOTA_SOCIAL',
        tipoCuota,
        conceptoTesoreriaId: socio.tipoSocioRel?.conceptoTesoreriaId || null,
        descripcion: `Cuota Social - ${tipoCuota === 'GRUPO_FAMILIAR' ? 'Grupo Familiar' : 'Socio Único'} (adelantada)`,
        montoOriginal: montoBase,
        montoBonificacion,
        montoTotal,
        estado: 'PENDIENTE',
        fechaVencimiento: periodo.fechaVencimiento,
        origen: 'ADELANTO',
        motivoBonificacion: descuentoPct > 0 ? `Descuento por categoría: ${descuentoPct}%` : null,
      })
    }
  }

  // Cuotas de actividad (inscripciones activas)
  for (const inscripcion of socio.inscripciones || []) {
    if (inscripcion.exentoCuota) continue
    const categoria = inscripcion.categoriaActividad
    const actividad = categoria?.actividad
    if (!actividad) continue

    let montoBase = actividad.conceptoTesoreria?.cuotaMensual
      ? Number(actividad.conceptoTesoreria.cuotaMensual)
      : (categoria.cuotaMensual ? Number(categoria.cuotaMensual) : (actividad.cuotaMensual ? Number(actividad.cuotaMensual) : 0))

    if (inscripcion.porcentajeCuota && Number(inscripcion.porcentajeCuota) !== 100) {
      montoBase = montoBase * (Number(inscripcion.porcentajeCuota) / 100)
    }
    if (montoBase > 0) {
      const montoBonificacion = montoBase * (descuentoPct / 100)
      const montoTotal = montoBase - montoBonificacion
      if (montoTotal > 0) {
        cargos.push({
          periodoId: periodo.id,
          socioId: socio.id,
          grupoFamiliarId: socio.titularFamiliaId || socio.id,
          categoria: 'CUOTA_ACTIVIDAD',
          categoriaActividadId: categoria.id,
          conceptoTesoreriaId: actividad.conceptoTesoreriaId || null,
          descripcion: `${actividad.nombre} - ${categoria.nombre} (adelantada)`,
          montoOriginal: montoBase,
          montoBonificacion,
          montoTotal,
          estado: 'PENDIENTE',
          fechaVencimiento: periodo.fechaVencimiento,
          origen: 'ADELANTO',
          motivoBonificacion: descuentoPct > 0 ? `Descuento por categoría: ${descuentoPct}%` : null,
        })
      }
    }
  }

  return cargos
}

// POST /api/admin/cuotas/adelantar - Adelantar N meses de cuotas para un socio
router.post('/cuotas/adelantar', authAdmin, asyncHandler(async (req, res) => {
  const { socioId, meses } = req.body
  const N = parseInt(meses)

  if (!socioId || !N || N < 1 || N > 24) {
    throw new AppError('socioId requerido y meses entre 1 y 24', 400, 'VALIDATION_ERROR')
  }

  // Cargar el socio con todas las relaciones que necesita el cálculo
  const socio = await req.db.socio.findUnique({
    where: { id: parseInt(socioId) },
    include: {
      tipoSocioRel: { include: { conceptoTesoreria: true } },
      categoriaSocioRel: true,
      inscripciones: {
        where: { estado: 'ACTIVA' },
        include: {
          categoriaActividad: {
            include: { actividad: { include: { conceptoTesoreria: true } } },
          },
        },
      },
    },
  })

  if (!socio) throw new AppError('Socio no encontrado', 404, 'NOT_FOUND')

  // Determinar el último mes/año para el que el socio ya tiene cargos
  const ultimoCargo = await req.db.cargo.findFirst({
    where: { socioId: socio.id, periodoId: { not: null } },
    include: { periodo: { select: { anio: true, mes: true } } },
    orderBy: [
      { periodo: { anio: 'desc' } },
      { periodo: { mes: 'desc' } },
    ],
  })

  let anioBase, mesBase
  if (ultimoCargo?.periodo) {
    // Empezar desde el mes siguiente al último
    anioBase = ultimoCargo.periodo.anio
    mesBase = ultimoCargo.periodo.mes
  } else {
    // Sin cargos previos: empezar desde el mes actual
    const hoy = new Date()
    anioBase = hoy.getFullYear()
    mesBase = hoy.getMonth() + 1 - 1 // -1 porque vamos a sumar antes del primer ciclo
  }

  let totalCargosCreados = 0
  let mesesProcesados = 0
  const periodosCreados = []

  for (let i = 0; i < N; i++) {
    mesBase += 1
    if (mesBase > 12) { mesBase = 1; anioBase += 1 }

    const periodo = await obtenerOCrearPeriodo(req.db, anioBase, mesBase, req.admin.id)

    // Verificar que el socio NO tenga ya cargos en este período (idempotente)
    const yaTiene = await req.db.cargo.count({
      where: { socioId: socio.id, periodoId: periodo.id },
    })
    if (yaTiene > 0) continue

    const cargos = armarCargosParaSocio(socio, periodo)
    if (cargos.length > 0) {
      await req.db.cargo.createMany({ data: cargos })
      totalCargosCreados += cargos.length
      periodosCreados.push(`${String(mesBase).padStart(2, '0')}/${anioBase}`)
    }
    mesesProcesados += 1
  }

  res.json({
    success: true,
    data: {
      cargosCreados: totalCargosCreados,
      mesesProcesados,
      periodos: periodosCreados,
      mensaje: totalCargosCreados > 0
        ? `Se generaron ${totalCargosCreados} cargo(s) adelantado(s) para ${periodosCreados.length} período(s): ${periodosCreados.join(', ')}`
        : 'No se generaron cargos nuevos (puede que el socio ya los tuviera o que no tenga cuotas configuradas).',
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
    req.db.pago.findMany({
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
    req.db.pago.count({ where }),
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

  const pago = await req.db.pago.findUnique({
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

// GET /api/admin/pagos/:id/recibo-pdf - Descargar recibo como PDF
router.get('/pagos/:id/recibo-pdf', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const pago = await req.db.pago.findUnique({
    where: { id: parseInt(id) },
    include: {
      socio: {
        select: { id: true, nroSocio: true, apellidoNombre: true, documento: true, email: true, celular: true, celularSecundario: true, telefonoFijo: true, domicilio: true, ciudad: true, calle: true, codigoPostal: true, estado: true }
      },
      medioPago: { select: { id: true, nombre: true } },
      caja: { select: { nombre: true } },
      mediosPago: {
        include: {
          medioPago: { select: { nombre: true } },
          caja: { select: { nombre: true } }
        }
      },
      saldosAplicados: { include: { saldoFavor: { select: { id: true, motivo: true, origen: true } } } },
      cargos: {
        include: {
          conceptoTesoreria: { select: { id: true, nombre: true } },
          periodo: { select: { nombre: true } },
          categoriaActividad: {
            select: { nombre: true, actividad: { select: { nombre: true } } }
          }
        }
      }
    }
  })

  if (!pago) throw new AppError('Pago no encontrado', 404, 'NOT_FOUND')

  const admin = await req.db.admin.findUnique({
    where: { id: pago.registradoPor },
    select: { nombre: true }
  }).catch(() => null)

  const config = await req.db.configuracion.findMany({
    where: { clave: { in: ['CLUB_NOMBRE', 'CLUB_DIRECCION', 'CLUB_TELEFONO'] } },
    select: { clave: true, valor: true }
  }).catch(() => [])

  const configMap = Object.fromEntries(config.map(c => [c.clave, c.valor]))

  // El logo viene del Tenant (req.tenant.logoUrl) — path relativo a /uploads/
  if (req.tenant?.logoUrl) {
    configMap.CLUB_LOGO_URL = req.tenant.logoUrl
  }

  const pdfBuffer = await generarReciboPagoPDF(pago, admin?.nombre || '', configMap)

  const nombreSocio = (pago.socio?.apellidoNombre || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // quitar acentos
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim().replace(/\s+/g, '_')
  const filename = `recibo-${pago.numero}-${nombreSocio}.pdf`

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(pdfBuffer)
}))

// POST /api/admin/pagos/:id/enviar-recibo - Reenviar recibo por email y/o WhatsApp
router.post('/pagos/:id/enviar-recibo', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { canales = ['email'] } = req.body

  // Mismo include que /recibo-pdf para poder armar el PDF y adjuntarlo
  const pago = await req.db.pago.findUnique({
    where: { id: parseInt(id) },
    include: {
      socio: {
        select: { id: true, nroSocio: true, apellidoNombre: true, documento: true, email: true, celular: true, celularSecundario: true, telefonoFijo: true, notifWhatsapp: true, domicilio: true, ciudad: true, calle: true, codigoPostal: true, estado: true }
      },
      medioPago: { select: { id: true, nombre: true } },
      caja: { select: { nombre: true } },
      mediosPago: {
        include: {
          medioPago: { select: { nombre: true } },
          caja: { select: { nombre: true } }
        }
      },
      saldosAplicados: { include: { saldoFavor: { select: { id: true, motivo: true, origen: true } } } },
      cargos: {
        include: {
          conceptoTesoreria: { select: { id: true, nombre: true } },
          periodo: { select: { nombre: true } },
          categoriaActividad: {
            select: { nombre: true, actividad: { select: { nombre: true } } }
          }
        }
      }
    }
  })

  if (!pago) throw new AppError('Pago no encontrado', 404, 'NOT_FOUND')

  // Generar PDF del recibo (si falla, igual seguimos el envío sin adjunto)
  let pdfBuffer = null
  let pdfFilename = `recibo-${pago.numero}.pdf`
  try {
    const [admin, configList] = await Promise.all([
      req.db.admin.findUnique({ where: { id: pago.registradoPor }, select: { nombre: true } }).catch(() => null),
      req.db.configuracion.findMany({
        where: { clave: { in: ['CLUB_NOMBRE', 'CLUB_DIRECCION', 'CLUB_TELEFONO'] } },
        select: { clave: true, valor: true }
      }).catch(() => []),
    ])
    const configMap = Object.fromEntries(configList.map(c => [c.clave, c.valor]))
    if (req.tenant?.logoUrl) configMap.CLUB_LOGO_URL = req.tenant.logoUrl

    pdfBuffer = await generarReciboPagoPDF(pago, admin?.nombre || '', configMap)

    const nombreSocio = (pago.socio?.apellidoNombre || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim().replace(/\s+/g, '_')
    pdfFilename = `recibo-${pago.numero}${nombreSocio ? '-' + nombreSocio : ''}.pdf`
  } catch (err) {
    console.error('Error generando PDF de recibo (se enviará sin adjunto):', err.message)
  }

  const resultados = {}

  if (canales.includes('email')) {
    if (!pago.socio?.email) {
      resultados.email = { ok: false, mensaje: 'El socio no tiene email registrado' }
    } else {
      try {
        const r = await enviarReciboPago(pago, req.db, pdfBuffer ? { pdfBuffer, pdfFilename } : {})
        if (r && r.ok) {
          resultados.email = { ok: true, mensaje: `Recibo enviado a ${pago.socio.email}${pdfBuffer ? ' (con PDF adjunto)' : ''}` }
        } else {
          resultados.email = { ok: false, mensaje: r?.motivo || 'No se pudo enviar el email (revisá la configuración SMTP)' }
        }
      } catch (err) {
        resultados.email = { ok: false, mensaje: err.message }
      }
    }
  }

  if (canales.includes('whatsapp')) {
    const tel = obtenerTelefonoSocio(pago.socio)
    if (!tel) {
      resultados.whatsapp = { ok: false, mensaje: 'El socio no tiene teléfono registrado' }
    } else {
      try {
        const r = await notificarPagoWA({ db: req.db, socio: pago.socio, pago, pdfBuffer, pdfFilename })
        if (r && r.enviado) {
          resultados.whatsapp = { ok: true, mensaje: `Mensaje enviado a ${tel}${pdfBuffer ? ' (con PDF adjunto)' : ''}` }
        } else {
          resultados.whatsapp = { ok: false, mensaje: r?.motivo || 'No se pudo enviar el mensaje (revisá la configuración de WhatsApp)' }
        }
      } catch (err) {
        resultados.whatsapp = { ok: false, mensaje: err.message }
      }
    }
  }

  res.json({ success: true, data: resultados })
}))

// POST /api/admin/pagos - Registrar pago
// Body: { socioId, cuotaIds, mediosPago?: [{ medioPagoId, cajaId, monto }],
//         saldosAplicados?: [{ saldoFavorId, monto }], montoRecibido?, observaciones? }
router.post('/pagos', authAdmin, asyncHandler(async (req, res) => {
  const { socioId, cuotaIds, medioPagoId, cajaId, montoRecibido, observaciones,
          mediosPago: mediosPagoInput, saldosAplicados: saldosInput } = req.body

  if (!socioId || !cuotaIds || !cuotaIds.length) {
    throw new AppError('socioId y cuotaIds son requeridos', 400, 'VALIDATION_ERROR')
  }

  // Saldos a favor a aplicar
  const saldosAplicar = Array.isArray(saldosInput)
    ? saldosInput
        .map(s => ({ saldoFavorId: parseInt(s.saldoFavorId), monto: parseFloat(s.monto) }))
        .filter(s => s.saldoFavorId && s.monto > 0)
    : []
  const sumaSaldos = saldosAplicar.reduce((s, x) => s + x.monto, 0)

  // Normalizar splits: aceptar array nuevo O par medioPagoId/cajaId legacy
  let splits // [{ medioPagoId, cajaId, monto }]
  if (Array.isArray(mediosPagoInput) && mediosPagoInput.length > 0) {
    splits = mediosPagoInput.map(s => ({
      medioPagoId: parseInt(s.medioPagoId),
      cajaId: parseInt(s.cajaId),
      monto: parseFloat(s.monto),
    }))
  } else if (medioPagoId && cajaId) {
    splits = [{ medioPagoId: parseInt(medioPagoId), cajaId: parseInt(cajaId), monto: null }] // monto se calcula después
  } else if (saldosAplicar.length > 0) {
    // Cobranza 100% con saldo a favor — sin medios de pago en efectivo
    splits = []
  } else {
    throw new AppError('Debe indicar al menos un medio de pago, caja o saldo a favor', 400, 'VALIDATION_ERROR')
  }

  // Obtener cuotas a pagar (fuera de transacción para validar)
  const cuotasRaw = await req.db.cargo.findMany({
    where: {
      id: { in: cuotaIds.map(id => parseInt(id)) },
      estado: 'PENDIENTE',
    },
    include: {
      conceptoTesoreria: true,
      categoriaActividad: {
        include: {
          actividad: { include: { conceptoTesoreria: true } },
          conceptoTesoreria: true,
        }
      }
    }
  })

  if (cuotasRaw.length !== cuotaIds.length) {
    throw new AppError('Algunas cuotas no existen o ya están pagadas', 400, 'INVALID_CUOTAS')
  }

  // Calcular recargo y descuento anticipado para cada cuota
  const cuotas = await Promise.all(cuotasRaw.map(async (cuota) => {
    const [recargoCalc, descuentoCalc] = await Promise.all([
      calcularRecargoCargo(req.prisma, cuota),
      calcularDescuentoAnticipado(req.prisma, cuota),
    ])
    return {
      ...cuota,
      recargoCalculado: recargoCalc.recargo,
      descuentoCalculado: descuentoCalc.descuento,
      porcentajeDescuentoAnticipado: descuentoCalc.porcentaje,
    }
  }))

  // Calcular total incluyendo recargos y descuentos
  const montoBase = cuotas.reduce((sum, c) => sum + Number(c.montoTotal), 0)
  const totalRecargo = cuotas.reduce((sum, c) => sum + c.recargoCalculado, 0)
  const totalDescuento = cuotas.reduce((sum, c) => sum + c.descuentoCalculado, 0)
  const montoTotal = montoBase + totalRecargo - totalDescuento
  const montoRecibidoNum = parseFloat(montoRecibido) || montoTotal

  // Si el split legacy no tiene monto, asignar el total descontado el saldo aplicado
  if (splits.length > 0 && splits[0].monto === null) {
    splits[0].monto = montoTotal - sumaSaldos
  }

  // Validar que (cash + saldos) coincida con el total (tolerancia $1 por redondeo)
  const sumaSplits = splits.reduce((s, sp) => s + sp.monto, 0)
  if (Math.abs((sumaSplits + sumaSaldos) - montoTotal) > 1) {
    throw new AppError(
      `La suma de medios de pago ($${sumaSplits.toFixed(2)}) + saldo aplicado ($${sumaSaldos.toFixed(2)}) no coincide con el total ($${montoTotal.toFixed(2)})`,
      400, 'MONTO_INCORRECTO'
    )
  }

  // Validar saldos a favor: existencia, pertenencia al socio, monto disponible
  if (saldosAplicar.length > 0) {
    const saldoIds = saldosAplicar.map(s => s.saldoFavorId)
    const saldosBD = await req.db.saldoFavor.findMany({
      where: { id: { in: saldoIds }, socioId: parseInt(socioId) }
    })
    const saldoMap = Object.fromEntries(saldosBD.map(s => [s.id, s]))
    for (const s of saldosAplicar) {
      const sBD = saldoMap[s.saldoFavorId]
      if (!sBD) throw new AppError(`Saldo a favor #${s.saldoFavorId} no encontrado o no pertenece al socio`, 400, 'SALDO_INVALIDO')
      const disp = Number(sBD.montoDisponible)
      if (s.monto > disp + 0.01) {
        throw new AppError(`Saldo #${s.saldoFavorId} disponible: $${disp.toFixed(2)}, solicitado: $${s.monto.toFixed(2)}`, 400, 'SALDO_INSUFICIENTE')
      }
    }
  }

  // Obtener cajas y medios de pago para todos los splits
  const cajasIds = [...new Set(splits.map(s => s.cajaId))]
  const mediosIds = [...new Set(splits.map(s => s.medioPagoId))]

  const [cajasData, mediosData] = await Promise.all([
    cajasIds.length ? req.db.caja.findMany({ where: { id: { in: cajasIds } }, include: { cuentaContable: true } }) : [],
    mediosIds.length ? req.db.medioPago.findMany({ where: { id: { in: mediosIds } }, include: { conceptoTesoreria: true } }) : [],
  ])

  const cajaMap = Object.fromEntries(cajasData.map(c => [c.id, c]))
  const medioMap = Object.fromEntries(mediosData.map(m => [m.id, m]))

  // Validar cajas
  for (const split of splits) {
    const caja = cajaMap[split.cajaId]
    if (!caja) throw new AppError(`Caja ${split.cajaId} no encontrada`, 400, 'CAJA_NO_ENCONTRADA')
    if (!caja.activo) throw new AppError(`La caja "${caja.nombre}" está inactiva`, 400, 'CAJA_INACTIVA')
    if (!caja.cuentaContableId) throw new AppError(`La caja "${caja.nombre}" no tiene cuenta contable configurada`, 400, 'CAJA_SIN_CUENTA_CONTABLE')
  }

  // Caja/medio primarios (legacy fields). Cuando es 100% saldo, quedan null.
  const caja = splits.length > 0 ? cajaMap[splits[0].cajaId] : null
  const medioPago = splits.length > 0 ? medioMap[splits[0].medioPagoId] : null

  // Todo dentro de una transacción
  const pagoCompleto = await req.db.$transaction(async (tx) => {
    // Generar número de recibo (dentro de transacción para evitar duplicados).
    // Defensivo: si algún registro previo tiene numero no parseable (ej: 'NaN' por flujos
    // viejos o importaciones), tomamos el máximo numérico válido de los últimos 100
    // para no propagar '00000NaN' a futuros recibos.
    const ultimosPagos = await tx.pago.findMany({
      orderBy: { id: 'desc' },
      select: { numero: true },
      take: 100,
    })
    const ultimoNumeroValido = ultimosPagos
      .map(p => parseInt(p.numero, 10))
      .filter(n => Number.isFinite(n) && n > 0)
      .reduce((max, n) => Math.max(max, n), 0)
    const nuevoNumero = String(ultimoNumeroValido + 1).padStart(8, '0')

    // Crear pago. medioPagoId/cajaId quedan null cuando se cobra 100% con saldo a favor.
    const pago = await tx.pago.create({
      data: {
        numero: nuevoNumero,
        socioId: parseInt(socioId),
        grupo_familiar_id: cuotas[0].grupoFamiliarId,
        montoTotal,
        montoRecibido: montoRecibidoNum,
        montoACuenta: montoRecibidoNum > montoTotal ? montoRecibidoNum - montoTotal : 0,
        medioPagoId: splits.length > 0 ? splits[0].medioPagoId : null,
        cajaId: splits.length > 0 ? caja.id : null,
        observaciones,
        registradoPor: req.admin.id,
      },
    })

    // Aplicar saldos a favor: crear AplicacionSaldo y decrementar montoDisponible
    for (const s of saldosAplicar) {
      await tx.aplicacionSaldo.create({
        data: {
          saldoFavorId: s.saldoFavorId,
          pagoId: pago.id,
          monto: s.monto,
        }
      })
      await tx.saldoFavor.update({
        where: { id: s.saldoFavorId },
        data: { montoDisponible: { decrement: s.monto } }
      })
    }

    // Actualizar cada cuota con su recargo/descuento y marcar como pagada
    for (const cuota of cuotas) {
      const nuevoMontoRecargo = Number(cuota.montoRecargo) + cuota.recargoCalculado
      const nuevaMontoBonificacion = Number(cuota.montoBonificacion) + cuota.descuentoCalculado
      const nuevoMontoTotal = Number(cuota.montoOriginal) + nuevoMontoRecargo - nuevaMontoBonificacion

      const motivoDesc = cuota.descuentoCalculado > 0
        ? (cuota.motivoBonificacion
            ? `${cuota.motivoBonificacion} + Descuento pago anticipado (${cuota.porcentajeDescuentoAnticipado}%)`
            : `Descuento pago anticipado (${cuota.porcentajeDescuentoAnticipado}%)`)
        : cuota.motivoBonificacion

      await tx.cargo.update({
        where: { id: cuota.id },
        data: {
          estado: 'PAGADO',
          fechaPago: new Date(),
          pagoId: pago.id,
          montoRecargo: nuevoMontoRecargo,
          montoBonificacion: nuevaMontoBonificacion,
          montoTotal: nuevoMontoTotal,
          motivoBonificacion: motivoDesc || null,
        },
      })
    }

    // Registrar splits de medios de pago
    for (const split of splits) {
      await tx.pagoMedioPago.create({
        data: {
          pagoId: pago.id,
          medioPagoId: split.medioPagoId,
          cajaId: split.cajaId,
          monto: split.monto,
          tenantId: pago.tenantId || (await tx.caja.findUnique({ where: { id: split.cajaId }, select: { tenantId: true } }))?.tenantId || 0,
        }
      })
      // Actualizar saldo de cada caja con su porción
      await tx.caja.update({
        where: { id: split.cajaId },
        data: { saldoActual: { increment: split.monto } },
      })
    }

    // Cargar el concepto por defecto (fallback para cargos sin concepto específico)
    const configConcepto = await tx.configuracion.findFirst({
      where: { clave: 'CONCEPTO_COBRANZA_CUOTAS' }
    })
    if (!configConcepto?.valor) {
      throw new AppError(
        'No se configuró el concepto de tesorería para cobranza de cuotas. Configuralo en Configuración > Configuración General.',
        400, 'CONCEPTO_NO_CONFIGURADO'
      )
    }
    const conceptoPorDefecto = await tx.conceptoTesoreria.findUnique({
      where: { id: parseInt(configConcepto.valor) }
    })
    if (!conceptoPorDefecto) {
      throw new AppError('No se pudo determinar el concepto de tesorería. Configurá los conceptos.', 400, 'CONCEPTO_NO_ENCONTRADO')
    }
    if (!conceptoPorDefecto.activo) {
      throw new AppError('El concepto de tesorería para esta cobranza está inactivo.', 400, 'CONCEPTO_INACTIVO')
    }

    // Agrupar cargos por centro de costo efectivo
    // Prioridad:
    //   1. cargo.centroCostoId (override manual)
    //   2. CC del concepto de la Categoría de Actividad
    //   3. CC del concepto de la Actividad (heredado por todas sus categorías)
    //   4. CC del concepto del propio cargo (cuota social, viene del TipoSocio)
    //   5. CC del concepto por defecto
    //   6. CC de la caja
    const gruposPorCC = {}
    for (const cuota of cuotas) {
      const montoEfectivo = Number(cuota.montoTotal) + cuota.recargoCalculado - cuota.descuentoCalculado
      const ccEfectivo =
        cuota.centroCostoId ??
        cuota.categoriaActividad?.conceptoTesoreria?.centroCostoId ??
        cuota.categoriaActividad?.actividad?.conceptoTesoreria?.centroCostoId ??
        cuota.conceptoTesoreria?.centroCostoId ??
        conceptoPorDefecto.centroCostoId ??
        caja?.centroCostoId

      if (!ccEfectivo) {
        throw new AppError(
          `El cargo "${cuota.descripcion || '#' + cuota.id}" no tiene centro de costo asignado. Configurá el CC en el concepto o en la caja antes de cobrar.`,
          400, 'CC_REQUERIDO'
        )
      }

      const conceptoNombre =
        (cuota.categoriaActividad?.conceptoTesoreria?.activo && cuota.categoriaActividad.conceptoTesoreria.nombre) ||
        (cuota.categoriaActividad?.actividad?.conceptoTesoreria?.activo && cuota.categoriaActividad.actividad.conceptoTesoreria.nombre) ||
        (cuota.conceptoTesoreria?.activo && cuota.conceptoTesoreria.nombre) ||
        conceptoPorDefecto.nombre

      if (!gruposPorCC[ccEfectivo]) {
        gruposPorCC[ccEfectivo] = { centroCostoId: ccEfectivo, monto: 0, conceptoNombre }
      }
      gruposPorCC[ccEfectivo].monto += montoEfectivo
    }

    // Crear un MovimientoCaja por (split × grupo CC) distribuido proporcionalmente
    const anioMov = new Date().getFullYear()
    const prefijoMov = `MV-${anioMov}-`
    const ultimoMovBase = await tx.movimientoCaja.findFirst({
      where: { numero: { startsWith: prefijoMov } },
      orderBy: { numero: 'desc' }
    })
    let siguienteMov = ultimoMovBase
      ? (parseInt(ultimoMovBase.numero.split('-').pop()) || 0) + 1
      : 1

    const gruposCC = Object.values(gruposPorCC)
    const totalGrupos = gruposCC.reduce((s, g) => s + g.monto, 0)

    for (const split of splits) {
      const cajaActual = cajaMap[split.cajaId]
      for (const grupo of gruposCC) {
        // Distribuir proporcionalmente el monto del split entre los CC groups
        const proporcion = totalGrupos > 0 ? grupo.monto / totalGrupos : 1 / gruposCC.length
        const montoMov = Math.round(split.monto * proporcion * 100) / 100
        if (montoMov <= 0) continue
        const numeroMov = `${prefijoMov}${String(siguienteMov).padStart(5, '0')}`
        siguienteMov++
        await tx.movimientoCaja.create({
          data: {
            numero: numeroMov,
            cajaId: split.cajaId,
            cuentaContableId: cajaActual.cuentaContableId,
            medioPagoId: split.medioPagoId,
            fecha: new Date(),
            tipo: 'INGRESO',
            concepto: grupo.conceptoNombre,
            monto: montoMov,
            descripcion: `Cobranza cuotas socio #${socioId} - Recibo ${nuevoNumero}`,
            pagoId: pago.id,
            registradoPor: req.admin.id,
            centroCostoId: grupo.centroCostoId,
            conciliado: !cajaActual.requiereConciliacion,
          }
        })
      }
    }

    // Obtener pago con relaciones para respuesta (findFirst para mantenerse dentro de la transacción)
    // Include alineado con /recibo-pdf para que el auto-envío pueda adjuntar el PDF.
    const pagoFinal = await tx.pago.findFirst({
      where: { id: pago.id },
      include: {
        socio: {
          select: {
            id: true,
            nroSocio: true,
            apellidoNombre: true,
            documento: true,
            email: true,
            celular: true,
            celularSecundario: true,
            telefonoFijo: true,
            notifWhatsapp: true,
            domicilio: true,
            ciudad: true,
            calle: true,
            codigoPostal: true,
            estado: true,
          },
        },
        medioPago: { select: { id: true, nombre: true } },
        caja: { select: { nombre: true } },
        mediosPago: {
          include: {
            medioPago: { select: { nombre: true } },
            caja: { select: { nombre: true } },
          },
        },
        cargos: {
          include: {
            conceptoTesoreria: { select: { id: true, nombre: true } },
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
    if (!pagoFinal) throw new Error('No se pudo recuperar el pago creado')
    return pagoFinal
  })

  // Generar asiento contable automático (fuera de transacción, no debe fallar el pago)
  generarAsientoPagoCuota(req.db, {
    pago: pagoCompleto,
    caja,
    medioPago,
    cargos: pagoCompleto.cargos || [],
    registradoPor: req.admin.id,
  }).catch(err => {
    console.error('Error generando asiento contable para pago:', err)
  })

  // Generar PDF del recibo y disparar email + WhatsApp en background (no debe bloquear ni fallar el pago)
  ;(async () => {
    let pdfBuffer = null
    let pdfFilename = `recibo-${pagoCompleto.numero}.pdf`
    try {
      const [adminReg, configList] = await Promise.all([
        req.db.admin.findUnique({ where: { id: pagoCompleto.registradoPor }, select: { nombre: true } }).catch(() => null),
        req.db.configuracion.findMany({
          where: { clave: { in: ['CLUB_NOMBRE', 'CLUB_DIRECCION', 'CLUB_TELEFONO'] } },
          select: { clave: true, valor: true }
        }).catch(() => []),
      ])
      const configMap = Object.fromEntries(configList.map(c => [c.clave, c.valor]))
      if (req.tenant?.logoUrl) configMap.CLUB_LOGO_URL = req.tenant.logoUrl
      pdfBuffer = await generarReciboPagoPDF(pagoCompleto, adminReg?.nombre || '', configMap)

      const nombreSocio = (pagoCompleto.socio?.apellidoNombre || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .trim().replace(/\s+/g, '_')
      pdfFilename = `recibo-${pagoCompleto.numero}${nombreSocio ? '-' + nombreSocio : ''}.pdf`
    } catch (err) {
      console.error('Error generando PDF de recibo (auto-envío seguirá sin adjunto):', err.message)
    }

    // Email
    enviarReciboPago(pagoCompleto, req.db, pdfBuffer ? { pdfBuffer, pdfFilename } : {}).catch(err => {
      console.error('Error enviando recibo por email:', err)
    })

    // WhatsApp si corresponde
    if (pagoCompleto.socio?.notifWhatsapp && obtenerTelefonoSocio(pagoCompleto.socio)) {
      try {
        const flag = await req.db.configuracion.findFirst({ where: { clave: 'WHATSAPP_NOTIF_PAGO' } })
        if (flag?.valor !== 'false') {
          notificarPagoWA({ db: req.db, socio: pagoCompleto.socio, pago: pagoCompleto, pdfBuffer, pdfFilename }).catch(err => {
            console.error('Error enviando notif WA de pago:', err.message)
          })
        }
      } catch (err) {
        console.error('Error leyendo flag WA pago:', err.message)
      }
    }
  })()

  res.status(201).json({ success: true, data: pagoCompleto })
}))

// ============================================
// CRUD MEDIOS DE PAGO
// ============================================

// GET /api/admin/medios-pago - Listar medios de pago
router.get('/medios-pago', authAdmin, asyncHandler(async (req, res) => {
  const { activo } = req.query
  const where = activo !== undefined ? { activo: activo === 'true' } : {}

  const medios = await req.db.medioPago.findMany({
    where,
    orderBy: { orden: 'asc' },
    include: { cajaDefault: { select: { id: true, nombre: true } } },
  })
  res.json({ success: true, data: medios })
}))

// GET /api/admin/medios-pago/:id - Obtener medio de pago por ID
router.get('/medios-pago/:id', authAdmin, asyncHandler(async (req, res) => {
  const medio = await req.db.medioPago.findUnique({
    where: { id: parseInt(req.params.id) },
    include: { conceptoTesoreria: { select: { id: true, nombre: true } } }
  })
  if (!medio) throw new AppError('Medio de pago no encontrado', 404, 'NOT_FOUND')
  res.json({ success: true, data: medio })
}))

// POST /api/admin/medios-pago - Crear medio de pago
router.post('/medios-pago', authAdmin, asyncHandler(async (req, res) => {
  const { codigo, nombre, tipo, requiereDatosBanco, comisionPct, orden, activo, paraCaja, paraBuffet, paraKiosco, paraTakeaway, conceptoTesoreriaId, cajaDefaultId } = req.body

  if (!codigo || !nombre) {
    throw new AppError('Código y nombre son requeridos', 400, 'VALIDATION_ERROR')
  }

  // Verificar código único dentro del tenant
  const existente = await req.db.medioPago.findFirst({ where: { codigo } })
  if (existente) {
    throw new AppError('Ya existe un medio de pago con ese código', 400, 'DUPLICATE_CODE')
  }

  const medio = await req.db.medioPago.create({
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
      ...(conceptoTesoreriaId && { conceptoTesoreriaId: parseInt(conceptoTesoreriaId) }),
      ...(cajaDefaultId && { cajaDefaultId: parseInt(cajaDefaultId) }),
    },
    include: { conceptoTesoreria: { select: { id: true, nombre: true } }, cajaDefault: { select: { id: true, nombre: true } } }
  })

  res.status(201).json({ success: true, data: medio })
}))

// PUT /api/admin/medios-pago/:id - Actualizar medio de pago
router.put('/medios-pago/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { codigo, nombre, tipo, requiereDatosBanco, comisionPct, orden, activo, paraCaja, paraBuffet, paraKiosco, paraTakeaway, conceptoTesoreriaId, cajaDefaultId } = req.body

  const existente = await req.db.medioPago.findUnique({ where: { id: parseInt(id) } })
  if (!existente) throw new AppError('Medio de pago no encontrado', 404, 'NOT_FOUND')

  // Verificar código único dentro del tenant (si cambió)
  if (codigo && codigo !== existente.codigo) {
    const duplicado = await req.db.medioPago.findFirst({ where: { codigo } })
    if (duplicado) {
      throw new AppError('Ya existe un medio de pago con ese código', 400, 'DUPLICATE_CODE')
    }
  }

  const medio = await req.db.medioPago.update({
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
      ...(conceptoTesoreriaId !== undefined && { conceptoTesoreriaId: conceptoTesoreriaId ? parseInt(conceptoTesoreriaId) : null }),
      ...(cajaDefaultId !== undefined && { cajaDefaultId: cajaDefaultId ? parseInt(cajaDefaultId) : null }),
    },
    include: { conceptoTesoreria: { select: { id: true, nombre: true } }, cajaDefault: { select: { id: true, nombre: true } } }
  })

  res.json({ success: true, data: medio })
}))

// DELETE /api/admin/medios-pago/:id - Eliminar medio de pago
router.delete('/medios-pago/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  // Verificar si hay pagos usando este medio
  const pagosConMedio = await req.db.pago.count({
    where: { medioPagoId: parseInt(id) },
  })

  if (pagosConMedio > 0) {
    throw new AppError(
      `No se puede eliminar: hay ${pagosConMedio} pagos registrados con este medio`,
      400,
      'HAS_DEPENDENCIES'
    )
  }

  await req.db.medioPago.delete({ where: { id: parseInt(id) } })
  res.json({ success: true, message: 'Medio de pago eliminado' })
}))

export default router
