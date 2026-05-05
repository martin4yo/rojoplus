/**
 * Carga la Comisión Directiva del tenant. Reemplaza las autoridades existentes
 * en las secciones COMISION_DIRECTIVA, VOCALES y REVISORES (no toca SUBCOMISIONES).
 *
 * Datos por ahora hardcodeados para sportivopilar (período 2024-2026).
 *
 * Uso:
 *   node scripts/cargar-comision-directiva.js --tenant sportivopilar [--apply]
 *
 * Sin --apply es dry-run.
 */

import { PrismaClient } from '@prisma/client'
import { flag, resolveTenant } from './_lib/cli.js'

const prisma = new PrismaClient()

const PERIODO_DEFAULT = 'Período 2024 - 2026'

// Datos del tenant sportivopilar (imagen recibida 2026-05-05)
const MIEMBROS = [
  // Comisión Directiva (orden = orden jerárquico)
  { seccion: 'COMISION_DIRECTIVA', cargo: 'Presidente',     nroSocio: '16725', nombre: 'MARCOS DIEGO JAVIER',      orden: 1 },
  { seccion: 'COMISION_DIRECTIVA', cargo: 'Vicepresidente', nroSocio: '15206', nombre: 'PASSALACQUA LEONARDO G',   orden: 2 },
  { seccion: 'COMISION_DIRECTIVA', cargo: 'Tesorero',       nroSocio: '16575', nombre: 'TORALES GUILLERMO LUIS',   orden: 3 },
  { seccion: 'COMISION_DIRECTIVA', cargo: 'Pro Tesorero',   nroSocio: '8547',  nombre: 'SORGENTE FERNANDO HERNAN', orden: 4 },
  { seccion: 'COMISION_DIRECTIVA', cargo: 'Secretario',     nroSocio: '9087',  nombre: 'LORGE DIEGO HERNAN',       orden: 5 },
  { seccion: 'COMISION_DIRECTIVA', cargo: 'Pro Secretario', nroSocio: '19133', nombre: 'CASTRO JOAQUIN EDUARDO',   orden: 6 },

  // Vocales titulares
  { seccion: 'VOCALES', cargo: 'Vocal 1', tipo: 'TITULAR',  nroSocio: '11213', nombre: 'DIAZ ALEJANDRO',           orden: 1 },
  { seccion: 'VOCALES', cargo: 'Vocal 2', tipo: 'TITULAR',  nroSocio: '17736', nombre: 'SOSA SERGIO OSCAR',        orden: 2 },
  { seccion: 'VOCALES', cargo: 'Vocal 3', tipo: 'TITULAR',  nroSocio: '19068', nombre: 'FOURGEAUX LUIS MARTIN',    orden: 3 },
  { seccion: 'VOCALES', cargo: 'Vocal 4', tipo: 'TITULAR',  nroSocio: '17833', nombre: 'GONZALEZ SEBASTIAN ARIEL', orden: 4 },

  // Vocales suplentes
  { seccion: 'VOCALES', cargo: 'Vocal Suplente 1', tipo: 'SUPLENTE', nroSocio: '4905',  nombre: 'GONZALEZ GERMAN OSVALDO', orden: 5 },
  { seccion: 'VOCALES', cargo: 'Vocal Suplente 2', tipo: 'SUPLENTE', nroSocio: '15732', nombre: 'MATEU FERNANDO DAVID',    orden: 6 },
  { seccion: 'VOCALES', cargo: 'Vocal Suplente 3', tipo: 'SUPLENTE', nroSocio: '19651', nombre: 'CARUSO MARTIN',           orden: 7 },
  { seccion: 'VOCALES', cargo: 'Vocal Suplente 4', tipo: 'SUPLENTE', nroSocio: '16724', nombre: 'MIGLIARDI CECILIA MABEL', orden: 8 },

  // Revisores titulares
  { seccion: 'REVISORES', cargo: 'Revisor de Cuentas 1', tipo: 'TITULAR', nroSocio: '16947', nombre: 'NAVARRO CLAUDIA DANIELA',        orden: 1 },
  { seccion: 'REVISORES', cargo: 'Revisor de Cuentas 2', tipo: 'TITULAR', nroSocio: '20152', nombre: 'BARROSO SALVADOR ORIANA BELEN', orden: 2 },

  // Revisores suplentes
  { seccion: 'REVISORES', cargo: 'Revisor de Cuentas Suplente 1', tipo: 'SUPLENTE', nroSocio: '16357', nombre: 'MILENS GONZALO DAMIAN', orden: 3 },
  { seccion: 'REVISORES', cargo: 'Revisor de Cuentas Suplente 2', tipo: 'SUPLENTE', nroSocio: '19905', nombre: 'CASTELO ESTEBAN',      orden: 4 },
  { seccion: 'REVISORES', cargo: 'Revisor de Cuentas Suplente 3', tipo: 'SUPLENTE', nroSocio: '16359', nombre: 'BRUN TOBIAS',          orden: 5 },
]

