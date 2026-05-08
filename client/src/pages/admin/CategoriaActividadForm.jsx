import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Save, Calendar, ExternalLink } from 'lucide-react'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import api from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function CategoriaActividadForm() {
  const { id: actividadId, catId } = useParams()
  const navigate = useNavigate()
  const isEdit = catId && catId !== 'nueva'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [actividad, setActividad] = useState(null)
  const [form, setForm] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    edadMinima: '',
    edadMaxima: '',
    sexo: '',
    cuotaMensual: '',
    cupoMaximo: '',
    orden: 0,
    activo: true,
  })

  useEffect(() => {
    cargarDatos()
  }, [actividadId, catId])

  async function cargarDatos() {
    try {
      // Cargar actividad padre
      const act = await api.get(`/admin/actividades/${actividadId}`)
      setActividad(act)

      // Si es edición, cargar la categoría
      if (isEdit) {
        const cat = await api.get(`/admin/categorias-actividad/${catId}`)
        setForm({
          codigo: cat.codigo || '',
          nombre: cat.nombre || '',
          descripcion: cat.descripcion || '',
          edadMinima: cat.edadMinima || '',
          edadMaxima: cat.edadMaxima || '',
          sexo: cat.sexo || '',
          cuotaMensual: cat.cuotaMensual || '',
          cupoMaximo: cat.cupoMaximo || '',
          orden: cat.orden || 0,
          activo: cat.activo ?? true,
        })
      }
    } catch (err) {
      setError('Error al cargar datos')
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
        actividadId: parseInt(actividadId),
        edadMinima: form.edadMinima ? parseInt(form.edadMinima) : null,
        edadMaxima: form.edadMaxima ? parseInt(form.edadMaxima) : null,
        cuotaMensual: form.cuotaMensual ? parseFloat(form.cuotaMensual) : null,
        cupoMaximo: form.cupoMaximo ? parseInt(form.cupoMaximo) : null,
        orden: parseInt(form.orden) || 0,
      }

      if (isEdit) {
        await api.put(`/admin/categorias-actividad/${catId}`, data)
      } else {
        await api.post('/admin/categorias-actividad', data)
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
            {isEdit ? 'Editar Categoría' : 'Nueva Categoría'}
          </h1>
          <p className="text-gray-500 text-sm">
            {actividad?.nombre}
          </p>
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
              placeholder="BASQUET-CADETE"
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
              placeholder="Cadete"
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
          />
        </div>

        <div className="grid grid-cols-4 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Edad Mínima</label>
            <input
              type="number"
              name="edadMinima"
              value={form.edadMinima}
              onChange={handleChange}
              min="0"
              max="99"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Edad Máxima</label>
            <input
              type="number"
              name="edadMaxima"
              value={form.edadMaxima}
              onChange={handleChange}
              min="0"
              max="99"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sexo</label>
            <select
              name="sexo"
              value={form.sexo}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
            >
              <option value="">Mixto</option>
              <option value="M">Masculino</option>
              <option value="F">Femenino</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cupo Máximo</label>
            <input
              type="number"
              name="cupoMaximo"
              value={form.cupoMaximo}
              onChange={handleChange}
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
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
            <p className="text-xs text-gray-400 mt-1">Si está vacío usa la cuota de la actividad</p>
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

        {/* Cronograma — se gestiona en /admin/deportes/horarios */}
        {isEdit && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900">Cronograma de entrenamientos</p>
                <p className="text-xs text-blue-700 mt-0.5">Los días, horarios y espacios se gestionan en el módulo de Horarios Recurrentes.</p>
              </div>
            </div>
            <Link
              to={`/admin/deportes/horarios?categoriaId=${catId}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap"
            >
              Editar horarios
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {isEdit && (
          <div className="mt-4">
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
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/admin/actividades')}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={saving} className="flex items-center gap-2">
            {saving ? (
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isEdit ? 'Guardar Cambios' : 'Crear Categoría'}
          </Button>
        </div>
      </form>
    </div>
  )
}
