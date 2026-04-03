/**
 * Rutas de Dashboard del Buffet
 * - KPIs del buffet
 * - Últimas ventas
 */
import express from 'express'
import prisma from '../../lib/prisma.js'
import { authAdmin, checkPermiso } from '../../middleware/auth.js'

const router = express.Router()

/**
 * GET /dashboard
 * KPIs del buffet
 */
router.get('/dashboard', authAdmin, checkPermiso('BUFFET_VER'), async (req, res) => {
  try {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const manana = new Date(hoy)
    manana.setDate(manana.getDate() + 1)

    // Mesas
    const mesasTotal = await req.db.mesa.count({ where: { activo: true } })
    const mesasOcupadas = await req.db.mesa.count({ where: { activo: true, estado: 'OCUPADA' } })

    // Comandas del día
    const comandasActivas = await req.db.comanda.count({
      where: { estado: { in: ['ABIERTA', 'EN_PREPARACION', 'CUENTA_PEDIDA'] } }
    })

    const comandasCerradas = await req.db.comanda.count({
      where: {
        estado: 'CERRADA',
        horaCierre: { gte: hoy, lt: manana }
      }
    })

    // Take away del día
    const takeAwayPendientes = await prisma.pedidoTakeAway.count({
      where: { estado: { in: ['RECIBIDO', 'EN_PREPARACION', 'LISTO'] } }
    })

    const takeAwayEntregados = await prisma.pedidoTakeAway.count({
      where: {
        estado: 'ENTREGADO',
        horaEntregado: { gte: hoy, lt: manana }
      }
    })

    // Ventas del día
    const ventasBuffet = await req.db.movimientoCaja.aggregate({
      where: {
        OR: [
          { comandaId: { not: null } },
          { pedidoTakeAwayId: { not: null } },
          { concepto: { startsWith: 'Kiosco' } }
        ],
        fecha: { gte: hoy, lt: manana },
        anulado: false
      },
      _sum: { monto: true }
    })

    // Items pendientes cocina
    const itemsPendientesCocina = await req.db.itemComanda.count({
      where: { estado: { in: ['ENVIADO_COCINA', 'EN_PREPARACION'] } }
    })

    res.json({
      success: true,
      data: {
        mesas: {
          total: mesasTotal,
          ocupadas: mesasOcupadas,
          libres: mesasTotal - mesasOcupadas
        },
        comandas: {
          activas: comandasActivas,
          cerradasHoy: comandasCerradas
        },
        takeAway: {
          pendientes: takeAwayPendientes,
          entregadosHoy: takeAwayEntregados
        },
        cocina: {
          itemsPendientes: itemsPendientesCocina
        },
        ventas: {
          totalHoy: Number(ventasBuffet._sum.monto || 0)
        }
      }
    })
  } catch (error) {
    console.error('Error en dashboard:', error)
    res.status(500).json({ success: false, error: 'Error al cargar dashboard' })
  }
})

/**
 * GET /ultimas-ventas
 * Obtener últimas ventas del día (para reimprimir tickets)
 */
