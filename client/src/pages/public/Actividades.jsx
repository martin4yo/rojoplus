import ActividadesGrid from '../../components/public/ActividadesGrid'
import BannerPublicitario from '../../components/public/BannerPublicitario'

export default function Actividades() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-app)' }}>
      {/* Hero */}
      <section
        className="relative py-20 md:py-28 overflow-hidden"
        style={{ backgroundColor: 'var(--pub-hero-bg)' }}
      >
        <div className="absolute inset-0 bg-field-grid opacity-30" />
        <div
          className="absolute -right-32 -top-32 w-96 h-96 rounded-full opacity-25 blur-3xl"
          style={{ background: 'var(--color-primary)' }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="pub-eyebrow text-pub-fg-70 mb-6">
            Disciplinas
          </div>
          <h1
            className="font-display-sport text-pub-fg"
            style={{ fontSize: 'clamp(48px, 8vw, 130px)', lineHeight: 0.92 }}
          >
            Actividades<br /><span style={{ color: 'var(--color-primary)' }}>deportivas.</span>
          </h1>
          <p
            className="mt-6 max-w-2xl text-lg md:text-xl text-pub-fg-70 leading-snug"
            style={{ fontWeight: 300, letterSpacing: '-0.01em' }}
          >
            Descubrí todas las disciplinas que podés practicar en el club.
          </p>
        </div>
      </section>

      {/* Banner Header */}
      <BannerPublicitario tipo="HEADER" ubicacion="ACTIVIDADES" />

      {/* Grid de actividades */}
      <ActividadesGrid limit={100} showTitle={false} />

      {/* Banner Footer */}
      <BannerPublicitario tipo="FOOTER" ubicacion="ACTIVIDADES" />
    </div>
  )
}
