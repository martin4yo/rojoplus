import { Router } from 'express'
import * as XLSX from 'xlsx'
import { asyncHandler } from '../middleware/errorHandler.js'
import { authAdmin } from '../middleware/auth.js'

const router = Router()

// Función para calcular recargo de un cargo (duplicada de admin.js para modularidad)
async function calcularRecargoCargo(prisma, cargo) {
  if (!cargo.fechaVencimiento || cargo.estado !== 'PENDIENTE') {
    return { recargo: 0, porcentaje: 0, diasMora: 0, montoConRecargo: Number(cargo.montoTotal) }
  }

  const hoy = new Date()
  const vencimiento = new Date(cargo.fechaVencimiento)
  const diasMora = Math.floor((hoy - vencimiento) / (1000 * 60 * 60 * 24))

  if (diasMora <= 0) {
    return { recargo: 0, porcentaje: 0, diasMora: 0, montoConRecargo: Number(cargo.montoTotal) }
  }

  const config = await prisma.configuracionRecargo.findFirst({
    where: { activo: true },
  })

  if (!config || Number(config.porcentaje) === 0) {
    return { recargo: 0, porcentaje: 0, diasMora, montoConRecargo: Number(cargo.montoTotal) }
  }

  let porcentajeRecargo = 0

  if (config.tipo === 'FIJO') {
    porcentajeRecargo = Number(config.porcentaje)
  } else {
    // ACUMULATIVO: porcentaje × (diasMora / cadaDias)
    const periodos = Math.floor(diasMora / (config.cadaDias || 30))
    porcentajeRecargo = periodos * Number(config.porcentaje)

    // Aplicar tope máximo si está definido
    if (config.topeMaximo && porcentajeRecargo > Number(config.topeMaximo)) {
      porcentajeRecargo = Number(config.topeMaximo)
    }
  }

  const montoOriginal = Number(cargo.montoOriginal)
  const recargo = Math.round(montoOriginal * porcentajeRecargo / 100)

  return {
    recargo,
    porcentaje: porcentajeRecargo,
    diasMora,
    montoConRecargo: Number(cargo.montoTotal) + recargo,
  }
}

// GET /api/admin/reportes/morosidad/resumen-kpis
// KPIs principales de morosidad
router.get('/resumen-kpis', authAdmin, asyncHandler(async (req, res) => {
  const hoy = new Date()

  // Cuotas vencidas pendientes
  const cuotasVencidas = await req.prisma.cargo.findMany({
    where: {
      estado: 'PENDIENTE',
      fechaVencimiento: { lt: hoy },
    },
    select: {
      id: true,
      montoOriginal: true,
      montoTotal: true,
      fechaVencimiento: true,
      socioId: true,
    },
  })

  // Calcular recargos
  let totalRecargos = 0
  for (const cuota of cuotasVencidas) {
    const resultado = await calcularRecargoCargo(req.prisma, cuota)
    totalRecargos += resultado.recargo
  }

  // Socios únicos con deuda
  const sociosUnicos = new Set(cuotasVencidas.map(c => c.socioId))

  // Total de deuda
  const totalDeuda = cuotasVencidas.reduce((sum, c) => sum + Number(c.montoTotal), 0)

  // Promedio de deuda por socio
  const promedioDeuda = sociosUnicos.size > 0 ? Math.round(totalDeuda / sociosUnicos.size) : 0

  // Días promedio de atraso
  let sumaDias = 0
  for (const cuota of cuotasVencidas) {
    const dias = Math.floor((hoy - new Date(cuota.fechaVencimiento)) / (1000 * 60 * 60 * 24))
    sumaDias += dias
  }
  const promedioAtraso = cuotasVencidas.length > 0 ? Math.round(sumaDias / cuotasVencidas.length) : 0

  // Total de socios activos para calcular % de morosidad
  const totalSociosActivos = await req.prisma.socio.count({
    where: {
      OR: [
        { estado: { contains: 'Activ', mode: 'insensitive' } },
        { estado: { contains: 'Vigent', mode: 'insensitive' } },
      ],
    },
  })

  const porcentajeMorosidad = totalSociosActivos > 0
    ? Math.round((sociosUnicos.size / totalSociosActivos) * 100 * 10) / 10
    : 0

  res.json({
    success: true,
    data: {
      totalMorosos: sociosUnicos.size,
      totalCuotasVencidas: cuotasVencidas.length,
      totalDeuda: Math.round(totalDeuda),
      totalRecargos: Math.round(totalRecargos),
      totalConRecargos: Math.round(totalDeuda + totalRecargos),
      promedioDeuda,
      promedioAtraso,
      porcentajeMorosidad,
      totalSociosActivos,
    },
  })
}))

