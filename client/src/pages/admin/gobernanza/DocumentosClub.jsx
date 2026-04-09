import { useState, useEffect } from 'react'
import { FolderOpen, Plus, Trash2, ExternalLink, Edit2, Save, X } from 'lucide-react'
import api from '../../../services/api'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { tienePermiso, PERMISOS } from '../../../services/permisos'

const CATEGORIAS = ['GENERAL', 'ESTATUTO', 'REGLAMENTO', 'ACTA', 'CONTRATO']
const CAT_COLOR = {
  GENERAL: 'bg-gray-100 text-gray-600',
  ESTATUTO: 'bg-blue-100 text-blue-700',
  REGLAMENTO: 'bg-indigo-100 text-indigo-700',
  ACTA: 'bg-purple-100 text-purple-700',
  CONTRATO: 'bg-orange-100 text-orange-700',
}

const docVacio = () => ({ nombre: '', descripcion: '', categoria: 'GENERAL', url: '', publico: false })

export default function DocumentosClub() {
  const [documentos, setDocumentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(docVacio())
  const [editingId, setEditingId] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => { cargar() }, [filtroCategoria])

  const cargar = async () => {
    setLoading(true)
    try {
      const params = filtroCategoria ? `?categoria=${filtroCategoria}` : ''
      const data = await api.get(`/admin/gobernanza/documentos-club${params}`)
      setDocumentos(data.data || data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const mostrarExito = (msg) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3000)
  }

  const handleGuardar = async () => {
    if (!form.nombre || !form.url) return setError('Nombre y URL son requeridos')
    setGuardando(true)
    setError(null)
    try {
      if (editingId) {
        await api.put(`/admin/gobernanza/documentos-club/${editingId}`, form)
        mostrarExito('Documento actualizado')
      } else {
        await api.post('/admin/gobernanza/documentos-club', form)
        mostrarExito('Documento agregado')
      }
      await cargar()
      setShowForm(false)
      setEditingId(null)
      setForm(docVacio())
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const handleEditar = (doc) => {
    setForm({ nombre: doc.nombre, descripcion: doc.descripcion || '', categoria: doc.categoria, url: doc.url, publico: doc.publico })
    setEditingId(doc.id)
    setShowForm(true)
  }

  const handleEliminar = async (docId) => {
    if (!confirm('¿Eliminar este documento?')) return
    try {
      await api.delete(`/admin/gobernanza/documentos-club/${docId}`)
      setDocumentos(documentos.filter(d => d.id !== docId))
    } catch (err) {
      setError(err.message)
    }
  }

  const canEdit = tienePermiso(PERMISOS.CONFIG_EDITAR)
  const set = (f, v) => setForm(prev => ({ ...prev, [f]: v }))

  // Agrupar por categoría
  const grupos = CATEGORIAS.reduce((acc, cat) => {
    const items = documentos.filter(d => d.categoria === cat)
    if (items.length) acc[cat] = items
    return acc
  }, {})

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FolderOpen className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold text-gray-900">Documentos del club</h1>
        </div>
        {canEdit && (
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setForm(docVacio()) }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition"
          >
            <Plus className="w-4 h-4" />
            Agregar documento
          </button>
        )}
      </div>

      {/* Filtro categoría */}
      <div className="flex flex-wrap gap-2 mb-5">
        {['', ...CATEGORIAS].map(cat => (
          <button
            key={cat}
            onClick={() => setFiltroCategoria(cat)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${filtroCategoria === cat ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {cat || 'Todos'}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>}

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-blue-200 p-5 mb-5 space-y-3">
          <h2 className="font-semibold text-gray-800">{editingId ? 'Editar documento' : 'Nuevo documento'}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre *</label>
              <input type="text" value={form.nombre} onChange={e => set('nombre', e.target.value)} className="input-field w-full" placeholder="Ej: Estatuto Social 2024" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Categoría</label>
              <select value={form.categoria} onChange={e => set('categoria', e.target.value)} className="input-field w-full">
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={form.publico} onChange={e => set('publico', e.target.checked)} className="rounded border-gray-300 text-primary" />
                Visible en sitio público
              </label>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">URL del documento *</label>
              <input type="url" value={form.url} onChange={e => set('url', e.target.value)} className="input-field w-full" placeholder="https://..." />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Descripción</label>
              <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)} className="input-field w-full h-14 resize-none" placeholder="Descripción breve..." />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowForm(false); setEditingId(null) }} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
            <button onClick={handleGuardar} disabled={guardando} className="flex items-center gap-1 px-4 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50">
              <Save className="w-3.5 h-3.5" />
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {loading ? <LoadingSpinner /> : (
        documentos.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
            No hay documentos cargados
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grupos).map(([cat, items]) => (
              <div key={cat}>
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{cat}</h2>
                <div className="space-y-2">
                  {items.map(doc => (
                    <div key={doc.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CAT_COLOR[doc.categoria] || ''}`}>{doc.categoria}</span>
                          {doc.publico && <span className="text-xs text-green-600">Público</span>}
                        </div>
                        <p className="font-semibold text-gray-800">{doc.nombre}</p>
                        {doc.descripcion && <p className="text-sm text-gray-500">{doc.descripcion}</p>}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <a href={doc.url} target="_blank" rel="noreferrer" className="p-1.5 text-gray-400 hover:text-primary hover:bg-blue-50 rounded transition">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        {canEdit && (
                          <>
                            <button onClick={() => handleEditar(doc)} className="p-1.5 text-gray-400 hover:text-primary hover:bg-blue-50 rounded transition">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleEliminar(doc.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
