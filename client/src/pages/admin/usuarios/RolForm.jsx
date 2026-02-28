import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Shield, Save, Check, Wallet } from 'lucide-react'
import { Button } from '../../../components/Button'
import api from '../../../services/api'

export default function RolForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [permisosDisponibles, setPermisosDisponibles] = useState({})
  const [cajasDisponibles, setCajasDisponibles] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    esSuperAdmin: false,
    activo: true,
    permisos: [],
    cajas: []
  })

  useEffect(() => {
    cargarPermisos()
    cargarCajasDisponibles()
    if (isEdit) {
      cargarRol()
    }
  }, [id])

  async function cargarPermisos() {
    try {
      const res = await api.getFull('/admin/permisos')
      setPermisosDisponibles(res?.agrupados || {})
    } catch (err) {
      console.error('Error cargando permisos:', err)
    }
  }

  async function cargarCajasDisponibles() {
    try {
      const res = await api.get('/admin/cajas-disponibles')
      setCajasDisponibles(res?.data || res || [])
    } catch (err) {
      console.error('Error cargando cajas:', err)
    }
  }

  async function cargarRol() {
    setLoading(true)
    try {
      const [rolRes, cajasRes] = await Promise.all([
        api.get(`/admin/roles/${id}`),
        api.get(`/admin/roles/${id}/cajas`)
      ])
      const r = rolRes?.data || rolRes
      const cajas = cajasRes?.data || cajasRes || []
      setForm({
        codigo: r.codigo || '',
        nombre: r.nombre || '',
        descripcion: r.descripcion || '',
        esSuperAdmin: r.esSuperAdmin ?? false,
        activo: r.activo ?? true,
        permisos: r.permisos?.map(p => p.permisoId) || [],
        cajas: cajas.map(c => c.id)
      })
    } catch (err) {
      console.error('Error cargando rol:', err)
      setError('No se pudo cargar el rol')
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

  function togglePermiso(permisoId) {
    setForm(prev => ({
      ...prev,
      permisos: prev.permisos.includes(permisoId)
        ? prev.permisos.filter(p => p !== permisoId)
        : [...prev.permisos, permisoId]
    }))
  }

  function toggleModulo(modulo) {
    const permisosModulo = permisosDisponibles[modulo]?.map(p => p.id) || []
    const todosSeleccionados = permisosModulo.every(p => form.permisos.includes(p))

    setForm(prev => ({
      ...prev,
      permisos: todosSeleccionados
        ? prev.permisos.filter(p => !permisosModulo.includes(p))
        : [...new Set([...prev.permisos, ...permisosModulo])]
    }))
  }

  function toggleCaja(cajaId) {
    setForm(prev => ({
      ...prev,
      cajas: prev.cajas.includes(cajaId)
        ? prev.cajas.filter(c => c !== cajaId)
        : [...prev.cajas, cajaId]
    }))
  }

  function toggleTodasCajas() {
    const todasIds = cajasDisponibles.map(c => c.id)
    const todasSeleccionadas = todasIds.every(id => form.cajas.includes(id))
    setForm(prev => ({
      ...prev,
      cajas: todasSeleccionadas ? [] : todasIds
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.codigo || !form.nombre) {
      setError('Código y nombre son requeridos')
      return
    }

    setSaving(true)
    try {
      const data = {
        codigo: form.codigo,
        nombre: form.nombre,
        descripcion: form.descripcion || null,
        esSuperAdmin: form.esSuperAdmin,
        activo: form.activo,
        permisos: form.permisos
      }

      let rolId = id
      if (isEdit) {
        await api.put(`/admin/roles/${id}`, data)
      } else {
        const res = await api.post('/admin/roles', data)
        rolId = res?.data?.id || res?.id
      }

      // Guardar cajas asignadas (solo si no es super admin)
      if (!form.esSuperAdmin && rolId) {
        await api.put(`/admin/roles/${rolId}/cajas`, { cajaIds: form.cajas })
      }

      navigate('/admin/configuracion/roles')
    } catch (err) {
      console.error('Error guardando rol:', err)
      setError(err.response?.data?.message || 'Error al guardar el rol')
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
          onClick={() => navigate('/admin/configuracion/roles')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-100">
            <Shield className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {isEdit ? 'Editar Rol' : 'Nuevo Rol'}
            </h1>
            <p className="text-gray-500 text-sm">
              {isEdit ? 'Modifica los datos y permisos del rol' : 'Crea un nuevo rol con sus permisos'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Datos básicos */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Datos del Rol</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Código */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Código <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="codigo"
                value={form.codigo}
                onChange={handleChange}
                className="input-field w-full font-mono uppercase"
                placeholder="ADMIN"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Identificador único del rol</p>
            </div>

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
                placeholder="Administrador"
                required
              />
            </div>

            {/* Descripción */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción
              </label>
              <textarea
                name="descripcion"
                value={form.descripcion}
                onChange={handleChange}
                className="input-field w-full"
                rows={2}
                placeholder="Describe las responsabilidades de este rol..."
              />
            </div>

            {/* Checkboxes */}
            <div className="md:col-span-2 flex flex-wrap gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="esSuperAdmin"
                  checked={form.esSuperAdmin}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm text-gray-700">Es Super Admin</span>
                <span className="text-xs text-gray-500">(acceso total sin restricciones)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="activo"
                  checked={form.activo}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm text-gray-700">Rol activo</span>
              </label>
            </div>
          </div>
        </div>

        {/* Permisos */}
        {!form.esSuperAdmin && Object.keys(permisosDisponibles).length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Permisos</h2>
            <p className="text-sm text-gray-500 mb-4">
              Selecciona los permisos que tendrá este rol. Los Super Admin tienen todos los permisos automáticamente.
            </p>

            <div className="space-y-4">
              {Object.entries(permisosDisponibles).map(([modulo, permisos]) => {
                const permisosIds = permisos.map(p => p.id)
                const todosSeleccionados = permisosIds.every(p => form.permisos.includes(p))
                const algunoSeleccionado = permisosIds.some(p => form.permisos.includes(p))

                return (
                  <div key={modulo} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Cabecera del módulo */}
                    <div
                      onClick={() => toggleModulo(modulo)}
                      className="flex items-center gap-3 p-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        todosSeleccionados
                          ? 'bg-primary border-primary'
                          : algunoSeleccionado
                            ? 'bg-primary/50 border-primary'
                            : 'border-gray-300'
                      }`}>
                        {(todosSeleccionados || algunoSeleccionado) && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <span className="font-medium text-gray-800 capitalize">{modulo}</span>
                      <span className="text-sm text-gray-500">
                        ({permisos.filter(p => form.permisos.includes(p.id)).length}/{permisos.length})
                      </span>
                    </div>

                    {/* Permisos del módulo */}
                    <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {permisos.map(permiso => (
                        <label
                          key={permiso.id}
                          className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={form.permisos.includes(permiso.id)}
                            onChange={() => togglePermiso(permiso.id)}
                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <div>
                            <span className="text-sm text-gray-700">{permiso.nombre}</span>
                            {permiso.descripcion && (
                              <p className="text-xs text-gray-500">{permiso.descripcion}</p>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Cajas Permitidas */}
        {!form.esSuperAdmin && cajasDisponibles.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Wallet className="w-5 h-5 text-gray-600" />
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Cajas Permitidas</h2>
                <p className="text-sm text-gray-500">
                  Selecciona las cajas a las que este rol tendrá acceso. Si no seleccionas ninguna, tendrá acceso a todas.
                </p>
              </div>
            </div>

            <div className="mb-3">
              <button
                type="button"
                onClick={toggleTodasCajas}
                className="text-sm text-primary hover:underline"
              >
                {cajasDisponibles.every(c => form.cajas.includes(c.id)) ? 'Deseleccionar todas' : 'Seleccionar todas'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {cajasDisponibles.map(caja => (
                <label
                  key={caja.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    form.cajas.includes(caja.id)
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.cajas.includes(caja.id)}
                    onChange={() => toggleCaja(caja.id)}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-gray-700 truncate">{caja.nombre}</span>
                    <span className="block text-xs text-gray-500">
                      {caja.tipo}
                      {caja.puntoVentaAfip && ` • PV ${caja.puntoVentaAfip}`}
                    </span>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {caja.paraBuffet && <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">Buffet</span>}
                      {caja.paraKiosco && <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">Kiosco</span>}
                      {caja.paraTakeaway && <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded">TakeAway</span>}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {form.cajas.length === 0 && (
              <p className="mt-3 text-sm text-amber-600 bg-amber-50 p-2 rounded">
                Sin cajas seleccionadas: el rol tendrá acceso a todas las cajas por defecto.
              </p>
            )}
          </div>
        )}

        {form.esSuperAdmin && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-800">
              <strong>Super Admin:</strong> Este rol tendrá acceso completo a todas las funcionalidades del sistema sin restricciones.
            </p>
          </div>
        )}

        {/* Botones */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/admin/configuracion/roles')}
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
                {isEdit ? 'Guardar Cambios' : 'Crear Rol'}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
