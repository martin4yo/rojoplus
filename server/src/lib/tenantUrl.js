/**
 * Construye la URL del frontend para un tenant específico.
 * En producción usa <subdomain>.<APP_DOMAIN> o el dominioCustom si tiene uno.
 * En desarrollo devuelve FRONTEND_URL (localhost).
 */
function stripWww(url) {
  if (!url) return url
  // Quita www. después del esquema, ej: https://www.miclub.com → https://miclub.com
  return String(url).replace(/^(https?:\/\/)www\./i, '$1')
}

export function getTenantFrontendUrl(tenant) {
  if (!tenant) {
    return stripWww(process.env.FRONTEND_URL || 'http://localhost:5173')
  }

  // En desarrollo: anteponer subdomain al host de FRONTEND_URL para que matchee
  // el flujo multi-tenant local (ej: sportivotest.localhost:5173).
  if (process.env.NODE_ENV !== 'production') {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
    if (!tenant.subdomain) return stripWww(baseUrl)
    try {
      const u = new URL(baseUrl)
      return stripWww(`${u.protocol}//${tenant.subdomain}.${u.host}`)
    } catch {
      return stripWww(baseUrl)
    }
  }

  if (tenant.dominioCustom) {
    const dominio = String(tenant.dominioCustom).replace(/^www\./i, '')
    return stripWww(`https://${dominio}`)
  }

  const rawDomain = process.env.APP_DOMAIN || 'clubix.com.ar'
  const appDomain = rawDomain.replace(/^www\./i, '')
  return stripWww(`https://${tenant.subdomain}.${appDomain}`)
}
