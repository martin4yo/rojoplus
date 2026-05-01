/**
 * Hero athletic reutilizable para páginas internas del sitio público.
 * Usa los tokens configurables --pub-hero-bg / --pub-hero-fg del tenant.
 *
 * Props:
 * - eyebrow: pre-headline en mono uppercase (ej: "El club", "Disciplinas")
 * - title: título principal en Anton condensed (string o ReactNode)
 * - accent: parte resaltada del título en color del tenant (opcional, va después del title)
 * - subtitle: bajada en regular, peso 300 (opcional)
 * - children: contenido extra debajo (opcional, ej. botones)
 * - compact: si true, hero más chico (ideal para detalle/listas)
 */
export default function PublicHero({ eyebrow, title, accent, subtitle, children, compact = false }) {
  const titleSize = compact
    ? 'clamp(40px, 6vw, 90px)'
    : 'clamp(48px, 8vw, 130px)'
  const padding = compact ? 'py-16 md:py-20' : 'py-20 md:py-28'

  return (
    <section
      className={`relative ${padding} overflow-hidden`}
      style={{ backgroundColor: 'var(--pub-hero-bg)' }}
    >
      <div className="absolute inset-0 bg-field-grid-pub opacity-50" />
      <div
        className="absolute -right-32 -top-32 w-96 h-96 rounded-full opacity-20 blur-3xl"
        style={{ background: 'var(--color-primary)' }}
      />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {eyebrow && (
          <div className="pub-eyebrow text-pub-fg-70 mb-6">{eyebrow}</div>
        )}
        <h1
          className="font-display-sport text-pub-fg"
          style={{ fontSize: titleSize, lineHeight: 0.92 }}
        >
          {accent ? (
            <>
              {title}
              <br />
              <span style={{ color: 'var(--color-primary)' }}>{accent}</span>
            </>
          ) : (
            title
          )}
        </h1>
        {subtitle && (
          <p
            className="mt-6 max-w-2xl text-lg md:text-xl text-pub-fg-70 leading-snug"
            style={{ fontWeight: 300, letterSpacing: '-0.01em' }}
          >
            {subtitle}
          </p>
        )}
        {children && <div className="mt-10">{children}</div>}
      </div>
    </section>
  )
}
