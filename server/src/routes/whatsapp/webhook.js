import { Router } from 'express'
import prisma from '../../lib/prisma.js'
import { createTenantPrisma } from '../../lib/tenantPrisma.js'
import { enviarWhatsApp, normalizarNumero, configurarWebhookEvolution } from '../../services/whatsappService.js'

const router = Router()

// Rate limiting simple en memoria: max 5 mensajes por minuto por número
const rateLimits = new Map()

function verificarRateLimit(telefono) {
  const ahora = Date.now()
  const entry = rateLimits.get(telefono)

  if (!entry || ahora > entry.resetAt) {
    rateLimits.set(telefono, { count: 1, resetAt: ahora + 60_000 })
    return true
  }

  if (entry.count >= 5) return false
  entry.count++
  return true
}

// Limpiar rate limits viejos cada 5 minutos
setInterval(() => {
  const ahora = Date.now()
  for (const [key, val] of rateLimits.entries()) {
    if (ahora > val.resetAt) rateLimits.delete(key)
  }
}, 5 * 60 * 1000)

/**
 * POST /api/whatsapp/webhook
 * Recibe mensajes entrantes de Evolution API.
 * Responde 200 inmediatamente y procesa de forma asíncrona.
 */
router.post('/webhook', async (req, res) => {
  // Responder 200 inmediatamente para no bloquear Evolution API
  res.sendStatus(200)

  try {
    const { event, instance, data } = req.body

    console.log(`[WA webhook] Evento recibido: ${event} | instancia: ${instance}`)

    // Solo procesar mensajes entrantes de texto
    if (event !== 'messages.upsert' && event !== 'messages_upsert') {
      console.log(`[WA webhook] Evento ignorado (no es messages.upsert)`)
      return
    }
    if (!data?.key || data.key.fromMe) {
      console.log(`[WA webhook] Ignorado: mensaje propio o sin key`)
      return
    }
    if (data.key.remoteJid?.includes('@g.us')) { console.log(`[WA webhook] Ignorado: grupo`); return }
    if (data.key.remoteJid?.includes('@broadcast')) { console.log(`[WA webhook] Ignorado: broadcast`); return }

    const texto = (
      data?.message?.conversation ||
      data?.message?.extendedTextMessage?.text ||
      ''
    ).trim()

    if (!texto) { console.log(`[WA webhook] Ignorado: sin texto (puede ser imagen, audio, etc.)`); return }

    const telefonoRaw = data.key.remoteJid.replace('@s.whatsapp.net', '')
    const nombreContacto = data.pushName || ''

    console.log(`[WA webhook] Mensaje de ${telefonoRaw} (${nombreContacto}): "${texto}"`)

    // Rate limit
    if (!verificarRateLimit(telefonoRaw)) {
      console.log(`[WA webhook] Rate limit excedido para ${telefonoRaw}`)
      return
    }

    // Buscar el tenant por instanceName (slug) o por config WHATSAPP_INSTANCE
    let tenant = await prisma.tenant.findFirst({
      where: { slug: instance, activo: true }
    })

    if (!tenant) {
      const config = await prisma.configuracion.findFirst({
        where: { clave: 'WHATSAPP_INSTANCE', valor: instance }
      })
      if (!config) {
        console.log(`[WA webhook] Tenant no encontrado para instancia "${instance}"`)
        return
      }
      tenant = await prisma.tenant.findUnique({ where: { id: config.tenantId } })
    }

    if (!tenant) { console.log(`[WA webhook] Tenant no encontrado`); return }

    const tenantId = tenant.id
    console.log(`[WA webhook] Tenant encontrado: ${tenant.nombre} (id=${tenantId})`)

    const db = createTenantPrisma(tenantId)

    // Verificar que el agente esté habilitado para este tenant
    const agentConfig = await db.configuracion.findFirst({
      where: { clave: 'WA_AGENT_ENABLED' }
    })
    if (agentConfig?.valor !== 'true') {
      console.log(`[WA webhook] Agente deshabilitado para tenant ${tenantId}`)
      return
    }

    // Lista blanca: si está configurada, solo responder a esos números
    const whitelistConfig = await db.configuracion.findFirst({
      where: { clave: 'WA_AGENT_WHITELIST' }
    })
    if (whitelistConfig?.valor?.trim()) {
      const whitelist = whitelistConfig.valor.split(',').map(n => n.trim().replace(/\D/g, '')).filter(Boolean)
      const telefonoLimpio = telefonoRaw.replace(/\D/g, '')
      if (!whitelist.some(n => telefonoLimpio.endsWith(n) || n.endsWith(telefonoLimpio))) {
        console.log(`[WA webhook] ${telefonoRaw} no está en la lista blanca, ignorando`)
        return
      }
      console.log(`[WA webhook] Número ${telefonoRaw} autorizado por lista blanca`)
    }

    // Verificar horario de atención del agente
    const horaInicioConfig = await db.configuracion.findFirst({
      where: { clave: 'WA_AGENT_HORARIO_INICIO' }
    })
    const horaFinConfig = await db.configuracion.findFirst({
      where: { clave: 'WA_AGENT_HORARIO_FIN' }
    })

    const horaInicio = parseInt(horaInicioConfig?.valor || '7')
    const horaFin = parseInt(horaFinConfig?.valor || '23')
    const horaActual = new Date().getHours()

    if (horaActual < horaInicio || horaActual >= horaFin) {
      console.log(`[WA webhook] Fuera de horario (${horaActual}h, rango ${horaInicio}-${horaFin})`)
      const msgFueraHorario = await db.configuracion.findFirst({
        where: { clave: 'WA_AGENT_MSG_FUERA_HORARIO' }
      })
      if (msgFueraHorario?.valor) {
        await enviarWhatsApp({ db, telefono: telefonoRaw, texto: msgFueraHorario.valor, ignorarHorario: true })
      }
      return
    }

    // Buscar el socio por número de celular
    const variantes = generarVariantesTelefono(telefonoRaw)
    const socio = await db.socio.findFirst({
      where: { celular: { in: variantes } },
      include: {
        tipoSocioRel: { select: { nombre: true } },
        categoriaSocioRel: { select: { nombre: true } },
      }
    })
    console.log(`[WA webhook] Socio: ${socio ? socio.apellidoNombre : 'no registrado'}`)

    console.log(`[WA webhook] Derivando a agente IA...`)
    // Procesar el mensaje con el agente (importación dinámica para no cargar siempre)
    const { procesarMensajeAgente } = await import('./agente.js')
    await procesarMensajeAgente({
      db,
      tenantId,
      telefono: telefonoRaw,
      nombreContacto,
      texto,
      socio,
    })
    console.log(`[WA webhook] Agente procesó el mensaje de ${telefonoRaw}`)

  } catch (err) {
    console.error('[WhatsApp webhook] Error:', err.message)
  }
})

