import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, GripVertical, Tag } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'
import PageHeader from '../../../components/PageHeader'
import { useConfirm } from '../../../hooks/useConfirm'

export default function BuffetCategorias() {
  const { confirm, ConfirmDialog } = useConfirm()
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState(null)
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    color: '#3B82F6',
    icono: '',
    orden: 0
  })

  useEffect(() => {
    cargarCategorias()
  }, [])

  async function cargarCategorias() {
    try {
      const res = await api.get('/admin/buffet/categorias')
      setCategorias(res.data || res || [])
    } catch (err) {
      console.error('Error cargando categorías:', err)
    } finally {
      setLoading(false)
    }
  }

  function abrirModal(categoria = null) {
    if (categoria) {
      setEditando(categoria)
      setFormData({
        codigo: categoria.codigo,
        nombre: categoria.nombre,
        descripcion: categoria.descripcion || '',
        color: categoria.color || '#3B82F6',
        icono: categoria.icono || '',
        orden: categoria.orden || 0
      })
    } else {
      setEditando(null)
      setFormData({
        codigo: '',
        nombre: '',
        descripcion: '',
        color: '#3B82F6',
        icono: '',
        orden: categorias.length
      })
    }
    setModalOpen(true)
  }

  async function guardar(e) {
    e.preventDefault()
    try {
      if (editando) {
        await api.put(`/admin/buffet/categorias/${editando.id}`, formData)
      } else {
        await api.post('/admin/buffet/categorias', formData)
      }
      setModalOpen(false)
      cargarCategorias()
    } catch (err) {
      console.error('Error guardando categoría:', err)
      toast.error(err.response?.data?.error || 'Error al guardar')
    }
  }

  async function eliminar(id) {
    const confirmed = await confirm(
      '¿Eliminar categoría?',
      'Se eliminará esta categoría del menú.',
      { variant: 'danger', confirmText: 'Eliminar' }
    )
    if (!confirmed) return
    try {
      await api.delete(`/admin/buffet/categorias/${id}`)
      cargarCategorias()
    } catch (err) {
      console.error('Error eliminando categoría:', err)
      toast.error(err.response?.data?.error || 'Error al eliminar')
    }
  }

  async function toggleActivo(categoria) {
    try {
      await api.put(`/admin/buffet/categorias/${categoria.id}`, { activo: !categoria.activo })
      cargarCategorias()
    } catch (err) {
      console.error('Error actualizando categoría:', err)
    }
  }

  if (loading) {
    return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div></div>
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={Tag} title="Categorías del Menú" subtitle="Organiza los productos por categoría">
        {tienePermiso(PERMISOS.BUFFET_CONFIG) && (
          <button
            onClick={() => abrirModal()}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <Plus size={18} />
            Nueva Categoría
          </button>
        )}
      </PageHeader>

      {/* Grid de Categorías */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categorias.map(cat => (
          <div
            key={cat.id}
            className={`bg-white rounded-lg shadow p-4 border-l-4 ${!cat.activo ? 'opacity-60' : ''}`}
            style={{ borderLeftColor: cat.color || '#3B82F6' }}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-lg">{cat.nombre}</h3>
                <p className="text-sm text-gray-500">{cat.codigo}</p>
                {cat.descripcion && (
                  <p className="text-sm text-gray-600 mt-1">{cat.descripcion}</p>
                )}
                <p className="text-sm text-gray-500 mt-2">
                  {cat._count?.productos || 0} productos
                </p>
              </div>
              <div
                className="w-8 h-8 rounded-full"
                style={{ backgroundColor: cat.color || '#3B82F6' }}
              />
            </div>

            <div className="flex justify-between items-center mt-4 pt-4 border-t">
              <button
                onClick={() => toggleActivo(cat)}
                className={`px-2 py-1 rounded text-xs font-medium ${
                  cat.activo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}
              >
                {cat.activo ? 'Activa' : 'Inactiva'}
              </button>

              {tienePermiso(PERMISOS.BUFFET_CONFIG) && (
                <div className="flex gap-2">
                  <button
                    onClick={() => abrirModal(cat)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => eliminar(cat.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {categorias.length === 0 && (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No hay categorías configuradas. Crea algunas para organizar tu menú.
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editando ? 'Editar Categoría' : 'Nueva Categoría'}
            </h2>
            <form onSubmit={guardar} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código *
                </label>
                <input
                  type="text"
                  value={formData.codigo}
                  onChange={e => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="BEBIDAS, COMIDAS, etc."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <textarea
                  value={formData.descripcion}
                  onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Color
                  </label>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={e => setFormData({ ...formData, color: e.target.value })}
                    className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Orden
                  </label>
                  <input
                    type="number"
                    value={formData.orden}
                    onChange={e => setFormData({ ...formData, orden: parseInt(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
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
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
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
