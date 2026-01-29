/**
 * Rutas para Cierre de Caja Diario
 * - Crear cierres de caja
 * - Listar histórico
 * - Ver detalle
 * - Firmar cierres
 */

import express from 'express'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { authAdmin } from '../middleware/auth.js'

const router = express.Router()

// Todos los endpoints requieren autenticación de admin
router.use(authAdmin)

/**
 * GET /api/admin/cierres-caja/pendientes
 * Obtener cajas que aún no han sido cerradas hoy
 */
router.get('/pendientes', asyncHandler(async (req, res) => {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const mañana = new Date(hoy)
  mañana.setDate(mañana.getDate() + 1)

  // Obtener todas las cajas activas de tipo EFECTIVO
  const cajasEfectivo = await req.prisma.caja.findMany({
    where: {
      activo: true,
      tipo: 'EFECTIVO'
    },
    orderBy: { nombre: 'asc' }
  })

  // Para cada caja, verificar si ya fue cerrada hoy
  const cajasPendientes = []

  for (const caja of cajasEfectivo) {
    const cierreHoy = await req.prisma.cierreCaja.findFirst({
      where: {
        cajaId: caja.id,
        fecha: {
          gte: hoy,
          lt: mañana
        }
      }
    })

    if (!cierreHoy) {
      // Calcular movimientos del día
      const movimientosHoy = await req.prisma.movimientoCaja.findMany({
        where: {
          cajaId: caja.id,
          fecha: {
            gte: hoy,
            lt: mañana
          }
        }
      })

      const totalIngresos = movimientosHoy
        .filter(m => m.tipo === 'INGRESO')
        .reduce((sum, m) => sum + Number(m.monto), 0)

      const totalEgresos = movimientosHoy
        .filter(m => m.tipo === 'EGRESO')
        .reduce((sum, m) => sum + Number(m.monto), 0)

      cajasPendientes.push({
        ...caja,
        cantidadMovimientos: movimientosHoy.length,
        totalIngresos,
        totalEgresos,
        saldoEsperado: Number(caja.saldoActual)
      })
    }
  }

  res.json({
    success: true,
    data: cajasPendientes
  })
}))

/**
 * POST /api/admin/cierres-caja
 * Crear un nuevo cierre de caja
 */
router.post('/', asyncHandler(async (req, res) => {
  const {
    cajaId,
    fecha,
    saldoReal,
    observaciones
  } = req.body

  // Validaciones
  if (!cajaId || saldoReal === undefined) {
    throw new AppError('Caja y saldo real son obligatorios', 400)
  }

  // Verificar que la caja existe y está activa
  const caja = await req.prisma.caja.findUnique({
    where: { id: parseInt(cajaId) }
  })

  if (!caja) {
    throw new AppError('Caja no encontrada', 404)
  }

  if (!caja.activo) {
    throw new AppError('La caja no está activa', 400)
  }

  // Fecha del cierre (si no se especifica, usar hoy)
  const fechaCierre = fecha ? new Date(fecha) : new Date()
  fechaCierre.setHours(0, 0, 0, 0)

  const mañana = new Date(fechaCierre)
  mañana.setDate(mañana.getDate() + 1)

  // Verificar que no exista ya un cierre para esta caja en esta fecha
  const cierreExistente = await req.prisma.cierreCaja.findFirst({
    where: {
      cajaId: parseInt(cajaId),
      fecha: {
        gte: fechaCierre,
        lt: mañana
      }
    }
  })

  if (cierreExistente) {
    throw new AppError('Ya existe un cierre para esta caja en la fecha especificada', 400)
  }

  // Calcular movimientos del día
  const movimientosDelDia = await req.prisma.movimientoCaja.findMany({
    where: {
      cajaId: parseInt(cajaId),
      fecha: {
        gte: fechaCierre,
        lt: mañana
      }
    },
    orderBy: { fecha: 'asc' }
  })

  const totalIngresos = movimientosDelDia
    .filter(m => m.tipo === 'INGRESO')
    .reduce((sum, m) => sum + Number(m.monto), 0)

  const totalEgresos = movimientosDelDia
    .filter(m => m.tipo === 'EGRESO')
    .reduce((sum, m) => sum + Number(m.monto), 0)

  const saldoSistema = Number(caja.saldoActual)
  const saldoRealDecimal = parseFloat(saldoReal)
  const diferencia = saldoRealDecimal - saldoSistema

  // Crear el cierre
  const cierre = await req.prisma.cierreCaja.create({
    data: {
      cajaId: parseInt(cajaId),
      fecha: fechaCierre,
      saldoSistema: saldoSistema,
      saldoReal: saldoRealDecimal,
      diferencia: diferencia,
      totalIngresos: totalIngresos,
      totalEgresos: totalEgresos,
      cantidadMovimientos: movimientosDelDia.length,
      observaciones: observaciones || null,
      cerradoPor: req.admin.id,
      fechaCierre: new Date()
    },
    include: {
      caja: true,
      adminCerrado: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
          email: true
        }
      }
    }
  })

  res.status(201).json({
    success: true,
    message: 'Cierre de caja registrado exitosamente',
    data: cierre
  })
}))

/**
 * GET /api/admin/cierres-caja
 * Listar histórico de cierres con filtros
 */
