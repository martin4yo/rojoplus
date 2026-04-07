/**
 * Construye la URL del frontend para un tenant específico.
 * En producción usa <subdomain>.<APP_DOMAIN> o el dominioCustom si tiene uno.
 * En desarrollo devuelve FRONTEND_URL (localhost).
 */
export function getTenantFrontendUrl(tenant) {
  if (!tenant || process.env.NODE_ENV !== 'production') {
    return process.env.FRONTEND_URL || 'http://localhost:5173'
  }

  if (tenant.dominioCustom) {
    return `https://${tenant.dominioCustom}`
  }

  const appDomain = process.env.APP_DOMAIN || 'clubix.com.ar'
  return `https://${tenant.subdomain}.${appDomain}`
}
