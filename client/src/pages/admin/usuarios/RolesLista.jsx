import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Shield, Edit, Users } from 'lucide-react'
import { Button } from '../../../components/Button'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'
import LoadingSpinner from '../../../components/LoadingSpinner'

export default function RolesLista() {
  const navigate = useNavigate()
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [soloActivos, setSoloActivos] = useState(true)

  useEffect(() => {
    cargarRoles()
  }, [soloActivos])

  async function cargarRoles() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (soloActivos) params.append('activo', 'true')

      const res = await api.get(`/admin/roles?${params}`)
      setRoles(res?.data || res || [])
    } catch (err) {
      console.error('Error cargando roles:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Roles</h1>
            <p className="text-gray-500 text-sm">{roles.length} roles</p>
          </div>
        </div>
        {tienePermiso(PERMISOS.USUARIOS_GESTIONAR) && (
          <Button onClick={() => navigate('/admin/configuracion/roles/nuevo')}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Rol
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
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

      {/* Lista de roles */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <LoadingSpinner />
        ) : roles.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No hay roles registrados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Código</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Nombre</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600 hidden md:table-cell">Descripción</th>
                  <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Usuarios</th>
                  <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Permisos</th>
                  <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Estado</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {roles.map((rol) => (
                  <tr key={rol.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                        {rol.codigo}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">{rol.nombre}</span>
                        {rol.esSuperAdmin && (
                          <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">
                            Super Admin
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-sm text-gray-500">
                      {rol.descripcion || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{rol._count?.admins || 0}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm text-gray-600">{rol._count?.permisos || 0}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        rol.activo
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {rol.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {tienePermiso(PERMISOS.USUARIOS_GESTIONAR) && (
                          <button
                            onClick={() => navigate(`/admin/configuracion/roles/${rol.id}`)}
                            className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-lg"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
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
