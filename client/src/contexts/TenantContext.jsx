import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const TenantContext = createContext()

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
      applyTheme(tenantData?.colores)
      applyFavicon(tenantData?.faviconUrl)
      applyTitle(tenantData?.nombre)
      setError(null)
    } catch (err) {
      console.error('Error cargando tenant:', err)
      setError(err.message)
      // Aplicar tema por defecto si hay error
      applyDefaultTheme()
    } finally {
      setLoading(false)
    }
  }

  /**
   * Aplica los colores del tenant como CSS variables en el DOM
   */
  function applyTheme(colores) {
    if (!colores || typeof colores !== 'object') {
      applyDefaultTheme()
      return
    }

    const root = document.documentElement

    // Mapear colores JSON a CSS variables
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
      if (value) {
        root.style.setProperty(cssVar, value)
      }
    })
  }

  /**
   * Aplica tema por defecto
   */
  function applyDefaultTheme() {
    const root = document.documentElement
    const defaults = {
      '--color-primary': '#DC2626',
      '--color-primary-dark': '#991B1B',
      '--color-primary-light': '#FCA5A5',
      '--color-secondary': '#7C3AED',
      '--color-secondary-dark': '#5B21B6',
      '--color-secondary-light': '#C4B5FD',
      '--color-accent': '#22D3EE',
      '--color-success': '#10B981',
      '--color-warning': '#F59E0B',
      '--color-error': '#EF4444',
      '--color-info': '#3B82F6',
      '--color-bg-primary': '#FFFFFF',
      '--color-bg-secondary': '#F9FAFB',
      '--color-text-primary': '#111827',
      '--color-text-secondary': '#6B7280',
      '--color-border': '#E5E7EB'
    }

    Object.entries(defaults).forEach(([cssVar, value]) => {
      root.style.setProperty(cssVar, value)
    })
  }

  /**
   * Aplica el favicon del tenant
   */
  function applyFavicon(faviconUrl) {
    if (!faviconUrl) return

    const link = document.querySelector("link[rel~='icon']") ||
                 document.querySelector("link[rel='icon']")

    if (link) {
      link.href = faviconUrl
    } else {
      // Crear si no existe
      const newLink = document.createElement('link')
      newLink.rel = 'icon'
      newLink.href = faviconUrl
      document.head.appendChild(newLink)
    }
  }

  /**
   * Aplica el título del tenant en el navegador
   */
  function applyTitle(nombre) {
    if (nombre) {
      document.title = `${nombre} - Admin`
    }
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
