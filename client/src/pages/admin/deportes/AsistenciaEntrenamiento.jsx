import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ClipboardList, ArrowLeft, Check, X, Clock, AlertCircle, Save, Users, Calendar, MapPin, MessageSquare } from 'lucide-react'
import { Button } from '../../../components/Button'
import Modal from '../../../components/Modal'
import { Alert } from '../../../components/Alert'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'
import LoadingSpinner from '../../../components/LoadingSpinner'

const ESTADOS_ASISTENCIA = [
  { value: 'PRESENTE', label: 'Presente', icon: Check, color: 'text-green-600 bg-green-100' },
  { value: 'AUSENTE', label: 'Ausente', icon: X, color: 'text-red-600 bg-red-100' },
  { value: 'TARDE', label: 'Tarde', icon: Clock, color: 'text-yellow-600 bg-yellow-100' },
  { value: 'JUSTIFICADO', label: 'Justificado', icon: AlertCircle, color: 'text-blue-600 bg-blue-100' },
]

export default function AsistenciaEntrenamiento() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [entrenamiento, setEntrenamiento] = useState(null)
  const [socios, setSocios] = useState([])
  const [asistencias, setAsistencias] = useState({}) // { socioId: { estado, horaLlegada, observaciones } }
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [cambiosPendientes, setCambiosPendientes] = useState(false)

  // Modal observaciones
  const [modalObs, setModalObs] = useState({ visible: false, socio: null })
  const [obsTemp, setObsTemp] = useState('')

  useEffect(() => {
    cargarDatos()
  }, [id])

  async function cargarDatos() {
    setLoading(true)
    try {
      const [entrenamientoRes, sociosRes] = await Promise.all([
        api.getFull(`/admin/entrenamientos/${id}`),
        api.getFull(`/admin/entrenamientos/${id}/socios`)
      ])

      setEntrenamiento(entrenamientoRes.data)
      setSocios(sociosRes.data || [])

      // Inicializar asistencias con datos existentes
      const asistenciasIniciales = {}
      for (const socio of sociosRes.data || []) {
        if (socio.asistencia) {
          asistenciasIniciales[socio.id] = {
            estado: socio.asistencia.estado,
            horaLlegada: socio.asistencia.horaLlegada || '',
            observaciones: socio.asistencia.observaciones || ''
          }
        }
      }
      setAsistencias(asistenciasIniciales)
    } catch (err) {
      setError('Error al cargar los datos')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function handleEstadoChange(socioId, estado) {
    setAsistencias(prev => ({
      ...prev,
      [socioId]: {
        ...prev[socioId],
        estado
      }
    }))
    setCambiosPendientes(true)
  }

  function abrirModalObs(socio) {
    const obs = asistencias[socio.id]?.observaciones || ''
    setObsTemp(obs)
    setModalObs({ visible: true, socio })
  }

  function guardarObservaciones() {
    if (!modalObs.socio) return
    setAsistencias(prev => ({
      ...prev,
      [modalObs.socio.id]: {
        ...prev[modalObs.socio.id],
        observaciones: obsTemp
      }
    }))
    setCambiosPendientes(true)
    setModalObs({ visible: false, socio: null })
  }

  function marcarTodos(estado) {
    const nuevasAsistencias = {}
    for (const socio of socios) {
      nuevasAsistencias[socio.id] = {
        ...asistencias[socio.id],
        estado
      }
    }
    setAsistencias(nuevasAsistencias)
    setCambiosPendientes(true)
  }

  async function guardarAsistencias() {
    setError(null)
    setGuardando(true)

    try {
      const asistenciasArray = Object.entries(asistencias)
        .filter(([_, data]) => data.estado) // Solo los que tienen estado
        .map(([socioId, data]) => ({
          socioId: parseInt(socioId),
          estado: data.estado,
          horaLlegada: data.horaLlegada || null,
          observaciones: data.observaciones || null
        }))

      if (asistenciasArray.length === 0) {
        setError('No hay asistencias para guardar')
        setGuardando(false)
        return
      }

      await api.post(`/admin/entrenamientos/${id}/asistencia`, { asistencias: asistenciasArray })
      setSuccess('Asistencia guardada correctamente')
      setCambiosPendientes(false)

      // Recargar datos
      cargarDatos()
    } catch (err) {
      setError(err.message || 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  // Estadisticas
  const stats = {
    total: socios.length,
    presentes: Object.values(asistencias).filter(a => a.estado === 'PRESENTE').length,
    ausentes: Object.values(asistencias).filter(a => a.estado === 'AUSENTE').length,
    tarde: Object.values(asistencias).filter(a => a.estado === 'TARDE').length,
    justificados: Object.values(asistencias).filter(a => a.estado === 'JUSTIFICADO').length,
    sinMarcar: socios.length - Object.values(asistencias).filter(a => a.estado).length
  }

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  if (!entrenamiento) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Entrenamiento no encontrado</p>
        <Link to="/admin/deportes/entrenamientos" className="text-primary hover:underline mt-2 inline-block">
          Volver al calendario
        </Link>
      </div>
    )
  }

  const fechaFormateada = new Date(entrenamiento.fecha).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/deportes/entrenamientos"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div className="p-2 rounded-lg bg-primary/10">
            <ClipboardList className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Tomar Asistencia</h1>
            <p className="text-gray-500 text-sm">
              {entrenamiento.categoriaActividad?.actividad?.nombre} - {entrenamiento.categoriaActividad?.nombre}
            </p>
          </div>
        </div>
        {tienePermiso(PERMISOS.DEPORTES_ENTRENAMIENTOS) && (
          <Button onClick={guardarAsistencias} loading={guardando} disabled={!cambiosPendientes}>
            <Save className="w-4 h-4 mr-2" />
            Guardar Asistencia
          </Button>
        )}
      </div>

      {error && <Alert type="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert type="success" className="mb-4" onClose={() => setSuccess(null)}>{success}</Alert>}

      {/* Info del entrenamiento */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2 text-gray-600">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="capitalize">{fechaFormateada}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Clock className="w-4 h-4 text-gray-400" />
            <span>{entrenamiento.horaInicio} - {entrenamiento.horaFin}</span>
          </div>
          {entrenamiento.espacio && (
            <div className="flex items-center gap-2 text-gray-600">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span>{entrenamiento.espacio.nombre}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-gray-600">
            <Users className="w-4 h-4 text-gray-400" />
            <span>{socios.length} inscriptos</span>
          </div>
          {entrenamiento.estado === 'CANCELADO' && (
            <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
              CANCELADO
            </span>
          )}
        </div>
      </div>

      {/* Estadisticas y acciones rapidas */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-4">
            <div className="text-center px-4">
              <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
              <div className="text-xs text-gray-500">Total</div>
            </div>
            <div className="text-center px-4 border-l">
              <div className="text-2xl font-bold text-green-600">{stats.presentes}</div>
              <div className="text-xs text-gray-500">Presentes</div>
            </div>
            <div className="text-center px-4 border-l">
              <div className="text-2xl font-bold text-red-600">{stats.ausentes}</div>
              <div className="text-xs text-gray-500">Ausentes</div>
            </div>
            <div className="text-center px-4 border-l">
              <div className="text-2xl font-bold text-yellow-600">{stats.tarde}</div>
              <div className="text-xs text-gray-500">Tarde</div>
            </div>
            <div className="text-center px-4 border-l">
              <div className="text-2xl font-bold text-blue-600">{stats.justificados}</div>
              <div className="text-xs text-gray-500">Justificados</div>
            </div>
            {stats.sinMarcar > 0 && (
              <div className="text-center px-4 border-l">
                <div className="text-2xl font-bold text-gray-400">{stats.sinMarcar}</div>
                <div className="text-xs text-gray-500">Sin marcar</div>
              </div>
            )}
          </div>

          {/* Acciones rapidas */}
          {tienePermiso(PERMISOS.DEPORTES_ENTRENAMIENTOS) && (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => marcarTodos('PRESENTE')}
                disabled={entrenamiento.estado === 'CANCELADO'}
              >
                <Check className="w-4 h-4 mr-1" />
                Todos presentes
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => marcarTodos('AUSENTE')}
                disabled={entrenamiento.estado === 'CANCELADO'}
              >
                <X className="w-4 h-4 mr-1" />
                Todos ausentes
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Lista de socios */}
      {socios.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No hay socios inscriptos en esta categoria</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="divide-y">
            {socios.map((socio) => {
              const asistencia = asistencias[socio.id] || {}
              const estadoActual = asistencia.estado

              return (
                <div
                  key={socio.id}
                  className="p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Info del socio */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {socio.fotoUrl ? (
                          <img
                            src={socio.fotoUrl}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none'
                              e.target.nextSibling.style.display = 'flex'
                            }}
                          />
                        ) : null}
                        <span
                          className="text-primary font-bold text-lg"
                          style={{ display: socio.fotoUrl ? 'none' : 'flex' }}
                        >
                          {socio.apellidoNombre?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800 truncate">{socio.apellidoNombre}</p>
                        <p className="text-sm text-gray-500">#{socio.nroSocio}</p>
                      </div>
                    </div>

                    {/* Botones de estado + icono observaciones */}
                    <div className="flex flex-wrap items-center gap-2">
                      {ESTADOS_ASISTENCIA.map((estado) => {
                        const Icon = estado.icon
                        const isSelected = estadoActual === estado.value
                        return (
                          <button
                            key={estado.value}
                            onClick={() => handleEstadoChange(socio.id, estado.value)}
                            disabled={entrenamiento.estado === 'CANCELADO'}
                            className={`
                              flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all
                              ${isSelected
                                ? estado.color + ' ring-2 ring-offset-1 ring-current'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }
                              disabled:opacity-50 disabled:cursor-not-allowed
                            `}
                          >
                            <Icon className="w-4 h-4" />
                            <span className="hidden sm:inline">{estado.label}</span>
                          </button>
                        )
                      })}

                      {/* Icono observaciones */}
                      <button
                        onClick={() => abrirModalObs(socio)}
                        disabled={entrenamiento.estado === 'CANCELADO'}
                        className={`
                          p-2 rounded-lg transition-all
                          ${asistencia.observaciones
                            ? 'bg-purple-100 text-purple-600'
                            : 'bg-gray-100 text-gray-400 hover:text-gray-600 hover:bg-gray-200'
                          }
                          disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                        title={asistencia.observaciones || 'Agregar observacion'}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Boton guardar fijo en mobile */}
      {cambiosPendientes && tienePermiso(PERMISOS.DEPORTES_ENTRENAMIENTOS) && (
        <div className="fixed bottom-4 left-4 right-4 sm:hidden">
          <Button onClick={guardarAsistencias} loading={guardando} className="w-full shadow-lg">
            <Save className="w-4 h-4 mr-2" />
            Guardar Asistencia
          </Button>
        </div>
      )}

      {/* Modal Observaciones */}
      <Modal
        isOpen={modalObs.visible}
        onClose={() => setModalObs({ visible: false, socio: null })}
        title="Observaciones"
      >
        {modalObs.socio && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {modalObs.socio.fotoUrl ? (
                  <img
                    src={modalObs.socio.fotoUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none'
                      e.target.nextSibling.style.display = 'flex'
                    }}
                  />
                ) : null}
                <span
                  className="text-primary font-bold text-lg"
                  style={{ display: modalObs.socio.fotoUrl ? 'none' : 'flex' }}
                >
                  {modalObs.socio.apellidoNombre?.charAt(0)?.toUpperCase() || '?'}
                </span>
              </div>
              <div>
                <p className="font-medium text-gray-800">{modalObs.socio.apellidoNombre}</p>
                <p className="text-sm text-gray-500">#{modalObs.socio.nroSocio}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observacion
              </label>
              <textarea
                value={obsTemp}
                onChange={(e) => setObsTemp(e.target.value)}
                placeholder="Ingrese una observacion..."
                className="input-field w-full"
                rows={3}
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => setModalObs({ visible: false, socio: null })}
              >
                Cancelar
              </Button>
              <Button onClick={guardarObservaciones}>
                Guardar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
