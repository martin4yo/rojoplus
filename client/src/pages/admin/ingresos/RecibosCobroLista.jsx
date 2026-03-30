import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Filter, CreditCard, Calendar, User, Building2, Eye } from 'lucide-react'
import { Button } from '../../../components/Button'
import Table from '../../../components/Table'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'
import { formatCurrency, formatDate } from '../../../utils/formatters'
import { usePagination } from '../../../hooks/usePagination'
import Pagination from '../../../components/Pagination'
import LoadingSpinner from '../../../components/LoadingSpinner'

const MEDIOS_PAGO = [
  { value: '', label: 'Todos' },
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
  { value: 'TARJETA', label: 'Tarjeta' },
  { value: 'CHEQUE', label: 'Cheque' }
]

export default function RecibosCobroLista() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [recibos, setRecibos] = useState([])
  const { page, pagination, setPagination, goToPage } = usePagination(1, 20)

  const [filtros, setFiltros] = useState({
    medioPago: '',
    desde: '',
    hasta: ''
  })
  const [mostrarFiltros, setMostrarFiltros] = useState(false)

  // Definición de columnas
  const columns = [
    {
      key: 'numero',
      label: 'Numero',
      render: (recibo) => (
        <span className="font-mono text-sm font-medium text-primary">
          {recibo.numero}
        </span>
      )
    },
    {
      key: 'fecha',
      label: 'Fecha',
      render: (recibo) => (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar className="w-4 h-4" />
          {formatDate(recibo.fecha)}
        </div>
      )
    },
    {
      key: 'cliente',
      label: 'Cliente/Socio',
      render: (recibo) => {
        const cliente = getClienteInfo(recibo)
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
      key: 'medioPago',
      label: 'Medio',
      className: 'text-center',
      cellClassName: 'text-center',
      render: (recibo) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getMedioPagoBadge(recibo.medioPago)}`}>
          {recibo.medioPago || '-'}
        </span>
      )
    },
    {
      key: 'caja',
      label: 'Caja',
      render: (recibo) => (
        <span className="text-sm text-gray-600">
          {recibo.caja?.nombre || '-'}
        </span>
      )
    },
    {
      key: 'montoTotal',
      label: 'Monto',
      className: 'text-right',
      cellClassName: 'text-right',
      render: (recibo) => (
        <span className="font-semibold text-green-600">
          {formatCurrency(recibo.montoTotal)}
        </span>
      )
    },
    {
      key: 'acciones',
      label: 'Acciones',
      className: 'text-center',
      cellClassName: 'text-center',
      sortable: false,
      render: (recibo) => (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/admin/ingresos/recibos/${recibo.id}`)
            }}
            className="p-2 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg"
            title="Ver detalle"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ]

  useEffect(() => {
    cargarRecibos()
  }, [filtros, page])

  async function cargarRecibos() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('page', page)
      params.append('limit', '20')

      if (filtros.desde) params.append('desde', filtros.desde)
      if (filtros.hasta) params.append('hasta', filtros.hasta)

      const response = await api.getFull(`/admin/recibos-cobro?${params}`)
      setRecibos(response.data || [])
      setPagination({
        page: response.pagination?.page || 1,
        totalPages: response.pagination?.pages || 1,
        total: response.pagination?.total || 0,
        from: ((page - 1) * 20) + 1,
        to: Math.min(page * 20, response.pagination?.total || 0)
      })
    } catch (err) {
      console.error('Error cargando recibos:', err)
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
      medioPago: '',
      desde: '',
      hasta: ''
    })
    goToPage(1)
  }

  function getClienteInfo(recibo) {
    if (recibo.socio) {
      return {
        tipo: 'Socio',
        nombre: `#${recibo.socio.nroSocio} - ${recibo.socio.apellidoNombre}`,
        icon: User
      }
    }
    if (recibo.entidad) {
      return {
        tipo: 'Cliente',
        nombre: recibo.entidad.razonSocial,
        icon: Building2
      }
    }
    return { tipo: '-', nombre: '-', icon: User }
  }

  function getMedioPagoBadge(medioPago) {
    const estilos = {
      EFECTIVO: 'bg-green-100 text-green-700',
      TRANSFERENCIA: 'bg-blue-100 text-blue-700',
      TARJETA: 'bg-purple-100 text-purple-700',
      CHEQUE: 'bg-orange-100 text-orange-700'
    }
    return estilos[medioPago] || 'bg-gray-100 text-gray-700'
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-100">
            <CreditCard className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Recibos de Cobro</h1>
            <p className="text-sm text-gray-500">Cobros recibidos de clientes y socios</p>
          </div>
        </div>
        {tienePermiso(PERMISOS.INGRESOS_GESTIONAR) && (
          <Button onClick={() => navigate('/admin/ingresos/recibos/nuevo')}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Recibo
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="secondary"
            onClick={() => setMostrarFiltros(!mostrarFiltros)}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filtros
          </Button>
        </div>

        {mostrarFiltros && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 mt-4 border-t border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Medio de Pago
              </label>
              <select
                name="medioPago"
                value={filtros.medioPago}
                onChange={handleFiltroChange}
                className="input-field w-full"
              >
                {MEDIOS_PAGO.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
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
        ) : recibos.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No hay recibos registrados</p>
          </div>
        ) : (
          <>
            <Table
              columns={columns}
              data={recibos}
              sortable
              onRowClick={(recibo) => navigate(`/admin/ingresos/recibos/${recibo.id}`)}
            />

            {/* Paginacion */}
            <div className="px-4 border-t border-gray-200">
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
