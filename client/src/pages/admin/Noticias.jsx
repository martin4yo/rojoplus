import { useState, useEffect } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { useModal } from '../../components/Modal'
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  PhotoIcon,
  MagnifyingGlassIcon,
  StarIcon,
  CalendarIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline'
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid'

const CATEGORIAS = [
  { value: 'INSTITUCIONAL', label: 'Institucional', color: 'bg-blue-100 text-blue-700' },
  { value: 'DEPORTES', label: 'Deportes', color: 'bg-green-100 text-green-700' },
  { value: 'ACTIVIDADES', label: 'Actividades', color: 'bg-purple-100 text-purple-700' },
  { value: 'EVENTOS', label: 'Eventos', color: 'bg-orange-100 text-orange-700' },
]

export default function Noticias() {
  const [noticias, setNoticias] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtros, setFiltros] = useState({
    categoria: '',
    publicada: '',
    busqueda: ''
  })
  const [modalOpen, setModalOpen] = useState(false)
  const [noticiaEditando, setNoticiaEditando] = useState(null)
  const { showModal, ModalComponent } = useModal()

  useEffect(() => {
    fetchNoticias()
  }, [filtros.categoria, filtros.publicada])

  const fetchNoticias = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filtros.categoria) params.append('categoria', filtros.categoria)
      if (filtros.publicada !== '') params.append('publicada', filtros.publicada)
      if (filtros.busqueda) params.append('busqueda', filtros.busqueda)

      const data = await api.getFull(`/admin/noticias?${params.toString()}`)
      setNoticias(data?.noticias || [])
    } catch (err) {
      console.error('Error cargando noticias:', err)
      toast.error('Error al cargar noticias')
      setNoticias([])
    } finally {
      setLoading(false)
    }
  }

  const handleBuscar = (e) => {
    e.preventDefault()
    fetchNoticias()
  }

  const handleNueva = () => {
    setNoticiaEditando(null)
    setModalOpen(true)
  }

  const handleEditar = (noticia) => {
    setNoticiaEditando(noticia)
    setModalOpen(true)
  }

  const handleEliminar = (id) => {
    showModal({
      type: 'warning',
      title: 'Eliminar noticia',
      message: '¿Eliminar esta noticia? Esta acción no se puede deshacer.',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        try {
          await api.delete(`/admin/noticias/${id}`)
          toast.success('Noticia eliminada')
          fetchNoticias()
        } catch (err) {
          toast.error(err.message || 'Error al eliminar')
        }
      }
    })
  }

  const handleTogglePublicar = async (noticia) => {
    try {
      await api.post(`/admin/noticias/${noticia.id}/publicar`, {
        publicar: !noticia.publicada
      })
      toast.success(noticia.publicada ? 'Noticia despublicada' : 'Noticia publicada')
      fetchNoticias()
    } catch (err) {
      toast.error(err.message || 'Error al cambiar estado')
    }
  }

  const handleSave = async (formData) => {
    try {
      if (formData.id) {
        await api.put(`/admin/noticias/${formData.id}`, formData)
        toast.success('Noticia actualizada')
      } else {
        await api.post('/admin/noticias', formData)
        toast.success('Noticia creada')
      }
      setModalOpen(false)
      setNoticiaEditando(null)
      fetchNoticias()
    } catch (err) {
      toast.error(err.message || 'Error al guardar')
    }
  }

  const getCategoriaColor = (categoria) => {
    const cat = CATEGORIAS.find(c => c.value === categoria)
    return cat?.color || 'bg-gray-100 text-gray-700'
  }

  const formatFecha = (fecha) => {
    if (!fecha) return '-'
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Noticias</h1>
          <p className="text-gray-500">Gestiona las noticias y novedades del club</p>
        </div>
        <button
          onClick={handleNueva}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
          Nueva Noticia
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <form onSubmit={handleBuscar} className="flex flex-col md:flex-row gap-4">
          {/* Búsqueda */}
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={filtros.busqueda}
              onChange={e => setFiltros({ ...filtros, busqueda: e.target.value })}
              placeholder="Buscar por título..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>

          {/* Categoría */}
          <select
            value={filtros.categoria}
            onChange={e => setFiltros({ ...filtros, categoria: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
          >
            <option value="">Todas las categorías</option>
            {CATEGORIAS.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>

          {/* Estado */}
          <select
            value={filtros.publicada}
            onChange={e => setFiltros({ ...filtros, publicada: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
          >
            <option value="">Todos los estados</option>
            <option value="true">Publicadas</option>
            <option value="false">Borradores</option>
          </select>

          <button
            type="submit"
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            Buscar
          </button>
        </form>
      </div>

      {/* Lista de noticias */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div>
          </div>
        ) : noticias.length === 0 ? (
          <div className="text-center py-12">
            <DocumentTextIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No hay noticias</p>
            <button
              onClick={handleNueva}
              className="mt-4 text-red-600 hover:text-red-700 font-medium"
            >
              Crear la primera noticia
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {noticias.map(noticia => (
              <div key={noticia.id} className="flex items-start gap-4 p-4 hover:bg-gray-50">
                {/* Imagen */}
                <div className="w-24 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                  {noticia.imagen ? (
                    <img
                      src={noticia.imagen}
                      alt={noticia.titulo}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <PhotoIcon className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-gray-900 truncate">{noticia.titulo}</h3>
                    {noticia.destacada && (
                      <StarIconSolid className="w-4 h-4 text-yellow-500" title="Destacada" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getCategoriaColor(noticia.categoria)}`}>
                      {CATEGORIAS.find(c => c.value === noticia.categoria)?.label || noticia.categoria}
                    </span>
                    {noticia.publicada ? (
                      <span className="text-green-600 flex items-center gap-1">
                        <EyeIcon className="w-4 h-4" />
                        Publicada
                      </span>
                    ) : (
                      <span className="text-gray-400 flex items-center gap-1">
                        <EyeSlashIcon className="w-4 h-4" />
                        Borrador
                      </span>
                    )}
                    <span className="text-gray-400 flex items-center gap-1">
                      <CalendarIcon className="w-4 h-4" />
                      {formatFecha(noticia.fechaPublicacion || noticia.createdAt)}
                    </span>
                  </div>
                  {noticia.extracto && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-1">{noticia.extracto}</p>
                  )}
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleTogglePublicar(noticia)}
                    className={`p-2 rounded-lg transition-colors ${
                      noticia.publicada
                        ? 'text-gray-400 hover:text-orange-600 hover:bg-orange-50'
                        : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                    }`}
                    title={noticia.publicada ? 'Despublicar' : 'Publicar'}
                  >
                    {noticia.publicada ? (
                      <EyeSlashIcon className="w-5 h-5" />
                    ) : (
                      <EyeIcon className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={() => handleEditar(noticia)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <PencilSquareIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleEliminar(noticia.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Edición */}
      {modalOpen && (
        <ModalNoticia
          noticia={noticiaEditando}
          onClose={() => {
            setModalOpen(false)
            setNoticiaEditando(null)
          }}
          onSave={handleSave}
        />
      )}

      {/* Modal Confirmación */}
      {ModalComponent}
    </div>
  )
}

// ============ MODAL NOTICIA ============
function ModalNoticia({ noticia, onClose, onSave }) {
  const [form, setForm] = useState({
    id: noticia?.id || null,
    titulo: noticia?.titulo || '',
    extracto: noticia?.extracto || '',
    contenido: noticia?.contenido || '',
    imagen: noticia?.imagen || '',
    categoria: noticia?.categoria || 'INSTITUCIONAL',
    destacada: noticia?.destacada || false,
    publicada: noticia?.publicada || false,
    fechaPublicacion: noticia?.fechaPublicacion
      ? new Date(noticia.fechaPublicacion).toISOString().substring(0, 16)
      : ''
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [tab, setTab] = useState('contenido') // 'contenido' | 'preview'

  const handleUpload = async (file) => {
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.append('imagen', file)

    try {
      const response = await fetch('/api/admin/noticias/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: formData
      })

      const result = await response.json()

      if (result.success) {
        setForm(prev => ({ ...prev, imagen: result.url }))
        toast.success('Imagen subida')
      } else {
        toast.error(result.error || 'Error al subir imagen')
      }
    } catch (err) {
      toast.error('Error al subir imagen')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.titulo.trim()) {
      toast.error('El título es requerido')
      return
    }

    if (!form.contenido.trim()) {
      toast.error('El contenido es requerido')
      return
    }

    setSaving(true)
    await onSave({
      ...form,
      fechaPublicacion: form.fechaPublicacion || null
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose}></div>

        <div className="relative bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              {noticia ? 'Editar Noticia' : 'Nueva Noticia'}
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTab('contenido')}
                className={`px-3 py-1.5 text-sm rounded-lg ${
                  tab === 'contenido' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => setTab('preview')}
                className={`px-3 py-1.5 text-sm rounded-lg ${
                  tab === 'preview' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Vista previa
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
            {tab === 'contenido' ? (
              <div className="p-6 space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Título */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Título *
                    </label>
                    <input
                      type="text"
                      value={form.titulo}
                      onChange={e => setForm({ ...form, titulo: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                      placeholder="Título de la noticia"
                      required
                    />
                  </div>

                  {/* Extracto */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Extracto (resumen)
                    </label>
                    <textarea
                      value={form.extracto}
                      onChange={e => setForm({ ...form, extracto: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                      rows={2}
                      placeholder="Breve descripción que aparece en el listado..."
                    />
                  </div>

                  {/* Contenido */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contenido *
                    </label>
                    <textarea
                      value={form.contenido}
                      onChange={e => setForm({ ...form, contenido: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 font-mono text-sm"
                      rows={10}
                      placeholder="Contenido de la noticia (puede usar HTML básico)..."
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Podés usar etiquetas HTML como &lt;p&gt;, &lt;strong&gt;, &lt;em&gt;, &lt;ul&gt;, &lt;li&gt;
                    </p>
                  </div>

                  {/* Imagen */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Imagen principal
                    </label>
                    <div className="flex gap-4 items-start">
                      <div className="flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={e => handleUpload(e.target.files[0])}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 file:mr-4 file:py-1 file:px-4 file:rounded-lg file:border-0 file:bg-red-50 file:text-red-700 file:cursor-pointer"
                          disabled={uploading}
                        />
                        {form.imagen && (
                          <p className="mt-1 text-xs text-green-600 truncate">{form.imagen}</p>
                        )}
                      </div>
                      {form.imagen && (
                        <div className="w-32 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                          <img
                            src={form.imagen}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Categoría */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Categoría
                    </label>
                    <select
                      value={form.categoria}
                      onChange={e => setForm({ ...form, categoria: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                    >
                      {CATEGORIAS.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Fecha publicación */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha de publicación
                    </label>
                    <input
                      type="datetime-local"
                      value={form.fechaPublicacion}
                      onChange={e => setForm({ ...form, fechaPublicacion: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Dejar vacío para publicar inmediatamente
                    </p>
                  </div>

                  {/* Opciones */}
                  <div className="md:col-span-2 flex flex-wrap gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.destacada}
                        onChange={e => setForm({ ...form, destacada: e.target.checked })}
                        className="rounded border-gray-300 text-yellow-500 focus:ring-yellow-500"
                      />
                      <StarIcon className="w-5 h-5 text-yellow-500" />
                      <span className="text-sm text-gray-700">Destacar en home</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.publicada}
                        onChange={e => setForm({ ...form, publicada: e.target.checked })}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <EyeIcon className="w-5 h-5 text-green-600" />
                      <span className="text-sm text-gray-700">Publicar ahora</span>
                    </label>
                  </div>
                </div>
              </div>
            ) : (
              /* Preview */
              <div className="p-6">
                <div className="max-w-3xl mx-auto">
                  {form.imagen && (
                    <img
                      src={form.imagen}
                      alt={form.titulo}
                      className="w-full h-64 object-cover rounded-xl mb-6"
                    />
                  )}
                  <div className="mb-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      CATEGORIAS.find(c => c.value === form.categoria)?.color || 'bg-gray-100 text-gray-700'
                    }`}>
                      {CATEGORIAS.find(c => c.value === form.categoria)?.label || form.categoria}
                    </span>
                  </div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-4">
                    {form.titulo || 'Sin título'}
                  </h1>
                  {form.extracto && (
                    <p className="text-lg text-gray-600 mb-6">{form.extracto}</p>
                  )}
                  <div
                    className="prose prose-lg max-w-none"
                    dangerouslySetInnerHTML={{ __html: form.contenido || '<p class="text-gray-400">Sin contenido</p>' }}
                  />
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-between items-center">
              <div className="text-sm text-gray-500">
                {form.publicada ? (
                  <span className="text-green-600">Se publicará al guardar</span>
                ) : (
                  <span>Se guardará como borrador</span>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : (form.id ? 'Actualizar' : 'Crear')}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
