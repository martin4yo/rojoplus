import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { authAdmin } from '../middleware/auth.js'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'

const router = Router()
const prisma = new PrismaClient()

// Todas las rutas requieren autenticacion de admin
router.use(authAdmin)

// =============================================================================
// HELPERS
// =============================================================================

// Generar numero de movimiento contable
async function generarNumeroMC() {
  const anio = new Date().getFullYear()
  const prefijo = `MC-${anio}-`

  const ultimo = await prisma.movimientoContable.findFirst({
    where: { numero: { startsWith: prefijo } },
    orderBy: { numero: 'desc' }
  })

  let siguiente = 1
  if (ultimo) {
    const partes = ultimo.numero.split('-')
    const ultimoNum = parseInt(partes[partes.length - 1]) || 0
    siguiente = ultimoNum + 1
  }

  return `${prefijo}${String(siguiente).padStart(5, '0')}`
}

// Actualizar stock por items
async function actualizarStockPorItems(tx, items, tipo, movimientoContableId, registradoPor) {
  for (const item of items) {
    if (!item.productoVarianteId) continue

    const variante = await tx.productoVariante.findUnique({
      where: { id: item.productoVarianteId }
    })

    if (!variante) continue

    const stockActual = Number(variante.stockActual)
    const cantidad = Number(item.cantidad)
    let nuevoStock

    // FACTURA_COMPRA = ingreso de stock, FACTURA_VENTA = egreso de stock
    if (['FACTURA_COMPRA', 'NOTA_DEBITO_PROVEEDOR'].includes(tipo)) {
      nuevoStock = stockActual + cantidad
    } else if (['FACTURA_VENTA', 'NOTA_DEBITO_CLIENTE'].includes(tipo)) {
      nuevoStock = stockActual - cantidad
    } else if (['NOTA_CREDITO_PROVEEDOR'].includes(tipo)) {
      nuevoStock = stockActual - cantidad // Devolucion a proveedor
    } else if (['NOTA_CREDITO_CLIENTE'].includes(tipo)) {
      nuevoStock = stockActual + cantidad // Devolucion de cliente
    } else {
      continue // Otros tipos no afectan stock
    }

    // Crear movimiento de stock
    await tx.movimientoStock.create({
      data: {
        productoVarianteId: item.productoVarianteId,
        fecha: new Date(),
        tipo: nuevoStock > stockActual ? 'INGRESO' : 'EGRESO',
        cantidad,
        stockAnterior: stockActual,
        stockPosterior: nuevoStock,
        concepto: `${tipo} - ${movimientoContableId}`,
        movimientoContableId,
        registradoPor
      }
    })

    // Actualizar stock de variante
    await tx.productoVariante.update({
      where: { id: item.productoVarianteId },
      data: { stockActual: nuevoStock }
    })
  }
}

// =============================================================================
// MOVIMIENTOS CONTABLES (CRUD GENERAL)
// =============================================================================

// GET /api/admin/movimientos-contables - Listar con filtros
router.get('/movimientos-contables', asyncHandler(async (req, res) => {
  const {
    tipo, entidadId, socioId, estado, desde, hasta,
    page = 1, limit = 50
  } = req.query

  const where = {}
  if (tipo) where.tipo = tipo
  if (entidadId) where.entidadId = parseInt(entidadId)
  if (socioId) where.socioId = parseInt(socioId)
  if (estado) where.estado = estado

  if (desde || hasta) {
    where.fecha = {}
    if (desde) where.fecha.gte = new Date(desde)
    if (hasta) where.fecha.lte = new Date(hasta)
  }

  const skip = (parseInt(page) - 1) * parseInt(limit)

  const [movimientos, total] = await Promise.all([
    prisma.movimientoContable.findMany({
      where,
      orderBy: { fecha: 'desc' },
      skip,
      take: parseInt(limit),
      include: {
        entidad: { select: { id: true, codigo: true, razonSocial: true, tipo: true } },
        socio: { select: { id: true, nroSocio: true, apellidoNombre: true } },
        concepto: { select: { id: true, codigo: true, nombre: true } },
        caja: { select: { id: true, codigo: true, nombre: true } },
        _count: { select: { items: true } }
      }
    }),
    prisma.movimientoContable.count({ where })
  ])

  const movimientosFormateados = movimientos.map(m => ({
    ...m,
    subtotal: Number(m.subtotal),
    iva21: Number(m.iva21),
    iva105: Number(m.iva105),
    otrosImpuestos: Number(m.otrosImpuestos),
    montoTotal: Number(m.montoTotal),
    montoPagado: Number(m.montoPagado),
    saldoPendiente: Number(m.saldoPendiente)
  }))

  res.json({
    success: true,
    data: movimientosFormateados,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  })
}))

