import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Inbox,
  CheckCircle,
  MessageCircle,
  Mail,
  Phone,
  ExternalLink,
  RefreshCw,
} from 'lucide-react'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import LoadingSpinner from '../../components/LoadingSpinner'
import { useModal } from '../../components/Modal'
import { formatDate } from '../../utils/formatters'
import api from '../../services/api'
import { toast } from 'react-hot-toast'

const TIPO_ICON = {
  WHATSAPP: MessageCircle,
  EMAIL: Mail,
  LLAMADA_TELEFONICA: Phone,
}

const TIPO_LABEL = {
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Email',
  LLAMADA_TELEFONICA: 'Llamada',
  MENSAJE_PORTAL: 'Mensaje portal',
  VISITA_CLUB: 'Visita',
  EVENTO_ESPECIAL: 'Evento',
  OTRO: 'Otro',
}

const RESULTADO_OPCIONES = [
  { value: 'PENDIENTE_DECISION', label: 'Pendiente decisión' },
  { value: 'INTERESADO', label: 'Interesado' },
  { value: 'RECUPERADO', label: 'Recuperado' },
  { value: 'NO_INTERESADO', label: 'No le interesa' },
  { value: 'SIN_RESPUESTA', label: 'Sin respuesta' },
]

export default function RecuperoPendientes() {
  const navigate = useNavigate()
  const { showModal, ModalComponent } = useModal()
  const [pendientes, setPendientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [seleccionada, setSeleccionada] = useState(null) // acción en panel detalle
  const [resultado, setResultado] = useState('INTERESADO')
  const [observacionCierre, setObservacionCierre] = useState('')
  const [marcando, setMarcando] = useState(false)
  const [conversacion, setConversacion] = useState([])
  const [loadingConversacion, setLoadingConversacion] = useState(false)

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    try {
      setLoading(true)
      setError(null)
      const res = await api.getFull('/admin/recupero/pendientes')
      setPendientes(res?.data || [])
    } catch (err) {
      setError(err.message || 'Error cargando pendientes')
    } finally {
      setLoading(false)
    }
  }

  function abrirDetalle(accion) {
    setSeleccionada(accion)
    setResultado(accion.resultado || 'INTERESADO')
    setObservacionCierre('')
    cargarConversacion(accion)
  }

  async function cargarConversacion(accion) {
    if (!accion?.socio?.id) return
    try {
      setLoadingConversacion(true)
      const qs = new URLSearchParams({ socioId: String(accion.socio.id), limit: '50' })
      if (accion.campana?.id) qs.set('campanaId', String(accion.campana.id))
      const res = await api.getFull(`/admin/recupero/acciones?${qs.toString()}`)
      // Orden cronológico ascendente para leerla como chat
      const items = (res?.data || []).slice().sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
      setConversacion(items)
    } catch (err) {
      console.error('Error cargando conversación:', err)
      setConversacion([])
    } finally {
      setLoadingConversacion(false)
    }
  }

  async function marcarAtendida() {
    if (!seleccionada) return
    try {
      setMarcando(true)
      await api.patch(`/admin/recupero/acciones/${seleccionada.id}/atender`, {
        resultado,
        observaciones: observacionCierre
          ? `${seleccionada.observaciones || ''}\n\n— Cierre: ${observacionCierre}`.trim()
          : undefined,
      })
      toast.success('Marcada como atendida')
      setSeleccionada(null)
      setConversacion([])
      // Avisar a la campana del header para que actualice su contador
      window.dispatchEvent(new CustomEvent('recupero:pendiente-atendida'))
      await cargar()
    } catch (err) {
      toast.error(err.message || 'Error al marcar como atendida')
    } finally {
      setMarcando(false)
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => navigate('/admin/recupero')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Volver
        </Button>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2 mr-auto">
          <Inbox className="w-7 h-7 text-primary" />
          Respuestas Pendientes
          {pendientes.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 text-sm font-medium rounded-full bg-red-100 text-red-700 border border-red-200">
              {pendientes.length}
            </span>
          )}
        </h1>
        <Button variant="secondary" size="sm" onClick={cargar}>
          <RefreshCw className="w-4 h-4 mr-1" /> Actualizar
        </Button>
      </div>

      {error && <Alert variant="danger" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}

      {loading ? (
        <LoadingSpinner />
      ) : pendientes.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
          <Inbox className="w-16 h-16 mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-700 mb-1">No hay respuestas pendientes</p>
          <p className="text-sm">Cuando un socio conteste a una campaña, vas a verla acá.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Listado */}
          <div className="lg:col-span-1 bg-white rounded-lg border border-gray-200 max-h-[70vh] overflow-y-auto">
            {pendientes.map(p => {
              const Icon = TIPO_ICON[p.tipo] || MessageCircle
              const active = seleccionada?.id === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => abrirDetalle(p)}
                  className={`w-full text-left p-3 border-b border-gray-100 hover:bg-gray-50 transition ${active ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <Icon className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 truncate">
                          #{p.socio?.nroSocio} {p.socio?.apellidoNombre}
                        </p>
                        <span className="text-xs text-gray-400 ml-auto whitespace-nowrap">{formatDate(p.fecha)}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{p.campana?.nombre || 'Sin campaña'}</p>
                      <p className="text-sm text-gray-700 mt-1 line-clamp-2">{p.observaciones}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Detalle */}
          <div className="lg:col-span-2">
            {seleccionada ? (
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      #{seleccionada.socio?.nroSocio} {seleccionada.socio?.apellidoNombre}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      <span className="font-medium">{TIPO_LABEL[seleccionada.tipo] || seleccionada.tipo}</span>
                      {' · '}
                      <span>{formatDate(seleccionada.fecha)}</span>
                      {seleccionada.campana && (
                        <>
                          {' · '}
                          <button
                            onClick={() => navigate(`/admin/recupero/campanas/${seleccionada.campana.id}`)}
                            className="text-blue-600 hover:underline inline-flex items-center gap-1"
                          >
                            {seleccionada.campana.nombre}
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Conversación cronológica */}
                <div className="border border-gray-200 rounded-lg p-3 mb-4 bg-gray-50 max-h-[400px] overflow-y-auto">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Conversación</p>
                  {loadingConversacion ? (
                    <p className="text-sm text-gray-500">Cargando...</p>
                  ) : conversacion.length === 0 ? (
                    <p className="text-sm text-gray-500">Sin historial previo</p>
                  ) : (
                    <div className="space-y-2">
                      {conversacion.map(a => {
                        const entrante = a.direccion === 'ENTRANTE'
                        const Icon = TIPO_ICON[a.tipo] || MessageCircle
                        return (
                          <div
                            key={a.id}
                            className={`flex ${entrante ? 'justify-start' : 'justify-end'}`}
                          >
                            <div className={`max-w-[80%] rounded-lg p-3 ${entrante ? 'bg-white border border-gray-200' : 'bg-blue-500 text-white'}`}>
                              <div className={`flex items-center gap-1 text-xs mb-1 ${entrante ? 'text-gray-500' : 'text-blue-100'}`}>
                                <Icon className="w-3 h-3" />
                                <span>{TIPO_LABEL[a.tipo] || a.tipo}</span>
                                <span>·</span>
                                <span>{formatDate(a.fecha)}</span>
                                {entrante && a.pendienteRevision && (
                                  <span className="ml-1 px-1 bg-amber-100 text-amber-800 rounded text-[10px] font-medium">PENDIENTE</span>
                                )}
                              </div>
                              <p className={`text-sm whitespace-pre-wrap break-words ${entrante ? 'text-gray-800' : ''}`}>
                                {a.observaciones || a.ofertaRealizada || '(sin contenido)'}
                              </p>
                              {!entrante && a.responsable && (
                                <p className="text-[10px] text-blue-100 mt-1 italic">
                                  por {a.responsable.nombre} {a.responsable.apellido}
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {(seleccionada.socio?.celular || seleccionada.socio?.email) && (
                  <div className="flex flex-wrap gap-2 mb-4 text-xs text-gray-600">
                    {seleccionada.socio?.celular && (
                      <span className="inline-flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
                        <Phone className="w-3 h-3" />
                        {seleccionada.socio.celular}
                      </span>
                    )}
                    {seleccionada.socio?.email && (
                      <span className="inline-flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
                        <Mail className="w-3 h-3" />
                        {seleccionada.socio.email}
                      </span>
                    )}
                  </div>
                )}

                <div className="border-t border-gray-200 pt-4 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Cerrar pendencia</h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Resultado</label>
                    <select
                      value={resultado}
                      onChange={e => setResultado(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    >
                      {RESULTADO_OPCIONES.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Observación (opcional)</label>
                    <textarea
                      value={observacionCierre}
                      onChange={e => setObservacionCierre(e.target.value)}
                      rows={2}
                      placeholder="Qué decidiste, próximos pasos…"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="secondary" onClick={() => setSeleccionada(null)} disabled={marcando}>Cerrar</Button>
                    <Button variant="primary" onClick={marcarAtendida} disabled={marcando}>
                      <CheckCircle className="w-4 h-4 mr-1" />
                      {marcando ? 'Guardando…' : 'Marcar como atendida'}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-400">
                Seleccioná una respuesta de la lista para verla y atenderla.
              </div>
            )}
          </div>
        </div>
      )}

      {ModalComponent}
    </div>
  )
}
