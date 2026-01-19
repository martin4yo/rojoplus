const API_URL = '/api'

async function request(endpoint, options = {}) {
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
    throw new Error(data.error?.message || 'Error en la solicitud')
  }

  return data.data
}

const api = {
  get: (endpoint) => request(endpoint, { method: 'GET' }),

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
      throw new Error(data.error?.message || 'Error en la solicitud')
    }
    return data.data
  },
}

export default api
