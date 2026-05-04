/**
 * =============================================================================
 * ACTUALIZAR cuotaMensual DE ACTIVIDADES Y TIPOS DE SOCIO — actualizar-precios-cuotas.js
 * =============================================================================
 *
 * Lee Cuotas.xlsx y actualiza el campo `cuotaMensual` de:
 *   - Actividad
 *   - TipoSocio (Socio Unico, Titular Familia, Miembro Familia)
 *   - ConceptoTesoreria vinculado
 *
 * usando el importe de las cuotas con `Periodo = mes/año` que pasás como
 * parámetro — NO el "más reciente". Útil cuando hay socios que pagan
 * cuotas adelantadas a precios distintos del actual.
 *
 * NO modifica los cargos/cuotas ya generadas. Solo el "precio de lista".
 *
 * USO:
 *   node --env-file=.env scripts/actualizar-precios-cuotas.js \
 *        --tenant <slug> --mes <mes> --anio <anio> [--apply]
 *
 *   --tenant   Slug del tenant (obligatorio)
 *   --mes      Mes 1-12 del período de referencia
 *   --anio     Año 4 dígitos del período de referencia
 *   --apply    Aplica cambios. Sin esta flag corre dry-run.
 *
 * EJEMPLO:
 *   # Ver qué importes hay en mayo/2026 (sin tocar nada)
 *   node --env-file=.env scripts/actualizar-precios-cuotas.js \
 *        --tenant sportivopilar --mes 5 --anio 2026
 *
 *   # Aplicar
 *   node --env-file=.env scripts/actualizar-precios-cuotas.js \
 *        --tenant sportivopilar --mes 5 --anio 2026 --apply
 * =============================================================================
 */
import XLSX from 'xlsx'
import { PrismaClient } from '@prisma/client'
import path from 'path'
import { fileURLToPath } from 'url'
import { arg, resolveTenant } from './_lib/cli.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const prisma = new PrismaClient()

// ── Args ──────────────────────────────────────────────────────────────────────
const MES  = parseInt(arg('mes'))
const ANIO = parseInt(arg('anio'))
const APPLY = process.argv.includes('--apply')

