/**
 * asignarCentroCostoBuffet.js
 *
 * Asigna el Centro de Costo "BUFFET" a todos los registros historicos
 * vinculados a las cajas del buffet de un tenant:
 *   - movimientos_caja
 *   - movimientos_contables
 *   - comandas
 *   - pedidos_takeaway
 *   - asiento_lineas (de asientos VENTA_BUFFET/KIOSCO/TAKEAWAY + FACTURA_VENTA/RECIBO_COBRO de cajas buffet)
 *   - asientos (centro_costo_id si existe la columna)
 *
 * Uso (dry-run por defecto):
 *   DATABASE_URL="postgresql://..." node server/src/scripts/asignarCentroCostoBuffet.js <tenantSlug>
 *
 * Para ejecutar:
 *   DATABASE_URL="postgresql://..." node server/src/scripts/asignarCentroCostoBuffet.js <tenantSlug> --execute
 *
 * Criterio:
 *   - cajas buffet: las que tienen centro_costo_id = Buffet (luego de haberlo configurado).
 *   - Si necesitas otro criterio, pasá IDs manualmente con --cajas 3,4,5.
 */

import pg from 'pg'
const { Client } = pg

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:Q27G4B98@localhost:5434/clubix_db'
const TENANT_SLUG = process.argv[2]
const EXECUTE = process.argv.includes('--execute')
const CAJAS_ARG = (() => {
  const i = process.argv.indexOf('--cajas')
  if (i === -1) return null
  return process.argv[i + 1].split(',').map(x => parseInt(x)).filter(Boolean)
})()

if (!TENANT_SLUG) {
  console.error('Uso: node asignarCentroCostoBuffet.js <tenantSlug> [--execute] [--cajas 1,2,3]')
  process.exit(1)
}

const client = new Client({ connectionString: DATABASE_URL })

