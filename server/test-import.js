import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

async function probarImportacion() {
  try {
    // 1. Login como admin
    console.log('🔐 Autenticando como admin...');
    const loginRes = await axios.post('http://localhost:3001/api/admin/login', {
      email: 'admin@rojoplus.com',
      password: 'admin123'
    });

    console.log('Respuesta login:', JSON.stringify(loginRes.data, null, 2));
    const token = loginRes.data.token || loginRes.data.data?.token;
    console.log('✅ Token obtenido');
    console.log('Token (primeros 50 chars):', token?.substring(0, 50) + '...\n');

    // 2. Importar archivo
    console.log('📤 Importando archivo CSV...');
    const form = new FormData();
    form.append('archivo', fs.createReadStream('test_import.csv'));
    form.append('sobreescribir', 'false');

    const importRes = await axios.post(
      'http://localhost:3001/api/importacion/productos',
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log('✅ Importación completada\n');
    console.log('📊 RESULTADO:');
    console.log('='.repeat(60));
    const resultado = importRes.data.resultado;
    console.log(`Total registros:     ${resultado.total}`);
    console.log(`✅ Exitosos:         ${resultado.exitosos}`);
    console.log(`❌ Errores:          ${resultado.errores}`);
    console.log(`⚠️  Advertencias:     ${resultado.advertencias}`);
    console.log(`⏭️  Omitidos:         ${resultado.omitidos}`);

    if (resultado.detalleExitosos && resultado.detalleExitosos.length > 0) {
      console.log('\n✅ Productos creados:');
      resultado.detalleExitosos.forEach(item => {
        console.log(`  • [${item.codigo}] ${item.nombre} - ${item.accion.toUpperCase()}`);
      });
    }

    if (resultado.detalleErrores && resultado.detalleErrores.length > 0) {
      console.log('\n❌ Errores:');
      resultado.detalleErrores.forEach(item => {
        console.log(`  • Fila ${item.fila}: ${item.error}`);
      });
    }

    if (resultado.detalleOmitidos && resultado.detalleOmitidos.length > 0) {
      console.log('\n⏭️  Productos omitidos:');
      resultado.detalleOmitidos.forEach(item => {
        console.log(`  • [${item.codigo}] ${item.nombre} - ${item.motivo}`);
      });
    }

  } catch (err) {
    console.error('❌ Error:', err.response?.data || err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Headers:', err.response.headers);
    }
    process.exit(1);
  }
}

probarImportacion();
