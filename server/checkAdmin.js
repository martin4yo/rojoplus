import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  host: 'localhost',
  port: 5434,
  database: 'rojoplus_db',
  user: 'postgres',
  password: 'Q27G4B98'
});

await client.connect();

// Ver admin
const admin = await client.query(`
  SELECT a.*, r.codigo as rol_codigo, r.es_super_admin
  FROM admins a
  LEFT JOIN roles r ON a.rol_id = r.id
  ORDER BY a.id
`);

console.log('Usuarios admin en PRODUCCIÓN:');
admin.rows.forEach(a => {
  console.log(`\nID: ${a.id}`);
  console.log(`Email: ${a.email}`);
  console.log(`Nombre: ${a.nombre} ${a.apellido || ''}`);
  console.log(`Rol ID: ${a.rol_id}`);
  console.log(`Rol: ${a.rol_codigo}`);
  console.log(`Es Super Admin: ${a.es_super_admin}`);
  console.log(`Activo: ${a.activo}`);
});

await client.end();
