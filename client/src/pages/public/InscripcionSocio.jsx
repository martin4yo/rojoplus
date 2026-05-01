import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, User, MapPin, Trophy, HeartPulse, UserCog,
  Users, CheckCircle2, AlertCircle, Cake,
} from 'lucide-react'
import TenantLogo from '../../components/TenantLogo'
import { useTenant } from '../../contexts/TenantContext'

export default function InscripcionSocio() {
  const navigate = useNavigate()
  const { tenant } = useTenant()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [formData, setFormData] = useState({
    apellidos: '',
    nombres: '',
    documento: '',
    fechaNacimiento: '',
    direccionCalle: '',
    direccionNumero: '',
    localidad: '',
    telefono: '',
    email: '',
    actividadesSeleccionadas: [],
    tieneEnfermedades: 'No',
    detalleEnfermedades: '',
    tutorApellidos: '',
    tutorNombres: '',
    tutorDocumento: '',
    tutorTelefono: '',
  })

  const actividades = [
    'Basquet', 'Futbol 11', 'Futsal', 'Gimnasio', 'Kickboxing',
    'Liga Argentina de Baby Futbol', 'Natación', 'Socio sin actividad',
    'Taekwondo', 'Voley',
  ]

  const calcularEdad = (fechaNac) => {
    if (!fechaNac) return null
    const hoy = new Date()
    const nacimiento = new Date(fechaNac)
    let edad = hoy.getFullYear() - nacimiento.getFullYear()
    const mes = hoy.getMonth() - nacimiento.getMonth()
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) edad--
    return edad
  }

  const edad = calcularEdad(formData.fechaNacimiento)
  const esMenor = edad !== null && edad < 18

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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (esMenor && (!formData.tutorApellidos || !formData.tutorNombres || !formData.tutorDocumento || !formData.tutorTelefono)) {
      setError('Los menores de 18 años deben completar los datos del tutor')
      setLoading(false)
      return
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/public/solicitud-socio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(tenant?.subdomain && { 'X-Tenant-Slug': tenant.subdomain }),
        },
        body: JSON.stringify(formData),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error?.message || 'Error al enviar la solicitud')
      navigate(`/inscripcion-socio/${data.solicitud.id}/familiares`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputCls = "w-full px-4 py-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all"
  const labelCls = "block text-sm font-medium text-gray-700 mb-1.5"
  const required = <span className="text-primary">*</span>

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-app)' }}>
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

          <div className="pub-eyebrow text-pub-fg-70 mb-5">Membresía</div>
          <h1 className="font-display-sport text-pub-fg" style={{ fontSize: 'clamp(40px, 6vw, 90px)', lineHeight: 0.92 }}>
            Sumate a<br /><span style={{ color: 'var(--color-primary)' }}>{tenant?.nombre || 'del Club'}.</span>
          </h1>
          <p className="text-pub-fg-70 mt-6 text-lg md:text-xl max-w-2xl" style={{ fontWeight: 300 }}>
            Completá tus datos y unite a una comunidad llena de actividades, eventos y momentos para compartir.
          </p>
          <div style={{ display: 'none' }}><TenantLogo /></div>

          {/* Pasos */}
          <div className="mt-10 flex items-center justify-start gap-3 md:gap-6">
            <StepDot active label="Tus datos" num={1} />
            <div className="flex-1 max-w-16 h-0.5 bg-pub-fg-30" />
            <StepDot label="Tu familia" num={2} muted />
            <div className="flex-1 max-w-16 h-0.5 bg-pub-fg-30" />
            <StepDot label="Listo" num={3} muted />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-6 pb-16 relative z-10">
        {/* Aviso del grupo familiar */}
        <div
          className="p-5 mb-6 animate-fade-in-up flex items-start gap-4"
          style={{ backgroundColor: 'var(--bg-surface-hi)', border: '1px solid var(--border)' }}
        >
          <div
            className="w-10 h-10 flex items-center justify-center flex-shrink-0"
            style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}
          >
            <Users className="w-4 h-4" style={{ color: 'var(--text-dim)' }} />
          </div>
          <div>
            <h3 className="font-mono text-[10px] uppercase tracking-[0.25em] mb-1" style={{ color: 'var(--text-muted)' }}>
              Grupo familiar
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary, var(--text-dim))' }}>
              Después de enviar tus datos vas a poder agregar a tus familiares (cónyuge, hijos, etc.) en un solo trámite,
              cada uno con sus propias actividades.
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 rounded-xl p-4 animate-fade-in-up flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-900">No pudimos enviar tu solicitud</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Datos personales */}
          <FormSection
            icon={User}
            color="bg-blue-500"
            title="Datos personales"
            subtitle="Empecemos con tus datos"
            delay={0}
          >
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
                <input type="text" name="documento" value={formData.documento} onChange={handleChange} required placeholder="Sin puntos" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Fecha de nacimiento {required}</label>
                <input type="date" name="fechaNacimiento" value={formData.fechaNacimiento} onChange={handleChange} required className={inputCls} />
                {edad !== null && (
                  <p className="text-xs text-gray-500 mt-1.5 inline-flex items-center gap-1">
                    <Cake className="w-3 h-3" />
                    {edad} años{esMenor && ' — vas a necesitar tutor'}
                  </p>
                )}
              </div>
              <div>
                <label className={labelCls}>Email {required}</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Teléfono {required}</label>
                <input type="tel" name="telefono" value={formData.telefono} onChange={handleChange} required className={inputCls} />
              </div>
            </div>
          </FormSection>

          {/* Domicilio */}
          <FormSection
            icon={MapPin}
            color="bg-amber-500"
            title="Domicilio"
            subtitle="¿Dónde te vamos a ubicar?"
            delay={100}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className={labelCls}>Calle {required}</label>
                <input type="text" name="direccionCalle" value={formData.direccionCalle} onChange={handleChange} required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Número {required}</label>
                <input type="text" name="direccionNumero" value={formData.direccionNumero} onChange={handleChange} required className={inputCls} />
              </div>
              <div className="md:col-span-3">
                <label className={labelCls}>Localidad {required}</label>
                <input type="text" name="localidad" value={formData.localidad} onChange={handleChange} required className={inputCls} />
              </div>
            </div>
          </FormSection>

          {/* Actividades */}
          <FormSection
            icon={Trophy}
            color="bg-emerald-500"
            title="Actividades"
            subtitle="Elegí qué te gustaría practicar"
            delay={200}
            badge={formData.actividadesSeleccionadas.length > 0 && (
              <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                {formData.actividadesSeleccionadas.length} seleccionada{formData.actividadesSeleccionadas.length > 1 ? 's' : ''}
              </span>
            )}
          >
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
          </FormSection>

          {/* Salud */}
          <FormSection
            icon={HeartPulse}
            color="bg-rose-500"
            title="Información de salud"
            subtitle="Para cuidarte mejor"
            delay={300}
          >
            <div className="space-y-4">
              <div>
                <p className={labelCls}>¿Tenés alguna enfermedad que debamos conocer? {required}</p>
                <div className="flex gap-2">
                  {['Si', 'No'].map(op => {
                    const activo = formData.tieneEnfermedades === op
                    return (
                      <button
                        key={op}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, tieneEnfermedades: op }))}
                        className="px-6 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] font-semibold transition-all"
                        style={{
                          backgroundColor: activo ? 'var(--accent)' : 'var(--bg-surface)',
                          color: activo ? 'var(--accent-fg, #fff)' : 'var(--text-dim)',
                          border: `1px solid ${activo ? 'var(--accent)' : 'var(--border)'}`,
                          borderRadius: 0,
                        }}
                      >
                        {op === 'Si' ? 'Sí' : 'No'}
                      </button>
                    )
                  })}
                </div>
              </div>
              {formData.tieneEnfermedades === 'Si' && (
                <div className="animate-fade-in-up">
                  <label className={labelCls}>Contanos un poco más</label>
                  <textarea
                    name="detalleEnfermedades"
                    value={formData.detalleEnfermedades}
                    onChange={handleChange}
                    rows="3"
                    className={`${inputCls} resize-none`}
                    placeholder="Ej: alergias, medicación, condiciones a tener en cuenta..."
                  />
                </div>
              )}
            </div>
          </FormSection>

          {/* Tutor (si menor) */}
          {esMenor && (
            <FormSection
              icon={UserCog}
              color="bg-purple-500"
              title="Datos del tutor"
              subtitle="Como sos menor de 18, necesitamos los datos de tu padre, madre o tutor"
              delay={400}
              animate
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Apellidos {required}</label>
                  <input type="text" name="tutorApellidos" value={formData.tutorApellidos} onChange={handleChange} required={esMenor} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Nombres {required}</label>
                  <input type="text" name="tutorNombres" value={formData.tutorNombres} onChange={handleChange} required={esMenor} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Documento {required}</label>
                  <input type="text" name="tutorDocumento" value={formData.tutorDocumento} onChange={handleChange} required={esMenor} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Teléfono {required}</label>
                  <input type="tel" name="tutorTelefono" value={formData.tutorTelefono} onChange={handleChange} required={esMenor} className={inputCls} />
                </div>
              </div>
            </FormSection>
          )}

          {/* Submit */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 animate-fade-in-up" style={{ animationDelay: '500ms' }}>
            <button
              type="submit"
              disabled={loading}
              className="group w-full bg-gradient-to-r from-primary to-primary-dark text-white py-4 px-6 rounded-xl hover:shadow-xl hover:shadow-primary/30 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed font-bold text-lg transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  Continuar al paso 2
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
            <p className="text-xs text-gray-500 text-center mt-3">
              Después podrás sumar a tu grupo familiar. Al enviar, aceptás los estatutos y reglamentos del club.
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Subcomponentes ──────────────────────────────────────────────────────────

function StepDot({ num, label, active = false, muted = false }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
        active
          ? 'bg-white text-primary shadow-lg scale-110'
          : muted
            ? 'bg-white/20 text-white/70 border border-white/30'
            : 'bg-white text-primary'
      }`}>
        {num}
      </div>
      <span className={`text-xs font-medium hidden sm:inline ${active ? 'text-white' : 'text-white/70'}`}>
        {label}
      </span>
    </div>
  )
}

function FormSection({ icon: Icon, title, subtitle, badge, children, delay = 0 }) {
  // Estilo athletic uniforme: ícono en cuadro con borde, sin colores variados.
  // El prop `color` queda ignorado para que todas las secciones se vean iguales.
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
