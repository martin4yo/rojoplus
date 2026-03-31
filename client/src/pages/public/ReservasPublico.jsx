import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../services/api'
import { formatCurrency } from '../../utils/formatters'

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function isoDate(d) { return d.toISOString().split('T')[0] }

export default function ReservasPublico() {
  const [searchParams] = useSearchParams()
  const status = searchParams.get('status')
  const codigoReserva = searchParams.get('reserva')

  const [paso, setPaso] = useState(status ? 'resultado' : 'espacios')

  // Datos
  const [espacios, setEspacios] = useState([])
  const [espacioSel, setEspacioSel] = useState(null)
  const [fechaSel, setFechaSel] = useState(isoDate(new Date()))
  const [slots, setSlots] = useState([])
  const [config, setConfig] = useState(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slotSel, setSlotSel] = useState(null)

  // Formulario
  const [form, setForm] = useState({
    nombre: '', apellido: '', email: '', telefono: '', dni: '',
    metodoPago: 'MERCADOPAGO', observaciones: '',
    esRecurrente: false, semanas: 4,
  })
  const [enviando, setEnviando] = useState(false)

  const fechaHoy = isoDate(new Date())

  useEffect(() => {
    cargarEspacios()
  }, [])

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

  function navegarFecha(delta) {
    const d = new Date(fechaSel)
    d.setDate(d.getDate() + delta)
    const nueva = isoDate(d)
    if (nueva >= fechaHoy) setFechaSel(nueva)
  }

  function precioPublico() {
    if (!config) return 0
    if (config.modoPrecio === 'FIJO') return parseFloat(config.precioNoSocio || 0)
    return parseFloat(config.precioBase || 0)
  }

  async function confirmarReserva() {
    if (!form.nombre || !form.apellido || !form.email) {
      toast.error('Completá los datos obligatorios')
      return
    }
    setEnviando(true)
    try {
      const res = await api.post('/reservas', {
        espacioId: espacioSel.id,
        fecha: fechaSel,
        horaInicio: slotSel.horaInicio,
        esSocio: false,
        nombre: form.nombre,
        apellido: form.apellido,
        email: form.email,
        telefono: form.telefono,
        dni: form.dni,
        metodoPago: form.metodoPago,
        observaciones: form.observaciones,
        esRecurrente: form.esRecurrente,
        semanas: form.esRecurrente ? parseInt(form.semanas) : 1,
      })

      if (form.metodoPago === 'MERCADOPAGO' && res.pago?.initPoint) {
        window.location.href = res.pago.initPoint
      } else {
        toast.success('¡Reserva recibida! Te contactaremos para confirmar el pago.')
        setPaso('exito')
      }
    } catch (e) {
      toast.error(e.message || 'Error al realizar la reserva')
    } finally {
      setEnviando(false)
    }
  }

  const fechaObj = new Date(fechaSel + 'T00:00:00')
  const totalPublico = precioPublico() * (form.esRecurrente ? parseInt(form.semanas || 1) : 1)

  // ── Resultado de pago ─────────────────────────────────────────────────────

  if (paso === 'resultado' || paso === 'exito') {
    const esExito = status === 'success' || paso === 'exito'
    const esPendiente = status === 'pending'

    return (
      <PaginaResultado
        exito={esExito}
        pendiente={esPendiente}
        codigo={codigoReserva}
        onNuevaReserva={() => { window.location.href = window.location.pathname }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header público */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          {paso !== 'espacios' && (
            <button
              onClick={() => {
                if (paso === 'datos') setPaso('disponibilidad')
                else if (paso === 'disponibilidad') { setEspacioSel(null); setPaso('espacios') }
              }}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <div>
            <h1 className="text-lg font-bold text-gray-900">Reservar espacio</h1>
            <p className="text-xs text-gray-500">
              {paso === 'espacios' && 'Seleccioná el espacio'}
              {paso === 'disponibilidad' && espacioSel?.nombre}
              {paso === 'datos' && `${espacioSel?.nombre} · ${slotSel?.horaInicio}`}
            </p>
          </div>
          {/* Pasos */}
          <div className="ml-auto flex items-center gap-1.5">
            {['espacios', 'disponibilidad', 'datos'].map((p, i) => (
              <div key={p} className={`w-2 h-2 rounded-full transition ${paso === p ? 'bg-red-600 w-5' : i < ['espacios', 'disponibilidad', 'datos'].indexOf(paso) ? 'bg-green-500' : 'bg-gray-200'}`} />
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* ── PASO 1: Elegir espacio ── */}
        {paso === 'espacios' && (
          <>
            <p className="text-sm text-gray-600">Seleccioná la instalación que querés usar:</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {espacios.map(espacio => {
                const p = precioDeConfig(espacio.config, false)
                const pSocio = precioDeConfig(espacio.config, true)
                return (
                  <button
                    key={espacio.id}
                    onClick={() => { setEspacioSel(espacio); setPaso('disponibilidad') }}
                    className="bg-white rounded-2xl p-5 text-left shadow-sm border border-gray-100 hover:border-red-200 hover:shadow-md transition group"
                  >
                    <div className="font-bold text-gray-900 text-base group-hover:text-red-600 transition">{espacio.nombre}</div>
                    <div className="text-sm text-gray-500 mt-0.5">{espacio.tipo}</div>
                    {espacio.descripcion && (
                      <p className="text-xs text-gray-400 mt-2 line-clamp-2">{espacio.descripcion}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      {espacio.cubierto !== undefined && <span>{espacio.cubierto ? '🏛️ Cubierto' : '☀️ Al aire libre'}</span>}
                      {espacio.iluminacion && <span>💡 Iluminado</span>}
                      {espacio.config && <span><Clock size={10} className="inline mr-0.5" />{espacio.config.duracionSlotMin} min</span>}
                    </div>
                    {espacio.config && (
                      <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-sm">
                        <div>
                          <div className="text-xs text-gray-400">Público</div>
                          <div className="font-bold text-gray-800">{formatCurrency(p)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-400">Socio</div>
                          <div className="font-bold text-green-700">{formatCurrency(pSocio)}</div>
                        </div>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
            {espacios.length === 0 && (
              <div className="bg-white rounded-2xl p-10 text-center text-gray-400">
                <AlertCircle size={32} className="mx-auto mb-3 text-gray-300" />
                <p>No hay espacios disponibles para reservar</p>
              </div>
            )}
          </>
        )}

        {/* ── PASO 2: Disponibilidad ── */}
        {paso === 'disponibilidad' && espacioSel && (
          <>
            {/* Info */}
            {config && (
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-700">
                <span className="font-semibold">Socio del club:</span> reservá con descuento especial iniciando sesión en el portal del socio.
              </div>
            )}

            {/* Navegación de fecha */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <button
                  onClick={() => navegarFecha(-1)}
                  disabled={fechaSel <= fechaHoy}
                  className="p-2 rounded-xl hover:bg-gray-100 transition disabled:opacity-30"
                >
                  <ChevronLeft size={20} />
                </button>
                <div className="text-center">
                  <div className="font-bold text-gray-900 text-base">
                    {DIAS[fechaObj.getDay()]} {fechaObj.getDate()} de {MESES[fechaObj.getMonth()]}
                  </div>
                  <div className="text-xs text-gray-400">{fechaObj.getFullYear()}</div>
                </div>
                <button onClick={() => navegarFecha(1)} className="p-2 rounded-xl hover:bg-gray-100 transition">
                  <ChevronRight size={20} />
                </button>
              </div>

              {/* Selector de días */}
              <div className="flex overflow-x-auto gap-2 p-3">
                {Array.from({ length: 14 }, (_, i) => {
                  const d = new Date()
                  d.setDate(d.getDate() + i)
                  const str = isoDate(d)
                  const activo = str === fechaSel
                  return (
                    <button
                      key={i}
                      onClick={() => setFechaSel(str)}
                      className={`flex flex-col items-center min-w-[46px] py-2 px-1 rounded-xl text-xs transition shrink-0 ${activo ? 'bg-red-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                    >
                      <span>{DIAS[d.getDay()]}</span>
                      <span className={`text-lg font-bold mt-0.5 ${activo ? '' : 'text-gray-800'}`}>{d.getDate()}</span>
                      <span className="text-xs opacity-70">{MESES_CORTO[d.getMonth()]}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Slots */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800">Turnos disponibles</h3>
                {config && (
                  <span className="text-sm text-gray-500">{config.duracionSlotMin} min · {formatCurrency(precioPublico())} c/u</span>
                )}
              </div>

              {loadingSlots ? (
                <div className="py-8 text-center text-gray-400">Verificando disponibilidad...</div>
              ) : slots.length === 0 ? (
                <div className="py-8 text-center text-gray-400">
                  <AlertCircle size={24} className="mx-auto mb-2" />
                  No hay turnos disponibles para este día
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {slots.map((slot, i) => {
                    const disponible = slot.disponible && !slot.bloqueado
                    const cuposLibres = slot.cuposTotal - slot.cuposOcupados
                    return (
                      <button
                        key={i}
                        disabled={!disponible}
                        onClick={() => { setSlotSel(slot); setPaso('datos') }}
                        className={`p-3 rounded-xl border-2 text-center transition ${
                          !disponible
                            ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                            : 'border-red-200 bg-white text-red-700 hover:bg-red-50 hover:border-red-400 hover:shadow-sm active:scale-95'
                        }`}
                      >
                        <div className="font-bold text-sm">{slot.horaInicio}</div>
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
          </>
        )}

        {/* ── PASO 3: Datos y confirmación ── */}
        {paso === 'datos' && slotSel && espacioSel && (
          <>
            {/* Resumen */}
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 space-y-1.5">
              <div className="font-bold text-gray-900">{espacioSel.nombre}</div>
              <div className="text-sm text-gray-600">📅 {DIAS[fechaObj.getDay()]} {fechaObj.getDate()} de {MESES[fechaObj.getMonth()]} · 🕐 {slotSel.horaInicio}–{slotSel.horaFin}</div>
              <div className="text-base font-bold text-red-700">{formatCurrency(precioPublico())} / turno</div>
            </div>

            {/* Formulario */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
              <h3 className="font-semibold text-gray-800">Tus datos</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                  <input
                    value={form.nombre}
                    onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Apellido *</label>
                  <input
                    value={form.apellido}
                    onChange={e => setForm(f => ({ ...f, apellido: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
                  <input
                    value={form.telefono}
                    onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">DNI</label>
                  <input
                    value={form.dni}
                    onChange={e => setForm(f => ({ ...f, dni: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                </div>
              </div>
            </div>

            {/* Recurrencia */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-gray-800 text-sm">Reserva semanal recurrente</div>
                  <div className="text-xs text-gray-500 mt-0.5">Reservá el mismo turno cada semana</div>
                </div>
                <button
                  onClick={() => setForm(f => ({ ...f, esRecurrente: !f.esRecurrente }))}
                  className={`w-12 h-6 rounded-full transition-colors ${form.esRecurrente ? 'bg-red-600' : 'bg-gray-200'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow mx-0.5 transition-transform ${form.esRecurrente ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
              {form.esRecurrente && (
                <div className="flex items-center gap-3 pt-1">
                  <span className="text-sm text-gray-600">Repetir por</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setForm(f => ({ ...f, semanas: Math.max(2, parseInt(f.semanas) - 1) }))} className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 font-bold flex items-center justify-center text-lg">−</button>
                    <span className="w-8 text-center font-bold text-gray-900">{form.semanas}</span>
                    <button onClick={() => setForm(f => ({ ...f, semanas: Math.min(52, parseInt(f.semanas) + 1) }))} className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 font-bold flex items-center justify-center text-lg">+</button>
                  </div>
                  <span className="text-sm text-gray-600">semanas</span>
                </div>
              )}
            </div>

            {/* Pago */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
              <h3 className="font-semibold text-gray-800">Forma de pago</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setForm(f => ({ ...f, metodoPago: 'MERCADOPAGO' }))}
                  className={`py-3 rounded-xl border-2 text-sm font-semibold transition ${form.metodoPago === 'MERCADOPAGO' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}
                >
                  💳 MercadoPago
                </button>
                <button
                  onClick={() => setForm(f => ({ ...f, metodoPago: 'EFECTIVO' }))}
                  className={`py-3 rounded-xl border-2 text-sm font-semibold transition ${form.metodoPago === 'EFECTIVO' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600'}`}
                >
                  💵 En el club
                </button>
              </div>
              {form.metodoPago === 'EFECTIVO' && (
                <p className="text-xs text-gray-400 text-center">Presentate en el club a abonar antes de la reserva.</p>
              )}
            </div>

            {/* Observaciones */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">Observaciones (opcional)</label>
              <textarea
                value={form.observaciones}
                onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
                rows={2}
                placeholder="¿Algo que debamos saber?"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>

            {/* Total + botón */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm text-gray-500">Total</div>
                  {form.esRecurrente && (
                    <div className="text-xs text-gray-400">{form.semanas} semanas × {formatCurrency(precioPublico())}</div>
                  )}
                </div>
                <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalPublico)}</div>
              </div>
              <button
                onClick={confirmarReserva}
                disabled={enviando || !form.nombre || !form.apellido || !form.email}
                className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold text-base disabled:opacity-40 hover:bg-red-700 transition active:scale-98"
              >
                {enviando ? 'Procesando...' : form.metodoPago === 'MERCADOPAGO' ? '💳 Pagar con MercadoPago' : '✓ Confirmar reserva'}
              </button>
              <p className="text-xs text-gray-400 text-center mt-3">
                Sos socio del club? <a href="#" className="text-red-600 font-medium">Accedé al portal</a> para precio especial.
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function precioDeConfig(config, esSocio) {
  if (!config) return 0
  if (config.modoPrecio === 'FIJO') {
    return esSocio ? parseFloat(config.precioSocio || config.precioNoSocio || 0) : parseFloat(config.precioNoSocio || 0)
  }
  const base = parseFloat(config.precioBase || 0)
  return esSocio ? base * (1 - (config.descuentoSocioPorc || 0) / 100) : base
}

function PaginaResultado({ exito, pendiente, codigo, onNuevaReserva }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-lg p-8 max-w-sm w-full text-center space-y-4">
        {exito ? (
          <CheckCircle size={56} className="mx-auto text-green-500" />
        ) : pendiente ? (
          <Clock size={56} className="mx-auto text-yellow-500" />
        ) : (
          <XCircle size={56} className="mx-auto text-red-500" />
        )}

        <h2 className="text-xl font-bold text-gray-900">
          {exito ? '¡Reserva confirmada!' : pendiente ? 'Pago en proceso' : 'Pago no completado'}
        </h2>

        <p className="text-sm text-gray-500">
          {exito
            ? 'Tu reserva fue procesada correctamente. Recibirás un email de confirmación.'
            : pendiente
            ? 'Tu pago está siendo procesado. Te notificaremos por email cuando se confirme.'
            : 'Hubo un problema con el pago. Podés intentarlo de nuevo o elegir pago en el club.'
          }
        </p>

        {codigo && (
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="text-xs text-gray-400">Código de reserva</div>
            <div className="font-mono font-bold text-gray-800 text-sm mt-0.5">{codigo}</div>
          </div>
        )}

        <button
          onClick={onNuevaReserva}
          className="w-full py-3 bg-red-600 text-white rounded-2xl font-semibold hover:bg-red-700 transition"
        >
          {exito ? 'Hacer otra reserva' : 'Intentar de nuevo'}
        </button>
      </div>
    </div>
  )
}
