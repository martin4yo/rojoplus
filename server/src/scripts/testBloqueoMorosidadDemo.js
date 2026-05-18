/**
 * TEST CONTROLADO de bloqueo por morosidad — envía notificaciones a destinos DEMO.
 *
 * Para cada socioId pasado por args:
 *  1. Verifica que está en sportivotest (tenant 4) y habilitado.
 *  2. Lo bloquea (estadoSocioId → BAJA_POR_MOROSIDAD).
 *  3. Si es titular del grupo familiar, propaga el bloqueo a todos los miembros.
 *  4. Registra evento BLOQUEADO_MOROSIDAD en auditoría (con flag testBloqueo=true).
 *  5. Envía email + WhatsApp con el mensaje del cron (redirigidos a EMAIL_DEMO y WHATSAPP_DEMO_NUMERO porque MODO_DEMO=true).
 *
 * Modo revertir (--revert): deshace el bloqueo de los socios listados.
 *
 * Uso:
 *   node src/scripts/testBloqueoMorosidadDemo.js 17066 15181 16750 17948 20371
 *   node src/scripts/testBloqueoMorosidadDemo.js --revert 17066 15181 16750 17948 20371
 */
import prisma from '../lib/prisma.js'
import { registrarEvento } from '../services/auditoriaService.js'
import { buildVariables, resolverEmailBloqueo, resolverWaBloqueo } from '../services/morosidadTemplates.js'
import { encolarNotificacion, procesarNotificacionesPendientes } from '../services/notificacionService.js'

const args = process.argv.slice(2)
const REVERT = args.includes('--revert')
const SKIP_WA = args.includes('--no-wa')
const SKIP_EMAIL = args.includes('--no-email')
const FORCE_PREFS = args.includes('--prefs') // activa temporalmente notifEmail/notifWhatsapp
const nrosSocio = args.filter(a => /^\d+$/.test(a))

const TENANT_ID = 4

if (nrosSocio.length === 0) {
  console.error('❌ Pasá al menos un nroSocio. Ej: node src/scripts/testBloqueoMorosidadDemo.js 17066 15181')
  process.exit(1)
}

console.log(`\n=== TEST bloqueo morosidad — tenant id=${TENANT_ID} ===`)
console.log(`Modo: ${REVERT ? '↩ REVERTIR bloqueos' : '🛑 BLOQUEAR + notificar'}`)
console.log(`Socios objetivo: ${nrosSocio.join(', ')}`)
console.log(`Canales: ${SKIP_EMAIL ? '' : 'EMAIL '}${SKIP_WA ? '' : 'WHATSAPP'}\n`)

// Estados
const estados = await prisma.estadoSocio.findMany({
  where: { tenantId: TENANT_ID, rolVigencia: { in: ['BLOQUEADO', 'AL_DIA'] } },
  select: { id: true, codigo: true, nombre: true, rolVigencia: true },
})
const bloqueado = estados.find(e => e.rolVigencia === 'BLOQUEADO')
const alDia = estados.find(e => e.rolVigencia === 'AL_DIA')
if (!bloqueado || !alDia) {
  console.error('❌ Faltan EstadoSocio con rolVigencia BLOQUEADO o AL_DIA en tenant', TENANT_ID)
  process.exit(1)
}
console.log(`Estado BLOQUEADO: ${bloqueado.codigo} (id=${bloqueado.id})`)
console.log(`Estado AL_DIA   : ${alDia.codigo} (id=${alDia.id})\n`)

// Tenant info para el nombre del club en los mensajes
const tenant = await prisma.tenant.findUnique({ where: { id: TENANT_ID }, select: { slug: true, nombre: true } })
const clubNombre = tenant?.nombre || tenant?.slug || 'Club'

// Templates editables: usa EmailTemplate (BD) y Configuracion NOTIF_WA_BLOQUEO_MOROSIDAD_*
// con fallback a los defaults definidos en services/morosidadTemplates.js.

const reporte = []

