import express from 'express'

const router = express.Router()

// Íconos por defecto (Clubix) cuando el tenant no tiene logo cargado.
const ICONOS_CLUBIX = [
  { src: '/images/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/images/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
]

function normalizarUrl(u) {
  if (!u) return null
  if (/^https?:\/\//i.test(u)) return u
  return u.startsWith('/') ? u : `/${u}`
}

function tipoPorExtension(u) {
  const ext = (u.split('?')[0].split('.').pop() || '').toLowerCase()
  if (ext === 'svg') return 'image/svg+xml'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'webp') return 'image/webp'
  return 'image/png'
}

// Construye la lista de íconos del manifest. Si el tenant tiene logo, lo declara
// en 192 y 512 (el navegador confía en el atributo `sizes`; para mejor resultado
// el club debería subir un logo cuadrado). Si no, cae a los íconos de Clubix.
function iconosDe(tenant) {
  const logo = normalizarUrl(tenant?.logoUrl || tenant?.faviconUrl)
  if (!logo) return ICONOS_CLUBIX
  const type = tipoPorExtension(logo)
  return [
    { src: logo, sizes: '192x192', type, purpose: 'any' },
    { src: logo, sizes: '512x512', type, purpose: 'any' },
  ]
}

// GET /api/pwa/manifest?context=socio|control
// Manifest dinámico, branded por tenant. Dos contextos instalables por separado
// (distinto `id`): el portal del socio y el control de accesos (administración).
router.get('/manifest', (req, res) => {
  const tenant = req.tenant || null
  const context = req.query.context === 'control' ? 'control' : 'socio'
  const nombre = tenant?.nombre || 'Clubix'
  const themeColor = tenant?.colores?.primario || '#DC2626'

  const perfil = context === 'control'
    ? {
        id: '/pwa-control',
        name: `${nombre} · Control`,
        short_name: 'Control',
        start_url: '/admin/accesos/control-pwa',
        scope: '/admin/accesos/',
      }
    : {
        id: '/pwa-socio',
        name: `${nombre} · Socios`,
        short_name: nombre.slice(0, 12),
        start_url: '/login-socio',
        scope: '/',
      }

  res.set('Content-Type', 'application/manifest+json; charset=utf-8')
  res.set('Cache-Control', 'public, max-age=300')
  res.json({
    id: perfil.id,
    name: perfil.name,
    short_name: perfil.short_name,
    description: `${nombre} — ${context === 'control' ? 'Control de accesos' : 'Portal del socio'}`,
    start_url: perfil.start_url,
    scope: perfil.scope,
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: themeColor,
    lang: 'es',
    dir: 'ltr',
    categories: context === 'control' ? ['business', 'productivity'] : ['sports', 'lifestyle', 'social'],
    icons: iconosDe(tenant),
  })
})

export default router
