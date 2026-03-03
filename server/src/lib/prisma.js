import { PrismaClient } from '@prisma/client'

/**
 * Instancia centralizada de PrismaClient
 *
 * En desarrollo, usa una instancia global para evitar crear múltiples
 * conexiones durante hot reload.
 *
 * Uso:
 * import prisma from '../lib/prisma.js'
 *
 * const users = await prisma.user.findMany()
 */

// Singleton para desarrollo (evita múltiples instancias con hot reload)
const globalForPrisma = globalThis

const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error']
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
