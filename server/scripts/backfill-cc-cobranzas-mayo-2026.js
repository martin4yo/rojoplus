/**
 * Backfill de centroCostoId en MovimientoCaja generados por cobranza de cuotas
 * durante mayo 2026, usando la nueva cadena de fallback que incluye
 * Actividad.conceptoTesoreria.centroCostoId.
 *
 * Cadena nueva:
 *   1. cargo.centroCostoId
 *   2. categoriaActividad.conceptoTesoreria.centroCostoId
 *   3. categoriaActividad.actividad.conceptoTesoreria.centroCostoId   ← nuevo
 *   4. cargo.conceptoTesoreria.centroCostoId  (cuota social, viene del TipoSocio)
 *   5. conceptoPorDefecto.centroCostoId  (config CONCEPTO_COBRANZA_CUOTAS)
 *   6. caja.centroCostoId
 *
 * Modo:
 *   --dry-run  (default) — solo lista qué se actualizaría
 *   --apply    — ejecuta los UPDATEs dentro de una transacción
 *
 * Uso:
 *   DATABASE_URL="..." node server/scripts/backfill-cc-cobranzas-mayo-2026.js \
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

function resolverCC(cuota, conceptoPorDefecto, caja) {
  return (
    cuota.centroCostoId ??
    cuota.categoriaActividad?.conceptoTesoreria?.centroCostoId ??
    cuota.categoriaActividad?.actividad?.conceptoTesoreria?.centroCostoId ??
    cuota.conceptoTesoreria?.centroCostoId ??
    conceptoPorDefecto?.centroCostoId ??
    caja?.centroCostoId ??
    null
  )
}

function tipoCargoLabel(c) {
  if (c.categoriaActividad) {
    return `Actividad: ${c.categoriaActividad.actividad?.nombre || '?'} / ${c.categoriaActividad.nombre}`
  }
  return `Social: ${c.descripcion || c.categoria || '?'}`
}

async function main() {
  const tenant = await resolveTenant(prisma, 'backfill-cc-cobranzas-mayo-2026.js')
  const apply = flag('apply')

  // Rango mayo 2026 ART (UTC-3): 2026-05-01 00:00 ART = 2026-05-01 03:00 UTC
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
  if (!conceptoPorDefecto) {
    console.warn('⚠️  No hay configuración CONCEPTO_COBRANZA_CUOTAS o el concepto no existe. La cadena salta al CC de la caja.')
  } else {
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
    select: {
      id: true,
      numero: true,
      fecha: true,
      monto: true,
      cajaId: true,
      pagoId: true,
      centroCostoId: true,
      caja: { select: { id: true, nombre: true, centroCostoId: true } },
    },
    orderBy: { fecha: 'asc' },
  })

  console.log(`\nMovimientos de cobranza encontrados: ${movimientos.length}`)
  if (movimientos.length === 0) {
    console.log('Nada para procesar.')
    return
  }

  // 3) Agrupar por pagoId
  const pagoIds = [...new Set(movimientos.map(m => m.pagoId))]
  const movsPorPago = {}
  for (const m of movimientos) {
    if (!movsPorPago[m.pagoId]) movsPorPago[m.pagoId] = []
    movsPorPago[m.pagoId].push(m)
  }

  // 4) Cargos por pago (con todo el chain de relaciones)
  const cargos = await prisma.cargo.findMany({
    where: { pagoId: { in: pagoIds }, tenantId: tenant.id },
    include: {
      conceptoTesoreria: { select: { id: true, nombre: true, centroCostoId: true } },
      categoriaActividad: {
        include: {
          actividad: {
            include: {
              conceptoTesoreria: { select: { id: true, nombre: true, centroCostoId: true } },
            },
          },
          conceptoTesoreria: { select: { id: true, nombre: true, centroCostoId: true } },
        },
      },
    },
  })
  const cargosPorPago = {}
  for (const c of cargos) {
    if (!cargosPorPago[c.pagoId]) cargosPorPago[c.pagoId] = []
    cargosPorPago[c.pagoId].push(c)
  }

  // 5) Procesar
  const updates = []           // movimientos con CC nuevo único distinto
  const sinCambio = []         // ya tienen el CC correcto
  const necesitanRevision = [] // pagos con CCs múltiples bajo nueva lógica
  const sinCargos = []         // movimientos cuyo pago no tiene cargos (raros)

  for (const pagoId of pagoIds) {
    const movsDelPago = movsPorPago[pagoId]
    const cargosDelPago = cargosPorPago[pagoId] || []

    if (cargosDelPago.length === 0) {
      sinCargos.push({ pagoId, movs: movsDelPago })
      continue
    }

    // Calcular nuevo CC para cada cargo
    const ccPorCargo = cargosDelPago.map(c => ({
      cargo: c,
      newCC: resolverCC(c, conceptoPorDefecto, movsDelPago[0].caja),
    }))
    const nuevosCCs = [...new Set(ccPorCargo.map(x => x.newCC))]

    if (nuevosCCs.length === 1) {
      const newCC = nuevosCCs[0]
      for (const m of movsDelPago) {
        if (m.centroCostoId === newCC) {
          sinCambio.push({ mov: m, newCC })
        } else {
          updates.push({
            mov: m,
            oldCC: m.centroCostoId,
            newCC,
            pagoId,
            cargos: ccPorCargo.map(x => tipoCargoLabel(x.cargo)),
          })
        }
      }
    } else {
      // Múltiples CCs nuevos para este pago — no podemos auto-actualizar
      necesitanRevision.push({
        pagoId,
        movs: movsDelPago,
        cargos: ccPorCargo,
      })
    }
  }

  // 6) Cargar nombres de centros de costo para reporte
  const ccIds = new Set()
  updates.forEach(u => { if (u.oldCC) ccIds.add(u.oldCC); if (u.newCC) ccIds.add(u.newCC) })
  necesitanRevision.forEach(r => {
    r.movs.forEach(m => { if (m.centroCostoId) ccIds.add(m.centroCostoId) })
    r.cargos.forEach(c => { if (c.newCC) ccIds.add(c.newCC) })
  })
  const ccs = ccIds.size
    ? await prisma.centroCosto.findMany({
        where: { id: { in: [...ccIds] } },
        select: { id: true, codigo: true, nombre: true },
      })
    : []
  const ccLabel = (id) => {
    if (!id) return '—'
    const cc = ccs.find(x => x.id === id)
    return cc ? `${cc.codigo}-${cc.nombre}` : `#${id}`
  }

  // 7) Resumen
  console.log(`\n══════════════════════════════════════════`)
  console.log(`Total movimientos:      ${movimientos.length}`)
  console.log(`Pagos involucrados:     ${pagoIds.length}`)
  console.log(`Sin cambio:             ${sinCambio.length}`)
  console.log(`A actualizar:           ${updates.length}`)
  console.log(`Necesitan revisión:     ${necesitanRevision.reduce((s, r) => s + r.movs.length, 0)} (${necesitanRevision.length} pagos)`)
  console.log(`Sin cargos asociados:   ${sinCargos.reduce((s, r) => s + r.movs.length, 0)} (${sinCargos.length} pagos)`)
  console.log(`══════════════════════════════════════════\n`)

  if (updates.length > 0) {
    console.log('Actualizaciones (oldCC → newCC):')
    // Matriz oldCC → newCC con monto y cantidad
    const matriz = {}
    for (const u of updates) {
      const k = `${ccLabel(u.oldCC)} → ${ccLabel(u.newCC)}`
      if (!matriz[k]) matriz[k] = { count: 0, monto: 0 }
      matriz[k].count++
      matriz[k].monto += Number(u.mov.monto) || 0
    }
    for (const [k, v] of Object.entries(matriz)) {
      console.log(`  ${k}: ${v.count} movs, ${fmtMoney(v.monto)}`)
    }
    console.log('\nDetalle (primeros 30):')
    for (const u of updates.slice(0, 30)) {
      console.log(
        `  #${u.mov.id} ${u.mov.numero} ${u.mov.fecha.toISOString().slice(0, 10)} ` +
        `${fmtMoney(u.mov.monto)}  ${ccLabel(u.oldCC)} → ${ccLabel(u.newCC)}  ` +
        `[${u.cargos.slice(0, 3).join(', ')}${u.cargos.length > 3 ? ', …' : ''}]`
      )
    }
    if (updates.length > 30) console.log(`  … y ${updates.length - 30} más`)
  }

  if (necesitanRevision.length > 0) {
    console.log('\n⚠️  Pagos con CCs múltiples bajo nueva lógica (revisar manualmente):')
    for (const r of necesitanRevision.slice(0, 20)) {
      const ccsDetectados = [...new Set(r.cargos.map(x => ccLabel(x.newCC)))].join(', ')
      const ccsMov = [...new Set(r.movs.map(m => ccLabel(m.centroCostoId)))].join(', ')
      console.log(
        `  pago #${r.pagoId}: ${r.movs.length} mov(s) ` +
        `(actuales: ${ccsMov}) | nuevos: ${ccsDetectados}`
      )
    }
    if (necesitanRevision.length > 20) console.log(`  … y ${necesitanRevision.length - 20} pagos más`)
  }

  if (sinCargos.length > 0) {
    console.log(`\n⚠️  ${sinCargos.length} pago(s) sin cargos asociados — no se actualizan.`)
  }

  // 8) Aplicar
  if (!apply) {
    console.log('\n(Modo DRY-RUN — no se modificó nada. Para aplicar pasá --apply)')
    return
  }

  if (updates.length === 0) {
    console.log('\nNada para actualizar.')
    return
  }

  console.log(`\nAplicando ${updates.length} updates...`)
  await prisma.$transaction(async (tx) => {
    for (const u of updates) {
      await tx.movimientoCaja.update({
        where: { id: u.mov.id },
        data: { centroCostoId: u.newCC },
      })
    }
  })
  console.log(`✅ ${updates.length} movimientos actualizados.`)
}

main()
  .catch(err => {
    console.error('❌ Error:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
