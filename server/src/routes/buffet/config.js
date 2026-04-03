/**
 * Rutas de configuración del buffet
 * - Cajas por punto de venta
 * - Medios de pago
 * - Búsqueda de clientes
 */
import express from 'express'
import prisma from '../../lib/prisma.js'
import { authAdmin, checkPermiso } from '../../middleware/auth.js'
import { getCajasPermitidas, applyCajasFilter } from './helpers.js'

const router = express.Router()

// ============================================================================
// CONFIGURACIÓN - Cajas y Medios de Pago por Punto de Venta
// ============================================================================

/**
 * GET /config/cajas/:puntoVenta
 * Obtener cajas disponibles para un punto de venta específico
 */
router.get('/config/cajas/:puntoVenta', authAdmin, checkPermiso('BUFFET_VER', 'BUFFET_KIOSCO', 'BUFFET_COBRAR'), async (req, res) => {
  try {
    const { puntoVenta } = req.params // buffet, kiosco, takeaway

    const where = { activo: true }

    // Filtrar por punto de venta
    switch (puntoVenta) {
      case 'buffet':
        where.paraBuffet = true
        break
      case 'kiosco':
        where.paraKiosco = true
        break
      case 'takeaway':
        where.paraTakeaway = true
        break
    }

    // Filtrar por cajas asignadas al rol del usuario
    // null = super admin (sin filtro), [] = sin acceso, [ids] = acceso limitado
    const cajasPermitidas = await getCajasPermitidas(req.admin.id)
    if (cajasPermitidas !== null) {
      where.id = { in: cajasPermitidas }
    }

    const cajas = await req.db.caja.findMany({
      where,
      orderBy: { nombre: 'asc' },
      select: { id: true, codigo: true, nombre: true, tipo: true, puntoVentaAfip: true, mediosPagoPermitidos: true }
    })

    res.json({ success: true, data: cajas })
  } catch (error) {
    console.error('Error al obtener cajas:', error)
    res.status(500).json({ success: false, error: 'Error al obtener cajas' })
  }
})

/**
 * GET /config/medios-pago/:puntoVenta
 * Obtener medios de pago disponibles para un punto de venta específico
 */
router.get('/config/medios-pago/:puntoVenta', authAdmin, checkPermiso('BUFFET_VER', 'BUFFET_KIOSCO', 'BUFFET_COBRAR'), async (req, res) => {
  try {
    const { puntoVenta } = req.params

    const where = { activo: true }

    switch (puntoVenta) {
      case 'buffet':
        where.paraBuffet = true
        break
      case 'kiosco':
        where.paraKiosco = true
        break
      case 'takeaway':
        where.paraTakeaway = true
        break
    }

    const mediosPago = await req.db.medioPago.findMany({
      where,
      orderBy: { orden: 'asc' },
      select: { id: true, codigo: true, nombre: true, tipo: true, comisionPct: true }
    })

    res.json({ success: true, data: mediosPago })
  } catch (error) {
    console.error('Error al obtener medios de pago:', error)
    res.status(500).json({ success: false, error: 'Error al obtener medios de pago' })
  }
})

// ============================================================================
// CLIENTES - Búsqueda unificada (Socios + Entidades tipo CLIENTE)
// ============================================================================

/**
 * GET /clientes/buscar
 * Buscar clientes para facturación (socios y entidades)
 */
router.get('/clientes/buscar', authAdmin, checkPermiso('BUFFET_COBRAR', 'BUFFET_KIOSCO'), async (req, res) => {
  try {
    const { q } = req.query

    if (!q || q.length < 2) {
      return res.json({ success: true, data: [] })
    }

    const busqueda = q.toLowerCase()

    // Buscar socios
    const socios = await req.db.socio.findMany({
      where: {
        OR: [
          { nroSocio: { contains: busqueda } },
          { nombre: { contains: busqueda, mode: 'insensitive' } },
          { apellido: { contains: busqueda, mode: 'insensitive' } },
          { apellidoNombre: { contains: busqueda, mode: 'insensitive' } },
          { dni: { contains: busqueda } },
          { cuit: { contains: busqueda } }
        ],
        estado: 'ACTIVO'
      },
      take: 10,
      select: {
        id: true,
        nroSocio: true,
        nombre: true,
        apellido: true,
        apellidoNombre: true,
        dni: true,
        cuit: true,
        condicionIva: true,
        domicilio: true,
        email: true
      }
    })

    // Buscar entidades tipo CLIENTE
    const entidades = await prisma.entidad.findMany({
      where: {
        tipo: 'CLIENTE',
        OR: [
          { razonSocial: { contains: busqueda, mode: 'insensitive' } },
          { nombreFantasia: { contains: busqueda, mode: 'insensitive' } },
          { cuit: { contains: busqueda } },
          { codigo: { contains: busqueda, mode: 'insensitive' } }
        ],
        activo: true
      },
      take: 10,
      select: {
        id: true,
        codigo: true,
        razonSocial: true,
        nombreFantasia: true,
        cuit: true,
        condicionIva: true,
        domicilio: true,
        email: true
      }
    })

    // Unificar resultados
    const resultados = [
      ...socios.map(s => ({
        tipo: 'SOCIO',
        id: s.id,
        codigo: s.nroSocio,
        nombre: s.apellidoNombre || `${s.apellido}, ${s.nombre}`,
        documento: s.cuit || s.dni,
        tipoDoc: s.cuit ? 80 : 96, // 80=CUIT, 96=DNI
        condicionIva: s.condicionIva || 5, // 5=Consumidor Final
        domicilio: s.domicilio,
        email: s.email
      })),
      ...entidades.map(e => ({
        tipo: 'ENTIDAD',
        id: e.id,
        codigo: e.codigo,
        nombre: e.razonSocial || e.nombreFantasia,
        documento: e.cuit,
        tipoDoc: e.cuit ? 80 : 99, // 80=CUIT, 99=Sin identificar
        condicionIva: e.condicionIva || 5,
        domicilio: e.domicilio,
        email: e.email
      }))
    ]

    res.json({ success: true, data: resultados })
  } catch (error) {
    console.error('Error buscando clientes:', error)
    res.status(500).json({ success: false, error: 'Error buscando clientes' })
  }
})

