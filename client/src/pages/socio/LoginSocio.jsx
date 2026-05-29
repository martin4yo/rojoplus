import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, MessageCircle, Send, CheckCircle, Shield, Smartphone, ArrowUpRight, ArrowLeft, AlertCircle, KeyRound } from 'lucide-react'
import api from '../../services/api'
import { useTenant } from '../../contexts/TenantContext'
import PublicHero from '../../components/public/PublicHero'
import InstallAppButton from '../../components/InstallAppButton'

// Detecta navegadores embebidos (in-app) donde no se puede instalar la PWA.
function esNavegadorInApp() {
  const ua = navigator.userAgent || ''
  return /FBAN|FBAV|Instagram|Line\/|MicroMessenger|Twitter|WhatsApp|GSA\//i.test(ua)
}

export default function LoginSocio() {
  const { tenant } = useTenant()
  const navigate = useNavigate()
  const [valor, setValor] = useState('')
  const [enviando, setEnviando] = useState(null) // 'email' | 'whatsapp' | null
  const [error, setError] = useState(null)
  const [resultado, setResultado] = useState(null) // { canal, destino }
  const [chequeandoSesion, setChequeandoSesion] = useState(true)
  const [codigo, setCodigo] = useState('')
  const [verificando, setVerificando] = useState(false)
  const [errorCodigo, setErrorCodigo] = useState(null)
  const [inApp] = useState(() => esNavegadorInApp())

  const waEnabled = tenant?.waEnabled === true

  async function verificarCodigo() {
    const limpio = codigo.replace(/\D/g, '')
    if (limpio.length !== 6) { setErrorCodigo('Ingresá los 6 dígitos'); return }
    setVerificando(true)
    setErrorCodigo(null)
    try {
      const data = await api.post('/socio/login-codigo', { valor: valor.trim(), codigo: limpio })
      if (data?.tokenPortal) {
        navigate(`/portal-socio/${data.tokenPortal}`, { replace: true })
      } else {
        setErrorCodigo('No se pudo validar el código')
      }
    } catch (err) {
      setErrorCodigo(err.message || 'Código inválido')
    } finally {
      setVerificando(false)
    }
  }

  // Auto-login si hay sesión persistente válida (cookie de "recordar dispositivo")
  useEffect(() => {
    let cancelado = false
    async function checkSesion() {
      try {
        const data = await api.get('/socio/sesion/check')
        if (cancelado) return
        if (data.autenticado && data.tokenPortal) {
          navigate(`/portal-socio/${data.tokenPortal}`, { replace: true })
          return
        }
      } catch {
        // Sin sesión válida — mostrar form normal
      } finally {
        if (!cancelado) setChequeandoSesion(false)
      }
    }
    checkSesion()
    return () => { cancelado = true }
  }, [navigate])

  if (chequeandoSesion) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center" style={{ backgroundColor: 'var(--bg-app)' }}>
        <div className="text-sm font-mono uppercase tracking-[0.25em]" style={{ color: 'var(--text-muted)' }}>
          Verificando…
        </div>
      </div>
    )
  }

  async function enviar(canal) {
    if (!valor.trim()) return
    setEnviando(canal)
    setError(null)
    try {
      const data = await api.post('/socio/enviar-link-acceso', { valor: valor.trim(), canal })
      setResultado({ canal: data.canal || canal, destino: data.destino || '' })
    } catch (err) {
      setError(err.message || 'Error al enviar el link')
    } finally {
      setEnviando(null)
    }
  }

  return (
    <div style={{ backgroundColor: 'var(--bg-app)' }}>
      <InstallAppButton />
      <PublicHero
        eyebrow="Tu cuenta"
        title="Acceso"
        accent="directo."
        subtitle="Sin contraseñas. Te mandamos un link a tu email o WhatsApp y entrás al portal del socio."
        compact
      />

      <section className="py-16 md:py-24">
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
          {inApp && (
            <div
              className="mb-6 px-4 py-3 text-sm flex items-start gap-3"
              style={{ border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)', backgroundColor: 'var(--warning-soft)', color: 'var(--warning)' }}
            >
              <Smartphone className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Para instalar la app en tu teléfono, abrí esta página en tu navegador
                (Chrome o Safari). Desde acá dentro no se puede instalar.
              </span>
            </div>
          )}
          {resultado ? (
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
              <p className="mb-4 leading-relaxed" style={{ color: 'var(--color-text-secondary, var(--text-dim))' }}>
                {resultado.canal === 'whatsapp'
                  ? 'Te enviamos el link de acceso al portal por WhatsApp a:'
                  : 'Te enviamos el link de acceso al portal a tu email:'}
              </p>

              <div
                className="inline-flex items-center gap-2 px-4 py-2 mb-6"
                style={{ backgroundColor: 'var(--bg-surface-hi)', border: '1px solid var(--border)' }}
              >
                {resultado.canal === 'whatsapp'
                  ? <MessageCircle className="w-4 h-4" style={{ color: 'var(--success)' }} />
                  : <Mail className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />}
                <span className="font-medium text-sm" style={{ color: 'var(--color-text-primary, var(--text))' }}>{resultado.destino}</span>
              </div>

              <div className="p-4 mb-6 flex items-start gap-3" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface-hi)' }}>
                <Shield className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.25em] mb-1" style={{ color: 'var(--accent)' }}>
                    Link seguro
                  </p>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary, var(--text-dim))' }}>
                    Por seguridad, sólo funciona desde el dispositivo donde lo abras y dura 24 horas.
                  </p>
                </div>
              </div>

              {resultado.canal === 'email' && (
                <div
                  className="p-4 mb-6 text-sm"
                  style={{ border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)', backgroundColor: 'var(--warning-soft)', color: 'var(--warning)' }}
                >
                  <strong className="font-mono text-[10px] uppercase tracking-[0.2em] block mb-1">¿No llega?</strong>
                  Revisá tu carpeta de spam o correo no deseado.
                </div>
              )}

              <div className="space-y-2 text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
                <p className="flex items-center gap-2"><Smartphone className="w-4 h-4" /> Funciona en celular o computadora.</p>
                <p className="flex items-center gap-2"><Mail className="w-4 h-4" /> Guardá el link para futuros accesos.</p>
              </div>

              {/* Login con código: clave para la app instalada (iPhone), donde el
                  link abre Safari y no la PWA. */}
              <div className="p-5 mb-6" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface-hi)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <KeyRound className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                  <p className="font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: 'var(--accent)' }}>
                    ¿Instalaste la app?
                  </p>
                </div>
                <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary, var(--text-dim))' }}>
                  Ingresá el código de 6 dígitos que te enviamos para entrar acá mismo.
                </p>

                {errorCodigo && (
                  <div
                    className="mb-3 px-3 py-2 text-sm flex items-start gap-2"
                    style={{ border: '1px solid var(--error)', color: 'var(--error)', backgroundColor: 'var(--error-soft)' }}
                  >
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{errorCodigo}</span>
                  </div>
                )}

                <div className="flex items-stretch gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={codigo}
                    onChange={(e) => { setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6)); setErrorCodigo(null) }}
                    placeholder="______"
                    className="input-field text-center tracking-[0.5em] font-mono text-lg"
                    style={{ flex: 1 }}
                    disabled={verificando}
                    onKeyDown={(e) => e.key === 'Enter' && verificarCodigo()}
                  />
                  <button
                    type="button"
                    onClick={verificarCodigo}
                    disabled={verificando || codigo.replace(/\D/g, '').length !== 6}
                    className="pub-cta"
                    style={{ opacity: (verificando || codigo.replace(/\D/g, '').length !== 6) ? 0.6 : 1, cursor: verificando ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {verificando ? 'Entrando…' : 'Entrar'}
                  </button>
                </div>
              </div>

              <button
                onClick={() => { setResultado(null); setValor(''); setCodigo(''); setErrorCodigo(null) }}
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
                Ingresá tu nº de socio, DNI o email y elegí cómo querés recibir el link.
              </p>

              {error && (
                <div
                  className="mb-6 px-4 py-3 text-sm flex items-start gap-3"
                  style={{ border: '1px solid var(--error)', color: 'var(--error)', backgroundColor: 'var(--error-soft)' }}
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-5">
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-[0.25em] block mb-2" style={{ color: 'var(--text-muted)' }}>
                    Nº de socio, DNI o email
                  </label>
                  <input
                    type="text"
                    value={valor}
                    onChange={(e) => { setValor(e.target.value); setError(null) }}
                    placeholder="Ej: 1234, 30123456 o juan@gmail.com"
                    className="input-field"
                    disabled={enviando !== null}
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && enviar('email')}
                  />
                  <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                    Te enviamos el link al email o al WhatsApp registrado en tu cuenta de socio.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => enviar('email')}
                  disabled={enviando !== null || !valor.trim()}
                  className="pub-cta group w-full"
                  style={{ opacity: (enviando !== null || !valor.trim()) ? 0.6 : 1, cursor: enviando ? 'wait' : (!valor.trim() ? 'not-allowed' : 'pointer') }}
                >
                  <span className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {enviando === 'email' ? 'Enviando…' : 'Enviar por email'}
                  </span>
                  {enviando === 'email'
                    ? <Send className="w-4 h-4 animate-pulse" />
                    : <ArrowUpRight className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />}
                </button>

                {waEnabled && (
                  <button
                    type="button"
                    onClick={() => enviar('whatsapp')}
                    disabled={enviando !== null || !valor.trim()}
                    className="group inline-flex items-center justify-between gap-6 w-full px-7 py-4 transition-all"
                    style={{
                      backgroundColor: '#16A34A',
                      color: '#fff',
                      borderRadius: 0,
                      fontFamily: 'Geist Mono, monospace',
                      fontSize: 12,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.2em',
                      opacity: (enviando !== null || !valor.trim()) ? 0.6 : 1,
                      cursor: enviando ? 'wait' : (!valor.trim() ? 'not-allowed' : 'pointer'),
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4" />
                      {enviando === 'whatsapp' ? 'Enviando…' : 'Enviar por WhatsApp'}
                    </span>
                    {enviando === 'whatsapp'
                      ? <Send className="w-4 h-4 animate-pulse" />
                      : <ArrowUpRight className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />}
                  </button>
                )}
              </div>

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
