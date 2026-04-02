import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { Button } from './Button'

/**
 * Modal personalizado para reemplazar alert/confirm/prompt del navegador
 *
 * Uso:
 * - Alert: showModal({ type: 'success', message: 'Operación exitosa' })
 * - Confirm: showModal({ type: 'warning', message: '¿Confirmar?', onConfirm: () => {} })
 * - Prompt: showModal({ type: 'info', message: 'Ingrese motivo', prompt: true, onConfirm: (value) => {} })
 */

export function Modal({
  isOpen,
  onClose,
  type = 'info',
  title,
  message,
  children,
  confirmText = 'Aceptar',
  cancelText = 'Cancelar',
  onConfirm,
  showCancel = false,
  prompt = false,
  promptLabel = '',
  promptPlaceholder = '',
  maxWidth = 'max-w-md',
}) {
  const [promptValue, setPromptValue] = useState('')

  useEffect(() => {
    if (isOpen) {
      setPromptValue('')
    }
  }, [isOpen])

  if (!isOpen) return null

  const icons = {
    success: <CheckCircle className="w-12 h-12 text-green-500" />,
    error: <XCircle className="w-12 h-12 text-red-500" />,
    warning: <AlertTriangle className="w-12 h-12 text-yellow-500" />,
    info: <Info className="w-12 h-12 text-blue-500" />,
  }

  const titles = {
    success: 'Éxito',
    error: 'Error',
    warning: 'Atención',
    info: 'Información',
  }

  function handleConfirm() {
    if (onConfirm) {
      onConfirm(prompt ? promptValue : true)
    }
    onClose()
  }

  function handleCancel() {
    onClose()
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      handleCancel()
    }
    // Solo hacer Enter para confirm si NO hay children (no es un formulario)
    if (e.key === 'Enter' && !prompt && !children) {
      handleConfirm()
    }
  }

  // Modo con children (formularios personalizados)
  if (children) {
    return createPortal(
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
        onClick={handleCancel}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <div
          className={`bg-white rounded-xl shadow-2xl ${maxWidth} w-full relative max-h-[90vh] flex flex-col`}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
            {title && (
              <h3 className="text-xl font-bold text-gray-800">
                {title}
              </h3>
            )}
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100 ml-auto"
              type="button"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto flex-1">
            {children}
          </div>

          {/* Footer (optional) */}
          {(onConfirm || showCancel) && (
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
              {showCancel && (
                <Button variant="secondary" onClick={handleCancel}>
                  {cancelText}
                </Button>
              )}
              {onConfirm && (
                <Button onClick={handleConfirm}>
                  {confirmText}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>,
      document.body
    )
  }

  // Modo alert/confirm/prompt original
  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
      onClick={handleCancel}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div
        className={`bg-white rounded-xl shadow-2xl ${maxWidth} w-full p-6 relative`}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleCancel}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon and title */}
        <div className="text-center mb-4">
          <div className="flex justify-center mb-3">
            {icons[type]}
          </div>
          <h3 className="text-xl font-bold text-gray-800">
            {title || titles[type]}
          </h3>
        </div>

        {/* Message */}
        <p className="text-gray-600 text-center mb-6">
          {message}
        </p>

        {/* Prompt input */}
        {prompt && (
          <div className="mb-6">
            {promptLabel && (
              <label className="block text-gray-700 text-sm font-medium mb-2">
                {promptLabel}
              </label>
            )}
            <input
              type="text"
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              placeholder={promptPlaceholder}
              className="input-field w-full"
              autoFocus
            />
          </div>
        )}

        {/* Buttons */}
        <div className={`flex gap-3 ${showCancel || prompt ? 'justify-center' : ''}`}>
          {(showCancel || prompt) && (
            <Button
              variant="secondary"
              onClick={handleCancel}
              className="flex-1"
            >
              {cancelText}
            </Button>
          )}
          <Button
            onClick={handleConfirm}
            className={showCancel || prompt ? 'flex-1' : 'w-full'}
            disabled={prompt && !promptValue.trim()}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/**
 * Hook para usar el modal de forma imperativa
 */
export function useModal() {
  const [modalState, setModalState] = useState({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
    confirmText: 'Aceptar',
    cancelText: 'Cancelar',
    onConfirm: null,
    showCancel: false,
    prompt: false,
    promptLabel: '',
    promptPlaceholder: '',
  })

  const showModal = (options) => {
    setModalState({
      isOpen: true,
      type: options.type || 'info',
      title: options.title || '',
      message: options.message || '',
      confirmText: options.confirmText || 'Aceptar',
      cancelText: options.cancelText || 'Cancelar',
      onConfirm: options.onConfirm || null,
      showCancel: options.showCancel ?? !!options.onConfirm,
      prompt: options.prompt || false,
      promptLabel: options.promptLabel || '',
      promptPlaceholder: options.promptPlaceholder || '',
    })
  }

  const closeModal = () => {
    setModalState(prev => ({ ...prev, isOpen: false }))
  }

  const ModalComponent = (
    <Modal
      isOpen={modalState.isOpen}
      onClose={closeModal}
      type={modalState.type}
      title={modalState.title}
      message={modalState.message}
      confirmText={modalState.confirmText}
      cancelText={modalState.cancelText}
      onConfirm={modalState.onConfirm}
      showCancel={modalState.showCancel}
      prompt={modalState.prompt}
      promptLabel={modalState.promptLabel}
      promptPlaceholder={modalState.promptPlaceholder}
    />
  )

  return { showModal, closeModal, ModalComponent }
}

export default Modal
