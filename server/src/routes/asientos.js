import { Router } from 'express'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { authAdmin } from '../middleware/auth.js'

const router = Router()

// ============================================================
// UTILIDADES
// ============================================================

// Generar número de asiento único
async function generarNumeroAsiento(prisma) {
  const anio = new Date().getFullYear()
  const ultimo = await req.db.asiento.findFirst({
    where: { numero: { startsWith: `AST-${anio}` } },
    orderBy: { numero: 'desc' }
  })

  let secuencia = 1
  if (ultimo) {
    const partes = ultimo.numero.split('-')
    secuencia = parseInt(partes[2]) + 1
  }

  return `AST-${anio}-${secuencia.toString().padStart(5, '0')}`
}

// Validar que el asiento está balanceado (DEBE = HABER)
function validarAsientoBalanceado(lineas) {
  const totalDebe = lineas.reduce((sum, l) => sum + Number(l.debe || 0), 0)
  const totalHaber = lineas.reduce((sum, l) => sum + Number(l.haber || 0), 0)

  // Permitir diferencia de centavos por redondeo
  if (Math.abs(totalDebe - totalHaber) > 0.01) {
    throw new AppError(
      `Asiento desbalanceado: Debe=${totalDebe.toFixed(2)}, Haber=${totalHaber.toFixed(2)}`,
      400,
      'ASIENTO_DESBALANCEADO'
    )
  }

  return { totalDebe, totalHaber }
}

// ============================================================
// RUTAS ESPECÍFICAS (deben ir antes de /:id)
// ============================================================

// GET /api/admin/asientos/resumen/balance - Resumen de saldos por cuenta
router.get('/resumen/balance', authAdmin, asyncHandler(async (req, res) => {
  const { fechaHasta } = req.query

  const whereAsiento = {
    estado: 'CONFIRMADO'
  }

  if (fechaHasta) {
    const hasta = new Date(fechaHasta)
    hasta.setHours(23, 59, 59, 999)
    whereAsiento.fecha = { lte: hasta }
  }

  // Obtener todas las cuentas con sus movimientos
  const cuentas = await req.req.db.cuentaContable.findMany({
    where: { activo: true },
    include: {
      asientoLineas: {
        where: {
          asiento: whereAsiento
        },
        select: {
          debe: true,
          haber: true
        }
      }
    },
    orderBy: { codigo: 'asc' }
  })

  // Calcular saldo de cada cuenta
  const cuentasConSaldo = cuentas.map(c => {
    const totalDebe = c.asientoLineas.reduce((sum, l) => sum + Number(l.debe), 0)
    const totalHaber = c.asientoLineas.reduce((sum, l) => sum + Number(l.haber), 0)

    // Saldo según naturaleza de la cuenta
    const esCuentaDeudora = ['ACTIVO', 'EGRESO'].includes(c.tipo)
    const saldo = esCuentaDeudora
      ? totalDebe - totalHaber
      : totalHaber - totalDebe

    return {
      id: c.id,
      codigo: c.codigo,
      nombre: c.nombre,
      tipo: c.tipo,
      nivel: c.nivel,
      esImputable: c.esImputable,
      totalDebe,
      totalHaber,
      saldo
    }
  }).filter(c => c.totalDebe > 0 || c.totalHaber > 0 || c.saldo !== 0)

  // Agrupar por tipo
  const resumen = {
    ACTIVO: cuentasConSaldo.filter(c => c.tipo === 'ACTIVO'),
    PASIVO: cuentasConSaldo.filter(c => c.tipo === 'PASIVO'),
    PATRIMONIO: cuentasConSaldo.filter(c => c.tipo === 'PATRIMONIO'),
    INGRESO: cuentasConSaldo.filter(c => c.tipo === 'INGRESO'),
    EGRESO: cuentasConSaldo.filter(c => c.tipo === 'EGRESO')
  }

  // Calcular totales generales
  const totales = {
    totalDebe: cuentasConSaldo.reduce((sum, c) => sum + c.totalDebe, 0),
    totalHaber: cuentasConSaldo.reduce((sum, c) => sum + c.totalHaber, 0),
    activos: resumen.ACTIVO.reduce((sum, c) => sum + c.saldo, 0),
    pasivos: resumen.PASIVO.reduce((sum, c) => sum + c.saldo, 0),
    patrimonio: resumen.PATRIMONIO.reduce((sum, c) => sum + c.saldo, 0),
    ingresos: resumen.INGRESO.reduce((sum, c) => sum + c.saldo, 0),
    egresos: resumen.EGRESO.reduce((sum, c) => sum + c.saldo, 0)
  }

  totales.resultado = totales.ingresos - totales.egresos

  res.json({
    success: true,
    data: {
      cuentas: resumen,
      totales
    }
  })
}))

