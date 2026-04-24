import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Plus, Minus, Trash2, ShoppingCart, Ticket, DollarSign,
  Banknote, ArrowUpRight, CreditCard, QrCode, CheckCircle, Calendar, MapPin,
  X, Loader2, XCircle, Clock,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '../../../components/Button'
import api from '../../../services/api'
import { formatDate, formatCurrency } from '../../../utils/formatters'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../../components/LoadingSpinner'

const MEDIO_ICONS = {
  EFECTIVO: Banknote,
  TRANSFERENCIA: ArrowUpRight,
  TARJETA: CreditCard,
  QR_MP: QrCode,
  QR: QrCode,
}

// Detecta si el medio de pago selecciona flujo QR MP
function esMedioQRMP(mp) {
  if (!mp) return false
  if ((mp.tipo || '').toUpperCase().includes('QR')) return true
  const nombre = (mp.nombre || '').toUpperCase()
  return nombre.includes('QR') || nombre.includes('MERCADO PAGO QR')
}

export default function VentaVentanilla() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const dispositivoIdParam = searchParams.get('dispositivoId')

  const [loading, setLoading] = useState(true)
  const [eventos, setEventos] = useState([])
  const [eventoId, setEventoId] = useState('')
  const [categorias, setCategorias] = useState([])
  const [cajas, setCajas] = useState([])
  const [mediosPago, setMediosPago] = useState([])

  const [carrito, setCarrito] = useState([])
  const [cajaId, setCajaId] = useState('')
  const [medioPagoId, setMedioPagoId] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [resultado, setResultado] = useState(null)

  // Flujo QR MP
  const [ventaQR, setVentaQR] = useState(null) // { id, qrData, monto, expiresAt }
  const [ventaQREstado, setVentaQREstado] = useState(null) // PENDIENTE | PAGADA | ...
  const [segundosRestantes, setSegundosRestantes] = useState(0)
  const pollingRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    cargarDatos()
  }, [])

  useEffect(() => {
    if (eventoId) cargarCategorias(eventoId)
    else setCategorias([])
    setCarrito([])
  }, [eventoId])

  async function cargarDatos() {
    setLoading(true)
    try {
      const [evRes, cajRes, mpRes] = await Promise.all([
        api.getFull('/eventos?estado=PROGRAMADO,EN_CURSO&ventasHabilitadas=true'),
        api.getFull('/admin/cajas?activo=true'),
        api.getFull('/admin/medios-pago'),
      ])
      const evs = evRes?.data || []
      setEventos(evs)
      setCajas(cajRes?.data || [])
      setMediosPago((mpRes?.data || []).filter(m => m.activo))
      if (evs.length === 1) setEventoId(String(evs[0].id))
    } catch (err) {
      console.error(err)
      toast.error('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  async function cargarCategorias(id) {
    try {
      const res = await api.getFull(`/eventos/${id}/categorias`)
      setCategorias((res?.data || []).filter(c => c.activo))
    } catch (err) {
      console.error(err)
      setCategorias([])
    }
  }

  function agregarAlCarrito(cat) {
    setCarrito(prev => {
      const existente = prev.find(i => i.categoriaId === cat.id)
      if (existente) {
        return prev.map(i => i.categoriaId === cat.id ? { ...i, cantidad: i.cantidad + 1 } : i)
      }
      return [...prev, {
        categoriaId: cat.id,
        nombre: cat.nombre,
        precio: Number(cat.precioNoSocio),
        cantidad: 1,
      }]
    })
  }

  function cambiarCantidad(catId, delta) {
    setCarrito(prev => prev
      .map(i => i.categoriaId === catId ? { ...i, cantidad: i.cantidad + delta } : i)
      .filter(i => i.cantidad > 0)
    )
  }

  function quitarItem(catId) {
    setCarrito(prev => prev.filter(i => i.categoriaId !== catId))
  }

  function limpiarCarrito() {
    setCarrito([])
  }

  async function cobrar() {
    if (carrito.length === 0) return toast.error('Agregá items al carrito')
    if (!cajaId) return toast.error('Elegí una caja')
    if (!medioPagoId) return toast.error('Elegí un medio de pago')

    const medio = mediosPago.find(m => m.id === parseInt(medioPagoId))
    if (esMedioQRMP(medio)) {
      return iniciarVentaQR()
    }

    setProcesando(true)
    try {
      const items = carrito.map(i => ({ categoriaId: i.categoriaId, cantidad: i.cantidad }))
      const res = await api.post(`/eventos/${eventoId}/vender`, {
        items,
        nombreComprador: 'Venta ventanilla',
        cajaId: parseInt(cajaId),
        medioPagoId: parseInt(medioPagoId),
        ingresoDirecto: true,
        canalVenta: 'VENTANILLA',
        dispositivoId: dispositivoIdParam ? parseInt(dispositivoIdParam) : null,
      })

      const data = res?.data || res
      const total = carrito.reduce((s, i) => s + i.cantidad * i.precio, 0)
      const cantidad = carrito.reduce((s, i) => s + i.cantidad, 0)

      setResultado({ cantidad, total })
      limpiarCarrito()
      toast.success(`${cantidad} entrada(s) — ingreso registrado`)

      setTimeout(() => setResultado(null), 4000)
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Error al cobrar')
    } finally {
      setProcesando(false)
    }
  }

  async function iniciarVentaQR() {
    setProcesando(true)
    try {
      const items = carrito.map(i => ({ categoriaId: i.categoriaId, cantidad: i.cantidad }))
      const res = await api.post('/accesos/venta-ventanilla/qr', {
        eventoId: parseInt(eventoId),
        items,
        cajaId: parseInt(cajaId),
        medioPagoId: parseInt(medioPagoId),
        dispositivoId: dispositivoIdParam ? parseInt(dispositivoIdParam) : null,
      })
      const data = res?.data || res
      setVentaQR(data)
      setVentaQREstado('PENDIENTE')
      iniciarPolling(data.id)
      iniciarTimer(data.expiresAt)
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Error generando QR')
    } finally {
      setProcesando(false)
    }
  }

  function iniciarPolling(ventaId) {
    detenerPolling()
    pollingRef.current = setInterval(async () => {
      try {
        const res = await api.getFull(`/accesos/venta-ventanilla/qr/${ventaId}`)
        const data = res?.data
        if (!data) return
        setVentaQREstado(data.estado)
        if (data.estado !== 'PENDIENTE') {
          detenerPolling()
          if (data.estado === 'PAGADA') {
            const total = Number(data.monto)
            const cantidad = carrito.reduce((s, i) => s + i.cantidad, 0)
            setResultado({ cantidad, total })
            toast.success('Pago confirmado — ingreso registrado')
            limpiarCarrito()
            setTimeout(() => { setVentaQR(null); setResultado(null) }, 3000)
          } else if (data.estado === 'EXPIRADA') {
            toast.error('QR expirado — intentá de nuevo')
            setTimeout(() => setVentaQR(null), 2500)
          } else if (data.estado === 'CANCELADA') {
            toast('Venta cancelada')
            setTimeout(() => setVentaQR(null), 1500)
          }
        }
      } catch (err) {
        console.error('Polling error:', err)
      }
    }, 2000)
  }

  function detenerPolling() {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
  }

  function iniciarTimer(expiresAt) {
    if (timerRef.current) clearInterval(timerRef.current)
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt) - new Date()) / 1000))
      setSegundosRestantes(diff)
      if (diff <= 0 && timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    }
    update()
    timerRef.current = setInterval(update, 1000)
  }

  async function cancelarVentaQR() {
    if (!ventaQR) return
    try {
      await api.post(`/accesos/venta-ventanilla/qr/${ventaQR.id}/cancelar`)
    } catch (err) {
      console.warn('Error al cancelar:', err.message)
    }
    detenerPolling()
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setVentaQR(null)
    setVentaQREstado(null)
  }

  useEffect(() => {
    return () => {
      detenerPolling()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const evento = eventos.find(e => e.id === parseInt(eventoId))
  const total = carrito.reduce((s, i) => s + i.cantidad * i.precio, 0)
  const cantidadTotal = carrito.reduce((s, i) => s + i.cantidad, 0)

  // Filtrar medios de pago habilitados por la caja seleccionada
  const cajaSeleccionada = cajas.find(c => c.id === parseInt(cajaId))
  const mediosFiltrados = cajaSeleccionada?.mediosPagoPermitidos?.length
    ? mediosPago.filter(m => cajaSeleccionada.mediosPagoPermitidos.includes(m.nombre))
    : mediosPago

  if (loading) return <LoadingSpinner />

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/accesos/control-pwa')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Ticket className="w-6 h-6 text-primary" />
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-800">Venta en Ventanilla</h1>
            {evento && (
              <p className="text-xs text-gray-500 flex items-center gap-2">
                <Calendar className="w-3 h-3" /> {formatDate(evento.fecha)} {evento.hora && `· ${evento.hora}`}
                {evento.ubicacion && <><MapPin className="w-3 h-3 ml-1" /> {evento.ubicacion}</>}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
        {/* Panel izq: Evento + Categorías */}
        <div className="space-y-4">
          {/* Selector evento */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Evento</label>
            <select
              value={eventoId}
              onChange={(e) => setEventoId(e.target.value)}
              className="input-field w-full text-base"
            >
              <option value="">Seleccioná un evento...</option>
              {eventos.map(e => (
                <option key={e.id} value={e.id}>
                  {e.nombre} — {formatDate(e.fecha)}
                </option>
              ))}
            </select>
            {eventos.length === 0 && (
              <p className="text-xs text-gray-500 mt-2">No hay eventos activos con ventas habilitadas.</p>
            )}
          </div>

          {/* Cards de categorías */}
          {eventoId && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Categorías</h2>
              {categorias.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">Sin categorías activas</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {categorias.map(cat => {
                    const disponibles = cat.capacidad ? (cat.capacidad - cat.entradasVendidas) : null
                    const agotado = disponibles !== null && disponibles <= 0
                    return (
                      <button
                        key={cat.id}
                        onClick={() => !agotado && agregarAlCarrito(cat)}
                        disabled={agotado}
                        className={`p-4 rounded-xl border-2 transition text-left ${
                          agotado
                            ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                            : 'border-gray-200 hover:border-primary hover:bg-primary/5 active:scale-95'
                        }`}
                      >
                        <div className="font-semibold text-gray-800 mb-1">{cat.nombre}</div>
                        <div className="text-2xl font-bold text-primary mb-1">
                          {formatCurrency(cat.precioNoSocio, { showSymbol: true })}
                        </div>
                        {cat.precioSocio !== cat.precioNoSocio && (
                          <div className="text-xs text-gray-500">
                            Socio: {formatCurrency(cat.precioSocio, { showSymbol: true })}
                          </div>
                        )}
                        {disponibles !== null && (
                          <div className={`text-xs mt-2 ${agotado ? 'text-red-600' : 'text-gray-500'}`}>
                            {agotado ? 'Agotado' : `${disponibles} disponibles`}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Panel der: Carrito + Cobro */}
        <div className="space-y-4">
          {/* Carrito */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                Carrito
              </h2>
              {carrito.length > 0 && (
                <button onClick={limpiarCarrito} className="text-xs text-gray-400 hover:text-red-600">
                  Vaciar
                </button>
              )}
            </div>
            {carrito.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Sin items</p>
            ) : (
              <div className="space-y-2">
                {carrito.map(item => (
                  <div key={item.categoriaId} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{item.nombre}</div>
                      <div className="text-xs text-gray-500">{formatCurrency(item.precio, { showSymbol: true })} c/u</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => cambiarCantidad(item.categoriaId, -1)} className="p-1 hover:bg-gray-200 rounded">
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-6 text-center font-semibold">{item.cantidad}</span>
                      <button onClick={() => cambiarCantidad(item.categoriaId, 1)} className="p-1 hover:bg-gray-200 rounded">
                        <Plus className="w-4 h-4" />
                      </button>
                      <button onClick={() => quitarItem(item.categoriaId)} className="p-1 hover:bg-red-100 text-red-600 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="pt-2 mt-2 border-t border-gray-200 flex items-center justify-between">
                  <span className="text-sm text-gray-600">{cantidadTotal} entrada(s)</span>
                  <span className="text-xl font-bold text-gray-800">
                    {formatCurrency(total, { showSymbol: true })}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Caja y medio de pago */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Caja</label>
              <select
                value={cajaId}
                onChange={(e) => { setCajaId(e.target.value); setMedioPagoId('') }}
                className="input-field w-full text-sm"
              >
                <option value="">Seleccionar...</option>
                {cajas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Medio de pago</label>
              <div className="grid grid-cols-2 gap-2">
                {mediosFiltrados.map(mp => {
                  const esQR = esMedioQRMP(mp)
                  const key = esQR ? 'QR' : (mp.nombre?.toUpperCase() || 'EFECTIVO')
                  const Icon = MEDIO_ICONS[key] || DollarSign
                  const selected = String(mp.id) === medioPagoId
                  return (
                    <button
                      key={mp.id}
                      onClick={() => setMedioPagoId(String(mp.id))}
                      className={`p-3 rounded-lg border-2 transition flex flex-col items-center gap-1 ${
                        selected
                          ? (esQR ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-primary bg-primary/10 text-primary')
                          : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-xs font-medium">{mp.nombre}</span>
                      {esQR && <span className="text-[10px] text-blue-600">Genera QR</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Botón cobrar */}
          <Button
            onClick={cobrar}
            loading={procesando}
            disabled={carrito.length === 0 || !cajaId || !medioPagoId}
            className="w-full py-4 text-lg"
          >
            Cobrar {formatCurrency(total, { showSymbol: true })}
          </Button>

          {/* Resultado */}
          {resultado && (
            <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4 text-center">
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-2" />
              <p className="font-bold text-green-700">
                {resultado.cantidad} entrada(s) vendidas
              </p>
              <p className="text-sm text-green-600">
                {formatCurrency(resultado.total, { showSymbol: true })} — Ingreso registrado
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal QR Mercado Pago */}
      {ventaQR && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full relative">
            <button
              onClick={cancelarVentaQR}
              className="absolute top-3 right-3 p-2 hover:bg-gray-100 rounded-full"
              title="Cancelar"
            >
              <X className="w-5 h-5" />
            </button>

            {ventaQREstado === 'PAGADA' ? (
              <div className="text-center py-8">
                <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-green-700">¡Pago confirmado!</h2>
                <p className="text-gray-600 mt-2">
                  {formatCurrency(ventaQR.monto, { showSymbol: true })} — Ingreso registrado
                </p>
              </div>
            ) : ventaQREstado === 'EXPIRADA' || ventaQREstado === 'CANCELADA' ? (
              <div className="text-center py-8">
                <XCircle className="w-20 h-20 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-red-700">
                  {ventaQREstado === 'EXPIRADA' ? 'QR expirado' : 'Venta cancelada'}
                </h2>
              </div>
            ) : (
              <>
                <div className="text-center mb-4">
                  <h2 className="text-xl font-bold text-gray-800">Escanear con Cuenta DNI / MP / MODO</h2>
                  <p className="text-3xl font-bold text-primary mt-2">
                    {formatCurrency(ventaQR.monto, { showSymbol: true })}
                  </p>
                </div>

                <div className="flex justify-center p-4 bg-white border-4 border-gray-100 rounded-xl">
                  {ventaQR.qrData ? (
                    <QRCodeSVG value={ventaQR.qrData} size={256} level="M" includeMargin />
                  ) : (
                    <div className="w-64 h-64 flex items-center justify-center text-gray-400">
                      Generando QR...
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Esperando pago...</span>
                </div>

                <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  <span>
                    Expira en {Math.floor(segundosRestantes / 60)}:{String(segundosRestantes % 60).padStart(2, '0')}
                  </span>
                </div>

                <button
                  onClick={cancelarVentaQR}
                  className="w-full mt-4 py-2 text-sm text-gray-600 hover:text-red-600"
                >
                  Cancelar venta
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
