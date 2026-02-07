import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, User, Eye, Edit, ArrowLeft } from 'lucide-react'
import { Button } from '../../../components/Button'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'

export default function UsuariosLista() {
  const navigate = useNavigate()
  const [usuarios, setUsuarios] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroRol, setFiltroRol] = useState('')
  const [soloActivos, setSoloActivos] = useState(true)

  useEffect(() => {
    cargarDatos()
  }, [soloActivos, filtroRol])

  async function cargarDatos() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (soloActivos) params.append('activo', 'true')
      if (filtroRol) params.append('rolId', filtroRol)

      const [usrsData, rolesData] = await Promise.all([
        api.get(`/admin/usuarios?${params}`),
        api.get('/admin/roles')
      ])
      setUsuarios(usrsData?.data || usrsData || [])
      setRoles(rolesData?.data || rolesData || [])
    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/configuracion')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="p-2 rounded-lg bg-blue-100">
            <User className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Usuarios</h1>
            <p className="text-gray-500 text-sm">{usuarios.length} usuarios</p>
          </div>
        </div>
        {tienePermiso(PERMISOS.USUARIOS_GESTIONAR) && (
          <Button onClick={() => navigate('/admin/configuracion/usuarios/nuevo')}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Usuario
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <select
              value={filtroRol}
              onChange={(e) => setFiltroRol(e.target.value)}
              className="input-field w-full sm:w-48"
            >
              <option value="">Todos los roles</option>
              {roles.map(rol => (
                <option key={rol.id} value={rol.id}>{rol.nombre}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={soloActivos}
              onChange={(e) => setSoloActivos(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-sm text-gray-600">Solo activos</span>
          </label>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : usuarios.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No hay usuarios registrados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Nombre</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600 hidden md:table-cell">Rol</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600 hidden lg:table-cell">Ultimo acceso</th>
                  <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Estado</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {usuarios.map((usuario) => (
                  <tr key={usuario.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-800">
                            {usuario.nombre} {usuario.apellido || ''}
                          </p>
                          {usuario.rol?.esSuperAdmin && (
                            <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">
                              Super Admin
                            </span>
                          )}
                        </div>
                        {usuario.telefono && (
                          <p className="text-sm text-gray-500">{usuario.telefono}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{usuario.email}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {usuario.rol ? (
                        <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                          {usuario.rol.nombre}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">Sin rol</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-sm text-gray-500">
                      {usuario.lastLogin
                        ? new Date(usuario.lastLogin).toLocaleDateString()
                        : 'Nunca'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        usuario.activo
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {usuario.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {tienePermiso(PERMISOS.USUARIOS_GESTIONAR) && (
                          <Link
                            to={`/admin/configuracion/usuarios/${usuario.id}`}
                            className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-lg"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
