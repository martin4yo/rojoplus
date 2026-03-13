import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Clock, Phone, Truck, ShoppingBag, X, Users, CheckCircle, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'
import { useConfirm } from '../../../hooks/useConfirm.jsx'
import PageHeader from '../../../components/PageHeader'
import { formatCurrency } from '../../../utils/formatters'
import StatusBadge from '../../../components/StatusBadge'
import Modal from '../../../components/Modal'
import GestionPedido from '../../../components/buffet/GestionPedido'

export default function BuffetTakeAway() {
  const navigate = useNavigate()
  const { confirm, ConfirmDialog } = useConfirm()

  // Estados principales
  const [modoVista, setModoVista] = useState('dashboard') // 'dashboard' | 'detalle'
  const [pedidoActivo, setPedidoActivo] = useState(null)
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)

  // Modales
  const [modalNuevoPedido, setModalNuevoPedido] = useState(false)

  // Filtro dashboard
  const [filtroEstado, setFiltroEstado] = useState('EN_CURSO') // 'TODOS' | 'EN_CURSO' | 'PAGADOS' | 'ENTREGADOS_HOY'

  // Form nuevo pedido
  const [nuevoPedidoData, setNuevoPedidoData] = useState({
    nombreCliente: '',
    telefono: '',
    tipo: 'RETIRO',
    horaEstimada: '',
    observaciones: '',
    socioId: null,
    socioNombre: '',
    buscarSocio: ''
  })
  const [sociosBusqueda, setSociosBusqueda] = useState([])
  const [buscandoSocio, setBuscandoSocio] = useState(false)

  const cargarPedidos = useCallback(async () => {
    try {
      const res = await api.get('/admin/buffet/takeaway')
      setPedidos(res.data || res || [])
    } catch (err) {
      console.error('Error cargando pedidos:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargarPedidos()
    const interval = setInterval(cargarPedidos, 30000)
    return () => clearInterval(interval)
  }, [cargarPedidos])

  function abrirPedido(pedido) {
    setPedidoActivo(pedido)
    setModoVista('detalle')
  }

  function volverADashboard() {
    setModoVista('dashboard')
    setPedidoActivo(null)
    cargarPedidos()
  }

  async function buscarSocios(query) {
    if (!query || query.length < 2) {
      setSociosBusqueda([])
      return
    }

    try {
      setBuscandoSocio(true)
      const res = await api.get(`/admin/socios?q=${encodeURIComponent(query)}&estadosValidos=ACTIVO,VIGENTE&limit=10`)
      setSociosBusqueda(res?.socios || [])
    } catch (err) {
      console.error('Error buscando socios:', err)
    } finally {
      setBuscandoSocio(false)
    }
  }

  function seleccionarSocio(socio) {
    setNuevoPedidoData({
      ...nuevoPedidoData,
      socioId: socio.id,
      socioNombre: socio.apellidoNombre || `${socio.apellido}, ${socio.nombre}`,
      buscarSocio: ''
    })
    setSociosBusqueda([])
  }

  function limpiarSocio() {
    setNuevoPedidoData({
      ...nuevoPedidoData,
      socioId: null,
      socioNombre: '',
      buscarSocio: ''
    })
  }

  async function crearNuevoPedido(e) {
    e.preventDefault()

    try {
      const res = await api.post('/admin/buffet/takeaway', {
        nombreCliente: nuevoPedidoData.nombreCliente,
        telefono: nuevoPedidoData.telefono || null,
        tipo: nuevoPedidoData.tipo,
        socioId: nuevoPedidoData.socioId,
        horaEstimada: nuevoPedidoData.horaEstimada ? new Date(nuevoPedidoData.horaEstimada).toISOString() : null,
        observaciones: nuevoPedidoData.observaciones || null,
        items: []
      })

      toast.success('Pedido creado')
      setModalNuevoPedido(false)
      setNuevoPedidoData({
        nombreCliente: '',
        telefono: '',
        tipo: 'RETIRO',
        horaEstimada: '',
        observaciones: '',
        socioId: null,
        socioNombre: '',
        buscarSocio: ''
      })

      await cargarPedidos()

      // Abrir el pedido recién creado
      const pedidoCreado = res.data || res
      abrirPedido(pedidoCreado)
    } catch (err) {
      console.error('Error creando pedido:', err)
      toast.error(err.response?.data?.error || 'Error al crear pedido')
    }
  }

  // Filtrar pedidos según filtro
  const pedidosFiltrados = pedidos.filter(p => {
    if (filtroEstado === 'EN_CURSO') {
      return ['RECIBIDO', 'PENDIENTE', 'EN_PREPARACION', 'LISTO'].includes(p.estado)
    }
    if (filtroEstado === 'PAGADOS') {
      return p.estado === 'PAGADO'
    }
    if (filtroEstado === 'ENTREGADOS_HOY') {
      if (p.estado !== 'ENTREGADO') return false
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      const horaEntregado = new Date(p.horaEntregado)
      return horaEntregado >= hoy
    }
    return true // TODOS
  })

  function getTipoIcon(tipo) {
    if (tipo === 'DELIVERY') return <Truck size={16} />
    if (tipo === 'PEDIDOSYA') return <ShoppingBag size={16} />
    if (tipo === 'RAPPI') return <ShoppingBag size={16} />
    return <ShoppingBag size={16} />
  }

  function getTipoLabel(tipo) {
    if (tipo === 'DELIVERY') return 'Delivery'
    if (tipo === 'PEDIDOSYA') return 'PedidosYa'
    if (tipo === 'RAPPI') return 'Rappi'
    return 'Retiro'
  }

  function tiempoTranscurrido(pedido) {
    if (!pedido.horaRecibido) return 0
    const ahora = new Date()
    const recibido = new Date(pedido.horaRecibido)
    return Math.floor((ahora - recibido) / 60000) // minutos
  }

  function tiempoColor(pedido) {
    const mins = tiempoTranscurrido(pedido)
    if (mins < 15) return 'text-green-600'
    if (mins < 30) return 'text-yellow-600'
    return 'text-red-600'
  }

  async function marcarEntregado(pedido, e) {
    e.stopPropagation() // Evitar abrir el detalle
    try {
      await api.post(`/admin/buffet/takeaway/${pedido.id}/entregar`)
      toast.success(`Pedido #${pedido.numero} marcado como entregado`)
      cargarPedidos()
    } catch (err) {
      console.error('Error marcando como entregado:', err)
      toast.error(err.response?.data?.error || 'Error al marcar como entregado')
    }
  }

  async function eliminarPedido(pedido, e) {
    e.stopPropagation() // Evitar abrir el detalle

    const confirmado = await confirm({
      title: 'Eliminar Pedido',
      message: `¿Estás seguro de que deseas eliminar el pedido #${pedido.numero}?`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      isDangerous: true
    })

    if (!confirmado) return

    try {
      await api.delete(`/admin/buffet/takeaway/${pedido.id}`)
      toast.success(`Pedido #${pedido.numero} eliminado`)
      cargarPedidos()
    } catch (err) {
      console.error('Error eliminando pedido:', err)
      toast.error(err.response?.data?.error || 'Error al eliminar pedido')
    }
  }

  function puedeEliminar(pedido) {
    // Solo se puede eliminar si NO está pagado o entregado
    return !['PAGADO', 'ENTREGADO'].includes(pedido.estado)
  }

  if (loading) {
    return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div></div>
  }

  // ==================== VISTA DETALLE ====================
  // Usar componente unificado GestionPedido

  if (modoVista === 'detalle' && pedidoActivo) {
    return (
      <GestionPedido
        tipo="takeaway"
        id={pedidoActivo.id}
        onVolver={volverADashboard}
        onActualizar={(pedidoActualizado) => {
          setPedidoActivo(pedidoActualizado)
        }}
      />
    )
  }

  // ==================== VISTA DASHBOARD ====================

  return (
    <div className="space-y-6">
      <PageHeader icon={ShoppingBag} title="Pedidos TakeAway" subtitle={`${pedidosFiltrados.length} pedidos`}>
        {/* Filtros */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setFiltroEstado('EN_CURSO')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filtroEstado === 'EN_CURSO' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            En Curso
          </button>
          <button
            onClick={() => setFiltroEstado('PAGADOS')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filtroEstado === 'PAGADOS' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Pagados
          </button>
          <button
            onClick={() => setFiltroEstado('ENTREGADOS_HOY')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filtroEstado === 'ENTREGADOS_HOY' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Entregados Hoy
          </button>
          <button
            onClick={() => setFiltroEstado('TODOS')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filtroEstado === 'TODOS' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Todos
          </button>
        </div>

        {tienePermiso(PERMISOS.BUFFET_MESAS) && (
          <button
            onClick={() => setModalNuevoPedido(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
          >
            <Plus size={18} />
            Nuevo Pedido
          </button>
        )}
      </PageHeader>

      {/* Grid de Pedidos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {pedidosFiltrados.map(pedido => (
          <div
            key={pedido.id}
            onClick={() => abrirPedido(pedido)}
            className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-green-500"
          >
            {/* Header del pedido */}
            <div className="p-4 border-b bg-gradient-to-r from-green-50 to-white">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-lg text-gray-900">#{pedido.numero}</h3>
                    <StatusBadge status={pedido.estado} type="pedidoTakeAway" size="sm" />
                  </div>
                  <p className="font-medium text-gray-700">{pedido.nombreCliente}</p>
                  {pedido.socio && (
                    <div className="flex items-center gap-1 text-xs text-gray-600 mt-1">
                      <img src="/images/logo.png" alt="Socio" className="w-4 h-4 object-contain" />
                      <span>Socio #{pedido.socio.nroSocio}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-lg border border-gray-200">
                    {getTipoIcon(pedido.tipo)}
                    <span className="text-xs font-medium text-gray-700">
                      {getTipoLabel(pedido.tipo)}
                    </span>
                  </div>
                  {pedido.telefono && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Phone size={12} />
                      <span>{pedido.telefono}</span>
                    </div>
                  )}
                  {/* Icono de eliminar - solo si se puede eliminar */}
                  {puedeEliminar(pedido) && tienePermiso(PERMISOS.BUFFET_MESAS) && (
                    <button
                      onClick={(e) => eliminarPedido(pedido, e)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Eliminar pedido"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Info del pedido */}
            <div className="p-4">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Items:</span>
                  <span className="font-medium">{pedido.items?.length || 0}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Total:</span>
                  <span className="text-lg font-bold text-green-600">
                    {formatCurrency(pedido.total || 0, { showSymbol: false })}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-1 text-gray-500">
                    <Clock size={14} />
                    <span className="text-xs">Hace {tiempoTranscurrido(pedido)} min</span>
                  </div>
                  {pedido.horaEstimada && (
                    <span className="text-xs text-gray-600">
                      Estimado: {new Date(pedido.horaEstimada).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>

                {pedido.observaciones && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-gray-600 italic truncate" title={pedido.observaciones}>
                      {pedido.observaciones}
                    </p>
                  </div>
                )}

                {/* Switch para marcar como entregado en la pestaña Pagados */}
                {filtroEstado === 'PAGADOS' && pedido.estado === 'PAGADO' && (
                  <div className="pt-3 border-t mt-2">
                    <button
                      onClick={(e) => marcarEntregado(pedido, e)}
                      className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg font-medium transition-colors"
                    >
                      <CheckCircle size={18} />
                      Marcar como Entregado
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {pedidosFiltrados.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <ShoppingBag size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 text-lg mb-2">No hay pedidos {filtroEstado !== 'TODOS' && `en "${
            filtroEstado === 'EN_CURSO' ? 'En Curso' :
            filtroEstado === 'PAGADOS' ? 'Pagados' :
            'Entregados Hoy'
          }"`}</p>
          <p className="text-gray-400 text-sm">
            {filtroEstado !== 'TODOS' ? 'Prueba cambiando el filtro' : 'Crea un nuevo pedido para comenzar'}
          </p>
        </div>
      )}

      {/* Modal Nuevo Pedido */}
      <Modal
        title="Nuevo Pedido"
        isOpen={modalNuevoPedido}
        onClose={() => setModalNuevoPedido(false)}
      >
        <form onSubmit={crearNuevoPedido} className="space-y-4">
          {/* Buscar Socio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar Socio (opcional)
            </label>
            {nuevoPedidoData.socioId ? (
              <div className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <img src="/images/logo.png" alt="Socio" className="w-5 h-5 object-contain" />
                  <span className="font-medium">{nuevoPedidoData.socioNombre}</span>
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
                  value={nuevoPedidoData.buscarSocio}
                  onChange={e => {
                    setNuevoPedidoData({ ...nuevoPedidoData, buscarSocio: e.target.value })
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

          {/* Nombre Cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del Cliente *
            </label>
            <input
              type="text"
              required
              value={nuevoPedidoData.nombreCliente}
              onChange={e => setNuevoPedidoData({ ...nuevoPedidoData, nombreCliente: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Nombre completo"
            />
          </div>

          {/* Teléfono */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono
            </label>
            <input
              type="tel"
              value={nuevoPedidoData.telefono}
              onChange={e => setNuevoPedidoData({ ...nuevoPedidoData, telefono: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="1234567890"
            />
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Pedido *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {['RETIRO', 'DELIVERY', 'PEDIDOSYA', 'RAPPI'].map(tipo => (
                <label
                  key={tipo}
                  className={`flex items-center justify-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition ${
                    nuevoPedidoData.tipo === tipo
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="tipo"
                    value={tipo}
                    checked={nuevoPedidoData.tipo === tipo}
                    onChange={e => setNuevoPedidoData({ ...nuevoPedidoData, tipo: e.target.value })}
                    className="sr-only"
                  />
                  {getTipoIcon(tipo)}
                  <span className="font-medium">{getTipoLabel(tipo)}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Hora Estimada */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hora Estimada de Entrega
            </label>
            <input
              type="datetime-local"
              value={nuevoPedidoData.horaEstimada}
              onChange={e => setNuevoPedidoData({ ...nuevoPedidoData, horaEstimada: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observaciones
            </label>
            <textarea
              value={nuevoPedidoData.observaciones}
              onChange={e => setNuevoPedidoData({ ...nuevoPedidoData, observaciones: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              rows="2"
              placeholder="Notas adicionales..."
            />
          </div>

          <button
            type="submit"
            className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-medium"
          >
            Crear Pedido
          </button>
        </form>
      </Modal>

      {/* Dialog de confirmación */}
      <ConfirmDialog />
    </div>
  )
}
