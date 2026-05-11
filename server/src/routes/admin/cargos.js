import { Router } from 'express'
import { randomUUID } from 'crypto'
import { asyncHandler, AppError } from '../../middleware/errorHandler.js'
import { authAdmin } from '../../middleware/auth.js'

const router = Router()

// Función para calcular recargo de un cargo (importada desde configuracion)
async function calcularRecargoCargo(prisma, cargo) {
  if (!cargo.fechaVencimiento || cargo.estado !== 'PENDIENTE') {
    return { recargo: 0, porcentaje: 0, diasMora: 0 }
  }

  const hoy = new Date()
  const vencimiento = new Date(cargo.fechaVencimiento)
  const diasMora = Math.floor((hoy - vencimiento) / (1000 * 60 * 60 * 24))

  if (diasMora <= 0) {
    return { recargo: 0, porcentaje: 0, diasMora: 0 }
  }

  const config = await prisma.configuracionRecargo.findFirst({
    where: { activo: true },
  })

  if (!config || Number(config.porcentaje) === 0) {
    return { recargo: 0, porcentaje: 0, diasMora }
  }

  let porcentajeRecargo = 0

  if (config.tipo === 'FIJO') {
    porcentajeRecargo = Number(config.porcentaje)
  } else {
    // ACUMULATIVO: porcentaje × (diasMora / cadaDias)
    const periodos = Math.floor(diasMora / config.cadaDias)
    porcentajeRecargo = periodos * Number(config.porcentaje)

    // Aplicar tope máximo si está definido
    if (config.topeMaximo && porcentajeRecargo > Number(config.topeMaximo)) {
      porcentajeRecargo = Number(config.topeMaximo)
    }
  }

  const montoOriginal = Number(cargo.montoOriginal)
  const recargo = Math.round(montoOriginal * porcentajeRecargo / 100)

  return { recargo, porcentaje: porcentajeRecargo, diasMora }
}

// ============================================
// CARGOS ADICIONALES
// ============================================

// GET /api/admin/cargos/:id - Detalle de cargo
router.get('/cargos/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const cargo = await req.db.cargo.findUnique({
    where: { id: parseInt(id) },
    include: {
      socio: { select: { id: true, nroSocio: true, apellidoNombre: true } },
      periodo: true,
      categoriaActividad: {
        include: { actividad: { select: { nombre: true } } },
      },
      pago: { select: { id: true, numero: true, fecha: true } },
      cargoOrigen: { select: { id: true, descripcion: true } },
    },
  })

  if (!cargo) {
    throw new AppError('Cargo no encontrado', 404, 'NOT_FOUND')
  }

  res.json({ success: true, data: cargo })
}))

// PUT /api/admin/cargos/:id - Actualizar cargo
router.put('/cargos/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const {
    categoria,
    descripcion,
    montoOriginal,
    montoRecargo,
    montoBonificacion,
    fechaVencimiento,
    centroCostoId,
    estado
  } = req.body

  const cargo = await req.db.cargo.findUnique({
    where: { id: parseInt(id) },
  })

  if (!cargo) {
    throw new AppError('Cargo no encontrado', 404, 'NOT_FOUND')
  }

  // No permitir editar cargos pagados (excepto para anular)
  if (cargo.estado === 'PAGADO' && estado !== 'ANULADO') {
    throw new AppError('No se puede editar un cargo pagado', 400, 'CARGO_PAGADO')
  }

  // Validar categoría si se envía
  if (categoria) {
    const cat = await req.db.categoriaCargo.findFirst({ where: { codigo: categoria } })
    if (!cat) {
      throw new AppError(`Categoría inválida: ${categoria}`, 400, 'INVALID_CATEGORIA')
    }
  }

  // Calcular monto total
  const nuevoMontoOriginal = montoOriginal !== undefined ? parseFloat(montoOriginal) : Number(cargo.montoOriginal)
  const nuevoMontoRecargo = montoRecargo !== undefined ? parseFloat(montoRecargo) : Number(cargo.montoRecargo)
  const nuevoMontoBonificacion = montoBonificacion !== undefined ? parseFloat(montoBonificacion) : Number(cargo.montoBonificacion)
  const montoTotal = nuevoMontoOriginal + nuevoMontoRecargo - nuevoMontoBonificacion

  const actualizado = await req.db.cargo.update({
    where: { id: parseInt(id) },
    data: {
      ...(categoria && { categoria }),
      ...(descripcion !== undefined && { descripcion }),
      ...(montoOriginal !== undefined && { montoOriginal: nuevoMontoOriginal }),
      ...(montoRecargo !== undefined && { montoRecargo: nuevoMontoRecargo }),
      ...(montoBonificacion !== undefined && { montoBonificacion: nuevoMontoBonificacion }),
      montoTotal,
      ...(fechaVencimiento && { fechaVencimiento: new Date(fechaVencimiento) }),
      ...(estado && { estado }),
      ...(centroCostoId && { centroCostoId: parseInt(centroCostoId) }),
    },
    include: {
      socio: { select: { id: true, nroSocio: true, apellidoNombre: true } },
      periodo: { select: { nombre: true } },
    },
  })

  res.json({ success: true, data: actualizado })
}))

