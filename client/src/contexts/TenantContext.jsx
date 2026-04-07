import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const TenantContext = createContext()

const DEFAULT_SLUG = import.meta.env.VITE_DEFAULT_TENANT_SLUG || 'clubix-sport'

/**
 * Devuelve el slug efectivo del tenant actual.
 * Prioridad: subdomain real > superadmin_tenant_slug > slug resuelto por dominio custom > DEFAULT_SLUG
 */
function getEffectiveSlug() {
  // Prioridad 1: subdomain real en la URL (siempre gana)
  const hostname = window.location.hostname
  if (hostname.includes('localhost')) {
    const match = hostname.match(/^([^.]+)\.localhost/)
    if (match) return match[1]
  } else {
    const parts = hostname.split('.')
    if (parts.length > 2 && parts[0] !== 'www') return parts[0]
  }

  // Prioridad 2: superadmin eligió un tenant (solo cuando no hay subdomain)
  const selected = localStorage.getItem('superadmin_tenant_slug')
  if (selected) return selected

  // Prioridad 3: slug resuelto desde dominio custom (guardado tras el primer fetch)
  const resolved = localStorage.getItem('resolved_tenant_slug')
  if (resolved) return resolved

  return DEFAULT_SLUG
}

function getCacheKey(slug) {
  return `tenant_colores_${slug || getEffectiveSlug()}`
}

const CSS_VARS = [
  '--color-primary', '--color-primary-dark', '--color-primary-light',
  '--color-secondary', '--color-secondary-dark', '--color-secondary-light',
  '--color-accent', '--color-success', '--color-warning', '--color-error', '--color-info',
  '--color-bg-primary', '--color-bg-secondary', '--color-text-primary', '--color-text-secondary', '--color-border',
  '--color-primary-50', '--color-primary-100', '--color-primary-200', '--color-primary-300', '--color-primary-400'
]

function resetTheme() {
  const root = document.documentElement
  CSS_VARS.forEach(v => root.style.removeProperty(v))
}

function applyTheme(colores) {
  if (!colores || typeof colores !== 'object' || Object.keys(colores).length === 0) {
    return
  }

  const root = document.documentElement
  const colorMap = {
    primario: '--color-primary',
    primarioOscuro: '--color-primary-dark',
    primarioClaro: '--color-primary-light',
    secundario: '--color-secondary',
    secundarioOscuro: '--color-secondary-dark',
    secundarioClaro: '--color-secondary-light',
    acento: '--color-accent',
    exito: '--color-success',
    advertencia: '--color-warning',
    error: '--color-error',
    info: '--color-info',
    fondoPrincipal: '--color-bg-primary',
    fondoSecundario: '--color-bg-secondary',
    textoPrincipal: '--color-text-primary',
    textoSecundario: '--color-text-secondary',
    borde: '--color-border'
  }

  Object.entries(colorMap).forEach(([key, cssVar]) => {
    const value = colores[key]
    if (value) root.style.setProperty(cssVar, value)
  })

  // Shades derivados del primario
  const primario = colores.primario || '#DC2626'
  root.style.setProperty('--color-primary-50',  `color-mix(in srgb, ${primario} 8%, white)`)
  root.style.setProperty('--color-primary-100', `color-mix(in srgb, ${primario} 15%, white)`)
  root.style.setProperty('--color-primary-200', `color-mix(in srgb, ${primario} 25%, white)`)
  root.style.setProperty('--color-primary-300', `color-mix(in srgb, ${primario} 40%, white)`)
  root.style.setProperty('--color-primary-400', `color-mix(in srgb, ${primario} 65%, white)`)
}

// Aplicar colores desde cache ANTES del primer render (evita FOUC).
// Usamos getEffectiveSlug() que replica la misma lógica que api.js,
// así el cache coincide exactamente con lo que devolverá la API.
try {
  const currentKey = getCacheKey()
  // Limpiar claves stale de otros tenants (pueden causar flash incorrecto)
  Object.keys(localStorage)
    .filter(k => k.startsWith('tenant_colores_') && k !== currentKey)
    .forEach(k => localStorage.removeItem(k))

  const cached = localStorage.getItem(currentKey)
  if (cached) applyTheme(JSON.parse(cached))
} catch (_) {}

export function TenantProvider({ children }) {
  const [tenant, setTenant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchCurrentTenant()
  }, [])

  async function fetchCurrentTenant() {
    try {
      setLoading(true)
      const response = await api.getFull('/tenant/current')
      const tenantData = response?.data || response
      setTenant(tenantData)

      // Resetear CSS vars del tenant anterior antes de aplicar las nuevas
      resetTheme()

      const colores = tenantData?.colores || {}
      applyTheme(colores)

      // Guardar el slug resuelto por el backend para que en visitas futuras
      // (con dominio custom sin subdomain) el cache key sea correcto y no haya FOUC
      if (tenantData?.subdomain) {
        try { localStorage.setItem('resolved_tenant_slug', tenantData.subdomain) } catch (_) {}
      }

      // Siempre actualizar el cache (incluso si está vacío),
      // así la próxima visita no aplica datos stale de otra sesión
      try {
        localStorage.setItem(getCacheKey(tenantData?.subdomain), JSON.stringify(colores))
      } catch (_) {}

      applyFavicon(tenantData?.faviconUrl || tenantData?.logoUrl)
      applyTitle(tenantData?.nombre)
      setError(null)
    } catch (err) {
      console.error('Error cargando tenant:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function applyFavicon(faviconUrl) {
    const src = faviconUrl || '/images/LogoClubixSolo.png'
    const srcWithBust = src + (src.includes('?') ? '&' : '?') + 'v=' + Date.now()

    // Remover todos los links de favicon existentes para forzar recarga
    document.querySelectorAll("link[rel*='icon']").forEach(el => el.remove())

    const link = document.createElement('link')
    link.rel = 'icon'
    link.type = src.endsWith('.ico') ? 'image/x-icon' : 'image/png'
    link.href = srcWithBust
    document.head.appendChild(link)
  }

  function applyTitle(nombre) {
    if (nombre) document.title = nombre
  }

  return (
    <TenantContext.Provider value={{ tenant, loading, error }}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  const context = useContext(TenantContext)
  if (!context) {
    throw new Error('useTenant debe usarse dentro de TenantProvider')
  }
  return context
}
