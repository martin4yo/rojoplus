/**
 * Valida la regeneración de cuota social para un período puntual.
 *
 * Uso:
 *   DATABASE_URL="postgresql://..." node server/src/scripts/validarRegeneracionCuotaSocial.js \
 *     --tenant sportivopilar --periodo 2026-05 --modo preview
 *
 *   --modo preview    (antes de generar)  : lista los socios a quienes se les CREARÍA cuota social.
 *   --modo verificar  (después de generar): chequea que no haya duplicados y resume el resultado.
 *
 * El script NO escribe nada — solo lee y reporta.
 * Replica la lógica de selección de POST /api/admin/periodos/:id/generar (cuotas.js:286).
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function arg(name) {
  const idx = process.argv.indexOf(`--${name}`)
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1]
  return null
}

async function resolverContexto() {
  const slug = arg('tenant')
  const periodoStr = arg('periodo') // YYYY-MM
  const modo = arg('modo') || 'preview'

  if (!slug) throw new Error('Falta --tenant <slug>')
  if (!periodoStr || !/^\d{4}-\d{2}$/.test(periodoStr)) throw new Error('Falta --periodo YYYY-MM')
  if (!['preview', 'verificar', 'debug'].includes(modo)) throw new Error('--modo debe ser preview|verificar|debug')

  const tenant = await prisma.tenant.findUnique({ where: { slug } })
  if (!tenant) throw new Error(`Tenant no encontrado: ${slug}`)

  const [anio, mes] = periodoStr.split('-').map(Number)
  const periodo = await prisma.periodo.findFirst({
    where: { tenantId: tenant.id, anio, mes },
  })
  if (!periodo) throw new Error(`Período ${periodoStr} no encontrado para tenant ${slug}`)

  return { tenant, periodo, modo }
}

function fmt(s, n) {
  return String(s ?? '').padEnd(n).slice(0, n)
}

async function modoPreview({ tenant, periodo }) {
  console.log(`\n=== PREVIEW: regeneración cuota social ===`)
  console.log(`Tenant : ${tenant.nombre} (id=${tenant.id})`)
  console.log(`Período: ${periodo.nombre || `${periodo.mes}/${periodo.anio}`} (id=${periodo.id})`)
  console.log(`Estado : ${periodo.estado}\n`)

  // Cargos CUOTA_SOCIAL ya existentes en el período
  const existentes = await prisma.cargo.findMany({
    where: { tenantId: tenant.id, periodoId: periodo.id, categoria: 'CUOTA_SOCIAL' },
    select: { socioId: true },
  })
  const existentesSet = new Set(existentes.map(c => c.socioId))
  console.log(`CUOTA_SOCIAL ya existentes en el período: ${existentes.length}\n`)

  // Socios activos con datos para evaluar.
  // Filtra por FK (estadoSocioRel.nombre) — no por el string legacy `estado`.
  const socios = await prisma.socio.findMany({
    where: {
      tenantId: tenant.id,
      estadoSocioRel: {
        OR: [
          { nombre: { contains: 'Activ', mode: 'insensitive' } },
          { nombre: { contains: 'Vigent', mode: 'insensitive' } },
        ],
      },
    },
    include: {
      tipoSocioRel: { include: { conceptoTesoreria: true } },
      categoriaSocioRel: true,
      estadoSocioRel: { select: { nombre: true } },
    },
    orderBy: [{ apellidoNombre: 'asc' }],
  })

  const generaria = []
  const motivosNoGenera = { yaTiene: 0, noTitular: 0, sinCuotaMensual: 0, totalCero: 0 }

  for (const s of socios) {
    const esTitularOUnico = !s.titularFamiliaId
    const cuotaMensual = s.tipoSocioRel?.conceptoTesoreria?.cuotaMensual
      ? Number(s.tipoSocioRel.conceptoTesoreria.cuotaMensual)
      : Number(s.tipoSocioRel?.cuotaMensual || 0)
    const yaTiene = existentesSet.has(s.id)

    if (yaTiene) { motivosNoGenera.yaTiene++; continue }
    if (!esTitularOUnico) { motivosNoGenera.noTitular++; continue }
    if (!cuotaMensual) { motivosNoGenera.sinCuotaMensual++; continue }

    const desc = s.categoriaSocioRel?.porcentajeDescuento
      ? Number(s.categoriaSocioRel.porcentajeDescuento)
      : 0
    const montoTotal = cuotaMensual - cuotaMensual * (desc / 100)

    if (montoTotal <= 0) { motivosNoGenera.totalCero++; continue }

    generaria.push({
      id: s.id,
      nroSocio: s.nroSocio,
      apellidoNombre: s.apellidoNombre,
      tipoSocio: s.tipoSocioRel?.nombre || '',
      estado: s.estadoSocioRel?.nombre || '',
      cuotaMensual,
      descuentoPct: desc,
      montoTotal,
    })
  }

  console.log(`Socios activos evaluados: ${socios.length}`)
  console.log(`  - Ya tienen cuota social en el período : ${motivosNoGenera.yaTiene}`)
  console.log(`  - No titulares (miembros de familia)   : ${motivosNoGenera.noTitular}`)
  console.log(`  - Tipo de socio sin cuota mensual      : ${motivosNoGenera.sinCuotaMensual}`)
  console.log(`  - Monto total queda en 0 (descuento)   : ${motivosNoGenera.totalCero}`)
  console.log(`  - SE LES GENERARÍA cuota social        : ${generaria.length}\n`)

  if (generaria.length > 0) {
    console.log('--- Socios que recibirían cuota social al re-generar ---')
    console.log(`${fmt('id', 7)} ${fmt('nroSocio', 10)} ${fmt('apellidoNombre', 40)} ${fmt('tipoSocio', 18)} ${fmt('cuotaMens', 10)} ${fmt('desc%', 6)} ${fmt('total', 10)}`)
    console.log('-'.repeat(110))
    for (const g of generaria) {
      console.log(`${fmt(g.id, 7)} ${fmt(g.nroSocio, 10)} ${fmt(g.apellidoNombre, 40)} ${fmt(g.tipoSocio, 18)} ${fmt(g.cuotaMensual.toFixed(2), 10)} ${fmt(g.descuentoPct, 6)} ${fmt(g.montoTotal.toFixed(2), 10)}`)
    }
    console.log()
  }

  // Inscripciones de actividad sin cargo en el período (la generación masiva también las crea)
  const cargosAct = await prisma.cargo.findMany({
    where: { tenantId: tenant.id, periodoId: periodo.id, categoria: 'CUOTA_ACTIVIDAD' },
    select: { socioId: true, categoriaActividadId: true },
  })
  const setAct = new Set(cargosAct.map(c => `${c.socioId}-${c.categoriaActividadId}`))

  const inscripciones = await prisma.inscripcion.findMany({
    where: {
      tenantId: tenant.id,
      estado: 'ACTIVA',
      exentoCuota: false,
      socio: {
        estadoSocioRel: {
          OR: [
            { nombre: { contains: 'Activ', mode: 'insensitive' } },
            { nombre: { contains: 'Vigent', mode: 'insensitive' } },
          ],
        },
      },
    },
    select: {
      id: true,
      socioId: true,
      categoriaActividadId: true,
      porcentajeCuota: true,
      socio: {
        select: {
          nroSocio: true,
          apellidoNombre: true,
          categoriaSocioRel: { select: { porcentajeDescuento: true } },
        },
      },
      categoriaActividad: {
        select: {
          nombre: true,
          cuotaMensual: true,
          actividad: {
            select: {
              nombre: true,
              cuotaMensual: true,
              conceptoTesoreria: { select: { cuotaMensual: true } },
            },
          },
        },
      },
    },
  })

  let insSinCargo = 0
  let insTotalCero = 0
  const insGeneraria = []

  for (const i of inscripciones) {
    if (setAct.has(`${i.socioId}-${i.categoriaActividadId}`)) continue
    insSinCargo++

    let montoBase = i.categoriaActividad.actividad.conceptoTesoreria?.cuotaMensual
      ? Number(i.categoriaActividad.actividad.conceptoTesoreria.cuotaMensual)
      : (i.categoriaActividad.cuotaMensual ? Number(i.categoriaActividad.cuotaMensual)
      : (i.categoriaActividad.actividad.cuotaMensual ? Number(i.categoriaActividad.actividad.cuotaMensual) : 0))
    const pct = i.porcentajeCuota ? Number(i.porcentajeCuota) : 100
    if (pct !== 100) montoBase = montoBase * (pct / 100)
    const desc = i.socio.categoriaSocioRel?.porcentajeDescuento
      ? Number(i.socio.categoriaSocioRel.porcentajeDescuento)
      : 0
    const montoTotal = montoBase - montoBase * (desc / 100)

    if (montoTotal <= 0) { insTotalCero++; continue }
    insGeneraria.push(i)
  }

  console.log(`Inscripciones activas no exentas      : ${inscripciones.length}`)
  console.log(`  - Ya tienen cargo en el período     : ${inscripciones.length - insSinCargo}`)
  console.log(`  - Monto total queda en 0 (descuento): ${insTotalCero}`)
  console.log(`  - SE LES GENERARÍA cargo actividad  : ${insGeneraria.length}\n`)

  if (insGeneraria.length > 0 && insGeneraria.length <= 50) {
    console.log('--- Inscripciones que recibirían cargo de actividad ---')
    for (const i of insGeneraria) {
      console.log(`  socio ${i.socio.nroSocio} ${i.socio.apellidoNombre} -> ${i.categoriaActividad.actividad.nombre} / ${i.categoriaActividad.nombre}`)
    }
    console.log()
  }

  console.log('Si lo listado coincide con lo esperado, corré la generación desde la UI')
  console.log(`(Cuotas / Períodos / ${periodo.nombre || `${periodo.mes}/${periodo.anio}`} -> Generar) o llamando POST /api/admin/periodos/${periodo.id}/generar.\n`)
  console.log(`Después corré:`)
  console.log(`  node server/src/scripts/validarRegeneracionCuotaSocial.js --tenant ${tenant.slug} --periodo ${periodo.anio}-${String(periodo.mes).padStart(2, '0')} --modo verificar\n`)
}

async function modoVerificar({ tenant, periodo }) {
  console.log(`\n=== VERIFICACIÓN POST-REGENERACIÓN ===`)
  console.log(`Tenant : ${tenant.nombre} (id=${tenant.id})`)
  console.log(`Período: ${periodo.nombre || `${periodo.mes}/${periodo.anio}`} (id=${periodo.id})`)
  console.log(`Estado : ${periodo.estado}\n`)

  // 1. Conteo total de cargos en el período por categoría
  const porCategoria = await prisma.cargo.groupBy({
    by: ['categoria'],
    where: { tenantId: tenant.id, periodoId: periodo.id },
    _count: { id: true },
  })
  console.log('Cargos en el período por categoría:')
  for (const r of porCategoria) {
    console.log(`  ${fmt(r.categoria, 22)} ${r._count.id}`)
  }
  console.log()

  // 2. Detección de duplicados de CUOTA_SOCIAL por socio (estado != ANULADO)
  const dupSociales = await prisma.$queryRaw`
    SELECT "socio_id" AS "socioId", COUNT(*)::int AS cnt
    FROM "Cargo"
    WHERE "tenant_id" = ${tenant.id}
      AND "periodo_id" = ${periodo.id}
      AND categoria = 'CUOTA_SOCIAL'
      AND estado <> 'ANULADO'
    GROUP BY "socio_id"
    HAVING COUNT(*) > 1
  `

  if (dupSociales.length === 0) {
    console.log('OK: no hay duplicados de CUOTA_SOCIAL por socio en el período.')
  } else {
    console.log(`ATENCIÓN: ${dupSociales.length} socio(s) con CUOTA_SOCIAL duplicada en el período:`)
    for (const d of dupSociales) {
      const s = await prisma.socio.findUnique({
        where: { id: d.socioId },
        select: { nroSocio: true, apellidoNombre: true },
      })
      const cargos = await prisma.cargo.findMany({
        where: { tenantId: tenant.id, periodoId: periodo.id, categoria: 'CUOTA_SOCIAL', socioId: d.socioId },
        select: { id: true, montoTotal: true, estado: true, origen: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      })
      console.log(`  socio ${s?.nroSocio} ${s?.apellidoNombre} (id=${d.socioId}) -> ${d.cnt} cargos:`)
      for (const c of cargos) {
        console.log(`    cargoId=${c.id} estado=${c.estado} origen=${c.origen} monto=${c.montoTotal} creado=${c.createdAt.toISOString()}`)
      }
    }
  }
  console.log()

  // 3. Detección de duplicados de CUOTA_ACTIVIDAD por socio+categoriaActividad
  const dupActRaw = await prisma.$queryRaw`
    SELECT "socio_id" AS "socioId", "categoria_actividad_id" AS "categoriaActividadId", COUNT(*)::int AS cnt
    FROM "Cargo"
    WHERE "tenant_id" = ${tenant.id}
      AND "periodo_id" = ${periodo.id}
      AND categoria = 'CUOTA_ACTIVIDAD'
      AND estado <> 'ANULADO'
    GROUP BY "socio_id", "categoria_actividad_id"
    HAVING COUNT(*) > 1
  `

  if (dupActRaw.length === 0) {
    console.log('OK: no hay duplicados de CUOTA_ACTIVIDAD (socio+categoríaActividad) en el período.')
  } else {
    console.log(`ATENCIÓN: ${dupActRaw.length} combinaciones socio+actividad con cargos duplicados.`)
    for (const d of dupActRaw) {
      console.log(`  socioId=${d.socioId} categoriaActividadId=${d.categoriaActividadId} -> ${d.cnt} cargos`)
    }
  }
  console.log()

  // 4. Cargos creados en las últimas 2 horas (ventana usual de la regeneración)
  const desde = new Date(Date.now() - 2 * 60 * 60 * 1000)
  const recientes = await prisma.cargo.findMany({
    where: { tenantId: tenant.id, periodoId: periodo.id, createdAt: { gte: desde } },
    select: {
      id: true, categoria: true, montoTotal: true, origen: true, createdAt: true,
      socio: { select: { nroSocio: true, apellidoNombre: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  console.log(`Cargos creados en las últimas 2h en el período: ${recientes.length}`)
  if (recientes.length > 0 && recientes.length <= 100) {
    for (const c of recientes) {
      console.log(`  cargoId=${c.id} ${fmt(c.categoria, 18)} socio=${c.socio.nroSocio} ${fmt(c.socio.apellidoNombre, 35)} monto=${c.montoTotal} origen=${c.origen} creado=${c.createdAt.toISOString()}`)
    }
  }
  console.log()
}

async function modoDebug({ tenant, periodo }) {
  const socioArg = arg('socio')
  if (!socioArg) throw new Error('Falta --socio <id|nroSocio>')

  const where = /^\d+$/.test(socioArg) && socioArg.length < 7
    ? { OR: [{ id: parseInt(socioArg) }, { nroSocio: socioArg }] }
    : { nroSocio: socioArg }

  // Buscar en CUALQUIER tenant para detectar leaks cross-tenant
  const sociosCualquierTenant = await prisma.socio.findMany({
    where,
    select: {
      id: true, tenantId: true, nroSocio: true, apellidoNombre: true,
      estadoSocioRel: { select: { nombre: true } },
      tipoSocioRel: { select: { nombre: true } },
      titularFamiliaId: true,
    },
  })

  console.log(`\n=== DEBUG SOCIO ${socioArg} ===`)
  console.log(`Tenant solicitado: ${tenant.nombre} (id=${tenant.id})`)
  console.log(`Período          : ${periodo.nombre || `${periodo.mes}/${periodo.anio}`} (id=${periodo.id})\n`)

  if (sociosCualquierTenant.length === 0) {
    console.log('No se encontró el socio en NINGÚN tenant.')
    return
  }

  console.log(`Coincidencias en BD (todos los tenants): ${sociosCualquierTenant.length}`)
  for (const s of sociosCualquierTenant) {
    const t = await prisma.tenant.findUnique({ where: { id: s.tenantId }, select: { slug: true, nombre: true } })
    console.log(`  socioId=${s.id} tenantId=${s.tenantId} (${t?.slug}) nro=${s.nroSocio} ${s.apellidoNombre} estado=${s.estadoSocioRel?.nombre || ''} tipo=${s.tipoSocioRel?.nombre || ''} titFamId=${s.titularFamiliaId ?? '-'}`)
  }
  console.log()

  const socioEnTenant = sociosCualquierTenant.find(s => s.tenantId === tenant.id)
  if (!socioEnTenant) {
    console.log(`Socio NO existe en tenant ${tenant.slug}. Probable leak histórico.`)
    return
  }

  // Listar todos los cargos del socio (cualquier período, cualquier tenant) para ver alineación
  const cargos = await prisma.cargo.findMany({
    where: { socioId: socioEnTenant.id },
    select: {
      id: true, tenantId: true, periodoId: true, categoria: true, descripcion: true,
      montoTotal: true, estado: true, origen: true, createdAt: true,
      periodo: { select: { anio: true, mes: true, nombre: true, tenantId: true } },
    },
    orderBy: [{ periodoId: 'desc' }, { createdAt: 'desc' }],
    take: 60,
  })

  console.log(`Cargos del socio (top 60, cualquier período/tenant):`)
  console.log(`${fmt('cargoId', 8)} ${fmt('cTenant', 8)} ${fmt('periodoId', 10)} ${fmt('per A/M', 10)} ${fmt('pTenant', 8)} ${fmt('categoria', 20)} ${fmt('estado', 12)} ${fmt('origen', 18)} ${fmt('monto', 10)}`)
  console.log('-'.repeat(125))
  for (const c of cargos) {
    const pAM = c.periodo ? `${c.periodo.anio}-${String(c.periodo.mes).padStart(2, '0')}` : '-'
    console.log(`${fmt(c.id, 8)} ${fmt(c.tenantId, 8)} ${fmt(c.periodoId ?? '-', 10)} ${fmt(pAM, 10)} ${fmt(c.periodo?.tenantId ?? '-', 8)} ${fmt(c.categoria, 20)} ${fmt(c.estado, 12)} ${fmt(c.origen, 18)} ${fmt(Number(c.montoTotal).toFixed(2), 10)}`)
  }
  console.log()

  // Cargos exactamente en el período solicitado (ignorando tenant en la búsqueda)
  const cargosEnPeriodo = await prisma.cargo.findMany({
    where: { socioId: socioEnTenant.id, periodoId: periodo.id },
    select: {
      id: true, tenantId: true, categoria: true, estado: true, descripcion: true,
      montoTotal: true, origen: true, createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`Cargos del socio EN el período ${periodo.nombre || `${periodo.mes}/${periodo.anio}`} (id=${periodo.id}): ${cargosEnPeriodo.length}`)
  for (const c of cargosEnPeriodo) {
    console.log(`  cargoId=${c.id} tenantId=${c.tenantId} categoria=${c.categoria} estado=${c.estado} origen=${c.origen} monto=${c.montoTotal} desc="${c.descripcion}"`)
  }
  console.log()

  // Cargos de mismo (anio,mes) pero potencialmente otro periodoId (períodos duplicados)
  const periodosMismoMes = await prisma.periodo.findMany({
    where: { anio: periodo.anio, mes: periodo.mes },
    select: { id: true, tenantId: true, nombre: true, estado: true },
  })
  console.log(`Períodos en BD para ${periodo.anio}-${String(periodo.mes).padStart(2, '0')} (todos los tenants): ${periodosMismoMes.length}`)
  for (const p of periodosMismoMes) {
    console.log(`  periodoId=${p.id} tenantId=${p.tenantId} nombre="${p.nombre}" estado=${p.estado}`)
  }
  console.log()

  // El check exacto que usa el endpoint y el preview
  const matchExacto = await prisma.cargo.findMany({
    where: { tenantId: tenant.id, periodoId: periodo.id, categoria: 'CUOTA_SOCIAL', socioId: socioEnTenant.id },
    select: { id: true, estado: true, montoTotal: true, origen: true },
  })
  console.log(`Match con filtros del endpoint (tenant=${tenant.id} periodo=${periodo.id} categoria=CUOTA_SOCIAL socio=${socioEnTenant.id}): ${matchExacto.length}`)
  for (const c of matchExacto) {
    console.log(`  cargoId=${c.id} estado=${c.estado} origen=${c.origen} monto=${c.montoTotal}`)
  }
  console.log()
  console.log('Diagnóstico: si "Match con filtros del endpoint" = 0 pero el socio tiene cargos en el período con otra categoría/tenant/periodoId, ahí está la causa.')
}

async function main() {
  const ctx = await resolverContexto()
  if (ctx.modo === 'preview') {
    await modoPreview(ctx)
  } else if (ctx.modo === 'verificar') {
    await modoVerificar(ctx)
  } else {
    await modoDebug(ctx)
  }
}

main()
  .catch(e => { console.error('ERROR:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
