import express from 'express'
import { WebSocketServer } from 'ws'
import { createServer } from 'http'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import winston from 'winston'
import { GSDProtocol } from './gsd-protocol.js'

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

// Axios: headers globales para autenticación del dispositivo en el cloud
if (config.tenant?.slug) {
  axios.defaults.headers.common['X-Tenant-Slug'] = config.tenant.slug
}
if (config.tenant?.apiToken) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${config.tenant.apiToken}`
}

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
let lectorUSBDevices = []
let lectorRFIDPorts = []
let molinetePort = null
let gsdProtocol = null
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
 * Inicializar lectores USB (HID keyboard wedge) — soporta múltiples dispositivos
 */
async function inicializarLectorUSB() {
  if (!config.lectorUSB.habilitado) {
    logger.info('Lectores USB deshabilitados en config')
    return
  }

  if (config.lectorUSB.modoTeclado) {
    logger.info('✓ Lector USB en modo TECLADO — las lecturas llegan por el navegador (/api/lectura-teclado)')
    estadoConexion.usb = true
    return
  }

  try {
    const HID = (await import('node-hid')).default
    const dispositivosConectados = HID.devices()
    let conectados = 0
    const pathsAbiertos = new Set()

    for (const cfg of config.lectorUSB.dispositivos) {
      let device = null

      if (cfg.path) {
        device = dispositivosConectados.find(d => d.path === cfg.path)
        if (!device) {
          logger.warn(`Lector USB no encontrado por path: ${cfg.descripcion || ''} (path: ${cfg.path})`)
          continue
        }
      } else {
        const vendorId = parseInt(cfg.vendorId)
        const productId = parseInt(cfg.productId)
        device = dispositivosConectados.find(d =>
          d.vendorId === vendorId &&
          d.productId === productId &&
          !pathsAbiertos.has(d.path)
        )
        if (!device) {
          logger.warn(`Lector USB no encontrado: ${cfg.descripcion || ''} (VID: ${cfg.vendorId}, PID: ${cfg.productId})`)
          logger.info('Si tenés varios lectores iguales, especificá "path" en cada entrada. Ejecute: npm run detectar-usb')
          continue
        }
      }

      if (pathsAbiertos.has(device.path)) {
        logger.warn(`Lector USB ya abierto (${device.path}), omitiendo: ${cfg.descripcion || ''}`)
        continue
      }

      const hidDevice = new HID.HID(device.path)
      lectorUSBDevices.push(hidDevice)
      pathsAbiertos.add(device.path)

      let buffer = ''
      hidDevice.on('data', (data) => {
        const chars = data.toString('utf8').replace(/\0/g, '')
        buffer += chars

        if (chars.includes('\n') || chars.includes('\r') || buffer.length > 20) {
          const valorLeido = buffer.trim()
          if (valorLeido) {
            handleUSBData(valorLeido)
          }
          buffer = ''
        }
      })

      hidDevice.on('error', (err) => {
        logger.error(`Error en lector USB ${cfg.descripcion || cfg.vendorId}: ${err.message}`)
        if (lectorUSBDevices.every(d => d._closed)) estadoConexion.usb = false
      })

      logger.info(`✓ Lector USB inicializado: ${cfg.descripcion || device.product || 'Desconocido'} (${device.path})`)
      conectados++
    }

    estadoConexion.usb = conectados > 0

  } catch (error) {
    logger.error(`Error inicializando lectores USB: ${error.message}`)
    estadoConexion.usb = false
  }
}

/**
 * Inicializar placa GSD RS232 (lector RFID + relay en un solo puerto)
 */
async function inicializarGSD() {
  if (config.lectorRFID?.tipo !== 'GSD_RS232' && config.molinete?.tipo !== 'GSD_RS232') return

  const cfg = config.lectorRFID?.tipo === 'GSD_RS232'
    ? config.lectorRFID
    : config.molinete

  gsdProtocol = new GSDProtocol(cfg, logger)

  gsdProtocol.on('tarjeta', (uid) => {
    handleRFIDData(uid, cfg.descripcion || cfg.puerto)
  })

  gsdProtocol.on('conectado', () => {
    estadoConexion.rfid = true
    estadoConexion.molinete = true
  })

  gsdProtocol.on('error', () => {
    estadoConexion.rfid = false
    estadoConexion.molinete = false
  })

  try {
    await gsdProtocol.iniciar()
  } catch (err) {
    logger.error(`Error inicializando GSD RS232: ${err.message}`)
  }
}

/**
 * Inicializar lectores RFID seriales — soporta múltiples dispositivos
 */
async function inicializarLectorRFID() {
  if (!config.lectorRFID.habilitado) {
    logger.info('Lectores RFID deshabilitados en config')
    return
  }

  if (config.lectorRFID.tipo === 'GSD_RS232') {
    logger.info('RFID manejado por GSD RS232 — lectorRFID estándar omitido')
    return
  }

  // Compatibilidad con config vieja (objeto único) y nueva (array dispositivos)
  const dispositivos = Array.isArray(config.lectorRFID.dispositivos)
    ? config.lectorRFID.dispositivos
    : [{
        tipo: config.lectorRFID.tipo,
        puerto: config.lectorRFID.puerto,
        baudRate: config.lectorRFID.baudRate,
        descripcion: config.lectorRFID.descripcion
      }]

  try {
    const { SerialPort } = await import('serialport')
    const { ReadlineParser } = await import('@serialport/parser-readline')

    let conectados = 0

    for (const cfg of dispositivos) {
      try {
        const port = new SerialPort({
          path: cfg.puerto,
          baudRate: cfg.baudRate || 9600
        })

        const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }))

        parser.on('data', (data) => {
          handleRFIDData(data.trim(), cfg.descripcion || cfg.puerto)
        })

        // Debug: loguear bytes crudos para diagnosticar problemas de parser
        port.on('data', (data) => {
          logger.info(`[RFID raw ${cfg.puerto}] hex=${data.toString('hex')} ascii="${data.toString('ascii').replace(/[^\x20-\x7e]/g, '.')}"`)
        })

        port.on('error', (err) => {
          logger.error(`Error en lector RFID ${cfg.puerto}: ${err.message}`)
          estadoConexion.rfid = lectorRFIDPorts.some(p => p.isOpen)
        })

        port.on('open', () => {
          logger.info(`✓ Lector RFID inicializado en ${cfg.puerto} (${cfg.descripcion || 'sin descripción'})`)
          estadoConexion.rfid = true
          conectados++
        })

        lectorRFIDPorts.push(port)
      } catch (err) {
        logger.error(`Error abriendo lector RFID ${cfg.puerto}: ${err.message}`)
      }
    }

    if (conectados === 0 && dispositivos.length > 0) {
      logger.info('Ejecute: npm run detectar-rfid para encontrar el puerto')
    }
  } catch (error) {
    logger.error(`Error inicializando lectores RFID: ${error.message}`)
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
  let nombreCompleto = null

  // QR del portal suele ser UUID (36 chars con guiones)
  if (valorLeido.length === 36 && valorLeido.includes('-')) {
    tipoLectura = 'QR'
  }
  // DNI argentino tiene 7-8 dígitos
  else if (/^\d{7,8}$/.test(valorLeido)) {
    tipoLectura = 'DNI'
  }
  // Código de barras PDF417 del DNI argentino (largo, campos separados por @)
  else if (valorLeido.includes('@') || valorLeido.length > 20) {
    tipoLectura = 'DNI'
    const parsed = parsearDniArgentino(valorLeido)
    valorLeido = parsed.valor
    nombreCompleto = parsed.nombreCompleto
  }

  procesarLectura(valorLeido, tipoLectura, { nombreCompleto })
}

/**
 * Parser de DNI argentino PDF417.
 *
 * Formato real (DNI tarjeta moderno):
 *   numTramite@APELLIDO@NOMBRES@SEXO@nroDNI@ejemplar@fechaNac@fechaEmision[@CUIL]
 *
 * El campo 0 es el número de trámite (10-11 dígitos), NO el apellido — bug histórico.
 * También hay variantes con campo 0 vacío o con orden distinto. La heurística:
 *   - DNI = primer campo con 7-8 dígitos puros
 *   - apellido = primer campo de TEXTO (>1 char, no puramente numérico) antes del DNI
 *   - nombres = siguientes campos de texto antes del DNI
 *   - se ignoran campos de 1 char (sexo) y puramente numéricos (numTramite, ejemplar)
 */
function parsearDniArgentino(raw) {
  const result = { valor: raw, nombreCompleto: null }
  // Algunos lectores usan @ (canónico), otros " (vimos en producción), otros |
  const partes = raw.split(/[@"|]/).map(p => (p || '').trim())

  let idxDni = -1
  for (let i = 0; i < partes.length; i++) {
    if (/^\d{7,8}$/.test(partes[i])) {
      idxDni = i
      break
    }
  }

  if (idxDni < 0) {
    // Sin DNI claro: fallback a primer 7-8 dígitos en cualquier parte
    const m = raw.match(/\b\d{7,8}\b/)
    if (m) result.valor = m[0]
    logger.info(`[DNI parser] sin idxDni — partes=${JSON.stringify(partes)}`)
    return result
  }

  result.valor = partes[idxDni]

  const camposTexto = []
  for (let i = 0; i < idxDni; i++) {
    const p = partes[i]
    if (!p) continue                 // vacío
    if (/^\d+$/.test(p)) continue    // puramente numérico (numTramite)
    if (p.length === 1) continue     // sexo M/F u otra letra suelta
    camposTexto.push(p)
  }

  if (camposTexto.length >= 1) {
    const apellido = camposTexto[0]
    const nombres = camposTexto.slice(1).join(' ')
    result.nombreCompleto = nombres ? `${apellido}, ${nombres}` : apellido
  }

  logger.info(`[DNI parser] idxDni=${idxDni} dni=${result.valor} nombre="${result.nombreCompleto || ''}" partes=${JSON.stringify(partes)}`)
  return result
}

/**
 * Convertir UID RFID GSD (5 bytes hex) al PIN del socio.
 * Toma los últimos 3 bytes (6 chars hex finales), los pasa a decimal y rellena con ceros a 10.
 * Ej: "01005AA4FE" -> "5AA4FE" -> 5940478 -> "0005940478"
 */
function uidGsdAPin(uidHex) {
  if (!uidHex || uidHex.length < 6) return uidHex
  const ultimos3Bytes = uidHex.slice(-6)
  const decimal = parseInt(ultimos3Bytes, 16)
  if (Number.isNaN(decimal)) return uidHex
  return decimal.toString().padStart(10, '0')
}

/**
 * Procesar datos del lector RFID
 */
function handleRFIDData(data, origen = '') {
  // UID crudo del lector — se conserva en log y se manda al monitor para debugging
  const uidOriginal = (data || '').replace(/\s/g, '').toUpperCase()
  logger.info(`📡 Lectura RFID${origen ? ` [${origen}]` : ''}: UID=${uidOriginal}`)

  // Convertir a PIN del socio para hacer el lookup contra la base
  const valorLeido = uidGsdAPin(uidOriginal)
  logger.info(`📡 RFID PIN convertido: ${valorLeido}`)

  procesarLectura(valorLeido, 'RFID', { uidOriginal })
}

/**
 * FUNCIÓN PRINCIPAL - Procesar lectura y determinar acceso
 */
async function procesarLectura(valorLeido, tipoLectura, metadata = {}) {
  logger.info(`🔍 Procesando: ${tipoLectura} = ${valorLeido}${metadata.nombreCompleto ? ` (${metadata.nombreCompleto})` : ''}`)

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

  // Broadcast INMEDIATO — el frontend muestra el evento sin esperar molinete/registro
  broadcast({
    tipo: 'ACCESO',
    data: {
      tipoLectura,
      valorLeido,
      uidOriginal: metadata.uidOriginal || null,
      resultado: resultado.permitido ? 'PERMITIDO' : 'DENEGADO',
      motivo: resultado.motivo,
      mensaje: resultado.mensaje,
      persona: resultado.persona,
      fecha: new Date().toISOString()
    }
  })

  // Señalización (pantalla + beep) en paralelo, sin bloquear
  if (resultado.permitido) {
    senalizarPermitido(resultado.persona?.nombre).catch(err =>
      logger.error(`Error señalizando permitido: ${err.message}`)
    )
    abrirMolinete().catch(err =>
      logger.error(`Error abriendo molinete: ${err.message}`)
    )
  } else {
    senalizarInhabilitado(resultado.motivo, resultado.persona?.nombre, valorLeido).catch(err =>
      logger.error(`Error señalizando inhabilitado: ${err.message}`)
    )
  }

  // Registro en background (si falla guarda en cache offline igual)
  registrar(resultado, valorLeido, tipoLectura, metadata).catch(err =>
    logger.error(`Error registrando acceso: ${err.message}`)
  )
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
      tipo: null,
      persona: null
    }
  }

  // Validar según tipo
  if (tipo === 'SOCIO') {
    // El cache server-side ya filtra solo socios cuyo estado tiene
    // permiteIngresoMolinete=true (o fallback estado='VIGENTE').
    // Por lo tanto si el socio está en el cache local, puede ingresar.
    return {
      permitido: true,
      motivo: 'SOCIO_VIGENTE',
      mensaje: `Bienvenido/a ${persona.apellidoNombre}`,
      tipo: 'SOCIO',
      persona: {
        id: persona.id,
        nombre: persona.apellidoNombre,
        nroSocio: persona.nroSocio,
        documento: persona.documento
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
        tipo: 'HABILITACION',
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
        tipo: 'HABILITACION',
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
      tipo: 'HABILITACION',
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
async function registrar(resultado, valorLeido, tipoLectura, metadata = {}) {
  // Rutear el id de la persona al campo correcto según el tipo de match.
  // Antes se asumía siempre SOCIO — si era HABILITACION, el id de la habilitación
  // terminaba en socioId y el monitor mostraba un socio ajeno con el mismo id.
  const tipoMatch = resultado.tipo
  const personaId = resultado.persona?.id || null
  const registro = {
    dispositivoId: config.dispositivoId,
    socioId: tipoMatch === 'SOCIO' ? personaId : null,
    habilitacionTemporalId: tipoMatch === 'HABILITACION' ? personaId : null,
    tipoLectura,
    valorLeido,
    nombreCompleto: metadata.nombreCompleto || null,
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
  if (gsdProtocol) {
    gsdProtocol.abrirRelay()
    return
  }

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

// Info del tenant (nombre + logo) para el header del monitor web
let tenantInfoCache = null
async function obtenerTenantInfo() {
  if (tenantInfoCache) return tenantInfoCache
  try {
    const response = await axios.get(`${config.apiUrl}/accesos/tenant-info`, { timeout: 5000 })
    if (response.data?.success) {
      const info = response.data.data
      // Si logoUrl es relativo (ej "/uploads/logo.png"), absolutizarlo contra el host del cloud
      if (info.logoUrl && info.logoUrl.startsWith('/')) {
        try {
          const apiOrigin = new URL(config.apiUrl).origin
          info.logoUrl = apiOrigin + info.logoUrl
        } catch (_) {}
      }
      tenantInfoCache = info
      return tenantInfoCache
    }
  } catch (err) {
    logger.warn(`No se pudo obtener tenant-info: ${err.message}`)
  }
  return null
}

app.get('/api/tenant-info', async (req, res) => {
  const info = await obtenerTenantInfo()
  res.json({ success: true, data: info || { nombre: null, logoUrl: null } })
})

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

// Lectura desde el navegador (modo teclado)
app.post('/api/lectura-teclado', (req, res) => {
  const { valorLeido } = req.body || {}
  if (!valorLeido || typeof valorLeido !== 'string') {
    return res.status(400).json({ success: false, error: 'valorLeido requerido' })
  }
  handleUSBData(valorLeido.trim())
  res.json({ success: true })
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
  await inicializarGSD()
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
  lectorUSBDevices.forEach(d => d.close())
  lectorRFIDPorts.forEach(p => { try { p.close() } catch {} })
  if (molinetePort) molinetePort.close()
  if (gsdProtocol) gsdProtocol.cerrar()
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
