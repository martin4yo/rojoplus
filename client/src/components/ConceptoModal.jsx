import { useState, useEffect } from 'react'
import { X, Save } from 'lucide-react'
import { Button } from './Button'
import api from '../services/api'

export default function ConceptoModal({ isOpen, onClose, onCreated, tipoDefault = 'INGRESO' }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [cuentasContables, setCuentasContables] = useState([])

  const [form, setForm] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    tipo: tipoDefault,
    usaEnCompras: false,
    usaEnVentas: false,
    usaEnTesoreria: true,
    cuentaContableId: '',
    orden: 0
  })

  useEffect(() => {
    if (isOpen) {
      cargarCuentasContables()
      setForm(prev => ({
        ...prev,
        tipo: tipoDefault,
        codigo: '',
        nombre: '',
        descripcion: '',
        usaEnTesoreria: true
      }))
      setError(null)
    }
  }, [isOpen, tipoDefault])

  async function cargarCuentasContables() {
    try {
      // Usar flat=true para obtener lista plana en lugar de árbol jerárquico
      const res = await api.getFull('/admin/cuentas-contables?esImputable=true&activo=true&flat=true')
      setCuentasContables(res.data || [])
    } catch (err) {
      console.error('Error cargando cuentas contables:', err)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!form.codigo || !form.nombre) {
      setError('Codigo y nombre son requeridos')
      return
    }

    setSaving(true)
    try {
      const res = await api.post('/admin/conceptos', {
        codigo: form.codigo.toUpperCase(),
        nombre: form.nombre,
        descripcion: form.descripcion || null,
        tipo: form.tipo,
        usaEnCompras: form.usaEnCompras,
        usaEnVentas: form.usaEnVentas,
        usaEnTesoreria: form.usaEnTesoreria,
        cuentaContableId: form.cuentaContableId ? parseInt(form.cuentaContableId) : null,
        orden: parseInt(form.orden) || 0
      })

      if (onCreated) {
        onCreated(res.data)
      }
      onClose()
    } catch (err) {
      setError(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  // Filtrar cuentas por tipo
  const cuentasFiltradas = cuentasContables.filter(c => {
    if (form.tipo === 'INGRESO') return c.tipo === 'INGRESO' || c.codigo.startsWith('4')
    if (form.tipo === 'EGRESO') return c.tipo === 'EGRESO' || c.codigo.startsWith('5')
    return true
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose} />

      {/* Modal — ancho aumentado, sin scroll vertical */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Nuevo Concepto</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Fila 1: Tipo + Código + Nombre */}
          <div className="grid grid-cols-12 gap-3 mb-3">
            <div className="col-span-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <div className="flex gap-1">
                {['INGRESO', 'EGRESO', 'AMBOS'].map(tipo => (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, tipo, cuentaContableId: '' }))}
                    className={`flex-1 py-2 px-1 rounded-lg border-2 text-xs font-medium transition ${
                      form.tipo === tipo
                        ? tipo === 'INGRESO'
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : tipo === 'EGRESO'
                          ? 'border-red-500 bg-red-50 text-red-700'
                          : 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {tipo}
                  </button>
                ))}
              </div>
            </div>
            <div className="col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Código *</label>
              <input
                type="text"
                value={form.codigo}
                onChange={e => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
                className="input-field w-full"
                placeholder="Ej: VENTA_IND"
                required
              />
            </div>
            <div className="col-span-5">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input
                type="text"
                value={form.nombre}
                onChange={e => setForm({ ...form, nombre: e.target.value })}
                className="input-field w-full"
                placeholder="Ej: Venta de Indumentaria"
                required
              />
            </div>
          </div>

          {/* Fila 2: Descripcion + Cuenta Contable */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <input
                type="text"
                value={form.descripcion}
                onChange={e => setForm({ ...form, descripcion: e.target.value })}
                className="input-field w-full"
                placeholder="Descripción opcional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cuenta Contable <span className="text-gray-400 text-xs">(opcional)</span>
              </label>
              <select
                value={form.cuentaContableId}
                onChange={e => setForm({ ...form, cuentaContableId: e.target.value })}
                className="input-field w-full"
              >
                <option value="">Sin asignar</option>
                {cuentasFiltradas.map(c => (
                  <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Fila 3: Usar en + Orden */}
          <div className="flex items-end gap-6 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Usar en</label>
              <div className="flex gap-4">
                {[
                  { key: 'usaEnTesoreria', label: 'Tesorería' },
                  { key: 'usaEnCompras', label: 'Compras' },
                  { key: 'usaEnVentas', label: 'Ventas' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form[key]}
                      onChange={e => setForm({ ...form, [key]: e.target.checked })}
                      className="rounded border-gray-300 text-primary"
                    />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="w-24 ml-auto">
              <label className="block text-sm font-medium text-gray-700 mb-1">Orden</label>
              <input
                type="number"
                value={form.orden}
                onChange={e => setForm({ ...form, orden: e.target.value })}
                className="input-field w-full"
                min="0"
              />
            </div>
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-3 border-t">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              <Save className="w-4 h-4 mr-2" />
              Guardar
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
