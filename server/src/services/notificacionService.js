import prisma from '../lib/prisma.js'
import Handlebars from 'handlebars'
import { enviarNotificacionPush } from './webPush.js'
import { getMailConfig } from './email.js'
import { createTenantPrisma } from '../lib/tenantPrisma.js'
import { notificarVencimiento as notifWaVencimiento, notificarMora as notifWaMora, obtenerTelefonoSocio, enviarWhatsApp, getWhatsAppConfig } from './whatsappService.js'
import { getTenantFrontendUrl } from '../lib/tenantUrl.js'

// Caché simple de URLs por tenantId para no repetir queries en el mismo ciclo de jobs
const _tenantUrlCache = new Map()
async function getTenantUrl(tenantId) {
  if (_tenantUrlCache.has(tenantId)) return _tenantUrlCache.get(tenantId)
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { subdomain: true, dominioCustom: true } })
  const url = getTenantFrontendUrl(tenant)
  _tenantUrlCache.set(tenantId, url)
  return url
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
 * Obtener configuración de modo demo
 */
async function getModoDemo(db) {
  try {
    const client = db || prisma
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
export async function enviarEmailConTemplate(eventType, to, variables, db = null) {
  try {
    const client = db || prisma
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

    // Obtener config SMTP del tenant + modo demo
    const [mailConfig, modoDemo] = await Promise.all([
      getMailConfig(db),
      getModoDemo(db),
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
 * Programar notificación para envío posterior
 */
export async function programarNotificacion({
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
  try {
    const notificacion = await prisma.notificacionLog.create({
      data: {
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

    console.log(`📅 Notificación programada: ${eventType} para ${destinatario} el ${fechaProgramado}`)
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

    // Buscar notificaciones pendientes cuya fecha programada ya pasó
    const notificacionesPendientes = await prisma.notificacionLog.findMany({
      where: {
        enviado: false,
        fechaProgramado: {
          lte: ahora,
        },
        intentos: {
          lt: 3, // Máximo 3 intentos
        },
      },
      include: {
        socio: true,
        cargo: true,
      },
      take: 50, // Procesar máximo 50 por ejecución
    })

    console.log(`📬 Procesando ${notificacionesPendientes.length} notificaciones pendientes...`)

    const resultados = await Promise.allSettled(
      notificacionesPendientes.map(async (notif) => {
        try {
          // Crear cliente scoped al tenant de la notificación
          const tenantDb = notif.tenantId ? createTenantPrisma(notif.tenantId) : null
          // Intentar enviar email
          if (notif.tipo === 'EMAIL') {
            // Respetar preferencia de canal del socio
            if (notif.socio?.notifEmail === false) {
              await prisma.notificacionLog.update({
                where: { id: notif.id },
                data: { enviado: true, fechaEnvio: new Date(), intentos: notif.intentos + 1, error: 'Canal email deshabilitado por el socio' },
              })
              return { success: true, id: notif.id, omitido: true }
            }
            const metadata = notif.metadata ? JSON.parse(notif.metadata) : {}
            await enviarEmailConTemplate(notif.eventType, notif.destinatario, metadata, tenantDb)
          }

          // También enviar push notification si el socio tiene suscripción activa
          if (notif.socioId) {
            try {
              const pushPayload = getPushPayloadForEvent(notif.eventType, notif)
              if (pushPayload) {
                await enviarNotificacionPush(notif.socioId, pushPayload)
              }
            } catch (pushError) {
              console.log(`Push notification no enviada para ${notif.socioId}: ${pushError.message}`)
            }
          }

          // Marcar como enviado
          await prisma.notificacionLog.update({
            where: { id: notif.id },
            data: {
              enviado: true,
              fechaEnvio: new Date(),
              intentos: notif.intentos + 1,
            },
          })

          return { success: true, id: notif.id }
        } catch (error) {
          // Registrar error y aumentar contador de intentos
          await prisma.notificacionLog.update({
            where: { id: notif.id },
            data: {
              error: error.message,
              intentos: notif.intentos + 1,
            },
          })

          return { success: false, id: notif.id, error: error.message }
        }
      })
    )

    const exitosos = resultados.filter((r) => r.status === 'fulfilled' && r.value.success).length
    const fallidos = resultados.filter((r) => r.status === 'rejected' || !r.value.success).length

    console.log(`✅ Notificaciones enviadas: ${exitosos} exitosas, ${fallidos} fallidas`)

    return { exitosos, fallidos, total: notificacionesPendientes.length }
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
      },
    })

    if (!socio || !socio.notificarCuotaProxVenc) {
      return
    }

    const fechaVencimiento = new Date(cargo.fechaVencimiento)
    const diasRestantes = Math.ceil((fechaVencimiento - new Date()) / (1000 * 60 * 60 * 24))

    const metadata = {
      socioNombre: socio.apellidoNombre,
      nroSocio: socio.nroSocio,
      cargoDescripcion: cargo.descripcion || 'Cuota mensual',
      montoTotal: cargo.montoTotal.toString(),
      fechaVencimiento: fechaVencimiento.toLocaleDateString('es-AR'),
      diasRestantes: diasRestantes.toString(),
      linkPortal: `${await getTenantUrl(socio.tenantId)}/portal-socio/${socio.tokenPortal}`,
    }

    // Email
    if (socio.email && socio.notifEmail !== false) {
      await programarNotificacion({
        tipo: 'EMAIL',
        eventType: 'CUOTA_PROX_VENCER',
        destinatario: socio.email,
        socioId: socio.id,
        cargoId: cargo.id,
        asunto: `Recordatorio: Tu cuota vence en ${diasRestantes} días`,
        cuerpo: null,
        fechaProgramado: new Date(),
        metadata,
      })
    }

    // WhatsApp
    if (socio.notifWhatsapp && obtenerTelefonoSocio(socio)) {
      const db = createTenantPrisma(socio.tenantId)
      db.configuracion.findFirst({ where: { clave: 'WHATSAPP_NOTIF_VENCIMIENTO' } })
        .then(flag => {
          if (flag?.valor !== 'false') {
            notifWaVencimiento({
              db,
              socio,
              cuota: { vencimiento: cargo.fechaVencimiento, importe: cargo.montoTotal },
            }).catch(err => console.error('Error WA cuota próx. vencer:', err.message))
          }
        })
        .catch(err => console.error('Error leyendo flag WA vencimiento:', err.message))
    }

    console.log(`Notificado: Cuota próxima a vencer para ${socio.apellidoNombre}`)
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
    })

    if (!socio || !socio.notificarCuotaVencida) {
      return
    }

    const metadata = {
      socioNombre: socio.apellidoNombre,
      nroSocio: socio.nroSocio,
      cargoDescripcion: cargo.descripcion || 'Cuota mensual',
      montoTotal: cargo.montoTotal.toString(),
      fechaVencimiento: new Date(cargo.fechaVencimiento).toLocaleDateString('es-AR'),
      linkPortal: `${await getTenantUrl(socio.tenantId)}/portal-socio/${socio.tokenPortal}`,
    }

    // Email
    if (socio.email && socio.notifEmail !== false) {
      await programarNotificacion({
        tipo: 'EMAIL',
        eventType: 'CUOTA_VENCIDA',
        destinatario: socio.email,
        socioId: socio.id,
        cargoId: cargo.id,
        asunto: 'Tu cuota ha vencido',
        cuerpo: null,
        fechaProgramado: new Date(),
        metadata,
      })
    }

    // WhatsApp
    if (socio.notifWhatsapp && obtenerTelefonoSocio(socio)) {
      const db = createTenantPrisma(socio.tenantId)
      db.configuracion.findFirst({ where: { clave: 'WHATSAPP_NOTIF_VENCIMIENTO' } })
        .then(flag => {
          if (flag?.valor !== 'false') {
            notifWaVencimiento({
              db,
              socio,
              cuota: { vencimiento: cargo.fechaVencimiento, importe: cargo.montoTotal },
            }).catch(err => console.error('Error WA cuota vencida:', err.message))
          }
        })
        .catch(err => console.error('Error leyendo flag WA vencimiento:', err.message))
    }

    console.log(`Notificado: Cuota vencida para ${socio.apellidoNombre}`)
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
    })

    if (!socio || !socio.notificarMorosidad) {
      return
    }

    // Obtener todas las cuotas vencidas
    const cuotasVencidas = await prisma.cargo.findMany({
      where: {
        socioId: socio.id,
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
      socioNombre: socio.apellidoNombre,
      nroSocio: socio.nroSocio,
      cantidadCuotas: cuotasVencidas.length.toString(),
      totalAdeudado: totalAdeudado.toFixed(2),
      linkPortal: `${await getTenantUrl(socio.tenantId)}/portal-socio/${socio.tokenPortal}`,
      cuotas: cuotasVencidas.map((c) => ({
        descripcion: c.descripcion,
        monto: c.montoTotal.toString(),
        vencimiento: new Date(c.fechaVencimiento).toLocaleDateString('es-AR'),
      })),
    }

    // Email
    if (socio.email && socio.notifEmail !== false) {
      await programarNotificacion({
        tipo: 'EMAIL',
        eventType: 'MOROSIDAD',
        destinatario: socio.email,
        socioId: socio.id,
        cargoId: null,
        asunto: `Recordatorio de pago - ${cuotasVencidas.length} cuotas pendientes`,
        cuerpo: null,
        fechaProgramado: new Date(),
        metadata,
      })
    }

    // WhatsApp
    if (socio.notifWhatsapp && obtenerTelefonoSocio(socio)) {
      const db = createTenantPrisma(socio.tenantId)
      db.configuracion.findFirst({ where: { clave: 'WHATSAPP_NOTIF_MORA' } })
        .then(flag => {
          if (flag?.valor !== 'false') {
            notifWaMora({
              db,
              socio,
              deuda: { total: totalAdeudado },
            }).catch(err => console.error('Error WA morosidad:', err.message))
          }
        })
        .catch(err => console.error('Error leyendo flag WA mora:', err.message))
    }

    console.log(`Notificado: Morosidad para ${socio.apellidoNombre} (${cuotasVencidas.length} cuotas)`)
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
      linkPortal: `${await getTenantUrl(inscripcion.socio.tenantId)}/portal-socio/${inscripcion.socio.tokenPortal}`,
    }

    await programarNotificacion({
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
      linkPortal: `${await getTenantUrl(socio.tenantId)}/portal-socio/${socio.tokenPortal}`,
      linkMiQR: `${await getTenantUrl(socio.tenantId)}/mi-qr`,
    }

    await programarNotificacion({
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
  try {
    const cincoDias = new Date()
    cincoDias.setDate(cincoDias.getDate() + 5)
    cincoDias.setHours(0, 0, 0, 0)

    const seisDias = new Date()
    seisDias.setDate(seisDias.getDate() + 6)
    seisDias.setHours(0, 0, 0, 0)

    const cuotas = await prisma.cargo.findMany({
      where: {
        estado: 'PENDIENTE',
        fechaVencimiento: {
          gte: cincoDias,
          lt: seisDias,
        },
        socioId: {
          not: null,
        },
      },
      include: {
        socio: true,
      },
    })

    console.log(`🔍 Encontradas ${cuotas.length} cuotas que vencen en 5 días`)

    for (const cargo of cuotas) {
      // Verificar que no se haya notificado ya
      const yaNotificado = await prisma.notificacionLog.findFirst({
        where: {
          eventType: 'CUOTA_PROX_VENCER',
          cargoId: cargo.id,
          enviado: true,
        },
      })

      if (!yaNotificado) {
        await notificarCuotaProximaVencer(cargo)
      }
    }

    return cuotas.length
  } catch (error) {
    console.error('Error verificando cuotas próximas a vencer:', error.message)
    throw error
  }
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

    const cuotas = await prisma.cargo.findMany({
      where: {
        estado: 'PENDIENTE',
        fechaVencimiento: {
          gte: hoy,
          lt: manana,
        },
        socioId: {
          not: null,
        },
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

    // Buscar socios con cuotas vencidas hace más de 15 días
    const sociosConMorosidad = await prisma.socio.findMany({
      where: {
        estado: 'ACTIVO',
        cargos: {
          some: {
            estado: 'PENDIENTE',
            fechaVencimiento: {
              lt: hace15Dias,
            },
          },
        },
      },
      include: {
        cargos: {
          where: {
            estado: 'PENDIENTE',
            fechaVencimiento: {
              lt: new Date(),
            },
          },
        },
      },
    })

    console.log(`🔍 Encontrados ${sociosConMorosidad.length} socios con morosidad`)

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
      linkPortal: `${await getTenantUrl(socio.tenantId)}/portal-socio/${socio.tokenPortal}`,
    }

    await programarNotificacion({
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

    // Buscar partidos de mañana que no estén cancelados
    const partidos = await prisma.partido.findMany({
      where: {
        fecha: {
          gte: manana,
          lt: pasadoManana,
        },
        estado: {
          notIn: ['CANCELADO', 'SUSPENDIDO']
        }
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
  const tenants = await prisma.tenant.findMany({
    where: { estado: 'ACTIVE' },
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
  const tenants = await prisma.tenant.findMany({ where: { activo: true } })
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
    where: { estado: 'ACTIVO', fechaNacimiento: { not: null } },
    select: {
      id: true, apellidoNombre: true, email: true,
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

    const nombreCorto = socio.apellidoNombre.includes(',')
      ? socio.apellidoNombre.split(',')[1].trim().split(' ')[0]
      : socio.apellidoNombre.split(' ')[0]
    const mensaje = mensajeTpl.replace(/{nombre}/g, nombreCorto)
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
export async function verificarRecordatorioAnticipado() {
  const tenants = await prisma.tenant.findMany({ where: { activo: true } })
  let total = 0

  for (const tenant of tenants) {
    try {
      const db = createTenantPrisma(tenant.id)
      const cfgActivo = await db.configuracion.findFirst({ where: { clave: 'RECORDATORIO_ANTICIPADO_ACTIVO' } })
      if (cfgActivo?.valor !== 'true') continue

      const cfgDias = await db.configuracion.findFirst({ where: { clave: 'RECORDATORIO_ANTICIPADO_DIAS' } })
      const dias = parseInt(cfgDias?.valor || '3')

      const fechaInicio = new Date()
      fechaInicio.setDate(fechaInicio.getDate() + dias)
      fechaInicio.setHours(0, 0, 0, 0)
      const fechaFin = new Date(fechaInicio)
      fechaFin.setHours(23, 59, 59, 999)

      const cargos = await db.cargo.findMany({
        where: {
          estado: 'PENDIENTE',
          fechaVencimiento: { gte: fechaInicio, lte: fechaFin },
          socioId: { not: null },
        },
        include: { socio: true }
      })

      for (const cargo of cargos) {
        const yaNotificado = await db.notificacionLog.findFirst({
          where: { eventType: 'CUOTA_RECORDATORIO', cargoId: cargo.id, enviado: true }
        })
        if (yaNotificado) continue

        await _notificarRecordatorioAnticipado(cargo, dias, db)
        total++
      }

      console.log(`📬 [Recordatorio Anticipado] Tenant ${tenant.id}: ${cargos.length} cuotas próximas en ${dias}d`)
    } catch (err) {
      console.error(`[Recordatorio Anticipado] Error tenant ${tenant.id}:`, err.message)
    }
  }

  return total
}

async function _notificarRecordatorioAnticipado(cargo, dias, db) {
  const socio = cargo.socio
  if (!socio) return

  const { enviarEmail: _enviarEmail } = await import('./email.js')
  const fechaVenc = new Date(cargo.fechaVencimiento).toLocaleDateString('es-AR')
  const monto = Number(cargo.montoTotal).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
  const nombreCorto = socio.apellidoNombre.includes(',')
    ? socio.apellidoNombre.split(',')[1].trim().split(' ')[0]
    : socio.apellidoNombre.split(' ')[0]

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#1f2937">Recordatorio de cuota</h2>
      <p>Hola ${nombreCorto},</p>
      <p>Te recordamos que tu cuota <strong>${cargo.descripcion || 'mensual'}</strong> vence en <strong>${dias} día${dias !== 1 ? 's' : ''}</strong> (${fechaVenc}).</p>
      <p>Importe: <strong>${monto}</strong></p>
      <p style="color:#6b7280;font-size:13px">Podés abonarla desde el portal del socio.</p>
    </div>
  `

  let enviado = false

  if (socio.email && socio.notifEmail !== false) {
    try {
      await _enviarEmail({ to: socio.email, subject: `Recordatorio: tu cuota vence en ${dias} días`, html, db })
      enviado = true
    } catch (err) {
      console.error(`[Recordatorio] Error email ${socio.email}:`, err.message)
    }
  }

  if (socio.notifWhatsapp !== false) {
    const tel = obtenerTelefonoSocio(socio)
    if (tel) {
      try {
        await notifWaVencimiento({ db, socio, cuota: { vencimiento: cargo.fechaVencimiento, importe: cargo.montoTotal } })
        enviado = true
      } catch (err) {
        console.error(`[Recordatorio] Error WA ${tel}:`, err.message)
      }
    }
  }

  if (enviado) {
    await db.notificacionLog.create({
      data: {
        tipo: 'EMAIL',
        eventType: 'CUOTA_RECORDATORIO',
        destinatario: socio.email || obtenerTelefonoSocio(socio) || '-',
        socioId: socio.id,
        cargoId: cargo.id,
        asunto: `Recordatorio: cuota vence en ${dias} días`,
        enviado: true,
        fechaEnvio: new Date(),
        fechaProgramado: new Date(),
        intentos: 1,
      }
    })
  }
}

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
  verificarRecordatorioAnticipado,
}
