import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function verificarMediosPago() {
  const mediosPago = await prisma.medioPago.findMany({
    where: { activo: true },
    select: {
      id: true,
      codigo: true,
      nombre: true
    }
  })

  console.log('Medios de pago activos:')
  mediosPago.forEach(mp => {
    console.log(`ID: ${mp.id} | Código: ${mp.codigo} | Nombre: ${mp.nombre}`)
  })

  await prisma.$disconnect()
}

verificarMediosPago()
