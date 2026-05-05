/**
 * Backfill v2 — Split de MovimientoCaja por CC para cobranzas de mayo 2026.
 *
 * Para cada Pago de cobranza en mayo 2026:
 *   1. Resolver el concepto (y por ende el CC) de cada Cargo del pago, con la
 *      cadena nueva.
 *   2. Agrupar los cargos por CC y sumar montos.
 *   3. Por cada MovimientoCaja viejo del pago, distribuir su monto
 *      proporcionalmente entre los CCs según los cargos.
 *      - Si todos los cargos resuelven al MISMO CC: simple update del MC.
 *      - Si resuelven a múltiples CCs: anular el MC viejo + crear N MCs nuevos,
 *        uno por CC, con monto proporcional.
 *
 * No toca:
 *   - El Pago (recibo) ni su numero
 *   - Los Cargos
 *   - Los Asientos contables
 *   - El campo denormalizado caja.saldoActual
 *
 * Modo:
 *   --dry-run (default) — solo lista
 *   --apply             — ejecuta updates dentro de transacción
 *
 * Uso:
 *   DATABASE_URL="..." node server/scripts/backfill-cc-split-mayo-2026.js \
 *     --tenant sportivopilar [--apply]
 */
import { PrismaClient } from '@prisma/client'
import { resolveTenant, flag } from './_lib/cli.js'

const prisma = new PrismaClient()

function fmtMoney(n) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(Number(n) || 0)
}

/**
 * Resuelve { conceptoId, conceptoNombre, centroCostoId } para un cargo,
 * usando la cadena nueva.
 */
function resolverConceptoYCC(cargo, conceptoPorDefecto) {
  // Cuota actividad: prioridad concepto de la categoría, luego concepto de la actividad
  const conceptoCat = cargo.categoriaActividad?.conceptoTesoreria
  if (conceptoCat?.activo) {
    return {
      conceptoId: conceptoCat.id,
      conceptoNombre: conceptoCat.nombre,
      centroCostoId: conceptoCat.centroCostoId ?? null,
    }
  }
  const conceptoAct = cargo.categoriaActividad?.actividad?.conceptoTesoreria
  if (conceptoAct?.activo) {
    return {
      conceptoId: conceptoAct.id,
      conceptoNombre: conceptoAct.nombre,
      centroCostoId: conceptoAct.centroCostoId ?? null,
    }
  }
  // Cuota social: concepto directo del cargo (viene del TipoSocio)
  if (cargo.conceptoTesoreria?.activo) {
    return {
      conceptoId: cargo.conceptoTesoreria.id,
      conceptoNombre: cargo.conceptoTesoreria.nombre,
      centroCostoId: cargo.conceptoTesoreria.centroCostoId ?? null,
    }
  }
  // Fallback: concepto por defecto
  if (conceptoPorDefecto) {
    return {
      conceptoId: conceptoPorDefecto.id,
      conceptoNombre: conceptoPorDefecto.nombre,
      centroCostoId: conceptoPorDefecto.centroCostoId ?? null,
    }
  }
  return { conceptoId: null, conceptoNombre: 'Sin concepto', centroCostoId: null }
}

