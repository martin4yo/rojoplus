import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import multer from 'multer'
import * as XLSX from 'xlsx'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { authAdmin, generateToken } from '../middleware/auth.js'
import { enviarEmailAprobacion, enviarEmailRechazo, enviarEmailLinkAcceso } from '../services/email.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

// Cache temporal para uploads
const uploadCache = new Map()

// POST /api/admin/login
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    throw new AppError('Email y contraseña son requeridos', 400, 'VALIDATION_ERROR')
  }

  const admin = await req.prisma.admin.findUnique({
    where: { email },
  })

  if (!admin || !admin.activo) {
    throw new AppError('Credenciales inválidas', 401, 'AUTH_INVALID')
  }

  const validPassword = await bcrypt.compare(password, admin.passwordHash)
  if (!validPassword) {
    throw new AppError('Credenciales inválidas', 401, 'AUTH_INVALID')
  }

  // Actualizar último login
  await req.prisma.admin.update({
    where: { id: admin.id },
    data: { lastLogin: new Date() },
  })

  const token = generateToken(admin)

  res.json({
    success: true,
    data: {
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        nombre: admin.nombre,
      },
    },
  })
}))

// GET /api/admin/dashboard
router.get('/dashboard', authAdmin, asyncHandler(async (req, res) => {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const inicioSemana = new Date(hoy)
  inicioSemana.setDate(inicioSemana.getDate() - 7)

  const [ventasHoy, ventasSemana, comerciosActivos, comerciosPendientes, sociosActivos] = await Promise.all([
    req.prisma.venta.aggregate({
      where: { fecha: { gte: hoy } },
      _count: true,
      _sum: { importeFinal: true },
    }),
    req.prisma.venta.aggregate({
      where: { fecha: { gte: inicioSemana } },
      _count: true,
      _sum: { importeFinal: true },
    }),
    req.prisma.comercio.count({ where: { estado: 'ACTIVO' } }),
    req.prisma.comercio.count({ where: { estado: 'PENDIENTE' } }),
    req.prisma.socio.count({
      where: {
        OR: [
          { estado: { contains: 'Activ', mode: 'insensitive' } },
          { estado: { contains: 'Vigent', mode: 'insensitive' } },
        ],
      },
    }),
  ])

  res.json({
    success: true,
    data: {
      ventasHoy: ventasHoy._count,
      montoTotalHoy: Number(ventasHoy._sum.importeFinal) || 0,
      ventasSemana: ventasSemana._count,
      montoTotalSemana: Number(ventasSemana._sum.importeFinal) || 0,
      comerciosActivos,
      comerciosPendientes,
      sociosActivos,
    },
  })
}))

// GET /api/admin/comercios
router.get('/comercios', authAdmin, asyncHandler(async (req, res) => {
  const { estado, page = 1, limit = 20 } = req.query

  const where = estado ? { estado } : {}

  const [comercios, total] = await Promise.all([
    req.prisma.comercio.findMany({
      where,
      include: { rubro: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit),
    }),
    req.prisma.comercio.count({ where }),
  ])

  res.json({
    success: true,
    data: {
      comercios: comercios.map(c => ({
        id: c.id,
        nombre: c.nombre,
        email: c.email,
        rubro: c.rubro?.nombre,
        estado: c.estado,
        descuentoPct: Number(c.descuentoPct),
        createdAt: c.createdAt,
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    },
  })
}))

// GET /api/admin/comercios/:id
router.get('/comercios/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const comercio = await req.prisma.comercio.findUnique({
    where: { id: parseInt(id) },
    include: { rubro: true },
  })

  if (!comercio) {
    throw new AppError('Comercio no encontrado', 404, 'NOT_FOUND')
  }

  // Stats
  const stats = await req.prisma.venta.aggregate({
    where: { comercioId: comercio.id },
    _count: true,
    _sum: { importeFinal: true },
  })

  res.json({
    success: true,
    data: {
      ...comercio,
      descuentoPct: Number(comercio.descuentoPct),
      acumDescuentoExtra: comercio.acumDescuentoExtra ? Number(comercio.acumDescuentoExtra) : null,
      totalVentas: stats._count,
      montoTotalVentas: Number(stats._sum.importeFinal) || 0,
    },
  })
}))