async function run() {
  await client.connect()
  console.log(`\n=== Asignacion CC Buffet - tenant "${TENANT_SLUG}" - modo: ${EXECUTE ? 'EJECUTAR' : 'DRY-RUN'} ===\n`)

  const { rows: [tenant] } = await client.query(
    'SELECT id, slug, nombre FROM tenants WHERE slug = $1',
    [TENANT_SLUG]
  )
  if (!tenant) {
    console.error(`Tenant "${TENANT_SLUG}" no encontrado.`)
    process.exit(1)
  }
  console.log(`Tenant: ${tenant.nombre} (id=${tenant.id})`)

  const { rows: [cc] } = await client.query(
    `SELECT id, codigo, nombre FROM centros_costo
     WHERE tenant_id = $1 AND (UPPER(codigo) = 'BUFFET' OR UPPER(nombre) = 'BUFFET')
     LIMIT 1`,
    [tenant.id]
  )
  if (!cc) {
    console.error('No se encontro el Centro de Costo BUFFET en este tenant.')
    process.exit(1)
  }
  console.log(`Centro de Costo Buffet: ${cc.codigo} - ${cc.nombre} (id=${cc.id})\n`)

  let cajaIds = CAJAS_ARG
  if (!cajaIds) {
    const { rows: cajasBuffet } = await client.query(
      'SELECT id, codigo, nombre FROM cajas WHERE tenant_id = $1 AND centro_costo_id = $2',
      [tenant.id, cc.id]
    )
    cajaIds = cajasBuffet.map(c => c.id)
    console.log(`Cajas buffet detectadas (centro_costo_id = ${cc.id}):`)
    cajasBuffet.forEach(c => console.log(`  #${c.id} ${c.codigo} - ${c.nombre}`))
    if (cajaIds.length === 0) {
      console.error('\nNo hay cajas con centro_costo_id = Buffet. Configurala primero o pasa --cajas.')
      process.exit(1)
    }
  } else {
    console.log(`Cajas buffet (desde --cajas): ${cajaIds.join(', ')}`)
  }
  console.log('')

  const withCajas = [tenant.id, cajaIds, cc.id]
  const sinCajas = [tenant.id, cc.id]

  const queries = [
    {
      label: 'movimientos_caja',
      params: withCajas,
      count: `SELECT COUNT(*) FROM movimientos_caja
              WHERE tenant_id = $1 AND caja_id = ANY($2::int[])
                AND (centro_costo_id IS NULL OR centro_costo_id <> $3)`,
      update: `UPDATE movimientos_caja SET centro_costo_id = $3
               WHERE tenant_id = $1 AND caja_id = ANY($2::int[])
                 AND (centro_costo_id IS NULL OR centro_costo_id <> $3)`,
    },
    {
      label: 'movimientos_contables',
      params: withCajas,
      count: `SELECT COUNT(*) FROM movimientos_contables
              WHERE tenant_id = $1 AND caja_id = ANY($2::int[])
                AND (centro_costo_id IS NULL OR centro_costo_id <> $3)`,
      update: `UPDATE movimientos_contables SET centro_costo_id = $3
               WHERE tenant_id = $1 AND caja_id = ANY($2::int[])
                 AND (centro_costo_id IS NULL OR centro_costo_id <> $3)`,
    },
    {
      label: 'comandas (todas del tenant)',
      params: sinCajas,
      count: `SELECT COUNT(*) FROM comandas
              WHERE tenant_id = $1
                AND (centro_costo_id IS NULL OR centro_costo_id <> $2)`,
      update: `UPDATE comandas SET centro_costo_id = $2
               WHERE tenant_id = $1
                 AND (centro_costo_id IS NULL OR centro_costo_id <> $2)`,
    },
    {
      label: 'pedidos_takeaway (todos del tenant)',
      params: sinCajas,
      count: `SELECT COUNT(*) FROM pedidos_takeaway
              WHERE tenant_id = $1
                AND (centro_costo_id IS NULL OR centro_costo_id <> $2)`,
      update: `UPDATE pedidos_takeaway SET centro_costo_id = $2
               WHERE tenant_id = $1
                 AND (centro_costo_id IS NULL OR centro_costo_id <> $2)`,
    },
    {
      label: 'asiento_lineas (VENTA_BUFFET/KIOSCO/TAKEAWAY)',
      params: sinCajas,
      count: `SELECT COUNT(*) FROM asiento_lineas al
              JOIN asientos a ON a.id = al.asiento_id
              WHERE al.tenant_id = $1
                AND a.tipo_origen IN ('VENTA_BUFFET','VENTA_KIOSCO','VENTA_TAKEAWAY')
                AND (al.centro_costo_id IS NULL OR al.centro_costo_id <> $2)`,
      update: `UPDATE asiento_lineas SET centro_costo_id = $2
               WHERE id IN (
                 SELECT al.id FROM asiento_lineas al
                 JOIN asientos a ON a.id = al.asiento_id
                 WHERE al.tenant_id = $1
                   AND a.tipo_origen IN ('VENTA_BUFFET','VENTA_KIOSCO','VENTA_TAKEAWAY')
                   AND (al.centro_costo_id IS NULL OR al.centro_costo_id <> $2)
               )`,
    },
    {
      label: 'asiento_lineas (FACTURA_VENTA de cajas buffet)',
      params: withCajas,
      count: `SELECT COUNT(*) FROM asiento_lineas al
              JOIN asientos a ON a.id = al.asiento_id
              WHERE al.tenant_id = $1
                AND a.tipo_origen = 'FACTURA_VENTA'
                AND a.origen_id IN (
                  SELECT id FROM movimientos_contables
                  WHERE tenant_id = $1 AND caja_id = ANY($2::int[])
                )
                AND (al.centro_costo_id IS NULL OR al.centro_costo_id <> $3)`,
      update: `UPDATE asiento_lineas SET centro_costo_id = $3
               WHERE id IN (
                 SELECT al.id FROM asiento_lineas al
                 JOIN asientos a ON a.id = al.asiento_id
                 WHERE al.tenant_id = $1
                   AND a.tipo_origen = 'FACTURA_VENTA'
                   AND a.origen_id IN (
                     SELECT id FROM movimientos_contables
                     WHERE tenant_id = $1 AND caja_id = ANY($2::int[])
                   )
                   AND (al.centro_costo_id IS NULL OR al.centro_costo_id <> $3)
               )`,
    },
    {
      label: 'asiento_lineas (RECIBO_COBRO de cajas buffet)',
      params: withCajas,
      count: `SELECT COUNT(*) FROM asiento_lineas al
              JOIN asientos a ON a.id = al.asiento_id
              WHERE al.tenant_id = $1
                AND a.tipo_origen = 'RECIBO_COBRO'
                AND a.origen_id IN (
                  SELECT id FROM movimientos_contables
                  WHERE tenant_id = $1 AND caja_id = ANY($2::int[])
                )
                AND (al.centro_costo_id IS NULL OR al.centro_costo_id <> $3)`,
      update: `UPDATE asiento_lineas SET centro_costo_id = $3
               WHERE id IN (
                 SELECT al.id FROM asiento_lineas al
                 JOIN asientos a ON a.id = al.asiento_id
                 WHERE al.tenant_id = $1
                   AND a.tipo_origen = 'RECIBO_COBRO'
                   AND a.origen_id IN (
                     SELECT id FROM movimientos_contables
                     WHERE tenant_id = $1 AND caja_id = ANY($2::int[])
                   )
                   AND (al.centro_costo_id IS NULL OR al.centro_costo_id <> $3)
               )`,
    },
    {
      label: 'asiento_lineas (MOV_CAJA de cajas buffet)',
      params: withCajas,
      count: `SELECT COUNT(*) FROM asiento_lineas al
              JOIN asientos a ON a.id = al.asiento_id
              WHERE al.tenant_id = $1
                AND a.tipo_origen = 'MOV_CAJA'
                AND a.origen_id IN (
                  SELECT id FROM movimientos_caja
                  WHERE tenant_id = $1 AND caja_id = ANY($2::int[])
                )
                AND (al.centro_costo_id IS NULL OR al.centro_costo_id <> $3)`,
      update: `UPDATE asiento_lineas SET centro_costo_id = $3
               WHERE id IN (
                 SELECT al.id FROM asiento_lineas al
                 JOIN asientos a ON a.id = al.asiento_id
                 WHERE al.tenant_id = $1
                   AND a.tipo_origen = 'MOV_CAJA'
                   AND a.origen_id IN (
                     SELECT id FROM movimientos_caja
                     WHERE tenant_id = $1 AND caja_id = ANY($2::int[])
                   )
                   AND (al.centro_costo_id IS NULL OR al.centro_costo_id <> $3)
               )`,
    },
  ]

  console.log('Registros afectados:')
  const plan = []
  for (const q of queries) {
    const { rows: [{ count }] } = await client.query(q.count, q.params)
    console.log(`  ${q.label.padEnd(55)} ${count}`)
    plan.push({ ...q, count: parseInt(count) })
  }

  if (!EXECUTE) {
    console.log('\n[DRY-RUN] No se modifico nada. Volve a correr con --execute para aplicar.\n')
    await client.end()
    return
  }

  console.log('\nEjecutando updates dentro de una transaccion...')
  await client.query('BEGIN')
  try {
    for (const q of plan) {
      if (q.count === 0) continue
      const { rowCount } = await client.query(q.update, q.params)
      console.log(`  OK ${q.label}: ${rowCount} filas actualizadas`)
    }
    await client.query('COMMIT')
    console.log('\nCommit OK.\n')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('\nError - rollback:', err.message)
    throw err
  }

  await client.end()
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
