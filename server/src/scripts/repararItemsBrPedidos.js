/**
 * Script: repararItemsBrPedidos.js
 *
 * Reconstruye los items_pedido_takeaway faltantes en los pedidos BR (barra)
 * que fueron creados como placeholders cuando los tickets originales fueron eliminados.
 *
 * Estrategia:
 * - Para cada BR sin items, busca los movimientos_stock en el mismo instante (±2 seg)
 *   que referencien el mismo número TA en su concepto.
 * - Los productos encontrados en stock se mapean a productos_buffet via producto_id.
 * - Se crean los items_pedido_takeaway con los precios actuales del producto_buffet.
 *
 * Uso:
 *   DATABASE_URL="postgresql://..." node server/src/scripts/repararItemsBrPedidos.js [--dry-run] [--fecha YYYY-MM-DD] [--tenant-id N]
 */

import pg from 'pg'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '../../.env') })

const { Pool } = pg

const DRY_RUN = process.argv.includes('--dry-run')
const fechaArg = process.argv.find(a => a.startsWith('--fecha'))?.split('=')[1] || '2026-04-05'
const tenantArg = parseInt(process.argv.find(a => a.startsWith('--tenant-id'))?.split('=')[1] || '1')
const VENTANA_SEG = 3 // segundos de tolerancia para correlación temporal

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const client = await pool.connect()
  try {
    console.log(`\n=== Reparación de items BR - Tenant ${tenantArg} - Fecha ${fechaArg} ===`)
    console.log(DRY_RUN ? '*** MODO DRY-RUN (no escribe datos) ***\n' : '*** MODO REAL ***\n')

    const fechaDesde = `${fechaArg} 00:00:00`
    const fechaHasta = `${fechaArg} 23:59:59`

    // 1. Obtener todos los BR pedidos sin items del día/tenant
    const brPedidos = await client.query(`
      SELECT DISTINCT
        pt.id AS br_id,
        pt.numero AS br_numero,
        pt.total AS br_total
      FROM pedidos_takeaway pt
      WHERE pt.tenant_id = $1
        AND pt.tipo = 'BARRA'
        AND pt.numero ILIKE 'BR%'
        AND pt.hora_recibido >= $2
        AND pt.hora_recibido <= $3
        AND NOT EXISTS (SELECT 1 FROM items_pedido_takeaway WHERE pedido_id = pt.id)
      ORDER BY pt.numero
    `, [tenantArg, fechaDesde, fechaHasta])

    console.log(`BR pedidos sin items: ${brPedidos.rows.length}`)
    if (brPedidos.rows.length === 0) {
      console.log('Nada que reparar.')
      return
    }

    let totalItemsCreados = 0
    let brReparados = 0
    let brSinMatch = 0

    for (const br of brPedidos.rows) {
      // 2. Obtener los movimientos de caja del BR (puede haber varios por pago dividido)
      const cajaMov = await client.query(`
        SELECT mc.id, mc.fecha, mc.monto, mc.concepto
        FROM movimientos_caja mc
        JOIN cajas c ON c.id = mc.caja_id
        WHERE mc.pedido_takeaway_id = $1
          AND c.para_buffet = true
          AND mc.tipo = 'INGRESO'
          AND mc.anulado = false
        ORDER BY mc.fecha
      `, [br.br_id])

      if (cajaMov.rows.length === 0) continue

      // Extraer número TA del concepto del primer movimiento
      const concepto = cajaMov.rows[0].concepto || ''
      const taMatch = concepto.match(/Pedido (TA[\w-]+)/)
      const taNumero = taMatch ? taMatch[1] : null

      if (!taNumero) {
        console.log(`  [SKIP] ${br.br_numero}: no se puede extraer TA del concepto "${concepto}"`)
        brSinMatch++
        continue
      }

      const totalCaja = cajaMov.rows.reduce((s, m) => s + parseFloat(m.monto), 0)

      // 3. Buscar movimientos_stock en la ventana temporal de los cobros.
      // Los timestamps en DB son 'timestamp without time zone' en hora local Argentina.
      // Usamos el ID del movimiento de caja para hacer la comparación directamente en SQL,
      // evitando conversiones UTC de Node.js que desplazan 3 horas.
      const cajaMcIds = cajaMov.rows.map(r => r.id)
      const stockMov = await client.query(`
        SELECT DISTINCT ON (ms.producto_variante_id, ms.fecha)
          ms.id AS stock_id,
          ms.cantidad,
          ms.fecha AS stock_fecha,
          p.id AS producto_id,
          p.nombre AS producto_nombre,
          pb.id AS buffet_id,
          pb.nombre AS buffet_nombre,
          pb.precio AS buffet_precio
        FROM movimientos_caja mc_ref
        JOIN movimientos_stock ms ON
          ms.tipo = 'EGRESO'
          AND ms.tenant_id = $1
          AND ms.concepto ILIKE $2
          AND ms.fecha BETWEEN mc_ref.fecha - INTERVAL '${VENTANA_SEG} seconds'
                           AND mc_ref.fecha + INTERVAL '${VENTANA_SEG} seconds'
        JOIN producto_variantes pv ON pv.id = ms.producto_variante_id
        JOIN productos p ON p.id = pv.producto_id
        LEFT JOIN productos_buffet pb ON pb.producto_id = p.id AND pb.tenant_id = $1
        WHERE mc_ref.id = ANY($3)
        ORDER BY ms.producto_variante_id, ms.fecha, ms.id
      `, [tenantArg, `%${taNumero}%`, cajaMcIds])

      if (stockMov.rows.length === 0) {
        console.log(`  [SIN STOCK] ${br.br_numero}: no hay movimientos de stock para ${taNumero} en ese momento (caja: $${totalCaja})`)
        brSinMatch++
        continue
      }

      // Calcular subtotal con precios actuales
      const subtotalItems = stockMov.rows.reduce((s, r) => {
        return s + parseFloat(r.cantidad) * parseFloat(r.buffet_precio || 0)
      }, 0)

      console.log(`\n  ${br.br_numero} (caja: $${totalCaja}, items: $${subtotalItems}):`)
      stockMov.rows.forEach(r => {
        console.log(`    - ${r.buffet_nombre || r.producto_nombre} x${r.cantidad} @ $${r.buffet_precio || '?'} = $${parseFloat(r.cantidad) * parseFloat(r.buffet_precio || 0)}`)
      })

      const itemsSinBuffet = stockMov.rows.filter(r => !r.buffet_id)
      if (itemsSinBuffet.length > 0) {
        console.log(`    ⚠ Sin producto_buffet: ${itemsSinBuffet.map(r => r.producto_nombre).join(', ')}`)
      }

      if (DRY_RUN) {
        brReparados++
        totalItemsCreados += stockMov.rows.length
        continue
      }

      // 4. Crear items_pedido_takeaway
      await client.query('BEGIN')
      try {
        for (const item of stockMov.rows) {
          if (!item.buffet_id) {
            console.log(`    [SKIP ITEM] Sin producto_buffet: ${item.producto_nombre}`)
            continue
          }
          const precio = parseFloat(item.buffet_precio)
          const cantidad = parseFloat(item.cantidad)
          const subtotal = precio * cantidad

          await client.query(`
            INSERT INTO items_pedido_takeaway
              (pedido_id, producto_buffet_id, cantidad, "precioUnitario", subtotal, estado, tenant_id, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, 'ENTREGADO', $6, NOW(), NOW())
            ON CONFLICT DO NOTHING
          `, [br.br_id, item.buffet_id, cantidad, precio, subtotal, tenantArg])

          totalItemsCreados++
        }

        // Actualizar total del pedido BR con el total de caja (fuente de verdad)
        await client.query(`
          UPDATE pedidos_takeaway
          SET subtotal = $1, total = $1, updated_at = NOW()
          WHERE id = $2
        `, [totalCaja, br.br_id])

        await client.query('COMMIT')
        brReparados++
      } catch (err) {
        await client.query('ROLLBACK')
        console.log(`    [ERROR] ${br.br_numero}: ${err.message}`)
      }
    }

    console.log(`\n=== Resumen ===`)
    console.log(`BR reparados: ${brReparados}`)
    console.log(`Items creados: ${totalItemsCreados}`)
    console.log(`BR sin match de stock: ${brSinMatch}`)

    if (!DRY_RUN && brReparados > 0) {
      // Verificación final
      const check = await client.query(`
        WITH pedidos_periodo AS (
          SELECT DISTINCT mc.pedido_takeaway_id AS pedido_id, SUM(mc.monto) AS monto_caja
          FROM movimientos_caja mc
          JOIN cajas c ON c.id = mc.caja_id
          WHERE c.para_buffet = true AND c.activo = true
            AND mc.tipo = 'INGRESO' AND mc.anulado = false
            AND mc.tenant_id = $1
            AND mc.fecha >= $2 AND mc.fecha <= $3
            AND mc.pedido_takeaway_id IS NOT NULL
          GROUP BY mc.pedido_takeaway_id
        ),
        items_por_pedido AS (
          SELECT pedido_id, SUM(subtotal) AS suma_items
          FROM items_pedido_takeaway
          WHERE pedido_id IN (SELECT pedido_id FROM pedidos_periodo)
          GROUP BY pedido_id
        )
        SELECT
          SUM(pp.monto_caja) AS total_caja,
          SUM(COALESCE(ip.suma_items, 0)) AS total_items,
          SUM(pp.monto_caja) - SUM(COALESCE(ip.suma_items, 0)) AS diferencia,
          COUNT(CASE WHEN ip.suma_items IS NULL THEN 1 END) AS pedidos_sin_items
        FROM pedidos_periodo pp
        LEFT JOIN items_por_pedido ip ON ip.pedido_id = pp.pedido_id
      `, [tenantArg, fechaDesde, fechaHasta])

      const r = check.rows[0]
      console.log(`\n=== Verificación post-reparación ===`)
      console.log(`Total caja:   $${r.total_caja}`)
      console.log(`Total items:  $${r.total_items}`)
      console.log(`Diferencia:   $${r.diferencia}`)
      console.log(`Sin items:    ${r.pedidos_sin_items}`)
    }
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
