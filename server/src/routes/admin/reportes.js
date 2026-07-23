import { Router } from 'express'
import { asyncHandler, AppError } from '../../middleware/errorHandler.js'
import { authAdmin } from '../../middleware/auth.js'

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
// REPORTES DE COBRANZA
// ============================================

// GET /api/admin/reportes/cobranza - Reporte completo de cobranza con datos jerárquicos
router.get('/reportes/cobranza', authAdmin, asyncHandler(async (req, res) => {
  const { periodoId, periodoIds, desde, hasta } = req.query

  // Construir filtro base
  const whereBase = {}
  if (periodoIds) {
    const ids = periodoIds.split(',').map(s => parseInt(s)).filter(n => !Number.isNaN(n))
    if (ids.length > 0) whereBase.periodoId = { in: ids }
  } else if (periodoId) {
    whereBase.periodoId = parseInt(periodoId)
  }
  if (desde) whereBase.createdAt = { ...whereBase.createdAt, gte: new Date(desde) }
  if (hasta) whereBase.createdAt = { ...whereBase.createdAt, lte: new Date(hasta) }

  // Excluir anuladas del reporte
  whereBase.estado = { not: 'ANULADO' }

  // 1. KPIs Generales
  const [generado, cobrado, pendiente] = await Promise.all([
    req.db.cargo.aggregate({
      where: { ...whereBase, estado: { not: 'ANULADO' } },
      _sum: { montoTotal: true },
      _count: true,
    }),
    req.db.cargo.aggregate({
      where: { ...whereBase, estado: 'PAGADO' },
      _sum: { montoTotal: true },
      _count: true,
    }),
    req.db.cargo.aggregate({
      where: { ...whereBase, estado: 'PENDIENTE' },
      _sum: { montoTotal: true },
      _count: true,
    }),
  ])

  // Calcular días promedio de pago (solo cuotas pagadas con fechaPago)
  const cuotasPagadas = await req.db.cargo.findMany({
    where: { ...whereBase, estado: 'PAGADO', fechaPago: { not: null } },
    select: { createdAt: true, fechaPago: true },
  })

  let diasPromedioPago = 0
  if (cuotasPagadas.length > 0) {
    const sumaDias = cuotasPagadas.reduce((sum, c) => {
      const dias = Math.floor((new Date(c.fechaPago) - new Date(c.createdAt)) / (1000 * 60 * 60 * 24))
      return sum + Math.max(0, dias)
    }, 0)
    diasPromedioPago = Math.round(sumaDias / cuotasPagadas.length)
  }

  // Calcular recargo pendiente
  const cuotasPendientesConRecargo = await req.db.cargo.findMany({
    where: { ...whereBase, estado: 'PENDIENTE' },
  })
  let totalRecargoPendiente = 0
  for (const cuota of cuotasPendientesConRecargo) {
    const recargo = await calcularRecargoCargo(req.db, cuota)
    totalRecargoPendiente += recargo.recargo
  }

  const totalGenerado = Number(generado._sum.montoTotal) || 0
  const totalCobrado = Number(cobrado._sum.montoTotal) || 0
  const totalPendiente = Number(pendiente._sum.montoTotal) || 0
  const porcentajeMorosidad = totalGenerado > 0 ? Math.round((totalPendiente / totalGenerado) * 100 * 10) / 10 : 0

  // 2. Datos agrupados por categoría
  const cargosPorCategoria = await req.db.cargo.groupBy({
    by: ['categoria'],
    where: { ...whereBase, estado: { not: 'ANULADO' } },
    _sum: { montoTotal: true },
    _count: true,
  })

  const cargosPagadosPorCategoria = await req.db.cargo.groupBy({
    by: ['categoria'],
    where: { ...whereBase, estado: 'PAGADO' },
    _sum: { montoTotal: true },
    _count: true,
  })

  const cargosPendientesPorCategoria = await req.db.cargo.groupBy({
    by: ['categoria'],
    where: { ...whereBase, estado: 'PENDIENTE' },
    _sum: { montoTotal: true },
    _count: true,
  })

  // 3. Para ACTIVIDAD, obtener desglose por actividad y categoría
  const actividadesData = await req.db.cargo.findMany({
    where: { ...whereBase, categoria: { in: ['ACTIVIDAD', 'CUOTA_ACTIVIDAD'] }, estado: { not: 'ANULADO' } },
    include: {
      categoriaActividad: {
        include: {
          actividad: true,
        },
      },
    },
  })

  // Agrupar actividades
  const actividadesAgrupadas = {}
  for (const cargo of actividadesData) {
    const actividadNombre = cargo.categoriaActividad?.actividad?.nombre || 'Sin actividad'
    const actividadId = cargo.categoriaActividad?.actividad?.id || 0
    const categoriaNombre = cargo.categoriaActividad?.nombre || 'Sin categoría'
    const categoriaId = cargo.categoriaActividad?.id || 0

    if (!actividadesAgrupadas[actividadId]) {
      actividadesAgrupadas[actividadId] = {
        id: actividadId,
        nombre: actividadNombre,
        generado: 0,
        cobrado: 0,
        pendiente: 0,
        cantGenerado: 0,
        cantCobrado: 0,
        cantPendiente: 0,
        categorias: {},
      }
    }

    const monto = Number(cargo.montoTotal)
    actividadesAgrupadas[actividadId].generado += monto
    actividadesAgrupadas[actividadId].cantGenerado++

    if (cargo.estado === 'PAGADO') {
      actividadesAgrupadas[actividadId].cobrado += monto
      actividadesAgrupadas[actividadId].cantCobrado++
    } else if (cargo.estado === 'PENDIENTE') {
      actividadesAgrupadas[actividadId].pendiente += monto
      actividadesAgrupadas[actividadId].cantPendiente++
    }

    // Subagrupar por categoría
    if (!actividadesAgrupadas[actividadId].categorias[categoriaId]) {
      actividadesAgrupadas[actividadId].categorias[categoriaId] = {
        id: categoriaId,
        nombre: categoriaNombre,
        generado: 0,
        cobrado: 0,
        pendiente: 0,
        cantGenerado: 0,
        cantCobrado: 0,
        cantPendiente: 0,
      }
    }

    actividadesAgrupadas[actividadId].categorias[categoriaId].generado += monto
    actividadesAgrupadas[actividadId].categorias[categoriaId].cantGenerado++

    if (cargo.estado === 'PAGADO') {
      actividadesAgrupadas[actividadId].categorias[categoriaId].cobrado += monto
      actividadesAgrupadas[actividadId].categorias[categoriaId].cantCobrado++
    } else if (cargo.estado === 'PENDIENTE') {
      actividadesAgrupadas[actividadId].categorias[categoriaId].pendiente += monto
      actividadesAgrupadas[actividadId].categorias[categoriaId].cantPendiente++
    }
  }

  // Convertir a array y calcular porcentajes
  const actividades = Object.values(actividadesAgrupadas).map(act => ({
    ...act,
    porcentajeCobro: act.generado > 0 ? Math.round((act.cobrado / act.generado) * 100) : 0,
    categorias: Object.values(act.categorias).map(cat => ({
      ...cat,
      porcentajeCobro: cat.generado > 0 ? Math.round((cat.cobrado / cat.generado) * 100) : 0,
    })),
  }))

  // Construir respuesta jerárquica — mapeo de categorías DB (incluye legacy y actuales)
  // a grupos visibles del reporte.
  const GRUPO_CATEGORIA = {
    SOCIO_UNICO:      'CUOTA_SOCIAL',
    TITULAR_FAMILIA:  'CUOTA_SOCIAL',
    CUOTA_SOCIAL:     'CUOTA_SOCIAL',
    ACTIVIDAD:        'CUOTA_ACTIVIDAD',
    CUOTA_ACTIVIDAD:  'CUOTA_ACTIVIDAD',
    INSCRIPCION:      'INSCRIPCION',
    FINANCIADO:       'FINANCIACION',
    FINANCIACION:     'FINANCIACION',
    NOTA_CREDITO:     'NOTA_CREDITO',
    MORA:             'MORA',
    CONCEPTO:         'CONCEPTO',
    OTRO:             'OTRO',
  }
  const NOMBRE_GRUPO = {
    CUOTA_SOCIAL:     'Cuota Social',
    CUOTA_ACTIVIDAD:  'Actividades',
    INSCRIPCION:      'Inscripciones',
    FINANCIACION:     'Financiación',
    CONCEPTO:         'Conceptos',
    MORA:             'Morosidad',
    NOTA_CREDITO:     'Notas de Crédito',
    OTRO:             'Otros',
  }
  const ORDEN_GRUPOS = ['CUOTA_SOCIAL', 'CUOTA_ACTIVIDAD', 'INSCRIPCION', 'CONCEPTO', 'MORA', 'FINANCIACION', 'NOTA_CREDITO', 'OTRO']

  function grupoDe(categoriaDb) {
    return GRUPO_CATEGORIA[categoriaDb] || 'OTRO'
  }

  // Acumular por grupo a partir de los groupBy ya calculados
  const acum = {}
  function ensureGrupo(g) {
    if (!acum[g]) acum[g] = { generado: 0, cobrado: 0, pendiente: 0, cantGenerado: 0, cantCobrado: 0, cantPendiente: 0 }
    return acum[g]
  }
  for (const r of cargosPorCategoria) {
    const g = ensureGrupo(grupoDe(r.categoria))
    g.generado += Number(r._sum?.montoTotal) || 0
    g.cantGenerado += r._count || 0
  }
  for (const r of cargosPagadosPorCategoria) {
    const g = ensureGrupo(grupoDe(r.categoria))
    g.cobrado += Number(r._sum?.montoTotal) || 0
    g.cantCobrado += r._count || 0
  }
  for (const r of cargosPendientesPorCategoria) {
    const g = ensureGrupo(grupoDe(r.categoria))
    g.pendiente += Number(r._sum?.montoTotal) || 0
    g.cantPendiente += r._count || 0
  }

  const categoriasFormateadas = ORDEN_GRUPOS
    .filter(g => acum[g] && acum[g].cantGenerado > 0)
    .map(g => ({
      categoria: g,
      nombre: NOMBRE_GRUPO[g] || g,
      generado: acum[g].generado,
      cobrado: acum[g].cobrado,
      pendiente: acum[g].pendiente,
      cantGenerado: acum[g].cantGenerado,
      cantCobrado: acum[g].cantCobrado,
      cantPendiente: acum[g].cantPendiente,
      porcentajeCobro: acum[g].generado > 0 ? Math.round((acum[g].cobrado / acum[g].generado) * 100) : 0,
      ...(g === 'CUOTA_ACTIVIDAD' ? { actividades } : {}),
    }))

  res.json({
    success: true,
    data: {
      kpis: {
        generado: { monto: totalGenerado, cantidad: generado._count },
        cobrado: { monto: totalCobrado, cantidad: cobrado._count },
        pendiente: { monto: totalPendiente, cantidad: pendiente._count },
        porcentajeMorosidad,
        diasPromedioPago,
        recargoPendiente: totalRecargoPendiente,
      },
      categorias: categoriasFormateadas,
    },
  })
}))

