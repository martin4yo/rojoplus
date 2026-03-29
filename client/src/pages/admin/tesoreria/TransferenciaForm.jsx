import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Save, ArrowRightLeft, ArrowRight, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '../../../components/Button'
import CentroCostoSelector from '../../../components/CentroCostoSelector'
import api from '../../../services/api'

export default function TransferenciaForm() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const origenIdParam = searchParams.get('origenId')

  const [cajas, setCajas] = useState([])
  const [cuentasContables, setCuentasContables] = useState([])
  const [conceptos, setConceptos] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [datosContablesOpen, setDatosContablesOpen] = useState(false)

  const [form, setForm] = useState({
    cajaOrigenId: origenIdParam || '',
    cajaDestinoId: '',
    monto: '',
    todoElDisponible: false,
    medioPago: '',
    conceptoId: '',
    concepto: '',
    descripcion: '',
    cuentaContableOrigenId: '',
    cuentaContableDestinoId: '',
    centroCostoId: null,
  })

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    try {
      setLoading(true)
      const [cajasRes, cuentasRes, conceptosRes] = await Promise.all([
        api.getFull('/admin/cajas?activo=true'),
        api.getFull('/admin/cuentas-contables?flat=true'),
        api.getFull('/admin/conceptos-tesoreria?activo=true'),
      ])
      const cajasData = cajasRes.data || []
      setCajas(cajasData)
      setCuentasContables((cuentasRes.data || []).filter(c => c.esImputable))
      setConceptos(conceptosRes.data || [])

      // Si viene origenId en URL, poblar datos contables de la caja origen
      if (origenIdParam) {
        const caja = cajasData.find(c => c.id === parseInt(origenIdParam))
        if (caja) {
          setForm(prev => ({
            ...prev,
            cuentaContableOrigenId: caja.cuentaContableId ? String(caja.cuentaContableId) : '',
            centroCostoId: caja.centroCostoId || null,
            monto: '', // no auto-fill monto aquí, esperar el switch
          }))
        }
      }
    } catch (err) {
      console.error('Error cargando datos:', err)
      setError('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    const newValue = type === 'checkbox' ? checked : value

    setForm(prev => {
      const next = { ...prev, [name]: newValue }

      // Al cambiar caja origen: poblar cuenta contable origen y centro de costos
      if (name === 'cajaOrigenId' && value) {
        const caja = cajas.find(c => c.id === parseInt(value))
        if (caja) {
          next.cuentaContableOrigenId = caja.cuentaContableId ? String(caja.cuentaContableId) : ''
          next.centroCostoId = caja.centroCostoId || prev.centroCostoId
          // Si estaba activado "todo el disponible", actualizar el monto
          if (prev.todoElDisponible) {
            next.monto = String(caja.saldoActual)
          }
        }
      }

      // Al cambiar caja destino: poblar cuenta contable destino
      if (name === 'cajaDestinoId' && value) {
        const caja = cajas.find(c => c.id === parseInt(value))
        if (caja) {
          next.cuentaContableDestinoId = caja.cuentaContableId ? String(caja.cuentaContableId) : ''
        }
      }

      // Switch "todo el disponible"
      if (name === 'todoElDisponible') {
        if (checked && prev.cajaOrigenId) {
          const caja = cajas.find(c => c.id === parseInt(prev.cajaOrigenId))
          next.monto = caja ? String(caja.saldoActual) : prev.monto
        } else if (!checked) {
          next.monto = ''
        }
      }

      // Al seleccionar concepto: poblar texto del concepto
      if (name === 'conceptoId' && value) {
        const concepto = conceptos.find(c => c.id === parseInt(value))
        if (concepto) {
          next.concepto = concepto.nombre
        }
      }

      return next
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!form.cajaOrigenId || !form.cajaDestinoId || !form.monto) {
      setError('Caja origen, caja destino y monto son requeridos')
      return
    }

    if (form.cajaOrigenId === form.cajaDestinoId) {
      setError('La caja origen y destino deben ser diferentes')
      return
    }

    if (!form.medioPago) {
      setError('El medio de pago es obligatorio')
      return
    }

    if (!form.conceptoId) {
      setError('El concepto es obligatorio')
      return
    }

    if (!form.descripcion?.trim()) {
      setError('La descripción es obligatoria')
      return
    }

    if (!form.cuentaContableOrigenId) {
      setError('La cuenta contable de la caja origen es requerida')
      return
    }

    if (!form.cuentaContableDestinoId) {
      setError('La cuenta contable de la caja destino es requerida')
      return
    }

    const montoNum = parseFloat(form.monto)
    if (montoNum <= 0) {
      setError('El monto debe ser mayor a cero')
      return
    }

    const cajaOrigen = cajas.find(c => c.id === parseInt(form.cajaOrigenId))
    if (cajaOrigen && montoNum > cajaOrigen.saldoActual) {
      setError(`Saldo insuficiente en ${cajaOrigen.nombre}. Disponible: $${cajaOrigen.saldoActual.toLocaleString()}`)
      return
    }

    setSaving(true)
    try {
      await api.post('/admin/transferencias', {
        cajaOrigenId: parseInt(form.cajaOrigenId),
        cajaDestinoId: parseInt(form.cajaDestinoId),
        monto: montoNum,
        medioPago: form.medioPago,
        conceptoId: parseInt(form.conceptoId),
        concepto: form.concepto,
        descripcion: form.descripcion,
        cuentaContableOrigenId: parseInt(form.cuentaContableOrigenId),
        cuentaContableDestinoId: parseInt(form.cuentaContableDestinoId),
        centroCostoId: form.centroCostoId || null,
      })

      navigate('/admin/tesoreria/transferencias')
    } catch (err) {
      setError(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const cajaOrigen = cajas.find(c => c.id === parseInt(form.cajaOrigenId))
  const cajaDestino = cajas.find(c => c.id === parseInt(form.cajaDestinoId))
  const cajasDestinoDisponibles = cajas.filter(c => c.id !== parseInt(form.cajaOrigenId))
  const cuentaOrigenSelected = cuentasContables.find(c => c.id === parseInt(form.cuentaContableOrigenId))
  const cuentaDestinoSelected = cuentasContables.find(c => c.id === parseInt(form.cuentaContableDestinoId))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/admin/tesoreria/transferencias')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100">
            <ArrowRightLeft className="w-6 h-6 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Nueva Transferencia</h1>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">

          {/* Selector de cajas */}
          <div className="flex flex-col md:flex-row items-center gap-4 mb-6">
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-gray-700 mb-2">Caja Origen *</label>
              <select
                name="cajaOrigenId"
                value={form.cajaOrigenId}
                onChange={handleChange}
                className="input-field w-full"
                required
              >
                <option value="">Seleccionar...</option>
                {cajas.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} (${c.saldoActual.toLocaleString()})
                  </option>
                ))}
              </select>
              {cajaOrigen && (
                <p className="text-sm text-gray-500 mt-1">
                  Disponible: <span className="font-medium text-gray-700">${cajaOrigen.saldoActual.toLocaleString()}</span>
                </p>
              )}
            </div>

            <div className="hidden md:flex items-center justify-center w-16 pt-6">
              <ArrowRight className="w-8 h-8 text-blue-500" />
            </div>

            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-gray-700 mb-2">Caja Destino *</label>
              <select
                name="cajaDestinoId"
                value={form.cajaDestinoId}
                onChange={handleChange}
                className="input-field w-full"
                required
              >
                <option value="">Seleccionar...</option>
                {cajasDestinoDisponibles.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} (${c.saldoActual.toLocaleString()})
                  </option>
                ))}
              </select>
              {cajaDestino && (
                <p className="text-sm text-gray-500 mt-1">
                  Saldo actual: <span className="font-medium text-gray-700">${cajaDestino.saldoActual.toLocaleString()}</span>
                </p>
              )}
            </div>
          </div>

          {/* Monto + Medio de Pago + Concepto + Descripción */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Monto */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Monto *</label>
                {cajaOrigen && (
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <span className="text-xs text-gray-500">Todo</span>
                    <div className="relative">
                      <input
                        type="checkbox"
                        name="todoElDisponible"
                        checked={form.todoElDisponible}
                        onChange={handleChange}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-gray-200 peer-checked:bg-blue-600 rounded-full transition-colors"></div>
                      <div className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4"></div>
                    </div>
                  </label>
                )}
              </div>
              <input
                type="number"
                name="monto"
                value={form.monto}
                onChange={handleChange}
                className="input-field w-full"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                required
                readOnly={form.todoElDisponible}
              />
            </div>

            {/* Medio de Pago */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Medio de Pago *</label>
              <select
                name="medioPago"
                value={form.medioPago}
                onChange={handleChange}
                className="input-field w-full"
                required
              >
                <option value="">Seleccionar...</option>
                <option value="EFECTIVO">Efectivo</option>
                <option value="MERCADOPAGO">MercadoPago</option>
                <option value="TRANSFERENCIA">Transferencia</option>
                <option value="CHEQUE">Cheque</option>
                <option value="TARJETA">Tarjeta</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>

            {/* Concepto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Concepto *</label>
              <select
                name="conceptoId"
                value={form.conceptoId}
                onChange={handleChange}
                className="input-field w-full"
                required
              >
                <option value="">Seleccionar concepto...</option>
                {conceptos.map(c => (
                  <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>
                ))}
              </select>
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción *</label>
              <input
                type="text"
                name="descripcion"
                value={form.descripcion}
                onChange={handleChange}
                className="input-field w-full"
                placeholder="Detalle de la transferencia..."
                required
              />
            </div>
          </div>

          {/* Preview */}
          {cajaOrigen && cajaDestino && form.monto && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-3">Resumen:</p>
              <div className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <p className="font-medium text-gray-800">{cajaOrigen.nombre}</p>
                  <p className="text-sm text-gray-500">
                    ${cajaOrigen.saldoActual.toLocaleString()} → <span className="text-red-600">${Math.max(0, cajaOrigen.saldoActual - parseFloat(form.monto || 0)).toLocaleString()}</span>
                  </p>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-blue-600 font-bold text-lg">${parseFloat(form.monto || 0).toLocaleString()}</span>
                  <ArrowRight className="w-6 h-6 text-blue-500" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-gray-800">{cajaDestino.nombre}</p>
                  <p className="text-sm text-gray-500">
                    ${cajaDestino.saldoActual.toLocaleString()} → <span className="text-green-600">${(cajaDestino.saldoActual + parseFloat(form.monto || 0)).toLocaleString()}</span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Acordeón: Datos Contables */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setDatosContablesOpen(o => !o)}
            className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition"
          >
            <div className="flex items-center gap-2">
              {datosContablesOpen
                ? <ChevronDown className="w-4 h-4 text-gray-500" />
                : <ChevronRight className="w-4 h-4 text-gray-500" />
              }
              <span className="text-sm font-medium text-gray-700">Datos contables</span>
              {!datosContablesOpen && (cuentaOrigenSelected || cuentaDestinoSelected) && (
                <span className="text-xs text-gray-400 ml-2">
                  {[
                    cuentaOrigenSelected ? `Origen: ${cuentaOrigenSelected.codigo}` : null,
                    cuentaDestinoSelected ? `Destino: ${cuentaDestinoSelected.codigo}` : null,
                  ].filter(Boolean).join(' · ')}
                </span>
              )}
              {!datosContablesOpen && !cuentaOrigenSelected && !cuentaDestinoSelected && (
                <span className="text-xs text-amber-500 ml-2">Se completan automáticamente desde las cajas seleccionadas</span>
              )}
            </div>
          </button>

          {datosContablesOpen && (
            <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-gray-100 pt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta Contable Origen *</label>
                <select
                  name="cuentaContableOrigenId"
                  value={form.cuentaContableOrigenId}
                  onChange={handleChange}
                  className="input-field w-full"
                >
                  <option value="">Seleccionar cuenta...</option>
                  {cuentasContables.map(c => (
                    <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta Contable Destino *</label>
                <select
                  name="cuentaContableDestinoId"
                  value={form.cuentaContableDestinoId}
                  onChange={handleChange}
                  className="input-field w-full"
                >
                  <option value="">Seleccionar cuenta...</option>
                  {cuentasContables.map(c => (
                    <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Centro de Costo</label>
                <CentroCostoSelector
                  value={form.centroCostoId}
                  onChange={(id) => setForm(prev => ({ ...prev, centroCostoId: id }))}
                />
              </div>
            </div>
          )}
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="secondary" onClick={() => navigate('/admin/tesoreria/transferencias')}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            <Save className="w-4 h-4 mr-2" />
            Realizar Transferencia
          </Button>
        </div>
      </form>
    </div>
  )
}
