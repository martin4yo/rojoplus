import express from 'express'
import { WebSocketServer } from 'ws'
import { createServer } from 'http'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import winston from 'winston'

// Importar cache SQLite
import {
  inicializarDB,
  actualizarCache,
  buscarPorQR,
  buscarPorDNI,
  buscarPorRFID,
  buscarHabilitacionPorDNI,
  guardarRegistroPendiente,
  obtenerRegistrosPendientes,
  marcarRegistroEnviado,
  obtenerEstadisticas
} from './db/cache.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Cargar configuración
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'))

// Configurar logger
const logger = winston.createLogger({
  level: config.logging.nivel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: config.logging.archivo,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: config.logging.maxFiles
    })
  ]
})

// Variables globales
let lectorUSBDevice = null
let lectorRFIDPort = null
let molinetePort = null
let estadoConexion = {
  api: false,
  usb: false,
  rfid: false,
  molinete: false
}

// Express app
const app = express()
const httpServer = createServer(app)
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// WebSocket server
const wss = new WebSocketServer({ server: httpServer, path: '/ws' })

// Broadcast a todos los clientes WebSocket
function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(JSON.stringify(data))
    }
  })
}

// ============================================
// INICIALIZACIÓN DE HARDWARE
// ============================================

/**
 * Inicializar lector USB (HID keyboard wedge)
 */
async function inicializarLectorUSB() {
  if (!config.lectorUSB.habilitado) {
    logger.info('Lector USB deshabilitado en config')
    return
  }

  try {
    // Importación dinámica para evitar errores si no está instalado
    const HID = (await import('node-hid')).default

    const vendorId = parseInt(config.lectorUSB.vendorId)
    const productId = parseInt(config.lectorUSB.productId)

    // Buscar dispositivo
    const devices = HID.devices()
    const device = devices.find(d => d.vendorId === vendorId && d.productId === productId)

    if (!device) {
      logger.warn(`Lector USB no encontrado (VID: ${config.lectorUSB.vendorId}, PID: ${config.lectorUSB.productId})`)
      logger.info('Ejecute: npm run detectar-usb para encontrar el dispositivo')
      estadoConexion.usb = false
      return
    }

    lectorUSBDevice = new HID.HID(device.path)
    estadoConexion.usb = true

    let buffer = ''
    lectorUSBDevice.on('data', (data) => {
      // Procesar datos del lector USB (keyboard wedge)
      const chars = data.toString('utf8').replace(/\0/g, '')
      buffer += chars

      // Detectar fin de lectura (Enter o suficiente longitud)
      if (chars.includes('\n') || chars.includes('\r') || buffer.length > 20) {
        const valorLeido = buffer.trim()
        if (valorLeido) {
          handleUSBData(valorLeido)
        }
        buffer = ''
      }
    })

    lectorUSBDevice.on('error', (err) => {
      logger.error(`Error en lector USB: ${err.message}`)
      estadoConexion.usb = false
    })

    logger.info(`✓ Lector USB inicializado: ${device.product || 'Desconocido'}`)

  } catch (error) {
    logger.error(`Error inicializando lector USB: ${error.message}`)
    estadoConexion.usb = false
  }
}

/**
 * Inicializar lector RFID serial
 */
async function inicializarLectorRFID() {
  if (!config.lectorRFID.habilitado) {
    logger.info('Lector RFID deshabilitado en config')
    return
  }

  try {
    // Importación dinámica
    const { SerialPort } = await import('serialport')
    const { ReadlineParser } = await import('@serialport/parser-readline')

    lectorRFIDPort = new SerialPort({
      path: config.lectorRFID.puerto,
      baudRate: config.lectorRFID.baudRate
    })

    const parser = lectorRFIDPort.pipe(new ReadlineParser({ delimiter: '\r\n' }))

    parser.on('data', (data) => {
      handleRFIDData(data.trim())
    })

    lectorRFIDPort.on('error', (err) => {
      logger.error(`Error en lector RFID: ${err.message}`)
      estadoConexion.rfid = false
    })

    lectorRFIDPort.on('open', () => {
      logger.info(`✓ Lector RFID inicializado en ${config.lectorRFID.puerto}`)
      estadoConexion.rfid = true
    })

  } catch (error) {
    logger.error(`Error inicializando lector RFID: ${error.message}`)
    logger.info('Ejecute: npm run detectar-rfid para encontrar el puerto')
    estadoConexion.rfid = false
  }
}

