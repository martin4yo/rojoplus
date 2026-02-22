import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Minus, Send, DollarSign, Clock, User, ShoppingCart, UtensilsCrossed, Coffee, Search, X, Users, Percent, CheckCircle, AlertCircle, Trash2, Edit3, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'
import { useNotificacionBuffet } from '../../../contexts/NotificacionBuffetContext'
import NotificacionBuffet from '../../../components/buffet/NotificacionBuffet'
import { useTicket } from '../../../contexts/TicketContext'
import SelectCentroCosto from '../../../components/SelectCentroCosto'
import StatusBadge from '../../../components/StatusBadge'
import { formatCurrency } from '../../../utils/formatters'
import Modal from '../../../components/Modal'
import CalculadoraVuelto from '../../../components/buffet/CalculadoraVuelto'
import SelectorMedioPago from '../../../components/buffet/SelectorMedioPago'
import PropinaSelector from '../../../components/buffet/PropinaSelector'
import SplitCuenta from '../../../components/buffet/SplitCuenta'
import PagoMultiple from '../../../components/buffet/PagoMultiple'

export default function BuffetComanda() {
  const { mesaId } = useParams()
  const navigate = useNavigate()
  const { generarTicketComanda, imprimirTicket } = useTicket()
  const [mesa, setMesa] = useState(null)
  const [comandas, setComandas] = useState([]) // Todas las comandas activas (para mesas comunales)
  const [comandaActiva, setComandaActiva] = useState(null) // Comanda seleccionada actualmente
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [cajas, setCajas] = useState([])
  const [mediosPago, setMediosPago] = useState([])
  const [loading, setLoading] = useState(true)
  const [categoriaActiva, setCategoriaActiva] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [itemsNuevos, setItemsNuevos] = useState([])
  const [cobroData, setCobroData] = useState({ cajaId: '', medioPagoId: '', aplicarDescuento: true })
  const [descuentoInfo, setDescuentoInfo] = useState(null)
  const [cargandoDescuento, setCargandoDescuento] = useState(false)
  const [tabActivo, setTabActivo] = useState('productos') // 'productos' | 'carrito' (solo para móvil)

  // Modal nueva comanda
  const [modalNuevaComanda, setModalNuevaComanda] = useState(false)
  const [nuevaComandaData, setNuevaComandaData] = useState({ buscarSocio: '', socioId: null, socioNombre: '', nombreGrupo: '', centroCostoId: '' })
  const [sociosBusqueda, setSociosBusqueda] = useState([])
  const [buscandoSocio, setBuscandoSocio] = useState(false)

  // Modal confirmar eliminar
  const [modalConfirmarEliminar, setModalConfirmarEliminar] = useState(false)
  const [comandaAEliminar, setComandaAEliminar] = useState(null)

  // Modal editar comanda
  const [modalEditarComanda, setModalEditarComanda] = useState(false)
  const [comandaAEditar, setComandaAEditar] = useState(null)
  const [editarComandaData, setEditarComandaData] = useState({ buscarSocio: '', socioId: null, socioNombre: '', nombreGrupo: '' })

  // Estados para nuevas funcionalidades de cobro
  const [datosVuelto, setDatosVuelto] = useState({ montoPagado: 0, vuelto: 0, esSuficiente: false })
  const [propinaData, setPropinaData] = useState({ porcentaje: 0, monto: 0, esCustom: false })
  const [modalSplit, setModalSplit] = useState(false)
  const [pagosParciales, setPagosParciales] = useState({ pagos: [], totalPagado: 0, totalPendiente: 0, esCompleto: false })
  const [usarPagosMultiples, setUsarPagosMultiples] = useState(false)
  const [tabCobroActivo, setTabCobroActivo] = useState('cuenta') // 'cuenta' o 'finalizar'

  const cargarDatos = useCallback(async () => {
    try {
      // Primero cargar la mesa
      const mesaRes = await api.get(`/admin/buffet/mesas/${mesaId}`)
      console.log('Mesa response:', mesaRes)

      if (!mesaRes) {
        console.error('No se recibió respuesta de mesa')
        setLoading(false)
        return
      }

      setMesa(mesaRes)

      // Obtener todas las comandas activas de la mesa
      const todasComandas = mesaRes.comandas || []
      setComandas(todasComandas)

      // Si ya teníamos una comanda seleccionada, mantenerla; sino seleccionar la primera
      if (todasComandas.length > 0) {
        setComandaActiva(prev => {
          // Si ya había una comanda seleccionada y sigue existiendo, mantenerla
          if (prev && todasComandas.find(c => c.id === prev.id)) {
            return todasComandas.find(c => c.id === prev.id)
          }
          // Sino, seleccionar la primera
          return todasComandas[0]
        })
      } else {
        setComandaActiva(null)
      }

      // Cargar el resto de datos (solo productos de BUFFET, no de KIOSCO)
      const [prodRes, catRes, cajasRes, mediosRes] = await Promise.all([
        api.get('/admin/buffet/productos?disponible=true&activo=true&tipoVenta=BUFFET'),
        api.get('/admin/buffet/categorias?activo=true'),
        api.get('/admin/buffet/config/cajas/buffet'),
        api.get('/admin/buffet/config/medios-pago/buffet')
      ])

      const productos = prodRes.data || prodRes || []
      const categorias = catRes.data || catRes || []
      const cajas = cajasRes.data || cajasRes || []
      const medios = mediosRes.data || mediosRes || []

      setProductos(productos)

      // Solo mostrar categorías que tienen productos de BUFFET
      const categoriasConProductos = categorias.filter(cat =>
        productos.some(p => p.categoriaMenuId === cat.id)
      )
      setCategorias(categoriasConProductos)

      setCajas(cajas)
      setMediosPago(medios)
      // Mantener en "Todos" por defecto (categoriaActiva = null)

      if (cajas.length > 0) {
        setCobroData(prev => ({ ...prev, cajaId: cajas[0].id }))
      }
      const efectivo = medios.find(m => m.codigo === 'EFECTIVO')
      if (efectivo) {
        setCobroData(prev => ({ ...prev, medioPagoId: efectivo.id }))
      } else if (medios.length > 0) {
        setCobroData(prev => ({ ...prev, medioPagoId: medios[0].id }))
      }
    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }, [mesaId])

  useEffect(() => {
    cargarDatos()
    const interval = setInterval(cargarDatos, 30000)
    return () => clearInterval(interval)
  }, [cargarDatos])

  // Atajos de teclado para tab de finalizar
  useEffect(() => {
    if (tabCobroActivo !== 'finalizar') return

    function handleKeyPress(e) {
      // Solo procesar si estamos en el tab finalizar y no hay otro modal abierto
      if (tabCobroActivo !== 'finalizar' || modalSplit) return

      // No procesar si estamos en un input/textarea/select
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        return
      }

      switch(e.key) {
        case 'Enter':
          e.preventDefault()
          cobrar()
          break
        case 'Escape':
          e.preventDefault()
          setTabCobroActivo('cuenta')
          break
        case 'F9':
          e.preventDefault()
          verPreviewCuenta()
          break
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [tabCobroActivo, modalSplit, cobroData, datosVuelto, propinaData, usarPagosMultiples, pagosParciales])

  // Buscar socios para asignar a la comanda
  async function buscarSocios(texto) {
    if (!texto || texto.length < 2) {
      setSociosBusqueda([])
      return
    }
    setBuscandoSocio(true)
    try {
      const res = await api.get(`/admin/socios?q=${encodeURIComponent(texto)}&limit=5`)
      // El endpoint devuelve { data: { socios: [...], pagination, filtros } }
      // api.get ya extrae .data, así que res = { socios: [...], pagination, filtros }
      const socios = res?.socios || res?.data?.socios || []
      setSociosBusqueda(Array.isArray(socios) ? socios : [])
    } catch (err) {
      console.error('Error buscando socios:', err)
      setSociosBusqueda([])
    } finally {
      setBuscandoSocio(false)
    }
  }

  function seleccionarSocio(socio) {
    setNuevaComandaData({
      ...nuevaComandaData,
      socioId: socio.id,
      socioNombre: socio.apellidoNombre || `${socio.apellido}, ${socio.nombre}`,
      buscarSocio: ''
    })
    setSociosBusqueda([])
  }

  function limpiarSocio() {
    setNuevaComandaData({
      ...nuevaComandaData,
      socioId: null,
      socioNombre: '',
      buscarSocio: ''
    })
  }

  function abrirModalNuevaComanda() {
    setNuevaComandaData({ buscarSocio: '', socioId: null, socioNombre: '', nombreGrupo: '', centroCostoId: '' })
    setSociosBusqueda([])
    setModalNuevaComanda(true)
  }

  async function confirmarNuevaComanda() {
    try {
      const payload = {
        mesaId: parseInt(mesaId)
      }
      if (nuevaComandaData.socioId) {
        payload.socioId = nuevaComandaData.socioId
      }
      if (nuevaComandaData.nombreGrupo) {
        payload.observaciones = nuevaComandaData.nombreGrupo
      }
      if (nuevaComandaData.centroCostoId) {
        payload.centroCostoId = parseInt(nuevaComandaData.centroCostoId)
      }

      const res = await api.post('/admin/buffet/comandas', payload)
      const nuevaComanda = res.data || res
      setComandaActiva(nuevaComanda)
      setModalNuevaComanda(false)
      cargarDatos()
      toast.success(`Comanda ${nuevaComanda.numero} abierta`)
    } catch (err) {
      console.error('Error abriendo comanda:', err)
      toast.error(err.response?.data?.error || 'Error al abrir comanda')
    }
  }

  // Para mesas no comunales, abrir directamente
  async function abrirComandaDirecta() {
    try {
      const res = await api.post('/admin/buffet/comandas', {
        mesaId: parseInt(mesaId)
      })
      const nuevaComanda = res.data || res
      setComandaActiva(nuevaComanda)
      cargarDatos()
      toast.success(`Comanda ${nuevaComanda.numero} abierta`)
    } catch (err) {
      console.error('Error abriendo comanda:', err)
      toast.error(err.response?.data?.error || 'Error al abrir comanda')
    }
  }

  function seleccionarComanda(comanda) {
    setComandaActiva(comanda)
    setItemsNuevos([]) // Limpiar items nuevos al cambiar de comanda
  }

  function solicitarEliminarComanda(comanda) {
    if (comanda.items?.length > 0) {
      toast.error('No se puede eliminar una comanda con items')
      return
    }
    setComandaAEliminar(comanda)
    setModalConfirmarEliminar(true)
  }

  async function confirmarEliminarComanda() {
    if (!comandaAEliminar) return

    try {
      await api.delete(`/admin/buffet/comandas/${comandaAEliminar.id}`)
      toast.success('Comanda eliminada')

      // Si era la activa, seleccionar otra o volver
      if (comandaActiva?.id === comandaAEliminar.id) {
        const otrasComandas = comandas.filter(c => c.id !== comandaAEliminar.id)
        if (otrasComandas.length > 0) {
          setComandaActiva(otrasComandas[0])
        } else {
          setComandaActiva(null)
        }
      }
      setModalConfirmarEliminar(false)
      setComandaAEliminar(null)
      cargarDatos()
    } catch (err) {
      console.error('Error eliminando comanda:', err)
      toast.error(err.response?.data?.error || 'Error al eliminar comanda')
    }
  }

  // Editar comanda
  function abrirEditarComanda(comanda) {
    setComandaAEditar(comanda)
    setEditarComandaData({
      buscarSocio: '',
      socioId: comanda.socioId || null,
      socioNombre: comanda.socio ? (comanda.socio.apellidoNombre || `${comanda.socio.apellido}, ${comanda.socio.nombre}`) : '',
      nombreGrupo: comanda.observaciones || ''
    })
    setSociosBusqueda([])
    setModalEditarComanda(true)
  }

  function seleccionarSocioEditar(socio) {
    setEditarComandaData({
      ...editarComandaData,
      socioId: socio.id,
      socioNombre: socio.apellidoNombre || `${socio.apellido}, ${socio.nombre}`,
      buscarSocio: ''
    })
    setSociosBusqueda([])
  }

  function limpiarSocioEditar() {
    setEditarComandaData({
      ...editarComandaData,
      socioId: null,
      socioNombre: '',
      buscarSocio: ''
    })
  }

  async function confirmarEditarComanda() {
    if (!comandaAEditar) return

    try {
      await api.put(`/admin/buffet/comandas/${comandaAEditar.id}`, {
        socioId: editarComandaData.socioId,
        observaciones: editarComandaData.nombreGrupo || null
      })
      toast.success('Comanda actualizada')
      setModalEditarComanda(false)
      setComandaAEditar(null)
      cargarDatos()
    } catch (err) {
      console.error('Error actualizando comanda:', err)
      toast.error(err.response?.data?.error || 'Error al actualizar comanda')
    }
  }

  function agregarItem(producto) {
    setItemsNuevos(prev => {
      const existe = prev.find(i => i.productoBuffetId === producto.id)
      if (existe) {
        return prev.map(i =>
          i.productoBuffetId === producto.id
            ? { ...i, cantidad: i.cantidad + 1 }
            : i
        )
      }
      return [...prev, {
        productoBuffetId: producto.id,
        nombre: producto.nombre,
        precio: producto.precio,
        cantidad: 1,
        observaciones: ''
      }]
    })
  }

  function modificarCantidadNuevo(index, delta) {
    setItemsNuevos(prev => {
      return prev
        .map((item, i) => {
          if (i === index) {
            const nuevaCantidad = item.cantidad + delta
            return nuevaCantidad > 0 ? { ...item, cantidad: nuevaCantidad } : null
          }
          return item
        })
        .filter(Boolean)
    })
  }

  function setObservacion(index, texto) {
    setItemsNuevos(prev =>
      prev.map((item, i) => i === index ? { ...item, observaciones: texto } : item)
    )
  }

  async function enviarACocina() {
    if (itemsNuevos.length === 0 || !comandaActiva) return

    try {
      // Agregar items
      await api.post(`/admin/buffet/comandas/${comandaActiva.id}/items`, {
        items: itemsNuevos.map(i => ({
          productoBuffetId: i.productoBuffetId,
          cantidad: i.cantidad,
          observaciones: i.observaciones
        }))
      })

      // Enviar a cocina
      await api.post(`/admin/buffet/comandas/${comandaActiva.id}/enviar-cocina`)

      setItemsNuevos([])
      cargarDatos()
      toast.success('Items enviados a cocina')
    } catch (err) {
      console.error('Error:', err)
      toast.error(err.response?.data?.error || 'Error al enviar a cocina')
    }
  }

  // Cargar datos cuando se abre el tab de finalizar
  useEffect(() => {
    async function cargarDatosFinalizacion() {
      if (tabCobroActivo === 'finalizar' && comandaActiva) {
        setDescuentoInfo(null)
        setCobroData(prev => ({ ...prev, aplicarDescuento: true }))

        // Reset estados de cobro
        setDatosVuelto({ montoPagado: 0, vuelto: 0, esSuficiente: false })
        setPropinaData({ porcentaje: 0, monto: 0, esCustom: false })
        setUsarPagosMultiples(false)
        setPagosParciales({ pagos: [], totalPagado: 0, totalPendiente: 0, esCompleto: false })

        // Cargar información de descuento
        if (comandaActiva.socioId) {
          setCargandoDescuento(true)
          try {
            const res = await api.get(`/admin/buffet/comandas/${comandaActiva.id}/descuento`)
            const info = res.data || res
            setDescuentoInfo(info)
          } catch (err) {
            console.error('Error cargando descuento:', err)
          } finally {
            setCargandoDescuento(false)
          }
        }
      }
    }

    cargarDatosFinalizacion()
  }, [tabCobroActivo, comandaActiva])

  async function cobrar() {
    if (!comandaActiva) return

    // Calcular total final (con descuento y propina)
    const totalComanda = Number(comandaActiva.subtotal || comandaActiva.total)
    const montoDescuento = (cobroData.aplicarDescuento && descuentoInfo?.aplicable) ? Number(descuentoInfo.monto) : 0
    const totalConDescuento = totalComanda - montoDescuento
    const totalFinal = totalConDescuento + propinaData.monto

    // Validar pago suficiente (solo si no usa pagos múltiples)
    if (!usarPagosMultiples && !datosVuelto.esSuficiente && mediosPago.find(m => m.id === parseInt(cobroData.medioPagoId))?.codigo === 'EFECTIVO') {
      toast.error('El monto pagado es insuficiente')
      return
    }

    // Validar pagos múltiples completos
    if (usarPagosMultiples && !pagosParciales.esCompleto) {
      toast.error('Debe completar el pago total')
      return
    }

    try {
      const medioPagoSeleccionado = mediosPago.find(m => m.id === parseInt(cobroData.medioPagoId))

      await api.post(`/admin/buffet/comandas/${comandaActiva.id}/cobrar`, {
        cajaId: parseInt(cobroData.cajaId),
        medioPagoId: parseInt(cobroData.medioPagoId),
        aplicarDescuento: cobroData.aplicarDescuento && descuentoInfo?.aplicable,
        propina: propinaData.monto > 0 ? propinaData.monto : undefined,
        pagosParciales: usarPagosMultiples ? pagosParciales.pagos : undefined
      })

      // Generar y mostrar ticket
      const ticketData = generarTicketComanda({
        ...comandaActiva,
        medioPago: medioPagoSeleccionado,
        descuento: montoDescuento,
        porcentajeDescuento: cobroData.aplicarDescuento && descuentoInfo?.aplicable ? descuentoInfo.porcentaje : 0,
        propina: propinaData.monto,
        totalFinal,
        vuelto: !usarPagosMultiples && mediosPago.find(m => m.id === parseInt(cobroData.medioPagoId))?.codigo === 'EFECTIVO' ? datosVuelto.vuelto : 0
      }, 'CUENTA')
      await imprimirTicket(ticketData)

      setTabCobroActivo('cuenta')
      toast.success('Cobro realizado exitosamente')

      // Si hay más comandas activas, quedarse en la mesa; sino, volver al dashboard
      const comandasRestantes = comandas.filter(c => c.id !== comandaActiva.id)
      if (comandasRestantes.length > 0) {
        setComandaActiva(comandasRestantes[0])
        cargarDatos()
      } else {
        navigate('/admin/buffet')
      }
    } catch (err) {
      console.error('Error:', err)
      toast.error(err.response?.data?.error || 'Error al cobrar')
    }
  }

  // Ver preview de cuenta sin cobrar
  function verPreviewCuenta() {
    if (!comandaActiva) return
    const medioPagoSeleccionado = mediosPago.find(m => m.id === parseInt(cobroData.medioPagoId))
    const ticketData = generarTicketComanda({
      ...comandaActiva,
      medioPago: medioPagoSeleccionado,
      descuento: cobroData.aplicarDescuento && descuentoInfo?.aplicable ? descuentoInfo.montoDescuento : 0,
      porcentajeDescuento: cobroData.aplicarDescuento && descuentoInfo?.aplicable ? descuentoInfo.porcentaje : 0
    }, 'CUENTA')
    imprimirTicket(ticketData)
  }

  async function cerrarComanda() {
    if (!comandaActiva) return
    try {
      await api.post(`/admin/buffet/comandas/${comandaActiva.id}/cerrar`)

      // Si hay más comandas activas, seleccionar otra; sino, volver
      const comandasRestantes = comandas.filter(c => c.id !== comandaActiva.id)
      if (comandasRestantes.length > 0) {
        setComandaActiva(comandasRestantes[0])
        cargarDatos()
      } else {
        navigate('/admin/buffet')
      }
    } catch (err) {
      console.error('Error:', err)
      toast.error(err.response?.data?.error || 'Error al cerrar comanda')
    }
  }

  const productosFiltrados = productos.filter(p => {
    const matchCategoria = !categoriaActiva || p.categoriaMenuId === categoriaActiva
    const matchBusqueda = !busqueda ||
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.descripcion?.toLowerCase().includes(busqueda.toLowerCase())
    return matchCategoria && matchBusqueda
  })

  const totalNuevos = itemsNuevos.reduce((sum, item) => sum + Number(item.precio) * item.cantidad, 0)
  const tiempoAbierta = comandaActiva?.horaApertura
    ? Math.floor((new Date() - new Date(comandaActiva.horaApertura)) / 60000)
    : 0

  async function marcarMesaLibre() {
    try {
      await api.put(`/admin/buffet/mesas/${mesaId}/estado`, { estado: 'LIBRE' })
      toast.success('Mesa marcada como libre')
      navigate('/admin/buffet')
    } catch (err) {
      console.error('Error cambiando estado:', err)
      toast.error('Error al cambiar estado de mesa')
    }
  }

  const getColorEstadoItem = (estado) => {
    switch (estado) {
      case 'PENDIENTE': return 'bg-gray-100 text-gray-800'
      case 'ENVIADO_COCINA': return 'bg-blue-100 text-blue-800'
      case 'EN_PREPARACION': return 'bg-yellow-100 text-yellow-800'
      case 'LISTO': return 'bg-green-100 text-green-800'
      case 'ENTREGADO': return 'bg-gray-100 text-gray-600'
      case 'ANULADO': return 'bg-red-100 text-red-800 line-through'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div></div>
  }

  if (!mesa) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Mesa no encontrada</p>
        <button onClick={() => navigate('/admin/buffet')} className="mt-4 text-blue-600 hover:underline">
          Volver al dashboard
        </button>
      </div>
    )
  }

  // Si no hay comanda activa
  if (!comandaActiva) {
    // Mesa comunal puede tener comandas existentes para seleccionar
    if (mesa.esComunal && comandas.length > 0) {
      return (
        <div className="max-w-lg mx-auto mt-12 p-6 bg-white rounded-lg shadow">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold mb-2">Mesa {mesa.numero}</h1>
            <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium mb-2">
              Mesa Comunal
            </span>
            <p className="text-gray-500">
              {mesa.nombre && <span className="block">{mesa.nombre}</span>}
              Capacidad: {mesa.capacidad} personas
            </p>
          </div>

          <div className="mb-6">
            <p className="text-sm text-gray-600 font-medium mb-3">Comandas activas:</p>
            <div className="grid gap-3">
              {comandas.map(c => {
                const nombreDisplay = c.socio
                  ? (c.socio.apellidoNombre || `${c.socio.apellido}, ${c.socio.nombre}`)
                  : c.observaciones || null
                const esVacia = !c.items || c.items.length === 0

                return (
                  <div
                    key={c.id}
                    onClick={() => seleccionarComanda(c)}
                    className="w-full p-4 bg-white border-2 border-gray-200 rounded-xl text-left hover:border-red-400 hover:shadow-md transition-all group cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          c.socio ? 'bg-red-50' : c.observaciones ? 'bg-purple-100' : 'bg-gray-100'
                        }`}>
                          {c.socio ? (
                            <img src="/images/logo.png" alt="Socio" className="w-6 h-6 object-contain" title="Socio del club" />
                          ) : c.observaciones ? (
                            <Users size={20} className="text-purple-600" />
                          ) : (
                            <ShoppingCart size={20} className="text-gray-500" />
                          )}
                        </div>
                        <div>
                          {nombreDisplay ? (
                            <>
                              <p className="font-bold text-gray-800 group-hover:text-red-600">{nombreDisplay}</p>
                              <p className="text-xs text-gray-500">Comanda #{c.numero}</p>
                            </>
                          ) : (
                            <p className="font-bold text-gray-800 group-hover:text-red-600">Comanda #{c.numero}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="text-right">
                          <p className="text-lg font-bold text-green-600">{formatCurrency(c.total || 0, { showSymbol: false })}</p>
                          <StatusBadge status={c.estado} type="comanda" size="sm" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); abrirEditarComanda(c); }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded"
                            title="Editar comanda"
                          >
                            <Edit3 size={14} />
                          </button>
                          {esVacia && (
                            <button
                              onClick={(e) => { e.stopPropagation(); solicitarEliminarComanda(c); }}
                              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-100 rounded"
                              title="Eliminar comanda vacía"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      {c.items?.length || 0} items
                    </div>
                  </div>
                )
              })}

              {/* Tarjeta Nueva Comanda */}
              <button
                onClick={abrirModalNuevaComanda}
                className="w-full p-4 border-2 border-dashed border-purple-300 bg-purple-50 rounded-xl text-center hover:border-purple-400 hover:bg-purple-100 transition-all"
              >
                <div className="flex items-center justify-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-purple-200 flex items-center justify-center">
                    <Plus size={24} className="text-purple-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-purple-700">Nuevo Grupo</p>
                    <p className="text-xs text-purple-600">Abrir otra comanda</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <button
            onClick={() => navigate('/admin/buffet')}
            className="w-full mt-4 text-gray-500 hover:text-gray-700"
          >
            ← Volver al dashboard
          </button>

        </div>
      )
    }

    // Mesa en limpieza - mostrar botón para marcar como libre
    if (mesa.estado === 'LIMPIEZA') {
      return (
        <div className="max-w-md mx-auto mt-12 p-6 bg-white rounded-lg shadow">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <UtensilsCrossed size={32} className="text-gray-400" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Mesa {mesa.numero}</h1>
            <span className="inline-block px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm font-medium mb-4">
              En Limpieza
            </span>
            <p className="text-gray-500 mb-6">
              Esta mesa está siendo limpiada.<br />
              Márquela como libre cuando esté lista.
            </p>
            <button
              onClick={marcarMesaLibre}
              className="w-full px-6 py-4 bg-green-600 text-white font-bold text-lg rounded-lg hover:bg-green-700"
            >
              ✓ Marcar como Libre
            </button>
            <button
              onClick={() => navigate('/admin/buffet')}
              className="mt-4 text-gray-500 hover:text-gray-700"
            >
              ← Volver al dashboard
            </button>
          </div>
        </div>
      )
    }

    // Mesa normal o comunal sin comandas
    return (
      <div className="max-w-md mx-auto mt-12 p-6 bg-white rounded-lg shadow">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Mesa {mesa.numero}</h1>
          {mesa.esComunal && (
            <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium mb-2">
              Mesa Comunal
            </span>
          )}
          <p className="text-gray-500 mb-6">
            {mesa.nombre && <span className="block">{mesa.nombre}</span>}
            Capacidad: {mesa.capacidad} personas
          </p>
          <button
            onClick={mesa.esComunal ? abrirModalNuevaComanda : abrirComandaDirecta}
            className={`w-full px-6 py-4 text-white font-bold text-lg rounded-lg flex items-center justify-center gap-2 ${
              mesa.esComunal ? 'bg-purple-600 hover:bg-purple-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            <Users size={24} />
            Abrir Comanda
          </button>
          <button
            onClick={() => navigate('/admin/buffet')}
            className="mt-4 text-gray-500 hover:text-gray-700"
          >
            ← Volver al dashboard
          </button>
        </div>
      </div>
    )
  }

  const cantidadItemsCarrito = itemsNuevos.reduce((sum, item) => sum + item.cantidad, 0) + (comandaActiva?.items?.length || 0)

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-100px)]">
      {/* Header - Móvil */}
      <div className="bg-white border-b p-3 md:hidden">
        {/* Primera línea: Mesa + Tipo + Campana */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/admin/buffet')}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-lg font-bold flex items-center gap-2">
              Mesa {mesa.numero}
              {mesa.esComunal && (
                <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-800 rounded-full">
                  Comunal
                </span>
              )}
            </h1>
          </div>
          <NotificacionBuffet />
        </div>

        {/* Segunda línea: Tiempo + Estado + Info socio/grupo */}
        <div className="flex items-center justify-between mt-2 ml-11">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span className="flex items-center gap-1">
              <Clock size={14} />
              {tiempoAbierta}m
            </span>
            <StatusBadge status={comandaActiva.estado} type="comanda" size="md" />
          </div>
          {!mesa.esComunal && (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-gray-500">#{comandaActiva.numero}</span>
              {comandaActiva.socio && (
                <span className="flex items-center gap-1 text-gray-800 font-medium">
                  <img src="/images/logo.png" alt="" className="w-3.5 h-3.5 object-contain" />
                  {(comandaActiva.socio.apellidoNombre || comandaActiva.socio.nombre)?.split(' ')[0]}
                </span>
              )}
              {!comandaActiva.socio && comandaActiva.observaciones && (
                <span className="text-purple-600 font-medium">{comandaActiva.observaciones.split(' ')[0]}</span>
              )}
            </div>
          )}
        </div>

        {/* Tarjetas de comandas activas - Móvil - Mesas comunales */}
        {mesa.esComunal && (
          <div className="flex gap-2 mt-2 overflow-x-auto pb-1 -mx-3 px-3">
            {comandas.map(c => {
              const nombreDisplay = c.socio
                ? (c.socio.apellidoNombre || c.socio.nombre)?.split(' ')[0] || `#${c.numero}`
                : c.observaciones?.split(' ')[0] || `#${c.numero}`
              const esActiva = c.id === comandaActiva.id
              const esVacia = !c.items || c.items.length === 0

              return (
                <div
                  key={c.id}
                  onClick={() => seleccionarComanda(c)}
                  className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg border-2 transition-all cursor-pointer min-w-[80px] ${
                    esActiva
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {c.socio && (
                      <img src="/images/logo.png" alt="" className="w-3.5 h-3.5 object-contain flex-shrink-0" />
                    )}
                    <span className={`font-medium text-xs truncate max-w-[60px] ${esActiva ? 'text-red-700' : 'text-gray-700'}`}>
                      {nombreDisplay}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className={`text-xs font-bold ${esActiva ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(c.total || 0, { showSymbol: false })}
                    </span>
                    <div className="flex gap-0.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); abrirEditarComanda(c); }}
                        className="p-0.5 text-gray-400"
                      >
                        <Edit3 size={10} />
                      </button>
                      {esVacia && (
                        <button
                          onClick={(e) => { e.stopPropagation(); solicitarEliminarComanda(c); }}
                          className="p-0.5 text-red-400"
                        >
                          <Trash2 size={10} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Botón Nueva Comanda */}
            <button
              onClick={abrirModalNuevaComanda}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg border-2 border-dashed border-purple-300 bg-purple-50 flex items-center gap-1"
            >
              <Plus size={14} className="text-purple-600" />
              <span className="text-xs font-medium text-purple-600">Nuevo</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabs para móvil */}
      <div className="md:hidden flex border-b bg-white">
        <button
          onClick={() => setTabActivo('productos')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 font-medium transition-colors ${
            tabActivo === 'productos'
              ? 'text-red-600 border-b-2 border-red-600 bg-red-50'
              : 'text-gray-600'
          }`}
        >
          <UtensilsCrossed size={18} />
          Menú
        </button>
        <button
          onClick={() => setTabActivo('carrito')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 font-medium transition-colors relative ${
            tabActivo === 'carrito'
              ? 'text-red-600 border-b-2 border-red-600 bg-red-50'
              : 'text-gray-600'
          }`}
        >
          <ShoppingCart size={18} />
          Pedido
          {cantidadItemsCarrito > 0 && (
            <span className="absolute top-2 right-1/4 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {cantidadItemsCarrito}
            </span>
          )}
        </button>
      </div>

      {/* Panel Izquierdo - Productos (oculto en móvil cuando está en tab carrito) */}
      <div className={`flex-1 flex flex-col overflow-hidden ${tabActivo === 'carrito' ? 'hidden md:flex' : 'flex'}`}>
        {/* Header - Solo Desktop */}
        <div className="hidden md:block bg-white border-b p-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/admin/buffet')}
                className="p-2 hover:bg-gray-100 rounded"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-xl font-bold">
                  Mesa {mesa.numero}
                  {mesa.esComunal && (
                    <span className="ml-2 px-2 py-0.5 text-xs bg-purple-100 text-purple-800 rounded-full">
                      Comunal
                    </span>
                  )}
                </h1>
                {!mesa.esComunal && (
                  <p className="text-sm text-gray-500">Comanda #{comandaActiva.numero}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <Clock size={16} />
                {tiempoAbierta} min
              </span>
              {comandaActiva.socio && (
                <span className="flex items-center gap-1.5 text-gray-800 font-medium">
                  <img src="/images/logo.png" alt="Socio" className="w-5 h-5 object-contain" title="Socio del club" />
                  {comandaActiva.socio.apellidoNombre || `${comandaActiva.socio.apellido}, ${comandaActiva.socio.nombre}`}
                </span>
              )}
              {!comandaActiva.socio && comandaActiva.observaciones && (
                <span className="flex items-center gap-1 text-purple-600">
                  <Users size={16} />
                  {comandaActiva.observaciones}
                </span>
              )}
              <StatusBadge status={comandaActiva.estado} type="comanda" size="sm" />
            </div>
          </div>

          {/* Tarjetas de comandas activas - Mesas comunales */}
          {mesa.esComunal && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
              {comandas.map(c => {
                const nombreDisplay = c.socio
                  ? (c.socio.apellidoNombre || `${c.socio.apellido}, ${c.socio.nombre}`)
                  : c.observaciones || `Comanda #${c.numero}`
                const esActiva = c.id === comandaActiva.id

                const esVacia = !c.items || c.items.length === 0

                return (
                  <div
                    key={c.id}
                    className={`flex-shrink-0 px-4 py-2 rounded-lg border-2 transition-all cursor-pointer relative ${
                      esActiva
                        ? 'border-red-500 bg-red-50 shadow-md'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow'
                    }`}
                    onClick={() => seleccionarComanda(c)}
                  >
                    <div className="flex items-center gap-2">
                      {c.socio ? (
                        <img src="/images/logo.png" alt="Socio" className="w-4 h-4 object-contain" title="Socio del club" />
                      ) : c.observaciones ? (
                        <Users size={14} className={esActiva ? 'text-red-600' : 'text-purple-600'} />
                      ) : (
                        <ShoppingCart size={14} className={esActiva ? 'text-red-600' : 'text-gray-500'} />
                      )}
                      <span className={`font-medium text-sm ${esActiva ? 'text-red-700' : 'text-gray-700'}`}>
                        {nombreDisplay}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); abrirEditarComanda(c); }}
                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded"
                        title="Editar comanda"
                      >
                        <Edit3 size={12} />
                      </button>
                      {esVacia && (
                        <button
                          onClick={(e) => { e.stopPropagation(); solicitarEliminarComanda(c); }}
                          className="p-1 text-red-400 hover:text-red-600 hover:bg-red-100 rounded"
                          title="Eliminar comanda vacía"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">#{c.numero}</span>
                      <span className={`text-sm font-bold ${esActiva ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(c.total || 0, { showSymbol: false })}
                      </span>
                    </div>
                  </div>
                )
              })}

              {/* Botón Nueva Comanda */}
              <button
                onClick={abrirModalNuevaComanda}
                className="flex-shrink-0 px-4 py-2 rounded-lg border-2 border-dashed border-purple-300 bg-purple-50 hover:border-purple-400 hover:bg-purple-100 transition-all flex flex-col items-center justify-center"
              >
                <Plus size={18} className="text-purple-600" />
                <span className="text-xs font-medium text-purple-600 mt-1">Nuevo Grupo</span>
              </button>
            </div>
          )}
        </div>

        {/* Barra de búsqueda */}
        <div className="p-3 md:p-4 bg-white border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar producto..."
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Categorías - Scroll horizontal */}
        <div className="flex gap-2 p-3 md:p-4 bg-gray-50 border-b overflow-x-auto">
          <button
            onClick={() => setCategoriaActiva(null)}
            className={`px-3 md:px-4 py-2 rounded-lg whitespace-nowrap text-sm md:text-base font-medium transition-colors ${
              categoriaActiva === null
                ? 'bg-gray-800 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Todos
          </button>
          {categorias.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategoriaActiva(cat.id)}
              className={`px-3 md:px-4 py-2 rounded-lg whitespace-nowrap text-sm md:text-base font-medium transition-colors ${
                categoriaActiva === cat.id
                  ? 'text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
              style={categoriaActiva === cat.id ? { backgroundColor: cat.color || '#DC2626' } : {}}
            >
              {cat.nombre}
            </button>
          ))}
        </div>

        {/* Grid de Productos */}
        <div className="flex-1 overflow-y-auto p-3 md:p-4 bg-gray-100">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-3">
            {productosFiltrados.map(prod => (
              <button
                key={prod.id}
                onClick={() => {
                  agregarItem(prod)
                  // En móvil, mostrar feedback visual
                  if (window.innerWidth < 768) {
                    toast.success(`+1 ${prod.nombre}`, { duration: 1000, position: 'bottom-center' })
                  }
                }}
                className="bg-white rounded-lg p-2 md:p-3 text-left hover:shadow-lg transition-all border-2 border-transparent hover:border-red-500 active:scale-95 flex gap-2 md:gap-3"
              >
                {prod.imagen ? (
                  <img
                    src={prod.imagen}
                    alt={prod.nombre}
                    className="w-12 h-12 md:w-14 md:h-14 object-cover rounded-lg flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 md:w-14 md:h-14 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center">
                    <Coffee size={20} className="text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-xs md:text-sm line-clamp-2 leading-tight">{prod.nombre}</h3>
                  <p className="text-sm md:text-base font-bold text-green-600 mt-1">
                    {formatCurrency(prod.precio, { showSymbol: false })}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Panel Derecho - Resumen con Tabs (oculto en móvil cuando está en tab productos) */}
      <div className={`md:w-[480px] bg-white md:border-l flex flex-col ${tabActivo === 'productos' ? 'hidden md:flex' : 'flex flex-1'}`}>
        {/* Tabs Navigation */}
        <div className="flex border-b flex-shrink-0">
          <button
            onClick={() => setTabCobroActivo('cuenta')}
            className={`flex-1 px-4 py-3 font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
              tabCobroActivo === 'cuenta'
                ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FileText size={18} />
            Cuenta
          </button>
          <button
            onClick={() => setTabCobroActivo('finalizar')}
            disabled={Number(comandaActiva.total) === 0}
            className={`flex-1 px-4 py-3 font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              tabCobroActivo === 'finalizar'
                ? 'bg-white text-green-600 border-b-2 border-green-600'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <DollarSign size={18} />
            Finalizar
          </button>
        </div>

        {/* Tab Content: Cuenta */}
        {tabCobroActivo === 'cuenta' && (
          <>
            {/* Items de la comanda */}
            <div className="flex-1 overflow-y-auto">
              {/* Items existentes */}
              {comandaActiva.items?.length > 0 && (
                <div className="p-3 md:p-4 border-b">
                  <h3 className="font-bold text-gray-700 mb-2 md:mb-3 text-sm md:text-base">Items pedidos</h3>
              <div className="space-y-2">
                {comandaActiva.items.map(item => (
                  <div
                    key={item.id}
                    className={`p-2 md:p-3 rounded-lg ${getColorEstadoItem(item.estado)}`}
                  >
                    <div className="flex justify-between gap-2">
                      <span className="font-medium text-sm md:text-base flex-1 min-w-0 truncate">
                        {item.cantidad}x {item.productoBuffet?.nombre}
                      </span>
                      <span className="text-sm md:text-base font-medium">{formatCurrency(item.subtotal, { showSymbol: false })}</span>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <StatusBadge status={item.estado} type="itemComanda" size="sm" />
                      {item.observaciones && (
                        <span className="italic text-gray-600 truncate max-w-[150px]">{item.observaciones}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Nuevos items a agregar */}
          {itemsNuevos.length > 0 && (
            <div className="p-3 md:p-4 border-b bg-yellow-50">
              <h3 className="font-bold text-yellow-800 mb-2 md:mb-3 text-sm md:text-base">Por enviar a cocina</h3>
              <div className="space-y-2">
                {itemsNuevos.map((item, index) => (
                  <div key={index} className="p-2 md:p-3 bg-white rounded-lg border border-yellow-200">
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm md:text-base block truncate">{item.nombre}</span>
                        <p className="text-xs md:text-sm text-gray-500">{formatCurrency(item.precio, { showSymbol: false })}</p>
                      </div>
                      <div className="flex items-center gap-1 md:gap-2">
                        <button
                          onClick={() => modificarCantidadNuevo(index, -1)}
                          className="p-1.5 md:p-1 bg-gray-100 rounded active:bg-gray-200"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-6 text-center font-bold text-sm md:text-base">{item.cantidad}</span>
                        <button
                          onClick={() => modificarCantidadNuevo(index, 1)}
                          className="p-1.5 md:p-1 bg-gray-100 rounded active:bg-gray-200"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <span className="w-16 md:w-20 text-right font-bold text-sm md:text-base">
                        {formatCurrency(Number(item.precio) * item.cantidad, { showSymbol: false })}
                      </span>
                    </div>
                    <div className="mt-2">
                      <input
                        type="text"
                        value={item.observaciones}
                        onChange={e => setObservacion(index, e.target.value)}
                        placeholder="Observaciones..."
                        className="w-full text-sm border border-gray-200 rounded px-2 py-1.5"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {comandaActiva.items?.length === 0 && itemsNuevos.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400 p-4">
              <ShoppingCart size={48} className="mb-2 opacity-50" />
              <p className="text-center">El pedido está vacío</p>
              <p className="text-sm text-center mt-1 md:hidden">Ve a la pestaña "Menú" para agregar productos</p>
              <p className="text-sm text-center mt-1 hidden md:block">Selecciona productos del menú</p>
            </div>
          )}
        </div>

        {/* Footer - Totales y acciones */}
        <div className="border-t p-3 md:p-4 space-y-3 md:space-y-4 bg-white">
          {/* Resumen */}
          <div className="space-y-1 md:space-y-2 text-sm">
            {Number(comandaActiva.total) > 0 && (
              <div className="flex justify-between">
                <span>Subtotal comanda:</span>
                <span className="font-medium">{formatCurrency(comandaActiva.total, { showSymbol: false })}</span>
              </div>
            )}
            {totalNuevos > 0 && (
              <div className="flex justify-between text-yellow-700">
                <span>+ Nuevos items:</span>
                <span className="font-medium">{formatCurrency(totalNuevos, { showSymbol: false })}</span>
              </div>
            )}
            <div className="flex justify-between text-base md:text-lg font-bold pt-2 border-t">
              <span>TOTAL:</span>
              <span className="text-green-600">
                {formatCurrency(Number(comandaActiva.total) + totalNuevos, { showSymbol: false })}
              </span>
            </div>
          </div>

          {/* Botones */}
          <div className="space-y-2">
            {itemsNuevos.length > 0 && (
              <button
                onClick={enviarACocina}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-yellow-500 text-white font-bold rounded-lg hover:bg-yellow-600 active:bg-yellow-700 text-sm md:text-base"
              >
                <Send size={18} />
                Enviar a Cocina ({formatCurrency(totalNuevos, { showSymbol: false })})
              </button>
            )}

            {comandaActiva.estado !== 'CERRADA' && tienePermiso(PERMISOS.BUFFET_COBRAR) && (
              <button
                onClick={() => setTabCobroActivo('finalizar')}
                disabled={Number(comandaActiva.total) === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 active:bg-green-800 disabled:opacity-50 text-sm md:text-base"
              >
                <DollarSign size={18} />
                Ir a Finalizar ({formatCurrency(comandaActiva.total, { showSymbol: false })})
              </button>
            )}

            {comandaActiva.estado === 'CERRADA' && (
              <button
                onClick={cerrarComanda}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 text-white font-bold rounded-lg hover:bg-gray-700 active:bg-gray-800 text-sm md:text-base"
              >
                Cerrar Comanda
              </button>
            )}
          </div>
        </div>
          </>
        )}

        {/* Tab Content: Finalizar */}
        {tabCobroActivo === 'finalizar' && (
          <>
            <div className="p-3 py-2 border-b bg-green-50 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700">
                  Cobro - Mesa {mesa.numero}
                </h3>
                <button
                  onClick={() => setTabCobroActivo('cuenta')}
                  className="text-blue-600 text-xs hover:underline font-medium"
                >
                  ← Ver Cuenta
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {/* Propina */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Propina:</label>
                <PropinaSelector
                  subtotal={Number(comandaActiva.subtotal || comandaActiva.total) -
                            (cobroData.aplicarDescuento && descuentoInfo?.aplicable ? Number(descuentoInfo.monto) : 0)}
                  onPropinaChange={(data) => setPropinaData(data)}
                  compact={true}
                />
              </div>

              {/* Total destacado */}
              <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-3 border-2 border-green-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-700">Total a Cobrar:</span>
                  <span className="text-2xl font-bold text-green-600 tabular-nums">
                    ${((Number(comandaActiva.subtotal || comandaActiva.total) -
                        (cobroData.aplicarDescuento && descuentoInfo?.aplicable ? Number(descuentoInfo.monto) : 0) +
                        propinaData.monto)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {comandaActiva.socio && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <img src="/images/logo.png" alt="Socio" className="w-4 h-4 object-contain" />
                    <span className="font-medium">
                      {comandaActiva.socio.apellidoNombre || `${comandaActiva.socio.apellido}, ${comandaActiva.socio.nombre}`}
                    </span>
                  </div>
                )}
              </div>

              {/* Resumen de descuentos */}
              {descuentoInfo && descuentoInfo.aplicable && (
                <label className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded cursor-pointer">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={cobroData.aplicarDescuento}
                      onChange={e => setCobroData({ ...cobroData, aplicarDescuento: e.target.checked })}
                      className="rounded text-green-600 focus:ring-green-500"
                    />
                    <div className="flex items-center gap-1 text-green-700">
                      <Percent size={14} />
                      <span className="text-xs font-medium">{descuentoInfo.motivo}</span>
                    </div>
                  </div>
                  <span className="text-green-700 font-bold text-sm">-{formatCurrency(descuentoInfo.monto, { showSymbol: false })}</span>
                </label>
              )}

              {/* Calculadora de Vuelto (solo para efectivo en modo pago simple) */}
              {!usarPagosMultiples && mediosPago.find(m => m.id === parseInt(cobroData.medioPagoId))?.codigo === 'EFECTIVO' && (
                <CalculadoraVuelto
                  total={Number(comandaActiva.subtotal || comandaActiva.total) -
                        (cobroData.aplicarDescuento && descuentoInfo?.aplicable ? Number(descuentoInfo.monto) : 0) +
                        propinaData.monto}
                  medioPagoSeleccionado={mediosPago.find(m => m.id === parseInt(cobroData.medioPagoId))}
                  onVueltoCalculado={(datos) => setDatosVuelto(datos)}
                  compact={true}
                />
              )}

              {/* Selector de Caja */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Caja:</label>
                <select
                  value={cobroData.cajaId}
                  onChange={e => setCobroData({ ...cobroData, cajaId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-200 outline-none"
                >
                  {cajas.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Selector de Medio de Pago */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Medio de Pago:</label>
                <SelectorMedioPago
                  mediosPago={mediosPago}
                  selectedId={cobroData.medioPagoId}
                  onChange={(id) => setCobroData({ ...cobroData, medioPagoId: id })}
                  compact={true}
                />
              </div>

              {/* Pagos Múltiples */}
              {usarPagosMultiples && (
                <PagoMultiple
                  total={Number(comandaActiva.subtotal || comandaActiva.total) -
                        (cobroData.aplicarDescuento && descuentoInfo?.aplicable ? Number(descuentoInfo.monto) : 0) +
                        propinaData.monto}
                  mediosPago={mediosPago}
                  onPagosChange={(datos) => setPagosParciales(datos)}
                />
              )}
            </div>

            {/* Footer - Botones de acción */}
            <div className="border-t p-3 space-y-2 flex-shrink-0">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setModalSplit(true)}
                  className="px-3 py-2 border-2 border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50 font-medium transition flex items-center gap-2 text-xs"
                >
                  <Users size={16} />
                  Dividir
                </button>

                <button
                  onClick={() => setUsarPagosMultiples(!usarPagosMultiples)}
                  className={`px-3 py-2 border-2 rounded-lg font-medium transition text-xs ${
                    usarPagosMultiples
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-blue-300 text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  {usarPagosMultiples ? 'Simple' : 'Múltiple'}
                </button>
              </div>

              <button
                onClick={cobrar}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold transition active:scale-95"
              >
                <CheckCircle size={20} />
                COBRAR ${((Number(comandaActiva.subtotal || comandaActiva.total) -
                    (cobroData.aplicarDescuento && descuentoInfo?.aplicable ? Number(descuentoInfo.monto) : 0) +
                    propinaData.monto)).toLocaleString()}
              </button>
            </div>
          </>
        )}
      </div>


      {/* Modal Split Cuenta */}
      <SplitCuenta
        isOpen={modalSplit}
        onClose={() => setModalSplit(false)}
        comanda={comandaActiva}
        onAplicar={(resultado) => {
          console.log('Split aplicado:', resultado)
          toast.success('División aplicada - Funcionalidad en desarrollo')
          setModalSplit(false)
        }}
      />

      {/* Modal Nueva Comanda */}
      <Modal
        isOpen={modalNuevaComanda}
        onClose={() => setModalNuevaComanda(false)}
        title={
          <div className="flex items-center gap-2">
            <Users className="text-purple-600" size={24} />
            Nueva Comanda - Mesa {mesa?.numero}
          </div>
        }
        maxWidth="max-w-md"
      >
        {mesa?.esComunal && (
          <p className="text-sm text-gray-500 mb-4">
            Mesa comunal: puede identificar cada grupo por socio o nombre
          </p>
        )}

        {/* Buscar Socio */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Asignar a Socio (opcional)
          </label>
          {nuevaComandaData.socioId ? (
            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2">
                <User size={18} className="text-green-600" />
                <span className="font-medium">{nuevaComandaData.socioNombre}</span>
              </div>
              <button
                onClick={limpiarSocio}
                className="text-red-500 hover:text-red-700"
              >
                <X size={18} />
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={nuevaComandaData.buscarSocio}
                onChange={e => {
                  setNuevaComandaData({ ...nuevaComandaData, buscarSocio: e.target.value })
                  buscarSocios(e.target.value)
                }}
                placeholder="Buscar por nombre o N° socio..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10"
              />
              {buscandoSocio && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                </div>
              )}
              {sociosBusqueda.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                  {sociosBusqueda.map(socio => (
                    <button
                      key={socio.id}
                      onClick={() => seleccionarSocio(socio)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-medium">{socio.apellidoNombre || `${socio.apellido}, ${socio.nombre}`}</span>
                        <span className="text-sm text-gray-500 ml-2">#{socio.nroSocio}</span>
                      </div>
                      {!socio.tieneDeuda && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Al día</span>
                      )}
                      {socio.tieneDeuda && (
                        <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">Con deuda</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Nombre del grupo (alternativa) */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {mesa?.esComunal ? 'Nombre del Grupo (alternativa)' : 'Observaciones (opcional)'}
          </label>
          <input
            type="text"
            value={nuevaComandaData.nombreGrupo}
            onChange={e => setNuevaComandaData({ ...nuevaComandaData, nombreGrupo: e.target.value })}
            placeholder={mesa?.esComunal ? 'Ej: "Familia López", "Cumple Juan"' : 'Observaciones de la mesa'}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          />
        </div>

        {/* Centro de Costo */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Centro de Costo
          </label>
          <SelectCentroCosto
            value={nuevaComandaData.centroCostoId}
            onChange={(val) => setNuevaComandaData({ ...nuevaComandaData, centroCostoId: val })}
            className="w-full"
          />
          <p className="text-xs text-gray-500 mt-1">Opcional - para reportes contables</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setModalNuevaComanda(false)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={confirmarNuevaComanda}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Abrir Comanda
          </button>
        </div>
      </Modal>

      {/* Modal Confirmar Eliminar */}
      <Modal
        isOpen={modalConfirmarEliminar}
        onClose={() => {
          setModalConfirmarEliminar(false)
          setComandaAEliminar(null)
        }}
        maxWidth="max-w-sm"
      >
        <div className="text-center mb-4">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Trash2 size={24} className="text-red-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-800">Eliminar Comanda</h2>
          <p className="text-gray-600 mt-2">
            ¿Eliminar la comanda #{comandaAEliminar?.numero}?
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Esta acción no se puede deshacer.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setModalConfirmarEliminar(false); setComandaAEliminar(null); }}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={confirmarEliminarComanda}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Eliminar
          </button>
        </div>
      </Modal>

      {/* Modal Editar Comanda */}
      <Modal
        isOpen={modalEditarComanda}
        onClose={() => {
          setModalEditarComanda(false)
          setComandaAEditar(null)
        }}
        title={
          <div className="flex items-center gap-2">
            <Edit3 className="text-blue-600" size={24} />
            Editar Comanda #{comandaAEditar?.numero}
          </div>
        }
        maxWidth="max-w-md"
      >
        {/* Buscar Socio */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Socio asignado
          </label>
          {editarComandaData.socioId ? (
            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2">
                <User size={18} className="text-green-600" />
                <span className="font-medium">{editarComandaData.socioNombre}</span>
              </div>
              <button
                onClick={limpiarSocioEditar}
                className="text-red-500 hover:text-red-700"
              >
                <X size={18} />
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={editarComandaData.buscarSocio}
                onChange={e => {
                  setEditarComandaData({ ...editarComandaData, buscarSocio: e.target.value })
                  buscarSocios(e.target.value)
                }}
                placeholder="Buscar por nombre o N° socio..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10"
              />
              {buscandoSocio && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                </div>
              )}
              {sociosBusqueda.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                  {sociosBusqueda.map(socio => (
                    <button
                      key={socio.id}
                      onClick={() => seleccionarSocioEditar(socio)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-medium">{socio.apellidoNombre || `${socio.apellido}, ${socio.nombre}`}</span>
                        <span className="text-sm text-gray-500 ml-2">#{socio.nroSocio}</span>
                      </div>
                      {!socio.tieneDeuda && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Al día</span>
                      )}
                      {socio.tieneDeuda && (
                        <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">Con deuda</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Nombre del grupo */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre / Observaciones
          </label>
          <input
            type="text"
            value={editarComandaData.nombreGrupo}
            onChange={e => setEditarComandaData({ ...editarComandaData, nombreGrupo: e.target.value })}
            placeholder='Ej: "Familia López", "Cumple Juan"'
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => { setModalEditarComanda(false); setComandaAEditar(null); }}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={confirmarEditarComanda}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Guardar Cambios
          </button>
        </div>
      </Modal>
    </div>
  );
}
