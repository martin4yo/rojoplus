import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Trophy, Plus, X, Pencil, Save, CheckCircle } from 'lucide-react'
import api from '../../../services/api'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { tienePermiso, PERMISOS } from '../../../services/permisos'

const ESTADO_COLOR = { PROGRAMADO: 'text-gray-500', FINALIZADO: 'text-green-600', SUSPENDIDO: 'text-yellow-600', CANCELADO: 'text-red-500' }
const TIPOS = ['LIGA', 'TORNEO', 'COPA', 'AMISTOSO']

export default function CampeonatoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [campeonato, setCampeonato] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [tab, setTab] = useState('tabla') // 'tabla' | 'partidos' | 'asignar'
  const [editando, setEditando] = useState(false)
  const [formEdit, setFormEdit] = useState({})
  const [guardando, setGuardando] = useState(false)

  // Asignar partidos
  const [partidosDisponibles, setPartidosDisponibles] = useState([])
  const [loadingPartidos, setLoadingPartidos] = useState(false)

  useEffect(() => { cargarCampeonato() }, [id])
  useEffect(() => { if (tab === 'asignar') cargarPartidosDisponibles() }, [tab])

  const cargarCampeonato = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/admin/campeonatos/${id}`)
      const data = res.data || res
      setCampeonato(data)
      setFormEdit({
        nombre: data.nombre, tipo: data.tipo, temporada: data.temporada || '',
        estado: data.estado, nombreEquipo: data.nombreEquipo || '',
        fechaInicio: data.fechaInicio ? data.fechaInicio.slice(0, 10) : '',
        fechaFin: data.fechaFin ? data.fechaFin.slice(0, 10) : '',
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const cargarPartidosDisponibles = async () => {
    setLoadingPartidos(true)
    try {
      const params = campeonato?.categoriaActividadId
        ? `?categoriaActividadId=${campeonato.categoriaActividadId}&sinCampeonato=true`
        : '?sinCampeonato=true'
      const res = await api.get(`/admin/partidos${params}`)
      const todos = res.data || res || []
      // Filter out already assigned
      const asignados = new Set(campeonato?.partidos?.map(p => p.id) || [])
      setPartidosDisponibles(todos.filter(p => !asignados.has(p.id)))
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingPartidos(false)
    }
  }

  const handleGuardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    try {
      await api.put(`/admin/campeonatos/${id}`, formEdit)
      setSuccess('Campeonato actualizado')
      setEditando(false)
      cargarCampeonato()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const handleAsignar = async (partidoId) => {
    try {
      await api.post(`/admin/campeonatos/${id}/asignar-partido`, { partidoId })
      cargarCampeonato()
      cargarPartidosDisponibles()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleQuitar = async (partidoId) => {
    try {
      await api.delete(`/admin/campeonatos/${id}/asignar-partido/${partidoId}`)
      cargarCampeonato()
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <LoadingSpinner />
  if (!campeonato) return <div className="p-6 text-center text-gray-500">Campeonato no encontrado</div>

  const { tabla = [], partidos = [] } = campeonato
  const nuestroEquipo = campeonato.nombreEquipo || campeonato.categoria || 'Nuestro Equipo'

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/admin/deportes/campeonatos')} className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <Trophy className="w-6 h-6 text-yellow-500" />
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{campeonato.nombre}</h1>
          <p className="text-sm text-gray-500">
            {campeonato.tipo}{campeonato.categoria ? ` · ${campeonato.actividad} — ${campeonato.categoria}` : ''}{campeonato.temporada ? ` · ${campeonato.temporada}` : ''}
          </p>
        </div>
        {tienePermiso(PERMISOS.DEPORTES_EDITAR) && (
          <button onClick={() => setEditando(!editando)} className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition">
            <Pencil className="w-4 h-4" />
            Editar
          </button>
        )}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>}

      {/* Form editar */}
      {editando && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-5">
          <form onSubmit={handleGuardar} className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input type="text" value={formEdit.nombre} onChange={e => setFormEdit({ ...formEdit, nombre: e.target.value })} className="input-field w-full" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select value={formEdit.tipo} onChange={e => setFormEdit({ ...formEdit, tipo: e.target.value })} className="input-field w-full">
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select value={formEdit.estado} onChange={e => setFormEdit({ ...formEdit, estado: e.target.value })} className="input-field w-full">
                <option value="ACTIVO">Activo</option>
                <option value="FINALIZADO">Finalizado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Temporada</label>
              <input type="text" value={formEdit.temporada} onChange={e => setFormEdit({ ...formEdit, temporada: e.target.value })} className="input-field w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre en tabla</label>
              <input type="text" value={formEdit.nombreEquipo} onChange={e => setFormEdit({ ...formEdit, nombreEquipo: e.target.value })} className="input-field w-full" placeholder={campeonato.categoria || 'Nuestro Equipo'} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha inicio</label>
              <input type="date" value={formEdit.fechaInicio} onChange={e => setFormEdit({ ...formEdit, fechaInicio: e.target.value })} className="input-field w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha fin</label>
              <input type="date" value={formEdit.fechaFin} onChange={e => setFormEdit({ ...formEdit, fechaFin: e.target.value })} className="input-field w-full" />
            </div>
            <div className="col-span-2 flex gap-3">
              <button type="button" onClick={() => setEditando(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition">Cancelar</button>
              <button type="submit" disabled={guardando} className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-primary-dark transition">
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-lg w-fit">
        {[['tabla', 'Tabla'], ['partidos', `Partidos (${partidos.length})`], ['asignar', 'Asignar partidos']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* TABLA DE POSICIONES */}
      {tab === 'tabla' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {tabla.length === 0 ? (
            <div className="p-12 text-center">
              <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No hay partidos finalizados para calcular la tabla</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                    <th className="text-left px-4 py-3 w-8">#</th>
                    <th className="text-left px-4 py-3">Equipo</th>
                    <th className="text-center px-3 py-3">PJ</th>
                    <th className="text-center px-3 py-3">PG</th>
                    <th className="text-center px-3 py-3">PE</th>
                    <th className="text-center px-3 py-3">PP</th>
                    <th className="text-center px-3 py-3">GF</th>
                    <th className="text-center px-3 py-3">GC</th>
                    <th className="text-center px-3 py-3">DG</th>
                    <th className="text-center px-4 py-3 font-bold text-gray-700">PTS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tabla.map((equipo, idx) => (
                    <tr
                      key={equipo.nombre}
                      className={`${equipo.esNuestroEquipo ? 'bg-primary/5 font-semibold' : 'hover:bg-gray-50'}`}
                    >
                      <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {equipo.esNuestroEquipo && <div className="w-2 h-2 bg-primary rounded-full" />}
                          <span className={equipo.esNuestroEquipo ? 'text-primary' : 'text-gray-800'}>{equipo.nombre}</span>
                        </div>
                      </td>
                      <td className="text-center px-3 py-3 text-gray-600">{equipo.PJ}</td>
                      <td className="text-center px-3 py-3 text-green-600">{equipo.PG}</td>
                      <td className="text-center px-3 py-3 text-gray-500">{equipo.PE}</td>
                      <td className="text-center px-3 py-3 text-red-500">{equipo.PP}</td>
                      <td className="text-center px-3 py-3 text-gray-600">{equipo.GF}</td>
                      <td className="text-center px-3 py-3 text-gray-600">{equipo.GC}</td>
                      <td className="text-center px-3 py-3 text-gray-600">{equipo.DG > 0 ? `+${equipo.DG}` : equipo.DG}</td>
                      <td className="text-center px-4 py-3 font-bold text-gray-900 text-base">{equipo.PTS}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-gray-400 px-4 py-2 border-t border-gray-100">
                PJ=Partidos Jugados · PG=Ganados · PE=Empatados · PP=Perdidos · GF=Goles a favor · GC=Goles en contra · DG=Diferencia · PTS=Puntos
              </p>
            </div>
          )}
        </div>
      )}

      {/* PARTIDOS DEL CAMPEONATO */}
      {tab === 'partidos' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {partidos.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-sm">No hay partidos asignados a este campeonato</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {partidos.map(p => {
                const fecha = new Date(p.fecha)
                const fechaStr = fecha.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' })
                const resultado = p.golesLocal !== null ? `${p.golesLocal} - ${p.golesVisitante}` : null

                return (
                  <div key={p.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-800 capitalize">{fechaStr} {p.hora}</p>
                        <p className="text-xs text-gray-500">
                          {p.condicion === 'LOCAL' ? `${nuestroEquipo} vs ${p.rival}` : `${p.rival} vs ${nuestroEquipo}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {resultado && (
                        <span className="font-bold text-gray-800">{resultado}</span>
                      )}
                      <span className={`text-xs font-medium ${ESTADO_COLOR[p.estado] || 'text-gray-500'}`}>{p.estado}</span>
                      {tienePermiso(PERMISOS.DEPORTES_EDITAR) && (
                        <button
                          onClick={() => handleQuitar(p.id)}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                          title="Quitar del campeonato"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ASIGNAR PARTIDOS */}
      {tab === 'asignar' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {loadingPartidos ? (
            <div className="p-8 text-center"><LoadingSpinner /></div>
          ) : partidosDisponibles.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-sm">
              No hay partidos disponibles para asignar a este campeonato
            </div>
          ) : (
            <>
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <p className="text-sm text-gray-600">Seleccioná partidos para incluir en este campeonato</p>
              </div>
              <div className="divide-y divide-gray-100">
                {partidosDisponibles.map(p => {
                  const fecha = new Date(p.fecha)
                  const fechaStr = fecha.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' })
                  return (
                    <div key={p.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-800 capitalize">{fechaStr} {p.hora}</p>
                        <p className="text-xs text-gray-500">
                          {p.condicion === 'LOCAL' ? `Local vs ${p.rival}` : `Visitante vs ${p.rival}`}
                          {p.tipo && ` · ${p.tipo}`}
                        </p>
                      </div>
                      <button
                        onClick={() => handleAsignar(p.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary-dark transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Asignar
                      </button>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
