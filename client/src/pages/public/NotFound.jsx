import { Link } from 'react-router-dom'
import { Home, ArrowLeft, Search } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        {/* Logo */}
        <img
          src="/images/logo.png"
          alt="Club Sportivo Pilar"
          className="w-24 h-24 mx-auto mb-8 opacity-50"
        />

        {/* 404 */}
        <h1 className="text-8xl font-bold text-red-600 mb-4">404</h1>

        {/* Mensaje */}
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Página no encontrada
        </h2>
        <p className="text-gray-600 mb-8">
          Lo sentimos, la página que estás buscando no existe o fue movida.
        </p>

        {/* Acciones */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            <Home className="w-5 h-5" />
            Ir al inicio
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver atrás
          </button>
        </div>

        {/* Links útiles */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500 mb-4">O quizás buscabas:</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/actividades" className="text-red-600 hover:text-red-700 text-sm font-medium">
              Actividades
            </Link>
            <Link to="/noticias" className="text-red-600 hover:text-red-700 text-sm font-medium">
              Noticias
            </Link>
            <Link to="/comercios" className="text-red-600 hover:text-red-700 text-sm font-medium">
              Comercios
            </Link>
            <Link to="/contacto" className="text-red-600 hover:text-red-700 text-sm font-medium">
              Contacto
            </Link>
            <Link to="/mi-qr" className="text-red-600 hover:text-red-700 text-sm font-medium">
              Mi QR
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
