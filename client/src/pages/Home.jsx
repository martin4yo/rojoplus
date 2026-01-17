import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="text-center max-w-md">
        <img
          src="/images/logo.png"
          alt="Club Sportivo Pilar"
          className="h-24 mx-auto mb-6"
        />
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Rojo Plus
        </h1>
        <p className="text-gray-600 mb-2">
          Club Sportivo Pilar
        </p>
        <p className="text-primary font-medium mb-8">
          "El Rojo de la Avenida"
        </p>

        <p className="text-gray-600 mb-8">
          Programa de beneficios para socios e hinchas.
          <br />
          <span className="font-medium">Rojo Plus convierte la pasión en consumo.</span>
        </p>

        <div className="space-y-3">
          <Link
            to="/registro"
            className="btn-primary w-full block text-center"
          >
            Quiero adherir mi comercio
          </Link>
          <Link
            to="/admin/login"
            className="btn-text block"
          >
            Acceso administradores
          </Link>
        </div>
      </div>
    </div>
  )
}
