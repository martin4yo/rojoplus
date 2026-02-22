# Plan de Personalización Visual - RojoPlus

**Fecha:** 12 de Febrero 2026
**Estado:** Planificación
**Complejidad:** Media
**Duración estimada:** 3-4 semanas

---

## 📋 Objetivo

Permitir que cada institución personalice completamente la apariencia visual del sistema, incluyendo:
- **Paleta de colores** completa (primarios, secundarios, acentos, estados)
- **Logos** (principal, secundario, favicon, marca de agua)
- **Tipografía** personalizada
- **Imágenes** de hero/banner
- **Estilos** de componentes (bordes redondeados, sombras, etc.)

---

## 🎨 FASE 1: Modelo de Datos

### 1.1 Estructura de `paletaColores` (JSON en Institucion)

```javascript
// Campo JSON en modelo Institucion
paletaColores: {
  // Colores primarios
  primary: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',  // Color principal
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d'
  },

  // Colores secundarios
  secondary: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',  // Color secundario
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827'
  },

  // Color de acento
  accent: {
    500: '#3b82f6',  // Azul para links, badges, etc.
    600: '#2563eb'
  },

  // Estados
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',

  // Fondos
  background: {
    primary: '#ffffff',
    secondary: '#f9fafb',
    tertiary: '#f3f4f6'
  },

  // Textos
  text: {
    primary: '#111827',
    secondary: '#6b7280',
    tertiary: '#9ca3af',
    inverse: '#ffffff'
  },

  // Bordes
  border: {
    light: '#e5e7eb',
    default: '#d1d5db',
    dark: '#9ca3af'
  }
}
```

---

### 1.2 Estructura de `configUI` (JSON en Institucion)

```javascript
configUI: {
  // Tipografía
  typography: {
    fontFamily: {
      sans: 'Inter, system-ui, sans-serif',
      serif: 'Georgia, serif',
      mono: 'Monaco, monospace'
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem'
    }
  },

  // Espaciado
  spacing: {
    scale: 1.0  // Multiplicador (0.8 = más compacto, 1.2 = más espacioso)
  },

  // Bordes y esquinas
  borderRadius: {
    sm: '0.125rem',
    default: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    full: '9999px'
  },

  // Sombras
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    default: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    none: 'none'
  },

  // Estilo general
  style: {
    buttonStyle: 'rounded',  // 'rounded', 'square', 'pill'
    cardStyle: 'elevated',   // 'flat', 'elevated', 'outlined'
    inputStyle: 'outlined'   // 'filled', 'outlined', 'underlined'
  },

  // Animaciones
  animations: {
    enabled: true,
    speed: 'normal'  // 'slow', 'normal', 'fast'
  },

  // Modo oscuro
  darkMode: {
    enabled: false,
    auto: false  // Detectar preferencia del sistema
  }
}
```

---

### 1.3 Campos de Archivos en Institucion

```prisma
model Institucion {
  // ... campos existentes

  // Logos
  logoUrl              String?   // Logo principal (navbar, emails)
  logoSecundarioUrl    String?   // Logo alternativo (blanco para fondos oscuros)
  faviconUrl           String?   // Favicon 32x32
  logoMarcaAguaUrl     String?   // Marca de agua para PDFs

  // Imágenes de marca
  heroImageUrl         String?   // Imagen hero homepage
  loginBackgroundUrl   String?   // Fondo pantalla login
  emailHeaderUrl       String?   // Header emails

  // Personalización visual
  paletaColores        Json?
  configUI             Json?

  // ... resto de campos
}
```

---

## 🎨 FASE 2: Sistema de Temas con CSS Variables

### 2.1 Archivo CSS Base con Variables

