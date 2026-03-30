import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CreditCard, Calendar, Building2, Wallet, FileText, Hash, Ban } from 'lucide-react'
import { Button } from '../../../components/Button'
import { useModal } from '../../../components/Modal'
import AdjuntosComprobante from '../../../components/AdjuntosComprobante'
import StatusBadge from '../../../components/StatusBadge'
import { formatCurrency, formatDate, formatDateTime } from '../../../utils/formatters'
import api from '../../../services/api'
import LoadingSpinner from '../../../components/LoadingSpinner'

export default function OrdenPagoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showModal, ModalComponent } = useModal()

  const [loading, setLoading] = useState(true)
  const [orden, setOrden] = useState(null)

  useEffect(() => {
    cargarOrden()
  }, [id])

  async function cargarOrden() {
    setLoading(true)
    try {
      const response = await api.getFull(`/admin/movimientos-contables/${id}`)
      setOrden(response.data)
    } catch (err) {
      console.error('Error cargando orden:', err)
      showModal({
        type: 'error',
        message: 'Error al cargar la orden de pago',
        onConfirm: () => navigate('/admin/egresos/ordenes-pago')
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleAnular() {
    showModal({
      type: 'confirm',
      title: 'Anular Orden de Pago',
      message: '¿Está seguro de anular esta orden de pago? Se revertirán los saldos de las facturas afectadas.',
      onConfirm: async () => {
        try {
          await api.post(`/admin/movimientos-contables/${id}/anular`)
          showModal({
            type: 'success',
            message: 'Orden de pago anulada correctamente',
            onConfirm: () => cargarOrden()
          })
        } catch (err) {
          showModal({ type: 'error', message: err.message || 'Error al anular la orden' })
        }
      }
    })
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

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  if (!orden) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Orden de pago no encontrada</p>
        <Button variant="secondary" onClick={() => navigate('/admin/egresos/ordenes-pago')} className="mt-4">
          Volver
        </Button>
      </div>
    )
  }

  return (
    <div>
      {ModalComponent}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/egresos/ordenes-pago')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <CreditCard className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Orden de Pago {orden.numero}
              </h1>
              <StatusBadge status={orden.estado} type="pago" />
            </div>
          </div>
        </div>

        {orden.estado === 'CONFIRMADO' && (
          <Button variant="danger" onClick={handleAnular}>
            <Ban className="w-4 h-4 mr-2" />
            Anular
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Datos principales */}
        <div className="lg:col-span-2 space-y-6">
          {/* Información del pago */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Información del Pago</h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Número</p>
                <p className="font-mono font-medium">{orden.numero}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Fecha</p>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span>{formatDate(orden.fecha)}</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Medio de Pago</p>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getMedioPagoBadge(orden.medioPago)}`}>
                  {orden.medioPago}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-500">Nro. Operación</p>
                <p>{orden.nroOperacion || '-'}</p>
              </div>
            </div>

            {orden.observaciones && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">Observaciones</p>
                <p className="text-gray-700">{orden.observaciones}</p>
              </div>
            )}
          </div>

          {/* Proveedor */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-gray-600" />
              Proveedor
            </h2>

            {orden.entidad ? (
              <div className="space-y-2">
                <p className="font-medium text-gray-800">{orden.entidad.razonSocial}</p>
                {orden.entidad.nombreFantasia && (
                  <p className="text-sm text-gray-600">({orden.entidad.nombreFantasia})</p>
                )}
                {orden.entidad.documento && (
                  <p className="text-sm text-gray-600">CUIT: {orden.entidad.documento}</p>
                )}
              </div>
            ) : (
              <p className="text-gray-500">Sin proveedor asociado</p>
            )}
          </div>

          {/* Facturas canceladas (si hay movimientos hijos/relacionados) */}
          {orden.movimientosHijos && orden.movimientosHijos.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-600" />
                Facturas Pagadas
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2 font-medium text-gray-600">Número</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-600">Tipo</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-600">Monto Pagado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orden.movimientosHijos.map((mov) => (
                      <tr key={mov.id} className="border-b border-gray-100">
                        <td className="py-2 px-2 font-mono text-sm">{mov.numero}</td>
                        <td className="py-2 px-2">{mov.tipo}</td>
                        <td className="py-2 px-2 text-right font-medium">{formatCurrency(mov.montoTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Resumen del pago */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Resumen</h2>

            <div className="space-y-3">
              <div className="flex justify-between text-3xl font-bold">
                <span className="text-gray-600">Total:</span>
                <span className="text-primary">{formatCurrency(orden.montoTotal)}</span>
              </div>
            </div>
          </div>

          {/* Caja */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-gray-600" />
              Caja
            </h2>

            {orden.caja ? (
              <div>
                <p className="font-medium text-gray-800">{orden.caja.nombre}</p>
                <p className="text-sm text-gray-500">{orden.caja.codigo}</p>
              </div>
            ) : (
              <p className="text-gray-500">Sin caja asociada</p>
            )}
          </div>

          {/* Adjuntos */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <AdjuntosComprobante tipo="movimientoContable" comprobanteId={orden.id} />
          </div>

          {/* Información de registro */}
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
            <p>Registrado: {formatDateTime(orden.createdAt)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
