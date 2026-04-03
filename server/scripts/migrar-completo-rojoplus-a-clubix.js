/**
 * Migración completa: rojoplus_db → clubix_db (tenant sportivopilar, tenant_id=1)
 * Node.js con dos conexiones directas (sin dblink).
 *
 * Uso: node server/scripts/migrar-completo-rojoplus-a-clubix.js
 */

import pg from 'pg'

const { Pool } = pg

const TENANT_ID = 1

const poolRojo = new Pool({ host: 'localhost', port: 5434, database: 'rojoplus_db', user: 'postgres', password: 'Q27G4B98' })
const poolClub = new Pool({ host: 'localhost', port: 5434, database: 'clubix_db',   user: 'postgres', password: 'Q27G4B98' })

// Tablas solo en clubix (sin equivalente en rojoplus) → saltar
const SOLO_CLUBIX = new Set([
  'acciones_cobranza','acciones_recupero','bloqueos_espacio',
  'campanas_comunicacion','campanas_recupero','config_reserva_espacio',
  'encuestas_baja','envios_campana','gestiones_cobranza','reservas_espacio',
])

// Orden de DELETE para evitar problemas de FK (hijos antes que padres)
const ORDEN_DELETE = [
  'opciones_item_comanda','opciones_item_takeaway',
  'items_comanda','items_pedido_takeaway',
  'notificaciones_buffet',
  'comandas','pedidos_takeaway',
  'asiento_lineas','asientos',
  'detalles_cobranza','detalles_debito',
  'aplicaciones_saldo','saldos_favor',
  'movimientos_contables','movimientos_extracto',
  'movimientos_caja','transferencias_caja','cierres_caja',
  'comprobantes_electronicos',
  'links_pago','pagos_informados','pagos',
  'items_liquidacion','liquidaciones_sueldo',
  'items_movimiento','items_orden_compra','ordenes_compra','lineas_presupuesto','presupuestos',
  'movimientos_stock','producto_fotos','producto_variantes','productos_buffet',
  'grupos_opcion_producto','opciones_producto',
  'items_pedido','pedidos','ventas',
  'ingresos_entradas','entradas',
  'conciliaciones','extractos_bancarios',
  'archivos_debito','echeqs',
  'cargos','periodos','inscripciones',
  'audit_log','notificaciones_log','notificaciones_vistas',
  'asistencias','entrenamientos',
  'estadisticas_partidos','staff_tecnico','partidos',
  'entrenadores_categorias','entrenadores',
  'mensajes_entrenador','mensajes','conversaciones',
  'adjuntos_comprobantes',
  'documentos_socio','autorizaciones_menores',
  'aceptaciones_reglamento','articulos_reglamento',
  'familiares_solicitud','solicitudes_socio',
  'habilitaciones_temporales','intentos_acceso_denegado',
  'registros_acceso','dispositivos_acceso',
  'push_subscriptions','convocatorias','eventos',
  'banners','noticias','noticias_deportivas','sponsors','autoridades',
  'pdf_templates','email_templates',
  'descuentos_disponibles','estados_socio','socios',
  'entidades','cobradores','comercios','importaciones_cobranza',
  'cargos_personal','conceptos_liquidacion',
  'horarios_recurrentes','horarios_disponibilidad',
  'espacios_deportivos','tipos_espacio',
  'sectores_buffet','mesas',
  'productos','categorias_producto','categorias_menu',
  'categorias_actividad','actividades',
  'categorias_socio','tipos_socio','categorias_entrada',
  'centros_costo','conceptos_tesoreria',
  'cuentas_bancarias','cuentas_contables',
  'configuracion_recargos','configuracion_fiscal','configuracion_debito','configuracion',
  'medios_pago','cajas',
  'destinos_impresion','impresoras_termicas','formatos_extracto',
]

async function getColumns(pool, table) {
  const { rows } = await pool.query(`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `, [table])
  return rows
}

