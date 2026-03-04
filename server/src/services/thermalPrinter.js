/**
 * Servicio de impresión térmica ESC/POS
 * Genera tickets fiscales y no fiscales para impresoras térmicas de 80mm
 */
import QRCode from 'qrcode'
import { PNG } from 'pngjs'

// Comandos ESC/POS
const ESC = '\x1B'
const GS = '\x1D'

export const commands = {
  init: ESC + '@',
  alignCenter: ESC + 'a' + '\x01',
  alignLeft: ESC + 'a' + '\x00',
  alignRight: ESC + 'a' + '\x02',
  bold: {
    on: ESC + 'E' + '\x01',
    off: ESC + 'E' + '\x00'
  },
  size: {
    normal: GS + '!' + '\x00',
    double: GS + '!' + '\x11',
    doubleHeight: GS + '!' + '\x01',
    doubleWidth: GS + '!' + '\x10'
  },
  cut: GS + 'V' + '\x00',
  newLine: '\n',
  feed: (lines = 1) => ESC + 'd' + String.fromCharCode(lines)
}

/**
 * Genera el contenido del QR de ARCA
 * URL: https://www.afip.gob.ar/fe/qr/?p={base64_encoded_json}
 */
export function generateAfipQRData(data) {
  const cuit = parseInt((data.cuit || '').replace(/\D/g, ''))

  const date = new Date(data.fecha)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const fecha = `${year}-${month}-${day}`

  const importe = Math.round((data.importe || 0) * 100)

  const customerDoc = (data.docReceptor || '').replace(/\D/g, '')
  const nroDocRec = customerDoc ? parseInt(customerDoc) : 0

  const qrObject = {
    ver: 1,
    fecha: fecha,
    cuit: cuit,
    ptoVta: data.puntoVenta || 1,
    tipoCmp: data.tipoComprobante || 11,
    nroCmp: data.numero || 1,
    importe: importe,
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: data.tipoDocReceptor || 99,
    nroDocRec: nroDocRec,
    tipoCodAut: 'E',
    codAut: parseInt(data.cae || '0')
  }

  const jsonString = JSON.stringify(qrObject)
  const base64 = Buffer.from(jsonString, 'utf-8').toString('base64')

  return `https://www.afip.gob.ar/fe/qr/?p=${base64}`
}

/**
 * Ajusta texto a un ancho específico
 */
function fitText(text, width, align = 'left') {
  text = text || ''
  if (text.length > width) {
    return text.substring(0, width)
  }
  if (text.length < width) {
    const padding = ' '.repeat(width - text.length)
    if (align === 'right') {
      return padding + text
    } else if (align === 'center') {
      const leftPad = Math.floor(padding.length / 2)
      return ' '.repeat(leftPad) + text + ' '.repeat(padding.length - leftPad)
    }
    return text + padding
  }
  return text
}

/**
 * Convierte imagen PNG a formato bitmap ESC/POS
 */
async function convertImageToBitmap(pngBuffer) {
  return new Promise((resolve, reject) => {
    try {
      const png = new PNG()

      png.parse(pngBuffer, (err, data) => {
        if (err) return reject(err)

        const width = data.width
        const height = data.height

        const pixels = []
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (width * y + x) << 2
            const r = data.data[idx]
            const g = data.data[idx + 1]
            const b = data.data[idx + 2]
            const brightness = (r + g + b) / 3
            pixels.push(brightness < 128 ? 1 : 0)
          }
        }

        const widthBytes = Math.ceil(width / 8)
        const imageBytes = []

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < widthBytes; x++) {
            let byte = 0
            for (let bit = 0; bit < 8; bit++) {
              const pixelX = x * 8 + bit
              if (pixelX < width) {
                const pixelIndex = y * width + pixelX
                if (pixels[pixelIndex] === 1) {
                  byte |= (1 << (7 - bit))
                }
              }
            }
            imageBytes.push(byte)
          }
        }

        const mode = 0
        const xL = widthBytes & 0xFF
        const xH = (widthBytes >> 8) & 0xFF
        const yL = height & 0xFF
        const yH = (height >> 8) & 0xFF

        let command = GS + 'v' + String.fromCharCode(48) + String.fromCharCode(mode)
        command += String.fromCharCode(xL) + String.fromCharCode(xH)
        command += String.fromCharCode(yL) + String.fromCharCode(yH)

        for (let i = 0; i < imageBytes.length; i++) {
          command += String.fromCharCode(imageBytes[i])
        }

        resolve(command)
      })
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Genera ticket FISCAL con CAE y QR de ARCA
 */