// GET /api/admin/movimientos-contables/:id - Detalle con items
router.get('/movimientos-contables/:id', asyncHandler(async (req, res) => {
  const { id } = req.params

  const movimiento = await prisma.movimientoContable.findUnique({
    where: { id: parseInt(id) },
    include: {
      entidad: true,
      socio: { select: { id: true, nroSocio: true, apellidoNombre: true, email: true } },
      concepto: true,
      caja: true,
      movimientoPadre: { select: { id: true, numero: true, tipo: true } },
      movimientosHijos: { select: { id: true, numero: true, tipo: true, montoTotal: true, fecha: true } },
      items: {
        include: {
          productoVariante: {
            include: {
              producto: { select: { id: true, codigo: true, nombre: true } }
            }
          }
        }
      }
    }
  })

  if (!movimiento) {
    throw new AppError('Movimiento no encontrado', 404)
  }

  res.json({
    success: true,
    data: {
      ...movimiento,
      subtotal: Number(movimiento.subtotal),
      iva21: Number(movimiento.iva21),
      iva105: Number(movimiento.iva105),
      otrosImpuestos: Number(movimiento.otrosImpuestos),
      montoTotal: Number(movimiento.montoTotal),
      montoPagado: Number(movimiento.montoPagado),
      saldoPendiente: Number(movimiento.saldoPendiente),
      items: movimiento.items.map(i => ({
        ...i,
        cantidad: Number(i.cantidad),
        precioUnitario: Number(i.precioUnitario),
        subtotal: Number(i.subtotal)
      })),
      movimientosHijos: movimiento.movimientosHijos.map(h => ({
        ...h,
        montoTotal: Number(h.montoTotal)
      }))
    }
  })
}))

