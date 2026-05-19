import { Router } from 'express'
import * as XLSX from 'xlsx'
import prisma from '../lib/prisma.js'
import { authAdmin } from '../middleware/auth.js'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { calcularHashMovimiento } from '../services/hashExtracto.js'

const router = Router()

router.use(authAdmin)

// =============================================================================
// FORMATOS DE EXTRACTO (Parametrizables)
// =============================================================================

// GET /api/admin/conciliacion/formatos - Listar formatos
router.get('/formatos', asyncHandler(async (req, res) => {
  const formatos = await req.db.formatoExtracto.findMany({
    orderBy: { nombre: 'asc' }
  })
  res.json({ success: true, data: formatos })
}))

// GET /api/admin/conciliacion/formatos/:id - Detalle formato
router.get('/formatos/:id', asyncHandler(async (req, res) => {
  const formato = await req.db.formatoExtracto.findUnique({
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

  const formato = await req.db.formatoExtracto.create({
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

  const formato = await req.db.formatoExtracto.update({
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

// POST /api/admin/conciliacion/formatos/presets-argentinos - Crear formatos predefinidos bancos AR
router.post('/formatos/presets-argentinos', asyncHandler(async (req, res) => {
  let creados = 0
  let existentes = 0

  for (const preset of PRESETS_BANCOS_AR) {
    const existe = await req.db.formatoExtracto.findFirst({
      where: { nombre: preset.nombre }
    })
    if (!existe) {
      await req.db.formatoExtracto.create({ data: preset })
      creados++
    } else {
      existentes++
    }
  }

  res.json({
    success: true,
    message: `${creados} formatos creados, ${existentes} ya existían`,
    data: { creados, existentes }
  })
}))

// DELETE /api/admin/conciliacion/formatos/:id - Eliminar formato
router.delete('/formatos/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id)

  // Verificar si tiene extractos asociados
  const extractos = await req.db.extractoBancario.count({
    where: { formatoId: id }
  })

  if (extractos > 0) {
    throw new AppError('No se puede eliminar, tiene extractos asociados', 400)
  }

  await req.db.formatoExtracto.delete({ where: { id } })
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
    req.db.extractoBancario.findMany({
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
    req.db.extractoBancario.count({ where })
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
  const extracto = await req.db.extractoBancario.findUnique({
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
//
// Flujo de deduplicación:
//   - Calcula hash determinístico por movimiento (ver services/hashExtracto.js).
//   - Busca esos hashes en MovimientoExtracto del tenant.
//   - Si hay duplicados y NO viene omitirDuplicados=true → responde 409 con info para mostrar modal.
//   - Si omitirDuplicados=true → importa solo los nuevos, devuelve resumen.
router.post('/extractos/importar', asyncHandler(async (req, res) => {
  const { cajaId, formatoId, contenido, nombreArchivo, periodoDesde, periodoHasta, observaciones, omitirDuplicados } = req.body

  if (!cajaId || !formatoId || !contenido) {
    throw new AppError('Caja, formato y contenido son requeridos', 400)
  }

  const formato = await req.db.formatoExtracto.findUnique({
    where: { id: parseInt(formatoId) }
  })
  if (!formato) throw new AppError('Formato no encontrado', 404)

  const caja = await req.db.caja.findUnique({
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

  // Calcular hash de cada movimiento y detectar duplicados existentes en el tenant
  movimientos = movimientos.map(m => ({ ...m, hashOrigen: calcularHashMovimiento(m) }))
  const hashes = movimientos.map(m => m.hashOrigen)
  const existentes = await req.db.movimientoExtracto.findMany({
    where: { hashOrigen: { in: hashes } },
    select: {
      hashOrigen: true,
      fecha: true,
      importe: true,
      concepto: true,
      extracto: { select: { id: true, numero: true, fechaImportacion: true, caja: { select: { nombre: true } } } }
    }
  })
  const hashesExistentes = new Set(existentes.map(e => e.hashOrigen))

  if (hashesExistentes.size > 0 && !omitirDuplicados) {
    // Agrupar duplicados por extracto origen para mostrar en modal
    const porExtracto = {}
    for (const e of existentes) {
      const key = e.extracto.numero
      if (!porExtracto[key]) porExtracto[key] = { numero: key, caja: e.extracto.caja.nombre, fechaImportacion: e.extracto.fechaImportacion, cantidad: 0 }
      porExtracto[key].cantidad++
    }
    return res.status(409).json({
      success: false,
      code: 'DUPLICADOS_DETECTADOS',
      message: `Se detectaron ${hashesExistentes.size} movimientos ya importados`,
      data: {
        totalMovimientos: movimientos.length,
        duplicados: hashesExistentes.size,
        nuevos: movimientos.length - hashesExistentes.size,
        porExtracto: Object.values(porExtracto),
        ejemplos: existentes.slice(0, 5).map(e => ({
          fecha: e.fecha,
          importe: Number(e.importe),
          concepto: e.concepto?.slice(0, 80),
          extractoOriginal: e.extracto.numero
        }))
      }
    })
  }

  // Filtrar duplicados si corresponde
  const movimientosAImportar = omitirDuplicados
    ? movimientos.filter(m => !hashesExistentes.has(m.hashOrigen))
    : movimientos

  if (movimientosAImportar.length === 0) {
    throw new AppError('Todos los movimientos del archivo ya fueron importados anteriormente', 400, 'TODOS_DUPLICADOS')
  }

  // Generar número de extracto
  const anio = new Date().getFullYear()
  const prefijo = `EXT-${anio}-`
  const ultimo = await req.db.extractoBancario.findFirst({
    where: { numero: { startsWith: prefijo } },
    orderBy: { numero: 'desc' }
  })
  let siguiente = 1
  if (ultimo) {
    const partes = ultimo.numero.split('-')
    siguiente = (parseInt(partes[partes.length - 1]) || 0) + 1
  }
  const numero = `${prefijo}${String(siguiente).padStart(5, '0')}`

  // Calcular totales sobre lo que efectivamente vamos a importar
  const totalCreditos = movimientosAImportar.filter(m => m.tipo === 'CREDITO').reduce((sum, m) => sum + m.importe, 0)
  const totalDebitos = movimientosAImportar.filter(m => m.tipo === 'DEBITO').reduce((sum, m) => sum + m.importe, 0)

  // Check de balance: si el archivo trae saldoInicial+saldoFinal y se omitieron movimientos,
  // el balance puede no cerrar. Avisar al cliente sin bloquear.
  const omitidos = movimientos.length - movimientosAImportar.length
  const balanceEsperado = Number(saldoInicial) + totalCreditos - totalDebitos
  const balanceDiff = Math.abs(balanceEsperado - Number(saldoFinal))
  const balanceCierra = balanceDiff < 0.01

  // Crear extracto con movimientos
  const extracto = await req.db.extractoBancario.create({
    data: {
      cajaId: parseInt(cajaId),
      formatoId: parseInt(formatoId),
      numero,
      periodoDesde: periodoDesde ? new Date(periodoDesde) : movimientosAImportar[0]?.fecha || new Date(),
      periodoHasta: periodoHasta ? new Date(periodoHasta) : movimientosAImportar[movimientosAImportar.length - 1]?.fecha || new Date(),
      nombreArchivo,
      saldoInicial,
      saldoFinal,
      totalCreditos,
      totalDebitos,
      cantidadMovimientos: movimientosAImportar.length,
      importadoPor: req.admin.id,
      observaciones,
      movimientos: {
        create: movimientosAImportar.map(m => ({
          // tenantId requerido por el modelo y no inyectado automáticamente
          // por la extension Prisma en nested creates.
          tenantId: req.tenantId,
          fecha: m.fecha,
          fechaValor: m.fechaValor,
          concepto: m.concepto,
          descripcion: m.descripcion,
          referencia: m.referencia,
          numeroComprobante: m.numeroComprobante,
          tipo: m.tipo,
          importe: m.importe,
          saldo: m.saldo,
          hashOrigen: m.hashOrigen
        }))
      }
    },
    include: {
      caja: { select: { id: true, codigo: true, nombre: true } },
      formato: { select: { id: true, nombre: true } },
      movimientos: true
    }
  })

  let message = `Extracto importado: ${movimientosAImportar.length} movimientos`
  if (omitidos > 0) message += ` (${omitidos} duplicados omitidos)`
  if (!balanceCierra) message += `. ⚠ El balance no cierra (dif. $${balanceDiff.toFixed(2)})`

  res.status(201).json({
    success: true,
    data: extracto,
    omitidos,
    balanceCierra,
    balanceDiff: balanceCierra ? 0 : Math.round(balanceDiff * 100) / 100,
    message
  })
}))

// DELETE /api/admin/conciliacion/extractos/:id - Eliminar extracto
router.delete('/extractos/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id)

  const extracto = await req.db.extractoBancario.findUnique({
    where: { id },
    include: { conciliaciones: true }
  })

  if (!extracto) throw new AppError('Extracto no encontrado', 404)

  if (extracto.conciliaciones.length > 0) {
    throw new AppError('No se puede eliminar, tiene conciliaciones asociadas', 400)
  }

  // Eliminar movimientos y extracto
  await req.db.$transaction([
    req.db.movimientoExtracto.deleteMany({ where: { extractoId: id } }),
    req.db.extractoBancario.delete({ where: { id } })
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

  const movimientosExtracto = await req.db.movimientoExtracto.findMany({
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

  const movimientosCaja = await req.db.movimientoCaja.findMany({
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

  const extracto = await req.db.extractoBancario.findUnique({
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
  const movsExtracto = await req.db.movimientoExtracto.findMany({
    where: { id: { in: movimientoExtractoIds }, conciliado: false }
  })
  if (movsExtracto.length !== movimientoExtractoIds.length) {
    throw new AppError('Algunos movimientos de extracto no existen o ya fueron conciliados', 400)
  }

  const movsCaja = await req.db.movimientoCaja.findMany({
    where: { id: { in: movimientoCajaIds }, conciliado: false, anulado: false }
  })
  if (movsCaja.length !== movimientoCajaIds.length) {
    throw new AppError('Algunos movimientos de caja no existen o ya fueron conciliados', 400)
  }

  // Calcular monto total
  const montoConciliado = movsExtracto.reduce((sum, m) => sum + Number(m.importe), 0)

  // Crear conciliación y actualizar movimientos
  const conciliacion = await req.db.$transaction(async (tx) => {
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
    req.db.conciliacion.findMany({
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
    req.db.conciliacion.count({ where })
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

  const movimientoCaja = await req.db.movimientoCaja.findUnique({
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
  const movimientoExtracto = await req.db.movimientoExtracto.findFirst({
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
  const extractosPorEstado = await req.db.extractoBancario.groupBy({
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

  const cajasPendientes = await req.db.movimientoCaja.aggregate({
    where: whereCajaPendiente,
    _sum: { monto: true },
    _count: true
  })

  // Movimientos de extracto pendientes
  const whereExtractoPendiente = { conciliado: false }
  if (cajaId) whereExtractoPendiente.extracto = { cajaId: parseInt(cajaId) }

  const extractosPendientes = await req.db.movimientoExtracto.aggregate({
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
      return parsearXLSX(contenido, config)
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
 * Parser XLSX
 * contenido: base64 string (con o sin prefijo data:...)
 */
function parsearXLSX(contenidoBase64, config) {
  const {
    hoja = 0,
    primeraFila = 1,
    formatoFecha = 'DD/MM/YYYY',
    columnas = {},
    mergearFilasContinuacion = false,  // si una fila no tiene fecha + tiene concepto, append al anterior
    ordenInvertido = false,            // si el archivo viene DESC por fecha (más reciente arriba)
  } = config

  const base64 = contenidoBase64.replace(/^data:[^;]+;base64,/, '')
  const buffer = Buffer.from(base64, 'base64')

  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheetName = typeof hoja === 'number' ? workbook.SheetNames[hoja] : hoja
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error(`Hoja "${sheetName}" no encontrada en el archivo`)

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  const movimientos = []
  let saldoInicial = 0
  let saldoFinal = 0

  for (let i = primeraFila; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every(c => c === '' || c === null || c === undefined)) continue

    const col = (idx) => (idx !== undefined && idx !== null) ? row[idx] : undefined

    const fechaVal = col(columnas.fecha ?? 0)
    const concepto = String(col(columnas.concepto ?? 1) || '').trim()

    let importe = 0
    let tipo = 'CREDITO'

    if (columnas.debito !== undefined && columnas.credito !== undefined) {
      const deb = parseFloat(String(col(columnas.debito) || '0').replace(/[^\d,.-]/g, '').replace(',', '.')) || 0
      const cred = parseFloat(String(col(columnas.credito) || '0').replace(/[^\d,.-]/g, '').replace(',', '.')) || 0
      if (deb > 0) { importe = deb; tipo = 'DEBITO' } else { importe = cred; tipo = 'CREDITO' }
    } else if (columnas.importe !== undefined) {
      const imp = parseFloat(String(col(columnas.importe) || '0').replace(/[^\d,.-]/g, '').replace(',', '.')) || 0
      importe = Math.abs(imp)
      tipo = imp < 0 ? 'DEBITO' : 'CREDITO'
    }

    // Fila de continuación: sin fecha + sin importe pero con texto en concepto.
    // Si el banco fragmenta el detalle (Credicoop suele poner el nombre del titular en
    // la fila siguiente), agregamos ese texto al concepto del movimiento anterior.
    if ((!fechaVal || importe === 0) && mergearFilasContinuacion && concepto && movimientos.length > 0) {
      const ult = movimientos[movimientos.length - 1]
      ult.concepto = `${ult.concepto} — ${concepto}`.slice(0, 500)
      continue
    }

    if (!fechaVal || importe === 0) continue

    let fecha
    if (fechaVal instanceof Date) {
      fecha = fechaVal
    } else {
      try { fecha = parsearFecha(String(fechaVal), formatoFecha) } catch { continue }
    }

    const saldo = columnas.saldo !== undefined
      ? parseFloat(String(col(columnas.saldo) || '0').replace(/[^\d,.-]/g, '').replace(',', '.')) || null
      : null

    movimientos.push({
      fecha,
      tipo,
      importe,
      concepto: (concepto || 'Movimiento').replace(/[\r\n]+/g, ' — ').replace(/\s+/g, ' ').trim(),
      descripcion: columnas.descripcion !== undefined ? String(col(columnas.descripcion) || '').trim() : null,
      referencia: columnas.referencia !== undefined ? String(col(columnas.referencia) || '').trim() : null,
      saldo
    })
  }

  // Si el archivo viene DESC, invertir (opcional — algunos bancos exportan más reciente arriba).
  if (ordenInvertido) movimientos.reverse()

  // Ordenar por fecha ASC para garantizar orden cronológico,
  // independiente de cómo venga el archivo. Esto hace el cálculo de
  // saldoInicial/saldoFinal y el matching contra MovimientoCaja más predecibles.
  movimientos.sort((a, b) => a.fecha - b.fecha)

  // Saldo inicial/final desde primer y último movimiento (en orden cronológico)
  if (movimientos.length > 0) {
    const primero = movimientos[0]
    if (primero.saldo !== null && primero.saldo !== undefined) {
      saldoInicial = primero.saldo - (primero.tipo === 'CREDITO' ? primero.importe : -primero.importe)
    }
    const ultimo = movimientos[movimientos.length - 1]
    if (ultimo.saldo !== null && ultimo.saldo !== undefined) saldoFinal = ultimo.saldo
  }

  return { movimientos, saldoInicial, saldoFinal }
}

// Presets de formatos para bancos argentinos
const PRESETS_BANCOS_AR = [
  {
    nombre: 'Banco Galicia - Extracto CSV',
    banco: 'GALICIA',
    tipoArchivo: 'CSV',
    descripcion: 'Extracto cuenta corriente/caja de ahorro — exportación Home Banking Galicia',
    configuracion: { delimitador: ';', primeraFila: 2, formatoFecha: 'DD/MM/YYYY',
      columnas: { fecha: 0, descripcion: 1, referencia: 2, debito: 3, credito: 4, saldo: 5 } }
  },
  {
    nombre: 'Banco Galicia - Extracto Excel',
    banco: 'GALICIA',
    tipoArchivo: 'XLSX',
    descripcion: 'Extracto Galicia en formato Excel (.xlsx)',
    configuracion: { hoja: 0, primeraFila: 2, formatoFecha: 'DD/MM/YYYY',
      columnas: { fecha: 0, descripcion: 1, referencia: 2, debito: 3, credito: 4, saldo: 5 } }
  },
  {
    nombre: 'Santander Argentina - Extracto CSV',
    banco: 'SANTANDER',
    tipoArchivo: 'CSV',
    descripcion: 'Extracto cuenta Santander Argentina — exportación Online Banking',
    configuracion: { delimitador: ';', primeraFila: 2, formatoFecha: 'DD/MM/YYYY',
      columnas: { fecha: 0, concepto: 1, referencia: 2, importe: 3, saldo: 4 } }
  },
  {
    nombre: 'Santander Argentina - Extracto Excel',
    banco: 'SANTANDER',
    tipoArchivo: 'XLSX',
    descripcion: 'Extracto Santander en formato Excel (.xlsx)',
    configuracion: { hoja: 0, primeraFila: 2, formatoFecha: 'DD/MM/YYYY',
      columnas: { fecha: 0, concepto: 1, referencia: 2, importe: 3, saldo: 4 } }
  },
  {
    nombre: 'Banco Macro - Extracto CSV',
    banco: 'MACRO',
    tipoArchivo: 'CSV',
    descripcion: 'Extracto cuenta Banco Macro',
    configuracion: { delimitador: ';', primeraFila: 1, formatoFecha: 'DD/MM/YYYY',
      columnas: { fecha: 0, concepto: 1, debito: 2, credito: 3, saldo: 4 } }
  },
  {
    nombre: 'Banco Macro - Extracto Excel',
    banco: 'MACRO',
    tipoArchivo: 'XLSX',
    descripcion: 'Extracto Banco Macro en formato Excel',
    configuracion: { hoja: 0, primeraFila: 1, formatoFecha: 'DD/MM/YYYY',
      columnas: { fecha: 0, concepto: 1, debito: 2, credito: 3, saldo: 4 } }
  },
  {
    nombre: 'Banco Provincia - Extracto CSV',
    banco: 'PROVINCIA',
    tipoArchivo: 'CSV',
    descripcion: 'Extracto cuenta Banco Provincia de Buenos Aires',
    configuracion: { delimitador: ';', primeraFila: 2, formatoFecha: 'DD/MM/YYYY',
      columnas: { fecha: 0, concepto: 1, descripcion: 2, importe: 3, saldo: 4 } }
  },
  {
    nombre: 'Banco Provincia - Extracto Excel',
    banco: 'PROVINCIA',
    tipoArchivo: 'XLSX',
    descripcion: 'Extracto Banco Provincia en formato Excel',
    configuracion: { hoja: 0, primeraFila: 2, formatoFecha: 'DD/MM/YYYY',
      columnas: { fecha: 0, concepto: 1, descripcion: 2, importe: 3, saldo: 4 } }
  },
  {
    nombre: 'Banco Credicoop - Extracto Excel',
    banco: 'CREDICOOP',
    tipoArchivo: 'XLSX',
    descripcion: 'Extracto Banca Internet Empresaria Credicoop (Excel exportado del home banking)',
    configuracion: {
      hoja: 0,
      primeraFila: 1,
      formatoFecha: 'DD/MM/YYYY',
      columnas: {
        fecha: 0,        // A
        concepto: 1,     // B
        referencia: 2,   // C - Nro.Cpbte.
        debito: 3,       // D
        credito: 4,      // E
        saldo: 5         // F
      },
      mergearFilasContinuacion: true   // filas sin fecha → append al concepto anterior (nombre titular)
      // El parser ahora siempre ordena por fecha al final — no hace falta `ordenInvertido`
    }
  }
]

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
