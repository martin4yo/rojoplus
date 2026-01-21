import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Wallet } from 'lucide-react'
import { Button } from '../../../components/Button'
import api from '../../../services/api'

const TIPOS_CAJA = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'BANCO', label: 'Cuenta Bancaria' },
  { value: 'MERCADOPAGO', label: 'Mercado Pago' },
  { value: 'OTRO', label: 'Otro' }
]

export default function CajaForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = !!id

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [cuentasContables, setCuentasContables] = useState([])

  const [form, setForm] = useState({
    codigo: '',
    nombre: '',
    tipo: 'EFECTIVO',
    descripcion: '',
    saldoInicial: '',
    cuentaContableId: '',
    activo: true
  })

  useEffect(() => {
    cargarCuentasContables()
    if (isEditing) {
      cargarCaja()
    }
  }, [id])

  async function cargarCuentasContables() {
    try {
      // Cargar cuentas de tipo ACTIVO que sean hojas (para cajas)
      const response = await api.get('/admin/cuentas-contables', {
        params: { tipo: 'ACTIVO', flat: true }
      })
      // Filtrar solo cuentas que no tienen hijos (cuentas de imputacion)
      const cuentasHoja = (response.data || response).filter(c => !c.children || c.children.length === 0)
      setCuentasContables(cuentasHoja)
    } catch (err) {
      console.error('Error cargando cuentas contables:', err)
    }
  }

  async function cargarCaja() {
    setLoading(true)
    try {
      const caja = await api.get(`/admin/cajas/${id}`)
      setForm({
        codigo: caja.codigo || '',
        nombre: caja.nombre || '',
        tipo: caja.tipo || 'EFECTIVO',
        descripcion: caja.descripcion || '',
        saldoInicial: '',
        cuentaContableId: caja.cuentaContableId ? String(caja.cuentaContableId) : '',
        activo: caja.activo
      })
    } catch (err) {
      setError('Error al cargar la caja')
    } finally {
      setLoading(false)
    }
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
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
      const payload = {
        codigo: form.codigo,
        nombre: form.nombre,
        tipo: form.tipo,
        descripcion: form.descripcion || null,
        cuentaContableId: form.cuentaContableId ? parseInt(form.cuentaContableId) : null,
        activo: form.activo
      }

      if (!isEditing && form.saldoInicial) {
        payload.saldoInicial = parseFloat(form.saldoInicial)
      }

      if (isEditing) {
        await api.put(`/admin/cajas/${id}`, payload)
      } else {
        await api.post('/admin/cajas', payload)
      }

      navigate('/admin/tesoreria/cajas')
    } catch (err) {
      setError(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/admin/tesoreria/cajas')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Wallet className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">
            {isEditing ? 'Editar Caja' : 'Nueva Caja'}
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
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Datos de la Caja</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Codigo *
              </label>
              <input
                type="text"
                name="codigo"
                value={form.codigo}
                onChange={handleChange}
                className="input-field w-full"
                placeholder="Ej: CAJA-001"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre *
              </label>
              <input
                type="text"
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                className="input-field w-full"
                placeholder="Ej: Caja Principal"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo
              </label>
              <select
                name="tipo"
                value={form.tipo}
                onChange={handleChange}
                className="input-field w-full"
              >
                {TIPOS_CAJA.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cuenta Contable
              </label>
              <select
                name="cuentaContableId"
                value={form.cuentaContableId}
                onChange={handleChange}
                className="input-field w-full"
              >
                <option value="">-- Sin cuenta contable --</option>
                {cuentasContables.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.codigo} - {c.nombre}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Vincula esta caja a una cuenta del plan de cuentas para asientos automaticos
              </p>
            </div>
            {!isEditing && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Saldo Inicial
                </label>
                <input
                  type="number"
                  name="saldoInicial"
                  value={form.saldoInicial}
                  onChange={handleChange}
                  className="input-field w-full"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                />
              </div>
            )}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripcion
              </label>
              <textarea
                name="descripcion"
                value={form.descripcion}
                onChange={handleChange}
                className="input-field w-full"
                rows={3}
                placeholder="Descripcion opcional..."
              />
            </div>
          </div>
        </div>

        {/* Estado */}
        {isEditing && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="activo"
                checked={form.activo}
                onChange={handleChange}
                className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-gray-700">Caja activa</span>
            </label>
            <p className="text-sm text-gray-500 mt-2">
              Las cajas inactivas no pueden recibir movimientos ni transferencias
            </p>
          </div>
        )}

        {/* Botones */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/admin/tesoreria/cajas')}
          >
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            <Save className="w-4 h-4 mr-2" />
            {isEditing ? 'Guardar Cambios' : 'Crear Caja'}
          </Button>
        </div>
      </form>
    </div>
  )
}
