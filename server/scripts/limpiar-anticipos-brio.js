/**
 * Limpieza de cargos "ANTICIPO SOCIOS" importados desde Brio.
 *
 * Brio usa la cuenta "ANTICIPO SOCIOS" como cuenta de paso. Cada anticipo genera 2 líneas:
 *   - una positiva (entrada de plata real al club)
 *   - una negativa (consumo del anticipo cuando se aplica a una cuota concreta)
 *
 * El script de importación trató cada línea como un cargo+pago independiente, lo que
 * produce duplicación contable (un mismo flujo de plata aparece como pago propio del
 * anticipo Y como pago de la cuota destino).
 *
 * Este script clasifica cada socio en uno de tres casos:
 *
 *   A) NETO = 0  → doble import. Anular todos los cargos ANTICIPO + sus pagos exclusivos.
 *   B) NETO > 0  → anticipo todavía vigente (cargos negativos faltan). Anular cargos
 *                  ANTICIPO + sus pagos exclusivos, y CREAR un SaldoFavor por el neto.
 *   C) NETO < 0  → el positivo está antes del corte de importación (1/4/2025).
 *                  Anular solo los cargos negativos + sus pagos exclusivos.
 *
 * Si un pago a anular tiene OTROS cargos no-anticipo asociados (pago compartido),
 * se marca para revisión manual y NO se toca.
 *
 * Uso:
 *   node server/scripts/limpiar-anticipos-brio.js --tenant sportivopilar --dry-run
 *   node server/scripts/limpiar-anticipos-brio.js --tenant sportivopilar --apply
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : null
}
function flag(name) { return process.argv.includes(`--${name}`) }

const TENANT_SLUG = arg('tenant') || 'sportivopilar'
const DRY_RUN = flag('dry-run') || !flag('apply')
const VERBOSE = flag('verbose')
// Excluir socios específicos (--excluir 20384,20650,...)
const EXCLUIR = (arg('excluir') || '').split(',').map(s => s.trim()).filter(Boolean)

// Filtro para identificar cargos de anticipo
const FILTRO_ANTICIPO = {
  categoria: 'CONCEPTO',
  descripcion: { equals: 'ANTICIPO SOCIOS', mode: 'insensitive' },
}

function fmt(n) { return Number(n || 0).toFixed(2) }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('es-AR') : '-' }

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { subdomain: TENANT_SLUG } })
  if (!tenant) throw new Error(`Tenant ${TENANT_SLUG} no encontrado`)
  console.log(`\nTenant: ${TENANT_SLUG} (id=${tenant.id})`)
  console.log(`Modo: ${DRY_RUN ? '🟡 DRY-RUN (no aplica cambios)' : '🔴 APPLY (modifica BD)'}\n`)

  // Buscar admin para registrar el SaldoFavor (Admin es global; tomamos cualquier activo)
  const admin = await prisma.admin.findFirst({
    where: { activo: true },
    select: { id: true, nombre: true },
    orderBy: { id: 'asc' }
  })
  if (!admin && !DRY_RUN) throw new Error('No se encontró admin para registrar el saldo')

  // ── 1. Traer todos los cargos ANTICIPO del tenant ──
  const cargosAnticipo = await prisma.cargo.findMany({
    where: { tenantId: tenant.id, ...FILTRO_ANTICIPO },
    orderBy: [{ socioId: 'asc' }, { fechaGeneracion: 'asc' }],
    include: {
      socio: { select: { id: true, nroSocio: true, apellidoNombre: true } }
    }
  })
  console.log(`Cargos ANTICIPO SOCIOS encontrados: ${cargosAnticipo.length}\n`)

  // ── 2. Agrupar por socio ──
  const porSocio = new Map()
  let excluidos = 0
  for (const c of cargosAnticipo) {
    if (!c.socioId) continue
    if (EXCLUIR.includes(c.socio?.nroSocio)) { excluidos++; continue }
    if (!porSocio.has(c.socioId)) porSocio.set(c.socioId, { socio: c.socio, cargos: [] })
    porSocio.get(c.socioId).cargos.push(c)
  }
  if (excluidos > 0) console.log(`Cargos excluidos por --excluir: ${excluidos} (socios: ${EXCLUIR.join(', ')})\n`)

  console.log(`Socios afectados: ${porSocio.size}\n`)
  console.log('═'.repeat(120))

  // Acumuladores globales
  const resumen = { A: 0, B: 0, C: 0, sharedPagos: 0 }
  const totalCargosAnularSet = new Set()
  const totalPagosAnularSet = new Set()
  const saldosACrear = []      // [{ socioId, monto, motivo }]
  const pagosCompartidos = []  // pagos que NO se pueden anular automáticamente

  for (const [socioId, info] of porSocio) {
    const { socio, cargos } = info
    const positivos = cargos.filter(c => Number(c.montoTotal) > 0)
    const negativos = cargos.filter(c => Number(c.montoTotal) < 0)
    const sumaPos = positivos.reduce((s, c) => s + Number(c.montoTotal), 0)
    const sumaNeg = negativos.reduce((s, c) => s + Number(c.montoTotal), 0)  // negativo
    const neto = sumaPos + sumaNeg  // neto = pos − abs(neg)

    let caso, cargosAnular, descCaso
    if (Math.abs(neto) < 0.01) {
      caso = 'A'
      cargosAnular = cargos
      descCaso = 'doble import (anticipo aplicado completamente en Brio)'
    } else if (neto > 0) {
      caso = 'B'
      cargosAnular = cargos
      descCaso = `saldo vigente $${fmt(neto)} → crear SaldoFavor`
      saldosACrear.push({ socioId, nroSocio: socio.nroSocio, apellidoNombre: socio.apellidoNombre, monto: neto })
    } else {
      caso = 'C'
      cargosAnular = negativos
      descCaso = `positivos antes del corte $${fmt(-neto)} (no se tocan)`
    }
    resumen[caso]++

    // Identificar pagos a anular (los exclusivos del anticipo)
    const pagoIdsAnticipo = new Set(cargosAnular.map(c => c.pagoId).filter(Boolean))
    const pagosToCheck = []
    if (pagoIdsAnticipo.size > 0) {
      pagosToCheck.push(...await prisma.pago.findMany({
        where: { id: { in: Array.from(pagoIdsAnticipo) } },
        include: {
          cargos: { select: { id: true, descripcion: true, montoTotal: true, categoria: true } }
        }
      }))
    }

    const pagosExclusivos = []      // se pueden anular
    const pagosCompartidosLocal = [] // tienen otros cargos no-anticipo
    for (const p of pagosToCheck) {
      const otrosCargos = p.cargos.filter(c => !cargosAnular.find(ca => ca.id === c.id))
      if (otrosCargos.length === 0) pagosExclusivos.push(p)
      else pagosCompartidosLocal.push({ pago: p, otrosCargos })
    }

    if (pagosCompartidosLocal.length > 0) {
      resumen.sharedPagos += pagosCompartidosLocal.length
      pagosCompartidos.push({ socioId, nroSocio: socio.nroSocio, apellidoNombre: socio.apellidoNombre, items: pagosCompartidosLocal })
    }

    cargosAnular.forEach(c => totalCargosAnularSet.add(c.id))
    pagosExclusivos.forEach(p => totalPagosAnularSet.add(p.id))

    // Print
    console.log(`\n#${socio.nroSocio} ${socio.apellidoNombre}`)
    console.log(`  Cargos: +${positivos.length} ($${fmt(sumaPos)}), -${negativos.length} ($${fmt(-sumaNeg)})  →  Caso ${caso}: ${descCaso}`)
    console.log(`  Anular: ${cargosAnular.length} cargos | ${pagosExclusivos.length} pagos exclusivos${pagosCompartidosLocal.length > 0 ? ` | ⚠️  ${pagosCompartidosLocal.length} pago(s) COMPARTIDO(S) — requieren revisión manual` : ''}`)

    if (VERBOSE || pagosCompartidosLocal.length > 0) {
      for (const c of cargosAnular) {
        console.log(`    cargo #${c.id}  ${fmtDate(c.fechaGeneracion)}  $${fmt(c.montoTotal).padStart(10)}  pagoId=${c.pagoId ?? '(ninguno)'}`)
      }
      for (const sh of pagosCompartidosLocal) {
        console.log(`    ⚠️  pago #${sh.pago.id} ${sh.pago.numero} $${fmt(sh.pago.montoTotal)} comparte con: ${sh.otrosCargos.map(c => `[#${c.id} ${c.categoria} ${c.descripcion?.slice(0, 30)}]`).join(', ')}`)
      }
    }
  }

  console.log('\n' + '═'.repeat(120))
  console.log('\n📊 RESUMEN GLOBAL\n')
  console.log(`  Caso A (doble import): ${resumen.A} socios`)
  console.log(`  Caso B (saldo vigente): ${resumen.B} socios`)
  console.log(`  Caso C (positivos antes del corte): ${resumen.C} socios`)
  console.log(`  Pagos compartidos detectados: ${resumen.sharedPagos} (no se tocan automáticamente)`)
  console.log(`\n  Total cargos a anular: ${totalCargosAnularSet.size}`)
  console.log(`  Total pagos a anular: ${totalPagosAnularSet.size}`)
  console.log(`  Total saldos a favor a crear: ${saldosACrear.length}`)
  if (saldosACrear.length > 0) {
    const sumaSaldos = saldosACrear.reduce((s, x) => s + x.monto, 0)
    console.log(`     Suma: $${fmt(sumaSaldos)}`)
  }

  if (pagosCompartidos.length > 0) {
    console.log(`\n⚠️  ${pagosCompartidos.length} socios tienen pagos compartidos — revisar manualmente:`)
    for (const sh of pagosCompartidos) {
      console.log(`   - #${sh.nroSocio} ${sh.apellidoNombre}: ${sh.items.length} pago(s)`)
    }
  }

  if (DRY_RUN) {
    console.log(`\n🟡 DRY-RUN: no se aplicaron cambios. Para ejecutar, usar --apply.\n`)
    return
  }

  // ── 3. Aplicar cambios ──
  console.log(`\n🔴 APPLY: aplicando cambios...\n`)

  await prisma.$transaction(async (tx) => {
    // Anular pagos exclusivos: marcar estado=ANULADO + revertir saldo de caja
    for (const pagoId of totalPagosAnularSet) {
      const pago = await tx.pago.findUnique({
        where: { id: pagoId },
        include: { mediosPago: true }
      })
      if (!pago || pago.estado === 'ANULADO') continue
      // Revertir saldo de caja por cada split
      for (const mp of pago.mediosPago) {
        await tx.caja.update({
          where: { id: mp.cajaId },
          data: { saldoActual: { decrement: Number(mp.monto) } }
        }).catch(() => {})  // si la caja no existe, ignorar
      }
      // Si tenía caja primaria + monto en Pago, revertir también (legacy)
      if (pago.cajaId && pago.mediosPago.length === 0) {
        await tx.caja.update({
          where: { id: pago.cajaId },
          data: { saldoActual: { decrement: Number(pago.montoTotal) } }
        }).catch(() => {})
      }
      await tx.pago.update({
        where: { id: pagoId },
        data: {
          estado: 'ANULADO',
          fechaAnulacion: new Date(),
          motivoAnulacion: 'Limpieza ANTICIPO SOCIOS importado de Brio'
        }
      })
    }
    console.log(`  ✓ ${totalPagosAnularSet.size} pagos anulados`)

    // Anular cargos
    let cargosCount = 0
    for (const cargoId of totalCargosAnularSet) {
      await tx.cargo.update({
        where: { id: cargoId },
        data: { estado: 'ANULADO' }
      })
      cargosCount++
    }
    console.log(`  ✓ ${cargosCount} cargos anulados`)

    // Crear SaldoFavor para Caso B
    let saldosCount = 0
    for (const sf of saldosACrear) {
      await tx.saldoFavor.create({
        data: {
          socioId: sf.socioId,
          montoOriginal: sf.monto,
          montoDisponible: sf.monto,
          origen: 'AJUSTE',
          motivo: 'Anticipo migrado de Brio',
          observaciones: 'Generado automáticamente por limpiar-anticipos-brio.js — saldo neto positivo del concepto ANTICIPO SOCIOS al corte de importación.',
          registradoPor: admin.id,
          tenantId: tenant.id,
        }
      })
      saldosCount++
    }
    console.log(`  ✓ ${saldosCount} saldos a favor creados`)
  }, { maxWait: 60000, timeout: 600000 })

  console.log(`\n✅ Limpieza completa.\n`)
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
