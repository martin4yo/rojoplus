import { SerialPort } from 'serialport'
import { EventEmitter } from 'events'

// Frames del protocolo GSD RS232
const POLL_A     = Buffer.from([0x02, 0x64, 0x81, 0x81, 0x03, 0x65])
const CMD_ABRIR  = Buffer.from([0x02, 0x64, 0x89, 0x83, 0x32, 0x03, 0x5d])
const CMD_ACK    = Buffer.from([0x02, 0x64, 0x80, 0x80, 0x03, 0x65])  // limpia buffer de la placa

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
    this.pollTimer = null
    this.pendienteApertura = false
    this.pendienteAck = false
    this.conectado = false
    this.ultimoUID = null
    this.ultimaLectura = 0
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

    // Limpiar buffer de la placa al arrancar
    this.port.write(CMD_ACK)

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

    // ACK primero si está pendiente — la placa lo necesita antes del próximo comando
    if (this.pendienteAck) {
      this.pendienteAck = false
      this.port.write(CMD_ACK)
    } else if (this.pendienteApertura) {
      this.pendienteApertura = false
      this.logger.info('→ GSD: Enviando comando ABRIR relay')
      this.port.write(CMD_ABRIR)
    } else {
      this.port.write(POLL_A)
    }
  }

  _onData(data) {
    this.rxBuffer = Buffer.concat([this.rxBuffer, data])

    // Buscar patrón de tarjeta: ';' (0x3b) ... '?' (0x3f)
    // Los bytes de polling/ACK no contienen estos caracteres
    let startIdx = this.rxBuffer.indexOf(CARD_START)
    while (startIdx >= 0) {
      const endIdx = this.rxBuffer.indexOf(CARD_END, startIdx + 1)
      if (endIdx < 0) break  // trama incompleta, esperar más bytes

      const uid = this.rxBuffer.slice(startIdx + 1, endIdx).toString('ascii').toUpperCase()
      const cooldown = this.config.cooldownMs || 3000
      const ahora = Date.now()
      if (uid.length > 0 && (uid !== this.ultimoUID || ahora - this.ultimaLectura > cooldown)) {
        this.ultimoUID = uid
        this.ultimaLectura = ahora
        this.logger.info(`📡 GSD RFID: tarjeta detectada — UID: ${uid}`)
        this.pendienteAck = true  // limpiar buffer placa después de procesar
        this.emit('tarjeta', uid)
      }

      this.rxBuffer = this.rxBuffer.slice(endIdx + 1)
      startIdx = this.rxBuffer.indexOf(CARD_START)
    }

    // Evitar que el buffer crezca indefinidamente con bytes de polling
    if (this.rxBuffer.length > 64) {
      this.rxBuffer = this.rxBuffer.slice(this.rxBuffer.length - 32)
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
