import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { authAdmin } from '../middleware/auth.js'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'

const router = Router()

router.use(authAdmin)

// =============================================================================
// FORMATOS DE EXTRACTO (Parametrizables)
// =============================================================================

// GET /api/admin/conciliacion/formatos - Listar formatos
router.get('/formatos', asyncHandler(async (req, res) => {
  const formatos = await prisma.formatoExtracto.findMany({
    orderBy: { nombre: 'asc' }
  })
  res.json({ success: true, data: formatos })
}))

// GET /api/admin/conciliacion/formatos/:id - Detalle formato
router.get('/formatos/:id', asyncHandler(async (req, res) => {
  const formato = await prisma.formatoExtracto.findUnique({
    where: { id: parseInt(req.params.id) }
  })
  if (!formato) throw new AppError('Formato no encontrado', 404)
  res.json({ success: true, data: formato })
}))

// POST /api/admin/conciliacion/formatos - Crear formato
router.post('/formatos', asyncHandler(async (req, res) => {
  const { nombre, banco, tipoArchivo, descripcion, configuracion } = req.body

  if (!nombre || !tipoArchivo) {
    throw new AppError('Nombre y tipo de archivo son requeridos', 400)
  }

  if (!['CSV', 'OFX', 'TXT', 'XLSX'].includes(tipoArchivo)) {
    throw new AppError('Tipo de archivo inválido', 400)
  }

  const formato = await prisma.formatoExtracto.create({
    data: {
      nombre,
      banco,
      tipoArchivo,
      descripcion,
      configuracion: configuracion || {}
    }
  })

  res.status(201).json({ success: true, data: formato })
}))

// PUT /api/admin/conciliacion/formatos/:id - Actualizar formato
router.put('/formatos/:id', asyncHandler(async (req, res) => {
  const { nombre, banco, tipoArchivo, descripcion, configuracion, activo } = req.body

  const formato = await prisma.formatoExtracto.update({
    where: { id: parseInt(req.params.id) },
    data: {
      nombre,
      banco,
      tipoArchivo,
      descripcion,
      configuracion,
      activo
    }
  })

  res.json({ success: true, data: formato })
}))

// DELETE /api/admin/conciliacion/formatos/:id - Eliminar formato
router.delete('/formatos/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id)

  // Verificar si tiene extractos asociados
  const extractos = await prisma.extractoBancario.count({
    where: { formatoId: id }
  })

  if (extractos > 0) {
    throw new AppError('No se puede eliminar, tiene extractos asociados', 400)
  }

  await prisma.formatoExtracto.delete({ where: { id } })
  res.json({ success: true, message: 'Formato eliminado' })
}))

// =============================================================================
// EXTRACTOS BANCARIOS
// =============================================================================

// GET /api/admin/conciliacion/extractos - Listar extractos
router.get('/extractos', asyncHandler(async (req, res) => {
  const { cajaId, estado, page = 1, limit = 20 } = req.query

  const where = {}
  if (cajaId) where.cajaId = parseInt(cajaId)
  if (estado) where.estado = estado

  const skip = (parseInt(page) - 1) * parseInt(limit)

  const [extractos, total] = await Promise.all([
    prisma.extractoBancario.findMany({
      where,
      orderBy: { fechaImportacion: 'desc' },
      skip,
      take: parseInt(limit),
      include: {
        caja: { select: { id: true, codigo: true, nombre: true } },
        formato: { select: { id: true, nombre: true, banco: true } },
        _count: { select: { movimientos: true, conciliaciones: true } }
      }
    }),
    prisma.extractoBancario.count({ where })
  ])

  const extractosFormateados = extractos.map(e => ({
    ...e,
    saldoInicial: Number(e.saldoInicial),
    saldoFinal: Number(e.saldoFinal),
    totalDebitos: e.totalDebitos ? Number(e.totalDebitos) : null,
    totalCreditos: e.totalCreditos ? Number(e.totalCreditos) : null
  }))

  res.json({
    success: true,
    data: extractosFormateados,
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
  })
}))