// GET /api/admin/reportes/cobranza/vencidas - Cuotas vencidas
router.get('/reportes/cobranza/vencidas', authAdmin, asyncHandler(async (req, res) => {
  const hoy = new Date()

  const cuotasVencidas = await req.db.cargo.findMany({
    where: {
      estado: 'PENDIENTE',
      fechaVencimiento: { lt: hoy },
    },
    orderBy: { fechaVencimiento: 'asc' },
    include: {
      socio: {
        select: {
          id: true,
          nroSocio: true,
          apellidoNombre: true,
          celular: true,
          email: true,
        },
      },
      periodo: { select: { nombre: true } },
    },
    take: 100,
  })

  // Calcular días de atraso
  const cuotasConAtraso = cuotasVencidas.map(c => ({
    ...c,
    diasAtraso: Math.floor((hoy - new Date(c.fechaVencimiento)) / (1000 * 60 * 60 * 24)),
  }))

  res.json({ success: true, data: cuotasConAtraso })
}))

// GET /api/admin/reportes/cobranza/morosos - Lista de morosos por concepto
router.get('/reportes/cobranza/morosos', authAdmin, asyncHandler(async (req, res) => {
  const { categoria, actividadId, categoriaActividadId, periodoId, periodoIds, desde, hasta } = req.query

  const where = {
    estado: 'PENDIENTE',
  }

  // Filtros de periodo/fecha
  if (periodoIds) {
    const ids = periodoIds.split(',').map(s => parseInt(s)).filter(n => !Number.isNaN(n))
    if (ids.length > 0) where.periodoId = { in: ids }
  } else if (periodoId) {
    where.periodoId = parseInt(periodoId)
  }
  if (desde) where.createdAt = { ...where.createdAt, gte: new Date(desde) }
  if (hasta) where.createdAt = { ...where.createdAt, lte: new Date(hasta) }

  // Filtros de categoría — soporta tanto grupos del reporte como categorías DB legacy
  const GRUPO_A_DB = {
    CUOTA_SOCIAL:    ['SOCIO_UNICO', 'TITULAR_FAMILIA', 'CUOTA_SOCIAL'],
    CUOTA_ACTIVIDAD: ['ACTIVIDAD', 'CUOTA_ACTIVIDAD'],
    FINANCIACION:    ['FINANCIADO', 'FINANCIACION'],
  }
  if (categoria) {
    const lista = GRUPO_A_DB[categoria]
    where.categoria = lista ? { in: lista } : categoria
  }
  if (categoriaActividadId) where.categoriaActividadId = parseInt(categoriaActividadId)

  // Si se filtra por actividad, buscar todas las categorías de esa actividad
  if (actividadId && !categoriaActividadId) {
    const categoriasActividad = await req.db.categoriaActividad.findMany({
      where: { actividadId: parseInt(actividadId) },
      select: { id: true },
    })
    where.categoriaActividadId = { in: categoriasActividad.map(c => c.id) }
  }

  // Obtener cuotas pendientes
  const cuotasPendientes = await req.db.cargo.findMany({
    where,
    include: {
      socio: {
        select: {
          id: true,
          nroSocio: true,
          apellidoNombre: true,
          celular: true,
          email: true,
          documento: true,
        },
      },
      periodo: { select: { id: true, nombre: true } },
      categoriaActividad: {
        include: {
          actividad: { select: { id: true, nombre: true } },
        },
      },
    },
    orderBy: [
      { socio: { apellidoNombre: 'asc' } },
      { fechaVencimiento: 'asc' },
    ],
  })

  // Calcular recargo y días de atraso para cada cuota
  const hoy = new Date()
  const cuotasConRecargo = []
  for (const cuota of cuotasPendientes) {
    const recargo = await calcularRecargoCargo(req.db, cuota)
    cuotasConRecargo.push({
      ...cuota,
      recargo: recargo.recargo,
      montoConRecargo: recargo.montoConRecargo,
      diasAtraso: cuota.fechaVencimiento
        ? Math.max(0, Math.floor((hoy - new Date(cuota.fechaVencimiento)) / (1000 * 60 * 60 * 24)))
        : 0,
    })
  }

  // Agrupar por socio para el resumen
  const sociosMap = {}
  for (const cuota of cuotasConRecargo) {
    const socioId = cuota.socioId
    if (!sociosMap[socioId]) {
      sociosMap[socioId] = {
        socio: cuota.socio,
        cuotas: [],
        totalDeuda: 0,
        totalRecargo: 0,
        cantCuotas: 0,
        maxDiasAtraso: 0,
      }
    }
    sociosMap[socioId].cuotas.push(cuota)
    sociosMap[socioId].totalDeuda += Number(cuota.montoTotal)
    sociosMap[socioId].totalRecargo += cuota.recargo
    sociosMap[socioId].cantCuotas++
    sociosMap[socioId].maxDiasAtraso = Math.max(sociosMap[socioId].maxDiasAtraso, cuota.diasAtraso)
  }

  const morosos = Object.values(sociosMap).sort((a, b) => b.totalDeuda - a.totalDeuda)

  res.json({
    success: true,
    data: {
      morosos,
      totales: {
        cantSocios: morosos.length,
        cantCuotas: cuotasConRecargo.length,
        totalDeuda: cuotasConRecargo.reduce((sum, c) => sum + Number(c.montoTotal), 0),
        totalRecargo: cuotasConRecargo.reduce((sum, c) => sum + c.recargo, 0),
      },
    },
  })
}))

