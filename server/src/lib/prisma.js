import { PrismaClient } from '@prisma/client'

/**
 * Instancia centralizada de PrismaClient
 *
 * IMPORTANTE: Todos los archivos deben importar desde aquí:
 * import prisma from '../lib/prisma.js'
 *
 * NO crear nuevas instancias con `new PrismaClient()`
 */

// Singleton global (evita múltiples instancias)
const globalForPrisma = globalThis

const prisma = globalForPrisma.prisma || new PrismaClient({
  log: ['error'],
  // Configuración de connection pool
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
})

// Guardar en global para evitar múltiples instancias en hot reload y producción
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma
}

export default prisma