// GET /api/admin/conciliacion/extractos/:id - Detalle extracto
router.get('/extractos/:id', asyncHandler(async (req, res) => {
  const extracto = await prisma.extractoBancario.findUnique({
    where: { id: parseInt(req.params.id) },
    include: {
      caja: true,
      formato: true,
      movimientos: {
        orderBy: { fecha: 'asc' }
      },
      conciliaciones: {
        orderBy: { fecha: 'desc' }
      }
    }
  })

  if (!extracto) throw new AppError('Extracto no encontrado', 404)

  res.json({
    success: true,
    data: {
      ...extracto,
      saldoInicial: Number(extracto.saldoInicial),
      saldoFinal: Number(extracto.saldoFinal),
      totalDebitos: extracto.totalDebitos ? Number(extracto.totalDebitos) : null,
      totalCreditos: extracto.totalCreditos ? Number(extracto.totalCreditos) : null,
      movimientos: extracto.movimientos.map(m => ({
        ...m,
        importe: Number(m.importe),
        saldo: m.saldo ? Number(m.saldo) : null
      }))
    }
  })
}))

// POST /api/admin/conciliacion/extractos/importar - Importar extracto
router.post('/extractos/importar', asyncHandler(async (req, res) => {
  const { cajaId, formatoId, contenido, nombreArchivo, periodoDesde, periodoHasta, observaciones } = req.body

  if (!cajaId || !formatoId || !contenido) {
    throw new AppError('Caja, formato y contenido son requeridos', 400)
  }

  const formato = await prisma.formatoExtracto.findUnique({
    where: { id: parseInt(formatoId) }
  })
  if (!formato) throw new AppError('Formato no encontrado', 404)

  const caja = await prisma.caja.findUnique({
    where: { id: parseInt(cajaId) }
  })
  if (!caja) throw new AppError('Caja no encontrada', 404)

  // Parsear contenido según formato
  let movimientos = []
  let saldoInicial = 0
  let saldoFinal = 0

  try {
    const resultado = parsearExtracto(contenido, formato)
    movimientos = resultado.movimientos
    saldoInicial = resultado.saldoInicial
    saldoFinal = resultado.saldoFinal
  } catch (err) {
    throw new AppError(`Error parseando archivo: ${err.message}`, 400)
  }

  if (movimientos.length === 0) {
    throw new AppError('No se encontraron movimientos en el archivo', 400)
  }

  // Generar número de extracto
  const anio = new Date().getFullYear()
  const prefijo = `EXT-${anio}-`
  const ultimo = await prisma.extractoBancario.findFirst({
    where: { numero: { startsWith: prefijo } },
    orderBy: { numero: 'desc' }
  })
  let siguiente = 1
  if (ultimo) {
    const partes = ultimo.numero.split('-')
    siguiente = (parseInt(partes[partes.length - 1]) || 0) + 1
  }
  const numero = `${prefijo}${String(siguiente).padStart(5, '0')}`

  // Calcular totales
  const totalCreditos = movimientos.filter(m => m.tipo === 'CREDITO').reduce((sum, m) => sum + m.importe, 0)
  const totalDebitos = movimientos.filter(m => m.tipo === 'DEBITO').reduce((sum, m) => sum + m.importe, 0)

  // Crear extracto con movimientos
  const extracto = await prisma.extractoBancario.create({
    data: {
      cajaId: parseInt(cajaId),
      formatoId: parseInt(formatoId),
      numero,
      periodoDesde: periodoDesde ? new Date(periodoDesde) : movimientos[0]?.fecha || new Date(),
      periodoHasta: periodoHasta ? new Date(periodoHasta) : movimientos[movimientos.length - 1]?.fecha || new Date(),
      nombreArchivo,
      saldoInicial,
      saldoFinal,
      totalCreditos,
      totalDebitos,
      cantidadMovimientos: movimientos.length,
      importadoPor: req.admin.id,
      observaciones,
      movimientos: {
        create: movimientos.map(m => ({
          fecha: m.fecha,
          fechaValor: m.fechaValor,
          concepto: m.concepto,
          descripcion: m.descripcion,
          referencia: m.referencia,
          numeroComprobante: m.numeroComprobante,
          tipo: m.tipo,
          importe: m.importe,
          saldo: m.saldo
        }))
      }
    },
    include: {
      caja: { select: { id: true, codigo: true, nombre: true } },
      formato: { select: { id: true, nombre: true } },
      movimientos: true
    }
  })

  res.status(201).json({
    success: true,
    data: extracto,
    message: `Extracto importado: ${movimientos.length} movimientos`
  })
}))

