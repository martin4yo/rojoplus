import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { authAdmin } from '../middleware/auth.js'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { generarAsientoMovimientoCaja } from '../services/asientosContables.js'

const router = Router()

// Todas las rutas requieren autenticacion de admin
router.use(authAdmin)

// =============================================================================
// CAJAS
// =============================================================================

// GET /api/admin/cajas - Listar cajas (filtradas por rol del usuario)
router.get('/cajas', asyncHandler(async (req, res) => {
  const { activo } = req.query

  const where = {}
  if (activo !== undefined) where.activo = activo === 'true'

  // Filtrar por cajas asignadas al rol del usuario (si no es super admin)
  const admin = await prisma.admin.findUnique({
    where: { id: req.admin.id },
    include: {
      rol: {
        include: {
          cajas: { select: { cajaId: true } }
        }
      }
    }
  })

  // Si el usuario tiene rol y no es super admin, filtrar por cajas asignadas
  if (admin?.rol && !admin.rol.esSuperAdmin && admin.rol.cajas?.length > 0) {
    const cajasPermitidas = admin.rol.cajas.map(cr => cr.cajaId)
    where.id = { in: cajasPermitidas }
  }

  const cajas = await prisma.caja.findMany({
    where,
    include: { centroCosto: true },
    orderBy: { nombre: 'asc' }
  })

  // Calcular saldo real desde movimientos para cada caja
  const cajasConSaldo = await Promise.all(cajas.map(async (caja) => {
    // Sumar ingresos
    const ingresos = await prisma.movimientoCaja.aggregate({
      where: { cajaId: caja.id, tipo: 'INGRESO', anulado: false },
      _sum: { monto: true }
    })
    // Sumar egresos
    const egresos = await prisma.movimientoCaja.aggregate({
      where: { cajaId: caja.id, tipo: 'EGRESO', anulado: false },
      _sum: { monto: true }
    })

    const saldoCalculado = (Number(ingresos._sum.monto) || 0) - (Number(egresos._sum.monto) || 0)

    return {
      ...caja,
      saldoActual: saldoCalculado
    }
  }))

  res.json({ success: true, data: cajasConSaldo })
}))

// GET /api/admin/cajas/:id - Detalle de caja
router.get('/cajas/:id', asyncHandler(async (req, res) => {
  const { id } = req.params

  // Verificar acceso del usuario a esta caja
  const admin = await prisma.admin.findUnique({
    where: { id: req.admin.id },
    include: {
      rol: {
        include: {
          cajas: { select: { cajaId: true } }
        }
      }
    }
  })

  // Si no es super admin y tiene cajas asignadas, verificar acceso
  if (admin?.rol && !admin.rol.esSuperAdmin && admin.rol.cajas?.length > 0) {
    const cajasPermitidas = admin.rol.cajas.map(cr => cr.cajaId)
    if (!cajasPermitidas.includes(parseInt(id))) {
      throw new AppError('No tenés acceso a esta caja', 403)
    }
  }

  const caja = await prisma.caja.findUnique({
    where: { id: parseInt(id) }
  })

  if (!caja) {
    throw new AppError('Caja no encontrada', 404)
  }

  // Calcular saldo real desde movimientos
  const ingresos = await prisma.movimientoCaja.aggregate({
    where: { cajaId: caja.id, tipo: 'INGRESO', anulado: false },
    _sum: { monto: true }
  })
  const egresos = await prisma.movimientoCaja.aggregate({
    where: { cajaId: caja.id, tipo: 'EGRESO', anulado: false },
    _sum: { monto: true }
  })

  const saldoCalculado = (Number(ingresos._sum.monto) || 0) - (Number(egresos._sum.monto) || 0)

  res.json({
    success: true,
    data: {
      ...caja,
      saldoActual: saldoCalculado
    }
  })
}))

// POST /api/admin/cajas - Crear caja
router.post('/cajas', asyncHandler(async (req, res) => {
  const {
    codigo, nombre, tipo, descripcion, saldoInicial, cuentaContableId, centroCostoId,
    requiereConciliacion, mediosPagoPermitidos,
    puntoVentaAfip, paraBuffet, paraKiosco, paraTakeaway, paraCaja
  } = req.body

  if (!codigo || !nombre || !tipo) {
    throw new AppError('Codigo, nombre y tipo son requeridos', 400)
  }

  if (!['EFECTIVO', 'BANCO', 'MERCADOPAGO', 'VALORES_PENDIENTES', 'OTRO'].includes(tipo)) {
    throw new AppError('Tipo debe ser EFECTIVO, BANCO, MERCADOPAGO, VALORES_PENDIENTES u OTRO', 400)
  }

  const existente = await prisma.caja.findUnique({ where: { codigo } })
  if (existente) {
    throw new AppError('Ya existe una caja con ese codigo', 400)
  }

  const caja = await prisma.caja.create({
    data: {
      codigo,
      nombre,
      tipo,
      descripcion,
      saldoActual: saldoInicial ? parseFloat(saldoInicial) : 0,
      requiereConciliacion: requiereConciliacion === true,
      mediosPagoPermitidos: mediosPagoPermitidos || [],
      puntoVentaAfip: puntoVentaAfip ? parseInt(puntoVentaAfip) : null,
      paraBuffet: paraBuffet !== undefined ? paraBuffet : true,
      paraKiosco: paraKiosco !== undefined ? paraKiosco : true,
      paraTakeaway: paraTakeaway !== undefined ? paraTakeaway : true,
      paraCaja: paraCaja !== undefined ? paraCaja : true,
      ...(cuentaContableId && {
        cuentaContable: { connect: { id: parseInt(cuentaContableId) } }
      }),
      ...(centroCostoId && {
        centroCosto: { connect: { id: parseInt(centroCostoId) } }
      })
    }
  })

  res.status(201).json({
    success: true,
    data: { ...caja, saldoActual: Number(caja.saldoActual) }
  })
}))

