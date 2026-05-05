/**
 * Encabezado de sección con estética athletic del sitio público.
 * eyebrow + título display-sport + subtítulo.
 */
export default function SectionHeader({ eyebrow, title, subtitle, accent, children }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
      <div>
        {eyebrow && (
          <div className="pub-eyebrow mb-3" style={{ color: 'var(--text-dim)' }}>
            {eyebrow}
          </div>
        )}
        <h1
          className="font-display-sport"
          style={{ fontSize: 'clamp(28px, 4vw, 44px)', lineHeight: 0.96, color: 'var(--text)' }}
        >
          {accent ? (
            <>
              {title} <span style={{ color: 'var(--color-primary)' }}>{accent}</span>
            </>
          ) : title}
        </h1>
        {subtitle && (
          <p className="mt-3 text-sm md:text-base" style={{ color: 'var(--text-dim)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {children && <div className="flex items-center gap-2 flex-shrink-0">{children}</div>}
    </div>
  )
}
