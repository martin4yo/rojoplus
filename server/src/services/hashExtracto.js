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
 *              concepto normalizado, referencia, numeroComprobante, saldo corrido (2 decimales).
 *
 * Incluye saldo corrido como discriminador: cuando dos filas tienen mismos
 * fecha+importe+tipo+concepto+referencia (típico de comisiones/impuestos automáticos
 * sin referencia única), el saldo corrido difiere naturalmente porque una deja la
 * cuenta en X y la otra en X±importe. Esto evita colisiones intra-archivo.
 *
 * NO incluye: fechaValor (puede pasar de null a fecha real entre re-exports).
 * NO incluye: cajaId (el hash describe el movimiento en sí, no su ubicación en nuestro sistema).
 *
 * Caveat: si el banco recalcula retroactivamente el saldo corrido (raro, pero pasa
 * si reordenan movimientos del mismo día), el hash cambia y un re-import generaría
 * duplicados. El check de balance al importar es la red de seguridad.
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
  const saldoStr = mov.saldo != null && mov.saldo !== '' ? Number(mov.saldo).toFixed(2) : ''

  const payload = [fechaISO, importeStr, tipo, concepto, referencia, numeroComprobante, saldoStr].join('|')
  return crypto.createHash('sha256').update(payload).digest('hex')
}
