import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const TenantContext = createContext()

// Clave de cache en localStorage por slug de tenant
function getCacheKey() {
  const hostname = window.location.hostname
  let slug = null
  if (hostname.includes('localhost')) {
    const match = hostname.match(/^([^.]+)\.localhost/)
    slug = match ? match[1] : (localStorage.getItem('superadmin_tenant_slug') || 'default')
  } else {
    const parts = hostname.split('.')
    slug = (parts.length > 2 && parts[0] !== 'www') ? parts[0] : 'default'
  }
  return `tenant_colores_${slug}`
}

/**
 * Aplica los colores del tenant como CSS variables en el DOM
 */
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

// Aplicar colores desde cache ANTES del primer render (evita FOUC)
try {
  const cached = localStorage.getItem(getCacheKey())
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

      if (tenantData?.colores) {
        applyTheme(tenantData.colores)
        try {
          localStorage.setItem(getCacheKey(), JSON.stringify(tenantData.colores))
        } catch (_) {}
      }

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
    const link = document.querySelector("link[rel~='icon']") || document.querySelector("link[rel='icon']")
    if (link) {
      link.href = src
    } else {
      const newLink = document.createElement('link')
      newLink.rel = 'icon'
      newLink.href = src
      document.head.appendChild(newLink)
    }
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
