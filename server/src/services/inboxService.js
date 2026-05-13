import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import prisma from '../lib/prisma.js'
import { createTenantPrisma } from '../lib/tenantPrisma.js'

/**
 * Servicio de monitoreo de inbox por tenant (IMAP).
 *
 * Para cada tenant con IMAP configurado, busca emails no leídos del último día,
 * los matchea con socios que tengan AccionRecupero saliente reciente, y crea
 * AccionRecupero entrante pendienteRevision=true con el texto del mensaje.
 *
 * Claves de Configuracion por tenant:
 *   IMAP_HOST, IMAP_PORT, IMAP_USER, IMAP_PASS, IMAP_SECURE ('true'|'false'),
 *   IMAP_ENABLED ('true'|'false')
 */

/**
 * Lee la config IMAP del tenant. Si no hay IMAP_USER se asume SMTP_USER (mismo
 * email para enviar y recibir, que es lo más común). Si no hay IMAP_PASS,
 * usa SMTP_PASS.
 */
async function getImapConfig(db) {
  const claves = [
    'IMAP_ENABLED', 'IMAP_HOST', 'IMAP_PORT', 'IMAP_USER', 'IMAP_PASS', 'IMAP_SECURE',
    'SMTP_USER', 'SMTP_PASS',
  ]
  const rows = await db.configuracion.findMany({ where: { clave: { in: claves } } })
  const cfg = Object.fromEntries(rows.map(r => [r.clave, r.valor]))

  if (cfg.IMAP_ENABLED !== 'true') return null
  if (!cfg.IMAP_HOST) return null

  return {
    host: cfg.IMAP_HOST,
    port: parseInt(cfg.IMAP_PORT || '993'),
    secure: (cfg.IMAP_SECURE ?? 'true') === 'true',
    auth: {
      user: cfg.IMAP_USER || cfg.SMTP_USER,
      pass: cfg.IMAP_PASS || cfg.SMTP_PASS,
    },
  }
}

/**
 * Procesa un mensaje entrante: busca al socio por su dirección de email,
 * verifica si tiene AccionRecupero saliente reciente, y registra la respuesta.
 * Retorna true si se registró la respuesta, false si se ignoró.
 */
async function procesarMensaje(db, tenantId, parsed) {
  const fromAddress = parsed.from?.value?.[0]?.address?.toLowerCase()
  if (!fromAddress) return false

  // Buscar socio por email
  const socio = await db.socio.findFirst({
    where: { email: { equals: fromAddress, mode: 'insensitive' } },
  })
  if (!socio) {
    console.log(`[Inbox] Tenant ${tenantId}: email de ${fromAddress} no es de ningún socio, ignorando`)
    return false
  }

  // Verificar acción saliente reciente (últimos 30 días)
  const hace30Dias = new Date()
  hace30Dias.setDate(hace30Dias.getDate() - 30)
  const ultimaAccionSaliente = await db.accionRecupero.findFirst({
    where: {
      socioId: socio.id,
      fecha: { gte: hace30Dias },
      OR: [
        { direccion: 'SALIENTE' },
        { direccion: null },
      ],
    },
    orderBy: { fecha: 'desc' },
  })
  if (!ultimaAccionSaliente) {
    console.log(`[Inbox] Tenant ${tenantId}: ${socio.apellidoNombre} respondió pero no tiene campaña activa de recupero`)
    return false
  }

  // Evitar duplicar: chequear si ya registramos este messageId
  if (parsed.messageId) {
    const yaExiste = await db.accionRecupero.findFirst({
      where: {
        socioId: socio.id,
        direccion: 'ENTRANTE',
        observaciones: { contains: parsed.messageId },
      },
    })
    if (yaExiste) {
      console.log(`[Inbox] Tenant ${tenantId}: messageId ${parsed.messageId} ya procesado`)
      return false
    }
  }

  // Texto del email (preferir text plano, sino html limpio)
  const texto = parsed.text?.trim() || parsed.html?.replace(/<[^>]+>/g, ' ').trim() || '(sin contenido)'
  // Limitar a 4000 chars para no llenar la BD con threads largos
  const observaciones = texto.length > 4000 ? texto.slice(0, 4000) + '…' : texto
  // Adjuntar messageId al final para deduplicación futura
  const observacionesConId = parsed.messageId
    ? `${observaciones}\n\n[messageId: ${parsed.messageId}]`
    : observaciones

  const nuevaAccion = await db.accionRecupero.create({
    data: {
      socioId: socio.id,
      campanaId: ultimaAccionSaliente.campanaId,
      tipo: 'EMAIL',
      resultado: 'PENDIENTE_DECISION',
      observaciones: observacionesConId,
      direccion: 'ENTRANTE',
      pendienteRevision: true,
      responsableId: ultimaAccionSaliente.responsableId,
    },
  })

  // Emitir socket
  try {
    const { getIO } = await import('./socketService.js')
    const io = getIO()
    io.to(`tenant:${tenantId}`).emit('recupero:respuesta-pendiente', {
      accionId: nuevaAccion.id,
      socioId: socio.id,
      socioNombre: socio.apellidoNombre,
      nroSocio: socio.nroSocio,
      campanaId: ultimaAccionSaliente.campanaId,
      tipo: 'EMAIL',
      mensaje: observaciones.slice(0, 200),
      fecha: nuevaAccion.fecha,
    })
  } catch (err) {
    console.error('[Inbox] Error emitiendo socket:', err.message)
  }

  console.log(`[Inbox] Tenant ${tenantId}: registrada respuesta de ${socio.apellidoNombre} (${fromAddress})`)
  return true
}

