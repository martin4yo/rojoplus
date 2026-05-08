import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, MessageCircle, CheckCircle, Shield, ArrowUpRight, ArrowLeft, AlertCircle } from 'lucide-react'
import api from '../../services/api'
import { useTenant } from '../../contexts/TenantContext'
import PublicHero from '../../components/public/PublicHero'

export default function LoginEntrenador() {
  const { tenant } = useTenant()
  const navigate = useNavigate()
  const [valor, setValor] = useState('')
  const [enviando, setEnviando] = useState(null)
  const [error, setError] = useState(null)
  const [resultado, setResultado] = useState(null)
  const [chequeando, setChequeando] = useState(true)

  const waEnabled = tenant?.waEnabled === true

  useEffect(() => {
    let cancelado = false
    async function check() {
      try {
        const data = await api.get('/entrenador/sesion/check')
        if (cancelado) return
        if (data.autenticado) {
          navigate('/portal-entrenador', { replace: true })
          return
        }
      } catch {}
      finally {
        if (!cancelado) setChequeando(false)
      }
    }
    check()
    return () => { cancelado = true }
  }, [navigate])

  async function enviar(canal) {
    if (!valor.trim()) return
    setEnviando(canal)
    setError(null)
    try {
      const data = await api.post('/entrenador/enviar-link-acceso', { valor: valor.trim(), canal })
      setResultado({ canal: data.canal || canal, destino: data.destino || '' })
    } catch (err) {
      setError(err.message || 'Error al enviar el link')
    } finally {
      setEnviando(null)
    }
  }

  if (chequeando) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center" style={{ backgroundColor: 'var(--bg-app)' }}>
        <div className="text-sm font-mono uppercase tracking-[0.25em]" style={{ color: 'var(--text-muted)' }}>
          Verificando…
        </div>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: 'var(--bg-app)' }}>
      <PublicHero
        eyebrow="Cuerpo técnico"
        title="Portal del"
        accent="entrenador."
        subtitle="Gestioná tus categorías, asistencia, partidos y comunicación con los socios."
        compact
      />

      <section className="py-16 md:py-24">
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
          {resultado ? (
            <div className="p-8 md:p-10" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div className="w-14 h-14 mb-6 flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--success) 12%, transparent)' }}>
                <CheckCircle className="w-7 h-7" style={{ color: 'var(--success)' }} />
              </div>
              <h2 className="font-display-sport mb-4" style={{ fontSize: 'clamp(32px, 4.5vw, 56px)', lineHeight: 0.94 }}>Link enviado.</h2>
              <p className="mb-4">
                {resultado.canal === 'whatsapp' ? 'Revisá tu WhatsApp.' : 'Revisá tu email.'}
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 mb-6" style={{ backgroundColor: 'var(--bg-surface-hi)', border: '1px solid var(--border)' }}>
                {resultado.canal === 'whatsapp'
                  ? <MessageCircle className="w-4 h-4" style={{ color: 'var(--success)' }} />
                  : <Mail className="w-4 h-4" />}
                <span className="font-medium text-sm">{resultado.destino}</span>
              </div>
              <button
                onClick={() => { setResultado(null); setValor('') }}
                className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] hover:underline"
              >
                <ArrowLeft className="w-3 h-3" /> Volver
              </button>
            </div>
          ) : (
            <div className="p-8 md:p-10" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div className="pub-eyebrow mb-3" style={{ color: 'var(--text-muted)' }}>Iniciar sesión</div>
              <h2 className="font-display-sport mb-3" style={{ fontSize: 'clamp(28px, 4vw, 48px)', lineHeight: 0.96 }}>
                Acceso entrenador.
              </h2>
              <p className="mb-8 text-sm" style={{ color: 'var(--color-text-secondary, var(--text-dim))' }}>
                Ingresá tu email o documento y elegí cómo querés recibir el link.
              </p>

              {error && (
                <div className="mb-6 px-4 py-3 text-sm flex items-start gap-3" style={{ border: '1px solid var(--error)', color: 'var(--error)', backgroundColor: 'var(--error-soft)' }}>
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-5">
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-[0.25em] block mb-2" style={{ color: 'var(--text-muted)' }}>
                    Email o documento
                  </label>
                  <input
                    type="text"
                    value={valor}
                    onChange={(e) => { setValor(e.target.value); setError(null) }}
                    placeholder="Ej: juan@gmail.com o 30123456"
                    className="input-field"
                    disabled={enviando !== null}
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && enviar('email')}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => enviar('email')}
                  disabled={enviando !== null || !valor.trim()}
                  className="pub-cta group w-full"
                  style={{ opacity: (enviando !== null || !valor.trim()) ? 0.6 : 1 }}
                >
                  <span className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {enviando === 'email' ? 'Enviando…' : 'Enviar por email'}
                  </span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>

                {waEnabled && (
                  <button
                    type="button"
                    onClick={() => enviar('whatsapp')}
                    disabled={enviando !== null || !valor.trim()}
                    className="group inline-flex items-center justify-between gap-6 w-full px-7 py-4 transition-all"
                    style={{
                      backgroundColor: '#16A34A', color: '#fff', borderRadius: 0,
                      fontFamily: 'Geist Mono, monospace', fontSize: 12, fontWeight: 600,
                      textTransform: 'uppercase', letterSpacing: '0.2em',
                      opacity: (enviando !== null || !valor.trim()) ? 0.6 : 1,
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4" />
                      {enviando === 'whatsapp' ? 'Enviando…' : 'Enviar por WhatsApp'}
                    </span>
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="mt-8 px-4 py-3 text-xs flex items-start gap-3" style={{ border: '1px solid var(--border)' }}>
                <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
                <p>El link es válido por 24 horas. Tu sesión se recuerda 30 días en este dispositivo.</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
