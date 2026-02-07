import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Save, Eye, EyeOff } from 'lucide-react'
import { Button } from '../../../components/Button'
import api from '../../../services/api'

export default function UsuarioForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    email: '',
    password: '',
    nombre: '',
    apellido: '',
    telefono: '',
    rolId: '',
    activo: true
  })

  useEffect(() => {
    cargarRoles()
    if (isEdit) {
      cargarUsuario()
    }
  }, [id])

  async function cargarRoles() {
    try {
      const res = await api.get('/admin/roles?activo=true')
      setRoles(res?.data || res || [])
    } catch (err) {
      console.error('Error cargando roles:', err)
    }
  }

  async function cargarUsuario() {
    setLoading(true)
    try {
      const res = await api.get(`/admin/usuarios/${id}`)
      const u = res?.data || res
      setForm({
        email: u.email || '',
        password: '',
        nombre: u.nombre || '',
        apellido: u.apellido || '',
        telefono: u.telefono || '',
        rolId: u.rol?.id || '',
        activo: u.activo ?? true
      })
    } catch (err) {
      console.error('Error cargando usuario:', err)
      setError('No se pudo cargar el usuario')
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
    setError('')

    if (!form.email || !form.nombre) {
      setError('Email y nombre son requeridos')
      return
    }

    if (!isEdit && !form.password) {
      setError('La contraseña es requerida para nuevos usuarios')
      return
    }

    setSaving(true)
    try {
      const data = {
        email: form.email,
        nombre: form.nombre,
        apellido: form.apellido || null,
        telefono: form.telefono || null,
        rolId: form.rolId ? parseInt(form.rolId) : null,
        activo: form.activo
      }

      if (form.password) {
        data.password = form.password
      }

      if (isEdit) {
        await api.put(`/admin/usuarios/${id}`, data)
      } else {
        await api.post('/admin/usuarios', data)
      }

      navigate('/admin/configuracion/usuarios')
    } catch (err) {
      console.error('Error guardando usuario:', err)
      setError(err.response?.data?.message || 'Error al guardar el usuario')
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
          onClick={() => navigate('/admin/configuracion/usuarios')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100">
            <User className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {isEdit ? 'Editar Usuario' : 'Nuevo Usuario'}
            </h1>
            <p className="text-gray-500 text-sm">
              {isEdit ? 'Modifica los datos del usuario' : 'Crea un nuevo usuario del sistema'}
            </p>
          </div>
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="nombre"
              value={form.nombre}
              onChange={handleChange}
              className="input-field w-full"
              required
            />
          </div>

          {/* Apellido */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Apellido
            </label>
            <input
              type="text"
              name="apellido"
              value={form.apellido}
              onChange={handleChange}
              className="input-field w-full"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="input-field w-full"
              required
            />
          </div>

          {/* Telefono */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono
            </label>
            <input
              type="text"
              name="telefono"
              value={form.telefono}
              onChange={handleChange}
              className="input-field w-full"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña {!isEdit && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={form.password}
                onChange={handleChange}
                className="input-field w-full pr-10"
                placeholder={isEdit ? 'Dejar vacío para mantener actual' : ''}
                required={!isEdit ? false : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {isEdit && (
              <p className="text-xs text-gray-500 mt-1">
                Solo completa si deseas cambiar la contraseña
              </p>
            )}
          </div>

          {/* Rol */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rol
            </label>
            <select
              name="rolId"
              value={form.rolId}
              onChange={handleChange}
              className="input-field w-full"
            >
              <option value="">Sin rol asignado</option>
              {roles.map(rol => (
                <option key={rol.id} value={rol.id}>{rol.nombre}</option>
              ))}
            </select>
          </div>

          {/* Checkboxes */}
          <div className="md:col-span-2 flex flex-wrap gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="activo"
                checked={form.activo}
                onChange={handleChange}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-gray-700">Usuario activo</span>
            </label>
            <p className="text-xs text-gray-500 italic">
              El acceso de Super Admin se define en el Rol asignado
            </p>
          </div>
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/admin/configuracion/usuarios')}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Guardando...
              </div>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {isEdit ? 'Guardar Cambios' : 'Crear Usuario'}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
