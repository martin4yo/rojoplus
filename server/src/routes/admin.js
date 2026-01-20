import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import multer from 'multer'
import * as XLSX from 'xlsx'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { authAdmin, generateToken } from '../middleware/auth.js'
import { enviarEmailAprobacion, enviarEmailRechazo, enviarEmailLinkAcceso, enviarReciboPago } from '../services/email.js'

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
  const mesActual = hoy.getMonth() + 1
  const anioActual = hoy.getFullYear()
  const inicioMes = new Date(anioActual, mesActual - 1, 1)

  // Socios activos
  const sociosActivos = await req.prisma.socio.count({
    where: {
      OR: [
        { estado: { contains: 'Activ', mode: 'insensitive' } },
        { estado: { contains: 'Vigent', mode: 'insensitive' } },
      ],
    },
  })

  // Socios con inscripciones activas en actividades
  const sociosConActividad = await req.prisma.inscripcion.findMany({
    where: {
      estado: 'ACTIVA',
    },
    select: { socioId: true },
    distinct: ['socioId'],
  })
  const cantSociosConActividad = sociosConActividad.length

  // Socios sin actividad = activos - con actividad
  const sociosSinActividad = Math.max(0, sociosActivos - cantSociosConActividad)

  // Periodo actual (más reciente con estado GENERADO)
  const periodoActual = await req.prisma.periodo.findFirst({
    where: { estado: 'GENERADO' },
    orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
  })

  let cobranzaPeriodo = { cobrado: 0, pendiente: 0, cantCobrado: 0, cantPendiente: 0 }
  if (periodoActual) {
    const [cobrado, pendiente] = await Promise.all([
      req.prisma.cargo.aggregate({
        where: { periodoId: periodoActual.id, estado: 'PAGADO' },
        _sum: { montoTotal: true },
        _count: true,
      }),
      req.prisma.cargo.aggregate({
        where: { periodoId: periodoActual.id, estado: 'PENDIENTE' },
        _sum: { montoTotal: true },
        _count: true,
      }),
    ])
    cobranzaPeriodo = {
      cobrado: Number(cobrado._sum.montoTotal) || 0,
      pendiente: Number(pendiente._sum.montoTotal) || 0,
      cantCobrado: cobrado._count || 0,
      cantPendiente: pendiente._count || 0,
    }
  }

  // Movimientos de caja del mes actual
  const [ingresosMes, egresosMes] = await Promise.all([
    req.prisma.movimientoCaja.aggregate({
      where: {
        tipo: 'INGRESO',
        fecha: { gte: inicioMes },
      },
      _sum: { monto: true },
    }),
    req.prisma.movimientoCaja.aggregate({
      where: {
        tipo: 'EGRESO',
        fecha: { gte: inicioMes },
      },
      _sum: { monto: true },
    }),
  ])

  // Saldos de cajas activas
  const cajas = await req.prisma.caja.findMany({
    where: { activo: true },
    select: { id: true, nombre: true, tipo: true, saldoActual: true },
    orderBy: { nombre: 'asc' },
  })

  const saldoTotalCajas = cajas.reduce((sum, c) => sum + Number(c.saldoActual), 0)

  // Comercios pendientes de aprobación
  const comerciosPendientes = await req.prisma.comercio.count({ where: { estado: 'PENDIENTE' } })

  res.json({
    success: true,
    data: {
      // Socios
      sociosActivos,
      sociosConActividad: cantSociosConActividad,
      sociosSinActividad,
      // Periodo y cobranza
      periodoActual: periodoActual ? {
        id: periodoActual.id,
        nombre: periodoActual.nombre,
        mes: periodoActual.mes,
        anio: periodoActual.anio,
      } : null,
      cobranzaPeriodo,
      // Caja
      ingresosMes: Number(ingresosMes._sum.monto) || 0,
      egresosMes: Number(egresosMes._sum.monto) || 0,
      cajas: cajas.map(c => ({ ...c, saldoActual: Number(c.saldoActual) })),
      saldoTotalCajas,
      // Alertas
      comerciosPendientes,
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
  const {
    q,
    estado,
    categoria,
    tipoSocio,
    zona,
    formaPago,
    esMenor,
    grupoFamiliarId,
    deporteId,
    conDeuda,
    page = 1,
    limit = 20
  } = req.query

  const where = {}

  if (q) {
    where.OR = [
      { nroSocio: { contains: q, mode: 'insensitive' } },
      { documento: { contains: q, mode: 'insensitive' } },
      { apellidoNombre: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { celular: { contains: q, mode: 'insensitive' } },
    ]
  }

  if (estado) {
    where.estado = { contains: estado, mode: 'insensitive' }
  }

  if (categoria) {
    where.categoria = { contains: categoria, mode: 'insensitive' }
  }

  if (tipoSocio) {
    where.tipoSocio = { contains: tipoSocio, mode: 'insensitive' }
  }

  if (zona) {
    where.zona = zona
  }

  if (formaPago) {
    where.formaPagoPref = formaPago
  }

  if (esMenor !== undefined) {
    where.esMenor = esMenor === 'true'
  }

  if (grupoFamiliarId) {
    where.titularFamiliaId = parseInt(grupoFamiliarId)
  }

  if (deporteId) {
    where.inscripciones = {
      some: {
        estado: 'ACTIVA',
        categoriaActividad: {
          actividadId: parseInt(deporteId)
        }
      }
    }
  }

  const [socios, total, estados, categorias, tiposSocio, zonas] = await Promise.all([
    req.prisma.socio.findMany({
      where,
      orderBy: { nroSocio: 'asc' },
      skip: (page - 1) * parseInt(limit),
      take: parseInt(limit),
      select: {
        id: true,
        nroSocio: true,
        documento: true,
        apellidoNombre: true,
        email: true,
        celular: true,
        estado: true,
        categoria: true,
        tipoSocio: true,
        esMenor: true,
        fechaNacimiento: true,
        fotoUrl: true,
        titularFamiliaId: true,
        tokenPortal: true,
        formaPagoPref: true,
        enviaDebito: true,
        zona: true,
        createdAt: true,
      },
    }),
    req.prisma.socio.count({ where }),
    req.prisma.socio.groupBy({ by: ['estado'], _count: true }),
    req.prisma.socio.groupBy({ by: ['categoria'], _count: true }),
    req.prisma.socio.groupBy({ by: ['tipoSocio'], _count: true }),
    req.prisma.socio.groupBy({ by: ['zona'], _count: true }),
  ])

  res.json({
    success: true,
    data: {
      socios,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
      filtros: {
        estados: estados.map(e => e.estado).filter(Boolean).sort(),
        categorias: categorias.map(c => c.categoria).filter(Boolean).sort(),
        tiposSocio: tiposSocio.map(t => t.tipoSocio).filter(Boolean).sort(),
        zonas: zonas.map(z => z.zona).filter(Boolean).sort(),
      },
    },
  })
}))

// GET /api/admin/socios/:id - Detalle completo del socio
router.get('/socios/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const socio = await req.prisma.socio.findUnique({
    where: { id: parseInt(id) },
    include: {
      responsable: {
        select: { id: true, nroSocio: true, apellidoNombre: true }
      },
      menoresACargo: {
        select: { id: true, nroSocio: true, apellidoNombre: true, fechaNacimiento: true }
      },
      titularFamilia: {
        select: { id: true, nroSocio: true, apellidoNombre: true, tipoSocio: true }
      },
      miembrosFamilia: {
        select: { id: true, nroSocio: true, apellidoNombre: true, parentescoTitular: true, tipoSocio: true }
      },
      cobrador: {
        select: { id: true, codigo: true, nombre: true }
      },
      inscripciones: {
        where: { estado: 'ACTIVA' },
        include: {
          categoriaActividad: {
            include: { actividad: true }
          }
        }
      },
      autorizaciones: {
        where: { activa: true }
      },
    },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'NOT_FOUND')
  }

  // Obtener cuotas pendientes
  const cuotasPendientes = await req.prisma.cargo.findMany({
    where: {
      socioId: socio.id,
      estado: 'PENDIENTE',
    },
    include: {
      periodo: true,
    },
    orderBy: [{ periodo: { anio: 'asc' } }, { periodo: { mes: 'asc' } }],
  })

  // Resumen de pagos
  const [pagosTotales, ultimoPago] = await Promise.all([
    req.prisma.pago.aggregate({
      where: { socioId: socio.id, estado: 'CONFIRMADO' },
      _count: true,
      _sum: { montoTotal: true },
    }),
    req.prisma.pago.findFirst({
      where: { socioId: socio.id, estado: 'CONFIRMADO' },
      orderBy: { fecha: 'desc' },
      select: { fecha: true, montoTotal: true },
    }),
  ])

  // Ocultar datos sensibles parcialmente (mostrar últimos 4 de tarjeta)
  const socioData = {
    ...socio,
    tarjetaNumero: socio.tarjetaNumero ? `****-****-****-${socio.tarjetaUltimos4 || socio.tarjetaNumero.slice(-4)}` : null,
    tarjetaCvv: socio.tarjetaCvv ? '***' : null,
    cbuDebito: socio.cbuDebito ? `${socio.cbuDebito.slice(0, 4)}...${socio.cbuDebito.slice(-4)}` : null,
  }

  res.json({
    success: true,
    data: {
      socio: socioData,
      cuotasPendientes,
      resumenPagos: {
        totalPagos: pagosTotales._count,
        montoTotal: Number(pagosTotales._sum.montoTotal) || 0,
        ultimoPago: ultimoPago ? {
          fecha: ultimoPago.fecha,
          monto: Number(ultimoPago.montoTotal),
        } : null,
      },
    },
  })
}))

// POST /api/admin/socios - Crear nuevo socio
router.post('/socios', authAdmin, asyncHandler(async (req, res) => {
  const data = req.body

  // Validaciones básicas
  if (!data.nroSocio || !data.apellidoNombre) {
    throw new AppError('Número de socio y nombre son requeridos', 400, 'VALIDATION_ERROR')
  }

  // Verificar que no exista
  const existente = await req.prisma.socio.findUnique({
    where: { nroSocio: data.nroSocio },
  })

  if (existente) {
    throw new AppError('Ya existe un socio con ese número', 400, 'DUPLICATE')
  }

  // Procesar datos
  const socioData = {
    nroSocio: data.nroSocio,
    tipoDocumento: data.tipoDocumento || 'DNI',
    documento: data.documento || null,
    cuil: data.cuil || null,
    apellido: data.apellido || null,
    nombre: data.nombre || null,
    apellidoNombre: data.apellidoNombre,
    fechaNacimiento: data.fechaNacimiento ? new Date(data.fechaNacimiento) : null,
    lugarNacimiento: data.lugarNacimiento || null,
    sexo: data.sexo || null,
    nacionalidad: data.nacionalidad || 'Argentina',
    estadoCivil: data.estadoCivil || null,
    profesion: data.profesion || null,
    fotoUrl: data.fotoUrl || null,
    // Contacto
    email: data.email || null,
    emailSecundario: data.emailSecundario || null,
    telefonoFijo: data.telefonoFijo || null,
    celular: data.celular || null,
    celularSecundario: data.celularSecundario || null,
    // Domicilio
    domicilio: data.domicilio || null,
    calle: data.calle || null,
    numero: data.numero || null,
    piso: data.piso || null,
    depto: data.depto || null,
    barrio: data.barrio || null,
    codigoPostal: data.codigoPostal || null,
    ciudad: data.ciudad || null,
    provincia: data.provincia || 'Buenos Aires',
    // Club
    fechaAlta: data.fechaAlta ? new Date(data.fechaAlta) : new Date(),
    estado: data.estado || 'ACTIVO',
    categoria: data.categoria || null,
    tipoSocio: data.tipoSocio || null,
    zona: data.zona || null,
    libro: data.libro || null,
    folio: data.folio || null,
    antiguedadEstatutaria: data.antiguedadEstatutaria || null,
    // Menores
    esMenor: data.esMenor || false,
    responsableId: data.responsableId || null,
    parentescoResponsable: data.parentescoResponsable || null,
    // Datos médicos
    grupoSanguineo: data.grupoSanguineo || null,
    factorRh: data.factorRh || null,
    obraSocial: data.obraSocial || null,
    nroObraSocial: data.nroObraSocial || null,
    alergias: data.alergias || null,
    condicionesMedicas: data.condicionesMedicas || null,
    medicamentos: data.medicamentos || null,
    aptaFisicaVigente: data.aptaFisicaVigente || false,
    aptaFisicaVence: data.aptaFisicaVence ? new Date(data.aptaFisicaVence) : null,
    // Emergencia
    emergenciaNombre1: data.emergenciaNombre1 || null,
    emergenciaTel1: data.emergenciaTel1 || null,
    emergenciaParent1: data.emergenciaParent1 || null,
    emergenciaNombre2: data.emergenciaNombre2 || null,
    emergenciaTel2: data.emergenciaTel2 || null,
    emergenciaParent2: data.emergenciaParent2 || null,
    // Cobranza
    formaPagoPref: data.formaPagoPref || null,
    cobradorId: data.cobradorId || null,
    // Débito
    debitoTipo: data.debitoTipo || null,
    bancoDebito: data.bancoDebito || null,
    cbuDebito: data.cbuDebito || null,
    aliasDebito: data.aliasDebito || null,
    titularCuenta: data.titularCuenta || null,
    enviaDebito: data.enviaDebito || false,
    // Tarjeta
    tarjetaMarca: data.tarjetaMarca || null,
    tarjetaNumero: data.tarjetaNumero || null,
    tarjetaUltimos4: data.tarjetaNumero ? data.tarjetaNumero.slice(-4) : null,
    tarjetaVencimiento: data.tarjetaVencimiento || null,
    tarjetaCvv: data.tarjetaCvv || null,
    // Fiscal
    condicionFiscal: data.condicionFiscal || null,
    // Observaciones
    observaciones: data.observaciones || null,
    observacionesInternas: data.observacionesInternas || null,
    // Auditoría
    creadoPor: req.admin.id,
  }

  const socio = await req.prisma.socio.create({
    data: socioData,
    select: {
      id: true,
      nroSocio: true,
      apellidoNombre: true,
      tokenPortal: true,
    },
  })

  res.status(201).json({
    success: true,
    data: {
      ...socio,
      mensaje: 'Socio creado correctamente',
    },
  })
}))

// PUT /api/admin/socios/:id - Actualizar socio
router.put('/socios/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const data = req.body

  // Verificar que existe
  const existente = await req.prisma.socio.findUnique({
    where: { id: parseInt(id) },
  })

  if (!existente) {
    throw new AppError('Socio no encontrado', 404, 'NOT_FOUND')
  }

  // Si cambia nroSocio, verificar que no exista otro
  if (data.nroSocio && data.nroSocio !== existente.nroSocio) {
    const duplicado = await req.prisma.socio.findUnique({
      where: { nroSocio: data.nroSocio },
    })
    if (duplicado) {
      throw new AppError('Ya existe un socio con ese número', 400, 'DUPLICATE')
    }
  }

  // Preparar datos de actualización
  const updateData = {}

  // Campos básicos
  const camposBasicos = [
    'nroSocio', 'tipoDocumento', 'documento', 'cuil', 'apellido', 'nombre',
    'apellidoNombre', 'lugarNacimiento', 'sexo', 'nacionalidad', 'estadoCivil',
    'profesion', 'fotoUrl', 'email', 'emailSecundario', 'telefonoFijo', 'celular',
    'celularSecundario', 'domicilio', 'calle', 'numero', 'piso', 'depto',
    'barrio', 'codigoPostal', 'ciudad', 'provincia', 'estado', 'categoria',
    'tipoSocio', 'zona', 'libro', 'folio', 'antiguedadEstatutaria',
    'parentescoResponsable', 'grupoSanguineo', 'factorRh', 'obraSocial',
    'nroObraSocial', 'alergias', 'condicionesMedicas', 'medicamentos',
    'emergenciaNombre1', 'emergenciaTel1', 'emergenciaParent1',
    'emergenciaNombre2', 'emergenciaTel2', 'emergenciaParent2',
    'formaPagoPref', 'debitoTipo', 'bancoDebito', 'cbuDebito', 'aliasDebito',
    'titularCuenta', 'tarjetaMarca', 'tarjetaVencimiento',
    'condicionFiscal', 'observaciones', 'observacionesInternas',
    'parentescoTitular', 'motivoBaja'
  ]

  camposBasicos.forEach(campo => {
    if (data[campo] !== undefined) {
      updateData[campo] = data[campo] || null
    }
  })

  // Campos booleanos
  const camposBooleanos = [
    'esMenor', 'aptaFisicaVigente', 'enviaDebito', 'debitoVerificado'
  ]

  camposBooleanos.forEach(campo => {
    if (data[campo] !== undefined) {
      updateData[campo] = Boolean(data[campo])
    }
  })

  // Campos de fecha
  const camposFecha = ['fechaNacimiento', 'fechaAlta', 'fechaBaja', 'aptaFisicaVence']
  camposFecha.forEach(campo => {
    if (data[campo] !== undefined) {
      updateData[campo] = data[campo] ? new Date(data[campo]) : null
    }
  })

  // Campos de relación
  const camposRelacion = ['responsableId', 'cobradorId', 'titularFamiliaId']
  camposRelacion.forEach(campo => {
    if (data[campo] !== undefined) {
      updateData[campo] = data[campo] ? parseInt(data[campo]) : null
    }
  })

  // Tarjeta (procesar últimos 4 dígitos)
  if (data.tarjetaNumero !== undefined) {
    updateData.tarjetaNumero = data.tarjetaNumero || null
    updateData.tarjetaUltimos4 = data.tarjetaNumero ? data.tarjetaNumero.slice(-4) : null
  }
  if (data.tarjetaCvv !== undefined) {
    updateData.tarjetaCvv = data.tarjetaCvv || null
  }

  // Auditoría
  updateData.actualizadoPor = req.admin.id

  const socio = await req.prisma.socio.update({
    where: { id: parseInt(id) },
    data: updateData,
    select: {
      id: true,
      nroSocio: true,
      apellidoNombre: true,
      estado: true,
    },
  })

  res.json({
    success: true,
    data: {
      ...socio,
      mensaje: 'Socio actualizado correctamente',
    },
  })
}))

