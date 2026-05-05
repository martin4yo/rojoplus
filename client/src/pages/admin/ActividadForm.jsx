import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import api from '../../services/api'
import { tienePermiso, PERMISOS } from '../../services/permisos'
import LoadingSpinner from '../../components/LoadingSpinner'
import ImageUpload from '../../components/ImageUpload'

export default function ActividadForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = id && id !== 'nueva'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [conceptos, setConceptos] = useState([])
  const [form, setForm] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    requiereAptaFisica: true,
    cuotaMensual: '',
    color: '',
    orden: 0,
    activo: true,
    imagen: '',
    conceptoTesoreriaId: '',
  })

  useEffect(() => {
    cargarDatos()
  }, [id])

  async function cargarDatos() {
    try {
      const conceptosData = await api.get('/admin/conceptos-tesoreria?activo=true').catch(() => [])
      setConceptos((conceptosData || []).filter(c => c.tipo === 'INGRESO' || c.tipo === 'AMBOS'))

      if (isEdit) {
        const data = await api.get(`/admin/actividades/${id}`)
        setForm({
          codigo: data.codigo || '',
          nombre: data.nombre || '',
          descripcion: data.descripcion || '',
          requiereAptaFisica: data.requiereAptaFisica ?? true,
          cuotaMensual: data.cuotaMensual || '',
          color: data.color || '',
          orden: data.orden || 0,
          activo: data.activo ?? true,
          imagen: data.imagen || '',
          conceptoTesoreriaId: data.conceptoTesoreriaId ? String(data.conceptoTesoreriaId) : '',
        })
      }
    } catch (err) {
      setError('Error al cargar actividad')
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
    setSaving(true)

    try {
      const data = {
        ...form,
        cuotaMensual: form.cuotaMensual ? parseFloat(form.cuotaMensual) : null,
        orden: parseInt(form.orden) || 0,
        conceptoTesoreriaId: form.conceptoTesoreriaId ? parseInt(form.conceptoTesoreriaId) : null,
      }

      if (isEdit) {
        await api.put(`/admin/actividades/${id}`, data)
      } else {
        await api.post('/admin/actividades', data)
      }
      navigate('/admin/actividades')
    } catch (err) {
      setError(err.response?.data?.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/admin/actividades')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {isEdit ? 'Editar Actividad' : 'Nueva Actividad'}
          </h1>
          {isEdit && <p className="text-gray-500 text-sm">{form.nombre}</p>}
        </div>
      </div>

      {error && <Alert type="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Código <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="codigo"
              value={form.codigo}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary uppercase"
              placeholder="BASQUET"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="nombre"
              value={form.nombre}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
              placeholder="Básquet"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
          <textarea
            name="descripcion"
            value={form.descripcion}
            onChange={handleChange}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
            placeholder="Descripción opcional de la actividad"
          />
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cuota Mensual ($)</label>
            <input
              type="number"
              name="cuotaMensual"
              value={form.cuotaMensual}
              onChange={handleChange}
              min="0"
              step="0.01"
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
            <input
              type="text"
              name="color"
              value={form.color}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
              placeholder="orange"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Orden</label>
            <input
              type="number"
              name="orden"
              value={form.orden}
              onChange={handleChange}
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Concepto Tesorería <span className="text-gray-400 text-xs">(opcional)</span>
          </label>
          <select
            name="conceptoTesoreriaId"
            value={form.conceptoTesoreriaId}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
          >
            <option value="">Usar concepto por defecto</option>
            {conceptos.map(c => (
              <option key={c.id} value={c.id}>{c.codigo ? `${c.codigo} - ${c.nombre}` : c.nombre}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Aplica a todas las categorías de esta actividad. Define el centro de costo donde se registran las cobranzas.
          </p>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Foto de tapa <span className="text-gray-500 font-normal">(se muestra en el sitio público)</span>
          </label>
          <ImageUpload
            value={form.imagen}
            onChange={(base64) => setForm(prev => ({ ...prev, imagen: base64 || '' }))}
            returnBase64={true}
            returnFile={false}
            maxSize={2 * 1024 * 1024}
            previewSize="lg"
            placeholder="Subí una foto que represente la actividad"
          />
          <p className="text-xs text-gray-500 mt-2">
            Se usa como tapa en /actividades del sitio público. Si no subís una, se usa una imagen genérica del deporte.
          </p>
        </div>

        <div className="flex items-center gap-6 mt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="requiereAptaFisica"
              checked={form.requiereAptaFisica}
              onChange={handleChange}
              className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
            />
            <span className="text-sm text-gray-700">Requiere apta física</span>
          </label>

          {isEdit && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="activo"
                checked={form.activo}
                onChange={handleChange}
                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
              />
              <span className="text-sm text-gray-700">Activo</span>
            </label>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/admin/actividades')}
          >
            Cancelar
          </Button>
          {tienePermiso(PERMISOS.ACTIVIDADES_GESTIONAR) && (
            <Button type="submit" disabled={saving} className="flex items-center gap-2">
              {saving ? (
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isEdit ? 'Guardar Cambios' : 'Crear Actividad'}
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
