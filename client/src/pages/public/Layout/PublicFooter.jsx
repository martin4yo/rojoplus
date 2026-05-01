import { Link } from 'react-router-dom'
import { MapPin, Phone, Mail, Clock, Facebook, Instagram, MessageCircle, ArrowUpRight } from 'lucide-react'
import TenantLogo from '../../../components/TenantLogo'
import { useTenant } from '../../../contexts/TenantContext'

export default function PublicFooter() {
  const currentYear = new Date().getFullYear()
  const { tenant } = useTenant()

  const redes = tenant?.redesSociales || {}
  const direccionCompleta = [tenant?.direccion, tenant?.ciudad, tenant?.provincia].filter(Boolean).join(', ')

  return (
    <footer className="text-white relative" style={{ backgroundColor: '#0A0A0B' }}>
      <div className="absolute inset-0 bg-field-grid opacity-25 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        {/* Headline gigante con CTA al lado */}
        <div className="grid md:grid-cols-12 gap-8 items-end mb-16 pb-12" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="md:col-span-8">
            <div className="pub-eyebrow text-white/70 mb-6">
              {tenant?.nombre || 'El club'}
            </div>
            <h2
              className="font-display-sport text-white"
              style={{ fontSize: 'clamp(40px, 6vw, 96px)', lineHeight: 0.92 }}
            >
              Más que<br />un <span style={{ color: 'var(--color-primary)' }}>club</span>.
            </h2>
          </div>
          <div className="md:col-span-4 md:text-right">
            <Link to="/inscripcion-socio" className="pub-cta group inline-flex">
              <span>Hacete socio</span>
              <ArrowUpRight className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Logo y Descripción */}
          <div>
            <Link to="/" className="flex items-center gap-3 mb-5">
              <TenantLogo className="h-11 w-auto" />
              <div>
                <h3 className="font-display-sport text-white" style={{ fontSize: 18, lineHeight: 1 }}>
                  {tenant?.nombre || ''}
                </h3>
                {tenant?.slogan && (
                  <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/50 mt-1">
                    {tenant.slogan}
                  </p>
                )}
              </div>
            </Link>
            {tenant?.descripcion && (
              <p className="text-white/60 text-sm leading-relaxed">{tenant.descripcion}</p>
            )}
          </div>

          {/* Links Rápidos */}
          <div>
            <h4 className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/40 mb-5">
              El club
            </h4>
            <ul className="space-y-3">
              {[
                { to: '/historia', label: 'Historia' },
                { to: '/mision', label: 'Misión y Valores' },
                { to: '/autoridades', label: 'Autoridades' },
                { to: '/instalaciones', label: 'Instalaciones' },
                { to: '/actividades', label: 'Actividades' },
                { to: '/noticias', label: 'Noticias' },
                { to: '/contacto', label: 'Contacto' },
              ].map(({ to, label }) => (
                <li key={to}>
                  <Link
                    to={to}
                    className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/60 hover:text-white transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contacto */}
          <div>
            <h4 className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/40 mb-5">
              Contacto
            </h4>
            <ul className="space-y-4">
              {direccionCompleta && (
                <li className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-primary)' }} />
                  <span className="text-white/70 text-sm leading-snug">{direccionCompleta}</span>
                </li>
              )}
              {tenant?.telefono && (
                <li className="flex items-center gap-3">
                  <Phone className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-primary)' }} />
                  <a href={`tel:${tenant.telefono.replace(/\D/g,'')}`} className="text-white/70 hover:text-white text-sm transition-colors">
                    {tenant.telefono}
                  </a>
                </li>
              )}
              {tenant?.email && (
                <li className="flex items-center gap-3">
                  <Mail className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-primary)' }} />
                  <a href={`mailto:${tenant.email}`} className="text-white/70 hover:text-white text-sm transition-colors break-all">
                    {tenant.email}
                  </a>
                </li>
              )}
              {tenant?.horarios && (
                <li className="flex items-start gap-3">
                  <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-primary)' }} />
                  <span className="text-white/70 text-sm whitespace-pre-line leading-snug">{tenant.horarios}</span>
                </li>
              )}
            </ul>
          </div>

          {/* Redes Sociales */}
          <div>
            <h4 className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/40 mb-5">
              Seguinos
            </h4>
            <div className="flex gap-2">
              {redes.facebook && (
                <SocialBox href={redes.facebook} icon={Facebook} hoverColor="#1877F2" />
              )}
              {redes.instagram && (
                <SocialBox href={redes.instagram} icon={Instagram} hoverColor="#E1306C" />
              )}
              {redes.whatsapp && (
                <SocialBox
                  href={`https://wa.me/${redes.whatsapp.replace(/\D/g,'')}`}
                  icon={MessageCircle}
                  hoverColor="#25D366"
                />
              )}
            </div>

            <div className="mt-8">
              <h4 className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/40 mb-4">
                Soy socio
              </h4>
              <div className="space-y-2">
                <Link
                  to="/login-socio"
                  className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/60 hover:text-white transition-colors block"
                >
                  Portal del socio
                </Link>
                <Link
                  to="/mi-qr"
                  className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/60 hover:text-white transition-colors block"
                >
                  QR para beneficios
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="relative" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 font-mono text-[10px] uppercase tracking-[0.25em]">
            <p className="text-white/40 text-center md:text-left">
              © {currentYear} {tenant?.nombre || ''} · Todos los derechos reservados
            </p>
            <div className="flex items-center gap-6">
              <Link to="/admin" className="text-white/30 hover:text-white/60 transition-colors">
                Gestión
              </Link>
              <p className="text-white/30">
                Hecho por <span className="text-white/60">AxiomaCloud</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

function SocialBox({ href, icon: Icon, hoverColor }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="w-10 h-10 flex items-center justify-center transition-all"
      style={{ border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.7)' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = hoverColor
        e.currentTarget.style.borderColor = hoverColor
        e.currentTarget.style.color = '#fff'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent'
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
        e.currentTarget.style.color = 'rgba(255,255,255,0.7)'
      }}
    >
      <Icon className="w-4 h-4" />
    </a>
  )
}