// POST /api/admin/socios/:id/desactivar - Desactivar socio
router.post('/socios/:id/desactivar', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { motivoBaja } = req.body

  const socio = await req.prisma.socio.update({
    where: { id: parseInt(id) },
    data: {
      estado: 'INACTIVO',
      fechaBaja: new Date(),
      motivoBaja: motivoBaja || 'Baja solicitada desde administración',
      actualizadoPor: req.admin.id,
    },
    select: { id: true, nroSocio: true, apellidoNombre: true, estado: true },
  })

  res.json({
    success: true,
    data: {
      ...socio,
      mensaje: 'Socio desactivado correctamente',
    },
  })
}))

// POST /api/admin/socios/:id/activar - Reactivar socio
router.post('/socios/:id/activar', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const socio = await req.prisma.socio.update({
    where: { id: parseInt(id) },
    data: {
      estado: 'ACTIVO',
      fechaBaja: null,
      motivoBaja: null,
      actualizadoPor: req.admin.id,
    },
    select: { id: true, nroSocio: true, apellidoNombre: true, estado: true },
  })

  res.json({
    success: true,
    data: {
      ...socio,
      mensaje: 'Socio reactivado correctamente',
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

// PUT /api/admin/socios/:id/familia - Actualizar titular de familia
router.put('/socios/:id/familia', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { titularFamiliaId, parentescoTitular } = req.body

  const socio = await req.prisma.socio.findUnique({
    where: { id: parseInt(id) },
    include: { miembrosFamilia: { select: { id: true } } }
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'NOT_FOUND')
  }

  // Si se asigna un titular, verificar que exista
  if (titularFamiliaId) {
    const titular = await req.prisma.socio.findUnique({
      where: { id: parseInt(titularFamiliaId) },
    })

    if (!titular) {
      throw new AppError('Titular no encontrado', 404, 'NOT_FOUND')
    }

    // Verificar que no se asigne a si mismo
    if (parseInt(titularFamiliaId) === parseInt(id)) {
      throw new AppError('No se puede asignar a si mismo como titular', 400, 'INVALID_OPERATION')
    }

    // Verificar que no sea titular de otra familia
    if (socio.tipoSocio?.toLowerCase().includes('titular') && socio.miembrosFamilia?.length > 0) {
      throw new AppError('Este socio es titular de otra familia', 400, 'IS_TITULAR')
    }
  }

  const updated = await req.prisma.socio.update({
    where: { id: parseInt(id) },
    data: {
      titularFamiliaId: titularFamiliaId ? parseInt(titularFamiliaId) : null,
      parentescoTitular: titularFamiliaId ? (parentescoTitular || null) : null,
      tipoSocio: titularFamiliaId ? 'Miembro Familia' : 'Socio Unico',  // Cambiar tipoSocio
      actualizadoPor: req.admin.id,
    },
    include: {
      titularFamilia: {
        select: { id: true, nroSocio: true, apellidoNombre: true }
      }
    }
  })

  res.json({
    success: true,
    data: {
      id: updated.id,
      titularFamilia: updated.titularFamilia,
      parentescoTitular: updated.parentescoTitular,
      tipoSocio: updated.tipoSocio,
      mensaje: titularFamiliaId ? 'Titular de familia asignado' : 'Socio desvinculado de familia',
    },
  })
}))

// POST /api/admin/socios/:id/familia/desarmar - Desarmar familia (todos los miembros pasan a Socio Unico)
router.post('/socios/:id/familia/desarmar', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const titular = await req.prisma.socio.findUnique({
    where: { id: parseInt(id) },
    include: {
      miembrosFamilia: { select: { id: true, apellidoNombre: true } }
    }
  })

  if (!titular) {
    throw new AppError('Socio no encontrado', 404, 'NOT_FOUND')
  }

  if (!titular.miembrosFamilia || titular.miembrosFamilia.length === 0) {
    throw new AppError('Este socio no tiene miembros en su familia', 400, 'NO_MEMBERS')
  }

  // Actualizar todos los miembros a Socio Unico
  const miembrosIds = titular.miembrosFamilia.map(m => m.id)

  await req.prisma.socio.updateMany({
    where: { id: { in: miembrosIds } },
    data: {
      titularFamiliaId: null,
      parentescoTitular: null,
      tipoSocio: 'Socio Unico',
    }
  })

  // Cambiar el titular a Socio Unico
  await req.prisma.socio.update({
    where: { id: parseInt(id) },
    data: {
      tipoSocio: 'Socio Unico',
      actualizadoPor: req.admin.id,
    }
  })

  res.json({
    success: true,
    data: {
      mensaje: `Familia desarmada. ${miembrosIds.length} miembro(s) ahora son Socio Unico.`,
      miembrosAfectados: miembrosIds.length,
    },
  })
}))

// GET /api/admin/socios/titulares/buscar - Buscar titulares de familia para asignar
router.get('/socios/titulares/buscar', authAdmin, asyncHandler(async (req, res) => {
  const { q } = req.query

  if (!q || q.length < 2) {
    return res.json({ success: true, data: [] })
  }

  const titulares = await req.prisma.socio.findMany({
    where: {
      tipoSocio: { contains: 'Titular', mode: 'insensitive' },
      OR: [
        { nroSocio: { contains: q, mode: 'insensitive' } },
        { apellidoNombre: { contains: q, mode: 'insensitive' } },
        { documento: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      nroSocio: true,
      apellidoNombre: true,
      tipoSocio: true,
      _count: {
        select: { miembrosFamilia: true }
      }
    },
    take: 10,
    orderBy: { apellidoNombre: 'asc' },
  })

  res.json({
    success: true,
    data: titulares.map(t => ({
      ...t,
      cantidadMiembros: t._count.miembrosFamilia,
      _count: undefined,
    })),
  })
}))

// GET /api/admin/socios/miembros/buscar - Buscar socios para agregar como miembros de familia
router.get('/socios/miembros/buscar', authAdmin, asyncHandler(async (req, res) => {
  const { q, titularId } = req.query

  if (!q || q.length < 2) {
    return res.json({ success: true, data: [] })
  }

  const socios = await req.prisma.socio.findMany({
    where: {
      // No incluir al titular
      id: { not: parseInt(titularId) },
      // Solo socios sin familia asignada
      titularFamiliaId: null,
      // Que no sean titulares de familia (o que no tengan miembros)
      OR: [
        { nroSocio: { contains: q, mode: 'insensitive' } },
        { apellidoNombre: { contains: q, mode: 'insensitive' } },
        { documento: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      nroSocio: true,
      apellidoNombre: true,
      tipoSocio: true,
    },
    take: 10,
    orderBy: { apellidoNombre: 'asc' },
  })

  res.json({ success: true, data: socios })
}))

// DELETE /api/admin/socios/:id/familia/miembro/:miembroId - Quitar miembro de familia
router.delete('/socios/:id/familia/miembro/:miembroId', authAdmin, asyncHandler(async (req, res) => {
  const { id, miembroId } = req.params

  // Verificar que el miembro pertenece a este titular
  const miembro = await req.prisma.socio.findUnique({
    where: { id: parseInt(miembroId) },
  })

  if (!miembro) {
    throw new AppError('Miembro no encontrado', 404, 'NOT_FOUND')
  }

  if (miembro.titularFamiliaId !== parseInt(id)) {
    throw new AppError('Este miembro no pertenece a esta familia', 400, 'INVALID_OPERATION')
  }

  await req.prisma.socio.update({
    where: { id: parseInt(miembroId) },
    data: {
      titularFamiliaId: null,
      parentescoTitular: null,
      tipoSocio: 'Socio Unico',  // Cambiar a Socio Unico al salir de familia
      actualizadoPor: req.admin.id,
    },
  })

  res.json({
    success: true,
    data: { mensaje: 'Miembro quitado de la familia' },
  })
}))

// POST /api/admin/socios/:id/familia/miembro - Agregar miembro a familia
router.post('/socios/:id/familia/miembro', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { socioId, parentesco } = req.body

  // Verificar que el titular existe
  const titular = await req.prisma.socio.findUnique({
    where: { id: parseInt(id) },
    include: { miembrosFamilia: { select: { id: true } } }
  })

  if (!titular) {
    throw new AppError('Titular no encontrado', 404, 'NOT_FOUND')
  }

  // Verificar que el socio a agregar existe
  const socio = await req.prisma.socio.findUnique({
    where: { id: parseInt(socioId) },
    include: { miembrosFamilia: { select: { id: true } } }
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'NOT_FOUND')
  }

  // Validaciones
  if (socio.titularFamiliaId) {
    throw new AppError('Este socio ya pertenece a otra familia', 400, 'ALREADY_HAS_FAMILY')
  }

  if (socio.tipoSocio?.toLowerCase().includes('titular') && socio.miembrosFamilia?.length > 0) {
    throw new AppError('Este socio es titular de otra familia', 400, 'IS_TITULAR')
  }

  const updated = await req.prisma.socio.update({
    where: { id: parseInt(socioId) },
    data: {
      titularFamiliaId: parseInt(id),
      parentescoTitular: parentesco || null,
      tipoSocio: 'Miembro Familia',  // Cambiar a Miembro Familia
      actualizadoPor: req.admin.id,
    },
    select: { id: true, nroSocio: true, apellidoNombre: true, parentescoTitular: true, tipoSocio: true },
  })

  res.json({
    success: true,
    data: {
      miembro: updated,
      mensaje: 'Miembro agregado a la familia',
    },
  })
}))

// GET /api/admin/socios/:id/datos-debito - Obtener datos de débito (sin ocultar)
router.get('/socios/:id/datos-debito', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const socio = await req.prisma.socio.findUnique({
    where: { id: parseInt(id) },
    select: {
      id: true,
      nroSocio: true,
      apellidoNombre: true,
      debitoTipo: true,
      bancoDebito: true,
      cbuDebito: true,
      aliasDebito: true,
      tarjetaMarca: true,
      tarjetaNumero: true,
      tarjetaUltimos4: true,
      tarjetaVencimiento: true,
      tarjetaCvv: true,
      tarjetaToken: true,
      tarjetaTokenizador: true,
      titularCuenta: true,
      enviaDebito: true,
      debitoVerificado: true,
    },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'NOT_FOUND')
  }

  res.json({
    success: true,
    data: socio,
  })
}))

// PUT /api/admin/socios/:id/datos-debito - Actualizar datos de débito
router.put('/socios/:id/datos-debito', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const data = req.body

  const updateData = {
    debitoTipo: data.debitoTipo || null,
    bancoDebito: data.bancoDebito || null,
    cbuDebito: data.cbuDebito || null,
    aliasDebito: data.aliasDebito || null,
    tarjetaMarca: data.tarjetaMarca || null,
    tarjetaNumero: data.tarjetaNumero || null,
    tarjetaUltimos4: data.tarjetaNumero ? data.tarjetaNumero.slice(-4) : null,
    tarjetaVencimiento: data.tarjetaVencimiento || null,
    tarjetaCvv: data.tarjetaCvv || null,
    titularCuenta: data.titularCuenta || null,
    enviaDebito: Boolean(data.enviaDebito),
    debitoVerificado: Boolean(data.debitoVerificado),
    actualizadoPor: req.admin.id,
  }

  const socio = await req.prisma.socio.update({
    where: { id: parseInt(id) },
    data: updateData,
    select: { id: true, nroSocio: true, enviaDebito: true },
  })

  res.json({
    success: true,
    data: {
      ...socio,
      mensaje: 'Datos de débito actualizados correctamente',
    },
  })
}))

