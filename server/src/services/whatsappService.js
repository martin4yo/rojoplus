/**
 * WhatsApp Service — Evolution API
 * Envío de mensajes y gestión de instancias por tenant.
 * La configuración se lee de la tabla Configuracion del tenant.
 */

/**
 * Obtiene la configuración de WhatsApp del tenant.
 * Claves en tabla configuracion: WHATSAPP_API_URL, WHATSAPP_INSTANCE, WHATSAPP_API_KEY,
 * WHATSAPP_ENABLED, WHATSAPP_DELAY_MS, WHATSAPP_HORA_INICIO, WHATSAPP_HORA_FIN
 */
export async function getWhatsAppConfig(db) {
  if (!db) return null

  try {
    const configs = await db.configuracion.findMany({
      where: {
        clave: {
          in: [
            'WHATSAPP_ENABLED',
            'WHATSAPP_API_URL',
            'WHATSAPP_INSTANCE',
            'WHATSAPP_API_KEY',
            'WHATSAPP_DELAY_MS',
            'WHATSAPP_HORA_INICIO',
            'WHATSAPP_HORA_FIN',
            'WHATSAPP_WHITELIST',
            'WHATSAPP_DEMO_NUMERO',
            'MODO_DEMO',
          ]
        }
      }
    })

    const cfg = Object.fromEntries(configs.map(c => [c.clave, c.valor]))

    if (cfg.WHATSAPP_ENABLED !== 'true') return null
    if (!cfg.WHATSAPP_API_URL || !cfg.WHATSAPP_INSTANCE || !cfg.WHATSAPP_API_KEY) return null

    // Parsear whitelist: números separados por coma, normalizados
    let whitelist = null
    if (cfg.WHATSAPP_WHITELIST && cfg.WHATSAPP_WHITELIST.trim()) {
      whitelist = cfg.WHATSAPP_WHITELIST
        .split(',')
        .map(n => normalizarNumero(n.trim()))
        .filter(Boolean)
    }

    // Modo demo: redirige todos los mensajes a un número de prueba
    const modoDemo = cfg.MODO_DEMO === 'true'
    const numeroDemoNorm = normalizarNumero(cfg.WHATSAPP_DEMO_NUMERO || '')

    return {
      apiUrl: cfg.WHATSAPP_API_URL,
      instance: cfg.WHATSAPP_INSTANCE,
      apiKey: cfg.WHATSAPP_API_KEY,
      delayMs: parseInt(cfg.WHATSAPP_DELAY_MS) || 3000,
      horaInicio: parseInt(cfg.WHATSAPP_HORA_INICIO) || 8,
      horaFin: parseInt(cfg.WHATSAPP_HORA_FIN) || 21,
      whitelist,
      modoDemo,
      numeroDemo: numeroDemoNorm || null,
    }
  } catch (err) {
    console.error('[WhatsApp] Error obteniendo config:', err.message)
    return null
  }
}

/**
 * Verifica si el horario actual permite enviar mensajes.
 */
function dentroDelHorario(horaInicio, horaFin) {
  const hora = new Date().getHours()
  return hora >= horaInicio && hora < horaFin
}

/**
 * Normaliza un número de teléfono argentino al formato requerido por Evolution API.
 * Resultado esperado: 549XXXXXXXXXX (código país 54 + 9 + número sin 0 ni 15)
 */
export function normalizarNumero(telefono) {
  if (!telefono) return null

  // Limpiar todo lo que no sea dígito
  let num = telefono.replace(/\D/g, '')

  if (!num || num.length < 8) return null

  // Ya tiene formato completo con 549
  if (num.startsWith('549') && num.length === 13) return num

  // Tiene 54 adelante pero sin el 9
  if (num.startsWith('54') && num.length === 12) return '54' + '9' + num.slice(2)

  // Empieza con 0 (ej: 0221...)
  if (num.startsWith('0')) num = num.slice(1)

  // Empieza con 15 (ej: 15XXXXXXXX — número local viejo)
  if (num.startsWith('15')) num = num.slice(2)

  // Agregar prefijo completo
  return '549' + num
}

