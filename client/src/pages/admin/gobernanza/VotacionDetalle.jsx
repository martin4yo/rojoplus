import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Vote, Trash2, Save, CheckCircle, Search } from 'lucide-react'
import api from '../../../services/api'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { tienePermiso, PERMISOS } from '../../../services/permisos'

export default function VotacionDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [votacion, setVotacion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [tab, setTab] = useState('resultados')

  // Padrón / registro de voto
  const [buscarSocio, setBuscarSocio] = useState('')
  const [padron, setPadron] = useState([])
  const [loadingPadron, setLoadingPadron] = useState(false)
  const [votandoPor, setVotandoPor] = useState(null) // socioId al que estamos registrando voto
  const [opcionSeleccionada, setOpcionSeleccionada] = useState('')
  const [registrandoVoto, setRegistrandoVoto] = useState(false)

  // Edit estado
  const [cambiandoEstado, setCambiandoEstado] = useState(false)

  useEffect(() => { cargar() }, [id])

  useEffect(() => {
    if (tab === 'padron') buscarEnPadron()
  }, [tab, buscarSocio])

  const cargar = async () => {
    setLoading(true)
    try {
      const data = await api.get(`/admin/gobernanza/votaciones/${id}`)
      setVotacion(data.data || data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const buscarEnPadron = async () => {
    setLoadingPadron(true)
    try {
      const params = buscarSocio ? `?buscar=${encodeURIComponent(buscarSocio)}` : ''
      const data = await api.get(`/admin/gobernanza/votaciones/${id}/padron${params}`)
      setPadron(data.data || data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingPadron(false)
    }
  }

  const handleCambiarEstado = async (nuevoEstado) => {
    setCambiandoEstado(true)
    try {
      await api.put(`/admin/gobernanza/votaciones/${id}`, { estado: nuevoEstado })
      await cargar()
      setSuccess(`Votación ${nuevoEstado === 'ABIERTA' ? 'abierta' : nuevoEstado === 'CERRADA' ? 'cerrada' : 'actualizada'}`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setCambiandoEstado(false)
    }
  }

  const handleRegistrarVoto = async () => {
    if (!opcionSeleccionada || !votandoPor) return
    setRegistrandoVoto(true)
    setError(null)
    try {
      await api.post(`/admin/gobernanza/votaciones/${id}/votar`, { socioId: votandoPor, opcion: opcionSeleccionada })
      setVotandoPor(null)
      setOpcionSeleccionada('')
      await cargar()
      await buscarEnPadron()
      setSuccess('Voto registrado')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setRegistrandoVoto(false)
    }
  }

  const handleAnularVoto = async (socioId) => {
    if (!confirm('¿Anular el voto de este socio?')) return
    try {
      await api.delete(`/admin/gobernanza/votaciones/${id}/votos/${socioId}`)
      await cargar()
      setSuccess('Voto anulado')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleEliminar = async () => {
    if (!confirm('¿Eliminar esta votación?')) return
    try {
      await api.delete(`/admin/gobernanza/votaciones/${id}`)
      navigate('/admin/gobernanza/votaciones')
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <LoadingSpinner />
  if (!votacion) return null

  const canEdit = tienePermiso(PERMISOS.CONFIG_EDITAR)
  const opciones = JSON.parse(votacion.opciones || '[]')
  const totalVotos = votacion.votos?.length || 0
  const maxVotos = votacion.resultados ? Math.max(...votacion.resultados.map(r => r.votos), 1) : 1

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/gobernanza/votaciones')} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="p-2 bg-primary/10 rounded-lg">
            <Vote className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{votacion.titulo}</h1>
            <p className="text-sm text-gray-500">{totalVotos} votos · {votacion.estado}</p>
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            {votacion.estado === 'BORRADOR' && (
              <button onClick={() => handleCambiarEstado('ABIERTA')} disabled={cambiandoEstado} className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                Abrir votación
              </button>
            )}
            {votacion.estado === 'ABIERTA' && (
              <button onClick={() => handleCambiarEstado('CERRADA')} disabled={cambiandoEstado} className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                Cerrar votación
              </button>
            )}
            <button onClick={handleEliminar} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-5 gap-1">
        {[
          { key: 'resultados', label: 'Resultados' },
          { key: 'votos', label: `Votos (${totalVotos})` },
          { key: 'padron', label: 'Registrar voto' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Resultados */}
      {tab === 'resultados' && (
        <div className="space-y-3">
          {(votacion.resultados || []).map(r => {
            const pct = totalVotos > 0 ? Math.round(r.votos / totalVotos * 100) : 0
            const isWinner = r.votos === maxVotos && r.votos > 0
            return (
              <div key={r.opcion} className={`bg-white rounded-xl border p-4 ${isWinner && votacion.estado === 'CERRADA' ? 'border-green-300' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {isWinner && votacion.estado === 'CERRADA' && <CheckCircle className="w-4 h-4 text-green-500" />}
                    <span className="font-medium text-gray-800">{r.opcion}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-600">{r.votos} votos ({pct}%)</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${isWinner && votacion.estado === 'CERRADA' ? 'bg-green-500' : 'bg-primary'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
          {totalVotos === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              Sin votos registrados aún
            </div>
          )}
        </div>
      )}

      {/* Lista de votos */}
      {tab === 'votos' && (
        <div className="space-y-2">
          {(votacion.votos || []).map(v => (
            <div key={v.id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-800 text-sm">{v.socio?.apellido}, {v.socio?.nombre}</p>
                <p className="text-xs text-gray-500">Socio #{v.socio?.nroSocio} · {v.opcion}</p>
              </div>
              {canEdit && (
                <button onClick={() => handleAnularVoto(v.socioId)} className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 hover:bg-red-50 rounded transition">
                  Anular
                </button>
              )}
            </div>
          ))}
          {votacion.votos?.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              Sin votos registrados
            </div>
          )}
        </div>
      )}

      {/* Padrón / registrar voto */}
      {tab === 'padron' && (
        <div className="space-y-4">
          {votacion.estado !== 'ABIERTA' && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
              La votación debe estar <strong>Abierta</strong> para registrar votos
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={buscarSocio}
              onChange={e => setBuscarSocio(e.target.value)}
              placeholder="Buscar socio por apellido o número..."
              className="input-field pl-9 w-full"
            />
          </div>

          {loadingPadron ? <LoadingSpinner /> : (
            <div className="space-y-2">
              {padron.map(socio => (
                <div key={socio.id} className="bg-white rounded-xl border border-gray-200 p-3">
                  {votandoPor === socio.id ? (
                    <div className="space-y-3">
                      <p className="font-medium text-gray-800 text-sm">{socio.apellido}, {socio.nombre} — Socio #{socio.nroSocio}</p>
                      <div className="flex flex-wrap gap-2">
                        {opciones.map(op => (
                          <button
                            key={op}
                            onClick={() => setOpcionSeleccionada(op)}
                            className={`px-3 py-1.5 rounded-lg text-sm border transition ${opcionSeleccionada === op ? 'bg-primary text-white border-primary' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                          >
                            {op}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setVotandoPor(null); setOpcionSeleccionada('') }} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                        <button
                          onClick={handleRegistrarVoto}
                          disabled={!opcionSeleccionada || registrandoVoto}
                          className="px-4 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
                        >
                          {registrandoVoto ? 'Registrando...' : 'Confirmar voto'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{socio.apellido}, {socio.nombre}</p>
                        <p className="text-xs text-gray-500">Socio #{socio.nroSocio}</p>
                      </div>
                      {votacion.estado === 'ABIERTA' && canEdit && (
                        <button
                          onClick={() => { setVotandoPor(socio.id); setOpcionSeleccionada('') }}
                          className="px-3 py-1.5 text-sm text-primary border border-primary rounded-lg hover:bg-primary/5 transition"
                        >
                          Registrar voto
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {padron.length === 0 && (
                <div className="text-center text-gray-400 text-sm py-6">
                  {buscarSocio ? 'No se encontraron socios pendientes de votar' : 'Todos los socios activos ya votaron'}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
