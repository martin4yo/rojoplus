import { useState, useEffect } from 'react'
import { Trophy, Users, Star, Home, Award, Medal } from 'lucide-react'
import BannerPublicitario from '../../components/public/BannerPublicitario'
import api from '../../services/api'

// Iconos disponibles para los hitos (se asignan cíclicamente)
const ICONOS_HITOS = [Star, Home, Trophy, Trophy, Award, Users, Medal, Star]

// Contenido por defecto (Sportivo Pilar — mientras no haya config en BD)
const DEFAULT_CONTENIDO = {
  intro: {
    titulo: 'Nuestra Historia',
    tituloSeccion: 'La Caldera',
    parrafos: [
      'El 4 de junio de 1932, un grupo de visionarios liderados por Adolfo Vicente fundó el Club Sportivo Pilar en la casona de los hermanos Jesús y Honorio Ojer, con el sueño de crear un espacio donde la comunidad pudiera practicar deportes y crecer juntos.',
      'Nuestra sede, conocida popularmente como "La Caldera" por el fervor que generan los partidos como local, se encuentra en el corazón del distrito sobre la Av. Tomás Márquez. Este nombre nos define: pasión, entrega y comunidad.',
      'A lo largo de más de 90 años, miles de pilarenses han pasado por nuestras instalaciones, formándose no solo como deportistas sino como personas de bien. Somos referentes del básquet nacional y un espacio de inclusión para toda la familia.',
    ],
    imagen: '/images/club/68f64b9d.jpeg',
    badge: '+90',
    badgeTexto: 'años de historia',
  },
  hitos: [
    { anio: '1932', titulo: 'Fundación del Club', descripcion: 'El 4 de junio de 1932, un grupo de visionarios liderados por Adolfo Vicente fundó el Club Sportivo Pilar en la casona de los hermanos Jesús y Honorio Ojer.' },
    { anio: '1950', titulo: 'La Caldera', descripcion: 'Nuestra sede se ganó el apodo de "La Caldera" por el fervor y la pasión que generan los partidos como local. Un nombre que nos define.' },
    { anio: '1991', titulo: 'Campeón Provincial', descripcion: 'Sportivo Pilar se consagra campeón del Provincial de Clubes de Buenos Aires, consolidándose como potencia del básquet bonaerense.' },
    { anio: '2002', titulo: 'Bicampeón Provincial', descripcion: 'El club vuelve a conquistar el Provincial de Clubes en la temporada 2001/02, reafirmando su dominio en la provincia.' },
    { anio: '2023', titulo: 'Liga Federal', descripcion: 'Debut en la Liga Federal de Básquet, tercera categoría del básquet nacional con más de 110 equipos de todo el país.' },
    { anio: 'Hoy', titulo: '+90 Años de Gloria', descripcion: 'Más de 1000 socios, formativas tricampeonas y presencia en la Liga Federal. La Caldera sigue escribiendo historia.' },
  ],
  palmares: [
    { titulo: 'Provincial de Clubes', anios: '1991, 2001/02' },
    { titulo: 'Tricampeón Cat. 2012', anios: '2023, 2024, 2025' },
    { titulo: 'Mendoza Cup', anios: '2024' },
    { titulo: 'Liga Federal', anios: '2023-2026' },
  ],
  formativas: [
    { categoria: 'Cat. 2012', descripcion: 'Tricampeón + Mendoza Cup' },
    { categoria: 'Cat. 2014', descripcion: 'Campeón Divisional' },
    { categoria: 'Cat. 2017', descripcion: 'Campeón Divisional' },
    { categoria: 'Femenino',  descripcion: 'Campeón 2025' },
  ],
  valores: [
    { titulo: 'Trabajo en Equipo', descripcion: 'Juntos somos más fuertes. Cada logro es de todos.' },
    { titulo: 'Solidaridad',       descripcion: 'Nos apoyamos mutuamente, dentro y fuera de la cancha.' },
    { titulo: 'Compromiso',        descripcion: 'Con el club, con el deporte y con nuestra comunidad.' },
    { titulo: 'Pasión',            descripcion: 'La Caldera se enciende con el fervor de nuestra gente.' },
  ],
  cta: {
    titulo: 'Sumate a La Caldera',
    descripcion: 'Sé parte de la familia de Sportivo Pilar y viví la pasión junto a nosotros.',
    textoBoton: 'Quiero ser Socio',
    linkBoton: '/inscripcion-socio',
  },
}

