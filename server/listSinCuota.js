/**
 * Lista los socios activos SIN cuota mensual configurada (cuotaSocialMonto = 0).
 * Replica la lógica de generarCuotasService.calcularCuotas.
 *   node listSinCuota.js
 */
import prisma from './src/lib/prisma.js'
import { createTenantPrisma } from './src/lib/tenantPrisma.js'

const SUBDOMAIN = 'sportivopilar'

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { OR: [{ subdomain: SUBDOMAIN }, { slug: SUBDOMAIN }] },
  })
  const db = createTenantPrisma(tenant.id)

  const socios = await db.socio.findMany({
    where: { estadoSocioRel: { esSocioActivo: true } },
    include: {
      tipoSocioRel: { include: { conceptoTesoreria: true } },
    },
  })

  const sinCuota = socios.filter(s => {
    const monto = s.tipoSocioRel?.conceptoTesoreria?.cuotaMensual
      ? Number(s.tipoSocioRel.conceptoTesoreria.cuotaMensual)
      : Number(s.tipoSocioRel?.cuotaMensual || 0)
    return !monto
  })

  console.log(`\nSocios activos SIN cuota mensual configurada: ${sinCuota.length}\n`)

  // Agrupar por tipo de socio para ver el patrón
  const porTipo = new Map()
  for (const s of sinCuota) {
    const k = s.tipoSocioRel?.nombre || '(SIN TIPO DE SOCIO)'
    if (!porTipo.has(k)) porTipo.set(k, [])
    porTipo.get(k).push(s)
  }

  console.log('=== POR TIPO DE SOCIO ===')
  for (const [tipo, arr] of [...porTipo].sort((a,b) => b[1].length - a[1].length)) {
    console.log(`  ${tipo.padEnd(28)} ${arr.length}`)
  }

  console.log('\n=== LISTADO COMPLETO ===')
  console.log('Nro'.padEnd(8) + 'Socio'.padEnd(36) + 'Tipo'.padEnd(26) + 'Titular?')
  for (const s of sinCuota.sort((a,b) => (a.nroSocio||0) - (b.nroSocio||0))) {
    const nombre = `${s.apellido}, ${s.nombre}`.trim().slice(0, 34)
    const tipo = (s.tipoSocioRel?.nombre || '(sin tipo)').slice(0, 24)
    const esTitular = !s.titularFamiliaId ? 'titular/único' : 'familiar'
    console.log(String(s.nroSocio ?? '-').padEnd(8) + nombre.padEnd(36) + tipo.padEnd(26) + esTitular)
  }
  console.log('')
}

main()
  .catch(e => { console.error('ERROR:', e.message); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
