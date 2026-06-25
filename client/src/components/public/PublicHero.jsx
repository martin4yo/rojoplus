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
 * - action: acción a la derecha del título (opcional, ej. botón-ícono)
 * - compact: si true, hero más chico (ideal para detalle/listas)
 */
export default function PublicHero({ eyebrow, title, accent, subtitle, children, action, compact = false }) {
  const titleSize = compact
    ? 'clamp(26px, 3.5vw, 46px)'
    : 'clamp(48px, 8vw, 130px)'
  const padding = compact ? 'py-6 md:py-9' : 'py-20 md:py-28'

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
          <div className={`pub-eyebrow text-pub-fg-70 ${compact ? 'mb-2' : 'mb-6'}`}>{eyebrow}</div>
        )}
        <div className="flex items-center justify-between gap-4">
          <h1
            className="font-display-sport text-pub-fg"
            style={{ fontSize: titleSize, lineHeight: compact ? 1 : 0.92 }}
          >
            {accent ? (
              <>
                {title}
                {/* En compact el acento va inline para no ocupar 2 líneas */}
                {compact ? ' ' : <br />}
                <span style={{ color: 'var(--color-primary)' }}>{accent}</span>
              </>
            ) : (
              title
            )}
          </h1>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
        {subtitle && (
          <p
            className={`max-w-2xl text-pub-fg-70 leading-snug ${
              compact ? 'mt-2 text-sm md:text-base' : 'mt-6 text-lg md:text-xl'
            }`}
            style={{ fontWeight: 300, letterSpacing: '-0.01em' }}
          >
            {subtitle}
          </p>
        )}
        {children && <div className={compact ? 'mt-5' : 'mt-10'}>{children}</div>}
      </div>
    </section>
  )
}
