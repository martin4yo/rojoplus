/**
 * Servicio para generar códigos QR de ARCA (ex-AFIP)
 * Según la especificación de ARCA para comprobantes electrónicos
 *
 * Formato: JSON en base64
 * URL: https://www.afip.gob.ar/fe/qr/?p={base64_encoded_json}
 *
 * IMPORTANTE: El importe se multiplica por 100 y se envía sin decimales
 * Ejemplo: $1500.50 -> 150050
 */

/**
 * Genera la URL del QR de ARCA para un comprobante
 *
 * @param {Object} data - Datos del comprobante
 * @param {string} data.cuit - CUIT del emisor
 * @param {number} data.tipoComprobante - Código tipo comprobante AFIP (1=FA, 6=FB, 11=FC)
 * @param {number} data.puntoVenta - Punto de venta
 * @param {number} data.numeroComprobante - Número de comprobante
 * @param {number} data.importe - Importe total con decimales
 * @param {Date} data.fecha - Fecha del comprobante
 * @param {number} data.tipoDocCliente - Tipo documento cliente (80=CUIT, 96=DNI, 99=Sin identificar)
 * @param {string} data.docCliente - Número documento cliente
 * @param {string} data.cae - CAE (Código de Autorización Electrónica)
 * @returns {string} URL del QR de ARCA
 */
export function generateQRData(data) {
  // Limpiar CUIT del emisor (solo números)
  const cuit = parseInt(data.cuit.replace(/\D/g, ''))

  // Formatear fecha en YYYY-MM-DD
  const year = data.fecha.getFullYear()
  const month = String(data.fecha.getMonth() + 1).padStart(2, '0')
  const day = String(data.fecha.getDate()).padStart(2, '0')
  const fecha = `${year}-${month}-${day}`

  // Importe multiplicado por 100 y sin decimales
  const importe = Math.round(data.importe * 100)

  // Limpiar documento del receptor (solo números)
  const customerDoc = (data.docCliente || '').replace(/\D/g, '')
  const nroDocRec = customerDoc ? parseInt(customerDoc) : 0

  // Construir objeto JSON según especificación de ARCA
  const qrObject = {
    ver: 1,
    fecha: fecha,
    cuit: cuit,
    ptoVta: data.puntoVenta,
    tipoCmp: data.tipoComprobante,
    nroCmp: data.numeroComprobante,
    importe: importe,
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: data.tipoDocCliente,
    nroDocRec: nroDocRec,
    tipoCodAut: 'E', // E = CAE
    codAut: parseInt(data.cae)
  }

  // Convertir a JSON y codificar en base64
  const jsonString = JSON.stringify(qrObject)
  const base64 = Buffer.from(jsonString, 'utf-8').toString('base64')

  // Retornar URL del QR de ARCA
  return `https://www.afip.gob.ar/fe/qr/?p=${base64}`
}

/**
 * Valida que los datos necesarios para generar el QR estén presentes
 */
export function canGenerateQR(data) {
  return !!(data.cae && data.cuit)
}

/**
 * Genera el contenido del QR en formato texto (para imprimir en ticket 80mm)
 * Retorna solo la URL que debe ser convertida a QR por el frontend/impresora
 */
export function generateQRContent(comprobante) {
  console.log('[QR] generateQRContent llamado con:', {
    cae: comprobante?.cae,
    cuit: comprobante?.cuit,
    cuitEmisor: comprobante?.cuitEmisor
  })
  if (!canGenerateQR(comprobante)) {
    console.log('[QR] canGenerateQR retornó false - falta cae o cuit')
    return null
  }
  console.log('[QR] Generando QR...')

  return generateQRData({
    cuit: comprobante.cuitEmisor || comprobante.cuit,
    tipoComprobante: comprobante.tipoAfip,
    puntoVenta: comprobante.puntoVenta,
    numeroComprobante: comprobante.numero,
    importe: parseFloat(comprobante.total),
    fecha: new Date(comprobante.fecha),
    tipoDocCliente: comprobante.tipoDocCliente || 99,
    docCliente: comprobante.docCliente || '',
    cae: comprobante.cae
  })
}
