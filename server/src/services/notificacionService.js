import prisma from '../lib/prisma.js'
import Handlebars from 'handlebars'
import { enviarNotificacionPush } from './webPush.js'
import { getMailConfig, enviarEmail } from './email.js'
import { createTenantPrisma } from '../lib/tenantPrisma.js'
import { notificarVencimiento as notifWaVencimiento, notificarMora as notifWaMora, obtenerTelefonoSocio, enviarWhatsApp, getWhatsAppConfig, buildVariablesSocio } from './whatsappService.js'
import { getTenantFrontendUrl } from '../lib/tenantUrl.js'
import { ensurePortalToken } from '../lib/portalToken.js'

// Caché simple de URLs por tenantId para no repetir queries en el mismo ciclo de jobs
const _tenantUrlCache = new Map()
async function getTenantUrl(tenantId) {
  if (_tenantUrlCache.has(tenantId)) return _tenantUrlCache.get(tenantId)
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { subdomain: true, dominioCustom: true } })
  const url = getTenantFrontendUrl(tenant)
  _tenantUrlCache.set(tenantId, url)
  return url
}

/**
 * Devuelve los IDs de tenants que tienen `Configuracion.CRONS_PAUSADOS=true`.
 * Los crons del sistema deben omitir esos tenants.
 */
export async function getTenantsConCronsPausados() {
  try {
    const filas = await prisma.configuracion.findMany({
      where: { clave: 'CRONS_PAUSADOS', valor: 'true' },
      select: { tenantId: true },
    })
    return filas.map(f => f.tenantId)
  } catch (err) {
    console.error('[Crons] Error leyendo tenants pausados:', err.message)
    return []
  }
}

/**
 * Combina master pause + switch individual del cron. Devuelve tenantIds donde
 * el cron específico está deshabilitado.
 */
