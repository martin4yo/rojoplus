import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Heart, Plus, Trash2, Save, ShieldCheck, AlertTriangle } from 'lucide-react'
import api from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'
import { tienePermiso, PERMISOS } from '../../services/permisos'

const ESTADOS_APTITUD = ['PENDIENTE', 'APTO', 'CONDICIONAL', 'NO_APTO']
const ESTADO_COLOR = {
  PENDIENTE: 'bg-gray-100 text-gray-600',
  APTO: 'bg-green-100 text-green-700',
  CONDICIONAL: 'bg-yellow-100 text-yellow-700',
  NO_APTO: 'bg-red-100 text-red-700',
}
const GRAVEDADES = ['LEVE', 'MODERADA', 'GRAVE']
const GRAVEDAD_COLOR = {
  LEVE: 'bg-blue-100 text-blue-700',
  MODERADA: 'bg-yellow-100 text-yellow-700',
  GRAVE: 'bg-red-100 text-red-700',
}

const fichaVacia = {
  grupoSanguineo: '', alergias: '', medicamentos: '',
  condicionesCronicas: '', contactoEmergencia: '', telefonoEmergencia: '',
}

const aptitudVacia = () => ({
  estado: 'PENDIENTE', fechaEstudio: '', vencimiento: '', medico: '', observaciones: '',
})

const lesionVacia = () => ({
  tipo: '', descripcion: '', fechaLesion: '', fechaAlta: '', gravedad: 'LEVE',
  tratamiento: '', restricciones: '', alta: false,
})

