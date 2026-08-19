/**
 * Seed idempotente del template de email del recordatorio de morosidad temprana.
 *
 * Crea (si no existe) el EmailTemplate con eventType = MOROSIDAD, que es el que
 * usa `notificarMorosidad()` — o sea el cron MOROSIDAD_RECORDATORIO y el botón
 * "Ejecutar ahora". Sin esta fila el envío por email falla con
 * "Template MOROSIDAD no encontrado o inactivo", aunque el WhatsApp sí salga
 * (ese usa Configuracion.NOTIF_WA_MORA, no EmailTemplate).
 *
 * Las variables son las que arma notificarMorosidad() en su `metadata`:
 *   socioNombre, nroSocio, cantidadCuotas, totalAdeudado, linkPortal
 *   cuotas[] → { descripcion, monto, vencimiento }
 * El render es Handlebars, así que {{#each cuotas}} funciona.
 *
 * Si el template ya existe NO lo sobreescribe (preserva ediciones del admin),
 * salvo que se pase --force.
 *
 * Uso:
 *   node src/scripts/seedMorosidadEmailTemplate.js                     # todos los tenants activos
 *   node src/scripts/seedMorosidadEmailTemplate.js --tenant sportivopilar
 *   node src/scripts/seedMorosidadEmailTemplate.js --tenant 1 --force
 */
import prisma from '../lib/prisma.js'

const args = process.argv.slice(2)
const force = args.includes('--force')
const idxTenant = args.indexOf('--tenant')
const tenantArg = idxTenant >= 0 ? args[idxTenant + 1] : null

const EVENT_TYPE = 'MOROSIDAD'
const VARIABLES = ['socioNombre', 'nroSocio', 'cantidadCuotas', 'totalAdeudado', 'linkPortal', 'cuotas']

const SUBJECT = 'Recordatorio de pago - {{cantidadCuotas}} cuota(s) pendiente(s)'

const BODY_HTML = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color:#111">
  <p>Estimado/a <strong>{{socioNombre}}</strong> (Socio Nº {{nroSocio}}),</p>
  <p>Te escribimos para recordarte que figuran <strong>{{cantidadCuotas}} cuota(s) vencida(s)</strong> pendientes de pago, por un total de <strong>$ {{totalAdeudado}}</strong>.</p>
  <table style="width:100%; border-collapse:collapse; margin:16px 0; font-size:14px">
    <thead>
      <tr style="background:#f3f4f6; text-align:left">
        <th style="padding:8px; border-bottom:1px solid #e5e7eb">Concepto</th>
        <th style="padding:8px; border-bottom:1px solid #e5e7eb">Vencimiento</th>
        <th style="padding:8px; border-bottom:1px solid #e5e7eb; text-align:right">Importe</th>
      </tr>
    </thead>
    <tbody>
      {{#each cuotas}}
      <tr>
        <td style="padding:8px; border-bottom:1px solid #f3f4f6">{{this.descripcion}}</td>
        <td style="padding:8px; border-bottom:1px solid #f3f4f6">{{this.vencimiento}}</td>
        <td style="padding:8px; border-bottom:1px solid #f3f4f6; text-align:right">$ {{this.monto}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  <p>Podés regularizar tu situación desde el portal del socio o acercándote a tesorería.</p>
  <p style="margin-top:18px"><a href="{{linkPortal}}" style="background:#2563EB;color:#fff;padding:10px 18px;text-decoration:none;border-radius:6px;display:inline-block">Ir al portal del socio</a></p>
  <p style="color:#6b7280; font-size:13px; margin-top:20px">Si ya realizaste el pago, por favor desestimá este mensaje.</p>
</div>`

async function resolverTenants() {
  if (!tenantArg) {
    return prisma.tenant.findMany({ where: { activo: true }, select: { id: true, slug: true } })
  }
  const where = /^\d+$/.test(tenantArg) ? { id: parseInt(tenantArg) } : { slug: tenantArg }
  const t = await prisma.tenant.findFirst({ where, select: { id: true, slug: true } })
  return t ? [t] : []
}

const tenants = await resolverTenants()
if (tenants.length === 0) {
  console.error(`No se encontraron tenants (arg: ${tenantArg ?? 'todos los activos'})`)
  process.exit(1)
}

console.log(`Seed template ${EVENT_TYPE} ${force ? '(--force: sobreescribe)' : '(no sobreescribe existentes)'}\n`)

for (const t of tenants) {
  const existente = await prisma.emailTemplate.findFirst({ where: { tenantId: t.id, eventType: EVENT_TYPE } })

  if (existente && !force) {
    console.log(`  [${t.slug}] EXISTE — sin cambios (isActive=${existente.isActive})`)
    continue
  }

  if (existente && force) {
    await prisma.emailTemplate.update({
      where: { id: existente.id },
      data: { subject: SUBJECT, bodyHtml: BODY_HTML, variables: JSON.stringify(VARIABLES), isActive: true },
    })
    console.log(`  [${t.slug}] SOBREESCRITO`)
    continue
  }

  await prisma.emailTemplate.create({
    data: {
      tenantId: t.id,
      eventType: EVENT_TYPE,
      nombre: 'Recordatorio de morosidad',
      descripcion: 'Email del recordatorio de cuotas vencidas (cron MOROSIDAD_RECORDATORIO).',
      subject: SUBJECT,
      bodyHtml: BODY_HTML,
      bodyText: null,
      variables: JSON.stringify(VARIABLES),
      isActive: true,
    },
  })
  console.log(`  [${t.slug}] CREADO`)
}

await prisma.$disconnect()
console.log('\nListo.')
