/**
 * Servicio de generación de tickets para impresoras térmicas 80mm
 * Genera comandos ESC/POS para impresión directa
 *
 * Tipos de ticket:
 * - Ticket fiscal (con CAE y QR de ARCA)
 * - Ticket no fiscal (sin datos de facturación)
 */

import { generateQRContent } from './afipQRService.js'
import QRCode from 'qrcode'
import { PNG } from 'pngjs'

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
  FEED_LINES: (n) => ESC + 'd' + String.fromCharCode(n)
}

/**
 * Genera comandos ESC/POS para imprimir QR usando GS v 0 (raster image)
 * Este método es más compatible con impresoras económicas
 */
async function generateQRRaster(data, moduleSize = 4) {
  // Generar QR como imagen PNG
  const qrSize = 200 // píxeles
  const qrBuffer = await QRCode.toBuffer(data, {
    type: 'png',
    width: qrSize,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  })

  return new Promise((resolve, reject) => {
    const png = new PNG()
    png.parse(qrBuffer, (err, imgData) => {
      if (err) return reject(err)

      const width = imgData.width
      const height = imgData.height

      // Convertir a monocromo (1 bit por píxel)
      // GS v 0 usa formato: cada byte = 8 píxeles horizontales
      const bytesPerLine = Math.ceil(width / 8)
      const imageData = Buffer.alloc(bytesPerLine * height)

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (width * y + x) << 2
          const r = imgData.data[idx]
          const g = imgData.data[idx + 1]
          const b = imgData.data[idx + 2]
          const brightness = (r + g + b) / 3

          // Si es oscuro (negro), poner bit en 1
          if (brightness < 128) {
            const bytePos = Math.floor(x / 8)
            const bitPos = 7 - (x % 8)
            imageData[y * bytesPerLine + bytePos] |= (1 << bitPos)
          }
        }
      }

      // Construir comando GS v 0
      // GS v 0 m xL xH yL yH d1...dk
      // m = 0 (normal), 1 (double width), 2 (double height), 3 (double both)
      const xL = bytesPerLine & 0xFF
      const xH = (bytesPerLine >> 8) & 0xFF
      const yL = height & 0xFF
      const yH = (height >> 8) & 0xFF

      const command = Buffer.concat([
        Buffer.from([0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH]),
        imageData
      ])

      resolve(command.toString('binary'))
    })
  })
}

/**
 * Convierte imagen PNG a formato bitmap ESC/POS usando ESC * 33 (24-dot double density)
 * Este es el modo estándar para imprimir imágenes en impresoras térmicas
 */
