import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Search, QrCode, AlertCircle, Store } from 'lucide-react'
import { Button } from '../../components/Button'
import api from '../../services/api'

export default function AccesoSocio() {
  const navigate = useNavigate()
  const [busqueda, setBusqueda] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!busqueda.trim()) return

    setBuscando(true)
    setError(null)

    try {
      const data = await api.get(`/socio/buscar?q=${encodeURIComponent(busqueda.trim())}`)
      if (data?.tokenPortal) {
        // Redirigir al portal del socio
        navigate(`/s/${data.tokenPortal}`)
      } else {
        setError('No se encontró un socio con ese número o DNI')
      }
    } catch (err) {
      setError('No se encontró un socio con ese número o DNI')
    } finally {
      setBuscando(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-md mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/images/logo.png" alt="Logo" className="h-14" />
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-primary font-bold text-lg whitespace-nowrap">Rojo Plus</span>
                <span className="text-xs text-gray-400 italic whitespace-nowrap">Tu pasion tiene recompensas</span>
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
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Obtene tu codigo QR</h1>
          <p className="text-gray-600">
            Ingresa tu numero de socio o DNI para acceder a tu codigo QR personal
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-2">
              Numero de socio o DNI
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
            <Search className="w-5 h-5 mr-2" />
            <span>Ver mi QR</span>
          </Button>
        </form>

        <div className="mt-8 bg-gray-100 rounded-lg p-4">
          <h3 className="text-gray-800 font-semibold mb-2">Como funciona</h3>
          <ol className="text-gray-600 text-sm space-y-2 list-decimal list-inside">
            <li>Ingresa tu numero de socio o DNI</li>
            <li>Accede a tu QR personal</li>
            <li>Guarda el link o descarga el QR en tu celular</li>
            <li>Presenta el QR en comercios adheridos para obtener descuentos</li>
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
