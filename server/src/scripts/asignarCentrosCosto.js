/**
 * asignarCentrosCosto.js
 *
 * Script para asignar centros de costo a actividades, conceptos de tesorería,
 * cargos, inscripciones y pedidos takeaway en un tenant dado.
 *
 * Uso:
 *   DATABASE_URL="postgresql://..." node server/src/scripts/asignarCentrosCosto.js <tenantId>
 *   node server/src/scripts/asignarCentrosCosto.js 4   (sportivotest)
 *
 * Ejecutar después del script de importación de cuotas (importar-cuotas.js).
 */

import pg from 'pg'
const { Client } = pg

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:Q27G4B98@localhost:5434/clubix_db'
const TENANT_ID = parseInt(process.argv[2] || '4')

const client = new Client({ connectionString: DATABASE_URL })

// ─── Mapeo actividad.codigo → centro_costo.codigo ──────────────────────────
const ACTIVIDAD_A_CC = {
  BASQUET:          'BAS',
  FUTBOL_ESCUELITA: 'FUT',
  FUTBOL_LIGA:      'FUT',
  FUTSAL:           'FUS',
  TAEKWONDO:        'TAE',
  VOLEY:            'VOL',
  HOCKEY:           'HOC',
  TENIS:            'TEN',
  PADDLE:           'PAD',
  NATACION:         'NAT',
  GIMNASIA:         'GIM',
}

// ─── Mapeo concepto_tesoreria.codigo → centro_costo.codigo ─────────────────
const CONCEPTO_A_CC = {
  CUOTA_BASQUET:          'BAS',
  CUOTA_FUTBOL_ESCUELITA: 'FUT',
  CUOTA_FUTBOL_LIGA:      'FUT',
  CUOTA_FUTSAL:           'FUS',
  CUOTA_TAEKWONDO:        'TAE',
  CUOTA_VOLEY:            'VOL',
  CUOTA_HOCKEY:           'HOC',
  CUOTA_TENIS:            'TEN',
  CUOTA_PADDLE:           'PAD',
  CUOTA_NATACION:         'NAT',
  CUOTA_GIMNASIA:         'GIM',
  'COB-ACT':              'ADM',
  'COB-CUO':              'ADM',
  CUOTA_SOCIO_UNICO:      'ADM',
  CUOTA_TITULAR_FAMILIA:  'ADM',
  'ING-MORA':             'ADM',
  MORA_SOCIOS:            'ADM',
  NOTA_CREDITO:           'ADM',
  CONCEPTO_VARIOS:        'ADM',
  FINANCIADO:             'ADM',
  'OTR-ING':              'ADM',
  'OTR-EGR':              'ADM',
  MAN:                    'ADM',
  SERV:                   'ADM',
  SUE:                    'ADM',
  COM:                    'ADM',
  'ING-BUF':              'BUFFET',
}

