import { useState, useEffect } from 'react'
import { MapPin, Plus, Edit, Trash2, GripVertical, Save, X } from 'lucide-react'
import { Button } from '../../../components/Button'
import Modal from '../../../components/Modal'
import { Alert } from '../../../components/Alert'
import api from '../../../services/api'

export default function TiposEspacioConfig() {
  const [tipos, setTipos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Modal de edicion/creacion
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ codigo: '', nombre: '', descripcion: '' })
  const [saving, setSaving] = useState(false)

  // Modal de confirmacion de eliminacion
  const [modalEliminar, setModalEliminar] = useState({ visible: false, tipo: null })
  const [eliminando, setEliminando] = useState(false)

  useEffect(() => {
    cargarTipos()
  }, [])

  async function cargarTipos() {
    setLoading(true)
    try {
      const res = await api.getFull('/admin/tipos-espacio')
      setTipos(res.data || [])
    } catch (err) {
      setError('Error al cargar los tipos de espacio')
    } finally {
      setLoading(false)
    }
  }

  function abrirModalNuevo() {
    setEditando(null)
    setForm({ codigo: '', nombre: '', descripcion: '' })
    setModalOpen(true)
  }

  function abrirModalEditar(tipo) {
    setEditando(tipo)
    setForm({
      codigo: tipo.codigo,
      nombre: tipo.nombre,
      descripcion: tipo.descripcion || ''
    })
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!form.codigo || !form.nombre) {
      setError('Codigo y nombre son requeridos')
      return
    }

    setSaving(true)
    try {
      if (editando) {
        await api.put(`/admin/tipos-espacio/${editando.id}`, form)
        setSuccess('Tipo actualizado correctamente')
      } else {
        await api.post('/admin/tipos-espacio', form)
        setSuccess('Tipo creado correctamente')
      }
      setModalOpen(false)
      cargarTipos()
    } catch (err) {
      setError(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleEliminar() {
    if (!modalEliminar.tipo) return

    setEliminando(true)
    try {
      await api.delete(`/admin/tipos-espacio/${modalEliminar.tipo.id}`)
      setModalEliminar({ visible: false, tipo: null })
      setSuccess('Tipo eliminado correctamente')
      cargarTipos()
    } catch (err) {
      setError(err.message || 'Error al eliminar')
    } finally {
      setEliminando(false)
    }
  }

  async function toggleActivo(tipo) {
    try {
      await api.put(`/admin/tipos-espacio/${tipo.id}`, { activo: !tipo.activo })
      cargarTipos()
    } catch (err) {
      setError(err.message || 'Error al actualizar')
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
            <h1 className="text-2xl font-bold text-gray-800">Tipos de Espacio</h1>
            <p className="text-gray-500 text-sm">Configuracion de tipos de espacios deportivos</p>
          </div>
        </div>
        <Button onClick={abrirModalNuevo}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Tipo
        </Button>
      </div>

      {error && <Alert type="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert type="success" className="mb-4" onClose={() => setSuccess(null)}>{success}</Alert>}

      {/* Lista de tipos */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {tipos.length === 0 ? (
          <div className="p-12 text-center">
            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No hay tipos de espacio configurados</p>
            <button onClick={abrirModalNuevo} className="text-primary hover:underline mt-2">
              Crear el primer tipo
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Orden</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Codigo</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Nombre</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Descripcion</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Espacios</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Estado</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tipos.map((tipo, index) => (
                <tr key={tipo.id} className={`hover:bg-gray-50 ${!tipo.activo ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-gray-400">
                      <GripVertical className="w-4 h-4" />
                      <span className="text-sm">{tipo.orden}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                      {tipo.codigo}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{tipo.nombre}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{tipo.descripcion || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 bg-gray-100 text-gray-600 text-sm rounded-full">
                      {tipo._count?.espacios || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActivo(tipo)}
                      className={`px-2 py-1 text-xs rounded-full transition ${
                        tipo.activo
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {tipo.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => abrirModalEditar(tipo)}
                        className="p-1.5 text-gray-500 hover:text-primary hover:bg-primary/10 rounded"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setModalEliminar({ visible: true, tipo })}
                        className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded"
                        title="Eliminar"
                        disabled={tipo._count?.espacios > 0}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de creacion/edicion */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editando ? 'Editar Tipo de Espacio' : 'Nuevo Tipo de Espacio'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Codigo *</label>
            <input
              type="text"
              value={form.codigo}
              onChange={e => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
              className="input-field w-full font-mono"
              placeholder="Ej: CANCHA_FUTBOL"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Identificador unico en mayusculas</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              type="text"
              value={form.nombre}
              onChange={e => setForm({ ...form, nombre: e.target.value })}
              className="input-field w-full"
              placeholder="Ej: Cancha de Futbol"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
            <textarea
              value={form.descripcion}
              onChange={e => setForm({ ...form, descripcion: e.target.value })}
              className="input-field w-full"
              rows={2}
              placeholder="Descripcion opcional..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              <Save className="w-4 h-4 mr-2" />
              {editando ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal de confirmacion de eliminacion */}
      <Modal
        isOpen={modalEliminar.visible}
        onClose={() => setModalEliminar({ visible: false, tipo: null })}
        title="Eliminar Tipo de Espacio"
      >
        <p className="text-gray-600 mb-6">
          ¿Estas seguro de eliminar el tipo <strong>{modalEliminar.tipo?.nombre}</strong>?
          Esta accion no se puede deshacer.
        </p>
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => setModalEliminar({ visible: false, tipo: null })}
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
