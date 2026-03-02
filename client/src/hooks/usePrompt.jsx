import { useState, useCallback } from 'react'
import Modal from '../components/Modal'

/**
 * Hook para diálogos de prompt con input
 * Reemplaza el uso de window.prompt() con un modal más elegante
 *
 * @returns {Object} { prompt, PromptDialog }
 *
 * @example
 * function MyComponent() {
 *   const { prompt, PromptDialog } = usePrompt()
 *
 *   const handleGetReason = async () => {
 *     const reason = await prompt(
 *       'Motivo de devolución',
 *       'Ingrese el motivo (ej: recalentar, rehacer)'
 *     )
 *     if (reason !== null) {
 *       // Usar el motivo
 *     }
 *   }
 *
 *   return (
 *     <>
 *       <button onClick={handleGetReason}>Devolver</button>
 *       <PromptDialog />
 *     </>
 *   )
 * }
 */
export function usePrompt() {
  const [state, setState] = useState({
    isOpen: false,
    title: '',
    message: '',
    placeholder: '',
    defaultValue: '',
    confirmText: 'Aceptar',
    cancelText: 'Cancelar',
    inputValue: '',
    resolve: null
  })

  const prompt = useCallback((title, message = '', options = {}) => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        title,
        message,
        placeholder: options.placeholder || '',
        defaultValue: options.defaultValue || '',
        confirmText: options.confirmText || 'Aceptar',
        cancelText: options.cancelText || 'Cancelar',
        inputValue: options.defaultValue || '',
        resolve
      })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    state.resolve?.(state.inputValue)
    setState(s => ({ ...s, isOpen: false, inputValue: '' }))
  }, [state.resolve, state.inputValue])

  const handleCancel = useCallback(() => {
    state.resolve?.(null)
    setState(s => ({ ...s, isOpen: false, inputValue: '' }))
  }, [state.resolve])

  const handleInputChange = useCallback((e) => {
    setState(s => ({ ...s, inputValue: e.target.value }))
  }, [])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      handleConfirm()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }, [handleConfirm, handleCancel])

  // Componente del diálogo
  const PromptDialog = useCallback(() => {
    if (!state.isOpen) return null

    return (
      <Modal
        isOpen={state.isOpen}
        onClose={handleCancel}
        title={state.title}
        maxWidth="max-w-md"
      >
        {state.message && (
          <p className="text-gray-600 mb-4">{state.message}</p>
        )}

        <input
          type="text"
          value={state.inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={state.placeholder}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-6"
          autoFocus
        />

        <div className="flex justify-end gap-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {state.cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            {state.confirmText}
          </button>
        </div>
      </Modal>
    )
  }, [state, handleCancel, handleConfirm, handleInputChange, handleKeyDown])

  return {
    prompt,
    PromptDialog,
    isOpen: state.isOpen
  }
}

export default usePrompt
