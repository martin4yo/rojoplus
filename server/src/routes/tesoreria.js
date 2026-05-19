import { Router } from 'express'
import prisma from '../lib/prisma.js'
import * as XLSX from 'xlsx'
import { authAdmin, checkPermiso } from '../middleware/auth.js'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { generarAsientoMovimientoCaja, crearAsientoTransferencia, resolverCuentaCashId } from '../services/asientosContables.js'
import { generarAsientoAutomatico } from './asientos.js'
import { generarComprobanteMovimientoPDF } from '../services/pdfGenerator.js'
import { enviarComprobanteMovimientoEmail } from '../services/email.js'
import { enviarComprobanteMovimientoWhatsApp } from '../services/whatsappService.js'
import { validarLimiteEgreso, mensajeSaldoInsuficiente } from '../services/saldoCaja.js'

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
  console.log('[CAJAS DEBUG] adminId:', req.admin.id, '| rol:', admin?.rol?.nombre, '| esSuperAdmin:', admin?.rol?.esSuperAdmin, '| cajasRol:', admin?.rol?.cajas?.map(c => c.cajaId))
  if (admin?.rol && !admin.rol.esSuperAdmin && admin.rol.cajas?.length > 0) {
    const cajasPermitidas = admin.rol.cajas.map(cr => cr.cajaId)
    where.id = { in: cajasPermitidas }
  } else if (admin?.rol && !admin.rol.esSuperAdmin && admin.rol.cajas?.length === 0) {
    // Rol sin cajas asignadas: no puede ver ninguna
    where.id = { in: [] }
  }
  console.log('[CAJAS DEBUG] where:', JSON.stringify(where))

  const cajas = await req.db.caja.findMany({
    where,
    include: { centroCosto: true, cuentaContable: true },
    orderBy: { nombre: 'asc' }
  })

  // Calcular saldo real desde movimientos para cada caja
  const cajasConSaldo = await Promise.all(cajas.map(async (caja) => {
    // Sumar ingresos
    const ingresos = await req.db.movimientoCaja.aggregate({
      where: { cajaId: caja.id, tipo: 'INGRESO', anulado: false },
      _sum: { monto: true }
    })
    // Sumar egresos
    const egresos = await req.db.movimientoCaja.aggregate({
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

  const caja = await req.db.caja.findUnique({
    where: { id: parseInt(id) },
    include: { cuentaBancaria: true },
  })

  if (!caja) {
    throw new AppError('Caja no encontrada', 404)
  }

  // Calcular saldo real desde movimientos
  const ingresos = await req.db.movimientoCaja.aggregate({
    where: { cajaId: caja.id, tipo: 'INGRESO', anulado: false },
    _sum: { monto: true }
  })
  const egresos = await req.db.movimientoCaja.aggregate({
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
router.post('/cajas', checkPermiso('CAJA_MOVIMIENTOS'), asyncHandler(async (req, res) => {
  const {
    codigo, nombre, tipo, descripcion, saldoInicial, cuentaContableId, centroCostoId,
    requiereConciliacion, mediosPagoPermitidos,
    puntoVentaAfip, paraBuffet, paraKiosco, paraTakeaway, paraCaja,
    permiteSaldoNegativo, limiteDescubierto
  } = req.body

  if (!codigo || !nombre || !tipo) {
    throw new AppError('Codigo, nombre y tipo son requeridos', 400)
  }

  if (!centroCostoId) {
    throw new AppError('El Centro de Costo es obligatorio', 400, 'CC_REQUIRED')
  }

  if (!['EFECTIVO', 'BANCO', 'MERCADOPAGO', 'VALORES_PENDIENTES', 'OTRO'].includes(tipo)) {
    throw new AppError('Tipo debe ser EFECTIVO, BANCO, MERCADOPAGO, VALORES_PENDIENTES u OTRO', 400)
  }

  const existente = await req.db.caja.findFirst({ where: { codigo } })
  if (existente) {
    throw new AppError('Ya existe una caja con ese codigo', 400)
  }

  const caja = await req.db.caja.create({
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
      permiteSaldoNegativo: permiteSaldoNegativo === true,
      limiteDescubierto: permiteSaldoNegativo === true && limiteDescubierto != null && limiteDescubierto !== ''
        ? parseFloat(limiteDescubierto)
        : null,
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
router.put('/cajas/:id', checkPermiso('CAJA_MOVIMIENTOS'), asyncHandler(async (req, res) => {
  const { id } = req.params
  const {
    codigo, nombre, tipo, descripcion, activo, cuentaContableId, centroCostoId,
    requiereConciliacion, mediosPagoPermitidos,
    puntoVentaAfip, paraBuffet, paraKiosco, paraTakeaway, paraCaja,
    permiteSaldoNegativo, limiteDescubierto,
    cuentaBancaria, // { banco, tipoCuenta, numeroCuenta, cbu, alias, titular, cuit, sucursal } — opcional
  } = req.body

  const existente = await req.db.caja.findUnique({ where: { id: parseInt(id) } })
  if (!existente) {
    throw new AppError('Caja no encontrada', 404)
  }

  // Verificar codigo unico si cambio
  if (codigo && codigo !== existente.codigo) {
    const duplicado = await req.db.caja.findFirst({ where: { codigo } })
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
    paraCaja: paraCaja !== undefined ? paraCaja : existente.paraCaja,
    permiteSaldoNegativo: permiteSaldoNegativo !== undefined ? !!permiteSaldoNegativo : existente.permiteSaldoNegativo,
    limiteDescubierto: permiteSaldoNegativo !== undefined
      ? (permiteSaldoNegativo && limiteDescubierto != null && limiteDescubierto !== '' ? parseFloat(limiteDescubierto) : null)
      : existente.limiteDescubierto
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

  const caja = await req.db.caja.update({
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
async function generarNumeroMovimiento(db) {
  const anio = new Date().getFullYear()
  const prefijo = `MV-${anio}-`

  const ultimo = await db.movimientoCaja.findFirst({
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
  const { cajaId, tipo, desde, hasta, medioPago, medioPagoId, page = 1, limit = 50 } = req.query

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
    // Interpretar fechas como inicio/fin de día en Argentina (UTC-3)
    if (desde) where.fecha.gte = new Date(desde + 'T00:00:00-03:00')
    if (hasta) where.fecha.lte = new Date(hasta + 'T23:59:59.999-03:00')
  }

  if (medioPagoId !== undefined) {
    where.medioPagoId = medioPagoId === 'null' ? null : parseInt(medioPagoId)
  } else if (medioPago) {
    where.medioPago = medioPago === 'SIN_ESPECIFICAR' ? null : medioPago
  }

  const { busqueda } = req.query
  if (busqueda) {
    where.OR = [
      { numero: { contains: busqueda, mode: 'insensitive' } },
      { concepto: { contains: busqueda, mode: 'insensitive' } },
      { descripcion: { contains: busqueda, mode: 'insensitive' } }
    ]
  }

  const skip = (parseInt(page) - 1) * parseInt(limit)

  const [movimientos, total] = await Promise.all([
    req.db.movimientoCaja.findMany({
      where,
      orderBy: { fecha: 'desc' },
      skip,
      take: parseInt(limit),
      include: {
        caja: { select: { id: true, codigo: true, nombre: true } },
        cuentaContable: { select: { id: true, codigo: true, nombre: true } },
        centroCosto: { select: { id: true, codigo: true, nombre: true } },
        medioPagoRel: { select: { id: true, nombre: true } },
        movimientoContable: { select: { id: true, tipo: true, numero: true } },
        socio: { select: { id: true, nroSocio: true, apellidoNombre: true } },
        entidad: { select: { id: true, codigo: true, razonSocial: true, nombreFantasia: true, tipo: true } },
        pago: {
          select: {
            id: true,
            socio: { select: { id: true, nroSocio: true, apellidoNombre: true } }
          }
        },
        _count: { select: { adjuntos: true } },
        mediosPago: {
          select: {
            medioPago: { select: { id: true, nombre: true } }
          }
        },
      }
    }),
    req.db.movimientoCaja.count({ where })
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

  const movimiento = await req.db.movimientoCaja.findUnique({
    where: { id: parseInt(id) },
    include: {
      caja: true,
      cuentaContable: true,
      centroCosto: true,
      medioPagoRel: true,
      movimientoContable: { select: { id: true, tipo: true, numero: true } },
      socio: {
        select: {
          id: true, nroSocio: true, apellidoNombre: true,
          email: true, celular: true, celularSecundario: true, telefonoFijo: true,
        }
      },
      entidad: {
        select: {
          id: true, razonSocial: true, tipo: true,
          email: true, telefono: true,
        }
      },
      items: {
        orderBy: { orden: 'asc' },
        include: {
          conceptoTesoreria: { select: { id: true, codigo: true, nombre: true } },
          cuentaContable: { select: { id: true, codigo: true, nombre: true } },
          centroCosto: { select: { id: true, codigo: true, nombre: true } },
        }
      },
      mediosPago: {
        orderBy: { orden: 'asc' },
        include: {
          medioPago: { select: { id: true, codigo: true, nombre: true, tipo: true } },
        }
      },
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

// POST /api/admin/movimientos-caja - Crear movimiento manual.
// Soporta dos modos:
//  - "Single": un único concepto/cuenta/CC (campos planos: monto, cuentaContableId, centroCostoId, concepto)
//  - "Multi-item": items: [{ conceptoTesoreriaId, cuentaContableId, centroCostoId, monto, descripcion }]
//    En este modo, monto = suma de items y se generan asientos por línea.
router.post('/movimientos-caja', checkPermiso('CAJA_MOVIMIENTOS'), asyncHandler(async (req, res) => {
  const {
    cajaId, tipo,
    monto: montoBody, cuentaContableId, concepto, descripcion, centroCostoId,
    medioPago, medioPagoId: medioPagoIdBody, fecha, socioId, entidadId,
    items: itemsBody,
    mediosPago: mediosPagoBody,
  } = req.body

  if (!cajaId || !tipo) {
    throw new AppError('Caja y tipo son requeridos', 400)
  }

  // Verificar si vienen medios múltiples
  const usaMediosMultiples = Array.isArray(mediosPagoBody) && mediosPagoBody.length > 0

  if (!usaMediosMultiples && !medioPago && !medioPagoIdBody) {
    throw new AppError('El medio de pago es requerido', 400)
  }

  if (!['INGRESO', 'EGRESO'].includes(tipo)) {
    throw new AppError('Tipo debe ser INGRESO o EGRESO', 400)
  }

  // Normalizar a items: si vienen, se usan; si no, armar uno solo desde campos planos
  const usaItems = Array.isArray(itemsBody) && itemsBody.length > 0
  let itemsNorm = []
  let montoTotal = 0
  let conceptoRoot = concepto
  let cuentaContableRootId = cuentaContableId ? parseInt(cuentaContableId) : null
  let centroCostoRootId = centroCostoId ? parseInt(centroCostoId) : null

  if (usaItems) {
    for (const it of itemsBody) {
      const m = parseFloat(it.monto)
      if (!it.cuentaContableId) {
        throw new AppError('Cada ítem debe tener cuenta contable', 400)
      }
      if (!it.centroCostoId) {
        throw new AppError('Cada ítem debe tener centro de costo', 400)
      }
      if (!m || m <= 0) {
        throw new AppError('Cada ítem debe tener monto mayor a 0', 400)
      }
      itemsNorm.push({
        conceptoTesoreriaId: it.conceptoTesoreriaId ? parseInt(it.conceptoTesoreriaId) : null,
        cuentaContableId: parseInt(it.cuentaContableId),
        centroCostoId: parseInt(it.centroCostoId),
        monto: m,
        descripcion: it.descripcion || null,
      })
      montoTotal += m
    }
    // Datos del root: tomar del primer item para retrocompatibilidad de reportes
    cuentaContableRootId = itemsNorm[0].cuentaContableId
    centroCostoRootId = itemsNorm[0].centroCostoId
    if (!conceptoRoot) {
      conceptoRoot = itemsNorm.length === 1
        ? (itemsNorm[0].descripcion || 'Movimiento')
        : `Múltiple (${itemsNorm.length} conceptos)`
    }
  } else {
    if (!montoBody || !cuentaContableRootId) {
      throw new AppError('Monto y cuenta contable son requeridos', 400)
    }
    if (!centroCostoRootId) {
      throw new AppError('El centro de costo es requerido. Verificá que el concepto seleccionado tenga un centro de costo asignado.', 400)
    }
    montoTotal = parseFloat(montoBody)
    itemsNorm.push({
      conceptoTesoreriaId: null,
      cuentaContableId: cuentaContableRootId,
      centroCostoId: centroCostoRootId,
      monto: montoTotal,
      descripcion: descripcion || null,
    })
  }

  // Normalizar medios de pago (multi o single)
  let mediosNorm = []
  if (usaMediosMultiples) {
    let totalMedios = 0
    for (const mp of mediosPagoBody) {
      const m = parseFloat(mp.monto)
      if (!mp.medioPagoId) {
        throw new AppError('Cada medio de pago debe tener un medioPagoId', 400)
      }
      if (!m || m <= 0) {
        throw new AppError('Cada medio de pago debe tener monto mayor a 0', 400)
      }
      mediosNorm.push({
        medioPagoId: parseInt(mp.medioPagoId),
        monto: m,
        nroOperacion: mp.nroOperacion?.trim() || null,
        nroCupon: mp.nroCupon?.trim() || null,
        nroLote: mp.nroLote?.trim() || null,
        nroAutorizacion: mp.nroAutorizacion?.trim() || null,
        descripcion: mp.descripcion || null,
      })
      totalMedios += m
    }
    if (Math.abs(totalMedios - montoTotal) > 0.01) {
      throw new AppError(
        `Los medios de pago suman $${totalMedios.toLocaleString('es-AR')} pero el total de conceptos es $${montoTotal.toLocaleString('es-AR')}. Deben coincidir.`,
        400
      )
    }
  }

  const caja = await req.db.caja.findUnique({
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

  // Cargar cuenta contable principal (la del root del movimiento)
  const cuentaContable = await req.db.cuentaContable.findUnique({
    where: { id: cuentaContableRootId }
  })
  if (!cuentaContable) {
    throw new AppError('Cuenta contable no encontrada', 404)
  }

  // Validar que la caja tenga cuenta contable para poder generar el asiento
  if (!caja.cuentaContable?.codigo) {
    // Intentar resolver por tipo como fallback
    const codigoFallback = caja.tipo === 'BANCO' ? '1.1.1.02' : '1.1.1.01'
    const cuentaCajaExiste = await req.db.cuentaContable.findFirst({ where: { codigo: codigoFallback } })
    if (!cuentaCajaExiste) {
      throw new AppError(`La caja no tiene cuenta contable configurada y no existe la cuenta genérica (${codigoFallback}). Asignale una cuenta contable a la caja antes de registrar movimientos.`, 400)
    }
  }

  // Resolver medio(s) de pago.
  // - Si vienen mediosPago[] múltiples: cargar todos los registros.
  // - Si viene 1 solo (modo single): cargar uno y armar mediosNorm con [único].
  const _mpInclude = { include: { conceptoTesoreria: true } }
  let medioPagoRecord = null  // Para retrocompat del root: el primer medio
  let mediosPagoRecords = []  // Lista de registros completos paralelo a mediosNorm

  if (usaMediosMultiples) {
    for (const mp of mediosNorm) {
      const rec = await req.db.medioPago.findUnique({ where: { id: mp.medioPagoId }, ..._mpInclude })
      if (!rec) {
        throw new AppError(`Medio de pago id=${mp.medioPagoId} no encontrado.`, 400)
      }
      mediosPagoRecords.push(rec)
    }
    medioPagoRecord = mediosPagoRecords[0]
  } else {
    if (medioPagoIdBody) {
      medioPagoRecord = await req.db.medioPago.findUnique({ where: { id: parseInt(medioPagoIdBody) }, ..._mpInclude })
    } else if (medioPago) {
      medioPagoRecord = await req.db.medioPago.findFirst({ where: { codigo: medioPago }, ..._mpInclude })
    }
    if (!medioPagoRecord) {
      throw new AppError(`Medio de pago '${medioPago || medioPagoIdBody}' no encontrado. Verificá la configuración de medios de pago.`, 400)
    }
    // Armar el equivalente single-medio en mediosNorm para uniformar el flow posterior
    mediosNorm.push({
      medioPagoId: medioPagoRecord.id,
      monto: montoTotal,
      nroOperacion: null,
      descripcion: null,
    })
    mediosPagoRecords.push(medioPagoRecord)
  }

  // Validar campos obligatorios según tipo de medio:
  //   TARJETA_CREDITO/DEBITO/TARJETA → nroCupon + nroLote requeridos
  //   TRANSFERENCIA o BANCO con "transferencia" en el nombre → nroOperacion requerido
  for (let i = 0; i < mediosNorm.length; i++) {
    const mp = mediosNorm[i]
    const rec = mediosPagoRecords[i]
    const tipoMP = (rec?.tipo || '').toUpperCase()
    const nombreMP = (rec?.nombre || '').toLowerCase()
    const esTarjeta = ['TARJETA_CREDITO', 'TARJETA_DEBITO', 'TARJETA'].includes(tipoMP)
    const esTransfer = tipoMP === 'TRANSFERENCIA' || (tipoMP === 'BANCO' && nombreMP.includes('transfer'))
    if (esTarjeta) {
      if (!mp.nroCupon || !mp.nroLote) {
        throw new AppError(
          `Para "${rec.nombre}" (tarjeta) son obligatorios el N° de cupón y N° de lote.`,
          400, 'TARJETA_DATOS_REQUERIDOS'
        )
      }
    }
    if (esTransfer) {
      if (!mp.nroOperacion) {
        throw new AppError(
          `Para "${rec.nombre}" (transferencia) es obligatorio el N° de operación.`,
          400, 'TRANSF_DATOS_REQUERIDOS'
        )
      }
    }
  }

  // Verificar saldo suficiente para egresos — chequea por cada medio de pago
  const montoNum = montoTotal
  if (tipo === 'EGRESO') {
    for (const mp of mediosNorm) {
      const whereBase = { cajaId: parseInt(cajaId), anulado: false, medioPagoId: mp.medioPagoId }
      const [ingresosAgg, egresosAgg] = await Promise.all([
        req.db.movimientoCaja.aggregate({ where: { ...whereBase, tipo: 'INGRESO' }, _sum: { monto: true } }),
        req.db.movimientoCaja.aggregate({ where: { ...whereBase, tipo: 'EGRESO'  }, _sum: { monto: true } })
      ])
      const saldoMedio = (Number(ingresosAgg._sum.monto) || 0) - (Number(egresosAgg._sum.monto) || 0)
      const { valido } = validarLimiteEgreso(caja, saldoMedio, mp.monto)
      if (!valido) {
        const rec = mediosPagoRecords.find(r => r.id === mp.medioPagoId)
        throw new AppError(
          mensajeSaldoInsuficiente({ caja, disponible: saldoMedio, requerido: mp.monto, contexto: `Medio ${rec?.nombre || mp.medioPagoId}` }),
          400
        )
      }
    }
  }

  // Crear movimiento y actualizar saldo
  const numero = await generarNumeroMovimiento(req.db)

  const resultado = await req.db.movimientoCaja.create({
    data: {
      numero,
      cajaId: parseInt(cajaId),
      fecha: fecha ? new Date(fecha + 'T12:00:00') : new Date(),
      tipo,
      monto: montoNum,
      cuentaContableId: cuentaContableRootId,
      centroCostoId: centroCostoRootId,
      concepto: conceptoRoot || cuentaContable.nombre,
      descripcion: descripcion || null,
      medioPagoId: medioPagoRecord.id,
      registradoPor: req.admin.id,
      socioId: socioId ? parseInt(socioId) : null,
      entidadId: entidadId ? parseInt(entidadId) : null,
    },
    include: {
      caja: { select: { id: true, codigo: true, nombre: true } },
      cuentaContable: { select: { id: true, codigo: true, nombre: true } },
      socio: { select: { id: true, apellidoNombre: true, nroSocio: true } },
      entidad: { select: { id: true, razonSocial: true, tipo: true } },
    }
  })

  const incremento = tipo === 'INGRESO' ? montoNum : -montoNum
  await req.db.caja.update({
    where: { id: parseInt(cajaId) },
    data: { saldoActual: { increment: incremento } }
  })

  // Persistir items del movimiento
  await req.db.itemMovimientoCaja.createMany({
    data: itemsNorm.map((it, idx) => ({
      movimientoCajaId: resultado.id,
      conceptoTesoreriaId: it.conceptoTesoreriaId,
      cuentaContableId: it.cuentaContableId,
      centroCostoId: it.centroCostoId,
      monto: it.monto,
      descripcion: it.descripcion,
      orden: idx,
    }))
  })

  // Persistir medios de pago (siempre — modo single arma 1 medio en mediosNorm)
  await req.db.medioPagoMovimientoCaja.createMany({
    data: mediosNorm.map((mp, idx) => ({
      movimientoCajaId: resultado.id,
      medioPagoId: mp.medioPagoId,
      monto: mp.monto,
      nroOperacion: mp.nroOperacion,
      nroCupon: mp.nroCupon || null,
      nroLote: mp.nroLote || null,
      nroAutorizacion: mp.nroAutorizacion || null,
      descripcion: mp.descripcion,
      orden: idx,
    }))
  })

  // Generar asiento contable — obligatorio, si falla se revierte el movimiento
  try {
    if (usaItems || usaMediosMultiples) {
      // Asiento con N líneas:
      //   - 1 línea de cash por cada medio de pago (cuenta cash propia)
      //   - 1 línea de concepto por cada item (cuenta y CC propios)
      const ccCajaDefault = caja.centroCostoId || itemsNorm[0].centroCostoId
      const lineasCash = mediosNorm.map((mp, idx) => {
        const rec = mediosPagoRecords[idx]
        const cuentaCashId = resolverCuentaCashId(rec, caja)
        if (!cuentaCashId) {
          throw new Error(`No se pudo determinar la cuenta de cash para ${rec?.nombre || 'medio'}`)
        }
        const desc = `${rec?.nombre || ''}${mp.nroOperacion ? ` op. ${mp.nroOperacion}` : ''}`
        return tipo === 'INGRESO'
          ? { cuentaContableId: cuentaCashId, debe: mp.monto, haber: 0, descripcion: desc, centroCostoId: ccCajaDefault }
          : { cuentaContableId: cuentaCashId, debe: 0, haber: mp.monto, descripcion: desc, centroCostoId: ccCajaDefault }
      })
      const lineasItems = itemsNorm.map(it => (
        tipo === 'INGRESO'
          ? { cuentaContableId: it.cuentaContableId, debe: 0, haber: it.monto, descripcion: it.descripcion || conceptoRoot, centroCostoId: it.centroCostoId }
          : { cuentaContableId: it.cuentaContableId, debe: it.monto, haber: 0, descripcion: it.descripcion || conceptoRoot, centroCostoId: it.centroCostoId }
      ))
      await generarAsientoAutomatico(req.db, {
        fecha: resultado.fecha,
        concepto: `${tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'}: ${conceptoRoot}`,
        tipoOrigen: 'MOV_CAJA',
        origenId: resultado.id,
        registradoPor: req.admin.id,
        lineas: [...lineasCash, ...lineasItems],
      })
    } else {
      await generarAsientoMovimientoCaja(req.db, {
        movimiento: resultado,
        caja,
        medioPago: medioPagoRecord,
        registradoPor: req.admin.id,
      })
    }
  } catch (err) {
    // Revertir: eliminar el movimiento y restaurar el saldo
    await req.db.itemMovimientoCaja.deleteMany({ where: { movimientoCajaId: resultado.id } })
    await req.db.medioPagoMovimientoCaja.deleteMany({ where: { movimientoCajaId: resultado.id } })
    await req.db.movimientoCaja.update({ where: { id: resultado.id }, data: { anulado: true } })
    await req.db.caja.update({
      where: { id: parseInt(cajaId) },
      data: { saldoActual: { increment: -incremento } }
    })
    throw new AppError(`No se pudo generar el asiento contable: ${err.message}`, 400)
  }

  res.status(201).json({
    success: true,
    data: { ...resultado, monto: Number(resultado.monto) }
  })
}))

// POST /api/admin/movimientos-caja/:id/anular - Anular movimiento
router.post('/movimientos-caja/:id/anular', checkPermiso('CAJA_ANULAR'), asyncHandler(async (req, res) => {
  const { id } = req.params

  const movimiento = await req.db.movimientoCaja.findUnique({
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
  await req.db.movimientoCaja.update({
    where: { id: parseInt(id) },
    data: { anulado: true }
  })

  const incremento = movimiento.tipo === 'INGRESO'
    ? -Number(movimiento.monto)
    : Number(movimiento.monto)

  await req.db.caja.update({
    where: { id: movimiento.cajaId },
    data: { saldoActual: { increment: incremento } }
  })

  res.json({ success: true, message: 'Movimiento anulado correctamente' })
}))

// =============================================================================
// TRANSFERENCIAS ENTRE CAJAS
// =============================================================================

// Generar numero de transferencia
async function generarNumeroTransferencia(db) {
  const anio = new Date().getFullYear()
  const prefijo = `TC-${anio}-`

  const ultimo = await db.transferenciaCaja.findFirst({
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
    if (hasta) where.fecha.lte = new Date(hasta + 'T23:59:59.999Z')
  }

  const skip = (parseInt(page) - 1) * parseInt(limit)

  const [transferencias, total] = await Promise.all([
    req.db.transferenciaCaja.findMany({
      where,
      orderBy: { fecha: 'desc' },
      skip,
      take: parseInt(limit),
      include: {
        cajaOrigen: { select: { id: true, codigo: true, nombre: true } },
        cajaDestino: { select: { id: true, codigo: true, nombre: true } }
      }
    }),
    req.db.transferenciaCaja.count({ where })
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

  const transferencia = await req.db.transferenciaCaja.findUnique({
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
router.post('/transferencias', checkPermiso('CAJA_MOVIMIENTOS'), asyncHandler(async (req, res) => {
  const { cajaOrigenId, cajaDestinoId, monto, medioPago, conceptoId, concepto, descripcion,
          cuentaContableOrigenId, cuentaContableDestinoId, centroCostoId } = req.body

  if (!cajaOrigenId || !cajaDestinoId || !monto) {
    throw new AppError('Caja origen, caja destino y monto son requeridos', 400)
  }
  if (!medioPago) {
    throw new AppError('El medio de pago es obligatorio', 400)
  }
  if (!conceptoId) {
    throw new AppError('El concepto es obligatorio', 400)
  }
  if (!centroCostoId) {
    throw new AppError('El Centro de Costo es obligatorio', 400, 'CC_REQUIRED')
  }
  if (!descripcion?.trim()) {
    throw new AppError('La descripción es obligatoria', 400)
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
    req.db.caja.findUnique({ where: { id: parseInt(cajaOrigenId) }, include: { cuentaContable: true } }),
    req.db.caja.findUnique({ where: { id: parseInt(cajaDestinoId) }, include: { cuentaContable: true } })
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

  // Resolver medioPago código → ID
  const medioPagoRecord = await req.db.medioPago.findFirst({ where: { codigo: medioPago, activo: true } })
  if (!medioPagoRecord) {
    throw new AppError(`Medio de pago '${medioPago}' no encontrado`, 400)
  }
  const medioPagoId = medioPagoRecord.id

  // Verificar saldo suficiente por medio de pago
  {
    const whereBase = { cajaId: parseInt(cajaOrigenId), anulado: false, medioPagoId }
    const [ingAgg, egrAgg] = await Promise.all([
      req.db.movimientoCaja.aggregate({ where: { ...whereBase, tipo: 'INGRESO' }, _sum: { monto: true } }),
      req.db.movimientoCaja.aggregate({ where: { ...whereBase, tipo: 'EGRESO'  }, _sum: { monto: true } })
    ])
    const saldoMedio = (Number(ingAgg._sum.monto) || 0) - (Number(egrAgg._sum.monto) || 0)
    const { valido } = validarLimiteEgreso(cajaOrigen, saldoMedio, montoNum)
    if (!valido) {
      throw new AppError(
        mensajeSaldoInsuficiente({ caja: cajaOrigen, disponible: saldoMedio, requerido: montoNum, contexto: `Medio ${medioPagoRecord.nombre}` }),
        400
      )
    }
  }

  // Resolver cuentas contables: usar las enviadas o las de las cajas como fallback
  const cuentaOrigenId = cuentaContableOrigenId
    ? parseInt(cuentaContableOrigenId)
    : cajaOrigen.cuentaContableId
  const cuentaDestinoId = cuentaContableDestinoId
    ? parseInt(cuentaContableDestinoId)
    : cajaDestino.cuentaContableId

  if (!cuentaOrigenId) {
    throw new AppError('La caja origen no tiene cuenta contable configurada', 400)
  }
  if (!cuentaDestinoId) {
    throw new AppError('La caja destino no tiene cuenta contable configurada',400)
  }


  // Cargar códigos de cuentas para el asiento
  const [cuentaOrigen, cuentaDestino] = await Promise.all([
    req.db.cuentaContable.findUnique({ where: { id: cuentaOrigenId } }),
    req.db.cuentaContable.findUnique({ where: { id: cuentaDestinoId } }),
  ])

  // Crear transferencia y movimientos
  const numero = await generarNumeroTransferencia(req.db)
  const numeroMovOrigen = await generarNumeroMovimiento(req.db)
  const numeroMovDestino = `MV-${new Date().getFullYear()}-${String(parseInt(numeroMovOrigen.split('-')[2]) + 1).padStart(5, '0')}`
  const conceptoTexto = concepto || 'Transferencia entre cajas'

  const resultado = await req.db.transferenciaCaja.create({
    data: {
      numero,
      cajaOrigenId: parseInt(cajaOrigenId),
      cajaDestinoId: parseInt(cajaDestinoId),
      fecha: new Date(),
      monto: montoNum,
      concepto: conceptoTexto,
      descripcion: descripcion || null,
      registradoPor: req.admin.id
    },
    include: {
      cajaOrigen: { select: { id: true, codigo: true, nombre: true } },
      cajaDestino: { select: { id: true, codigo: true, nombre: true } }
    }
  })

  await req.db.movimientoCaja.create({
    data: {
      numero: numeroMovOrigen,
      cajaId: parseInt(cajaOrigenId),
      fecha: new Date(),
      tipo: 'EGRESO',
      monto: montoNum,
      medioPagoId,
      cuentaContableId: cuentaOrigenId,
      centroCostoId: centroCostoId ? parseInt(centroCostoId) : null,
      concepto: `Transferencia a ${cajaDestino.nombre}`,
      descripcion: descripcion || null,
      cajaDestinoId: parseInt(cajaDestinoId),
      registradoPor: req.admin.id
    }
  })

  await req.db.movimientoCaja.create({
    data: {
      numero: numeroMovDestino,
      cajaId: parseInt(cajaDestinoId),
      fecha: new Date(),
      tipo: 'INGRESO',
      monto: montoNum,
      medioPagoId,
      cuentaContableId: cuentaDestinoId,
      centroCostoId: centroCostoId ? parseInt(centroCostoId) : null,
      concepto: `Transferencia desde ${cajaOrigen.nombre}`,
      descripcion: descripcion || null,
      registradoPor: req.admin.id
    }
  })

  await req.db.caja.update({
    where: { id: parseInt(cajaOrigenId) },
    data: { saldoActual: { decrement: montoNum } }
  })

  await req.db.caja.update({
    where: { id: parseInt(cajaDestinoId) },
    data: { saldoActual: { increment: montoNum } }
  })

  // Generar asiento contable — D: caja destino (activo aumenta) / H: caja origen (activo disminuye)
  try {
    await crearAsientoTransferencia(req.db, {
      transferencia: resultado,
      cuentaOrigen,
      cuentaDestino,
      centroCostoId: centroCostoId ? parseInt(centroCostoId) : null,
      descripcion: descripcion || null,
      registradoPor: req.admin.id,
    })
  } catch (err) {
    // Revertir todo
    await req.db.transferenciaCaja.update({ where: { id: resultado.id }, data: { estado: 'ANULADO' } })
    await req.db.caja.update({ where: { id: parseInt(cajaOrigenId) }, data: { saldoActual: { increment: montoNum } } })
    await req.db.caja.update({ where: { id: parseInt(cajaDestinoId) }, data: { saldoActual: { decrement: montoNum } } })
    throw new AppError(`No se pudo generar el asiento contable: ${err.message}`, 400)
  }

  res.status(201).json({
    success: true,
    data: { ...resultado, monto: Number(resultado.monto) }
  })
}))

// POST /api/admin/transferencias/:id/anular - Anular transferencia
router.post('/transferencias/:id/anular', checkPermiso('CAJA_ANULAR'), asyncHandler(async (req, res) => {
  const { id } = req.params

  const transferencia = await req.db.transferenciaCaja.findUnique({
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
  const { valido: validoReverso } = validarLimiteEgreso(transferencia.cajaDestino, Number(transferencia.cajaDestino.saldoActual), montoNum)
  if (!validoReverso) {
    throw new AppError(
      mensajeSaldoInsuficiente({ caja: transferencia.cajaDestino, disponible: Number(transferencia.cajaDestino.saldoActual), requerido: montoNum, contexto: 'Reverso transferencia' }),
      400
    )
  }

  // Anular y revertir saldos
  await req.db.transferenciaCaja.update({
    where: { id: parseInt(id) },
    data: { estado: 'ANULADO' }
  })

  await req.db.caja.update({
    where: { id: transferencia.cajaOrigenId },
    data: { saldoActual: { increment: montoNum } }
  })

  await req.db.caja.update({
    where: { id: transferencia.cajaDestinoId },
    data: { saldoActual: { decrement: montoNum } }
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

  const caja = await req.db.caja.findUnique({
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
    // Interpretar fechas como inicio/fin de día en Argentina (UTC-3)
    if (desde) whereMovimientos.fecha.gte = new Date(desde + 'T00:00:00-03:00')
    if (hasta) whereMovimientos.fecha.lte = new Date(hasta + 'T23:59:59.999-03:00')
  }

  // Obtener totales por tipo
  const [ingresos, egresos] = await Promise.all([
    req.db.movimientoCaja.aggregate({
      where: { ...whereMovimientos, tipo: 'INGRESO' },
      _sum: { monto: true },
      _count: true
    }),
    req.db.movimientoCaja.aggregate({
      where: { ...whereMovimientos, tipo: 'EGRESO' },
      _sum: { monto: true },
      _count: true
    })
  ])

  // Ultimos movimientos
  const ultimosMovimientos = await req.db.movimientoCaja.findMany({
    where: whereMovimientos,
    orderBy: { fecha: 'desc' },
    take: 10,
    include: {
      cuentaContable: { select: { id: true, codigo: true, nombre: true } }
    }
  })

  // Agrupado por medio de pago (usa medioPagoId FK)
  const movsPorMedioPago = await req.db.movimientoCaja.groupBy({
    by: ['medioPagoId', 'tipo'],
    where: whereMovimientos,
    _sum: { monto: true },
    _count: true
  })

  // Enriquecer con nombre del medio de pago
  const medioPagoIds = [...new Set(movsPorMedioPago.map(r => r.medioPagoId).filter(Boolean))]
  const mediosPagoList = medioPagoIds.length
    ? await req.db.medioPago.findMany({ where: { id: { in: medioPagoIds } }, select: { id: true, nombre: true, tipo: true } })
    : []
  const mediosPagoById = Object.fromEntries(mediosPagoList.map(m => [m.id, m]))

  const medioPagoMap = {}
  for (const row of movsPorMedioPago) {
    const key = row.medioPagoId ?? 'SIN_ESPECIFICAR'
    if (!medioPagoMap[key]) {
      const mp = row.medioPagoId ? mediosPagoById[row.medioPagoId] : null
      medioPagoMap[key] = {
        medioPagoId: row.medioPagoId,
        medioPago: mp?.nombre ?? null,
        medioPagoTipo: mp?.tipo ?? null,
        ingresos: 0, egresos: 0, cantIngresos: 0, cantEgresos: 0
      }
    }
    if (row.tipo === 'INGRESO') {
      medioPagoMap[key].ingresos = Number(row._sum.monto || 0)
      medioPagoMap[key].cantIngresos = row._count._all
    } else {
      medioPagoMap[key].egresos = Number(row._sum.monto || 0)
      medioPagoMap[key].cantEgresos = row._count._all
    }
  }
  const porMedioPago = Object.values(medioPagoMap)
    .map(m => ({ ...m, neto: m.ingresos - m.egresos }))
    .sort((a, b) => (a.medioPago ?? 'ZZZ').localeCompare(b.medioPago ?? 'ZZZ'))

  // Saldo anterior al período (todo hasta el día antes del desde, ART)
  let saldoAnterior = Number(caja.saldoInicial)
  if (desde) {
    const fechaAntes = new Date(desde + 'T00:00:00-03:00')
    const [ingAnt, egrAnt] = await Promise.all([
      req.db.movimientoCaja.aggregate({
        where: { cajaId: parseInt(id), anulado: false, tipo: 'INGRESO', fecha: { lt: fechaAntes } },
        _sum: { monto: true }
      }),
      req.db.movimientoCaja.aggregate({
        where: { cajaId: parseInt(id), anulado: false, tipo: 'EGRESO', fecha: { lt: fechaAntes } },
        _sum: { monto: true }
      })
    ])
    saldoAnterior += Number(ingAnt._sum.monto || 0) - Number(egrAnt._sum.monto || 0)
  }

  // Saldo real calculado desde todos los movimientos activos (sin filtro de periodo)
  const totalesHistoricos = await req.db.movimientoCaja.groupBy({
    by: ['tipo'],
    where: { cajaId: parseInt(id), anulado: false },
    _sum: { monto: true }
  })
  const ingresosHist = totalesHistoricos.find(r => r.tipo === 'INGRESO')?._sum?.monto || 0
  const egresosHist  = totalesHistoricos.find(r => r.tipo === 'EGRESO')?._sum?.monto  || 0
  const saldoCalculado = Number(caja.saldoInicial) + Number(ingresosHist) - Number(egresosHist)

  const totalIngresos = Number(ingresos._sum.monto || 0)
  const totalEgresos  = Number(egresos._sum.monto || 0)

  res.json({
    success: true,
    data: {
      caja: { ...caja, saldoActual: saldoCalculado },
      periodo: { desde, hasta },
      saldoAnterior,
      ingresos: {
        total: totalIngresos,
        cantidad: ingresos._count
      },
      egresos: {
        total: totalEgresos,
        cantidad: egresos._count
      },
      saldoMovimientos: totalIngresos - totalEgresos,
      saldoFinal: saldoAnterior + totalIngresos - totalEgresos,
      porMedioPago,
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
    if (hasta) where.fecha.lte = new Date(hasta + 'T23:59:59.999Z')
  }

  const skip = (parseInt(page) - 1) * parseInt(limit)

  const [movimientos, total] = await Promise.all([
    req.db.movimientoCaja.findMany({
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
    req.db.movimientoCaja.count({ where })
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
  const cajas = await req.db.caja.findMany({
    where: {
      requiereConciliacion: true,
      activo: true
    }
  })

  const resumenPorCaja = []

  for (const caja of cajas) {
    const pendientes = await req.db.movimientoCaja.aggregate({
      where: {
        cajaId: caja.id,
        conciliado: false,
        anulado: false
      },
      _sum: { monto: true },
      _count: true
    })

    const conciliados = await req.db.movimientoCaja.aggregate({
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
router.post('/pendientes-conciliar/conciliar', checkPermiso('CAJA_MOVIMIENTOS'), asyncHandler(async (req, res) => {
  const { movimientoIds, observacion } = req.body

  if (!movimientoIds || !Array.isArray(movimientoIds) || movimientoIds.length === 0) {
    throw new AppError('Debe seleccionar al menos un movimiento', 400)
  }

  // Verificar que todos los movimientos existen y están pendientes
  const movimientos = await req.db.movimientoCaja.findMany({
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
  await req.db.movimientoCaja.updateMany({
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
router.post('/pendientes-conciliar/transferir', checkPermiso('CAJA_MOVIMIENTOS'), asyncHandler(async (req, res) => {
  const { cajaOrigenId, cajaDestinoId, movimientoIds, concepto } = req.body

  if (!cajaOrigenId || !cajaDestinoId || !movimientoIds || movimientoIds.length === 0) {
    throw new AppError('Debe especificar caja origen, destino y movimientos a transferir', 400)
  }

  // Obtener los movimientos conciliados
  const movimientos = await req.db.movimientoCaja.findMany({
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
    req.db.caja.findUnique({ where: { id: parseInt(cajaOrigenId) } }),
    req.db.caja.findUnique({ where: { id: parseInt(cajaDestinoId) } })
  ])

  if (!cajaOrigen || !cajaDestino) {
    throw new AppError('Caja origen o destino no encontrada', 404)
  }

  {
    const { valido } = validarLimiteEgreso(cajaOrigen, Number(cajaOrigen.saldoActual), montoTotal)
    if (!valido) {
      throw new AppError(
        mensajeSaldoInsuficiente({ caja: cajaOrigen, disponible: Number(cajaOrigen.saldoActual), requerido: montoTotal, contexto: 'Caja origen' }),
        400
      )
    }
  }

  // Crear transferencia
  const numero = await generarNumeroTransferencia(req.db)
  const numeroMovOrigen = await generarNumeroMovimiento(req.db)
  const numeroMovDestino = `MV-${new Date().getFullYear()}-${String(parseInt(numeroMovOrigen.split('-')[2]) + 1).padStart(5, '0')}`

  const resultado = await req.db.transferenciaCaja.create({
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

  await req.db.movimientoCaja.create({
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
      conciliado: true
    }
  })

  await req.db.movimientoCaja.create({
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
      conciliado: !cajaDestino.requiereConciliacion
    }
  })

  await req.db.caja.update({
    where: { id: parseInt(cajaOrigenId) },
    data: { saldoActual: { decrement: montoTotal } }
  })

  await req.db.caja.update({
    where: { id: parseInt(cajaDestinoId) },
    data: { saldoActual: { increment: montoTotal } }
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

// GET /api/admin/movimientos-caja/exportar — Exportar movimientos a Excel
router.get('/movimientos-caja/exportar', authAdmin, asyncHandler(async (req, res) => {
  const { cajaId, tipo, desde, hasta, medioPago } = req.query

  const where = {}
  if (cajaId) where.cajaId = parseInt(cajaId)
  if (tipo) where.tipo = tipo
  if (desde || hasta) {
    where.fecha = {}
    if (desde) where.fecha.gte = new Date(desde)
    if (hasta) where.fecha.lte = new Date(hasta + 'T23:59:59.999Z')
  }
  if (medioPago) where.medioPago = medioPago === 'SIN_ESPECIFICAR' ? null : medioPago

  const movimientos = await req.db.movimientoCaja.findMany({
    where,
    orderBy: { fecha: 'desc' },
    take: 10000,
    include: {
      caja: { select: { codigo: true, nombre: true } },
      pago: { select: { socio: { select: { nroSocio: true, apellidoNombre: true } } } },
    },
  })

  const fmt = (n) => Number(n) || 0
  const rows = movimientos.map(m => ({
    'Fecha': new Date(m.fecha).toLocaleDateString('es-AR'),
    'Número': m.numero || '',
    'Caja': m.caja?.nombre || '',
    'Tipo': m.tipo || '',
    'Concepto': m.concepto || '',
    'Descripción': m.descripcion || '',
    'Medio de Pago': m.medioPago || '',
    'Ingreso': m.tipo === 'INGRESO' ? fmt(m.monto) : '',
    'Egreso': m.tipo === 'EGRESO' ? fmt(m.monto) : '',
    'Monto': fmt(m.monto),
    'Socio': m.pago?.socio?.apellidoNombre || '',
    'Nro. Socio': m.pago?.socio?.nroSocio || '',
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 10 }, { wch: 30 },
    { wch: 30 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 25 }, { wch: 10 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Movimientos')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const fecha = new Date().toISOString().split('T')[0]
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="movimientos_caja_${fecha}.xlsx"`)
  res.send(buffer)
}))

// ---------------------------------------------------------------------------
// Comprobante de movimiento de caja (PDF + email/WhatsApp)
// ---------------------------------------------------------------------------

async function cargarMovimientoComprobante(db, id) {
  return db.movimientoCaja.findUnique({
    where: { id: parseInt(id) },
    include: {
      caja: { select: { nombre: true } },
      medioPagoRel: { select: { id: true, nombre: true } },
      socio: {
        select: {
          id: true, nroSocio: true, apellidoNombre: true, documento: true,
          email: true, celular: true, celularSecundario: true, telefonoFijo: true,
          domicilio: true, ciudad: true, calle: true, codigoPostal: true,
          notifWhatsapp: true,
        }
      },
      entidad: {
        select: {
          id: true, tipo: true, razonSocial: true, nombreFantasia: true, documento: true,
          email: true, telefono: true, direccion: true, ciudad: true,
        }
      },
      items: {
        orderBy: { orden: 'asc' },
        include: { conceptoTesoreria: { select: { nombre: true } } }
      },
      mediosPago: {
        orderBy: { orden: 'asc' },
        include: { medioPago: { select: { nombre: true } } }
      },
      pago: { include: { socio: { select: { id: true, nroSocio: true, apellidoNombre: true } } } },
    }
  })
}

async function obtenerConfigClubMap(db, tenant) {
  const config = await db.configuracion.findMany({
    where: { clave: { in: ['CLUB_NOMBRE', 'CLUB_DIRECCION', 'CLUB_TELEFONO'] } },
    select: { clave: true, valor: true }
  }).catch(() => [])
  const configMap = Object.fromEntries(config.map(c => [c.clave, c.valor]))
  if (tenant?.logoUrl) configMap.CLUB_LOGO_URL = tenant.logoUrl
  return configMap
}

// GET /api/admin/movimientos-caja/:id/comprobante-pdf
router.get('/movimientos-caja/:id/comprobante-pdf', asyncHandler(async (req, res) => {
  const movimiento = await cargarMovimientoComprobante(req.db, req.params.id)
  if (!movimiento) throw new AppError('Movimiento no encontrado', 404, 'NOT_FOUND')

  const admin = await req.db.admin.findUnique({
    where: { id: req.admin.id }, select: { nombre: true }
  }).catch(() => null)

  const configMap = await obtenerConfigClubMap(req.db, req.tenant)
  const pdfBuffer = await generarComprobanteMovimientoPDF(movimiento, admin?.nombre || '', configMap)

  const base = (movimiento.socio?.apellidoNombre || movimiento.entidad?.razonSocial || movimiento.entidad?.nombreFantasia || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_')
  const filename = `comprobante-${movimiento.numero}${base ? '-' + base : ''}.pdf`

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(pdfBuffer)
}))

// POST /api/admin/movimientos-caja/:id/enviar-comprobante
// Body: { canales: ['email'|'whatsapp'], email?: string, telefono?: string }
router.post('/movimientos-caja/:id/enviar-comprobante', asyncHandler(async (req, res) => {
  const { canales = ['email'], email: emailOverride, telefono: telefonoOverride } = req.body

  const movimiento = await cargarMovimientoComprobante(req.db, req.params.id)
  if (!movimiento) throw new AppError('Movimiento no encontrado', 404, 'NOT_FOUND')

  // Generar PDF (si falla, igual seguimos sin adjunto)
  let pdfBuffer = null
  let pdfFilename = `comprobante-${movimiento.numero}.pdf`
  try {
    const [admin, configMap] = await Promise.all([
      req.db.admin.findUnique({ where: { id: req.admin.id }, select: { nombre: true } }).catch(() => null),
      obtenerConfigClubMap(req.db, req.tenant),
    ])
    pdfBuffer = await generarComprobanteMovimientoPDF(movimiento, admin?.nombre || '', configMap)

    const base = (movimiento.socio?.apellidoNombre || movimiento.entidad?.razonSocial || movimiento.entidad?.nombreFantasia || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_')
    pdfFilename = `comprobante-${movimiento.numero}${base ? '-' + base : ''}.pdf`
  } catch (err) {
    console.error('Error generando PDF de comprobante (se enviará sin adjunto):', err.message)
  }

  const resultados = {}

  if (canales.includes('email')) {
    const destino = (emailOverride || movimiento.socio?.email || movimiento.entidad?.email || '').trim()
    if (!destino) {
      resultados.email = { ok: false, mensaje: 'No hay email destino (cargá uno en el modal)' }
    } else {
      try {
        const r = await enviarComprobanteMovimientoEmail({
          movimiento, destinatario: destino, pdfBuffer, pdfFilename, db: req.db
        })
        resultados.email = r?.ok
          ? { ok: true, mensaje: `Comprobante enviado a ${destino}${pdfBuffer ? ' (con PDF adjunto)' : ''}` }
          : { ok: false, mensaje: r?.motivo || 'No se pudo enviar el email' }
      } catch (err) {
        resultados.email = { ok: false, mensaje: err.message }
      }
    }
  }

  if (canales.includes('whatsapp')) {
    const tel = (telefonoOverride
      || movimiento.socio?.celular || movimiento.socio?.celularSecundario || movimiento.socio?.telefonoFijo
      || movimiento.entidad?.telefono || '').trim()
    if (!tel) {
      resultados.whatsapp = { ok: false, mensaje: 'No hay teléfono destino (cargá uno en el modal)' }
    } else {
      try {
        const r = await enviarComprobanteMovimientoWhatsApp({
          movimiento, telefono: tel, pdfBuffer, pdfFilename, db: req.db
        })
        if (r?.enviado) {
          // Si hubo fallback a texto (PDF muy grande), el motivo viene seteado
          const detalle = r.motivo
            ? r.motivo
            : `Mensaje enviado a ${tel}${pdfBuffer ? ' (con PDF adjunto)' : ''}`
          resultados.whatsapp = { ok: true, mensaje: detalle }
        } else {
          resultados.whatsapp = { ok: false, mensaje: r?.motivo || 'No se pudo enviar el mensaje' }
        }
      } catch (err) {
        resultados.whatsapp = { ok: false, mensaje: err.message }
      }
    }
  }

  res.json({ success: true, data: resultados })
}))

export default router