// Función auxiliar para convertir fecha de Excel
function excelDateToJS(excelDate) {
  if (!excelDate) return null
  if (typeof excelDate === 'number') {
    // Excel date serial number (días desde 1900-01-01)
    return new Date((excelDate - 25569) * 86400 * 1000)
  }
  if (typeof excelDate === 'string' && excelDate !== 'n/a' && excelDate.trim()) {
    const parsed = new Date(excelDate)
    return isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

// Función para separar Apellido y Nombre
function separarApellidoNombre(completo) {
  if (!completo) return { apellido: null, nombre: null }

  // Limpiar espacios múltiples
  const limpio = completo.trim().replace(/\s+/g, ' ')
  const partes = limpio.split(' ')

  if (partes.length === 1) {
    return { apellido: partes[0], nombre: null }
  }

  // Detectar si hay coma (formato "APELLIDO, NOMBRE")
  if (limpio.includes(',')) {
    const [apellido, ...resto] = limpio.split(',')
    return {
      apellido: apellido.trim(),
      nombre: resto.join(',').trim() || null
    }
  }

  // Sin coma: primera palabra es apellido, resto es nombre
  // Excepto casos comunes de apellidos compuestos
  const apellidosCompuestos = ['DE', 'DEL', 'DE LA', 'DE LOS', 'DE LAS', 'VAN', 'VON', 'MC', 'MAC', 'O\'']

  let apellido = partes[0]
  let indexNombre = 1

  // Verificar si hay apellido compuesto
  if (partes.length > 2) {
    const segundaParte = partes[1]?.toUpperCase()
    if (apellidosCompuestos.includes(segundaParte) ||
        apellidosCompuestos.includes(`${segundaParte} ${partes[2]?.toUpperCase()}`)) {
      apellido = `${partes[0]} ${partes[1]}`
      indexNombre = 2
      if (apellidosCompuestos.includes(`${segundaParte} ${partes[2]?.toUpperCase()}`)) {
        apellido = `${partes[0]} ${partes[1]} ${partes[2]}`
        indexNombre = 3
      }
    }
  }

  const nombre = partes.slice(indexNombre).join(' ') || null

  return { apellido, nombre }
}

// Función para limpiar string
function cleanString(val) {
  if (val === null || val === undefined) return null
  const str = String(val).trim()
  return str === '' || str === 'n/a' || str === 'N/A' ? null : str
}

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

    // Separar apellido y nombre
    const apellidoNombreCompleto = row['ApellidoNombre'] || row['Nombre'] || ''
    const { apellido, nombre } = separarApellidoNombre(apellidoNombreCompleto)

    // Mapear forma de pago
    let formaPagoPref = null
    const formaPagoRaw = cleanString(row['Forma Pago'])
    if (formaPagoRaw) {
      if (formaPagoRaw.toLowerCase().includes('mostrador')) formaPagoPref = 'MOSTRADOR'
      else if (formaPagoRaw.toLowerCase().includes('debito') || formaPagoRaw.toLowerCase().includes('débito')) formaPagoPref = 'DEBITO'
      else if (formaPagoRaw.toLowerCase().includes('cobrador')) formaPagoPref = 'COBRADOR'
      else formaPagoPref = formaPagoRaw
    }

    // Determinar si es menor de edad
    const fechaNac = excelDateToJS(row['Fecha Nac.'] || row['FechaNac'])
    let esMenor = false
    if (fechaNac) {
      const hoy = new Date()
      const edad = hoy.getFullYear() - fechaNac.getFullYear()
      esMenor = edad < 18
    }

    // Construir datos del socio
    const socioData = {
      nroSocio,
      apellidoNombre: apellidoNombreCompleto,
      apellido,
      nombre,
      // Documento
      tipoDocumento: cleanString(row['Tipo Doc.']) || 'DNI',
      documento: cleanString(row['Documento']),
      cuil: cleanString(row['CUIT/CUIL']),
      // Datos personales
      fechaNacimiento: fechaNac,
      sexo: cleanString(row['Sexo']),
      nacionalidad: cleanString(row['Pais']) || 'Argentina',
      profesion: cleanString(row['Profesión']),
      // Club
      fechaAlta: excelDateToJS(row['Fecha Alta']),
      fechaBaja: excelDateToJS(row['Fecha Baja']),
      estado: cleanString(row['Estado']) || 'ACTIVO',
      categoria: cleanString(row['Categoria'] || row['Categoría']),
      tipoSocio: cleanString(row['TipoSocio'] || row['Tipo Socio'] || row['Tipo de Socio']),
      zona: cleanString(row['Zona']),
      antiguedadEstatutaria: row['Ant. Estatutaria'] ? parseInt(row['Ant. Estatutaria']) : null,
      libro: cleanString(row['Libro']),
      folio: cleanString(row['Folio']),
      // Menor
      esMenor,
      parentescoTitular: cleanString(row['Parentesco']),
      // Contacto
      email: cleanString(row['Email']),
      emailSecundario: cleanString(row['Email Secundario']),
      telefonoFijo: cleanString(row['Telefono']),
      celular: cleanString(row['Celular']),
      // Domicilio
      domicilio: cleanString(row['Domicilio']),
      ciudad: cleanString(row['Ciudad']),
      codigoPostal: cleanString(row['CP']),
      provincia: cleanString(row['Provincia']) || 'Buenos Aires',
      // Cobranza
      formaPagoPref,
      // Débito
      bancoDebito: cleanString(row['BancoDebito']),
      cbuDebito: cleanString(row['Banco CBU/Tarjeta']),
      enviaDebito: formaPagoPref === 'DEBITO',
      // Fiscal
      condicionFiscal: cleanString(row['Cond. Fiscal']),
      // Médico
      obraSocial: cleanString(row['Obra Social']),
      grupoSanguineo: cleanString(row['Grupo Sanguíneo']),
      factorRh: cleanString(row['Factor RH']),
      // Foto
      fotoUrl: cleanString(row['Foto']) ? `/uploads/fotos/${row['Foto']}` : null,
      // Observaciones
      observaciones: cleanString(row['Observacion']),
      // Grupo familiar (guardar referencia para procesar después)
      _grupoFamiliar: cleanString(row['Grupo Fliar']),
      _esTitular: cleanString(row['Titular'])?.toUpperCase() === 'SI',
      _cobrador: cleanString(row['Cobrador']),
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

  // Recolectar valores únicos para tablas auxiliares
  const todosLosSocios = [...cached.crear, ...cached.actualizar]

  const tiposUnicos = [...new Set(todosLosSocios.map(s => s.tipoSocio).filter(Boolean))]
  const categoriasUnicas = [...new Set(todosLosSocios.map(s => s.categoria).filter(Boolean))]
  const estadosUnicos = [...new Set(todosLosSocios.map(s => s.estado).filter(Boolean))]

  // Crear tipos de socio que no existan
  for (const tipo of tiposUnicos) {
    const codigo = tipo.toUpperCase().replace(/\s+/g, '_').substring(0, 50)
    const existente = await req.prisma.tipoSocio.findFirst({
      where: { OR: [{ codigo }, { nombre: tipo }] }
    })
    if (!existente) {
      await req.prisma.tipoSocio.create({
        data: { codigo, nombre: tipo, color: 'blue' }
      })
    }
  }

  // Obtener mapeo de tipos de socio (nombre -> id)
  const tiposSocio = await req.prisma.tipoSocio.findMany()
  const mapeoTipoSocio = {}
  for (const tipo of tiposSocio) {
    mapeoTipoSocio[tipo.nombre] = tipo.id
    mapeoTipoSocio[tipo.codigo] = tipo.id
  }

  // Crear categorías de socio que no existan
  for (const cat of categoriasUnicas) {
    const codigo = cat.toUpperCase().replace(/\s+/g, '_').substring(0, 50)
    const existente = await req.prisma.categoriaSocio.findFirst({
      where: { OR: [{ codigo }, { nombre: cat }] }
    })
    if (!existente) {
      await req.prisma.categoriaSocio.create({
        data: { codigo, nombre: cat, color: 'blue' }
      })
    }
  }

  // Obtener mapeo de categorías de socio (nombre -> id)
  const categoriasSocio = await req.prisma.categoriaSocio.findMany()
  const mapeoCategoriaSocio = {}
  for (const cat of categoriasSocio) {
    mapeoCategoriaSocio[cat.nombre] = cat.id
    mapeoCategoriaSocio[cat.codigo] = cat.id
  }

  // Crear estados de socio que no existan
  for (const estado of estadosUnicos) {
    const codigo = estado.toUpperCase().replace(/\s+/g, '_').substring(0, 50)
    const existente = await req.prisma.estadoSocio.findFirst({
      where: { OR: [{ codigo }, { nombre: estado }] }
    })
    if (!existente) {
      // Determinar si permite descuentos basado en el nombre
      const permiteDescuentos = estado.toLowerCase().includes('activ') ||
        estado.toLowerCase().includes('vigent')
      await req.prisma.estadoSocio.create({
        data: {
          codigo,
          nombre: estado,
          color: permiteDescuentos ? 'green' : 'red',
          permiteDescuentos
        }
      })
    }
  }

  // Obtener mapeo de estados de socio (nombre -> id)
  const estadosSocio = await req.prisma.estadoSocio.findMany()
  const mapeoEstadoSocio = {}
  for (const est of estadosSocio) {
    mapeoEstadoSocio[est.nombre] = est.id
    mapeoEstadoSocio[est.codigo] = est.id
  }

  // Función para limpiar campos temporales y agregar IDs de relación
  const limpiarCamposTemporales = (socio) => {
    const { _grupoFamiliar, _esTitular, _cobrador, id, ...datosLimpios } = socio

    // Agregar IDs de relación basándose en los campos texto
    if (socio.tipoSocio && mapeoTipoSocio[socio.tipoSocio]) {
      datosLimpios.tipoSocioRelId = mapeoTipoSocio[socio.tipoSocio]
    }
    if (socio.categoria && mapeoCategoriaSocio[socio.categoria]) {
      datosLimpios.categoriaSocioId = mapeoCategoriaSocio[socio.categoria]
    }
    if (socio.estado && mapeoEstadoSocio[socio.estado]) {
      datosLimpios.estadoSocioId = mapeoEstadoSocio[socio.estado]
    }

    return datosLimpios
  }

  // Crear nuevos
  if (cached.crear.length > 0) {
    const datosParaCrear = cached.crear.map(limpiarCamposTemporales)
    await req.prisma.socio.createMany({
      data: datosParaCrear,
      skipDuplicates: true,
    })
  }

  // Actualizar existentes con TODOS los campos
  for (const socio of cached.actualizar) {
    const datosLimpios = limpiarCamposTemporales(socio)
    await req.prisma.socio.update({
      where: { id: socio.id },
      data: {
        // Nombre completo y separado
        apellidoNombre: datosLimpios.apellidoNombre,
        apellido: datosLimpios.apellido,
        nombre: datosLimpios.nombre,
        // Documento
        tipoDocumento: datosLimpios.tipoDocumento,
        documento: datosLimpios.documento,
        cuil: datosLimpios.cuil,
        // Datos personales
        fechaNacimiento: datosLimpios.fechaNacimiento,
        sexo: datosLimpios.sexo,
        nacionalidad: datosLimpios.nacionalidad,
        profesion: datosLimpios.profesion,
        // Club - FECHAS IMPORTANTES
        fechaAlta: datosLimpios.fechaAlta,
        fechaBaja: datosLimpios.fechaBaja,
        estado: datosLimpios.estado,
        categoria: datosLimpios.categoria,
        tipoSocio: datosLimpios.tipoSocio,
        zona: datosLimpios.zona,
        antiguedadEstatutaria: datosLimpios.antiguedadEstatutaria,
        libro: datosLimpios.libro,
        folio: datosLimpios.folio,
        // Menor
        esMenor: datosLimpios.esMenor,
        parentescoTitular: datosLimpios.parentescoTitular,
        // Contacto
        email: datosLimpios.email,
        emailSecundario: datosLimpios.emailSecundario,
        telefonoFijo: datosLimpios.telefonoFijo,
        celular: datosLimpios.celular,
        // Domicilio
        domicilio: datosLimpios.domicilio,
        ciudad: datosLimpios.ciudad,
        codigoPostal: datosLimpios.codigoPostal,
        provincia: datosLimpios.provincia,
        // Cobranza
        formaPagoPref: datosLimpios.formaPagoPref,
        // Débito
        bancoDebito: datosLimpios.bancoDebito,
        cbuDebito: datosLimpios.cbuDebito,
        enviaDebito: datosLimpios.enviaDebito,
        // Fiscal
        condicionFiscal: datosLimpios.condicionFiscal,
        // Médico
        obraSocial: datosLimpios.obraSocial,
        grupoSanguineo: datosLimpios.grupoSanguineo,
        factorRh: datosLimpios.factorRh,
        // Foto
        fotoUrl: datosLimpios.fotoUrl,
        // Observaciones
        observaciones: datosLimpios.observaciones,
        // IDs de relación
        tipoSocioRelId: datosLimpios.tipoSocioRelId,
        categoriaSocioId: datosLimpios.categoriaSocioId,
        estadoSocioId: datosLimpios.estadoSocioId,
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

// ============================================================================
// ACTIVIDADES Y CATEGORÍAS DE ACTIVIDAD
// ============================================================================

// GET /api/admin/actividades - Listado de actividades con sus categorías
router.get('/actividades', authAdmin, asyncHandler(async (req, res) => {
  const { activo } = req.query
  const where = activo !== undefined ? { activo: activo === 'true' } : {}

  const actividades = await req.prisma.actividad.findMany({
    where,
    include: {
      categorias: {
        orderBy: { orden: 'asc' },
      },
      _count: {
        select: { categorias: true }
      }
    },
    orderBy: { orden: 'asc' },
  })

  res.json({
    success: true,
    data: actividades.map(a => ({
      ...a,
      cuotaMensual: a.cuotaMensual ? Number(a.cuotaMensual) : null,
      cantidadCategorias: a._count.categorias,
      categorias: a.categorias.map(c => ({
        ...c,
        cuotaMensual: c.cuotaMensual ? Number(c.cuotaMensual) : null,
      })),
    })),
  })
}))

// GET /api/admin/actividades/:id - Detalle de actividad
router.get('/actividades/:id', authAdmin, asyncHandler(async (req, res) => {
  const actividad = await req.prisma.actividad.findUnique({
    where: { id: parseInt(req.params.id) },
    include: {
      categorias: {
        orderBy: { orden: 'asc' },
        include: {
          _count: { select: { inscripciones: { where: { estado: 'ACTIVA' } } } }
        }
      },
    },
  })

  if (!actividad) throw new AppError('Actividad no encontrada', 404, 'NOT_FOUND')

  res.json({
    success: true,
    data: {
      ...actividad,
      cuotaMensual: actividad.cuotaMensual ? Number(actividad.cuotaMensual) : null,
      categorias: actividad.categorias.map(c => ({
        ...c,
        cuotaMensual: c.cuotaMensual ? Number(c.cuotaMensual) : null,
        inscriptosActivos: c._count.inscripciones,
      })),
    },
  })
}))

// POST /api/admin/actividades - Crear actividad
router.post('/actividades', authAdmin, asyncHandler(async (req, res) => {
  const { codigo, nombre, descripcion, requiereAptaFisica, cuotaMensual, color, orden } = req.body

  if (!codigo || !nombre) {
    throw new AppError('Código y nombre son requeridos', 400, 'VALIDATION_ERROR')
  }

  const existente = await req.prisma.actividad.findUnique({ where: { codigo } })
  if (existente) throw new AppError('Ya existe una actividad con ese código', 400, 'DUPLICATE')

  const actividad = await req.prisma.actividad.create({
    data: {
      codigo,
      nombre,
      descripcion,
      requiereAptaFisica: requiereAptaFisica ?? true,
      cuotaMensual: cuotaMensual ? parseFloat(cuotaMensual) : null,
      color,
      orden: orden || 0,
    },
  })

  res.status(201).json({
    success: true,
    data: { ...actividad, cuotaMensual: actividad.cuotaMensual ? Number(actividad.cuotaMensual) : null }
  })
}))

// PUT /api/admin/actividades/:id - Actualizar actividad
router.put('/actividades/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { codigo, nombre, descripcion, requiereAptaFisica, cuotaMensual, color, orden, activo } = req.body

  const existente = await req.prisma.actividad.findUnique({ where: { id: parseInt(id) } })
  if (!existente) throw new AppError('Actividad no encontrada', 404, 'NOT_FOUND')

  if (codigo && codigo !== existente.codigo) {
    const duplicado = await req.prisma.actividad.findUnique({ where: { codigo } })
    if (duplicado) throw new AppError('Ya existe una actividad con ese código', 400, 'DUPLICATE')
  }

  const actividad = await req.prisma.actividad.update({
    where: { id: parseInt(id) },
    data: {
      codigo: codigo ?? existente.codigo,
      nombre: nombre ?? existente.nombre,
      descripcion: descripcion !== undefined ? descripcion : existente.descripcion,
      requiereAptaFisica: requiereAptaFisica !== undefined ? requiereAptaFisica : existente.requiereAptaFisica,
      cuotaMensual: cuotaMensual !== undefined ? (cuotaMensual ? parseFloat(cuotaMensual) : null) : existente.cuotaMensual,
      color: color !== undefined ? color : existente.color,
      orden: orden !== undefined ? orden : existente.orden,
      activo: activo !== undefined ? activo : existente.activo,
    },
  })

  res.json({
    success: true,
    data: { ...actividad, cuotaMensual: actividad.cuotaMensual ? Number(actividad.cuotaMensual) : null }
  })
}))

// DELETE /api/admin/actividades/:id - Eliminar actividad
router.delete('/actividades/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const categoriasCount = await req.prisma.categoriaActividad.count({
    where: { actividadId: parseInt(id) },
  })

  if (categoriasCount > 0) {
    throw new AppError(`No se puede eliminar, tiene ${categoriasCount} categoría(s) asociadas`, 400, 'HAS_RELATIONS')
  }

  await req.prisma.actividad.delete({ where: { id: parseInt(id) } })
  res.json({ success: true, data: { mensaje: 'Actividad eliminada' } })
}))

// --- CATEGORÍAS DE ACTIVIDAD ---

// GET /api/admin/categorias-actividad - Listado de categorías
router.get('/categorias-actividad', authAdmin, asyncHandler(async (req, res) => {
  const { actividadId, activo } = req.query
  const where = {}
  if (actividadId) where.actividadId = parseInt(actividadId)
  if (activo !== undefined) where.activo = activo === 'true'

  const categorias = await req.prisma.categoriaActividad.findMany({
    where,
    include: {
      actividad: { select: { id: true, codigo: true, nombre: true, cuotaMensual: true } },
      _count: { select: { inscripciones: { where: { estado: 'ACTIVA' } } } }
    },
    orderBy: [{ actividad: { orden: 'asc' } }, { orden: 'asc' }],
  })

  res.json({
    success: true,
    data: categorias.map(c => ({
      ...c,
      cuotaMensual: c.cuotaMensual ? Number(c.cuotaMensual) : null,
      cuotaEfectiva: c.cuotaMensual ? Number(c.cuotaMensual) : (c.actividad.cuotaMensual ? Number(c.actividad.cuotaMensual) : null),
      actividad: { ...c.actividad, cuotaMensual: c.actividad.cuotaMensual ? Number(c.actividad.cuotaMensual) : null },
      inscriptosActivos: c._count.inscripciones,
    })),
  })
}))

// GET /api/admin/categorias-actividad/:id - Detalle de categoría
router.get('/categorias-actividad/:id', authAdmin, asyncHandler(async (req, res) => {
  const categoria = await req.prisma.categoriaActividad.findUnique({
    where: { id: parseInt(req.params.id) },
    include: {
      actividad: { select: { id: true, codigo: true, nombre: true, cuotaMensual: true } },
      inscripciones: {
        where: { estado: 'ACTIVA' },
        include: { socio: { select: { id: true, nroSocio: true, apellidoNombre: true } } },
        orderBy: { socio: { apellidoNombre: 'asc' } },
      },
    },
  })

  if (!categoria) throw new AppError('Categoría no encontrada', 404, 'NOT_FOUND')

  res.json({
    success: true,
    data: {
      ...categoria,
      cuotaMensual: categoria.cuotaMensual ? Number(categoria.cuotaMensual) : null,
      cuotaEfectiva: categoria.cuotaMensual ? Number(categoria.cuotaMensual) : (categoria.actividad.cuotaMensual ? Number(categoria.actividad.cuotaMensual) : null),
      actividad: { ...categoria.actividad, cuotaMensual: categoria.actividad.cuotaMensual ? Number(categoria.actividad.cuotaMensual) : null },
    },
  })
}))

// POST /api/admin/categorias-actividad - Crear categoría
router.post('/categorias-actividad', authAdmin, asyncHandler(async (req, res) => {
  const {
    actividadId, codigo, nombre, descripcion, edadMinima, edadMaxima, sexo,
    cuotaMensual, diasEntrenamiento, horarioEntrenamiento, lugarEntrenamiento,
    cupoMaximo, orden
  } = req.body

  if (!actividadId || !codigo || !nombre) {
    throw new AppError('Actividad, código y nombre son requeridos', 400, 'VALIDATION_ERROR')
  }

  const existente = await req.prisma.categoriaActividad.findUnique({ where: { codigo } })
  if (existente) throw new AppError('Ya existe una categoría con ese código', 400, 'DUPLICATE')

  const actividad = await req.prisma.actividad.findUnique({ where: { id: parseInt(actividadId) } })
  if (!actividad) throw new AppError('Actividad no encontrada', 404, 'NOT_FOUND')

  const categoria = await req.prisma.categoriaActividad.create({
    data: {
      actividadId: parseInt(actividadId),
      codigo,
      nombre,
      descripcion,
      edadMinima: edadMinima ? parseInt(edadMinima) : null,
      edadMaxima: edadMaxima ? parseInt(edadMaxima) : null,
      sexo,
      cuotaMensual: cuotaMensual ? parseFloat(cuotaMensual) : null,
      diasEntrenamiento,
      horarioEntrenamiento,
      lugarEntrenamiento,
      cupoMaximo: cupoMaximo ? parseInt(cupoMaximo) : null,
      orden: orden || 0,
    },
    include: { actividad: { select: { id: true, codigo: true, nombre: true, cuotaMensual: true } } },
  })

  res.status(201).json({
    success: true,
    data: {
      ...categoria,
      cuotaMensual: categoria.cuotaMensual ? Number(categoria.cuotaMensual) : null,
      cuotaEfectiva: categoria.cuotaMensual ? Number(categoria.cuotaMensual) : (categoria.actividad.cuotaMensual ? Number(categoria.actividad.cuotaMensual) : null),
      actividad: { ...categoria.actividad, cuotaMensual: categoria.actividad.cuotaMensual ? Number(categoria.actividad.cuotaMensual) : null },
    },
  })
}))

// PUT /api/admin/categorias-actividad/:id - Actualizar categoría
router.put('/categorias-actividad/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const {
    actividadId, codigo, nombre, descripcion, edadMinima, edadMaxima, sexo,
    cuotaMensual, diasEntrenamiento, horarioEntrenamiento, lugarEntrenamiento,
    cupoMaximo, orden, activo
  } = req.body

  const existente = await req.prisma.categoriaActividad.findUnique({ where: { id: parseInt(id) } })
  if (!existente) throw new AppError('Categoría no encontrada', 404, 'NOT_FOUND')

  if (codigo && codigo !== existente.codigo) {
    const duplicado = await req.prisma.categoriaActividad.findUnique({ where: { codigo } })
    if (duplicado) throw new AppError('Ya existe una categoría con ese código', 400, 'DUPLICATE')
  }

  const categoria = await req.prisma.categoriaActividad.update({
    where: { id: parseInt(id) },
    data: {
      actividadId: actividadId ? parseInt(actividadId) : existente.actividadId,
      codigo: codigo ?? existente.codigo,
      nombre: nombre ?? existente.nombre,
      descripcion: descripcion !== undefined ? descripcion : existente.descripcion,
      edadMinima: edadMinima !== undefined ? (edadMinima ? parseInt(edadMinima) : null) : existente.edadMinima,
      edadMaxima: edadMaxima !== undefined ? (edadMaxima ? parseInt(edadMaxima) : null) : existente.edadMaxima,
      sexo: sexo !== undefined ? sexo : existente.sexo,
      cuotaMensual: cuotaMensual !== undefined ? (cuotaMensual ? parseFloat(cuotaMensual) : null) : existente.cuotaMensual,
      diasEntrenamiento: diasEntrenamiento !== undefined ? diasEntrenamiento : existente.diasEntrenamiento,
      horarioEntrenamiento: horarioEntrenamiento !== undefined ? horarioEntrenamiento : existente.horarioEntrenamiento,
      lugarEntrenamiento: lugarEntrenamiento !== undefined ? lugarEntrenamiento : existente.lugarEntrenamiento,
      cupoMaximo: cupoMaximo !== undefined ? (cupoMaximo ? parseInt(cupoMaximo) : null) : existente.cupoMaximo,
      orden: orden !== undefined ? orden : existente.orden,
      activo: activo !== undefined ? activo : existente.activo,
    },
    include: { actividad: { select: { id: true, codigo: true, nombre: true, cuotaMensual: true } } },
  })

  res.json({
    success: true,
    data: {
      ...categoria,
      cuotaMensual: categoria.cuotaMensual ? Number(categoria.cuotaMensual) : null,
      cuotaEfectiva: categoria.cuotaMensual ? Number(categoria.cuotaMensual) : (categoria.actividad.cuotaMensual ? Number(categoria.actividad.cuotaMensual) : null),
      actividad: { ...categoria.actividad, cuotaMensual: categoria.actividad.cuotaMensual ? Number(categoria.actividad.cuotaMensual) : null },
    },
  })
}))

