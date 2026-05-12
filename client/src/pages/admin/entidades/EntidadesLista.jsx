import { useState, useEffect, Fragment } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, Building2, UserCheck, Briefcase, Eye, Edit, ChevronRight, ChevronDown, Clock, CheckCircle2 } from 'lucide-react'
import { Button } from '../../../components/Button'
import { tienePermiso, PERMISOS } from '../../../services/permisos'
import { usePagination } from '../../../hooks/usePagination'
import Pagination from '../../../components/Pagination'
import LoadingSpinner from '../../../components/LoadingSpinner'
import api from '../../../services/api'

function formatMonto(monto) {
  if (monto == null) return '$ 0'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(Number(monto))
}
function formatFecha(f) {
  if (!f) return '-'
  return new Date(f).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const TIPO_CONFIG = {
  PROVEEDOR: {
    titulo: 'Proveedores',
    singular: 'Proveedor',
    icon: Building2,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    ruta: '/admin/egresos/proveedores',
    permiso: PERMISOS.EGRESOS_GESTIONAR
  },
  CLIENTE: {
    titulo: 'Clientes',
    singular: 'Cliente',
    icon: UserCheck,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    ruta: '/admin/ingresos/clientes',
    permiso: PERMISOS.INGRESOS_GESTIONAR
  },
  PERSONAL: {
    titulo: 'Personal',
    singular: 'Personal',
    icon: Briefcase,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    ruta: '/admin/egresos/personal',
    permiso: PERMISOS.SUELDOS_GESTIONAR
  }
}

export default function EntidadesLista({ tipo }) {
  const navigate = useNavigate()
  const config = TIPO_CONFIG[tipo]
  const Icon = config.icon

  const [entidades, setEntidades] = useState([])
  const [loading, setLoading] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [soloActivos, setSoloActivos] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [historial, setHistorial] = useState({}) // { [entidadId]: { loading, items } }

  async function toggleExpand(entidadId) {
    if (expandedId === entidadId) {
      setExpandedId(null)
      return
    }
    setExpandedId(entidadId)
    if (historial[entidadId]) return // cached
    setHistorial(prev => ({ ...prev, [entidadId]: { loading: true, items: [] } }))
    try {
      const items = await api.get(`/admin/entidades/${entidadId}/liquidaciones`)
      setHistorial(prev => ({ ...prev, [entidadId]: { loading: false, items: items || [] } }))
    } catch (err) {
      console.error('Error cargando historial:', err)
      setHistorial(prev => ({ ...prev, [entidadId]: { loading: false, items: [] } }))
    }
  }

  const { page, limit, pagination, setPagination, goToPage } = usePagination(1, 20)

  // Cargar entidades
  useEffect(() => {
    const cargarEntidades = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          tipo,
          page: page.toString(),
          limit: limit.toString()
        })

        if (soloActivos) params.append('activo', 'true')
        if (busqueda) params.append('busqueda', busqueda)

        const response = await fetch(`/api/admin/entidades?${params.toString()}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
            'Content-Type': 'application/json'
          }
        })

        const data = await response.json()

        if (data.success) {
          setEntidades(data.data || [])
          if (data.pagination) {
            setPagination(data.pagination)
          }
        }
      } catch (error) {
        console.error('Error cargando entidades:', error)
        setEntidades([])
      } finally {
        setLoading(false)
      }
    }

    cargarEntidades()
  }, [tipo, page, limit, soloActivos, busqueda, setPagination])

  function handleBuscar(e) {
    e.preventDefault()
    goToPage(1)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${config.bgColor}`}>
            <Icon className={`w-6 h-6 ${config.color}`} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{config.titulo}</h1>
            <p className="text-gray-500 text-sm">{pagination?.total || 0} registros</p>
          </div>
        </div>
        {tienePermiso(config.permiso) && (
          <Button onClick={() => navigate(`${config.ruta}/nuevo`)}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo {config.singular}
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <form onSubmit={handleBuscar} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por codigo, razon social o documento..."
                className="input-field w-full pl-10"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={soloActivos}
              onChange={(e) => setSoloActivos(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-sm text-gray-600">Solo activos</span>
          </label>
          <Button type="submit">Buscar</Button>
        </form>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <LoadingSpinner />
        ) : entidades.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Icon className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No hay {config.titulo.toLowerCase()} registrados</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {tipo === 'PERSONAL' && <th className="w-8 px-2 py-3" />}
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Codigo</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Razon Social</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600 hidden md:table-cell">Documento</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600 hidden lg:table-cell">Telefono</th>
                    {tipo === 'PERSONAL' && (
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600 hidden lg:table-cell">Cargo</th>
                    )}
                    <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Estado</th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {entidades.map((entidad) => {
                    const isExpanded = expandedId === entidad.id
                    const hist = historial[entidad.id]
                    const totalCols = tipo === 'PERSONAL' ? 8 : 6
                    return (
                    <Fragment key={entidad.id}>
                    <tr className="hover:bg-gray-50">
                      {tipo === 'PERSONAL' && (
                        <td className="w-8 px-2 py-3">
                          <button
                            type="button"
                            onClick={() => toggleExpand(entidad.id)}
                            className="p-1 text-gray-400 hover:text-primary"
                            title={isExpanded ? 'Ocultar liquidaciones' : 'Ver liquidaciones'}
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-gray-600">{entidad.codigo}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-800">{entidad.razonSocial}</p>
                          {entidad.nombreFantasia && (
                            <p className="text-sm text-gray-500">{entidad.nombreFantasia}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-sm text-gray-600">
                          {entidad.tipoDocumento}: {entidad.documento || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-sm text-gray-600">{entidad.telefono || '-'}</span>
                      </td>
                      {tipo === 'PERSONAL' && (
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-sm text-gray-600">{entidad.cargoPersonal?.nombre || '-'}</span>
                        </td>
                      )}
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          entidad.activo
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {entidad.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`${config.ruta}/${entidad.id}`}
                            className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-lg"
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          {tienePermiso(config.permiso) && (
                            <Link
                              to={`${config.ruta}/${entidad.id}/editar`}
                              className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-lg"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                    {tipo === 'PERSONAL' && isExpanded && (
                      <tr className="bg-gray-50">
                        <td colSpan={totalCols} className="px-6 py-4">
                          {hist?.loading ? (
                            <p className="text-sm text-gray-500">Cargando historial...</p>
                          ) : !hist || hist.items.length === 0 ? (
                            <p className="text-sm text-gray-500">El empleado no tiene liquidaciones registradas.</p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-left text-gray-600 border-b border-gray-300">
                                    <th className="py-2 pr-4">Período</th>
                                    <th className="py-2 pr-4 text-right">Sueldo Base</th>
                                    <th className="py-2 pr-4 text-right">Haberes</th>
                                    <th className="py-2 pr-4 text-right">Deducciones</th>
                                    <th className="py-2 pr-4 text-right">Neto</th>
                                    <th className="py-2 pr-4 text-center">Estado</th>
                                    <th className="py-2 pr-4">Fecha pago</th>
                                    <th className="py-2 pr-4">Medio</th>
                                    <th className="py-2">Mov. Caja</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {hist.items.map(it => {
                                    const pagado = it.estado === 'PAGADO'
                                    const mv = it.movimientoCaja
                                    return (
                                      <tr key={it.id}>
                                        <td className="py-2 pr-4 font-medium text-gray-800">{it.liquidacion?.periodo}</td>
                                        <td className="py-2 pr-4 text-right font-mono text-gray-700">{formatMonto(it.sueldoBasico)}</td>
                                        <td className="py-2 pr-4 text-right text-green-700">+{formatMonto(it.totalHaberes)}</td>
                                        <td className="py-2 pr-4 text-right text-red-700">-{formatMonto(it.totalDeducciones)}</td>
                                        <td className="py-2 pr-4 text-right font-semibold text-purple-700">{formatMonto(it.netoAPagar)}</td>
                                        <td className="py-2 pr-4 text-center">
                                          {pagado ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
                                              <CheckCircle2 className="w-3 h-3" /> Pagado
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">
                                              <Clock className="w-3 h-3" /> Pendiente
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-2 pr-4 text-gray-600">{pagado ? formatFecha(it.fechaPago) : '-'}</td>
                                        <td className="py-2 pr-4 text-gray-600">{mv?.medioPagoRel?.nombre || '-'}</td>
                                        <td className="py-2">
                                          {mv ? (
                                            <Link
                                              to={`/admin/tesoreria/movimientos/${mv.id}`}
                                              className="text-primary hover:underline font-mono text-xs"
                                            >
                                              {mv.numero}
                                            </Link>
                                          ) : (
                                            <span className="text-gray-400 text-xs">-</span>
                                          )}
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  )})}
                </tbody>
              </table>
            </div>

            {/* Paginacion */}
            <div className="border-t border-gray-200 bg-gray-50 px-4">
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
