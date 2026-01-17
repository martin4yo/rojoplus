import { Link } from 'react-router-dom'
import { CheckCircle, Download } from 'lucide-react'

export default function RegistroExito() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="text-center max-w-md">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 mb-4">
          Solicitud enviada
        </h1>
        <p className="text-gray-600 mb-6">
          Tu solicitud sera revisada por el club.
          <br />
          Recibiras un email cuando sea aprobada.
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