// PUT /api/admin/cajas/:id - Actualizar caja
router.put('/cajas/:id', asyncHandler(async (req, res) => {
  const { id } = req.params
  const {
    codigo, nombre, tipo, descripcion, activo, cuentaContableId, centroCostoId,
    requiereConciliacion, mediosPagoPermitidos,
    puntoVentaAfip, paraBuffet, paraKiosco, paraTakeaway, paraCaja
  } = req.body

  const existente = await prisma.caja.findUnique({ where: { id: parseInt(id) } })
  if (!existente) {
    throw new AppError('Caja no encontrada', 404)
  }

  // Verificar codigo unico si cambio
  if (codigo && codigo !== existente.codigo) {
    const duplicado = await prisma.caja.findUnique({ where: { codigo } })
    if (duplicado) {
      throw new AppError('Ya existe una caja con ese codigo', 400)
    }
  }

  // Preparar datos de actualización
  const updateData = {
    codigo: codigo || existente.codigo,
    nombre: nombre || existente.nombre,
    tipo: tipo || existente.tipo,
    descripcion: descripcion !== undefined ? descripcion : existente.descripcion,
    activo: activo !== undefined ? activo : existente.activo,
    requiereConciliacion: requiereConciliacion !== undefined ? requiereConciliacion : existente.requiereConciliacion,
    mediosPagoPermitidos: mediosPagoPermitidos !== undefined ? mediosPagoPermitidos : existente.mediosPagoPermitidos,
    puntoVentaAfip: puntoVentaAfip !== undefined ? (puntoVentaAfip ? parseInt(puntoVentaAfip) : null) : existente.puntoVentaAfip,
    paraBuffet: paraBuffet !== undefined ? paraBuffet : existente.paraBuffet,
    paraKiosco: paraKiosco !== undefined ? paraKiosco : existente.paraKiosco,
    paraTakeaway: paraTakeaway !== undefined ? paraTakeaway : existente.paraTakeaway,
    paraCaja: paraCaja !== undefined ? paraCaja : existente.paraCaja
  }

  // Manejar la relación con cuenta contable
  if (cuentaContableId !== undefined) {
    if (cuentaContableId) {
      updateData.cuentaContable = { connect: { id: parseInt(cuentaContableId) } }
    } else {
      updateData.cuentaContable = { disconnect: true }
    }
  }

  // Manejar la relación con centro de costo
  if (centroCostoId !== undefined) {
    if (centroCostoId) {
      updateData.centroCosto = { connect: { id: parseInt(centroCostoId) } }
    } else {
      updateData.centroCosto = { disconnect: true }
    }
  }

  const caja = await prisma.caja.update({
    where: { id: parseInt(id) },
    data: updateData
  })

  res.json({
    success: true,
    data: { ...caja, saldoActual: Number(caja.saldoActual) }
  })
}))

// =============================================================================
// MOVIMIENTOS DE CAJA
// =============================================================================

