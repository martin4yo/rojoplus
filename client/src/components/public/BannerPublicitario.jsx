import { useState, useEffect } from 'react'
import api from '../../services/api'

/**
 * Componente de Banner Publicitario
 * Muestra banners según posición y ubicación
 *
 * Props:
 * - tipo: HERO, HEADER, LATERAL_IZQUIERDO, LATERAL_DERECHO, MEDIO, FOOTER
 * - ubicacion: HOME, ACTIVIDADES, NOTICIAS, CONTACTO, HISTORIA, COMERCIOS, TODAS
 * - className: clases adicionales
 */
export default function BannerPublicitario({ tipo = 'LATERAL_DERECHO', ubicacion, className = '' }) {
  const [banners, setBanners] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBanners()
  }, [tipo, ubicacion])

  // Rotar banners cada 5 segundos si hay más de uno
  useEffect(() => {
    if (banners.length <= 1) return

    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % banners.length)
    }, 5000)

    return () => clearInterval(interval)
  }, [banners.length])

  const fetchBanners = async () => {
    try {
      const params = new URLSearchParams()
      if (tipo) params.append('tipo', tipo)
      if (ubicacion) params.append('ubicacion', ubicacion)

      const bannersData = await api.get(`/public/banners?${params.toString()}`)
      setBanners(bannersData || [])

      // Registrar impresiones
      ;(bannersData || []).forEach(banner => {
        api.post(`/public/banners/${banner.id}/impresion`).catch(() => {})
      })
    } catch (err) {
      console.error('Error cargando banners:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleClick = async (banner) => {
    try {
      await api.post(`/public/banners/${banner.id}/clic`)
    } catch (err) {
      // Ignorar errores de métricas
    }

    if (banner.linkDestino) {
      window.open(banner.linkDestino, '_blank', 'noopener,noreferrer')
    }
  }

  if (loading || banners.length === 0) {
    return null
  }

  const currentBanner = banners[currentIndex]

  // Estilos según posición/tipo
  const getContainerStyles = () => {
    switch (tipo) {
      case 'HERO':
        // Banner grande, ancho completo, aspect ratio 21:9 en desktop, 16:9 en mobile
        return 'w-full aspect-[16/9] md:aspect-[21/9] max-h-[500px]'
      case 'HEADER':
        // Banner horizontal debajo del hero
        return 'w-full max-w-5xl mx-auto aspect-[4/1] md:aspect-[6/1]'
      case 'LATERAL_IZQUIERDO':
      case 'LATERAL_DERECHO':
        // Banner vertical para sidebars
        return 'w-full max-w-[300px] aspect-[1/1] md:aspect-[3/4]'
      case 'MEDIO':
        // Banner horizontal entre secciones
        return 'w-full max-w-4xl mx-auto aspect-[4/1] md:aspect-[5/1]'
      case 'FOOTER':
        // Banner horizontal al pie
        return 'w-full max-w-4xl mx-auto aspect-[4/1] md:aspect-[6/1]'
      default:
        return 'w-full max-w-[300px]'
    }
  }

  // Estilos del contenedor exterior según tipo
  const getWrapperStyles = () => {
    switch (tipo) {
      case 'HERO':
        return 'relative overflow-hidden'
      case 'HEADER':
        return 'py-4 px-4'
      case 'LATERAL_IZQUIERDO':
      case 'LATERAL_DERECHO':
        return 'sticky top-4'
      case 'MEDIO':
        return 'py-8 px-4 bg-gray-100'
      case 'FOOTER':
        return 'py-6 px-4'
      default:
        return ''
    }
  }

  return (
    <div className={`${getWrapperStyles()} ${className}`}>
      <div className={`relative ${getContainerStyles()}`}>
        <button
          onClick={() => handleClick(currentBanner)}
          className="block w-full h-full cursor-pointer transition-transform hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-red-500 rounded-lg overflow-hidden"
        >
          <picture>
            {currentBanner.imagenMobile && (
              <source
                media="(max-width: 768px)"
                srcSet={currentBanner.imagenMobile}
              />
            )}
            <img
              src={currentBanner.imagenDesktop}
              alt={currentBanner.textoAlt || currentBanner.titulo}
              className="w-full h-full object-cover"
            />
          </picture>
        </button>

        {/* Indicadores si hay múltiples banners */}
        {banners.length > 1 && (
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1.5">
            {banners.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentIndex
                    ? 'bg-white w-4'
                    : 'bg-white/50 hover:bg-white/75'
                }`}
              />
            ))}
          </div>
        )}

        {/* Badge de sponsor */}
        {currentBanner.sponsor && (
          <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
            {currentBanner.sponsor.nombre}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Componente wrapper para mostrar banners laterales en un layout de página
 * Uso: envolver el contenido principal con este componente
 */
export function BannerLayout({ children, ubicacion, showLeft = true, showRight = true }) {
  return (
    <div className="flex gap-6 max-w-[1400px] mx-auto px-4">
      {/* Banner lateral izquierdo */}
      {showLeft && (
        <aside className="hidden lg:block w-[300px] flex-shrink-0">
          <BannerPublicitario tipo="LATERAL_IZQUIERDO" ubicacion={ubicacion} />
        </aside>
      )}

      {/* Contenido principal */}
      <main className="flex-1 min-w-0">
        {children}
      </main>

      {/* Banner lateral derecho */}
      {showRight && (
        <aside className="hidden lg:block w-[300px] flex-shrink-0">
          <BannerPublicitario tipo="LATERAL_DERECHO" ubicacion={ubicacion} />
        </aside>
      )}
    </div>
  )
}
