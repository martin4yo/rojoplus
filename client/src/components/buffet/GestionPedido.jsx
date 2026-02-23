import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Plus, Minus, Send, DollarSign, Clock, User, ShoppingCart, UtensilsCrossed, Coffee, Search, X, Users, Percent, CheckCircle, AlertCircle, Trash2, Edit3, FileText, Package, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../services/api'
import { tienePermiso, PERMISOS } from '../../services/permisos'
import { useTicket } from '../../contexts/TicketContext'
import SelectCentroCosto from '../SelectCentroCosto'
import StatusBadge from '../StatusBadge'
import { formatCurrency } from '../../utils/formatters'
import Modal from '../Modal'
import CalculadoraVuelto from './CalculadoraVuelto'
import SelectorMedioPago from './SelectorMedioPago'
import PropinaSelector from './PropinaSelector'
import SplitCuenta from './SplitCuenta'
import PagoMultiple from './PagoMultiple'

/**
 * Componente universal para gestión de pedidos
 * Soporta tanto mesas de buffet como pedidos takeaway
 *
 * @param {Object} props
 * @param {'mesa'|'takeaway'} props.tipo - Tipo de entidad
 * @param {number} props.id - ID de la mesa o pedido
 * @param {Function} props.onVolver - Callback para volver al dashboard
 * @param {Function} props.onActualizar - Callback opcional cuando hay cambios
 */
