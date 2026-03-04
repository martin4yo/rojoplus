import pkg from 'pg';
const { Client } = pkg;
import XLSX from 'xlsx';

const client = new Client({
  host: 'localhost',
  port: 5434,
  database: 'rojoplus_db',
  user: 'postgres',
  password: 'Q27G4B98'
});

// Mapeo de categorías del Excel a códigos de categorías en BD
const mapeoCategoriasExcelABD = {
  'Gaseosas': 'GASE',
  'Aguas saborizadas y Jugos': 'AGJU',
  'Bebidas con Alcohol': 'ALCO'
};

async function crearMovimientoStock() {
  try {
    console.log('🔌 Conectando a la base de datos de producción...\n');
    await client.connect();
    console.log('   ✓ Conectado a BD Producción (puerto 5434)\n');

    // Leer archivo Excel
    console.log('📖 Leyendo archivo Excel...\n');
    const archivo = '../Presupuesto_25134_Analisis.xlsx';
    const workbook = XLSX.readFile(archivo);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const datos = XLSX.utils.sheet_to_json(sheet);

    console.log(`📊 Total de filas: ${datos.length}\n`);

    // Obtener ID del admin que registra (primer superadmin)
    const adminRes = await client.query(`
      SELECT a.id FROM admins a
      JOIN roles r ON a.rol_id = r.id
      WHERE r.es_super_admin = true
      LIMIT 1
    `);
    const adminId = adminRes.rows[0]?.id;

    if (!adminId) {
      throw new Error('No se encontró un administrador para registrar el movimiento');
    }

    console.log(`✓ Movimiento registrado por admin ID: ${adminId}\n`);

    let variantesCreadas = 0;
    let movimientosCreados = 0;
    let sinCategoria = 0;

    console.log('📦 Procesando productos...\n');

    for (const row of datos) {
      // Saltar la fila de totales
      if (!row['Código'] || row['Código'] === 'TOTALES') {
        continue;
      }

      const categoriaExcel = row['Categoría Menú'];
      const codigoCategoria = mapeoCategoriasExcelABD[categoriaExcel];

      if (!codigoCategoria) {
        sinCategoria++;
        continue;
      }

      const codigo = `ALM${row['Código']}`;
      const cantidad = row['Cant Unidades Total'] || 0;
      const precioCosto = row['Precio Unitario'] || 0;

      if (cantidad <= 0) {
        console.log(`   ⊗ "${row['Descripción']}" (${codigo}) - Sin cantidad`);
        continue;
      }

      // Obtener producto
      const productoRes = await client.query(
        'SELECT id FROM productos WHERE codigo = $1',
        [codigo]
      );

      if (productoRes.rows.length === 0) {
        console.log(`   ⊗ "${row['Descripción']}" (${codigo}) - Producto no encontrado`);
        continue;
      }

      const productoId = productoRes.rows[0].id;

      // Verificar si ya existe variante
      const varianteExiste = await client.query(
        'SELECT id, stock_actual FROM producto_variantes WHERE producto_id = $1',
        [productoId]
      );

      let varianteId;
      let stockAnterior = 0;

      if (varianteExiste.rows.length > 0) {
        varianteId = varianteExiste.rows[0].id;
        stockAnterior = Number(varianteExiste.rows[0].stock_actual) || 0;
      } else {
        // Crear variante
        const varianteRes = await client.query(
          `INSERT INTO producto_variantes
           (producto_id, talle, stock_actual, stock_minimo, precio_costo, activo, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           RETURNING id`,
          [productoId, 'UNICO', 0, 0, precioCosto, true]
        );
        varianteId = varianteRes.rows[0].id;
        stockAnterior = 0;
        variantesCreadas++;
      }

      const stockPosterior = stockAnterior + cantidad;

      // Crear movimiento de stock
      await client.query(
        `INSERT INTO movimientos_stock
         (producto_variante_id, fecha, tipo, cantidad, stock_anterior, stock_posterior,
          concepto, registrado_por, created_at)
         VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, NOW())`,
        [
          varianteId,
          'INGRESO',
          cantidad,
          stockAnterior,
          stockPosterior,
          `Ingreso inicial - Presupuesto 25134`,
          adminId
        ]
      );

      // Actualizar stock de la variante
      await client.query(
        'UPDATE producto_variantes SET stock_actual = $1 WHERE id = $2',
        [stockPosterior, varianteId]
      );

      console.log(`   ✓ "${row['Descripción']}" (${codigo})`);
      console.log(`      Stock: ${stockAnterior} → ${stockPosterior} (+${cantidad} unidades)`);

      movimientosCreados++;
    }

    console.log(`\n📊 Resumen:`);
    console.log(`   ✓ Variantes creadas: ${variantesCreadas}`);
    console.log(`   ✓ Movimientos de stock creados: ${movimientosCreados}`);
    console.log(`   ⚠ Sin categoría: ${sinCategoria}\n`);

    console.log('🎉 ¡Movimiento de stock registrado exitosamente!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Conexión cerrada\n');
  }
}

crearMovimientoStock();
