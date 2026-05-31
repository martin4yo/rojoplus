/**
 * DRY-RUN de generación de cuotas — período 06/2026, tenant "sportivopilar".
 * NO persiste nada: usa calcularCuotas() (modo preview) e imprime un resumen.
 *
 *   node dryRunCuotas062026.js
 */
import prisma from './src/lib/prisma.js'
import { createTenantPrisma } from './src/lib/tenantPrisma.js'
import { calcularCuotas } from './src/services/generarCuotasService.js'

const SUBDOMAIN = 'sportivopilar'
const ANIO = 2026
const MES = 6

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(n) || 0)

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { OR: [{ subdomain: SUBDOMAIN }, { slug: SUBDOMAIN }] },
  })
  if (!tenant) throw new Error(`Tenant "${SUBDOMAIN}" no encontrado`)
  console.log(`\nTenant: ${tenant.nombre} (id=${tenant.id}, subdomain=${tenant.subdomain})`)

  const db = createTenantPrisma(tenant.id)

  const periodo = await db.periodo.findFirst({ where: { anio: ANIO, mes: MES } })
  if (!periodo) throw new Error(`No existe el período ${MES}/${ANIO} para este tenant`)
  console.log(`Período: ${periodo.nombre} (id=${periodo.id}, estado=${periodo.estado}, vence=${periodo.fechaVencimiento?.toISOString?.().slice(0,10)})`)

  const { cargos, totales, advertencias } = await calcularCuotas(db, periodo.id, {})

  const nuevos = cargos.filter(c => !c.yaGenerado)
  const social = nuevos.filter(c => c.categoria === 'CUOTA_SOCIAL')
  const actividad = nuevos.filter(c => c.categoria === 'CUOTA_ACTIVIDAD')

  console.log('\n================== RESUMEN DRY-RUN ==================')
  console.log(`Cuotas A GENERAR (nuevas):     ${totales.cargosCount}`)
  console.log(`  - Cuota Social:              ${totales.porCategoria.CUOTA_SOCIAL}`)
  console.log(`  - Cuota Actividad:           ${totales.porCategoria.CUOTA_ACTIVIDAD}`)
  console.log(`Socios alcanzados:             ${totales.sociosCount}`)
  console.log(`Ya generadas (se omiten):      ${totales.yaGeneradosCount}`)
  console.log('----------------------------------------------------')
  console.log(`Monto original:                ${fmt(totales.montoOriginal)}`)
  console.log(`Bonificaciones:               -${fmt(totales.montoBonificacion)}`)
  console.log(`MONTO TOTAL A GENERAR:         ${fmt(totales.montoTotal)}`)

  // --- Cuota Social ---
  console.log('\n--- CUOTA SOCIAL (importe por tipo de socio) ---')
  const porTipo = new Map()
  for (const c of social) {
    const k = c.tipoSocioNombre || '(sin tipo)'
    if (!porTipo.has(k)) porTipo.set(k, { count: 0, totalBase: 0, totalNeto: 0 })
    const x = porTipo.get(k); x.count++; x.totalBase += c.montoOriginal; x.totalNeto += c.montoTotal
  }
  for (const [tipo, x] of [...porTipo].sort((a,b) => b[1].count - a[1].count)) {
    const unit = x.count ? x.totalBase / x.count : 0
    console.log(`  ${tipo.padEnd(22)} x${String(x.count).padStart(4)}  c/u≈${fmt(unit).padStart(12)}  neto=${fmt(x.totalNeto)}`)
  }
  const socialBase = social.reduce((s,c)=>s+c.montoOriginal,0)
  const socialNeto = social.reduce((s,c)=>s+c.montoTotal,0)
  console.log(`  TOTAL CUOTA SOCIAL:   base=${fmt(socialBase)}  neto=${fmt(socialNeto)}`)

  // --- Cuota Actividad ---
  console.log('\n--- CUOTA ACTIVIDAD (importe por actividad/categoría) ---')
  const porAct = new Map()
  for (const c of actividad) {
    const k = c.conceptoLabel || c.actividadNombre || '(sin actividad)'
    if (!porAct.has(k)) porAct.set(k, { count: 0, totalBase: 0, totalNeto: 0 })
    const x = porAct.get(k); x.count++; x.totalBase += c.montoOriginal; x.totalNeto += c.montoTotal
  }
  for (const [act, x] of [...porAct].sort((a,b) => b[1].count - a[1].count)) {
    const unit = x.count ? x.totalBase / x.count : 0
    console.log(`  ${act.slice(0,34).padEnd(34)} x${String(x.count).padStart(4)}  c/u≈${fmt(unit).padStart(12)}  neto=${fmt(x.totalNeto)}`)
  }
  const actBase = actividad.reduce((s,c)=>s+c.montoOriginal,0)
  const actNeto = actividad.reduce((s,c)=>s+c.montoTotal,0)
  console.log(`  TOTAL CUOTA ACTIVIDAD: base=${fmt(actBase)}  neto=${fmt(actNeto)}`)

  console.log('\n--- ADVERTENCIAS ---')
  console.log(`  Socios omitidos (ya tenían cuota social):     ${advertencias.sociosSaltadosYaConCuota}`)
  console.log(`  Inscripciones omitidas (ya tenían cargo):     ${advertencias.inscripcionesSaltadasYaConCargo}`)
  console.log(`  Socios no titulares (sin cuota social propia): ${advertencias.sociosNoTitulares}`)
  console.log(`  Socios sin cuota mensual configurada:         ${advertencias.sociosSinCuotaMensual}`)
  console.log('====================================================\n')
  console.log('NOTA: dry-run, no se persistió ningún cargo.\n')
}

main()
  .catch(e => { console.error('ERROR:', e.message); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
