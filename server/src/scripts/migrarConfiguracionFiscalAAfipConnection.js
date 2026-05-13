/**
 * Migra los datos de ConfiguracionFiscal a AfipConnection.
 * Por cada tenant con ConfiguracionFiscal activa:
 *   - Crea una AfipConnection "default" con cuit, cert, key, ambiente
 *   - Crea un PuntoVenta default leyendo Caja.puntoVentaAfip o FISCAL_PUNTO_VENTA
 *
 * Idempotente: si ya existe AfipConnection para el tenant, no crea otra.
 *
 * Uso: DATABASE_URL="postgresql://..." node server/src/scripts/migrarConfiguracionFiscalAAfipConnection.js
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, nombre: true } })
  console.log(`Encontrados ${tenants.length} tenant(s)`)

  for (const tenant of tenants) {
    console.log(`\nTenant: ${tenant.nombre} (id=${tenant.id})`)

    const config = await prisma.configuracionFiscal.findFirst({
      where: { tenantId: tenant.id, activo: true }
    })

    if (!config) {
      console.log('  Sin ConfiguracionFiscal, skip')
      continue
    }

    // ¿Ya hay AfipConnection?
    const yaExiste = await prisma.afipConnection.findFirst({
      where: { tenantId: tenant.id }
    })

    let conn
    if (yaExiste) {
      console.log(`  AfipConnection ya existe (id=${yaExiste.id})`)
      conn = yaExiste
    } else {
      conn = await prisma.afipConnection.create({
        data: {
          tenantId: tenant.id,
          nombre: `${config.razonSocial} (default)`,
          descripcion: 'Migrado automáticamente desde ConfiguracionFiscal',
          cuit: config.cuit,
          environment: config.modoProduccion ? 'PRODUCTION' : 'TESTING',
          certificadoPath: config.certificadoPath,
          clavePrivadaPath: config.clavePrivadaPath,
          esDefault: true,
          activo: true,
        }
      })
      console.log(`  ✓ AfipConnection creada (id=${conn.id})`)
    }

    // ¿Ya hay PuntoVenta?
    const yaPV = await prisma.puntoVenta.findFirst({ where: { tenantId: tenant.id } })
    if (yaPV) {
      console.log(`  PuntoVenta ya existe (id=${yaPV.id}, numero=${yaPV.numero})`)
      continue
    }

    // Resolver número de PV: 1) FISCAL_PUNTO_VENTA, 2) caja con puntoVentaAfip, 3) 1
    let numero = 1
    const cfgPV = await prisma.configuracion.findFirst({
      where: { tenantId: tenant.id, clave: 'FISCAL_PUNTO_VENTA' }
    })
    if (cfgPV?.valor) {
      const n = parseInt(cfgPV.valor)
      if (!isNaN(n) && n > 0) numero = n
    } else {
      const caja = await prisma.caja.findFirst({
        where: { tenantId: tenant.id, activo: true, puntoVentaAfip: { not: null } },
        orderBy: { id: 'asc' }
      })
      if (caja?.puntoVentaAfip) numero = caja.puntoVentaAfip
    }

    const pv = await prisma.puntoVenta.create({
      data: {
        tenantId: tenant.id,
        numero,
        nombre: `PV ${numero}`,
        descripcion: 'Migrado automáticamente',
        afipConnectionId: conn.id,
        esDefault: true,
        activo: true,
      }
    })
    console.log(`  ✓ PuntoVenta creado (id=${pv.id}, numero=${numero})`)
  }

  console.log('\nDone.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
