import { useState, useEffect } from 'react'
import api from '../../../services/api'
import toast from 'react-hot-toast'
import { PlusIcon, PencilIcon, TrashIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { Layers } from 'lucide-react'
import CentroCostoForm from './CentroCostoForm'
import { useConfirm } from '../../../hooks/useConfirm'
import LoadingSpinner from '../../../components/LoadingSpinner'

export default function CentrosCostoLista() {
  const { confirm, ConfirmDialog } = useConfirm()
  const [centros, setCentros] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroActivo, setFiltroActivo] = useState('todos')
  const [modalOpen, setModalOpen] = useState(false)
  const [centroEditar, setCentroEditar] = useState(null)

  useEffect(() => {
    cargarCentros()
  }, [filtroTipo, filtroActivo])

  const cargarCentros = async () => {
    try {
      setLoading(true)
      const params = {}
      if (filtroTipo) params.tipo = filtroTipo
      if (filtroActivo !== 'todos') params.activo = filtroActivo === 'activos'

      const response = await api.get('/admin/centros-costo', { params })
      setCentros(response?.data || response || [])
      setError(null)
    } catch (err) {
      setError(err.message)
      console.error('Error cargando centros de costo:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleNuevo = () => {
    setCentroEditar(null)
    setModalOpen(true)
  }

  const handleEditar = (centro) => {
    setCentroEditar(centro)
    setModalOpen(true)
  }

  const handleEliminar = async (centro) => {
    const confirmado = await confirm(
      'Desactivar Centro de Costo',
      `¿Estás seguro de que deseas desactivar el centro de costo "${centro.nombre}"?`,
      { confirmText: 'Desactivar', cancelText: 'Cancelar', variant: 'danger' }
    )

    if (!confirmado) return

    try {
      await api.delete(`/admin/centros-costo/${centro.id}`)
      toast.success('Centro de costo desactivado')
      await cargarCentros()
    } catch (err) {
      toast.error('Error al eliminar: ' + err.message)
    }
  }

  const handleGuardado = () => {
    setModalOpen(false)
    setCentroEditar(null)
    cargarCentros()
  }

  const centrosFiltrados = centros

  const centrosOperativos = centrosFiltrados.filter(c => c.tipo === 'OPERATIVO')
  const centrosAdministrativos = centrosFiltrados.filter(c => c.tipo === 'ADMINISTRATIVO')

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Layers className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Centros de Costo</h1>
            <p className="text-sm text-gray-500">Gestiona los centros de costo para análisis de rentabilidad</p>
          </div>
        </div>
        <button
          onClick={handleNuevo}
          className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Nuevo Centro
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white shadow-sm rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo
            </label>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
            >
              <option value="">Todos</option>
              <option value="OPERATIVO">Operativo</option>
              <option value="ADMINISTRATIVO">Administrativo</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estado
            </label>
            <select
              value={filtroActivo}
              onChange={(e) => setFiltroActivo(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
            >
              <option value="todos">Todos</option>
              <option value="activos">Activos</option>
              <option value="inactivos">Inactivos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de Centros Operativos */}
      {centrosOperativos.length > 0 && (
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Centros Operativos</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {centrosOperativos.map((centro) => (
              <div key={centro.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-medium text-gray-900">
                        {centro.nombre}
                      </h3>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {centro.codigo}
                      </span>
                      {centro.activo ? (
                        <CheckCircleIcon className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircleIcon className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                    {centro.descripcion && (
                      <p className="mt-1 text-sm text-gray-500">{centro.descripcion}</p>
                    )}
                    <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                      <span>{centro._count.actividades} actividades</span>
                      <span>{centro._count.movimientosCaja} mov. caja</span>
                      <span>{centro._count.movimientosContables} mov. contables</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleEditar(centro)}
                      className="p-2 text-gray-400 hover:text-primary transition-colors"
                      title="Editar"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleEliminar(centro)}
                      className="p-2 text-gray-400 hover:text-danger transition-colors"
                      title="Desactivar"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de Centros Administrativos */}
      {centrosAdministrativos.length > 0 && (
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Centros Administrativos</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {centrosAdministrativos.map((centro) => (
              <div key={centro.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-medium text-gray-900">
                        {centro.nombre}
                      </h3>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {centro.codigo}
                      </span>
                      {centro.activo ? (
                        <CheckCircleIcon className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircleIcon className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                    {centro.descripcion && (
                      <p className="mt-1 text-sm text-gray-500">{centro.descripcion}</p>
                    )}
                    <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                      <span>{centro._count.movimientosCaja} mov. caja</span>
                      <span>{centro._count.movimientosContables} mov. contables</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleEditar(centro)}
                      className="p-2 text-gray-400 hover:text-primary transition-colors"
                      title="Editar"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleEliminar(centro)}
                      className="p-2 text-gray-400 hover:text-danger transition-colors"
                      title="Desactivar"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {centros.length === 0 && !loading && (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <p className="text-gray-500">No se encontraron centros de costo</p>
          <button
            onClick={handleNuevo}
            className="mt-4 inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Crear Primer Centro
          </button>
        </div>
      )}

      {/* Modal de formulario */}
      {modalOpen && (
        <CentroCostoForm
          centro={centroEditar}
          onClose={() => {
            setModalOpen(false)
            setCentroEditar(null)
          }}
          onSaved={handleGuardado}
        />
      )}

      {/* Dialog de confirmación */}
      <ConfirmDialog />
    </div>
  )
}
