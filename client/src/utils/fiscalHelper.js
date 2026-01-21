/**
 * Helper para determinar el tipo de comprobante y cálculo de IVA
 * basado en la condición de IVA del emisor y receptor
 */

// Condiciones de IVA posibles
export const CONDICIONES_IVA = {
  INSCRIPTO: 'INSCRIPTO',           // Responsable Inscripto
  MONOTRIBUTISTA: 'MONOTRIBUTISTA', // Monotributista
  EXENTO: 'EXENTO',                 // Exento
  CONSUMIDOR_FINAL: 'CONSUMIDOR_FINAL', // Consumidor Final
  NO_RESPONSABLE: 'NO_RESPONSABLE'  // No Responsable
}

// Opciones para select de condiciones IVA (cliente/proveedor)
export const CONDICIONES_IVA_OPTIONS = [
  { value: 'INSCRIPTO', label: 'Responsable Inscripto' },
  { value: 'MONOTRIBUTISTA', label: 'Monotributista' },
  { value: 'EXENTO', label: 'Exento' },
  { value: 'CONSUMIDOR_FINAL', label: 'Consumidor Final' },
  { value: 'NO_RESPONSABLE', label: 'No Responsable' }
]

// Tipos de comprobante
export const TIPOS_COMPROBANTE = {
  A: 'A',
  B: 'B',
  C: 'C'
}

/**
 * Determina el tipo de comprobante para una VENTA
 * basado en la condición de IVA del emisor (club) y del receptor (cliente)
 *
 * REGLAS:
 * - Emisor INSCRIPTO:
 *   - A receptor INSCRIPTO o MONOTRIBUTISTA → Factura A
 *   - A cualquier otro (EXENTO, CONSUMIDOR_FINAL, NO_RESPONSABLE) → Factura B
 * - Emisor EXENTO:
 *   - A cualquiera → Factura B
 * - Emisor MONOTRIBUTISTA:
 *   - A cualquiera → Factura C
 *
 * @param {string} condicionEmisor - Condición IVA del emisor (club)
 * @param {string} condicionReceptor - Condición IVA del receptor (cliente)
 * @returns {string} Tipo de comprobante (A, B, C)
 */
export function getTipoComprobanteVenta(condicionEmisor, condicionReceptor) {
  if (!condicionEmisor) return 'B' // Default si no hay config

  switch (condicionEmisor) {
    case CONDICIONES_IVA.INSCRIPTO:
      // Inscripto emite A a otros inscriptos/monotributistas, B al resto
      if (condicionReceptor === CONDICIONES_IVA.INSCRIPTO ||
          condicionReceptor === CONDICIONES_IVA.MONOTRIBUTISTA) {
        return TIPOS_COMPROBANTE.A
      }
      return TIPOS_COMPROBANTE.B

    case CONDICIONES_IVA.EXENTO:
      // Exento siempre emite B
      return TIPOS_COMPROBANTE.B

    case CONDICIONES_IVA.MONOTRIBUTISTA:
      // Monotributista siempre emite C
      return TIPOS_COMPROBANTE.C

    default:
      return TIPOS_COMPROBANTE.B
  }
}

/**
 * Determina el tipo de comprobante para una COMPRA (lógica inversa)
 * basado en la condición de IVA del proveedor (emisor) y del club (receptor)
 *
 * REGLAS (desde perspectiva del proveedor):
 * - Proveedor INSCRIPTO:
 *   - A receptor INSCRIPTO o MONOTRIBUTISTA → Factura A
 *   - A cualquier otro → Factura B
 * - Proveedor EXENTO:
 *   - A cualquiera → Factura B
 * - Proveedor MONOTRIBUTISTA:
 *   - A cualquiera → Factura C
 *
 * @param {string} condicionProveedor - Condición IVA del proveedor (emisor)
 * @param {string} condicionReceptor - Condición IVA del receptor (club)
 * @returns {string} Tipo de comprobante (A, B, C)
 */
export function getTipoComprobanteCompra(condicionProveedor, condicionReceptor) {
  if (!condicionProveedor) return 'B' // Default si no hay datos

  switch (condicionProveedor) {
    case CONDICIONES_IVA.INSCRIPTO:
      // Proveedor inscripto emite A a inscriptos/monotributistas, B al resto
      if (condicionReceptor === CONDICIONES_IVA.INSCRIPTO ||
          condicionReceptor === CONDICIONES_IVA.MONOTRIBUTISTA) {
        return TIPOS_COMPROBANTE.A
      }
      return TIPOS_COMPROBANTE.B

    case CONDICIONES_IVA.EXENTO:
      return TIPOS_COMPROBANTE.B

    case CONDICIONES_IVA.MONOTRIBUTISTA:
      return TIPOS_COMPROBANTE.C

    default:
      return TIPOS_COMPROBANTE.B
  }
}

/**
 * Determina si se debe discriminar IVA
 * Solo se discrimina IVA si el EMISOR es Responsable Inscripto
 *
 * Para VENTAS: el emisor es el club
 * Para COMPRAS: el emisor es el proveedor
 *
 * @param {string} condicionEmisor - Condición IVA del emisor
 * @returns {boolean} true si se debe discriminar IVA
 */
export function debeDiscriminarIVA(condicionEmisor) {
  return condicionEmisor === CONDICIONES_IVA.INSCRIPTO
}

/**
 * Calcula los totales de una factura considerando si se discrimina IVA o no
 *
 * @param {Array} items - Array de items con { cantidad, precioUnitario, iva }
 * @param {boolean} discriminaIVA - Si se debe discriminar IVA
 * @returns {Object} { subtotal, iva21, iva105, total }
 */
export function calcularTotalesFactura(items, discriminaIVA) {
  let subtotal = 0
  let iva21 = 0
  let iva105 = 0

  for (const item of items) {
    const cantidad = parseFloat(item.cantidad) || 0
    const precio = parseFloat(item.precioUnitario) || 0
    const itemSubtotal = cantidad * precio

    if (discriminaIVA) {
      // Se discrimina IVA: subtotal es neto e IVA se suma
      subtotal += itemSubtotal
      const tasaIva = parseFloat(item.iva) || 0
      if (tasaIva === 21) {
        iva21 += itemSubtotal * 0.21
      } else if (tasaIva === 10.5) {
        iva105 += itemSubtotal * 0.105
      }
    } else {
      // No se discrimina IVA: precio ya es final
      subtotal += itemSubtotal
    }
  }

  const total = subtotal + iva21 + iva105

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    iva21: Math.round(iva21 * 100) / 100,
    iva105: Math.round(iva105 * 100) / 100,
    total: Math.round(total * 100) / 100
  }
}

/**
 * Obtiene descripción legible del tipo de comprobante
 * @param {string} tipo - A, B o C
 * @returns {string} Descripción
 */
export function getDescripcionComprobante(tipo) {
  switch (tipo) {
    case 'A':
      return 'Factura A - Discrimina IVA'
    case 'B':
      return 'Factura B - No discrimina IVA al receptor'
    case 'C':
      return 'Factura C - Sin IVA (Monotributista)'
    default:
      return 'Comprobante'
  }
}

/**
 * Obtiene color de badge según tipo de comprobante
 * @param {string} tipo - A, B o C
 * @returns {string} Clases de Tailwind para el badge
 */
export function getColorComprobante(tipo) {
  switch (tipo) {
    case 'A':
      return 'bg-blue-100 text-blue-800'
    case 'B':
      return 'bg-green-100 text-green-800'
    case 'C':
      return 'bg-purple-100 text-purple-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}
