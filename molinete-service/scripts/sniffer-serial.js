import { SerialPort } from 'serialport'
import fs from 'fs'

const PUERTO_REAL    = process.argv[2] || 'COM1'   // Placa GSD
const PUERTO_VIRTUAL = process.argv[3] || 'COM3'   // com0com lado A (software GSD usa COM4)
const BAUD_RATE      = parseInt(process.argv[4]) || 19200
const LOG_FILE       = 'sniffer.log'

const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' })

function log(direccion, data) {
  const ts    = new Date().toISOString()
  const hex   = Array.from(data).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')
  const ascii = Array.from(data).map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.').join('')
  const linea = `${ts} ${direccion} [${data.length}b]  HEX: ${hex}  ASCII: ${ascii}`
  console.log(linea)
  logStream.write(linea + '\n')
}

const opciones = { baudRate: BAUD_RATE, dataBits: 8, stopBits: 1, parity: 'none', rtscts: false }

console.log(`\n=== SNIFFER RS232 ===`)
console.log(`Placa real : ${PUERTO_REAL}`)
console.log(`Virtual A  : ${PUERTO_VIRTUAL}  (software GSD debe usar COM4)`)
console.log(`Baud rate  : ${BAUD_RATE}`)
console.log(`Log        : ${LOG_FILE}`)
console.log(`\nAbrí el software GSD apuntando a COM4 y pasá una tarjeta...\n`)

const portReal    = new SerialPort({ path: PUERTO_REAL,    ...opciones })
const portVirtual = new SerialPort({ path: PUERTO_VIRTUAL, ...opciones })

portReal.on('open', () => {
  console.log(`✓ ${PUERTO_REAL} abierto (placa GSD)`)
  portReal.set({ dtr: true, rts: false })
})

portVirtual.on('open', () => {
  console.log(`✓ ${PUERTO_VIRTUAL} abierto (bridge → software GSD)\n`)
})

// Placa → Software GSD
portReal.on('data', (data) => {
  log(`PLACA → PC  `, data)
  portVirtual.write(data)
})

// Software GSD → Placa
portVirtual.on('data', (data) => {
  log(`PC → PLACA  `, data)
  portReal.write(data)
})

portReal.on('error',    err => console.error(`Error COM real: ${err.message}`))
portVirtual.on('error', err => console.error(`Error COM virtual: ${err.message}`))

process.on('SIGINT', () => {
  console.log('\nCerrando...')
  portReal.close()
  portVirtual.close()
  logStream.end()
  process.exit(0)
})
