import { useState, useEffect } from 'react'
import api from '../../services/api'

/**
 * Sección de Sponsors para el Home
 * Muestra los logos de los auspiciantes del club
 */
export default function SponsorsSection() {
  const [sponsors, setSponsors] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSponsors()
  }, [])

  const fetchSponsors = async () => {
    try {
      const sponsorsData = await api.get('/public/sponsors')
      setSponsors(sponsorsData || [])
    } catch (err) {
      console.error('Error cargando sponsors:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading || sponsors.length === 0) {
    return null
  }

  return (
    <section className="py-12 bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-sm font-semibold text-gray-500 uppercase tracking-wider mb-8">
          Nos acompañan
        </h2>

        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
          {sponsors.map(sponsor => (
            <a
              key={sponsor.id}
              href={sponsor.sitioWeb || '#'}
              target={sponsor.sitioWeb ? '_blank' : '_self'}
              rel="noopener noreferrer"
              className="grayscale hover:grayscale-0 opacity-70 hover:opacity-100 transition-all duration-300"
              title={sponsor.nombre}
            >
              {sponsor.logo ? (
                <img
                  src={sponsor.logo}
                  alt={sponsor.nombre}
                  className="h-12 md:h-16 w-auto max-w-[150px] object-contain"
                />
              ) : (
                <span className="text-gray-600 font-medium text-lg">
                  {sponsor.nombre}
                </span>
              )}
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
