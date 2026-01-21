import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, FileText, CreditCard, XCircle, Building2, Calendar, Package, Clock, CheckCircle } from 'lucide-react'
import { Button } from '../../../components/Button'
import { useModal } from '../../../components/Modal'
import api from '../../../services/api'

const ESTADOS = {
  PENDIENTE: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  PAGADO: { label: 'Pagado', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  ANULADO: { label: 'Anulado', color: 'bg-red-100 text-red-600', icon: XCircle }
}

const TIPOS = {
  FACTURA_COMPRA: { label: 'Factura de Compra', color: 'bg-blue-100 text-blue-700' },
  NOTA_CREDITO_PROVEEDOR: { label: 'Nota de Credito', color: 'bg-purple-100 text-purple-700' },
  NOTA_DEBITO_PROVEEDOR: { label: 'Nota de Debito', color: 'bg-orange-100 text-orange-700' }
}

export default function FacturaCompraDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showModal, ModalComponent } = useModal()

  const [factura, setFactura] = useState(null)
  const [loading, setLoading] = useState(true)
  const [cajas, setCajas] = useState([])

  // Estado para pago
  const [mostrarPago, setMostrarPago] = useState(false)
  const [pago, setPago] = useState({
    cajaId: '',
    medioPago: 'TRANSFERENCIA',
    nroOperacion: '',
    monto: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    cargarDatos()
  }, [id])

  async function cargarDatos() {
    setLoading(true)
    try {
      const [facturaRes, cajasRes] = await Promise.all([
        api.getFull(`/admin/movimientos-contables/${id}`),
        api.getFull('/admin/cajas?activo=true')
      ])
      setFactura(facturaRes.data)
      setCajas(cajasRes.data || [])

      // Inicializar monto de pago con saldo pendiente
      if (facturaRes.data.saldoPendiente > 0) {
        setPago(prev => ({ ...prev, monto: facturaRes.data.saldoPendiente.toString() }))
      }
    } catch (err) {
      console.error('Error cargando factura:', err)
      showModal({ type: 'error', message: 'Error al cargar la factura' })
      navigate('/admin/egresos/facturas')
    } finally {
      setLoading(false)
    }
  }

  function handleAnular() {
    showModal({
      type: 'warning',
      title: 'Anular Factura',
      message: `¿Anular la factura ${factura.numero}? Esta accion revertira el stock asociado y no se puede deshacer.`,
      confirmText: 'Anular',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        try {
          await api.post(`/admin/movimientos-contables/${id}/anular`)
          await cargarDatos()
          showModal({ type: 'success', message: 'Factura anulada correctamente' })
        } catch (err) {
          showModal({ type: 'error', message: err.message || 'Error al anular factura' })
        }
      }
    })
  }

  async function handlePagar(e) {
    e.preventDefault()

    if (!pago.cajaId) {
      showModal({ type: 'warning', message: 'Debe seleccionar una caja' })
      return
    }

    const montoPago = parseFloat(pago.monto)
    if (!montoPago || montoPago <= 0) {
      showModal({ type: 'warning', message: 'El monto debe ser mayor a 0' })
      return
    }

    if (montoPago > factura.saldoPendiente) {
      showModal({ type: 'warning', message: 'El monto no puede ser mayor al saldo pendiente' })
      return
    }

    setSaving(true)
    try {
      await api.post('/admin/movimientos-contables', {
        tipo: 'ORDEN_PAGO',
        entidadId: factura.entidadId,
        movimientoPadreId: factura.id,
        montoTotal: montoPago,
        cajaId: parseInt(pago.cajaId),
        medioPago: pago.medioPago,
        nroOperacion: pago.nroOperacion || null,
        observaciones: `Pago de ${factura.numero}`
      })

      await cargarDatos()
      setMostrarPago(false)
      setPago({ cajaId: '', medioPago: 'TRANSFERENCIA', nroOperacion: '', monto: '' })
      showModal({ type: 'success', message: 'Pago registrado correctamente' })
    } catch (err) {
      showModal({ type: 'error', message: err.message || 'Error al registrar pago' })
    } finally {
      setSaving(false)
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!factura) return null

  const estadoConfig = ESTADOS[factura.estado]
  const tipoConfig = TIPOS[factura.tipo]
  const EstadoIcon = estadoConfig?.icon || FileText

  return (
    <div>
      {ModalComponent}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/egresos/facturas')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{factura.numero}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${tipoConfig?.color}`}>
                  {tipoConfig?.label || factura.tipo}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${estadoConfig?.color}`}>
                  <EstadoIcon className="w-3 h-3" />
                  {estadoConfig?.label || factura.estado}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {factura.estado === 'PENDIENTE' && (
            <>
              <Button variant="secondary" onClick={handleAnular}>
                <XCircle className="w-4 h-4 mr-2" />
                Anular
              </Button>
              <Button onClick={() => setMostrarPago(true)}>
                <CreditCard className="w-4 h-4 mr-2" />
                Registrar Pago
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Info principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Proveedor */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-800">Proveedor</h2>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-gray-800">{factura.entidad?.razonSocial}</p>
            {factura.entidad?.nombreFantasia && (
              <p className="text-sm text-gray-500">{factura.entidad.nombreFantasia}</p>
            )}
            {factura.entidad?.documento && (
              <p className="text-sm text-gray-500">
                {factura.entidad.tipoDocumento}: {factura.entidad.documento}
              </p>
            )}
            {factura.entidad?.telefono && (
              <p className="text-sm text-gray-500">Tel: {factura.entidad.telefono}</p>
            )}
          </div>
        </div>

        {/* Datos del comprobante */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-800">Comprobante</h2>
          </div>
          <div className="space-y-2">
            {factura.tipoComprobante && factura.numeroComprobante && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Nro. Comprobante:</span>
                <span className="font-mono font-medium">
                  {factura.tipoComprobante} {factura.puntoVenta}-{factura.numeroComprobante}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Fecha:</span>
              <span className="font-medium">{formatFecha(factura.fecha)}</span>
            </div>
            {factura.fechaVencimiento && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Vencimiento:</span>
                <span className="font-medium">{formatFecha(factura.fechaVencimiento)}</span>
              </div>
            )}
            {factura.concepto && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Concepto:</span>
                <span className="font-medium">{factura.concepto.nombre}</span>
              </div>
            )}
          </div>
        </div>

        {/* Totales */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-800">Importes</h2>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Subtotal:</span>
              <span className="font-medium">{formatMonto(factura.subtotal)}</span>
            </div>
            {factura.iva21 > 0 && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">IVA 21%:</span>
                <span className="font-medium">{formatMonto(factura.iva21)}</span>
              </div>
            )}
            {factura.iva105 > 0 && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">IVA 10.5%:</span>
                <span className="font-medium">{formatMonto(factura.iva105)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-2">
              <span className="font-semibold text-gray-800">Total:</span>
              <span className="font-bold text-primary text-lg">{formatMonto(factura.montoTotal)}</span>
            </div>
            {factura.estado === 'PENDIENTE' && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Pagado:</span>
                  <span className="font-medium text-green-600">{formatMonto(factura.montoPagado)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-800">Saldo pendiente:</span>
                  <span className="font-bold text-red-600">{formatMonto(factura.saldoPendiente)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Formulario de Pago */}
      {mostrarPago && (
        <div className="bg-green-50 rounded-lg border border-green-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Registrar Pago</h2>
          <form onSubmit={handlePagar} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Caja *</label>
              <select
                value={pago.cajaId}
                onChange={(e) => setPago(prev => ({ ...prev, cajaId: e.target.value }))}
                required
                className="input-field w-full"
              >
                <option value="">Seleccionar caja...</option>
                {cajas.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre} ({formatMonto(c.saldoActual)})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Medio de Pago</label>
              <select
                value={pago.medioPago}
                onChange={(e) => setPago(prev => ({ ...prev, medioPago: e.target.value }))}
                className="input-field w-full"
              >
                <option value="EFECTIVO">Efectivo</option>
                <option value="TRANSFERENCIA">Transferencia</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nro. Operacion</label>
              <input
                type="text"
                value={pago.nroOperacion}
                onChange={(e) => setPago(prev => ({ ...prev, nroOperacion: e.target.value }))}
                placeholder="Referencia..."
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto *</label>
              <input
                type="number"
                value={pago.monto}
                onChange={(e) => setPago(prev => ({ ...prev, monto: e.target.value }))}
                max={factura.saldoPendiente}
                step="0.01"
                required
                className="input-field w-full"
              />
            </div>
            <div className="md:col-span-4 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setMostrarPago(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando...' : 'Confirmar Pago'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Items */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-800">Items ({factura.items?.length || 0})</h2>
        </div>

        {factura.items?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Producto</th>
                  <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Cantidad</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Precio Unit.</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {factura.items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {item.productoVariante ? (
                        <div>
                          <p className="font-medium text-gray-800">
                            {item.productoVariante.producto?.nombre}
                          </p>
                          <p className="text-sm text-gray-500">
                            {item.productoVariante.talle}
                            {item.productoVariante.color ? ` - ${item.productoVariante.color}` : ''}
                          </p>
                        </div>
                      ) : (
                        <p className="text-gray-800">{item.descripcion || '-'}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-medium">{item.cantidad}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-gray-600">{formatMonto(item.precioUnitario)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-gray-800">{formatMonto(item.subtotal)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-gray-500 py-4">No hay items en esta factura</p>
        )}
      </div>

      {/* Pagos realizados */}
      {factura.movimientosHijos?.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-800">Pagos Realizados</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Numero</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Fecha</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Tipo</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {factura.movimientosHijos.map((pago) => (
                  <tr key={pago.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-medium text-primary">{pago.numero}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatFecha(pago.fecha)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{pago.tipo}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-green-600">{formatMonto(pago.montoTotal)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Observaciones */}
      {factura.observaciones && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Observaciones</h2>
          <p className="text-gray-600">{factura.observaciones}</p>
        </div>
      )}
    </div>
  )
}
