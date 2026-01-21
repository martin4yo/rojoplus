import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = 'admin@sportivo.com.ar'
  const password = 'Rojocorazon1'
  const nombre = 'Administrador'

  // Verificar si ya existe
  const existente = await prisma.admin.findUnique({
    where: { email }
  })

  if (existente) {
    console.log(`El usuario ${email} ya existe (ID: ${existente.id})`)

    // Actualizar password si se desea
    const passwordHash = await bcrypt.hash(password, 10)
    await prisma.admin.update({
      where: { id: existente.id },
      data: { passwordHash, activo: true }
    })
    console.log('Password actualizado correctamente')
    return
  }

  // Crear nuevo admin
  const passwordHash = await bcrypt.hash(password, 10)

  const admin = await prisma.admin.create({
    data: {
      email,
      passwordHash,
      nombre,
      activo: true
    }
  })

  console.log(`Admin creado exitosamente:`)
  console.log(`  ID: ${admin.id}`)
  console.log(`  Email: ${admin.email}`)
  console.log(`  Nombre: ${admin.nombre}`)
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