/**
 * Envía una imagen por WhatsApp usando sendMedia de Evolution API.
 * @param {object} params
 * @param {object} params.db
 * @param {string} params.telefono
 * @param {string} params.imagenBase64 - PNG en base64 (sin el prefijo data:...)
 * @param {string} params.caption - Texto opcional debajo de la imagen
 * @param {boolean} params.ignorarHorario
 */
export async function enviarWhatsAppImagen({ db, telefono, imagenBase64, caption = '', ignorarHorario = false }) {
  const cfg = await getWhatsAppConfig(db)
  if (!cfg) return { enviado: false, motivo: 'WhatsApp no configurado o deshabilitado' }

  if (!ignorarHorario && !dentroDelHorario(cfg.horaInicio, cfg.horaFin)) {
    return { enviado: false, motivo: 'Fuera del horario de envío' }
  }

  let numero = normalizarNumero(telefono)
  if (!numero) return { enviado: false, motivo: 'Número inválido' }

  if (cfg.modoDemo) {
    if (!cfg.numeroDemo) return { enviado: false, motivo: 'Modo demo activo pero sin número de prueba configurado (WHATSAPP_DEMO_NUMERO)' }
    console.log(`📱 MODO DEMO: Redirigiendo WhatsApp (imagen) de ${numero} a ${cfg.numeroDemo}`)
    caption = `[DEMO - Para: ${numero}]\n${caption}`
    numero = cfg.numeroDemo
  } else if (cfg.whitelist && !cfg.whitelist.includes(numero)) {
    return { enviado: false, motivo: 'Número no está en la lista blanca' }
  }

  try {
    const url = `${cfg.apiUrl}/message/sendMedia/${cfg.instance}`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': cfg.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: numero,
        mediatype: 'image',
        mimetype: 'image/png',
        media: imagenBase64,
        caption,
        fileName: 'qr-socio.png',
        delay: cfg.delayMs,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[WhatsApp] Error enviando imagen:', err)
      return { enviado: false, motivo: `Error API: ${res.status}` }
    }

    return { enviado: true, numero }
  } catch (err) {
    console.error('[WhatsApp] Error de red (imagen):', err.message)
    return { enviado: false, motivo: err.message }
  }
}

/**
 * Envía un mensaje de texto por WhatsApp.
 * @param {object} params
 * @param {object} params.db - Prisma client del tenant
 * @param {string} params.telefono - Número del destinatario (se normaliza automáticamente)
 * @param {string} params.texto - Texto del mensaje
 * @param {boolean} params.ignorarHorario - Si true, envía aunque esté fuera de horario
 */
export async function enviarWhatsApp({ db, telefono, texto, ignorarHorario = false }) {
  const cfg = await getWhatsAppConfig(db)
  if (!cfg) return { enviado: false, motivo: 'WhatsApp no configurado o deshabilitado' }

  if (!ignorarHorario && !dentroDelHorario(cfg.horaInicio, cfg.horaFin)) {
    return { enviado: false, motivo: 'Fuera del horario de envío' }
  }

  let numero = normalizarNumero(telefono)
  if (!numero) return { enviado: false, motivo: 'Número inválido' }

  if (cfg.modoDemo) {
    if (!cfg.numeroDemo) return { enviado: false, motivo: 'Modo demo activo pero sin número de prueba configurado (WHATSAPP_DEMO_NUMERO)' }
    console.log(`📱 MODO DEMO: Redirigiendo WhatsApp de ${numero} a ${cfg.numeroDemo}`)
    texto = `[DEMO - Para: ${numero}]\n${texto}`
    numero = cfg.numeroDemo
  } else if (cfg.whitelist && !cfg.whitelist.includes(numero)) {
    return { enviado: false, motivo: 'Número no está en la lista blanca' }
  }

  try {
    const url = `${cfg.apiUrl}/message/sendText/${cfg.instance}`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': cfg.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ number: numero, text: texto, delay: cfg.delayMs }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[WhatsApp] Error enviando mensaje:', err)
      return { enviado: false, motivo: `Error API: ${res.status}` }
    }

    return { enviado: true, numero }
  } catch (err) {
    console.error('[WhatsApp] Error de red:', err.message)
    return { enviado: false, motivo: err.message }
  }
}

