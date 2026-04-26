import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Alert } from '../../components/Alert'
import api from '../../services/api'
import { cargarPermisos } from '../../services/permisos'
import TenantLogo from '../../components/TenantLogo'
import { Building2, Shield, ArrowRight } from 'lucide-react'

/**
 * Construye la URL del subdomain destino para handoff.
 * Ej: en dev, sportivopilar.localhost:5173/admin/login#temp=XXX&tenantId=YYY
 *     en prod, sportivopilar.clubix.com/admin/login#temp=XXX&tenantId=YYY
 */
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
  return `${protocol}//${newHost}/admin/login${hash}`
}

export default function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Estado del paso 2 (selector de tenants)
  const [step, setStep] = useState('credentials') // 'credentials' | 'selector' | 'handoff'
  const [tempToken, setTempToken] = useState(null)
  const [adminInfo, setAdminInfo] = useState(null)
  const [tenants, setTenants] = useState([])
  const [esSuperAdmin, setEsSuperAdmin] = useState(false)

  // Detectar handoff por hash al montar
  useEffect(() => {
    const hash = window.location.hash || ''
    if (!hash.includes('temp=')) return

    const params = new URLSearchParams(hash.replace(/^#/, ''))
    const temp = params.get('temp')
    const tenantId = params.get('tenantId')

    if (temp && tenantId) {
      setStep('handoff')
      finalizarLogin(temp, parseInt(tenantId))
        .catch(err => {
          setError(err?.message || 'Error procesando login. Volvé a iniciar sesión.')
          setStep('credentials')
          // Limpiar hash sucio
          window.history.replaceState(null, '', window.location.pathname)
        })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function finalizarLogin(temp, tenantId) {
    const data = await api.post('/admin/select-tenant', { tempToken: temp, tenantId })
    localStorage.setItem('adminToken', data.token)
    localStorage.setItem('adminData', JSON.stringify(data.admin))
    if (data.tenant?.slug) {
      // El backend ya emite JWT con tenantId. Limpiamos cualquier override de super-admin.
      localStorage.removeItem('superadmin_tenant_slug')
    }
    await cargarPermisos()
    // Limpiar hash
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

      // Si tiene un solo tenant accesible y NO es super-admin, ir directo
      if (!data.esSuperAdmin && data.tenants?.length === 1) {
        const t = data.tenants[0]
        // Si ya estamos en el subdomain correcto, finalizar acá. Si no, redirigir.
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

  function getCurrentSubdomain() {
    const hostname = window.location.hostname
    if (hostname.includes('localhost')) {
      const m = hostname.match(/^([^.]+)\.localhost/)
      return m ? m[1] : null
    }
    const parts = hostname.split('.')
    return (parts.length > 2 && parts[0] !== 'www') ? parts[0] : null
  }

  async function elegirTenant(tenant) {
    const currentSubdomain = getCurrentSubdomain()
    if (currentSubdomain === tenant.subdomain) {
      try {
        await finalizarLogin(tempToken, tenant.id)
      } catch (err) {
        setError(err?.message || 'Error al ingresar al club')
      }
    } else {
      window.location.href = buildTenantHandoffUrl(tenant.subdomain, tempToken, tenant.id)
    }
  }

  // ─── Pantalla de handoff (procesando token de URL) ──────────────────────────
  if (step === 'handoff') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3" />
          <p className="text-sm text-gray-600">Ingresando al club...</p>
        </div>
      </div>
    )
  }

  // ─── Pantalla de selector de tenants ────────────────────────────────────────
  if (step === 'selector') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">
              Hola, {adminInfo?.nombre || adminInfo?.email}
            </h1>
            <p className="text-gray-500 mt-1">Elegí a qué club querés ingresar</p>
            {esSuperAdmin && (
              <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-md px-3 py-1 mt-3 inline-flex items-center gap-1">
                <Shield className="w-3 h-3" /> Modo super-admin: ves todos los tenants
              </p>
            )}
          </div>

          {error && <Alert type="error" className="mb-4">{error}</Alert>}

          {tenants.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
              No tenés acceso a ningún club.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {tenants.map(t => (
                <button
                  key={t.id}
                  onClick={() => elegirTenant(t)}
                  className="group bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-primary hover:shadow-md transition flex items-center gap-3"
                >
                  <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    {t.logoUrl ? (
                      <img src={t.logoUrl} alt={t.nombre} className="w-10 h-10 object-contain" />
                    ) : (
                      <Building2 className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-800 truncate group-hover:text-primary">{t.nombre}</div>
                    <div className="text-xs text-gray-500 truncate">{t.subdomain}.clubix.com</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">Rol: {t.rolEnTenant}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-primary flex-shrink-0" />
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => { setStep('credentials'); setTempToken(null); setTenants([]); setAdminInfo(null); }}
            className="mt-6 text-sm text-gray-500 hover:text-gray-700 mx-auto block"
          >
            ← Cambiar de usuario
          </button>
        </div>
      </div>
    )
  }

  // ─── Pantalla de credenciales (default) ─────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/">
            <TenantLogo className="h-16 mx-auto mb-4" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">Admin</h1>
          <p className="text-gray-500">Ingresá tus credenciales</p>
        </div>

        {error && <Alert type="error" className="mb-6">{error}</Alert>}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@sportivo.com.ar"
            autoComplete="username"
            required
          />

          <Input
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />

          <Button type="submit" className="w-full mt-4" loading={loading}>
            INGRESAR
          </Button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          <Link to="/" className="text-primary hover:underline">
            Volver al inicio
          </Link>
        </p>
      </div>
    </div>
  )
}
