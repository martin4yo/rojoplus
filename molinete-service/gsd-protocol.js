import { SerialPort } from 'serialport'
import { EventEmitter } from 'events'

// Frames del protocolo GSD RS232
const POLL_A     = Buffer.from([0x02, 0x64, 0x81, 0x81, 0x03, 0x65])
const POLL_B     = Buffer.from([0x02, 0x65, 0x81, 0x81, 0x03, 0x64])
const CMD_ABRIR  = Buffer.from([0x02, 0x64, 0x89, 0x83, 0x32, 0x03, 0x5d])

const CARD_START = 0x3b  // ';'
const CARD_END   = 0x3f  // '?'

/**
 * GSDProtocol — maneja el puerto RS232 de la placa GSD (lector RFID + relay en un solo cable)
 *
 * Emite:
 *   'tarjeta' (uid: string)   — cuando se detecta una tarjeta
 *   'error'   (err: Error)
 *   'conectado'
 */
export class GSDProtocol extends EventEmitter {
  constructor(config, logger) {
    super()
    this.config = config
    this.logger = logger
    this.port = null
    this.rxBuffer = Buffer.alloc(0)
    this.pollToggle = false
    this.pollTimer = null
    this.pendienteApertura = false
    this.conectado = false
  }

  async iniciar() {
    const { puerto, baudRate = 19200 } = this.config

    this.port = new SerialPort({
      path: puerto,
      baudRate,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      rtscts: false,
      autoOpen: false
    })

    await new Promise((resolve, reject) => {
      this.port.open(err => err ? reject(err) : resolve())
    })

    this.port.set({ dtr: true, rts: false })
    this.logger.info(`✓ GSD RS232 inicializado en ${puerto} @ ${baudRate}`)

    this.port.on('data', data => this._onData(data))
    this.port.on('error', err => {
      this.logger.error(`Error GSD RS232: ${err.message}`)
      this.emit('error', err)
    })

    this.conectado = true
    this.emit('conectado')
    this._iniciarPolling()
  }

  _iniciarPolling() {
    const intervalo = this.config.intervaloPolling || 64
    this.pollTimer = setInterval(() => this._poll(), intervalo)
  }

  _poll() {
    if (!this.port?.isOpen) return

    if (this.pendienteApertura) {
      this.pendienteApertura = false
      this.logger.info('→ GSD: Enviando comando ABRIR relay')
      this.port.write(CMD_ABRIR)
    } else {
      const frame = this.pollToggle ? POLL_B : POLL_A
      this.pollToggle = !this.pollToggle
      this.port.write(frame)
    }
  }

  _onData(data) {
    this.rxBuffer = Buffer.concat([this.rxBuffer, data])

    // Buscar frame completo: 02 [addr] ... 03 [checksum]
    while (this.rxBuffer.length >= 2) {
      const stxIdx = this.rxBuffer.indexOf(0x02)

      if (stxIdx < 0) {
        this.rxBuffer = Buffer.alloc(0)
        break
      }

      if (stxIdx > 0) {
        this.rxBuffer = this.rxBuffer.slice(stxIdx)
        continue
      }

      const etxIdx = this.rxBuffer.indexOf(0x03, 1)
      if (etxIdx < 0) break  // Frame incompleto, esperar más datos

      const frame = this.rxBuffer.slice(0, etxIdx + 2)  // incluye checksum tras ETX
      this.rxBuffer = this.rxBuffer.slice(etxIdx + 2)

      this._procesarFrame(frame)
    }
  }

  _procesarFrame(frame) {
    // Frame mínimo: 02 [addr] 03 [chk] = 4 bytes
    if (frame.length < 4) return

    // Verificar checksum XOR
    let xor = 0
    for (let i = 0; i < frame.length - 1; i++) xor ^= frame[i]
    if (xor !== frame[frame.length - 1]) {
      this.logger.warn(`GSD: frame con checksum inválido — ${frame.toString('hex')}`)
      return
    }

    const payload = frame.slice(2, frame.length - 2)  // entre addr y ETX

    // Frame sin datos = sin tarjeta
    if (payload.length === 0) return

    // Buscar UID entre ';' y '?'
    const startIdx = payload.indexOf(CARD_START)
    const endIdx   = payload.indexOf(CARD_END)

    if (startIdx < 0 || endIdx < 0 || endIdx <= startIdx) return

    const uid = payload.slice(startIdx + 1, endIdx).toString('ascii').toUpperCase()
    if (uid.length > 0) {
      this.logger.info(`📡 GSD RFID: tarjeta detectada — UID: ${uid}`)
      this.emit('tarjeta', uid)
    }
  }

  abrirRelay() {
    this.pendienteApertura = true
  }

  cerrar() {
    if (this.pollTimer) clearInterval(this.pollTimer)
    if (this.port?.isOpen) this.port.close()
  }
}