export default function GestionPedido({ tipo = 'mesa', id, onVolver, onActualizar }) {
  const { generarTicketComanda, imprimirTicket } = useTicket()

  // Estados principales
  const [entidad, setEntidad] = useState(null) // Mesa o Pedido
  const [comandas, setComandas] = useState([]) // Todas las comandas activas
  const [comandaActiva, setComandaActiva] = useState(null) // Comanda seleccionada
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
  const [tabActivo, setTabActivo] = useState('productos') // 'productos' | 'carrito' (solo móvil)

  // Modal nueva comanda (solo mesas comunales)
  const [modalNuevaComanda, setModalNuevaComanda] = useState(false)
  const [nuevaComandaData, setNuevaComandaData] = useState({ buscarSocio: '', socioId: null, socioNombre: '', nombreGrupo: '', centroCostoId: '' })
  const [sociosBusqueda, setSociosBusqueda] = useState([])
  const [buscandoSocio, setBuscandoSocio] = useState(false)

  // Modal confirmar eliminar comanda
  const [modalConfirmarEliminar, setModalConfirmarEliminar] = useState(false)
  const [comandaAEliminar, setComandaAEliminar] = useState(null)

  // Modal editar comanda
  const [modalEditarComanda, setModalEditarComanda] = useState(false)
  const [comandaAEditar, setComandaAEditar] = useState(null)
  const [editarComandaData, setEditarComandaData] = useState({ buscarSocio: '', socioId: null, socioNombre: '', nombreGrupo: '' })

  // Estados para cobro
  const [datosVuelto, setDatosVuelto] = useState({ montoPagado: 0, vuelto: 0, esSuficiente: false })
  const [propinaData, setPropinaData] = useState({ porcentaje: 0, monto: 0, esCustom: false })
  const [modalSplit, setModalSplit] = useState(false)
  const [pagosParciales, setPagosParciales] = useState({ pagos: [], totalPagado: 0, totalPendiente: 0, esCompleto: false })
  const [usarPagosMultiples, setUsarPagosMultiples] = useState(false)
  const [tabCobroActivo, setTabCobroActivo] = useState('cuenta') // 'cuenta' o 'finalizar'

  // Configuración según tipo
  const config = {
    mesa: {
      endpoint: `/admin/buffet/mesas/${id}`,
      tipoVenta: 'BUFFET',
      configCajas: '/admin/buffet/config/cajas/buffet',
      configMediosPago: '/admin/buffet/config/medios-pago/buffet',
      textos: {
        entidad: 'Mesa',
        numero: entidad?.numero || '',
        accionFinal: 'Cerrar Mesa',
        irFinalizar: 'Ir a Finalizar'
      }
    },
    takeaway: {
      endpoint: `/admin/buffet/takeaway/${id}`,
      tipoVenta: 'TAKEAWAY',
      configCajas: '/admin/buffet/config/cajas/takeaway',
      configMediosPago: '/admin/buffet/config/medios-pago/takeaway',
      textos: {
        entidad: 'Pedido',
        numero: entidad?.numero || '',
        accionFinal: 'Marcar Entregado',
        irFinalizar: 'Ir a Cobrar'
      }
    }
  }

  const cfg = config[tipo]

  // ==================== CARGA DE DATOS ====================

  const cargarDatos = useCallback(async () => {
    try {
      // Cargar la entidad (mesa o pedido)
      const entidadRes = await api.get(cfg.endpoint)

      if (!entidadRes) {
        console.error('No se recibió respuesta de la entidad')
        setLoading(false)
        return
      }

      const entidadData = entidadRes.data || entidadRes
      setEntidad(entidadData)

      // Para TakeAway: el pedido mismo es la comanda única
      // Para Mesa: puede tener múltiples comandas si es comunal
      let todasComandas = []

      if (tipo === 'takeaway') {
        // El pedido es la comanda
        todasComandas = [{
          id: entidadData.id,
          numero: entidadData.numero,
          socio: entidadData.socio,
          observaciones: entidadData.nombreCliente,
          items: entidadData.items || [],
          total: entidadData.total || 0,
          subtotal: entidadData.subtotal || 0,
          estado: entidadData.estado,
          horaApertura: entidadData.horaRecibido,
          centroCosto: entidadData.centroCosto
        }]
      } else {
        // Mesa con sus comandas
        todasComandas = entidadData.comandas || []
      }

      setComandas(todasComandas)

      // Seleccionar comanda activa
      if (todasComandas.length > 0) {
        setComandaActiva(prev => {
          if (prev && todasComandas.find(c => c.id === prev.id)) {
            return todasComandas.find(c => c.id === prev.id)
          }
          return todasComandas[0]
        })
      } else {
        setComandaActiva(null)
      }

      // Cargar productos, categorías, cajas y medios de pago
      const [prodRes, catRes, cajasRes, mediosRes] = await Promise.all([
        api.get(`/admin/buffet/productos?disponible=true&activo=true&tipoVenta=${cfg.tipoVenta}`),
        api.get('/admin/buffet/categorias?activo=true'),
        api.get(cfg.configCajas),
        api.get(cfg.configMediosPago)
      ])

      const productos = prodRes.data || prodRes || []
      const categorias = catRes.data || catRes || []
      const cajas = cajasRes.data || cajasRes || []
      const medios = mediosRes.data || mediosRes || []

      setProductos(productos)

      // Solo categorías con productos del tipo correspondiente
      const categoriasConProductos = categorias.filter(cat =>
        productos.some(p => p.categoriaMenuId === cat.id)
      )
      setCategorias(categoriasConProductos)

      setCajas(cajas)
      setMediosPago(medios)

      if (cajas.length > 0) {
        setCobroData(prev => ({ ...prev, cajaId: prev.cajaId || cajas[0].id }))
      }
      const efectivo = medios.find(m => m.codigo === 'EFECTIVO')
      if (efectivo) {
        setCobroData(prev => ({ ...prev, medioPagoId: prev.medioPagoId || efectivo.id }))
      } else if (medios.length > 0) {
        setCobroData(prev => ({ ...prev, medioPagoId: prev.medioPagoId || medios[0].id }))
      }

      // Callback de actualización
      if (onActualizar) {
        onActualizar(entidadData)
      }
    } catch (err) {
      console.error('Error cargando datos:', err)
      toast.error('Error al cargar los datos')
    } finally {
      setLoading(false)
    }
  }, [id, tipo, cfg.endpoint, cfg.tipoVenta, cfg.configCajas, cfg.configMediosPago, onActualizar])

  useEffect(() => {
    cargarDatos()
    const interval = setInterval(cargarDatos, 30000)
    return () => clearInterval(interval)
  }, [cargarDatos])

  // Si es takeaway pagado/entregado/cancelado y está en tab finalizar, cambiar a cuenta
  useEffect(() => {
    if (tipo === 'takeaway' && entidad && ['PAGADO', 'ENTREGADO', 'CANCELADO'].includes(entidad.estado)) {
      if (tabCobroActivo === 'finalizar') {
        setTabCobroActivo('cuenta')
      }
    }
  }, [tipo, entidad, tabCobroActivo])

  // ==================== FUNCIONES DE ITEMS ====================

  function agregarItem(producto) {
    const existente = itemsNuevos.findIndex(item => item.productoBuffetId === producto.id)
    if (existente >= 0) {
      const nuevos = [...itemsNuevos]
      nuevos[existente].cantidad++
      setItemsNuevos(nuevos)
    } else {
      setItemsNuevos([...itemsNuevos, {
        productoBuffetId: producto.id,
        nombre: producto.nombre,
        precio: producto.precio,
        cantidad: 1,
        observaciones: ''
      }])
    }
  }

  function modificarCantidadNuevo(index, delta) {
    const nuevos = [...itemsNuevos]
    nuevos[index].cantidad += delta
    if (nuevos[index].cantidad <= 0) {
      nuevos.splice(index, 1)
    }
    setItemsNuevos(nuevos)
  }

  function setObservacion(index, texto) {
    const nuevos = [...itemsNuevos]
    nuevos[index].observaciones = texto
    setItemsNuevos(nuevos)
  }

  async function enviarACocina() {
    if (itemsNuevos.length === 0) return

    try {
      const endpoint = tipo === 'mesa'
        ? `/admin/buffet/comandas/${comandaActiva.id}/items`
        : `/admin/buffet/takeaway/${id}/items`

      await api.post(endpoint, { items: itemsNuevos })

      setItemsNuevos([])
      toast.success('Items enviados a cocina')
      await cargarDatos()
    } catch (err) {
      console.error('Error enviando items:', err)
      toast.error(err.response?.data?.error || 'Error al enviar items')
    }
  }

  async function marcarItemEntregado(itemId) {
    try {
      const endpoint = tipo === 'mesa'
        ? `/admin/buffet/comandas/${comandaActiva.id}/items/${itemId}/entregar`
        : `/admin/buffet/takeaway/${id}/items/${itemId}/entregar`

      await api.post(endpoint)

      toast.success('Item marcado como entregado')
      await cargarDatos()
    } catch (err) {
      console.error('Error marcando item:', err)
      toast.error(err.response?.data?.error || 'Error al marcar item')
    }
  }

  // ==================== FUNCIONES DE COBRO ====================

  async function cobrar() {
    if (!comandaActiva) return

    const totalConPropina = Number(comandaActiva.subtotal || comandaActiva.total) -
      (cobroData.aplicarDescuento && descuentoInfo?.aplicable ? Number(descuentoInfo.monto) : 0) +
      propinaData.monto

    // Validación de vuelto si es efectivo
    const medioPago = mediosPago.find(m => m.id === parseInt(cobroData.medioPagoId))
    if (medioPago?.codigo === 'EFECTIVO' && !usarPagosMultiples) {
      if (!datosVuelto.esSuficiente) {
        toast.error('El monto pagado es insuficiente')
        return
      }
    }

    try {
      let requestData

      if (usarPagosMultiples) {
        if (!pagosParciales.esCompleto) {
          toast.error('El total de pagos no cubre el monto total')
          return
        }
        requestData = {
          pagos: pagosParciales.pagos,
          propina: propinaData.monto,
          aplicarDescuento: cobroData.aplicarDescuento && descuentoInfo?.aplicable
        }
      } else {
        requestData = {
          cajaId: parseInt(cobroData.cajaId),
          medioPagoId: parseInt(cobroData.medioPagoId),
          montoPagado: medioPago?.codigo === 'EFECTIVO' ? datosVuelto.montoPagado : totalConPropina,
          propina: propinaData.monto,
          aplicarDescuento: cobroData.aplicarDescuento && descuentoInfo?.aplicable
        }
      }

      const endpoint = tipo === 'mesa'
        ? `/admin/buffet/comandas/${comandaActiva.id}/cobrar`
        : `/admin/buffet/takeaway/${id}/cobrar`

      const res = await api.post(endpoint, requestData)

      toast.success(tipo === 'mesa' ? 'Comanda cobrada' : 'Pedido cobrado')

      // Generar e imprimir ticket
      if (res.data?.ticket || res.data?.data?.ticket) {
        const ticketData = res.data?.ticket || res.data?.data?.ticket
        imprimirTicket(ticketData)
      }

      // Reset estados
      setPropinaData({ porcentaje: 0, monto: 0, esCustom: false })
      setDatosVuelto({ montoPagado: 0, vuelto: 0, esSuficiente: false })
      setUsarPagosMultiples(false)
      setPagosParciales({ pagos: [], totalPagado: 0, totalPendiente: 0, esCompleto: false })
      setTabCobroActivo('cuenta')

      await cargarDatos()

      // Para TakeAway cobrado, volver al dashboard
      if (tipo === 'takeaway') {
        setTimeout(() => {
          if (onVolver) onVolver()
        }, 1500)
      }
    } catch (err) {
      console.error('Error al cobrar:', err)
      toast.error(err.response?.data?.error || 'Error al procesar el cobro')
    }
  }

  async function marcarEntregado() {
    if (tipo !== 'takeaway') return

    try {
      await api.post(`/admin/buffet/takeaway/${id}/entregar`)
      toast.success('Pedido marcado como entregado')

      setTimeout(() => {
        if (onVolver) onVolver()
      }, 1500)
    } catch (err) {
      console.error('Error al marcar entregado:', err)
      toast.error(err.response?.data?.error || 'Error al marcar como entregado')
    }
  }

  async function cerrarComanda() {
    if (tipo !== 'mesa') return

    try {
      await api.post(`/admin/buffet/comandas/${comandaActiva.id}/cerrar`)
      toast.success('Comanda cerrada')
      await cargarDatos()

      // Si era la última comanda, marcar mesa en limpieza
      if (comandas.length === 1) {
        await api.put(`/admin/buffet/mesas/${id}`, { estado: 'LIMPIEZA' })
        if (onVolver) onVolver()
      }
    } catch (err) {
      console.error('Error cerrando comanda:', err)
      toast.error(err.response?.data?.error || 'Error al cerrar')
    }
  }

  // ==================== FUNCIONES PARA MESAS COMUNALES ====================

  async function abrirModalNuevaComanda() {
    setNuevaComandaData({ buscarSocio: '', socioId: null, socioNombre: '', nombreGrupo: '', centroCostoId: '' })
    setSociosBusqueda([])
    setModalNuevaComanda(true)
  }

  async function buscarSocios(query) {
    if (!query || query.length < 2) {
      setSociosBusqueda([])
      return
    }

    try {
      setBuscandoSocio(true)
      const res = await api.get(`/admin/socios?busqueda=${encodeURIComponent(query)}&activo=true&limit=10`)
      setSociosBusqueda(res.data || res || [])
    } catch (err) {
      console.error('Error buscando socios:', err)
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

  async function crearNuevaComanda(e) {
    e.preventDefault()

    try {
      await api.post('/admin/buffet/comandas', {
        mesaId: id,
        socioId: nuevaComandaData.socioId,
        observaciones: nuevaComandaData.nombreGrupo,
        centroCostoId: nuevaComandaData.centroCostoId ? parseInt(nuevaComandaData.centroCostoId) : null
      })

      toast.success('Nueva comanda creada')
      setModalNuevaComanda(false)
      await cargarDatos()
    } catch (err) {
      console.error('Error creando comanda:', err)
      toast.error(err.response?.data?.error || 'Error al crear comanda')
    }
  }

  async function abrirComandaDirecta() {
    try {
      await api.post('/admin/buffet/comandas', { mesaId: id })
      toast.success('Comanda abierta')
      await cargarDatos()
    } catch (err) {
      console.error('Error abriendo comanda:', err)
      toast.error(err.response?.data?.error || 'Error al abrir comanda')
    }
  }

  function seleccionarComanda(comanda) {
    setComandaActiva(comanda)
    setItemsNuevos([])
    setTabActivo('productos')
  }

  function solicitarEliminarComanda(comanda) {
    setComandaAEliminar(comanda)
    setModalConfirmarEliminar(true)
  }

  async function eliminarComanda() {
    if (!comandaAEliminar) return

    try {
      await api.delete(`/admin/buffet/comandas/${comandaAEliminar.id}`)
      toast.success('Comanda eliminada')
      setModalConfirmarEliminar(false)
      setComandaAEliminar(null)
      await cargarDatos()
    } catch (err) {
      console.error('Error eliminando comanda:', err)
      toast.error(err.response?.data?.error || 'Error al eliminar')
    }
  }

  function abrirEditarComanda(comanda) {
    setComandaAEditar(comanda)
    setEditarComandaData({
      socioId: comanda.socio?.id || null,
      socioNombre: comanda.socio ? (comanda.socio.apellidoNombre || `${comanda.socio.apellido}, ${comanda.socio.nombre}`) : '',
      nombreGrupo: comanda.observaciones || '',
      buscarSocio: ''
    })
    setModalEditarComanda(true)
  }

  async function guardarEdicionComanda(e) {
    e.preventDefault()

    try {
      await api.put(`/admin/buffet/comandas/${comandaAEditar.id}`, {
        socioId: editarComandaData.socioId,
        observaciones: editarComandaData.nombreGrupo
      })

      toast.success('Comanda actualizada')
      setModalEditarComanda(false)
      await cargarDatos()
    } catch (err) {
      console.error('Error actualizando comanda:', err)
      toast.error(err.response?.data?.error || 'Error al actualizar')
    }
  }

  async function marcarMesaLibre() {
    try {
      await api.put(`/admin/buffet/mesas/${id}`, { estado: 'LIBRE' })
      toast.success('Mesa marcada como libre')
      if (onVolver) onVolver()
    } catch (err) {
      console.error('Error marcando mesa libre:', err)
      toast.error(err.response?.data?.error || 'Error al marcar mesa')
    }
  }

  // ==================== DESCUENTO (SOLO MESAS CON SOCIO) ====================

  useEffect(() => {
    if (tipo === 'mesa' && comandaActiva?.socio && cobroData.aplicarDescuento) {
      cargarDescuentoSocio()
    } else {
      setDescuentoInfo(null)
    }
  }, [comandaActiva?.socio, cobroData.aplicarDescuento, tipo])

  async function cargarDescuentoSocio() {
    if (!comandaActiva?.socio) return

    try {
      setCargandoDescuento(true)
      const res = await api.get(`/admin/socios/${comandaActiva.socio.id}/descuento-buffet`)
      setDescuentoInfo(res.data || res || null)
    } catch (err) {
      console.error('Error cargando descuento:', err)
      setDescuentoInfo(null)
    } finally {
      setCargandoDescuento(false)
    }
  }

  // ==================== UTILIDADES ====================

  function getColorEstadoItem(estado) {
    const colores = {
      'PENDIENTE': 'bg-yellow-50 border border-yellow-200',
      'ENVIADO_COCINA': 'bg-blue-50 border border-blue-200',
      'ENVIADO_BARRA': 'bg-blue-50 border border-blue-200',
      'LISTO': 'bg-green-50 border border-green-200',
      'ENTREGADO': 'bg-gray-50 border border-gray-200',
      'ANULADO': 'bg-red-50 border border-red-200'
    }
    return colores[estado] || 'bg-white border border-gray-200'
  }

  const productosFiltrados = productos.filter(p => {
    const matchCategoria = categoriaActiva === null || p.categoriaMenuId === categoriaActiva
    const matchBusqueda = !busqueda ||
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.codigoBarras?.includes(busqueda)
    return matchCategoria && matchBusqueda
  })

  const totalNuevos = itemsNuevos.reduce((sum, item) => sum + (Number(item.precio) * item.cantidad), 0)

  const tiempoAbierta = comandaActiva?.horaApertura
    ? Math.floor((new Date() - new Date(comandaActiva.horaApertura)) / 60000)
    : 0

  // ==================== RENDER - ESTADOS PREVIOS ====================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  if (!entidad) {
    return (
      <div className="max-w-md mx-auto mt-12 p-6 bg-white rounded-lg shadow text-center">
        <AlertCircle size={48} className="mx-auto mb-4 text-red-500" />
        <p className="text-gray-600 mb-4">No se encontró {cfg.textos.entidad.toLowerCase()}</p>
        <button
          onClick={onVolver}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          Volver
        </button>
      </div>
    )
  }

  // Para MESA: Mostrar selector de comanda si es comunal y no hay comanda seleccionada
  if (tipo === 'mesa' && entidad.esComunal && comandas.length > 0 && !comandaActiva) {
    return (
      <div className="max-w-2xl mx-auto mt-8 p-6 bg-white rounded-lg shadow">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-2">Mesa {entidad.numero}</h1>
          <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium mb-2">
            Mesa Comunal
          </span>
          <p className="text-gray-500">
            {entidad.nombre && <span className="block">{entidad.nombre}</span>}
            Capacidad: {entidad.capacidad} personas
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
          onClick={onVolver}
          className="w-full mt-4 text-gray-500 hover:text-gray-700"
        >
          ← Volver al dashboard
        </button>
      </div>
    )
  }

  // Para MESA: Mesa en limpieza
  if (tipo === 'mesa' && entidad.estado === 'LIMPIEZA') {
    return (
      <div className="max-w-md mx-auto mt-12 p-6 bg-white rounded-lg shadow">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <UtensilsCrossed size={32} className="text-gray-400" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Mesa {entidad.numero}</h1>
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
            onClick={onVolver}
            className="mt-4 text-gray-500 hover:text-gray-700"
          >
            ← Volver al dashboard
          </button>
        </div>
      </div>
    )
  }

  // Para MESA: Mesa libre o comunal sin comandas - permitir abrir comanda
  if (tipo === 'mesa' && (!comandas || comandas.length === 0)) {
    return (
      <>
        <div className="max-w-md mx-auto mt-12 p-6 bg-white rounded-lg shadow">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Mesa {entidad.numero}</h1>
            {entidad.esComunal && (
              <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium mb-2">
                Mesa Comunal
              </span>
            )}
            <p className="text-gray-500 mb-6">
              {entidad.nombre && <span className="block">{entidad.nombre}</span>}
              Capacidad: {entidad.capacidad} personas
            </p>
            <button
              onClick={entidad.esComunal ? abrirModalNuevaComanda : abrirComandaDirecta}
              className={`w-full px-6 py-4 text-white font-bold text-lg rounded-lg flex items-center justify-center gap-2 ${
                entidad.esComunal ? 'bg-purple-600 hover:bg-purple-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              <Users size={24} />
              Abrir Comanda
            </button>
            <button
              onClick={onVolver}
              className="mt-4 text-gray-500 hover:text-gray-700"
            >
              ← Volver al dashboard
            </button>
          </div>
        </div>

        {/* Modal Nueva Comanda - Para mesas comunales */}
        {entidad.esComunal && modalNuevaComanda && (
          <Modal
            title="Nueva Comanda"
            isOpen={modalNuevaComanda}
            onClose={() => setModalNuevaComanda(false)}
          >
            <form onSubmit={crearNuevaComanda} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Buscar Socio (opcional):</label>
                {nuevaComandaData.socioId ? (
                  <div className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <img src="/images/logo.png" alt="Socio" className="w-5 h-5 object-contain" />
                      <span className="font-medium">{nuevaComandaData.socioNombre}</span>
                    </div>
                    <button
                      type="button"
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
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
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
                            type="button"
                            onClick={() => seleccionarSocio(socio)}
                            className="w-full px-4 py-2 text-left hover:bg-gray-50"
                          >
                            <span className="font-medium">{socio.apellidoNombre || `${socio.apellido}, ${socio.nombre}`}</span>
                            <span className="text-sm text-gray-500 ml-2">#{socio.nroSocio}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Grupo (opcional):</label>
                <input
                  type="text"
                  value={nuevaComandaData.nombreGrupo}
                  onChange={e => setNuevaComandaData({ ...nuevaComandaData, nombreGrupo: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Ej: Familia García"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Centro de Costo:</label>
                <SelectCentroCosto
                  value={nuevaComandaData.centroCostoId}
                  onChange={value => setNuevaComandaData({ ...nuevaComandaData, centroCostoId: value })}
                />
              </div>

              <button
                type="submit"
                className="w-full bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 font-medium"
              >
                Crear Comanda
              </button>
            </form>
          </Modal>
        )}
      </>
    )
  }

  // Para TAKEAWAY: Si no tiene items y estado RECIBIDO, mostrar mensaje inicial
  if (tipo === 'takeaway' && entidad.estado === 'RECIBIDO' && (!entidad.items || entidad.items.length === 0) && itemsNuevos.length === 0) {
    // Mostrar interfaz normal pero vacía - no hay pantalla especial
  }

  // ==================== RENDER PRINCIPAL - INTERFAZ DE GESTIÓN ====================

  const cantidadItemsCarrito = itemsNuevos.reduce((sum, item) => sum + item.cantidad, 0) + (comandaActiva?.items?.length || 0)

  return (
    <>
      <div className="flex flex-col md:flex-row h-[calc(100vh-100px)]">
        {/* Header - Móvil */}
        <div className="bg-white border-b p-3 md:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={onVolver}
                className="p-2 hover:bg-gray-100 rounded"
              >
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-lg font-bold flex items-center gap-2">
                {cfg.textos.entidad} {cfg.textos.numero}
                {tipo === 'mesa' && entidad.esComunal && (
                  <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-800 rounded-full">
                    Comunal
                  </span>
                )}
                {tipo === 'takeaway' && (
                  <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
                    Pedidos
                  </span>
                )}
              </h1>
            </div>
          </div>

          {/* Selector de comandas - Solo mesas comunales */}
          {tipo === 'mesa' && entidad.esComunal && (
            <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
              {comandas.map(c => {
                const nombreDisplay = c.socio
                  ? (c.socio.apellidoNombre || `${c.socio.apellido}, ${c.socio.nombre}`)
                  : c.observaciones || `#${c.numero}`
                const esActiva = c.id === comandaActiva.id
                const esVacia = !c.items || c.items.length === 0

                return (
                  <div
                    key={c.id}
                    onClick={() => seleccionarComanda(c)}
                    className={`flex-shrink-0 px-2 py-1 rounded-lg border transition cursor-pointer ${
                      esActiva ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white'
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
            {tipo === 'mesa' ? 'Pedido' : 'Cuenta'}
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
                  onClick={onVolver}
                  className="p-2 hover:bg-gray-100 rounded"
                >
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <h1 className="text-xl font-bold">
                    {cfg.textos.entidad} {cfg.textos.numero}
                    {tipo === 'mesa' && entidad.esComunal && (
                      <span className="ml-2 px-2 py-0.5 text-xs bg-purple-100 text-purple-800 rounded-full">
                        Comunal
                      </span>
                    )}
                    {tipo === 'takeaway' && (
                      <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
                        Pedidos
                      </span>
                    )}
                  </h1>
                  {tipo === 'mesa' && !entidad.esComunal && (
                    <p className="text-sm text-gray-500">Comanda #{comandaActiva.numero}</p>
                  )}
                  {tipo === 'takeaway' && (
                    <p className="text-sm text-gray-500">{entidad.nombreCliente}</p>
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
                {!comandaActiva.socio && comandaActiva.observaciones && tipo === 'mesa' && (
                  <span className="flex items-center gap-1 text-purple-600">
                    <Users size={16} />
                    {comandaActiva.observaciones}
                  </span>
                )}
                <StatusBadge status={comandaActiva.estado} type={tipo === 'mesa' ? 'comanda' : 'pedidoTakeAway'} size="sm" />
              </div>
            </div>

            {/* Tarjetas de comandas activas - Mesas comunales */}
            {tipo === 'mesa' && entidad.esComunal && (
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
              className={`${
                // Si es takeaway pagado/entregado, ocupa todo el ancho
                tipo === 'takeaway' && ['PAGADO', 'ENTREGADO', 'CANCELADO'].includes(entidad.estado)
                  ? 'w-full'
                  : 'flex-1'
              } px-4 py-3 font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
                tabCobroActivo === 'cuenta'
                  ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <FileText size={18} />
              Cuenta
            </button>
            {/* Ocultar tab Finalizar si es takeaway y ya está pagado/entregado/cancelado */}
            {!(tipo === 'takeaway' && ['PAGADO', 'ENTREGADO', 'CANCELADO'].includes(entidad.estado)) && (
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
            )}
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
                          <div className="flex justify-between gap-2 items-start">
                            <span className="font-medium text-sm md:text-base flex-1 min-w-0 truncate">
                              {item.cantidad}x {item.productoBuffet?.nombre}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm md:text-base font-medium">{formatCurrency(item.subtotal, { showSymbol: false })}</span>
                              {/* Botón para marcar como entregado - Solo si está LISTO */}
                              {item.estado === 'LISTO' && (
                                <button
                                  onClick={() => marcarItemEntregado(item.id)}
                                  className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors active:scale-95"
                                  title="Marcar como entregado"
                                >
                                  <Check size={16} />
                                </button>
                              )}
                            </div>
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
                      <span>Subtotal {tipo === 'mesa' ? 'comanda' : 'pedido'}:</span>
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

                  {/* Botón Finalizar/Cobrar - Solo si hay total */}
                  {((tipo === 'mesa' && comandaActiva.estado !== 'CERRADA') ||
                    (tipo === 'takeaway' && !['PAGADO', 'ENTREGADO', 'CANCELADO'].includes(entidad.estado))) &&
                    tienePermiso(PERMISOS.BUFFET_COBRAR) && (
                    <button
                      onClick={() => setTabCobroActivo('finalizar')}
                      disabled={Number(comandaActiva.total) === 0}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 active:bg-green-800 disabled:opacity-50 text-sm md:text-base"
                    >
                      <DollarSign size={18} />
                      {cfg.textos.irFinalizar} ({formatCurrency(comandaActiva.total, { showSymbol: false })})
                    </button>
                  )}

                  {/* Botón Cerrar Comanda (mesa) */}
                  {tipo === 'mesa' && comandaActiva.estado === 'CERRADA' && (
                    <button
                      onClick={cerrarComanda}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 text-white font-bold rounded-lg hover:bg-gray-700 active:bg-gray-800 text-sm md:text-base"
                    >
                      {cfg.textos.accionFinal}
                    </button>
                  )}

                  {/* Botón Marcar Entregado (takeaway) */}
                  {tipo === 'takeaway' && entidad.estado === 'PAGADO' && (
                    <button
                      onClick={marcarEntregado}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 active:bg-blue-800 text-sm md:text-base"
                    >
                      <Package size={18} />
                      {cfg.textos.accionFinal}
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
                    Cobro - {cfg.textos.entidad} {cfg.textos.numero}
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
                  {tipo === 'mesa' && comandaActiva.socio && descuentoInfo?.aplicable && cobroData.aplicarDescuento && (
                    <div className="mt-2 text-xs text-green-700 bg-white/50 rounded p-2">
                      ✓ Descuento socio {descuentoInfo.porcentaje}% aplicado (-${Number(descuentoInfo.monto).toFixed(2)})
                    </div>
                  )}
                </div>

                {/* Selector de modo de pago */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setUsarPagosMultiples(false)}
                    className={`flex-1 py-2 rounded-lg font-medium text-sm transition ${
                      !usarPagosMultiples
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Pago Simple
                  </button>
                  <button
                    onClick={() => setUsarPagosMultiples(true)}
                    className={`flex-1 py-2 rounded-lg font-medium text-sm transition ${
                      usarPagosMultiples
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Pagos Múltiples
                  </button>
                </div>

                {/* Pago Simple */}
                {!usarPagosMultiples && (
                  <div className="space-y-3">
                    {/* Selector Medio de Pago */}
                    <SelectorMedioPago
                      mediosPago={mediosPago}
                      medioPagoId={cobroData.medioPagoId}
                      onChange={(id) => {
                        setCobroData({ ...cobroData, medioPagoId: id })
                        setDatosVuelto({ montoPagado: 0, vuelto: 0, esSuficiente: false })
                      }}
                      compact={true}
                    />

                    {/* Calculadora de vuelto (solo efectivo) */}
                    {mediosPago.find(m => m.id === parseInt(cobroData.medioPagoId))?.codigo === 'EFECTIVO' && (
                      <CalculadoraVuelto
                        total={Number(comandaActiva.subtotal || comandaActiva.total) -
                          (cobroData.aplicarDescuento && descuentoInfo?.aplicable ? Number(descuentoInfo.monto) : 0) +
                          propinaData.monto}
                        onVueltoCalculado={(datos) => setDatosVuelto(datos)}
                        medioPagoSeleccionado={mediosPago.find(m => m.id === parseInt(cobroData.medioPagoId))}
                        compact={true}
                      />
                    )}
                  </div>
                )}

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

                {/* Descuento socio (solo mesas) */}
                {tipo === 'mesa' && comandaActiva.socio && descuentoInfo && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cobroData.aplicarDescuento}
                        onChange={e => setCobroData({ ...cobroData, aplicarDescuento: e.target.checked })}
                        className="rounded text-purple-600"
                      />
                      <span className="text-sm font-medium text-purple-900">
                        Aplicar descuento socio {descuentoInfo.porcentaje}%
                      </span>
                    </label>
                    {descuentoInfo.aplicable && cobroData.aplicarDescuento && (
                      <p className="text-xs text-purple-700 mt-1">
                        Ahorro: ${Number(descuentoInfo.monto).toFixed(2)}
                      </p>
                    )}
                    {!descuentoInfo.aplicable && (
                      <p className="text-xs text-red-600 mt-1">{descuentoInfo.motivo}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Footer - Botón cobrar */}
              <div className="border-t p-3 bg-white">
                <button
                  onClick={cobrar}
                  disabled={
                    (mediosPago.find(m => m.id === parseInt(cobroData.medioPagoId))?.codigo === 'EFECTIVO' &&
                      !usarPagosMultiples &&
                      !datosVuelto.esSuficiente) ||
                    (usarPagosMultiples && !pagosParciales.esCompleto)
                  }
                  className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-green-600 text-white font-bold text-lg rounded-lg hover:bg-green-700 active:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle size={24} />
                  Confirmar Cobro
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modales */}
      {/* Modal Nueva Comanda (solo mesas comunales) */}
      {tipo === 'mesa' && modalNuevaComanda && (
        <Modal
            title="Nueva Comanda"
            isOpen={modalNuevaComanda}
            onClose={() => setModalNuevaComanda(false)}
          >
          <form onSubmit={crearNuevaComanda} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Buscar Socio (opcional):</label>
              {nuevaComandaData.socioId ? (
                <div className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <img src="/images/logo.png" alt="Socio" className="w-5 h-5 object-contain" />
                    <span className="font-medium">{nuevaComandaData.socioNombre}</span>
                  </div>
                  <button
                    type="button"
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
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
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
                          type="button"
                          onClick={() => seleccionarSocio(socio)}
                          className="w-full px-4 py-2 text-left hover:bg-gray-50"
                        >
                          <span className="font-medium">{socio.apellidoNombre || `${socio.apellido}, ${socio.nombre}`}</span>
                          <span className="text-sm text-gray-500 ml-2">#{socio.nroSocio}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Grupo (opcional):</label>
              <input
                type="text"
                value={nuevaComandaData.nombreGrupo}
                onChange={e => setNuevaComandaData({ ...nuevaComandaData, nombreGrupo: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Ej: Familia García"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Centro de Costo:</label>
              <SelectCentroCosto
                value={nuevaComandaData.centroCostoId}
                onChange={value => setNuevaComandaData({ ...nuevaComandaData, centroCostoId: value })}
              />
            </div>

            <button
              type="submit"
              className="w-full bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 font-medium"
            >
              Crear Comanda
            </button>
          </form>
        </Modal>
      )}

      {/* Modal Confirmar Eliminar Comanda */}
      {tipo === 'mesa' && modalConfirmarEliminar && (
        <Modal
          title="Confirmar Eliminación"
          isOpen={modalConfirmarEliminar}
          onClose={() => setModalConfirmarEliminar(false)}
        >
          <div className="space-y-4">
            <p className="text-gray-700">
              ¿Estás seguro de eliminar la comanda #{comandaAEliminar?.numero}?
            </p>
            <p className="text-sm text-gray-500">
              Esta acción no se puede deshacer. Solo se pueden eliminar comandas vacías.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setModalConfirmarEliminar(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={eliminarComanda}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Editar Comanda */}
      {tipo === 'mesa' && modalEditarComanda && (
        <Modal
          title="Editar Comanda"
          isOpen={modalEditarComanda}
          onClose={() => setModalEditarComanda(false)}
        >
          <form onSubmit={guardarEdicionComanda} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Socio:</label>
              {editarComandaData.socioId ? (
                <div className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <img src="/images/logo.png" alt="Socio" className="w-5 h-5 object-contain" />
                    <span className="font-medium">{editarComandaData.socioNombre}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditarComandaData({ ...editarComandaData, socioId: null, socioNombre: '' })}
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
                    placeholder="Buscar socio..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
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
                          type="button"
                          onClick={() => setEditarComandaData({
                            ...editarComandaData,
                            socioId: socio.id,
                            socioNombre: socio.apellidoNombre || `${socio.apellido}, ${socio.nombre}`,
                            buscarSocio: ''
                          })}
                          className="w-full px-4 py-2 text-left hover:bg-gray-50"
                        >
                          <span className="font-medium">{socio.apellidoNombre || `${socio.apellido}, ${socio.nombre}`}</span>
                          <span className="text-sm text-gray-500 ml-2">#{socio.nroSocio}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Grupo:</label>
              <input
                type="text"
                value={editarComandaData.nombreGrupo}
                onChange={e => setEditarComandaData({ ...editarComandaData, nombreGrupo: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Nombre opcional"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium"
            >
              Guardar Cambios
            </button>
          </form>
        </Modal>
      )}

      {/* Modal Split Cuenta */}
      {modalSplit && (
        <Modal
          title="Dividir Cuenta"
          isOpen={modalSplit}
          onClose={() => setModalSplit(false)}
          size="lg"
        >
          <SplitCuenta
            items={comandaActiva.items}
            onClose={() => setModalSplit(false)}
          />
        </Modal>
      )}
    </>
  )
}
