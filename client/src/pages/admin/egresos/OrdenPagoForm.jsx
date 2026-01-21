import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, CreditCard, Building2, FileText, Check, AlertCircle } from 'lucide-react'
import { Button } from '../../../components/Button'
import { useModal } from '../../../components/Modal'
import api from '../../../services/api'

const MEDIOS_PAGO = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'TRANSFERENCIA', label: 'Transferencia Bancaria' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'TARJETA', label: 'Tarjeta' }
]

export default function OrdenPagoForm() {
  const navigate = useNavigate()
  const { showModal, ModalComponent } = useModal()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [proveedores, setProveedores] = useState([])
  const [cajas, setCajas] = useState([])
  const [conceptos, setConceptos] = useState([])

  // Facturas pendientes del proveedor seleccionado
  const [facturasPendientes, setFacturasPendientes] = useState([])
  const [cargandoFacturas, setCargandoFacturas] = useState(false)

  // Facturas seleccionadas para pagar con sus montos
  const [facturasAPagar, setFacturasAPagar] = useState([])

  const [form, setForm] = useState({
    entidadId: '',
    fecha: new Date().toISOString().split('T')[0],
    cajaId: '',
    medioPago: 'EFECTIVO',
    nroOperacion: '',
    conceptoId: '',
    observaciones: ''
  })

  useEffect(() => {
    cargarDatosIniciales()
  }, [])

  useEffect(() => {
    if (form.entidadId) {
      cargarFacturasPendientes(form.entidadId)
    } else {
      setFacturasPendientes([])
      setFacturasAPagar([])
    }
  }, [form.entidadId])

  async function cargarDatosIniciales() {
    setLoading(true)
    try {
      const [provRes, cajasRes, concRes] = await Promise.all([
        api.getFull('/admin/entidades?tipo=PROVEEDOR&activo=true&limit=500'),
        api.getFull('/admin/cajas?activo=true'),
        api.getFull('/admin/conceptos-tesoreria?activo=true').catch(() => ({ data: [] }))
      ])
      setProveedores(provRes.data || [])
      setCajas(cajasRes.data || [])
      setConceptos(concRes.data || [])

      // Seleccionar primera caja activa por defecto
      if (cajasRes.data?.length) {
        setForm(prev => ({ ...prev, cajaId: cajasRes.data[0].id.toString() }))
      }
    } catch (err) {
      console.error('Error cargando datos:', err)
      showModal({ type: 'error', message: 'Error al cargar los datos' })
    } finally {
      setLoading(false)
    }
  }

  async function cargarFacturasPendientes(entidadId) {
    setCargandoFacturas(true)
    try {
      // Cargar facturas de compra con saldo pendiente
      const response = await api.getFull(
        `/admin/movimientos-contables?tipo=FACTURA_COMPRA&entidadId=${entidadId}&estado=PENDIENTE&limit=100`
      )
      setFacturasPendientes(response.data || [])
    } catch (err) {
      console.error('Error cargando facturas:', err)
    } finally {
      setCargandoFacturas(false)
    }
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function toggleFactura(factura) {
    const existe = facturasAPagar.find(f => f.id === factura.id)

    if (existe) {
      // Quitar de la lista
      setFacturasAPagar(prev => prev.filter(f => f.id !== factura.id))
    } else {
      // Agregar con el saldo pendiente como monto por defecto
      setFacturasAPagar(prev => [...prev, {
        id: factura.id,
        numero: factura.numero,
        tipoComprobante: factura.tipoComprobante,
        puntoVenta: factura.puntoVenta,
        numeroComprobante: factura.numeroComprobante,
        montoTotal: factura.montoTotal,
        saldoPendiente: factura.saldoPendiente,
        montoPagar: factura.saldoPendiente // Por defecto paga todo el saldo
      }])
    }
  }

  function handleMontoPagarChange(facturaId, monto) {
    setFacturasAPagar(prev => prev.map(f =>
      f.id === facturaId ? { ...f, montoPagar: parseFloat(monto) || 0 } : f
    ))
  }

  function seleccionarTodas() {
    const todasSeleccionadas = facturasPendientes.length === facturasAPagar.length

    if (todasSeleccionadas) {
      setFacturasAPagar([])
    } else {
      setFacturasAPagar(facturasPendientes.map(f => ({
        id: f.id,
        numero: f.numero,
        tipoComprobante: f.tipoComprobante,
        puntoVenta: f.puntoVenta,
        numeroComprobante: f.numeroComprobante,
        montoTotal: f.montoTotal,
        saldoPendiente: f.saldoPendiente,
        montoPagar: f.saldoPendiente
      })))
    }
  }

  function calcularTotalAPagar() {
    return facturasAPagar.reduce((sum, f) => sum + (f.montoPagar || 0), 0)
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!form.entidadId) {
      showModal({ type: 'warning', message: 'Debe seleccionar un proveedor' })
      return
    }

    if (!form.cajaId) {
      showModal({ type: 'warning', message: 'Debe seleccionar una caja' })
      return
    }

    if (facturasAPagar.length === 0) {
      showModal({ type: 'warning', message: 'Debe seleccionar al menos una factura a pagar' })
      return
    }

    // Validar montos
    for (const factura of facturasAPagar) {
      if (factura.montoPagar <= 0) {
        showModal({ type: 'warning', message: `El monto a pagar de ${factura.numero} debe ser mayor a 0` })
        return
      }
      if (factura.montoPagar > factura.saldoPendiente) {
        showModal({
          type: 'warning',
          message: `El monto a pagar de ${factura.numero} no puede superar el saldo pendiente (${formatMonto(factura.saldoPendiente)})`
        })
        return
      }
    }

    // Verificar saldo de caja
    const cajaSeleccionada = cajas.find(c => c.id === parseInt(form.cajaId))
    const totalAPagar = calcularTotalAPagar()

    if (cajaSeleccionada && totalAPagar > cajaSeleccionada.saldoActual) {
      showModal({
        type: 'warning',
        message: `Saldo insuficiente en caja. Disponible: ${formatMonto(cajaSeleccionada.saldoActual)}`
      })
      return
    }

    setSaving(true)
    try {
      // Crear orden de pago por cada factura (o una sola con múltiples?)
      // Por simplicidad, creamos una orden de pago que cancela múltiples facturas
      const data = {
        tipo: 'ORDEN_PAGO',
        entidadId: parseInt(form.entidadId),
        fecha: form.fecha,
        cajaId: parseInt(form.cajaId),
        medioPago: form.medioPago,
        nroOperacion: form.nroOperacion || null,
        conceptoId: form.conceptoId ? parseInt(form.conceptoId) : null,
        observaciones: form.observaciones || `Pago de facturas: ${facturasAPagar.map(f => f.numero).join(', ')}`,
        montoTotal: totalAPagar,
        // Enviar las facturas a cancelar
        facturasCanceladas: facturasAPagar.map(f => ({
          movimientoContableId: f.id,
          montoPagado: f.montoPagar
        }))
      }

      await api.post('/admin/ordenes-pago', data)

      showModal({
        type: 'success',
        message: 'Orden de pago registrada correctamente',
        onConfirm: () => navigate('/admin/egresos/ordenes-pago')
      })
    } catch (err) {
      showModal({ type: 'error', message: err.message || 'Error al registrar el pago' })
    } finally {
      setSaving(false)
    }
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

  function formatComprobante(factura) {
    if (factura.tipoComprobante && factura.puntoVenta && factura.numeroComprobante) {
      return `${factura.tipoComprobante} ${factura.puntoVenta}-${factura.numeroComprobante}`
    }
    return factura.numero
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  const totalAPagar = calcularTotalAPagar()
  const cajaSeleccionada = cajas.find(c => c.id === parseInt(form.cajaId))

  return (
    <div>
      {ModalComponent}

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
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
          <h1 className="text-2xl font-bold text-gray-800">Nueva Orden de Pago</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Datos del pago */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Datos del Pago</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Proveedor *
              </label>
              <select
                name="entidadId"
                value={form.entidadId}
                onChange={handleChange}
                required
                className="input-field w-full"
              >
                <option value="">Seleccionar proveedor...</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.razonSocial} {p.nombreFantasia ? `(${p.nombreFantasia})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha *
              </label>
              <input
                type="date"
                name="fecha"
                value={form.fecha}
                onChange={handleChange}
                required
                className="input-field w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Caja *
              </label>
              <select
                name="cajaId"
                value={form.cajaId}
                onChange={handleChange}
                required
                className="input-field w-full"
              >
                <option value="">Seleccionar caja...</option>
                {cajas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({formatMonto(c.saldoActual)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Medio de Pago *
              </label>
              <select
                name="medioPago"
                value={form.medioPago}
                onChange={handleChange}
                required
                className="input-field w-full"
              >
                {MEDIOS_PAGO.map((mp) => (
                  <option key={mp.value} value={mp.value}>{mp.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nro. Operación
              </label>
              <input
                type="text"
                name="nroOperacion"
                value={form.nroOperacion}
                onChange={handleChange}
                placeholder="Nro. transferencia, cheque..."
                className="input-field w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Concepto
              </label>
              <select
                name="conceptoId"
                value={form.conceptoId}
                onChange={handleChange}
                className="input-field w-full"
              >
                <option value="">Sin concepto</option>
                {conceptos.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observaciones
            </label>
            <input
              type="text"
              name="observaciones"
              value={form.observaciones}
              onChange={handleChange}
              placeholder="Notas adicionales..."
              className="input-field w-full"
            />
          </div>
        </div>

        {/* Facturas pendientes */}
        {form.entidadId && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-800">Facturas Pendientes</h2>
              </div>
              {facturasPendientes.length > 0 && (
                <Button type="button" variant="secondary" size="sm" onClick={seleccionarTodas}>
                  <Check className="w-4 h-4 mr-2" />
                  {facturasPendientes.length === facturasAPagar.length ? 'Deseleccionar Todas' : 'Seleccionar Todas'}
                </Button>
              )}
            </div>

            {cargandoFacturas ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin h-6 w-6 border-3 border-primary border-t-transparent rounded-full" />
              </div>
            ) : facturasPendientes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No hay facturas pendientes de pago para este proveedor</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-center py-2 px-2 font-medium text-gray-600 w-12">
                        <input
                          type="checkbox"
                          checked={facturasPendientes.length === facturasAPagar.length && facturasAPagar.length > 0}
                          onChange={seleccionarTodas}
                          className="rounded border-gray-300"
                        />
                      </th>
                      <th className="text-left py-2 px-2 font-medium text-gray-600">Comprobante</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-600">Fecha</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-600">Vencimiento</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-600">Total</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-600">Pagado</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-600">Saldo</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-600">A Pagar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturasPendientes.map((factura) => {
                      const seleccionada = facturasAPagar.find(f => f.id === factura.id)
                      const vencida = factura.fechaVencimiento && new Date(factura.fechaVencimiento) < new Date()

                      return (
                        <tr
                          key={factura.id}
                          className={`border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${seleccionada ? 'bg-blue-50' : ''}`}
                          onClick={() => toggleFactura(factura)}
                        >
                          <td className="py-2 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={!!seleccionada}
                              onChange={() => toggleFactura(factura)}
                              className="rounded border-gray-300"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <span className="font-mono text-xs font-medium">
                              {formatComprobante(factura)}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-gray-600">
                            {formatFecha(factura.fecha)}
                          </td>
                          <td className="py-2 px-2">
                            {factura.fechaVencimiento ? (
                              <span className={vencida ? 'text-red-600 font-medium' : 'text-gray-600'}>
                                {formatFecha(factura.fechaVencimiento)}
                                {vencida && <AlertCircle className="w-3 h-3 inline ml-1" />}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="py-2 px-2 text-right text-gray-600">
                            {formatMonto(factura.montoTotal)}
                          </td>
                          <td className="py-2 px-2 text-right text-gray-600">
                            {formatMonto(factura.montoPagado)}
                          </td>
                          <td className="py-2 px-2 text-right font-medium text-primary">
                            {formatMonto(factura.saldoPendiente)}
                          </td>
                          <td className="py-2 px-2 text-right" onClick={(e) => e.stopPropagation()}>
                            {seleccionada && (
                              <input
                                type="number"
                                value={seleccionada.montoPagar}
                                onChange={(e) => handleMontoPagarChange(factura.id, e.target.value)}
                                min="0.01"
                                max={factura.saldoPendiente}
                                step="0.01"
                                className="input-field w-28 text-right"
                              />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Resumen de pago */}
            {facturasAPagar.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    {facturasAPagar.length} factura(s) seleccionada(s)
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">Total a pagar:</div>
                    <div className="text-2xl font-bold text-primary">{formatMonto(totalAPagar)}</div>
                    {cajaSeleccionada && totalAPagar > cajaSeleccionada.saldoActual && (
                      <div className="text-sm text-red-600 mt-1">
                        <AlertCircle className="w-4 h-4 inline mr-1" />
                        Saldo insuficiente en caja
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Botones */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/admin/egresos/ordenes-pago')}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={saving || facturasAPagar.length === 0}
          >
            {saving ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                Procesando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Registrar Pago ({formatMonto(totalAPagar)})
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
