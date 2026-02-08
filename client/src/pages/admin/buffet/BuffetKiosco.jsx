import { useState, useEffect, useRef, useCallback } from 'react'
import { Coffee, Plus, Minus, DollarSign, ShoppingCart, Search, X, Barcode, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../services/api'
import { useTicket } from '../../../contexts/TicketContext'
import NotificacionBuffet from '../../../components/buffet/NotificacionBuffet'

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
  const inputBusquedaRef = useRef(null)
  const ultimoInputRef = useRef(Date.now())
  const barcodeBufferRef = useRef('')
  const barcodeTimeoutRef = useRef(null)
  const [ultimoNumeroVenta, setUltimoNumeroVenta] = useState(null)

  useEffect(() => {
    cargarDatos()
  }, [])

  // Auto-focus en el campo de búsqueda para escaneo de código de barras
  useEffect(() => {
    if (inputBusquedaRef.current) {
      inputBusquedaRef.current.focus()
    }
  }, [])

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

  function handleBusquedaKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      // Limpiar timeout si existe
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current)
        barcodeTimeoutRef.current = null
      }
      buscarProducto(busqueda)
    }
  }

  // Detectar entrada rápida de código de barras
  function handleBusquedaChange(e) {
    const valor = e.target.value
    const ahora = Date.now()
    const tiempoDesdeUltimoInput = ahora - ultimoInputRef.current
    ultimoInputRef.current = ahora

    setBusqueda(valor)

    // Limpiar timeout anterior
    if (barcodeTimeoutRef.current) {
      clearTimeout(barcodeTimeoutRef.current)
    }

    // Si el input es rápido (< 50ms entre caracteres), es probablemente un escáner
    // Los escáneres típicamente envían caracteres muy rápido
    if (tiempoDesdeUltimoInput < 50 && valor.length > 3) {
      // Esperar un momento para ver si hay más caracteres
      barcodeTimeoutRef.current = setTimeout(() => {
        // Si el valor parece un código de barras (solo números o alfanumérico sin espacios)
        if (valor.length >= 6 && /^[A-Za-z0-9]+$/.test(valor)) {
          buscarProducto(valor)
        }
      }, 100)
    }
  }

  function limpiarBusqueda() {
    setBusqueda('')
    cargarDatos(true)
  }

  function agregarAlCarrito(producto) {
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

      const medioPagoSeleccionado = mediosPago.find(m => m.id === parseInt(medioPagoId))

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
        medioPagoNombre: medioPagoSeleccionado?.nombre || 'Efectivo'
      })
      await imprimirTicket(ticketData)

      toast.success(`Venta registrada: $${total.toLocaleString()}`)
      limpiarCarrito()
      // Refocus para siguiente escaneo
      if (inputBusquedaRef.current) {
        inputBusquedaRef.current.focus()
      }
    } catch (err) {
      console.error('Error en venta:', err)
      toast.error(err.response?.data?.error || 'Error al procesar venta')
    } finally {
      setProcesando(false)
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
          <div className="relative flex-1">
            <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              ref={inputBusquedaRef}
              type="text"
              value={busqueda}
              onChange={handleBusquedaChange}
              onKeyDown={handleBusquedaKeyDown}
              placeholder="Escanear código de barras o buscar producto..."
              className="w-full pl-10 pr-20 py-3 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              autoComplete="off"
            />
            {busqueda && (
              <button
                onClick={limpiarBusqueda}
                className="absolute right-12 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            )}
            <button
              onClick={() => buscarProducto(busqueda)}
              disabled={!busqueda || buscando}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              <Search size={20} />
            </button>
          </div>
          <NotificacionBuffet />
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
            {productosFiltrados.map(prod => (
              <button
                key={prod.id}
                onClick={() => agregarAlCarrito(prod)}
                className="bg-white rounded-lg p-3 text-left hover:shadow-lg transition-all border-2 border-transparent hover:border-red-500 hover:scale-[1.02] flex gap-3"
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
                </div>
              </button>
            ))}
          </div>

          {productosFiltrados.length === 0 && (
            <div className="flex items-center justify-center h-48 text-gray-500">
              No hay productos {categoriaActiva ? 'en esta categoría' : 'disponibles'}
            </div>
          )}
        </div>
      </div>

      {/* Panel Derecho - Carrito */}
      <div className="w-96 bg-white border-l flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <ShoppingCart size={20} />
              Venta Rápida
            </h2>
            {carrito.length > 0 && (
              <button
                onClick={limpiarCarrito}
                className="text-red-600 text-sm hover:underline"
              >
                Limpiar
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
                      className="p-1 bg-gray-200 rounded hover:bg-gray-300"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="w-8 text-center font-bold">{item.cantidad}</span>
                    <button
                      onClick={() => modificarCantidad(item.id, 1)}
                      className="p-1 bg-gray-200 rounded hover:bg-gray-300"
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

        {/* Footer - Cobro */}
        <div className="border-t p-4 space-y-4">
          {/* Selección de caja y medio de pago */}
          <div className="grid grid-cols-2 gap-2">
            <select
              value={cajaId}
              onChange={e => setCajaId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Caja</option>
              {cajas.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
            <select
              value={medioPagoId}
              onChange={e => setMedioPagoId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Medio de pago</option>
              {mediosPago.map(m => (
                <option key={m.id} value={m.id}>{m.nombre}</option>
              ))}
            </select>
          </div>

          {/* Total y botón de cobro */}
          <div className="flex items-center justify-between py-3 border-t">
            <span className="text-lg font-bold">Total:</span>
            <span className="text-2xl font-bold text-green-600">
              ${total.toLocaleString()}
            </span>
          </div>

          <button
            onClick={cobrar}
            disabled={carrito.length === 0 || procesando}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-green-600 text-white font-bold text-lg rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {procesando ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Procesando...
              </>
            ) : (
              <>
                <DollarSign size={24} />
                COBRAR ${total.toLocaleString()}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