// POST /api/admin/movimientos-contables - Crear movimiento
router.post('/movimientos-contables', asyncHandler(async (req, res) => {
  const {
    tipo, entidadId, socioId, fecha, fechaVencimiento,
    tipoComprobante, puntoVenta, numeroComprobante,
    subtotal, iva21, iva105, otrosImpuestos, montoTotal,
    cajaId, medioPago, nroOperacion,
    movimientoPadreId, conceptoId, observaciones,
    items
  } = req.body

  // Validaciones basicas
  if (!tipo || !montoTotal) {
    throw new AppError('Tipo y monto total son requeridos', 400)
  }

  const tiposValidos = [
    'FACTURA_COMPRA', 'FACTURA_VENTA',
    'NOTA_CREDITO_PROVEEDOR', 'NOTA_CREDITO_CLIENTE',
    'NOTA_DEBITO_PROVEEDOR', 'NOTA_DEBITO_CLIENTE',
    'ORDEN_PAGO', 'PAGO', 'RECIBO_COBRO'
  ]
  if (!tiposValidos.includes(tipo)) {
    throw new AppError(`Tipo invalido. Debe ser uno de: ${tiposValidos.join(', ')}`, 400)
  }

  // Validar que tenga entidad o socio segun el tipo
  const tiposConEntidad = ['FACTURA_COMPRA', 'NOTA_CREDITO_PROVEEDOR', 'NOTA_DEBITO_PROVEEDOR', 'ORDEN_PAGO', 'PAGO']
  const tiposConSocioOCliente = ['FACTURA_VENTA', 'NOTA_CREDITO_CLIENTE', 'NOTA_DEBITO_CLIENTE', 'RECIBO_COBRO']

  if (tiposConEntidad.includes(tipo) && !entidadId) {
    throw new AppError('Se requiere una entidad (proveedor) para este tipo de movimiento', 400)
  }

  if (tiposConSocioOCliente.includes(tipo) && !entidadId && !socioId) {
    throw new AppError('Se requiere un socio o cliente para este tipo de movimiento', 400)
  }

  // Validar entidad si se proporciona
  if (entidadId) {
    const entidad = await prisma.entidad.findUnique({ where: { id: parseInt(entidadId) } })
    if (!entidad) {
      throw new AppError('Entidad no encontrada', 404)
    }
  }

  // Validar socio si se proporciona
  if (socioId) {
    const socio = await prisma.socio.findUnique({ where: { id: parseInt(socioId) } })
    if (!socio) {
      throw new AppError('Socio no encontrado', 404)
    }
  }

  // Validar caja para pagos/cobros
  const tiposConCaja = ['PAGO', 'RECIBO_COBRO', 'ORDEN_PAGO']
  if (tiposConCaja.includes(tipo)) {
    if (!cajaId) {
      throw new AppError('Se requiere una caja para pagos y cobros', 400)
    }
    const caja = await prisma.caja.findUnique({ where: { id: parseInt(cajaId) } })
    if (!caja) {
      throw new AppError('Caja no encontrada', 404)
    }
    if (!caja.activo) {
      throw new AppError('La caja no esta activa', 400)
    }
  }

  // Calcular montos
  const subtotalNum = parseFloat(subtotal) || 0
  const iva21Num = parseFloat(iva21) || 0
  const iva105Num = parseFloat(iva105) || 0
  const otrosImpuestosNum = parseFloat(otrosImpuestos) || 0
  const montoTotalNum = parseFloat(montoTotal)

  // Determinar estado inicial y saldo pendiente
  const tiposConSaldo = ['FACTURA_COMPRA', 'FACTURA_VENTA', 'NOTA_DEBITO_PROVEEDOR', 'NOTA_DEBITO_CLIENTE']
  const estadoInicial = tiposConSaldo.includes(tipo) ? 'PENDIENTE' : 'CONFIRMADO'
  const saldoPendienteInicial = tiposConSaldo.includes(tipo) ? montoTotalNum : 0

  // Crear movimiento con items en transaccion
  const resultado = await prisma.$transaction(async (tx) => {
    const numero = await generarNumeroMC()

    const movimiento = await tx.movimientoContable.create({
      data: {
        numero,
        tipo,
        entidadId: entidadId ? parseInt(entidadId) : null,
        socioId: socioId ? parseInt(socioId) : null,
        fecha: fecha ? new Date(fecha) : new Date(),
        fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
        tipoComprobante,
        puntoVenta,
        numeroComprobante,
        subtotal: subtotalNum,
        iva21: iva21Num,
        iva105: iva105Num,
        otrosImpuestos: otrosImpuestosNum,
        montoTotal: montoTotalNum,
        montoPagado: 0,
        saldoPendiente: saldoPendienteInicial,
        cajaId: cajaId ? parseInt(cajaId) : null,
        medioPago,
        nroOperacion,
        movimientoPadreId: movimientoPadreId ? parseInt(movimientoPadreId) : null,
        conceptoId: conceptoId ? parseInt(conceptoId) : null,
        observaciones,
        estado: estadoInicial,
        registradoPor: req.admin.id,
        items: items?.length ? {
          create: items.map(item => ({
            productoVarianteId: item.productoVarianteId ? parseInt(item.productoVarianteId) : null,
            descripcion: item.descripcion,
            cantidad: parseFloat(item.cantidad),
            precioUnitario: parseFloat(item.precioUnitario),
            subtotal: parseFloat(item.cantidad) * parseFloat(item.precioUnitario)
          }))
        } : undefined
      },
      include: {
        entidad: { select: { id: true, codigo: true, razonSocial: true } },
        socio: { select: { id: true, nroSocio: true, apellidoNombre: true } },
        concepto: true,
        caja: true,
        items: true
      }
    })

    // Actualizar stock si hay items con productos
    if (items?.length) {
      await actualizarStockPorItems(tx, movimiento.items, tipo, movimiento.id, req.admin.id)
    }

    // Si es pago/cobro, crear movimiento de caja y actualizar factura padre
    if (tiposConCaja.includes(tipo) && cajaId) {
      const tipoMovCaja = tipo === 'RECIBO_COBRO' ? 'INGRESO' : 'EGRESO'

      // Generar numero de movimiento caja
      const anio = new Date().getFullYear()
      const prefijoMV = `MV-${anio}-`
      const ultimoMV = await tx.movimientoCaja.findFirst({
        where: { numero: { startsWith: prefijoMV } },
        orderBy: { numero: 'desc' }
      })
      let siguienteMV = 1
      if (ultimoMV) {
        const partesMV = ultimoMV.numero.split('-')
        siguienteMV = (parseInt(partesMV[partesMV.length - 1]) || 0) + 1
      }
      const numeroMV = `${prefijoMV}${String(siguienteMV).padStart(5, '0')}`

      await tx.movimientoCaja.create({
        data: {
          numero: numeroMV,
          cajaId: parseInt(cajaId),
          fecha: new Date(),
          tipo: tipoMovCaja,
          monto: montoTotalNum,
          conceptoId: conceptoId ? parseInt(conceptoId) : null,
          descripcion: `${tipo} - ${numero}`,
          movimientoContableId: movimiento.id,
          registradoPor: req.admin.id
        }
      })

      // Actualizar saldo de caja
      const incremento = tipoMovCaja === 'INGRESO' ? montoTotalNum : -montoTotalNum
      await tx.caja.update({
        where: { id: parseInt(cajaId) },
        data: { saldoActual: { increment: incremento } }
      })

      // Si tiene factura padre, actualizar su saldo
      if (movimientoPadreId) {
        const padre = await tx.movimientoContable.findUnique({
          where: { id: parseInt(movimientoPadreId) }
        })

        if (padre) {
          const nuevoMontoPagado = Number(padre.montoPagado) + montoTotalNum
          const nuevoSaldoPendiente = Number(padre.montoTotal) - nuevoMontoPagado
          const nuevoEstado = nuevoSaldoPendiente <= 0 ? 'PAGADO' : 'PENDIENTE'

          await tx.movimientoContable.update({
            where: { id: parseInt(movimientoPadreId) },
            data: {
              montoPagado: nuevoMontoPagado,
              saldoPendiente: Math.max(0, nuevoSaldoPendiente),
              estado: nuevoEstado
            }
          })
        }
      }
    }

    return movimiento
  })

  res.status(201).json({
    success: true,
    data: {
      ...resultado,
      subtotal: Number(resultado.subtotal),
      iva21: Number(resultado.iva21),
      iva105: Number(resultado.iva105),
      otrosImpuestos: Number(resultado.otrosImpuestos),
      montoTotal: Number(resultado.montoTotal),
      montoPagado: Number(resultado.montoPagado),
      saldoPendiente: Number(resultado.saldoPendiente),
      items: resultado.items.map(i => ({
        ...i,
        cantidad: Number(i.cantidad),
        precioUnitario: Number(i.precioUnitario),
        subtotal: Number(i.subtotal)
      }))
    }
  })
}))

