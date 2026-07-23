import { Router } from 'express'
import { asyncHandler, AppError } from '../../middleware/errorHandler.js'
import { authAdmin, checkPermiso } from '../../middleware/auth.js'
import { invalidateTicket, getTicketAcceso, resolverConexionAfip } from '../../services/afipWSAAService.js'
import { getServerStatus } from '../../services/afipWSFEService.js'
import fs from 'fs/promises'
import path from 'path'

const router = Router()

// =============================================================================
// AFIP CONNECTIONS — conexiones técnicas con AFIP (cert/key/CUIT/ambiente)
// =============================================================================

router.get('/afip-connections', authAdmin, asyncHandler(async (req, res) => {
  const connections = await req.db.afipConnection.findMany({
    orderBy: [{ esDefault: 'desc' }, { nombre: 'asc' }],
    include: { _count: { select: { puntosVenta: true } } }
  })

  // Ocultar paths absolutos (solo indicador de "configurado")
  const data = connections.map(c => ({
    ...c,
    certificadoPath: c.certificadoPath ? '*** configurado ***' : null,
    clavePrivadaPath: c.clavePrivadaPath ? '*** configurado ***' : null,
    taTicketsByService: undefined, // no exponer cache
  }))

  res.json({ success: true, data })
}))

router.get('/afip-connections/:id', authAdmin, asyncHandler(async (req, res) => {
  const conn = await req.db.afipConnection.findUnique({
    where: { id: parseInt(req.params.id) },
    include: { puntosVenta: true }
  })
  if (!conn) throw new AppError('Conexión AFIP no encontrada', 404)
  res.json({
    success: true,
    data: {
      ...conn,
      certificadoPath: conn.certificadoPath ? '*** configurado ***' : null,
      clavePrivadaPath: conn.clavePrivadaPath ? '*** configurado ***' : null,
      taTicketsByService: undefined,
    }
  })
}))

router.post('/afip-connections', authAdmin, checkPermiso('FACTURACION_CONFIG'), asyncHandler(async (req, res) => {
  const { nombre, descripcion, cuit, environment, wsaaUrl, wsfeUrl, timeoutMs, activo, esDefault } = req.body

  if (!nombre || !cuit) {
    throw new AppError('Nombre y CUIT son requeridos', 400)
  }
  if (!/^\d{11}$/.test(cuit)) {
    throw new AppError('El CUIT debe tener 11 dígitos', 400)
  }

  // Si esDefault=true, desactivar el flag en otras
  if (esDefault) {
    await req.db.afipConnection.updateMany({
      where: { esDefault: true },
      data: { esDefault: false }
    })
  }

  const conn = await req.db.afipConnection.create({
    data: {
      nombre,
      descripcion: descripcion || null,
      cuit,
      environment: environment || 'TESTING',
      wsaaUrl: wsaaUrl || null,
      wsfeUrl: wsfeUrl || null,
      timeoutMs: timeoutMs || 30000,
      activo: activo !== false,
      esDefault: !!esDefault,
    }
  })

  res.status(201).json({ success: true, data: conn })
}))

router.patch('/afip-connections/:id', authAdmin, checkPermiso('FACTURACION_CONFIG'), asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id)
  const existing = await req.db.afipConnection.findUnique({ where: { id } })
  if (!existing) throw new AppError('Conexión AFIP no encontrada', 404)

  const { nombre, descripcion, cuit, environment, wsaaUrl, wsfeUrl, timeoutMs, activo, esDefault } = req.body

  if (cuit && !/^\d{11}$/.test(cuit)) {
    throw new AppError('El CUIT debe tener 11 dígitos', 400)
  }

  if (esDefault) {
    await req.db.afipConnection.updateMany({
      where: { esDefault: true, NOT: { id } },
      data: { esDefault: false }
    })
  }

  const conn = await req.db.afipConnection.update({
    where: { id },
    data: {
      ...(nombre !== undefined && { nombre }),
      ...(descripcion !== undefined && { descripcion }),
      ...(cuit !== undefined && { cuit }),
      ...(environment !== undefined && { environment }),
      ...(wsaaUrl !== undefined && { wsaaUrl }),
      ...(wsfeUrl !== undefined && { wsfeUrl }),
      ...(timeoutMs !== undefined && { timeoutMs }),
      ...(activo !== undefined && { activo }),
      ...(esDefault !== undefined && { esDefault }),
    }
  })

  // Invalidar TA en cache (cambió config)
  invalidateTicket({ connectionId: id })

  res.json({ success: true, data: conn })
}))

