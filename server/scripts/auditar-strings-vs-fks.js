/**
 * Audita inconsistencias entre los campos string legacy del Socio
 * (estado, tipoSocio, categoria) y sus FKs (estadoSocioRel, tipoSocioRel,
 * categoriaSocioRel).
 *
 * Reporta para un tenant:
 *   - Socios con string poblado pero FK null (FK perdida).
 *   - Socios con FK poblada pero string null (legacy vacío).
 *   - Socios con string ≠ nombre/codigo de la FK (desincronizado).
 *
 * Uso:
 *   DATABASE_URL="..." node server/scripts/auditar-strings-vs-fks.js --tenant sportivopilar
 *   --detalle estado | --detalle categoria | --detalle tipoSocio (lista todos)
 */
import { PrismaClient } from '@prisma/client'
import { arg, resolveTenant } from './_lib/cli.js'

const prisma = new PrismaClient()

function norm(s) { return String(s ?? '').trim().toUpperCase() }

async function cargarSocios(tenantId) {
  return prisma.socio.findMany({
    where: { tenantId },
    select: {
      id: true, nroSocio: true, apellidoNombre: true,
      estado: true,
      categoria: true,
      tipoSocio: true,
      estadoSocioId: true,
      categoriaSocioId: true,
      tipoSocioRelId: true,
      estadoSocioRel:    { select: { nombre: true, codigo: true } },
      categoriaSocioRel: { select: { nombre: true, codigo: true } },
      tipoSocioRel:      { select: { nombre: true, codigo: true } },
    },
  })
}

function clasificar(socios, getString, getFK) {
  const r = { coincide: 0, ambosVacios: [], stringSinFK: [], fkSinString: [], desincronizado: [] }
  for (const s of socios) {
    const str = getString(s)
    const fk = getFK(s)
    if (!str && !fk) { r.ambosVacios.push(s); continue }
    if (str && !fk) { r.stringSinFK.push(s); continue }
    if (!str && fk) { r.fkSinString.push(s); continue }
    if (norm(str) === norm(fk.nombre) || norm(str) === norm(fk.codigo)) r.coincide++
    else r.desincronizado.push({ s, str, fkNombre: fk.nombre, fkCodigo: fk.codigo })
  }
  return r
}

function reportar(label, total, r) {
  console.log(`\n═══════ ${label.toUpperCase()} ═══════`)
  console.log(`Total socios               : ${total}`)
  console.log(`Coinciden (string ≡ FK)    : ${r.coincide}`)
  console.log(`Ambos vacíos               : ${r.ambosVacios.length}`)
  console.log(`String poblado, FK null    : ${r.stringSinFK.length}`)
  console.log(`FK poblada, string null    : ${r.fkSinString.length}`)
  console.log(`DESINCRONIZADOS            : ${r.desincronizado.length}`)

  if (r.desincronizado.length > 0) {
    const patrones = {}
    for (const d of r.desincronizado) {
      const k = `${d.str || '<vacío>'} → ${d.fkNombre}`
      patrones[k] = (patrones[k] || 0) + 1
    }
    console.log(`\n  Patrones de desincronización (top 20):`)
    for (const [k, cnt] of Object.entries(patrones).sort((a, b) => b[1] - a[1]).slice(0, 20)) {
      console.log(`    ${k.padEnd(60)} ${cnt}`)
    }
  }
}

function detalle(label, r, getString, getFK, max = 100) {
  console.log(`\n--- DETALLE ${label.toUpperCase()} (hasta ${max} por sección) ---`)

  if (r.stringSinFK.length > 0) {
    console.log(`\n[String poblado, FK null] (${r.stringSinFK.length})`)
    for (const s of r.stringSinFK.slice(0, max)) {
      console.log(`  ${s.nroSocio} ${s.apellidoNombre} | string="${getString(s)}" | FK=null`)
    }
    if (r.stringSinFK.length > max) console.log(`  ...y ${r.stringSinFK.length - max} más`)
  }
  if (r.fkSinString.length > 0) {
    console.log(`\n[FK poblada, string null] (${r.fkSinString.length})`)
    for (const s of r.fkSinString.slice(0, max)) {
      console.log(`  ${s.nroSocio} ${s.apellidoNombre} | string=null | FK="${getFK(s)?.nombre}"`)
    }
    if (r.fkSinString.length > max) console.log(`  ...y ${r.fkSinString.length - max} más`)
  }
  if (r.desincronizado.length > 0) {
    console.log(`\n[Desincronizados] (${r.desincronizado.length})`)
    for (const d of r.desincronizado.slice(0, max)) {
      console.log(`  ${d.s.nroSocio} ${d.s.apellidoNombre} | string="${d.str}" | FK="${d.fkNombre}" (cod=${d.fkCodigo})`)
    }
    if (r.desincronizado.length > max) console.log(`  ...y ${r.desincronizado.length - max} más`)
  }
}

async function main() {
  const tenant = await resolveTenant(prisma, 'auditar-strings-vs-fks.js')
  const detalleArg = arg('detalle')
  const socios = await cargarSocios(tenant.id)
  console.log(`\nSocios cargados: ${socios.length}`)

  const dims = [
    { label: 'ESTADO',          getString: s => s.estado,     getFK: s => s.estadoSocioRel },
    { label: 'CATEGORIA SOCIO', getString: s => s.categoria,  getFK: s => s.categoriaSocioRel },
    { label: 'TIPO SOCIO',      getString: s => s.tipoSocio,  getFK: s => s.tipoSocioRel },
  ]

  for (const d of dims) {
    const r = clasificar(socios, d.getString, d.getFK)
    reportar(d.label, socios.length, r)
    if (detalleArg && (
      (detalleArg === 'estado'    && d.label === 'ESTADO') ||
      (detalleArg === 'categoria' && d.label === 'CATEGORIA SOCIO') ||
      (detalleArg === 'tipoSocio' && d.label === 'TIPO SOCIO')
    )) {
      detalle(d.label, r, d.getString, d.getFK)
    }
  }

  if (!detalleArg) {
    console.log(`\n\nPara ver detalle por dimensión:`)
    console.log(`  --detalle estado | --detalle categoria | --detalle tipoSocio`)
  }
}

main()
  .catch(e => { console.error('ERROR:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