async function main() {
  const tenant = await resolveTenant(prisma, 'cargar-comision-directiva.js')
  const tenantId = tenant.id
  const apply = flag('apply')

  console.log(`\nMiembros a cargar: ${MIEMBROS.length}`)
  console.log(`Secciones: COMISION_DIRECTIVA (6), VOCALES (8), REVISORES (5)\n`)

  // Existentes en esas 3 secciones
  const existentes = await prisma.autoridad.findMany({
    where: {
      tenantId,
      seccion: { in: ['COMISION_DIRECTIVA', 'VOCALES', 'REVISORES'] },
    },
    select: { id: true, seccion: true, cargo: true, nombre: true },
  })
  console.log(`Autoridades existentes en esas secciones: ${existentes.length}`)
  for (const a of existentes) {
    console.log(`  - [${a.seccion}] ${a.cargo || '(sin cargo)'} : ${a.nombre} (id=${a.id})`)
  }

  if (!apply) {
    console.log(`\n[DRY-RUN] No se aplican cambios. Pasá --apply para ejecutar.`)
    console.log(`\nMiembros nuevos a insertar:`)
    for (const m of MIEMBROS) {
      console.log(`  + [${m.seccion}] ${m.cargo} : ${m.nombre} · #${m.nroSocio}`)
    }
    return
  }

  // Borrar existentes en las 3 secciones (no toca SUBCOMISIONES)
  if (existentes.length > 0) {
    const del = await prisma.autoridad.deleteMany({
      where: {
        tenantId,
        seccion: { in: ['COMISION_DIRECTIVA', 'VOCALES', 'REVISORES'] },
      },
    })
    console.log(`\nBorrados ${del.count} registros previos.`)
  }

  // Insertar
  let creados = 0
  for (const m of MIEMBROS) {
    await prisma.autoridad.create({
      data: {
        tenantId,
        seccion: m.seccion,
        cargo: m.cargo,
        nombre: m.nombre,
        nroSocio: m.nroSocio,
        tipo: m.tipo || null,
        desde: '2024',
        orden: m.orden,
        activo: true,
      },
    })
    creados++
  }
  console.log(`Creados ${creados} miembros.`)

  // Asegurar período en configuracion
  await prisma.configuracion.upsert({
    where: { tenantId_clave: { tenantId, clave: 'PERIODO_COMISION_DIRECTIVA' } },
    update: { valor: PERIODO_DEFAULT },
    create: {
      tenantId,
      clave: 'PERIODO_COMISION_DIRECTIVA',
      valor: PERIODO_DEFAULT,
      descripcion: 'Período de la Comisión Directiva',
    },
  })
  console.log(`Período seteado: "${PERIODO_DEFAULT}"`)

  console.log(`\nListo.`)
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
