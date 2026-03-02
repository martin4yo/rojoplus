import { useState, useEffect, useRef } from 'react'
import { Percent } from 'lucide-react'

export default function PropinaSelector({
  subtotal,
  onPropinaChange,
  className = '',
  compact = false
}) {
  const [porcentajeSeleccionado, setPorcentajeSeleccionado] = useState(0)
  const [montoCustom, setMontoCustom] = useState('')
  const prevValuesRef = useRef({ porcentaje: 0, monto: 0, esCustom: false })

  const porcentajes = [0, 10, 15, 20]

  // Calcular monto de propina
  const montoPropina = montoCustom
    ? parseFloat(montoCustom) || 0
    : (subtotal * porcentajeSeleccionado / 100)

  // Notificar cambios al padre solo cuando los valores realmente cambien
  useEffect(() => {
    const newValues = {
      porcentaje: porcentajeSeleccionado,
      monto: montoPropina,
      esCustom: !!montoCustom
    }

    // Solo notificar si los valores cambiaron
    if (
      prevValuesRef.current.porcentaje !== newValues.porcentaje ||
      prevValuesRef.current.monto !== newValues.monto ||
      prevValuesRef.current.esCustom !== newValues.esCustom
    ) {
      prevValuesRef.current = newValues
      onPropinaChange?.(newValues)
    }
  }, [montoPropina, porcentajeSeleccionado, montoCustom]) // Quitamos onPropinaChange de las dependencias

  const handlePorcentajeClick = (porcentaje) => {
    setPorcentajeSeleccionado(porcentaje)
    setMontoCustom('') // Limpiar custom al seleccionar porcentaje
  }

  const handleCustomChange = (e) => {
    const valor = e.target.value.replace(/[^0-9.]/g, '')
    setMontoCustom(valor)
    setPorcentajeSeleccionado(0) // Limpiar porcentaje al usar custom
  }

  return (
    <div className={`border-t ${compact ? 'pt-2' : 'pt-3'} ${className}`}>
      {!compact && (
        <div className="flex items-center gap-2 mb-2">
          <Percent size={16} className="text-gray-500" />
          <p className="text-sm font-medium text-gray-700">Propina (opcional):</p>
        </div>
      )}

      {/* Layout compacto: botones + input en misma línea */}
      {compact ? (
        <div className="flex items-center gap-1.5">
          {/* Botones de porcentajes más pequeños */}
          <div className="flex gap-1">
            {porcentajes.map(porc => {
              const isSelected = porcentajeSeleccionado === porc && !montoCustom
              const label = porc === 0 ? '0%' : `${porc}%`

              return (
                <button
                  key={porc}
                  type="button"
                  onClick={() => handlePorcentajeClick(porc)}
                  className={`py-1 px-2 border-2 rounded text-xs font-medium transition-all ${
                    isSelected
                      ? porc === 0
                        ? 'bg-gray-100 border-gray-400 text-gray-700'
                        : 'bg-green-100 border-green-500 text-green-700'
                      : 'border-gray-300 hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Input custom inline */}
          <input
            type="text"
            value={montoCustom}
            onChange={handleCustomChange}
            placeholder="Otra $"
            className="w-20 border border-gray-300 rounded px-2 py-1 text-xs focus:border-green-500 focus:ring-1 focus:ring-green-200 outline-none"
          />

          {/* Display de total */}
          {montoPropina > 0 && (
            <span className="font-bold text-green-600 text-sm ml-auto">
              +${montoPropina.toLocaleString('es-AR', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
              })}
            </span>
          )}
        </div>
      ) : (
        <>
          {/* Botones de porcentajes */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {porcentajes.map(porc => {
              const isSelected = porcentajeSeleccionado === porc && !montoCustom
              const label = porc === 0 ? 'Sin propina' : `${porc}%`

              return (
                <button
                  key={porc}
                  type="button"
                  onClick={() => handlePorcentajeClick(porc)}
                  className={`py-2 px-1 border-2 rounded-lg text-sm font-medium transition-all ${
                    isSelected
                      ? porc === 0
                        ? 'bg-gray-100 border-gray-400 text-gray-700'
                        : 'bg-green-100 border-green-500 text-green-700'
                      : 'border-gray-300 hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Input custom y display */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={montoCustom}
              onChange={handleCustomChange}
              placeholder="Otra cantidad"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none"
            />
            <span className="text-sm text-gray-500">o</span>
            <div className="w-24 text-right">
              {montoPropina > 0 && (
                <span className="font-bold text-green-600">
                  ${montoPropina.toLocaleString('es-AR', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2
                  })}
                </span>
              )}
            </div>
          </div>
        </>
      )}

      {/* Resumen si hay propina */}
      {montoPropina > 0 && !compact && (
        <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-sm">
          <div className="flex justify-between items-center">
            <span className="text-green-700">
              {montoCustom ? 'Propina' : `Propina (${porcentajeSeleccionado}%)`}:
            </span>
            <span className="font-bold text-green-700">
              ${montoPropina.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