// DELETE /api/admin/categorias-actividad/:id - Eliminar categoría
router.delete('/categorias-actividad/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const inscripcionesCount = await req.prisma.inscripcion.count({
    where: { categoriaActividadId: parseInt(id) },
  })

  if (inscripcionesCount > 0) {
    throw new AppError(`No se puede eliminar, tiene ${inscripcionesCount} inscripción(es)`, 400, 'HAS_RELATIONS')
  }

  await req.prisma.categoriaActividad.delete({ where: { id: parseInt(id) } })
  res.json({ success: true, data: { mensaje: 'Categoría eliminada' } })
}))

// --- CARGOS DE PERSONAL ---

// GET /api/admin/cargos-personal - Listado de cargos
router.get('/cargos-personal', authAdmin, asyncHandler(async (req, res) => {
  const { activo } = req.query
  const where = activo !== undefined ? { activo: activo === 'true' } : {}

  const cargos = await req.prisma.cargoPersonal.findMany({
    where,
    orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    include: {
      _count: { select: { entidades: true } }
    }
  })

  res.json({ success: true, data: cargos })
}))

// GET /api/admin/cargos-personal/:id - Detalle de cargo
router.get('/cargos-personal/:id', authAdmin, asyncHandler(async (req, res) => {
  const cargo = await req.prisma.cargoPersonal.findUnique({
    where: { id: parseInt(req.params.id) },
    include: {
      entidades: {
        where: { activo: true },
        select: { id: true, codigo: true, razonSocial: true }
      }
    }
  })

  if (!cargo) throw new AppError('Cargo no encontrado', 404, 'NOT_FOUND')

  res.json({ success: true, data: cargo })
}))

// POST /api/admin/cargos-personal - Crear cargo
router.post('/cargos-personal', authAdmin, asyncHandler(async (req, res) => {
  const { codigo, nombre, descripcion, orden } = req.body

  if (!codigo || !nombre) {
    throw new AppError('Codigo y nombre son requeridos', 400, 'VALIDATION_ERROR')
  }

  const existente = await req.prisma.cargoPersonal.findUnique({ where: { codigo } })
  if (existente) {
    throw new AppError('Ya existe un cargo con ese codigo', 400, 'DUPLICATE')
  }

  const cargo = await req.prisma.cargoPersonal.create({
    data: {
      codigo: codigo.toUpperCase(),
      nombre,
      descripcion,
      orden: orden || 0,
    }
  })

  res.status(201).json({ success: true, data: cargo })
}))

// PUT /api/admin/cargos-personal/:id - Actualizar cargo
router.put('/cargos-personal/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { codigo, nombre, descripcion, orden, activo } = req.body

  const existente = await req.prisma.cargoPersonal.findUnique({ where: { id: parseInt(id) } })
  if (!existente) throw new AppError('Cargo no encontrado', 404, 'NOT_FOUND')

  // Verificar codigo unico si cambio
  if (codigo && codigo !== existente.codigo) {
    const otro = await req.prisma.cargoPersonal.findUnique({ where: { codigo } })
    if (otro) throw new AppError('Ya existe un cargo con ese codigo', 400, 'DUPLICATE')
  }

  const cargo = await req.prisma.cargoPersonal.update({
    where: { id: parseInt(id) },
    data: {
      codigo: codigo ? codigo.toUpperCase() : existente.codigo,
      nombre: nombre ?? existente.nombre,
      descripcion: descripcion !== undefined ? descripcion : existente.descripcion,
      orden: orden !== undefined ? orden : existente.orden,
      activo: activo !== undefined ? activo : existente.activo,
    }
  })

  res.json({ success: true, data: cargo })
}))

// DELETE /api/admin/cargos-personal/:id - Eliminar cargo
router.delete('/cargos-personal/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const cargo = await req.prisma.cargoPersonal.findUnique({
    where: { id: parseInt(id) },
    include: { _count: { select: { entidades: true } } }
  })

  if (!cargo) throw new AppError('Cargo no encontrado', 404, 'NOT_FOUND')

  if (cargo._count.entidades > 0) {
    throw new AppError(`No se puede eliminar, tiene ${cargo._count.entidades} empleado(s) asignado(s)`, 400, 'HAS_RELATIONS')
  }

  await req.prisma.cargoPersonal.delete({ where: { id: parseInt(id) } })
  res.json({ success: true, data: { mensaje: 'Cargo eliminado' } })
}))

// --- ENTRENADORES ---

// GET /api/admin/entrenadores - Listado de entrenadores
router.get('/entrenadores', authAdmin, asyncHandler(async (req, res) => {
  const { activo } = req.query
  const where = activo !== undefined ? { activo: activo === 'true' } : {}

  const entrenadores = await req.prisma.entrenador.findMany({
    where,
    include: {
      entidad: true,
      categorias: {
        where: { activo: true },
        include: {
          categoriaActividad: {
            include: { actividad: { select: { id: true, nombre: true } } }
          }
        }
      }
    },
    orderBy: { nombre: 'asc' },
  })

  res.json({
    success: true,
    data: entrenadores.map(e => ({
      ...e,
      categoriasActivas: e.categorias.length,
    })),
  })
}))

// GET /api/admin/entrenadores/:id - Detalle de entrenador
router.get('/entrenadores/:id', authAdmin, asyncHandler(async (req, res) => {
  const entrenador = await req.prisma.entrenador.findUnique({
    where: { id: parseInt(req.params.id) },
    include: {
      entidad: {
        include: {
          cargoPersonal: true
        }
      },
      categorias: {
        include: {
          categoriaActividad: {
            include: { actividad: { select: { id: true, codigo: true, nombre: true } } }
          }
        },
        orderBy: { fechaDesde: 'desc' }
      }
    },
  })

  if (!entrenador) throw new AppError('Entrenador no encontrado', 404, 'NOT_FOUND')

  res.json({ success: true, data: entrenador })
}))

// Helper: Generar codigo unico para Entidad PERSONAL
async function generarCodigoEntidadPersonal(prisma) {
  const prefijo = 'PERS-'
  const ultima = await prisma.entidad.findFirst({
    where: { codigo: { startsWith: prefijo } },
    orderBy: { codigo: 'desc' }
  })

  let siguiente = 1
  if (ultima) {
    const numActual = parseInt(ultima.codigo.replace(prefijo, ''))
    if (!isNaN(numActual)) siguiente = numActual + 1
  }

  return `${prefijo}${String(siguiente).padStart(4, '0')}`
}

// POST /api/admin/entrenadores - Crear entrenador
router.post('/entrenadores', authAdmin, asyncHandler(async (req, res) => {
  const {
    nombre, apellido, documento, telefono, email, socioId, especialidad, observaciones,
    // Campos adicionales para Entidad PERSONAL
    tipoDocumento, direccion, ciudad, provincia, codigoPostal, banco, cbu, alias,
    legajo, cargoPersonalId, fechaIngreso, sueldoBasico
  } = req.body

  if (!nombre) {
    throw new AppError('El nombre es requerido', 400, 'VALIDATION_ERROR')
  }

  // Crear en transaccion: Entidad PERSONAL + Entrenador
  const entrenador = await req.prisma.$transaction(async (tx) => {
    // 1. Crear Entidad tipo PERSONAL
    const codigoEntidad = await generarCodigoEntidadPersonal(tx)
    const razonSocial = apellido ? `${apellido}, ${nombre}` : nombre

    const entidad = await tx.entidad.create({
      data: {
        codigo: codigoEntidad,
        tipo: 'PERSONAL',
        razonSocial,
        tipoDocumento: tipoDocumento || 'DNI',
        documento,
        email,
        telefono,
        direccion,
        ciudad,
        provincia,
        codigoPostal,
        banco,
        cbu,
        alias,
        legajo,
        cargoPersonalId: cargoPersonalId ? parseInt(cargoPersonalId) : null,
        fechaIngreso: fechaIngreso ? new Date(fechaIngreso) : new Date(),
        sueldoBasico: sueldoBasico ? parseFloat(sueldoBasico) : null,
      }
    })

    // 2. Crear Entrenador vinculado a la Entidad
    const nuevoEntrenador = await tx.entrenador.create({
      data: {
        nombre,
        apellido,
        documento,
        telefono,
        email,
        socioId: socioId ? parseInt(socioId) : null,
        especialidad,
        observaciones,
        entidadId: entidad.id,
      },
      include: { entidad: true }
    })

    return nuevoEntrenador
  })

  res.status(201).json({ success: true, data: entrenador })
}))

// PUT /api/admin/entrenadores/:id - Actualizar entrenador
router.put('/entrenadores/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const {
    nombre, apellido, documento, telefono, email, socioId, especialidad, observaciones, activo,
    // Campos adicionales para Entidad PERSONAL
    tipoDocumento, direccion, ciudad, provincia, codigoPostal, banco, cbu, alias,
    legajo, cargoPersonalId, fechaIngreso, sueldoBasico
  } = req.body

  const existente = await req.prisma.entrenador.findUnique({
    where: { id: parseInt(id) },
    include: { entidad: true }
  })
  if (!existente) throw new AppError('Entrenador no encontrado', 404, 'NOT_FOUND')

  // Actualizar en transaccion
  const entrenador = await req.prisma.$transaction(async (tx) => {
    // 1. Actualizar o crear Entidad PERSONAL
    const nombreFinal = nombre ?? existente.nombre
    const apellidoFinal = apellido !== undefined ? apellido : existente.apellido
    const razonSocial = apellidoFinal ? `${apellidoFinal}, ${nombreFinal}` : nombreFinal

    if (existente.entidadId) {
      // Actualizar Entidad existente
      await tx.entidad.update({
        where: { id: existente.entidadId },
        data: {
          razonSocial,
          tipoDocumento: tipoDocumento !== undefined ? tipoDocumento : undefined,
          documento: documento !== undefined ? documento : undefined,
          email: email !== undefined ? email : undefined,
          telefono: telefono !== undefined ? telefono : undefined,
          direccion: direccion !== undefined ? direccion : undefined,
          ciudad: ciudad !== undefined ? ciudad : undefined,
          provincia: provincia !== undefined ? provincia : undefined,
          codigoPostal: codigoPostal !== undefined ? codigoPostal : undefined,
          banco: banco !== undefined ? banco : undefined,
          cbu: cbu !== undefined ? cbu : undefined,
          alias: alias !== undefined ? alias : undefined,
          legajo: legajo !== undefined ? legajo : undefined,
          cargoPersonalId: cargoPersonalId !== undefined ? (cargoPersonalId ? parseInt(cargoPersonalId) : null) : undefined,
          fechaIngreso: fechaIngreso ? new Date(fechaIngreso) : undefined,
          sueldoBasico: sueldoBasico !== undefined ? (sueldoBasico ? parseFloat(sueldoBasico) : null) : undefined,
          activo: activo !== undefined ? activo : undefined,
        }
      })
    } else {
      // Crear Entidad si no existe (migracion de entrenadores antiguos)
      const codigoEntidad = await generarCodigoEntidadPersonal(tx)
      const entidad = await tx.entidad.create({
        data: {
          codigo: codigoEntidad,
          tipo: 'PERSONAL',
          razonSocial,
          tipoDocumento: tipoDocumento || 'DNI',
          documento: documento !== undefined ? documento : existente.documento,
          email: email !== undefined ? email : existente.email,
          telefono: telefono !== undefined ? telefono : existente.telefono,
          direccion,
          ciudad,
          provincia,
          codigoPostal,
          banco,
          cbu,
          alias,
          legajo,
          cargoPersonalId: cargoPersonalId ? parseInt(cargoPersonalId) : null,
          fechaIngreso: fechaIngreso ? new Date(fechaIngreso) : new Date(),
          sueldoBasico: sueldoBasico ? parseFloat(sueldoBasico) : null,
        }
      })

      // Vincular entidad al entrenador
      await tx.entrenador.update({
        where: { id: parseInt(id) },
        data: { entidadId: entidad.id }
      })
    }

    // 2. Actualizar Entrenador
    const entrenadorActualizado = await tx.entrenador.update({
      where: { id: parseInt(id) },
      data: {
        nombre: nombreFinal,
        apellido: apellidoFinal,
        documento: documento !== undefined ? documento : existente.documento,
        telefono: telefono !== undefined ? telefono : existente.telefono,
        email: email !== undefined ? email : existente.email,
        socioId: socioId !== undefined ? (socioId ? parseInt(socioId) : null) : existente.socioId,
        especialidad: especialidad !== undefined ? especialidad : existente.especialidad,
        observaciones: observaciones !== undefined ? observaciones : existente.observaciones,
        activo: activo !== undefined ? activo : existente.activo,
      },
      include: {
        entidad: true,
        categorias: {
          where: { activo: true },
          include: {
            categoriaActividad: {
              include: { actividad: { select: { id: true, nombre: true } } }
            }
          }
        }
      },
    })

    return entrenadorActualizado
  })

  res.json({ success: true, data: entrenador })
}))

// DELETE /api/admin/entrenadores/:id - Eliminar entrenador
router.delete('/entrenadores/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  // Primero eliminar las asignaciones de categorías
  await req.prisma.entrenadorCategoria.deleteMany({
    where: { entrenadorId: parseInt(id) }
  })

  await req.prisma.entrenador.delete({ where: { id: parseInt(id) } })
  res.json({ success: true, data: { mensaje: 'Entrenador eliminado' } })
}))

// POST /api/admin/entrenadores/:id/categorias - Asignar categoría a entrenador
router.post('/entrenadores/:id/categorias', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { categoriaActividadId, rol } = req.body

  if (!categoriaActividadId) {
    throw new AppError('La categoría es requerida', 400, 'VALIDATION_ERROR')
  }

  const entrenador = await req.prisma.entrenador.findUnique({ where: { id: parseInt(id) } })
  if (!entrenador) throw new AppError('Entrenador no encontrado', 404, 'NOT_FOUND')

  const categoria = await req.prisma.categoriaActividad.findUnique({ where: { id: parseInt(categoriaActividadId) } })
  if (!categoria) throw new AppError('Categoría no encontrada', 404, 'NOT_FOUND')

  // Verificar si ya existe la asignación
  const existente = await req.prisma.entrenadorCategoria.findUnique({
    where: {
      entrenadorId_categoriaActividadId: {
        entrenadorId: parseInt(id),
        categoriaActividadId: parseInt(categoriaActividadId)
      }
    }
  })

  if (existente) {
    // Si existe pero está inactiva, reactivarla
    if (!existente.activo) {
      const asignacion = await req.prisma.entrenadorCategoria.update({
        where: { id: existente.id },
        data: { activo: true, rol: rol || 'ENTRENADOR', fechaDesde: new Date() },
        include: {
          categoriaActividad: {
            include: { actividad: { select: { id: true, nombre: true } } }
          }
        }
      })
      return res.json({ success: true, data: asignacion })
    }
    throw new AppError('El entrenador ya está asignado a esta categoría', 400, 'DUPLICATE')
  }

  const asignacion = await req.prisma.entrenadorCategoria.create({
    data: {
      entrenadorId: parseInt(id),
      categoriaActividadId: parseInt(categoriaActividadId),
      rol: rol || 'ENTRENADOR',
    },
    include: {
      categoriaActividad: {
        include: { actividad: { select: { id: true, nombre: true } } }
      }
    }
  })

  res.status(201).json({ success: true, data: asignacion })
}))

