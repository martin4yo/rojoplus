import { Router } from 'express'
import { asyncHandler, AppError } from '../../middleware/errorHandler.js'
import { authAdmin } from '../../middleware/auth.js'

const router = Router()

// ============================================================================
// CENTROS DE COSTO
// ============================================================================

// GET /api/admin/centros-costo - Listar centros de costo
router.get('/centros-costo', authAdmin, asyncHandler(async (req, res) => {
  const { activo, tipo } = req.query

  const where = {}
  if (activo !== undefined) where.activo = activo === 'true'
  if (tipo) where.tipo = tipo

  const centros = await req.prisma.centroCosto.findMany({
    where,
    orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    include: {
      _count: {
        select: {
          actividades: true,
          movimientosCaja: true,
          movimientosContables: true,
        },
      },
    },
  })

  res.json({
    success: true,
    data: centros,
  })
}))

// GET /api/admin/centros-costo/:id - Obtener detalle de centro de costo
router.get('/centros-costo/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const centro = await req.prisma.centroCosto.findUnique({
    where: { id: parseInt(id) },
    include: {
      actividades: {
        select: { id: true, codigo: true, nombre: true, activo: true },
      },
      _count: {
        select: {
          movimientosCaja: true,
          movimientosContables: true,
          asientoLineas: true,
        },
      },
    },
  })

  if (!centro) {
    throw new AppError('Centro de costo no encontrado', 404, 'NOT_FOUND')
  }

  res.json({
    success: true,
    data: centro,
  })
}))

// POST /api/admin/centros-costo - Crear centro de costo
router.post('/centros-costo', authAdmin, asyncHandler(async (req, res) => {
  const { codigo, nombre, descripcion, tipo, orden } = req.body

  if (!codigo || !nombre || !tipo) {
    throw new AppError('Código, nombre y tipo son requeridos', 400, 'VALIDATION_ERROR')
  }

  // Validar tipo
  if (!['OPERATIVO', 'ADMINISTRATIVO'].includes(tipo)) {
    throw new AppError('Tipo debe ser OPERATIVO o ADMINISTRATIVO', 400, 'VALIDATION_ERROR')
  }

  // Verificar código único
  const existente = await req.prisma.centroCosto.findUnique({
    where: { codigo },
  })

  if (existente) {
    throw new AppError('Ya existe un centro de costo con ese código', 400, 'DUPLICATE_CODE')
  }

  const centro = await req.prisma.centroCosto.create({
    data: {
      codigo,
      nombre,
      descripcion,
      tipo,
      orden: orden || 0,
      activo: true,
    },
  })

  res.json({
    success: true,
    data: centro,
  })
}))

// PUT /api/admin/centros-costo/:id - Actualizar centro de costo
router.put('/centros-costo/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { codigo, nombre, descripcion, tipo, activo, orden } = req.body

  const centroExistente = await req.prisma.centroCosto.findUnique({
    where: { id: parseInt(id) },
  })

  if (!centroExistente) {
    throw new AppError('Centro de costo no encontrado', 404, 'NOT_FOUND')
  }

  // Si se cambió el código, verificar que no exista otro con ese código
  if (codigo && codigo !== centroExistente.codigo) {
    const codigoExistente = await req.prisma.centroCosto.findUnique({
      where: { codigo },
    })

    if (codigoExistente) {
      throw new AppError('Ya existe un centro de costo con ese código', 400, 'DUPLICATE_CODE')
    }
  }

  // Validar tipo si se proporciona
  if (tipo && !['OPERATIVO', 'ADMINISTRATIVO'].includes(tipo)) {
    throw new AppError('Tipo debe ser OPERATIVO o ADMINISTRATIVO', 400, 'VALIDATION_ERROR')
  }

  const centro = await req.prisma.centroCosto.update({
    where: { id: parseInt(id) },
    data: {
      ...(codigo && { codigo }),
      ...(nombre && { nombre }),
      ...(descripcion !== undefined && { descripcion }),
      ...(tipo && { tipo }),
      ...(activo !== undefined && { activo }),
      ...(orden !== undefined && { orden }),
    },
  })

  res.json({
    success: true,
    data: centro,
  })
}))

// DELETE /api/admin/centros-costo/:id - Desactivar centro de costo
router.delete('/centros-costo/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const centro = await req.prisma.centroCosto.findUnique({
    where: { id: parseInt(id) },
    include: {
      _count: {
        select: {
          actividades: true,
          movimientosCaja: true,
          movimientosContables: true,
        },
      },
    },
  })

  if (!centro) {
    throw new AppError('Centro de costo no encontrado', 404, 'NOT_FOUND')
  }

  // No permitir eliminar si tiene movimientos o actividades asociadas
  if (
    centro._count.movimientosCaja > 0 ||
    centro._count.movimientosContables > 0 ||
    centro._count.actividades > 0
  ) {
    // En lugar de eliminar, desactivar
    const centroDesactivado = await req.prisma.centroCosto.update({
      where: { id: parseInt(id) },
      data: { activo: false },
    })

    res.json({
      success: true,
      message: 'Centro de costo desactivado (tiene movimientos o actividades asociadas)',
      data: centroDesactivado,
    })
  } else {
    // Si no tiene nada asociado, se puede eliminar
    await req.prisma.centroCosto.delete({
      where: { id: parseInt(id) },
    })

    res.json({
      success: true,
      message: 'Centro de costo eliminado',
    })
  }
}))

