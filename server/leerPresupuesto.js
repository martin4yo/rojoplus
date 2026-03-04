import XLSX from 'xlsx';

const archivo = '../Presupuesto_25134_Analisis.xlsx';

console.log('📖 Leyendo archivo Excel...\n');

const workbook = XLSX.readFile(archivo);
const sheetName = workbook.SheetNames[0]; // Primera hoja
const sheet = workbook.Sheets[sheetName];

// Convertir a JSON
const datos = XLSX.utils.sheet_to_json(sheet);

console.log(`📊 Total de filas: ${datos.length}\n`);
console.log('🔍 Primeras 3 filas para ver estructura:\n');
console.log(JSON.stringify(datos.slice(0, 3), null, 2));

console.log('\n📋 Columnas disponibles:\n');
if (datos.length > 0) {
  console.log(Object.keys(datos[0]));
}

// Mostrar todos los productos con sus categorías
console.log('\n🍽️ Productos encontrados:\n');

const categorias = {};

datos.forEach((prod, idx) => {
  const categoria = prod['Categoría Menú'] || 'Sin categoría';

  if (!categorias[categoria]) {
    categorias[categoria] = [];
  }

  categorias[categoria].push({
    codigo: prod['Código'],
    descripcion: prod['Descripción'],
    precioUnitario: prod['Precio Unitario']
  });
});

console.log('📊 Resumen por categoría:\n');
Object.keys(categorias).forEach(cat => {
  console.log(`\n${cat}: ${categorias[cat].length} productos`);
  categorias[cat].forEach(p => {
    console.log(`  - ALM${p.codigo} | ${p.descripcion} | $${p.precioUnitario}`);
  });
});
