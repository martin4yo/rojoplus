import { useEffect, useState } from 'react'
import { Plus, X, ChevronLeft, Trophy, MapPin, CheckCircle, XCircle, Clock as ClockIcon } from 'lucide-react'
import api from '../../../services/api'
import toast from 'react-hot-toast'

export default function ConvocatoriasTab({ categoria }) {
  const [partidos, setPartidos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [creando, setCreando] = useState(false)
  const [seleccionado, setSeleccionado] = useState(null)

  async function cargar() {
    setCargando(true)
    try {
      const data = await api.get(`/entrenador/categorias/${categoria.id}/partidos`)
      setPartidos(Array.isArray(data) ? data : [])
    } catch (err) {
      toast.error(err.message || 'Error cargando partidos')
    } finally {
      setCargando(false)
    }
  }
  useEffect(() => { cargar() }, [categoria.id])

  if (seleccionado) {
    return <DetallePartido partidoId={seleccionado.id} categoriaId={categoria.id} onVolver={() => { setSeleccionado(null); cargar() }} />
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-600">{partidos.length} partido{partidos.length !== 1 ? 's' : ''}</div>
        <button
          onClick={() => setCreando(true)}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Nuevo
        </button>
      </div>

      {creando && <NuevoPartidoModal categoria={categoria} onClose={() => setCreando(false)} onCreado={() => { setCreando(false); cargar() }} />}

      {cargando ? (
        <div className="text-sm text-gray-500 py-8 text-center">Cargando…</div>
      ) : partidos.length === 0 ? (
        <div className="text-sm text-gray-500 py-8 text-center">No hay partidos.</div>
      ) : (
        <div className="space-y-2">
          {partidos.map(p => {
            const fechaStr = new Date(p.fecha).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' })
            return (
              <button
                key={p.id}
                onClick={() => setSeleccionado(p)}
                className="w-full bg-white rounded-lg border border-gray-200 p-4 text-left hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900 capitalize">{fechaStr} · {p.hora}</div>
                    <div className="text-sm text-gray-700 mt-1 flex items-center gap-2 flex-wrap">
                      <Trophy className="w-3.5 h-3.5 text-amber-500" />
                      <span>{p.condicion === 'LOCAL' ? 'vs' : '@'} <strong>{p.rival}</strong></span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      {p.ubicacion && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {p.ubicacion}</span>}
                      {p.campeonato?.nombre && <span>{p.campeonato.nombre}</span>}
                      <span>{p._count?.convocados || 0} convocados</span>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function NuevoPartidoModal({ categoria, onClose, onCreado }) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [hora, setHora] = useState('15:00')
  const [tipo, setTipo] = useState('AMISTOSO')
  const [condicion, setCondicion] = useState('LOCAL')
  const [rival, setRival] = useState('')
  const [ubicacion, setUbicacion] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    if (!rival.trim()) { toast.error('Falta el rival'); return }
    setGuardando(true)
    try {
      await api.post('/entrenador/partidos', {
        categoriaActividadId: categoria.id,
        fecha, hora, tipo, condicion, rival: rival.trim(),
        ubicacion: ubicacion || null, observaciones: observaciones || null,
      })
      toast.success('Partido creado')
      onCreado()
    } catch (err) {
      toast.error(err.message || 'Error al crear')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-xl sm:rounded-xl w-full max-w-md p-6 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Nuevo partido</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Hora</label>
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="AMISTOSO">Amistoso</option>
                <option value="LIGA">Liga</option>
                <option value="COPA">Copa</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Condición</label>
              <select value={condicion} onChange={(e) => setCondicion(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="LOCAL">Local</option>
                <option value="VISITANTE">Visitante</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Rival</label>
            <input type="text" value={rival} onChange={(e) => setRival(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Nombre del equipo rival" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Ubicación</label>
            <input type="text" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Cancha o dirección" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Observaciones</label>
            <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          </div>
        </div>
        <div className="mt-6 flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium">Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
            {guardando ? 'Guardando…' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DetallePartido({ partidoId, categoriaId, onVolver }) {
  const [partido, setPartido] = useState(null)
  const [convocatorias, setConvocatorias] = useState([])
  const [plantel, setPlantel] = useState([])
  const [convocadosIds, setConvocadosIds] = useState(new Set())
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  async function cargar() {
    setCargando(true)
    try {
      const [det, plant] = await Promise.all([
        api.get(`/entrenador/partidos/${partidoId}/convocatorias`),
        api.get(`/entrenador/categorias/${categoriaId}/plantel`),
      ])
      setPartido(det.partido)
      setConvocatorias(det.convocatorias || [])
      setPlantel(plant || [])
      setConvocadosIds(new Set((det.convocatorias || []).map(c => c.socioId)))
    } catch (err) {
      toast.error(err.message || 'Error')
    } finally {
      setCargando(false)
    }
  }
  useEffect(() => { cargar() }, [partidoId])

  function toggle(socioId) {
    setConvocadosIds(prev => {
      const next = new Set(prev)
      if (next.has(socioId)) next.delete(socioId)
      else next.add(socioId)
      return next
    })
  }

  async function guardar() {
    setGuardando(true)
    try {
      const r = await api.post(`/entrenador/partidos/${partidoId}/convocatorias`, {
        socioIds: [...convocadosIds],
      })
      toast.success(`${r.creadas} convocados nuevos, ${r.eliminadas} removidos`)
      cargar()
    } catch (err) {
      toast.error(err.message || 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) return <div className="text-sm text-gray-500 py-8 text-center">Cargando…</div>
  const respuestas = new Map(convocatorias.map(c => [c.socioId, c]))

  return (
    <div className="space-y-3">
      <button onClick={onVolver} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-2">
        <ChevronLeft className="w-4 h-4" /> Volver
      </button>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="font-bold text-gray-900">
          {partido?.condicion === 'LOCAL' ? 'vs' : '@'} {partido?.rival}
        </div>
        <div className="text-sm text-gray-600 mt-1">
          {new Date(partido?.fecha).toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long' })} · {partido?.hora}
        </div>
      </div>

      <div className="text-xs text-gray-500 px-2">Tocá los jugadores que querés convocar. Al guardar se notifica a los nuevos.</div>
      <div className="space-y-2">
        {plantel.map(p => {
          const isConvocado = convocadosIds.has(p.id)
          const respuesta = respuestas.get(p.id)
          let estado = null
          if (respuesta) {
            if (respuesta.confirmado === true) estado = { icon: CheckCircle, color: 'text-green-600', label: 'Confirmó' }
            else if (respuesta.confirmado === false) estado = { icon: XCircle, color: 'text-red-600', label: respuesta.motivoRechazo || 'Rechazó' }
            else estado = { icon: ClockIcon, color: 'text-amber-500', label: 'Sin responder' }
          }
          return (
            <button
              key={p.id}
              onClick={() => toggle(p.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left ${
                isConvocado ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200'
              }`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${isConvocado ? 'bg-blue-600' : 'border-2 border-gray-300'}`}>
                {isConvocado && <CheckCircle className="w-4 h-4 text-white" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm text-gray-900 truncate">{p.apellidoNombre}</div>
                {estado && (
                  <div className={`text-xs flex items-center gap-1 mt-0.5 ${estado.color}`}>
                    <estado.icon className="w-3 h-3" /> {estado.label}
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <div className="sticky bottom-0 bg-gray-50 -mx-4 px-4 py-3 border-t border-gray-200">
        <button
          onClick={guardar}
          disabled={guardando}
          className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : `Convocar ${convocadosIds.size} jugador${convocadosIds.size !== 1 ? 'es' : ''}`}
        </button>
      </div>
    </div>
  )
}
