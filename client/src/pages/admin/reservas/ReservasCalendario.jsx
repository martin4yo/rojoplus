import { useState, useEffect, useCallback } from 'react'
import {
  ChevronLeft, ChevronRight, Plus, Calendar, List,
  Clock, User, MapPin, AlertCircle, Lock, RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../services/api'
import { formatCurrency } from '../../../utils/formatters'
import LoadingSpinner from '../../../components/LoadingSpinner'
import ReservaDetalle from './ReservaDetalle'
import ReservaForm from './ReservaForm'

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const ESTADO_COLORS = {
  CONFIRMADA:     'bg-green-100 text-green-800 border-green-200',
  PENDIENTE_PAGO: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  CANCELADA:      'bg-red-100 text-red-800 border-red-200',
  COMPLETADA:     'bg-blue-100 text-blue-800 border-blue-200',
  NO_SHOW:        'bg-gray-100 text-gray-600 border-gray-200',
}

const ESTADO_LABELS = {
  CONFIRMADA:     'Confirmada',
  PENDIENTE_PAGO: 'Pendiente',
  CANCELADA:      'Cancelada',
  COMPLETADA:     'Completada',
  NO_SHOW:        'No show',
}

function isoDate(d) {
  return d.toISOString().split('T')[0]
}

function startOfWeek(date) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  return d
}

