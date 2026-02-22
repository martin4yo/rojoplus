import { useState, useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import TecladoNumerico from '../TecladoNumerico'

export default function CalculadoraVuelto({
  total,
  onVueltoCalculado,
  medioPagoSeleccionado,
  showTeclado = true,
  autoFocus = false,
  compact = false
}) {
  const [montoPagado, setMontoPagado] = useState('')
  const [mostrarTeclado, setMostrarTeclado] = useState(showTeclado)

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

  // Auto-llenar con exacto si es pago electrónico
  useEffect(() => {
    if (medioPagoSeleccionado && ['TARJETA', 'QR', 'TRANSFERENCIA'].includes(medioPagoSeleccionado.codigo)) {
      setMontoPagado(total.toString())
    }
  }, [medioPagoSeleccionado, total])

  const handleTecladoInput = (valor) => {
    setMontoPagado(prev => {
      const actual = prev.replace(/[^0-9.]/g, '')
      // Evitar múltiples puntos decimales
      if (valor === '.' && actual.includes('.')) return prev
      return actual + valor
    })
  }

  const handleClear = () => {
    setMontoPagado('')
  }

  const handleOk = () => {
    // Opcional: cerrar teclado si es desplegable
    if (!showTeclado) {
      setMostrarTeclado(false)
    }
  }

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
    <div className={`border-t ${compact ? 'pt-2' : 'pt-4'}`}>
      {/* Layout compacto: Teclado a la izquierda, Inputs a la derecha */}
      {compact ? (
        <div className="flex gap-3">
          {/* Teclado numérico a la izquierda - más pequeño */}
          {mostrarTeclado && (
            <div className="flex-shrink-0">
              <TecladoNumerico
                onInput={handleTecladoInput}
                onClear={handleClear}
                onEnter={handleOk}
                compact={true}
              />
            </div>
          )}

          {/* Inputs a la derecha */}
          <div className="flex-1 space-y-2">
            {/* Input de monto pagado */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Pago con:
              </label>
              <input
                type="text"
                value={montoPagado}
                onChange={handleInputChange}
                onFocus={() => !showTeclado && setMostrarTeclado(true)}
                placeholder="Ingrese el monto"
                className="w-full text-xl p-2 font-bold border-2 rounded-lg text-right focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none"
                autoFocus={autoFocus}
              />
            </div>

            {/* Display de vuelto debajo - alineado a la derecha */}
            {montoPagado && (
              <div>
                {vuelto >= 0 ? (
                  <div className="p-2 bg-green-50 border-2 border-green-500 rounded-lg text-right">
                    <p className="text-xs text-green-700 mb-1">Vuelto:</p>
                    <p className="text-2xl font-bold text-green-700 tabular-nums">
                      ${vuelto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                ) : (
                  <div className="p-2 bg-red-50 border-2 border-red-300 rounded-lg flex items-start gap-2">
                    <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 text-right">
                      <p className="text-xs font-medium text-red-700">Monto insuficiente</p>
                      <p className="text-xs text-red-600 mt-1">
                        Faltan: ${Math.abs(vuelto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Layout normal: Todo en columna */
        <div className="space-y-3">
          {/* Input de monto pagado */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pago con:
            </label>
            <input
              type="text"
              value={montoPagado}
              onChange={handleInputChange}
              onFocus={() => !showTeclado && setMostrarTeclado(true)}
              placeholder="Ingrese el monto"
              className="w-full text-2xl p-3 font-bold border-2 rounded-lg text-right focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none"
              autoFocus={autoFocus}
            />
          </div>

          {/* Teclado numérico */}
          {mostrarTeclado && (
            <TecladoNumerico
              onInput={handleTecladoInput}
              onClear={handleClear}
              onEnter={handleOk}
              compact={false}
            />
          )}

          {/* Display de vuelto - alineado a la derecha */}
          {montoPagado && (
            <div>
              {vuelto >= 0 ? (
                <div className="p-4 bg-green-50 border-2 border-green-500 rounded-lg text-right">
                  <p className="text-sm text-green-700 mb-1">Vuelto:</p>
                  <p className="text-4xl font-bold text-green-700 tabular-nums">
                    ${vuelto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-red-50 border-2 border-red-300 rounded-lg flex items-start gap-2">
                  <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 text-right">
                    <p className="text-sm font-medium text-red-700">Monto insuficiente</p>
                    <p className="text-xs text-red-600 mt-1">
                      Faltan: ${Math.abs(vuelto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
