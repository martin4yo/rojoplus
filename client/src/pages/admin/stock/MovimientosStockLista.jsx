import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { ArrowUpDown, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import { Button } from '../../../components/Button'
import StatusBadge from '../../../components/StatusBadge'
import { usePagination } from '../../../hooks/usePagination'
import Pagination from '../../../components/Pagination'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'
import LoadingSpinner from '../../../components/LoadingSpinner'

const TIPO_ICONS = {
  INGRESO: TrendingUp,
  EGRESO: TrendingDown,
  AJUSTE: RefreshCw
}

export default function MovimientosStockLista() {
  const [searchParams, setSearchParams] = useSearchParams()
  const productoIdParam = searchParams.get('productoId')

  const [movimientos, setMovimientos] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)

  // Paginación con hook centralizado
  const { page, pagination, setPagination, goToPage } = usePagination(1, 50)

  // Filtros
  const [productoId, setProductoId] = useState(productoIdParam || '')
  const [tipo, setTipo] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  useEffect(() => {
    cargarProductos()
  }, [])

  useEffect(() => {
    cargarMovimientos()
  }, [productoId, tipo, desde, hasta, page])

  async function cargarProductos() {
    try {
      const res = await api.getFull('/admin/productos?activo=true&limit=1000')
      setProductos((res.data || []).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' })))
    } catch (err) {
      console.error('Error cargando productos:', err)
    }
  }

  async function cargarMovimientos() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (productoId) params.append('productoId', productoId)
      if (tipo) params.append('tipo', tipo)
      if (desde) params.append('desde', desde)
      if (hasta) params.append('hasta', hasta)
      params.append('page', page)
      params.append('limit', 50)

      const res = await api.getFull(`/admin/movimientos-stock?${params}`)
      setMovimientos(res.data || [])
      setPagination(res.pagination)
    } catch (err) {
      console.error('Error cargando movimientos:', err)
    } finally {
      setLoading(false)
    }
  }

  function limpiarFiltros() {
    setProductoId('')
    setTipo('')
    setDesde('')
    setHasta('')
    goToPage(1)
    setSearchParams({})
  }

  function handleProductoChange(value) {
    setProductoId(value)
    goToPage(1)
    if (value) {
      setSearchParams({ productoId: value })
    } else {
      setSearchParams({})
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <ArrowUpDown className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Movimientos de Stock</h1>
            <p className="text-gray-500 text-sm">{pagination?.total || 0} movimientos</p>
          </div>
        </div>
{tienePermiso(PERMISOS.STOCK_GESTIONAR) && (
          <Link to="/admin/stock/movimientos/ajuste">
            <Button>
              <RefreshCw className="w-4 h-4 mr-2" />
              Ajuste de Stock
            </Button>
          </Link>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Producto</label>
            <select
              value={productoId}
              onChange={e => handleProductoChange(e.target.value)}
              className="input-field w-full"
            >
              <option value="">Todos los productos</option>
              {productos.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              value={tipo}
              onChange={e => { setTipo(e.target.value); goToPage(1) }}
              className="input-field"
            >
              <option value="">Todos</option>
              <option value="INGRESO">Ingreso</option>
              <option value="EGRESO">Egreso</option>
              <option value="AJUSTE">Ajuste</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={e => { setDesde(e.target.value); goToPage(1) }}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={e => { setHasta(e.target.value); goToPage(1) }}
              className="input-field"
            />
          </div>
          {(productoId || tipo || desde || hasta) && (
            <Button variant="secondary" size="sm" onClick={limpiarFiltros}>
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* Tabla */}
      {loading ? (
        <LoadingSpinner />
      ) : movimientos.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
          <ArrowUpDown className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No hay movimientos que coincidan con los filtros</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Fecha</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Producto</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Variante</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Tipo</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Cantidad</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Stock Ant.</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Stock Post.</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Concepto</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {movimientos.map(mov => {
                    const Icon = TIPO_ICONS[mov.tipo] || ArrowUpDown
                    return (
                      <tr key={mov.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">
                          {new Date(mov.fecha).toLocaleString('es-AR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            to={`/admin/stock/productos/${mov.productoVariante?.producto?.id}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {mov.productoVariante?.producto?.codigo}
                          </Link>
                          <p className="text-sm text-gray-500">{mov.productoVariante?.producto?.nombre}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium">{mov.productoVariante?.talle}</span>
                          {mov.productoVariante?.color && (
                            <span className="text-gray-500 ml-1">/ {mov.productoVariante.color}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="inline-flex items-center gap-1">
                            <Icon className="w-3 h-3" />
                            <StatusBadge status={mov.tipo} type="movimientoStock" size="sm" />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-medium">
                          <span className={mov.tipo === 'INGRESO' ? 'text-green-600' : mov.tipo === 'EGRESO' ? 'text-red-600' : ''}>
                            {mov.tipo === 'INGRESO' ? '+' : mov.tipo === 'EGRESO' ? '-' : ''}{mov.cantidad}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-500">{mov.stockAnterior}</td>
                        <td className="px-4 py-3 text-right font-mono font-medium">{mov.stockPosterior}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                          {mov.concepto || '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paginacion */}
          <Pagination
            pagination={pagination}
            page={page}
            onPageChange={goToPage}
            className="mt-6"
          />
        </>
      )}
    </div>
  )
}
