import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Edit2, Trash2, ChevronDown, ChevronRight, Users, Dumbbell } from 'lucide-react'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import api from '../../services/api'
import { tienePermiso, PERMISOS } from '../../services/permisos'

export default function ActividadesLista() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [actividades, setActividades] = useState([])
  const [expandidas, setExpandidas] = useState({})

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setLoading(true)
    try {
      const data = await api.get('/admin/actividades')
      setActividades(data || [])
      // Expandir todas por defecto
      const exp = {}
      data?.forEach(a => { exp[a.id] = true })
      setExpandidas(exp)
    } catch (err) {
      setError('Error al cargar actividades')
    } finally {
      setLoading(false)
    }
  }

  async function eliminarActividad(id) {
    if (!confirm('¿Eliminar esta actividad?')) return
    setError(null)
    try {
      await api.delete(`/admin/actividades/${id}`)
      setSuccess('Actividad eliminada')
      cargarDatos()
    } catch (err) {
      setError(err.response?.data?.message || 'Error al eliminar')
    }
  }

  async function eliminarCategoria(id) {
    if (!confirm('¿Eliminar esta categoría?')) return
    setError(null)
    try {
      await api.delete(`/admin/categorias-actividad/${id}`)
      setSuccess('Categoría eliminada')
      cargarDatos()
    } catch (err) {
      setError(err.response?.data?.message || 'Error al eliminar')
    }
  }

  function toggleExpandir(id) {
    setExpandidas(prev => ({ ...prev, [id]: !prev[id] }))
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/configuracion')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100">
              <Dumbbell className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Actividades</h1>
              <p className="text-gray-500 text-sm">
                {actividades.length} actividades, {actividades.reduce((acc, a) => acc + (a.categorias?.length || 0), 0)} categorías
              </p>
            </div>
          </div>
        </div>
        {tienePermiso(PERMISOS.ACTIVIDADES_GESTIONAR) && (
          <Button
            onClick={() => navigate('/admin/actividades/nueva')}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nueva Actividad
          </Button>
        )}
      </div>

      {error && <Alert type="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert type="success" className="mb-4" onClose={() => setSuccess(null)}>{success}</Alert>}

      {/* Lista de actividades */}
      <div className="space-y-4">
        {actividades.map(actividad => (
          <div key={actividad.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Cabecera de actividad */}
            <div
              className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
              onClick={() => toggleExpandir(actividad.id)}
            >
              <div className="flex items-center gap-3">
                <button className="p-1">
                  {expandidas[actividad.id] ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{actividad.nombre}</span>
                    <span className="text-xs text-gray-400 font-mono">{actividad.codigo}</span>
                    {!actividad.activo && (
                      <span className="px-2 py-0.5 text-xs bg-red-100 text-red-600 rounded">Inactivo</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500 mt-0.5">
                    <span>{actividad.categorias?.length || 0} categorías</span>
                    {actividad.cuotaMensual && (
                      <span className="text-green-600 font-medium">${actividad.cuotaMensual.toLocaleString()}/mes</span>
                    )}
                    {actividad.requiereAptaFisica && (
                      <span className="text-orange-600">Requiere apta física</span>
                    )}
                  </div>
                </div>
              </div>
              {tienePermiso(PERMISOS.ACTIVIDADES_GESTIONAR) && (
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/admin/actividades/${actividad.id}/categoria/nueva`)}
                    className="flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Categoría
                  </Button>
                  <button
                    onClick={() => navigate(`/admin/actividades/${actividad.id}`)}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                    title="Editar"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => eliminarActividad(actividad.id)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Categorías */}
            {expandidas[actividad.id] && actividad.categorias?.length > 0 && (
              <div className="border-t divide-y">
                {actividad.categorias.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between px-4 py-2 pl-12 bg-gray-50 hover:bg-gray-100">
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-sm font-medium text-gray-700">{cat.nombre}</span>
                        <span className="text-xs text-gray-400 ml-2 font-mono">{cat.codigo}</span>
                        {!cat.activo && (
                          <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-100 text-red-600 rounded">Inactivo</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-gray-500 flex items-center gap-4">
                        {cat.cuotaMensual ? (
                          <span className="text-green-600 font-medium">${cat.cuotaMensual.toLocaleString()}/mes</span>
                        ) : actividad.cuotaMensual ? (
                          <span className="text-gray-400">(hereda ${actividad.cuotaMensual.toLocaleString()})</span>
                        ) : null}
                        {cat.edadMinima || cat.edadMaxima ? (
                          <span>{cat.edadMinima || '?'} - {cat.edadMaxima || '?'} años</span>
                        ) : null}
                        {cat.sexo && <span>{cat.sexo === 'M' ? 'Masc.' : cat.sexo === 'F' ? 'Fem.' : 'Mixto'}</span>}
                      </div>
                      {tienePermiso(PERMISOS.ACTIVIDADES_GESTIONAR) && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => navigate(`/admin/actividades/${actividad.id}/categoria/${cat.id}`)}
                            className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => eliminarCategoria(cat.id)}
                            className="p-1 text-red-600 hover:bg-red-100 rounded"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Sin categorías */}
            {expandidas[actividad.id] && (!actividad.categorias || actividad.categorias.length === 0) && (
              <div className="border-t px-4 py-3 pl-12 bg-gray-50 text-sm text-gray-400 italic">
                Sin categorías. {tienePermiso(PERMISOS.ACTIVIDADES_GESTIONAR) && (
                  <button onClick={() => navigate(`/admin/actividades/${actividad.id}/categoria/nueva`)} className="text-primary hover:underline">Agregar una</button>
                )}
              </div>
            )}
          </div>
        ))}

        {actividades.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <p className="text-gray-500 mb-4">No hay actividades configuradas</p>
            {tienePermiso(PERMISOS.ACTIVIDADES_GESTIONAR) && (
              <Button onClick={() => navigate('/admin/actividades/nueva')}>
                <Plus className="w-4 h-4 mr-2" />
                Crear primera actividad
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