// DELETE /api/admin/entrenadores/:id/categorias/:catId - Quitar categoría de entrenador
router.delete('/entrenadores/:id/categorias/:catId', authAdmin, asyncHandler(async (req, res) => {
  const { id, catId } = req.params

  const asignacion = await req.prisma.entrenadorCategoria.findFirst({
    where: {
      entrenadorId: parseInt(id),
      categoriaActividadId: parseInt(catId),
      activo: true
    }
  })

  if (!asignacion) throw new AppError('Asignación no encontrada', 404, 'NOT_FOUND')

  await req.prisma.entrenadorCategoria.update({
    where: { id: asignacion.id },
    data: { activo: false, fechaHasta: new Date() }
  })

  res.json({ success: true, data: { mensaje: 'Categoría desasignada' } })
}))

// GET /api/admin/cobradores - Listado de cobradores
router.get('/cobradores', authAdmin, asyncHandler(async (req, res) => {
  const cobradores = await req.prisma.cobrador.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' },
  })

  res.json({
    success: true,
    data: cobradores.map(c => ({
      ...c,
      comisionPct: Number(c.comisionPct),
    })),
  })
}))

// ============================================================================
// TABLAS AUXILIARES DE SOCIOS
// ============================================================================

// --- TIPOS DE SOCIO ---

// GET /api/admin/tipos-socio
router.get('/tipos-socio', authAdmin, asyncHandler(async (req, res) => {
  const { activo } = req.query
  const where = activo !== undefined ? { activo: activo === 'true' } : {}

  const tipos = await req.prisma.tipoSocio.findMany({
    where,
    include: {
      conceptoTesoreria: { select: { id: true, codigo: true, nombre: true } },
    },
    orderBy: { orden: 'asc' },
  })

  res.json({ success: true, data: tipos })
}))

// GET /api/admin/tipos-socio/:id
router.get('/tipos-socio/:id', authAdmin, asyncHandler(async (req, res) => {
  const tipo = await req.prisma.tipoSocio.findUnique({
    where: { id: parseInt(req.params.id) },
    include: {
      conceptoTesoreria: { select: { id: true, codigo: true, nombre: true } },
    },
  })
  if (!tipo) throw new AppError('Tipo de socio no encontrado', 404, 'NOT_FOUND')
  res.json({ success: true, data: tipo })
}))

// POST /api/admin/tipos-socio
router.post('/tipos-socio', authAdmin, asyncHandler(async (req, res) => {
  const { codigo, nombre, descripcion, cuotaMensual, conceptoTesoreriaId, color, orden } = req.body

  if (!codigo || !nombre) {
    throw new AppError('Código y nombre son requeridos', 400, 'VALIDATION_ERROR')
  }

  const existente = await req.prisma.tipoSocio.findUnique({ where: { codigo } })
  if (existente) throw new AppError('Ya existe un tipo con ese código', 400, 'DUPLICATE')

  const tipo = await req.prisma.tipoSocio.create({
    data: {
      codigo,
      nombre,
      descripcion,
      cuotaMensual: cuotaMensual ? parseFloat(cuotaMensual) : null,
      conceptoTesoreriaId: conceptoTesoreriaId ? parseInt(conceptoTesoreriaId) : null,
      color,
      orden: orden || 0,
    },
    include: {
      conceptoTesoreria: { select: { id: true, codigo: true, nombre: true } },
    },
  })

  res.status(201).json({ success: true, data: tipo })
}))

// PUT /api/admin/tipos-socio/:id
router.put('/tipos-socio/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { codigo, nombre, descripcion, cuotaMensual, conceptoTesoreriaId, color, orden, activo } = req.body

  const existente = await req.prisma.tipoSocio.findUnique({ where: { id: parseInt(id) } })
  if (!existente) throw new AppError('Tipo de socio no encontrado', 404, 'NOT_FOUND')

  if (codigo && codigo !== existente.codigo) {
    const duplicado = await req.prisma.tipoSocio.findUnique({ where: { codigo } })
    if (duplicado) throw new AppError('Ya existe un tipo con ese código', 400, 'DUPLICATE')
  }

  const tipo = await req.prisma.tipoSocio.update({
    where: { id: parseInt(id) },
    data: {
      codigo: codigo ?? existente.codigo,
      nombre: nombre ?? existente.nombre,
      descripcion: descripcion !== undefined ? descripcion : existente.descripcion,
      cuotaMensual: cuotaMensual !== undefined ? (cuotaMensual ? parseFloat(cuotaMensual) : null) : existente.cuotaMensual,
      conceptoTesoreriaId: conceptoTesoreriaId !== undefined ? (conceptoTesoreriaId ? parseInt(conceptoTesoreriaId) : null) : existente.conceptoTesoreriaId,
      color: color !== undefined ? color : existente.color,
      orden: orden !== undefined ? orden : existente.orden,
      activo: activo !== undefined ? activo : existente.activo,
    },
    include: {
      conceptoTesoreria: { select: { id: true, codigo: true, nombre: true } },
    },
  })

  res.json({ success: true, data: tipo })
}))

// DELETE /api/admin/tipos-socio/:id
router.delete('/tipos-socio/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  // Verificar si hay socios usando este tipo
  const sociosConTipo = await req.prisma.socio.count({
    where: { tipoSocioRelId: parseInt(id) },
  })

  if (sociosConTipo > 0) {
    throw new AppError(`No se puede eliminar, hay ${sociosConTipo} socio(s) con este tipo`, 400, 'HAS_RELATIONS')
  }

  await req.prisma.tipoSocio.delete({ where: { id: parseInt(id) } })
  res.json({ success: true, data: { mensaje: 'Tipo de socio eliminado' } })
}))

// --- CATEGORÍAS DE SOCIO ---

// GET /api/admin/categorias-socio
router.get('/categorias-socio', authAdmin, asyncHandler(async (req, res) => {
  const { activo } = req.query
  const where = activo !== undefined ? { activo: activo === 'true' } : {}

  const categorias = await req.prisma.categoriaSocio.findMany({
    where,
    orderBy: { orden: 'asc' },
  })

  res.json({
    success: true,
    data: categorias.map(c => ({
      ...c,
      porcentajeDescuento: c.porcentajeDescuento ? Number(c.porcentajeDescuento) : 0,
    })),
  })
}))

// GET /api/admin/categorias-socio/:id
router.get('/categorias-socio/:id', authAdmin, asyncHandler(async (req, res) => {
  const categoria = await req.prisma.categoriaSocio.findUnique({
    where: { id: parseInt(req.params.id) },
  })
  if (!categoria) throw new AppError('Categoría de socio no encontrada', 404, 'NOT_FOUND')
  res.json({
    success: true,
    data: { ...categoria, porcentajeDescuento: categoria.porcentajeDescuento ? Number(categoria.porcentajeDescuento) : 0 },
  })
}))

// POST /api/admin/categorias-socio
router.post('/categorias-socio', authAdmin, asyncHandler(async (req, res) => {
  const { codigo, nombre, descripcion, porcentajeDescuento, color, orden } = req.body

  if (!codigo || !nombre) {
    throw new AppError('Código y nombre son requeridos', 400, 'VALIDATION_ERROR')
  }

  const existente = await req.prisma.categoriaSocio.findUnique({ where: { codigo } })
  if (existente) throw new AppError('Ya existe una categoría con ese código', 400, 'DUPLICATE')

  const categoria = await req.prisma.categoriaSocio.create({
    data: {
      codigo,
      nombre,
      descripcion,
      porcentajeDescuento: porcentajeDescuento ? parseFloat(porcentajeDescuento) : 0,
      color,
      orden: orden || 0,
    },
  })

  res.status(201).json({ success: true, data: categoria })
}))

// PUT /api/admin/categorias-socio/:id
router.put('/categorias-socio/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { codigo, nombre, descripcion, porcentajeDescuento, color, orden, activo } = req.body

  const existente = await req.prisma.categoriaSocio.findUnique({ where: { id: parseInt(id) } })
  if (!existente) throw new AppError('Categoría de socio no encontrada', 404, 'NOT_FOUND')

  if (codigo && codigo !== existente.codigo) {
    const duplicado = await req.prisma.categoriaSocio.findUnique({ where: { codigo } })
    if (duplicado) throw new AppError('Ya existe una categoría con ese código', 400, 'DUPLICATE')
  }

  const categoria = await req.prisma.categoriaSocio.update({
    where: { id: parseInt(id) },
    data: {
      codigo: codigo ?? existente.codigo,
      nombre: nombre ?? existente.nombre,
      descripcion: descripcion !== undefined ? descripcion : existente.descripcion,
      porcentajeDescuento: porcentajeDescuento !== undefined ? parseFloat(porcentajeDescuento) : existente.porcentajeDescuento,
      color: color !== undefined ? color : existente.color,
      orden: orden !== undefined ? orden : existente.orden,
      activo: activo !== undefined ? activo : existente.activo,
    },
  })

  res.json({ success: true, data: categoria })
}))

// DELETE /api/admin/categorias-socio/:id
router.delete('/categorias-socio/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const sociosConCategoria = await req.prisma.socio.count({
    where: { categoriaSocioId: parseInt(id) },
  })

  if (sociosConCategoria > 0) {
    throw new AppError(`No se puede eliminar, hay ${sociosConCategoria} socio(s) con esta categoría`, 400, 'HAS_RELATIONS')
  }

  await req.prisma.categoriaSocio.delete({ where: { id: parseInt(id) } })
  res.json({ success: true, data: { mensaje: 'Categoría de socio eliminada' } })
}))

// --- ESTADOS DE SOCIO ---

// GET /api/admin/estados-socio
router.get('/estados-socio', authAdmin, asyncHandler(async (req, res) => {
  const { activo } = req.query
  const where = activo !== undefined ? { activo: activo === 'true' } : {}

  const estados = await req.prisma.estadoSocio.findMany({
    where,
    orderBy: { orden: 'asc' },
  })

  res.json({ success: true, data: estados })
}))

// GET /api/admin/estados-socio/:id
router.get('/estados-socio/:id', authAdmin, asyncHandler(async (req, res) => {
  const estado = await req.prisma.estadoSocio.findUnique({
    where: { id: parseInt(req.params.id) },
  })
  if (!estado) throw new AppError('Estado de socio no encontrado', 404, 'NOT_FOUND')
  res.json({ success: true, data: estado })
}))

// POST /api/admin/estados-socio
router.post('/estados-socio', authAdmin, asyncHandler(async (req, res) => {
  const { codigo, nombre, descripcion, color, permiteDescuentos, orden } = req.body

  if (!codigo || !nombre) {
    throw new AppError('Código y nombre son requeridos', 400, 'VALIDATION_ERROR')
  }

  const existente = await req.prisma.estadoSocio.findUnique({ where: { codigo } })
  if (existente) throw new AppError('Ya existe un estado con ese código', 400, 'DUPLICATE')

  const estado = await req.prisma.estadoSocio.create({
    data: {
      codigo,
      nombre,
      descripcion,
      color,
      permiteDescuentos: permiteDescuentos || false,
      orden: orden || 0,
    },
  })

  res.status(201).json({ success: true, data: estado })
}))

// PUT /api/admin/estados-socio/:id
router.put('/estados-socio/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { codigo, nombre, descripcion, color, permiteDescuentos, orden, activo } = req.body

  const existente = await req.prisma.estadoSocio.findUnique({ where: { id: parseInt(id) } })
  if (!existente) throw new AppError('Estado de socio no encontrado', 404, 'NOT_FOUND')

  if (codigo && codigo !== existente.codigo) {
    const duplicado = await req.prisma.estadoSocio.findUnique({ where: { codigo } })
    if (duplicado) throw new AppError('Ya existe un estado con ese código', 400, 'DUPLICATE')
  }

  const estado = await req.prisma.estadoSocio.update({
    where: { id: parseInt(id) },
    data: {
      codigo: codigo ?? existente.codigo,
      nombre: nombre ?? existente.nombre,
      descripcion: descripcion !== undefined ? descripcion : existente.descripcion,
      color: color !== undefined ? color : existente.color,
      permiteDescuentos: permiteDescuentos !== undefined ? permiteDescuentos : existente.permiteDescuentos,
      orden: orden !== undefined ? orden : existente.orden,
      activo: activo !== undefined ? activo : existente.activo,
    },
  })

  res.json({ success: true, data: estado })
}))

// DELETE /api/admin/estados-socio/:id
router.delete('/estados-socio/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const sociosConEstado = await req.prisma.socio.count({
    where: { estadoSocioId: parseInt(id) },
  })

  if (sociosConEstado > 0) {
    throw new AppError(`No se puede eliminar, hay ${sociosConEstado} socio(s) con este estado`, 400, 'HAS_RELATIONS')
  }

  await req.prisma.estadoSocio.delete({ where: { id: parseInt(id) } })
  res.json({ success: true, data: { mensaje: 'Estado de socio eliminado' } })
}))

// ==================== CONCEPTOS DE TESORERIA ====================

// GET /api/admin/conceptos-tesoreria
router.get('/conceptos-tesoreria', authAdmin, asyncHandler(async (req, res) => {
  const { activo, tipo } = req.query
  const where = {}
  if (activo !== undefined) where.activo = activo === 'true'
  if (tipo) where.tipo = tipo

  const conceptos = await req.prisma.conceptoTesoreria.findMany({
    where,
    include: {
      cuentaContable: { select: { id: true, codigo: true, nombre: true } },
    },
    orderBy: { orden: 'asc' },
  })

  res.json({ success: true, data: conceptos })
}))

// GET /api/admin/conceptos-tesoreria/:id
router.get('/conceptos-tesoreria/:id', authAdmin, asyncHandler(async (req, res) => {
  const concepto = await req.prisma.conceptoTesoreria.findUnique({
    where: { id: parseInt(req.params.id) },
    include: {
      cuentaContable: { select: { id: true, codigo: true, nombre: true } },
    },
  })
  if (!concepto) throw new AppError('Concepto no encontrado', 404, 'NOT_FOUND')
  res.json({ success: true, data: concepto })
}))

// POST /api/admin/conceptos-tesoreria
router.post('/conceptos-tesoreria', authAdmin, asyncHandler(async (req, res) => {
  const { codigo, nombre, descripcion, tipo, usaEnCompras, usaEnVentas, usaEnTesoreria, cuentaContableId, orden } = req.body

  if (!codigo || !nombre) {
    throw new AppError('Código y nombre son requeridos', 400, 'VALIDATION_ERROR')
  }

  const existente = await req.prisma.conceptoTesoreria.findUnique({ where: { codigo } })
  if (existente) throw new AppError('Ya existe un concepto con ese código', 400, 'DUPLICATE')

  const concepto = await req.prisma.conceptoTesoreria.create({
    data: {
      codigo,
      nombre,
      descripcion,
      tipo: tipo || 'INGRESO',
      usaEnCompras: usaEnCompras || false,
      usaEnVentas: usaEnVentas || false,
      usaEnTesoreria: usaEnTesoreria !== false,
      cuentaContableId: cuentaContableId ? parseInt(cuentaContableId) : null,
      orden: orden || 0,
    },
    include: {
      cuentaContable: { select: { id: true, codigo: true, nombre: true } },
    },
  })

  res.status(201).json({ success: true, data: concepto })
}))

// PUT /api/admin/conceptos-tesoreria/:id
router.put('/conceptos-tesoreria/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { codigo, nombre, descripcion, tipo, usaEnCompras, usaEnVentas, usaEnTesoreria, cuentaContableId, orden, activo } = req.body

  const concepto = await req.prisma.conceptoTesoreria.update({
    where: { id: parseInt(id) },
    data: {
      codigo,
      nombre,
      descripcion,
      tipo,
      usaEnCompras,
      usaEnVentas,
      usaEnTesoreria,
      cuentaContableId: cuentaContableId ? parseInt(cuentaContableId) : null,
      orden,
      activo,
    },
    include: {
      cuentaContable: { select: { id: true, codigo: true, nombre: true } },
    },
  })

  res.json({ success: true, data: concepto })
}))

// DELETE /api/admin/conceptos-tesoreria/:id
router.delete('/conceptos-tesoreria/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  // Verificar si hay tipos de socio o actividades usando este concepto
  const [tiposSocio, actividades, categorias] = await Promise.all([
    req.prisma.tipoSocio.count({ where: { conceptoId: parseInt(id) } }),
    req.prisma.actividad.count({ where: { conceptoId: parseInt(id) } }),
    req.prisma.categoriaActividad.count({ where: { conceptoId: parseInt(id) } }),
  ])

  if (tiposSocio > 0 || actividades > 0 || categorias > 0) {
    throw new AppError('No se puede eliminar, el concepto está en uso', 400, 'IN_USE')
  }

  await req.prisma.conceptoTesoreria.delete({ where: { id: parseInt(id) } })
  res.json({ success: true, data: { mensaje: 'Concepto eliminado' } })
}))

