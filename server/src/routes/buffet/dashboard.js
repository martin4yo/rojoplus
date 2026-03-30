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

    // Comandas cerradas en el período
    const comandas = await req.db.comanda.findMany({
      where: {
        estado: 'CERRADA',
        horaCierre: { gte: fechaDesde, lte: fechaHasta }
      },
      include: {
        items: {
          where: { estado: { not: 'ANULADO' } },
          include: { productoBuffet: { select: { id: true, nombre: true } } }
        }
      }
    })

    // Comandas período anterior
    const comandasAnterior = await req.db.comanda.aggregate({
      where: {
        estado: 'CERRADA',
        horaCierre: { gte: fechaDesdeAnterior, lt: fechaHastaAnterior }
      },
      _sum: { total: true },
      _count: true
    })

    // Pedidos TakeAway en el período
    const takeaway = await prisma.pedidoTakeAway.findMany({
      where: {
        estado: { in: ['PAGADO', 'ENTREGADO'] },
        horaPagado: { gte: fechaDesde, lte: fechaHasta }
      },
      include: {
        items: {
          include: { productoBuffet: { select: { id: true, nombre: true } } }
        }
      }
    })

    // Ventas de Kiosco (movimientos de caja)
    const ventasKiosco = await req.db.movimientoCaja.aggregate({
      where: {
        concepto: { startsWith: 'Kiosco' },
        fecha: { gte: fechaDesde, lte: fechaHasta },
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

    // Top productos
    const productosVendidos = {}
    comandas.forEach(c => {
      c.items.forEach(item => {
        const nombre = item.productoBuffet?.nombre || item.nombre || 'Producto'
        if (!productosVendidos[nombre]) {
          productosVendidos[nombre] = { nombre, cantidad: 0, total: 0 }
        }
        productosVendidos[nombre].cantidad += item.cantidad
        productosVendidos[nombre].total += Number(item.subtotal)
      })
    })
    takeaway.forEach(t => {
      t.items.forEach(item => {
        const nombre = item.productoBuffet?.nombre || 'Producto'
        if (!productosVendidos[nombre]) {
          productosVendidos[nombre] = { nombre, cantidad: 0, total: 0 }
        }
        productosVendidos[nombre].cantidad += item.cantidad
        productosVendidos[nombre].total += Number(item.subtotal)
      })
    })
    const topProductos = Object.values(productosVendidos)
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10)

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

    // Comandas cerradas en el período
    const comandas = await req.db.comanda.findMany({
      where: {
        estado: 'CERRADA',
        horaCierre: { gte: fechaDesde, lte: fechaHasta }
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
        horaPagado: { gte: fechaDesde, lte: fechaHasta }
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

export default router
