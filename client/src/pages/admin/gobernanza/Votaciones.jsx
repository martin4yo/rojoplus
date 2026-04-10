import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Vote, Plus, ChevronRight, CheckCircle, Clock, Lock } from 'lucide-react'
import api from '../../../services/api'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { tienePermiso, PERMISOS } from '../../../services/permisos'

const ESTADO_INFO = {
  BORRADOR: { label: 'Borrador', color: 'bg-gray-100 text-gray-600', icon: Clock },
  ABIERTA: { label: 'Abierta', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  CERRADA: { label: 'Cerrada', color: 'bg-red-100 text-red-600', icon: Lock },
}

export default function Votaciones() {
  const navigate = useNavigate()
  const [votaciones, setVotaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ titulo: '', descripcion: '', tipo: 'SIMPLE', opciones: ['', ''], fechaInicio: '', fechaCierre: '', soloHabilitados: true })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { cargar() }, [filtroEstado])

  const cargar = async () => {
    setLoading(true)
    try {
      const params = filtroEstado ? `?estado=${filtroEstado}` : ''
      const data = await api.get(`/admin/gobernanza/votaciones${params}`)
      setVotaciones(data.data || data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCrear = async () => {
    const opcionesValidas = form.opciones.filter(o => o.trim())
    if (!form.titulo) return setError('El título es requerido')
    if (opcionesValidas.length < 2) return setError('Se necesitan al menos 2 opciones')
    setGuardando(true)
    setError(null)
    try {
      await api.post('/admin/gobernanza/votaciones', { ...form, opciones: opcionesValidas })
      await cargar()
      setShowForm(false)
      setForm({ titulo: '', descripcion: '', tipo: 'SIMPLE', opciones: ['', ''], fechaInicio: '', fechaCierre: '', soloHabilitados: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const addOpcion = () => setForm(f => ({ ...f, opciones: [...f.opciones, ''] }))
  const setOpcion = (i, v) => setForm(f => ({ ...f, opciones: f.opciones.map((o, idx) => idx === i ? v : o) }))
  const removeOpcion = (i) => setForm(f => ({ ...f, opciones: f.opciones.filter((_, idx) => idx !== i) }))

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Vote className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Votaciones</h1>
            <p className="text-sm text-gray-500">Gestión de votaciones y padrón</p>
          </div>
        </div>
        {tienePermiso(PERMISOS.CONFIG_EDITAR) && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition"
          >
            <Plus className="w-4 h-4" />
            Nueva votación
          </button>
        )}
      </div>

      {/* Filtro estado */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6 flex gap-2">
        {['', 'ABIERTA', 'CERRADA', 'BORRADOR'].map(e => (
          <button
            key={e}
            onClick={() => setFiltroEstado(e)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${filtroEstado === e ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {e || 'Todas'}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      {/* Form nueva votación */}
      {showForm && (
        <div className="bg-white rounded-xl border border-blue-200 p-5 mb-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Nueva votación</h2>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Título *</label>
            <input type="text" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} className="input-field w-full" placeholder="Ej: Elección de autoridades 2026" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Descripción</label>
            <textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} className="input-field w-full h-16 resize-none" placeholder="Información adicional sobre la votación..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo</label>
              <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} className="input-field w-full">
                <option value="SIMPLE">Opción única</option>
                <option value="MULTIPLE">Múltiple</option>
              </select>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={form.soloHabilitados} onChange={e => setForm(f => ({ ...f, soloHabilitados: e.target.checked }))} className="rounded border-gray-300 text-primary" />
                Solo socios activos
              </label>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha inicio</label>
              <input type="datetime-local" value={form.fechaInicio} onChange={e => setForm(f => ({ ...f, fechaInicio: e.target.value }))} className="input-field w-full" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha cierre</label>
              <input type="datetime-local" value={form.fechaCierre} onChange={e => setForm(f => ({ ...f, fechaCierre: e.target.value }))} className="input-field w-full" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Opciones *</label>
            <div className="space-y-2">
              {form.opciones.map((op, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={op}
                    onChange={e => setOpcion(i, e.target.value)}
                    className="input-field flex-1"
                    placeholder={`Opción ${i + 1}`}
                  />
                  {form.opciones.length > 2 && (
                    <button onClick={() => removeOpcion(i)} className="text-gray-400 hover:text-red-500 p-1">✕</button>
                  )}
                </div>
              ))}
              <button onClick={addOpcion} className="text-sm text-primary hover:underline">+ Agregar opción</button>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
            <button onClick={handleCrear} disabled={guardando} className="px-4 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50">
              {guardando ? 'Creando...' : 'Crear votación'}
            </button>
          </div>
        </div>
      )}

      {loading ? <LoadingSpinner /> : (
        votaciones.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
            No hay votaciones
          </div>
        ) : (
          <div className="space-y-3">
            {votaciones.map(v => {
              const info = ESTADO_INFO[v.estado] || ESTADO_INFO.BORRADOR
              const Icon = info.icon
              return (
                <div
                  key={v.id}
                  onClick={() => navigate(`/admin/gobernanza/votaciones/${v.id}`)}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm cursor-pointer transition flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${info.color}`}>
                        <Icon className="w-3 h-3 inline mr-1" />{info.label}
                      </span>
                    </div>
                    <p className="font-semibold text-gray-800">{v.titulo}</p>
                    {v.descripcion && <p className="text-sm text-gray-500 truncate">{v.descripcion}</p>}
                    <p className="text-xs text-gray-400 mt-1">{v._count?.votos || 0} votos registrados</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
