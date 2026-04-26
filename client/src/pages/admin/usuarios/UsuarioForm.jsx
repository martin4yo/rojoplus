import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Save, Eye, EyeOff, Building2, Plus, Trash2, Shield } from 'lucide-react'
import { Button } from '../../../components/Button'
import { useModal } from '../../../components/Modal'
import api from '../../../services/api'
import LoadingSpinner from '../../../components/LoadingSpinner'
import toast from 'react-hot-toast'

export default function UsuarioForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const { showModal, ModalComponent } = useModal()

  // Membresías
  const [memberships, setMemberships] = useState([])
  const [tenantsDisponibles, setTenantsDisponibles] = useState([])
  const [loadingMemberships, setLoadingMemberships] = useState(false)
  const [esSuperAdminActual, setEsSuperAdminActual] = useState(false)
  const [tenantIdAgregar, setTenantIdAgregar] = useState('')
  const [rolAgregar, setRolAgregar] = useState('ADMIN')
  const [agregandoTenant, setAgregandoTenant] = useState(false)

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
    cargarTenantsDisponibles()
    // Detectar si el admin logueado es super-admin
    try {
      const adminData = JSON.parse(localStorage.getItem('adminData') || '{}')
      setEsSuperAdminActual(!!adminData.esSuperAdmin || !!adminData.rol?.esSuperAdmin)
    } catch { /* noop */ }

    if (isEdit) {
      cargarUsuario()
      cargarMemberships()
    }
  }, [id])

  async function cargarTenantsDisponibles() {
    try {
      const res = await api.get('/admin/tenants-disponibles')
      setTenantsDisponibles(res?.data || res || [])
    } catch (err) {
      console.error('Error cargando tenants disponibles:', err)
    }
  }

  async function cargarMemberships() {
    setLoadingMemberships(true)
    try {
      const res = await api.get(`/admin/usuarios/${id}/tenants`)
      setMemberships(res?.data || res || [])
    } catch (err) {
      console.error('Error cargando membresías:', err)
    } finally {
      setLoadingMemberships(false)
    }
  }

  async function agregarTenant() {
    if (!tenantIdAgregar) {
      toast.error('Elegí un club')
      return
    }
    setAgregandoTenant(true)
    try {
      await api.post(`/admin/usuarios/${id}/tenants`, {
        tenantId: parseInt(tenantIdAgregar),
        rol: rolAgregar || 'ADMIN',
      })
      toast.success('Acceso agregado')
      setTenantIdAgregar('')
      setRolAgregar('ADMIN')
      cargarMemberships()
    } catch (err) {
      toast.error(err?.message || 'Error al agregar acceso')
    } finally {
      setAgregandoTenant(false)
    }
  }

  function quitarTenant(tu) {
    showModal({
      type: 'warning',
      title: 'Quitar acceso',
      message: `¿Quitarle acceso a "${tu.tenant?.nombre}"?`,
      showCancel: true,
      onConfirm: async () => {
        try {
          await api.delete(`/admin/usuarios/${id}/tenants/${tu.tenantId}`)
          toast.success('Acceso quitado')
          cargarMemberships()
        } catch (err) {
          toast.error('Error al quitar acceso')
        }
      },
    })
  }

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
      <LoadingSpinner />
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

      {/* Membresías de tenant — solo en modo edición */}
      {isEdit && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100">
                <Building2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800">Clubes con acceso</h2>
                <p className="text-xs text-gray-500">
                  {esSuperAdminActual
                    ? 'Como super-admin podés asignar este usuario a cualquier club.'
                    : 'Acceso del usuario a este club.'}
                </p>
              </div>
            </div>
            {esSuperAdminActual && (
              <span className="text-xs px-2 py-1 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded inline-flex items-center gap-1">
                <Shield className="w-3 h-3" /> Super-admin
              </span>
            )}
          </div>

          {/* Lista de membresías actuales */}
          {loadingMemberships ? (
            <div className="text-sm text-gray-400 py-4">Cargando...</div>
          ) : memberships.length === 0 ? (
            <div className="text-sm text-gray-400 italic py-4 border-2 border-dashed border-gray-200 rounded-lg text-center">
              Este usuario aún no tiene acceso a ningún club.
            </div>
          ) : (
            <div className="space-y-2 mb-4">
              {memberships.map(tu => (
                <div
                  key={tu.id}
                  className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg"
                >
                  <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                    {tu.tenant?.logoUrl ? (
                      <img src={tu.tenant.logoUrl} alt="" className="w-8 h-8 object-contain" />
                    ) : (
                      <Building2 className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800 truncate">{tu.tenant?.nombre}</div>
                    <div className="text-xs text-gray-500">
                      {tu.tenant?.subdomain} · Rol: <span className="font-medium">{tu.rol}</span>
                      {!tu.activo && <span className="ml-2 text-rose-600">(inactivo)</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => quitarTenant(tu)}
                    className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="Quitar acceso"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Form para agregar nueva membresía */}
          {(() => {
            // Tenants disponibles que el usuario aún no tiene
            const yaTiene = new Set(memberships.map(m => m.tenantId))
            const opciones = tenantsDisponibles.filter(t => !yaTiene.has(t.id))

            if (opciones.length === 0) {
              return (
                <p className="text-xs text-gray-400 italic">
                  {esSuperAdminActual
                    ? 'El usuario ya tiene acceso a todos los clubes activos.'
                    : 'El usuario ya tiene acceso a este club.'}
                </p>
              )
            }

            return (
              <div className="border-t border-gray-200 pt-4">
                <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Agregar acceso</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={tenantIdAgregar}
                    onChange={(e) => setTenantIdAgregar(e.target.value)}
                    className="input-field flex-1"
                  >
                    <option value="">Elegí un club...</option>
                    {opciones.map(t => (
                      <option key={t.id} value={t.id}>{t.nombre}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={rolAgregar}
                    onChange={(e) => setRolAgregar(e.target.value)}
                    placeholder="Rol (ej: ADMIN)"
                    className="input-field sm:w-40"
                  />
                  <Button
                    type="button"
                    onClick={agregarTenant}
                    disabled={agregandoTenant || !tenantIdAgregar}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    {agregandoTenant ? 'Agregando...' : 'Agregar'}
                  </Button>
                </div>
                <p className="text-[11px] text-gray-400 mt-2">
                  El campo "Rol" es informativo (queda guardado en la membresía). Los permisos efectivos siguen viniendo del rol global del usuario.
                </p>
              </div>
            )
          })()}
        </div>
      )}

      {ModalComponent}
    </div>
  )
}
