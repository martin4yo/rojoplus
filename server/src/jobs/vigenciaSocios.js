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
import { enviarEmail } from '../services/email.js'
import { enviarWhatsApp } from '../services/whatsappService.js'

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

const PLANTILLAS_EMAIL = [
  {
    saludo: (s) => `Estimado/a <strong>${s.apellidoNombre}</strong> (Socio Nº ${s.nroSocio}),`,
    cuerpo: (club) => `<p>Le informamos que su cuenta de socio ha sido bloqueada por presentar cuotas vencidas pendientes de pago.</p><p>Mientras la cuenta esté bloqueada, no podrá acceder a las instalaciones del club.</p><p>Para regularizar su situación, acerquese a tesorería o realice el pago a través del portal del socio. Una vez registrado el pago, su acceso será restituido automáticamente.</p>`,
    despedida: (club) => `<p>Saludos,<br/>${club}</p>`,
  },
  {
    saludo: (s) => `Hola <strong>${s.apellidoNombre}</strong>,`,
    cuerpo: (club) => `<p>Te escribimos para informarte que tu cuenta de socio (Nº ${'{{nroSocio}}'}) fue suspendida porque registramos cuotas vencidas sin pagar.</p><p>Hasta que regularices la deuda no vas a poder ingresar a las instalaciones. Podés pagar desde el portal del socio o pasar por tesorería; el acceso se reactiva automáticamente al confirmarse el pago.</p>`,
    despedida: (club) => `<p>Cualquier consulta estamos para ayudarte.<br/>${club}</p>`,
  },
  {
    saludo: (s) => `Buenas <strong>${s.apellidoNombre}</strong>,`,
    cuerpo: (club) => `<p>Queremos avisarte que la cuenta del Socio Nº ${'{{nroSocio}}'} quedó suspendida. Detectamos cuotas vencidas en el grupo familiar pendientes de pago.</p><p>Mientras la cuenta esté suspendida no se permite el ingreso al club. Apenas se registre el pago, el acceso vuelve automáticamente.</p>`,
    despedida: (club) => `<p>Gracias por tu comprensión.<br/>${club}</p>`,
  },
  {
    saludo: (s) => `${s.apellidoNombre},`,
    cuerpo: (club) => `<p>Te informamos desde administración que tu cuenta de socio fue bloqueada por cuotas vencidas. Esto impide el ingreso al club hasta regularizar la situación.</p><p>El bloqueo se levanta automáticamente al registrarse el pago. Podés hacerlo desde el portal del socio o en tesorería.</p>`,
    despedida: (club) => `<p>Saludos cordiales,<br/>${club}</p>`,
  },
]

const PLANTILLAS_WHATSAPP = [
  (s, club) => `*${club}*\n\nHola ${s.apellidoNombre} (Socio Nº ${s.nroSocio}),\n\nTe informamos que tu cuenta fue *bloqueada por cuotas vencidas*. No vas a poder ingresar al club hasta que regularices la deuda.\n\nUna vez que registremos el pago, tu acceso se restituye automáticamente.`,
  (s, club) => `Buenas ${s.apellidoNombre},\n\n_${club}_ te informa que la cuenta del Socio Nº ${s.nroSocio} fue suspendida por cuotas vencidas. El acceso al club queda inhabilitado hasta el pago.\n\nApenas regularices se reactiva solo. Cualquier consulta avisanos.`,
  (s, club) => `Hola ${s.apellidoNombre} 👋\n\nTe escribimos desde *${club}*. Tu cuenta (Nº ${s.nroSocio}) fue bloqueada porque hay cuotas vencidas en tu grupo familiar.\n\nPodés pagar desde el portal del socio. Al confirmarse el pago el acceso vuelve automáticamente.`,
  (s, club) => `${s.apellidoNombre}, te avisamos desde *${club}*: tu cuenta de socio quedó suspendida por mora.\n\nEl ingreso al club no está permitido hasta el pago. Una vez registrado el pago, se reactiva solo.`,
]

function elegirPlantilla(arr, socioId) {
  // determinístico por socioId para que un mismo socio reciba siempre la misma variante
  return arr[socioId % arr.length]
}

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

    let envioEmail = false, envioWa = false
    try {
      if (s.notifEmail !== false && s.email) {
        const tpl = elegirPlantilla(PLANTILLAS_EMAIL, s.id)
        const html = `${tpl.saludo(s)}\n${tpl.cuerpo(club)}\n${tpl.despedida(club)}`
          .replace(/{{nroSocio}}/g, s.nroSocio || '')
        await enviarEmail({
          to: s.email,
          subject: `${club}: cuenta suspendida por cuotas vencidas`,
          html, db: prisma,
        })
        envioEmail = true
        okEmail++
      }
    } catch (err) {
      console.error(`    [${s.nroSocio}] email error: ${err.message}`)
      fail++
    }

    try {
      if (s.notifWhatsapp !== false && s.celular) {
        const tpl = elegirPlantilla(PLANTILLAS_WHATSAPP, s.id)
        const texto = tpl(s, club)
        await enviarWhatsApp({ db: prisma, telefono: s.celular, texto })
        envioWa = true
        okWa++
      }
    } catch (err) {
      console.error(`    [${s.nroSocio}] whatsapp error: ${err.message}`)
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

    // Throttle entre mensajes (con jitter)
    if (envioEmail || envioWa) await sleepConJitter(delayMs)
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
