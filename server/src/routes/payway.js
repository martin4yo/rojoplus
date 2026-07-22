import { Router } from 'express'
import { authAdmin } from '../middleware/auth.js'
import { enviarNotificacionesRecibo } from './debitoAutomatico.js'
import {
  tokenizarTarjeta,
  cobrarConToken,
  consultarPago,
  verificarWebhook
} from '../services/paywayService.js'

const router = Router()

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)

// ============================================
// HELPERS
// ============================================

async function obtenerConfigPayway(db, configuracionId, tenantId) {
  const config = await db.configuracionDebito.findFirst({
    where: {
      id: parseInt(configuracionId),
      tenantId,
      procesador: { plataforma: 'PAYWAY' }
    }
  })
  if (!config) throw new Error('Configuración Payway no encontrada')
  if (!config.apiKey) throw new Error('Falta la private key de Payway en la configuración')
  return config
}

async function obtenerCajaDebito(tx) {
  let caja = await tx.caja.findFirst({ where: { codigo: 'DEBITO_AUTO', activo: true } })
  if (!caja) caja = await tx.caja.findFirst({ where: { tipo: 'BANCO', requiereConciliacion: true, activo: true } })
  if (!caja) {
    caja = await tx.caja.create({
      data: {
        codigo: 'DEBITO_AUTO',
        nombre: 'Tarjetas Pendientes de Acreditar',
        tipo: 'VALORES_PENDIENTES',
        descripcion: 'Cobranzas con tarjeta pendientes de acreditación',
        saldoInicial: 0,
        saldoActual: 0,
        requiereConciliacion: true,
        activo: true
      }
    })
  }
  return caja
}

async function obtenerMedioPagoDebito(tx) {
  let mp = await tx.medioPago.findFirst({
    where: { OR: [{ nombre: 'DEBITO AUTOMATICO' }, { codigo: 'DEBITO_AUTO' }] }
  })
  if (!mp) {
    mp = await tx.medioPago.create({
      data: { codigo: 'DEBITO_AUTO', nombre: 'Débito Automático', tipo: 'BANCO', estado: 'ACTIVO', orden: 10 }
    })
  }
  return mp.id
}

async function aplicarPagoACargos({ tx, socioId, archivoId, monto, medioPagoId, caja, adminId, tenantId, descripcion }) {
  const cargos = await tx.cargo.findMany({
    where: { socioId, incluidoEnDebitoId: archivoId, saldo: { gt: 0 } },
    include: { conceptoTesoreria: true },
  })
  if (cargos.length === 0) return null

  const ultimosPagos = await tx.pago.findMany({
    orderBy: { id: 'desc' },
    select: { numero: true },
    take: 100,
  })
  const ultimoNumeroValido = ultimosPagos
    .map(p => parseInt(p.numero, 10))
    .filter(n => Number.isFinite(n) && n > 0)
    .reduce((max, n) => Math.max(max, n), 0)
  const nuevoNumero = String(ultimoNumeroValido + 1).padStart(8, '0')

  const pago = await tx.pago.create({
    data: {
      numero: nuevoNumero,
      socioId,
      fecha: new Date(),
      montoTotal: monto,
      montoRecibido: monto,
      montoACuenta: 0,
      medioPagoId,
      cajaId: caja.id,
      origen: 'DEBITO_AUTOMATICO',
      observaciones: descripcion,
      registradoPor: adminId,
      tenantId
    }
  })

  const anio = new Date().getFullYear()
  const prefijo = `MV-${anio}-`
  const ultimoMov = await tx.movimientoCaja.findFirst({
    where: { numero: { startsWith: prefijo } },
    orderBy: { numero: 'desc' }
  })
  const sig = ultimoMov ? (parseInt(ultimoMov.numero.split('-').pop()) || 0) + 1 : 1
  const nroMov = `${prefijo}${String(sig).padStart(5, '0')}`

  const movPW = await tx.movimientoCaja.create({
    data: {
      numero: nroMov,
      cajaId: caja.id,
      cuentaContableId: caja.cuentaContableId,
      fecha: new Date(),
      tipo: 'INGRESO',
      concepto: 'Débito Automático Payway',
      monto,
      descripcion,
      pagoId: pago.id,
      registradoPor: adminId,
      centroCostoId: caja.centroCostoId ?? null,
      conciliado: !caja.requiereConciliacion,
      tenantId
    }
  })

  // ItemMovimientoCaja — un ítem por concepto de cargo
  const gruposPW = {}
  for (const c of cargos) {
    const key = c.conceptoTesoreriaId ?? 'sin'
    if (!gruposPW[key]) {
      gruposPW[key] = {
        conceptoTesoreriaId: c.conceptoTesoreriaId,
        cuentaContableId: c.conceptoTesoreria?.cuentaContableId ?? caja.cuentaContableId,
        centroCostoId: c.centroCostoId ?? caja.centroCostoId ?? null,
        monto: 0,
      }
    }
    gruposPW[key].monto += Number(c.saldo)
  }
  const gruposPWArr = Object.values(gruposPW)
  if (gruposPWArr.length > 0) {
    const totalPW = gruposPWArr.reduce((s, g) => s + g.monto, 0)
    let montoAsigPW = 0
    for (let i = 0; i < gruposPWArr.length; i++) {
      const g = gruposPWArr[i]
      if (!g.cuentaContableId) continue
      const esUltimo = i === gruposPWArr.length - 1
      const montoItem = esUltimo
        ? Math.round((monto - montoAsigPW) * 100) / 100
        : Math.round(monto * (totalPW > 0 ? g.monto / totalPW : 1 / gruposPWArr.length) * 100) / 100
      if (montoItem <= 0) continue
      montoAsigPW += montoItem
      await tx.itemMovimientoCaja.create({
        data: {
          movimientoCajaId: movPW.id,
          conceptoTesoreriaId: g.conceptoTesoreriaId,
          cuentaContableId: g.cuentaContableId,
          centroCostoId: g.centroCostoId,
          monto: montoItem,
          descripcion,
          orden: i,
        },
      })
    }
  }

  await tx.caja.update({ where: { id: caja.id }, data: { saldoActual: { increment: monto } } })

  let montoRestante = monto
  for (const cargo of cargos) {
    if (montoRestante <= 0) break
    const saldoCargo = parseFloat(cargo.saldo) + parseFloat(cargo.recargo || 0)
    const aplicar = Math.min(montoRestante, saldoCargo)
    await tx.cargo.update({
      where: { id: cargo.id },
      data: {
        pagoId: pago.id,
        estado: aplicar >= saldoCargo ? 'PAGADO' : 'PARCIAL',
        saldo: parseFloat(cargo.saldo) - Math.min(montoRestante, parseFloat(cargo.saldo)),
        recargo: 0,
        fechaPago: aplicar >= saldoCargo ? new Date() : null
      }
    })
    montoRestante -= aplicar
  }

  return pago.id
}

