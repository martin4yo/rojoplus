/**
 * Helper para emitir comprobantes electrónicos AFIP desde el módulo de
 * Ingresos / Movimientos Contables. Reusa los mismos servicios que el buffet:
 *   - afipWSFEService.getLastAuthorizedNumber / requestCAE
 *   - afipWSAAService.getConfiguracionFiscal
 *
 * Convierte la condición IVA del schema (strings: INSCRIPTO, MONOTRIBUTISTA,
 * etc.) a códigos AFIP, calcula el tipo de comprobante según emisor/receptor,
 * pide el CAE y crea el registro de ComprobanteElectronico.
 */

import { getLastAuthorizedNumber, requestCAE } from './afipWSFEService.js'
import { resolverConexionAfip } from './afipWSAAService.js'

// Mapeo de condicionIva (string) → código AFIP
const CONDICION_IVA_AFIP = {
  INSCRIPTO: 1,           // IVA Responsable Inscripto
  MONOTRIBUTISTA: 6,      // Responsable Monotributo
  EXENTO: 4,              // IVA Sujeto Exento
  CONSUMIDOR_FINAL: 5,    // Consumidor Final
  NO_RESPONSABLE: 7,      // IVA No Responsable
}

const TIPO_DOC_AFIP = {
  CUIT: 80,
  CUIL: 86,
  DNI: 96,
  SIN_IDENTIFICAR: 99,
}

const TIPOS_NOMBRE = {
  1: 'FACTURA A', 6: 'FACTURA B', 11: 'FACTURA C',
  2: 'NOTA DE DEBITO A', 7: 'NOTA DE DEBITO B', 12: 'NOTA DE DEBITO C',
  3: 'NOTA DE CREDITO A', 8: 'NOTA DE CREDITO B', 13: 'NOTA DE CREDITO C',
}

/**
 * Decide qué tipo de Factura emitir según condIva del emisor y el receptor.
 * - Emisor Monotributista (o no inscripto) → siempre Factura C
 * - Emisor Resp. Inscripto + Receptor RI/Monotri → Factura A
 * - Emisor Resp. Inscripto + cualquier otro → Factura B
 */
function determinarTipoFactura(condIvaEmisor, condIvaReceptor) {
  if (condIvaEmisor === 'MONOTRIBUTISTA' || condIvaEmisor === 'EXENTO') {
    return 11 // Factura C
  }
  // Emisor Responsable Inscripto
  if (condIvaReceptor === 'INSCRIPTO' || condIvaReceptor === 'MONOTRIBUTISTA') {
    return 1 // Factura A
  }
  return 6 // Factura B
}

/**
 * Emite un comprobante electrónico AFIP (pide CAE) y registra en BD.
 *
 * @param {Object} args
 * @param {Object} args.db            - Prisma client tenant-scoped
 * @param {Object} args.tx            - Transaction client (opcional, sino usa db)
 * @param {string} args.condIvaEmisor - Condición IVA del club
 * @param {Object} args.cliente       - { condicionIva, tipoDoc, documento, nombre }
 * @param {Object} args.totales       - { subtotal, iva21, iva105, total }
 * @param {Array}  args.items         - [{ descripcion, cantidad, precioUnitario, ivaRate }]
 * @param {number} args.puntoVentaNumero   - Nro AFIP del PV
 * @param {number} args.afipConnectionId   - Conexión AFIP a usar
 * @param {number} args.cajaId        - Caja (sólo para auditar en ComprobanteElectronico)
 * @param {number} args.emitidoPor    - admin.id
 * @param {number} args.movimientoContableId - vincular comprobante con movimiento
 * @returns {{ comprobanteElectronico, tipoComprobante, puntoVenta, numero, cae, fechaVtoCae }}
 */
