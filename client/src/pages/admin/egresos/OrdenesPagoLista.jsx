import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Filter, CreditCard, Calendar, Building2, Eye } from 'lucide-react'
import { Button } from '../../../components/Button'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'

const ESTADOS = [
  { value: '', label: 'Todos' },
  { value: 'CONFIRMADO', label: 'Confirmado' },
  { value: 'ANULADO', label: 'Anulado' }
]

export default function OrdenesPagoLista() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [ordenes, setOrdenes] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })

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
  }, [filtros, pagination.page])

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
      params.append('page', pagination.page)
      params.append('limit', '20')

      if (filtros.estado) params.append('estado', filtros.estado)
      if (filtros.entidadId) params.append('entidadId', filtros.entidadId)
      if (filtros.desde) params.append('desde', filtros.desde)
      if (filtros.hasta) params.append('hasta', filtros.hasta)

      const response = await api.getFull(`/admin/movimientos-contables?${params}`)
      setOrdenes(response.data || [])
      setPagination(prev => ({
        ...prev,
        pages: response.pagination?.pages || 1,
        total: response.pagination?.total || 0
      }))
    } catch (err) {
      console.error('Error cargando ordenes de pago:', err)
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
      estado: '',
      entidadId: '',
      desde: '',
      hasta: '',
      busqueda: ''
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

  function getEstadoBadge(estado) {
    const estilos = {
      CONFIRMADO: 'bg-green-100 text-green-700',
      ANULADO: 'bg-red-100 text-red-700',
      PENDIENTE: 'bg-yellow-100 text-yellow-700'
    }
    return estilos[estado] || 'bg-gray-100 text-gray-700'
  }

  function getMedioPagoBadge(medioPago) {
    const estilos = {
      EFECTIVO: 'bg-green-50 text-green-600',
      TRANSFERENCIA: 'bg-blue-50 text-blue-600',
      CHEQUE: 'bg-orange-50 text-orange-600',
      TARJETA: 'bg-purple-50 text-purple-600'
    }
    return estilos[medioPago] || 'bg-gray-50 text-gray-600'
  }

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
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : ordenes.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No hay órdenes de pago registradas</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Número</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Fecha</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Proveedor</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Medio Pago</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Caja</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Monto</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Estado</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ordenes.map((orden) => (
                    <tr key={orden.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <span className="font-mono text-sm font-medium text-primary">
                          {orden.numero}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          {formatFecha(orden.fecha)}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-800">
                            {orden.entidad?.razonSocial || '-'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {orden.medioPago && (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getMedioPagoBadge(orden.medioPago)}`}>
                            {orden.medioPago}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {orden.caja?.nombre || '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-semibold text-gray-800">
                          {formatMonto(orden.montoTotal)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEstadoBadge(orden.estado)}`}>
                          {orden.estado}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => navigate(`/admin/egresos/ordenes-pago/${orden.id}`)}
                          className="p-2 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg"
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginacion */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Mostrando página {pagination.page} de {pagination.pages} ({pagination.total} registros)
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
