import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Plus, ChevronLeft, ChevronRight, Clock, MapPin, Users, X, RefreshCw, Settings, Bell } from 'lucide-react'
import { Button } from '../../../components/Button'
import Modal from '../../../components/Modal'
import { Alert } from '../../../components/Alert'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']
const DIAS_SEMANA_FULL = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']

export default function EntrenamientosCalendario() {
  const [entrenamientos, setEntrenamientos] = useState([])
  const [actividades, setActividades] = useState([])
  const [espacios, setEspacios] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Estado del calendario
  const [vista, setVista] = useState('semana') // dia | semana | mes
  const [fechaActual, setFechaActual] = useState(new Date())

  // Filtros
  const [filtroActividad, setFiltroActividad] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroEspacio, setFiltroEspacio] = useState('')

  // Modal entrenamiento
  const [modalEntrenamiento, setModalEntrenamiento] = useState({ visible: false, entrenamiento: null })

  // Modal generar
  const [modalGenerar, setModalGenerar] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [formGenerar, setFormGenerar] = useState({
    categoriaActividadId: '',
    fechaDesde: '',
    fechaHasta: ''
  })

  // Modal cancelar
  const [modalCancelar, setModalCancelar] = useState({ visible: false, entrenamiento: null })
  const [cancelando, setCancelando] = useState(false)
  const [motivoCancelacion, setMotivoCancelacion] = useState('')
  const [notificando, setNotificando] = useState(false)

  // Modal nuevo entrenamiento
  const [modalNuevo, setModalNuevo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [formNuevo, setFormNuevo] = useState({
    categoriaActividadId: '',
    espacioId: '',
    fecha: '',
    horaInicio: '18:00',
    horaFin: '19:30',
    observaciones: ''
  })

  useEffect(() => {
    cargarDatosAuxiliares()
  }, [])

  useEffect(() => {
    cargarEntrenamientos()
  }, [fechaActual, vista, filtroActividad, filtroCategoria, filtroEspacio])

  async function cargarDatosAuxiliares() {
    try {
      const [actividadesRes, espaciosRes] = await Promise.all([
        api.getFull('/admin/actividades?activo=true'),
        api.getFull('/admin/espacios-deportivos?activo=true')
      ])
      setActividades(actividadesRes.data || [])
      setEspacios(espaciosRes.data || [])

      // Cargar categorías
      const todasCategorias = []
      for (const act of actividadesRes.data || []) {
        const catRes = await api.getFull(`/admin/categorias-actividad?actividadId=${act.id}&activo=true`)
        todasCategorias.push(...(catRes.data || []).map(c => ({ ...c, actividad: act })))
      }
      setCategorias(todasCategorias)
    } catch (err) {
      console.error('Error cargando datos auxiliares:', err)
    }
  }

  async function cargarEntrenamientos() {
    setLoading(true)
    try {
      const { desde, hasta } = getRangoFechas()
      const params = new URLSearchParams()
      params.append('fechaDesde', desde.toISOString().split('T')[0])
      params.append('fechaHasta', hasta.toISOString().split('T')[0])
      if (filtroActividad) params.append('actividadId', filtroActividad)
      if (filtroCategoria) params.append('categoriaActividadId', filtroCategoria)
      if (filtroEspacio) params.append('espacioId', filtroEspacio)

      const response = await api.getFull(`/admin/entrenamientos?${params.toString()}`)
      setEntrenamientos(response.data || [])
    } catch (err) {
      setError('Error al cargar entrenamientos')
    } finally {
      setLoading(false)
    }
  }

  function getRangoFechas() {
    if (vista === 'dia') {
      return { desde: new Date(fechaActual), hasta: new Date(fechaActual) }
    } else if (vista === 'semana') {
      const inicioSemana = new Date(fechaActual)
      inicioSemana.setDate(fechaActual.getDate() - fechaActual.getDay())
      const finSemana = new Date(inicioSemana)
      finSemana.setDate(inicioSemana.getDate() + 6)
      return { desde: inicioSemana, hasta: finSemana }
    } else {
      const inicioMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1)
      const finMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 0)
      return { desde: inicioMes, hasta: finMes }
    }
  }

  function navegarAnterior() {
    const nueva = new Date(fechaActual)
    if (vista === 'dia') {
      nueva.setDate(nueva.getDate() - 1)
    } else if (vista === 'semana') {
      nueva.setDate(nueva.getDate() - 7)
    } else {
      nueva.setMonth(nueva.getMonth() - 1)
    }
    setFechaActual(nueva)
  }

  function navegarSiguiente() {
    const nueva = new Date(fechaActual)
    if (vista === 'dia') {
      nueva.setDate(nueva.getDate() + 1)
    } else if (vista === 'semana') {
      nueva.setDate(nueva.getDate() + 7)
    } else {
      nueva.setMonth(nueva.getMonth() + 1)
    }
    setFechaActual(nueva)
  }

  function irAHoy() {
    setFechaActual(new Date())
  }

  // Días de la semana actual
  const diasSemana = useMemo(() => {
    const { desde } = getRangoFechas()
    const dias = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(desde)
      d.setDate(desde.getDate() + i)
      dias.push(d)
    }
    return dias
  }, [fechaActual, vista])

  // Agrupar entrenamientos por fecha
  const entrenamientosPorFecha = useMemo(() => {
    const map = {}
    entrenamientos.forEach(e => {
      const fecha = new Date(e.fecha).toISOString().split('T')[0]
      if (!map[fecha]) map[fecha] = []
      map[fecha].push(e)
    })
    // Ordenar por hora
    Object.keys(map).forEach(fecha => {
      map[fecha].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
    })
    return map
  }, [entrenamientos])

  async function handleGenerar(e) {
    e.preventDefault()
    setError(null)

    if (!formGenerar.fechaDesde || !formGenerar.fechaHasta) {
      setError('Fecha desde y hasta son requeridas')
      return
    }

    setGenerando(true)
    try {
      const response = await api.post('/admin/entrenamientos/generar', {
        categoriaActividadId: formGenerar.categoriaActividadId ? parseInt(formGenerar.categoriaActividadId) : null,
        fechaDesde: formGenerar.fechaDesde,
        fechaHasta: formGenerar.fechaHasta
      })

      const { creados, errores, detalleErrores } = response.data || response
      setSuccess(`Se generaron ${creados} entrenamientos${errores > 0 ? ` (${errores} errores)` : ''}`)

      if (detalleErrores?.length > 0) {
        console.warn('Errores al generar:', detalleErrores)
      }

      setModalGenerar(false)
      cargarEntrenamientos()
    } catch (err) {
      setError(err.message || 'Error al generar entrenamientos')
    } finally {
      setGenerando(false)
    }
  }

  async function handleCancelar() {
    if (!modalCancelar.entrenamiento) return

    setCancelando(true)
    try {
      await api.post(`/admin/entrenamientos/${modalCancelar.entrenamiento.id}/cancelar`, {
        motivo: motivoCancelacion
      })
      setSuccess('Entrenamiento cancelado')
      setModalCancelar({ visible: false, entrenamiento: null })
      setMotivoCancelacion('')
      cargarEntrenamientos()
    } catch (err) {
      setError(err.message || 'Error al cancelar')
    } finally {
      setCancelando(false)
    }
  }

  async function handleNotificarEntrenamiento(entrenamientoId) {
    setNotificando(true)
    try {
      const response = await api.post(`/admin/entrenamientos/${entrenamientoId}/notificar`)
      setSuccess(response.data?.mensaje || 'Notificaciones enviadas')
      setModalEntrenamiento({ visible: false, entrenamiento: null })
    } catch (err) {
      setError(err.message || 'Error al notificar')
    } finally {
      setNotificando(false)
    }
  }

  async function handleCrearEntrenamiento(e) {
    e.preventDefault()
    setError(null)

    if (!formNuevo.categoriaActividadId || !formNuevo.fecha || !formNuevo.horaInicio || !formNuevo.horaFin) {
      setError('Categoria, fecha y horarios son requeridos')
      return
    }

    setGuardando(true)
    try {
      await api.post('/admin/entrenamientos', {
        categoriaActividadId: parseInt(formNuevo.categoriaActividadId),
        espacioId: formNuevo.espacioId ? parseInt(formNuevo.espacioId) : null,
        fecha: formNuevo.fecha,
        horaInicio: formNuevo.horaInicio,
        horaFin: formNuevo.horaFin,
        observaciones: formNuevo.observaciones || null
      })
      setSuccess('Entrenamiento creado correctamente')
      setModalNuevo(false)
      setFormNuevo({
        categoriaActividadId: '',
        espacioId: '',
        fecha: '',
        horaInicio: '18:00',
        horaFin: '19:30',
        observaciones: ''
      })
      cargarEntrenamientos()
    } catch (err) {
      setError(err.message || 'Error al crear entrenamiento')
    } finally {
      setGuardando(false)
    }
  }

  function getColorCategoria(categoriaActividad) {
    return categoriaActividad?.actividad?.color || '#6B7280'
  }

  function formatFechaHeader() {
    if (vista === 'dia') {
      return fechaActual.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    } else if (vista === 'semana') {
      const { desde, hasta } = getRangoFechas()
      const mesDesde = desde.toLocaleDateString('es-AR', { month: 'short' })
      const mesHasta = hasta.toLocaleDateString('es-AR', { month: 'short' })
      if (mesDesde === mesHasta) {
        return `${desde.getDate()} - ${hasta.getDate()} ${mesDesde} ${desde.getFullYear()}`
      }
      return `${desde.getDate()} ${mesDesde} - ${hasta.getDate()} ${mesHasta} ${desde.getFullYear()}`
    } else {
      return fechaActual.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    }
  }

  const categoriasFiltradas = filtroActividad
    ? categorias.filter(c => c.actividadId === parseInt(filtroActividad))
    : categorias

  const hoy = new Date().toISOString().split('T')[0]

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Calendar className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Entrenamientos</h1>
            <p className="text-gray-500 text-sm">Calendario de entrenamientos por categoria</p>
          </div>
        </div>
        <div className="flex gap-2">
          {tienePermiso(PERMISOS.DEPORTES_ENTRENAMIENTOS) && (
            <Link to="/admin/deportes/horarios">
              <Button variant="secondary">
                <Settings className="w-4 h-4 mr-2" />
                Horarios
              </Button>
            </Link>
          )}
          {tienePermiso(PERMISOS.DEPORTES_ENTRENAMIENTOS) && (
            <Button variant="secondary" onClick={() => {
              const { desde, hasta } = getRangoFechas()
              setFormGenerar({
                categoriaActividadId: filtroCategoria || '',
                fechaDesde: desde.toISOString().split('T')[0],
                fechaHasta: hasta.toISOString().split('T')[0]
              })
              setModalGenerar(true)
            }}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Generar
            </Button>
          )}
          {tienePermiso(PERMISOS.DEPORTES_ENTRENAMIENTOS) && (
            <Button onClick={() => setModalNuevo(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo
            </Button>
          )}
        </div>
      </div>

      {error && <Alert type="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert type="success" className="mb-4" onClose={() => setSuccess(null)}>{success}</Alert>}

      {/* Controles del calendario */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={navegarAnterior}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={irAHoy}
              className="px-3 py-1 text-sm font-medium text-primary hover:bg-primary/10 rounded"
            >
              Hoy
            </button>
            <button
              onClick={navegarSiguiente}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
            <span className="text-lg font-semibold text-gray-800 ml-2 capitalize">
              {formatFechaHeader()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Filtros en linea */}
            <select
              value={filtroActividad}
              onChange={(e) => {
                setFiltroActividad(e.target.value)
                setFiltroCategoria('')
              }}
              className="input-field text-sm py-1.5"
            >
              <option value="">Actividad</option>
              {actividades.map((act) => (
                <option key={act.id} value={act.id}>{act.nombre}</option>
              ))}
            </select>

            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="input-field text-sm py-1.5"
            >
              <option value="">Categoria</option>
              {categoriasFiltradas.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.nombre}</option>
              ))}
            </select>

            <select
              value={filtroEspacio}
              onChange={(e) => setFiltroEspacio(e.target.value)}
              className="input-field text-sm py-1.5"
            >
              <option value="">Espacio</option>
              {espacios.map((esp) => (
                <option key={esp.id} value={esp.id}>{esp.nombre}</option>
              ))}
            </select>

            {/* Switch Vista */}
            <div className="flex bg-gray-100 rounded-lg p-1 ml-2">
              <button
                onClick={() => setVista('dia')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${
                  vista === 'dia'
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Día
              </button>
              <button
                onClick={() => setVista('semana')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${
                  vista === 'semana'
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Semana
              </button>
              <button
                onClick={() => setVista('mes')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${
                  vista === 'mes'
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Mes
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Calendario vista día */}
      {vista === 'dia' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {(() => {
            const fechaStr = fechaActual.toISOString().split('T')[0]
            const entrenamientosDia = entrenamientosPorFecha[fechaStr] || []
            const esHoy = fechaStr === hoy

            return (
              <div className="p-4">
                {/* Header del día */}
                <div className={`text-center pb-4 mb-4 border-b ${esHoy ? 'border-primary/30' : ''}`}>
                  <div className="text-sm text-gray-500 uppercase">
                    {DIAS_SEMANA_FULL[fechaActual.getDay()]}
                  </div>
                  <div className={`text-3xl font-bold ${esHoy ? 'text-primary' : 'text-gray-800'}`}>
                    {fechaActual.getDate()}
                  </div>
                  {esHoy && (
                    <span className="inline-block mt-1 px-2 py-0.5 bg-primary text-white text-xs rounded-full">
                      Hoy
                    </span>
                  )}
                </div>

                {/* Lista de entrenamientos */}
                {entrenamientosDia.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No hay entrenamientos para este día</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {entrenamientosDia
                      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
                      .map((ent) => (
                        <div
                          key={ent.id}
                          onClick={() => setModalEntrenamiento({ visible: true, entrenamiento: ent })}
                          className={`
                            p-4 rounded-lg border-l-4 cursor-pointer transition-all hover:shadow-md
                            ${ent.estado === 'CANCELADO' ? 'bg-gray-50 opacity-60' : 'bg-white border border-gray-200'}
                          `}
                          style={{ borderLeftColor: getColorCategoria(ent.categoriaActividad) }}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-gray-800">
                                  {ent.categoriaActividad?.actividad?.nombre}
                                </span>
                                <span className="text-gray-400">-</span>
                                <span className="text-gray-600">{ent.categoriaActividad?.nombre}</span>
                                {ent.estado === 'CANCELADO' && (
                                  <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">
                                    Cancelado
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-sm text-gray-500">
                                <div className="flex items-center gap-1">
                                  <Clock className="w-4 h-4" />
                                  {ent.horaInicio} - {ent.horaFin}
                                </div>
                                {ent.espacio && (
                                  <div className="flex items-center gap-1">
                                    <MapPin className="w-4 h-4" />
                                    {ent.espacio.nombre}
                                  </div>
                                )}
                                <div className="flex items-center gap-1">
                                  <Users className="w-4 h-4" />
                                  {ent._count?.asistencias || 0} asistencias
                                </div>
                              </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* Calendario vista semana */}
      {vista === 'semana' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-7 border-b">
            {diasSemana.map((dia, idx) => {
              const fechaStr = dia.toISOString().split('T')[0]
              const esHoy = fechaStr === hoy

              return (
                <div
                  key={idx}
                  className={`p-3 text-center border-r last:border-r-0 ${esHoy ? 'bg-primary/5' : ''}`}
                >
                  <div className="text-xs text-gray-500 uppercase">{DIAS_SEMANA[dia.getDay()]}</div>
                  <div className={`text-lg font-semibold ${esHoy ? 'text-primary' : 'text-gray-800'}`}>
                    {dia.getDate()}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-7 min-h-[400px]">
            {diasSemana.map((dia, idx) => {
              const fechaStr = dia.toISOString().split('T')[0]
              const entrenamientosDia = entrenamientosPorFecha[fechaStr] || []
              const esHoy = fechaStr === hoy

              return (
                <div
                  key={idx}
                  className={`border-r last:border-r-0 p-2 ${esHoy ? 'bg-primary/5' : ''}`}
                >
                  {loading ? (
                    <div className="animate-pulse space-y-2">
                      <div className="h-12 bg-gray-200 rounded" />
                      <div className="h-12 bg-gray-200 rounded" />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {entrenamientosDia.map(ent => (
                        <button
                          key={ent.id}
                          onClick={() => setModalEntrenamiento({ visible: true, entrenamiento: ent })}
                          className={`w-full text-left p-2 rounded text-xs hover:opacity-80 transition ${
                            ent.estado === 'CANCELADO' ? 'opacity-50 line-through' : ''
                          }`}
                          style={{
                            backgroundColor: `${getColorCategoria(ent.categoriaActividad)}20`,
                            borderLeft: `3px solid ${getColorCategoria(ent.categoriaActividad)}`
                          }}
                        >
                          <div className="font-medium truncate" style={{ color: getColorCategoria(ent.categoriaActividad) }}>
                            {ent.categoriaActividad?.nombre}
                          </div>
                          <div className="text-gray-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {ent.horaInicio}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Vista mes - simplificada */}
      {vista === 'mes' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="grid grid-cols-7 gap-1">
            {DIAS_SEMANA.map(dia => (
              <div key={dia} className="text-center text-xs font-medium text-gray-500 py-2">
                {dia}
              </div>
            ))}
            {(() => {
              const { desde, hasta } = getRangoFechas()
              const primerDia = new Date(desde)
              primerDia.setDate(1)
              const offsetInicio = primerDia.getDay()
              const dias = []

              // Espacios vacíos antes del primer día
              for (let i = 0; i < offsetInicio; i++) {
                dias.push(<div key={`empty-${i}`} className="h-24" />)
              }

              // Días del mes
              for (let d = new Date(desde); d <= hasta; d.setDate(d.getDate() + 1)) {
                const fechaStr = d.toISOString().split('T')[0]
                const entrenamientosDia = entrenamientosPorFecha[fechaStr] || []
                const esHoy = fechaStr === hoy

                dias.push(
                  <div
                    key={fechaStr}
                    className={`h-24 border rounded p-1 ${esHoy ? 'bg-primary/5 border-primary' : 'border-gray-200'}`}
                  >
                    <div className={`text-sm font-medium mb-1 ${esHoy ? 'text-primary' : 'text-gray-800'}`}>
                      {d.getDate()}
                    </div>
                    <div className="space-y-0.5 overflow-hidden">
                      {entrenamientosDia.slice(0, 3).map(ent => (
                        <button
                          key={ent.id}
                          onClick={() => setModalEntrenamiento({ visible: true, entrenamiento: ent })}
                          className={`w-full text-left px-1 py-0.5 rounded text-xs truncate hover:opacity-80 ${
                            ent.estado === 'CANCELADO' ? 'opacity-50 line-through' : ''
                          }`}
                          style={{ backgroundColor: `${getColorCategoria(ent.categoriaActividad)}30` }}
                        >
                          {ent.horaInicio} {ent.categoriaActividad?.nombre}
                        </button>
                      ))}
                      {entrenamientosDia.length > 3 && (
                        <div className="text-xs text-gray-400 px-1">+{entrenamientosDia.length - 3} mas</div>
                      )}
                    </div>
                  </div>
                )
              }

              return dias
            })()}
          </div>
        </div>
      )}

      {/* Modal detalle entrenamiento */}
      <Modal
        isOpen={modalEntrenamiento.visible}
        onClose={() => setModalEntrenamiento({ visible: false, entrenamiento: null })}
        title="Detalle del Entrenamiento"
      >
        {modalEntrenamiento.entrenamiento && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: getColorCategoria(modalEntrenamiento.entrenamiento.categoriaActividad) }}
              />
              <span className="font-semibold text-lg">
                {modalEntrenamiento.entrenamiento.categoriaActividad?.actividad?.nombre} - {modalEntrenamiento.entrenamiento.categoriaActividad?.nombre}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Fecha:</span>
                <p className="font-medium">
                  {new Date(modalEntrenamiento.entrenamiento.fecha).toLocaleDateString('es-AR', {
                    weekday: 'long', day: 'numeric', month: 'long'
                  })}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Horario:</span>
                <p className="font-medium">
                  {modalEntrenamiento.entrenamiento.horaInicio} - {modalEntrenamiento.entrenamiento.horaFin}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Espacio:</span>
                <p className="font-medium">
                  {modalEntrenamiento.entrenamiento.espacio?.nombre || 'Sin asignar'}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Estado:</span>
                <p className={`font-medium ${
                  modalEntrenamiento.entrenamiento.estado === 'CANCELADO' ? 'text-red-600' : 'text-green-600'
                }`}>
                  {modalEntrenamiento.entrenamiento.estado}
                </p>
              </div>
            </div>

            {modalEntrenamiento.entrenamiento.observaciones && (
              <div className="text-sm">
                <span className="text-gray-500">Observaciones:</span>
                <p>{modalEntrenamiento.entrenamiento.observaciones}</p>
              </div>
            )}

            {modalEntrenamiento.entrenamiento.motivoCancelacion && (
              <div className="text-sm bg-red-50 p-3 rounded">
                <span className="text-red-600 font-medium">Motivo cancelacion:</span>
                <p className="text-red-700">{modalEntrenamiento.entrenamiento.motivoCancelacion}</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              {modalEntrenamiento.entrenamiento.estado !== 'CANCELADO' && tienePermiso(PERMISOS.DEPORTES_ENTRENAMIENTOS) && (
                <Button
                  variant="danger"
                  onClick={() => {
                    setModalCancelar({ visible: true, entrenamiento: modalEntrenamiento.entrenamiento })
                    setModalEntrenamiento({ visible: false, entrenamiento: null })
                  }}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
              )}
              {modalEntrenamiento.entrenamiento.estado !== 'CANCELADO' && tienePermiso(PERMISOS.DEPORTES_ENTRENAMIENTOS) && (
                <Button
                  variant="secondary"
                  onClick={() => handleNotificarEntrenamiento(modalEntrenamiento.entrenamiento.id)}
                  disabled={notificando}
                >
                  <Bell className="w-4 h-4 mr-2" />
                  {notificando ? 'Enviando...' : 'Notificar'}
                </Button>
              )}
              {tienePermiso(PERMISOS.DEPORTES_ENTRENAMIENTOS) && (
                <Link to={`/admin/deportes/asistencia/${modalEntrenamiento.entrenamiento.id}`}>
                  <Button>
                    <Users className="w-4 h-4 mr-2" />
                    Asistencia
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal generar entrenamientos */}
      <Modal
        isOpen={modalGenerar}
        onClose={() => setModalGenerar(false)}
        title="Generar Entrenamientos"
      >
        <form onSubmit={handleGenerar} className="space-y-4">
          <p className="text-sm text-gray-600">
            Genera entrenamientos automaticamente a partir de los horarios recurrentes configurados.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria (opcional)</label>
            <select
              value={formGenerar.categoriaActividadId}
              onChange={(e) => setFormGenerar({ ...formGenerar, categoriaActividadId: e.target.value })}
              className="input-field w-full"
            >
              <option value="">Todas las categorias</option>
              {categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.actividad?.nombre} - {cat.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Desde *</label>
              <input
                type="date"
                value={formGenerar.fechaDesde}
                onChange={(e) => setFormGenerar({ ...formGenerar, fechaDesde: e.target.value })}
                className="input-field w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hasta *</label>
              <input
                type="date"
                value={formGenerar.fechaHasta}
                onChange={(e) => setFormGenerar({ ...formGenerar, fechaHasta: e.target.value })}
                className="input-field w-full"
                required
              />
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Maximo 60 dias. Los entrenamientos existentes no se duplicaran.
          </p>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => setModalGenerar(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={generando}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Generar
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal cancelar */}
      <Modal
        isOpen={modalCancelar.visible}
        onClose={() => setModalCancelar({ visible: false, entrenamiento: null })}
        title="Cancelar Entrenamiento"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            ¿Estas seguro de cancelar este entrenamiento?
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (opcional)</label>
            <input
              type="text"
              value={motivoCancelacion}
              onChange={(e) => setMotivoCancelacion(e.target.value)}
              className="input-field w-full"
              placeholder="Ej: Lluvia, feriado..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="secondary"
              onClick={() => {
                setModalCancelar({ visible: false, entrenamiento: null })
                setMotivoCancelacion('')
              }}
            >
              Volver
            </Button>
            <Button variant="danger" onClick={handleCancelar} loading={cancelando}>
              Cancelar Entrenamiento
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal nuevo entrenamiento */}
      <Modal
        isOpen={modalNuevo}
        onClose={() => setModalNuevo(false)}
        title="Nuevo Entrenamiento"
      >
        <form onSubmit={handleCrearEntrenamiento} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria *</label>
            <select
              value={formNuevo.categoriaActividadId}
              onChange={(e) => setFormNuevo({ ...formNuevo, categoriaActividadId: e.target.value })}
              className="input-field w-full"
              required
            >
              <option value="">Seleccionar categoria...</option>
              {categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.actividad?.nombre} - {cat.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
            <input
              type="date"
              value={formNuevo.fecha}
              onChange={(e) => setFormNuevo({ ...formNuevo, fecha: e.target.value })}
              className="input-field w-full"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora inicio *</label>
              <input
                type="time"
                value={formNuevo.horaInicio}
                onChange={(e) => setFormNuevo({ ...formNuevo, horaInicio: e.target.value })}
                className="input-field w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora fin *</label>
              <input
                type="time"
                value={formNuevo.horaFin}
                onChange={(e) => setFormNuevo({ ...formNuevo, horaFin: e.target.value })}
                className="input-field w-full"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Espacio (opcional)</label>
            <select
              value={formNuevo.espacioId}
              onChange={(e) => setFormNuevo({ ...formNuevo, espacioId: e.target.value })}
              className="input-field w-full"
            >
              <option value="">Sin espacio asignado</option>
              {espacios.map((esp) => (
                <option key={esp.id} value={esp.id}>{esp.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
            <textarea
              value={formNuevo.observaciones}
              onChange={(e) => setFormNuevo({ ...formNuevo, observaciones: e.target.value })}
              className="input-field w-full"
              rows={2}
              placeholder="Opcional..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => setModalNuevo(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={guardando}>
              Crear Entrenamiento
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
