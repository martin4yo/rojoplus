/**
 * Agente de WhatsApp — proxy al AXIO Hub.
 *
 * Antes este archivo hablaba directo con Anthropic/OpenAI y mantenía sus
 * propios TOOLS, historial e instrucciones. Ahora delega todo al hub:
 *  1. El hub elige el tool apropiado (Capa 2.6 tool-calling).
 *  2. Acá se ejecuta el tool localmente via ActionExecutor.
 *  3. El message del executor se manda por WhatsApp con formato adaptado
 *     (la conversión Markdown→WA se hace en whatsappService.enviarWhatsApp).
 *
 * Beneficios: observabilidad y billing centralizados en el hub, una sola
 * fuente de verdad para los tools (axio/tools/socioTools.js), unificación
 * con el web chat.
 */

import { enviarWhatsApp } from '../../services/whatsappService.js'
import { callHub } from '../../axio/hubClient.js'
import { getToolsForRole } from '../../axio/tools/index.js'
import { ACCIONES, ROLES } from '../../services/aiConstants.js'
import ActionExecutor from '../../services/actionExecutor.js'

// Tools cuyos handlers NO requieren socio registrado. Cuando llega un mensaje
// de un número no registrado exponemos solo este subset — el resto tira error
// "No hay socio en el contexto" si se invocara.
const TOOLS_NO_SOCIO = new Set([
  ACCIONES.INFO_CLUB,
  ACCIONES.ENVIAR_LINK_WEB,
  ACCIONES.DERIVAR_HUMANO,
])

// Set en memoria de pares (tenantId:telefono) que ya recibieron un saludo
// en esta sesión del proceso. Se reinicia al reiniciar el server — está bien,
// el peor caso es saludar dos veces si el server se reinicia mid-conversación.
const _saludados = new Set()
// Limpieza preventiva si crece mucho (1k contactos por proceso es razonable).
setInterval(() => {
  if (_saludados.size > 1000) _saludados.clear()
}, 60 * 60 * 1000)

function primerNombre(apellidoNombre) {
  if (!apellidoNombre) return null
  // Heurística clubix: "APELLIDO Nombre Otro" — tomamos la primera palabra
  // que no esté en mayúsculas completas (esa es el apellido).
  const tokens = apellidoNombre.trim().split(/\s+/)
  const nombre = tokens.find((t) => t !== t.toUpperCase()) || tokens[1] || tokens[0]
  // Capitalizar prolijo
  return nombre.charAt(0).toUpperCase() + nombre.slice(1).toLowerCase()
}

async function cargarConfigBot(db) {
  const configs = await db.configuracion.findMany({
    where: {
      clave: {
        in: ['WA_AGENT_NOMBRE', 'WA_AGENT_SYSTEM_PROMPT_EXTRA', 'NOMBRE_CLUB', 'nombre'],
      },
    },
  }).catch(() => [])
  const cfg = Object.fromEntries(configs.map((c) => [c.clave, c.valor]))
  return {
    botName: cfg.WA_AGENT_NOMBRE || 'Asistente',
    nombreClub: cfg.NOMBRE_CLUB || cfg.nombre || 'el club',
    extraInstrucciones: cfg.WA_AGENT_SYSTEM_PROMPT_EXTRA || null,
  }
}

/**
 * Arma el bloque que se appendea al system prompt del hub. Define tono,
 * formato WA y contexto de quién está hablando (socio o número anónimo).
 * El prompt base con instrucciones de tool-calling queda intacto en el hub.
 */
function buildSystemPromptExtra({ botName, nombreClub, socio, extra }) {
  const lineas = [
    `Sos *${botName}*, el asistente virtual de *${nombreClub}* que atiende WhatsApp.`,
    '',
    'Tono y formato:',
    '- Español rioplatense (vos, dale). No uses "che".',
    '- Respuestas breves, máximo 3 párrafos cortos.',
    '- WhatsApp solo entiende *negrita*, _cursiva_, ~tachado~. No uses Markdown que no esté en ese set.',
    '- No inventes información: si el dato no viene del tool, no lo digas.',
    '',
  ]
  if (socio) {
    const nroSocio = socio.nroSocio ? ` (Nº ${socio.nroSocio})` : ''
    lineas.push(`Estás hablando con *${socio.apellidoNombre}*${nroSocio}, socio del club.`)
  } else {
    lineas.push(
      'El número NO está registrado como socio del club. Solo podés ayudar con info pública (horarios del club, sitio web) o derivar a un humano.'
    )
  }
  if (extra) {
    lineas.push('')
    lineas.push('Instrucciones específicas del club:')
    lineas.push(extra)
  }
  return lineas.join('\n')
}

