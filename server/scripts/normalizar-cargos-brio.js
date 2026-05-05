/**
 * Normaliza el campo Cargo.categoria de los cargos importados desde Brio
 * (origen='MIGRACION_BRIO') a los valores canónicos del sistema, para que
 * el endpoint POST /periodos/:id/generar y los reportes los reconozcan
 * correctamente y la regeneración no genere duplicados.
 *
 * Mapeos aplicados:
 *   categoria='SOCIO_UNICO'      → categoria='CUOTA_SOCIAL',     tipoCuota='SOCIO_UNICO'
 *   categoria='TITULAR_FAMILIA'  → categoria='CUOTA_SOCIAL',     tipoCuota='TITULAR_FAMILIA'
 *   categoria='GRUPO_FAMILIAR'   → categoria='CUOTA_SOCIAL',     tipoCuota='GRUPO_FAMILIAR'  (defensivo)
 *   categoria='ACTIVIDAD'        → categoria='CUOTA_ACTIVIDAD'   (tipoCuota intacto)
 *   categoria='FINANCIADO'       → categoria='FINANCIACION'
 *   categoria='MORA'             → categoria='MOROSIDAD'
 *
 * Uso:
 *   # Dry-run (default — no escribe nada, solo reporta):
 *   DATABASE_URL="..." node server/scripts/normalizar-cargos-brio.js --tenant sportivopilar
 *
 *   # Aplicar cambios:
 *   DATABASE_URL="..." node server/scripts/normalizar-cargos-brio.js --tenant sportivopilar --apply
 *
 *   # Rollback (revertir un run anterior usando el CSV generado):
 *   DATABASE_URL="..." node server/scripts/normalizar-cargos-brio.js --tenant sportivopilar --rollback <ruta_csv>
 *
 * Cada run con --apply escribe un CSV de respaldo en server/scripts/logs/
 * con (cargoId, categoriaAntes, tipoCuotaAntes, categoriaDespues, tipoCuotaDespues)
 * para reversibilidad total.
 */
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { arg, flag, resolveTenant } from './_lib/cli.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const prisma = new PrismaClient()

// Cada mapeo: { from, to: { categoria, tipoCuota? }, descripcion }
// Si tipoCuota es undefined → no se toca. Si es string → se setea.
const MAPPINGS = [
  {
    from: 'SOCIO_UNICO',
    to: { categoria: 'CUOTA_SOCIAL', tipoCuota: 'SOCIO_UNICO' },
    descripcion: 'Cuota social de socio único',
  },
  {
    from: 'TITULAR_FAMILIA',
    to: { categoria: 'CUOTA_SOCIAL', tipoCuota: 'TITULAR_FAMILIA' },
    descripcion: 'Cuota social de titular de familia',
  },
  {
    from: 'GRUPO_FAMILIAR',
    to: { categoria: 'CUOTA_SOCIAL', tipoCuota: 'GRUPO_FAMILIAR' },
    descripcion: 'Cuota social de grupo familiar (defensivo, raro)',
  },
  {
    from: 'ACTIVIDAD',
    to: { categoria: 'CUOTA_ACTIVIDAD' },
    descripcion: 'Cuota de actividad',
  },
  {
    from: 'FINANCIADO',
    to: { categoria: 'FINANCIACION' },
    descripcion: 'Cargo de financiación',
  },
  {
    from: 'MORA',
    to: { categoria: 'MOROSIDAD' },
    descripcion: 'Recargo por mora',
  },
]

async function reportarEstadoActual(tenantId) {
  console.log('\n--- Estado actual de Cargo.categoria (origen=MIGRACION_BRIO) ---')
  const grupos = await prisma.$queryRaw`
    SELECT categoria, COUNT(*)::int AS cnt
    FROM cargos
    WHERE tenant_id = ${tenantId} AND origen = 'MIGRACION_BRIO'
    GROUP BY categoria
    ORDER BY cnt DESC
  `
  const total = grupos.reduce((s, g) => s + g.cnt, 0)
  for (const g of grupos) {
    console.log(`  ${String(g.categoria ?? '<null>').padEnd(22)} ${String(g.cnt).padStart(8)}`)
  }
  console.log(`  ${'TOTAL'.padEnd(22)} ${String(total).padStart(8)}`)
}

