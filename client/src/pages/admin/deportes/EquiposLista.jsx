import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Users, Shield, ChevronRight, ToggleLeft, ToggleRight } from 'lucide-react'
import api from '../../../services/api'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { tienePermiso, PERMISOS } from '../../../services/permisos'

const POSICIONES = ['PORTERO', 'DEFENSA', 'LATERAL', 'MEDIOCAMPISTA', 'VOLANTE', 'EXTREMO', 'DELANTERO']

export default function EquiposLista() {
  const navigate = useNavigate()
  const [equipos, setEquipos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [soloActivos, setSoloActivos] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ categoriaActividadId: '', nombre: '', temporada: '', color: '#DC2626', observaciones: '' })
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    cargarDatos()
  }, [filtroCategoria, soloActivos])

  const cargarDatos = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filtroCategoria) params.set('categoriaActividadId', filtroCategoria)
      if (soloActivos) params.set('activo', 'true')

      const [equiposRes, catRes] = await Promise.all([
        api.get(`/admin/equipos?${params}`),
        api.get('/admin/categorias-actividad?activo=true'),
      ])
      setEquipos(equiposRes.data || equiposRes || [])
      setCategorias(catRes.data || catRes || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCrear = async (e) => {
    e.preventDefault()
    setGuardando(true)
    try {
      await api.post('/admin/equipos', form)
      setShowForm(false)
      setForm({ categoriaActividadId: '', nombre: '', temporada: '', color: '#DC2626', observaciones: '' })
      cargarDatos()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Equipos</h1>
          <p className="text-sm text-gray-500 mt-1">Planteles permanentes por categoría</p>
        </div>
        {tienePermiso(PERMISOS.DEPORTES_EDITAR) && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Nuevo equipo
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <select
          value={filtroCategoria}
          onChange={e => setFiltroCategoria(e.target.value)}
          className="input-field w-auto min-w-[200px] text-sm"
        >
          <option value="">Todas las categorías</option>
          {categorias.map(c => (
            <option key={c.id} value={c.id}>
              {c.actividad?.nombre || c.actividadNombre} — {c.nombre}
            </option>
          ))}
        </select>
        <button
          onClick={() => setSoloActivos(!soloActivos)}
          className="flex items-center gap-2 text-sm text-gray-600"
        >
          {soloActivos ? <ToggleRight className="w-5 h-5 text-primary" /> : <ToggleLeft className="w-5 h-5 text-gray-400" />}
          Solo activos
        </button>
      </div>

      {/* Modal nuevo equipo */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Nuevo equipo</h2>
            <form onSubmit={handleCrear} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría *</label>
                <select
                  value={form.categoriaActividadId}
                  onChange={e => setForm({ ...form, categoriaActividadId: e.target.value })}
                  className="input-field w-full"
                  required
                >
                  <option value="">Seleccionar...</option>
                  {categorias.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.actividad?.nombre || c.actividadNombre} — {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del equipo *</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={e => setForm({ ...form, nombre: e.target.value })}
                  className="input-field w-full"
                  placeholder="Ej: Primera División"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Temporada</label>
                  <input
                    type="text"
                    value={form.temporada}
                    onChange={e => setForm({ ...form, temporada: e.target.value })}
                    className="input-field w-full"
                    placeholder="2025"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.color}
                      onChange={e => setForm({ ...form, color: e.target.value })}
                      className="w-10 h-9 rounded cursor-pointer border border-gray-300"
                    />
                    <span className="text-sm text-gray-500">{form.color}</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                <textarea
                  value={form.observaciones}
                  onChange={e => setForm({ ...form, observaciones: e.target.value })}
                  className="input-field w-full h-20 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition text-sm">
                  Cancelar
                </button>
                <button type="submit" disabled={guardando} className="flex-1 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition text-sm font-medium disabled:opacity-50">
                  {guardando ? 'Guardando...' : 'Crear equipo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lista */}
      {equipos.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center">
          <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No hay equipos creados</h3>
          <p className="text-gray-500 text-sm">Creá el primer equipo para empezar a gestionar el plantel</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {equipos.map(eq => (
            <button
              key={eq.id}
              onClick={() => navigate(`/admin/deportes/equipos/${eq.id}`)}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 text-left hover:shadow-md hover:border-primary/30 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ backgroundColor: eq.color || '#DC2626' }}
                  >
                    {eq.nombre.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{eq.nombre}</h3>
                    <p className="text-xs text-gray-500">{eq.actividad} — {eq.categoria}</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition" />
              </div>
              <div className="flex items-center gap-4 mt-4">
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <Users className="w-4 h-4" />
                  <span>{eq.jugadores} jugadores</span>
                </div>
                {eq.temporada && (
                  <span className="text-xs text-gray-400">Temporada {eq.temporada}</span>
                )}
                {!eq.activo && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">Inactivo</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
