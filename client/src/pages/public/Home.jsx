import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Phone, Mail, ChevronRight, Users, Trophy, Heart, Calendar } from 'lucide-react'
import HeroSection from '../../components/public/HeroSection'
import ActividadesGrid from '../../components/public/ActividadesGrid'
import SponsorsSection from '../../components/public/SponsorsSection'
import BannerPublicitario from '../../components/public/BannerPublicitario'
import api from '../../services/api'

export default function Home() {
  const [noticias, setNoticias] = useState([])
  const [loadingNoticias, setLoadingNoticias] = useState(true)

  useEffect(() => {
    fetchNoticias()
  }, [])

  const fetchNoticias = async () => {
    try {
      // Primero buscar destacadas
      const destacadasRes = await api.getFull('/public/noticias?destacada=true&limit=10')
      let noticiasFinales = destacadasRes?.noticias || []

      // Si hay menos de 3 destacadas, completar con las últimas
      if (noticiasFinales.length < 3) {
        const ultimasRes = await api.getFull('/public/noticias?limit=10')
        const ultimas = ultimasRes?.noticias || []

        // Agregar las últimas que no estén ya en destacadas
        const idsDestacadas = new Set(noticiasFinales.map(n => n.id))
        for (const noticia of ultimas) {
          if (!idsDestacadas.has(noticia.id) && noticiasFinales.length < 3) {
            noticiasFinales.push(noticia)
          }
        }
      }

      setNoticias(noticiasFinales.slice(0, 6)) // Máximo 6 para el grid
    } catch (err) {
      console.error('Error cargando noticias:', err)
      setNoticias([])
    } finally {
      setLoadingNoticias(false)
    }
  }

  const formatFecha = (fecha) => {
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  return (
    <div>
      {/* Hero del Club */}
      <HeroSection />

      {/* Banner HERO - Publicidad principal grande */}
      <BannerPublicitario tipo="HERO" ubicacion="HOME" />

      {/* Banner HEADER - Debajo del hero */}
      <BannerPublicitario tipo="HEADER" ubicacion="HOME" />

      {/* Actividades */}
      <ActividadesGrid limit={6} showTitle={true} />

      {/* Banner MEDIO - Entre secciones */}
      <BannerPublicitario tipo="MEDIO" ubicacion="HOME" />

      {/* CTA Section - Hacete Socio */}
      <section className="py-16 md:py-24 bg-red-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                ¿Todavía no sos socio?
              </h2>
              <p className="text-red-100 text-lg mb-8 leading-relaxed">
                Sumate a la familia de Sportivo Pilar y disfrutá de todos los beneficios:
                actividades deportivas, instalaciones, eventos y mucho más.
              </p>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gray-200/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Trophy className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Actividades</p>
                    <p className="text-red-200 text-sm">+10 deportes</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gray-200/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Comunidad</p>
                    <p className="text-red-200 text-sm">+1000 socios</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gray-200/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Heart className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Beneficios</p>
                    <p className="text-red-200 text-sm">Descuentos exclusivos</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gray-200/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Eventos</p>
                    <p className="text-red-200 text-sm">Todo el año</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to="/inscripcion-socio"
                  className="inline-flex items-center justify-center px-8 py-4 bg-gray-200 text-red-600 rounded-xl text-lg font-semibold hover:bg-gray-100 transition-colors shadow-lg"
                >
                  Quiero ser Socio
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Link>
                <Link
                  to="/mi-qr"
                  className="inline-flex items-center justify-center px-8 py-4 bg-red-700 text-white border border-red-500 rounded-xl text-lg font-semibold hover:bg-red-800 transition-colors"
                >
                  Ya soy Socio
                </Link>
              </div>
            </div>

            <div className="hidden md:block">
              <img
                src="/images/club/68f64b9d.jpeg"
                alt="Socios del club"
                className="rounded-2xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Contacto Section */}
      <section className="py-16 md:py-24 bg-gray-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Visitanos
            </h2>
            <p className="text-lg text-gray-600">
              Te esperamos en nuestras instalaciones
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Teléfono */}
            <div className="bg-gray-200 rounded-2xl p-8 text-center hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Phone className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Llamanos</h3>
              <a
                href="tel:02304420297"
                className="text-red-600 font-medium text-lg hover:underline"
              >
                0230 442-0297
              </a>
              <p className="text-gray-500 text-sm mt-2">Lunes a Viernes de 9 a 20hs</p>
            </div>

            {/* Dirección */}
            <div className="bg-gray-200 rounded-2xl p-8 text-center hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <MapPin className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Donde Estamos</h3>
              <p className="text-gray-700">
                Av. Tomás Márquez 1125
              </p>
              <p className="text-gray-500 text-sm mt-2">Pilar, Buenos Aires</p>
            </div>

            {/* Email */}
            <div className="bg-gray-200 rounded-2xl p-8 text-center hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Mail className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Escribinos</h3>
              <a
                href="mailto:info@sportivopilar.com.ar"
                className="text-red-600 font-medium hover:underline"
              >
                info@sportivopilar.com.ar
              </a>
              <p className="text-gray-500 text-sm mt-2">Respondemos en 24hs</p>
            </div>
          </div>

          {/* Mapa */}
          <div className="mt-12 rounded-2xl overflow-hidden shadow-lg">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3289.6!2d-58.9167!3d-34.4583!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzTCsDI3JzMwLjAiUyA1OMKwNTUnMDAuMCJX!5e0!3m2!1ses!2sar!4v1234567890"
              width="100%"
              height="400"
              style={{ border: 0 }}
              allowFullScreen=""
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Ubicación del Club"
              className="w-full"
            />
          </div>
        </div>
      </section>

      {/* Sponsors/Auspiciantes */}
      <SponsorsSection />

      {/* Últimas Noticias */}
      <section className="py-16 md:py-24 bg-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Últimas Noticias
            </h2>
            <p className="text-lg text-gray-600">
              Enterate de las novedades del club
            </p>
          </div>

          {loadingNoticias ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
            </div>
          ) : noticias.length === 0 ? (
            <div className="grid md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-gray-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="h-48 bg-gray-300 flex items-center justify-center">
                    <span className="text-gray-400 text-sm">Próximamente</span>
                  </div>
                  <div className="p-6">
                    <p className="text-gray-400 text-sm mb-2">Noticia {i}</p>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Novedades del club
                    </h3>
                    <p className="text-gray-500 text-sm">
                      Pronto podrás ver aquí las últimas novedades.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {noticias.map((noticia) => (
                <article
                  key={noticia.id}
                  className="bg-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group"
                >
                  <div className="h-48 bg-gray-300 relative overflow-hidden">
                    {noticia.imagen ? (
                      <img
                        src={noticia.imagen}
                        alt={noticia.titulo}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-500 to-red-600">
                        <span className="text-white text-4xl font-bold opacity-30">SP</span>
                      </div>
                    )}
                    {noticia.destacada && (
                      <span className="absolute top-3 right-3 px-2 py-1 bg-yellow-400 text-yellow-900 text-xs font-semibold rounded-full">
                        Destacada
                      </span>
                    )}
                    <span className="absolute top-3 left-3 px-3 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                      {noticia.categoria}
                    </span>
                  </div>

                  <div className="p-6">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-3">
                      <Calendar className="w-4 h-4" />
                      {formatFecha(noticia.fechaPublicacion)}
                    </div>

                    <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-red-600 transition-colors">
                      {noticia.titulo}
                    </h3>

                    <p className="text-gray-500 text-sm line-clamp-3 mb-4">
                      {noticia.extracto}
                    </p>

                    <Link
                      to={`/noticias/${noticia.slug}`}
                      className="inline-flex items-center text-red-600 font-medium text-sm hover:text-red-700"
                    >
                      Leer más
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="text-center mt-10">
            <Link
              to="/noticias"
              className="inline-flex items-center px-6 py-3 bg-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
            >
              Ver todas las noticias
              <ChevronRight className="w-5 h-5 ml-2" />
            </Link>
          </div>
        </div>
      </section>

      {/* Banner FOOTER - Al final de la página */}
      <BannerPublicitario tipo="FOOTER" ubicacion="HOME" />
    </div>
  )
}
