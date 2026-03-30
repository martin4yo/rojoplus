import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Save, TrendingUp, TrendingDown, Plus, X, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '../../../components/Button'
import CentroCostoSelector from '../../../components/CentroCostoSelector'
import api from '../../../services/api'
import LoadingSpinner from '../../../components/LoadingSpinner'

export default function MovimientoCajaForm() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const cajaIdParam = searchParams.get('cajaId')
  const tipoParam = searchParams.get('tipo')

  const [cajas, setCajas] = useState([])
  const [cuentasContables, setCuentasContables] = useState([])
  const [conceptos, setConceptos] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [datosContablesOpen, setDatosContablesOpen] = useState(false)

  const [form, setForm] = useState({
    cajaId: cajaIdParam || '',
    tipo: tipoParam || 'INGRESO',
    fecha: new Date().toISOString().split('T')[0],
    monto: '',
    conceptoId: '',
    cuentaContableId: '',
    centroCostoId: null,
    concepto: '',
    descripcion: '',
    medioPago: ''
  })

  useEffect(() => {
    cargarDatos()
  }, [])

  // Estado para el modal de nuevo concepto
  const [showConceptoModal, setShowConceptoModal] = useState(false)
  const [nuevoConcepto, setNuevoConcepto] = useState({
    codigo: '',
    nombre: '',
    tipo: 'INGRESO',
    cuentaContableId: '',
    centroCostoId: null
  })
  const [savingConcepto, setSavingConcepto] = useState(false)

  async function cargarDatos() {
    try {
      setLoading(true)
      const [cajasRes, cuentasRes, conceptosRes] = await Promise.all([
        api.getFull('/admin/cajas?activo=true'),
        api.getFull('/admin/cuentas-contables?flat=true'),
        api.getFull('/admin/conceptos-tesoreria')
      ])
      const cajasData = cajasRes.data || []
      setCajas(cajasData)
      setCuentasContables((cuentasRes.data || []).filter(c => c.esImputable))
      setConceptos(conceptosRes.data || [])

      // Si hay cajaId en la URL, poblar solo el centro de costo de la caja (la cuenta contable la da el concepto)
      if (cajaIdParam) {
        const caja = cajasData.find(c => c.id === parseInt(cajaIdParam))
        if (caja) {
          setForm(prev => ({
            ...prev,
            centroCostoId: caja.centroCostoId || prev.centroCostoId
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
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))

    // Al cambiar de caja, solo poblar centro de costo (la cuenta contable la da el concepto)
    if (name === 'cajaId' && value) {
      const caja = cajas.find(c => c.id === parseInt(value))
      if (caja) {
        setForm(prev => ({
          ...prev,
          cajaId: value,
          centroCostoId: caja.centroCostoId || prev.centroCostoId
        }))
      }
    }

    // Al seleccionar concepto, sobreescribir cuenta contable y centro de costo desde el concepto
    if (name === 'conceptoId' && value) {
      const concepto = conceptos.find(c => c.id === parseInt(value))
      if (concepto) {
        setForm(prev => ({
          ...prev,
          concepto: concepto.nombre,
          cuentaContableId: concepto.cuentaContableId ? String(concepto.cuentaContableId) : prev.cuentaContableId,
          centroCostoId: concepto.centroCostoId || prev.centroCostoId
        }))
      }
    }
  }

  async function handleCrearConcepto() {
    if (!nuevoConcepto.codigo || !nuevoConcepto.nombre || !nuevoConcepto.cuentaContableId) {
      setError('Código, nombre y cuenta contable son requeridos para el concepto')
      return
    }
    if (!nuevoConcepto.centroCostoId) {
      setError('El centro de costo es requerido para el concepto')
      return
    }

    setSavingConcepto(true)
    try {
      const res = await api.post('/admin/conceptos-tesoreria', {
        codigo: nuevoConcepto.codigo,
        nombre: nuevoConcepto.nombre,
        tipo: nuevoConcepto.tipo,
        cuentaContableId: parseInt(nuevoConcepto.cuentaContableId),
        centroCostoId: parseInt(nuevoConcepto.centroCostoId)
      })

      const conceptoCreado = res
      setConceptos(prev => [...prev, conceptoCreado])

      setForm(prev => ({
        ...prev,
        conceptoId: String(conceptoCreado.id),
        concepto: conceptoCreado.nombre,
        cuentaContableId: String(conceptoCreado.cuentaContableId),
        centroCostoId: conceptoCreado.centroCostoId || prev.centroCostoId
      }))

      setShowConceptoModal(false)
      setNuevoConcepto({ codigo: '', nombre: '', tipo: 'INGRESO', cuentaContableId: '', centroCostoId: null })
      setError(null)
    } catch (err) {
      setError(err.message || 'Error al crear concepto')
    } finally {
      setSavingConcepto(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!form.cajaId || !form.monto || !form.conceptoId || !form.cuentaContableId) {
      setError('Caja, monto, concepto y cuenta contable son requeridos')
      return
    }

    if (!form.medioPago) {
      setError('El medio de pago es obligatorio')
      return
    }

    if (!form.descripcion?.trim()) {
      setError('La observación es obligatoria')
      return
    }

    if (!form.centroCostoId) {
      setError('El centro de costo es requerido. Verificá que la caja o el concepto tengan un centro de costo asignado.')
      return
    }

    const montoNum = parseFloat(form.monto)
    if (montoNum <= 0) {
      setError('El monto debe ser mayor a cero')
      return
    }

    setSaving(true)
    try {
      await api.post('/admin/movimientos-caja', {
        cajaId: parseInt(form.cajaId),
        tipo: form.tipo,
        fecha: form.fecha || undefined,
        monto: montoNum,
        cuentaContableId: parseInt(form.cuentaContableId),
        centroCostoId: form.centroCostoId || null,
        concepto: form.concepto || null,
        descripcion: form.descripcion || null,
        medioPago: form.medioPago || null
      })

      if (cajaIdParam) {
        navigate(`/admin/tesoreria/cajas/${cajaIdParam}`)
      } else {
        navigate('/admin/tesoreria/movimientos')
      }
    } catch (err) {
      setError(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const cajaSeleccionada = cajas.find(c => c.id === parseInt(form.cajaId))
  const cuentaSeleccionada = cuentasContables.find(c => c.id === parseInt(form.cuentaContableId))

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${form.tipo === 'INGRESO' ? 'bg-green-100' : 'bg-red-100'}`}>
            {form.tipo === 'INGRESO' ? (
              <TrendingUp className="w-6 h-6 text-green-600" />
            ) : (
              <TrendingDown className="w-6 h-6 text-red-600" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-800">
            Nuevo {form.tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'}
          </h1>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {/* Tipo de movimiento */}
          <div className="flex gap-4 mb-6">
            <button
              type="button"
              onClick={() => setForm(prev => ({ ...prev, tipo: 'INGRESO' }))}
              className={`flex-1 py-3 rounded-lg border-2 font-medium transition ${
                form.tipo === 'INGRESO'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <TrendingUp className="w-5 h-5 mx-auto mb-1" />
              Ingreso
            </button>
            <button
              type="button"
              onClick={() => setForm(prev => ({ ...prev, tipo: 'EGRESO' }))}
              className={`flex-1 py-3 rounded-lg border-2 font-medium transition ${
                form.tipo === 'EGRESO'
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <TrendingDown className="w-5 h-5 mx-auto mb-1" />
              Egreso
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Caja */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Caja *</label>
              <select
                name="cajaId"
                value={form.cajaId}
                onChange={handleChange}
                className="input-field w-full"
                required
              >
                <option value="">Seleccionar caja...</option>
                {cajas.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} (${c.saldoActual.toLocaleString()})
                  </option>
                ))}
              </select>
            </div>

            {/* Monto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto *</label>
              <input
                type="number"
                name="monto"
                value={form.monto}
                onChange={handleChange}
                className="input-field w-full text-lg"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                required
              />
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <input
                type="date"
                name="fecha"
                value={form.fecha}
                onChange={handleChange}
                className="input-field w-full"
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
              <div className="flex gap-2">
                <select
                  name="conceptoId"
                  value={form.conceptoId}
                  onChange={handleChange}
                  className="input-field flex-1"
                  required
                >
                  <option value="">Seleccionar concepto...</option>
                  {conceptos
                    .filter(c => c.tipo === form.tipo || c.tipo === 'AMBOS')
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.codigo} - {c.nombre}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setNuevoConcepto(prev => ({ ...prev, tipo: form.tipo }))
                    setShowConceptoModal(true)
                  }}
                  className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600"
                  title="Crear nuevo concepto"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Observación */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Observación *</label>
              <textarea
                name="descripcion"
                value={form.descripcion}
                onChange={handleChange}
                className="input-field w-full"
                rows={2}
                placeholder="Detalle obligatorio del movimiento..."
                required
              />
            </div>
          </div>

          {/* Preview */}
          {form.cajaId && form.monto && (
            <div className={`mt-4 p-4 rounded-lg ${form.tipo === 'INGRESO' ? 'bg-green-50' : 'bg-red-50'}`}>
              <p className="text-sm text-gray-600 mb-1">
                {form.tipo === 'INGRESO' ? 'Se sumará' : 'Se restará'} de <strong>{cajaSeleccionada?.nombre}</strong>:
              </p>
              <p className={`text-2xl font-bold ${form.tipo === 'INGRESO' ? 'text-green-600' : 'text-red-600'}`}>
                {form.tipo === 'INGRESO' ? '+' : '-'}${parseFloat(form.monto || 0).toLocaleString()}
              </p>
              {cajaSeleccionada && form.tipo === 'EGRESO' && parseFloat(form.monto) > cajaSeleccionada.saldoActual && (
                <p className="text-sm text-red-600 mt-2">
                  El monto excede el saldo disponible (${cajaSeleccionada.saldoActual.toLocaleString()})
                </p>
              )}
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
              {!datosContablesOpen && (form.cuentaContableId || form.centroCostoId) && (
                <span className="text-xs text-gray-400 ml-2">
                  {[
                    cuentaSeleccionada ? `${cuentaSeleccionada.codigo} ${cuentaSeleccionada.nombre}` : null,
                    form.centroCostoId ? `CC asignado` : null
                  ].filter(Boolean).join(' · ')}
                </span>
              )}
              {!datosContablesOpen && !form.cuentaContableId && !form.centroCostoId && (
                <span className="text-xs text-amber-500 ml-2">Se completan automáticamente desde la caja o el concepto</span>
              )}
            </div>
          </button>

          {datosContablesOpen && (
            <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-100 pt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta Contable *</label>
                <select
                  name="cuentaContableId"
                  value={form.cuentaContableId}
                  onChange={handleChange}
                  className="input-field w-full"
                  required
                >
                  <option value="">Seleccionar cuenta...</option>
                  {cuentasContables.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.codigo} - {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Centro de Costo *
                </label>
                <CentroCostoSelector
                  value={form.centroCostoId}
                  onChange={(id) => setForm(prev => ({ ...prev, centroCostoId: id }))}
                  required
                />
              </div>
            </div>
          )}
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            <Save className="w-4 h-4 mr-2" />
            Registrar {form.tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'}
          </Button>
        </div>
      </form>

      {/* Modal Crear Concepto */}
      {showConceptoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Nuevo Concepto</h3>
              <button
                onClick={() => setShowConceptoModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código *</label>
                <input
                  type="text"
                  value={nuevoConcepto.codigo}
                  onChange={(e) => setNuevoConcepto(prev => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
                  className="input-field w-full"
                  placeholder="Ej: ALQUILER, VENTA_MERCH"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={nuevoConcepto.nombre}
                  onChange={(e) => setNuevoConcepto(prev => ({ ...prev, nombre: e.target.value }))}
                  className="input-field w-full"
                  placeholder="Descripción del concepto"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select
                  value={nuevoConcepto.tipo}
                  onChange={(e) => setNuevoConcepto(prev => ({ ...prev, tipo: e.target.value }))}
                  className="input-field w-full"
                >
                  <option value="INGRESO">Ingreso</option>
                  <option value="EGRESO">Egreso</option>
                  <option value="AMBOS">Ambos</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta Contable *</label>
                <select
                  value={nuevoConcepto.cuentaContableId}
                  onChange={(e) => setNuevoConcepto(prev => ({ ...prev, cuentaContableId: e.target.value }))}
                  className="input-field w-full"
                >
                  <option value="">Seleccionar cuenta...</option>
                  {cuentasContables.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.codigo} - {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Centro de Costo *
                </label>
                <CentroCostoSelector
                  value={nuevoConcepto.centroCostoId}
                  onChange={(id) => setNuevoConcepto(prev => ({ ...prev, centroCostoId: id }))}
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" onClick={() => setShowConceptoModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCrearConcepto} loading={savingConcepto}>
                <Plus className="w-4 h-4 mr-2" />
                Crear Concepto
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
