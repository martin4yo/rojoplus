import { errorStore } from '../stores/errorStore'

const API_URL = import.meta.env.VITE_API_URL || '/api'

// Función para manejar token inválido
function handleInvalidToken() {
  localStorage.removeItem('adminToken')
  localStorage.removeItem('adminData')
  // Redirigir al login si estamos en una ruta de admin
  if (window.location.pathname.startsWith('/admin') && window.location.pathname !== '/admin/login') {
    window.location.href = '/admin/login'
  }
}

/**
 * Extrae el subdomain del hostname actual del browser.
 * Ej: clubix-sport.localhost → clubix-sport
 *     sportivopilar.localhost → sportivopilar
 *     localhost → null (usa DEFAULT_TENANT_SUBDOMAIN del backend)
 */
function getCurrentTenantSlug() {
  // Prioridad 1: subdomain real en la URL (siempre gana)
  const hostname = window.location.hostname
  if (hostname.includes('localhost')) {
    const match = hostname.match(/^([^.]+)\.localhost/)
    if (match) return match[1]
  } else {
    const parts = hostname.split('.')
    if (parts.length > 2 && parts[0] !== 'www') return parts[0]
  }

  // Prioridad 2: superadmin seleccionó un tenant (solo cuando no hay subdomain)
  const selected = localStorage.getItem('superadmin_tenant_slug')
  if (selected) return selected

  return null
}

async function request(endpoint, options = {}, returnFullResponse = false) {
  const { params, ...restOptions } = options
  let url = `${API_URL}${endpoint}`
  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    ).toString()
    if (qs) url += `?${qs}`
  }

  const isFormData = restOptions.body instanceof FormData
  const config = {
    headers: {
      ...(!isFormData && { 'Content-Type': 'application/json' }),
      ...restOptions.headers,
    },
    ...restOptions,
  }

  // Agregar token JWT si existe (para admin)
  const token = localStorage.getItem('adminToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  // Enviar tenant slug como header para que el backend identifique el tenant
  const tenantSlug = getCurrentTenantSlug()
  if (tenantSlug) {
    config.headers['X-Tenant-Slug'] = tenantSlug
  }

  try {
    const response = await fetch(url, config)

    // Limpiar el error de conexión cuando hay respuesta válida
    errorStore.setConnectionError(false)

    // Verificar si la respuesta es JSON
    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      console.error('La respuesta no es JSON:', url, 'Content-Type:', contentType)
      const text = await response.text()
      console.error('Contenido recibido:', text.substring(0, 200))
      // Probable bad gateway / nginx error / backend caído pero accesible
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        errorStore.setConnectionError(true, { code: 'SERVER_DOWN', status: response.status })
      }
      throw new Error('El servidor no devolvió JSON. Verifique que el backend esté corriendo correctamente.')
    }

    const data = await response.json()

    if (!response.ok) {
      // Si el token es inválido o expiró, redirigir al login
      if (response.status === 401) {
        handleInvalidToken()
      }
      // Base de datos no disponible (503 o flag específico)
      if (
        response.status === 503 ||
        data?.error === 'DATABASE_UNAVAILABLE' ||
        data?.code === 'DATABASE_UNAVAILABLE'
      ) {
        errorStore.setConnectionError(true, { code: 'DATABASE_UNAVAILABLE', status: response.status })
      }
      // Manejar error como string o como objeto con message
      const errorMessage = typeof data.error === 'string'
        ? data.error
        : (data.error?.message || data.message || 'Error en la solicitud')
      const err = new Error(errorMessage)
      err.code = data?.code || data?.error?.code || null
      err.status = response.status
      throw err
    }

    return returnFullResponse ? data : data.data
  } catch (error) {
    // Manejar errores de red (servidor no responde)
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      const networkError = new Error('No se pudo conectar con el servidor. Verifica tu conexión a internet.')
      networkError.code = 'ERR_NETWORK'
      errorStore.setConnectionError(true, { code: 'ERR_NETWORK' })
      throw networkError
    }
    // Re-lanzar otros errores
    throw error
  }
}

const api = {
  get: (endpoint, options = {}) => request(endpoint, { method: 'GET', ...options }),

  // Devuelve la respuesta completa (con pagination, etc.)
  getFull: (endpoint) => request(endpoint, { method: 'GET' }, true),

  post: (endpoint, body) => {
    const isFormData = body instanceof FormData
    return request(endpoint, { method: 'POST', body: isFormData ? body : JSON.stringify(body) })
  },

  // Devuelve la respuesta completa del POST
  postFull: (endpoint, body) => request(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  }, true),

  patch: (endpoint, body) => request(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(body),
  }),

  put: (endpoint, body) => {
    const isFormData = body instanceof FormData
    return request(endpoint, { method: 'PUT', body: isFormData ? body : JSON.stringify(body) })
  },

  delete: (endpoint) => request(endpoint, { method: 'DELETE' }),

  // Para descargar archivos binarios (PDF, etc.)
  downloadFile: async (endpoint, body) => {
    const url = `${API_URL}${endpoint}`
    const token = localStorage.getItem('adminToken')
    const tenantSlug = getCurrentTenantSlug()

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(tenantSlug && { 'X-Tenant-Slug': tenantSlug }),
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      // Intentar leer el error como JSON
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json()
        const errorMessage = typeof data.error === 'string'
          ? data.error
          : (data.error?.message || data.message || 'Error al descargar archivo')
        throw new Error(errorMessage)
      }
      throw new Error('Error al descargar archivo')
    }

    return response
  },

  // Para upload de archivos
  upload: async (endpoint, file) => {
    try {
      const formData = new FormData()
      formData.append('file', file)

      const token = localStorage.getItem('adminToken')
      const headers = {}
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }
      const tenantSlug = getCurrentTenantSlug()
      if (tenantSlug) {
        headers['X-Tenant-Slug'] = tenantSlug
      }

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData,
      })

      const data = await response.json()
      if (!response.ok) {
        if (response.status === 401) {
          handleInvalidToken()
        }
        const errorMessage = typeof data.error === 'string'
          ? data.error
          : (data.error?.message || data.message || 'Error en la solicitud')
        throw new Error(errorMessage)
      }
      return data.data
    } catch (error) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        const networkError = new Error('No se pudo conectar con el servidor. Verifica tu conexión a internet.')
        networkError.code = 'ERR_NETWORK'
        throw networkError
      }
      throw error
    }
  },

  // Para enviar FormData generico (sin Content-Type para que el browser lo maneje)
  postFormData: async (endpoint, formData) => {
    try {
      const token = localStorage.getItem('adminToken')
      const headers = {}
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }
      const tenantSlug = getCurrentTenantSlug()
      if (tenantSlug) {
        headers['X-Tenant-Slug'] = tenantSlug
      }

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData,
      })

      const data = await response.json()
      if (!response.ok) {
        if (response.status === 401) {
          handleInvalidToken()
        }
        const errorMessage = typeof data.error === 'string'
          ? data.error
          : (data.error?.message || data.message || 'Error en la solicitud')
        throw new Error(errorMessage)
      }
      return data
    } catch (error) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        const networkError = new Error('No se pudo conectar con el servidor. Verifica tu conexión a internet.')
        networkError.code = 'ERR_NETWORK'
        throw networkError
      }
      throw error
    }
  },
}

export default api