export async function procesarMensajeAgente({ db, tenantId, telefono, nombreContacto, texto, socio }) {
  try {
    const { botName, nombreClub, extraInstrucciones } = await cargarConfigBot(db)

    // Tools disponibles según si el número está registrado.
    const allTools = getToolsForRole(ROLES.SOCIO)
    const tools = socio
      ? allTools
      : allTools.filter((t) => TOOLS_NO_SOCIO.has(t.name))

    const scopeHint = socio
      ? `Usuario socio (id=${socio.id}). Elegí EL tool más apropiado al pedido. No respondas con texto crudo.`
      : 'Usuario NO registrado como socio. Solo tools de info pública o derivar_humano.'

    const systemPromptExtra = buildSystemPromptExtra({
      botName,
      nombreClub,
      socio,
      extra: extraInstrucciones,
    })

    let respuestaFinal
    try {
      // context: '' es intencional — maximiza el hit del cache del hub.
      // Si hace falta multi-turno se puede activar después (a costa del cache).
      const hubResp = await callHub({
        question: texto,
        context: '',
        tenantId,
        tools,
        scopeHint,
        toolsOnly: true,
        systemPromptExtra,
      })

      if (hubResp?.tool_call?.name) {
        const executor = new ActionExecutor(db)
        const ctx = {
          role: ROLES.SOCIO,
          tenantId,
          userId: socio?.id?.toString() || telefono,
          socioId: socio?.id || null,
          userName: socio?.apellidoNombre || nombreContacto || 'usuario',
          metadata: { telefono, nombreContacto },
        }
        const result = await executor.executeAction(
          {
            accion: hubResp.tool_call.name,
            entidades: hubResp.tool_call.args || {},
          },
          ctx
        )
        console.log(
          `[WhatsApp Agente] tool=${hubResp.tool_call.name} success=${result.success} model=${hubResp.model} time_ms=${hubResp.time_ms}`
        )
        respuestaFinal =
          result.message || (result.success ? 'Hecho.' : 'No pude procesar tu consulta.')
      } else if (hubResp?.answer) {
        console.log(`[WhatsApp Agente] hub answer model=${hubResp.model} time_ms=${hubResp.time_ms}`)
        respuestaFinal = hubResp.answer
      } else {
        console.warn('[WhatsApp Agente] respuesta vacía del hub')
        respuestaFinal = 'No pude procesar tu consulta. Probá reformularla.'
      }
    } catch (e) {
      console.error('[WhatsApp Agente] Error consultando hub:', e.message)
      respuestaFinal =
        'El asistente está temporalmente fuera de servicio. Probá en unos minutos.'
    }

    // Saludo en el primer mensaje de la sesión. Se mantiene hardcoded acá
    // (no LLM) para ser predecible y no contar como turno cacheable del hub.
    const saludoKey = `${tenantId}:${telefono}`
    if (!_saludados.has(saludoKey)) {
      _saludados.add(saludoKey)
      const nombre = socio ? primerNombre(socio.apellidoNombre) : null
      const saludo = nombre
        ? `¡Hola, ${nombre}! Soy *${botName}* 👋\n\n`
        : `¡Hola! Soy *${botName}* 👋\n\n`
      respuestaFinal = saludo + respuestaFinal
    }

    await enviarWhatsApp({ db, tenantId, telefono, texto: respuestaFinal, ignorarHorario: true })
  } catch (err) {
    console.error('[WhatsApp Agente] Error fatal:', err.message)
    await enviarWhatsApp({
      db,
      tenantId,
      telefono,
      texto: 'Tuve un inconveniente técnico. Por favor contactá a la administración del club.',
      ignorarHorario: true,
    }).catch(() => {})
  }
}