// ============================================
// TOKENIZACIÓN
// ============================================

// POST /api/admin/payway/tokenizar-tarjeta
// Tokeniza los datos de tarjeta de un socio usando la public key de Payway.
// En sandbox es server-side. En prod debe hacerse client-side con el widget JS.
router.post('/tokenizar-tarjeta', authAdmin, asyncHandler(async (req, res) => {
  const { socioId, numero, vencimiento, titular, cvv, marca, configuracionId } = req.body

  if (!socioId || !numero || !vencimiento || !titular || !marca || !configuracionId) {
    return res.status(400).json({ error: 'Faltan datos de tarjeta o configuración' })
  }

  const config = await obtenerConfigPayway(req.db, configuracionId, req.tenantId)

  const resultado = await tokenizarTarjeta({
    numero, vencimiento, titular, cvv, marca, configuracion: config
  })

  // Guardar token en el socio
  await req.db.socio.update({
    where: { id: parseInt(socioId) },
    data: {
      tarjetaToken: resultado.token,
      tarjetaTokenizador: 'PAYWAY',
      tarjetaMarca: marca,
      tarjetaUltimos4: resultado.ultimosCuatro,
      tarjetaVencimiento: vencimiento
    }
  })

  res.json({
    success: true,
    token: resultado.token,
    ultimosCuatro: resultado.ultimosCuatro,
    marca
  })
}))

// ============================================
// COBRO EN LOTE
// ============================================

