import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Plus, Edit, Trash2, Sun, Moon, Users, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '../../../components/Button'
import Modal from '../../../components/Modal'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'

export default function EspaciosLista() {
  const [espacios, setEspacios] = useState([])
  const [tiposEspacio, setTiposEspacio] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filtroActivo, setFiltroActivo] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')

  // Modal de confirmacion
  const [modalEliminar, setModalEliminar] = useState({ visible: false, espacio: null })
  const [eliminando, setEliminando] = useState(false)

  useEffect(() => {
    cargarDatos()
  }, [])

  useEffect(() => {
    cargarEspacios()
  }, [filtroActivo, filtroTipo])

  async function cargarDatos() {
    try {
      const tiposRes = await api.getFull('/admin/tipos-espacio?activo=true')
      setTiposEspacio(tiposRes.data || [])
    } catch (err) {
      console.error('Error cargando tipos:', err)
    }
  }

  async function cargarEspacios() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filtroActivo !== '') params.append('activo', filtroActivo)
      if (filtroTipo) params.append('tipoEspacioId', filtroTipo)

      const queryString = params.toString()
      const url = `/admin/espacios-deportivos${queryString ? `?${queryString}` : ''}`
      const response = await api.getFull(url)
      setEspacios(response.data || [])
    } catch (err) {
      setError('Error al cargar los espacios')
    } finally {
      setLoading(false)
    }
  }

  async function handleEliminar() {
    if (!modalEliminar.espacio) return

    setEliminando(true)
    try {
      await api.delete(`/admin/espacios-deportivos/${modalEliminar.espacio.id}`)
      setModalEliminar({ visible: false, espacio: null })
      cargarEspacios()
    } catch (err) {
      setError(err.message || 'Error al eliminar el espacio')
    } finally {
      setEliminando(false)
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <MapPin className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Espacios Deportivos</h1>
            <p className="text-gray-500 text-sm">Canchas, gimnasios y otros espacios del club</p>
          </div>
        </div>
        {tienePermiso(PERMISOS.DEPORTES_VER) && (
          <Link to="/admin/deportes/espacios/nuevo">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Espacio
            </Button>
          </Link>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
          <button onClick={() => setError(null)} className="float-right font-bold">&times;</button>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select
              value={filtroActivo}
              onChange={(e) => setFiltroActivo(e.target.value)}
              className="input-field w-full"
            >
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="input-field w-full"
            >
              <option value="">Todos</option>
              {tiposEspacio.map((tipo) => (
                <option key={tipo.id} value={tipo.id}>{tipo.nombre}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Lista de espacios */}
      {espacios.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No hay espacios deportivos registrados</p>
          {tienePermiso(PERMISOS.DEPORTES_VER) && (
            <Link to="/admin/deportes/espacios/nuevo" className="text-primary hover:underline mt-2 inline-block">
              Crear el primer espacio
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {espacios.map(espacio => (
            <div
              key={espacio.id}
              className={`bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow ${
                !espacio.activo ? 'opacity-60' : ''
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-lg text-gray-800">{espacio.nombre}</h3>
                  <p className="text-sm text-gray-500">{espacio.codigo}</p>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  espacio.activo
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {espacio.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-gray-600">
                  <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                  {espacio.tipoEspacio?.nombre || 'Sin tipo'}
                </div>
                {espacio.capacidad && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Users className="w-4 h-4 mr-2 text-gray-400" />
                    Capacidad: {espacio.capacidad} personas
                  </div>
                )}
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center text-gray-600">
                    {espacio.cubierto ? (
                      <CheckCircle className="w-4 h-4 mr-1 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 mr-1 text-gray-400" />
                    )}
                    Cubierto
                  </div>
                  <div className="flex items-center text-gray-600">
                    {espacio.iluminacion ? (
                      <Sun className="w-4 h-4 mr-1 text-yellow-500" />
                    ) : (
                      <Moon className="w-4 h-4 mr-1 text-gray-400" />
                    )}
                    Iluminacion
                  </div>
                </div>
              </div>

              {espacio.actividades?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-1">Actividades:</p>
                  <div className="flex flex-wrap gap-1">
                    {espacio.actividades.map(act => (
                      <span
                        key={act.id}
                        className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded"
                      >
                        {act.nombre}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {espacio.descripcion && (
                <p className="text-sm text-gray-500 mb-4 line-clamp-2">{espacio.descripcion}</p>
              )}

              {tienePermiso(PERMISOS.DEPORTES_VER) && (
                <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                  <Link to={`/admin/deportes/espacios/${espacio.id}`}>
                    <Button variant="secondary" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setModalEliminar({ visible: true, espacio })}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal de confirmacion de eliminacion */}
      <Modal
        isOpen={modalEliminar.visible}
        onClose={() => setModalEliminar({ visible: false, espacio: null })}
        title="Eliminar Espacio"
      >
        <p className="text-gray-600 mb-6">
          ¿Estas seguro de eliminar el espacio <strong>{modalEliminar.espacio?.nombre}</strong>?
          Esta accion no se puede deshacer.
        </p>
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => setModalEliminar({ visible: false, espacio: null })}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={handleEliminar}
            loading={eliminando}
          >
            Eliminar
          </Button>
        </div>
      </Modal>
    </div>
  )
}