export async function emitirCAEParaFactura({
  db,
  tx,
  condIvaEmisor,
  cliente,
  totales,
  items,
  puntoVentaNumero,
  afipConnectionId,
  cajaId,
  emitidoPor,
  movimientoContableId,
}) {
  const cli = tx || db

  if (!puntoVentaNumero) {
    throw new Error('Falta puntoVentaNumero')
  }

  const puntoVenta = parseInt(puntoVentaNumero)

  // Tipo AFIP
  const tipoAfip = determinarTipoFactura(condIvaEmisor, cliente?.condicionIva)

  // Último número y siguiente
  const ultimoNumero = await getLastAuthorizedNumber(puntoVenta, tipoAfip, { afipConnectionId })
  const numeroComprobante = ultimoNumero + 1

  const fecha = new Date()

  // Pedir CAE
  const resultadoCAE = await requestCAE({
    afipConnectionId,
    puntoVenta,
    tipoComprobante: tipoAfip,
    numeroComprobante,
    fecha,
    tipoDocCliente: cliente?.tipoDoc || TIPO_DOC_AFIP.SIN_IDENTIFICAR,
    docCliente: cliente?.documento || '',
    condicionIvaCliente: CONDICION_IVA_AFIP[cliente?.condicionIva] || 5,
    subtotal: parseFloat(totales.subtotal || 0),
    iva: parseFloat(totales.iva21 || 0) + parseFloat(totales.iva105 || 0),
    total: parseFloat(totales.total),
    items: (items || []).map(i => ({
      descripcion: i.descripcion,
      cantidad: parseFloat(i.cantidad),
      precioUnitario: parseFloat(i.precioUnitario),
      subtotal: parseFloat(i.cantidad) * parseFloat(i.precioUnitario),
      ivaRate: parseFloat(i.ivaRate || 21),
      ivaAmount: 0,
    })),
  })

  if (!resultadoCAE?.cae) {
    throw new Error('AFIP no devolvió CAE: ' + (resultadoCAE?.observaciones || 'sin detalle'))
  }

  // Mapear condicionIva receptor a string para guardar
  const condIvaReceptorTexto = {
    INSCRIPTO: 'IVA Responsable Inscripto',
    MONOTRIBUTISTA: 'Responsable Monotributo',
    EXENTO: 'IVA Sujeto Exento',
    CONSUMIDOR_FINAL: 'Consumidor Final',
    NO_RESPONSABLE: 'IVA No Responsable',
  }[cliente?.condicionIva] || 'Consumidor Final'

  // Crear ComprobanteElectronico
  const comprobanteElectronico = await cli.comprobanteElectronico.create({
    data: {
      tipo: TIPOS_NOMBRE[tipoAfip] || 'FACTURA B',
      tipoAfip,
      puntoVenta,
      numero: numeroComprobante,
      fecha,
      cae: resultadoCAE.cae,
      fechaVtoCae: resultadoCAE.caeExpiration,
      cuitReceptor: cliente?.tipoDoc === TIPO_DOC_AFIP.CUIT ? cliente.documento : null,
      nombreReceptor: cliente?.nombre || 'Consumidor Final',
      condicionIvaReceptor: condIvaReceptorTexto,
      neto: parseFloat(totales.subtotal || 0),
      iva21: parseFloat(totales.iva21 || 0),
      iva105: parseFloat(totales.iva105 || 0),
      total: parseFloat(totales.total),
      cajaId: cajaId || null,
      movimientoContableId: movimientoContableId || null,
      emitidoPor,
      estado: 'EMITIDO',
    },
  })

  // Letra del tipo: 'A' | 'B' | 'C'
  const letras = { 1: 'A', 6: 'B', 11: 'C', 2: 'A', 7: 'B', 12: 'C', 3: 'A', 8: 'B', 13: 'C' }
  const tipoComprobante = letras[tipoAfip] || 'B'

  return {
    comprobanteElectronico,
    tipoComprobante,
    puntoVenta: String(puntoVenta),
    numero: String(numeroComprobante),
    cae: resultadoCAE.cae,
    fechaVtoCae: resultadoCAE.caeExpiration,
  }
}

/**
 * Tipos AFIP de NC: 3=NC A, 8=NC B, 13=NC C
 * Tipos AFIP de ND: 2=ND A, 7=ND B, 12=ND C
 */
const NC_AFIP_DESDE_FACTURA = { 1: 3, 6: 8, 11: 13 }
const ND_AFIP_DESDE_FACTURA = { 1: 2, 6: 7, 11: 12 }

