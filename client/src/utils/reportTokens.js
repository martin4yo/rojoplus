/**
 * Report parameter tokens — resolve dynamic values at execution time.
 */

const pad = (n) => String(n).padStart(2, '0')

function toIso(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function addDays(d, n) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export const TOKENS = [
  { value: '@today', label: 'Hoy', preview: () => toIso(new Date()) },
  { value: '@yesterday', label: 'Ayer', preview: () => toIso(addDays(new Date(), -1)) },
  {
    value: '@month_start', label: 'Inicio del mes actual',
    preview: () => { const d = new Date(); return toIso(new Date(d.getFullYear(), d.getMonth(), 1)) },
  },
  {
    value: '@month_end', label: 'Fin del mes actual',
    preview: () => { const d = new Date(); return toIso(new Date(d.getFullYear(), d.getMonth() + 1, 0)) },
  },
  {
    value: '@prev_month_start', label: 'Inicio del mes anterior',
    preview: () => { const d = new Date(); return toIso(new Date(d.getFullYear(), d.getMonth() - 1, 1)) },
  },
  {
    value: '@prev_month_end', label: 'Fin del mes anterior',
    preview: () => { const d = new Date(); return toIso(new Date(d.getFullYear(), d.getMonth(), 0)) },
  },
  {
    value: '@year_start', label: 'Inicio del año actual',
    preview: () => toIso(new Date(new Date().getFullYear(), 0, 1)),
  },
  {
    value: '@year_end', label: 'Fin del año actual',
    preview: () => toIso(new Date(new Date().getFullYear(), 11, 31)),
  },
  { value: '@days_ago_7', label: 'Hace 7 días', preview: () => toIso(addDays(new Date(), -7)) },
  { value: '@days_ago_30', label: 'Hace 30 días', preview: () => toIso(addDays(new Date(), -30)) },
  { value: '@days_ago_90', label: 'Hace 90 días', preview: () => toIso(addDays(new Date(), -90)) },
  {
    value: '@quarter_start', label: 'Inicio del trimestre actual',
    preview: () => { const d = new Date(); const q = Math.floor(d.getMonth() / 3); return toIso(new Date(d.getFullYear(), q * 3, 1)) },
  },
  {
    value: '@quarter_end', label: 'Fin del trimestre actual',
    preview: () => { const d = new Date(); const q = Math.floor(d.getMonth() / 3); return toIso(new Date(d.getFullYear(), q * 3 + 3, 0)) },
  },
]

export function resolveToken(value) {
  if (!value?.startsWith('@')) return value
  const token = TOKENS.find(t => t.value === value)
  return token ? token.preview() : value
}

export function resolvePresetParams(params) {
  const result = {}
  for (const [k, v] of Object.entries(params)) {
    result[k] = resolveToken(v)
  }
  return result
}

export function isToken(value) {
  return value?.startsWith('@') && TOKENS.some(t => t.value === value)
}

export function tokenPreviewLabel(value) {
  if (!value?.startsWith('@')) return value
  const token = TOKENS.find(t => t.value === value)
  if (!token) return value
  const resolved = token.preview()
  const [y, m, d] = resolved.split('-')
  return `${d}/${m}/${y}`
}
