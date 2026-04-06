import { useState, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from './Button'
import CentroCostoSelector from './CentroCostoSelector'
import api from '../services/api'

/**
 * Modal reutilizable para crear un ConceptoTesoreria inline.
 * Props:
 *   isOpen      {boolean}   - controla visibilidad
 *   onClose     {function}  - callback al cerrar sin crear
 *   onCreated   {function}  - callback con el concepto creado { id, codigo, nombre, tipo, cuentaContableId, centroCostoId }
 *   tipoDefault {string}    - 'INGRESO' | 'EGRESO' | 'AMBOS' (default: 'INGRESO')
 */
export default function ConceptoTesoreriaModal({ isOpen, onClose, onCreated, tipoDefault = 'INGRESO' }) {
  const [form, setForm] = useState({
    codigo: '',
    nombre: '',
    tipo: tipoDefault,
    cuentaContableId: '',
    centroCostoId: null,
  })
  const [cuentasContables, setCuentasContables] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen) {
      setForm({ codigo: '', nombre: '', tipo: tipoDefault, cuentaContableId: '', centroCostoId: null })
      setError(null)
      cargarCuentas()
    }
  }, [isOpen, tipoDefault])

  async function cargarCuentas() {
    try {
      const res = await api.getFull('/admin/cuentas-contables?flat=true')
      setCuentasContables((res.data || []).filter(c => c.esImputable))
    } catch {
      // silencioso — el selector quedará vacío
    }
  }

  async function handleGuardar() {
    if (!form.codigo || !form.nombre || !form.cuentaContableId) {
      setError('Código, nombre y cuenta contable son requeridos')
      return
    }
    if (!form.centroCostoId) {
      setError('El centro de costo es requerido')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const created = await api.post('/admin/conceptos-tesoreria', {
        codigo: form.codigo,
        nombre: form.nombre,
        tipo: form.tipo,
        cuentaContableId: parseInt(form.cuentaContableId),
        centroCostoId: parseInt(form.centroCostoId),
      })
      onCreated(created)
      onClose()
    } catch (err) {
      setError(err.message || 'Error al crear el concepto')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Nuevo Concepto de Tesorería</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código *</label>
            <input
              type="text"
              value={form.codigo}
              onChange={(e) => setForm(prev => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
              className="input-field w-full"
              placeholder="Ej: ALQUILER, VENTA_MERCH"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => setForm(prev => ({ ...prev, nombre: e.target.value }))}
              className="input-field w-full"
              placeholder="Descripción del concepto"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              value={form.tipo}
              onChange={(e) => setForm(prev => ({ ...prev, tipo: e.target.value }))}
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
              value={form.cuentaContableId}
              onChange={(e) => setForm(prev => ({ ...prev, cuentaContableId: e.target.value }))}
              className="input-field w-full"
            >
              <option value="">Seleccionar cuenta...</option>
              {cuentasContables.map(c => (
                <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Centro de Costo *</label>
            <CentroCostoSelector
              value={form.centroCostoId}
              onChange={(id) => setForm(prev => ({ ...prev, centroCostoId: id }))}
              required
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleGuardar} loading={saving}>
            <Plus className="w-4 h-4 mr-2" />
            Crear Concepto
          </Button>
        </div>
      </div>
    </div>
  )
}
