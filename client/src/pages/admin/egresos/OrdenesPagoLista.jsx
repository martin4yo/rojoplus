import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Filter, CreditCard, Calendar, Building2, Eye } from 'lucide-react'
import { Button } from '../../../components/Button'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'
import { formatCurrency, formatDate } from '../../../utils/formatters'
import StatusBadge from '../../../components/StatusBadge'
import { usePagination } from '../../../hooks/usePagination'
import Pagination from '../../../components/Pagination'
import Table from '../../../components/Table'
import LoadingSpinner from '../../../components/LoadingSpinner'

const ESTADOS = [
  { value: '', label: 'Todos' },
  { value: 'CONFIRMADO', label: 'Confirmado' },
  { value: 'ANULADO', label: 'Anulado' }
]

export default function OrdenesPagoLista() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [ordenes, setOrdenes] = useState([])
  const { page, pagination, setPagination, goToPage, reset } = usePagination(1, 20)

  const [filtros, setFiltros] = useState({
    estado: '',
    entidadId: '',
    desde: '',
    hasta: '',
    busqueda: ''
  })
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [proveedores, setProveedores] = useState([])

  useEffect(() => {
    cargarProveedores()
  }, [])

  useEffect(() => {
    cargarOrdenes()
  }, [filtros, page])

  async function cargarProveedores() {
    try {
      const response = await api.getFull('/admin/entidades?tipo=PROVEEDOR&activo=true&limit=500')
      setProveedores(response.data || [])
    } catch (err) {
      console.error('Error cargando proveedores:', err)
    }
  }

  async function cargarOrdenes() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('tipo', 'ORDEN_PAGO')
      params.append('page', page)
      params.append('limit', '20')

      if (filtros.estado) params.append('estado', filtros.estado)
      if (filtros.entidadId) params.append('entidadId', filtros.entidadId)
      if (filtros.desde) params.append('desde', filtros.desde)
      if (filtros.hasta) params.append('hasta', filtros.hasta)

      const response = await api.getFull(`/admin/movimientos-contables?${params}`)
      setOrdenes(response.data || [])
      setPagination(response.pagination)
    } catch (err) {
      console.error('Error cargando ordenes de pago:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleFiltroChange(e) {
    const { name, value } = e.target
    setFiltros(prev => ({ ...prev, [name]: value }))
    reset()
  }

  function limpiarFiltros() {
    setFiltros({
      estado: '',
      entidadId: '',
      desde: '',
      hasta: '',
      busqueda: ''
    })
    reset()
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
      key: 'proveedor',
      label: 'Proveedor',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-800">
            {row.entidad?.razonSocial || '-'}
          </span>
        </div>
      )
    },
    {
      key: 'medioPago',
      label: 'Medio Pago',
      render: (row) => (
        row.medioPago ? <StatusBadge status={row.medioPago} type="pedido" /> : '-'
      )
    },
    {
      key: 'caja',
      label: 'Caja',
      render: (row) => (
        <span className="text-sm text-gray-600">{row.caja?.nombre || '-'}</span>
      )
    },
    {
      key: 'montoTotal',
      label: 'Monto',
      sortable: true,
      className: 'text-right',
      cellClassName: 'text-right',
      render: (row) => (
        <span className="font-semibold text-gray-800">
          {formatCurrency(row.montoTotal)}
        </span>
      )
    },
    {
      key: 'estado',
      label: 'Estado',
      sortable: true,
      className: 'text-center',
      cellClassName: 'text-center',
      render: (row) => <StatusBadge status={row.estado} type="pago" />
    },
    {
      key: 'acciones',
      label: 'Acciones',
      sortable: false,
      className: 'text-center',
      cellClassName: 'text-center',
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/admin/egresos/ordenes-pago/${row.id}`)
          }}
          className="p-2 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg"
          title="Ver detalle"
        >
          <Eye className="w-4 h-4" />
        </button>
      )
    }
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <CreditCard className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Órdenes de Pago</h1>
            <p className="text-sm text-gray-500">Pagos a proveedores</p>
          </div>
        </div>
        {tienePermiso(PERMISOS.EGRESOS_GESTIONAR) && (
          <Button onClick={() => navigate('/admin/egresos/ordenes-pago/nueva')}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Orden de Pago
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
              placeholder="Buscar por numero..."
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
                Proveedor
              </label>
              <select
                name="entidadId"
                value={filtros.entidadId}
                onChange={handleFiltroChange}
                className="input-field w-full"
              >
                <option value="">Todos</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>{p.razonSocial}</option>
                ))}
              </select>
            </div>

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

            <div className="md:col-span-4 flex justify-end">
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
        ) : ordenes.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No hay órdenes de pago registradas</p>
          </div>
        ) : (
          <>
            <Table
              columns={columns}
              data={ordenes}
              sortable
              hoverable
              onRowClick={(orden) => navigate(`/admin/egresos/ordenes-pago/${orden.id}`)}
            />

            {/* Totales (sobre el listado mostrado en pantalla) */}
            {ordenes.length > 0 && (() => {
              const total = ordenes.reduce((s, o) => s + Number(o.montoTotal || 0), 0)
              return (
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-between text-sm">
                  <span><span className="text-gray-500">Órdenes:</span> <strong className="text-gray-800">{ordenes.length}</strong></span>
                  <span><span className="text-gray-500">Total:</span> <strong className="text-gray-800">{formatCurrency(total)}</strong></span>
                </div>
              )
            })()}

            {/* Paginacion */}
            <div className="border-t border-gray-200 px-4">
              <Pagination
                pagination={pagination}
                page={page}
                onPageChange={goToPage}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
