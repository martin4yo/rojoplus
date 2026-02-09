import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, CreditCard, Building2, FileText, Check, AlertCircle, Plus, Trash2, Wallet } from 'lucide-react'
import { Button } from '../../../components/Button'
import { useModal } from '../../../components/Modal'
import api from '../../../services/api'

export default function OrdenPagoForm() {
  const navigate = useNavigate()
  const { showModal, ModalComponent } = useModal()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [proveedores, setProveedores] = useState([])
  const [cajas, setCajas] = useState([])
  const [conceptos, setConceptos] = useState([])
  const [mediosPago, setMediosPago] = useState([])

  // Facturas pendientes del proveedor seleccionado
  const [facturasPendientes, setFacturasPendientes] = useState([])
  const [cargandoFacturas, setCargandoFacturas] = useState(false)

  // Facturas seleccionadas para pagar con sus montos
  const [facturasAPagar, setFacturasAPagar] = useState([])

  // Múltiples pagos
  const [pagos, setPagos] = useState([{
    cajaId: '',
    medioPago: 'EFECTIVO',
    monto: '',
    nroOperacion: ''
  }])

  const [form, setForm] = useState({
    entidadId: '',
    fecha: new Date().toISOString().split('T')[0],
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
      const [provRes, cajasRes, concRes, mediosRes] = await Promise.all([
        api.getFull('/admin/entidades?tipo=PROVEEDOR&activo=true&limit=500'),
        api.getFull('/admin/cajas?activo=true'),
        api.getFull('/admin/conceptos-tesoreria?activo=true').catch(() => ({ data: [] })),
        api.getFull('/admin/medios-pago?activo=true')
      ])
      setProveedores(provRes.data || [])
      setCajas(cajasRes.data || [])
      setConceptos(concRes.data || [])
      setMediosPago(mediosRes.data || mediosRes || [])

      // Seleccionar primera caja activa por defecto en el primer pago
      if (cajasRes.data?.length) {
        const primeraCaja = cajasRes.data[0]
        const primerMedio = primeraCaja.mediosPagoPermitidos?.[0] || 'EFECTIVO'
        setPagos([{
          cajaId: primeraCaja.id.toString(),
          medioPago: primerMedio,
          monto: '',
          nroOperacion: ''
        }])
      }
    } catch (err) {
      console.error('Error cargando datos:', err)
      showModal({ type: 'error', message: 'Error al cargar los datos' })
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

  // Funciones para manejar múltiples pagos
  function agregarPago() {
    const primeraCaja = cajas[0]
    const primerMedio = primeraCaja?.mediosPagoPermitidos?.[0] || 'EFECTIVO'
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
          // Si el medio actual no está permitido, cambiar al primero
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
    const totalFacturas = calcularTotalAPagar()
    const totalPagosActuales = pagos.slice(0, -1).reduce((sum, p) => sum + (parseFloat(p.monto) || 0), 0)
    const restante = totalFacturas - totalPagosActuales

    if (pagos.length > 0 && restante > 0) {
      setPagos(prev => prev.map((p, i) =>
        i === prev.length - 1 ? { ...p, monto: restante.toFixed(2) } : p
      ))
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

    if (facturasAPagar.length === 0) {
      showModal({ type: 'warning', message: 'Debe seleccionar al menos una factura a pagar' })
      return
    }

    // Validar montos de facturas
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

    // Validar pagos
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

    // Verificar que la suma de pagos coincida con el total a pagar
    const totalAPagar = calcularTotalAPagar()
    const totalPagos = calcularTotalPagos()

    if (Math.abs(totalPagos - totalAPagar) > 0.01) {
      showModal({
        type: 'warning',
        message: `La suma de los pagos (${formatMonto(totalPagos)}) no coincide con el total a pagar (${formatMonto(totalAPagar)})`
      })
      return
    }

    setSaving(true)
    try {
      const data = {
        entidadId: parseInt(form.entidadId),
        fecha: form.fecha,
        observaciones: form.observaciones || `Pago de facturas: ${facturasAPagar.map(f => f.numero).join(', ')}`,
        montoTotal: totalAPagar,
        facturasCanceladas: facturasAPagar.map(f => ({
          movimientoContableId: f.id,
          montoPagado: f.montoPagar
        })),
        pagos: pagos.map(p => ({
          cajaId: parseInt(p.cajaId),
          medioPago: p.medioPago,
          monto: parseFloat(p.monto),
          nroOperacion: p.nroOperacion || null
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
        {/* Datos generales */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Datos Generales</h2>

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

        {/* Medios de Pago - Múltiples */}
        {facturasAPagar.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-800">Medios de Pago</h2>
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

            <div className="space-y-3">
              {pagos.map((pago, index) => {
                const cajaSeleccionada = cajas.find(c => c.id === parseInt(pago.cajaId))
                return (
                  <div key={index} className="flex gap-3 items-end p-3 bg-gray-50 rounded-lg border border-gray-200">
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
                )
              })}
            </div>

            {/* Resumen de pagos */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total en pagos:</span>
                <span className={`text-lg font-bold ${
                  Math.abs(calcularTotalPagos() - calcularTotalAPagar()) < 0.01
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}>
                  {formatMonto(calcularTotalPagos())}
                </span>
              </div>
              {Math.abs(calcularTotalPagos() - calcularTotalAPagar()) >= 0.01 && (
                <div className="text-sm text-red-600 mt-1 text-right">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  Diferencia: {formatMonto(calcularTotalAPagar() - calcularTotalPagos())}
                </div>
              )}
            </div>
          </div>
        )}

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
