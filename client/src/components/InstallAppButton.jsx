import { useState, useEffect } from 'react'
import { Download, Smartphone, X, Share, PlusSquare, ChevronDown } from 'lucide-react'
import { useTenant } from '../contexts/TenantContext'

export default function InstallAppButton() {
  const { tenant } = useTenant()
  const nombreApp = tenant?.nombre || 'la app'
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showButton, setShowButton] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showBanner, setShowBanner] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)

  useEffect(() => {
    // Verificar si ya está instalada (modo standalone)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    // Verificar si está en iOS standalone (instalada)
    if (window.navigator.standalone === true) {
      setIsInstalled(true)
      return
    }

    // Detectar iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
    setIsIOS(isIOSDevice)

    // Verificar si el usuario ya descartó el banner
    const dismissed = localStorage.getItem('installBannerDismissed')
    if (dismissed) {
      const dismissedDate = new Date(dismissed)
      const now = new Date()
      const diffDays = (now - dismissedDate) / (1000 * 60 * 60 * 24)
      // Mostrar de nuevo después de 3 días
      if (diffDays < 3) {
        // Pero mostrar el botón pequeño para iOS
        if (isIOSDevice) {
          setShowButton(true)
        }
        return
      }
    }

    // Para iOS, mostrar banner con instrucciones
    if (isIOSDevice) {
      setShowButton(true)
      setTimeout(() => setShowBanner(true), 2000)
      return
    }

    // Para otros navegadores, capturar el evento beforeinstallprompt
    const handleBeforeInstall = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowButton(true)
      // Mostrar banner después de 2 segundos
      setTimeout(() => setShowBanner(true), 2000)
    }

    // Detectar cuando se instala
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setShowButton(false)
      setShowBanner(false)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstall = async () => {
    // Para iOS, mostrar instrucciones
    if (isIOS) {
      setShowIOSInstructions(true)
      return
    }

    if (!deferredPrompt) return

    setInstalling(true)

    try {
      // Mostrar el prompt de instalación nativo
      deferredPrompt.prompt()

      // Esperar la respuesta del usuario
      const { outcome } = await deferredPrompt.userChoice

      if (outcome === 'accepted') {
        setIsInstalled(true)
        setShowBanner(false)
      }
    } catch (error) {
      console.error('Error instalando:', error)
    } finally {
      setInstalling(false)
      setDeferredPrompt(null)
      setShowButton(false)
    }
  }

  const handleDismiss = () => {
    localStorage.setItem('installBannerDismissed', new Date().toISOString())
    setShowBanner(false)
    setShowIOSInstructions(false)
  }

  // Si ya está instalada, no mostrar nada
  if (isInstalled) {
    return null
  }

  // Si no hay soporte para instalación y no es iOS, no mostrar nada
  if (!showButton && !isIOS) {
    return null
  }

  return (
    <>
      {/* Modal de instrucciones iOS */}
      {showIOSInstructions && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end justify-center p-4">
          <div className="bg-white rounded-t-2xl w-full max-w-md animate-slide-up">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Instalar {nombreApp}</h3>
              <button onClick={() => setShowIOSInstructions(false)} className="text-gray-400">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <p className="text-gray-600 text-sm text-center">
                Sigue estos pasos para instalar la app en tu iPhone:
              </p>

              {/* Paso 1 */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-red-600 font-bold">1</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Toca el boton Compartir</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Esta en la barra inferior de Safari
                  </p>
                  <div className="mt-2 inline-flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
                    <Share className="w-5 h-5 text-blue-500" />
                    <span className="text-sm text-gray-700">Compartir</span>
                  </div>
                </div>
              </div>

              {/* Paso 2 */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-red-600 font-bold">2</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Desliza y busca la opcion</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Desliza hacia abajo en el menu
                  </p>
                  <div className="mt-2 inline-flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
                    <PlusSquare className="w-5 h-5 text-gray-700" />
                    <span className="text-sm text-gray-700">Agregar a inicio</span>
                  </div>
                </div>
              </div>

              {/* Paso 3 */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-red-600 font-bold">3</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Confirma "Agregar"</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Toca el boton en la esquina superior derecha
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-b-2xl">
              <button
                onClick={() => setShowIOSInstructions(false)}
                className="w-full py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Banner flotante */}
      {showBanner && !showIOSInstructions && (
        <div className="fixed bottom-24 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-gradient-to-r from-red-600 to-red-700 rounded-xl shadow-2xl p-4 z-50 animate-slide-up">
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 text-white/70 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-start gap-3">
            <div className="p-2 bg-white/20 rounded-lg flex-shrink-0">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-white text-sm">
                Instalá {nombreApp}
              </h3>
              <p className="text-white/80 text-xs mt-0.5 mb-3">
                {isIOS
                  ? 'Accede mas rapido desde tu pantalla de inicio'
                  : 'Accede mas rapido desde tu pantalla de inicio'
                }
              </p>
              <button
                onClick={handleInstall}
                disabled={installing}
                className="w-full py-2 bg-white text-red-600 font-semibold text-sm rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {installing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                    Instalando...
                  </>
                ) : isIOS ? (
                  <>
                    <Share className="w-4 h-4" />
                    Ver como instalar
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Instalar App
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Botón fijo en header (alternativa si cierra el banner) */}
      {!showBanner && !showIOSInstructions && (
        <button
          onClick={handleInstall}
          disabled={installing}
          className="fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 bg-white text-red-600 font-medium text-sm rounded-full shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
        >
          {isIOS ? (
            <>
              <Share className="w-4 h-4" />
              <span className="hidden sm:inline">Instalar</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Instalar</span>
            </>
          )}
        </button>
      )}

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
    </>
  )
}
