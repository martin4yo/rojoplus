/**
 * Informe focalizado: diferencia entre saldo de cuenta corriente actual
 * y suma de cuotas pendientes por socio.
 *
 * El saldoCC se calcula como: sum(cargos no anulados) - sum(pagos confirmados)
 * El adeudado real es:        sum(cargos PENDIENTES)
 *
 * Ambos deberían coincidir. Cuando difieren significa que hay cargos PAGADOS
 * cuyos pagos no cuadran exactamente:
 *   - delta = saldoCC - adeudado
 *   - delta > 0 → cargos PAGADOS sin pago suficiente (faltan pagos)
 *   - delta < 0 → pagos en exceso sin cargo (saldo a favor real o pagos sueltos)
 *
 * Uso:
 *   node server/scripts/informe-cc-vs-pendientes.js --tenant sportivopilar
 *   node server/scripts/informe-cc-vs-pendientes.js --tenant sportivopilar --csv reporte.csv
 */

import { PrismaClient } from '@prisma/client'
import fs from 'fs'

const prisma = new PrismaClient()

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : null
}

const TENANT_SLUG = arg('tenant') || 'sportivopilar'
const CSV_PATH = arg('csv')
const TOLERANCIA = parseFloat(arg('tolerancia') || '0.01')

function fmt(n) {
  return Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } })
  if (!tenant) throw new Error(`Tenant '${TENANT_SLUG}' no existe`)

  console.log(`Tenant: ${TENANT_SLUG} (id=${tenant.id})\n`)

  const [cargosTodos, cargosPend, pagos, saldosFavor, socios] = await Promise.all([
    prisma.cargo.groupBy({
      by: ['socioId'],
      where: { tenantId: tenant.id, estado: { not: 'ANULADO' } },
      _sum: { montoTotal: true },
    }),
    prisma.cargo.groupBy({
      by: ['socioId'],
      where: { tenantId: tenant.id, estado: 'PENDIENTE' },
      _sum: { montoTotal: true },
      _count: true,
    }),
    prisma.pago.groupBy({
      by: ['socioId'],
      where: { tenantId: tenant.id, estado: 'CONFIRMADO' },
      _sum: { montoTotal: true },
    }),
    prisma.saldoFavor.groupBy({
      by: ['socioId'],
      where: { tenantId: tenant.id, montoDisponible: { gt: 0 } },
      _sum: { montoDisponible: true },
    }),
    prisma.socio.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, nroSocio: true, apellidoNombre: true },
      orderBy: { nroSocio: 'asc' },
    }),
  ])

  const cargosBySocio = new Map(cargosTodos.map(r => [r.socioId, Number(r._sum.montoTotal || 0)]))
  const pendBySocio = new Map(cargosPend.map(r => [r.socioId, { monto: Number(r._sum.montoTotal || 0), count: r._count }]))
  const pagosBySocio = new Map(pagos.map(r => [r.socioId, Number(r._sum.montoTotal || 0)]))
  const saldoFavBySocio = new Map(saldosFavor.map(r => [r.socioId, Number(r._sum.montoDisponible || 0)]))

  const filas = []
  for (const s of socios) {
    const cargosNoAnul = cargosBySocio.get(s.id) || 0
    const pagosConf = pagosBySocio.get(s.id) || 0
    const adeudado = pendBySocio.get(s.id)?.monto || 0
    const cuotasPend = pendBySocio.get(s.id)?.count || 0
    const saldoFav = saldoFavBySocio.get(s.id) || 0
    const saldoCC = cargosNoAnul - pagosConf
    const delta = saldoCC - adeudado

    if (cargosNoAnul === 0 && pagosConf === 0 && saldoFav === 0) continue

    filas.push({
      nroSocio: s.nroSocio, apellidoNombre: s.apellidoNombre,
      cargosNoAnul, pagosConf, saldoCC, adeudado, cuotasPend, saldoFav, delta,
      cuadra: Math.abs(delta) <= TOLERANCIA,
    })
  }

  const cuadran = filas.filter(f => f.cuadra)
  const noCuadran = filas.filter(f => !f.cuadra)
  const pagosExtra = noCuadran.filter(f => f.delta < 0)
  const cargosSinPago = noCuadran.filter(f => f.delta > 0)

  const sumaPagosExtra = pagosExtra.reduce((a, f) => a + Math.abs(f.delta), 0)
  const sumaCargosSinPago = cargosSinPago.reduce((a, f) => a + f.delta, 0)
  const sumaSaldoCC = filas.reduce((a, f) => a + f.saldoCC, 0)
  const sumaAdeudado = filas.reduce((a, f) => a + f.adeudado, 0)

  console.log('═'.repeat(120))
  console.log('INFORME: saldo cuenta corriente vs suma de cuotas pendientes')
  console.log('═'.repeat(120))
  console.log(`Total socios con movimientos:          ${filas.length}`)
  console.log(`  ✅ Cuadran (saldoCC = adeudado):     ${cuadran.length}  (${(cuadran.length / filas.length * 100).toFixed(1)}%)`)
  console.log(`  ❌ No cuadran:                       ${noCuadran.length}`)
  console.log(`     ↳ delta < 0 (pagos extras):      ${pagosExtra.length}    suma $${fmt(sumaPagosExtra)}`)
  console.log(`     ↳ delta > 0 (cargos sin pago):   ${cargosSinPago.length}    suma $${fmt(sumaCargosSinPago)}`)
  console.log()
  console.log(`Saldo CC global (sum):                 $${fmt(sumaSaldoCC)}`)
  console.log(`Adeudado global (sum cuotas pend):     $${fmt(sumaAdeudado)}`)
  console.log(`Diferencia neta:                       $${fmt(sumaSaldoCC - sumaAdeudado)}`)

  // Top pagos extras
  if (pagosExtra.length > 0) {
    console.log(`\n${'═'.repeat(120)}`)
    console.log(`TOP 30 - delta < 0 (saldoCC < adeudado, hay pagos en exceso)`)
    console.log('═'.repeat(120))
    console.log('  nro    nombre                                  saldoCC      adeudado   saldoFavor  delta')
    console.log('  ' + '-'.repeat(118))
    pagosExtra.sort((a, b) => a.delta - b.delta)
    for (const f of pagosExtra.slice(0, 30)) {
      const nom = (f.apellidoNombre || '').padEnd(38).slice(0, 38)
      console.log(
        `  ${String(f.nroSocio).padStart(6)}  ${nom}  ${fmt(f.saldoCC).padStart(11)}   ${fmt(f.adeudado).padStart(11)}   ${fmt(f.saldoFav).padStart(11)}  ${fmt(f.delta).padStart(11)}`
      )
    }
    if (pagosExtra.length > 30) console.log(`  ... y ${pagosExtra.length - 30} más`)
  }

  // Top cargos sin pago
  if (cargosSinPago.length > 0) {
    console.log(`\n${'═'.repeat(120)}`)
    console.log(`TOP 30 - delta > 0 (saldoCC > adeudado, faltan pagos)`)
    console.log('═'.repeat(120))
    console.log('  nro    nombre                                  saldoCC      adeudado   saldoFavor  delta')
    console.log('  ' + '-'.repeat(118))
    cargosSinPago.sort((a, b) => b.delta - a.delta)
    for (const f of cargosSinPago.slice(0, 30)) {
      const nom = (f.apellidoNombre || '').padEnd(38).slice(0, 38)
      console.log(
        `  ${String(f.nroSocio).padStart(6)}  ${nom}  ${fmt(f.saldoCC).padStart(11)}   ${fmt(f.adeudado).padStart(11)}   ${fmt(f.saldoFav).padStart(11)}  ${fmt(f.delta).padStart(11)}`
      )
    }
    if (cargosSinPago.length > 30) console.log(`  ... y ${cargosSinPago.length - 30} más`)
  }

  if (CSV_PATH) {
    const headers = ['nroSocio', 'apellidoNombre', 'cargosNoAnulados', 'pagosConfirmados', 'saldoCC', 'adeudado', 'cuotasPendientes', 'saldoFavor', 'delta', 'cuadra', 'tipo']
    const rows = [headers.join(',')]
    for (const f of filas) {
      const tipo = f.cuadra ? 'OK' : (f.delta < 0 ? 'PAGOS_EXTRAS' : 'CARGOS_SIN_PAGO')
      rows.push([
        f.nroSocio,
        `"${(f.apellidoNombre || '').replace(/"/g, '""')}"`,
        f.cargosNoAnul.toFixed(2),
        f.pagosConf.toFixed(2),
        f.saldoCC.toFixed(2),
        f.adeudado.toFixed(2),
        f.cuotasPend,
        f.saldoFav.toFixed(2),
        f.delta.toFixed(2),
        f.cuadra,
        tipo,
      ].join(','))
    }
    fs.writeFileSync(CSV_PATH, rows.join('\n'), 'utf-8')
    console.log(`\nCSV escrito en: ${CSV_PATH}`)
  }

  console.log()
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