export async function getTenantsBloqueadosPorCron(cronKey) {
  try {
    const { tenantsBloqueadosPorCron } = await import('../lib/cronsCatalogo.js')
    return await tenantsBloqueadosPorCron(prisma, cronKey)
  } catch (err) {
    console.error('[Crons] Error obteniendo tenants bloqueados:', err.message)
    return await getTenantsConCronsPausados()
  }
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

/**
 * Generar payload para push notification según el tipo de evento
 */
function getPushPayloadForEvent(eventType, notif) {
  const metadata = notif.metadata ? JSON.parse(notif.metadata) : {}

  switch (eventType) {
    case 'CUOTA_PROX_VENCER':
      return {
        title: 'Cuota próxima a vencer',
        body: `Tu cuota de ${metadata.cargoDescripcion || 'cuota mensual'} vence el ${metadata.fechaVencimiento}`,
        url: '/portal-socio/pagos',
        tag: 'cuota-proxima'
      }

    case 'CUOTA_VENCIDA':
      return {
        title: 'Cuota vencida',
        body: `Tu cuota de ${metadata.cargoDescripcion || 'cuota mensual'} ha vencido. Regulariza tu situación.`,
        url: '/portal-socio/pagos',
        tag: 'cuota-vencida'
      }

    case 'MOROSIDAD':
      return {
        title: 'Recordatorio de pago',
        body: `Tienes cuotas pendientes por un total de $${metadata.deudaTotal || '0'}`,
        url: '/portal-socio/pagos',
        tag: 'morosidad'
      }

    case 'PAGO_CONFIRMADO':
      return {
        title: 'Pago confirmado',
        body: `Tu pago de $${metadata.monto || '0'} fue registrado correctamente`,
        url: '/portal-socio/pagos',
        tag: 'pago-confirmado'
      }

    case 'INSCRIPCION_CONFIRMADA':
      return {
        title: 'Inscripción confirmada',
        body: `Tu inscripción a ${metadata.actividad || 'la actividad'} fue confirmada`,
        url: '/portal-socio/actividades',
        tag: 'inscripcion'
      }

    case 'CONVOCATORIA_PARTIDO':
      return {
        title: 'Convocado a partido',
        body: `Has sido convocado para el partido vs ${metadata.rival || 'rival'} el ${metadata.fecha}`,
        url: '/portal-socio/actividades',
        tag: 'convocatoria-partido'
      }

    case 'RECORDATORIO_PARTIDO':
      return {
        title: 'Recordatorio: Partido mañana',
        body: `Mañana tienes partido vs ${metadata.rival || 'rival'} a las ${metadata.hora || 'hora por confirmar'}`,
        url: '/portal-socio/actividades',
        tag: 'recordatorio-partido'
      }

    case 'CANCELACION_ENTRENAMIENTO':
      return {
        title: 'Entrenamiento cancelado',
        body: `El entrenamiento del ${metadata.fecha} ha sido cancelado`,
        url: '/portal-socio/actividades',
        tag: 'cancelacion-entrenamiento'
      }

    case 'NUEVO_ENTRENAMIENTO':
      return {
        title: 'Nuevo entrenamiento programado',
        body: `${metadata.actividad} - ${metadata.categoria}: ${metadata.fecha} a las ${metadata.hora}`,
        url: '/portal-socio/actividades',
        tag: 'nuevo-entrenamiento'
      }

    case 'PASAJE_CATEGORIA':
      return {
        title: 'Cambio de categoría',
        body: `${metadata.socioNombre} pasó de ${metadata.categoriaAnterior} a ${metadata.categoriaNueva}`,
        url: '/portal-socio/actividades',
        tag: 'pasaje-categoria'
      }

    default:
      return null
  }
}

/**
 * Obtener configuración de modo demo (con scope de tenant — NUNCA leer global).
 * Acepta firma legacy `getModoDemo(db)` o nueva `getModoDemo({ db, tenantId })`.
 */
async function getModoDemo(dbOrOpts) {
  const opts = (dbOrOpts && typeof dbOrOpts === 'object' && ('tenantId' in dbOrOpts || 'db' in dbOrOpts))
    ? dbOrOpts
    : { db: dbOrOpts }
  let client = null
  if (opts.tenantId) client = createTenantPrisma(opts.tenantId)
  else if (opts.db) client = opts.db
  if (!client) {
    console.warn('[notificacionService] getModoDemo sin tenantId/db — asumiendo inactivo')
    return { activo: false, email: '' }
  }
  try {
    const [modoDemo, emailDemo] = await Promise.all([
      client.configuracion.findFirst({ where: { clave: 'MODO_DEMO' } }),
      client.configuracion.findFirst({ where: { clave: 'EMAIL_DEMO' } }),
    ])
    return {
      activo: modoDemo?.valor === 'true',
      email: emailDemo?.valor || '',
    }
  } catch (error) {
    console.error('Error obteniendo modo demo:', error.message)
    return { activo: false, email: '' }
  }
}

/**
 * Renderizar template con Handlebars
 */
function renderTemplate(template, variables) {
  const compiledTemplate = Handlebars.compile(template)
  return compiledTemplate(variables)
}

/**
 * Enviar email usando template de la BD
 */
export async function enviarEmailConTemplate(eventType, to, variables, db = null, tenantId = null) {
  try {
    // Si viene tenantId, crear cliente tenant-scoped; sino usar db tenant-scoped pasado
    const client = tenantId ? createTenantPrisma(tenantId) : (db || prisma)
    if (!tenantId && (!db || db === prisma)) {
      console.warn(`[enviarEmailConTemplate] sin scope tenant — eventType=${eventType} to=${to}`)
    }
    // Obtener template de la BD
    const template = await client.emailTemplate.findUnique({
      where: { eventType },
    })

    if (!template || !template.isActive) {
      throw new Error(`Template ${eventType} no encontrado o inactivo`)
    }

    // Renderizar subject y body
    const subject = renderTemplate(template.subject, variables)
    const bodyHtml = renderTemplate(template.bodyHtml, variables)

    // Obtener config SMTP del tenant + modo demo (scope tenant-safe)
    const [mailConfig, modoDemo] = await Promise.all([
      getMailConfig({ db, tenantId }),
      getModoDemo({ db, tenantId }),
    ])

    let destinatario = to
    let subjectFinal = subject

    if (modoDemo.activo && modoDemo.email) {
      destinatario = modoDemo.email
      subjectFinal = `[DEMO - Para: ${to}] ${subject}`
      console.log(`📧 MODO DEMO: Redirigiendo email de ${to} a ${modoDemo.email}`)
    }

    await mailConfig.transporter.sendMail({
      from: mailConfig.from,
      to: destinatario,
      subject: subjectFinal,
      html: bodyHtml,
    })

    console.log(`✅ Email enviado: ${eventType} a ${destinatario}`)
    return { success: true }
  } catch (error) {
    console.error(`❌ Error enviando email ${eventType}:`, error.message)
    throw error
  }
}

// ============================================================================
// PROGRAMAR NOTIFICACIONES
// ============================================================================

/**
 * Constantes de retry/backoff para el procesador de cola.
 */
export const NOTIF_MAX_INTENTOS = 5
const NOTIF_BACKOFF_BASE_MIN = 5  // base del backoff: 5 min
// Backoff por intento: 5, 10, 20, 40, 80 min — total ~2.5hs antes de marcar FALLIDO_DEFINITIVO
function calcularProximoIntento(intentos) {
  const minutos = NOTIF_BACKOFF_BASE_MIN * Math.pow(2, intentos)
  const d = new Date()
  d.setMinutes(d.getMinutes() + minutos)
  return d
}

/**
 * Encola una notificación PRE-RENDERIZADA para envío diferido por el cron.
 * Diferencia con `programarNotificacion`:
 *   - `programarNotificacion`: solo guarda metadata, el procesador renderiza con template.
 *   - `encolarNotificacion`: el caller ya renderizó `asunto`/`cuerpo`; el procesador
 *     solo envía. Útil cuando el template viene de fuentes mixtas (EmailTemplate +
 *     Configuracion para WA).
 *
 * Retorna el NotificacionLog creado.
 */
export async function encolarNotificacion({
  tenantId,
  tipo,
  eventType,
  destinatario,
  socioId = null,
  cargoId = null,
  asunto = null,
  cuerpo,
  fechaProgramado = new Date(),
  metadata = {},
}) {
  if (!tenantId) throw new Error(`encolarNotificacion: tenantId requerido (eventType=${eventType})`)
  if (!tipo || !['EMAIL', 'WHATSAPP'].includes(tipo)) throw new Error(`encolarNotificacion: tipo inválido (${tipo})`)
  if (!destinatario) throw new Error(`encolarNotificacion: destinatario requerido (eventType=${eventType})`)
  if (!cuerpo) throw new Error(`encolarNotificacion: cuerpo requerido (eventType=${eventType})`)

  return prisma.notificacionLog.create({
    data: {
      tenantId,
      tipo,
      eventType: eventType || 'OTRO',
      destinatario,
      socioId,
      cargoId,
      asunto,
      cuerpo,
      fechaProgramado,
      metadata: JSON.stringify(metadata),
      enviado: false,
      intentos: 0,
    },
  })
}

/**
 * Programar notificación para envío posterior.
 * IMPORTANTE: `tenantId` es obligatorio (NotificacionLog.tenantId es NOT NULL).
 */
export async function programarNotificacion({
  tenantId,
  tipo = 'EMAIL',
  eventType,
  destinatario,
  socioId,
  cargoId = null,
  asunto,
  cuerpo,
  fechaProgramado = new Date(),
  metadata = {},
}) {
  if (!tenantId) {
    throw new Error(`programarNotificacion: tenantId requerido (eventType=${eventType}, destinatario=${destinatario})`)
  }
  try {
    const notificacion = await prisma.notificacionLog.create({
      data: {
        tenantId,
        tipo,
        eventType,
        destinatario,
        socioId,
        cargoId,
        asunto,
        cuerpo,
        fechaProgramado,
        metadata: JSON.stringify(metadata),
        enviado: false,
        intentos: 0,
      },
    })

    console.log(`📅 Notificación programada: ${eventType} para ${destinatario} el ${fechaProgramado} (tenant=${tenantId})`)
    return notificacion
  } catch (error) {
    console.error('Error programando notificación:', error.message)
    throw error
  }
}

/**
 * Procesar notificaciones pendientes (llamado por cron job)
 */
export async function procesarNotificacionesPendientes() {
  try {
    const ahora = new Date()

    // Buscar notificaciones pendientes cuya fecha programada ya pasó.
    // Reintentos limitados a NOTIF_MAX_INTENTOS (5).
    const notificacionesPendientes = await prisma.notificacionLog.findMany({
      where: {
        enviado: false,
        fechaProgramado: { lte: ahora },
        intentos: { lt: NOTIF_MAX_INTENTOS },
      },
      include: {
        socio: { select: { id: true, nroSocio: true, apellidoNombre: true, notifEmail: true, notifWhatsapp: true, notificarMorosidad: true } },
        cargo: true,
      },
      take: 50,
    })

    console.log(`📬 Procesando ${notificacionesPendientes.length} notificaciones pendientes...`)

    const resultados = await Promise.allSettled(
      notificacionesPendientes.map(async (notif) => {
        const proximosIntentos = notif.intentos + 1
        try {
          const tenantDb = notif.tenantId ? createTenantPrisma(notif.tenantId) : null

          // Respeto de preferencias del socio (opt-out por canal)
          if (notif.tipo === 'EMAIL' && notif.socio?.notifEmail === false) {
            await prisma.notificacionLog.update({
              where: { id: notif.id },
              data: { enviado: true, fechaEnvio: new Date(), intentos: proximosIntentos, error: 'Canal email deshabilitado por el socio' },
            })
            return { success: true, id: notif.id, omitido: true }
          }
          if (notif.tipo === 'WHATSAPP' && notif.socio?.notifWhatsapp === false) {
            await prisma.notificacionLog.update({
              where: { id: notif.id },
              data: { enviado: true, fechaEnvio: new Date(), intentos: proximosIntentos, error: 'Canal WhatsApp deshabilitado por el socio' },
            })
            return { success: true, id: notif.id, omitido: true }
          }

          // Envío según tipo
          if (notif.tipo === 'EMAIL') {
            // Si vino con cuerpo pre-renderizado (encolado por el flujo de morosidad), enviarlo directo.
            // Si no, fallback al renderizado por template (flujo legacy con metadata).
            if (notif.cuerpo) {
              await enviarEmail({
                tenantId: notif.tenantId,
                to: notif.destinatario,
                subject: notif.asunto || '(sin asunto)',
                html: notif.cuerpo,
              })
            } else {
              const metadata = notif.metadata ? JSON.parse(notif.metadata) : {}
              await enviarEmailConTemplate(notif.eventType, notif.destinatario, metadata, tenantDb, notif.tenantId)
            }
          } else if (notif.tipo === 'WHATSAPP') {
            const r = await enviarWhatsApp({
              tenantId: notif.tenantId,
              telefono: notif.destinatario,
              texto: notif.cuerpo,
              ignorarHorario: false,
            })
            if (!r || !r.enviado) {
              throw new Error(r?.motivo || 'WhatsApp no enviado')
            }
          } else {
            throw new Error(`Tipo de notificación no soportado: ${notif.tipo}`)
          }

          // Push notification adicional (best-effort)
          if (notif.socioId) {
            try {
              const pushPayload = getPushPayloadForEvent(notif.eventType, notif)
              if (pushPayload) await enviarNotificacionPush(notif.socioId, pushPayload)
            } catch (pushError) {
              console.log(`Push notification no enviada para ${notif.socioId}: ${pushError.message}`)
            }
          }

          // Marcar como enviado
          await prisma.notificacionLog.update({
            where: { id: notif.id },
            data: { enviado: true, fechaEnvio: new Date(), intentos: proximosIntentos, error: null },
          })

          return { success: true, id: notif.id }
        } catch (error) {
          const agotado = proximosIntentos >= NOTIF_MAX_INTENTOS
          // Si llegó al máximo: marcar como terminal (enviado=true para no volver a intentar,
          // pero con error visible para reportes).
          if (agotado) {
            await prisma.notificacionLog.update({
              where: { id: notif.id },
              data: {
                enviado: true, // terminal: no se vuelve a intentar
                intentos: proximosIntentos,
                error: `MAX_INTENTOS_AGOTADO (${proximosIntentos}/${NOTIF_MAX_INTENTOS}): ${error.message}`,
              },
            })
          } else {
            // Reintento con backoff exponencial: 5min × 2^intentos
            const proxima = calcularProximoIntento(proximosIntentos)
            await prisma.notificacionLog.update({
              where: { id: notif.id },
              data: {
                intentos: proximosIntentos,
                error: error.message,
                fechaProgramado: proxima,
              },
            })
          }
          return { success: false, id: notif.id, error: error.message, agotado }
        }
      })
    )

    const exitosos = resultados.filter((r) => r.status === 'fulfilled' && r.value.success).length
    const fallidos = resultados.filter((r) => r.status === 'fulfilled' && !r.value.success).length
    const agotados = resultados.filter((r) => r.status === 'fulfilled' && r.value.agotado).length

    console.log(`✅ Notificaciones — enviadas: ${exitosos}, reintento programado: ${fallidos - agotados}, agotaron reintentos: ${agotados}`)

    return { exitosos, fallidos, agotados, total: notificacionesPendientes.length }
  } catch (error) {
    console.error('Error procesando notificaciones pendientes:', error.message)
    throw error
  }
}

// ============================================================================
// NOTIFICACIONES ESPECÍFICAS
// ============================================================================

/**
 * Notificar cuota próxima a vencer (5 días antes)
 */
export async function notificarCuotaProximaVencer(cargo) {
  try {
    const socio = await prisma.socio.findUnique({
      where: { id: cargo.socioId },
      include: {
        categoriaSocioRel: true,
        tipoSocioRel: true,
        titularFamilia: true,
      },
    })

    if (!socio || !socio.notificarCuotaProxVenc) {
      return
    }

    // Si el cargo es de un miembro del grupo familiar, el aviso va al titular.
    const destinatario = socio.titularFamilia || socio

    const fechaVencimiento = new Date(cargo.fechaVencimiento)
    const diasRestantes = Math.ceil((fechaVencimiento - new Date()) / (1000 * 60 * 60 * 24))

    const metadata = {
      socioNombre: destinatario.apellidoNombre,
      nroSocio: destinatario.nroSocio,
      cargoDescripcion: cargo.descripcion || 'Cuota mensual',
      montoTotal: cargo.montoTotal.toString(),
      fechaVencimiento: fechaVencimiento.toLocaleDateString('es-AR'),
      diasRestantes: diasRestantes.toString(),
      linkPortal: `${await getTenantUrl(destinatario.tenantId)}/portal-socio/${await ensurePortalToken(destinatario)}?pagar=${cargo.id}`,
      // Si la cuota es de un miembro de la familia, incluimos su nombre
      socioCuota: destinatario.id !== socio.id ? socio.apellidoNombre : null,
    }

    // Email (al titular si aplica)
    if (destinatario.email && destinatario.notifEmail !== false) {
      await programarNotificacion({
        tenantId: destinatario.tenantId,
        tipo: 'EMAIL',
        eventType: 'CUOTA_PROX_VENCER',
        destinatario: destinatario.email,
        socioId: destinatario.id,
        cargoId: cargo.id,
        asunto: `Recordatorio: ${destinatario.id !== socio.id ? `cuota de ${socio.apellidoNombre} ` : 'Tu cuota '}vence en ${diasRestantes} días`,
        cuerpo: null,
        fechaProgramado: new Date(),
        metadata,
      })
    }

    // WhatsApp (al titular si aplica)
    if (destinatario.notifWhatsapp && obtenerTelefonoSocio(destinatario)) {
      const db = createTenantPrisma(destinatario.tenantId)
      db.configuracion.findFirst({ where: { clave: 'WHATSAPP_NOTIF_VENCIMIENTO' } })
        .then(flag => {
          if (flag?.valor !== 'false') {
            notifWaVencimiento({
              db,
              socio: destinatario,
              cuota: { id: cargo.id, vencimiento: cargo.fechaVencimiento, importe: cargo.montoTotal },
            }).catch(err => console.error('Error WA cuota próx. vencer:', err.message))
          }
        })
        .catch(err => console.error('Error leyendo flag WA vencimiento:', err.message))
    }

    const etiqueta = destinatario.id !== socio.id
      ? `${destinatario.apellidoNombre} (titular de ${socio.apellidoNombre})`
      : socio.apellidoNombre
    console.log(`Notificado: Cuota próxima a vencer para ${etiqueta}`)
  } catch (error) {
    console.error('Error notificando cuota próxima a vencer:', error.message)
  }
}

/**
 * Notificar cuota vencida (día del vencimiento)
 */
export async function notificarCuotaVencida(cargo) {
  try {
    const socio = await prisma.socio.findUnique({
      where: { id: cargo.socioId },
      include: { titularFamilia: true },
    })

    if (!socio || !socio.notificarCuotaVencida) {
      return
    }

    // Si el cargo es de un miembro del grupo familiar, el aviso va al titular.
    const destinatario = socio.titularFamilia || socio

    const metadata = {
      socioNombre: destinatario.apellidoNombre,
      nroSocio: destinatario.nroSocio,
      cargoDescripcion: cargo.descripcion || 'Cuota mensual',
      montoTotal: cargo.montoTotal.toString(),
      fechaVencimiento: new Date(cargo.fechaVencimiento).toLocaleDateString('es-AR'),
      linkPortal: `${await getTenantUrl(destinatario.tenantId)}/portal-socio/${await ensurePortalToken(destinatario)}?pagar=${cargo.id}`,
      socioCuota: destinatario.id !== socio.id ? socio.apellidoNombre : null,
    }

    // Email (al titular si aplica)
    if (destinatario.email && destinatario.notifEmail !== false) {
      await programarNotificacion({
        tenantId: destinatario.tenantId,
        tipo: 'EMAIL',
        eventType: 'CUOTA_VENCIDA',
        destinatario: destinatario.email,
        socioId: destinatario.id,
        cargoId: cargo.id,
        asunto: destinatario.id !== socio.id ? `La cuota de ${socio.apellidoNombre} ha vencido` : 'Tu cuota ha vencido',
        cuerpo: null,
        fechaProgramado: new Date(),
        metadata,
      })
    }

    // WhatsApp (al titular si aplica)
    if (destinatario.notifWhatsapp && obtenerTelefonoSocio(destinatario)) {
      const db = createTenantPrisma(destinatario.tenantId)
      db.configuracion.findFirst({ where: { clave: 'WHATSAPP_NOTIF_VENCIMIENTO' } })
        .then(flag => {
          if (flag?.valor !== 'false') {
            notifWaVencimiento({
              db,
              socio: destinatario,
              cuota: { id: cargo.id, vencimiento: cargo.fechaVencimiento, importe: cargo.montoTotal },
            }).catch(err => console.error('Error WA cuota vencida:', err.message))
          }
        })
        .catch(err => console.error('Error leyendo flag WA vencimiento:', err.message))
    }

    const etiqueta = destinatario.id !== socio.id
      ? `${destinatario.apellidoNombre} (titular de ${socio.apellidoNombre})`
      : socio.apellidoNombre
    console.log(`Notificado: Cuota vencida para ${etiqueta}`)
  } catch (error) {
    console.error('Error notificando cuota vencida:', error.message)
  }
}

/**
 * Notificar morosidad (cada 15 días)
 */
export async function notificarMorosidad(socioId) {
  try {
    const socio = await prisma.socio.findUnique({
      where: { id: socioId },
      include: {
        titularFamilia: true,
        miembrosFamilia: { select: { id: true, apellidoNombre: true } },
      },
    })

    if (!socio || !socio.notificarMorosidad) {
      return
    }

    // Si es miembro de familia, el aviso va al titular.
    const destinatario = socio.titularFamilia || socio

    // IDs cuyas cuotas vencidas se incluirán: si el destinatario es titular,
    // se consolida toda la familia (titular + miembros). Si es socio único,
    // solo el suyo.
    let socioIdsDeuda = [destinatario.id]
    if (destinatario.id === socio.id && socio.miembrosFamilia?.length > 0) {
      socioIdsDeuda = [socio.id, ...socio.miembrosFamilia.map(m => m.id)]
    } else if (destinatario.id !== socio.id) {
      // Caso: nos llegó un miembro, pero el destinatario será el titular.
      // Buscar todos los miembros del grupo del titular para consolidar deuda.
      const grupo = await prisma.socio.findMany({
        where: { OR: [{ id: destinatario.id }, { titularFamiliaId: destinatario.id }] },
        select: { id: true },
      })
      socioIdsDeuda = grupo.map(s => s.id)
    }

    const cuotasVencidas = await prisma.cargo.findMany({
      where: {
        socioId: { in: socioIdsDeuda },
        estado: 'PENDIENTE',
        fechaVencimiento: { lt: new Date() },
      },
      orderBy: { fechaVencimiento: 'asc' },
    })

    if (cuotasVencidas.length === 0) {
      return
    }

    const totalAdeudado = cuotasVencidas.reduce((sum, c) => sum + Number(c.montoTotal), 0)

    const metadata = {
      socioNombre: destinatario.apellidoNombre,
      nroSocio: destinatario.nroSocio,
      cantidadCuotas: cuotasVencidas.length.toString(),
      totalAdeudado: totalAdeudado.toFixed(2),
      linkPortal: `${await getTenantUrl(destinatario.tenantId)}/portal-socio/${await ensurePortalToken(destinatario)}`,
      cuotas: cuotasVencidas.map((c) => ({
        descripcion: c.descripcion,
        monto: c.montoTotal.toString(),
        vencimiento: new Date(c.fechaVencimiento).toLocaleDateString('es-AR'),
      })),
    }

    // Email (al titular si aplica)
    if (destinatario.email && destinatario.notifEmail !== false) {
      await programarNotificacion({
        tenantId: destinatario.tenantId,
        tipo: 'EMAIL',
        eventType: 'MOROSIDAD',
        destinatario: destinatario.email,
        socioId: destinatario.id,
        cargoId: null,
        asunto: `Recordatorio de pago - ${cuotasVencidas.length} cuota(s) pendiente(s)`,
        cuerpo: null,
        fechaProgramado: new Date(),
        metadata,
      })
    }

    // WhatsApp (al titular si aplica)
    if (destinatario.notifWhatsapp && obtenerTelefonoSocio(destinatario)) {
      const db = createTenantPrisma(destinatario.tenantId)
      db.configuracion.findFirst({ where: { clave: 'WHATSAPP_NOTIF_MORA' } })
        .then(flag => {
          if (flag?.valor !== 'false') {
            notifWaMora({
              db,
              socio: destinatario,
              deuda: { total: totalAdeudado },
            }).catch(err => console.error('Error WA morosidad:', err.message))
          }
        })
        .catch(err => console.error('Error leyendo flag WA mora:', err.message))
    }

    console.log(`Notificado: Morosidad para ${destinatario.apellidoNombre} (${cuotasVencidas.length} cuotas, grupo de ${socioIdsDeuda.length})`)
  } catch (error) {
    console.error('Error notificando morosidad:', error.message)
  }
}

/**
 * Notificar confirmación de inscripción
 */
export async function notificarInscripcionConfirmada(inscripcionId) {
  try {
    const inscripcion = await prisma.inscripcion.findUnique({
      where: { id: inscripcionId },
      include: {
        socio: true,
        categoriaActividad: {
          include: {
            actividad: true,
          },
        },
      },
    })

    if (!inscripcion || !inscripcion.socio.email || !inscripcion.socio.notificarInscripcion) {
      return
    }

    const metadata = {
      socioNombre: inscripcion.socio.apellidoNombre,
      nroSocio: inscripcion.socio.nroSocio,
      actividad: inscripcion.categoriaActividad.actividad.nombre,
      categoria: inscripcion.categoriaActividad.nombre,
      fechaInicio: new Date(inscripcion.fechaInicio).toLocaleDateString('es-AR'),
      linkPortal: `${await getTenantUrl(inscripcion.socio.tenantId)}/portal-socio/${await ensurePortalToken(inscripcion.socio)}`,
    }

    await programarNotificacion({
      tenantId: inscripcion.socio.tenantId,
      tipo: 'EMAIL',
      eventType: 'INSCRIPCION_CONFIRMADA',
      destinatario: inscripcion.socio.email,
      socioId: inscripcion.socio.id,
      cargoId: null,
      asunto: `Confirmación de inscripción - ${inscripcion.categoriaActividad.actividad.nombre}`,
      cuerpo: null,
      fechaProgramado: new Date(),
      metadata,
    })

    console.log(`📧 Programado: Inscripción confirmada para ${inscripcion.socio.apellidoNombre}`)
  } catch (error) {
    console.error('Error notificando inscripción:', error.message)
  }
}

/**
 * Notificar bienvenida a nuevo socio
 */
export async function notificarBienvenida(socioId) {
  try {
    const socio = await prisma.socio.findUnique({
      where: { id: socioId },
      include: {
        categoriaSocioRel: true,
        tipoSocioRel: true,
      },
    })

    if (!socio || !socio.email) {
      return
    }

    const metadata = {
      socioNombre: socio.apellidoNombre,
      nroSocio: socio.nroSocio,
      fechaAlta: socio.fechaAlta ? new Date(socio.fechaAlta).toLocaleDateString('es-AR') : new Date().toLocaleDateString('es-AR'),
      linkPortal: `${await getTenantUrl(socio.tenantId)}/portal-socio/${await ensurePortalToken(socio)}`,
      linkMiQR: `${await getTenantUrl(socio.tenantId)}/mi-qr`,
    }

    await programarNotificacion({
      tenantId: socio.tenantId,
      tipo: 'EMAIL',
      eventType: 'BIENVENIDA',
      destinatario: socio.email,
      socioId: socio.id,
      cargoId: null,
      asunto: '¡Bienvenido al Club Sportivo Pilar!',
      cuerpo: null,
      fechaProgramado: new Date(),
      metadata,
    })

    console.log(`📧 Programado: Bienvenida para ${socio.apellidoNombre}`)
  } catch (error) {
    console.error('Error notificando bienvenida:', error.message)
  }
}

// ============================================================================
// VERIFICACIÓN DE CUOTAS PARA NOTIFICAR
// ============================================================================

/**
 * Buscar cuotas que vencen en 5 días y notificar
 */
export async function verificarCuotasProximasVencer() {
  const pausados = await getTenantsBloqueadosPorCron('CUOTAS_PROXIMAS')
  const tenants = await prisma.tenant.findMany({
    where: { activo: true, ...(pausados.length > 0 ? { id: { notIn: pausados } } : {}) },
  })
  let total = 0

  for (const tenant of tenants) {
    try {
      const db = createTenantPrisma(tenant.id)

      // Días antes del vencimiento, configurable por tenant (default 5)
      const cfgDias = await db.configuracion.findFirst({ where: { clave: 'CUOTAS_PROXIMAS_DIAS' } })
      const dias = parseInt(cfgDias?.valor || '5')

      const fechaInicio = new Date()
      fechaInicio.setDate(fechaInicio.getDate() + dias)
      fechaInicio.setHours(0, 0, 0, 0)
      const fechaFin = new Date(fechaInicio)
      fechaFin.setHours(23, 59, 59, 999)

      const cuotas = await db.cargo.findMany({
        where: {
          estado: 'PENDIENTE',
          fechaVencimiento: { gte: fechaInicio, lte: fechaFin },
          socioId: { not: null },
        },
        include: { socio: true },
      })

      for (const cargo of cuotas) {
        const yaNotificado = await db.notificacionLog.findFirst({
          where: { eventType: 'CUOTA_PROX_VENCER', cargoId: cargo.id, enviado: true },
        })
        if (yaNotificado) continue

        await notificarCuotaProximaVencer(cargo)
        total++
      }

      console.log(`📬 [Cuotas Próximas] Tenant ${tenant.id}: ${cuotas.length} cuotas en ${dias}d`)
    } catch (err) {
      console.error(`[Cuotas Próximas] Error tenant ${tenant.id}:`, err.message)
    }
  }

  return total
}

/**
 * Buscar cuotas vencidas hoy y notificar
 */
export async function verificarCuotasVencidasHoy() {
  try {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    const manana = new Date()
    manana.setDate(manana.getDate() + 1)
    manana.setHours(0, 0, 0, 0)

    const pausados = await getTenantsBloqueadosPorCron('CUOTAS_VENCIDAS')
    const cuotas = await prisma.cargo.findMany({
      where: {
        estado: 'PENDIENTE',
        fechaVencimiento: {
          gte: hoy,
          lt: manana,
        },
        socioId: { not: null },
        ...(pausados.length > 0 ? { tenantId: { notIn: pausados } } : {}),
      },
      include: {
        socio: true,
      },
    })

    console.log(`🔍 Encontradas ${cuotas.length} cuotas que vencen hoy`)

    for (const cargo of cuotas) {
      const yaNotificado = await prisma.notificacionLog.findFirst({
        where: {
          eventType: 'CUOTA_VENCIDA',
          cargoId: cargo.id,
          enviado: true,
        },
      })

      if (!yaNotificado) {
        await notificarCuotaVencida(cargo)
      }
    }

    return cuotas.length
  } catch (error) {
    console.error('Error verificando cuotas vencidas hoy:', error.message)
    throw error
  }
}

/**
 * Verificar socios con morosidad (cuotas vencidas hace más de 15 días)
 */
export async function verificarMorosidad() {
  try {
    const hace15Dias = new Date()
    hace15Dias.setDate(hace15Dias.getDate() - 15)

    const pausados = await getTenantsBloqueadosPorCron('MOROSIDAD_RECORDATORIO')
    // Buscar SOLO titulares (o socios únicos) cuyo grupo tenga cuotas vencidas hace más de 15 días.
    // Excluimos miembros de grupo familiar para no notificar al titular varias veces.
    const sociosConMorosidad = await prisma.socio.findMany({
      where: {
        estadoSocioRel: { esSocioActivo: true },
        titularFamiliaId: null, // solo titulares o socios únicos
        OR: [
          {
            cargos: {
              some: {
                estado: 'PENDIENTE',
                fechaVencimiento: { lt: hace15Dias },
              },
            },
          },
          {
            miembrosFamilia: {
              some: {
                cargos: {
                  some: {
                    estado: 'PENDIENTE',
                    fechaVencimiento: { lt: hace15Dias },
                  },
                },
              },
            },
          },
        ],
        ...(pausados.length > 0 ? { tenantId: { notIn: pausados } } : {}),
      },
      select: { id: true },
    })

    console.log(`🔍 Encontrados ${sociosConMorosidad.length} titulares con morosidad`)

    for (const socio of sociosConMorosidad) {
      // Verificar que no se haya notificado en los últimos 15 días
      const ultimaNotificacion = await prisma.notificacionLog.findFirst({
        where: {
          eventType: 'MOROSIDAD',
          socioId: socio.id,
          enviado: true,
          fechaEnvio: {
            gte: hace15Dias,
          },
        },
        orderBy: {
          fechaEnvio: 'desc',
        },
      })

      if (!ultimaNotificacion) {
        await notificarMorosidad(socio.id)
      }
    }

    return sociosConMorosidad.length
  } catch (error) {
    console.error('Error verificando morosidad:', error.message)
    throw error
  }
}

// ============================================================================
// NOTIFICACIONES DEPORTIVAS
// ============================================================================

/**
 * Notificar convocatoria a partido
 */
export async function notificarConvocatoriaPartido(partidoId, socioId) {
  try {
    const [partido, socio] = await Promise.all([
      prisma.partido.findUnique({
        where: { id: partidoId },
        include: {
          categoriaActividad: {
            include: { actividad: true }
          }
        }
      }),
      prisma.socio.findUnique({
        where: { id: socioId },
        select: {
          id: true, email: true, apellidoNombre: true, nroSocio: true, tokenPortal: true,
          notificarConvocatoria: true
        }
      })
    ])

    if (!partido || !socio || !socio.email) {
      return
    }

    // Respetar preferencia del socio
    if (!socio.notificarConvocatoria) {
      console.log(`⏭️ Socio ${socio.apellidoNombre} tiene desactivadas notificaciones de convocatoria`)
      return
    }

    const fechaPartido = new Date(partido.fecha)
    const metadata = {
      socioNombre: socio.apellidoNombre,
      nroSocio: socio.nroSocio,
      actividad: partido.categoriaActividad?.actividad?.nombre || 'Actividad',
      categoria: partido.categoriaActividad?.nombre || '',
      rival: partido.rival || 'Por definir',
      fecha: fechaPartido.toLocaleDateString('es-AR'),
      hora: partido.hora || '',
      lugar: partido.lugar || '',
      esLocal: partido.esLocal ? 'LOCAL' : 'VISITANTE',
      linkPortal: `${await getTenantUrl(socio.tenantId)}/portal-socio/${await ensurePortalToken(socio)}`,
    }

    await programarNotificacion({
      tenantId: socio.tenantId,
      tipo: 'EMAIL',
      eventType: 'CONVOCATORIA_PARTIDO',
      destinatario: socio.email,
      socioId: socio.id,
      asunto: `Convocatoria: ${partido.rival || 'Partido'} - ${fechaPartido.toLocaleDateString('es-AR')}`,
      fechaProgramado: new Date(),
      metadata,
    })

    console.log(`📧 Programado: Convocatoria partido para ${socio.apellidoNombre}`)
  } catch (error) {
    console.error('Error notificando convocatoria:', error.message)
  }
}

/**
 * Notificar recordatorio de partido (24h antes)
 */
export async function notificarRecordatorioPartido(partidoId, socioId) {
  try {
    const [partido, socio] = await Promise.all([
      prisma.partido.findUnique({
        where: { id: partidoId },
        include: {
          categoriaActividad: {
            include: { actividad: true }
          }
        }
      }),
      prisma.socio.findUnique({
        where: { id: socioId },
        select: {
          id: true, email: true, apellidoNombre: true,
          notificarRecordatorioPartido: true
        }
      })
    ])

    if (!partido || !socio || !socio.email) {
      return
    }

    // Respetar preferencia del socio
    if (!socio.notificarRecordatorioPartido) {
      console.log(`⏭️ Socio ${socio.apellidoNombre} tiene desactivado recordatorio de partidos`)
      return
    }

    const fechaPartido = new Date(partido.fecha)
    const metadata = {
      socioNombre: socio.apellidoNombre,
      actividad: partido.categoriaActividad?.actividad?.nombre || 'Actividad',
      rival: partido.rival || 'Por definir',
      fecha: fechaPartido.toLocaleDateString('es-AR'),
      hora: partido.hora || '',
      lugar: partido.lugar || '',
      esLocal: partido.esLocal ? 'LOCAL' : 'VISITANTE',
    }

    await programarNotificacion({
      tenantId: socio.tenantId,
      tipo: 'EMAIL',
      eventType: 'RECORDATORIO_PARTIDO',
      destinatario: socio.email,
      socioId: socio.id,
      asunto: `Recordatorio: Partido mañana vs ${partido.rival || 'rival'}`,
      fechaProgramado: new Date(),
      metadata,
    })

    console.log(`📧 Programado: Recordatorio partido para ${socio.apellidoNombre}`)
  } catch (error) {
    console.error('Error notificando recordatorio partido:', error.message)
  }
}

/**
 * Verificar partidos de mañana y notificar convocados
 */
export async function verificarPartidosProximos() {
  try {
    const manana = new Date()
    manana.setDate(manana.getDate() + 1)
    manana.setHours(0, 0, 0, 0)

    const pasadoManana = new Date()
    pasadoManana.setDate(pasadoManana.getDate() + 2)
    pasadoManana.setHours(0, 0, 0, 0)

    const pausados = await getTenantsBloqueadosPorCron('PARTIDOS_PROXIMOS')
    // Buscar partidos de mañana que no estén cancelados
    const partidos = await prisma.partido.findMany({
      where: {
        fecha: {
          gte: manana,
          lt: pasadoManana,
        },
        estado: {
          notIn: ['CANCELADO', 'SUSPENDIDO']
        },
        ...(pausados.length > 0 ? { tenantId: { notIn: pausados } } : {}),
      },
      include: {
        convocados: {
          where: {
            confirmado: true
          },
          include: {
            socio: true
          }
        }
      }
    })

    console.log(`🔍 Encontrados ${partidos.length} partidos para mañana`)

    let notificacionesEnviadas = 0

    for (const partido of partidos) {
      for (const convocatoria of partido.convocados) {
        // Verificar que no se haya notificado ya
        const yaNotificado = await prisma.notificacionLog.findFirst({
          where: {
            eventType: 'RECORDATORIO_PARTIDO',
            socioId: convocatoria.socioId,
            metadata: {
              contains: `"partidoId":${partido.id}`
            },
            enviado: true,
          },
        })

        if (!yaNotificado && convocatoria.socio?.email) {
          await notificarRecordatorioPartido(partido.id, convocatoria.socioId)
          notificacionesEnviadas++
        }
      }
    }

    return notificacionesEnviadas
  } catch (error) {
    console.error('Error verificando partidos próximos:', error.message)
    throw error
  }
}

/**
 * Notificar nuevo entrenamiento a todos los inscriptos de la categoría
 */
export async function notificarNuevoEntrenamiento(entrenamientoId) {
  try {
    const entrenamiento = await prisma.entrenamiento.findUnique({
      where: { id: entrenamientoId },
      include: {
        categoriaActividad: {
          include: {
            actividad: true,
            inscripciones: {
              where: {
                estado: 'ACTIVA',
                fechaFin: null
              },
              include: {
                socio: {
                  select: {
                    id: true, email: true, apellidoNombre: true,
                    notificarNuevoEntrenamiento: true
                  }
                }
              }
            }
          }
        },
        espacio: true
      }
    })

    if (!entrenamiento) return 0

    const fechaEntr = new Date(entrenamiento.fecha)
    let notificados = 0
    let omitidos = 0

    for (const inscripcion of entrenamiento.categoriaActividad?.inscripciones || []) {
      if (!inscripcion.socio?.email) continue

      // Respetar preferencia del socio
      if (!inscripcion.socio.notificarNuevoEntrenamiento) {
        omitidos++
        continue
      }

      const metadata = {
        socioNombre: inscripcion.socio.apellidoNombre,
        actividad: entrenamiento.categoriaActividad?.actividad?.nombre || '',
        categoria: entrenamiento.categoriaActividad?.nombre || '',
        fecha: fechaEntr.toLocaleDateString('es-AR'),
        hora: entrenamiento.horaInicio || '',
        espacio: entrenamiento.espacio?.nombre || '',
        observaciones: entrenamiento.observaciones || '',
      }

      await programarNotificacion({
        tenantId: inscripcion.socio.tenantId,
        tipo: 'EMAIL',
        eventType: 'NUEVO_ENTRENAMIENTO',
        destinatario: inscripcion.socio.email,
        socioId: inscripcion.socio.id,
        asunto: `Nuevo entrenamiento programado - ${fechaEntr.toLocaleDateString('es-AR')}`,
        fechaProgramado: new Date(),
        metadata,
      })

      // WhatsApp
      const telefono = obtenerTelefonoSocio(inscripcion.socio)
      if (telefono && inscripcion.socio.notifWhatsapp) {
        const texto = `📅 *Nuevo entrenamiento programado*\n` +
          `${metadata.actividad} - ${metadata.categoria}\n` +
          `Fecha: ${metadata.fecha} a las ${metadata.hora}\n` +
          (metadata.espacio ? `Lugar: ${metadata.espacio}\n` : '') +
          (metadata.observaciones ? `Observaciones: ${metadata.observaciones}` : '')
        await enviarWhatsApp({ db: prisma, telefono, texto }).catch(() => {})
      }

      notificados++
    }

    console.log(`📧 Nuevo entrenamiento: ${notificados} notificados, ${omitidos} omitidos por preferencia`)
    return notificados
  } catch (error) {
    console.error('Error notificando nuevo entrenamiento:', error.message)
    return 0
  }
}

/**
 * Notificar cancelación de entrenamiento a inscriptos
 * @param {number} entrenamientoId
 * @param {object} db - Prisma tenant-scoped
 */
export async function notificarCancelacionEntrenamiento(entrenamientoId, db) {
  try {
    const entrenamiento = await db.entrenamiento.findUnique({
      where: { id: entrenamientoId },
      include: {
        categoriaActividad: {
          include: {
            actividad: true,
            inscripciones: {
              where: { estado: 'ACTIVA', fechaFin: null },
              include: {
                socio: {
                  select: {
                    id: true, email: true, celular: true, telefono: true,
                    apellidoNombre: true, notifWhatsapp: true,
                    notificarNuevoEntrenamiento: true
                  }
                }
              }
            }
          }
        },
        espacio: true
      }
    })

    if (!entrenamiento) return 0

    const fechaEntr = new Date(entrenamiento.fecha)
    let notificados = 0

    for (const inscripcion of entrenamiento.categoriaActividad?.inscripciones || []) {
      const socio = inscripcion.socio
      if (!socio) continue
      if (!inscripcion.socio.notificarNuevoEntrenamiento) continue

      const metadata = {
        socioNombre: socio.apellidoNombre,
        actividad: entrenamiento.categoriaActividad?.actividad?.nombre || '',
        categoria: entrenamiento.categoriaActividad?.nombre || '',
        fecha: fechaEntr.toLocaleDateString('es-AR'),
        hora: entrenamiento.horaInicio || '',
        espacio: entrenamiento.espacio?.nombre || '',
        motivo: entrenamiento.motivoCancelacion || '',
      }

      // Email
      if (socio.email) {
        await programarNotificacion({
          tenantId: socio.tenantId,
          tipo: 'EMAIL',
          eventType: 'CANCELACION_ENTRENAMIENTO',
          destinatario: socio.email,
          socioId: socio.id,
          asunto: `Entrenamiento cancelado - ${fechaEntr.toLocaleDateString('es-AR')}`,
          fechaProgramado: new Date(),
          metadata,
        })
      }

      // WhatsApp
      const telefono = obtenerTelefonoSocio(socio)
      if (telefono && socio.notifWhatsapp) {
        const texto = `❌ *Entrenamiento cancelado*\n` +
          `${metadata.actividad} - ${metadata.categoria}\n` +
          `Fecha: ${metadata.fecha} a las ${metadata.hora}\n` +
          (metadata.motivo ? `Motivo: ${metadata.motivo}` : '')
        await enviarWhatsApp({ db, telefono, texto }).catch(() => {})
      }

      notificados++
    }

    console.log(`🚫 Cancelación entrenamiento: ${notificados} notificados`)
    return notificados
  } catch (error) {
    console.error('Error notificando cancelación entrenamiento:', error.message)
    return 0
  }
}

/**
 * Notificar pasaje de categoría a padres/tutores o al socio
 * @param {number} socioId - ID del socio
 * @param {string} categoriaAnterior - Nombre de la categoría anterior
 * @param {string} categoriaNueva - Nombre de la nueva categoría
 * @param {string} actividad - Nombre de la actividad
 */
export async function notificarPasajeCategoria(socioId, categoriaAnterior, categoriaNueva, actividad) {
  try {
    const socio = await prisma.socio.findUnique({
      where: { id: socioId },
      select: {
        id: true,
        apellidoNombre: true,
        email: true,
        fechaNacimiento: true,
        grupoFamiliar: {
          include: {
            titular: { select: { email: true, apellidoNombre: true } }
          }
        }
      }
    })

    if (!socio) return 0

    // Calcular edad para determinar si es menor
    let esMenor = false
    if (socio.fechaNacimiento) {
      const edad = Math.floor((new Date() - new Date(socio.fechaNacimiento)) / (365.25 * 24 * 60 * 60 * 1000))
      esMenor = edad < 18
    }

    // Determinar destinatario: si es menor, notificar al titular del grupo familiar
    let destinatarioEmail = socio.email
    let destinatarioNombre = socio.apellidoNombre

    if (esMenor && socio.grupoFamiliar?.titular) {
      destinatarioEmail = socio.grupoFamiliar.titular.email
      destinatarioNombre = socio.grupoFamiliar.titular.apellidoNombre
    }

    if (!destinatarioEmail) return 0

    const metadata = {
      socioNombre: socio.apellidoNombre,
      categoriaAnterior,
      categoriaNueva,
      actividad,
      destinatarioNombre,
    }

    await programarNotificacion({
      tenantId: socio.tenantId,
      tipo: 'EMAIL',
      eventType: 'PASAJE_CATEGORIA',
      destinatario: destinatarioEmail,
      socioId: socio.id,
      asunto: `Cambio de categoría - ${socio.apellidoNombre}`,
      fechaProgramado: new Date(),
      metadata,
    })

    console.log(`📧 Programado: Notificación pasaje categoría para ${socio.apellidoNombre}`)
    return 1
  } catch (error) {
    console.error('Error notificando pasaje categoría:', error.message)
    return 0
  }
}

// ============================================================================
// ALERTA DE BAJA ASISTENCIA
// ============================================================================

/**
 * Verifica socios con baja asistencia en todos los tenants activos.
 * Envía un email resumen al EMAIL_CONTACTO de cada tenant con la lista de afectados.
 */
export async function verificarBajaAsistencia() {
  const pausados = await getTenantsConCronsPausados()
  const tenants = await prisma.tenant.findMany({
    where: { estado: 'ACTIVE', ...(pausados.length > 0 ? { id: { notIn: pausados } } : {}) },
    select: { id: true, nombre: true, subdomain: true, dominioCustom: true }
  })

  let totalAlertas = 0

  for (const tenant of tenants) {
    try {
      const db = createTenantPrisma(tenant.id)
      const alertas = await _detectarBajaAsistenciaTenant(db, tenant.id)
      if (alertas.length > 0) {
        await _enviarResumenBajaAsistencia(db, tenant, alertas)
        totalAlertas += alertas.length
      }
    } catch (err) {
      console.error(`Error verificando baja asistencia para tenant ${tenant.id}:`, err.message)
    }
  }

  return totalAlertas
}

async function _detectarBajaAsistenciaTenant(db, tenantId) {
  // Leer config
  const claves = ['ALERTA_BAJA_ASISTENCIA_ACTIVO', 'ALERTA_BAJA_ASISTENCIA_PCT', 'ALERTA_BAJA_ASISTENCIA_DIAS']
  const configs = await db.configuracion.findMany({ where: { clave: { in: claves } } })
  const cfg = Object.fromEntries(configs.map(c => [c.clave, c.valor]))

  if (cfg['ALERTA_BAJA_ASISTENCIA_ACTIVO'] !== 'true') return []

  const umbralPct = parseFloat(cfg['ALERTA_BAJA_ASISTENCIA_PCT'] || '50')
  const dias = parseInt(cfg['ALERTA_BAJA_ASISTENCIA_DIAS'] || '30')

  const fechaDesde = new Date()
  fechaDesde.setDate(fechaDesde.getDate() - dias)
  fechaDesde.setHours(0, 0, 0, 0)

  // Inscripciones activas con socio + categoría
  const inscripciones = await db.inscripcion.findMany({
    where: { estado: 'ACTIVA', fechaFin: null },
    include: {
      socio: { select: { id: true, nroSocio: true, apellidoNombre: true, email: true } },
      categoriaActividad: {
        select: {
          id: true, nombre: true,
          actividad: { select: { nombre: true } }
        }
      }
    }
  })

  const alertas = []

  for (const insc of inscripciones) {
    const catId = insc.categoriaActividadId

    // Entrenamientos realizados (no cancelados) en el período
    const totalEntrenamientos = await db.entrenamiento.count({
      where: {
        categoriaActividadId: catId,
        fecha: { gte: fechaDesde },
        estado: { not: 'CANCELADO' }
      }
    })

    if (totalEntrenamientos === 0) continue

    // Asistencias PRESENTE del socio en esos entrenamientos
    const presentes = await db.asistencia.count({
      where: {
        socioId: insc.socioId,
        estado: 'PRESENTE',
        entrenamiento: {
          categoriaActividadId: catId,
          fecha: { gte: fechaDesde },
          estado: { not: 'CANCELADO' }
        }
      }
    })

    const pct = Math.round((presentes / totalEntrenamientos) * 100)

    if (pct < umbralPct) {
      alertas.push({
        socio: insc.socio,
        actividad: `${insc.categoriaActividad.actividad.nombre} - ${insc.categoriaActividad.nombre}`,
        presentes,
        totalEntrenamientos,
        pct,
        umbral: umbralPct,
        dias,
      })
    }
  }

  return alertas
}

async function _enviarResumenBajaAsistencia(db, tenant, alertas) {
  const { enviarEmail, getMailConfig } = await import('./email.js')
  const mailConfig = await getMailConfig(db)
  if (!mailConfig.emailContacto) return

  const filas = alertas.map(a =>
    `<tr>
      <td style="padding:6px 12px;border-bottom:1px solid #eee">${a.socio.nroSocio || '-'}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee">${a.socio.apellidoNombre}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee">${a.actividad}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:center">${a.presentes}/${a.totalEntrenamientos}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:center;color:${a.pct < 30 ? '#dc2626' : '#d97706'};font-weight:bold">${a.pct}%</td>
    </tr>`
  ).join('')

  const html = `
    <h2 style="color:#1f2937">Alerta: Socios con Baja Asistencia</h2>
    <p style="color:#6b7280">Período analizado: últimos ${alertas[0].dias} días · Umbral: ${alertas[0].umbral}%</p>
    <table style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:14px">
      <thead>
        <tr style="background:#f3f4f6">
          <th style="padding:8px 12px;text-align:left">N° Socio</th>
          <th style="padding:8px 12px;text-align:left">Nombre</th>
          <th style="padding:8px 12px;text-align:left">Actividad</th>
          <th style="padding:8px 12px;text-align:center">Asistencias</th>
          <th style="padding:8px 12px;text-align:center">%</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>
    <p style="color:#9ca3af;font-size:12px;margin-top:20px">Generado automáticamente por Clubix</p>
  `

  await enviarEmail({
    to: mailConfig.emailContacto,
    subject: `[Clubix] ${alertas.length} socio${alertas.length > 1 ? 's' : ''} con baja asistencia`,
    html,
    db,
  })
}

// ============================================================================
// AUTOMATIZACIÓN DE COMUNICACIONES
// ============================================================================

/**
 * Enviar saludos de cumpleaños - itera todos los tenants activos
 * Se ejecuta diariamente
 */
export async function enviarSaludosCumpleanios() {
  const pausados = await getTenantsConCronsPausados()
  const tenants = await prisma.tenant.findMany({
    where: { activo: true, ...(pausados.length > 0 ? { id: { notIn: pausados } } : {}) }
  })
  let total = 0
  for (const tenant of tenants) {
    try {
      const db = createTenantPrisma(tenant.id)
      const cfg = await db.configuracion.findFirst({ where: { clave: 'CUMPLEANIOS_ACTIVO' } })
      if (cfg?.valor !== 'true') continue
      total += await _enviarCumpleaniosTenant(db)
    } catch (err) {
      console.error(`[Cumpleaños] Error tenant ${tenant.id}:`, err.message)
    }
  }
  return total
}

async function _enviarCumpleaniosTenant(db) {
  const hoy = new Date()
  const mes = hoy.getMonth() + 1
  const dia = hoy.getDate()

  const socios = await db.socio.findMany({
    where: { estadoSocioRel: { esSocioActivo: true }, fechaNacimiento: { not: null } },
    select: {
      id: true, tenantId: true, apellidoNombre: true, nroSocio: true,
      tokenPortal: true, email: true,
      celular: true, celularSecundario: true, telefonoFijo: true,
      fechaNacimiento: true, notifEmail: true, notifWhatsapp: true,
    }
  })

  const cumpleanieros = socios.filter(s => {
    const fn = new Date(s.fechaNacimiento)
    return fn.getMonth() + 1 === mes && fn.getDate() === dia
  })

  if (cumpleanieros.length === 0) return 0

  const cfgMensaje = await db.configuracion.findFirst({ where: { clave: 'CUMPLEANIOS_MENSAJE' } })
  const mensajeTpl = cfgMensaje?.valor || 'Feliz cumpleaños, {nombre}! El club te desea un excelente día.'

  const inicioHoy = new Date(hoy)
  inicioHoy.setHours(0, 0, 0, 0)

  const { enviarEmail: _enviarEmail } = await import('./email.js')
  let enviados = 0

  for (const socio of cumpleanieros) {
    const yaEnviado = await db.notificacionLog.findFirst({
      where: { socioId: socio.id, eventType: 'CUMPLEANIOS', createdAt: { gte: inicioHoy } }
    })
    if (yaEnviado) continue

    const variables = await buildVariablesSocio(socio)
    // Soporta tanto {var} como {{var}} (template legacy usaba 1 sola llave)
    const mensaje = mensajeTpl
      .replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? '')
      .replace(/\{(\w+)\}/g, (_, key) => variables[key] ?? '')
    const html = `<p style="font-family:sans-serif;font-size:16px;color:#374151">${mensaje}</p>`

    let enviado = false

    if (socio.email && socio.notifEmail !== false) {
      try {
        await _enviarEmail({ to: socio.email, subject: '¡Feliz Cumpleaños!', html, db })
        enviado = true
      } catch (err) {
        console.error(`[Cumpleaños] Error email ${socio.email}:`, err.message)
      }
    }

    if (socio.notifWhatsapp !== false) {
      const tel = obtenerTelefonoSocio(socio)
      if (tel) {
        try {
          await enviarWhatsApp({ db, telefono: tel, texto: mensaje })
          enviado = true
        } catch (err) {
          console.error(`[Cumpleaños] Error WA ${tel}:`, err.message)
        }
      }
    }

    if (enviado) {
      await db.notificacionLog.create({
        data: {
          tipo: 'EMAIL',
          eventType: 'CUMPLEANIOS',
          destinatario: socio.email || obtenerTelefonoSocio(socio) || '-',
          socioId: socio.id,
          asunto: '¡Feliz Cumpleaños!',
          cuerpo: mensaje,
          enviado: true,
          fechaEnvio: new Date(),
          fechaProgramado: new Date(),
          intentos: 1,
        }
      })
      enviados++
      console.log(`🎂 [Cumpleaños] Saludo enviado a ${socio.apellidoNombre}`)
    }
  }

  return enviados
}

/**
 * Recordatorio anticipado de cuotas - configurable por tenant (por defecto D-3)
 * Se ejecuta diariamente
 */
export default {
  programarNotificacion,
  procesarNotificacionesPendientes,
  notificarCuotaProximaVencer,
  notificarCuotaVencida,
  notificarMorosidad,
  notificarInscripcionConfirmada,
  notificarBienvenida,
  verificarCuotasProximasVencer,
  verificarCuotasVencidasHoy,
  verificarMorosidad,
  // Notificaciones deportivas
  notificarConvocatoriaPartido,
  notificarRecordatorioPartido,
  verificarPartidosProximos,
  notificarCancelacionEntrenamiento,
  notificarNuevoEntrenamiento,
  notificarPasajeCategoria,
  // Alertas deportivas
  verificarBajaAsistencia,
  // Automatización de comunicaciones
  enviarSaludosCumpleanios,
}
