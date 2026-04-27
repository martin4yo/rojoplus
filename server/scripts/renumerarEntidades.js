/**
 * Renumera entidades existentes en un tenant para que usen el estándar de códigos
 * por tipo: PROVEEDOR → PROV-YYYY-NNNNN, PERSONAL → PERS-YYYY-NNNNN, CLIENTE → CLI-YYYY-NNNNN.
 *
 * Útil cuando hay entidades cargadas con el código viejo (ENT-YYYY-NNNNN) y querés
 * pasarlas al nuevo formato.
 *
 * Uso:
 *   - Dry-run: node scripts/renumerarEntidades.js --tenant sportivopilar --dry-run
 *   - Aplicar: node scripts/renumerarEntidades.js --tenant sportivopilar
 *   - Solo un tipo: --tipos PERSONAL  (default: PROVEEDOR,PERSONAL,CLIENTE)
 *
 * Comportamiento:
 *   - Solo toca entidades cuyo código NO empieza ya con el prefijo correcto.
 *   - Genera nuevos códigos secuenciales después del último PROV/PERS/CLI existente.
 *   - Las FKs hacia entidades usan `entidadId` (int), NO el código → renombrar es seguro.
 *   - Idempotente: si re-corrés, no toca las que ya están en formato nuevo.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function arg(name, def = null) {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1) return def
  return process.argv[i + 1] || def
}

const TENANT_SLUG = arg('tenant')
const DRY_RUN = process.argv.includes('--dry-run')
const TIPOS = (arg('tipos', 'PROVEEDOR,PERSONAL,CLIENTE') || '')
  .split(',').map(t => t.trim()).filter(Boolean)

if (!TENANT_SLUG) {
  console.error('Uso: node renumerarEntidades.js --tenant <slug> [--tipos PERSONAL,PROVEEDOR,CLIENTE] [--dry-run]')
  process.exit(1)
}

const PREFIJOS = { PROVEEDOR: 'PROV', CLIENTE: 'CLI', PERSONAL: 'PERS' }

async function main() {
  console.log(`\n=== Renumerar entidades ===`)
  console.log(`Tenant: ${TENANT_SLUG}`)
  console.log(`Tipos:  ${TIPOS.join(', ')}`)
  console.log(`Modo:   ${DRY_RUN ? 'DRY-RUN' : 'APLICAR'}\n`)

  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } })
  if (!tenant) { console.error(`❌ Tenant '${TENANT_SLUG}' no encontrado`); process.exit(1) }
  console.log(`✔ Tenant: ${tenant.nombre} (id=${tenant.id})\n`)

  const anio = new Date().getFullYear()
  let totalRenombradas = 0

  for (const tipo of TIPOS) {
    const prefijo = PREFIJOS[tipo]
    if (!prefijo) {
      console.log(`──── ${tipo}: SIN PREFIJO DEFINIDO, saltando ────\n`)
      continue
    }
    console.log(`──── ${tipo} (prefijo ${prefijo}-) ────`)

    // Entidades de este tipo que NO tienen ya el prefijo correcto
    const aRenombrar = await prisma.entidad.findMany({
      where: {
        tenantId: tenant.id,
        tipo,
        NOT: { codigo: { startsWith: `${prefijo}-` } },
      },
      orderBy: { id: 'asc' },
    })

    if (aRenombrar.length === 0) {
      console.log(`  Sin entidades para renumerar (todas ya tienen ${prefijo}-).\n`)
      continue
    }

    console.log(`  ${aRenombrar.length} entidad(es) a renumerar.`)

    // Encontrar el último número usado en este tenant con este prefijo
    const ultima = await prisma.entidad.findFirst({
      where: { tenantId: tenant.id, codigo: { startsWith: `${prefijo}-` } },
      orderBy: { codigo: 'desc' },
    })
    let seq = 0
    if (ultima) {
      const partes = ultima.codigo.split('-')
      seq = parseInt(partes[partes.length - 1]) || 0
    }

    for (const e of aRenombrar) {
      seq += 1
      const nuevoCodigo = `${prefijo}-${anio}-${String(seq).padStart(5, '0')}`

      if (DRY_RUN) {
        console.log(`  + ${e.codigo} → ${nuevoCodigo}  (${e.razonSocial})`)
      } else {
        try {
          await prisma.entidad.update({
            where: { id: e.id },
            data: { codigo: nuevoCodigo },
          })
          console.log(`  ✔ ${e.codigo} → ${nuevoCodigo}  (${e.razonSocial})`)
        } catch (err) {
          console.error(`  ❌ Error renombrando #${e.id} ${e.codigo}: ${err.message}`)
          continue
        }
      }
      totalRenombradas++
    }
    console.log()
  }

  console.log(`=== Resumen ===`)
  console.log(`  ${DRY_RUN ? 'Se renombrarían' : 'Renombradas'}: ${totalRenombradas}`)
  if (DRY_RUN) console.log(`\n⚠ DRY-RUN. Para aplicar, corré sin --dry-run.`)
  else        console.log(`\n✅ Renumeración completada.`)
}

main()
  .catch(err => { console.error('\n❌ Error:', err); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
