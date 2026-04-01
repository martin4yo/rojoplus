import { useState, useEffect, useCallback } from 'react'
import {
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon,
  XCircleIcon,
  CheckCircleIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline'
import { Repeat, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../services/api'
import { formatDate, formatCurrency } from '../../../utils/formatters'

const ESTADO_COLORS = {
  CONFIRMADA:     'bg-green-100 text-green-700',
  PENDIENTE_PAGO: 'bg-yellow-100 text-yellow-700',
  CANCELADA:      'bg-red-100 text-red-600',
  COMPLETADA:     'bg-blue-100 text-blue-700',
  NO_SHOW:        'bg-gray-100 text-gray-500',
}
const ESTADO_LABELS = {
  CONFIRMADA:     'Confirmada',
  PENDIENTE_PAGO: 'Pend. pago',
  CANCELADA:      'Cancelada',
  COMPLETADA:     'Completada',
  NO_SHOW:        'No show',
}

const DIAS_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function isoDate(d) {
  return d.toISOString().split('T')[0]
}

export default function ReservasSocio({ socio, tokenPortal }) {
  const [vista, setVista] = useState('espacios') // espacios | disponibilidad | misReservas

  // Selección de espacio y fecha
  const [espacios, setEspacios] = useState([])
  const [espacioSel, setEspacioSel] = useState(null)
  const [fechaSel, setFechaSel] = useState(isoDate(new Date()))
  const [slots, setSlots] = useState([])
  const [config, setConfig] = useState(null)
  const [loadingSlots, setLoadingSlots] = useState(false)

  // Mis reservas
  const [misReservas, setMisReservas] = useState([])
  const [loadingReservas, setLoadingReservas] = useState(false)

  // Flujo de reserva
  const [slotSel, setSlotSel] = useState(null)
  const [mostrarFormReserva, setMostrarFormReserva] = useState(false)
  const [reservaDetalleSel, setReservaDetalleSel] = useState(null)

  // Navegación de fechas
  const fechaHoy = isoDate(new Date())

  useEffect(() => {
    cargarEspacios()
    cargarMisReservas()
  }, [tokenPortal])

  useEffect(() => {
    if (espacioSel && fechaSel) cargarSlots()
  }, [espacioSel, fechaSel])

  async function cargarEspacios() {
    try {
      const data = await api.get('/reservas/espacios')
      setEspacios(data || [])
    } catch {
      toast.error('Error al cargar los espacios')
    }
  }

  async function cargarSlots() {
    setLoadingSlots(true)
    setSlots([])
    try {
      const data = await api.get(`/reservas/disponibilidad?espacioId=${espacioSel.id}&fecha=${fechaSel}`)
      setSlots(data.slots || [])
      setConfig(data.config || null)
    } catch {
      toast.error('Error al cargar disponibilidad')
    } finally {
      setLoadingSlots(false)
    }
  }

  const cargarMisReservas = useCallback(async () => {
    setLoadingReservas(true)
    try {
      const data = await api.get(`/reservas/socio/${tokenPortal}?futuras=true`)
      setMisReservas(data || [])
    } catch {
      toast.error('Error al cargar tus reservas')
    } finally {
      setLoadingReservas(false)
    }
  }, [tokenPortal])

  function seleccionarEspacio(espacio) {
    setEspacioSel(espacio)
    setFechaSel(fechaHoy)
    setVista('disponibilidad')
  }

  function navegarFecha(delta) {
    const d = new Date(fechaSel)
    d.setDate(d.getDate() + delta)
    const nueva = isoDate(d)
    if (nueva >= fechaHoy) setFechaSel(nueva)
  }

  function elegirSlot(slot) {
    if (!slot.disponible) return
    setSlotSel(slot)
    setMostrarFormReserva(true)
  }

  function precioParaSocio() {
    if (!config) return 0
    if (config.modoPrecio === 'FIJO') return parseFloat(config.precioSocio || config.precioNoSocio || 0)
    const base = parseFloat(config.precioBase || 0)
    return base * (1 - (config.descuentoSocioPorc || 0) / 100)
  }

  const fechaObj = new Date(fechaSel + 'T00:00:00')

  // ── render principal ──────────────────────────────────────────────────────

  return (
    <div className="space-y-4 pb-4">
      {/* Header con tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setVista('espacios')}
          className={`flex-1 py-3 rounded-xl text-sm font-semibold transition ${vista === 'espacios' || vista === 'disponibilidad' ? 'bg-primary text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200'}`}
        >
          Reservar
        </button>
        <button
          onClick={() => { setVista('misReservas'); cargarMisReservas() }}
          className={`flex-1 py-3 rounded-xl text-sm font-semibold transition relative ${vista === 'misReservas' ? 'bg-primary text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200'}`}
        >
          Mis Reservas
          {misReservas.length > 0 && vista !== 'misReservas' && (
            <span className="absolute -top-1.5 -right-1.5 bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {misReservas.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Vista: lista de espacios ── */}
      {vista === 'espacios' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Seleccioná el espacio que querés reservar:</p>
          {espacios.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
              <AlertCircle size={32} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No hay espacios disponibles para reservar</p>
            </div>
          ) : (
            espacios.map(espacio => (
              <button
                key={espacio.id}
                onClick={() => seleccionarEspacio(espacio)}
                className="w-full bg-white rounded-2xl p-5 text-left shadow-sm border border-gray-100 hover:border-primary-200 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-bold text-gray-900 text-base">{espacio.nombre}</div>
                    <div className="text-sm text-gray-500 mt-0.5">{espacio.tipo}</div>
                    {espacio.descripcion && (
                      <div className="text-xs text-gray-400 mt-1.5 line-clamp-2">{espacio.descripcion}</div>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      {espacio.cubierto !== undefined && (
                        <span>{espacio.cubierto ? '🏛️ Cubierto' : '☀️ Al aire libre'}</span>
                      )}
                      {espacio.iluminacion && <span>💡 Iluminado</span>}
                    </div>
                  </div>
                  {espacio.config && (
                    <div className="text-right ml-4 shrink-0">
                      <div className="text-xs text-gray-400">Socio</div>
                      <div className="text-base font-bold text-green-700">
                        {formatCurrency(espacio.config.modoPrecio === 'FIJO'
                          ? espacio.config.precioSocio || espacio.config.precioNoSocio || 0
                          : parseFloat(espacio.config.precioBase || 0) * (1 - (espacio.config.descuentoSocioPorc || 0) / 100)
                        )}
                      </div>
                      <div className="text-xs text-gray-400">{espacio.config?.duracionSlotMin} min</div>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex justify-end">
                  <span className="text-xs text-primary font-semibold">Ver disponibilidad →</span>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* ── Vista: disponibilidad de un espacio ── */}
      {vista === 'disponibilidad' && espacioSel && (
        <div className="space-y-4">
          {/* Breadcrumb */}
          <button
            onClick={() => setVista('espacios')}
            className="flex items-center gap-1.5 text-sm text-primary font-medium"
          >
            <ChevronLeft size={16} /> Volver a espacios
          </button>

          {/* Info del espacio */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="font-bold text-gray-900">{espacioSel.nombre}</div>
            <div className="text-sm text-gray-500">{espacioSel.tipo}</div>
            {config && (
              <div className="mt-2 flex gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Tu precio:</span>
                  <span className="ml-1 font-bold text-green-700">{formatCurrency(precioParaSocio())}</span>
                  <span className="ml-1 text-xs text-gray-400">/ {config.duracionSlotMin} min</span>
                </div>
              </div>
            )}
          </div>

          {/* Navegación de fecha */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <button
                onClick={() => navegarFecha(-1)}
                disabled={fechaSel <= fechaHoy}
                className="p-2 rounded-xl hover:bg-gray-100 transition disabled:opacity-30"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="text-center">
                <div className="font-bold text-gray-900">
                  {DIAS_CORTO[fechaObj.getDay()]} {fechaObj.getDate()} {MESES[fechaObj.getMonth()]}
                </div>
                <div className="text-xs text-gray-400">{fechaObj.getFullYear()}</div>
              </div>
              <button onClick={() => navegarFecha(1)} className="p-2 rounded-xl hover:bg-gray-100 transition">
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Selector rápido de días */}
            <div className="flex overflow-x-auto gap-2 p-3 scrollbar-hide">
              {Array.from({ length: 14 }, (_, i) => {
                const d = new Date()
                d.setDate(d.getDate() + i)
                const str = isoDate(d)
                const activo = str === fechaSel
                return (
                  <button
                    key={i}
                    onClick={() => setFechaSel(str)}
                    className={`flex flex-col items-center min-w-[44px] py-2 px-1 rounded-xl text-xs transition shrink-0 ${activo ? 'bg-primary text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                  >
                    <span className="font-medium">{DIAS_CORTO[d.getDay()]}</span>
                    <span className={`text-base font-bold mt-0.5 ${activo ? 'text-white' : 'text-gray-800'}`}>{d.getDate()}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Grilla de slots */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Turnos disponibles
            </div>
            {loadingSlots ? (
              <div className="py-8 text-center text-gray-400 text-sm">Cargando disponibilidad...</div>
            ) : slots.length === 0 ? (
              <div className="py-8 text-center text-gray-400">
                <AlertCircle size={24} className="mx-auto mb-2" />
                <p className="text-sm">No hay turnos disponibles para este día</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((slot, i) => {
                  const elegido = slotSel?.horaInicio === slot.horaInicio
                  const disponible = slot.disponible && !slot.bloqueado
                  const cuposLibres = slot.cuposTotal - slot.cuposOcupados
                  return (
                    <button
                      key={i}
                      onClick={() => elegirSlot(slot)}
                      disabled={!disponible}
                      className={`p-3 rounded-xl border-2 text-center transition ${
                        !disponible
                          ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                          : 'border-primary-200 bg-primary-50 text-primary-dark hover:bg-primary-100 active:scale-95'
                      }`}
                    >
                      <div className="text-sm font-bold">{slot.horaInicio}</div>
                      <div className="text-xs mt-0.5">
                        {!disponible
                          ? slot.bloqueado ? 'No disp.' : 'Ocupado'
                          : cuposLibres === 1 ? '¡Último!' : `${cuposLibres} libre${cuposLibres !== 1 ? 's' : ''}`
                        }
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Vista: mis reservas ── */}
      {vista === 'misReservas' && (
        <div className="space-y-3">
          {loadingReservas ? (
            <div className="py-8 text-center text-gray-400 text-sm">Cargando tus reservas...</div>
          ) : misReservas.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400 shadow-sm">
              <CalendarDaysIcon className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm font-medium">No tenés reservas futuras</p>
              <button
                onClick={() => setVista('espacios')}
                className="mt-4 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold"
              >
                Hacer una reserva
              </button>
            </div>
          ) : (
            misReservas.map(r => (
              <ReservaCard
                key={r.id}
                reserva={r}
                tokenPortal={tokenPortal}
                onCancelada={cargarMisReservas}
              />
            ))
          )}
        </div>
      )}

      {/* Modal de reserva */}
      {mostrarFormReserva && slotSel && espacioSel && (
        <ModalReserva
          slot={slotSel}
          espacio={espacioSel}
          fecha={fechaSel}
          config={config}
          socio={socio}
          tokenPortal={tokenPortal}
          precioSocio={precioParaSocio()}
          onClose={() => { setMostrarFormReserva(false); setSlotSel(null) }}
          onConfirmada={() => {
            setMostrarFormReserva(false)
            setSlotSel(null)
            cargarSlots()
            cargarMisReservas()
            setVista('misReservas')
          }}
        />
      )}
    </div>
  )
}

// ── Card de reserva ───────────────────────────────────────────────────────────

function ReservaCard({ reserva, tokenPortal, onCancelada }) {
  const [cancelando, setCancelando] = useState(false)
  const [mostrarConfirm, setMostrarConfirm] = useState(false)

  const fechaObj = new Date(reserva.fecha + 'T00:00:00')
  const activa = ['CONFIRMADA', 'PENDIENTE_PAGO'].includes(reserva.estado)

  async function cancelar(cancelarGrupo) {
    setCancelando(true)
    try {
      await api.delete(`/reservas/socio/${tokenPortal}/${reserva.codigo}`, {
        body: JSON.stringify({ cancelarGrupo }),
        headers: { 'Content-Type': 'application/json' },
      })
      toast.success('Reserva cancelada')
      setMostrarConfirm(false)
      onCancelada()
    } catch (e) {
      toast.error(e.message || 'No se pudo cancelar')
    } finally {
      setCancelando(false)
    }
  }

  return (
    <div className={`bg-white rounded-2xl p-5 shadow-sm border ${activa ? 'border-gray-100' : 'border-gray-50 opacity-70'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${ESTADO_COLORS[reserva.estado]}`}>
              {ESTADO_LABELS[reserva.estado]}
            </span>
            {reserva.esRecurrente && (
              <span className="text-xs text-purple-600 flex items-center gap-1">
                <Repeat size={11} /> Recurrente
              </span>
            )}
          </div>
          <div className="font-bold text-gray-900 mt-2">{reserva.espacio?.nombre}</div>
          <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
            <span>📅 {DIAS_CORTO[new Date(reserva.fecha + 'T00:00:00').getDay()]} {fechaObj.getDate()} {MESES[fechaObj.getMonth()]}</span>
            <span className="text-gray-300">·</span>
            <span>🕐 {reserva.horaInicio} – {reserva.horaFin}</span>
          </div>
          <div className="text-sm font-semibold text-gray-700 mt-1.5">
            {formatCurrency(reserva.precioTotal)}
          </div>
        </div>

        {activa && (
          <button
            onClick={() => setMostrarConfirm(true)}
            className="shrink-0 text-xs text-red-500 font-medium hover:underline"
          >
            Cancelar
          </button>
        )}
      </div>

      {/* Confirm cancelación */}
      {mostrarConfirm && (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
          <p className="text-sm text-gray-700 font-medium">¿Cancelar esta reserva?</p>
          {reserva.esRecurrente && (
            <div className="flex gap-2">
              <button
                onClick={() => cancelar(false)}
                disabled={cancelando}
                className="flex-1 py-2 bg-orange-500 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
              >
                Solo esta
              </button>
              <button
                onClick={() => cancelar(true)}
                disabled={cancelando}
                className="flex-1 py-2 bg-red-600 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
              >
                Todas las futuras
              </button>
            </div>
          )}
          {!reserva.esRecurrente && (
            <button
              onClick={() => cancelar(false)}
              disabled={cancelando}
              className="w-full py-2 bg-red-600 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
            >
              {cancelando ? 'Cancelando...' : 'Sí, cancelar'}
            </button>
          )}
          <button onClick={() => setMostrarConfirm(false)} className="w-full py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-semibold">
            No cancelar
          </button>
        </div>
      )}
    </div>
  )
}

// ── Modal de confirmación de reserva ─────────────────────────────────────────

function ModalReserva({ slot, espacio, fecha, config, socio, tokenPortal, precioSocio, onClose, onConfirmada }) {
  const [metodoPago, setMetodoPago] = useState('MERCADOPAGO')
  const [esRecurrente, setEsRecurrente] = useState(false)
  const [semanas, setSemanas] = useState(4)
  const [observaciones, setObservaciones] = useState('')
  const [confirmando, setConfirmando] = useState(false)

  const fechaObj = new Date(fecha + 'T00:00:00')
  const totalAPagar = precioSocio * (esRecurrente ? semanas : 1)

  async function confirmar() {
    setConfirmando(true)
    try {
      const res = await api.post(`/reservas/socio/${tokenPortal}`, {
        espacioId: espacio.id,
        fecha,
        horaInicio: slot.horaInicio,
        metodoPago,
        observaciones,
        esRecurrente,
        semanas: esRecurrente ? parseInt(semanas) : 1,
      })

      if (metodoPago === 'MERCADOPAGO' && res.pago?.initPoint) {
        toast.success('Redirigiendo a MercadoPago...')
        window.location.href = res.pago.initPoint
      } else {
        toast.success('¡Reserva confirmada!')
        onConfirmada()
      }
    } catch (e) {
      toast.error(e.message || 'Error al confirmar la reserva')
      setConfirmando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-0">
      <div className="bg-white rounded-t-3xl w-full max-w-lg max-h-[92vh] overflow-y-auto animate-slide-up">
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-5" />

        <div className="px-6 pb-8 space-y-5">
          {/* Resumen */}
          <div>
            <h2 className="text-xl font-bold text-gray-900">Confirmar reserva</h2>
            <div className="mt-3 bg-primary-50 rounded-2xl p-4 space-y-1.5">
              <div className="font-bold text-gray-800 text-base">{espacio.nombre}</div>
              <div className="text-sm text-gray-600">
                📅 {DIAS_CORTO[fechaObj.getDay()]} {fechaObj.getDate()} {['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][fechaObj.getMonth()]}
              </div>
              <div className="text-sm text-gray-600">
                🕐 {slot.horaInicio} – {slot.horaFin}
              </div>
              <div className="text-sm font-semibold text-green-700">
                Tu precio: {formatCurrency(precioSocio)}
              </div>
            </div>
          </div>

          {/* Recurrencia */}
          <div className="bg-purple-50 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-purple-800 flex items-center gap-1.5">
                  <Repeat size={14} /> Reserva semanal recurrente
                </div>
                <div className="text-xs text-purple-600 mt-0.5">Repetí el mismo turno cada semana</div>
              </div>
              <button
                onClick={() => setEsRecurrente(!esRecurrente)}
                className={`w-12 h-6 rounded-full transition-colors ${esRecurrente ? 'bg-purple-600' : 'bg-gray-300'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow mx-0.5 transition-transform ${esRecurrente ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
            {esRecurrente && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-purple-700">Por</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSemanas(s => Math.max(2, s - 1))} className="w-8 h-8 rounded-full bg-purple-200 text-purple-800 font-bold text-lg flex items-center justify-center">−</button>
                  <span className="w-8 text-center font-bold text-purple-900">{semanas}</span>
                  <button onClick={() => setSemanas(s => Math.min(52, s + 1))} className="w-8 h-8 rounded-full bg-purple-200 text-purple-800 font-bold text-lg flex items-center justify-center">+</button>
                </div>
                <span className="text-sm text-purple-700">semanas</span>
              </div>
            )}
          </div>

          {/* Método de pago */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Forma de pago</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMetodoPago('MERCADOPAGO')}
                className={`py-3 rounded-xl border-2 text-sm font-semibold transition ${metodoPago === 'MERCADOPAGO' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}
              >
                💳 MercadoPago
              </button>
              <button
                onClick={() => setMetodoPago('EFECTIVO')}
                className={`py-3 rounded-xl border-2 text-sm font-semibold transition ${metodoPago === 'EFECTIVO' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600'}`}
              >
                💵 En mostrador
              </button>
            </div>
            {metodoPago === 'EFECTIVO' && (
              <p className="text-xs text-gray-400 mt-2 text-center">La reserva quedará pendiente hasta que el admin confirme el pago</p>
            )}
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Observaciones (opcional)</label>
            <textarea
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              rows={2}
              placeholder="¿Algo que debamos saber?"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Total */}
          <div className="bg-gray-50 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Total a pagar</div>
              {esRecurrente && (
                <div className="text-xs text-gray-400">{semanas} semanas × {formatCurrency(precioSocio)}</div>
              )}
            </div>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalAPagar)}</div>
          </div>

          {/* Botones */}
          <div className="space-y-2">
            <button
              onClick={confirmar}
              disabled={confirmando}
              className="w-full py-4 bg-primary text-white rounded-2xl text-base font-bold disabled:opacity-50 active:scale-98 transition"
            >
              {confirmando ? 'Procesando...' : metodoPago === 'MERCADOPAGO' ? 'Pagar con MercadoPago' : 'Confirmar reserva'}
            </button>
            <button onClick={onClose} className="w-full py-3 text-gray-500 text-sm font-medium">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
