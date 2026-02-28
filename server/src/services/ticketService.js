/**
 * Servicio de generación de tickets para impresoras térmicas 80mm
 * Genera comandos ESC/POS para impresión directa
 *
 * Tipos de ticket:
 * - Ticket fiscal (con CAE y QR de ARCA)
 * - Ticket no fiscal (sin datos de facturación)
 */

import { generateQRContent } from './afipQRService.js'

// Comandos ESC/POS básicos
const ESC = '\x1B'
const GS = '\x1D'

const ESCPOS = {
  INIT: ESC + '@',
  ALIGN_LEFT: ESC + 'a' + '\x00',
  ALIGN_CENTER: ESC + 'a' + '\x01',
  ALIGN_RIGHT: ESC + 'a' + '\x02',
  BOLD_ON: ESC + 'E' + '\x01',
  BOLD_OFF: ESC + 'E' + '\x00',
  DOUBLE_HEIGHT: GS + '!' + '\x01',
  DOUBLE_WIDTH: GS + '!' + '\x10',
  DOUBLE_SIZE: GS + '!' + '\x11',
  NORMAL_SIZE: GS + '!' + '\x00',
  UNDERLINE_ON: ESC + '-' + '\x01',
  UNDERLINE_OFF: ESC + '-' + '\x00',
  CUT: GS + 'V' + '\x00',
  PARTIAL_CUT: GS + 'V' + '\x01',
  FEED_LINES: (n) => ESC + 'd' + String.fromCharCode(n),
  QR_SIZE: GS + '(k' + '\x03\x00\x31\x43' + '\x06', // Tamaño QR (6)
  QR_ERROR: GS + '(k' + '\x03\x00\x31\x45\x30', // Error correction L
  QR_STORE: (data) => {
    const len = data.length + 3
    return GS + '(k' + String.fromCharCode(len % 256) + String.fromCharCode(Math.floor(len / 256)) + '\x31\x50\x30' + data
  },
  QR_PRINT: GS + '(k' + '\x03\x00\x31\x51\x30'
}

/**
 * Genera línea de separación
 */
function separator(char = '-', width = 42) {
  return char.repeat(width)
}

/**
 * Formatea precio con símbolo de pesos
 */
