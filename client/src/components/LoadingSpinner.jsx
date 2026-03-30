import TenantLogo from './TenantLogo'

/**
 * Spinner de carga con logo del tenant latiendo
 * Props:
 * - size: 'sm' | 'md' | 'lg' (default: 'md')
 * - fullPage: boolean — overlay pantalla completa (default: false)
 */
export default function LoadingSpinner({ size = 'md', fullPage = false }) {
  const logoSize = { sm: 'h-8', md: 'h-12', lg: 'h-16' }[size] || 'h-12'

  const inner = (
    <TenantLogo
      className={`${logoSize} w-auto animate-pulse`}
      fallbackSrc="/images/LogoClubixSolo.png"
    />
  )

  if (fullPage) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white/70 z-50">
        {inner}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      {inner}
    </div>
  )
}
