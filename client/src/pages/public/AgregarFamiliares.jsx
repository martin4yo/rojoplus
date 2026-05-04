import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import {
  ArrowRight, ArrowLeft, CheckCircle2, Users, UserPlus,
  Trash2, X, Cake, Heart, Baby, AlertCircle, Trophy,
} from 'lucide-react'
import { useConfirm } from '../../hooks/useConfirm'
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
    apellidos: '', nombres: '', documento: '', fechaNacimiento: '',
    parentesco: '', actividadesSeleccionadas: [],
  })

  const actividades = [
    'Basquet', 'Futbol 11', 'Futsal', 'Gimnasio', 'Kickboxing',
    'Liga Argentina de Baby Futbol', 'Natación', 'Socio sin actividad',
    'Taekwondo', 'Voley',
  ]

  useEffect(() => { cargarDatos() }, [])

  const tenantHeaders = tenant?.subdomain ? { 'X-Tenant-Slug': tenant.subdomain } : {}

  const cargarDatos = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/public/solicitud-socio/${solicitudId}/familiares`, {
        headers: tenantHeaders,
      })
      if (!res.ok) throw new Error('Error al cargar los datos')
      const data = await res.json()
      setFamiliares(data.data || [])
    } catch (err) {
      console.error(err)
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
        actividadesSeleccionadas: idx > -1 ? arr.filter(a => a !== actividad) : [...arr, actividad],
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
        headers: { 'Content-Type': 'application/json', ...tenantHeaders },
        body: JSON.stringify(formData),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error?.message || 'Error al agregar familiar')

      toast.success('Familiar agregado')
      setShowForm(false)
      setFormData({ apellidos: '', nombres: '', documento: '', fechaNacimiento: '', parentesco: '', actividadesSeleccionadas: [] })
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
      const response = await fetch(`${import.meta.env.VITE_API_URL}/public/solicitud-socio/${solicitudId}/familiar/${familiarId}`, {
        method: 'DELETE',
        headers: tenantHeaders,
      })
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
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-app)' }}>
      <ConfirmDialog />

      {/* Hero athletic */}
      <div className="relative overflow-hidden" style={{ backgroundColor: 'var(--pub-hero-bg)' }}>
        <div className="absolute inset-0 bg-field-grid-pub opacity-40" />
        <div className="absolute -right-32 -top-32 w-96 h-96 rounded-full opacity-20 blur-3xl" style={{ background: 'var(--color-primary)' }} />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-12 md:py-20">
          <Link
            to="/"
            className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-pub-fg-70 hover:text-pub-fg mb-8 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Volver al sitio
          </Link>

          <div className="pub-eyebrow text-pub-fg-70 mb-5">Paso 2 — Grupo familiar</div>
          <h1 className="font-display-sport text-pub-fg" style={{ fontSize: 'clamp(40px, 6vw, 90px)', lineHeight: 0.92 }}>
            Sumá a<br /><span style={{ color: 'var(--color-primary)' }}>tu familia.</span>
          </h1>
          <p className="text-pub-fg-70 mt-6 text-lg md:text-xl max-w-2xl" style={{ fontWeight: 300 }}>
            Cada miembro queda dado de alta con sus propias actividades. Podés agregar todos los que necesites — o saltearlo si vas solo.
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-pub-fg-50 mt-4">
            Solicitud #{solicitudId}
          </p>

          {/* Pasos */}
          <div className="mt-10 flex items-center justify-start gap-3 md:gap-6">
            <StepDot label="Tus datos" num={1} done />
            <div className="flex-1 max-w-16 h-0.5 bg-pub-fg" />
            <StepDot label="Tu familia" num={2} active />
            <div className="flex-1 max-w-16 h-0.5 bg-pub-fg-30" />
            <StepDot label="Listo" num={3} muted />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-6 pb-16 relative z-10">

        {/* Confirmación */}
        <div
          className="p-5 mb-6 animate-fade-in-up flex items-start gap-4"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <div
            className="w-10 h-10 flex items-center justify-center flex-shrink-0"
            style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface-hi)' }}
          >
            <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--text-dim)' }} />
          </div>
          <div>
            <h3 className="font-mono text-[10px] uppercase tracking-[0.25em] mb-1" style={{ color: 'var(--text-muted)' }}>
              Solicitud recibida
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary, var(--text-dim))' }}>
              Recibimos tus datos. Si querés, podés sumar a tu cónyuge e hijos/as ahora — todos quedan en un solo grupo familiar.
            </p>
          </div>
        </div>

        {/* Lista de familiares */}
        {familiares.length > 0 && (
          <FormSection
            icon={Users}
            title="Tu grupo familiar"
            subtitle={`${familiares.length} ${familiares.length === 1 ? 'persona agregada' : 'personas agregadas'}`}
            delay={50}
          >
            <div className="space-y-0 -mx-5 sm:-mx-6 -my-5 sm:-my-6">
              {familiares.map((f, i) => (
                <div
                  key={f.id}
                  className="px-5 sm:px-6 py-4 flex items-start gap-3 hover:bg-black/[0.02] transition-colors"
                  style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}
                >
                  <div
                    className="w-9 h-9 flex items-center justify-center flex-shrink-0"
                    style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface-hi)' }}
                  >
                    {f.parentesco === 'CONYUGE'
                      ? <Heart className="w-4 h-4" style={{ color: 'var(--text-dim)' }} />
                      : <Baby className="w-4 h-4" style={{ color: 'var(--text-dim)' }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium" style={{ color: 'var(--text)' }}>
                        {f.apellidos} {f.nombres}
                      </span>
                      <span className="font-mono text-[9px] uppercase tracking-[0.2em] px-2 py-0.5"
                        style={{
                          border: '1px solid var(--border)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {f.parentesco === 'CONYUGE' ? 'Cónyuge' : 'Hijo/a'}
                      </span>
                    </div>
                    <div className="text-xs mt-1 flex flex-wrap gap-x-3 gap-y-0.5" style={{ color: 'var(--text-muted)' }}>
                      <span>DNI {f.documento}</span>
                      <span className="inline-flex items-center gap-1">
                        <Cake className="w-3 h-3" />{calcularEdad(f.fechaNacimiento)} años
                      </span>
                    </div>
                    {f.actividadesSeleccionadas?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {f.actividadesSeleccionadas.map(a => (
                          <span
                            key={a}
                            className="text-[11px] px-2 py-0.5"
                            style={{
                              border: '1px solid var(--border)',
                              color: 'var(--text-dim)',
                              backgroundColor: 'var(--bg-surface-hi)',
                            }}
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleEliminar(f.id)}
                    className="p-2 hover:bg-red-50 transition-colors flex-shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </FormSection>
        )}

        {/* Form de nuevo familiar */}
        {showForm ? (
          <div className="mt-6">
            <FormSection
              icon={UserPlus}
              title="Agregar familiar"
              subtitle="Completá los datos de la persona"
              delay={0}
              badge={
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="p-2 hover:bg-black/5 transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  title="Cerrar"
                >
                  <X className="w-4 h-4" />
                </button>
              }
            >
              <form onSubmit={handleSubmit} className="space-y-5">
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
                      <ParentescoBtn
                        active={formData.parentesco === 'CONYUGE'}
                        onClick={() => setFormData(prev => ({ ...prev, parentesco: 'CONYUGE' }))}
                        icon={Heart}
                        label="Cónyuge"
                      />
                      <ParentescoBtn
                        active={formData.parentesco === 'HIJO'}
                        onClick={() => setFormData(prev => ({ ...prev, parentesco: 'HIJO' }))}
                        icon={Baby}
                        label="Hijo/a"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Actividades {required}</label>
                    {formData.actividadesSeleccionadas.length > 0 && (
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] px-2 py-0.5"
                        style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                      >
                        {formData.actividadesSeleccionadas.length} seleccionada{formData.actividadesSeleccionadas.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {actividades.map(actividad => {
                      const selected = formData.actividadesSeleccionadas.includes(actividad)
                      return (
                        <button
                          key={actividad}
                          type="button"
                          onClick={() => handleActividadChange(actividad)}
                          className="flex items-center gap-2 p-3 text-left transition-all"
                          style={{
                            border: selected ? '1px solid var(--color-primary)' : '1px solid var(--border)',
                            backgroundColor: selected ? 'var(--color-primary)' : 'var(--bg-surface)',
                            color: selected ? '#fff' : 'var(--text)',
                          }}
                        >
                          <div
                            className="w-4 h-4 flex items-center justify-center flex-shrink-0"
                            style={{
                              border: selected ? '1px solid #fff' : '1px solid var(--border)',
                              backgroundColor: selected ? '#fff' : 'transparent',
                            }}
                          >
                            {selected && <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />}
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
                    className="flex-1 sm:flex-none sm:px-6 py-3 border font-medium transition-colors"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-dim)',
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading || formData.actividadesSeleccionadas.length === 0}
                    className="group flex-1 bg-gradient-to-r from-primary to-primary-dark text-white py-3 px-6 hover:shadow-xl hover:shadow-primary/30 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed font-semibold transition-all flex items-center justify-center gap-2"
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
            </FormSection>
          </div>
        ) : (
          /* Botones de acción */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6 animate-fade-in-up">
            <button
              onClick={() => setShowForm(true)}
              className="py-5 px-6 font-medium flex items-center justify-center gap-2 transition-all"
              style={{
                border: '1px dashed var(--color-primary)',
                color: 'var(--color-primary)',
                backgroundColor: 'var(--bg-surface)',
              }}
            >
              <UserPlus className="w-5 h-5" />
              {familiares.length === 0 ? 'Agregar primer familiar' : 'Agregar otro familiar'}
            </button>
            <button
              onClick={handleFinalizar}
              className="group bg-gradient-to-r from-primary to-primary-dark text-white py-5 px-6 font-semibold flex items-center justify-center gap-2 transition-all hover:shadow-xl hover:shadow-primary/30"
            >
              {familiares.length > 0 ? 'Finalizar y enviar' : 'Continuar sin familiares'}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}

        {/* Info final */}
        {!showForm && (
          <div
            className="mt-6 p-5 animate-fade-in-up flex items-start gap-4"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <div
              className="w-10 h-10 flex items-center justify-center flex-shrink-0"
              style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface-hi)' }}
            >
              <Trophy className="w-4 h-4" style={{ color: 'var(--text-dim)' }} />
            </div>
            <div>
              <h3 className="font-mono text-[10px] uppercase tracking-[0.25em] mb-1" style={{ color: 'var(--text-muted)' }}>
                ¿Qué pasa después?
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary, var(--text-dim))' }}>
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
      <div className={`w-9 h-9 flex items-center justify-center font-mono text-xs font-bold transition-all ${
        active
          ? 'bg-pub-fg text-pub-hero-bg'
          : done
            ? 'bg-pub-fg text-pub-hero-bg'
            : 'border border-pub-fg-30 text-pub-fg-50'
      }`}
      style={done || active ? { backgroundColor: 'var(--pub-hero-fg)', color: 'var(--pub-hero-bg)' } : {}}
      >
        {done ? <CheckCircle2 className="w-4 h-4" /> : num}
      </div>
      <span className={`font-mono text-[10px] uppercase tracking-[0.2em] hidden sm:inline ${
        active ? 'text-pub-fg' : muted ? 'text-pub-fg-50' : 'text-pub-fg-70'
      }`}>
        {label}
      </span>
    </div>
  )
}

function FormSection({ icon: Icon, title, subtitle, badge, children, delay = 0 }) {
  return (
    <div
      className="overflow-hidden animate-fade-in-up"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        animationDelay: `${delay}ms`,
      }}
    >
      <div
        className="px-5 sm:px-6 py-4 flex items-center gap-3"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div
          className="w-10 h-10 flex items-center justify-center flex-shrink-0"
          style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface-hi)' }}
        >
          <Icon className="w-4 h-4" style={{ color: 'var(--text-dim)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <h2
            className="font-display-sport"
            style={{ fontSize: 22, lineHeight: 1.05, color: 'var(--color-text-primary, var(--text))' }}
          >
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
          )}
        </div>
        {badge}
      </div>
      <div className="p-5 sm:p-6">
        {children}
      </div>
    </div>
  )
}

function ParentescoBtn({ active, onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 p-3 transition-all"
      style={{
        border: active ? '1px solid var(--color-primary)' : '1px solid var(--border)',
        backgroundColor: active ? 'var(--color-primary)' : 'var(--bg-surface)',
        color: active ? '#fff' : 'var(--text)',
      }}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
    </button>
  )
}
