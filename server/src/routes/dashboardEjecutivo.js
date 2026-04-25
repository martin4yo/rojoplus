import { Router } from 'express'
import { asyncHandler } from '../middleware/errorHandler.js'
import { authAdmin } from '../middleware/auth.js'

const router = Router()

// GET /api/admin/dashboard/ejecutivo
// Dashboard ejecutivo con KPIs consolidados para dirección
router.get('/ejecutivo', authAdmin, asyncHandler(async (req, res) => {
  const hoy = new Date()
  const mesActual = hoy.getMonth() + 1
  const anioActual = hoy.getFullYear()

  // Fechas de referencia
  const inicioMesActual = new Date(anioActual, mesActual - 1, 1)
  const finMesActual = new Date(anioActual, mesActual, 0, 23, 59, 59)
  const hace30Dias = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000)
  const hace60Dias = new Date(hoy.getTime() - 60 * 24 * 60 * 60 * 1000)
  const inicio6Meses = new Date(anioActual, mesActual - 6, 1)

  // ============ SECCIÓN SOCIOS ============

  // Socios activos totales
  const sociosActivos = await req.db.socio.count({
    where: {
      OR: [
        { estado: { contains: 'Activ', mode: 'insensitive' } },
        { estado: { contains: 'Vigent', mode: 'insensitive' } },
      ],
    },
  })

  // Nuevos socios últimos 30 días
  const nuevos30Dias = await req.db.socio.count({
    where: {
      fechaAlta: { gte: hace30Dias },
    },
  })

  // Nuevos socios en los 30 días anteriores (para calcular tendencia)
  const nuevos30DiasAnteriores = await req.db.socio.count({
    where: {
      fechaAlta: { gte: hace60Dias, lt: hace30Dias },
    },
  })

  // Bajas últimos 30 días
  const bajas30Dias = await req.db.socio.count({
    where: {
      estado: { contains: 'Baja', mode: 'insensitive' },
      updatedAt: { gte: hace30Dias },
    },
  })

  // Tasa de retención = (activos - bajas) / activos * 100
  const tasaRetencion = sociosActivos > 0
    ? Math.round(((sociosActivos - bajas30Dias) / sociosActivos) * 100 * 10) / 10
    : 100

  // Tendencia de nuevos socios (comparación con período anterior)
  const tendenciaNuevos = nuevos30DiasAnteriores > 0
    ? Math.round(((nuevos30Dias - nuevos30DiasAnteriores) / nuevos30DiasAnteriores) * 100)
    : (nuevos30Dias > 0 ? 100 : 0)

  // ============ CRECIMIENTO MENSUAL (últimos 6 meses) ============

  const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const crecimientoSocios = []

  for (let i = 5; i >= 0; i--) {
    const fecha = new Date(anioActual, mesActual - 1 - i, 1)
    const mes = fecha.getMonth()
    const anio = fecha.getFullYear()
    const inicioMes = new Date(anio, mes, 1)
    const finMes = new Date(anio, mes + 1, 0, 23, 59, 59)

    const [altas, bajas] = await Promise.all([
      req.db.socio.count({
        where: { fechaAlta: { gte: inicioMes, lte: finMes } },
      }),
      req.db.socio.count({
        where: {
          estado: { contains: 'Baja', mode: 'insensitive' },
          updatedAt: { gte: inicioMes, lte: finMes },
        },
      }),
    ])

    crecimientoSocios.push({
      mes: `${mesesNombres[mes]} ${anio.toString().slice(-2)}`,
      altas,
      bajas,
      neto: altas - bajas,
    })
  }

  // ============ SECCIÓN FINANCIERA ============

  // Periodo actual
  const periodoActual = await req.db.periodo.findFirst({
    where: { estado: 'GENERADO' },
    orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
  })

  let cobranzaMes = { generado: 0, cobrado: 0, pendiente: 0, porcentaje: 0 }
  if (periodoActual) {
    const [cobrado, pendiente] = await Promise.all([
      req.db.cargo.aggregate({
        where: { periodoId: periodoActual.id, estado: 'PAGADO' },
        _sum: { montoTotal: true },
        _count: true,
      }),
      req.db.cargo.aggregate({
        where: { periodoId: periodoActual.id, estado: 'PENDIENTE' },
        _sum: { montoTotal: true },
        _count: true,
      }),
    ])

    const montoCobrado = Number(cobrado._sum.montoTotal) || 0
    const montoPendiente = Number(pendiente._sum.montoTotal) || 0
    const montoGenerado = montoCobrado + montoPendiente

    cobranzaMes = {
      generado: Math.round(montoGenerado),
      cobrado: Math.round(montoCobrado),
      pendiente: Math.round(montoPendiente),
      porcentaje: montoGenerado > 0 ? Math.round((montoCobrado / montoGenerado) * 100) : 0,
      cantCobrado: cobrado._count || 0,
      cantPendiente: pendiente._count || 0,
    }
  }

  // Morosidad total (todas las cuotas vencidas pendientes)
  const morosidadResult = await req.db.cargo.aggregate({
    where: {
      estado: 'PENDIENTE',
      fechaVencimiento: { lt: hoy },
    },
    _sum: { montoTotal: true },
    _count: true,
  })

  const morosidadTotal = {
    monto: Math.round(Number(morosidadResult._sum.montoTotal) || 0),
    cantCuotas: morosidadResult._count || 0,
  }

  // Socios morosos (únicos)
  const sociosMorosos = await req.db.cargo.findMany({
    where: {
      estado: 'PENDIENTE',
      fechaVencimiento: { lt: hoy },
    },
    select: { socioId: true },
    distinct: ['socioId'],
  })
  morosidadTotal.cantSocios = sociosMorosos.length

  // Evolución de cobranza (últimos 6 periodos)
  const periodosHistoricos = await req.db.periodo.findMany({
    where: { estado: 'GENERADO' },
    orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
    take: 6,
    include: {
      cargos: {
        select: { montoTotal: true, estado: true },
      },
    },
  })

  const evolucionCobranza = periodosHistoricos.reverse().map(p => {
    const cobrado = p.cargos.filter(c => c.estado === 'PAGADO').reduce((sum, c) => sum + Number(c.montoTotal), 0)
    const pendiente = p.cargos.filter(c => c.estado === 'PENDIENTE').reduce((sum, c) => sum + Number(c.montoTotal), 0)
    const total = cobrado + pendiente
    return {
      periodo: `${mesesNombres[p.mes - 1]} ${p.anio.toString().slice(-2)}`,
      cobrado: Math.round(cobrado),
      pendiente: Math.round(pendiente),
      porcentaje: total > 0 ? Math.round((cobrado / total) * 100) : 0,
    }
  })

  // Proyección de cierre de mes (basada en promedio histórico)
  const promedioCobranza = evolucionCobranza.length > 0
    ? Math.round(evolucionCobranza.reduce((sum, p) => sum + p.porcentaje, 0) / evolucionCobranza.length)
    : 0

  const proyeccionCierre = {
    porcentajeProyectado: promedioCobranza,
    montoProyectado: Math.round((cobranzaMes.generado * promedioCobranza) / 100),
  }

  // ============ SECCIÓN ACTIVIDADES ============

  // Inscripciones activas totales
  const inscripcionesActivas = await req.db.inscripcion.count({
    where: { estado: 'ACTIVA' },
  })

  // Inscripciones por actividad (top 5)
  const inscripcionesPorActividad = await req.db.inscripcion.groupBy({
    by: ['categoriaActividadId'],
    where: { estado: 'ACTIVA' },
    _count: true,
  })

  // Obtener nombres de actividades
  const categoriasIds = inscripcionesPorActividad.map(i => i.categoriaActividadId)
  const categoriasInfo = await req.db.categoriaActividad.findMany({
    where: { id: { in: categoriasIds } },
    include: { actividad: { select: { nombre: true } } },
  })

  const categoriasMap = {}
  categoriasInfo.forEach(c => {
    categoriasMap[c.id] = `${c.actividad.nombre} - ${c.nombre}`
  })

  const top5Actividades = inscripcionesPorActividad
    .map(i => ({
      nombre: categoriasMap[i.categoriaActividadId] || 'Sin nombre',
      cantidad: i._count,
    }))
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 5)

  // Tendencia de inscripciones (últimos 3 meses)
  const inscripcionesNuevas30Dias = await req.db.inscripcion.count({
    where: {
      fechaInicio: { gte: hace30Dias },
    },
  })

  const inscripcionesNuevas30DiasAnt = await req.db.inscripcion.count({
    where: {
      fechaInicio: { gte: hace60Dias, lt: hace30Dias },
    },
  })

  const tendenciaInscripciones = inscripcionesNuevas30DiasAnt > 0
    ? Math.round(((inscripcionesNuevas30Dias - inscripcionesNuevas30DiasAnt) / inscripcionesNuevas30DiasAnt) * 100)
    : (inscripcionesNuevas30Dias > 0 ? 100 : 0)

  // Ocupación por actividad (comparar inscriptos vs cupo)
  const actividadesConCupo = await req.db.categoriaActividad.findMany({
    where: { activo: true, cupoMaximo: { gt: 0 } },
    include: {
      actividad: { select: { nombre: true } },
      inscripciones: {
        where: { estado: 'ACTIVA' },
        select: { id: true },
      },
    },
  })

  const ocupacionActividades = actividadesConCupo
    .map(c => ({
      nombre: `${c.actividad.nombre} - ${c.nombre}`,
      inscriptos: c.inscripciones.length,
      cupo: c.cupoMaximo,
      ocupacion: Math.round((c.inscripciones.length / c.cupoMaximo) * 100),
    }))
    .filter(a => a.ocupacion > 50) // Solo mostrar las que tienen más del 50%
    .sort((a, b) => b.ocupacion - a.ocupacion)
    .slice(0, 5)

  // ============ RESUMEN FINANCIERO RÁPIDO ============

  // Saldos de cajas
  const cajas = await req.db.caja.findMany({
    where: { activo: true },
    select: { nombre: true, saldoActual: true },
  })
  const saldoTotalCajas = cajas.reduce((sum, c) => sum + Number(c.saldoActual), 0)

  // Ingresos y egresos del mes
  const [ingresosMes, egresosMes] = await Promise.all([
    req.db.movimientoCaja.aggregate({
      where: { tipo: 'INGRESO', fecha: { gte: inicioMesActual } },
      _sum: { monto: true },
    }),
    req.db.movimientoCaja.aggregate({
      where: { tipo: 'EGRESO', fecha: { gte: inicioMesActual } },
      _sum: { monto: true },
    }),
  ])

  const resumenFinanciero = {
    saldoCajas: Math.round(saldoTotalCajas),
    ingresosMes: Math.round(Number(ingresosMes._sum.monto) || 0),
    egresosMes: Math.round(Number(egresosMes._sum.monto) || 0),
    cashFlowMes: Math.round((Number(ingresosMes._sum.monto) || 0) - (Number(egresosMes._sum.monto) || 0)),
  }

  // ============ ALERTAS ============

  const alertas = []

  // Alerta morosidad alta
  if (morosidadTotal.cantSocios > 50) {
    alertas.push({
      tipo: 'warning',
      titulo: 'Morosidad Alta',
      mensaje: `${morosidadTotal.cantSocios} socios con cuotas vencidas`,
      accion: '/admin/reportes/morosidad',
    })
  }

  // Alerta cobranza baja
  if (cobranzaMes.porcentaje < 60 && cobranzaMes.generado > 0) {
    alertas.push({
      tipo: 'danger',
      titulo: 'Cobranza Baja',
      mensaje: `Solo ${cobranzaMes.porcentaje}% cobrado este período`,
      accion: '/admin/cuotas',
    })
  }

  // Alerta bajas elevadas
  if (bajas30Dias > nuevos30Dias && bajas30Dias > 5) {
    alertas.push({
      tipo: 'warning',
      titulo: 'Más Bajas que Altas',
      mensaje: `${bajas30Dias} bajas vs ${nuevos30Dias} altas en 30 días`,
      accion: '/admin/socios',
    })
  }

  res.json({
    success: true,
    data: {
      // Fecha de generación
      fechaGeneracion: hoy.toISOString(),
      nombreTenant: req.tenant?.nombre || null,
      periodoActual: periodoActual ? {
        id: periodoActual.id,
        nombre: periodoActual.nombre,
      } : null,

      // Sección Socios
      socios: {
        activos: sociosActivos,
        nuevos30Dias,
        bajas30Dias,
        tasaRetencion,
        tendenciaNuevos, // % de cambio vs período anterior
      },

      // Sección Financiera
      financiero: {
        cobranzaMes,
        morosidadTotal,
        proyeccionCierre,
        resumenFinanciero,
      },

      // Sección Actividades
      actividades: {
        inscripcionesActivas,
        top5Actividades,
        tendenciaInscripciones,
        ocupacionActividades,
      },

      // Gráficos
      graficos: {
        crecimientoSocios,
        evolucionCobranza,
      },

      // Alertas
      alertas,
    },
  })
}))