// Generar numero de movimiento
async function generarNumeroMovimiento() {
  const anio = new Date().getFullYear()
  const prefijo = `MV-${anio}-`

  const ultimo = await prisma.movimientoCaja.findFirst({
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

// GET /api/admin/movimientos-caja - Listar movimientos
router.get('/movimientos-caja', asyncHandler(async (req, res) => {
  const { cajaId, tipo, desde, hasta, page = 1, limit = 50 } = req.query

  // Obtener cajas permitidas según rol del usuario
  const admin = await prisma.admin.findUnique({
    where: { id: req.admin.id },
    include: {
      rol: {
        include: {
          cajas: { select: { cajaId: true } }
        }
      }
    }
  })

  const where = {}

  // Filtrar por cajas asignadas al rol (si no es super admin)
  if (admin?.rol && !admin.rol.esSuperAdmin && admin.rol.cajas?.length > 0) {
    const cajasPermitidas = admin.rol.cajas.map(cr => cr.cajaId)
    where.cajaId = { in: cajasPermitidas }

    // Si pide una caja específica, verificar que tenga acceso
    if (cajaId && !cajasPermitidas.includes(parseInt(cajaId))) {
      throw new AppError('No tenés acceso a esta caja', 403)
    }
  }

  if (cajaId) where.cajaId = parseInt(cajaId)
  if (tipo) where.tipo = tipo

  if (desde || hasta) {
    where.fecha = {}
    if (desde) where.fecha.gte = new Date(desde)
    if (hasta) where.fecha.lte = new Date(hasta)
  }

  const skip = (parseInt(page) - 1) * parseInt(limit)

  const [movimientos, total] = await Promise.all([
    prisma.movimientoCaja.findMany({
      where,
      orderBy: { fecha: 'desc' },
      skip,
      take: parseInt(limit),
      include: {
        caja: { select: { id: true, codigo: true, nombre: true } },
        cuentaContable: { select: { id: true, codigo: true, nombre: true } },
        pago: {
          select: {
            id: true,
            socio: { select: { id: true, nroSocio: true, apellidoNombre: true } }
          }
        }
      }
    }),
    prisma.movimientoCaja.count({ where })
  ])

  const movimientosFormateados = movimientos.map(m => ({
    ...m,
    monto: Number(m.monto)
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

// GET /api/admin/movimientos-caja/:id - Detalle
router.get('/movimientos-caja/:id', asyncHandler(async (req, res) => {
  const { id } = req.params

  const movimiento = await prisma.movimientoCaja.findUnique({
    where: { id: parseInt(id) },
    include: {
      caja: true,
      cuentaContable: true,
      pago: {
        include: {
          socio: { select: { id: true, nroSocio: true, apellidoNombre: true } }
        }
      }
    }
  })

  if (!movimiento) {
    throw new AppError('Movimiento no encontrado', 404)
  }

  // Verificar acceso del usuario a la caja del movimiento
  const admin = await prisma.admin.findUnique({
    where: { id: req.admin.id },
    include: {
      rol: {
        include: {
          cajas: { select: { cajaId: true } }
        }
      }
    }
  })

  if (admin?.rol && !admin.rol.esSuperAdmin && admin.rol.cajas?.length > 0) {
    const cajasPermitidas = admin.rol.cajas.map(cr => cr.cajaId)
    if (!cajasPermitidas.includes(movimiento.cajaId)) {
      throw new AppError('No tenés acceso a este movimiento', 403)
    }
  }

  res.json({
    success: true,
    data: { ...movimiento, monto: Number(movimiento.monto) }
  })
}))

// POST /api/admin/movimientos-caja - Crear movimiento manual
router.post('/movimientos-caja', asyncHandler(async (req, res) => {
  const { cajaId, tipo, monto, cuentaContableId, concepto, descripcion, centroCostoId } = req.body

  if (!cajaId || !tipo || !monto || !cuentaContableId) {
    throw new AppError('Caja, tipo, monto y cuenta contable son requeridos', 400)
  }

  if (!['INGRESO', 'EGRESO'].includes(tipo)) {
    throw new AppError('Tipo debe ser INGRESO o EGRESO', 400)
  }

  const caja = await prisma.caja.findUnique({
    where: { id: parseInt(cajaId) },
    include: { cuentaContable: true }
  })
  if (!caja) {
    throw new AppError('Caja no encontrada', 404)
  }

  if (!caja.activo) {
    throw new AppError('La caja no esta activa', 400)
  }

  // Verificar acceso del usuario a esta caja
  const admin = await prisma.admin.findUnique({
    where: { id: req.admin.id },
    include: {
      rol: {
        include: {
          cajas: { select: { cajaId: true } }
        }
      }
    }
  })

  if (admin?.rol && !admin.rol.esSuperAdmin && admin.rol.cajas?.length > 0) {
    const cajasPermitidas = admin.rol.cajas.map(cr => cr.cajaId)
    if (!cajasPermitidas.includes(parseInt(cajaId))) {
      throw new AppError('No tenés acceso a esta caja', 403)
    }
  }

  // Cargar cuenta contable
  const cuentaContable = await prisma.cuentaContable.findUnique({
    where: { id: parseInt(cuentaContableId) }
  })
  if (!cuentaContable) {
    throw new AppError('Cuenta contable no encontrada', 404)
  }

  // Verificar saldo suficiente para egresos
  const montoNum = parseFloat(monto)
  if (tipo === 'EGRESO' && Number(caja.saldoActual) < montoNum) {
    throw new AppError('Saldo insuficiente en la caja', 400)
  }

  // Crear movimiento y actualizar saldo en transaccion
  const resultado = await prisma.$transaction(async (tx) => {
    const numero = await generarNumeroMovimiento()

    const movimiento = await tx.movimientoCaja.create({
      data: {
        numero,
        cajaId: parseInt(cajaId),
        fecha: new Date(),
        tipo,
        monto: montoNum,
        cuentaContableId: parseInt(cuentaContableId),
        centroCostoId: centroCostoId ? parseInt(centroCostoId) : null,
        concepto: concepto || cuentaContable.nombre,
        descripcion: descripcion || null,
        registradoPor: req.admin.id
      },
      include: {
        caja: { select: { id: true, codigo: true, nombre: true } },
        cuentaContable: { select: { id: true, codigo: true, nombre: true } }
      }
    })

    // Actualizar saldo de caja
    const incremento = tipo === 'INGRESO' ? montoNum : -montoNum
    await tx.caja.update({
      where: { id: parseInt(cajaId) },
      data: { saldoActual: { increment: incremento } }
    })

    return movimiento
  })

  // Generar asiento contable automático (fuera de transacción)
  generarAsientoMovimientoCaja(prisma, {
    movimiento: resultado,
    caja,
    cuentaContable,
    registradoPor: req.admin.id,
  }).catch(err => {
    console.error('Error generando asiento contable para movimiento caja:', err)
  })

  res.status(201).json({
    success: true,
    data: { ...resultado, monto: Number(resultado.monto) }
  })
}))

// POST /api/admin/movimientos-caja/:id/anular - Anular movimiento
router.post('/movimientos-caja/:id/anular', asyncHandler(async (req, res) => {
  const { id } = req.params

  const movimiento = await prisma.movimientoCaja.findUnique({
    where: { id: parseInt(id) },
    include: { caja: true }
  })

  if (!movimiento) {
    throw new AppError('Movimiento no encontrado', 404)
  }

  // Verificar acceso del usuario a la caja del movimiento
  const admin = await prisma.admin.findUnique({
    where: { id: req.admin.id },
    include: {
      rol: {
        include: {
          cajas: { select: { cajaId: true } }
        }
      }
    }
  })

  if (admin?.rol && !admin.rol.esSuperAdmin && admin.rol.cajas?.length > 0) {
    const cajasPermitidas = admin.rol.cajas.map(cr => cr.cajaId)
    if (!cajasPermitidas.includes(movimiento.cajaId)) {
      throw new AppError('No tenés acceso a este movimiento', 403)
    }
  }

  if (movimiento.anulado) {
    throw new AppError('El movimiento ya esta anulado', 400)
  }

  // No permitir anular si esta vinculado a un pago
  if (movimiento.pagoId) {
    throw new AppError('No se puede anular un movimiento vinculado a un pago de cuota', 400)
  }

  // Anular y revertir saldo
  await prisma.$transaction(async (tx) => {
    await tx.movimientoCaja.update({
      where: { id: parseInt(id) },
      data: { anulado: true }
    })

    // Revertir el saldo
    const incremento = movimiento.tipo === 'INGRESO'
      ? -Number(movimiento.monto)
      : Number(movimiento.monto)

    await tx.caja.update({
      where: { id: movimiento.cajaId },
      data: { saldoActual: { increment: incremento } }
    })
  })

  res.json({ success: true, message: 'Movimiento anulado correctamente' })
}))

// =============================================================================
// TRANSFERENCIAS ENTRE CAJAS
// =============================================================================

// Generar numero de transferencia
async function generarNumeroTransferencia() {
  const anio = new Date().getFullYear()
  const prefijo = `TC-${anio}-`

  const ultimo = await prisma.transferenciaCaja.findFirst({
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

// GET /api/admin/transferencias - Listar transferencias
router.get('/transferencias', asyncHandler(async (req, res) => {
  const { desde, hasta, page = 1, limit = 50 } = req.query

  // Obtener cajas permitidas según rol del usuario
  const admin = await prisma.admin.findUnique({
    where: { id: req.admin.id },
    include: {
      rol: {
        include: {
          cajas: { select: { cajaId: true } }
        }
      }
    }
  })

  const where = {}

  // Filtrar transferencias donde el usuario tenga acceso a alguna de las cajas
  if (admin?.rol && !admin.rol.esSuperAdmin && admin.rol.cajas?.length > 0) {
    const cajasPermitidas = admin.rol.cajas.map(cr => cr.cajaId)
    where.OR = [
      { cajaOrigenId: { in: cajasPermitidas } },
      { cajaDestinoId: { in: cajasPermitidas } }
    ]
  }

  if (desde || hasta) {
    where.fecha = {}
    if (desde) where.fecha.gte = new Date(desde)
    if (hasta) where.fecha.lte = new Date(hasta)
  }

  const skip = (parseInt(page) - 1) * parseInt(limit)

  const [transferencias, total] = await Promise.all([
    prisma.transferenciaCaja.findMany({
      where,
      orderBy: { fecha: 'desc' },
      skip,
      take: parseInt(limit),
      include: {
        cajaOrigen: { select: { id: true, codigo: true, nombre: true } },
        cajaDestino: { select: { id: true, codigo: true, nombre: true } }
      }
    }),
    prisma.transferenciaCaja.count({ where })
  ])

  const transferenciasFormateadas = transferencias.map(t => ({
    ...t,
    monto: Number(t.monto)
  }))

  res.json({
    success: true,
    data: transferenciasFormateadas,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  })
}))

// GET /api/admin/transferencias/:id - Detalle
router.get('/transferencias/:id', asyncHandler(async (req, res) => {
  const { id } = req.params

  const transferencia = await prisma.transferenciaCaja.findUnique({
    where: { id: parseInt(id) },
    include: {
      cajaOrigen: true,
      cajaDestino: true
    }
  })

  if (!transferencia) {
    throw new AppError('Transferencia no encontrada', 404)
  }

  // Verificar acceso del usuario a alguna de las cajas
  const admin = await prisma.admin.findUnique({
    where: { id: req.admin.id },
    include: {
      rol: {
        include: {
          cajas: { select: { cajaId: true } }
        }
      }
    }
  })

  if (admin?.rol && !admin.rol.esSuperAdmin && admin.rol.cajas?.length > 0) {
    const cajasPermitidas = admin.rol.cajas.map(cr => cr.cajaId)
    const tieneAcceso = cajasPermitidas.includes(transferencia.cajaOrigenId) ||
                        cajasPermitidas.includes(transferencia.cajaDestinoId)
    if (!tieneAcceso) {
      throw new AppError('No tenés acceso a esta transferencia', 403)
    }
  }

  res.json({
    success: true,
    data: { ...transferencia, monto: Number(transferencia.monto) }
  })
}))

// POST /api/admin/transferencias - Crear transferencia
router.post('/transferencias', asyncHandler(async (req, res) => {
  const { cajaOrigenId, cajaDestinoId, monto, concepto, descripcion } = req.body

  if (!cajaOrigenId || !cajaDestinoId || !monto) {
    throw new AppError('Caja origen, caja destino y monto son requeridos', 400)
  }

  if (parseInt(cajaOrigenId) === parseInt(cajaDestinoId)) {
    throw new AppError('La caja origen y destino deben ser diferentes', 400)
  }

  const montoNum = parseFloat(monto)
  if (montoNum <= 0) {
    throw new AppError('El monto debe ser mayor a cero', 400)
  }

  // Verificar cajas
  const [cajaOrigen, cajaDestino] = await Promise.all([
    prisma.caja.findUnique({ where: { id: parseInt(cajaOrigenId) }, include: { cuentaContable: true } }),
    prisma.caja.findUnique({ where: { id: parseInt(cajaDestinoId) }, include: { cuentaContable: true } })
  ])

  if (!cajaOrigen) {
    throw new AppError('Caja origen no encontrada', 404)
  }
  if (!cajaDestino) {
    throw new AppError('Caja destino no encontrada', 404)
  }
  if (!cajaOrigen.activo) {
    throw new AppError('La caja origen no esta activa', 400)
  }
  if (!cajaDestino.activo) {
    throw new AppError('La caja destino no esta activa', 400)
  }

  // Verificar acceso del usuario a ambas cajas
  const admin = await prisma.admin.findUnique({
    where: { id: req.admin.id },
    include: {
      rol: {
        include: {
          cajas: { select: { cajaId: true } }
        }
      }
    }
  })

  if (admin?.rol && !admin.rol.esSuperAdmin && admin.rol.cajas?.length > 0) {
    const cajasPermitidas = admin.rol.cajas.map(cr => cr.cajaId)
    if (!cajasPermitidas.includes(parseInt(cajaOrigenId))) {
      throw new AppError('No tenés acceso a la caja origen', 403)
    }
    if (!cajasPermitidas.includes(parseInt(cajaDestinoId))) {
      throw new AppError('No tenés acceso a la caja destino', 403)
    }
  }

  // Verificar saldo suficiente
  if (Number(cajaOrigen.saldoActual) < montoNum) {
    throw new AppError('Saldo insuficiente en la caja origen', 400)
  }

  // Crear transferencia y movimientos en transaccion
  const resultado = await prisma.$transaction(async (tx) => {
    const numero = await generarNumeroTransferencia()
    const numeroMovOrigen = await generarNumeroMovimiento()
    const numeroMovDestino = `MV-${new Date().getFullYear()}-${String(parseInt(numeroMovOrigen.split('-')[2]) + 1).padStart(5, '0')}`

    // Crear transferencia
    const transferencia = await tx.transferenciaCaja.create({
      data: {
        numero,
        cajaOrigenId: parseInt(cajaOrigenId),
        cajaDestinoId: parseInt(cajaDestinoId),
        fecha: new Date(),
        monto: montoNum,
        concepto: concepto || 'Transferencia entre cajas',
        descripcion: descripcion || null,
        estado: 'CONFIRMADO',
        registradoPor: req.admin.id
      },
      include: {
        cajaOrigen: { select: { id: true, codigo: true, nombre: true } },
        cajaDestino: { select: { id: true, codigo: true, nombre: true } }
      }
    })

    // Crear movimiento de egreso en caja origen
    await tx.movimientoCaja.create({
      data: {
        numero: numeroMovOrigen,
        cajaId: parseInt(cajaOrigenId),
        fecha: new Date(),
        tipo: 'EGRESO',
        monto: montoNum,
        cuentaContableId: cajaDestino.cuentaContableId || cajaOrigen.cuentaContableId,
        concepto: `Transferencia a ${cajaDestino.nombre}`,
        descripcion: `${numero}`,
        cajaDestinoId: parseInt(cajaDestinoId),
        registradoPor: req.admin.id
      }
    })

    // Crear movimiento de ingreso en caja destino
    await tx.movimientoCaja.create({
      data: {
        numero: numeroMovDestino,
        cajaId: parseInt(cajaDestinoId),
        fecha: new Date(),
        tipo: 'INGRESO',
        monto: montoNum,
        cuentaContableId: cajaOrigen.cuentaContableId || cajaDestino.cuentaContableId,
        concepto: `Transferencia desde ${cajaOrigen.nombre}`,
        descripcion: `${numero}`,
        registradoPor: req.admin.id
      }
    })

    // Actualizar saldos
    await tx.caja.update({
      where: { id: parseInt(cajaOrigenId) },
      data: { saldoActual: { decrement: montoNum } }
    })

    await tx.caja.update({
      where: { id: parseInt(cajaDestinoId) },
      data: { saldoActual: { increment: montoNum } }
    })

    return transferencia
  })

  res.status(201).json({
    success: true,
    data: { ...resultado, monto: Number(resultado.monto) }
  })
}))

// POST /api/admin/transferencias/:id/anular - Anular transferencia
router.post('/transferencias/:id/anular', asyncHandler(async (req, res) => {
  const { id } = req.params

  const transferencia = await prisma.transferenciaCaja.findUnique({
    where: { id: parseInt(id) },
    include: {
      cajaOrigen: true,
      cajaDestino: true
    }
  })

  if (!transferencia) {
    throw new AppError('Transferencia no encontrada', 404)
  }

  // Verificar acceso del usuario a alguna de las cajas
  const admin = await prisma.admin.findUnique({
    where: { id: req.admin.id },
    include: {
      rol: {
        include: {
          cajas: { select: { cajaId: true } }
        }
      }
    }
  })

  if (admin?.rol && !admin.rol.esSuperAdmin && admin.rol.cajas?.length > 0) {
    const cajasPermitidas = admin.rol.cajas.map(cr => cr.cajaId)
    const tieneAcceso = cajasPermitidas.includes(transferencia.cajaOrigenId) ||
                        cajasPermitidas.includes(transferencia.cajaDestinoId)
    if (!tieneAcceso) {
      throw new AppError('No tenés acceso a esta transferencia', 403)
    }
  }

  if (transferencia.estado === 'ANULADO') {
    throw new AppError('La transferencia ya esta anulada', 400)
  }

  // Verificar que caja destino tenga saldo suficiente para revertir
  const montoNum = Number(transferencia.monto)
  if (Number(transferencia.cajaDestino.saldoActual) < montoNum) {
    throw new AppError('Saldo insuficiente en caja destino para revertir la transferencia', 400)
  }

  // Anular y revertir saldos
  await prisma.$transaction(async (tx) => {
    await tx.transferenciaCaja.update({
      where: { id: parseInt(id) },
      data: { estado: 'ANULADO' }
    })

    // Revertir saldos
    await tx.caja.update({
      where: { id: transferencia.cajaOrigenId },
      data: { saldoActual: { increment: montoNum } }
    })

    await tx.caja.update({
      where: { id: transferencia.cajaDestinoId },
      data: { saldoActual: { decrement: montoNum } }
    })
  })

  res.json({ success: true, message: 'Transferencia anulada correctamente' })
}))

// =============================================================================
// RESUMEN DE CAJA
// =============================================================================

// GET /api/admin/cajas/:id/resumen - Resumen de movimientos de una caja
router.get('/cajas/:id/resumen', asyncHandler(async (req, res) => {
  const { id } = req.params
  const { desde, hasta } = req.query

  const caja = await prisma.caja.findUnique({
    where: { id: parseInt(id) }
  })

  if (!caja) {
    throw new AppError('Caja no encontrada', 404)
  }

  // Verificar acceso del usuario a esta caja
  const admin = await prisma.admin.findUnique({
    where: { id: req.admin.id },
    include: {
      rol: {
        include: {
          cajas: { select: { cajaId: true } }
        }
      }
    }
  })

  if (admin?.rol && !admin.rol.esSuperAdmin && admin.rol.cajas?.length > 0) {
    const cajasPermitidas = admin.rol.cajas.map(cr => cr.cajaId)
    if (!cajasPermitidas.includes(parseInt(id))) {
      throw new AppError('No tenés acceso a esta caja', 403)
    }
  }

  const whereMovimientos = {
    cajaId: parseInt(id),
    anulado: false
  }

  if (desde || hasta) {
    whereMovimientos.fecha = {}
    if (desde) whereMovimientos.fecha.gte = new Date(desde)
    if (hasta) whereMovimientos.fecha.lte = new Date(hasta)
  }

  // Obtener totales por tipo
  const [ingresos, egresos] = await Promise.all([
    prisma.movimientoCaja.aggregate({
      where: { ...whereMovimientos, tipo: 'INGRESO' },
      _sum: { monto: true },
      _count: true
    }),
    prisma.movimientoCaja.aggregate({
      where: { ...whereMovimientos, tipo: 'EGRESO' },
      _sum: { monto: true },
      _count: true
    })
  ])

  // Ultimos movimientos
  const ultimosMovimientos = await prisma.movimientoCaja.findMany({
    where: whereMovimientos,
    orderBy: { fecha: 'desc' },
    take: 10,
    include: {
      cuentaContable: { select: { id: true, codigo: true, nombre: true } }
    }
  })

  res.json({
    success: true,
    data: {
      caja: { ...caja, saldoActual: Number(caja.saldoActual) },
      periodo: { desde, hasta },
      ingresos: {
        total: Number(ingresos._sum.monto || 0),
        cantidad: ingresos._count
      },
      egresos: {
        total: Number(egresos._sum.monto || 0),
        cantidad: egresos._count
      },
      saldoMovimientos: Number(ingresos._sum.monto || 0) - Number(egresos._sum.monto || 0),
      ultimosMovimientos: ultimosMovimientos.map(m => ({
        ...m,
        monto: Number(m.monto)
      }))
    }
  })
}))

// =============================================================================
// VALORES PENDIENTES DE CONCILIAR
// =============================================================================

// GET /api/admin/pendientes-conciliar - Listar movimientos pendientes de conciliar
router.get('/pendientes-conciliar', asyncHandler(async (req, res) => {
  const { cajaId, desde, hasta, page = 1, limit = 50 } = req.query

  // Buscar movimientos no conciliados en cajas que requieren conciliación
  const where = {
    conciliado: false,
    anulado: false,
    caja: {
      requiereConciliacion: true,
      activo: true
    }
  }

  if (cajaId) {
    where.cajaId = parseInt(cajaId)
  }

  if (desde || hasta) {
    where.fecha = {}
    if (desde) where.fecha.gte = new Date(desde)
    if (hasta) where.fecha.lte = new Date(hasta)
  }

  const skip = (parseInt(page) - 1) * parseInt(limit)

  const [movimientos, total] = await Promise.all([
    prisma.movimientoCaja.findMany({
      where,
      orderBy: { fecha: 'desc' },
      skip,
      take: parseInt(limit),
      include: {
        caja: { select: { id: true, codigo: true, nombre: true, tipo: true } },
        pago: {
          select: {
            id: true,
            socio: { select: { id: true, nroSocio: true, apellidoNombre: true } },
            medioPago: { select: { id: true, nombre: true } }
          }
        }
      }
    }),
    prisma.movimientoCaja.count({ where })
  ])

  const movimientosFormateados = movimientos.map(m => ({
    ...m,
    monto: Number(m.monto)
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

// GET /api/admin/pendientes-conciliar/resumen - Resumen de valores pendientes
router.get('/pendientes-conciliar/resumen', asyncHandler(async (req, res) => {
  // Obtener cajas que requieren conciliación
  const cajas = await prisma.caja.findMany({
    where: {
      requiereConciliacion: true,
      activo: true
    }
  })

  const resumenPorCaja = []

  for (const caja of cajas) {
    const pendientes = await prisma.movimientoCaja.aggregate({
      where: {
        cajaId: caja.id,
        conciliado: false,
        anulado: false
      },
      _sum: { monto: true },
      _count: true
    })

    const conciliados = await prisma.movimientoCaja.aggregate({
      where: {
        cajaId: caja.id,
        conciliado: true,
        anulado: false
      },
      _sum: { monto: true },
      _count: true
    })

    resumenPorCaja.push({
      caja: {
        id: caja.id,
        codigo: caja.codigo,
        nombre: caja.nombre,
        tipo: caja.tipo,
        saldoActual: Number(caja.saldoActual)
      },
      pendientes: {
        cantidad: pendientes._count,
        monto: Number(pendientes._sum.monto || 0)
      },
      conciliados: {
        cantidad: conciliados._count,
        monto: Number(conciliados._sum.monto || 0)
      }
    })
  }

  const totalPendiente = resumenPorCaja.reduce((sum, r) => sum + r.pendientes.monto, 0)
  const totalCantidadPendiente = resumenPorCaja.reduce((sum, r) => sum + r.pendientes.cantidad, 0)

  res.json({
    success: true,
    data: {
      totalPendiente,
      totalCantidadPendiente,
      cajas: resumenPorCaja
    }
  })
}))

// POST /api/admin/pendientes-conciliar/conciliar - Marcar movimientos como conciliados
router.post('/pendientes-conciliar/conciliar', asyncHandler(async (req, res) => {
  const { movimientoIds, observacion } = req.body

  if (!movimientoIds || !Array.isArray(movimientoIds) || movimientoIds.length === 0) {
    throw new AppError('Debe seleccionar al menos un movimiento', 400)
  }

  // Verificar que todos los movimientos existen y están pendientes
  const movimientos = await prisma.movimientoCaja.findMany({
    where: {
      id: { in: movimientoIds.map(id => parseInt(id)) },
      conciliado: false,
      anulado: false
    },
    include: {
      caja: true
    }
  })

  if (movimientos.length !== movimientoIds.length) {
    throw new AppError('Algunos movimientos no existen o ya fueron conciliados', 400)
  }

  // Verificar que todos pertenecen a cajas que requieren conciliación
  const cajasInvalidas = movimientos.filter(m => !m.caja.requiereConciliacion)
  if (cajasInvalidas.length > 0) {
    throw new AppError('Algunos movimientos pertenecen a cajas que no requieren conciliación', 400)
  }

  // Marcar como conciliados
  await prisma.movimientoCaja.updateMany({
    where: {
      id: { in: movimientoIds.map(id => parseInt(id)) }
    },
    data: {
      conciliado: true,
      fechaConciliacion: new Date(),
      observacionConciliacion: observacion || null
    }
  })

  const montoTotal = movimientos.reduce((sum, m) => sum + Number(m.monto), 0)

  res.json({
    success: true,
    message: `${movimientos.length} movimientos conciliados correctamente`,
    data: {
      cantidad: movimientos.length,
      montoTotal
    }
  })
}))

// POST /api/admin/pendientes-conciliar/transferir - Transferir valores conciliados a cuenta bancaria
router.post('/pendientes-conciliar/transferir', asyncHandler(async (req, res) => {
  const { cajaOrigenId, cajaDestinoId, movimientoIds, concepto } = req.body

  if (!cajaOrigenId || !cajaDestinoId || !movimientoIds || movimientoIds.length === 0) {
    throw new AppError('Debe especificar caja origen, destino y movimientos a transferir', 400)
  }

  // Obtener los movimientos conciliados
  const movimientos = await prisma.movimientoCaja.findMany({
    where: {
      id: { in: movimientoIds.map(id => parseInt(id)) },
      cajaId: parseInt(cajaOrigenId),
      conciliado: true,
      anulado: false
    }
  })

  if (movimientos.length !== movimientoIds.length) {
    throw new AppError('Algunos movimientos no existen, no están conciliados o no pertenecen a la caja origen', 400)
  }

  const montoTotal = movimientos.reduce((sum, m) => sum + Number(m.monto), 0)

  // Verificar cajas
  const [cajaOrigen, cajaDestino] = await Promise.all([
    prisma.caja.findUnique({ where: { id: parseInt(cajaOrigenId) } }),
    prisma.caja.findUnique({ where: { id: parseInt(cajaDestinoId) } })
  ])

  if (!cajaOrigen || !cajaDestino) {
    throw new AppError('Caja origen o destino no encontrada', 404)
  }

  if (Number(cajaOrigen.saldoActual) < montoTotal) {
    throw new AppError('Saldo insuficiente en la caja origen', 400)
  }

  // Crear transferencia
  const resultado = await prisma.$transaction(async (tx) => {
    const numero = await generarNumeroTransferencia()
    const numeroMovOrigen = await generarNumeroMovimiento()
    const numeroMovDestino = `MV-${new Date().getFullYear()}-${String(parseInt(numeroMovOrigen.split('-')[2]) + 1).padStart(5, '0')}`

    // Crear transferencia
    const transferencia = await tx.transferenciaCaja.create({
      data: {
        numero,
        cajaOrigenId: parseInt(cajaOrigenId),
        cajaDestinoId: parseInt(cajaDestinoId),
        fecha: new Date(),
        monto: montoTotal,
        concepto: concepto || 'Acreditación de valores conciliados',
        descripcion: `Transferencia de ${movimientos.length} movimientos conciliados`,
        estado: 'CONFIRMADO',
        registradoPor: req.admin.id
      }
    })

    // Crear movimiento de egreso en caja origen
    await tx.movimientoCaja.create({
      data: {
        numero: numeroMovOrigen,
        cajaId: parseInt(cajaOrigenId),
        fecha: new Date(),
        tipo: 'EGRESO',
        monto: montoTotal,
        cuentaContableId: cajaDestino.cuentaContableId || cajaOrigen.cuentaContableId,
        concepto: `Transferencia a ${cajaDestino.nombre}`,
        descripcion: `Acreditación ${numero}`,
        cajaDestinoId: parseInt(cajaDestinoId),
        registradoPor: req.admin.id,
        conciliado: true // Este movimiento ya está conciliado
      }
    })

    // Crear movimiento de ingreso en caja destino
    await tx.movimientoCaja.create({
      data: {
        numero: numeroMovDestino,
        cajaId: parseInt(cajaDestinoId),
        fecha: new Date(),
        tipo: 'INGRESO',
        monto: montoTotal,
        cuentaContableId: cajaOrigen.cuentaContableId || cajaDestino.cuentaContableId,
        concepto: `Acreditación desde ${cajaOrigen.nombre}`,
        descripcion: `Acreditación ${numero}`,
        registradoPor: req.admin.id,
        conciliado: !cajaDestino.requiereConciliacion // Según config de caja destino
      }
    })

    // Actualizar saldos
    await tx.caja.update({
      where: { id: parseInt(cajaOrigenId) },
      data: { saldoActual: { decrement: montoTotal } }
    })

    await tx.caja.update({
      where: { id: parseInt(cajaDestinoId) },
      data: { saldoActual: { increment: montoTotal } }
    })

    return transferencia
  })

  res.json({
    success: true,
    message: `Transferencia creada correctamente`,
    data: {
      transferencia: { ...resultado, monto: Number(resultado.monto) },
      movimientosConciliados: movimientos.length,
      montoTotal
    }
  })
}))

export default router
