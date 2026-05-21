import { Router } from 'express'
import prisma from '../../lib/prisma.js'
import { asyncHandler, AppError } from '../../middleware/errorHandler.js'
import { authAdmin, checkPermiso } from '../../middleware/auth.js'
import { enviarReciboPago } from '../../services/email.js'
import { generarAsientoPagoCuota } from '../../services/asientosContables.js'
import { notificarPago as notificarPagoWA, obtenerTelefonoSocio } from '../../services/whatsappService.js'
import { generarReciboPagoPDF } from '../../services/pdfGenerator.js'
import { buildSocioSearchFilter } from '../../lib/socioSearch.js'
import { calcularCuotas, commitCuotas } from '../../services/generarCuotasService.js'

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

// POST /api/admin/periodos/:id/preview - Vista previa de cuotas a generar (sin persistir)
// body opcional: { socioIds, tipoSocioIds, categoriaSocioIds, actividadIds, categoriaActividadIds,
//                  soloCuotaSocial, soloCuotaActividad }
router.post('/periodos/:id/preview', authAdmin, asyncHandler(async (req, res) => {
  const periodoId = parseInt(req.params.id)
  const periodo = await req.db.periodo.findUnique({ where: { id: periodoId } })
  if (!periodo) throw new AppError('Periodo no encontrado', 404, 'NOT_FOUND')

  const filtros = {
    socioIds: req.body?.socioIds,
    tipoSocioIds: req.body?.tipoSocioIds,
    categoriaSocioIds: req.body?.categoriaSocioIds,
    actividadIds: req.body?.actividadIds,
    categoriaActividadIds: req.body?.categoriaActividadIds,
    soloCuotaSocial: req.body?.soloCuotaSocial,
    soloCuotaActividad: req.body?.soloCuotaActividad,
  }

  const { cargos, totales, advertencias } = await calcularCuotas(req.db, periodoId, filtros)

  res.json({
    success: true,
    data: { periodo, cargos, totales, advertencias },
  })
}))