// POST /api/admin/movimientos-contables/:id/anular - Anular movimiento
router.post('/movimientos-contables/:id/anular', asyncHandler(async (req, res) => {
  const { id } = req.params

  const movimiento = await prisma.movimientoContable.findUnique({
    where: { id: parseInt(id) },
    include: {
      items: true,
      movimientosHijos: true,
      movimientosCaja: true
    }
  })

  if (!movimiento) {
    throw new AppError('Movimiento no encontrado', 404)
  }

  if (movimiento.estado === 'ANULADO') {
    throw new AppError('El movimiento ya esta anulado', 400)
  }

  // No permitir anular si tiene pagos asociados
  if (movimiento.movimientosHijos.length > 0) {
    throw new AppError('No se puede anular un movimiento con pagos/cobros asociados', 400)
  }

  await prisma.$transaction(async (tx) => {
    // Revertir stock si tenia items con productos
    if (movimiento.items.length > 0) {
      for (const item of movimiento.items) {
        if (!item.productoVarianteId) continue

        const variante = await tx.productoVariante.findUnique({
          where: { id: item.productoVarianteId }
        })

        if (!variante) continue

        const stockActual = Number(variante.stockActual)
        const cantidad = Number(item.cantidad)
        let nuevoStock

        // Revertir: compras restan, ventas suman
        if (['FACTURA_COMPRA', 'NOTA_DEBITO_PROVEEDOR'].includes(movimiento.tipo)) {
          nuevoStock = stockActual - cantidad
        } else if (['FACTURA_VENTA', 'NOTA_DEBITO_CLIENTE'].includes(movimiento.tipo)) {
          nuevoStock = stockActual + cantidad
        } else if (['NOTA_CREDITO_PROVEEDOR'].includes(movimiento.tipo)) {
          nuevoStock = stockActual + cantidad
        } else if (['NOTA_CREDITO_CLIENTE'].includes(movimiento.tipo)) {
          nuevoStock = stockActual - cantidad
        } else {
          continue
        }

        await tx.movimientoStock.create({
          data: {
            productoVarianteId: item.productoVarianteId,
            fecha: new Date(),
            tipo: 'AJUSTE',
            cantidad,
            stockAnterior: stockActual,
            stockPosterior: nuevoStock,
            concepto: `Anulacion ${movimiento.numero}`,
            registradoPor: req.admin.id
          }
        })

        await tx.productoVariante.update({
          where: { id: item.productoVarianteId },
          data: { stockActual: nuevoStock }
        })
      }
    }

    // Revertir movimientos de caja
    for (const movCaja of movimiento.movimientosCaja) {
      if (movCaja.anulado) continue

      const incremento = movCaja.tipo === 'INGRESO'
        ? -Number(movCaja.monto)
        : Number(movCaja.monto)

      await tx.caja.update({
        where: { id: movCaja.cajaId },
        data: { saldoActual: { increment: incremento } }
      })

      await tx.movimientoCaja.update({
        where: { id: movCaja.id },
        data: { anulado: true }
      })
    }

    // Revertir saldo de factura padre si existe
    if (movimiento.movimientoPadreId) {
      const padre = await tx.movimientoContable.findUnique({
        where: { id: movimiento.movimientoPadreId }
      })

      if (padre) {
        const nuevoMontoPagado = Math.max(0, Number(padre.montoPagado) - Number(movimiento.montoTotal))
        const nuevoSaldoPendiente = Number(padre.montoTotal) - nuevoMontoPagado

        await tx.movimientoContable.update({
          where: { id: movimiento.movimientoPadreId },
          data: {
            montoPagado: nuevoMontoPagado,
            saldoPendiente: nuevoSaldoPendiente,
            estado: nuevoSaldoPendiente > 0 ? 'PENDIENTE' : 'PAGADO'
          }
        })
      }
    }

    // Marcar como anulado
    await tx.movimientoContable.update({
      where: { id: parseInt(id) },
      data: { estado: 'ANULADO' }
    })
  })

  res.json({ success: true, message: 'Movimiento anulado correctamente' })
}))

