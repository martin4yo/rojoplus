import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, WifiOff, X } from 'lucide-react'

// Notifica cuando hay una nueva versión disponible
function UpdateBanner() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      // Chequear actualizaciones cada hora
      setInterval(() => r?.update(), 60 * 60 * 1000)
    },
  })

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3 text-sm animate-slide-up max-w-sm w-full mx-4">
      <RefreshCw className="w-4 h-4 flex-shrink-0 text-primary" />
      <span className="flex-1">Nueva versión disponible</span>
      <button
        onClick={() => updateServiceWorker(true)}
        className="px-3 py-1 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary-dark transition"
      >
        Actualizar
      </button>
    </div>
  )
}

// Indicador de estado offline
function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine)
  const [showOffline, setShowOffline] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true)
      // Mantener el banner de "volvió la conexión" 3s
      setTimeout(() => setShowOffline(false), 3000)
    }
    const handleOffline = () => {
      setOnline(false)
      setShowOffline(true)
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (!showOffline) return null

  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3 text-sm text-white max-w-xs w-full mx-4 transition-all ${online ? 'bg-green-600' : 'bg-gray-700'}`}>
      <WifiOff className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1">{online ? 'Conexión restaurada' : 'Sin conexión a internet'}</span>
      {!online && (
        <button onClick={() => setShowOffline(false)} className="p-1 hover:opacity-70">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

export default function SWUpdateNotifier() {
  return (
    <>
      <UpdateBanner />
      <OfflineBanner />
    </>
  )
}
