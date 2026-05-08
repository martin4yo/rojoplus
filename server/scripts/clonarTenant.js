/**
 * Clona un tenant a otro DENTRO DE LA MISMA DB.
 * Reemplaza completamente los datos del tenant destino con los del tenant origen.
 *
 * NO toca:
 *   - El registro de la tabla `tenants` (mantiene id, slug, nombre, etc del destino)
 *   - `tenant_usuarios` (los usuarios con acceso al destino siguen igual)
 *   - Las tablas globales (Admin, Rol, Permiso, etc.)
 *
 * SÍ reemplaza:
 *   - Todos los datos del negocio del tenant destino con los del origen
 *   - Configuraciones del tenant (`tenant_configuracion`)
 *
 * Estrategia:
 *   - OFFSET = MAX(id global) + 1.000.000 → todos los IDs nuevos = id_origen + OFFSET
 *   - FKs internas se desplazan por el mismo OFFSET → relaciones consistentes
 *   - PKs string (cuid): se sufija con `_t{TARGET_ID}` y FKs a esas tablas también
 *   - FK triggers deshabilitados durante la operación
 *   - Reset de secuencias al final
 *
 * Uso:
 *   - Dry-run (no escribe):
 *       node scripts/clonarTenant.js --from sportivopilar --to sportivotest --dry-run
 *   - Aplicar:
 *       node scripts/clonarTenant.js --from sportivopilar --to sportivotest
 *
 * Variables de entorno (lee `.env` automáticamente):
 *   DATABASE_URL  o  PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE
 */
import pg from 'pg'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

// Cargar .env si existe
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envFile = path.resolve(__dirname, '..', '.env')
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/i)
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}

const { Pool } = pg

function arg(name, def = null) {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1) return def
  return process.argv[i + 1] || def
}

const FROM_SLUG = arg('from')
const TO_SLUG = arg('to')
const DRY_RUN = process.argv.includes('--dry-run')

if (!FROM_SLUG || !TO_SLUG) {
  console.error('Uso: node clonarTenant.js --from <slug-origen> --to <slug-destino> [--dry-run]')
  process.exit(1)
}
if (FROM_SLUG === TO_SLUG) {
  console.error('Origen y destino no pueden ser el mismo')
  process.exit(1)
}

// Tablas con tenant_id que NO clonamos
const SKIP_TABLES = new Set([
  // Los usuarios del tenant destino se mantienen
  'tenant_usuarios',
  // Módulo de accesos físicos: tienen tokens/IDs únicos globales (api_token)
  // que chocan al clonar. Se saltean — el tenant destino mantiene sus
  // dispositivos/registros propios (o vacíos).
  'dispositivos_acceso',
  'registros_acceso',
  'intentos_acceso_denegado',
  'habilitaciones_temporales',
  'favoritos_acceso',
])

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST || 'localhost',
        port: parseInt(process.env.PGPORT || '5432'),
        database: process.env.PGDATABASE || 'clubix_db',
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || '',
      }
)

function isIntType(typ) {
  if (!typ) return false
  const t = typ.toLowerCase()
  return t.includes('int') || t === 'serial' || t === 'bigserial'
}