if (!MES || !ANIO || MES < 1 || MES > 12 || ANIO < 2000) {
  console.error('❌ --mes (1-12) y --anio (>=2000) son obligatorios')
  process.exit(1)
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function parsePeriodo(periodoStr) {
  if (!periodoStr) return null
  const m = periodoStr.toString().match(/^(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  return { mes: parseInt(m[1]), anio: parseInt(m[2]) }
}

function fmt(n) {
  return Number(n).toLocaleString('es-AR')
}

// Replica de mapCategoria del importar-cuotas.js (limitado a CUOTA SOCIAL)
function categoriaSocialDe(descCuota) {
  const d = String(descCuota || '').toUpperCase()
  if (d.includes('GRUPO FAMILIAR') || d.includes('TITULAR')) return 'TITULAR_FAMILIA'
  return 'SOCIO_UNICO'
}

// Tomar el valor más frecuente — si hay un solo valor, ese.
// Si hay varios, devuelve el modo (más repetido).
function modeOf(values) {
  if (!values.length) return null
  const counts = new Map()
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1)
  let best = null, bestN = 0
  for (const [v, n] of counts) {
    if (n > bestN) { best = v; bestN = n }
  }
  return best
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const tenant = await resolveTenant(prisma)
  const tenantId = tenant.id
  const mode = APPLY ? 'APLICAR' : 'DRY-RUN'

  console.log(`📋 Tenant: ${tenant.nombre} (id=${tenantId})`)
  console.log(`📅 Período de referencia: ${String(MES).padStart(2,'0')}/${ANIO}`)
  console.log(`⚙️  Modo: ${mode}\n`)

  // ── Leer Excel ────────────────────────────────────────────────────────────
  const filePath = path.join(__dirname, '..', '..', 'brio', 'Cuotas.xlsx')
  console.log(`📄 Leyendo: ${filePath}`)
  const workbook = XLSX.readFile(filePath)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const data = XLSX.utils.sheet_to_json(sheet, { range: 2, defval: '' })
  console.log(`📊 ${data.length} filas en el Excel\n`)

  // ── Acumular importes por (actividad / tipoSocio) del período pasado ──────
  // Tomamos solo PAGADAS para tener un valor confiable — pero si querés también
  // se pueden usar todas: cambiar la condición de estado.
  const importesPorActividad = new Map()  // actNorm → [importe, ...]
  const importesSocioUnico = []
  const importesTitularFamilia = []

  let filasPeriodo = 0
  for (const row of data) {
    const periodo = parsePeriodo(row['Periodo']?.toString().trim())
    if (!periodo || periodo.mes !== MES || periodo.anio !== ANIO) continue
    filasPeriodo++

    const tipo    = row['Tipo Cuota']?.toString().trim().toUpperCase()
    const desc    = row['Desc. Cuota']?.toString().trim() || ''
    const importe = parseFloat(row['Importe Real']) || 0
    if (importe <= 0) continue

    if (tipo === 'CUOTA SOCIAL') {
      const cat = categoriaSocialDe(desc)
      if (cat === 'TITULAR_FAMILIA') importesTitularFamilia.push(importe)
      else importesSocioUnico.push(importe)
      continue
    }

    if (tipo === 'ACTIVIDAD' && desc) {
      const sepIdx = desc.indexOf(' - ')
      const actNorm = (sepIdx !== -1 ? desc.substring(0, sepIdx) : desc).toUpperCase().trim()
      if (!importesPorActividad.has(actNorm)) importesPorActividad.set(actNorm, [])
      importesPorActividad.get(actNorm).push(importe)
    }
  }

  console.log(`✅ ${filasPeriodo} filas con Periodo = ${MES}/${ANIO}`)
  console.log(`✅ Actividades únicas: ${importesPorActividad.size}`)
  console.log(`✅ Socio Único: ${importesSocioUnico.length} muestras | Titular Familia: ${importesTitularFamilia.length} muestras\n`)

  if (filasPeriodo === 0) {
    console.error(`❌ No hay filas en el Excel con Periodo = ${MES}/${ANIO}. Verificá la fecha.`)
    process.exit(1)
  }

  // Reducir a un único precio por actividad / tipo (modo)
  const importeActividad = new Map()
  for (const [act, lista] of importesPorActividad) {
    importeActividad.set(act, modeOf(lista))
  }
  const importeSocioUnico    = modeOf(importesSocioUnico)
  const importeTitularFamilia = modeOf(importesTitularFamilia)

  // ── Mostrar tabla de precios detectados ───────────────────────────────────
  console.log('📋 PRECIOS DETECTADOS PARA EL PERÍODO:')
  console.log('─'.repeat(70))
  const acts = [...importeActividad.entries()].sort()
  for (const [act, imp] of acts) {
    console.log(`   Actividad ${act.padEnd(25).slice(0,25)} → $${fmt(imp)}`)
  }
  if (importeSocioUnico)    console.log(`   TipoSocio Socio Unico/Miembro Familia → $${fmt(importeSocioUnico)}`)
  if (importeTitularFamilia) console.log(`   TipoSocio Titular Familia              → $${fmt(importeTitularFamilia)}`)
  console.log('─'.repeat(70))
  console.log()

  // ── Aplicar a Actividad / TipoSocio / ConceptoTesoreria ───────────────────
  console.log('🔄 APLICANDO CAMBIOS:')
  console.log('─'.repeat(70))

  let cambios = 0
  let yaIguales = 0
  let sinDato = 0

  // Actividades
  const actividades = await prisma.actividad.findMany({
    where: { tenantId },
    select: { id: true, nombre: true, cuotaMensual: true, conceptoTesoreriaId: true },
  })

  for (const act of actividades) {
    const actNorm = act.nombre.toUpperCase().trim()
    const importe = importeActividad.get(actNorm)
    if (importe == null) {
      sinDato++
      continue
    }
    const actual = Number(act.cuotaMensual || 0)
    if (Math.abs(actual - importe) < 0.01) {
      yaIguales++
      console.log(`   = Actividad ${act.nombre}: $${fmt(importe)} (sin cambios)`)
      continue
    }

    cambios++
    console.log(`   ${actual < importe ? '↑' : '↓'} Actividad ${act.nombre}: $${fmt(actual)} → $${fmt(importe)}`)

    if (APPLY) {
      await prisma.actividad.update({
        where: { id: act.id },
        data: { cuotaMensual: importe },
      })
      if (act.conceptoTesoreriaId) {
        await prisma.conceptoTesoreria.update({
          where: { id: act.conceptoTesoreriaId },
          data: { cuotaMensual: importe },
        })
      }
    }
  }

  // Tipos de socio
  const tiposSocio = await prisma.tipoSocio.findMany({
    where: { tenantId },
    select: { id: true, codigo: true, nombre: true, cuotaMensual: true, conceptoTesoreriaId: true },
  })

  for (const ts of tiposSocio) {
    const cod = (ts.codigo || '').toUpperCase()
    let importe = null
    if (cod === 'SOCIO_UNICO' || cod === 'MIEMBRO_FAMILIA') importe = importeSocioUnico
    else if (cod === 'TITULAR_FAMILIA') importe = importeTitularFamilia

    if (importe == null) {
      sinDato++
      continue
    }
    const actual = Number(ts.cuotaMensual || 0)
    if (Math.abs(actual - importe) < 0.01) {
      yaIguales++
      console.log(`   = TipoSocio ${ts.nombre}: $${fmt(importe)} (sin cambios)`)
      continue
    }

    cambios++
    console.log(`   ${actual < importe ? '↑' : '↓'} TipoSocio ${ts.nombre}: $${fmt(actual)} → $${fmt(importe)}`)

    if (APPLY) {
      await prisma.tipoSocio.update({
        where: { id: ts.id },
        data: { cuotaMensual: importe },
      })
      if (ts.conceptoTesoreriaId) {
        await prisma.conceptoTesoreria.update({
          where: { id: ts.conceptoTesoreriaId },
          data: { cuotaMensual: importe },
        })
      }
    }
  }

  // ── Reporte final ─────────────────────────────────────────────────────────
  console.log('─'.repeat(70))
  console.log()
  console.log(`✅ Cambios:    ${cambios}`)
  console.log(`   Ya iguales: ${yaIguales}`)
  console.log(`   Sin dato:   ${sinDato} (en el Excel no hay cuota PAGADA en el período)`)
  console.log()

  if (!APPLY && cambios > 0) {
    console.log(`💡 Para aplicar: agregá --apply al final del comando.`)
  } else if (APPLY) {
    console.log(`✅ Cambios aplicados.`)
  }
}

main()
  .catch(e => { console.error('❌ Error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
