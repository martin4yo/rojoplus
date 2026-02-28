import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('=== VERIFICACIÓN CAJAS POR ROL ===\n')

  // 1. Listar todas las cajas
  const cajas = await prisma.caja.findMany({
    where: { activo: true, tipo: 'EFECTIVO' },
    orderBy: { nombre: 'asc' }
  })

  console.log('Cajas de efectivo activas:')
  cajas.forEach(c => {
    console.log(`  ${c.id}: ${c.nombre}`)
  })

  // 2. Listar asignaciones CajaRol
  const cajasRoles = await prisma.cajaRol.findMany({
    include: {
      caja: { select: { id: true, nombre: true } },
      rol: { select: { id: true, nombre: true, codigo: true } }
    }
  })

  console.log(`\nAsignaciones Caja-Rol (${cajasRoles.length} total):`)
  if (cajasRoles.length === 0) {
    console.log('  ⚠️  No hay asignaciones de cajas a roles')
    console.log('  Esto significa que todos los usuarios ven todas las cajas')
  } else {
    cajasRoles.forEach(cr => {
      console.log(`  Caja "${cr.caja.nombre}" → Rol "${cr.rol.nombre}"`)
    })
  }

  // 3. Verificar rol buffet específicamente
  const rolBuffet = await prisma.rol.findFirst({
    where: { codigo: 'buffet' }
  })

  if (rolBuffet) {
    const cajasBuffet = await prisma.cajaRol.findMany({
      where: { rolId: rolBuffet.id },
      include: { caja: true }
    })

    console.log(`\nCajas asignadas al rol Buffet (ID: ${rolBuffet.id}):`)
    if (cajasBuffet.length === 0) {
      console.log('  ⚠️  Ninguna - el usuario verá TODAS las cajas')
    } else {
      cajasBuffet.forEach(cb => {
        console.log(`  - ${cb.caja.nombre}`)
      })
    }
  }

  await prisma.$disconnect()
}

main().catch(e => {
  console.error('Error:', e)
  process.exit(1)
})