async function run() {
  await client.connect()
  console.log(`\n=== Asignando centros de costo — tenant ${TENANT_ID} ===\n`)

  // Obtener todos los CC del tenant indexados por código
  const { rows: centros } = await client.query(
    'SELECT id, codigo FROM centros_costo WHERE tenant_id = $1',
    [TENANT_ID]
  )
  const ccPorCodigo = Object.fromEntries(centros.map(c => [c.codigo, c.id]))
  console.log('Centros disponibles:', Object.keys(ccPorCodigo).join(', '))

  // Verificar que todos los CC requeridos existen; crear faltantes
  const ccRequeridos = [...new Set([...Object.values(ACTIVIDAD_A_CC), ...Object.values(CONCEPTO_A_CC)])]
  for (const codigo of ccRequeridos) {
    if (!ccPorCodigo[codigo]) {
      const NOMBRES = {
        FUS: 'Futsal', TAE: 'Taekwondo', HOC: 'Hockey',
        TEN: 'Tenis', PAD: 'Paddle', NAT: 'Natación', GIM: 'Gimnasia',
        ADM: 'Administración', BUFFET: 'Buffet', FUT: 'Fútbol',
        BAS: 'Básquet', VOL: 'Vóley',
      }
      const nombre = NOMBRES[codigo] || codigo
      const { rows: [nuevo] } = await client.query(
        `INSERT INTO centros_costo (tenant_id, codigo, nombre, tipo, orden, activo, created_at, updated_at)
         VALUES ($1, $2, $3, 'OPERATIVO', 99, true, NOW(), NOW())
         RETURNING id, codigo`,
        [TENANT_ID, codigo, nombre]
      )
      ccPorCodigo[codigo] = nuevo.id
      console.log(`  [NUEVO CC] ${codigo} (${nombre}) → id ${nuevo.id}`)
    }
  }

  // 1. Actividades
  const { rows: actividades } = await client.query(
    'SELECT id, codigo FROM actividades WHERE tenant_id = $1 AND centro_costo_id IS NULL',
    [TENANT_ID]
  )
  let actUpdated = 0
  for (const act of actividades) {
    const ccCodigo = ACTIVIDAD_A_CC[act.codigo]
    if (ccCodigo && ccPorCodigo[ccCodigo]) {
      await client.query(
        'UPDATE actividades SET centro_costo_id = $1 WHERE id = $2',
        [ccPorCodigo[ccCodigo], act.id]
      )
      actUpdated++
    } else {
      console.warn(`  [SIN MAPEO] Actividad ${act.codigo} — asignar manualmente`)
    }
  }
  console.log(`Actividades: ${actUpdated} actualizadas (${actividades.length} estaban sin CC)`)

  // 2. Conceptos de tesorería
  const { rows: conceptos } = await client.query(
    'SELECT id, codigo FROM conceptos_tesoreria WHERE tenant_id = $1 AND centro_costo_id IS NULL',
    [TENANT_ID]
  )
  let ctUpdated = 0
  for (const ct of conceptos) {
    const ccCodigo = CONCEPTO_A_CC[ct.codigo]
    if (ccCodigo && ccPorCodigo[ccCodigo]) {
      await client.query(
        'UPDATE conceptos_tesoreria SET centro_costo_id = $1 WHERE id = $2',
        [ccPorCodigo[ccCodigo], ct.id]
      )
      ctUpdated++
    } else {
      console.warn(`  [SIN MAPEO] Concepto ${ct.codigo} — asignar manualmente`)
    }
  }
  console.log(`Conceptos tesorería: ${ctUpdated} actualizados (${conceptos.length} estaban sin CC)`)

  // 3. Cargos: propagar desde concepto_tesoreria
  const { rowCount: cargosUpdated } = await client.query(`
    UPDATE cargos c
    SET centro_costo_id = ct.centro_costo_id
    FROM conceptos_tesoreria ct
    WHERE ct.id = c.concepto_tesoreria_id
      AND c.tenant_id = $1
      AND c.centro_costo_id IS NULL
      AND ct.centro_costo_id IS NOT NULL
  `, [TENANT_ID])
  console.log(`Cargos: ${cargosUpdated} actualizados`)

  // 4. Inscripciones: propagar desde actividad via categoria_actividad
  const { rowCount: inscUpdated } = await client.query(`
    UPDATE inscripciones i
    SET centro_costo_id = a.centro_costo_id
    FROM categorias_actividad ca
    JOIN actividades a ON a.id = ca.actividad_id
    WHERE ca.id = i.categoria_actividad_id
      AND i.tenant_id = $1
      AND i.centro_costo_id IS NULL
      AND a.centro_costo_id IS NOT NULL
  `, [TENANT_ID])
  console.log(`Inscripciones: ${inscUpdated} actualizadas`)

  // 5. Pedidos takeaway → BUFFET
  const buffetId = ccPorCodigo['BUFFET']
  if (buffetId) {
    const { rowCount: taUpdated } = await client.query(
      'UPDATE pedidos_takeaway SET centro_costo_id = $1 WHERE tenant_id = $2 AND centro_costo_id IS NULL',
      [buffetId, TENANT_ID]
    )
    console.log(`Pedidos takeaway: ${taUpdated} actualizados → BUFFET`)
  }

  // Verificación final
  console.log('\n=== Verificación final ===')
  const tablas = [
    ['actividades', 'tenant_id'],
    ['conceptos_tesoreria', 'tenant_id'],
    ['cargos', 'tenant_id'],
    ['inscripciones', 'tenant_id'],
    ['pedidos_takeaway', 'tenant_id'],
  ]
  for (const [tabla, col] of tablas) {
    const { rows: [r] } = await client.query(
      `SELECT COUNT(*) FILTER (WHERE centro_costo_id IS NULL) AS sin_cc, COUNT(*) AS total FROM ${tabla} WHERE ${col} = $1`,
      [TENANT_ID]
    )
    const status = r.sin_cc === '0' ? '✓' : '✗'
    console.log(`  ${status} ${tabla}: ${r.sin_cc} sin CC / ${r.total} total`)
  }

  await client.end()
  console.log('\nListo.')
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
