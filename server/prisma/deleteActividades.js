import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function deleteActividades() {
  console.log('🗑️  Eliminando actividades con ID > 8...')

  try {
    // Gracias al onDelete: Cascade, esto eliminará automáticamente:
    // - CategoriaActividad
    // - NoticiaDeportiva
    // - StaffTecnico
    // Y todas las demás relaciones en cascada

    const result = await prisma.actividad.deleteMany({
      where: {
        id: {
          gt: 8
        }
      }
    })

    console.log(`✅ Eliminadas ${result.count} actividades y sus relaciones`)

    // Mostrar actividades restantes
    const remaining = await prisma.actividad.findMany({
      select: {
        id: true,
        nombre: true,
        _count: {
          select: {
            categorias: true,
            noticias: true,
            staff: true
          }
        }
      },
      orderBy: { id: 'asc' }
    })

    console.log('\n📊 Actividades restantes:')
    remaining.forEach(act => {
      console.log(`  ID ${act.id}: ${act.nombre} (${act._count.categorias} categorías, ${act._count.noticias} noticias, ${act._count.staff} staff)`)
    })

  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

deleteActividades()