export async function generarTicketFiscal(datos) {
  let ticket = ''

  // Inicializar
  ticket += commands.init

  // ========== HEADER - DATOS DEL NEGOCIO ==========
  ticket += commands.alignCenter
  ticket += commands.bold.on
  ticket += commands.size.double
  ticket += (datos.empresa?.razonSocial || 'CLUB SPORTIVO PILAR') + commands.newLine
  ticket += commands.size.normal
  ticket += commands.bold.off

  if (datos.empresa?.cuit) {
    ticket += `CUIT: ${datos.empresa.cuit}` + commands.newLine
  }

  ticket += `Ingresos Brutos: ${datos.empresa?.iibb || 'EXENTO'}` + commands.newLine

  if (datos.empresa?.domicilio) {
    ticket += datos.empresa.domicilio + commands.newLine
  }

  ticket += '----------------------------------------' + commands.newLine

  // ========== TIPO DE COMPROBANTE ==========
  ticket += commands.alignCenter
  ticket += commands.bold.on
  ticket += commands.size.doubleHeight
  ticket += (datos.comprobante?.tipo || 'FACTURA C') + commands.newLine
  ticket += commands.size.normal
  ticket += commands.bold.off

  // Número de comprobante
  const pv = String(datos.comprobante?.puntoVenta || 1).padStart(4, '0')
  const num = String(datos.comprobante?.numero || 0).padStart(8, '0')
  ticket += `Nro: ${pv}-${num}` + commands.newLine

  const fecha = new Date(datos.comprobante?.fecha || new Date())
  ticket += `Fecha: ${fecha.toLocaleString('es-AR')}` + commands.newLine

  ticket += commands.alignLeft
  ticket += '----------------------------------------' + commands.newLine

  // ========== DATOS DEL CLIENTE ==========
  ticket += commands.bold.on
  ticket += 'DATOS DEL RECEPTOR' + commands.newLine
  ticket += commands.bold.off

  ticket += `Cliente: ${datos.cliente?.nombre || 'Consumidor Final'}` + commands.newLine

  if (datos.cliente?.documento && datos.cliente?.tipoDoc !== 99) {
    const tipoDoc = datos.cliente.tipoDoc === 80 ? 'CUIT' : 'DNI'
    ticket += `${tipoDoc}: ${datos.cliente.documento}` + commands.newLine
  }

  if (datos.cliente?.condicionIva && datos.cliente.condicionIva !== 'Consumidor Final') {
    ticket += `IVA: ${datos.cliente.condicionIva}` + commands.newLine
  }

  ticket += '----------------------------------------' + commands.newLine

  // ========== ITEMS ==========
  ticket += commands.bold.on
  ticket += 'PRODUCTOS' + commands.newLine
  ticket += commands.bold.off
  ticket += '----------------------------------------' + commands.newLine

  for (const item of (datos.items || [])) {
    const nombre = item.nombre || 'Producto'
    const qty = item.cantidad || 1
    const precio = Number(item.precio || item.precioUnitario || 0)
    const subtotal = Number(item.subtotal || qty * precio)

    ticket += nombre + commands.newLine

    const qtyStr = qty.toString()
    const priceStr = `$${precio.toFixed(2)}`
    const totalStr = `$${subtotal.toFixed(2)}`

    const col1 = fitText(qtyStr, 7, 'right')
    const col2 = fitText(priceStr, 15, 'right')
    const col3 = fitText(totalStr, 15, 'right')

    ticket += col1 + ' x ' + col2 + ' = ' + col3 + commands.newLine
  }

  ticket += '----------------------------------------' + commands.newLine

  // ========== TOTALES ==========
  ticket += commands.alignRight

  if (datos.discriminaIva && datos.subtotal) {
    ticket += `Subtotal: $${Number(datos.subtotal).toFixed(2)}` + commands.newLine
    ticket += `IVA 21%: $${Number(datos.iva || 0).toFixed(2)}` + commands.newLine
  }

  ticket += commands.bold.on
  ticket += commands.size.double
  ticket += `TOTAL: $${Number(datos.total).toFixed(2)}` + commands.newLine
  ticket += commands.size.normal
  ticket += commands.bold.off

  ticket += commands.alignLeft
  ticket += '----------------------------------------' + commands.newLine

  // ========== FORMA DE PAGO ==========
  if (datos.medioPago) {
    ticket += `Forma de pago: ${datos.medioPago}` + commands.newLine
    if (datos.montoPagado && datos.montoPagado > datos.total) {
      ticket += `Pago: $${Number(datos.montoPagado).toFixed(2)}` + commands.newLine
      ticket += `Vuelto: $${Number(datos.vuelto || 0).toFixed(2)}` + commands.newLine
    }
    ticket += '----------------------------------------' + commands.newLine
  }

  // ========== DATOS DE ARCA (CAE) ==========
  if (datos.comprobante?.cae) {
    ticket += commands.bold.on
    ticket += 'DATOS DE VALIDACION ARCA' + commands.newLine
    ticket += commands.bold.off

    ticket += `CAE: ${datos.comprobante.cae}` + commands.newLine

    if (datos.comprobante.fechaVtoCae) {
      const vto = new Date(datos.comprobante.fechaVtoCae)
      ticket += `Vto CAE: ${vto.toLocaleDateString('es-AR')}` + commands.newLine
    }

    ticket += '----------------------------------------' + commands.newLine

    // ========== QR CODE ==========
    if (datos.empresa?.cuit) {
      try {
        const qrUrl = generateAfipQRData({
          cuit: datos.empresa.cuit,
          tipoComprobante: datos.comprobante.tipoAfip || 11,
          puntoVenta: datos.comprobante.puntoVenta,
          numero: datos.comprobante.numero,
          importe: datos.total,
          fecha: datos.comprobante.fecha,
          tipoDocReceptor: datos.cliente?.tipoDoc || 99,
          docReceptor: datos.cliente?.documento || '',
          cae: datos.comprobante.cae
        })

        ticket += commands.alignCenter
        ticket += 'Codigo QR de validacion ARCA' + commands.newLine
        ticket += '(Escanea para verificar)' + commands.newLine
        ticket += commands.newLine

        // Generar QR como imagen PNG
        const qrBuffer = await QRCode.toBuffer(qrUrl, {
          type: 'png',
          width: 200,
          margin: 1,
          errorCorrectionLevel: 'M'
        })

        // Convertir a bitmap ESC/POS
        const qrBitmap = await convertImageToBitmap(qrBuffer)
        ticket += qrBitmap

        ticket += commands.newLine
        ticket += '----------------------------------------' + commands.newLine
      } catch (error) {
        console.error('Error generando QR:', error)
      }
    }
  }

  // ========== FOOTER ==========
  ticket += commands.alignCenter
  ticket += commands.bold.on
  ticket += 'Comprobante Autorizado' + commands.newLine
  ticket += commands.bold.off
  ticket += 'Gracias por su visita' + commands.newLine
  ticket += 'www.clubsportivopilar.com.ar' + commands.newLine
  ticket += commands.feed(5)
  ticket += commands.cut

  return ticket
}

