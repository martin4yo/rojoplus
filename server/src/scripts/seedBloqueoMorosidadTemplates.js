/**
 * Seed idempotente de templates de bloqueo por morosidad.
 *
 * Crea (si no existen) los templates de email y WhatsApp para cada tenant activo:
 *  - EmailTemplate: BLOQUEO_MOROSIDAD_1, BLOQUEO_MOROSIDAD_2
 *  - Configuracion: NOTIF_WA_BLOQUEO_MOROSIDAD_1, NOTIF_WA_BLOQUEO_MOROSIDAD_2
 *
 * Si el template ya existe, NO lo sobreescribe (preserva ediciones del admin).
 *
 * Uso:
 *   node src/scripts/seedBloqueoMorosidadTemplates.js                # todos los tenants activos
 *   node src/scripts/seedBloqueoMorosidadTemplates.js --tenant 4     # solo tenant id=4
 *   node src/scripts/seedBloqueoMorosidadTemplates.js --tenant sportivotest
 *   node src/scripts/seedBloqueoMorosidadTemplates.js --force        # SOBREESCRIBE existentes (cuidado)
 */
import prisma from '../lib/prisma.js'
import { EMAIL_DEFAULTS, WA_DEFAULTS } from '../services/morosidadTemplates.js'

const args = process.argv.slice(2)
const force = args.includes('--force')
const idxTenant = args.indexOf('--tenant')
const tenantArg = idxTenant >= 0 ? args[idxTenant + 1] : null

async function resolverTenants() {
  if (!tenantArg) {
    return prisma.tenant.findMany({ where: { activo: true }, select: { id: true, slug: true, nombre: true } })
  }
  const where = /^\d+$/.test(tenantArg) ? { id: parseInt(tenantArg) } : { slug: tenantArg }
  const t = await prisma.tenant.findFirst({ where, select: { id: true, slug: true, nombre: true } })
  return t ? [t] : []
}

const VARIABLES = ['nombre', 'apellido', 'apellidoNombre', 'nroSocio', 'club', 'clubUrl', 'cuotasVencidas', 'deudaTotal', 'listaCuotas', 'linkPortal']

async function upsertEmailTemplate(tenantId, eventType, def) {
  const existente = await prisma.emailTemplate.findFirst({ where: { tenantId, eventType } })
  if (existente && !force) return { eventType, status: 'EXISTE' }
  if (existente && force) {
    await prisma.emailTemplate.update({
      where: { id: existente.id },
      data: {
        subject: def.subject,
        bodyHtml: def.bodyHtml,
        variables: JSON.stringify(VARIABLES),
        isActive: true,
      },
    })
    return { eventType, status: 'SOBREESCRITO' }
  }
  await prisma.emailTemplate.create({
    data: {
      tenantId,
      eventType,
      nombre: `Bloqueo por morosidad (variante ${eventType.endsWith('_1') ? 1 : 2})`,
      descripcion: 'Email enviado al socio cuando su cuenta queda bloqueada por cuotas vencidas. Variante rotativa.',
      subject: def.subject,
      bodyHtml: def.bodyHtml,
      bodyText: null,
      variables: JSON.stringify(VARIABLES),
      isActive: true,
    },
  })
  return { eventType, status: 'CREADO' }
}

async function upsertWaConfig(tenantId, clave, valor) {
  const existente = await prisma.configuracion.findFirst({ where: { tenantId, clave } })
  if (existente && !force) return { clave, status: 'EXISTE' }
  if (existente) {
    await prisma.configuracion.update({ where: { id: existente.id }, data: { valor } })
    return { clave, status: 'SOBREESCRITO' }
  }
  await prisma.configuracion.create({ data: { tenantId, clave, valor } })
  return { clave, status: 'CREADO' }
}

const tenants = await resolverTenants()
if (tenants.length === 0) {
  console.log('⚠️ No se encontraron tenants para procesar.')
  process.exit(0)
}

console.log(`\n=== Seed templates bloqueo morosidad ===`)
console.log(`Tenants a procesar: ${tenants.length}`)
console.log(`Modo: ${force ? '⚠️ FORCE (sobreescribe)' : 'idempotente (preserva ediciones)'}\n`)

const reporte = []
for (const t of tenants) {
  const items = []
  items.push(await upsertEmailTemplate(t.id, 'BLOQUEO_MOROSIDAD_1', EMAIL_DEFAULTS.BLOQUEO_MOROSIDAD_1))
  items.push(await upsertEmailTemplate(t.id, 'BLOQUEO_MOROSIDAD_2', EMAIL_DEFAULTS.BLOQUEO_MOROSIDAD_2))
  items.push(await upsertWaConfig(t.id, 'NOTIF_WA_BLOQUEO_MOROSIDAD_1', WA_DEFAULTS.NOTIF_WA_BLOQUEO_MOROSIDAD_1))
  items.push(await upsertWaConfig(t.id, 'NOTIF_WA_BLOQUEO_MOROSIDAD_2', WA_DEFAULTS.NOTIF_WA_BLOQUEO_MOROSIDAD_2))
  for (const i of items) {
    reporte.push({ tenant: t.slug, ...i })
  }
}
console.table(reporte)
console.log('\nDone.')
process.exit(0)