function determinarTipoNC(condIvaEmisor, condIvaReceptor) {
  if (condIvaEmisor === 'MONOTRIBUTISTA' || condIvaEmisor === 'EXENTO') return 13
  if (condIvaReceptor === 'INSCRIPTO' || condIvaReceptor === 'MONOTRIBUTISTA') return 3
  return 8
}

function determinarTipoND(condIvaEmisor, condIvaReceptor) {
  if (condIvaEmisor === 'MONOTRIBUTISTA' || condIvaEmisor === 'EXENTO') return 12
  if (condIvaReceptor === 'INSCRIPTO' || condIvaReceptor === 'MONOTRIBUTISTA') return 2
  return 7
}

/**
 * Emite una Nota de Crédito electrónica.
 *
 * Si se pasa `comprobanteOriginal` (NC por anulación o vinculada a factura),
 * se usa su tipoAfip + puntoVenta y se asocia. Sino se calcula desde condIva.
 *
 * @param {Object} args
 * @param {Object} args.db
 * @param {Object} args.tx                  - Transaction client (opcional)
 * @param {Object} [args.comprobanteOriginal] - ComprobanteElectronico de la factura asociada
 * @param {Object} args.totales             - { subtotal, iva21, iva105, total }
 * @param {Array}  [args.items]             - Items para incluir en el CAE
 * @param {Object} args.cliente             - { condicionIva, tipoDoc, documento, nombre }
 * @param {string} args.condIvaEmisor
 * @param {number} args.cajaId
 * @param {number} args.emitidoPor
 * @param {number} [args.movimientoContableId]
 * @param {string} [args.observaciones]
 */
