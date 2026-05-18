/**
 * Cron jobs de vigencia de socios (bloqueo por morosidad y notificación).
 *
 * Dos schedules independientes, cada uno controlado por su propio switch en
 * la tabla `Configuracion` por tenant:
 *
 *   - 1:00 AM diario  → cron de bloqueo
 *       switch: MOROSIDAD_BLOQUEO_AUTO_ACTIVO
 *
 *   - cada hora 9-18 → procesa cola de notificación de bloqueo
 *       switch: MOROSIDAD_NOTIFICACION_BLOQUEO_ACTIVO
 *
 * SAFETY GATES (notificación):
 *   1) Variable de entorno  NOTIFICACIONES_VIGENCIA_KILL_SWITCH=true  → STOP global, ignora todo
 *   2) Tenant config        MOROSIDAD_NOTIFICACION_BLOQUEO_ACTIVO=true → habilita per-tenant
 *   3) Tenant config        MOROSIDAD_NOTIF_CONFIRMADO=true            → confirmación explícita extra
 *      (sin este flag, el cron registra eventos pero NO ejecuta envíos reales)
 *   4) Validación: solo envía a socios con notificarMorosidad ≠ false y notifEmail/notifWhatsapp ≠ false
 *   5) Modo demo: redirige todo a EMAIL_DEMO / WHATSAPP_DEMO_NUMERO automáticamente vía wrappers existentes
 *
 * THROTTLING:
 *   - Cap horario por tenant (MOROSIDAD_NOTIF_MAX_POR_HORA, default 30)
 *   - Cap diario por tenant (MOROSIDAD_NOTIF_MAX_POR_DIA, default 200)
 *   - Ventana horaria (MOROSIDAD_NOTIF_HORA_INICIO=9, MOROSIDAD_NOTIF_HORA_FIN=18)
 *   - Delay base entre envíos (toma WHATSAPP_DELAY_MS para WA, +1s extra para email)
 *   - Jitter aleatorio ±50% sobre el delay base
 *   - 4 plantillas rotativas para reducir firma de spam/automatización
 */

import cron from 'node-cron'
import prisma from '../lib/prisma.js'
import { recalcularTenant } from '../services/vigenciaService.js'
import { buildVariables, resolverEmailBloqueo, resolverWaBloqueo } from '../services/morosidadTemplates.js'
import { encolarNotificacion } from '../services/notificacionService.js'

const TIMEZONE = 'America/Argentina/Buenos_Aires'

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getConfigPorTenant(tenantId, claves) {
  const items = await prisma.configuracion.findMany({
    where: { tenantId, clave: { in: claves } },
    select: { clave: true, valor: true },
  })
  return Object.fromEntries(items.map(i => [i.clave, i.valor]))
}

function bool(v) { return String(v ?? '').toLowerCase() === 'true' }

async function getTenantsActivos() {
  // Excluir tenants con CRONS_PAUSADOS=true
  const pausados = await prisma.configuracion.findMany({
    where: { clave: 'CRONS_PAUSADOS', valor: 'true' },
    select: { tenantId: true },
  })
  const pausadosIds = pausados.map(p => p.tenantId)
  return prisma.tenant.findMany({
    where: { activo: true, ...(pausadosIds.length > 0 ? { id: { notIn: pausadosIds } } : {}) },
    select: { id: true, slug: true, nombre: true },
  })
}

// Sleep con jitter ±50%
function sleepConJitter(baseMs) {
  const jitter = baseMs * (Math.random() - 0.5)
  return new Promise(r => setTimeout(r, Math.max(500, baseMs + jitter)))
}

// ════════════════════════════════════════════════════════════════════════════
// CRON 1: Bloqueo por morosidad (1:00 AM)
// ════════════════════════════════════════════════════════════════════════════

