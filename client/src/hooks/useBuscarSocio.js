import { useState, useEffect } from 'react'
import { useDebounce } from './useDebounce'
import api from '../services/api'

/**
 * Hook especializado para búsqueda de socios con debounce
 *
 * Patrón detectado en 15+ archivos con lógica duplicada:
 * - Búsqueda con debounce
 * - Mínimo de caracteres
 * - Estado de loading
 * - Manejo de resultados
 *
 * @param {Object} options - Opciones de configuración
 * @param {number} options.minChars - Mínimo de caracteres para buscar (default: 2)
 * @param {number} options.debounceMs - Delay del debounce (default: 300)
 * @param {number} options.limit - Límite de resultados (default: 10)
 * @param {string} options.estado - Filtrar por estado (default: undefined = todos)
 * @param {boolean} options.soloTitulares - Solo socios titulares (default: false)
 * @param {boolean} options.incluirFamilia - Incluir datos de familia (default: false)
 *
 * @returns {Object} Estado y funciones
 * @returns {string} query - Query de búsqueda actual
 * @returns {Function} setQuery - Función para actualizar la query
 * @returns {Array} resultados - Array de socios encontrados
 * @returns {boolean} loading - Estado de carga
 * @returns {string|null} error - Mensaje de error si ocurrió
 * @returns {Function} clear - Función para limpiar búsqueda y resultados
 * @returns {Function} selectSocio - Función helper para seleccionar un socio
 *
 * @example
 * // Uso básico
 * const { query, setQuery, resultados, loading } = useBuscarSocio()
 *
 * <input
 *   value={query}
 *   onChange={(e) => setQuery(e.target.value)}
 *   placeholder="Buscar socio..."
 * />
 *
 * {loading && <p>Buscando...</p>}
 *
 * {resultados.map(socio => (
 *   <div key={socio.id}>{socio.apellidoNombre}</div>
 * ))}
 *
 * @example
 * // Con filtros
 * const { resultados } = useBuscarSocio({
 *   minChars: 3,
 *   estado: 'ACTIVO',
 *   soloTitulares: true
 * })
 *
 * @example
 * // Con selección
 * const { resultados, selectSocio, clear } = useBuscarSocio()
 * const [socioSeleccionado, setSocioSeleccionado] = useState(null)
 *
 * <ul>
 *   {resultados.map(socio => (
 *     <li
 *       key={socio.id}
 *       onClick={() => selectSocio(socio, (s) => {
 *         setSocioSeleccionado(s)
 *         clear()
 *       })}
 *     >
 *       {socio.apellidoNombre}
 *     </li>
 *   ))}
 * </ul>
 */
export function useBuscarSocio(options = {}) {
  const {
    minChars = 2,
    debounceMs = 300,
    limit = 10,
    estado,
    soloTitulares = false,
    incluirFamilia = false
  } = options

  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Debounce de la query
  const debouncedQuery = useDebounce(query, debounceMs)

  /**
   * Efecto para buscar cuando cambia la query debouncedValue
   */
  useEffect(() => {
    // Limpiar resultados si la query es muy corta
    if (debouncedQuery.length < minChars) {
      setResultados([])
      setError(null)
      return
    }

    // Buscar socios
    buscarSocios(debouncedQuery)
  }, [debouncedQuery, minChars])

  /**
   * Función para hacer la búsqueda
   */
  async function buscarSocios(searchQuery) {
    setLoading(true)
    setError(null)

    try {
      // Construir params
      const params = {
        q: searchQuery,
        limit
      }

      if (estado) {
        params.estado = estado
      }

      if (soloTitulares) {
        params.soloTitulares = true
      }

      if (incluirFamilia) {
        params.incluirFamilia = true
      }

      // Hacer la petición
      const response = await api.getFull('/admin/socios', { params })

      // Parsear respuesta
      const socios = response?.data?.socios || response?.socios || []

      setResultados(socios)
    } catch (err) {
      console.error('Error buscando socios:', err)
      const errorMessage = err.response?.data?.error || 'Error al buscar socios'
      setError(errorMessage)
      setResultados([])
    } finally {
      setLoading(false)
    }
  }

  /**
   * Función para limpiar búsqueda
   */
  function clear() {
    setQuery('')
    setResultados([])
    setError(null)
  }

  /**
   * Helper para seleccionar un socio
   * @param {Object} socio - Socio seleccionado
   * @param {Function} callback - Callback a ejecutar con el socio
   */
  function selectSocio(socio, callback) {
    if (callback) {
      callback(socio)
    }
  }

  /**
   * Función para refrescar resultados con la query actual
   */
  function refresh() {
    if (query.length >= minChars) {
      buscarSocios(query)
    }
  }

  return {
    query,
    setQuery,
    resultados,
    loading,
    error,
    clear,
    selectSocio,
    refresh
  }
}

export default useBuscarSocio
