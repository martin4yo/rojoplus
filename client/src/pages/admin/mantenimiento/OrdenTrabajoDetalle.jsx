import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit, Send, Wrench, MapPin, User, Calendar, DollarSign, MessageSquare, ArrowRightCircle, CheckCircle2, XCircle, AlertCircle, Trash2 } from 'lucide-react'
import { Button } from '../../../components/Button'
import { useModal } from '../../../components/Modal'
import api from '../../../services/api'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { tienePermiso, PERMISOS } from '../../../services/permisos'

const ESTADOS = {
  PENDIENTE:  { label: 'Pendiente',  color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  EN_PROCESO: { label: 'En proceso', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  RESUELTA:   { label: 'Resuelta',   color: 'bg-green-100 text-green-800 border-green-200' },
  CANCELADA:  { label: 'Cancelada',  color: 'bg-gray-100 text-gray-700 border-gray-200' }
}
const TRANSICIONES = {
  PENDIENTE:  ['EN_PROCESO', 'CANCELADA'],
  EN_PROCESO: ['RESUELTA', 'PENDIENTE', 'CANCELADA'],
  RESUELTA:   ['EN_PROCESO'],
  CANCELADA:  ['PENDIENTE']
}
const PRIORIDADES = {
  BAJA:    { label: 'Baja',    color: 'text-gray-600 bg-gray-100' },
  MEDIA:   { label: 'Media',   color: 'text-blue-700 bg-blue-100' },
  ALTA:    { label: 'Alta',    color: 'text-orange-700 bg-orange-100' },
  URGENTE: { label: 'Urgente', color: 'text-red-700 bg-red-100' }
}
const TIPOS = { CORRECTIVO: 'Correctivo', PREVENTIVO: 'Preventivo', MEJORA: 'Mejora' }

export default function OrdenTrabajoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showModal, ModalComponent } = useModal()

  const [loading, setLoading] = useState(true)
  const [orden, setOrden] = useState(null)
  const [comentario, setComentario] = useState('')
  const [enviandoComentario, setEnviandoComentario] = useState(false)

  // Modal de cambio de estado
  const [cambioEstado, setCambioEstado] = useState(null) // { estado, requiereResolucion, requiereCosto }
  const [formCambio, setFormCambio] = useState({ comentario: '', resolucion: '', costoReal: '' })
  const [aplicandoCambio, setAplicandoCambio] = useState(false)

  useEffect(() => { cargar() }, [id])

  async function cargar() {
    setLoading(true)
    try {
      const data = await api.get(`/admin/mantenimiento/${id}`)
      setOrden(data)
    } catch (err) {
      showModal({ type: 'error', message: 'Error cargando la orden' })
    } finally {
      setLoading(false)
    }
  }

  async function enviarComentario() {
    if (!comentario.trim()) return
    setEnviandoComentario(true)
    try {
      await api.post(`/admin/mantenimiento/${id}/comentario`, { comentario })
      setComentario('')
      await cargar()
    } catch (err) {
      showModal({ type: 'error', message: err.message || 'Error al enviar comentario' })
    } finally {
      setEnviandoComentario(false)
    }
  }

  function abrirCambioEstado(estado) {
    setFormCambio({ comentario: '', resolucion: '', costoReal: orden?.costoEstimado != null ? String(orden.costoEstimado) : '' })
    setCambioEstado({
      estado,
      requiereResolucion: estado === 'RESUELTA',
      requiereCosto: estado === 'RESUELTA'
    })
  }

  async function aplicarCambioEstado() {
    if (cambioEstado.requiereResolucion && !formCambio.resolucion.trim()) {
      showModal({ type: 'warning', message: 'Indique qué se hizo (resolución)' })
      return
    }
    setAplicandoCambio(true)
    try {
      await api.post(`/admin/mantenimiento/${id}/estado`, {
        estado: cambioEstado.estado,
        comentario: formCambio.comentario || null,
        resolucion: formCambio.resolucion || null,
        costoReal: formCambio.costoReal || null
      })
      setCambioEstado(null)
      await cargar()
    } catch (err) {
      showModal({ type: 'error', message: err.message || 'Error al cambiar estado' })
    } finally {
      setAplicandoCambio(false)
    }
  }

  async function eliminarOrden() {
    showModal({
      type: 'warning',
      message: `¿Eliminar la orden ${orden.numero}? Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        try {
          await api.delete(`/admin/mantenimiento/${id}`)
          navigate('/admin/mantenimiento')
        } catch (err) {
          showModal({ type: 'error', message: err.message || 'Error al eliminar' })
        }
      }
    })
  }

  if (loading) return <LoadingSpinner />
  if (!orden) return <p className="text-center text-gray-500 py-12">Orden no encontrada</p>

  const estadoCfg = ESTADOS[orden.estado] || ESTADOS.PENDIENTE
  const prioridadCfg = PRIORIDADES[orden.prioridad] || PRIORIDADES.MEDIA
  const transicionesDisponibles = TRANSICIONES[orden.estado] || []
  const puedeGestionar = tienePermiso(PERMISOS.MANTENIMIENTO_GESTIONAR)
  const cerrada = orden.estado === 'RESUELTA' || orden.estado === 'CANCELADA'

  return (
    <div>
      {ModalComponent}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/admin/mantenimiento')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gray-100">
              <Wrench className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <p className="font-mono text-sm text-gray-500">{orden.numero}</p>
              <h1 className="text-2xl font-bold text-gray-800">{orden.titulo}</h1>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium border ${estadoCfg.color}`}>
            {estadoCfg.label}
          </span>
          {puedeGestionar && !cerrada && (
            <Button variant="secondary" onClick={() => navigate(`/admin/mantenimiento/${id}/editar`)}>
              <Edit className="w-4 h-4 mr-2" /> Editar
            </Button>
          )}
          {puedeGestionar && orden.estado === 'PENDIENTE' && (
            <button onClick={eliminarOrden} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Eliminar">
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Descripción */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Descripción del problema</h2>
            <p className="text-gray-700 whitespace-pre-wrap">
              {orden.descripcion || <span className="text-gray-400">Sin descripción adicional.</span>}
            </p>
          </div>

          {/* Resolución */}
          {orden.resolucion && (
            <div className="bg-green-50 rounded-lg border border-green-200 p-6">
              <h2 className="text-lg font-semibold text-green-800 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" /> Resolución
              </h2>
              <p className="text-gray-700 whitespace-pre-wrap">{orden.resolucion}</p>
              {orden.costoReal != null && (
                <p className="mt-3 text-sm text-gray-600">
                  Costo real: <span className="font-semibold">${Number(orden.costoReal).toLocaleString()}</span>
                </p>
              )}
            </div>
          )}

          {/* Cambio de estado */}
          {puedeGestionar && transicionesDisponibles.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Cambiar estado</h2>
              <div className="flex flex-wrap gap-2">
                {transicionesDisponibles.map(e => {
                  const cfg = ESTADOS[e]
                  return (
                    <button
                      key={e}
                      onClick={() => abrirCambioEstado(e)}
                      className={`px-4 py-2 rounded-lg border font-medium text-sm ${cfg.color} hover:opacity-80`}
                    >
                      <ArrowRightCircle className="w-4 h-4 inline mr-1" /> {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Historial</h2>

            {/* Caja de comentario */}
            <div className="mb-6 flex gap-2">
              <input
                type="text"
                placeholder="Agregar comentario..."
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && enviarComentario()}
                className="input-field flex-1"
              />
              <Button onClick={enviarComentario} disabled={enviandoComentario || !comentario.trim()}>
                <Send className="w-4 h-4 mr-2" /> Enviar
              </Button>
            </div>

            {orden.historial.length === 0 ? (
              <p className="text-center text-gray-400 py-6">Sin historial</p>
            ) : (
              <div className="space-y-4">
                {orden.historial.map(h => {
                  const isComentario = h.tipo === 'COMENTARIO'
                  const isEstado = h.tipo === 'CAMBIO_ESTADO'
                  const isAsignacion = h.tipo === 'ASIGNACION'
                  const Icon = isComentario ? MessageSquare : isEstado ? ArrowRightCircle : User
                  const iconColor = isComentario ? 'text-gray-500' : isEstado ? 'text-blue-600' : 'text-purple-600'
                  return (
                    <div key={h.id} className="flex gap-3">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center ${iconColor}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-gray-800">
                            {h.admin ? `${h.admin.nombre || ''} ${h.admin.apellido || ''}`.trim() || h.admin.email : 'Sistema'}
                          </span>
                          <span className="text-gray-400 text-xs">{new Date(h.fecha).toLocaleString()}</span>
                        </div>
                        {isEstado && (
                          <p className="text-sm text-gray-600 mt-0.5">
                            Cambió el estado
                            {h.estadoAnterior && <> de <span className="font-medium">{ESTADOS[h.estadoAnterior]?.label || h.estadoAnterior}</span></>}
                            {' '}a <span className="font-medium">{ESTADOS[h.estadoNuevo]?.label || h.estadoNuevo}</span>
                          </p>
                        )}
                        {isAsignacion && h.comentario && (
                          <p className="text-sm text-gray-600 mt-0.5">{h.comentario}</p>
                        )}
                        {isComentario && h.comentario && (
                          <p className="text-sm text-gray-700 mt-1 bg-gray-50 px-3 py-2 rounded-lg whitespace-pre-wrap">
                            {h.comentario}
                          </p>
                        )}
                        {isEstado && h.comentario && (
                          <p className="text-xs text-gray-500 mt-1 italic">"{h.comentario}"</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">Información</h3>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-gray-500">Tipo</dt>
                <dd className="text-gray-800 font-medium">{TIPOS[orden.tipo] || orden.tipo}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Prioridad</dt>
                <dd>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${prioridadCfg.color}`}>
                    {prioridadCfg.label}
                  </span>
                </dd>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <dt className="text-gray-500">Ubicación</dt>
                  <dd className="text-gray-800">
                    {orden.espacio?.nombre || orden.ubicacion || <span className="text-gray-400">Sin especificar</span>}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <User className="w-4 h-4 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <dt className="text-gray-500">Responsable</dt>
                  <dd className="text-gray-800">
                    {orden.responsable?.razonSocial || <span className="text-gray-400">Sin asignar</span>}
                    {orden.responsable && (
                      <span className="text-xs text-gray-500 block">{orden.responsable.tipo}</span>
                    )}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <dt className="text-gray-500">Apertura</dt>
                  <dd className="text-gray-800">{new Date(orden.fechaApertura).toLocaleString()}</dd>
                </div>
              </div>
              {orden.fechaInicio && (
                <div>
                  <dt className="text-gray-500">Inicio</dt>
                  <dd className="text-gray-800">{new Date(orden.fechaInicio).toLocaleString()}</dd>
                </div>
              )}
              {orden.fechaResolucion && (
                <div>
                  <dt className="text-gray-500">Cierre</dt>
                  <dd className="text-gray-800">{new Date(orden.fechaResolucion).toLocaleString()}</dd>
                </div>
              )}
              {orden.centroCosto && (
                <div>
                  <dt className="text-gray-500">Centro de costo</dt>
                  <dd className="text-gray-800">{orden.centroCosto.nombre}</dd>
                </div>
              )}
              {(orden.costoEstimado != null || orden.costoReal != null) && (
                <div className="pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-gray-400" />
                    <dt className="text-gray-500">Costos</dt>
                  </div>
                  {orden.costoEstimado != null && (
                    <p className="text-sm text-gray-700">Estimado: <span className="font-medium">${Number(orden.costoEstimado).toLocaleString()}</span></p>
                  )}
                  {orden.costoReal != null && (
                    <p className="text-sm text-gray-700">Real: <span className="font-medium">${Number(orden.costoReal).toLocaleString()}</span></p>
                  )}
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>

      {/* Modal cambio de estado */}
      {cambioEstado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Cambiar estado a <span className={`inline-flex px-2 py-0.5 rounded-full text-sm border ${ESTADOS[cambioEstado.estado].color}`}>{ESTADOS[cambioEstado.estado].label}</span>
            </h3>

            {cambioEstado.requiereResolucion && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">¿Qué se hizo? *</label>
                <textarea
                  value={formCambio.resolucion}
                  onChange={(e) => setFormCambio({ ...formCambio, resolucion: e.target.value })}
                  rows="3"
                  placeholder="Describir el trabajo realizado..."
                  className="input-field w-full"
                />
              </div>
            )}

            {cambioEstado.requiereCosto && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Costo real</label>
                <input
                  type="number"
                  step="0.01"
                  value={formCambio.costoReal}
                  onChange={(e) => setFormCambio({ ...formCambio, costoReal: e.target.value })}
                  className="input-field w-full"
                  placeholder="0.00"
                />
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Comentario (opcional)</label>
              <input
                type="text"
                value={formCambio.comentario}
                onChange={(e) => setFormCambio({ ...formCambio, comentario: e.target.value })}
                placeholder="Notas adicionales..."
                className="input-field w-full"
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setCambioEstado(null)}>Cancelar</Button>
              <Button onClick={aplicarCambioEstado} disabled={aplicandoCambio}>
                {aplicandoCambio ? 'Aplicando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
