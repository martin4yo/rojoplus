/**
 * Sincroniza MovimientoCaja.conceptoTesoreriaId a partir de sus ítems.
 *
 * Se ejecuta DESPUÉS de backfillItemMovimientoCaja.js y backfillItemMovimientoCaja2.js.
 * Hasta ahora estos dos pasos se corrían como SQL suelto; quedan versionados acá.
 *
 * Por qué hace falta: el reporte "Ingresos y Egresos por Concepto" agrupa por
 * MovimientoCaja.conceptoTesoreriaId. Si queda null, agrupa por el texto del
 * concepto y genera cientos de filas sueltas.
 *
 * Pasos:
 *  1. Movimientos cuyos ítems apuntan todos a un mismo ConceptoTesoreria
 *     → copiar ese CT al padre. (SQL masivo)
 *  2. Los que siguen en null → match del texto `concepto` contra
 *     ConceptoTesoreria.nombre del mismo tenant → actualizar padre y
 *     los ítems que hayan quedado sin CT.
 *
 * Uso:
 *   node server/src/scripts/backfillSyncConceptoPadre.js
 *   node server/src/scripts/backfillSyncConceptoPadre.js --dry-run
 *   node server/src/scripts/backfillSyncConceptoPadre.js --tenant 1
 */

import { PrismaClient } from '@prisma/client'
import 'dotenv/config'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')
const TENANT_ARG = (() => {
  const idx = process.argv.indexOf('--tenant')
  return idx >= 0 ? parseInt(process.argv[idx + 1]) : null
})()

// ─── Paso 1: sync desde ítems coincidentes ─────────────────────────────────────

async function syncDesdeItems() {
  console.log('\n── Paso 1: padres con ítems de un único concepto ───────────────')

  // Misma condición en el conteo y en el update
  const candidatos = TENANT_ARG
    ? await prisma.$queryRaw`
        SELECT COUNT(*)::int AS n FROM movimientos_caja mc
        WHERE mc.concepto_tesoreria_id IS NULL AND mc.anulado = false
          AND mc.tenant_id = ${TENANT_ARG}
          AND (SELECT COUNT(DISTINCT i.concepto_tesoreria_id) FROM items_movimiento_caja i
               WHERE i.movimiento_caja_id = mc.id AND i.concepto_tesoreria_id IS NOT NULL) = 1`
    : await prisma.$queryRaw`
        SELECT COUNT(*)::int AS n FROM movimientos_caja mc
        WHERE mc.concepto_tesoreria_id IS NULL AND mc.anulado = false
          AND (SELECT COUNT(DISTINCT i.concepto_tesoreria_id) FROM items_movimiento_caja i
               WHERE i.movimiento_caja_id = mc.id AND i.concepto_tesoreria_id IS NOT NULL) = 1`

  const n = candidatos[0]?.n ?? 0

  if (DRY_RUN) {
    console.log(`  [DRY] se actualizarían ${n} movimientos`)
    return n
  }

  const afectados = TENANT_ARG
    ? await prisma.$executeRaw`
        UPDATE movimientos_caja mc
        SET concepto_tesoreria_id = (
          SELECT i.concepto_tesoreria_id FROM items_movimiento_caja i
          WHERE i.movimiento_caja_id = mc.id AND i.concepto_tesoreria_id IS NOT NULL LIMIT 1)
        WHERE mc.concepto_tesoreria_id IS NULL AND mc.anulado = false
          AND mc.tenant_id = ${TENANT_ARG}
          AND (SELECT COUNT(DISTINCT i.concepto_tesoreria_id) FROM items_movimiento_caja i
               WHERE i.movimiento_caja_id = mc.id AND i.concepto_tesoreria_id IS NOT NULL) = 1`
    : await prisma.$executeRaw`
        UPDATE movimientos_caja mc
        SET concepto_tesoreria_id = (
          SELECT i.concepto_tesoreria_id FROM items_movimiento_caja i
          WHERE i.movimiento_caja_id = mc.id AND i.concepto_tesoreria_id IS NOT NULL LIMIT 1)
        WHERE mc.concepto_tesoreria_id IS NULL AND mc.anulado = false
          AND (SELECT COUNT(DISTINCT i.concepto_tesoreria_id) FROM items_movimiento_caja i
               WHERE i.movimiento_caja_id = mc.id AND i.concepto_tesoreria_id IS NOT NULL) = 1`

  console.log(`  ✅ Padres actualizados: ${afectados}`)
  return afectados
}