// ============================================================================
// OPCIONES DE IMPRESIÓN - Confirmar ticket + Imprimir comanda por POS
// ============================================================================

const CLAVES_OPCIONES_IMPRESION = [
  'BUFFET_CONFIRMAR_TICKET_MESA',
  'BUFFET_CONFIRMAR_TICKET_KIOSCO',
  'BUFFET_CONFIRMAR_TICKET_TAKEAWAY',
  'BUFFET_COMANDA_MESA',
  'BUFFET_COMANDA_KIOSCO',
  'BUFFET_COMANDA_TAKEAWAY',
]

/**
 * GET /config/opciones-impresion
 */
router.get('/config/opciones-impresion', authAdmin, async (req, res) => {
  try {
    const rows = await req.db.configuracion.findMany({
      where: { clave: { in: CLAVES_OPCIONES_IMPRESION } },
      select: { clave: true, valor: true }
    })
    const map = Object.fromEntries(rows.map(r => [r.clave, r.valor === 'true']))
    // Defaults
    const result = {
      confirmarTicketMesa:     map['BUFFET_CONFIRMAR_TICKET_MESA']     ?? false,
      confirmarTicketKiosco:   map['BUFFET_CONFIRMAR_TICKET_KIOSCO']   ?? true,
      confirmarTicketTakeaway: map['BUFFET_CONFIRMAR_TICKET_TAKEAWAY'] ?? false,
      imprimirComandaMesa:     map['BUFFET_COMANDA_MESA']              ?? true,
      imprimirComandaKiosco:   map['BUFFET_COMANDA_KIOSCO']            ?? false,
      imprimirComandaTakeaway: map['BUFFET_COMANDA_TAKEAWAY']          ?? true,
    }
    res.json({ success: true, data: result })
  } catch (error) {
    console.error('Error al obtener opciones de impresión:', error)
    res.status(500).json({ success: false, error: 'Error al obtener opciones de impresión' })
  }
})

/**
 * PUT /config/opciones-impresion
 */
router.put('/config/opciones-impresion', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const {
      confirmarTicketMesa, confirmarTicketKiosco, confirmarTicketTakeaway,
      imprimirComandaMesa, imprimirComandaKiosco, imprimirComandaTakeaway
    } = req.body

    const updates = [
      ['BUFFET_CONFIRMAR_TICKET_MESA',     confirmarTicketMesa],
      ['BUFFET_CONFIRMAR_TICKET_KIOSCO',   confirmarTicketKiosco],
      ['BUFFET_CONFIRMAR_TICKET_TAKEAWAY', confirmarTicketTakeaway],
      ['BUFFET_COMANDA_MESA',              imprimirComandaMesa],
      ['BUFFET_COMANDA_KIOSCO',            imprimirComandaKiosco],
      ['BUFFET_COMANDA_TAKEAWAY',          imprimirComandaTakeaway],
    ]

    for (const [clave, valor] of updates) {
      if (valor === undefined) continue
      const existing = await req.db.configuracion.findFirst({ where: { clave } })
      if (existing) {
        await req.db.configuracion.update({
          where: { id: existing.id },
          data: { valor: String(valor), updatedAt: new Date() }
        })
      } else {
        await req.db.configuracion.create({
          data: {
            clave, valor: String(valor), editable: true,
            modulo: 'BUFFET', tipo: 'BOOLEAN', updatedAt: new Date()
          }
        })
      }
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Error al guardar opciones de impresión:', error)
    res.status(500).json({ success: false, error: 'Error al guardar opciones de impresión' })
  }
})

export default router
