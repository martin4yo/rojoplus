/**
 * Script: repararItemsTaBarra.js
 *
 * Corrige los items_pedido_takeaway de los pedidos TA BARRA que acumulaban
 * todos los items de la sesión, cuando sus pagos fueron divididos en BR sub-pedidos.
 *
 * Para cada TA BARRA con BR sub-pedidos:
 *   1. Borra todos sus items_pedido_takeaway actuales
 *   2. Re-genera los items desde movimientos_stock en el momento de su propio pago
 *
 * NO modifica movimientos_caja.
 *
 * Uso:
 *   node repararItemsTaBarra.js [--dry-run] [--fecha YYYY-MM-DD] [--tenant-id N]
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
const VENTANA_SEG = 3

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const client = await pool.connect()
  try {
    console.log(`\n=== Reparar items TA BARRA - Tenant ${tenantArg} - Fecha ${fechaArg} ===`)
    console.log(DRY_RUN ? '*** DRY-RUN ***\n' : '*** MODO REAL ***\n')

    const fechaDesde = `${fechaArg} 00:00:00`
    const fechaHasta = `${fechaArg} 23:59:59`

    // TA BARRA que tienen BR sub-pedidos referenciándolos en el concepto del caja
    const taBarra = await client.query(`
      SELECT DISTINCT pt.id AS ta_id, pt.numero AS ta_numero
      FROM pedidos_takeaway pt
      WHERE pt.tenant_id = $1
        AND pt.tipo = 'BARRA'
        AND pt.numero NOT ILIKE 'BR%'
        AND pt.hora_recibido >= $2
        AND pt.hora_recibido <= $3
        AND EXISTS (
          SELECT 1 FROM movimientos_caja mc2
          JOIN cajas c2 ON c2.id = mc2.caja_id
          WHERE mc2.concepto ILIKE '%' || pt.numero || '%'
            AND mc2.pedido_takeaway_id IN (
              SELECT id FROM pedidos_takeaway WHERE numero ILIKE 'BR%' AND tenant_id = $1
            )
            AND c2.para_buffet = true AND mc2.tipo = 'INGRESO' AND mc2.anulado = false
        )
      ORDER BY pt.numero
    `, [tenantArg, fechaDesde, fechaHasta])

    console.log(`TA BARRA a corregir: ${taBarra.rows.length}`)

    let corregidos = 0

    for (const ta of taBarra.rows) {
      // Items actuales
      const itemsActuales = await client.query(
        `SELECT COUNT(*) AS cnt, SUM(subtotal) AS suma FROM items_pedido_takeaway WHERE pedido_id = $1`,
        [ta.ta_id]
      )
      const cntActual = itemsActuales.rows[0].cnt
      const sumaActual = parseFloat(itemsActuales.rows[0].suma || 0)

      // Movimientos de caja propios del TA
      const cajaMov = await client.query(`
        SELECT mc.id, mc.fecha, mc.monto
        FROM movimientos_caja mc
        JOIN cajas c ON c.id = mc.caja_id
        WHERE mc.pedido_takeaway_id = $1
          AND c.para_buffet = true
          AND mc.tipo = 'INGRESO'
          AND mc.anulado = false
        ORDER BY mc.fecha
      `, [ta.ta_id])

      const totalCaja = cajaMov.rows.reduce((s, r) => s + parseFloat(r.monto), 0)
      const cajaMcIds = cajaMov.rows.map(r => r.id)

      // Buscar items de stock en el momento del propio pago del TA
      const stockItems = cajaMcIds.length ? await client.query(`
        SELECT DISTINCT ON (ms.producto_variante_id, ms.fecha)
          ms.id AS stock_id,
          ms.cantidad,
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
      `, [tenantArg, `%${ta.ta_numero}%`, cajaMcIds]) : { rows: [] }

      const subtotalNuevo = stockItems.rows.reduce((s, r) => s + parseFloat(r.cantidad) * parseFloat(r.buffet_precio || 0), 0)

      console.log(`\n  ${ta.ta_numero} (id:${ta.ta_id}):`)
      console.log(`    Items actuales: ${cntActual} items = $${sumaActual} | Caja propia: $${totalCaja}`)
      console.log(`    Nuevos items desde stock: ${stockItems.rows.length} items = $${subtotalNuevo}`)
      stockItems.rows.forEach(r => {
        console.log(`      - ${r.buffet_nombre || r.producto_nombre} x${r.cantidad} @ $${r.buffet_precio} = $${parseFloat(r.cantidad) * parseFloat(r.buffet_precio || 0)}`)
      })

      if (DRY_RUN) { corregidos++; continue }

      await client.query('BEGIN')
      try {
        // 1. Borrar items actuales del TA
        await client.query(`DELETE FROM items_pedido_takeaway WHERE pedido_id = $1`, [ta.ta_id])

        // 2. Insertar nuevos items desde stock
        for (const item of stockItems.rows) {
          if (!item.buffet_id) {
            console.log(`    [SKIP] Sin producto_buffet: ${item.producto_nombre}`)
            continue
          }
          const precio = parseFloat(item.buffet_precio)
          const cantidad = parseFloat(item.cantidad)
          await client.query(`
            INSERT INTO items_pedido_takeaway
              (pedido_id, producto_buffet_id, cantidad, "precioUnitario", subtotal, estado, tenant_id, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, 'ENTREGADO', $6, NOW(), NOW())
          `, [ta.ta_id, item.buffet_id, cantidad, precio, precio * cantidad, tenantArg])
        }

        // 3. Actualizar total del pedido TA para que refleje su caja real
        await client.query(`
          UPDATE pedidos_takeaway SET total = $1, subtotal = $1, updated_at = NOW() WHERE id = $2
        `, [totalCaja, ta.ta_id])

        await client.query('COMMIT')
        corregidos++
      } catch (err) {
        await client.query('ROLLBACK')
        console.log(`    [ERROR] ${err.message}`)
      }
    }

    console.log(`\n=== Resumen: ${corregidos} TA BARRA corregidos ===`)

    if (!DRY_RUN) {
      const check = await client.query(`
        WITH pedidos_periodo AS (
          SELECT DISTINCT mc.pedido_takeaway_id AS pedido_id, SUM(mc.monto) AS monto_caja
          FROM movimientos_caja mc JOIN cajas c ON c.id = mc.caja_id
          WHERE c.para_buffet = true AND c.activo = true
            AND mc.tipo = 'INGRESO' AND mc.anulado = false AND mc.tenant_id = $1
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
          SUM(COALESCE(ip.suma_items,0)) AS total_items,
          SUM(pp.monto_caja) - SUM(COALESCE(ip.suma_items,0)) AS diferencia,
          COUNT(CASE WHEN ip.suma_items IS NULL THEN 1 END) AS sin_items
        FROM pedidos_periodo pp LEFT JOIN items_por_pedido ip ON ip.pedido_id = pp.pedido_id
      `, [tenantArg, `${fechaArg} 00:00:00`, `${fechaArg} 23:59:59`])

      const r = check.rows[0]
      console.log(`\n=== Verificación ===`)
      console.log(`Total caja:   $${r.total_caja}`)
      console.log(`Total items:  $${r.total_items}`)
      console.log(`Diferencia:   $${r.diferencia}`)
      console.log(`Sin items:    ${r.sin_items}`)
    }
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