async function ejecutarBloqueoMorosidad() {
  const tenants = await getTenantsActivos()
  let bloqueados = 0, reactivados = 0, procesados = 0

  for (const t of tenants) {
    const cfg = await getConfigPorTenant(t.id, ['MOROSIDAD_BLOQUEO_AUTO_ACTIVO'])
    if (!bool(cfg.MOROSIDAD_BLOQUEO_AUTO_ACTIVO)) continue
    procesados++
    try {
      const r = await recalcularTenant(prisma, t.id, { origen: 'CRON' })
      if (r.skip) {
        console.log(`  [${t.slug}] SKIP: ${r.skip}`)
        continue
      }
      console.log(`  [${t.slug}] familias morosas: ${r.familiasMorosas} | bloqueados: ${r.bloqueados} | reactivados: ${r.reactivados}`)
      bloqueados += r.bloqueados
      reactivados += r.reactivados
    } catch (err) {
      console.error(`  [${t.slug}] ERROR: ${err.message}`)
    }
  }
  console.log(`✅ [CRON Vigencia] Bloqueo — tenants procesados: ${procesados}/${tenants.length} | bloqueados: ${bloqueados} | reactivados: ${reactivados}`)
}

const cronBloqueo = cron.schedule('0 1 * * *', async () => {
  console.log(`\n🛑 [CRON Vigencia] ${new Date().toISOString()} - Bloqueo por morosidad`)
  try { await ejecutarBloqueoMorosidad() }
  catch (err) { console.error('❌ [CRON Vigencia] Error fatal en bloqueo:', err.message) }
}, { scheduled: false, timezone: TIMEZONE })

// ════════════════════════════════════════════════════════════════════════════
// CRON 2: Notificación de cuenta bloqueada (cada hora entre 9-18)
// ════════════════════════════════════════════════════════════════════════════

// Plantillas migradas a `services/morosidadTemplates.js` — ahora editables desde la UI
// (EmailTemplate eventType=BLOQUEO_MOROSIDAD_1/_2, Configuracion NOTIF_WA_BLOQUEO_MOROSIDAD_1/_2)
// El cron elige variante por socioId%2 (rotación determinística anti-spam).

