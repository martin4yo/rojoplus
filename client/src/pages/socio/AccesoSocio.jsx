import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, QrCode, AlertCircle, Store, CheckCircle, Mail } from 'lucide-react'
import { Button } from '../../components/Button'
import api from '../../services/api'
import { useTenant } from '../../contexts/TenantContext'
import TenantLogo from '../../components/TenantLogo'

export default function AccesoSocio() {
  const { tenant } = useTenant()
  const [busqueda, setBusqueda] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState(null)
  const [enviado, setEnviado] = useState(false)
  const [emailEnviado, setEmailEnviado] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!busqueda.trim()) return

    setBuscando(true)
    setError(null)

    try {
      const data = await api.post('/socio/enviar-qr', {
        busqueda: busqueda.trim()
      })

      setEnviado(true)
      setEmailEnviado(data.emailEnviado || '')
    } catch (err) {
      setError(err.message || 'No se encontró un socio con ese número o DNI')
    } finally {
      setBuscando(false)
    }
  }

  // Pantalla de éxito
  if (enviado) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-md mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <Link to="/"><TenantLogo className="h-14 w-auto" /></Link>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-primary font-bold text-lg whitespace-nowrap">{tenant?.nombre || ''}</span>
                  {tenant?.slogan && <span className="text-xs text-gray-400 italic whitespace-nowrap">{tenant.slogan}</span>}
                </div>
                <span className="text-gray-600 text-sm block">Acceso para Socios</span>
              </div>
            </div>
          </div>
        </header>

        {/* Contenido */}
        <main className="max-w-md mx-auto px-4 py-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>

            <h1 className="text-2xl font-bold text-gray-800 mb-3">¡QR enviado!</h1>

            <p className="text-gray-600 mb-2">
              Enviamos tu código QR y acceso al portal a:
            </p>

            <div className="inline-flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-lg mb-6">
              <Mail className="w-5 h-5 text-gray-500" />
              <span className="font-medium text-gray-800">{emailEnviado}</span>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
              <h3 className="font-semibold text-blue-900 mb-2">¿Qué vas a recibir?</h3>
              <ul className="text-blue-800 text-sm space-y-1">
                <li>• Tu código QR personal para descuentos</li>
                <li>• Link de acceso a tu portal del socio</li>
                <li>• Instrucciones para guardar el acceso</li>
              </ul>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <p className="text-amber-800 text-sm">
                <strong>¿No llega el email?</strong> Revisá tu carpeta de spam o correo no deseado.
              </p>
            </div>

            <button
              onClick={() => {
                setEnviado(false)
                setBusqueda('')
              }}
              className="text-primary hover:underline font-medium"
            >
              Volver a intentar
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-md mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/"><TenantLogo className="h-14 w-auto" /></Link>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-primary font-bold text-lg whitespace-nowrap">{tenant?.nombre || ''}</span>
                {tenant?.slogan && <span className="text-xs text-gray-400 italic whitespace-nowrap">{tenant.slogan}</span>}
              </div>
              <span className="text-gray-600 text-sm block">Acceso para Socios</span>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="max-w-md mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-light rounded-full mb-4">
            <QrCode className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Obtené tu código QR</h1>
          <p className="text-gray-600">
            Ingresá tu número de socio o DNI y te enviaremos el QR a tu email registrado
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-2">
              Número de socio o DNI
            </label>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Ej: 12345 o 30123456"
              className="input-field w-full text-lg"
              disabled={buscando}
              autoFocus
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg p-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <Button type="submit" loading={buscando} className="w-full flex items-center justify-center">
            <Mail className="w-5 h-5 mr-2" />
            <span>Enviar QR a mi email</span>
          </Button>
        </form>

        <div className="mt-8 bg-gray-100 rounded-lg p-4">
          <h3 className="text-gray-800 font-semibold mb-2">¿Cómo funciona?</h3>
          <ol className="text-gray-600 text-sm space-y-2 list-decimal list-inside">
            <li>Ingresá tu número de socio o DNI</li>
            <li>Te enviamos el QR a tu email registrado</li>
            <li>Abrí el email y guardá el link en tu celular</li>
            <li>Mostrá el QR en comercios adheridos para descuentos</li>
          </ol>
        </div>

        {/* Link a comercios */}
        <div className="mt-6 text-center">
          <Link
            to="/comercios"
            className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
          >
            <Store className="w-5 h-5" />
            Ver comercios adheridos
          </Link>
        </div>

        {/* Link a recuperar acceso */}
        <div className="mt-4 pt-4 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-500 mb-2">¿Ya tenés acceso al portal?</p>
          <Link
            to="/login-socio"
            className="inline-flex items-center gap-2 text-primary hover:underline font-medium text-sm"
          >
            Recuperar acceso por email
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-md mx-auto px-4 py-6 text-center">
        <p className="text-gray-400 text-sm">
          Club Sportivo Pilar - El Rojo de la Avenida
        </p>
      </footer>
    </div>
  )
}