```css
/* client/src/styles/theme.css */

:root {
  /* Colores primarios */
  --color-primary-50: #fef2f2;
  --color-primary-100: #fee2e2;
  --color-primary-200: #fecaca;
  --color-primary-300: #fca5a5;
  --color-primary-400: #f87171;
  --color-primary-500: #ef4444;  /* Principal */
  --color-primary-600: #dc2626;
  --color-primary-700: #b91c1c;
  --color-primary-800: #991b1b;
  --color-primary-900: #7f1d1d;

  /* Colores secundarios */
  --color-secondary-50: #f9fafb;
  --color-secondary-100: #f3f4f6;
  --color-secondary-200: #e5e7eb;
  --color-secondary-300: #d1d5db;
  --color-secondary-400: #9ca3af;
  --color-secondary-500: #6b7280;
  --color-secondary-600: #4b5563;
  --color-secondary-700: #374151;
  --color-secondary-800: #1f2937;
  --color-secondary-900: #111827;

  /* Accent */
  --color-accent: #3b82f6;
  --color-accent-dark: #2563eb;

  /* Estados */
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-info: #3b82f6;

  /* Fondos */
  --bg-primary: #ffffff;
  --bg-secondary: #f9fafb;
  --bg-tertiary: #f3f4f6;

  /* Textos */
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --text-tertiary: #9ca3af;
  --text-inverse: #ffffff;

  /* Bordes */
  --border-light: #e5e7eb;
  --border-default: #d1d5db;
  --border-dark: #9ca3af;

  /* Tipografía */
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-serif: 'Georgia', serif;
  --font-mono: 'Monaco', 'Courier New', monospace;

  /* Tamaños de fuente */
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;
  --text-3xl: 1.875rem;
  --text-4xl: 2.25rem;

  /* Espaciado base */
  --spacing-scale: 1.0;

  /* Bordes redondeados */
  --radius-sm: 0.125rem;
  --radius-default: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-full: 9999px;

  /* Sombras */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-default: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);

  /* Transiciones */
  --transition-fast: 150ms;
  --transition-normal: 200ms;
  --transition-slow: 300ms;
}

/* Clases de utilidad usando variables */
.bg-primary {
  background-color: var(--color-primary-500);
}

.text-primary {
  color: var(--text-primary);
}

.border-default {
  border-color: var(--border-default);
}

/* Botón primario con variables */
.btn-primary {
  background-color: var(--color-primary-600);
  color: var(--text-inverse);
  padding: 0.5rem 1rem;
  border-radius: var(--radius-default);
  transition: all var(--transition-normal) ease;
}

.btn-primary:hover {
  background-color: var(--color-primary-700);
  box-shadow: var(--shadow-md);
}
```

---

### 2.2 Extender Tailwind con Variables

```javascript
// client/tailwind.config.js

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Usar CSS variables en Tailwind
        primary: {
          50: 'var(--color-primary-50)',
          100: 'var(--color-primary-100)',
          200: 'var(--color-primary-200)',
          300: 'var(--color-primary-300)',
          400: 'var(--color-primary-400)',
          500: 'var(--color-primary-500)',
          600: 'var(--color-primary-600)',
          700: 'var(--color-primary-700)',
          800: 'var(--color-primary-800)',
          900: 'var(--color-primary-900)',
        },
        secondary: {
          50: 'var(--color-secondary-50)',
          100: 'var(--color-secondary-100)',
          200: 'var(--color-secondary-200)',
          300: 'var(--color-secondary-300)',
          400: 'var(--color-secondary-400)',
          500: 'var(--color-secondary-500)',
          600: 'var(--color-secondary-600)',
          700: 'var(--color-secondary-700)',
          800: 'var(--color-secondary-800)',
          900: 'var(--color-secondary-900)',
        },
        accent: 'var(--color-accent)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        error: 'var(--color-error)',
        info: 'var(--color-info)',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        serif: 'var(--font-serif)',
        mono: 'var(--font-mono)',
      },
      borderRadius: {
        'default': 'var(--radius-default)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
        'xl': 'var(--radius-xl)',
      },
      boxShadow: {
        'sm': 'var(--shadow-sm)',
        'DEFAULT': 'var(--shadow-default)',
        'md': 'var(--shadow-md)',
        'lg': 'var(--shadow-lg)',
        'xl': 'var(--shadow-xl)',
      }
    }
  },
  plugins: []
}
```

---

### 2.3 Servicio de Aplicación de Tema

