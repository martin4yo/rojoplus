/**
 * Migración: vincular cada Entrenador con una Entidad (tipo PERSONAL, cargo
 * con esEntrenador=true).
 *
 * Para cada Entrenador sin entidadId:
 *   1. Busca/crea CargoPersonal con esEntrenador=true (default 'ENTRENADOR')
 *   2. Busca Entidad existente por documento o por email + tipo PERSONAL
 *   3. Si no existe, crea Entidad con los datos del Entrenador
 *   4. Setea Entrenador.entidadId
 *
 * Idempotente: re-ejecutar es seguro.
 *
 * Uso:
 *   node server/scripts/migrar-entrenadores-a-entidad.js --tenant sportivopilar --dry-run
 *   node server/scripts/migrar-entrenadores-a-entidad.js --tenant sportivopilar --apply
 */

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : null
}
function flag(name) { return process.argv.includes(`--${name}`) }

const TENANT_SLUG = arg('tenant')
const APPLY = flag('apply')

async function main() {
  if (!TENANT_SLUG) throw new Error('Falta --tenant <slug>')
  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } })
  if (!tenant) throw new Error(`Tenant '${TENANT_SLUG}' no existe`)
  const tenantId = tenant.id

  console.log(`Tenant: ${TENANT_SLUG} (id=${tenantId})`)
  console.log(`Modo  : ${APPLY ? '🔴 APPLY (modifica BD)' : '🟡 DRY-RUN'}\n`)

  // 1) Asegurar que exista al menos un CargoPersonal con esEntrenador=true
  let cargoEntrenador = await prisma.cargoPersonal.findFirst({
    where: { tenantId, esEntrenador: true, activo: true },
  })
  if (!cargoEntrenador) {
    // Buscar uno por código 'ENTRENADOR' y marcarlo
    cargoEntrenador = await prisma.cargoPersonal.findFirst({
      where: { tenantId, codigo: 'ENTRENADOR' },
    })
    if (cargoEntrenador && APPLY) {
      cargoEntrenador = await prisma.cargoPersonal.update({
        where: { id: cargoEntrenador.id },
        data: { esEntrenador: true },
      })
      console.log(`  ✓ CargoPersonal 'ENTRENADOR' marcado como esEntrenador=true`)
    } else if (!cargoEntrenador) {
      if (APPLY) {
        cargoEntrenador = await prisma.cargoPersonal.create({
          data: {
            tenantId, codigo: 'ENTRENADOR', nombre: 'Entrenador',
            esEntrenador: true, activo: true, orden: 1,
          },
        })
        console.log(`  ✓ CargoPersonal 'ENTRENADOR' creado con esEntrenador=true`)
      } else {
        console.log(`  ⚠️ No hay CargoPersonal con esEntrenador=true. Se crearía 'ENTRENADOR' al aplicar.`)
      }
    }
  } else {
    console.log(`  ✓ Ya existe CargoPersonal con esEntrenador=true: ${cargoEntrenador.codigo}`)
  }

  // 2) Procesar entrenadores sin entidadId
  const entrenadores = await prisma.entrenador.findMany({
    where: { tenantId, entidadId: null },
  })

  console.log(`\nEntrenadores sin entidadId: ${entrenadores.length}`)

  let creados = 0, vinculados = 0, errores = 0

  for (const e of entrenadores) {
    const fullName = e.apellido ? `${e.nombre} ${e.apellido}` : e.nombre

    // Buscar Entidad existente por documento o email
    let entidad = null
    if (e.documento) {
      entidad = await prisma.entidad.findFirst({
        where: { tenantId, tipo: 'PERSONAL', documento: e.documento },
      })
    }
    if (!entidad && e.email) {
      entidad = await prisma.entidad.findFirst({
        where: { tenantId, tipo: 'PERSONAL', email: e.email },
      })
    }

    if (entidad) {
      console.log(`  [${e.id}] ${fullName} → Entidad existente #${entidad.id} (${entidad.razonSocial})`)
      if (APPLY) {
        await prisma.entrenador.update({
          where: { id: e.id },
          data: { entidadId: entidad.id },
        })
        // Si la Entidad no tiene cargo asignado, asignar el cargo Entrenador
        if (!entidad.cargoPersonalId && cargoEntrenador) {
          await prisma.entidad.update({
            where: { id: entidad.id },
            data: { cargoPersonalId: cargoEntrenador.id },
          })
        }
      }
      vinculados++
      continue
    }

    // Crear nueva Entidad
    if (APPLY) {
      try {
        // Generar código único
        let codigo = `ENT-${e.id}`
        let intento = 0
        while (await prisma.entidad.findFirst({ where: { tenantId, codigo } })) {
          intento++
          codigo = `ENT-${e.id}-${intento}`
        }
        const nuevaEntidad = await prisma.entidad.create({
          data: {
            tenantId,
            codigo,
            tipo: 'PERSONAL',
            razonSocial: fullName,
            tipoDocumento: 'DNI',
            documento: e.documento || null,
            email: e.email || null,
            telefono: e.telefono || null,
            cargoPersonalId: cargoEntrenador?.id || null,
            activo: e.activo !== false,
            observaciones: e.observaciones || null,
            foto: e.fotoStaff || null,
          },
        })
        await prisma.entrenador.update({
          where: { id: e.id },
          data: { entidadId: nuevaEntidad.id },
        })
        console.log(`  [${e.id}] ${fullName} → Entidad creada #${nuevaEntidad.id} (codigo=${codigo})`)
        creados++
      } catch (err) {
        console.error(`  [${e.id}] ERROR: ${err.message}`)
        errores++
      }
    } else {
      console.log(`  [${e.id}] ${fullName} → SE CREARÍA Entidad nueva`)
      creados++
    }
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`RESUMEN`)
  console.log('═'.repeat(60))
  console.log(`  Entrenadores procesados:    ${entrenadores.length}`)
  console.log(`  Vinculados a Entidad existente: ${vinculados}`)
  console.log(`  Entidades creadas nuevas:   ${creados}`)
  console.log(`  Errores:                    ${errores}`)
  if (!APPLY) console.log(`\n🟡 DRY-RUN — no se modificó la BD. Re-correr con --apply.\n`)
  else console.log(`\n✅ Migración completa.\n`)
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
