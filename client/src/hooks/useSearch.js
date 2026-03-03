import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../services/api'

/**
 * Hook para búsquedas con debounce
 *
 * @param {string} endpoint - Endpoint de la API para buscar
 * @param {Object} options - Opciones de configuración
 * @param {number} options.minChars - Mínimo de caracteres para buscar (default: 2)
 * @param {number} options.debounce - Tiempo de debounce en ms (default: 300)
 * @param {function} options.transform - Función para transformar los resultados
 * @param {Object} options.params - Parámetros adicionales para la búsqueda
 * @param {string} options.queryParam - Nombre del parámetro de búsqueda (default: 'q')
 * @param {boolean} options.searchOnMount - Buscar al montar si hay query inicial
 *
 * @returns {Object} { query, setQuery, results, loading, error, clear, search }
 *
 * @example
 * // Búsqueda simple de socios
 * const { query, setQuery, results, loading } = useSearch('/admin/socios')
 *
 * @example
 * // Con transformación de datos
 * const { results } = useSearch('/admin/socios', {
 *   transform: (data) => data.socios || [],
 *   minChars: 3
 * })
 *
 * @example
 * // Con parámetros adicionales
 * const { results } = useSearch('/admin/socios', {
 *   params: { estado: 'ACTIVO', limit: 10 }
 * })
 */
export function useSearch(endpoint, options = {}) {
  const {
    minChars = 2,
    debounce = 300,
    transform = (data) => data,
    params = {},
    queryParam = 'q',
    searchOnMount = false
  } = options

  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Ref para el timer del debounce
  const timerRef = useRef(null)
  // Ref para cancelar requests anteriores
  const abortControllerRef = useRef(null)

  // Función de búsqueda manual
  const search = useCallback(async (searchQuery) => {
    const q = searchQuery ?? query

    if (q.length < minChars) {
      setResults([])
      return []
    }

    // Cancelar request anterior si existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    setLoading(true)
    setError(null)

    try {
      const response = await api.get(endpoint, {
        params: { [queryParam]: q, ...params },
        signal: abortControllerRef.current.signal
      })

      const data = response?.data || response || []
      const transformedData = transform(data)
      setResults(transformedData)
      return transformedData
    } catch (err) {
      // Ignorar errores de cancelación
      if (err.name === 'AbortError' || err.name === 'CanceledError') {
        return results
      }
      console.error('Error en búsqueda:', err)
      setError(err.message || 'Error en la búsqueda')
      setResults([])
      return []
    } finally {
      setLoading(false)
    }
  }, [endpoint, query, minChars, params, queryParam, transform])

  // Efecto para búsqueda con debounce
  useEffect(() => {
    // Limpiar timer anterior
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    // Si no hay suficientes caracteres, limpiar resultados
    if (query.length < minChars) {
      setResults([])
      setLoading(false)
      return
    }

    // Configurar nuevo timer
    timerRef.current = setTimeout(() => {
      search(query)
    }, debounce)

    // Cleanup
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [query, minChars, debounce, search])

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // Búsqueda inicial si está configurado
  useEffect(() => {
    if (searchOnMount && query.length >= minChars) {
      search(query)
    }
  }, []) // Solo al montar

  // Función para limpiar
  const clear = useCallback(() => {
    setQuery('')
    setResults([])
    setError(null)
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
  }, [])

  return {
    query,
    setQuery,
    results,
    loading,
    error,
    clear,
    search // Para búsquedas manuales
  }
}

/**
 * Hook especializado para búsqueda de socios
 * Preconfigurado con las opciones más comunes
 */
export function useSocioSearch(options = {}) {
  return useSearch('/admin/socios', {
    transform: (data) => data.socios || data || [],
    minChars: 2,
    debounce: 300,
    ...options
  })
}

/**
 * Hook especializado para búsqueda de productos
 */
export function useProductoSearch(options = {}) {
  return useSearch('/admin/stock/productos', {
    transform: (data) => data.productos || data || [],
    minChars: 2,
    ...options
  })
}

/**
 * Hook especializado para búsqueda de entidades (proveedores/clientes)
 */
export function useEntidadSearch(tipo = null, options = {}) {
  const params = tipo ? { tipo } : {}

  return useSearch('/admin/entidades', {
    transform: (data) => data.entidades || data || [],
    params,
    ...options
  })
}

export default useSearch
