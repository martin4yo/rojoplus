/**
 * Valida la coherencia entre la regla de negocio del club y lo que está en Brio
 * (representado por los cargos `MIGRACION_BRIO` en la BD para el período).
 *
 * Regla:
 *   - Cuota social: la debe tener todo socio que NO sea miembro de familia,
 *     siempre que su tipoSocio tenga cuotaMensual > 0 y su categoria_socio
 *     no tenga descuento del 100%.
 *   - Cuota actividad: la debe tener cada inscripción ACTIVA no exenta cuyo
 *     monto final (tras porcentajeCuota e descuento de categoria_socio) > 0.
 *
 * Reporta 4 categorías:
 *   A. La regla dice SÍ y Brio dice SÍ → coincide (✓).
 *   B. La regla dice SÍ y Brio dice NO → faltante a generar.
 *   C. La regla dice NO y Brio dice SÍ → "sobrante" — Brio facturó algo que
 *      según la regla no correspondía (revisar).
 *   D. La regla dice NO y Brio dice NO → coincide (✓).
 *
 * Uso:
 *   DATABASE_URL="..." node server/scripts/validar-coherencia-cuotas.js --tenant sportivopilar --periodo 2026-05
 */
import { PrismaClient } from '@prisma/client'
import { arg, resolveTenant } from './_lib/cli.js'

const prisma = new PrismaClient()

function parsePeriodo(s) {
  const m = s.match(/^(\d{4})-(\d{1,2})$/)
  if (!m) throw new Error(`Periodo invalido: ${s} (formato YYYY-MM)`)
  return { anio: parseInt(m[1]), mes: parseInt(m[2]) }
}

