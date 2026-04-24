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

  // Fuente unica de verdad: MovimientoCaja (evita doble conteo con MovimientoContable
  // ya que por cada venta buffet se crean MovCaja + FACTURA_VENTA + RECIBO_COBRO)
  const whereMovCaja = { centroCostoId: parseInt(id), anulado: false }

  if (fechaDesde) {
    whereMovCaja.fecha = { ...whereMovCaja.fecha, gte: new Date(fechaDesde) }
  }
  if (fechaHasta) {
    whereMovCaja.fecha = { ...whereMovCaja.fecha, lte: new Date(fechaHasta) }
  }

  const [ingresosCaja, egresosCaja, detalles] = await Promise.all([
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
    req.db.movimientoCaja.findMany({
      where: whereMovCaja,
      orderBy: { fecha: 'desc' },
      include: {
        caja: { select: { nombre: true } },
        cuentaContable: { select: { codigo: true, nombre: true } },
        socio: { select: { nroSocio: true, apellidoNombre: true } },
        entidad: { select: { razonSocial: true } },
      },
    }),
  ])

  const totalIngresos = parseFloat(ingresosCaja._sum.monto || 0)
  const totalEgresos = parseFloat(egresosCaja._sum.monto || 0)
  const resultado = totalIngresos - totalEgresos

  const mapDetalle = (m) => ({
    id: m.id,
    numero: m.numero,
    tipo: m.tipo,
    fecha: m.fecha,
    monto: parseFloat(m.monto),
    concepto: m.concepto,
    cuenta: m.cuentaContable ? `${m.cuentaContable.codigo} - ${m.cuentaContable.nombre}` : null,
    caja: m.caja?.nombre,
    referencia: m.entidadId
      ? m.entidad?.razonSocial
      : m.socioId
      ? `Socio ${m.socio?.nroSocio} - ${m.socio?.apellidoNombre}`
      : null,
  })

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
          total: totalIngresos,
          cantidad: ingresosCaja._count,
        },
        egresos: {
          total: totalEgresos,
          cantidad: egresosCaja._count,
        },
        resultado: {
          monto: resultado,
          tipo: resultado >= 0 ? 'SUPERAVIT' : 'DEFICIT',
        },
      },
      detalles: {
        ingresos: detalles.filter(m => m.tipo === 'INGRESO').map(mapDetalle),
        egresos: detalles.filter(m => m.tipo === 'EGRESO').map(mapDetalle),
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
  // Fuente unica: MovimientoCaja (ver /centros-costo/:id/reporte para justificacion)
  let whereMovCaja = { anulado: false }

  if (fechaDesde) {
    whereMovCaja = { ...whereMovCaja, fecha: { gte: new Date(fechaDesde) } }
  }
  if (fechaHasta) {
    whereMovCaja = {
      ...whereMovCaja,
      fecha: { ...whereMovCaja.fecha, lte: new Date(fechaHasta + 'T23:59:59') },
    }
  }

  const dataCentros = await Promise.all(
    centros.map(async centro => {
      const [ingresosCaja, egresosCaja] = await Promise.all([
        req.db.movimientoCaja.aggregate({
          where: { ...whereMovCaja, tipo: 'INGRESO', centroCostoId: centro.id },
          _sum: { monto: true },
          _count: true,
        }),
        req.db.movimientoCaja.aggregate({
          where: { ...whereMovCaja, tipo: 'EGRESO', centroCostoId: centro.id },
          _sum: { monto: true },
          _count: true,
        }),
      ])

      const totalIngresos = parseFloat(ingresosCaja._sum.monto || 0)
      const totalEgresos = parseFloat(egresosCaja._sum.monto || 0)
      const resultado = totalIngresos - totalEgresos

      return {
        id: centro.id,
        codigo: centro.codigo,
        nombre: centro.nombre,
        tipo: centro.tipo,
        ingresos: totalIngresos,
        egresos: totalEgresos,
        resultado,
        transacciones: (ingresosCaja._count || 0) + (egresosCaja._count || 0),
        porcentajeIngresos: 0,
        porcentajeEgresos: 0,
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

  // Fuente unica: MovimientoCaja
  const whereMovCaja = { anulado: false }

  if (centroCostoId) {
    whereMovCaja.centroCostoId = parseInt(centroCostoId)
  }

  if (fechaDesde) {
    whereMovCaja.fecha = { gte: new Date(fechaDesde) }
  }
  if (fechaHasta) {
    whereMovCaja.fecha = { ...whereMovCaja.fecha, lte: new Date(fechaHasta) }
  }

  const movimientosCaja = await req.db.movimientoCaja.findMany({
    where: whereMovCaja,
    select: {
      fecha: true,
      tipo: true,
      monto: true,
      centroCostoId: true,
      centroCosto: { select: { id: true, codigo: true, nombre: true } },
    },
  })

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
          categorias: {
            where: { activo: true },
            include: {
              inscripciones: {
                where: {
                  ...(fechaDesde && { fechaInicio: { gte: new Date(fechaDesde) } }),
                  ...(fechaHasta && { fechaInicio: { lte: new Date(fechaHasta) } }),
                  estado: { not: 'CANCELADA' },
                },
                select: { id: true },
              },
              cargos: {
                where: {
                  estado: 'PAGADO',
                  ...(fechaDesde && { fechaPago: { gte: new Date(fechaDesde) } }),
                  ...(fechaHasta && { fechaPago: { lte: new Date(fechaHasta) } }),
                },
                select: { montoTotal: true },
              },
            },
          },
        },
      },
    },
  })

  const datosActividades = centros.flatMap(centro =>
    centro.actividades.map(actividad => {
      const totalInscripciones = actividad.categorias.reduce((sum, cat) => sum + cat.inscripciones.length, 0)
      const totalIngresos = actividad.categorias.reduce((sum, cat) =>
        sum + cat.cargos.reduce((s, c) => s + parseFloat(c.montoTotal), 0), 0)

      const costoEstimado = totalIngresos * 0.3 // 30% estimado

      return {
        centroCosto: { id: centro.id, codigo: centro.codigo, nombre: centro.nombre },
        actividad: {
          id: actividad.id,
          codigo: actividad.codigo,
          nombre: actividad.nombre,
          cuotaMensual: parseFloat(actividad.cuotaMensual || 0),
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

  // Fuente unica: MovimientoCaja
  const movimientosCaja = await req.db.movimientoCaja.findMany({
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
  })

  // Agregar datos reales
  movimientosCaja.forEach(mov => {
    const mes = new Date(mov.fecha).getMonth() + 1
    const centroKey = mov.centroCostoId || 'sin_centro'
    const monto = parseFloat(mov.monto || 0)

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

    const esEgreso = mov.tipo === 'EGRESO'
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

  // Fuente unica: MovimientoCaja (evita doble conteo; ver /centros-costo/:id/reporte)
  const centros = await req.db.centroCosto.findMany({
    where: { activo: true },
    include: {
      movimientosCaja: {
        where: {
          fecha: { gte: fechaDesde, lte: fechaHasta },
          anulado: false,
        },
      },
    },
  })

  const datosCentros = centros.map(centro => {
    const totalIngresos = centro.movimientosCaja
      .filter(m => m.tipo === 'INGRESO')
      .reduce((sum, m) => sum + parseFloat(m.monto), 0)

    const totalEgresos = centro.movimientosCaja
      .filter(m => m.tipo === 'EGRESO')
      .reduce((sum, m) => sum + parseFloat(m.monto), 0)

    const resultado = totalIngresos - totalEgresos

    return {
      id: centro.id,
      codigo: centro.codigo,
      nombre: centro.nombre,
      tipo: centro.tipo,
      ingresos: totalIngresos,
      egresos: totalEgresos,
      resultado,
      transacciones: centro.movimientosCaja.length,
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

// ============================================================================
// REPORTE MATRIZ DEVENGADO/COBRADO/PENDIENTE POR CC
// ============================================================================
// GET /api/admin/centros-costo-reporte-matriz?fechaDesde=&fechaHasta=
//
// Por cada centro de costo, devuelve:
//   - ingresos: { devengado, cobrado, pendiente }
//   - egresos:  { devengado, pagado,  pendiente }
//
// Devengado = obligacion generada en el periodo (cargos, facturas, liquidaciones, mov. caja directos)
// Cobrado/Pagado = lo que paso por caja en el periodo (MovimientoCaja)
// Pendiente = saldo al "hasta" (cuotas/facturas/liquidaciones sin pagar)
router.get('/centros-costo-reporte-matriz', authAdmin, asyncHandler(async (req, res) => {
  const { fechaDesde, fechaHasta } = req.query

  const desde = fechaDesde ? new Date(fechaDesde) : null
  const hasta = fechaHasta ? new Date(fechaHasta + 'T23:59:59') : null

  const rangoFecha = {}
  if (desde) rangoFecha.gte = desde
  if (hasta) rangoFecha.lte = hasta
  const hasRango = Object.keys(rangoFecha).length > 0

  const hastaFiltro = hasta ? { lte: hasta } : {}

  const centros = await req.db.centroCosto.findMany({
    where: { activo: true },
    orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    select: { id: true, codigo: true, nombre: true, tipo: true },
  })

  // Helpers: todos los filtros quedan acotados al CC en iteraciones posteriores
  const baseMovCaja = { anulado: false }
  if (hasRango) baseMovCaja.fecha = rangoFecha

  const baseMovContable = { estado: { not: 'ANULADO' } }
  if (hasRango) baseMovContable.fecha = rangoFecha

  const baseCargos = { estado: { not: 'ANULADO' } }
  if (hasRango) baseCargos.fechaGeneracion = rangoFecha

  // Liquidaciones del periodo (una sola query, luego agrupamos por CC de entidad)
  const itemsLiquidacionPeriodo = await req.db.itemLiquidacion.findMany({
    where: {
      liquidacion: hasRango ? { fechaGeneracion: rangoFecha } : {},
    },
    select: {
      netoAPagar: true,
      entidad: { select: { centroCostoId: true } },
    },
  })

  const itemsLiquidacionPendientes = await req.db.itemLiquidacion.findMany({
    where: {
      estado: { notIn: ['PAGADO', 'ANULADO'] },
      liquidacion: hasta ? { fechaGeneracion: { lte: hasta } } : {},
    },
    select: {
      netoAPagar: true,
      entidad: { select: { centroCostoId: true } },
    },
  })

  const sueldosDevPorCc = {}
  for (const it of itemsLiquidacionPeriodo) {
    const cc = it.entidad?.centroCostoId
    if (!cc) continue
    sueldosDevPorCc[cc] = (sueldosDevPorCc[cc] || 0) + parseFloat(it.netoAPagar || 0)
  }

  const sueldosPendPorCc = {}
  for (const it of itemsLiquidacionPendientes) {
    const cc = it.entidad?.centroCostoId
    if (!cc) continue
    sueldosPendPorCc[cc] = (sueldosPendPorCc[cc] || 0) + parseFloat(it.netoAPagar || 0)
  }

  const filas = await Promise.all(centros.map(async (cc) => {
    const [
      cargosDev,
      facturasVentaDev,
      movCajaIngresoDirecto,
      movCajaIngresoTotal,
      cargosPend,
      facturasVentaPend,
      facturasCompraDev,
      movCajaEgresoDirecto,
      movCajaEgresoTotal,
      facturasCompraPend,
    ] = await Promise.all([
      // INGRESOS DEVENGADO
      req.db.cargo.aggregate({
        where: { ...baseCargos, centroCostoId: cc.id },
        _sum: { montoTotal: true },
      }),
      req.db.movimientoContable.aggregate({
        where: { ...baseMovContable, centroCostoId: cc.id, tipo: 'FACTURA_VENTA' },
        _sum: { montoTotal: true },
      }),
      req.db.movimientoCaja.aggregate({
        where: {
          ...baseMovCaja,
          centroCostoId: cc.id,
          tipo: 'INGRESO',
          pagoId: null,
          movimientoContableId: null,
        },
        _sum: { monto: true },
      }),

      // INGRESOS COBRADO
      req.db.movimientoCaja.aggregate({
        where: { ...baseMovCaja, centroCostoId: cc.id, tipo: 'INGRESO' },
        _sum: { monto: true },
      }),

      // INGRESOS PENDIENTE (al hasta)
      req.db.cargo.aggregate({
        where: {
          centroCostoId: cc.id,
          estado: { notIn: ['PAGADO', 'ANULADO'] },
          ...(hasta ? { fechaGeneracion: { lte: hasta } } : {}),
        },
        _sum: { montoTotal: true },
      }),
      req.db.movimientoContable.aggregate({
        where: {
          centroCostoId: cc.id,
          tipo: 'FACTURA_VENTA',
          estado: { not: 'ANULADO' },
          saldoPendiente: { gt: 0 },
          ...(hasta ? { fecha: { lte: hasta } } : {}),
        },
        _sum: { saldoPendiente: true },
      }),

      // EGRESOS DEVENGADO
      req.db.movimientoContable.aggregate({
        where: { ...baseMovContable, centroCostoId: cc.id, tipo: 'FACTURA_COMPRA' },
        _sum: { montoTotal: true },
      }),
      req.db.movimientoCaja.aggregate({
        where: {
          ...baseMovCaja,
          centroCostoId: cc.id,
          tipo: 'EGRESO',
          pagoId: null,
          movimientoContableId: null,
        },
        _sum: { monto: true },
      }),

      // EGRESOS PAGADO
      req.db.movimientoCaja.aggregate({
        where: { ...baseMovCaja, centroCostoId: cc.id, tipo: 'EGRESO' },
        _sum: { monto: true },
      }),

      // EGRESOS PENDIENTE (al hasta)
      req.db.movimientoContable.aggregate({
        where: {
          centroCostoId: cc.id,
          tipo: 'FACTURA_COMPRA',
          estado: { not: 'ANULADO' },
          saldoPendiente: { gt: 0 },
          ...(hasta ? { fecha: { lte: hasta } } : {}),
        },
        _sum: { saldoPendiente: true },
      }),
    ])

    const sueldoDev = sueldosDevPorCc[cc.id] || 0
    const sueldoPend = sueldosPendPorCc[cc.id] || 0

    const ingresosDevengado =
      parseFloat(cargosDev._sum.montoTotal || 0) +
      parseFloat(facturasVentaDev._sum.montoTotal || 0) +
      parseFloat(movCajaIngresoDirecto._sum.monto || 0)

    const ingresosCobrado = parseFloat(movCajaIngresoTotal._sum.monto || 0)

    const ingresosPendiente =
      parseFloat(cargosPend._sum.montoTotal || 0) +
      parseFloat(facturasVentaPend._sum.saldoPendiente || 0)

    const egresosDevengado =
      parseFloat(facturasCompraDev._sum.montoTotal || 0) +
      parseFloat(movCajaEgresoDirecto._sum.monto || 0) +
      sueldoDev

    const egresosPagado = parseFloat(movCajaEgresoTotal._sum.monto || 0)

    const egresosPendiente =
      parseFloat(facturasCompraPend._sum.saldoPendiente || 0) +
      sueldoPend

    return {
      id: cc.id,
      codigo: cc.codigo,
      nombre: cc.nombre,
      tipo: cc.tipo,
      ingresos: {
        devengado: ingresosDevengado,
        cobrado: ingresosCobrado,
        pendiente: ingresosPendiente,
      },
      egresos: {
        devengado: egresosDevengado,
        pagado: egresosPagado,
        pendiente: egresosPendiente,
      },
    }
  }))

  const totales = filas.reduce((acc, f) => ({
    ingresos: {
      devengado: acc.ingresos.devengado + f.ingresos.devengado,
      cobrado: acc.ingresos.cobrado + f.ingresos.cobrado,
      pendiente: acc.ingresos.pendiente + f.ingresos.pendiente,
    },
    egresos: {
      devengado: acc.egresos.devengado + f.egresos.devengado,
      pagado: acc.egresos.pagado + f.egresos.pagado,
      pendiente: acc.egresos.pendiente + f.egresos.pendiente,
    },
  }), {
    ingresos: { devengado: 0, cobrado: 0, pendiente: 0 },
    egresos: { devengado: 0, pagado: 0, pendiente: 0 },
  })

  res.json({
    success: true,
    data: {
      periodo: { desde: fechaDesde || null, hasta: fechaHasta || null },
      centros: filas,
      totales,
    },
  })
}))

export default router
