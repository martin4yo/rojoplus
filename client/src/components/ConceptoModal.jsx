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
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20">
        {/* Overlay */}
        <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose} />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Nuevo Concepto</h3>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-full transition"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Tipo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
              <div className="flex gap-2">
                {['INGRESO', 'EGRESO', 'AMBOS'].map(tipo => (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, tipo, cuentaContableId: '' }))}
                    className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition ${
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

            {/* Codigo y Nombre */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Codigo *</label>
                <input
                  type="text"
                  value={form.codigo}
                  onChange={e => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
                  className="input-field w-full"
                  placeholder="Ej: VENTA_IND"
                  required
                />
              </div>
              <div className="col-span-2">
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

            {/* Descripcion */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
              <input
                type="text"
                value={form.descripcion}
                onChange={e => setForm({ ...form, descripcion: e.target.value })}
                className="input-field w-full"
                placeholder="Descripcion opcional"
              />
            </div>

            {/* Switches: Usa en... */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Usar en</label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.usaEnTesoreria}
                    onChange={e => setForm({ ...form, usaEnTesoreria: e.target.checked })}
                    className="rounded border-gray-300 text-primary"
                  />
                  <span className="text-sm text-gray-700">Tesoreria</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.usaEnCompras}
                    onChange={e => setForm({ ...form, usaEnCompras: e.target.checked })}
                    className="rounded border-gray-300 text-primary"
                  />
                  <span className="text-sm text-gray-700">Compras</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.usaEnVentas}
                    onChange={e => setForm({ ...form, usaEnVentas: e.target.checked })}
                    className="rounded border-gray-300 text-primary"
                  />
                  <span className="text-sm text-gray-700">Ventas</span>
                </label>
              </div>
            </div>

            {/* Cuenta Contable */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cuenta Contable (opcional)
              </label>
              <select
                value={form.cuentaContableId}
                onChange={e => setForm({ ...form, cuentaContableId: e.target.value })}
                className="input-field w-full"
              >
                <option value="">Sin asignar</option>
                {cuentasFiltradas.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.codigo} - {c.nombre}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Vincula a una cuenta del plan de cuentas para reportes contables
              </p>
            </div>

            {/* Orden */}
            <div className="w-24">
              <label className="block text-sm font-medium text-gray-700 mb-1">Orden</label>
              <input
                type="number"
                value={form.orden}
                onChange={e => setForm({ ...form, orden: e.target.value })}
                className="input-field w-full"
                min="0"
              />
            </div>

            {/* Botones */}
            <div className="flex justify-end gap-3 pt-4 border-t">
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
    </div>
  )
}
