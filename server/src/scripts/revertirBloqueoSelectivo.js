/**
 * Reversión selectiva del bloqueo masivo aplicado por aplicarBloqueoMorosidad.js.
 *
 * Identifica los socios afectados via eventos `BLOQUEADO_MOROSIDAD` con origen
 * 'MANUAL_BULK' recientes y los reparte:
 *   - Sin fechaBaja previa → VIGENTE (eran activos).
 *   - Con fechaBaja previa → BAJA_POR_RENUNCIA (eran bajas por otro motivo).
 *
 * Uso:
 *   node src/scripts/revertirBloqueoSelectivo.js --tenant sportivopilar          # dry-run
 *   node src/scripts/revertirBloqueoSelectivo.js --tenant sportivopilar --apply  # ejecutar
 */
import prisma from '../lib/prisma.js'

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const idxTenant = args.indexOf('--tenant')
const tenantArg = idxTenant >= 0 ? args[idxTenant + 1] : null

if (!tenantArg) {
  console.error('❌ Falta --tenant <id|slug>')
  process.exit(1)
}

const tenant = await prisma.tenant.findFirst({
  where: /^\d+$/.test(tenantArg) ? { id: parseInt(tenantArg) } : { slug: tenantArg },
  select: { id: true, slug: true },
})
if (!tenant) { console.error('Tenant no encontrado'); process.exit(1) }

console.log(`\n=== Reversión selectiva — ${tenant.slug} ===`)
console.log(`Modo: ${APPLY ? '🛑 EJECUTAR' : 'dry-run (sin --apply)'}\n`)

// Estados destino
const estados = await prisma.estadoSocio.findMany({
  where: { tenantId: tenant.id, codigo: { in: ['VIGENTE', 'BAJA_POR_RENUNCIA', 'BAJA_POR_MOROSIDAD'] } },
  select: { id: true, codigo: true },
})
const vigente = estados.find(e => e.codigo === 'VIGENTE')
const bajaRenuncia = estados.find(e => e.codigo === 'BAJA_POR_RENUNCIA')
const bajaMorosidad = estados.find(e => e.codigo === 'BAJA_POR_MOROSIDAD')

if (!vigente || !bajaRenuncia || !bajaMorosidad) {
  console.error('❌ Faltan estados VIGENTE / BAJA_POR_RENUNCIA / BAJA_POR_MOROSIDAD')
  process.exit(1)
}

// Identificar socios afectados por el bulk reciente
const eventos = await prisma.auditoriaSocio.findMany({
  where: { tenantId: tenant.id, evento: 'BLOQUEADO_MOROSIDAD', origen: 'MANUAL_BULK' },
  select: { socioId: true },
})
const ids = [...new Set(eventos.map(e => e.socioId))]
console.log(`Socios afectados por el bulk: ${ids.length}`)

if (ids.length === 0) { console.log('Nada para revertir.'); process.exit(0) }

// Clasificar por fechaBaja previa
const socios = await prisma.socio.findMany({
  where: { id: { in: ids }, estadoSocioId: bajaMorosidad.id },
  select: { id: true, fechaBaja: true },
})
const aVigente = socios.filter(s => !s.fechaBaja).map(s => s.id)
const aRenuncia = socios.filter(s => !!s.fechaBaja).map(s => s.id)

console.log(`  → a VIGENTE (sin fechaBaja previa): ${aVigente.length}`)
console.log(`  → a BAJA_POR_RENUNCIA (con fechaBaja previa): ${aRenuncia.length}`)

if (!APPLY) {
  console.log('\nAgregá --apply para ejecutar.')
  process.exit(0)
}

if (aVigente.length > 0) {
  const r = await prisma.socio.updateMany({
    where: { id: { in: aVigente } },
    data: { estadoSocioId: vigente.id, fechaBaja: null, motivoBaja: null },
  })
  console.log(`✅ ${r.count} socios → VIGENTE`)
}
if (aRenuncia.length > 0) {
  const r = await prisma.socio.updateMany({
    where: { id: { in: aRenuncia } },
    data: { estadoSocioId: bajaRenuncia.id },
  })
  console.log(`✅ ${r.count} socios → BAJA_POR_RENUNCIA (motivoBaja y fechaBaja preservados)`)
}

// Registrar eventos de reversión
for (const sid of aVigente) {
  await prisma.auditoriaSocio.create({
    data: { tenantId: tenant.id, socioId: sid, evento: 'ACTIVADO_PAGO',
      detalle: { motivo: 'reversion_bulk_a_vigente' }, origen: 'MANUAL_BULK' },
  })
}
for (const sid of aRenuncia) {
  await prisma.auditoriaSocio.create({
    data: { tenantId: tenant.id, socioId: sid, evento: 'BAJA_SOCIO',
      detalle: { motivo: 'reversion_bulk_a_baja_renuncia', estadoNuevoCodigo: 'BAJA_POR_RENUNCIA' }, origen: 'MANUAL_BULK' },
  })
}
console.log(`✅ ${aVigente.length + aRenuncia.length} eventos de reversión registrados.`)
process.exit(0)
