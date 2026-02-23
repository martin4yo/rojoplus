import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, ShoppingCart, Eye, Edit, Trash2, CheckCircle, XCircle, ChevronLeft, ChevronRight, Filter, Package } from 'lucide-react'
import { Button } from '../../../components/Button'
import { useModal } from '../../../components/Modal'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'

const ESTADOS = {
  PENDIENTE: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' },
  PARCIAL: { label: 'Parcial', color: 'bg-blue-100 text-blue-700' },
  RECIBIDA: { label: 'Recibida', color: 'bg-green-100 text-green-700' },
  CANCELADA: { label: 'Cancelada', color: 'bg-gray-100 text-gray-600' }
}

export default function OrdenesCompraLista() {
  const navigate = useNavigate()
  const { showModal, ModalComponent } = useModal()

  const [ordenes, setOrdenes] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroProveedor, setFiltroProveedor] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })

  useEffect(() => {
    cargarProveedores()
  }, [])

  useEffect(() => {
    cargarOrdenes()
  }, [filtroEstado, filtroProveedor, pagination.page])

  async function cargarProveedores() {
    try {
      const res = await api.getFull('/admin/entidades?tipo=PROVEEDOR&activo=true&limit=500')
      setProveedores(res.data || [])
    } catch (err) {
      console.error('Error cargando proveedores:', err)
    }
  }

  async function cargarOrdenes() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: pagination.page, limit: 20 })
      if (filtroEstado) params.append('estado', filtroEstado)
      if (filtroProveedor) params.append('entidadId', filtroProveedor)
      if (fechaDesde) params.append('desde', fechaDesde)
      if (fechaHasta) params.append('hasta', fechaHasta)
      if (busqueda) params.append('busqueda', busqueda)

      const res = await api.getFull(`/admin/ordenes-compra?${params}`)
      setOrdenes(res.data || [])
      if (res.pagination) {
        setPagination(prev => ({
          ...prev,
          pages: res.pagination.pages,
          total: res.pagination.total
        }))
      }
    } catch (err) {
      console.error('Error cargando ordenes:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleBuscar(e) {
    e.preventDefault()
    setPagination(prev => ({ ...prev, page: 1 }))
    cargarOrdenes()
  }

  function limpiarFiltros() {
    setBusqueda('')
    setFiltroEstado('')
    setFiltroProveedor('')
    setFechaDesde('')
    setFechaHasta('')
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  function handleCancelar(orden) {
    showModal({
      type: 'warning',
      title: 'Cancelar Orden',
      message: `¿Cancelar la orden ${orden.numero}?`,
      confirmText: 'Cancelar Orden',
      cancelText: 'Volver',
      onConfirm: async () => {
        try {
          await api.put(`/admin/ordenes-compra/${orden.id}/cancelar`)
          cargarOrdenes()
        } catch (err) {
          showModal({
            type: 'error',
            message: err.message || 'Error al cancelar orden'
          })
        }
      }
    })
  }

  function handleEliminar(orden) {
    showModal({
      type: 'warning',
      title: 'Eliminar Orden',
      message: `¿Eliminar la orden ${orden.numero}? Esta accion no se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        try {
          await api.delete(`/admin/ordenes-compra/${orden.id}`)
          cargarOrdenes()
        } catch (err) {
          showModal({
            type: 'error',
            message: err.message || 'Error al eliminar orden'
          })
        }
      }
    })
  }

  function formatFecha(fecha) {
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  function formatMonto(monto) {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(monto || 0)
  }

  return (
    <div>
      {ModalComponent}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <ShoppingCart className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Ordenes de Compra</h1>
            <p className="text-gray-500 text-sm">{pagination?.total || 0} ordenes</p>
          </div>
        </div>
        {tienePermiso(PERMISOS.EGRESOS_GESTIONAR) && (
          <Button onClick={() => navigate('/admin/egresos/ordenes-compra/nueva')}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Orden
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <form onSubmit={handleBuscar} className="space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por numero u observaciones..."
                  className="input-field w-full pl-10"
                />
              </div>
            </div>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="input-field w-full lg:w-40"
            >
              <option value="">Todos los estados</option>
              {Object.entries(ESTADOS).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
            <select
              value={filtroProveedor}
              onChange={(e) => setFiltroProveedor(e.target.value)}
              className="input-field w-full lg:w-56"
            >
              <option value="">Todos los proveedores</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>{p.razonSocial}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex gap-2 items-center">
              <span className="text-sm text-gray-600">Desde:</span>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="input-field w-40"
              />
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-sm text-gray-600">Hasta:</span>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="input-field w-40"
              />
            </div>
            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                onClick={limpiarFiltros}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Limpiar
              </button>
              <Button type="submit">
                <Filter className="w-4 h-4 mr-2" />
                Filtrar
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : ordenes.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No hay ordenes de compra registradas</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Numero</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Fecha</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Proveedor</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600 hidden md:table-cell">Items</th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Total</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Estado</th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {ordenes.map((orden) => (
                    <tr key={orden.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm font-medium text-primary">{orden.numero}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">{formatFecha(orden.fecha)}</span>
                        {orden.fechaEntrega && (
                          <p className="text-xs text-gray-400">
                            Entrega: {formatFecha(orden.fechaEntrega)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{orden.entidad?.razonSocial}</p>
                        {orden.entidad?.nombreFantasia && (
                          <p className="text-sm text-gray-500">{orden.entidad.nombreFantasia}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                          <Package className="w-4 h-4" />
                          {orden.items?.length || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-gray-800">{formatMonto(orden.total)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${ESTADOS[orden.estado]?.color || 'bg-gray-100'}`}>
                          {ESTADOS[orden.estado]?.label || orden.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to={`/admin/egresos/ordenes-compra/${orden.id}`}
                            className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-lg"
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          {orden.estado === 'PENDIENTE' && tienePermiso(PERMISOS.EGRESOS_GESTIONAR) && (
                            <>
                              <Link
                                to={`/admin/egresos/ordenes-compra/${orden.id}/editar`}
                                className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-lg"
                                title="Editar"
                              >
                                <Edit className="w-4 h-4" />
                              </Link>
                              <button
                                onClick={() => handleCancelar(orden)}
                                className="p-2 text-gray-500 hover:text-orange-600 hover:bg-gray-100 rounded-lg"
                                title="Cancelar orden"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleEliminar(orden)}
                                className="p-2 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded-lg"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {(orden.estado === 'PENDIENTE' || orden.estado === 'PARCIAL') && tienePermiso(PERMISOS.EGRESOS_GESTIONAR) && (
                            <Link
                              to={`/admin/egresos/ordenes-compra/${orden.id}/recibir`}
                              className="p-2 text-gray-500 hover:text-green-600 hover:bg-gray-100 rounded-lg"
                              title="Registrar recepcion"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Link>
                          )}
                        </div>
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
