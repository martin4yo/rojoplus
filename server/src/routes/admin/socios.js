import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import multer from 'multer'
import * as XLSX from 'xlsx'
import { asyncHandler, AppError } from '../../middleware/errorHandler.js'
import { authAdmin } from '../../middleware/auth.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

// Cache temporal para uploads
const uploadCache = new Map()

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

// GET /api/admin/socios - Listar socios con paginación y búsqueda
router.get('/socios', authAdmin, asyncHandler(async (req, res) => {
  const {
    q,
    estado,
    estadosValidos,
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

  // Filtrar por múltiples estados válidos (ej: estadosValidos=ACTIVO,VIGENTE)
  if (estadosValidos) {
    const estados = estadosValidos.split(',').map(e => e.trim())
    where.estado = { in: estados }
  } else if (estado) {
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
    req.db.socio.findMany({
      where,
      orderBy: { apellidoNombre: 'asc' },
      skip: Math.max(0, (parseInt(page) - 1) * parseInt(limit)),
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
    req.db.socio.count({ where }),
    req.db.socio.groupBy({ by: ['estado'], _count: true }),
    req.db.socio.groupBy({ by: ['categoria'], _count: true }),
    req.db.socio.groupBy({ by: ['tipoSocio'], _count: true }),
    req.db.socio.groupBy({ by: ['zona'], _count: true }),
  ])

  const currentPage = parseInt(page)
  const itemsPerPage = parseInt(limit)
  const from = total > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0
  const to = Math.min(currentPage * itemsPerPage, total)

  res.json({
    success: true,
    data: {
      socios,
      pagination: {
        page: currentPage,
        limit: itemsPerPage,
        total,
        totalPages: Math.ceil(total / itemsPerPage),
        from,
        to,
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

// GET /api/admin/socios/grupos-familiares - Listar grupos familiares con sus miembros
router.get('/socios/grupos-familiares', authAdmin, asyncHandler(async (req, res) => {
  const { q, estado, categoria, tipoSocio, zona, page = 1, limit = 20 } = req.query

  const where = { titularFamiliaId: null, miembrosFamilia: { some: {} } }

  if (q) {
    where.OR = [
      { nroSocio: { contains: q, mode: 'insensitive' } },
      { apellidoNombre: { contains: q, mode: 'insensitive' } },
      { documento: { contains: q, mode: 'insensitive' } },
    ]
  }

  if (estado) where.estado = { contains: estado, mode: 'insensitive' }
  if (categoria) where.categoria = { contains: categoria, mode: 'insensitive' }
  if (tipoSocio) where.tipoSocio = { contains: tipoSocio, mode: 'insensitive' }
  if (zona) where.zona = zona

  const [titulares, total] = await Promise.all([
    req.db.socio.findMany({
      where,
      orderBy: { apellidoNombre: 'asc' },
      skip: Math.max(0, (parseInt(page) - 1) * parseInt(limit)),
      take: parseInt(limit),
      select: {
        id: true,
        nroSocio: true,
        apellidoNombre: true,
        documento: true,
        estado: true,
        categoria: true,
        tipoSocio: true,
        fotoUrl: true,
        email: true,
        celular: true,
        miembrosFamilia: {
          select: {
            id: true,
            nroSocio: true,
            apellidoNombre: true,
            parentescoTitular: true,
            estado: true,
            categoria: true,
            tipoSocio: true,
            esMenor: true,
            fechaNacimiento: true,
            fotoUrl: true,
          },
          orderBy: { apellidoNombre: 'asc' }
        }
      }
    }),
    req.db.socio.count({ where })
  ])

  const currentPage = parseInt(page)
  const itemsPerPage = parseInt(limit)

  res.json({
    success: true,
    data: {
      grupos: titulares,
      pagination: {
        page: currentPage,
        limit: itemsPerPage,
        total,
        pages: Math.ceil(total / itemsPerPage),
        from: total > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0,
        to: Math.min(currentPage * itemsPerPage, total),
      }
    }
  })
}))

// GET /api/admin/socios/:id - Detalle completo del socio
router.get('/socios/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const socio = await req.db.socio.findUnique({
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
  const cuotasPendientes = await req.db.cargo.findMany({
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
    req.db.pago.aggregate({
      where: { socioId: socio.id, estado: 'CONFIRMADO' },
      _count: true,
      _sum: { montoTotal: true },
    }),
    req.db.pago.findFirst({
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
  const existente = await req.db.socio.findUnique({
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

  const socio = await req.db.socio.create({
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
  const existente = await req.db.socio.findUnique({
    where: { id: parseInt(id) },
  })

  if (!existente) {
    throw new AppError('Socio no encontrado', 404, 'NOT_FOUND')
  }

  // Si cambia nroSocio, verificar que no exista otro
  if (data.nroSocio && data.nroSocio !== existente.nroSocio) {
    const duplicado = await req.db.socio.findUnique({
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
    'esMenor', 'aptaFisicaVigente', 'enviaDebito', 'debitoVerificado',
    'notifEmail', 'notifWhatsapp'
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

  const socio = await req.db.socio.update({
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

  const socio = await req.db.socio.update({
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

  const socio = await req.db.socio.update({
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

  const socio = await req.db.socio.update({
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

// POST /api/admin/socios/:id/enviar-portal-whatsapp - Enviar link del portal por WhatsApp
router.post('/socios/:id/enviar-portal-whatsapp', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const socio = await req.db.socio.findUnique({
    where: { id: parseInt(id) },
    select: { id: true, apellidoNombre: true, celular: true, tokenPortal: true, estado: true },
  })

  if (!socio) throw new AppError('Socio no encontrado', 404, 'NOT_FOUND')
  if (!socio.celular) throw new AppError('El socio no tiene celular registrado', 400, 'NO_CELULAR')
  if (!socio.tokenPortal) throw new AppError('El socio no tiene token de portal', 400, 'NO_TOKEN')

  const { getTenantFrontendUrl } = await import('../../lib/tenantUrl.js')
  const portalUrl = `${getTenantFrontendUrl(req.tenant)}/portal-socio/${socio.tokenPortal}`

  const { enviarWhatsApp } = await import('../../services/whatsappService.js')
  const resultado = await enviarWhatsApp({
    db: req.db,
    telefono: socio.celular,
    texto: `Hola ${socio.apellidoNombre.split(',')[0].trim()}! Aqui esta tu link de acceso al portal del socio:\n\n${portalUrl}\n\nGuardalo para acceder a tus datos, pagos y beneficios.`,
    ignorarHorario: true,
  })

  if (!resultado.enviado) {
    throw new AppError(resultado.motivo || 'No se pudo enviar por WhatsApp', 503, 'WA_NOT_AVAILABLE')
  }

  res.json({ success: true, data: { mensaje: 'Link enviado por WhatsApp correctamente' } })
}))

// PUT /api/admin/socios/:id/familia - Actualizar titular de familia
router.put('/socios/:id/familia', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { titularFamiliaId, parentescoTitular } = req.body

  const socio = await req.db.socio.findUnique({
    where: { id: parseInt(id) },
    include: { miembrosFamilia: { select: { id: true } } }
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'NOT_FOUND')
  }

  // Si se asigna un titular, verificar que exista
  if (titularFamiliaId) {
    const titular = await req.db.socio.findUnique({
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

  const updated = await req.db.socio.update({
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

  const titular = await req.db.socio.findUnique({
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

  await req.db.socio.updateMany({
    where: { id: { in: miembrosIds } },
    data: {
      titularFamiliaId: null,
      parentescoTitular: null,
      tipoSocio: 'Socio Unico',
    }
  })

  // Cambiar el titular a Socio Unico
  await req.db.socio.update({
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

  const titulares = await req.db.socio.findMany({
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

  const socios = await req.db.socio.findMany({
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
  const miembro = await req.db.socio.findUnique({
    where: { id: parseInt(miembroId) },
  })

  if (!miembro) {
    throw new AppError('Miembro no encontrado', 404, 'NOT_FOUND')
  }

  if (miembro.titularFamiliaId !== parseInt(id)) {
    throw new AppError('Este miembro no pertenece a esta familia', 400, 'INVALID_OPERATION')
  }

  await req.db.socio.update({
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
  const titular = await req.db.socio.findUnique({
    where: { id: parseInt(id) },
    include: { miembrosFamilia: { select: { id: true } } }
  })

  if (!titular) {
    throw new AppError('Titular no encontrado', 404, 'NOT_FOUND')
  }

  // Verificar que el socio a agregar existe
  const socio = await req.db.socio.findUnique({
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

  const updated = await req.db.socio.update({
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

  const socio = await req.db.socio.findUnique({
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

  const socio = await req.db.socio.update({
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

// POST /api/admin/socios/upload - Subir archivo Excel de socios
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
  const avisosPin = [] // acumula warnings por PINs duplicados/conflictivos

  // Pre-pasada: detectar PINs duplicados dentro del mismo archivo
  const pinSeenInFile = new Map() // pin → nroSocio
  for (const row of rows) {
    const nroSocioTmp = String(row['Nro.Socio'] || row['NroSocio'] || row['nro_socio'] || '').trim()
    const pinRaw = row['PIN'] ?? row['Pin'] ?? row['pin'] ?? row['RFID'] ?? row['Tarjeta']
    const pin = String(pinRaw ?? '').trim()
    if (!nroSocioTmp || !pin || pin === '0' || pin === '-' || pin.toLowerCase() === 'null') continue
    if (pinSeenInFile.has(pin)) {
      avisosPin.push(`PIN "${pin}" repetido en el archivo: socios ${pinSeenInFile.get(pin)} y ${nroSocioTmp}. Se importa sin PIN para el segundo.`)
    } else {
      pinSeenInFile.set(pin, nroSocioTmp)
    }
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const nroSocio = String(row['Nro.Socio'] || row['NroSocio'] || row['nro_socio'] || '').trim()

    if (!nroSocio) {
      continue
    }

    // Separar apellido y nombre
    const apellidoNombreCompleto = row['ApellidoNombre'] || row['Nombre'] || ''
    const { apellido, nombre } = separarApellidoNombre(apellidoNombreCompleto)

    // PIN / RFID del carnet — lo lee el molinete para validar acceso
    let rfidUid = null
    const pinRaw = row['PIN'] ?? row['Pin'] ?? row['pin'] ?? row['RFID'] ?? row['Tarjeta']
    const pinStr = String(pinRaw ?? '').trim()
    if (pinStr && pinStr !== '0' && pinStr !== '-' && pinStr.toLowerCase() !== 'null') {
      // Si en el archivo el PIN está duplicado, solo lo asigna al primer socio
      if (pinSeenInFile.get(pinStr) === nroSocio) {
        // Verificar contra DB: ningún OTRO socio (distinto nroSocio) puede tenerlo
        const conflictivo = await req.db.socio.findFirst({
          where: { rfidUid: pinStr, NOT: { nroSocio } },
          select: { nroSocio: true }
        })
        if (conflictivo) {
          avisosPin.push(`PIN "${pinStr}" del socio ${nroSocio} ya está asignado al socio ${conflictivo.nroSocio}. Se importa sin PIN.`)
        } else {
          rfidUid = pinStr
        }
      }
    }

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
      estado: cleanString(row['Estado']) || 'VIGENTE',
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
      // Carnet RFID (molinete). null si viene vacío — no pisa el existente en updates.
      rfidUid,
      // Grupo familiar (guardar referencia para procesar después)
      _grupoFamiliar: cleanString(row['Grupo Fliar']),
      _esTitular: cleanString(row['Titular'])?.toUpperCase() === 'SI',
      _cobrador: cleanString(row['Cobrador']),
    }

    // Verificar si existe
    const existente = await req.db.socio.findUnique({
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
      avisosPin,
    },
  })
}))

// POST /api/admin/socios/upload/:uploadId/confirmar - Confirmar importación de socios
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

  const tenantId = req.tenantId

  // Crear tipos de socio que no existan
  for (const tipo of tiposUnicos) {
    const codigo = tipo.toUpperCase().replace(/\s+/g, '_').substring(0, 50)
    const existente = await req.db.tipoSocio.findFirst({
      where: { tenantId, OR: [{ codigo }, { nombre: tipo }] }
    })
    if (!existente) {
      await req.db.tipoSocio.create({
        data: { tenantId, codigo, nombre: tipo, color: 'blue' }
      })
    }
  }

  // Obtener mapeo de tipos de socio (nombre -> id)
  const tiposSocio = await req.db.tipoSocio.findMany({ where: { tenantId } })
  const mapeoTipoSocio = {}
  for (const tipo of tiposSocio) {
    mapeoTipoSocio[tipo.nombre] = tipo.id
    mapeoTipoSocio[tipo.codigo] = tipo.id
  }

  // Crear categorías de socio que no existan
  for (const cat of categoriasUnicas) {
    const codigo = cat.toUpperCase().replace(/\s+/g, '_').substring(0, 50)
    const existente = await req.db.categoriaSocio.findFirst({
      where: { tenantId, OR: [{ codigo }, { nombre: cat }] }
    })
    if (!existente) {
      await req.db.categoriaSocio.create({
        data: { tenantId, codigo, nombre: cat, color: 'blue' }
      })
    }
  }

  // Obtener mapeo de categorías de socio (nombre -> id)
  const categoriasSocio = await req.db.categoriaSocio.findMany({ where: { tenantId } })
  const mapeoCategoriaSocio = {}
  for (const cat of categoriasSocio) {
    mapeoCategoriaSocio[cat.nombre] = cat.id
    mapeoCategoriaSocio[cat.codigo] = cat.id
  }

  // Crear estados de socio que no existan
  for (const estado of estadosUnicos) {
    const codigo = estado.toUpperCase().replace(/\s+/g, '_').substring(0, 50)
    const existente = await req.db.estadoSocio.findFirst({
      where: { tenantId, OR: [{ codigo }, { nombre: estado }] }
    })
    if (!existente) {
      // Determinar si permite descuentos basado en el nombre
      const permiteDescuentos = estado.toLowerCase().includes('activ') ||
        estado.toLowerCase().includes('vigent')
      await req.db.estadoSocio.create({
        data: {
          tenantId,
          codigo,
          nombre: estado,
          color: permiteDescuentos ? 'green' : 'red',
          permiteDescuentos
        }
      })
    }
  }

  // Obtener mapeo de estados de socio (nombre -> id)
  const estadosSocio = await req.db.estadoSocio.findMany({ where: { tenantId } })
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
    await req.db.socio.createMany({
      data: datosParaCrear,
      skipDuplicates: true,
    })
  }

  // Actualizar existentes con TODOS los campos
  for (const socio of cached.actualizar) {
    const datosLimpios = limpiarCamposTemporales(socio)
    await req.db.socio.update({
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
        // PIN / RFID del carnet — solo pisa si el Excel trae valor
        ...(datosLimpios.rfidUid && { rfidUid: datosLimpios.rfidUid }),
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

// GET /api/admin/socios/:socioId/cuenta-corriente - Cuenta corriente del socio
router.get('/socios/:socioId/cuenta-corriente', authAdmin, asyncHandler(async (req, res) => {
  const { socioId } = req.params
  const { desde, hasta, incluirFamilia } = req.query

  const socio = await req.db.socio.findUnique({
    where: { id: parseInt(socioId) },
    select: {
      id: true,
      nroSocio: true,
      apellidoNombre: true,
      titularFamiliaId: true,
      miembrosFamilia: { select: { id: true, nroSocio: true, apellidoNombre: true } }
    }
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404)
  }

  // Determinar si incluir familia
  const esTitular = !socio.titularFamiliaId
  const tieneFamilia = esTitular && socio.miembrosFamilia?.length > 0
  const mostrarFamilia = incluirFamilia === 'true' && tieneFamilia

  // Construir filtro de socio(s)
  let socioIds = [socio.id]
  if (mostrarFamilia) {
    socioIds = [socio.id, ...socio.miembrosFamilia.map(m => m.id)]
  }

  // Filtro de fechas
  const whereFecha = {}
  if (desde) whereFecha.gte = new Date(desde)
  if (hasta) whereFecha.lte = new Date(hasta)

  // Obtener todos los cargos
  const cargos = await req.db.cargo.findMany({
    where: {
      socioId: { in: socioIds },
      estado: { not: 'ANULADO' },
      ...(desde || hasta ? { createdAt: whereFecha } : {})
    },
    include: {
      socio: { select: { id: true, nroSocio: true, apellidoNombre: true } },
      periodo: { select: { nombre: true } },
      categoriaActividad: {
        select: {
          nombre: true,
          actividad: { select: { nombre: true } }
        }
      },
      pago: { select: { id: true, numero: true, fecha: true } }
    },
    orderBy: { createdAt: 'desc' }
  })

  // Obtener todos los pagos
  const pagos = await req.db.pago.findMany({
    where: {
      socioId: { in: socioIds },
      estado: 'CONFIRMADO',
      ...(desde || hasta ? { fecha: whereFecha } : {})
    },
    include: {
      socio: { select: { id: true, nroSocio: true, apellidoNombre: true } },
      medioPago: { select: { nombre: true } },
      cargos: {
        select: {
          id: true,
          categoria: true,
          descripcion: true,
          montoTotal: true,
          periodo: { select: { nombre: true } }
        }
      }
    },
    orderBy: { fecha: 'desc' }
  })

  // Crear movimientos unificados para la cuenta corriente
  const movimientos = []

  // Agregar cargos como débitos
  for (const cargo of cargos) {
    let concepto = ''
    if (cargo.categoria === 'CUOTA_SOCIAL') {
      concepto = `Cuota Social - ${cargo.periodo?.nombre || ''}`
    } else if (cargo.categoria === 'CUOTA_ACTIVIDAD') {
      concepto = `${cargo.categoriaActividad?.actividad?.nombre || 'Actividad'} - ${cargo.categoriaActividad?.nombre || ''} - ${cargo.periodo?.nombre || ''}`
    } else if (cargo.categoria === 'FINANCIACION') {
      concepto = cargo.descripcion || 'Financiación'
    } else {
      concepto = cargo.descripcion || cargo.categoria
    }

    movimientos.push({
      id: `cargo-${cargo.id}`,
      tipo: 'CARGO',
      fecha: cargo.createdAt,
      concepto,
      debe: Number(cargo.montoTotal),
      haber: 0,
      estado: cargo.estado,
      socio: mostrarFamilia ? cargo.socio : null,
      referencia: cargo.pago ? `Recibo #${cargo.pago.numero}` : null,
      cargoId: cargo.id,
      pagoId: cargo.pagoId
    })
  }

  // Agregar pagos como créditos
  for (const pago of pagos) {
    const conceptos = pago.cargos.map(c => c.periodo?.nombre || c.descripcion).filter(Boolean)
    const concepto = `Pago Recibo #${pago.numero}${conceptos.length > 0 ? ' - ' + conceptos.join(', ') : ''}`

    movimientos.push({
      id: `pago-${pago.id}`,
      tipo: 'PAGO',
      fecha: pago.fecha,
      concepto,
      debe: 0,
      haber: Number(pago.montoTotal),
      estado: 'CONFIRMADO',
      socio: mostrarFamilia ? pago.socio : null,
      referencia: `${pago.medioPago?.nombre || ''}`,
      pagoId: pago.id
    })
  }

  // Ordenar por fecha descendente
  movimientos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))

  // Calcular saldo acumulado (desde el más antiguo al más reciente)
  const movimientosOrdenados = [...movimientos].reverse()
  let saldoAcumulado = 0
  for (const mov of movimientosOrdenados) {
    saldoAcumulado += mov.debe - mov.haber
    mov.saldo = saldoAcumulado
  }

  // Calcular totales
  const totalDebe = movimientos.reduce((sum, m) => sum + m.debe, 0)
  const totalHaber = movimientos.reduce((sum, m) => sum + m.haber, 0)
  const saldoActual = totalDebe - totalHaber

  res.json({
    success: true,
    data: {
      socio: {
        id: socio.id,
        nroSocio: socio.nroSocio,
        apellidoNombre: socio.apellidoNombre
      },
      esTitular,
      tieneFamilia,
      mostrandoFamilia: mostrarFamilia,
      movimientos,
      resumen: {
        totalDebe,
        totalHaber,
        saldoActual,
        cantidadCargos: cargos.length,
        cantidadPagos: pagos.length
      }
    }
  })
}))

// =============================================================================
// SEGUIMIENTO MÉDICO
// =============================================================================

// GET /api/admin/socios/:id/medico — ficha médica + aptitudes + lesiones
router.get('/socios/:id/medico', authAdmin, asyncHandler(async (req, res) => {
  const socioId = parseInt(req.params.id)

  const [ficha, aptitudes, lesiones] = await Promise.all([
    req.db.fichaMedica.findUnique({ where: { socioId } }),
    req.db.aptitudFisica.findMany({ where: { socioId }, orderBy: { createdAt: 'desc' } }),
    req.db.lesionSocio.findMany({ where: { socioId }, orderBy: { fechaLesion: 'desc' } }),
  ])

  res.json({ success: true, data: { ficha, aptitudes, lesiones } })
}))

// PUT /api/admin/socios/:id/ficha-medica — upsert
router.put('/socios/:id/ficha-medica', authAdmin, asyncHandler(async (req, res) => {
  const socioId = parseInt(req.params.id)
  const { grupoSanguineo, alergias, medicamentos, condicionesCronicas, contactoEmergencia, telefonoEmergencia, observaciones } = req.body

  const ficha = await req.db.fichaMedica.upsert({
    where: { socioId },
    update: { grupoSanguineo, alergias, medicamentos, condicionesCronicas, contactoEmergencia, telefonoEmergencia, observaciones },
    create: { socioId, grupoSanguineo, alergias, medicamentos, condicionesCronicas, contactoEmergencia, telefonoEmergencia, observaciones, tenantId: req.tenantId },
  })

  res.json({ success: true, data: ficha })
}))

// POST /api/admin/socios/:id/aptitudes — nueva aptitud
router.post('/socios/:id/aptitudes', authAdmin, asyncHandler(async (req, res) => {
  const socioId = parseInt(req.params.id)
  const { estado, fechaEstudio, vencimiento, medico, observaciones } = req.body

  const aptitud = await req.db.aptitudFisica.create({
    data: {
      socioId,
      estado: estado || 'PENDIENTE',
      fechaEstudio: fechaEstudio ? new Date(fechaEstudio) : null,
      vencimiento: vencimiento ? new Date(vencimiento) : null,
      medico,
      observaciones,
      tenantId: req.tenantId,
    }
  })

  res.json({ success: true, data: aptitud })
}))

// DELETE /api/admin/socios/:id/aptitudes/:aptId
router.delete('/socios/:id/aptitudes/:aptId', authAdmin, asyncHandler(async (req, res) => {
  await req.db.aptitudFisica.deleteMany({
    where: { id: parseInt(req.params.aptId), socioId: parseInt(req.params.id) }
  })
  res.json({ success: true })
}))

// POST /api/admin/socios/:id/lesiones — registrar lesión
router.post('/socios/:id/lesiones', authAdmin, asyncHandler(async (req, res) => {
  const socioId = parseInt(req.params.id)
  const { tipo, descripcion, fechaLesion, gravedad, tratamiento, restricciones } = req.body

  if (!tipo || !descripcion || !fechaLesion) throw new AppError('tipo, descripcion y fechaLesion son obligatorios', 400)

  const lesion = await req.db.lesionSocio.create({
    data: {
      socioId,
      tipo,
      descripcion,
      fechaLesion: new Date(fechaLesion),
      gravedad: gravedad || 'LEVE',
      tratamiento,
      restricciones,
      tenantId: req.tenantId,
    }
  })

  res.json({ success: true, data: lesion })
}))

// PUT /api/admin/socios/:id/lesiones/:lesionId — actualizar / dar de alta
router.put('/socios/:id/lesiones/:lesionId', authAdmin, asyncHandler(async (req, res) => {
  const { fechaAlta, alta, tratamiento, restricciones, gravedad, descripcion } = req.body

  await req.db.lesionSocio.updateMany({
    where: { id: parseInt(req.params.lesionId), socioId: parseInt(req.params.id) },
    data: {
      fechaAlta: fechaAlta ? new Date(fechaAlta) : undefined,
      alta: alta !== undefined ? !!alta : undefined,
      tratamiento, restricciones, gravedad, descripcion,
    }
  })

  res.json({ success: true })
}))

// DELETE /api/admin/socios/:id/lesiones/:lesionId
router.delete('/socios/:id/lesiones/:lesionId', authAdmin, asyncHandler(async (req, res) => {
  await req.db.lesionSocio.deleteMany({
    where: { id: parseInt(req.params.lesionId), socioId: parseInt(req.params.id) }
  })
  res.json({ success: true })
}))

// GET /api/admin/socios/exportar — Exportar padrón de socios a Excel
router.get('/socios/exportar', authAdmin, asyncHandler(async (req, res) => {
  const { estado, tipo, categoria, buscar } = req.query

  const where = {}
  if (estado) where.estado = estado
  if (buscar) {
    where.OR = [
      { nombre: { contains: buscar, mode: 'insensitive' } },
      { apellido: { contains: buscar, mode: 'insensitive' } },
      { nroSocio: { contains: buscar, mode: 'insensitive' } },
      { dni: { contains: buscar, mode: 'insensitive' } },
    ]
  }

  const socios = await req.db.socio.findMany({
    where,
    orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
    select: {
      nroSocio: true, apellido: true, nombre: true, dni: true,
      estado: true, email: true, celular: true, telefono: true,
      fechaNacimiento: true, fechaAlta: true, fechaBaja: true,
      direccion: true, localidad: true,
      tipoSocioRel: { select: { nombre: true } },
      categoriaSocio: { select: { nombre: true } },
    },
  })

  const rows = socios.map(s => ({
    'Nro. Socio': s.nroSocio || '',
    'Apellido': s.apellido || '',
    'Nombre': s.nombre || '',
    'DNI': s.dni || '',
    'Estado': s.estado || '',
    'Tipo': s.tipoSocioRel?.nombre || '',
    'Categoría': s.categoriaSocio?.nombre || '',
    'Email': s.email || '',
    'Celular': s.celular || '',
    'Teléfono': s.telefono || '',
    'Dirección': s.direccion || '',
    'Localidad': s.localidad || '',
    'Fecha Nacimiento': s.fechaNacimiento ? new Date(s.fechaNacimiento).toLocaleDateString('es-AR') : '',
    'Fecha Alta': s.fechaAlta ? new Date(s.fechaAlta).toLocaleDateString('es-AR') : '',
    'Fecha Baja': s.fechaBaja ? new Date(s.fechaBaja).toLocaleDateString('es-AR') : '',
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)

  // Ancho de columnas
  ws['!cols'] = [
    { wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 12 },
    { wch: 15 }, { wch: 15 }, { wch: 28 }, { wch: 14 }, { wch: 14 },
    { wch: 25 }, { wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 12 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Socios')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const fecha = new Date().toISOString().split('T')[0]
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="socios_${fecha}.xlsx"`)
  res.send(buffer)
}))

export default router
