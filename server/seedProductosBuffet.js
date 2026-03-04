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

async function seedProductosBuffet() {
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

    // Obtener IDs de categorías de la BD
    const categorias = await client.query(
      'SELECT id, codigo, nombre FROM categorias_menu WHERE codigo IN ($1, $2, $3)',
      ['GASE', 'AGJU', 'ALCO']
    );

    const categoriasPorCodigo = {};
    categorias.rows.forEach(cat => {
      categoriasPorCodigo[cat.codigo] = cat;
    });

    console.log('📦 Categorías encontradas en BD:\n');
    categorias.rows.forEach(cat => {
      console.log(`   ✓ ${cat.codigo} - ${cat.nombre} (ID: ${cat.id})`);
    });
    console.log('');

    console.log('🍽️ Insertando productos en buffet...\n');

    let creados = 0;
    let existentes = 0;
    let sinCategoria = 0;

    for (const row of datos) {
      // Saltar la fila de totales
      if (!row['Código'] || row['Código'] === 'TOTALES') {
        continue;
      }

      const categoriaExcel = row['Categoría Menú'];
      const codigoCategoria = mapeoCategoriasExcelABD[categoriaExcel];

      if (!codigoCategoria) {
        console.log(`   ⊗ "${row['Descripción']}" - Sin categoría mapeada (${categoriaExcel})`);
        sinCategoria++;
        continue;
      }

      const categoria = categoriasPorCodigo[codigoCategoria];
      if (!categoria) {
        console.log(`   ⊗ "${row['Descripción']}" - Categoría no encontrada en BD (${codigoCategoria})`);
        sinCategoria++;
        continue;
      }

      const codigo = `ALM${row['Código']}`;
      const descripcion = row['Descripción'];
      const precioCosto = row['Precio Unitario'];

      // Verificar si ya existe en productos
      const existeProducto = await client.query(
        'SELECT id FROM productos WHERE codigo = $1',
        [codigo]
      );

      let productoId;

      if (existeProducto.rows.length > 0) {
        productoId = existeProducto.rows[0].id;
        console.log(`   ⊗ Producto "${descripcion}" (${codigo}) - Ya existe en productos`);
        existentes++;
      } else {
        // Insertar en tabla productos primero
        const resultProducto = await client.query(
          `INSERT INTO productos
           (codigo, nombre, descripcion, precio_compra, precio_venta, margen, activo, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
           RETURNING id`,
          [
            codigo,
            descripcion,
            descripcion,
            precioCosto,
            0, // precio_venta lo dejamos en 0 por ahora
            0, // margen
            true
          ]
        );
        productoId = resultProducto.rows[0].id;

        // Ahora insertar en productos_buffet
        await client.query(
          `INSERT INTO productos_buffet
           (producto_id, categoria_menu_id, nombre, descripcion, precio, disponible, activo, tipos_venta, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
          [
            productoId,
            categoria.id,
            descripcion,
            descripcion,
            0, // precio lo dejamos en 0 por ahora
            true, // disponible
            true, // activo
            ['BUFFET', 'TAKEAWAY'] // Disponible en BUFFET y TAKEAWAY, NO en KIOSCO
          ]
        );
        console.log(`   ✓ "${descripcion}" (${codigo}) - ${categoria.nombre} - Costo: $${precioCosto}`);
        creados++;
      }
    }

    console.log(`\n📊 Resumen:`);
    console.log(`   ✓ Productos creados: ${creados}`);
    console.log(`   ⊗ Ya existían: ${existentes}`);
    console.log(`   ⚠ Sin categoría: ${sinCategoria}`);
    console.log(`   📦 Total procesado: ${creados + existentes + sinCategoria}\n`);

    console.log('🎉 ¡Proceso completado!\\n');

  } catch (error) {
    console.error('\\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Conexión cerrada\\n');
  }
}

seedProductosBuffet();