```javascript
// client/src/services/themeService.js

export class ThemeService {
  /**
   * Aplica la paleta de colores de la institución
   */
  static aplicarPaletaColores(paletaColores) {
    if (!paletaColores) return

    const root = document.documentElement

    // Aplicar colores primarios
    if (paletaColores.primary) {
      Object.entries(paletaColores.primary).forEach(([shade, color]) => {
        root.style.setProperty(`--color-primary-${shade}`, color)
      })
    }

    // Aplicar colores secundarios
    if (paletaColores.secondary) {
      Object.entries(paletaColores.secondary).forEach(([shade, color]) => {
        root.style.setProperty(`--color-secondary-${shade}`, color)
      })
    }

    // Aplicar accent
    if (paletaColores.accent) {
      root.style.setProperty('--color-accent', paletaColores.accent[500])
      root.style.setProperty('--color-accent-dark', paletaColores.accent[600])
    }

    // Aplicar estados
    if (paletaColores.success) {
      root.style.setProperty('--color-success', paletaColores.success)
    }
    if (paletaColores.warning) {
      root.style.setProperty('--color-warning', paletaColores.warning)
    }
    if (paletaColores.error) {
      root.style.setProperty('--color-error', paletaColores.error)
    }
    if (paletaColores.info) {
      root.style.setProperty('--color-info', paletaColores.info)
    }

    // Aplicar fondos
    if (paletaColores.background) {
      root.style.setProperty('--bg-primary', paletaColores.background.primary)
      root.style.setProperty('--bg-secondary', paletaColores.background.secondary)
      root.style.setProperty('--bg-tertiary', paletaColores.background.tertiary)
    }

    // Aplicar textos
    if (paletaColores.text) {
      root.style.setProperty('--text-primary', paletaColores.text.primary)
      root.style.setProperty('--text-secondary', paletaColores.text.secondary)
      root.style.setProperty('--text-tertiary', paletaColores.text.tertiary)
      root.style.setProperty('--text-inverse', paletaColores.text.inverse)
    }

    // Aplicar bordes
    if (paletaColores.border) {
      root.style.setProperty('--border-light', paletaColores.border.light)
      root.style.setProperty('--border-default', paletaColores.border.default)
      root.style.setProperty('--border-dark', paletaColores.border.dark)
    }
  }

  /**
   * Aplica la configuración de UI
   */
  static aplicarConfigUI(configUI) {
    if (!configUI) return

    const root = document.documentElement

    // Tipografía
    if (configUI.typography?.fontFamily) {
      const { sans, serif, mono } = configUI.typography.fontFamily
      if (sans) root.style.setProperty('--font-sans', sans)
      if (serif) root.style.setProperty('--font-serif', serif)
      if (mono) root.style.setProperty('--font-mono', mono)
    }

    // Bordes redondeados
    if (configUI.borderRadius) {
      Object.entries(configUI.borderRadius).forEach(([size, value]) => {
        root.style.setProperty(`--radius-${size}`, value)
      })
    }

    // Sombras
    if (configUI.shadows) {
      Object.entries(configUI.shadows).forEach(([size, value]) => {
        const name = size === 'default' ? 'shadow-default' : `shadow-${size}`
        root.style.setProperty(`--${name}`, value)
      })
    }

    // Espaciado
    if (configUI.spacing?.scale) {
      root.style.setProperty('--spacing-scale', configUI.spacing.scale)
    }

    // Animaciones
    if (configUI.animations?.speed) {
      const speeds = {
        slow: { fast: '250ms', normal: '350ms', slow: '500ms' },
        normal: { fast: '150ms', normal: '200ms', slow: '300ms' },
        fast: { fast: '100ms', normal: '150ms', slow: '200ms' }
      }
      const speed = speeds[configUI.animations.speed] || speeds.normal
      root.style.setProperty('--transition-fast', speed.fast)
      root.style.setProperty('--transition-normal', speed.normal)
      root.style.setProperty('--transition-slow', speed.slow)
    }

    // Aplicar clases de estilo
    this.aplicarEstilos(configUI.style)
  }

  /**
   * Aplica estilos globales según preferencias
   */
  static aplicarEstilos(style) {
    if (!style) return

    const body = document.body

    // Estilo de botones
    if (style.buttonStyle) {
      body.classList.remove('btn-rounded', 'btn-square', 'btn-pill')
      body.classList.add(`btn-${style.buttonStyle}`)
    }

    // Estilo de cards
    if (style.cardStyle) {
      body.classList.remove('card-flat', 'card-elevated', 'card-outlined')
      body.classList.add(`card-${style.cardStyle}`)
    }

    // Estilo de inputs
    if (style.inputStyle) {
      body.classList.remove('input-filled', 'input-outlined', 'input-underlined')
      body.classList.add(`input-${style.inputStyle}`)
    }
  }

  /**
   * Actualiza el favicon
   */
  static actualizarFavicon(faviconUrl) {
    if (!faviconUrl) return

    let link = document.querySelector("link[rel~='icon']")
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = faviconUrl
  }

  /**
   * Actualiza el título de la página
   */
  static actualizarTitulo(nombreInstitucion) {
    document.title = nombreInstitucion || 'RojoPlus'
  }

  /**
   * Aplica tema completo
   */
  static aplicarTemaCompleto(institucion) {
    if (!institucion) return

    // Aplicar colores
    this.aplicarPaletaColores(institucion.paletaColores)

    // Aplicar configuración UI
    this.aplicarConfigUI(institucion.configUI)

    // Actualizar favicon
    this.actualizarFavicon(institucion.faviconUrl)

    // Actualizar título
    this.actualizarTitulo(institucion.nombre)

    // Guardar en localStorage para persistencia
    localStorage.setItem('theme', JSON.stringify({
      paletaColores: institucion.paletaColores,
      configUI: institucion.configUI
    }))
  }

  /**
   * Genera paleta de colores a partir de un color base
   * Útil para el editor de temas
   */
  static generarPaleta(colorBase) {
    // Usar librería como chroma.js o color2k para generar tonos
    // Por ahora, retornar estructura básica
    return {
      50: lighten(colorBase, 0.9),
      100: lighten(colorBase, 0.8),
      200: lighten(colorBase, 0.6),
      300: lighten(colorBase, 0.4),
      400: lighten(colorBase, 0.2),
      500: colorBase,
      600: darken(colorBase, 0.2),
      700: darken(colorBase, 0.4),
      800: darken(colorBase, 0.6),
      900: darken(colorBase, 0.8)
    }
  }
}

// Funciones auxiliares de color
function lighten(color, amount) {
  // Implementar con librería de color
}

function darken(color, amount) {
  // Implementar con librería de color
}
```

