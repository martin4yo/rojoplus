import { Router } from 'express'
import { asyncHandler } from '../../middleware/errorHandler.js'
import { authAdmin } from '../../middleware/auth.js'

const router = Router()

/**
 * GET /api/admin/dashboard
 * Dashboard principal con estadísticas y gráficos
 */
router.get('/dashboard', authAdmin, asyncHandler(async (req, res) => {
  const hoy = new Date()
  const mesActual = hoy.getMonth() + 1
  const anioActual = hoy.getFullYear()
  const inicioMes = new Date(anioActual, mesActual - 1, 1)

  // Calcular inicio de los últimos 6 meses para históricos
  const inicio6Meses = new Date(anioActual, mesActual - 6, 1)

  // Socios activos
  const sociosActivos = await req.req.db.socio.count({
    where: {
      OR: [
        { estado: { contains: 'Activ', mode: 'insensitive' } },
        { estado: { contains: 'Vigent', mode: 'insensitive' } },
      ],
    },
  })

  // Socios con inscripciones activas en actividades
  const sociosConActividad = await req.req.db.inscripcion.findMany({
    where: {
      estado: 'ACTIVA',
    },
    select: { socioId: true },
    distinct: ['socioId'],
  })
  const cantSociosConActividad = sociosConActividad.length

  // Socios sin actividad = activos - con actividad
  const sociosSinActividad = Math.max(0, sociosActivos - cantSociosConActividad)

  // Periodo actual (más reciente con estado GENERADO)
  const periodoActual = await req.prisma.periodo.findFirst({
    where: { estado: 'GENERADO' },
    orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
  })

  let cobranzaPeriodo = { cobrado: 0, pendiente: 0, cantCobrado: 0, cantPendiente: 0 }
  if (periodoActual) {
    const [cobrado, pendiente] = await Promise.all([
      req.req.db.cargo.aggregate({
        where: { periodoId: periodoActual.id, estado: 'PAGADO' },
        _sum: { montoTotal: true },
        _count: true,
      }),
      req.req.db.cargo.aggregate({
        where: { periodoId: periodoActual.id, estado: 'PENDIENTE' },
        _sum: { montoTotal: true },
        _count: true,
      }),
    ])
    cobranzaPeriodo = {
      cobrado: Number(cobrado._sum.montoTotal) || 0,
      pendiente: Number(pendiente._sum.montoTotal) || 0,
      cantCobrado: cobrado._count || 0,
      cantPendiente: pendiente._count || 0,
    }
  }

  // Movimientos de caja del mes actual
  const [ingresosMes, egresosMes] = await Promise.all([
    req.req.db.movimientoCaja.aggregate({
      where: {
        tipo: 'INGRESO',
        fecha: { gte: inicioMes },
      },
      _sum: { monto: true },
    }),
    req.req.db.movimientoCaja.aggregate({
      where: {
        tipo: 'EGRESO',
        fecha: { gte: inicioMes },
      },
      _sum: { monto: true },
    }),
  ])

  // Saldos de cajas activas
  const cajas = await req.req.db.caja.findMany({
    where: { activo: true },
    select: { id: true, nombre: true, tipo: true, saldoActual: true },
    orderBy: { nombre: 'asc' },
  })

  const saldoTotalCajas = cajas.reduce((sum, c) => sum + Number(c.saldoActual), 0)

  // Comercios pendientes de aprobación
  const comerciosPendientes = await req.prisma.comercio.count({ where: { estado: 'PENDIENTE' } })

  // Saldo Clientes/Proveedores
  let saldoClientes = 0
  let saldoProveedores = 0
  let sueldosPorPagar = 0

  try {
    if (req.prisma.movimientoContable) {
      const [saldoClientesResult, saldoProveedoresResult] = await Promise.all([
        req.prisma.movimientoContable.aggregate({
          where: {
            tipo: 'FACTURA_VENTA',
            estado: { not: 'ANULADO' },
            saldoPendiente: { gt: 0 },
          },
          _sum: { saldoPendiente: true },
        }),
        req.prisma.movimientoContable.aggregate({
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

  // Sueldos por pagar
  try {
    if (req.prisma.liquidacionSueldo) {
      const sueldosPorPagarResult = await req.prisma.liquidacionSueldo.aggregate({
        where: { estado: 'PENDIENTE' },
        _sum: { totalNeto: true },
      })
      sueldosPorPagar = Number(sueldosPorPagarResult._sum.totalNeto) || 0
    }
  } catch (err) {
    console.warn('liquidacionSueldo table may not exist yet:', err.message)
  }

  // Tarjetas pendientes de conciliación
  let tarjetasPendientes = []
  try {
    tarjetasPendientes = await req.req.db.movimientoCaja.findMany({
      where: {
        conciliado: false,
        anulado: false,
        tipo: 'INGRESO',
        pago: {
          medioPago: {
            tipo: 'TARJETA',
          },
        },
      },
      include: {
        pago: {
          include: {
            medioPago: true,
          },
        },
      },
      orderBy: { fecha: 'asc' },
    })
  } catch (err) {
    console.warn('Error querying tarjetas pendientes:', err.message)
  }

  const tarjetasPendientesResumen = {
    cantidad: tarjetasPendientes.length,
    montoTotal: tarjetasPendientes.reduce((sum, m) => sum + Number(m.monto), 0),
    porTipo: {},
  }

  tarjetasPendientes.forEach(m => {
    const tipo = m.pago?.medioPago?.nombre || 'Sin clasificar'
    if (!tarjetasPendientesResumen.porTipo[tipo]) {
      tarjetasPendientesResumen.porTipo[tipo] = { cantidad: 0, monto: 0 }
    }
    tarjetasPendientesResumen.porTipo[tipo].cantidad++
    tarjetasPendientesResumen.porTipo[tipo].monto += Number(m.monto)
  })

  tarjetasPendientesResumen.detalle = Object.entries(tarjetasPendientesResumen.porTipo).map(([tipo, data]) => ({
    tipo,
    cantidad: data.cantidad,
    monto: Math.round(data.monto),
  }))

  // eCheqs pendientes
  let echequesRecibidos = []
  let echequesEmitidos = []
  try {
    if (req.prisma.eCheq) {
      [echequesRecibidos, echequesEmitidos] = await Promise.all([
        req.prisma.eCheq.findMany({
          where: {
            tipo: 'RECIBIDO',
            estado: { in: ['CARTERA', 'DEPOSITADO'] },
          },
          select: {
            id: true,
            monto: true,
            estado: true,
            fechaVencimiento: true,
            bancoEmisor: true,
            cajaDestinoId: true,
          },
          orderBy: { fechaVencimiento: 'asc' },
        }),
        req.prisma.eCheq.findMany({
          where: {
            tipo: 'EMITIDO',
            estado: 'PENDIENTE',
          },
          select: {
            id: true,
            monto: true,
            estado: true,
            fechaVencimiento: true,
            bancoEmisor: true,
            cajaOrigenId: true,
          },
          orderBy: { fechaVencimiento: 'asc' },
        }),
      ])
    }
  } catch (err) {
    console.warn('eCheq table may not exist yet:', err.message)
  }

  const hoyDate = new Date()
  hoyDate.setHours(0, 0, 0, 0)

  const echeqsRecibidosResumen = {
    cantidad: echequesRecibidos.length,
    montoTotal: echequesRecibidos.reduce((sum, e) => sum + Number(e.monto), 0),
    enCartera: echequesRecibidos.filter(e => e.estado === 'CARTERA').length,
    montoEnCartera: echequesRecibidos.filter(e => e.estado === 'CARTERA').reduce((sum, e) => sum + Number(e.monto), 0),
    depositados: echequesRecibidos.filter(e => e.estado === 'DEPOSITADO').length,
    montoDepositados: echequesRecibidos.filter(e => e.estado === 'DEPOSITADO').reduce((sum, e) => sum + Number(e.monto), 0),
    vencidos: echequesRecibidos.filter(e => new Date(e.fechaVencimiento) < hoyDate).length,
    proximosAVencer: echequesRecibidos.filter(e => {
      const venc = new Date(e.fechaVencimiento)
      const en7Dias = new Date(hoyDate)
      en7Dias.setDate(en7Dias.getDate() + 7)
      return venc >= hoyDate && venc <= en7Dias
    }).length,
  }

  const echeqsEmitidosResumen = {
    cantidad: echequesEmitidos.length,
    montoTotal: echequesEmitidos.reduce((sum, e) => sum + Number(e.monto), 0),
    vencidos: echequesEmitidos.filter(e => new Date(e.fechaVencimiento) < hoyDate).length,
    proximosAVencer: echequesEmitidos.filter(e => {
      const venc = new Date(e.fechaVencimiento)
      const en7Dias = new Date(hoyDate)
      en7Dias.setDate(en7Dias.getDate() + 7)
      return venc >= hoyDate && venc <= en7Dias
    }).length,
  }

  // ============ DATOS HISTÓRICOS PARA GRÁFICOS ============

  // Movimientos de caja de los últimos 6 meses
  const movimientosHistoricos = await req.req.db.movimientoCaja.findMany({
    where: { fecha: { gte: inicio6Meses } },
    select: { fecha: true, tipo: true, monto: true, concepto: true },
    orderBy: { fecha: 'asc' },
  })

  // Agrupar por mes
  const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const cashFlowMensual = []
  for (let i = 5; i >= 0; i--) {
    const fecha = new Date(anioActual, mesActual - 1 - i, 1)
    const mes = fecha.getMonth()
    const anio = fecha.getFullYear()
    const inicioMesHist = new Date(anio, mes, 1)
    const finMesHist = new Date(anio, mes + 1, 0, 23, 59, 59)

    const movsMes = movimientosHistoricos.filter(m => {
      const fechaMov = new Date(m.fecha)
      return fechaMov >= inicioMesHist && fechaMov <= finMesHist
    })

    const ingresos = movsMes.filter(m => m.tipo === 'INGRESO').reduce((sum, m) => sum + Number(m.monto), 0)
    const egresos = movsMes.filter(m => m.tipo === 'EGRESO').reduce((sum, m) => sum + Number(m.monto), 0)

    cashFlowMensual.push({
      mes: `${mesesNombres[mes]} ${anio.toString().slice(-2)}`,
      ingresos: Math.round(ingresos),
      egresos: Math.round(egresos),
      neto: Math.round(ingresos - egresos),
    })
  }

  // Cobranza de cuotas de los últimos 6 periodos
  const periodosHistoricos = await req.prisma.periodo.findMany({
    where: { estado: 'GENERADO' },
    orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
    take: 6,
    include: {
      cargos: {
        select: { montoTotal: true, estado: true },
      },
    },
  })

  const cobranzaHistorica = periodosHistoricos.reverse().map(p => {
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

  // Composición de ingresos del mes actual
  const ingresosDelMes = movimientosHistoricos.filter(m => {
    const fechaMov = new Date(m.fecha)
    return fechaMov >= inicioMes && m.tipo === 'INGRESO'
  })

  const composicionIngresos = {}
  ingresosDelMes.forEach(m => {
    const concepto = m.concepto?.toLowerCase() || 'otros'
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

  // Composición de egresos del mes actual
  const egresosDelMes = movimientosHistoricos.filter(m => {
    const fechaMov = new Date(m.fecha)
    return fechaMov >= inicioMes && m.tipo === 'EGRESO'
  })

  const composicionEgresos = {}
  egresosDelMes.forEach(m => {
    const concepto = m.concepto?.toLowerCase() || 'otros'
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

  res.json({
    success: true,
    data: {
      // Socios
      sociosActivos,
      sociosConActividad: cantSociosConActividad,
      sociosSinActividad,
      // Periodo y cobranza
      periodoActual: periodoActual ? {
        id: periodoActual.id,
        nombre: periodoActual.nombre,
        mes: periodoActual.mes,
        anio: periodoActual.anio,
      } : null,
      cobranzaPeriodo,
      // Caja
      ingresosMes: Number(ingresosMes._sum.monto) || 0,
      egresosMes: Number(egresosMes._sum.monto) || 0,
      cajas: cajas.map(c => ({ ...c, saldoActual: Number(c.saldoActual) })),
      saldoTotalCajas,
      // Tarjetas pendientes de conciliación
      tarjetasPendientes: {
        cantidad: tarjetasPendientesResumen.cantidad,
        montoTotal: Math.round(tarjetasPendientesResumen.montoTotal),
        detalle: tarjetasPendientesResumen.detalle,
      },
      // eCheqs
      echeqsRecibidos: {
        cantidad: echeqsRecibidosResumen.cantidad,
        montoTotal: Math.round(echeqsRecibidosResumen.montoTotal),
        enCartera: echeqsRecibidosResumen.enCartera,
        montoEnCartera: Math.round(echeqsRecibidosResumen.montoEnCartera),
        depositados: echeqsRecibidosResumen.depositados,
        montoDepositados: Math.round(echeqsRecibidosResumen.montoDepositados),
        vencidos: echeqsRecibidosResumen.vencidos,
        proximosAVencer: echeqsRecibidosResumen.proximosAVencer,
      },
      echeqsEmitidos: {
        cantidad: echeqsEmitidosResumen.cantidad,
        montoTotal: Math.round(echeqsEmitidosResumen.montoTotal),
        vencidos: echeqsEmitidosResumen.vencidos,
        proximosAVencer: echeqsEmitidosResumen.proximosAVencer,
      },
      // Cuentas pendientes
      saldoClientes,
      saldoProveedores,
      sueldosPorPagar,
      // Alertas
      comerciosPendientes,
      // Datos históricos para gráficos
      graficos: {
        cashFlowMensual,
        cobranzaHistorica,
        ingresosComposicion,
        egresosComposicion,
      },
    },
  })
}))

export default router