async function main() {
  const tenant = await resolveTenant(prisma, 'backfill-cc-split-mayo-2026.js')
  const apply = flag('apply')

  const desde = new Date('2026-05-01T00:00:00-03:00')
  const hasta = new Date('2026-06-01T00:00:00-03:00')

  console.log(`\nModo: ${apply ? 'APPLY (escritura real)' : 'DRY-RUN (sin cambios)'}`)
  console.log(`Rango: ${desde.toISOString()} → ${hasta.toISOString()}`)

  // 1) Concepto por defecto del tenant
  const configConcepto = await prisma.configuracion.findFirst({
    where: { tenantId: tenant.id, clave: 'CONCEPTO_COBRANZA_CUOTAS' },
  })
  let conceptoPorDefecto = null
  if (configConcepto?.valor) {
    conceptoPorDefecto = await prisma.conceptoTesoreria.findUnique({
      where: { id: parseInt(configConcepto.valor) },
    })
  }
  if (conceptoPorDefecto) {
    console.log(`Concepto por defecto: ${conceptoPorDefecto.nombre} (CC=${conceptoPorDefecto.centroCostoId ?? '—'})`)
  }

  // 2) Movimientos en mayo 2026, no anulados, con pagoId
  const movimientos = await prisma.movimientoCaja.findMany({
    where: {
      tenantId: tenant.id,
      anulado: false,
      pagoId: { not: null },
      fecha: { gte: desde, lt: hasta },
    },
    orderBy: { fecha: 'asc' },
  })

  console.log(`\nMovimientos de cobranza encontrados: ${movimientos.length}`)
  if (movimientos.length === 0) return

  // Agrupar por pago
  const movsPorPago = {}
  for (const m of movimientos) {
    if (!movsPorPago[m.pagoId]) movsPorPago[m.pagoId] = []
    movsPorPago[m.pagoId].push(m)
  }
  const pagoIds = Object.keys(movsPorPago).map(Number)

  // 3) Cargar cargos con full chain
  const cargos = await prisma.cargo.findMany({
    where: { pagoId: { in: pagoIds }, tenantId: tenant.id },
    include: {
      conceptoTesoreria: { select: { id: true, nombre: true, centroCostoId: true, activo: true } },
      categoriaActividad: {
        include: {
          conceptoTesoreria: { select: { id: true, nombre: true, centroCostoId: true, activo: true } },
          actividad: {
            include: {
              conceptoTesoreria: { select: { id: true, nombre: true, centroCostoId: true, activo: true } },
            },
          },
        },
      },
    },
  })
  const cargosPorPago = {}
  for (const c of cargos) {
    if (!cargosPorPago[c.pagoId]) cargosPorPago[c.pagoId] = []
    cargosPorPago[c.pagoId].push(c)
  }

  // 4) Cargar centros de costo para mostrar nombres
  const allCcIds = new Set(movimientos.map(m => m.centroCostoId).filter(Boolean))
  const ccs = []
  if (allCcIds.size > 0) {
    const ccsList = await prisma.centroCosto.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, codigo: true, nombre: true },
    })
    ccs.push(...ccsList)
  }
  const ccIndex = new Map((await prisma.centroCosto.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, codigo: true, nombre: true },
  })).map(c => [c.id, c]))
  const ccLabel = (id) => {
    if (!id) return '—'
    const c = ccIndex.get(id)
    return c ? `${c.codigo}-${c.nombre}` : `#${id}`
  }

  // 5) Procesar cada pago
  const acciones = []   // { tipo: 'update' | 'split' | 'noop', mc, …detalle }
  const sinCargos = []
  const sinCC = []

  for (const pagoId of pagoIds) {
    const movsDelPago = movsPorPago[pagoId]
    const cargosDelPago = cargosPorPago[pagoId] || []
    if (cargosDelPago.length === 0) {
      sinCargos.push({ pagoId, movs: movsDelPago })
      continue
    }

    // Resolver concepto+CC y suma de cada cargo
    const cargosResueltos = cargosDelPago.map(c => {
      const r = resolverConceptoYCC(c, conceptoPorDefecto)
      return {
        cargoId: c.id,
        monto: Number(c.montoTotal),
        ...r,
      }
    })

    // Si algún cargo no tiene CC, marcar y omitir el pago
    const sinCcAlguno = cargosResueltos.find(c => !c.centroCostoId)
    if (sinCcAlguno) {
      sinCC.push({ pagoId, cargosResueltos })
      continue
    }

    // Agrupar por CC
    const grupos = {}  // ccId → { centroCostoId, monto, conceptoNombre }
    for (const c of cargosResueltos) {
      if (!grupos[c.centroCostoId]) {
        grupos[c.centroCostoId] = {
          centroCostoId: c.centroCostoId,
          monto: 0,
          conceptoNombre: c.conceptoNombre,
        }
      }
      grupos[c.centroCostoId].monto += c.monto
    }
    const ccsDelPago = Object.values(grupos)
    const totalCargos = cargosResueltos.reduce((s, c) => s + c.monto, 0)

    // Decidir acción por cada MC viejo
    for (const mc of movsDelPago) {
      if (ccsDelPago.length === 1) {
        const newCC = ccsDelPago[0].centroCostoId
        if (mc.centroCostoId === newCC) {
          acciones.push({ tipo: 'noop', mc, pagoId, newCC })
        } else {
          acciones.push({ tipo: 'update', mc, pagoId, oldCC: mc.centroCostoId, newCC, conceptoNombre: ccsDelPago[0].conceptoNombre })
        }
      } else {
        // SPLIT: distribuir mc.monto entre los CCs proporcionalmente al peso de cada CC
        // en el total de cargos del pago.
        const distribucion = ccsDelPago.map(g => ({
          centroCostoId: g.centroCostoId,
          conceptoNombre: g.conceptoNombre,
          // monto exacto antes de redondeo
          montoCalc: (Number(mc.monto) * g.monto) / totalCargos,
        }))
        // Redondear y repartir el residuo en el grupo más grande
        let acumulado = 0
        distribucion.forEach((d, i) => {
          d.monto = Math.round(d.montoCalc * 100) / 100
          acumulado += d.monto
        })
        const dif = Math.round((Number(mc.monto) - acumulado) * 100) / 100
        if (Math.abs(dif) > 0) {
          // Sumar el residuo al grupo de mayor monto
          const idxMax = distribucion.reduce((iMax, d, i, arr) => d.monto > arr[iMax].monto ? i : iMax, 0)
          distribucion[idxMax].monto = Math.round((distribucion[idxMax].monto + dif) * 100) / 100
        }
        acciones.push({ tipo: 'split', mc, pagoId, oldCC: mc.centroCostoId, distribucion })
      }
    }
  }

  // 6) Resumen
  const updates = acciones.filter(a => a.tipo === 'update')
  const splits = acciones.filter(a => a.tipo === 'split')
  const noops = acciones.filter(a => a.tipo === 'noop')

  console.log(`\n══════════════════════════════════════════`)
  console.log(`Total movimientos:             ${movimientos.length}`)
  console.log(`Pagos procesados:              ${pagoIds.length - sinCargos.length - sinCC.length}`)
  console.log(`Sin cambio:                    ${noops.length}`)
  console.log(`Updates simples:               ${updates.length}`)
  console.log(`Splits (anular + crear N):     ${splits.length} (van a generar ${splits.reduce((s, a) => s + a.distribucion.length, 0)} MCs nuevos)`)
  console.log(`Pagos sin cargos asociados:    ${sinCargos.length}`)
  console.log(`Pagos con cargos sin CC:       ${sinCC.length}`)
  console.log(`══════════════════════════════════════════\n`)

  // Detalle de updates
  if (updates.length > 0) {
    const matriz = {}
    for (const u of updates) {
      const k = `${ccLabel(u.oldCC)} → ${ccLabel(u.newCC)}`
      if (!matriz[k]) matriz[k] = { count: 0, monto: 0 }
      matriz[k].count++
      matriz[k].monto += Number(u.mc.monto) || 0
    }
    console.log('Updates simples (oldCC → newCC):')
    for (const [k, v] of Object.entries(matriz)) {
      console.log(`  ${k}: ${v.count} movs, ${fmtMoney(v.monto)}`)
    }
  }

  // Detalle de splits
  if (splits.length > 0) {
    console.log(`\nSplits (primeros 20):`)
    for (const s of splits.slice(0, 20)) {
      const pieces = s.distribucion.map(d => `${ccLabel(d.centroCostoId)}=${fmtMoney(d.monto)}`).join(', ')
      console.log(
        `  pago #${s.pagoId} MC #${s.mc.id} ${s.mc.numero} ${fmtMoney(s.mc.monto)} (CC actual ${ccLabel(s.oldCC)})`
      )
      console.log(`    → ${pieces}`)
    }
    if (splits.length > 20) console.log(`  … y ${splits.length - 20} splits más`)

    // Totales por CC destino
    const totDest = {}
    for (const s of splits) {
      for (const d of s.distribucion) {
        const k = ccLabel(d.centroCostoId)
        if (!totDest[k]) totDest[k] = { count: 0, monto: 0 }
        totDest[k].count++
        totDest[k].monto += d.monto
      }
    }
    console.log('\nTotales por CC destino (splits):')
    for (const [k, v] of Object.entries(totDest)) {
      console.log(`  ${k}: ${v.count} MCs nuevos, ${fmtMoney(v.monto)}`)
    }
  }

  if (sinCargos.length > 0) {
    console.log(`\n⚠️  ${sinCargos.length} pago(s) sin cargos asociados — no se actualizan.`)
    sinCargos.slice(0, 5).forEach(s => console.log(`   pago #${s.pagoId}`))
  }
  if (sinCC.length > 0) {
    console.log(`\n⚠️  ${sinCC.length} pago(s) con cargos sin CC resoluble — no se actualizan.`)
    sinCC.slice(0, 5).forEach(s => {
      const sinCCs = s.cargosResueltos.filter(c => !c.centroCostoId).map(c => `cargo #${c.cargoId} (${c.conceptoNombre})`).join(', ')
      console.log(`   pago #${s.pagoId}: ${sinCCs}`)
    })
  }

  if (!apply) {
    console.log('\n(Modo DRY-RUN — no se modificó nada. Para aplicar pasá --apply)')
    return
  }

  if (updates.length === 0 && splits.length === 0) {
    console.log('\nNada para actualizar.')
    return
  }

  // 7) Aplicar
  console.log(`\nAplicando ${updates.length} updates y ${splits.length} splits...`)

  await prisma.$transaction(async (tx) => {
    // Updates simples
    for (const u of updates) {
      await tx.movimientoCaja.update({
        where: { id: u.mc.id },
        data: { centroCostoId: u.newCC },
      })
    }

    // Splits
    if (splits.length > 0) {
      // Obtener correlativo actual para nuevos MCs
      const anioActual = new Date().getFullYear()
      const prefijo = `MV-${anioActual}-`
      const ultimo = await tx.movimientoCaja.findFirst({
        where: { tenantId: tenant.id, numero: { startsWith: prefijo } },
        orderBy: { numero: 'desc' },
      })
      let siguiente = ultimo
        ? (parseInt(ultimo.numero.split('-').pop()) || 0) + 1
        : 1

      for (const s of splits) {
        const oldMc = s.mc
        // Anular MC viejo
        await tx.movimientoCaja.update({
          where: { id: oldMc.id },
          data: {
            anulado: true,
            descripcion: `${oldMc.descripcion || ''} [Recategorizado por backfill CC mayo 2026]`.trim(),
          },
        })

        // Crear N MCs nuevos copiando atributos del viejo
        for (const d of s.distribucion) {
          if (d.monto <= 0) continue
          const numero = `${prefijo}${String(siguiente).padStart(5, '0')}`
          siguiente++
          await tx.movimientoCaja.create({
            data: {
              numero,
              fecha: oldMc.fecha,
              tipo: oldMc.tipo,
              cajaId: oldMc.cajaId,
              cuentaContableId: oldMc.cuentaContableId,
              medioPagoId: oldMc.medioPagoId,
              concepto: d.conceptoNombre,
              monto: d.monto,
              descripcion: oldMc.descripcion,
              pagoId: oldMc.pagoId,
              centroCostoId: d.centroCostoId,
              registradoPor: oldMc.registradoPor,
              conciliado: oldMc.conciliado,
              anulado: false,
              tenantId: tenant.id,
            },
          })
        }
      }
    }
  }, { timeout: 60_000 })

  console.log(`✅ Aplicado.`)
  console.log(`   Updates: ${updates.length}`)
  console.log(`   Splits: ${splits.length} MCs viejos anulados, ${splits.reduce((s, a) => s + a.distribucion.length, 0)} MCs nuevos creados`)
}

main()
  .catch(err => {
    console.error('❌ Error:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
