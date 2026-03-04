import { useState, useEffect, useRef, useCallback } from 'react'
import { Coffee, Plus, Minus, DollarSign, ShoppingCart, Search, X, Barcode, FileText, LayoutGrid, List, Receipt } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../services/api'
import { useTicket } from '../../../contexts/TicketContext'
import { useConfirm } from '../../../hooks/useConfirm.jsx'
import NotificacionBuffet from '../../../components/buffet/NotificacionBuffet'
import SearchInput from '../../../components/SearchInput'
import CalculadoraVuelto from '../../../components/buffet/CalculadoraVuelto'
import SelectorMedioPago from '../../../components/buffet/SelectorMedioPago'
import ClienteSelector from '../../../components/buffet/ClienteSelector'

export default function BuffetKiosco() {
  const { generarTicketKiosco, generarTicketFiscal, imprimirTicket } = useTicket()
  const { confirm, ConfirmDialog } = useConfirm()
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
  const [cantidadAgregar, setCantidadAgregar] = useState(1)
  const [vistaProductos, setVistaProductos] = useState(() => {
    return localStorage.getItem('kioscoVistaProductos') || 'shop'
  })
  const [mostrarCarritoMobile, setMostrarCarritoMobile] = useState(false)

  // Facturación
  const [tipoComprobante, setTipoComprobante] = useState('interno') // 'interno', 'facturaB', 'facturaC'
  const [configFiscal, setConfigFiscal] = useState(null)
  // Cliente seleccionado para MovimientoContable
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null)
  const [datosCliente, setDatosCliente] = useState({
    tipoDoc: 99,
    documento: '',
    nombre: '',
    condicionIva: 5
  })

  useEffect(() => {
    cargarDatos()
  }, [])

  useEffect(() => {
    localStorage.setItem('kioscoVistaProductos', vistaProductos)
  }, [vistaProductos])

  // Atajos de teclado
  useEffect(() => {
    function handleKeyPress(e) {
      // Permitir Enter en inputs para cobrar
      if (e.key === 'Enter' && e.target.tagName === 'INPUT' && tabActivo === 'finalizar') {
        e.preventDefault()
        if (carrito.length > 0 && cajaId && medioPagoId && !procesando) {
          const medioPagoSeleccionado = mediosPago.find(m => m.id === parseInt(medioPagoId))
          if (medioPagoSeleccionado?.codigo !== 'EFECTIVO' || datosVuelto.esSuficiente) {
            cobrar()
          }
        }
        return
      }

      // Permitir ESC siempre para volver
      if (e.key === 'Escape') {
        e.preventDefault()
        if (tabActivo === 'finalizar') {
          setTabActivo('carrito')
          // Hacer focus en el search input después de volver
          setTimeout(() => {
            if (searchInputRef.current) {
              searchInputRef.current.focus()
            }
          }, 100)
        } else if (carrito.length > 0) {
          confirm('¿Limpiar el carrito?', 'Se eliminarán todos los productos del carrito', { variant: 'warning', confirmText: 'Limpiar' })
            .then(confirmar => { if (confirmar) limpiarCarrito() })
        }
        return
      }

      // Solo procesar otros atajos si NO está en un input/textarea/select
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
        return
      }

      switch(e.key) {
        case 'F2': // Ir a cobrar / Cobrar
          e.preventDefault()
          if (carrito.length === 0) {
            toast.error('El carrito está vacío')
            return
          }
          if (!cajaId || !medioPagoId) {
            toast.error('Selecciona caja y medio de pago')
            return
          }

          // Si está en carrito, ir al tab finalizar
          if (tabActivo === 'carrito') {
            setTabActivo('finalizar')
            toast.info('Presiona F2 nuevamente para cobrar')
          } else {
            // Si ya está en finalizar, cobrar directamente
            const medioPagoSeleccionado = mediosPago.find(m => m.id === parseInt(medioPagoId))
            if (medioPagoSeleccionado?.codigo === 'EFECTIVO' && !datosVuelto.esSuficiente) {
              toast.error('El monto pagado es insuficiente')
            } else {
              cobrar()
            }
          }
          break
        case 'F4': // Limpiar carrito
          e.preventDefault()
          if (carrito.length > 0) {
            confirm('¿Limpiar el carrito?', 'Se eliminarán todos los productos del carrito', { variant: 'warning', confirmText: 'Limpiar' })
              .then(confirmar => {
                if (confirmar) {
                  limpiarCarrito()
                  setTabActivo('carrito')
                }
              })
          }
          break
        case 'F5': // Efectivo
          e.preventDefault()
          const efectivo = mediosPago.find(m => m.codigo === 'EFECTIVO')
          if (efectivo) {
            setMedioPagoId(efectivo.id)
            toast.success('Medio de pago: Efectivo')
          }
          break
        case 'F6': // Tarjeta
          e.preventDefault()
          const tarjeta = mediosPago.find(m => m.codigo === 'TARJETA' || m.codigo === 'TARJETA_DEBITO' || m.codigo === 'TARJETA_CREDITO')
          if (tarjeta) {
            setMedioPagoId(tarjeta.id)
            toast.success('Medio de pago: Tarjeta')
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [carrito, mediosPago, procesando, cajaId, medioPagoId, tabActivo, datosVuelto])

  // Auto-focus ya se maneja con la prop autoFocus de SearchInput

  async function cargarDatos(mantenerCategoria = false) {
    try {
      const [prodRes, catRes, cajasRes, mediosRes, configRes] = await Promise.all([
        api.get('/admin/buffet/productos?disponible=true&activo=true&tipoVenta=KIOSCO'),
        api.get('/admin/buffet/categorias?activo=true'),
        api.get('/admin/buffet/config/cajas/kiosco'),
        api.get('/admin/buffet/config/medios-pago/kiosco'),
        api.get('/admin/facturacion/config').catch(() => null)
      ])

      // Configuración fiscal
      const configData = configRes?.data || configRes
      if (configData && configData.certificadoPath) {
        setConfigFiscal(configData)
      }
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

    const cantidad = parseInt(cantidadAgregar) || 1

    setCarrito(prev => {
      const existe = prev.find(item => item.id === producto.id)
      if (existe) {
        return prev.map(item =>
          item.id === producto.id
            ? { ...item, cantidad: item.cantidad + cantidad }
            : item
        )
      }
      return [...prev, { ...producto, cantidad }]
    })

    // Resetear cantidad a 1 después de agregar
    setCantidadAgregar(1)
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

  function cambiarCantidadDirecta(productoId, nuevaCantidad) {
    const cantidad = parseInt(nuevaCantidad)
    if (isNaN(cantidad) || cantidad < 1) {
      // Si es inválido o menor a 1, eliminar del carrito
      setCarrito(prev => prev.filter(item => item.id !== productoId))
      return
    }

    setCarrito(prev => {
      return prev.map(item => {
        if (item.id === productoId) {
          return { ...item, cantidad }
        }
        return item
      })
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

      // Preparar datos de facturación
      const datosVenta = {
        items,
        cajaId: parseInt(cajaId),
        medioPagoId: parseInt(medioPagoId)
      }

      // Si se solicita factura
      if (tipoComprobante !== 'interno' && configFiscal) {
        datosVenta.emitirFactura = true
        datosVenta.tipoComprobante = tipoComprobante === 'facturaB' ? 6 : 11 // 6=FB, 11=FC
        datosVenta.datosCliente = clienteSeleccionado ? {
          tipoDoc: clienteSeleccionado.tipoDoc || 99,
          documento: clienteSeleccionado.documento || '',
          nombre: clienteSeleccionado.nombre || 'Consumidor Final',
          condicionIva: clienteSeleccionado.condicionIva || 5
        } : {
          tipoDoc: 99,
          documento: '',
          nombre: 'Consumidor Final',
          condicionIva: 5
        }
        // Agregar cliente seleccionado para MovimientoContable
        if (clienteSeleccionado) {
          datosVenta.clienteId = clienteSeleccionado.id
          datosVenta.tipoCliente = clienteSeleccionado.tipo
        }
      } else {
        datosVenta.esVentaInterna = true
      }

      const res = await api.post('/admin/buffet/kiosco/venta', datosVenta)
      const responseData = res.data?.data || res.data || res

      // Determinar si se emitió factura fiscal y si hay ticket pre-generado
      const comprobanteRecibido = responseData.comprobante
      const ticketPreGenerado = responseData.ticket // Ticket ESC/POS en base64 con QR incluido
      const esFiscal = comprobanteRecibido && comprobanteRecibido.cae

      if (esFiscal && ticketPreGenerado) {
        // Usar el ticket pre-generado del backend (ya tiene QR incluido)
        try {
          const printRes = await api.postFull('/admin/buffet/imprimir-ticket-directo', {
            ticketBase64: ticketPreGenerado,
            tipoTicket: 'KIOSCO'
          })
          if (printRes?.success) {
            toast.success(`Ticket enviado a ${printRes.impresora || 'impresora'}`)
          } else {
            toast.error(printRes?.error || 'Error al imprimir ticket')
          }
        } catch (printErr) {
          console.error('Error imprimiendo ticket fiscal:', printErr)
          toast.error('Error al enviar ticket a impresora')
        }
      } else {
        // Ticket NO fiscal - usar el flujo normal
        const ticketData = generarTicketKiosco({
          numero: responseData.numero || `K${Date.now()}`,
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
      }

      // Guardar en historial de últimas ventas
      setUltimasVentas(prev => [{
        id: responseData.id || Date.now(),
        numero: responseData.numero || `K${Date.now()}`,
        fecha: new Date(),
        total: total,
        items: carrito.length,
        esFiscal: esFiscal
      }, ...prev.slice(0, 9)]) // Mantener solo las últimas 10

      toast.success(`Venta registrada: $${total.toLocaleString()}`)
      limpiarCarrito()
      setDatosVuelto({ montoPagado: 0, vuelto: 0, esSuficiente: false })
      setClienteSeleccionado(null)
      setTipoComprobante('interno')

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
    <div className="flex h-[calc(100vh-100px)] relative">
      {/* Panel Izquierdo - Productos */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Barra de búsqueda + Notificaciones - Desktop */}
        <div className="hidden md:flex p-4 bg-white border-b items-center gap-3">
          {/* Campo de Cantidad */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Cant:</label>
            <input
              type="number"
              min="1"
              value={cantidadAgregar}
              onChange={(e) => setCantidadAgregar(Math.max(1, parseInt(e.target.value) || 1))}
              onFocus={(e) => e.target.select()}
              className="w-16 text-center text-lg font-bold border-2 border-gray-300 rounded-lg px-2 py-2.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
              title="Cantidad a agregar (usar +/- para modificar)"
            />
          </div>

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

          {/* Toggle Vista */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setVistaProductos('shop')}
              className={`p-2 rounded-md transition ${vistaProductos === 'shop' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              title="Vista Tarjetas"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setVistaProductos('lista')}
              className={`p-2 rounded-md transition ${vistaProductos === 'lista' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              title="Vista Lista"
            >
              <List className="w-5 h-5" />
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

        {/* Barra de búsqueda - Mobile */}
        <div className="md:hidden p-3 bg-white border-b space-y-2">
          {/* Fila 1: Búsqueda */}
          <div className="flex items-center gap-2">
            <Barcode className="text-gray-400 flex-shrink-0" size={20} />
            <div className="flex-1">
              <SearchInput
                value={busqueda}
                onChange={setBusqueda}
                onImmediateChange={handleBusquedaChange}
                onEnter={handleEnterBusqueda}
                onClear={limpiarBusqueda}
                placeholder="Buscar producto..."
                autoFocus={false}
                debounceMs={0}
                className="text-base"
              />
            </div>
            <button
              onClick={() => buscarProducto(busqueda)}
              disabled={!busqueda || buscando}
              className="p-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex-shrink-0"
            >
              <Search size={18} />
            </button>
          </div>

          {/* Fila 2: Cantidad + Vista + Notificaciones */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600">Cant:</label>
              <input
                type="number"
                min="1"
                value={cantidadAgregar}
                onChange={(e) => setCantidadAgregar(Math.max(1, parseInt(e.target.value) || 1))}
                onFocus={(e) => e.target.select()}
                className="w-14 text-center text-base font-bold border-2 border-gray-300 rounded-lg px-1 py-1.5 focus:border-blue-500 outline-none"
              />
            </div>

            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setVistaProductos('shop')}
                className={`p-1.5 rounded-md transition ${vistaProductos === 'shop' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setVistaProductos('lista')}
                className={`p-1.5 rounded-md transition ${vistaProductos === 'lista' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-1">
              <NotificacionBuffet />
              <button
                onClick={() => setMostrarUltimasVentas(!mostrarUltimasVentas)}
                className="p-1.5 hover:bg-gray-100 rounded-lg relative transition"
              >
                <FileText size={18} />
                {ultimasVentas.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                    {ultimasVentas.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Categorías - Ocultas en Kiosco */}

        {/* Grid/Lista de Productos */}
        <div className="flex-1 overflow-y-auto p-2 md:p-4 bg-gray-100 pb-20 md:pb-4">
          {vistaProductos === 'shop' ? (
            /* Vista Shop - Tarjetas */
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-4">
              {productosFiltrados.map(prod => {
                const sinStock = prod.stock !== undefined && prod.stock === 0
                const stockBajo = prod.stock !== undefined && prod.stock > 0 && prod.stock <= 5

                return (
                  <button
                    key={prod.id}
                    onClick={() => agregarAlCarrito(prod)}
                    disabled={sinStock}
                    className={`bg-white rounded-lg p-2 md:p-4 text-left hover:shadow-lg transition-all border-2 border-transparent hover:border-red-500 active:scale-95 md:hover:scale-[1.02] flex flex-col md:flex-row gap-2 md:gap-4 ${
                      sinStock ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {/* Imagen - más pequeña en mobile */}
                    {prod.imagen ? (
                      <img
                        src={prod.imagen}
                        alt={prod.nombre}
                        className="w-full h-20 md:w-20 md:h-20 object-cover rounded-lg flex-shrink-0"
                      />
                    ) : (
                      <div className="w-full h-20 md:w-20 md:h-20 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center">
                        <Coffee size={24} className="text-gray-400 md:w-8 md:h-8" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-xs md:text-base line-clamp-2 leading-snug">{prod.nombre}</h3>
                      {prod.codigoBarras && (
                        <p className="text-[10px] md:text-xs text-gray-400 truncate mt-0.5 md:mt-1 hidden md:block">{prod.codigoBarras}</p>
                      )}
                      <p className="text-sm md:text-lg font-bold text-green-600 mt-1 md:mt-1.5">
                        ${Number(prod.precio).toLocaleString()}
                      </p>

                      {/* Badge de stock */}
                      {prod.stock !== undefined && (
                        <div className="mt-1 md:mt-1.5">
                          {sinStock ? (
                            <span className="inline-block text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">
                              Sin stock
                            </span>
                        ) : stockBajo ? (
                          <span className="inline-block text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-medium">
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
          ) : (
            /* Vista Lista - Tabla */
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                      Foto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Producto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                      Código
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                      Stock
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Precio
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {productosFiltrados.map(prod => {
                    const sinStock = prod.stock !== undefined && prod.stock === 0
                    const stockBajo = prod.stock !== undefined && prod.stock > 0 && prod.stock <= 5

                    return (
                      <tr
                        key={prod.id}
                        onClick={() => !sinStock && agregarAlCarrito(prod)}
                        className={`transition-colors ${
                          sinStock
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:bg-gray-100 cursor-pointer'
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="w-12 h-12 rounded bg-gray-100 overflow-hidden">
                            {prod.imagen ? (
                              <img
                                src={prod.imagen}
                                alt={prod.nombre}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Coffee className="w-6 h-6 text-gray-300" />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="font-medium text-gray-800">{prod.nombre}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono hidden sm:table-cell">
                          {prod.codigoBarras || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center hidden md:table-cell">
                          {prod.stock !== undefined ? (
                            sinStock ? (
                              <span className="inline-block text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">
                                Sin stock
                              </span>
                            ) : stockBajo ? (
                              <span className="inline-block text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-medium">
                                {prod.stock}
                              </span>
                            ) : (
                              <span className="text-gray-800 font-semibold">{prod.stock}</span>
                            )
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-lg font-bold text-green-600">
                            ${Number(prod.precio).toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {productosFiltrados.length === 0 && (
            <div className="flex items-center justify-center h-48 text-gray-500">
              No hay productos {categoriaActiva ? 'en esta categoría' : 'disponibles'}
            </div>
          )}
        </div>
      </div>

      {/* Botón flotante carrito - Mobile */}
      {carrito.length > 0 && !mostrarCarritoMobile && (
        <button
          onClick={() => setMostrarCarritoMobile(true)}
          className="md:hidden fixed bottom-4 right-4 z-40 flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700 active:scale-95 transition-all"
        >
          <ShoppingCart size={20} />
          <span className="font-bold">${total.toLocaleString()}</span>
          <span className="bg-white text-green-600 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {carrito.reduce((sum, item) => sum + item.cantidad, 0)}
          </span>
        </button>
      )}

      {/* Overlay del carrito - Mobile */}
      {mostrarCarritoMobile && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setMostrarCarritoMobile(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[85vh] flex flex-col animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle para cerrar */}
            <div className="flex justify-center py-2">
              <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
            </div>

            {/* Header del drawer */}
            <div className="flex items-center justify-between px-4 pb-3 border-b">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <ShoppingCart size={20} />
                Carrito
                {carrito.length > 0 && (
                  <span className="bg-red-600 text-white text-xs font-bold rounded-full px-2 py-0.5">
                    {carrito.reduce((sum, item) => sum + item.cantidad, 0)} items
                  </span>
                )}
              </h3>
              <button
                onClick={() => setMostrarCarritoMobile(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* Items del carrito - Mobile */}
            <div className="flex-1 overflow-y-auto p-4 max-h-[40vh]">
              {carrito.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <Coffee size={48} className="mb-2" />
                  <p>Carrito vacío</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {carrito.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">{item.nombre}</h4>
                        <p className="text-green-600 font-bold text-sm">
                          ${Number(item.precio).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => modificarCantidad(item.id, -1)}
                          className="p-1.5 bg-gray-200 rounded-lg hover:bg-gray-300 active:scale-95"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-8 text-center font-bold text-sm">{item.cantidad}</span>
                        <button
                          onClick={() => modificarCantidad(item.id, 1)}
                          className="p-1.5 bg-gray-200 rounded-lg hover:bg-gray-300 active:scale-95"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <div className="w-16 text-right font-bold text-sm">
                        ${(Number(item.precio) * item.cantidad).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Opciones de pago - Mobile */}
            {carrito.length > 0 && (
              <div className="border-t p-4 space-y-3 bg-gray-50">
                {/* Total */}
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold">Total:</span>
                  <span className="text-2xl font-bold text-green-600">${total.toLocaleString()}</span>
                </div>

                {/* Selector medio de pago compacto */}
                <SelectorMedioPago
                  mediosPago={mediosPago}
                  selectedId={medioPagoId}
                  onChange={setMedioPagoId}
                  compact={true}
                />

                {/* Botones de acción */}
                <div className="flex gap-2">
                  <button
                    onClick={limpiarCarrito}
                    className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300"
                  >
                    Limpiar
                  </button>
                  <button
                    onClick={() => {
                      setMostrarCarritoMobile(false)
                      cobrar()
                    }}
                    disabled={procesando || !cajaId || !medioPagoId}
                    className="flex-[2] px-4 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {procesando ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                    ) : (
                      <>
                        <DollarSign size={18} />
                        COBRAR ${total.toLocaleString()}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Panel Derecho - Carrito con Tabs - Ancho dinámico (Desktop only) */}
      <div className={`hidden md:flex bg-white border-l flex-col transition-all duration-300 ${
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
                        <input
                          type="number"
                          min="1"
                          value={item.cantidad}
                          onChange={(e) => cambiarCantidadDirecta(item.id, e.target.value)}
                          className="w-14 text-center font-bold border border-gray-300 rounded px-1 py-1 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
                        />
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
                <>
                  <button
                    onClick={() => setTabActivo('finalizar')}
                    className="w-full mt-3 px-4 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    Continuar al Pago
                    <DollarSign size={18} />
                  </button>

                  {/* Atajos de teclado (hints) */}
                  <div className="text-xs text-gray-500 flex flex-wrap gap-2 justify-center pt-3 border-t mt-3">
                    <span><kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">F2</kbd> Ir a Pago</span>
                    <span><kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">F4</kbd> Limpiar</span>
                    <span><kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">F5</kbd> Efectivo</span>
                    <span><kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">F6</kbd> Tarjeta</span>
                  </div>
                </>
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
                {cajas.length > 1 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Caja:</label>
                    <select
                      value={cajaId}
                      onChange={e => setCajaId(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-200 outline-none"
                    >
                      {cajas.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                  </div>
                )}
                {cajas.length === 1 && (
                  <div className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-lg">
                    <span className="text-xs font-medium text-gray-500">Caja:</span>
                    <span className="text-sm font-semibold text-gray-800">{cajas[0].nombre}</span>
                  </div>
                )}
                {cajas.length === 0 && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    No hay cajas disponibles para tu rol
                  </div>
                )}

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
                />

                {/* Tipo de Comprobante */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Comprobante:</label>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      onClick={() => setTipoComprobante('interno')}
                      className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                        tipoComprobante === 'interno'
                          ? 'bg-gray-700 text-white border-gray-700'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      Sin Factura
                    </button>
                    {configFiscal && (
                      <>
                        <button
                          type="button"
                          onClick={() => setTipoComprobante('facturaB')}
                          className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                            tipoComprobante === 'facturaB'
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                          }`}
                        >
                          <Receipt size={12} className="inline mr-1" />
                          Fact. B
                        </button>
                        <button
                          type="button"
                          onClick={() => setTipoComprobante('facturaC')}
                          className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                            tipoComprobante === 'facturaC'
                              ? 'bg-green-600 text-white border-green-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-green-400'
                          }`}
                        >
                          <Receipt size={12} className="inline mr-1" />
                          Fact. C
                        </button>
                      </>
                    )}
                  </div>
                  {!configFiscal && (
                    <p className="text-xs text-amber-600 mt-1">
                      Configurar AFIP para emitir facturas
                    </p>
                  )}
                </div>

                {/* Selector de cliente para facturación */}
                {tipoComprobante !== 'interno' && (
                  <div className="pt-2 border-t border-gray-200">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Cliente (opcional):
                    </label>
                    <ClienteSelector
                      value={clienteSeleccionado}
                      onChange={setClienteSeleccionado}
                    />
                  </div>
                )}
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
                    {tipoComprobante !== 'interno' ? 'Emitiendo factura...' : 'Procesando...'}
                  </>
                ) : (
                  <>
                    {tipoComprobante !== 'interno' ? <Receipt size={20} /> : <DollarSign size={20} />}
                    {tipoComprobante !== 'interno'
                      ? `FACTURAR ${tipoComprobante === 'facturaB' ? 'B' : 'C'} $${total.toLocaleString()}`
                      : `COBRAR $${total.toLocaleString()}`
                    }
                  </>
                )}
              </button>

              {/* Atajos de teclado (hints) */}
              <div className="text-xs text-gray-500 flex flex-wrap gap-2 justify-center pt-1 border-t">
                <span><kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">F2</kbd> Cobrar</span>
                <span><kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Enter</kbd> Confirmar</span>
                <span><kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">F5</kbd> Efectivo</span>
                <span><kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">F6</kbd> Tarjeta</span>
                <span><kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">ESC</kbd> Volver</span>
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

      {/* Dialog de confirmación */}
      <ConfirmDialog />
    </div>
  )
}