async function convertImageToBitmap(pngBuffer) {
  return new Promise((resolve, reject) => {
    try {
      const png = new PNG()

      png.parse(pngBuffer, (err, data) => {
        if (err) return reject(err)

        const width = data.width
        const height = data.height

        console.log(`[QR Bitmap] Procesando imagen ${width}x${height}`)

        // Convertir a blanco y negro (1 bit por píxel)
        // pixels[y][x] = 1 si es negro, 0 si es blanco
        const pixels = []
        for (let y = 0; y < height; y++) {
          pixels[y] = []
          for (let x = 0; x < width; x++) {
            const idx = (width * y + x) << 2
            const r = data.data[idx]
            const g = data.data[idx + 1]
            const b = data.data[idx + 2]
            const brightness = (r + g + b) / 3
            pixels[y][x] = brightness < 128 ? 1 : 0
          }
        }

        // Usar Buffer para construir el comando
        const chunks = []

        // ESC 3 n - Set line spacing to n/180 inch (24 dots = sin espacio entre bandas)
        chunks.push(Buffer.from([0x1B, 0x33, 24]))

        // Procesar en bandas de 24 píxeles de alto
        for (let bandY = 0; bandY < height; bandY += 24) {
          // ESC * 33 nL nH - Select 24-dot double density bit image
          const nL = width & 0xFF
          const nH = (width >> 8) & 0xFF
          chunks.push(Buffer.from([0x1B, 0x2A, 33, nL, nH]))

          // Cada columna necesita 3 bytes (24 bits verticales)
          const bandData = Buffer.alloc(width * 3)
          for (let x = 0; x < width; x++) {
            for (let byteNum = 0; byteNum < 3; byteNum++) {
              let byte = 0
              for (let bit = 0; bit < 8; bit++) {
                const y = bandY + byteNum * 8 + bit
                if (y < height && pixels[y][x] === 1) {
                  byte |= (1 << (7 - bit))
                }
              }
              bandData[x * 3 + byteNum] = byte
            }
          }
          chunks.push(bandData)

          // Nueva línea después de cada banda
          chunks.push(Buffer.from([0x0A]))
        }

        // ESC 2 - Reset line spacing to default
        chunks.push(Buffer.from([0x1B, 0x32]))

        const result = Buffer.concat(chunks)
        console.log(`[QR Bitmap] Generado, tamaño: ${result.length} bytes`)

        // Convertir Buffer a string binary
        resolve(result.toString('binary'))
      })
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Genera línea de separación
 */
function separator(char = '-', width = 48) {
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
function formatItemLine(description, price, width = 48) {
  const priceStr = formatPrice(price)
  const maxDesc = width - priceStr.length - 1
  const desc = description.length > maxDesc ? description.substring(0, maxDesc) : description
  const spaces = width - desc.length - priceStr.length
  return desc + ' '.repeat(Math.max(1, spaces)) + priceStr
}

/**
 * Formatea línea con label y valor alineados a la derecha
 */
function formatLabelValue(label, value, width = 48) {
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
export async function renderTicketFiscal(data) {
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
  output += `IIBB: ${empresa.iibb || 'EXENTO'}\n`
  if (empresa.inicioActividades) {
    output += `Inicio Act.: ${empresa.inicioActividades}\n`
  }

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
  output += ESCPOS.BOLD_ON
  output += 'DATOS DEL CLIENTE\n'
  output += ESCPOS.BOLD_OFF

  const nombreCliente = comprobante.nombreCliente || 'Consumidor Final'
  output += `Nombre: ${nombreCliente}\n`
  output += `Direccion: ${comprobante.direccionCliente || ''}\n`

  if (comprobante.docCliente && comprobante.tipoDocCliente !== 99) {
    const tipoDoc = comprobante.tipoDocCliente === 80 ? 'CUIT' : comprobante.tipoDocCliente === 96 ? 'DNI' : 'Doc'
    output += `${tipoDoc}: ${comprobante.docCliente}\n`
  }
  output += `Cond. IVA: ${comprobante.condicionIvaCliente || 'Consumidor Final'}\n`

  const metodoPago = comanda?.metodoPago || comprobante.metodoPago || 'EFECTIVO'
  output += `Forma de Pago: ${metodoPago.toUpperCase()}\n`

  output += separator() + '\n'

  // ========== ITEMS ==========
  output += ESCPOS.BOLD_ON
  output += 'DETALLE\n'
  output += ESCPOS.BOLD_OFF
  output += separator('-') + '\n'

  items.forEach(item => {
    const cantidad = item.cantidad || 1
    const nombre = item.nombre || item.descripcion || 'Producto'
    const precioUnit = item.precioUnitario || item.precio || 0
    const subtotal = item.subtotal || (cantidad * precioUnit)

    // Línea 1: Nombre del producto
    output += nombre + '\n'

    // Línea 2: cantidad x precio = subtotal
    const qtyStr = cantidad.toString().padStart(4)
    const priceStr = `$${Number(precioUnit).toFixed(2)}`.padStart(12)
    const totalStr = `$${Number(subtotal).toFixed(2)}`.padStart(14)
    output += `  ${qtyStr} x ${priceStr} = ${totalStr}\n`
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

  // ========== CAE ==========
  output += ESCPOS.ALIGN_CENTER
  output += ESCPOS.BOLD_ON
  output += `CAE: ${comprobante.cae}\n`
  output += `Vto CAE: ${formatDate(comprobante.fechaVtoCae).split(' ')[0]}\n`
  output += ESCPOS.BOLD_OFF

  // ========== QR CODE ==========
  const qrUrl = generateQRContent(comprobante)
  if (qrUrl) {
    try {
      console.log('[Ticket] Generando QR raster para:', qrUrl.substring(0, 80) + '...')

      output += '\n'
      output += ESCPOS.ALIGN_CENTER

      // Usar GS v 0 (raster image) - más compatible con impresoras económicas
      const qrCommands = await generateQRRaster(qrUrl)
      output += qrCommands

      output += '\n'
      output += 'Comprobante Autorizado\n'
      console.log('[Ticket] QR raster generado')
    } catch (qrError) {
      console.error('[Ticket] Error generando QR:', qrError)
      output += '\n(Error al generar codigo QR)\n'
    }
  }

  // ========== PIE ==========
  output += '\n'
  output += separator() + '\n'
  output += ESCPOS.ALIGN_CENTER
  output += 'Gracias por su visita!\n'
  output += 'www.sportivopilar.com.ar\n'

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
  output += ESCPOS.BOLD_OFF

  output += separator('=', 48) + '\n'

  // ========== DATOS COMANDA ==========
  output += ESCPOS.BOLD_ON
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
  output += ESCPOS.BOLD_OFF

  // Nombre del cliente/socio
  const nombreCliente = comanda.socio?.apellidoNombre
    || comanda.nombreCliente
    || comanda.observaciones
    || comanda.nombreGrupo
  if (nombreCliente) {
    output += ESCPOS.BOLD_ON
    output += `${nombreCliente}\n`
    output += ESCPOS.BOLD_OFF
  }

  output += `Comanda #${comanda.numero || comanda.id}\n`
  output += `${formatDate(comanda.createdAt || new Date())}\n`

  if (comanda.mozo || comanda.creadoPor) {
    output += `Mozo: ${comanda.mozo || comanda.creadoPor}\n`
  }

  output += separator('-', 48) + '\n'

  // ========== ITEMS ==========
  output += ESCPOS.ALIGN_LEFT

  items.forEach(item => {
    const cantidad = item.cantidad || 1
    const nombre = item.nombre || item.descripcion || item.producto?.nombre || 'Producto'

    output += `${cantidad}x ${nombre.toUpperCase()}\n`

    if (item.notas || item.observaciones) {
      output += `   >> ${item.notas || item.observaciones}\n`
    }
  })

  output += separator('=', 48) + '\n'

  // ========== NOTAS GENERALES ==========
  if (comanda.notas && comanda.notas !== nombreCliente) {
    output += ESCPOS.ALIGN_CENTER
    output += ESCPOS.BOLD_ON
    output += 'NOTAS:\n'
    output += ESCPOS.BOLD_OFF
    output += comanda.notas
    output += '\n'
  }

  // Corte de papel - más espacio para manipular
  output += ESCPOS.FEED_LINES(6)
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
