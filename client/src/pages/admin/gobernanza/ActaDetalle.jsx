import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, Save, Trash2, ExternalLink } from 'lucide-react'
import api from '../../../services/api'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { tienePermiso, PERMISOS } from '../../../services/permisos'

const TIPOS = ['COMISION', 'ASAMBLEA', 'DIRECTIVA', 'OTRO']
const ESTADOS = ['BORRADOR', 'FIRMADA', 'ARCHIVADA']

const formVacio = {
  titulo: '', tipo: 'COMISION', fecha: '', lugar: '', asistentes: '',
  temario: '', contenido: '', resoluciones: '', adjuntoUrl: '', estado: 'BORRADOR',
}

export default function ActaDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNueva = id === 'nueva'
  const [form, setForm] = useState(formVacio)
  const [loading, setLoading] = useState(!isNueva)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    if (!isNueva) cargar()
  }, [id])

  const cargar = async () => {
    setLoading(true)
    try {
      const data = await api.get(`/admin/gobernanza/actas/${id}`)
      const acta = data.data || data
      setForm({
        titulo: acta.titulo || '',
        tipo: acta.tipo || 'COMISION',
        fecha: acta.fecha ? acta.fecha.slice(0, 10) : '',
        lugar: acta.lugar || '',
        asistentes: acta.asistentes || '',
        temario: acta.temario || '',
        contenido: acta.contenido || '',
        resoluciones: acta.resoluciones || '',
        adjuntoUrl: acta.adjuntoUrl || '',
        estado: acta.estado || 'BORRADOR',
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

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))
  const canEdit = tienePermiso(PERMISOS.CONFIG_EDITAR)

  if (loading) return <LoadingSpinner />

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/admin/gobernanza/actas')} className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <FileText className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold text-gray-900 flex-1">
          {isNueva ? 'Nueva acta' : form.titulo || 'Acta'}
        </h1>
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
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Documento adjunto</h2>
          <div className="flex items-center gap-3">
            <input
              type="url"
              value={form.adjuntoUrl}
              onChange={e => set('adjuntoUrl', e.target.value)}
              className="input-field flex-1"
              placeholder="URL del PDF firmado..."
              readOnly={!canEdit}
            />
            {form.adjuntoUrl && (
              <a href={form.adjuntoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm text-primary hover:underline flex-shrink-0">
                <ExternalLink className="w-4 h-4" />
                Ver
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
