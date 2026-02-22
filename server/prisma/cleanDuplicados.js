import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanDuplicados() {
  console.log('🧹 Limpiando actividades duplicadas...')

  // Obtener todas las actividades
  const actividades = await prisma.actividad.findMany({
    orderBy: { id: 'asc' }
  })

  // Agrupar por nombre
  const grupos = actividades.reduce((acc, act) => {
    if (!acc[act.nombre]) {
      acc[act.nombre] = []
    }
    acc[act.nombre].push(act)
    return acc
  }, {})

  // Encontrar duplicados
  let eliminadas = 0
  for (const nombre in grupos) {
    const acts = grupos[nombre]
    if (acts.length > 1) {
      console.log(`\n📍 Encontradas ${acts.length} actividades con nombre "${nombre}"`)

      // Mantener la primera (más antigua) y eliminar las demás
      const [mantener, ...eliminar] = acts
      console.log(`  ✅ Manteniendo ID: ${mantener.id}`)

      for (const act of eliminar) {
        console.log(`  ❌ Eliminando ID: ${act.id}`)

        // Primero eliminar relaciones
        await prisma.categoriaActividad.deleteMany({
          where: { actividadId: act.id }
        })

        await prisma.staffTecnico.deleteMany({
          where: { actividadId: act.id }
        })

        await prisma.noticiaDeportiva.deleteMany({
          where: { actividadId: act.id }
        })

        // Luego eliminar la actividad
        await prisma.actividad.delete({
          where: { id: act.id }
        })

        eliminadas++
      }
    }
  }

  console.log(`\n✅ Limpieza completada: ${eliminadas} actividades duplicadas eliminadas`)

  // Mostrar estado final
  const total = await prisma.actividad.count()
  console.log(`📊 Total de actividades ahora: ${total}`)
}

cleanDuplicados()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
