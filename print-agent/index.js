#!/usr/bin/env node
/**
 * RojoPlus Print Agent
 *
 * Agente de impresión para conectar impresoras locales (USB, CUPS, IP)
 * con el servidor RojoPlus en la nube.
 *
 * Uso:
 *   node index.js
 *
 * Variables de entorno:
 *   ROJOPLUS_SERVER_URL - URL del servidor (default: http://localhost:3000)
 *   ROJOPLUS_PRINT_TOKEN - Token de autenticación (default: rojoplus-print-agent)
 *   ROJOPLUS_PUESTO_ID - Identificador único del puesto
 *   ROJOPLUS_PUESTO_NOMBRE - Nombre descriptivo del puesto
 */

import { io } from 'socket.io-client'
import net from 'net'
import fs from 'fs'
import { exec, execSync } from 'child_process'
import os from 'os'

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const CONFIG = {
  serverUrl: process.env.ROJOPLUS_SERVER_URL || 'http://localhost:3000',
  token: process.env.ROJOPLUS_PRINT_TOKEN || 'rojoplus-print-agent',
  puestoId: process.env.ROJOPLUS_PUESTO_ID || `puesto-${os.hostname()}`,
  puestoNombre: process.env.ROJOPLUS_PUESTO_NOMBRE || os.hostname(),
  reconnectInterval: 5000,
  heartbeatInterval: 15000,
  detectInterval: 60000 // Detectar impresoras cada minuto
}

console.log('='.repeat(60))
console.log('  RojoPlus Print Agent v1.0.0')
console.log('='.repeat(60))
console.log(`  Servidor: ${CONFIG.serverUrl}`)
console.log(`  Puesto ID: ${CONFIG.puestoId}`)
console.log(`  Puesto Nombre: ${CONFIG.puestoNombre}`)
console.log('='.repeat(60))

// ============================================================================
// DETECCIÓN DE IMPRESORAS
// ============================================================================

/**
 * Detecta impresoras USB disponibles en /dev/usb/lp*
 */
function detectarImpresorasUSB() {
  const impresoras = []

  try {
    // Buscar dispositivos USB de impresoras
    for (let i = 0; i < 10; i++) {
      const path = `/dev/usb/lp${i}`
      if (fs.existsSync(path)) {
        impresoras.push({
          tipo: 'USB',
          nombre: `USB Printer ${i}`,
          destino: path
        })
      }
    }
  } catch (err) {
    console.error('[USB] Error detectando impresoras USB:', err.message)
  }

  return impresoras
}

/**
 * Detecta impresoras configuradas en CUPS
 */
function detectarImpresorasCUPS() {
  const impresoras = []

  try {
    // Ejecutar lpstat -p para listar impresoras
    const output = execSync('lpstat -p 2>/dev/null', { encoding: 'utf-8' })
    const lines = output.split('\n')

    for (const line of lines) {
      // Formato: "printer NOMBRE is idle."  o "printer NOMBRE disabled"
      const match = line.match(/^printer\s+(\S+)\s+/)
      if (match) {
        const nombre = match[1]
        impresoras.push({
          tipo: 'CUPS',
          nombre: nombre,
          destino: nombre
        })
      }
    }
  } catch (err) {
    // lpstat no disponible o sin impresoras
    if (err.message && !err.message.includes('not found')) {
      console.error('[CUPS] Error detectando impresoras:', err.message)
    }
  }

  return impresoras
}

/**
 * Detecta todas las impresoras disponibles
 */
function detectarTodasLasImpresoras() {
  const usb = detectarImpresorasUSB()
  const cups = detectarImpresorasCUPS()

  console.log(`[Detectar] USB: ${usb.length}, CUPS: ${cups.length}`)

  return [...usb, ...cups]
}

// ============================================================================
// FUNCIONES DE IMPRESIÓN
// ============================================================================

/**
 * Imprime via conexión TCP/IP directa (puerto 9100)
 */
function imprimirIP(destino, datos, callback) {
  const [ip, puerto] = destino.split(':')
  const client = new net.Socket()

  client.setTimeout(10000) // 10 segundos timeout

  client.connect(parseInt(puerto) || 9100, ip, () => {
    console.log(`[IP] Conectado a ${ip}:${puerto}`)
    client.write(Buffer.from(datos, 'base64'), () => {
      client.end()
      callback(null)
    })
  })

  client.on('error', (err) => {
    console.error(`[IP] Error: ${err.message}`)
    callback(err)
  })

  client.on('timeout', () => {
    console.error('[IP] Timeout de conexión')
    client.destroy()
    callback(new Error('Timeout'))
  })
}

/**
 * Imprime directamente al dispositivo USB
 */
function imprimirUSB(destino, datos, callback) {
  try {
    const buffer = Buffer.from(datos, 'base64')
    fs.writeFile(destino, buffer, (err) => {
      if (err) {
        console.error(`[USB] Error escribiendo a ${destino}:`, err.message)
        callback(err)
      } else {
        console.log(`[USB] Impreso en ${destino}`)
        callback(null)
      }
    })
  } catch (err) {
    console.error(`[USB] Error:`, err.message)
    callback(err)
  }
}