---

## 🎨 FASE 3: Modificar InstitucionContext

```jsx
// client/src/contexts/InstitucionContext.jsx

import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'
import { ThemeService } from '../services/themeService'

const InstitucionContext = createContext()

export function InstitucionProvider({ children }) {
  const [institucion, setInstitucion] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargarInstitucion()
  }, [])

  async function cargarInstitucion() {
    try {
      // Primero intentar cargar tema del localStorage (más rápido)
      const cachedTheme = localStorage.getItem('theme')
      if (cachedTheme) {
        const theme = JSON.parse(cachedTheme)
        ThemeService.aplicarPaletaColores(theme.paletaColores)
        ThemeService.aplicarConfigUI(theme.configUI)
      }

      // Luego cargar datos actualizados del servidor
      const response = await api.get('/public/institucion')
      setInstitucion(response.data)

      // Aplicar tema completo
      ThemeService.aplicarTemaCompleto(response.data)
    } catch (error) {
      console.error('Error cargando institución:', error)
    } finally {
      setLoading(false)
    }
  }

  async function actualizarPersonalizacion(datos) {
    try {
      const response = await api.put('/admin/institucion/personalizacion', datos)
      setInstitucion(response.data)
      ThemeService.aplicarTemaCompleto(response.data)
      return response.data
    } catch (error) {
      console.error('Error actualizando personalización:', error)
      throw error
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <InstitucionContext.Provider
      value={{
        institucion,
        setInstitucion,
        actualizarPersonalizacion
      }}
    >
      {children}
    </InstitucionContext.Provider>
  )
}

export function useInstitucion() {
  const context = useContext(InstitucionContext)
  if (!context) {
    throw new Error('useInstitucion debe usarse dentro de InstitucionProvider')
  }
  return context
}
```

---

## 🎨 FASE 4: Editor de Personalización (Admin)

### 4.1 Página de Personalización

