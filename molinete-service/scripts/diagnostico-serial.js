import { SerialPort } from 'serialport'
import { createInterface } from 'readline'

// Cambiá este valor al puerto que corresponda
const PUERTO = process.argv[2] || '/dev/ttyS0'
const BAUD_RATE = parseInt(process.argv[3]) || 9600

console.log(`\n=== DIAGNÓSTICO SERIAL GSD ===`)
console.log(`Puerto: ${PUERTO}`)
console.log(`Baud rate: ${BAUD_RATE}`)
console.log(`\nPasá una tarjeta por el lector para ver qué manda la placa...`)
console.log(`Presioná Ctrl+C para salir\n`)

let port

try {
  port = new SerialPort({
    path: PUERTO,
    baudRate: BAUD_RATE,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    rtscts: false,
    xon: false,
    xoff: false
  })
} catch (err) {
  console.error(`Error abriendo puerto: ${err.message}`)
  console.error(`\nPuertos disponibles:`)
  SerialPort.list().then(ports => {
    if (ports.length === 0) {
      console.log('  (ninguno encontrado)')
    } else {
      ports.forEach(p => console.log(`  ${p.path} — ${p.manufacturer || 'sin fabricante'}`))
    }
  })
  process.exit(1)
}

port.on('open', () => {
  console.log(`✓ Puerto abierto`)
  // Activar DTR y RTS — muchas placas RS232 no transmiten sin estas señales
  port.set({ dtr: true, rts: true }, (err) => {
    if (err) console.warn(`Advertencia DTR/RTS: ${err.message}`)
    else console.log(`✓ DTR/RTS activados\n`)
  })
})

let buffer = Buffer.alloc(0)
let timer = null

port.on('data', (data) => {
  buffer = Buffer.concat([buffer, data])

  // Acumular bytes por 100ms antes de mostrar (para capturar la trama completa)
  clearTimeout(timer)
  timer = setTimeout(() => {
    const hex = buffer.toString('hex').match(/.{1,2}/g).join(' ')
    const ascii = buffer.toString('ascii').replace(/[^\x20-\x7e]/g, '.')
    const decimal = Array.from(buffer).join(' ')

    console.log(`--- TRAMA RECIBIDA (${buffer.length} bytes) ---`)
    console.log(`  HEX:     ${hex}`)
    console.log(`  ASCII:   ${ascii}`)
    console.log(`  DECIMAL: ${decimal}`)
    console.log(`  RAW:     ${JSON.stringify(buffer.toString('latin1'))}`)
    console.log()

    buffer = Buffer.alloc(0)
  }, 100)
})

port.on('error', (err) => {
  console.error(`Error: ${err.message}`)
})

// Modo interactivo: escribir bytes al puerto para probar el relay
const rl = createInterface({ input: process.stdin })
console.log(`Podés escribir bytes hex para enviar al relay, ej: A0 01 01 A2`)
console.log(`O texto plano, ej: OPEN`)
console.log()

rl.on('line', (line) => {
  line = line.trim()
  if (!line) return

  let toSend
  // Si parece hex (pares separados por espacios o colons)
  if (/^([0-9A-Fa-f]{2}[ :]?)+$/.test(line)) {
    const bytes = line.split(/[ :]/).map(b => parseInt(b, 16))
    toSend = Buffer.from(bytes)
    console.log(`→ Enviando HEX: ${bytes.map(b => b.toString(16).padStart(2,'0').toUpperCase()).join(' ')}`)
  } else {
    toSend = Buffer.from(line + '\r\n')
    console.log(`→ Enviando texto: ${JSON.stringify(line)}`)
  }

  port.write(toSend, (err) => {
    if (err) console.error(`Error enviando: ${err.message}`)
  })
})

process.on('SIGINT', () => {
  console.log('\nCerrando...')
  if (port?.isOpen) port.close()
  process.exit(0)
})