// GET /api/admin/reportes/cobranza/evolucion - Evolución de cobranza por mes
router.get('/reportes/cobranza/evolucion', authAdmin, asyncHandler(async (req, res) => {
  const { desde, hasta, categoria, actividadId, categoriaActividadId } = req.query

  // Por defecto, último semestre
  const fechaHasta = hasta ? new Date(hasta) : new Date()
  const fechaDesde = desde ? new Date(desde) : new Date(fechaHasta.getFullYear(), fechaHasta.getMonth() - 5, 1)

  // Obtener todos los periodos en el rango
  const periodos = await req.db.periodo.findMany({
    where: {
      estado: 'GENERADO',
      OR: [
        {
          anio: { gt: fechaDesde.getFullYear() },
        },
        {
          anio: fechaDesde.getFullYear(),
          mes: { gte: fechaDesde.getMonth() + 1 },
        },
      ],
      AND: [
        {
          OR: [
            { anio: { lt: fechaHasta.getFullYear() } },
            {
              anio: fechaHasta.getFullYear(),
              mes: { lte: fechaHasta.getMonth() + 1 },
            },
          ],
        },
      ],
    },
    orderBy: [{ anio: 'asc' }, { mes: 'asc' }],
  })

  // Construir filtro adicional para cargos
  const filtroAdicional = {}
  if (categoria) filtroAdicional.categoria = categoria
  if (categoriaActividadId) {
    filtroAdicional.categoriaActividadId = parseInt(categoriaActividadId)
  } else if (actividadId) {
    // Si hay actividadId pero no categoriaActividadId, buscar todas las categorías de esa actividad
    const categoriasAct = await req.db.categoriaActividad.findMany({
      where: { actividadId: parseInt(actividadId) },
      select: { id: true },
    })
    filtroAdicional.categoriaActividadId = { in: categoriasAct.map(c => c.id) }
  }

  // Obtener datos de cobranza por período
  const evolucion = []

  for (const periodo of periodos) {
    const [generado, cobrado] = await Promise.all([
      req.db.cargo.aggregate({
        where: {
          periodoId: periodo.id,
          estado: { not: 'ANULADO' },
          ...filtroAdicional,
        },
        _sum: { montoTotal: true },
        _count: true,
      }),
      req.db.cargo.aggregate({
        where: {
          periodoId: periodo.id,
          estado: 'PAGADO',
          ...filtroAdicional,
        },
        _sum: { montoTotal: true },
        _count: true,
      }),
    ])

    const montoGenerado = Number(generado._sum.montoTotal) || 0
    const montoCobrado = Number(cobrado._sum.montoTotal) || 0

    evolucion.push({
      periodoId: periodo.id,
      nombre: periodo.nombre,
      mes: periodo.mes,
      anio: periodo.anio,
      generado: montoGenerado,
      cobrado: montoCobrado,
      cantGenerado: generado._count || 0,
      cantCobrado: cobrado._count || 0,
      porcentajeCobro: montoGenerado > 0 ? Math.round((montoCobrado / montoGenerado) * 100) : 0,
    })
  }

  res.json({
    success: true,
    data: {
      evolucion,
      rango: {
        desde: fechaDesde.toISOString().split('T')[0],
        hasta: fechaHasta.toISOString().split('T')[0],
      },
    },
  })
}))

export default router