// DELETE /api/admin/conciliacion/extractos/:id - Eliminar extracto
router.delete('/extractos/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id)

  const extracto = await prisma.extractoBancario.findUnique({
    where: { id },
    include: { conciliaciones: true }
  })

  if (!extracto) throw new AppError('Extracto no encontrado', 404)

  if (extracto.conciliaciones.length > 0) {
    throw new AppError('No se puede eliminar, tiene conciliaciones asociadas', 400)
  }

  // Eliminar movimientos y extracto
  await prisma.$transaction([
    prisma.movimientoExtracto.deleteMany({ where: { extractoId: id } }),
    prisma.extractoBancario.delete({ where: { id } })
  ])

  res.json({ success: true, message: 'Extracto eliminado' })
}))

// =============================================================================
// CONCILIACIÓN
// =============================================================================

// GET /api/admin/conciliacion/pendientes - Obtener movimientos pendientes para conciliar
router.get('/pendientes', asyncHandler(async (req, res) => {
  const { cajaId, extractoId, desde, hasta } = req.query

  if (!cajaId && !extractoId) {
    throw new AppError('Debe especificar caja o extracto', 400)
  }

  // Movimientos de extracto pendientes
  const whereExtracto = { conciliado: false }
  if (extractoId) {
    whereExtracto.extractoId = parseInt(extractoId)
  } else if (cajaId) {
    whereExtracto.extracto = { cajaId: parseInt(cajaId) }
  }

  const movimientosExtracto = await prisma.movimientoExtracto.findMany({
    where: whereExtracto,
    orderBy: { fecha: 'asc' },
    include: {
      extracto: { select: { id: true, numero: true, caja: { select: { nombre: true } } } }
    }
  })

  // Movimientos de caja pendientes (no conciliados, de cajas que requieren conciliación)
  const whereCaja = {
    conciliado: false,
    anulado: false,
    caja: { requiereConciliacion: true }
  }
  if (cajaId) {
    whereCaja.cajaId = parseInt(cajaId)
  }
  if (desde || hasta) {
    whereCaja.fecha = {}
    if (desde) whereCaja.fecha.gte = new Date(desde)
    if (hasta) whereCaja.fecha.lte = new Date(hasta)
  }

  const movimientosCaja = await prisma.movimientoCaja.findMany({
    where: whereCaja,
    orderBy: { fecha: 'asc' },
    include: {
      caja: { select: { id: true, codigo: true, nombre: true } },
      pago: {
        select: {
          id: true,
          socio: { select: { nroSocio: true, apellidoNombre: true } },
          medioPago: { select: { nombre: true } }
        }
      }
    }
  })

  // Buscar sugerencias de matching automático
  const sugerencias = buscarSugerenciasMatching(movimientosExtracto, movimientosCaja)

  res.json({
    success: true,
    data: {
      movimientosExtracto: movimientosExtracto.map(m => ({
        ...m,
        importe: Number(m.importe),
        saldo: m.saldo ? Number(m.saldo) : null
      })),
      movimientosCaja: movimientosCaja.map(m => ({
        ...m,
        monto: Number(m.monto)
      })),
      sugerencias
    }
  })
}))

