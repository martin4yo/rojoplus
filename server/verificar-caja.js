import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function verificarCajas() {
  const cajas = await prisma.caja.findMany({
    select: {
      id: true,
      nombre: true,
      mediosPagoPermitidos: true
    }
  })

  console.log('Cajas configuradas:')
  cajas.forEach(caja => {
    console.log(`\nID: ${caja.id}`)
    console.log(`Nombre: ${caja.nombre}`)
    console.log(`Medios de pago permitidos: ${caja.mediosPagoPermitidos ? caja.mediosPagoPermitidos.join(', ') : 'NINGUNO'}`)
  })

  await prisma.$disconnect()
}

verificarCajas()
