import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { authAdmin, checkPermiso } from '../middleware/auth.js'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { getTicketAcceso, getConfiguracionFiscal, invalidateTicket } from '../services/afipWSAAService.js'
import { requestCAE, getLastAuthorizedNumber, getServerStatus, TIPOS_COMPROBANTE, TIPOS_DOCUMENTO, CONDICIONES_IVA } from '../services/afipWSFEService.js'
import { generateQRData, canGenerateQR } from '../services/afipQRService.js'
import { renderTicketFiscal, renderTicketNoFiscal, toBase64 } from '../services/ticketService.js'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = Router()

// Todas las rutas requieren autenticación de admin
router.use(authAdmin)

// =============================================================================
// CONFIGURACIÓN FISCAL
// =============================================================================

/**
 * GET /api/admin/facturacion/config
 * Obtener configuración fiscal activa
 * Permitido para quienes pueden cobrar en buffet/kiosco o configurar facturación
 */
router.get('/config', checkPermiso('FACTURACION_CONFIG', 'BUFFET_COBRAR', 'BUFFET_KIOSCO', 'COBRANZAS_COBRAR'), asyncHandler(async (req, res) => {
  const config = await req.db.configuracionFiscal.findFirst({
    where: { activo: true }
  })

  res.json({
    success: true,
    data: config ? {
      ...config,
      // No exponer paths completos de certificados
      certificadoPath: config.certificadoPath ? '*** configurado ***' : null,
      clavePrivadaPath: config.clavePrivadaPath ? '*** configurado ***' : null
    } : null
  })
}))

/**
 * PUT /api/admin/facturacion/config
 * Actualizar o crear configuración fiscal
 */
router.put('/config', checkPermiso('FACTURACION_CONFIG'), asyncHandler(async (req, res) => {
  const {
    cuit,
    razonSocial,
    condicionIva,
    domicilioFiscal,
    iibb,
    inicioActividad,
    modoProduccion
  } = req.body

  if (!cuit || !razonSocial || !condicionIva || !domicilioFiscal) {
    throw new AppError('CUIT, razón social, condición IVA y domicilio fiscal son requeridos', 400)
  }

  // Buscar configuración existente
  const existente = await req.db.configuracionFiscal.findFirst({
    where: { activo: true }
  })

  let config
  if (existente) {
    config = await req.db.configuracionFiscal.update({
      where: { id: existente.id },
      data: {
        cuit,
        razonSocial,
        condicionIva,
        domicilioFiscal,
        iibb: iibb || null,
        inicioActividad: inicioActividad ? new Date(inicioActividad) : null,
        modoProduccion: modoProduccion ?? false
      }
    })
  } else {
    config = await req.db.configuracionFiscal.create({
      data: {
        cuit,
        razonSocial,
        condicionIva,
        domicilioFiscal,
        iibb: iibb || null,
        inicioActividad: inicioActividad ? new Date(inicioActividad) : null,
        modoProduccion: modoProduccion ?? false,
        activo: true
      }
    })
  }

  res.json({ success: true, data: config })
}))

/**
 * POST /api/admin/facturacion/config/certificado
 * Subir certificado y clave privada
 */
router.post('/config/certificado', checkPermiso('FACTURACION_CONFIG'), asyncHandler(async (req, res) => {
  const { certificado, clavePrivada } = req.body

  if (!certificado || !clavePrivada) {
    throw new AppError('Certificado y clave privada son requeridos', 400)
  }

  const config = await req.db.configuracionFiscal.findFirst({
    where: { activo: true }
  })

  if (!config) {
    throw new AppError('Debe configurar primero los datos fiscales', 400)
  }

  // Directorio para certificados
  const certsDir = path.join(process.cwd(), 'certs')
  await fs.mkdir(certsDir, { recursive: true })

  // Guardar certificado
  const certPath = path.join(certsDir, `cert_${config.cuit.replace(/\D/g, '')}.crt`)
  const keyPath = path.join(certsDir, `key_${config.cuit.replace(/\D/g, '')}.key`)

  await fs.writeFile(certPath, certificado)
  await fs.writeFile(keyPath, clavePrivada)

  // Actualizar paths en la configuración
  await req.db.configuracionFiscal.update({
    where: { id: config.id },
    data: {
      certificadoPath: certPath,
      clavePrivadaPath: keyPath
    }
  })

  // Invalidar ticket de acceso por si había uno en cache
  invalidateTicket()

  res.json({
    success: true,
    message: 'Certificado y clave privada guardados correctamente'
  })
}))

// =============================================================================
// TESTING CONEXIÓN AFIP
// =============================================================================

/**
 * POST /api/admin/facturacion/test-conexion
 * Probar conexión con AFIP
 */
