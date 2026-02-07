import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, FileText, Eye, XCircle, ChevronLeft, ChevronRight, Filter, CreditCard, Package } from 'lucide-react'
import { Button } from '../../../components/Button'
import { useModal } from '../../../components/Modal'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'

const ESTADOS = {
  PENDIENTE: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' },
  PAGADO: { label: 'Pagado', color: 'bg-green-100 text-green-700' },
  ANULADO: { label: 'Anulado', color: 'bg-red-100 text-red-600' }
}

const TIPOS = {
  FACTURA_COMPRA: { label: 'Factura', color: 'bg-blue-100 text-blue-700' },
  NOTA_CREDITO_PROVEEDOR: { label: 'Nota Credito', color: 'bg-purple-100 text-purple-700' },
  NOTA_DEBITO_PROVEEDOR: { label: 'Nota Debito', color: 'bg-orange-100 text-orange-700' }
}

export default function FacturasCompraLista() {
  const navigate = useNavigate()
  const { showModal, ModalComponent } = useModal()

  const [facturas, setFacturas] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroProveedor, setFiltroProveedor] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })

  useEffect(() => {
    cargarProveedores()
  }, [])

  useEffect(() => {
    cargarFacturas()
  }, [filtroEstado, filtroProveedor, pagination.page])

  async function cargarProveedores() {
    try {
      const res = await api.getFull('/admin/entidades?tipo=PROVEEDOR&activo=true&limit=500')
      setProveedores(res.data || [])
    } catch (err) {
      console.error('Error cargando proveedores:', err)
    }
  }

  async function cargarFacturas() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: pagination.page, limit: 20 })
      if (filtroEstado) params.append('estado', filtroEstado)
      if (filtroProveedor) params.append('entidadId', filtroProveedor)
      if (fechaDesde) params.append('desde', fechaDesde)
      if (fechaHasta) params.append('hasta', fechaHasta)

      const res = await api.getFull(`/admin/facturas-compra?${params}`)
      setFacturas(res.data || [])
      if (res.pagination) {
        setPagination(prev => ({
          ...prev,
          pages: res.pagination.pages,
          total: res.pagination.total
        }))
      }
    } catch (err) {
      console.error('Error cargando facturas:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleBuscar(e) {
    e.preventDefault()
    setPagination(prev => ({ ...prev, page: 1 }))
    cargarFacturas()
  }

  function limpiarFiltros() {
    setFiltroEstado('')
    setFiltroProveedor('')
    setFechaDesde('')
    setFechaHasta('')
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  function handleAnular(factura) {
    showModal({
      type: 'warning',
      title: 'Anular Factura',
      message: `¿Anular la factura ${factura.numero}? Esta accion revertira el stock asociado.`,
      confirmText: 'Anular',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        try {
          await api.post(`/admin/movimientos-contables/${factura.id}/anular`)
          cargarFacturas()
          showModal({
            type: 'success',
            message: 'Factura anulada correctamente'
          })
        } catch (err) {
          showModal({
            type: 'error',
            message: err.message || 'Error al anular factura'
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
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Facturas de Compra</h1>
            <p className="text-gray-500 text-sm">{pagination.total} facturas</p>
          </div>
        </div>
        {tienePermiso(PERMISOS.EGRESOS_GESTIONAR) && (
          <Button onClick={() => navigate('/admin/egresos/facturas/nueva')}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Factura
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <form onSubmit={handleBuscar} className="space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
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
              className="input-field w-full lg:w-56 flex-1"
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
        ) : facturas.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No hay facturas de compra registradas</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Numero</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Tipo</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Fecha</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Proveedor</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600 hidden md:table-cell">Comprobante</th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Total</th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600 hidden lg:table-cell">Saldo</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Estado</th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {facturas.map((factura) => (
                    <tr key={factura.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm font-medium text-primary">{factura.numero}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${TIPOS[factura.tipo]?.color || 'bg-gray-100'}`}>
                          {TIPOS[factura.tipo]?.label || factura.tipo}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">{formatFecha(factura.fecha)}</span>
                        {factura.fechaVencimiento && (
                          <p className="text-xs text-gray-400">
                            Vence: {formatFecha(factura.fechaVencimiento)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{factura.entidad?.razonSocial}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {factura.tipoComprobante && factura.numeroComprobante ? (
                          <span className="text-sm text-gray-600 font-mono">
                            {factura.tipoComprobante} {factura.puntoVenta}-{factura.numeroComprobante}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-gray-800">{formatMonto(factura.montoTotal)}</span>
                      </td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell">
                        {factura.saldoPendiente > 0 ? (
                          <span className="font-medium text-red-600">{formatMonto(factura.saldoPendiente)}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${ESTADOS[factura.estado]?.color || 'bg-gray-100'}`}>
                          {ESTADOS[factura.estado]?.label || factura.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to={`/admin/egresos/facturas/${factura.id}`}
                            className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-lg"
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          {factura.estado === 'PENDIENTE' && tienePermiso(PERMISOS.EGRESOS_GESTIONAR) && (
                            <>
                              <Link
                                to={`/admin/egresos/facturas/${factura.id}/pagar`}
                                className="p-2 text-gray-500 hover:text-green-600 hover:bg-gray-100 rounded-lg"
                                title="Registrar pago"
                              >
                                <CreditCard className="w-4 h-4" />
                              </Link>
                              <button
                                onClick={() => handleAnular(factura)}
                                className="p-2 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded-lg"
                                title="Anular factura"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
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