// POST /api/admin/conciliacion/conciliar - Ejecutar conciliación
router.post('/conciliar', asyncHandler(async (req, res) => {
  const { extractoId, matches, observaciones } = req.body

  if (!extractoId || !matches || !Array.isArray(matches) || matches.length === 0) {
    throw new AppError('Debe especificar extracto y al menos un match', 400)
  }

  const extracto = await prisma.extractoBancario.findUnique({
    where: { id: parseInt(extractoId) }
  })
  if (!extracto) throw new AppError('Extracto no encontrado', 404)

  // Validar matches
  for (const match of matches) {
    if (!match.movimientoExtractoId || !match.movimientoCajaId) {
      throw new AppError('Cada match debe tener movimientoExtractoId y movimientoCajaId', 400)
    }
  }

  const movimientoExtractoIds = matches.map(m => m.movimientoExtractoId)
  const movimientoCajaIds = matches.map(m => m.movimientoCajaId)

  // Verificar que existen y no están conciliados
  const movsExtracto = await prisma.movimientoExtracto.findMany({
    where: { id: { in: movimientoExtractoIds }, conciliado: false }
  })
  if (movsExtracto.length !== movimientoExtractoIds.length) {
    throw new AppError('Algunos movimientos de extracto no existen o ya fueron conciliados', 400)
  }

  const movsCaja = await prisma.movimientoCaja.findMany({
    where: { id: { in: movimientoCajaIds }, conciliado: false, anulado: false }
  })
  if (movsCaja.length !== movimientoCajaIds.length) {
    throw new AppError('Algunos movimientos de caja no existen o ya fueron conciliados', 400)
  }

  // Calcular monto total
  const montoConciliado = movsExtracto.reduce((sum, m) => sum + Number(m.importe), 0)

  // Crear conciliación y actualizar movimientos
  const conciliacion = await prisma.$transaction(async (tx) => {
    const conc = await tx.conciliacion.create({
      data: {
        extractoId: parseInt(extractoId),
        tipo: 'MANUAL',
        movimientosConciliados: matches.length,
        montoConciliado,
        realizadoPor: req.admin.id,
        observaciones
      }
    })

    // Actualizar movimientos de extracto
    for (const match of matches) {
      await tx.movimientoExtracto.update({
        where: { id: match.movimientoExtractoId },
        data: {
          conciliado: true,
          conciliacionId: conc.id,
          movimientoCajaId: match.movimientoCajaId,
          fechaConciliacion: new Date()
        }
      })

      await tx.movimientoCaja.update({
        where: { id: match.movimientoCajaId },
        data: {
          conciliado: true,
          conciliacionId: conc.id,
          fechaConciliacion: new Date(),
          observacionConciliacion: `Conciliado con extracto ${extracto.numero}`
        }
      })
    }

    // Verificar si el extracto está completamente conciliado
    const pendientes = await tx.movimientoExtracto.count({
      where: { extractoId: parseInt(extractoId), conciliado: false }
    })

    if (pendientes === 0) {
      await tx.extractoBancario.update({
        where: { id: parseInt(extractoId) },
        data: { estado: 'CONCILIADO' }
      })
    } else {
      await tx.extractoBancario.update({
        where: { id: parseInt(extractoId) },
        data: { estado: 'EN_CONCILIACION' }
      })
    }

    return conc
  })

  res.json({
    success: true,
    data: conciliacion,
    message: `${matches.length} movimientos conciliados`
  })
}))

// GET /api/admin/conciliacion/historial - Historial de conciliaciones
router.get('/historial', asyncHandler(async (req, res) => {
  const { extractoId, page = 1, limit = 20 } = req.query

  const where = {}
  if (extractoId) where.extractoId = parseInt(extractoId)

  const skip = (parseInt(page) - 1) * parseInt(limit)

  const [conciliaciones, total] = await Promise.all([
    prisma.conciliacion.findMany({
      where,
      orderBy: { fecha: 'desc' },
      skip,
      take: parseInt(limit),
      include: {
        extracto: { select: { numero: true, caja: { select: { nombre: true } } } },
        movimientosExtracto: {
          select: { id: true, fecha: true, concepto: true, importe: true }
        },
        movimientosCaja: {
          select: { id: true, numero: true, concepto: true, monto: true }
        }
      }
    }),
    prisma.conciliacion.count({ where })
  ])

  res.json({
    success: true,
    data: conciliaciones.map(c => ({
      ...c,
      montoConciliado: Number(c.montoConciliado),
      movimientosExtracto: c.movimientosExtracto.map(m => ({
        ...m,
        importe: Number(m.importe)
      })),
      movimientosCaja: c.movimientosCaja.map(m => ({
        ...m,
        monto: Number(m.monto)
      }))
    })),
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
  })
}))

