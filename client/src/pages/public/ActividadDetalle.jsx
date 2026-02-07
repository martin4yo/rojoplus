import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Users, Clock, MapPin, Calendar, ChevronRight } from 'lucide-react'
import api from '../../services/api'
import BannerPublicitario from '../../components/public/BannerPublicitario'

const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const defaultImages = {
  'FUTBOL': '/images/club/futbol.jpg',
  'FÚTBOL': '/images/club/futbol.jpg',
  'BASQUET': '/images/club/basquet.jpg',
  'BÁSQUET': '/images/club/basquet.jpg',
  'VOLEY': '/images/club/voley.jpg',
  'VÓLEY': '/images/club/voley.jpg',
  'HOCKEY': '/images/club/hockey.jpg',
  'NATACION': '/images/club/natacion.jpg',
  'NATACIÓN': '/images/club/natacion.jpg',
  'GIMNASIA': '/images/club/gimnasia.jpg',
  'TENIS': '/images/club/tenis.jpg',
  'PATIN': '/images/club/patin.jpg',
  'PATÍN': '/images/club/patin.jpg',
  'TAEKWONDO': '/images/club/taekwondo.jpg',
  'DEFAULT': '/images/club/68f64b9d.jpeg'
}

function getActivityImage(actividad) {
  if (actividad?.imagen) return actividad.imagen
  const key = actividad?.nombre?.toUpperCase().replace(/\s+/g, '_')
  return defaultImages[key] || defaultImages.DEFAULT
}

export default function ActividadDetalle() {
  const { id } = useParams()
  const [actividad, setActividad] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    cargarActividad()
  }, [id])

  async function cargarActividad() {
    try {
      setLoading(true)
      const data = await api.get(`/public/actividades/${id}`)
      setActividad(data)
    } catch (err) {
      console.error('Error cargando actividad:', err)
      setError('No se pudo cargar la actividad')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-red-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error || !actividad) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center">
        <p className="text-gray-600 mb-4">{error || 'Actividad no encontrada'}</p>
        <Link to="/actividades" className="text-red-600 hover:underline flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Volver a actividades
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Hero con imagen */}
      <div className="relative h-64 md:h-80 lg:h-96">
        <img
          src={getActivityImage(actividad)}
          alt={actividad.nombre}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
          <div className="max-w-7xl mx-auto">
            <Link
              to="/actividades"
              className="inline-flex items-center text-white/80 hover:text-white mb-4 text-sm"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a actividades
            </Link>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white">
              {actividad.nombre}
            </h1>
            <div className="flex items-center gap-4 mt-3 text-white/90">
              <span className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                {actividad.inscriptos || 0} inscriptos
              </span>
              <span className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                {actividad.categorias?.length || 0} categorías
              </span>
            </div>
          </div>
        </div>
      </div>

      <BannerPublicitario tipo="HEADER" ubicacion="ACTIVIDADES" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contenido principal */}
          <div className="lg:col-span-2 space-y-8">
            {/* Descripción */}
            <section className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Sobre la actividad</h2>
              <p className="text-gray-600 leading-relaxed">
                {actividad.descripcion || `${actividad.nombre} es una de las actividades deportivas que ofrece nuestro club para todas las edades. Contamos con profesores capacitados y las mejores instalaciones para que puedas disfrutar y mejorar tu rendimiento.`}
              </p>
            </section>

            {/* Categorías */}
            <section className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Categorías disponibles</h2>
              {actividad.categorias?.length > 0 ? (
                <div className="space-y-4">
                  {actividad.categorias.map(cat => (
                    <div key={cat.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-gray-800">{cat.nombre}</h3>
                        <span className="text-sm text-gray-500 flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {cat._count?.inscripciones || 0} inscriptos
                        </span>
                      </div>

                      {cat.edadMinima || cat.edadMaxima ? (
                        <p className="text-sm text-gray-500 mb-3">
                          Edad: {cat.edadMinima || 0} - {cat.edadMaxima || '+'} años
                        </p>
                      ) : null}

                      {/* Horarios de la categoría */}
                      {cat.horarios?.length > 0 ? (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Horarios
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {cat.horarios.map((h, i) => (
                              <div key={i} className="text-sm text-gray-600 bg-gray-50 rounded px-3 py-2">
                                <span className="font-medium">{diasSemana[h.diaSemana]}</span>
                                <span className="mx-2">·</span>
                                <span>{h.horaInicio?.slice(0,5)} - {h.horaFin?.slice(0,5)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 italic">Horarios a confirmar</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No hay categorías disponibles en este momento.</p>
              )}
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* CTA Inscripción */}
            <div className="bg-red-600 rounded-xl p-6 text-white">
              <h3 className="text-lg font-bold mb-2">¿Querés sumarte?</h3>
              <p className="text-red-100 text-sm mb-4">
                Completá el formulario de inscripción y empezá a disfrutar de {actividad.nombre} en nuestro club.
              </p>
              <Link
                to="/inscripcion-socio"
                className="block w-full bg-white text-red-600 font-semibold py-3 px-4 rounded-lg text-center hover:bg-red-50 transition-colors"
              >
                Solicitar inscripción
              </Link>
            </div>

            {/* Info de contacto */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-bold text-gray-900 mb-4">Información</h3>
              <ul className="space-y-3 text-sm text-gray-600">
                <li className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <span>Las prácticas se realizan en las instalaciones del club</span>
                </li>
                <li className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <span>Profesores capacitados para todas las edades</span>
                </li>
                <li className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <span>Inscripciones abiertas todo el año</span>
                </li>
              </ul>
            </div>

            {/* Otras actividades */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-bold text-gray-900 mb-4">Otras actividades</h3>
              <Link
                to="/actividades"
                className="flex items-center justify-between text-red-600 hover:text-red-700 font-medium"
              >
                Ver todas las actividades
                <ChevronRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <BannerPublicitario tipo="FOOTER" ubicacion="ACTIVIDADES" />
    </div>
  )
}