export default function ReservasCalendario() {
  const [vista, setVista] = useState('semana') // semana | lista
  const [fechaBase, setFechaBase] = useState(new Date())
  const [espacios, setEspacios] = useState([])
  const [espacioFiltro, setEspacioFiltro] = useState('') // '' = todos
  const [reservas, setReservas] = useState([])
  const [bloqueos, setBloqueos] = useState([])
  const [loading, setLoading] = useState(true)

  const [reservaDetalle, setReservaDetalle] = useState(null)
  const [mostrarDetalle, setMostrarDetalle] = useState(false)
  const [mostrarFormNuevo, setMostrarFormNuevo] = useState(false)

  // Rango de la semana actual
  const lunesBase = startOfWeek(fechaBase)
  const diasSemana = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunesBase)
    d.setDate(lunesBase.getDate() + i)
    return d
  })
  const fechaDesde = isoDate(diasSemana[0])
  const fechaHasta = isoDate(diasSemana[6])

  useEffect(() => {
    cargarEspacios()
  }, [])

  useEffect(() => {
    cargarCalendario()
  }, [fechaBase, espacioFiltro])

  async function cargarEspacios() {
    try {
      const data = await api.get('/reservas/espacios')
      setEspacios(data || [])
    } catch {
      toast.error('Error al cargar espacios')
    }
  }

  const cargarCalendario = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ fechaDesde, fechaHasta })
      if (espacioFiltro) params.append('espacioId', espacioFiltro)
      const data = await api.get(`/reservas/admin/calendario?${params}`)
      setReservas(data.reservas || [])
      setBloqueos(data.bloqueos || [])
    } catch {
      toast.error('Error al cargar calendario')
    } finally {
      setLoading(false)
    }
  }, [fechaDesde, fechaHasta, espacioFiltro])

  function navegar(delta) {
    const d = new Date(fechaBase)
    d.setDate(d.getDate() + delta * 7)
    setFechaBase(d)
  }

  function irHoy() {
    setFechaBase(new Date())
  }

  function reservasDeDia(fecha) {
    const str = isoDate(fecha)
    return reservas.filter(r => r.fecha?.startsWith(str))
  }

  function bloqueosDeDia(fecha) {
    const str = isoDate(fecha)
    return bloqueos.filter(b => b.fecha?.startsWith(str))
  }

  function abrirDetalle(reserva) {
    setReservaDetalle(reserva)
    setMostrarDetalle(true)
  }

  function cerrarDetalle() {
    setMostrarDetalle(false)
    setReservaDetalle(null)
    cargarCalendario()
  }

  const hoy = isoDate(new Date())

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reservas de Espacios</h1>
          <p className="text-sm text-gray-500 mt-1">Gestión de canchas, salones e instalaciones</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={cargarCalendario}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
            title="Actualizar"
          >
            <RefreshCw size={16} />
          </button>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setVista('semana')}
              className={`px-3 py-2 text-sm flex items-center gap-1 transition ${vista === 'semana' ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <Calendar size={14} /> Semana
            </button>
            <button
              onClick={() => setVista('lista')}
              className={`px-3 py-2 text-sm flex items-center gap-1 transition ${vista === 'lista' ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <List size={14} /> Lista
            </button>
          </div>
          <button
            onClick={() => setMostrarFormNuevo(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition text-sm font-medium"
          >
            <Plus size={16} /> Nueva Reserva
          </button>
        </div>
      </div>

      {/* Filtros + navegación */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navegar(-1)} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <ChevronLeft size={18} />
          </button>
          <button onClick={irHoy} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition font-medium">
            Hoy
          </button>
          <button onClick={() => navegar(1)} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <ChevronRight size={18} />
          </button>
          <span className="text-sm font-semibold text-gray-700">
            {diasSemana[0].getDate()} {MESES[diasSemana[0].getMonth()]} – {diasSemana[6].getDate()} {MESES[diasSemana[6].getMonth()]} {diasSemana[6].getFullYear()}
          </span>
        </div>

        <select
          value={espacioFiltro}
          onChange={e => setEspacioFiltro(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Todos los espacios</option>
          {espacios.map(e => (
            <option key={e.id} value={e.id}>{e.nombre}</option>
          ))}
        </select>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-3 flex-wrap">
        {Object.entries(ESTADO_LABELS).map(([estado, label]) => (
          <span key={estado} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${ESTADO_COLORS[estado]}`}>
            {label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-600 border border-gray-300">
          <Lock size={10} /> Bloqueado
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : vista === 'semana' ? (
        <VistaSemana
          diasSemana={diasSemana}
          hoy={hoy}
          reservasDeDia={reservasDeDia}
          bloqueosDeDia={bloqueosDeDia}
          onVerReserva={abrirDetalle}
        />
      ) : (
        <VistaLista
          diasSemana={diasSemana}
          hoy={hoy}
          reservasDeDia={reservasDeDia}
          bloqueosDeDia={bloqueosDeDia}
          onVerReserva={abrirDetalle}
        />
      )}

      {/* Modal detalle */}
      {mostrarDetalle && reservaDetalle && (
        <ReservaDetalle
          reservaId={reservaDetalle.id}
          onClose={cerrarDetalle}
        />
      )}

      {/* Modal nueva reserva */}
      {mostrarFormNuevo && (
        <ReservaForm
          espacios={espacios}
          onClose={() => { setMostrarFormNuevo(false); cargarCalendario() }}
        />
      )}
    </div>
  )
}

// ── Vista Semana ─────────────────────────────────────────────────────────────

function VistaSemana({ diasSemana, hoy, reservasDeDia, bloqueosDeDia, onVerReserva }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Cabecera días */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {diasSemana.map((dia, i) => {
          const esHoy = isoDate(dia) === hoy
          return (
            <div key={i} className={`p-3 text-center border-r border-gray-100 last:border-r-0 ${esHoy ? 'bg-primary-50' : ''}`}>
              <div className="text-xs text-gray-500 uppercase font-medium">{DIAS[dia.getDay()]}</div>
              <div className={`text-lg font-bold mt-0.5 ${esHoy ? 'text-primary' : 'text-gray-800'}`}>
                {dia.getDate()}
              </div>
              <div className="text-xs text-gray-400">{MESES[dia.getMonth()].slice(0,3)}</div>
            </div>
          )
        })}
      </div>

      {/* Cuerpo */}
      <div className="grid grid-cols-7 min-h-64">
        {diasSemana.map((dia, i) => {
          const esHoy = isoDate(dia) === hoy
          const rsv = reservasDeDia(dia)
          const blq = bloqueosDeDia(dia)
          return (
            <div
              key={i}
              className={`p-2 border-r border-gray-100 last:border-r-0 space-y-1 min-h-32 ${esHoy ? 'bg-primary-50/40' : ''}`}
            >
              {blq.map((b, j) => (
                <div key={j} className="bg-gray-200 border border-gray-300 rounded p-1.5 text-xs text-gray-600">
                  <div className="flex items-center gap-1 font-medium">
                    <Lock size={9} /> {b.horaInicio}–{b.horaFin}
                  </div>
                  {b.motivo && <div className="truncate text-gray-500">{b.motivo}</div>}
                  <div className="truncate text-gray-400">{b.espacio?.nombre}</div>
                </div>
              ))}
              {rsv.map((r) => (
                <ReservaChip key={r.id} reserva={r} onClick={() => onVerReserva(r)} />
              ))}
              {rsv.length === 0 && blq.length === 0 && (
                <div className="text-xs text-gray-300 text-center pt-4">–</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Vista Lista ───────────────────────────────────────────────────────────────

function VistaLista({ diasSemana, hoy, reservasDeDia, bloqueosDeDia, onVerReserva }) {
  const items = diasSemana.flatMap(dia => {
    const esHoy = isoDate(dia) === hoy
    const rsv = reservasDeDia(dia)
    const blq = bloqueosDeDia(dia)
    return [{ tipo: 'dia', dia, esHoy }, ...rsv.map(r => ({ tipo: 'reserva', r, dia })), ...blq.map(b => ({ tipo: 'bloqueo', b, dia }))]
  })

  return (
    <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      {items.map((item, i) => {
        if (item.tipo === 'dia') {
          const rsv = reservasDeDia(item.dia)
          const blq = bloqueosDeDia(item.dia)
          if (rsv.length === 0 && blq.length === 0) return null
          return (
            <div key={i} className={`px-4 py-2 text-xs font-semibold uppercase tracking-wide ${item.esHoy ? 'bg-primary-50 text-primary-dark' : 'bg-gray-50 text-gray-500'}`}>
              {DIAS[item.dia.getDay()]} {item.dia.getDate()} {MESES[item.dia.getMonth()]}
              {item.esHoy && <span className="ml-2 bg-primary text-white px-1.5 py-0.5 rounded-full text-xs">Hoy</span>}
            </div>
          )
        }
        if (item.tipo === 'bloqueo') {
          const b = item.b
          return (
            <div key={i} className="px-4 py-3 flex items-center gap-4 bg-gray-50/60">
              <Lock size={14} className="text-gray-400 shrink-0" />
              <span className="text-sm text-gray-500 w-24 shrink-0">{b.horaInicio}–{b.horaFin}</span>
              <span className="text-sm text-gray-600">{b.espacio?.nombre}</span>
              {b.motivo && <span className="text-xs text-gray-400">— {b.motivo}</span>}
            </div>
          )
        }
        const r = item.r
        return (
          <button
            key={i}
            onClick={() => onVerReserva(r)}
            className="w-full px-4 py-3 flex items-center gap-4 hover:bg-gray-50 transition text-left"
          >
            <Clock size={14} className="text-gray-400 shrink-0" />
            <span className="text-sm font-medium text-gray-700 w-24 shrink-0">{r.horaInicio}–{r.horaFin}</span>
            <MapPin size={14} className="text-gray-400 shrink-0" />
            <span className="text-sm text-gray-600 w-32 shrink-0 truncate">{r.espacio?.nombre}</span>
            <User size={14} className="text-gray-400 shrink-0" />
            <span className="text-sm text-gray-700 flex-1 truncate">{r.nombreReserva} {r.apellido}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium border shrink-0 ${ESTADO_COLORS[r.estado]}`}>
              {ESTADO_LABELS[r.estado]}
            </span>
            <span className="text-sm font-semibold text-gray-800 shrink-0">
              {formatCurrency(r.precioTotal)}
            </span>
          </button>
        )
      })}
      {items.every(i => i.tipo === 'dia') && (
        <div className="py-12 text-center text-gray-400">
          <Calendar size={32} className="mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No hay reservas esta semana</p>
        </div>
      )}
    </div>
  )
}

// ── Chip de reserva ───────────────────────────────────────────────────────────

function ReservaChip({ reserva, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded border p-1.5 text-xs hover:opacity-80 transition ${ESTADO_COLORS[reserva.estado]}`}
    >
      <div className="font-semibold truncate">{reserva.horaInicio}–{reserva.horaFin}</div>
      <div className="truncate">{reserva.nombreReserva} {reserva.apellido}</div>
      <div className="truncate text-opacity-80">{reserva.espacio?.nombre}</div>
    </button>
  )
}
