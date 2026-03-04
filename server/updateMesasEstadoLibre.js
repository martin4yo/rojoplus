import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  host: 'localhost',
  port: 5434,
  database: 'rojoplus_db',
  user: 'postgres',
  password: 'Q27G4B98'
});

async function updateMesas() {
  try {
    console.log('🔌 Conectando a la base de datos de producción...\n');
    await client.connect();
    console.log('   ✓ Conectado a BD Producción (puerto 5434)\n');

    console.log('🔄 Actualizando estado de mesas a LIBRE...\n');

    const result = await client.query(`
      UPDATE mesas
      SET estado = 'LIBRE',
          updated_at = NOW()
      WHERE numero >= 1 AND numero <= 50
      RETURNING numero, nombre, estado
    `);

    console.log(`✅ Mesas actualizadas: ${result.rowCount}\n`);

    console.log('📋 Verificación (primeras 10 mesas):\n');
    result.rows.slice(0, 10).forEach(row => {
      console.log(`   Mesa ${row.nombre}: ${row.estado}`);
    });

    console.log('\n🎉 ¡Actualización completada!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Conexión cerrada\n');
  }
}

updateMesas();
