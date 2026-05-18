/**
 * Aplica el bloqueo por morosidad SIN enviar notificaciones.
 * Replica la lógica del cron de la 1AM pero on-demand y sin avisos.
 *
 *   - Cambia el estado de los socios morosos a BLOQUEADO (BAJA_POR_MOROSIDAD).
 *   - Registra eventos BLOQUEADO_MOROSIDAD en auditoría con origen 'MANUAL_BULK'.
 *   - Marca cada evento con `detalle.notificadoEn = now` para que el cron de
 *     notificación NO los reenvíe si se activa después.
 *
 * Uso:
 *   node src/scripts/aplicarBloqueoMorosidad.js --tenant sportivopilar          # ejecutar
 *   node src/scripts/aplicarBloqueoMorosidad.js --tenant sportivopilar --revert # deshacer
 *
 * Requiere --tenant (id o slug) y --apply para ejecutar (sin eso es dry-run).
 */
import prisma from '../lib/prisma.js'
import { recalcularTenant } from '../services/vigenciaService.js'

const args = process.argv.slice(2)
const REVERT = args.includes('--revert')
const APPLY = args.includes('--apply') || REVERT
const idxTenant = args.indexOf('--tenant')
const tenantArg = idxTenant >= 0 ? args[idxTenant + 1] : null

if (!tenantArg) {
  console.error('❌ Falta --tenant <id|slug>')
  process.exit(1)
}

const tenant = await prisma.tenant.findFirst({
  where: /^\d+$/.test(tenantArg) ? { id: parseInt(tenantArg) } : { slug: tenantArg },
  select: { id: true, slug: true, nombre: true },
})
if (!tenant) {
  console.error(`❌ Tenant no encontrado: ${tenantArg}`)
  process.exit(1)
}

console.log(`\n=== ${REVERT ? 'REVERTIR' : 'APLICAR'} bloqueo morosidad — ${tenant.slug} (id=${tenant.id}) ===`)
console.log(`Modo: ${APPLY ? '🛑 EJECUTAR (cambios reales)' : 'dry-run (sin --apply, no se modifica nada)'}\n`)

// Estados de vigencia
const estados = await prisma.estadoSocio.findMany({
  where: { tenantId: tenant.id, rolVigencia: { in: ['BLOQUEADO', 'AL_DIA'] } },
  select: { id: true, codigo: true, nombre: true, rolVigencia: true },
})
const bloqueado = estados.find(e => e.rolVigencia === 'BLOQUEADO')
const alDia = estados.find(e => e.rolVigencia === 'AL_DIA')
if (!bloqueado || !alDia) {
  console.error('❌ Faltan estados con rolVigencia BLOQUEADO y AL_DIA en este tenant')
  process.exit(1)
}
console.log(`Estado BLOQUEADO: ${bloqueado.codigo} (id=${bloqueado.id})`)
console.log(`Estado AL_DIA:    ${alDia.codigo} (id=${alDia.id})\n`)

if (REVERT) {
  // Buscar eventos BLOQUEADO_MOROSIDAD recientes con origen MANUAL_BULK no notificados externamente
  const eventos = await prisma.auditoriaSocio.findMany({
    where: {
      tenantId: tenant.id,
      evento: 'BLOQUEADO_MOROSIDAD',
      origen: 'MANUAL_BULK',
    },
    select: { id: true, socioId: true, fecha: true },
    orderBy: { fecha: 'desc' },
  })
  if (eventos.length === 0) {
    console.log('No hay eventos previos de bloqueo manual para revertir.')
    process.exit(0)
  }
  const socioIds = [...new Set(eventos.map(e => e.socioId))]
  console.log(`Eventos a revertir: ${eventos.length} (${socioIds.length} socios únicos)`)

  if (!APPLY) {
    console.log('\n(dry-run; no se modifica nada). Para ejecutar agregá --apply')
    process.exit(0)
  }

  // Cambiar estado a AL_DIA solo de los que están BLOQUEADOS
  const r = await prisma.socio.updateMany({
    where: { id: { in: socioIds }, estadoSocioId: bloqueado.id },
    data: { estadoSocioId: alDia.id },
  })
  console.log(`✅ Socios revertidos a VIGENTE: ${r.count}`)

  // Registrar evento de reversión
  for (const sid of socioIds) {
    await prisma.auditoriaSocio.create({
      data: {
        tenantId: tenant.id, socioId: sid,
        evento: 'REACTIVADO_PAGO',
        detalle: { motivo: 'reversion_bulk_manual' },
        origen: 'MANUAL_BULK',
      },
    })
  }
  console.log(`✅ Registrados ${socioIds.length} eventos REACTIVADO_PAGO`)
  process.exit(0)
}

// MODO APLICAR
if (!APPLY) {
  console.log('Para aplicar el bloqueo de verdad, agregá el flag --apply.')
  console.log('Ejemplo: node src/scripts/aplicarBloqueoMorosidad.js --tenant sportivopilar --apply')
  process.exit(0)
}

console.log('Ejecutando recalcularTenant...')
const r = await recalcularTenant(prisma, tenant.id, { origen: 'MANUAL_BULK', usuarioId: null })
if (r.skip) {
  console.log(`⚠️  Skip: ${r.skip}`)
  process.exit(1)
}
console.log(`✅ Bloqueados (nuevos): ${r.bloqueados}`)
console.log(`✅ Reactivados (ya no morosos): ${r.reactivados}`)
console.log(`   Familias morosas evaluadas: ${r.familiasMorosas}`)

// Marcar eventos recién creados como ya notificados (para que el cron de notif los skipee)
const desde = new Date(Date.now() - 5 * 60 * 1000) // últimos 5 min
const eventosCreados = await prisma.auditoriaSocio.findMany({
  where: {
    tenantId: tenant.id,
    evento: 'BLOQUEADO_MOROSIDAD',
    origen: 'MANUAL_BULK',
    fecha: { gte: desde },
  },
  select: { id: true, detalle: true },
})
let marcados = 0
for (const e of eventosCreados) {
  await prisma.auditoriaSocio.update({
    where: { id: e.id },
    data: {
      detalle: {
        ...(e.detalle || {}),
        notificadoEn: new Date().toISOString(),
        notificadoCanales: { email: false, whatsapp: false },
        motivoNoNotificacion: 'aplicado_manualmente_sin_aviso',
      },
    },
  })
  marcados++
}
console.log(`✅ Marcados ${marcados} eventos como ya notificados (no se enviarán avisos)`)

console.log(`\nPara revertir: node src/scripts/aplicarBloqueoMorosidad.js --tenant ${tenant.slug} --revert`)
process.exit(0)