/**
 * Imprime via CUPS usando lp
 */
function imprimirCUPS(destino, datos, callback) {
  const buffer = Buffer.from(datos, 'base64')

  // Crear archivo temporal
  const tmpFile = `/tmp/rojoplus-print-${Date.now()}.raw`

  fs.writeFile(tmpFile, buffer, (err) => {
    if (err) {
      callback(err)
      return
    }

    // Imprimir con lp
    exec(`lp -d "${destino}" -o raw "${tmpFile}"`, (err, stdout, stderr) => {
      // Eliminar archivo temporal
      fs.unlink(tmpFile, () => {})

      if (err) {
        console.error(`[CUPS] Error imprimiendo:`, stderr || err.message)
        callback(err)
      } else {
        console.log(`[CUPS] Impreso en ${destino}`)
        callback(null)
      }
    })
  })
}

/**
 * Procesa un trabajo de impresión
 */
function procesarTrabajo(trabajo) {
  console.log(`[Trabajo] Recibido: ${trabajo.id} (${trabajo.tipoConexion} -> ${trabajo.destino})`)

  const callback = (err) => {
    if (socket && socket.connected) {
      socket.emit('print-agent:impreso', {
        trabajoId: trabajo.id,
        success: !err,
        error: err?.message
      })
    }
  }

  switch (trabajo.tipoConexion) {
    case 'IP':
      imprimirIP(trabajo.destino, trabajo.datos, callback)
      break
    case 'USB':
      imprimirUSB(trabajo.destino, trabajo.datos, callback)
      break
    case 'CUPS':
      imprimirCUPS(trabajo.destino, trabajo.datos, callback)
      break
    default:
      console.error(`[Trabajo] Tipo de conexión desconocido: ${trabajo.tipoConexion}`)
      callback(new Error('Tipo de conexión no soportado'))
  }
}

// ============================================================================
// CONEXIÓN SOCKET.IO
// ============================================================================

let socket = null
let impresorasDetectadas = []

function conectar() {
  console.log(`[Socket] Conectando a ${CONFIG.serverUrl}...`)

  socket = io(CONFIG.serverUrl, {
    auth: {
      isPrintAgent: true
    },
    reconnection: true,
    reconnectionDelay: CONFIG.reconnectInterval,
    reconnectionAttempts: Infinity,
    transports: ['websocket', 'polling']
  })

  socket.on('connect', () => {
    console.log('[Socket] Conectado!')

    // Detectar impresoras
    impresorasDetectadas = detectarTodasLasImpresoras()

    // Registrarse como print-agent
    socket.emit('print-agent:registrar', {
      puestoId: CONFIG.puestoId,
      nombre: CONFIG.puestoNombre,
      impresoras: impresorasDetectadas,
      token: CONFIG.token
    })
  })

  socket.on('print-agent:registrado', (data) => {
    if (data.success) {
      console.log('[Socket] Registrado exitosamente')
    } else {
      console.error('[Socket] Error en registro:', data.error)
    }
  })

  socket.on('print-agent:error', (data) => {
    console.error('[Socket] Error:', data.error)
  })

  socket.on('imprimir', (trabajo) => {
    procesarTrabajo(trabajo)
  })

  socket.on('disconnect', (reason) => {
    console.log(`[Socket] Desconectado: ${reason}`)
  })

  socket.on('connect_error', (err) => {
    console.error(`[Socket] Error de conexión: ${err.message}`)
  })
}

// ============================================================================
// HEARTBEAT Y DETECCIÓN PERIÓDICA
// ============================================================================

// Enviar heartbeat periódico
setInterval(() => {
  if (socket && socket.connected) {
    // No necesitamos enviar heartbeat explícito, Socket.io lo maneja
  }
}, CONFIG.heartbeatInterval)

// Detectar impresoras periódicamente
setInterval(() => {
  const nuevasImpresoras = detectarTodasLasImpresoras()

  // Verificar si cambió la lista
  const anterior = JSON.stringify(impresorasDetectadas)
  const nuevo = JSON.stringify(nuevasImpresoras)

  if (anterior !== nuevo) {
    impresorasDetectadas = nuevasImpresoras
    console.log('[Detectar] Cambio en impresoras detectadas')

    if (socket && socket.connected) {
      socket.emit('print-agent:impresoras', {
        puestoId: CONFIG.puestoId,
        impresoras: impresorasDetectadas
      })
    }
  }
}, CONFIG.detectInterval)

// ============================================================================
// INICIO
// ============================================================================

// Detectar impresoras iniciales
impresorasDetectadas = detectarTodasLasImpresoras()
console.log('[Inicio] Impresoras detectadas:')
impresorasDetectadas.forEach(imp => {
  console.log(`  - [${imp.tipo}] ${imp.nombre}: ${imp.destino}`)
})

// Conectar al servidor
conectar()

// Manejar señales de cierre
process.on('SIGINT', () => {
  console.log('\n[Saliendo] Cerrando conexiones...')
  if (socket) {
    socket.disconnect()
  }
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('[Saliendo] Cerrando conexiones...')
  if (socket) {
    socket.disconnect()
  }
  process.exit(0)
})
