import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Wrench } from 'lucide-react'
import { Button } from '../../../components/Button'
import { useModal } from '../../../components/Modal'
import api from '../../../services/api'
import LoadingSpinner from '../../../components/LoadingSpinner'

const TIPOS = [
  { value: 'CORRECTIVO', label: 'Correctivo (algo se rompió)' },
  { value: 'PREVENTIVO', label: 'Preventivo (mantenimiento programado)' },
  { value: 'MEJORA',     label: 'Mejora' }
]
const PRIORIDADES = [
  { value: 'BAJA',    label: 'Baja' },
  { value: 'MEDIA',   label: 'Media' },
  { value: 'ALTA',    label: 'Alta' },
  { value: 'URGENTE', label: 'Urgente' }
]

export default function OrdenTrabajoForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = !!id
  const { showModal, ModalComponent } = useModal()

  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [responsables, setResponsables] = useState([])
  const [espacios, setEspacios] = useState([])
  const [centrosCosto, setCentrosCosto] = useState([])

  const [form, setForm] = useState({
    titulo: '',
    descripcion: '',
    tipo: 'CORRECTIVO',
    prioridad: 'MEDIA',
    ubicacion: '',
    espacioId: '',
    responsableId: '',
    centroCostoId: '',
    costoEstimado: ''
  })

  useEffect(() => {
    cargarMaestros()
    if (isEditing) cargarOrden()
  }, [id])

  async function cargarMaestros() {
    try {
      const [entData, espData, ccData] = await Promise.all([
        api.getFull('/admin/entidades?activo=true&limit=500'),
        api.get('/admin/espacios-deportivos').catch(() => []),
        api.get('/admin/centros-costo').catch(() => [])
      ])
      const entidades = entData?.data || entData || []
      setResponsables(entidades.filter(e => e.tipo === 'PERSONAL' || e.tipo === 'PROVEEDOR'))
      setEspacios(Array.isArray(espData) ? espData : (espData?.data || []))
      setCentrosCosto(Array.isArray(ccData) ? ccData : (ccData?.data || []))
    } catch (err) {
      console.error('Error cargando maestros:', err)
    }
  }

  async function cargarOrden() {
    try {
      const o = await api.get(`/admin/mantenimiento/${id}`)
      setForm({
        titulo: o.titulo || '',
        descripcion: o.descripcion || '',
        tipo: o.tipo || 'CORRECTIVO',
        prioridad: o.prioridad || 'MEDIA',
        ubicacion: o.ubicacion || '',
        espacioId: o.espacioId || '',
        responsableId: o.responsableId || '',
        centroCostoId: o.centroCostoId || '',
        costoEstimado: o.costoEstimado != null ? String(o.costoEstimado) : ''
      })
    } catch (err) {
      showModal({ type: 'error', message: 'Error cargando la orden' })
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.titulo.trim()) {
      showModal({ type: 'warning', message: 'El título es requerido' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        titulo: form.titulo,
        descripcion: form.descripcion || null,
        tipo: form.tipo,
        prioridad: form.prioridad,
        ubicacion: form.ubicacion || null,
        espacioId: form.espacioId || null,
        responsableId: form.responsableId || null,
        centroCostoId: form.centroCostoId || null,
        costoEstimado: form.costoEstimado || null
      }
      const saved = isEditing
        ? await api.put(`/admin/mantenimiento/${id}`, payload)
        : await api.post('/admin/mantenimiento', payload)
      navigate(`/admin/mantenimiento/${saved.id}`)
    } catch (err) {
      showModal({ type: 'error', message: err.message || 'Error al guardar' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      {ModalComponent}

      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gray-100">
            <Wrench className="w-6 h-6 text-gray-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">
            {isEditing ? 'Editar Orden de Trabajo' : 'Nueva Orden de Trabajo'}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Detalle del trabajo</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
              <input
                type="text"
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                placeholder="Ej: Pintar vestuarios — pared con humedad"
                className="input-field w-full"
                required
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                rows="3"
                placeholder="Detalle del problema, instrucciones, observaciones..."
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="input-field w-full">
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
              <select value={form.prioridad} onChange={(e) => setForm({ ...form, prioridad: e.target.value })} className="input-field w-full">
                {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Costo estimado</label>
              <input
                type="number"
                step="0.01"
                value={form.costoEstimado}
                onChange={(e) => setForm({ ...form, costoEstimado: e.target.value })}
                placeholder="Opcional"
                className="input-field w-full"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Ubicación y asignación</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Espacio deportivo</label>
              <select value={form.espacioId} onChange={(e) => setForm({ ...form, espacioId: e.target.value })} className="input-field w-full">
                <option value="">Sin espacio específico</option>
                {espacios.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
              <p className="text-xs text-gray-500 mt-1">Cancha, gimnasio, vestuario, etc.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación (texto libre)</label>
              <input
                type="text"
                value={form.ubicacion}
                onChange={(e) => setForm({ ...form, ubicacion: e.target.value })}
                placeholder="Ej: depósito, oficina admin, salón..."
                className="input-field w-full"
              />
              <p className="text-xs text-gray-500 mt-1">Si no es un espacio cargado en Deportes</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Responsable</label>
              <select value={form.responsableId} onChange={(e) => setForm({ ...form, responsableId: e.target.value })} className="input-field w-full">
                <option value="">Sin asignar</option>
                <optgroup label="Personal">
                  {responsables.filter(r => r.tipo === 'PERSONAL').map(r => (
                    <option key={r.id} value={r.id}>{r.razonSocial}</option>
                  ))}
                </optgroup>
                <optgroup label="Proveedores">
                  {responsables.filter(r => r.tipo === 'PROVEEDOR').map(r => (
                    <option key={r.id} value={r.id}>{r.razonSocial}</option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Centro de costo</label>
              <select value={form.centroCostoId} onChange={(e) => setForm({ ...form, centroCostoId: e.target.value })} className="input-field w-full">
                <option value="">Sin imputar</option>
                {centrosCosto.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="secondary" onClick={() => navigate('/admin/mantenimiento')}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            <Save className="w-4 h-4 mr-2" />
            {isEditing ? 'Guardar cambios' : 'Crear orden'}
          </Button>
        </div>
      </form>
    </div>
  )
}