// GET /api/admin/dashboard/ejecutivo/socios
// Detalle de métricas de socios
router.get('/ejecutivo/socios', authAdmin, asyncHandler(async (req, res) => {
  const hoy = new Date()

  // Por estado
  const porEstado = await req.db.socio.groupBy({
    by: ['estado'],
    _count: true,
  })

  // Por categoría de socio
  const porCategoria = await req.db.socio.groupBy({
    by: ['categoriaSocioId'],
    _count: true,
  })

  const categoriasInfo = await req.db.categoriaSocio.findMany({
    select: { id: true, nombre: true },
  })
  const categoriasMap = {}
  categoriasInfo.forEach(c => { categoriasMap[c.id] = c.nombre })

  // Por tipo de socio
  const porTipo = await req.db.socio.groupBy({
    by: ['tipoSocioId'],
    _count: true,
  })

  const tiposInfo = await req.db.tipoSocio.findMany({
    select: { id: true, nombre: true },
  })
  const tiposMap = {}
  tiposInfo.forEach(t => { tiposMap[t.id] = t.nombre })

  // Grupos familiares
  const gruposFamiliares = await req.db.grupoFamiliar.count()
  const sociosEnFamilia = await req.db.socio.count({
    where: { grupoFamiliarId: { not: null } },
  })

  res.json({
    success: true,
    data: {
      porEstado: porEstado.map(e => ({
        estado: e.estado || 'Sin estado',
        cantidad: e._count,
      })),
      porCategoria: porCategoria.map(c => ({
        categoria: categoriasMap[c.categoriaSocioId] || 'Sin categoría',
        cantidad: c._count,
      })),
      porTipo: porTipo.map(t => ({
        tipo: tiposMap[t.tipoSocioId] || 'Sin tipo',
        cantidad: t._count,
      })),
      gruposFamiliares: {
        cantidad: gruposFamiliares,
        sociosEnFamilia,
      },
    },
  })
}))

