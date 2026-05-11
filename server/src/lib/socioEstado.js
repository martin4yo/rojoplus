/**
 * Helpers para inspeccionar el estado de un Socio según su FK EstadoSocio.
 *
 * Reemplaza los chequeos legacy contra `socio.estado` string (`'VIGENTE'`,
 * `'ACTIVO'`, etc.) por consultas semánticas sobre `estadoSocioRel`.
 *
 * Para que estos helpers funcionen, el query del socio debe incluir:
 *   include: { estadoSocioRel: { select: { nombre, codigo, esSocioActivo, rolVigencia } } }
 * o el `select` equivalente.
 */

/**
 * El socio sigue siendo parte del club (no es baja/renuncia/expulsión).
 * Equivalente legacy: `estado` empieza por 'ACTIV'|'VIGENT'|'BLOQUEAD' (todo lo que no es baja).
 */
export function esSocioActivo(socio) {
  return socio?.estadoSocioRel?.esSocioActivo === true
}

/**
 * El socio puede acceder al portal/molinete: activo y no bloqueado por morosidad.
 */
export function puedeAccederPortal(socio) {
  const rel = socio?.estadoSocioRel
  if (!rel) return false
  if (rel.esSocioActivo !== true) return false
  if (rel.rolVigencia === 'BLOQUEADO') return false
  return true
}

/**
 * El socio está bloqueado por morosidad (estado con rolVigencia='BLOQUEADO').
 */
export function estaBloqueadoMorosidad(socio) {
  return socio?.estadoSocioRel?.rolVigencia === 'BLOQUEADO'
}

/**
 * Select estándar para incluir el estado completo del socio en queries.
 * Uso: `select: { ..., estadoSocioRel: SELECT_ESTADO_SOCIO_REL }`
 */
export const SELECT_ESTADO_SOCIO_REL = {
  select: { id: true, codigo: true, nombre: true, esSocioActivo: true, rolVigencia: true },
}

/**
 * Devuelve un nombre/string visible del estado. Útil para displays/exports.
 */
export function nombreEstado(socio) {
  return socio?.estadoSocioRel?.nombre || ''
}

/**
 * Devuelve un nombre/string visible de la categoría. Útil para displays/exports.
 */
export function nombreCategoria(socio) {
  return socio?.categoriaSocioRel?.nombre || ''
}

/**
 * Devuelve un nombre/string visible del tipo de socio. Útil para displays/exports.
 */
export function nombreTipoSocio(socio) {
  return socio?.tipoSocioRel?.nombre || ''
}
