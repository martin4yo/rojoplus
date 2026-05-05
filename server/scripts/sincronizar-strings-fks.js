/**
 * Completa las FKs (estadoSocioId, categoriaSocioId, tipoSocioRelId) en Socio
 * cuando están en null pero hay un string legacy (estado, categoria, tipoSocio)
 * que matchea contra la maestra correspondiente.
 *
 * NO toca strings ni resuelve desincronizados — sólo rellena FKs faltantes.
 *
 * Uso:
 *   DATABASE_URL="..." node server/scripts/sincronizar-strings-fks.js --tenant sportivopilar
 *   Agregar --apply para persistir cambios. Sin --apply hace dry-run.
 */
import { PrismaClient } from '@prisma/client'
import { flag, resolveTenant } from './_lib/cli.js'

const prisma = new PrismaClient()

function norm(s) { return String(s ?? '').trim().toUpperCase() }

async function cargarMaestras(tenantId) {
  const [estados, categorias, tipos] = await Promise.all([
    prisma.estadoSocio.findMany({ where: { tenantId }, select: { id: true, nombre: true, codigo: true } }),
    prisma.categoriaSocio.findMany({ where: { tenantId }, select: { id: true, nombre: true, codigo: true } }),
    prisma.tipoSocio.findMany({ where: { tenantId }, select: { id: true, nombre: true, codigo: true } }),
  ])
  return { estados, categorias, tipos }
}

function buscarPorNombre(maestra, str) {
  const n = norm(str)
  if (!n) return null
  return maestra.find(m => norm(m.nombre) === n || norm(m.codigo) === n) || null
}

async function main() {
  const tenant = await resolveTenant(prisma, 'sincronizar-strings-fks.js')
  const apply = flag('apply')
  const modo = apply ? 'APPLY' : 'DRY-RUN'
  console.log(`\n=== Completar FKs nulas en Socio (${modo}) ===`)
  console.log(`Tenant: ${tenant.nombre} (id=${tenant.id})\n`)

  const maestras = await cargarMaestras(tenant.id)
  console.log(`Maestras: ${maestras.estados.length} estados, ${maestras.categorias.length} categorias, ${maestras.tipos.length} tipos`)

  const todos = await prisma.socio.findMany({
    where: { tenantId: tenant.id },
    select: {
      id: true, nroSocio: true, apellidoNombre: true,
      estado: true, categoria: true, tipoSocio: true,
      estadoSocioId: true, categoriaSocioId: true, tipoSocioRelId: true,
    },
  })
  const socios = todos.filter(s =>
    (!s.estadoSocioId    && s.estado) ||
    (!s.categoriaSocioId && s.categoria) ||
    (!s.tipoSocioRelId   && s.tipoSocio)
  )
  console.log(`Socios escaneados: ${todos.length} | candidatos (alguna FK null con string poblado): ${socios.length}\n`)

  const dims = [
    { label: 'estado',    str: 'estado',    fkId: 'estadoSocioId',    maestra: maestras.estados },
    { label: 'categoria', str: 'categoria', fkId: 'categoriaSocioId', maestra: maestras.categorias },
    { label: 'tipoSocio', str: 'tipoSocio', fkId: 'tipoSocioRelId',   maestra: maestras.tipos },
  ]

  const updates = new Map() // socioId → patch
  const huerfanos = { estado: [], categoria: [], tipoSocio: [] }
  const stats = { estado: 0, categoria: 0, tipoSocio: 0 }

  for (const s of socios) {
    for (const d of dims) {
      if (s[d.fkId] || !s[d.str]) continue // FK ya seteada o string vacío → skip
      const match = buscarPorNombre(d.maestra, s[d.str])
      if (!match) {
        huerfanos[d.label].push({ socio: s, str: s[d.str] })
        continue
      }
      const patch = updates.get(s.id) || {}
      patch[d.fkId] = match.id
      updates.set(s.id, patch)
      stats[d.label]++
    }
  }

  console.log('--- Resumen ---')
  for (const d of dims) {
    console.log(`  ${d.label.padEnd(10)} | FKs a completar: ${stats[d.label]} | huerfanos (sin match): ${huerfanos[d.label].length}`)
  }

  for (const dim of ['estado', 'categoria', 'tipoSocio']) {
    if (huerfanos[dim].length > 0) {
      console.log(`\n[Huérfanos ${dim}] (string sin match en maestra; no se tocan)`)
      for (const h of huerfanos[dim].slice(0, 50)) {
        console.log(`  ${h.socio.nroSocio} ${h.socio.apellidoNombre} | "${h.str}"`)
      }
      if (huerfanos[dim].length > 50) console.log(`  ...y ${huerfanos[dim].length - 50} más`)
    }
  }

  console.log(`\nSocios con cambios pendientes: ${updates.size}`)
  if (updates.size > 0 && updates.size <= 30) {
    console.log('\n--- Detalle ---')
    for (const [socioId, patch] of updates) {
      const s = socios.find(x => x.id === socioId)
      console.log(`  ${s.nroSocio} ${s.apellidoNombre}: ${JSON.stringify(patch)}`)
    }
  }

  if (!apply) {
    console.log('\nDRY-RUN: nada se modificó. Volver a correr con --apply para persistir.')
    return
  }

  console.log('\nAplicando cambios...')
  let aplicados = 0
  for (const [socioId, patch] of updates) {
    await prisma.socio.update({ where: { id: socioId }, data: patch })
    aplicados++
  }
  console.log(`OK: ${aplicados} socios actualizados.`)
}

main()
  .catch(e => { console.error('ERROR:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