// GET /api/admin/conciliacion/trazabilidad/:movimientoCajaId - Ver trazabilidad
router.get('/trazabilidad/:movimientoCajaId', asyncHandler(async (req, res) => {
  const movimientoCajaId = parseInt(req.params.movimientoCajaId)

  const movimientoCaja = await prisma.movimientoCaja.findUnique({
    where: { id: movimientoCajaId },
    include: {
      caja: true,
      conciliacion: {
        include: {
          extracto: { select: { numero: true, nombreArchivo: true, periodoDesde: true, periodoHasta: true } }
        }
      }
    }
  })

  if (!movimientoCaja) throw new AppError('Movimiento no encontrado', 404)

  // Buscar movimiento de extracto vinculado
  const movimientoExtracto = await prisma.movimientoExtracto.findFirst({
    where: { movimientoCajaId },
    include: {
      extracto: { select: { numero: true, nombreArchivo: true, caja: { select: { nombre: true } } } }
    }
  })

  res.json({
    success: true,
    data: {
      movimientoCaja: {
        ...movimientoCaja,
        monto: Number(movimientoCaja.monto)
      },
      movimientoExtracto: movimientoExtracto ? {
        ...movimientoExtracto,
        importe: Number(movimientoExtracto.importe)
      } : null
    }
  })
}))

// GET /api/admin/conciliacion/resumen - Resumen de estado de conciliación
router.get('/resumen', asyncHandler(async (req, res) => {
  const { cajaId } = req.query

  const whereCaja = cajaId ? { cajaId: parseInt(cajaId) } : {}

  // Extractos por estado
  const extractosPorEstado = await prisma.extractoBancario.groupBy({
    by: ['estado'],
    where: whereCaja,
    _count: true
  })

  // Movimientos de caja pendientes
  const whereCajaPendiente = {
    conciliado: false,
    anulado: false,
    caja: { requiereConciliacion: true }
  }
  if (cajaId) whereCajaPendiente.cajaId = parseInt(cajaId)

  const cajasPendientes = await prisma.movimientoCaja.aggregate({
    where: whereCajaPendiente,
    _sum: { monto: true },
    _count: true
  })

  // Movimientos de extracto pendientes
  const whereExtractoPendiente = { conciliado: false }
  if (cajaId) whereExtractoPendiente.extracto = { cajaId: parseInt(cajaId) }

  const extractosPendientes = await prisma.movimientoExtracto.aggregate({
    where: whereExtractoPendiente,
    _sum: { importe: true },
    _count: true
  })

  res.json({
    success: true,
    data: {
      extractosPorEstado: extractosPorEstado.reduce((acc, e) => {
        acc[e.estado] = e._count
        return acc
      }, {}),
      movimientosCajaPendientes: {
        cantidad: cajasPendientes._count,
        monto: Number(cajasPendientes._sum.monto || 0)
      },
      movimientosExtractoPendientes: {
        cantidad: extractosPendientes._count,
        monto: Number(extractosPendientes._sum.importe || 0)
      }
    }
  })
}))

// =============================================================================
// FUNCIONES AUXILIARES
// =============================================================================

/**
 * Parsea contenido de extracto según formato configurado
 */
function parsearExtracto(contenido, formato) {
  const config = formato.configuracion || {}

  switch (formato.tipoArchivo) {
    case 'OFX':
      return parsearOFX(contenido)
    case 'CSV':
      return parsearCSV(contenido, config)
    case 'TXT':
      return parsearTXT(contenido, config)
    case 'XLSX':
      throw new AppError('Formato XLSX requiere procesamiento especial', 400)
    default:
      throw new AppError('Tipo de archivo no soportado', 400)
  }
}

/**
 * Parser OFX (Open Financial Exchange) - Formato estándar
 */
