import { useState, useEffect, useRef } from 'react'
import api from '../../../services/api'
import {
  CreditCardIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  PhoneIcon,
  BanknotesIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/24/outline'
// import { Smartphone } from 'lucide-react' // MODO temporalmente oculto
import { useModal } from '../../../components/Modal'

export default function PagosSocio({ socio, tokenPortal, onPagoRealizado }) {
  const [cuotas, setCuotas] = useState([])
  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('pendientes') // 'pendientes' | 'historial'
  const [procesandoPago, setProcesandoPago] = useState(false)
  const [configPagos, setConfigPagos] = useState(null)
  const [copiadoAlias, setCopiadoAlias] = useState(false)
  const [copiadoCBU, setCopiadoCBU] = useState(false)
  const [mostrarInformarPago, setMostrarInformarPago] = useState(false)
  const [modoTransferencia, setModoTransferencia] = useState(false)
  const [comprobante, setComprobante] = useState(null)
  const [comprobantePreview, setComprobantePreview] = useState(null)
  const [enviandoPago, setEnviandoPago] = useState(false)
  const fileInputRef = useRef(null)
  const { showModal, ModalComponent } = useModal()

  useEffect(() => {
    cargarDatos()
    cargarConfigPagos()
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

  const cargarConfigPagos = async () => {
    try {
      const config = await api.get(`/socio/${tokenPortal}/config-pagos`)
      setConfigPagos(config)
    } catch (err) {
      console.error('Error cargando config de pagos:', err)
    }
  }

  const copiarAlPortapapeles = async (texto, tipo) => {
    try {
      await navigator.clipboard.writeText(texto)
      if (tipo === 'alias') {
        setCopiadoAlias(true)
        setTimeout(() => setCopiadoAlias(false), 2000)
      } else if (tipo === 'cbu') {
        setCopiadoCBU(true)
        setTimeout(() => setCopiadoCBU(false), 2000)
      }
    } catch (err) {
      console.error('Error copiando al portapapeles:', err)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      showModal({
        type: 'error',
        message: 'Solo se permiten imágenes (JPG, PNG, etc.)',
      })
      return
    }

    // Validar tamaño (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showModal({
        type: 'error',
        message: 'El archivo es muy grande. Máximo 5MB.',
      })
      return
    }

    // Leer archivo como base64
    const reader = new FileReader()
    reader.onloadend = () => {
      setComprobante(reader.result)
      setComprobantePreview(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const informarPago = async () => {
    if (!comprobante) {
      showModal({
        type: 'error',
        message: 'Debes cargar el comprobante de pago',
      })
      return
    }

    try {
      setEnviandoPago(true)

      const cuotasIds = cuotas.map((c) => c.id)

      await api.post(`/socio/${tokenPortal}/informar-pago`, {
        cuotasIds,
        monto: totalPendiente,
        comprobante,
        comprobanteOriginal: fileInputRef.current?.files[0]?.name || 'comprobante.jpg',
        observaciones: 'Pago informado desde el portal del socio',
      })

      showModal({
        type: 'success',
        message: '¡Pago informado correctamente! Será procesado en breve.',
      })

      // Limpiar formulario
      setMostrarInformarPago(false)
      setComprobante(null)
      setComprobantePreview(null)

      // Recargar datos
      await cargarDatos()
    } catch (err) {
      showModal({
        type: 'error',
        message: err.response?.data?.message || 'Error al informar el pago',
      })
    } finally {
      setEnviandoPago(false)
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
              {/* Opciones de pago - Compacto */}
              {cuotas.length > 0 && (
                <>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Opciones de pago</h3>
                      <span className="text-sm font-medium text-gray-600">Total: {formatMonto(totalPendiente)}</span>
                    </div>

                    {!modoTransferencia ? (
                      <>
                        {/* Botones de pago online */}
                        <div className="flex flex-wrap gap-3 mb-4">
                          <button
                            onClick={() => pagarVarias(cuotas.map((c) => c.id), 'MERCADOPAGO')}
                            disabled={procesandoPago}
                            className="px-6 py-3 bg-[#009EE3] rounded-lg hover:bg-[#0082bd] transition-all disabled:opacity-50 shadow-lg hover:shadow-xl active:shadow-md active:translate-y-0.5 border-b-4 border-[#0082bd]"
                            title="Pagar con MercadoPago"
                          >
                            <img
                              src="/images/MP.png"
                              alt="MercadoPago"
                              className="h-8"
                            />
                          </button>
                          <button
                            disabled
                            className="px-6 py-3 bg-white rounded-lg cursor-not-allowed opacity-60 shadow-lg border-b-4 border-gray-300 border border-gray-200"
                            title="MODO - Próximamente"
                          >
                            <img
                              src="/images/MODO.webp"
                              alt="MODO"
                              className="h-8"
                            />
                          </button>
                        </div>

                        {/* Switch para transferencia */}
                        {configPagos && (
                          <div className="pt-4 border-t border-gray-200">
                            <button
                              onClick={() => setModoTransferencia(true)}
                              className="w-full flex items-center justify-between px-4 py-3 bg-orange-50 hover:bg-orange-100 border-2 border-orange-300 rounded-lg transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <BanknotesIcon className="w-5 h-5 text-orange-600" />
                                <span className="font-semibold text-orange-900">Pagar por transferencia</span>
                              </div>
                              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {/* Vista de transferencia */}
                        <div className="space-y-4">
                          <button
                            onClick={() => {
                              setModoTransferencia(false)
                              setMostrarInformarPago(false)
                            }}
                            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            <span className="text-sm font-medium">Volver a opciones de pago</span>
                          </button>

                          {/* Datos bancarios */}
                          <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4">
                            <h4 className="font-bold text-orange-900 mb-3 flex items-center gap-2">
                              <BanknotesIcon className="w-5 h-5" />
                              Datos para transferencia
                            </h4>
                            <div className="space-y-3">
                              <div>
                                <label className="text-xs font-medium text-orange-700 uppercase block mb-1">Alias</label>
                                <div className="flex items-center gap-2">
                                  <p className="text-lg font-semibold text-orange-900 flex-1">{configPagos.alias}</p>
                                  <button
                                    onClick={() => copiarAlPortapapeles(configPagos.alias, 'alias')}
                                    className="p-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                                    title="Copiar alias"
                                  >
                                    {copiadoAlias ? (
                                      <CheckIcon className="w-5 h-5" />
                                    ) : (
                                      <ClipboardDocumentIcon className="w-5 h-5" />
                                    )}
                                  </button>
                                </div>
                              </div>
                              <div>
                                <label className="text-xs font-medium text-orange-700 uppercase block mb-1">CBU</label>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-mono text-orange-900 flex-1">{configPagos.cbu}</p>
                                  <button
                                    onClick={() => copiarAlPortapapeles(configPagos.cbu, 'cbu')}
                                    className="p-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                                    title="Copiar CBU"
                                  >
                                    {copiadoCBU ? (
                                      <CheckIcon className="w-5 h-5" />
                                    ) : (
                                      <ClipboardDocumentIcon className="w-5 h-5" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Botón informar pago */}
                          <button
                            onClick={() => setMostrarInformarPago(!mostrarInformarPago)}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all font-semibold shadow-lg hover:shadow-xl active:shadow-md active:translate-y-0.5 border-b-4 border-orange-800"
                          >
                            <ArrowUpTrayIcon className="w-5 h-5" />
                            {mostrarInformarPago ? 'Ocultar formulario' : 'Informar pago realizado'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Formulario informar pago */}
                  {mostrarInformarPago && modoTransferencia && configPagos && (
                    <div className="bg-white border-2 border-orange-500 rounded-lg p-6 shadow-lg">
                      <h4 className="font-bold text-gray-900 mb-4">Subir comprobante de transferencia</h4>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Comprobante de pago *
                          </label>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full py-3 px-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-orange-500 transition-colors flex items-center justify-center gap-2 text-gray-600 hover:text-orange-600"
                          >
                            <ArrowUpTrayIcon className="w-5 h-5" />
                            {comprobante ? 'Cambiar comprobante' : 'Seleccionar archivo'}
                          </button>
                          {comprobantePreview && (
                            <div className="mt-3">
                              <img
                                src={comprobantePreview}
                                alt="Preview"
                                className="w-full max-h-64 object-contain rounded-lg border"
                              />
                            </div>
                          )}
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={informarPago}
                            disabled={enviandoPago || !comprobante}
                            className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 font-semibold"
                          >
                            {enviandoPago ? 'Enviando...' : 'Confirmar pago'}
                          </button>
                          <button
                            onClick={() => {
                              setMostrarInformarPago(false)
                              setComprobante(null)
                              setComprobantePreview(null)
                            }}
                            className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
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
                          className="px-4 py-2 bg-[#009EE3] rounded-lg hover:bg-[#0082bd] transition-all disabled:opacity-50 shadow-lg hover:shadow-xl active:shadow-md active:translate-y-0.5 border-b-4 border-[#0082bd]"
                          title="Pagar con MercadoPago"
                        >
                          <img
                            src="/images/MP.png"
                            alt="MercadoPago"
                            className="h-6"
                          />
                        </button>
                        <button
                          disabled
                          className="px-4 py-2 bg-white rounded-lg cursor-not-allowed opacity-60 shadow-lg border-b-4 border-gray-300 border border-gray-200"
                          title="MODO - Próximamente"
                        >
                          <img
                            src="/images/MODO.webp"
                            alt="MODO"
                            className="h-6"
                          />
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
