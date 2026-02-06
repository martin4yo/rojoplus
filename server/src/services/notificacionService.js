import { PrismaClient } from '@prisma/client'
import nodemailer from 'nodemailer'
import Handlebars from 'handlebars'
import { enviarNotificacionPush } from './webPush.js'

const prisma = new PrismaClient()

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

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

    default:
      return null
  }
}

/**
 * Obtener configuración de modo demo
 */
async function getModoDemo() {
  try {
    const [modoDemo, emailDemo] = await Promise.all([
      prisma.configuracion.findUnique({ where: { clave: 'MODO_DEMO' } }),
      prisma.configuracion.findUnique({ where: { clave: 'EMAIL_DEMO' } }),
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
export async function enviarEmailConTemplate(eventType, to, variables) {
  try {
    // Obtener template de la BD
    const template = await prisma.emailTemplate.findUnique({
      where: { eventType },
    })

    if (!template || !template.isActive) {
      throw new Error(`Template ${eventType} no encontrado o inactivo`)
    }

    // Renderizar subject y body
    const subject = renderTemplate(template.subject, variables)
    const bodyHtml = renderTemplate(template.bodyHtml, variables)

    // Modo demo
    const modoDemo = await getModoDemo()
    let destinatario = to
    let subjectFinal = subject

    if (modoDemo.activo && modoDemo.email) {
      destinatario = modoDemo.email
      subjectFinal = `[DEMO - Para: ${to}] ${subject}`
      console.log(`📧 MODO DEMO: Redirigiendo email de ${to} a ${modoDemo.email}`)
    }

    // Enviar email
    await transporter.sendMail({
      from: `"Club Sportivo Pilar - Rojo Plus" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
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
          // Intentar enviar email
          if (notif.tipo === 'EMAIL') {
            const metadata = notif.metadata ? JSON.parse(notif.metadata) : {}
            await enviarEmailConTemplate(notif.eventType, notif.destinatario, metadata)
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

    if (!socio || !socio.email || !socio.notificarCuotaProxVenc) {
      console.log(`⏭️  Socio ${cargo.socioId} sin email o notificaciones desactivadas`)
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
      linkPortal: `${frontendUrl}/s/${socio.tokenPortal}`,
    }

    await programarNotificacion({
      tipo: 'EMAIL',
      eventType: 'CUOTA_PROX_VENCER',
      destinatario: socio.email,
      socioId: socio.id,
      cargoId: cargo.id,
      asunto: `Recordatorio: Tu cuota vence en ${diasRestantes} días`,
      cuerpo: null, // Se usará el template
      fechaProgramado: new Date(), // Enviar ahora
      metadata,
    })

    console.log(`📧 Programado: Cuota próxima a vencer para ${socio.apellidoNombre}`)
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

    if (!socio || !socio.email || !socio.notificarCuotaVencida) {
      return
    }

    const metadata = {
      socioNombre: socio.apellidoNombre,
      nroSocio: socio.nroSocio,
      cargoDescripcion: cargo.descripcion || 'Cuota mensual',
      montoTotal: cargo.montoTotal.toString(),
      fechaVencimiento: new Date(cargo.fechaVencimiento).toLocaleDateString('es-AR'),
      linkPortal: `${frontendUrl}/s/${socio.tokenPortal}`,
    }

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

    console.log(`📧 Programado: Cuota vencida para ${socio.apellidoNombre}`)
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

    if (!socio || !socio.email || !socio.notificarMorosidad) {
      return
    }

    // Obtener todas las cuotas vencidas
    const cuotasVencidas = await prisma.cargo.findMany({
      where: {
        socioId: socio.id,
        estado: 'PENDIENTE',
        fechaVencimiento: {
          lt: new Date(),
        },
      },
      orderBy: {
        fechaVencimiento: 'asc',
      },
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
      linkPortal: `${frontendUrl}/s/${socio.tokenPortal}`,
      cuotas: cuotasVencidas.map((c) => ({
        descripcion: c.descripcion,
        monto: c.montoTotal.toString(),
        vencimiento: new Date(c.fechaVencimiento).toLocaleDateString('es-AR'),
      })),
    }

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

    console.log(`📧 Programado: Morosidad para ${socio.apellidoNombre} (${cuotasVencidas.length} cuotas)`)
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
      linkPortal: `${frontendUrl}/s/${inscripcion.socio.tokenPortal}`,
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
      linkPortal: `${frontendUrl}/s/${socio.tokenPortal}`,
      linkMiQR: `${frontendUrl}/mi-qr`,
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
}
