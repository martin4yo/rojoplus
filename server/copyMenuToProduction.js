import pkg from 'pg';
const { Client } = pkg;

// Configuración de las bases de datos
const dbLocal = {
  host: 'localhost',
  port: 5432,
  database: 'rojoplus',
  user: 'postgres',
  password: 'Q27G4B98'
};

const dbProduccion = {
  host: 'localhost',
  port: 5434,
  database: 'rojoplus_db',
  user: 'postgres',
  password: 'Q27G4B98'
};

async function syncMenuTables() {
  const clientLocal = new Client(dbLocal);
  const clientProd = new Client(dbProduccion);

  try {
    console.log('🔌 Conectando a las bases de datos...\n');

    await clientLocal.connect();
    console.log('   ✓ Conectado a BD Local (puerto 5432)');

    await clientProd.connect();
    console.log('   ✓ Conectado a BD Producción (puerto 5434)\n');

    // 1. Obtener datos de ambas bases
    console.log('📊 Comparando datos...');

    const menuItemsLocal = await clientLocal.query('SELECT * FROM menu_items ORDER BY id');
    const menuItemsProd = await clientProd.query('SELECT * FROM menu_items ORDER BY id');

    const idsLocal = new Set(menuItemsLocal.rows.map(r => r.id));
    const idsProd = new Set(menuItemsProd.rows.map(r => r.id));

    const nuevoItems = menuItemsLocal.rows.filter(item => !idsProd.has(item.id));

    console.log(`   ✓ Items en Local: ${menuItemsLocal.rows.length}`);
    console.log(`   ✓ Items en Producción: ${menuItemsProd.rows.length}`);
    console.log(`   ✓ Items nuevos a copiar: ${nuevoItems.length}\n`);

    if (nuevoItems.length === 0) {
      console.log('✅ No hay items nuevos para copiar. Bases de datos sincronizadas.\n');
      return;
    }

    // 2. Insertar items nuevos
    console.log('📤 Insertando items nuevos...');

    let insertados = 0;
    for (const item of nuevoItems) {
      try {
        await clientProd.query(`
          INSERT INTO menu_items (
            id, parent_id, titulo, icono, url, descripcion,
            orden, activo, solo_super_admin, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO NOTHING
        `, [
          item.id,
          item.parent_id,
          item.titulo,
          item.icono,
          item.url,
          item.descripcion,
          item.orden,
          item.activo,
          item.solo_super_admin,
          item.created_at,
          item.updated_at
        ]);
        insertados++;
        console.log(`   ✓ Item ${item.id}: "${item.titulo}"`);
      } catch (err) {
        console.log(`   ✗ Error en item ${item.id}: ${err.message}`);
      }
    }

    console.log(`\n   Total insertado: ${insertados} items\n`);

    // 3. Sincronizar relaciones menu_items_roles
    console.log('🔗 Sincronizando relaciones menú-rol...');

    const menuItemsRolesLocal = await clientLocal.query('SELECT * FROM menu_items_roles');
    const menuItemsRolesProd = await clientProd.query('SELECT * FROM menu_items_roles');

    const relLocal = new Set(menuItemsRolesLocal.rows.map(r => `${r.menu_item_id}-${r.rol_id}`));
    const relProd = new Set(menuItemsRolesProd.rows.map(r => `${r.menu_item_id}-${r.rol_id}`));

    const nuevasRel = menuItemsRolesLocal.rows.filter(
      r => !relProd.has(`${r.menu_item_id}-${r.rol_id}`)
    );

    console.log(`   ✓ Relaciones en Local: ${menuItemsRolesLocal.rows.length}`);
    console.log(`   ✓ Relaciones en Producción: ${menuItemsRolesProd.rows.length}`);
    console.log(`   ✓ Relaciones nuevas a copiar: ${nuevasRel.length}\n`);

    if (nuevasRel.length > 0) {
      let relacionesInsertadas = 0;
      for (const rel of nuevasRel) {
        try {
          await clientProd.query(`
            INSERT INTO menu_items_roles (menu_item_id, rol_id)
            VALUES ($1, $2)
            ON CONFLICT (menu_item_id, rol_id) DO NOTHING
          `, [rel.menu_item_id, rel.rol_id]);
          relacionesInsertadas++;
        } catch (err) {
          console.log(`   ✗ Error en relación ${rel.menu_item_id}-${rel.rol_id}: ${err.message}`);
        }
      }
      console.log(`   ✓ ${relacionesInsertadas} relaciones insertadas\n`);
    }

    // 4. Actualizar secuencia de IDs
    console.log('🔄 Actualizando secuencia de IDs...');

    const maxId = await clientProd.query('SELECT MAX(id) as max_id FROM menu_items');
    const nextId = (maxId.rows[0].max_id || 0) + 1;

    await clientProd.query(`SELECT setval('menu_items_id_seq', $1, false)`, [nextId]);
    console.log(`   ✓ Secuencia actualizada (próximo ID: ${nextId})\n`);

    // 5. Verificar resultado final
    console.log('✅ Verificando sincronización...');

    const finalMenuItems = await clientProd.query('SELECT COUNT(*) FROM menu_items');
    const finalMenuItemsRoles = await clientProd.query('SELECT COUNT(*) FROM menu_items_roles');

    console.log(`   ✓ Items en producción: ${finalMenuItems.rows[0].count}`);
    console.log(`   ✓ Relaciones en producción: ${finalMenuItemsRoles.rows[0].count}\n`);

    console.log('🎉 ¡Sincronización completada exitosamente!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await clientLocal.end();
    await clientProd.end();
    console.log('🔌 Conexiones cerradas\n');
  }
}

// Ejecutar
syncMenuTables();