// ─── Paso 2: match por texto del concepto ──────────────────────────────────────

const ctCache = {}
async function getCtsByTenant(tenantId) {
  if (!ctCache[tenantId]) {
    ctCache[tenantId] = await prisma.conceptoTesoreria.findMany({
      where: { tenantId },
      select: { id: true, nombre: true, codigo: true },
    })
  }
  return ctCache[tenantId]
}

async function syncPorTexto() {
  console.log('\n── Paso 2: match del texto del concepto contra CT.nombre ───────')

  const pendientes = await prisma.movimientoCaja.findMany({
    where: {
      conceptoTesoreriaId: null,
      anulado: false,
      ...(TENANT_ARG ? { tenantId: TENANT_ARG } : {}),
    },
    select: { id: true, tenantId: true, concepto: true },
  })

  console.log(`  Pendientes a evaluar: ${pendientes.length}`)

  let padres = 0
  let items = 0
  let sinMatch = 0
  const noMatcheados = {}

  for (const mov of pendientes) {
    if (!mov.concepto) { sinMatch++; continue }

    const cts = await getCtsByTenant(mov.tenantId)
    const ct = cts.find(c => c.nombre.toLowerCase() === mov.concepto.toLowerCase())

    if (!ct) {
      sinMatch++
      noMatcheados[mov.concepto] = (noMatcheados[mov.concepto] || 0) + 1
      continue
    }

    if (DRY_RUN) { padres++; continue }

    await prisma.$transaction(async (tx) => {
      await tx.movimientoCaja.update({
        where: { id: mov.id },
        data: { conceptoTesoreriaId: ct.id },
      })
      const r = await tx.itemMovimientoCaja.updateMany({
        where: { movimientoCajaId: mov.id, conceptoTesoreriaId: null },
        data: { conceptoTesoreriaId: ct.id },
      })
      items += r.count
    })
    padres++
  }

  console.log(`  ${DRY_RUN ? '[DRY] ' : '✅ '}Padres actualizados: ${padres} | Ítems actualizados: ${items}`)
  console.log(`  Sin match: ${sinMatch}`)

  const top = Object.entries(noMatcheados).sort((a, b) => b[1] - a[1]).slice(0, 15)
  if (top.length) {
    console.log('\n  Conceptos sin match (top 15) — revisar si corresponde crear el CT:')
    top.forEach(([k, v]) => console.log(`    ${String(v).padStart(5)}  ${k.slice(0, 70)}`))
  }

  return { padres, items, sinMatch }
}

// ─── Reporte final ─────────────────────────────────────────────────────────────

async function reportar() {
  const where = TENANT_ARG ? { tenantId: TENANT_ARG } : {}
  const sinCT = await prisma.movimientoCaja.count({
    where: { ...where, conceptoTesoreriaId: null, anulado: false },
  })
  const sinItems = await prisma.movimientoCaja.count({
    where: { ...where, anulado: false, items: { none: {} } },
  })
  console.log('\n══ Estado final ═══════════════════════════════════════════════')
  console.log(`  Movimientos sin conceptoTesoreriaId: ${sinCT}`)
  console.log(`  Movimientos sin ítems ..............: ${sinItems}`)
  console.log('  (las transferencias entre cajas quedan sin concepto a propósito)')
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Sync de conceptoTesoreriaId en el movimiento padre ${DRY_RUN ? '(DRY RUN)' : ''}`)
  if (TENANT_ARG) console.log(`Tenant: ${TENANT_ARG}`)

  await syncDesdeItems()
  await syncPorTexto()
  await reportar()

  await prisma.$disconnect()
}

main().catch(err => {
  console.error(err)
  prisma.$disconnect()
  process.exit(1)
})
