import { useState } from 'react'
import api from '../../services/api'
import {
  EnvelopeIcon,
  IdentificationIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'

/**
 * Login del Socio con Magic Link
 *
 * Sistema seguro de autenticación sin contraseñas:
 * 1. Socio ingresa email o DNI
 * 2. Se envía un link mágico al email
 * 3. Socio hace clic en el link y accede directamente
 * 4. Link válido por 24 horas
 *
 * Ventajas:
 * - Sin contraseñas que recordar
 * - Seguro (token único temporal)
 * - Simple de usar
 * - Acceso desde cualquier dispositivo
 */
export default function LoginSocio() {
  const [metodo, setMetodo] = useState('email') // 'email' | 'dni'
  const [valor, setValor] = useState('')
  const [loading, setLoading] = useState(false)
  const [linkEnviado, setLinkEnviado] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!valor.trim()) return

    try {
      setLoading(true)
      setError(null)

      await api.post('/socio/enviar-link-acceso', {
        metodo,
        valor: valor.trim(),
      })

      setLinkEnviado(true)
    } catch (err) {
      setError(err.message || 'Error al enviar el link. Verifica tus datos.')
    } finally {
      setLoading(false)
    }
  }

  if (linkEnviado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="bg-green-100 rounded-full p-4 w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <CheckCircleIcon className="h-12 w-12 text-green-600" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-3">¡Link enviado!</h1>
          <p className="text-gray-600 mb-6">
            Revisa tu email{' '}
            <span className="font-semibold text-gray-900">
              {metodo === 'email' ? valor : 'registrado'}
            </span>
            . Hemos enviado un link de acceso que será válido por 24 horas.
          </p>

          <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 mb-6">
            <div className="flex">
              <ShieldCheckIcon className="h-5 w-5 text-blue-500 mr-3" />
              <div className="text-left">
                <p className="text-sm font-medium text-blue-900">Link seguro</p>
                <p className="text-sm text-blue-700 mt-1">
                  Por seguridad, el link solo funciona desde el dispositivo donde lo abras
                </p>
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-500 space-y-2">
            <p>💡 Guarda el email para futuros accesos</p>
            <p>📱 Puedes acceder desde tu celular o computadora</p>
          </div>

          <button
            onClick={() => {
              setLinkEnviado(false)
              setValor('')
            }}
            className="mt-6 text-red-600 hover:text-red-700 font-medium"
          >
            Volver
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="rounded-2xl shadow-xl overflow-hidden max-w-4xl w-full grid grid-cols-1 md:grid-cols-2">
        {/* Panel izquierdo - Info */}
        <div className="bg-gradient-to-br from-red-600 to-red-700 p-8 md:p-12 text-white">
          <div className="mb-8">
            <img src="/images/logo.png" alt="Logo" className="h-16 mb-4" />
            <h1 className="text-3xl font-bold mb-2">Portal del Socio</h1>
            <p className="text-red-100 text-lg">Tu pasión tiene recompensas</p>
          </div>

          <div className="space-y-6">
            <div className="flex items-start space-x-3">
              <div className="bg-white bg-opacity-20 rounded-lg p-2">
                <ShieldCheckIcon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Acceso seguro sin contraseñas</h3>
                <p className="text-red-100 text-sm">
                  Ingresa tu email o DNI y te enviaremos un link de acceso directo
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="bg-white bg-opacity-20 rounded-lg p-2">
                <CheckCircleIcon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Todo en un solo lugar</h3>
                <p className="text-red-100 text-sm">
                  Gestiona tus datos, inscripciones, pagos y mucho más
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Panel derecho - Formulario */}
        <div className="p-8 md:p-12 bg-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Acceder al Portal</h2>

          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 rounded p-4">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Selector de método */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMetodo('email')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  metodo === 'email'
                    ? 'border-red-600 bg-red-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <EnvelopeIcon className={`h-8 w-8 mx-auto mb-2 ${metodo === 'email' ? 'text-red-600' : 'text-gray-400'}`} />
                <p className={`text-sm font-medium ${metodo === 'email' ? 'text-red-600' : 'text-gray-600'}`}>
                  Por Email
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMetodo('dni')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  metodo === 'dni'
                    ? 'border-red-600 bg-red-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <IdentificationIcon className={`h-8 w-8 mx-auto mb-2 ${metodo === 'dni' ? 'text-red-600' : 'text-gray-400'}`} />
                <p className={`text-sm font-medium ${metodo === 'dni' ? 'text-red-600' : 'text-gray-600'}`}>
                  Por DNI
                </p>
              </button>
            </div>

            {/* Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {metodo === 'email' ? 'Tu Email' : 'Tu DNI'}
              </label>
              <input
                type={metodo === 'email' ? 'email' : 'text'}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder={metodo === 'email' ? 'socio@ejemplo.com' : '12345678'}
                required
                className="block w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
              />
              <p className="mt-2 text-xs text-gray-500">
                {metodo === 'email'
                  ? 'Usaremos tu email registrado en el club'
                  : 'Ingresa tu DNI sin puntos ni espacios'}
              </p>
            </div>

            {/* Botón de envío */}
            <button
              type="submit"
              disabled={loading || !valor.trim()}
              className="w-full inline-flex items-center justify-center px-6 py-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Enviando...
                </>
              ) : (
                <>
                  <PaperAirplaneIcon className="h-5 w-5 mr-2" />
                  Enviar Link de Acceso
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">
              ¿Primera vez? Contacta al club para registrarte
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
