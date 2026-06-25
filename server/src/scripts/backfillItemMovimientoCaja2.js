/**
 * Segunda pasada de backfill: maneja los 628 movimientos que quedaron sin ítems.
 *
 * Grupos:
 *  A) Ventas buffet/kiosco antiguas → ConceptoTesoreria ING-BUF
 *  B) Cobranzas de cuotas sin cargos vinculados al pagoId → match por nombre CT
 *  C) Anulaciones → copiar ítems del movimiento original (debe correr después de B)
 *
 * Uso:
 *   node server/src/scripts/backfillItemMovimientoCaja2.js
 *   node server/src/scripts/backfillItemMovimientoCaja2.js --dry-run
 */

import { PrismaClient } from '@prisma/client'
import 'dotenv/config'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

// Prefijos — algunos conceptos tienen texto adicional después del guión
const PREFIJOS_BUFFET = ['Kiosco', 'Take Away', 'Venta Buffet', 'Efectivo', 'Billeteras Virtuales']
const CONCEPTOS_CUOTA  = ['Socio Unico', 'Cuota FUTSAL', 'Cuota BASQUET', 'Cuota VOLEY', 'Cobranza de Cuotas']

// Cache de ConceptoTesoreria por tenant
const ctCache = {}
async function getCtsByTenant(tenantId) {
  if (!ctCache[tenantId]) {
    ctCache[tenantId] = await prisma.conceptoTesoreria.findMany({
      where: { tenantId },
      select: { id: true, nombre: true, codigo: true, cuentaContableId: true },
    })
  }
  return ctCache[tenantId]
}

async function matchCtPorNombre(tenantId, nombreConcepto) {
  const cts = await getCtsByTenant(tenantId)
  // Búsqueda exacta primero
  let ct = cts.find(c => c.nombre.toLowerCase() === nombreConcepto.toLowerCase())
  if (!ct) {
    // Búsqueda parcial: el nombre del concepto contiene la parte clave
    // "Cuota FUTSAL" → buscar CT con nombre que incluya "FUTSAL"
    const keyword = nombreConcepto.replace(/^cuota\s+/i, '').trim()
    ct = cts.find(c => c.nombre.toLowerCase().includes(keyword.toLowerCase()))
  }
  if (!ct) {
    // Para "Cobranza de Cuotas" (genérico), usar CUOTA_SOCIO_UNICO si existe
    ct = cts.find(c => c.codigo === 'CUOTA_SOCIO_UNICO') ||
         cts.find(c => c.codigo?.startsWith('CUOTA_'))
  }
  return ct ?? null
}

// ─── Grupo A: Ventas buffet/kiosco antiguas ────────────────────────────────────

async function procesarBuffetViejos() {
  console.log('\n── Grupo A: Ventas buffet/kiosco antiguas ──────────────────────')

  // Buscar ING-BUF por tenant (puede haber uno por tenant)
  const ingresosBuf = await prisma.conceptoTesoreria.findMany({
    where: { codigo: 'ING-BUF' },
    select: { id: true, tenantId: true, cuentaContableId: true },
  })
  const ingBufByTenant = Object.fromEntries(ingresosBuf.map(c => [c.tenantId, c]))

  const movs = await prisma.movimientoCaja.findMany({
    where: {
      anulado: false,
      items: { none: {} },
      OR: PREFIJOS_BUFFET.map(p => ({ concepto: { startsWith: p } })),
    },
    select: { id: true, tenantId: true, monto: true, concepto: true, descripcion: true,
              cuentaContableId: true, centroCostoId: true },
    orderBy: { id: 'asc' },
  })

  console.log(`  Encontrados: ${movs.length}`)
  let ok = 0, skip = 0, err = 0

  for (const mov of movs) {
    const ingBuf = ingBufByTenant[mov.tenantId]
    if (!ingBuf) {
      console.warn(`  ⚠️ Sin ING-BUF para tenant ${mov.tenantId} — mov #${mov.id} omitido`)
      skip++
      continue
    }
    const cuentaContableId = ingBuf.cuentaContableId || mov.cuentaContableId
    if (!cuentaContableId) { skip++; continue }

    if (DRY_RUN) {
      console.log(`  [DRY] #${mov.id} "${mov.concepto}" $${mov.monto} → ING-BUF id=${ingBuf.id}`)
      ok++
      continue
    }
    try {
      await prisma.$transaction(async (tx) => {
        const exists = await tx.itemMovimientoCaja.count({ where: { movimientoCajaId: mov.id } })
        if (exists > 0) return
        await tx.itemMovimientoCaja.create({
          data: {
            tenantId: mov.tenantId,
            movimientoCajaId: mov.id,
            conceptoTesoreriaId: ingBuf.id,
            cuentaContableId,
            centroCostoId: mov.centroCostoId ?? null,
            monto: Number(mov.monto),
            descripcion: mov.descripcion?.replace('undefined', '').trim() || mov.concepto,
            orden: 0,
          },
        })
      })
      ok++
    } catch (e) {
      console.error(`  ❌ #${mov.id}: ${e.message}`)
      err++
    }
  }
  console.log(`  ✅ Creados: ${ok} | Omitidos: ${skip} | Errores: ${err}`)
}

// ─── Grupo B: Cobranzas de cuotas sin cargos vinculados ───────────────────────