```jsx
// client/src/pages/admin/configuracion/Personalizacion.jsx

import { useState, useEffect } from 'react'
import { useInstitucion } from '../../../contexts/InstitucionContext'
import { ThemeService } from '../../../services/themeService'
import ColorPicker from '../../../components/ColorPicker'
import ImageUploader from '../../../components/ImageUploader'

export default function Personalizacion() {
  const { institucion, actualizarPersonalizacion } = useInstitucion()

  const [activeTab, setActiveTab] = useState('colores')
  const [form, setForm] = useState({
    // Logos
    logoUrl: '',
    logoSecundarioUrl: '',
    faviconUrl: '',
    heroImageUrl: '',

    // Colores
    paletaColores: null,

    // UI
    configUI: null
  })

  const [preview, setPreview] = useState(false)

  useEffect(() => {
    if (institucion) {
      setForm({
        logoUrl: institucion.logoUrl || '',
        logoSecundarioUrl: institucion.logoSecundarioUrl || '',
        faviconUrl: institucion.faviconUrl || '',
        heroImageUrl: institucion.heroImageUrl || '',
        paletaColores: institucion.paletaColores || getDefaultPalette(),
        configUI: institucion.configUI || getDefaultConfig()
      })
    }
  }, [institucion])

  function getDefaultPalette() {
    // Retornar paleta por defecto (rojo del club)
    return {
      primary: ThemeService.generarPaleta('#DC2626'),
      secondary: ThemeService.generarPaleta('#1F2937'),
      accent: { 500: '#3B82F6', 600: '#2563EB' },
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
      info: '#3B82F6'
    }
  }

  function getDefaultConfig() {
    return {
      typography: {
        fontFamily: {
          sans: 'Inter, sans-serif',
          serif: 'Georgia, serif',
          mono: 'Monaco, monospace'
        }
      },
      borderRadius: {
        sm: '0.125rem',
        default: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        full: '9999px'
      },
      style: {
        buttonStyle: 'rounded',
        cardStyle: 'elevated',
        inputStyle: 'outlined'
      },
      animations: {
        enabled: true,
        speed: 'normal'
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()

    try {
      await actualizarPersonalizacion(form)
      alert('Personalización guardada con éxito')
    } catch (error) {
      alert('Error al guardar: ' + error.message)
    }
  }

  function handlePreview() {
    setPreview(!preview)
    if (!preview) {
      ThemeService.aplicarTemaCompleto({
        ...institucion,
        ...form
      })
    } else {
      ThemeService.aplicarTemaCompleto(institucion)
    }
  }

  function updateColor(path, value) {
    // path ejemplo: 'primary.500', 'success'
    const keys = path.split('.')
    const updated = { ...form.paletaColores }

    if (keys.length === 1) {
      updated[keys[0]] = value
    } else if (keys.length === 2) {
      updated[keys[0]] = {
        ...updated[keys[0]],
        [keys[1]]: value
      }
    }

    setForm({ ...form, paletaColores: updated })
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Personalización Visual</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handlePreview}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            {preview ? 'Cancelar Vista Previa' : 'Vista Previa'}
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
          >
            Guardar Cambios
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4">
          <Tab active={activeTab === 'colores'} onClick={() => setActiveTab('colores')}>
            Colores
          </Tab>
          <Tab active={activeTab === 'logos'} onClick={() => setActiveTab('logos')}>
            Logos e Imágenes
          </Tab>
          <Tab active={activeTab === 'tipografia'} onClick={() => setActiveTab('tipografia')}>
            Tipografía
          </Tab>
          <Tab active={activeTab === 'estilos'} onClick={() => setActiveTab('estilos')}>
            Estilos
          </Tab>
        </nav>
      </div>

      {/* Tab: Colores */}
      {activeTab === 'colores' && (
        <TabColores
          paletaColores={form.paletaColores}
          onChange={updateColor}
        />
      )}

      {/* Tab: Logos */}
      {activeTab === 'logos' && (
        <TabLogos
          logos={{
            logoUrl: form.logoUrl,
            logoSecundarioUrl: form.logoSecundarioUrl,
            faviconUrl: form.faviconUrl,
            heroImageUrl: form.heroImageUrl
          }}
          onChange={(field, url) => setForm({ ...form, [field]: url })}
        />
      )}

      {/* Tab: Tipografía */}
      {activeTab === 'tipografia' && (
        <TabTipografia
          config={form.configUI}
          onChange={(config) => setForm({ ...form, configUI: config })}
        />
      )}

      {/* Tab: Estilos */}
      {activeTab === 'estilos' && (
        <TabEstilos
          config={form.configUI}
          onChange={(config) => setForm({ ...form, configUI: config })}
        />
      )}
    </div>
  )
}

function Tab({ children, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 border-b-2 font-medium transition-colors ${
        active
          ? 'border-primary-600 text-primary-600'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  )
}
```

---

### 4.2 Tab de Colores

