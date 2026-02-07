import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Users, Clock } from 'lucide-react'
import api from '../../services/api'

// Imágenes por defecto para cada tipo de actividad (Unsplash - libre de derechos)
const defaultImages = {
  'FUTBOL': '/images/club/futbol.jpg',
  'FÚTBOL': '/images/club/futbol.jpg',
  'BASQUET': '/images/club/basquet.jpg',
  'BÁSQUET': '/images/club/basquet.jpg',
  'BASKETBALL': '/images/club/basquet.jpg',
  'VOLEY': '/images/club/voley.jpg',
  'VÓLEY': '/images/club/voley.jpg',
  'VOLLEYBALL': '/images/club/voley.jpg',
  'HOCKEY': '/images/club/hockey.jpg',
  'NATACION': '/images/club/natacion.jpg',
  'NATACIÓN': '/images/club/natacion.jpg',
  'GIMNASIA': '/images/club/gimnasia.jpg',
  'FITNESS': '/images/club/gimnasia.jpg',
  'GYM': '/images/club/gimnasia.jpg',
  'TENIS': '/images/club/tenis.jpg',
  'TENNIS': '/images/club/tenis.jpg',
  'PATIN': '/images/club/patin.jpg',
  'PATÍN': '/images/club/patin.jpg',
  'PATINAJE': '/images/club/patin.jpg',
  'TAEKWONDO': '/images/club/taekwondo.jpg',
  'KARATE': '/images/club/taekwondo.jpg',
  'ARTES_MARCIALES': '/images/club/taekwondo.jpg',
  'DEFAULT': '/images/club/68f64b9d.jpeg'
}

function getActivityImage(actividad) {
  if (actividad.imagen) return actividad.imagen
  const key = actividad.nombre?.toUpperCase().replace(/\s+/g, '_')
  return defaultImages[key] || defaultImages.DEFAULT
}

export default function ActividadesGrid({ limit = 6, showTitle = true, fullWidth = false }) {
  const [actividades, setActividades] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadActividades()
  }, [])

  async function loadActividades() {
    try {
      const data = await api.get('/public/actividades')
      setActividades((data || []).slice(0, limit))
    } catch (err) {
      console.error('Error cargando actividades:', err)
      // Datos de ejemplo si falla la API
      setActividades([
        { id: 1, nombre: 'Fútbol', descripcion: 'Escuela de fútbol para todas las edades', inscriptos: 120 },
        { id: 2, nombre: 'Básquet', descripcion: 'Básquet competitivo y recreativo', inscriptos: 45 },
        { id: 3, nombre: 'Voley', descripcion: 'Voley masculino y femenino', inscriptos: 38 },
        { id: 4, nombre: 'Hockey', descripcion: 'Hockey sobre césped', inscriptos: 52 },
        { id: 5, nombre: 'Natación', descripcion: 'Pileta climatizada todo el año', inscriptos: 85 },
        { id: 6, nombre: 'Gimnasia', descripcion: 'Clases de fitness y gimnasia', inscriptos: 67 },
      ])
    } finally {
      setLoading(false)
    }
  }

  const containerClass = fullWidth
    ? ""
    : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"

  const sectionClass = fullWidth
    ? ""
    : "py-16 md:py-24 bg-gray-300"

  if (loading) {
    return (
      <section className={sectionClass}>
        <div className={containerClass}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-gray-200 rounded-2xl overflow-hidden shadow-sm animate-pulse">
                <div className="h-48 bg-gray-200" />
                <div className="p-6">
                  <div className="h-6 bg-gray-200 rounded w-3/4 mb-3" />
                  <div className="h-4 bg-gray-200 rounded w-full mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className={sectionClass}>
      <div className={containerClass}>
        {showTitle && (
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Nuestras Actividades
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Ofrecemos una amplia variedad de actividades deportivas para toda la familia.
              Encontrá tu lugar en el club.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {actividades.map((actividad) => (
            <div
              key={actividad.id}
              className="group bg-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-default"
            >
              <div className="relative h-48 overflow-hidden">
                <img
                  src={getActivityImage(actividad)}
                  alt={actividad.nombre}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <h3 className="absolute bottom-4 left-4 text-xl font-bold text-white">
                  {actividad.nombre}
                </h3>
              </div>

              <div className="p-6">
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                  {actividad.descripcion || 'Actividad deportiva del club para todas las edades.'}
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    {actividad.inscriptos > 0 && (
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {actividad.inscriptos}
                      </span>
                    )}
                    {actividad.categorias?.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {actividad.categorias.length} categorías
                      </span>
                    )}
                  </div>

                  <span
                    title="En desarrollo"
                    className="text-red-600 font-medium text-sm flex items-center gap-1 cursor-help"
                  >
                    Ver más
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {showTitle && (
          <div className="text-center mt-10">
            <Link
              to="/actividades"
              className="inline-flex items-center px-6 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors"
            >
              Ver todas las actividades
              <ChevronRight className="w-5 h-5 ml-2" />
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}
