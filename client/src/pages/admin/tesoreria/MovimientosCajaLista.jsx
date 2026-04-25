import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, ArrowRightLeft, TrendingUp, TrendingDown, XCircle, Ban, Download, Eye, FileText } from 'lucide-react'
import { Button } from '../../../components/Button'
import Table from '../../../components/Table'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'
import { formatCurrency, formatDate } from '../../../utils/formatters'
import { usePagination } from '../../../hooks/usePagination'
import Pagination from '../../../components/Pagination'
import { useApiData } from '../../../hooks/useApiData'
import { useConfirm } from '../../../hooks/useConfirm'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../../components/LoadingSpinner'

export default function MovimientosCajaLista() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const cajaIdParam = searchParams.get('cajaId')
  const { confirm, ConfirmDialog } = useConfirm()

  const [filtros, setFiltros] = useState({
    cajaId: cajaIdParam || '',
    tipo: '',
    desde: '',
    hasta: ''
  })

  // Hook de paginación centralizado
  const { page, pagination, setPagination, goToPage, reset } = usePagination(1, 30)

  // Cargar cajas con useApiData
  const { data: cajas = [] } = useApiData('/admin/cajas', {
    initialData: [],
    transform: (res) => res?.data || []
  })

  // Cargar movimientos
  const [movimientos, setMovimientos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargarMovimientos()
  }, [filtros, page])

  async function cargarMovimientos() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit: 30 })
      if (filtros.cajaId) params.set('cajaId', filtros.cajaId)
      if (filtros.tipo) params.set('tipo', filtros.tipo)
      if (filtros.desde) params.set('desde', filtros.desde)
      if (filtros.hasta) params.set('hasta', filtros.hasta)

      const res = await api.getFull(`/admin/movimientos-caja?${params.toString()}`)
      setMovimientos(res.data || [])
      if (res.pagination) {
        setPagination({
          page: res.pagination.page || page,
          totalPages: res.pagination.pages || 1,
          total: res.pagination.total || 0,
          from: ((page - 1) * 30) + 1,
          to: Math.min(page * 30, res.pagination.total || 0)
        })
      }
    } catch (err) {
      console.error('Error cargando movimientos:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleFiltroChange(campo, valor) {
    setFiltros(prev => ({ ...prev, [campo]: valor }))
    reset() // Resetear a página 1
  }

  async function exportarExcel() {
    try {
      const params = new URLSearchParams()
      if (filtros.cajaId) params.set('cajaId', filtros.cajaId)
      if (filtros.tipo) params.set('tipo', filtros.tipo)
      if (filtros.desde) params.set('desde', filtros.desde)
      if (filtros.hasta) params.set('hasta', filtros.hasta)

      const headers = { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
      const hostname = window.location.hostname
      const match = hostname.match(/^([^.]+)\.localhost/)
      if (match) headers['X-Tenant-Slug'] = match[1]

      const response = await fetch(`/api/admin/movimientos-caja/exportar?${params}`, { headers })
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `movimientos_caja_${new Date().toISOString().split('T')[0]}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error al exportar:', err)
    }
  }

  async function handleAnular(id) {
    const confirmed = await confirm('Anular Movimiento', '¿Anular este movimiento? Se revertira el saldo de la caja.', { variant: 'danger', confirmText: 'Anular' })
    if (!confirmed) return

    try {
      await api.post(`/admin/movimientos-caja/${id}/anular`)
      cargarMovimientos()
    } catch (err) {
      toast.error(err.message || 'Error al anular')
    }
  }

  const cajaSeleccionada = cajas.find(c => c.id === parseInt(filtros.cajaId))

  const RUTA_MC = {
    FACTURA_VENTA: (id) => `/admin/ingresos/facturas/${id}`,
    NOTA_CREDITO_CLIENTE: (id) => `/admin/ingresos/facturas/${id}`,
    NOTA_DEBITO_CLIENTE: (id) => `/admin/ingresos/facturas/${id}`,
    RECIBO_COBRO: (id) => `/admin/ingresos/recibos/${id}`,
    FACTURA_COMPRA: (id) => `/admin/egresos/facturas/${id}`,
    NOTA_CREDITO_PROVEEDOR: (id) => `/admin/egresos/facturas/${id}`,
    NOTA_DEBITO_PROVEEDOR: (id) => `/admin/egresos/facturas/${id}`,
    ORDEN_PAGO: (id) => `/admin/egresos/ordenes-pago/${id}`,
  }

  // Definición de columnas para la tabla
  const columns = [
    {
      key: 'fecha',
      label: 'Fecha',
      render: (mov) => formatDate(mov.fecha),
      className: 'text-left'
    },
    {
      key: 'numero',
      label: 'Numero',
      render: (mov) => <span className="font-mono text-sm text-gray-600">{mov.numero}</span>,
      className: 'text-left'
    },
    {
      key: 'caja',
      label: 'Caja',
      render: (mov) => mov.caja?.nombre || '-',
      className: 'text-left'
    },
    {
      key: 'tipo',
      label: 'Tipo',
      render: (mov) => (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
          mov.tipo === 'INGRESO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {mov.tipo === 'INGRESO' ? (
            <TrendingUp className="w-3 h-3" />
          ) : (
            <TrendingDown className="w-3 h-3" />
          )}
          {mov.tipo}
        </span>
      ),
      className: 'text-center',
      cellClassName: 'text-center'
    },
    {
      key: 'concepto',
      label: 'Concepto',
      render: (mov) => (
        <div>
          <p className="text-gray-800">{mov.concepto || mov.descripcion || '-'}</p>
          {mov.cuentaContable && (
            <p className="text-xs text-gray-500">{mov.cuentaContable.codigo} - {mov.cuentaContable.nombre}</p>
          )}
          {mov.pago?.socio && (
            <p className="text-xs text-blue-600">
              Socio #{mov.pago.socio.nroSocio} - {mov.pago.socio.apellidoNombre}
            </p>
          )}
        </div>
      ),
      className: 'text-left',
      cellClassName: 'whitespace-normal'
    },
    {
      key: 'monto',
      label: 'Monto',
      render: (mov) => (
        <span className={`font-bold ${mov.tipo === 'INGRESO' ? 'text-green-600' : 'text-red-600'}`}>
          {mov.tipo === 'INGRESO' ? '+' : '-'}{formatCurrency(mov.monto, { showSymbol: false })}
        </span>
      ),
      className: 'text-right',
      cellClassName: 'text-right'
    },
    {
      key: 'estado',
      label: 'Estado',
      render: (mov) => (
        mov.anulado ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            <Ban className="w-3 h-3" />
            Anulado
          </span>
        ) : (
          <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            Activo
          </span>
        )
      ),
      className: 'text-center',
      cellClassName: 'text-center'
    },
    {
      key: 'acciones',
      label: 'Acciones',
      sortable: false,
      render: (mov) => {
        const rutaMC = mov.movimientoContable && RUTA_MC[mov.movimientoContable.tipo]
          ? RUTA_MC[mov.movimientoContable.tipo](mov.movimientoContable.id)
          : null
        return (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => navigate(`/admin/tesoreria/movimientos/${mov.id}`)}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
              title="Ver detalle"
            >
              <Eye className="w-4 h-4" />
            </button>
            {rutaMC ? (
              <button
                onClick={() => navigate(rutaMC)}
                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                title={`Ver ${mov.movimientoContable.tipo.replace(/_/g, ' ').toLowerCase()} ${mov.movimientoContable.numero}`}
              >
                <FileText className="w-4 h-4" />
              </button>
            ) : (
              <span className="w-7" />
            )}
            {!mov.anulado && !mov.pagoId && tienePermiso(PERMISOS.CAJA_ANULAR) && (
              <button
                onClick={() => handleAnular(mov.id)}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                title="Anular movimiento"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
          </div>
        )
      },
      className: 'text-right',
      cellClassName: 'text-right'
    }
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <ArrowRightLeft className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Movimientos de Caja</h1>
            <p className="text-gray-500 text-sm">{pagination?.total || 0} movimientos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportarExcel}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition"
          >
            <Download className="w-4 h-4" />
            Exportar Excel
          </button>
          {tienePermiso(PERMISOS.CAJA_MOVIMIENTOS) && (
            <>
              <button
                onClick={() => navigate('/admin/tesoreria/movimientos/nuevo?tipo=INGRESO')}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition"
              >
                <TrendingUp className="w-4 h-4" />
                Nuevo Ingreso
              </button>
              <button
                onClick={() => navigate('/admin/tesoreria/movimientos/nuevo?tipo=EGRESO')}
                className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition"
              >
                <TrendingDown className="w-4 h-4" />
                Nuevo Egreso
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="min-w-[200px]">
            <label className="block text-xs text-gray-500 mb-1">Caja</label>
            <select
              value={filtros.cajaId}
              onChange={(e) => handleFiltroChange('cajaId', e.target.value)}
              className="input-field w-full text-sm"
            >
              <option value="">Todas las cajas</option>
              {cajas.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[150px]">
            <label className="block text-xs text-gray-500 mb-1">Tipo</label>
            <select
              value={filtros.tipo}
              onChange={(e) => handleFiltroChange('tipo', e.target.value)}
              className="input-field w-full text-sm"
            >
              <option value="">Todos</option>
              <option value="INGRESO">Ingresos</option>
              <option value="EGRESO">Egresos</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Desde</label>
            <input
              type="date"
              value={filtros.desde}
              onChange={(e) => handleFiltroChange('desde', e.target.value)}
              className="input-field text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Hasta</label>
            <input
              type="date"
              value={filtros.hasta}
              onChange={(e) => handleFiltroChange('hasta', e.target.value)}
              className="input-field text-sm"
            />
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <LoadingSpinner />
        ) : movimientos.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <ArrowRightLeft className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No hay movimientos registrados</p>
          </div>
        ) : (
          <>
            <Table
              columns={columns}
              data={movimientos}
              keyField="id"
              emptyMessage="No hay movimientos registrados"
            />

            <Pagination
              pagination={pagination}
              page={page}
              onPageChange={goToPage}
              className="px-4 border-t border-gray-200 bg-gray-50"
            />
          </>
        )}
      </div>
      <ConfirmDialog />
    </div>
  )
}
