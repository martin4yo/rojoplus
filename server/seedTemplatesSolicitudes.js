import { PrismaClient } from '@prisma/client'
import { seedEmailTemplatesSolicitudes } from './prisma/seeds/emailTemplatesSolicitudes.js'

const prisma = new PrismaClient()

async function main() {
  await seedEmailTemplatesSolicitudes(prisma)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
