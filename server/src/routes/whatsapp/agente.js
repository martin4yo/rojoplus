/**
 * Agente de IA para WhatsApp — multi-proveedor (Anthropic / OpenAI)
 * Se invoca desde webhook.js cuando llega un mensaje entrante.
 *
 * Config del tenant (tabla Configuracion):
 *   AI_PROVIDER       — 'anthropic' | 'openai'  (default: 'anthropic')
 *   AI_MODEL_TIER     — 'rapido' | 'estandar' | 'premium'  (default: 'rapido')
 *   AI_API_KEY        — API key propia del tenant (si no, usa process.env.ANTHROPIC_API_KEY)
 *   AI_MODEL_OVERRIDE — Modelo exacto (vacío = usar tier mapping)
 */

import Anthropic from '@anthropic-ai/sdk'
import { enviarWhatsApp } from '../../services/whatsappService.js'
import { resolverModelo } from '../../config/aiModels.js'

const MAX_MENSAJES_HISTORIAL = 20
const MAX_TOOL_ITERATIONS = 5

// ─── Config de IA por tenant ──────────────────────────────────────────────────

async function cargarConfigIA(db) {
  const claves = ['AI_PROVIDER', 'AI_MODEL_TIER', 'AI_API_KEY', 'AI_MODEL_OVERRIDE']
  const configs = await db.configuracion.findMany({
    where: { clave: { in: claves } }
  }).catch(() => [])

  const cfg = Object.fromEntries(configs.map(c => [c.clave, c.valor]))
  const provider = cfg.AI_PROVIDER || 'anthropic'
  const tier = cfg.AI_MODEL_TIER || 'rapido'
  const override = cfg.AI_MODEL_OVERRIDE || null

  // API key: usa la del tenant, o la global del servidor como fallback
  const apiKey = cfg.AI_API_KEY ||
    (provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY) ||
    null

  return {
    provider,
    model: resolverModelo(provider, tier, override),
    apiKey,
  }
}

// ─── Tools disponibles ────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'consultar_deuda',
    description: 'Obtiene el resumen de deuda del socio: cuotas impagas, total adeudado y fechas de vencimiento.',
    input_schema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'consultar_ultimos_movimientos',
    description: 'Obtiene los últimos movimientos de cuenta del socio (pagos y cargos recientes).',
    input_schema: {
      type: 'object',
      properties: {
        limite: { type: 'number', description: 'Cantidad de movimientos (default 5)' }
      },
      required: []
    }
  },
  {
    name: 'consultar_actividades',
    description: 'Lista las actividades deportivas y sus horarios en las que el socio está inscripto.',
    input_schema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'enviar_link_portal',
    description: 'Genera y envía al socio el link para acceder a su portal personal donde puede ver su cuenta y hacer pagos.',
    input_schema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'info_club',
    description: 'Obtiene información general del club: horarios de atención, dirección, teléfono de contacto.',
    input_schema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'derivar_humano',
    description: 'Usá esta tool cuando no podés resolver la consulta del socio y necesita hablar con una persona.',
    input_schema: {
      type: 'object',
      properties: {
        motivo: { type: 'string', description: 'Breve descripción de la consulta que no pudiste resolver' }
      },
      required: ['motivo']
    }
  }
]

// ─── Handlers de tools ────────────────────────────────────────────────────────

