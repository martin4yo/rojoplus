/**
 * Migra los 77 movimientos de stock tipo INGRESO desde rojoplus_db → clubix_db (tenant_id=1)
 * Hace match por codigo del producto (igual en ambas bases)
 * Uso: node server/scripts/migrar-stock-ingresos.js
 */
import pg from 'pg'

const { Pool } = pg
const TENANT_ID = 1

const poolRojo = new Pool({ host: 'localhost', port: 5434, database: 'rojoplus_db', user: 'postgres', password: 'Q27G4B98' })
const poolClub = new Pool({ host: 'localhost', port: 5434, database: 'clubix_db',   user: 'postgres', password: 'Q27G4B98' })

async function main() {
  // 1. Leer movimientos INGRESO de rojoplus con datos del producto
  const { rows: movimientos } = await poolRojo.query(`
    SELECT
      ms.id        AS rojo_id,
      ms.fecha,
      ms.tipo,
      ms.cantidad,
      ms.stock_anterior,
      ms.stock_posterior,
      ms.concepto,
      ms.registrado_por,
      ms.created_at,
      p.codigo     AS producto_codigo
    FROM movimientos_stock ms
    JOIN producto_variantes pv ON pv.id = ms.producto_variante_id
    JOIN productos p ON p.id = pv.producto_id
    WHERE ms.tipo = 'INGRESO'
    ORDER BY ms.id
  `)

  console.log(`\n📦 Movimientos INGRESO encontrados en rojoplus_db: ${movimientos.length}`)

  // 2. Construir mapa codigo → variante_id en clubix
  const codigos = [...new Set(movimientos.map(m => m.producto_codigo))]
  const { rows: variantesClub } = await poolClub.query(`
    SELECT pv.id AS variante_id, p.codigo AS producto_codigo
    FROM producto_variantes pv
    JOIN productos p ON p.id = pv.producto_id
    WHERE p.tenant_id = $1
      AND pv.tenant_id = $1
      AND pv.talle = 'UNICA'
      AND p.codigo = ANY($2)
  `, [TENANT_ID, codigos])

  const mapaVariante = {}
  variantesClub.forEach(r => { mapaVariante[r.producto_codigo] = r.variante_id })

  console.log(`✅ Productos con match en clubix_db: ${Object.keys(mapaVariante).length} de ${codigos.length}`)

  const sinMatch = codigos.filter(c => !mapaVariante[c])
  if (sinMatch.length > 0) {
    console.log(`⚠️  Sin match (${sinMatch.length}): ${sinMatch.slice(0, 10).join(', ')}${sinMatch.length > 10 ? '...' : ''}`)
  }

  // 3. Insertar en clubix
  let insertados = 0
  let omitidos = 0

  for (const m of movimientos) {
    const varianteId = mapaVariante[m.producto_codigo]
    if (!varianteId) { omitidos++; continue }

    await poolClub.query(`
      INSERT INTO movimientos_stock
        (producto_variante_id, fecha, tipo, cantidad, stock_anterior, stock_posterior,
         concepto, registrado_por, created_at, tenant_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT DO NOTHING
    `, [
      varianteId,
      m.fecha,
      m.tipo,
      m.cantidad,
      m.stock_anterior,
      m.stock_posterior,
      m.concepto,
      m.registrado_por,
      m.created_at,
      TENANT_ID
    ])
    insertados++
  }

  console.log(`\n✅ Insertados: ${insertados} | Omitidos por sin match: ${omitidos}`)

  // 4. Recalcular stock_actual para las variantes afectadas
  const varianteIds = [...new Set(Object.values(mapaVariante))]
  console.log(`\n🔄 Recalculando stock_actual para ${varianteIds.length} variantes...`)

  const { rowCount } = await poolClub.query(`
    UPDATE producto_variantes pv
    SET stock_actual = COALESCE((
      SELECT SUM(CASE WHEN ms.tipo = 'INGRESO' THEN ms.cantidad ELSE -ms.cantidad END)
      FROM movimientos_stock ms
      WHERE ms.producto_variante_id = pv.id AND ms.tenant_id = $1
    ), 0)
    WHERE pv.id = ANY($2) AND pv.tenant_id = $1
  `, [TENANT_ID, varianteIds])

  console.log(`✅ Stock actualizado para ${rowCount} variantes`)

  await poolRojo.end()
  await poolClub.end()
  console.log('\n✅ Migración de stock completada')
}

main().catch(async e => {
  console.error('\n❌ Error:', e.message)
  await poolRojo.end().catch(() => {})
  await poolClub.end().catch(() => {})
  process.exit(1)
})