async function main() {
  console.log(`\n=== Clonar tenant ===`)
  console.log(`Origen:  ${FROM_SLUG}`)
  console.log(`Destino: ${TO_SLUG}`)
  console.log(`Modo:    ${DRY_RUN ? 'DRY-RUN' : 'APLICAR'}\n`)

  // ── 1. IDs de los tenants ──────────────────────────────────────────────────
  const { rows: tenants } = await pool.query(
    `SELECT id, slug, nombre FROM tenants WHERE slug IN ($1, $2)`,
    [FROM_SLUG, TO_SLUG]
  )
  const source = tenants.find(t => t.slug === FROM_SLUG)
  const target = tenants.find(t => t.slug === TO_SLUG)
  if (!source) { console.error(`❌ Tenant origen '${FROM_SLUG}' no encontrado`); process.exit(1) }
  if (!target) { console.error(`❌ Tenant destino '${TO_SLUG}' no encontrado`); process.exit(1) }
  console.log(`✔ Origen:  ${source.nombre} (id=${source.id})`)
  console.log(`✔ Destino: ${target.nombre} (id=${target.id})\n`)

  // ── 2. Tablas con tenant_id ────────────────────────────────────────────────
  const { rows: tablesRows } = await pool.query(`
    SELECT DISTINCT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t ON c.table_name = t.table_name AND t.table_schema = 'public'
    WHERE c.column_name = 'tenant_id'
      AND c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
    ORDER BY c.table_name
  `)
  const allTables = tablesRows
    .map(r => r.table_name)
    .filter(t => !SKIP_TABLES.has(t))

  console.log(`📋 Tablas con tenant_id detectadas: ${allTables.length}`)

  // ── 3. PK de cada tabla ────────────────────────────────────────────────────
  const tableInfo = {}
  for (const table of allTables) {
    const { rows: pkRows } = await pool.query(`
      SELECT a.attname AS column_name,
             format_type(a.atttypid, a.atttypmod) AS data_type
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = ('"' || $1 || '"')::regclass
        AND i.indisprimary
    `, [table])
    if (pkRows.length === 0) {
      console.warn(`  ⚠ ${table}: sin PK simple, salteado`)
      continue
    }
    if (pkRows.length > 1) {
      console.warn(`  ⚠ ${table}: PK compuesta (${pkRows.map(r => r.column_name).join(', ')}), salteado`)
      continue
    }
    const { rows: colsRows } = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [table])
    tableInfo[table] = {
      pk: pkRows[0].column_name,
      pkType: pkRows[0].data_type,
      cols: colsRows.map(r => r.column_name),
    }
  }

  const validTables = Object.keys(tableInfo)

  // ── 4. FK relationships ────────────────────────────────────────────────────
  const { rows: fkRows } = await pool.query(`
    SELECT
      tc.table_name AS source_table,
      kcu.column_name AS source_column,
      ccu.table_name AS ref_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
  `)
  const fksBySource = {}
  for (const fk of fkRows) {
    if (!fksBySource[fk.source_table]) fksBySource[fk.source_table] = []
    fksBySource[fk.source_table].push({ column: fk.source_column, refTable: fk.ref_table })
  }

  // ── 5. Topological sort (parents before children) ─────────────────────────
  const insertOrder = []
  const visited = new Set()
  const visiting = new Set()
  function visit(table) {
    if (visited.has(table)) return
    if (visiting.has(table)) return
    visiting.add(table)
    const fks = fksBySource[table] || []
    for (const fk of fks) {
      if (validTables.includes(fk.refTable) && fk.refTable !== table) visit(fk.refTable)
    }
    visiting.delete(table)
    visited.add(table)
    insertOrder.push(table)
  }
  for (const t of validTables) visit(t)

  // ── 6. Calcular OFFSET para IDs ────────────────────────────────────────────
  let maxId = 0
  for (const table of validTables) {
    const info = tableInfo[table]
    if (!isIntType(info.pkType)) continue
    const { rows } = await pool.query(`SELECT COALESCE(MAX("${info.pk}"), 0)::bigint AS max FROM "${table}"`)
    const m = parseInt(rows[0].max)
    if (m > maxId) maxId = m
  }
  const OFFSET = maxId + 1000000
  const STRING_SUFFIX = `_t${target.id}`
  console.log(`📐 OFFSET para IDs int: ${OFFSET}`)
  console.log(`📐 Sufijo para IDs string: ${STRING_SUFFIX}`)

  // ── 7. Conteos del origen para verificación ───────────────────────────────
  console.log(`\n📊 Conteos en tenant origen (sportivopilar):`)
  const conteos = {}
  for (const table of validTables) {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS c FROM "${table}" WHERE tenant_id = $1`,
      [source.id]
    )
    if (rows[0].c > 0) conteos[table] = rows[0].c
  }
  for (const t of Object.keys(conteos).sort()) {
    console.log(`   ${t.padEnd(40)} ${conteos[t]}`)
  }

  if (DRY_RUN) {
    console.log(`\n⚠ DRY-RUN. Para aplicar, corré sin --dry-run.`)
    return
  }

  // ── 8. Operación: WIPE + INSERT en transacción con FK disabled ────────────
  console.log(`\n🚀 Iniciando operación...`)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SET session_replication_role = replica')
    console.log('   FK triggers deshabilitados')

    // ── WIPE target tenant (orden inverso) ──────────────────────────────────
    console.log(`\n🗑️  Borrando datos del tenant destino...`)
    for (const table of [...insertOrder].reverse()) {
      try {
        const { rowCount } = await client.query(
          `DELETE FROM "${table}" WHERE tenant_id = $1`,
          [target.id]
        )
        if (rowCount > 0) console.log(`   - ${table.padEnd(40)} ${rowCount} eliminadas`)
      } catch (err) {
        console.error(`   ✗ ${table} (delete): ${err.message}`)
        throw err
      }
    }

    // ── COPY desde origen con OFFSET ────────────────────────────────────────
    console.log(`\n📥 Copiando datos del origen al destino...`)
    let totalCopiadas = 0

    for (const table of insertOrder) {
      const info = tableInfo[table]
      if (!info) continue
      if (!conteos[table]) continue  // origen sin filas → nada que copiar

      const fks = fksBySource[table] || []
      const fkColMap = new Map()
      for (const fk of fks) {
        if (validTables.includes(fk.refTable)) {
          fkColMap.set(fk.column, fk.refTable)
        }
      }

      const isIntPK = isIntType(info.pkType)

      const selectExpr = info.cols.map(col => {
        if (col === 'tenant_id') return `${target.id} AS "${col}"`
        if (col === info.pk) {
          return isIntPK
            ? `("${col}" + ${OFFSET})::${info.pkType} AS "${col}"`
            : `("${col}" || '${STRING_SUFFIX}') AS "${col}"`
        }
        if (fkColMap.has(col)) {
          const refTable = fkColMap.get(col)
          const refInfo = tableInfo[refTable]
          if (!refInfo) return `"${col}"`
          const refIsInt = isIntType(refInfo.pkType)
          return refIsInt
            ? `(CASE WHEN "${col}" IS NULL THEN NULL ELSE "${col}" + ${OFFSET} END) AS "${col}"`
            : `(CASE WHEN "${col}" IS NULL THEN NULL ELSE "${col}" || '${STRING_SUFFIX}' END) AS "${col}"`
        }
        return `"${col}"`
      }).join(', ')

      const colsList = info.cols.map(c => `"${c}"`).join(', ')
      const sql = `INSERT INTO "${table}" (${colsList}) SELECT ${selectExpr} FROM "${table}" WHERE tenant_id = $1`

      try {
        const r = await client.query(sql, [source.id])
        if (r.rowCount > 0) {
          console.log(`   ✓ ${table.padEnd(40)} ${r.rowCount} copiadas`)
          totalCopiadas += r.rowCount
        }
      } catch (err) {
        console.error(`   ✗ ${table}: ${err.message}`)
        throw err
      }
    }

    // ── Reset de secuencias ──────────────────────────────────────────────────
    console.log(`\n🔢 Reseteando secuencias...`)
    for (const table of validTables) {
      const info = tableInfo[table]
      if (!isIntType(info.pkType)) continue
      try {
        await client.query(`
          SELECT setval(
            pg_get_serial_sequence('"${table}"', '${info.pk}'),
            COALESCE((SELECT MAX("${info.pk}") FROM "${table}"), 1),
            true
          )
        `)
      } catch (err) {
        // si la columna no tiene secuencia (no es serial), simplemente saltar
      }
    }

    await client.query('SET session_replication_role = DEFAULT')
    await client.query('COMMIT')
    console.log(`\n✅ Total copiadas: ${totalCopiadas} filas`)
    console.log(`✅ Clonación completada exitosamente`)
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    await client.query('SET session_replication_role = DEFAULT').catch(() => {})
    console.error(`\n❌ Error, rollback aplicado: ${err.message}`)
    throw err
  } finally {
    client.release()
  }

  // ── Verificación final ─────────────────────────────────────────────────────
  console.log(`\n📊 Conteos finales en tenant destino:`)
  let problemas = 0
  for (const table of validTables) {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS c FROM "${table}" WHERE tenant_id = $1`,
      [target.id]
    )
    const esperado = conteos[table] || 0
    const actual = rows[0].c
    if (esperado > 0 || actual > 0) {
      const ok = esperado === actual
      const mark = ok ? '✓' : '⚠'
      if (!ok) problemas++
      console.log(`   ${mark} ${table.padEnd(40)} ${actual} (esperado ${esperado})`)
    }
  }
  if (problemas > 0) {
    console.log(`\n⚠ Se detectaron ${problemas} discrepancias en los conteos.`)
  }
}

main()
  .catch(err => {
    console.error('\n❌ Error fatal:', err)
    process.exit(1)
  })
  .finally(async () => {
    await pool.end()
  })
