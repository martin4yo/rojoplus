/**
 * Utilidades de Formateo
 *
 * Funciones centralizadas para formatear datos.
 * Reemplaza ~200 líneas de código duplicado en 59 archivos.
 */

/**
 * Formatea un número como moneda argentina
 * @param {number|string} value - Valor a formatear
 * @param {Object} options - Opciones adicionales
 * @returns {string} Valor formateado (ej: "$ 1.234,56")
 */
export function formatCurrency(value, options = {}) {
  const {
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    showSymbol = true
  } = options

  const numValue = Number(value) || 0

  const formatted = new Intl.NumberFormat('es-AR', {
    style: showSymbol ? 'currency' : 'decimal',
    currency: 'ARS',
    minimumFractionDigits,
    maximumFractionDigits
  }).format(numValue)

  return formatted
}

/**
 * Formatea una fecha en formato corto
 * @param {Date|string} date - Fecha a formatear
 * @param {Object} options - Opciones de formato
 * @returns {string} Fecha formateada (ej: "12/02/2026")
 */
export function formatDate(date, options = {}) {
  if (!date) return '-'

  const {
    format = 'short', // 'short', 'long', 'numeric'
    separator = '/'
  } = options

  try {
    const d = new Date(date)

    if (isNaN(d.getTime())) return '-'

    if (format === 'short') {
      // Usar UTC para evitar problemas de timezone
      const day = String(d.getUTCDate()).padStart(2, '0')
      const month = String(d.getUTCMonth() + 1).padStart(2, '0')
      const year = d.getUTCFullYear()
      return `${day}${separator}${month}${separator}${year}`
    }

    if (format === 'long') {
      // Para formato largo, usar UTC también
      return d.toLocaleDateString('es-AR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
      })
    }

    // numeric (default Intl) - usar UTC
    return d.toLocaleDateString('es-AR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'UTC'
    })
  } catch (error) {
    console.error('Error formateando fecha:', error)
    return '-'
  }
}

/**
 * Formatea fecha y hora
 * @param {Date|string} date - Fecha a formatear
 * @param {Object} options - Opciones de formato
 * @returns {string} Fecha y hora formateadas (ej: "12/02/2026 15:30")
 */
export function formatDateTime(date, options = {}) {
  if (!date) return '-'

  const {
    dateFormat = 'short',
    showSeconds = false,
    separator = ' '
  } = options

  try {
    const d = new Date(date)

    if (isNaN(d.getTime())) return '-'

    const datePart = formatDate(d, { format: dateFormat })

    const timePart = d.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      ...(showSeconds && { second: '2-digit' })
    })

    return `${datePart}${separator}${timePart}`
  } catch (error) {
    console.error('Error formateando fecha/hora:', error)
    return '-'
  }
}

/**
 * Formatea solo la hora
 * @param {Date|string} date - Fecha/hora a formatear
 * @param {Object} options - Opciones de formato
 * @returns {string} Hora formateada (ej: "15:30")
 */
export function formatTime(date, options = {}) {
  if (!date) return '-'

  const { showSeconds = false } = options

  try {
    const d = new Date(date)

    if (isNaN(d.getTime())) return '-'

    return d.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      ...(showSeconds && { second: '2-digit' })
    })
  } catch (error) {
    console.error('Error formateando hora:', error)
    return '-'
  }
}

/**
 * Formatea un porcentaje
 * @param {number} value - Valor a formatear (0-100)
 * @param {Object} options - Opciones de formato
 * @returns {string} Porcentaje formateado (ej: "45,5%")
 */
export function formatPercent(value, options = {}) {
  const {
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
    fromDecimal = false // Si true, value es 0-1, sino 0-100
  } = options

  const numValue = Number(value) || 0
  const percentValue = fromDecimal ? numValue : numValue / 100

  return new Intl.NumberFormat('es-AR', {
    style: 'percent',
    minimumFractionDigits,
    maximumFractionDigits
  }).format(percentValue)
}

/**
 * Formatea un número con separadores
 * @param {number|string} value - Valor a formatear
 * @param {Object} options - Opciones de formato
 * @returns {string} Número formateado (ej: "1.234,56")
 */
export function formatNumber(value, options = {}) {
  const {
    minimumFractionDigits = 0,
    maximumFractionDigits = 2
  } = options

  const numValue = Number(value) || 0

  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits,
    maximumFractionDigits
  }).format(numValue)
}

