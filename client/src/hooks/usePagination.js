import { useState, useCallback } from 'react'

/**
 * Hook para manejar paginación
 *
 * Patrón detectado en ~20 páginas de listas con código repetido:
 * - Estado de página actual
 * - Información de paginación (total, páginas, etc.)
 * - Funciones nextPage, prevPage, goToPage
 * - Validaciones de límites
 *
 * @param {number} initialPage - Página inicial (default: 1)
 * @param {number} initialLimit - Límite de items por página (default: 10)
 *
 * @returns {Object} Estado y funciones
 * @returns {number} page - Página actual (1-indexed)
 * @returns {number} limit - Límite de items por página
 * @returns {Object|null} pagination - Información de paginación del servidor
 * @returns {Function} setPagination - Función para actualizar info de paginación
 * @returns {Function} nextPage - Ir a la siguiente página
 * @returns {Function} prevPage - Ir a la página anterior
 * @returns {Function} goToPage - Ir a una página específica
 * @returns {Function} setLimit - Cambiar el límite de items
 * @returns {Function} reset - Resetear a la página 1
 * @returns {boolean} hasNext - Si hay página siguiente
 * @returns {boolean} hasPrev - Si hay página anterior
 * @returns {number} totalPages - Total de páginas
 * @returns {number} total - Total de items
 *
 * @example
 * // Uso básico
 * const { page, pagination, setPagination, goToPage } = usePagination()
 *
 * const { data } = useApiData('/admin/socios', {
 *   params: { page, limit: 10 },
 *   onSuccess: (response) => {
 *     setPagination(response.pagination)
 *   },
 *   deps: [page]
 * })
 *
 * <Pagination
 *   pagination={pagination}
 *   page={page}
 *   onPageChange={goToPage}
 * />
 *
 * @example
 * // Con límite variable
 * const { page, limit, setLimit, goToPage } = usePagination(1, 20)
 *
 * <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
 *   <option value={10}>10 por página</option>
 *   <option value={20}>20 por página</option>
 *   <option value={50}>50 por página</option>
 * </select>
 *
 * @example
 * // Con navegación
 * const { page, nextPage, prevPage, hasNext, hasPrev } = usePagination()
 *
 * <button disabled={!hasPrev} onClick={prevPage}>Anterior</button>
 * <span>Página {page}</span>
 * <button disabled={!hasNext} onClick={nextPage}>Siguiente</button>
 */
export function usePagination(initialPage = 1, initialLimit = 10) {
  const [page, setPage] = useState(initialPage)
  const [limit, setLimit] = useState(initialLimit)
  const [pagination, setPagination] = useState(null)

  /**
   * Ir a la siguiente página
   */
  const nextPage = useCallback(() => {
    setPage(currentPage => {
      const total = pagination?.totalPages || pagination?.pages || 0
      if (pagination && currentPage >= total) return currentPage
      return currentPage + 1
    })
  }, [pagination])

  /**
   * Ir a la página anterior
   */
  const prevPage = useCallback(() => {
    setPage(currentPage => Math.max(1, currentPage - 1))
  }, [])

  /**
   * Ir a una página específica
   */
  const goToPage = useCallback((newPage) => {
    const pageNum = Number(newPage)
    if (isNaN(pageNum) || pageNum < 1) {
      return
    }

    const maxPage = pagination?.totalPages || pagination?.pages || 0
    if (pagination && pageNum > maxPage) {
      setPage(maxPage)
    } else {
      setPage(pageNum)
    }
  }, [pagination])

  /**
   * Cambiar el límite de items por página
   * Resetea a la página 1
   */
  const changeLimitHandler = useCallback((newLimit) => {
    const limitNum = Number(newLimit)
    if (isNaN(limitNum) || limitNum < 1) {
      return
    }
    setLimit(limitNum)
    setPage(1) // Resetear a página 1 cuando cambia el límite
  }, [])

  /**
   * Resetear a la página 1
   */
  const reset = useCallback(() => {
    setPage(1)
  }, [])

  /**
   * Verificar si hay página siguiente
   */
  const hasNext = pagination ? page < (pagination.totalPages || pagination.pages || 0) : false

  /**
   * Verificar si hay página anterior
   */
  const hasPrev = page > 1

  /**
   * Total de páginas
   */
  const totalPages = pagination?.totalPages || pagination?.pages || 0

  /**
   * Total de items
   */
  const total = pagination?.total || 0

  /**
   * Rango de items mostrados (ej: "1-10 de 100")
   */
  const from = pagination?.from || 0
  const to = pagination?.to || 0

  return {
    // Estado
    page,
    limit,
    pagination,

    // Setters
    setPagination,
    setLimit: changeLimitHandler,

    // Navegación
    nextPage,
    prevPage,
    goToPage,
    reset,

    // Helpers
    hasNext,
    hasPrev,
    totalPages,
    total,
    from,
    to
  }
}

export default usePagination
