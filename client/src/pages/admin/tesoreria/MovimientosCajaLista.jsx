import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, ArrowRightLeft, TrendingUp, TrendingDown, Filter, Calendar, ChevronLeft, ChevronRight, XCircle, Ban } from 'lucide-react'
import { Button } from '../../../components/Button'
import api from '../../../services/api'

export default function MovimientosCajaLista() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const cajaIdParam = searchParams.get('cajaId')

  const [movimientos, setMovimientos] = useState([])
  const [cajas, setCajas] = useState([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })

  const [filtros, setFiltros] = useState({
    cajaId: cajaIdParam || '',
    tipo: '',
    desde: '',
    hasta: ''
  })

  useEffect(() => {
    cargarCajas()
  }, [])

  useEffect(() => {
    cargarMovimientos()
  }, [filtros, pagination.page])

  async function cargarCajas() {
    try {
      const res = await api.getFull('/admin/cajas')
      setCajas(res.data || [])
    } catch (err) {
      console.error('Error cargando cajas:', err)
    }
  }

  async function cargarMovimientos() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: pagination.page, limit: 30 })
      if (filtros.cajaId) params.append('cajaId', filtros.cajaId)
      if (filtros.tipo) params.append('tipo', filtros.tipo)
      if (filtros.desde) params.append('desde', filtros.desde)
      if (filtros.hasta) params.append('hasta', filtros.hasta)

      const res = await api.getFull(`/admin/movimientos-caja?${params}`)
      setMovimientos(res.data || [])
      if (res.pagination) {
        setPagination(prev => ({
          ...prev,
          pages: res.pagination.pages,
          total: res.pagination.total
        }))
      }
    } catch (err) {
      console.error('Error cargando movimientos:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleFiltroChange(campo, valor) {
    setFiltros(prev => ({ ...prev, [campo]: valor }))
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  async function handleAnular(id) {
    if (!confirm('¿Anular este movimiento? Se revertira el saldo de la caja.')) return

    try {
      await api.post(`/admin/movimientos-caja/${id}/anular`)
      cargarMovimientos()
    } catch (err) {
      alert(err.message || 'Error al anular')
    }
  }

  const cajaSeleccionada = cajas.find(c => c.id === parseInt(filtros.cajaId))

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
            <p className="text-gray-500 text-sm">{pagination.total} movimientos</p>
          </div>
        </div>
        <Button onClick={() => navigate('/admin/tesoreria/movimientos/nuevo')}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Movimiento
        </Button>
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
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : movimientos.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <ArrowRightLeft className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No hay movimientos registrados</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Fecha</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Numero</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Caja</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Tipo</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Concepto</th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Monto</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Estado</th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {movimientos.map((mov) => (
                    <tr key={mov.id} className={`hover:bg-gray-50 ${mov.anulado ? 'bg-gray-50 opacity-60' : ''}`}>
                      <td className="px-4 py-3 text-sm">
                        {new Date(mov.fecha).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-gray-600">{mov.numero}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800">
                        {mov.caja?.nombre || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
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
                      </td>
                      <td className="px-4 py-3 text-sm">
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
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold ${mov.tipo === 'INGRESO' ? 'text-green-600' : 'text-red-600'}`}>
                          {mov.tipo === 'INGRESO' ? '+' : '-'}${mov.monto.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {mov.anulado ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            <Ban className="w-3 h-3" />
                            Anulado
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            Activo
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!mov.anulado && !mov.pagoId && (
                          <button
                            onClick={() => handleAnular(mov.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Anular movimiento"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginacion */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                <span className="text-sm text-gray-600">
                  Pagina {pagination.page} de {pagination.pages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page <= 1}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page >= pagination.pages}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
