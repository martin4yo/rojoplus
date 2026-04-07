import { Link } from 'react-router-dom'
import { MapPin, Phone, Mail, Clock, Facebook, Instagram, MessageCircle } from 'lucide-react'
import TenantLogo from '../../../components/TenantLogo'
import { useTenant } from '../../../contexts/TenantContext'

export default function PublicFooter() {
  const currentYear = new Date().getFullYear()
  const { tenant } = useTenant()

  const redes = tenant?.redesSociales || {}
  const direccionCompleta = [tenant?.direccion, tenant?.ciudad, tenant?.provincia].filter(Boolean).join(', ')

  return (
    <footer className="bg-gray-900 text-white">
      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Logo y Descripción */}
          <div className="lg:col-span-1">
            <Link to="/" className="flex items-center gap-3 mb-4">
              <TenantLogo className="h-12 w-auto" />
              <div>
                <h3 className="text-lg font-bold">{tenant?.nombre || ''}</h3>
                {tenant?.slogan && <p className="text-xs text-primary-400 font-medium">{tenant.slogan}</p>}
              </div>
            </Link>
            {tenant?.descripcion && (
              <p className="text-gray-400 text-sm leading-relaxed">{tenant.descripcion}</p>
            )}
          </div>

          {/* Links Rápidos */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">
              El Club
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
                  <Link to={to} className="text-gray-300 hover:text-white text-sm transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contacto */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">
              Contacto
            </h4>
            <ul className="space-y-3">
              {direccionCompleta && (
                <li className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-gray-300 text-sm">{direccionCompleta}</span>
                </li>
              )}
              {tenant?.telefono && (
                <li className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-primary flex-shrink-0" />
                  <a href={`tel:${tenant.telefono.replace(/\D/g,'')}`} className="text-gray-300 hover:text-white text-sm transition-colors">
                    {tenant.telefono}
                  </a>
                </li>
              )}
              {tenant?.email && (
                <li className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-primary flex-shrink-0" />
                  <a href={`mailto:${tenant.email}`} className="text-gray-300 hover:text-white text-sm transition-colors">
                    {tenant.email}
                  </a>
                </li>
              )}
              {tenant?.horarios && (
                <li className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-gray-300 text-sm whitespace-pre-line">{tenant.horarios}</span>
                </li>
              )}
            </ul>
          </div>

          {/* Redes Sociales */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">
              Seguinos
            </h4>
            <div className="flex gap-3">
              {redes.facebook && (
                <a href={redes.facebook} target="_blank" rel="noopener noreferrer"
                  className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors">
                  <Facebook className="w-5 h-5" />
                </a>
              )}
              {redes.instagram && (
                <a href={redes.instagram} target="_blank" rel="noopener noreferrer"
                  className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-pink-600 transition-all">
                  <Instagram className="w-5 h-5" />
                </a>
              )}
              {redes.whatsapp && (
                <a href={`https://wa.me/${redes.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
                  className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-green-600 transition-colors">
                  <MessageCircle className="w-5 h-5" />
                </a>
              )}
            </div>

            <div className="mt-6">
              <Link to="/inscripcion-socio"
                className="inline-block px-6 py-3 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark transition-colors">
                Quiero ser Socio
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-500 text-sm text-center md:text-left">
              &copy; {currentYear} {tenant?.nombre || ''}. Todos los derechos reservados.
            </p>
            <div className="flex items-center gap-4">
              <Link to="/admin" className="text-gray-600 hover:text-gray-400 text-xs transition-colors">
                Gestión
              </Link>
              <p className="text-gray-600 text-xs">
                Desarrollado con <span className="text-primary">♥</span> por{' '}
                <span className="text-gray-400">AxiomaCloud</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