export default function Historia() {
  const [contenido, setContenido] = useState(DEFAULT_CONTENIDO)

  useEffect(() => {
    api.getFull('/public/pagina/historia')
      .then(res => {
        if (res?.data) {
          setContenido({
            intro:      { ...DEFAULT_CONTENIDO.intro,      ...(res.data.intro      || {}) },
            hitos:      res.data.hitos?.length      ? res.data.hitos      : DEFAULT_CONTENIDO.hitos,
            palmares:   res.data.palmares?.length   ? res.data.palmares   : DEFAULT_CONTENIDO.palmares,
            formativas: res.data.formativas?.length ? res.data.formativas : DEFAULT_CONTENIDO.formativas,
            valores:    res.data.valores?.length    ? res.data.valores    : DEFAULT_CONTENIDO.valores,
            cta:        { ...DEFAULT_CONTENIDO.cta, ...(res.data.cta || {}) },
          })
        }
      })
      .catch(() => {}) // silencioso: usa defaults
  }, [])

  const { intro, hitos, palmares, formativas, valores, cta } = contenido

  return (
    <div className="bg-gray-300 min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary to-primary-dark py-6 md:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            {intro.titulo || 'Nuestra Historia'}
          </h1>
          <p className="text-base text-primary-100 max-w-3xl mx-auto">
            Conocé la historia, los logros y los valores que nos definen
          </p>
        </div>
      </section>

      {/* Banner Header */}
      <BannerPublicitario tipo="HEADER" ubicacion="HISTORIA" />

      {/* Intro */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              {intro.tituloSeccion && (
                <h2 className="text-3xl font-bold text-gray-900 mb-6">{intro.tituloSeccion}</h2>
              )}
              <div className="space-y-4 text-gray-600 leading-relaxed">
                {intro.parrafos?.map((p, i) => p && <p key={i}>{p}</p>)}
              </div>
            </div>
            {intro.imagen && (
              <div className="relative">
                <img
                  src={intro.imagen}
                  alt={intro.tituloSeccion || 'Historia del Club'}
                  className="rounded-2xl shadow-xl"
                />
                {intro.badge && (
                  <div className="absolute -bottom-6 -left-6 bg-primary text-white rounded-xl p-6 shadow-lg">
                    <p className="text-4xl font-bold">{intro.badge}</p>
                    {intro.badgeTexto && <p className="text-primary-100">{intro.badgeTexto}</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Timeline */}
      {hitos.length > 0 && (
        <section className="py-16 md:py-24 bg-gray-400">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-16">Nuestra Trayectoria</h2>

            <div className="relative">
              <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-1 bg-primary-200 hidden md:block" />

              <div className="space-y-12">
                {hitos.map((hito, index) => {
                  const Icono = ICONOS_HITOS[index % ICONOS_HITOS.length]
                  const isLeft = index % 2 === 0

                  return (
                    <div key={index} className="relative">
                      <div className="absolute left-1/2 transform -translate-x-1/2 w-4 h-4 bg-primary rounded-full border-4 border-white shadow hidden md:block" />
                      <div className={`md:w-5/12 ${isLeft ? 'md:mr-auto md:pr-12' : 'md:ml-auto md:pl-12'}`}>
                        <div className="bg-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                              <Icono className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                              <span className="text-primary font-bold text-lg">{hito.anio}</span>
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
      )}

      {/* Logros Deportivos */}
      {(palmares.length > 0 || formativas.length > 0) && (
        <section className="py-16 md:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">Logros Deportivos</h2>
            <p className="text-gray-600 text-center max-w-2xl mx-auto mb-12">
              Nuestros logros más destacados a lo largo de la historia
            </p>

            {palmares.length > 0 && (
              <div className="grid md:grid-cols-4 gap-6 mb-16">
                {palmares.map((logro, i) => {
                  const Icono = [Trophy, Medal, Award, Star][i % 4]
                  return (
                    <div key={i} className="bg-gradient-to-br from-primary to-primary-dark rounded-2xl p-6 text-center text-white shadow-lg">
                      <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Icono className="w-8 h-8" />
                      </div>
                      <h3 className="text-lg font-bold mb-1">{logro.titulo}</h3>
                      <p className="text-primary-200 text-sm">{logro.anios}</p>
                    </div>
                  )
                })}
              </div>
            )}

            {formativas.length > 0 && (
              <div className="bg-gray-200 rounded-2xl p-8 shadow-sm">
                <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">Formativas de Oro</h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {formativas.map((f, i) => (
                    <div key={i} className="bg-white rounded-xl p-4 text-center">
                      <p className="text-primary font-bold text-lg">{f.categoria}</p>
                      <p className="text-gray-600 text-sm">{f.descripcion}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Valores */}
      {valores.length > 0 && (
        <section className="py-16 md:py-24 bg-gray-400">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">Nuestros Valores</h2>
            <p className="text-gray-600 text-center max-w-2xl mx-auto mb-12">
              Los principios que nos guían desde el primer día
            </p>
            <div className="grid md:grid-cols-4 gap-6">
              {valores.map((v, i) => (
                <div key={i} className="bg-gray-200 rounded-xl p-6 text-center hover:shadow-lg transition-shadow">
                  <h3 className="text-xl font-semibold text-primary mb-2">{v.titulo}</h3>
                  <p className="text-gray-600 text-sm">{v.descripcion}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Banner Footer */}
      <BannerPublicitario tipo="FOOTER" ubicacion="HISTORIA" />

      {/* CTA */}
      {cta.titulo && (
        <section className="py-16 bg-primary">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">{cta.titulo}</h2>
            {cta.descripcion && (
              <p className="text-primary-100 mb-8 max-w-2xl mx-auto">{cta.descripcion}</p>
            )}
            {cta.textoBoton && (
              <a
                href={cta.linkBoton || '/inscripcion-socio'}
                className="inline-flex items-center px-8 py-4 bg-white text-primary rounded-xl text-lg font-semibold hover:bg-gray-100 transition-colors shadow-lg"
              >
                {cta.textoBoton}
              </a>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
