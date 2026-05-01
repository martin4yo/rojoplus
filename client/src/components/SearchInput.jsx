import { Search, X } from 'lucide-react'
import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'

/**
 * SearchInput - Input de búsqueda con debounce integrado
 *
 * @param {string} value - Valor del input
 * @param {function} onChange - Función llamada cuando cambia el valor (con debounce)
 * @param {function} onImmediateChange - Función llamada inmediatamente (sin debounce)
 * @param {string} placeholder - Placeholder del input
 * @param {number} debounceMs - Tiempo de debounce en ms (default: 300)
 * @param {number} minChars - Mínimo de caracteres antes de ejecutar onChange (default: 0)
 * @param {boolean} showClearButton - Mostrar botón de limpiar (default: true)
 * @param {string} className - Clases adicionales
 * @param {boolean} autoFocus - Auto focus al montar (default: false)
 * @param {function} onEnter - Función llamada al presionar Enter
 * @param {function} onClear - Función llamada al limpiar
 *
 * @example
 * // Búsqueda simple con debounce
 * const [busqueda, setBusqueda] = useState('')
 *
 * <SearchInput
 *   value={busqueda}
 *   onChange={setBusqueda}
 *   placeholder="Buscar productos..."
 *   debounceMs={300}
 * />
 *
 * @example
 * // Búsqueda con validación mínima y Enter
 * <SearchInput
 *   value={busqueda}
 *   onChange={(value) => cargarResultados(value)}
 *   onEnter={() => handleBuscar()}
 *   placeholder="Buscar por nombre o DNI"
 *   minChars={2}
 *   debounceMs={500}
 * />
 */
const SearchInput = forwardRef(function SearchInput({
  value,
  onChange,
  onImmediateChange,
  placeholder = 'Buscar...',
  debounceMs = 300,
  minChars = 0,
  showClearButton = true,
  className = '',
  autoFocus = false,
  onEnter,
  onClear
}, ref) {
  const [localValue, setLocalValue] = useState(value)
  const inputRef = useRef(null)
  const timerRef = useRef(null)

  // Guardar onChange en ref para no disparar el debounce cuando el padre
  // pasa una arrow inline que cambia de referencia en cada render.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Exponer método focus al componente padre
  useImperativeHandle(ref, () => ({
    focus: () => {
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }
  }))

  // Sincronizar valor externo con valor local
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // Auto focus
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  // Debounce effect
  useEffect(() => {
    // Limpiar timer anterior
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    // Si está vacío o no alcanza el mínimo, ejecutar inmediatamente
    if (localValue.length === 0 || localValue.length < minChars) {
      onChangeRef.current(localValue)
      return
    }

    // Crear nuevo timer
    timerRef.current = setTimeout(() => {
      onChangeRef.current(localValue)
    }, debounceMs)

    // Cleanup
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [localValue, debounceMs, minChars])

  const handleChange = (e) => {
    const newValue = e.target.value
    setLocalValue(newValue)

    // Llamar a onImmediateChange si existe (sin debounce)
    if (onImmediateChange) {
      onImmediateChange(newValue)
    }
  }

  const handleClear = () => {
    setLocalValue('')
    onChange('')

    if (onClear) {
      onClear()
    }

    // Focus de vuelta al input
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && onEnter) {
      e.preventDefault()
      onEnter(localValue)
    }
  }

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none" style={{ color: 'var(--text-muted)' }} />

      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="input-field pl-10 pr-10 py-2"
      />

      {showClearButton && localValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <X size={18} />
        </button>
      )}
    </div>
  )
})

export default SearchInput

/**
 * SearchInputWithDropdown - Input de búsqueda con dropdown de resultados
 *
 * @param {string} value - Valor del input
 * @param {function} onChange - Función cuando cambia el valor
 * @param {array} results - Array de resultados para mostrar
 * @param {function} onSelectResult - Función al seleccionar un resultado
 * @param {function} renderResult - Función para renderizar cada resultado
 * @param {boolean} loading - Estado de carga
 * @param {string} emptyMessage - Mensaje cuando no hay resultados
 * @param {number} maxResults - Máximo de resultados a mostrar (default: 10)
 * @param {boolean} showDropdown - Controlar visibilidad del dropdown
 * @param {function} onDropdownChange - Callback cuando cambia visibilidad
 *
 * @example
 * <SearchInputWithDropdown
 *   value={busquedaSocio}
 *   onChange={setBusquedaSocio}
 *   results={resultadosSocio}
 *   loading={buscandoSocio}
 *   onSelectResult={(socio) => {
 *     setSelectedSocio(socio)
 *     setBusquedaSocio('')
 *   }}
 *   renderResult={(socio) => (
 *     <div>
 *       <div className="font-medium">{socio.nombre}</div>
 *       <div className="text-sm text-gray-500">DNI: {socio.dni}</div>
 *     </div>
 *   )}
 *   placeholder="Buscar socio por nombre o DNI..."
 *   minChars={2}
 * />
 */
export function SearchInputWithDropdown({
  value,
  onChange,
  results = [],
  onSelectResult,
  renderResult,
  loading = false,
  emptyMessage = 'No se encontraron resultados',
  maxResults = 10,
  showDropdown: controlledShowDropdown,
  onDropdownChange,
  ...searchInputProps
}) {
  const [internalShowDropdown, setInternalShowDropdown] = useState(false)
  const containerRef = useRef(null)

  // Usar controlled o uncontrolled dropdown
  const showDropdown = controlledShowDropdown !== undefined
    ? controlledShowDropdown
    : internalShowDropdown

  const setShowDropdown = (value) => {
    if (onDropdownChange) {
      onDropdownChange(value)
    } else {
      setInternalShowDropdown(value)
    }
  }

  // Mostrar dropdown cuando hay resultados o está cargando
  useEffect(() => {
    if (value.length >= (searchInputProps.minChars || 0)) {
      setShowDropdown(loading || results.length > 0)
    } else {
      setShowDropdown(false)
    }
  }, [loading, results.length, value, searchInputProps.minChars])

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectResult = (result) => {
    onSelectResult(result)
    setShowDropdown(false)
  }

  const limitedResults = results.slice(0, maxResults)

  return (
    <div ref={containerRef} className="relative">
      <SearchInput
        value={value}
        onChange={onChange}
        {...searchInputProps}
      />

      {/* Dropdown de resultados */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                Buscando...
              </div>
            </div>
          ) : limitedResults.length > 0 ? (
            <div className="py-1">
              {limitedResults.map((result, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleSelectResult(result)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                >
                  {renderResult(result)}
                </button>
              ))}
              {results.length > maxResults && (
                <div className="px-4 py-2 text-sm text-gray-500 text-center bg-gray-50">
                  Mostrando {maxResults} de {results.length} resultados
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500">
              {emptyMessage}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
