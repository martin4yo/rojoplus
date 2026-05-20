import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  TicketIcon,
  QrCodeIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline'
import api from '../../../services/api'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { formatDate, formatCurrency } from '../../../utils/formatters'

const ESTADOS = [
  { key: 'VALIDA', label: 'Disponibles', icon: TicketIcon, tone: 'primary' },
  { key: 'USADA', label: 'Usadas', icon: CheckCircleIcon, tone: 'muted' },
  { key: 'ANULADA', label: 'Anuladas', icon: ExclamationCircleIcon, tone: 'error' },
]

export default function MisEntradasSocio({ socio, tokenPortal }) {
  const [entradas, setEntradas] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('VALIDA')
  const [qrEntrada, setQrEntrada] = useState(null)
  const [descargando, setDescargando] = useState(null)

  useEffect(() => {
    cargar()
  }, [tokenPortal])

  async function cargar() {
    try {
      setLoading(true)
      const res = await api.get(`/socio/${tokenPortal}/entradas`)
      setEntradas(res || [])
    } catch (err) {
      console.error('Error cargando entradas:', err)
    } finally {
      setLoading(false)
    }
  }

  const entradasFiltradas = entradas.filter(e => e.estado === tab)
  const contadores = {
    VALIDA: entradas.filter(e => e.estado === 'VALIDA').length,
    USADA: entradas.filter(e => e.estado === 'USADA').length,
    ANULADA: entradas.filter(e => e.estado === 'ANULADA').length,
  }

  async function descargarPDF(entrada) {
    if (descargando) return
    setDescargando(entrada.id)
    try {
      const token = localStorage.getItem('socioToken') || ''
      const apiUrl = import.meta.env.VITE_API_URL || '/api'
      const headers = {}
      if (token) headers.Authorization = `Bearer ${token}`
      const tenantSlug = window.location.hostname.match(/^([^.]+)\.localhost/)?.[1]
      if (tenantSlug) headers['X-Tenant-Slug'] = tenantSlug

      const resp = await fetch(`${apiUrl}/socio/${tokenPortal}/entradas/${entrada.codigo}/pdf`, { headers })
      if (!resp.ok) throw new Error('No se pudo descargar')
      const blob = await resp.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `entrada-${entrada.codigo.slice(0, 8)}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error descargando entrada:', err)
    } finally {
      setDescargando(null)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="pub-eyebrow mb-3" style={{ color: 'var(--text-dim)' }}>Eventos</div>
        <h1 className="font-display-sport" style={{ fontSize: 'clamp(28px, 4vw, 44px)', lineHeight: 0.96, color: 'var(--text)' }}>
          Mis <span style={{ color: 'var(--color-primary)' }}>entradas</span>
        </h1>
        <p className="text-sm mt-2" style={{ color: 'var(--text-dim)' }}>
          Acá ves todas las entradas que compraste. Mostrá el QR en la puerta del evento.
        </p>
      </div>

      {/* Tabs por estado */}
      <div className="grid grid-cols-3 gap-px" style={{ backgroundColor: 'var(--border)' }}>
        {ESTADOS.map(({ key, label, icon: Icon }) => {
          const activo = tab === key
          const count = contadores[key]
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="py-4 px-3 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors flex items-center justify-center gap-2"
              style={{
                backgroundColor: activo ? 'var(--color-primary)' : 'var(--bg-surface)',
                color: activo ? 'var(--accent-fg)' : 'var(--text-dim)',
              }}
            >
              <Icon className="h-4 w-4" />
              <span>{label} ({count})</span>
            </button>
          )
        })}
      </div>

      {/* Lista */}
      {entradasFiltradas.length === 0 ? (
        <div className="pub-card p-12 text-center">
          <TicketIcon className="h-16 w-16 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
          <p className="font-display-sport mb-2" style={{ fontSize: 22, lineHeight: 1, color: 'var(--text)' }}>
            Sin entradas {tab === 'VALIDA' ? 'disponibles' : tab === 'USADA' ? 'usadas' : 'anuladas'}
          </p>
          <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
            {tab === 'VALIDA' ? 'Comprá tu entrada en la sección Eventos.' : 'No hay entradas en este estado.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {entradasFiltradas.map(e => (
            <EntradaCard
              key={e.id}
              entrada={e}
              onMostrarQR={() => setQrEntrada(e)}
              onDescargar={() => descargarPDF(e)}
              descargando={descargando === e.id}
            />
          ))}
        </div>
      )}

      {/* Modal QR fullscreen */}
      {qrEntrada && (
        <ModalQR
          entrada={qrEntrada}
          tokenPortal={tokenPortal}
          onClose={() => setQrEntrada(null)}
          onUsada={() => { setQrEntrada(null); cargar() }}
        />
      )}
    </div>
  )
}

function EntradaCard({ entrada, onMostrarQR, onDescargar, descargando }) {
  const estadoColor =
    entrada.estado === 'VALIDA' ? 'var(--color-primary)' :
    entrada.estado === 'USADA' ? 'var(--text-muted)' :
    'var(--error)'

  return (
    <div
      className="pub-card overflow-hidden"
      style={{ opacity: entrada.estado === 'ANULADA' ? 0.6 : 1 }}
    >
      {/* Banda superior con estado */}
      <div
        className="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] flex items-center justify-between"
        style={{ backgroundColor: estadoColor, color: 'white' }}
      >
        <span>{entrada.estado === 'VALIDA' ? 'Lista para usar' : entrada.estado}</span>
        <span className="opacity-75">#{entrada.codigo.slice(0, 8)}</span>
      </div>

      <div className="p-5">
        <h3 className="font-display-sport mb-3" style={{ fontSize: 20, lineHeight: 1.1, color: 'var(--text)' }}>
          {entrada.evento.nombre}
        </h3>

        <div className="space-y-1.5 text-sm mb-4" style={{ color: 'var(--text-dim)' }}>
          <div className="flex items-center gap-2">
            <CalendarDaysIcon className="h-4 w-4" />
            <span>{formatDate(entrada.evento.fecha, { format: 'long' })}</span>
          </div>
          {entrada.evento.hora && (
            <div className="flex items-center gap-2">
              <ClockIcon className="h-4 w-4" />
              <span>{entrada.evento.hora}</span>
            </div>
          )}
          {entrada.evento.ubicacion && (
            <div className="flex items-center gap-2">
              <MapPinIcon className="h-4 w-4" />
              <span>{entrada.evento.ubicacion}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pb-3 mb-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>
            {entrada.categoria.nombre}
          </span>
          <span className="font-display-sport" style={{ fontSize: 18, color: 'var(--text)' }}>
            {formatCurrency(entrada.precio, { minimumFractionDigits: 0 })}
          </span>
        </div>

        {entrada.estado === 'VALIDA' ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onMostrarQR}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded font-mono text-[11px] uppercase tracking-[0.2em] transition-colors"
              style={{ backgroundColor: 'var(--color-primary)', color: 'var(--accent-fg)' }}
            >
              <QrCodeIcon className="h-4 w-4" />
              Mostrar QR
            </button>
            <button
              onClick={onDescargar}
              disabled={descargando}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded font-mono text-[11px] uppercase tracking-[0.2em] transition-colors disabled:opacity-50"
              style={{ border: '1px solid var(--border)', color: 'var(--text)' }}
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              {descargando ? '...' : 'PDF'}
            </button>
          </div>
        ) : entrada.estado === 'USADA' ? (
          <div className="text-center py-2 font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>
            {entrada.fechaIngreso ? `Usada el ${formatDate(entrada.fechaIngreso, { format: 'long' })}` : 'Ya usada'}
          </div>
        ) : (
          <div className="text-center py-2 font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--error)' }}>
            {entrada.motivoAnulacion || 'Anulada'}
          </div>
        )}
      </div>
    </div>
  )
}

function ModalQR({ entrada, tokenPortal, onClose, onUsada }) {
  const [validada, setValidada] = useState(false)

  // Mantiene la pantalla despierta mientras el modal está abierto
  useEffect(() => {
    let wakeLock = null
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen')
        }
      } catch {
        /* ignore */
      }
    }
    requestWakeLock()
    return () => {
      if (wakeLock) {
        try { wakeLock.release() } catch { /* ignore */ }
      }
    }
  }, [])

  // Polling: cada 3s chequea si la entrada cambió a USADA.
  // Cuando pasa a USADA muestra un check verde por 1.5s y avisa al padre para cerrar + recargar.
  useEffect(() => {
    if (validada) return
    const tick = async () => {
      try {
        const r = await api.get(`/socio/${tokenPortal}/entradas/${entrada.codigo}/estado`)
        if (r?.estado === 'USADA') {
          setValidada(true)
          setTimeout(() => onUsada?.(), 1500)
        }
      } catch {
        /* ignore: red intermitente */
      }
    }
    const interval = setInterval(tick, 3000)
    return () => clearInterval(interval)
  }, [tokenPortal, entrada.codigo, validada, onUsada])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.95)' }}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        aria-label="Cerrar"
      >
        <XMarkIcon className="h-6 w-6 text-white" />
      </button>

      <div
        className="bg-white rounded-2xl p-6 max-w-sm w-full relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-1">
            Entrada
          </p>
          <h2 className="font-display-sport text-gray-800 mb-1" style={{ fontSize: 22, lineHeight: 1.1 }}>
            {entrada.evento.nombre}
          </h2>
          <p className="text-sm text-gray-600">
            {entrada.categoria.nombre} · {formatDate(entrada.evento.fecha)}
          </p>
        </div>

        <div className="flex items-center justify-center p-4 bg-gray-50 rounded-xl mb-4">
          <QRCodeSVG
            value={entrada.codigo}
            size={260}
            level="M"
            includeMargin
          />
        </div>

        <p className="font-mono text-[10px] text-center text-gray-500 break-all mb-2">
          {entrada.codigo}
        </p>
        <p className="text-xs text-center text-gray-500">
          Presentá este código en la puerta del evento. Después de usarlo, va a aparecer en "Usadas".
        </p>

        {/* Overlay de "validada" */}
        {validada && (
          <div className="absolute inset-0 bg-green-500 flex flex-col items-center justify-center text-white animate-fadeIn">
            <CheckCircleIcon className="h-24 w-24 mb-3" />
            <p className="font-display-sport text-2xl">¡Validada!</p>
            <p className="text-sm mt-1 opacity-90">Pasá nomás</p>
          </div>
        )}
      </div>
    </div>
  )
}
