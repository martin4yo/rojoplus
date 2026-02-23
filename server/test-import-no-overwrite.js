import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

async function probarOmitir() {
  try {
    // 1. Login
    console.log('🔐 Autenticando...');
    const loginRes = await axios.post('http://localhost:3001/api/admin/login', {
      email: 'admin@rojoplus.com',
      password: 'admin123'
    });

    const token = loginRes.data.data.token;
    console.log('✅ Token obtenido\n');

    // 2. Importar SIN sobreescribir (debe omitir los existentes)
    console.log('📤 Importando archivo CSV (SIN sobreescribir)...');
    const form = new FormData();
    form.append('archivo', fs.createReadStream('test_import.csv'));
    // NO enviar sobreescribir o enviarlo explícitamente como false

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

    if (resultado.detalleOmitidos && resultado.detalleOmitidos.length > 0) {
      console.log('\n⏭️  Productos omitidos (ya existen):');
      resultado.detalleOmitidos.forEach(item => {
        console.log(`  • [${item.codigo}] ${item.nombre}`);
        console.log(`    Motivo: ${item.motivo}`);
      });
    }

  } catch (err) {
    console.error('❌ Error:', err.response?.data || err.message);
    process.exit(1);
  }
}

probarOmitir();