async function ejecutarTool(name, input, { db, socio, tenantId }) {
  switch (name) {

    case 'consultar_deuda': {
      if (!socio) return { error: 'No estás registrado como socio del club.' }
      const cargos = await db.cargo.findMany({
        where: { socioId: socio.id, estado: { in: ['PENDIENTE', 'VENCIDA'] } },
        orderBy: { fechaVencimiento: 'asc' },
        take: 10
      })
      const total = cargos.reduce((acc, c) => acc + Number(c.montoTotal), 0)
      return {
        cuotasImpagas: cargos.length,
        totalDeuda: total,
        cuotas: cargos.map(c => ({
          descripcion: c.descripcion,
          importe: Number(c.montoTotal),
          vencimiento: c.fechaVencimiento ? new Date(c.fechaVencimiento).toLocaleDateString('es-AR') : 'Sin vencimiento',
          estado: c.estado
        }))
      }
    }

    case 'consultar_ultimos_movimientos': {
      if (!socio) return { error: 'No estás registrado como socio del club.' }
      const limite = input.limite || 5
      const pagos = await db.pago.findMany({
        where: { socioId: socio.id },
        orderBy: { fecha: 'desc' },
        take: limite
      }).catch(() => [])
      return {
        movimientos: pagos.map(p => ({
          fecha: new Date(p.fecha).toLocaleDateString('es-AR'),
          concepto: p.concepto || 'Pago',
          importe: Number(p.montoTotal || 0),
          tipo: 'PAGO'
        }))
      }
    }

    case 'consultar_actividades': {
      if (!socio) return { error: 'No estás registrado como socio del club.' }
      const inscripciones = await db.inscripcion.findMany({
        where: { socioId: socio.id, activo: true },
        include: {
          actividad: {
            include: { entrenador: { select: { nombre: true } } }
          }
        }
      }).catch(() => [])
      return {
        actividades: inscripciones.map(i => ({
          actividad: i.actividad?.nombre,
          horario: i.actividad?.horario,
          entrenador: i.actividad?.entrenador?.nombre,
          categoria: i.categoria
        }))
      }
    }

    case 'enviar_link_portal': {
      if (!socio) return { error: 'No estás registrado como socio del club.' }
      try {
        const crypto = await import('crypto')
        const token = crypto.randomBytes(32).toString('hex')
        const expira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

        await db.socio.update({
          where: { id: socio.id },
          data: { tokenPortal: token, tokenPortalExpira: expira }
        })

        const baseUrl = process.env.FRONTEND_URL || 'https://app.clubix.com.ar'
        const link = `${baseUrl}/s/${token}`
        return { link, enviado: true, expira: expira.toLocaleDateString('es-AR') }
      } catch (err) {
        return { error: 'No se pudo generar el link: ' + err.message }
      }
    }

    case 'info_club': {
      const configs = await db.configuracion.findMany({
        where: {
          clave: { in: ['HORARIO_ATENCION', 'TELEFONO_CONTACTO', 'DIRECCION', 'EMAIL_CONTACTO', 'NOMBRE_CLUB'] }
        }
      })
      return Object.fromEntries(configs.map(c => [c.clave, c.valor]))
    }

    case 'derivar_humano': {
      console.log(`[WhatsApp Agente] Derivación para tenant ${tenantId}:`, input.motivo)
      return { derivado: true, mensaje: 'Se notificó a la administración. Pronto te contactarán.' }
    }

    default:
      return { error: `Tool desconocida: ${name}` }
  }
}

// ─── Registro de uso de IA ────────────────────────────────────────────────────

function registrarUsoIA(db, tenantId, provider, model, inputTokens, outputTokens) {
  if (!db || !tenantId || (!inputTokens && !outputTokens)) return
  db.aiUsageLog.create({
    data: { tenantId, provider, model, inputTokens, outputTokens }
  }).catch(err => console.error('[WhatsApp Agente] Error registrando uso IA:', err.message))
}

// ─── Historial de conversación (en memoria, normalizado) ─────────────────────
// Se guarda como pares {role, content: string} para compatibilidad entre proveedores.
// Las tool calls intermedias no se persisten en el historial.

const historiales = new Map()

function getHistorial(tenantId, telefono) {
  return historiales.get(`${tenantId}:${telefono}`) || []
}

