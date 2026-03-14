import { useTenant } from '../contexts/TenantContext'

/**
 * Componente que muestra el logo del tenant
 * Si no hay logo, muestra el nombre o el texto por defecto
 */
export default function TenantLogo({
  className = 'h-10',
  fallbackSize = 'w-10 h-10',
  showName = false,
  alt = 'Logo'
}) {
  const { tenant, loading } = useTenant()

  if (loading) {
    return <div className={`${fallbackSize} bg-gray-200 rounded animate-pulse`} />
  }

  // Si hay logo del tenant, mostrarlo
  if (tenant?.logoUrl) {
    return (
      <div className="flex items-center gap-2">
        <img
          src={tenant.logoUrl}
          alt={alt}
          className={className}
          onError={(e) => {
            // Si falla la imagen, reemplazarla con el nombre
            e.target.style.display = 'none'
            const fallback = e.target.nextElementSibling
            if (fallback) {
              fallback.style.display = 'inline-block'
            }
          }}
        />
        {/* Fallback: mostrar nombre */}
        <div
          style={{ display: 'none' }}
          className="text-sm font-bold text-primary"
        >
          {tenant?.nombre || 'Club'}
        </div>
      </div>
    )
  }

  // Sin logo: mostrar nombre o default
  if (showName && tenant?.nombre) {
    return <span className="text-sm font-bold">{tenant.nombre}</span>
  }

  // Logo por defecto
  return <img src="/images/logo.png" alt={alt} className={className} />
}