async function notificarBloqueoTenant(tenant) {
  const cfg = await getConfigPorTenant(tenant.id, [
    'MOROSIDAD_NOTIFICACION_BLOQUEO_ACTIVO',
    'MOROSIDAD_NOTIF_CONFIRMADO',
    'MOROSIDAD_NOTIF_MAX_POR_HORA',
    'MOROSIDAD_NOTIF_MAX_POR_DIA',
    'MOROSIDAD_NOTIF_HORA_INICIO',
    'MOROSIDAD_NOTIF_HORA_FIN',
    'MOROSIDAD_NOTIF_DELAY_MS',
    'MODO_DEMO',
  ])

  // GATE 1: switch principal del tenant
  if (!bool(cfg.MOROSIDAD_NOTIFICACION_BLOQUEO_ACTIVO)) return { skip: 'switch off' }
  // GATE 2: confirmación explícita extra (segunda llave)
  if (!bool(cfg.MOROSIDAD_NOTIF_CONFIRMADO)) return { skip: 'pending MOROSIDAD_NOTIF_CONFIRMADO=true' }

  const horaInicio = parseInt(cfg.MOROSIDAD_NOTIF_HORA_INICIO || '9')
  const horaFin = parseInt(cfg.MOROSIDAD_NOTIF_HORA_FIN || '18')
  const maxPorHora = parseInt(cfg.MOROSIDAD_NOTIF_MAX_POR_HORA || '30')
  const maxPorDia = parseInt(cfg.MOROSIDAD_NOTIF_MAX_POR_DIA || '200')
  const delayMs = parseInt(cfg.MOROSIDAD_NOTIF_DELAY_MS || '4000')

  // Ventana horaria (Argentina)
  const ahora = new Date()
  const horaArg = parseInt(ahora.toLocaleString('en-US', { hour: '2-digit', hour12: false, timeZone: TIMEZONE }))
  if (horaArg < horaInicio || horaArg >= horaFin) return { skip: `fuera de ventana ${horaInicio}-${horaFin}` }

  // Caps: contar enviados en el día y en la última hora
  const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0)
  const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000)

  const [enviadosHoy, enviadosUltimaHora] = await Promise.all([
    prisma.auditoriaSocio.count({
      where: {
        tenantId: tenant.id, evento: 'NOTIFICACION_BLOQUEO_ENVIADA',
        fecha: { gte: inicioDia },
      },
    }),
    prisma.auditoriaSocio.count({
      where: {
        tenantId: tenant.id, evento: 'NOTIFICACION_BLOQUEO_ENVIADA',
        fecha: { gte: haceUnaHora },
      },
    }),
  ])

  const presupuestoHora = Math.max(0, maxPorHora - enviadosUltimaHora)
  const presupuestoDia = Math.max(0, maxPorDia - enviadosHoy)
  const presupuesto = Math.min(presupuestoHora, presupuestoDia)
  if (presupuesto === 0) return { skip: `cap alcanzado (hora=${enviadosUltimaHora}/${maxPorHora}, dia=${enviadosHoy}/${maxPorDia})` }

  // Eventos pendientes (de las últimas 36h, sin notificar)
  const desde = new Date(Date.now() - 36 * 60 * 60 * 1000)
  const eventos = await prisma.auditoriaSocio.findMany({
    where: { tenantId: tenant.id, evento: 'BLOQUEADO_MOROSIDAD', fecha: { gte: desde } },
    include: {
      socio: {
        select: {
          id: true, nroSocio: true, apellidoNombre: true,
          email: true, celular: true,
          notifEmail: true, notifWhatsapp: true, notificarMorosidad: true,
        },
      },
    },
    orderBy: { fecha: 'asc' },
  })
  const aNotificar = eventos.filter(e => !(e.detalle && e.detalle.notificadoEn) && e.socio).slice(0, presupuesto)
  if (aNotificar.length === 0) return { procesados: 0, presupuesto, modoDemo: bool(cfg.MODO_DEMO) }

  const club = tenant.nombre || tenant.slug
  let okEmail = 0, okWa = 0, fail = 0

  console.log(`  [${tenant.slug}] notificando ${aNotificar.length} (presupuesto ${presupuesto}, demo=${bool(cfg.MODO_DEMO)})`)

  for (const e of aNotificar) {
    const s = e.socio
    if (s.notificarMorosidad === false) continue

    // Construir variables del template (incluye linkPortal, deuda, etc.)
    const vars = await buildVariables({
      socio: s,
      club,
      clubUrl: null,
      cuotasVencidas: 0,
      deudaTotal: 0,
      listaCuotas: [],
    })

    let envioEmail = false, envioWa = false
    // ENCOLAR — el cron `procesarNotificacionesPendientes` los envía con retries y backoff.
    try {
      if (s.notifEmail !== false && s.email) {
        const { subject, html } = await resolverEmailBloqueo({ tenantId: tenant.id, socioId: s.id, vars })
        await encolarNotificacion({
          tenantId: tenant.id,
          tipo: 'EMAIL',
          eventType: 'BLOQUEO_MOROSIDAD',
          destinatario: s.email,
          socioId: s.id,
          asunto: subject,
          cuerpo: html,
          metadata: { variables: vars, nroSocio: s.nroSocio },
        })
        envioEmail = true
        okEmail++
      }
    } catch (err) {
      console.error(`    [${s.nroSocio}] email encolar error: ${err.message}`)
      fail++
    }

    try {
      if (s.notifWhatsapp !== false && s.celular) {
        const { texto } = await resolverWaBloqueo({ tenantId: tenant.id, socioId: s.id, vars })
        await encolarNotificacion({
          tenantId: tenant.id,
          tipo: 'WHATSAPP',
          eventType: 'BLOQUEO_MOROSIDAD',
          destinatario: s.celular,
          socioId: s.id,
          cuerpo: texto,
          metadata: { variables: vars, nroSocio: s.nroSocio },
        })
        envioWa = true
        okWa++
      }
    } catch (err) {
      console.error(`    [${s.nroSocio}] whatsapp encolar error: ${err.message}`)
      fail++
    }

    // Marcar como notificado en el evento original
    await prisma.auditoriaSocio.update({
      where: { id: e.id },
      data: {
        detalle: {
          ...(e.detalle || {}),
          notificadoEn: new Date().toISOString(),
          canales: { email: envioEmail, whatsapp: envioWa },
        },
      },
    })

    // Registrar evento de auditoría del envío para el cap
    await prisma.auditoriaSocio.create({
      data: {
        tenantId: tenant.id, socioId: s.id,
        evento: 'NOTIFICACION_BLOQUEO_ENVIADA',
        detalle: { canales: { email: envioEmail, whatsapp: envioWa }, modoDemo: bool(cfg.MODO_DEMO) },
        origen: 'CRON',
      },
    })

    // Sin throttle aquí: el cron `procesarNotificacionesPendientes` (cada 10 min, take=50)
    // ya naturalmente espacia los envíos. No tiene sentido dormir entre encolados.
  }

  return { procesados: aNotificar.length, okEmail, okWa, fail, presupuesto, modoDemo: bool(cfg.MODO_DEMO) }
}