// POST /api/admin/comercios/:id/aprobar
router.post('/comercios/:id/aprobar', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const comercio = await req.prisma.comercio.update({
    where: { id: parseInt(id) },
    data: {
      estado: 'ACTIVO',
      token: uuidv4(),
      approvedAt: new Date(),
    },
  })

  // Enviar email con link de acceso
  try {
    await enviarEmailAprobacion(comercio)
  } catch (emailError) {
    console.error('Error enviando email de aprobación:', emailError)
  }

  res.json({
    success: true,
    data: {
      id: comercio.id,
      estado: comercio.estado,
      token: comercio.token,
      mensaje: 'Comercio aprobado. Se envió email con link de acceso.',
    },
  })
}))

// POST /api/admin/comercios/:id/rechazar
router.post('/comercios/:id/rechazar', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { motivo } = req.body

  const comercio = await req.prisma.comercio.update({
    where: { id: parseInt(id) },
    data: {
      estado: 'RECHAZADO',
      motivoRechazo: motivo,
    },
  })

  // Enviar email de rechazo
  try {
    await enviarEmailRechazo(comercio, motivo)
  } catch (emailError) {
    console.error('Error enviando email de rechazo:', emailError)
  }

  res.json({
    success: true,
    data: {
      id: comercio.id,
      estado: comercio.estado,
      mensaje: 'Comercio rechazado. Se envió email de notificación.',
    },
  })
}))

// PATCH /api/admin/comercios/:id
router.patch('/comercios/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { descuentoPct, acumulacionActiva, acumComprasReq, acumPeriodoDias, acumDescuentoExtra } = req.body

  const comercio = await req.prisma.comercio.update({
    where: { id: parseInt(id) },
    data: {
      descuentoPct,
      acumulacionActiva,
      acumComprasReq,
      acumPeriodoDias,
      acumDescuentoExtra,
    },
  })

  res.json({
    success: true,
    data: {
      id: comercio.id,
      mensaje: 'Comercio actualizado',
    },
  })
}))

// POST /api/admin/comercios/:id/desactivar
router.post('/comercios/:id/desactivar', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  await req.prisma.comercio.update({
    where: { id: parseInt(id) },
    data: { estado: 'INACTIVO' },
  })

  res.json({
    success: true,
    data: { mensaje: 'Comercio desactivado' },
  })
}))

// POST /api/admin/comercios/:id/reenviar-link
router.post('/comercios/:id/reenviar-link', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const comercio = await req.prisma.comercio.findUnique({
    where: { id: parseInt(id) },
  })

  if (!comercio) {
    throw new AppError('Comercio no encontrado', 404, 'NOT_FOUND')
  }

  if (!comercio.token) {
    throw new AppError('El comercio no tiene token de acceso', 400, 'NO_TOKEN')
  }

  // Enviar email con link de acceso
  try {
    await enviarEmailLinkAcceso(comercio)
  } catch (emailError) {
    console.error('Error enviando email:', emailError)
    throw new AppError('Error al enviar el email', 500, 'EMAIL_ERROR')
  }

  res.json({
    success: true,
    data: {
      mensaje: `Link de acceso reenviado a ${comercio.email}`,
    },
  })
}))