router.delete('/afip-connections/:id', authAdmin, checkPermiso('FACTURACION_CONFIG'), asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id)
  const existing = await req.db.afipConnection.findUnique({
    where: { id },
    include: { _count: { select: { puntosVenta: true } } }
  })
  if (!existing) throw new AppError('Conexión AFIP no encontrada', 404)
  if (existing._count.puntosVenta > 0) {
    throw new AppError('No se puede eliminar: hay puntos de venta usando esta conexión', 400)
  }
  await req.db.afipConnection.delete({ where: { id } })
  res.json({ success: true, message: 'Conexión eliminada' })
}))

// Upload de certificado y clave privada (en body como string)
router.post('/afip-connections/:id/certificado', authAdmin, checkPermiso('FACTURACION_CONFIG'), asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id)
  const { certificado, clavePrivada } = req.body

  if (!certificado || !clavePrivada) {
    throw new AppError('Certificado y clave privada son requeridos', 400)
  }

  const conn = await req.db.afipConnection.findUnique({ where: { id } })
  if (!conn) throw new AppError('Conexión AFIP no encontrada', 404)

  const certsDir = path.join(process.cwd(), 'certs')
  await fs.mkdir(certsDir, { recursive: true })

  const cuitDigits = conn.cuit.replace(/\D/g, '')
  const certPath = path.join(certsDir, `cert_${id}_${cuitDigits}.crt`)
  const keyPath = path.join(certsDir, `key_${id}_${cuitDigits}.key`)

  await fs.writeFile(certPath, certificado)
  await fs.writeFile(keyPath, clavePrivada)

  await req.db.afipConnection.update({
    where: { id },
    data: { certificadoPath: certPath, clavePrivadaPath: keyPath }
  })

  invalidateTicket({ connectionId: id })

  res.json({ success: true, message: 'Certificado guardado correctamente' })
}))

// Test connection
router.post('/afip-connections/:id/test', authAdmin, checkPermiso('FACTURACION_CONFIG'), asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id)
  const conn = await req.db.afipConnection.findUnique({ where: { id } })
  if (!conn) throw new AppError('Conexión AFIP no encontrada', 404)

  const pasos = []
  let success = false
  let mensaje = ''

  try {
    pasos.push({ paso: 'Configuración', estado: 'ok', detalle: `CUIT ${conn.cuit}, ${conn.environment}` })

    if (!conn.certificadoPath || !conn.clavePrivadaPath) {
      pasos.push({ paso: 'Certificado', estado: 'error', error: 'Falta cert/key' })
      mensaje = 'Falta certificado o clave privada'
    } else {
      pasos.push({ paso: 'Certificado', estado: 'ok' })

      // WSAA
      try {
        invalidateTicket({ connectionId: id })
        const ta = await getTicketAcceso(req.db, { connectionId: id })
        pasos.push({ paso: 'WSAA', estado: 'ok', detalle: `TA expira ${ta.expirationTime}` })

        // WSFE Dummy
        const status = await getServerStatus(req.db, { afipConnectionId: id })
        pasos.push({ paso: 'WSFE', estado: 'ok', detalle: `App:${status.appServer} Db:${status.dbServer} Auth:${status.authServer}` })

        success = true
        mensaje = 'Conexión OK'
      } catch (err) {
        pasos.push({ paso: 'WSAA/WSFE', estado: 'error', error: err.message })
        mensaje = err.message
      }
    }
  } catch (err) {
    mensaje = err.message
  }

  // Persistir resultado del test
  await req.db.afipConnection.update({
    where: { id },
    data: {
      lastTest: new Date(),
      lastTestStatus: success ? 'success' : 'error',
      lastTestMessage: mensaje,
    }
  })

  res.json({ success, mensaje, pasos })
}))