async function procesarCuotasSinCargos() {
  console.log('\n── Grupo B: Cobranzas de cuotas sin cargos vinculados ──────────')

  const movs = await prisma.movimientoCaja.findMany({
    where: { anulado: false, concepto: { in: CONCEPTOS_CUOTA }, items: { none: {} } },
    select: { id: true, tenantId: true, monto: true, concepto: true, descripcion: true,
              cuentaContableId: true, centroCostoId: true },
    orderBy: { id: 'asc' },
  })

  console.log(`  Encontrados: ${movs.length}`)
  let ok = 0, skip = 0, err = 0

  for (const mov of movs) {
    const ct = await matchCtPorNombre(mov.tenantId, mov.concepto)
    if (!ct) {
      console.warn(`  ⚠️ Sin ConceptoTesoreria para "${mov.concepto}" (tenant ${mov.tenantId}) — mov #${mov.id} omitido`)
      skip++
      continue
    }
    const cuentaContableId = ct.cuentaContableId || mov.cuentaContableId
    if (!cuentaContableId) { skip++; continue }

    if (DRY_RUN) {
      console.log(`  [DRY] #${mov.id} "${mov.concepto}" $${mov.monto} → ${ct.codigo} id=${ct.id}`)
      ok++
      continue
    }
    try {
      await prisma.$transaction(async (tx) => {
        const exists = await tx.itemMovimientoCaja.count({ where: { movimientoCajaId: mov.id } })
        if (exists > 0) return
        await tx.itemMovimientoCaja.create({
          data: {
            tenantId: mov.tenantId,
            movimientoCajaId: mov.id,
            conceptoTesoreriaId: ct.id,
            cuentaContableId,
            centroCostoId: mov.centroCostoId ?? null,
            monto: Number(mov.monto),
            descripcion: mov.descripcion ?? mov.concepto,
            orden: 0,
          },
        })
      })
      ok++
    } catch (e) {
      console.error(`  ❌ #${mov.id}: ${e.message}`)
      err++
    }
  }
  console.log(`  ✅ Creados: ${ok} | Omitidos: ${skip} | Errores: ${err}`)
}

// ─── Grupo C: Anulaciones ──────────────────────────────────────────────────────

async function procesarAnulaciones() {
  console.log('\n── Grupo C: Anulaciones ────────────────────────────────────────')

  const movs = await prisma.movimientoCaja.findMany({
    where: {
      anulado: false,
      concepto: { startsWith: 'Anulación' },
      items: { none: {} },
      movimientoRelacionadoId: { not: null },
    },
    select: { id: true, tenantId: true, monto: true, concepto: true, descripcion: true,
              cuentaContableId: true, centroCostoId: true, movimientoRelacionadoId: true },
    orderBy: { id: 'asc' },
  })

  console.log(`  Encontrados: ${movs.length}`)
  let ok = 0, skip = 0, err = 0

  for (const mov of movs) {
    const original = await prisma.movimientoCaja.findUnique({
      where: { id: mov.movimientoRelacionadoId },
      include: { items: true },
    })

    if (!original?.items?.length) {
      console.warn(`  ⚠️ Original #${mov.movimientoRelacionadoId} sin ítems — mov #${mov.id} omitido`)
      skip++
      continue
    }

    // Distribuir el monto de la anulación en proporción a los ítems del original
    const totalOriginal = original.items.reduce((s, i) => s + Number(i.monto), 0)
    const montoAnulacion = Number(mov.monto)
    let asignado = 0
    const itemsACrear = original.items.map((item, i) => {
      const esUltimo = i === original.items.length - 1
      const montoItem = esUltimo
        ? Math.round((montoAnulacion - asignado) * 100) / 100
        : Math.round(montoAnulacion * (totalOriginal > 0 ? Number(item.monto) / totalOriginal : 1 / original.items.length) * 100) / 100
      asignado += montoItem
      return {
        tenantId: mov.tenantId,
        movimientoCajaId: mov.id,
        conceptoTesoreriaId: item.conceptoTesoreriaId,
        cuentaContableId: item.cuentaContableId,
        centroCostoId: item.centroCostoId,
        monto: montoItem,
        descripcion: mov.descripcion ?? mov.concepto,
        orden: i,
      }
    }).filter(i => i.monto > 0)

    if (DRY_RUN) {
      console.log(`  [DRY] #${mov.id} "${mov.concepto}" $${mov.monto} → ${itemsACrear.length} ítem(s) copiados de original #${original.id}`)
      ok++
      continue
    }
    try {
      await prisma.$transaction(async (tx) => {
        const exists = await tx.itemMovimientoCaja.count({ where: { movimientoCajaId: mov.id } })
        if (exists > 0) return
        for (const item of itemsACrear) {
          await tx.itemMovimientoCaja.create({ data: item })
        }
      })
      ok++
    } catch (e) {
      console.error(`  ❌ #${mov.id}: ${e.message}`)
      err++
    }
  }
  console.log(`  ✅ Creados: ${ok} | Omitidos: ${skip} | Errores: ${err}`)
}

// ─── Reporte final ─────────────────────────────────────────────────────────────

async function reportarSinItems() {
  const total = await prisma.movimientoCaja.count({
    where: { anulado: false, items: { none: {} } },
  })
  console.log(`\n══ Movimientos sin ítems restantes: ${total} ══════════════════`)
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Backfill ItemMovimientoCaja — segunda pasada ${DRY_RUN ? '(DRY RUN)' : ''}`)

  await procesarBuffetViejos()
  await procesarCuotasSinCargos() // B debe correr antes que C
  await procesarAnulaciones()
  await reportarSinItems()

  await prisma.$disconnect()
}

main().catch(err => {
  console.error(err)
  prisma.$disconnect()
  process.exit(1)
})