/**
 * Procesa el inbox de un tenant: conecta, busca no leídos, procesa, marca como leídos.
 * Retorna { procesados, errores }.
 */
export async function procesarInboxRecuperoTenant(tenant) {
  const db = createTenantPrisma(tenant.id)
  const cfg = await getImapConfig(db)
  if (!cfg) return { procesados: 0, errores: 0 }

  const client = new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.auth,
    logger: false,
  })

  let procesados = 0
  let errores = 0

  try {
    await client.connect()
    const lock = await client.getMailboxLock('INBOX')
    try {
      // Buscar no leídos del último día
      const desde = new Date()
      desde.setDate(desde.getDate() - 1)
      const uids = await client.search({ seen: false, since: desde })

      for (const uid of uids) {
        try {
          const message = await client.fetchOne(uid, { source: true })
          if (!message?.source) continue
          const parsed = await simpleParser(message.source)

          // Skip auto-responders / out-of-office
          const autoSubmitted = parsed.headers?.get('auto-submitted')
          if (autoSubmitted && autoSubmitted !== 'no') {
            console.log(`[Inbox] Skip auto-submitted (uid=${uid})`)
            await client.messageFlagsAdd(uid, ['\\Seen'])
            continue
          }

          const registrado = await procesarMensaje(db, tenant.id, parsed)
          if (registrado) procesados++

          // Marcar como leído de cualquier forma (procesado o no del socio) para no
          // procesar dos veces. Si no querés tocar leídos, podés usar una flag custom.
          await client.messageFlagsAdd(uid, ['\\Seen'])
        } catch (err) {
          errores++
          console.error(`[Inbox] Tenant ${tenant.id}: error procesando uid ${uid}:`, err.message)
        }
      }
    } finally {
      lock.release()
    }
  } catch (err) {
    errores++
    console.error(`[Inbox] Tenant ${tenant.id}: error de conexión:`, err.message)
  } finally {
    try { await client.logout() } catch {}
  }

  return { procesados, errores }
}

/**
 * Procesa el inbox de TODOS los tenants activos con IMAP habilitado.
 */
export async function procesarInboxRecuperoTodos() {
  const tenants = await prisma.tenant.findMany({ where: { activo: true } })
  let totalProc = 0
  let totalErr = 0
  for (const tenant of tenants) {
    try {
      const { procesados, errores } = await procesarInboxRecuperoTenant(tenant)
      totalProc += procesados
      totalErr += errores
    } catch (err) {
      totalErr++
      console.error(`[Inbox] Tenant ${tenant.id}: ${err.message}`)
    }
  }
  return { procesados: totalProc, errores: totalErr }
}
