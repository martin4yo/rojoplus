import crypto from 'node:crypto'

/**
 * Normaliza un texto para hashing: trim, uppercase, sin acentos, espacios colapsados,
 * sin puntuación común. Hace el hash tolerante a variaciones menores de export entre
 * descargas del mismo extracto.
 */
export function normalizarConcepto(texto) {
  if (!texto) return ''
  return String(texto)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // remover combining marks (acentos)
    .toUpperCase()
    .replace(/[.,;:_\-/\\|]/g, ' ')                      // puntuación común → espacio
    .replace(/\s+/g, ' ')                                 // colapsar espacios
    .trim()
}

/**
 * Calcula un hash determinístico para una fila del extracto bancario.
 * Componentes: fecha (YYYY-MM-DD), importe (2 decimales), tipo,
 *              concepto normalizado, referencia, numeroComprobante.
 *
 * NO incluye: saldo corrido ni fechaValor (pueden cambiar entre re-exports del banco).
 * NO incluye: cajaId (el hash describe el movimiento en sí, no su ubicación en nuestro sistema).
 */
export function calcularHashMovimiento(mov) {
  const fechaISO = mov.fecha instanceof Date
    ? mov.fecha.toISOString().slice(0, 10)
    : new Date(mov.fecha).toISOString().slice(0, 10)

  const importeStr = Number(mov.importe).toFixed(2)
  const tipo = (mov.tipo || '').toUpperCase()
  const concepto = normalizarConcepto(mov.concepto)
  const referencia = (mov.referencia || '').trim()
  const numeroComprobante = (mov.numeroComprobante || '').trim()

  const payload = [fechaISO, importeStr, tipo, concepto, referencia, numeroComprobante].join('|')
  return crypto.createHash('sha256').update(payload).digest('hex')
}
