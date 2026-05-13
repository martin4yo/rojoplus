/**
 * Variables disponibles en plantillas client-side para campañas de recupero,
 * comunicaciones, etc. Equivalente al `buildVariablesSocio` del backend.
 *
 * Soporta tanto {{nombre}} (Handlebars-style) como {nombre} (legacy).
 */

export function parseNombreSocio(socio) {
  const an = (socio?.apellidoNombre || '').trim()
  if (!an) return { nombre: '', apellido: '', nombreCompleto: '' }
  if (an.includes(',')) {
    const [apellido, ...resto] = an.split(',')
    const nombre = resto.join(',').trim().split(/\s+/)[0] || ''
    return { nombre, apellido: apellido.trim(), nombreCompleto: an }
  }
  const parts = an.split(/\s+/)
  return {
    nombre: parts[0] || '',
    apellido: parts.slice(1).join(' '),
    nombreCompleto: an,
  }
}

export function buildVariablesSocio(socio, extras = {}) {
  const { nombre, apellido, nombreCompleto } = parseNombreSocio(socio)
  return {
    nombre,
    apellido,
    nombreCompleto,
    nroSocio: socio?.nroSocio ?? '',
    ...extras,
  }
}

/**
 * Reemplaza las variables {{var}} y {var} en el texto por los valores del bag.
 * Si una variable no existe en el bag, se reemplaza por '' (no se deja el placeholder).
 */
export function renderTemplate(texto, variables = {}) {
  if (!texto) return ''
  return String(texto)
    .replace(/\{\{(\w+)\}\}/g, (_, key) => (variables[key] != null ? String(variables[key]) : ''))
    .replace(/\{(\w+)\}/g, (_, key) => (variables[key] != null ? String(variables[key]) : ''))
}

/**
 * Helper combinado: renderiza el template usando los datos del socio.
 */
export function renderTemplateSocio(texto, socio, extras = {}) {
  return renderTemplate(texto, buildVariablesSocio(socio, extras))
}

// Lista de variables disponibles para mostrar como ayuda en la UI
export const VARS_SOCIO = [
  { key: 'nombre', desc: 'Primer nombre' },
  { key: 'apellido', desc: 'Apellido' },
  { key: 'nombreCompleto', desc: 'Apellido y nombre completos' },
  { key: 'nroSocio', desc: 'Número de socio' },
]