/**
 * GET /api/whatsapp/status
 * Estado de la conexión WhatsApp del tenant (para el panel admin).
 */
router.get('/status', async (req, res) => {
  try {
    const { verificarConexionWhatsApp } = await import('../../services/whatsappService.js')
    const resultado = await verificarConexionWhatsApp(req.db)
    res.json({ success: true, ...resultado })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/admin/whatsapp/configurar-webhook
 * Registra el webhook en Evolution API apuntando a este backend.
 * Se llama automáticamente al guardar la config de WhatsApp con enabled=true.
 */
router.post('/configurar-webhook', async (req, res) => {
  try {
    const resultado = await configurarWebhookEvolution(req.db)
    if (!resultado.ok) {
      return res.status(400).json({ success: false, error: resultado.motivo })
    }
    res.json({ success: true, webhookUrl: resultado.webhookUrl })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/whatsapp/test
 * Envía un mensaje de prueba (solo admin).
 */
router.post('/test', async (req, res) => {
  try {
    const { telefono, texto } = req.body
    if (!telefono || !texto) {
      return res.status(400).json({ success: false, error: 'Faltan telefono y texto' })
    }

    const { enviarWhatsApp: enviar } = await import('../../services/whatsappService.js')
    const resultado = await enviar({ db: req.db, telefono, texto, ignorarHorario: true })
    res.json({ success: true, ...resultado })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

function generarVariantesTelefono(telefono) {
  const limpio = telefono.replace(/\D/g, '')
  const variantes = new Set()

  variantes.add(limpio)
  variantes.add('+' + limpio)

  if (limpio.startsWith('549') && limpio.length === 13) {
    variantes.add(limpio.slice(3))          // sin código país
    variantes.add('0' + limpio.slice(3))    // con 0 adelante
    variantes.add(limpio.slice(2))          // sin el 9
  }

  if (limpio.startsWith('54') && limpio.length === 12) {
    variantes.add(limpio.slice(2))
    variantes.add('0' + limpio.slice(2))
  }

  return [...variantes]
}

export default router