function guardarHistorial(tenantId, telefono, mensajes) {
  // Solo pares user/assistant con contenido de texto
  const simples = mensajes
    .filter(m => typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
    .slice(-MAX_MENSAJES_HISTORIAL)
  historiales.set(`${tenantId}:${telefono}`, simples)
}

// Limpiar historiales cuando el Map crece demasiado
setInterval(() => {
  if (historiales.size > 1000) historiales.clear()
}, 60 * 60 * 1000)

// ─── System prompt ────────────────────────────────────────────────────────────

async function construirSystemPrompt(db, socio, esPrimerMensaje) {
  const hoy = new Date().toLocaleDateString('es-AR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  const configs = await db.configuracion.findMany({
    where: {
      clave: { in: ['NOMBRE_CLUB', 'nombre', 'WA_AGENT_NOMBRE', 'WA_AGENT_SYSTEM_PROMPT', 'WA_AGENT_SYSTEM_PROMPT_EXTRA'] }
    }
  }).catch(() => [])
  const cfg = Object.fromEntries(configs.map(c => [c.clave, c.valor]))

  // Si el tenant definió un prompt completo, usarlo directamente (solo append fecha e info socio)
  if (cfg.WA_AGENT_SYSTEM_PROMPT) {
    const extra = cfg.WA_AGENT_SYSTEM_PROMPT_EXTRA ? `\n\n${cfg.WA_AGENT_SYSTEM_PROMPT_EXTRA}` : ''
    return `${cfg.WA_AGENT_SYSTEM_PROMPT}\n\nHoy es ${hoy}.\n${extra}`
  }

  const nombreClub = cfg.NOMBRE_CLUB || cfg.nombre || 'el club'
  const nombreBot = cfg.WA_AGENT_NOMBRE || 'Asistente'

  const infoSocio = socio
    ? `Estás hablando con *${socio.apellidoNombre}*, socio Nº ${socio.nroSocio}${socio.tipoSocioRel ? `, tipo ${socio.tipoSocioRel.nombre}` : ''}.`
    : `El número no está registrado como socio. Podés dar información general del club pero no datos personales.`

  const instruccionSaludo = esPrimerMensaje
    ? `- Es el PRIMER mensaje de esta conversación. Saludá al socio por su nombre (si está registrado) o de forma genérica, presentate como ${nombreBot} y luego respondé su consulta en el mismo mensaje.`
    : `- La conversación ya está en curso. No te presentes de nuevo ni repitas saludos.`

  const promptExtra = cfg.WA_AGENT_SYSTEM_PROMPT_EXTRA
    ? `\nInstrucciones adicionales del club:\n${cfg.WA_AGENT_SYSTEM_PROMPT_EXTRA}`
    : ''

  return `Sos *${nombreBot}*, el asistente virtual de *${nombreClub}*, respondés consultas por WhatsApp.
Hoy es ${hoy}.

${infoSocio}

Instrucciones:
- Respondés en español rioplatense (vos, che, dale, etc.), de forma amigable y concisa.
- Máximo 3 párrafos cortos. Sin markdown complejo (WhatsApp solo soporta *negrita*, _cursiva_).
- Nunca inventás información. Siempre usás las tools para consultar datos reales.
- Si no podés resolver algo, usás la tool derivar_humano.
- Si el socio pide hablar con una persona, usás derivar_humano.
- No discutís precios ni políticas internas — solo informás lo que está en el sistema.
${instruccionSaludo}

Temas permitidos (ÚNICAMENTE estos):
- Deudas, cuotas y pagos del socio
- Actividades e inscripciones
- Acceso al portal del socio
- Información general del club (horarios, dirección, contacto)
- Reserva de espacios
- Derivación a administración

Si el socio pregunta qué podés hacer o en qué podés ayudar, respondé:
"Puedo ayudarte con:\n• Ver tus cuotas y deudas\n• Consultar tus actividades\n• Enviarte el link de tu portal personal\n• Información del club (horarios, dirección)\n• Conectarte con administración\n\n¿En qué te ayudo?"

Si el mensaje NO tiene relación con la gestión del club (clima, noticias, recetas, chistes, preguntas generales, etc.), respondé EXACTAMENTE esto sin usar ninguna tool:
"Solo puedo ayudarte con consultas sobre el club. Para eso estoy acá 😊"
No des explicaciones adicionales ni te disculpes.${promptExtra}`
}

// ─── Provider: Anthropic ──────────────────────────────────────────────────────

async function procesarConAnthropic({ iaConfig, systemPrompt, historial, texto, context }) {
  const { tenantId, telefono, db } = context
  const client = new Anthropic({ apiKey: iaConfig.apiKey })

  let messages = [...historial, { role: 'user', content: texto }]
  let respuestaFinal = null
  let totalInputTokens = 0
  let totalOutputTokens = 0

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: iaConfig.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
      tools: TOOLS,
    })

    totalInputTokens += response.usage?.input_tokens || 0
    totalOutputTokens += response.usage?.output_tokens || 0

    if (response.stop_reason === 'end_turn') {
      const bloque = response.content.find(b => b.type === 'text')
      respuestaFinal = bloque?.text || 'No pude procesar tu consulta.'
      messages.push({ role: 'assistant', content: response.content })
      break
    }

    if (response.stop_reason === 'tool_use') {
      const toolUses = response.content.filter(b => b.type === 'tool_use')
      const toolResults = []

      for (const tu of toolUses) {
        const resultado = await ejecutarTool(tu.name, tu.input, context)
        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(resultado) })
      }

      messages.push({ role: 'assistant', content: response.content })
      messages.push({ role: 'user', content: toolResults })
      continue
    }

    break
  }

  // Persistir solo los pares texto user/assistant
  guardarHistorial(tenantId, telefono, messages)

  // Registrar uso de tokens
  registrarUsoIA(db, tenantId, iaConfig.provider, iaConfig.model, totalInputTokens, totalOutputTokens)

  return respuestaFinal || 'Tuve un problema procesando tu consulta. Por favor intentá de nuevo.'
}

