import { useState, useEffect } from 'react'
import { X, Calendar, Clock, User, Search, Repeat, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../services/api'
import { formatCurrency } from '../../../utils/formatters'
import LoadingSpinner from '../../../components/LoadingSpinner'

export default function ReservaForm({ espacios = [], onClose }) {
  const [paso, setPaso] = useState(1) // 1=espacio+fecha, 2=slot, 3=datos

  // Paso 1
  const [espacioId, setEspacioId] = useState('')
  const [fecha, setFecha] = useState('')

  // Paso 2
  const [slots, setSlots] = useState([])
  const [config, setConfig] = useState(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slotElegido, setSlotElegido] = useState(null)

  // Paso 3
  const [esSocio, setEsSocio] = useState(false)
  const [busquedaSocio, setBusquedaSocio] = useState('')
  const [socioEncontrado, setSocioEncontrado] = useState(null)
  const [buscandoSocio, setBuscandoSocio] = useState(false)
  const [resultadosSocio, setResultadosSocio] = useState([])
  const [mostrarListaSocios, setMostrarListaSocios] = useState(false)
  const [form, setForm] = useState({
    nombre: '', apellido: '', email: '', telefono: '', dni: '',
    metodoPago: 'EFECTIVO', observaciones: '',
    esRecurrente: false, semanas: 4,
  })
  const [guardando, setGuardando] = useState(false)

  // Precio calculado
  const precio = config ? calcularPrecio(config, esSocio) : null

  useEffect(() => {
    if (espacioId && fecha) cargarSlots()
  }, [espacioId, fecha])

  async function cargarSlots() {
    setLoadingSlots(true)
    setSlots([])
    setSlotElegido(null)
    try {
      const data = await api.getFull(`/reservas/disponibilidad?espacioId=${espacioId}&fecha=${fecha}`)
      setSlots(data.slots || [])
      setConfig(data.config || null)
    } catch {
      toast.error('Error al cargar disponibilidad')
    } finally {
      setLoadingSlots(false)
    }
  }

  // Busca mientras se tipea (con debounce) y muestra la lista para elegir.
  // Antes autoseleccionaba el primer resultado, que con nombres repetidos daba
  // el socio equivocado sin que se notara.
  useEffect(() => {
    if (!esSocio) return
    const termino = busquedaSocio.trim()
    if (termino.length < 2 || socioEncontrado) {
      setResultadosSocio([])
      setMostrarListaSocios(false)
      return
    }
    let cancelado = false
    setBuscandoSocio(true)
    const t = setTimeout(async () => {
      try {
        // El endpoint filtra por `q` (admin.js). Con `search` ignoraba el filtro
        // y devolvía la primera página completa: de ahí que "buscar" trajera
        // siempre el mismo socio.
        const data = await api.get(`/admin/socios?q=${encodeURIComponent(termino)}&limit=10`)
        if (cancelado) return
        const socios = data?.socios || data || []
        setResultadosSocio(socios)
        setMostrarListaSocios(true)
      } catch {
        if (!cancelado) {
          setResultadosSocio([])
          toast.error('Error al buscar socio')
        }
      } finally {
        if (!cancelado) setBuscandoSocio(false)
      }
    }, 300)
    return () => { cancelado = true; clearTimeout(t) }
  }, [busquedaSocio, esSocio, socioEncontrado])

  function seleccionarSocio(socio) {
    // El listado devuelve `apellidoNombre` ("Apellido, Nombre") y no los campos
    // sueltos, así que los derivamos para completar el formulario.
    const [apellidoSep, nombreSep] = String(socio.apellidoNombre || '').split(',')
    setSocioEncontrado(socio)
    setEsSocio(true)
    setMostrarListaSocios(false)
    setResultadosSocio([])
    setBusquedaSocio(socio.apellidoNombre || `${socio.apellido || ''}, ${socio.nombre || ''}`)
    setForm(f => ({
      ...f,
      nombre: socio.nombre || (nombreSep || '').trim(),
      apellido: socio.apellido || (apellidoSep || '').trim(),
      email: socio.email || '',
      telefono: socio.celular || socio.telefono || '',
      dni: socio.documento || socio.dni || '',
    }))
  }

  function limpiarSocio() {
    setSocioEncontrado(null)
    setBusquedaSocio('')
    setResultadosSocio([])
    setMostrarListaSocios(false)
  }

  async function guardar() {
    if (!slotElegido) return
    setGuardando(true)
    try {
      await api.post('/reservas/admin', {
        espacioId: parseInt(espacioId),
        fecha,
        horaInicio: slotElegido.horaInicio,
        esSocio,
        socioId: socioEncontrado?.id,
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
      toast.success('Reserva creada correctamente')
      onClose()
    } catch (e) {
      toast.error(e.message || 'Error al crear reserva')
    } finally {
      setGuardando(false)
    }
  }

  const puedeAvanzarPaso1 = espacioId && fecha
  const puedeAvanzarPaso2 = !!slotElegido
  const puedeGuardar = form.nombre && form.apellido && form.email

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Nueva Reserva (Admin)</h2>
            <div className="flex items-center gap-2 mt-1">
              {[1, 2, 3].map(n => (
                <div key={n} className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-medium ${paso >= n ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {n}
                </div>
              ))}
              <span className="text-xs text-gray-500">
                {paso === 1 ? 'Espacio y fecha' : paso === 2 ? 'Horario' : 'Datos reservante'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* PASO 1: Espacio + fecha */}
          {paso === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Espacio</label>
                <select
                  value={espacioId}
                  onChange={e => setEspacioId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Seleccionar espacio...</option>
                  {espacios.map(e => (
                    <option key={e.id} value={e.id}>{e.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <Calendar size={14} className="inline mr-1" />Fecha
                </label>
                <input
                  type="date"
                  value={fecha}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setFecha(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          )}

          {/* PASO 2: Selección de slot */}
          {paso === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-800">
                    {espacios.find(e => String(e.id) === String(espacioId))?.nombre}
                  </div>
                  <div className="text-sm text-gray-500">{fecha}</div>
                </div>
                {config && (
                  <div className="text-xs text-gray-500 text-right">
                    <div>Slots de {config.duracionSlotMin} min</div>
                    <div>Cupos: {config.cuposSimultaneos}</div>
                  </div>
                )}
              </div>

              {loadingSlots ? (
                <div className="flex justify-center py-6"><LoadingSpinner /></div>
              ) : slots.length === 0 ? (
                <div className="py-6 text-center text-gray-400">
                  <AlertCircle size={24} className="mx-auto mb-2" />
                  <p className="text-sm">No hay disponibilidad para este día</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {slots.map((slot, i) => {
                    const elegido = slotElegido?.horaInicio === slot.horaInicio
                    const libre = slot.disponible && !slot.bloqueado
                    return (
                      <button
                        key={i}
                        disabled={!libre}
                        onClick={() => setSlotElegido(libre ? slot : null)}
                        className={`p-3 rounded-xl border-2 text-sm font-medium transition ${
                          !libre
                            ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                            : elegido
                            ? 'border-primary bg-primary-50 text-primary-dark'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-primary hover:bg-primary-50'
                        }`}
                      >
                        <div>{slot.horaInicio}</div>
                        <div className="text-xs font-normal mt-0.5">
                          {!libre
                            ? slot.bloqueado ? slot.motivoBloqueo?.slice(0, 10) || 'Bloqueado' : `${slot.cuposTotal - slot.cuposOcupados === 0 ? 'Lleno' : `${slot.cuposTotal - slot.cuposOcupados}/${slot.cuposTotal}`}`
                            : `${slot.cuposTotal - slot.cuposOcupados}/${slot.cuposTotal} libre${slot.cuposTotal - slot.cuposOcupados !== 1 ? 's' : ''}`
                          }
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {slotElegido && config && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm">
                  <div className="font-semibold text-green-800">
                    Slot: {slotElegido.horaInicio} – {slotElegido.horaFin}
                  </div>
                  <div className="text-green-600 mt-0.5">
                    Precio socio: {formatCurrency(calcularPrecio(config, true).precio)} ·
                    Precio público: {formatCurrency(calcularPrecio(config, false).precio)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PASO 3: Datos del reservante */}
          {paso === 3 && (
            <div className="space-y-4">
              {/* Tipo reservante */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo de reservante</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEsSocio(false); setSocioEncontrado(null) }}
                    className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition ${!esSocio ? 'border-primary bg-primary-50 text-primary-dark' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                  >
                    Externo / Público
                  </button>
                  <button
                    onClick={() => setEsSocio(true)}
                    className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition ${esSocio ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                  >
                    Socio del club
                  </button>
                </div>
              </div>

              {/* Buscar socio */}
              {esSocio && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Buscar socio</label>
                  <div className="relative">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          value={busquedaSocio}
                          onChange={e => {
                            if (socioEncontrado) setSocioEncontrado(null)
                            setBusquedaSocio(e.target.value)
                          }}
                          onFocus={() => resultadosSocio.length && setMostrarListaSocios(true)}
                          // onMouseDown de la lista corre antes que el blur, pero
                          // igual demoramos el cierre para no perder el click.
                          onBlur={() => setTimeout(() => setMostrarListaSocios(false), 150)}
                          placeholder="Nombre, apellido, documento o nro socio..."
                          className="w-full border border-gray-200 rounded-lg pl-3 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                          {buscandoSocio ? <LoadingSpinner size="sm" /> : <Search size={16} />}
                        </div>
                      </div>
                      {socioEncontrado && (
                        <button
                          type="button"
                          onClick={limpiarSocio}
                          className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition text-sm"
                        >
                          Cambiar
                        </button>
                      )}
                    </div>

                    {mostrarListaSocios && !socioEncontrado && (
                      <div className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                        {resultadosSocio.length === 0 ? (
                          <div className="px-3 py-2.5 text-sm text-gray-500">
                            {buscandoSocio ? 'Buscando...' : 'Sin resultados'}
                          </div>
                        ) : (
                          resultadosSocio.map(s => (
                            <button
                              key={s.id}
                              type="button"
                              onMouseDown={() => seleccionarSocio(s)}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                            >
                              <div className="text-sm text-gray-800">
                                {s.apellidoNombre || `${s.apellido || ''}, ${s.nombre || ''}`}
                              </div>
                              <div className="text-xs text-gray-500">
                                Nro {s.nroSocio}{s.documento ? ` · DNI ${s.documento}` : ''}
                                {s.estadoSocioRel?.nombre ? ` · ${s.estadoSocioRel.nombre}` : ''}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  {socioEncontrado && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                      ✓ {socioEncontrado.apellidoNombre || `${socioEncontrado.apellido}, ${socioEncontrado.nombre}`} — Nro {socioEncontrado.nroSocio}
                    </div>
                  )}
                </div>
              )}

              {/* Datos personales */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                  <input
                    value={form.nombre}
                    onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Apellido *</label>
                  <input
                    value={form.apellido}
                    onChange={e => setForm(f => ({ ...f, apellido: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
                  <input
                    value={form.telefono}
                    onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">DNI</label>
                  <input
                    value={form.dni}
                    onChange={e => setForm(f => ({ ...f, dni: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Método de pago */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Método de pago</label>
                <div className="flex gap-2">
                  {['EFECTIVO', 'CORTESIA', 'MERCADOPAGO'].map(mp => (
                    <button
                      key={mp}
                      onClick={() => setForm(f => ({ ...f, metodoPago: mp }))}
                      className={`flex-1 py-2 rounded-lg border-2 text-xs font-medium transition ${form.metodoPago === mp ? 'border-primary bg-primary-50 text-primary-dark' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                    >
                      {mp === 'EFECTIVO' ? 'Efectivo' : mp === 'CORTESIA' ? 'Cortesía' : 'MercadoPago'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recurrencia */}
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="recurrente"
                    checked={form.esRecurrente}
                    onChange={e => setForm(f => ({ ...f, esRecurrente: e.target.checked }))}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                  <label htmlFor="recurrente" className="flex items-center gap-1.5 text-sm font-medium text-purple-800 cursor-pointer">
                    <Repeat size={14} /> Reserva recurrente (semanal)
                  </label>
                </div>
                {form.esRecurrente && (
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-purple-700">Repetir por</label>
                    <input
                      type="number"
                      min={2}
                      max={52}
                      value={form.semanas}
                      onChange={e => setForm(f => ({ ...f, semanas: e.target.value }))}
                      className="w-20 border border-purple-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="text-sm text-purple-700">semanas</span>
                  </div>
                )}
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Observaciones</label>
                <textarea
                  value={form.observaciones}
                  onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Resumen precio */}
              {slotElegido && precio && (
                <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    {slotElegido.horaInicio}–{slotElegido.horaFin}
                    {form.esRecurrente && ` × ${form.semanas} semanas`}
                    {esSocio && precio.descuento > 0 && (
                      <div className="text-green-600 text-xs">Descuento socio: {formatCurrency(precio.descuento)}</div>
                    )}
                  </div>
                  <div className="text-xl font-bold text-gray-900">
                    {formatCurrency(precio.precio * (form.esRecurrente ? parseInt(form.semanas || 1) : 1))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer botones */}
          <div className="flex justify-between pt-2 border-t border-gray-100">
            {paso > 1 ? (
              <button onClick={() => setPaso(p => p - 1)} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition text-sm">
                Atrás
              </button>
            ) : (
              <button onClick={onClose} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition text-sm">
                Cancelar
              </button>
            )}
            {paso < 3 ? (
              <button
                onClick={() => setPaso(p => p + 1)}
                disabled={(paso === 1 && !puedeAvanzarPaso1) || (paso === 2 && !puedeAvanzarPaso2)}
                className="px-5 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition text-sm font-medium disabled:opacity-40"
              >
                Siguiente
              </button>
            ) : (
              <button
                onClick={guardar}
                disabled={!puedeGuardar || guardando}
                className="px-5 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition text-sm font-medium disabled:opacity-40"
              >
                {guardando ? 'Guardando...' : 'Crear Reserva'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function calcularPrecio(config, esSocio) {
  if (!config) return { precio: 0, descuento: 0 }
  if (config.modoPrecio === 'FIJO') {
    const noSocio = parseFloat(config.precioNoSocio || 0)
    const socio = parseFloat(config.precioSocio || noSocio)
    const precio = esSocio ? socio : noSocio
    return { precio, descuento: esSocio ? Math.max(0, noSocio - socio) : 0 }
  }
  const base = parseFloat(config.precioBase || 0)
  const porc = esSocio ? (config.descuentoSocioPorc || 0) : 0
  const descuento = base * (porc / 100)
  return { precio: base - descuento, descuento }
}