// =============================================================================
// PUNTOS DE VENTA
// =============================================================================

router.get('/puntos-venta', authAdmin, asyncHandler(async (req, res) => {
  const { activo, afipConnectionId } = req.query
  const where = {}
  if (activo !== undefined) where.activo = activo === 'true'
  if (afipConnectionId) where.afipConnectionId = parseInt(afipConnectionId)

  const puntos = await req.db.puntoVenta.findMany({
    where,
    orderBy: [{ esDefault: 'desc' }, { numero: 'asc' }],
    include: {
      afipConnection: { select: { id: true, nombre: true, cuit: true, environment: true } }
    }
  })

  res.json({ success: true, data: puntos })
}))

router.get('/puntos-venta/:id', authAdmin, asyncHandler(async (req, res) => {
  const pv = await req.db.puntoVenta.findUnique({
    where: { id: parseInt(req.params.id) },
    include: { afipConnection: true }
  })
  if (!pv) throw new AppError('Punto de venta no encontrado', 404)
  res.json({ success: true, data: pv })
}))

router.post('/puntos-venta', authAdmin, checkPermiso('FACTURACION_CONFIG'), asyncHandler(async (req, res) => {
  const { numero, nombre, descripcion, afipConnectionId, esDefault, activo } = req.body

  if (!numero || !nombre || !afipConnectionId) {
    throw new AppError('Numero, nombre y conexión AFIP son requeridos', 400)
  }

  const conn = await req.db.afipConnection.findUnique({ where: { id: parseInt(afipConnectionId) } })
  if (!conn) throw new AppError('Conexión AFIP no encontrada', 404)

  if (esDefault) {
    await req.db.puntoVenta.updateMany({
      where: { esDefault: true },
      data: { esDefault: false }
    })
  }

  const pv = await req.db.puntoVenta.create({
    data: {
      numero: parseInt(numero),
      nombre,
      descripcion: descripcion || null,
      afipConnectionId: parseInt(afipConnectionId),
      esDefault: !!esDefault,
      activo: activo !== false,
    },
    include: {
      afipConnection: { select: { id: true, nombre: true, cuit: true } }
    }
  })

  res.status(201).json({ success: true, data: pv })
}))

router.patch('/puntos-venta/:id', authAdmin, checkPermiso('FACTURACION_CONFIG'), asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id)
  const existing = await req.db.puntoVenta.findUnique({ where: { id } })
  if (!existing) throw new AppError('Punto de venta no encontrado', 404)

  const { numero, nombre, descripcion, afipConnectionId, esDefault, activo } = req.body

  if (esDefault) {
    await req.db.puntoVenta.updateMany({
      where: { esDefault: true, NOT: { id } },
      data: { esDefault: false }
    })
  }

  const pv = await req.db.puntoVenta.update({
    where: { id },
    data: {
      ...(numero !== undefined && { numero: parseInt(numero) }),
      ...(nombre !== undefined && { nombre }),
      ...(descripcion !== undefined && { descripcion }),
      ...(afipConnectionId !== undefined && { afipConnectionId: parseInt(afipConnectionId) }),
      ...(esDefault !== undefined && { esDefault }),
      ...(activo !== undefined && { activo }),
    },
    include: {
      afipConnection: { select: { id: true, nombre: true, cuit: true } }
    }
  })

  res.json({ success: true, data: pv })
}))

router.delete('/puntos-venta/:id', authAdmin, checkPermiso('FACTURACION_CONFIG'), asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id)
  const usado = await req.db.movimientoContable.count({ where: { puntoVentaId: id } })
  if (usado > 0) {
    throw new AppError('No se puede eliminar: hay movimientos contables usando este punto de venta. Desactívelo en su lugar.', 400)
  }
  await req.db.puntoVenta.delete({ where: { id } })
  res.json({ success: true, message: 'Punto de venta eliminado' })
}))

export default router
