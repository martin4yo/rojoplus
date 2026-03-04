import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  host: 'localhost',
  port: 5434,
  database: 'rojoplus_db',
  user: 'postgres',
  password: 'Q27G4B98'
});

async function seedMesas() {
  try {
    console.log('🔌 Conectando a la base de datos de producción...\n');
    await client.connect();
    console.log('   ✓ Conectado a BD Producción (puerto 5434)\n');

    console.log('🪑 Creando 50 mesas para el buffet...\n');

    let creadas = 0;
    let existentes = 0;

    for (let i = 1; i <= 50; i++) {
      // Formatear número con 3 dígitos (001, 002, ..., 050)
      const nombre = i.toString().padStart(3, '0');

      // Verificar si ya existe
      const existe = await client.query(
        'SELECT id FROM mesas WHERE numero = $1',
        [i]
      );

      if (existe.rows.length > 0) {
        console.log(`   ⊗ Mesa ${nombre} - Ya existe`);
        existentes++;
      } else {
        // Insertar nueva mesa
        await client.query(
          `INSERT INTO mesas
           (numero, nombre, capacidad, estado, activo, es_comunal, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
          [
            i,            // numero
            nombre,       // nombre (001, 002, etc.)
            4,            // capacidad (4 personas por defecto)
            'LIBRE',      // estado
            true,         // activo
            false         // es_comunal
          ]
        );
        console.log(`   ✓ Mesa ${nombre} - Creada (capacidad: 4, estado: LIBRE)`);
        creadas++;
      }
    }

    console.log(`\n📊 Resumen:`);
    console.log(`   ✓ Mesas creadas: ${creadas}`);
    console.log(`   ⊗ Ya existían: ${existentes}`);
    console.log(`   🪑 Total: ${creadas + existentes}\n`);

    console.log('🎉 ¡Proceso completado!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Conexión cerrada\n');
  }
}

seedMesas();
