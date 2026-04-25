import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Filter, FileText, Calendar, User, Building2, Eye, Ban } from 'lucide-react'
import { Button } from '../../../components/Button'
import { useModal } from '../../../components/Modal'
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
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'PAGADO', label: 'Pagado' },
  { value: 'CONFIRMADO', label: 'Confirmado' },
  { value: 'ANULADO', label: 'Anulado' }
]

export default function FacturasVentaLista() {
  const navigate = useNavigate()
  const { showModal, ModalComponent } = useModal()
  const [loading, setLoading] = useState(true)
  const [facturas, setFacturas] = useState([])
  const { page, pagination, setPagination, goToPage } = usePagination(1, 20)

  const [filtros, setFiltros] = useState({
    estado: '',
    desde: '',
    hasta: '',
    busqueda: ''
  })
  const [mostrarFiltros, setMostrarFiltros] = useState(false)

  useEffect(() => {
    cargarFacturas()
  }, [filtros, page])

  async function cargarFacturas() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('page', page)
      params.append('limit', '20')

      if (filtros.estado) params.append('estado', filtros.estado)
      if (filtros.desde) params.append('desde', filtros.desde)
      if (filtros.hasta) params.append('hasta', filtros.hasta)

      const response = await api.getFull(`/admin/facturas-venta?${params}`)
      setFacturas(response.data || [])
      setPagination(response.pagination)
    } catch (err) {
      console.error('Error cargando facturas:', err)
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

  async function handleAnular(factura) {
    showModal({
      type: 'confirm',
      title: 'Anular Factura',
      message: `¿Está seguro de anular la factura ${factura.numero}?`,
      onConfirm: async () => {
        try {
          await api.post(`/admin/movimientos-contables/${factura.id}/anular`)
          showModal({ type: 'success', message: 'Factura anulada correctamente' })
          cargarFacturas()
        } catch (err) {
          showModal({ type: 'error', message: err.message || 'Error al anular' })
        }
      }
    })
  }

  function getClienteInfo(factura) {
    if (factura.socio) {
      return {
        tipo: 'Socio',
        nombre: `#${factura.socio.nroSocio} - ${factura.socio.apellidoNombre}`,
        icon: User
      }
    }
    if (factura.entidad) {
      return {
        tipo: 'Cliente',
        nombre: factura.entidad.razonSocial,
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
      key: 'comprobante',
      label: 'Comprobante',
      render: (row) => {
        const comprobante = row.tipoComprobante
          ? `${row.tipoComprobante} ${row.puntoVenta}-${row.numeroComprobante}`
          : '-'
        return <span className="text-sm text-gray-600">{comprobante}</span>
      }
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
      key: 'montoTotal',
      label: 'Total',
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
      key: 'saldoPendiente',
      label: 'Saldo',
      sortable: true,
      className: 'text-right',
      cellClassName: 'text-right',
      render: (row) => (
        <span className={row.saldoPendiente > 0 ? 'text-orange-600 font-medium' : 'text-gray-400'}>
          {formatCurrency(row.saldoPendiente)}
        </span>
      )
    },
    {
      key: 'estado',
      label: 'Estado',
      sortable: true,
      className: 'text-center',
      cellClassName: 'text-center',
      render: (row) => <StatusBadge status={row.estado} type="generic" />
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
              navigate(`/admin/ingresos/facturas/${row.id}`)
            }}
            className="p-2 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg"
            title="Ver detalle"
          >
            <Eye className="w-4 h-4" />
          </button>
          {row.estado !== 'ANULADO' && tienePermiso(PERMISOS.INGRESOS_GESTIONAR) && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleAnular(row)
              }}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-lg"
              title="Anular"
            >
              <Ban className="w-4 h-4" />
            </button>
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
            <FileText className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Facturas de Venta</h1>
            <p className="text-sm text-gray-500">Facturas emitidas a clientes y socios</p>
          </div>
        </div>
        {tienePermiso(PERMISOS.INGRESOS_GESTIONAR) && (
          <Button onClick={() => navigate('/admin/ingresos/facturas/nueva')}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Factura
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
              placeholder="Buscar por numero o cliente..."
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
        ) : facturas.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No hay facturas registradas</p>
          </div>
        ) : (
          <>
            <Table
              columns={columns}
              data={facturas}
              sortable
              hoverable
              onRowClick={(factura) => navigate(`/admin/ingresos/facturas/${factura.id}`)}
            />

            {/* Totales (sobre el listado mostrado en pantalla) */}
            {facturas.length > 0 && (() => {
              const totalMonto = facturas.reduce((s, f) => s + Number(f.montoTotal || 0), 0)
              const totalPagado = facturas.reduce((s, f) => s + Number(f.montoPagado || 0), 0)
              const totalSaldo = facturas.reduce((s, f) => s + Number(f.saldoPendiente || 0), 0)
              return (
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                  <div><span className="text-gray-500">Facturas:</span> <strong className="text-gray-800">{facturas.length}</strong></div>
                  <div className="text-right"><span className="text-gray-500">Total:</span> <strong className="text-gray-800">{formatCurrency(totalMonto)}</strong></div>
                  <div className="text-right"><span className="text-gray-500">Cobrado:</span> <strong className="text-green-600">{formatCurrency(totalPagado)}</strong></div>
                  <div className="text-right"><span className="text-gray-500">Saldo:</span> <strong className="text-red-600">{formatCurrency(totalSaldo)}</strong></div>
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
