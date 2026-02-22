import { useState, useEffect } from 'react'

/**
 * Hook para debouncing de valores
 *
 * Útil para búsquedas, filtros y cualquier caso donde se quiera
 * esperar a que el usuario termine de escribir antes de ejecutar una acción.
 *
 * Reemplaza implementaciones ad-hoc de setTimeout en múltiples archivos.
 *
 * @param {any} value - Valor a debounce
 * @param {number} delay - Delay en milisegundos (default: 300)
 * @returns {any} Valor debouncedValue después del delay
 *
 * @example
 * // Búsqueda con debounce
 * const [searchTerm, setSearchTerm] = useState('')
 * const debouncedSearch = useDebounce(searchTerm, 300)
 *
 * useEffect(() => {
 *   if (debouncedSearch) {
 *     fetchResults(debouncedSearch)
 *   }
 * }, [debouncedSearch])
 *
 * @example
 * // Filtro con debounce
 * const [filter, setFilter] = useState('')
 * const debouncedFilter = useDebounce(filter, 500)
 *
 * const { data } = useApiData('/admin/socios', {
 *   params: { q: debouncedFilter },
 *   deps: [debouncedFilter]
 * })
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    // Setear un timer para actualizar el valor después del delay
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    // Limpiar el timer si el valor cambia antes de que se cumpla el delay
    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}

export default useDebounce
