import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Save, Trash2, ChevronDown } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import reportPresetsApi from '../../../services/reportPresetsApi'
import { TOKENS, isToken, tokenPreviewLabel } from '../../../utils/reportTokens'
import { useConfirm } from '../../../hooks/useConfirm'

export default function PresetModal({ templateId, templateName, parameters, preset, onClose }) {
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialog } = useConfirm()
  const [name, setName] = useState(preset?.name || '')
  const [description, setDescription] = useState(preset?.description || '')
  const [params, setParams] = useState(preset?.params || {})
  const [tokenPickerOpen, setTokenPickerOpen] = useState(null)
  const [tokenPickerRect, setTokenPickerRect] = useState(null)
  const tokenButtonRefs = useRef({})

  useEffect(() => {
    if (preset) {
      setName(preset.name)
      setDescription(preset.description || '')
      setParams(preset.params || {})
    }
  }, [preset])

  const openTokenPicker = useCallback((paramName) => {
    if (tokenPickerOpen === paramName) { setTokenPickerOpen(null); return }
    const btn = tokenButtonRefs.current[paramName]
    if (btn) setTokenPickerRect(btn.getBoundingClientRect())
    setTokenPickerOpen(paramName)
  }, [tokenPickerOpen])

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['report-presets'] })

  const saveMutation = useMutation({
    mutationFn: () => preset
      ? reportPresetsApi.update(preset.id, { name, description, params })
      : reportPresetsApi.create({ templateId, name, description, params }),
    onSuccess: () => { invalidate(); onClose() },
    onError: (err) => toast.error('Error al guardar: ' + err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () => reportPresetsApi.delete(preset.id),
    onSuccess: () => { invalidate(); onClose() },
    onError: (err) => toast.error('Error al eliminar: ' + err.message),
  })

  const setParam = (name, value) => {
    setParams(prev => ({ ...prev, [name]: value }))
    setTokenPickerOpen(null)
  }

  const renderParamRow = (p) => {
    const value = params[p.name] ?? ''
    const isTokenValue = isToken(value)
    return (
      <tr key={p.name} className="border-b border-gray-100">
        <td className="py-2 pr-3 text-sm font-medium text-gray-700 whitespace-nowrap w-1/3">
          {p.label}{p.required && <span className="text-red-400 ml-0.5">*</span>}
          <div className="text-xs text-gray-400 font-normal">{p.type}</div>
        </td>
        <td className="py-2">
          <div className="flex gap-1.5 items-center">
            {isTokenValue ? (
              <div className="flex-1 flex items-center gap-2 px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-md text-sm">
                <span className="text-blue-700 font-medium">{TOKENS.find(t => t.value === value)?.label || value}</span>
                <span className="text-blue-400 text-xs">→ {tokenPreviewLabel(value)}</span>
              </div>
            ) : (
              <input
                type={p.type === 'date' ? 'date' : p.type === 'number' ? 'number' : 'text'}
                value={value}
                onChange={e => setParams(prev => ({ ...prev, [p.name]: e.target.value }))}
                placeholder="Dejar vacío para pedir al ejecutar"
                className="flex-1 border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            )}
            {value && (
              <button onClick={() => setParam(p.name, '')} className="p-1 text-gray-400 hover:text-red-500">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            {p.type !== 'boolean' && p.type !== 'select' && (
              <button
                ref={el => { tokenButtonRefs.current[p.name] = el }}
                onClick={() => openTokenPicker(p.name)}
                className="flex items-center gap-0.5 px-2 py-1.5 border border-gray-300 rounded-md text-xs text-gray-600 hover:bg-gray-50 flex-shrink-0"
              >
                @token <ChevronDown className="h-3 w-3" />
              </button>
            )}
          </div>
        </td>
      </tr>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl mx-4 flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <div>
              <h2 className="font-semibold text-gray-900">{preset ? 'Editar acceso rápido' : 'Nuevo acceso rápido'}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{templateName}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
          </div>

          <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nombre *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Ej: Cuotas del mes actual" autoFocus
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Descripción</label>
                <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Descripción opcional"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>

            {parameters.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Parámetros por defecto</h3>
                <p className="text-xs text-gray-400 mb-3">
                  Dejá vacío los que querés que el usuario ingrese al ejecutar. Usá @token para valores dinámicos.
                </p>
                <table className="w-full"><tbody>{parameters.map(renderParamRow)}</tbody></table>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200">
            {preset ? (
              <button
                onClick={async () => { if (await confirm('¿Eliminar acceso rápido?', `Se eliminará "${preset.name}". Esta acción no se puede deshacer.`)) deleteMutation.mutate() }}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700 disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" /> Eliminar
              </button>
            ) : <div />}
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={() => saveMutation.mutate()} disabled={!name.trim() || saveMutation.isPending}
                className="flex items-center gap-1 px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
              >
                <Save className="h-3.5 w-3.5" /> {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {tokenPickerOpen && tokenPickerRect && createPortal(
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setTokenPickerOpen(null)} />
          <div className="fixed z-[91] bg-white border border-gray-200 rounded-lg shadow-xl w-64 py-1 max-h-72 overflow-y-auto"
            style={{ top: tokenPickerRect.bottom + 4, left: Math.min(tokenPickerRect.right - 256, window.innerWidth - 272) }}>
            {TOKENS.map(t => (
              <button key={t.value} onClick={() => setParam(tokenPickerOpen, t.value)}
                className="w-full text-left px-3 py-2 hover:bg-blue-50 flex flex-col">
                <span className="text-sm font-medium text-gray-800">{t.label}</span>
                <span className="text-xs text-gray-400">{t.value} → {tokenPreviewLabel(t.value)}</span>
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
      <ConfirmDialog />
    </>
  )
}