/**
 * Inicializar control del molinete (relay)
 */
async function inicializarMolinete() {
  try {
    if (config.molinete.tipo === 'USB_RELAY') {
      // Importación dinámica
      const { SerialPort } = await import('serialport')

      molinetePort = new SerialPort({
        path: config.molinete.puerto,
        baudRate: config.molinete.baudRate
      })

      molinetePort.on('open', () => {
        logger.info(`✓ Relay molinete inicializado en ${config.molinete.puerto}`)
        estadoConexion.molinete = true
      })

      molinetePort.on('error', (err) => {
        logger.error(`Error en relay molinete: ${err.message}`)
        estadoConexion.molinete = false
      })
    } else if (config.molinete.tipo === 'GPIO') {
      // GPIO para Raspberry Pi (implementar si es necesario)
      logger.info('Modo GPIO no implementado aún')
      estadoConexion.molinete = false
    }
  } catch (error) {
    logger.error(`Error inicializando molinete: ${error.message}`)
    estadoConexion.molinete = false
  }
}

// ============================================
// PROCESAMIENTO DE LECTURAS
// ============================================

/**
 * Procesar datos del lector USB
 */
function handleUSBData(valorLeido) {
  logger.info(`📖 Lectura USB: ${valorLeido}`)

  // Distinguir entre QR y DNI por patrón
  let tipoLectura = 'DNI'

  // QR del portal suele ser UUID (36 chars con guiones)
  if (valorLeido.length === 36 && valorLeido.includes('-')) {
    tipoLectura = 'QR'
  }
  // DNI argentino tiene 7-8 dígitos
  else if (/^\d{7,8}$/.test(valorLeido)) {
    tipoLectura = 'DNI'
  }
  // Código de barras PDF417 del DNI es más largo
  else if (valorLeido.length > 20) {
    tipoLectura = 'DNI'
    // Extraer DNI del PDF417 (formato específico argentino)
    // El DNI suele estar en una posición fija
    const match = valorLeido.match(/\d{7,8}/)
    if (match) {
      valorLeido = match[0]
    }
  }

  procesarLectura(valorLeido, tipoLectura)
}

/**
 * Procesar datos del lector RFID
 */
function handleRFIDData(data) {
  logger.info(`📡 Lectura RFID: ${data}`)

  // Parsear UID hexadecimal
  const valorLeido = data.replace(/\s/g, '').toUpperCase()

  procesarLectura(valorLeido, 'RFID')
}

/**
 * FUNCIÓN PRINCIPAL - Procesar lectura y determinar acceso
 */
async function procesarLectura(valorLeido, tipoLectura) {
  logger.info(`🔍 Procesando: ${tipoLectura} = ${valorLeido}`)

  let resultado

  try {
    // Intentar validación ONLINE primero
    resultado = await validarOnline(valorLeido, tipoLectura)
    logger.info('✓ Validación ONLINE exitosa')
  } catch (error) {
    logger.warn(`⚠️ Error validación online: ${error.message}`)

    // Fallback a validación OFFLINE
    if (config.offline.habilitado) {
      resultado = await validarOffline(valorLeido, tipoLectura)
      logger.info('✓ Validación OFFLINE aplicada')
    } else {
      // Si no hay modo offline, denegar acceso
      resultado = {
        permitido: false,
        motivo: 'ERROR_CONEXION',
        mensaje: 'Error de conexión - Sin modo offline',
        persona: null
      }
    }
  }

  // Registrar el acceso
  await registrar(resultado, valorLeido, tipoLectura)

  // Señalizar resultado
  if (resultado.permitido) {
    await abrirMolinete()
    await senalizarPermitido(resultado.persona?.nombre)
  } else {
    await senalizarInhabilitado(resultado.motivo, resultado.persona?.nombre, valorLeido)
  }

  // Broadcast por WebSocket
  broadcast({
    tipo: 'ACCESO',
    data: {
      tipoLectura,
      valorLeido,
      resultado: resultado.permitido ? 'PERMITIDO' : 'DENEGADO',
      motivo: resultado.motivo,
      mensaje: resultado.mensaje,
      persona: resultado.persona,
      fecha: new Date().toISOString()
    }
  })
}

