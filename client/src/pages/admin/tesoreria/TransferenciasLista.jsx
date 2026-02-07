import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ArrowRightLeft, ChevronLeft, ChevronRight, Ban, XCircle } from 'lucide-react'
import { Button } from '../../../components/Button'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'

export default function TransferenciasLista() {
  const navigate = useNavigate()
  const [transferencias, setTransferencias] = useState([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })

  const [filtros, setFiltros] = useState({
    desde: '',
    hasta: ''
  })

  useEffect(() => {
    cargarTransferencias()
  }, [filtros, pagination.page])

  async function cargarTransferencias() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: pagination.page, limit: 30 })
      if (filtros.desde) params.append('desde', filtros.desde)
      if (filtros.hasta) params.append('hasta', filtros.hasta)

      const res = await api.getFull(`/admin/transferencias?${params}`)
      setTransferencias(res.data || [])
      if (res.pagination) {
        setPagination(prev => ({
          ...prev,
          pages: res.pagination.pages,
          total: res.pagination.total
        }))
      }
    } catch (err) {
      console.error('Error cargando transferencias:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleFiltroChange(campo, valor) {
    setFiltros(prev => ({ ...prev, [campo]: valor }))
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  async function handleAnular(id) {
    if (!confirm('¿Anular esta transferencia? Se revertiran los saldos de ambas cajas.')) return

    try {
      await api.post(`/admin/transferencias/${id}/anular`)
      cargarTransferencias()
    } catch (err) {
      alert(err.message || 'Error al anular')
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100">
            <ArrowRightLeft className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Transferencias</h1>
            <p className="text-gray-500 text-sm">{pagination.total} transferencias</p>
          </div>
        </div>
{tienePermiso(PERMISOS.CAJA_MOVIMIENTOS) && (
          <Button onClick={() => navigate('/admin/tesoreria/transferencias/nueva')}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Transferencia
          </Button>
        )}
      </div>

      {/* Filtros compactos */}
      <div className="flex items-center gap-2 mb-4">
        <input
          type="date"
          value={filtros.desde}
          onChange={(e) => handleFiltroChange('desde', e.target.value)}
          className="input-field text-sm py-1.5 px-2"
          title="Desde"
        />
        <span className="text-gray-400 text-sm">-</span>
        <input
          type="date"
          value={filtros.hasta}
          onChange={(e) => handleFiltroChange('hasta', e.target.value)}
          className="input-field text-sm py-1.5 px-2"
          title="Hasta"
        />
        {(filtros.desde || filtros.hasta) && (
          <button
            onClick={() => { setFiltros({ desde: '', hasta: '' }); setPagination(prev => ({ ...prev, page: 1 })) }}
            className="text-xs text-gray-500 hover:text-primary"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : transferencias.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <ArrowRightLeft className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No hay transferencias registradas</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Fecha</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Numero</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Origen</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600"></th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Destino</th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Monto</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Concepto</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Estado</th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {transferencias.map((t) => (
                    <tr key={t.id} className={`hover:bg-gray-50 ${t.estado === 'ANULADO' ? 'bg-gray-50 opacity-60' : ''}`}>
                      <td className="px-4 py-3 text-sm">
                        {new Date(t.fecha).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-gray-600">{t.numero}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <p className="font-medium text-gray-800">{t.cajaOrigen?.nombre}</p>
                          <p className="text-xs text-gray-500">{t.cajaOrigen?.codigo}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ArrowRightLeft className="w-4 h-4 text-blue-500 mx-auto" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <p className="font-medium text-gray-800">{t.cajaDestino?.nombre}</p>
                          <p className="text-xs text-gray-500">{t.cajaDestino?.codigo}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold text-blue-600">
                          ${t.monto.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <div>
                          {t.concepto?.nombre || '-'}
                          {t.descripcion && (
                            <p className="text-xs text-gray-400">{t.descripcion}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {t.estado === 'ANULADO' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            <Ban className="w-3 h-3" />
                            Anulado
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            Confirmado
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {t.estado !== 'ANULADO' && tienePermiso(PERMISOS.CAJA_ANULAR) && (
                          <button
                            onClick={() => handleAnular(t.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Anular transferencia"
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
