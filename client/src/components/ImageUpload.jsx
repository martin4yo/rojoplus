import { Upload, X, Image as ImageIcon } from 'lucide-react'
import { useRef, useState, useEffect } from 'react'

/**
 * ImageUpload - Componente reutilizable para subir imágenes con preview
 *
 * @param {string} value - URL de la imagen actual
 * @param {function} onChange - Función llamada con el archivo o URL seleccionado
 * @param {string} accept - Tipos de archivo aceptados (default: 'image/*')
 * @param {number} maxSize - Tamaño máximo en bytes (default: 5MB)
 * @param {number} maxWidth - Ancho máximo de la imagen en px (para validación)
 * @param {number} maxHeight - Alto máximo de la imagen en px (para validación)
 * @param {boolean} showPreview - Mostrar preview de la imagen (default: true)
 * @param {string} previewSize - Tamaño del preview: 'sm' | 'md' | 'lg' (default: 'md')
 * @param {string} placeholder - Texto placeholder
 * @param {boolean} disabled - Deshabilitar el input
 * @param {function} onError - Función llamada cuando hay un error
 * @param {string} className - Clases adicionales
 * @param {boolean} returnBase64 - Retornar la imagen como Base64 (default: false)
 * @param {boolean} returnFile - Retornar el objeto File (default: true)
 * @param {number} maxDimension - Si se define y returnBase64=true, redimensiona la imagen para que su lado mayor no supere este valor en px (reduce el peso del base64)
 *
 * @example
 * // Subida simple con preview
 * const [imagen, setImagen] = useState(null)
 *
 * <ImageUpload
 *   value={imagen}
 *   onChange={setImagen}
 *   placeholder="Subir logo de la empresa"
 *   maxSize={2 * 1024 * 1024} // 2MB
 * />
 *
 * @example
 * // Con validación y Base64
 * <ImageUpload
 *   value={formData.foto}
 *   onChange={(base64) => setFormData({ ...formData, foto: base64 })}
 *   returnBase64={true}
 *   returnFile={false}
 *   maxSize={5 * 1024 * 1024}
 *   accept="image/jpeg,image/png,image/webp"
 *   onError={(error) => toast.error(error)}
 * />
 */