// GET /api/admin/socios
router.get('/socios', authAdmin, asyncHandler(async (req, res) => {
  const { q, estado, categoria, page = 1, limit = 20 } = req.query

  const where = {}

  if (q) {
    where.OR = [
      { nroSocio: { contains: q, mode: 'insensitive' } },
      { documento: { contains: q, mode: 'insensitive' } },
      { apellidoNombre: { contains: q, mode: 'insensitive' } },
    ]
  }

  if (estado) {
    where.estado = { contains: estado, mode: 'insensitive' }
  }

  if (categoria) {
    where.categoria = { contains: categoria, mode: 'insensitive' }
  }

  const [socios, total, estados, categorias] = await Promise.all([
    req.prisma.socio.findMany({
      where,
      orderBy: { nroSocio: 'asc' },
      skip: (page - 1) * limit,
      take: parseInt(limit),
      select: {
        id: true,
        nroSocio: true,
        documento: true,
        apellidoNombre: true,
        estado: true,
        categoria: true,
        tokenPortal: true,
      },
    }),
    req.prisma.socio.count({ where }),
    req.prisma.socio.groupBy({ by: ['estado'], _count: true }),
    req.prisma.socio.groupBy({ by: ['categoria'], _count: true }),
  ])

  res.json({
    success: true,
    data: {
      socios,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
      filtros: {
        estados: estados.map(e => e.estado).filter(Boolean).sort(),
        categorias: categorias.map(c => c.categoria).filter(Boolean).sort(),
      },
    },
  })
}))

// POST /api/admin/socios/:id/regenerar-token - Regenerar token de socio
router.post('/socios/:id/regenerar-token', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const socio = await req.prisma.socio.update({
    where: { id: parseInt(id) },
    data: { tokenPortal: uuidv4() },
    select: { id: true, nroSocio: true, tokenPortal: true },
  })

  res.json({
    success: true,
    data: {
      id: socio.id,
      nroSocio: socio.nroSocio,
      tokenPortal: socio.tokenPortal,
      mensaje: 'Token regenerado correctamente',
    },
  })
}))

// POST /api/admin/socios/upload
router.post('/socios/upload', authAdmin, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('Archivo no proporcionado', 400, 'FILE_REQUIRED')
  }

  const workbook = XLSX.read(req.file.buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  // Buscar la fila donde están los headers (buscar "Nro.Socio")
  const range = XLSX.utils.decode_range(sheet['!ref'])
  let headerRow = 0

  for (let r = 0; r <= Math.min(20, range.e.r); r++) {
    const cellA = sheet[XLSX.utils.encode_cell({ r, c: 0 })]
    if (cellA && String(cellA.v).includes('Nro.Socio')) {
      headerRow = r
      break
    }
  }

  // Leer desde la fila de headers
  const rows = XLSX.utils.sheet_to_json(sheet, { range: headerRow })

  const sociosParaCrear = []
  const sociosParaActualizar = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const nroSocio = String(row['Nro.Socio'] || row['NroSocio'] || row['nro_socio'] || '').trim()

    if (!nroSocio) {
      continue
    }

    const socioData = {
      nroSocio,
      apellidoNombre: row['ApellidoNombre'] || row['Nombre'] || '',
      documento: String(row['Documento'] || row['DNI'] || '').trim() || null,
      estado: row['Estado'] || 'ACTIVO',
      email: row['Email'] || null,
      celular: String(row['Celular'] || row['Telefono'] || '').trim() || null,
      categoria: row['Categoria'] || null,
      tipoSocio: row['TipoSocio'] || null,
      domicilio: row['Domicilio'] || null,
      ciudad: row['Ciudad'] || null,
    }

    // Fecha de nacimiento
    if (row['Fecha Nac.'] || row['FechaNac']) {
      try {
        const fechaRaw = row['Fecha Nac.'] || row['FechaNac']
        if (typeof fechaRaw === 'number') {
          // Excel date serial number
          socioData.fechaNacimiento = new Date((fechaRaw - 25569) * 86400 * 1000)
        } else if (fechaRaw) {
          socioData.fechaNacimiento = new Date(fechaRaw)
        }
      } catch (e) {
        // Ignorar errores de fecha
      }
    }

    // Verificar si existe
    const existente = await req.prisma.socio.findUnique({
      where: { nroSocio },
    })

    if (existente) {
      sociosParaActualizar.push({ ...socioData, id: existente.id })
    } else {
      sociosParaCrear.push(socioData)
    }
  }

  // Guardar en cache temporal
  const uploadId = uuidv4()
  uploadCache.set(uploadId, {
    crear: sociosParaCrear,
    actualizar: sociosParaActualizar,
    timestamp: Date.now(),
  })

  // Limpiar cache viejo (más de 30 minutos)
  for (const [key, value] of uploadCache.entries()) {
    if (Date.now() - value.timestamp > 30 * 60 * 1000) {
      uploadCache.delete(key)
    }
  }

  res.json({
    success: true,
    data: {
      preview: true,
      nuevos: sociosParaCrear.length,
      actualizar: sociosParaActualizar.length,
      uploadId,
    },
  })
}))

