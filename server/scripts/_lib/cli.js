/**
 * Helpers compartidos por los scripts de migración / importación.
 */

/**
 * Lee un argumento con valor: --tenant sportivopilar
 * Retorna null si no está presente.
 */
export function arg(name, def = null) {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1) return def
  return process.argv[i + 1] || def
}

/**
 * Lee un flag booleano: --dry-run, --force, etc.
 */
export function flag(name) {
  return process.argv.includes(`--${name}`)
}

/**
 * Resuelve el slug → tenant. Termina el proceso si:
 *   - No se pasó --tenant
 *   - El tenant no existe
 *
 * Uso típico:
 *   import { resolveTenant } from './_lib/cli.js'
 *   const tenant = await resolveTenant(prisma, 'importar-cuotas.js')
 *   const tenantId = tenant.id
 */
export async function resolveTenant(prisma, scriptName = 'script') {
  const slug = arg('tenant')
  if (!slug) {
    console.error(`Uso: node scripts/${scriptName} --tenant <slug> [otros flags]`)
    console.error(`Ejemplo: node scripts/${scriptName} --tenant sportivopilar`)
    process.exit(1)
  }
  const tenant = await prisma.tenant.findUnique({ where: { slug } })
  if (!tenant) {
    console.error(`❌ Tenant con slug "${slug}" no encontrado.`)
    process.exit(1)
  }
  console.log(`Tenant: ${tenant.nombre} (slug=${tenant.slug}, id=${tenant.id})`)
  return tenant
}
