/**
 * Informe agrupado por GRUPO FAMILIAR de saldo CC vs cuotas pendientes.
 *
 * Para cada titular (socio sin titularFamiliaId), suma su propia cuenta
 * corriente + la de todos sus miembrosFamilia. Reporta donde:
 *
 *     saldoCC familia ≠ adeudado familia
 *
 * Diferencia respecto a informe-cc-vs-pendientes.js: trabaja a nivel familia,
 * que es lo que el usuario ve realmente en la cuenta corriente del titular
 * con `incluirFamilia=true`.
 *
 * Uso:
 *   node server/scripts/informe-cc-vs-pendientes-familia.js --tenant sportivopilar
 *   node server/scripts/informe-cc-vs-pendientes-familia.js --tenant sportivopilar --csv reporte.csv
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
      select: { id: true, nroSocio: true, apellidoNombre: true, titularFamiliaId: true },
    }),
  ])

  const cargosBy = new Map(cargosTodos.map(r => [r.socioId, Number(r._sum.montoTotal || 0)]))
  const pendBy = new Map(cargosPend.map(r => [r.socioId, { monto: Number(r._sum.montoTotal || 0), count: r._count }]))
  const pagosBy = new Map(pagos.map(r => [r.socioId, Number(r._sum.montoTotal || 0)]))
  const sfBy = new Map(saldosFavor.map(r => [r.socioId, Number(r._sum.montoDisponible || 0)]))
  const socioById = new Map(socios.map(s => [s.id, s]))

  // Agrupar por titular: si socio.titularFamiliaId está, va a la familia del titular.
  // Si es titular (titularFamiliaId=null), es su propia familia.
  const familias = new Map() // titularId → { titular, miembros: [], totales }

  for (const s of socios) {
    const titularId = s.titularFamiliaId || s.id
    if (!familias.has(titularId)) {
      familias.set(titularId, {
        titular: socioById.get(titularId),
        miembros: [],
        cargosNoAnul: 0, pagosConf: 0, adeudado: 0, cuotasPend: 0, saldoFav: 0,
      })
    }
    const f = familias.get(titularId)
    if (s.id !== titularId) f.miembros.push(s)
    f.cargosNoAnul += cargosBy.get(s.id) || 0
    f.pagosConf += pagosBy.get(s.id) || 0
    f.adeudado += pendBy.get(s.id)?.monto || 0
    f.cuotasPend += pendBy.get(s.id)?.count || 0
    f.saldoFav += sfBy.get(s.id) || 0
  }

  const filas = []
  for (const f of familias.values()) {
    if (!f.titular) continue
    if (f.cargosNoAnul === 0 && f.pagosConf === 0 && f.saldoFav === 0) continue
    const saldoCC = f.cargosNoAnul - f.pagosConf
    const delta = saldoCC - f.adeudado
    filas.push({
      nroSocio: f.titular.nroSocio,
      apellidoNombre: f.titular.apellidoNombre,
      cantMiembros: f.miembros.length,
      cargosNoAnul: f.cargosNoAnul,
      pagosConf: f.pagosConf,
      saldoCC,
      adeudado: f.adeudado,
      cuotasPend: f.cuotasPend,
      saldoFav: f.saldoFav,
      delta,
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
  console.log('INFORME POR GRUPO FAMILIAR: saldo cuenta corriente vs cuotas pendientes')
  console.log('═'.repeat(120))
  console.log(`Total familias con movimientos:        ${filas.length}`)
  console.log(`  ✅ Cuadran (saldoCC = adeudado):     ${cuadran.length}  (${(cuadran.length / filas.length * 100).toFixed(1)}%)`)
  console.log(`  ❌ No cuadran:                       ${noCuadran.length}`)
  console.log(`     ↳ delta < 0 (pagos extras):      ${pagosExtra.length}    suma $${fmt(sumaPagosExtra)}`)
  console.log(`     ↳ delta > 0 (cargos sin pago):   ${cargosSinPago.length}    suma $${fmt(sumaCargosSinPago)}`)
  console.log()
  console.log(`Saldo CC global (familias):            $${fmt(sumaSaldoCC)}`)
  console.log(`Adeudado global (cuotas pend):         $${fmt(sumaAdeudado)}`)
  console.log(`Diferencia neta:                       $${fmt(sumaSaldoCC - sumaAdeudado)}`)

  if (pagosExtra.length > 0) {
    console.log(`\n${'═'.repeat(120)}`)
    console.log(`TOP 30 - delta < 0 (pagos extras a nivel familia)`)
    console.log('═'.repeat(120))
    console.log('  nro    titular                                  miem  saldoCC      adeudado    saldoFavor   delta')
    console.log('  ' + '-'.repeat(118))
    pagosExtra.sort((a, b) => a.delta - b.delta)
    for (const f of pagosExtra.slice(0, 30)) {
      const nom = (f.apellidoNombre || '').padEnd(38).slice(0, 38)
      console.log(
        `  ${String(f.nroSocio).padStart(6)}  ${nom}  ${String(f.cantMiembros).padStart(3)}   ${fmt(f.saldoCC).padStart(11)}  ${fmt(f.adeudado).padStart(11)}  ${fmt(f.saldoFav).padStart(11)}   ${fmt(f.delta).padStart(11)}`
      )
    }
    if (pagosExtra.length > 30) console.log(`  ... y ${pagosExtra.length - 30} más`)
  }

  if (cargosSinPago.length > 0) {
    console.log(`\n${'═'.repeat(120)}`)
    console.log(`TOP 30 - delta > 0 (faltan pagos a nivel familia)`)
    console.log('═'.repeat(120))
    console.log('  nro    titular                                  miem  saldoCC      adeudado    saldoFavor   delta')
    console.log('  ' + '-'.repeat(118))
    cargosSinPago.sort((a, b) => b.delta - a.delta)
    for (const f of cargosSinPago.slice(0, 30)) {
      const nom = (f.apellidoNombre || '').padEnd(38).slice(0, 38)
      console.log(
        `  ${String(f.nroSocio).padStart(6)}  ${nom}  ${String(f.cantMiembros).padStart(3)}   ${fmt(f.saldoCC).padStart(11)}  ${fmt(f.adeudado).padStart(11)}  ${fmt(f.saldoFav).padStart(11)}   ${fmt(f.delta).padStart(11)}`
      )
    }
    if (cargosSinPago.length > 30) console.log(`  ... y ${cargosSinPago.length - 30} más`)
  }

  if (CSV_PATH) {
    const headers = ['nroTitular', 'apellidoNombre', 'cantMiembros', 'cargosNoAnulados', 'pagosConfirmados', 'saldoCC', 'adeudado', 'cuotasPendientes', 'saldoFavor', 'delta', 'cuadra', 'tipo']
    const rows = [headers.join(',')]
    for (const f of filas) {
      const tipo = f.cuadra ? 'OK' : (f.delta < 0 ? 'PAGOS_EXTRAS' : 'CARGOS_SIN_PAGO')
      rows.push([
        f.nroSocio,
        `"${(f.apellidoNombre || '').replace(/"/g, '""')}"`,
        f.cantMiembros,
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
