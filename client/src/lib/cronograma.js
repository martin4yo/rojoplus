/**
 * Helpers para formatear el cronograma de una categoría de actividad.
 *
 * Los slots vienen del backend con la forma:
 *   { diaSemana: Int 0-6, horaInicio: 'HH:MM', horaFin: 'HH:MM', espacio: string|null }
 *
 * Nota: en el schema de Prisma, `diaSemana` es Int donde 0=Domingo, 1=Lunes, ...
 */

const DIAS_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const DIAS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0] // Lunes primero, Domingo al final

export function nombreDia(d, short = false) {
  return short ? DIAS_SHORT[d] : DIAS_FULL[d]
}

/**
 * Agrupa slots con mismo horario+espacio para mostrar "Lun/Mié/Vie 19:00–20:30 · Cancha 1"
 * en lugar de 3 líneas separadas.
 *
 * Devuelve: [{ dias: [Int], diasLabel: 'Lun/Mié/Vie', horaInicio, horaFin, espacio }]
 */
export function agruparSlots(slots) {
  if (!Array.isArray(slots) || slots.length === 0) return []
  const grupos = new Map()
  for (const s of slots) {
    const key = `${s.horaInicio}|${s.horaFin}|${s.espacio || ''}`
    if (!grupos.has(key)) {
      grupos.set(key, {
        dias: [],
        horaInicio: s.horaInicio,
        horaFin: s.horaFin,
        espacio: s.espacio || null,
      })
    }
    grupos.get(key).dias.push(s.diaSemana)
  }
  // Ordenar días dentro de cada grupo y agregar label
  return [...grupos.values()].map(g => {
    g.dias.sort((a, b) => ORDEN_DIAS.indexOf(a) - ORDEN_DIAS.indexOf(b))
    g.diasLabel = g.dias.map(d => DIAS_SHORT[d]).join('/')
    return g
  })
}

/**
 * Devuelve un string compacto multi-línea con el cronograma.
 * Ej: "Lun/Mié/Vie 19:00–20:30 · Cancha 1\nMar 18:00–19:00 · Cancha 2"
 */
export function formatearCronograma(slots, { short = true } = {}) {
  const grupos = agruparSlots(slots)
  if (grupos.length === 0) return ''
  return grupos
    .map(g => {
      const dias = short
        ? g.dias.map(d => DIAS_SHORT[d]).join('/')
        : g.dias.map(d => DIAS_FULL[d]).join(', ')
      const horaTxt = `${g.horaInicio}–${g.horaFin}`
      return g.espacio ? `${dias} ${horaTxt} · ${g.espacio}` : `${dias} ${horaTxt}`
    })
    .join('\n')
}
