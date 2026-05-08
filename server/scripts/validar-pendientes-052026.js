/**
 * Valida que las cuotas PENDIENTE de período 05/2026 en Clubix coincidan con
 * las cuotas PENDIENTE del mismo período en Brio.
 *
 * Maneja el caso de cuotas que en Brio están PENDIENTE pero en Clubix se
 * cargó el pago manual después de la migración (esas figuran como PAGADO en
 * Clubix con origen del pago != MIGRACION_BRIO).
 *
 * Reporta:
 *   - Cuotas PENDIENTE en ambos: monto coincide / no coincide
 *   - Cuotas PENDIENTE en Brio pero PAGADO en Clubix (con detalle del pago)
 *   - Cuotas en Brio sin contraparte en Clubix
 *   - Cuotas en Clubix sin contraparte en Brio
 *
 * Uso:
 *   node server/scripts/validar-pendientes-052026.js --tenant sportivopilar
 *   node server/scripts/validar-pendientes-052026.js --tenant sportivopilar --periodo 05/2026 --csv reporte.csv
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
const PERIODO = arg('periodo') || '05/2026'
const CSV_PATH = arg('csv')
const TOL = parseFloat(arg('tolerancia') || '0.01')

function fmt(n) {
  return Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function normDesc(s) {
  return String(s || '').toUpperCase().trim().replace(/\s+/g, ' ')
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } })
  if (!tenant) throw new Error(`Tenant '${TENANT_SLUG}' no existe`)

  const [mes, anio] = PERIODO.split('/').map(Number)
  if (!mes || !anio) throw new Error(`Periodo inválido: ${PERIODO} (esperado MM/YYYY)`)

  console.log(`Tenant : ${TENANT_SLUG} (id=${tenant.id})`)
  console.log(`Periodo: ${PERIODO} (mes=${mes}, anio=${anio})\n`)

  // ── Brio ────────────────────────────────────────────────────────────────────
  const wb = XLSX.readFile(path.join(__dirname, '../../brio/Cuotas.xlsx'))
  const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { range: 2 })

  // Filas de Brio del período, cualquier estado
  const brioFilas = data.filter(r => String(r['Periodo'] || '').trim() === PERIODO)

  // Pendientes en Brio del período
  const brioPend = brioFilas.filter(r => {
    const e = String(r['Est. Cuota'] || '').toUpperCase().trim()
    return e === 'PENDIENTE'
  })

  // Mapa: nroSocio → array de cuotas
  const brioMap = new Map() // key: `${nro}|${descNorm}` → { nro, desc, monto, fecha, est }
  for (const r of brioPend) {
    const nro = String(r['Nro. Socio'] || '').trim()
    const descRaw = String(r['Desc. Cuota'] || '')
    const descNorm = normDesc(descRaw)
    const monto = Number(r['Importe Real'] || 0)
    const key = `${nro}|${descNorm}`
    if (!brioMap.has(key)) brioMap.set(key, { nro, descRaw, descNorm, monto, count: 1, nombre: String(r['Apellido Nombre'] || '').trim() })
    else {
      const x = brioMap.get(key)
      x.monto += monto; x.count++
    }
  }

  const totalBrioPend = brioPend.reduce((a, r) => a + Number(r['Importe Real'] || 0), 0)
  console.log(`Brio: ${brioFilas.length} filas en período ${PERIODO}`)
  console.log(`  PENDIENTE: ${brioPend.length} filas | suma $${fmt(totalBrioPend)}`)

  // ── Clubix ──────────────────────────────────────────────────────────────────
  const periodo = await prisma.periodo.findFirst({ where: { tenantId: tenant.id, mes, anio } })
  if (!periodo) {
    console.log(`\n⚠️  Período ${PERIODO} no existe en Clubix.\n`)
    return
  }

  const cargos = await prisma.cargo.findMany({
    where: {
      tenantId: tenant.id,
      periodoId: periodo.id,
      estado: { not: 'ANULADO' },
    },
    include: {
      socio: { select: { nroSocio: true, apellidoNombre: true } },
      pago: { select: { id: true, numero: true, origen: true, fecha: true, montoTotal: true } },
    },
  })

  const clubixMap = new Map() // key → { nro, desc, monto, estado, pago }
  for (const c of cargos) {
    const nro = c.socio?.nroSocio?.toString().trim() || ''
    const descRaw = String(c.descripcion || '')
    const descNorm = normDesc(descRaw)
    const monto = Number(c.montoTotal || 0)
    const key = `${nro}|${descNorm}`
    if (!clubixMap.has(key)) {
      clubixMap.set(key, {
        nro, descRaw, descNorm, monto, count: 1, estado: c.estado,
        pago: c.pago ? { numero: c.pago.numero, origen: c.pago.origen, fecha: c.pago.fecha, monto: Number(c.pago.montoTotal || 0) } : null,
        nombre: c.socio?.apellidoNombre || '',
      })
    } else {
      const x = clubixMap.get(key)
      x.monto += monto; x.count++
      // Si hay múltiples cargos por descripcion, aglutino, estado dominante = PENDIENTE si alguno está pendiente
      if (c.estado === 'PENDIENTE') x.estado = 'PENDIENTE'
    }
  }

  const cargosPend = cargos.filter(c => c.estado === 'PENDIENTE')
  const cargosPag = cargos.filter(c => c.estado === 'PAGADO')
  const totalClubixPend = cargosPend.reduce((a, c) => a + Number(c.montoTotal || 0), 0)
  const totalClubixPag = cargosPag.reduce((a, c) => a + Number(c.montoTotal || 0), 0)

  console.log(`\nClubix: ${cargos.length} cargos en período ${PERIODO} (no anulados)`)
  console.log(`  PENDIENTE: ${cargosPend.length} cargos | suma $${fmt(totalClubixPend)}`)
  console.log(`  PAGADO:    ${cargosPag.length} cargos | suma $${fmt(totalClubixPag)}`)

  // ── Comparación ─────────────────────────────────────────────────────────────
  const allKeys = new Set([...brioMap.keys(), ...clubixMap.keys()])
  const filas = []

  for (const key of allKeys) {
    const b = brioMap.get(key)
    const c = clubixMap.get(key)

    let categoria
    let detalle = ''
    if (b && c) {
      const diffMonto = (b.monto - c.monto)
      if (c.estado === 'PAGADO') {
        if (c.pago && c.pago.origen !== 'MIGRACION_BRIO' && c.pago.origen !== 'MIGRACION_BRIO_HISTORICO') {
          categoria = 'PAGADO_CLUBIX_POST_MIGRACION'
          detalle = `Pagado en Clubix con ${c.pago.origen} #${c.pago.numero} el ${c.pago.fecha?.toISOString().slice(0,10)}`
        } else {
          categoria = 'PAGADO_EN_CLUBIX_VIA_MIGRACION'  // raro: Brio dice pendiente, Clubix dice pagado por migración
          detalle = `Importado como PAGADO con pago ${c.pago?.numero || '-'}`
        }
      } else {
        // Ambos pendientes
        if (Math.abs(diffMonto) <= TOL) categoria = 'PENDIENTE_OK'
        else categoria = 'PENDIENTE_MONTO_DIFERENTE'
      }
    } else if (b && !c) {
      categoria = 'SOLO_BRIO'
      detalle = 'Falta cargo en Clubix'
    } else if (!b && c) {
      // Está en Clubix, pero no es PENDIENTE en Brio. Puede ser PAGADO en Brio.
      const enBrioComoPagada = brioFilas.some(r => {
        const nro = String(r['Nro. Socio'] || '').trim()
        const descNorm = normDesc(r['Desc. Cuota'])
        const k = `${nro}|${descNorm}`
        return k === key
      })
      if (enBrioComoPagada) {
        // No es problema — Brio la tiene pero como PAGADA
        if (c.estado === 'PAGADO') categoria = 'OK_AMBAS_PAGADO'
        else categoria = 'BRIO_PAGADO_CLUBIX_PENDIENTE'  // raro
      } else {
        categoria = 'SOLO_CLUBIX'
        detalle = 'Cargo no existe en Brio'
      }
    }

    filas.push({
      nro: b?.nro || c?.nro,
      nombre: b?.nombre || c?.nombre || '',
      desc: b?.descRaw || c?.descRaw || '',
      brioMonto: b?.monto || 0,
      brioCount: b?.count || 0,
      clubixMonto: c?.monto || 0,
      clubixCount: c?.count || 0,
      clubixEstado: c?.estado || '-',
      pagoOrigen: c?.pago?.origen || '',
      categoria,
      detalle,
    })
  }

  // ── Resumen por categoría ───────────────────────────────────────────────────
  const cat = {}
  for (const f of filas) cat[f.categoria] = (cat[f.categoria] || 0) + 1

  console.log(`\n${'═'.repeat(120)}`)
  console.log('RESUMEN POR CATEGORÍA')
  console.log('═'.repeat(120))
  const orden = [
    'PENDIENTE_OK',
    'PENDIENTE_MONTO_DIFERENTE',
    'PAGADO_CLUBIX_POST_MIGRACION',
    'PAGADO_EN_CLUBIX_VIA_MIGRACION',
    'OK_AMBAS_PAGADO',
    'BRIO_PAGADO_CLUBIX_PENDIENTE',
    'SOLO_BRIO',
    'SOLO_CLUBIX',
  ]
  for (const k of orden) {
    if (cat[k]) console.log(`  ${k.padEnd(40)} ${cat[k]}`)
  }

  // Suma de PENDIENTE en Brio que en Clubix YA fue cobrada (post-migración):
  const cobradasEnClubix = filas.filter(f => f.categoria === 'PAGADO_CLUBIX_POST_MIGRACION')
  const sumaCobradasClubix = cobradasEnClubix.reduce((a, f) => a + f.brioMonto, 0)
  const sumaPendOK = filas.filter(f => f.categoria === 'PENDIENTE_OK').reduce((a, f) => a + f.brioMonto, 0)
  const sumaPendDiff = filas.filter(f => f.categoria === 'PENDIENTE_MONTO_DIFERENTE')
  const sumaPendDiffBrio = sumaPendDiff.reduce((a, f) => a + f.brioMonto, 0)
  const sumaPendDiffClubix = sumaPendDiff.reduce((a, f) => a + f.clubixMonto, 0)
  const sumaSoloBrio = filas.filter(f => f.categoria === 'SOLO_BRIO').reduce((a, f) => a + f.brioMonto, 0)
  const sumaSoloClubix = filas.filter(f => f.categoria === 'SOLO_CLUBIX').reduce((a, f) => a + f.clubixMonto, 0)

  console.log(`\n${'═'.repeat(120)}`)
  console.log('CONCILIACIÓN DE MONTOS')
  console.log('═'.repeat(120))
  console.log(`  Brio total PENDIENTE en ${PERIODO}:                            $${fmt(totalBrioPend)}`)
  console.log()
  console.log(`  - Pendiente en Clubix (coincide):                          $${fmt(sumaPendOK)}`)
  console.log(`  - Pendiente en Clubix (monto difiere — Brio):             $${fmt(sumaPendDiffBrio)}`)
  console.log(`  - Pendiente en Clubix (monto difiere — Clubix):           $${fmt(sumaPendDiffClubix)}`)
  console.log(`  - Cobrado post-migración en Clubix:                       $${fmt(sumaCobradasClubix)}`)
  console.log(`  - Solo en Brio (faltante en Clubix):                      $${fmt(sumaSoloBrio)}`)
  console.log()
  console.log(`  Clubix total PENDIENTE en ${PERIODO}:                          $${fmt(totalClubixPend)}`)
  console.log(`  - + Solo en Clubix (no en Brio):                          $${fmt(sumaSoloClubix)}`)

  // ── Detalle de diferencias ──────────────────────────────────────────────────
  for (const c of ['PENDIENTE_MONTO_DIFERENTE', 'SOLO_BRIO', 'SOLO_CLUBIX', 'BRIO_PAGADO_CLUBIX_PENDIENTE']) {
    const lista = filas.filter(f => f.categoria === c)
    if (lista.length === 0) continue
    console.log(`\n${'═'.repeat(120)}`)
    console.log(`Detalle: ${c} (${lista.length} casos)`)
    console.log('═'.repeat(120))
    console.log('  nro    nombre                              descripcion                   brioMonto  clubixMonto  estadoCx')
    console.log('  ' + '-'.repeat(118))
    lista.sort((a, b) => Math.abs(b.brioMonto - b.clubixMonto) - Math.abs(a.brioMonto - a.clubixMonto))
    for (const f of lista.slice(0, 30)) {
      const nom = (f.nombre || '').padEnd(34).slice(0, 34)
      const desc = (f.desc || '').padEnd(28).slice(0, 28)
      console.log(
        `  ${String(f.nro).padStart(6)}  ${nom}  ${desc}  ${fmt(f.brioMonto).padStart(9)}  ${fmt(f.clubixMonto).padStart(11)}  ${f.clubixEstado.padEnd(10)}`
      )
    }
    if (lista.length > 30) console.log(`  ... y ${lista.length - 30} más`)
  }

  // CSV
  if (CSV_PATH) {
    const headers = ['nro', 'nombre', 'desc', 'brioMonto', 'brioCount', 'clubixMonto', 'clubixCount', 'clubixEstado', 'pagoOrigen', 'categoria', 'detalle']
    const rows = [headers.join(',')]
    for (const f of filas) {
      rows.push([
        f.nro,
        `"${(f.nombre || '').replace(/"/g, '""')}"`,
        `"${(f.desc || '').replace(/"/g, '""')}"`,
        f.brioMonto.toFixed(2),
        f.brioCount,
        f.clubixMonto.toFixed(2),
        f.clubixCount,
        f.clubixEstado,
        f.pagoOrigen,
        f.categoria,
        `"${(f.detalle || '').replace(/"/g, '""')}"`,
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
