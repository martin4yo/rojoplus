import { useEffect, useState } from 'react'
import { Plus, X, Check, MapPin, Clock, ChevronLeft, AlertTriangle } from 'lucide-react'
import api from '../../../services/api'
import toast from 'react-hot-toast'

const ESTADOS_ASISTENCIA = [
  { id: 'PRESENTE', label: 'Presente', color: 'green' },
  { id: 'AUSENTE', label: 'Ausente', color: 'red' },
  { id: 'TARDE', label: 'Tarde', color: 'amber' },
  { id: 'JUSTIFICADO', label: 'Justificado', color: 'blue' },
]

export default function EntrenamientosTab({ categoria }) {
  const [items, setItems] = useState([])
  const [cargando, setCargando] = useState(true)
  const [creando, setCreando] = useState(false)
  const [seleccionado, setSeleccionado] = useState(null)

  async function cargar() {
    setCargando(true)
    try {
      const data = await api.get(`/entrenador/categorias/${categoria.id}/entrenamientos`)
      setItems(Array.isArray(data) ? data : [])
    } catch (err) {
      toast.error(err.message || 'Error cargando entrenamientos')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [categoria.id])

  if (seleccionado) {
    return <AsistenciaPanel entrenamiento={seleccionado} onVolver={() => { setSeleccionado(null); cargar() }} />
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-600">{items.length} entrenamiento{items.length !== 1 ? 's' : ''}</div>
        <button
          onClick={() => setCreando(true)}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Nuevo
        </button>
      </div>

      {creando && <NuevoEntrenamientoModal categoria={categoria} onClose={() => setCreando(false)} onCreado={() => { setCreando(false); cargar() }} />}

      {cargando ? (
        <div className="text-sm text-gray-500 py-8 text-center">Cargando…</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-gray-500 py-8 text-center">No hay entrenamientos en el rango.</div>
      ) : (
        <div className="space-y-2">
          {items.map(e => {
            const fechaStr = new Date(e.fecha).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' })
            const cancelado = e.estado === 'CANCELADO'
            return (
              <button
                key={e.id}
                onClick={() => setSeleccionado(e)}
                className={`w-full bg-white rounded-lg border border-gray-200 p-4 text-left hover:shadow-md transition-shadow ${cancelado ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-gray-900 capitalize">{fechaStr}</div>
                    <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {e.horaInicio} - {e.horaFin}</span>
                      {e.espacio?.nombre && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {e.espacio.nombre}</span>}
                      {e.tipo !== 'REGULAR' && <span className="text-blue-600">{e.tipo}</span>}
                    </div>
                    {cancelado && (
                      <div className="mt-2 inline-flex items-center gap-1 text-xs text-red-600">
                        <AlertTriangle className="w-3 h-3" /> Cancelado{e.motivoCancelacion ? `: ${e.motivoCancelacion}` : ''}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">
                    {e._count?.asistencias || 0} asistencias
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

function NuevoEntrenamientoModal({ categoria, onClose, onCreado }) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [horaInicio, setHoraInicio] = useState('19:00')
  const [horaFin, setHoraFin] = useState('20:30')
  const [tipo, setTipo] = useState('EXTRA')
  const [observaciones, setObservaciones] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    if (!fecha || !horaInicio || !horaFin) {
      toast.error('Completá fecha y horarios')
      return
    }
    setGuardando(true)
    try {
      await api.post(`/entrenador/categorias/${categoria.id}/entrenamientos`, {
        fecha, horaInicio, horaFin, tipo, observaciones: observaciones || null,
      })
      toast.success('Entrenamiento creado y socios notificados')
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
          <h3 className="text-lg font-bold">Nuevo entrenamiento</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Inicio</label>
              <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fin</label>
              <input type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
              <option value="EXTRA">Extra</option>
              <option value="REGULAR">Regular</option>
              <option value="ESPECIAL">Especial</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Observaciones</label>
            <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Notas para los jugadores…" />
          </div>
        </div>
        <div className="mt-6 flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium">Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
            {guardando ? 'Guardando…' : 'Crear y avisar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AsistenciaPanel({ entrenamiento, onVolver }) {
  const [data, setData] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [items, setItems] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [cancelando, setCancelando] = useState(false)

  async function cargar() {
    setCargando(true)
    try {
      const r = await api.get(`/entrenador/entrenamientos/${entrenamiento.id}/asistencia`)
      setData(r)
      setItems(r.items || [])
    } catch (err) {
      toast.error(err.message || 'Error')
    } finally {
      setCargando(false)
    }
  }
  useEffect(() => { cargar() }, [entrenamiento.id])

  function setEstado(socioId, estado) {
    setItems(prev => prev.map(i => i.socioId === socioId ? { ...i, estado } : i))
  }

  async function guardar() {
    setGuardando(true)
    try {
      const payload = items
        .filter(i => i.estado)
        .map(i => ({ socioId: i.socioId, estado: i.estado, observaciones: i.observaciones || null }))
      await api.post(`/entrenador/entrenamientos/${entrenamiento.id}/asistencia`, { items: payload })
      toast.success(`Asistencia guardada (${payload.length})`)
    } catch (err) {
      toast.error(err.message || 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  async function cancelarEntrenamiento() {
    const motivo = prompt('Motivo de la cancelación:')
    if (!motivo) return
    setCancelando(true)
    try {
      await api.patch(`/entrenador/entrenamientos/${entrenamiento.id}`, {
        estado: 'CANCELADO',
        motivoCancelacion: motivo,
      })
      toast.success('Entrenamiento cancelado y socios notificados')
      onVolver()
    } catch (err) {
      toast.error(err.message || 'Error')
    } finally {
      setCancelando(false)
    }
  }

  if (cargando) return <div className="text-sm text-gray-500 py-8 text-center">Cargando…</div>
  const fechaStr = new Date(entrenamiento.fecha).toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long' })
  const cancelado = entrenamiento.estado === 'CANCELADO'

  return (
    <div className="space-y-3">
      <button onClick={onVolver} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-2">
        <ChevronLeft className="w-4 h-4" /> Volver
      </button>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="font-bold text-gray-900 capitalize">{fechaStr}</div>
        <div className="text-sm text-gray-600 mt-1">{entrenamiento.horaInicio} - {entrenamiento.horaFin}</div>
        {!cancelado && (
          <button
            onClick={cancelarEntrenamiento}
            disabled={cancelando}
            className="mt-3 text-xs text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
          >
            {cancelando ? 'Cancelando…' : 'Cancelar entrenamiento (avisa a socios)'}
          </button>
        )}
        {cancelado && <div className="mt-2 text-sm text-red-600">Cancelado</div>}
      </div>

      {!cancelado && (
        <>
          <div className="text-xs text-gray-500 px-2">Tocá un estado por cada jugador. Guardá al final.</div>
          <div className="space-y-2">
            {items.map(i => (
              <div key={i.socioId} className="bg-white rounded-lg border border-gray-200 p-3">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {i.fotoUrl ? <img src={i.fotoUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-gray-400 text-sm">{(i.apellidoNombre || '?').slice(0, 1)}</span>}
                  </div>
                  <div className="flex-1 min-w-0 text-sm font-medium text-gray-900 truncate">{i.apellidoNombre}</div>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {ESTADOS_ASISTENCIA.map(e => {
                    const activo = i.estado === e.id
                    const colorClass = e.color === 'green' ? 'bg-green-600' : e.color === 'red' ? 'bg-red-600' : e.color === 'amber' ? 'bg-amber-500' : 'bg-blue-600'
                    return (
                      <button
                        key={e.id}
                        onClick={() => setEstado(i.socioId, e.id)}
                        className={`py-2 text-xs font-medium rounded ${activo ? `${colorClass} text-white` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                        {e.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="sticky bottom-0 bg-gray-50 -mx-4 px-4 py-3 border-t border-gray-200">
            <button
              onClick={guardar}
              disabled={guardando}
              className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {guardando ? 'Guardando…' : 'Guardar asistencia'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
