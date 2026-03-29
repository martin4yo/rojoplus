import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useTenant } from '../../contexts/TenantContext'

export default function HeroSection() {
  const { tenant, loading } = useTenant()

  return (
    <section className="relative min-h-[600px] md:min-h-[700px] flex items-center">
      {/* Background Image - Fixed parallax effect */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat bg-fixed transition-opacity duration-300"
        style={{
          backgroundImage: tenant?.heroImageUrl ? `url(${tenant.heroImageUrl})` : undefined,
          opacity: loading ? 0 : 1,
        }}
      >
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
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
          <div className="mt-12 grid grid-cols-3 gap-8">
            <div>
              <p className="text-3xl md:text-4xl font-bold text-white">90+</p>
              <p className="text-gray-400 text-sm">Años de historia</p>
            </div>
            <div>
              <p className="text-3xl md:text-4xl font-bold text-white">1000+</p>
              <p className="text-gray-400 text-sm">Socios activos</p>
            </div>
            <div>
              <p className="text-3xl md:text-4xl font-bold text-white">10+</p>
              <p className="text-gray-400 text-sm">Actividades</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