async function main() {
  const tenant = await resolveTenant(prisma, 'validar-coherencia-cuotas.js')
  const periodoStr = arg('periodo')
  if (!periodoStr) throw new Error('Falta --periodo YYYY-MM')
  const { anio, mes } = parsePeriodo(periodoStr)

  const periodo = await prisma.periodo.findFirst({
    where: { tenantId: tenant.id, anio, mes },
  })
  if (!periodo) throw new Error(`Período ${anio}-${mes} no encontrado`)

  console.log(`\nPeríodo: ${periodo.nombre || `${mes}/${anio}`} (id=${periodo.id})\n`)

  // ── Cargos existentes en el período ──────────────────────────────────────
  const cargos = await prisma.cargo.findMany({
    where: { tenantId: tenant.id, periodoId: periodo.id, estado: { not: 'ANULADO' } },
    select: {
      id: true, socioId: true, categoria: true, categoriaActividadId: true,
      montoTotal: true, origen: true,
    },
  })
  const cuotaSocialBySocio = new Set(
    cargos.filter(c => c.categoria === 'CUOTA_SOCIAL').map(c => c.socioId)
  )
  const cuotaActividadBySocioCat = new Set(
    cargos
      .filter(c => c.categoria === 'CUOTA_ACTIVIDAD' && c.categoriaActividadId)
      .map(c => `${c.socioId}-${c.categoriaActividadId}`)
  )

  // ── Socios activos con todo lo necesario para evaluar la regla ───────────
  const socios = await prisma.socio.findMany({
    where: {
      tenantId: tenant.id,
      OR: [
        { estado: { contains: 'Activ', mode: 'insensitive' } },
        { estado: { contains: 'Vigent', mode: 'insensitive' } },
      ],
    },
    include: {
      tipoSocioRel: { include: { conceptoTesoreria: true } },
      categoriaSocioRel: true,
      inscripciones: {
        where: { estado: 'ACTIVA', exentoCuota: false },
        include: {
          categoriaActividad: {
            include: {
              actividad: { include: { conceptoTesoreria: true } },
            },
          },
        },
      },
    },
  })

  // ── Aplicar regla por socio ──────────────────────────────────────────────
  const reporteSocial = { coincide: 0, faltante: [], sobrante: [], reglaNo_brioNo: 0 }
  const reporteAct    = { coincide: 0, faltante: [], sobrante: [], reglaNo_brioNo: 0 }

  // Tracking de cargos de actividad en BD para detectar "sobrantes"
  const cargosActividadConsumidos = new Set()

  for (const s of socios) {
    const esMiembro = !!s.titularFamiliaId
    const cuotaMensual = s.tipoSocioRel?.conceptoTesoreria?.cuotaMensual
      ? Number(s.tipoSocioRel.conceptoTesoreria.cuotaMensual)
      : Number(s.tipoSocioRel?.cuotaMensual || 0)
    const desc = s.categoriaSocioRel?.porcentajeDescuento ? Number(s.categoriaSocioRel.porcentajeDescuento) : 0
    const montoSocialFinal = cuotaMensual - cuotaMensual * (desc / 100)

    // Regla cuota social: no-miembro + cuotaMensual>0 + descuento<100
    const reglaSocial = !esMiembro && cuotaMensual > 0 && montoSocialFinal > 0
    const brioSocial = cuotaSocialBySocio.has(s.id)

    if (reglaSocial && brioSocial) reporteSocial.coincide++
    else if (reglaSocial && !brioSocial) reporteSocial.faltante.push({ s, montoSocialFinal, desc })
    else if (!reglaSocial && brioSocial) reporteSocial.sobrante.push({
      s, motivo: esMiembro ? 'es miembro de familia' : (cuotaMensual === 0 ? 'tipoSocio sin cuota' : 'descuento 100%')
    })
    else reporteSocial.reglaNo_brioNo++

    // Regla cuota actividad: cada inscripción activa no exenta con monto>0 después de descuentos
    for (const insc of s.inscripciones) {
      let montoBase = insc.categoriaActividad.actividad.conceptoTesoreria?.cuotaMensual
        ? Number(insc.categoriaActividad.actividad.conceptoTesoreria.cuotaMensual)
        : (insc.categoriaActividad.cuotaMensual ? Number(insc.categoriaActividad.cuotaMensual)
        : (insc.categoriaActividad.actividad.cuotaMensual ? Number(insc.categoriaActividad.actividad.cuotaMensual) : 0))
      const pct = insc.porcentajeCuota ? Number(insc.porcentajeCuota) : 100
      if (pct !== 100) montoBase = montoBase * (pct / 100)
      const montoActFinal = montoBase - montoBase * (desc / 100)

      const clave = `${s.id}-${insc.categoriaActividadId}`
      const reglaAct = montoActFinal > 0
      const brioAct = cuotaActividadBySocioCat.has(clave)
      if (brioAct) cargosActividadConsumidos.add(clave)

      if (reglaAct && brioAct) reporteAct.coincide++
      else if (reglaAct && !brioAct) reporteAct.faltante.push({ s, insc, montoActFinal })
      else if (!reglaAct && brioAct) reporteAct.sobrante.push({
        s, insc, motivo: 'descuento 100% pero Brio facturó'
      })
      else reporteAct.reglaNo_brioNo++
    }
  }

  // Cargos de actividad en BD que NO matchean con ninguna inscripción activa actual
  // (potenciales "huérfanos": Brio facturó pero la inscripción ya no está ACTIVA o
  //  el socio no está vigente)
  const huerfanosAct = []
  for (const c of cargos.filter(c => c.categoria === 'CUOTA_ACTIVIDAD' && c.categoriaActividadId)) {
    const clave = `${c.socioId}-${c.categoriaActividadId}`
    if (!cargosActividadConsumidos.has(clave)) huerfanosAct.push(c)
  }

  // Idem cuota social: cargos de socios no en el listado de evaluación
  const sociosEvalIds = new Set(socios.map(s => s.id))
  const huerfanosSocial = cargos
    .filter(c => c.categoria === 'CUOTA_SOCIAL' && !sociosEvalIds.has(c.socioId))

  // ── Reporte ──────────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════════════════════')
  console.log('CUOTA SOCIAL')
  console.log('═══════════════════════════════════════════════════════════════════════')
  console.log(`Regla SÍ + BD SÍ (coincide ✓)    : ${reporteSocial.coincide}`)
  console.log(`Regla SÍ + BD NO (FALTANTE)      : ${reporteSocial.faltante.length}`)
  console.log(`Regla NO + BD SÍ (SOBRANTE)      : ${reporteSocial.sobrante.length}`)
  console.log(`Regla NO + BD NO (coincide ✓)    : ${reporteSocial.reglaNo_brioNo}`)
  console.log(`Cargos de socios no vigentes     : ${huerfanosSocial.length} (Brio facturó a socios que no están en evaluación)\n`)

  if (reporteSocial.faltante.length > 0) {
    console.log(`--- Faltantes (regla dice SÍ, BD no tiene) ---`)
    for (const f of reporteSocial.faltante.slice(0, 30)) {
      console.log(`  ${f.s.nroSocio} ${f.s.apellidoNombre} | tipo=${f.s.tipoSocio} catSocio=${f.s.categoriaSocioRel?.nombre ?? '-'} desc=${f.desc}% monto=${f.montoSocialFinal} alta=${f.s.fechaAlta?.toISOString()?.slice(0, 10) ?? '-'} baja=${f.s.fechaBaja?.toISOString()?.slice(0, 10) ?? '-'}`)
    }
    if (reporteSocial.faltante.length > 30) console.log(`  ...y ${reporteSocial.faltante.length - 30} más`)
    console.log()
  }

  if (reporteSocial.sobrante.length > 0) {
    console.log(`--- Sobrantes (BD facturó pero regla dice NO) ---`)
    for (const s of reporteSocial.sobrante.slice(0, 30)) {
      console.log(`  ${s.s.nroSocio} ${s.s.apellidoNombre} | motivo: ${s.motivo} | catSocio=${s.s.categoriaSocioRel?.nombre ?? '-'}`)
    }
    if (reporteSocial.sobrante.length > 30) console.log(`  ...y ${reporteSocial.sobrante.length - 30} más`)
    console.log()
  }

  if (huerfanosSocial.length > 0) {
    console.log(`--- Cargos de cuota social a socios NO vigentes ---`)
    for (const c of huerfanosSocial.slice(0, 20)) {
      const s = await prisma.socio.findUnique({ where: { id: c.socioId }, select: { nroSocio: true, apellidoNombre: true, estado: true } })
      console.log(`  cargoId=${c.id} socio=${s?.nroSocio} ${s?.apellidoNombre} estado=${s?.estado} monto=${c.montoTotal}`)
    }
    if (huerfanosSocial.length > 20) console.log(`  ...y ${huerfanosSocial.length - 20} más`)
    console.log()
  }

  console.log('═══════════════════════════════════════════════════════════════════════')
  console.log('CUOTA ACTIVIDAD')
  console.log('═══════════════════════════════════════════════════════════════════════')
  console.log(`Regla SÍ + BD SÍ (coincide ✓)    : ${reporteAct.coincide}`)
  console.log(`Regla SÍ + BD NO (FALTANTE)      : ${reporteAct.faltante.length}`)
  console.log(`Regla NO + BD SÍ (SOBRANTE)      : ${reporteAct.sobrante.length}`)
  console.log(`Regla NO + BD NO (coincide ✓)    : ${reporteAct.reglaNo_brioNo}`)
  console.log(`Cargos de actividad sin inscripción activa actual: ${huerfanosAct.length}\n`)

  if (reporteAct.faltante.length > 0) {
    console.log(`--- Faltantes (regla dice SÍ, BD no tiene) ---`)
    for (const f of reporteAct.faltante.slice(0, 30)) {
      console.log(`  ${f.s.nroSocio} ${f.s.apellidoNombre} → ${f.insc.categoriaActividad.actividad.nombre}/${f.insc.categoriaActividad.nombre} ($${f.montoActFinal}) | catSocio=${f.s.categoriaSocioRel?.nombre ?? '-'}`)
    }
    if (reporteAct.faltante.length > 30) console.log(`  ...y ${reporteAct.faltante.length - 30} más`)
    console.log()
  }

  if (reporteAct.sobrante.length > 0) {
    console.log(`--- Sobrantes (BD facturó pero regla dice NO) ---`)
    for (const s of reporteAct.sobrante.slice(0, 30)) {
      console.log(`  ${s.s.nroSocio} ${s.s.apellidoNombre} → ${s.insc.categoriaActividad.actividad.nombre}/${s.insc.categoriaActividad.nombre} | ${s.motivo}`)
    }
    if (reporteAct.sobrante.length > 30) console.log(`  ...y ${reporteAct.sobrante.length - 30} más`)
    console.log()
  }

  if (huerfanosAct.length > 0) {
    console.log(`--- Cargos de actividad sin inscripción activa actual (top 20) ---`)
    for (const c of huerfanosAct.slice(0, 20)) {
      const s = await prisma.socio.findUnique({ where: { id: c.socioId }, select: { nroSocio: true, apellidoNombre: true, estado: true } })
      const ca = await prisma.categoriaActividad.findUnique({ where: { id: c.categoriaActividadId }, include: { actividad: true } })
      console.log(`  cargoId=${c.id} socio=${s?.nroSocio} ${s?.apellidoNombre} estado=${s?.estado} → ${ca?.actividad?.nombre}/${ca?.nombre} monto=${c.montoTotal}`)
    }
    if (huerfanosAct.length > 20) console.log(`  ...y ${huerfanosAct.length - 20} más`)
  }
}

main()
  .catch(e => { console.error('ERROR:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
