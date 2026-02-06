import { useState, useEffect } from 'react'
import { Bell, X, CheckCircle, AlertCircle } from 'lucide-react'
import { isPushSupported, getNotificationPermission, subscribeToPush } from '../services/pushNotifications'

export default function PushNotificationBanner({ token, onSubscribed }) {
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState(null) // 'success' | 'error' | null

  useEffect(() => {
    // Verificar si mostrar el banner
    const checkShowBanner = async () => {
      // No mostrar si no hay soporte
      if (!isPushSupported()) {
        return
      }

      // No mostrar si ya tiene permiso
      const permission = getNotificationPermission()
      if (permission === 'granted') {
        return
      }

      // No mostrar si fue denegado permanentemente
      if (permission === 'denied') {
        return
      }

      // No mostrar si ya cerró el banner recientemente
      const dismissed = localStorage.getItem('pushBannerDismissed')
      if (dismissed) {
        const dismissedDate = new Date(dismissed)
        const now = new Date()
        const diffDays = (now - dismissedDate) / (1000 * 60 * 60 * 24)
        // Mostrar de nuevo después de 7 días
        if (diffDays < 7) {
          return
        }
      }

      // Mostrar el banner después de un delay
      setTimeout(() => setVisible(true), 3000)
    }

    checkShowBanner()
  }, [])

  const handleActivar = async () => {
    setLoading(true)
    setResultado(null)

    try {
      const result = await subscribeToPush(token)

      if (result.success) {
        setResultado('success')
        localStorage.removeItem('pushBannerDismissed')
        onSubscribed?.()
        setTimeout(() => setVisible(false), 2000)
      } else {
        setResultado('error')
      }
    } catch (error) {
      console.error('Error activando notificaciones:', error)
      setResultado('error')
    } finally {
      setLoading(false)
    }
  }

  const handleCerrar = () => {
    localStorage.setItem('pushBannerDismissed', new Date().toISOString())
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white rounded-xl shadow-lg border border-gray-200 p-4 z-50 animate-slide-up">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-full flex-shrink-0 ${
          resultado === 'success' ? 'bg-green-100' :
          resultado === 'error' ? 'bg-red-100' :
          'bg-primary/10'
        }`}>
          {resultado === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : resultado === 'error' ? (
            <AlertCircle className="w-5 h-5 text-red-600" />
          ) : (
            <Bell className="w-5 h-5 text-primary" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {resultado === 'success' ? (
            <>
              <p className="font-medium text-gray-900">Notificaciones activadas</p>
              <p className="text-sm text-gray-500 mt-0.5">
                Te avisaremos sobre tus cuotas y pagos
              </p>
            </>
          ) : resultado === 'error' ? (
            <>
              <p className="font-medium text-gray-900">No se pudo activar</p>
              <p className="text-sm text-gray-500 mt-0.5">
                Verifica los permisos en tu navegador
              </p>
            </>
          ) : (
            <>
              <p className="font-medium text-gray-900">Activa las notificaciones</p>
              <p className="text-sm text-gray-500 mt-0.5">
                Recibe recordatorios de vencimientos y confirmaciones de pago
              </p>

              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleActivar}
                  disabled={loading}
                  className="px-4 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Activando...' : 'Activar'}
                </button>
                <button
                  onClick={handleCerrar}
                  disabled={loading}
                  className="px-4 py-1.5 text-gray-600 text-sm font-medium hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Ahora no
                </button>
              </div>
            </>
          )}
        </div>

        {!loading && (
          <button
            onClick={handleCerrar}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <style>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