// POST /api/admin/cargos - Crear cargo manual para socio
router.post('/cargos', authAdmin, asyncHandler(async (req, res) => {
  const {
    socioId,
    categoria,
    periodoId,
    categoriaActividadId,
    conceptoTesoreriaId,
    centroCostoId,
    descripcion,
    montoOriginal,
    montoRecargo = 0,
    montoBonificacion = 0,
    fechaVencimiento,
    cargoOrigenId
  } = req.body

  if (!socioId || !montoOriginal) {
    throw new AppError('socioId y montoOriginal son requeridos', 400, 'VALIDATION_ERROR')
  }

  if (!centroCostoId) {
    throw new AppError('El Centro de Costo es obligatorio', 400, 'CC_REQUIRED')
  }

  // Si no viene categoría, derivarla del concepto o usar CUOTA_ACTIVIDAD por defecto
  let categoriaFinal = categoria || 'CUOTA_ACTIVIDAD'

  // Validar categoría
  const catValida = await req.db.categoriaCargo.findFirst({ where: { codigo: categoriaFinal } })
  if (!catValida) {
    throw new AppError(`Categoría inválida: ${categoriaFinal}`, 400, 'INVALID_CATEGORIA')
  }

  // Resolver descripción desde el concepto si no viene explícita
  let descripcionFinal = descripcion
  if (conceptoTesoreriaId && !descripcionFinal) {
    const concepto = await req.db.conceptoTesoreria.findUnique({
      where: { id: parseInt(conceptoTesoreriaId) },
      select: { nombre: true },
    })
    if (concepto) descripcionFinal = concepto.nombre
  }

  // Verificar que exista el socio
  const socio = await req.db.socio.findUnique({
    where: { id: parseInt(socioId) },
    select: { id: true, titularFamiliaId: true },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  const montoTotal = parseFloat(montoOriginal) + parseFloat(montoRecargo) - parseFloat(montoBonificacion)

  const cargo = await req.db.cargo.create({
    data: {
      socioId: parseInt(socioId),
      grupoFamiliarId: socio.titularFamiliaId || socio.id,
      categoria: categoriaFinal,
      periodoId: periodoId ? parseInt(periodoId) : null,
      categoriaActividadId: categoriaActividadId ? parseInt(categoriaActividadId) : null,
      conceptoTesoreriaId: conceptoTesoreriaId ? parseInt(conceptoTesoreriaId) : null,
      centroCostoId: parseInt(centroCostoId),
      descripcion: descripcionFinal,
      montoOriginal: parseFloat(montoOriginal),
      montoRecargo: parseFloat(montoRecargo),
      montoBonificacion: parseFloat(montoBonificacion),
      montoTotal,
      fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : new Date(),
      cargoOrigenId: cargoOrigenId ? parseInt(cargoOrigenId) : null,
      origen: 'MANUAL',
    },
    include: {
      socio: { select: { id: true, nroSocio: true, apellidoNombre: true } },
      periodo: { select: { nombre: true } },
    },
  })

  res.status(201).json({ success: true, data: cargo })
}))

// DELETE /api/admin/cargos/:id - Anular cargo
router.delete('/cargos/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const cargo = await req.db.cargo.findUnique({
    where: { id: parseInt(id) },
  })

  if (!cargo) {
    throw new AppError('Cargo no encontrado', 404, 'NOT_FOUND')
  }

  if (cargo.estado === 'PAGADO') {
    throw new AppError('No se puede eliminar un cargo pagado. Use nota de crédito.', 400, 'CARGO_PAGADO')
  }

  await req.db.cargo.update({
    where: { id: parseInt(id) },
    data: { estado: 'ANULADO' },
  })

  res.json({ success: true, message: 'Cargo anulado correctamente' })
}))

