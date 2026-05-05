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
import LoadingSpinner from '../../../components/LoadingSpinner'

export default function PagosSocio({ socio, tokenPortal, onPagoRealizado, mensajesNoLeidos = 0, onNavigate }) {
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
  const [escaneando, setEscaneando] = useState(false)
  const [datosEscaneados, setDatosEscaneados] = useState(null)
  const [montoManual, setMontoManual] = useState('')
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
      const res = await api.get(`/socio/${tokenPortal}/config-pagos`)
      setConfigPagos(res?.data || res)
    } catch (err) {
      console.error('Error cargando config de pagos:', err)
    }
  }

  const escanearComprobante = async () => {
    if (!comprobante || escaneando) return
    setEscaneando(true)
    setDatosEscaneados(null)
    try {
      const res = await api.post(`/socio/${tokenPortal}/parse-comprobante`, {
        imagen: comprobante,
        nombreArchivo: fileInputRef.current?.files[0]?.name || 'comprobante.jpg',
      })
      const datos = res?.data || res
      setDatosEscaneados(datos)
      if (datos.monto) setMontoManual(String(datos.monto))
    } catch (err) {
      showModal({ type: 'error', message: 'No se pudo leer el comprobante automáticamente. Ingresá el monto manualmente.' })
    } finally {
      setEscaneando(false)
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
      showModal({ type: 'error', message: 'Debes cargar el comprobante de pago' })
      return
    }

    try {
      setEnviandoPago(true)

      const cuotasIds = cuotas.map((c) => c.id)
      const montoFinal = montoManual ? parseFloat(montoManual) : totalPendiente

      await api.post(`/socio/${tokenPortal}/informar-pago`, {
        cuotasIds,
        monto: montoFinal,
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
      setDatosEscaneados(null)
      setMontoManual('')

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
      <LoadingSpinner />
    )
  }

  const totalPendiente = cuotas.reduce((sum, c) => sum + parseFloat(c.montoTotal || 0), 0)
  const cuotasVencidas = cuotas.filter((c) => c.estado === 'VENCIDO').length

  return (
    <div className="space-y-8">
      {/* Header athletic */}
      <div>
        <div className="pub-eyebrow mb-3" style={{ color: 'var(--text-dim)' }}>
          Cuenta corriente
        </div>
        <h1 className="font-display-sport" style={{ fontSize: 'clamp(28px, 4vw, 44px)', lineHeight: 0.96, color: 'var(--text)' }}>
          Mis <span style={{ color: 'var(--color-primary)' }}>pagos</span>
        </h1>
      </div>

      {/* Resumen athletic — grid con líneas finas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px" style={{ backgroundColor: 'var(--border)' }}>
        <PagoStatCard
          label="Pendientes"
          value={cuotas.length}
          tone="warning"
          icon={ClockIcon}
          number="01"
        />
        <PagoStatCard
          label="Vencidas"
          value={cuotasVencidas}
          tone="error"
          icon={ExclamationTriangleIcon}
          number="02"
        />
        <PagoStatCard
          label="Total a pagar"
          value={formatCurrency(totalPendiente, { minimumFractionDigits: 0 })}
          tone="info"
          icon={CurrencyDollarIcon}
          number="03"
        />
        <PagoStatCard
          label="Mis avisos"
          value={mensajesNoLeidos === 0 ? 'Sin novedades' : `${mensajesNoLeidos} sin leer`}
          tone={mensajesNoLeidos > 0 ? 'warning' : 'muted'}
          icon={CheckCircleIcon}
          number="04"
          onClick={mensajesNoLeidos > 0 ? () => onNavigate?.('mensajes') : null}
        />
      </div>

      {/* Tabs athletic */}
      <div className="grid grid-cols-3 gap-px" style={{ backgroundColor: 'var(--border)' }}>
        {[
          { id: 'pendientes', label: 'Pendientes', count: cuotas.length, icon: ClockIcon },
          { id: 'historial', label: 'Historial', count: historial.length, icon: CheckCircleIcon },
          { id: 'cuenta-corriente', label: 'Cuenta corriente', count: null, icon: TableCellsIcon },
        ].map(({ id, label, count, icon: Icon }) => {
          const activo = tab === id
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="py-4 px-3 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors flex items-center justify-center gap-2"
              style={{
                backgroundColor: activo ? 'var(--color-primary)' : 'var(--bg-surface)',
                color: activo ? 'var(--accent-fg)' : 'var(--text-dim)',
              }}
            >
              <Icon className="h-4 w-4" />
              <span>{label}{count !== null && ` (${count})`}</span>
            </button>
          )
        })}
      </div>

      {/* Contenido */}
      {tab === 'pendientes' && (
        <div className="space-y-4">
          {cuotas.length === 0 ? (
            <div className="pub-card p-12 text-center">
              <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">¡Todo pago!</h3>
              <p className="text-gray-600">No tienes cuotas pendientes</p>
            </div>
          ) : (
            <>
              {/* Opciones de pago - Compacto */}
              {cuotas.length > 0 && (
                <>
                  <div className="pub-card border border-gray-200 p-6">
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
                            <div className="mt-3 space-y-3">
                              <img
                                src={comprobantePreview}
                                alt="Preview"
                                className="w-full max-h-64 object-contain rounded-lg border"
                              />
                              {/* Botón escanear si está disponible */}
                              {configPagos?.parseDisponible && (
                                <button
                                  type="button"
                                  onClick={escanearComprobante}
                                  disabled={escaneando}
                                  className="w-full flex items-center justify-center gap-2 py-2 border-2 border-teal-400 text-teal-700 rounded-lg hover:bg-teal-50 transition-colors text-sm font-medium disabled:opacity-60"
                                >
                                  {escaneando ? (
                                    <>
                                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                      Escaneando...
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                      Escanear comprobante automáticamente
                                    </>
                                  )}
                                </button>
                              )}
                              {/* Datos extraídos */}
                              {datosEscaneados && (
                                <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-sm space-y-1">
                                  <p className="font-semibold text-teal-800 mb-2">Datos detectados:</p>
                                  {datosEscaneados.monto && <p className="text-teal-700">💰 Monto: <span className="font-bold">${Number(datosEscaneados.monto).toLocaleString('es-AR')}</span></p>}
                                  {datosEscaneados.fecha && <p className="text-teal-700">📅 Fecha: {datosEscaneados.fecha}</p>}
                                  {datosEscaneados.referencia && <p className="text-teal-700">🔖 Referencia: {datosEscaneados.referencia}</p>}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {/* Campo monto (editable, pre-relleno si se escaneó) */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Monto transferido
                          </label>
                          <input
                            type="number"
                            value={montoManual}
                            onChange={e => setMontoManual(e.target.value)}
                            placeholder={`${formatCurrency(totalPendiente, { minimumFractionDigits: 0 })} (pendiente)`}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                          />
                          <p className="text-xs text-gray-400 mt-0.5">Dejá vacío para usar el total pendiente</p>
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
                              setDatosEscaneados(null)
                              setMontoManual('')
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
                  <div key={cuota.id} className="pub-card overflow-hidden">
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">{cuota.concepto}</h3>
                          <p className="text-gray-600 mt-1">
                            Periodo: {cuota.periodo}
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
        <div className="pub-card overflow-hidden">
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
            <LoadingSpinner />
          ) : cuentaCorriente ? (
            <>
              {/* Resumen */}
              <div className="pub-card p-6">
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
              <div className="pub-card overflow-hidden">
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
            <div className="pub-card p-12 text-center">
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

      {/* Axio - Chat Widget */}
      <ChatWidget tokenPortal={tokenPortal} role="socio" position="bottom-right" />
    </div>
  )
}

function PagoStatCard({ label, value, tone, icon: Icon, number, onClick }) {
  const toneColor = {
    success: 'var(--success)',
    warning: 'var(--warning)',
    error: 'var(--error)',
    info: 'var(--info)',
    muted: 'var(--text-muted)',
  }[tone] || 'var(--text-dim)'

  const Component = onClick ? 'button' : 'div'

  return (
    <Component
      onClick={onClick}
      className={`p-5 flex flex-col gap-3 text-left ${onClick ? 'hover:bg-[var(--bg-surface-hi)] transition-colors cursor-pointer' : ''}`}
      style={{ backgroundColor: 'var(--bg-surface)' }}
    >
      <div className="flex items-center justify-between">
        <Icon className="h-6 w-6" style={{ color: toneColor }} />
        <span className="font-mono text-[10px] tracking-[0.25em]" style={{ color: 'var(--text-muted)' }}>
          {number}
        </span>
      </div>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] mb-1" style={{ color: 'var(--text-muted)' }}>
          {label}
        </p>
        <p className="font-display-sport" style={{ fontSize: 22, lineHeight: 1, color: toneColor }}>
          {value}
        </p>
      </div>
    </Component>
  )
}
