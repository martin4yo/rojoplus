import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, FileText, CreditCard, XCircle, Building2, Calendar, Package, Clock, CheckCircle, Plus, Trash2, Wallet, AlertCircle } from 'lucide-react'
import { Button } from '../../../components/Button'
import { useModal } from '../../../components/Modal'
import AdjuntosComprobante from '../../../components/AdjuntosComprobante'
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
  const [mediosPago, setMediosPago] = useState([])

  // Estado para múltiples pagos
  const [mostrarPago, setMostrarPago] = useState(false)
  const [pagos, setPagos] = useState([{
    cajaId: '',
    medioPago: 'TRANSFERENCIA',
    monto: '',
    nroOperacion: ''
  }])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    cargarDatos()
  }, [id])

  async function cargarDatos() {
    setLoading(true)
    try {
      const [facturaRes, cajasRes, mediosRes] = await Promise.all([
        api.getFull(`/admin/movimientos-contables/${id}`),
        api.getFull('/admin/cajas?activo=true'),
        api.getFull('/admin/medios-pago?activo=true')
      ])
      setFactura(facturaRes.data)
      setCajas(cajasRes.data || [])
      setMediosPago(mediosRes.data || mediosRes || [])

      // Inicializar primer pago con saldo pendiente y primera caja
      if (facturaRes.data.saldoPendiente > 0 && cajasRes.data?.length) {
        const primeraCaja = cajasRes.data[0]
        const primerMedio = primeraCaja.mediosPagoPermitidos?.[0] || 'TRANSFERENCIA'
        setPagos([{
          cajaId: primeraCaja.id.toString(),
          medioPago: primerMedio,
          monto: facturaRes.data.saldoPendiente.toString(),
          nroOperacion: ''
        }])
      }
    } catch (err) {
      console.error('Error cargando factura:', err)
      showModal({ type: 'error', message: 'Error al cargar la factura' })
      navigate('/admin/egresos/facturas')
    } finally {
      setLoading(false)
    }
  }

  // Obtener medios de pago permitidos para una caja
  function getMediosPermitidos(cajaId) {
    const caja = cajas.find(c => c.id === parseInt(cajaId))
    if (!caja || !caja.mediosPagoPermitidos?.length) {
      return mediosPago // Si no hay restricción, mostrar todos
    }
    return mediosPago.filter(mp => caja.mediosPagoPermitidos.includes(mp.codigo))
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

  // Funciones para manejar múltiples pagos
  function agregarPago() {
    const primeraCaja = cajas[0]
    const primerMedio = primeraCaja?.mediosPagoPermitidos?.[0] || 'TRANSFERENCIA'
    setPagos(prev => [...prev, {
      cajaId: primeraCaja?.id.toString() || '',
      medioPago: primerMedio,
      monto: '',
      nroOperacion: ''
    }])
  }

  function eliminarPago(index) {
    if (pagos.length === 1) return
    setPagos(prev => prev.filter((_, i) => i !== index))
  }

  function handlePagoChange(index, field, value) {
    setPagos(prev => prev.map((pago, i) => {
      if (i !== index) return pago

      const updated = { ...pago, [field]: value }

      // Si cambió la caja, resetear el medio de pago al primero permitido
      if (field === 'cajaId') {
        const caja = cajas.find(c => c.id === parseInt(value))
        if (caja?.mediosPagoPermitidos?.length) {
          if (!caja.mediosPagoPermitidos.includes(pago.medioPago)) {
            updated.medioPago = caja.mediosPagoPermitidos[0]
          }
        }
      }

      return updated
    }))
  }

  function calcularTotalPagos() {
    return pagos.reduce((sum, p) => sum + (parseFloat(p.monto) || 0), 0)
  }

  function autocompletarMontoPago() {
    const saldo = factura?.saldoPendiente || 0
    const totalPagosActuales = pagos.slice(0, -1).reduce((sum, p) => sum + (parseFloat(p.monto) || 0), 0)
    const restante = saldo - totalPagosActuales

    if (pagos.length > 0 && restante > 0) {
      setPagos(prev => prev.map((p, i) =>
        i === prev.length - 1 ? { ...p, monto: restante.toFixed(2) } : p
      ))
    }
  }

  async function handlePagar(e) {
    e.preventDefault()

    // Validar cada pago
    for (const pago of pagos) {
      if (!pago.cajaId) {
        showModal({ type: 'warning', message: 'Cada pago debe tener una caja asignada' })
        return
      }
      if (!pago.monto || parseFloat(pago.monto) <= 0) {
        showModal({ type: 'warning', message: 'Cada pago debe tener un monto mayor a 0' })
        return
      }
      // Verificar saldo de caja
      const caja = cajas.find(c => c.id === parseInt(pago.cajaId))
      if (caja && parseFloat(pago.monto) > caja.saldoActual) {
        showModal({
          type: 'warning',
          message: `Saldo insuficiente en caja ${caja.nombre}. Disponible: ${formatMonto(caja.saldoActual)}`
        })
        return
      }
    }

    const totalPagos = calcularTotalPagos()
    if (totalPagos > factura.saldoPendiente) {
      showModal({ type: 'warning', message: 'El total de pagos no puede ser mayor al saldo pendiente' })
      return
    }

    setSaving(true)
    try {
      await api.post('/admin/ordenes-pago', {
        entidadId: factura.entidadId,
        fecha: new Date().toISOString().split('T')[0],
        observaciones: `Pago de ${factura.numero}`,
        montoTotal: totalPagos,
        facturasCanceladas: [{
          movimientoContableId: factura.id,
          montoPagado: totalPagos
        }],
        pagos: pagos.map(p => ({
          cajaId: parseInt(p.cajaId),
          medioPago: p.medioPago,
          monto: parseFloat(p.monto),
          nroOperacion: p.nroOperacion || null
        }))
      })

      await cargarDatos()
      setMostrarPago(false)
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

      {/* Formulario de Pago - Múltiples Medios */}
      {mostrarPago && (
        <div className="bg-green-50 rounded-lg border border-green-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-800">Registrar Pago</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={autocompletarMontoPago}>
                Autocompletar
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={agregarPago}>
                <Plus className="w-4 h-4 mr-1" />
                Agregar Pago
              </Button>
            </div>
          </div>

          <form onSubmit={handlePagar}>
            <div className="space-y-3">
              {pagos.map((pago, index) => (
                  <div key={index} className="flex gap-3 items-end p-3 bg-white rounded-lg border border-gray-200">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Caja
                      </label>
                      <select
                        value={pago.cajaId}
                        onChange={(e) => handlePagoChange(index, 'cajaId', e.target.value)}
                        className="input-field w-full text-sm"
                      >
                        <option value="">Seleccionar...</option>
                        {cajas.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre} ({formatMonto(c.saldoActual)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-40">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Medio
                      </label>
                      <select
                        value={pago.medioPago}
                        onChange={(e) => handlePagoChange(index, 'medioPago', e.target.value)}
                        className="input-field w-full text-sm"
                      >
                        {getMediosPermitidos(pago.cajaId).map((mp) => (
                          <option key={mp.codigo} value={mp.codigo}>{mp.nombre}</option>
                        ))}
                      </select>
                    </div>

                    <div className="w-36">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Monto
                      </label>
                      <input
                        type="number"
                        value={pago.monto}
                        onChange={(e) => handlePagoChange(index, 'monto', e.target.value)}
                        min="0.01"
                        step="0.01"
                        placeholder="0.00"
                        className="input-field w-full text-sm text-right"
                      />
                    </div>

                    <div className="w-36">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Nro. Oper.
                      </label>
                      <input
                        type="text"
                        value={pago.nroOperacion}
                        onChange={(e) => handlePagoChange(index, 'nroOperacion', e.target.value)}
                        placeholder="Opcional"
                        className="input-field w-full text-sm"
                      />
                    </div>

                    {pagos.length > 1 && (
                      <button
                        type="button"
                        onClick={() => eliminarPago(index)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
              ))}
            </div>

            {/* Resumen de pagos */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Saldo pendiente:</span>
                <span className="font-medium text-gray-800">{formatMonto(factura.saldoPendiente)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total en pagos:</span>
                <span className={`text-lg font-bold ${
                  Math.abs(calcularTotalPagos() - factura.saldoPendiente) < 0.01
                    ? 'text-green-600'
                    : calcularTotalPagos() > factura.saldoPendiente
                      ? 'text-red-600'
                      : 'text-yellow-600'
                }`}>
                  {formatMonto(calcularTotalPagos())}
                </span>
              </div>
              {calcularTotalPagos() !== factura.saldoPendiente && calcularTotalPagos() > 0 && (
                <div className="text-sm text-right mt-1">
                  {calcularTotalPagos() < factura.saldoPendiente ? (
                    <span className="text-yellow-600">
                      Pago parcial: quedará saldo de {formatMonto(factura.saldoPendiente - calcularTotalPagos())}
                    </span>
                  ) : (
                    <span className="text-red-600">
                      <AlertCircle className="w-4 h-4 inline mr-1" />
                      Excede el saldo pendiente
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="secondary" onClick={() => setMostrarPago(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || calcularTotalPagos() <= 0 || calcularTotalPagos() > factura.saldoPendiente}>
                {saving ? 'Guardando...' : `Confirmar Pago (${formatMonto(calcularTotalPagos())})`}
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

      {/* Adjuntos */}
      <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <AdjuntosComprobante tipo="movimientoContable" comprobanteId={factura.id} />
      </div>
    </div>
  )
}