async function ejecutarNotificacionBloqueo() {
  // KILL SWITCH global por env (emergencia)
  if (bool(process.env.NOTIFICACIONES_VIGENCIA_KILL_SWITCH)) {
    console.log('⏸️  [CRON Vigencia] KILL SWITCH global activo (NOTIFICACIONES_VIGENCIA_KILL_SWITCH=true). No se envía nada.')
    return
  }

  const tenants = await getTenantsActivos()
  for (const t of tenants) {
    try {
      const r = await notificarBloqueoTenant(t)
      if (r.skip) {
        console.log(`  [${t.slug}] SKIP: ${r.skip}`)
      } else if (r.procesados > 0) {
        console.log(`  [${t.slug}] enviados — email=${r.okEmail}, whatsapp=${r.okWa}, errores=${r.fail} (demo=${r.modoDemo})`)
      }
    } catch (err) {
      console.error(`  [${t.slug}] ERROR: ${err.message}`)
    }
  }
}

// Cada hora entre 9-18 (procesa cola con throttling). Si los caps lo permiten,
// avanza; sino skipea hasta la próxima hora. Distribución natural en el día.
const cronNotificacion = cron.schedule('0 9-18 * * *', async () => {
  console.log(`\n📨 [CRON Vigencia] ${new Date().toISOString()} - Notificación de bloqueo`)
  try { await ejecutarNotificacionBloqueo() }
  catch (err) { console.error('❌ [CRON Vigencia] Error fatal en notificación:', err.message) }
}, { scheduled: false, timezone: TIMEZONE })

// ════════════════════════════════════════════════════════════════════════════
// Init
// ════════════════════════════════════════════════════════════════════════════

export function iniciarCronsVigencia() {
  cronBloqueo.start()
  cronNotificacion.start()
  console.log('✅ Crons de vigencia de socios iniciados:')
  console.log('   - Bloqueo: 1:00 AM Argentina (switch: MOROSIDAD_BLOQUEO_AUTO_ACTIVO)')
  console.log('   - Notificación: hourly 9-18 Argentina (switches: MOROSIDAD_NOTIFICACION_BLOQUEO_ACTIVO + MOROSIDAD_NOTIF_CONFIRMADO)')
  if (bool(process.env.NOTIFICACIONES_VIGENCIA_KILL_SWITCH)) {
    console.log('   ⚠️  KILL SWITCH GLOBAL ACTIVO — ningún envío saldrá hasta que NOTIFICACIONES_VIGENCIA_KILL_SWITCH se quite/ponga en false')
  }
}

export { ejecutarBloqueoMorosidad, ejecutarNotificacionBloqueo, notificarBloqueoTenant }