// =============================================================================
// CONSULTAS ESPECIFICAS
// =============================================================================

// GET /api/admin/movimientos-contables/pendientes - Facturas pendientes de pago/cobro
router.get('/movimientos-contables/pendientes', asyncHandler(async (req, res) => {
  const { entidadId, socioId, tipo } = req.query

  const where = {
    estado: 'PENDIENTE',
    saldoPendiente: { gt: 0 }
  }

  if (entidadId) where.entidadId = parseInt(entidadId)
  if (socioId) where.socioId = parseInt(socioId)
  if (tipo) {
    where.tipo = tipo
  } else {
    where.tipo = { in: ['FACTURA_COMPRA', 'FACTURA_VENTA', 'NOTA_DEBITO_PROVEEDOR', 'NOTA_DEBITO_CLIENTE'] }
  }

  const movimientos = await prisma.movimientoContable.findMany({
    where,
    orderBy: [{ fechaVencimiento: 'asc' }, { fecha: 'asc' }],
    include: {
      entidad: { select: { id: true, codigo: true, razonSocial: true } },
      socio: { select: { id: true, nroSocio: true, apellidoNombre: true } },
      concepto: { select: { id: true, nombre: true } }
    }
  })

  res.json({
    success: true,
    data: movimientos.map(m => ({
      ...m,
      montoTotal: Number(m.montoTotal),
      montoPagado: Number(m.montoPagado),
      saldoPendiente: Number(m.saldoPendiente)
    }))
  })
}))

// GET /api/admin/facturas-compra - Alias para facturas de compra
router.get('/facturas-compra', asyncHandler(async (req, res) => {
  const { entidadId, estado, desde, hasta, page = 1, limit = 50 } = req.query

  const where = {
    tipo: { in: ['FACTURA_COMPRA', 'NOTA_CREDITO_PROVEEDOR', 'NOTA_DEBITO_PROVEEDOR'] }
  }
  if (entidadId) where.entidadId = parseInt(entidadId)
  if (estado) where.estado = estado

  if (desde || hasta) {
    where.fecha = {}
    if (desde) where.fecha.gte = new Date(desde)
    if (hasta) where.fecha.lte = new Date(hasta)
  }

  const skip = (parseInt(page) - 1) * parseInt(limit)

  const [movimientos, total] = await Promise.all([
    prisma.movimientoContable.findMany({
      where,
      orderBy: { fecha: 'desc' },
      skip,
      take: parseInt(limit),
      include: {
        entidad: { select: { id: true, codigo: true, razonSocial: true } },
        concepto: { select: { id: true, nombre: true } },
        _count: { select: { items: true, movimientosHijos: true } }
      }
    }),
    prisma.movimientoContable.count({ where })
  ])

  res.json({
    success: true,
    data: movimientos.map(m => ({
      ...m,
      montoTotal: Number(m.montoTotal),
      montoPagado: Number(m.montoPagado),
      saldoPendiente: Number(m.saldoPendiente)
    })),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  })
}))