async function muestraSample(tenantId, fromCategoria, n = 3) {
  return prisma.cargo.findMany({
    where: { tenantId, origen: 'MIGRACION_BRIO', categoria: fromCategoria },
    select: {
      id: true, socioId: true, periodoId: true, categoria: true, tipoCuota: true,
      descripcion: true, montoTotal: true, estado: true,
      socio: { select: { nroSocio: true, apellidoNombre: true } },
      periodo: { select: { anio: true, mes: true } },
    },
    take: n,
    orderBy: { id: 'asc' },
  })
}

async function modoPreview(tenant) {
  await reportarEstadoActual(tenant.id)

  console.log('\n--- Plan de normalización ---')
  let totalCambios = 0
  for (const m of MAPPINGS) {
    const count = await prisma.cargo.count({
      where: { tenantId: tenant.id, origen: 'MIGRACION_BRIO', categoria: m.from },
    })
    if (count === 0) {
      console.log(`  ${m.from.padEnd(22)} → no hay cargos a normalizar (skip)`)
      continue
    }
    totalCambios += count
    const target = m.to.tipoCuota
      ? `categoria='${m.to.categoria}', tipoCuota='${m.to.tipoCuota}'`
      : `categoria='${m.to.categoria}'`
    console.log(`  ${m.from.padEnd(22)} → ${target}    (${count} cargos)`)

    const sample = await muestraSample(tenant.id, m.from, 2)
    for (const c of sample) {
      const per = c.periodo ? `${c.periodo.anio}-${String(c.periodo.mes).padStart(2, '0')}` : '-'
      console.log(`      ej. cargoId=${c.id} socio=${c.socio?.nroSocio} ${c.socio?.apellidoNombre} per=${per} cat=${c.categoria} tipo=${c.tipoCuota ?? '-'} estado=${c.estado} monto=${c.montoTotal}`)
    }
  }
  console.log(`\nTotal a actualizar: ${totalCambios} cargos`)
  console.log('\nDry-run: no se modificó nada. Para aplicar, agregá --apply')
}