function formatPrice(amount) {
  return `$${Number(amount).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Formatea fecha para ticket
 */
function formatDate(date) {
  const d = new Date(date)
  return d.toLocaleDateString('es-AR') + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Formatea línea de item con descripción y precio alineados
 */
function formatItemLine(description, price, width = 42) {
  const priceStr = formatPrice(price)
  const maxDesc = width - priceStr.length - 1
  const desc = description.length > maxDesc ? description.substring(0, maxDesc) : description
  const spaces = width - desc.length - priceStr.length
  return desc + ' '.repeat(Math.max(1, spaces)) + priceStr
}

/**
 * Formatea línea con label y valor alineados a la derecha
 */
function formatLabelValue(label, value, width = 42) {
  const spaces = width - label.length - value.length
  return label + ' '.repeat(Math.max(1, spaces)) + value
}

/**
 * Genera ticket fiscal con CAE y QR de ARCA
 *
 * @param {Object} data - Datos del ticket
 * @param {Object} data.empresa - Datos del emisor
 * @param {Object} data.comprobante - Datos del comprobante fiscal
 * @param {Object} data.comanda - Datos de la comanda
 * @param {Array} data.items - Items del ticket
 */
export function renderTicketFiscal(data) {
  const { empresa, comprobante, comanda, items } = data
  let output = ''

  // Inicialización
  output += ESCPOS.INIT

  // ========== ENCABEZADO EMPRESA ==========
  output += ESCPOS.ALIGN_CENTER
  output += ESCPOS.BOLD_ON
  output += ESCPOS.DOUBLE_SIZE
  output += (empresa.razonSocial || 'CLUB SPORTIVO PILAR') + '\n'
  output += ESCPOS.NORMAL_SIZE
  output += ESCPOS.BOLD_OFF

  output += (empresa.domicilio || empresa.domicilioFiscal || '') + '\n'
  output += `CUIT: ${empresa.cuit || ''}\n`
  output += `${empresa.condicionIva || 'IVA Responsable Inscripto'}\n`

  output += separator('=') + '\n'

  // ========== TIPO DE COMPROBANTE ==========
  output += ESCPOS.BOLD_ON
  output += ESCPOS.DOUBLE_HEIGHT
  output += `${comprobante.tipo || 'FACTURA C'}\n`
  output += ESCPOS.NORMAL_SIZE
  output += ESCPOS.BOLD_OFF

  output += `Punto Venta: ${String(comprobante.puntoVenta).padStart(4, '0')} - `
  output += `Nro: ${String(comprobante.numero).padStart(8, '0')}\n`
  output += `Fecha: ${formatDate(comprobante.fecha)}\n`

  output += separator() + '\n'

  // ========== DATOS CLIENTE ==========
  output += ESCPOS.ALIGN_LEFT
  if (comprobante.nombreCliente && comprobante.nombreCliente !== 'Consumidor Final') {
    output += `Cliente: ${comprobante.nombreCliente}\n`
  }
  if (comprobante.docCliente && comprobante.tipoDocCliente !== 99) {
    const tipoDoc = comprobante.tipoDocCliente === 80 ? 'CUIT' : comprobante.tipoDocCliente === 96 ? 'DNI' : 'Doc'
    output += `${tipoDoc}: ${comprobante.docCliente}\n`
  }
  if (comprobante.condicionIvaCliente) {
    output += `IVA: ${comprobante.condicionIvaCliente}\n`
  }

  output += separator() + '\n'

  // ========== ITEMS ==========
  output += ESCPOS.BOLD_ON
  output += 'DESCRIPCION                         IMPORTE\n'
  output += ESCPOS.BOLD_OFF
  output += separator('-') + '\n'

  items.forEach(item => {
    const cantidad = item.cantidad || 1
    const nombre = item.nombre || item.descripcion || 'Producto'
    const subtotal = item.subtotal || (cantidad * (item.precioUnitario || item.precio || 0))

    if (cantidad > 1) {
      output += `${cantidad} x ${nombre}\n`
      output += formatItemLine('', subtotal) + '\n'
    } else {
      output += formatItemLine(nombre, subtotal) + '\n'
    }
  })

  output += separator('=') + '\n'

  // ========== TOTALES ==========
  output += ESCPOS.BOLD_ON

  // Si discrimina IVA (Factura A/B)
  if (comprobante.subtotal && comprobante.iva && comprobante.tipoAfip !== 11) {
    output += formatLabelValue('Subtotal:', formatPrice(comprobante.subtotal)) + '\n'
    output += formatLabelValue('IVA 21%:', formatPrice(comprobante.iva)) + '\n'
  }

  output += ESCPOS.DOUBLE_SIZE
  output += formatLabelValue('TOTAL:', formatPrice(comprobante.total)) + '\n'
  output += ESCPOS.NORMAL_SIZE
  output += ESCPOS.BOLD_OFF

  output += separator() + '\n'

  // ========== FORMA DE PAGO ==========
  output += ESCPOS.ALIGN_LEFT
  const metodoPago = comanda?.metodoPago || comprobante.metodoPago || 'EFECTIVO'
  output += `Forma de pago: ${metodoPago.toUpperCase()}\n`

  output += separator() + '\n'

  // ========== CAE ==========
  output += ESCPOS.ALIGN_CENTER
  output += ESCPOS.BOLD_ON
  output += `CAE: ${comprobante.cae}\n`
  output += `Vto CAE: ${formatDate(comprobante.fechaVtoCae).split(' ')[0]}\n`
  output += ESCPOS.BOLD_OFF

  // ========== QR CODE ==========
  const qrUrl = generateQRContent(comprobante)
  if (qrUrl) {
    output += '\n'
    output += ESCPOS.ALIGN_CENTER
    output += ESCPOS.QR_SIZE
    output += ESCPOS.QR_ERROR
    output += ESCPOS.QR_STORE(qrUrl)
    output += ESCPOS.QR_PRINT
    output += '\n'
    output += 'Escanear QR para validar\n'
  }

  // ========== PIE ==========
  output += '\n'
  output += separator() + '\n'
  output += ESCPOS.ALIGN_CENTER
  output += 'Gracias por su visita!\n'
  output += 'www.clubsportivopi lar.com.ar\n'

  // Corte de papel
  output += ESCPOS.FEED_LINES(4)
  output += ESCPOS.PARTIAL_CUT

  return output
}

/**
 * Genera ticket NO fiscal (sin CAE, para uso interno)
 *
 * @param {Object} data - Datos del ticket
 * @param {Object} data.empresa - Datos del emisor
 * @param {Object} data.comanda - Datos de la comanda
 * @param {Array} data.items - Items del ticket
 */
export function renderTicketNoFiscal(data) {
  const { empresa, comanda, items } = data
  let output = ''

  // Inicialización
  output += ESCPOS.INIT

  // ========== ENCABEZADO EMPRESA ==========
  output += ESCPOS.ALIGN_CENTER
  output += ESCPOS.BOLD_ON
  output += ESCPOS.DOUBLE_SIZE
  output += (empresa?.razonSocial || 'CLUB SPORTIVO PILAR') + '\n'
  output += ESCPOS.NORMAL_SIZE
  output += ESCPOS.BOLD_OFF

  output += separator('=') + '\n'

  // ========== TIPO DE DOCUMENTO ==========
  output += ESCPOS.BOLD_ON
  output += ESCPOS.DOUBLE_HEIGHT
  output += 'TICKET NO FISCAL\n'
  output += ESCPOS.NORMAL_SIZE
  output += ESCPOS.BOLD_OFF

  output += `Nro: ${comanda.numero || comanda.id}\n`
  output += `Fecha: ${formatDate(comanda.fechaCobro || comanda.createdAt || new Date())}\n`

  // Origen
  if (comanda.origen) {
    output += `Origen: ${comanda.origen.toUpperCase()}\n`
  }
  if (comanda.mesa) {
    output += `Mesa: ${comanda.mesa.numero || comanda.mesa}\n`
  }

  output += separator() + '\n'

  // ========== ITEMS ==========
  output += ESCPOS.ALIGN_LEFT
  output += ESCPOS.BOLD_ON
  output += 'DESCRIPCION                         IMPORTE\n'
  output += ESCPOS.BOLD_OFF
  output += separator('-') + '\n'

  let subtotal = 0
  items.forEach(item => {
    const cantidad = item.cantidad || 1
    const nombre = item.nombre || item.descripcion || item.producto?.nombre || 'Producto'
    const precio = item.precioUnitario || item.precio || item.producto?.precio || 0
    const itemSubtotal = item.subtotal || (cantidad * precio)
    subtotal += itemSubtotal

    if (cantidad > 1) {
      output += `${cantidad} x ${nombre}\n`
      output += `   ${formatPrice(precio)} c/u\n`
      output += formatItemLine('', itemSubtotal) + '\n'
    } else {
      output += formatItemLine(nombre, itemSubtotal) + '\n'
    }
  })

  output += separator('=') + '\n'

  // ========== TOTALES ==========
  output += ESCPOS.BOLD_ON
  output += ESCPOS.DOUBLE_SIZE
  output += formatLabelValue('TOTAL:', formatPrice(comanda.total || subtotal)) + '\n'
  output += ESCPOS.NORMAL_SIZE
  output += ESCPOS.BOLD_OFF

  output += separator() + '\n'

  // ========== FORMA DE PAGO ==========
  const metodoPago = comanda.metodoPago || 'EFECTIVO'
  output += `Forma de pago: ${metodoPago.toUpperCase()}\n`

  if (comanda.cajero || comanda.cobradoPor) {
    output += `Cajero: ${comanda.cajero || comanda.cobradoPor}\n`
  }

  // ========== AVISO NO FISCAL ==========
  output += '\n'
  output += separator() + '\n'
  output += ESCPOS.ALIGN_CENTER
  output += ESCPOS.BOLD_ON
  output += '** DOCUMENTO NO VALIDO COMO FACTURA **\n'
  output += ESCPOS.BOLD_OFF
  output += '\n'
  output += 'Gracias por su visita!\n'

  // Corte de papel
  output += ESCPOS.FEED_LINES(4)
  output += ESCPOS.PARTIAL_CUT

  return output
}

/**
 * Genera ticket de comanda para cocina/barra
 *
 * @param {Object} data - Datos del ticket
 * @param {Object} data.comanda - Datos de la comanda
 * @param {Array} data.items - Items del ticket
 * @param {string} data.destino - Destino (COCINA, BARRA)
 */
export function renderTicketComanda(data) {
  const { comanda, items, destino } = data
  let output = ''

  // Inicialización
  output += ESCPOS.INIT

  // ========== ENCABEZADO ==========
  output += ESCPOS.ALIGN_CENTER
  output += ESCPOS.BOLD_ON
  output += ESCPOS.DOUBLE_SIZE
  output += `*** ${destino || 'COCINA'} ***\n`
  output += ESCPOS.NORMAL_SIZE

  output += separator('=') + '\n'

  // ========== DATOS COMANDA ==========
  output += ESCPOS.DOUBLE_HEIGHT
  if (comanda.mesa) {
    output += `MESA ${comanda.mesa.numero || comanda.mesa}\n`
  } else if (comanda.origen === 'BARRA') {
    output += 'BARRA\n'
  } else if (comanda.origen === 'TAKEAWAY') {
    output += 'TAKEAWAY\n'
  } else if (comanda.origen === 'KIOSCO') {
    output += 'KIOSCO\n'
  }
  output += ESCPOS.NORMAL_SIZE

  output += `Comanda #${comanda.numero || comanda.id}\n`
  output += `${formatDate(comanda.createdAt || new Date())}\n`

  if (comanda.mozo || comanda.creadoPor) {
    output += `Mozo: ${comanda.mozo || comanda.creadoPor}\n`
  }

  output += separator() + '\n'

  // ========== ITEMS ==========
  output += ESCPOS.ALIGN_LEFT
  output += ESCPOS.DOUBLE_HEIGHT

  items.forEach(item => {
    const cantidad = item.cantidad || 1
    const nombre = item.nombre || item.descripcion || item.producto?.nombre || 'Producto'

    output += `${cantidad}x ${nombre.toUpperCase()}\n`

    if (item.notas || item.observaciones) {
      output += ESCPOS.NORMAL_SIZE
      output += `   >> ${item.notas || item.observaciones}\n`
      output += ESCPOS.DOUBLE_HEIGHT
    }
  })

  output += ESCPOS.NORMAL_SIZE
  output += separator('=') + '\n'

  // ========== NOTAS GENERALES ==========
  if (comanda.notas || comanda.observaciones) {
    output += ESCPOS.ALIGN_CENTER
    output += ESCPOS.BOLD_ON
    output += 'NOTAS:\n'
    output += ESCPOS.BOLD_OFF
    output += comanda.notas || comanda.observaciones
    output += '\n'
  }

  // Corte de papel
  output += ESCPOS.FEED_LINES(3)
  output += ESCPOS.PARTIAL_CUT

  return output
}

