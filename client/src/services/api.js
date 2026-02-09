const API_URL = '/api'

// Función para manejar token inválido
function handleInvalidToken() {
  localStorage.removeItem('adminToken')
  localStorage.removeItem('adminData')
  // Redirigir al login si estamos en una ruta de admin
  if (window.location.pathname.startsWith('/admin') && window.location.pathname !== '/admin/login') {
    window.location.href = '/admin/login'
  }
}

async function request(endpoint, options = {}, returnFullResponse = false) {
  const url = `${API_URL}${endpoint}`

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  }

  // Agregar token JWT si existe (para admin)
  const token = localStorage.getItem('adminToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(url, config)
  const data = await response.json()

  if (!response.ok) {
    // Si el token es inválido o expiró, redirigir al login
    if (response.status === 401) {
      handleInvalidToken()
    }
    // Manejar error como string o como objeto con message
    const errorMessage = typeof data.error === 'string'
      ? data.error
      : (data.error?.message || data.message || 'Error en la solicitud')
    throw new Error(errorMessage)
  }

  return returnFullResponse ? data : data.data
}

const api = {
  get: (endpoint) => request(endpoint, { method: 'GET' }),

  // Devuelve la respuesta completa (con pagination, etc.)
  getFull: (endpoint) => request(endpoint, { method: 'GET' }, true),

  post: (endpoint, body) => request(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  }),

  patch: (endpoint, body) => request(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(body),
  }),

  put: (endpoint, body) => request(endpoint, {
    method: 'PUT',
    body: JSON.stringify(body),
  }),

  delete: (endpoint) => request(endpoint, { method: 'DELETE' }),

  // Para upload de archivos
  upload: async (endpoint, file) => {
    const formData = new FormData()
    formData.append('file', file)

    const token = localStorage.getItem('adminToken')
    const headers = {}
    if (token) {
      headers.Authorization = `Bearer ${token}`
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
  },

  // Para enviar FormData generico (sin Content-Type para que el browser lo maneje)
  postFormData: async (endpoint, formData) => {
    const token = localStorage.getItem('adminToken')
    const headers = {}
    if (token) {
      headers.Authorization = `Bearer ${token}`
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
  },
}

export default api
