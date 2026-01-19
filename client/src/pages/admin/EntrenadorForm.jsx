import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Plus, X, Dumbbell } from 'lucide-react'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import api from '../../services/api'

export default function EntrenadorForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = Boolean(id)

  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(isEditing)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Datos del entrenador
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    documento: '',
    telefono: '',
    email: '',
    especialidad: '',
    observaciones: '',
    activo: true,
  })

  // Categorías asignadas
  const [categoriasAsignadas, setCategoriasAsignadas] = useState([])

  // Para agregar categoría
  const [actividades, setActividades] = useState([])
  const [actividadSeleccionada, setActividadSeleccionada] = useState('')
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('')
  const [rolSeleccionado, setRolSeleccionado] = useState('ENTRENADOR')
  const [agregandoCategoria, setAgregandoCategoria] = useState(false)

  useEffect(() => {
    cargarActividades()
    if (isEditing) {
      cargarEntrenador()
    }
  }, [id])

  async function cargarActividades() {
    try {
      const data = await api.get('/admin/actividades?activo=true')
      setActividades(data)
    } catch (err) {
      console.error('Error cargando actividades:', err)
    }
  }

  async function cargarEntrenador() {
    setLoadingData(true)
    try {
      const data = await api.get(`/admin/entrenadores/${id}`)
      setForm({
        nombre: data.nombre || '',
        apellido: data.apellido || '',
        documento: data.documento || '',
        telefono: data.telefono || '',
        email: data.email || '',
        especialidad: data.especialidad || '',
        observaciones: data.observaciones || '',
        activo: data.activo,
      })
      setCategoriasAsignadas(data.categorias?.filter(c => c.activo) || [])
    } catch (err) {
      setError('Error al cargar entrenador')
    } finally {
      setLoadingData(false)
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
    if (!form.nombre.trim()) {
      setError('El nombre es requerido')
      return
    }

    setLoading(true)
    setError(null)

    try {
      if (isEditing) {
        await api.put(`/admin/entrenadores/${id}`, form)
        setSuccess('Entrenador actualizado correctamente')
      } else {
        const data = await api.post('/admin/entrenadores', form)
        setSuccess('Entrenador creado correctamente')
        // Redirigir al edit para poder asignar categorías
        setTimeout(() => navigate(`/admin/entrenadores/${data.id}`), 1000)
      }
    } catch (err) {
      setError(err.message || 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  async function agregarCategoria() {
    if (!categoriaSeleccionada) return

    setAgregandoCategoria(true)
    try {
      const data = await api.post(`/admin/entrenadores/${id}/categorias`, {
        categoriaActividadId: parseInt(categoriaSeleccionada),
        rol: rolSeleccionado,
      })
      setCategoriasAsignadas(prev => [...prev, data])
      setCategoriaSeleccionada('')
      setActividadSeleccionada('')
      setRolSeleccionado('ENTRENADOR')
      setSuccess('Categoría asignada')
      setTimeout(() => setSuccess(null), 2000)
    } catch (err) {
      setError(err.message || 'Error al asignar categoría')
    } finally {
      setAgregandoCategoria(false)
    }
  }

  async function quitarCategoria(categoriaId) {
    if (!confirm('¿Quitar esta categoría del entrenador?')) return

    try {
      await api.delete(`/admin/entrenadores/${id}/categorias/${categoriaId}`)
      setCategoriasAsignadas(prev => prev.filter(c => c.categoriaActividad.id !== categoriaId))
      setSuccess('Categoría desasignada')
      setTimeout(() => setSuccess(null), 2000)
    } catch (err) {
      setError('Error al quitar categoría')
    }
  }

  // Obtener categorías de la actividad seleccionada
  const categoriasDisponibles = actividadSeleccionada
    ? actividades.find(a => a.id === parseInt(actividadSeleccionada))?.categorias?.filter(
        c => !categoriasAsignadas.some(ca => ca.categoriaActividad.id === c.id)
      ) || []
    : []

  const roles = [
    { value: 'ENTRENADOR', label: 'Entrenador' },
    { value: 'ASISTENTE', label: 'Asistente' },
    { value: 'PREPARADOR_FISICO', label: 'Preparador Fisico' },
  ]

  if (loadingData) {
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
          onClick={() => navigate('/admin/entrenadores')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {isEditing ? 'Editar Entrenador' : 'Nuevo Entrenador'}
          </h1>
          <p className="text-gray-500 text-sm">
            {isEditing ? 'Modifica los datos y categorías del entrenador' : 'Completa los datos del nuevo entrenador'}
          </p>
        </div>
      </div>

      {error && <Alert type="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert type="success" className="mb-4" onClose={() => setSuccess(null)}>{success}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario de datos */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Datos del Entrenador</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
                <input
                  type="text"
                  name="apellido"
                  value={form.apellido}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Documento</label>
                <input
                  type="text"
                  name="documento"
                  value={form.documento}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                <input
                  type="text"
                  name="telefono"
                  value={form.telefono}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Especialidad</label>
                <input
                  type="text"
                  name="especialidad"
                  value={form.especialidad}
                  onChange={handleChange}
                  placeholder="Ej: Basquet, Futbol, Preparacion Fisica"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                <textarea
                  name="observaciones"
                  value={form.observaciones}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              {isEditing && (
                <div className="md:col-span-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="activo"
                      checked={form.activo}
                      onChange={handleChange}
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <span className="text-sm text-gray-700">Entrenador activo</span>
                  </label>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <Button type="submit" loading={loading} className="flex items-center gap-2">
                <Save className="w-4 h-4" />
                {isEditing ? 'Guardar Cambios' : 'Crear Entrenador'}
              </Button>
            </div>
          </form>
        </div>

        {/* Panel de categorías (solo en edición) */}
        {isEditing && (
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Dumbbell className="w-5 h-5" />
                Categorías Asignadas
              </h2>

              {/* Lista de categorías asignadas */}
              {categoriasAsignadas.length > 0 ? (
                <div className="space-y-2 mb-4">
                  {categoriasAsignadas.map(cat => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {cat.categoriaActividad.actividad.nombre}
                        </p>
                        <p className="text-xs text-gray-500">
                          {cat.categoriaActividad.nombre}
                          <span className="ml-2 px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
                            {cat.rol}
                          </span>
                        </p>
                      </div>
                      <button
                        onClick={() => quitarCategoria(cat.categoriaActividad.id)}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 mb-4">No hay categorías asignadas</p>
              )}

              {/* Agregar categoría */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Agregar Categoría</h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Actividad</label>
                    <select
                      value={actividadSeleccionada}
                      onChange={(e) => {
                        setActividadSeleccionada(e.target.value)
                        setCategoriaSeleccionada('')
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                    >
                      <option value="">Seleccionar actividad...</option>
                      {actividades.map(act => (
                        <option key={act.id} value={act.id}>{act.nombre}</option>
                      ))}
                    </select>
                  </div>

                  {actividadSeleccionada && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Categoría</label>
                      <select
                        value={categoriaSeleccionada}
                        onChange={(e) => setCategoriaSeleccionada(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                      >
                        <option value="">Seleccionar categoría...</option>
                        {categoriasDisponibles.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {categoriaSeleccionada && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Rol</label>
                      <select
                        value={rolSeleccionado}
                        onChange={(e) => setRolSeleccionado(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                      >
                        {roles.map(rol => (
                          <option key={rol.value} value={rol.value}>{rol.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <Button
                    type="button"
                    onClick={agregarCategoria}
                    disabled={!categoriaSeleccionada || agregandoCategoria}
                    loading={agregandoCategoria}
                    className="w-full flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
