/**
 * Construye un filtro Prisma para búsqueda multi-palabra sobre campos de Socio.
 *
 * Cada palabra/número debe matchear (AND) en al menos uno de los campos:
 *   apellido, nombre, apellidoNombre, documento, cuil, nroSocio.
 *
 * Esto permite búsquedas como "VAZQUEZ MARIELA" (matchea apellido + nombre),
 * "VAZQUEZ 12345" (apellido + nro/dni), o "MARIA 30123" (nombre + dni).
 *
 * @param {string} q - texto de búsqueda
 * @returns {object|null} - filtro para incluir en `where` de Socio, o null si q vacío
 */
export function buildSocioSearchFilter(q) {
  if (!q || !String(q).trim()) return null
  const palabras = String(q).trim().split(/\s+/).filter(Boolean)
  return {
    AND: palabras.map(w => ({
      OR: [
        { apellido: { contains: w, mode: 'insensitive' } },
        { nombre: { contains: w, mode: 'insensitive' } },
        { apellidoNombre: { contains: w, mode: 'insensitive' } },
        { documento: { contains: w } },
        { cuil: { contains: w } },
        { nroSocio: { contains: w } },
      ],
    })),
  }
}
