import { useState, useEffect } from 'react'
import { AlertCircle, Check } from 'lucide-react'

export default function CalculadoraVuelto({
  total,
  onVueltoCalculado,
  medioPagoSeleccionado
}) {
  const [montoPagado, setMontoPagado] = useState('')

  // Calcular vuelto
  const montoNumerico = montoPagado ? parseFloat(montoPagado.replace(/[^0-9.]/g, '')) : 0
  const vuelto = montoNumerico - total
  const esSuficiente = montoNumerico >= total

  // Notificar cambios al padre
  useEffect(() => {
    onVueltoCalculado?.({
      montoPagado: montoNumerico,
      vuelto: vuelto > 0 ? vuelto : 0,
      esSuficiente
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [montoNumerico, vuelto, esSuficiente])

  // Auto-llenar con el total al montar o cuando cambia el total
  useEffect(() => {
    if (total && !montoPagado) {
      setMontoPagado(total.toString())
    }
  }, [total])

  // Auto-llenar cuando cambia el medio de pago a electrónico
  useEffect(() => {
    if (medioPagoSeleccionado && ['TARJETA', 'QR', 'TRANSFERENCIA'].includes(medioPagoSeleccionado.codigo)) {
      setMontoPagado(total.toString())
    }
  }, [medioPagoSeleccionado, total])

  const handleInputChange = (e) => {
    const valor = e.target.value.replace(/[^0-9.]/g, '')
    setMontoPagado(valor)
  }

  // Solo mostrar calculadora si es efectivo o no hay medio seleccionado
  const mostrarCalculadora = !medioPagoSeleccionado || medioPagoSeleccionado.codigo === 'EFECTIVO'

  if (!mostrarCalculadora) {
    return null
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {/* Total a Pagar */}
      <div className="flex flex-col justify-center bg-gray-100 rounded-lg px-3 py-2.5">
        <span className="text-xs font-medium text-gray-600 mb-1">Total a Pagar:</span>
        <span className="text-lg font-bold text-gray-900 truncate">
          ${total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>

      {/* Paga con */}
      <div className="flex flex-col justify-center bg-white border-2 border-gray-300 rounded-lg px-3 py-2.5 focus-within:border-blue-500">
        <label className="text-xs font-medium text-gray-600 mb-1">Paga con:</label>
        <input
          type="text"
          inputMode="decimal"
          value={montoPagado}
          onChange={handleInputChange}
          placeholder="0.00"
          className="text-lg font-bold text-left outline-none bg-transparent"
          autoFocus
        />
      </div>

      {/* Vuelto */}
      <div className={`flex flex-col justify-center rounded-lg px-3 py-2.5 ${
        montoPagado
          ? esSuficiente
            ? 'bg-green-100 border-2 border-green-500'
            : 'bg-red-100 border-2 border-red-400'
          : 'bg-gray-50 border-2 border-gray-200'
      }`}>
        <div className="flex items-center gap-1.5 mb-1">
          {montoPagado && (esSuficiente ? (
            <Check size={14} className="text-green-600" />
          ) : (
            <AlertCircle size={14} className="text-red-600" />
          ))}
          <span className={`text-xs font-medium ${
            montoPagado
              ? esSuficiente ? 'text-green-700' : 'text-red-700'
              : 'text-gray-500'
          }`}>
            {montoPagado ? (esSuficiente ? 'Vuelto:' : 'Faltan:') : 'Vuelto:'}
          </span>
        </div>
        <span className={`text-lg font-bold truncate ${
          montoPagado
            ? esSuficiente ? 'text-green-700' : 'text-red-700'
            : 'text-gray-400'
        }`}>
          ${montoPagado ? Math.abs(vuelto).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
        </span>
      </div>
    </div>
  )
}
