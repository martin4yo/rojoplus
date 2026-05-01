import { useState, useEffect } from 'react'
import { Trophy, Users, Star, Home, Award, Medal, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import BannerPublicitario from '../../components/public/BannerPublicitario'
import api from '../../services/api'

const ICONOS_HITOS = [Star, Home, Trophy, Trophy, Award, Users, Medal, Star]

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
    { anio: '1950', titulo: 'La Caldera', descripcion: 'Nuestra sede se ganó el apodo de "La Caldera" por el fervor y la pasión que generan los partidos como local.' },
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
    descripcion: 'Sé parte de la familia y viví la pasión junto a nosotros.',
    textoBoton: 'Hacete socio',
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
      .catch(() => {})
  }, [])

  const { intro, hitos, palmares, formativas, valores, cta } = contenido

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-app)' }}>
      {/* Hero */}
      <section className="relative py-20 md:py-28 overflow-hidden" style={{ backgroundColor: 'var(--pub-hero-bg)' }}>
        <div className="absolute inset-0 bg-field-grid opacity-30" />
        <div
          className="absolute -right-32 -top-32 w-96 h-96 rounded-full opacity-25 blur-3xl"
          style={{ background: 'var(--color-primary)' }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="pub-eyebrow text-pub-fg-70 mb-6">El club</div>
          <h1
            className="font-display-sport text-pub-fg"
            style={{ fontSize: 'clamp(48px, 8vw, 130px)', lineHeight: 0.92 }}
          >
            {intro.titulo || 'Nuestra historia'}.
          </h1>
          <p className="mt-6 max-w-2xl text-lg md:text-xl text-pub-fg-70 leading-snug" style={{ fontWeight: 300 }}>
            Conocé los logros y los valores que nos definen.
          </p>
        </div>
      </section>

      <BannerPublicitario tipo="HEADER" ubicacion="HISTORIA" />

      {/* Intro */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 order-2 lg:order-1">
              {intro.tituloSeccion && (
                <>
                  <div className="pub-eyebrow mb-5" style={{ color: 'var(--color-text-secondary, var(--text-dim))' }}>
                    Identidad
                  </div>
                  <h2
                    className="font-display-sport mb-8"
                    style={{ fontSize: 'clamp(36px, 5vw, 76px)', lineHeight: 0.94, color: 'var(--color-text-primary, var(--text))' }}
                  >
                    {intro.tituloSeccion}
                  </h2>
                </>
              )}
              <div className="space-y-5 leading-relaxed" style={{ color: 'var(--color-text-secondary, var(--text-dim))' }}>
                {intro.parrafos?.map((p, i) => p && <p key={i} className="text-base md:text-lg">{p}</p>)}
              </div>
            </div>
            {intro.imagen && (
              <div className="lg:col-span-5 order-1 lg:order-2 relative">
                <img
                  src={intro.imagen}
                  alt={intro.tituloSeccion || 'Historia del Club'}
                  className="w-full"
                  style={{ aspectRatio: '4/5', objectFit: 'cover' }}
                />
                {intro.badge && (
                  <div
                    className="absolute -bottom-6 -left-6 p-6 text-pub-fg"
                    style={{ background: 'var(--color-primary)' }}
                  >
                    <p className="font-display-sport" style={{ fontSize: 64, lineHeight: 1, color: 'var(--accent-fg, #fff)' }}>
                      {intro.badge}
                    </p>
                    {intro.badgeTexto && (
                      <p className="font-mono text-[10px] uppercase tracking-[0.25em] mt-1" style={{ color: 'var(--accent-fg, #fff)', opacity: 0.85 }}>
                        {intro.badgeTexto}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Timeline */}
      {hitos.length > 0 && (
        <section className="py-20 md:py-28" style={{ backgroundColor: 'var(--bg-surface-hi)' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-16">
              <div className="pub-eyebrow mb-5" style={{ color: 'var(--color-text-secondary, var(--text-dim))' }}>
                Trayectoria
              </div>
              <h2
                className="font-display-sport"
                style={{ fontSize: 'clamp(40px, 6vw, 86px)', lineHeight: 0.94, color: 'var(--color-text-primary, var(--text))' }}
              >
                Más de 90 años<br />en cancha.
              </h2>
            </div>

            <div className="space-y-px" style={{ backgroundColor: 'var(--border)' }}>
              {hitos.map((hito, index) => {
                const Icono = ICONOS_HITOS[index % ICONOS_HITOS.length]
                return (
                  <div
                    key={index}
                    className="grid md:grid-cols-12 gap-6 items-start p-8 transition-colors"
                    style={{ backgroundColor: 'var(--bg-surface)' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-app)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
                  >
                    <div className="md:col-span-2 flex items-center gap-4">
                      <span className="font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: 'var(--text-muted)' }}>
                        Hito {String(index + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <div className="md:col-span-3">
                      <p className="font-display-sport" style={{ fontSize: 'clamp(40px, 5vw, 72px)', lineHeight: 0.95, color: 'var(--accent)' }}>
                        {hito.anio}
                      </p>
                    </div>
                    <div className="md:col-span-7">
                      <div className="flex items-start gap-3 mb-3">
                        <Icono className="w-5 h-5 mt-1 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                        <h3 className="font-display-sport text-2xl md:text-3xl" style={{ color: 'var(--color-text-primary, var(--text))', lineHeight: 1.05 }}>
                          {hito.titulo}
                        </h3>
                      </div>
                      <p className="leading-relaxed" style={{ color: 'var(--color-text-secondary, var(--text-dim))' }}>
                        {hito.descripcion}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* Palmarés */}
      {palmares.length > 0 && (
        <section className="py-20 md:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-16">
              <div className="pub-eyebrow mb-5" style={{ color: 'var(--color-text-secondary, var(--text-dim))' }}>
                Vitrina
              </div>
              <h2
                className="font-display-sport"
                style={{ fontSize: 'clamp(40px, 6vw, 86px)', lineHeight: 0.94, color: 'var(--color-text-primary, var(--text))' }}
              >
                Palmarés.
              </h2>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px mb-16" style={{ backgroundColor: 'var(--border)' }}>
              {palmares.map((logro, i) => {
                const Icono = [Trophy, Medal, Award, Star][i % 4]
                return (
                  <div
                    key={i}
                    className="p-8"
                    style={{
                      backgroundColor: 'var(--pub-hero-bg)',
                      color: '#fff',
                    }}
                  >
                    <Icono className="w-6 h-6 mb-6" style={{ color: 'var(--color-primary)' }} />
                    <p className="font-display-sport text-pub-fg mb-2" style={{ fontSize: 26, lineHeight: 1.05 }}>
                      {logro.titulo}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-pub-fg-60">
                      {logro.anios}
                    </p>
                  </div>
                )
              })}
            </div>

            {formativas.length > 0 && (
              <div>
                <h3 className="font-display-sport mb-8" style={{ fontSize: 32, color: 'var(--color-text-primary, var(--text))' }}>
                  Formativas de Oro
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-px" style={{ backgroundColor: 'var(--border)' }}>
                  {formativas.map((f, i) => (
                    <div key={i} className="p-6" style={{ backgroundColor: 'var(--bg-surface)' }}>
                      <p
                        className="font-display-sport mb-1"
                        style={{ fontSize: 28, lineHeight: 1, color: 'var(--accent)' }}
                      >
                        {f.categoria}
                      </p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: 'var(--text-muted)' }}>
                        {f.descripcion}
                      </p>
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
        <section className="py-20 md:py-28" style={{ backgroundColor: 'var(--bg-surface-hi)' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-16 max-w-2xl">
              <div className="pub-eyebrow mb-5" style={{ color: 'var(--color-text-secondary, var(--text-dim))' }}>
                Lo que somos
              </div>
              <h2
                className="font-display-sport"
                style={{ fontSize: 'clamp(40px, 6vw, 86px)', lineHeight: 0.94, color: 'var(--color-text-primary, var(--text))' }}
              >
                Valores.
              </h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px" style={{ backgroundColor: 'var(--border)' }}>
              {valores.map((v, i) => (
                <div key={i} className="p-8" style={{ backgroundColor: 'var(--bg-surface)' }}>
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: 'var(--text-muted)' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="font-display-sport mt-4 mb-3" style={{ fontSize: 28, lineHeight: 1.05, color: 'var(--color-text-primary, var(--text))' }}>
                    {v.titulo}
                  </h3>
                  <p className="leading-relaxed" style={{ color: 'var(--color-text-secondary, var(--text-dim))' }}>
                    {v.descripcion}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <BannerPublicitario tipo="FOOTER" ubicacion="HISTORIA" />

      {/* CTA */}
      {cta.titulo && (
        <section className="relative py-20 md:py-28 overflow-hidden text-pub-fg" style={{ backgroundColor: 'var(--pub-hero-bg)' }}>
          <div className="absolute inset-0 bg-field-grid opacity-30" />
          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2
              className="font-display-sport text-pub-fg mb-6"
              style={{ fontSize: 'clamp(40px, 7vw, 110px)', lineHeight: 0.92 }}
            >
              {cta.titulo}
            </h2>
            {cta.descripcion && (
              <p className="text-lg md:text-xl text-pub-fg-70 max-w-2xl mx-auto mb-10" style={{ fontWeight: 300 }}>
                {cta.descripcion}
              </p>
            )}
            {cta.textoBoton && (
              <Link to={cta.linkBoton || '/inscripcion-socio'} className="pub-cta group inline-flex">
                <span>{cta.textoBoton}</span>
                <ArrowUpRight className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </Link>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
