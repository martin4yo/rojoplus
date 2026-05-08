import ActividadesGrid from '../../components/public/ActividadesGrid'
import BannerPublicitario from '../../components/public/BannerPublicitario'
import PublicHero from '../../components/public/PublicHero'

export default function Actividades() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-app)' }}>
      <PublicHero
        eyebrow="Disciplinas"
        title="Actividades"
        accent="deportivas."
        subtitle="Descubrí todas las disciplinas que podés practicar en el club."
        compact
      />

      {/* Banner Header */}
      <BannerPublicitario tipo="HEADER" ubicacion="ACTIVIDADES" />

      {/* Grid de actividades */}
      <ActividadesGrid limit={100} showTitle={false} />

      {/* Banner Footer */}
      <BannerPublicitario tipo="FOOTER" ubicacion="ACTIVIDADES" />
    </div>
  )
}