// ============================================
// CARGOS MASIVOS
// ============================================

// Función auxiliar: construye el where de socios según filtros
function buildFiltrosSocios(filtros = {}) {
  const where = {}

  if (filtros.estado && filtros.estado.length > 0) {
    const lista = Array.isArray(filtros.estado) ? filtros.estado : [filtros.estado]
    where.estadoSocioRel = { nombre: { in: lista } }
  }

  if (filtros.actividadId) {
    where.inscripciones = {
      some: {
        categoriaActividad: {
          actividadId: parseInt(filtros.actividadId)
        },
        estado: 'ACTIVA'
      }
    }
  }

  if (filtros.categoriaActividadId) {
    where.inscripciones = {
      some: {
        categoriaActividadId: parseInt(filtros.categoriaActividadId),
        estado: 'ACTIVA'
      }
    }
  }

  return where
}

// POST /api/admin/cargos/preview-masivo - Preview de socios afectados
router.post('/cargos/preview-masivo', authAdmin, asyncHandler(async (req, res) => {
  const { filtros = {} } = req.body
  const where = buildFiltrosSocios(filtros)

  const socios = await req.db.socio.findMany({
    where,
    select: {
      id: true,
      nroSocio: true,
      apellidoNombre: true,
      estadoSocioRel: { select: { nombre: true } },
      inscripciones: {
        where: { estado: 'ACTIVA' },
        select: {
          categoriaActividad: {
            select: { nombre: true, actividad: { select: { nombre: true } } }
          }
        }
      }
    },
    orderBy: { apellidoNombre: 'asc' }
  })

  res.json({ success: true, data: socios, total: socios.length })
}))

// POST /api/admin/cargos/masivo - Generar cargos masivos
router.post('/cargos/masivo', authAdmin, asyncHandler(async (req, res) => {
  const { conceptos, filtros = {} } = req.body

  if (!conceptos || !Array.isArray(conceptos) || conceptos.length === 0) {
    throw new AppError('Debe definir al menos un concepto', 400, 'VALIDATION_ERROR')
  }

  // Validar cada concepto
  for (const c of conceptos) {
    if (!c.conceptoTesoreriaId || !c.montoOriginal || !c.fechaVencimiento) {
      throw new AppError('Cada concepto requiere conceptoTesoreriaId, montoOriginal y fechaVencimiento', 400, 'VALIDATION_ERROR')
    }
  }

  // Resolver nombres de conceptos
  const conceptoIds = conceptos.map(c => parseInt(c.conceptoTesoreriaId))
  const conceptosDB = await req.db.conceptoTesoreria.findMany({
    where: { id: { in: conceptoIds } },
    select: { id: true, nombre: true }
  })
  const conceptoMap = Object.fromEntries(conceptosDB.map(c => [c.id, c]))

  // Obtener socios según filtros
  const where = buildFiltrosSocios(filtros)
  const socios = await req.db.socio.findMany({
    where,
    select: { id: true, titularFamiliaId: true }
  })

  if (socios.length === 0) {
    throw new AppError('No hay socios que cumplan los filtros seleccionados', 400, 'NO_SOCIOS')
  }

  // Pre-resolver períodos por concepto (mes/año de fechaVencimiento)
  const periodoMap = {}
  for (const concepto of conceptos) {
    const fv = new Date(concepto.fechaVencimiento)
    const anio = fv.getFullYear()
    const mes = fv.getMonth() + 1
    const key = `${anio}-${mes}`
    if (!periodoMap[key]) {
      // Buscar período existente, si no existe crearlo
      let periodo = await req.db.periodo.findFirst({ where: { anio, mes } })
      if (!periodo) {
        periodo = await req.db.periodo.create({
          data: {
            anio,
            mes,
            nombre: `${String(mes).padStart(2, '0')}/${anio}`,
            fechaVencimiento: fv,
          }
        })
      }
      periodoMap[key] = periodo.id
    }
    concepto._periodoId = periodoMap[key]
  }

  // Crear cargos en batch
  const loteId = randomUUID()
  let creados = 0
  let importeTotal = 0
  const errores = []

  for (const socio of socios) {
    for (const concepto of conceptos) {
      try {
        const cId = parseInt(concepto.conceptoTesoreriaId)
        const nombreConcepto = conceptoMap[cId]?.nombre || `Concepto #${cId}`
        const monto = parseFloat(concepto.montoOriginal)

        await req.db.cargo.create({
          data: {
            socioId: socio.id,
            grupoFamiliarId: socio.titularFamiliaId || socio.id,
            periodoId: concepto._periodoId,
            categoria: concepto.categoria || 'CUOTA_ACTIVIDAD',
            conceptoTesoreriaId: cId,
            descripcion: nombreConcepto,
            montoOriginal: monto,
            montoRecargo: 0,
            montoBonificacion: 0,
            montoTotal: monto,
            fechaVencimiento: new Date(concepto.fechaVencimiento),
            origen: 'MASIVO',
            estado: 'PENDIENTE',
            observaciones: concepto.observaciones || null,
            loteId
          }
        })
        creados++
        importeTotal += monto
      } catch (err) {
        errores.push({ socioId: socio.id, error: err.message })
      }
    }
  }

  res.json({
    success: true,
    data: { creados, errores, totalSocios: socios.length, importeTotal, loteId },
    message: `Se generaron ${creados} cargos para ${socios.length} socios`
  })
}))

