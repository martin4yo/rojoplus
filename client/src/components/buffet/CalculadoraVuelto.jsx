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
  }, [montoNumerico, vuelto, esSuficiente, onVueltoCalculado])

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
    <div className="space-y-2">
      {/* A Pagar */}
      <div className="flex items-center justify-between bg-gray-100 rounded-lg px-4 py-3">
        <span className="text-sm font-medium text-gray-600">A Pagar:</span>
        <span className="text-xl font-bold text-gray-900">
          ${total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>

      {/* Paga con */}
      <div className="flex items-center gap-3 bg-white border-2 border-gray-300 rounded-lg px-4 py-2 focus-within:border-blue-500 overflow-hidden">
        <span className="text-sm font-medium text-gray-600 whitespace-nowrap">Paga con:</span>
        <input
          type="text"
          inputMode="decimal"
          value={montoPagado}
          onChange={handleInputChange}
          placeholder="0.00"
          className="flex-1 min-w-0 text-xl font-bold text-right outline-none bg-transparent"
          autoFocus
        />
      </div>

      {/* Vuelto */}
      {montoPagado && (
        <div className={`flex items-center justify-between rounded-lg px-4 py-3 ${
          esSuficiente
            ? 'bg-green-100 border-2 border-green-500'
            : 'bg-red-100 border-2 border-red-400'
        }`}>
          <div className="flex items-center gap-2">
            {esSuficiente ? (
              <Check size={18} className="text-green-600" />
            ) : (
              <AlertCircle size={18} className="text-red-600" />
            )}
            <span className={`text-sm font-medium ${esSuficiente ? 'text-green-700' : 'text-red-700'}`}>
              {esSuficiente ? 'Vuelto:' : 'Faltan:'}
            </span>
          </div>
          <span className={`text-xl font-bold ${esSuficiente ? 'text-green-700' : 'text-red-700'}`}>
            ${Math.abs(vuelto).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      )}
    </div>
  )
}
