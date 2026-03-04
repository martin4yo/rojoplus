import pkg from 'pg';
const { Client } = pkg;

// Configuración: cambiar según el ambiente
// Local: port 5432, database 'rojoplus'
// Producción: port 5434, database 'rojoplus_db'
const AMBIENTE = process.env.AMBIENTE || 'local'; // 'local' o 'produccion'

const config = AMBIENTE === 'produccion' ? {
  host: 'localhost',
  port: 5434,
  database: 'rojoplus_db',
  user: 'postgres',
  password: 'Q27G4B98'
} : {
  host: 'localhost',
  port: 5432,
  database: 'rojoplus',
  user: 'postgres',
  password: 'Q27G4B98'
};

const client = new Client(config);

const MARGEN = 40; // 40%

async function updatePrecios() {
  try {
    console.log(`🔌 Conectando a la base de datos (${AMBIENTE})...\n`);
    await client.connect();
    console.log(`   ✓ Conectado a BD ${AMBIENTE === 'produccion' ? 'Producción' : 'Local'} (puerto ${config.port})\n`);

    console.log(`💰 Aplicando margen del ${MARGEN}% a productos ALM...\n`);

    // Obtener productos ALM
    const productos = await client.query(`
      SELECT p.id, p.codigo, p.nombre, p.precio_compra
      FROM productos p
      WHERE p.codigo LIKE 'ALM%'
      ORDER BY p.codigo
    `);

    console.log(`📦 Productos a actualizar: ${productos.rows.length}\n`);

    let actualizados = 0;

    for (const prod of productos.rows) {
      const precioCosto = Number(prod.precio_compra) || 0;
      const precioConMargen = precioCosto * (1 + MARGEN / 100);

      // Redondear a múltiplo de 100
      const precioVenta = Math.round(precioConMargen / 100) * 100;

      // Actualizar tabla productos
      await client.query(`
        UPDATE productos
        SET margen = $1,
            precio_venta = $2,
            updated_at = NOW()
        WHERE id = $3
      `, [MARGEN, precioVenta, prod.id]);

      // Actualizar variante
      await client.query(`
        UPDATE producto_variantes
        SET margen = $1,
            precio_venta = $2,
            precio_costo = $3
        WHERE producto_id = $4
      `, [MARGEN, precioVenta, precioCosto, prod.id]);

      // Actualizar productos_buffet
      await client.query(`
        UPDATE productos_buffet
        SET precio = $1,
            updated_at = NOW()
        WHERE producto_id = $2
      `, [precioVenta, prod.id]);

      console.log(`   ✓ ${prod.codigo} - ${prod.nombre.substring(0, 30)}`);
      console.log(`      Costo: $${precioCosto.toFixed(2)} → Venta: $${precioVenta} (${MARGEN}%)`);

      actualizados++;
    }

    console.log(`\n📊 Resumen:`);
    console.log(`   ✓ Productos actualizados: ${actualizados}`);
    console.log(`   💰 Margen aplicado: ${MARGEN}%\n`);

    // Mostrar algunos ejemplos
    const ejemplos = await client.query(`
      SELECT p.codigo, p.nombre, p.precio_compra, p.margen, p.precio_venta
      FROM productos p
      WHERE p.codigo LIKE 'ALM%'
      ORDER BY p.codigo
      LIMIT 10
    `);

    console.log('📋 Ejemplos de precios (primeros 10):');
    console.table(ejemplos.rows.map(p => ({
      codigo: p.codigo,
      nombre: p.nombre.substring(0, 28),
      costo: `$${Number(p.precio_compra).toFixed(2)}`,
      margen: `${p.margen}%`,
      venta: `$${p.precio_venta}`
    })));

    console.log('\n🎉 ¡Precios actualizados exitosamente!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Conexión cerrada\n');
  }
}

updatePrecios();
