import { Link } from 'react-router-dom'
import { CheckCircle, Clock, Download } from 'lucide-react'

export default function RegistroExito() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="text-center max-w-md">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 mb-4">
          Solicitud enviada con exito
        </h1>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-center gap-2 text-yellow-700 mb-2">
            <Clock className="w-5 h-5" />
            <span className="font-semibold">Pendiente de aprobacion</span>
          </div>
          <p className="text-yellow-700 text-sm">
            Tu solicitud sera revisada por la administracion del Club Sportivo Pilar.
            <br />
            <strong>Recibiras un email con tu link de acceso cuando sea aprobada.</strong>
          </p>
        </div>

        <p className="text-gray-600 mb-6">
          El proceso de aprobacion puede demorar hasta 48 horas habiles.
          <br />
          Revisá tu casilla de correo (incluyendo spam).
        </p>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <p className="text-gray-700 mb-4">
            Mientras tanto, podes descargar el flyer para mostrar en tu comercio:
          </p>
          <a
            href="/images/flyer-comercio-adherido.png"
            download
            className="btn-primary inline-flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Descargar flyer "Comercio Adherido"
          </a>
        </div>

        <Link to="/" className="btn-text">
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
