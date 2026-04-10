import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, Save, Trash2, Download, Paperclip, X } from 'lucide-react'
import api from '../../../services/api'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { tienePermiso, PERMISOS } from '../../../services/permisos'

const TIPOS = ['COMISION', 'ASAMBLEA', 'DIRECTIVA', 'OTRO']
const ESTADOS = ['BORRADOR', 'FIRMADA', 'ARCHIVADA']

const formVacio = {
  titulo: '', tipo: 'COMISION', fecha: '', lugar: '', asistentes: '',
  temario: '', contenido: '', resoluciones: '', estado: 'BORRADOR',
}

export default function ActaDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNueva = id === 'nueva'
  const [form, setForm] = useState(formVacio)
  const [acta, setActa] = useState(null)
  const [loading, setLoading] = useState(!isNueva)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Adjunto
  const [archivoAdjunto, setArchivoAdjunto] = useState(null)
  const [subiendoAdjunto, setSubiendoAdjunto] = useState(false)
  const [eliminandoAdjunto, setEliminandoAdjunto] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    if (!isNueva) cargar()
  }, [id])

  const cargar = async () => {
    setLoading(true)
    try {
      const data = await api.get(`/admin/gobernanza/actas/${id}`)
      const a = data.data || data
      setActa(a)
      setForm({
        titulo: a.titulo || '',
        tipo: a.tipo || 'COMISION',
        fecha: a.fecha ? a.fecha.slice(0, 10) : '',
        lugar: a.lugar || '',
        asistentes: a.asistentes || '',
        temario: a.temario || '',
        contenido: a.contenido || '',
        resoluciones: a.resoluciones || '',
        estado: a.estado || 'BORRADOR',
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGuardar = async () => {
    if (!form.titulo || !form.fecha) return setError('Título y fecha son requeridos')
    setGuardando(true)
    setError(null)
    try {
      if (isNueva) {
        const res = await api.post('/admin/gobernanza/actas', form)
        const nueva = res.data || res
        navigate(`/admin/gobernanza/actas/${nueva.id}`, { replace: true })
      } else {
        await api.put(`/admin/gobernanza/actas/${id}`, form)
        setSuccess('Acta guardada')
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const handleEliminar = async () => {
    if (!confirm('¿Eliminar esta acta? Esta acción no se puede deshacer.')) return
    try {
      await api.delete(`/admin/gobernanza/actas/${id}`)
      navigate('/admin/gobernanza/actas')
    } catch (err) {
      setError(err.message)
    }
  }

  const handleSubirAdjunto = async () => {
    if (!archivoAdjunto) return
    setSubiendoAdjunto(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('archivo', archivoAdjunto)
      const res = await api.post(`/admin/gobernanza/actas/${id}/adjunto`, fd)
      setActa(res.data || res)
      setArchivoAdjunto(null)
      if (fileRef.current) fileRef.current.value = ''
      setSuccess('Adjunto subido correctamente')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubiendoAdjunto(false)
    }
  }

  const handleEliminarAdjunto = async () => {
    if (!confirm('¿Eliminar el archivo adjunto?')) return
    setEliminandoAdjunto(true)
    try {
      await api.delete(`/admin/gobernanza/actas/${id}/adjunto`)
      setActa(a => ({ ...a, adjuntoUrl: null, adjuntoNombre: null }))
      setSuccess('Adjunto eliminado')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setEliminandoAdjunto(false)
    }
  }

  const handleDescargar = async () => {
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
      const hostname = window.location.hostname
      const match = hostname.match(/^([^.]+)\.localhost/)
      if (match) headers['X-Tenant-Slug'] = match[1]
      const response = await fetch(`/api/admin/gobernanza/actas/${id}/descargar`, { headers })
      const blob = await response.blob()
      const cd = response.headers.get('content-disposition')
      const filename = cd?.split('filename=')[1]?.replace(/"/g, '') || acta?.adjuntoNombre || 'adjunto'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    }
  }

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))
  const canEdit = tienePermiso(PERMISOS.CONFIG_EDITAR)

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/gobernanza/actas')} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="p-2 bg-primary/10 rounded-lg">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{isNueva ? 'Nueva acta' : form.titulo || 'Acta'}</h1>
            <p className="text-sm text-gray-500">Acta de reunión</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isNueva && canEdit && (
            <button onClick={handleEliminar} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {canEdit && (
            <button
              onClick={handleGuardar}
              disabled={guardando}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          )}
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>}

      <div className="space-y-4">
        {/* Datos básicos */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Datos del acta</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Título *</label>
              <input
                type="text"
                value={form.titulo}
                onChange={e => set('titulo', e.target.value)}
                className="input-field w-full"
                placeholder="Ej: Reunión de Comisión Directiva — Enero 2026"
                readOnly={!canEdit}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo</label>
                <select value={form.tipo} onChange={e => set('tipo', e.target.value)} className="input-field w-full" disabled={!canEdit}>
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha *</label>
                <input
                  type="date"
                  value={form.fecha}
                  onChange={e => set('fecha', e.target.value)}
                  className="input-field w-full"
                  readOnly={!canEdit}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Estado</label>
                <select value={form.estado} onChange={e => set('estado', e.target.value)} className="input-field w-full" disabled={!canEdit}>
                  {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Lugar</label>
              <input
                type="text"
                value={form.lugar}
                onChange={e => set('lugar', e.target.value)}
                className="input-field w-full"
                placeholder="Sala de reuniones, sede central..."
                readOnly={!canEdit}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Asistentes</label>
              <textarea
                value={form.asistentes}
                onChange={e => set('asistentes', e.target.value)}
                className="input-field w-full h-16 resize-none"
                placeholder="Nombres y cargos de los presentes..."
                readOnly={!canEdit}
              />
            </div>
          </div>
        </div>

        {/* Contenido */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Contenido</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Temario</label>
              <textarea
                value={form.temario}
                onChange={e => set('temario', e.target.value)}
                className="input-field w-full h-20 resize-none"
                placeholder="Puntos del orden del día..."
                readOnly={!canEdit}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Desarrollo del acta</label>
              <textarea
                value={form.contenido}
                onChange={e => set('contenido', e.target.value)}
                className="input-field w-full h-40 resize-none"
                placeholder="Cuerpo del acta, lo tratado en la reunión..."
                readOnly={!canEdit}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Resoluciones</label>
              <textarea
                value={form.resoluciones}
                onChange={e => set('resoluciones', e.target.value)}
                className="input-field w-full h-20 resize-none"
                placeholder="Decisiones tomadas, próximas acciones..."
                readOnly={!canEdit}
              />
            </div>
          </div>
        </div>

        {/* Adjunto */}
        {!isNueva && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-3">Documento adjunto</h2>

            {acta?.adjuntoUrl ? (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <Paperclip className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="flex-1 text-sm text-gray-700 truncate">{acta.adjuntoNombre || 'Archivo adjunto'}</span>
                <button
                  onClick={handleDescargar}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-primary border border-primary rounded-lg hover:bg-primary/5 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar
                </button>
                {canEdit && (
                  <button
                    onClick={handleEliminarAdjunto}
                    disabled={eliminandoAdjunto}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400 mb-3">Sin adjunto</p>
            )}

            {canEdit && (
              <div className="mt-3 flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                  onChange={e => setArchivoAdjunto(e.target.files[0] || null)}
                  className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-gray-200 file:text-sm file:text-gray-600 file:bg-white hover:file:bg-gray-50"
                />
                {archivoAdjunto && (
                  <button
                    onClick={handleSubirAdjunto}
                    disabled={subiendoAdjunto}
                    className="px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
                  >
                    {subiendoAdjunto ? 'Subiendo...' : acta?.adjuntoUrl ? 'Reemplazar' : 'Subir'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
