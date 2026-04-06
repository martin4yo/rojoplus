// API client for report templates — uses raw fetch to handle both JSON and binary responses

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

async function blobRequest(method, path, body) {
  const opts = { method, headers: getHeaders() }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const response = await fetch(`${API_URL}${path}`, opts)
  if (!response.ok) {
    let msg = 'Error al generar reporte'
    try {
      const ct = response.headers.get('content-type') || ''
      if (ct.includes('application/json')) {
        const data = await response.json()
        msg = data.error || msg
      } else {
        const text = await response.text()
        try { msg = JSON.parse(text).error || msg } catch {}
      }
    } catch {}
    throw new Error(msg)
  }
  return response.blob()
}

async function textRequest(method, path, body) {
  const opts = { method, headers: getHeaders() }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const response = await fetch(`${API_URL}${path}`, opts)
  if (!response.ok) throw new Error('Error en preview')
  return response.text()
}

export const CATEGORY_LABELS = {
  socios: 'Socios',
  finanzas: 'Finanzas',
  actividades: 'Actividades',
  deportes: 'Deportes',
  general: 'General',
}

const reportTemplatesApi = {
  getAll: () => jsonRequest('GET', '/admin/report-templates'),
  getById: (id) => jsonRequest('GET', `/admin/report-templates/${id}`),
  create: (data) => jsonRequest('POST', '/admin/report-templates', data),
  update: (id, data) => jsonRequest('PUT', `/admin/report-templates/${id}`, data),
  delete: (id) => jsonRequest('DELETE', `/admin/report-templates/${id}`),
  getQueryDefinitions: () => jsonRequest('GET', '/admin/report-templates/query-definitions'),
  getDefaultTemplate: async (queryKey) => {
    const r = await jsonRequest('GET', `/admin/report-templates/query-definitions/${queryKey}/default-template`)
    return r?.html || ''
  },
  getQuerySource: async (queryKey) => {
    const r = await jsonRequest('GET', `/admin/report-templates/query-definitions/${queryKey}/source`)
    return r?.source || ''
  },
  runReport: (id, params) => blobRequest('POST', `/admin/report-templates/${id}/run`, { params }),
  preview: ({ queryKey, customScript, htmlTemplate, pageSetup, parameters } = {}) =>
    textRequest('POST', '/admin/report-templates/preview', { queryKey, customScript, htmlTemplate, pageSetup, params: parameters }),
  previewData: async (queryKey, params) => {
    const r = await jsonRequest('POST', '/admin/report-templates/preview-data', { queryKey, params })
    return r?.data || r
  },
}

export default reportTemplatesApi