router.post('/test-conexion', checkPermiso('FACTURACION_CONFIG'), async (req, res) => {
  const pasos = []

  try {
    // Paso 1: Verificar configuración
    pasos.push({ paso: 'Verificar configuración fiscal', estado: 'ejecutando' })

    const config = await req.db.configuracionFiscal.findFirst({
      where: { activo: true }
    })

    if (!config) {
      pasos[0].estado = 'error'
      pasos[0].error = 'Configuración fiscal no encontrada'
      return res.json({ success: false, pasos })
    }

    if (!config.certificadoPath || !config.clavePrivadaPath) {
      pasos[0].estado = 'error'
      pasos[0].error = 'Certificado y clave privada no configurados'
      return res.json({ success: false, pasos })
    }

    pasos[0].estado = 'ok'
    pasos[0].detalle = `CUIT: ${config.cuit}, Ambiente: ${config.modoProduccion ? 'Producción' : 'Homologación'}`

    // Paso 2: Autenticar con WSAA
    pasos.push({ paso: 'Autenticar con WSAA', estado: 'ejecutando' })

    let ta
    try {
      ta = await getTicketAcceso()
      pasos[1].estado = 'ok'
      pasos[1].detalle = `TA obtenido, expira: ${ta.expirationTime.toLocaleString()}`
    } catch (error) {
      console.error('[Test Conexion] Error WSAA:', error.message)
      pasos[1].estado = 'error'
      pasos[1].error = error.message || 'Error desconocido al autenticar con WSAA'
      return res.json({ success: false, pasos })
    }

    // Paso 3: Conectar con WSFE
    pasos.push({ paso: 'Conectar con WSFE', estado: 'ejecutando' })

    try {
      const status = await getServerStatus()
      pasos[2].estado = 'ok'
      pasos[2].detalle = `AppServer: ${status.appServer}, DbServer: ${status.dbServer}`
    } catch (error) {
      console.error('[Test Conexion] Error WSFE:', error.message)
      pasos[2].estado = 'error'
      pasos[2].error = error.message || 'Error desconocido al conectar con WSFE'
      return res.json({ success: false, pasos })
    }

    res.json({
      success: true,
      message: 'Conexión con AFIP verificada exitosamente',
      pasos
    })
  } catch (error) {
    console.error('[Test Conexion] Error general:', error)
    res.json({
      success: false,
      error: error.message || 'Error desconocido',
      pasos
    })
  }
})

/**
 * GET /api/admin/facturacion/estado-servidor
 * Obtener estado del servidor AFIP
 */
router.get('/estado-servidor', asyncHandler(async (req, res) => {
  const status = await getServerStatus()
  res.json({ success: true, data: status })
}))

// =============================================================================
// COMPROBANTES
// =============================================================================

/**
 * GET /api/admin/facturacion/ultimo-numero/:puntoVenta/:tipo
 * Obtener último número de comprobante autorizado
 */
router.get('/ultimo-numero/:puntoVenta/:tipo', asyncHandler(async (req, res) => {
  const { puntoVenta, tipo } = req.params

  const ultimoNumero = await getLastAuthorizedNumber(
    parseInt(puntoVenta),
    parseInt(tipo)
  )

  res.json({
    success: true,
    data: {
      puntoVenta: parseInt(puntoVenta),
      tipoComprobante: parseInt(tipo),
      ultimoNumero
    }
  })
}))

/**
 * POST /api/admin/facturacion/emitir
 * Emitir comprobante fiscal con CAE
 */
