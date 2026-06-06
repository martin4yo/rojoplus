import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, RefreshCw, Save, TrendingUp, TrendingDown, Target } from 'lucide-react'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import api from '../../../services/api'
import LoadingSpinner from '../../../components/LoadingSpinner'

const TIPOS = [
  { value: 'INGRESO', label: 'Ingreso', description: 'Agregar stock', icon: TrendingUp, color: 'bg-green-100 text-green-700 border-green-300' },
  { value: 'EGRESO', label: 'Egreso', description: 'Restar stock', icon: TrendingDown, color: 'bg-red-100 text-red-700 border-red-300' },
  { value: 'AJUSTE', label: 'Ajuste', description: 'Establecer cantidad exacta', icon: Target, color: 'bg-blue-100 text-blue-700 border-blue-300' }
]

export default function AjusteStockForm() {
  const navigate = useNavigate()
  const [productos, setProductos] = useState([])
  const [variantes, setVariantes] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const [form, setForm] = useState({
    productoId: '',
    varianteId: '',
    tipo: 'INGRESO',
    cantidad: '',
    concepto: ''
  })

  const [varianteSeleccionada, setVarianteSeleccionada] = useState(null)

  useEffect(() => {
    cargarProductos()
  }, [])

  useEffect(() => {
    if (form.productoId) {
      cargarVariantes(form.productoId)
    } else {
      setVariantes([])
      setForm(f => ({ ...f, varianteId: '' }))
    }
  }, [form.productoId])

  useEffect(() => {
    if (form.varianteId) {
      const v = variantes.find(x => x.id === parseInt(form.varianteId))
      setVarianteSeleccionada(v)
    } else {
      setVarianteSeleccionada(null)
    }
  }, [form.varianteId, variantes])

  async function cargarProductos() {
    try {
      const res = await api.getFull('/admin/productos?activo=true&limit=1000')
      setProductos((res.data || []).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' })))
    } catch (err) {
      setError('Error cargando productos')
    } finally {
      setLoading(false)
    }
  }

  async function cargarVariantes(productoId) {
    try {
      const res = await api.getFull(`/admin/productos/${productoId}`)
      setVariantes(res.data?.variantes?.filter(v => v.activo) || [])
    } catch (err) {
      console.error('Error cargando variantes:', err)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!form.varianteId || !form.tipo || !form.cantidad) {
      setError('Seleccione variante, tipo y cantidad')
      return
    }

    const cantidad = parseFloat(form.cantidad)
    if (cantidad <= 0) {
      setError('La cantidad debe ser mayor a 0')
      return
    }

    // Validar egreso
    if (form.tipo === 'EGRESO' && varianteSeleccionada && cantidad > varianteSeleccionada.stockActual) {
      setError(`Stock insuficiente. Stock actual: ${varianteSeleccionada.stockActual}`)
      return
    }

    setSaving(true)
    try {
      await api.post('/admin/movimientos-stock/ajuste', {
        varianteId: parseInt(form.varianteId),
        tipo: form.tipo,
        cantidad,
        concepto: form.concepto || undefined
      })
      setSuccess('Ajuste de stock realizado correctamente')
      setTimeout(() => {
        navigate('/admin/stock/movimientos')
      }, 1500)
    } catch (err) {
      setError(err.message || 'Error al realizar ajuste')
    } finally {
      setSaving(false)
    }
  }

  // Calcular preview del nuevo stock
  function calcularNuevoStock() {
    if (!varianteSeleccionada || !form.cantidad) return null
    const cantidad = parseFloat(form.cantidad) || 0
    const stockActual = varianteSeleccionada.stockActual

    switch (form.tipo) {
      case 'INGRESO':
        return stockActual + cantidad
      case 'EGRESO':
        return Math.max(0, stockActual - cantidad)
      case 'AJUSTE':
        return cantidad
      default:
        return null
    }
  }

  const nuevoStock = calcularNuevoStock()

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
          onClick={() => navigate('/admin/stock/movimientos')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <RefreshCw className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Ajuste de Stock</h1>
            <p className="text-gray-500 text-sm">Modificar manualmente el stock de un producto</p>
          </div>
        </div>
      </div>

      {error && <Alert type="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert type="success" className="mb-4">{success}</Alert>}

      <div className="max-w-2xl">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tipo de ajuste */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Ajuste *</label>
              <div className="flex flex-wrap gap-2">
                {TIPOS.map(t => {
                  const Icon = t.icon
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm({ ...form, tipo: t.value })}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-medium transition ${
                        form.tipo === t.value
                          ? t.color + ' border-current'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{t.label}</span>
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {TIPOS.find(t => t.value === form.tipo)?.description}
              </p>
            </div>

            {/* Producto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Producto *</label>
              <select
                value={form.productoId}
                onChange={e => setForm({ ...form, productoId: e.target.value, varianteId: '' })}
                className="input-field w-full"
                required
              >
                <option value="">Seleccionar producto...</option>
                {productos.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>

            {/* Variante */}
            {form.productoId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Variante (Talle/Color) *</label>
                {variantes.length === 0 ? (
                  <p className="text-sm text-gray-500">Este producto no tiene variantes activas</p>
                ) : (
                  <select
                    value={form.varianteId}
                    onChange={e => setForm({ ...form, varianteId: e.target.value })}
                    className="input-field w-full"
                    required
                  >
                    <option value="">Seleccionar variante...</option>
                    {variantes.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.talle}{v.color ? ` / ${v.color}` : ''} - Stock actual: {v.stockActual}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Cantidad y Preview */}
            {varianteSeleccionada && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {form.tipo === 'AJUSTE' ? 'Nuevo Stock *' : 'Cantidad *'}
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={form.cantidad}
                    onChange={e => setForm({ ...form, cantidad: e.target.value })}
                    className="input-field w-full text-lg font-mono"
                    placeholder="0"
                    required
                  />
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500 mb-1">Stock Actual</p>
                  <p className="text-2xl font-bold text-gray-800">{varianteSeleccionada.stockActual}</p>
                  {nuevoStock !== null && form.cantidad && (
                    <>
                      <p className="text-sm text-gray-500 mt-2 mb-1">Nuevo Stock</p>
                      <p className={`text-2xl font-bold ${
                        nuevoStock > varianteSeleccionada.stockActual
                          ? 'text-green-600'
                          : nuevoStock < varianteSeleccionada.stockActual
                          ? 'text-red-600'
                          : 'text-blue-600'
                      }`}>
                        {nuevoStock}
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Concepto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Motivo / Concepto</label>
              <input
                type="text"
                value={form.concepto}
                onChange={e => setForm({ ...form, concepto: e.target.value })}
                className="input-field w-full"
                placeholder="Ej: Ajuste por inventario, Devolucion, etc."
              />
            </div>

            {/* Botones */}
            <div className="flex gap-3 pt-4 border-t">
              <Button type="submit" loading={saving} disabled={!form.varianteId || !form.cantidad}>
                <Save className="w-4 h-4 mr-2" />
                Confirmar Ajuste
              </Button>
              <Button type="button" variant="secondary" onClick={() => navigate('/admin/stock/movimientos')}>
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
