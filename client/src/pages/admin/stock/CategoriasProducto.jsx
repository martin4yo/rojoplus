import { useState, useEffect } from 'react'
import { Tags, Plus, Edit2, Save, X, Trash2 } from 'lucide-react'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'

export default function CategoriasProducto() {
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Estado de edicion
  const [editandoId, setEditandoId] = useState(null)
  const [formData, setFormData] = useState({ codigo: '', nombre: '' })
  const [creando, setCreando] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    cargarCategorias()
  }, [])

  async function cargarCategorias() {
    setLoading(true)
    try {
      const res = await api.getFull('/admin/categorias-producto')
      setCategorias(res.data || [])
    } catch (err) {
      setError('Error al cargar categorias')
    } finally {
      setLoading(false)
    }
  }

  async function handleGuardar() {
    if (!formData.codigo || !formData.nombre) {
      setError('Codigo y nombre son requeridos')
      return
    }

    setSaving(true)
    try {
      if (editandoId) {
        await api.put(`/admin/categorias-producto/${editandoId}`, formData)
        setSuccess('Categoria actualizada')
      } else {
        await api.post('/admin/categorias-producto', formData)
        setSuccess('Categoria creada')
      }
      setEditandoId(null)
      setCreando(false)
      setFormData({ codigo: '', nombre: '' })
      cargarCategorias()
    } catch (err) {
      setError(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  function iniciarEdicion(cat) {
    setCreando(false)
    setEditandoId(cat.id)
    setFormData({ codigo: cat.codigo, nombre: cat.nombre })
  }

  function iniciarCreacion() {
    setEditandoId(null)
    setCreando(true)
    setFormData({ codigo: '', nombre: '' })
  }

  function cancelar() {
    setEditandoId(null)
    setCreando(false)
    setFormData({ codigo: '', nombre: '' })
  }

  async function toggleActivo(cat) {
    try {
      await api.put(`/admin/categorias-producto/${cat.id}`, { activo: !cat.activo })
      cargarCategorias()
    } catch (err) {
      setError(err.message || 'Error al actualizar')
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Tags className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Categorias de Producto</h1>
            <p className="text-gray-500 text-sm">{categorias.length} categorias</p>
          </div>
        </div>
        {!creando && !editandoId && tienePermiso(PERMISOS.STOCK_GESTIONAR) && (
          <Button onClick={iniciarCreacion}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Categoria
          </Button>
        )}
      </div>

      {error && <Alert type="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert type="success" className="mb-4" onClose={() => setSuccess(null)}>{success}</Alert>}

      {/* Formulario de creacion */}
      {creando && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">Nueva Categoria</h2>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Codigo *</label>
              <input
                type="text"
                value={formData.codigo}
                onChange={e => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                className="input-field w-32"
                placeholder="Ej: INDUM"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input
                type="text"
                value={formData.nombre}
                onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                className="input-field w-full"
                placeholder="Ej: Indumentaria"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleGuardar} loading={saving}>
                <Save className="w-4 h-4 mr-2" />
                Guardar
              </Button>
              <Button variant="secondary" onClick={cancelar}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : categorias.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
          <Tags className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No hay categorias registradas</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Codigo</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Nombre</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Productos</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Estado</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {categorias.map(cat => (
                <tr key={cat.id} className={!cat.activo ? 'bg-gray-50' : ''}>
                  {editandoId === cat.id ? (
                    <>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={formData.codigo}
                          onChange={e => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                          className="input-field w-24 text-sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={formData.nombre}
                          onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                          className="input-field w-full text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500">
                        {cat._count?.productos || 0}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          cat.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {cat.activo ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={handleGuardar}
                            disabled={saving}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                            title="Guardar"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelar}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                            title="Cancelar"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm bg-gray-100 px-2 py-0.5 rounded">
                          {cat.codigo}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">{cat.nombre}</td>
                      <td className="px-4 py-3 text-center text-gray-500">
                        {cat._count?.productos || 0}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleActivo(cat)}
                          className={`px-2 py-1 rounded-full text-xs font-medium cursor-pointer ${
                            cat.activo ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {cat.activo ? 'Activa' : 'Inactiva'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {tienePermiso(PERMISOS.STOCK_GESTIONAR) && (
                          <button
                            onClick={() => iniciarEdicion(cat)}
                            className="p-1.5 text-gray-500 hover:text-primary hover:bg-gray-100 rounded"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
