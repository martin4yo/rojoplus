/**
 * Módulo de rutas de Buffet
 *
 * Este archivo combina todos los sub-módulos del buffet.
 * Migración COMPLETA - todos los módulos han sido separados.
 *
 * Estructura de módulos:
 * - config.js         ✅ Cajas, medios de pago, búsqueda de clientes
 * - mesas.js          ✅ Mesas, mozos, asignaciones
 * - productos.js      ✅ Categorías y productos del menú
 * - impresoras.js     ✅ Sectores e impresoras
 * - comandas.js       ✅ Comandas, items, facturación, cobro
 * - takeaway.js       ✅ Pedidos para llevar
 * - kiosco.js         ✅ Ventas rápidas de kiosco
 * - cocina.js         ✅ KDS genérico, cocina, barra
 * - dashboard.js      ✅ KPIs y últimas ventas
 * - tickets.js        ✅ Regenerar tickets, menú público
 * - notificaciones.js ✅ Sistema de notificaciones
 */
import express from 'express'

// Todos los módulos migrados
import configRoutes from './config.js'
import mesasRoutes from './mesas.js'
import productosRoutes from './productos.js'
import impresorasRoutes from './impresoras.js'
import comandasRoutes from './comandas.js'
import takeawayRoutes from './takeaway.js'
import kioscoRoutes from './kiosco.js'
import cocinaRoutes from './cocina.js'
import dashboardRoutes from './dashboard.js'
import ticketsRoutes from './tickets.js'
import notificacionesRoutes from './notificaciones.js'

const router = express.Router()

// Montar todos los módulos
router.use('/', configRoutes)
router.use('/', mesasRoutes)
router.use('/', productosRoutes)
router.use('/', impresorasRoutes)
router.use('/', comandasRoutes)
router.use('/', takeawayRoutes)
router.use('/', kioscoRoutes)
router.use('/', cocinaRoutes)
router.use('/', dashboardRoutes)
router.use('/', ticketsRoutes)
router.use('/', notificacionesRoutes)

export default router

/**
 * Módulos completados:
 *
 * 1. ✅ config.js - Cajas, medios de pago, clientes (~190 líneas)
 * 2. ✅ mesas.js - Mesas, mozos, asignaciones (~380 líneas)
 * 3. ✅ productos.js - CRUD categorías y productos (~390 líneas)
 * 4. ✅ impresoras.js - Sectores e impresoras (~300 líneas)
 * 5. ✅ comandas.js - Comandas, items, facturación, cobro (~950 líneas)
 * 6. ✅ takeaway.js - Pedidos para llevar (~700 líneas)
 * 7. ✅ kiosco.js - Ventas de kiosco (~400 líneas)
 * 8. ✅ cocina.js - KDS genérico, cocina, barra (~450 líneas)
 * 9. ✅ dashboard.js - KPIs y últimas ventas (~180 líneas)
 * 10. ✅ tickets.js - Regenerar tickets, menú público (~200 líneas)
 * 11. ✅ notificaciones.js - Notificaciones del buffet (~150 líneas)
 *
 * Total: ~4,290 líneas distribuidas en 11 módulos + helpers.js
 *
 * Para activar: actualizar server/src/index.js para usar
 * './routes/buffet/index.js' en lugar de './routes/buffet.js'
 */