async function modoApply(tenant) {
  await reportarEstadoActual(tenant.id)

  // Recolectar IDs y estado original para el CSV de respaldo
  const cambios = []
  for (const m of MAPPINGS) {
    const cargos = await prisma.cargo.findMany({
      where: { tenantId: tenant.id, origen: 'MIGRACION_BRIO', categoria: m.from },
      select: { id: true, categoria: true, tipoCuota: true },
    })
    for (const c of cargos) {
      cambios.push({
        cargoId: c.id,
        categoriaAntes: c.categoria,
        tipoCuotaAntes: c.tipoCuota,
        categoriaDespues: m.to.categoria,
        tipoCuotaDespues: m.to.tipoCuota !== undefined ? m.to.tipoCuota : c.tipoCuota,
      })
    }
  }

  if (cambios.length === 0) {
    console.log('\nNo hay cargos a normalizar. Nada que hacer.')
    return
  }

  // Escribir CSV de respaldo ANTES de aplicar
  const logsDir = path.join(__dirname, 'logs')
  fs.mkdirSync(logsDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const csvPath = path.join(logsDir, `normalizar-brio-${tenant.slug}-${stamp}.csv`)
  const lines = ['cargoId,categoriaAntes,tipoCuotaAntes,categoriaDespues,tipoCuotaDespues']
  for (const c of cambios) {
    const esc = (v) => v === null || v === undefined ? '' : String(v).replace(/,/g, ' ')
    lines.push([c.cargoId, esc(c.categoriaAntes), esc(c.tipoCuotaAntes), esc(c.categoriaDespues), esc(c.tipoCuotaDespues)].join(','))
  }
  fs.writeFileSync(csvPath, lines.join('\n'), 'utf8')
  console.log(`\nRespaldo escrito en: ${csvPath}`)
  console.log(`Total a actualizar: ${cambios.length} cargos`)

  // Aplicar updates en transacción, agrupados por mapping para usar updateMany
  console.log('\nAplicando cambios en transacción...')
  const resultados = await prisma.$transaction(async (tx) => {
    const r = []
    for (const m of MAPPINGS) {
      const data = { categoria: m.to.categoria }
      if (m.to.tipoCuota !== undefined) data.tipoCuota = m.to.tipoCuota
      const upd = await tx.cargo.updateMany({
        where: { tenantId: tenant.id, origen: 'MIGRACION_BRIO', categoria: m.from },
        data,
      })
      if (upd.count > 0) r.push({ from: m.from, to: m.to, count: upd.count })
    }
    return r
  })

  console.log('\nResultado:')
  for (const r of resultados) {
    const target = r.to.tipoCuota !== undefined
      ? `categoria='${r.to.categoria}', tipoCuota='${r.to.tipoCuota}'`
      : `categoria='${r.to.categoria}'`
    console.log(`  ${r.from.padEnd(22)} → ${target}    ${r.count} actualizados`)
  }

  console.log('\n--- Estado final ---')
  await reportarEstadoActual(tenant.id)

  console.log(`\nListo. Para revertir si hace falta:`)
  console.log(`  node server/scripts/normalizar-cargos-brio.js --tenant ${tenant.slug} --rollback "${csvPath}"`)
}

async function modoRollback(tenant, csvPath) {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV no encontrado: ${csvPath}`)
  }
  const contenido = fs.readFileSync(csvPath, 'utf8').trim().split(/\r?\n/)
  const header = contenido.shift()
  if (!header || !header.startsWith('cargoId,')) {
    throw new Error(`CSV con formato inesperado: ${header}`)
  }

  const filas = contenido.map(line => {
    const [cargoId, categoriaAntes, tipoCuotaAntes, categoriaDespues, tipoCuotaDespues] = line.split(',')
    return {
      cargoId: parseInt(cargoId),
      categoriaAntes: categoriaAntes === '' ? null : categoriaAntes,
      tipoCuotaAntes: tipoCuotaAntes === '' ? null : tipoCuotaAntes,
      categoriaDespues,
      tipoCuotaDespues: tipoCuotaDespues === '' ? null : tipoCuotaDespues,
    }
  })

  console.log(`\nRollback de ${filas.length} cargos desde: ${csvPath}`)

  let revertidos = 0
  let saltados = 0
  await prisma.$transaction(async (tx) => {
    for (const f of filas) {
      // Solo revertir si el cargo SIGUE en el estado "después" (no fue tocado por otra cosa)
      const actual = await tx.cargo.findFirst({
        where: { id: f.cargoId, tenantId: tenant.id },
        select: { categoria: true, tipoCuota: true },
      })
      if (!actual) { saltados++; continue }
      if (actual.categoria !== f.categoriaDespues) { saltados++; continue }
      // Si tipoCuotaDespues no es null y difiere del actual, también saltar
      if (f.tipoCuotaDespues !== null && actual.tipoCuota !== f.tipoCuotaDespues) { saltados++; continue }

      await tx.cargo.update({
        where: { id: f.cargoId },
        data: {
          categoria: f.categoriaAntes,
          tipoCuota: f.tipoCuotaAntes,
        },
      })
      revertidos++
    }
  })

  console.log(`\nRevertidos: ${revertidos}`)
  console.log(`Saltados (estado distinto al esperado): ${saltados}`)

  console.log('\n--- Estado final ---')
  await reportarEstadoActual(tenant.id)
}

async function main() {
  const tenant = await resolveTenant(prisma, 'normalizar-cargos-brio.js')
  const apply = flag('apply')
  const rollbackPath = arg('rollback')

  if (rollbackPath) {
    await modoRollback(tenant, rollbackPath)
  } else if (apply) {
    await modoApply(tenant)
  } else {
    await modoPreview(tenant)
  }
}

main()
  .catch(e => { console.error('ERROR:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
