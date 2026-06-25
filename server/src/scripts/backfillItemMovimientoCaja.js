/**
 * Backfill de ItemMovimientoCaja para movimientos históricos.
 *
 * Estrategias por orden de prioridad:
 *  1. conceptoTesoreriaId ya seteado → 1 ítem directo
 *  2. pagoId → cargos del pago, agrupados por conceptoTesoreriaId
 *  3. comandaId → items de comanda, agrupados por conceptoVenta
 *  4. pedidoTakeAwayId → items del pedido, agrupados por conceptoVenta
 *  5. Sin ningún ancla → se omite (movimientos manuales tesorería ya tienen ítems)
 *
 * Uso:
 *   node server/src/scripts/backfillItemMovimientoCaja.js
 *   node server/src/scripts/backfillItemMovimientoCaja.js --dry-run
 *   node server/src/scripts/backfillItemMovimientoCaja.js --tenant 1
 */

import { PrismaClient } from '@prisma/client'
import 'dotenv/config'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')
const TENANT_ARG = (() => {
  const idx = process.argv.indexOf('--tenant')
  return idx >= 0 ? parseInt(process.argv[idx + 1]) : null
})()
const BATCH = 200

// ─── Utilidades ────────────────────────────────────────────────────────────────

function distribuirProporcional(monto, grupos) {
  const total = grupos.reduce((s, g) => s + g.monto, 0)
  let asignado = 0
  return grupos.map((g, i) => {
    const esUltimo = i === grupos.length - 1
    const montoItem = esUltimo
      ? Math.round((monto - asignado) * 100) / 100
      : Math.round(monto * (total > 0 ? g.monto / total : 1 / grupos.length) * 100) / 100
    asignado += montoItem
    return { ...g, montoItem }
  }).filter(g => g.montoItem > 0)
}

async function crearItems(tx, movId, tenantId, items) {
  for (const [i, g] of items.entries()) {
    await tx.itemMovimientoCaja.create({
      data: {
        tenantId,
        movimientoCajaId: movId,
        conceptoTesoreriaId: g.conceptoTesoreriaId ?? null,
        cuentaContableId: g.cuentaContableId,
        centroCostoId: g.centroCostoId ?? null,
        monto: g.montoItem,
        descripcion: g.descripcion ?? null,
        orden: i,
      },
    })
  }
}

// ─── Estrategias ───────────────────────────────────────────────────────────────

/** Estrategia 1: conceptoTesoreriaId ya seteado en el movimiento */
async function estrategia1(mov) {
  const ct = await prisma.conceptoTesoreria.findUnique({
    where: { id: mov.conceptoTesoreriaId },
    select: { cuentaContableId: true },
  })
  return [{
    conceptoTesoreriaId: mov.conceptoTesoreriaId,
    cuentaContableId: ct?.cuentaContableId || mov.cuentaContableId,
    centroCostoId: mov.centroCostoId,
    monto: Number(mov.monto),
    montoItem: Number(mov.monto),
    descripcion: mov.descripcion,
  }]
}

/** Estrategia 2: pagoId → cargos del pago */
async function estrategia2(mov) {
  const cargos = await prisma.cargo.findMany({
    where: { pagoId: mov.pagoId },
    include: { conceptoTesoreria: { select: { cuentaContableId: true } } },
  })
  if (!cargos.length) return null

  const grupos = {}
  for (const c of cargos) {
    const key = c.conceptoTesoreriaId ?? 'sin'
    if (!grupos[key]) {
      grupos[key] = {
        conceptoTesoreriaId: c.conceptoTesoreriaId ?? null,
        cuentaContableId: c.conceptoTesoreria?.cuentaContableId || mov.cuentaContableId,
        centroCostoId: c.centroCostoId ?? mov.centroCostoId,
        monto: 0,
        descripcion: mov.descripcion,
      }
    }
    grupos[key].monto += Number(c.montoTotal)
  }

  return distribuirProporcional(Number(mov.monto), Object.values(grupos))
}

/** Estrategia 3: comandaId → items de comanda */
async function estrategia3(mov) {
  const comanda = await prisma.comanda.findUnique({
    where: { id: mov.comandaId },
    include: {
      items: {
        where: { estado: { not: 'ANULADO' } },
        include: {
          productoBuffet: {
            include: { producto: { include: { conceptoVenta: { select: { id: true, cuentaContableId: true } } } } },
          },
        },
      },
    },
  })
  if (!comanda?.items.length) return null

  const grupos = {}
  for (const item of comanda.items) {
    const cv = item.productoBuffet?.producto?.conceptoVenta
    const key = cv?.id ?? 'sin'
    if (!grupos[key]) {
      grupos[key] = {
        conceptoTesoreriaId: cv?.id ?? null,
        cuentaContableId: cv?.cuentaContableId || mov.cuentaContableId,
        centroCostoId: mov.centroCostoId,
        monto: 0,
        descripcion: mov.descripcion,
      }
    }
    grupos[key].monto += Number(item.subtotal)
  }

  return distribuirProporcional(Number(mov.monto), Object.values(grupos))
}

