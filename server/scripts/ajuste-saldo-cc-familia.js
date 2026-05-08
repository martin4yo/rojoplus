/**
 * Ajusta el saldo de cuenta corriente por GRUPO FAMILIAR creando un cargo
 * compensatorio (estado=PAGADO) en la cuenta del titular para que:
 *
 *     saldoCC familia = adeudado familia (cuotas pendientes)
 *
 * Para cada familia con delta = saldoCC - adeudado < 0 (pagos en exceso),
 * crea un cargo PAGADO sin pago asociado por |delta|. Eso eleva noAnulados
 * sin afectar adeudado, balanceando exactamente.
 *
 * Identificador: AJUSTE_COMPENSACION_SALDO_CC_20260507
 *   - origen del Cargo creado = 'AJUSTE_COMPENSACION_SALDO_CC_20260507'
 *   - permite revertir con: DELETE FROM cargos WHERE origen='...'
 *
 * Idempotente: borra cargos previos con ese origen antes de re-crear.
 *
 * Uso:
 *   node server/scripts/ajuste-saldo-cc-familia.js --tenant sportivopilar --dry-run
 *   node server/scripts/ajuste-saldo-cc-familia.js --tenant sportivopilar --apply
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
const ORIGEN = 'AJUSTE_COMPENSACION_SALDO_CC_20260507'
const FECHA_AJUSTE = new Date('2026-04-30T23:59:59')
const TOL = parseFloat(arg('tolerancia') || '0.01')

function fmt(n) {
  return Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } })
  if (!tenant) throw new Error(`Tenant '${TENANT_SLUG}' no existe`)

  console.log(`Tenant : ${TENANT_SLUG} (id=${tenant.id})`)
  console.log(`Modo   : ${APPLY ? '🔴 APPLY' : '🟡 DRY-RUN'}`)
  console.log(`Origen : ${ORIGEN}`)
  console.log(`Fecha  : ${FECHA_AJUSTE.toISOString().slice(0, 10)}\n`)

  // Cargar agregados (excluyendo previamente cargos del mismo ORIGEN para que
  // re-correr no se acumule)
  const [cargosTodos, cargosPend, pagos, socios] = await Promise.all([
    prisma.cargo.groupBy({
      by: ['socioId'],
      where: { tenantId: tenant.id, estado: { not: 'ANULADO' }, origen: { not: ORIGEN } },
      _sum: { montoTotal: true },
    }),
    prisma.cargo.groupBy({
      by: ['socioId'],
      where: { tenantId: tenant.id, estado: 'PENDIENTE', origen: { not: ORIGEN } },
      _sum: { montoTotal: true },
    }),
    prisma.pago.groupBy({
      by: ['socioId'],
      where: { tenantId: tenant.id, estado: 'CONFIRMADO' },
      _sum: { montoTotal: true },
    }),
    prisma.socio.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, nroSocio: true, apellidoNombre: true, titularFamiliaId: true },
    }),
  ])

  const cargosBy = new Map(cargosTodos.map(r => [r.socioId, Number(r._sum.montoTotal || 0)]))
  const pendBy = new Map(cargosPend.map(r => [r.socioId, Number(r._sum.montoTotal || 0)]))
  const pagosBy = new Map(pagos.map(r => [r.socioId, Number(r._sum.montoTotal || 0)]))
  const socioById = new Map(socios.map(s => [s.id, s]))

  // Agrupar por titular
  const familias = new Map()
  for (const s of socios) {
    const titularId = s.titularFamiliaId || s.id
    if (!familias.has(titularId)) {
      familias.set(titularId, { titular: socioById.get(titularId), cargos: 0, pagos: 0, adeudado: 0 })
    }
    const f = familias.get(titularId)
    f.cargos += cargosBy.get(s.id) || 0
    f.pagos += pagosBy.get(s.id) || 0
    f.adeudado += pendBy.get(s.id) || 0
  }

  // Identificar familias a ajustar
  const aAjustar = []
  for (const f of familias.values()) {
    if (!f.titular) continue
    const saldoCC = f.cargos - f.pagos
    const delta = saldoCC - f.adeudado
    if (delta < -TOL) {
      aAjustar.push({
        titularId: f.titular.id,
        nroTitular: f.titular.nroSocio,
        nombre: f.titular.apellidoNombre,
        saldoCC,
        adeudado: f.adeudado,
        delta,
        montoAjuste: Math.abs(delta),
      })
    }
  }

  aAjustar.sort((a, b) => b.montoAjuste - a.montoAjuste)
  const sumaAjustes = aAjustar.reduce((a, x) => a + x.montoAjuste, 0)

  console.log(`Familias a ajustar:                    ${aAjustar.length}`)
  console.log(`Suma de ajustes (cargos a crear):      $${fmt(sumaAjustes)}\n`)

  console.log('Top 10 ajustes:')
  for (const x of aAjustar.slice(0, 10)) {
    const nom = (x.nombre || '').padEnd(38).slice(0, 38)
    console.log(`  ${String(x.nroTitular).padStart(6)}  ${nom}  saldoCC=${fmt(x.saldoCC).padStart(11)}  adeudado=${fmt(x.adeudado).padStart(11)}  ajuste=$${fmt(x.montoAjuste).padStart(11)}`)
  }

  if (!APPLY) {
    console.log(`\n🟡 DRY-RUN. Re-correr con --apply para crear los cargos compensatorios.\n`)
    return
  }

  // ── APPLY ───────────────────────────────────────────────────────────────────
  console.log(`\n🔴 APPLY: borrando previos con origen=${ORIGEN}...`)
  const del = await prisma.cargo.deleteMany({ where: { tenantId: tenant.id, origen: ORIGEN } })
  console.log(`  Eliminados: ${del.count}`)

  console.log(`\nCreando ${aAjustar.length} cargos compensatorios...`)
  let creados = 0, errores = 0
  for (const x of aAjustar) {
    try {
      await prisma.cargo.create({
        data: {
          tenantId: tenant.id,
          socioId: x.titularId,
          descripcion: 'Ajuste de saldo - pagos previos no aplicados a cuotas',
          categoria: 'AJUSTE',
          montoOriginal: x.montoAjuste,
          montoRecargo: 0,
          montoBonificacion: 0,
          montoTotal: x.montoAjuste,
          estado: 'PAGADO',
          fechaGeneracion: FECHA_AJUSTE,
          fechaPago: FECHA_AJUSTE,
          origen: ORIGEN,
          observaciones: `Compensación de saldo CC familia (titular ${x.nroTitular}). Conciliación Brio→Clubix 2026-05-07.`,
        }
      })
      creados++
      if (creados % 100 === 0) process.stdout.write(`\r  Creados: ${creados}/${aAjustar.length}...`)
    } catch (e) {
      errores++
      if (errores <= 10) console.log(`\n  ERROR titular ${x.nroTitular}: ${e.message}`)
    }
  }

  console.log(`\n\n✅ Creados: ${creados} | Errores: ${errores}`)
  console.log(`   Para revertir: DELETE FROM cargos WHERE origen='${ORIGEN}'\n`)
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
