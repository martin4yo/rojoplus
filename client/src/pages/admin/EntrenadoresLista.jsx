import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Search, X, User, Phone, Mail, Dumbbell, Edit, Trash2, UserCheck } from 'lucide-react'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import api from '../../services/api'
import { tienePermiso, PERMISOS } from '../../services/permisos'
import { useConfirm } from '../../hooks/useConfirm'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function EntrenadoresLista() {
  const navigate = useNavigate()
  const { confirm, ConfirmDialog } = useConfirm()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [entrenadores, setEntrenadores] = useState([])
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    cargarEntrenadores()
  }, [])

  async function cargarEntrenadores() {
    setLoading(true)
    try {
      const data = await api.get('/admin/entrenadores')
      setEntrenadores(data)
    } catch (err) {
      setError('Error al cargar entrenadores')
    } finally {
      setLoading(false)
    }
  }

  async function eliminarEntrenador(entrenador) {
    const confirmed = await confirm('Eliminar entrenador', `¿Eliminar a ${entrenador.nombre} ${entrenador.apellido || ''}?`)
    if (!confirmed) return
    try {
      await api.delete(`/admin/entrenadores/${entrenador.id}`)
      cargarEntrenadores()
    } catch (err) {
      setError('Error al eliminar entrenador')
    }
  }

  // Filtrar entrenadores
  const entrenadoresFiltrados = entrenadores.filter(e => {
    if (!busqueda.trim()) return true
    const query = busqueda.toLowerCase().trim()
    const nombreCompleto = `${e.nombre} ${e.apellido || ''}`.toLowerCase()
    return nombreCompleto.includes(query) ||
           e.documento?.toLowerCase().includes(query) ||
           e.especialidad?.toLowerCase().includes(query)
  })

  if (loading) {
    return (
      <LoadingSpinner />
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
            <div className="p-2 rounded-lg bg-teal-100">
              <UserCheck className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Entrenadores</h1>
              <p className="text-gray-500 text-sm">{entrenadores.length} entrenadores registrados</p>
            </div>
          </div>
        </div>
{tienePermiso(PERMISOS.DEPORTES_ENTRENAMIENTOS) && (
          <Button onClick={() => navigate('/admin/entrenadores/nuevo')} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Nuevo Entrenador
          </Button>
        )}
      </div>

      {error && <Alert type="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}

      {/* Buscador */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, documento o especialidad..."
            className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Lista de entrenadores */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {entrenadoresFiltrados.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {entrenadoresFiltrados.map(entrenador => (
              <div
                key={entrenador.id}
                className="p-4 hover:bg-gray-50 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                      {entrenador.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">
                        {entrenador.nombre} {entrenador.apellido || ''}
                      </h3>
                      {entrenador.especialidad && (
                        <p className="text-sm text-primary">{entrenador.especialidad}</p>
                      )}
                      <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-500">
                        {entrenador.documento && (
                          <span>DNI: {entrenador.documento}</span>
                        )}
                        {entrenador.telefono && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {entrenador.telefono}
                          </span>
                        )}
                        {entrenador.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {entrenador.email}
                          </span>
                        )}
                      </div>

                      {/* Categorías asignadas */}
                      {entrenador.categorias?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {entrenador.categorias.map(cat => (
                            <span
                              key={cat.id}
                              className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded"
                            >
                              {cat.categoriaActividad.actividad.nombre} - {cat.categoriaActividad.nombre}
                            </span>
                          ))}
                        </div>
                      )}
                      {entrenador.categoriasActivas === 0 && (
                        <p className="text-xs text-gray-400 mt-2 italic">Sin categorías asignadas</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs rounded ${entrenador.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {entrenador.activo ? 'Activo' : 'Inactivo'}
                    </span>
                    {tienePermiso(PERMISOS.DEPORTES_ENTRENAMIENTOS) && (
                      <>
                        <button
                          onClick={() => navigate(`/admin/entrenadores/${entrenador.id}`)}
                          className="p-2 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg transition"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => eliminarEntrenador(entrenador)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            {busqueda ? 'No se encontraron entrenadores' : 'No hay entrenadores registrados'}
          </div>
        )}
      </div>

      {/* ConfirmDialog */}
      <ConfirmDialog />
    </div>
  )
}
