/**
 * API helper para la Tienda Online (público + comprador autenticado).
 *
 * Diferente de services/api.js porque:
 *  - Usa el token JWT del ShopCustomer (no el de admin)
 *  - Apunta a /api/tienda/*
 */
const API_URL = import.meta.env.VITE_API_URL || '/api'
const TOKEN_KEY = 'tiendaToken'
const CUSTOMER_KEY = 'tiendaCustomer'

function getCurrentTenantSlug() {
  const hostname = window.location.hostname
  if (hostname.includes('localhost')) {
    const m = hostname.match(/^([^.]+)\.localhost/)
    if (m) return m[1]
  } else {
    const parts = hostname.split('.')
    if (parts.length > 2 && parts[0] !== 'www') return parts[0]
  }
  return null
}

async function request(path, opts = {}, returnFull = false) {
  const url = `${API_URL}${path}`
  const headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  }
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) headers.Authorization = `Bearer ${token}`
  const tenantSlug = getCurrentTenantSlug()
  if (tenantSlug) headers['X-Tenant-Slug'] = tenantSlug

  const res = await fetch(url, { ...opts, headers })
  let data = null
  try { data = await res.json() } catch { data = null }
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || data?.error || 'Error en la solicitud'
    const err = new Error(msg)
    err.code = data?.code || data?.error?.code || null
    err.status = res.status
    err.details = data?.error?.details || data?.details || null
    throw err
  }
  return returnFull ? data : data.data
}

export const tiendaApi = {
  // Auth
  setToken(token, customer) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token)
      if (customer) localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer))
    }
  },
  getToken: () => localStorage.getItem(TOKEN_KEY),
  getCustomer: () => {
    const raw = localStorage.getItem(CUSTOMER_KEY)
    return raw ? JSON.parse(raw) : null
  },
  logout() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(CUSTOMER_KEY)
  },

  // Shop (público)
  getConfig: () => request('/tienda/config'),
  getProductos: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/tienda/productos${qs ? `?${qs}` : ''}`)
  },
  getProducto: (id) => request(`/tienda/productos/${id}`),
  checkout: (body) => request('/tienda/checkout', { method: 'POST', body: JSON.stringify(body) }),
  getPedidoPorRef: (ref) => request(`/tienda/pedidos/${encodeURIComponent(ref)}`),
  getMisPedidos: () => request('/tienda/mis-pedidos'),

  // Auth comprador
  register: (body) => request('/tienda/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/tienda/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  magicLink: (email) => request('/tienda/auth/magic-link', { method: 'POST', body: JSON.stringify({ email }) }),
  verifyEmail: (token) => request(`/tienda/auth/verify-email?token=${encodeURIComponent(token)}`),
  verifyMagic: (token) => request(`/tienda/auth/verify-magic?token=${encodeURIComponent(token)}`),
  resendVerification: (email) => request('/tienda/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) }),
  me: () => request('/tienda/auth/me'),
}

export default tiendaApi
