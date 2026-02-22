import { useState, useEffect } from 'react'
import { Camera, QrCode, CheckCircle, XCircle, Smartphone, Wifi, WifiOff } from 'lucide-react'
import { Button } from '../../../components/Button'

export default function ControlPWA() {
  const [scanning, setScanning] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [loading, setLoading] = useState(false)
  const [stream, setStream] = useState(null)
  const [dispositivoId, setDispositivoId] = useState(1)
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    // Listeners para estado de conexión
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      detenerCamara()
    }
  }, [])

  const iniciarEscaneo = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })
      setStream(mediaStream)
      setScanning(true)
      setResultado(null)
    } catch (error) {
      console.error('Error accediendo a cámara:', error)
      alert('No se pudo acceder a la cámara. Verifique los permisos.')
    }
  }

  const detenerCamara = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    setScanning(false)
  }

  const procesarQR = async (qrCode) => {
    if (loading) return

    setLoading(true)
    detenerCamara()

    try {
      // 1. Validar el QR
      const responseValidar = await fetch('/api/accesos/validar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dispositivoId,
          tipoLectura: 'QR',
          valorLeido: qrCode
        })
      })

      const dataValidar = await responseValidar.json()

      if (!dataValidar.success) {
        throw new Error(dataValidar.error || 'Error validando QR')
      }

      const validacion = dataValidar.data

      if (validacion.permitido) {
        // 2. Si está permitido, abrir molinete
        const responseAbrir = await fetch('/api/accesos/abrir-molinete', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            dispositivoId,
            valorLeido: qrCode,
            socioId: validacion.persona?.id
          })
        })

        const dataAbrir = await responseAbrir.json()

        if (dataAbrir.success) {
          // Vibración de éxito
          if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100])
          }

          setResultado({
            tipo: 'PERMITIDO',
            mensaje: validacion.mensaje,
            persona: validacion.persona
          })

          // Auto-cerrar después de 3 segundos
          setTimeout(() => {
            setResultado(null)
          }, 3000)
        } else {
          throw new Error(dataAbrir.error || 'Error abriendo molinete')
        }
      } else {
        // Acceso denegado
        if (navigator.vibrate) {
          navigator.vibrate(500)
        }

        setResultado({
          tipo: 'DENEGADO',
          mensaje: validacion.mensaje,
          motivo: validacion.motivo,
          persona: validacion.persona
        })

        // Auto-cerrar después de 5 segundos
        setTimeout(() => {
          setResultado(null)
        }, 5000)
      }

    } catch (error) {
      console.error('Error procesando QR:', error)

      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200])
      }

      setResultado({
        tipo: 'ERROR',
        mensaje: error.message || 'Error al procesar QR'
      })

      setTimeout(() => {
        setResultado(null)
      }, 5000)
    } finally {
      setLoading(false)
    }
  }

  // Simulación de escaneo QR (en producción usar librería como @yudiel/react-qr-scanner)
  const handleManualInput = (e) => {
    e.preventDefault()
    const input = e.target.elements.qrInput.value.trim()
    if (input) {
      procesarQR(input)
      e.target.reset()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4">
      {/* Header */}
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <Smartphone className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Control de Acceso</h1>
              <p className="text-sm text-gray-400">Apertura remota</p>
            </div>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
            online ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {online ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            {online ? 'Online' : 'Offline'}
          </div>
        </div>

        {/* Configuración dispositivo */}
        <div className="bg-gray-800/50 backdrop-blur rounded-xl p-4 mb-6 border border-gray-700">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Dispositivo
          </label>
          <select
            value={dispositivoId}
            onChange={(e) => setDispositivoId(Number(e.target.value))}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white"
          >
            <option value={1}>Molinete Principal</option>
            {/* Más dispositivos se cargarían dinámicamente */}
          </select>
        </div>

        {/* Resultado de validación */}
        {resultado && (
          <div className={`mb-6 rounded-xl p-6 border-2 ${
            resultado.tipo === 'PERMITIDO'
              ? 'bg-green-500/10 border-green-500'
              : resultado.tipo === 'DENEGADO'
              ? 'bg-red-500/10 border-red-500'
              : 'bg-orange-500/10 border-orange-500'
          }`}>
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-full ${
                resultado.tipo === 'PERMITIDO'
                  ? 'bg-green-500'
                  : resultado.tipo === 'DENEGADO'
                  ? 'bg-red-500'
                  : 'bg-orange-500'
              }`}>
                {resultado.tipo === 'PERMITIDO' ? (
                  <CheckCircle className="w-8 h-8 text-white" />
                ) : (
                  <XCircle className="w-8 h-8 text-white" />
                )}
              </div>
              <div className="flex-1">
                <h3 className={`text-lg font-bold mb-1 ${
                  resultado.tipo === 'PERMITIDO'
                    ? 'text-green-400'
                    : resultado.tipo === 'DENEGADO'
                    ? 'text-red-400'
                    : 'text-orange-400'
                }`}>
                  {resultado.tipo === 'PERMITIDO' ? '✅ Acceso Permitido' : '❌ Acceso Denegado'}
                </h3>
                {resultado.persona && (
                  <p className="text-white font-medium mb-1">
                    {resultado.persona.nombre}
                  </p>
                )}
                <p className="text-sm text-gray-300">
                  {resultado.mensaje}
                </p>
                {resultado.motivo && (
                  <p className="text-xs text-gray-400 mt-2">
                    Motivo: {resultado.motivo}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Escáner QR */}
        {!scanning ? (
          <div className="space-y-4">
            <button
              onClick={iniciarEscaneo}
              disabled={!online}
              className={`w-full py-6 rounded-xl font-semibold text-lg transition-all ${
                online
                  ? 'bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20'
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Camera className="w-6 h-6 inline-block mr-2" />
              Escanear QR
            </button>

            {/* Input manual (para testing) */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-900 text-gray-400">o</span>
              </div>
            </div>

            <form onSubmit={handleManualInput} className="space-y-3">
              <input
                type="text"
                name="qrInput"
                placeholder="Ingresar código QR manualmente..."
                disabled={!online}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500"
              />
              <button
                type="submit"
                disabled={!online}
                className={`w-full py-3 rounded-lg font-medium transition-all ${
                  online
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                }`}
              >
                Validar Manualmente
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Simulación de visor de cámara */}
            <div className="aspect-square bg-black rounded-xl overflow-hidden border-4 border-primary flex items-center justify-center">
              <div className="text-center">
                <QrCode className="w-16 h-16 mx-auto mb-4 text-primary animate-pulse" />
                <p className="text-sm text-gray-400">Apunte al código QR</p>
              </div>
            </div>

            <button
              onClick={detenerCamara}
              className="w-full py-3 rounded-lg font-medium bg-gray-700 hover:bg-gray-600 text-white"
            >
              Cancelar
            </button>

            <p className="text-xs text-center text-gray-400">
              💡 En producción, integrar librería de escaneo QR como @yudiel/react-qr-scanner
            </p>
          </div>
        )}

        {/* Información */}
        <div className="mt-8 p-4 bg-gray-800/30 rounded-lg border border-gray-700">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">ℹ️ Instrucciones</h3>
          <ul className="text-xs text-gray-400 space-y-1">
            <li>• Escanee el QR del carnet del socio</li>
            <li>• El sistema validará automáticamente</li>
            <li>• Si está habilitado, abrirá el molinete</li>
            <li>• Requiere conexión a internet</li>
          </ul>
        </div>

        {/* Estado de carga */}
        {loading && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-xl p-6 max-w-sm mx-4">
              <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-center text-white font-medium">Procesando...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
