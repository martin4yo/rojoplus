import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Save, ArrowRightLeft, ArrowRight } from 'lucide-react'
import { Button } from '../../../components/Button'
import api from '../../../services/api'

export default function TransferenciaForm() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const origenIdParam = searchParams.get('origenId')

  const [cajas, setCajas] = useState([])
  const [conceptos, setConceptos] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({
    cajaOrigenId: origenIdParam || '',
    cajaDestinoId: '',
    monto: '',
    conceptoId: '',
    descripcion: ''
  })

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    try {
      const [cajasRes, conceptosRes] = await Promise.all([
        api.getFull('/admin/cajas?activo=true'),
        api.getFull('/admin/conceptos?usaEnTesoreria=true&activo=true')
      ])
      setCajas(cajasRes.data || [])
      // Filtrar solo conceptos de tipo AMBOS para transferencias
      const conceptosAmbos = (conceptosRes.data || []).filter(c => c.tipo === 'AMBOS')
      setConceptos(conceptosAmbos)
    } catch (err) {
      console.error('Error cargando datos:', err)
    }
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
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
        conceptoId: form.conceptoId ? parseInt(form.conceptoId) : null,
        descripcion: form.descripcion || null
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

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {/* Selector de cajas visual */}
          <div className="flex flex-col md:flex-row items-center gap-4 mb-6">
            {/* Caja Origen */}
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Caja Origen
              </label>
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
                  Saldo disponible: <span className="font-medium text-gray-700">${cajaOrigen.saldoActual.toLocaleString()}</span>
                </p>
              )}
            </div>

            {/* Flecha */}
            <div className="hidden md:flex items-center justify-center w-16 pt-6">
              <ArrowRight className="w-8 h-8 text-blue-500" />
            </div>

            {/* Caja Destino */}
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Caja Destino
              </label>
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

          {/* Monto, concepto y descripcion */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monto a transferir *
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
                Concepto
              </label>
              <select
                name="conceptoId"
                value={form.conceptoId}
                onChange={handleChange}
                className="input-field w-full"
              >
                <option value="">Seleccionar...</option>
                {conceptos.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripcion
              </label>
              <input
                type="text"
                name="descripcion"
                value={form.descripcion}
                onChange={handleChange}
                className="input-field w-full"
                placeholder="Detalle adicional..."
              />
            </div>
          </div>

          {/* Preview */}
          {cajaOrigen && cajaDestino && form.monto && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-3">Resumen de la transferencia:</p>
              <div className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <p className="font-medium text-gray-800">{cajaOrigen.nombre}</p>
                  <p className="text-sm text-gray-500">
                    ${cajaOrigen.saldoActual.toLocaleString()} → <span className="text-red-600">${(cajaOrigen.saldoActual - parseFloat(form.monto)).toLocaleString()}</span>
                  </p>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-blue-600 font-bold text-lg">${parseFloat(form.monto).toLocaleString()}</span>
                  <ArrowRight className="w-6 h-6 text-blue-500" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-gray-800">{cajaDestino.nombre}</p>
                  <p className="text-sm text-gray-500">
                    ${cajaDestino.saldoActual.toLocaleString()} → <span className="text-green-600">${(cajaDestino.saldoActual + parseFloat(form.monto)).toLocaleString()}</span>
                  </p>
                </div>
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
