import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, Minus, Trash2, ShoppingCart, CreditCard,
  Search, User, Ticket, Calendar, MapPin, DollarSign, X, Download, Package, CheckCircle, XCircle, Mail
} from 'lucide-react'
import { Button } from '../../../components/Button'
import { SearchInputWithDropdown } from '../../../components/SearchInput'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'
import { formatDate, formatCurrency } from '../../../utils/formatters'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../../components/LoadingSpinner'

export default function VentaEntradas() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)

  // Datos
  const [eventos, setEventos] = useState([])
  const [eventoSeleccionado, setEventoSeleccionado] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [cajas, setCajas] = useState([])
  const [mediosPago, setMediosPago] = useState([])

  // Carrito
  const [carrito, setCarrito] = useState([])

  // Comprador
  const [busquedaSocio, setBusquedaSocio] = useState('')
  const [resultadosSocio, setResultadosSocio] = useState([])
  const [buscandoSocio, setBuscandoSocio] = useState(false)
  const [socioSeleccionado, setSocioSeleccionado] = useState(null)
  const [nombreComprador, setNombreComprador] = useState('')
  const [documentoComprador, setDocumentoComprador] = useState('')

  // Pago
  const [cajaId, setCajaId] = useState('')
  const [medioPagoId, setMedioPagoId] = useState('')

  // Estado
  const [pasoActual, setPasoActual] = useState(1) // 1: carrito, 2: comprador, 3: pago
  const [procesando, setProcesando] = useState(false)

  // Modal QR
  const [mostrarModalQR, setMostrarModalQR] = useState(false)
  const [entradasGeneradas, setEntradasGeneradas] = useState([])
  const [emailDestino, setEmailDestino] = useState('')
  const [enviandoEmail, setEnviandoEmail] = useState(false)

  useEffect(() => {
    cargarDatos()
  }, [])

  useEffect(() => {
    if (eventoSeleccionado) {
      cargarCategorias(eventoSeleccionado.id)
    }
  }, [eventoSeleccionado])

  // Buscar socios con debounce
  useEffect(() => {
    if (busquedaSocio.length < 2) {
      setResultadosSocio([])
      return
    }

    const timer = setTimeout(async () => {
      setBuscandoSocio(true)
      try {
        const response = await api.getFull(`/admin/socios?q=${encodeURIComponent(busquedaSocio)}&limit=10`)
        const socios = response?.data?.socios || response?.socios || []
        setResultadosSocio(socios)
      } catch (err) {
        console.error('Error buscando socios:', err)
        setResultadosSocio([])
      } finally {
        setBuscandoSocio(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [busquedaSocio])

  async function cargarDatos() {
    setLoading(true)
    try {
      // Cargar eventos activos
      const eventosData = await api.get('/eventos?estado=PROGRAMADO,EN_CURSO&ventasHabilitadas=true')
      const eventos = eventosData?.data || eventosData || []
      setEventos(eventos)

      // Cargar cajas
      const cajasData = await api.get('/admin/cajas')
      const cajas = cajasData?.data || cajasData || []
      console.log('📦 Cajas cargadas:', cajas)
      setCajas(cajas)

      // Cargar medios de pago
      const mediosData = await api.get('/admin/medios-pago')
      const mediosPago = mediosData?.data || mediosData || []
      setMediosPago(mediosPago)

      // Seleccionar primera caja y medio de pago por defecto
      if (cajas.length > 0) {
        setCajaId(cajas[0].id)
      }
      if (mediosPago.length > 0) {
        const efectivo = mediosPago.find(m => m.codigo === 'EFECTIVO')
        setMedioPagoId(efectivo?.id || mediosPago[0].id)
      }
    } catch (err) {
      toast.error('Error al cargar datos')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function cargarCategorias(eventoId) {
    try {
      const data = await api.get(`/eventos/${eventoId}/categorias`)
      const categorias = data?.data || data || []
      setCategorias(categorias.filter(c => c.activo))
    } catch (err) {
      console.error('Error al cargar categorías:', err)
    }
  }

  async function seleccionarSocio(socio) {
    try {
      // Verificar si tiene deudas
      const cuentaCorriente = await api.get(`/admin/socios/${socio.id}/cuenta-corriente?incluirFamilia=false`)
      const saldo = parseFloat(cuentaCorriente?.resumen?.saldoActual || 0)

      const socioConDeuda = {
        ...socio,
        tieneDeuda: saldo > 0, // Saldo positivo = debe plata
        saldo
      }

      setSocioSeleccionado(socioConDeuda)
      setNombreComprador(socio.apellidoNombre || `${socio.nombre || ''} ${socio.apellido || ''}`.trim())
      setDocumentoComprador(socio.documento || socio.dni || '')
      setBusquedaSocio('')

      if (saldo > 0) {
        toast.error(`Socio con deuda de ${formatCurrency(Math.abs(saldo))}. No se aplicará precio socio.`)
      } else {
        toast.success('Socio encontrado - Se aplicará precio socio')
      }

      // Recalcular precios del carrito si hay items (usar callback para obtener estado actualizado)
      setCarrito(currentCarrito => {
        if (currentCarrito.length > 0) {
          actualizarPreciosCarrito(socioConDeuda.tieneDeuda, currentCarrito)
        }
        return currentCarrito
      })
    } catch (err) {
      toast.error('Error al verificar datos del socio')
      console.error(err)
    }
  }

  async function actualizarPreciosCarrito(tieneDeuda, carritoActual = null) {
    const itemsCarrito = carritoActual || carrito
    if (itemsCarrito.length === 0) return

    // Necesitamos obtener las categorías de cada evento en el carrito
    const eventosIds = [...new Set(itemsCarrito.map(item => item.eventoId))]

    const categoriasMap = {}
    for (const eventoId of eventosIds) {
      try {
        const data = await api.get(`/eventos/${eventoId}/categorias`)
        const cats = data?.data || data || []
        cats.forEach(cat => {
          categoriasMap[cat.id] = cat
        })
      } catch (err) {
        console.error('Error cargando categorías:', err)
      }
    }

    setCarrito(itemsCarrito.map(item => {
      const categoria = categoriasMap[item.categoriaId]
      if (!categoria) return item

      const aplicarPrecioSocio = !tieneDeuda
      const nuevoPrecio = aplicarPrecioSocio ? categoria.precioSocio : categoria.precioNoSocio

      return {
        ...item,
        precio: parseFloat(nuevoPrecio),
        esSocio: aplicarPrecioSocio
      }
    }))
  }

  function agregarAlCarrito(categoria) {
    const itemExistente = carrito.find(item =>
      item.eventoId === eventoSeleccionado.id && item.categoriaId === categoria.id
    )

    if (itemExistente) {
      setCarrito(carrito.map(item =>
        item.eventoId === eventoSeleccionado.id && item.categoriaId === categoria.id
          ? { ...item, cantidad: item.cantidad + 1 }
          : item
      ))
    } else {
      // Solo aplicar precio socio si el socio NO tiene deuda
      const aplicarPrecioSocio = socioSeleccionado && !socioSeleccionado.tieneDeuda
      const precio = aplicarPrecioSocio ? categoria.precioSocio : categoria.precioNoSocio

      setCarrito([...carrito, {
        eventoId: eventoSeleccionado.id,
        eventoNombre: eventoSeleccionado.nombre,
        categoriaId: categoria.id,
        nombre: categoria.nombre,
        precio: parseFloat(precio),
        cantidad: 1,
        esSocio: aplicarPrecioSocio
      }])
    }
  }

  function modificarCantidad(eventoId, categoriaId, delta) {
    setCarrito(carrito.map(item =>
      item.eventoId === eventoId && item.categoriaId === categoriaId
        ? { ...item, cantidad: Math.max(1, item.cantidad + delta) }
        : item
    ).filter(item => item.cantidad > 0))
  }

  function eliminarDelCarrito(eventoId, categoriaId) {
    setCarrito(carrito.filter(item =>
      !(item.eventoId === eventoId && item.categoriaId === categoriaId)
    ))
  }

  function calcularTotal() {
    return carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0)
  }

  function limpiarComprador() {
    setSocioSeleccionado(null)
    setNombreComprador('')
    setDocumentoComprador('')
    setBusquedaSocio('')

    // Recalcular precios del carrito a precio no socio
    setCarrito(currentCarrito => {
      if (currentCarrito.length > 0) {
        actualizarPreciosCarrito(true, currentCarrito) // true = tiene deuda (no aplicar descuento)
      }
      return currentCarrito
    })
  }

  function siguientePaso() {
    // Validaciones por paso
    if (pasoActual === 1) {
      if (carrito.length === 0) {
        toast.error('Agregue items al carrito')
        return
      }
      setPasoActual(2)
    } else if (pasoActual === 2) {
      if (!nombreComprador.trim()) {
        toast.error('Ingrese el nombre del comprador')
        return
      }
      setPasoActual(3)
    }
  }

  function anteriorPaso() {
    if (pasoActual > 1) {
      setPasoActual(pasoActual - 1)
    }
  }

  async function venderEntradas() {
    // Validaciones finales
    if (carrito.length === 0) {
      toast.error('Agregue items al carrito')
      setPasoActual(1)
      return
    }
    if (!nombreComprador.trim()) {
      toast.error('Ingrese el nombre del comprador')
      setPasoActual(2)
      return
    }
    if (!cajaId) {
      toast.error('Seleccione una caja')
      return
    }
    if (!medioPagoId) {
      toast.error('Seleccione un medio de pago')
      return
    }

    setProcesando(true)

    try {
      // Agrupar items por evento
      const itemsPorEvento = carrito.reduce((acc, item) => {
        if (!acc[item.eventoId]) {
          acc[item.eventoId] = {
            eventoId: item.eventoId,
            eventoNombre: item.eventoNombre,
            items: []
          }
        }
        acc[item.eventoId].items.push({
          categoriaId: item.categoriaId,
          cantidad: item.cantidad
        })
        return acc
      }, {})

      // Procesar venta para cada evento
      const todasLasEntradas = []
      for (const grupo of Object.values(itemsPorEvento)) {
        const response = await api.post(`/eventos/${grupo.eventoId}/vender`, {
          items: grupo.items,
          socioId: socioSeleccionado?.id || null,
          nombreComprador,
          documentoComprador: documentoComprador || null,
          cajaId: parseInt(cajaId),
          medioPagoId: parseInt(medioPagoId)
        })

        const entradas = response?.data?.entradas || response?.entradas || response || []
        todasLasEntradas.push(...entradas)
      }

      console.log('✅ Venta exitosa, total entradas:', todasLasEntradas.length)
      setEntradasGeneradas(todasLasEntradas)

      // Precargar email si es socio
      if (socioSeleccionado?.email) {
        setEmailDestino(socioSeleccionado.email)
      } else {
        setEmailDestino('')
      }

      setMostrarModalQR(true)

      // Limpiar formulario
      setCarrito([])
      setNombreComprador('')
      setDocumentoComprador('')
      setPasoActual(1)
      toast.success(`${todasLasEntradas.length} entradas vendidas exitosamente`)

      // Recargar datos
      cargarDatos()
    } catch (err) {
      toast.error(err.message || 'Error al vender entradas')
      console.error('Error en venta:', err)
    } finally {
      setProcesando(false)
    }
  }

  async function descargarPDFEntradas() {
    setEnviandoEmail(true)
    try {
      const codigosEntradas = entradasGeneradas.map(e => e.codigo)

      const response = await api.downloadFile('/eventos/generar-pdf-entradas', {
        codigos: codigosEntradas,
        nombreComprador: nombreComprador
      })

      const blob = await response.blob()

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url

      const evento = entradasGeneradas[0]?.evento || entradasGeneradas[0]?.categoria?.evento
      const ext = blob.type === 'application/zip' ? 'zip' : 'pdf'
      link.download = `entradas-${evento?.codigo || 'evento'}.${ext}`

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.success(ext === 'zip' ? 'ZIP con entradas descargado' : 'Entrada descargada')
    } catch (err) {
      toast.error(err.message || 'Error al generar PDF')
    } finally {
      setEnviandoEmail(false)
    }
  }

  async function enviarEntradasPorEmail() {
    if (!emailDestino || !emailDestino.includes('@')) {
      toast.error('Ingrese un email válido')
      return
    }

    setEnviandoEmail(true)
    try {
      const codigosEntradas = entradasGeneradas.map(e => e.codigo)

      await api.post('/eventos/enviar-entradas', {
        codigos: codigosEntradas,
        email: emailDestino,
        nombreComprador: nombreComprador
      })

      toast.success(`Entradas enviadas a ${emailDestino}`)
    } catch (err) {
      toast.error(err.message || 'Error al enviar entradas por email')
    } finally {
      setEnviandoEmail(false)
    }
  }

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  if (!tienePermiso(PERMISOS.EVENTOS_VENDER)) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">No tiene permisos para vender entradas</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/eventos')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <ShoppingCart className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Venta de Entradas</h1>
              <p className="text-gray-500 text-sm">Punto de venta presencial</p>
            </div>
          </div>
        </div>
      </div>

      {/* Layout Principal */}
      <div className="flex-1 grid lg:grid-cols-[380px_380px_1fr] gap-4 overflow-hidden">
        {/* Panel Izquierdo - Eventos */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Ticket className="w-5 h-5" />
              Eventos Disponibles ({eventos.length})
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {eventos.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                <Ticket className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p>No hay eventos disponibles para venta</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {eventos.map(evento => {
                  const disponibles = evento.capacidadTotal - evento.entradasVendidas
                  const isSelected = eventoSeleccionado?.id === evento.id

                  return (
                    <div
                      key={evento.id}
                      onClick={() => {
                        setEventoSeleccionado(evento)
                      }}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-md'
                          : 'border-gray-200 hover:border-primary/50 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className={`font-semibold ${isSelected ? 'text-primary' : 'text-gray-900'}`}>
                            {evento.nombre}
                          </h4>
                          <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded ${
                            evento.tipo === 'DEPORTIVO' ? 'bg-orange-100 text-orange-800' :
                            evento.tipo === 'SOCIAL' ? 'bg-purple-100 text-purple-800' :
                            'bg-pink-100 text-pink-800'
                          }`}>
                            {evento.tipo}
                          </span>
                        </div>
                        {isSelected && (
                          <div className="p-2 bg-primary rounded-full">
                            <Ticket className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>

                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(evento.fecha)} - {evento.hora}
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <MapPin className="w-3.5 h-3.5" />
                          {evento.espacio?.nombre || evento.ubicacion || 'Sin ubicación'}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-xs px-2 py-1 rounded font-medium ${
                            disponibles > 50 ? 'bg-green-100 text-green-800' :
                            disponibles > 0 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {disponibles > 0 ? `${disponibles} disponibles` : 'Agotado'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Panel Centro - Categorías */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Package className="w-5 h-5" />
              <span className="truncate">
                {eventoSeleccionado ? (
                  <>
                    Categorías
                    <span className="text-sm font-normal text-gray-500 ml-1">
                      - {eventoSeleccionado.nombre}
                    </span>
                  </>
                ) : (
                  'Categorías'
                )}
              </span>
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {!eventoSeleccionado ? (
              <div className="text-center text-gray-500 py-12">
                <Ticket className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p>Seleccione un evento</p>
                <p className="text-sm mt-2">para ver las categorías</p>
              </div>
            ) : categorias.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p>No hay categorías disponibles</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {categorias.map(categoria => {
                  const disponibles = categoria.capacidad
                    ? categoria.capacidad - categoria.entradasVendidas
                    : 999999
                  const aplicarPrecioSocio = socioSeleccionado && !socioSeleccionado.tieneDeuda
                  const precio = aplicarPrecioSocio ? categoria.precioSocio : categoria.precioNoSocio

                  return (
                    <div
                      key={categoria.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-primary/50 cursor-pointer transition-colors"
                      onClick={() => disponibles > 0 && agregarAlCarrito(categoria)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{categoria.nombre}</h4>
                          {categoria.descripcion && (
                            <p className="text-xs text-gray-500 mt-1">{categoria.descripcion}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-lg font-bold text-primary">
                              {formatCurrency(precio)}
                            </span>
                            {aplicarPrecioSocio && categoria.precioNoSocio !== categoria.precioSocio && (
                              <span className="text-xs text-gray-500 line-through">
                                {formatCurrency(categoria.precioNoSocio)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs px-2 py-1 rounded ${
                            disponibles > 10 ? 'bg-green-100 text-green-800' :
                            disponibles > 0 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {disponibles > 0 ? `${disponibles} disp.` : 'Agotado'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Panel Derecho - Carrito y Pago */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col overflow-hidden">
          {/* Wizard Steps */}
          <div className="border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between px-6 py-4">
              {[
                { paso: 1, label: 'Carrito', icono: ShoppingCart },
                { paso: 2, label: 'Comprador', icono: User },
                { paso: 3, label: 'Pago', icono: CreditCard }
              ].map((step, index) => {
                const Icon = step.icono
                const isActive = pasoActual === step.paso
                const isCompleted = pasoActual > step.paso

                return (
                  <div key={step.paso} className="flex items-center flex-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                        isActive
                          ? 'bg-primary text-white'
                          : isCompleted
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 text-gray-500'
                      }`}>
                        {isCompleted ? '✓' : <Icon className="w-5 h-5" />}
                      </div>
                      <div className="hidden md:block">
                        <div className={`text-sm font-medium ${
                          isActive ? 'text-primary' : isCompleted ? 'text-green-600' : 'text-gray-500'
                        }`}>
                          {step.label}
                        </div>
                        {step.paso === 1 && carrito.length > 0 && (
                          <div className="text-xs text-gray-500">{carrito.length} items</div>
                        )}
                      </div>
                    </div>
                    {index < 2 && (
                      <div className={`flex-1 h-0.5 mx-4 ${
                        isCompleted ? 'bg-green-500' : 'bg-gray-200'
                      }`} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {/* Paso 1: Carrito */}
            {pasoActual === 1 && (
              <div>
                {carrito.length === 0 ? (
                  <div className="text-center text-gray-500 py-12">
                    <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p>El carrito está vacío</p>
                    <p className="text-sm mt-2">Seleccione categorías para agregar</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {carrito.map(item => (
                      <div key={`${item.eventoId}-${item.categoriaId}`} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="text-xs text-gray-500 mb-1">{item.eventoNombre}</div>
                            <h4 className="font-medium text-gray-900">{item.nombre}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-sm text-gray-600">
                                {formatCurrency(item.precio)}
                              </span>
                              {item.esSocio && (
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                  Precio Socio
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => eliminarDelCarrito(item.eventoId, item.categoriaId)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => modificarCantidad(item.eventoId, item.categoriaId, -1)}
                              className="p-1 border border-gray-300 rounded hover:bg-gray-50"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-8 text-center font-medium">{item.cantidad}</span>
                            <button
                              onClick={() => modificarCantidad(item.eventoId, item.categoriaId, 1)}
                              className="p-1 border border-gray-300 rounded hover:bg-gray-50"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          <span className="font-bold text-gray-900">
                            {formatCurrency(item.precio * item.cantidad)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Paso 2: Comprador */}
            {pasoActual === 2 && (
              <div className="space-y-4">
                {!socioSeleccionado ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Buscar Socio (Opcional)
                    </label>
                    <SearchInputWithDropdown
                      value={busquedaSocio}
                      onChange={setBusquedaSocio}
                      results={resultadosSocio}
                      loading={buscandoSocio}
                      onSelectResult={seleccionarSocio}
                      renderResult={(socio) => (
                        <div>
                          <div className="font-medium text-gray-900">
                            {socio.apellidoNombre}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center gap-4 mt-1">
                            <span>Nro: {socio.nroSocio}</span>
                            <span>DNI: {socio.documento}</span>
                          </div>
                        </div>
                      )}
                      placeholder="Buscar por nombre, DNI o número de socio..."
                      minChars={2}
                      emptyMessage="No se encontraron socios"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Socio Seleccionado
                    </label>
                    <div className={`p-4 border-2 rounded-lg flex items-center justify-between ${
                      socioSeleccionado.tieneDeuda
                        ? 'bg-red-50 border-red-300'
                        : 'bg-green-50 border-green-300'
                    }`}>
                      <div className="flex items-center gap-3">
                        {socioSeleccionado.tieneDeuda ? (
                          <XCircle className="w-8 h-8 text-red-600" />
                        ) : (
                          <CheckCircle className="w-8 h-8 text-green-600" />
                        )}
                        <div>
                          <div className={`font-semibold ${
                            socioSeleccionado.tieneDeuda ? 'text-red-900' : 'text-green-900'
                          }`}>
                            {socioSeleccionado.apellidoNombre}
                          </div>
                          <div className={`text-sm mt-1 ${
                            socioSeleccionado.tieneDeuda ? 'text-red-700' : 'text-green-700'
                          }`}>
                            Nro: {socioSeleccionado.nroSocio} | DNI: {socioSeleccionado.documento}
                          </div>
                          <div className={`text-sm font-medium mt-1 ${
                            socioSeleccionado.tieneDeuda ? 'text-red-800' : 'text-green-800'
                          }`}>
                            {socioSeleccionado.tieneDeuda
                              ? `Deuda: ${formatCurrency(Math.abs(socioSeleccionado.saldo))} - NO se aplica precio socio`
                              : 'Sin deuda - Se aplicará precio socio'
                            }
                          </div>
                        </div>
                      </div>
                      <Button variant="secondary" onClick={limpiarComprador} size="sm">
                        Cambiar
                      </Button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre del Comprador <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={nombreComprador}
                    onChange={(e) => setNombreComprador(e.target.value)}
                    placeholder="Nombre completo"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
                    disabled={!!socioSeleccionado}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Documento (Opcional)
                  </label>
                  <input
                    type="text"
                    value={documentoComprador}
                    onChange={(e) => setDocumentoComprador(e.target.value)}
                    placeholder="DNI, CUIT, etc."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
                    disabled={!!socioSeleccionado}
                  />
                </div>
              </div>
            )}

            {/* Paso 3: Pago */}
            {pasoActual === 3 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Caja <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={cajaId}
                    onChange={(e) => setCajaId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  >
                    <option value="">Seleccione una caja...</option>
                    {cajas.map(caja => (
                      <option key={caja.id} value={caja.id}>
                        {caja.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Medio de Pago <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={medioPagoId}
                    onChange={(e) => setMedioPagoId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  >
                    <option value="">Seleccione medio de pago...</option>
                    {mediosPago.map(medio => (
                      <option key={medio.id} value={medio.id}>
                        {medio.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Resumen */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-3">Resumen de Venta</h4>
                  <div className="space-y-2">
                    {carrito.map(item => (
                      <div key={`${item.eventoId}-${item.categoriaId}`} className="flex justify-between text-sm">
                        <span className="text-gray-600">
                          {item.eventoNombre} - {item.nombre} x{item.cantidad}
                        </span>
                        <span className="text-gray-900">
                          {formatCurrency(item.precio * item.cantidad)}
                        </span>
                      </div>
                    ))}
                    <div className="border-t border-gray-300 pt-2 mt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold text-gray-900">Total</span>
                        <span className="text-2xl font-bold text-primary">
                          {formatCurrency(calcularTotal())}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer - Botones de navegación */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            {carrito.length > 0 && (
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-600">Total a Cobrar</span>
                <span className="text-2xl font-bold text-primary">
                  {formatCurrency(calcularTotal())}
                </span>
              </div>
            )}

            <div className="flex gap-3">
              {pasoActual > 1 && (
                <Button
                  variant="secondary"
                  onClick={anteriorPaso}
                  disabled={procesando}
                  className="flex items-center justify-center gap-2 py-3"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Anterior
                </Button>
              )}

              {pasoActual < 3 ? (
                <Button
                  onClick={siguientePaso}
                  disabled={carrito.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 py-3"
                >
                  Siguiente
                  <ArrowLeft className="w-5 h-5 rotate-180" />
                </Button>
              ) : (
                <Button
                  onClick={venderEntradas}
                  disabled={procesando || carrito.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 py-3 text-lg"
                >
                  {procesando ? (
                    <>
                      <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5" />
                      Vender y Generar QR
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal QR Generados */}
      {mostrarModalQR && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">
                Entradas Generadas ({entradasGeneradas.length})
              </h3>
              <button
                onClick={() => setMostrarModalQR(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {/* Resumen de entradas */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-3">Entradas Generadas</h4>
                {(() => {
                  const evento = entradasGeneradas[0]?.categoria?.evento || entradasGeneradas[0]?.evento
                  return (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-lg font-semibold text-gray-900">{evento?.nombre || 'Evento'}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        {evento?.fecha ? formatDate(evento.fecha) : ''} {evento?.hora ? `- ${evento.hora}` : ''}
                      </p>
                      <div className="mt-3 space-y-1">
                        {entradasGeneradas.map(entrada => (
                          <div key={entrada.id} className="flex justify-between items-center text-sm">
                            <span className="text-gray-700">
                              {entrada.categoria?.nombre} - {entrada.codigo}
                            </span>
                            <span className="font-semibold text-gray-900">
                              {formatCurrency(entrada.precio)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center font-semibold">
                        <span className="text-gray-900">Total ({entradasGeneradas.length} entrada{entradasGeneradas.length !== 1 ? 's' : ''})</span>
                        <span className="text-primary text-lg">
                          {formatCurrency(entradasGeneradas.reduce((sum, e) => sum + parseFloat(e.precio), 0))}
                        </span>
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Botones de acción */}
              <div className="space-y-3">
                <Button
                  onClick={descargarPDFEntradas}
                  disabled={enviandoEmail}
                  className="w-full flex items-center justify-center gap-2"
                >
                  {enviandoEmail ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Descargar PDF
                    </>
                  )}
                </Button>

                <div className="border-t border-gray-200 pt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enviar entradas por email
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={emailDestino}
                      onChange={(e) => setEmailDestino(e.target.value)}
                      placeholder="ejemplo@email.com"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                    />
                    <Button
                      onClick={enviarEntradasPorEmail}
                      disabled={enviandoEmail || !emailDestino}
                      className="flex items-center gap-2"
                    >
                      {enviandoEmail ? (
                        <>
                          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Mail className="w-4 h-4" />
                          Enviar
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
