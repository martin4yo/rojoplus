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
  ArrowDownTrayIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline'
// import { Smartphone } from 'lucide-react' // MODO temporalmente oculto
import { useModal } from '../../../components/Modal'
import { formatDate, formatCurrency } from '../../../utils/formatters'
import StatusBadge from '../../../components/StatusBadge'
import ChatWidget from '../../../components/chat/ChatWidget'

export default function PagosSocio({ socio, tokenPortal, onPagoRealizado }) {
  const [cuotas, setCuotas] = useState([])
  const [historial, setHistorial] = useState([])
  const [cuentaCorriente, setCuentaCorriente] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('pendientes') // 'pendientes' | 'historial' | 'cuenta-corriente'
  const [procesandoPago, setProcesandoPago] = useState(false)
  const [descargandoPDF, setDescargandoPDF] = useState(null)
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

  useEffect(() => {
    if (tab === 'cuenta-corriente' && !cuentaCorriente) {
      cargarCuentaCorriente()
    }
  }, [tab])

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

  const cargarCuentaCorriente = async () => {
    try {
      setLoading(true)
      const data = await api.get(`/socio/${tokenPortal}/cuenta-corriente`)
      setCuentaCorriente(data)
    } catch (err) {
      console.error('Error cargando cuenta corriente:', err)
      showModal({
        type: 'error',
        message: 'Error cargando la cuenta corriente',
      })
    } finally {
      setLoading(false)
    }
  }

  const descargarReciboPDF = async (pagoId, numeroRecibo) => {
    try {
      setDescargandoPDF(pagoId)

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/socio/${tokenPortal}/pagos/${pagoId}/pdf`,
        {
          method: 'GET',
        }
      )

      if (!response.ok) {
        throw new Error('Error descargando el recibo')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Recibo-${numeroRecibo}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Error descargando recibo:', err)
      showModal({
        type: 'error',
        message: 'Error al descargar el recibo',
      })
    } finally {
      setDescargandoPDF(null)
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
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalPendiente, { minimumFractionDigits: 0 })}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-3">
          <button
            onClick={() => setTab('pendientes')}
            className={`py-4 px-6 font-semibold transition-colors ${
              tab === 'pendientes'
                ? 'bg-red-600 text-white'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ClockIcon className="h-5 w-5 inline-block mr-2" />
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
            <CheckCircleIcon className="h-5 w-5 inline-block mr-2" />
            Historial ({historial.length})
          </button>
          <button
            onClick={() => setTab('cuenta-corriente')}
            className={`py-4 px-6 font-semibold transition-colors ${
              tab === 'cuenta-corriente'
                ? 'bg-red-600 text-white'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <TableCellsIcon className="h-5 w-5 inline-block mr-2" />
            Cuenta Corriente
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
                      <span className="text-sm font-medium text-gray-600">Total: {formatCurrency(totalPendiente, { minimumFractionDigits: 0 })}</span>
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
                return (
                  <div key={cuota.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">{cuota.concepto}</h3>
                          <p className="text-gray-600 mt-1">
                            Periodo: {cuota.periodo} {cuota.anio}
                          </p>
                          <div className="mt-2">
                            <StatusBadge status={cuota.estado} type="cuota" />
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-gray-900">{formatCurrency(cuota.montoTotal, { minimumFractionDigits: 0 })}</p>
                          <p className="text-sm text-gray-500 mt-1">Vence: {formatDate(cuota.fechaVencimiento, { format: 'long' })}</p>
                        </div>
                      </div>

                      {cuota.recargo > 0 && (
                        <div className="bg-orange-50 border-l-4 border-orange-500 rounded p-3 mb-4">
                          <p className="text-sm text-orange-800">
                            Incluye recargo por mora: {formatCurrency(cuota.recargo, { minimumFractionDigits: 0 })}
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
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{pago.concepto}</h4>
                      <p className="text-sm text-gray-600 mt-1">{formatDate(pago.fecha, { format: 'long' })}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {pago.metodoPago} - {pago.comprobante}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600">{formatCurrency(pago.monto, { minimumFractionDigits: 0 })}</p>
                        <CheckCircleIcon className="h-5 w-5 text-green-500 inline ml-2" />
                      </div>
                      <button
                        onClick={() => descargarReciboPDF(pago.id, pago.numero)}
                        disabled={descargandoPDF === pago.id}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                        title="Descargar recibo"
                      >
                        {descargandoPDF === pago.id ? (
                          <>
                            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                            <span>Descargando...</span>
                          </>
                        ) : (
                          <>
                            <ArrowDownTrayIcon className="h-4 w-4" />
                            <span className="hidden sm:inline">PDF</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'cuenta-corriente' && (
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <div className="animate-spin h-12 w-12 border-4 border-red-600 border-t-transparent rounded-full mx-auto"></div>
              <p className="text-gray-600 mt-4">Cargando cuenta corriente...</p>
            </div>
          ) : cuentaCorriente ? (
            <>
              {/* Resumen */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumen de Cuenta</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-red-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Total Debe</p>
                    <p className="text-2xl font-bold text-red-600">
                      {formatCurrency(cuentaCorriente.resumen.totalDebe)}
                    </p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Total Haber</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(cuentaCorriente.resumen.totalHaber)}
                    </p>
                  </div>
                  <div className={`rounded-lg p-4 ${
                    parseFloat(cuentaCorriente.resumen.saldoFinal) > 0 ? 'bg-orange-50' : 'bg-blue-50'
                  }`}>
                    <p className="text-sm text-gray-600 mb-1">Saldo Final</p>
                    <p className={`text-2xl font-bold ${
                      parseFloat(cuentaCorriente.resumen.saldoFinal) > 0 ? 'text-orange-600' : 'text-blue-600'
                    }`}>
                      {formatCurrency(cuentaCorriente.resumen.saldoFinal)}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Pendiente de Pago</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(cuentaCorriente.resumen.totalPendiente)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {cuentaCorriente.resumen.cargosPendientes} cuota(s)
                    </p>
                  </div>
                </div>
              </div>

              {/* Tabla de movimientos */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Fecha
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Concepto
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Detalle
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Debe
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Haber
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Saldo
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {cuentaCorriente.movimientos.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                            No hay movimientos registrados
                          </td>
                        </tr>
                      ) : (
                        cuentaCorriente.movimientos.map((mov) => (
                          <tr
                            key={mov.id}
                            className={`hover:bg-gray-50 ${
                              mov.tipo === 'DEBITO' ? 'bg-red-50/30' : 'bg-green-50/30'
                            }`}
                          >
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatDate(mov.fecha, { format: 'long' })}
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                              {mov.concepto}
                              {mov.estado === 'PENDIENTE' && (
                                <span className="ml-2">
                                  <StatusBadge status="PENDIENTE" type="cuota" size="sm" />
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {mov.detalle}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 font-medium">
                              {mov.debe > 0 ? formatCurrency(mov.debe) : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 font-medium">
                              {mov.haber > 0 ? formatCurrency(mov.haber) : '-'}
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${
                              parseFloat(mov.saldo) > 0 ? 'text-orange-600' : 'text-blue-600'
                            }`}>
                              {formatCurrency(mov.saldo)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {cuentaCorriente.movimientos.length > 0 && (
                  <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600">
                      Mostrando {cuentaCorriente.movimientos.length} movimiento(s)
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <DocumentTextIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Error cargando cuenta corriente</h3>
              <p className="text-gray-600 mb-4">No se pudo cargar la información</p>
              <button
                onClick={cargarCuentaCorriente}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Reintentar
              </button>
            </div>
          )}
        </div>
      )}

      {ModalComponent}

      {/* Xavi - Chat Widget */}
      <ChatWidget tokenPortal={tokenPortal} role="socio" position="bottom-right" />
    </div>
  )
}
