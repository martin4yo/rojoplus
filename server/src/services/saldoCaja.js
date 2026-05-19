/**
 * Helpers para validación de saldo de caja con soporte de descubierto.
 *
 * Una caja puede tener:
 *   - permiteSaldoNegativo=false → no puede ir abajo de 0 (default histórico)
 *   - permiteSaldoNegativo=true, limiteDescubierto=null → descubierto sin tope
 *   - permiteSaldoNegativo=true, limiteDescubierto=N → puede bajar hasta -N
 */

/**
 * Devuelve el saldo mínimo permitido para la caja.
 * 0 si no permite negativo; -limiteDescubierto si tiene tope; -Infinity si es ilimitado.
 */
export function pisoSaldoCaja(caja) {
  if (!caja?.permiteSaldoNegativo) return 0
  if (caja.limiteDescubierto == null) return Number.NEGATIVE_INFINITY
  return -Number(caja.limiteDescubierto)
}

/**
 * Valida que aplicar un egreso de `monto` sobre el saldo actual respete el piso.
 * @returns {{ valido: boolean, piso: number, saldoResultante: number }}
 */
export function validarLimiteEgreso(caja, saldoActual, monto) {
  const piso = pisoSaldoCaja(caja)
  const saldoResultante = Number(saldoActual) - Number(monto)
  return { valido: saldoResultante >= piso, piso, saldoResultante }
}

/**
 * Construye un mensaje de error consistente para saldo insuficiente / descubierto excedido.
 */
export function mensajeSaldoInsuficiente({ caja, disponible, requerido, contexto = '' }) {
  const fmt = n => Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const piso = pisoSaldoCaja(caja)
  const prefijo = contexto ? `${contexto}: ` : ''
  if (piso === 0) {
    return `${prefijo}Saldo insuficiente en ${caja.nombre}. Disponible: $${fmt(disponible)}, requerido: $${fmt(requerido)}`
  }
  if (piso === Number.NEGATIVE_INFINITY) {
    return `${prefijo}Error inesperado validando saldo en ${caja.nombre} (descubierto ilimitado).`
  }
  return `${prefijo}Excede el límite de descubierto en ${caja.nombre}. Disponible: $${fmt(disponible)}, requerido: $${fmt(requerido)}, límite: $${fmt(-piso)}`
}
