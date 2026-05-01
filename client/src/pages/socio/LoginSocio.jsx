import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, IdCard, Send, CheckCircle, Shield, MessageCircle, Smartphone, ArrowUpRight, ArrowLeft } from 'lucide-react'
import api from '../../services/api'
import PublicHero from '../../components/public/PublicHero'

const METODOS = [
  { id: 'email',    label: 'Email',     icon: Mail,           placeholder: 'socio@ejemplo.com', help: 'Usaremos el email registrado en el club.' },
  { id: 'dni',      label: 'DNI',       icon: IdCard,         placeholder: '12345678',          help: 'Sin puntos ni espacios.' },
  { id: 'whatsapp', label: 'WhatsApp',  icon: MessageCircle,  placeholder: '11 1234-5678',      help: 'Con o sin código de área. Buscamos en todos los teléfonos registrados.' },
]

export default function LoginSocio() {
  const [metodo, setMetodo] = useState('email')
  const [valor, setValor] = useState('')
  const [loading, setLoading] = useState(false)
  const [linkEnviado, setLinkEnviado] = useState(false)
  const [error, setError] = useState(null)

  const metodoActual = METODOS.find(m => m.id === metodo)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!valor.trim()) return
    try {
      setLoading(true)
      setError(null)
      await api.post('/socio/enviar-link-acceso', { metodo, valor: valor.trim() })
      setLinkEnviado(true)
    } catch (err) {
      setError(err.message || 'Error al enviar el link. Verificá tus datos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ backgroundColor: 'var(--bg-app)' }}>
      <PublicHero
        eyebrow="Tu cuenta"
        title="Acceso"
        accent="directo."
        subtitle="Sin contraseñas. Te mandamos un link a tu email o WhatsApp y entrás al portal del socio."
        compact
      />

      <section className="py-16 md:py-24">
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
          {linkEnviado ? (
            <div className="p-8 md:p-10" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div
                className="w-14 h-14 mb-6 flex items-center justify-center"
                style={{ backgroundColor: 'color-mix(in srgb, var(--success) 12%, transparent)' }}
              >
                <CheckCircle className="w-7 h-7" style={{ color: 'var(--success)' }} />
              </div>

              <div className="pub-eyebrow mb-4" style={{ color: 'var(--color-text-secondary, var(--text-dim))' }}>Listo</div>
              <h2 className="font-display-sport mb-4" style={{ fontSize: 'clamp(32px, 4.5vw, 56px)', lineHeight: 0.94, color: 'var(--color-text-primary, var(--text))' }}>
                Link enviado.
              </h2>
              <p className="mb-6 leading-relaxed" style={{ color: 'var(--color-text-secondary, var(--text-dim))' }}>
                {metodo === 'whatsapp'
                  ? 'Revisá tu WhatsApp. Te enviamos un link de acceso válido por 24 horas.'
                  : <>Revisá tu email <span className="font-semibold" style={{ color: 'var(--color-text-primary, var(--text))' }}>{metodo === 'email' ? valor : 'registrado'}</span>. Te enviamos un link de acceso válido por 24 horas.</>}
              </p>

              <div className="p-4 mb-6 flex items-start gap-3" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface-hi)' }}>
                <Shield className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.25em] mb-1" style={{ color: 'var(--accent)' }}>
                    Link seguro
                  </p>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary, var(--text-dim))' }}>
                    Por seguridad, sólo funciona desde el dispositivo donde lo abras.
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
                <p className="flex items-center gap-2"><Smartphone className="w-4 h-4" /> Funciona en celular o computadora.</p>
                <p className="flex items-center gap-2"><Mail className="w-4 h-4" /> Guardá el link para futuros accesos.</p>
              </div>

              <button
                onClick={() => { setLinkEnviado(false); setValor('') }}
                className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] hover:underline"
                style={{ color: 'var(--color-text-primary, var(--text))' }}
              >
                <ArrowLeft className="w-3 h-3" /> Volver
              </button>
            </div>
          ) : (
            <div className="p-8 md:p-10" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div className="pub-eyebrow mb-3" style={{ color: 'var(--text-muted)' }}>
                Iniciar sesión
              </div>
              <h2
                className="font-display-sport mb-3"
                style={{ fontSize: 'clamp(28px, 4vw, 48px)', lineHeight: 0.96, color: 'var(--color-text-primary, var(--text))' }}
              >
                Entrar al portal.
              </h2>
              <p className="mb-8 text-sm" style={{ color: 'var(--color-text-secondary, var(--text-dim))' }}>
                Elegí cómo querés que te enviemos el link.
              </p>

              {error && (
                <div
                  className="mb-6 px-4 py-3 text-sm flex items-start gap-3"
                  style={{ border: '1px solid var(--error)', color: 'var(--error)', backgroundColor: 'var(--error-soft)' }}
                >
                  <span className="font-mono text-[11px] mt-0.5">!</span>
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Selector de método — botones cuadrados athletic */}
                <div className="grid grid-cols-3 gap-px" style={{ backgroundColor: 'var(--border)' }}>
                  {METODOS.map(m => {
                    const Icon = m.icon
                    const activo = metodo === m.id
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMetodo(m.id)}
                        className="p-4 flex flex-col items-center gap-2 transition-colors"
                        style={{
                          backgroundColor: activo ? 'var(--accent-soft)' : 'var(--bg-app)',
                          borderTop: activo ? '2px solid var(--accent)' : '2px solid transparent',
                          color: activo ? 'var(--accent)' : 'var(--text-dim)',
                        }}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] font-semibold">
                          {m.label}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <div>
                  <label className="font-mono text-[10px] uppercase tracking-[0.25em] block mb-2" style={{ color: 'var(--text-muted)' }}>
                    Tu {metodoActual.label.toLowerCase()}
                  </label>
                  <input
                    type={metodo === 'email' ? 'email' : 'text'}
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    placeholder={metodoActual.placeholder}
                    required
                    autoFocus
                    className="input-field"
                  />
                  <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {metodoActual.help}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !valor.trim()}
                  className="pub-cta group w-full"
                  style={{ opacity: (loading || !valor.trim()) ? 0.6 : 1, cursor: loading ? 'wait' : (!valor.trim() ? 'not-allowed' : 'pointer') }}
                >
                  <span>{loading ? 'Enviando…' : 'Enviar link de acceso'}</span>
                  {loading
                    ? <Send className="w-4 h-4 animate-pulse" />
                    : <ArrowUpRight className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />}
                </button>
              </form>

              <div
                className="mt-8 px-4 py-3 text-xs flex items-start gap-3"
                style={{ border: '1px solid var(--border)', color: 'var(--color-text-secondary, var(--text-dim))' }}
              >
                <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
                <p>
                  El link es exclusivo y válido por 24 horas. Sólo funciona desde el dispositivo donde lo abras.
                </p>
              </div>
            </div>
          )}

        </div>
      </section>
    </div>
  )
}