// GET /api/admin/centros-costo/:id/reporte - Reporte de ingresos/egresos por centro
router.get('/centros-costo/:id/reporte', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { fechaDesde, fechaHasta } = req.query

  const centro = await req.prisma.centroCosto.findUnique({
    where: { id: parseInt(id) },
  })

  if (!centro) {
    throw new AppError('Centro de costo no encontrado', 404, 'NOT_FOUND')
  }

  // Construir where para filtros de fecha
  const whereMovCaja = { centroCostoId: parseInt(id), anulado: false }
  const whereMovContable = { centroCostoId: parseInt(id), estado: { not: 'ANULADO' } }

  if (fechaDesde) {
    whereMovCaja.fecha = { ...whereMovCaja.fecha, gte: new Date(fechaDesde) }
    whereMovContable.fecha = { ...whereMovContable.fecha, gte: new Date(fechaDesde) }
  }
  if (fechaHasta) {
    whereMovCaja.fecha = { ...whereMovCaja.fecha, lte: new Date(fechaHasta) }
    whereMovContable.fecha = { ...whereMovContable.fecha, lte: new Date(fechaHasta) }
  }

  // Obtener movimientos de caja por tipo
  const [ingresosCaja, egresosCaja] = await Promise.all([
    req.prisma.movimientoCaja.aggregate({
      where: { ...whereMovCaja, tipo: 'INGRESO' },
      _sum: { monto: true },
      _count: true,
    }),
    req.prisma.movimientoCaja.aggregate({
      where: { ...whereMovCaja, tipo: 'EGRESO' },
      _sum: { monto: true },
      _count: true,
    }),
  ])

  // Obtener movimientos contables
  const movimientosContables = await req.prisma.movimientoContable.findMany({
    where: whereMovContable,
    include: {
      concepto: true,
      entidad: true,
      socio: { select: { nroSocio: true, apellidoNombre: true } },
    },
  })

  // Clasificar movimientos contables por tipo
  const ingresosContables = movimientosContables.filter(m =>
    ['FACTURA_VENTA', 'RECIBO_COBRO', 'NOTA_CREDITO_CLIENTE'].includes(m.tipo)
  )
  const egresosContables = movimientosContables.filter(m =>
    ['FACTURA_COMPRA', 'ORDEN_PAGO', 'PAGO', 'NOTA_CREDITO_PROVEEDOR'].includes(m.tipo)
  )

  const totalIngresosCaja = parseFloat(ingresosCaja._sum.monto || 0)
  const totalEgresosCaja = parseFloat(egresosCaja._sum.monto || 0)

  const totalIngresosContables = ingresosContables.reduce((sum, m) => sum + parseFloat(m.montoTotal), 0)
  const totalEgresosContables = egresosContables.reduce((sum, m) => sum + parseFloat(m.montoTotal), 0)

  const totalIngresos = totalIngresosCaja + totalIngresosContables
  const totalEgresos = totalEgresosCaja + totalEgresosContables
  const resultado = totalIngresos - totalEgresos

  res.json({
    success: true,
    data: {
      centro,
      periodo: {
        desde: fechaDesde || null,
        hasta: fechaHasta || null,
      },
      resumen: {
        ingresos: {
          caja: totalIngresosCaja,
          contables: totalIngresosContables,
          total: totalIngresos,
          cantidad: ingresosCaja._count + ingresosContables.length,
        },
        egresos: {
          caja: totalEgresosCaja,
          contables: totalEgresosContables,
          total: totalEgresos,
          cantidad: egresosCaja._count + egresosContables.length,
        },
        resultado: {
          monto: resultado,
          tipo: resultado >= 0 ? 'SUPERAVIT' : 'DEFICIT',
        },
      },
      detalles: {
        ingresosContables: ingresosContables.map(m => ({
          id: m.id,
          numero: m.numero,
          tipo: m.tipo,
          fecha: m.fecha,
          monto: m.montoTotal,
          concepto: m.concepto?.nombre,
          referencia: m.entidadId
            ? `${m.entidad?.razonSocial}`
            : m.socioId
            ? `Socio ${m.socio?.nroSocio} - ${m.socio?.apellidoNombre}`
            : null,
        })),
        egresosContables: egresosContables.map(m => ({
          id: m.id,
          numero: m.numero,
          tipo: m.tipo,
          fecha: m.fecha,
          monto: m.montoTotal,
          concepto: m.concepto?.nombre,
          referencia: m.entidadId
            ? `${m.entidad?.razonSocial}`
            : m.socioId
            ? `Socio ${m.socio?.nroSocio} - ${m.socio?.apellidoNombre}`
            : null,
        })),
      },
    },
  })
}))

