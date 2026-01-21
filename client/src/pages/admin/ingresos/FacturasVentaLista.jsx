import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Filter, FileText, Calendar, User, Building2, Eye, Ban } from 'lucide-react'
import { Button } from '../../../components/Button'
import { useModal } from '../../../components/Modal'
import api from '../../../services/api'

const ESTADOS = [
  { value: '', label: 'Todos' },
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'PAGADO', label: 'Pagado' },
  { value: 'CONFIRMADO', label: 'Confirmado' },
  { value: 'ANULADO', label: 'Anulado' }
]

export default function FacturasVentaLista() {
  const navigate = useNavigate()
  const { showModal, ModalComponent } = useModal()
  const [loading, setLoading] = useState(true)
  const [facturas, setFacturas] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })

  const [filtros, setFiltros] = useState({
    estado: '',
    desde: '',
    hasta: '',
    busqueda: ''
  })
  const [mostrarFiltros, setMostrarFiltros] = useState(false)

  useEffect(() => {
    cargarFacturas()
  }, [filtros, pagination.page])

  async function cargarFacturas() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('page', pagination.page)
      params.append('limit', '20')

      if (filtros.estado) params.append('estado', filtros.estado)
      if (filtros.desde) params.append('desde', filtros.desde)
      if (filtros.hasta) params.append('hasta', filtros.hasta)

      const response = await api.getFull(`/admin/facturas-venta?${params}`)
      setFacturas(response.data || [])
      setPagination(prev => ({
        ...prev,
        pages: response.pagination?.pages || 1,
        total: response.pagination?.total || 0
      }))
    } catch (err) {
      console.error('Error cargando facturas:', err)
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
      desde: '',
      hasta: '',
      busqueda: ''
    })
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  async function handleAnular(factura) {
    showModal({
      type: 'confirm',
      title: 'Anular Factura',
      message: `¿Está seguro de anular la factura ${factura.numero}?`,
      onConfirm: async () => {
        try {
          await api.post(`/admin/movimientos-contables/${factura.id}/anular`)
          showModal({ type: 'success', message: 'Factura anulada correctamente' })
          cargarFacturas()
        } catch (err) {
          showModal({ type: 'error', message: err.message || 'Error al anular' })
        }
      }
    })
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
      PENDIENTE: 'bg-yellow-100 text-yellow-700',
      PAGADO: 'bg-green-100 text-green-700',
      CONFIRMADO: 'bg-blue-100 text-blue-700',
      ANULADO: 'bg-red-100 text-red-700'
    }
    return estilos[estado] || 'bg-gray-100 text-gray-700'
  }

  function getClienteInfo(factura) {
    if (factura.socio) {
      return {
        tipo: 'Socio',
        nombre: `#${factura.socio.nroSocio} - ${factura.socio.apellidoNombre}`,
        icon: User
      }
    }
    if (factura.entidad) {
      return {
        tipo: 'Cliente',
        nombre: factura.entidad.razonSocial,
        icon: Building2
      }
    }
    return { tipo: '-', nombre: '-', icon: User }
  }

  return (
    <div>
      {ModalComponent}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-100">
            <FileText className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Facturas de Venta</h1>
            <p className="text-sm text-gray-500">Facturas emitidas a clientes y socios</p>
          </div>
        </div>
        <Button onClick={() => navigate('/admin/ingresos/facturas/nueva')}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Factura
        </Button>
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
              placeholder="Buscar por numero o cliente..."
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
        ) : facturas.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No hay facturas registradas</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Número</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Fecha</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Comprobante</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Cliente/Socio</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Total</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Saldo</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Estado</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {facturas.map((factura) => {
                    const cliente = getClienteInfo(factura)
                    const IconCliente = cliente.icon
                    const comprobante = factura.tipoComprobante
                      ? `${factura.tipoComprobante} ${factura.puntoVenta}-${factura.numeroComprobante}`
                      : '-'

                    return (
                      <tr key={factura.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <span className="font-mono text-sm font-medium text-primary">
                            {factura.numero}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="w-4 h-4" />
                            {formatFecha(factura.fecha)}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {comprobante}
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
                        <td className="py-3 px-4 text-right">
                          <span className="font-semibold text-gray-800">
                            {formatMonto(factura.montoTotal)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={factura.saldoPendiente > 0 ? 'text-orange-600 font-medium' : 'text-gray-400'}>
                            {formatMonto(factura.saldoPendiente)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEstadoBadge(factura.estado)}`}>
                            {factura.estado}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => navigate(`/admin/ingresos/facturas/${factura.id}`)}
                              className="p-2 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg"
                              title="Ver detalle"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {factura.estado !== 'ANULADO' && (
                              <button
                                onClick={() => handleAnular(factura)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-lg"
                                title="Anular"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            )}
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
