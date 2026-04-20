import { useState } from 'react'
import { Scanner } from '@yudiel/react-qr-scanner'
import { X, Camera, AlertCircle } from 'lucide-react'
import { Button } from './Button'

export default function QrScanner({ isOpen, onClose, onScan }) {
  const [error, setError] = useState(null)

  if (!isOpen) return null

  function handleScan(result) {
    if (!result || !result[0]?.rawValue) return

    const scannedUrl = result[0].rawValue

    // Extraer el token del URL escaneado
    // Formato esperado: https://<subdomain>.clubix.com.ar/s/{tokenSocio}
    // o http://localhost:5173/s/{tokenSocio}
    const match = scannedUrl.match(/\/s\/([a-f0-9-]+)$/i)

    if (match && match[1]) {
      onScan(match[1])
      onClose()
    } else {
      setError('El QR escaneado no es valido')
      setTimeout(() => setError(null), 3000)
    }
  }

  function handleError(error) {
    console.error('Error de camara:', error)
    setError('No se pudo acceder a la camara. Verifica los permisos.')
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            <span className="font-semibold text-gray-800">Escanear QR de Socio</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 transition"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Scanner */}
        <div className="relative bg-black aspect-square">
          <Scanner
            onScan={handleScan}
            onError={handleError}
            constraints={{
              facingMode: 'environment',
            }}
            styles={{
              container: { width: '100%', height: '100%' },
              video: { width: '100%', height: '100%', objectFit: 'cover' },
            }}
          />
          {/* Overlay con guia */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-48 h-48 border-2 border-white rounded-lg opacity-75" />
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-3 bg-red-50 flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-3 bg-gray-50">
          <p className="text-center text-gray-500 text-sm mb-3">
            Apunta la camara al codigo QR del socio
          </p>
          <Button variant="secondary" onClick={onClose} className="w-full">
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  )
}