router.get('/', asyncHandler(async (req, res) => {
  const {
    cajaId,
    fechaDesde,
    fechaHasta,
    page = 1,
    limit = 50
  } = req.query

  const where = {}

  if (cajaId) {
    where.cajaId = parseInt(cajaId)
  }

  if (fechaDesde || fechaHasta) {
    where.fecha = {}
    if (fechaDesde) {
      where.fecha.gte = new Date(fechaDesde)
    }
    if (fechaHasta) {
      const hasta = new Date(fechaHasta)
      hasta.setHours(23, 59, 59, 999)
      where.fecha.lte = hasta
    }
  }

  const skip = (parseInt(page) - 1) * parseInt(limit)

  const [cierres, total] = await Promise.all([
    req.prisma.cierreCaja.findMany({
      where,
      include: {
        caja: true,
        adminCerrado: {
          select: {
            id: true,
            nombre: true,
            apellido: true
          }
        },
        adminFirmado: {
          select: {
            id: true,
            nombre: true,
            apellido: true
          }
        }
      },
      orderBy: { fecha: 'desc' },
      skip,
      take: parseInt(limit)
    }),
    req.prisma.cierreCaja.count({ where })
  ])

  res.json({
    success: true,
    data: cierres,
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    totalPages: Math.ceil(total / parseInt(limit))
  })
}))

/**
 * GET /api/admin/cierres-caja/:id
 * Ver detalle de un cierre específico
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params

  const cierre = await req.prisma.cierreCaja.findUnique({
    where: { id: parseInt(id) },
    include: {
      caja: true,
      adminCerrado: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
          email: true
        }
      },
      adminFirmado: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
          email: true
        }
      }
    }
  })

  if (!cierre) {
    throw new AppError('Cierre no encontrado', 404)
  }

  // Obtener movimientos del día
  const fechaCierre = new Date(cierre.fecha)
  fechaCierre.setHours(0, 0, 0, 0)

  const mañana = new Date(fechaCierre)
  mañana.setDate(mañana.getDate() + 1)

  const movimientos = await req.prisma.movimientoCaja.findMany({
    where: {
      cajaId: cierre.cajaId,
      fecha: {
        gte: fechaCierre,
        lt: mañana
      }
    },
    include: {
      concepto: true,
      admin: {
        select: {
          id: true,
          nombre: true,
          apellido: true
        }
      }
    },
    orderBy: { fecha: 'asc' }
  })

  res.json({
    success: true,
    data: {
      ...cierre,
      movimientos
    }
  })
}))

/**
 * POST /api/admin/cierres-caja/:id/firmar
 * Firmar/aprobar un cierre de caja
 */
router.post('/:id/firmar', asyncHandler(async (req, res) => {
  const { id } = req.params

  const cierre = await req.prisma.cierreCaja.findUnique({
    where: { id: parseInt(id) }
  })

  if (!cierre) {
    throw new AppError('Cierre no encontrado', 404)
  }

  if (cierre.firmadoPor) {
    throw new AppError('Este cierre ya fue firmado', 400)
  }

  // No permitir que la misma persona que cerró también firme
  if (cierre.cerradoPor === req.admin.id) {
    throw new AppError('No puede firmar un cierre realizado por usted mismo', 400)
  }

  const cierreActualizado = await req.prisma.cierreCaja.update({
    where: { id: parseInt(id) },
    data: {
      firmadoPor: req.admin.id,
      fechaFirma: new Date()
    },
    include: {
      caja: true,
      adminCerrado: {
        select: {
          id: true,
          nombre: true,
          apellido: true
        }
      },
      adminFirmado: {
        select: {
          id: true,
          nombre: true,
          apellido: true
        }
      }
    }
  })

  res.json({
    success: true,
    message: 'Cierre firmado exitosamente',
    data: cierreActualizado
  })
}))

/**
 * GET /api/admin/cierres-caja/resumen/estadisticas
 * Obtener estadísticas generales de cierres
 */
router.get('/resumen/estadisticas', asyncHandler(async (req, res) => {
  const { fechaDesde, fechaHasta } = req.query

  const where = {}

  if (fechaDesde || fechaHasta) {
    where.fecha = {}
    if (fechaDesde) {
      where.fecha.gte = new Date(fechaDesde)
    }
    if (fechaHasta) {
      const hasta = new Date(fechaHasta)
      hasta.setHours(23, 59, 59, 999)
      where.fecha.lte = hasta
    }
  }

  const cierres = await req.prisma.cierreCaja.findMany({
    where,
    select: {
      diferencia: true,
      totalIngresos: true,
      totalEgresos: true,
      firmadoPor: true
    }
  })

  const totalCierres = cierres.length
  const cierresFirmados = cierres.filter(c => c.firmadoPor !== null).length
  const cierresPendientesFirma = totalCierres - cierresFirmados

  const totalDiferencias = cierres.reduce((sum, c) => sum + Number(c.diferencia), 0)
  const diferenciasPositivas = cierres.filter(c => Number(c.diferencia) > 0).length
  const diferenciasNegativas = cierres.filter(c => Number(c.diferencia) < 0).length
  const diferenciasCero = cierres.filter(c => Number(c.diferencia) === 0).length

  const sumaIngresos = cierres.reduce((sum, c) => sum + Number(c.totalIngresos), 0)
  const sumaEgresos = cierres.reduce((sum, c) => sum + Number(c.totalEgresos), 0)

  res.json({
    success: true,
    data: {
      totalCierres,
      cierresFirmados,
      cierresPendientesFirma,
      totalDiferencias,
      diferenciasPositivas,
      diferenciasNegativas,
      diferenciasCero,
      sumaIngresos,
      sumaEgresos
    }
  })
}))

export default router
