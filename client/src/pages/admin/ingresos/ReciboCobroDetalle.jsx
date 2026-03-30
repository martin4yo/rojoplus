import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CreditCard, Calendar, User, Building2, Wallet, FileText } from 'lucide-react'
import { Button } from '../../../components/Button'
import { useModal } from '../../../components/Modal'
import AdjuntosComprobante from '../../../components/AdjuntosComprobante'
import api from '../../../services/api'
import LoadingSpinner from '../../../components/LoadingSpinner'

export default function ReciboCobroDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showModal, ModalComponent } = useModal()

  const [loading, setLoading] = useState(true)
  const [recibo, setRecibo] = useState(null)

  useEffect(() => {
    cargarRecibo()
  }, [id])

  async function cargarRecibo() {
    setLoading(true)
    try {
      const response = await api.getFull(`/admin/movimientos-contables/${id}`)
      setRecibo(response.data)
    } catch (err) {
      console.error('Error cargando recibo:', err)
      showModal({
        type: 'error',
        message: 'Error al cargar el recibo',
        onConfirm: () => navigate('/admin/ingresos/recibos')
      })
    } finally {
      setLoading(false)
    }
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

  function getMedioPagoBadge(medioPago) {
    const estilos = {
      EFECTIVO: 'bg-green-100 text-green-700',
      TRANSFERENCIA: 'bg-blue-100 text-blue-700',
      TARJETA: 'bg-purple-100 text-purple-700',
      CHEQUE: 'bg-orange-100 text-orange-700'
    }
    return estilos[medioPago] || 'bg-gray-100 text-gray-700'
  }

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  if (!recibo) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Recibo no encontrado</p>
        <Button variant="secondary" onClick={() => navigate('/admin/ingresos/recibos')} className="mt-4">
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
            onClick={() => navigate('/admin/ingresos/recibos')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100">
              <CreditCard className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Recibo {recibo.numero}
              </h1>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getMedioPagoBadge(recibo.medioPago)}`}>
                {recibo.medioPago}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Datos principales */}
        <div className="lg:col-span-2 space-y-6">
          {/* Informacion del recibo */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Informacion del Recibo</h2>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Numero</p>
                <p className="font-mono font-medium">{recibo.numero}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Fecha</p>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span>{formatFecha(recibo.fecha)}</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Medio de Pago</p>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getMedioPagoBadge(recibo.medioPago)}`}>
                  {recibo.medioPago}
                </span>
              </div>
              {recibo.nroOperacion && (
                <div>
                  <p className="text-sm text-gray-500">Nro. Operacion</p>
                  <p className="font-medium">{recibo.nroOperacion}</p>
                </div>
              )}
              {recibo.concepto && (
                <div>
                  <p className="text-sm text-gray-500">Concepto</p>
                  <p className="font-medium">{recibo.concepto.nombre}</p>
                </div>
              )}
            </div>

            {recibo.observaciones && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">Observaciones</p>
                <p className="text-gray-700">{recibo.observaciones}</p>
              </div>
            )}
          </div>

          {/* Cliente/Socio */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              {recibo.socio ? <User className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
              {recibo.socio ? 'Socio' : 'Cliente'}
            </h2>

            {recibo.socio ? (
              <div className="space-y-2">
                <p className="font-medium text-gray-800">
                  #{recibo.socio.nroSocio} - {recibo.socio.apellidoNombre}
                </p>
                {recibo.socio.email && (
                  <p className="text-sm text-gray-600">{recibo.socio.email}</p>
                )}
              </div>
            ) : recibo.entidad ? (
              <div className="space-y-2">
                <p className="font-medium text-gray-800">{recibo.entidad.razonSocial}</p>
                {recibo.entidad.nombreFantasia && (
                  <p className="text-sm text-gray-600">({recibo.entidad.nombreFantasia})</p>
                )}
                {recibo.entidad.documento && (
                  <p className="text-sm text-gray-600">CUIT: {recibo.entidad.documento}</p>
                )}
              </div>
            ) : (
              <p className="text-gray-500">Sin cliente asociado</p>
            )}
          </div>

          {/* Caja destino */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-gray-600" />
              Caja Destino
            </h2>

            {recibo.caja ? (
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Wallet className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-800">{recibo.caja.nombre}</p>
                  <p className="text-sm text-gray-500">{recibo.caja.codigo}</p>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">Sin caja asociada</p>
            )}
          </div>

          {/* Facturas canceladas */}
          {recibo.movimientoPadre && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-600" />
                Factura Cobrada
              </h2>

              <div
                className="p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => navigate(`/admin/ingresos/facturas/${recibo.movimientoPadre.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800">{recibo.movimientoPadre.numero}</p>
                    <p className="text-sm text-gray-500">{recibo.movimientoPadre.tipo}</p>
                  </div>
                  <span className="text-primary text-sm">Ver factura →</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Total */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Resumen</h2>

            <div className="flex justify-between text-xl font-bold">
              <span>Total Cobrado:</span>
              <span className="text-green-600">{formatMonto(recibo.montoTotal)}</span>
            </div>
          </div>

          {/* Adjuntos */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <AdjuntosComprobante tipo="movimientoContable" comprobanteId={recibo.id} />
          </div>

          {/* Informacion de registro */}
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
            <p>Registrado: {formatFechaHora(recibo.createdAt)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
