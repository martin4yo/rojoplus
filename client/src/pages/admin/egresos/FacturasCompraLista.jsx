import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, FileText, Eye, XCircle, Filter, CreditCard, Package } from 'lucide-react'
import { Button } from '../../../components/Button'
import { useModal } from '../../../components/Modal'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'
import { formatCurrency, formatDate } from '../../../utils/formatters'
import StatusBadge from '../../../components/StatusBadge'
import { usePagination } from '../../../hooks/usePagination'
import Pagination from '../../../components/Pagination'
import Table from '../../../components/Table'

const TIPOS = {
  FACTURA_COMPRA: { label: 'Factura', color: 'bg-blue-100 text-blue-700' },
  NOTA_CREDITO_PROVEEDOR: { label: 'Nota Credito', color: 'bg-purple-100 text-purple-700' },
  NOTA_DEBITO_PROVEEDOR: { label: 'Nota Debito', color: 'bg-orange-100 text-orange-700' }
}

export default function FacturasCompraLista() {
  const navigate = useNavigate()
  const { showModal, ModalComponent } = useModal()
  const { page, pagination, setPagination, goToPage } = usePagination(1, 20)

  const [facturas, setFacturas] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroProveedor, setFiltroProveedor] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  useEffect(() => {
    cargarProveedores()
  }, [])

  useEffect(() => {
    cargarFacturas()
  }, [filtroEstado, filtroProveedor, page])

  async function cargarProveedores() {
    try {
      const res = await api.getFull('/admin/entidades?tipo=PROVEEDOR&activo=true&limit=500')
      setProveedores(res.data || [])
    } catch (err) {
      console.error('Error cargando proveedores:', err)
    }
  }

  async function cargarFacturas() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit: 20 })
      if (filtroEstado) params.append('estado', filtroEstado)
      if (filtroProveedor) params.append('entidadId', filtroProveedor)
      if (fechaDesde) params.append('desde', fechaDesde)
      if (fechaHasta) params.append('hasta', fechaHasta)

      const res = await api.getFull(`/admin/facturas-compra?${params}`)
      setFacturas(res.data || [])
      if (res.pagination) {
        setPagination({
          page: res.pagination.page,
          totalPages: res.pagination.pages,
          total: res.pagination.total,
          from: ((res.pagination.page - 1) * 20) + 1,
          to: Math.min(res.pagination.page * 20, res.pagination.total)
        })
      }
    } catch (err) {
      console.error('Error cargando facturas:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleBuscar(e) {
    e.preventDefault()
    goToPage(1)
    cargarFacturas()
  }

  function limpiarFiltros() {
    setFiltroEstado('')
    setFiltroProveedor('')
    setFechaDesde('')
    setFechaHasta('')
    goToPage(1)
  }

  function handleAnular(factura) {
    showModal({
      type: 'warning',
      title: 'Anular Factura',
      message: `¿Anular la factura ${factura.numero}? Esta accion revertira el stock asociado.`,
      confirmText: 'Anular',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        try {
          await api.post(`/admin/movimientos-contables/${factura.id}/anular`)
          cargarFacturas()
          showModal({
            type: 'success',
            message: 'Factura anulada correctamente'
          })
        } catch (err) {
          showModal({
            type: 'error',
            message: err.message || 'Error al anular factura'
          })
        }
      }
    })
  }

  const columns = [
    {
      key: 'numero',
      label: 'Numero',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-sm font-medium text-primary">{row.numero}</span>
      )
    },
    {
      key: 'tipo',
      label: 'Tipo',
      render: (row) => (
        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${TIPOS[row.tipo]?.color || 'bg-gray-100'}`}>
          {TIPOS[row.tipo]?.label || row.tipo}
        </span>
      )
    },
    {
      key: 'fecha',
      label: 'Fecha',
      sortable: true,
      render: (row) => (
        <div>
          <span className="text-sm text-gray-600">{formatDate(row.fecha)}</span>
          {row.fechaVencimiento && (
            <p className="text-xs text-gray-400">
              Vence: {formatDate(row.fechaVencimiento)}
            </p>
          )}
        </div>
      )
    },
    {
      key: 'proveedor',
      label: 'Proveedor',
      render: (row) => (
        <p className="font-medium text-gray-800">{row.entidad?.razonSocial}</p>
      )
    },
    {
      key: 'comprobante',
      label: 'Comprobante',
      className: 'hidden md:table-cell',
      cellClassName: 'hidden md:table-cell',
      render: (row) => {
        if (row.tipoComprobante && row.numeroComprobante) {
          return (
            <span className="text-sm text-gray-600 font-mono">
              {row.tipoComprobante} {row.puntoVenta}-{row.numeroComprobante}
            </span>
          )
        }
        return <span className="text-sm text-gray-400">-</span>
      }
    },
    {
      key: 'montoTotal',
      label: 'Total',
      sortable: true,
      className: 'text-right',
      cellClassName: 'text-right',
      render: (row) => (
        <span className="font-semibold text-gray-800">{formatCurrency(row.montoTotal)}</span>
      )
    },
    {
      key: 'saldoPendiente',
      label: 'Saldo',
      sortable: true,
      className: 'text-right hidden lg:table-cell',
      cellClassName: 'text-right hidden lg:table-cell',
      render: (row) => {
        if (row.saldoPendiente > 0) {
          return <span className="font-medium text-red-600">{formatCurrency(row.saldoPendiente)}</span>
        }
        return <span className="text-gray-400">-</span>
      }
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
      className: 'text-right',
      cellClassName: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Link
            to={`/admin/egresos/facturas/${row.id}`}
            className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-lg"
            title="Ver detalle"
            onClick={(e) => e.stopPropagation()}
          >
            <Eye className="w-4 h-4" />
          </Link>
          {row.estado === 'PENDIENTE' && tienePermiso(PERMISOS.EGRESOS_GESTIONAR) && (
            <>
              <Link
                to={`/admin/egresos/facturas/${row.id}/pagar`}
                className="p-2 text-gray-500 hover:text-green-600 hover:bg-gray-100 rounded-lg"
                title="Registrar pago"
                onClick={(e) => e.stopPropagation()}
              >
                <CreditCard className="w-4 h-4" />
              </Link>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleAnular(row)
                }}
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded-lg"
                title="Anular factura"
              >
                <XCircle className="w-4 h-4" />
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Facturas de Compra</h1>
            <p className="text-gray-500 text-sm">{pagination.total} facturas</p>
          </div>
        </div>
        {tienePermiso(PERMISOS.EGRESOS_GESTIONAR) && (
          <Button onClick={() => navigate('/admin/egresos/facturas/nueva')}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Factura
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <form onSubmit={handleBuscar} className="space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="input-field w-full lg:w-40"
            >
              <option value="">Todos los estados</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="PAGADO">Pagado</option>
              <option value="ANULADO">Anulado</option>
            </select>
            <select
              value={filtroProveedor}
              onChange={(e) => setFiltroProveedor(e.target.value)}
              className="input-field w-full lg:w-56 flex-1"
            >
              <option value="">Todos los proveedores</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>{p.razonSocial}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex gap-2 items-center">
              <span className="text-sm text-gray-600">Desde:</span>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="input-field w-40"
              />
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-sm text-gray-600">Hasta:</span>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="input-field w-40"
              />
            </div>
            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                onClick={limpiarFiltros}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Limpiar
              </button>
              <Button type="submit">
                <Filter className="w-4 h-4 mr-2" />
                Filtrar
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : facturas.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No hay facturas de compra registradas</p>
          </div>
        ) : (
          <>
            <Table
              columns={columns}
              data={facturas}
              sortable
              hoverable
              onRowClick={(factura) => navigate(`/admin/egresos/facturas/${factura.id}`)}
            />

            {/* Paginacion */}
            <Pagination
              pagination={pagination}
              page={page}
              onPageChange={goToPage}
            />
          </>
        )}
      </div>
    </div>
  )
}