export default function SeguimientoMedico() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [socio, setSocio] = useState(null)
  const [ficha, setFicha] = useState(fichaVacia)
  const [aptitudes, setAptitudes] = useState([])
  const [lesiones, setLesiones] = useState([])
  const [tab, setTab] = useState('ficha')
  const [guardandoFicha, setGuardandoFicha] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Aptitud form
  const [showAptForm, setShowAptForm] = useState(false)
  const [aptForm, setAptForm] = useState(aptitudVacia())
  const [guardandoApt, setGuardandoApt] = useState(false)

  // Lesion form
  const [showLesionForm, setShowLesionForm] = useState(false)
  const [lesionForm, setLesionForm] = useState(lesionVacia())
  const [editingLesion, setEditingLesion] = useState(null)
  const [guardandoLesion, setGuardandoLesion] = useState(false)

  useEffect(() => { cargarDatos() }, [id])

  const cargarDatos = async () => {
    setLoading(true)
    try {
      const [socioRes, medicoRes] = await Promise.all([
        api.get(`/admin/socios/${id}`),
        api.get(`/admin/socios/${id}/medico`),
      ])
      const s = socioRes.data || socioRes
      const m = medicoRes.data || medicoRes
      setSocio(s)
      if (m.ficha) setFicha({ ...fichaVacia, ...m.ficha })
      setAptitudes(m.aptitudes || [])
      setLesiones(m.lesiones || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const mostrarExito = (msg) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3000)
  }

  const handleGuardarFicha = async () => {
    setGuardandoFicha(true)
    setError(null)
    try {
      await api.put(`/admin/socios/${id}/ficha-medica`, ficha)
      mostrarExito('Ficha guardada')
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardandoFicha(false)
    }
  }

  const handleGuardarAptitud = async () => {
    setGuardandoApt(true)
    setError(null)
    try {
      await api.post(`/admin/socios/${id}/aptitudes`, aptForm)
      await cargarDatos()
      setShowAptForm(false)
      setAptForm(aptitudVacia())
      mostrarExito('Aptitud registrada')
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardandoApt(false)
    }
  }

  const handleEliminarAptitud = async (aptId) => {
    if (!confirm('¿Eliminar este registro de aptitud?')) return
    try {
      await api.delete(`/admin/socios/${id}/aptitudes/${aptId}`)
      setAptitudes(aptitudes.filter(a => a.id !== aptId))
    } catch (err) {
      setError(err.message)
    }
  }

  const handleGuardarLesion = async () => {
    setGuardandoLesion(true)
    setError(null)
    try {
      if (editingLesion) {
        await api.put(`/admin/socios/${id}/lesiones/${editingLesion}`, lesionForm)
      } else {
        await api.post(`/admin/socios/${id}/lesiones`, lesionForm)
      }
      await cargarDatos()
      setShowLesionForm(false)
      setLesionForm(lesionVacia())
      setEditingLesion(null)
      mostrarExito(editingLesion ? 'Lesión actualizada' : 'Lesión registrada')
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardandoLesion(false)
    }
  }

  const handleEditarLesion = (lesion) => {
    setLesionForm({
      tipo: lesion.tipo || '',
      descripcion: lesion.descripcion || '',
      fechaLesion: lesion.fechaLesion ? lesion.fechaLesion.slice(0, 10) : '',
      fechaAlta: lesion.fechaAlta ? lesion.fechaAlta.slice(0, 10) : '',
      gravedad: lesion.gravedad || 'LEVE',
      tratamiento: lesion.tratamiento || '',
      restricciones: lesion.restricciones || '',
      alta: lesion.alta || false,
    })
    setEditingLesion(lesion.id)
    setShowLesionForm(true)
  }

  const handleEliminarLesion = async (lesionId) => {
    if (!confirm('¿Eliminar este registro de lesión?')) return
    try {
      await api.delete(`/admin/socios/${id}/lesiones/${lesionId}`)
      setLesiones(lesiones.filter(l => l.id !== lesionId))
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <LoadingSpinner />

  const canEdit = tienePermiso(PERMISOS.SOCIOS_EDITAR)
  const nombreSocio = socio ? `${socio.apellido}, ${socio.nombre}` : ''

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <Heart className="w-6 h-6 text-red-500" />
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Seguimiento médico</h1>
          <p className="text-sm text-gray-500">{nombreSocio}</p>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 gap-1">
        {[
          { key: 'ficha', label: 'Ficha médica' },
          { key: 'aptitud', label: 'Aptitud física' },
          { key: 'lesiones', label: 'Lesiones' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Ficha médica */}
      {tab === 'ficha' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Grupo sanguíneo</label>
              <input
                type="text"
                value={ficha.grupoSanguineo}
                onChange={e => setFicha({ ...ficha, grupoSanguineo: e.target.value })}
                className="input-field w-full"
                placeholder="Ej: A+"
                readOnly={!canEdit}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Contacto de emergencia</label>
              <input
                type="text"
                value={ficha.contactoEmergencia}
                onChange={e => setFicha({ ...ficha, contactoEmergencia: e.target.value })}
                className="input-field w-full"
                placeholder="Nombre y relación"
                readOnly={!canEdit}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Teléfono de emergencia</label>
              <input
                type="text"
                value={ficha.telefonoEmergencia}
                onChange={e => setFicha({ ...ficha, telefonoEmergencia: e.target.value })}
                className="input-field w-full"
                placeholder="Ej: +54 9 11..."
                readOnly={!canEdit}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Alergias</label>
            <textarea
              value={ficha.alergias}
              onChange={e => setFicha({ ...ficha, alergias: e.target.value })}
              className="input-field w-full h-16 resize-none"
              placeholder="Alergias conocidas..."
              readOnly={!canEdit}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Medicamentos</label>
            <textarea
              value={ficha.medicamentos}
              onChange={e => setFicha({ ...ficha, medicamentos: e.target.value })}
              className="input-field w-full h-16 resize-none"
              placeholder="Medicamentos habituales..."
              readOnly={!canEdit}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Condiciones crónicas</label>
            <textarea
              value={ficha.condicionesCronicas}
              onChange={e => setFicha({ ...ficha, condicionesCronicas: e.target.value })}
              className="input-field w-full h-16 resize-none"
              placeholder="Diabetes, hipertensión, asma, etc."
              readOnly={!canEdit}
            />
          </div>
          {canEdit && (
            <div className="flex justify-end">
              <button
                onClick={handleGuardarFicha}
                disabled={guardandoFicha}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {guardandoFicha ? 'Guardando...' : 'Guardar ficha'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Aptitud física */}
      {tab === 'aptitud' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">{aptitudes.length} {aptitudes.length === 1 ? 'registro' : 'registros'}</p>
            {canEdit && (
              <button
                onClick={() => { setShowAptForm(true); setAptForm(aptitudVacia()) }}
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Plus className="w-4 h-4" />
                Nuevo registro
              </button>
            )}
          </div>

          {showAptForm && (
            <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-5 space-y-3">
              <h3 className="font-semibold text-gray-800 text-sm">Nuevo registro de aptitud</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Estado</label>
                  <select
                    value={aptForm.estado}
                    onChange={e => setAptForm({ ...aptForm, estado: e.target.value })}
                    className="input-field w-full"
                  >
                    {ESTADOS_APTITUD.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Médico</label>
                  <input
                    type="text"
                    value={aptForm.medico}
                    onChange={e => setAptForm({ ...aptForm, medico: e.target.value })}
                    className="input-field w-full"
                    placeholder="Dr. ..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha del estudio</label>
                  <input
                    type="date"
                    value={aptForm.fechaEstudio}
                    onChange={e => setAptForm({ ...aptForm, fechaEstudio: e.target.value })}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Vencimiento</label>
                  <input
                    type="date"
                    value={aptForm.vencimiento}
                    onChange={e => setAptForm({ ...aptForm, vencimiento: e.target.value })}
                    className="input-field w-full"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Observaciones</label>
                  <textarea
                    value={aptForm.observaciones}
                    onChange={e => setAptForm({ ...aptForm, observaciones: e.target.value })}
                    className="input-field w-full h-14 resize-none"
                    placeholder="Restricciones, condiciones, etc."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowAptForm(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                <button
                  onClick={handleGuardarAptitud}
                  disabled={guardandoApt}
                  className="flex items-center gap-1 px-4 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {guardandoApt ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          )}

          {aptitudes.length === 0 && !showAptForm ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
              Sin registros de aptitud física
            </div>
          ) : (
            <div className="space-y-3">
              {aptitudes.map(apt => {
                const venc = apt.vencimiento ? new Date(apt.vencimiento) : null
                const vencido = venc && venc < new Date()
                return (
                  <div key={apt.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <ShieldCheck className={`w-5 h-5 ${apt.estado === 'APTO' ? 'text-green-500' : apt.estado === 'NO_APTO' ? 'text-red-500' : 'text-yellow-500'}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_COLOR[apt.estado] || ''}`}>{apt.estado}</span>
                            {vencido && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Vencido</span>}
                          </div>
                          <p className="text-sm text-gray-700 mt-1">
                            {apt.medico && <span className="font-medium">{apt.medico} · </span>}
                            {apt.fechaEstudio && <span>{new Date(apt.fechaEstudio).toLocaleDateString('es-AR')}</span>}
                            {apt.vencimiento && <span className="text-gray-500"> → {new Date(apt.vencimiento).toLocaleDateString('es-AR')}</span>}
                          </p>
                          {apt.observaciones && <p className="text-xs text-gray-500 mt-0.5">{apt.observaciones}</p>}
                        </div>
                      </div>
                      {canEdit && (
                        <button onClick={() => handleEliminarAptitud(apt.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Lesiones */}
      {tab === 'lesiones' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">{lesiones.length} {lesiones.length === 1 ? 'registro' : 'registros'}</p>
            {canEdit && (
              <button
                onClick={() => { setShowLesionForm(true); setLesionForm(lesionVacia()); setEditingLesion(null) }}
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Plus className="w-4 h-4" />
                Nueva lesión
              </button>
            )}
          </div>

          {showLesionForm && (
            <div className="bg-white rounded-xl shadow-sm border border-orange-200 p-5 space-y-3">
              <h3 className="font-semibold text-gray-800 text-sm">{editingLesion ? 'Editar lesión' : 'Nueva lesión'}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo</label>
                  <input
                    type="text"
                    value={lesionForm.tipo}
                    onChange={e => setLesionForm({ ...lesionForm, tipo: e.target.value })}
                    className="input-field w-full"
                    placeholder="Ej: Esguince, fractura..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Gravedad</label>
                  <select
                    value={lesionForm.gravedad}
                    onChange={e => setLesionForm({ ...lesionForm, gravedad: e.target.value })}
                    className="input-field w-full"
                  >
                    {GRAVEDADES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha de lesión</label>
                  <input
                    type="date"
                    value={lesionForm.fechaLesion}
                    onChange={e => setLesionForm({ ...lesionForm, fechaLesion: e.target.value })}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha de alta</label>
                  <input
                    type="date"
                    value={lesionForm.fechaAlta}
                    onChange={e => setLesionForm({ ...lesionForm, fechaAlta: e.target.value })}
                    className="input-field w-full"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Descripción</label>
                  <textarea
                    value={lesionForm.descripcion}
                    onChange={e => setLesionForm({ ...lesionForm, descripcion: e.target.value })}
                    className="input-field w-full h-14 resize-none"
                    placeholder="Descripción de la lesión..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Tratamiento</label>
                  <textarea
                    value={lesionForm.tratamiento}
                    onChange={e => setLesionForm({ ...lesionForm, tratamiento: e.target.value })}
                    className="input-field w-full h-14 resize-none"
                    placeholder="Tratamiento indicado..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Restricciones</label>
                  <textarea
                    value={lesionForm.restricciones}
                    onChange={e => setLesionForm({ ...lesionForm, restricciones: e.target.value })}
                    className="input-field w-full h-14 resize-none"
                    placeholder="Actividades restringidas..."
                  />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="chkAlta"
                    checked={lesionForm.alta}
                    onChange={e => setLesionForm({ ...lesionForm, alta: e.target.checked })}
                    className="rounded border-gray-300 text-primary"
                  />
                  <label htmlFor="chkAlta" className="text-sm text-gray-700">Lesión con alta médica</label>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => { setShowLesionForm(false); setEditingLesion(null) }} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                <button
                  onClick={handleGuardarLesion}
                  disabled={guardandoLesion}
                  className="flex items-center gap-1 px-4 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {guardandoLesion ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          )}

          {lesiones.length === 0 && !showLesionForm ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
              Sin registros de lesiones
            </div>
          ) : (
            <div className="space-y-3">
              {lesiones.map(lesion => (
                <div key={lesion.id} className={`bg-white rounded-xl shadow-sm border p-4 ${lesion.alta ? 'border-gray-200' : 'border-orange-200'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${lesion.alta ? 'text-gray-400' : 'text-orange-500'}`} />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-gray-800">{lesion.tipo || 'Lesión'}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${GRAVEDAD_COLOR[lesion.gravedad] || ''}`}>{lesion.gravedad}</span>
                          {lesion.alta && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Alta médica</span>}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {lesion.fechaLesion && <span>{new Date(lesion.fechaLesion).toLocaleDateString('es-AR')}</span>}
                          {lesion.fechaAlta && <span> → alta {new Date(lesion.fechaAlta).toLocaleDateString('es-AR')}</span>}
                        </p>
                        {lesion.descripcion && <p className="text-sm text-gray-700 mt-1">{lesion.descripcion}</p>}
                        {lesion.restricciones && <p className="text-xs text-orange-600 mt-0.5">Restricciones: {lesion.restricciones}</p>}
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => handleEditarLesion(lesion)} className="p-1.5 text-gray-400 hover:text-primary hover:bg-blue-50 rounded transition text-xs">Editar</button>
                        <button onClick={() => handleEliminarLesion(lesion.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
