import { X } from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'

const COLOR_CLASSES = {
  orange: 'bg-orange-100 text-orange-700',
  purple: 'bg-purple-100 text-purple-700',
  blue:   'bg-blue-100 text-blue-700',
  green:  'bg-green-100 text-green-700',
  gray:   'bg-gray-100 text-gray-700',
}

/**
 * Modal de detalle de pedido (solo lectura).
 *
 * Props:
 *  - numero      : string
 *  - tipoLabel   : string          — ej. "Mesa 5", "TakeAway", "Delivery"
 *  - tipoColor   : keyof COLOR_CLASSES (default 'gray')
 *  - fecha       : string | Date
 *  - total       : number
 *  - items       : array | null    — null = cargando
 *  - onClose     : () => void
 *  - onGestionar : () => void | undefined — muestra botón "Gestionar →" si se provee
 */
export default function DetallePedidoModal({
  numero,
  tipoLabel,
  tipoColor = 'gray',
  fecha,
  total,
  items,
  onClose,
  onGestionar,
}) {
  const badgeClass = COLOR_CLASSES[tipoColor] ?? COLOR_CLASSES.gray

  const fechaStr = fecha
    ? new Date(fecha).toLocaleString('es-AR', {
        hour: '2-digit', minute: '2-digit',
        day: '2-digit', month: '2-digit',
      })
    : ''

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-800">{numero}</span>
            {tipoLabel && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeClass}`}>
                {tipoLabel}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-400"
          >
            <X size={16} />
          </button>
        </div>

        {/* Items */}
        <div className="overflow-y-auto flex-1 p-4">
          {items === null ? (
            <div className="py-8 text-center text-sm text-gray-400">Cargando...</div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">Sin detalle disponible</div>
          ) : (
            <div className="space-y-2">
              {items.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-2 py-1.5 border-b border-gray-50 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-700">
                      {item.cantidad}x{' '}
                      {item.productoBuffet?.nombre || item.producto?.nombre || item.nombre || '—'}
                    </span>
                    {item.observaciones && (
                      <p className="text-xs text-gray-400 mt-0.5">{item.observaciones}</p>
                    )}
                  </div>
                  <span className="text-sm font-medium text-gray-800 whitespace-nowrap">
                    {formatCurrency(Number(item.subtotal || 0))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 flex justify-between items-center gap-4">
          <span className="text-sm text-gray-500">{fechaStr}</span>
          <div className="flex items-center gap-4">
            {onGestionar && (
              <button
                onClick={onGestionar}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Gestionar →
              </button>
            )}
            <span className="font-bold text-gray-800">{formatCurrency(total || 0)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
