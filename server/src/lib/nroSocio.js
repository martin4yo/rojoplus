import { AppError } from '../middleware/errorHandler.js'

// Calcula el próximo nroSocio. Si están seteadas las claves de configuración
// SOCIO_NRO_MIN y SOCIO_NRO_MAX, asigna secuencialmente dentro del rango
// (no rellena huecos). Si no, usa el comportamiento legacy (primer hueco desde el mínimo).
export async function calcularProximoNroSocio(db) {
  const [cfgMin, cfgMax] = await Promise.all([
    db.configuracion.findFirst({ where: { clave: 'SOCIO_NRO_MIN' } }),
    db.configuracion.findFirst({ where: { clave: 'SOCIO_NRO_MAX' } }),
  ])
  const min = cfgMin?.valor ? parseInt(cfgMin.valor, 10) : null
  const max = cfgMax?.valor ? parseInt(cfgMax.valor, 10) : null

  const socios = await db.socio.findMany({ select: { nroSocio: true } })
  const todos = socios.map(s => parseInt(s.nroSocio, 10)).filter(n => !isNaN(n) && n > 0)

  if (Number.isInteger(min) && Number.isInteger(max) && max >= min) {
    const enRango = todos.filter(n => n >= min && n <= max)
    const proximo = enRango.length === 0 ? min : Math.max(...enRango) + 1
    if (proximo > max) {
      throw new AppError(`Rango de números de socio agotado (${min}-${max})`, 400, 'RANGO_AGOTADO')
    }
    return String(proximo)
  }

  if (todos.length === 0) return '1'
  const usados = new Set(todos)
  const minimo = Math.min(...todos)
  let proximo = minimo
  while (usados.has(proximo)) proximo++
  return String(proximo)
}