// ============================================
// PERIODOS DE CUOTA
// ============================================

// GET /api/admin/periodos - Listar periodos de cuota
router.get('/periodos', authAdmin, asyncHandler(async (req, res) => {
  const { anio } = req.query

  const where = {}
  if (anio) where.anio = parseInt(anio)

  const periodos = await req.prisma.periodo.findMany({
    where,
    orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
    include: {
      _count: { select: { cargos: true } },
    },
  })

  // Agregar estadísticas de cada periodo
  const periodosConStats = await Promise.all(periodos.map(async (periodo) => {
    const ahora = new Date()
    const [statsTotal, statsPagadas, statsPendientes, statsVencidas] = await Promise.all([
      req.prisma.cargo.aggregate({
        where: { periodoId: periodo.id },
        _sum: { montoTotal: true },
        _count: { _all: true },
      }),
      req.prisma.cargo.aggregate({
        where: { periodoId: periodo.id, estado: 'PAGADO' },
        _sum: { montoTotal: true },
        _count: { _all: true },
      }),
      req.prisma.cargo.aggregate({
        where: { periodoId: periodo.id, estado: 'PENDIENTE' },
        _sum: { montoTotal: true },
        _count: { _all: true },
      }),
      req.prisma.cargo.aggregate({
        where: {
          periodoId: periodo.id,
          estado: 'PENDIENTE',
          fechaVencimiento: { lt: ahora },
        },
        _sum: { montoTotal: true },
        _count: { _all: true },
      }),
    ])
    return {
      ...periodo,
      totalCuotas: statsTotal._count._all,
      montoTotal: Number(statsTotal._sum.montoTotal) || 0,
      cuotasPagadas: statsPagadas._count._all,
      montoPagado: Number(statsPagadas._sum.montoTotal) || 0,
      cuotasPendientes: statsPendientes._count._all,
      montoPendiente: Number(statsPendientes._sum.montoTotal) || 0,
      cuotasVencidas: statsVencidas._count._all,
      montoVencido: Number(statsVencidas._sum.montoTotal) || 0,
    }
  }))

  res.json({ success: true, data: periodosConStats })
}))

// GET /api/admin/periodos/:id - Detalle de un periodo
router.get('/periodos/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const periodo = await req.prisma.periodo.findUnique({
    where: { id: parseInt(id) },
  })

  if (!periodo) {
    throw new AppError('Periodo no encontrado', 404, 'NOT_FOUND')
  }

  const stats = await req.prisma.cargo.groupBy({
    by: ['estado'],
    where: { periodoId: periodo.id },
    _count: true,
    _sum: { montoTotal: true },
  })

  res.json({ success: true, data: { ...periodo, estadisticas: stats } })
}))

// POST /api/admin/periodos - Crear periodo de cuota
router.post('/periodos', authAdmin, asyncHandler(async (req, res) => {
  const { anio, mes, fechaVencimiento } = req.body

  if (!anio || !mes || !fechaVencimiento) {
    throw new AppError('anio, mes y fechaVencimiento son requeridos', 400, 'VALIDATION_ERROR')
  }

  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const nombre = `${meses[parseInt(mes) - 1]} ${anio}`

  const periodo = await req.prisma.periodo.create({
    data: {
      anio: parseInt(anio),
      mes: parseInt(mes),
      nombre,
      fechaVencimiento: new Date(fechaVencimiento),
      estado: 'PENDIENTE',
    },
  })

  res.status(201).json({ success: true, data: periodo })
}))

// DELETE /api/admin/periodos/:id - Eliminar periodo (solo si no tiene pagos)
router.delete('/periodos/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const periodo = await req.prisma.periodo.findUnique({
    where: { id: parseInt(id) },
  })

  if (!periodo) {
    throw new AppError('Periodo no encontrado', 404, 'NOT_FOUND')
  }

  // Verificar si hay cuotas pagadas
  const cuotasPagadas = await req.prisma.cargo.count({
    where: {
      periodoId: periodo.id,
      estado: 'PAGADO',
    },
  })

  if (cuotasPagadas > 0) {
    throw new AppError('No se puede eliminar: hay cuotas pagadas en este periodo', 400, 'HAS_PAYMENTS')
  }

  // Eliminar cuotas pendientes del periodo
  await req.prisma.cargo.deleteMany({
    where: { periodoId: periodo.id },
  })

  // Eliminar el periodo
  await req.prisma.periodo.delete({
    where: { id: periodo.id },
  })

  res.json({ success: true, message: 'Periodo eliminado correctamente' })
}))

// POST /api/admin/periodos/:id/generar - Generar cuotas para un periodo
router.post('/periodos/:id/generar', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const periodo = await req.prisma.periodo.findUnique({
    where: { id: parseInt(id) },
  })

  if (!periodo) {
    throw new AppError('Periodo no encontrado', 404, 'NOT_FOUND')
  }

  // Verificar si ya tiene cuotas generadas
  const cuotasExistentes = await req.prisma.cargo.count({
    where: { periodoId: periodo.id },
  })

  if (cuotasExistentes > 0) {
    // Verificar si hay pagos asociados a estas cuotas
    const cuotasPagadas = await req.prisma.cargo.count({
      where: {
        periodoId: periodo.id,
        estado: 'PAGADO',
      },
    })

    if (cuotasPagadas > 0) {
      throw new AppError('No se puede regenerar: ya hay cuotas pagadas en este periodo', 400, 'HAS_PAYMENTS')
    }

    // Si no hay pagos, eliminar cuotas existentes para regenerar
    await req.prisma.cargo.deleteMany({
      where: { periodoId: periodo.id },
    })

    // Actualizar estado del periodo a PENDIENTE para regenerar
    await req.prisma.periodo.update({
      where: { id: periodo.id },
      data: { estado: 'PENDIENTE' },
    })
  }

  // Obtener socios activos con sus relaciones
  const socios = await req.prisma.socio.findMany({
    where: {
      OR: [
        { estado: { contains: 'Activ', mode: 'insensitive' } },
        { estado: { contains: 'Vigent', mode: 'insensitive' } },
      ],
    },
    include: {
      tipoSocioRel: true,
      categoriaSocioRel: true,
      inscripciones: {
        where: { estado: 'ACTIVA' },
        include: {
          categoriaActividad: {
            include: { actividad: true },
          },
        },
      },
    },
  })

  const cargosACrear = []

  for (const socio of socios) {
    // Calcular descuento por categoria
    const descuentoPct = socio.categoriaSocioRel?.porcentajeDescuento
      ? Number(socio.categoriaSocioRel.porcentajeDescuento)
      : 0

    // Determinar si debe pagar cuota social
    // Solo pagan: Titulares de familia (titularFamiliaId === null y tiene miembros)
    // O socios únicos (no pertenece a ninguna familia)
    const esTitularOUnico = !socio.titularFamiliaId

    if (esTitularOUnico && socio.tipoSocioRel?.cuotaMensual) {
      const montoBase = Number(socio.tipoSocioRel.cuotaMensual)
      const montoBonificacion = montoBase * (descuentoPct / 100)
      const montoTotal = montoBase - montoBonificacion

      // Determinar tipo de cuota: Grupo Familiar si tiene miembros, sino Socio Único
      const esFamilia = socio.tipoSocio?.toLowerCase().includes('familia')
      const tipoCuota = esFamilia ? 'GRUPO_FAMILIAR' : 'SOCIO_UNICO'

      cargosACrear.push({
        periodoId: periodo.id,
        socioId: socio.id,
        grupoFamiliarId: socio.titularFamiliaId || socio.id,
        categoria: 'CUOTA_SOCIAL',
        tipoCuota,
        descripcion: `Cuota Social - ${tipoCuota === 'GRUPO_FAMILIAR' ? 'Grupo Familiar' : 'Socio Único'}`,
        montoOriginal: montoBase,
        montoBonificacion,
        montoTotal,
        estado: 'PENDIENTE',
        fechaVencimiento: periodo.fechaVencimiento,
        origen: 'GENERACION_MASIVA',
        motivoBonificacion: descuentoPct > 0 ? `Descuento por categoría: ${descuentoPct}%` : null,
      })
    }

    // Cargos por actividades (inscripciones activas)
    for (const inscripcion of socio.inscripciones) {
      // Saltar si está exento de cuota
      if (inscripcion.exentoCuota) continue

      const categoria = inscripcion.categoriaActividad
      const actividad = categoria.actividad

      // Determinar monto: primero categoría, luego actividad
      let montoBase = categoria.cuotaMensual
        ? Number(categoria.cuotaMensual)
        : (actividad.cuotaMensual ? Number(actividad.cuotaMensual) : 0)

      // Aplicar porcentaje de inscripción si no es 100%
      if (inscripcion.porcentajeCuota && Number(inscripcion.porcentajeCuota) !== 100) {
        montoBase = montoBase * (Number(inscripcion.porcentajeCuota) / 100)
      }

      if (montoBase > 0) {
        const montoBonificacion = montoBase * (descuentoPct / 100)
        const montoTotal = montoBase - montoBonificacion

        cargosACrear.push({
          periodoId: periodo.id,
          socioId: socio.id,
          grupoFamiliarId: socio.titularFamiliaId || socio.id,
          categoria: 'CUOTA_ACTIVIDAD',
          categoriaActividadId: categoria.id,
          descripcion: `${actividad.nombre} - ${categoria.nombre}`,
          montoOriginal: montoBase,
          montoBonificacion,
          montoTotal,
          estado: 'PENDIENTE',
          fechaVencimiento: periodo.fechaVencimiento,
          origen: 'GENERACION_MASIVA',
          motivoBonificacion: descuentoPct > 0 ? `Descuento por categoría: ${descuentoPct}%` : null,
        })
      }
    }
  }

  // Crear todos los cargos en batch
  if (cargosACrear.length > 0) {
    await req.prisma.cargo.createMany({ data: cargosACrear })
  }

  // Actualizar estado del periodo
  await req.prisma.periodo.update({
    where: { id: periodo.id },
    data: {
      estado: 'GENERADO',
      fechaGeneracion: new Date(),
      generadoPor: req.admin.id,
    },
  })

  res.json({
    success: true,
    data: {
      mensaje: 'Cargos generados correctamente',
      cargosGenerados: cargosACrear.length,
      sociosProcesados: socios.length,
    },
  })
}))

// ============================================
// CUOTAS
// ============================================

// GET /api/admin/cuotas - Listar cuotas con filtros
router.get('/cuotas', authAdmin, asyncHandler(async (req, res) => {
  const { periodoId, socioId, familiaId, estado, page = 1 } = req.query
  const limit = 50
  const skip = (parseInt(page) - 1) * limit

  const where = {}
  if (periodoId) where.periodoId = parseInt(periodoId)
  if (socioId) where.socioId = parseInt(socioId)
  if (familiaId) where.grupoFamiliarId = parseInt(familiaId)
  if (estado) where.estado = estado

  const [cuotas, total] = await Promise.all([
    req.prisma.cargo.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ fechaVencimiento: 'desc' }, { id: 'desc' }],
      include: {
        socio: { select: { id: true, nroSocio: true, apellidoNombre: true } },
        periodo: { select: { id: true, nombre: true, anio: true, mes: true } },
                categoriaActividad: {
          select: {
            id: true,
            nombre: true,
            actividad: { select: { id: true, nombre: true } },
          },
        },
      },
    }),
    req.prisma.cargo.count({ where }),
  ])

  res.json({
    success: true,
    data: {
      data: cuotas,
      pagination: {
        page: parseInt(page),
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  })
}))

// GET /api/admin/cuotas/socio/:socioId - Cuotas de un socio
router.get('/cuotas/socio/:socioId', authAdmin, asyncHandler(async (req, res) => {
  const { socioId } = req.params
  const { estado } = req.query

  const where = { socioId: parseInt(socioId) }
  if (estado) where.estado = estado

  const cuotas = await req.prisma.cargo.findMany({
    where,
    orderBy: [{ fechaVencimiento: 'desc' }],
    include: {
      periodo: { select: { id: true, nombre: true, anio: true, mes: true } },
            categoriaActividad: {
        select: {
          id: true,
          nombre: true,
          actividad: { select: { id: true, nombre: true } },
        },
      },
      pago: { select: { id: true, numero: true, fecha: true } },
    },
  })

  // Calcular totales
  const pendientes = cuotas.filter(c => c.estado === 'PENDIENTE')
  const totalPendiente = pendientes.reduce((sum, c) => sum + Number(c.montoTotal), 0)

  res.json({
    success: true,
    data: {
      cuotas,
      resumen: {
        totalCuotas: cuotas.length,
        cuotasPendientes: pendientes.length,
        totalPendiente,
      },
    },
  })
}))

// GET /api/admin/cuotas/familia/:titularId - Cuotas de una familia
router.get('/cuotas/familia/:titularId', authAdmin, asyncHandler(async (req, res) => {
  const { titularId } = req.params
  const { estado, periodoId } = req.query

  const where = { grupoFamiliarId: parseInt(titularId) }
  if (estado) where.estado = estado
  if (periodoId) where.periodoId = parseInt(periodoId)

  const cuotas = await req.prisma.cargo.findMany({
    where,
    orderBy: [{ fechaVencimiento: 'desc' }, { socioId: 'asc' }],
    include: {
      socio: { select: { id: true, nroSocio: true, apellidoNombre: true } },
      periodo: { select: { id: true, nombre: true, anio: true, mes: true } },
            categoriaActividad: {
        select: {
          id: true,
          nombre: true,
          actividad: { select: { id: true, nombre: true } },
        },
      },
      pago: { select: { id: true, numero: true, fecha: true } },
    },
  })

  // Agrupar por socio
  const cuotasPorSocio = {}
  for (const cuota of cuotas) {
    const key = cuota.socioId
    if (!cuotasPorSocio[key]) {
      cuotasPorSocio[key] = {
        socio: cuota.socio,
        cuotas: [],
        totalPendiente: 0,
      }
    }
    cuotasPorSocio[key].cuotas.push(cuota)
    if (cuota.estado === 'PENDIENTE') {
      cuotasPorSocio[key].totalPendiente += Number(cuota.montoTotal)
    }
  }

  // Calcular total familia
  const pendientes = cuotas.filter(c => c.estado === 'PENDIENTE')
  const totalFamilia = pendientes.reduce((sum, c) => sum + Number(c.montoTotal), 0)

  res.json({
    success: true,
    data: {
      cuotasPorSocio: Object.values(cuotasPorSocio),
      resumen: {
        totalCuotas: cuotas.length,
        cuotasPendientes: pendientes.length,
        totalFamilia,
      },
    },
  })
}))

// GET /api/admin/cuotas/cobranza/:socioId - Obtener cuotas para cobranza (detecta familia automáticamente)
router.get('/cuotas/cobranza/:socioId', authAdmin, asyncHandler(async (req, res) => {
  const { socioId } = req.params
  const { periodoId, estado } = req.query

  // Obtener el socio con info de familia
  const socio = await req.prisma.socio.findUnique({
    where: { id: parseInt(socioId) },
    include: {
      miembrosFamilia: { select: { id: true, nroSocio: true, apellidoNombre: true } },
    },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'NOT_FOUND')
  }

  // Determinar si es grupo familiar o socio único
  // Es familia si: tiene miembros O pertenece a un titular
  const esFamilia = socio.miembrosFamilia?.length > 0 || socio.titularFamiliaId !== null
  const titularId = socio.titularFamiliaId || socio.id

  // Construir query - si no se especifica estado, trae todas
  const where = {}
  if (estado) where.estado = estado
  if (periodoId) where.periodoId = parseInt(periodoId)

  if (esFamilia) {
    // Buscar por grupo familiar
    where.grupoFamiliarId = titularId
  } else {
    // Buscar solo del socio
    where.socioId = socio.id
  }

  const cuotasRaw = await req.prisma.cargo.findMany({
    where,
    orderBy: [{ periodo: { anio: 'desc' } }, { periodo: { mes: 'desc' } }, { socioId: 'asc' }],
    include: {
      socio: { select: { id: true, nroSocio: true, apellidoNombre: true } },
      periodo: { select: { id: true, nombre: true, anio: true, mes: true } },
      categoriaActividad: {
        select: {
          id: true,
          nombre: true,
          actividad: { select: { id: true, nombre: true } },
        },
      },
    },
  })

  // Calcular recargo para cada cuota
  const cuotas = await Promise.all(cuotasRaw.map(async (cuota) => {
    const recargoCalc = await calcularRecargoCargo(req.prisma, cuota)
    return {
      ...cuota,
      recargoCalculado: recargoCalc.recargo,
      porcentajeRecargo: recargoCalc.porcentaje,
      diasMora: recargoCalc.diasMora,
      montoConRecargo: Number(cuota.montoTotal) + recargoCalc.recargo,
    }
  }))

  // Agrupar por socio para mostrar claramente
  const cuotasPorSocio = {}
  for (const cuota of cuotas) {
    const key = cuota.socioId
    if (!cuotasPorSocio[key]) {
      cuotasPorSocio[key] = {
        socio: cuota.socio,
        cuotas: [],
        total: 0,
        totalConRecargo: 0,
      }
    }
    cuotasPorSocio[key].cuotas.push(cuota)
    cuotasPorSocio[key].total += Number(cuota.montoTotal)
    cuotasPorSocio[key].totalConRecargo += cuota.montoConRecargo
  }

  // Obtener titular si es familia
  let titular = null
  if (esFamilia && titularId !== socio.id) {
    titular = await req.prisma.socio.findUnique({
      where: { id: titularId },
      select: { id: true, nroSocio: true, apellidoNombre: true },
    })
  } else if (esFamilia) {
    titular = { id: socio.id, nroSocio: socio.nroSocio, apellidoNombre: socio.apellidoNombre }
  }

  const totalGeneral = cuotas.reduce((sum, c) => sum + Number(c.montoTotal), 0)
  const totalRecargo = cuotas.reduce((sum, c) => sum + c.recargoCalculado, 0)
  const totalConRecargo = totalGeneral + totalRecargo

  res.json({
    success: true,
    data: {
      esFamilia,
      titular,
      sociosPorCobrar: Object.values(cuotasPorSocio),
      cuotas, // Lista plana para facilitar selección
      resumen: {
        cantidadSocios: Object.keys(cuotasPorSocio).length,
        cantidadCuotas: cuotas.length,
        totalGeneral,
        totalRecargo,
        totalConRecargo,
      },
    },
  })
}))

