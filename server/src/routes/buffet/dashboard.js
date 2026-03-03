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
    const mesasTotal = await prisma.mesa.count({ where: { activo: true } })
    const mesasOcupadas = await prisma.mesa.count({ where: { activo: true, estado: 'OCUPADA' } })

    // Comandas del día
    const comandasActivas = await prisma.comanda.count({
      where: { estado: { in: ['ABIERTA', 'EN_PREPARACION', 'CUENTA_PEDIDA'] } }
    })

    const comandasCerradas = await prisma.comanda.count({
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
    const ventasBuffet = await prisma.movimientoCaja.aggregate({
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
    const itemsPendientesCocina = await prisma.itemComanda.count({
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
    const comandas = await prisma.comanda.findMany({
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

export default router