/**
 * Envía mensajes a múltiples números con delay entre cada uno.
 * @param {object} params
 * @param {object} params.db
 * @param {Array<{telefono, texto}>} params.mensajes
 */
export async function enviarWhatsAppMasivo({ db, mensajes }) {
  const cfg = await getWhatsAppConfig(db)
  if (!cfg) return []

  const resultados = []

  for (const { telefono, texto } of mensajes) {
    const resultado = await enviarWhatsApp({ db, telefono, texto })
    resultados.push({ telefono, ...resultado })

    // Delay entre mensajes para no ser baneado
    if (resultado.enviado) {
      await new Promise(resolve => setTimeout(resolve, cfg.delayMs))
    }
  }

  return resultados
}

/**
 * Verifica el estado de conexión de la instancia del tenant.
 */
export async function verificarConexionWhatsApp(db) {
  const cfg = await getWhatsAppConfig(db)
  if (!cfg) return { conectado: false, motivo: 'No configurado' }

  try {
    const url = `${cfg.apiUrl}/instance/connectionState/${cfg.instance}`
    const res = await fetch(url, {
      headers: { 'apikey': cfg.apiKey }
    })

    if (!res.ok) return { conectado: false, motivo: `Error ${res.status}` }

    const data = await res.json()
    const conectado = data?.instance?.state === 'open'
    return { conectado, estado: data?.instance?.state }
  } catch (err) {
    return { conectado: false, motivo: err.message }
  }
}

/**
 * Configura el webhook en Evolution API para que apunte al backend de Clubix.
 * Se llama automáticamente al guardar la configuración de WhatsApp con enabled=true.
 */
export async function configurarWebhookEvolution(db) {
  const cfg = await getWhatsAppConfig(db)
  if (!cfg) return { ok: false, motivo: 'WhatsApp no configurado o deshabilitado' }

  const backendUrl = process.env.API_URL || process.env.BACKEND_URL || 'https://api.clubix.com.ar'
  const webhookUrl = `${backendUrl}/api/whatsapp/webhook`

  try {
    // Verificar si la instancia existe, crearla si no
    const fetchRes = await fetch(`${cfg.apiUrl}/instance/fetchInstances`, {
      headers: { 'apikey': cfg.apiKey },
    }).catch(() => null)

    if (fetchRes?.ok) {
      const instances = await fetchRes.json().catch(() => [])
      const lista = Array.isArray(instances) ? instances : (instances?.instances || [])
      const existe = lista.some(i => i.name === cfg.instance || i.instance?.instanceName === cfg.instance)

      if (!existe) {
        console.log(`[WhatsApp] Instancia "${cfg.instance}" no encontrada, creando...`)
        const createRes = await fetch(`${cfg.apiUrl}/instance/create`, {
          method: 'POST',
          headers: { 'apikey': cfg.apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instanceName: cfg.instance,
            integration: 'WHATSAPP-BAILEYS',
            qrcode: true,
          }),
        })
        if (!createRes.ok) {
          const err = await createRes.text().catch(() => '')
          console.error(`[WhatsApp] Error creando instancia: ${err}`)
          // Continuar de todas formas — si ya existe puede dar error pero el set webhook puede funcionar
        } else {
          console.log(`[WhatsApp] Instancia "${cfg.instance}" creada correctamente`)
        }
      }
    }

    // Registrar webhook (Evolution API v2 requiere el wrapper { webhook: { ... } })
    const url = `${cfg.apiUrl}/webhook/set/${cfg.instance}`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': cfg.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: webhookUrl,
          webhook_by_events: false,
          webhook_base64: false,
          events: ['MESSAGES_UPSERT'],
        }
      }),
    })

    if (!res.ok) {
      const err = await res.text().catch(() => '')
      return { ok: false, motivo: `Error Evolution API ${res.status}: ${err}` }
    }

    const data = await res.json()
    return { ok: true, webhookUrl, data }
  } catch (err) {
    return { ok: false, motivo: err.message }
  }
}