```jsx
// client/src/pages/admin/configuracion/personalizacion/TabColores.jsx

import ColorPicker from '../../../../components/ColorPicker'

export function TabColores({ paletaColores, onChange }) {
  return (
    <div className="space-y-8">
      {/* Color Primario */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Color Primario</h3>
        <p className="text-sm text-gray-600 mb-4">
          Color principal de la institución. Se usa en botones, links, headers, etc.
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[500, 600, 700].map(shade => (
            <ColorPicker
              key={shade}
              label={`Tono ${shade}`}
              value={paletaColores?.primary?.[shade]}
              onChange={(color) => onChange(`primary.${shade}`, color)}
            />
          ))}
        </div>

        {/* Generador automático de tonos */}
        <button
          type="button"
          onClick={() => {
            const baseColor = paletaColores?.primary?.[500] || '#DC2626'
            const generated = ThemeService.generarPaleta(baseColor)
            // Actualizar todos los tonos
            Object.entries(generated).forEach(([shade, color]) => {
              onChange(`primary.${shade}`, color)
            })
          }}
          className="mt-4 text-sm text-primary-600 hover:text-primary-700"
        >
          Generar tonos automáticamente desde tono 500
        </button>
      </section>

      {/* Color Secundario */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Color Secundario</h3>
        <p className="text-sm text-gray-600 mb-4">
          Color para elementos secundarios, fondos, bordes.
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[500, 600, 700].map(shade => (
            <ColorPicker
              key={shade}
              label={`Tono ${shade}`}
              value={paletaColores?.secondary?.[shade]}
              onChange={(color) => onChange(`secondary.${shade}`, color)}
            />
          ))}
        </div>
      </section>

      {/* Color de Acento */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Color de Acento</h3>
        <p className="text-sm text-gray-600 mb-4">
          Para badges, notificaciones, elementos destacados.
        </p>
        <ColorPicker
          label="Color de acento"
          value={paletaColores?.accent?.[500]}
          onChange={(color) => onChange('accent.500', color)}
        />
      </section>

      {/* Estados */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Colores de Estado</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <ColorPicker
            label="Éxito"
            value={paletaColores?.success}
            onChange={(color) => onChange('success', color)}
          />
          <ColorPicker
            label="Advertencia"
            value={paletaColores?.warning}
            onChange={(color) => onChange('warning', color)}
          />
          <ColorPicker
            label="Error"
            value={paletaColores?.error}
            onChange={(color) => onChange('error', color)}
          />
          <ColorPicker
            label="Información"
            value={paletaColores?.info}
            onChange={(color) => onChange('info', color)}
          />
        </div>
      </section>

      {/* Preview de colores */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Vista Previa</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <PreviewCard color={paletaColores?.primary?.[600]} label="Botón Primario" />
          <PreviewCard color={paletaColores?.secondary?.[600]} label="Botón Secundario" />
          <PreviewCard color={paletaColores?.accent?.[500]} label="Badge" />
        </div>
      </section>
    </div>
  )
}

function PreviewCard({ color, label }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="text-sm text-gray-600 mb-2">{label}</div>
      <button
        style={{ backgroundColor: color }}
        className="w-full py-2 px-4 text-white rounded-lg font-medium"
      >
        Ejemplo
      </button>
    </div>
  )
}
```

---

### 4.3 Tab de Logos

```jsx
// client/src/pages/admin/configuracion/personalizacion/TabLogos.jsx

import ImageUploader from '../../../../components/ImageUploader'

export function TabLogos({ logos, onChange }) {
  return (
    <div className="space-y-8">
      {/* Logo Principal */}
      <section>
        <h3 className="text-lg font-semibold mb-2">Logo Principal</h3>
        <p className="text-sm text-gray-600 mb-4">
          Se muestra en el navbar, emails, PDFs. Recomendado: 200x60px, fondo transparente.
        </p>
        <ImageUploader
          value={logos.logoUrl}
          onChange={(url) => onChange('logoUrl', url)}
          aspectRatio="auto"
          maxSizeMB={1}
        />
      </section>

      {/* Logo Secundario */}
      <section>
        <h3 className="text-lg font-semibold mb-2">Logo Secundario (Opcional)</h3>
        <p className="text-sm text-gray-600 mb-4">
          Versión alternativa para fondos oscuros. Usualmente en color blanco.
        </p>
        <ImageUploader
          value={logos.logoSecundarioUrl}
          onChange={(url) => onChange('logoSecundarioUrl', url)}
          aspectRatio="auto"
          maxSizeMB={1}
        />
      </section>

      {/* Favicon */}
      <section>
        <h3 className="text-lg font-semibold mb-2">Favicon</h3>
        <p className="text-sm text-gray-600 mb-4">
          Ícono que aparece en la pestaña del navegador. Recomendado: 32x32px o 64x64px.
        </p>
        <ImageUploader
          value={logos.faviconUrl}
          onChange={(url) => onChange('faviconUrl', url)}
          aspectRatio="1:1"
          maxSizeMB={0.5}
        />
      </section>

      {/* Hero Image */}
      <section>
        <h3 className="text-lg font-semibold mb-2">Imagen Hero (Homepage)</h3>
        <p className="text-sm text-gray-600 mb-4">
          Imagen destacada de la página de inicio. Recomendado: 1920x600px.
        </p>
        <ImageUploader
          value={logos.heroImageUrl}
          onChange={(url) => onChange('heroImageUrl', url)}
          aspectRatio="16:5"
          maxSizeMB={2}
        />
      </section>
    </div>
  )
}
```

---

### 4.4 Componente ColorPicker

