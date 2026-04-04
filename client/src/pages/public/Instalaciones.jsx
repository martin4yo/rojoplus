import { useState, useEffect } from 'react'
import { MapPin, Users, Clock, Zap, Home, CheckCircle } from 'lucide-react'
import BannerPublicitario from '../../components/public/BannerPublicitario'
import LoadingSpinner from '../../components/LoadingSpinner'
import { useTenant } from '../../contexts/TenantContext'
import api from '../../services/api'

export default function Instalaciones() {
  const { tenant } = useTenant()
  const [instalaciones, setInstalaciones] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getFull('/public/instalaciones')
      .then(res => setInstalaciones(res?.data || []))
      .catch(() => setInstalaciones([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="bg-gray-300 min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary to-primary-dark py-6 md:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            Nuestras Instalaciones
          </h1>
          <p className="text-base text-primary-100 max-w-2xl mx-auto">
            Conocé los espacios donde entrenamos, competimos y compartimos como familia
          </p>
        </div>
      </section>

      {/* Banner Header */}
      <BannerPublicitario tipo="HEADER" ubicacion="INSTALACIONES" />

      {/* Grid */}
      <section className="py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="flex justify-center py-20">
              <LoadingSpinner />
            </div>
          ) : instalaciones.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <Home className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg">No hay instalaciones publicadas aún.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {instalaciones.map((inst) => (
                <article
                  key={inst.id}
                  className="bg-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group"
                >
                  {/* Header de color */}
                  <div className="h-4 bg-gradient-to-r from-primary to-primary-dark" />

                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-xl font-bold text-gray-900 group-hover:text-primary transition-colors">
                        {inst.nombre}
                      </h3>
                      {inst.tipoEspacio?.nombre && (
                        <span className="text-xs bg-primary-100 text-primary-dark px-2 py-1 rounded-full font-medium flex-shrink-0 ml-2">
                          {inst.tipoEspacio.nombre}
                        </span>
                      )}
                    </div>

                    {inst.descripcion && (
                      <p className="text-gray-600 text-sm line-clamp-3 mb-4">
                        {inst.descripcion}
                      </p>
                    )}

                    <div className="space-y-2 text-sm text-gray-500">
                      {inst.capacidad && (
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-primary flex-shrink-0" />
                          <span>{inst.capacidad} personas</span>
                        </div>
                      )}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <Home className="w-4 h-4 text-primary" />
                          <span>{inst.cubierto ? 'Cubierto' : 'Al aire libre'}</span>
                        </div>
                        {inst.iluminacion && (
                          <div className="flex items-center gap-1.5">
                            <Zap className="w-4 h-4 text-primary" />
                            <span>Con iluminación</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Info alquiler */}
      <section className="py-12 bg-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gray-200 rounded-2xl p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Alquiler de Instalaciones
                </h2>
                <p className="text-gray-600 mb-6">
                  Nuestras instalaciones están disponibles para eventos, cumpleaños, torneos y
                  actividades especiales. Consultá disponibilidad y tarifas.
                </p>
                <div className="space-y-3">
                  {(tenant?.direccion || tenant?.ciudad) && (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-primary" />
                      </div>
                      <span className="text-gray-700">
                        {[tenant.direccion, tenant.ciudad].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}
                  {tenant?.horarios && (
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Clock className="w-5 h-5 text-primary" />
                      </div>
                      <span className="text-gray-700 text-sm whitespace-pre-line">{tenant.horarios}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="text-center md:text-right">
                <a
                  href="/contacto"
                  className="inline-flex items-center px-8 py-4 bg-primary text-white rounded-xl text-lg font-semibold hover:bg-primary-dark transition-colors shadow-lg"
                >
                  Consultar Disponibilidad
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Banner Footer */}
      <BannerPublicitario tipo="FOOTER" ubicacion="INSTALACIONES" />
    </div>
  )
}
