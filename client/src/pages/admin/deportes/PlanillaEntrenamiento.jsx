import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Save, ClipboardList } from 'lucide-react'
import api from '../../../services/api'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { tienePermiso, PERMISOS } from '../../../services/permisos'

const INTENSIDADES = ['BAJA', 'MEDIA', 'ALTA', 'MAXIMA']
const INTENSIDAD_COLOR = { BAJA: 'bg-green-100 text-green-700', MEDIA: 'bg-yellow-100 text-yellow-700', ALTA: 'bg-orange-100 text-orange-700', MAXIMA: 'bg-red-100 text-red-700' }

const ejercicioVacio = () => ({ nombre: '', descripcion: '', series: '', repeticiones: '', duracion: '', intensidad: 'MEDIA' })

export default function PlanillaEntrenamiento() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [entrenamiento, setEntrenamiento] = useState(null)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const [form, setForm] = useState({
    objetivos: '',
    calentamiento: '',
    ejercicios: [ejercicioVacio()],
    vueltaCalma: '',
    observaciones: '',
  })

  useEffect(() => { cargarDatos() }, [id])

  const cargarDatos = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/admin/entrenamientos/${id}/planilla`)
      const data = res.data || res
      setEntrenamiento(data)
      if (data.planilla) {
        setForm({
          objetivos: data.planilla.objetivos || '',
          calentamiento: data.planilla.calentamiento || '',
          ejercicios: data.planilla.ejercicios ? JSON.parse(data.planilla.ejercicios) : [ejercicioVacio()],
          vueltaCalma: data.planilla.vueltaCalma || '',
          observaciones: data.planilla.observaciones || '',
        })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGuardar = async () => {
    setGuardando(true)
    setError(null)
    try {
      const ejerciciosFiltrados = form.ejercicios.filter(e => e.nombre.trim())
      await api.put(`/admin/entrenamientos/${id}/planilla`, {
        ...form,
        ejercicios: ejerciciosFiltrados,
      })
      setSuccess('Planilla guardada')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const addEjercicio = () => setForm({ ...form, ejercicios: [...form.ejercicios, ejercicioVacio()] })

  const updateEjercicio = (idx, field, value) => {
    const ejs = [...form.ejercicios]
    ejs[idx] = { ...ejs[idx], [field]: value }
    setForm({ ...form, ejercicios: ejs })
  }

  const removeEjercicio = (idx) => setForm({ ...form, ejercicios: form.ejercicios.filter((_, i) => i !== idx) })

  if (loading) return <LoadingSpinner />

  const fecha = entrenamiento?.fecha ? new Date(entrenamiento.fecha).toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long' }) : ''

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <ClipboardList className="w-6 h-6 text-primary" />
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Planilla de entrenamiento</h1>
          <p className="text-sm text-gray-500 capitalize">
            {fecha} · {entrenamiento?.horaInicio} - {entrenamiento?.horaFin} · {entrenamiento?.categoriaActividad?.actividad?.nombre} — {entrenamiento?.categoriaActividad?.nombre}
          </p>
        </div>
        {tienePermiso(PERMISOS.DEPORTES_EDITAR) && (
          <button onClick={handleGuardar} disabled={guardando} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition disabled:opacity-50">
            <Save className="w-4 h-4" />
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        )}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>}

      <div className="space-y-5">
        {/* Objetivos */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <label className="block text-sm font-semibold text-gray-800 mb-2">Objetivos de la sesión</label>
          <textarea
            value={form.objetivos}
            onChange={e => setForm({ ...form, objetivos: e.target.value })}
            className="input-field w-full h-20 resize-none"
            placeholder="Ej: Mejorar la resistencia aeróbica y trabajo de pase corto..."
            readOnly={!tienePermiso(PERMISOS.DEPORTES_EDITAR)}
          />
        </div>

        {/* Calentamiento */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <label className="block text-sm font-semibold text-gray-800 mb-2">Calentamiento</label>
          <textarea
            value={form.calentamiento}
            onChange={e => setForm({ ...form, calentamiento: e.target.value })}
            className="input-field w-full h-16 resize-none"
            placeholder="Ej: 10 min trote suave, movilidad articular..."
            readOnly={!tienePermiso(PERMISOS.DEPORTES_EDITAR)}
          />
        </div>

        {/* Ejercicios */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Ejercicios principales</h2>
            {tienePermiso(PERMISOS.DEPORTES_EDITAR) && (
              <button onClick={addEjercicio} className="flex items-center gap-1 text-sm text-primary hover:underline">
                <Plus className="w-4 h-4" />
                Agregar
              </button>
            )}
          </div>

          {form.ejercicios.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No hay ejercicios. Agregá uno.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {form.ejercicios.map((ej, idx) => (
                <div key={idx} className="p-5">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1">
                      {idx + 1}
                    </span>
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <input
                          type="text"
                          value={ej.nombre}
                          onChange={e => updateEjercicio(idx, 'nombre', e.target.value)}
                          className="input-field w-full"
                          placeholder="Nombre del ejercicio"
                          readOnly={!tienePermiso(PERMISOS.DEPORTES_EDITAR)}
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          value={ej.descripcion}
                          onChange={e => updateEjercicio(idx, 'descripcion', e.target.value)}
                          className="input-field w-full text-sm"
                          placeholder="Descripción / variante"
                          readOnly={!tienePermiso(PERMISOS.DEPORTES_EDITAR)}
                        />
                      </div>
                      <div>
                        <select
                          value={ej.intensidad}
                          onChange={e => updateEjercicio(idx, 'intensidad', e.target.value)}
                          className="input-field w-full text-sm"
                          disabled={!tienePermiso(PERMISOS.DEPORTES_EDITAR)}
                        >
                          {INTENSIDADES.map(i => <option key={i} value={i}>{i}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={ej.series}
                          onChange={e => updateEjercicio(idx, 'series', e.target.value)}
                          className="input-field w-16 text-sm"
                          placeholder="S"
                          min="1"
                          readOnly={!tienePermiso(PERMISOS.DEPORTES_EDITAR)}
                        />
                        <span className="text-gray-400 text-sm">series ×</span>
                        <input
                          type="number"
                          value={ej.repeticiones}
                          onChange={e => updateEjercicio(idx, 'repeticiones', e.target.value)}
                          className="input-field w-16 text-sm"
                          placeholder="R"
                          min="1"
                          readOnly={!tienePermiso(PERMISOS.DEPORTES_EDITAR)}
                        />
                        <span className="text-gray-400 text-sm">reps</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={ej.duracion}
                          onChange={e => updateEjercicio(idx, 'duracion', e.target.value)}
                          className="input-field flex-1 text-sm"
                          placeholder="Duración (ej: 5 min)"
                          readOnly={!tienePermiso(PERMISOS.DEPORTES_EDITAR)}
                        />
                      </div>
                    </div>
                    {tienePermiso(PERMISOS.DEPORTES_EDITAR) && (
                      <button onClick={() => removeEjercicio(idx)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition flex-shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {ej.intensidad && (
                    <div className="mt-2 ml-9">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${INTENSIDAD_COLOR[ej.intensidad] || ''}`}>{ej.intensidad}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Vuelta a la calma */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <label className="block text-sm font-semibold text-gray-800 mb-2">Vuelta a la calma</label>
          <textarea
            value={form.vueltaCalma}
            onChange={e => setForm({ ...form, vueltaCalma: e.target.value })}
            className="input-field w-full h-16 resize-none"
            placeholder="Ej: Elongación estática 10 min, ejercicios de respiración..."
            readOnly={!tienePermiso(PERMISOS.DEPORTES_EDITAR)}
          />
        </div>

        {/* Observaciones */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <label className="block text-sm font-semibold text-gray-800 mb-2">Observaciones</label>
          <textarea
            value={form.observaciones}
            onChange={e => setForm({ ...form, observaciones: e.target.value })}
            className="input-field w-full h-16 resize-none"
            placeholder="Notas adicionales..."
            readOnly={!tienePermiso(PERMISOS.DEPORTES_EDITAR)}
          />
        </div>
      </div>
    </div>
  )
}