```jsx
// client/src/components/ColorPicker.jsx

import { useState } from 'react'
import { HexColorPicker } from 'react-colorful'
import 'react-colorful/dist/index.css'

export default function ColorPicker({ label, value, onChange }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}

      <div className="relative">
        {/* Botón con muestra de color */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-3 w-full px-3 py-2 border border-gray-300 rounded-lg hover:border-gray-400 transition"
        >
          <div
            className="w-8 h-8 rounded border border-gray-300"
            style={{ backgroundColor: value }}
          />
          <span className="flex-1 text-left font-mono text-sm">
            {value || '#000000'}
          </span>
        </button>

        {/* Picker desplegable */}
        {isOpen && (
          <>
            {/* Overlay para cerrar */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />

            {/* Picker */}
            <div className="absolute z-20 mt-2 p-3 bg-white border border-gray-200 rounded-lg shadow-lg">
              <HexColorPicker
                color={value}
                onChange={onChange}
              />

              {/* Input manual */}
              <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="mt-3 w-full px-3 py-2 border border-gray-300 rounded font-mono text-sm"
                placeholder="#000000"
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

---

### 4.5 Componente ImageUploader

```jsx
// client/src/components/ImageUploader.jsx

import { useState } from 'react'
import { Upload, X, Image as ImageIcon } from 'lucide-react'
import api from '../services/api'

export default function ImageUploader({
  value,
  onChange,
  aspectRatio = 'auto',
  maxSizeMB = 2
}) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(value)

  async function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tamaño
    if (file.size > maxSizeMB * 1024 * 1024) {
      alert(`El archivo debe pesar menos de ${maxSizeMB}MB`)
      return
    }

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      alert('Solo se permiten imágenes')
      return
    }

    setUploading(true)

    try {
      // Crear FormData
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'branding')

      // Upload
      const response = await api.post('/admin/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      const imageUrl = response.data.url
      setPreview(imageUrl)
      onChange(imageUrl)
    } catch (error) {
      console.error('Error subiendo imagen:', error)
      alert('Error al subir la imagen')
    } finally {
      setUploading(false)
    }
  }

  function handleRemove() {
    setPreview(null)
    onChange(null)
  }

  return (
    <div>
      {preview ? (
        <div className="relative inline-block">
          <img
            src={preview}
            alt="Preview"
            className="max-w-xs max-h-40 border border-gray-200 rounded-lg"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            {uploading ? (
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            ) : (
              <>
                <Upload className="w-10 h-10 text-gray-400 mb-3" />
                <p className="text-sm text-gray-600 font-medium">
                  Click para seleccionar imagen
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Máximo {maxSizeMB}MB
                </p>
              </>
            )}
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />
        </label>
      )}
    </div>
  )
}
```

---

## 🎨 FASE 5: Backend - Endpoints

### 5.1 Endpoint Público de Institución

```javascript
// server/src/routes/public.js

router.get('/institucion', async (req, res) => {
  try {
    // Resolver institución por subdominio
    const host = req.hostname
    const subdomain = host.split('.')[0]

    const institucion = await prisma.institucion.findFirst({
      where: {
        OR: [
          { subdominio: subdomain },
          { estado: 'ACTIVO' } // Fallback para localhost
        ]
      },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        nombreCorto: true,
        logoUrl: true,
        logoSecundarioUrl: true,
        faviconUrl: true,
        heroImageUrl: true,
        paletaColores: true,
        configUI: true,
        // NO exponer datos sensibles
      }
    })

    if (!institucion) {
      return res.status(404).json({ error: 'Institución no encontrada' })
    }

    res.json(institucion)
  } catch (error) {
    console.error('Error obteniendo institución:', error)
    res.status(500).json({ error: 'Error del servidor' })
  }
})
```

---

### 5.2 Endpoint Admin para Actualizar Personalización

```javascript
// server/src/routes/admin.js

router.put('/institucion/personalizacion',
  authAdmin,
  checkPermiso('CONFIG_EDITAR'),
  async (req, res) => {
    try {
      const {
        logoUrl,
        logoSecundarioUrl,
        faviconUrl,
        heroImageUrl,
        paletaColores,
        configUI
      } = req.body

      // Actualizar institución
      const institucion = await prisma.institucion.update({
        where: { id: req.user.institucionId },
        data: {
          logoUrl,
          logoSecundarioUrl,
          faviconUrl,
          heroImageUrl,
          paletaColores,
          configUI
        }
      })

      res.json(institucion)
    } catch (error) {
      console.error('Error actualizando personalización:', error)
      res.status(500).json({ error: 'Error del servidor' })
    }
  }
)
```

---

## 🎨 FASE 6: Presets de Temas

### 6.1 Temas Predefinidos

```javascript
// client/src/constants/themePresets.js

