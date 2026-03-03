import prisma from '../lib/prisma.js'

/**
 * Genera números secuenciales para documentos
 *
 * @param {string} modelName - Nombre del modelo de Prisma
 * @param {string} prefix - Prefijo del número (ej: 'C' para comandas)
 * @param {Object} options - Opciones de configuración
 * @param {number} options.padding - Cantidad de dígitos del secuencial (default: 4)
 * @param {string} options.dateFormat - Formato de fecha: 'YYYYMMDD', 'YYYYMM', 'YYYY' (default: 'YYYYMMDD')
 * @param {string} options.field - Campo donde se guarda el número (default: 'numero')
 * @param {string} options.separator - Separador entre prefijo y secuencial (default: '-')
 *
 * @returns {Promise<string>} Número generado (ej: 'C20260302-0001')
 *
 * @example
 * const numero = await generateSequentialNumber('comanda', 'C')
 * // Resultado: 'C20260302-0001'
 *
 * @example
 * const numero = await generateSequentialNumber('pedidoTakeAway', 'TA', {
 *   padding: 5,
 *   dateFormat: 'YYYYMMDD'
 * })
 * // Resultado: 'TA20260302-00001'
 */
export async function generateSequentialNumber(modelName, prefix, options = {}) {
  const {
    padding = 4,
    dateFormat = 'YYYYMMDD',
    field = 'numero',
    separator = '-'
  } = options

  const model = prisma[modelName]
  if (!model) {
    throw new Error(`Modelo '${modelName}' no existe en Prisma`)
  }

  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  let dateStr
  switch (dateFormat) {
    case 'YYYY':
      dateStr = `${year}`
      break
    case 'YYYYMM':
      dateStr = `${year}${month}`
      break
    case 'YYYYMMDD':
    default:
      dateStr = `${year}${month}${day}`
  }

  const fullPrefix = `${prefix}${dateStr}`

  // Buscar el último número con este prefijo
  const last = await model.findFirst({
    where: {
      [field]: { startsWith: fullPrefix }
    },
    orderBy: { [field]: 'desc' }
  })

  // Calcular siguiente secuencial
  let seq = 1
  if (last && last[field]) {
    const parts = last[field].split(separator)
    const lastSeq = parseInt(parts[parts.length - 1] || '0')
    seq = lastSeq + 1
  }

  return `${fullPrefix}${separator}${String(seq).padStart(padding, '0')}`
}

/**
 * Genera número de comprobante fiscal
 * Formato: PPPP-NNNNNNNN (4 dígitos punto venta + 8 dígitos número)
 *
 * @param {number} puntoVenta - Número de punto de venta
 * @param {number} tipoComprobante - Tipo de comprobante AFIP (1=FA, 6=FB, 11=FC, etc)
 *
 * @returns {Promise<{puntoVenta: number, numero: number, formatted: string}>}
 */
export async function generateComprobanteNumber(puntoVenta, tipoComprobante) {
  // Buscar último comprobante del mismo tipo y punto de venta
  const last = await prisma.comprobanteElectronico.findFirst({
    where: {
      puntoVenta,
      tipoAfip: tipoComprobante
    },
    orderBy: { numero: 'desc' }
  })

  const numero = (last?.numero || 0) + 1

  return {
    puntoVenta,
    numero,
    formatted: `${String(puntoVenta).padStart(4, '0')}-${String(numero).padStart(8, '0')}`
  }
}

/**
 * Genera número de recibo
 * Formato: R-YYYY-NNNNNN
 *
 * @param {number} [year] - Año (default: año actual)
 * @returns {Promise<string>}
 */
export async function generateReciboNumber(year = null) {
  const targetYear = year || new Date().getFullYear()
  const prefix = `R-${targetYear}-`

  const last = await prisma.pago.findFirst({
    where: {
      numero: { startsWith: prefix }
    },
    orderBy: { numero: 'desc' }
  })

  let seq = 1
  if (last?.numero) {
    const parts = last.numero.split('-')
    seq = parseInt(parts[2] || '0') + 1
  }

  return `${prefix}${String(seq).padStart(6, '0')}`
}

/**
 * Genera número de asiento contable
 * Formato: A-YYYY-NNNNNN
 *
 * @param {number} [year] - Año (default: año actual)
 * @returns {Promise<string>}
 */
export async function generateAsientoNumber(year = null) {
  const targetYear = year || new Date().getFullYear()
  const prefix = `A-${targetYear}-`

  const last = await prisma.asiento.findFirst({
    where: {
      numero: { startsWith: prefix }
    },
    orderBy: { numero: 'desc' }
  })

  let seq = 1
  if (last?.numero) {
    const parts = last.numero.split('-')
    seq = parseInt(parts[2] || '0') + 1
  }

  return `${prefix}${String(seq).padStart(6, '0')}`
}

/**
 * Genera número para orden de pago
 * Formato: OP-YYYYMM-NNNN
 */
export async function generateOrdenPagoNumber() {
  const date = new Date()
  const prefix = `OP-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}-`

  const last = await prisma.ordenPago.findFirst({
    where: { numero: { startsWith: prefix } },
    orderBy: { numero: 'desc' }
  })

  const seq = last ? parseInt(last.numero.split('-')[2] || '0') + 1 : 1
  return `${prefix}${String(seq).padStart(4, '0')}`
}

/**
 * Genera número para pedido
 * Formato: PED-YYYYMMDD-NNNN
 */
export async function generatePedidoNumber() {
  return generateSequentialNumber('pedido', 'PED', { padding: 4 })
}

/**
 * Genera número para comanda de buffet
 * Formato: C-YYYYMMDD-NNNN
 */
export async function generateComandaNumber() {
  return generateSequentialNumber('comanda', 'C', { padding: 4 })
}

/**
 * Genera número para pedido take away
 * Formato: TA-YYYYMMDD-NNNN
 */
export async function generateTakeAwayNumber() {
  return generateSequentialNumber('pedidoTakeAway', 'TA', { padding: 4 })
}

export default {
  generateSequentialNumber,
  generateComprobanteNumber,
  generateReciboNumber,
  generateAsientoNumber,
  generateOrdenPagoNumber,
  generatePedidoNumber,
  generateComandaNumber,
  generateTakeAwayNumber
}