/**
 * Genera ticket de PRE-CUENTA (cierre) para llevar a la mesa
 * Este ticket se imprime cuando el mozo pide la cuenta, antes del cobro
 *
 * @param {Object} data - Datos del ticket
 * @param {Object} data.comanda - Datos de la comanda
 * @param {Array} data.items - Items consumidos
 * @param {Object} data.descuento - Info de descuento (porcentaje, monto)
 * @param {Object} data.socio - Datos del socio (si aplica)
 */
export function renderTicketPreCuenta(data) {
  const { comanda, items, descuento, socio } = data
  let output = ''

  // Inicialización
  output += ESCPOS.INIT

  // ========== ENCABEZADO ==========
  output += ESCPOS.ALIGN_CENTER
  output += ESCPOS.BOLD_ON
  output += ESCPOS.DOUBLE_SIZE
  output += 'CLUB SPORTIVO PILAR\n'
  output += ESCPOS.NORMAL_SIZE
  output += ESCPOS.BOLD_OFF

  output += separator('=') + '\n'

  // ========== MESA Y COMANDA ==========
  output += ESCPOS.DOUBLE_SIZE
  output += ESCPOS.BOLD_ON
  if (comanda.mesa) {
    output += `MESA ${comanda.mesa.numero || comanda.mesa}\n`
  }
  output += ESCPOS.NORMAL_SIZE
  output += ESCPOS.BOLD_OFF

  output += `Comanda: ${comanda.numero || comanda.id}\n`
  output += `Fecha: ${formatDate(comanda.createdAt || new Date())}\n`

  if (comanda.mozo || comanda.creadoPor) {
    output += `Atendido por: ${comanda.mozo || comanda.creadoPor}\n`
  }

  // Si hay socio asociado
  if (socio) {
    output += `Socio: ${socio.nombre} ${socio.apellido || ''}\n`
  }

  output += separator() + '\n'

  // ========== ITEMS ==========
  output += ESCPOS.ALIGN_LEFT
  output += ESCPOS.BOLD_ON
  output += 'DESCRIPCION                         IMPORTE\n'
  output += ESCPOS.BOLD_OFF
  output += separator('-') + '\n'

  let subtotal = 0
  items.forEach(item => {
    const cantidad = item.cantidad || 1
    const nombre = item.nombre || item.descripcion || item.producto?.nombre || 'Producto'
    const precio = item.precioUnitario || item.precio || item.producto?.precio || 0
    const itemSubtotal = item.subtotal || (cantidad * precio)
    subtotal += parseFloat(itemSubtotal)

    if (cantidad > 1) {
      output += `${cantidad} x ${nombre}\n`
      output += `   ${formatPrice(precio)} c/u\n`
      output += formatItemLine('', itemSubtotal) + '\n'
    } else {
      output += formatItemLine(nombre, itemSubtotal) + '\n'
    }
  })

  output += separator('=') + '\n'

  // ========== SUBTOTAL ==========
  output += ESCPOS.BOLD_ON
  output += formatLabelValue('Subtotal:', formatPrice(subtotal)) + '\n'

  // ========== DESCUENTO SOCIO ==========
  let totalFinal = subtotal
  if (descuento && descuento.monto > 0) {
    output += formatLabelValue(`Desc. Socio (${descuento.porcentaje}%):`, `-${formatPrice(descuento.monto)}`) + '\n'
    totalFinal = subtotal - descuento.monto
  }

  // ========== TOTAL ==========
  output += ESCPOS.DOUBLE_SIZE
  output += formatLabelValue('TOTAL:', formatPrice(totalFinal)) + '\n'
  output += ESCPOS.NORMAL_SIZE
  output += ESCPOS.BOLD_OFF

  output += separator() + '\n'

  // ========== AVISO ==========
  output += ESCPOS.ALIGN_CENTER
  output += '\n'
  output += ESCPOS.BOLD_ON
  output += '** PRE-CUENTA **\n'
  output += ESCPOS.BOLD_OFF
  output += 'Este ticket NO es comprobante fiscal\n'
  output += 'Solicite su factura al momento del pago\n'
  output += '\n'
  output += 'Gracias por su visita!\n'

  // Corte de papel
  output += ESCPOS.FEED_LINES(4)
  output += ESCPOS.PARTIAL_CUT

  return output
}

/**
 * Convierte comandos ESC/POS a array de bytes para enviar a la impresora
 */
export function toByteArray(escposString) {
  const bytes = []
  for (let i = 0; i < escposString.length; i++) {
    bytes.push(escposString.charCodeAt(i))
  }
  return new Uint8Array(bytes)
}

/**
 * Codifica el ticket en base64 para enviar al frontend
 */
export function toBase64(escposString) {
  return Buffer.from(escposString, 'binary').toString('base64')
}