export async function emitirCAENotaCredito({
  db,
  tx,
  comprobanteOriginal,
  totales,
  items,
  cliente,
  condIvaEmisor,
  puntoVentaNumero,
  afipConnectionId,
  cajaId,
  emitidoPor,
  movimientoContableId,
  observaciones,
}) {
  const cli = tx || db

  // Tipo AFIP de NC
  let tipoAfipNC
  let puntoVenta
  let connId = afipConnectionId
  if (comprobanteOriginal) {
    // NC asociada hereda PV de la factura padre
    tipoAfipNC = NC_AFIP_DESDE_FACTURA[comprobanteOriginal.tipoAfip]
    puntoVenta = comprobanteOriginal.puntoVenta
    if (!tipoAfipNC) throw new Error(`No se puede emitir NC para tipo AFIP ${comprobanteOriginal.tipoAfip}`)
    // Si no vino afipConnectionId explícito, intentar resolverlo desde el PV del comprobante original
    if (!connId) {
      const pv = await cli.puntoVenta.findFirst({ where: { numero: comprobanteOriginal.puntoVenta } })
      if (pv) connId = pv.afipConnectionId
    }
  } else {
    if (!puntoVentaNumero) throw new Error('Falta puntoVentaNumero para NC suelta')
    tipoAfipNC = determinarTipoNC(condIvaEmisor, cliente?.condicionIva)
    puntoVenta = parseInt(puntoVentaNumero)
  }

  // CUIT del emisor (se necesita para comprobantesAsociados)
  const conn = await resolverConexionAfip({ connectionId: connId })

  const ultimoNumero = await getLastAuthorizedNumber(puntoVenta, tipoAfipNC, { afipConnectionId: connId })
  const numero = ultimoNumero + 1
  const fecha = new Date()

  const subtotal = parseFloat(totales.subtotal || 0)
  const iva21 = parseFloat(totales.iva21 || 0)
  const iva105 = parseFloat(totales.iva105 || 0)
  const total = parseFloat(totales.total)

  const requestArgs = {
    afipConnectionId: connId,
    puntoVenta,
    tipoComprobante: tipoAfipNC,
    numeroComprobante: numero,
    fecha,
    tipoDocCliente: cliente?.tipoDoc || 99,
    docCliente: cliente?.documento || '',
    condicionIvaCliente: CONDICION_IVA_AFIP[cliente?.condicionIva] || 5,
    subtotal,
    iva: iva21 + iva105,
    total,
    items: (items || []).map(i => ({
      descripcion: i.descripcion,
      cantidad: parseFloat(i.cantidad),
      precioUnitario: parseFloat(i.precioUnitario),
      subtotal: parseFloat(i.cantidad) * parseFloat(i.precioUnitario),
      ivaRate: parseFloat(i.ivaRate || 21),
      ivaAmount: 0,
    })),
  }

  if (comprobanteOriginal) {
    requestArgs.comprobantesAsociados = [{
      tipo: comprobanteOriginal.tipoAfip,
      puntoVenta: comprobanteOriginal.puntoVenta,
      numero: comprobanteOriginal.numero,
      cuit: conn.cuit,
      fecha: comprobanteOriginal.fecha,
    }]
  }

  const resultadoCAE = await requestCAE(requestArgs)

  if (!resultadoCAE?.cae) {
    throw new Error('AFIP no devolvió CAE para la NC: ' + (resultadoCAE?.observaciones || 'sin detalle'))
  }

  const condIvaReceptorTexto = {
    INSCRIPTO: 'IVA Responsable Inscripto',
    MONOTRIBUTISTA: 'Responsable Monotributo',
    EXENTO: 'IVA Sujeto Exento',
    CONSUMIDOR_FINAL: 'Consumidor Final',
    NO_RESPONSABLE: 'IVA No Responsable',
  }[cliente?.condicionIva] || 'Consumidor Final'

  const observacionesFinal = observaciones || (comprobanteOriginal
    ? `NC por anulación de ${comprobanteOriginal.tipo} ${comprobanteOriginal.puntoVenta}-${comprobanteOriginal.numero}`
    : null)

  const comprobanteElectronico = await cli.comprobanteElectronico.create({
    data: {
      tipo: TIPOS_NOMBRE[tipoAfipNC] || 'NOTA DE CREDITO B',
      tipoAfip: tipoAfipNC,
      puntoVenta,
      numero,
      fecha,
      cae: resultadoCAE.cae,
      fechaVtoCae: resultadoCAE.caeExpiration,
      cuitReceptor: cliente?.tipoDoc === 80 ? cliente.documento : null,
      nombreReceptor: cliente?.nombre || 'Consumidor Final',
      condicionIvaReceptor: condIvaReceptorTexto,
      neto: subtotal,
      iva21,
      iva105,
      total,
      cajaId: cajaId || null,
      movimientoContableId: movimientoContableId || null,
      emitidoPor,
      estado: 'EMITIDO',
      observaciones: observacionesFinal,
    },
  })

  const letras = { 3: 'A', 8: 'B', 13: 'C' }
  const tipoComprobante = letras[tipoAfipNC] || 'B'

  return {
    comprobanteElectronico,
    tipoComprobante,
    puntoVenta: String(puntoVenta),
    numero: String(numero),
    cae: resultadoCAE.cae,
    fechaVtoCae: resultadoCAE.caeExpiration,
  }
}

/**
 * Emite una Nota de Débito electrónica. Funcionamiento simétrico a la NC:
 * con `comprobanteOriginal` se asocia y hereda tipo/PV; sin él se calcula desde condIva.
 *
 * @param {Object} args - mismos que emitirCAENotaCredito
 */
