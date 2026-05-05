/**
 * Genera la cuota social faltante de un periodo para una lista puntual de socios.
 * Replica la lógica de POST /api/admin/periodos/:id/generar (cuotas.js:286+) pero
 * acotada a los IDs indicados. Útil cuando el período ya está cerrado y solo hay
 * que dar de alta cuotas a socios renumerados / migrados / nuevos.
 *
 * Uso:
 *   node scripts/generar-cuota-social-socios.js --tenant <slug> --periodo YYYY-MM --ids 9185,9186 [--apply]
 *
 * Sin --apply es dry-run.
 */

import { PrismaClient } from '@prisma/client'
import { arg, flag, resolveTenant } from './_lib/cli.js'

const prisma = new PrismaClient()

async function main() {
  const tenant = await resolveTenant(prisma, 'generar-cuota-social-socios.js')
  const tenantId = tenant.id
  const apply = flag('apply')

  const periodoStr = arg('periodo')
  const idsArg = arg('ids')
  if (!periodoStr || !/^\d{4}-\d{2}$/.test(periodoStr)) {
    console.error('❌ Falta --periodo YYYY-MM')
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
  console.log(`Periodo: ${periodo.nombre || `${mes}/${anio}`} (id=${periodo.id}, estado=${periodo.estado}, vto=${periodo.fechaVencimiento?.toISOString?.()?.slice(0,10)})\n`)

  const cargosACrear = []
  for (const socioId of ids) {
    const socio = await prisma.socio.findUnique({
      where: { id: socioId },
      select: {
        id: true, nroSocio: true, apellidoNombre: true, titularFamiliaId: true, tipoSocio: true,
        tipoSocioRel: {
          select: {
            cuotaMensual: true,
            conceptoTesoreriaId: true,
            conceptoTesoreria: { select: { cuotaMensual: true } },
          },
        },
        categoriaSocioRel: { select: { porcentajeDescuento: true } },
      },
    })
    if (!socio) {
      console.warn(`⚠ id=${socioId}: no existe`)
      continue
    }

    // Verificar duplicado
    const yaExiste = await prisma.cargo.findFirst({
      where: { tenantId, periodoId: periodo.id, socioId: socio.id, categoria: 'CUOTA_SOCIAL' },
      select: { id: true },
    })
    if (yaExiste) {
      console.log(`#${socio.nroSocio} ${socio.apellidoNombre} (id=${socio.id}): ya tiene cuota social (cargo id=${yaExiste.id}). Salteo.`)
      continue
    }

    // Solo titulares o socios únicos
    const esTitularOUnico = !socio.titularFamiliaId
    if (!esTitularOUnico) {
      console.log(`#${socio.nroSocio} ${socio.apellidoNombre}: es miembro de familia, no se le genera cuota social.`)
      continue
    }

    // Monto base
    const cuotaSocialMonto = socio.tipoSocioRel?.conceptoTesoreria?.cuotaMensual
      ? Number(socio.tipoSocioRel.conceptoTesoreria.cuotaMensual)
      : Number(socio.tipoSocioRel?.cuotaMensual || 0)
    if (!cuotaSocialMonto) {
      console.log(`#${socio.nroSocio} ${socio.apellidoNombre}: tipo de socio sin cuota mensual. Salteo.`)
      continue
    }

    // Descuento por categoría
    const descuentoPct = socio.categoriaSocioRel?.porcentajeDescuento
      ? Number(socio.categoriaSocioRel.porcentajeDescuento)
      : 0
    const montoBase = cuotaSocialMonto
    const montoBonificacion = montoBase * (descuentoPct / 100)
    const montoTotal = montoBase - montoBonificacion
    if (montoTotal <= 0) {
      console.log(`#${socio.nroSocio} ${socio.apellidoNombre}: monto total = 0 tras descuento. Salteo.`)
      continue
    }

    const esFamilia = socio.tipoSocio?.toLowerCase().includes('familia')
    const tipoCuota = esFamilia ? 'GRUPO_FAMILIAR' : 'SOCIO_UNICO'

    cargosACrear.push({
      socio,
      cargo: {
        tenantId,
        periodoId: periodo.id,
        socioId: socio.id,
        grupoFamiliarId: socio.titularFamiliaId || socio.id,
        categoria: 'CUOTA_SOCIAL',
        tipoCuota,
        conceptoTesoreriaId: socio.tipoSocioRel?.conceptoTesoreriaId || null,
        descripcion: `Cuota Social - ${tipoCuota === 'GRUPO_FAMILIAR' ? 'Grupo Familiar' : 'Socio Único'}`,
        montoOriginal: montoBase,
        montoRecargo: 0,
        montoBonificacion,
        montoTotal,
        estado: 'PENDIENTE',
        fechaVencimiento: periodo.fechaVencimiento,
        origen: 'GENERACION_MANUAL_RENUMERACION',
        motivoBonificacion: descuentoPct > 0 ? `Descuento por categoría: ${descuentoPct}%` : null,
      },
    })
  }

  if (cargosACrear.length === 0) {
    console.log('\nNada para crear.')
    return
  }

  console.log('\nPlan de creación:')
  for (const { socio, cargo } of cargosACrear) {
    console.log(`  socio_id=${socio.id} #${socio.nroSocio} ${socio.apellidoNombre}  monto=${cargo.montoTotal}  vto=${cargo.fechaVencimiento?.toISOString?.()?.slice(0,10)}`)
  }

  if (!apply) {
    console.log('\nDry-run. Pasá --apply para crear los cargos.')
    return
  }

  await prisma.$transaction(async tx => {
    for (const { cargo } of cargosACrear) {
      await tx.cargo.create({ data: cargo })
    }
  })
  console.log(`\n✓ ${cargosACrear.length} cuota(s) social(es) generadas.`)
}

main()
  .catch(err => { console.error('Error:', err.message); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