export const THEME_PRESETS = {
  rojo_clasico: {
    nombre: 'Rojo Clásico',
    descripcion: 'Tema tradicional con rojo intenso',
    paletaColores: {
      primary: {
        500: '#DC2626',
        600: '#B91C1C',
        700: '#991B1B'
      },
      secondary: {
        500: '#1F2937',
        600: '#111827',
        700: '#030712'
      },
      accent: { 500: '#3B82F6' },
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
      info: '#3B82F6'
    }
  },

  azul_moderno: {
    nombre: 'Azul Moderno',
    descripcion: 'Tema fresco y profesional',
    paletaColores: {
      primary: {
        500: '#2563EB',
        600: '#1D4ED8',
        700: '#1E40AF'
      },
      secondary: {
        500: '#64748B',
        600: '#475569',
        700: '#334155'
      },
      accent: { 500: '#8B5CF6' },
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
      info: '#3B82F6'
    }
  },

  verde_natural: {
    nombre: 'Verde Natural',
    descripcion: 'Tema cálido y acogedor',
    paletaColores: {
      primary: {
        500: '#059669',
        600: '#047857',
        700: '#065F46'
      },
      secondary: {
        500: '#78716C',
        600: '#57534E',
        700: '#44403C'
      },
      accent: { 500: '#F59E0B' },
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
      info: '#3B82F6'
    }
  }
}
```

---

### 6.2 Selector de Presets en UI

```jsx
// En TabColores.jsx

<section>
  <h3 className="text-lg font-semibold mb-4">Temas Predefinidos</h3>
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    {Object.entries(THEME_PRESETS).map(([key, preset]) => (
      <button
        key={key}
        onClick={() => {
          // Aplicar preset
          setForm({
            ...form,
            paletaColores: preset.paletaColores
          })
        }}
        className="p-4 border border-gray-200 rounded-lg hover:border-primary-500 transition text-left"
      >
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-8 h-8 rounded"
            style={{ backgroundColor: preset.paletaColores.primary[500] }}
          />
          <div className="font-medium">{preset.nombre}</div>
        </div>
        <p className="text-sm text-gray-600">{preset.descripcion}</p>
      </button>
    ))}
  </div>
</section>
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### Preparación
- [ ] Instalar dependencias: `react-colorful`, `chroma-js`
- [ ] Crear archivo `theme.css` con variables
- [ ] Extender Tailwind config con variables

### Base de Datos
- [ ] Agregar campos de personalización a modelo `Institucion`
- [ ] Migrar base de datos
- [ ] Poblar con valores por defecto

### Backend
- [ ] Endpoint GET `/public/institucion` (datos de tema)
- [ ] Endpoint PUT `/admin/institucion/personalizacion`
- [ ] Endpoint POST `/admin/upload` (imágenes de branding)
- [ ] Carpeta `uploads/branding/` con permisos

### Frontend - Core
- [ ] Servicio `ThemeService` completo
- [ ] Modificar `InstitucionContext` para aplicar tema
- [ ] Crear componente `<ColorPicker>`
- [ ] Crear componente `<ImageUploader>`
- [ ] Importar `theme.css` en `main.jsx`

### Frontend - Editor
- [ ] Página `/admin/configuracion/personalizacion`
- [ ] Tab de Colores con presets
- [ ] Tab de Logos
- [ ] Tab de Tipografía
- [ ] Tab de Estilos
- [ ] Vista previa en tiempo real

### Testing
- [ ] Test de aplicación de tema
- [ ] Test de upload de imágenes
- [ ] Test de guardado de personalización
- [ ] Test responsive del editor

### Documentación
- [ ] Guía de uso del editor de temas
- [ ] Recomendaciones de dimensiones de imágenes
- [ ] Guía de paletas de colores

---

## 📅 CRONOGRAMA

### Semana 1: Base y Core
- Días 1-2: Modelo de datos y migración
- Días 3-4: ThemeService y CSS variables
- Día 5: InstitucionContext con tema

### Semana 2: Componentes Básicos
- Días 1-2: ColorPicker y ImageUploader
- Días 3-4: Endpoints backend
- Día 5: Tests unitarios

### Semana 3: Editor UI
- Días 1-2: Página de personalización base
- Días 3-4: Tabs de Colores y Logos
- Día 5: Tabs de Tipografía y Estilos

### Semana 4: Pulido y Testing
- Días 1-2: Vista previa y presets
- Días 3-4: Testing completo
- Día 5: Documentación y deploy

---

**FIN DEL PLAN DE PERSONALIZACIÓN VISUAL**

Este plan debe revisarse y ajustarse antes de iniciar la implementación. Se integra perfectamente con el Plan Multi-Tenant.
