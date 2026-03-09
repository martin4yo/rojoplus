import { useState, useEffect } from 'react'
import { Paperclip, Upload, Trash2, Download, File, FileText, Image, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from './Button'
import { Alert } from './Alert'
import api from '../services/api'
import { useConfirm } from '../hooks/useConfirm'

// Iconos según tipo de archivo
function getFileIcon(mimeType) {
  if (mimeType?.startsWith('image/')) return Image
  if (mimeType?.includes('pdf')) return FileText
  return File
}

// Formatear tamaño de archivo
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Componente reutilizable para gestionar adjuntos de comprobantes
 *
 * @param {string} tipo - Tipo de comprobante: 'movimientoContable' | 'movimientoCaja' | 'ordenCompra' | 'pedido'
 * @param {number} comprobanteId - ID del comprobante
 * @param {boolean} soloLectura - Si es true, no permite subir ni eliminar
 */
export default function AdjuntosComprobante({ tipo, comprobanteId, soloLectura = false }) {
  const { confirm, ConfirmDialog } = useConfirm()
  const [adjuntos, setAdjuntos] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    if (comprobanteId) {
      cargarAdjuntos()
    }
  }, [tipo, comprobanteId])

  async function cargarAdjuntos() {
    try {
      setLoading(true)
      const data = await api.get(`/admin/adjuntos/${tipo}/${comprobanteId}`)
      setAdjuntos(data || [])
    } catch (err) {
      console.error('Error cargando adjuntos:', err)
    } finally {
      setLoading(false)
    }
  }

  async function subirArchivo(file) {
    if (!file) return

    // Validar tamaño (10MB máximo)
    if (file.size > 10 * 1024 * 1024) {
      setError('El archivo no puede superar los 10MB')
      return
    }

    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('archivo', file)

      const response = await api.postFormData(`/admin/adjuntos/${tipo}/${comprobanteId}`, formData)
      setAdjuntos(prev => [response.data, ...prev])
    } catch (err) {
      setError(err.message || 'Error al subir archivo')
    } finally {
      setUploading(false)
    }
  }

  async function eliminarAdjunto(adjuntoId) {
    const confirmed = await confirm('¿Eliminar este adjunto?')
    if (!confirmed) return

    try {
      await api.delete(`/admin/adjuntos/${adjuntoId}`)
      setAdjuntos(prev => prev.filter(a => a.id !== adjuntoId))
      toast.success('Adjunto eliminado')
    } catch (err) {
      setError(err.message || 'Error al eliminar adjunto')
    }
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (file) subirArchivo(file)
    e.target.value = '' // Reset para poder subir el mismo archivo
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) subirArchivo(file)
  }

  function handleDragOver(e) {
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave(e) {
    e.preventDefault()
    setDragOver(false)
  }

  async function descargarAdjunto(adjunto) {
    try {
      const token = localStorage.getItem('adminToken')
      const response = await fetch(`/api/admin/adjuntos/descargar/${adjunto.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('Error al descargar archivo')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = adjunto.nombreOriginal
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      setError('Error al descargar el archivo')
    }
  }

  if (!comprobanteId) {
    return (
      <div className="text-sm text-gray-500 italic">
        Guarde el comprobante para poder adjuntar archivos
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <ConfirmDialog />
      {/* Header */}
      <div className="flex items-center gap-2">
        <Paperclip className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">
          Adjuntos ({adjuntos.length})
        </span>
      </div>

      {error && (
        <Alert variant="error" onClose={() => setError(null)} className="text-sm">
          {error}
        </Alert>
      )}

      {/* Zona de drop / botón subir */}
      {!soloLectura && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            border-2 border-dashed rounded-lg p-4 text-center transition-colors
            ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
            ${uploading ? 'opacity-50 pointer-events-none' : ''}
          `}
        >
          <input
            type="file"
            id={`file-upload-${tipo}-${comprobanteId}`}
            className="hidden"
            onChange={handleFileSelect}
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv"
          />
          <label
            htmlFor={`file-upload-${tipo}-${comprobanteId}`}
            className="cursor-pointer"
          >
            <Upload className="w-6 h-6 mx-auto text-gray-400 mb-2" />
            <span className="text-sm text-gray-600">
              {uploading ? 'Subiendo...' : 'Arrastrá un archivo o hacé click para subir'}
            </span>
            <div className="text-xs text-gray-400 mt-1">
              PDF, imágenes, Word, Excel (máx 10MB)
            </div>
          </label>
        </div>
      )}

      {/* Lista de adjuntos */}
      {loading ? (
        <div className="text-sm text-gray-500">Cargando adjuntos...</div>
      ) : adjuntos.length === 0 ? (
        <div className="text-sm text-gray-400 italic">Sin adjuntos</div>
      ) : (
        <div className="space-y-2">
          {adjuntos.map(adjunto => {
            const FileIcon = getFileIcon(adjunto.tipoMime)
            return (
              <div
                key={adjunto.id}
                className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg group"
              >
                <FileIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-700 truncate">
                    {adjunto.nombreOriginal}
                  </div>
                  <div className="text-xs text-gray-400">
                    {formatSize(adjunto.tamanio)} - {adjunto.admin?.nombre} {adjunto.admin?.apellido}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => descargarAdjunto(adjunto)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                    title="Descargar"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  {!soloLectura && (
                    <button
                      onClick={() => eliminarAdjunto(adjunto.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