// POST /api/admin/payway/cobrar-lote/:archivoId
// Procesa todos los DetalleDebito PENDIENTE del archivo llamando a la API de Payway.
// A diferencia de PRISMA, la respuesta es inmediata por detalle.
router.post('/cobrar-lote/:archivoId', authAdmin, asyncHandler(async (req, res) => {
  const { archivoId } = req.params
  const { configuracionId } = req.body

  if (!configuracionId) {
    return res.status(400).json({ error: 'Se requiere configuracionId' })
  }

  const config = await obtenerConfigPayway(req.db, configuracionId, req.tenantId)

  const archivo = await req.db.archivoDebito.findFirst({
    where: { id: parseInt(archivoId), tenantId: req.tenantId },
    include: {
      detalles: {
        where: { estado: 'PENDIENTE' },
        include: {
          socio: {
            select: {
              id: true,
              nroSocio: true,
              apellidoNombre: true,
              tarjetaToken: true,
              tarjetaTokenizador: true,
              tarjetaMarca: true,
              tarjetaUltimos4: true
            }
          }
        }
      }
    }
  })

  if (!archivo) return res.status(404).json({ error: 'Archivo no encontrado' })
  if (archivo.detalles.length === 0) {
    return res.status(400).json({ error: 'No hay detalles pendientes en este archivo' })
  }

  // Verificar que todos tienen token Payway
  const sinToken = archivo.detalles.filter(d => !d.socio.tarjetaToken || d.socio.tarjetaTokenizador !== 'PAYWAY')
  if (sinToken.length > 0) {
    return res.status(422).json({
      error: `${sinToken.length} socio(s) no tienen tarjeta tokenizada en Payway`,
      socios: sinToken.map(d => ({ id: d.socio.id, nombre: d.socio.apellidoNombre }))
    })
  }

  // Generar número de importación
  const ultimaImp = await req.db.importacionCobranza.findFirst({
    where: { tenantId: req.tenantId }, orderBy: { numero: 'desc' }
  })
  const sec = ultimaImp ? parseInt(ultimaImp.numero.split('-').pop()) + 1 : 1
  const nroImportacion = `IMP-${new Date().getFullYear()}-${String(sec).padStart(4, '0')}`

  const resultados = []

  // Cobrar uno a uno (Payway no tiene batch API)
  for (const detalle of archivo.detalles) {
    const { socio } = detalle
    const monto = parseFloat(detalle.importeEnviado)
    const descripcion = `Cuota ${String(archivo.periodoMes).padStart(2,'0')}/${archivo.periodoAnio} - ${socio.apellidoNombre}`
    const referencia = `CLB-${config.codigoComercio}-${archivo.id}-${detalle.id}`

    let resultadoPago
    try {
      resultadoPago = await cobrarConToken({
        token: socio.tarjetaToken,
        monto,
        socioId: socio.id,
        descripcion,
        marca: socio.tarjetaMarca,
        configuracion: config,
        referencia
      })
    } catch (err) {
      resultadoPago = {
        paywayId: null,
        estado: 'RECHAZADO',
        monto,
        codigoRechazo: 'ERR',
        motivoRechazo: err.message,
        autorizacion: null
      }
    }

    resultados.push({ detalle, socio, resultadoPago })
  }

  // Procesar en transacción
  const medioPagoId = await req.db.$transaction(async (tx) => obtenerMedioPagoDebito(tx))
  const caja = await req.db.$transaction(async (tx) => obtenerCajaDebito(tx))

  const pagosIds = []

  await req.db.$transaction(async (tx) => {
    const cobrados = resultados.filter(r => r.resultadoPago.estado === 'COBRADO')
    const rechazados = resultados.filter(r => r.resultadoPago.estado !== 'COBRADO')

    // Crear registro de importación
    await tx.importacionCobranza.create({
      data: {
        archivoDebitoId: parseInt(archivoId),
        numero: nroImportacion,
        tipo: 'PAYWAY',
        nombreArchivo: `PAYWAY-${archivo.numero}`,
        registrosTotales: resultados.length,
        registrosCobrados: cobrados.length,
        registrosRechazados: rechazados.length,
        montoCobrado: cobrados.reduce((s, r) => s + r.resultadoPago.monto, 0),
        importadoPor: req.admin.id,
        tenantId: req.tenantId
      }
    })

    for (const { detalle, socio, resultadoPago } of resultados) {
      // Actualizar detalle
      await tx.detalleDebito.update({
        where: { id: detalle.id },
        data: {
          estado: resultadoPago.estado === 'COBRADO' ? 'COBRADO' : 'RECHAZADO',
          codigoRechazo: resultadoPago.codigoRechazo || null,
          motivoRechazo: resultadoPago.motivoRechazo || null,
          fechaProceso: new Date()
        }
      })

      if (resultadoPago.estado === 'COBRADO') {
        const pagoId = await aplicarPagoACargos({
          tx,
          socioId: socio.id,
          archivoId: parseInt(archivoId),
          monto: resultadoPago.monto,
          medioPagoId,
          caja,
          adminId: req.admin.id,
          tenantId: req.tenantId,
          descripcion: `Payway ${resultadoPago.autorizacion ? `Aut: ${resultadoPago.autorizacion}` : ''} - ${archivo.numero}`
        })
        if (pagoId) pagosIds.push(pagoId)
      }
    }

    // Marcar archivo como procesado si no quedan pendientes
    const pendientes = await tx.detalleDebito.count({
      where: { archivoId: parseInt(archivoId), estado: 'PENDIENTE' }
    })
    if (pendientes === 0) {
      await tx.archivoDebito.update({
        where: { id: parseInt(archivoId) },
        data: { estado: 'PROCESADO', fechaProceso: new Date() }
      })
    }
  })

  // Notificaciones fuera de la transacción
  const notifStats = await enviarNotificacionesRecibo(pagosIds, req.db)

  const cobrados = resultados.filter(r => r.resultadoPago.estado === 'COBRADO')
  const rechazados = resultados.filter(r => r.resultadoPago.estado !== 'COBRADO')

  res.json({
    resumen: {
      total: resultados.length,
      cobrados: cobrados.length,
      rechazados: rechazados.length,
      montoCobrado: cobrados.reduce((s, r) => s + r.resultadoPago.monto, 0),
      notificaciones: notifStats
    },
    detalles: resultados.map(r => ({
      socioId: r.socio.id,
      nombre: r.socio.apellidoNombre,
      tarjeta: `****${r.socio.tarjetaUltimos4 || '****'}`,
      importe: r.resultadoPago.monto,
      estado: r.resultadoPago.estado,
      autorizacion: r.resultadoPago.autorizacion,
      codigoRechazo: r.resultadoPago.codigoRechazo,
      motivoRechazo: r.resultadoPago.motivoRechazo,
      paywayId: r.resultadoPago.paywayId
    }))
  })
}))