function parsearOFX(contenido) {
  const movimientos = []
  let saldoInicial = 0
  let saldoFinal = 0

  // OFX tiene estructura XML-like
  // Buscar saldo inicial
  const balanceMatch = contenido.match(/<LEDGERBAL>[\s\S]*?<BALAMT>([^<]+)/i)
  if (balanceMatch) {
    saldoFinal = parseFloat(balanceMatch[1].replace(',', '.'))
  }

  // Buscar transacciones
  const transRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi
  let match
  while ((match = transRegex.exec(contenido)) !== null) {
    const trans = match[1]

    const tipoMatch = trans.match(/<TRNTYPE>([^<]+)/i)
    const fechaMatch = trans.match(/<DTPOSTED>(\d{8})/i)
    const montoMatch = trans.match(/<TRNAMT>([^<]+)/i)
    const refMatch = trans.match(/<FITID>([^<]+)/i)
    const memoMatch = trans.match(/<MEMO>([^<]+)/i)
    const nameMatch = trans.match(/<NAME>([^<]+)/i)

    if (fechaMatch && montoMatch) {
      const monto = parseFloat(montoMatch[1].replace(',', '.'))
      const fechaStr = fechaMatch[1]
      const fecha = new Date(
        parseInt(fechaStr.substring(0, 4)),
        parseInt(fechaStr.substring(4, 6)) - 1,
        parseInt(fechaStr.substring(6, 8))
      )

      movimientos.push({
        fecha,
        tipo: monto >= 0 ? 'CREDITO' : 'DEBITO',
        importe: Math.abs(monto),
        concepto: nameMatch ? nameMatch[1].trim() : (tipoMatch ? tipoMatch[1] : 'Movimiento'),
        descripcion: memoMatch ? memoMatch[1].trim() : null,
        referencia: refMatch ? refMatch[1].trim() : null
      })
    }
  }

  // Calcular saldo inicial desde saldo final y movimientos
  const totalMovimientos = movimientos.reduce((sum, m) => {
    return sum + (m.tipo === 'CREDITO' ? m.importe : -m.importe)
  }, 0)
  saldoInicial = saldoFinal - totalMovimientos

  return { movimientos, saldoInicial, saldoFinal }
}

/**
 * Parser CSV con configuración parametrizable
 */
function parsearCSV(contenido, config) {
  const {
    delimitador = ';',
    primeraFila = 1,
    formatoFecha = 'DD/MM/YYYY',
    columnas = {}
  } = config

  const lineas = contenido.split(/\r?\n/).filter(l => l.trim())
  const movimientos = []
  let saldoInicial = 0
  let saldoFinal = 0

  for (let i = primeraFila; i < lineas.length; i++) {
    const campos = lineas[i].split(delimitador).map(c => c.trim().replace(/^"|"$/g, ''))

    if (campos.length < 3) continue

    const fechaStr = columnas.fecha !== undefined ? campos[columnas.fecha] : campos[0]
    const concepto = columnas.concepto !== undefined ? campos[columnas.concepto] : campos[1]

    let importe = 0
    let tipo = 'CREDITO'

    // Si hay columnas separadas de débito/crédito
    if (columnas.debito !== undefined && columnas.credito !== undefined) {
      const debito = parseFloat((campos[columnas.debito] || '0').replace(/[^\d,.-]/g, '').replace(',', '.')) || 0
      const credito = parseFloat((campos[columnas.credito] || '0').replace(/[^\d,.-]/g, '').replace(',', '.')) || 0
      if (debito > 0) {
        importe = debito
        tipo = 'DEBITO'
      } else {
        importe = credito
        tipo = 'CREDITO'
      }
    } else if (columnas.importe !== undefined) {
      // Columna única de importe (negativo = débito)
      const imp = parseFloat((campos[columnas.importe] || '0').replace(/[^\d,.-]/g, '').replace(',', '.')) || 0
      importe = Math.abs(imp)
      tipo = imp < 0 ? 'DEBITO' : 'CREDITO'
    }

    if (importe === 0) continue

    // Parsear fecha
    let fecha
    try {
      fecha = parsearFecha(fechaStr, formatoFecha)
    } catch {
      continue
    }

    const saldo = columnas.saldo !== undefined
      ? parseFloat((campos[columnas.saldo] || '0').replace(/[^\d,.-]/g, '').replace(',', '.')) || null
      : null

    movimientos.push({
      fecha,
      tipo,
      importe,
      concepto,
      descripcion: columnas.descripcion !== undefined ? campos[columnas.descripcion] : null,
      referencia: columnas.referencia !== undefined ? campos[columnas.referencia] : null,
      saldo
    })

    // Guardar primer y último saldo
    if (movimientos.length === 1 && saldo !== null) {
      saldoInicial = saldo - (tipo === 'CREDITO' ? importe : -importe)
    }
    if (saldo !== null) {
      saldoFinal = saldo
    }
  }

  return { movimientos, saldoInicial, saldoFinal }
}

/**
 * Parser TXT posicional
 */
