import { Link, useLocation } from 'react-router-dom'
import { UserRound } from 'lucide-react'

// Rutas donde el FAB es redundante (ya estás en el flujo de acceso).
const RUTAS_OCULTAR = ['/login-socio', '/login-entrenador', '/mi-qr']

/**
 * Botón flotante en el sitio público para acceso rápido al portal del socio.
 * Usa el color de acento del tenant (branding). Ícono solo en mobile, pill con
 * texto en pantallas grandes.
 */
export default function PortalSocioFab() {
  const { pathname } = useLocation()
  if (RUTAS_OCULTAR.some((r) => pathname.startsWith(r))) return null

  return (
    <Link
      to="/login-socio"
      aria-label="Acceder al portal del socio"
      title="Portal del socio"
      className="fixed z-40 bottom-5 right-5 inline-flex items-center justify-center gap-2 rounded-full p-4 sm:px-6 sm:py-4 transition-transform hover:-translate-y-0.5"
      style={{
        backgroundColor: 'var(--accent)',
        color: 'var(--accent-fg)',
        fontFamily: 'Geist Mono, monospace',
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.2em',
        boxShadow: 'var(--shadow-glow, 0 8px 32px -8px rgba(0,0,0,0.4))',
      }}
    >
      <UserRound className="w-5 h-5 sm:w-4 sm:h-4" />
      <span className="hidden sm:inline">Portal del socio</span>
    </Link>
  )
}
