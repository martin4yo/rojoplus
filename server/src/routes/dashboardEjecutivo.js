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

  // Socios con inscripciones activas
  const sociosConInscripcion = await req.db.inscripcion.findMany({
    where: { estado: 'ACTIVA' },
    select: { socioId: true },
    distinct: ['socioId'],
  })
  const sociosConActividad = sociosConInscripcion.length
  const sociosSinActividad = Math.max(0, sociosActivos - sociosConActividad)

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
      fechaBaja: { gte: hace30Dias },
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
          fechaBaja: { gte: inicioMes, lte: finMes },
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

  // Periodo actual: el del mes calendario en curso. Si no existe (no se generó
  // todavía), caemos al más reciente como fallback. Sin filtrar por estado.
  let periodoActual = await req.db.periodo.findFirst({
    where: { mes: mesActual, anio: anioActual },
  })
  if (!periodoActual) {
    periodoActual = await req.db.periodo.findFirst({
      orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
    })
  }

  let cobranzaMes = { generado: 0, cobrado: 0, pendiente: 0, porcentaje: 0 }
  if (periodoActual) {
    const [cobrado, pendiente] = await Promise.all([
      req.db.cargo.aggregate({
        where: { periodoId: periodoActual.id, estado: 'PAGADO' },
        _sum: { montoTotal: true },
        _count: true,
      }),
      // Pendiente = PENDIENTE + VENCIDO (los vencidos siguen siendo deuda no cobrada)
      req.db.cargo.aggregate({
        where: { periodoId: periodoActual.id, estado: { in: ['PENDIENTE', 'VENCIDO'] } },
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

  // Morosidad total: cargos vencidos sin pagar.
  // Incluye estado='VENCIDO' Y estado='PENDIENTE' con fechaVencimiento < hoy.
  const morosidadResult = await req.db.cargo.aggregate({
    where: {
      OR: [
        { estado: 'VENCIDO' },
        { estado: 'PENDIENTE', fechaVencimiento: { lt: hoy } },
      ],
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
      OR: [
        { estado: 'VENCIDO' },
        { estado: 'PENDIENTE', fechaVencimiento: { lt: hoy } },
      ],
    },
    select: { socioId: true },
    distinct: ['socioId'],
  })
  morosidadTotal.cantSocios = sociosMorosos.length

  // Evolución de cobranza: últimos 6 meses calendarios reales (incluido el actual).
  // Si en algún mes no hubo periodo cargado, se muestra en cero para mantener la
  // continuidad temporal del gráfico.
  const ultimos6Meses = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(anioActual, mesActual - 1 - i, 1)
    ultimos6Meses.push({ mes: d.getMonth() + 1, anio: d.getFullYear() })
  }

  const periodosUltimos6 = await req.db.periodo.findMany({
    where: {
      OR: ultimos6Meses.map(m => ({ mes: m.mes, anio: m.anio })),
    },
    include: {
      cargos: { select: { montoTotal: true, estado: true } },
    },
  })
  const periodoMap = new Map(periodosUltimos6.map(p => [`${p.anio}-${p.mes}`, p]))

  const evolucionCobranza = ultimos6Meses.map(m => {
    const p = periodoMap.get(`${m.anio}-${m.mes}`)
    let cobrado = 0
    let pendiente = 0
    if (p) {
      cobrado = p.cargos
        .filter(c => c.estado === 'PAGADO')
        .reduce((sum, c) => sum + Number(c.montoTotal), 0)
      pendiente = p.cargos
        .filter(c => ['PENDIENTE', 'VENCIDO'].includes(c.estado))
        .reduce((sum, c) => sum + Number(c.montoTotal), 0)
    }
    const total = cobrado + pendiente
    return {
      periodo: `${mesesNombres[m.mes - 1]} ${String(m.anio).slice(-2)}`,
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

  // Inscripciones del periodo actual: las que comenzaron este mes calendario
  // (filtrado por fechaInicio, no por createdAt). Card "Inscripciones" en General.
  const inscripcionesPeriodo = await req.db.inscripcion.count({
    where: {
      estado: 'ACTIVA',
      fechaInicio: { gte: inicioMesActual, lte: finMesActual },
    },
  })

  // Inscripciones por actividad (top 5) — agrupado por Actividad (sumando todas sus categorías)
  const inscripcionesPorCategoria = await req.db.inscripcion.groupBy({
    by: ['categoriaActividadId'],
    where: { estado: 'ACTIVA' },
    _count: true,
  })

  const categoriasIds = inscripcionesPorCategoria.map(i => i.categoriaActividadId)
  const categoriasInfo = await req.db.categoriaActividad.findMany({
    where: { id: { in: categoriasIds } },
    include: { actividad: { select: { id: true, nombre: true } } },
  })

  const actividadDeCategoria = {}
  categoriasInfo.forEach(c => {
    actividadDeCategoria[c.id] = { id: c.actividad.id, nombre: c.actividad.nombre }
  })

  const acumPorActividad = {}
  for (const grupo of inscripcionesPorCategoria) {
    const act = actividadDeCategoria[grupo.categoriaActividadId]
    if (!act) continue
    if (!acumPorActividad[act.id]) {
      acumPorActividad[act.id] = { nombre: act.nombre, cantidad: 0 }
    }
    acumPorActividad[act.id].cantidad += grupo._count
  }

  const top5Actividades = Object.values(acumPorActividad)
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

  // Saldos de cajas — calculados desde movimientos (no usar campo denormalizado)
  const cajasRaw = await req.db.caja.findMany({
    where: { activo: true },
    select: { id: true, nombre: true, tipo: true, saldoInicial: true },
    orderBy: { nombre: 'asc' },
  })
  const cajaIds = cajasRaw.map(c => c.id)
  const totsPorCaja = cajaIds.length
    ? await req.db.movimientoCaja.groupBy({
        by: ['cajaId', 'tipo'],
        where: { cajaId: { in: cajaIds }, anulado: false },
        _sum: { monto: true },
      })
    : []
  const movsByCaja = {}
  for (const t of totsPorCaja) {
    if (!movsByCaja[t.cajaId]) movsByCaja[t.cajaId] = { INGRESO: 0, EGRESO: 0 }
    movsByCaja[t.cajaId][t.tipo] = Number(t._sum.monto || 0)
  }
  const cajas = cajasRaw.map(c => {
    const m = movsByCaja[c.id] || { INGRESO: 0, EGRESO: 0 }
    return {
      id: c.id,
      nombre: c.nombre,
      tipo: c.tipo,
      saldoActual: Number(c.saldoInicial) + m.INGRESO - m.EGRESO,
    }
  })
  const saldoTotalCajas = cajas.reduce((sum, c) => sum + c.saldoActual, 0)

  // Ingresos y egresos del mes
  const [ingresosMesAgg, egresosMesAgg] = await Promise.all([
    req.db.movimientoCaja.aggregate({
      where: { tipo: 'INGRESO', fecha: { gte: inicioMesActual } },
      _sum: { monto: true },
    }),
    req.db.movimientoCaja.aggregate({
      where: { tipo: 'EGRESO', fecha: { gte: inicioMesActual } },
      _sum: { monto: true },
    }),
  ])
  const ingresosMesMonto = Number(ingresosMesAgg._sum.monto) || 0
  const egresosMesMonto = Number(egresosMesAgg._sum.monto) || 0

  const resumenFinanciero = {
    saldoCajas: Math.round(saldoTotalCajas),
    ingresosMes: Math.round(ingresosMesMonto),
    egresosMes: Math.round(egresosMesMonto),
    cashFlowMes: Math.round(ingresosMesMonto - egresosMesMonto),
  }

  // Días de cobertura (con liquidez actual)
  const promedioEgresoDiario = egresosMesMonto / 30
  const diasCobertura = promedioEgresoDiario > 0
    ? Math.round(saldoTotalCajas / promedioEgresoDiario)
    : 999

  // Cuentas corrientes — Saldo Clientes / Proveedores / Sueldos por pagar
  let saldoClientes = 0
  let saldoProveedores = 0
  let sueldosPorPagar = 0
  try {
    if (req.db.movimientoContable) {
      const [saldoClientesResult, saldoProveedoresResult] = await Promise.all([
        req.db.movimientoContable.aggregate({
          where: {
            tipo: 'FACTURA_VENTA',
            estado: { not: 'ANULADO' },
            saldoPendiente: { gt: 0 },
          },
          _sum: { saldoPendiente: true },
        }),
        req.db.movimientoContable.aggregate({
          where: {
            tipo: 'FACTURA_COMPRA',
            estado: { not: 'ANULADO' },
            saldoPendiente: { gt: 0 },
          },
          _sum: { saldoPendiente: true },
        }),
      ])
      saldoClientes = Number(saldoClientesResult._sum.saldoPendiente) || 0
      saldoProveedores = Number(saldoProveedoresResult._sum.saldoPendiente) || 0
    }
  } catch (err) {
    console.warn('movimientoContable table may not exist yet:', err.message)
  }

  try {
    if (req.db.liquidacionSueldo) {
      const sueldosPorPagarResult = await req.db.liquidacionSueldo.aggregate({
        where: { estado: 'PENDIENTE' },
        _sum: { totalNeto: true },
      })
      sueldosPorPagar = Number(sueldosPorPagarResult._sum.totalNeto) || 0
    }
  } catch (err) {
    console.warn('liquidacionSueldo table may not exist yet:', err.message)
  }

  // Tarjetas pendientes de conciliación
  let tarjetasPendientesRaw = []
  try {
    tarjetasPendientesRaw = await req.db.movimientoCaja.findMany({
      where: {
        conciliado: false,
        anulado: false,
        tipo: 'INGRESO',
        pago: { medioPago: { tipo: 'TARJETA' } },
      },
      include: { pago: { include: { medioPago: true } } },
      orderBy: { fecha: 'asc' },
    })
  } catch (err) {
    console.warn('Error querying tarjetas pendientes:', err.message)
  }

  const tarjetasPorTipo = {}
  let tarjetasMontoTotal = 0
  tarjetasPendientesRaw.forEach(m => {
    const tipo = m.pago?.medioPago?.nombre || 'Sin clasificar'
    if (!tarjetasPorTipo[tipo]) tarjetasPorTipo[tipo] = { cantidad: 0, monto: 0 }
    tarjetasPorTipo[tipo].cantidad++
    tarjetasPorTipo[tipo].monto += Number(m.monto)
    tarjetasMontoTotal += Number(m.monto)
  })
  const tarjetasPendientes = {
    cantidad: tarjetasPendientesRaw.length,
    montoTotal: Math.round(tarjetasMontoTotal),
    detalle: Object.entries(tarjetasPorTipo).map(([tipo, d]) => ({
      tipo,
      cantidad: d.cantidad,
      monto: Math.round(d.monto),
    })),
  }

  // eCheqs pendientes
  let echequesRecibidos = []
  let echequesEmitidos = []
  try {
    if (req.db.eCheq) {
      [echequesRecibidos, echequesEmitidos] = await Promise.all([
        req.db.eCheq.findMany({
          where: { tipo: 'RECIBIDO', estado: { in: ['CARTERA', 'DEPOSITADO'] } },
          select: { id: true, monto: true, estado: true, fechaVencimiento: true },
          orderBy: { fechaVencimiento: 'asc' },
        }),
        req.db.eCheq.findMany({
          where: { tipo: 'EMITIDO', estado: 'PENDIENTE' },
          select: { id: true, monto: true, estado: true, fechaVencimiento: true },
          orderBy: { fechaVencimiento: 'asc' },
        }),
      ])
    }
  } catch (err) {
    console.warn('eCheq table may not exist yet:', err.message)
  }

  const hoyDate = new Date()
  hoyDate.setHours(0, 0, 0, 0)
  const en7Dias = new Date(hoyDate)
  en7Dias.setDate(en7Dias.getDate() + 7)

  const echeqsRecibidos = {
    cantidad: echequesRecibidos.length,
    montoTotal: Math.round(echequesRecibidos.reduce((s, e) => s + Number(e.monto), 0)),
    enCartera: echequesRecibidos.filter(e => e.estado === 'CARTERA').length,
    montoEnCartera: Math.round(echequesRecibidos.filter(e => e.estado === 'CARTERA').reduce((s, e) => s + Number(e.monto), 0)),
    depositados: echequesRecibidos.filter(e => e.estado === 'DEPOSITADO').length,
    montoDepositados: Math.round(echequesRecibidos.filter(e => e.estado === 'DEPOSITADO').reduce((s, e) => s + Number(e.monto), 0)),
    vencidos: echequesRecibidos.filter(e => new Date(e.fechaVencimiento) < hoyDate).length,
    proximosAVencer: echequesRecibidos.filter(e => {
      const v = new Date(e.fechaVencimiento)
      return v >= hoyDate && v <= en7Dias
    }).length,
  }

  const echeqsEmitidos = {
    cantidad: echequesEmitidos.length,
    montoTotal: Math.round(echequesEmitidos.reduce((s, e) => s + Number(e.monto), 0)),
    vencidos: echequesEmitidos.filter(e => new Date(e.fechaVencimiento) < hoyDate).length,
    proximosAVencer: echequesEmitidos.filter(e => {
      const v = new Date(e.fechaVencimiento)
      return v >= hoyDate && v <= en7Dias
    }).length,
  }

  // Comercios pendientes de aprobación
  let comerciosPendientes = 0
  try {
    comerciosPendientes = await req.db.comercio.count({ where: { estado: 'PENDIENTE' } })
  } catch (err) {
    console.warn('comercio table may not exist yet:', err.message)
  }

  // ============ DATOS HISTÓRICOS PARA GRÁFICOS ============

  // Movimientos de caja últimos 6 meses (para cashFlow y composición)
  const movimientosHistoricos = await req.db.movimientoCaja.findMany({
    where: { fecha: { gte: inicio6Meses }, anulado: false },
    select: { fecha: true, tipo: true, monto: true, concepto: true },
    orderBy: { fecha: 'asc' },
  })

  const totalIngresos6m = movimientosHistoricos
    .filter(m => m.tipo === 'INGRESO')
    .reduce((sum, m) => sum + Number(m.monto), 0)
  const totalEgresos6m = movimientosHistoricos
    .filter(m => m.tipo === 'EGRESO')
    .reduce((sum, m) => sum + Number(m.monto), 0)
  let saldoAcumulado = saldoTotalCajas - (totalIngresos6m - totalEgresos6m)

  const cashFlowMensual = []
  for (let i = 5; i >= 0; i--) {
    const fecha = new Date(anioActual, mesActual - 1 - i, 1)
    const mes = fecha.getMonth()
    const anio = fecha.getFullYear()
    const inicioMesHist = new Date(anio, mes, 1)
    const finMesHist = new Date(anio, mes + 1, 0, 23, 59, 59)

    const movsMes = movimientosHistoricos.filter(m => {
      const f = new Date(m.fecha)
      return f >= inicioMesHist && f <= finMesHist
    })

    const ingresos = movsMes.filter(m => m.tipo === 'INGRESO').reduce((s, m) => s + Number(m.monto), 0)
    const egresos = movsMes.filter(m => m.tipo === 'EGRESO').reduce((s, m) => s + Number(m.monto), 0)
    const neto = ingresos - egresos
    saldoAcumulado += neto

    cashFlowMensual.push({
      mes: `${mesesNombres[mes]} ${anio.toString().slice(-2)}`,
      ingresos: Math.round(ingresos),
      egresos: Math.round(egresos),
      neto: Math.round(neto),
      saldo: Math.round(saldoAcumulado),
    })
  }

  // Composición ingresos / egresos del mes actual
  const ingresosDelMes = movimientosHistoricos.filter(m => {
    const f = new Date(m.fecha)
    return f >= inicioMesActual && m.tipo === 'INGRESO'
  })
  const composicionIngresos = {}
  ingresosDelMes.forEach(m => {
    const concepto = m.concepto?.toLowerCase() || ''
    let categoria = 'Otros'
    if (concepto.includes('cuota') || concepto.includes('cobranza')) categoria = 'Cuotas'
    else if (concepto.includes('venta') || concepto.includes('factura')) categoria = 'Ventas'
    else if (concepto.includes('inscripcion') || concepto.includes('inscripción')) categoria = 'Inscripciones'
    else if (concepto.includes('alquiler')) categoria = 'Alquileres'
    composicionIngresos[categoria] = (composicionIngresos[categoria] || 0) + Number(m.monto)
  })
  const ingresosComposicion = Object.entries(composicionIngresos).map(([nombre, valor]) => ({
    nombre,
    valor: Math.round(valor),
  }))

  const egresosDelMes = movimientosHistoricos.filter(m => {
    const f = new Date(m.fecha)
    return f >= inicioMesActual && m.tipo === 'EGRESO'
  })
  const composicionEgresos = {}
  egresosDelMes.forEach(m => {
    const concepto = m.concepto?.toLowerCase() || ''
    let categoria = 'Otros'
    if (concepto.includes('sueldo') || concepto.includes('salario')) categoria = 'Sueldos'
    else if (concepto.includes('compra') || concepto.includes('proveedor')) categoria = 'Compras'
    else if (concepto.includes('servicio') || concepto.includes('luz') || concepto.includes('gas') || concepto.includes('agua')) categoria = 'Servicios'
    else if (concepto.includes('mantenimiento')) categoria = 'Mantenimiento'
    composicionEgresos[categoria] = (composicionEgresos[categoria] || 0) + Number(m.monto)
  })
  const egresosComposicion = Object.entries(composicionEgresos).map(([nombre, valor]) => ({
    nombre,
    valor: Math.round(valor),
  }))

  // ============ INDICADORES DE SALUD ============

  const cashFlowNeto = ingresosMesMonto - egresosMesMonto
  const indiceCobranzaPct = cobranzaMes.porcentaje
  const saludFinanciera =
    cashFlowNeto >= 0 && indiceCobranzaPct >= 70 && diasCobertura >= 30 ? 'good' :
    cashFlowNeto < 0 || indiceCobranzaPct < 50 || diasCobertura < 15 ? 'danger' : 'warning'

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

  // Alerta comercios pendientes
  if (comerciosPendientes > 0) {
    alertas.push({
      tipo: 'warning',
      titulo: 'Comercios Pendientes',
      mensaje: `${comerciosPendientes} solicitudes de comercios esperando aprobación`,
      accion: '/admin/comercios?estado=PENDIENTE',
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
        conActividad: sociosConActividad,
        sinActividad: sociosSinActividad,
        nuevos30Dias,
        bajas30Dias,
        tasaRetencion,
        tendenciaNuevos,
      },

      // Sección Financiera
      financiero: {
        cobranzaMes,
        morosidadTotal,
        proyeccionCierre,
        resumenFinanciero,
        diasCobertura,
        saludFinanciera,
        saldoClientes: Math.round(saldoClientes),
        saldoProveedores: Math.round(saldoProveedores),
        sueldosPorPagar: Math.round(sueldosPorPagar),
      },

      // Sección Actividades
      actividades: {
        inscripcionesActivas,
        inscripcionesPeriodo,
        top5Actividades,
        tendenciaInscripciones,
        ocupacionActividades,
      },

      // Sección Tesorería
      tesoreria: {
        cajas: cajas.map(c => ({ ...c, saldoActual: Number(c.saldoActual) })),
        saldoTotalCajas: Math.round(saldoTotalCajas),
        tarjetasPendientes,
        echeqsRecibidos,
        echeqsEmitidos,
      },

      // Comercios pendientes (también disponibles vía alertas)
      comerciosPendientes,

      // Gráficos
      graficos: {
        crecimientoSocios,
        evolucionCobranza,
        cashFlowMensual,
        ingresosComposicion,
        egresosComposicion,
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
