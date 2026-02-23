import { WifiOff, RefreshCw, AlertTriangle } from 'lucide-react'
import { Button } from './Button'

export function ConnectionError({ onRetry, error }) {
  const isServerDown = error?.code === 'ERR_NETWORK' || error?.code === 'ECONNREFUSED'

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        {/* Icono */}
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-red-100 rounded-full animate-ping opacity-75"></div>
            <div className="relative bg-red-50 rounded-full p-6">
              {isServerDown ? (
                <WifiOff className="w-12 h-12 text-red-500" />
              ) : (
                <AlertTriangle className="w-12 h-12 text-amber-500" />
              )}
            </div>
          </div>
        </div>

        {/* Título */}
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          {isServerDown ? '¡Ups! Sin conexión' : 'Algo salió mal'}
        </h1>

        {/* Descripción */}
        <p className="text-gray-600 mb-6 leading-relaxed">
          {isServerDown ? (
            <>
              No pudimos conectarnos con el servidor.
              <br />
              Por favor, verifica tu conexión a internet o inténtalo nuevamente en unos momentos.
            </>
          ) : (
            <>
              Ocurrió un problema inesperado.
              <br />
              Por favor, intenta recargar la página.
            </>
          )}
        </p>

        {/* Detalles técnicos (colapsable) */}
        {error && (
          <details className="mb-6 text-left">
            <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
              Ver detalles técnicos
            </summary>
            <div className="mt-2 p-3 bg-gray-50 rounded-lg">
              <code className="text-xs text-gray-700 break-all">
                {error.message || error.toString()}
              </code>
            </div>
          </details>
        )}

        {/* Acciones */}
        <div className="flex flex-col gap-3">
          <Button
            onClick={onRetry || (() => window.location.reload())}
            className="flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Reintentar
          </Button>

          <button
            onClick={() => window.location.href = '/'}
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Volver al inicio
          </button>
        </div>

        {/* Mensaje de contacto */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Si el problema persiste, contacta al administrador del sistema
          </p>
        </div>
      </div>
    </div>
  )
}

export default ConnectionError
