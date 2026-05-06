/**
 * Compara saldo deudor por socio entre Brio (Cuotas.xlsx) y Clubix (BD).
 *
 * Brio fue el sistema activo hasta el 30/4/2026. Clubix arrancó 1/5/2026.
 * La importación solo trajo movimientos desde 1/4/2025 → la deuda histórica
 * previa al 1/4/2025 no está reflejada en Clubix.
 *
 * Por cada socio compara:
 *   - brioSaldoDeudor   = Σ Importe Real donde Est. Cuota='PENDIENTE' y Fecha Gen. ≤ 30/4/2026
 *   - clubixSaldoDeudor = Σ montoTotal de cargos estado='PENDIENTE' y fechaGeneracion ≤ 30/4/2026
 *   - diff              = brio - clubix
 *
 * Reporta los socios con |diff| > tolerancia. Exporta CSV completo.
 *
 * No modifica nada (read-only).
 *
 * Uso:
 *   node server/scripts/comparar-saldo-brio-vs-clubix.js --tenant sportivopilar
 *   node server/scripts/comparar-saldo-brio-vs-clubix.js --tenant sportivopilar --csv reporte.csv
 *   node server/scripts/comparar-saldo-brio-vs-clubix.js --tenant sportivopilar --excel brio/Cuotas.xlsx --hasta 2026-04-30
 */

import XLSX from 'xlsx'
import { PrismaClient } from '@prisma/client'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const prisma = new PrismaClient()

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : null
}

const TENANT_SLUG = arg('tenant') || 'sportivopilar'
const EXCEL_REL = arg('excel') || 'brio/Cuotas.xlsx'
const HASTA_STR = arg('hasta') || '2026-04-30'
const HASTA = new Date(HASTA_STR + 'T23:59:59')
const CSV_PATH = arg('csv')
const TOLERANCIA = parseFloat(arg('tolerancia') || '0.01')