/**
 * Formatea un CUIL/CUIT con guiones
 * @param {string} value - CUIL/CUIT sin formato
 * @returns {string} CUIL/CUIT formateado (ej: "20-12345678-9")
 */
export function formatCUIL(value) {
  if (!value) return '-'

  const cleaned = value.replace(/\D/g, '')

  if (cleaned.length !== 11) return value

  return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 10)}-${cleaned.slice(10)}`
}

/**
 * Formatea un número de teléfono
 * @param {string} value - Teléfono sin formato
 * @returns {string} Teléfono formateado
 */
export function formatPhone(value) {
  if (!value) return '-'

  const cleaned = value.replace(/\D/g, '')

  // Formato argentino: +54 9 11 1234-5678 o similar
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 7)}-${cleaned.slice(7)}`
  }

  if (cleaned.length === 13 && cleaned.startsWith('549')) {
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 3)} ${cleaned.slice(3, 5)} ${cleaned.slice(5, 9)}-${cleaned.slice(9)}`
  }

  return value
}

/**
 * Formatea bytes a tamaño legible
 * @param {number} bytes - Tamaño en bytes
 * @param {number} decimals - Decimales a mostrar
 * @returns {string} Tamaño formateado (ej: "1,5 MB")
 */
export function formatFileSize(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`
}

/**
 * Formatea un nombre completo (capitaliza cada palabra)
 * @param {string} value - Nombre a formatear
 * @returns {string} Nombre formateado
 */
export function formatName(value) {
  if (!value) return ''

  return value
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Formatea una fecha para input type="date"
 * @param {Date|string} date - Fecha a formatear
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
export function formatDateForInput(date) {
  if (!date) return ''

  try {
    const d = new Date(date)
    if (isNaN(d.getTime())) return ''

    return d.toISOString().split('T')[0]
  } catch (error) {
    console.error('Error formateando fecha para input:', error)
    return ''
  }
}

/**
 * Formatea tiempo relativo (hace X días/horas)
 * @param {Date|string} date - Fecha a comparar
 * @returns {string} Tiempo relativo
 */
export function formatRelativeTime(date) {
  if (!date) return '-'

  try {
    const d = new Date(date)
    if (isNaN(d.getTime())) return '-'

    const now = new Date()
    const diffMs = now - d
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHour = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHour / 24)
    const diffMonth = Math.floor(diffDay / 30)
    const diffYear = Math.floor(diffDay / 365)

    if (diffSec < 60) return 'Hace unos segundos'
    if (diffMin < 60) return `Hace ${diffMin} minuto${diffMin > 1 ? 's' : ''}`
    if (diffHour < 24) return `Hace ${diffHour} hora${diffHour > 1 ? 's' : ''}`
    if (diffDay < 30) return `Hace ${diffDay} día${diffDay > 1 ? 's' : ''}`
    if (diffMonth < 12) return `Hace ${diffMonth} mes${diffMonth > 1 ? 'es' : ''}`
    return `Hace ${diffYear} año${diffYear > 1 ? 's' : ''}`
  } catch (error) {
    console.error('Error formateando tiempo relativo:', error)
    return '-'
  }
}

/**
 * Trunca un texto y agrega puntos suspensivos
 * @param {string} text - Texto a truncar
 * @param {number} maxLength - Longitud máxima
 * @returns {string} Texto truncado
 */
export function truncate(text, maxLength = 50) {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

/**
 * Capitaliza la primera letra
 * @param {string} text - Texto a capitalizar
 * @returns {string} Texto capitalizado
 */
export function capitalize(text) {
  if (!text) return ''
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

/**
 * Formatea un DNI con puntos
 * @param {string|number} value - DNI sin formato
 * @returns {string} DNI formateado (ej: "12.345.678")
 */
export function formatDNI(value) {
  if (!value) return '-'

  const cleaned = String(value).replace(/\D/g, '')

  if (cleaned.length < 7) return value

  return cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

// Exportación por defecto de todas las funciones
export default {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatTime,
  formatPercent,
  formatNumber,
  formatCUIL,
  formatPhone,
  formatFileSize,
  formatName,
  formatDateForInput,
  formatRelativeTime,
  truncate,
  capitalize,
  formatDNI
}
