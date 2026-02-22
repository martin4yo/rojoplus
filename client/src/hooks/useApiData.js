import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'

/**
 * Hook para manejar llamadas API con estado automático
 *
 * Reemplaza el patrón repetido de:
 * - useState para data, loading, error
 * - useEffect para fetch
 * - try/catch para manejo de errores
 *
 * Detectado en 131 archivos con código duplicado.
 *
 * @param {string} endpoint - URL del endpoint (ej: '/admin/socios')
 * @param {Object} options - Opciones de configuración
 * @param {any} options.initialData - Datos iniciales (default: null)
 * @param {boolean} options.lazy - Si true, no hace fetch automático (default: false)
 * @param {Object} options.params - Query params para la petición
 * @param {Function} options.onSuccess - Callback al completar con éxito
 * @param {Function} options.onError - Callback en caso de error
 * @param {Function} options.transform - Función para transformar la respuesta
 * @param {Array} options.deps - Dependencias para refetch automático
 *
 * @returns {Object} Estado y funciones
 * @returns {any} data - Datos de la respuesta
 * @returns {boolean} loading - Estado de carga
 * @returns {string|null} error - Mensaje de error si ocurrió
 * @returns {Function} refetch - Función para rehacer la petición
 * @returns {Function} setData - Función para actualizar data manualmente
 * @returns {Function} clearError - Función para limpiar el error
 *
 * @example
 * // Uso básico - fetch automático
 * const { data: socios, loading, error, refetch } = useApiData('/admin/socios')
 *
 * @example
 * // Lazy loading - fetch manual
 * const { data, loading, refetch } = useApiData('/admin/socios/:id', { lazy: true })
 * // Luego: refetch({ id: 123 })
 *
 * @example
 * // Con query params
 * const { data } = useApiData('/admin/socios', {
 *   params: { page: 1, limit: 10 }
 * })
 *
 * @example
 * // Con transformación de datos
 * const { data } = useApiData('/admin/socios', {
 *   transform: (response) => response?.data?.socios || []
 * })
 *
 * @example
 * // Con callbacks
 * const { data } = useApiData('/admin/socios', {
 *   onSuccess: (data) => console.log('Cargado:', data),
 *   onError: (error) => alert(error)
 * })
 *
 * @example
 * // Refetch automático cuando cambian dependencias
 * const [filtro, setFiltro] = useState('')
 * const { data } = useApiData('/admin/socios', {
 *   params: { q: filtro },
 *   deps: [filtro]
 * })
 */
export function useApiData(endpoint, options = {}) {
  const {
    initialData = null,
    lazy = false,
    params = {},
    onSuccess,
    onError,
    transform,
    deps = []
  } = options

  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(!lazy)
  const [error, setError] = useState(null)

  /**
   * Función para hacer el fetch
   * @param {Object} runtimeParams - Parámetros adicionales en tiempo de ejecución
   */
  const fetch = useCallback(async (runtimeParams = {}) => {
    setLoading(true)
    setError(null)

    try {
      // Combinar params estáticos con params dinámicos
      const allParams = { ...params, ...runtimeParams }

      // Reemplazar params en la URL si es necesario (ej: /socios/:id)
      let finalEndpoint = endpoint
      Object.keys(allParams).forEach(key => {
        const placeholder = `:${key}`
        if (finalEndpoint.includes(placeholder)) {
          finalEndpoint = finalEndpoint.replace(placeholder, allParams[key])
          delete allParams[key]
        }
      })

      // Hacer la petición
      const response = await api.getFull(finalEndpoint, { params: allParams })

      // Transformar datos si hay función de transformación
      let result = transform ? transform(response) : (response?.data || response)

      // Si result es undefined/null, usar initialData
      if (result === undefined || result === null) {
        result = initialData
      }

      setData(result)

      // Callback de éxito
      if (onSuccess) {
        onSuccess(result)
      }

      return result
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Error al cargar datos'
      setError(errorMessage)

      // Callback de error
      if (onError) {
        onError(errorMessage)
      }

      throw err
    } finally {
      setLoading(false)
    }
  }, [endpoint, JSON.stringify(params), transform, onSuccess, onError])

  /**
   * Efecto para fetch automático
   */
  useEffect(() => {
    if (!lazy) {
      fetch()
    }
  }, [fetch, lazy, ...deps])

  /**
   * Función para limpiar el error
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    data,
    loading,
    error,
    refetch: fetch,
    setData,
    clearError
  }
}

/**
 * Variante para peticiones POST
 */
export function useApiPost(endpoint, options = {}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  const post = useCallback(async (body) => {
    setLoading(true)
    setError(null)

    try {
      const response = await api.post(endpoint, body)
      const result = response?.data || response

      setData(result)

      if (options.onSuccess) {
        options.onSuccess(result)
      }

      return result
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Error en la petición'
      setError(errorMessage)

      if (options.onError) {
        options.onError(errorMessage)
      }

      throw err
    } finally {
      setLoading(false)
    }
  }, [endpoint, options.onSuccess, options.onError])

  return {
    post,
    data,
    loading,
    error,
    clearError: () => setError(null)
  }
}

/**
 * Variante para peticiones PUT
 */
export function useApiPut(endpoint, options = {}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  const put = useCallback(async (body, id) => {
    setLoading(true)
    setError(null)

    try {
      const finalEndpoint = id ? `${endpoint}/${id}` : endpoint
      const response = await api.put(finalEndpoint, body)
      const result = response?.data || response

      setData(result)

      if (options.onSuccess) {
        options.onSuccess(result)
      }

      return result
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Error en la petición'
      setError(errorMessage)

      if (options.onError) {
        options.onError(errorMessage)
      }

      throw err
    } finally {
      setLoading(false)
    }
  }, [endpoint, options.onSuccess, options.onError])

  return {
    put,
    data,
    loading,
    error,
    clearError: () => setError(null)
  }
}

/**
 * Variante para peticiones DELETE
 */
export function useApiDelete(endpoint, options = {}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const deleteItem = useCallback(async (id) => {
    setLoading(true)
    setError(null)

    try {
      const finalEndpoint = id ? `${endpoint}/${id}` : endpoint
      const response = await api.delete(finalEndpoint)
      const result = response?.data || response

      if (options.onSuccess) {
        options.onSuccess(result)
      }

      return result
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Error al eliminar'
      setError(errorMessage)

      if (options.onError) {
        options.onError(errorMessage)
      }

      throw err
    } finally {
      setLoading(false)
    }
  }, [endpoint, options.onSuccess, options.onError])

  return {
    deleteItem,
    loading,
    error,
    clearError: () => setError(null)
  }
}

export default useApiData
