/**
 * Sincroniza las tablas de parámetros con los valores reales de los socios.
 *
 * REGLAS DEL SISTEMA:
 *   - EstadoSocio   → valores tal cual del Excel (ej. VIGENTE, BAJA POR MOROSIDAD)
 *   - CategoriaSocio → valores tal cual del Excel (ej. ACTIVO, INFANTIL, CADETE)
 *   - TipoSocio      → EXACTAMENTE 3 valores fijos: "Socio Unico", "Miembro Familia", "Titular Familia"
 *   - parentescoTitular → valores de parentesco (Hijo/a, Esposo/a, etc.) — NO van en TipoSocio
 *
 * Útil después de importar socios vía CLI o migrar datos de otro sistema.
 * También mueve valores de parentesco que hayan quedado en tipoSocio al campo correcto.
 *
 * Uso:
 *   node scripts/sincronizar-params-socios.js --tenant sportivotest
 *   node scripts/sincronizar-params-socios.js --tenant sportivotest --dry-run
 */

import { PrismaClient } from '@prisma/client'
import { resolveTenant, flag } from './_lib/cli.js'

const prisma = new PrismaClient()
const DRY = flag('dry-run')

// Valores que son parentesco (no tipo de socio)
const PARENTESCOS_CONOCIDOS = new Set([
  'Hijo/a', 'Hija', 'Hijo', 'Esposo/a', 'Esposo', 'Esposa',
  'Conyuge', 'Cónyuge', 'Padre', 'Madre', 'Hermano/a', 'Hermano', 'Hermana',
  'Tutor', 'Abuelo/a', 'Nieto/a', 'Otro/a', 'Otro',
])

// Tipos de socio fijos del sistema
const TIPOS_SISTEMA = ['Socio Unico', 'Miembro Familia', 'Titular Familia']

async function upsertParam(model, tenantId, nombre, extra = {}) {
  const n = nombre.trim()
  const codigo = n.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').substring(0, 50)
  const ex = await model.findFirst({ where: { tenantId, OR: [{ nombre: n }, { codigo }] } })
  if (ex) return ex
  if (DRY) { console.log(`   [DRY] Crearía: "${n}"`); return { id: null, nombre: n } }
  const r = await model.create({ data: { tenantId, codigo, nombre: n, ...extra } })
  console.log(`   ✓ Creado: "${n}" (id=${r.id})`)
  return r
}

