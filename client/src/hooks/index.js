/**
 * Índice de hooks personalizados
 *
 * Uso:
 * import { useSearch, useFormState, useConfirm } from '../hooks'
 */

// Búsqueda con debounce
export { useSearch, useSocioSearch, useProductoSearch, useEntidadSearch } from './useSearch'

// Estado de formularios
export { useFormState, useFormWithLoad } from './useFormState'

// Confirmación de acciones
export { useConfirm, useGlobalConfirm, ConfirmProvider, confirmActions } from './useConfirm.jsx'

// Prompts con input
export { usePrompt } from './usePrompt.jsx'

// Hooks existentes
export { default as usePagination } from './usePagination'
export { default as useApiData } from './useApiData'
export { default as useDebounce } from './useDebounce'
export { default as useBuscarSocio } from './useBuscarSocio'
