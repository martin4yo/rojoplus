import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CreditCard, Search, User, Building2, FileText, Check } from 'lucide-react'
import { Button } from '../../../components/Button'
import { useModal } from '../../../components/Modal'
import api from '../../../services/api'
import LoadingSpinner from '../../../components/LoadingSpinner'

const MEDIOS_PAGO = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
  { value: 'TARJETA', label: 'Tarjeta de Credito/Debito' },
  { value: 'CHEQUE', label: 'Cheque' }
]

export default function ReciboCobroForm() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const facturaIdParam = searchParams.get('facturaId')

  const { showModal, ModalComponent } = useModal()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Datos del formulario
  const [tipoCliente, setTipoCliente] = useState('SOCIO')
  const [socioId, setSocioId] = useState('')
  const [entidadId, setEntidadId] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [cajaId, setCajaId] = useState('')
  const [medioPago, setMedioPago] = useState('EFECTIVO')
  const [nroOperacion, setNroOperacion] = useState('')
  const [conceptoId, setConceptoId] = useState('')
  const [observaciones, setObservaciones] = useState('')

  // Facturas pendientes de cobro
  const [facturasPendientes, setFacturasPendientes] = useState([])
  const [facturasSeleccionadas, setFacturasSeleccionadas] = useState([])

  // Datos para selects
  const [clientes, setClientes] = useState([])
  const [socios, setSocios] = useState([])
  const [cajas, setCajas] = useState([])
  const [conceptos, setConceptos] = useState([])
  const [busquedaSocio, setBusquedaSocio] = useState('')
  const [buscandoSocio, setBuscandoSocio] = useState(false)

  useEffect(() => {
    cargarDatosIniciales()
  }, [])

  useEffect(() => {
    if (facturaIdParam) {
      cargarFacturaDirecta(facturaIdParam)
    }
  }, [facturaIdParam])

  useEffect(() => {
    if (tipoCliente === 'CLIENTE' && entidadId) {
      cargarFacturasPendientesCliente(entidadId)
    } else if (tipoCliente === 'SOCIO' && socioId) {
      cargarFacturasPendientesSocio(socioId)
    } else {
      setFacturasPendientes([])
      setFacturasSeleccionadas([])
    }
  }, [tipoCliente, entidadId, socioId])

  async function cargarDatosIniciales() {
    setLoading(true)
    try {
      const [clientesRes, cajasRes, conceptosRes] = await Promise.all([
        api.getFull('/admin/entidades?tipo=CLIENTE&limit=1000'),
        api.getFull('/admin/cajas?activo=true'),
        api.getFull('/admin/conceptos?tipo=INGRESO')
      ])

      setClientes(clientesRes.data || [])
      setCajas(cajasRes.data || [])
      setConceptos(conceptosRes.data || [])

      // Seleccionar primera caja por defecto
      if (cajasRes.data?.length > 0) {
        setCajaId(cajasRes.data[0].id)
      }
    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }

  async function cargarFacturaDirecta(facturaId) {
    try {
      const response = await api.getFull(`/admin/movimientos-contables/${facturaId}`)
      const factura = response.data

      if (factura.socio) {
        setTipoCliente('SOCIO')
        setSocioId(factura.socio.id)
        setBusquedaSocio(`#${factura.socio.nroSocio} - ${factura.socio.apellidoNombre}`)
      } else if (factura.entidad) {
        setTipoCliente('CLIENTE')
        setEntidadId(factura.entidad.id)
      }

      // Pre-seleccionar la factura
      if (factura.saldoPendiente > 0) {
        setFacturasPendientes([{
          ...factura,
          seleccionada: true,
          montoCobrar: Number(factura.saldoPendiente)
        }])
        setFacturasSeleccionadas([{
          movimientoContableId: factura.id,
          montoCobrado: Number(factura.saldoPendiente)
        }])
      }
    } catch (err) {
      console.error('Error cargando factura:', err)
    }
  }

  async function buscarSocios(query) {
    if (!query || query.length < 2) {
      setSocios([])
      return
    }

    setBuscandoSocio(true)
    try {
      const response = await api.getFull(`/admin/socios?busqueda=${encodeURIComponent(query)}&limit=10`)
      setSocios(response.data || [])
    } catch (err) {
      console.error('Error buscando socios:', err)
    } finally {
      setBuscandoSocio(false)
    }
  }

  async function cargarFacturasPendientesCliente(clienteId) {
    try {
      const response = await api.getFull(`/admin/movimientos-contables/pendientes?entidadId=${clienteId}&tipo=FACTURA_VENTA`)
      const facturas = (response.data || []).map(f => ({
        ...f,
        seleccionada: false,
        montoCobrar: Number(f.saldoPendiente)
      }))
      setFacturasPendientes(facturas)
      setFacturasSeleccionadas([])
    } catch (err) {
      console.error('Error cargando facturas:', err)
    }
  }

  async function cargarFacturasPendientesSocio(socId) {
    try {
      const response = await api.getFull(`/admin/movimientos-contables/pendientes?socioId=${socId}&tipo=FACTURA_VENTA`)
      const facturas = (response.data || []).map(f => ({
        ...f,
        seleccionada: false,
        montoCobrar: Number(f.saldoPendiente)
      }))
      setFacturasPendientes(facturas)
      setFacturasSeleccionadas([])
    } catch (err) {
      console.error('Error cargando facturas:', err)
    }
  }

  function handleSelectSocio(socio) {
    setSocioId(socio.id)
    setBusquedaSocio(`#${socio.nroSocio} - ${socio.apellidoNombre}`)
    setSocios([])
  }

  function toggleFactura(facturaId) {
    setFacturasPendientes(prev => prev.map(f => {
      if (f.id === facturaId) {
        return { ...f, seleccionada: !f.seleccionada }
      }
      return f
    }))

    setFacturasSeleccionadas(prev => {
      const existe = prev.find(f => f.movimientoContableId === facturaId)
      if (existe) {
        return prev.filter(f => f.movimientoContableId !== facturaId)
      } else {
        const factura = facturasPendientes.find(f => f.id === facturaId)
        return [...prev, {
          movimientoContableId: facturaId,
          montoCobrado: factura?.montoCobrar || 0
        }]
      }
    })
  }

  function actualizarMontoCobrar(facturaId, monto) {
    setFacturasPendientes(prev => prev.map(f => {
      if (f.id === facturaId) {
        return { ...f, montoCobrar: parseFloat(monto) || 0 }
      }
      return f
    }))

    setFacturasSeleccionadas(prev => prev.map(f => {
      if (f.movimientoContableId === facturaId) {
        return { ...f, montoCobrado: parseFloat(monto) || 0 }
      }
      return f
    }))
  }

  function calcularTotal() {
    return facturasSeleccionadas.reduce((sum, f) => sum + (f.montoCobrado || 0), 0)
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (facturasSeleccionadas.length === 0) {
      showModal({ type: 'error', message: 'Debe seleccionar al menos una factura' })
      return
    }

    if (!cajaId) {
      showModal({ type: 'error', message: 'Debe seleccionar una caja' })
      return
    }

    // Validar montos
    for (const fs of facturasSeleccionadas) {
      const factura = facturasPendientes.find(f => f.id === fs.movimientoContableId)
      if (fs.montoCobrado > Number(factura?.saldoPendiente)) {
        showModal({ type: 'error', message: `El monto de ${factura?.numero} supera el saldo pendiente` })
        return
      }
      if (fs.montoCobrado <= 0) {
        showModal({ type: 'error', message: 'El monto a cobrar debe ser mayor a 0' })
        return
      }
    }

    setSaving(true)
    try {
      const payload = {
        socioId: tipoCliente === 'SOCIO' ? parseInt(socioId) : null,
        entidadId: tipoCliente === 'CLIENTE' ? parseInt(entidadId) : null,
        fecha,
        cajaId: parseInt(cajaId),
        medioPago,
        nroOperacion: nroOperacion || null,
        conceptoId: conceptoId ? parseInt(conceptoId) : null,
        observaciones: observaciones || null,
        montoTotal: calcularTotal(),
        facturasCobradas: facturasSeleccionadas
      }

      await api.post('/admin/recibos-cobro', payload)
      showModal({
        type: 'success',
        message: 'Recibo de cobro registrado correctamente',
        onConfirm: () => navigate('/admin/ingresos/recibos')
      })
    } catch (err) {
      showModal({ type: 'error', message: err.message || 'Error al registrar el recibo' })
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

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  return (
    <div>
      {ModalComponent}

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
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
            <h1 className="text-2xl font-bold text-gray-800">Nuevo Recibo de Cobro</h1>
            <p className="text-sm text-gray-500">Registrar cobro de facturas de venta</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Datos principales */}
          <div className="lg:col-span-2 space-y-6">
            {/* Cliente o Socio */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Cliente / Socio</h2>

              <div className="space-y-4">
                {/* Tipo de cliente */}
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tipoCliente"
                      value="SOCIO"
                      checked={tipoCliente === 'SOCIO'}
                      onChange={(e) => {
                        setTipoCliente(e.target.value)
                        setEntidadId('')
                        setFacturasPendientes([])
                        setFacturasSeleccionadas([])
                      }}
                      className="text-primary focus:ring-primary"
                    />
                    <User className="w-4 h-4 text-gray-500" />
                    <span>Socio</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tipoCliente"
                      value="CLIENTE"
                      checked={tipoCliente === 'CLIENTE'}
                      onChange={(e) => {
                        setTipoCliente(e.target.value)
                        setSocioId('')
                        setBusquedaSocio('')
                        setFacturasPendientes([])
                        setFacturasSeleccionadas([])
                      }}
                      className="text-primary focus:ring-primary"
                    />
                    <Building2 className="w-4 h-4 text-gray-500" />
                    <span>Cliente</span>
                  </label>
                </div>

                {/* Selector segun tipo */}
                {tipoCliente === 'SOCIO' ? (
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Buscar Socio *
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={busquedaSocio}
                        onChange={(e) => {
                          setBusquedaSocio(e.target.value)
                          buscarSocios(e.target.value)
                        }}
                        placeholder="Buscar por nombre, DNI o nro de socio..."
                        className="input-field w-full pl-10"
                      />
                    </div>
                    {socios.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {socios.map(socio => (
                          <button
                            key={socio.id}
                            type="button"
                            onClick={() => handleSelectSocio(socio)}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <User className="w-4 h-4 text-gray-400" />
                            <span>#{socio.nroSocio} - {socio.apellidoNombre}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {buscandoSocio && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500">
                        Buscando...
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cliente *
                    </label>
                    <select
                      value={entidadId}
                      onChange={(e) => setEntidadId(e.target.value)}
                      className="input-field w-full"
                      required
                    >
                      <option value="">Seleccionar cliente...</option>
                      {clientes.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.codigo} - {c.razonSocial}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Facturas pendientes */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-600" />
                Facturas Pendientes de Cobro
              </h2>

              {facturasPendientes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>
                    {(tipoCliente === 'SOCIO' && socioId) || (tipoCliente === 'CLIENTE' && entidadId)
                      ? 'No hay facturas pendientes de cobro'
                      : 'Seleccione un cliente o socio para ver sus facturas pendientes'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {facturasPendientes.map((factura) => (
                    <div
                      key={factura.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        factura.seleccionada
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => toggleFactura(factura.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            factura.seleccionada
                              ? 'border-green-500 bg-green-500'
                              : 'border-gray-300'
                          }`}>
                            {factura.seleccionada && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">{factura.numero}</p>
                            <p className="text-sm text-gray-500">{formatFecha(factura.fecha)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Saldo pendiente</p>
                          <p className="font-semibold text-orange-600">
                            {formatMonto(factura.saldoPendiente)}
                          </p>
                        </div>
                      </div>

                      {factura.seleccionada && (
                        <div className="mt-3 pt-3 border-t border-green-200">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Monto a cobrar
                          </label>
                          <input
                            type="number"
                            value={factura.montoCobrar}
                            onChange={(e) => actualizarMontoCobrar(factura.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            min="0.01"
                            max={factura.saldoPendiente}
                            step="0.01"
                            className="input-field w-full"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Datos del cobro */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Datos del Cobro</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="input-field w-full"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Caja *
                  </label>
                  <select
                    value={cajaId}
                    onChange={(e) => setCajaId(e.target.value)}
                    className="input-field w-full"
                    required
                  >
                    <option value="">Seleccionar caja...</option>
                    {cajas.map(c => (
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
                    value={medioPago}
                    onChange={(e) => setMedioPago(e.target.value)}
                    className="input-field w-full"
                    required
                  >
                    {MEDIOS_PAGO.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>

                {medioPago !== 'EFECTIVO' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nro. Operacion
                    </label>
                    <input
                      type="text"
                      value={nroOperacion}
                      onChange={(e) => setNroOperacion(e.target.value)}
                      placeholder="Numero de operacion o cheque"
                      className="input-field w-full"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Concepto
                  </label>
                  <select
                    value={conceptoId}
                    onChange={(e) => setConceptoId(e.target.value)}
                    className="input-field w-full"
                  >
                    <option value="">Sin concepto</option>
                    {conceptos.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Observaciones
                  </label>
                  <textarea
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    rows={2}
                    className="input-field w-full"
                  />
                </div>
              </div>
            </div>

            {/* Resumen */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Resumen</h2>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Facturas seleccionadas:</span>
                  <span className="font-medium">{facturasSeleccionadas.length}</span>
                </div>
                <div className="flex justify-between text-xl font-bold border-t pt-3">
                  <span>Total a cobrar:</span>
                  <span className="text-green-600">{formatMonto(calcularTotal())}</span>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={saving || facturasSeleccionadas.length === 0}
                >
                  {saving ? 'Guardando...' : 'Registrar Cobro'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => navigate('/admin/ingresos/recibos')}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