// POST /api/admin/socios/upload/:uploadId/confirmar
router.post('/socios/upload/:uploadId/confirmar', authAdmin, asyncHandler(async (req, res) => {
  const { uploadId } = req.params

  const cached = uploadCache.get(uploadId)
  if (!cached) {
    throw new AppError('Upload expirado, subí el archivo de nuevo', 400, 'UPLOAD_EXPIRED')
  }

  // Crear nuevos
  if (cached.crear.length > 0) {
    await req.prisma.socio.createMany({
      data: cached.crear,
      skipDuplicates: true,
    })
  }

  // Actualizar existentes
  for (const socio of cached.actualizar) {
    await req.prisma.socio.update({
      where: { id: socio.id },
      data: {
        apellidoNombre: socio.apellidoNombre,
        documento: socio.documento,
        estado: socio.estado,
        email: socio.email,
        celular: socio.celular,
        categoria: socio.categoria,
        tipoSocio: socio.tipoSocio,
        domicilio: socio.domicilio,
        ciudad: socio.ciudad,
        fechaNacimiento: socio.fechaNacimiento,
      },
    })
  }

  uploadCache.delete(uploadId)

  res.json({
    success: true,
    data: {
      procesados: cached.crear.length + cached.actualizar.length,
      nuevos: cached.crear.length,
      actualizados: cached.actualizar.length,
      mensaje: 'Socios actualizados correctamente',
    },
  })
}))

// GET /api/admin/reportes/ventas
router.get('/reportes/ventas', authAdmin, asyncHandler(async (req, res) => {
  const { desde, hasta, comercioId } = req.query

  const where = {}

  if (desde) {
    where.fecha = { ...where.fecha, gte: new Date(desde) }
  }
  if (hasta) {
    const hastaDate = new Date(hasta)
    hastaDate.setHours(23, 59, 59, 999)
    where.fecha = { ...where.fecha, lte: hastaDate }
  }
  if (comercioId) {
    where.comercioId = parseInt(comercioId)
  }

  const [resumen, porComercio] = await Promise.all([
    req.prisma.venta.aggregate({
      where,
      _count: true,
      _sum: {
        importeOriginal: true,
        importeFinal: true,
        descuentoMonto: true,
      },
    }),
    req.prisma.venta.groupBy({
      by: ['comercioId'],
      where,
      _count: true,
      _sum: { importeFinal: true },
    }),
  ])

  // Obtener nombres de comercios
  const comercioIds = porComercio.map(p => p.comercioId)
  const comercios = await req.prisma.comercio.findMany({
    where: { id: { in: comercioIds } },
    select: { id: true, nombre: true },
  })
  const comercioMap = new Map(comercios.map(c => [c.id, c.nombre]))

  res.json({
    success: true,
    data: {
      resumen: {
        totalVentas: resumen._count,
        montoOriginal: Number(resumen._sum.importeOriginal) || 0,
        montoConDescuento: Number(resumen._sum.importeFinal) || 0,
        totalDescuentos: Number(resumen._sum.descuentoMonto) || 0,
      },
      porComercio: porComercio.map(p => ({
        comercioId: p.comercioId,
        nombre: comercioMap.get(p.comercioId) || 'Desconocido',
        ventas: p._count,
        monto: Number(p._sum.importeFinal) || 0,
      })),
    },
  })
}))

export default router
