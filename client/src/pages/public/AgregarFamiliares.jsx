import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import {
  ArrowRight, ArrowLeft, CheckCircle2, Trophy, Users, UserPlus,
  Trash2, X, Cake, Heart, Baby, AlertCircle,
} from 'lucide-react'
import { useConfirm } from '../../hooks/useConfirm'
import TenantLogo from '../../components/TenantLogo'
import { useTenant } from '../../contexts/TenantContext'

export default function AgregarFamiliares() {
  const { confirm, ConfirmDialog } = useConfirm()
  const { solicitudId } = useParams()
  const navigate = useNavigate()
  const { tenant } = useTenant()

  const [loading, setLoading] = useState(false)
  const [familiares, setFamiliares] = useState([])
  const [showForm, setShowForm] = useState(false)

  const [formData, setFormData] = useState({
    apellidos: '',
    nombres: '',
    documento: '',
    fechaNacimiento: '',
    parentesco: '',
    actividadesSeleccionadas: [],
  })

  const actividades = [
    'Basquet', 'Futbol 11', 'Futsal', 'Gimnasio', 'Kickboxing',
    'Liga Argentina de Baby Futbol', 'Natación', 'Socio sin actividad',
    'Taekwondo', 'Voley',
  ]

  useEffect(() => { cargarDatos() }, [])

  const cargarDatos = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/public/solicitud-socio/${solicitudId}/familiares`)
      if (!res.ok) throw new Error('Error al cargar los datos')
      const data = await res.json()
      setFamiliares(data.data || [])
    } catch (error) {
      console.error('Error cargando datos:', error)
      toast.error('Error al cargar los datos')
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleActividadChange = (actividad) => {
    setFormData(prev => {
      const arr = prev.actividadesSeleccionadas
      const idx = arr.indexOf(actividad)
      return {
        ...prev,
        actividadesSeleccionadas: idx > -1
          ? arr.filter(a => a !== actividad)
          : [...arr, actividad],
      }
    })
  }

  const calcularEdad = (fechaNac) => {
    if (!fechaNac) return null
    const hoy = new Date()
    const nacimiento = new Date(fechaNac)
    let edad = hoy.getFullYear() - nacimiento.getFullYear()
    const mes = hoy.getMonth() - nacimiento.getMonth()
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) edad--
    return edad
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (formData.actividadesSeleccionadas.length === 0) {
      toast.error('Elegí al menos una actividad')
      return
    }
    setLoading(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/public/solicitud-socio/${solicitudId}/familiar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error?.message || 'Error al agregar familiar')

      toast.success('Familiar agregado')
      setShowForm(false)
      setFormData({
        apellidos: '', nombres: '', documento: '', fechaNacimiento: '',
        parentesco: '', actividadesSeleccionadas: [],
      })
      cargarDatos()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleEliminar = async (familiarId) => {
    const confirmed = await confirm('¿Eliminar este familiar?', '¿Estás seguro de eliminar este familiar?')
    if (!confirmed) return
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/public/solicitud-socio/${solicitudId}/familiar/${familiarId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Error al eliminar familiar')
      toast.success('Familiar eliminado')
      cargarDatos()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleFinalizar = () => {
    navigate('/')
    toast.success('Solicitud completada. Te contactaremos en las próximas 48 horas.')
  }

  const inputCls = "w-full px-4 py-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all"
  const labelCls = "block text-sm font-medium text-gray-700 mb-1.5"
  const required = <span className="text-primary">*</span>

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <ConfirmDialog />

      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary-dark text-white">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute -top-10 -left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute top-20 right-20 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-10 md:py-14">
          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8">
            <div className="bg-white rounded-2xl p-4 shadow-2xl animate-float">
              <TenantLogo className="h-16 md:h-20 w-auto" />
            </div>
            <div className="text-center md:text-left flex-1">
              <h1 className="text-3xl md:text-5xl font-bold leading-tight">
                ¡Tu solicitud está <span className="text-yellow-200">en camino!</span>
              </h1>
              <p className="text-white/90 mt-3 text-base md:text-lg max-w-xl">
                Ahora podés sumar a tu grupo familiar a la inscripción. Cada uno con sus propias actividades.
              </p>
              <p className="text-white/70 mt-2 text-xs">Solicitud #{solicitudId}</p>
            </div>
          </div>

          {/* Pasos */}
          <div className="mt-10 flex items-center justify-center md:justify-start gap-3 md:gap-6">
            <StepDot num={1} label="Tus datos" done />
            <div className="flex-1 max-w-16 h-0.5 bg-white" />
            <StepDot num={2} label="Tu familia" active />
            <div className="flex-1 max-w-16 h-0.5 bg-white/30" />
            <StepDot num={3} label="Listo" muted />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-6 pb-16 relative z-10">
        {/* Confirmación */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6 animate-fade-in-up">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0 shadow-md">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900">¡Solicitud enviada!</h2>
              <p className="text-gray-600 text-sm mt-0.5">
                Recibimos tus datos. Si querés, podés sumar a tu cónyuge e hijos/as ahora — todos quedan dados de alta como un solo grupo familiar.
              </p>
            </div>
          </div>
        </div>

        {/* Lista de familiares */}
        {familiares.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
            <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-blue-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-gray-900">Tu grupo familiar</h2>
                <p className="text-xs text-gray-500">{familiares.length} {familiares.length === 1 ? 'persona agregada' : 'personas agregadas'}</p>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {familiares.map(f => (
                <div key={f.id} className="px-5 sm:px-6 py-4 flex items-start gap-3 hover:bg-gray-50 transition-colors">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${f.parentesco === 'CONYUGE' ? 'bg-rose-100' : 'bg-amber-100'}`}>
                    {f.parentesco === 'CONYUGE'
                      ? <Heart className="w-5 h-5 text-rose-500" />
                      : <Baby className="w-5 h-5 text-amber-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{f.apellidos} {f.nombres}</span>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${f.parentesco === 'CONYUGE' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                        {f.parentesco === 'CONYUGE' ? 'Cónyuge' : 'Hijo/a'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>DNI {f.documento}</span>
                      <span className="inline-flex items-center gap-1"><Cake className="w-3 h-3" />{calcularEdad(f.fechaNacimiento)} años</span>
                    </div>
                    {f.actividadesSeleccionadas?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {f.actividadesSeleccionadas.map(a => (
                          <span key={a} className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                            {a}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleEliminar(f.id)}
                    className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex-shrink-0"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Form de nuevo familiar */}
        {showForm ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6 animate-fade-in-up">
            <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-purple-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                <UserPlus className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-gray-900">Agregar familiar</h2>
                <p className="text-xs text-gray-500">Completá los datos de la persona</p>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Apellidos {required}</label>
                  <input type="text" name="apellidos" value={formData.apellidos} onChange={handleChange} required className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Nombres {required}</label>
                  <input type="text" name="nombres" value={formData.nombres} onChange={handleChange} required className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Documento {required}</label>
                  <input type="text" name="documento" value={formData.documento} onChange={handleChange} required minLength="7" placeholder="Sin puntos" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Fecha de nacimiento {required}</label>
                  <input type="date" name="fechaNacimiento" value={formData.fechaNacimiento} onChange={handleChange} required className={inputCls} />
                  {formData.fechaNacimiento && (
                    <p className="text-xs text-gray-500 mt-1.5 inline-flex items-center gap-1">
                      <Cake className="w-3 h-3" />
                      {calcularEdad(formData.fechaNacimiento)} años
                    </p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Parentesco {required}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, parentesco: 'CONYUGE' }))}
                      className={`flex items-center gap-2 p-3 border-2 rounded-xl transition-all ${
                        formData.parentesco === 'CONYUGE'
                          ? 'border-rose-500 bg-rose-500 text-white shadow-md scale-[1.02]'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-rose-300 hover:bg-rose-50'
                      }`}
                    >
                      <Heart className="w-5 h-5" />
                      <span className="font-medium">Cónyuge</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, parentesco: 'HIJO' }))}
                      className={`flex items-center gap-2 p-3 border-2 rounded-xl transition-all ${
                        formData.parentesco === 'HIJO'
                          ? 'border-amber-500 bg-amber-500 text-white shadow-md scale-[1.02]'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-amber-300 hover:bg-amber-50'
                      }`}
                    >
                      <Baby className="w-5 h-5" />
                      <span className="font-medium">Hijo/a</span>
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Actividades {required}
                  </label>
                  {formData.actividadesSeleccionadas.length > 0 && (
                    <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                      {formData.actividadesSeleccionadas.length} seleccionada{formData.actividadesSeleccionadas.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {actividades.map(actividad => {
                    const selected = formData.actividadesSeleccionadas.includes(actividad)
                    return (
                      <button
                        key={actividad}
                        type="button"
                        onClick={() => handleActividadChange(actividad)}
                        className={`relative flex items-center gap-2 p-3 border-2 rounded-xl text-left transition-all duration-200 ${
                          selected
                            ? 'border-primary bg-primary text-white shadow-md scale-[1.02]'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-primary/40 hover:bg-primary/5'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          selected ? 'border-white bg-white' : 'border-gray-300'
                        }`}>
                          {selected && <CheckCircle2 className="w-5 h-5 text-primary -m-0.5" />}
                        </div>
                        <span className="text-sm font-medium">{actividad}</span>
                      </button>
                    )
                  })}
                </div>
                {formData.actividadesSeleccionadas.length === 0 && (
                  <p className="text-xs text-gray-500 mt-2 inline-flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Elegí al menos una actividad
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 sm:flex-none sm:px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || formData.actividadesSeleccionadas.length === 0}
                  className="flex-1 bg-gradient-to-r from-primary to-primary-dark text-white py-3 px-6 rounded-xl hover:shadow-xl hover:shadow-primary/30 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed font-semibold transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Agregando...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-5 h-5" />
                      Agregar familiar
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Botones de acción */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <button
              onClick={() => setShowForm(true)}
              className="group bg-white border-2 border-dashed border-primary/40 hover:border-primary text-primary py-5 px-6 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all hover:bg-primary/5 hover:shadow-md"
            >
              <UserPlus className="w-5 h-5" />
              {familiares.length === 0 ? 'Agregar primer familiar' : 'Agregar otro familiar'}
            </button>
            <button
              onClick={handleFinalizar}
              className="group bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white py-5 px-6 rounded-2xl font-semibold flex items-center justify-center gap-2 shadow-md hover:shadow-xl hover:shadow-emerald-500/30 transition-all"
            >
              {familiares.length > 0 ? 'Finalizar y enviar' : 'Continuar sin familiares'}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}

        {/* Info final */}
        {!showForm && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5 animate-fade-in-up flex items-start gap-3" style={{ animationDelay: '150ms' }}>
            <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center flex-shrink-0">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">¿Qué pasa después?</p>
              <p className="text-blue-800 text-xs leading-relaxed">
                Cuando finalices, nuestro equipo revisa la solicitud. En las próximas 48 horas vas a recibir un email con la
                respuesta y, si está aprobada, un link para abonar la primera cuota.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Subcomponentes ──────────────────────────────────────────────────────────

function StepDot({ num, label, active = false, muted = false, done = false }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
        active
          ? 'bg-white text-primary shadow-lg scale-110'
          : done
            ? 'bg-white text-primary'
            : muted
              ? 'bg-white/20 text-white/70 border border-white/30'
              : 'bg-white text-primary'
      }`}>
        {done ? <CheckCircle2 className="w-5 h-5" /> : num}
      </div>
      <span className={`text-xs font-medium hidden sm:inline ${active ? 'text-white' : 'text-white/70'}`}>
        {label}
      </span>
    </div>
  )
}
