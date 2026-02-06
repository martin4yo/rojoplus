import ComerciosList from '../../components/public/ComerciosList'
import BannerPublicitario from '../../components/public/BannerPublicitario'

export default function ComerciosPublicos() {
  return (
    <div className="min-h-screen bg-gray-50">
      <ComerciosList showHeader={true} showInfo={true} />

      {/* Banner Footer */}
      <div className="max-w-4xl mx-auto px-4 pb-8">
        <BannerPublicitario tipo="FOOTER" ubicacion="COMERCIOS" />
      </div>
    </div>
  )
}