router.get('/ultimas-ventas', authAdmin, checkPermiso('BUFFET_COBRAR', 'BUFFET_KIOSCO'), async (req, res) => {
  try {
    const { limit = 20 } = req.query
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    // Comandas cerradas hoy
    const comandas = await req.db.comanda.findMany({
      where: {
        estado: 'CERRADA',
        horaCierre: { gte: hoy }
      },
      orderBy: { horaCierre: 'desc' },
      take: parseInt(limit),
      include: {
        mesa: { select: { numero: true } },
        socio: { select: { nroSocio: true, apellidoNombre: true } },
        cerrador: { select: { nombre: true, apellido: true } },
        items: {
          include: { productoBuffet: { select: { nombre: true } } }
        }
      }
    })

    // Pedidos takeaway pagados hoy
    const takeaway = await prisma.pedidoTakeAway.findMany({
      where: {
        estado: { in: ['PAGADO', 'ENTREGADO'] },
        horaPagado: { gte: hoy }
      },
      orderBy: { horaPagado: 'desc' },
      take: parseInt(limit),
      include: {
        items: {
          include: { productoBuffet: { select: { nombre: true } } }
        }
      }
    })

    // Obtener comprobantes electrónicos asociados
    const comandaIds = comandas.map(c => c.id)
    const takeawayIds = takeaway.map(t => t.id)

    const comprobantes = await prisma.comprobanteElectronico.findMany({
      where: {
        OR: [
          { comandaId: { in: comandaIds } },
          { pedidoTakeawayId: { in: takeawayIds } }
        ]
      },
      select: {
        id: true,
        tipo: true,
        puntoVenta: true,
        numero: true,
        cae: true,
        total: true,
        comandaId: true,
        pedidoTakeawayId: true
      }
    })

    // Mapear comprobantes
    const comprobantesMap = {}
    comprobantes.forEach(c => {
      if (c.comandaId) comprobantesMap[`comanda-${c.comandaId}`] = c
      if (c.pedidoTakeawayId) comprobantesMap[`takeaway-${c.pedidoTakeawayId}`] = c
    })

    // Formatear respuesta unificada
    const ventas = [
      ...comandas.map(c => ({
        id: c.id,
        tipo: 'COMANDA',
        numero: c.numero,
        fecha: c.horaCierre,
        total: Number(c.total),
        mesa: c.mesa?.numero,
        socio: c.socio ? `${c.socio.nroSocio} - ${c.socio.apellidoNombre}` : null,
        esVentaInterna: c.esVentaInterna,
        cobradoPor: c.cerrador ? `${c.cerrador.nombre} ${c.cerrador.apellido || ''}`.trim() : null,
        itemsCount: c.items?.length || 0,
        comprobante: comprobantesMap[`comanda-${c.id}`] || null
      })),
      ...takeaway.map(t => ({
        id: t.id,
        tipo: 'TAKEAWAY',
        numero: t.numero,
        fecha: t.horaPagado,
        total: Number(t.total),
        cliente: t.nombreCliente,
        esVentaInterna: t.esVentaInterna,
        itemsCount: t.items?.length || 0,
        comprobante: comprobantesMap[`takeaway-${t.id}`] || null
      }))
    ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, parseInt(limit))

    res.json({ success: true, data: ventas })
  } catch (error) {
    console.error('Error obteniendo últimas ventas:', error)
    res.status(500).json({ success: false, error: 'Error al obtener últimas ventas' })
  }
})

/**
 * GET /dashboard-estadisticas
 * Estadísticas detalladas del buffet con filtro de fechas
 */
