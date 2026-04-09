/**
 * Script: Seedear categorias_cargo para todos los tenants existentes
 * Uso: DATABASE_URL="postgresql://..." node server/src/scripts/seedCategoriasCargo.js
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CATEGORIAS = [
  { codigo: 'CUOTA_SOCIAL',     nombre: 'Cuota Social',     color: '#10B981', orden: 1 },
  { codigo: 'CUOTA_ACTIVIDAD',  nombre: 'Cuota Actividad',  color: '#3B82F6', orden: 2 },
  { codigo: 'INSCRIPCION',      nombre: 'Inscripción',       color: '#8B5CF6', orden: 3 },
  { codigo: 'FINANCIACION',     nombre: 'Financiación',      color: '#F59E0B', orden: 4 },
  { codigo: 'CARNET',           nombre: 'Carnet',            color: '#6366F1', orden: 5 },
  { codigo: 'MOROSIDAD',        nombre: 'Morosidad',         color: '#EF4444', orden: 6 },
  { codigo: 'NOTA_CREDITO',     nombre: 'Nota de Crédito',   color: '#6B7280', orden: 7 },
  { codigo: 'OTRO',             nombre: 'Otro',              color: '#9CA3AF', orden: 8 },
]

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, nombre: true } })
  console.log(`Encontrados ${tenants.length} tenant(s)`)

  for (const tenant of tenants) {
    console.log(`\nTenant: ${tenant.nombre} (id=${tenant.id})`)
    for (const cat of CATEGORIAS) {
      await prisma.categoriaCargo.upsert({
        where: { tenantId_codigo: { tenantId: tenant.id, codigo: cat.codigo } },
        update: { nombre: cat.nombre, color: cat.color, orden: cat.orden },
        create: { ...cat, tenantId: tenant.id },
      })
      console.log(`  upsert: ${cat.codigo}`)
    }
  }

  console.log('\nDone.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
