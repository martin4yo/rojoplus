import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, ChevronLeft, ArrowDown, ArrowUpRight } from 'lucide-react'
import { useTenant } from '../../contexts/TenantContext'
import api from '../../services/api'

const INTERVAL_MS = 6000

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

  useEffect(() => {
    if (total <= 1 || paused) return
    const t = setInterval(next, INTERVAL_MS)
    return () => clearInterval(t)
  }, [total, paused, next])

  useEffect(() => { setCurrent(0) }, [total])

  const year = new Date().getFullYear()
  const fundacion = tenant?.aniosHistoria || stats?.aniosHistoria
  const desdeAnio = fundacion ? year - fundacion : null

  return (
    <section
      className="relative min-h-[88vh] flex items-end overflow-hidden text-pub-fg"
      style={{ backgroundColor: 'var(--pub-hero-bg)' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slides */}
      {images.length > 0 ? (
        images.map((url, i) => (
          <div
            key={url + i}
            className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-1000 ease-out"
            style={{
              backgroundImage: `url(${url})`,
              opacity: !loading && i === current ? 1 : 0,
              transform: !loading && i === current ? 'scale(1)' : 'scale(1.06)',
              zIndex: i === current ? 1 : 0,
            }}
          />
        ))
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#0A0A0B] via-[#1F2024] to-[#0A0A0B]" />
      )}

      {/* Overlays para legibilidad */}
      <div className="absolute inset-0 z-[2] bg-gradient-to-t from-black via-black/70 to-black/30" />
      <div className="absolute inset-0 z-[2] bg-gradient-to-r from-black/85 via-black/50 to-transparent" />
      <div className="absolute inset-0 z-[2] bg-field-grid mix-blend-overlay opacity-40" />

      {/* Top bar técnico */}
      <div className="absolute top-0 left-0 right-0 z-20 px-4 sm:px-8 pt-24 md:pt-28 flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-pub-fg-70 flex items-center gap-3">
          <span className="inline-block w-8 h-px bg-white/40" />
          <span>Temporada {year}</span>
        </div>
        <div className="hidden md:flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-pub-fg-70">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: 'var(--color-primary)' }} />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: 'var(--color-primary)' }} />
          </span>
          Activo
        </div>
      </div>

      {/* Controles del carousel */}
      {total > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 p-3 text-pub-fg-70 hover:text-pub-fg transition border border-pub-fg-20 hover:border-pub-fg/60 backdrop-blur-sm"
            aria-label="Anterior"
            style={{ borderRadius: 0 }}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={next}
            className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 p-3 text-pub-fg-70 hover:text-pub-fg transition border border-pub-fg-20 hover:border-pub-fg/60 backdrop-blur-sm"
            aria-label="Siguiente"
            style={{ borderRadius: 0 }}
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Indicators tipo barras */}
          <div className="absolute bottom-6 right-6 z-20 hidden sm:flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className="h-1 transition-all duration-500"
                style={{
                  width: i === current ? 40 : 16,
                  backgroundColor: i === current ? 'var(--color-primary)' : 'rgba(255,255,255,0.3)',
                }}
                aria-label={`Imagen ${i + 1}`}
              />
            ))}
            <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.3em] text-pub-fg-60 self-center">
              {String(current + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
            </span>
          </div>
        </>
      )}

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 md:pb-24 pt-24 w-full">
        <div className="max-w-5xl">
          {/* Pre-headline */}
          <div className="flex items-center gap-3 mb-6 animate-fade-in-up">
            <span
              className="inline-block h-px"
              style={{ width: 48, backgroundColor: 'var(--color-primary)' }}
            />
            <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-pub-fg-80">
              {desdeAnio ? `Desde ${desdeAnio}` : 'Bienvenidos'}
              {tenant?.ciudad && <span className="text-pub-fg-40 ml-3">· {tenant.ciudad}</span>}
            </span>
          </div>

          {/* Headline gigante condensed */}
          <h1
            className="font-display-sport text-pub-fg animate-fade-in-up"
            style={{
              fontSize: 'clamp(56px, 11vw, 180px)',
              lineHeight: 0.88,
              animationDelay: '0.1s',
            }}
          >
            {tenant?.nombre || 'Tu Club'}
          </h1>

          {tenant?.slogan && (
            <p
              className="mt-6 max-w-2xl text-lg md:text-xl leading-snug text-pub-fg-90 animate-fade-in-up"
              style={{
                fontFamily: 'Geist, sans-serif',
                fontWeight: 300,
                letterSpacing: '-0.01em',
                animationDelay: '0.2s',
              }}
            >
              {tenant.slogan}
            </p>
          )}

          {/* CTAs */}
          <div className="mt-10 flex flex-col sm:flex-row gap-3 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <Link
              to="/inscripcion-socio"
              className="group inline-flex items-center justify-between gap-6 px-8 py-5 transition-all"
              style={{
                background: 'var(--color-primary)',
                color: 'var(--accent-fg, #ffffff)',
                borderRadius: 0,
              }}
            >
              <span className="font-mono uppercase tracking-[0.2em] text-[13px] font-semibold">
                Hacete socio
              </span>
              <ArrowUpRight className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </Link>

            <Link
              to="/actividades"
              className="group inline-flex items-center justify-between gap-6 px-8 py-5 transition-all border border-pub-fg-30 hover:border-pub-fg text-pub-fg"
              style={{ borderRadius: 0 }}
            >
              <span className="font-mono uppercase tracking-[0.2em] text-[13px] font-semibold">
                Ver actividades
              </span>
              <ArrowUpRight className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </Link>
          </div>

          {/* Stats — oversized, divididos por líneas finas */}
          {stats && (stats.aniosHistoria || stats.socios || stats.actividades) && (
            <div
              className="mt-16 grid grid-cols-3 gap-px max-w-3xl animate-fade-in-up"
              style={{ animationDelay: '0.4s' }}
            >
              {stats.aniosHistoria && (
                <StatBlock label="Años de historia" value={stats.aniosHistoria} />
              )}
              {stats.socios && (
                <StatBlock label="Socios activos" value={formatBigNumber(stats.socios)} />
              )}
              {stats.actividades && (
                <StatBlock label="Actividades" value={stats.actividades} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Scroll cue */}
      <div className="absolute bottom-6 left-6 sm:left-8 z-20 hidden md:flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-pub-fg-50">
        <ArrowDown className="w-3 h-3 animate-bounce" style={{ animationDuration: '2s' }} />
        Explorar
      </div>
    </section>
  )
}

function StatBlock({ label, value }) {
  return (
    <div className="border-l border-pub-fg-20 pl-4 sm:pl-6">
      <p
        className="font-display-sport text-pub-fg"
        style={{
          fontSize: 'clamp(40px, 5vw, 72px)',
          lineHeight: 0.95,
        }}
      >
        {value}
      </p>
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-pub-fg-60 mt-1">
        {label}
      </p>
    </div>
  )
}

function formatBigNumber(n) {
  if (typeof n !== 'number') return n
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`
  return String(n)
}
