const API_URL = import.meta.env.VITE_API_URL || '/api'

function getHeaders() {
  const token = localStorage.getItem('adminToken')
  const hostname = window.location.hostname
  let tenantSlug = null
  if (hostname.includes('localhost')) {
    const match = hostname.match(/^([^.]+)\.localhost/)
    if (match) tenantSlug = match[1]
  } else {
    const parts = hostname.split('.')
    if (parts.length > 2 && parts[0] !== 'www') tenantSlug = parts[0]
  }
  if (!tenantSlug) tenantSlug = localStorage.getItem('superadmin_tenant_slug')

  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (tenantSlug) headers['X-Tenant-Slug'] = tenantSlug
  return headers
}

async function jsonRequest(method, path, body) {
  const opts = { method, headers: getHeaders() }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const response = await fetch(`${API_URL}${path}`, opts)
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || data.message || 'Error en la solicitud')
  return data
}

const reportPresetsApi = {
  getAll: () => jsonRequest('GET', '/admin/report-presets'),
  create: (data) => jsonRequest('POST', '/admin/report-presets', data),
  update: (id, data) => jsonRequest('PUT', `/admin/report-presets/${id}`, data),
  delete: (id) => jsonRequest('DELETE', `/admin/report-presets/${id}`),
}

export default reportPresetsApi
