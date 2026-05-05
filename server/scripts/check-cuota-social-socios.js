/**
 * Chequea si una lista de socios (por id) tiene generada la cuota social del
 * período indicado.
 *
 * Uso:
 *   node scripts/check-cuota-social-socios.js --tenant sportivopilar --periodo 2026-05 --ids 9185,9186
 */

import { PrismaClient } from '@prisma/client'
import { arg, resolveTenant } from './_lib/cli.js'

const prisma = new PrismaClient()

async function main() {
  const tenant = await resolveTenant(prisma, 'check-cuota-social-socios.js')
  const tenantId = tenant.id

  const periodoStr = arg('periodo')
  const idsArg = arg('ids')
  if (!periodoStr || !/^\d{4}-\d{2}$/.test(periodoStr)) {
    console.error('❌ Falta --periodo YYYY-MM (ej: 2026-05)')
    process.exit(1)
  }
  if (!idsArg) {
    console.error('❌ Falta --ids 9185,9186')
    process.exit(1)
  }
  const [anio, mes] = periodoStr.split('-').map(Number)
  const ids = idsArg.split(',').map(s => parseInt(s.trim(), 10)).filter(Boolean)

  const periodo = await prisma.periodo.findFirst({
    where: { tenantId, anio, mes },
  })
  if (!periodo) {
    console.error(`❌ Periodo ${periodoStr} no existe en tenant ${tenant.slug}`)
    process.exit(1)
  }
  console.log(`Periodo: ${periodo.nombre || `${mes}/${anio}`} (id=${periodo.id}, estado=${periodo.estado})\n`)

  for (const socioId of ids) {
    const socio = await prisma.socio.findUnique({
      where: { id: socioId },
      select: {
        id: true, nroSocio: true, apellidoNombre: true, fechaAlta: true, fechaBaja: true,
        estadoSocioRel: { select: { nombre: true } },
        categoriaSocioRel: { select: { nombre: true, porcentajeDescuento: true } },
        tipoSocioRel: { select: { nombre: true, cuotaMensual: true } },
      },
    })
    if (!socio) {
      console.log(`⚠ id=${socioId}: no existe`)
      continue
    }

    const cargoSocial = await prisma.cargo.findFirst({
      where: {
        tenantId,
        periodoId: periodo.id,
        socioId: socio.id,
        categoria: 'CUOTA_SOCIAL',
      },
      select: { id: true, montoTotal: true, estado: true },
    })

    const desc = socio.categoriaSocioRel?.porcentajeDescuento ?? 0
    const cuotaTipo = Number(socio.tipoSocioRel?.cuotaMensual || 0)
    const facturable = desc < 100 && cuotaTipo > 0

    console.log(`#${socio.nroSocio} ${socio.apellidoNombre} (id=${socio.id})`)
    console.log(`  Estado: ${socio.estadoSocioRel?.nombre || '-'} | Categoría: ${socio.categoriaSocioRel?.nombre || '-'} (${desc}% desc) | Tipo: ${socio.tipoSocioRel?.nombre || '-'} (cuota=${cuotaTipo})`)
    console.log(`  ¿Debería facturar?: ${facturable ? 'SÍ' : 'NO (categoría con 100% desc o tipo sin cuota)'}`)
    if (cargoSocial) {
      console.log(`  → Cuota social existente: id=${cargoSocial.id}, monto=${cargoSocial.montoTotal}, estado=${cargoSocial.estado}`)
    } else {
      console.log(`  → ⚠ NO TIENE cuota social en este período`)
    }
    console.log()
  }
}

main()
  .catch(err => { console.error(err.message); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