// GET /api/admin/reportes/morosidad/antiguedad
// Análisis de antigüedad de deuda por rangos
router.get('/antiguedad', authAdmin, asyncHandler(async (req, res) => {
  const { categoria, actividadId } = req.query
  const hoy = new Date()

  // Construir filtro
  const where = {
    estado: 'PENDIENTE',
    fechaVencimiento: { lt: hoy },
  }

  if (categoria) where.categoria = categoria
  if (actividadId) {
    const categorias = await req.prisma.categoriaActividad.findMany({
      where: { actividadId: parseInt(actividadId) },
      select: { id: true },
    })
    where.categoriaActividadId = { in: categorias.map(c => c.id) }
  }

  // Obtener cuotas vencidas
  const cuotasVencidas = await req.prisma.cargo.findMany({
    where,
    select: {
      id: true,
      montoOriginal: true,
      montoTotal: true,
      fechaVencimiento: true,
      socioId: true,
    },
  })

  // Rangos de antigüedad
  const rangos = [
    { label: '0-30 días', min: 0, max: 30 },
    { label: '31-60 días', min: 31, max: 60 },
    { label: '61-90 días', min: 61, max: 90 },
    { label: '91-120 días', min: 91, max: 120 },
    { label: 'Más de 120 días', min: 121, max: Infinity },
  ]

  // Clasificar cuotas por rango
  const resultado = rangos.map(rango => ({
    rango: rango.label,
    cantCuotas: 0,
    cantSocios: new Set(),
    montoTotal: 0,
    recargoEstimado: 0,
  }))

  for (const cuota of cuotasVencidas) {
    const diasAtraso = Math.floor((hoy - new Date(cuota.fechaVencimiento)) / (1000 * 60 * 60 * 24))
    const recargo = await calcularRecargoCargo(req.prisma, cuota)

    for (let i = 0; i < rangos.length; i++) {
      if (diasAtraso >= rangos[i].min && diasAtraso <= rangos[i].max) {
        resultado[i].cantCuotas++
        resultado[i].cantSocios.add(cuota.socioId)
        resultado[i].montoTotal += Number(cuota.montoTotal)
        resultado[i].recargoEstimado += recargo.recargo
        break
      }
    }
  }

  // Calcular totales y porcentajes
  const totalDeuda = resultado.reduce((sum, r) => sum + r.montoTotal, 0)

  const antiguedad = resultado.map(r => ({
    rango: r.rango,
    cantCuotas: r.cantCuotas,
    cantSocios: r.cantSocios.size,
    montoTotal: Math.round(r.montoTotal),
    recargoEstimado: Math.round(r.recargoEstimado),
    montoConRecargo: Math.round(r.montoTotal + r.recargoEstimado),
    porcentaje: totalDeuda > 0 ? Math.round((r.montoTotal / totalDeuda) * 100) : 0,
  }))

  res.json({
    success: true,
    data: {
      antiguedad,
      totales: {
        cantCuotas: cuotasVencidas.length,
        cantSocios: new Set(cuotasVencidas.map(c => c.socioId)).size,
        montoTotal: Math.round(totalDeuda),
        recargoEstimado: Math.round(resultado.reduce((sum, r) => sum + r.recargoEstimado, 0)),
      },
    },
  })
}))

