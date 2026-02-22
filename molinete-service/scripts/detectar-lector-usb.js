/**
 * Script para detectar lectores USB HID conectados
 * Muestra VID/PID de todos los dispositivos para configurar en config.json
 *
 * Ejecutar: npm run detectar-usb
 */

import HID from 'node-hid'

console.log('\n📡 Buscando dispositivos USB HID...\n')

const devices = HID.devices()

if (devices.length === 0) {
  console.log('❌ No se encontraron dispositivos HID\n')
  process.exit(0)
}

console.log(`✓ Encontrados ${devices.length} dispositivos HID:\n`)

devices.forEach((device, index) => {
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`Dispositivo #${index + 1}`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`  Fabricante:   ${device.manufacturer || 'Desconocido'}`)
  console.log(`  Producto:     ${device.product || 'Desconocido'}`)
  console.log(`  Vendor ID:    0x${device.vendorId.toString(16).toUpperCase().padStart(4, '0')}  (${device.vendorId})`)
  console.log(`  Product ID:   0x${device.productId.toString(16).toUpperCase().padStart(4, '0')}  (${device.productId})`)
  console.log(`  Serial:       ${device.serialNumber || 'N/A'}`)
  console.log(`  Interface:    ${device.interface}`)
  console.log(`  Path:         ${device.path}`)
  console.log(`  Usage:        ${device.usage}`)
  console.log(`  UsagePage:    ${device.usagePage}`)
  console.log()
})

console.log(`\n💡 Para configurar el lector, copie el VID/PID en config.json:`)
console.log(`
{
  "lectorUSB": {
    "vendorId": "0xXXXX",
    "productId": "0xXXXX",
    ...
  }
}
`)
console.log(`\n📝 Nota: Busque el dispositivo que sea un lector de código de barras`)
console.log(`   (generalmente tiene usage: 6 o usagePage: 1 para keyboard)\n`)
