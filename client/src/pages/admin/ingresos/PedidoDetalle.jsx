import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShoppingCart, Calendar, User, Building2, Package, FileText, Ban, Edit } from 'lucide-react'
import { Button } from '../../../components/Button'
import { useModal } from '../../../components/Modal'
import AdjuntosComprobante from '../../../components/AdjuntosComprobante'
import api from '../../../services/api'

export default function PedidoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showModal, ModalComponent } = useModal()

  const [loading, setLoading] = useState(true)
  const [pedido, setPedido] = useState(null)

  useEffect(() => {
    cargarPedido()
  }, [id])

  async function cargarPedido() {
    setLoading(true)
    try {
      const response = await api.getFull(`/admin/pedidos/${id}`)
      setPedido(response.data)
    } catch (err) {
      console.error('Error cargando pedido:', err)
      showModal({
        type: 'error',
        message: 'Error al cargar el pedido',
        onConfirm: () => navigate('/admin/ingresos/pedidos')
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleCancelar() {
    showModal({
      type: 'confirm',
      title: 'Cancelar Pedido',
      message: '¿Está seguro de cancelar este pedido?',
      onConfirm: async () => {
        try {
          await api.put(`/admin/pedidos/${id}/cancelar`)
          showModal({
            type: 'success',
            message: 'Pedido cancelado correctamente',
            onConfirm: () => cargarPedido()
          })
        } catch (err) {
          showModal({ type: 'error', message: err.message || 'Error al cancelar el pedido' })
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
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  function formatFechaHora(fecha) {
    return new Date(fecha).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function getEstadoBadge(estado) {
    const estilos = {
      PENDIENTE: 'bg-yellow-100 text-yellow-700',
      PARCIAL: 'bg-blue-100 text-blue-700',
      FACTURADO: 'bg-green-100 text-green-700',
      CANCELADO: 'bg-red-100 text-red-700'
    }
    return estilos[estado] || 'bg-gray-100 text-gray-700'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!pedido) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Pedido no encontrado</p>
        <Button variant="secondary" onClick={() => navigate('/admin/ingresos/pedidos')} className="mt-4">
          Volver
        </Button>
      </div>
    )
  }

  const tieneItemsPendientes = pedido.items.some(i => i.cantidad > i.cantidadFacturada)

  return (
    <div>
      {ModalComponent}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/ingresos/pedidos')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100">
              <ShoppingCart className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Pedido {pedido.numero}
              </h1>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEstadoBadge(pedido.estado)}`}>
                {pedido.estado}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {pedido.estado === 'PENDIENTE' && (
            <>
              <Button
                variant="secondary"
                onClick={() => navigate(`/admin/ingresos/pedidos/${id}/editar`)}
              >
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
              <Button
                variant="danger"
                onClick={handleCancelar}
              >
                <Ban className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
            </>
          )}
          {(pedido.estado === 'PENDIENTE' || pedido.estado === 'PARCIAL') && tieneItemsPendientes && (
            <Button
              onClick={() => navigate(`/admin/ingresos/facturas/nueva?pedidoId=${id}`)}
            >
              <FileText className="w-4 h-4 mr-2" />
              Facturar
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Datos principales */}
        <div className="lg:col-span-2 space-y-6">
          {/* Información del pedido */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Información del Pedido</h2>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Número</p>
                <p className="font-mono font-medium">{pedido.numero}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Fecha</p>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span>{formatFecha(pedido.fecha)}</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Fecha Entrega</p>
                <span>{pedido.fechaEntrega ? formatFecha(pedido.fechaEntrega) : '-'}</span>
              </div>
            </div>

            {pedido.observaciones && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">Observaciones</p>
                <p className="text-gray-700">{pedido.observaciones}</p>
              </div>
            )}
          </div>

          {/* Cliente/Socio */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              {pedido.socio ? <User className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
              {pedido.socio ? 'Socio' : 'Cliente'}
            </h2>

            {pedido.socio ? (
              <div className="space-y-2">
                <p className="font-medium text-gray-800">
                  #{pedido.socio.nroSocio} - {pedido.socio.apellidoNombre}
                </p>
                {pedido.socio.email && (
                  <p className="text-sm text-gray-600">{pedido.socio.email}</p>
                )}
                {pedido.socio.celular && (
                  <p className="text-sm text-gray-600">{pedido.socio.celular}</p>
                )}
              </div>
            ) : pedido.entidad ? (
              <div className="space-y-2">
                <p className="font-medium text-gray-800">{pedido.entidad.razonSocial}</p>
                {pedido.entidad.nombreFantasia && (
                  <p className="text-sm text-gray-600">({pedido.entidad.nombreFantasia})</p>
                )}
                {pedido.entidad.documento && (
                  <p className="text-sm text-gray-600">CUIT: {pedido.entidad.documento}</p>
                )}
              </div>
            ) : (
              <p className="text-gray-500">Sin cliente asociado</p>
            )}
          </div>

          {/* Items */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-gray-600" />
              Items del Pedido
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 font-medium text-gray-600">Descripción</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-600">Cantidad</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-600">Facturado</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-600">Pendiente</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-600">Precio Unit.</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-600">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {pedido.items.map((item) => {
                    const pendiente = item.cantidad - item.cantidadFacturada
                    const descripcion = item.descripcion ||
                      (item.productoVariante ?
                        `${item.productoVariante.producto?.nombre || ''} - ${item.productoVariante.talle}`
                        : 'Sin descripción')

                    return (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="py-3 px-2">
                          <div>
                            <p className="font-medium text-gray-800">{descripcion}</p>
                            {item.productoVariante && (
                              <p className="text-xs text-gray-500">
                                {item.productoVariante.producto?.codigo}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-center">{item.cantidad}</td>
                        <td className="py-3 px-2 text-center text-green-600">{item.cantidadFacturada}</td>
                        <td className="py-3 px-2 text-center">
                          <span className={pendiente > 0 ? 'text-orange-600 font-medium' : 'text-gray-400'}>
                            {pendiente}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right">{formatMonto(item.precioUnitario)}</td>
                        <td className="py-3 px-2 text-right font-medium">{formatMonto(item.subtotal)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Resumen de totales */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Resumen</h2>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">{formatMonto(pedido.subtotal)}</span>
              </div>
              {pedido.iva21 > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">IVA 21%:</span>
                  <span className="font-medium">{formatMonto(pedido.iva21)}</span>
                </div>
              )}
              {pedido.iva105 > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">IVA 10.5%:</span>
                  <span className="font-medium">{formatMonto(pedido.iva105)}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-bold border-t pt-3">
                <span>Total:</span>
                <span className="text-green-600">{formatMonto(pedido.total)}</span>
              </div>
            </div>
          </div>

          {/* Estado de facturación */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Estado de Facturación</h2>

            <div className="space-y-2">
              {pedido.items.map((item) => {
                const porcentaje = item.cantidad > 0 ? (item.cantidadFacturada / item.cantidad) * 100 : 0
                const descripcion = item.descripcion ||
                  (item.productoVariante ? `${item.productoVariante.talle}` : 'Item')

                return (
                  <div key={item.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 truncate max-w-[150px]">{descripcion}</span>
                      <span className="text-gray-800">{item.cantidadFacturada}/{item.cantidad}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${porcentaje >= 100 ? 'bg-green-500' : 'bg-orange-400'}`}
                        style={{ width: `${Math.min(porcentaje, 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Adjuntos */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <AdjuntosComprobante tipo="pedido" comprobanteId={pedido.id} />
          </div>

          {/* Información de registro */}
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
            <p>Registrado: {formatFechaHora(pedido.createdAt)}</p>
            {pedido.updatedAt !== pedido.createdAt && (
              <p>Actualizado: {formatFechaHora(pedido.updatedAt)}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
