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

export default function PagosSocio({ socio, tokenPortal, onPagoRealizado, mensajesNoLeidos = 0, onNavigate, pagarCargoId = null, onPagarHandled }) {
  const esMiembroFamilia = !!socio?.titularFamiliaId
  const titularNombre = socio?.titularFamilia?.apellidoNombre || socio?.grupoFamiliar?.titular?.apellidoNombre
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
  // Selección de períodos en cascada: índice del último período seleccionado.
  // -1 = nada seleccionado. Siempre es un prefijo contiguo desde el más viejo.
  const [periodosHasta, setPeriodosHasta] = useState(-1)
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

  // Deep-link desde notificación: abre modal de pago si llega ?pagar=<cargoId>
  useEffect(() => {
    if (!pagarCargoId || loading || cuotas.length === 0) return

    // Consumir el id de inmediato para no dispararlo dos veces
    onPagarHandled?.()

    const cuota = cuotas.find(c => c.id === pagarCargoId)
    if (!cuota) {
      showModal({
        type: 'warning',
        title: 'Cuota no encontrada',
        message: 'La cuota del link ya no aparece como pendiente. Puede haber sido pagada o cancelada.',
      })
      return
    }

    // Asegurarse de estar en la pestaña de pendientes
    setTab('pendientes')

    const dueno = cuota.socio && cuota.socio.id !== socio?.id ? cuota.socio.apellidoNombre : null
    const venc = cuota.fechaVencimiento ? formatDate(cuota.fechaVencimiento) : '-'
    const monto = formatCurrency(cuota.montoTotal || 0)
    const detalle = [
      cuota.concepto || 'Cuota',
      cuota.periodo ? `Período ${cuota.periodo}` : null,
      dueno ? `Socio: ${dueno}` : null,
      `Vencimiento: ${venc}`,
      `Importe: ${monto}`,
    ].filter(Boolean).join(' · ')

    showModal({
      type: 'info',
      title: '¿Querés pagar esta cuota?',
      message: detalle,
      confirmText: 'Pagar con MercadoPago',
      cancelText: 'Más tarde',
      onConfirm: () => {
        pagarCuota(cuota.id, 'MERCADOPAGO')
      },
    })
  }, [pagarCargoId, loading, cuotas])

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
              <CheckCircleIcon className="h-16 w-16 mx-auto mb-4" style={{ color: 'var(--color-primary)' }} />
              <p className="font-display-sport mb-2" style={{ fontSize: 26, lineHeight: 1, color: 'var(--text)' }}>
                ¡Todo <span style={{ color: 'var(--color-primary)' }}>pago</span>!
              </p>
              <p className="text-sm" style={{ color: 'var(--text-dim)' }}>No tenés cuotas pendientes</p>
            </div>
          ) : (
            <>
              {/* Aviso para miembros del grupo familiar — sin opciones de pago */}
              {esMiembroFamilia && cuotas.length > 0 && (
                <div className="pub-card p-6">
                  <div className="pub-eyebrow mb-2" style={{ color: 'var(--text-dim)' }}>
                    Grupo familiar
                  </div>
                  <p className="font-display-sport mb-2" style={{ fontSize: 22, lineHeight: 1.05, color: 'var(--text)' }}>
                    El pago lo gestiona el <span style={{ color: 'var(--color-primary)' }}>titular</span>
                  </p>
                  <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
                    {titularNombre
                      ? <>Tus cuotas figuran en la cuenta de <span style={{ color: 'var(--text)' }}>{titularNombre}</span>. Abajo podés ver el detalle y el saldo pendiente.</>
                      : 'Tus cuotas figuran en la cuenta del titular del grupo familiar. Abajo podés ver el detalle y el saldo pendiente.'}
                  </p>
                </div>
              )}

              {/* Opciones de pago — sólo titulares */}
              {!esMiembroFamilia && cuotas.length > 0 && (
                <>
                  <div className="pub-card p-6">
                    <div className="flex items-end justify-between mb-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <div className="pub-eyebrow" style={{ color: 'var(--text-dim)' }}>Opciones de pago</div>
                        <p className="font-display-sport mt-1" style={{ fontSize: 24, lineHeight: 1, color: 'var(--text)' }}>
                          Total <span style={{ color: 'var(--color-primary)' }}>{formatCurrency(totalPendiente, { minimumFractionDigits: 0 })}</span>
                        </p>
                      </div>
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
                            <img src="/images/MP.png" alt="MercadoPago" className="h-8" />
                          </button>
                          <button
                            disabled
                            className="px-6 py-3 bg-white rounded-lg cursor-not-allowed opacity-60 shadow-lg border-b-4 border-gray-300 border border-gray-200"
                            title="MODO - Próximamente"
                          >
                            <img src="/images/MODO.webp" alt="MODO" className="h-8" />
                          </button>
                        </div>

                        {/* Switch para transferencia */}
                        {configPagos && (
                          <div className="pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                            <button
                              onClick={() => setModoTransferencia(true)}
                              className="w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors"
                              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                            >
                              <div className="flex items-center gap-2">
                                <BanknotesIcon className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                                <span className="font-mono text-[11px] uppercase tracking-[0.2em]">Pagar por transferencia</span>
                              </div>
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-dim)' }}>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="space-y-4">
                        <button
                          onClick={() => {
                            setModoTransferencia(false)
                            setMostrarInformarPago(false)
                          }}
                          className="inline-flex items-center gap-2 transition-colors font-mono text-[11px] uppercase tracking-[0.2em]"
                          style={{ color: 'var(--text-dim)' }}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                          Volver a opciones
                        </button>

                        {/* Datos bancarios */}
                        <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                          <div className="pub-eyebrow mb-3 flex items-center gap-2" style={{ color: 'var(--text-dim)' }}>
                            <BanknotesIcon className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                            Datos para transferencia
                          </div>
                          <div className="space-y-3">
                            <div>
                              <label className="font-mono text-[10px] uppercase tracking-[0.2em] block mb-1" style={{ color: 'var(--text-muted)' }}>Alias</label>
                              <div className="flex items-center gap-2">
                                <p className="font-display-sport flex-1" style={{ fontSize: 18, color: 'var(--text)' }}>{configPagos.alias}</p>
                                <button
                                  onClick={() => copiarAlPortapapeles(configPagos.alias, 'alias')}
                                  className="p-2 rounded-lg transition-colors"
                                  style={{ backgroundColor: 'var(--color-primary)', color: 'var(--accent-fg)' }}
                                  title="Copiar alias"
                                >
                                  {copiadoAlias ? <CheckIcon className="w-5 h-5" /> : <ClipboardDocumentIcon className="w-5 h-5" />}
                                </button>
                              </div>
                            </div>
                            <div>
                              <label className="font-mono text-[10px] uppercase tracking-[0.2em] block mb-1" style={{ color: 'var(--text-muted)' }}>CBU</label>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-mono flex-1" style={{ color: 'var(--text)' }}>{configPagos.cbu}</p>
                                <button
                                  onClick={() => copiarAlPortapapeles(configPagos.cbu, 'cbu')}
                                  className="p-2 rounded-lg transition-colors"
                                  style={{ backgroundColor: 'var(--color-primary)', color: 'var(--accent-fg)' }}
                                  title="Copiar CBU"
                                >
                                  {copiadoCBU ? <CheckIcon className="w-5 h-5" /> : <ClipboardDocumentIcon className="w-5 h-5" />}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Botón informar pago */}
                        <button
                          onClick={() => setMostrarInformarPago(!mostrarInformarPago)}
                          className="pub-cta w-full justify-center"
                        >
                          <ArrowUpTrayIcon className="w-5 h-5" />
                          <span>{mostrarInformarPago ? 'Ocultar formulario' : 'Informar pago realizado'}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Formulario informar pago */}
                  {mostrarInformarPago && modoTransferencia && configPagos && (
                    <div className="pub-card p-6">
                      <div className="pub-eyebrow mb-4" style={{ color: 'var(--text-dim)' }}>
                        Subir comprobante de transferencia
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="font-mono text-[10px] uppercase tracking-[0.2em] block mb-2" style={{ color: 'var(--text-muted)' }}>
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
                            className="w-full py-3 px-4 border-2 border-dashed rounded-lg transition-colors flex items-center justify-center gap-2"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
                          >
                            <ArrowUpTrayIcon className="w-5 h-5" />
                            {comprobante ? 'Cambiar comprobante' : 'Seleccionar archivo'}
                          </button>
                          {comprobantePreview && (
                            <div className="mt-3 space-y-3">
                              <img
                                src={comprobantePreview}
                                alt="Preview"
                                className="w-full max-h-64 object-contain rounded-lg"
                                style={{ border: '1px solid var(--border)' }}
                              />
                              {configPagos?.parseDisponible && (
                                <button
                                  type="button"
                                  onClick={escanearComprobante}
                                  disabled={escaneando}
                                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg transition-colors text-sm font-medium disabled:opacity-60"
                                  style={{ border: '2px solid var(--color-primary)', color: 'var(--color-primary)' }}
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
                              {datosEscaneados && (
                                <div className="rounded-lg p-3 text-sm space-y-1" style={{ backgroundColor: 'var(--accent-soft)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] mb-2" style={{ color: 'var(--text-dim)' }}>Datos detectados</p>
                                  {datosEscaneados.monto && <p>Monto: <span className="font-semibold">${Number(datosEscaneados.monto).toLocaleString('es-AR')}</span></p>}
                                  {datosEscaneados.fecha && <p>Fecha: {datosEscaneados.fecha}</p>}
                                  {datosEscaneados.referencia && <p>Referencia: {datosEscaneados.referencia}</p>}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="font-mono text-[10px] uppercase tracking-[0.2em] block mb-1" style={{ color: 'var(--text-muted)' }}>
                            Monto transferido
                          </label>
                          <input
                            type="number"
                            value={montoManual}
                            onChange={e => setMontoManual(e.target.value)}
                            placeholder={`${formatCurrency(totalPendiente, { minimumFractionDigits: 0 })} (pendiente)`}
                            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                            style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)', color: 'var(--text)' }}
                          />
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Dejá vacío para usar el total pendiente</p>
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={informarPago}
                            disabled={enviandoPago || !comprobante}
                            className="pub-cta flex-1 justify-center disabled:opacity-50"
                          >
                            <span>{enviandoPago ? 'Enviando...' : 'Confirmar pago'}</span>
                          </button>
                          <button
                            onClick={() => {
                              setMostrarInformarPago(false)
                              setComprobante(null)
                              setComprobantePreview(null)
                              setDatosEscaneados(null)
                              setMontoManual('')
                            }}
                            className="px-4 py-3 rounded-lg transition-colors"
                            style={{ border: '1px solid var(--border)', color: 'var(--text-dim)' }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Cuotas agrupadas por período — selección contigua de atrás hacia adelante */}
              {(() => {
                // Agrupar por periodo (string identificador) + capturar fecha mín y total
                const mapa = new Map()
                for (const c of cuotas) {
                  const key = c.periodo || c.periodoId || `cargo-${c.id}`
                  if (!mapa.has(key)) {
                    mapa.set(key, {
                      key,
                      periodo: c.periodo || 'Sin período',
                      fechaVencMin: c.fechaVencimiento,
                      cuotas: [],
                      total: 0,
                      tieneRecargo: false,
                    })
                  }
                  const g = mapa.get(key)
                  g.cuotas.push(c)
                  g.total += Number(c.montoTotal) || 0
                  if (Number(c.recargo) > 0) g.tieneRecargo = true
                  if (c.fechaVencimiento && (!g.fechaVencMin || c.fechaVencimiento < g.fechaVencMin)) {
                    g.fechaVencMin = c.fechaVencimiento
                  }
                }
                // Ordenar por fechaVencMin ASC (más viejo primero)
                const periodos = [...mapa.values()].sort((a, b) => {
                  const fa = new Date(a.fechaVencMin || 0).getTime()
                  const fb = new Date(b.fechaVencMin || 0).getTime()
                  return fa - fb
                })

                const handleToggle = (i) => {
                  // Click en período i: si ya está seleccionado, deselecciona desde ahí en adelante
                  // (lo deja en i-1); si no lo está, marca hasta i (selecciona i y todos los anteriores).
                  if (i <= periodosHasta) setPeriodosHasta(i - 1)
                  else setPeriodosHasta(i)
                }

                const cuotasSeleccionadas = periodos.slice(0, periodosHasta + 1).flatMap(p => p.cuotas)
                const totalSeleccionado = cuotasSeleccionadas.reduce((s, c) => s + Number(c.montoTotal || 0), 0)

                return (
                  <>
                    <div>
                      <div className="pub-eyebrow mb-3" style={{ color: 'var(--text-dim)' }}>
                        Períodos pendientes
                      </div>
                      <p className="text-sm mb-4" style={{ color: 'var(--text-dim)' }}>
                        El pago se aplica de atrás hacia adelante. Marcá hasta qué período querés pagar.
                      </p>
                    </div>

                    {periodos.map((p, i) => {
                      const seleccionado = i <= periodosHasta
                      // Bloqueado si hay períodos anteriores sin seleccionar (excepto que el clic
                      // los seleccione en cascada — pero por UX explícita los marcamos como "bloqueados").
                      // Nota: como handleToggle siempre selecciona desde 0 hasta i, técnicamente nunca
                      // queda saltado. Aún así mostramos un hint visual en períodos posteriores al actual.
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => !esMiembroFamilia && handleToggle(i)}
                          disabled={esMiembroFamilia}
                          className="pub-card overflow-hidden w-full text-left transition-all"
                          style={{
                            cursor: esMiembroFamilia ? 'default' : 'pointer',
                            borderColor: seleccionado ? 'var(--color-primary)' : 'var(--border)',
                            borderWidth: seleccionado ? 2 : 1,
                            backgroundColor: seleccionado ? 'var(--accent-soft)' : 'var(--bg-surface)',
                          }}
                        >
                          <div className="p-5">
                            <div className="flex items-start gap-4">
                              {/* Checkbox visual */}
                              {!esMiembroFamilia && (
                                <div
                                  className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded border-2"
                                  style={{
                                    borderColor: seleccionado ? 'var(--color-primary)' : 'var(--border)',
                                    backgroundColor: seleccionado ? 'var(--color-primary)' : 'transparent',
                                  }}
                                >
                                  {seleccionado && (
                                    <CheckIcon className="h-4 w-4" style={{ color: 'var(--accent-fg)' }} />
                                  )}
                                </div>
                              )}

                              {/* Info del período */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-3 mb-2">
                                  <div>
                                    <h3 className="font-display-sport" style={{ fontSize: 22, lineHeight: 1, color: 'var(--text)' }}>
                                      {p.periodo}
                                    </h3>
                                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] mt-1" style={{ color: 'var(--text-muted)' }}>
                                      {p.cuotas.length} cargo{p.cuotas.length === 1 ? '' : 's'} · Vence {formatDate(p.fechaVencMin, { format: 'long' })}
                                    </p>
                                  </div>
                                  <p className="font-display-sport whitespace-nowrap" style={{ fontSize: 22, lineHeight: 1, color: seleccionado ? 'var(--color-primary)' : 'var(--text)' }}>
                                    {formatCurrency(p.total, { minimumFractionDigits: 0 })}
                                  </p>
                                </div>

                                {/* Detalle de cargos del período */}
                                <ul className="space-y-1 pl-2" style={{ borderLeft: '2px solid var(--border)' }}>
                                  {p.cuotas.map(c => (
                                    <li key={c.id} className="pl-3 flex items-center justify-between gap-2 text-sm">
                                      <span style={{ color: 'var(--text-dim)' }}>
                                        {c.concepto}
                                        {c.esDeOtroMiembro && c.socioApellidoNombre && (
                                          <span className="font-mono text-[10px] uppercase tracking-[0.2em] ml-2" style={{ color: 'var(--text-muted)' }}>
                                            · {c.socioApellidoNombre}
                                          </span>
                                        )}
                                      </span>
                                      <span style={{ color: 'var(--text)' }}>
                                        {formatCurrency(c.montoTotal, { minimumFractionDigits: 0 })}
                                      </span>
                                    </li>
                                  ))}
                                </ul>

                                {p.tieneRecargo && (
                                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] mt-2" style={{ color: 'var(--color-primary)' }}>
                                    Incluye recargo por mora
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      )
                    })}

                    {/* Botón de pago de períodos seleccionados */}
                    {!esMiembroFamilia && periodosHasta >= 0 && (
                      <div className="sticky bottom-4 pub-card p-5 shadow-lg" style={{ borderColor: 'var(--color-primary)', borderWidth: 2 }}>
                        <div className="flex items-center justify-between gap-4 mb-3">
                          <div>
                            <p className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--text-dim)' }}>
                              {periodosHasta + 1} período{periodosHasta === 0 ? '' : 's'} seleccionado{periodosHasta === 0 ? '' : 's'}
                            </p>
                            <p className="font-display-sport" style={{ fontSize: 26, lineHeight: 1, color: 'var(--color-primary)' }}>
                              {formatCurrency(totalSeleccionado, { minimumFractionDigits: 0 })}
                            </p>
                          </div>
                          <button
                            onClick={() => pagarVarias(cuotasSeleccionadas.map(c => c.id), 'MERCADOPAGO')}
                            disabled={procesandoPago}
                            className="px-6 py-3 bg-[#009EE3] rounded-lg hover:bg-[#0082bd] transition-all disabled:opacity-50 shadow-lg hover:shadow-xl active:shadow-md active:translate-y-0.5 border-b-4 border-[#0082bd]"
                            title="Pagar con MercadoPago"
                          >
                            <img src="/images/MP.png" alt="MercadoPago" className="h-7" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}
            </>
          )}
        </div>
      )}

      {tab === 'historial' && (
        <div className="pub-card overflow-hidden">
          {historial.length === 0 ? (
            <div className="p-12 text-center">
              <DocumentTextIcon className="h-16 w-16 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
              <p className="font-display-sport mb-2" style={{ fontSize: 22, lineHeight: 1, color: 'var(--text)' }}>Sin historial</p>
              <p className="text-sm" style={{ color: 'var(--text-dim)' }}>No hay pagos registrados</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {historial.map((pago) => (
                <div
                  key={pago.id}
                  className="p-6 transition-colors"
                  style={{ backgroundColor: 'transparent' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="font-semibold" style={{ color: 'var(--text)' }}>{pago.concepto}</h4>
                      {pago.esDeOtroMiembro && (
                        <p className="font-mono text-[10px] uppercase tracking-[0.2em] mt-1" style={{ color: 'var(--text-muted)' }}>
                          Pago de {pago.socioApellidoNombre} · #{pago.socioNroSocio}
                        </p>
                      )}
                      <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>{formatDate(pago.fecha, { format: 'long' })}</p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] mt-1" style={{ color: 'var(--text-muted)' }}>
                        {pago.metodoPago} · {pago.comprobante}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right flex items-center gap-2">
                        <p className="font-display-sport" style={{ fontSize: 20, lineHeight: 1, color: 'var(--color-primary)' }}>
                          {formatCurrency(pago.monto, { minimumFractionDigits: 0 })}
                        </p>
                        <CheckCircleIcon className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
                      </div>
                      <button
                        onClick={() => descargarReciboPDF(pago.id, pago.numero)}
                        disabled={descargandoPDF === pago.id}
                        className="px-3 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-mono uppercase tracking-[0.15em] text-[11px]"
                        style={{ backgroundColor: 'var(--color-primary)', color: 'var(--accent-fg)' }}
                        title="Descargar recibo"
                      >
                        {descargandoPDF === pago.id ? (
                          <>
                            <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
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
              {/* Resumen — grid athletic con líneas finas */}
              <div>
                <div className="pub-eyebrow mb-3" style={{ color: 'var(--text-dim)' }}>Resumen de cuenta</div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-px" style={{ backgroundColor: 'var(--border)' }}>
                  <CuentaStatTile
                    label="Total debe"
                    value={formatCurrency(cuentaCorriente.resumen.totalDebe)}
                    number="01"
                  />
                  <CuentaStatTile
                    label="Total haber"
                    value={formatCurrency(cuentaCorriente.resumen.totalHaber)}
                    number="02"
                  />
                  <CuentaStatTile
                    label="Saldo final"
                    value={formatCurrency(cuentaCorriente.resumen.saldoFinal)}
                    number="03"
                    accent={parseFloat(cuentaCorriente.resumen.saldoFinal) > 0}
                  />
                  <CuentaStatTile
                    label="Pendiente de pago"
                    value={formatCurrency(cuentaCorriente.resumen.totalPendiente)}
                    sub={`${cuentaCorriente.resumen.cargosPendientes} cuota(s)`}
                    number="04"
                  />
                </div>
              </div>

              {/* Tabla de movimientos */}
              <div className="pub-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                      <tr>
                        {['Fecha', 'Concepto', 'Detalle', 'Debe', 'Haber', 'Saldo'].map((h, i) => (
                          <th
                            key={h}
                            className={`px-6 py-3 font-mono text-[10px] uppercase tracking-[0.2em] ${i >= 3 ? 'text-right' : 'text-left'}`}
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                      {cuentaCorriente.movimientos.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="px-6 py-12 text-center" style={{ color: 'var(--text-dim)' }}>
                            No hay movimientos registrados
                          </td>
                        </tr>
                      ) : (
                        cuentaCorriente.movimientos.map((mov) => (
                          <tr key={mov.id} className="transition-colors" style={{ backgroundColor: 'transparent' }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--text)' }}>
                              {formatDate(mov.fecha, { format: 'long' })}
                            </td>
                            <td className="px-6 py-4 text-sm font-medium" style={{ color: 'var(--text)' }}>
                              {mov.concepto}
                              {mov.estado === 'PENDIENTE' && (
                                <span className="ml-2">
                                  <StatusBadge status="PENDIENTE" type="cuota" size="sm" />
                                </span>
                              )}
                              {mov.socioNro && String(mov.socioNro) !== String(socio.nroSocio) && (
                                <p className="font-mono text-[10px] uppercase tracking-[0.2em] mt-1" style={{ color: 'var(--text-muted)' }}>
                                  de {mov.socioNombre} · #{mov.socioNro}
                                </p>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm" style={{ color: 'var(--text-dim)' }}>
                              {mov.detalle}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium" style={{ color: 'var(--text-dim)' }}>
                              {mov.debe > 0 ? formatCurrency(mov.debe) : '—'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium" style={{ color: 'var(--text)' }}>
                              {mov.haber > 0 ? formatCurrency(mov.haber) : '—'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold"
                                style={{ color: parseFloat(mov.saldo) > 0 ? 'var(--color-primary)' : 'var(--text)' }}>
                              {formatCurrency(mov.saldo)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {cuentaCorriente.movimientos.length > 0 && (
                  <div className="px-6 py-4" style={{ backgroundColor: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>
                      Mostrando {cuentaCorriente.movimientos.length} movimiento(s)
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="pub-card p-12 text-center">
              <DocumentTextIcon className="h-16 w-16 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
              <p className="font-display-sport mb-2" style={{ fontSize: 22, lineHeight: 1, color: 'var(--text)' }}>Error cargando cuenta corriente</p>
              <p className="text-sm mb-4" style={{ color: 'var(--text-dim)' }}>No se pudo cargar la información</p>
              <button onClick={cargarCuentaCorriente} className="pub-cta inline-flex">
                <span>Reintentar</span>
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

function CuentaStatTile({ label, value, sub, number, accent }) {
  return (
    <div className="p-5 flex flex-col gap-3" style={{ backgroundColor: 'var(--bg-surface)' }}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>
          {label}
        </span>
        <span className="font-mono text-[10px] tracking-[0.25em]" style={{ color: 'var(--text-muted)' }}>
          {number}
        </span>
      </div>
      <p className="font-display-sport" style={{ fontSize: 22, lineHeight: 1, color: accent ? 'var(--color-primary)' : 'var(--text)' }}>
        {value}
      </p>
      {sub && (
        <p className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>
          {sub}
        </p>
      )}
    </div>
  )
}
