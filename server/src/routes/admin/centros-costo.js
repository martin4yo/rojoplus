import { Router } from 'express'
import { asyncHandler, AppError } from '../../middleware/errorHandler.js'
import { authAdmin } from '../../middleware/auth.js'
import {
  exportarComparativoExcel,
  exportarEvolucionExcel,
  exportarRentabilidadExcel,
  exportarPresupuestoExcel,
  generarPDFComparativo,
} from '../../services/exportCentrosCosto.js'

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

  const centros = await req.db.centroCosto.findMany({
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

  const centro = await req.db.centroCosto.findUnique({
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
  const existente = await req.db.centroCosto.findUnique({
    where: { codigo },
  })

  if (existente) {
    throw new AppError('Ya existe un centro de costo con ese código', 400, 'DUPLICATE_CODE')
  }

  const centro = await req.db.centroCosto.create({
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

  const centroExistente = await req.db.centroCosto.findUnique({
    where: { id: parseInt(id) },
  })

  if (!centroExistente) {
    throw new AppError('Centro de costo no encontrado', 404, 'NOT_FOUND')
  }

  // Si se cambió el código, verificar que no exista otro con ese código
  if (codigo && codigo !== centroExistente.codigo) {
    const codigoExistente = await req.db.centroCosto.findUnique({
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

  const centro = await req.db.centroCosto.update({
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

  const centro = await req.db.centroCosto.findUnique({
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
    const centroDesactivado = await req.db.centroCosto.update({
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
    await req.db.centroCosto.delete({
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

  const centro = await req.db.centroCosto.findUnique({
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
    req.db.movimientoCaja.aggregate({
      where: { ...whereMovCaja, tipo: 'INGRESO' },
      _sum: { monto: true },
      _count: true,
    }),
    req.db.movimientoCaja.aggregate({
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

  const centros = await req.db.centroCosto.findMany({
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
      fecha: { ...whereMovCaja.fecha, lte: new Date(fechaHasta + 'T23:59:59') },
    }
    whereMovContable = {
      ...whereMovContable,
      fecha: { ...whereMovContable.fecha, lte: new Date(fechaHasta + 'T23:59:59') },
    }
  }

  // Obtener datos para cada centro
  const dataCentros = await Promise.all(
    centros.map(async centro => {
      // Movimientos de caja
      const [ingresosCaja, egresosCaja] = await Promise.all([
        req.db.movimientoCaja.aggregate({
          where: { ...whereMovCaja, tipo: 'INGRESO', centroCostoId: centro.id },
          _sum: { monto: true },
        }),
        req.db.movimientoCaja.aggregate({
          where: { ...whereMovCaja, tipo: 'EGRESO', centroCostoId: centro.id },
          _sum: { monto: true },
        }),
      ])

      // Movimientos contables
      const movContables = await req.db.movimientoContable.findMany({
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

// GET /api/admin/centros-costo/evolucion-temporal - Reporte de evolución temporal
router.get('/centros-costo-evolucion-temporal', authAdmin, asyncHandler(async (req, res) => {
  const { centroCostoId, fechaDesde, fechaHasta, agrupacion } = req.query

  // Validar agrupación (mensual o anual)
  const agrupar = agrupacion || 'mensual'
  if (!['mensual', 'anual'].includes(agrupar)) {
    throw new AppError('Agrupación debe ser "mensual" o "anual"', 400, 'VALIDATION_ERROR')
  }

  // Construir where
  const whereMovCaja = { anulado: false }
  const whereMovContable = { estado: { not: 'ANULADO' } }

  if (centroCostoId) {
    whereMovCaja.centroCostoId = parseInt(centroCostoId)
    whereMovContable.centroCostoId = parseInt(centroCostoId)
  }

  if (fechaDesde) {
    whereMovCaja.fecha = { gte: new Date(fechaDesde) }
    whereMovContable.fecha = { gte: new Date(fechaDesde) }
  }
  if (fechaHasta) {
    whereMovCaja.fecha = { ...whereMovCaja.fecha, lte: new Date(fechaHasta) }
    whereMovContable.fecha = { ...whereMovContable.fecha, lte: new Date(fechaHasta) }
  }

  // Obtener todos los movimientos
  const [movimientosCaja, movimientosContables] = await Promise.all([
    req.db.movimientoCaja.findMany({
      where: whereMovCaja,
      select: {
        fecha: true,
        tipo: true,
        monto: true,
        centroCostoId: true,
        centroCosto: { select: { id: true, codigo: true, nombre: true } },
      },
    }),
    req.prisma.movimientoContable.findMany({
      where: whereMovContable,
      select: {
        fecha: true,
        tipo: true,
        montoTotal: true,
        centroCostoId: true,
        centroCosto: { select: { id: true, codigo: true, nombre: true } },
      },
    }),
  ])

  // Función para agrupar por período
  const getPeriodo = (fecha) => {
    const d = new Date(fecha)
    if (agrupar === 'mensual') {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    }
    return `${d.getFullYear()}`
  }

  // Agrupar datos
  const datosPorPeriodo = {}

  movimientosCaja.forEach(m => {
    const periodo = getPeriodo(m.fecha)
    const centroKey = m.centroCostoId || 'sin_centro'

    if (!datosPorPeriodo[periodo]) datosPorPeriodo[periodo] = {}
    if (!datosPorPeriodo[periodo][centroKey]) {
      datosPorPeriodo[periodo][centroKey] = {
        centro: m.centroCosto || { id: null, nombre: 'Sin Centro' },
        ingresos: 0,
        egresos: 0,
      }
    }

    if (m.tipo === 'INGRESO') {
      datosPorPeriodo[periodo][centroKey].ingresos += parseFloat(m.monto)
    } else {
      datosPorPeriodo[periodo][centroKey].egresos += parseFloat(m.monto)
    }
  })

  movimientosContables.forEach(m => {
    const periodo = getPeriodo(m.fecha)
    const centroKey = m.centroCostoId || 'sin_centro'

    if (!datosPorPeriodo[periodo]) datosPorPeriodo[periodo] = {}
    if (!datosPorPeriodo[periodo][centroKey]) {
      datosPorPeriodo[periodo][centroKey] = {
        centro: m.centroCosto || { id: null, nombre: 'Sin Centro' },
        ingresos: 0,
        egresos: 0,
      }
    }

    if (['FACTURA_VENTA', 'RECIBO_COBRO'].includes(m.tipo)) {
      datosPorPeriodo[periodo][centroKey].ingresos += parseFloat(m.montoTotal)
    } else if (['FACTURA_COMPRA', 'ORDEN_PAGO', 'PAGO'].includes(m.tipo)) {
      datosPorPeriodo[periodo][centroKey].egresos += parseFloat(m.montoTotal)
    }
  })

  // Convertir a array y calcular resultado
  const series = Object.keys(datosPorPeriodo).sort().map(periodo => {
    const centros = Object.values(datosPorPeriodo[periodo]).map(c => ({
      ...c,
      resultado: c.ingresos - c.egresos,
    }))

    const totalIngresos = centros.reduce((sum, c) => sum + c.ingresos, 0)
    const totalEgresos = centros.reduce((sum, c) => sum + c.egresos, 0)

    return {
      periodo,
      centros,
      totales: {
        ingresos: totalIngresos,
        egresos: totalEgresos,
        resultado: totalIngresos - totalEgresos,
      },
    }
  })

  res.json({
    success: true,
    data: {
      agrupacion: agrupar,
      periodo: { desde: fechaDesde || null, hasta: fechaHasta || null },
      series,
    },
  })
}))

// GET /api/admin/centros-costo/rentabilidad-actividades - Reporte de rentabilidad por actividad
router.get('/centros-costo-rentabilidad-actividades', authAdmin, asyncHandler(async (req, res) => {
  const { centroCostoId, fechaDesde, fechaHasta } = req.query

  const whereCentro = centroCostoId ? { id: parseInt(centroCostoId) } : { activo: true }

  const centros = await req.db.centroCosto.findMany({
    where: whereCentro,
    include: {
      actividades: {
        where: { activo: true },
        include: {
          inscripciones: {
            where: {
              ...(fechaDesde && { fecha: { gte: new Date(fechaDesde) } }),
              ...(fechaHasta && { fecha: { lte: new Date(fechaHasta) } }),
              estado: { not: 'CANCELADA' },
            },
            include: {
              pagos: {
                where: { estado: 'CONFIRMADO' },
              },
            },
          },
        },
      },
    },
  })

  const datosActividades = centros.flatMap(centro =>
    centro.actividades.map(actividad => {
      const totalInscripciones = actividad.inscripciones.length
      const totalIngresos = actividad.inscripciones.reduce((sum, insc) => {
        const pagosTotales = insc.pagos.reduce((s, p) => s + parseFloat(p.monto), 0)
        return sum + pagosTotales
      }, 0)

      // Estimar costos (esto puede mejorarse con datos reales)
      const costoEstimado = totalInscripciones * parseFloat(actividad.precio || 0) * 0.3 // 30% de costo estimado

      return {
        centroCosto: { id: centro.id, codigo: centro.codigo, nombre: centro.nombre },
        actividad: {
          id: actividad.id,
          codigo: actividad.codigo,
          nombre: actividad.nombre,
          precio: parseFloat(actividad.precio || 0),
        },
        inscripciones: totalInscripciones,
        ingresos: totalIngresos,
        costos: costoEstimado,
        resultado: totalIngresos - costoEstimado,
        margen: totalIngresos > 0 ? ((totalIngresos - costoEstimado) / totalIngresos) * 100 : 0,
      }
    })
  )

  // Ordenar por resultado descendente
  datosActividades.sort((a, b) => b.resultado - a.resultado)

  const resumen = {
    totalIngresos: datosActividades.reduce((sum, a) => sum + a.ingresos, 0),
    totalCostos: datosActividades.reduce((sum, a) => sum + a.costos, 0),
    totalResultado: datosActividades.reduce((sum, a) => sum + a.resultado, 0),
    totalInscripciones: datosActividades.reduce((sum, a) => sum + a.inscripciones, 0),
  }

  res.json({
    success: true,
    data: {
      periodo: { desde: fechaDesde || null, hasta: fechaHasta || null },
      resumen,
      actividades: datosActividades,
      topRentables: datosActividades.slice(0, 10),
      menosRentables: datosActividades.slice(-10).reverse(),
    },
  })
}))

// GET /api/admin/centros-costo/presupuesto-vs-real - Reporte presupuesto vs real
router.get('/centros-costo-presupuesto-vs-real', authAdmin, asyncHandler(async (req, res) => {
  const { anio, centroCostoId } = req.query

  if (!anio) {
    throw new AppError('El año es requerido', 400, 'VALIDATION_ERROR')
  }

  // Obtener presupuesto principal del año
  const presupuesto = await req.db.presupuesto.findFirst({
    where: {
      anio: parseInt(anio),
      esPrincipal: true,
      estado: 'APROBADO',
    },
    include: {
      lineas: {
        where: centroCostoId ? { centroCostoId: parseInt(centroCostoId) } : {},
        include: {
          centroCosto: true,
          concepto: true,
        },
      },
    },
  })

  if (!presupuesto) {
    throw new AppError('No se encontró presupuesto aprobado para el año', 404, 'NOT_FOUND')
  }

  // Agrupar líneas de presupuesto por centro y mes
  const presupuestoPorCentro = {}

  presupuesto.lineas.forEach(linea => {
    const centroKey = linea.centroCostoId || 'sin_centro'
    if (!presupuestoPorCentro[centroKey]) {
      presupuestoPorCentro[centroKey] = {
        centro: linea.centroCosto || { id: null, nombre: 'Sin Centro' },
        meses: {},
        totalPresupuestado: 0,
      }
    }

    const mes = linea.mes
    if (!presupuestoPorCentro[centroKey].meses[mes]) {
      presupuestoPorCentro[centroKey].meses[mes] = { presupuestado: 0, real: 0 }
    }

    presupuestoPorCentro[centroKey].meses[mes].presupuestado += parseFloat(linea.montoPresupuestado)
    presupuestoPorCentro[centroKey].totalPresupuestado += parseFloat(linea.montoPresupuestado)
  })

  // Obtener datos reales del año
  const fechaDesde = new Date(`${anio}-01-01`)
  const fechaHasta = new Date(`${anio}-12-31`)

  const [movimientosCaja, movimientosContables] = await Promise.all([
    req.db.movimientoCaja.findMany({
      where: {
        fecha: { gte: fechaDesde, lte: fechaHasta },
        anulado: false,
        ...(centroCostoId && { centroCostoId: parseInt(centroCostoId) }),
      },
      select: {
        fecha: true,
        tipo: true,
        monto: true,
        centroCostoId: true,
        centroCosto: { select: { id: true, nombre: true } },
      },
    }),
    req.prisma.movimientoContable.findMany({
      where: {
        fecha: { gte: fechaDesde, lte: fechaHasta },
        estado: { not: 'ANULADO' },
        ...(centroCostoId && { centroCostoId: parseInt(centroCostoId) }),
      },
      select: {
        fecha: true,
        tipo: true,
        montoTotal: true,
        centroCostoId: true,
        centroCosto: { select: { id: true, nombre: true } },
      },
    }),
  ])

  // Agregar datos reales
  const todosMovimientos = [...movimientosCaja, ...movimientosContables]
  todosMovimientos.forEach(mov => {
    const mes = new Date(mov.fecha).getMonth() + 1
    const centroKey = mov.centroCostoId || 'sin_centro'
    const monto = parseFloat(mov.monto || mov.montoTotal || 0)

    if (!presupuestoPorCentro[centroKey]) {
      presupuestoPorCentro[centroKey] = {
        centro: mov.centroCosto || { id: null, nombre: 'Sin Centro' },
        meses: {},
        totalPresupuestado: 0,
      }
    }

    if (!presupuestoPorCentro[centroKey].meses[mes]) {
      presupuestoPorCentro[centroKey].meses[mes] = { presupuestado: 0, real: 0 }
    }

    const esEgreso = mov.tipo === 'EGRESO' || ['FACTURA_COMPRA', 'ORDEN_PAGO', 'PAGO'].includes(mov.tipo)
    presupuestoPorCentro[centroKey].meses[mes].real += esEgreso ? monto : -monto // Egresos positivos
  })

  // Convertir a array y calcular desvíos
  const centrosData = Object.values(presupuestoPorCentro).map(centro => {
    const mesesArray = Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1
      const datos = centro.meses[mes] || { presupuestado: 0, real: 0 }
      const desvio = datos.real - datos.presupuestado
      const desvioPorc = datos.presupuestado > 0 ? (desvio / datos.presupuestado) * 100 : 0

      return {
        mes,
        presupuestado: datos.presupuestado,
        real: datos.real,
        desvio,
        desvioPorc,
      }
    })

    const totalReal = mesesArray.reduce((sum, m) => sum + m.real, 0)
    const desvioTotal = totalReal - centro.totalPresupuestado
    const desvioTotalPorc = centro.totalPresupuestado > 0
      ? (desvioTotal / centro.totalPresupuestado) * 100
      : 0

    return {
      centro: centro.centro,
      meses: mesesArray,
      totales: {
        presupuestado: centro.totalPresupuestado,
        real: totalReal,
        desvio: desvioTotal,
        desvioPorc: desvioTotalPorc,
      },
    }
  })

  res.json({
    success: true,
    data: {
      anio: parseInt(anio),
      presupuesto: {
        id: presupuesto.id,
        nombre: presupuesto.nombre,
        estado: presupuesto.estado,
      },
      centros: centrosData,
    },
  })
}))

// GET /api/admin/centros-costo/dashboard-ejecutivo - Dashboard ejecutivo
router.get('/centros-costo-dashboard-ejecutivo', authAdmin, asyncHandler(async (req, res) => {
  const { mes, anio } = req.query

  const hoy = new Date()
  const mesActual = mes ? parseInt(mes) : hoy.getMonth() + 1
  const anioActual = anio ? parseInt(anio) : hoy.getFullYear()

  const fechaDesde = new Date(anioActual, mesActual - 1, 1)
  const fechaHasta = new Date(anioActual, mesActual, 0, 23, 59, 59)

  // Obtener datos del período actual
  const centros = await req.db.centroCosto.findMany({
    where: { activo: true },
    include: {
      movimientosCaja: {
        where: {
          fecha: { gte: fechaDesde, lte: fechaHasta },
          anulado: false,
        },
      },
      movimientosContables: {
        where: {
          fecha: { gte: fechaDesde, lte: fechaHasta },
          estado: { not: 'ANULADO' },
        },
      },
    },
  })

  const datosCentros = centros.map(centro => {
    const ingresosCaja = centro.movimientosCaja
      .filter(m => m.tipo === 'INGRESO')
      .reduce((sum, m) => sum + parseFloat(m.monto), 0)

    const egresosCaja = centro.movimientosCaja
      .filter(m => m.tipo === 'EGRESO')
      .reduce((sum, m) => sum + parseFloat(m.monto), 0)

    const ingresosContables = centro.movimientosContables
      .filter(m => ['FACTURA_VENTA', 'RECIBO_COBRO'].includes(m.tipo))
      .reduce((sum, m) => sum + parseFloat(m.montoTotal), 0)

    const egresosContables = centro.movimientosContables
      .filter(m => ['FACTURA_COMPRA', 'ORDEN_PAGO', 'PAGO'].includes(m.tipo))
      .reduce((sum, m) => sum + parseFloat(m.montoTotal), 0)

    const totalIngresos = ingresosCaja + ingresosContables
    const totalEgresos = egresosCaja + egresosContables
    const resultado = totalIngresos - totalEgresos

    return {
      id: centro.id,
      codigo: centro.codigo,
      nombre: centro.nombre,
      tipo: centro.tipo,
      ingresos: totalIngresos,
      egresos: totalEgresos,
      resultado,
      transacciones: centro.movimientosCaja.length + centro.movimientosContables.length,
    }
  })

  // KPIs generales
  const totalIngresos = datosCentros.reduce((sum, c) => sum + c.ingresos, 0)
  const totalEgresos = datosCentros.reduce((sum, c) => sum + c.egresos, 0)
  const resultadoGeneral = totalIngresos - totalEgresos

  // Alertas de desvíos (centros con resultado negativo mayor a $100k)
  const alertas = datosCentros
    .filter(c => c.resultado < -100000)
    .map(c => ({
      tipo: 'DEFICIT_ALTO',
      centro: c.nombre,
      monto: c.resultado,
      severidad: c.resultado < -500000 ? 'CRITICA' : 'ALTA',
    }))

  res.json({
    success: true,
    data: {
      periodo: { mes: mesActual, anio: anioActual },
      kpis: {
        totalIngresos,
        totalEgresos,
        resultado: resultadoGeneral,
        margen: totalIngresos > 0 ? (resultadoGeneral / totalIngresos) * 100 : 0,
        centrosActivos: centros.length,
        centrosDeficit: datosCentros.filter(c => c.resultado < 0).length,
      },
      centros: datosCentros,
      topIngresos: datosCentros.sort((a, b) => b.ingresos - a.ingresos).slice(0, 5),
      topEgresos: datosCentros.sort((a, b) => b.egresos - a.egresos).slice(0, 5),
      alertas,
    },
  })
}))

// ============================================================================
// EXPORTACIONES
// ============================================================================

// GET /api/admin/centros-costo-export-comparativo - Exportar comparativo a Excel
router.get('/centros-costo-export-comparativo', authAdmin, asyncHandler(async (req, res) => {
  const { fechaDesde, fechaHasta, formato } = req.query

  // Obtener datos del reporte
  const centros = await req.db.centroCosto.findMany({
    where: { activo: true },
    orderBy: [{ tipo: 'asc' }, { orden: 'asc' }],
  })

  let whereMovCaja = { anulado: false }
  let whereMovContable = { estado: { not: 'ANULADO' } }

  if (fechaDesde) {
    whereMovCaja = { ...whereMovCaja, fecha: { gte: new Date(fechaDesde) } }
    whereMovContable = { ...whereMovContable, fecha: { gte: new Date(fechaDesde) } }
  }
  if (fechaHasta) {
    whereMovCaja = {
      ...whereMovCaja,
      fecha: { ...whereMovCaja.fecha, lte: new Date(fechaHasta + 'T23:59:59') },
    }
    whereMovContable = {
      ...whereMovContable,
      fecha: { ...whereMovContable.fecha, lte: new Date(fechaHasta + 'T23:59:59') },
    }
  }

  const dataCentros = await Promise.all(
    centros.map(async centro => {
      const [ingresosCaja, egresosCaja] = await Promise.all([
        req.db.movimientoCaja.aggregate({
          where: { ...whereMovCaja, tipo: 'INGRESO', centroCostoId: centro.id },
          _sum: { monto: true },
        }),
        req.db.movimientoCaja.aggregate({
          where: { ...whereMovCaja, tipo: 'EGRESO', centroCostoId: centro.id },
          _sum: { monto: true },
        }),
      ])

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

      return {
        id: centro.id,
        codigo: centro.codigo,
        nombre: centro.nombre,
        tipo: centro.tipo,
        ingresos: totalIngresos,
        egresos: totalEgresos,
        resultado: totalIngresos - totalEgresos,
        porcentajeIngresos: 0,
        porcentajeEgresos: 0,
      }
    })
  )

  const totalIngresos = dataCentros.reduce((sum, c) => sum + c.ingresos, 0)
  const totalEgresos = dataCentros.reduce((sum, c) => sum + c.egresos, 0)

  dataCentros.forEach(centro => {
    centro.porcentajeIngresos = totalIngresos > 0 ? (centro.ingresos / totalIngresos) * 100 : 0
    centro.porcentajeEgresos = totalEgresos > 0 ? (centro.egresos / totalEgresos) * 100 : 0
  })

  const data = {
    periodo: { desde: fechaDesde || null, hasta: fechaHasta || null },
    resumenGeneral: {
      totalIngresos,
      totalEgresos,
      resultado: totalIngresos - totalEgresos,
    },
    centros: dataCentros,
  }

  if (formato === 'pdf') {
    const pdfDoc = generarPDFComparativo(data)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="centros-costo-${Date.now()}.pdf"`)
    pdfDoc.pipe(res)
  } else {
    // Excel por defecto
    const buffer = await exportarComparativoExcel(data)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="centros-costo-${Date.now()}.xlsx"`)
    res.send(buffer)
  }
}))

// GET /api/admin/centros-costo-export-evolucion - Exportar evolución temporal
router.get('/centros-costo-export-evolucion', authAdmin, asyncHandler(async (req, res) => {
  const { centroCostoId, fechaDesde, fechaHasta, agrupacion } = req.query

  const agrupar = agrupacion || 'mensual'
  const whereMovCaja = { anulado: false, ...(centroCostoId && { centroCostoId: parseInt(centroCostoId) }) }
  const whereMovContable = { estado: { not: 'ANULADO' }, ...(centroCostoId && { centroCostoId: parseInt(centroCostoId) }) }

  if (fechaDesde) {
    whereMovCaja.fecha = { gte: new Date(fechaDesde) }
    whereMovContable.fecha = { gte: new Date(fechaDesde) }
  }
  if (fechaHasta) {
    whereMovCaja.fecha = { ...whereMovCaja.fecha, lte: new Date(fechaHasta) }
    whereMovContable.fecha = { ...whereMovContable.fecha, lte: new Date(fechaHasta) }
  }

  const [movimientosCaja, movimientosContables] = await Promise.all([
    req.db.movimientoCaja.findMany({
      where: whereMovCaja,
      select: {
        fecha: true,
        tipo: true,
        monto: true,
        centroCostoId: true,
        centroCosto: { select: { id: true, nombre: true } },
      },
    }),
    req.prisma.movimientoContable.findMany({
      where: whereMovContable,
      select: {
        fecha: true,
        tipo: true,
        montoTotal: true,
        centroCostoId: true,
        centroCosto: { select: { id: true, nombre: true } },
      },
    }),
  ])

  const getPeriodo = (fecha) => {
    const d = new Date(fecha)
    return agrupar === 'mensual'
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      : `${d.getFullYear()}`
  }

  const datosPorPeriodo = {}

  const todosMovimientos2 = [...movimientosCaja, ...movimientosContables]
  todosMovimientos2.forEach(m => {
    const periodo = getPeriodo(m.fecha)
    const centroKey = m.centroCostoId || 'sin_centro'
    const monto = parseFloat(m.monto || m.montoTotal || 0)

    if (!datosPorPeriodo[periodo]) datosPorPeriodo[periodo] = {}
    if (!datosPorPeriodo[periodo][centroKey]) {
      datosPorPeriodo[periodo][centroKey] = {
        centro: m.centroCosto || { id: null, nombre: 'Sin Centro' },
        ingresos: 0,
        egresos: 0,
      }
    }

    const esIngreso = m.tipo === 'INGRESO' || ['FACTURA_VENTA', 'RECIBO_COBRO'].includes(m.tipo)
    if (esIngreso) {
      datosPorPeriodo[periodo][centroKey].ingresos += monto
    } else {
      datosPorPeriodo[periodo][centroKey].egresos += monto
    }
  })

  const series = Object.keys(datosPorPeriodo).sort().map(periodo => {
    const centros = Object.values(datosPorPeriodo[periodo]).map(c => ({
      ...c,
      resultado: c.ingresos - c.egresos,
    }))

    return {
      periodo,
      centros,
      totales: {
        ingresos: centros.reduce((sum, c) => sum + c.ingresos, 0),
        egresos: centros.reduce((sum, c) => sum + c.egresos, 0),
        resultado: centros.reduce((sum, c) => sum + c.resultado, 0),
      },
    }
  })

  const data = { agrupacion: agrupar, periodo: { desde: fechaDesde, hasta: fechaHasta }, series }

  const buffer = await exportarEvolucionExcel(data)
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="evolucion-temporal-${Date.now()}.xlsx"`)
  res.send(buffer)
}))

// GET /api/admin/centros-costo-export-rentabilidad - Exportar rentabilidad actividades
router.get('/centros-costo-export-rentabilidad', authAdmin, asyncHandler(async (req, res) => {
  const { centroCostoId, fechaDesde, fechaHasta } = req.query

  const whereCentro = centroCostoId ? { id: parseInt(centroCostoId) } : { activo: true }

  const centros = await req.db.centroCosto.findMany({
    where: whereCentro,
    include: {
      actividades: {
        where: { activo: true },
        include: {
          inscripciones: {
            where: {
              ...(fechaDesde && { fecha: { gte: new Date(fechaDesde) } }),
              ...(fechaHasta && { fecha: { lte: new Date(fechaHasta) } }),
              estado: { not: 'CANCELADA' },
            },
            include: {
              pagos: { where: { estado: 'CONFIRMADO' } },
            },
          },
        },
      },
    },
  })

  const datosActividades = centros.flatMap(centro =>
    centro.actividades.map(actividad => {
      const totalInscripciones = actividad.inscripciones.length
      const totalIngresos = actividad.inscripciones.reduce((sum, insc) => {
        return sum + insc.pagos.reduce((s, p) => s + parseFloat(p.monto), 0)
      }, 0)
      const costoEstimado = totalInscripciones * parseFloat(actividad.precio || 0) * 0.3

      return {
        centroCosto: { id: centro.id, nombre: centro.nombre },
        actividad: { id: actividad.id, nombre: actividad.nombre },
        inscripciones: totalInscripciones,
        ingresos: totalIngresos,
        costos: costoEstimado,
        resultado: totalIngresos - costoEstimado,
        margen: totalIngresos > 0 ? ((totalIngresos - costoEstimado) / totalIngresos) * 100 : 0,
      }
    })
  )

  const resumen = {
    totalIngresos: datosActividades.reduce((sum, a) => sum + a.ingresos, 0),
    totalCostos: datosActividades.reduce((sum, a) => sum + a.costos, 0),
    totalResultado: datosActividades.reduce((sum, a) => sum + a.resultado, 0),
    totalInscripciones: datosActividades.reduce((sum, a) => sum + a.inscripciones, 0),
  }

  const data = {
    periodo: { desde: fechaDesde, hasta: fechaHasta },
    resumen,
    actividades: datosActividades,
  }

  const buffer = await exportarRentabilidadExcel(data)
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="rentabilidad-actividades-${Date.now()}.xlsx"`)
  res.send(buffer)
}))

// GET /api/admin/centros-costo-export-presupuesto - Exportar presupuesto vs real
router.get('/centros-costo-export-presupuesto', authAdmin, asyncHandler(async (req, res) => {
  const { anio, centroCostoId } = req.query

  if (!anio) {
    throw new AppError('El año es requerido', 400, 'VALIDATION_ERROR')
  }

  const presupuesto = await req.db.presupuesto.findFirst({
    where: { anio: parseInt(anio), esPrincipal: true, estado: 'APROBADO' },
    include: {
      lineas: {
        where: centroCostoId ? { centroCostoId: parseInt(centroCostoId) } : {},
        include: { centroCosto: true },
      },
    },
  })

  if (!presupuesto) {
    throw new AppError('No se encontró presupuesto aprobado', 404, 'NOT_FOUND')
  }

  const presupuestoPorCentro = {}

  presupuesto.lineas.forEach(linea => {
    const centroKey = linea.centroCostoId || 'sin_centro'
    if (!presupuestoPorCentro[centroKey]) {
      presupuestoPorCentro[centroKey] = {
        centro: linea.centroCosto || { id: null, nombre: 'Sin Centro' },
        meses: {},
        totalPresupuestado: 0,
      }
    }

    if (!presupuestoPorCentro[centroKey].meses[linea.mes]) {
      presupuestoPorCentro[centroKey].meses[linea.mes] = { presupuestado: 0, real: 0 }
    }

    presupuestoPorCentro[centroKey].meses[linea.mes].presupuestado += parseFloat(linea.montoPresupuestado)
    presupuestoPorCentro[centroKey].totalPresupuestado += parseFloat(linea.montoPresupuestado)
  })

  const centrosData = Object.values(presupuestoPorCentro).map(centro => {
    const mesesArray = Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1
      const datos = centro.meses[mes] || { presupuestado: 0, real: 0 }
      return {
        mes,
        presupuestado: datos.presupuestado,
        real: datos.real,
        desvio: datos.real - datos.presupuestado,
      }
    })

    return {
      centro: centro.centro,
      meses: mesesArray,
      totales: {
        presupuestado: centro.totalPresupuestado,
        real: mesesArray.reduce((sum, m) => sum + m.real, 0),
        desvio: mesesArray.reduce((sum, m) => sum + m.desvio, 0),
      },
    }
  })

  const data = {
    anio: parseInt(anio),
    presupuesto: { id: presupuesto.id, nombre: presupuesto.nombre },
    centros: centrosData,
  }

  const buffer = await exportarPresupuestoExcel(data)
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="presupuesto-vs-real-${anio}.xlsx"`)
  res.send(buffer)
}))

// GET /api/admin/centros-costo/:id/movimientos - Movimientos detallados de un centro de costo
router.get('/centros-costo/:id/movimientos', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { fechaDesde, fechaHasta, tipo = 'caja', page = 1, agrupar, concepto: conceptoFiltro } = req.query
  const limit = 50
  const skip = (parseInt(page) - 1) * limit

  const centro = await req.db.centroCosto.findUnique({ where: { id: parseInt(id) } })
  if (!centro) throw new AppError('Centro de costo no encontrado', 404, 'NOT_FOUND')

  const TIPOS_INGRESO = ['FACTURA_VENTA', 'RECIBO_COBRO', 'NOTA_CREDITO_CLIENTE']

  if (tipo === 'caja') {
    const where = { centroCostoId: parseInt(id), anulado: false }
    if (fechaDesde) where.fecha = { ...where.fecha, gte: new Date(fechaDesde) }
    if (fechaHasta) where.fecha = { ...where.fecha, lte: new Date(fechaHasta + 'T23:59:59') }
    if (conceptoFiltro) where.concepto = conceptoFiltro

    // Modo agrupado: devuelve totales por concepto
    if (agrupar) {
      const grupos = await req.db.movimientoCaja.groupBy({
        by: ['concepto', 'tipo'],
        where,
        _sum: { monto: true },
        _count: { _all: true },
      })

      // Consolida filas del mismo concepto (puede tener INGRESO y EGRESO)
      const mapa = {}
      for (const g of grupos) {
        if (!mapa[g.concepto]) mapa[g.concepto] = { concepto: g.concepto, cantidad: 0, ingresos: 0, egresos: 0 }
        mapa[g.concepto].cantidad += g._count._all
        if (g.tipo === 'INGRESO') mapa[g.concepto].ingresos += parseFloat(g._sum.monto || 0)
        else mapa[g.concepto].egresos += parseFloat(g._sum.monto || 0)
      }
      const gruposConsolidados = Object.values(mapa).sort((a, b) => (b.ingresos + b.egresos) - (a.ingresos + a.egresos))

      const [aggIngresos, aggEgresos] = await Promise.all([
        req.db.movimientoCaja.aggregate({ where: { ...where, tipo: 'INGRESO' }, _sum: { monto: true } }),
        req.db.movimientoCaja.aggregate({ where: { ...where, tipo: 'EGRESO' }, _sum: { monto: true } }),
      ])

      return res.json({
        success: true,
        data: {
          centro,
          grupos: gruposConsolidados,
          totales: {
            ingresos: parseFloat(aggIngresos._sum.monto || 0),
            egresos: parseFloat(aggEgresos._sum.monto || 0),
          },
        },
      })
    }

    const [movimientos, total, aggIngresos, aggEgresos] = await Promise.all([
      req.db.movimientoCaja.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fecha: 'desc' },
        include: {
          caja: { select: { nombre: true } },
          medioPagoRel: { select: { nombre: true } },
          pago: { select: { socio: { select: { nroSocio: true, apellidoNombre: true } } } },
          movimientoContable: {
            select: {
              id: true, numero: true, tipo: true, tipoComprobante: true,
              numeroComprobante: true, montoTotal: true, estado: true,
              entidad: { select: { razonSocial: true } },
              socio: { select: { nroSocio: true, apellidoNombre: true } },
              items: { select: { descripcion: true, cantidad: true, precioUnitario: true, subtotal: true } },
            },
          },
        },
      }),
      req.db.movimientoCaja.count({ where }),
      req.db.movimientoCaja.aggregate({ where: { ...where, tipo: 'INGRESO' }, _sum: { monto: true } }),
      req.db.movimientoCaja.aggregate({ where: { ...where, tipo: 'EGRESO' }, _sum: { monto: true } }),
    ])

    return res.json({
      success: true,
      data: {
        centro,
        movimientos,
        totales: {
          ingresos: parseFloat(aggIngresos._sum.monto || 0),
          egresos: parseFloat(aggEgresos._sum.monto || 0),
        },
        pagination: { page: parseInt(page), limit, total, pages: Math.ceil(total / limit) },
      },
    })
  }

  // tipo === 'contable'
  const where = { centroCostoId: parseInt(id), estado: { not: 'ANULADO' } }
  if (fechaDesde) where.fecha = { ...where.fecha, gte: new Date(fechaDesde) }
  if (fechaHasta) where.fecha = { ...where.fecha, lte: new Date(fechaHasta + 'T23:59:59') }
  if (conceptoFiltro) where.tipo = conceptoFiltro

  // Modo agrupado: devuelve totales por tipo de movimiento
  if (agrupar) {
    const grupos = await req.db.movimientoContable.groupBy({
      by: ['tipo'],
      where,
      _sum: { montoTotal: true },
      _count: { _all: true },
    })

    const gruposConsolidados = grupos.map(g => ({
      concepto: g.tipo,
      cantidad: g._count._all,
      ingresos: TIPOS_INGRESO.includes(g.tipo) ? parseFloat(g._sum.montoTotal || 0) : 0,
      egresos: !TIPOS_INGRESO.includes(g.tipo) ? parseFloat(g._sum.montoTotal || 0) : 0,
    })).sort((a, b) => (b.ingresos + b.egresos) - (a.ingresos + a.egresos))

    const allMov = await req.db.movimientoContable.findMany({ where, select: { tipo: true, montoTotal: true } })
    const totalIngresos = allMov.filter(m => TIPOS_INGRESO.includes(m.tipo)).reduce((s, m) => s + parseFloat(m.montoTotal || 0), 0)
    const totalEgresos = allMov.filter(m => !TIPOS_INGRESO.includes(m.tipo)).reduce((s, m) => s + parseFloat(m.montoTotal || 0), 0)

    return res.json({
      success: true,
      data: {
        centro,
        grupos: gruposConsolidados,
        totales: { ingresos: totalIngresos, egresos: totalEgresos },
      },
    })
  }

  const [movimientos, total] = await Promise.all([
    req.db.movimientoContable.findMany({
      where,
      skip,
      take: limit,
      orderBy: { fecha: 'desc' },
      include: {
        concepto: { select: { nombre: true } },
        entidad: { select: { razonSocial: true } },
        socio: { select: { nroSocio: true, apellidoNombre: true } },
        items: { select: { descripcion: true, cantidad: true, precioUnitario: true, subtotal: true } },
        movimientosCaja: {
          where: { anulado: false },
          select: {
            id: true, numero: true, fecha: true, tipo: true, monto: true,
            concepto: true, estado: true,
            caja: { select: { nombre: true } },
            medioPagoRel: { select: { nombre: true } },
          },
        },
      },
    }),
    req.db.movimientoContable.count({ where }),
  ])

  const totalIngresos = movimientos.filter(m => TIPOS_INGRESO.includes(m.tipo)).reduce((s, m) => s + parseFloat(m.montoTotal || 0), 0)
  const totalEgresos = movimientos.filter(m => !TIPOS_INGRESO.includes(m.tipo)).reduce((s, m) => s + parseFloat(m.montoTotal || 0), 0)

  res.json({
    success: true,
    data: {
      centro,
      movimientos,
      totales: { ingresos: totalIngresos, egresos: totalEgresos },
      pagination: { page: parseInt(page), limit, total, pages: Math.ceil(total / limit) },
    },
  })
}))

export default router