// ============================================
// PAGOS
// ============================================

// GET /api/admin/pagos - Listar pagos
router.get('/pagos', authAdmin, asyncHandler(async (req, res) => {
  const { socioId, desde, hasta, page = 1 } = req.query
  const limit = 50
  const skip = (parseInt(page) - 1) * limit

  const where = { estado: 'CONFIRMADO' }
  if (socioId) where.socioId = parseInt(socioId)
  if (desde || hasta) {
    where.fecha = {}
    if (desde) where.fecha.gte = new Date(desde)
    if (hasta) where.fecha.lte = new Date(hasta)
  }

  const [pagos, total] = await Promise.all([
    req.prisma.pago.findMany({
      where,
      skip,
      take: limit,
      orderBy: { fecha: 'desc' },
      include: {
        socio: { select: { id: true, nroSocio: true, apellidoNombre: true } },
        medioPago: { select: { id: true, nombre: true } },
        cuotas: {
          select: {
            id: true,
            montoTotal: true,
                        periodo: { select: { nombre: true } },
          },
        },
      },
    }),
    req.prisma.pago.count({ where }),
  ])

  res.json({
    success: true,
    data: pagos,
    pagination: {
      page: parseInt(page),
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  })
}))

// GET /api/admin/pagos/:id - Detalle de pago
router.get('/pagos/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const pago = await req.prisma.pago.findUnique({
    where: { id: parseInt(id) },
    include: {
      socio: {
        select: {
          id: true,
          nroSocio: true,
          apellidoNombre: true,
          documento: true,
          email: true,
          celular: true,
        },
      },
      medioPago: true,
      cuotas: {
        include: {
                    periodo: { select: { nombre: true } },
          categoriaActividad: {
            select: {
              nombre: true,
              actividad: { select: { nombre: true } },
            },
          },
        },
      },
    },
  })

  if (!pago) {
    throw new AppError('Pago no encontrado', 404, 'NOT_FOUND')
  }

  res.json({ success: true, data: pago })
}))

// POST /api/admin/pagos - Registrar pago
router.post('/pagos', authAdmin, asyncHandler(async (req, res) => {
  const { socioId, cuotaIds, medioPagoId, montoRecibido, observaciones } = req.body

  if (!socioId || !cuotaIds || !cuotaIds.length || !medioPagoId) {
    throw new AppError('socioId, cuotaIds y medioPagoId son requeridos', 400, 'VALIDATION_ERROR')
  }

  // Obtener cuotas a pagar (fuera de transacción para validar)
  const cuotasRaw = await req.prisma.cargo.findMany({
    where: {
      id: { in: cuotaIds.map(id => parseInt(id)) },
      estado: 'PENDIENTE',
    },
  })

  if (cuotasRaw.length !== cuotaIds.length) {
    throw new AppError('Algunas cuotas no existen o ya están pagadas', 400, 'INVALID_CUOTAS')
  }

  // Calcular recargo para cada cuota
  const cuotas = await Promise.all(cuotasRaw.map(async (cuota) => {
    const recargoCalc = await calcularRecargoCargo(req.prisma, cuota)
    return {
      ...cuota,
      recargoCalculado: recargoCalc.recargo,
    }
  }))

  // Calcular total incluyendo recargos
  const montoBase = cuotas.reduce((sum, c) => sum + Number(c.montoTotal), 0)
  const totalRecargo = cuotas.reduce((sum, c) => sum + c.recargoCalculado, 0)
  const montoTotal = montoBase + totalRecargo
  const montoRecibidoNum = parseFloat(montoRecibido) || montoTotal

  // Obtener caja por defecto (primera activa)
  const caja = await req.prisma.caja.findFirst({
    where: { activo: true },
    orderBy: { id: 'asc' },
  })

  if (!caja) {
    throw new AppError('No hay caja activa configurada', 500, 'NO_CAJA')
  }

  // Todo dentro de una transacción
  const pagoCompleto = await req.prisma.$transaction(async (tx) => {
    // Generar número de recibo (dentro de transacción para evitar duplicados)
    const ultimoPago = await tx.pago.findFirst({
      orderBy: { id: 'desc' },
      select: { numero: true },
    })
    const nuevoNumero = ultimoPago
      ? String(parseInt(ultimoPago.numero) + 1).padStart(8, '0')
      : '00000001'

    // Crear pago
    const pago = await tx.pago.create({
      data: {
        numero: nuevoNumero,
        socioId: parseInt(socioId),
        grupo_familiar_id: cuotas[0].grupoFamiliarId,
        montoTotal,
        montoRecibido: montoRecibidoNum,
        montoACuenta: montoRecibidoNum > montoTotal ? montoRecibidoNum - montoTotal : 0,
        medioPagoId: parseInt(medioPagoId),
        cajaId: caja.id,
        observaciones,
        registradoPor: req.admin.id,
      },
    })

    // Actualizar cada cuota con su recargo y marcar como pagada
    for (const cuota of cuotas) {
      const nuevoMontoRecargo = Number(cuota.montoRecargo) + cuota.recargoCalculado
      const nuevoMontoTotal = Number(cuota.montoOriginal) + nuevoMontoRecargo - Number(cuota.montoBonificacion)

      await tx.cargo.update({
        where: { id: cuota.id },
        data: {
          estado: 'PAGADO',
          fechaPago: new Date(),
          pagoId: pago.id,
          montoRecargo: nuevoMontoRecargo,
          montoTotal: nuevoMontoTotal,
        },
      })
    }

    // Actualizar saldo de caja
    await tx.caja.update({
      where: { id: caja.id },
      data: { saldoActual: { increment: montoTotal } },
    })

    // Crear MovimientoCaja para tracking de tesoreria
    const anioMov = new Date().getFullYear()
    const prefijoMov = `MV-${anioMov}-`
    const ultimoMov = await tx.movimientoCaja.findFirst({
      where: { numero: { startsWith: prefijoMov } },
      orderBy: { numero: 'desc' }
    })
    let siguienteMov = 1
    if (ultimoMov) {
      const partesMov = ultimoMov.numero.split('-')
      siguienteMov = (parseInt(partesMov[partesMov.length - 1]) || 0) + 1
    }
    const numeroMov = `${prefijoMov}${String(siguienteMov).padStart(5, '0')}`

    await tx.movimientoCaja.create({
      data: {
        numero: numeroMov,
        cajaId: caja.id,
        fecha: new Date(),
        tipo: 'INGRESO',
        monto: montoTotal,
        descripcion: `Cobranza cuotas socio #${socioId} - Recibo ${nuevoNumero}`,
        pagoId: pago.id,
        registradoPor: req.admin.id
      }
    })

    // Obtener pago con relaciones para respuesta
    return await tx.pago.findUnique({
      where: { id: pago.id },
      include: {
        socio: {
          select: {
            id: true,
            nroSocio: true,
            apellidoNombre: true,
            documento: true,
            email: true,
          },
        },
        medioPago: { select: { id: true, nombre: true } },
        cargos: {
          include: {
            periodo: { select: { nombre: true } },
            categoriaActividad: {
              select: {
                nombre: true,
                actividad: { select: { nombre: true } },
              },
            },
          },
        },
      },
    })
  })

  // Enviar recibo por email (fuera de transacción, async)
  enviarReciboPago(pagoCompleto).catch(err => {
    console.error('Error enviando recibo por email:', err)
  })

  res.status(201).json({ success: true, data: pagoCompleto })
}))

// GET /api/admin/medios-pago - Listar medios de pago activos
router.get('/medios-pago', authAdmin, asyncHandler(async (req, res) => {
  const medios = await req.prisma.medioPago.findMany({
    where: { activo: true },
    orderBy: { orden: 'asc' },
  })
  res.json({ success: true, data: medios })
}))

// ============================================
// REPORTES DE COBRANZA
// ============================================

// GET /api/admin/reportes/cobranza - Reporte completo de cobranza con datos jerárquicos
router.get('/reportes/cobranza', authAdmin, asyncHandler(async (req, res) => {
  const { periodoId, desde, hasta } = req.query

  // Construir filtro base
  const whereBase = {}
  if (periodoId) whereBase.periodoId = parseInt(periodoId)
  if (desde) whereBase.createdAt = { ...whereBase.createdAt, gte: new Date(desde) }
  if (hasta) whereBase.createdAt = { ...whereBase.createdAt, lte: new Date(hasta) }

  // Excluir anuladas del reporte
  whereBase.estado = { not: 'ANULADO' }

  // 1. KPIs Generales
  const [generado, cobrado, pendiente] = await Promise.all([
    req.prisma.cargo.aggregate({
      where: { ...whereBase, estado: { not: 'ANULADO' } },
      _sum: { montoTotal: true },
      _count: true,
    }),
    req.prisma.cargo.aggregate({
      where: { ...whereBase, estado: 'PAGADO' },
      _sum: { montoTotal: true },
      _count: true,
    }),
    req.prisma.cargo.aggregate({
      where: { ...whereBase, estado: 'PENDIENTE' },
      _sum: { montoTotal: true },
      _count: true,
    }),
  ])

  // Calcular días promedio de pago (solo cuotas pagadas con fechaPago)
  const cuotasPagadas = await req.prisma.cargo.findMany({
    where: { ...whereBase, estado: 'PAGADO', fechaPago: { not: null } },
    select: { createdAt: true, fechaPago: true },
  })

  let diasPromedioPago = 0
  if (cuotasPagadas.length > 0) {
    const sumaDias = cuotasPagadas.reduce((sum, c) => {
      const dias = Math.floor((new Date(c.fechaPago) - new Date(c.createdAt)) / (1000 * 60 * 60 * 24))
      return sum + Math.max(0, dias)
    }, 0)
    diasPromedioPago = Math.round(sumaDias / cuotasPagadas.length)
  }

  // Calcular recargo pendiente
  const cuotasPendientesConRecargo = await req.prisma.cargo.findMany({
    where: { ...whereBase, estado: 'PENDIENTE' },
  })
  let totalRecargoPendiente = 0
  for (const cuota of cuotasPendientesConRecargo) {
    const recargo = await calcularRecargoCargo(req.prisma, cuota)
    totalRecargoPendiente += recargo.recargo
  }

  const totalGenerado = Number(generado._sum.montoTotal) || 0
  const totalCobrado = Number(cobrado._sum.montoTotal) || 0
  const totalPendiente = Number(pendiente._sum.montoTotal) || 0
  const porcentajeMorosidad = totalGenerado > 0 ? Math.round((totalPendiente / totalGenerado) * 100 * 10) / 10 : 0

  // 2. Datos agrupados por categoría
  const cargosPorCategoria = await req.prisma.cargo.groupBy({
    by: ['categoria'],
    where: { ...whereBase, estado: { not: 'ANULADO' } },
    _sum: { montoTotal: true },
    _count: true,
  })

  const cargosPagadosPorCategoria = await req.prisma.cargo.groupBy({
    by: ['categoria'],
    where: { ...whereBase, estado: 'PAGADO' },
    _sum: { montoTotal: true },
    _count: true,
  })

  const cargosPendientesPorCategoria = await req.prisma.cargo.groupBy({
    by: ['categoria'],
    where: { ...whereBase, estado: 'PENDIENTE' },
    _sum: { montoTotal: true },
    _count: true,
  })

  // 3. Para CUOTA_ACTIVIDAD, obtener desglose por actividad y categoría
  const actividadesData = await req.prisma.cargo.findMany({
    where: { ...whereBase, categoria: 'CUOTA_ACTIVIDAD', estado: { not: 'ANULADO' } },
    include: {
      categoriaActividad: {
        include: {
          actividad: true,
        },
      },
    },
  })

  // Agrupar actividades
  const actividadesAgrupadas = {}
  for (const cargo of actividadesData) {
    const actividadNombre = cargo.categoriaActividad?.actividad?.nombre || 'Sin actividad'
    const actividadId = cargo.categoriaActividad?.actividad?.id || 0
    const categoriaNombre = cargo.categoriaActividad?.nombre || 'Sin categoría'
    const categoriaId = cargo.categoriaActividad?.id || 0

    if (!actividadesAgrupadas[actividadId]) {
      actividadesAgrupadas[actividadId] = {
        id: actividadId,
        nombre: actividadNombre,
        generado: 0,
        cobrado: 0,
        pendiente: 0,
        cantGenerado: 0,
        cantCobrado: 0,
        cantPendiente: 0,
        categorias: {},
      }
    }

    const monto = Number(cargo.montoTotal)
    actividadesAgrupadas[actividadId].generado += monto
    actividadesAgrupadas[actividadId].cantGenerado++

    if (cargo.estado === 'PAGADO') {
      actividadesAgrupadas[actividadId].cobrado += monto
      actividadesAgrupadas[actividadId].cantCobrado++
    } else if (cargo.estado === 'PENDIENTE') {
      actividadesAgrupadas[actividadId].pendiente += monto
      actividadesAgrupadas[actividadId].cantPendiente++
    }

    // Subagrupar por categoría
    if (!actividadesAgrupadas[actividadId].categorias[categoriaId]) {
      actividadesAgrupadas[actividadId].categorias[categoriaId] = {
        id: categoriaId,
        nombre: categoriaNombre,
        generado: 0,
        cobrado: 0,
        pendiente: 0,
        cantGenerado: 0,
        cantCobrado: 0,
        cantPendiente: 0,
      }
    }

    actividadesAgrupadas[actividadId].categorias[categoriaId].generado += monto
    actividadesAgrupadas[actividadId].categorias[categoriaId].cantGenerado++

    if (cargo.estado === 'PAGADO') {
      actividadesAgrupadas[actividadId].categorias[categoriaId].cobrado += monto
      actividadesAgrupadas[actividadId].categorias[categoriaId].cantCobrado++
    } else if (cargo.estado === 'PENDIENTE') {
      actividadesAgrupadas[actividadId].categorias[categoriaId].pendiente += monto
      actividadesAgrupadas[actividadId].categorias[categoriaId].cantPendiente++
    }
  }

  // Convertir a array y calcular porcentajes
  const actividades = Object.values(actividadesAgrupadas).map(act => ({
    ...act,
    porcentajeCobro: act.generado > 0 ? Math.round((act.cobrado / act.generado) * 100) : 0,
    categorias: Object.values(act.categorias).map(cat => ({
      ...cat,
      porcentajeCobro: cat.generado > 0 ? Math.round((cat.cobrado / cat.generado) * 100) : 0,
    })),
  }))

  // Construir respuesta jerárquica
  const categoriasFormateadas = ['CUOTA_SOCIAL', 'CUOTA_ACTIVIDAD', 'INSCRIPCION', 'FINANCIACION', 'OTRO'].map(cat => {
    const gen = cargosPorCategoria.find(c => c.categoria === cat)
    const pag = cargosPagadosPorCategoria.find(c => c.categoria === cat)
    const pen = cargosPendientesPorCategoria.find(c => c.categoria === cat)

    const generadoMonto = Number(gen?._sum?.montoTotal) || 0
    const cobradoMonto = Number(pag?._sum?.montoTotal) || 0
    const pendienteMonto = Number(pen?._sum?.montoTotal) || 0

    return {
      categoria: cat,
      nombre: {
        'CUOTA_SOCIAL': 'Cuota Social',
        'CUOTA_ACTIVIDAD': 'Actividades',
        'INSCRIPCION': 'Inscripciones',
        'FINANCIACION': 'Financiación',
        'OTRO': 'Otros',
      }[cat] || cat,
      generado: generadoMonto,
      cobrado: cobradoMonto,
      pendiente: pendienteMonto,
      cantGenerado: gen?._count || 0,
      cantCobrado: pag?._count || 0,
      cantPendiente: pen?._count || 0,
      porcentajeCobro: generadoMonto > 0 ? Math.round((cobradoMonto / generadoMonto) * 100) : 0,
      // Para CUOTA_ACTIVIDAD, incluir desglose
      ...(cat === 'CUOTA_ACTIVIDAD' ? { actividades } : {}),
    }
  }).filter(c => c.cantGenerado > 0) // Solo mostrar categorías con datos

  res.json({
    success: true,
    data: {
      kpis: {
        generado: { monto: totalGenerado, cantidad: generado._count },
        cobrado: { monto: totalCobrado, cantidad: cobrado._count },
        pendiente: { monto: totalPendiente, cantidad: pendiente._count },
        porcentajeMorosidad,
        diasPromedioPago,
        recargoPendiente: totalRecargoPendiente,
      },
      categorias: categoriasFormateadas,
    },
  })
}))