async function getTables(pool) {
  const { rows } = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `)
  return new Set(rows.map(r => r.table_name))
}

async function getTablesWithTenantId(pool) {
  const { rows } = await pool.query(`
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t ON c.table_name = t.table_name AND t.table_schema = 'public'
    WHERE c.column_name = 'tenant_id' AND c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name NOT IN ('tenants','tenant_usuarios','tenant_configuracion')
  `)
  return new Set(rows.map(r => r.table_name))
}

// Convierte el valor JS al tipo correcto para pg
function castValue(val, pgType) {
  if (val === null || val === undefined) return null
  if (pgType === 'jsonb' || pgType === 'json') {
    return typeof val === 'string' ? val : JSON.stringify(val)
  }
  return val
}

async function main() {
  console.log('🔌 Conectando a ambas bases...')
  // Verificar conexiones
  await poolRojo.query('SELECT 1')
  await poolClub.query('SELECT 1')
  console.log('✅ Conectado a rojoplus_db y clubix_db')

  const tablasRojo = await getTables(poolRojo)
  const tablasConTenant = await getTablesWithTenantId(poolClub)

  // Tablas migrables: existen en ambas y tienen tenant_id en clubix
  const tablasMigrables = [...tablasConTenant].filter(t =>
    tablasRojo.has(t) && !SOLO_CLUBIX.has(t)
  )
  console.log(`\n📋 Tablas a migrar: ${tablasMigrables.length}`)

  // Precalcular columnas comunes para cada tabla
  console.log('🔍 Analizando columnas...')
  const mapColumnas = {} // tabla → { cols: string[], tipos: {col: pgType} }
  for (const tabla of tablasMigrables) {
    const colsRojo  = await getColumns(poolRojo, tabla)
    const colsClub  = await getColumns(poolClub, tabla)
    const setClub   = new Set(colsClub.map(c => c.column_name).filter(c => c !== 'tenant_id'))
    const comunes   = colsRojo.filter(c => setClub.has(c.column_name))
    const tipos     = {}
    for (const c of comunes) tipos[c.column_name] = c.data_type === 'jsonb' || c.data_type === 'json' ? 'jsonb' : c.data_type
    mapColumnas[tabla] = { cols: comunes.map(c => c.column_name), tipos }
  }

  // Deshabilitar FK
  console.log('\n⚙️  Deshabilitando FK triggers...')
  await poolClub.query('SET session_replication_role = replica')

  // ── DELETE ────────────────────────────────────────────────────────────────
  console.log('\n🗑️  Borrando datos de sportivopilar (tenant_id=1)...')
  const ordenDelete = [
    ...ORDEN_DELETE.filter(t => tablasConTenant.has(t)),
    ...[...tablasConTenant].filter(t => !ORDEN_DELETE.includes(t) && !SOLO_CLUBIX.has(t))
  ]
  for (const tabla of ordenDelete) {
    try {
      const { rowCount } = await poolClub.query(`DELETE FROM "${tabla}" WHERE tenant_id = $1`, [TENANT_ID])
      if (rowCount > 0) console.log(`   ✗ ${tabla}: ${rowCount} filas`)
    } catch (err) {
      console.error(`   ⚠️  ${tabla} (delete): ${err.message}`)
    }
  }

  // ── INSERT ────────────────────────────────────────────────────────────────
  console.log('\n📥 Insertando datos desde rojoplus_db...')

  // Orden de INSERT (padres antes que hijos) = reverso del delete, pero usamos las migrables
  const ordenInsert = [
    ...ORDEN_DELETE.slice().reverse().filter(t => tablasMigrables.includes(t)),
    ...tablasMigrables.filter(t => !ORDEN_DELETE.includes(t))
  ]

  const BATCH = 500

  for (const tabla of ordenInsert) {
    const info = mapColumnas[tabla]
    if (!info || info.cols.length === 0) {
      console.log(`   ⚠️  ${tabla}: sin columnas comunes, salteado`)
      continue
    }
    const { cols, tipos } = info

    // Leer todo desde rojoplus (no se espera que sean millones de filas)
    let filas
    try {
      const colsQ = cols.map(c => `"${c}"`).join(', ')
      const res = await poolRojo.query(`SELECT ${colsQ} FROM "${tabla}"`)
      filas = res.rows
    } catch (err) {
      console.error(`   ✗ ${tabla} (select): ${err.message}`)
      continue
    }

    if (filas.length === 0) {
      console.log(`   - ${tabla}: vacío`)
      continue
    }

    // Insertar en lotes
    const colsInsert = [...cols.map(c => `"${c}"`), '"tenant_id"'].join(', ')
    let insertados = 0
    let errCount   = 0

    for (let i = 0; i < filas.length; i += BATCH) {
      const lote = filas.slice(i, i + BATCH)
      // Construir VALUES multi-fila
      const placeholders = []
      const values = []
      let pi = 1
      for (const fila of lote) {
        const rowPH = cols.map(() => `$${pi++}`).concat([`$${pi++}`])
        placeholders.push(`(${rowPH.join(', ')})`)
        for (const col of cols) {
          values.push(castValue(fila[col], tipos[col]))
        }
        values.push(TENANT_ID)
      }
      try {
        const q = `INSERT INTO "${tabla}" (${colsInsert}) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`
        const r = await poolClub.query(q, values)
        insertados += r.rowCount
      } catch (err) {
        errCount++
        if (errCount <= 3) console.error(`   ✗ ${tabla} lote ${i}: ${err.message}`)
      }
    }
    console.log(`   ✓ ${tabla}: ${insertados}/${filas.length} filas${errCount ? ` (${errCount} errores de lote)` : ''}`)
  }

  // ── SECUENCIAS ────────────────────────────────────────────────────────────
  console.log('\n🔢 Reseteando secuencias...')
  const { rows: seqs } = await poolClub.query(`
    SELECT sequencename FROM pg_sequences WHERE schemaname = 'public'
  `)
  for (const { sequencename } of seqs) {
    const tabla = sequencename.replace(/_id_seq$/, '')
    if (!tablasConTenant.has(tabla)) continue
    try {
      await poolClub.query(`SELECT setval('${sequencename}', COALESCE((SELECT MAX(id) FROM "${tabla}"), 1))`)
    } catch (_) {}
  }
  console.log('   ✓ Secuencias OK')

  // ── NORMALIZAR MEDIO DE PAGO ──────────────────────────────────────────────
  // Movimientos de buffet sin medio_pago_id → asignar Efectivo del tenant
  console.log('\n💵 Asignando medio de pago Efectivo a movimientos sin medio de pago...')
  const { rows: mpEfectivo } = await poolClub.query(
    `SELECT id FROM medios_pago WHERE tenant_id = $1 AND codigo = 'EFECTIVO' LIMIT 1`, [TENANT_ID]
  )
  if (mpEfectivo.length > 0) {
    const { rowCount } = await poolClub.query(`
      UPDATE movimientos_caja mc
      SET medio_pago_id = $1
      FROM cajas c
      WHERE mc.caja_id = c.id
        AND mc.tenant_id = $2
        AND mc.medio_pago_id IS NULL
        AND mc.anulado = false
        AND c.para_buffet = true
    `, [mpEfectivo[0].id, TENANT_ID])
    console.log(`   ✓ ${rowCount} movimientos actualizados con Efectivo`)
  } else {
    console.log('   ⚠️  No se encontró medio de pago EFECTIVO para el tenant')
  }

  // ── REHABILITAR FK ────────────────────────────────────────────────────────
  await poolClub.query('SET session_replication_role = DEFAULT')

  // ── RESUMEN ───────────────────────────────────────────────────────────────
  console.log('\n📊 Resumen final (tenant_id=1):')
  for (const tabla of ['socios','inscripciones','pagos','cargos','cajas','medios_pago',
      'movimientos_caja','comandas','productos_buffet','mesas','configuracion',
      'entidades','centros_costo','categorias_menu','actividades']) {
    if (!tablasConTenant.has(tabla)) continue
    const { rows } = await poolClub.query(`SELECT count(*) FROM "${tabla}" WHERE tenant_id=$1`, [TENANT_ID])
    console.log(`   ${tabla}: ${rows[0].count}`)
  }

  console.log('\n✅ Migración completada')
  await poolRojo.end()
  await poolClub.end()
}

main().catch(async e => {
  await poolClub.query('SET session_replication_role = DEFAULT').catch(() => {})
  console.error('\n❌ Error fatal:', e.message)
  await poolRojo.end().catch(() => {})
  await poolClub.end().catch(() => {})
  process.exit(1)
})
