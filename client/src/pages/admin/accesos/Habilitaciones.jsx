import { useState, useEffect } from 'react'
import { UserPlus, Search, Clock, CheckCircle, XCircle, Edit, Eye } from 'lucide-react'
import { Button } from '../../../components/Button'
import { usePagination } from '../../../hooks/usePagination'
import Pagination from '../../../components/Pagination'
import Modal from '../../../components/Modal'
import toast from 'react-hot-toast'
import { useConfirm } from '../../../hooks/useConfirm'
import LoadingSpinner from '../../../components/LoadingSpinner'

export default function Habilitaciones() {
  const [habilitaciones, setHabilitaciones] = useState([])
  const [loading, setLoading] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('activas') // activas, vencidas, todas
  const [modalFormulario, setModalFormulario] = useState(false)
  const [habilitacionEditar, setHabilitacionEditar] = useState(null)
  const { confirm, ConfirmDialog } = useConfirm()

  const { page, limit, pagination, setPagination, goToPage } = usePagination(1, 20)

  useEffect(() => {
    cargarHabilitaciones()
  }, [page, filtroEstado])

  const cargarHabilitaciones = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()

      if (filtroEstado === 'activas') {
        params.append('activo', 'true')
        params.append('vencidas', 'false')
      } else if (filtroEstado === 'vencidas') {
        params.append('vencidas', 'true')
      }

      const response = await fetch(`/api/accesos/habilitaciones?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      })

      const data = await response.json()
      if (data.success) {
        let result = data.data || []

        // Filtro de búsqueda local
        if (busqueda) {
          const termino = busqueda.toLowerCase()
          result = result.filter(h =>
            h.documento.includes(termino) ||
            h.nombreCompleto.toLowerCase().includes(termino) ||
            (h.motivo && h.motivo.toLowerCase().includes(termino))
          )
        }

        setHabilitaciones(result)
      }
    } catch (error) {
      console.error('Error cargando habilitaciones:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleNueva = () => {
    setHabilitacionEditar(null)
    setModalFormulario(true)
  }

  const handleEditar = (habilitacion) => {
    setHabilitacionEditar(habilitacion)
    setModalFormulario(true)
  }

  const handleDesactivar = async (id) => {
    const confirmed = await confirm(
      '¿Desactivar habilitación?',
      '¿Está seguro de desactivar esta habilitación?',
      { variant: 'danger', confirmText: 'Desactivar' }
    )
    if (!confirmed) return

    try {
      const response = await fetch(`/api/accesos/habilitaciones/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ activo: false })
      })

      const data = await response.json()
      if (data.success) {
        toast.success('Habilitación desactivada')
        cargarHabilitaciones()
      }
    } catch (error) {
      console.error('Error desactivando:', error)
      toast.error('Error al desactivar')
    }
  }

  const formatFecha = (fecha) => {
    return new Date(fecha).toLocaleDateString('es-AR')
  }

  const estaVencida = (fechaHasta) => {
    return new Date(fechaHasta) < new Date()
  }

  const diasRestantes = (fechaHasta) => {
    const ahora = new Date()
    const hasta = new Date(fechaHasta)
    const diff = Math.ceil((hasta - ahora) / (1000 * 60 * 60 * 24))
    return diff
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-100">
            <UserPlus className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Habilitaciones Temporales</h1>
            <p className="text-gray-500 text-sm">{habilitaciones.length} registros</p>
          </div>
        </div>
        <Button onClick={handleNueva}>
          <UserPlus className="w-4 h-4 mr-2" />
          Nueva Habilitación
        </Button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Búsqueda */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por DNI, nombre o motivo..."
                className="input-field w-full pl-10"
              />
            </div>
          </div>

          {/* Filtro Estado */}
          <div className="flex gap-2">
            <button
              onClick={() => setFiltroEstado('activas')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filtroEstado === 'activas'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Activas
            </button>
            <button
              onClick={() => setFiltroEstado('vencidas')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filtroEstado === 'vencidas'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Vencidas
            </button>
            <button
              onClick={() => setFiltroEstado('todas')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filtroEstado === 'todas'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Todas
            </button>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <LoadingSpinner />
        ) : habilitaciones.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <UserPlus className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No hay habilitaciones temporales</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">DNI</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Nombre</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600 hidden md:table-cell">
                    Motivo
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Vigencia</th>
                  <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600 hidden lg:table-cell">
                    Accesos
                  </th>
                  <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Estado</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {habilitaciones.map((hab) => {
                  const vencida = estaVencida(hab.fechaHasta)
                  const dias = diasRestantes(hab.fechaHasta)

                  return (
                    <tr key={hab.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-mono font-medium text-gray-800">
                          {hab.documento}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-800">{hab.nombreCompleto}</p>
                          {hab.observaciones && (
                            <p className="text-xs text-gray-500 mt-1">{hab.observaciones}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-sm text-gray-600">{hab.motivo || '-'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <div className="flex items-center gap-1 text-gray-600">
                            <Clock className="w-4 h-4" />
                            {formatFecha(hab.fechaDesde)} - {formatFecha(hab.fechaHasta)}
                          </div>
                          {!vencida && dias >= 0 && dias <= 7 && (
                            <p className="text-xs text-orange-600 mt-1">
                              {dias === 0 ? 'Vence hoy' : `${dias} día${dias > 1 ? 's' : ''} restante${dias > 1 ? 's' : ''}`}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center hidden lg:table-cell">
                        <div className="text-sm">
                          <span className="font-medium text-gray-800">{hab.accesosUsados}</span>
                          {hab.accesosPermitidos && (
                            <span className="text-gray-500"> / {hab.accesosPermitidos}</span>
                          )}
                          {!hab.accesosPermitidos && (
                            <span className="text-gray-500"> / ∞</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {!hab.activo ? (
                          <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            Inactiva
                          </span>
                        ) : vencida ? (
                          <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            Vencida
                          </span>
                        ) : hab.accesosPermitidos && hab.accesosUsados >= hab.accesosPermitidos ? (
                          <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                            Límite
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            Vigente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditar(hab)}
                            className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-lg"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {hab.activo && !vencida && (
                            <button
                              onClick={() => handleDesactivar(hab.id)}
                              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                              title="Desactivar"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Formulario */}
      {modalFormulario && (
        <FormularioHabilitacion
          habilitacion={habilitacionEditar}
          onClose={() => {
            setModalFormulario(false)
            setHabilitacionEditar(null)
          }}
          onSuccess={() => {
            setModalFormulario(false)
            setHabilitacionEditar(null)
            cargarHabilitaciones()
          }}
        />
      )}

      <ConfirmDialog />
    </div>
  )
}

// Componente Formulario
function FormularioHabilitacion({ habilitacion, onClose, onSuccess }) {
  const esEdicion = !!habilitacion

  const [formData, setFormData] = useState({
    documento: habilitacion?.documento || '',
    nombreCompleto: habilitacion?.nombreCompleto || '',
    motivo: habilitacion?.motivo || '',
    diasHabilitados: habilitacion?.diasHabilitados || 7,
    accesosPermitidos: habilitacion?.accesosPermitidos || '',
    observaciones: habilitacion?.observaciones || ''
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = esEdicion
        ? `/api/accesos/habilitaciones/${habilitacion.id}`
        : '/api/accesos/habilitaciones'

      const body = {
        ...formData,
        diasHabilitados: parseInt(formData.diasHabilitados),
        accesosPermitidos: formData.accesosPermitidos ? parseInt(formData.accesosPermitidos) : null
      }

      const response = await fetch(url, {
        method: esEdicion ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (data.success) {
        toast.success(`Habilitación ${esEdicion ? 'actualizada' : 'creada'} correctamente`)
        onSuccess()
      } else {
        toast.error(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Error guardando:', error)
      toast.error('Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      onClose={onClose}
      title={esEdicion ? 'Editar Habilitación' : 'Nueva Habilitación'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            DNI *
          </label>
          <input
            type="text"
            required
            disabled={esEdicion}
            value={formData.documento}
            onChange={(e) => setFormData({ ...formData, documento: e.target.value })}
            className="input-field w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nombre Completo *
          </label>
          <input
            type="text"
            required
            value={formData.nombreCompleto}
            onChange={(e) => setFormData({ ...formData, nombreCompleto: e.target.value })}
            className="input-field w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Motivo
          </label>
          <input
            type="text"
            value={formData.motivo}
            onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
            className="input-field w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Días de Habilitación *
          </label>
          <input
            type="number"
            required
            min="1"
            value={formData.diasHabilitados}
            onChange={(e) => setFormData({ ...formData, diasHabilitados: e.target.value })}
            className="input-field w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Límite de Accesos (opcional)
          </label>
          <input
            type="number"
            min="1"
            value={formData.accesosPermitidos}
            onChange={(e) => setFormData({ ...formData, accesosPermitidos: e.target.value })}
            placeholder="Dejar vacío para ilimitado"
            className="input-field w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Observaciones
          </label>
          <textarea
            value={formData.observaciones}
            onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
            rows={3}
            className="input-field w-full"
          />
        </div>

        <div className="flex gap-3 mt-6">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? 'Guardando...' : esEdicion ? 'Actualizar' : 'Crear'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
