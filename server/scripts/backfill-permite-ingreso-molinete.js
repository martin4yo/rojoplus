#!/usr/bin/env node
/**
 * Backfill: activa permiteIngresoMolinete=true en los EstadoSocio que
 * típicamente representan "habilitado para ingresar" (codigo o nombre que
 * incluye VIGENTE / ACTIVO / AL DIA).
 *
 * Uso:
 *   node server/scripts/backfill-permite-ingreso-molinete.js                 # todos los tenants
 *   node server/scripts/backfill-permite-ingreso-molinete.js --tenant pilar  # un tenant
 *   node server/scripts/backfill-permite-ingreso-molinete.js --dry-run       # solo previsualizar
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function arg(name) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : null
}
const slug = arg('--tenant')
const dryRun = process.argv.includes('--dry-run')

const PATRONES = [/VIGENTE/i, /ACTIVO/i, /AL\s*D[IÍ]A/i]

function matchesPatron(estado) {
  return PATRONES.some(rx => rx.test(estado.codigo || '') || rx.test(estado.nombre || ''))
}

async function main() {
  let tenantWhere = {}
  if (slug) {
    const tenant = await prisma.tenant.findUnique({ where: { subdomain: slug } })
    if (!tenant) {
      console.error(`Tenant "${slug}" no encontrado`)
      process.exit(1)
    }
    tenantWhere = { tenantId: tenant.id }
    console.log(`Solo tenant: ${tenant.subdomain} (id=${tenant.id})`)
  } else {
    console.log('Todos los tenants')
  }

  const estados = await prisma.estadoSocio.findMany({
    where: tenantWhere,
    orderBy: [{ tenantId: 'asc' }, { codigo: 'asc' }]
  })

  let toEnable = []
  let yaActivos = []
  let saltados = []

  for (const e of estados) {
    if (matchesPatron(e)) {
      if (e.permiteIngresoMolinete) yaActivos.push(e)
      else toEnable.push(e)
    } else {
      saltados.push(e)
    }
  }

  console.log(`\n📊 Resumen:`)
  console.log(`   Estados que matchean patrones VIGENTE/ACTIVO/AL DIA: ${toEnable.length + yaActivos.length}`)
  console.log(`   Ya tenían el flag activo: ${yaActivos.length}`)
  console.log(`   A activar: ${toEnable.length}`)
  console.log(`   Otros estados (no se tocan): ${saltados.length}\n`)

  if (toEnable.length > 0) {
    console.log('Se activará permiteIngresoMolinete=true en:')
    for (const e of toEnable) {
      console.log(`   tenant=${e.tenantId} id=${e.id} codigo=${e.codigo} nombre="${e.nombre}"`)
    }
  }

  if (yaActivos.length > 0) {
    console.log('\nYa estaban activos:')
    for (const e of yaActivos) {
      console.log(`   tenant=${e.tenantId} id=${e.id} codigo=${e.codigo} nombre="${e.nombre}"`)
    }
  }

  if (dryRun) {
    console.log('\n🟡 --dry-run: no se aplican cambios')
    return
  }

  if (toEnable.length === 0) {
    console.log('\nNo hay nada para actualizar.')
    return
  }

  const ids = toEnable.map(e => e.id)
  const result = await prisma.estadoSocio.updateMany({
    where: { id: { in: ids } },
    data: { permiteIngresoMolinete: true }
  })

  console.log(`\n✅ Actualizados ${result.count} estados.`)
}

main()
  .catch(err => {
    console.error('Error:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
