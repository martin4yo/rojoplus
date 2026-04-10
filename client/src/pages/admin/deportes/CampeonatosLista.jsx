import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trophy, ChevronRight, Calendar } from 'lucide-react'
import api from '../../../services/api'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { tienePermiso, PERMISOS } from '../../../services/permisos'

const TIPOS = ['LIGA', 'TORNEO', 'COPA', 'AMISTOSO']
const TIPO_COLOR = {
  LIGA: 'bg-blue-100 text-blue-700',
  TORNEO: 'bg-purple-100 text-purple-700',
  COPA: 'bg-yellow-100 text-yellow-700',
  AMISTOSO: 'bg-gray-100 text-gray-600',
}

export default function CampeonatosLista() {
  const navigate = useNavigate()
  const [campeonatos, setCampeonatos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filtroEstado, setFiltroEstado] = useState('ACTIVO')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    nombre: '', tipo: 'LIGA', temporada: '', categoriaActividadId: '',
    fechaInicio: '', fechaFin: '', nombreEquipo: '', descripcion: ''
  })
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { cargarDatos() }, [filtroEstado])

  const cargarDatos = async () => {
    setLoading(true)
    try {
      const params = filtroEstado ? `?estado=${filtroEstado}` : ''
      const [campRes, catRes] = await Promise.all([
        api.get(`/admin/campeonatos${params}`),
        api.get('/admin/categorias-actividad?activo=true'),
      ])
      setCampeonatos(campRes.data || campRes || [])
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
      await api.post('/admin/campeonatos', form)
      setShowForm(false)
      setForm({ nombre: '', tipo: 'LIGA', temporada: '', categoriaActividadId: '', fechaInicio: '', fechaFin: '', nombreEquipo: '', descripcion: '' })
      cargarDatos()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Trophy className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Campeonatos</h1>
            <p className="text-sm text-gray-500">Campeonatos y tablas de posiciones</p>
          </div>
        </div>
        {tienePermiso(PERMISOS.DEPORTES_EDITAR) && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Nuevo campeonato
          </button>
        )}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      {/* Filtro estado */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6 flex gap-2">
        {['ACTIVO', 'FINALIZADO', ''].map(e => (
          <button
            key={e}
            onClick={() => setFiltroEstado(e)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${filtroEstado === e ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {e === '' ? 'Todos' : e === 'ACTIVO' ? 'En curso' : 'Finalizados'}
          </button>
        ))}
      </div>

      {/* Modal crear */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Nuevo campeonato</h2>
            <form onSubmit={handleCrear} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className="input-field w-full" required placeholder="Ej: Torneo Clausura 2025" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} className="input-field w-full">
                    {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Temporada</label>
                  <input type="text" value={form.temporada} onChange={e => setForm({ ...form, temporada: e.target.value })} className="input-field w-full" placeholder="2025" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <select value={form.categoriaActividadId} onChange={e => setForm({ ...form, categoriaActividadId: e.target.value })} className="input-field w-full">
                  <option value="">Sin categoría específica</option>
                  {categorias.map(c => (
                    <option key={c.id} value={c.id}>{c.actividad?.nombre || c.actividadNombre} — {c.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de nuestro equipo en la tabla</label>
                <input type="text" value={form.nombreEquipo} onChange={e => setForm({ ...form, nombreEquipo: e.target.value })} className="input-field w-full" placeholder="Ej: Club Sportivo Pilar" />
                <p className="text-xs text-gray-400 mt-1">Así aparecerá en la tabla de posiciones</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha inicio</label>
                  <input type="date" value={form.fechaInicio} onChange={e => setForm({ ...form, fechaInicio: e.target.value })} className="input-field w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha fin</label>
                  <input type="date" value={form.fechaFin} onChange={e => setForm({ ...form, fechaFin: e.target.value })} className="input-field w-full" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition">Cancelar</button>
                <button type="submit" disabled={guardando} className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-primary-dark transition">
                  {guardando ? 'Guardando...' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lista */}
      {campeonatos.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center">
          <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No hay campeonatos</h3>
          <p className="text-gray-500 text-sm">Creá un campeonato para gestionar la tabla de posiciones</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campeonatos.map(c => (
            <button
              key={c.id}
              onClick={() => navigate(`/admin/deportes/campeonatos/${c.id}`)}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 text-left hover:shadow-md hover:border-primary/30 transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TIPO_COLOR[c.tipo] || 'bg-gray-100 text-gray-600'}`}>{c.tipo}</span>
                    {c.estado === 'FINALIZADO' && <span className="text-xs text-gray-400">Finalizado</span>}
                  </div>
                  <h3 className="font-semibold text-gray-900 mt-1.5 truncate">{c.nombre}</h3>
                  {c.categoria && <p className="text-xs text-gray-500">{c.actividad} — {c.categoria}</p>}
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition flex-shrink-0 mt-1" />
              </div>
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{c.partidos} partidos</span>
                </div>
                {c.temporada && <span className="text-xs text-gray-400">Temporada {c.temporada}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