async function main() {
  const tenant = await resolveTenant(prisma, 'sincronizar-params-socios.js')
  const tenantId = tenant.id
  console.log(`\nModo: ${DRY ? 'DRY-RUN (sin escritura)' : 'APLICAR'}\n`)

  const socios = await prisma.socio.findMany({
    where: { tenantId },
    select: { id: true, estado: true, categoria: true, tipoSocio: true, parentescoTitular: true },
  })
  console.log(`📊 Socios: ${socios.length}`)

  // ── 1. EstadoSocio: crear los que faltan (valores reales del Excel) ─────────
  console.log('\n📋 EstadoSocio...')
  const estadosReales = [...new Set(socios.map(s => s.estado).filter(Boolean))]
  const mapEstado = {}
  for (const est of estadosReales) {
    const pd = est.toUpperCase().includes('VIGENT') || est.toUpperCase().includes('ACTIV')
    const rec = await upsertParam(prisma.estadoSocio, tenantId, est, {
      color: pd ? '#10B981' : '#9CA3AF', permiteDescuentos: pd,
    })
    if (rec?.id) mapEstado[est] = rec.id
  }
  // Eliminar registros de estados no usados por ningún socio
  const todosEstados = await prisma.estadoSocio.findMany({ where: { tenantId } })
  for (const r of todosEstados.filter(e => !estadosReales.includes(e.nombre))) {
    if (!DRY) {
      await prisma.socio.updateMany({ where: { tenantId, estadoSocioId: r.id }, data: { estadoSocioId: null } })
      await prisma.estadoSocio.delete({ where: { id: r.id } })
    }
    console.log(`   ${DRY ? '[DRY] Borraría' : '✗ Borrado'} estado sin uso: "${r.nombre}"`)
  }

  // ── 2. CategoriaSocio: crear los que faltan ─────────────────────────────────
  console.log('\n📋 CategoriaSocio...')
  const categoriasReales = [...new Set(socios.map(s => s.categoria).filter(Boolean))]
  const mapCategoria = {}
  for (const cat of categoriasReales) {
    const rec = await upsertParam(prisma.categoriaSocio, tenantId, cat, { color: '#3B82F6' })
    if (rec?.id) mapCategoria[cat] = rec.id
  }
  const todasCategorias = await prisma.categoriaSocio.findMany({ where: { tenantId } })
  for (const r of todasCategorias.filter(c => !categoriasReales.includes(c.nombre))) {
    if (!DRY) {
      await prisma.socio.updateMany({ where: { tenantId, categoriaSocioId: r.id }, data: { categoriaSocioId: null } })
      await prisma.categoriaSocio.delete({ where: { id: r.id } })
    }
    console.log(`   ${DRY ? '[DRY] Borraría' : '✗ Borrado'} categoría sin uso: "${r.nombre}"`)
  }

  // ── 3. TipoSocio: garantizar los 3 valores fijos del sistema ───────────────
  console.log('\n📋 TipoSocio (3 valores fijos del sistema)...')
  const mapTipo = {}
  for (const nombre of TIPOS_SISTEMA) {
    const rec = await upsertParam(prisma.tipoSocio, tenantId, nombre, { color: '#3B82F6' })
    if (rec?.id) mapTipo[nombre] = rec.id
    else {
      // En dry-run o si ya existía, buscar el id real
      const ex = await prisma.tipoSocio.findFirst({ where: { tenantId, nombre } })
      if (ex) mapTipo[nombre] = ex.id
    }
  }
  // Eliminar tipos que no sean los 3 del sistema
  const todosTipos = await prisma.tipoSocio.findMany({ where: { tenantId } })
  for (const r of todosTipos.filter(t => !TIPOS_SISTEMA.includes(t.nombre))) {
    if (!DRY) {
      await prisma.socio.updateMany({ where: { tenantId, tipoSocioRelId: r.id }, data: { tipoSocioRelId: null } })
      await prisma.tipoSocio.delete({ where: { id: r.id } })
    }
    console.log(`   ${DRY ? '[DRY] Borraría' : '✗ Borrado'} tipo no-sistema: "${r.nombre}"`)
  }

  // ── 4. Corregir socios con parentesco en tipoSocio ─────────────────────────
  console.log('\n🔧 Corrigiendo parentescos mal ubicados en tipoSocio...')
  const conParentescoEnTipo = socios.filter(s => s.tipoSocio && PARENTESCOS_CONOCIDOS.has(s.tipoSocio))
  console.log(`   Socios con parentesco en tipoSocio: ${conParentescoEnTipo.length}`)
  if (!DRY) {
    for (const s of conParentescoEnTipo) {
      await prisma.socio.update({
        where: { id: s.id },
        data: {
          parentescoTitular: s.parentescoTitular || s.tipoSocio,
          tipoSocio: 'Miembro Familia',
          tipoSocioRelId: mapTipo['Miembro Familia'] || null,
        },
      })
    }
  }

  // ── 5. Asignar "Socio Unico" a socios sin tipo ─────────────────────────────
  const sinTipoValido = socios.filter(s =>
    !s.tipoSocio || (!TIPOS_SISTEMA.includes(s.tipoSocio) && !PARENTESCOS_CONOCIDOS.has(s.tipoSocio))
  )
  console.log(`   Socios sin tipo válido → Socio Unico: ${sinTipoValido.length}`)
  if (!DRY && sinTipoValido.length > 0) {
    await prisma.socio.updateMany({
      where: { tenantId, id: { in: sinTipoValido.map(s => s.id) } },
      data: { tipoSocio: 'Socio Unico', tipoSocioRelId: mapTipo['Socio Unico'] || null },
    })
  }

  // ── 6. Actualizar FKs para todos los socios ────────────────────────────────
  console.log('\n🔗 Actualizando FK de socios...')
  if (!DRY) {
    let upd = 0
    // Recargar socios con el estado actualizado
    const sociosActualizados = await prisma.socio.findMany({
      where: { tenantId },
      select: { id: true, estado: true, categoria: true, tipoSocio: true },
    })
    for (const s of sociosActualizados) {
      const data = {}
      if (s.estado    && mapEstado[s.estado])       data.estadoSocioId    = mapEstado[s.estado]
      if (s.categoria && mapCategoria[s.categoria]) data.categoriaSocioId = mapCategoria[s.categoria]
      if (s.tipoSocio && mapTipo[s.tipoSocio])      data.tipoSocioRelId   = mapTipo[s.tipoSocio]
      if (Object.keys(data).length) { await prisma.socio.update({ where: { id: s.id }, data }); upd++ }
    }
    console.log(`   ✓ ${upd} socios con FKs actualizadas`)
  }

  // ── Resumen ────────────────────────────────────────────────────────────────
  const [tE, tC, tT] = await Promise.all([
    prisma.estadoSocio.count({ where: { tenantId } }),
    prisma.categoriaSocio.count({ where: { tenantId } }),
    prisma.tipoSocio.count({ where: { tenantId } }),
  ])
  console.log('\n✅ Sincronización completada.')
  console.log(`   EstadoSocio:    ${tE} — ${(await prisma.estadoSocio.findMany({ where: { tenantId }, select: { nombre: true } })).map(r => r.nombre).join(', ')}`)
  console.log(`   CategoriaSocio: ${tC} — ${(await prisma.categoriaSocio.findMany({ where: { tenantId }, select: { nombre: true } })).map(r => r.nombre).join(', ')}`)
  console.log(`   TipoSocio:      ${tT} — ${(await prisma.tipoSocio.findMany({ where: { tenantId }, select: { nombre: true } })).map(r => r.nombre).join(', ')}`)
}

main()
  .catch(err => { console.error('\n❌', err.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
