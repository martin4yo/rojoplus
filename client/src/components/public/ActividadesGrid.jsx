import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Users, Clock, ArrowUpRight } from 'lucide-react'
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

  const sectionPadding = fullWidth ? "" : "py-20 md:py-28"
  const sectionStyle = fullWidth ? {} : { backgroundColor: 'var(--bg-app)' }

  if (loading) {
    return (
      <section className={sectionPadding} style={sectionStyle}>
        <div className={containerClass}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div
                key={i}
                className="overflow-hidden animate-pulse"
                style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
              >
                <div className="h-56" style={{ backgroundColor: 'var(--bg-surface-hi)' }} />
                <div className="p-6 space-y-3">
                  <div className="h-5 w-2/3" style={{ backgroundColor: 'var(--bg-surface-hi)' }} />
                  <div className="h-3 w-full" style={{ backgroundColor: 'var(--bg-surface-hi)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className={sectionPadding} style={sectionStyle}>
      <div className={containerClass}>
        {showTitle && (
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
            <div className="max-w-2xl">
              <div className="pub-eyebrow mb-5" style={{ color: 'var(--text-dim)' }}>
                Actividades
              </div>
              <h2
                className="font-display-sport mb-4"
                style={{ fontSize: 'clamp(40px, 6vw, 86px)', lineHeight: 0.94, color: 'var(--text)' }}
              >
                Encontrá tu<br />deporte.
              </h2>
              <p style={{ color: 'var(--text-dim)', fontWeight: 300 }}>
                Variedad de actividades para toda la familia. Sumate al equipo.
              </p>
            </div>
            <Link
              to="/actividades"
              className="group inline-flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.2em] self-start md:self-end"
              style={{ color: 'var(--text)' }}
            >
              <span>Ver todas</span>
              <ArrowUpRight className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px" style={{ backgroundColor: 'var(--border)' }}>
          {actividades.map((actividad, idx) => (
            <Link
              to={`/actividades/${actividad.id}`}
              key={actividad.id}
              className="group block overflow-hidden relative"
              style={{ backgroundColor: 'var(--bg-surface)' }}
            >
              <div className="relative h-72 overflow-hidden">
                <img
                  src={getActivityImage(actividad)}
                  alt={actividad.nombre}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                {/* Numero esquina */}
                <span
                  className="absolute top-4 left-4 font-mono text-[10px] uppercase tracking-[0.3em] text-white/80"
                >
                  {String(idx + 1).padStart(2, '0')} / {String(actividades.length).padStart(2, '0')}
                </span>
                {/* Título sobre la imagen */}
                <h3
                  className="absolute bottom-4 left-4 right-4 font-display-sport text-white"
                  style={{ fontSize: 'clamp(28px, 3vw, 44px)', lineHeight: 0.95 }}
                >
                  {actividad.nombre}
                </h3>
              </div>

              <div className="p-6">
                <p className="text-sm leading-relaxed line-clamp-2 mb-5" style={{ color: 'var(--text-dim)' }}>
                  {actividad.descripcion || 'Actividad deportiva del club para todas las edades.'}
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>
                    {actividad.inscriptos > 0 && (
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3 h-3" />
                        {actividad.inscriptos} inscriptos
                      </span>
                    )}
                    {actividad.categorias?.length > 0 && (
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        {actividad.categorias.length} cat.
                      </span>
                    )}
                  </div>

                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: 'var(--accent)' }}>
                    Ver
                    <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
