import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, Calendar, User, Building2, Package, CreditCard, ShoppingCart, Ban } from 'lucide-react'
import { Button } from '../../../components/Button'
import { useModal } from '../../../components/Modal'
import api from '../../../services/api'

export default function FacturaVentaDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showModal, ModalComponent } = useModal()

  const [loading, setLoading] = useState(true)
  const [factura, setFactura] = useState(null)

  useEffect(() => {
    cargarFactura()
  }, [id])

  async function cargarFactura() {
    setLoading(true)
    try {
      const response = await api.getFull(`/admin/movimientos-contables/${id}`)
      setFactura(response.data)
    } catch (err) {
      console.error('Error cargando factura:', err)
      showModal({
        type: 'error',
        message: 'Error al cargar la factura',
        onConfirm: () => navigate('/admin/ingresos/facturas')
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleAnular() {
    showModal({
      type: 'confirm',
      title: 'Anular Factura',
      message: '¿Está seguro de anular esta factura? Esta accion revertira los movimientos de stock asociados.',
      onConfirm: async () => {
        try {
          await api.post(`/admin/movimientos-contables/${id}/anular`)
          showModal({
            type: 'success',
            message: 'Factura anulada correctamente',
            onConfirm: () => cargarFactura()
          })
        } catch (err) {
          showModal({ type: 'error', message: err.message || 'Error al anular la factura' })
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
      PAGADO: 'bg-green-100 text-green-700',
      CONFIRMADO: 'bg-blue-100 text-blue-700',
      ANULADO: 'bg-red-100 text-red-700'
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

  if (!factura) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Factura no encontrada</p>
        <Button variant="secondary" onClick={() => navigate('/admin/ingresos/facturas')} className="mt-4">
          Volver
        </Button>
      </div>
    )
  }

  const comprobante = factura.tipoComprobante
    ? `Factura ${factura.tipoComprobante} ${factura.puntoVenta}-${factura.numeroComprobante}`
    : 'Sin comprobante'

  return (
    <div>
      {ModalComponent}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/ingresos/facturas')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100">
              <FileText className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Factura {factura.numero}
              </h1>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEstadoBadge(factura.estado)}`}>
                {factura.estado}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {factura.estado !== 'ANULADO' && factura.estado !== 'PAGADO' && (
            <Button
              variant="secondary"
              onClick={() => navigate(`/admin/ingresos/recibos/nuevo?facturaId=${id}`)}
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Cobrar
            </Button>
          )}
          {factura.estado !== 'ANULADO' && (
            <Button variant="danger" onClick={handleAnular}>
              <Ban className="w-4 h-4 mr-2" />
              Anular
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Datos principales */}
        <div className="lg:col-span-2 space-y-6">
          {/* Informacion de la factura */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Informacion de la Factura</h2>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Numero Interno</p>
                <p className="font-mono font-medium">{factura.numero}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Comprobante</p>
                <p className="font-medium">{comprobante}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Fecha</p>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span>{formatFecha(factura.fecha)}</span>
                </div>
              </div>
              {factura.fechaVencimiento && (
                <div>
                  <p className="text-sm text-gray-500">Vencimiento</p>
                  <span>{formatFecha(factura.fechaVencimiento)}</span>
                </div>
              )}
              {factura.concepto && (
                <div>
                  <p className="text-sm text-gray-500">Concepto</p>
                  <span>{factura.concepto.nombre}</span>
                </div>
              )}
            </div>

            {factura.observaciones && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">Observaciones</p>
                <p className="text-gray-700">{factura.observaciones}</p>
              </div>
            )}
          </div>

          {/* Cliente/Socio */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              {factura.socio ? <User className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
              {factura.socio ? 'Socio' : 'Cliente'}
            </h2>

            {factura.socio ? (
              <div className="space-y-2">
                <p className="font-medium text-gray-800">
                  #{factura.socio.nroSocio} - {factura.socio.apellidoNombre}
                </p>
                {factura.socio.email && (
                  <p className="text-sm text-gray-600">{factura.socio.email}</p>
                )}
              </div>
            ) : factura.entidad ? (
              <div className="space-y-2">
                <p className="font-medium text-gray-800">{factura.entidad.razonSocial}</p>
                {factura.entidad.nombreFantasia && (
                  <p className="text-sm text-gray-600">({factura.entidad.nombreFantasia})</p>
                )}
                {factura.entidad.documento && (
                  <p className="text-sm text-gray-600">CUIT: {factura.entidad.documento}</p>
                )}
              </div>
            ) : (
              <p className="text-gray-500">Sin cliente asociado</p>
            )}

            {/* Pedido vinculado */}
            {factura.pedido && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 text-sm">
                  <ShoppingCart className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-500">Pedido:</span>
                  <button
                    onClick={() => navigate(`/admin/ingresos/pedidos/${factura.pedido.id}`)}
                    className="text-primary hover:underline font-medium"
                  >
                    {factura.pedido.numero}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Items */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-gray-600" />
              Items de la Factura
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 font-medium text-gray-600">Descripcion</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-600">Cantidad</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-600">Precio Unit.</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-600">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {factura.items.map((item) => {
                    const descripcion = item.descripcion ||
                      (item.productoVariante ?
                        `${item.productoVariante.producto?.nombre || ''} - ${item.productoVariante.talle}`
                        : 'Sin descripcion')

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
                        <td className="py-3 px-2 text-right">{formatMonto(item.precioUnitario)}</td>
                        <td className="py-3 px-2 text-right font-medium">{formatMonto(item.subtotal)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagos/Cobros asociados */}
          {factura.movimientosHijos && factura.movimientosHijos.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-gray-600" />
                Cobros Registrados
              </h2>

              <div className="space-y-2">
                {factura.movimientosHijos.map((cobro) => (
                  <div
                    key={cobro.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-800">{cobro.numero}</p>
                      <p className="text-sm text-gray-500">{formatFecha(cobro.fecha)}</p>
                    </div>
                    <span className="font-semibold text-green-600">
                      {formatMonto(cobro.montoTotal)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Resumen de totales */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Resumen</h2>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">{formatMonto(factura.subtotal)}</span>
              </div>
              {factura.iva21 > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">IVA 21%:</span>
                  <span className="font-medium">{formatMonto(factura.iva21)}</span>
                </div>
              )}
              {factura.iva105 > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">IVA 10.5%:</span>
                  <span className="font-medium">{formatMonto(factura.iva105)}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-bold border-t pt-3">
                <span>Total:</span>
                <span className="text-green-600">{formatMonto(factura.montoTotal)}</span>
              </div>
            </div>
          </div>

          {/* Estado de cobro */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Estado de Cobro</h2>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Cobrado:</span>
                <span className="font-medium text-green-600">{formatMonto(factura.montoPagado)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Pendiente:</span>
                <span className={`font-medium ${factura.saldoPendiente > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                  {formatMonto(factura.saldoPendiente)}
                </span>
              </div>

              {/* Barra de progreso */}
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full ${factura.saldoPendiente <= 0 ? 'bg-green-500' : 'bg-orange-400'}`}
                    style={{
                      width: `${Math.min((factura.montoPagado / factura.montoTotal) * 100, 100)}%`
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 text-center mt-1">
                  {((factura.montoPagado / factura.montoTotal) * 100).toFixed(0)}% cobrado
                </p>
              </div>
            </div>
          </div>

          {/* Informacion de registro */}
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
            <p>Registrada: {formatFechaHora(factura.createdAt)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
