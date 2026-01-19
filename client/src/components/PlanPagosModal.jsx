import { useState, useEffect } from 'react'
import { X, Calendar, Percent, Calculator, CreditCard, Loader2 } from 'lucide-react'
import { Button } from './Button'
import api from '../services/api'

/**
 * Modal para generar un plan de pagos
 * @param {boolean} isOpen - Si el modal está abierto
 * @param {function} onClose - Callback para cerrar el modal
 * @param {number} socioId - ID del socio
 * @param {array} cuotasSeleccionadas - Array de cuotas seleccionadas {id, descripcion, monto}
 * @param {function} onSuccess - Callback cuando se genera el plan exitosamente
 */
export function PlanPagosModal({ isOpen, onClose, socioId, cuotasSeleccionadas, onSuccess }) {
  const [cantidadCuotas, setCantidadCuotas] = useState(3)
  const [interesPct, setInteresPct] = useState(0)
  const [fechaPrimerVencimiento, setFechaPrimerVencimiento] = useState('')
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [error, setError] = useState(null)

  // Función para obtener fecha por defecto
  function getFechaDefault() {
    const hoy = new Date()
    const proxMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 10)
    return proxMes.toISOString().split('T')[0]
  }

  // Inicializar cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      setPreview(null)
      setError(null)
      if (!fechaPrimerVencimiento) {
        setFechaPrimerVencimiento(getFechaDefault())
      }
    }
  }, [isOpen])

  // Cargar preview cuando hay datos suficientes
  useEffect(() => {
    if (!isOpen || !cuotasSeleccionadas?.length || !fechaPrimerVencimiento) {
      return
    }

    const cargar = async () => {
      setLoadingPreview(true)
      setError(null)
      try {
        const cuotaIds = cuotasSeleccionadas.map(c => c.id)
        console.log('Cargando preview con:', { cuotaIds, cantidadCuotas, interesPct, fechaPrimerVencimiento })

        const res = await api.post('/admin/planes-pago/preview', {
          cuotaIds,
          cantidadCuotas,
          interesPct,
          fechaPrimerVencimiento,
        })
        console.log('Preview response:', res)
        setPreview(res)
      } catch (err) {
        console.error('Error cargando preview:', err)
        setError(err.message || 'Error al calcular preview')
      } finally {
        setLoadingPreview(false)
      }
    }

    cargar()
  }, [isOpen, cuotasSeleccionadas, cantidadCuotas, interesPct, fechaPrimerVencimiento])

  async function handleGenerar() {
    setLoading(true)
    setError(null)
    try {
      console.log('Generando plan con socioId:', socioId)
      const res = await api.post('/admin/planes-pago', {
        socioId,
        cuotaIds: cuotasSeleccionadas.map(c => c.id),
        cantidadCuotas,
        interesPct,
        fechaPrimerVencimiento,
      })
      if (onSuccess) onSuccess(res)
      onClose()
    } catch (err) {
      setError(err.message || 'Error al generar plan de pagos')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value)
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T12:00:00')
    return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <CreditCard className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">Plan de Pagos</h3>
              <p className="text-sm text-gray-500">
                Financiar {cuotasSeleccionadas?.length || 0} cuota(s) seleccionada(s)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Configuración del plan */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {/* Cantidad de cuotas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calculator className="w-4 h-4 inline mr-1" />
                Cuotas
              </label>
              <select
                value={cantidadCuotas}
                onChange={(e) => setCantidadCuotas(parseInt(e.target.value))}
                className="input-field w-full"
              >
                {[2, 3, 4, 5, 6, 9, 12, 18, 24].map(n => (
                  <option key={n} value={n}>{n} cuotas</option>
                ))}
              </select>
            </div>

            {/* Interés */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Percent className="w-4 h-4 inline mr-1" />
                Interés
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={interesPct}
                  onChange={(e) => setInteresPct(parseFloat(e.target.value) || 0)}
                  className="input-field w-full"
                  min="0"
                  max="100"
                  step="1"
                />
                <span className="text-gray-500">%</span>
              </div>
            </div>

            {/* Fecha primer vencimiento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                1er Vencimiento
              </label>
              <input
                type="date"
                value={fechaPrimerVencimiento}
                onChange={(e) => setFechaPrimerVencimiento(e.target.value)}
                className="input-field w-full"
              />
            </div>
          </div>

          {/* Preview */}
          {loadingPreview ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-gray-500">Calculando...</span>
            </div>
          ) : preview ? (
            <div className="space-y-4">
              {/* Resumen de deuda */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-3">Deuda a Financiar</h4>
                <div className="space-y-1 text-sm">
                  {preview.cuotasAFinanciar?.map((c, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="text-gray-600">{c.descripcion}</span>
                      <span>
                        {formatCurrency(c.montoOriginal)}
                        {c.recargo > 0 && (
                          <span className="text-red-600 ml-1">+{formatCurrency(c.recargo)}</span>
                        )}
                      </span>
                    </div>
                  ))}
                  <div className="border-t pt-2 mt-2 flex justify-between font-medium">
                    <span>Subtotal deuda</span>
                    <span>{formatCurrency(preview.resumen?.subtotal)}</span>
                  </div>
                  {preview.resumen?.montoInteres > 0 && (
                    <div className="flex justify-between text-yellow-700">
                      <span>Interés ({preview.resumen?.interesPct}%)</span>
                      <span>+{formatCurrency(preview.resumen?.montoInteres)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg pt-1">
                    <span>Total a Financiar</span>
                    <span className="text-primary">{formatCurrency(preview.resumen?.totalAFinanciar)}</span>
                  </div>
                </div>
              </div>

              {/* Cuotas generadas */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-3">
                  Plan de {preview.resumen?.cantidadCuotas} Cuotas
                </h4>
                <div className="space-y-2">
                  {preview.cuotasGeneradas?.map((cuota, i) => (
                    <div
                      key={i}
                      className="flex justify-between items-center bg-white rounded px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                          {cuota.numero}
                        </span>
                        <span className="text-sm text-gray-600">
                          Vence: {formatDate(cuota.fechaVencimiento)}
                        </span>
                      </div>
                      <span className="font-semibold">{formatCurrency(cuota.monto)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t bg-gray-50 gap-4">
          <p className="text-sm text-gray-500 flex-1">
            Las cuotas originales se marcarán como <span className="font-medium">FINANCIADA</span>
          </p>
          <div className="flex gap-3 flex-shrink-0">
            <Button variant="secondary" onClick={onClose} className="whitespace-nowrap">
              Cancelar
            </Button>
            <Button
              onClick={handleGenerar}
              disabled={loading || !preview}
              className="whitespace-nowrap"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Generando...
                </>
              ) : (
                'Generar Plan'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PlanPagosModal
