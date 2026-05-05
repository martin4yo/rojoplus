/**
 * Genera un .md con el detalle de inconsistencias a revisar antes de generar
 * cuotas de un período: socios desincronizados (FK ≠ string) y socios
 * "sospechosos" (tuvieron cuota Brio en otros períodos pero no en el actual,
 * con FK=VIGENTE — posibles bajas no marcadas).
 *
 * Uso:
 *   DATABASE_URL="..." node server/scripts/dump-inconsistencias-cuotas.js \
 *     --tenant sportivopilar --periodo 05/2026 --out docs/inconsistencias-cuotas-05-2026.md
 */
import XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PrismaClient } from '@prisma/client'
import { arg, resolveTenant } from './_lib/cli.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const prisma = new PrismaClient()

function norm(s) { return String(s ?? '').trim().toUpperCase() }

function parsePeriodo(s) {
  const m = s.match(/^(\d{1,2})\/(\d{4})$/)
  if (!m) throw new Error(`Periodo invalido: ${s}`)
  return { mes: parseInt(m[1]), anio: parseInt(m[2]) }
}

async function main() {
  const tenant = await resolveTenant(prisma, 'dump-inconsistencias-cuotas.js')
  const periodoStr = arg('periodo')
  const outPath = arg('out') || `inconsistencias-${tenant.slug}.md`
  if (!periodoStr) throw new Error('Falta --periodo MM/YYYY')
  const { mes, anio } = parsePeriodo(periodoStr)

  // Maestras
  const [estados, categorias, tipos] = await Promise.all([
    prisma.estadoSocio.findMany({ where: { tenantId: tenant.id }, select: { id: true, nombre: true, codigo: true } }),
    prisma.categoriaSocio.findMany({ where: { tenantId: tenant.id }, select: { id: true, nombre: true, codigo: true } }),
    prisma.tipoSocio.findMany({ where: { tenantId: tenant.id }, select: { id: true, nombre: true, codigo: true } }),
  ])
  const matchea = (m, str) => {
    const n = norm(str)
    if (!n) return null
    return m.find(x => norm(x.nombre) === n || norm(x.codigo) === n) || null
  }

  // Detección desincronizados
  const todos = await prisma.socio.findMany({
    where: { tenantId: tenant.id },
    select: {
      id: true, nroSocio: true, apellidoNombre: true,
      estado: true, categoria: true, tipoSocio: true,
      estadoSocioId: true, categoriaSocioId: true, tipoSocioRelId: true,
      estadoSocioRel:    { select: { id: true, nombre: true } },
      categoriaSocioRel: { select: { id: true, nombre: true } },
      tipoSocioRel:      { select: { id: true, nombre: true } },
    },
  })

  const desincro = []   // FK ya seteada pero string ≠ nombre FK
  const huerfanos = []  // string poblado, FK null y ningún match en maestra

  for (const s of todos) {
    const issues = []
    const dims = [
      { label: 'estado', str: s.estado, fk: s.estadoSocioRel, maestra: estados },
      { label: 'categoria', str: s.categoria, fk: s.categoriaSocioRel, maestra: categorias },
      { label: 'tipoSocio', str: s.tipoSocio, fk: s.tipoSocioRel, maestra: tipos },
    ]
    for (const d of dims) {
      if (!d.str && !d.fk) continue
      if (d.str && d.fk) {
        if (norm(d.str) !== norm(d.fk.nombre)) {
          issues.push({ tipo: 'desincro', dim: d.label, str: d.str, fk: d.fk.nombre })
        }
      } else if (d.str && !d.fk) {
        if (!matchea(d.maestra, d.str)) {
          issues.push({ tipo: 'huerfano', dim: d.label, str: d.str })
        }
      }
    }
    if (issues.some(i => i.tipo === 'desincro')) desincro.push({ s, issues: issues.filter(i => i.tipo === 'desincro') })
    if (issues.some(i => i.tipo === 'huerfano')) huerfanos.push({ s, issues: issues.filter(i => i.tipo === 'huerfano') })
  }

  // Sospechosos: cargar Brio + comparar
  const excelPath = path.join(__dirname, '..', '..', 'brio', 'Cuotas.xlsx')
  const wb = XLSX.readFile(excelPath)
  const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { range: 2 })
  const target1 = `${String(mes).padStart(2, '0')}/${anio}`
  const target2 = `${mes}/${anio}`

  const enBrioPeriodo = new Set()
  const conAlgunaCuotaSocialBrio = new Set()
  for (const r of data) {
    const tipo = norm(r['Tipo Cuota'])
    if (tipo !== 'CUOTA SOCIAL') continue
    const nro = String(r['Nro. Socio'] ?? '').trim()
    if (!nro) continue
    conAlgunaCuotaSocialBrio.add(nro)
    const per = String(r['Periodo'] ?? '').trim()
    if (per === target1 || per === target2) enBrioPeriodo.add(nro)
  }

  const periodoBD = await prisma.periodo.findFirst({
    where: { tenantId: tenant.id, anio, mes }, select: { id: true },
  })
  const existentes = await prisma.cargo.findMany({
    where: { tenantId: tenant.id, periodoId: periodoBD.id, categoria: 'CUOTA_SOCIAL' },
    select: { socioId: true },
  })
  const existentesSet = new Set(existentes.map(c => c.socioId))

  const activosFK = await prisma.socio.findMany({
    where: {
      tenantId: tenant.id,
      estadoSocioRel: {
        OR: [
          { nombre: { contains: 'Activ', mode: 'insensitive' } },
          { nombre: { contains: 'Vigent', mode: 'insensitive' } },
        ],
      },
    },
    select: {
      id: true, nroSocio: true, apellidoNombre: true,
      titularFamiliaId: true,
      fechaAlta: true, fechaBaja: true, motivoBaja: true,
      categoriaSocioRel: { select: { nombre: true, porcentajeDescuento: true } },
      tipoSocioRel: { select: { nombre: true, cuotaMensual: true, conceptoTesoreria: { select: { cuotaMensual: true } } } },
      estadoSocioRel: { select: { nombre: true } },
    },
  })

  // Solo cuentan como "sospechosos accionables" los que SÍ generarían cuota:
  // titulares (no miembros), descuento < 100% y tipoSocio con cuotaMensual > 0.
  const sospechosos = activosFK
    .filter(s => !existentesSet.has(s.id))
    .filter(s => !s.apellidoNombre?.toUpperCase().includes('BUFFET'))
    .filter(s => conAlgunaCuotaSocialBrio.has(s.nroSocio) && !enBrioPeriodo.has(s.nroSocio))
    .filter(s => !s.titularFamiliaId)
    .filter(s => {
      const desc = s.categoriaSocioRel?.porcentajeDescuento ? Number(s.categoriaSocioRel.porcentajeDescuento) : 0
      return desc < 100
    })
    .filter(s => {
      const cuota = s.tipoSocioRel?.conceptoTesoreria?.cuotaMensual
        ? Number(s.tipoSocioRel.conceptoTesoreria.cuotaMensual)
        : Number(s.tipoSocioRel?.cuotaMensual || 0)
      return cuota > 0
    })
    .sort((a, b) => parseInt(a.nroSocio) - parseInt(b.nroSocio))

  // Render markdown
  const lines = []
  lines.push(`# Inconsistencias a revisar antes de generar cuotas — ${tenant.nombre}`)
  lines.push('')
  lines.push(`**Período:** ${target1}`)
  lines.push(`**Generado:** ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`)
  lines.push('')
  lines.push('Este documento lista los casos que conviene revisar **antes** de regenerar cuotas en la UI.')
  lines.push('Ninguno bloquea la generación, pero pueden ocultar bajas no registradas o socios que ya no deberían facturar.')
  lines.push('')
  lines.push('---')
  lines.push('')

  // SECCIÓN 1: Desincronizados FK ≠ string
  lines.push(`## 1. Socios desincronizados (FK ≠ string legacy) — ${desincro.length}`)
  lines.push('')
  lines.push('La FK apunta a un valor distinto del string legacy. **La FK manda** (es la que usa la generación de cuotas), pero la UI antes mostraba el string.')
  lines.push('Para resolver: abrir cada socio en el modal, validar el valor correcto, guardar. El backend reescribe el string desde la FK.')
  lines.push('')
  if (desincro.length === 0) {
    lines.push('_Ninguno._')
  } else {
    lines.push('| nroSocio | Nombre | Dimensión | String legacy | FK (vigente) |')
    lines.push('|---|---|---|---|---|')
    for (const { s, issues } of desincro) {
      for (const i of issues) {
        lines.push(`| ${s.nroSocio} | ${s.apellidoNombre} | ${i.dim} | "${i.str}" | "${i.fk}" |`)
      }
    }
  }
  lines.push('')

  // SECCIÓN 2: Huérfanos (string sin FK ni match)
  lines.push(`## 2. Huérfanos (string sin FK y sin match en la maestra) — ${huerfanos.length}`)
  lines.push('')
  lines.push('El string legacy no existe en la tabla maestra correspondiente. Hay que crear el valor en la maestra o cambiar el campo a uno válido.')
  lines.push('')
  if (huerfanos.length === 0) {
    lines.push('_Ninguno._')
  } else {
    lines.push('| nroSocio | Nombre | Dimensión | String huérfano | Acción sugerida |')
    lines.push('|---|---|---|---|---|')
    for (const { s, issues } of huerfanos) {
      for (const i of issues) {
        lines.push(`| ${s.nroSocio} | ${s.apellidoNombre} | ${i.dim} | "${i.str}" | Reasignar desde el modal a un valor válido (o crear "${i.str}" en la maestra) |`)
      }
    }
  }
  lines.push('')

  // SECCIÓN 3: Sospechosos
  lines.push(`## 3. Sospechosos accionables: con cuota histórica Brio pero no en ${target1} — ${sospechosos.length}`)
  lines.push('')
  lines.push(`Socios titulares marcados como **VIGENTE** por la FK que **sí generarían cuota** (categoría con descuento < 100% y tipo de socio con cuota mensual > 0)`)
  lines.push(`pero que tuvieron cuota Brio en algún período histórico y **no aparecen en ${target1}**.`)
  lines.push('')
  lines.push('Filtros aplicados (excluidos automáticamente, no son inconsistencia real):')
  lines.push('- Categorías con 100% de descuento (VITALICIO, BECADO, etc.) — por definición no facturan.')
  lines.push('- Miembros de familia (paga el titular).')
  lines.push('- Tipos de socio sin cuota mensual configurada.')
  lines.push('')
  lines.push('Posibles causas de los listados:')
  lines.push('- Baja real no registrada en el sistema.')
  lines.push('- Cambio de condición que el operador Brio reflejó pero acá no.')
  lines.push('')
  if (sospechosos.length === 0) {
    lines.push('_Ninguno._')
  } else {
    lines.push('| nroSocio | Nombre | Categoría | Desc % | Tipo Socio | Alta | Baja | Motivo |')
    lines.push('|---|---|---|---:|---|---|---|---|')
    for (const s of sospechosos) {
      const cat = s.categoriaSocioRel?.nombre ?? '-'
      const desc = s.categoriaSocioRel?.porcentajeDescuento ?? 0
      const tipo = s.tipoSocioRel?.nombre ?? '-'
      const alta = s.fechaAlta?.toISOString().slice(0, 10) ?? '-'
      const baja = s.fechaBaja?.toISOString().slice(0, 10) ?? '-'
      const motivo = s.motivoBaja ?? '-'
      lines.push(`| ${s.nroSocio} | ${s.apellidoNombre} | ${cat} | ${desc} | ${tipo} | ${alta} | ${baja} | ${motivo} |`)
    }
  }
  lines.push('')
  // SECCIÓN 4: Cuotas de actividad a generar (preview)
  const cargosActExist = await prisma.cargo.findMany({
    where: { tenantId: tenant.id, periodoId: periodoBD.id, categoria: 'CUOTA_ACTIVIDAD' },
    select: { socioId: true, categoriaActividadId: true },
  })
  const setActExist = new Set(cargosActExist.map(c => `${c.socioId}-${c.categoriaActividadId}`))

  const inscripciones = await prisma.inscripcion.findMany({
    where: {
      tenantId: tenant.id,
      estado: 'ACTIVA',
      exentoCuota: false,
      socio: {
        estadoSocioRel: {
          OR: [
            { nombre: { contains: 'Activ', mode: 'insensitive' } },
            { nombre: { contains: 'Vigent', mode: 'insensitive' } },
          ],
        },
      },
    },
    select: {
      id: true, socioId: true, categoriaActividadId: true, porcentajeCuota: true,
      socio: { select: { nroSocio: true, apellidoNombre: true, fechaAlta: true, categoriaSocioRel: { select: { nombre: true, porcentajeDescuento: true } } } },
      categoriaActividad: {
        select: {
          nombre: true, cuotaMensual: true,
          actividad: { select: { nombre: true, cuotaMensual: true, conceptoTesoreria: { select: { cuotaMensual: true } } } },
        },
      },
    },
  })

  // Set de actividades+categoria que el socio tuvo en Brio en períodos anteriores
  const actividadesHistoricasPorSocio = new Map()
  for (const r of data) {
    if (norm(r['Tipo Cuota']) !== 'ACTIVIDAD') continue
    const nro = String(r['Nro. Socio'] ?? '').trim()
    if (!nro) continue
    if (!actividadesHistoricasPorSocio.has(nro)) actividadesHistoricasPorSocio.set(nro, new Set())
    actividadesHistoricasPorSocio.get(nro).add(String(r['Desc. Cuota'] ?? '').trim())
  }

  const actGeneraria = []
  for (const i of inscripciones) {
    if (setActExist.has(`${i.socioId}-${i.categoriaActividadId}`)) continue
    let montoBase = i.categoriaActividad.actividad.conceptoTesoreria?.cuotaMensual
      ? Number(i.categoriaActividad.actividad.conceptoTesoreria.cuotaMensual)
      : (i.categoriaActividad.cuotaMensual ? Number(i.categoriaActividad.cuotaMensual)
      : (i.categoriaActividad.actividad.cuotaMensual ? Number(i.categoriaActividad.actividad.cuotaMensual) : 0))
    const pct = i.porcentajeCuota ? Number(i.porcentajeCuota) : 100
    if (pct !== 100) montoBase = montoBase * (pct / 100)
    const desc = i.socio.categoriaSocioRel?.porcentajeDescuento ? Number(i.socio.categoriaSocioRel.porcentajeDescuento) : 0
    const montoTotal = montoBase - montoBase * (desc / 100)
    if (montoTotal <= 0) continue

    const histo = actividadesHistoricasPorSocio.get(i.socio.nroSocio)
    const tipo = !histo ? 'NUEVA' : 'CAMBIO_CATEGORIA'
    actGeneraria.push({ insc: i, montoTotal, tipo, histo: histo ? [...histo] : [] })
  }

  lines.push(`## 4. Cuotas de actividad que se generarán — ${actGeneraria.length}`)
  lines.push('')
  lines.push('Inscripciones activas que aún no tienen cargo en el período. Cruce contra Brio:')
  lines.push('- **NUEVA:** alta/inscripción posterior al último cierre Brio.')
  lines.push('- **CAMBIO_CATEGORIA:** Brio facturaba otra categoría de la misma actividad (típicamente promoción de edad).')
  lines.push('')
  lines.push('Todas son legítimas. Listadas a fines informativos.')
  lines.push('')
  if (actGeneraria.length === 0) {
    lines.push('_Ninguna._')
  } else {
    lines.push('| nroSocio | Nombre | Actividad / Categoría | Monto | Tipo | Brio histórico |')
    lines.push('|---|---|---|---:|---|---|')
    for (const a of actGeneraria) {
      const acto = `${a.insc.categoriaActividad.actividad.nombre} / ${a.insc.categoriaActividad.nombre}`
      const histoStr = a.histo.length > 0 ? a.histo.slice(0, 3).join(' \\| ') + (a.histo.length > 3 ? '...' : '') : '-'
      lines.push(`| ${a.insc.socio.nroSocio} | ${a.insc.socio.apellidoNombre} | ${acto} | $${a.montoTotal} | ${a.tipo} | ${histoStr} |`)
    }
  }
  lines.push('')

  lines.push('---')
  lines.push('')
  lines.push('## Cómo regenerar después de resolver')
  lines.push('')
  lines.push('1. Tocar cada socio en secciones 1 y 2 desde el modal de Socios y guardar (sin necesidad de cambiar nada — el guardado sincroniza FK ↔ string).')
  lines.push('2. Para los sospechosos de la sección 3 que sean baja real: cambiar el estado del socio a "BAJA POR ..." y guardar (también seteará `fechaBaja` cuando exista el flag `esBaja`).')
  lines.push('3. Re-correr el preview:')
  lines.push('   ```bash')
  lines.push(`   node server/src/scripts/validarRegeneracionCuotaSocial.js --tenant ${tenant.slug} --periodo ${anio}-${String(mes).padStart(2, '0')} --modo preview`)
  lines.push('   ```')
  lines.push('4. Generar desde la UI: **Cuotas → Períodos → ' + target1 + ' → Generar**.')
  lines.push('')

  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true })
  fs.writeFileSync(outPath, lines.join('\n'), 'utf-8')
  console.log(`OK: ${outPath} generado (${desincro.length} desincronizados, ${huerfanos.length} huérfanos, ${sospechosos.length} sospechosos).`)
}

main()
  .catch(e => { console.error('ERROR:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