router.get('/dashboard-estadisticas', authAdmin, checkPermiso('BUFFET_VER'), async (req, res) => {
  try {
    const { desde, hasta } = req.query

    if (!desde || !hasta) {
      return res.status(400).json({ success: false, error: 'Fechas requeridas' })
    }

    const fechaDesde = new Date(desde)
    const fechaHasta = new Date(hasta)

    // Calcular período anterior para comparación
    const duracion = fechaHasta - fechaDesde
    const fechaDesdeAnterior = new Date(fechaDesde - duracion)
    const fechaHastaAnterior = new Date(fechaDesde)

    // Las columnas fecha/horaCierre/horaPagado son `timestamp without time zone`
    // guardadas en hora local Argentina (UTC-3). Prisma envía UTC epoch como string literal,
    // así que ajustamos -3h para que la comparación sea correcta.
    const AR_OFFSET_MS = 3 * 60 * 60 * 1000
    const fd = new Date(fechaDesde.getTime() - AR_OFFSET_MS)
    const fh = new Date(fechaHasta.getTime() - AR_OFFSET_MS)
    const fdAnt = new Date(fechaDesdeAnterior.getTime() - AR_OFFSET_MS)
    const fhAnt = new Date(fechaHastaAnterior.getTime() - AR_OFFSET_MS)

    // Comandas cerradas en el período
    const comandas = await req.db.comanda.findMany({
      where: {
        estado: 'CERRADA',
        horaCierre: { gte: fd, lte: fh }
      },
      include: {
        items: {
          where: { estado: { not: 'ANULADO' } },
          include: { productoBuffet: { select: { id: true, nombre: true, categoriaMenu: { select: { nombre: true } } } } }
        }
      }
    })

    // Comandas período anterior
    const comandasAnterior = await req.db.comanda.aggregate({
      where: {
        estado: 'CERRADA',
        horaCierre: { gte: fdAnt, lt: fhAnt }
      },
      _sum: { total: true },
      _count: true
    })

    // Pedidos TakeAway en el período
    const takeaway = await prisma.pedidoTakeAway.findMany({
      where: {
        estado: { in: ['PAGADO', 'ENTREGADO'] },
        horaPagado: { gte: fd, lte: fh }
      },
      include: {
        items: {
          include: { productoBuffet: { select: { id: true, nombre: true, categoriaMenu: { select: { nombre: true } } } } }
        }
      }
    })

    // Cajas del buffet para filtrar egresos
    const cajasBuffet = await req.db.caja.findMany({
      where: { paraBuffet: true, activo: true },
      select: { id: true, saldoInicial: true }
    })
    const cajaBuffetIds = cajasBuffet.map(c => c.id)

    // Egresos del período en cajas de buffet
    const egresosRaw = await req.db.movimientoCaja.findMany({
      where: {
        cajaId: { in: cajaBuffetIds },
        tipo: 'EGRESO',
        fecha: { gte: fd, lte: fh },
        anulado: false
      },
      select: { monto: true, concepto: true, fecha: true }
    })

    const totalEgresos = egresosRaw.reduce((sum, e) => sum + Number(e.monto), 0)

    // Agrupar egresos por concepto
    const egresosMap = {}
    egresosRaw.forEach(e => {
      const key = e.concepto || 'Sin concepto'
      if (!egresosMap[key]) egresosMap[key] = { concepto: key, total: 0, cantidad: 0 }
      egresosMap[key].total += Number(e.monto)
      egresosMap[key].cantidad++
    })
    const egresosPorConcepto = Object.values(egresosMap).sort((a, b) => b.total - a.total)

    // Ventas de Kiosco (movimientos de caja)
    const ventasKiosco = await req.db.movimientoCaja.aggregate({
      where: {
        concepto: { startsWith: 'Kiosco' },
        fecha: { gte: fd, lte: fh },
        anulado: false
      },
      _sum: { monto: true },
      _count: true
    })

    // Calcular totales
    const totalComandas = comandas.reduce((sum, c) => sum + Number(c.total), 0)
    const totalTakeaway = takeaway.reduce((sum, t) => sum + Number(t.total), 0)
    const totalKiosco = Number(ventasKiosco._sum.monto || 0)
    const ventasTotal = totalComandas + totalTakeaway + totalKiosco
    const cantidadVentas = comandas.length + takeaway.length + (ventasKiosco._count || 0)

    // Totales por medio de pago
    let pagoEfectivo = 0, pagoTarjeta = 0, pagoDigital = 0, pagoCtaCte = 0

    // Analizar medios de pago de comandas
    comandas.forEach(c => {
      const metodoPago = (c.metodoPago || '').toUpperCase()
      const total = Number(c.total)
      if (metodoPago.includes('EFECTIVO')) pagoEfectivo += total
      else if (metodoPago.includes('TARJETA') || metodoPago.includes('DEBITO') || metodoPago.includes('CREDITO')) pagoTarjeta += total
      else if (metodoPago.includes('QR') || metodoPago.includes('TRANSFER') || metodoPago.includes('MERCADO')) pagoDigital += total
      else if (metodoPago.includes('CTA') || metodoPago.includes('CUENTA')) pagoCtaCte += total
      else pagoEfectivo += total // Default
    })

    // Analizar medios de pago de takeaway
    takeaway.forEach(t => {
      const metodoPago = (t.metodoPago || '').toUpperCase()
      const total = Number(t.total)
      if (metodoPago.includes('EFECTIVO')) pagoEfectivo += total
      else if (metodoPago.includes('TARJETA') || metodoPago.includes('DEBITO') || metodoPago.includes('CREDITO')) pagoTarjeta += total
      else if (metodoPago.includes('QR') || metodoPago.includes('TRANSFER') || metodoPago.includes('MERCADO')) pagoDigital += total
      else pagoEfectivo += total
    })

    // Asumir kiosco como efectivo por defecto
    pagoEfectivo += totalKiosco

    // Top productos (con categoría para agrupación)
    const productosVendidos = {}
    const addProd = (pb, cantidad, subtotal) => {
      const nombre = pb?.nombre || 'Producto'
      const categoria = pb?.categoriaMenu?.nombre || 'Sin categoría'
      if (!productosVendidos[nombre]) {
        productosVendidos[nombre] = { nombre, categoria, cantidad: 0, total: 0 }
      }
      productosVendidos[nombre].cantidad += cantidad
      productosVendidos[nombre].total += Number(subtotal)
    }
    comandas.forEach(c => c.items.forEach(item => addProd(item.productoBuffet, item.cantidad, item.subtotal)))
    takeaway.forEach(t => t.items.forEach(item => addProd(item.productoBuffet, item.cantidad, item.subtotal)))

    // Stock ingresos del período por productoBuffet
    const stockIngresosRaw = await req.db.movimientoStock.findMany({
      where: { tipo: 'INGRESO', fecha: { gte: fd, lte: fh } },
      select: {
        cantidad: true,
        productoVariante: {
          select: {
            producto: {
              select: { productoBuffet: { select: { nombre: true } } }
            }
          }
        }
      }
    })
    const stockIngresosPorProducto = {}
    stockIngresosRaw.forEach(m => {
      const nombre = m.productoVariante?.producto?.productoBuffet?.nombre
      if (!nombre) return
      if (!stockIngresosPorProducto[nombre]) stockIngresosPorProducto[nombre] = 0
      stockIngresosPorProducto[nombre] += Number(m.cantidad)
    })

    const topProductos = Object.values(productosVendidos)
      .sort((a, b) => b.cantidad - a.cantidad)
      .map(p => ({ ...p, ingresoStock: stockIngresosPorProducto[p.nombre] || 0 }))

    // Ventas por hora (siempre)
    const ventasPorHora = {}
    let maxVentaHora = 0
    for (let h = 0; h < 24; h++) {
      ventasPorHora[h] = { cantidad: 0, total: 0 }
    }
    comandas.forEach(c => {
      const hora = new Date(c.horaCierre).getHours()
      ventasPorHora[hora].cantidad++
      ventasPorHora[hora].total += Number(c.total)
      if (ventasPorHora[hora].total > maxVentaHora) maxVentaHora = ventasPorHora[hora].total
    })
    takeaway.forEach(t => {
      const hora = new Date(t.horaPagado).getHours()
      ventasPorHora[hora].cantidad++
      ventasPorHora[hora].total += Number(t.total)
      if (ventasPorHora[hora].total > maxVentaHora) maxVentaHora = ventasPorHora[hora].total
    })

    // Saldo anterior al período (cajas buffet)
    const saldoInicialCajas = cajasBuffet.reduce((sum, c) => sum + Number(c.saldoInicial || 0), 0)
    const [movAntIngresos, movAntEgresos] = await Promise.all([
      req.db.movimientoCaja.aggregate({
        where: { cajaId: { in: cajaBuffetIds }, tipo: 'INGRESO', fecha: { lt: fd }, anulado: false },
        _sum: { monto: true }
      }),
      req.db.movimientoCaja.aggregate({
        where: { cajaId: { in: cajaBuffetIds }, tipo: 'EGRESO', fecha: { lt: fd }, anulado: false },
        _sum: { monto: true }
      })
    ])
    const saldoAnterior = saldoInicialCajas
      + Number(movAntIngresos._sum.monto || 0)
      - Number(movAntEgresos._sum.monto || 0)

    // Por medio de pago: período actual + saldo anterior
    const [movPeriodoPorMedio, movAntPorMedio] = await Promise.all([
      req.db.movimientoCaja.groupBy({
        by: ['medioPagoId', 'tipo'],
        where: { cajaId: { in: cajaBuffetIds }, fecha: { gte: fd, lte: fh }, anulado: false },
        _sum: { monto: true }
      }),
      req.db.movimientoCaja.groupBy({
        by: ['medioPagoId', 'tipo'],
        where: { cajaId: { in: cajaBuffetIds }, fecha: { lt: fd }, anulado: false },
        _sum: { monto: true }
      })
    ])

    const allMedioPagoIds = [...new Set([
      ...movPeriodoPorMedio.map(r => r.medioPagoId),
      ...movAntPorMedio.map(r => r.medioPagoId)
    ].filter(Boolean))]
    const mediosPagoListDash = allMedioPagoIds.length
      ? await req.db.medioPago.findMany({ where: { id: { in: allMedioPagoIds } }, select: { id: true, nombre: true, tipo: true } })
      : []
    const mediosPagoByIdDash = Object.fromEntries(mediosPagoListDash.map(m => [m.id, m]))

    const medioPagoMapDash = {}
    const getOrCreate = (medioPagoId) => {
      const key = medioPagoId ?? 'null'
      if (!medioPagoMapDash[key]) {
        const mp = medioPagoId ? mediosPagoByIdDash[medioPagoId] : null
        medioPagoMapDash[key] = {
          medioPagoId,
          medioPago: mp?.nombre ?? null,
          medioPagoTipo: mp?.tipo ?? null,
          antIngresos: 0, antEgresos: 0,
          ingresos: 0, egresos: 0
        }
      }
      return medioPagoMapDash[key]
    }
    movAntPorMedio.forEach(r => {
      const e = getOrCreate(r.medioPagoId)
      if (r.tipo === 'INGRESO') e.antIngresos += Number(r._sum.monto || 0)
      else e.antEgresos += Number(r._sum.monto || 0)
    })
    movPeriodoPorMedio.forEach(r => {
      const e = getOrCreate(r.medioPagoId)
      if (r.tipo === 'INGRESO') e.ingresos += Number(r._sum.monto || 0)
      else e.egresos += Number(r._sum.monto || 0)
    })
    const porMedioPagoDash = Object.values(medioPagoMapDash).map(m => ({
      medioPagoId: m.medioPagoId,
      medioPago: m.medioPago,
      medioPagoTipo: m.medioPagoTipo,
      saldoAnterior: m.antIngresos - m.antEgresos,
      ingresos: m.ingresos,
      egresos: m.egresos,
      saldo: (m.antIngresos - m.antEgresos) + m.ingresos - m.egresos
    })).sort((a, b) => (a.medioPago ?? 'ZZZ').localeCompare(b.medioPago ?? 'ZZZ'))

    // Ventas por día
    const ventasPorDiaMap = {}
    const addDia = (fecha, total) => {
      const d = new Date(fecha)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (!ventasPorDiaMap[key]) ventasPorDiaMap[key] = { fecha: key, label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`, total: 0 }
      ventasPorDiaMap[key].total += total
    }
    comandas.forEach(c => addDia(c.horaCierre, Number(c.total)))
    takeaway.forEach(t => addDia(t.horaPagado, Number(t.total)))
    const ventasPorDia = Object.values(ventasPorDiaMap).sort((a, b) => a.fecha.localeCompare(b.fecha))

    res.json({
      success: true,
      data: {
        // Totales
        ventasTotal,
        ventasTotalAnterior: Number(comandasAnterior._sum.total || 0),
        cantidadVentas,
        ticketPromedio: cantidadVentas > 0 ? ventasTotal / cantidadVentas : 0,

        // Por canal
        mesasAtendidas: comandas.length,
        promedioMesa: comandas.length > 0 ? totalComandas / comandas.length : 0,
        pedidosTakeaway: takeaway.length,
        totalTakeaway,
        ventasKiosco: totalKiosco,
        cantidadKiosco: ventasKiosco._count || 0,

        // Medios de pago
        pagoEfectivo,
        pagoTarjeta,
        pagoDigital,
        pagoCtaCte,

        // Egresos
        totalEgresos,
        egresosPorConcepto,
        saldo: ventasTotal - totalEgresos,

        // Saldo
        saldoAnterior,
        porMedioPago: porMedioPagoDash,

        // Rankings
        topProductos,

        // Por hora
        ventasPorHora,
        maxVentaHora,

        // Por día
        ventasPorDia
      }
    })
  } catch (error) {
    console.error('Error en dashboard estadísticas:', error)
    res.status(500).json({ success: false, error: 'Error al cargar estadísticas' })
  }
})

/**
 * GET /ventas-periodo
 * Listado de ventas en un período
 */
router.get('/ventas-periodo', authAdmin, checkPermiso('BUFFET_COBRAR', 'BUFFET_KIOSCO'), async (req, res) => {
  try {
    const { desde, hasta, limit = 50 } = req.query

    if (!desde || !hasta) {
      return res.status(400).json({ success: false, error: 'Fechas requeridas' })
    }

    const fechaDesde = new Date(desde)
    const fechaHasta = new Date(hasta)
    const AR = 3 * 60 * 60 * 1000
    const fd = new Date(fechaDesde.getTime() - AR)
    const fh = new Date(fechaHasta.getTime() - AR)

    // Comandas cerradas en el período
    const comandas = await req.db.comanda.findMany({
      where: {
        estado: 'CERRADA',
        horaCierre: { gte: fd, lte: fh }
      },
      orderBy: { horaCierre: 'desc' },
      take: parseInt(limit),
      include: {
        mesa: { select: { numero: true } },
        socio: { select: { nroSocio: true, apellidoNombre: true } },
        cerrador: { select: { nombre: true, apellido: true } }
      }
    })

    // Pedidos TakeAway en el período
    const takeaway = await prisma.pedidoTakeAway.findMany({
      where: {
        estado: { in: ['PAGADO', 'ENTREGADO'] },
        horaPagado: { gte: fd, lte: fh }
      },
      orderBy: { horaPagado: 'desc' },
      take: parseInt(limit)
    })

    // Obtener comprobantes
    const comandaIds = comandas.map(c => c.id)
    const takeawayIds = takeaway.map(t => t.id)

    const comprobantes = await prisma.comprobanteElectronico.findMany({
      where: {
        OR: [
          { comandaId: { in: comandaIds } },
          { pedidoTakeawayId: { in: takeawayIds } }
        ]
      },
      select: {
        tipo: true,
        puntoVenta: true,
        numero: true,
        cae: true,
        comandaId: true,
        pedidoTakeawayId: true
      }
    })

    const comprobantesMap = {}
    comprobantes.forEach(c => {
      if (c.comandaId) comprobantesMap[`comanda-${c.comandaId}`] = c
      if (c.pedidoTakeawayId) comprobantesMap[`takeaway-${c.pedidoTakeawayId}`] = c
    })

    // Formatear respuesta
    const ventas = [
      ...comandas.map(c => ({
        id: c.id,
        tipo: 'COMANDA',
        numero: c.numero,
        fecha: c.horaCierre,
        total: Number(c.total),
        mesa: c.mesa?.numero,
        socio: c.socio ? `${c.socio.nroSocio} - ${c.socio.apellidoNombre}` : null,
        esVentaInterna: c.esVentaInterna,
        cobradoPor: c.cerrador ? `${c.cerrador.nombre} ${c.cerrador.apellido || ''}`.trim() : null,
        comprobante: comprobantesMap[`comanda-${c.id}`] || null
      })),
      ...takeaway.map(t => ({
        id: t.id,
        tipo: 'TAKEAWAY',
        numero: t.numero,
        fecha: t.horaPagado,
        total: Number(t.total),
        cliente: t.nombreCliente,
        esVentaInterna: t.esVentaInterna,
        comprobante: comprobantesMap[`takeaway-${t.id}`] || null
      }))
    ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, parseInt(limit))

    res.json({ success: true, data: ventas })
  } catch (error) {
    console.error('Error obteniendo ventas del período:', error)
    res.status(500).json({ success: false, error: 'Error al obtener ventas' })
  }
})

/**
 * POST /reporte-cierre
 * Genera reporte de cierre ESC/POS para impresora térmica 80mm
 * Retorna base64 listo para enviar a /imprimir-ticket-directo
 */
router.post('/reporte-cierre', authAdmin, checkPermiso('BUFFET_VER'), async (req, res) => {
  try {
    const { desde, hasta } = req.body

    if (!desde || !hasta) {
      return res.status(400).json({ success: false, error: 'Fechas requeridas' })
    }

    const fechaDesde = new Date(desde)
    const fechaHasta = new Date(hasta)

    // Configuración del club
    const clubConfigRows = await req.db.configuracion.findMany({
      where: { clave: { in: ['CLUB_NOMBRE', 'CLUB_DIRECCION'] } }
    })
    const configMap = Object.fromEntries(clubConfigRows.map(c => [c.clave, c.valor]))
    const clubNombre = configMap.CLUB_NOMBRE || 'Club Sportivo Pilar'
    const clubDireccion = configMap.CLUB_DIRECCION || ''

    // Cajas del buffet
    const cajasBuffet = await req.db.caja.findMany({
      where: { paraBuffet: true, activo: true },
      select: { id: true, saldoInicial: true }
    })
    const cajaBuffetIds = cajasBuffet.map(c => c.id)
    const saldoInicialCajas = cajasBuffet.reduce((sum, c) => sum + Number(c.saldoInicial || 0), 0)

    // Saldo anterior
    const [movAntIngresos, movAntEgresos] = await Promise.all([
      req.db.movimientoCaja.aggregate({
        where: { cajaId: { in: cajaBuffetIds }, tipo: 'INGRESO', fecha: { lt: fechaDesde }, anulado: false },
        _sum: { monto: true }
      }),
      req.db.movimientoCaja.aggregate({
        where: { cajaId: { in: cajaBuffetIds }, tipo: 'EGRESO', fecha: { lt: fechaDesde }, anulado: false },
        _sum: { monto: true }
      })
    ])
    const saldoAnterior = saldoInicialCajas
      + Number(movAntIngresos._sum.monto || 0)
      - Number(movAntEgresos._sum.monto || 0)

    // Movimientos del período por medio de pago
    const movPeriodoPorMedio = await req.db.movimientoCaja.groupBy({
      by: ['medioPagoId', 'tipo'],
      where: { cajaId: { in: cajaBuffetIds }, fecha: { gte: fechaDesde, lte: fechaHasta }, anulado: false },
      _sum: { monto: true }
    })

    const allMedioPagoIds = [...new Set(movPeriodoPorMedio.map(r => r.medioPagoId).filter(Boolean))]
    const mediosPagoList = allMedioPagoIds.length
      ? await req.db.medioPago.findMany({ where: { id: { in: allMedioPagoIds } }, select: { id: true, nombre: true } })
      : []
    const mediosPagoById = Object.fromEntries(mediosPagoList.map(m => [m.id, m]))

    const medioMap = {}
    movPeriodoPorMedio.forEach(r => {
      const key = r.medioPagoId ?? 'null'
      if (!medioMap[key]) {
        const mp = r.medioPagoId ? mediosPagoById[r.medioPagoId] : null
        medioMap[key] = { nombre: mp?.nombre ?? 'Sin especificar', ingresos: 0, egresos: 0 }
      }
      if (r.tipo === 'INGRESO') medioMap[key].ingresos += Number(r._sum.monto || 0)
      else medioMap[key].egresos += Number(r._sum.monto || 0)
    })
    const mediosPago = Object.values(medioMap).sort((a, b) => a.nombre.localeCompare(b.nombre))

    const totalIngresos = mediosPago.reduce((s, m) => s + m.ingresos, 0)
    const totalEgresos = mediosPago.reduce((s, m) => s + m.egresos, 0)
    const saldoFinal = saldoAnterior + totalIngresos - totalEgresos

    // Ventas por categoría (comandas + takeaway)
    const comandas = await req.db.comanda.findMany({
      where: { estado: 'CERRADA', horaCierre: { gte: fechaDesde, lte: fechaHasta } },
      include: {
        items: {
          where: { estado: { not: 'ANULADO' } },
          include: { productoBuffet: { select: { nombre: true, categoriaMenu: { select: { nombre: true } } } } }
        }
      }
    })

    const takeaway = await prisma.pedidoTakeAway.findMany({
      where: { estado: { in: ['PAGADO', 'ENTREGADO'] }, horaPagado: { gte: fechaDesde, lte: fechaHasta } },
      include: {
        items: {
          include: { productoBuffet: { select: { nombre: true, categoriaMenu: { select: { nombre: true } } } } }
        }
      }
    })

    const catMap = {}
    const addItem = (item) => {
      const cat = item.productoBuffet?.categoriaMenu?.nombre || 'Sin categoría'
      if (!catMap[cat]) catMap[cat] = { nombre: cat, cantidad: 0, total: 0 }
      catMap[cat].cantidad += item.cantidad
      catMap[cat].total += Number(item.subtotal || 0)
    }
    comandas.forEach(c => c.items.forEach(addItem))
    takeaway.forEach(t => t.items.forEach(addItem))

    const categorias = Object.values(catMap).sort((a, b) => b.total - a.total)
    const totalUnidades = categorias.reduce((s, c) => s + c.cantidad, 0)
    const totalImporte = categorias.reduce((s, c) => s + c.total, 0)

    // ====== GENERAR ESC/POS ======
    const ESC = '\x1B'
    const GS = '\x1D'
    const INIT = ESC + '@'
    const ALIGN_LEFT = ESC + 'a\x00'
    const ALIGN_CENTER = ESC + 'a\x01'
    const BOLD_ON = ESC + 'E\x01'
    const BOLD_OFF = ESC + 'E\x00'
    const DOUBLE_HEIGHT = GS + '!\x01'
    const NORMAL_SIZE = GS + '!\x00'
    const CUT = GS + 'V\x00'
    const FEED = (n) => ESC + 'd' + String.fromCharCode(n)

    const W = 48
    const sep = (c = '-') => c.repeat(W)
    const fmtPrice = (n) => `$${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    const fmtLV = (label, value) => {
      const sp = W - label.length - value.length
      return label + ' '.repeat(Math.max(1, sp)) + value
    }
    const fmtCols3 = (left, center, right) => {
      // 3-column: left (24), center (8), right (16)
      const l = left.substring(0, 22).padEnd(22)
      const c = center.substring(0, 6).padStart(6)
      const r = right.substring(0, 12).padStart(12)
      return l + ' ' + c + ' ' + r
    }

    const fechaDesdeStr = fechaDesde.toLocaleDateString('es-AR')
    const fechaHastaStr = fechaHasta.toLocaleDateString('es-AR')
    const periodoStr = fechaDesdeStr === fechaHastaStr ? fechaDesdeStr : `${fechaDesdeStr} - ${fechaHastaStr}`

    let out = ''
    out += INIT
    out += ALIGN_CENTER
    out += BOLD_ON + DOUBLE_HEIGHT
    out += clubNombre + '\n'
    out += NORMAL_SIZE + BOLD_OFF
    if (clubDireccion) out += clubDireccion + '\n'
    out += sep('=') + '\n'
    out += BOLD_ON + 'REPORTE DE CIERRE\n' + BOLD_OFF
    out += `Período: ${periodoStr}\n`
    out += sep('=') + '\n'

    // ---- RESUMEN DE CAJA ----
    out += ALIGN_LEFT
    out += BOLD_ON + 'RESUMEN DE CAJA\n' + BOLD_OFF
    out += sep() + '\n'
    out += fmtLV('Saldo anterior', fmtPrice(saldoAnterior)) + '\n'
    out += '\n'

    // Ingresos por medio de pago
    out += BOLD_ON + 'Ingresos:\n' + BOLD_OFF
    mediosPago.forEach(m => {
      if (m.ingresos > 0) {
        out += fmtLV(`  ${m.nombre}`, fmtPrice(m.ingresos)) + '\n'
      }
    })
    out += BOLD_ON + fmtLV('  TOTAL INGRESOS', fmtPrice(totalIngresos)) + BOLD_OFF + '\n'
    out += '\n'

    // Egresos por medio de pago
    out += BOLD_ON + 'Egresos:\n' + BOLD_OFF
    mediosPago.forEach(m => {
      if (m.egresos > 0) {
        out += fmtLV(`  ${m.nombre}`, fmtPrice(m.egresos)) + '\n'
      }
    })
    if (totalEgresos === 0) out += '  (sin egresos)\n'
    out += BOLD_ON + fmtLV('  TOTAL EGRESOS', fmtPrice(totalEgresos)) + BOLD_OFF + '\n'
    out += '\n'

    out += sep('=') + '\n'
    out += BOLD_ON + fmtLV('SALDO FINAL', fmtPrice(saldoFinal)) + BOLD_OFF + '\n'
    out += sep('=') + '\n'

    // ---- VENTAS POR CATEGORÍA ----
    out += '\n'
    out += ALIGN_CENTER + BOLD_ON + 'VENTAS POR CATEGORIA\n' + BOLD_OFF
    out += ALIGN_LEFT
    out += sep() + '\n'
    // Header
    out += fmtCols3('Categoría', 'Unid.', 'Importe') + '\n'
    out += sep() + '\n'
    categorias.forEach(c => {
      out += fmtCols3(c.nombre, String(c.cantidad), fmtPrice(c.total)) + '\n'
    })
    if (categorias.length === 0) out += '  (sin ventas en el período)\n'
    out += sep() + '\n'
    out += BOLD_ON + fmtCols3('TOTAL', String(totalUnidades), fmtPrice(totalImporte)) + BOLD_OFF + '\n'
    out += sep('=') + '\n'

    out += FEED(4)
    out += CUT

    const ticketBase64 = Buffer.from(out, 'binary').toString('base64')

    res.json({ success: true, data: { ticketBase64 } })
  } catch (error) {
    console.error('Error generando reporte de cierre:', error)
    res.status(500).json({ success: false, error: 'Error al generar reporte' })
  }
})

/**
 * GET /tendencia-mensual
 * Retorna los últimos N meses de movimientos de caja del buffet
 * agrupados por mes: ingresos, egresos, resultado neto
 */
router.get('/tendencia-mensual', authAdmin, checkPermiso('BUFFET_VER'), async (req, res) => {
  try {
    const meses = Math.min(parseInt(req.query.meses) || 12, 24)

    // Inicio del primer mes a analizar
    const ahora = new Date()
    const inicioRango = new Date(ahora.getFullYear(), ahora.getMonth() - (meses - 1), 1)

    // Traer todos los movimientos de caja del buffet en el período
    const movimientos = await req.db.movimientoCaja.findMany({
      where: {
        fecha: { gte: inicioRango },
        anulado: false,
        OR: [
          { comandaId: { not: null } },
          { pedidoTakeAwayId: { not: null } },
          { concepto: { startsWith: 'Kiosco' } },
          { tipo: 'EGRESO' }
        ]
      },
      select: { fecha: true, monto: true, tipo: true }
    })

    // Agrupar por año-mes
    const porMes = {}
    for (let i = 0; i < meses; i++) {
      const d = new Date(ahora.getFullYear(), ahora.getMonth() - (meses - 1 - i), 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      porMes[key] = { mes: key, label: d.toLocaleString('es-AR', { month: 'short', year: '2-digit' }), ingresos: 0, egresos: 0 }
    }

    for (const mov of movimientos) {
      const d = new Date(mov.fecha)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!porMes[key]) continue
      if (mov.tipo === 'INGRESO') porMes[key].ingresos += Number(mov.monto)
      else porMes[key].egresos += Number(mov.monto)
    }

    const data = Object.values(porMes).map(m => ({
      ...m,
      resultado: m.ingresos - m.egresos
    }))

    res.json({ success: true, data })
  } catch (error) {
    console.error('Error obteniendo tendencia mensual:', error)
    res.status(500).json({ success: false, error: 'Error al obtener tendencia mensual' })
  }
})

export default router
