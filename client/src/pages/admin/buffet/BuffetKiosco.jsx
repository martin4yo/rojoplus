import { useState, useEffect, useRef, useCallback } from 'react'
import { Coffee, Plus, Minus, DollarSign, ShoppingCart, Search, X, Barcode, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../services/api'
import { useTicket } from '../../../contexts/TicketContext'
import NotificacionBuffet from '../../../components/buffet/NotificacionBuffet'
import SearchInput from '../../../components/SearchInput'
import CalculadoraVuelto from '../../../components/buffet/CalculadoraVuelto'
import SelectorMedioPago from '../../../components/buffet/SelectorMedioPago'

export default function BuffetKiosco() {
  const { generarTicketKiosco, imprimirTicket } = useTicket()
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [carrito, setCarrito] = useState([])
  const [categoriaActiva, setCategoriaActiva] = useState(null)
  const [cajas, setCajas] = useState([])
  const [mediosPago, setMediosPago] = useState([])
  const [cajaId, setCajaId] = useState('')
  const [medioPagoId, setMedioPagoId] = useState('')
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [buscando, setBuscando] = useState(false)
  const ultimoInputRef = useRef(Date.now())
  const barcodeTimeoutRef = useRef(null)
  const searchInputRef = useRef(null) // Ref para el search input
  const [ultimoNumeroVenta, setUltimoNumeroVenta] = useState(null)
  const [datosVuelto, setDatosVuelto] = useState({ montoPagado: 0, vuelto: 0, esSuficiente: false })
  const [ultimasVentas, setUltimasVentas] = useState([])
  const [mostrarUltimasVentas, setMostrarUltimasVentas] = useState(false)
  const [tabActivo, setTabActivo] = useState('carrito') // 'carrito' o 'finalizar'

  useEffect(() => {
    cargarDatos()
  }, [])

  // Atajos de teclado
  useEffect(() => {
    function handleKeyPress(e) {
      // Solo si no está en un input/textarea/select
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
        return
      }

      switch(e.key) {
        case 'F2': // Cobrar
          e.preventDefault()
          if (carrito.length > 0 && cajaId && medioPagoId && !procesando) {
            cobrar()
          }
          break
        case 'F4': // Limpiar carrito
          e.preventDefault()
          if (carrito.length > 0) {
            const confirmar = window.confirm('¿Limpiar el carrito?')
            if (confirmar) limpiarCarrito()
          }
          break
        case 'F5': // Efectivo
          e.preventDefault()
          const efectivo = mediosPago.find(m => m.codigo === 'EFECTIVO')
          if (efectivo) setMedioPagoId(efectivo.id)
          break
        case 'F6': // Tarjeta
          e.preventDefault()
          const tarjeta = mediosPago.find(m => m.codigo === 'TARJETA' || m.codigo === 'TARJETA_DEBITO' || m.codigo === 'TARJETA_CREDITO')
          if (tarjeta) setMedioPagoId(tarjeta.id)
          break
        case 'Escape': // Cancelar
          e.preventDefault()
          if (carrito.length > 0) {
            const confirmar = window.confirm('¿Limpiar el carrito?')
            if (confirmar) limpiarCarrito()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [carrito, mediosPago, procesando, cajaId, medioPagoId])

  // Auto-focus ya se maneja con la prop autoFocus de SearchInput

  async function cargarDatos(mantenerCategoria = false) {
    try {
      const [prodRes, catRes, cajasRes, mediosRes] = await Promise.all([
        api.get('/admin/buffet/productos?disponible=true&activo=true&tipoVenta=KIOSCO'),
        api.get('/admin/buffet/categorias?activo=true'),
        api.get('/admin/buffet/config/cajas/kiosco'),
        api.get('/admin/buffet/config/medios-pago/kiosco')
      ])
      const productosData = prodRes.data || prodRes || []
      const categoriasData = catRes.data || catRes || []

      setProductos(productosData)

      // Solo mostrar categorías que tienen productos de kiosco
      const categoriasConProductos = categoriasData.filter(cat =>
        productosData.some(p => p.categoriaMenuId === cat.id)
      )
      setCategorias(categoriasConProductos)

      setCajas(cajasRes.data || cajasRes || [])
      setMediosPago(mediosRes.data || mediosRes || [])

      // Mantener en "Todos" por defecto (categoriaActiva = null)

      // Seleccionar primera caja
      const cajasData = cajasRes.data || cajasRes || []
      if (cajasData.length > 0) {
        setCajaId(cajasData[0].id)
      }

      // Seleccionar efectivo por defecto
      const mediosData = mediosRes.data || mediosRes || []
      const efectivo = mediosData.find(m => m.codigo === 'EFECTIVO')
      if (efectivo) {
        setMedioPagoId(efectivo.id)
      } else if (mediosData.length > 0) {
        setMedioPagoId(mediosData[0].id)
      }
    } catch (err) {
      console.error('Error cargando datos:', err)
      toast.error('Error cargando configuración')
    } finally {
      setLoading(false)
    }
  }

  // Buscar por código de barras o texto
  async function buscarProducto(texto) {
    if (!texto.trim()) return

    setBuscando(true)
    try {
      // Primero intentar búsqueda exacta por código de barras
      const barcodeRes = await api.get(`/admin/buffet/productos/barcode/${texto.trim()}`)
      if (barcodeRes.data || barcodeRes) {
        const producto = barcodeRes.data || barcodeRes
        agregarAlCarrito(producto)
        setBusqueda('')
        toast.success(`${producto.nombre} agregado`)
        return
      }
    } catch {
      // No encontrado por código de barras, buscar por texto
    }

    try {
      const searchRes = await api.get(`/admin/buffet/productos?disponible=true&activo=true&tipoVenta=KIOSCO&busqueda=${encodeURIComponent(texto.trim())}`)
      const resultados = searchRes.data || searchRes || []

      if (resultados.length === 1) {
        // Si solo hay un resultado, agregarlo directamente
        agregarAlCarrito(resultados[0])
        setBusqueda('')
        toast.success(`${resultados[0].nombre} agregado`)
      } else if (resultados.length > 1) {
        // Mostrar los resultados
        setProductos(resultados)
        setCategoriaActiva(null)
        toast(`${resultados.length} productos encontrados`)
      } else {
        toast.error('Producto no encontrado')
      }
    } catch (err) {
      console.error('Error buscando:', err)
      toast.error('Error en la búsqueda')
    } finally {
      setBuscando(false)
    }
  }

  // Manejar entrada rápida de código de barras (detectar escáner)
  function handleBusquedaChange(valor) {
    const ahora = Date.now()
    const tiempoDesdeUltimoInput = ahora - ultimoInputRef.current
    ultimoInputRef.current = ahora

    // Limpiar timeout anterior
    if (barcodeTimeoutRef.current) {
      clearTimeout(barcodeTimeoutRef.current)
    }

    // Si el input es rápido (< 50ms entre caracteres), es probablemente un escáner
    if (tiempoDesdeUltimoInput < 50 && valor.length > 3) {
      barcodeTimeoutRef.current = setTimeout(() => {
        if (valor.length >= 6 && /^[A-Za-z0-9]+$/.test(valor)) {
          buscarProducto(valor)
        }
      }, 100)
    }
  }

  function handleEnterBusqueda() {
    // Limpiar timeout si existe
    if (barcodeTimeoutRef.current) {
      clearTimeout(barcodeTimeoutRef.current)
      barcodeTimeoutRef.current = null
    }
    buscarProducto(busqueda)
  }

  function limpiarBusqueda() {
    setBusqueda('')
    cargarDatos(true)
  }

  function agregarAlCarrito(producto) {
    // Reproducir sonido al agregar
    playSound('scan')

    setCarrito(prev => {
      const existe = prev.find(item => item.id === producto.id)
      if (existe) {
        return prev.map(item =>
          item.id === producto.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        )
      }
      return [...prev, { ...producto, cantidad: 1 }]
    })
  }

  function modificarCantidad(productoId, delta) {
    setCarrito(prev => {
      return prev
        .map(item => {
          if (item.id === productoId) {
            const nuevaCantidad = item.cantidad + delta
            return nuevaCantidad > 0 ? { ...item, cantidad: nuevaCantidad } : null
          }
          return item
        })
        .filter(Boolean)
    })
  }

  function limpiarCarrito() {
    setCarrito([])
  }

  const total = carrito.reduce((sum, item) => sum + Number(item.precio) * item.cantidad, 0)

  async function cobrar() {
    if (carrito.length === 0) return
    if (!cajaId || !medioPagoId) {
      toast.error('Selecciona caja y medio de pago')
      return
    }

    // Validar pago suficiente solo si es efectivo
    const medioPagoSeleccionado = mediosPago.find(m => m.id === parseInt(medioPagoId))
    if (medioPagoSeleccionado?.codigo === 'EFECTIVO' && !datosVuelto.esSuficiente) {
      toast.error('El monto pagado es insuficiente')
      return
    }

    // Reproducir sonido de éxito
    playSound('success')

    setProcesando(true)
    try {
      const items = carrito.map(item => ({
        productoBuffetId: item.id,
        cantidad: item.cantidad
      }))

      const res = await api.post('/admin/buffet/kiosco/venta', {
        items,
        cajaId: parseInt(cajaId),
        medioPagoId: parseInt(medioPagoId)
      })

      // Generar y mostrar ticket
      const ticketData = generarTicketKiosco({
        numero: res.data?.numero || res?.numero || `K${Date.now()}`,
        items: carrito.map(item => ({
          cantidad: item.cantidad,
          nombre: item.nombre,
          precio: Number(item.precio)
        })),
        subtotal: total,
        total: total,
        medioPagoNombre: medioPagoSeleccionado?.nombre || 'Efectivo',
        montoPagado: datosVuelto.montoPagado,
        vuelto: datosVuelto.vuelto
      })
      await imprimirTicket(ticketData)

      // Guardar en historial de últimas ventas
      setUltimasVentas(prev => [{
        id: res.data?.id || Date.now(),
        numero: res.data?.numero || `K${Date.now()}`,
        fecha: new Date(),
        total: total,
        items: carrito.length
      }, ...prev.slice(0, 9)]) // Mantener solo las últimas 10

      toast.success(`Venta registrada: $${total.toLocaleString()}`)
      limpiarCarrito()
      setDatosVuelto({ montoPagado: 0, vuelto: 0, esSuficiente: false })

      // Volver al tab carrito y hacer focus en el search input
      setTabActivo('carrito')
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus()
        }
      }, 100)
    } catch (err) {
      playSound('error')
      console.error('Error en venta:', err)
      toast.error(err.response?.data?.error || 'Error al procesar venta')
    } finally {
      setProcesando(false)
    }
  }

  // Función para reproducir sonidos (opcional)
  const playSound = (type) => {
    try {
      const sounds = {
        success: '/sounds/beep-success.mp3',
        error: '/sounds/beep-error.mp3',
        scan: '/sounds/beep-scan.mp3'
      }
      const audio = new Audio(sounds[type])
      audio.volume = 0.3
      audio.play().catch(() => {}) // Ignorar si falla
    } catch (error) {
      // Silenciar errores de audio
    }
  }

  const productosFiltrados = categoriaActiva
    ? productos.filter(p => p.categoriaMenuId === categoriaActiva)
    : productos

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-100px)]">
      {/* Panel Izquierdo - Productos */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Barra de búsqueda + Notificaciones */}
        <div className="p-4 bg-white border-b flex items-center gap-4">
          <div className="relative flex-1 flex items-center gap-2">
            <Barcode className="text-gray-400 flex-shrink-0" size={24} />
            <div className="flex-1">
              <SearchInput
                ref={searchInputRef}
                value={busqueda}
                onChange={setBusqueda}
                onImmediateChange={handleBusquedaChange}
                onEnter={handleEnterBusqueda}
                onClear={limpiarBusqueda}
                placeholder="Escanear código de barras o buscar producto..."
                autoFocus={true}
                debounceMs={0}
                className="text-lg"
              />
            </div>
            <button
              onClick={() => buscarProducto(busqueda)}
              disabled={!busqueda || buscando}
              className="p-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex-shrink-0"
            >
              <Search size={20} />
            </button>
          </div>
          <NotificacionBuffet />

          {/* Botón últimas ventas */}
          <button
            onClick={() => setMostrarUltimasVentas(!mostrarUltimasVentas)}
            className="p-2 hover:bg-gray-100 rounded-lg relative transition"
            title="Últimas ventas"
          >
            <FileText size={20} />
            {ultimasVentas.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {ultimasVentas.length}
              </span>
            )}
          </button>
        </div>

        {/* Categorías */}
        <div className="flex gap-2 p-4 bg-white border-b overflow-x-auto">
          <button
            onClick={() => setCategoriaActiva(null)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition-colors ${
              categoriaActiva === null
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todos
          </button>
          {categorias.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategoriaActiva(cat.id)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition-colors ${
                categoriaActiva === cat.id
                  ? 'text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              style={categoriaActiva === cat.id ? { backgroundColor: cat.color || '#DC2626' } : {}}
            >
              {cat.nombre}
            </button>
          ))}
        </div>

        {/* Grid de Productos */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-100">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {productosFiltrados.map(prod => {
              const sinStock = prod.stock !== undefined && prod.stock === 0
              const stockBajo = prod.stock !== undefined && prod.stock > 0 && prod.stock <= 5

              return (
                <button
                  key={prod.id}
                  onClick={() => agregarAlCarrito(prod)}
                  disabled={sinStock}
                  className={`bg-white rounded-lg p-3 text-left hover:shadow-lg transition-all border-2 border-transparent hover:border-red-500 hover:scale-[1.02] flex gap-3 ${
                    sinStock ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {prod.imagen ? (
                    <img
                      src={prod.imagen}
                      alt={prod.nombre}
                      className="w-14 h-14 object-cover rounded-lg flex-shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center">
                      <Coffee size={24} className="text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm line-clamp-2 leading-tight">{prod.nombre}</h3>
                    {prod.codigoBarras && (
                      <p className="text-xs text-gray-400 truncate">{prod.codigoBarras}</p>
                    )}
                    <p className="text-base font-bold text-green-600 mt-1">
                      ${Number(prod.precio).toLocaleString()}
                    </p>

                    {/* Badge de stock */}
                    {prod.stock !== undefined && (
                      <div className="mt-1">
                        {sinStock ? (
                          <span className="inline-block text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">
                            Sin stock
                          </span>
                        ) : stockBajo ? (
                          <span className="inline-block text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-medium">
                            Quedan {prod.stock}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {productosFiltrados.length === 0 && (
            <div className="flex items-center justify-center h-48 text-gray-500">
              No hay productos {categoriaActiva ? 'en esta categoría' : 'disponibles'}
            </div>
          )}
        </div>
      </div>

      {/* Panel Derecho - Carrito con Tabs - Ancho dinámico */}
      <div className={`bg-white border-l flex flex-col transition-all duration-300 ${
        tabActivo === 'finalizar' ? 'w-[480px]' : 'w-96'
      }`}>
        {/* Tabs Navigation */}
        <div className="flex border-b">
          <button
            onClick={() => setTabActivo('carrito')}
            className={`flex-1 px-4 py-3 font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
              tabActivo === 'carrito'
                ? 'bg-white text-red-600 border-b-2 border-red-600'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ShoppingCart size={18} />
            Carrito
            {carrito.length > 0 && (
              <span className="bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {carrito.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTabActivo('finalizar')}
            className={`flex-1 px-4 py-3 font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
              tabActivo === 'finalizar'
                ? 'bg-white text-green-600 border-b-2 border-green-600'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <DollarSign size={18} />
            Finalizar
          </button>
        </div>

        {/* Tab Content: Carrito */}
        {tabActivo === 'carrito' && (
          <>
            <div className="p-4 border-b bg-gray-50">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700">
                  Items en la venta
                </h3>
                {carrito.length > 0 && (
                  <button
                    onClick={limpiarCarrito}
                    className="text-red-600 text-sm hover:underline font-medium"
                  >
                    Limpiar todo
                  </button>
                )}
              </div>
            </div>

            {/* Items del carrito */}
            <div className="flex-1 overflow-y-auto p-4">
              {carrito.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <Coffee size={48} className="mb-2" />
                  <p>Carrito vacío</p>
                  <p className="text-sm">Escanea o selecciona productos</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {carrito.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{item.nombre}</h4>
                        <p className="text-green-600 font-bold">
                          ${Number(item.precio).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => modificarCantidad(item.id, -1)}
                          className="p-1 bg-gray-200 rounded hover:bg-gray-300 active:scale-95 transition"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="w-8 text-center font-bold">{item.cantidad}</span>
                        <button
                          onClick={() => modificarCantidad(item.id, 1)}
                          className="p-1 bg-gray-200 rounded hover:bg-gray-300 active:scale-95 transition"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      <div className="w-20 text-right font-bold">
                        ${(Number(item.precio) * item.cantidad).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Subtotal en carrito */}
            <div className="border-t p-4 bg-gray-50">
              <div className="flex items-center justify-between">
                <span className="text-base font-medium text-gray-700">Subtotal:</span>
                <span className="text-2xl font-bold text-gray-900 tabular-nums">
                  ${total.toLocaleString()}
                </span>
              </div>
              {carrito.length > 0 && (
                <button
                  onClick={() => setTabActivo('finalizar')}
                  className="w-full mt-3 px-4 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  Continuar al Pago
                  <DollarSign size={18} />
                </button>
              )}
            </div>
          </>
        )}

        {/* Tab Content: Finalizar */}
        {tabActivo === 'finalizar' && (
          <>
            <div className="px-3 py-2 border-b bg-green-50 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700">
                  Cobro de venta
                </h3>
                <button
                  onClick={() => setTabActivo('carrito')}
                  className="text-blue-600 text-xs hover:underline font-medium"
                >
                  ← Volver al carrito
                </button>
              </div>
            </div>

            {carrito.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <ShoppingCart size={48} className="mb-2" />
                <p>No hay items en el carrito</p>
                <p className="text-sm">Agrega productos para continuar</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {/* Total destacado - Más compacto */}
                <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-3 border-2 border-green-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-700">Total a Cobrar:</span>
                    <span className="text-3xl font-bold text-green-600 tabular-nums">
                      ${total.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">{carrito.length} {carrito.length === 1 ? 'item' : 'items'}</p>
                </div>

                {/* Selección de caja - Más compacto */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Caja:</label>
                  <select
                    value={cajaId}
                    onChange={e => setCajaId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-200 outline-none"
                  >
                    <option value="">Seleccionar caja...</option>
                    {cajas.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* Selector de medio de pago VISUAL - Más compacto */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Medio de Pago:</label>
                  <SelectorMedioPago
                    mediosPago={mediosPago}
                    selectedId={medioPagoId}
                    onChange={setMedioPagoId}
                    compact={true}
                  />
                </div>

                {/* Calculadora de vuelto (solo si es efectivo) */}
                <CalculadoraVuelto
                  total={total}
                  onVueltoCalculado={setDatosVuelto}
                  medioPagoSeleccionado={mediosPago.find(m => m.id === medioPagoId)}
                  showTeclado={true}
                  autoFocus={false}
                  compact={true}
                />
              </div>
            )}

            {/* Footer - Botón de cobro - Más compacto */}
            <div className="border-t p-3 space-y-2 flex-shrink-0">
              {/* Botón de cobro */}
              <button
                onClick={cobrar}
                disabled={carrito.length === 0 || procesando || !cajaId || !medioPagoId}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white font-bold text-base rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
              >
                {procesando ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Procesando...
                  </>
                ) : (
                  <>
                    <DollarSign size={20} />
                    COBRAR ${total.toLocaleString()}
                  </>
                )}
              </button>

              {/* Atajos de teclado (hints) */}
              <div className="text-xs text-gray-500 flex flex-wrap gap-2 justify-center pt-1 border-t">
                <span><kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">F2</kbd> Cobrar</span>
                <span><kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">F4</kbd> Limpiar</span>
                <span><kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">F5</kbd> Efectivo</span>
                <span><kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">ESC</kbd> Cancelar</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Panel de últimas ventas (deslizable) */}
      {mostrarUltimasVentas && (
        <div className="absolute right-0 top-0 h-full w-80 bg-white border-l shadow-2xl z-50 flex flex-col animate-slide-in">
          <div className="p-4 border-b flex justify-between items-center bg-gray-50">
            <h3 className="font-bold text-lg">Últimas Ventas</h3>
            <button
              onClick={() => setMostrarUltimasVentas(false)}
              className="p-1 hover:bg-gray-200 rounded transition"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {ultimasVentas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <FileText size={48} className="mb-2" />
                <p className="text-sm">No hay ventas recientes</p>
              </div>
            ) : (
              ultimasVentas.map(venta => (
                <div
                  key={venta.id}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium">Venta #{venta.numero}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(venta.fecha).toLocaleTimeString('es-AR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">{venta.items} items</p>
                    </div>
                    <p className="font-bold text-green-600 tabular-nums">
                      ${venta.total.toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      toast.info('Reimprimiendo ticket...')
                      // Aquí iría la lógica de reimpresión si se implementa
                    }}
                    className="mt-2 text-xs text-blue-600 hover:underline w-full text-left"
                  >
                    Reimprimir ticket
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
