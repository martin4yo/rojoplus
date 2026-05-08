/**
 * Crea en Clubix las cuotas que estaban PENDIENTES en Brio (Cuotas.xlsx) en el
 * período indicado y no existen en Clubix.
 *
 * Identificador: AJUSTE_CUOTAS_FALTANTES_BRIO_20260507
 *   - origen del Cargo creado = 'AJUSTE_CUOTAS_FALTANTES_BRIO_20260507'
 *   - permite revertir con: prisma.cargo.deleteMany({ where: { origen: '...' } })
 *
 * Idempotente: borra cargos previos con ese origen antes de re-crear.
 *
 * Uso:
 *   node server/scripts/ajuste-cuotas-faltantes-brio.js --tenant sportivopilar --periodo 05/2026 --dry-run
 *   node server/scripts/ajuste-cuotas-faltantes-brio.js --tenant sportivopilar --periodo 05/2026 --apply
 */

import XLSX from 'xlsx'
import { PrismaClient } from '@prisma/client'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const prisma = new PrismaClient()

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : null
}
function flag(name) { return process.argv.includes(`--${name}`) }

const TENANT_SLUG = arg('tenant') || 'sportivopilar'
const PERIODO = arg('periodo') || '05/2026'
const APPLY = flag('apply')
const ORIGEN = 'AJUSTE_CUOTAS_FALTANTES_BRIO_20260507'

