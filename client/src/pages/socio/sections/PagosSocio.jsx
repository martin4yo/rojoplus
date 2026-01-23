import { useState, useEffect } from 'react'
import api from '../../../services/api'
import {
  CreditCardIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline'
import { Smartphone } from 'lucide-react'
import { useModal } from '../../../components/Modal'

export default function PagosSocio({ socio, tokenPortal, onPagoRealizado }) {
  const [cuotas, setCuotas] = useState([])
  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('pendientes') // 'pendientes' | 'historial'
  const [procesandoPago, setProcesandoPago] = useState(false)
  const { showModal, ModalComponent } = useModal()

  useEffect(() => {
    cargarDatos()
  }, [tokenPortal])

  const cargarDatos = async () => {
    try {
      setLoading(true)
      const [cuotasResp, historialResp] = await Promise.all([
        api.get(`/socio/${tokenPortal}/cuotas/pendientes`).catch(() => []),
        api.get(`/socio/${tokenPortal}/pagos/historial`).catch(() => []),
      ])

      setCuotas(cuotasResp || [])
      setHistorial(historialResp || [])
    } catch (err) {
      console.error('Error cargando datos de pagos:', err)
    } finally {
      setLoading(false)
    }
  }

  const pagarCuota = async (cuotaId, metodo) => {
    if (procesandoPago) return

    try {
      setProcesandoPago(true)

      const response = await api.post(`/socio/${tokenPortal}/cuotas/${cuotaId}/generar-link-pago`, {
        metodoPago: metodo, // 'MERCADOPAGO' | 'MODO'
      })

      console.log('📦 Respuesta (cuota individual):', response)

      if (response?.linkPago) {
        console.log('✅ Redirigiendo a MercadoPago:', response.linkPago)
        window.location.href = response.linkPago
      } else {
        console.error('❌ No hay linkPago en la respuesta')
        showModal({
          type: 'error',
          message: 'Error generando link de pago. Por favor intenta nuevamente.'
        })
      }
    } catch (err) {
      showModal({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Error al procesar el pago'
      })
    } finally {
      setProcesandoPago(false)
    }
  }

  const pagarVarias = async (cuotasIds, metodo) => {
    if (procesandoPago || cuotasIds.length === 0) return

    try {
      setProcesandoPago(true)

      const response = await api.post(`/socio/${tokenPortal}/cuotas/pagar-multiples`, {
        cuotasIds,
        metodoPago: metodo,
      })

      console.log('📦 Respuesta completa:', response)

      if (response?.linkPago) {
        console.log('✅ Redirigiendo a MercadoPago:', response.linkPago)
        window.location.href = response.linkPago
      } else {
        console.error('❌ No hay linkPago en la respuesta')
        showModal({
          type: 'error',
          message: 'Error generando link de pago. Por favor intenta nuevamente.'
        })
      }
    } catch (err) {
      showModal({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Error al procesar el pago'
      })
    } finally {
      setProcesandoPago(false)
    }
  }

  const formatMonto = (monto) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(monto)
  }

  const formatFecha = (fecha) => {
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }

  const getEstadoLabel = (estado) => {
    const estados = {
      PENDIENTE: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
      PAGADO: { label: 'Pagado', color: 'bg-green-100 text-green-800' },
      VENCIDO: { label: 'Vencido', color: 'bg-red-100 text-red-800' },
    }
    return estados[estado] || estados.PENDIENTE
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  const totalPendiente = cuotas.reduce((sum, c) => sum + parseFloat(c.montoTotal || 0), 0)
  const cuotasVencidas = cuotas.filter((c) => c.estado === 'VENCIDO').length

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-yellow-100 rounded-lg p-3">
              <ClockIcon className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Cuotas Pendientes</h3>
          <p className="text-2xl font-bold text-yellow-600">{cuotas.length}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-red-500">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-red-100 rounded-lg p-3">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Cuotas Vencidas</h3>
          <p className="text-2xl font-bold text-red-600">{cuotasVencidas}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-blue-100 rounded-lg p-3">
              <CurrencyDollarIcon className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Total a Pagar</h3>
          <p className="text-2xl font-bold text-blue-600">{formatMonto(totalPendiente)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-2">
          <button
            onClick={() => setTab('pendientes')}
            className={`py-4 px-6 font-semibold transition-colors ${
              tab === 'pendientes'
                ? 'bg-red-600 text-white'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            Pendientes ({cuotas.length})
          </button>
          <button
            onClick={() => setTab('historial')}
            className={`py-4 px-6 font-semibold transition-colors ${
              tab === 'historial'
                ? 'bg-red-600 text-white'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            Historial ({historial.length})
          </button>
        </div>
      </div>

      {/* Contenido */}
      {tab === 'pendientes' && (
        <div className="space-y-4">
          {cuotas.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">¡Todo pago!</h3>
              <p className="text-gray-600">No tienes cuotas pendientes</p>
            </div>
          ) : (
            <>
              {/* Pagar todas */}
              {cuotas.length > 1 && (
                <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2">Pagar todas las cuotas</h4>
                  <p className="text-sm text-blue-700 mb-4">
                    Total: {formatMonto(totalPendiente)}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => pagarVarias(cuotas.map((c) => c.id), 'MERCADOPAGO')}
                      disabled={procesandoPago}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      <CreditCardIcon className="w-5 h-5" />
                      Pagar con MercadoPago
                    </button>
                    <button
                      onClick={() => pagarVarias(cuotas.map((c) => c.id), 'MODO')}
                      disabled={procesandoPago}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                    >
                      <Smartphone className="w-5 h-5" />
                      Pagar con MODO
                    </button>
                  </div>
                </div>
              )}

              {/* Lista de cuotas */}
              {cuotas.map((cuota) => {
                const estado = getEstadoLabel(cuota.estado)
                return (
                  <div key={cuota.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">{cuota.concepto}</h3>
                          <p className="text-gray-600 mt-1">
                            Periodo: {cuota.periodo} {cuota.anio}
                          </p>
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium mt-2 ${estado.color}`}>
                            {estado.label}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-gray-900">{formatMonto(cuota.montoTotal)}</p>
                          <p className="text-sm text-gray-500 mt-1">Vence: {formatFecha(cuota.fechaVencimiento)}</p>
                        </div>
                      </div>

                      {cuota.recargo > 0 && (
                        <div className="bg-orange-50 border-l-4 border-orange-500 rounded p-3 mb-4">
                          <p className="text-sm text-orange-800">
                            Incluye recargo por mora: {formatMonto(cuota.recargo)}
                          </p>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() => pagarCuota(cuota.id, 'MERCADOPAGO')}
                          disabled={procesandoPago}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          <CreditCardIcon className="w-4 h-4" />
                          MercadoPago
                        </button>
                        <button
                          onClick={() => pagarCuota(cuota.id, 'MODO')}
                          disabled={procesandoPago}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                        >
                          <Smartphone className="w-4 h-4" />
                          MODO
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}

      {tab === 'historial' && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {historial.length === 0 ? (
            <div className="p-12 text-center">
              <DocumentTextIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Sin historial</h3>
              <p className="text-gray-600">No hay pagos registrados</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {historial.map((pago) => (
                <div key={pago.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{pago.concepto}</h4>
                      <p className="text-sm text-gray-600 mt-1">{formatFecha(pago.fecha)}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {pago.metodoPago} - {pago.comprobante}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">{formatMonto(pago.monto)}</p>
                      <CheckCircleIcon className="h-5 w-5 text-green-500 inline ml-2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {ModalComponent}
    </div>
  )
}