/** Estrategia 4: pedidoTakeAwayId → items del pedido */
async function estrategia4(mov) {
  const pedido = await prisma.pedidoTakeAway.findUnique({
    where: { id: mov.pedidoTakeAwayId },
    include: {
      items: {
        where: { estado: { not: 'ANULADO' } },
        include: {
          productoBuffet: {
            include: { producto: { include: { conceptoVenta: { select: { id: true, cuentaContableId: true } } } } },
          },
        },
      },
    },
  })
  if (!pedido?.items.length) return null

  const grupos = {}
  for (const item of pedido.items) {
    const cv = item.productoBuffet?.producto?.conceptoVenta
    const key = cv?.id ?? 'sin'
    if (!grupos[key]) {
      grupos[key] = {
        conceptoTesoreriaId: cv?.id ?? null,
        cuentaContableId: cv?.cuentaContableId || mov.cuentaContableId,
        centroCostoId: mov.centroCostoId,
        monto: 0,
        descripcion: mov.descripcion,
      }
    }
    grupos[key].monto += Number(item.subtotal)
  }

  return distribuirProporcional(Number(mov.monto), Object.values(grupos))
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function procesarTenant(tenantId) {
  let totalProcesados = 0
  let totalCreados = 0
  let totalOmitidos = 0
  const errores = []

  console.log(`\n── Tenant ${tenantId} ──────────────────────────────`)

  // Usamos cursor-based pagination: siempre skip:0 porque los registros procesados
  // salen del filtro items:{none:{}}, así el resultado encoge y no saltamos filas.
  let lastId = 0

  while (true) {
    const movimientos = await prisma.movimientoCaja.findMany({
      where: {
        tenantId,
        anulado: false,
        id: { gt: lastId },
        items: { none: {} },
      },
      select: {
        id: true, monto: true, concepto: true, descripcion: true,
        cuentaContableId: true, centroCostoId: true, tenantId: true,
        conceptoTesoreriaId: true,
        pagoId: true, comandaId: true, pedidoTakeAwayId: true,
      },
      take: BATCH,
      orderBy: { id: 'asc' },
    })

    if (!movimientos.length) break
    lastId = movimientos[movimientos.length - 1].id

    for (const mov of movimientos) {
      totalProcesados++
      try {
        let items = null

        if (mov.conceptoTesoreriaId) {
          items = await estrategia1(mov)
        } else if (mov.pagoId) {
          items = await estrategia2(mov)
        } else if (mov.comandaId) {
          items = await estrategia3(mov)
        } else if (mov.pedidoTakeAwayId) {
          items = await estrategia4(mov)
        }

        if (!items?.length) {
          totalOmitidos++
          continue
        }

        if (DRY_RUN) {
          console.log(`  [DRY] mov #${mov.id} → ${items.length} ítem(s)`, items.map(g => `$${g.montoItem} ct=${g.conceptoTesoreriaId}`).join(', '))
        } else {
          await prisma.$transaction(async (tx) => {
            // Verificar que sigue sin ítems (idempotencia)
            const existing = await tx.itemMovimientoCaja.count({ where: { movimientoCajaId: mov.id } })
            if (existing > 0) return
            await crearItems(tx, mov.id, tenantId, items)
          })
        }
        totalCreados++
      } catch (err) {
        errores.push({ movId: mov.id, error: err.message })
        console.error(`  ❌ mov #${mov.id}: ${err.message}`)
      }
    }

    process.stdout.write(`  Procesados: ${totalProcesados} | Con ítems: ${totalCreados} | Omitidos: ${totalOmitidos}\r`)
  }

  console.log(`\n  ✅ Total: ${totalProcesados} | Con ítems: ${totalCreados} | Omitidos (sin ancla): ${totalOmitidos} | Errores: ${errores.length}`)
  return { totalProcesados, totalCreados, totalOmitidos, errores }
}

async function main() {
  console.log(`Backfill ItemMovimientoCaja ${DRY_RUN ? '(DRY RUN)' : ''}`)

  const tenants = TENANT_ARG
    ? [{ id: TENANT_ARG }]
    : await prisma.tenant.findMany({ select: { id: true }, orderBy: { id: 'asc' } })

  console.log(`Tenants a procesar: ${tenants.map(t => t.id).join(', ')}`)

  let grandTotal = 0, grandCreados = 0, grandOmitidos = 0

  for (const t of tenants) {
    const r = await procesarTenant(t.id)
    grandTotal += r.totalProcesados
    grandCreados += r.totalCreados
    grandOmitidos += r.totalOmitidos
  }

  console.log(`\n══ TOTAL GLOBAL ══════════════════════════════════`)
  console.log(`  Procesados: ${grandTotal} | Con ítems: ${grandCreados} | Sin ancla: ${grandOmitidos}`)
  await prisma.$disconnect()
}

main().catch(err => {
  console.error(err)
  prisma.$disconnect()
  process.exit(1)
})
