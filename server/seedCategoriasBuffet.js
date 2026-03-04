import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  host: 'localhost',
  port: 5434,
  database: 'rojoplus_db',
  user: 'postgres',
  password: 'Q27G4B98'
});

const categorias = [
  // Comidas
  { codigo: 'SAND', nombre: 'Sandwiches y Hamburguesas', descripcion: 'Sandwiches, hamburguesas y lomitos', icono: 'Sandwich', color: '#F59E0B', orden: 1 },
  { codigo: 'PIZZ', nombre: 'Pizzas', descripcion: 'Pizzas y fugazzas', icono: 'Pizza', color: '#EF4444', orden: 2 },
  { codigo: 'EMPA', nombre: 'Empanadas', descripcion: 'Empanadas de carne, pollo, jamón y queso', icono: 'Croissant', color: '#D97706', orden: 3 },
  { codigo: 'MINU', nombre: 'Minutas', descripcion: 'Milanesas, papas fritas, salchichas, etc.', icono: 'UtensilsCrossed', color: '#DC2626', orden: 4 },
  { codigo: 'ENSA', nombre: 'Ensaladas', descripcion: 'Ensaladas y guarniciones', icono: 'Salad', color: '#10B981', orden: 5 },
  { codigo: 'POST', nombre: 'Postres', descripcion: 'Postres y dulces', icono: 'IceCream', color: '#EC4899', orden: 6 },

  // Bebidas
  { codigo: 'GASE', nombre: 'Gaseosas', descripcion: 'Coca Cola, Sprite, Fanta, etc.', icono: 'Wine', color: '#EF4444', orden: 7 },
  { codigo: 'AGJU', nombre: 'Aguas y Jugos', descripcion: 'Aguas saborizadas y jugos naturales', icono: 'Droplet', color: '#3B82F6', orden: 8 },
  { codigo: 'ALCO', nombre: 'Bebidas con Alcohol', descripcion: 'Cervezas, vinos, tragos', icono: 'Wine', color: '#7C3AED', orden: 9 },
  { codigo: 'CAFE', nombre: 'Cafetería', descripcion: 'Café, té, lágrima, submarino', icono: 'Coffee', color: '#92400E', orden: 10 },

  // Otros
  { codigo: 'GOLO', nombre: 'Golosinas y Snacks', descripcion: 'Golosinas, papas fritas, snacks', icono: 'Candy', color: '#F97316', orden: 11 },
  { codigo: 'PANI', nombre: 'Panificados', descripcion: 'Medialunas, facturas, tostados', icono: 'Croissant', color: '#F59E0B', orden: 12 },
  { codigo: 'HELA', nombre: 'Helados', descripcion: 'Helados y cucuruchos', icono: 'IceCream', color: '#06B6D4', orden: 13 },
  { codigo: 'COMB', nombre: 'Combos/Promos', descripcion: 'Combos y promociones especiales', icono: 'Tag', color: '#10B981', orden: 14 },
  { codigo: 'DESA', nombre: 'Desayuno/Merienda', descripcion: 'Opciones para desayuno y merienda', icono: 'Coffee', color: '#F97316', orden: 15 }
];

async function seedCategorias() {
  try {
    console.log('🔌 Conectando a la base de datos...\n');
    await client.connect();
    console.log('   ✓ Conectado a BD Producción (puerto 5434)\n');

    console.log('📦 Creando categorías de buffet...\n');

    let creadas = 0;
    let existentes = 0;

    for (const cat of categorias) {
      // Verificar si ya existe por código
      const existe = await client.query(
        'SELECT id FROM categorias_menu WHERE codigo = $1',
        [cat.codigo]
      );

      if (existe.rows.length > 0) {
        console.log(`   ⊗ "${cat.nombre}" (${cat.codigo}) - Ya existe`);
        existentes++;
      } else {
        // Insertar nueva categoría
        await client.query(
          `INSERT INTO categorias_menu
           (codigo, nombre, descripcion, icono, color, orden, activo, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
          [cat.codigo, cat.nombre, cat.descripcion, cat.icono, cat.color, cat.orden, true]
        );
        console.log(`   ✓ "${cat.nombre}" (${cat.codigo}) - Creada`);
        creadas++;
      }
    }

    console.log(`\n📊 Resumen:`);
    console.log(`   ✓ Categorías creadas: ${creadas}`);
    console.log(`   ⊗ Ya existían: ${existentes}`);
    console.log(`   📦 Total: ${creadas + existentes}\n`);

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

seedCategorias();