// GET /api/admin/cargos/lotes - Listar lotes con filtros
router.get('/cargos/lotes', authAdmin, asyncHandler(async (req, res) => {
  const { fechaDesde, fechaHasta, conceptoTesoreriaId, categoria, estado } = req.query

  const where = { loteId: { not: null } }
  if (fechaDesde || fechaHasta) {
    where.createdAt = {}
    if (fechaDesde) where.createdAt.gte = new Date(fechaDesde)
    if (fechaHasta) where.createdAt.lte = new Date(fechaHasta + 'T23:59:59.999Z')
  }
  if (conceptoTesoreriaId) where.conceptoTesoreriaId = parseInt(conceptoTesoreriaId)
  if (categoria) where.categoria = categoria
  if (estado) where.estado = estado

  const agrupados = await req.db.cargo.groupBy({
    by: ['loteId'],
    where,
    _count: { id: true },
    _sum: { montoTotal: true },
    _min: { createdAt: true },
  })

  // Ordenar por fecha desc
  agrupados.sort((a, b) => new Date(b._min.createdAt) - new Date(a._min.createdAt))

  const lotes = await Promise.all(agrupados.map(async (g) => {
    const primer = await req.db.cargo.findFirst({
      where: { loteId: g.loteId },
      select: {
        categoria: true,
        conceptoTesoreria: { select: { id: true, nombre: true } },
        observaciones: true,
      }
    })
    const [pendientes, pagados] = await Promise.all([
      req.db.cargo.count({ where: { loteId: g.loteId, estado: 'PENDIENTE' } }),
      req.db.cargo.count({ where: { loteId: g.loteId, estado: 'PAGADO' } }),
    ])
    return {
      loteId: g.loteId,
      fechaCreacion: g._min.createdAt,
      totalCargos: g._count.id,
      importeTotal: Number(g._sum.montoTotal),
      pendientes,
      pagados,
      categoria: primer?.categoria,
      concepto: primer?.conceptoTesoreria?.nombre,
      conceptoId: primer?.conceptoTesoreria?.id,
      observaciones: primer?.observaciones,
    }
  }))

  res.json({ success: true, data: lotes })
}))

// GET /api/admin/cargos/lote/:loteId - Cargos de un lote
router.get('/cargos/lote/:loteId', authAdmin, asyncHandler(async (req, res) => {
  const { loteId } = req.params

  const cargos = await req.db.cargo.findMany({
    where: { loteId },
    include: {
      socio: { select: { id: true, nroSocio: true, apellidoNombre: true } },
      conceptoTesoreria: { select: { nombre: true } },
    },
    orderBy: [{ socio: { apellidoNombre: 'asc' } }, { createdAt: 'asc' }],
  })

  const resumen = {
    total: cargos.length,
    pendientes: cargos.filter(c => c.estado === 'PENDIENTE').length,
    pagados: cargos.filter(c => c.estado === 'PAGADO').length,
    importeTotal: cargos.reduce((acc, c) => acc + Number(c.montoTotal), 0),
    importePendiente: cargos.filter(c => c.estado === 'PENDIENTE').reduce((acc, c) => acc + Number(c.montoTotal), 0),
  }

  res.json({ success: true, data: { cargos, resumen } })
}))

// DELETE /api/admin/cargos/lote/:loteId - Elimina cargos PENDIENTES de un lote
router.delete('/cargos/lote/:loteId', authAdmin, asyncHandler(async (req, res) => {
  const { loteId } = req.params

  const { count } = await req.db.cargo.deleteMany({
    where: { loteId, estado: 'PENDIENTE' },
  })

  res.json({ success: true, data: { eliminados: count } })
}))

