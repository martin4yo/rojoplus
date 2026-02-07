import { Link } from 'react-router-dom'
import { MapPin, Phone, Mail, Clock, Facebook, Instagram, MessageCircle } from 'lucide-react'

export default function PublicFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-gray-900 text-white">
      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Logo y Descripción */}
          <div className="lg:col-span-1">
            <Link to="/" className="flex items-center gap-3 mb-4">
              <img
                src="/images/club/pngwing.com.png"
                alt="Club Sportivo Pilar"
                className="h-14 w-auto"
              />
              <div>
                <h3 className="text-lg font-bold">Sportivo Pilar</h3>
                <p className="text-xs text-red-400 font-medium">El Rojo de la Avenida</p>
              </div>
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed">
              Desde 1932, "La Caldera" es el hogar de la pasión deportiva de Pilar.
              Más de 90 años formando deportistas y comunidad.
            </p>
          </div>

          {/* Links Rápidos */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">
              El Club
            </h4>
            <ul className="space-y-3">
              <li>
                <Link to="/historia" className="text-gray-300 hover:text-white text-sm transition-colors">
                  Historia
                </Link>
              </li>
              <li>
                <Link to="/mision" className="text-gray-300 hover:text-white text-sm transition-colors">
                  Misión y Valores
                </Link>
              </li>
              <li>
                <Link to="/autoridades" className="text-gray-300 hover:text-white text-sm transition-colors">
                  Autoridades
                </Link>
              </li>
              <li>
                <Link to="/instalaciones" className="text-gray-300 hover:text-white text-sm transition-colors">
                  Instalaciones
                </Link>
              </li>
              <li>
                <Link to="/actividades" className="text-gray-300 hover:text-white text-sm transition-colors">
                  Actividades
                </Link>
              </li>
              <li>
                <Link to="/noticias" className="text-gray-300 hover:text-white text-sm transition-colors">
                  Noticias
                </Link>
              </li>
              <li>
                <Link to="/contacto" className="text-gray-300 hover:text-white text-sm transition-colors font-medium">
                  Contacto
                </Link>
              </li>
            </ul>
          </div>

          {/* Contacto */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">
              Contacto
            </h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-gray-300 text-sm">
                  Av. Tomás Márquez 1125<br />
                  Pilar, Buenos Aires
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-red-500 flex-shrink-0" />
                <a href="tel:02304420297" className="text-gray-300 hover:text-white text-sm transition-colors">
                  0230 442-0297
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-red-500 flex-shrink-0" />
                <a href="mailto:info@sportivopilar.com.ar" className="text-gray-300 hover:text-white text-sm transition-colors">
                  info@sportivopilar.com.ar
                </a>
              </li>
              <li className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-gray-300 text-sm">
                  Lunes a Viernes: 9 a 20hs<br />
                  Sábados: 9 a 13hs
                </span>
              </li>
            </ul>
          </div>

          {/* Redes Sociales */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">
              Seguinos
            </h4>
            <div className="flex gap-3">
              <a
                href="https://www.facebook.com/sportivopilaroficial"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href="https://www.instagram.com/sportivopilaroficial"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-gradient-to-br hover:from-purple-600 hover:to-pink-500 transition-all"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href="https://wa.me/5491122606687?text=Hola!%20Quiero%20consultar%20sobre%20el%20club"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-green-600 transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
              </a>
            </div>

            <div className="mt-6">
              <Link
                to="/inscripcion-socio"
                className="inline-block px-6 py-3 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
              >
                Quiero ser Socio
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-500 text-sm text-center md:text-left">
              &copy; {currentYear} Club Sportivo Pilar. Todos los derechos reservados.
            </p>
            <div className="flex items-center gap-4">
              <Link to="/admin" className="text-gray-600 hover:text-gray-400 text-xs transition-colors">
                Gestión
              </Link>
              <p className="text-gray-600 text-xs">
                Desarrollado con <span className="text-red-500">♥</span> por{' '}
                <span className="text-gray-400">RojoPlus</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
