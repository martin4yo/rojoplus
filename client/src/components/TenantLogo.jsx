import { useTenant } from '../contexts/TenantContext'

/**
 * Componente que muestra el logo del tenant.
 * Usado tanto en el sitio público como en /admin.
 * Si el tenant tiene logoUrl lo muestra; si no, muestra fallbackSrc.
 */
export default function TenantLogo({
  className = 'h-10',
  fallbackSize = 'w-10 h-10',
  fallbackSrc = '/images/LogoClubixSolo.png',
  showName = false,
  alt,
}) {
  const { tenant, loading } = useTenant()

  const altText = alt || tenant?.nombre || 'Logo'

  if (loading) {
    return <div className={`${fallbackSize} bg-gray-200 rounded animate-pulse`} />
  }

  if (tenant?.logoUrl) {
    return (
      <img
        src={tenant.logoUrl}
        alt={altText}
        className={className}
        onError={(e) => { e.target.src = fallbackSrc }}
      />
    )
  }

  if (showName && tenant?.nombre) {
    return <span className="font-bold text-primary">{tenant.nombre}</span>
  }

  return <img src={fallbackSrc} alt={altText} className={className} />
}
