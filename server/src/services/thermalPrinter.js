/**
 * Servicio de impresión térmica ESC/POS
 * Genera tickets fiscales y no fiscales para impresoras térmicas de 80mm
 * Basado en thermal-templates.js de AxiomaWeb
 */
import QRCode from 'qrcode'
import { PNG } from 'pngjs'

// Comandos ESC/POS
const ESC = '\x1B'
const GS = '\x1D'

// Ancho de papel: 48 caracteres para 80mm
const PAPER_WIDTH = 48
const LINE = '='.repeat(PAPER_WIDTH)
const LINE_DASH = '-'.repeat(PAPER_WIDTH)

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
 * Genera el contenido del QR de ARCA (ex-AFIP)
 * URL: https://www.afip.gob.ar/fe/qr/?p={base64_encoded_json}
 */
export function generateAfipQRData(data) {
  const cuit = parseInt((data.cuit || '').replace(/\D/g, ''))

  const date = new Date(data.fecha)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const fecha = `${year}-${month}-${day}`

  // Importe multiplicado por 100 y sin decimales
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
 * Formatea una línea con texto a izquierda y derecha
 */
function lineLeftRight(left, right, width = PAPER_WIDTH) {
  const leftLen = Math.max(1, width - right.length - 1)
  return fitText(left, leftLen) + ' ' + right
}

/**
 * Genera QR usando comandos ESC/POS nativos (más compatible que bitmap)
 * Funciona en la mayoría de impresoras térmicas modernas (EPSON, similar)
 */
function generateQRNative(data) {
  const dataBytes = Buffer.from(data, 'utf-8')
  const storeLen = dataBytes.length + 3 // +3 por cn + fn + m
  const storePL = storeLen & 0xFF
  const storePH = (storeLen >> 8) & 0xFF

  let cmd = ''

  // GS ( k pL pH cn fn [parámetros]
  // cn = 49 (0x31), funciones varían

  // 1. Seleccionar modelo QR (modelo 2)
  // fn=65(A), n1=50(modelo 2), n2=0
  cmd += GS + '\x28\x6B\x04\x00\x31\x41\x32\x00'

  // 2. Tamaño del módulo (6 = tamaño medio-grande, rango 1-16)
  // fn=67(C), n=6
  cmd += GS + '\x28\x6B\x03\x00\x31\x43\x06'

  // 3. Nivel de corrección de error (M = 15%)
  // fn=69(E), n=49(M)
  cmd += GS + '\x28\x6B\x03\x00\x31\x45\x31'

  // 4. Almacenar datos del QR
  // fn=80(P), m=48(0)
  cmd += GS + '\x28\x6B' + String.fromCharCode(storePL) + String.fromCharCode(storePH) + '\x31\x50\x30'
  cmd += dataBytes.toString('binary')

  // 5. Imprimir el QR almacenado
  // fn=81(Q), m=48(0)
  cmd += GS + '\x28\x6B\x03\x00\x31\x51\x30'

  return cmd
}

/**
 * Convierte imagen PNG a formato bitmap ESC/POS usando ESC * (más compatible)
 * Configura line spacing para que el QR salga cuadrado
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

        // Convertir a array de pixels (1 = negro, 0 = blanco)
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

        let output = ''

        // ESC 3 n - Set line spacing to n/180 inch
        // Para modo 33, usamos 24 para que no haya espacio entre bandas
        output += ESC + '3' + String.fromCharCode(24)

        // Procesar en bandas de 24 pixels de alto
        for (let bandY = 0; bandY < height; bandY += 24) {
          const nL = width & 0xFF
          const nH = (width >> 8) & 0xFF

          // ESC * 33 nL nH [data] - 24 dots double density
          output += ESC + '*' + String.fromCharCode(33)
          output += String.fromCharCode(nL) + String.fromCharCode(nH)

          // Para cada columna de pixels
          for (let x = 0; x < width; x++) {
            // 3 bytes por columna (24 bits = 24 dots verticales)
            for (let byteNum = 0; byteNum < 3; byteNum++) {
              let byte = 0
              for (let bit = 0; bit < 8; bit++) {
                const y = bandY + byteNum * 8 + bit
                if (y < height) {
                  const pixelIndex = y * width + x
                  if (pixels[pixelIndex] === 1) {
                    byte |= (1 << (7 - bit))
                  }
                }
              }
              output += String.fromCharCode(byte)
            }
          }

          // Nueva línea después de cada banda
          output += '\n'
        }

        // ESC 2 - Reset line spacing to default
        output += ESC + '2'

        console.log(`[QR Bitmap] Generado, tamaño: ${output.length} bytes`)
        resolve(output)
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

  // ========== HEADER - DATOS DEL CLUB ==========
  ticket += commands.alignCenter
  ticket += commands.bold.on
  ticket += commands.size.double
  ticket += (datos.empresa?.razonSocial || 'CLUB SPORTIVO PILAR') + commands.newLine
  ticket += commands.size.normal
  ticket += commands.bold.off

  // Datos fiscales del emisor
  if (datos.empresa?.cuit) {
    ticket += `CUIT: ${datos.empresa.cuit}` + commands.newLine
  }

  ticket += `${datos.empresa?.condicionIva || 'IVA Responsable Inscripto'}` + commands.newLine
  ticket += `Ingresos Brutos: ${datos.empresa?.iibb || 'EXENTO'}` + commands.newLine

  if (datos.empresa?.domicilio) {
    ticket += datos.empresa.domicilio + commands.newLine
  }

  ticket += 'www.sportivopilar.com.ar' + commands.newLine
  ticket += LINE_DASH + commands.newLine

  // ========== TIPO DE COMPROBANTE ==========
  ticket += commands.alignCenter
  ticket += commands.bold.on
  ticket += commands.size.doubleHeight

  const tipoComprobante = datos.comprobante?.tipo || 'FACTURA C'
  ticket += tipoComprobante + commands.newLine
  ticket += commands.size.normal
  ticket += commands.bold.off

  // Número de comprobante
  const pv = String(datos.comprobante?.puntoVenta || 1).padStart(4, '0')
  const num = String(datos.comprobante?.numero || 0).padStart(8, '0')
  ticket += commands.bold.on
  ticket += `Nro: ${pv}-${num}` + commands.newLine
  ticket += commands.bold.off

  const fecha = new Date(datos.comprobante?.fecha || new Date())
  ticket += `Fecha: ${fecha.toLocaleString('es-AR')}` + commands.newLine

  ticket += LINE_DASH + commands.newLine

  // ========== DATOS DEL CLIENTE ==========
  ticket += commands.alignLeft
  ticket += commands.bold.on
  ticket += 'CLIENTE' + commands.newLine
  ticket += commands.bold.off

  const nombreCliente = datos.cliente?.nombre || 'Consumidor Final'
  ticket += `Cliente: ${nombreCliente}` + commands.newLine

  // Mostrar CUIT/DNI si no es consumidor final
  if (datos.cliente?.documento && datos.cliente?.tipoDoc !== 99) {
    const tipoDoc = datos.cliente.tipoDoc === 80 ? 'CUIT' : 'DNI'
    ticket += `${tipoDoc}: ${datos.cliente.documento}` + commands.newLine
  }

  // Condición IVA del cliente
  if (datos.cliente?.condicionIva && datos.cliente.condicionIva !== 'Consumidor Final') {
    ticket += `Cond. IVA: ${datos.cliente.condicionIva}` + commands.newLine
  }

  ticket += LINE_DASH + commands.newLine

  // ========== ITEMS ==========
  ticket += commands.bold.on
  ticket += 'DETALLE' + commands.newLine
  ticket += commands.bold.off
  ticket += LINE_DASH + commands.newLine

  for (const item of (datos.items || [])) {
    const nombre = item.nombre || 'Producto'
    const qty = item.cantidad || 1
    const precio = Number(item.precio || item.precioUnitario || 0)
    const subtotal = Number(item.subtotal || qty * precio)

    // Nombre del producto
    ticket += nombre + commands.newLine

    // Formato: cantidad x precio = subtotal (alineado a la derecha)
    const qtyStr = qty.toString()
    const priceStr = `$${precio.toFixed(2)}`
    const totalStr = `$${subtotal.toFixed(2)}`

    // Columnas con anchos para ocupar todo el papel
    const detalleLine = `  ${fitText(qtyStr, 4, 'right')} x ${fitText(priceStr, 12, 'right')} = ${fitText(totalStr, 14, 'right')}`
    ticket += detalleLine + commands.newLine
  }

  ticket += LINE_DASH + commands.newLine

  // ========== TOTALES ==========
  ticket += commands.alignRight

  if (datos.discriminaIva && datos.subtotal) {
    ticket += `Subtotal Neto: $${Number(datos.subtotal).toFixed(2)}` + commands.newLine
    ticket += `IVA 21%: $${Number(datos.iva || 0).toFixed(2)}` + commands.newLine
  }

  ticket += commands.bold.on
  ticket += commands.size.double
  ticket += `TOTAL: $${Number(datos.total).toFixed(2)}` + commands.newLine
  ticket += commands.size.normal
  ticket += commands.bold.off

  ticket += commands.alignLeft
  ticket += LINE_DASH + commands.newLine

  // ========== FORMA DE PAGO ==========
  if (datos.medioPago) {
    ticket += `Forma de pago: ${datos.medioPago}` + commands.newLine
    if (datos.montoPagado && Number(datos.montoPagado) > Number(datos.total)) {
      ticket += `Pagado: $${Number(datos.montoPagado).toFixed(2)}` + commands.newLine
      ticket += `Vuelto: $${Number(datos.vuelto || 0).toFixed(2)}` + commands.newLine
    }
    ticket += LINE_DASH + commands.newLine
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

    ticket += LINE_DASH + commands.newLine

    // ========== QR CODE ==========
    if (datos.empresa?.cuit) {
      try {
        // Determinar tipo de documento del cliente
        let customerDocType = datos.cliente?.tipoDoc || 99
        let customerDocNumber = datos.cliente?.documento || ''

        const qrUrl = generateAfipQRData({
          cuit: datos.empresa.cuit,
          tipoComprobante: datos.comprobante.tipoAfip || 11,
          puntoVenta: datos.comprobante.puntoVenta,
          numero: datos.comprobante.numero,
          importe: datos.total,
          fecha: datos.comprobante.fecha,
          tipoDocReceptor: customerDocType,
          docReceptor: customerDocNumber,
          cae: datos.comprobante.cae
        })

        console.log('[Ticket] Generando QR para URL:', qrUrl)

        ticket += commands.alignCenter
        ticket += 'Codigo QR ARCA' + commands.newLine
        ticket += commands.newLine

        // Generar QR como imagen PNG (tamaño grande para mejor legibilidad)
        const qrBuffer = await QRCode.toBuffer(qrUrl, {
          type: 'png',
          width: 300,
          margin: 1,
          errorCorrectionLevel: 'M'
        })

        console.log('[Ticket] QR buffer generado, tamaño:', qrBuffer.length)

        // Convertir a bitmap ESC/POS
        const qrBitmap = await convertImageToBitmap(qrBuffer)
        console.log('[Ticket] QR bitmap generado, tamaño:', qrBitmap.length)

        ticket += qrBitmap

        ticket += commands.newLine
        ticket += LINE + commands.newLine
      } catch (error) {
        console.error('[Ticket] Error generando QR:', error)
        ticket += '(Error al generar codigo QR)' + commands.newLine
        ticket += LINE + commands.newLine
      }
    }
  }

  // ========== FOOTER ==========
  ticket += commands.alignCenter
  ticket += commands.bold.on
  ticket += 'Comprobante Autorizado' + commands.newLine
  ticket += commands.bold.off
  ticket += commands.newLine
  ticket += 'Gracias por su visita!' + commands.newLine
  ticket += 'www.sportivopilar.com.ar' + commands.newLine
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
  ticket += 'www.sportivopilar.com.ar' + commands.newLine
  ticket += LINE + commands.newLine

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
  ticket += LINE + commands.newLine

  // ========== ITEMS ==========
  ticket += commands.bold.on
  ticket += 'DETALLE' + commands.newLine
  ticket += commands.bold.off
  ticket += LINE_DASH + commands.newLine

  for (const item of (datos.items || [])) {
    const nombre = item.nombre || 'Producto'
    const qty = item.cantidad || 1
    const precio = Number(item.precio || item.precioUnitario || 0)
    const subtotal = qty * precio

    // Nombre del producto (sin negrita)
    ticket += nombre + commands.newLine

    if (precio > 0) {
      // Formato: cantidad x precio = subtotal
      const qtyStr = qty.toString()
      const priceStr = `$${precio.toFixed(2)}`
      const totalStr = `$${subtotal.toFixed(2)}`
      const detalleLine = `  ${fitText(qtyStr, 4, 'right')} x ${fitText(priceStr, 12, 'right')} = ${fitText(totalStr, 14, 'right')}`
      ticket += detalleLine + commands.newLine
    }

    if (item.observaciones) {
      ticket += `   -> ${item.observaciones}` + commands.newLine
    }
  }

  ticket += LINE + commands.newLine

  // ========== TOTALES ==========
  ticket += commands.alignRight

  if (datos.subtotal !== undefined && datos.descuento > 0) {
    ticket += `Subtotal: $${Number(datos.subtotal).toFixed(2)}` + commands.newLine
  }

  if (datos.descuento && datos.descuento > 0) {
    const pct = datos.descuentoPorcentaje ? `(${datos.descuentoPorcentaje}%)` : ''
    ticket += `Descuento${pct}: -$${Number(datos.descuento).toFixed(2)}` + commands.newLine
  }

  ticket += commands.bold.on
  ticket += commands.size.double
  ticket += `TOTAL: $${Number(datos.total).toFixed(2)}` + commands.newLine
  ticket += commands.size.normal
  ticket += commands.bold.off

  ticket += commands.alignLeft
  ticket += LINE + commands.newLine

  // ========== MEDIO DE PAGO ==========
  if (datos.medioPago) {
    ticket += commands.alignCenter
    ticket += `Pago: ${datos.medioPago}` + commands.newLine
    if (datos.montoPagado && Number(datos.montoPagado) > Number(datos.total)) {
      ticket += `Pagado: $${Number(datos.montoPagado).toFixed(2)}` + commands.newLine
      ticket += commands.bold.on
      ticket += `Vuelto: $${Number(datos.vuelto || 0).toFixed(2)}` + commands.newLine
      ticket += commands.bold.off
    }
    ticket += LINE + commands.newLine
  }

  // ========== AVISO NO FISCAL ==========
  ticket += commands.alignCenter
  ticket += commands.bold.on
  ticket += '** NO VALIDO COMO FACTURA **' + commands.newLine
  ticket += commands.bold.off

  // ========== FOOTER ==========
  ticket += LINE + commands.newLine
  ticket += 'Gracias por su visita!' + commands.newLine
  ticket += 'www.sportivopilar.com.ar' + commands.newLine
  ticket += commands.feed(5)
  ticket += commands.cut

  return ticket
}
