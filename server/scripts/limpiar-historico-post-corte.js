/**
 * Limpia los cargos+pagos MIGRACION_BRIO_HISTORICO cuyo PERIODO sea >= 04/2025.
 *
 * Bug: el cutoff de fecha en importar-cuotas-pre-corte.js usa Date construida
 * en local-time (`2025-04-01T00:00:00`) pero las fechas Excel se interpretan
 * como UTC; en UTC-3 las cuotas con Fecha Gen.=1/4/2025 quedan como
 * 2025-03-31 21:00 local y entran al histórico, duplicando las que ya trajo
 * importar-cuotas.js (que filtra por Periodo).
 *
 * Este script borra los duplicados manteniendo la importación principal.
 *
 * Uso:
 *   node server/scripts/limpiar-historico-post-corte.js --tenant sportivopilar --dry-run
 *   node server/scripts/limpiar-historico-post-corte.js --tenant sportivopilar --apply
 */

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : null
}
function flag(name) { return process.argv.includes(`--${name}`) }

const TENANT_SLUG = arg('tenant') || 'sportivopilar'
const APPLY = flag('apply')
const ORIGEN = 'MIGRACION_BRIO_HISTORICO'
// Período de corte: todo lo >= 04/2025 (anio > 2025 OR (anio=2025 AND mes >= 4))
const CORTE_ANIO = 2025
const CORTE_MES = 4

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } })
  if (!tenant) throw new Error(`Tenant '${TENANT_SLUG}' no existe`)

  console.log(`Tenant: ${TENANT_SLUG} (id=${tenant.id})`)
  console.log(`Modo  : ${APPLY ? '🔴 APPLY' : '🟡 DRY-RUN'}`)
  console.log(`Borrar de origen=${ORIGEN} cuyo período sea >= ${String(CORTE_MES).padStart(2,'0')}/${CORTE_ANIO}\n`)

  const periodosACortar = await prisma.periodo.findMany({
    where: {
      tenantId: tenant.id,
      OR: [
        { anio: { gt: CORTE_ANIO } },
        { anio: CORTE_ANIO, mes: { gte: CORTE_MES } },
      ],
    },
    select: { id: true, anio: true, mes: true, nombre: true },
    orderBy: [{ anio: 'asc' }, { mes: 'asc' }],
  })
  console.log(`Períodos afectados: ${periodosACortar.length}`)
  console.log(`  primero: ${periodosACortar[0]?.nombre} | último: ${periodosACortar[periodosACortar.length - 1]?.nombre}\n`)

  const periodoIds = periodosACortar.map(p => p.id)

  const cargosCount = await prisma.cargo.count({
    where: { tenantId: tenant.id, origen: ORIGEN, periodoId: { in: periodoIds } }
  })
  const pagosCount = await prisma.pago.count({
    where: {
      tenantId: tenant.id, origen: ORIGEN,
      cargos: { some: { periodoId: { in: periodoIds } } }
    }
  })
  const movsCount = await prisma.movimientoCaja.count({
    where: {
      tenantId: tenant.id,
      pago: { origen: ORIGEN, cargos: { some: { periodoId: { in: periodoIds } } } }
    }
  })

  console.log(`Cargos a borrar:           ${cargosCount}`)
  console.log(`Pagos a borrar:            ${pagosCount}`)
  console.log(`MovimientosCaja a borrar:  ${movsCount}`)

  if (!APPLY) {
    console.log(`\n🟡 DRY-RUN — no se modificó la BD.\n`)
    return
  }

  console.log(`\n🔴 APPLY: borrando...`)
  // Orden: 1) movimientos_caja → 2) pagos → 3) cargos
  // Pero cargos.pagoId debe ser limpiado antes de borrar pagos. Hago primero:
  // (a) los pagos a borrar son los MIGH cuyo cargo está en este periodo y va a ser borrado
  // (b) borro los cargos del periodo (esto deja pagoId huérfano en otros cargos? No: cada pago
  //     MIGH tiene 1 cargo asociado en el script — al borrar el cargo, el pago queda sin cargo
  //     pero el FK es pago_id en cargo, no al revés. El pago queda con FK colgante? No, pago no
  //     tiene FK a cargo. El cargo es el que apunta al pago.

  // Estrategia simple:
  // 1) Buscar cargos que se van a borrar
  // 2) De ellos, los pagoId únicos son los pagos a borrar (siempre y cuando sean MIGH)
  // 3) Borrar movimientos de esos pagos
  // 4) Borrar pagos
  // 5) Borrar cargos

  const cargosABorrar = await prisma.cargo.findMany({
    where: { tenantId: tenant.id, origen: ORIGEN, periodoId: { in: periodoIds } },
    select: { id: true, pagoId: true },
  })
  const cargoIds = cargosABorrar.map(c => c.id)
  const pagoIdsCandidatos = [...new Set(cargosABorrar.map(c => c.pagoId).filter(Boolean))]

  // De esos pagoIds, mantener solo los que son MIGH (los MIG son del importar-cuotas.js, no tocar)
  const pagosMIGHaBorrar = pagoIdsCandidatos.length > 0 ? await prisma.pago.findMany({
    where: { id: { in: pagoIdsCandidatos }, origen: ORIGEN },
    select: { id: true },
  }) : []
  const pagoIds = pagosMIGHaBorrar.map(p => p.id)

  console.log(`  Cargos identificados:  ${cargoIds.length}`)
  console.log(`  Pagos MIGH asociados:  ${pagoIds.length}`)

  // Borrar movimientos de esos pagos
  const delMov = await prisma.movimientoCaja.deleteMany({
    where: { tenantId: tenant.id, pagoId: { in: pagoIds } }
  })
  console.log(`  Movimientos borrados:  ${delMov.count}`)

  // Limpiar pagoId de cargos antes de borrar pagos (otros cargos podrían apuntar)
  await prisma.cargo.updateMany({
    where: { id: { in: cargoIds } },
    data: { pagoId: null }
  })

  const delPag = await prisma.pago.deleteMany({
    where: { id: { in: pagoIds } }
  })
  console.log(`  Pagos borrados:        ${delPag.count}`)

  const delCar = await prisma.cargo.deleteMany({
    where: { id: { in: cargoIds } }
  })
  console.log(`  Cargos borrados:       ${delCar.count}`)

  console.log(`\n✅ Limpieza completa.\n`)
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
