import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Send, Mail, MessageSquare, Users, CheckCircle,
  XCircle, Clock, AlertCircle, BarChart3, Loader2, Trash2
} from 'lucide-react'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import StatusBadge from '../../components/StatusBadge'
import { formatDateTime } from '../../utils/formatters'
import api from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'

function EnviosList({ envios }) {
  const [filtro, setFiltro] = useState('todos')

  const errores = envios.filter(e => e.estado === 'ERROR')
  const lista = filtro === 'errores' ? errores : envios

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-800">Envíos ({envios.length})</h2>
        {errores.length > 0 && (
          <div className="flex gap-1">
            <button
              onClick={() => setFiltro('todos')}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${filtro === 'todos' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Todos
            </button>
            <button
              onClick={() => setFiltro('errores')}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${filtro === 'errores' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
            >
              Solo errores ({errores.length})
            </button>
          </div>
        )}
      </div>
      <div className="divide-y divide-gray-100">
        {lista.map(envio => {
          const cfg = ESTADO_ENVIO_CONFIG[envio.estado] || ESTADO_ENVIO_CONFIG.PENDIENTE
          return (
            <div key={envio.id} className="py-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {envio.canal === 'email'
                    ? <Mail className="w-4 h-4 text-blue-400 shrink-0" />
                    : <MessageSquare className="w-4 h-4 text-green-400 shrink-0" />}
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {envio.socio?.apellidoNombre || envio.destinatario}
                    </p>
                    <p className="text-xs text-gray-400">{envio.destinatario}</p>
                  </div>
                </div>
                <StatusBadge {...cfg} />
              </div>
              {envio.estado === 'ERROR' && envio.error && (
                <p className="mt-1 ml-7 text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                  {envio.error}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const ESTADO_ENVIO_CONFIG = {
  PENDIENTE: { variant: 'secondary', label: 'Pendiente', icon: Clock },
  ENVIADO:   { variant: 'success',   label: 'Enviado',   icon: CheckCircle },
  ERROR:     { variant: 'danger',    label: 'Error',     icon: XCircle },
  REBOTADO:  { variant: 'warning',   label: 'Rebotado',  icon: AlertCircle },
}

const ESTADO_CAMPANA_CONFIG = {
  BORRADOR:   { variant: 'secondary', label: 'Borrador' },
  PROGRAMADA: { variant: 'info',      label: 'Programada' },
  EN_CURSO:   { variant: 'warning',   label: 'En Curso' },
  COMPLETADA: { variant: 'success',   label: 'Completada' },
  CANCELADA:  { variant: 'danger',    label: 'Cancelada' },
}

export default function DetalleCampana() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [campana, setCampana] = useState(null)
  const [estadisticas, setEstadisticas] = useState(null)
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    cargar()
  }, [id])

  async function cargar() {
    setLoading(true)
    try {
      const [campanaRes, statsRes] = await Promise.all([
        api.getFull(`/admin/comunicaciones/campanas/${id}`),
        api.getFull(`/admin/comunicaciones/campanas/${id}/estadisticas`).catch(() => null)
      ])
      setCampana(campanaRes?.data || campanaRes)
      setEstadisticas(statsRes?.data || statsRes)
    } catch (err) {
      setError('Error al cargar la campaña')
    } finally {
      setLoading(false)
    }
  }

  async function handleEnviar() {
    setEnviando(true)
    setError(null)
    try {
      const res = await api.postFull(`/admin/comunicaciones/campanas/${id}/enviar`, {})
      setSuccess(res?.message || 'Campaña enviada correctamente')
      await cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  async function handleEliminar() {
    if (!confirm('¿Eliminar esta campaña? Esta acción no se puede deshacer.')) return
    try {
      await api.delete(`/admin/comunicaciones/campanas/${id}`)
      navigate('/admin/comunicaciones')
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <LoadingSpinner />

  if (!campana) return (
    <div className="text-center py-16 text-gray-500">
      <AlertCircle className="w-12 h-12 mx-auto mb-3" />
      <p>Campaña no encontrada</p>
    </div>
  )

  const canales = JSON.parse(campana.canales || '[]')
  const segmentacion = typeof campana.segmentacion === 'string'
    ? JSON.parse(campana.segmentacion || '{}')
    : (campana.segmentacion || {})
  const estadoConfig = ESTADO_CAMPANA_CONFIG[campana.estado] || { variant: 'secondary', label: campana.estado }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/admin/comunicaciones')} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-800">{campana.nombre}</h1>
            <StatusBadge {...estadoConfig} />
          </div>
          {campana.descripcion && <p className="text-gray-500 text-sm mt-1">{campana.descripcion}</p>}
        </div>
        <div className="flex items-center gap-2">
          {(campana.estado === 'BORRADOR' || campana.estado === 'PROGRAMADA') && (
            <>
              <button
                disabled={enviando}
                onClick={handleEnviar}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-semibold text-white bg-primary hover:bg-primary-dark rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {enviando
                  ? <><Loader2 className="w-4 h-4 shrink-0 animate-spin" />Enviando...</>
                  : <><Send className="w-4 h-4 shrink-0" />Enviar Ahora</>}
              </button>
              <button onClick={handleEliminar} className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} className="mb-4" />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} className="mb-4" />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-6">

          {/* Estadísticas */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-gray-500" /> Resultados
            </h2>
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Destinatarios</p>
                <p className="text-2xl font-bold text-gray-800">{campana.totalDestinatarios}</p>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Enviados</p>
                <p className="text-2xl font-bold text-blue-600">{campana.enviados}</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Abiertos</p>
                <p className="text-2xl font-bold text-green-600">{campana.abiertos}</p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Errores</p>
                <p className="text-2xl font-bold text-red-500">{campana.errores}</p>
              </div>
            </div>
            {estadisticas && campana.enviados > 0 && (
              <div className="mt-3 flex gap-6 text-sm text-gray-600">
                <span>Tasa apertura: <strong>{estadisticas.tasaApertura}%</strong></span>
                <span>Tasa clicks: <strong>{estadisticas.tasaClicks}%</strong></span>
              </div>
            )}
          </div>

          {/* Lista de envíos */}
          {campana.envios && campana.envios.length > 0 && (
            <EnviosList envios={campana.envios} />
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-3">Detalles</h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-gray-500">Tipo</dt>
                <dd className="font-medium">{campana.tipo}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Canales</dt>
                <dd className="flex gap-1 mt-1">
                  {canales.map(c => (
                    <span key={c} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs capitalize">{c}</span>
                  ))}
                </dd>
              </div>
              {campana.emailTemplate && (
                <div>
                  <dt className="text-gray-500">Template email</dt>
                  <dd className="font-medium">{campana.emailTemplate.nombre}</dd>
                  <dd className="text-xs text-gray-400">{campana.emailTemplate.subject}</dd>
                </div>
              )}
              {campana.fechaEnvio && (
                <div>
                  <dt className="text-gray-500">Fecha de envío</dt>
                  <dd>{formatDateTime(campana.fechaEnvio)}</dd>
                </div>
              )}
              {campana.creadoPor && (
                <div>
                  <dt className="text-gray-500">Creado por</dt>
                  <dd>{campana.creadoPor.nombre} {campana.creadoPor.apellido}</dd>
                  {campana.creadoPor.email && <dd className="text-xs text-gray-400">{campana.creadoPor.email}</dd>}
                </div>
              )}
            </dl>
          </div>

          {/* Segmentación */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-500" /> Segmentación
            </h2>
            <dl className="space-y-2 text-sm">
              {segmentacion.estado?.length > 0 && (
                <div>
                  <dt className="text-gray-500">Estado socios</dt>
                  <dd className="flex flex-wrap gap-1 mt-1">
                    {segmentacion.estado.map(e => (
                      <span key={e} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{e}</span>
                    ))}
                  </dd>
                </div>
              )}
              {segmentacion.actividadId && (
                <div>
                  <dt className="text-gray-500">Actividad</dt>
                  <dd>ID #{segmentacion.actividadId}</dd>
                </div>
              )}
              {segmentacion.deudores !== null && segmentacion.deudores !== undefined && (
                <div>
                  <dt className="text-gray-500">Deuda</dt>
                  <dd>{segmentacion.deudores === true ? 'Solo deudores' : 'Sin deuda'}</dd>
                </div>
              )}
              {(segmentacion.edadMin || segmentacion.edadMax) && (
                <div>
                  <dt className="text-gray-500">Edad</dt>
                  <dd>{segmentacion.edadMin || '?'} – {segmentacion.edadMax || '?'} años</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
