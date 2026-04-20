import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, ChevronDown } from 'lucide-react'
import { useTenant } from '../../../contexts/TenantContext'
import TenantLogo from '../../../components/TenantLogo'

export default function PublicHeader() {
  const { tenant } = useTenant()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [socioMenuOpen, setSocioMenuOpen] = useState(false)
  const [clubMenuOpen, setClubMenuOpen] = useState(false)
  const location = useLocation()

  const isActive = (path) => location.pathname === path

  const navLinks = [
    { path: '/', label: 'Inicio' },
    { path: '/actividades', label: 'Actividades' },
    { path: '/instalaciones', label: 'Instalaciones' },
    { path: '/menu-buffet', label: 'Buffet' },
    { path: '/noticias', label: 'Noticias' },
    { path: '/comercios', label: 'Beneficios' },
    { path: '/nosotros', label: 'Nosotros', submenu: [
      { path: '/historia', label: 'Historia' },
      { path: '/mision', label: 'Misión y Valores' },
      { path: '/autoridades', label: 'Autoridades' },
    ]},
  ]

  return (
    <header className="bg-gray-300 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 md:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 flex-shrink-0 relative z-10">
            <TenantLogo className="h-12 md:h-14 w-auto" fallbackSrc="/images/LogoClubixSolo.png" />
            <div className="hidden sm:block">
              <h1 className="text-lg md:text-xl font-bold text-gray-900 whitespace-nowrap">{tenant?.nombre || ''}</h1>
              {tenant?.slogan && <p className="text-xs text-primary font-medium whitespace-nowrap">{tenant.slogan}</p>}
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1 ml-4">
            {navLinks.map(link => (
              link.submenu ? (
                <div key={link.path} className="relative">
                  <button
                    onClick={() => setClubMenuOpen(!clubMenuOpen)}
                    onBlur={() => setTimeout(() => setClubMenuOpen(false), 150)}
                    className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      link.submenu.some(sub => isActive(sub.path))
                        ? 'bg-primary-50 text-primary'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {link.label}
                    <ChevronDown className={`w-4 h-4 transition-transform ${clubMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {clubMenuOpen && (
                    <div className="absolute left-0 mt-2 w-48 bg-gray-200 rounded-lg shadow-lg border border-gray-300 py-2 z-50">
                      {link.submenu.map(sub => (
                        <Link
                          key={sub.path}
                          to={sub.path}
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-primary-50 hover:text-primary"
                        >
                          {sub.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive(link.path)
                      ? 'bg-primary-50 text-primary'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {link.label}
                </Link>
              )
            ))}

            {/* Dropdown Soy Socio */}
            <div className="relative">
              <button
                onClick={() => setSocioMenuOpen(!socioMenuOpen)}
                onBlur={() => setTimeout(() => setSocioMenuOpen(false), 150)}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors whitespace-nowrap"
              >
                Soy Socio
                <ChevronDown className={`w-4 h-4 transition-transform ${socioMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {socioMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-gray-200 rounded-lg shadow-lg border border-gray-300 py-2 z-50">
                  <Link
                    to="/login-socio"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-primary-50 hover:text-primary"
                  >
                    Portal del Socio
                  </Link>
                  <Link
                    to="/mi-qr"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-primary-50 hover:text-primary"
                  >
                    QR para Beneficios
                  </Link>
                </div>
              )}
            </div>

            {/* CTA Button */}
            <Link
              to="/inscripcion-socio"
              className="ml-3 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark transition-colors shadow-sm whitespace-nowrap"
            >
              Quiero ser Socio
            </Link>
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-4 border-t border-gray-100">
            <nav className="flex flex-col gap-1">
              {navLinks.map(link => (
                link.submenu ? (
                  <div key={link.path}>
                    <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">{link.label}</p>
                    {link.submenu.map(sub => (
                      <Link
                        key={sub.path}
                        to={sub.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`px-6 py-3 rounded-lg text-sm font-medium transition-colors ${
                          isActive(sub.path)
                            ? 'bg-primary-50 text-primary'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      isActive(link.path)
                        ? 'bg-primary-50 text-primary'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              ))}

              <div className="border-t border-gray-100 my-2 pt-2">
                <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Soy Socio</p>
                <Link
                  to="/login-socio"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Portal del Socio
                </Link>
                <Link
                  to="/mi-qr"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  QR para Beneficios
                </Link>
              </div>

              <Link
                to="/inscripcion-socio"
                onClick={() => setMobileMenuOpen(false)}
                className="mx-4 mt-2 px-5 py-3 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark transition-colors text-center"
              >
                Quiero ser Socio
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
