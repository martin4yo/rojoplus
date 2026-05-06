/**
 * Reasigna nroSocio a socios que quedaron fuera del rango configurado.
 *
 * Algunos socios fueron creados (vía aprobación de solicitudes) usando la lógica
 * legacy `max(nroSocio) + 1`, lo que les asignó números mayores al SOCIO_NRO_MAX
 * configurado para el tenant. Este script los reasigna secuencialmente al
 * primer hueco disponible dentro del rango.
 *
 * Estrategia:
 *   1. Lee SOCIO_NRO_MIN / SOCIO_NRO_MAX del tenant.
 *   2. Identifica socios con nroSocio > MAX.
 *   3. Calcula próximos números dentro del rango (max-en-rango + 1, ascendente).
 *   4. Reasigna en orden de fechaAlta/id (los más antiguos primero).
 *   5. Aborta si el rango disponible no alcanza para reasignar a todos.
 *
 * IMPORTANTE: Esto cambia el nroSocio visible al socio. No se preserva el viejo.
 *
 * Uso:
 *   node server/scripts/reasignar-socios-fuera-de-rango.js --tenant <slug> --dry-run
 *   node server/scripts/reasignar-socios-fuera-de-rango.js --tenant <slug> --apply
 *
 * Filtros opcionales para acotar a un rango de fechas de alta:
 *   --desde YYYY-MM-DD   (inclusive)
 *   --hasta YYYY-MM-DD   (exclusive)
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : null
}
function flag(name) { return process.argv.includes(`--${name}`) }

const TENANT_SLUG = arg('tenant')
const DRY_RUN = flag('dry-run') || !flag('apply')
const DESDE = arg('desde') ? new Date(arg('desde')) : null
const HASTA = arg('hasta') ? new Date(arg('hasta')) : null

async function main() {
  if (!TENANT_SLUG) {
    console.error('Falta --tenant <slug>')
    process.exit(1)
  }

  const tenant = await prisma.tenant.findUnique({ where: { subdomain: TENANT_SLUG } })
  if (!tenant) throw new Error(`Tenant ${TENANT_SLUG} no encontrado`)
  console.log(`\nTenant: ${TENANT_SLUG} (id=${tenant.id})`)
  console.log(`Modo: ${DRY_RUN ? '🟡 DRY-RUN (no aplica cambios)' : '🔴 APPLY (modifica BD)'}\n`)

  const [cfgMin, cfgMax] = await Promise.all([
    prisma.configuracion.findFirst({ where: { tenantId: tenant.id, clave: 'SOCIO_NRO_MIN' } }),
    prisma.configuracion.findFirst({ where: { tenantId: tenant.id, clave: 'SOCIO_NRO_MAX' } }),
  ])
  const min = cfgMin?.valor ? parseInt(cfgMin.valor, 10) : null
  const max = cfgMax?.valor ? parseInt(cfgMax.valor, 10) : null

  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    console.error(`Rango inválido o no configurado (SOCIO_NRO_MIN=${cfgMin?.valor ?? 'null'}, SOCIO_NRO_MAX=${cfgMax?.valor ?? 'null'})`)
    process.exit(1)
  }
  console.log(`Rango configurado: ${min} – ${max}`)
  if (DESDE || HASTA) {
    console.log(`Filtro fechaAlta: ${DESDE ? DESDE.toISOString().slice(0,10) : '-∞'} a ${HASTA ? HASTA.toISOString().slice(0,10) : '+∞'} (hasta exclusivo)`)
  }
  console.log()

  const socios = await prisma.socio.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, nroSocio: true, apellido: true, nombre: true, apellidoNombre: true, fechaAlta: true },
  })

  const parsed = socios.map(s => ({ ...s, n: parseInt(s.nroSocio, 10) })).filter(s => !isNaN(s.n) && s.n > 0)

  const fueraDeRango = parsed
    .filter(s => s.n > max)
    .filter(s => {
      if (!DESDE && !HASTA) return true
      if (!s.fechaAlta) return false
      const fa = new Date(s.fechaAlta)
      if (DESDE && fa < DESDE) return false
      if (HASTA && fa >= HASTA) return false
      return true
    })
    .sort((a, b) => {
      const ta = a.fechaAlta ? new Date(a.fechaAlta).getTime() : 0
      const tb = b.fechaAlta ? new Date(b.fechaAlta).getTime() : 0
      return ta - tb || a.id - b.id
    })

  if (fueraDeRango.length === 0) {
    console.log('No hay socios fuera de rango. Nada que hacer.')
    return
  }

  console.log(`Socios fuera de rango (n > ${max}): ${fueraDeRango.length}`)

  const enRango = parsed.filter(s => s.n >= min && s.n <= max).map(s => s.n)
  const usados = new Set(enRango)
  let cursor = enRango.length === 0 ? min : Math.max(...enRango) + 1

  const huecosDisponibles = max - cursor + 1
  if (huecosDisponibles < fueraDeRango.length) {
    console.error(`\n❌ Rango insuficiente: hay ${fueraDeRango.length} socios a reasignar pero solo quedan ${huecosDisponibles} números libres (${cursor}–${max}).`)
    console.error('   Ampliá SOCIO_NRO_MAX o liberá números antes de correr el script.')
    process.exit(1)
  }

  const reasignaciones = []
  for (const s of fueraDeRango) {
    while (usados.has(cursor)) cursor++
    if (cursor > max) {
      console.error(`\n❌ Se agotó el rango durante la reasignación.`)
      process.exit(1)
    }
    reasignaciones.push({ socio: s, nuevo: cursor })
    usados.add(cursor)
    cursor++
  }

  // Calcular cambios de nombres a mayúsculas
  for (const r of reasignaciones) {
    const ap = r.socio.apellido || ''
    const no = r.socio.nombre || ''
    const apNo = r.socio.apellidoNombre || ''
    const apU = ap.toUpperCase()
    const noU = no.toUpperCase()
    const apNoU = apNo.toUpperCase()
    r.nameChanges = {}
    if (ap !== apU) r.nameChanges.apellido = { from: ap, to: apU }
    if (no !== noU) r.nameChanges.nombre = { from: no, to: noU }
    if (apNo !== apNoU) r.nameChanges.apellidoNombre = { from: apNo, to: apNoU }
  }

  console.log('\nPlan de reasignación:')
  console.log('  ID    nroSocio actual → nuevo   Apellido y Nombre (→ MAYÚSCULAS si difiere)')
  for (const r of reasignaciones) {
    const apNo = r.socio.apellidoNombre || ''
    const apNoU = apNo.toUpperCase()
    const display = apNo === apNoU ? apNo : `${apNo}  →  ${apNoU}`
    console.log(`  ${String(r.socio.id).padEnd(6)} ${String(r.socio.nroSocio).padStart(8)} → ${String(r.nuevo).padStart(6)}   ${display}`)
  }

  if (DRY_RUN) {
    console.log('\n🟡 DRY-RUN: no se modificó la BD. Re-ejecutá con --apply para aplicar.')
    return
  }

  // Aplicar en transacción. Para evitar colisiones con el unique [tenantId, nroSocio]
  // durante el update, primero movemos a un valor temporal único y luego al final.
  await prisma.$transaction(async (tx) => {
    for (const r of reasignaciones) {
      await tx.socio.update({
        where: { id: r.socio.id },
        data: { nroSocio: `__tmp_${r.socio.id}` },
      })
    }
    for (const r of reasignaciones) {
      const data = { nroSocio: String(r.nuevo) }
      if (r.nameChanges?.apellido) data.apellido = r.nameChanges.apellido.to
      if (r.nameChanges?.nombre) data.nombre = r.nameChanges.nombre.to
      if (r.nameChanges?.apellidoNombre) data.apellidoNombre = r.nameChanges.apellidoNombre.to
      await tx.socio.update({
        where: { id: r.socio.id },
        data,
      })
    }
  })

  console.log(`\n✅ Reasignados ${reasignaciones.length} socios.`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
