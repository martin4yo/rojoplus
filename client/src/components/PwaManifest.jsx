import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useTenant } from '../contexts/TenantContext'

/**
 * Gestiona el manifest PWA y los metadatos de instalación según el contexto y el
 * tenant. Permite que convivan DOS PWAs instalables por separado en el mismo
 * origen, cada una con el branding del club:
 *   - Control de accesos (administración) → /admin/accesos/control-pwa
 *   - Portal del socio                    → resto de las rutas (start_url /login-socio)
 *
 * El manifest se sirve dinámicamente desde /api/pwa/manifest?context=... (branded
 * por tenant). iOS no usa el manifest para el ícono/nombre del home screen: usa
 * <link rel="apple-touch-icon"> y <meta name="apple-mobile-web-app-title">, que
 * también seteamos acá con el logo y nombre del tenant.
 */
function setMeta(name, content) {
  if (!content) return
  let m = document.querySelector(`meta[name="${name}"]`)
  if (!m) {
    m = document.createElement('meta')
    m.setAttribute('name', name)
    document.head.appendChild(m)
  }
  m.setAttribute('content', content)
}

function setLink(rel, href) {
  if (!href) return
  let l = document.querySelector(`link[rel="${rel}"]`)
  if (!l) {
    l = document.createElement('link')
    l.setAttribute('rel', rel)
    document.head.appendChild(l)
  }
  l.setAttribute('href', href)
}

export default function PwaManifest() {
  const location = useLocation()
  const { tenant } = useTenant()

  useEffect(() => {
    const context = location.pathname.startsWith('/admin/accesos/control-pwa')
      ? 'control'
      : 'socio'

    // Manifest dinámico: eliminamos cualquier <link rel="manifest"> previo (el
    // estático de index.html y el que pueda inyectar vite-plugin-pwa) y dejamos
    // sólo el nuestro, para que el navegador use el branded por tenant.
    document.querySelectorAll('link[rel="manifest"]').forEach((el) => el.remove())
    const link = document.createElement('link')
    link.setAttribute('rel', 'manifest')
    link.setAttribute('href', `/api/pwa/manifest?context=${context}`)
    document.head.appendChild(link)

    // Branding iOS + theme color
    const icono = tenant?.logoUrl || tenant?.faviconUrl
    if (icono) setLink('apple-touch-icon', icono)

    const nombre = tenant?.nombre || 'Clubix'
    setMeta('apple-mobile-web-app-title', context === 'control' ? `${nombre} Control` : nombre)

    const themeColor = tenant?.colores?.primario
    if (themeColor) setMeta('theme-color', themeColor)
  }, [location.pathname, tenant])

  return null
}