/**
 * Validar acceso ONLINE (llamada a API)
 */
async function validarOnline(valorLeido, tipoLectura) {
  const response = await axios.post(
    `${config.apiUrl}/accesos/validar`,
    {
      dispositivoId: config.dispositivoId,
      tipoLectura,
      valorLeido
    },
    { timeout: 5000 }
  )

  if (!response.data.success) {
    throw new Error(response.data.error || 'Error en validación')
  }

  estadoConexion.api = true
  return response.data.data
}

/**
 * Validar acceso OFFLINE (cache local)
 */
async function validarOffline(valorLeido, tipoLectura) {
  let persona = null
  let tipo = null

  // Buscar en cache según tipo de lectura
  if (tipoLectura === 'QR') {
    persona = buscarPorQR(valorLeido)
    tipo = 'SOCIO'
  } else if (tipoLectura === 'DNI') {
    persona = buscarPorDNI(valorLeido)
    if (persona) {
      tipo = 'SOCIO'
    } else {
      // Buscar en habilitaciones
      persona = buscarHabilitacionPorDNI(valorLeido)
      if (persona) {
        tipo = 'HABILITACION'
      }
    }
  } else if (tipoLectura === 'RFID') {
    persona = buscarPorRFID(valorLeido)
    tipo = 'SOCIO'
  }

  // Si no se encontró
  if (!persona) {
    return {
      permitido: false,
      motivo: 'NO_ENCONTRADO',
      mensaje: 'DNI no registrado - Diríjase a Recepción',
      persona: null
    }
  }

  // Validar según tipo
  if (tipo === 'SOCIO') {
    if (persona.estado === 'VIGENTE') {
      return {
        permitido: true,
        motivo: 'SOCIO_VIGENTE',
        mensaje: `Bienvenido/a ${persona.apellidoNombre}`,
        persona: {
          id: persona.id,
          nombre: persona.apellidoNombre,
          nroSocio: persona.nroSocio,
          documento: persona.documento
        }
      }
    } else {
      return {
        permitido: false,
        motivo: 'NO_VIGENTE',
        mensaje: `Socio ${persona.estado} - Diríjase a Secretaría`,
        persona: {
          id: persona.id,
          nombre: persona.apellidoNombre,
          nroSocio: persona.nroSocio
        }
      }
    }
  } else if (tipo === 'HABILITACION') {
    const ahora = new Date()
    const fechaHasta = new Date(persona.fechaHasta)

    // Validar vigencia
    if (ahora > fechaHasta) {
      return {
        permitido: false,
        motivo: 'VENCIDO',
        mensaje: 'Habilitación vencida - Diríjase a Recepción',
        persona: {
          id: persona.id,
          nombre: persona.nombreCompleto,
          documento: persona.documento
        }
      }
    }

    // Validar límite de accesos
    if (persona.accesosPermitidos && persona.accesosUsados >= persona.accesosPermitidos) {
      return {
        permitido: false,
        motivo: 'LIMITE_ALCANZADO',
        mensaje: 'Límite de accesos alcanzado',
        persona: {
          id: persona.id,
          nombre: persona.nombreCompleto,
          documento: persona.documento
        }
      }
    }

    return {
      permitido: true,
      motivo: 'HABILITACION_VIGENTE',
      mensaje: `Bienvenido/a ${persona.nombreCompleto}`,
      persona: {
        id: persona.id,
        nombre: persona.nombreCompleto,
        documento: persona.documento
      }
    }
  }
}

/**
 * Registrar acceso en el sistema
 */
async function registrar(resultado, valorLeido, tipoLectura) {
  const registro = {
    dispositivoId: config.dispositivoId,
    socioId: resultado.persona?.id || null,
    habilitacionTemporalId: null, // Se asignaría si es habilitación
    tipoLectura,
    valorLeido,
    resultado: resultado.permitido ? 'PERMITIDO' : 'DENEGADO',
    motivoRechazo: resultado.permitido ? null : resultado.motivo,
    modoValidacion: estadoConexion.api ? 'ONLINE' : 'OFFLINE',
    fecha: new Date().toISOString()
  }

  try {
    // Intentar registrar online
    await axios.post(`${config.apiUrl}/accesos/registrar`, registro, { timeout: 3000 })
    logger.info('✓ Acceso registrado online')
  } catch (error) {
    // Guardar en cache para enviar después
    guardarRegistroPendiente(registro)
    logger.warn('⚠️ Acceso guardado en cache (offline)')
  }
}

