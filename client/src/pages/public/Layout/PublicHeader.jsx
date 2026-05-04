import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, ChevronDown, ArrowUpRight, ShoppingBag } from 'lucide-react'
import { useTenant } from '../../../contexts/TenantContext'
import TenantLogo from '../../../components/TenantLogo'
import { useShopCart } from '../../../contexts/ShopCartContext'

export default function PublicHeader() {
  const { tenant } = useTenant()
  const { totalItems } = useShopCart()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [socioMenuOpen, setSocioMenuOpen] = useState(false)
  const [clubMenuOpen, setClubMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()

  const isActive = (path) => location.pathname === path

  // Detectar scroll para cambiar el background del header
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const navLinks = [
    { path: '/', label: 'Inicio' },
    { path: '/actividades', label: 'Actividades' },
    { path: '/instalaciones', label: 'Instalaciones' },
    { path: '/menu-buffet', label: 'Buffet' },
    { path: '/tienda', label: 'Tienda' },
    { path: '/noticias', label: 'Noticias' },
    { path: '/comercios', label: 'Beneficios' },
    { path: '/nosotros', label: 'Nosotros', submenu: [
      { path: '/historia', label: 'Historia' },
      { path: '/mision', label: 'Misión y Valores' },
      { path: '/autoridades', label: 'Autoridades' },
    ]},
  ]

  const baseLink = "px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors whitespace-nowrap"
  const activeLink = "text-pub-fg"
  const inactiveLink = "text-pub-fg-60 hover:text-pub-fg"

  return (
    <header
      className="sticky top-0 z-50 transition-all duration-300"
      style={{
        backgroundColor: scrolled
          ? 'color-mix(in srgb, var(--pub-hero-bg) 92%, transparent)'
          : 'color-mix(in srgb, var(--pub-hero-bg) 55%, transparent)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: scrolled
          ? '1px solid color-mix(in srgb, var(--pub-hero-fg) 8%, transparent)'
          : '1px solid transparent',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 md:h-20">
          {/* Logo + nombre */}
          <Link to="/" className="flex items-center gap-3 flex-shrink-0 relative z-10">
            <TenantLogo className="h-10 md:h-11 w-auto" fallbackSrc="/images/LogoClubixSolo.png" />
            <div className="hidden sm:block leading-tight">
              <h1 className="font-display-sport text-pub-fg text-base md:text-lg whitespace-nowrap" style={{ fontSize: 18, lineHeight: 1 }}>
                {tenant?.nombre || ''}
              </h1>
              {tenant?.slogan && (
                <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-pub-fg-50 whitespace-nowrap mt-0.5">
                  {tenant.slogan}
                </p>
              )}
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
                    className={`flex items-center gap-1 ${baseLink} ${
                      link.submenu.some(sub => isActive(sub.path)) ? activeLink : inactiveLink
                    }`}
                  >
                    {link.label}
                    <ChevronDown className={`w-3 h-3 transition-transform ${clubMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {clubMenuOpen && (
                    <div
                      className="absolute left-0 mt-1 w-52 py-2 z-50"
                      style={{
                        backgroundColor: 'color-mix(in srgb, var(--pub-hero-bg) 96%, transparent)',
                        backdropFilter: 'blur(14px)',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      {link.submenu.map(sub => (
                        <Link
                          key={sub.path}
                          to={sub.path}
                          className="block px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-pub-fg-60 hover:text-pub-fg hover:bg-pub-fg-10 transition-colors"
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
                  className={`${baseLink} ${isActive(link.path) ? activeLink : inactiveLink}`}
                >
                  {link.label}
                </Link>
              )
            ))}

            {/* Dropdown Soy Socio */}
            <div className="relative ml-2">
              <button
                onClick={() => setSocioMenuOpen(!socioMenuOpen)}
                onBlur={() => setTimeout(() => setSocioMenuOpen(false), 150)}
                className={`flex items-center gap-1 ${baseLink} ${inactiveLink}`}
              >
                Soy socio
                <ChevronDown className={`w-3 h-3 transition-transform ${socioMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {socioMenuOpen && (
                <div
                  className="absolute right-0 mt-1 w-56 py-2 z-50"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--pub-hero-bg) 96%, transparent)',
                    backdropFilter: 'blur(14px)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <Link
                    to="/login-socio"
                    className="block px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-pub-fg-60 hover:text-pub-fg hover:bg-pub-fg-10"
                  >
                    Portal del socio
                  </Link>
                  <Link
                    to="/mi-qr"
                    className="block px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-pub-fg-60 hover:text-pub-fg hover:bg-pub-fg-10"
                  >
                    QR para beneficios
                  </Link>
                </div>
              )}
            </div>

            {/* Cart icon */}
            <Link
              to="/tienda/carrito"
              className="relative ml-2 p-2 text-pub-fg-70 hover:text-pub-fg transition"
              title="Carrito"
            >
              <ShoppingBag className="w-5 h-5" />
              {totalItems > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
                  style={{ background: 'var(--color-primary)', color: 'var(--accent-fg, #fff)' }}
                >
                  {totalItems}
                </span>
              )}
            </Link>

            {/* CTA Button */}
            <Link
              to="/inscripcion-socio"
              className="ml-3 group inline-flex items-center gap-2 px-4 py-2.5 transition-all"
              style={{
                background: 'var(--color-primary)',
                color: 'var(--accent-fg, #ffffff)',
                borderRadius: 0,
              }}
            >
              <span className="font-mono uppercase tracking-[0.2em] text-[11px] font-semibold whitespace-nowrap">
                Hacete socio
              </span>
              <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-pub-fg"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-4 border-t border-pub-fg-10">
            <nav className="flex flex-col gap-1">
              {navLinks.map(link => (
                link.submenu ? (
                  <div key={link.path}>
                    <p className="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-pub-fg-40">
                      {link.label}
                    </p>
                    {link.submenu.map(sub => (
                      <Link
                        key={sub.path}
                        to={sub.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`block px-6 py-3 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors ${
                          isActive(sub.path) ? 'text-pub-fg bg-pub-fg-10' : 'text-pub-fg-60 hover:text-pub-fg'
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
                    className={`px-4 py-3 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors ${
                      isActive(link.path) ? 'text-pub-fg bg-pub-fg-10' : 'text-pub-fg-60 hover:text-pub-fg'
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              ))}

              <div className="border-t border-pub-fg-10 my-2 pt-2">
                <p className="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-pub-fg-40">
                  Soy socio
                </p>
                <Link
                  to="/login-socio"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-6 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-pub-fg-60 hover:text-pub-fg"
                >
                  Portal del socio
                </Link>
                <Link
                  to="/mi-qr"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-6 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-pub-fg-60 hover:text-pub-fg"
                >
                  QR para beneficios
                </Link>
              </div>

              <Link
                to="/inscripcion-socio"
                onClick={() => setMobileMenuOpen(false)}
                className="mx-4 mt-3 inline-flex items-center justify-between px-5 py-4"
                style={{
                  background: 'var(--color-primary)',
                  color: 'var(--accent-fg, #ffffff)',
                }}
              >
                <span className="font-mono uppercase tracking-[0.2em] text-[12px] font-semibold">
                  Hacete socio
                </span>
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