/**
 * Genera ticket NO FISCAL (cuenta/ticket de venta)
 */
export async function generarTicketCuenta(datos) {
  let ticket = ''

  // Inicializar
  ticket += commands.init

  // ========== HEADER ==========
  ticket += commands.alignCenter
  ticket += commands.bold.on
  ticket += commands.size.double
  ticket += (datos.negocio || 'CLUB SPORTIVO PILAR') + commands.newLine
  ticket += commands.size.normal
  ticket += commands.bold.off
  ticket += 'Buffet - Restaurant' + commands.newLine
  ticket += '========================================' + commands.newLine

  // ========== TIPO DE TICKET ==========
  ticket += commands.bold.on
  ticket += commands.size.doubleHeight
  ticket += (datos.tipo === 'CUENTA' ? 'CUENTA' : 'TICKET') + commands.newLine
  ticket += commands.size.normal
  ticket += commands.bold.off

  if (datos.numero) {
    ticket += commands.size.double
    ticket += `#${datos.numero}` + commands.newLine
    ticket += commands.size.normal
  }

  if (datos.mesa) {
    ticket += commands.bold.on
    ticket += `MESA ${datos.mesa}` + commands.newLine
    ticket += commands.bold.off
  }

  if (datos.cliente) {
    ticket += datos.cliente + commands.newLine
  }

  const fecha = new Date(datos.fecha || Date.now())
  ticket += fecha.toLocaleString('es-AR') + commands.newLine

  ticket += commands.alignLeft
  ticket += '========================================' + commands.newLine

  // ========== ITEMS ==========
  for (const item of (datos.items || [])) {
    const nombre = item.nombre || 'Producto'
    const qty = item.cantidad || 1
    const precio = Number(item.precio || item.precioUnitario || 0)
    const subtotal = qty * precio

    ticket += commands.bold.on
    ticket += `${qty}x ${nombre}` + commands.newLine
    ticket += commands.bold.off

    if (precio > 0) {
      const priceStr = `$${precio.toFixed(2)}`
      const totalStr = `$${subtotal.toFixed(2)}`
      ticket += fitText(priceStr, 20, 'right') + fitText(totalStr, 20, 'right') + commands.newLine
    }

    if (item.observaciones) {
      ticket += `   -> ${item.observaciones}` + commands.newLine
    }
  }

  ticket += '========================================' + commands.newLine

  // ========== TOTALES ==========
  ticket += commands.alignRight

  if (datos.subtotal !== undefined) {
    ticket += `Subtotal: $${Number(datos.subtotal).toFixed(2)}` + commands.newLine
  }

  if (datos.descuento && datos.descuento > 0) {
    ticket += `Descuento (${datos.descuentoPorcentaje || 0}%): -$${Number(datos.descuento).toFixed(2)}` + commands.newLine
  }

  ticket += commands.bold.on
  ticket += commands.size.double
  ticket += `TOTAL: $${Number(datos.total).toFixed(2)}` + commands.newLine
  ticket += commands.size.normal
  ticket += commands.bold.off

  ticket += commands.alignLeft
  ticket += '========================================' + commands.newLine

  // ========== MEDIO DE PAGO ==========
  if (datos.medioPago) {
    ticket += commands.alignCenter
    ticket += `Pago: ${datos.medioPago}` + commands.newLine
    if (datos.montoPagado && datos.montoPagado > datos.total) {
      ticket += `Pago: $${Number(datos.montoPagado).toFixed(2)}` + commands.newLine
      ticket += commands.bold.on
      ticket += `Vuelto: $${Number(datos.vuelto || 0).toFixed(2)}` + commands.newLine
      ticket += commands.bold.off
    }
    ticket += '========================================' + commands.newLine
  }

  // ========== AVISO NO FISCAL ==========
  ticket += commands.alignCenter
  ticket += commands.bold.on
  ticket += '** NO VALIDO COMO FACTURA **' + commands.newLine
  ticket += commands.bold.off

  // ========== FOOTER ==========
  ticket += '========================================' + commands.newLine
  ticket += 'Gracias por su visita' + commands.newLine
  ticket += 'www.clubsportivopilar.com.ar' + commands.newLine
  ticket += commands.feed(5)
  ticket += commands.cut

  return ticket
}
