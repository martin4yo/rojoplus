import { useState, useCallback, createContext, useContext } from 'react'
import Modal from '../components/Modal'

/**
 * Hook para diálogos de confirmación
 * Reemplaza el uso de window.confirm() con un modal más elegante
 *
 * @returns {Object} { confirm, ConfirmDialog }
 *
 * @example
 * function MyComponent() {
 *   const { confirm, ConfirmDialog } = useConfirm()
 *
 *   const handleDelete = async () => {
 *     const confirmed = await confirm(
 *       '¿Eliminar registro?',
 *       'Esta acción no se puede deshacer'
 *     )
 *     if (confirmed) {
 *       // Ejecutar eliminación
 *     }
 *   }
 *
 *   return (
 *     <>
 *       <button onClick={handleDelete}>Eliminar</button>
 *       <ConfirmDialog />
 *     </>
 *   )
 * }
 */
export function useConfirm() {
  const [state, setState] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    confirmVariant: 'danger', // 'danger' | 'primary' | 'warning'
    resolve: null
  })

  const confirm = useCallback((title, message = '', options = {}) => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        title,
        message,
        confirmText: options.confirmText || 'Confirmar',
        cancelText: options.cancelText || 'Cancelar',
        confirmVariant: options.variant || 'danger',
        resolve
      })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    state.resolve?.(true)
    setState(s => ({ ...s, isOpen: false }))
  }, [state.resolve])

  const handleCancel = useCallback(() => {
    state.resolve?.(false)
    setState(s => ({ ...s, isOpen: false }))
  }, [state.resolve])

  // Componente del diálogo
  const ConfirmDialog = useCallback(() => {
    if (!state.isOpen) return null

    const variantClasses = {
      danger: 'bg-red-600 hover:bg-red-700 text-white',
      primary: 'bg-blue-600 hover:bg-blue-700 text-white',
      warning: 'bg-amber-500 hover:bg-amber-600 text-white'
    }

    return (
      <Modal
        isOpen={state.isOpen}
        onClose={handleCancel}
        title={state.title}
        maxWidth="max-w-md"
      >
        {state.message && (
          <p className="text-gray-600 mb-6">{state.message}</p>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {state.cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={`px-4 py-2 rounded-lg transition-colors ${variantClasses[state.confirmVariant]}`}
          >
            {state.confirmText}
          </button>
        </div>
      </Modal>
    )
  }, [state, handleCancel, handleConfirm])

  return {
    confirm,
    ConfirmDialog,
    isOpen: state.isOpen
  }
}

/**
 * Context para usar confirmación global en toda la app
 */
const ConfirmContext = createContext(null)

export function ConfirmProvider({ children }) {
  const { confirm, ConfirmDialog } = useConfirm()

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog />
    </ConfirmContext.Provider>
  )
}

/**
 * Hook para usar la confirmación global
 * Requiere que ConfirmProvider esté en el árbol de componentes
 */
export function useGlobalConfirm() {
  const confirm = useContext(ConfirmContext)
  if (!confirm) {
    throw new Error('useGlobalConfirm debe usarse dentro de ConfirmProvider')
  }
  return confirm
}

/**
 * Helpers preconfigurados para casos comunes
 */
export const confirmActions = {
  delete: (itemName = 'este registro') => ({
    title: '¿Eliminar?',
    message: `¿Está seguro que desea eliminar ${itemName}? Esta acción no se puede deshacer.`,
    confirmText: 'Eliminar',
    variant: 'danger'
  }),

  anular: (itemName = 'este registro') => ({
    title: '¿Anular?',
    message: `¿Está seguro que desea anular ${itemName}?`,
    confirmText: 'Anular',
    variant: 'warning'
  }),

  save: () => ({
    title: '¿Guardar cambios?',
    message: 'Se guardarán los cambios realizados.',
    confirmText: 'Guardar',
    variant: 'primary'
  }),

  discard: () => ({
    title: '¿Descartar cambios?',
    message: 'Los cambios no guardados se perderán.',
    confirmText: 'Descartar',
    variant: 'warning'
  }),

  logout: () => ({
    title: '¿Cerrar sesión?',
    message: 'Deberá volver a iniciar sesión para acceder.',
    confirmText: 'Cerrar sesión',
    variant: 'primary'
  })
}

export default useConfirm
