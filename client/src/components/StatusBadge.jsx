import React from 'react'

/**
 * Componente de badge para estados
 *
 * Reemplaza lógica duplicada en 10+ archivos donde se determina
 * el color según el estado usando if/else o funciones repetidas.
 *
 * Soporta múltiples tipos (socio, pago, cuota, comanda, etc.) con
 * configuraciones de colores específicas.
 *
 * @param {Object} props - Props del componente
 * @param {string} props.status - Estado a mostrar
 * @param {string} props.type - Tipo de badge (socio, pago, cuota, etc.)
 * @param {string} props.className - Clases CSS adicionales
 * @param {string} props.size - Tamaño (sm, md, lg) default: md
 *
 * @example
 * // Badge de socio
 * <StatusBadge status="ACTIVO" type="socio" />
 * <StatusBadge status="BAJA" type="socio" />
 *
 * @example
 * // Badge de pago
 * <StatusBadge status="PAGADO" type="pago" />
 * <StatusBadge status="PENDIENTE" type="pago" />
 *
 * @example
 * // Badge de cuota
 * <StatusBadge status="VENCIDA" type="cuota" size="lg" />
 */

// Configuraciones de colores por tipo
const STATUS_CONFIGS = {
  socio: {
    vigente: { color: 'green', keywords: ['vigent'] },
    activo: { color: 'green', keywords: ['activ'] },
    baja: { color: 'red', keywords: ['baja'] },
    suspendido: { color: 'red', keywords: ['suspend'] },
    pendiente: { color: 'yellow', keywords: ['pendiente', 'revision'] },
    default: { color: 'gray' }
  },

  pago: {
    pagado: { color: 'green', label: 'PAGADO', keywords: ['pagad', 'cobrad', 'aprobad'] },
    pendiente: { color: 'yellow', label: 'PENDIENTE', keywords: ['pendiente', 'proceso'] },
    rechazado: { color: 'red', label: 'RECHAZADO', keywords: ['rechazad', 'cancelad', 'fallid'] },
    vencido: { color: 'red', label: 'VENCIDO', keywords: ['vencid'] },
    default: { color: 'gray' }
  },

  cuota: {
    pagada: { color: 'green', label: 'PAGADA', keywords: ['pagad'] },
    pendiente: { color: 'yellow', label: 'PENDIENTE', keywords: ['pendiente'] },
    vencida: { color: 'red', label: 'VENCIDA', keywords: ['vencid'] },
    financiada: { color: 'blue', label: 'FINANCIADA', keywords: ['financiad'] },
    anulada: { color: 'gray', label: 'ANULADA', keywords: ['anulad'] },
    default: { color: 'yellow' }
  },

  comanda: {
    abierta: { color: 'blue', label: 'ABIERTA', keywords: ['abiert'] },
    en_preparacion: { color: 'yellow', label: 'EN PREPARACIÓN', keywords: ['preparacion', 'preparando'] },
    cuenta_pedida: { color: 'orange', label: 'CUENTA PEDIDA', keywords: ['cuenta'] },
    cerrada: { color: 'green', label: 'CERRADA', keywords: ['cerrad', 'pagad'] },
    anulada: { color: 'red', label: 'ANULADA', keywords: ['anulad', 'cancelad'] },
    default: { color: 'gray' }
  },

  pedido: {
    pendiente: { color: 'yellow', label: 'PENDIENTE', keywords: ['pendiente'] },
    parcial: { color: 'blue', label: 'PARCIAL', keywords: ['parcial'] },
    facturado: { color: 'green', label: 'FACTURADO', keywords: ['facturad'] },
    cancelado: { color: 'red', label: 'CANCELADO', keywords: ['cancelad'] },
    recibido: { color: 'blue', label: 'RECIBIDO', keywords: ['recibid'] },
    en_preparacion: { color: 'yellow', label: 'EN PREPARACIÓN', keywords: ['preparacion'] },
    listo: { color: 'green', label: 'LISTO', keywords: ['list', 'complet'] },
    entregado: { color: 'green', label: 'ENTREGADO', keywords: ['entregad'] },
    default: { color: 'gray' }
  },

  itemComanda: {
    pendiente: { color: 'yellow', label: 'PENDIENTE', keywords: ['pendiente'] },
    enviado_cocina: { color: 'blue', label: 'EN COCINA', keywords: ['enviado_cocina', 'cocina'] },
    enviado_barra: { color: 'blue', label: 'EN BARRA', keywords: ['enviado_barra', 'barra'] },
    listo: { color: 'green', label: 'LISTO', keywords: ['list'] },
    entregado: { color: 'green', label: 'ENTREGADO', keywords: ['entregad'] },
    anulado: { color: 'red', label: 'ANULADO', keywords: ['anulad', 'cancelad'] },
    default: { color: 'gray' }
  },

  pedidoTakeAway: {
    recibido: { color: 'yellow', label: 'RECIBIDO', keywords: ['recibid'] },
    pendiente: { color: 'yellow', label: 'PENDIENTE', keywords: ['pendiente'] },
    en_preparacion: { color: 'blue', label: 'EN PREPARACIÓN', keywords: ['preparacion'] },
    listo: { color: 'green', label: 'LISTO', keywords: ['list'] },
    pagado: { color: 'green', label: 'PAGADO', keywords: ['pagad'] },
    entregado: { color: 'gray', label: 'ENTREGADO', keywords: ['entregad'] },
    cancelado: { color: 'red', label: 'CANCELADO', keywords: ['cancelad'] },
    default: { color: 'gray' }
  },

  inscripcion: {
    activa: { color: 'green', label: 'ACTIVA', keywords: ['activ', 'vigent'] },
    finalizada: { color: 'gray', label: 'FINALIZADA', keywords: ['finalizad', 'completad'] },
    suspendida: { color: 'red', label: 'SUSPENDIDA', keywords: ['suspend'] },
    default: { color: 'gray' }
  },

  partido: {
    pendiente: { color: 'yellow', label: 'PENDIENTE', keywords: ['pendiente', 'programad'] },
    jugado: { color: 'green', label: 'JUGADO', keywords: ['jugad', 'finalizad'] },
    suspendido: { color: 'red', label: 'SUSPENDIDO', keywords: ['suspend', 'cancelad'] },
    default: { color: 'gray' }
  },

  convocatoria: {
    confirmado: { color: 'green', label: 'CONFIRMADO', keywords: ['confirmad', 'aceptad'] },
    pendiente: { color: 'yellow', label: 'PENDIENTE', keywords: ['pendiente'] },
    rechazado: { color: 'red', label: 'RECHAZADO', keywords: ['rechazad'] },
    default: { color: 'gray' }
  },

  asistencia: {
    presente: { color: 'green', label: 'PRESENTE', keywords: ['presente', 'asistio'] },
    ausente: { color: 'red', label: 'AUSENTE', keywords: ['ausente', 'falta'] },
    justificado: { color: 'blue', label: 'JUSTIFICADO', keywords: ['justificad'] },
    tarde: { color: 'yellow', label: 'TARDE', keywords: ['tarde', 'demora'] },
    default: { color: 'gray' }
  },

  comercio: {
    activo: { color: 'green', label: 'ACTIVO', keywords: ['activ', 'aprobad'] },
    pendiente: { color: 'yellow', label: 'PENDIENTE', keywords: ['pendiente', 'revision'] },
    rechazado: { color: 'red', label: 'RECHAZADO', keywords: ['rechazad'] },
    suspendido: { color: 'red', label: 'SUSPENDIDO', keywords: ['suspend'] },
    default: { color: 'gray' }
  },

  movimientoStock: {
    ingreso: { color: 'green', label: 'Ingreso', keywords: ['ingreso'] },
    egreso: { color: 'red', label: 'Egreso', keywords: ['egreso'] },
    ajuste: { color: 'blue', label: 'Ajuste', keywords: ['ajuste'] },
    default: { color: 'gray' }
  },

  // Tipo genérico para casos no específicos
  generic: {
    success: { color: 'green', keywords: ['exito', 'ok', 'correcto', 'activ', 'aprobad', 'pagad', 'cobrad'] },
    warning: { color: 'yellow', keywords: ['pendiente', 'proceso', 'espera', 'revision'] },
    error: { color: 'red', keywords: ['error', 'fallid', 'rechazad', 'cancelad', 'vencid'] },
    info: { color: 'blue', keywords: ['info', 'proceso'] },
    default: { color: 'gray' }
  }
}