function fmt(n) {
  return Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function excelDateToJS(val) {
  if (val == null || val === '') return null
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val
  if (typeof val === 'number') return val > 0 ? new Date((val - 25569) * 86400 * 1000) : null
  const s = String(val).trim()
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/)
  if (m) {
    let [, d, mo, y] = m.map(Number)
    if (y < 100) y = y >= 50 ? 1900 + y : 2000 + y
    const dt = new Date(y, mo - 1, d)
    return isNaN(dt.getTime()) ? null : dt
  }
  const dt = new Date(s)
  return isNaN(dt.getTime()) ? null : dt
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } })
  if (!tenant) throw new Error(`Tenant '${TENANT_SLUG}' no existe`)

  const excelPath = path.isAbsolute(EXCEL_REL) ? EXCEL_REL : path.join(__dirname, '../..', EXCEL_REL)

  console.log(`Tenant : ${TENANT_SLUG} (id=${tenant.id})`)
  console.log(`Excel  : ${excelPath}`)
  console.log(`Corte  : hasta ${HASTA.toISOString().slice(0, 10)} (inclusive)\n`)

  // ── Leer Brio ───────────────────────────────────────────────────────────────
  console.log('Leyendo Cuotas.xlsx...')
  const wb = XLSX.readFile(excelPath)
  const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { range: 2 })
  console.log(`  ${data.length} filas`)

  // Acumular saldo por socio según Brio
  const brio = new Map() // nroSocio (string) → { nombre, deudor, pagado, total, cuotasPend, cuotasPag }
  let totalProcesadas = 0
  let descartadas = 0

  for (const r of data) {
    const fechaGen = excelDateToJS(r['Fecha Gen.'])
    if (!fechaGen) { descartadas++; continue }
    if (fechaGen > HASTA) { descartadas++; continue }

    const nro = r['Nro. Socio']
    if (nro == null || nro === '') { descartadas++; continue }
    const nroKey = String(nro).trim()
    const importe = Number(r['Importe Real'] || 0)
    const estCuota = String(r['Est. Cuota'] ?? '').toUpperCase().trim()

    if (!brio.has(nroKey)) {
      brio.set(nroKey, {
        nombre: String(r['Apellido Nombre'] || '').trim(),
        deudor: 0, pagado: 0, financiado: 0, ncredito: 0,
        cuotasPend: 0, cuotasPag: 0, cuotasNC: 0, cuotasFin: 0,
      })
    }
    const b = brio.get(nroKey)
    if (estCuota === 'PENDIENTE') { b.deudor += importe; b.cuotasPend++ }
    else if (estCuota === 'PAGADA') { b.pagado += importe; b.cuotasPag++ }
    else if (estCuota === 'NOTA DE CRÉDITO' || estCuota === 'NOTA DE CREDITO') { b.ncredito += importe; b.cuotasNC++ }
    else if (estCuota === 'FINANCIADO') { b.financiado += importe; b.cuotasFin++ }
    totalProcesadas++
  }
  console.log(`  Procesadas: ${totalProcesadas} | descartadas (sin fecha o > corte): ${descartadas}`)
  console.log(`  Socios distintos en Brio: ${brio.size}`)

  // ── Leer Clubix ─────────────────────────────────────────────────────────────
  console.log('\nLeyendo cargos de Clubix...')
  const cargosAgg = await prisma.cargo.groupBy({
    by: ['socioId'],
    where: {
      tenantId: tenant.id,
      estado: 'PENDIENTE',
      fechaGeneracion: { lte: HASTA },
    },
    _sum: { montoTotal: true },
    _count: true,
  })

  const socios = await prisma.socio.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, nroSocio: true, apellidoNombre: true },
  })
  const socioById = new Map(socios.map(s => [s.id, s]))
  const socioByNro = new Map(socios.filter(s => s.nroSocio != null).map(s => [String(s.nroSocio).trim(), s]))

  const clubix = new Map() // nroSocio (string) → { deudor, cuotas }
  for (const r of cargosAgg) {
    const s = socioById.get(r.socioId)
    if (!s || s.nroSocio == null) continue
    clubix.set(String(s.nroSocio).trim(), {
      deudor: Number(r._sum.montoTotal || 0),
      cuotas: r._count,
    })
  }
  console.log(`  Socios con deuda en Clubix: ${clubix.size}`)

  // ── Comparar ────────────────────────────────────────────────────────────────
  const todosNros = new Set([...brio.keys(), ...clubix.keys()])
  const filas = []
  for (const nro of todosNros) {
    const b = brio.get(nro)
    const c = clubix.get(nro)
    const socio = socioByNro.get(nro)

    const brioDeudor = b?.deudor || 0
    const clubixDeudor = c?.deudor || 0
    const diff = brioDeudor - clubixDeudor

    filas.push({
      nroSocio: nro,
      nombre: b?.nombre || socio?.apellidoNombre || '',
      enClubix: !!socio,
      brioDeudor,
      brioCuotasPend: b?.cuotasPend || 0,
      clubixDeudor,
      clubixCuotasPend: c?.cuotas || 0,
      diff,
      requiereSaldoAnterior: diff > TOLERANCIA,
      excedente: diff < -TOLERANCIA,
    })
  }

  filas.sort((a, b) => {
    const da = parseInt(a.nroSocio); const db = parseInt(b.nroSocio)
    if (!isNaN(da) && !isNaN(db)) return da - db
    return a.nroSocio.localeCompare(b.nroSocio)
  })

  // ── Resumen ─────────────────────────────────────────────────────────────────
  const conDiferencia = filas.filter(f => Math.abs(f.diff) > TOLERANCIA)
  const requiereSaldo = filas.filter(f => f.requiereSaldoAnterior)
  const excedentes = filas.filter(f => f.excedente)
  const noEnClubix = filas.filter(f => !f.enClubix && f.brioDeudor > 0)

  const totalBrio = filas.reduce((a, f) => a + f.brioDeudor, 0)
  const totalClubix = filas.reduce((a, f) => a + f.clubixDeudor, 0)
  const totalDiff = totalBrio - totalClubix
  const sumaSaldoAnteriorPropuesto = requiereSaldo.reduce((a, f) => a + f.diff, 0)
  const sumaExcedente = excedentes.reduce((a, f) => a + Math.abs(f.diff), 0)

  console.log(`\n${'═'.repeat(120)}`)
  console.log('RESUMEN GLOBAL')
  console.log('═'.repeat(120))
  console.log(`  Total socios comparados:                ${filas.length}`)
  console.log(`  Coinciden (|diff| ≤ ${TOLERANCIA}):              ${filas.length - conDiferencia.length}`)
  console.log(`  Con diferencia:                         ${conDiferencia.length}`)
  console.log(`    → Brio > Clubix (saldo anterior):     ${requiereSaldo.length}  (suma $${fmt(sumaSaldoAnteriorPropuesto)})`)
  console.log(`    → Clubix > Brio (excedente):          ${excedentes.length}  (suma $${fmt(sumaExcedente)})`)
  console.log(`  Socios en Brio que no están en Clubix:  ${noEnClubix.length}`)
  console.log()
  console.log(`  Saldo deudor Brio   al ${HASTA.toISOString().slice(0,10)}: $${fmt(totalBrio)}`)
  console.log(`  Saldo deudor Clubix al ${HASTA.toISOString().slice(0,10)}: $${fmt(totalClubix)}`)
  console.log(`  Diferencia neta (Brio - Clubix):        $${fmt(totalDiff)}`)

  // ── Top diferencias ─────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(120)}`)
  console.log('TOP 30 DIFERENCIAS (Brio > Clubix → posible saldo anterior)')
  console.log('═'.repeat(120))
  console.log('  nro    nombre                                  brioDeudor    clubixDeudor    diff      enCx')
  console.log('  ' + '-'.repeat(118))
  const topReq = [...requiereSaldo].sort((a, b) => b.diff - a.diff).slice(0, 30)
  for (const f of topReq) {
    const nom = (f.nombre || '').padEnd(38).slice(0, 38)
    console.log(`  ${String(f.nroSocio).padStart(6)}  ${nom}  ${fmt(f.brioDeudor).padStart(11)}    ${fmt(f.clubixDeudor).padStart(11)}    ${fmt(f.diff).padStart(11)}  ${f.enClubix ? 'sí' : 'NO'}`)
  }

  if (excedentes.length > 0) {
    console.log(`\n${'═'.repeat(120)}`)
    console.log('TOP 30 EXCEDENTES (Clubix > Brio → revisar)')
    console.log('═'.repeat(120))
    console.log('  nro    nombre                                  brioDeudor    clubixDeudor    diff')
    console.log('  ' + '-'.repeat(118))
    const topExc = [...excedentes].sort((a, b) => a.diff - b.diff).slice(0, 30)
    for (const f of topExc) {
      const nom = (f.nombre || '').padEnd(38).slice(0, 38)
      console.log(`  ${String(f.nroSocio).padStart(6)}  ${nom}  ${fmt(f.brioDeudor).padStart(11)}    ${fmt(f.clubixDeudor).padStart(11)}    ${fmt(f.diff).padStart(11)}`)
    }
  }

  // ── CSV ─────────────────────────────────────────────────────────────────────
  if (CSV_PATH) {
    const headers = ['nroSocio', 'nombre', 'enClubix', 'brioDeudor', 'brioCuotasPend', 'clubixDeudor', 'clubixCuotasPend', 'diff', 'requiereSaldoAnterior', 'excedente']
    const rows = [headers.join(',')]
    for (const f of filas) {
      rows.push([
        f.nroSocio,
        `"${(f.nombre || '').replace(/"/g, '""')}"`,
        f.enClubix,
        f.brioDeudor.toFixed(2),
        f.brioCuotasPend,
        f.clubixDeudor.toFixed(2),
        f.clubixCuotasPend,
        f.diff.toFixed(2),
        f.requiereSaldoAnterior,
        f.excedente,
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
