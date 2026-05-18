/**
 * cleanup-axio-legacy-configs.js
 *
 * Borra claves de tabla Configuracion que quedaron huérfanas tras la
 * migración de clubix a AXIO Hub (ver [[project_clubix_axio_migration]]).
 * El código nuevo ya no las lee, son datos muertos.
 *
 * Uso:
 *   node scripts/cleanup-axio-legacy-configs.js              # dry-run (default)
 *   node scripts/cleanup-axio-legacy-configs.js --apply      # ejecuta el DELETE
 *   node scripts/cleanup-axio-legacy-configs.js --apply --tenant brio
 *                                                            # solo un tenant
 *
 * En dry-run muestra cuántas filas serían borradas por clave por tenant.
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
  const next = process.argv[i + 1]
  return next && !next.startsWith('--') ? next : true
}

const APPLY = !!arg('apply', false)
const TENANT = arg('tenant', null)

const CLAVES_LEGACY = [
  'CHAT_USE_AXIO_HUB',
  'WA_AGENT_SYSTEM_PROMPT',
  'AI_PROVIDER',
  'AI_MODEL_TIER',
  'AI_API_KEY',
  'AI_MODEL_OVERRIDE',
]

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL no está seteada. Cargá .env o exportá la variable.')
    process.exit(1)
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  try {
    const params = [CLAVES_LEGACY]
    let whereExtra = ''
    if (TENANT && typeof TENANT === 'string') {
      whereExtra = ` AND t."slug" = $2`
      params.push(TENANT)
    }

    // Conteo previo
    const { rows: counts } = await pool.query(
      `SELECT c.clave, t.slug AS tenant, COUNT(*) AS n
         FROM "Configuracion" c
         JOIN "Tenant" t ON t.id = c."tenantId"
        WHERE c.clave = ANY($1::text[])${whereExtra}
        GROUP BY c.clave, t.slug
        ORDER BY t.slug, c.clave`,
      params,
    )

    if (counts.length === 0) {
      console.log('No hay configs legacy para borrar.')
      return
    }

    const total = counts.reduce((acc, r) => acc + parseInt(r.n, 10), 0)
    console.log(`\nFilas legacy detectadas: ${total}\n`)
    for (const r of counts) {
      console.log(`  ${r.tenant.padEnd(20)} ${r.clave.padEnd(28)} ${r.n}`)
    }

    if (!APPLY) {
      console.log('\nDry-run. Para ejecutar el DELETE: agregá --apply')
      return
    }

    const { rowCount } = await pool.query(
      `DELETE FROM "Configuracion" c
        USING "Tenant" t
        WHERE c."tenantId" = t.id
          AND c.clave = ANY($1::text[])${whereExtra}`,
      params,
    )
    console.log(`\n✅ ${rowCount} filas eliminadas.`)
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