export async function emitirCAENotaDebito({
  db,
  tx,
  comprobanteOriginal,
  totales,
  items,
  cliente,
  condIvaEmisor,
  puntoVentaNumero,
  afipConnectionId,
  cajaId,
  emitidoPor,
  movimientoContableId,
  observaciones,
}) {
  const cli = tx || db

  let tipoAfipND
  let puntoVenta
  let connId = afipConnectionId
  if (comprobanteOriginal) {
    tipoAfipND = ND_AFIP_DESDE_FACTURA[comprobanteOriginal.tipoAfip]
    puntoVenta = comprobanteOriginal.puntoVenta
    if (!tipoAfipND) throw new Error(`No se puede emitir ND para tipo AFIP ${comprobanteOriginal.tipoAfip}`)
    if (!connId) {
      const pv = await cli.puntoVenta.findFirst({ where: { numero: comprobanteOriginal.puntoVenta } })
      if (pv) connId = pv.afipConnectionId
    }
  } else {
    if (!puntoVentaNumero) throw new Error('Falta puntoVentaNumero para ND')
    tipoAfipND = determinarTipoND(condIvaEmisor, cliente?.condicionIva)
    puntoVenta = parseInt(puntoVentaNumero)
  }

  const conn = await resolverConexionAfip({ connectionId: connId })

  const ultimoNumero = await getLastAuthorizedNumber(puntoVenta, tipoAfipND, { afipConnectionId: connId })
  const numero = ultimoNumero + 1
  const fecha = new Date()

  const subtotal = parseFloat(totales.subtotal || 0)
  const iva21 = parseFloat(totales.iva21 || 0)
  const iva105 = parseFloat(totales.iva105 || 0)
  const total = parseFloat(totales.total)

  const requestArgs = {
    afipConnectionId: connId,
    puntoVenta,
    tipoComprobante: tipoAfipND,
    numeroComprobante: numero,
    fecha,
    tipoDocCliente: cliente?.tipoDoc || 99,
    docCliente: cliente?.documento || '',
    condicionIvaCliente: CONDICION_IVA_AFIP[cliente?.condicionIva] || 5,
    subtotal,
    iva: iva21 + iva105,
    total,
    items: (items || []).map(i => ({
      descripcion: i.descripcion,
      cantidad: parseFloat(i.cantidad),
      precioUnitario: parseFloat(i.precioUnitario),
      subtotal: parseFloat(i.cantidad) * parseFloat(i.precioUnitario),
      ivaRate: parseFloat(i.ivaRate || 21),
      ivaAmount: 0,
    })),
  }

  if (comprobanteOriginal) {
    requestArgs.comprobantesAsociados = [{
      tipo: comprobanteOriginal.tipoAfip,
      puntoVenta: comprobanteOriginal.puntoVenta,
      numero: comprobanteOriginal.numero,
      cuit: conn.cuit,
      fecha: comprobanteOriginal.fecha,
    }]
  }

  const resultadoCAE = await requestCAE(requestArgs)

  if (!resultadoCAE?.cae) {
    throw new Error('AFIP no devolvió CAE para la ND: ' + (resultadoCAE?.observaciones || 'sin detalle'))
  }

  const condIvaReceptorTexto = {
    INSCRIPTO: 'IVA Responsable Inscripto',
    MONOTRIBUTISTA: 'Responsable Monotributo',
    EXENTO: 'IVA Sujeto Exento',
    CONSUMIDOR_FINAL: 'Consumidor Final',
    NO_RESPONSABLE: 'IVA No Responsable',
  }[cliente?.condicionIva] || 'Consumidor Final'

  const comprobanteElectronico = await cli.comprobanteElectronico.create({
    data: {
      tipo: TIPOS_NOMBRE[tipoAfipND] || 'NOTA DE DEBITO B',
      tipoAfip: tipoAfipND,
      puntoVenta,
      numero,
      fecha,
      cae: resultadoCAE.cae,
      fechaVtoCae: resultadoCAE.caeExpiration,
      cuitReceptor: cliente?.tipoDoc === 80 ? cliente.documento : null,
      nombreReceptor: cliente?.nombre || 'Consumidor Final',
      condicionIvaReceptor: condIvaReceptorTexto,
      neto: subtotal,
      iva21,
      iva105,
      total,
      cajaId: cajaId || null,
      movimientoContableId: movimientoContableId || null,
      emitidoPor,
      estado: 'EMITIDO',
      observaciones: observaciones || null,
    },
  })

  const letras = { 2: 'A', 7: 'B', 12: 'C' }
  const tipoComprobante = letras[tipoAfipND] || 'B'

  return {
    comprobanteElectronico,
    tipoComprobante,
    puntoVenta: String(puntoVenta),
    numero: String(numero),
    cae: resultadoCAE.cae,
    fechaVtoCae: resultadoCAE.caeExpiration,
  }
}