// Mapeo de colores a clases de Tailwind
const COLOR_CLASSES = {
  green: 'bg-green-100 text-green-800 border-green-200',
  red: 'bg-red-100 text-red-800 border-red-200',
  yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  blue: 'bg-blue-100 text-blue-800 border-blue-200',
  gray: 'bg-gray-100 text-gray-800 border-gray-200',
  orange: 'bg-orange-100 text-orange-800 border-orange-200',
  purple: 'bg-purple-100 text-purple-800 border-purple-200'
}

// Tamaños
const SIZE_CLASSES = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm'
}

export default function StatusBadge({
  status,
  type = 'generic',
  className = '',
  size = 'md'
}) {
  if (!status) return null

  // Obtener configuración del tipo
  const config = STATUS_CONFIGS[type] || STATUS_CONFIGS.generic

  // Normalizar status
  const statusLower = String(status).toLowerCase().trim()

  // Buscar configuración que coincida
  let matchedConfig = config.default
  let matchedLabel = status.toUpperCase()

  for (const [key, value] of Object.entries(config)) {
    if (key === 'default') continue

    // Verificar si el status coincide con alguna keyword
    if (value.keywords && value.keywords.some(kw => statusLower.includes(kw))) {
      matchedConfig = value
      matchedLabel = value.label || status.toUpperCase()
      break
    }

    // Verificar coincidencia exacta con el key
    if (key.toLowerCase() === statusLower.replace(/_/g, ' ')) {
      matchedConfig = value
      matchedLabel = value.label || status.toUpperCase()
      break
    }
  }

  // Obtener clases de color
  const colorClass = COLOR_CLASSES[matchedConfig.color] || COLOR_CLASSES.gray

  // Obtener clase de tamaño
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md

  return (
    <span
      className={`
        inline-flex items-center
        font-medium
        rounded-full
        border
        ${colorClass}
        ${sizeClass}
        ${className}
      `}
      title={status}
    >
      {matchedLabel}
    </span>
  )
}

/**
 * Variante con punto de color
 */
export function StatusDot({ status, type = 'generic', className = '' }) {
  if (!status) return null

  const config = STATUS_CONFIGS[type] || STATUS_CONFIGS.generic
  const statusLower = String(status).toLowerCase().trim()

  let matchedColor = config.default?.color || 'gray'

  for (const [key, value] of Object.entries(config)) {
    if (key === 'default') continue
    if (value.keywords && value.keywords.some(kw => statusLower.includes(kw))) {
      matchedColor = value.color
      break
    }
  }

  const dotColors = {
    green: 'bg-green-500',
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    blue: 'bg-blue-500',
    gray: 'bg-gray-500',
    orange: 'bg-orange-500'
  }

  return (
    <span className={`inline-flex items-center ${className}`}>
      <span className={`w-2 h-2 rounded-full ${dotColors[matchedColor]}`} />
    </span>
  )
}
