/**
 * Lee los valores actuales de MODO_DEMO, EMAIL_DEMO y WHATSAPP_DEMO_NUMERO
 * del tenant indicado y los imprime como JSON.
 *
 * Uso:
 *   node scripts/preservarDemoConfig.js --tenant sportivotest
 *
 * Para restaurar después del clone:
 *   node scripts/preservarDemoConfig.js --tenant sportivotest --apply '<json>'
 */
import pg from 'pg'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

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

const TENANT_SLUG = arg('tenant')
const APPLY_JSON = arg('apply')

if (!TENANT_SLUG) {
  console.error('Uso: node preservarDemoConfig.js --tenant <slug> [--apply <json>]')
  process.exit(1)
}

const CLAVES = ['MODO_DEMO', 'EMAIL_DEMO', 'WHATSAPP_DEMO_NUMERO']

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

;(async () => {
  const client = await pool.connect()
  try {
    const tenantQ = await client.query('SELECT id FROM tenants WHERE slug = $1', [TENANT_SLUG])
    if (tenantQ.rowCount === 0) {
      console.error(`Tenant '${TENANT_SLUG}' no encontrado`)
      process.exit(1)
    }
    const tenantId = tenantQ.rows[0].id

    if (APPLY_JSON) {
      // RESTAURAR
      const datos = JSON.parse(APPLY_JSON)
      let aplicados = 0
      for (const clave of CLAVES) {
        const v = datos[clave]
        if (v == null) continue
        await client.query(
          `INSERT INTO configuracion (clave, valor, tipo, modulo, descripcion, tenant_id, updated_at, editable)
           VALUES ($1, $2, COALESCE((SELECT tipo FROM configuracion WHERE clave=$1 AND tenant_id=$3 LIMIT 1), 'STRING'),
                   'SISTEMA', 'Restaurado tras clone', $3, NOW(), true)
           ON CONFLICT (tenant_id, clave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = NOW()`,
          [clave, v, tenantId]
        )
        aplicados++
        console.log(`✓ ${clave} = "${v}"`)
      }
      console.log(`\n${aplicados} valores restaurados en tenant ${TENANT_SLUG} (id=${tenantId})`)
    } else {
      // LEER
      const r = await client.query(
        'SELECT clave, valor FROM configuracion WHERE tenant_id = $1 AND clave = ANY($2::text[])',
        [tenantId, CLAVES]
      )
      const out = {}
      for (const row of r.rows) out[row.clave] = row.valor
      console.log(JSON.stringify(out))
    }
  } finally {
    client.release()
    await pool.end()
  }
})().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
