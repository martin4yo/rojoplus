import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { useTenant } from '../../contexts/TenantContext'
import api from '../../services/api'

const INTERVAL_MS = 5000

export default function HeroSection() {
  const { tenant, loading } = useTenant()
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const [stats, setStats] = useState(null)

  useEffect(() => {
    api.getFull('/public/stats')
      .then(data => setStats(data))
      .catch(() => {})
  }, [])

  const images = tenant?.heroImages?.length
    ? tenant.heroImages
    : tenant?.heroImageUrl
      ? [tenant.heroImageUrl]
      : []

  const total = images.length

  const next = useCallback(() => setCurrent(i => (i + 1) % total), [total])
  const prev = useCallback(() => setCurrent(i => (i - 1 + total) % total), [total])

  // Auto-avance
  useEffect(() => {
    if (total <= 1 || paused) return
    const t = setInterval(next, INTERVAL_MS)
    return () => clearInterval(t)
  }, [total, paused, next])

  // Reiniciar índice si cambian las imágenes
  useEffect(() => { setCurrent(0) }, [total])

  return (
    <section
      className="relative min-h-[600px] md:min-h-[700px] flex items-center overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slides */}
      {images.length > 0 ? (
        images.map((url, i) => (
          <div
            key={url + i}
            className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700"
            style={{
              backgroundImage: `url(${url})`,
              opacity: !loading && i === current ? 1 : 0,
              zIndex: i === current ? 1 : 0,
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-transparent" />
          </div>
        ))
      ) : (
        <div className="absolute inset-0 bg-gradient-to-r from-gray-900 to-gray-700" />
      )}

      {/* Controles prev/next — solo si hay más de 1 imagen */}
      {total > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/30 hover:bg-black/60 text-white transition backdrop-blur-sm"
            aria-label="Anterior"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={next}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/30 hover:bg-black/60 text-white transition backdrop-blur-sm"
            aria-label="Siguiente"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Dots */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  i === current ? 'bg-white scale-125' : 'bg-white/40 hover:bg-white/70'
                }`}
                aria-label={`Ir a imagen ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="max-w-2xl">
          <p className="text-primary-400 font-semibold text-sm md:text-base uppercase tracking-wider mb-4 animate-fade-in">
            Bienvenidos
          </p>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
            <span className="text-primary">{tenant?.nombre || 'Bienvenidos'}</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-300 mb-8 leading-relaxed">
            {tenant?.descripcion || tenant?.slogan || ''}
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              to="/inscripcion-socio"
              className="inline-flex items-center justify-center px-8 py-4 bg-primary text-white rounded-xl text-lg font-semibold hover:bg-primary-dark transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            >
              Quiero ser Socio
              <ChevronRight className="w-5 h-5 ml-2" />
            </Link>

            <Link
              to="/actividades"
              className="inline-flex items-center justify-center px-8 py-4 bg-white/10 backdrop-blur-sm text-white border border-white/30 rounded-xl text-lg font-semibold hover:bg-white/20 transition-all"
            >
              Ver Actividades
            </Link>
          </div>

          {/* Stats */}
          {stats && (stats.aniosHistoria || stats.socios || stats.actividades) && (
            <div className="mt-12 grid grid-cols-3 gap-8">
              {stats.aniosHistoria && (
                <div>
                  <p className="text-3xl md:text-4xl font-bold text-white">{stats.aniosHistoria}</p>
                  <p className="text-gray-400 text-sm">Años de historia</p>
                </div>
              )}
              {stats.socios && (
                <div>
                  <p className="text-3xl md:text-4xl font-bold text-white">{stats.socios}</p>
                  <p className="text-gray-400 text-sm">Socios activos</p>
                </div>
              )}
              {stats.actividades && (
                <div>
                  <p className="text-3xl md:text-4xl font-bold text-white">{stats.actividades}</p>
                  <p className="text-gray-400 text-sm">Actividades</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
