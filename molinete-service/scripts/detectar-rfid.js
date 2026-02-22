/**
 * Script para detectar puertos seriales disponibles
 * Muestra todos los puertos COM disponibles para RFID
 *
 * Ejecutar: npm run detectar-rfid
 */

import { SerialPort } from 'serialport'

console.log('\n📡 Buscando puertos seriales...\n')

try {
  const ports = await SerialPort.list()

  if (ports.length === 0) {
    console.log('❌ No se encontraron puertos seriales\n')
    process.exit(0)
  }

  console.log(`✓ Encontrados ${ports.length} puertos seriales:\n`)

  ports.forEach((port, index) => {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`Puerto #${index + 1}`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`  Path:         ${port.path}`)
    console.log(`  Fabricante:   ${port.manufacturer || 'Desconocido'}`)
    console.log(`  Producto:     ${port.productId || 'N/A'}`)
    console.log(`  Vendor ID:    ${port.vendorId || 'N/A'}`)
    console.log(`  Serial:       ${port.serialNumber || 'N/A'}`)
    console.log(`  PnP ID:       ${port.pnpId || 'N/A'}`)
    console.log()
  })

  console.log(`\n💡 Para configurar el lector RFID, use el path en config.json:`)
  console.log(`
{
  "lectorRFID": {
    "puerto": "COM3",  // o el path correspondiente
    "baudRate": 9600,
    ...
  }
}
`)

  console.log(`\n📝 Notas:`)
  console.log(`   • La mayoría de lectores RFID usan 9600 baud`)
  console.log(`   • Algunos usan 115200 baud`)
  console.log(`   • Pruebe desconectando y reconectando el dispositivo para identificarlo\n`)

  // Opción interactiva para probar puerto
  console.log(`\n🔧 ¿Desea probar un puerto? (Ctrl+C para salir)`)
  console.log(`   Ingrese el número del puerto (1-${ports.length}): `)

  process.stdin.resume()
  process.stdin.setEncoding('utf8')

  process.stdin.once('data', async (text) => {
    const num = parseInt(text.trim())
    if (num >= 1 && num <= ports.length) {
      const port = ports[num - 1]
      await probarPuerto(port.path)
    } else {
      console.log('❌ Número de puerto inválido')
      process.exit(0)
    }
  })

} catch (error) {
  console.error(`❌ Error: ${error.message}\n`)
  process.exit(1)
}

/**
 * Probar comunicación con un puerto
 */
async function probarPuerto(path) {
  console.log(`\n🔌 Probando ${path}...`)
  console.log(`   Acerque una tarjeta RFID al lector...\n`)

  try {
    const port = new SerialPort({
      path: path,
      baudRate: 9600
    })

    port.on('data', (data) => {
      console.log(`📨 Datos recibidos: ${data.toString('hex')} (hex)`)
      console.log(`   ASCII: ${data.toString('ascii')}`)
      console.log(`   UTF-8: ${data.toString('utf8')}\n`)
    })

    port.on('error', (err) => {
      console.error(`❌ Error: ${err.message}\n`)
      process.exit(1)
    })

    // Esperar 30 segundos
    setTimeout(() => {
      console.log(`\n⏱️  Tiempo de prueba finalizado`)
      console.log(`   Si no recibió datos, pruebe con otro puerto o baudRate\n`)
      port.close()
      process.exit(0)
    }, 30000)

  } catch (error) {
    console.error(`❌ Error abriendo puerto: ${error.message}\n`)
    process.exit(1)
  }
}