// GET /api/admin/asientos/libro-mayor/:cuentaId
router.get('/libro-mayor/:cuentaId', authAdmin, asyncHandler(async (req, res) => {
  const { cuentaId } = req.params
  const { fechaDesde, fechaHasta, page = 1, limit = 100 } = req.query

  const cuenta = await req.req.db.cuentaContable.findUnique({
    where: { id: parseInt(cuentaId) }
  })

  if (!cuenta) {
    throw new AppError('Cuenta no encontrada', 404, 'NOT_FOUND')
  }

  const whereAsiento = {
    estado: 'CONFIRMADO'
  }

  if (fechaDesde || fechaHasta) {
    whereAsiento.fecha = {}
    if (fechaDesde) whereAsiento.fecha.gte = new Date(fechaDesde)
    if (fechaHasta) {
      const hasta = new Date(fechaHasta)
      hasta.setHours(23, 59, 59, 999)
      whereAsiento.fecha.lte = hasta
    }
  }

  const skip = (parseInt(page) - 1) * parseInt(limit)

  const [lineas, total] = await Promise.all([
    req.req.db.asientoLinea.findMany({
      where: {
        cuentaContableId: parseInt(cuentaId),
        asiento: whereAsiento
      },
      include: {
        asiento: {
          select: { id: true, numero: true, fecha: true, concepto: true }
        }
      },
      orderBy: {
        asiento: { fecha: 'asc' }
      },
      skip,
      take: parseInt(limit)
    }),
    req.req.db.asientoLinea.count({
      where: {
        cuentaContableId: parseInt(cuentaId),
        asiento: whereAsiento
      }
    })
  ])

  // Calcular saldo acumulado
  let saldoAcumulado = 0
  const movimientos = lineas.map(l => {
    // Para ACTIVO y EGRESO: DEBE aumenta, HABER disminuye
    // Para PASIVO, PATRIMONIO e INGRESO: HABER aumenta, DEBE disminuye
    const esCuentaDeudora = ['ACTIVO', 'EGRESO'].includes(cuenta.tipo)

    if (esCuentaDeudora) {
      saldoAcumulado += Number(l.debe) - Number(l.haber)
    } else {
      saldoAcumulado += Number(l.haber) - Number(l.debe)
    }

    return {
      id: l.id,
      asientoId: l.asiento.id,
      asientoNumero: l.asiento.numero,
      asientoConcepto: l.asiento.concepto,
      fecha: l.asiento.fecha,
      descripcion: l.descripcion,
      debe: l.debe,
      haber: l.haber,
      saldoAcumulado
    }
  })

  // Totales
  const totales = await req.req.db.asientoLinea.aggregate({
    where: {
      cuentaContableId: parseInt(cuentaId),
      asiento: whereAsiento
    },
    _sum: {
      debe: true,
      haber: true
    }
  })

  const totalDebe = Number(totales._sum.debe) || 0
  const totalHaber = Number(totales._sum.haber) || 0
  const esCuentaDeudora = ['ACTIVO', 'EGRESO'].includes(cuenta.tipo)
  const saldo = esCuentaDeudora ? totalDebe - totalHaber : totalHaber - totalDebe

  res.json({
    success: true,
    data: {
      cuenta,
      movimientos,
      resumen: {
        totalDebe,
        totalHaber,
        saldo
      }
    },
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit))
    }
  })
}))

// ============================================================
// CRUD DE ASIENTOS
// ============================================================

