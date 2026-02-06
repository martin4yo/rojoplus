import ActividadesGrid from '../../components/public/ActividadesGrid'
import BannerPublicitario from '../../components/public/BannerPublicitario'

export default function Actividades() {
  return (
    <div className="bg-gray-300 min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-red-600 to-red-700 py-6 md:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            Actividades Deportivas
          </h1>
          <p className="text-base text-red-100 max-w-2xl mx-auto">
            Descubrí todas las disciplinas que podés practicar en nuestro club
          </p>
        </div>
      </section>

      {/* Banner Header */}
      <BannerPublicitario tipo="HEADER" ubicacion="ACTIVIDADES" />

      {/* Grid de actividades - igual que en Home */}
      <ActividadesGrid limit={100} showTitle={false} />

      {/* Banner Footer */}
      <BannerPublicitario tipo="FOOTER" ubicacion="ACTIVIDADES" />
    </div>
  )
}
