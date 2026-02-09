import { Target, Heart, Users, Shield, Star, Trophy } from 'lucide-react'
import BannerPublicitario from '../../components/public/BannerPublicitario'

const valores = [
  {
    icono: Heart,
    titulo: 'Pasión',
    descripcion: 'La Caldera se enciende con el fervor de nuestra gente. Cada partido, cada entrenamiento, cada momento en el club está cargado de pasión por lo que hacemos.',
  },
  {
    icono: Users,
    titulo: 'Trabajo en Equipo',
    descripcion: 'Juntos somos más fuertes. Creemos en el poder del grupo, donde cada integrante aporta su granito de arena para alcanzar objetivos comunes.',
  },
  {
    icono: Shield,
    titulo: 'Compromiso',
    descripcion: 'Con el club, con el deporte y con nuestra comunidad. Asumimos responsabilidades y las cumplimos con dedicación y esfuerzo.',
  },
  {
    icono: Star,
    titulo: 'Excelencia',
    descripcion: 'Buscamos la mejora continua en todo lo que hacemos. Desde las formativas hasta la primera, el objetivo siempre es crecer y superarnos.',
  },
  {
    icono: Trophy,
    titulo: 'Competitividad',
    descripcion: 'Nos preparamos para ganar, pero siempre con fair play. La victoria es más dulce cuando se logra con esfuerzo y respeto por el rival.',
  },
  {
    icono: Heart,
    titulo: 'Solidaridad',
    descripcion: 'Nos apoyamos mutuamente, dentro y fuera de la cancha. Somos una familia que se cuida y se ayuda en los buenos y malos momentos.',
  },
]

export default function Mision() {
  return (
    <div className="bg-gray-300 min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-red-600 to-red-700 py-6 md:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            Misión y Valores
          </h1>
          <p className="text-base text-red-100 max-w-3xl mx-auto">
            Los principios que guían cada paso de Club Sportivo Pilar desde 1932
          </p>
        </div>
      </section>

      {/* Misión */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-red-100 text-red-700 px-4 py-2 rounded-full text-sm font-semibold mb-6">
                <Target className="w-4 h-4" />
                Nuestra Misión
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                Formar deportistas y personas de bien
              </h2>
              <div className="space-y-4 text-gray-600 leading-relaxed">
                <p>
                  Club Sportivo Pilar tiene como misión fundamental <strong>promover la práctica deportiva
                  como herramienta de desarrollo integral</strong> de niños, jóvenes y adultos de nuestra comunidad.
                </p>
                <p>
                  Buscamos formar no solo grandes deportistas, sino también personas con valores sólidos
                  que puedan contribuir positivamente a la sociedad. El deporte es nuestro medio,
                  pero el crecimiento humano es nuestro verdadero objetivo.
                </p>
                <p>
                  A través de nuestras actividades deportivas y sociales, <strong>fomentamos la inclusión,
                  el compañerismo y el respeto</strong>, creando un espacio donde todos pueden desarrollar
                  su potencial y sentirse parte de algo más grande.
                </p>
              </div>
            </div>
            <div className="relative">
              <img
                src="/images/club/68f64b9d.jpeg"
                alt="Misión del Club"
                className="rounded-2xl shadow-xl"
              />
              <div className="absolute -bottom-6 -right-6 bg-red-600 text-white rounded-xl p-6 shadow-lg hidden md:block">
                <p className="text-3xl font-bold">+90</p>
                <p className="text-red-100 text-sm">años formando deportistas</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Visión */}
      <section className="py-16 md:py-24 bg-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-semibold mb-6">
              <Star className="w-4 h-4" />
              Nuestra Visión
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              Ser referentes del deporte y la comunidad
            </h2>
            <p className="text-gray-600 text-lg leading-relaxed mb-8">
              Aspiramos a consolidarnos como el <strong>club de referencia en Pilar y la zona norte</strong>,
              reconocido no solo por nuestros logros deportivos sino también por nuestro compromiso
              con la formación integral de las personas y el desarrollo de la comunidad.
            </p>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-gray-200 rounded-xl p-6">
                <p className="text-red-600 text-3xl font-bold mb-2">1000+</p>
                <p className="text-gray-600">Socios activos</p>
              </div>
              <div className="bg-gray-200 rounded-xl p-6">
                <p className="text-red-600 text-3xl font-bold mb-2">10+</p>
                <p className="text-gray-600">Disciplinas deportivas</p>
              </div>
              <div className="bg-gray-200 rounded-xl p-6">
                <p className="text-red-600 text-3xl font-bold mb-2">200+</p>
                <p className="text-gray-600">Deportistas formados por año</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Valores */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Nuestros Valores
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Los pilares que sostienen todo lo que hacemos y nos definen como institución
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {valores.map((valor, idx) => {
              const Icono = valor.icono
              return (
                <div
                  key={idx}
                  className="bg-gray-200 rounded-2xl p-6 hover:shadow-lg transition-shadow group"
                >
                  <div className="w-14 h-14 bg-red-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-red-600 transition-colors">
                    <Icono className="w-7 h-7 text-red-600 group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">
                    {valor.titulo}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {valor.descripcion}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Banner publicitario */}
      <BannerPublicitario tipo="FOOTER" ubicacion="MISION" />

      {/* CTA */}
      <section className="py-16 bg-red-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Compartí nuestros valores
          </h2>
          <p className="text-red-100 mb-8 max-w-2xl mx-auto">
            Sumate a la familia de Sportivo Pilar y viví la pasión del deporte junto a nosotros.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/inscripcion-socio"
              className="inline-flex items-center justify-center px-8 py-4 bg-white text-red-600 rounded-xl text-lg font-semibold hover:bg-gray-100 transition-colors shadow-lg"
            >
              Quiero ser Socio
            </a>
            <a
              href="/historia"
              className="inline-flex items-center justify-center px-8 py-4 bg-red-700 text-white border border-red-500 rounded-xl text-lg font-semibold hover:bg-red-800 transition-colors"
            >
              Conocer nuestra Historia
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
