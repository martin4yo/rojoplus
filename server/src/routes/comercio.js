import { Router } from 'express'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { authComercio } from '../middleware/auth.js'

const router = Router()

// GET /api/comercio/:token - Info del comercio
router.get('/:token', asyncHandler(authComercio), asyncHandler(async (req, res) => {
  const { comercio } = req

  res.json({
    success: true,
    data: {
      id: comercio.id,
      nombre: comercio.nombre,
      direccion: comercio.direccion,
      rubroId: comercio.rubroId,
      telefono: comercio.telefono,
      email: comercio.email,
      cuit: comercio.cuit,
      responsable: comercio.responsable,
      logo: comercio.logo,
      latitud: comercio.latitud,
      longitud: comercio.longitud,
      descuentoDisponibleId: comercio.descuentoDisponibleId,
      descuentoPct: Number(comercio.descuentoPct),
      diasAplicacion: comercio.diasAplicacion,
      acumulacionActiva: comercio.acumulacionActiva,
      acumComprasReq: comercio.acumComprasReq,
      acumPeriodoDias: comercio.acumPeriodoDias,
      acumDescuentoExtra: comercio.acumDescuentoExtra ? Number(comercio.acumDescuentoExtra) : null,
    },
  })
}))

// GET /api/comercio/:token/socios/buscar - Buscar socio
router.get('/:token/socios/buscar', asyncHandler(authComercio), asyncHandler(async (req, res) => {
  const { q } = req.query

  if (!q) {
    throw new AppError('Parámetro de búsqueda requerido', 400, 'VALIDATION_ERROR')
  }

  const socio = await req.db.socio.findFirst({
    where: {
      OR: [
        { nroSocio: q },
        { documento: q },
      ],
    },
    select: {
      id: true,
      nroSocio: true,
      apellidoNombre: true,
      estado: true,
    },
  })

  if (!socio) {
    return res.json({ success: true, data: null })
  }

  // Determinar si está activo (ACTIVO o VIGENTE)
  const estadoUpper = socio.estado?.toUpperCase() || ''
  const esActivo = estadoUpper.includes('ACTIV') || estadoUpper.includes('VIGENT')

  res.json({
    success: true,
    data: {
      id: socio.id,
      nroSocio: socio.nroSocio,
      apellidoNombre: socio.apellidoNombre,
      estado: socio.estado,
      esActivo,
    },
  })
}))

// GET /api/comercio/:token/socios/buscar-qr - Buscar socio por token QR
router.get('/:token/socios/buscar-qr', asyncHandler(authComercio), asyncHandler(async (req, res) => {
  const { token: tokenSocio } = req.query

  if (!tokenSocio) {
    throw new AppError('Token de socio requerido', 400, 'VALIDATION_ERROR')
  }

  const socio = await req.db.socio.findFirst({
    where: { tokenPortal: tokenSocio },
    select: {
      id: true,
      nroSocio: true,
      apellidoNombre: true,
      estado: true,
    },
  })

  if (!socio) {
    return res.json({ success: true, data: null })
  }

  // Determinar si está activo (ACTIVO o VIGENTE)
  const estadoUpper = socio.estado?.toUpperCase() || ''
  const esActivo = estadoUpper.includes('ACTIV') || estadoUpper.includes('VIGENT')

  res.json({
    success: true,
    data: {
      id: socio.id,
      nroSocio: socio.nroSocio,
      apellidoNombre: socio.apellidoNombre,
      estado: socio.estado,
      esActivo,
    },
  })
}))