for (const nroSocio of nrosSocio) {
  const socio = await prisma.socio.findFirst({
    where: { tenantId: TENANT_ID, nroSocio },
    select: {
      id: true, nroSocio: true, apellidoNombre: true, email: true, celular: true,
      titularFamiliaId: true, estadoSocioId: true,
      estadoSocioRel: { select: { codigo: true, esSocioActivo: true } },
    },
  })
  if (!socio) {
    console.log(`⚠️  Socio ${nroSocio} no encontrado en tenant ${TENANT_ID}, skip`)
    reporte.push({ nro: nroSocio, status: 'NO_ENCONTRADO' })
    continue
  }

  // Resolver familia
  const titularId = socio.titularFamiliaId || socio.id
  const miembros = await prisma.socio.findMany({
    where: { tenantId: TENANT_ID, OR: [{ id: titularId }, { titularFamiliaId: titularId }] },
    select: {
      id: true, nroSocio: true, apellidoNombre: true,
      email: true, celular: true,
      estadoSocioId: true,
      titularFamiliaId: true,
    },
  })

  if (REVERT) {
    // Revertir: cambiar a AL_DIA
    await prisma.socio.updateMany({
      where: { id: { in: miembros.map(m => m.id) } },
      data: { estadoSocioId: alDia.id, fechaBaja: null, motivoBaja: null },
    })
    console.log(`↩  ${socio.apellidoNombre} (#${socio.nroSocio}): familia (${miembros.length}) revertida a AL_DIA`)
    reporte.push({ nro: nroSocio, status: 'REVERTIDO', familia: miembros.length })
    continue
  }

  // Activar flags si --prefs (para superar opt-out de testing)
  if (FORCE_PREFS) {
    await prisma.socio.update({
      where: { id: socio.id },
      data: { notifEmail: true, notifWhatsapp: true, notificarMorosidad: true },
    })
    socio.notifEmail = true
    socio.notifWhatsapp = true
  }

  // BLOQUEAR familia
  const idsParaBloquear = miembros.filter(m => m.estadoSocioId !== bloqueado.id).map(m => m.id)
  if (idsParaBloquear.length > 0) {
    await prisma.socio.updateMany({
      where: { id: { in: idsParaBloquear } },
      data: { estadoSocioId: bloqueado.id },
    })
    // Auditoría
    for (const sid of idsParaBloquear) {
      await registrarEvento(prisma, {
        socioId: sid,
        tenantId: TENANT_ID,
        evento: 'BLOQUEADO_MOROSIDAD',
        detalle: { estadoNuevoId: bloqueado.id, estadoNuevoCodigo: bloqueado.codigo, testBloqueo: true },
        origen: 'TEST_DEMO',
        usuarioId: null,
      })
    }
  }

  // Construir variables del template
  const vars = await buildVariables({
    socio, club: clubNombre, clubUrl: null,
    cuotasVencidas: 0, deudaTotal: 0, listaCuotas: [],
  })

  // ENCOLAR (en lugar de enviar directo: el procesador maneja retries y backoff)
  let logEmailId = null, logWaId = null
  try {
    if (!SKIP_EMAIL && socio.email) {
      const { subject, html } = await resolverEmailBloqueo({ tenantId: TENANT_ID, socioId: socio.id, vars })
      const log = await encolarNotificacion({
        tenantId: TENANT_ID,
        tipo: 'EMAIL',
        eventType: 'BLOQUEO_MOROSIDAD',
        destinatario: socio.email,
        socioId: socio.id,
        asunto: subject,
        cuerpo: html,
        metadata: { test: true, variables: vars },
      })
      logEmailId = log.id
    }
  } catch (err) {
    console.error(`  email encolar error: ${err.message}`)
  }
  try {
    if (!SKIP_WA && socio.celular) {
      const { texto } = await resolverWaBloqueo({ tenantId: TENANT_ID, socioId: socio.id, vars })
      const log = await encolarNotificacion({
        tenantId: TENANT_ID,
        tipo: 'WHATSAPP',
        eventType: 'BLOQUEO_MOROSIDAD',
        destinatario: socio.celular,
        socioId: socio.id,
        cuerpo: texto,
        metadata: { test: true, variables: vars },
      })
      logWaId = log.id
    }
  } catch (err) {
    console.error(`  whatsapp encolar error: ${err.message}`)
  }

  console.log(`\n🛑 ${socio.apellidoNombre} (#${socio.nroSocio})`)
  console.log(`   Familia bloqueada: ${idsParaBloquear.length}/${miembros.length} miembros`)
  console.log(`   Email encolado:    ${logEmailId ? `NotificacionLog #${logEmailId}` : '(no encolado)'}`)
  console.log(`   WhatsApp encolado: ${logWaId ? `NotificacionLog #${logWaId}` : '(no encolado)'}`)

  reporte.push({
    nro: socio.nroSocio,
    nombre: socio.apellidoNombre,
    familia: `${idsParaBloquear.length}/${miembros.length}`,
    logEmail: logEmailId || '-',
    logWa: logWaId || '-',
  })
}

console.log('\n=== ENCOLADO ===')
console.table(reporte)

// Disparar el procesador AHORA para ver el resultado inmediato (1er intento)
console.log('\n⏩ Disparando procesarNotificacionesPendientes() para procesar la cola ahora mismo...\n')
const r = await procesarNotificacionesPendientes()
console.log(`Resultado procesador: enviadas=${r.exitosos}, en reintento=${r.fallidos - r.agotados}, agotaron=${r.agotados}, total=${r.total}`)

// Estado final de los logs encolados (filtrar por ID directo de logs creados)
const idsLogs = reporte.flatMap(r => [r.logEmail, r.logWa]).filter(v => typeof v === 'number')
const finalLogs = idsLogs.length > 0
  ? await prisma.notificacionLog.findMany({
      where: { id: { in: idsLogs } },
      orderBy: { id: 'asc' },
      select: { id: true, tipo: true, destinatario: true, enviado: true, intentos: true, error: true, fechaEnvio: true, fechaProgramado: true, socioId: true },
    })
  : []
console.log('\n=== ESTADO FINAL DE LA COLA ===')
console.table(finalLogs.map(l => ({
  id: l.id, tipo: l.tipo, socio: l.socioId,
  destino: l.destinatario.slice(0, 30),
  estado: l.enviado ? (l.error ? '⚠️  ENVIADO_CON_ERROR' : '✅ ENVIADO') : '⏳ PENDIENTE',
  intentos: l.intentos,
  error: l.error ? l.error.slice(0, 60) : '',
})))

console.log('\nDone. Revisá tu inbox en martin4yo@gmail.com y WhatsApp en 2304346897.')
console.log('Para revertir: node src/scripts/testBloqueoMorosidadDemo.js --revert ' + nrosSocio.join(' '))
process.exit(0)