// GET /api/admin/asientos - Listar asientos (Libro Diario)
router.get('/', authAdmin, asyncHandler(async (req, res) => {
  const {
    fechaDesde,
    fechaHasta,
    estado,
    tipoOrigen,
    cuentaContableId,
    page = 1,
    limit = 50
  } = req.query

  const where = {}

  // Filtro por fecha
  if (fechaDesde || fechaHasta) {
    where.fecha = {}
    if (fechaDesde) where.fecha.gte = new Date(fechaDesde)
    if (fechaHasta) {
      const hasta = new Date(fechaHasta)
      hasta.setHours(23, 59, 59, 999)
      where.fecha.lte = hasta
    }
  }

  // Filtro por estado
  if (estado) {
    where.estado = estado
  }

  // Filtro por tipo de origen
  if (tipoOrigen) {
    where.tipoOrigen = tipoOrigen
  }

  // Filtro por cuenta contable (en alguna línea)
  if (cuentaContableId) {
    where.lineas = {
      some: { cuentaContableId: parseInt(cuentaContableId) }
    }
  }

  const skip = (parseInt(page) - 1) * parseInt(limit)

  const [asientos, total] = await Promise.all([
    req.req.db.asiento.findMany({
      where,
      include: {
        lineas: {
          include: {
            cuentaContable: {
              select: { codigo: true, nombre: true }
            }
          },
          orderBy: { orden: 'asc' }
        },
        registrador: {
          select: { nombre: true, apellido: true }
        }
      },
      orderBy: { fecha: 'desc' },
      skip,
      take: parseInt(limit)
    }),
    req.req.db.asiento.count({ where })
  ])

  // Calcular totales para cada asiento
  const asientosConTotales = asientos.map(a => ({
    ...a,
    totalDebe: a.lineas.reduce((sum, l) => sum + Number(l.debe), 0),
    totalHaber: a.lineas.reduce((sum, l) => sum + Number(l.haber), 0)
  }))

  res.json({
    success: true,
    data: asientosConTotales,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit))
    }
  })
}))

// GET /api/admin/asientos/:id - Detalle de asiento
router.get('/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  // Validar que id sea un número
  const asientoId = parseInt(id)
  if (isNaN(asientoId)) {
    throw new AppError('ID de asiento inválido', 400, 'INVALID_ID')
  }

  const asiento = await req.req.db.asiento.findUnique({
    where: { id: asientoId },
    include: {
      lineas: {
        include: {
          cuentaContable: {
            select: { id: true, codigo: true, nombre: true, tipo: true }
          }
        },
        orderBy: { orden: 'asc' }
      },
      registrador: {
        select: { nombre: true, apellido: true, email: true }
      },
      anulador: {
        select: { nombre: true, apellido: true }
      }
    }
  })

  if (!asiento) {
    throw new AppError('Asiento no encontrado', 404, 'NOT_FOUND')
  }

  // Calcular totales
  const totalDebe = asiento.lineas.reduce((sum, l) => sum + Number(l.debe), 0)
  const totalHaber = asiento.lineas.reduce((sum, l) => sum + Number(l.haber), 0)

  res.json({
    success: true,
    data: {
      ...asiento,
      totalDebe,
      totalHaber
    }
  })
}))

// POST /api/admin/asientos - Crear asiento manual
router.post('/', authAdmin, asyncHandler(async (req, res) => {
  const { fecha, concepto, lineas } = req.body

  // Validaciones
  if (!concepto) {
    throw new AppError('El concepto es requerido', 400, 'VALIDATION_ERROR')
  }
  if (!lineas || lineas.length < 2) {
    throw new AppError('Se requieren al menos 2 líneas', 400, 'VALIDATION_ERROR')
  }

  // Validar balance
  validarAsientoBalanceado(lineas)

  // Validar que todas las cuentas existen y son imputables
  const cuentaIds = [...new Set(lineas.map(l => l.cuentaContableId))]
  const cuentas = await req.req.db.cuentaContable.findMany({
    where: {
      id: { in: cuentaIds },
      activo: true,
      esImputable: true
    }
  })

  if (cuentas.length !== cuentaIds.length) {
    throw new AppError(
      'Algunas cuentas no existen, no están activas o no son imputables',
      400,
      'CUENTA_INVALIDA'
    )
  }

  // Crear asiento
  const numero = await generarNumeroAsiento(req.prisma)

  const asiento = await req.req.db.asiento.create({
    data: {
      numero,
      fecha: fecha ? new Date(fecha) : new Date(),
      concepto,
      tipoOrigen: 'MANUAL',
      estado: 'CONFIRMADO',
      registradoPor: req.admin.id,
      lineas: {
        create: lineas.map((l, idx) => ({
          cuentaContableId: l.cuentaContableId,
          descripcion: l.descripcion || null,
          debe: l.debe || 0,
          haber: l.haber || 0,
          orden: idx
        }))
      }
    },
    include: {
      lineas: {
        include: {
          cuentaContable: {
            select: { codigo: true, nombre: true }
          }
        }
      }
    }
  })

  res.status(201).json({
    success: true,
    data: asiento
  })
}))