// GET /api/admin/centros-costo/reporte-comparativo - Reporte comparativo de todos los centros
router.get('/centros-costo-reporte-comparativo', authAdmin, asyncHandler(async (req, res) => {
  const { fechaDesde, fechaHasta } = req.query

  const centros = await req.prisma.centroCosto.findMany({
    where: { activo: true },
    orderBy: [{ tipo: 'asc' }, { orden: 'asc' }],
  })

  // Construir where para filtros de fecha
  let whereMovCaja = { anulado: false }
  let whereMovContable = { estado: { not: 'ANULADO' } }

  if (fechaDesde) {
    whereMovCaja = { ...whereMovCaja, fecha: { gte: new Date(fechaDesde) } }
    whereMovContable = { ...whereMovContable, fecha: { gte: new Date(fechaDesde) } }
  }
  if (fechaHasta) {
    whereMovCaja = {
      ...whereMovCaja,
      fecha: { ...whereMovCaja.fecha, lte: new Date(fechaHasta) },
    }
    whereMovContable = {
      ...whereMovContable,
      fecha: { ...whereMovContable.fecha, lte: new Date(fechaHasta) },
    }
  }

  // Obtener datos para cada centro
  const dataCentros = await Promise.all(
    centros.map(async centro => {
      // Movimientos de caja
      const [ingresosCaja, egresosCaja] = await Promise.all([
        req.prisma.movimientoCaja.aggregate({
          where: { ...whereMovCaja, tipo: 'INGRESO', centroCostoId: centro.id },
          _sum: { monto: true },
        }),
        req.prisma.movimientoCaja.aggregate({
          where: { ...whereMovCaja, tipo: 'EGRESO', centroCostoId: centro.id },
          _sum: { monto: true },
        }),
      ])

      // Movimientos contables
      const movContables = await req.prisma.movimientoContable.findMany({
        where: { ...whereMovContable, centroCostoId: centro.id },
        select: { tipo: true, montoTotal: true },
      })

      const ingresosContables = movContables
        .filter(m => ['FACTURA_VENTA', 'RECIBO_COBRO'].includes(m.tipo))
        .reduce((sum, m) => sum + parseFloat(m.montoTotal), 0)

      const egresosContables = movContables
        .filter(m => ['FACTURA_COMPRA', 'ORDEN_PAGO', 'PAGO'].includes(m.tipo))
        .reduce((sum, m) => sum + parseFloat(m.montoTotal), 0)

      const totalIngresos = parseFloat(ingresosCaja._sum.monto || 0) + ingresosContables
      const totalEgresos = parseFloat(egresosCaja._sum.monto || 0) + egresosContables
      const resultado = totalIngresos - totalEgresos

      return {
        id: centro.id,
        codigo: centro.codigo,
        nombre: centro.nombre,
        tipo: centro.tipo,
        ingresos: totalIngresos,
        egresos: totalEgresos,
        resultado,
        porcentajeIngresos: 0, // Se calculará después
        porcentajeEgresos: 0, // Se calculará después
      }
    })
  )

  // Calcular totales generales
  const totalIngresos = dataCentros.reduce((sum, c) => sum + c.ingresos, 0)
  const totalEgresos = dataCentros.reduce((sum, c) => sum + c.egresos, 0)
  const resultadoGeneral = totalIngresos - totalEgresos

  // Calcular porcentajes
  dataCentros.forEach(centro => {
    centro.porcentajeIngresos = totalIngresos > 0 ? (centro.ingresos / totalIngresos) * 100 : 0
    centro.porcentajeEgresos = totalEgresos > 0 ? (centro.egresos / totalEgresos) * 100 : 0
  })

  res.json({
    success: true,
    data: {
      periodo: {
        desde: fechaDesde || null,
        hasta: fechaHasta || null,
      },
      resumenGeneral: {
        totalIngresos,
        totalEgresos,
        resultado: resultadoGeneral,
        tipo: resultadoGeneral >= 0 ? 'SUPERAVIT' : 'DEFICIT',
      },
      centros: dataCentros,
      topIngresos: dataCentros
        .filter(c => c.ingresos > 0)
        .sort((a, b) => b.ingresos - a.ingresos)
        .slice(0, 5),
      topEgresos: dataCentros
        .filter(c => c.egresos > 0)
        .sort((a, b) => b.egresos - a.egresos)
        .slice(0, 5),
    },
  })
}))

export default router
