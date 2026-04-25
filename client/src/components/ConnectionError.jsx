import { WifiOff, RefreshCw, AlertTriangle } from 'lucide-react'
import { Button } from './Button'
import TenantLogo from './TenantLogo'
import { useTenant } from '../contexts/TenantContext'

export function ConnectionError({ onRetry, error }) {
  const isServerDown = error?.code === 'ERR_NETWORK' || error?.code === 'ECONNREFUSED'
  const isDatabaseDown = error?.code === 'DATABASE_UNAVAILABLE' || error?.status === 503
  const { tenant } = useTenant?.() || { tenant: null }

  const titulo = isServerDown
    ? '¡Ups! Sin conexión'
    : isDatabaseDown
    ? 'Servicio momentáneamente no disponible'
    : 'Algo salió mal'

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        {/* Logo del tenant */}
        <div className="flex justify-center mb-6">
          <TenantLogo className="h-14" />
        </div>

        {/* Icono usando paleta del tenant */}
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <div
              className="absolute inset-0 rounded-full animate-ping opacity-40"
              style={{ background: 'var(--color-primary, #ef4444)' }}
            ></div>
            <div
              className="relative rounded-full p-5"
              style={{ background: 'var(--color-primary, #ef4444)' }}
            >
              {isServerDown ? (
                <WifiOff className="w-12 h-12 text-white" />
              ) : (
                <AlertTriangle className="w-12 h-12 text-white" />
              )}
            </div>
          </div>
        </div>

        {/* Título */}
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          {titulo}
        </h1>

        {/* Descripción */}
        <p className="text-gray-600 mb-6 leading-relaxed">
          {isServerDown ? (
            <>
              No pudimos conectarnos con el servidor de {tenant?.nombre || 'Clubix'}.
              <br />
              Verificá tu conexión a internet o intentá nuevamente en unos momentos.
            </>
          ) : isDatabaseDown ? (
            <>
              Estamos experimentando dificultades técnicas temporales.
              <br />
              Nuestro equipo está trabajando para resolverlo. Reintentá en unos momentos.
            </>
          ) : (
            <>
              Ocurrió un problema inesperado.
              <br />
              Por favor, intentá recargar la página.
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