router.post('/emitir', checkPermiso('FACTURACION_EMITIR'), asyncHandler(async (req, res) => {
  const {
    puntoVenta,
    tipoComprobante, // 1=FA, 6=FB, 11=FC
    tipoDocCliente, // 80=CUIT, 96=DNI, 99=CF
    docCliente,
    nombreCliente,
    condicionIvaCliente, // 1=RI, 5=CF, etc.
    items,
    metodoPago,
    comandaId, // Opcional: asociar a comanda
    cajaId // Opcional: caja que emite
  } = req.body

  if (!puntoVenta || !tipoComprobante || !items || items.length === 0) {
    throw new AppError('Punto de venta, tipo de comprobante e items son requeridos', 400)
  }

  const config = await getConfiguracionFiscal()

  // Calcular totales
  let subtotal = 0
  let iva = 0

  const itemsConIva = items.map(item => {
    const cantidad = item.cantidad || 1
    const precioUnitario = item.precioUnitario || item.precio || 0
    const ivaRate = item.ivaRate || 21

    // Si el precio incluye IVA, calcular subtotal
    const itemSubtotal = cantidad * precioUnitario
    const ivaAmount = tipoComprobante === 11 ? 0 : (itemSubtotal * ivaRate) / (100 + ivaRate)
    const baseImponible = itemSubtotal - ivaAmount

    subtotal += baseImponible
    iva += ivaAmount

    return {
      descripcion: item.descripcion || item.nombre,
      cantidad,
      precioUnitario,
      subtotal: itemSubtotal,
      ivaRate,
      ivaAmount
    }
  })

  const total = subtotal + iva

  // Obtener siguiente número de comprobante
  const ultimoNumero = await getLastAuthorizedNumber(puntoVenta, tipoComprobante)
  const numeroComprobante = ultimoNumero + 1

  // Solicitar CAE a AFIP
  const resultado = await requestCAE({
    puntoVenta,
    tipoComprobante,
    numeroComprobante,
    fecha: new Date(),
    tipoDocCliente: tipoDocCliente || 99,
    docCliente: docCliente || '',
    condicionIvaCliente: condicionIvaCliente || 5,
    subtotal,
    iva,
    total,
    items: itemsConIva
  })

  // Determinar nombre del tipo de comprobante
  const tiposNombre = {
    1: 'FACTURA A', 2: 'NOTA DE DEBITO A', 3: 'NOTA DE CREDITO A',
    6: 'FACTURA B', 7: 'NOTA DE DEBITO B', 8: 'NOTA DE CREDITO B',
    11: 'FACTURA C', 12: 'NOTA DE DEBITO C', 13: 'NOTA DE CREDITO C'
  }

  // Guardar comprobante en base de datos
  const comprobante = await prisma.comprobanteElectronico.create({
    data: {
      tipo: tiposNombre[tipoComprobante] || 'FACTURA',
      tipoAfip: tipoComprobante,
      puntoVenta,
      numero: numeroComprobante,
      fecha: new Date(),
      cae: resultado.cae,
      fechaVtoCae: resultado.caeExpiration,
      cuitReceptor: docCliente && tipoDocCliente === 80 ? docCliente : null,
      nombreReceptor: nombreCliente || 'Consumidor Final',
      condicionIvaReceptor: getCondicionIvaNombre(condicionIvaCliente),
      subtotal,
      iva21: iva,
      iva105: 0,
      total,
      metodoPago: metodoPago || 'EFECTIVO',
      comandaId: comandaId ? parseInt(comandaId) : null,
      cajaId: cajaId ? parseInt(cajaId) : null,
      creadoPorId: req.admin.id,
      estado: 'EMITIDO'
    }
  })

  // Generar URL del QR
  const qrUrl = generateQRData({
    cuit: config.cuit,
    tipoComprobante,
    puntoVenta,
    numeroComprobante,
    importe: total,
    fecha: new Date(),
    tipoDocCliente: tipoDocCliente || 99,
    docCliente: docCliente || '',
    cae: resultado.cae
  })

  // Generar ticket para impresión
  const ticketData = await renderTicketFiscal({
    empresa: {
      razonSocial: config.razonSocial,
      domicilio: config.domicilioFiscal,
      cuit: config.cuit,
      condicionIva: config.condicionIva,
      iibb: config.iibb || 'EXENTO',
      inicioActividades: config.inicioActividad ? new Date(config.inicioActividad).toLocaleDateString('es-AR') : null
    },
    comprobante: {
      tipo: tiposNombre[tipoComprobante],
      tipoAfip: tipoComprobante,
      puntoVenta,
      numero: numeroComprobante,
      fecha: new Date(),
      cae: resultado.cae,
      fechaVtoCae: resultado.caeExpiration,
      cuit: config.cuit,
      nombreCliente: nombreCliente || 'Consumidor Final',
      tipoDocCliente: tipoDocCliente || 99,
      docCliente,
      condicionIvaCliente: getCondicionIvaNombre(condicionIvaCliente),
      subtotal,
      iva,
      total,
      metodoPago
    },
    comanda: { metodoPago },
    items: itemsConIva
  })

  res.json({
    success: true,
    data: {
      comprobante,
      cae: resultado.cae,
      fechaVtoCae: resultado.caeExpiration,
      qrUrl,
      ticket: toBase64(ticketData)
    }
  })
}))

/**
 * GET /api/admin/facturacion/comprobantes
 * Listar comprobantes emitidos
 */