export default function ImageUpload({
  value,
  onChange,
  accept = 'image/*',
  maxSize = 5 * 1024 * 1024, // 5MB default
  maxWidth,
  maxHeight,
  showPreview = true,
  previewSize = 'md',
  placeholder = 'Haz click o arrastra una imagen aquí',
  disabled = false,
  onError,
  className = '',
  returnBase64 = false,
  returnFile = true,
  maxDimension
}) {
  const [preview, setPreview] = useState(value)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)

  // Re-sincronizar el preview cuando cambia el value externo (ej: datos cargados de forma async al editar)
  useEffect(() => {
    setPreview(value)
  }, [value])

  // Tamaños de preview
  const previewSizes = {
    sm: 'w-24 h-24',
    md: 'w-40 h-40',
    lg: 'w-64 h-64'
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const validateFile = (file) => {
    // Validar tipo
    if (!file.type.startsWith('image/')) {
      const error = 'El archivo debe ser una imagen'
      if (onError) onError(error)
      return false
    }

    // Validar tamaño
    if (file.size > maxSize) {
      const error = `La imagen excede el tamaño máximo permitido (${formatFileSize(maxSize)})`
      if (onError) onError(error)
      return false
    }

    return true
  }

  const validateImageDimensions = (file) => {
    return new Promise((resolve, reject) => {
      if (!maxWidth && !maxHeight) {
        resolve(true)
        return
      }

      const img = new Image()
      const objectUrl = URL.createObjectURL(file)

      img.onload = () => {
        URL.revokeObjectURL(objectUrl)

        if (maxWidth && img.width > maxWidth) {
          reject(`El ancho de la imagen no debe superar ${maxWidth}px`)
          return
        }

        if (maxHeight && img.height > maxHeight) {
          reject(`El alto de la imagen no debe superar ${maxHeight}px`)
          return
        }

        resolve(true)
      }

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        reject('Error al cargar la imagen')
      }

      img.src = objectUrl
    })
  }

  // Redimensiona la imagen en un canvas y devuelve un base64 más liviano
  const resizeToBase64 = (file, maxDim) => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const objectUrl = URL.createObjectURL(file)

      img.onload = () => {
        URL.revokeObjectURL(objectUrl)

        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        // PNG conserva transparencia; el resto se exporta como JPEG (mucho más liviano)
        const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
        resolve(canvas.toDataURL(mime, 0.85))
      }

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        reject('Error al procesar la imagen')
      }

      img.src = objectUrl
    })
  }

  const processFile = async (file) => {
    if (!validateFile(file)) return

    try {
      // Validar dimensiones si es necesario
      if (maxWidth || maxHeight) {
        await validateImageDimensions(file)
      }

      // Si se pide base64 redimensionado, procesar con canvas en vez de leer el archivo completo
      if (returnBase64 && maxDimension) {
        const result = await resizeToBase64(file, maxDimension)
        setPreview(result)
        if (returnFile) {
          onChange({ base64: result, file })
        } else {
          onChange(result)
        }
        return
      }

      // Crear preview
      const reader = new FileReader()

      reader.onload = (e) => {
        const result = e.target.result
        setPreview(result)

        // Retornar según configuración
        if (returnBase64 && returnFile) {
          onChange({ base64: result, file })
        } else if (returnBase64) {
          onChange(result)
        } else if (returnFile) {
          onChange(file)
        }
      }

      reader.readAsDataURL(file)
    } catch (error) {
      if (onError) onError(error)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      processFile(file)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      processFile(file)
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleRemove = (e) => {
    e.stopPropagation()
    setPreview(null)
    onChange(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className={className}>
      {/* Preview de imagen */}
      {showPreview && preview ? (
        <div className="relative inline-block">
          <img
            src={preview}
            alt="Preview"
            className={`${previewSizes[previewSize]} object-cover rounded-lg border-2 border-gray-200`}
          />
          {!disabled && (
            <button
              type="button"
              onClick={handleRemove}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors shadow-lg"
            >
              <X size={16} />
            </button>
          )}
        </div>
      ) : (
        /* Zona de upload */
        <div
          onClick={!disabled ? handleClick : undefined}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
            ${isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <ImageIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 mb-2">{placeholder}</p>
          <p className="text-sm text-gray-400">
            Máximo {formatFileSize(maxSize)}
          </p>
          {accept !== 'image/*' && (
            <p className="text-xs text-gray-400 mt-1">
              Formatos: {accept.split(',').map(type => type.split('/')[1].toUpperCase()).join(', ')}
            </p>
          )}
        </div>
      )}

      {/* Input oculto */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        disabled={disabled}
        className="hidden"
      />
    </div>
  )
}

/**
 * MultiImageUpload - Componente para subir múltiples imágenes
 *
 * @param {array} images - Array de URLs de imágenes actuales
 * @param {function} onChange - Función llamada con el nuevo array de imágenes
 * @param {number} maxImages - Máximo de imágenes permitidas
 * @param {function} onMainChange - Función llamada cuando cambia la imagen principal
 * @param {number} mainImageIndex - Índice de la imagen principal
 *
 * @example
 * const [imagenes, setImagenes] = useState([])
 *
 * <MultiImageUpload
 *   images={imagenes}
 *   onChange={setImagenes}
 *   maxImages={5}
 *   mainImageIndex={0}
 *   onMainChange={(index) => setMainIndex(index)}
 * />
 */
export function MultiImageUpload({
  images = [],
  onChange,
  maxImages = 5,
  onMainChange,
  mainImageIndex = 0,
  ...uploadProps
}) {
  const handleAddImage = (newImage) => {
    if (images.length < maxImages) {
      onChange([...images, newImage])
    }
  }

  const handleRemoveImage = (index) => {
    const newImages = images.filter((_, i) => i !== index)
    onChange(newImages)

    // Ajustar índice principal si es necesario
    if (onMainChange && index === mainImageIndex) {
      onMainChange(0)
    } else if (onMainChange && index < mainImageIndex) {
      onMainChange(mainImageIndex - 1)
    }
  }

  const handleSetMain = (index) => {
    if (onMainChange) {
      onMainChange(index)
    }
  }

  return (
    <div className="space-y-4">
      {/* Grid de imágenes */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image, index) => (
            <div key={index} className="relative group">
              <img
                src={image}
                alt={`Imagen ${index + 1}`}
                className="w-full h-32 object-cover rounded-lg border-2 border-gray-200"
              />

              {/* Badge de imagen principal */}
              {index === mainImageIndex && (
                <div className="absolute top-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded text-xs font-bold">
                  Principal
                </div>
              )}

              {/* Overlay con acciones */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all rounded-lg flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                {index !== mainImageIndex && onMainChange && (
                  <button
                    onClick={() => handleSetMain(index)}
                    className="bg-yellow-500 text-white p-2 rounded-full hover:bg-yellow-600 transition-colors"
                    title="Marcar como principal"
                  >
                    ⭐
                  </button>
                )}
                <button
                  onClick={() => handleRemoveImage(index)}
                  className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
                  title="Eliminar"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Botón para agregar más */}
      {images.length < maxImages && (
        <ImageUpload
          {...uploadProps}
          onChange={handleAddImage}
          showPreview={false}
          placeholder={`Agregar imagen (${images.length}/${maxImages})`}
        />
      )}
    </div>
  )
}
