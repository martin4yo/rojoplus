import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const prisma = new PrismaClient()

async function runMigration() {
  try {
    console.log('🔧 Ejecutando migración: fix_entrada_movimiento_caja_unique.sql')

    // Leer el archivo SQL
    const sqlFile = path.join(__dirname, 'prisma', 'migrations', 'fix_entrada_movimiento_caja_unique.sql')
    const sql = fs.readFileSync(sqlFile, 'utf-8')

    // Dividir por líneas y ejecutar
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'))

    for (const statement of statements) {
      if (statement) {
        console.log(`Ejecutando: ${statement.substring(0, 50)}...`)
        await prisma.$executeRawUnsafe(statement)
      }
    }

    console.log('✅ Migración ejecutada exitosamente')
  } catch (error) {
    console.error('❌ Error ejecutando migración:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

runMigration()
