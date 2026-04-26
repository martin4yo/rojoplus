/**
 * Migración: crea TenantUsuario para cada Admin existente que no tenga uno.
 *
 * Modo de uso:
 *   - Dry-run (solo log, no escribe): node server/scripts/asignarTenantUsuarios.js --dry-run
 *   - Aplicar: node server/scripts/asignarTenantUsuarios.js
 *
 * Configuración:
 *   - TENANT_DEFAULT_SLUG: slug del tenant al que se asignan los admins existentes (default: 'sportivopilar')
 *
 * Características:
 *   - Idempotente: si ya existe TenantUsuario(tenantId, adminId), no lo duplica
 *   - No borra datos
 *   - Log detallado
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TENANT_DEFAULT_SLUG = process.env.TENANT_DEFAULT_SLUG || 'sportivopilar'
const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
  console.log(`\n=== Asignación de TenantUsuario a admins existentes ===`)
  console.log(`Tenant destino: ${TENANT_DEFAULT_SLUG}`)
  console.log(`Modo: ${DRY_RUN ? 'DRY-RUN (no escribe)' : 'APLICAR'}\n`)

  const tenant = await prisma.tenant.findUnique({
    where: { slug: TENANT_DEFAULT_SLUG },
  })
  if (!tenant) {
    console.error(`❌ Tenant con slug '${TENANT_DEFAULT_SLUG}' no encontrado. Abortando.`)
    process.exit(1)
  }
  console.log(`✔ Tenant encontrado: ${tenant.nombre} (id=${tenant.id})\n`)

  const admins = await prisma.admin.findMany({
    select: {
      id: true,
      email: true,
      nombre: true,
      apellido: true,
      activo: true,
      rol: { select: { codigo: true, esSuperAdmin: true } },
    },
    orderBy: { id: 'asc' },
  })
  console.log(`Total de admins en la base: ${admins.length}`)

  const existentes = await prisma.tenantUsuario.findMany({
    where: { tenantId: tenant.id },
    select: { adminId: true },
  })
  const yaAsignados = new Set(existentes.map(e => e.adminId))
  console.log(`Ya tienen TenantUsuario en este tenant: ${yaAsignados.size}\n`)

  let creados = 0
  let saltados = 0
  let superAdmins = 0

  for (const admin of admins) {
    const fullName = `${admin.nombre || ''} ${admin.apellido || ''}`.trim() || '(sin nombre)'
    const rolCodigo = admin.rol?.codigo || 'ADMIN'
    const esSuper = admin.rol?.esSuperAdmin || false

    if (yaAsignados.has(admin.id)) {
      console.log(`  ⊘ Saltado (ya tiene TU): #${admin.id} ${admin.email} (${fullName})`)
      saltados++
      continue
    }

    if (esSuper) {
      console.log(`  ★ Super-admin (igual le creo TU): #${admin.id} ${admin.email} (${fullName})`)
      superAdmins++
    }

    if (DRY_RUN) {
      console.log(`  + Crearía: #${admin.id} ${admin.email} (${fullName}) → rol=${rolCodigo} activo=${admin.activo}`)
    } else {
      await prisma.tenantUsuario.create({
        data: {
          tenantId: tenant.id,
          adminId: admin.id,
          rol: rolCodigo,
          permisos: [],
          activo: admin.activo,
        },
      })
      console.log(`  ✔ Creado: #${admin.id} ${admin.email} (${fullName}) → rol=${rolCodigo} activo=${admin.activo}`)
    }
    creados++
  }

  console.log(`\n=== Resumen ===`)
  console.log(`  Total admins:           ${admins.length}`)
  console.log(`  Ya tenían TenantUsuario: ${saltados}`)
  console.log(`  ${DRY_RUN ? 'Se crearían' : 'Creados'}:              ${creados}`)
  console.log(`  Super-admins en lote:   ${superAdmins}`)
  if (DRY_RUN) {
    console.log(`\n⚠ Esto es un DRY-RUN. Para aplicar, corré sin --dry-run.`)
  } else {
    console.log(`\n✅ Migración completada.`)
  }
}

main()
  .catch(err => {
    console.error('Error en la migración:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
