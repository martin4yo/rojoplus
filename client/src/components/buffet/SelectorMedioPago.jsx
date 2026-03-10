import { Banknote, CreditCard, QrCode, ArrowRightLeft, Wallet } from 'lucide-react'

export default function SelectorMedioPago({
  mediosPago = [],
  selectedId,
  onChange,
  className = '',
  compact = false
}) {
  const getIcono = (codigo, size = 24) => {
    switch (codigo?.toUpperCase()) {
      case 'EFECTIVO':
        return <Banknote size={size} />
      case 'TARJETA':
      case 'TARJETA_DEBITO':
      case 'TARJETA_CREDITO':
        return <CreditCard size={size} />
      case 'QR':
      case 'MERCADOPAGO':
        return <QrCode size={size} />
      case 'TRANSFERENCIA':
        return <ArrowRightLeft size={size} />
      default:
        return <Wallet size={size} />
    }
  }

  const getColor = (codigo, isSelected) => {
    if (!isSelected) return 'border-gray-300 hover:border-gray-400 text-gray-700'

    switch (codigo?.toUpperCase()) {
      case 'EFECTIVO':
        return 'border-green-500 bg-green-50 text-green-700'
      case 'TARJETA':
      case 'TARJETA_DEBITO':
      case 'TARJETA_CREDITO':
        return 'border-blue-500 bg-blue-50 text-blue-700'
      case 'QR':
      case 'MERCADOPAGO':
        return 'border-purple-500 bg-purple-50 text-purple-700'
      case 'TRANSFERENCIA':
        return 'border-orange-500 bg-orange-50 text-orange-700'
      default:
        return 'border-gray-500 bg-gray-50 text-gray-700'
    }
  }

  if (mediosPago.length === 0) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
        No hay medios de pago configurados
      </div>
    )
  }

  return (
    <div className={className}>
      {!compact && (
        <p className="text-sm font-medium text-gray-700 mb-2">Medio de Pago:</p>
      )}
      <div className={`grid grid-cols-2 ${compact ? 'gap-1.5' : 'gap-2'}`}>
        {mediosPago.map(medio => {
          const isSelected = selectedId == medio.id || parseInt(selectedId) === medio.id
          const colorClasses = getColor(medio.codigo, isSelected)
          const iconSize = compact ? 18 : 24

          return (
            <button
              key={medio.id}
              type="button"
              onClick={() => onChange(medio.id)}
              className={`${compact ? 'py-3 px-2' : 'p-4'} border-2 rounded-lg font-bold flex items-center ${compact ? 'gap-2' : 'gap-3'} transition-all active:scale-95 ${colorClasses}`}
            >
              <div className="flex-shrink-0">
                {getIcono(medio.codigo, iconSize)}
              </div>
              <div className="flex-1 text-left min-w-0">
                <span className={`${compact ? 'text-xs' : 'text-sm'} leading-tight block truncate`}>
                  {medio.nombre}
                </span>
              </div>
              {isSelected && (
                <div className={`flex-shrink-0 ${compact ? 'w-4 h-4' : 'w-5 h-5'} rounded-full bg-current flex items-center justify-center`}>
                  <span className="text-white text-xs">✓</span>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
