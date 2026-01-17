import { Link } from 'react-router-dom'
import { ShieldX } from 'lucide-react'

export default function TokenInvalido() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="text-center max-w-md">
        <ShieldX className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 mb-4">
          Acceso no autorizado
        </h1>
        <p className="text-gray-600 mb-6">
          El link que estas usando no es valido o el comercio fue desactivado.
        </p>
        <p className="text-gray-600 mb-8">
          Contacta al Club Sportivo Pilar para obtener un nuevo link de acceso.
        </p>
        <Link to="/" className="btn-primary inline-block">
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
