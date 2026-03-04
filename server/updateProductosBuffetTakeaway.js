import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  host: 'localhost',
  port: 5434,
  database: 'rojoplus_db',
  user: 'postgres',
  password: 'Q27G4B98'
});

async function updateProductos() {
  try {
    console.log('🔌 Conectando a la base de datos de producción...\n');
    await client.connect();
    console.log('   ✓ Conectado a BD Producción (puerto 5434)\n');

    console.log('🔄 Actualizando productos ALM para estar disponibles en BUFFET y TAKEAWAY...\n');

    // Actualizar tipos_venta para que incluya BUFFET y TAKEAWAY
    const result = await client.query(`
      UPDATE productos_buffet
      SET tipos_venta = ARRAY['BUFFET', 'TAKEAWAY']::text[],
          updated_at = NOW()
      WHERE producto_id IN (
        SELECT id FROM productos WHERE codigo LIKE 'ALM%'
      )
      RETURNING id, nombre, tipos_venta
    `);

    console.log(`✅ Productos actualizados: ${result.rowCount}\n`);

    console.log('📋 Verificación (primeros 10 productos):\n');
    result.rows.slice(0, 10).forEach((row, idx) => {
      console.log(`   ${idx + 1}. ${row.nombre}`);
      console.log(`      → ${row.tipos_venta.join(', ')}`);
    });

    console.log('\n🎉 ¡Actualización completada!\n');
    console.log('Los productos ahora están disponibles en BUFFET y TAKEAWAY\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Conexión cerrada\n');
  }
}

updateProductos();
