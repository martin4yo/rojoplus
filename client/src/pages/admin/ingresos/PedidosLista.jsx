import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Filter, ShoppingCart, Calendar, User, Building2, Eye, Edit, Trash2 } from 'lucide-react'
import { Button } from '../../../components/Button'
import { useModal } from '../../../components/Modal'
import api from '../../../services/api'

const ESTADOS = [
  { value: '', label: 'Todos' },
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'PARCIAL', label: 'Parcial' },
  { value: 'FACTURADO', label: 'Facturado' },
  { value: 'CANCELADO', label: 'Cancelado' }
]

export default function PedidosLista() {
  const navigate = useNavigate()
  const { showModal, ModalComponent } = useModal()
  const [loading, setLoading] = useState(true)
  const [pedidos, setPedidos] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })

  const [filtros, setFiltros] = useState({
    estado: '',
    desde: '',
    hasta: '',
    busqueda: ''
  })
  const [mostrarFiltros, setMostrarFiltros] = useState(false)

  useEffect(() => {
    cargarPedidos()
  }, [filtros, pagination.page])

  async function cargarPedidos() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('page', pagination.page)
      params.append('limit', '20')

      if (filtros.estado) params.append('estado', filtros.estado)
      if (filtros.desde) params.append('desde', filtros.desde)
      if (filtros.hasta) params.append('hasta', filtros.hasta)
      if (filtros.busqueda) params.append('busqueda', filtros.busqueda)

      const response = await api.getFull(`/admin/pedidos?${params}`)
      setPedidos(response.data || [])
      setPagination(prev => ({
        ...prev,
        pages: response.pagination?.pages || 1,
        total: response.pagination?.total || 0
      }))
    } catch (err) {
      console.error('Error cargando pedidos:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleFiltroChange(e) {
    const { name, value } = e.target
    setFiltros(prev => ({ ...prev, [name]: value }))
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  function limpiarFiltros() {
    setFiltros({
      estado: '',
      desde: '',
      hasta: '',
      busqueda: ''
    })
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  async function handleEliminar(pedido) {
    showModal({
      type: 'confirm',
      title: 'Eliminar Pedido',
      message: `¿Está seguro de eliminar el pedido ${pedido.numero}?`,
      onConfirm: async () => {
        try {
          await api.delete(`/admin/pedidos/${pedido.id}`)
          showModal({ type: 'success', message: 'Pedido eliminado correctamente' })
          cargarPedidos()
        } catch (err) {
          showModal({ type: 'error', message: err.message || 'Error al eliminar' })
        }
      }
    })
  }

  function formatMonto(monto) {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(monto || 0)
  }

  function formatFecha(fecha) {
    return new Date(fecha).toLocaleDateString('es-AR')
  }

  function getEstadoBadge(estado) {
    const estilos = {
      PENDIENTE: 'bg-yellow-100 text-yellow-700',
      PARCIAL: 'bg-blue-100 text-blue-700',
      FACTURADO: 'bg-green-100 text-green-700',
      CANCELADO: 'bg-red-100 text-red-700'
    }
    return estilos[estado] || 'bg-gray-100 text-gray-700'
  }

  function getClienteInfo(pedido) {
    if (pedido.socio) {
      return {
        tipo: 'Socio',
        nombre: `#${pedido.socio.nroSocio} - ${pedido.socio.apellidoNombre}`,
        icon: User
      }
    }
    if (pedido.entidad) {
      return {
        tipo: 'Cliente',
        nombre: pedido.entidad.razonSocial,
        icon: Building2
      }
    }
    return { tipo: '-', nombre: '-', icon: User }
  }

  return (
    <div>
      {ModalComponent}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-100">
            <ShoppingCart className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Pedidos</h1>
            <p className="text-sm text-gray-500">Pedidos de clientes y socios</p>
          </div>
        </div>
        <Button onClick={() => navigate('/admin/ingresos/pedidos/nuevo')}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Pedido
        </Button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              name="busqueda"
              value={filtros.busqueda}
              onChange={handleFiltroChange}
              placeholder="Buscar por numero, cliente o socio..."
              className="input-field w-full pl-10"
            />
          </div>
          <Button
            variant="secondary"
            onClick={() => setMostrarFiltros(!mostrarFiltros)}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filtros
          </Button>
        </div>

        {mostrarFiltros && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado
              </label>
              <select
                name="estado"
                value={filtros.estado}
                onChange={handleFiltroChange}
                className="input-field w-full"
              >
                {ESTADOS.map((e) => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Desde
              </label>
              <input
                type="date"
                name="desde"
                value={filtros.desde}
                onChange={handleFiltroChange}
                className="input-field w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hasta
              </label>
              <input
                type="date"
                name="hasta"
                value={filtros.hasta}
                onChange={handleFiltroChange}
                className="input-field w-full"
              />
            </div>

            <div className="flex items-end">
              <Button variant="ghost" onClick={limpiarFiltros}>
                Limpiar filtros
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : pedidos.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No hay pedidos registrados</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Número</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Fecha</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Cliente/Socio</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Items</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Total</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Estado</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pedidos.map((pedido) => {
                    const cliente = getClienteInfo(pedido)
                    const IconCliente = cliente.icon

                    return (
                      <tr key={pedido.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <span className="font-mono text-sm font-medium text-primary">
                            {pedido.numero}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="w-4 h-4" />
                            {formatFecha(pedido.fecha)}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <IconCliente className="w-4 h-4 text-gray-400" />
                            <div>
                              <p className="text-sm text-gray-800">{cliente.nombre}</p>
                              <p className="text-xs text-gray-500">{cliente.tipo}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-sm text-gray-600">
                            {pedido.items?.length || 0}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-semibold text-gray-800">
                            {formatMonto(pedido.total)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEstadoBadge(pedido.estado)}`}>
                            {pedido.estado}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => navigate(`/admin/ingresos/pedidos/${pedido.id}`)}
                              className="p-2 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg"
                              title="Ver detalle"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {pedido.estado === 'PENDIENTE' && (
                              <>
                                <button
                                  onClick={() => navigate(`/admin/ingresos/pedidos/${pedido.id}/editar`)}
                                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded-lg"
                                  title="Editar"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleEliminar(pedido)}
                                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-lg"
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Paginacion */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Mostrando página {pagination.page} de {pagination.pages} ({pagination.total} registros)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={pagination.page === 1}
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={pagination.page === pagination.pages}
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
