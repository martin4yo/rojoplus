import { useState, useEffect } from 'react'
import { Mail, ArrowUpRight } from 'lucide-react'
import BannerPublicitario from '../../components/public/BannerPublicitario'
import PublicHero from '../../components/public/PublicHero'
import api from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'

const ESTADO_VACIO = {
  periodoComision: '',
  COMISION_DIRECTIVA: [],
  VOCALES: [],
  REVISORES: [],
  SUBCOMISIONES: [],
}

export default function Autoridades() {
  const [autoridades, setAutoridades] = useState(ESTADO_VACIO)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAutoridades()
  }, [])

  const fetchAutoridades = async () => {
    try {
      const data = await api.get('/autoridades/public')
      if (data) {
        setAutoridades({
          periodoComision: data.periodoComision || '',
          COMISION_DIRECTIVA: data.COMISION_DIRECTIVA || [],
          VOCALES: data.VOCALES || [],
          REVISORES: data.REVISORES || [],
          SUBCOMISIONES: data.SUBCOMISIONES || [],
        })
      }
    } catch (error) {
      console.error('Error cargando autoridades:', error)
    } finally {
      setLoading(false)
    }
  }

  const sinDatos = !autoridades.COMISION_DIRECTIVA.length
    && !autoridades.VOCALES.length
    && !autoridades.REVISORES.length
    && !autoridades.SUBCOMISIONES.length

  const getIniciales = (nombre) => {
    return nombre.split(' ').map(n => n[0]).slice(0, 2).join('')
  }

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-app)' }}>
      <PublicHero
        eyebrow="El club"
        title="Autoridades."
        subtitle="Quienes lideran y trabajan por el crecimiento del club."
        compact
      />

      {/* Banner Header */}
      <BannerPublicitario tipo="HEADER" ubicacion="AUTORIDADES" />

      {sinDatos && (
        <section className="py-20 md:py-28">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] mb-4" style={{ color: 'var(--text-muted)' }}>
              Sin datos cargados
            </div>
            <h2 className="font-display-sport mb-4" style={{ fontSize: 'clamp(32px, 4vw, 56px)', lineHeight: 1, color: 'var(--color-text-primary, var(--text))' }}>
              Próximamente.
            </h2>
            <p style={{ color: 'var(--color-text-secondary, var(--text-dim))' }}>
              Estamos preparando la información de las autoridades del club.
            </p>
          </div>
        </section>
      )}

      {/* Comisión Directiva */}
      {autoridades.COMISION_DIRECTIVA.length > 0 && (
      <section className="py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              Comisión Directiva
            </h2>
            <p className="text-gray-600">{autoridades.periodoComision}</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {autoridades.COMISION_DIRECTIVA.map((miembro) => (
              <div
                key={miembro.id}
                className="bg-gray-200 rounded-2xl p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {miembro.foto ? (
                      <img src={miembro.foto} alt={miembro.nombre} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-pub-fg text-xl font-bold">
                        {getIniciales(miembro.nombre)}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <span className="text-primary text-sm font-semibold uppercase tracking-wide">
                      {miembro.cargo}
                    </span>
                    <h3 className="text-lg font-bold text-gray-900 mt-1">
                      {miembro.nombre}
                    </h3>
                    {miembro.nroSocio && (
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] mt-1" style={{ color: 'var(--text-muted)' }}>
                        Socio #{miembro.nroSocio}
                      </p>
                    )}
                    {miembro.desde && (
                      <p className="text-gray-500 text-sm">Desde {miembro.desde}</p>
                    )}

                    {miembro.email && (
                      <a
                        href={`mailto:${miembro.email}`}
                        className="inline-flex items-center gap-1 text-primary text-sm mt-2 hover:underline"
                      >
                        <Mail className="w-4 h-4" />
                        {miembro.email}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* Vocales y Revisores */}
      {(autoridades.VOCALES.length > 0 || autoridades.REVISORES.length > 0) && (
      <section className="py-12 bg-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Vocales */}
            <div className="bg-gray-200 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Vocales</h3>
              <div className="space-y-4">
                {autoridades.VOCALES.map((vocal) => (
                  <div key={vocal.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center overflow-hidden">
                        {vocal.foto ? (
                          <img src={vocal.foto} alt={vocal.nombre} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-primary font-semibold text-sm">
                            {getIniciales(vocal.nombre)}
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-gray-900 block">{vocal.nombre}</span>
                        {vocal.nroSocio && (
                          <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>
                            Socio #{vocal.nroSocio}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      vocal.tipo === 'TITULAR'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {vocal.tipo === 'TITULAR' ? 'Titular' : 'Suplente'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Revisores de Cuentas */}
            <div className="bg-gray-200 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Revisores de Cuentas</h3>
              <div className="space-y-4">
                {autoridades.REVISORES.map((revisor) => (
                  <div key={revisor.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center overflow-hidden">
                        {revisor.foto ? (
                          <img src={revisor.foto} alt={revisor.nombre} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-blue-600 font-semibold text-sm">
                            {getIniciales(revisor.nombre)}
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-gray-900 block">{revisor.nombre}</span>
                        {revisor.nroSocio && (
                          <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>
                            Socio #{revisor.nroSocio}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      revisor.tipo === 'TITULAR'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {revisor.tipo === 'TITULAR' ? 'Titular' : 'Suplente'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* Subcomisiones */}
      {autoridades.SUBCOMISIONES.length > 0 && (
      <section className="py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              Subcomisiones
            </h2>
            <p className="text-gray-600">Equipos de trabajo especializados</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {autoridades.SUBCOMISIONES.map((sub) => (
              <div
                key={sub.id}
                className="bg-gray-200 rounded-2xl p-6 border-l-4 border-primary hover:shadow-lg transition-shadow"
              >
                <h3 className="text-lg font-bold text-gray-900 mb-2">{sub.nombre}</h3>
                {sub.descripcion && (
                  <p className="text-gray-600 text-sm mb-4">{sub.descripcion}</p>
                )}
                {sub.responsable && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">Responsable:</span>
                    <span className="font-medium text-primary">{sub.responsable}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* Contacto */}
      <section className="relative py-20 md:py-28 overflow-hidden text-pub-fg" style={{ backgroundColor: 'var(--pub-hero-bg)' }}>
        <div className="absolute inset-0 bg-field-grid opacity-30" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display-sport text-pub-fg mb-6" style={{ fontSize: 'clamp(40px, 7vw, 110px)', lineHeight: 0.92 }}>
            ¿Querés ser<br /><span style={{ color: 'var(--color-primary)' }}>parte?</span>
          </h2>
          <p className="text-lg md:text-xl text-pub-fg-70 max-w-2xl mx-auto mb-10" style={{ fontWeight: 300 }}>
            Sumate como voluntario o acercanos tus propuestas. Nos encantaría escucharte.
          </p>
          <a href="/contacto" className="pub-cta group inline-flex">
            <span>Contactar al club</span>
            <ArrowUpRight className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </a>
        </div>
      </section>

      {/* Banner Footer */}
      <BannerPublicitario tipo="FOOTER" ubicacion="AUTORIDADES" />
    </div>
  )
}
