import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Filter, ShoppingCart, Calendar, User, Building2, Eye, Edit, Trash2 } from 'lucide-react'
import { Button } from '../../../components/Button'
import { useModal } from '../../../components/Modal'
import StatusBadge from '../../../components/StatusBadge'
import Pagination from '../../../components/Pagination'
import { usePagination } from '../../../hooks/usePagination'
import { formatCurrency, formatDate } from '../../../utils/formatters'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'
import Table from '../../../components/Table'
import LoadingSpinner from '../../../components/LoadingSpinner'

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
  const { page, limit, pagination, setPagination, goToPage } = usePagination(1, 20)

  const [filtros, setFiltros] = useState({
    estado: '',
    desde: '',
    hasta: '',
    busqueda: ''
  })
  const [mostrarFiltros, setMostrarFiltros] = useState(false)

  useEffect(() => {
    cargarPedidos()
  }, [filtros, page])

  async function cargarPedidos() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('page', page)
      params.append('limit', limit)

      if (filtros.estado) params.append('estado', filtros.estado)
      if (filtros.desde) params.append('desde', filtros.desde)
      if (filtros.hasta) params.append('hasta', filtros.hasta)
      if (filtros.busqueda) params.append('busqueda', filtros.busqueda)

      const response = await api.getFull(`/admin/pedidos?${params}`)
      setPedidos(response.data || [])
      setPagination(response.pagination)
    } catch (err) {
      console.error('Error cargando pedidos:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleFiltroChange(e) {
    const { name, value } = e.target
    setFiltros(prev => ({ ...prev, [name]: value }))
    goToPage(1)
  }

  function limpiarFiltros() {
    setFiltros({
      estado: '',
      desde: '',
      hasta: '',
      busqueda: ''
    })
    goToPage(1)
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

  const columns = [
    {
      key: 'numero',
      label: 'Número',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-sm font-medium text-primary">
          {row.numero}
        </span>
      )
    },
    {
      key: 'fecha',
      label: 'Fecha',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar className="w-4 h-4" />
          {formatDate(row.fecha)}
        </div>
      )
    },
    {
      key: 'cliente',
      label: 'Cliente/Socio',
      render: (row) => {
        const cliente = getClienteInfo(row)
        const IconCliente = cliente.icon
        return (
          <div className="flex items-center gap-2">
            <IconCliente className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-sm text-gray-800">{cliente.nombre}</p>
              <p className="text-xs text-gray-500">{cliente.tipo}</p>
            </div>
          </div>
        )
      }
    },
    {
      key: 'items',
      label: 'Items',
      className: 'text-center',
      cellClassName: 'text-center',
      render: (row) => (
        <span className="text-sm text-gray-600">
          {row.items?.length || 0}
        </span>
      )
    },
    {
      key: 'total',
      label: 'Total',
      sortable: true,
      className: 'text-right',
      cellClassName: 'text-right',
      render: (row) => (
        <span className="font-semibold text-gray-800">
          {formatCurrency(row.total)}
        </span>
      )
    },
    {
      key: 'estado',
      label: 'Estado',
      sortable: true,
      className: 'text-center',
      cellClassName: 'text-center',
      render: (row) => <StatusBadge status={row.estado} type="pedido" />
    },
    {
      key: 'acciones',
      label: 'Acciones',
      sortable: false,
      className: 'text-center',
      cellClassName: 'text-center',
      render: (row) => (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/admin/ingresos/pedidos/${row.id}`)
            }}
            className="p-2 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg"
            title="Ver detalle"
          >
            <Eye className="w-4 h-4" />
          </button>
          {row.estado === 'PENDIENTE' && tienePermiso(PERMISOS.INGRESOS_GESTIONAR) && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`/admin/ingresos/pedidos/${row.id}/editar`)
                }}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded-lg"
                title="Editar"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleEliminar(row)
                }}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-lg"
                title="Eliminar"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      )
    }
  ]

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
        {tienePermiso(PERMISOS.INGRESOS_GESTIONAR) && (
          <Button onClick={() => navigate('/admin/ingresos/pedidos/nuevo')}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Pedido
          </Button>
        )}
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
          <LoadingSpinner />
        ) : pedidos.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No hay pedidos registrados</p>
          </div>
        ) : (
          <>
            <Table
              columns={columns}
              data={pedidos}
              sortable
              hoverable
              onRowClick={(pedido) => navigate(`/admin/ingresos/pedidos/${pedido.id}`)}
            />

            {/* Paginacion */}
            <Pagination
              pagination={pagination}
              page={page}
              onPageChange={goToPage}
              className="px-4 border-t border-gray-200"
            />
          </>
        )}
      </div>
    </div>
  )
}
