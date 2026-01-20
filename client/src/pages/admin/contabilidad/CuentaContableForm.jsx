import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Save, BookOpen } from 'lucide-react'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import api from '../../../services/api'

const TIPOS = [
  { value: 'ACTIVO', label: 'Activo', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'PASIVO', label: 'Pasivo', color: 'bg-red-100 text-red-700 border-red-300' },
  { value: 'PATRIMONIO', label: 'Patrimonio', color: 'bg-purple-100 text-purple-700 border-purple-300' },
  { value: 'INGRESO', label: 'Ingreso', color: 'bg-green-100 text-green-700 border-green-300' },
  { value: 'EGRESO', label: 'Egreso', color: 'bg-orange-100 text-orange-700 border-orange-300' }
]

export default function CuentaContableForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const padreIdParam = searchParams.get('padreId')
  const tipoParam = searchParams.get('tipo')

  const isEditing = id && id !== 'nuevo'

  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [cuentasPadre, setCuentasPadre] = useState([])
  const [cuentaPadre, setCuentaPadre] = useState(null)

  const [form, setForm] = useState({
    codigo: '',
    nombre: '',
    tipo: tipoParam || 'ACTIVO',
    padreId: padreIdParam || '',
    esImputable: true,
    orden: 0,
    activo: true
  })

  useEffect(() => {
    cargarCuentasPadre()
    if (padreIdParam) {
      cargarCuentaPadre(padreIdParam)
    }
    if (isEditing) {
      cargarDatos()
    }
  }, [id, padreIdParam])

  async function cargarCuentasPadre() {
    try {
      // Solo cuentas NO imputables (agrupadoras) pueden ser padres
      const res = await api.getFull('/admin/cuentas-contables?flat=true&activo=true&esImputable=false')
      setCuentasPadre(res.data || [])
    } catch (err) {
      console.error('Error cargando cuentas:', err)
    }
  }

  async function cargarCuentaPadre(padreId) {
    try {
      const res = await api.getFull(`/admin/cuentas-contables/${padreId}`)
      setCuentaPadre(res.data)
      // Sugerir codigo basado en el padre
      const hijos = res.data.hijos || []
      const ultimoHijo = hijos.sort((a, b) => a.codigo.localeCompare(b.codigo)).pop()
      let siguienteCodigo = `${res.data.codigo}.01`
      if (ultimoHijo) {
        const partes = ultimoHijo.codigo.split('.')
        const ultimoNum = parseInt(partes[partes.length - 1]) || 0
        partes[partes.length - 1] = String(ultimoNum + 1).padStart(2, '0')
        siguienteCodigo = partes.join('.')
      }
      setForm(prev => ({
        ...prev,
        codigo: siguienteCodigo,
        tipo: res.data.tipo,
        padreId: padreId
      }))
    } catch (err) {
      console.error('Error cargando cuenta padre:', err)
    }
  }

  async function cargarDatos() {
    setLoading(true)
    try {
      const res = await api.getFull(`/admin/cuentas-contables/${id}`)
      const cuenta = res.data
      setForm({
        codigo: cuenta.codigo || '',
        nombre: cuenta.nombre || '',
        tipo: cuenta.tipo || 'ACTIVO',
        padreId: cuenta.padreId ? String(cuenta.padreId) : '',
        esImputable: cuenta.esImputable !== false,
        orden: cuenta.orden || 0,
        activo: cuenta.activo !== false
      })
      if (cuenta.padre) {
        setCuentaPadre(cuenta.padre)
      }
    } catch (err) {
      setError('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!form.codigo || !form.nombre || !form.tipo) {
      setError('Codigo, nombre y tipo son requeridos')
      return
    }

    setSaving(true)
    try {
      const datos = {
        codigo: form.codigo,
        nombre: form.nombre,
        tipo: form.tipo,
        padreId: form.padreId ? parseInt(form.padreId) : null,
        esImputable: form.esImputable,
        orden: parseInt(form.orden) || 0,
        activo: form.activo
      }

      if (isEditing) {
        await api.put(`/admin/cuentas-contables/${id}`, datos)
      } else {
        await api.post('/admin/cuentas-contables', datos)
      }

      navigate('/admin/contabilidad/plan-cuentas')
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
          onClick={() => navigate('/admin/contabilidad/plan-cuentas')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-100">
            <BookOpen className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {isEditing ? 'Editar Cuenta Contable' : 'Nueva Cuenta Contable'}
            </h1>
            {cuentaPadre && (
              <p className="text-gray-500 text-sm">
                Subcuenta de: {cuentaPadre.codigo} - {cuentaPadre.nombre}
              </p>
            )}
          </div>
        </div>
      </div>

      {error && <Alert type="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Cuenta *</label>
            <div className="flex flex-wrap gap-2">
              {TIPOS.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => !cuentaPadre && setForm({ ...form, tipo: t.value })}
                  disabled={!!cuentaPadre}
                  className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition ${
                    form.tipo === t.value
                      ? t.color + ' border-current'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  } ${cuentaPadre ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {cuentaPadre && (
              <p className="text-xs text-gray-500 mt-1">
                El tipo se hereda de la cuenta padre
              </p>
            )}
          </div>

          {/* Codigo y Nombre */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Codigo *</label>
              <input
                type="text"
                value={form.codigo}
                onChange={e => setForm({ ...form, codigo: e.target.value })}
                className="input-field w-full font-mono"
                placeholder="Ej: 1.1.01"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Formato sugerido: 1.1.01 o 4.01.001
              </p>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input
                type="text"
                value={form.nombre}
                onChange={e => setForm({ ...form, nombre: e.target.value })}
                className="input-field w-full"
                placeholder="Ej: Caja Chica, Ventas de Indumentaria..."
                required
              />
            </div>
          </div>

          {/* Cuenta Padre */}
          {!padreIdParam && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta Padre (opcional)</label>
              <select
                value={form.padreId}
                onChange={e => setForm({ ...form, padreId: e.target.value })}
                className="input-field w-full"
              >
                <option value="">Sin padre (cuenta principal)</option>
                {cuentasPadre
                  .filter(c => c.tipo === form.tipo)
                  .map(c => (
                    <option key={c.id} value={c.id}>
                      {c.codigo} - {c.nombre}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Es Imputable y Orden */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                id="esImputable"
                checked={form.esImputable}
                onChange={e => setForm({ ...form, esImputable: e.target.checked })}
                className="w-5 h-5 rounded border-gray-300 text-primary"
              />
              <div>
                <label htmlFor="esImputable" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Cuenta Imputable
                </label>
                <p className="text-xs text-gray-500">
                  Las cuentas imputables reciben movimientos. Las no imputables son solo para agrupar.
                </p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Orden</label>
              <input
                type="number"
                value={form.orden}
                onChange={e => setForm({ ...form, orden: e.target.value })}
                className="input-field w-24"
                min="0"
              />
              <p className="text-xs text-gray-500 mt-1">
                Para ordenar dentro del mismo nivel
              </p>
            </div>
          </div>

          {/* Activo (solo en edicion) */}
          {isEditing && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="activo"
                checked={form.activo}
                onChange={e => setForm({ ...form, activo: e.target.checked })}
                className="rounded border-gray-300"
              />
              <label htmlFor="activo" className="text-sm text-gray-700">Cuenta activa</label>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-3 pt-4 border-t">
            <Button type="submit" loading={saving}>
              <Save className="w-4 h-4 mr-2" />
              Guardar
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/admin/contabilidad/plan-cuentas')}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
