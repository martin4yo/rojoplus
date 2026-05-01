import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Phone, Mail, ChevronRight, Users, Trophy, Heart, Calendar, ArrowUpRight } from 'lucide-react'
import { useTenant } from '../../contexts/TenantContext'
import HeroSection from '../../components/public/HeroSection'
import ActividadesGrid from '../../components/public/ActividadesGrid'
import SponsorsSection from '../../components/public/SponsorsSection'
import BannerPublicitario from '../../components/public/BannerPublicitario'
import api from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function Home() {
  const { tenant } = useTenant()
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

      {/* CTA Section - Hacete Socio (athletic, dark, asimétrico) */}
      <section className="relative py-20 md:py-32 overflow-hidden bg-pub-hero text-pub-fg">
        <div className="absolute inset-0 bg-field-grid opacity-30" />
        <div
          className="absolute -right-32 -top-32 w-96 h-96 rounded-full opacity-30 blur-3xl"
          style={{ background: 'var(--color-primary)' }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7">
              <div className="pub-eyebrow text-pub-fg-70 mb-6">
                Membresía
              </div>
              <h2
                className="font-display-sport text-pub-fg mb-8"
                style={{ fontSize: 'clamp(48px, 7vw, 110px)', lineHeight: 0.92 }}
              >
                ¿Todavía no<br />sos <span style={{ color: 'var(--color-primary)' }}>socio?</span>
              </h2>
              <p className="text-lg md:text-xl text-pub-fg-70 leading-relaxed max-w-2xl mb-10" style={{ fontWeight: 300 }}>
                Sumate al club y disfrutá actividades deportivas, instalaciones, eventos y la comunidad entera.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link to="/inscripcion-socio" className="pub-cta group">
                  <span>Hacete socio</span>
                  <ArrowUpRight className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </Link>
                <Link
                  to="/mi-qr"
                  className="group inline-flex items-center justify-between gap-6 px-7 py-4 transition-all border border-pub-fg-30 hover:border-pub-fg text-pub-fg"
                  style={{
                    borderRadius: 0,
                    fontFamily: 'Geist Mono, monospace',
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.2em',
                  }}
                >
                  <span>Ya soy socio</span>
                  <ArrowUpRight className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5 grid grid-cols-2 gap-px bg-pub-fg-10">
              {[
                { icon: Trophy, label: 'Actividades', value: '+10 deportes' },
                { icon: Users, label: 'Comunidad', value: '+1.000 socios' },
                { icon: Heart, label: 'Beneficios', value: 'Descuentos' },
                { icon: Calendar, label: 'Eventos', value: 'Todo el año' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="bg-pub-hero p-6">
                  <Icon className="w-5 h-5 mb-4" style={{ color: 'var(--color-primary)' }} />
                  <p className="font-display-sport text-pub-fg mb-1" style={{ fontSize: 28, lineHeight: 1 }}>
                    {label}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-pub-fg-60">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Contacto Section */}
      <section className="py-20 md:py-28" style={{ backgroundColor: 'var(--bg-app)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12 max-w-2xl">
            <div className="pub-eyebrow mb-5" style={{ color: 'var(--color-text-secondary, var(--text-dim))' }}>
              Contacto
            </div>
            <h2
              className="font-display-sport mb-4"
              style={{ fontSize: 'clamp(40px, 6vw, 86px)', lineHeight: 0.94, color: 'var(--color-text-primary, var(--text))' }}
            >
              Visitanos.
            </h2>
            <p className="text-lg" style={{ color: 'var(--color-text-secondary, var(--text-dim))', fontWeight: 300 }}>
              Te esperamos en nuestras instalaciones.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-px bg-[var(--border)] mb-10">
            {tenant?.telefono && (
              <ContactCard
                icon={Phone}
                eyebrow="Llamanos"
                main={tenant.telefono}
                href={`tel:${tenant.telefono.replace(/\D/g,'')}`}
                detail={tenant?.horarios}
              />
            )}
            {tenant?.direccion && (
              <ContactCard
                icon={MapPin}
                eyebrow="Donde estamos"
                main={tenant.direccion}
                detail={[tenant.ciudad, tenant.provincia].filter(Boolean).join(', ')}
              />
            )}
            {tenant?.email && (
              <ContactCard
                icon={Mail}
                eyebrow="Escribinos"
                main={tenant.email}
                href={`mailto:${tenant.email}`}
                detail="Respondemos en 24hs"
              />
            )}
          </div>

          {/* Mapa */}
          <div style={{ border: '1px solid var(--border)' }}>
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3289.6!2d-58.9167!3d-34.4583!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzTCsDI3JzMwLjAiUyA1OMKwNTUnMDAuMCJX!5e0!3m2!1ses!2sar!4v1234567890"
              width="100%"
              height="400"
              style={{ border: 0, display: 'block', filter: 'grayscale(0.4)' }}
              allowFullScreen=""
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Ubicación del Club"
            />
          </div>
        </div>
      </section>

      {/* Sponsors/Auspiciantes */}
      <SponsorsSection />

      {/* Últimas Noticias */}
      <section className="py-20 md:py-28" style={{ backgroundColor: 'var(--bg-surface-hi)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
            <div>
              <div className="pub-eyebrow mb-5" style={{ color: 'var(--color-text-secondary, var(--text-dim))' }}>
                Novedades
              </div>
              <h2
                className="font-display-sport"
                style={{ fontSize: 'clamp(40px, 6vw, 86px)', lineHeight: 0.94, color: 'var(--color-text-primary, var(--text))' }}
              >
                Últimas noticias.
              </h2>
            </div>
            <Link
              to="/noticias"
              className="group inline-flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.2em] self-start md:self-end"
              style={{ color: 'var(--color-text-primary, var(--text))' }}
            >
              <span>Ver todas</span>
              <ArrowUpRight className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </Link>
          </div>

          {loadingNoticias ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : noticias.length === 0 ? (
            <div className="grid md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="pub-card overflow-hidden">
                  <div className="h-56 flex items-center justify-center" style={{ backgroundColor: 'var(--bg-app)' }}>
                    <span className="font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: 'var(--text-muted)' }}>
                      Próximamente
                    </span>
                  </div>
                  <div className="p-6">
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--text-muted)' }}>
                      Noticia {String(i).padStart(2, '0')}
                    </p>
                    <h3 className="font-display-sport text-xl mb-2" style={{ color: 'var(--color-text-primary, var(--text))' }}>
                      Novedades del club
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary, var(--text-dim))' }}>
                      Pronto podrás ver aquí las últimas novedades.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {noticias.map((noticia, idx) => (
                <Link
                  key={noticia.id}
                  to={`/noticias/${noticia.slug}`}
                  className="pub-card overflow-hidden block group"
                >
                  <div className="h-56 relative overflow-hidden" style={{ backgroundColor: 'var(--bg-app)' }}>
                    {noticia.imagen ? (
                      <img
                        src={noticia.imagen}
                        alt={noticia.titulo}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))' }}
                      >
                        <span className="font-display-sport text-pub-fg opacity-25" style={{ fontSize: 80 }}>
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                      </div>
                    )}
                    {noticia.destacada && (
                      <span
                        className="absolute top-3 right-3 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.25em]"
                        style={{ background: 'var(--color-primary)', color: 'var(--accent-fg, #fff)' }}
                      >
                        Destacada
                      </span>
                    )}
                    {noticia.categoria && (
                      <span
                        className="absolute top-3 left-3 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.25em] backdrop-blur-sm"
                        style={{ background: 'rgba(255,255,255,0.85)', color: 'var(--color-text-primary, var(--text))' }}
                      >
                        {noticia.categoria}
                      </span>
                    )}
                  </div>

                  <div className="p-6">
                    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--text-muted)' }}>
                      <Calendar className="w-3 h-3" />
                      {formatFecha(noticia.fechaPublicacion)}
                    </div>

                    <h3 className="font-display-sport mb-3 line-clamp-2 transition-colors" style={{ fontSize: 22, lineHeight: 1.05, color: 'var(--color-text-primary, var(--text))' }}>
                      {noticia.titulo}
                    </h3>

                    <p className="text-sm line-clamp-3 leading-relaxed" style={{ color: 'var(--color-text-secondary, var(--text-dim))' }}>
                      {noticia.extracto}
                    </p>

                    <div className="mt-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: 'var(--accent)' }}>
                      <span>Leer más</span>
                      <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Banner FOOTER - Al final de la página */}
      <BannerPublicitario tipo="FOOTER" ubicacion="HOME" />
    </div>
  )
}

function ContactCard({ icon: Icon, eyebrow, main, href, detail }) {
  const Wrapper = href ? 'a' : 'div'
  const wrapperProps = href ? { href } : {}
  return (
    <Wrapper
      {...wrapperProps}
      className="block p-8 transition-colors"
      style={{ backgroundColor: 'var(--bg-surface)' }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-surface-hi)' }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-surface)' }}
    >
      <div className="flex items-start gap-4">
        <div
          className="w-10 h-10 flex items-center justify-center flex-shrink-0"
          style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface-hi)' }}
        >
          <Icon className="w-5 h-5" style={{ color: 'var(--accent)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] mb-2" style={{ color: 'var(--text-muted)' }}>
            {eyebrow}
          </p>
          <p
            className="font-display-sport break-words leading-tight"
            style={{ fontSize: 20, color: 'var(--color-text-primary, var(--text))' }}
          >
            {main}
          </p>
          {detail && (
            <p className="text-sm mt-2 whitespace-pre-line" style={{ color: 'var(--color-text-secondary, var(--text-dim))' }}>
              {detail}
            </p>
          )}
        </div>
      </div>
    </Wrapper>
  )
}
