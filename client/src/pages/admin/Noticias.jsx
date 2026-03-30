import { useState, useEffect } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import Modal, { useModal } from '../../components/Modal'
import ImageUpload from '../../components/ImageUpload'
import { tienePermiso, PERMISOS } from '../../services/permisos'
import { formatDate } from '../../utils/formatters'
import StatusBadge from '../../components/StatusBadge'
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
import { Newspaper } from 'lucide-react'
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Newspaper className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Noticias</h1>
            <p className="text-sm text-gray-500">Gestiona las noticias y novedades del club</p>
          </div>
        </div>
        {tienePermiso(PERMISOS.CONTENIDO_GESTIONAR) && (
          <button
            onClick={handleNueva}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            Nueva Noticia
          </button>
        )}
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
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>

          {/* Categoría */}
          <select
            value={filtros.categoria}
            onChange={e => setFiltros({ ...filtros, categoria: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
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
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
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
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          </div>
        ) : noticias.length === 0 ? (
          <div className="text-center py-12">
            <DocumentTextIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No hay noticias</p>
            <button
              onClick={handleNueva}
              className="mt-4 text-primary hover:text-primary-dark font-medium"
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
                    <StatusBadge
                      status={noticia.publicada ? 'PUBLICADA' : 'BORRADOR'}
                      type="generic"
                      size="sm"
                    />
                    <span className="text-gray-400 flex items-center gap-1">
                      <CalendarIcon className="w-4 h-4" />
                      {formatDate(noticia.fechaPublicacion || noticia.createdAt, { format: 'short' })}
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
                  {tienePermiso(PERMISOS.CONTENIDO_GESTIONAR) && (
                    <button
                      onClick={() => handleEditar(noticia)}
                      className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <PencilSquareIcon className="w-5 h-5" />
                    </button>
                  )}
                  {tienePermiso(PERMISOS.CONTENIDO_GESTIONAR) && (
                    <button
                      onClick={() => handleEliminar(noticia.id)}
                      className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Edición */}
      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setNoticiaEditando(null)
        }}
        title={noticiaEditando ? 'Editar Noticia' : 'Nueva Noticia'}
        maxWidth="max-w-4xl"
      >
        <FormNoticia
          noticia={noticiaEditando}
          onSave={handleSave}
          onClose={() => {
            setModalOpen(false)
            setNoticiaEditando(null)
          }}
        />
      </Modal>

      {/* Modal Confirmación */}
      {ModalComponent}
    </div>
  )
}

// ============ FORM NOTICIA ============
function FormNoticia({ noticia, onClose, onSave }) {
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
      : '',
    actividadId: noticia?.actividadId || null,
    categoriaActividadId: noticia?.categoriaActividadId || null
  })
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('contenido')
  const [actividades, setActividades] = useState([])
  const [categorias, setCategorias] = useState([])

  useEffect(() => {
    fetchActividades()
  }, [])

  useEffect(() => {
    if (form.actividadId) {
      fetchCategorias(form.actividadId)
    } else {
      setCategorias([])
      setForm(prev => ({ ...prev, categoriaActividadId: null }))
    }
  }, [form.actividadId])

  const fetchActividades = async () => {
    try {
      const data = await api.get('/admin/actividades?activo=true')
      setActividades(data || [])
    } catch (err) {
      console.error('Error cargando actividades:', err)
    }
  }

  const fetchCategorias = async (actividadId) => {
    try {
      const data = await api.get(`/admin/actividades/${actividadId}`)
      setCategorias(data?.categorias || [])
    } catch (err) {
      console.error('Error cargando categorías:', err)
      setCategorias([])
    }
  }

  const handleImageUpload = async (file) => {
    if (!file) return

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
    <>
      {/* Tabs */}
      <div className="flex items-center justify-center gap-2 mb-4 border-b pb-2">
        <button
          type="button"
          onClick={() => setTab('contenido')}
          className={`px-4 py-2 text-sm rounded-lg transition-colors ${
            tab === 'contenido' ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Editar
        </button>
        <button
          type="button"
          onClick={() => setTab('preview')}
          className={`px-4 py-2 text-sm rounded-lg transition-colors ${
            tab === 'preview' ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Vista previa
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {tab === 'contenido' ? (
          <div className="space-y-4">
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
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
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
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
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
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary font-mono text-sm"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Imagen principal
                </label>
                <ImageUpload
                  value={form.imagen}
                  onChange={handleImageUpload}
                  placeholder="Subir imagen de la noticia"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  maxSize={5 * 1024 * 1024}
                  previewSize="lg"
                  onError={(error) => toast.error(error)}
                  returnFile={true}
                />
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoría
                </label>
                <select
                  value={form.categoria}
                  onChange={e => setForm({ ...form, categoria: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                >
                  {CATEGORIAS.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              {/* Actividad Deportiva (opcional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Actividad Deportiva
                  <span className="text-xs text-gray-500 ml-1">(opcional)</span>
                </label>
                <select
                  value={form.actividadId || ''}
                  onChange={e => setForm({ ...form, actividadId: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                >
                  <option value="">-- Ninguna --</option>
                  {actividades.map(act => (
                    <option key={act.id} value={act.id}>{act.nombre}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Asociar esta noticia a un deporte específico
                </p>
              </div>

              {/* Categoría de Actividad (si hay actividad seleccionada) */}
              {form.actividadId && categorias.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoría
                    <span className="text-xs text-gray-500 ml-1">(opcional)</span>
                  </label>
                  <select
                    value={form.categoriaActividadId || ''}
                    onChange={e => setForm({ ...form, categoriaActividadId: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                  >
                    <option value="">-- Todas las categorías --</option>
                    {categorias.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Ej: Sub 10, Sub 12, etc.
                  </p>
                </div>
              )}

              {/* Fecha publicación */}
              <div className={form.actividadId && categorias.length > 0 ? '' : 'md:col-start-2'}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de publicación
                </label>
                <input
                  type="datetime-local"
                  value={form.fechaPublicacion}
                  onChange={e => setForm({ ...form, fechaPublicacion: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
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
        )}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t flex justify-between items-center">
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
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors"
            >
              {saving ? 'Guardando...' : (form.id ? 'Actualizar' : 'Crear')}
            </button>
          </div>
        </div>
      </form>
    </>
  )
}