function fmt(n) {
  return Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function normDesc(s) {
  return String(s || '').toUpperCase().trim().replace(/\s+/g, ' ')
}

function excelDateToJS(val) {
  if (val == null || val === '') return null
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val
  if (typeof val === 'number') return val > 0 ? new Date((val - 25569) * 86400 * 1000) : null
  return new Date(String(val))
}

function mapCategoria(tipoCuota, descCuota) {
  const tc = (tipoCuota || '').toUpperCase()
  if (tc === 'CUOTA SOCIAL') {
    return (descCuota || '').toUpperCase().includes('GRUPO FAMILIAR') ? 'TITULAR_FAMILIA' : 'SOCIO_UNICO'
  }
  if (tc === 'ACTIVIDAD') return 'ACTIVIDAD'
  if (tc === 'MOROSIDAD') return 'MORA'
  return 'CONCEPTO'
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } })
  if (!tenant) throw new Error(`Tenant '${TENANT_SLUG}' no existe`)

  const [mes, anio] = PERIODO.split('/').map(Number)
  console.log(`Tenant : ${TENANT_SLUG} (id=${tenant.id})`)
  console.log(`Periodo: ${PERIODO}`)
  console.log(`Modo   : ${APPLY ? '🔴 APPLY' : '🟡 DRY-RUN'}`)
  console.log(`Origen : ${ORIGEN}\n`)

  const periodo = await prisma.periodo.findFirst({ where: { tenantId: tenant.id, mes, anio } })
  if (!periodo) throw new Error(`Período ${PERIODO} no existe en Clubix`)

  // ── Brio: cuotas pendientes del período ─────────────────────────────────────
  const wb = XLSX.readFile(path.join(__dirname, '../../brio/Cuotas.xlsx'))
  const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { range: 2 })
  const brioPend = data.filter(r => {
    const p = String(r['Periodo'] || '').trim()
    const e = String(r['Est. Cuota'] || '').toUpperCase().trim()
    return p === PERIODO && e === 'PENDIENTE'
  })

  // ── Clubix: cargos existentes en ese período (cualquier estado no anulado) ──
  const clubixCargos = await prisma.cargo.findMany({
    where: { tenantId: tenant.id, periodoId: periodo.id, estado: { not: 'ANULADO' } },
    include: { socio: { select: { nroSocio: true } } },
  })
  const clubixKeys = new Set()
  for (const c of clubixCargos) {
    const nro = c.socio?.nroSocio?.toString().trim()
    const desc = normDesc(c.descripcion)
    if (nro) clubixKeys.add(`${nro}|${desc}`)
  }

  // ── Mapas auxiliares ────────────────────────────────────────────────────────
  const socios = await prisma.socio.findMany({
    where: { tenantId: tenant.id }, select: { id: true, nroSocio: true }
  })
  const socioByNro = new Map()
  socios.forEach(s => { if (s.nroSocio) socioByNro.set(s.nroSocio.toString().trim(), s.id) })

  const actividades = await prisma.actividad.findMany({
    where: { tenantId: tenant.id },
    include: { categorias: { select: { id: true, nombre: true } } }
  })
  const actCatMap = new Map()
  for (const act of actividades) {
    const an = act.nombre.toUpperCase().trim()
    for (const c of act.categorias) {
      actCatMap.set(`${an}|${c.nombre.toUpperCase().trim()}`, c.id)
    }
  }
  const actByNombre = new Map(actividades.map(a => [a.nombre.toUpperCase().trim(), a]))

  const tiposSocio = await prisma.tipoSocio.findMany({ where: { tenantId: tenant.id } })
  const conceptoPorCategoria = new Map()
  for (const ts of tiposSocio) {
    if ((ts.codigo === 'SOCIO_UNICO' || ts.codigo === 'TITULAR_FAMILIA') && ts.conceptoTesoreriaId) {
      conceptoPorCategoria.set(ts.codigo, ts.conceptoTesoreriaId)
    }
  }

  // ── Identificar las faltantes ───────────────────────────────────────────────
  const faltantes = []
  for (const r of brioPend) {
    const nro = String(r['Nro. Socio'] || '').trim()
    const descNorm = normDesc(r['Desc. Cuota'])
    const key = `${nro}|${descNorm}`
    if (clubixKeys.has(key)) continue // ya está
    if (!socioByNro.has(nro)) continue // socio no existe en Clubix
    faltantes.push(r)
  }

  console.log(`Brio PENDIENTES en ${PERIODO}:                        ${brioPend.length}`)
  console.log(`Faltantes en Clubix (a crear):                        ${faltantes.length}`)
  const sumaFaltantes = faltantes.reduce((a, r) => a + Number(r['Importe Real'] || 0), 0)
  console.log(`Suma de faltantes:                                    $${fmt(sumaFaltantes)}\n`)

  // Listar
  console.log('Detalle:')
  for (const r of faltantes) {
    const nro = r['Nro. Socio']
    const nom = String(r['Apellido Nombre'] || '').padEnd(30).slice(0,30)
    const desc = String(r['Desc. Cuota'] || '').padEnd(30).slice(0,30)
    const monto = Number(r['Importe Real'] || 0)
    const tc = String(r['Tipo Cuota'] || '').padEnd(12).slice(0,12)
    console.log(`  ${String(nro).padStart(6)}  ${nom}  ${tc}  ${desc}  $${fmt(monto).padStart(10)}`)
  }

  if (!APPLY) {
    console.log(`\n🟡 DRY-RUN. Re-correr con --apply para crear los cargos.\n`)
    return
  }

  // ── APPLY ───────────────────────────────────────────────────────────────────
  console.log(`\n🔴 APPLY: borrando previos con origen=${ORIGEN}...`)
  const del = await prisma.cargo.deleteMany({ where: { tenantId: tenant.id, origen: ORIGEN } })
  console.log(`  Eliminados: ${del.count}`)

  console.log(`\nCreando ${faltantes.length} cargos...`)
  let creados = 0, errores = 0
  for (const r of faltantes) {
    const nro = String(r['Nro. Socio'] || '').trim()
    const socioId = socioByNro.get(nro)
    const tipoCuota = String(r['Tipo Cuota'] || '').trim()
    const descCuota = String(r['Desc. Cuota'] || '').trim()
    const importe = Number(r['Importe Real'] || 0)
    const fechaGen = excelDateToJS(r['Fecha Gen.']) || new Date(anio, mes - 1, 1)

    let categoria = mapCategoria(tipoCuota, descCuota)
    let categoriaActividadId = null
    if (tipoCuota.toUpperCase() === 'ACTIVIDAD' && descCuota) {
      const sep = descCuota.indexOf(' - ')
      if (sep !== -1) {
        const an = descCuota.substring(0, sep).toUpperCase().trim()
        const cn = descCuota.substring(sep + 3).toUpperCase().trim()
        categoriaActividadId = actCatMap.get(`${an}|${cn}`) ?? null
      }
      if (!categoriaActividadId) categoria = 'CONCEPTO'
    }

    let conceptoTesoreriaId = conceptoPorCategoria.get(categoria) ?? null
    if (categoria === 'ACTIVIDAD' && descCuota) {
      const sep = descCuota.indexOf(' - ')
      const an = sep !== -1 ? descCuota.substring(0, sep).toUpperCase().trim() : ''
      const act = actByNombre.get(an)
      if (act?.conceptoTesoreriaId) conceptoTesoreriaId = act.conceptoTesoreriaId
    }

    try {
      await prisma.cargo.create({
        data: {
          tenantId: tenant.id,
          socioId,
          periodoId: periodo.id,
          categoriaActividadId,
          conceptoTesoreriaId,
          descripcion: descCuota,
          categoria,
          tipoCuota,
          montoOriginal: importe,
          montoRecargo: 0,
          montoBonificacion: 0,
          montoTotal: importe,
          estado: 'PENDIENTE',
          fechaGeneracion: fechaGen,
          origen: ORIGEN,
          observaciones: `Cuota faltante recuperada de Brio (validación 2026-05-07)`,
        }
      })
      creados++
    } catch (e) {
      errores++
      console.log(`  ERROR socio ${nro}: ${e.message}`)
    }
  }

  console.log(`\n✅ Creados: ${creados} | Errores: ${errores}`)
  console.log(`   Para revertir: DELETE FROM cargos WHERE origen='${ORIGEN}'\n`)
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
