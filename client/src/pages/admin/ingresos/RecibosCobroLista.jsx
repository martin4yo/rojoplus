import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Filter, CreditCard, Calendar, User, Building2, Eye } from 'lucide-react'
import { Button } from '../../../components/Button'
import api from '../../../services/api'

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
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })

  const [filtros, setFiltros] = useState({
    medioPago: '',
    desde: '',
    hasta: ''
  })
  const [mostrarFiltros, setMostrarFiltros] = useState(false)

  useEffect(() => {
    cargarRecibos()
  }, [filtros, pagination.page])

  async function cargarRecibos() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('page', pagination.page)
      params.append('limit', '20')

      if (filtros.desde) params.append('desde', filtros.desde)
      if (filtros.hasta) params.append('hasta', filtros.hasta)

      const response = await api.getFull(`/admin/recibos-cobro?${params}`)
      setRecibos(response.data || [])
      setPagination(prev => ({
        ...prev,
        pages: response.pagination?.pages || 1,
        total: response.pagination?.total || 0
      }))
    } catch (err) {
      console.error('Error cargando recibos:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleFiltroChange(e) {
    const { name, value } = e.target
    setFiltros(prev => ({ ...prev, [name]: value }))
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  function limpiarFiltros() {
    setFiltros({
      medioPago: '',
      desde: '',
      hasta: ''
    })
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  function formatMonto(monto) {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(monto || 0)
  }

  function formatFecha(fecha) {
    return new Date(fecha).toLocaleDateString('es-AR')
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
        <Button onClick={() => navigate('/admin/ingresos/recibos/nuevo')}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Recibo
        </Button>
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
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : recibos.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No hay recibos registrados</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Numero</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Fecha</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Cliente/Socio</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Medio</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Caja</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Monto</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recibos.map((recibo) => {
                    const cliente = getClienteInfo(recibo)
                    const IconCliente = cliente.icon

                    return (
                      <tr key={recibo.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <span className="font-mono text-sm font-medium text-primary">
                            {recibo.numero}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="w-4 h-4" />
                            {formatFecha(recibo.fecha)}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <IconCliente className="w-4 h-4 text-gray-400" />
                            <div>
                              <p className="text-sm text-gray-800">{cliente.nombre}</p>
                              <p className="text-xs text-gray-500">{cliente.tipo}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getMedioPagoBadge(recibo.medioPago)}`}>
                            {recibo.medioPago || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {recibo.caja?.nombre || '-'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-semibold text-green-600">
                            {formatMonto(recibo.montoTotal)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => navigate(`/admin/ingresos/recibos/${recibo.id}`)}
                              className="p-2 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg"
                              title="Ver detalle"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Paginacion */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Mostrando pagina {pagination.page} de {pagination.pages} ({pagination.total} registros)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={pagination.page === 1}
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={pagination.page === pagination.pages}
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
