/**
 * Script de migracion: Entrenadores -> Entidades
 *
 * Este script crea una Entidad tipo PERSONAL para cada Entrenador
 * que aun no tenga una vinculada.
 *
 * Ejecutar con: node scripts/migrar-entrenadores-a-entidades.js
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function generarCodigoEntidadPersonal() {
  const prefijo = 'PERS-'
  const ultima = await prisma.entidad.findFirst({
    where: { codigo: { startsWith: prefijo } },
    orderBy: { codigo: 'desc' }
  })

  let siguiente = 1
  if (ultima) {
    const numActual = parseInt(ultima.codigo.replace(prefijo, ''))
    if (!isNaN(numActual)) siguiente = numActual + 1
  }

  return `${prefijo}${String(siguiente).padStart(4, '0')}`
}

async function main() {
  console.log('='.repeat(60))
  console.log('MIGRACION: Entrenadores -> Entidades (PERSONAL)')
  console.log('='.repeat(60))

  // Buscar entrenadores sin entidad vinculada
  const entrenadoresSinEntidad = await prisma.entrenador.findMany({
    where: { entidadId: null }
  })

  console.log(`\nEntrenadores sin Entidad vinculada: ${entrenadoresSinEntidad.length}`)

  if (entrenadoresSinEntidad.length === 0) {
    console.log('No hay entrenadores para migrar. Todos ya tienen Entidad vinculada.')
    return
  }

  console.log('\nIniciando migracion...\n')

  let migrados = 0
  let errores = 0

  for (const entrenador of entrenadoresSinEntidad) {
    try {
      const codigo = await generarCodigoEntidadPersonal()
      const razonSocial = entrenador.apellido
        ? `${entrenador.apellido}, ${entrenador.nombre}`
        : entrenador.nombre

      // Crear Entidad
      const entidad = await prisma.entidad.create({
        data: {
          codigo,
          tipo: 'PERSONAL',
          razonSocial,
          tipoDocumento: 'DNI',
          documento: entrenador.documento,
          email: entrenador.email,
          telefono: entrenador.telefono,
          cargo: 'ENTRENADOR',
          fechaIngreso: entrenador.createdAt,
          activo: entrenador.activo,
        }
      })

      // Vincular al entrenador
      await prisma.entrenador.update({
        where: { id: entrenador.id },
        data: { entidadId: entidad.id }
      })

      console.log(`  [OK] ${entrenador.nombre} ${entrenador.apellido || ''} -> ${codigo}`)
      migrados++

    } catch (err) {
      console.error(`  [ERROR] ${entrenador.nombre}: ${err.message}`)
      errores++
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log(`RESULTADO: ${migrados} migrados, ${errores} errores`)
  console.log('='.repeat(60))
}

main()
  .catch((e) => {
    console.error('Error en migracion:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
