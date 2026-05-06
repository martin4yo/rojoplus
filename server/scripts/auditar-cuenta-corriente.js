/**
 * Auditoría read-only de cuenta corriente de socios.
 *
 * Verifica la identidad contable que debería cumplirse para cada socio:
 *
 *     saldoCC = adeudado - saldoFavorDisponible
 *
 *   donde:
 *     saldoCC               = sum(cargos no anulados) - sum(pagos confirmados)
 *     adeudado              = sum(montoTotal de cargos con estado='PENDIENTE')
 *     saldoFavorDisponible  = sum(montoDisponible de SaldoFavor activos)
 *
 * No modifica nada. Reporta:
 *   - Socios con inconsistencia (diferencia != 0)
 *   - Top deudores
 *   - Totales globales
 *
 * Uso:
 *   node server/scripts/auditar-cuenta-corriente.js --tenant sportivopilar
 *   node server/scripts/auditar-cuenta-corriente.js --tenant sportivopilar --hasta 2026-04-30
 *   node server/scripts/auditar-cuenta-corriente.js --tenant sportivopilar --solo-inconsistencias
 *   node server/scripts/auditar-cuenta-corriente.js --tenant sportivopilar --csv reporte.csv
 */

import { PrismaClient } from '@prisma/client'
import fs from 'fs'

const prisma = new PrismaClient()

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : null
}
function flag(name) { return process.argv.includes(`--${name}`) }

const TENANT_SLUG = arg('tenant') || 'sportivopilar'
const HASTA = arg('hasta') ? new Date(arg('hasta') + 'T23:59:59') : null
const SOLO_INCONSISTENCIAS = flag('solo-inconsistencias')
const CSV_PATH = arg('csv')
const TOLERANCIA = parseFloat(arg('tolerancia') || '0.01')

