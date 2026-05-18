/**
 * Plantillas editables para notificaciones de bloqueo por morosidad.
 *
 * Email: usa `EmailTemplate` con eventType `BLOQUEO_MOROSIDAD_1` / `BLOQUEO_MOROSIDAD_2`.
 * WhatsApp: usa `Configuracion` con claves `NOTIF_WA_BLOQUEO_MOROSIDAD_1` / `_2`.
 *
 * El cron y el script de prueba eligen la variante por `socioId % 2`
 * (rotación determinística — mismo socio recibe siempre la misma variante).
 *
 * Variables disponibles en los templates:
 *   - {{nombre}}, {{apellido}}, {{apellidoNombre}}, {{nroSocio}}
 *   - {{club}}, {{clubUrl}}
 *   - {{cuotasVencidas}}, {{deudaTotal}}, {{listaCuotas}}
 *   - {{linkPortal}}
 */
import Handlebars from 'handlebars'
import { createTenantPrisma } from '../lib/tenantPrisma.js'
import { buildVariablesSocio } from './whatsappService.js'

// ─── Defaults (fallback si no hay template en BD) ────────────────────────────

export const EMAIL_DEFAULTS = {
  BLOQUEO_MOROSIDAD_1: {
    subject: '{{club}}: cuenta suspendida por cuotas vencidas',
    bodyHtml: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <p>Estimado/a <strong>{{apellidoNombre}}</strong> (Socio Nº {{nroSocio}}),</p>
  <p>Le informamos que su cuenta de socio ha sido bloqueada por presentar cuotas vencidas pendientes de pago.</p>
  <p>Mientras la cuenta esté bloqueada, no podrá acceder a las instalaciones del club.</p>
  <p>Para regularizar su situación, acerquese a tesorería o realice el pago a través del portal del socio. Una vez registrado el pago, su acceso será restituido automáticamente.</p>
  <p style="margin-top:18px"><a href="{{linkPortal}}" style="background:#DC2626;color:#fff;padding:10px 18px;text-decoration:none;border-radius:6px;display:inline-block">Ir al portal del socio</a></p>
  <p>Saludos,<br/>{{club}}</p>
</div>`,
  },
  BLOQUEO_MOROSIDAD_2: {
    subject: '{{club}}: cuenta suspendida por cuotas vencidas',
    bodyHtml: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <p>Hola <strong>{{nombre}}</strong>,</p>
  <p>Te escribimos para informarte que tu cuenta de socio (Nº {{nroSocio}}) fue suspendida porque registramos cuotas vencidas sin pagar.</p>
  <p>Hasta que regularices la deuda no vas a poder ingresar a las instalaciones. Podés pagar desde el portal del socio o pasar por tesorería; el acceso se reactiva automáticamente al confirmarse el pago.</p>
  <p style="margin-top:18px"><a href="{{linkPortal}}" style="background:#DC2626;color:#fff;padding:10px 18px;text-decoration:none;border-radius:6px;display:inline-block">Acceder al portal</a></p>
  <p>Cualquier consulta estamos para ayudarte.<br/>{{club}}</p>
</div>`,
  },
}

export const WA_DEFAULTS = {
  NOTIF_WA_BLOQUEO_MOROSIDAD_1:
    '*{{club}}*\n\nHola {{nombre}} (Socio Nº {{nroSocio}}),\n\nTe informamos que tu cuenta fue *bloqueada por cuotas vencidas*. No vas a poder ingresar al club hasta que regularices la deuda.\n\nUna vez que registremos el pago, tu acceso se restituye automáticamente.\n\nPortal: {{linkPortal}}',
  NOTIF_WA_BLOQUEO_MOROSIDAD_2:
    'Buenas {{nombre}},\n\n_{{club}}_ te informa que la cuenta del Socio Nº {{nroSocio}} fue suspendida por cuotas vencidas. El acceso al club queda inhabilitado hasta el pago.\n\nApenas regularices se reactiva solo.\n\nPagá online: {{linkPortal}}',
}

// ─── Variant determinista por socio ──────────────────────────────────────────

const VARIANTES = 2

export function variantePara(socioId) {
  return (Number(socioId) % VARIANTES) + 1  // 1 o 2
}

// ─── Resolución de mensaje ───────────────────────────────────────────────────

/**
 * Construye el bag de variables para los templates de morosidad.
 */
export async function buildVariables({ socio, club, clubUrl, cuotasVencidas, deudaTotal, listaCuotas }) {
  const baseVars = await buildVariablesSocio(socio)
  const fmtMonto = (n) => `$${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`
  return {
    ...baseVars,
    apellidoNombre: socio?.apellidoNombre ?? baseVars.nombreCompleto ?? '',
    club: club || '',
    clubUrl: clubUrl || '',
    cuotasVencidas: cuotasVencidas ?? 0,
    deudaTotal: fmtMonto(deudaTotal),
    listaCuotas: Array.isArray(listaCuotas) ? listaCuotas.join('\n') : (listaCuotas || ''),
  }
}

/**
 * Devuelve { subject, html } para email, resolviendo template de BD con fallback default.
 */
export async function resolverEmailBloqueo({ tenantId, socioId, vars }) {
  const variant = variantePara(socioId)
  const eventType = `BLOQUEO_MOROSIDAD_${variant}`
  const db = createTenantPrisma(tenantId)
  let template = await db.emailTemplate.findFirst({ where: { eventType, isActive: true } }).catch(() => null)
  if (!template) {
    const def = EMAIL_DEFAULTS[eventType] || EMAIL_DEFAULTS.BLOQUEO_MOROSIDAD_1
    template = { subject: def.subject, bodyHtml: def.bodyHtml }
  }
  const subject = Handlebars.compile(template.subject)(vars)
  const html = Handlebars.compile(template.bodyHtml)(vars)
  return { subject, html, variant }
}

/**
 * Devuelve el texto WhatsApp listo para enviar, resolviendo template de BD con fallback default.
 */
export async function resolverWaBloqueo({ tenantId, socioId, vars }) {
  const variant = variantePara(socioId)
  const clave = `NOTIF_WA_BLOQUEO_MOROSIDAD_${variant}`
  const db = createTenantPrisma(tenantId)
  const cfg = await db.configuracion.findFirst({ where: { clave } }).catch(() => null)
  const tpl = cfg?.valor || WA_DEFAULTS[clave] || WA_DEFAULTS.NOTIF_WA_BLOQUEO_MOROSIDAD_1
  // Usar Handlebars también acá para soportar mismas variables que email
  const texto = Handlebars.compile(tpl)(vars)
  return { texto, variant }
}