// GET /api/admin/facturas-venta - Alias para facturas de venta
router.get('/facturas-venta', asyncHandler(async (req, res) => {
  const { entidadId, socioId, estado, desde, hasta, page = 1, limit = 50 } = req.query

  const where = {
    tipo: { in: ['FACTURA_VENTA', 'NOTA_CREDITO_CLIENTE', 'NOTA_DEBITO_CLIENTE'] }
  }
  if (entidadId) where.entidadId = parseInt(entidadId)
  if (socioId) where.socioId = parseInt(socioId)
  if (estado) where.estado = estado

  if (desde || hasta) {
    where.fecha = {}
    if (desde) where.fecha.gte = new Date(desde)
    if (hasta) where.fecha.lte = new Date(hasta)
  }

  const skip = (parseInt(page) - 1) * parseInt(limit)

  const [movimientos, total] = await Promise.all([
    prisma.movimientoContable.findMany({
      where,
      orderBy: { fecha: 'desc' },
      skip,
      take: parseInt(limit),
      include: {
        entidad: { select: { id: true, codigo: true, razonSocial: true } },
        socio: { select: { id: true, nroSocio: true, apellidoNombre: true } },
        concepto: { select: { id: true, nombre: true } },
        _count: { select: { items: true, movimientosHijos: true } }
      }
    }),
    prisma.movimientoContable.count({ where })
  ])

  res.json({
    success: true,
    data: movimientos.map(m => ({
      ...m,
      montoTotal: Number(m.montoTotal),
      montoPagado: Number(m.montoPagado),
      saldoPendiente: Number(m.saldoPendiente)
    })),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  })
}))

// GET /api/admin/ordenes-pago - Ordenes de pago
router.get('/ordenes-pago', asyncHandler(async (req, res) => {
  const { entidadId, desde, hasta, page = 1, limit = 50 } = req.query

  const where = { tipo: 'ORDEN_PAGO' }
  if (entidadId) where.entidadId = parseInt(entidadId)

  if (desde || hasta) {
    where.fecha = {}
    if (desde) where.fecha.gte = new Date(desde)
    if (hasta) where.fecha.lte = new Date(hasta)
  }

  const skip = (parseInt(page) - 1) * parseInt(limit)

  const [movimientos, total] = await Promise.all([
    prisma.movimientoContable.findMany({
      where,
      orderBy: { fecha: 'desc' },
      skip,
      take: parseInt(limit),
      include: {
        entidad: { select: { id: true, codigo: true, razonSocial: true } },
        caja: { select: { id: true, nombre: true } },
        movimientoPadre: { select: { id: true, numero: true } }
      }
    }),
    prisma.movimientoContable.count({ where })
  ])

  res.json({
    success: true,
    data: movimientos.map(m => ({
      ...m,
      montoTotal: Number(m.montoTotal)
    })),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  })
}))

// GET /api/admin/recibos-cobro - Recibos de cobro
router.get('/recibos-cobro', asyncHandler(async (req, res) => {
  const { entidadId, socioId, desde, hasta, page = 1, limit = 50 } = req.query

  const where = { tipo: 'RECIBO_COBRO' }
  if (entidadId) where.entidadId = parseInt(entidadId)
  if (socioId) where.socioId = parseInt(socioId)

  if (desde || hasta) {
    where.fecha = {}
    if (desde) where.fecha.gte = new Date(desde)
    if (hasta) where.fecha.lte = new Date(hasta)
  }

  const skip = (parseInt(page) - 1) * parseInt(limit)

  const [movimientos, total] = await Promise.all([
    prisma.movimientoContable.findMany({
      where,
      orderBy: { fecha: 'desc' },
      skip,
      take: parseInt(limit),
      include: {
        entidad: { select: { id: true, codigo: true, razonSocial: true } },
        socio: { select: { id: true, nroSocio: true, apellidoNombre: true } },
        caja: { select: { id: true, nombre: true } },
        movimientoPadre: { select: { id: true, numero: true } }
      }
    }),
    prisma.movimientoContable.count({ where })
  ])

  res.json({
    success: true,
    data: movimientos.map(m => ({
      ...m,
      montoTotal: Number(m.montoTotal)
    })),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  })
}))

export default router