// POST /api/admin/periodos/:id/generar - Generar cuotas para un periodo
// body opcional: { claves: string[] } — si se pasa, persiste solo esas; si no, todas (legacy)
router.post('/periodos/:id/generar', authAdmin, asyncHandler(async (req, res) => {
  const periodoId = parseInt(req.params.id)
  const periodo = await req.db.periodo.findUnique({ where: { id: periodoId } })
  if (!periodo) throw new AppError('Periodo no encontrado', 404, 'NOT_FOUND')

  const claves = Array.isArray(req.body?.claves) ? req.body.claves : null

  const { cuotasGeneradas, clavesNoEncontradas } = await commitCuotas(
    req.db,
    periodoId,
    claves,
    req.admin.id,
  )

  let mensaje
  if (cuotasGeneradas === 0) {
    mensaje = claves
      ? 'Ninguna de las claves seleccionadas resultó en cuotas a generar (posiblemente ya existen o cambiaron condiciones).'
      : 'No se generaron cuotas (puede que ya existan o que no haya socios/inscripciones aplicables).'
  } else {
    mensaje = `Se generaron ${cuotasGeneradas} cuotas`
    if (clavesNoEncontradas.length > 0) {
      mensaje += ` (${clavesNoEncontradas.length} claves no se aplicaron por cambios de estado)`
    }
  }

  res.json({
    success: true,
    data: { cuotasGeneradas, clavesNoEncontradas, mensaje },
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
  const socioFilter = buildSocioSearchFilter(q)
  if (socioFilter) where.socio = socioFilter

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
  const nombre = `${String(mes).padStart(2, '0')}/${anio}`

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
      const esTitularDeFamilia = (socio._count?.miembrosFamilia || 0) > 0
      const tipoCuota = esTitularDeFamilia ? 'GRUPO_FAMILIAR' : 'SOCIO_UNICO'
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
      _count: { select: { miembrosFamilia: true } },
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

// GET /api/admin/cuotas/preview-cuota-social/:socioId - Preview de cuota social individual
router.get('/cuotas/preview-cuota-social/:socioId', authAdmin, asyncHandler(async (req, res) => {
  const { socioId } = req.params
  const { anio, mes } = req.query
  const anioInt = parseInt(anio)
  const mesInt = parseInt(mes)

  if (!anioInt || !mesInt || mesInt < 1 || mesInt > 12) {
    throw new AppError('anio y mes son requeridos (mes entre 1 y 12)', 400, 'VALIDATION_ERROR')
  }

  const socio = await req.db.socio.findUnique({
    where: { id: parseInt(socioId) },
    include: {
      tipoSocioRel: { include: { conceptoTesoreria: true } },
      categoriaSocioRel: true,
    },
  })
  if (!socio) throw new AppError('Socio no encontrado', 404, 'NOT_FOUND')

  // Calcular fechaVencimiento (sin crear el período si no existe)
  const periodoExistente = await req.db.periodo.findFirst({ where: { anio: anioInt, mes: mesInt } })
  let fechaVencimiento
  if (periodoExistente) {
    fechaVencimiento = periodoExistente.fechaVencimiento
  } else {
    const [configDia, configMismoMes] = await Promise.all([
      req.db.configuracion.findFirst({ where: { clave: 'CUOTA_DIA_VENCIMIENTO' } }),
      req.db.configuracion.findFirst({ where: { clave: 'CUOTA_VENCE_MISMO_MES' } }),
    ])
    const diaVenc = configDia ? parseInt(configDia.valor) : 10
    const venceMismoMes = configMismoMes ? configMismoMes.valor === 'true' : false
    let mesV = mesInt, anioV = anioInt
    if (!venceMismoMes) {
      mesV = mesInt + 1
      if (mesV > 12) { mesV = 1; anioV = anioInt + 1 }
    }
    fechaVencimiento = new Date(anioV, mesV - 1, diaVenc)
  }

  // Calcular monto cuota social (excluye actividades)
  const descuentoPct = socio.categoriaSocioRel?.porcentajeDescuento
    ? Number(socio.categoriaSocioRel.porcentajeDescuento)
    : 0
  const esTitularOUnico = !socio.titularFamiliaId
  const cuotaSocialMonto = socio.tipoSocioRel?.conceptoTesoreria?.cuotaMensual
    ? Number(socio.tipoSocioRel.conceptoTesoreria.cuotaMensual)
    : Number(socio.tipoSocioRel?.cuotaMensual || 0)

  let montoBase = 0
  let montoBonificacion = 0
  let montoTotal = 0
  let puedeGenerar = false
  let motivo = null

  if (!esTitularOUnico) {
    motivo = 'El socio es miembro de una familia (la cuota social la paga el titular)'
  } else if (!cuotaSocialMonto) {
    motivo = 'El tipo de socio no tiene cuota mensual configurada'
  } else {
    montoBase = cuotaSocialMonto
    montoBonificacion = montoBase * (descuentoPct / 100)
    montoTotal = montoBase - montoBonificacion
    puedeGenerar = montoTotal > 0
    if (!puedeGenerar) motivo = 'El monto resultante es cero'
  }

  // Verificar si ya existe la cuota social para este período
  let yaExiste = false
  if (periodoExistente) {
    const existente = await req.db.cargo.findFirst({
      where: {
        socioId: socio.id,
        periodoId: periodoExistente.id,
        categoria: 'CUOTA_SOCIAL',
      },
    })
    yaExiste = !!existente
  }

  res.json({
    success: true,
    data: {
      anio: anioInt,
      mes: mesInt,
      fechaVencimiento,
      montoBase,
      montoBonificacion,
      montoTotal,
      descuentoPct,
      yaExiste,
      puedeGenerar,
      motivo,
    },
  })
}))

// POST /api/admin/cuotas/generar-cuota-social/:socioId - Genera la cuota social para un socio en un período
router.post('/cuotas/generar-cuota-social/:socioId', authAdmin, asyncHandler(async (req, res) => {
  const { socioId } = req.params
  const { anio, mes } = req.body
  const anioInt = parseInt(anio)
  const mesInt = parseInt(mes)

  if (!anioInt || !mesInt || mesInt < 1 || mesInt > 12) {
    throw new AppError('anio y mes son requeridos (mes entre 1 y 12)', 400, 'VALIDATION_ERROR')
  }

  const socio = await req.db.socio.findUnique({
    where: { id: parseInt(socioId) },
    include: {
      tipoSocioRel: { include: { conceptoTesoreria: true } },
      categoriaSocioRel: true,
      _count: { select: { miembrosFamilia: true } },
    },
  })
  if (!socio) throw new AppError('Socio no encontrado', 404, 'NOT_FOUND')

  if (socio.titularFamiliaId) {
    throw new AppError('El socio es miembro de una familia, no se le genera cuota social', 400, 'NOT_TITULAR')
  }

  const cuotaSocialMonto = socio.tipoSocioRel?.conceptoTesoreria?.cuotaMensual
    ? Number(socio.tipoSocioRel.conceptoTesoreria.cuotaMensual)
    : Number(socio.tipoSocioRel?.cuotaMensual || 0)
  if (!cuotaSocialMonto) {
    throw new AppError('El tipo de socio no tiene cuota mensual configurada', 400, 'SIN_CUOTA')
  }

  const periodo = await obtenerOCrearPeriodo(req.db, anioInt, mesInt, req.admin.id)

  const yaExiste = await req.db.cargo.findFirst({
    where: { socioId: socio.id, periodoId: periodo.id, categoria: 'CUOTA_SOCIAL' },
  })
  if (yaExiste) {
    throw new AppError(
      `La cuota social ya esta generada para ${String(mesInt).padStart(2, '0')}/${anioInt}`,
      409,
      'YA_EXISTE'
    )
  }

  const descuentoPct = socio.categoriaSocioRel?.porcentajeDescuento
    ? Number(socio.categoriaSocioRel.porcentajeDescuento)
    : 0
  const montoBase = cuotaSocialMonto
  const montoBonificacion = montoBase * (descuentoPct / 100)
  const montoTotal = montoBase - montoBonificacion

  if (montoTotal <= 0) {
    throw new AppError('El monto resultante es cero', 400, 'MONTO_CERO')
  }

  const esTitularDeFamilia = (socio._count?.miembrosFamilia || 0) > 0
  const tipoCuota = esTitularDeFamilia ? 'GRUPO_FAMILIAR' : 'SOCIO_UNICO'

  const cargo = await req.db.cargo.create({
    data: {
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
      origen: 'INDIVIDUAL',
      motivoBonificacion: descuentoPct > 0 ? `Descuento por categoría: ${descuentoPct}%` : null,
    },
  })

  res.status(201).json({ success: true, data: cargo })
}))

// ============================================
// CUOTA DE ACTIVIDAD INDIVIDUAL
// ============================================

// Helper común: calcula monto + valida ventana de vigencia
function calcularMontoCuotaActividad(inscripcion, socio, anio, mes) {
  const categoria = inscripcion.categoriaActividad
  const actividad = categoria?.actividad
  if (!actividad) return { puedeGenerar: false, motivo: 'La inscripción no tiene actividad asociada' }
  if (inscripcion.estado !== 'ACTIVA') return { puedeGenerar: false, motivo: `La inscripción está en estado ${inscripcion.estado}` }
  if (inscripcion.exentoCuota) return { puedeGenerar: false, motivo: 'La inscripción está marcada como exenta de cuota' }

  // Vigencia: el período tiene que estar dentro de fechaInicio/fechaFin
  const inicioPeriodo = new Date(anio, mes - 1, 1)
  const finPeriodo = new Date(anio, mes, 0, 23, 59, 59)
  if (inscripcion.fechaInicio && new Date(inscripcion.fechaInicio) > finPeriodo) {
    return { puedeGenerar: false, motivo: 'El período es anterior al inicio de la inscripción' }
  }
  if (inscripcion.fechaFin && new Date(inscripcion.fechaFin) < inicioPeriodo) {
    return { puedeGenerar: false, motivo: 'El período es posterior al fin de la inscripción' }
  }

  // Monto base (orden de prioridad: conceptoTesoreria de la actividad → categoría.cuotaMensual → actividad.cuotaMensual)
  let montoBase = actividad.conceptoTesoreria?.cuotaMensual
    ? Number(actividad.conceptoTesoreria.cuotaMensual)
    : (categoria.cuotaMensual ? Number(categoria.cuotaMensual)
      : (actividad.cuotaMensual ? Number(actividad.cuotaMensual) : 0))
  if (inscripcion.porcentajeCuota && Number(inscripcion.porcentajeCuota) !== 100) {
    montoBase = montoBase * (Number(inscripcion.porcentajeCuota) / 100)
  }
  if (!(montoBase > 0)) return { puedeGenerar: false, motivo: 'La categoría/actividad no tiene cuota mensual configurada' }

  const descuentoPct = socio.categoriaSocioRel?.porcentajeDescuento
    ? Number(socio.categoriaSocioRel.porcentajeDescuento)
    : 0
  const montoBonificacion = montoBase * (descuentoPct / 100)
  const montoTotal = montoBase - montoBonificacion
  if (!(montoTotal > 0)) return { puedeGenerar: false, motivo: 'El monto resultante es cero' }

  return {
    puedeGenerar: true,
    montoBase,
    montoBonificacion,
    montoTotal,
    descuentoPct,
    actividadNombre: actividad.nombre,
    categoriaNombre: categoria.nombre,
    conceptoTesoreriaId: actividad.conceptoTesoreriaId || null,
  }
}

// GET /api/admin/cuotas/preview-cuota-actividad/:inscripcionId
router.get('/cuotas/preview-cuota-actividad/:inscripcionId', authAdmin, asyncHandler(async (req, res) => {
  const { inscripcionId } = req.params
  const { anio, mes } = req.query
  const anioInt = parseInt(anio)
  const mesInt = parseInt(mes)
  if (!anioInt || !mesInt || mesInt < 1 || mesInt > 12) {
    throw new AppError('anio y mes son requeridos (mes entre 1 y 12)', 400, 'VALIDATION_ERROR')
  }

  const inscripcion = await req.db.inscripcion.findUnique({
    where: { id: parseInt(inscripcionId) },
    include: {
      socio: { include: { categoriaSocioRel: true } },
      categoriaActividad: { include: { actividad: { include: { conceptoTesoreria: true } } } },
    },
  })
  if (!inscripcion) throw new AppError('Inscripción no encontrada', 404, 'NOT_FOUND')

  const calc = calcularMontoCuotaActividad(inscripcion, inscripcion.socio, anioInt, mesInt)

  // Fecha de vencimiento (sin crear el período)
  const periodoExistente = await req.db.periodo.findFirst({ where: { anio: anioInt, mes: mesInt } })
  let fechaVencimiento
  if (periodoExistente) {
    fechaVencimiento = periodoExistente.fechaVencimiento
  } else {
    const [configDia, configMismoMes] = await Promise.all([
      req.db.configuracion.findFirst({ where: { clave: 'CUOTA_DIA_VENCIMIENTO' } }),
      req.db.configuracion.findFirst({ where: { clave: 'CUOTA_VENCE_MISMO_MES' } }),
    ])
    const diaVenc = configDia ? parseInt(configDia.valor) : 10
    const venceMismoMes = configMismoMes ? configMismoMes.valor === 'true' : false
    let mesV = mesInt, anioV = anioInt
    if (!venceMismoMes) { mesV++; if (mesV > 12) { mesV = 1; anioV++ } }
    fechaVencimiento = new Date(anioV, mesV - 1, diaVenc)
  }

  // ¿Ya existe el cargo?
  let yaExiste = false
  if (periodoExistente) {
    const existente = await req.db.cargo.findFirst({
      where: {
        socioId: inscripcion.socioId,
        periodoId: periodoExistente.id,
        categoriaActividadId: inscripcion.categoriaActividadId,
        categoria: 'CUOTA_ACTIVIDAD',
      },
    })
    yaExiste = !!existente
  }

  res.json({
    success: true,
    data: {
      anio: anioInt,
      mes: mesInt,
      fechaVencimiento,
      yaExiste,
      ...calc,
    },
  })
}))

// POST /api/admin/cuotas/generar-cuota-actividad/:inscripcionId
router.post('/cuotas/generar-cuota-actividad/:inscripcionId', authAdmin, asyncHandler(async (req, res) => {
  const { inscripcionId } = req.params
  const { anio, mes } = req.body
  const anioInt = parseInt(anio)
  const mesInt = parseInt(mes)
  if (!anioInt || !mesInt || mesInt < 1 || mesInt > 12) {
    throw new AppError('anio y mes son requeridos (mes entre 1 y 12)', 400, 'VALIDATION_ERROR')
  }

  const inscripcion = await req.db.inscripcion.findUnique({
    where: { id: parseInt(inscripcionId) },
    include: {
      socio: { include: { categoriaSocioRel: true } },
      categoriaActividad: { include: { actividad: { include: { conceptoTesoreria: true } } } },
    },
  })
  if (!inscripcion) throw new AppError('Inscripción no encontrada', 404, 'NOT_FOUND')

  const calc = calcularMontoCuotaActividad(inscripcion, inscripcion.socio, anioInt, mesInt)
  if (!calc.puedeGenerar) {
    throw new AppError(calc.motivo, 400, 'NO_GENERABLE')
  }

  const periodo = await obtenerOCrearPeriodo(req.db, anioInt, mesInt, req.admin.id)

  const yaExiste = await req.db.cargo.findFirst({
    where: {
      socioId: inscripcion.socioId,
      periodoId: periodo.id,
      categoriaActividadId: inscripcion.categoriaActividadId,
      categoria: 'CUOTA_ACTIVIDAD',
    },
  })
  if (yaExiste) {
    throw new AppError(
      `La cuota de actividad ya está generada para ${String(mesInt).padStart(2, '0')}/${anioInt}`,
      409, 'YA_EXISTE'
    )
  }

  const cargo = await req.db.cargo.create({
    data: {
      periodoId: periodo.id,
      socioId: inscripcion.socioId,
      grupoFamiliarId: inscripcion.socio.titularFamiliaId || inscripcion.socioId,
      categoria: 'CUOTA_ACTIVIDAD',
      categoriaActividadId: inscripcion.categoriaActividadId,
      conceptoTesoreriaId: calc.conceptoTesoreriaId,
      descripcion: `${calc.actividadNombre} - ${calc.categoriaNombre}`,
      montoOriginal: calc.montoBase,
      montoBonificacion: calc.montoBonificacion,
      montoTotal: calc.montoTotal,
      estado: 'PENDIENTE',
      fechaVencimiento: periodo.fechaVencimiento,
      origen: 'INDIVIDUAL',
      motivoBonificacion: calc.descuentoPct > 0 ? `Descuento por categoría: ${calc.descuentoPct}%` : null,
    },
  })

  res.status(201).json({ success: true, data: cargo })
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
        select: { id: true, nroSocio: true, apellidoNombre: true, documento: true, email: true, celular: true, celularSecundario: true, telefonoFijo: true, domicilio: true, ciudad: true, calle: true, codigoPostal: true, estadoSocioRel: { select: { nombre: true } } }
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
        select: { id: true, nroSocio: true, apellidoNombre: true, documento: true, email: true, celular: true, celularSecundario: true, telefonoFijo: true, notifWhatsapp: true, domicilio: true, ciudad: true, calle: true, codigoPostal: true, estadoSocioRel: { select: { nombre: true } } }
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
  let splits // [{ medioPagoId, cajaId, monto, nroOperacion?, nroCupon?, nroLote?, ... }]
  if (Array.isArray(mediosPagoInput) && mediosPagoInput.length > 0) {
    splits = mediosPagoInput.map(s => ({
      medioPagoId: parseInt(s.medioPagoId),
      cajaId: parseInt(s.cajaId),
      monto: parseFloat(s.monto),
      nroOperacion: s.nroOperacion?.trim() || null,
      nroCupon: s.nroCupon?.trim() || null,
      nroLote: s.nroLote?.trim() || null,
      nroAutorizacion: s.nroAutorizacion?.trim() || null,
      observaciones: s.observaciones?.trim() || null,
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

  // Validar campos obligatorios según el tipo de medio:
  //   TARJETA_CREDITO/DEBITO/TARJETA → nroCupon + nroLote requeridos
  //   TRANSFERENCIA o BANCO con "transferencia" en el nombre → nroOperacion requerido
  for (const split of splits) {
    const m = medioMap[split.medioPagoId]
    if (!m) continue
    const tipo = (m.tipo || '').toUpperCase()
    const nombre = (m.nombre || '').toLowerCase()
    const esTarjeta = ['TARJETA_CREDITO', 'TARJETA_DEBITO', 'TARJETA'].includes(tipo)
    const esTransfer = tipo === 'TRANSFERENCIA' || (tipo === 'BANCO' && nombre.includes('transfer'))
    if (esTarjeta) {
      if (!split.nroCupon || !split.nroLote) {
        throw new AppError(
          `Para "${m.nombre}" (tarjeta) son obligatorios el N° de cupón y N° de lote.`,
          400, 'TARJETA_DATOS_REQUERIDOS'
        )
      }
    }
    if (esTransfer) {
      if (!split.nroOperacion) {
        throw new AppError(
          `Para "${m.nombre}" (transferencia) es obligatorio el N° de operación.`,
          400, 'TRANSF_DATOS_REQUERIDOS'
        )
      }
    }
  }

  // Todo dentro de una transacción.
  // Se envuelve en un retry loop porque la generación de `numero` no es atómica:
  // dos requests concurrentes pueden leer el mismo max y chocar contra el unique
  // constraint (tenant_id, numero) al hacer pago.create. En ese caso reintentamos.
  const MAX_INTENTOS_NUMERO = 5
  let pagoCompleto = null
  let ultimoErrorNumero = null
  for (let intento = 0; intento < MAX_INTENTOS_NUMERO; intento++) {
    try {
      pagoCompleto = await req.db.$transaction(async (tx) => {
    // Obtener el max(numero::int) del tenant directamente en la DB.
    // Casteo en SQL para no depender del orden lexicográfico ni de imports
    // con numeros en formatos heterogéneos. Filtra solo valores numéricos.
    const rows = await tx.$queryRaw`
      SELECT COALESCE(MAX(CAST(numero AS INTEGER)), 0)::int AS max_num
      FROM pagos
      WHERE tenant_id = ${req.tenantId}
        AND numero ~ '^[0-9]+$'
    `
    const ultimoNumeroValido = Number(rows?.[0]?.max_num || 0)
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
          nroOperacion: split.nroOperacion || null,
          nroCupon: split.nroCupon || null,
          nroLote: split.nroLote || null,
          nroAutorizacion: split.nroAutorizacion || null,
          observaciones: split.observaciones || null,
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
            estadoSocioRel: { select: { nombre: true } },
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
      break
    } catch (err) {
      const esConflictoNumero = err?.code === 'P2002' && Array.isArray(err?.meta?.target) && err.meta.target.includes('numero')
      if (!esConflictoNumero) throw err
      ultimoErrorNumero = err
      // Pequeño backoff aleatorio antes de reintentar para reducir colisiones
      await new Promise(r => setTimeout(r, 20 + Math.floor(Math.random() * 60)))
    }
  }
  if (!pagoCompleto) {
    throw new AppError('No se pudo generar un número de recibo único después de varios intentos. Reintentá la operación.', 500, 'NUMERO_PAGO_CONFLICTO')
  }

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

  // Recalcular vigencia de la familia (reactivación automática si el pago salda
  // las cuotas vencidas). No bloquea ni falla el pago.
  if (pagoCompleto.socioId) {
    import('../../services/vigenciaService.js').then(({ recalcularFamiliaDeSocio }) =>
      recalcularFamiliaDeSocio(req.db, req.tenantId, pagoCompleto.socioId, {
        origen: 'API', usuarioId: req.admin.id,
      })
    ).catch(err => console.error('Error recalculando vigencia tras pago:', err))
  }

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

  // Flags optimistas para que el modal sepa qué se disparó automáticamente
  // y muestre los botones correspondientes como ya enviados.
  let autoSentWa = false
  if (pagoCompleto.socio?.notifWhatsapp && obtenerTelefonoSocio(pagoCompleto.socio)) {
    const flagWa = await req.db.configuracion.findFirst({ where: { clave: 'WHATSAPP_NOTIF_PAGO' } }).catch(() => null)
    autoSentWa = flagWa?.valor !== 'false'
  }
  const autoSent = {
    email: !!pagoCompleto.socio?.email,
    whatsapp: autoSentWa,
  }

  res.status(201).json({ success: true, data: pagoCompleto, autoSent })
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

// POST /api/admin/pagos/:id/anular — Anula un pago de cuotas y revierte cargos, caja y asiento contable
router.post('/pagos/:id/anular', authAdmin, checkPermiso('CAJA_ANULAR'), asyncHandler(async (req, res) => {
  const pagoId = parseInt(req.params.id)
  const motivo = (req.body?.motivo || '').toString().trim()

  if (!pagoId) throw new AppError('ID de pago inválido', 400, 'VALIDATION_ERROR')
  if (!motivo) throw new AppError('Indicá el motivo de la anulación', 400, 'VALIDATION_ERROR')

  const pago = await req.db.pago.findUnique({
    where: { id: pagoId },
    include: {
      cargos: true,
      movimientos: { include: { caja: { select: { requiereConciliacion: true } } } },
      saldosGenerados: { include: { aplicaciones: true } },
      saldosAplicados: { include: { saldoFavor: true } },
    },
  })
  if (!pago) throw new AppError('Pago no encontrado', 404, 'NOT_FOUND')
  if (pago.estado === 'ANULADO') throw new AppError('El pago ya está anulado', 400, 'YA_ANULADO')

  // Validar acceso del usuario a la caja del pago
  const admin = await prisma.admin.findUnique({
    where: { id: req.admin.id },
    include: { rol: { include: { cajas: { select: { cajaId: true } } } } },
  })
  if (admin?.rol && !admin.rol.esSuperAdmin && admin.rol.cajas?.length > 0) {
    const cajasPermitidas = admin.rol.cajas.map(cr => cr.cajaId)
    if (pago.cajaId && !cajasPermitidas.includes(pago.cajaId)) {
      throw new AppError('No tenés acceso a la caja de este pago', 403, 'FORBIDDEN')
    }
  }

  // Bloqueos por estado de los recursos asociados
  const movConciliado = pago.movimientos.find(m => m.conciliado && !m.anulado)
  if (movConciliado) {
    throw new AppError(
      `El movimiento de caja ${movConciliado.numero} ya está conciliado. Desconciliá antes de anular.`,
      400, 'MOVIMIENTO_CONCILIADO'
    )
  }

  // Saldo a favor generado por este pago: si ya se aplicó a otro pago, bloquear
  const saldoGenAplicado = pago.saldosGenerados.find(s => s.aplicaciones && s.aplicaciones.length > 0)
  if (saldoGenAplicado) {
    throw new AppError(
      `Este pago generó un saldo a favor que ya fue aplicado a otra cobranza. No se puede anular.`,
      400, 'SALDO_GENERADO_USADO'
    )
  }

  await req.db.$transaction(async (tx) => {
    // 1) Restaurar saldos a favor que se aplicaron a este pago
    for (const aplic of pago.saldosAplicados) {
      await tx.saldoFavor.update({
        where: { id: aplic.saldoFavorId },
        data: { montoDisponible: { increment: aplic.monto } },
      })
      await tx.aplicacionSaldo.delete({ where: { id: aplic.id } })
    }

    // 2) Anular saldos a favor generados por este pago (no aplicados — ya validado arriba)
    for (const saldo of pago.saldosGenerados) {
      await tx.saldoFavor.update({
        where: { id: saldo.id },
        data: { montoDisponible: 0, observaciones: `[ANULADO ${new Date().toISOString()}] ${saldo.observaciones || ''}`.trim() },
      })
    }

    // 3) Revertir cargos a PENDIENTE limpiando recargo acumulado por este cobro
    for (const cargo of pago.cargos) {
      const montoLimpio = Number(cargo.montoOriginal) - Number(cargo.montoBonificacion)
      await tx.cargo.update({
        where: { id: cargo.id },
        data: {
          estado: 'PENDIENTE',
          fechaPago: null,
          pagoId: null,
          montoRecargo: 0,
          montoTotal: montoLimpio,
        },
      })
    }

    // 4) Generar CONTRAMOVIMIENTOS con fecha de anulación (deja los originales intactos
    //    para preservar la historia contable en su fecha real)
    const anioMov = new Date().getFullYear()
    const prefijoMov = `MV-${anioMov}-`
    const ultimoMovBase = await tx.movimientoCaja.findFirst({
      where: { numero: { startsWith: prefijoMov } },
      orderBy: { numero: 'desc' },
    })
    let siguienteMov = ultimoMovBase
      ? (parseInt(ultimoMovBase.numero.split('-').pop()) || 0) + 1
      : 1

    for (const mov of pago.movimientos) {
      if (mov.anulado) continue
      const tipoContra = mov.tipo === 'INGRESO' ? 'EGRESO' : 'INGRESO'
      const incrementoContra = tipoContra === 'INGRESO' ? Number(mov.monto) : -Number(mov.monto)
      const numeroContra = `${prefijoMov}${String(siguienteMov).padStart(5, '0')}`
      siguienteMov++

      await tx.movimientoCaja.create({
        data: {
          numero: numeroContra,
          cajaId: mov.cajaId,
          cuentaContableId: mov.cuentaContableId,
          centroCostoId: mov.centroCostoId,
          medioPagoId: mov.medioPagoId,
          socioId: mov.socioId,
          entidadId: mov.entidadId,
          pagoId: mov.pagoId,
          fecha: new Date(),
          tipo: tipoContra,
          concepto: `Anulación: ${mov.concepto}`,
          descripcion: `Anulación pago #${pagoId} (mov. ${mov.numero}) — ${motivo}`,
          monto: mov.monto,
          movimientoRelacionadoId: mov.id,
          registradoPor: req.admin.id,
          conciliado: !mov.caja.requiereConciliacion,
        },
      })

      await tx.caja.update({
        where: { id: mov.cajaId },
        data: { saldoActual: { increment: incrementoContra } },
      })
    }

    // 5) Marcar el pago como anulado
    await tx.pago.update({
      where: { id: pagoId },
      data: {
        estado: 'ANULADO',
        fechaAnulacion: new Date(),
        motivoAnulacion: motivo,
        anuladoPor: req.admin.id,
      },
    })
  })

  // 6) Anular asiento contable asociado (fuera de tx — best-effort)
  try {
    const asiento = await req.db.asiento.findFirst({
      where: { tipoOrigen: 'PAGO_CUOTA', origenId: pagoId, estado: { not: 'ANULADO' } },
    })
    if (asiento) {
      await req.db.asiento.update({
        where: { id: asiento.id },
        data: {
          estado: 'ANULADO',
          fechaAnulacion: new Date(),
          motivoAnulacion: motivo,
          anuladoPor: req.admin.id,
        },
      })
    }
  } catch (err) {
    console.error(`Error anulando asiento del pago ${pagoId}:`, err.message)
  }

  res.json({ success: true, message: 'Pago anulado correctamente' })
}))

export default router
