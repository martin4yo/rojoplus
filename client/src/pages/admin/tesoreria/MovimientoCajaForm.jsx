import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Save, TrendingUp, TrendingDown, Plus } from 'lucide-react'
import { Button } from '../../../components/Button'
import ConceptoModal from '../../../components/ConceptoModal'
import api from '../../../services/api'

export default function MovimientoCajaForm() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const cajaIdParam = searchParams.get('cajaId')
  const tipoParam = searchParams.get('tipo')

  const [cajas, setCajas] = useState([])
  const [mediosPago, setMediosPago] = useState([])
  const [conceptos, setConceptos] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [showConceptoModal, setShowConceptoModal] = useState(false)

  const [form, setForm] = useState({
    cajaId: cajaIdParam || '',
    tipo: tipoParam || 'INGRESO',
    monto: '',
    medioPagoId: '',
    conceptoId: '',
    descripcion: ''
  })

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    try {
      const [cajasRes, mediosRes, conceptosRes] = await Promise.all([
        api.getFull('/admin/cajas?activo=true'),
        api.getFull('/admin/medios-pago'),
        api.getFull('/admin/conceptos?usaEnTesoreria=true&activo=true')
      ])
      setCajas(cajasRes.data || [])
      setMediosPago(mediosRes.data || [])
      setConceptos(conceptosRes.data || [])
    } catch (err) {
      console.error('Error cargando datos:', err)
    }
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function handleConceptoCreated(nuevoConcepto) {
    // Agregar el nuevo concepto a la lista y seleccionarlo
    setConceptos(prev => [...prev, nuevoConcepto])
    setForm(prev => ({ ...prev, conceptoId: String(nuevoConcepto.id) }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!form.cajaId || !form.monto || !form.conceptoId) {
      setError('Caja, monto y concepto son requeridos')
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
        monto: montoNum,
        medioPagoId: form.medioPagoId ? parseInt(form.medioPagoId) : null,
        conceptoId: parseInt(form.conceptoId),
        descripcion: form.descripcion || null
      })

      // Volver a la caja si veniamos de ahi, sino a la lista
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

      <form onSubmit={handleSubmit} className="space-y-6">
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Caja *
              </label>
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monto *
              </label>
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Medio de Pago
              </label>
              <select
                name="medioPagoId"
                value={form.medioPagoId}
                onChange={handleChange}
                className="input-field w-full"
              >
                <option value="">Seleccionar...</option>
                {mediosPago.map(mp => (
                  <option key={mp.id} value={mp.id}>{mp.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Concepto *
              </label>
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
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowConceptoModal(true)}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition flex items-center gap-1"
                  title="Crear nuevo concepto"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripcion
              </label>
              <textarea
                name="descripcion"
                value={form.descripcion}
                onChange={handleChange}
                className="input-field w-full"
                rows={2}
                placeholder="Descripcion del movimiento..."
              />
            </div>
          </div>

          {/* Preview */}
          {form.cajaId && form.monto && (
            <div className={`mt-6 p-4 rounded-lg ${form.tipo === 'INGRESO' ? 'bg-green-50' : 'bg-red-50'}`}>
              <p className="text-sm text-gray-600 mb-1">
                {form.tipo === 'INGRESO' ? 'Se sumara' : 'Se restara'} de <strong>{cajaSeleccionada?.nombre}</strong>:
              </p>
              <p className={`text-2xl font-bold ${form.tipo === 'INGRESO' ? 'text-green-600' : 'text-red-600'}`}>
                {form.tipo === 'INGRESO' ? '+' : '-'}${parseFloat(form.monto || 0).toLocaleString()}
              </p>
              {cajaSeleccionada && form.tipo === 'EGRESO' && parseFloat(form.monto) > cajaSeleccionada.saldoActual && (
                <p className="text-sm text-red-600 mt-2">
                  ⚠️ El monto excede el saldo disponible (${cajaSeleccionada.saldoActual.toLocaleString()})
                </p>
              )}
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

      {/* Modal para crear concepto */}
      <ConceptoModal
        isOpen={showConceptoModal}
        onClose={() => setShowConceptoModal(false)}
        onCreated={handleConceptoCreated}
        tipoDefault={form.tipo}
      />
    </div>
  )
}