router.get('/comprobantes', asyncHandler(async (req, res) => {
  const { desde, hasta, puntoVenta, tipo, cajaId, limit = 50, offset = 0 } = req.query

  const where = {}

  if (desde || hasta) {
    where.fecha = {}
    if (desde) where.fecha.gte = new Date(desde)
    if (hasta) where.fecha.lte = new Date(hasta + 'T23:59:59')
  }

  if (puntoVenta) where.puntoVenta = parseInt(puntoVenta)
  if (tipo) where.tipoAfip = parseInt(tipo)
  if (cajaId) where.cajaId = parseInt(cajaId)

  const [comprobantes, total] = await Promise.all([
    prisma.comprobanteElectronico.findMany({
      where,
      orderBy: { fecha: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
      include: {
        comanda: { select: { id: true, numero: true } },
        caja: { select: { id: true, nombre: true } },
        creadoPor: { select: { id: true, nombre: true, apellido: true } }
      }
    }),
    prisma.comprobanteElectronico.count({ where })
  ])

  res.json({
    success: true,
    data: comprobantes,
    total,
    limit: parseInt(limit),
    offset: parseInt(offset)
  })
}))

/**
 * GET /api/admin/facturacion/comprobantes/:id
 * Obtener detalle de comprobante
 */
router.get('/comprobantes/:id', asyncHandler(async (req, res) => {
  const { id } = req.params

  const comprobante = await prisma.comprobanteElectronico.findUnique({
    where: { id: parseInt(id) },
    include: {
      comanda: {
        include: {
          items: { include: { producto: true } }
        }
      },
      caja: true,
      creadoPor: { select: { id: true, nombre: true, apellido: true } }
    }
  })

  if (!comprobante) {
    throw new AppError('Comprobante no encontrado', 404)
  }

  // Generar QR si tiene CAE
  let qrUrl = null
  if (canGenerateQR({ cae: comprobante.cae, cuit: null })) {
    const config = await getConfiguracionFiscal()
    qrUrl = generateQRData({
      cuit: config.cuit,
      tipoComprobante: comprobante.tipoAfip,
      puntoVenta: comprobante.puntoVenta,
      numeroComprobante: comprobante.numero,
      importe: parseFloat(comprobante.total),
      fecha: comprobante.fecha,
      tipoDocCliente: comprobante.cuitReceptor ? 80 : 99,
      docCliente: comprobante.cuitReceptor || '',
      cae: comprobante.cae
    })
  }

  res.json({
    success: true,
    data: {
      ...comprobante,
      qrUrl
    }
  })
}))

/**
 * GET /api/admin/facturacion/comprobantes/:id/ticket
 * Obtener ticket de impresión de un comprobante
 */
router.get('/comprobantes/:id/ticket', asyncHandler(async (req, res) => {
  const { id } = req.params

  const comprobante = await prisma.comprobanteElectronico.findUnique({
    where: { id: parseInt(id) },
    include: {
      comanda: {
        include: {
          items: { include: { producto: true } }
        }
      }
    }
  })

  if (!comprobante) {
    throw new AppError('Comprobante no encontrado', 404)
  }

  const config = await getConfiguracionFiscal()

  // Preparar items del ticket
  const items = comprobante.comanda?.items?.map(item => ({
    nombre: item.producto?.nombre || item.nombre || 'Producto',
    cantidad: item.cantidad,
    precioUnitario: parseFloat(item.precioUnitario),
    subtotal: parseFloat(item.subtotal)
  })) || []

  const ticketData = await renderTicketFiscal({
    empresa: {
      razonSocial: config.razonSocial,
      domicilio: config.domicilioFiscal,
      cuit: config.cuit,
      condicionIva: config.condicionIva,
      iibb: config.iibb || 'EXENTO',
      inicioActividades: config.inicioActividad ? new Date(config.inicioActividad).toLocaleDateString('es-AR') : null
    },
    comprobante: {
      tipo: comprobante.tipo,
      tipoAfip: comprobante.tipoAfip,
      puntoVenta: comprobante.puntoVenta,
      numero: comprobante.numero,
      fecha: comprobante.fecha,
      cae: comprobante.cae,
      fechaVtoCae: comprobante.fechaVtoCae,
      cuit: config.cuit,
      nombreCliente: comprobante.nombreReceptor || 'Consumidor Final',
      tipoDocCliente: comprobante.cuitReceptor ? 80 : 99,
      docCliente: comprobante.cuitReceptor,
      condicionIvaCliente: comprobante.condicionIvaReceptor,
      subtotal: parseFloat(comprobante.subtotal),
      iva: parseFloat(comprobante.iva21),
      total: parseFloat(comprobante.total),
      metodoPago: comprobante.metodoPago
    },
    comanda: { metodoPago: comprobante.metodoPago },
    items
  })

  res.json({
    success: true,
    data: {
      ticket: toBase64(ticketData),
      formato: 'ESCPOS_BASE64'
    }
  })
}))

// =============================================================================
// HELPERS
// =============================================================================

function getCondicionIvaNombre(codigo) {
  const condiciones = {
    1: 'IVA Responsable Inscripto',
    3: 'IVA no Responsable',
    4: 'IVA Sujeto Exento',
    5: 'Consumidor Final',
    6: 'Responsable Monotributo'
  }
  return condiciones[codigo] || 'Consumidor Final'
}

// =============================================================================
// CONSTANTES EXPORTADAS
// =============================================================================

export { TIPOS_COMPROBANTE, TIPOS_DOCUMENTO, CONDICIONES_IVA }

export default router
