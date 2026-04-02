import { useState, useEffect, useRef } from 'react'
import { X, Plus, AlertTriangle } from 'lucide-react'
import SelectorMedioPago from './SelectorMedioPago'

export default function PagoMultiple({
  total,
  mediosPago = [],
  onPagosChange,
  className = ''
}) {
  const [pagosParciales, setPagosParciales] = useState([])
  const [nuevoPago, setNuevoPago] = useState({ medioPagoId: '', monto: '' })

  // Calcular totales
  const totalPagado = pagosParciales.reduce((sum, p) => sum + parseFloat(p.monto || 0), 0)
  const totalPendiente = total - totalPagado

  // Ref para evitar que onPagosChange (nueva referencia cada render del padre) cause loop
  const onPagosChangeRef = useRef(onPagosChange)
  useEffect(() => { onPagosChangeRef.current = onPagosChange })

  // Notificar cambios al padre — solo depende de datos propios, no de la función prop
  useEffect(() => {
    const pagado = pagosParciales.reduce((sum, p) => sum + parseFloat(p.monto || 0), 0)
    const pendiente = total - pagado
    onPagosChangeRef.current?.({
      pagos: pagosParciales,
      totalPagado: pagado,
      totalPendiente: pendiente,
      esCompleto: pendiente <= 0
    })
  }, [pagosParciales, total])

  const handleAgregarPago = () => {
    if (!nuevoPago.medioPagoId || !nuevoPago.monto || parseFloat(nuevoPago.monto) <= 0) {
      return
    }

    const monto = parseFloat(nuevoPago.monto)

    // Validar que no exceda el total pendiente
    if (totalPagado + monto > total) {
      // Ajustar al monto pendiente exacto
      const montoAjustado = totalPendiente
      setPagosParciales(prev => [...prev, {
        medioPagoId: parseInt(nuevoPago.medioPagoId),
        monto: montoAjustado
      }])
    } else {
      setPagosParciales(prev => [...prev, {
        medioPagoId: parseInt(nuevoPago.medioPagoId),
        monto
      }])
    }

    setNuevoPago({ medioPagoId: '', monto: '' })
  }

  const handleEliminarPago = (index) => {
    setPagosParciales(prev => prev.filter((_, i) => i !== index))
  }

  const handleLlenarExacto = () => {
    if (totalPendiente > 0 && nuevoPago.medioPagoId) {
      setNuevoPago(prev => ({
        ...prev,
        monto: totalPendiente.toFixed(2)
      }))
    }
  }

  const getMedioNombre = (medioPagoId) => {
    const medio = mediosPago.find(m => m.id === medioPagoId)
    return medio?.nombre || 'Desconocido'
  }

  // Auto-seleccionar efectivo cuando los medios de pago se cargan por primera vez
  // Depende solo de mediosPago.length para no dispararse en cada render del padre
  useEffect(() => {
    if (mediosPago.length > 0) {
      const efectivo = mediosPago.find(m => m.codigo === 'EFECTIVO')
      if (efectivo) {
        setNuevoPago(prev => prev.medioPagoId ? prev : { ...prev, medioPagoId: efectivo.id })
      }
    }
  }, [mediosPago.length]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`border-t pt-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="font-medium text-gray-700">Pagos Parciales:</p>
        {pagosParciales.length > 0 && (
          <button
            type="button"
            onClick={() => setPagosParciales([])}
            className="text-xs text-red-600 hover:underline"
          >
            Limpiar todos
          </button>
        )}
      </div>

      {/* Lista de pagos agregados */}
      {pagosParciales.length > 0 && (
        <div className="space-y-2 mb-4">
          {pagosParciales.map((pago, idx) => {
            const medio = mediosPago.find(m => m.id === pago.medioPagoId)

            return (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
              >
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-sm font-medium text-green-700">
                    {medio?.nombre || 'Medio de pago'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-green-700 tabular-nums">
                    ${parseFloat(pago.monto).toLocaleString('es-AR', {
                      minimumFractionDigits: 2
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleEliminarPago(idx)}
                    className="p-1 text-red-600 hover:bg-red-100 rounded transition"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Agregar nuevo pago */}
      {totalPendiente > 0 && (
        <div className="space-y-3 mb-4">
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-xs text-gray-600 mb-2">Agregar pago:</p>

            {/* Selector de medio de pago compacto */}
            <div className="mb-3">
              <select
                value={nuevoPago.medioPagoId}
                onChange={(e) => setNuevoPago({ ...nuevoPago, medioPagoId: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
              >
                <option value="">Seleccionar medio...</option>
                {mediosPago.map(m => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
              </select>
            </div>

            {/* Input de monto */}
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                value={nuevoPago.monto}
                onChange={(e) => setNuevoPago({ ...nuevoPago, monto: e.target.value })}
                placeholder="Monto"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
              />
              <button
                type="button"
                onClick={handleLlenarExacto}
                disabled={!nuevoPago.medioPagoId}
                className="px-3 py-2 bg-gray-200 text-gray-700 text-xs rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
                title="Llenar con el monto exacto pendiente"
              >
                Exacto
              </button>
            </div>

            <button
              type="button"
              onClick={handleAgregarPago}
              disabled={!nuevoPago.medioPagoId || !nuevoPago.monto || parseFloat(nuevoPago.monto) <= 0}
              className="w-full mt-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 text-sm font-medium"
            >
              <Plus size={16} />
              Agregar Pago
            </button>
          </div>
        </div>
      )}

      {/* Resumen */}
      <div className="p-4 bg-gray-100 rounded-lg space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Total a cobrar:</span>
          <span className="font-bold tabular-nums">
            ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Pagado:</span>
          <span className="font-bold text-green-600 tabular-nums">
            ${totalPagado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex justify-between font-bold border-t border-gray-300 pt-2">
          <span>Pendiente:</span>
          <span className={`tabular-nums ${totalPendiente > 0 ? 'text-red-600' : 'text-green-600'}`}>
            ${Math.abs(totalPendiente).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </span>
        </div>

        {/* Advertencia de exceso */}
        {totalPendiente < 0 && (
          <div className="flex items-start gap-2 p-2 bg-yellow-50 border border-yellow-300 rounded text-xs text-yellow-700">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            <span>El total de pagos excede el monto a cobrar</span>
          </div>
        )}
      </div>
    </div>
  )
}