function parsearTXT(contenido, config) {
  const { anchos = [], primeraFila = 0, formatoFecha = 'DD/MM/YYYY' } = config

  if (anchos.length === 0) {
    throw new AppError('Configuración de anchos requerida para formato TXT', 400)
  }

  const lineas = contenido.split(/\r?\n/).filter(l => l.trim())
  const movimientos = []
  let saldoInicial = 0
  let saldoFinal = 0

  for (let i = primeraFila; i < lineas.length; i++) {
    const linea = lineas[i]
    const campos = {}

    for (const ancho of anchos) {
      const valor = linea.substring(ancho.inicio, ancho.fin).trim()
      campos[ancho.campo] = valor
    }

    if (!campos.fecha || !campos.importe) continue

    let fecha
    try {
      fecha = parsearFecha(campos.fecha, formatoFecha)
    } catch {
      continue
    }

    const importe = parseFloat((campos.importe || '0').replace(/[^\d,.-]/g, '').replace(',', '.')) || 0
    if (importe === 0) continue

    const tipo = campos.tipo === 'D' || importe < 0 ? 'DEBITO' : 'CREDITO'

    movimientos.push({
      fecha,
      tipo,
      importe: Math.abs(importe),
      concepto: campos.concepto || 'Movimiento',
      descripcion: campos.descripcion,
      referencia: campos.referencia,
      saldo: campos.saldo ? parseFloat(campos.saldo.replace(/[^\d,.-]/g, '').replace(',', '.')) : null
    })
  }

  return { movimientos, saldoInicial, saldoFinal }
}

/**
 * Parsea fecha según formato
 */
function parsearFecha(fechaStr, formato) {
  if (!fechaStr) throw new Error('Fecha vacía')

  // Formatos comunes
  const formatos = {
    'DD/MM/YYYY': /^(\d{2})\/(\d{2})\/(\d{4})$/,
    'YYYY-MM-DD': /^(\d{4})-(\d{2})-(\d{2})$/,
    'DD-MM-YYYY': /^(\d{2})-(\d{2})-(\d{4})$/,
    'YYYYMMDD': /^(\d{4})(\d{2})(\d{2})$/
  }

  const regex = formatos[formato]
  if (!regex) {
    // Intentar parseo directo
    const fecha = new Date(fechaStr)
    if (isNaN(fecha.getTime())) throw new Error('Fecha inválida')
    return fecha
  }

  const match = fechaStr.match(regex)
  if (!match) throw new Error('Formato de fecha no coincide')

  let dia, mes, anio
  switch (formato) {
    case 'DD/MM/YYYY':
    case 'DD-MM-YYYY':
      [, dia, mes, anio] = match
      break
    case 'YYYY-MM-DD':
      [, anio, mes, dia] = match
      break
    case 'YYYYMMDD':
      [, anio, mes, dia] = match
      break
  }

  return new Date(parseInt(anio), parseInt(mes) - 1, parseInt(dia))
}

/**
 * Busca sugerencias de matching automático
 */
function buscarSugerenciasMatching(movsExtracto, movsCaja) {
  const sugerencias = []

  for (const movE of movsExtracto) {
    // Buscar por monto exacto y fecha cercana (±3 días)
    const candidatos = movsCaja.filter(movC => {
      const montoCoincide = Math.abs(Number(movE.importe) - Number(movC.monto)) < 0.01
      const tipoCoincide = (movE.tipo === 'CREDITO' && movC.tipo === 'INGRESO') ||
                          (movE.tipo === 'DEBITO' && movC.tipo === 'EGRESO')
      const diffDias = Math.abs((new Date(movE.fecha) - new Date(movC.fecha)) / (1000 * 60 * 60 * 24))

      return montoCoincide && tipoCoincide && diffDias <= 5
    })

    if (candidatos.length === 1) {
      sugerencias.push({
        movimientoExtractoId: movE.id,
        movimientoCajaId: candidatos[0].id,
        confianza: 'ALTA',
        razon: 'Monto exacto y fecha cercana'
      })
    } else if (candidatos.length > 1) {
      // Múltiples candidatos - sugerir el más cercano en fecha
      candidatos.sort((a, b) => {
        const diffA = Math.abs(new Date(movE.fecha) - new Date(a.fecha))
        const diffB = Math.abs(new Date(movE.fecha) - new Date(b.fecha))
        return diffA - diffB
      })
      sugerencias.push({
        movimientoExtractoId: movE.id,
        movimientoCajaId: candidatos[0].id,
        confianza: 'MEDIA',
        razon: 'Monto exacto, múltiples candidatos'
      })
    }
  }

  return sugerencias
}

export default router