// ─── Templates de mensajes ───────────────────────────────────────────────────

/**
 * Templates por defecto. Se usan cuando el tenant no configuró un texto propio.
 * Variables soportadas: {{nombre}}, {{monto}}, {{vencimiento}}, {{total}}, {{link}}
 */
const TEMPLATES_DEFAULT = {
  NOTIF_WA_PAGO:        '*{{nombre}}*, registramos tu pago de *{{monto}}*. Gracias!',
  NOTIF_WA_VENCIMIENTO: '*{{nombre}}*, tu cuota de *{{monto}}* vence el *{{vencimiento}}*. Podés pagar desde el portal del club.',
  NOTIF_WA_MORA:        '*{{nombre}}*, tenés cuotas vencidas por un total de *{{total}}*. Por favor regularizá tu situación.',
  NOTIF_WA_PORTAL:      '*{{nombre}}*, acá está tu acceso al portal del club:\n{{link}}\n\nEste link es personal y expira en 7 días.',
}

/**
 * Lee el template del tenant (si existe) y sustituye las variables.
 * Si no hay template configurado, usa el default.
 */
async function resolverTemplate(db, clave, variables) {
  const config = await db.configuracion.findFirst({ where: { clave } }).catch(() => null)
  const template = config?.valor || TEMPLATES_DEFAULT[clave] || ''
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? '')
}

// ─── Helper: obtener primer teléfono disponible del socio ────────────────────

/**
 * Devuelve el primer número de teléfono válido del socio,
 * buscando en orden: celular → celularSecundario → telefonoFijo.
 */
export function obtenerTelefonoSocio(socio) {
  const candidatos = [socio?.celular, socio?.celularSecundario, socio?.telefonoFijo]
  for (const tel of candidatos) {
    if (normalizarNumero(tel)) return tel
  }
  return null
}

// ─── Mensajes predefinidos ───────────────────────────────────────────────────

/**
 * Notifica a un socio que se registró un pago.
 */
export async function notificarPago({ db, socio, pago }) {
  const telefono = obtenerTelefonoSocio(socio)
  if (!telefono) return

  const monto = Number(pago.importe || pago.monto || 0).toLocaleString('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0
  })

  const texto = await resolverTemplate(db, 'NOTIF_WA_PAGO', {
    nombre: socio.apellidoNombre,
    monto,
  })
  return enviarWhatsApp({ db, telefono, texto })
}

/**
 * Notifica a un socio que tiene una cuota próxima a vencer.
 */
export async function notificarVencimiento({ db, socio, cuota }) {
  const telefono = obtenerTelefonoSocio(socio)
  if (!telefono) return

  const vencimiento = new Date(cuota.vencimiento).toLocaleDateString('es-AR')
  const monto = Number(cuota.importe).toLocaleString('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0
  })

  const texto = await resolverTemplate(db, 'NOTIF_WA_VENCIMIENTO', {
    nombre: socio.apellidoNombre,
    monto,
    vencimiento,
  })
  return enviarWhatsApp({ db, telefono, texto })
}

/**
 * Notifica a un socio que tiene una cuota vencida.
 */
export async function notificarMora({ db, socio, deuda }) {
  const telefono = obtenerTelefonoSocio(socio)
  if (!telefono) return

  const total = Number(deuda.total).toLocaleString('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0
  })

  const texto = await resolverTemplate(db, 'NOTIF_WA_MORA', {
    nombre: socio.apellidoNombre,
    total,
  })
  return enviarWhatsApp({ db, telefono, texto })
}

/**
 * Envía el link de acceso al portal del socio.
 */
export async function enviarLinkPortal({ db, socio, link }) {
  const telefono = obtenerTelefonoSocio(socio)
  if (!telefono) return

  const texto = await resolverTemplate(db, 'NOTIF_WA_PORTAL', {
    nombre: socio.apellidoNombre,
    link,
  })
  return enviarWhatsApp({ db, telefono, texto, ignorarHorario: true })
}
