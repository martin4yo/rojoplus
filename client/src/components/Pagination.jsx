import React from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

/**
 * Componente de paginación reutilizable
 *
 * Trabaja en conjunto con el hook usePagination.
 * Reemplaza código duplicado en 20+ páginas de listas.
 *
 * Características:
 * - Responsive (botones simples en mobile, números en desktop)
 * - Navegación completa (primera, anterior, siguiente, última)
 * - Información de registros mostrados
 * - Números de página con truncado inteligente
 *
 * @param {Object} props - Props del componente
 * @param {Object} props.pagination - Objeto de paginación del servidor
 * @param {number} props.pagination.page - Página actual
 * @param {number} props.pagination.totalPages - Total de páginas
 * @param {number} props.pagination.total - Total de items
 * @param {number} props.pagination.from - Primer item mostrado
 * @param {number} props.pagination.to - Último item mostrado
 * @param {number} props.page - Página actual (alternativa a pagination.page)
 * @param {Function} props.onPageChange - Callback cuando cambia la página
 * @param {string} props.className - Clases CSS adicionales
 * @param {boolean} props.showInfo - Mostrar información de registros (default: true)
 * @param {boolean} props.showFirstLast - Mostrar botones primera/última (default: true)
 * @param {number} props.maxButtons - Máximo de botones de página a mostrar (default: 5)
 *
 * @example
 * // Uso con usePagination hook
 * const { page, pagination, goToPage } = usePagination()
 *
 * <Pagination
 *   pagination={pagination}
 *   page={page}
 *   onPageChange={goToPage}
 * />
 *
 * @example
 * // Con opciones personalizadas
 * <Pagination
 *   pagination={pagination}
 *   page={page}
 *   onPageChange={goToPage}
 *   showInfo={false}
 *   showFirstLast={false}
 *   maxButtons={7}
 * />
 */
export default function Pagination({
  pagination,
  page: currentPageProp,
  onPageChange,
  className = '',
  showInfo = true,
  showFirstLast = true,
  maxButtons = 5
}) {
  // Si no hay paginación o solo una página, no mostrar
  const totalPages = pagination?.totalPages || pagination?.pages || 1
  if (!pagination || totalPages <= 1) {
    return null
  }

  const currentPage = currentPageProp || pagination.page || 1
  const total = pagination.total || 0
  const from = pagination.from || ((currentPage - 1) * (pagination.limit || 10) + 1)
  const to = pagination.to || Math.min(currentPage * (pagination.limit || 10), total)

  // Calcular rango de páginas a mostrar
  const pageNumbers = getPageNumbers(currentPage, totalPages, maxButtons)

  // Validar que onPageChange sea una función
  if (typeof onPageChange !== 'function') {
    console.error('Pagination: onPageChange debe ser una función')
    return null
  }

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 py-3 ${className}`}>
      {/* Información de registros (solo desktop) */}
      {showInfo && (
        <div className="text-sm text-gray-700 order-2 sm:order-1">
          Mostrando{' '}
          <span className="font-medium">{from}</span>
          {' a '}
          <span className="font-medium">{to}</span>
          {' de '}
          <span className="font-medium">{total}</span>
          {' resultados'}
        </div>
      )}

      {/* Controles de paginación */}
      <nav className="flex items-center gap-2 order-1 sm:order-2">
        {/* Versión Mobile (solo anterior/siguiente) */}
        <div className="flex gap-2 sm:hidden">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>

          <span className="px-3 py-2 text-sm font-medium">
            {currentPage} / {totalPages}
          </span>

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Siguiente
          </button>
        </div>

        {/* Versión Desktop (completa) */}
        <div className="hidden sm:flex items-center gap-1">
          {/* Primera página */}
          {showFirstLast && currentPage > 2 && (
            <button
              onClick={() => onPageChange(1)}
              className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
              title="Primera página"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
          )}

          {/* Página anterior */}
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700"
            title="Página anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Números de página */}
          <div className="flex items-center gap-1">
            {pageNumbers.map((pageNum, index) => {
              // Si es "...", mostrar ellipsis
              if (pageNum === '...') {
                return (
                  <span
                    key={`ellipsis-${index}`}
                    className="px-3 py-2 text-gray-500"
                  >
                    ...
                  </span>
                )
              }

              // Número de página
              const isActive = pageNum === currentPage

              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={`
                    min-w-[2.5rem] px-3 py-2 text-sm font-medium rounded-lg border
                    ${isActive
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }
                  `}
                >
                  {pageNum}
                </button>
              )
            })}
          </div>

          {/* Página siguiente */}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700"
            title="Página siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Última página */}
          {showFirstLast && currentPage < totalPages - 1 && (
            <button
              onClick={() => onPageChange(totalPages)}
              className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
              title="Última página"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </nav>
    </div>
  )
}

/**
 * Calcula los números de página a mostrar con truncado inteligente
 *
 * Ejemplos:
 * - Total 5 páginas, max 5: [1, 2, 3, 4, 5]
 * - Total 10 páginas, max 5, actual 1: [1, 2, 3, '...', 10]
 * - Total 10 páginas, max 5, actual 5: [1, '...', 4, 5, 6, '...', 10]
 * - Total 10 páginas, max 5, actual 10: [1, '...', 8, 9, 10]
 *
 * @param {number} currentPage - Página actual
 * @param {number} totalPages - Total de páginas
 * @param {number} maxButtons - Máximo de botones a mostrar
 * @returns {Array} Array de números de página y '...'
 */
function getPageNumbers(currentPage, totalPages, maxButtons) {
  // Si hay menos páginas que el máximo, mostrar todas
  if (totalPages <= maxButtons) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const pages = []
  const halfMax = Math.floor(maxButtons / 2)

  // Determinar el rango a mostrar
  let startPage = Math.max(1, currentPage - halfMax)
  let endPage = Math.min(totalPages, currentPage + halfMax)

  // Ajustar si estamos cerca del inicio o final
  if (currentPage <= halfMax) {
    endPage = maxButtons
  } else if (currentPage >= totalPages - halfMax) {
    startPage = totalPages - maxButtons + 1
  }

  // Siempre mostrar la primera página
  if (startPage > 1) {
    pages.push(1)
    if (startPage > 2) {
      pages.push('...')
    }
  }

  // Páginas del rango
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i)
  }

  // Siempre mostrar la última página
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      pages.push('...')
    }
    pages.push(totalPages)
  }

  return pages
}

/**
 * Variante simple con solo anterior/siguiente
 */
export function SimplePagination({ page, hasNext, hasPrev, onNext, onPrev, className = '' }) {
  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      <button
        onClick={onPrev}
        disabled={!hasPrev}
        className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Anterior
      </button>

      <span className="px-4 py-2 text-sm text-gray-700">
        Página {page}
      </span>

      <button
        onClick={onNext}
        disabled={!hasNext}
        className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Siguiente
      </button>
    </div>
  )
}
