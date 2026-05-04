import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../../services/api'
import { cargarPermisos } from '../../services/permisos'
import { useTenant } from '../../contexts/TenantContext'
import TenantLogo from '../../components/TenantLogo'
import { ArrowRight, ArrowLeft, Activity, Zap } from 'lucide-react'

/**
 * Login alternativo — Modern Sport Tech (dark + branding del tenant)
 * Mismo flujo que Login.jsx (credenciales → selector → handoff). El acento
 * usa el color primario del tenant actual (CSS var --color-primary), por lo
 * que cada club ve su propia identidad sobre la base dark.
 *
 * Ruta: /admin/login-alt
 */

// ─── Helpers (idénticos al original para mantener compat backend) ──────────
function buildTenantHandoffUrl(subdomain, tempToken, tenantId) {
  const protocol = window.location.protocol
  const host = window.location.host
  const portMatch = host.match(/:\d+$/)
  const port = portMatch ? portMatch[0] : ''
  const hostNoPort = host.replace(/:\d+$/, '')
  const parts = hostNoPort.split('.')
  let newHost
  if (parts.length <= 1) {
    newHost = `${subdomain}.${hostNoPort}${port}`
  } else {
    parts[0] = subdomain
    newHost = parts.join('.') + port
  }
  const hash = `#temp=${encodeURIComponent(tempToken)}&tenantId=${tenantId}`
  return `${protocol}//${newHost}/admin/login-alt${hash}`
}

function getCurrentSubdomain() {
  const hostname = window.location.hostname
  if (hostname.includes('localhost')) {
    const m = hostname.match(/^([^.]+)\.localhost/)
    return m ? m[1] : null
  }
  const parts = hostname.split('.')
  return (parts.length > 2 && parts[0] !== 'www') ? parts[0] : null
}

// ─── Tokens de la base dark (el acento sale del tenant) ────────────────────
const C = {
  bg: '#0A0A0B',
  bgSoft: '#0F0F11',
  surface: '#141417',
  surfaceHi: '#1A1A1E',
  border: '#26262B',
  borderHi: '#33333A',
  text: '#FAFAFA',
  textDim: '#A1A1AA',
  textMuted: '#71717A',
  red: '#F87171',
}
// Acento del tenant (con fallback) — usado vía CSS var --la-accent
const ACCENT = 'var(--color-primary, #D9F558)'
const ACCENT_SOFT = 'color-mix(in srgb, var(--color-primary, #D9F558) 12%, transparent)'
const ACCENT_GLOW = 'color-mix(in srgb, var(--color-primary, #D9F558) 35%, transparent)'

const FONT_LINK = 'https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap'

