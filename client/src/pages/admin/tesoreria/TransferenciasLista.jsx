import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ArrowRightLeft, Ban, XCircle } from 'lucide-react'
import { Button } from '../../../components/Button'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'
import { formatDate, formatCurrency } from '../../../utils/formatters'
import { usePagination } from '../../../hooks/usePagination'
import Pagination from '../../../components/Pagination'
import Table from '../../../components/Table'

export default function TransferenciasLista() {
  const navigate = useNavigate()
  const [transferencias, setTransferencias] = useState([])
  const [loading, setLoading] = useState(true)
  const { page, pagination, setPagination, goToPage } = usePagination(1, 30)

  const [filtros, setFiltros] = useState({
    desde: '',
    hasta: ''
  })

  useEffect(() => {
    cargarTransferencias()
  }, [filtros, page])

  async function cargarTransferencias() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit: 30 })
      if (filtros.desde) params.append('desde', filtros.desde)
      if (filtros.hasta) params.append('hasta', filtros.hasta)

      const res = await api.getFull(`/admin/transferencias?${params}`)
      setTransferencias(res.data || [])
      if (res.pagination) {
        setPagination(res.pagination)
      }
    } catch (err) {
      console.error('Error cargando transferencias:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleFiltroChange(campo, valor) {
    setFiltros(prev => ({ ...prev, [campo]: valor }))
    goToPage(1)
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

  const columns = [
    {
      key: 'fecha',
      label: 'Fecha',
      render: (row) => formatDate(row.fecha)
    },
    {
      key: 'numero',
      label: 'Numero',
      render: (row) => (
        <span className="font-mono text-sm text-gray-600">{row.numero}</span>
      )
    },
    {
      key: 'origen',
      label: 'Origen',
      render: (row) => (
        <div className="text-sm">
          <p className="font-medium text-gray-800">{row.cajaOrigen?.nombre}</p>
          <p className="text-xs text-gray-500">{row.cajaOrigen?.codigo}</p>
        </div>
      )
    },
    {
      key: 'flecha',
      label: '',
      className: 'text-center',
      cellClassName: 'text-center',
      render: () => <ArrowRightLeft className="w-4 h-4 text-blue-500 mx-auto" />
    },
    {
      key: 'destino',
      label: 'Destino',
      render: (row) => (
        <div className="text-sm">
          <p className="font-medium text-gray-800">{row.cajaDestino?.nombre}</p>
          <p className="text-xs text-gray-500">{row.cajaDestino?.codigo}</p>
        </div>
      )
    },
    {
      key: 'monto',
      label: 'Monto',
      className: 'text-right',
      cellClassName: 'text-right',
      render: (row) => (
        <span className="font-bold text-blue-600">
          {formatCurrency(row.monto)}
        </span>
      )
    },
    {
      key: 'concepto',
      label: 'Concepto',
      render: (row) => (
        <div>
          {row.concepto?.nombre || '-'}
          {row.descripcion && (
            <p className="text-xs text-gray-400">{row.descripcion}</p>
          )}
        </div>
      )
    },
    {
      key: 'estado',
      label: 'Estado',
      className: 'text-center',
      cellClassName: 'text-center',
      render: (row) => (
        row.estado === 'ANULADO' ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            <Ban className="w-3 h-3" />
            Anulado
          </span>
        ) : (
          <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            Confirmado
          </span>
        )
      )
    },
    {
      key: 'acciones',
      label: 'Acciones',
      className: 'text-right',
      cellClassName: 'text-right',
      render: (row) => (
        row.estado !== 'ANULADO' && tienePermiso(PERMISOS.CAJA_ANULAR) && (
          <button
            onClick={() => handleAnular(row.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
            title="Anular transferencia"
          >
            <XCircle className="w-4 h-4" />
          </button>
        )
      )
    }
  ]

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
            <p className="text-gray-500 text-sm">{pagination?.total || 0} transferencias</p>
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
            onClick={() => { setFiltros({ desde: '', hasta: '' }); goToPage(1) }}
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
            <Table
              columns={columns}
              data={transferencias}
              emptyMessage="No hay transferencias registradas"
            />

            {/* Paginacion */}
            <div className="px-4 border-t border-gray-200 bg-gray-50">
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
