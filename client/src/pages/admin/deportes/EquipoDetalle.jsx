import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Pencil, Trash2, Star, User, Save, X } from 'lucide-react'
import api from '../../../services/api'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { tienePermiso, PERMISOS } from '../../../services/permisos'

const POSICIONES = ['PORTERO', 'DEFENSA', 'LATERAL', 'MEDIOCAMPISTA', 'VOLANTE', 'EXTREMO', 'DELANTERO']

const POSICION_COLOR = {
  PORTERO: 'bg-yellow-100 text-yellow-800',
  DEFENSA: 'bg-blue-100 text-blue-800',
  LATERAL: 'bg-blue-100 text-blue-800',
  MEDIOCAMPISTA: 'bg-green-100 text-green-800',
  VOLANTE: 'bg-green-100 text-green-800',
  EXTREMO: 'bg-purple-100 text-purple-800',
  DELANTERO: 'bg-red-100 text-red-800',
}

export default function EquipoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [equipo, setEquipo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Form editar equipo
  const [editando, setEditando] = useState(false)
  const [formEquipo, setFormEquipo] = useState({})
  const [guardandoEquipo, setGuardandoEquipo] = useState(false)

  // Form agregar jugador
  const [showAgregar, setShowAgregar] = useState(false)
  const [socios, setSocios] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [sociosFiltrados, setSociosFiltrados] = useState([])
  const [formJugador, setFormJugador] = useState({ socioId: '', posicion: '', dorsal: '', esTitular: false, observaciones: '' })
  const [socioSeleccionado, setSocioSeleccionado] = useState(null)
  const [guardandoJugador, setGuardandoJugador] = useState(false)

  // Editar jugador inline
  const [editandoJugador, setEditandoJugador] = useState(null)
  const [formEditJugador, setFormEditJugador] = useState({})

  useEffect(() => {
    cargarEquipo()
  }, [id])

  useEffect(() => {
    if (showAgregar && socios.length === 0) cargarSocios()
  }, [showAgregar])

  useEffect(() => {
    if (!busqueda.trim()) {
      setSociosFiltrados([])
      return
    }
    const q = busqueda.toLowerCase()
    setSociosFiltrados(
      socios
        .filter(s => s.apellidoNombre.toLowerCase().includes(q) || String(s.nroSocio).includes(q))
        .slice(0, 8)
    )
  }, [busqueda, socios])

  const cargarEquipo = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/admin/equipos/${id}`)
      const data = res.data || res
      setEquipo(data)
      setFormEquipo({
        nombre: data.nombre,
        temporada: data.temporada || '',
        color: data.color || '#DC2626',
        activo: data.activo,
        observaciones: data.observaciones || '',
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const cargarSocios = async () => {
    try {
      const res = await api.get('/admin/socios?estado=ACTIVO&limit=500')
      setSocios(res.data || res || [])
    } catch (err) {
      console.error('Error cargando socios:', err)
    }
  }

  const handleGuardarEquipo = async (e) => {
    e.preventDefault()
    setGuardandoEquipo(true)
    setError(null)
    try {
      await api.put(`/admin/equipos/${id}`, formEquipo)
      setSuccess('Equipo actualizado')
      setEditando(false)
      cargarEquipo()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardandoEquipo(false)
    }
  }

  const handleAgregarJugador = async (e) => {
    e.preventDefault()
    if (!formJugador.socioId) return
    setGuardandoJugador(true)
    setError(null)
    try {
      await api.post(`/admin/equipos/${id}/plantel`, formJugador)
      setShowAgregar(false)
      setFormJugador({ socioId: '', posicion: '', dorsal: '', esTitular: false, observaciones: '' })
      setSocioSeleccionado(null)
      setBusqueda('')
      cargarEquipo()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardandoJugador(false)
    }
  }

  const handleGuardarEditJugador = async (plantelId) => {
    try {
      await api.put(`/admin/equipos/${id}/plantel/${plantelId}`, formEditJugador)
      setEditandoJugador(null)
      cargarEquipo()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleQuitarJugador = async (plantelId, nombre) => {
    if (!confirm(`¿Quitar a ${nombre} del plantel?`)) return
    try {
      await api.delete(`/admin/equipos/${id}/plantel/${plantelId}`)
      cargarEquipo()
    } catch (err) {
      setError(err.message)
    }
  }

  const seleccionarSocio = (socio) => {
    setSocioSeleccionado(socio)
    setFormJugador({ ...formJugador, socioId: String(socio.id) })
    setBusqueda(socio.apellidoNombre)
    setSociosFiltrados([])
  }

  if (loading) return <LoadingSpinner />
  if (!equipo) return <div className="p-6 text-center text-gray-500">Equipo no encontrado</div>

  const plantelPorPosicion = {}
  equipo.plantel?.forEach(p => {
    const pos = p.posicion || 'SIN POSICIÓN'
    if (!plantelPorPosicion[pos]) plantelPorPosicion[pos] = []
    plantelPorPosicion[pos].push(p)
  })

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/admin/deportes/equipos')} className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
          style={{ backgroundColor: equipo.color || '#DC2626' }}
        >
          {equipo.nombre.charAt(0)}
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{equipo.nombre}</h1>
          <p className="text-sm text-gray-500">{equipo.actividad} — {equipo.categoria}{equipo.temporada ? ` · Temporada ${equipo.temporada}` : ''}</p>
        </div>
        {tienePermiso(PERMISOS.DEPORTES_EDITAR) && (
          <button
            onClick={() => setEditando(!editando)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition"
          >
            <Pencil className="w-4 h-4" />
            Editar
          </button>
        )}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>}

      {/* Form editar equipo */}
      {editando && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-5">
          <h2 className="font-semibold text-gray-800 mb-4">Editar equipo</h2>
          <form onSubmit={handleGuardarEquipo} className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input type="text" value={formEquipo.nombre} onChange={e => setFormEquipo({ ...formEquipo, nombre: e.target.value })} className="input-field w-full" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Temporada</label>
              <input type="text" value={formEquipo.temporada} onChange={e => setFormEquipo({ ...formEquipo, temporada: e.target.value })} className="input-field w-full" placeholder="2025" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={formEquipo.color} onChange={e => setFormEquipo({ ...formEquipo, color: e.target.value })} className="w-10 h-9 rounded cursor-pointer border border-gray-300" />
                <span className="text-sm text-gray-500">{formEquipo.color}</span>
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
              <textarea value={formEquipo.observaciones} onChange={e => setFormEquipo({ ...formEquipo, observaciones: e.target.value })} className="input-field w-full h-16 resize-none" />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="activoEquipo" checked={formEquipo.activo} onChange={e => setFormEquipo({ ...formEquipo, activo: e.target.checked })} className="w-4 h-4" />
              <label htmlFor="activoEquipo" className="text-sm text-gray-700">Equipo activo</label>
            </div>
            <div className="col-span-2 flex gap-3">
              <button type="button" onClick={() => setEditando(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition">Cancelar</button>
              <button type="submit" disabled={guardandoEquipo} className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition disabled:opacity-50">
                {guardandoEquipo ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Plantel */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Plantel</h2>
            <p className="text-sm text-gray-500">{equipo.plantel?.length || 0} jugadores</p>
          </div>
          {tienePermiso(PERMISOS.DEPORTES_EDITAR) && (
            <button
              onClick={() => setShowAgregar(true)}
              className="flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition"
            >
              <Plus className="w-4 h-4" />
              Agregar jugador
            </button>
          )}
        </div>

        {/* Modal agregar jugador */}
        {showAgregar && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Agregar jugador</h2>
              <form onSubmit={handleAgregarJugador} className="space-y-4">
                {/* Buscador de socio */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Socio *</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={busqueda}
                      onChange={e => { setBusqueda(e.target.value); if (socioSeleccionado) { setSocioSeleccionado(null); setFormJugador({ ...formJugador, socioId: '' }) } }}
                      className="input-field w-full"
                      placeholder="Buscar por nombre o número..."
                    />
                    {sociosFiltrados.length > 0 && (
                      <div className="absolute z-10 top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                        {sociosFiltrados.map(s => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => seleccionarSocio(s)}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                          >
                            <span className="font-medium">{s.apellidoNombre}</span>
                            <span className="text-gray-400 ml-2">#{s.nroSocio}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {socioSeleccionado && (
                    <p className="text-xs text-green-600 mt-1">Seleccionado: {socioSeleccionado.apellidoNombre} #{socioSeleccionado.nroSocio}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Posición</label>
                    <select value={formJugador.posicion} onChange={e => setFormJugador({ ...formJugador, posicion: e.target.value })} className="input-field w-full">
                      <option value="">Sin posición</option>
                      {POSICIONES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dorsal</label>
                    <input type="number" value={formJugador.dorsal} onChange={e => setFormJugador({ ...formJugador, dorsal: e.target.value })} className="input-field w-full" min="1" max="99" placeholder="N°" />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input type="checkbox" id="esTitularNew" checked={formJugador.esTitular} onChange={e => setFormJugador({ ...formJugador, esTitular: e.target.checked })} className="w-4 h-4" />
                  <label htmlFor="esTitularNew" className="text-sm text-gray-700">Titular</label>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setShowAgregar(false); setBusqueda(''); setSocioSeleccionado(null) }} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition">
                    Cancelar
                  </button>
                  <button type="submit" disabled={guardandoJugador || !formJugador.socioId} className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-primary-dark transition">
                    {guardandoJugador ? 'Guardando...' : 'Agregar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Lista por posición */}
        {!equipo.plantel || equipo.plantel.length === 0 ? (
          <div className="p-12 text-center">
            <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">El plantel está vacío. Agregá jugadores para empezar.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {Object.entries(plantelPorPosicion).map(([posicion, jugadores]) => (
              <div key={posicion}>
                <div className="px-5 py-2 bg-gray-50">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${POSICION_COLOR[posicion] || 'bg-gray-100 text-gray-600'}`}>
                    {posicion}
                  </span>
                </div>
                {jugadores.map(j => (
                  <div key={j.id} className="px-5 py-3 flex items-center gap-4">
                    {/* Dorsal */}
                    <div className="w-8 text-center text-lg font-bold text-gray-400">
                      {j.dorsal || '—'}
                    </div>

                    {/* Nombre */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 truncate">{j.socio.apellidoNombre}</span>
                        {j.esTitular && <Star className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" fill="currentColor" />}
                      </div>
                      <span className="text-xs text-gray-400">#{j.socio.nroSocio}</span>
                    </div>

                    {/* Acciones / form inline */}
                    {editandoJugador === j.id ? (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <select value={formEditJugador.posicion || ''} onChange={e => setFormEditJugador({ ...formEditJugador, posicion: e.target.value })} className="input-field text-xs py-1 w-32">
                          <option value="">Sin pos.</option>
                          {POSICIONES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <input type="number" value={formEditJugador.dorsal || ''} onChange={e => setFormEditJugador({ ...formEditJugador, dorsal: e.target.value })} className="input-field text-xs py-1 w-14" min="1" max="99" placeholder="N°" />
                        <input type="checkbox" checked={!!formEditJugador.esTitular} onChange={e => setFormEditJugador({ ...formEditJugador, esTitular: e.target.checked })} title="Titular" />
                        <button onClick={() => handleGuardarEditJugador(j.id)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Save className="w-4 h-4" /></button>
                        <button onClick={() => setEditandoJugador(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {tienePermiso(PERMISOS.DEPORTES_EDITAR) && (
                          <>
                            <button
                              onClick={() => { setEditandoJugador(j.id); setFormEditJugador({ posicion: j.posicion || '', dorsal: j.dorsal || '', esTitular: j.esTitular }) }}
                              className="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 rounded transition"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleQuitarJugador(j.id, j.socio.apellidoNombre)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