function fmt(n) {
  return Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } })
  if (!tenant) throw new Error(`Tenant '${TENANT_SLUG}' no existe`)

  console.log(`Tenant: ${TENANT_SLUG} (id=${tenant.id})`)
  if (HASTA) console.log(`Corte: hasta ${HASTA.toISOString().slice(0, 10)} (inclusive)`)
  console.log(`Tolerancia para diferencia: $${TOLERANCIA}\n`)

  // Filtros base
  const cargoWhere = {
    tenantId: tenant.id,
    estado: { not: 'ANULADO' },
    ...(HASTA ? { fechaGeneracion: { lte: HASTA } } : {}),
  }
  const pagoWhere = {
    tenantId: tenant.id,
    estado: 'CONFIRMADO',
    ...(HASTA ? { fecha: { lte: HASTA } } : {}),
  }
  const saldoWhere = {
    tenantId: tenant.id,
    montoDisponible: { gt: 0 },
    ...(HASTA ? { fecha: { lte: HASTA } } : {}),
  }

  // Cargar agregados por socio
  console.log('Cargando datos...')

  const [cargosAgg, cargosPendAgg, pagosAgg, saldosAgg, socios] = await Promise.all([
    // Total cargos no anulados (socioId nullable, filtramos en JS)
    prisma.cargo.groupBy({
      by: ['socioId'],
      where: cargoWhere,
      _sum: { montoTotal: true },
    }),
    // Cargos con estado PENDIENTE (deuda viva)
    prisma.cargo.groupBy({
      by: ['socioId'],
      where: { ...cargoWhere, estado: 'PENDIENTE' },
      _sum: { montoTotal: true },
      _count: true,
    }),
    // Pagos confirmados (Pago.socioId es NOT NULL)
    prisma.pago.groupBy({
      by: ['socioId'],
      where: pagoWhere,
      _sum: { montoTotal: true },
    }),
    // SaldoFavor disponible (socioId nullable)
    prisma.saldoFavor.groupBy({
      by: ['socioId'],
      where: saldoWhere,
      _sum: { montoDisponible: true },
    }),
    // Lista completa de socios para incluir los sin movimientos
    prisma.socio.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, nroSocio: true, apellidoNombre: true, estado: true },
      orderBy: { nroSocio: 'asc' },
    }),
  ])

  const cargosBySocio = new Map(cargosAgg.map(r => [r.socioId, Number(r._sum.montoTotal || 0)]))
  const pendBySocio = new Map(cargosPendAgg.map(r => [r.socioId, { monto: Number(r._sum.montoTotal || 0), count: r._count }]))
  const pagosBySocio = new Map(pagosAgg.map(r => [r.socioId, Number(r._sum.montoTotal || 0)]))
  const saldosBySocio = new Map(saldosAgg.map(r => [r.socioId, Number(r._sum.montoDisponible || 0)]))

  // Construir filas
  const filas = []
  for (const s of socios) {
    const totalCargos = cargosBySocio.get(s.id) || 0
    const totalPagos = pagosBySocio.get(s.id) || 0
    const adeudado = pendBySocio.get(s.id)?.monto || 0
    const cargosPendientes = pendBySocio.get(s.id)?.count || 0
    const saldoFavor = saldosBySocio.get(s.id) || 0

    const saldoCC = totalCargos - totalPagos
    const esperado = adeudado - saldoFavor
    const diferencia = saldoCC - esperado

    if (totalCargos === 0 && totalPagos === 0 && saldoFavor === 0) continue

    filas.push({
      nroSocio: s.nroSocio,
      apellidoNombre: s.apellidoNombre,
      estado: s.estado,
      totalCargos,
      totalPagos,
      saldoCC,
      adeudado,
      cargosPendientes,
      saldoFavor,
      esperado,
      diferencia,
      inconsistente: Math.abs(diferencia) > TOLERANCIA,
    })
  }

  // Estadísticas
  const inconsistentes = filas.filter(f => f.inconsistente)
  const totalSaldoCC = filas.reduce((a, f) => a + f.saldoCC, 0)
  const totalAdeudado = filas.reduce((a, f) => a + f.adeudado, 0)
  const totalSaldoFavor = filas.reduce((a, f) => a + f.saldoFavor, 0)
  const totalDiferencia = filas.reduce((a, f) => a + f.diferencia, 0)

  console.log(`\n${'═'.repeat(120)}`)
  console.log('RESUMEN GLOBAL')
  console.log('═'.repeat(120))
  console.log(`  Socios con movimientos:           ${filas.length}`)
  console.log(`  Socios con cargos pendientes:     ${filas.filter(f => f.adeudado > 0).length}`)
  console.log(`  Socios con saldo a favor:         ${filas.filter(f => f.saldoFavor > 0).length}`)
  console.log(`  Socios INCONSISTENTES:            ${inconsistentes.length}  (|diff| > ${TOLERANCIA})`)
  console.log()
  console.log(`  Saldo CC total (cargos - pagos):  $${fmt(totalSaldoCC)}`)
  console.log(`  Adeudado total (PENDIENTES):      $${fmt(totalAdeudado)}`)
  console.log(`  Saldo a favor disponible total:   $${fmt(totalSaldoFavor)}`)
  console.log(`  Esperado (adeud - saldoFavor):    $${fmt(totalAdeudado - totalSaldoFavor)}`)
  console.log(`  Diferencia neta:                  $${fmt(totalDiferencia)}`)

  // Detalle de inconsistencias
  if (inconsistentes.length > 0) {
    console.log(`\n${'═'.repeat(120)}`)
    console.log(`SOCIOS INCONSISTENTES (saldoCC ≠ adeudado - saldoFavor)`)
    console.log('═'.repeat(120))
    console.log('  nro    nombre                                    saldoCC       adeudado    saldoFavor    esperado   diferencia')
    console.log('  ' + '-'.repeat(118))

    inconsistentes.sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia))
    for (const f of inconsistentes.slice(0, 100)) {
      const nom = (f.apellidoNombre || '').padEnd(40).slice(0, 40)
      console.log(
        `  ${String(f.nroSocio).padStart(6)}  ${nom}  ${fmt(f.saldoCC).padStart(11)}  ${fmt(f.adeudado).padStart(11)}  ${fmt(f.saldoFavor).padStart(11)}  ${fmt(f.esperado).padStart(11)}  ${fmt(f.diferencia).padStart(11)}`
      )
    }
    if (inconsistentes.length > 100) {
      console.log(`  ... y ${inconsistentes.length - 100} más (ver CSV completo con --csv)`)
    }
  }

  // Top deudores
  if (!SOLO_INCONSISTENCIAS) {
    const topDeudores = filas.filter(f => f.adeudado > 0).sort((a, b) => b.adeudado - a.adeudado).slice(0, 20)
    if (topDeudores.length > 0) {
      console.log(`\n${'═'.repeat(120)}`)
      console.log('TOP 20 DEUDORES (por adeudado)')
      console.log('═'.repeat(120))
      console.log('  nro    nombre                                    adeudado    cargos  saldoFavor   saldoCC')
      console.log('  ' + '-'.repeat(118))
      for (const f of topDeudores) {
        const nom = (f.apellidoNombre || '').padEnd(40).slice(0, 40)
        console.log(
          `  ${String(f.nroSocio).padStart(6)}  ${nom}  ${fmt(f.adeudado).padStart(11)}  ${String(f.cargosPendientes).padStart(6)}  ${fmt(f.saldoFavor).padStart(11)}  ${fmt(f.saldoCC).padStart(11)}`
        )
      }
    }

    const topSaldoFavor = filas.filter(f => f.saldoFavor > 0).sort((a, b) => b.saldoFavor - a.saldoFavor).slice(0, 10)
    if (topSaldoFavor.length > 0) {
      console.log(`\n${'═'.repeat(120)}`)
      console.log('TOP 10 CON SALDO A FAVOR')
      console.log('═'.repeat(120))
      console.log('  nro    nombre                                    saldoFavor    adeudado    saldoCC')
      console.log('  ' + '-'.repeat(118))
      for (const f of topSaldoFavor) {
        const nom = (f.apellidoNombre || '').padEnd(40).slice(0, 40)
        console.log(
          `  ${String(f.nroSocio).padStart(6)}  ${nom}  ${fmt(f.saldoFavor).padStart(11)}  ${fmt(f.adeudado).padStart(11)}  ${fmt(f.saldoCC).padStart(11)}`
        )
      }
    }
  }

  // CSV
  if (CSV_PATH) {
    const headers = ['nroSocio', 'apellidoNombre', 'estado', 'totalCargos', 'totalPagos', 'saldoCC', 'adeudado', 'cargosPendientes', 'saldoFavor', 'esperado', 'diferencia', 'inconsistente']
    const rows = [headers.join(',')]
    for (const f of filas) {
      rows.push([
        f.nroSocio,
        `"${(f.apellidoNombre || '').replace(/"/g, '""')}"`,
        f.estado,
        f.totalCargos.toFixed(2),
        f.totalPagos.toFixed(2),
        f.saldoCC.toFixed(2),
        f.adeudado.toFixed(2),
        f.cargosPendientes,
        f.saldoFavor.toFixed(2),
        f.esperado.toFixed(2),
        f.diferencia.toFixed(2),
        f.inconsistente,
      ].join(','))
    }
    fs.writeFileSync(CSV_PATH, rows.join('\n'), 'utf-8')
    console.log(`\nCSV escrito en: ${CSV_PATH}`)
  }

  console.log('\nDone.\n')
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
