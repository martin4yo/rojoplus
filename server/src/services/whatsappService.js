/**
 * WhatsApp Service — Evolution API
 * Envío de mensajes y gestión de instancias por tenant.
 * La configuración se lee de la tabla Configuracion del tenant.
 */
import { createTenantPrisma } from '../lib/tenantPrisma.js'

/**
 * Convierte Markdown estándar al subset que WhatsApp interpreta.
 *
 * WhatsApp soporta: *negrita*, _cursiva_, ~tachado~, ```código```.
 * Markdown estándar usa **negrita** y los links son [texto](url).
 *
 * Se aplica al texto antes de enviarlo, así los tool handlers / actionExecutor
 * pueden seguir devolviendo Markdown estándar (que el web chat renderiza nativo)
 * sin duplicar la lógica de formato por canal.
 *
 * Cubre: headings ATX, bold doble, links inline, listas con asterisco
 * (cambia a viñeta porque el * choca con el bold de WA), reglas horizontales.
 * Code blocks (```...```) y código inline (`x`) ya son interpretados por WA.
 */
export function mdToWhatsApp(text) {
  if (!text || typeof text !== 'string') return text
  return text
    // Headings ATX (# Title, ## Subtitle) → *Title* en su propia línea.
    // El número de # no importa — en WA no hay jerarquía visual de headings.
    .replace(/^[ \t]*#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/gm, '*$1*')
    // **bold** → *bold* (orden importa: convertir doble antes que simple).
    .replace(/\*\*(.+?)\*\*/gs, '*$1*')
    // __bold__ → *bold* (variante GFM).
    .replace(/__(.+?)__/gs, '*$1*')
    // Listas con * o + al inicio de línea → viñeta •. El * suelto chocaría
    // con el marcador de bold de WA y se rompería el render.
    .replace(/^([ \t]*)[*+][ \t]+/gm, '$1• ')
    // [texto](url) → texto: url  (WA detecta el URL standalone como clickeable).
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1: $2')
    // Reglas horizontales (---, ***, ___) → línea en blanco.
    .replace(/^[ \t]*([-*_])\1{2,}[ \t]*$/gm, '')
}

/**
 * Resuelve un cliente Prisma SEGURO para leer config del tenant.
 * - Si viene `tenantId` → crea cliente tenant-scoped.
 * - Si viene `db` tenant-scoped y NO tenantId → usa db.
 * - Sin ninguno → null. Sin contexto, NO se lee config (devuelve null en getWhatsAppConfig
 *   y por consiguiente los envíos no salen — fail-safe para evitar leer config de otro tenant).
 */
function resolverDb({ db, tenantId }) {
  if (tenantId) return createTenantPrisma(tenantId)
  if (db) return db
  return null
}

/**
 * Obtiene la configuración de WhatsApp del tenant.
 * Acepta firma legacy `getWhatsAppConfig(db)` o nueva `getWhatsAppConfig({ db, tenantId })`.
 * Claves en tabla configuracion: WHATSAPP_API_URL, WHATSAPP_INSTANCE, WHATSAPP_API_KEY,
 * WHATSAPP_ENABLED, WHATSAPP_DELAY_MS, WHATSAPP_HORA_INICIO, WHATSAPP_HORA_FIN
 */
export async function getWhatsAppConfig(dbOrOpts) {
  const opts = (dbOrOpts && typeof dbOrOpts === 'object' && ('tenantId' in dbOrOpts || 'db' in dbOrOpts))
    ? dbOrOpts
    : { db: dbOrOpts }
  const db = resolverDb(opts)
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

  // Quitar prefijo internacional para trabajar con el número NACIONAL.
  // (Ningún código de área AR empieza con 54/549, así que es seguro.)
  if (num.startsWith('549')) num = num.slice(3)
  else if (num.startsWith('54')) num = num.slice(2)

  // Quitar 0 inicial de larga distancia (ej: 0230...)
  if (num.startsWith('0')) num = num.slice(1)

  // Quitar el "15" embebido entre el código de área y el abonado.
  // El número nacional argentino significativo es SIEMPRE de 10 dígitos
  // (área 2-4 + abonado). Si quedan 12, el "15" (viejo prefijo de celular
  // local) está embebido tras el código de área: 0{area}15{abonado}.
  // Ej: 230 15 4346897 → 230 4346897.
  if (num.length === 12) {
    if (num.startsWith('11') && num.slice(2, 4) === '15') num = '11' + num.slice(4)      // CABA/GBA (área 2 díg)
    else if (num.slice(3, 5) === '15') num = num.slice(0, 3) + num.slice(5)              // área 3 díg (interior)
    else if (num.slice(4, 6) === '15') num = num.slice(0, 4) + num.slice(6)              // área 4 díg
    else if (num.slice(2, 4) === '15') num = num.slice(0, 2) + num.slice(4)              // fallback área 2 díg
  }

  // "15" al inicio sin código de área (número local viejo, ambiguo)
  if (num.startsWith('15') && num.length === 10) num = num.slice(2)

  if (num.length < 8) return null

  // Agregar prefijo completo (código país 54 + 9 de celular)
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
export async function enviarWhatsAppImagen({ db, tenantId, telefono, imagenBase64, caption = '', ignorarHorario = false }) {
  const cfg = await getWhatsAppConfig({ db, tenantId })
  if (!cfg) return { enviado: false, motivo: 'WhatsApp no configurado o deshabilitado' }

  if (!ignorarHorario && !dentroDelHorario(cfg.horaInicio, cfg.horaFin)) {
    return { enviado: false, motivo: 'Fuera del horario de envío' }
  }

  let numero = normalizarNumero(telefono)
  if (!numero) return { enviado: false, motivo: 'Número inválido' }

  caption = mdToWhatsApp(caption)

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
 * Envía un documento (PDF) por WhatsApp.
 * Usa el endpoint sendMedia de Evolution API con mediatype='document'.
 */
export async function enviarWhatsAppDocumento({ db, tenantId, telefono, pdfBase64, fileName = 'documento.pdf', caption = '', ignorarHorario = false }) {
  const cfg = await getWhatsAppConfig({ db, tenantId })
  if (!cfg) return { enviado: false, motivo: 'WhatsApp no configurado o deshabilitado' }

  if (!ignorarHorario && !dentroDelHorario(cfg.horaInicio, cfg.horaFin)) {
    return { enviado: false, motivo: 'Fuera del horario de envío' }
  }

  let numero = normalizarNumero(telefono)
  if (!numero) return { enviado: false, motivo: 'Número inválido' }

  caption = mdToWhatsApp(caption)

  if (cfg.modoDemo) {
    if (!cfg.numeroDemo) return { enviado: false, motivo: 'Modo demo activo pero sin número de prueba configurado (WHATSAPP_DEMO_NUMERO)' }
    console.log(`📱 MODO DEMO: Redirigiendo WhatsApp (documento) de ${numero} a ${cfg.numeroDemo}`)
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
        mediatype: 'document',
        mimetype: 'application/pdf',
        media: pdfBase64,
        caption,
        fileName,
        delay: cfg.delayMs,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[WhatsApp] Error enviando documento:', err)
      // 413 = el PDF supera el límite del nginx delante de Evolution API.
      // Devolvemos código específico para que el caller pueda fallback a texto.
      if (res.status === 413) {
        return { enviado: false, motivo: 'PDF muy grande para WhatsApp', code: 'PDF_TOO_LARGE' }
      }
      return { enviado: false, motivo: `Error API: ${res.status}` }
    }

    return { enviado: true, numero }
  } catch (err) {
    console.error('[WhatsApp] Error de red (documento):', err.message)
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
export async function enviarWhatsApp({ db, tenantId, telefono, texto, ignorarHorario = false }) {
  const cfg = await getWhatsAppConfig({ db, tenantId })
  if (!cfg) return { enviado: false, motivo: 'WhatsApp no configurado o deshabilitado' }

  if (!ignorarHorario && !dentroDelHorario(cfg.horaInicio, cfg.horaFin)) {
    return { enviado: false, motivo: 'Fuera del horario de envío' }
  }

  let numero = normalizarNumero(telefono)
  if (!numero) return { enviado: false, motivo: 'Número inválido' }

  texto = mdToWhatsApp(texto)

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
export async function enviarWhatsAppMasivo({ db, tenantId, mensajes }) {
  const cfg = await getWhatsAppConfig({ db, tenantId })
  if (!cfg) return []

  const resultados = []

  for (const { telefono, texto } of mensajes) {
    const resultado = await enviarWhatsApp({ db, tenantId, telefono, texto })
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
 * Variables soportadas:
 *   {{nombre}}          → primer nombre (sin apellido)
 *   {{apellido}}        → apellido
 *   {{nombreCompleto}}  → apellidoNombre completo (ej: "GARCIA, JUAN CARLOS")
 *   {{nroSocio}}        → número de socio
 *   {{monto}}, {{total}}, {{importe}} → importe formateado
 *   {{vencimiento}}     → fecha de vencimiento
 *   {{link}}, {{linkPortal}}, {{linkPago}} → URLs al portal del socio
 */
const TEMPLATES_DEFAULT = {
  NOTIF_WA_PAGO:        '*{{nombre}}*, registramos tu pago de *{{monto}}*. Gracias!',
  NOTIF_WA_VENCIMIENTO: '*{{nombre}}*, tu cuota de *{{monto}}* vence el *{{vencimiento}}*.\nPagá online: {{linkPago}}',
  NOTIF_WA_MORA:        '*{{nombre}}*, tenés cuotas vencidas por un total de *{{total}}*.\nRegularizá desde el portal: {{linkPago}}',
  NOTIF_WA_PORTAL:      '*{{nombre}}*, acá está tu acceso al portal del club:\n{{link}}\n\nEste link es personal y expira en 7 días.',
}

/**
 * Eventos donde el link al portal es crítico para que el socio resuelva
 * la acción. Si el template del tenant fue customizado sin incluir el
 * link, lo appendamos al final automáticamente para no dejar al socio
 * sin forma de actuar.
 */
const _CLAVES_REQUIEREN_LINK = new Set([
  'NOTIF_WA_VENCIMIENTO',
  'NOTIF_WA_MORA',
])

/**
 * Lee el template del tenant (si existe) y sustituye las variables.
 * Si no hay template configurado, usa el default.
 *
 * Para eventos financieros (vencimiento/mora): si el template del tenant
 * no usa {{link}} ni {{linkPago}} ni {{linkPortal}} pero las variables
 * incluyen una URL, se appendea al final. Evita el caso de templates
 * customizados que olvidan incluir el link y dejan al socio sin call-to-action.
 */
async function resolverTemplate(db, clave, variables) {
  const config = await db.configuracion.findFirst({ where: { clave } }).catch(() => null)
  const template = config?.valor || TEMPLATES_DEFAULT[clave] || ''
  const usaLink = /\{\{(link|linkPago|linkPortal)\}\}/.test(template)
  let rendered = template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? '')

  if (_CLAVES_REQUIEREN_LINK.has(clave) && !usaLink) {
    const link = variables.linkPago || variables.linkPortal || variables.link
    if (link) {
      rendered = `${rendered.trimEnd()}\n\nPortal: ${link}`
    }
  }
  return rendered
}

// ─── Helpers: nombre/apellido y link al portal ───────────────────────────────

/**
 * Parsea `apellidoNombre` (formato "APELLIDO, NOMBRE" o "APELLIDO NOMBRE")
 * y devuelve nombre, apellido y el nombreCompleto original.
 */
export function parseNombreSocio(socio) {
  const an = (socio?.apellidoNombre || '').trim()
  if (!an) return { nombre: '', apellido: '', nombreCompleto: '' }
  if (an.includes(',')) {
    const [apellido, ...resto] = an.split(',')
    const nombre = resto.join(',').trim().split(/\s+/)[0] || ''
    return { nombre, apellido: apellido.trim(), nombreCompleto: an }
  }
  const parts = an.split(/\s+/)
  return {
    nombre: parts[0] || '',
    apellido: parts.slice(1).join(' '),
    nombreCompleto: an,
  }
}

/**
 * Obtiene la URL del frontend del tenant del socio.
 * Resuelve dominio custom > subdomain > FRONTEND_URL en dev.
 */
async function getFrontendUrlForSocio(socio) {
  try {
    if (!socio?.tenantId) return process.env.FRONTEND_URL || 'http://localhost:5173'
    const [{ default: prismaGlobal }, { getTenantFrontendUrl }] = await Promise.all([
      import('../lib/prisma.js'),
      import('../lib/tenantUrl.js'),
    ])
    const tenant = await prismaGlobal.tenant.findUnique({
      where: { id: socio.tenantId },
      select: { subdomain: true, dominioCustom: true },
    })
    return getTenantFrontendUrl(tenant)
  } catch {
    return process.env.FRONTEND_URL || 'http://localhost:5173'
  }
}

/**
 * Construye el link al portal del socio (usado como linkPago para opción B:
 * el socio entra al portal y desde ahí elige medio de pago).
 * Si se pasa cargoId, el portal puede leer ?pagar=X para destacar esa cuota.
 *
 * Asegura que el socio tenga tokenPortal vigente — si no, lo genera y persiste.
 */
export async function buildLinkPortal(socio, { cargoId } = {}) {
  if (!socio?.id) return ''
  const { ensurePortalToken } = await import('../lib/portalToken.js')
  const token = await ensurePortalToken(socio).catch(() => null)
  if (!token) return ''
  const base = await getFrontendUrlForSocio(socio)
  const query = cargoId ? `?pagar=${cargoId}` : ''
  return `${base}/portal-socio/${token}${query}`
}

/**
 * Construye el bag de variables común a todos los templates WA.
 * `extras` permite agregar/override (monto, vencimiento, total, link, etc.)
 */
export async function buildVariablesSocio(socio, extras = {}) {
  const { nombre, apellido, nombreCompleto } = parseNombreSocio(socio)
  const linkPortal = await buildLinkPortal(socio, { cargoId: extras.cargoId })
  return {
    nombre,
    apellido,
    nombreCompleto,
    nroSocio: socio?.nroSocio ?? '',
    linkPortal,
    linkPago: linkPortal, // opción B: linkPago == linkPortal
    link: extras.link ?? linkPortal,
    ...extras,
  }
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
export async function notificarPago({ db, tenantId, socio, pago, pdfBuffer = null, pdfFilename = null }) {
  const telefono = obtenerTelefonoSocio(socio)
  if (!telefono) return

  // Derivar tenantId del pago si no vino explícito (campo del schema)
  const tid = tenantId || pago?.tenantId || socio?.tenantId || null

  const monto = Number(pago.montoTotal || pago.importe || pago.monto || 0).toLocaleString('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0
  })

  const variables = await buildVariablesSocio(socio, { monto, total: monto, importe: monto })
  const texto = await resolverTemplate(db, 'NOTIF_WA_PAGO', variables)

  if (pdfBuffer) {
    return enviarWhatsAppDocumento({
      db, tenantId: tid,
      telefono,
      pdfBase64: pdfBuffer.toString('base64'),
      fileName: pdfFilename || `recibo-${pago.numero}.pdf`,
      caption: texto,
    })
  }
  return enviarWhatsApp({ db, tenantId: tid, telefono, texto })
}

/**
 * Notifica a un socio que tiene una cuota próxima a vencer.
 */
export async function notificarVencimiento({ db, tenantId, socio, cuota }) {
  const telefono = obtenerTelefonoSocio(socio)
  if (!telefono) return

  const vencimiento = new Date(cuota.vencimiento).toLocaleDateString('es-AR')
  const monto = Number(cuota.importe).toLocaleString('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0
  })

  const variables = await buildVariablesSocio(socio, {
    monto,
    importe: monto,
    vencimiento,
    cargoId: cuota.id,
  })
  const texto = await resolverTemplate(db, 'NOTIF_WA_VENCIMIENTO', variables)
  return enviarWhatsApp({ db, tenantId, telefono, texto })
}

/**
 * Notifica a un socio que tiene una cuota vencida.
 */
export async function notificarMora({ db, tenantId, socio, deuda }) {
  const telefono = obtenerTelefonoSocio(socio)
  if (!telefono) return

  const total = Number(deuda.total).toLocaleString('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0
  })

  const variables = await buildVariablesSocio(socio, { total, monto: total, importe: total })
  const texto = await resolverTemplate(db, 'NOTIF_WA_MORA', variables)
  return enviarWhatsApp({ db, tenantId, telefono, texto })
}

/**
 * Envía el link de acceso al portal del socio.
 */
export async function enviarLinkPortal({ db, tenantId, socio, link, codigo = null }) {
  const telefono = obtenerTelefonoSocio(socio)
  if (!telefono) return

  const variables = await buildVariablesSocio(socio, { link })
  let texto = await resolverTemplate(db, 'NOTIF_WA_PORTAL', variables)
  // Código para login dentro de la app instalada (clave en iPhone, donde el link
  // abre Safari y no la PWA).
  if (codigo) {
    texto += `\n\n¿Instalaste la app? Ingresá este código: *${codigo}* (válido 30 min)`
  }
  return enviarWhatsApp({ db, tenantId, telefono, texto, ignorarHorario: true })
}

/**
 * Enviar comprobante de movimiento de caja por WhatsApp (con PDF si está disponible).
 * Acepta un teléfono override (cargado en el modal); si no, intenta del socio/entidad.
 */
export async function enviarComprobanteMovimientoWhatsApp({ movimiento, telefono, pdfBuffer = null, pdfFilename = null, db }) {
  const tel = telefono
    || obtenerTelefonoSocio(movimiento.socio)
    || movimiento.entidad?.telefono
    || null
  if (!tel) return { enviado: false, motivo: 'Sin teléfono destino' }

  const esIngreso = movimiento.tipo === 'INGRESO'
  const tipoLabel = esIngreso ? 'Ingreso' : 'Egreso'
  const nombre = movimiento.socio?.apellidoNombre
    || movimiento.entidad?.razonSocial
    || movimiento.entidad?.nombreFantasia
    || ''

  const fechaStr = new Date(movimiento.fecha).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  })
  const monto = Number(movimiento.monto || 0).toLocaleString('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0
  })

  const texto = `${nombre ? `Hola ${nombre}, ` : ''}te enviamos el comprobante de ${tipoLabel} Nº ${movimiento.numero} del ${fechaStr}.\n` +
    `Concepto: ${movimiento.concepto || movimiento.descripcion || '-'}\n` +
    `Total: ${monto}`

  if (pdfBuffer) {
    const r = await enviarWhatsAppDocumento({
      db,
      telefono: tel,
      pdfBase64: pdfBuffer.toString('base64'),
      fileName: pdfFilename || `comprobante-${movimiento.numero}.pdf`,
      caption: texto,
    })
    // Si el PDF excede el límite del proxy de Evolution API, mandar al menos el texto
    if (!r?.enviado && r?.code === 'PDF_TOO_LARGE') {
      console.log('[WhatsApp comprobante] PDF excede límite, fallback a texto')
      const fallback = await enviarWhatsApp({ db, telefono: tel, texto })
      if (fallback?.enviado) {
        return { ...fallback, motivo: 'Mensaje enviado sin PDF (excede límite del servidor de WhatsApp)' }
      }
      return fallback
    }
    return r
  }
  return enviarWhatsApp({ db, telefono: tel, texto })
}
