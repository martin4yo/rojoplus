import { Target, Heart, Users, Shield, Star, Trophy, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
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
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-app)' }}>
      {/* Hero */}
      <section className="relative py-20 md:py-28 overflow-hidden" style={{ backgroundColor: 'var(--pub-hero-bg)' }}>
        <div className="absolute inset-0 bg-field-grid opacity-30" />
        <div className="absolute -right-32 -top-32 w-96 h-96 rounded-full opacity-25 blur-3xl" style={{ background: 'var(--color-primary)' }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="pub-eyebrow text-pub-fg-70 mb-6">El club</div>
          <h1 className="font-display-sport text-pub-fg" style={{ fontSize: 'clamp(48px, 8vw, 130px)', lineHeight: 0.92 }}>
            Misión<br /><span style={{ color: 'var(--color-primary)' }}>y valores.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg md:text-xl text-pub-fg-70 leading-snug" style={{ fontWeight: 300 }}>
            Los principios que guían cada paso del club.
          </p>
        </div>
      </section>

      {/* Misión */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-primary-100 text-primary-dark px-4 py-2 rounded-full text-sm font-semibold mb-6">
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
              <div className="absolute -bottom-6 -right-6 bg-primary text-pub-fg rounded-xl p-6 shadow-lg hidden md:block">
                <p className="text-3xl font-bold">+90</p>
                <p className="text-primary-100 text-sm">años formando deportistas</p>
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
                <p className="text-primary text-3xl font-bold mb-2">1000+</p>
                <p className="text-gray-600">Socios activos</p>
              </div>
              <div className="bg-gray-200 rounded-xl p-6">
                <p className="text-primary text-3xl font-bold mb-2">10+</p>
                <p className="text-gray-600">Disciplinas deportivas</p>
              </div>
              <div className="bg-gray-200 rounded-xl p-6">
                <p className="text-primary text-3xl font-bold mb-2">200+</p>
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
                  <div className="w-14 h-14 bg-primary-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary transition-colors">
                    <Icono className="w-7 h-7 text-primary group-hover:text-pub-fg transition-colors" />
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
      <section className="relative py-20 md:py-28 overflow-hidden text-pub-fg" style={{ backgroundColor: 'var(--pub-hero-bg)' }}>
        <div className="absolute inset-0 bg-field-grid opacity-30" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display-sport text-pub-fg mb-6" style={{ fontSize: 'clamp(40px, 7vw, 110px)', lineHeight: 0.92 }}>
            Compartí<br /><span style={{ color: 'var(--color-primary)' }}>nuestros valores.</span>
          </h2>
          <p className="text-lg md:text-xl text-pub-fg-70 max-w-2xl mx-auto mb-10" style={{ fontWeight: 300 }}>
            Sumate a la familia y viví la pasión del deporte junto a nosotros.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/inscripcion-socio" className="pub-cta group inline-flex">
              <span>Hacete socio</span>
              <ArrowUpRight className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </Link>
            <Link
              to="/historia"
              className="group inline-flex items-center justify-between gap-6 px-7 py-4 transition-all border border-pub-fg-30 hover:border-pub-fg text-pub-fg"
              style={{ borderRadius: 0, fontFamily: 'Geist Mono, monospace', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.2em' }}
            >
              <span>Nuestra historia</span>
              <ArrowUpRight className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