// ============================================
// CONTROL DE MOLINETE Y SEÑALIZACIÓN
// ============================================

/**
 * Abrir molinete (activar relay)
 */
async function abrirMolinete() {
  if (!molinetePort) {
    logger.warn('Molinete no inicializado - simulando apertura')
    return
  }

  try {
    // Comando ON
    const comandoON = Buffer.from(config.molinete.comandoON.split(':').map(x => parseInt(x, 16)))
    molinetePort.write(comandoON)

    logger.info('🚪 Molinete ABIERTO')

    // Esperar tiempo de apertura
    await new Promise(resolve => setTimeout(resolve, config.molinete.tiempoApertura))

    // Comando OFF
    const comandoOFF = Buffer.from(config.molinete.comandoOFF.split(':').map(x => parseInt(x, 16)))
    molinetePort.write(comandoOFF)

    logger.info('🚪 Molinete CERRADO')
  } catch (error) {
    logger.error(`Error controlando molinete: ${error.message}`)
  }
}

/**
 * Señalizar acceso PERMITIDO
 */
async function senalizarPermitido(nombre) {
  logger.info(`🟢 ACCESO PERMITIDO: ${nombre || 'Sin nombre'}`)

  // LED verde + beep corto
  // TODO: Implementar control de GPIO/LED
  await beep({ duracion: 200, repeticiones: 1 })

  // Broadcast pantalla
  broadcast({
    tipo: 'PANTALLA',
    data: {
      estado: 'PERMITIDO',
      icono: '✅',
      color: 'verde',
      titulo: 'ACCESO PERMITIDO',
      mensaje: nombre || '',
      duracion: 3000
    }
  })
}

/**
 * Señalizar acceso INHABILITADO
 */
async function senalizarInhabilitado(motivo, nombre, valorLeido) {
  logger.info(`🔴 ACCESO DENEGADO: ${motivo}`)

  const mensajes = {
    'NO_VIGENTE': {
      titulo: 'SOCIO NO VIGENTE',
      mensaje: 'Diríjase a Secretaría'
    },
    'NO_ENCONTRADO': {
      titulo: 'DNI NO REGISTRADO',
      mensaje: 'Diríjase a Recepción'
    },
    'VENCIDO': {
      titulo: 'HABILITACIÓN VENCIDA',
      mensaje: 'Diríjase a Recepción'
    },
    'LIMITE_ALCANZADO': {
      titulo: 'LÍMITE DE ACCESOS',
      mensaje: 'Límite alcanzado'
    },
    'HORARIO': {
      titulo: 'FUERA DE HORARIO',
      mensaje: 'Acceso no permitido en este horario'
    },
    'ERROR_CONEXION': {
      titulo: 'ERROR DE SISTEMA',
      mensaje: 'Intente nuevamente'
    }
  }

  const msg = mensajes[motivo] || {
    titulo: 'ACCESO DENEGADO',
    mensaje: motivo
  }

  // LED rojo + beep largo 2x
  // TODO: Implementar control de GPIO/LED
  await beep({ duracion: 500, repeticiones: 2 })

  // Broadcast pantalla
  broadcast({
    tipo: 'PANTALLA',
    data: {
      estado: 'INHABILITADO',
      icono: '❌',
      color: 'rojo',
      titulo: msg.titulo,
      mensaje: msg.mensaje,
      duracion: 5000
    }
  })

  // Si es modal automático y DNI no encontrado
  if (config.habilitacion.modalAutomatico && motivo === 'NO_ENCONTRADO') {
    broadcast({
      tipo: 'SOLICITUD_HABILITACION',
      data: {
        dni: valorLeido,
        nombre: nombre
      }
    })
  }
}

/**
 * Emitir beep
 */
async function beep({ duracion = 200, repeticiones = 1 }) {
  // TODO: Implementar control de buzzer GPIO
  // Por ahora solo log
  logger.info(`🔊 BEEP: ${duracion}ms x${repeticiones}`)
}

// ============================================
// SINCRONIZACIÓN
// ============================================

