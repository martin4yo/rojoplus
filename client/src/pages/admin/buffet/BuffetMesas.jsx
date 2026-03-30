import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Settings, UtensilsCrossed } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'
import PageHeader from '../../../components/PageHeader'
import { useConfirm } from '../../../hooks/useConfirm'

export default function BuffetMesas() {
  const { confirm, ConfirmDialog } = useConfirm()
  const [mesas, setMesas] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState(null)
  const [formData, setFormData] = useState({
    numero: '',
    nombre: '',
    capacidad: 4,
    zona: '',
    esComunal: false
  })

  useEffect(() => {
    cargarMesas()
  }, [])

  async function cargarMesas() {
    try {
      const res = await api.get('/admin/buffet/mesas')
      setMesas(res.data || res || [])
    } catch (err) {
      console.error('Error cargando mesas:', err)
    } finally {
      setLoading(false)
    }
  }

  function abrirModal(mesa = null) {
    if (mesa) {
      setEditando(mesa)
      setFormData({
        numero: mesa.numero,
        nombre: mesa.nombre || '',
        capacidad: mesa.capacidad,
        zona: mesa.zona || '',
        esComunal: mesa.esComunal || false
      })
    } else {
      setEditando(null)
      setFormData({ numero: '', nombre: '', capacidad: 4, zona: '', esComunal: false })
    }
    setModalOpen(true)
  }

  async function guardar(e) {
    e.preventDefault()
    try {
      if (editando) {
        await api.put(`/admin/buffet/mesas/${editando.id}`, formData)
      } else {
        await api.post('/admin/buffet/mesas', formData)
      }
      setModalOpen(false)
      cargarMesas()
    } catch (err) {
      console.error('Error guardando mesa:', err)
      toast.error(err.response?.data?.error || 'Error al guardar')
    }
  }

  async function eliminar(id) {
    const confirmed = await confirm(
      '¿Eliminar mesa?',
      'Se eliminará esta mesa del sistema.',
      { variant: 'danger', confirmText: 'Eliminar' }
    )
    if (!confirmed) return
    try {
      await api.delete(`/admin/buffet/mesas/${id}`)
      cargarMesas()
    } catch (err) {
      console.error('Error eliminando mesa:', err)
      toast.error(err.response?.data?.error || 'Error al eliminar')
    }
  }

  async function toggleActivo(mesa) {
    try {
      await api.put(`/admin/buffet/mesas/${mesa.id}`, { activo: !mesa.activo })
      cargarMesas()
    } catch (err) {
      console.error('Error actualizando mesa:', err)
    }
  }

  const getColorEstado = (estado) => {
    switch (estado) {
      case 'LIBRE': return 'bg-green-100 text-green-800'
      case 'OCUPADA': return 'bg-red-100 text-red-800'
      case 'CUENTA_PEDIDA': return 'bg-yellow-100 text-yellow-800'
      case 'LIMPIEZA': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={UtensilsCrossed} title="Gestión de Mesas" subtitle="Configuración de mesas del buffet">
        {tienePermiso(PERMISOS.BUFFET_CONFIG) && (
          <button
            onClick={() => abrirModal()}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark"
          >
            <Plus size={18} />
            Nueva Mesa
          </button>
        )}
      </PageHeader>

      {/* Tabla de Mesas */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Número</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacidad</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Zona</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Activa</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {mesas.map(mesa => (
              <tr key={mesa.id} className={!mesa.activo ? 'bg-gray-50 opacity-60' : ''}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="font-medium text-lg">{mesa.numero}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                  {mesa.nombre || `Mesa ${mesa.numero}`}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                  {mesa.capacidad} personas
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                  {mesa.zona || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {mesa.esComunal ? (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      Comunal
                    </span>
                  ) : (
                    <span className="text-gray-500 text-sm">Normal</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getColorEstado(mesa.estado)}`}>
                    {mesa.estado}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => toggleActivo(mesa)}
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      mesa.activo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {mesa.activo ? 'Sí' : 'No'}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  {tienePermiso(PERMISOS.BUFFET_CONFIG) && (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => abrirModal(mesa)}
                        className="p-2 text-primary hover:bg-primary/10 rounded"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => eliminar(mesa.id)}
                        className="p-2 text-danger hover:bg-red-50 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {mesas.length === 0 && (
          <p className="text-center text-gray-500 py-8">No hay mesas configuradas</p>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editando ? 'Editar Mesa' : 'Nueva Mesa'}
            </h2>
            <form onSubmit={guardar} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de Mesa *
                </label>
                <input
                  type="number"
                  value={formData.numero}
                  onChange={e => setFormData({ ...formData, numero: parseInt(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre (opcional)
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Ej: Mesa VIP, Barra, etc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Capacidad
                </label>
                <input
                  type="number"
                  value={formData.capacidad}
                  onChange={e => setFormData({ ...formData, capacidad: parseInt(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Zona
                </label>
                <select
                  value={formData.zona}
                  onChange={e => setFormData({ ...formData, zona: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="">Sin zona</option>
                  <option value="SALON">Salón</option>
                  <option value="TERRAZA">Terraza</option>
                  <option value="BARRA">Barra</option>
                </select>
              </div>
              <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                <input
                  type="checkbox"
                  id="esComunal"
                  checked={formData.esComunal}
                  onChange={e => setFormData({ ...formData, esComunal: e.target.checked })}
                  className="w-5 h-5 text-purple-600 rounded"
                />
                <label htmlFor="esComunal" className="text-sm">
                  <span className="font-medium text-purple-800">Mesa Comunal</span>
                  <p className="text-purple-600 text-xs">Permite múltiples grupos/comandas simultáneas</p>
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog />
    </div>
  )
}
