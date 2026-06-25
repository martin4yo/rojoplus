import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  Phone,
  Mail,
  MessageSquare,
  DollarSign,
  TrendingUp,
  Users,
  Clock,
  Filter,
  Search,
  ChevronRight,
  AlertTriangle
} from 'lucide-react'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import Pagination from '../../components/Pagination'
import StatusBadge from '../../components/StatusBadge'
import { formatCurrency, formatDate } from '../../utils/formatters'
import usePagination from '../../hooks/usePagination'
import api from '../../services/api'
import { AxioChat } from '@axio/chat'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function GestionCobranzas() {
  const navigate = useNavigate()
  const { page, pagination, setPagination, goToPage } = usePagination()

  const [gestiones, setGestiones] = useState([])
  const [estadisticas, setEstadisticas] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filtros
  const [estado, setEstado] = useState('')
  const [prioridad, setPrioridad] = useState('')
  const [search, setSearch] = useState('')
  const [responsableId, setResponsableId] = useState('')

  // Datos auxiliares
  const [responsables, setResponsables] = useState([])

  useEffect(() => {
    cargarResponsables()
    cargarEstadisticas()
  }, [])

  useEffect(() => {
    cargarGestiones()
  }, [page, estado, prioridad, search, responsableId])

  const cargarResponsables = async () => {
    try {
      const res = await api.get('/admin/admins')
      setResponsables(res.data?.data || [])
    } catch (err) {
      console.error('Error cargando responsables:', err)
    }
  }

  const cargarEstadisticas = async () => {
    try {
      const res = await api.get('/admin/cobranzas/estadisticas')
      setEstadisticas(res.data?.data || null)
    } catch (err) {
      console.error('Error cargando estadísticas:', err)
    }
  }

  const cargarGestiones = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = { page, limit: 20 }
      if (estado) params.estado = estado
      if (prioridad) params.prioridad = prioridad
      if (search) params.search = search
      if (responsableId) params.responsableId = responsableId

      const res = await api.get('/admin/cobranzas', { params })
      const data = res.data?.data || []
      const pag = res.data?.pagination

      setGestiones(data)
      if (pag) {
        setPagination(pag)
      }
    } catch (err) {
      console.error('Error cargando gestiones:', err)
      setError('Error al cargar las gestiones de cobranza')
    } finally {
      setLoading(false)
    }
  }

  const limpiarFiltros = () => {
    setEstado('')
    setPrioridad('')
    setSearch('')
    setResponsableId('')
    goToPage(1)
  }

  const getPrioridadColor = (prioridad) => {
    switch (prioridad) {
      case 'CRITICA':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'ALTA':
        return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'MEDIA':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'BAJA':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getEstadoConfig = (estado) => {
    switch (estado) {
      case 'PENDIENTE':
        return { variant: 'warning', label: 'Pendiente' }
      case 'EN_GESTION':
        return { variant: 'info', label: 'En Gestión' }
      case 'PROMESA_PAGO':
        return { variant: 'primary', label: 'Promesa Pago' }
      case 'NO_CONTACTADO':
        return { variant: 'danger', label: 'No Contactado' }
      case 'RESUELTO':
        return { variant: 'success', label: 'Resuelto' }
      default:
        return { variant: 'secondary', label: estado }
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Gestión de Cobranzas
        </h1>
        <p className="text-gray-600">
          Administración y seguimiento de gestiones de cobranza
        </p>
      </div>

      {/* Estadísticas */}
      {estadisticas && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Gestiones</p>
                <p className="text-2xl font-bold text-gray-900">
                  {estadisticas.totalGestiones}
                </p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Deuda Total</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(estadisticas.totalDeuda)}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Prioridad Crítica</p>
                <p className="text-2xl font-bold text-red-600">
                  {estadisticas.porPrioridad?.find(p => p.prioridad === 'CRITICA')?._count || 0}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Prioridad Alta</p>
                <p className="text-2xl font-bold text-orange-600">
                  {estadisticas.porPrioridad?.find(p => p.prioridad === 'ALTA')?._count || 0}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-500" />
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Filtros</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Buscador */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar Socio
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nro, Nombre o DNI"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Estado */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado
            </label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="">Todos</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="EN_GESTION">En Gestión</option>
              <option value="PROMESA_PAGO">Promesa Pago</option>
              <option value="NO_CONTACTADO">No Contactado</option>
              <option value="RESUELTO">Resuelto</option>
            </select>
          </div>

          {/* Prioridad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prioridad
            </label>
            <select
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="">Todas</option>
              <option value="CRITICA">Crítica</option>
              <option value="ALTA">Alta</option>
              <option value="MEDIA">Media</option>
              <option value="BAJA">Baja</option>
            </select>
          </div>

          {/* Responsable */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Responsable
            </label>
            <select
              value={responsableId}
              onChange={(e) => setResponsableId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="">Todos</option>
              {responsables.map(r => (
                <option key={r.id} value={r.id}>
                  {r.nombre} {r.apellido}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(estado || prioridad || search || responsableId) && (
          <div className="mt-4 flex justify-end">
            <Button variant="secondary" size="sm" onClick={limpiarFiltros}>
              Limpiar filtros
            </Button>
          </div>
        )}
      </div>

      {/* Errores */}
      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {/* Lista de Gestiones */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <LoadingSpinner />
        ) : gestiones.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="text-lg font-medium">No se encontraron gestiones</p>
            <p className="text-sm mt-1">
              {(estado || prioridad || search || responsableId)
                ? 'Intenta ajustar los filtros de búsqueda'
                : 'No hay gestiones de cobranza activas'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Socio
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Prioridad
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Deuda
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Días Atraso
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Próxima Acción
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Responsable
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {gestiones.map((gestion) => (
                    <tr
                      key={gestion.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/admin/cobranzas/${gestion.id}`)}
                    >
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900">
                            {gestion.socio?.apellidoNombre}
                          </span>
                          <span className="text-sm text-gray-500">
                            Nro: {gestion.socio?.nroSocio}
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                            {gestion.socio?.email && (
                              <Mail className="w-3 h-3 text-gray-400" />
                            )}
                            {gestion.socio?.celular && (
                              <Phone className="w-3 h-3 text-gray-400" />
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge {...getEstadoConfig(gestion.estado)} />
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPrioridadColor(gestion.prioridad)}`}>
                          {gestion.prioridad}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-900">
                            {formatCurrency(gestion.montoDeuda)}
                          </span>
                          <span className="text-sm text-gray-500">
                            {gestion.cuotasAdeudadas} {gestion.cuotasAdeudadas === 1 ? 'cuota' : 'cuotas'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`font-semibold ${
                          gestion.diasAtraso > 90 ? 'text-red-600' :
                          gestion.diasAtraso > 60 ? 'text-orange-600' :
                          gestion.diasAtraso > 30 ? 'text-yellow-600' :
                          'text-blue-600'
                        }`}>
                          {gestion.diasAtraso} días
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {gestion.proximaAccion ? (
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900">
                              {gestion.proximaAccion}
                            </span>
                            {gestion.fechaProximaAccion && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDate(gestion.fechaProximaAccion)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {gestion.responsable ? (
                          <span className="text-sm text-gray-900">
                            {gestion.responsable.nombre} {gestion.responsable.apellido}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">Sin asignar</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/admin/cobranzas/${gestion.id}`)
                          }}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {pagination && pagination.pages > 1 && (
              <div className="border-t border-gray-200 px-4 py-3">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.pages}
                  onPageChange={goToPage}
                />
              </div>
            )}
          </>
        )}
      </div>

      <AxioChat endpoint="/api/chat" title="AXIO" extraBody={{ role: "admin" }} />
    </div>
  )
}