// ============================================
// WEBHOOK
// ============================================

// POST /api/payway/webhook
// Recibe notificaciones async de Payway (pagos que cambian de estado).
router.post('/webhook', asyncHandler(async (req, res) => {
  const payload = req.body

  // Identificar tenant por site_id en el payload
  const siteId = payload?.site?.id || payload?.data?.site?.id
  if (!siteId) {
    return res.status(400).json({ error: 'Payload sin site_id' })
  }

  // Buscar configuración por site_id (codigoComercio) en cualquier tenant
  const config = await req.db.configuracionDebito.findFirst({
    where: { codigoComercio: String(siteId), procesador: { plataforma: 'PAYWAY' } }
  })

  if (!config) {
    console.warn(`[Payway Webhook] site_id ${siteId} no encontrado en configuraciones`)
    return res.status(200).json({ received: true }) // 200 para que Payway no reintente
  }

  if (!verificarWebhook(req.headers, payload, siteId)) {
    return res.status(401).json({ error: 'Webhook inválido' })
  }

  const tipo = payload.type || payload.event_type
  const paywayId = payload?.data?.id || payload?.id

  if (!paywayId) return res.status(200).json({ received: true })

  // Buscar si hay un detalle de débito con este referencia
  // La referencia tiene formato CLB-{siteId}-{archivoId}-{detalleId}
  const siteTransactionId = payload?.data?.site_transaction_id || payload?.site_transaction_id
  if (siteTransactionId) {
    const partes = siteTransactionId.split('-')
    const detalleId = parseInt(partes[partes.length - 1])

    if (!isNaN(detalleId)) {
      const detalle = await req.db.detalleDebito.findUnique({ where: { id: detalleId } })

      if (detalle && detalle.estado === 'PENDIENTE') {
        const estadoPayway = payload?.data?.status || payload?.status
        const nuevoEstado = estadoPayway === 'approved' ? 'COBRADO' :
                           estadoPayway === 'rejected' ? 'RECHAZADO' : null

        if (nuevoEstado) {
          await req.db.detalleDebito.update({
            where: { id: detalleId },
            data: {
              estado: nuevoEstado,
              fechaProceso: new Date(),
              motivoRechazo: nuevoEstado === 'RECHAZADO'
                ? (payload?.data?.status_details?.denied_reason || 'Rechazado por Payway')
                : null
            }
          })
          console.log(`[Payway Webhook] Detalle ${detalleId} actualizado a ${nuevoEstado}`)
        }
      }
    }
  }

  res.status(200).json({ received: true })
}))

// ============================================
// CONSULTAR ESTADO DE PAGO
// ============================================

// GET /api/admin/payway/pago/:paywayId?configuracionId=X
router.get('/pago/:paywayId', authAdmin, asyncHandler(async (req, res) => {
  const { paywayId } = req.params
  const { configuracionId } = req.query

  const config = await obtenerConfigPayway(req.db, configuracionId, req.tenantId)
  const resultado = await consultarPago({ paywayId, configuracion: config })

  res.json(resultado)
}))

// ============================================
// LISTAR CONFIGURACIONES PAYWAY DEL TENANT
// ============================================

router.get('/configuraciones', authAdmin, asyncHandler(async (req, res) => {
  const configs = await req.db.configuracionDebito.findMany({
    where: { tenantId: req.tenantId, procesador: { plataforma: 'PAYWAY' }, activo: true },
    include: { procesador: true }
  })
  res.json({ success: true, data: configs })
}))

export default router