// GET /api/admin/reportes/cobranza/vencidas - Cuotas vencidas
router.get('/reportes/cobranza/vencidas', authAdmin, asyncHandler(async (req, res) => {
  const hoy = new Date()

  const cuotasVencidas = await req.prisma.cargo.findMany({
    where: {
      estado: 'PENDIENTE',
      fechaVencimiento: { lt: hoy },
    },
    orderBy: { fechaVencimiento: 'asc' },
    include: {
      socio: {
        select: {
          id: true,
          nroSocio: true,
          apellidoNombre: true,
          celular: true,
          email: true,
        },
      },
      periodo: { select: { nombre: true } },
          },
    take: 100,
  })

  // Calcular días de atraso
  const cuotasConAtraso = cuotasVencidas.map(c => ({
    ...c,
    diasAtraso: Math.floor((hoy - new Date(c.fechaVencimiento)) / (1000 * 60 * 60 * 24)),
  }))

  res.json({ success: true, data: cuotasConAtraso })
}))

// GET /api/admin/reportes/cobranza/morosos - Lista de morosos por concepto
router.get('/reportes/cobranza/morosos', authAdmin, asyncHandler(async (req, res) => {
  const { categoria, actividadId, categoriaActividadId, periodoId, desde, hasta } = req.query

  const where = {
    estado: 'PENDIENTE',
  }

  // Filtros de periodo/fecha
  if (periodoId) where.periodoId = parseInt(periodoId)
  if (desde) where.createdAt = { ...where.createdAt, gte: new Date(desde) }
  if (hasta) where.createdAt = { ...where.createdAt, lte: new Date(hasta) }

  // Filtros de categoría
  if (categoria) where.categoria = categoria
  if (categoriaActividadId) where.categoriaActividadId = parseInt(categoriaActividadId)

  // Si se filtra por actividad, buscar todas las categorías de esa actividad
  if (actividadId && !categoriaActividadId) {
    const categoriasActividad = await req.prisma.categoriaActividad.findMany({
      where: { actividadId: parseInt(actividadId) },
      select: { id: true },
    })
    where.categoriaActividadId = { in: categoriasActividad.map(c => c.id) }
  }

  // Obtener cuotas pendientes
  const cuotasPendientes = await req.prisma.cargo.findMany({
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
      periodo: { select: { id: true, nombre: true } },
      categoriaActividad: {
        include: {
          actividad: { select: { id: true, nombre: true } },
        },
      },
    },
    orderBy: [
      { socio: { apellidoNombre: 'asc' } },
      { fechaVencimiento: 'asc' },
    ],
  })

  // Calcular recargo y días de atraso para cada cuota
  const hoy = new Date()
  const cuotasConRecargo = []
  for (const cuota of cuotasPendientes) {
    const recargo = await calcularRecargoCargo(req.prisma, cuota)
    cuotasConRecargo.push({
      ...cuota,
      recargo: recargo.recargo,
      montoConRecargo: recargo.montoConRecargo,
      diasAtraso: cuota.fechaVencimiento
        ? Math.max(0, Math.floor((hoy - new Date(cuota.fechaVencimiento)) / (1000 * 60 * 60 * 24)))
        : 0,
    })
  }

  // Agrupar por socio para el resumen
  const sociosMap = {}
  for (const cuota of cuotasConRecargo) {
    const socioId = cuota.socioId
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
    sociosMap[socioId].cuotas.push(cuota)
    sociosMap[socioId].totalDeuda += Number(cuota.montoTotal)
    sociosMap[socioId].totalRecargo += cuota.recargo
    sociosMap[socioId].cantCuotas++
    sociosMap[socioId].maxDiasAtraso = Math.max(sociosMap[socioId].maxDiasAtraso, cuota.diasAtraso)
  }

  const morosos = Object.values(sociosMap).sort((a, b) => b.totalDeuda - a.totalDeuda)

  res.json({
    success: true,
    data: {
      morosos,
      totales: {
        cantSocios: morosos.length,
        cantCuotas: cuotasConRecargo.length,
        totalDeuda: cuotasConRecargo.reduce((sum, c) => sum + Number(c.montoTotal), 0),
        totalRecargo: cuotasConRecargo.reduce((sum, c) => sum + c.recargo, 0),
      },
    },
  })
}))

// GET /api/admin/reportes/cobranza/evolucion - Evolución de cobranza por mes
router.get('/reportes/cobranza/evolucion', authAdmin, asyncHandler(async (req, res) => {
  const { desde, hasta, categoria, actividadId, categoriaActividadId } = req.query

  // Por defecto, último semestre
  const fechaHasta = hasta ? new Date(hasta) : new Date()
  const fechaDesde = desde ? new Date(desde) : new Date(fechaHasta.getFullYear(), fechaHasta.getMonth() - 5, 1)

  // Obtener todos los periodos en el rango
  const periodos = await req.prisma.periodo.findMany({
    where: {
      estado: 'GENERADO',
      OR: [
        {
          anio: { gt: fechaDesde.getFullYear() },
        },
        {
          anio: fechaDesde.getFullYear(),
          mes: { gte: fechaDesde.getMonth() + 1 },
        },
      ],
      AND: [
        {
          OR: [
            { anio: { lt: fechaHasta.getFullYear() } },
            {
              anio: fechaHasta.getFullYear(),
              mes: { lte: fechaHasta.getMonth() + 1 },
            },
          ],
        },
      ],
    },
    orderBy: [{ anio: 'asc' }, { mes: 'asc' }],
  })

  // Construir filtro adicional para cargos
  const filtroAdicional = {}
  if (categoria) filtroAdicional.categoria = categoria
  if (categoriaActividadId) {
    filtroAdicional.categoriaActividadId = parseInt(categoriaActividadId)
  } else if (actividadId) {
    // Si hay actividadId pero no categoriaActividadId, buscar todas las categorías de esa actividad
    const categoriasAct = await req.prisma.categoriaActividad.findMany({
      where: { actividadId: parseInt(actividadId) },
      select: { id: true },
    })
    filtroAdicional.categoriaActividadId = { in: categoriasAct.map(c => c.id) }
  }

  // Obtener datos de cobranza por período
  const evolucion = []

  for (const periodo of periodos) {
    const [generado, cobrado] = await Promise.all([
      req.prisma.cargo.aggregate({
        where: {
          periodoId: periodo.id,
          estado: { not: 'ANULADO' },
          ...filtroAdicional,
        },
        _sum: { montoTotal: true },
        _count: true,
      }),
      req.prisma.cargo.aggregate({
        where: {
          periodoId: periodo.id,
          estado: 'PAGADO',
          ...filtroAdicional,
        },
        _sum: { montoTotal: true },
        _count: true,
      }),
    ])

    const montoGenerado = Number(generado._sum.montoTotal) || 0
    const montoCobrado = Number(cobrado._sum.montoTotal) || 0

    evolucion.push({
      periodoId: periodo.id,
      nombre: periodo.nombre,
      mes: periodo.mes,
      anio: periodo.anio,
      generado: montoGenerado,
      cobrado: montoCobrado,
      cantGenerado: generado._count || 0,
      cantCobrado: cobrado._count || 0,
      porcentajeCobro: montoGenerado > 0 ? Math.round((montoCobrado / montoGenerado) * 100) : 0,
    })
  }

  res.json({
    success: true,
    data: {
      evolucion,
      rango: {
        desde: fechaDesde.toISOString().split('T')[0],
        hasta: fechaHasta.toISOString().split('T')[0],
      },
    },
  })
}))

// ============================================
// CONFIGURACION DEL SISTEMA
// ============================================

// GET /api/admin/sistema/configuracion - Obtener configuraciones del sistema
router.get('/sistema/configuracion', authAdmin, asyncHandler(async (req, res) => {
  const { modulo } = req.query

  const where = {}
  if (modulo) where.modulo = modulo

  const configuraciones = await req.prisma.configuracion.findMany({
    where,
    orderBy: [{ modulo: 'asc' }, { clave: 'asc' }],
  })

  res.json({ success: true, data: configuraciones })
}))

// GET /api/admin/sistema/configuracion/:clave - Obtener una configuración
router.get('/sistema/configuracion/:clave', authAdmin, asyncHandler(async (req, res) => {
  const { clave } = req.params

  const config = await req.prisma.configuracion.findUnique({
    where: { clave },
  })

  if (!config) {
    return res.status(404).json({ success: false, error: { message: 'Configuración no encontrada' } })
  }

  res.json({ success: true, data: config })
}))

// PUT /api/admin/sistema/configuracion/:clave - Actualizar o crear una configuración
router.put('/sistema/configuracion/:clave', authAdmin, asyncHandler(async (req, res) => {
  const { clave } = req.params
  const { valor, tipo, modulo, descripcion } = req.body

  // Verificar si existe y si es editable
  const existing = await req.prisma.configuracion.findUnique({
    where: { clave },
  })

  if (existing && !existing.editable) {
    return res.status(400).json({ success: false, error: { message: 'Esta configuración no es editable' } })
  }

  // Upsert: actualizar si existe, crear si no
  const updated = await req.prisma.configuracion.upsert({
    where: { clave },
    update: { valor: String(valor) },
    create: {
      clave,
      valor: String(valor),
      tipo: tipo || 'STRING',
      modulo: modulo || 'SISTEMA',
      descripcion: descripcion || null,
    },
  })

  res.json({ success: true, data: updated })
}))

// PUT /api/admin/sistema/modo-demo - Actualizar modo demo (shortcut)
router.put('/sistema/modo-demo', authAdmin, asyncHandler(async (req, res) => {
  const { activo, email } = req.body

  // Actualizar MODO_DEMO
  await req.prisma.configuracion.upsert({
    where: { clave: 'MODO_DEMO' },
    update: { valor: activo ? 'true' : 'false' },
    create: {
      clave: 'MODO_DEMO',
      valor: activo ? 'true' : 'false',
      tipo: 'BOOLEAN',
      modulo: 'SISTEMA',
      descripcion: 'Modo demo activo',
    },
  })

  // Actualizar EMAIL_DEMO si se proporciona
  if (email !== undefined) {
    await req.prisma.configuracion.upsert({
      where: { clave: 'EMAIL_DEMO' },
      update: { valor: email || '' },
      create: {
        clave: 'EMAIL_DEMO',
        valor: email || '',
        tipo: 'STRING',
        modulo: 'SISTEMA',
        descripcion: 'Email para recibir notificaciones en modo demo',
      },
    })
  }

  res.json({ success: true, data: { activo, email } })
}))

// GET /api/admin/sistema/modo-demo - Obtener estado del modo demo
router.get('/sistema/modo-demo', authAdmin, asyncHandler(async (req, res) => {
  const [modoDemo, emailDemo] = await Promise.all([
    req.prisma.configuracion.findUnique({ where: { clave: 'MODO_DEMO' } }),
    req.prisma.configuracion.findUnique({ where: { clave: 'EMAIL_DEMO' } }),
  ])

  res.json({
    success: true,
    data: {
      activo: modoDemo?.valor === 'true',
      email: emailDemo?.valor || '',
    },
  })
}))

// ============================================
// CONFIGURACIÓN DE RECARGOS POR MORA
// ============================================

// GET /api/admin/configuracion-recargo - Obtener configuración de recargo
router.get('/configuracion-recargo', authAdmin, asyncHandler(async (req, res) => {
  const config = await req.prisma.configuracionRecargo.findFirst({
    where: { activo: true },
  })
  res.json({ success: true, data: config })
}))

// PUT /api/admin/configuracion-recargo - Actualizar configuración de recargo
router.put('/configuracion-recargo', authAdmin, asyncHandler(async (req, res) => {
  const { tipo, porcentaje, cadaDias, topeMaximo } = req.body

  if (!tipo || !['FIJO', 'ACUMULATIVO'].includes(tipo)) {
    throw new AppError('Tipo debe ser FIJO o ACUMULATIVO', 400, 'VALIDATION_ERROR')
  }

  if (porcentaje === undefined || porcentaje < 0) {
    throw new AppError('Porcentaje es requerido y debe ser >= 0', 400, 'VALIDATION_ERROR')
  }

  if (tipo === 'ACUMULATIVO' && (!cadaDias || cadaDias < 1)) {
    throw new AppError('Para tipo ACUMULATIVO, cadaDias es requerido y debe ser >= 1', 400, 'VALIDATION_ERROR')
  }

  // Desactivar configuraciones anteriores
  await req.prisma.configuracionRecargo.updateMany({
    where: { activo: true },
    data: { activo: false },
  })

  // Crear nueva configuración activa
  const config = await req.prisma.configuracionRecargo.create({
    data: {
      tipo,
      porcentaje: parseFloat(porcentaje),
      cadaDias: tipo === 'ACUMULATIVO' ? parseInt(cadaDias) : null,
      topeMaximo: topeMaximo ? parseFloat(topeMaximo) : null,
      activo: true,
    },
  })

  res.json({ success: true, data: config })
}))

// Función para calcular recargo de un cargo
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

// GET /api/admin/cargos/:id/recargo - Calcular recargo de un cargo
router.get('/cargos/:id/recargo', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const cargo = await req.prisma.cargo.findUnique({
    where: { id: parseInt(id) },
  })

  if (!cargo) {
    throw new AppError('Cargo no encontrado', 404, 'NOT_FOUND')
  }

  const resultado = await calcularRecargoCargo(req.prisma, cargo)
  res.json({ success: true, data: resultado })
}))

// ============================================
// CARGOS ADICIONALES
// ============================================

// Categorías de cargo disponibles
const CATEGORIAS_CARGO = ['CUOTA_SOCIAL', 'CUOTA_ACTIVIDAD', 'CARNET', 'MOROSIDAD', 'NOTA_CREDITO', 'FINANCIACION']

// GET /api/admin/categorias-cargo - Listar categorías disponibles
router.get('/categorias-cargo', authAdmin, asyncHandler(async (req, res) => {
  const categorias = CATEGORIAS_CARGO.map(cat => ({
    codigo: cat,
    nombre: cat.replace(/_/g, ' '),
  }))
  res.json({ success: true, data: categorias })
}))

// GET /api/admin/cargos/:id - Detalle de cargo
router.get('/cargos/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const cargo = await req.prisma.cargo.findUnique({
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
    estado
  } = req.body

  const cargo = await req.prisma.cargo.findUnique({
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
  if (categoria && !CATEGORIAS_CARGO.includes(categoria)) {
    throw new AppError(`Categoría inválida. Opciones: ${CATEGORIAS_CARGO.join(', ')}`, 400, 'INVALID_CATEGORIA')
  }

  // Calcular monto total
  const nuevoMontoOriginal = montoOriginal !== undefined ? parseFloat(montoOriginal) : Number(cargo.montoOriginal)
  const nuevoMontoRecargo = montoRecargo !== undefined ? parseFloat(montoRecargo) : Number(cargo.montoRecargo)
  const nuevoMontoBonificacion = montoBonificacion !== undefined ? parseFloat(montoBonificacion) : Number(cargo.montoBonificacion)
  const montoTotal = nuevoMontoOriginal + nuevoMontoRecargo - nuevoMontoBonificacion

  const actualizado = await req.prisma.cargo.update({
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
    descripcion,
    montoOriginal,
    montoRecargo = 0,
    montoBonificacion = 0,
    fechaVencimiento,
    cargoOrigenId
  } = req.body

  if (!socioId || !categoria || !montoOriginal) {
    throw new AppError('socioId, categoria y montoOriginal son requeridos', 400, 'VALIDATION_ERROR')
  }

  // Validar categoría
  if (!CATEGORIAS_CARGO.includes(categoria)) {
    throw new AppError(`Categoría inválida. Opciones: ${CATEGORIAS_CARGO.join(', ')}`, 400, 'INVALID_CATEGORIA')
  }

  // Verificar que exista el socio
  const socio = await req.prisma.socio.findUnique({
    where: { id: parseInt(socioId) },
    select: { id: true, titularFamiliaId: true },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  const montoTotal = parseFloat(montoOriginal) + parseFloat(montoRecargo) - parseFloat(montoBonificacion)

  const cargo = await req.prisma.cargo.create({
    data: {
      socioId: parseInt(socioId),
      grupoFamiliarId: socio.titularFamiliaId || socio.id,
      categoria,
      periodoId: periodoId ? parseInt(periodoId) : null,
      categoriaActividadId: categoriaActividadId ? parseInt(categoriaActividadId) : null,
      descripcion,
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

  const cargo = await req.prisma.cargo.findUnique({
    where: { id: parseInt(id) },
  })

  if (!cargo) {
    throw new AppError('Cargo no encontrado', 404, 'NOT_FOUND')
  }

  if (cargo.estado === 'PAGADO') {
    throw new AppError('No se puede eliminar un cargo pagado. Use nota de crédito.', 400, 'CARGO_PAGADO')
  }

  await req.prisma.cargo.update({
    where: { id: parseInt(id) },
    data: { estado: 'ANULADO' },
  })

  res.json({ success: true, message: 'Cargo anulado correctamente' })
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
  const cuotasRaw = await req.prisma.cargo.findMany({
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
  const socio = await req.prisma.socio.findUnique({
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
  const resultado = await req.prisma.$transaction(async (tx) => {
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
      const meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                     'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
      const nombrePeriodo = `${meses[mes]} ${anio}`

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
  const cuotasRaw = await req.prisma.cargo.findMany({
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
