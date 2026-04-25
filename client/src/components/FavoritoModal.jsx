import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'
import IconPicker from './IconPicker'
import { LucideIcon } from './IconPicker'
import { SHORTCUT_COLORS, FOLDER_PRESETS } from './favoritos/presets'
import api from '../services/api'
import toast from 'react-hot-toast'

/**
 * Modal para crear/editar un acceso rápido (favorito).
 * - Sin `favorito` → crea uno nuevo, prellena URL con la actual del navegador.
 * - Con `favorito` → modo edición.
 *
 * `carpetas` se pasa desde el llamador para poder mostrar el selector.
 * `onCarpetasChange` se llama cuando se crea una carpeta nueva inline para refrescar.
 * `carpetaIdDefault` permite prellenar carpeta al crear desde una carpeta concreta.
 */
export default function FavoritoModal({
  isOpen,
  onClose,
  favorito,
  carpetas = [],
  onSaved,
  onCarpetasChange,
  carpetaIdDefault = null,
}) {
  const editing = !!favorito

  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [icono, setIcono] = useState('Star')
  const [iconoColor, setIconoColor] = useState(null)
  const [url, setUrl] = useState('')
  const [abreEnNuevaPestana, setAbreEnNuevaPestana] = useState(false)
  const [carpetaId, setCarpetaId] = useState(null)
  const [creandoCarpeta, setCreandoCarpeta] = useState(false)
  const [nuevaCarpetaNombre, setNuevaCarpetaNombre] = useState('')
  const [nuevaCarpetaColor, setNuevaCarpetaColor] = useState('blue')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    if (favorito) {
      setNombre(favorito.nombre || '')
      setDescripcion(favorito.descripcion || '')
      setIcono(favorito.icono || 'Star')
      setIconoColor(favorito.iconoColor || null)
      setUrl(favorito.url || '')
      setAbreEnNuevaPestana(!!favorito.abreEnNuevaPestana)
      setCarpetaId(favorito.carpetaId ?? null)
    } else {
      setNombre('')
      setDescripcion('')
      setIcono('Star')
      setIconoColor(null)
      setUrl(window.location.pathname + window.location.search)
      setAbreEnNuevaPestana(false)
      setCarpetaId(carpetaIdDefault ?? null)
    }
    setCreandoCarpeta(false)
    setNuevaCarpetaNombre('')
    setNuevaCarpetaColor('blue')
  }, [isOpen, favorito, carpetaIdDefault])

  async function crearCarpeta() {
    if (!nuevaCarpetaNombre.trim()) {
      toast.error('Ingresá un nombre para la carpeta')
      return
    }
    try {
      const res = await api.post('/admin/favoritos-carpetas', {
        nombre: nuevaCarpetaNombre.trim(),
        color: nuevaCarpetaColor,
      })
      const carpeta = res?.data || res
      toast.success('Carpeta creada')
      setCreandoCarpeta(false)
      setNuevaCarpetaNombre('')
      setCarpetaId(carpeta.id)
      onCarpetasChange?.()
    } catch (err) {
      toast.error('Error al crear carpeta')
    }
  }

  async function handleGuardar() {
    if (!nombre.trim()) {
      toast.error('Ingresá un nombre')
      return
    }
    if (!url.trim()) {
      toast.error('Ingresá una URL')
      return
    }

    setSaving(true)
    try {
      const payload = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        icono,
        iconoColor: iconoColor || null,
        url: url.trim(),
        abreEnNuevaPestana,
        carpetaId: carpetaId || null,
      }
      if (editing) {
        await api.put(`/admin/favoritos/${favorito.id}`, payload)
        toast.success('Atajo actualizado')
      } else {
        await api.post('/admin/favoritos', payload)
        toast.success('Atajo creado')
      }
      onSaved?.()
      onClose()
    } catch (err) {
      toast.error(err?.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const previewColor = iconoColor || '#6b7280'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? 'Editar atajo' : 'Nuevo atajo'}
      maxWidth="max-w-lg"
    >
      <div className="space-y-4">
        {/* Preview + nombre */}
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: previewColor + '20' }}
          >
            <LucideIcon name={icono} className="w-6 h-6" style={{ color: previewColor }} />
          </div>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre del acceso"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descripción
          </label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Breve descripción opcional..."
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
        </div>

        {/* Color de ícono */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Color del ícono</label>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setIconoColor(null)}
              className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs text-gray-500 ${
                iconoColor === null ? 'border-gray-700' : 'border-gray-200'
              }`}
              title="Sin color (gris por defecto)"
            >
              ∅
            </button>
            {SHORTCUT_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setIconoColor(c)}
                className={`w-7 h-7 rounded-full border-2 transition-transform ${
                  iconoColor === c ? 'border-gray-700 scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        </div>

        {/* Ícono */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ícono</label>
          <IconPicker value={icono} onChange={setIcono} />
        </div>

        {/* URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            URL <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="/admin/cobranzas o https://..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
          />
          <p className="text-xs text-gray-500 mt-1">
            Ruta interna (<code>/admin/...</code>) o URL externa (<code>https://...</code>)
          </p>
        </div>

        {/* Carpeta */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Carpeta</label>
          {!creandoCarpeta ? (
            <div className="flex items-center gap-2">
              <select
                value={carpetaId ?? ''}
                onChange={(e) => setCarpetaId(e.target.value ? parseInt(e.target.value) : null)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">— Sin carpeta (raíz) —</option>
                {carpetas.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setCreandoCarpeta(true)}
                className="px-2 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 text-sm flex items-center gap-1"
                title="Crear nueva carpeta"
              >
                <Plus className="w-4 h-4" />
                Nueva
              </button>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
              <input
                type="text"
                value={nuevaCarpetaNombre}
                onChange={(e) => setNuevaCarpetaNombre(e.target.value)}
                placeholder="Nombre de la nueva carpeta"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                autoFocus
              />
              <div className="flex items-center gap-1.5">
                {FOLDER_PRESETS.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setNuevaCarpetaColor(p.id)}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${
                      nuevaCarpetaColor === p.id ? 'border-gray-700 scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: p.icon }}
                    title={p.nombre}
                  />
                ))}
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => setCreandoCarpeta(false)}
                  className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 rounded"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={crearCarpeta}
                  className="px-2 py-1 text-xs bg-primary text-white rounded hover:opacity-90"
                >
                  Crear
                </button>
              </div>
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={abreEnNuevaPestana}
            onChange={(e) => setAbreEnNuevaPestana(e.target.checked)}
            className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
          />
          <span className="text-sm text-gray-700">Abrir en una nueva pestaña</span>
        </label>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={handleGuardar} disabled={saving}>
          {saving ? 'Guardando...' : (editing ? 'Guardar cambios' : 'Crear acceso')}
        </Button>
      </div>
    </Modal>
  )
}
