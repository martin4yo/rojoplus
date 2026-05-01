import { useState } from 'react'
import { Link } from 'react-router-dom'
import { QrCode, AlertCircle, Store, CheckCircle, Mail, MessageCircle, ArrowUpRight, ArrowLeft } from 'lucide-react'
import api from '../../services/api'
import { useTenant } from '../../contexts/TenantContext'
import PublicHero from '../../components/public/PublicHero'

export default function AccesoSocio() {
  const { tenant } = useTenant()
  const [busqueda, setBusqueda] = useState('')
  const [buscando, setBuscando] = useState(null) // 'email' | 'whatsapp' | null
  const [error, setError] = useState(null)
  const [enviado, setEnviado] = useState(null) // { via, destino }

  const waEnabled = tenant?.waEnabled === true

  async function enviarPorEmail() {
    if (!busqueda.trim()) return
    setBuscando('email')
    setError(null)
    try {
      const data = await api.post('/socio/enviar-qr', { busqueda: busqueda.trim() })
      setEnviado({ via: 'email', destino: data.emailEnviado || '' })
    } catch (err) {
      setError(err.message || 'No se encontró un socio con ese número o DNI')
    } finally {
      setBuscando(null)
    }
  }

  async function enviarPorWhatsApp() {
    if (!busqueda.trim()) return
    setBuscando('whatsapp')
    setError(null)
    try {
      const data = await api.post('/socio/enviar-qr-whatsapp', { busqueda: busqueda.trim() })
      setEnviado({ via: 'whatsapp', destino: data.celularEnviado || '' })
    } catch (err) {
      setError(err.message || 'No se pudo enviar por WhatsApp')
    } finally {
      setBuscando(null)
    }
  }

  return (
    <div style={{ backgroundColor: 'var(--bg-app)' }}>
      <PublicHero
        eyebrow="Beneficios"
        title="Tu QR de"
        accent="socio."
        subtitle="Mostralo en comercios adheridos para acceder a descuentos y beneficios."
        compact
      />

      <section className="py-16 md:py-24">
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
          {enviado ? (
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
              <p className="mb-4" style={{ color: 'var(--color-text-secondary, var(--text-dim))' }}>
                {enviado.via === 'whatsapp'
                  ? 'Te enviamos tu código QR de socio por WhatsApp a:'
                  : 'Te enviamos tu código QR y acceso al portal a:'}
              </p>

              <div
                className="inline-flex items-center gap-2 px-4 py-2 mb-6"
                style={{ backgroundColor: 'var(--bg-surface-hi)', border: '1px solid var(--border)' }}
              >
                {enviado.via === 'whatsapp'
                  ? <MessageCircle className="w-4 h-4" style={{ color: 'var(--success)' }} />
                  : <Mail className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />}
                <span className="font-medium text-sm" style={{ color: 'var(--color-text-primary, var(--text))' }}>{enviado.destino}</span>
              </div>

              {enviado.via !== 'whatsapp' && (
                <div
                  className="p-4 mb-6 text-sm"
                  style={{ border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)', backgroundColor: 'var(--warning-soft)', color: 'var(--warning)' }}
                >
                  <strong className="font-mono text-[10px] uppercase tracking-[0.2em] block mb-1">¿No llega?</strong>
                  Revisá tu carpeta de spam o correo no deseado.
                </div>
              )}

              <button
                onClick={() => { setEnviado(null); setBusqueda('') }}
                className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] hover:underline"
                style={{ color: 'var(--color-text-primary, var(--text))' }}
              >
                <ArrowLeft className="w-3 h-3" /> Volver a intentar
              </button>
            </div>
          ) : (
            <div className="p-8 md:p-10" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div
                className="w-14 h-14 mb-6 flex items-center justify-center"
                style={{ backgroundColor: 'var(--accent-soft)' }}
              >
                <QrCode className="w-7 h-7" style={{ color: 'var(--accent)' }} />
              </div>
              <div className="pub-eyebrow mb-3" style={{ color: 'var(--text-muted)' }}>Pedí tu QR</div>
              <h2
                className="font-display-sport mb-3"
                style={{ fontSize: 'clamp(28px, 4vw, 48px)', lineHeight: 0.96, color: 'var(--color-text-primary, var(--text))' }}
              >
                Acceso a beneficios.
              </h2>
              <p className="mb-8 text-sm" style={{ color: 'var(--color-text-secondary, var(--text-dim))' }}>
                Ingresá tu número de socio o DNI y te enviamos el link de acceso{waEnabled ? ' por email o WhatsApp' : ' a tu email registrado'}.
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
                    Número de socio o DNI
                  </label>
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => { setBusqueda(e.target.value); setError(null) }}
                    placeholder="Ej: 12345 o 30123456"
                    className="input-field"
                    disabled={buscando !== null}
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && enviarPorEmail()}
                  />
                </div>

                <button
                  type="button"
                  onClick={enviarPorEmail}
                  disabled={buscando !== null || !busqueda.trim()}
                  className="pub-cta group w-full"
                  style={{ opacity: (buscando !== null || !busqueda.trim()) ? 0.6 : 1 }}
                >
                  <span className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {buscando === 'email' ? 'Enviando…' : 'Enviar por email'}
                  </span>
                  <ArrowUpRight className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </button>

                {waEnabled && (
                  <button
                    type="button"
                    onClick={enviarPorWhatsApp}
                    disabled={buscando !== null || !busqueda.trim()}
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
                      opacity: (buscando !== null || !busqueda.trim()) ? 0.6 : 1,
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4" />
                      {buscando === 'whatsapp' ? 'Enviando…' : 'Enviar por WhatsApp'}
                    </span>
                    <ArrowUpRight className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  </button>
                )}
              </div>

              <div
                className="mt-8 p-4"
                style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface-hi)' }}
              >
                <h3 className="font-mono text-[10px] uppercase tracking-[0.25em] mb-3" style={{ color: 'var(--text-muted)' }}>
                  ¿Cómo funciona?
                </h3>
                <ol className="text-sm space-y-2 leading-relaxed list-decimal list-inside" style={{ color: 'var(--color-text-secondary, var(--text-dim))' }}>
                  <li>Ingresá tu número de socio o DNI</li>
                  <li>Elegí recibir el link por {waEnabled ? 'email o WhatsApp' : 'email'}</li>
                  <li>Abrí el link y guardalo en tu celular</li>
                  <li>Mostrá el QR en comercios adheridos</li>
                </ol>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <Link
              to="/comercios"
              className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.25em] hover:underline"
              style={{ color: 'var(--accent)' }}
            >
              <Store className="w-4 h-4" />
              Comercios adheridos →
            </Link>
            <Link
              to="/login-socio"
              className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.25em] hover:underline"
              style={{ color: 'var(--color-text-secondary, var(--text-dim))' }}
            >
              ¿Ya tenés acceso? Recuperar →
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