// ============================================
// PLANES DE PAGO
// ============================================

// POST /api/admin/planes-pago - Generar plan de pagos
router.post('/planes-pago', authAdmin, asyncHandler(async (req, res) => {
  const {
    socioId,
    cuotaIds,
    cantidadCuotas,
    interesPct,
    fechaPrimerVencimiento
  } = req.body

  if (!socioId || !cuotaIds || !cuotaIds.length || !cantidadCuotas || !fechaPrimerVencimiento) {
    throw new AppError('socioId, cuotaIds, cantidadCuotas y fechaPrimerVencimiento son requeridos', 400, 'VALIDATION_ERROR')
  }

  const cantCuotas = parseInt(cantidadCuotas)
  const interes = parseFloat(interesPct) || 0

  if (cantCuotas < 2 || cantCuotas > 24) {
    throw new AppError('La cantidad de cuotas debe ser entre 2 y 24', 400, 'VALIDATION_ERROR')
  }

  // Obtener cuotas a financiar
  const cuotasRaw = await req.db.cargo.findMany({
    where: {
      id: { in: cuotaIds.map(id => parseInt(id)) },
      estado: 'PENDIENTE',
    },
    include: {
      periodo: { select: { nombre: true } },
    },
  })

  if (cuotasRaw.length !== cuotaIds.length) {
    throw new AppError('Algunas cuotas no existen o ya están pagadas/financiadas', 400, 'INVALID_CUOTAS')
  }

  // Calcular recargo para cada cuota
  const cuotas = await Promise.all(cuotasRaw.map(async (cuota) => {
    const recargoCalc = await calcularRecargoCargo(req.prisma, cuota)
    return {
      ...cuota,
      recargoCalculado: recargoCalc.recargo,
    }
  }))

  // Calcular total a financiar
  const montoBase = cuotas.reduce((sum, c) => sum + Number(c.montoTotal), 0)
  const totalRecargo = cuotas.reduce((sum, c) => sum + c.recargoCalculado, 0)
  const subtotal = montoBase + totalRecargo
  const montoInteres = Math.round(subtotal * interes / 100)
  const totalAFinanciar = subtotal + montoInteres

  // Calcular monto por cuota (redondeado)
  const montoPorCuota = Math.ceil(totalAFinanciar / cantCuotas)

  // Obtener el socio para el grupo familiar
  const socio = await req.db.socio.findUnique({
    where: { id: parseInt(socioId) },
    select: { id: true, titularFamiliaId: true, apellidoNombre: true },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  // Generar descripción del plan
  const cuotasDesc = cuotas.map(c => c.periodo?.nombre || c.descripcion || `Cargo #${c.id}`).join(', ')
  const descripcionPlan = `Financiación: ${cuotasDesc}`

  // Todo dentro de una transacción
  const resultado = await req.db.$transaction(async (tx) => {
    // 1. Marcar cuotas originales como FINANCIADA
    await tx.cargo.updateMany({
      where: { id: { in: cuotaIds.map(id => parseInt(id)) } },
      data: { estado: 'FINANCIADA' },
    })

    // 2. Crear cuotas del plan de pago
    const cuotasCreadas = []
    const fechaBase = new Date(fechaPrimerVencimiento)

    for (let i = 0; i < cantCuotas; i++) {
      // Calcular fecha de vencimiento (sumando meses)
      const fechaVenc = new Date(fechaBase)
      fechaVenc.setMonth(fechaVenc.getMonth() + i)

      // Buscar o crear el periodo correspondiente a la fecha de vencimiento
      const mes = fechaVenc.getMonth() + 1 // getMonth() es 0-based
      const anio = fechaVenc.getFullYear()
      const nombrePeriodo = `${String(mes).padStart(2, '0')}/${anio}`

      let periodo = await tx.periodo.findFirst({
        where: { mes, anio },
      })

      if (!periodo) {
        // La fecha de vencimiento del periodo es el día 10 del mes (configurable)
        const fechaVencPeriodo = new Date(anio, mes - 1, 10)
        periodo = await tx.periodo.create({
          data: {
            nombre: nombrePeriodo,
            mes,
            anio,
            fechaVencimiento: fechaVencPeriodo,
            estado: 'ABIERTO',
          },
        })
      }

      // Si es la última cuota, ajustar monto para que el total sea exacto
      let montoCuota = montoPorCuota
      if (i === cantCuotas - 1) {
        const sumaPrevias = montoPorCuota * (cantCuotas - 1)
        montoCuota = totalAFinanciar - sumaPrevias
      }

      const cargo = await tx.cargo.create({
        data: {
          socioId: parseInt(socioId),
          grupoFamiliarId: socio.titularFamiliaId || socio.id,
          categoria: 'FINANCIACION',
          periodoId: periodo.id,
          descripcion: `${descripcionPlan} - Cuota ${i + 1}/${cantCuotas}`,
          montoOriginal: montoCuota,
          montoRecargo: 0,
          montoBonificacion: 0,
          montoTotal: montoCuota,
          fechaVencimiento: fechaVenc,
          cargoOrigenId: cuotas[0].id, // Vinculamos al primer cargo original
          origen: 'FINANCIACION',
        },
      })
      cuotasCreadas.push(cargo)
    }

    return {
      cuotasFinanciadas: cuotas.length,
      cuotasGeneradas: cuotasCreadas.length,
      montoOriginal: montoBase,
      montoRecargo: totalRecargo,
      montoInteres,
      totalFinanciado: totalAFinanciar,
      montoPorCuota,
      cuotas: cuotasCreadas,
    }
  })

  res.status(201).json({
    success: true,
    data: resultado,
    message: `Plan de pagos generado: ${resultado.cuotasGeneradas} cuotas de $${resultado.montoPorCuota}`,
  })
}))

// GET /api/admin/planes-pago/preview - Preview de plan de pagos (sin crear)
router.post('/planes-pago/preview', authAdmin, asyncHandler(async (req, res) => {
  const {
    cuotaIds,
    cantidadCuotas,
    interesPct,
    fechaPrimerVencimiento
  } = req.body

  if (!cuotaIds || !cuotaIds.length || !cantidadCuotas || !fechaPrimerVencimiento) {
    throw new AppError('cuotaIds, cantidadCuotas y fechaPrimerVencimiento son requeridos', 400, 'VALIDATION_ERROR')
  }

  const cantCuotas = parseInt(cantidadCuotas)
  const interes = parseFloat(interesPct) || 0

  // Obtener cuotas
  const cuotasRaw = await req.db.cargo.findMany({
    where: {
      id: { in: cuotaIds.map(id => parseInt(id)) },
      estado: 'PENDIENTE',
    },
    include: {
      periodo: { select: { nombre: true } },
    },
  })

  // Calcular recargos
  const cuotas = await Promise.all(cuotasRaw.map(async (cuota) => {
    const recargoCalc = await calcularRecargoCargo(req.prisma, cuota)
    return {
      id: cuota.id,
      descripcion: cuota.periodo?.nombre || cuota.descripcion || `Cargo #${cuota.id}`,
      montoOriginal: Number(cuota.montoTotal),
      recargo: recargoCalc.recargo,
      total: Number(cuota.montoTotal) + recargoCalc.recargo,
    }
  }))

  const montoBase = cuotas.reduce((sum, c) => sum + c.montoOriginal, 0)
  const totalRecargo = cuotas.reduce((sum, c) => sum + c.recargo, 0)
  const subtotal = montoBase + totalRecargo
  const montoInteres = Math.round(subtotal * interes / 100)
  const totalAFinanciar = subtotal + montoInteres
  const montoPorCuota = Math.ceil(totalAFinanciar / cantCuotas)

  // Generar preview de cuotas
  const cuotasPreview = []
  const fechaBase = new Date(fechaPrimerVencimiento)

  for (let i = 0; i < cantCuotas; i++) {
    const fechaVenc = new Date(fechaBase)
    fechaVenc.setMonth(fechaVenc.getMonth() + i)

    let monto = montoPorCuota
    if (i === cantCuotas - 1) {
      monto = totalAFinanciar - (montoPorCuota * (cantCuotas - 1))
    }

    cuotasPreview.push({
      numero: i + 1,
      fechaVencimiento: fechaVenc.toISOString().split('T')[0],
      monto,
    })
  }

  res.json({
    success: true,
    data: {
      cuotasAFinanciar: cuotas,
      resumen: {
        montoBase,
        totalRecargo,
        subtotal,
        interesPct: interes,
        montoInteres,
        totalAFinanciar,
        cantidadCuotas: cantCuotas,
        montoPorCuota,
      },
      cuotasGeneradas: cuotasPreview,
    },
  })
}))


export default router
