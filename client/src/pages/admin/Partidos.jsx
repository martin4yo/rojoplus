import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar, Plus, Search, Filter, MapPin, Clock, Users, Trophy,
  ChevronRight, Edit, Trash2, Check, X, AlertTriangle, Send,
  Home, Plane, Target, BarChart3
} from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { tienePermiso, PERMISOS } from '../../services/permisos'

const TIPOS_PARTIDO = [
  { value: 'LIGA', label: 'Liga' },
  { value: 'AMISTOSO', label: 'Amistoso' },
  { value: 'TORNEO', label: 'Torneo' },
  { value: 'COPA', label: 'Copa' },
]

const ESTADOS_PARTIDO = [
  { value: 'PROGRAMADO', label: 'Programado', color: 'bg-blue-100 text-blue-700' },
  { value: 'FINALIZADO', label: 'Finalizado', color: 'bg-green-100 text-green-700' },
  { value: 'SUSPENDIDO', label: 'Suspendido', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'CANCELADO', label: 'Cancelado', color: 'bg-red-100 text-red-700' },
]

export default function Partidos() {
  const [partidos, setPartidos] = useState([])
  const [actividades, setActividades] = useState([])
  const [categorias, setCategorias] = useState([])
  const [espacios, setEspacios] = useState([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [filtroActividad, setFiltroActividad] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroCondicion, setFiltroCondicion] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({
    categoriaActividadId: '',
    fecha: '',
    hora: '',
    tipo: 'LIGA',
    condicion: 'LOCAL',
    rival: '',
    ubicacion: '',
    espacioId: '',
    observaciones: ''
  })

  useEffect(() => {
    Promise.all([
      fetchPartidos(),
      fetchActividades(),
      fetchEspacios()
    ])
  }, [filtroActividad, filtroCategoria, filtroEstado, filtroCondicion, fechaDesde, fechaHasta])

  const fetchPartidos = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filtroCategoria) params.append('categoriaActividadId', filtroCategoria)
      else if (filtroActividad) params.append('actividadId', filtroActividad)
      if (filtroEstado) params.append('estado', filtroEstado)
      if (filtroCondicion) params.append('condicion', filtroCondicion)
      if (fechaDesde) params.append('fechaDesde', fechaDesde)
      if (fechaHasta) params.append('fechaHasta', fechaHasta)

      const data = await api.get(`/admin/deportes/partidos?${params}`)
      setPartidos(data || [])
    } catch (err) {
      console.error('Error cargando partidos:', err)
      toast.error('Error al cargar partidos')
    } finally {
      setLoading(false)
    }
  }

  const fetchActividades = async () => {
    try {
      const data = await api.get('/admin/actividades?activo=true')
      setActividades(data || [])
    } catch (err) {
      console.error('Error cargando actividades:', err)
    }
  }

  const fetchCategorias = async (actividadId) => {
    if (!actividadId) {
      setCategorias([])
      return
    }
    try {
      const data = await api.get(`/admin/actividades/${actividadId}`)
      setCategorias(data?.categorias || [])
    } catch (err) {
      console.error('Error cargando categorías:', err)
    }
  }

  const fetchEspacios = async () => {
    try {
      const data = await api.get('/admin/deportes/espacios-deportivos?activo=true')
      setEspacios(data || [])
    } catch (err) {
      console.error('Error cargando espacios:', err)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editando) {
        await api.put(`/admin/deportes/partidos/${editando.id}`, form)
        toast.success('Partido actualizado')
      } else {
        await api.post('/admin/deportes/partidos', form)
        toast.success('Partido creado')
      }
      setShowModal(false)
      resetForm()
      fetchPartidos()
    } catch (err) {
      toast.error(err.message || 'Error al guardar partido')
    }
  }

  const handleEdit = (partido) => {
    setEditando(partido)
    // Cargar categorías de la actividad
    if (partido.categoriaActividad?.actividadId) {
      fetchCategorias(partido.categoriaActividad.actividadId)
    }
    setForm({
      categoriaActividadId: partido.categoriaActividadId,
      fecha: partido.fecha?.split('T')[0] || '',
      hora: partido.hora,
      tipo: partido.tipo,
      condicion: partido.condicion,
      rival: partido.rival,
      ubicacion: partido.ubicacion || '',
      espacioId: partido.espacioId || '',
      observaciones: partido.observaciones || ''
    })
    setShowModal(true)
  }

  const handleDelete = async (partido) => {
    if (!confirm(`¿Eliminar partido vs ${partido.rival}?`)) return
    try {
      await api.delete(`/admin/deportes/partidos/${partido.id}`)
      toast.success('Partido eliminado')
      fetchPartidos()
    } catch (err) {
      toast.error(err.message || 'Error al eliminar')
    }
  }

  const handleCancelar = async (partido) => {
    const motivo = prompt('Motivo de cancelación:')
    if (motivo === null) return
    try {
      await api.post(`/admin/deportes/partidos/${partido.id}/cancelar`, { motivo })
      toast.success('Partido cancelado')
      fetchPartidos()
    } catch (err) {
      toast.error(err.message || 'Error al cancelar')
    }
  }

  const handleSuspender = async (partido) => {
    const motivo = prompt('Motivo de suspensión:')
    if (motivo === null) return
    try {
      await api.post(`/admin/deportes/partidos/${partido.id}/suspender`, { motivo })
      toast.success('Partido suspendido')
      fetchPartidos()
    } catch (err) {
      toast.error(err.message || 'Error al suspender')
    }
  }

  const resetForm = () => {
    setEditando(null)
    setForm({
      categoriaActividadId: '',
      fecha: '',
      hora: '',
      tipo: 'LIGA',
      condicion: 'LOCAL',
      rival: '',
      ubicacion: '',
      espacioId: '',
      observaciones: ''
    })
    setCategorias([])
  }

  const formatFecha = (fecha) => {
    return new Date(fecha).toLocaleDateString('es-AR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    })
  }

  const getEstadoColor = (estado) => {
    return ESTADOS_PARTIDO.find(e => e.value === estado)?.color || 'bg-gray-100 text-gray-700'
  }

  const getResultado = (partido) => {
    if (partido.golesLocal === null || partido.golesVisitante === null) return null
    if (partido.condicion === 'LOCAL') {
      return `${partido.golesLocal} - ${partido.golesVisitante}`
    }
    return `${partido.golesVisitante} - ${partido.golesLocal}`
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Partidos</h1>
          <p className="text-gray-600">Gestión de partidos y eventos deportivos</p>
        </div>
        {tienePermiso(PERMISOS.DEPORTES_PARTIDOS) && (
          <button
            onClick={() => { resetForm(); setShowModal(true) }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Nuevo Partido
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Actividad</label>
            <select
              value={filtroActividad}
              onChange={(e) => {
                setFiltroActividad(e.target.value)
                setFiltroCategoria('')
                if (e.target.value) fetchCategorias(e.target.value)
                else setCategorias([])
              }}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
            >
              <option value="">Todas</option>
              {actividades.map(a => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
              disabled={!filtroActividad}
            >
              <option value="">Todas</option>
              {categorias.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
            >
              <option value="">Todos</option>
              {ESTADOS_PARTIDO.map(e => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Condición</label>
            <select
              value={filtroCondicion}
              onChange={(e) => setFiltroCondicion(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
            >
              <option value="">Todas</option>
              <option value="LOCAL">Local</option>
              <option value="VISITANTE">Visitante</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>
      </div>

      {/* Lista de partidos */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full mx-auto"></div>
          </div>
        ) : partidos.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No hay partidos para mostrar
          </div>
        ) : (
          <div className="divide-y">
            {partidos.map(partido => {
              const resultado = getResultado(partido)
              return (
                <div key={partido.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      {/* Categoría y tipo */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-red-600">
                          {partido.categoriaActividad?.actividad?.nombre} - {partido.categoriaActividad?.nombre}
                        </span>
                        <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                          {partido.tipo}
                        </span>
                        <span className={`px-2 py-0.5 text-xs rounded ${getEstadoColor(partido.estado)}`}>
                          {partido.estado}
                        </span>
                      </div>

                      {/* Rival y resultado */}
                      <div className="flex items-center gap-3 mb-2">
                        {partido.condicion === 'LOCAL' ? (
                          <Home className="w-5 h-5 text-green-600" />
                        ) : (
                          <Plane className="w-5 h-5 text-blue-600" />
                        )}
                        <span className="text-lg font-semibold text-gray-900">
                          vs {partido.rival}
                        </span>
                        {resultado && (
                          <span className="px-3 py-1 bg-gray-900 text-white font-bold rounded">
                            {resultado}
                          </span>
                        )}
                      </div>

                      {/* Fecha, hora y lugar */}
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatFecha(partido.fecha)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {partido.hora}hs
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {partido.condicion === 'LOCAL'
                            ? (partido.espacio?.nombre || 'La Caldera')
                            : (partido.ubicacion || 'A confirmar')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {partido._count?.convocados || 0} convocados
                        </span>
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/admin/partidos/${partido.id}`}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Ver detalle"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </Link>
                      {partido.estado === 'PROGRAMADO' && tienePermiso(PERMISOS.DEPORTES_PARTIDOS) && (
                        <>
                          <button
                            onClick={() => handleEdit(partido)}
                            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleSuspender(partido)}
                            className="p-2 text-gray-600 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                            title="Suspender"
                          >
                            <AlertTriangle className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleCancelar(partido)}
                            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Cancelar"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </>
                      )}
                      {tienePermiso(PERMISOS.DEPORTES_PARTIDOS) && (
                        <button
                          onClick={() => handleDelete(partido)}
                          className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal Nuevo/Editar Partido */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">
                {editando ? 'Editar Partido' : 'Nuevo Partido'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Actividad y Categoría */}
              {!editando && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Actividad *
                    </label>
                    <select
                      required
                      onChange={(e) => {
                        setForm({ ...form, categoriaActividadId: '' })
                        fetchCategorias(e.target.value)
                      }}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                    >
                      <option value="">Seleccionar...</option>
                      {actividades.map(a => (
                        <option key={a.id} value={a.id}>{a.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Categoría *
                    </label>
                    <select
                      required
                      value={form.categoriaActividadId}
                      onChange={(e) => setForm({ ...form, categoriaActividadId: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                    >
                      <option value="">Seleccionar...</option>
                      {categorias.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Fecha y Hora */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.fecha}
                    onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hora *
                  </label>
                  <input
                    type="time"
                    required
                    value={form.hora}
                    onChange={(e) => setForm({ ...form, hora: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              {/* Tipo y Condición */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo
                  </label>
                  <select
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                  >
                    {TIPOS_PARTIDO.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Condición *
                  </label>
                  <select
                    required
                    value={form.condicion}
                    onChange={(e) => setForm({ ...form, condicion: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                  >
                    <option value="LOCAL">Local</option>
                    <option value="VISITANTE">Visitante</option>
                  </select>
                </div>
              </div>

              {/* Rival */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rival *
                </label>
                <input
                  type="text"
                  required
                  value={form.rival}
                  onChange={(e) => setForm({ ...form, rival: e.target.value })}
                  placeholder="Nombre del equipo rival"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>

              {/* Ubicación / Espacio */}
              {form.condicion === 'LOCAL' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Espacio
                  </label>
                  <select
                    value={form.espacioId}
                    onChange={(e) => setForm({ ...form, espacioId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                  >
                    <option value="">Seleccionar...</option>
                    {espacios.map(e => (
                      <option key={e.id} value={e.id}>{e.nombre}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ubicación
                  </label>
                  <input
                    type="text"
                    value={form.ubicacion}
                    onChange={(e) => setForm({ ...form, ubicacion: e.target.value })}
                    placeholder="Dirección del partido"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>
              )}

              {/* Observaciones */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observaciones
                </label>
                <textarea
                  value={form.observaciones}
                  onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm() }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  {editando ? 'Guardar cambios' : 'Crear partido'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
