import { useState, useEffect } from 'react'
import { Mail } from 'lucide-react'
import BannerPublicitario from '../../components/public/BannerPublicitario'
import api from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'

// Datos de ejemplo (fallback si no hay datos en la BD)
const datosFallback = {
  periodoComision: 'Período 2024 - 2026',
  COMISION_DIRECTIVA: [
    { id: 1, cargo: 'Presidente', nombre: 'Carlos Alberto Fernández', desde: '2024', email: 'presidente@sportivopilar.com.ar' },
    { id: 2, cargo: 'Vicepresidente', nombre: 'María Elena Rodríguez', desde: '2024' },
    { id: 3, cargo: 'Secretario', nombre: 'Juan Pablo Martínez', desde: '2024', email: 'secretaria@sportivopilar.com.ar' },
    { id: 4, cargo: 'Prosecretario', nombre: 'Laura Beatriz González', desde: '2024' },
    { id: 5, cargo: 'Tesorero', nombre: 'Ricardo Antonio López', desde: '2024', email: 'tesoreria@sportivopilar.com.ar' },
    { id: 6, cargo: 'Protesorero', nombre: 'Andrea Soledad Pérez', desde: '2024' },
  ],
  VOCALES: [
    { id: 7, nombre: 'Martín Ignacio Silva', tipo: 'TITULAR' },
    { id: 8, nombre: 'Gabriela Fernanda Torres', tipo: 'TITULAR' },
    { id: 9, nombre: 'Diego Alejandro Ruiz', tipo: 'TITULAR' },
    { id: 10, nombre: 'Patricia Lorena Díaz', tipo: 'SUPLENTE' },
    { id: 11, nombre: 'Fernando Javier Castro', tipo: 'SUPLENTE' },
    { id: 12, nombre: 'Luciana Mabel Romero', tipo: 'SUPLENTE' },
  ],
  REVISORES: [
    { id: 13, nombre: 'Eduardo César Morales', tipo: 'TITULAR' },
    { id: 14, nombre: 'Claudia Verónica Sánchez', tipo: 'TITULAR' },
    { id: 15, nombre: 'Roberto Daniel Acosta', tipo: 'SUPLENTE' },
  ],
  SUBCOMISIONES: [
    { id: 16, nombre: 'Subcomisión de Básquet', responsable: 'Martín Ignacio Silva', descripcion: 'Coordinación de todas las actividades de básquet: Liga Federal, formativas y recreativo.' },
    { id: 17, nombre: 'Subcomisión de Deportes', responsable: 'Gabriela Fernanda Torres', descripcion: 'Gestión de las demás actividades deportivas: fútbol, gimnasia, natación, etc.' },
    { id: 18, nombre: 'Subcomisión de Eventos', responsable: 'Patricia Lorena Díaz', descripcion: 'Organización de eventos sociales, fiestas y actividades para socios.' },
    { id: 19, nombre: 'Subcomisión de Infraestructura', responsable: 'Fernando Javier Castro', descripcion: 'Mantenimiento y mejoras de las instalaciones del club.' },
  ],
}

export default function Autoridades() {
  const [autoridades, setAutoridades] = useState(datosFallback)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAutoridades()
  }, [])

  const fetchAutoridades = async () => {
    try {
      const data = await api.get('/autoridades/public')
      // Si hay datos en alguna sección, usar los de la BD
      if (data && (data.COMISION_DIRECTIVA?.length > 0 || data.VOCALES?.length > 0)) {
        setAutoridades({
          ...data,
          periodoComision: data.periodoComision || datosFallback.periodoComision
        })
      }
    } catch (error) {
      console.error('Error cargando autoridades:', error)
      // Usar fallback
    } finally {
      setLoading(false)
    }
  }

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
      {/* Hero */}
      <section className="relative py-20 md:py-28 overflow-hidden" style={{ backgroundColor: 'var(--pub-hero-bg)' }}>
        <div className="absolute inset-0 bg-field-grid opacity-30" />
        <div className="absolute -right-32 -top-32 w-96 h-96 rounded-full opacity-25 blur-3xl" style={{ background: 'var(--color-primary)' }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="pub-eyebrow text-pub-fg-70 mb-6">El club</div>
          <h1 className="font-display-sport text-pub-fg" style={{ fontSize: 'clamp(48px, 8vw, 130px)', lineHeight: 0.92 }}>
            Autoridades.
          </h1>
          <p className="mt-6 max-w-2xl text-lg md:text-xl text-pub-fg-70 leading-snug" style={{ fontWeight: 300 }}>
            Quienes lideran y trabajan por el crecimiento del club.
          </p>
        </div>
      </section>

      {/* Banner Header */}
      <BannerPublicitario tipo="HEADER" ubicacion="AUTORIDADES" />

      {/* Comisión Directiva */}
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

      {/* Vocales y Revisores */}
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
                      <span className="text-gray-900">{vocal.nombre}</span>
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
                      <span className="text-gray-900">{revisor.nombre}</span>
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

      {/* Subcomisiones */}
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