export default function AdminLoginAlt() {
  const navigate = useNavigate()
  const { tenant } = useTenant()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [step, setStep] = useState('credentials')
  const [tempToken, setTempToken] = useState(null)
  const [adminInfo, setAdminInfo] = useState(null)
  const [tenants, setTenants] = useState([])
  const [esSuperAdmin, setEsSuperAdmin] = useState(false)

  useEffect(() => {
    if (document.querySelector(`link[href="${FONT_LINK}"]`)) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = FONT_LINK
    document.head.appendChild(link)
  }, [])

  useEffect(() => {
    const hash = window.location.hash || ''
    if (!hash.includes('temp=')) return
    const params = new URLSearchParams(hash.replace(/^#/, ''))
    const temp = params.get('temp')
    const tenantId = params.get('tenantId')
    if (temp && tenantId) {
      setStep('handoff')
      finalizarLogin(temp, parseInt(tenantId)).catch(err => {
        setError(err?.message || 'Error procesando login.')
        setStep('credentials')
        window.history.replaceState(null, '', window.location.pathname)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function finalizarLogin(temp, tenantId) {
    const data = await api.post('/admin/select-tenant', { tempToken: temp, tenantId })
    localStorage.setItem('adminToken', data.token)
    localStorage.setItem('adminData', JSON.stringify(data.admin))
    if (data.tenant?.slug) localStorage.removeItem('superadmin_tenant_slug')
    await cargarPermisos()
    window.history.replaceState(null, '', '/admin')
    navigate('/admin', { replace: true })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const data = await api.post('/admin/login', { email, password })
      setTempToken(data.tempToken)
      setAdminInfo(data.admin)
      setEsSuperAdmin(!!data.esSuperAdmin)
      setTenants(data.tenants || [])
      // Si tiene un único tenant asignado, ingresá directamente sin pasar por el selector
      if (data.tenants?.length === 1) {
        const t = data.tenants[0]
        const currentSubdomain = getCurrentSubdomain()
        if (currentSubdomain === t.subdomain) {
          await finalizarLogin(data.tempToken, t.id)
        } else {
          window.location.href = buildTenantHandoffUrl(t.subdomain, data.tempToken, t.id)
        }
        return
      }
      setStep('selector')
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  async function elegirTenant(tenant) {
    const currentSubdomain = getCurrentSubdomain()
    if (currentSubdomain === tenant.subdomain) {
      try { await finalizarLogin(tempToken, tenant.id) }
      catch (err) { setError(err?.message || 'Error al ingresar al club') }
    } else {
      window.location.href = buildTenantHandoffUrl(tenant.subdomain, tempToken, tenant.id)
    }
  }

  const clubNombre = tenant?.nombre || 'Clubix'

  return (
    <div
      className="min-h-screen w-full flex relative overflow-hidden la-root"
      style={{ backgroundColor: C.bg, color: C.text, fontFamily: '"Geist", system-ui, sans-serif' }}
    >
      <BackdropFx />
      <GlobalStyles />

      {/* ─── Lado izquierdo: hero con métricas live ─── */}
      <aside className="hidden lg:flex w-[46%] xl:w-[50%] flex-col p-12 xl:p-16 relative z-10"
             style={{ borderRight: `1px solid ${C.border}` }}>

        {/* Top: brand del tenant + status */}
        <div className="flex items-center justify-between la-rise la-rise-1">
          <div className="flex items-center gap-3">
            <BrandFrame>
              <TenantLogo
                className="max-h-9 max-w-9 object-contain"
                fallbackSize="w-9 h-9"
              />
            </BrandFrame>
            <div className="leading-tight">
              <div className="font-medium text-[14px]" style={{ color: C.text, letterSpacing: '-0.01em' }}>
                {clubNombre}
              </div>
              <div className="font-mono text-[10px] tracking-[0.2em] uppercase" style={{ color: C.textMuted }}>
                ops · clubix v2.4
              </div>
            </div>
          </div>
          <LiveBadge />
        </div>

        {/* Hero */}
        <div className="mt-auto">
          <div className="la-rise la-rise-2 font-mono text-[11px] uppercase tracking-[0.3em] mb-6 flex items-center gap-2 la-accent-text">
            <span className="la-accent-bar" />
            Panel administrativo
          </div>

          <h1
            className="la-rise la-rise-3"
            style={{
              fontFamily: '"Geist", sans-serif',
              fontWeight: 500,
              fontSize: 'clamp(46px, 5.4vw, 80px)',
              lineHeight: 0.96,
              letterSpacing: '-0.045em',
              color: C.text,
            }}
          >
            La operación
            <br />
            del club, <span className="la-accent-text">en vivo.</span>
          </h1>

          <p
            className="la-rise la-rise-4 mt-6 max-w-md text-[15px]"
            style={{ color: C.textDim, lineHeight: 1.55 }}
          >
            Socios, cuotas, accesos, buffet, deportes y caja —
            todo el club operando en una sola plataforma.
          </p>

        </div>

        {/* Footer izquierdo */}
        <div className="la-rise la-rise-6 mt-16 pt-6 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em]"
             style={{ borderTop: `1px solid ${C.border}`, color: C.textMuted }}>
          <span className="flex items-center gap-2">
            <span className="la-pulse-dot" />
            Sistema operativo
          </span>
          <span>BUE · AR · {new Date().getFullYear()}</span>
        </div>

        <GridLines />
      </aside>

      {/* ─── Lado derecho: form ─── */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 relative z-10">
        {/* Header mobile */}
        <div className="lg:hidden absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-5"
             style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2">
            <BrandFrame size={32}>
              <TenantLogo className="max-h-7 max-w-7 object-contain" fallbackSize="w-7 h-7" />
            </BrandFrame>
            <span className="font-medium text-[13px]" style={{ color: C.text, letterSpacing: '-0.01em' }}>
              {clubNombre}
            </span>
          </div>
          <LiveBadge compact />
        </div>

        <div className="w-full max-w-md">
          {step === 'credentials' && (
            <CredentialsView
              email={email}
              password={password}
              loading={loading}
              error={error}
              onEmail={setEmail}
              onPassword={setPassword}
              onSubmit={handleSubmit}
            />
          )}
          {step === 'selector' && (
            <SelectorView
              admin={adminInfo}
              tenants={tenants}
              esSuperAdmin={esSuperAdmin}
              error={error}
              onPick={elegirTenant}
              onBack={() => {
                setStep('credentials')
                setTempToken(null); setTenants([]); setAdminInfo(null)
              }}
            />
          )}
          {step === 'handoff' && <HandoffView />}
        </div>

        {/* Footer derecha */}
        <div className="absolute bottom-6 left-0 right-0 flex items-center justify-between px-8 font-mono text-[10px] uppercase tracking-[0.2em]"
             style={{ color: C.textMuted }}>
          <Link to="/" className="hover:text-white transition-colors">← Volver al inicio</Link>
          <span className="hidden sm:inline">Build {new Date().getFullYear()}.04 · TLS 1.3</span>
        </div>
      </main>
    </div>
  )
}

// ─── Vistas ───────────────────────────────────────────────────────────────
function CredentialsView({ email, password, loading, error, onEmail, onPassword, onSubmit }) {
  return (
    <form onSubmit={onSubmit}>
      <div className="la-rise la-rise-1 font-mono text-[10px] uppercase tracking-[0.3em] mb-3" style={{ color: C.textMuted }}>
        01 / 02 · Credenciales
      </div>

      <h2
        className="la-rise la-rise-2"
        style={{ fontSize: 40, lineHeight: 1.05, fontWeight: 500, letterSpacing: '-0.03em', color: C.text }}
      >
        Ingresá al panel
      </h2>
      <p className="la-rise la-rise-3 mt-2 mb-10 text-[14px]" style={{ color: C.textDim }}>
        Iniciá sesión con tu cuenta de administrador.
      </p>

      {error && (
        <div className="la-rise la-rise-3 mb-6 px-4 py-3 text-[13px] flex items-start gap-3 rounded-lg"
             style={{ border: `1px solid ${C.red}`, color: C.red, backgroundColor: 'rgba(248,113,113,0.05)' }}>
          <span className="font-mono text-[11px] mt-0.5">!</span>
          <span>{error}</span>
        </div>
      )}

      <div className="la-rise la-rise-4 mb-5">
        <label className="font-mono text-[10px] uppercase tracking-[0.25em] block mb-2" style={{ color: C.textMuted }}>
          Email
        </label>
        <input
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => onEmail(e.target.value)}
          placeholder="admin@club.ar"
          className="la-input"
        />
      </div>

      <div className="la-rise la-rise-5 mb-10">
        <label className="font-mono text-[10px] uppercase tracking-[0.25em] block mb-2" style={{ color: C.textMuted }}>
          Contraseña
        </label>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => onPassword(e.target.value)}
          placeholder="••••••••"
          className="la-input"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="la-rise la-rise-6 la-cta group w-full flex items-center justify-between px-5 py-4"
        style={{ opacity: loading ? 0.7 : 1, cursor: loading ? 'wait' : 'pointer' }}
      >
        <span className="font-medium text-[15px]" style={{ color: '#0A0A0B', letterSpacing: '-0.01em' }}>
          {loading ? 'Verificando…' : 'Continuar'}
        </span>
        {loading
          ? <Spinner color="#0A0A0B" />
          : <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" style={{ color: '#0A0A0B' }} />
        }
      </button>

      <div className="la-rise la-rise-6 mt-8 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.25em]"
           style={{ color: C.textMuted }}>
        <span className="la-pulse-dot" />
        Conexión cifrada · TLS 1.3
      </div>
    </form>
  )
}

function SelectorView({ admin, tenants, esSuperAdmin, error, onPick, onBack }) {
  const nombre = admin?.nombre || (admin?.email || '').split('@')[0]
  return (
    <div>
      <div className="la-rise la-rise-1 font-mono text-[10px] uppercase tracking-[0.3em] mb-3" style={{ color: C.textMuted }}>
        02 / 02 · Seleccionar club
      </div>

      <h2
        className="la-rise la-rise-2"
        style={{ fontSize: 36, lineHeight: 1.05, fontWeight: 500, letterSpacing: '-0.03em', color: C.text }}
      >
        Hola, <span className="la-accent-text">{nombre}</span>.
      </h2>
      <p className="la-rise la-rise-3 mt-2 mb-8 text-[14px]" style={{ color: C.textDim }}>
        Elegí a qué club querés ingresar.
      </p>

      {esSuperAdmin && (
        <div className="la-rise la-rise-3 mb-6 px-4 py-3 flex items-center gap-3 rounded-lg la-accent-bg"
             style={{ border: `1px solid ${C.border}` }}>
          <Zap size={14} className="la-accent-text" />
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] la-accent-text">
            Super-admin
          </span>
          <span className="text-[13px]" style={{ color: C.textDim }}>· acceso a todos los clubes</span>
        </div>
      )}

      {error && (
        <div className="la-rise la-rise-3 mb-6 px-4 py-3 text-[13px] rounded-lg"
             style={{ border: `1px solid ${C.red}`, color: C.red }}>
          {error}
        </div>
      )}

      {tenants.length === 0 ? (
        <div className="la-rise la-rise-4 px-6 py-12 text-center rounded-lg"
             style={{ border: `1px dashed ${C.border}`, color: C.textMuted }}>
          No tenés acceso a ningún club todavía.
        </div>
      ) : (
        <ul className="space-y-2 w-full">
          {tenants.map((t, idx) => (
            <li
              key={t.id}
              className="la-rise la-tile cursor-pointer flex items-center gap-3 px-3 sm:px-4 py-3 rounded-lg w-full overflow-hidden"
              style={{
                border: `1px solid ${C.border}`,
                backgroundColor: C.surface,
                animationDelay: `${0.15 + idx * 0.04}s`,
              }}
              onClick={() => onPick(t)}
            >
              <span className="hidden sm:inline font-mono text-[10px] tracking-[0.15em] w-6 text-right flex-shrink-0" style={{ color: C.textMuted }}>
                {String(idx + 1).padStart(2, '0')}
              </span>

              <div
                className="flex-shrink-0 flex items-center justify-center rounded-md overflow-hidden"
                style={{ width: 36, height: 36, border: `1px solid ${C.border}`, backgroundColor: C.bg }}
              >
                {t.logoUrl
                  ? <img src={t.logoUrl} alt={t.nombre} className="max-w-7 max-h-7 object-contain" />
                  : <CrestIcon nombre={t.nombre} />
                }
              </div>

              <div className="flex-1 min-w-0 overflow-hidden">
                <div className="truncate font-medium" style={{ fontSize: 15, color: C.text, letterSpacing: '-0.01em' }}>
                  {t.nombre}
                </div>
                <div className="truncate font-mono text-[10px] uppercase tracking-[0.15em] mt-1"
                     style={{ color: C.textMuted }}>
                  {t.subdomain}.clubix.com · {t.rolEnTenant}
                </div>
              </div>

              <ArrowRight size={16} className="la-tile-arrow flex-shrink-0" style={{ color: C.textMuted }} />
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={onBack}
        className="la-rise la-rise-6 mt-8 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] hover:text-white transition-colors"
        style={{ color: C.textMuted }}
      >
        <ArrowLeft size={12} /> Cambiar de usuario
      </button>
    </div>
  )
}

function HandoffView() {
  return (
    <div className="text-center py-16">
      <div className="inline-flex flex-col items-center gap-8">
        <Heartbeat />
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] la-accent-text">
            Autenticando
          </div>
          <div className="mt-3" style={{ fontSize: 24, fontWeight: 500, color: C.text, letterSpacing: '-0.02em' }}>
            Ingresando al club…
          </div>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: C.textDim }}>
          Verificando token · cargando permisos
        </div>
      </div>
    </div>
  )
}

// ─── Decoraciones ─────────────────────────────────────────────────────────
function BrandFrame({ size = 40, children }) {
  return (
    <div
      className="flex items-center justify-center overflow-hidden la-brand-frame"
      style={{
        width: size, height: size,
        border: `1px solid ${C.border}`,
        backgroundColor: C.surface,
        borderRadius: 8,
      }}
    >
      {children}
    </div>
  )
}

function CrestIcon({ nombre }) {
  const initial = (nombre || '?').trim().charAt(0).toUpperCase()
  return (
    <div className="la-accent-text" style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.04em' }}>
      {initial}
    </div>
  )
}

function LiveBadge({ compact }) {
  return (
    <div
      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full la-accent-bg"
      style={{ border: `1px solid ${C.border}` }}
    >
      <span className="la-pulse-dot" style={{ width: 6, height: 6 }} />
      <span className="font-mono text-[10px] uppercase tracking-[0.25em] la-accent-text">
        {compact ? 'Live' : 'Live · 24/7'}
      </span>
    </div>
  )
}

function Heartbeat() {
  return (
    <div className="relative" style={{ width: 64, height: 64 }}>
      <div className="absolute inset-0 rounded-full la-heartbeat-1 la-accent-border" />
      <div className="absolute rounded-full la-heartbeat-2 la-accent-border" style={{ inset: 8, opacity: 0.6 }} />
      <div className="absolute rounded-full la-heartbeat-3 la-accent-fill" style={{ inset: 18 }} />
    </div>
  )
}

function Spinner({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="la-spin">
      <circle cx="12" cy="12" r="9" stroke={color} strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

function GridLines() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: `
          linear-gradient(${C.border} 1px, transparent 1px),
          linear-gradient(90deg, ${C.border} 1px, transparent 1px)
        `,
        backgroundSize: '64px 64px',
        opacity: 0.18,
        maskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black 30%, transparent 90%)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black 30%, transparent 90%)',
        zIndex: 0,
      }}
    />
  )
}

function BackdropFx() {
  return (
    <>
      <div
        aria-hidden
        className="absolute pointer-events-none la-glow-1"
        style={{
          left: '-15%',
          bottom: '-25%',
          width: '60%',
          height: '70%',
          filter: 'blur(60px)',
          zIndex: 0,
        }}
      />
      <div
        aria-hidden
        className="absolute pointer-events-none la-glow-2"
        style={{
          right: '-10%',
          top: '-15%',
          width: '45%',
          height: '50%',
          filter: 'blur(80px)',
          zIndex: 0,
        }}
      />
    </>
  )
}

function GlobalStyles() {
  // El acento toma el primario del tenant. Si no hay tenant cargado todavía,
  // cae a un lima eléctrico para no quedar gris.
  return (
    <style>{`
      .la-root {
        --la-accent: ${ACCENT};
        --la-accent-soft: ${ACCENT_SOFT};
        --la-accent-glow: ${ACCENT_GLOW};
      }

      @keyframes la-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes la-pulse-bg {
        0%, 100% { opacity: 1; box-shadow: 0 0 0 0 var(--la-accent-glow); }
        50%      { opacity: 0.55; box-shadow: 0 0 0 4px transparent; }
      }
      @keyframes la-spin { to { transform: rotate(360deg); } }
      @keyframes la-hb1 { 0%,100% { transform: scale(1); opacity: 0.4; } 50% { transform: scale(1.15); opacity: 0.1; } }
      @keyframes la-hb2 { 0%,100% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.08); opacity: 0.3; } }
      @keyframes la-hb3 { 0%,100% { transform: scale(1); } 50% { transform: scale(0.85); } }

      .la-rise { animation: la-rise .65s cubic-bezier(.2,.7,.2,1) both; }
      .la-rise-1 { animation-delay: .05s; }
      .la-rise-2 { animation-delay: .12s; }
      .la-rise-3 { animation-delay: .19s; }
      .la-rise-4 { animation-delay: .26s; }
      .la-rise-5 { animation-delay: .33s; }
      .la-rise-6 { animation-delay: .42s; }

      .la-accent-text { color: var(--la-accent); }
      .la-accent-bg   { background-color: var(--la-accent-soft); }
      .la-accent-border { border: 1px solid var(--la-accent); }
      .la-accent-fill { background-color: var(--la-accent); }

      .la-accent-bar {
        display: inline-block;
        width: 24px;
        height: 1px;
        background-color: var(--la-accent);
      }

      .la-pulse-dot {
        display: inline-block;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background-color: var(--la-accent);
        animation: la-pulse-bg 2s ease-in-out infinite;
      }
      .la-spin { animation: la-spin 0.9s linear infinite; }
      .la-heartbeat-1 { animation: la-hb1 1.6s ease-in-out infinite; }
      .la-heartbeat-2 { animation: la-hb2 1.6s ease-in-out infinite; animation-delay: 0.1s; }
      .la-heartbeat-3 { animation: la-hb3 1.6s ease-in-out infinite; animation-delay: 0.2s; }

      .la-glow-1 {
        background: radial-gradient(circle at center, var(--la-accent-soft) 0%, transparent 60%);
      }
      .la-glow-2 {
        background: radial-gradient(circle at center, var(--la-accent-soft) 0%, transparent 60%);
        opacity: 0.5;
      }

      .la-input {
        width: 100%;
        background: ${C.surface};
        border: 1px solid ${C.border};
        border-radius: 10px;
        padding: 14px 16px;
        font-size: 15px;
        color: ${C.text};
        font-family: 'Geist', sans-serif;
        letter-spacing: -0.01em;
        outline: none;
        transition: border-color .2s ease, box-shadow .2s ease, background-color .2s ease;
      }
      .la-input::placeholder { color: ${C.textMuted}; }
      .la-input:hover { border-color: ${C.borderHi}; }
      .la-input:focus {
        border-color: var(--la-accent);
        background: ${C.surfaceHi};
        box-shadow: 0 0 0 3px var(--la-accent-soft);
      }

      .la-cta {
        background: var(--la-accent);
        border-radius: 10px;
        border: 0;
        transition: transform .15s ease, box-shadow .25s ease, filter .15s ease;
        box-shadow: 0 1px 0 rgba(255,255,255,0.08) inset, 0 0 0 0 transparent;
      }
      .la-cta:hover:not(:disabled) {
        filter: brightness(1.06);
        box-shadow: 0 1px 0 rgba(255,255,255,0.12) inset, 0 8px 32px -8px var(--la-accent-glow);
        transform: translateY(-1px);
      }
      .la-cta:active:not(:disabled) { transform: translateY(0); }

      .la-tile { transition: background-color .2s ease, border-color .2s ease, transform .2s ease; }
      .la-tile:hover {
        background-color: ${C.surfaceHi};
        border-color: ${C.borderHi};
      }
      .la-tile:hover .la-tile-arrow { color: var(--la-accent); transform: translateX(2px); }
      .la-tile-arrow { transition: transform .2s ease, color .2s ease; }

      a:focus-visible, button:focus-visible, .la-input:focus-visible { outline: none; }
    `}</style>
  )
}