// GET /api/admin/reportes/morosidad/proyeccion
// Proyección de recargos a futuro
router.get('/proyeccion', authAdmin, asyncHandler(async (req, res) => {
  const { diasProyeccion = 30 } = req.query
  const dias = parseInt(diasProyeccion)
  const hoy = new Date()

  // Obtener configuración de recargos
  const config = await req.prisma.configuracionRecargo.findFirst({
    where: { activo: true },
  })

  if (!config) {
    return res.json({
      success: true,
      data: {
        mensaje: 'No hay configuración de recargos activa',
        proyecciones: [],
      },
    })
  }

  // Cuotas pendientes (incluye no vencidas que podrían vencer)
  const cuotasPendientes = await req.prisma.cargo.findMany({
    where: {
      estado: 'PENDIENTE',
      fechaVencimiento: { not: null },
    },
    select: {
      id: true,
      montoOriginal: true,
      montoTotal: true,
      fechaVencimiento: true,
    },
  })

  // Calcular proyección a diferentes plazos
  const plazos = [0, 15, 30, 60, 90]
  const proyecciones = []

  for (const plazo of plazos) {
    const fechaProyeccion = new Date(hoy.getTime() + plazo * 24 * 60 * 60 * 1000)
    let totalRecargo = 0
    let totalDeuda = 0
    let cuotasVencidas = 0

    for (const cuota of cuotasPendientes) {
      const vencimiento = new Date(cuota.fechaVencimiento)
      const diasMora = Math.floor((fechaProyeccion - vencimiento) / (1000 * 60 * 60 * 24))

      if (diasMora > 0) {
        cuotasVencidas++
        totalDeuda += Number(cuota.montoTotal)

        let porcentajeRecargo = 0
        if (config.tipo === 'FIJO') {
          porcentajeRecargo = Number(config.porcentaje)
        } else {
          const periodos = Math.floor(diasMora / (config.cadaDias || 30))
          porcentajeRecargo = periodos * Number(config.porcentaje)
          if (config.topeMaximo && porcentajeRecargo > Number(config.topeMaximo)) {
            porcentajeRecargo = Number(config.topeMaximo)
          }
        }

        totalRecargo += Math.round(Number(cuota.montoOriginal) * porcentajeRecargo / 100)
      }
    }

    proyecciones.push({
      dias: plazo,
      label: plazo === 0 ? 'Hoy' : `En ${plazo} días`,
      cuotasVencidas,
      totalDeuda: Math.round(totalDeuda),
      totalRecargo: Math.round(totalRecargo),
      totalConRecargo: Math.round(totalDeuda + totalRecargo),
    })
  }

  res.json({
    success: true,
    data: {
      configuracion: {
        tipo: config.tipo,
        porcentaje: Number(config.porcentaje),
        cadaDias: config.cadaDias,
        topeMaximo: config.topeMaximo ? Number(config.topeMaximo) : null,
      },
      proyecciones,
    },
  })
}))

// GET /api/admin/reportes/morosidad/detalle
// Lista detallada de morosos con filtros avanzados
router.get('/detalle', authAdmin, asyncHandler(async (req, res) => {
  const {
    categoria,
    actividadId,
    diasMinimo,
    diasMaximo,
    montoMinimo,
    montoMaximo,
    ordenarPor = 'deuda', // deuda, dias, nombre
    orden = 'desc',
    page = 1,
    limit = 50,
  } = req.query

  const hoy = new Date()
  const skip = (parseInt(page) - 1) * parseInt(limit)

  // Construir filtro base
  const where = {
    estado: 'PENDIENTE',
    fechaVencimiento: { lt: hoy },
  }

  if (categoria) where.categoria = categoria
  if (actividadId) {
    const categorias = await req.prisma.categoriaActividad.findMany({
      where: { actividadId: parseInt(actividadId) },
      select: { id: true },
    })
    where.categoriaActividadId = { in: categorias.map(c => c.id) }
  }

  // Obtener cuotas
  const cuotas = await req.prisma.cargo.findMany({
    where,
    include: {
      socio: {
        select: {
          id: true,
          nroSocio: true,
          apellidoNombre: true,
          celular: true,
          email: true,
          documento: true,
        },
      },
      periodo: { select: { nombre: true } },
      categoriaActividad: {
        include: {
          actividad: { select: { nombre: true } },
        },
      },
    },
  })

  // Agrupar por socio y calcular recargos
  const sociosMap = {}

  for (const cuota of cuotas) {
    const socioId = cuota.socioId
    const diasAtraso = Math.floor((hoy - new Date(cuota.fechaVencimiento)) / (1000 * 60 * 60 * 24))
    const recargo = await calcularRecargoCargo(req.prisma, cuota)

    if (!sociosMap[socioId]) {
      sociosMap[socioId] = {
        socio: cuota.socio,
        cuotas: [],
        totalDeuda: 0,
        totalRecargo: 0,
        cantCuotas: 0,
        maxDiasAtraso: 0,
      }
    }

    sociosMap[socioId].cuotas.push({
      id: cuota.id,
      concepto: cuota.categoriaActividad
        ? `${cuota.categoriaActividad.actividad.nombre} - ${cuota.categoriaActividad.nombre}`
        : cuota.categoria,
      periodo: cuota.periodo?.nombre,
      monto: Number(cuota.montoTotal),
      recargo: recargo.recargo,
      diasAtraso,
      fechaVencimiento: cuota.fechaVencimiento,
    })

    sociosMap[socioId].totalDeuda += Number(cuota.montoTotal)
    sociosMap[socioId].totalRecargo += recargo.recargo
    sociosMap[socioId].cantCuotas++
    sociosMap[socioId].maxDiasAtraso = Math.max(sociosMap[socioId].maxDiasAtraso, diasAtraso)
  }

  let morosos = Object.values(sociosMap)

  // Aplicar filtros adicionales
  if (diasMinimo) {
    morosos = morosos.filter(m => m.maxDiasAtraso >= parseInt(diasMinimo))
  }
  if (diasMaximo) {
    morosos = morosos.filter(m => m.maxDiasAtraso <= parseInt(diasMaximo))
  }
  if (montoMinimo) {
    morosos = morosos.filter(m => m.totalDeuda >= parseFloat(montoMinimo))
  }
  if (montoMaximo) {
    morosos = morosos.filter(m => m.totalDeuda <= parseFloat(montoMaximo))
  }

  // Ordenar
  morosos.sort((a, b) => {
    let valorA, valorB
    switch (ordenarPor) {
      case 'dias':
        valorA = a.maxDiasAtraso
        valorB = b.maxDiasAtraso
        break
      case 'nombre':
        valorA = a.socio.apellidoNombre
        valorB = b.socio.apellidoNombre
        break
      default: // deuda
        valorA = a.totalDeuda
        valorB = b.totalDeuda
    }
    if (ordenarPor === 'nombre') {
      return orden === 'asc' ? valorA.localeCompare(valorB) : valorB.localeCompare(valorA)
    }
    return orden === 'asc' ? valorA - valorB : valorB - valorA
  })

  // Paginación
  const total = morosos.length
  morosos = morosos.slice(skip, skip + parseInt(limit))

  res.json({
    success: true,
    data: {
      morosos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
      totales: {
        cantSocios: total,
        totalDeuda: Object.values(sociosMap).reduce((sum, m) => sum + m.totalDeuda, 0),
        totalRecargo: Object.values(sociosMap).reduce((sum, m) => sum + m.totalRecargo, 0),
      },
    },
  })
}))