/**
 * Sincronizar cache con servidor
 */
async function sincronizarCache() {
  try {
    logger.info('🔄 Iniciando sincronización...')

    // Descargar datos del servidor
    const response = await axios.get(
      `${config.apiUrl}/accesos/cache-socios`,
      {
        params: { dispositivoId: config.dispositivoId },
        timeout: 10000
      }
    )

    if (response.data.success) {
      const { socios, habilitaciones } = response.data.data
      actualizarCache(socios, habilitaciones)
      estadoConexion.api = true
      logger.info('✓ Sincronización completada')
    }

    // Enviar registros pendientes
    await enviarRegistrosPendientes()

  } catch (error) {
    logger.error(`Error en sincronización: ${error.message}`)
    estadoConexion.api = false
  }
}

/**
 * Enviar registros pendientes al servidor
 */
async function enviarRegistrosPendientes() {
  const pendientes = obtenerRegistrosPendientes()
  if (pendientes.length === 0) return

  logger.info(`📤 Enviando ${pendientes.length} registros pendientes...`)

  for (const registro of pendientes) {
    try {
      await axios.post(`${config.apiUrl}/accesos/registrar`, registro, { timeout: 3000 })
      marcarRegistroEnviado(registro.id)
      logger.info(`✓ Registro ${registro.id} enviado`)
    } catch (error) {
      logger.warn(`⚠️ Error enviando registro ${registro.id}: ${error.message}`)
    }
  }
}

// ============================================
// API HTTP LOCAL
// ============================================

// Estado del sistema
app.get('/api/status', (req, res) => {
  const stats = obtenerEstadisticas()
  res.json({
    success: true,
    data: {
      version: '1.0.0',
      dispositivo: config.dispositivoId,
      conexion: estadoConexion,
      cache: stats,
      uptime: process.uptime()
    }
  })
})

// Forzar sincronización
app.post('/api/sync', async (req, res) => {
  try {
    await sincronizarCache()
    res.json({ success: true, message: 'Sincronización iniciada' })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// Abrir molinete manualmente
app.post('/api/abrir', async (req, res) => {
  try {
    await abrirMolinete()
    res.json({ success: true, message: 'Molinete abierto' })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// ============================================
// INICIALIZACIÓN Y ARRANQUE
// ============================================

async function iniciar() {
  console.log('🚀 Iniciando servicio de molinete...')
  console.log(`   Dispositivo ID: ${config.dispositivoId}`)
  console.log(`   API: ${config.apiUrl}`)

  // Crear directorio de logs
  const logsDir = path.join(__dirname, 'logs')
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true })
  }

  // Inicializar base de datos
  inicializarDB()

  // Sincronización inicial
  await sincronizarCache()

  // Inicializar hardware
  await inicializarLectorUSB()
  await inicializarLectorRFID()
  await inicializarMolinete()

  // Sincronización periódica
  if (config.sync.autoSync) {
    setInterval(sincronizarCache, config.sync.intervalo * 60 * 1000)
    logger.info(`✓ Sincronización automática cada ${config.sync.intervalo} minutos`)
  }

  // Iniciar servidor HTTP
  httpServer.listen(config.puerto, () => {
    logger.info(`✓ Servidor HTTP escuchando en puerto ${config.puerto}`)
    logger.info(`✓ WebSocket disponible en ws://localhost:${config.puerto}/ws`)
    logger.info(`✓ Monitor web: http://localhost:${config.puerto}`)
    console.log('\n✅ Servicio iniciado correctamente')
    console.log(`   🌐 Monitor: http://localhost:${config.puerto}`)
    console.log(`   📡 WebSocket: ws://localhost:${config.puerto}/ws\n`)
  })
}

// Manejo de errores y cierre graceful
process.on('SIGINT', () => {
  logger.info('Cerrando servicio...')
  if (lectorUSBDevice) lectorUSBDevice.close()
  if (lectorRFIDPort) lectorRFIDPort.close()
  if (molinetePort) molinetePort.close()
  process.exit(0)
})

process.on('uncaughtException', (error) => {
  logger.error(`Error no capturado: ${error.message}`)
  logger.error(error.stack)
})

// Iniciar servicio
iniciar().catch(error => {
  console.error('Error fatal al iniciar:', error)
  process.exit(1)
})