// POST /api/comercio/:token/ventas/calcular - Calcular descuento (preview)
router.post('/:token/ventas/calcular', asyncHandler(authComercio), asyncHandler(async (req, res) => {
  const { comercio } = req
  const { socioId, importeOriginal } = req.body

  if (!socioId || !importeOriginal) {
    throw new AppError('socioId e importeOriginal son requeridos', 400, 'VALIDATION_ERROR')
  }

  // Descuento base
  const descuentoBasePct = Number(comercio.descuentoPct)
  const descuentoBaseMonto = importeOriginal * (descuentoBasePct / 100)

  // Verificar acumulación
  let aplicaAcumulacion = false
  let comprasEnPeriodo = 0
  let descuentoAcumPct = 0
  let descuentoAcumMonto = 0

  if (comercio.acumulacionActiva && comercio.acumComprasReq && comercio.acumPeriodoDias) {
    const fechaLimite = new Date()
    fechaLimite.setDate(fechaLimite.getDate() - comercio.acumPeriodoDias)

    comprasEnPeriodo = await req.db.venta.count({
      where: {
        comercioId: comercio.id,
        socioId,
        fecha: { gte: fechaLimite },
      },
    })

    if (comprasEnPeriodo >= comercio.acumComprasReq) {
      aplicaAcumulacion = true
      descuentoAcumPct = Number(comercio.acumDescuentoExtra) || 0
      descuentoAcumMonto = importeOriginal * (descuentoAcumPct / 100)
    }
  }

  const descuentoTotalMonto = descuentoBaseMonto + descuentoAcumMonto
  const importeFinal = importeOriginal - descuentoTotalMonto

  res.json({
    success: true,
    data: {
      importeOriginal,
      descuentoBasePct,
      descuentoBaseMonto: Math.round(descuentoBaseMonto * 100) / 100,
      aplicaAcumulacion,
      comprasEnPeriodo,
      descuentoAcumPct,
      descuentoAcumMonto: Math.round(descuentoAcumMonto * 100) / 100,
      descuentoTotalMonto: Math.round(descuentoTotalMonto * 100) / 100,
      importeFinal: Math.round(importeFinal * 100) / 100,
    },
  })
}))

// POST /api/comercio/:token/ventas - Registrar venta
router.post('/:token/ventas', asyncHandler(authComercio), asyncHandler(async (req, res) => {
  const { comercio } = req
  const { socioId, importeOriginal } = req.body

  if (!socioId) {
    throw new AppError('socioId es requerido', 400, 'VALIDATION_ERROR')
  }

  // Verificar que el socio existe y está activo
  const socio = await req.db.socio.findUnique({
    where: { id: socioId },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  const estadoUpper = socio.estado?.toUpperCase() || ''
  const esActivo = estadoUpper.includes('ACTIV') || estadoUpper.includes('VIGENT')
  if (!esActivo) {
    throw new AppError('El socio no está activo', 422, 'SOCIO_INACTIVO')
  }

  // Si no hay importe, registrar venta sin descuentos
  let descuentoBasePct = 0
  let descuentoBaseMonto = 0
  let aplicoAcumulacion = false
  let descuentoAcumPct = null
  let descuentoAcumMonto = 0
  let descuentoTotalMonto = 0
  let importeFinal = null

  if (importeOriginal) {
    // Calcular descuentos solo si hay importe
    descuentoBasePct = Number(comercio.descuentoPct)
    descuentoBaseMonto = importeOriginal * (descuentoBasePct / 100)

    if (comercio.acumulacionActiva && comercio.acumComprasReq && comercio.acumPeriodoDias) {
      const fechaLimite = new Date()
      fechaLimite.setDate(fechaLimite.getDate() - comercio.acumPeriodoDias)

      const comprasEnPeriodo = await req.db.venta.count({
        where: {
          comercioId: comercio.id,
          socioId,
          fecha: { gte: fechaLimite },
        },
      })

      if (comprasEnPeriodo >= comercio.acumComprasReq) {
        aplicoAcumulacion = true
        descuentoAcumPct = Number(comercio.acumDescuentoExtra) || 0
        descuentoAcumMonto = importeOriginal * (descuentoAcumPct / 100)
      }
    }

    descuentoTotalMonto = descuentoBaseMonto + descuentoAcumMonto
    importeFinal = importeOriginal - descuentoTotalMonto
  }

  // Crear venta
  const venta = await req.db.venta.create({
    data: {
      comercio: { connect: { id: comercio.id } },
      socio: { connect: { id: socioId } },
      importeOriginal: importeOriginal || null,
      importeFinal,
      descuentoPct: descuentoBasePct || null,
      descuentoMonto: descuentoTotalMonto || null,
      aplicoAcumulacion,
      descuentoAcumPct,
    },
  })

  res.status(201).json({
    success: true,
    data: {
      id: venta.id,
      fecha: venta.fecha,
      importeOriginal: importeOriginal || null,
      importeFinal,
      descuentoPct: descuentoBasePct,
      descuentoMonto: descuentoTotalMonto,
      aplicoAcumulacion,
      descuentoAcumPct,
      mensaje: 'Venta registrada correctamente',
    },
  })
}))

export default router
