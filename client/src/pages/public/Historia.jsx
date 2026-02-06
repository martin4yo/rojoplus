import { Calendar, Trophy, Users, Heart, MapPin, Star, Home, Award, Medal } from 'lucide-react'
import BannerPublicitario from '../../components/public/BannerPublicitario'

export default function Historia() {
  const hitos = [
    {
      anio: '1932',
      titulo: 'Fundación del Club',
      descripcion: 'El 4 de junio de 1932, un grupo de visionarios liderados por Adolfo Vicente fundó el Club Sportivo Pilar en la casona de los hermanos Jesús y Honorio Ojer.',
      icono: Star,
    },
    {
      anio: '1950',
      titulo: 'La Caldera',
      descripcion: 'Nuestra sede se ganó el apodo de "La Caldera" por el fervor y la pasión que generan los partidos como local. Un nombre que nos define.',
      icono: Home,
    },
    {
      anio: '1991',
      titulo: 'Campeón Provincial',
      descripcion: 'Sportivo Pilar se consagra campeón del Provincial de Clubes de Buenos Aires, consolidándose como potencia del básquet bonaerense.',
      icono: Trophy,
    },
    {
      anio: '2002',
      titulo: 'Bicampeón Provincial',
      descripcion: 'El club vuelve a conquistar el Provincial de Clubes en la temporada 2001/02, reafirmando su dominio en la provincia.',
      icono: Trophy,
    },
    {
      anio: '2023',
      titulo: 'Liga Federal',
      descripcion: 'Debut en la Liga Federal de Básquet, tercera categoría del básquet nacional con más de 110 equipos de todo el país.',
      icono: Award,
    },
    {
      anio: 'Hoy',
      titulo: '+90 Años de Gloria',
      descripcion: 'Más de 1000 socios, formativas tricampeonas y presencia en la Liga Federal. La Caldera sigue escribiendo historia.',
      icono: Users,
    },
  ]

  const palmares = [
    { titulo: 'Provincial de Clubes', anios: '1991, 2001/02', icono: Trophy },
    { titulo: 'Tricampeón Cat. 2012', anios: '2023, 2024, 2025', icono: Medal },
    { titulo: 'Mendoza Cup', anios: '2024', icono: Award },
    { titulo: 'Liga Federal', anios: '2023-2026', icono: Star },
  ]

  return (
    <div className="bg-gray-300">
      {/* Hero */}
      <section className="bg-gradient-to-br from-red-600 to-red-700 py-6 md:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            Nuestra Historia
          </h1>
          <p className="text-base text-red-100 max-w-3xl mx-auto">
            Desde 1932 formando deportistas y construyendo comunidad en Pilar
          </p>
        </div>
      </section>

      {/* Intro */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                La Caldera
              </h2>
              <div className="space-y-4 text-gray-600 leading-relaxed">
                <p>
                  El 4 de junio de 1932, un grupo de visionarios liderados por Adolfo Vicente
                  fundó el Club Sportivo Pilar en la casona de los hermanos Jesús y Honorio Ojer,
                  con el sueño de crear un espacio donde la comunidad pudiera practicar deportes
                  y crecer juntos.
                </p>
                <p>
                  Nuestra sede, conocida popularmente como "La Caldera" por el fervor que generan
                  los partidos como local, se encuentra en el corazón del distrito sobre la
                  Av. Tomás Márquez. Este nombre nos define: pasión, entrega y comunidad.
                </p>
                <p>
                  A lo largo de más de 90 años, miles de pilarenses han pasado por nuestras
                  instalaciones, formándose no solo como deportistas sino como personas
                  de bien. Somos referentes del básquet nacional y un espacio de inclusión
                  para toda la familia.
                </p>
              </div>
            </div>
            <div className="relative">
              <img
                src="/images/club/68f64b9d.jpeg"
                alt="Historia del Club"
                className="rounded-2xl shadow-xl"
              />
              <div className="absolute -bottom-6 -left-6 bg-red-600 text-white rounded-xl p-6 shadow-lg">
                <p className="text-4xl font-bold">+90</p>
                <p className="text-red-100">años de historia</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-16 md:py-24 bg-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-16">
            Nuestra Trayectoria
          </h2>

          <div className="relative">
            {/* Línea central */}
            <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-1 bg-red-200 hidden md:block" />

            <div className="space-y-12">
              {hitos.map((hito, index) => {
                const Icono = hito.icono
                const isLeft = index % 2 === 0

                return (
                  <div key={hito.anio} className="relative">
                    {/* Punto en la línea */}
                    <div className="absolute left-1/2 transform -translate-x-1/2 w-4 h-4 bg-red-600 rounded-full border-4 border-white shadow hidden md:block" />

                    <div className={`md:w-5/12 ${isLeft ? 'md:mr-auto md:pr-12' : 'md:ml-auto md:pl-12'}`}>
                      <div className="bg-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                            <Icono className="w-6 h-6 text-red-600" />
                          </div>
                          <div>
                            <span className="text-red-600 font-bold text-lg">{hito.anio}</span>
                            <h3 className="text-xl font-semibold text-gray-900">{hito.titulo}</h3>
                          </div>
                        </div>
                        <p className="text-gray-600">{hito.descripcion}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Palmarés */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">
            Palmarés
          </h2>
          <p className="text-gray-600 text-center max-w-2xl mx-auto mb-12">
            Nuestros logros deportivos más destacados
          </p>

          <div className="grid md:grid-cols-4 gap-6 mb-16">
            {palmares.map((logro) => {
              const Icono = logro.icono
              return (
                <div key={logro.titulo} className="bg-gradient-to-br from-red-600 to-red-700 rounded-2xl p-6 text-center text-white shadow-lg">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Icono className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold mb-1">{logro.titulo}</h3>
                  <p className="text-red-200 text-sm">{logro.anios}</p>
                </div>
              )
            })}
          </div>

          {/* Formativas destacadas */}
          <div className="bg-gray-200 rounded-2xl p-8 shadow-sm">
            <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
              Formativas de Oro
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-4 text-center">
                <p className="text-red-600 font-bold text-lg">Cat. 2012</p>
                <p className="text-gray-600 text-sm">Tricampeón + Mendoza Cup</p>
              </div>
              <div className="bg-white rounded-xl p-4 text-center">
                <p className="text-red-600 font-bold text-lg">Cat. 2014</p>
                <p className="text-gray-600 text-sm">Campeón Divisional</p>
              </div>
              <div className="bg-white rounded-xl p-4 text-center">
                <p className="text-red-600 font-bold text-lg">Cat. 2017</p>
                <p className="text-gray-600 text-sm">Campeón Divisional</p>
              </div>
              <div className="bg-white rounded-xl p-4 text-center">
                <p className="text-red-600 font-bold text-lg">Femenino</p>
                <p className="text-gray-600 text-sm">Campeón 2025</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Valores */}
      <section className="py-16 md:py-24 bg-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">
            Nuestros Valores
          </h2>
          <p className="text-gray-600 text-center max-w-2xl mx-auto mb-12">
            Los principios que nos guían desde el primer día
          </p>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              { titulo: 'Trabajo en Equipo', descripcion: 'Juntos somos más fuertes. Cada logro es de todos.' },
              { titulo: 'Solidaridad', descripcion: 'Nos apoyamos mutuamente, dentro y fuera de la cancha.' },
              { titulo: 'Compromiso', descripcion: 'Con el club, con el deporte y con nuestra comunidad.' },
              { titulo: 'Pasión', descripcion: 'La Caldera se enciende con el fervor de nuestra gente.' },
            ].map((valor) => (
              <div key={valor.titulo} className="bg-gray-200 rounded-xl p-6 text-center hover:shadow-lg transition-shadow">
                <h3 className="text-xl font-semibold text-red-600 mb-2">{valor.titulo}</h3>
                <p className="text-gray-600 text-sm">{valor.descripcion}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Banner publicitario */}
      <BannerPublicitario tipo="FOOTER" ubicacion="HISTORIA" />

      {/* CTA */}
      <section className="py-16 bg-red-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Sumate a La Caldera
          </h2>
          <p className="text-red-100 mb-8 max-w-2xl mx-auto">
            Sé parte de la familia de Sportivo Pilar y viví la pasión junto a nosotros.
          </p>
          <a
            href="/inscripcion-socio"
            className="inline-flex items-center px-8 py-4 bg-white text-red-600 rounded-xl text-lg font-semibold hover:bg-gray-100 transition-colors shadow-lg"
          >
            Quiero ser Socio
          </a>
        </div>
      </section>
    </div>
  )
}