// GET /api/admin/reportes/morosidad/exportar
// Exportar a Excel
router.get('/exportar', authAdmin, asyncHandler(async (req, res) => {
  const { categoria, actividadId, diasMinimo } = req.query
  const hoy = new Date()

  // Construir filtro
  const where = {
    estado: 'PENDIENTE',
    fechaVencimiento: { lt: hoy },
  }

  if (categoria) where.categoria = categoria
  if (actividadId) {
    const categorias = await req.prisma.categoriaActividad.findMany({
      where: { actividadId: parseInt(actividadId) },
      select: { id: true },
    })
    where.categoriaActividadId = { in: categorias.map(c => c.id) }
  }

  // Obtener cuotas con socio
  const cuotas = await req.prisma.cargo.findMany({
    where,
    include: {
      socio: {
        select: {
          nroSocio: true,
          apellidoNombre: true,
          celular: true,
          email: true,
          documento: true,
        },
      },
      periodo: { select: { nombre: true } },
      categoriaActividad: {
        include: {
          actividad: { select: { nombre: true } },
        },
      },
    },
    orderBy: [
      { socio: { apellidoNombre: 'asc' } },
      { fechaVencimiento: 'asc' },
    ],
  })

  // Procesar datos para Excel
  const filas = []
  for (const cuota of cuotas) {
    const diasAtraso = Math.floor((hoy - new Date(cuota.fechaVencimiento)) / (1000 * 60 * 60 * 24))

    if (diasMinimo && diasAtraso < parseInt(diasMinimo)) continue

    const recargo = await calcularRecargoCargo(req.prisma, cuota)

    filas.push({
      'Nro Socio': cuota.socio.nroSocio,
      'Nombre': cuota.socio.apellidoNombre,
      'Documento': cuota.socio.documento,
      'Teléfono': cuota.socio.celular,
      'Email': cuota.socio.email,
      'Concepto': cuota.categoriaActividad
        ? `${cuota.categoriaActividad.actividad.nombre} - ${cuota.categoriaActividad.nombre}`
        : cuota.categoria?.replace(/_/g, ' '),
      'Período': cuota.periodo?.nombre || '-',
      'Vencimiento': cuota.fechaVencimiento?.toLocaleDateString('es-AR') || '-',
      'Días Atraso': diasAtraso,
      'Monto Original': Number(cuota.montoOriginal),
      'Recargo': recargo.recargo,
      'Total': Number(cuota.montoTotal) + recargo.recargo,
    })
  }

  // Crear workbook
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(filas)

  // Ajustar anchos de columna
  ws['!cols'] = [
    { wch: 10 }, // Nro Socio
    { wch: 30 }, // Nombre
    { wch: 12 }, // Documento
    { wch: 15 }, // Teléfono
    { wch: 25 }, // Email
    { wch: 25 }, // Concepto
    { wch: 12 }, // Período
    { wch: 12 }, // Vencimiento
    { wch: 10 }, // Días Atraso
    { wch: 12 }, // Monto Original
    { wch: 10 }, // Recargo
    { wch: 12 }, // Total
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Morosidad')

  // Generar buffer
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  // Enviar archivo
  const fecha = new Date().toISOString().split('T')[0]
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename=morosidad_${fecha}.xlsx`)
  res.send(buffer)
}))

export default router