// PUT /api/admin/asientos/:id - Actualizar asiento (solo borrador)
router.put('/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { fecha, concepto, lineas } = req.body

  const asiento = await req.req.db.asiento.findUnique({
    where: { id: parseInt(id) }
  })

  if (!asiento) {
    throw new AppError('Asiento no encontrado', 404, 'NOT_FOUND')
  }

  if (asiento.estado !== 'BORRADOR') {
    throw new AppError('Solo se pueden modificar asientos en borrador', 400, 'ESTADO_INVALIDO')
  }

  // Validar balance
  if (lineas) {
    validarAsientoBalanceado(lineas)
  }

  // Actualizar asiento
  const asientoActualizado = await req.prisma.$transaction(async (tx) => {
    // Si hay líneas nuevas, eliminar las anteriores y crear las nuevas
    if (lineas) {
      await tx.asientoLinea.deleteMany({
        where: { asientoId: parseInt(id) }
      })

      await tx.asientoLinea.createMany({
        data: lineas.map((l, idx) => ({
          asientoId: parseInt(id),
          cuentaContableId: l.cuentaContableId,
          descripcion: l.descripcion || null,
          debe: l.debe || 0,
          haber: l.haber || 0,
          orden: idx
        }))
      })
    }

    return tx.asiento.update({
      where: { id: parseInt(id) },
      data: {
        fecha: fecha ? new Date(fecha) : undefined,
        concepto: concepto || undefined
      },
      include: {
        lineas: {
          include: {
            cuentaContable: {
              select: { codigo: true, nombre: true }
            }
          }
        }
      }
    })
  })

  res.json({
    success: true,
    data: asientoActualizado
  })
}))

// POST /api/admin/asientos/:id/anular - Anular asiento
router.post('/:id/anular', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { motivo } = req.body

  const asiento = await req.req.db.asiento.findUnique({
    where: { id: parseInt(id) }
  })

  if (!asiento) {
    throw new AppError('Asiento no encontrado', 404, 'NOT_FOUND')
  }

  if (asiento.estado === 'ANULADO') {
    throw new AppError('El asiento ya está anulado', 400, 'YA_ANULADO')
  }

  const asientoAnulado = await req.req.db.asiento.update({
    where: { id: parseInt(id) },
    data: {
      estado: 'ANULADO',
      fechaAnulacion: new Date(),
      motivoAnulacion: motivo || 'Anulado por usuario',
      anuladoPor: req.admin.id
    }
  })

  res.json({
    success: true,
    data: asientoAnulado
  })
}))

// DELETE /api/admin/asientos/:id - Eliminar asiento (solo borrador)
router.delete('/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const asiento = await req.req.db.asiento.findUnique({
    where: { id: parseInt(id) }
  })

  if (!asiento) {
    throw new AppError('Asiento no encontrado', 404, 'NOT_FOUND')
  }

  if (asiento.estado !== 'BORRADOR') {
    throw new AppError('Solo se pueden eliminar asientos en borrador', 400, 'ESTADO_INVALIDO')
  }

  await req.req.db.asiento.delete({
    where: { id: parseInt(id) }
  })

  res.json({
    success: true,
    message: 'Asiento eliminado'
  })
}))

// ============================================================
// GENERADOR DE ASIENTOS AUTOMÁTICOS
// ============================================================

// Esta función puede ser llamada desde otros módulos para generar asientos
export async function generarAsientoAutomatico(prisma, {
  fecha,
  concepto,
  tipoOrigen,
  origenId,
  lineas,
  registradoPor
}) {
  // Validar balance
  validarAsientoBalanceado(lineas)

  const numero = await generarNumeroAsiento(prisma)

  const asiento = await req.db.asiento.create({
    data: {
      numero,
      fecha: fecha || new Date(),
      concepto,
      tipoOrigen,
      origenId,
      estado: 'CONFIRMADO',
      registradoPor,
      lineas: {
        create: lineas.map((l, idx) => ({
          cuentaContableId: l.cuentaContableId,
          descripcion: l.descripcion || null,
          debe: l.debe || 0,
          haber: l.haber || 0,
          orden: idx
        }))
      }
    }
  })

  return asiento
}

export default router
