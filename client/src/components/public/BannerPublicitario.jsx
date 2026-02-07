import { useState, useEffect } from 'react'
import api from '../../services/api'

/**
 * Tamaños estándar de banners (basados en IAB standards)
 */
export const BANNER_SIZES = {
  HERO: { width: 1200, height: 400, label: 'Hero (1200×400)', ratio: '3:1' },
  HEADER: { width: 728, height: 90, label: 'Leaderboard (728×90)', ratio: '8:1' },
  MEDIO: { width: 728, height: 90, label: 'Leaderboard (728×90)', ratio: '8:1' },
  FOOTER: { width: 728, height: 90, label: 'Leaderboard (728×90)', ratio: '8:1' },
}

/**
 * Componente de Banner Publicitario
 * Muestra banners según posición y ubicación con tamaños fijos IAB
 */
export default function BannerPublicitario({ tipo = 'FOOTER', ubicacion, className = '' }) {
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
  const size = BANNER_SIZES[tipo] || BANNER_SIZES.FOOTER

  // Calcular padding-bottom como porcentaje para mantener aspect ratio
  const paddingPercent = (size.height / size.width) * 100

  // Estilos según tipo de banner
  const getWrapperClass = () => {
    switch (tipo) {
      case 'HERO':
        return 'w-full'
      case 'HEADER':
      case 'MEDIO':
      case 'FOOTER':
        return 'w-full flex justify-center py-4 px-4'
      default:
        return 'w-full flex justify-center py-4 px-4'
    }
  }

  const getMaxWidth = () => {
    if (tipo === 'HERO') return '100%'
    return `${size.width}px`
  }

  return (
    <div className={`${getWrapperClass()} ${className}`}>
      {/* Contenedor con aspect ratio fijo usando padding-bottom */}
      <div
        className="relative w-full overflow-hidden rounded bg-gray-200"
        style={{
          maxWidth: getMaxWidth(),
          paddingBottom: `${paddingPercent}%`
        }}
      >
        {/* Imagen posicionada absolutamente para llenar el contenedor */}
        <button
          onClick={() => handleClick(currentBanner)}
          className="absolute inset-0 w-full h-full cursor-pointer transition-opacity hover:opacity-90 focus:outline-none"
        >
          <img
            src={currentBanner.imagenDesktop}
            alt={currentBanner.textoAlt || currentBanner.titulo}
            className="absolute inset-0 w-full h-full object-contain"
          />
        </button>

        {/* Indicadores si hay múltiples banners */}
        {banners.length > 1 && (
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1.5 z-10">
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
          <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded z-10">
            {currentBanner.sponsor.nombre}
          </div>
        )}
      </div>
    </div>
  )
}