// ─── Provider: OpenAI ─────────────────────────────────────────────────────────

async function procesarConOpenAI({ iaConfig, systemPrompt, historial, texto, context }) {
  const { tenantId, telefono, db } = context

  // OpenAI espera el system prompt dentro del array de mensajes
  let messages = [
    { role: 'system', content: systemPrompt },
    ...historial,
    { role: 'user', content: texto }
  ]

  const tools = TOOLS.map(t => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.input_schema }
  }))

  let respuestaFinal = null
  let totalInputTokens = 0
  let totalOutputTokens = 0

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${iaConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: iaConfig.model,
        max_tokens: 1024,
        messages,
        tools,
        tool_choice: 'auto',
      })
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      throw new Error(`OpenAI API error ${res.status}: ${errBody}`)
    }

    const data = await res.json()
    const choice = data.choices?.[0]

    totalInputTokens += data.usage?.prompt_tokens || 0
    totalOutputTokens += data.usage?.completion_tokens || 0

    if (choice?.finish_reason === 'stop') {
      respuestaFinal = choice.message.content
      messages.push({ role: 'assistant', content: respuestaFinal })
      break
    }

    if (choice?.finish_reason === 'tool_calls') {
      const assistantMsg = choice.message
      messages.push(assistantMsg)

      for (const tc of (assistantMsg.tool_calls || [])) {
        let input = {}
        try { input = JSON.parse(tc.function.arguments) } catch {}
        const resultado = await ejecutarTool(tc.function.name, input, context)
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(resultado),
        })
      }
      continue
    }

    break
  }

  // Persistir solo los pares texto user/assistant (excluir tool calls y system)
  guardarHistorial(tenantId, telefono, messages.filter(m => m.role !== 'system'))

  // Registrar uso de tokens
  registrarUsoIA(db, tenantId, iaConfig.provider, iaConfig.model, totalInputTokens, totalOutputTokens)

  return respuestaFinal || 'Tuve un problema procesando tu consulta. Por favor intentá de nuevo.'
}

// ─── Procesamiento principal ──────────────────────────────────────────────────

export async function procesarMensajeAgente({ db, tenantId, telefono, nombreContacto, texto, socio }) {
  try {
    const iaConfig = await cargarConfigIA(db)

    if (!iaConfig.apiKey) {
      console.warn(`[WhatsApp Agente] Tenant ${tenantId}: sin API key de IA configurada`)
      await enviarWhatsApp({
        db, telefono,
        texto: 'El asistente no está disponible en este momento. Por favor contactá a la administración del club.',
        ignorarHorario: true
      }).catch(() => {})
      return
    }

    const historial = getHistorial(tenantId, telefono)
    const esPrimerMensaje = historial.length === 0
    const systemPrompt = await construirSystemPrompt(db, socio, esPrimerMensaje)
    const context = { db, socio, tenantId, telefono }

    let respuestaFinal
    if (iaConfig.provider === 'openai') {
      respuestaFinal = await procesarConOpenAI({ iaConfig, systemPrompt, historial, texto, context })
    } else {
      respuestaFinal = await procesarConAnthropic({ iaConfig, systemPrompt, historial, texto, context })
    }

    await enviarWhatsApp({ db, telefono, texto: respuestaFinal, ignorarHorario: true })

  } catch (err) {
    console.error('[WhatsApp Agente] Error:', err.message)
    await enviarWhatsApp({
      db, telefono,
      texto: 'Tuve un inconveniente técnico. Por favor contactá a la administración del club.',
      ignorarHorario: true
    }).catch(() => {})
  }
}