// GET /api/admin/dashboard/ejecutivo/financiero
// Detalle de métricas financieras
router.get('/ejecutivo/financiero', authAdmin, asyncHandler(async (req, res) => {
  const hoy = new Date()
  const mesActual = hoy.getMonth() + 1
  const anioActual = hoy.getFullYear()
  const inicioAnio = new Date(anioActual, 0, 1)

  // Cobranza acumulada del año
  const cobranzaAnio = await req.db.cargo.aggregate({
    where: {
      estado: 'PAGADO',
      fechaPago: { gte: inicioAnio },
    },
    _sum: { montoTotal: true },
  })

  // Recargos acumulados pendientes
  // Usar la lógica existente de cálculo de recargos
  const cargosPendientesVencidos = await req.db.cargo.findMany({
    where: {
      estado: 'PENDIENTE',
      fechaVencimiento: { lt: hoy },
    },
    select: { montoOriginal: true, fechaVencimiento: true },
  })

  // Obtener configuración de recargos
  const configRecargo = await req.db.configuracionRecargo.findFirst({
    where: { activo: true },
  })

  let recargosTotales = 0
  if (configRecargo) {
    cargosPendientesVencidos.forEach(cargo => {
      const diasMora = Math.floor((hoy - new Date(cargo.fechaVencimiento)) / (1000 * 60 * 60 * 24))
      if (diasMora > 0) {
        let porcentajeRecargo = 0
        if (configRecargo.tipo === 'FIJO') {
          porcentajeRecargo = Number(configRecargo.porcentaje)
        } else if (configRecargo.tipo === 'ACUMULATIVO') {
          const periodos = Math.floor(diasMora / (configRecargo.cadaDias || 30))
          porcentajeRecargo = periodos * Number(configRecargo.porcentaje)
          if (configRecargo.topeMaximo) {
            porcentajeRecargo = Math.min(porcentajeRecargo, Number(configRecargo.topeMaximo))
          }
        }
        recargosTotales += Math.round(Number(cargo.montoOriginal) * porcentajeRecargo / 100)
      }
    })
  }

  // Días promedio de pago
  const pagosConFechas = await req.db.cargo.findMany({
    where: {
      estado: 'PAGADO',
      fechaPago: { not: null },
      fechaVencimiento: { not: null },
    },
    select: { fechaPago: true, fechaVencimiento: true },
    take: 1000, // Limitar para rendimiento
  })

  let diasPromedioPago = 0
  if (pagosConFechas.length > 0) {
    const sumaDias = pagosConFechas.reduce((sum, p) => {
      const dias = Math.floor((new Date(p.fechaPago) - new Date(p.fechaVencimiento)) / (1000 * 60 * 60 * 24))
      return sum + dias
    }, 0)
    diasPromedioPago = Math.round(sumaDias / pagosConFechas.length)
  }

  res.json({
    success: true,
    data: {
      cobranzaAnio: Math.round(Number(cobranzaAnio._sum.montoTotal) || 0),
      recargosPendientes: recargosTotales,
      diasPromedioPago,
      configRecargo: configRecargo ? {
        tipo: configRecargo.tipo,
        porcentaje: Number(configRecargo.porcentaje),
        cadaDias: configRecargo.cadaDias,
        topeMaximo: configRecargo.topeMaximo ? Number(configRecargo.topeMaximo) : null,
      } : null,
    },
  })
}))

export default router
