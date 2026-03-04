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
import Jimp from 'jimp'

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

const isWindows = process.platform === 'win32'

/**
 * Detecta impresoras USB disponibles en /dev/usb/lp* (Linux)
 */
function detectarImpresorasUSB() {
  const impresoras = []

  // Solo funciona en Linux
  if (isWindows) return impresoras

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
 * Detecta impresoras configuradas en CUPS (Linux/macOS)
 */
function detectarImpresorasCUPS() {
  const impresoras = []

  // Solo funciona en Linux/macOS
  if (isWindows) return impresoras

  console.log('[CUPS] Detectando impresoras...')

  // Método 1: lpstat -p
  try {
    const output = execSync('lpstat -p 2>/dev/null', { encoding: 'utf-8' })
    console.log('[CUPS] lpstat -p output:', output)
    const lines = output.split('\n')

    for (const line of lines) {
      // Formato inglés: "printer NOMBRE is idle."
      // Formato español: "la impresora NOMBRE está inactiva."
      let match = line.match(/^printer\s+(\S+)\s+/)
      if (!match) {
        match = line.match(/^la impresora\s+(\S+)\s+/)
      }
      if (match) {
        const nombre = match[1]
        console.log(`[CUPS]   - ${nombre}`)
        impresoras.push({
          tipo: 'CUPS',
          nombre: nombre,
          destino: nombre
        })
      }
    }
  } catch (err) {
    console.log('[CUPS] lpstat -p falló:', err.message)
  }

  // Método 2: lpstat -a (lista impresoras que aceptan trabajos)
  if (impresoras.length === 0) {
    try {
      const output = execSync('lpstat -a 2>/dev/null', { encoding: 'utf-8' })
      console.log('[CUPS] lpstat -a output:', output)
      const lines = output.split('\n')

      for (const line of lines) {
        // Formato inglés: "NOMBRE accepting requests since ..."
        // Formato español: "NOMBRE aceptando peticiones desde ..."
        const match = line.match(/^(\S+)\s+(?:accepting|aceptando)/)
        if (match) {
          const nombre = match[1]
          if (!impresoras.find(i => i.nombre === nombre)) {
            console.log(`[CUPS]   - ${nombre}`)
            impresoras.push({
              tipo: 'CUPS',
              nombre: nombre,
              destino: nombre
            })
          }
        }
      }
    } catch (err) {
      console.log('[CUPS] lpstat -a falló:', err.message)
    }
  }

  // Método 3: lpstat -e (lista todas las impresoras disponibles)
  if (impresoras.length === 0) {
    try {
      const output = execSync('lpstat -e 2>/dev/null', { encoding: 'utf-8' })
      console.log('[CUPS] lpstat -e output:', output)
      const lines = output.split('\n').filter(l => l.trim())

      for (const line of lines) {
        const nombre = line.trim()
        if (nombre && !impresoras.find(i => i.nombre === nombre)) {
          console.log(`[CUPS]   - ${nombre}`)
          impresoras.push({
            tipo: 'CUPS',
            nombre: nombre,
            destino: nombre
          })
        }
      }
    } catch (err) {
      console.log('[CUPS] lpstat -e falló:', err.message)
    }
  }

  // Método 4: Leer directamente de /etc/cups/printers.conf
  if (impresoras.length === 0) {
    try {
      if (fs.existsSync('/etc/cups/printers.conf')) {
        const content = fs.readFileSync('/etc/cups/printers.conf', 'utf-8')
        const matches = content.matchAll(/<Printer\s+([^>]+)>/g)
        for (const match of matches) {
          const nombre = match[1]
          console.log(`[CUPS]   - ${nombre} (desde printers.conf)`)
          impresoras.push({
            tipo: 'CUPS',
            nombre: nombre,
            destino: nombre
          })
        }
      }
    } catch (err) {
      console.log('[CUPS] No se pudo leer printers.conf:', err.message)
    }
  }

  console.log(`[CUPS] Total impresoras detectadas: ${impresoras.length}`)
  return impresoras
}

/**
 * Detecta impresoras en Windows usando wmic o PowerShell
 */
function detectarImpresorasWindows() {
  const impresoras = []

  if (!isWindows) return impresoras

  // Primero intentar con PowerShell (más confiable en Windows 10/11)
  try {
    console.log('[Windows] Detectando impresoras con PowerShell...')
    const output = execSync('powershell -ExecutionPolicy Bypass -Command "Get-Printer | Select-Object -Property Name,PortName | ConvertTo-Csv -NoTypeInformation"', {
      encoding: 'utf-8',
      windowsHide: true,
      timeout: 10000
    })

    const lines = output.split('\n').filter(l => l.trim())
    console.log('[Windows] Respuesta PowerShell:', lines.length, 'líneas')

    for (let i = 1; i < lines.length; i++) {
      // Formato CSV: "Nombre","Puerto"
      const matches = lines[i].match(/"([^"]*)"/g)
      if (matches && matches.length >= 1) {
        const nombre = matches[0].replace(/"/g, '').trim()
        const puerto = matches[1] ? matches[1].replace(/"/g, '').trim() : ''
        if (nombre) {
          console.log(`[Windows]   - ${nombre} (${puerto})`)
          impresoras.push({
            tipo: 'WINDOWS',
            nombre: nombre,
            destino: nombre,
            puerto: puerto
          })
        }
      }
    }

    if (impresoras.length > 0) {
      return impresoras
    }
  } catch (psErr) {
    console.log('[Windows] PowerShell no disponible o falló, intentando wmic...')
  }

  // Fallback: wmic (funciona en Windows 7/8)
  try {
    const output = execSync('wmic printer get Name,PortName,Status /format:csv', {
      encoding: 'utf-8',
      windowsHide: true,
      timeout: 10000
    })
    const lines = output.split('\n').filter(l => l.trim())
    console.log('[Windows] Respuesta wmic:', lines.length, 'líneas')

    // La primera línea es el header: Node,Name,PortName,Status
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',')
      // wmic CSV: Node,Name,PortName,Status
      if (parts.length >= 3) {
        const nombre = parts[1]?.trim()
        const puerto = parts[2]?.trim()
        if (nombre && nombre !== 'Name' && !impresoras.find(p => p.nombre === nombre)) {
          console.log(`[Windows]   - ${nombre} (${puerto})`)
          impresoras.push({
            tipo: 'WINDOWS',
            nombre: nombre,
            destino: nombre,
            puerto: puerto
          })
        }
      }
    }
  } catch (err) {
    console.error('[Windows] Error con wmic:', err.message)
  }

  return impresoras
}

/**
 * Detecta todas las impresoras disponibles
 */
function detectarTodasLasImpresoras() {
  let impresoras = []

  if (isWindows) {
    impresoras = detectarImpresorasWindows()
    console.log(`[Detectar] Windows: ${impresoras.length}`)
  } else {
    const usb = detectarImpresorasUSB()
    const cups = detectarImpresorasCUPS()
    console.log(`[Detectar] USB: ${usb.length}, CUPS: ${cups.length}`)
    impresoras = [...usb, ...cups]
  }

  return impresoras
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
 * Imprime en Windows enviando datos RAW directamente a la impresora
 */
function imprimirWindows(destino, datos, callback) {
  const buffer = Buffer.from(datos, 'base64')

  // Crear archivo temporal en la carpeta temp de Windows
  const tmpDir = process.env.TEMP || process.env.TMP || 'C:\\Temp'
  const tmpFile = `${tmpDir}\\rojoplus-print-${Date.now()}.prn`

  fs.writeFile(tmpFile, buffer, (err) => {
    if (err) {
      console.error('[Windows] Error escribiendo archivo temporal:', err.message)
      callback(err)
      return
    }

    console.log(`[Windows] Archivo temporal: ${tmpFile} (${buffer.length} bytes)`)

    // Crear script PowerShell temporal para imprimir RAW
    const psScript = `${tmpDir}\\rojoplus-print-${Date.now()}.ps1`
    const psContent = `
$printerName = "${destino}"
$filePath = "${tmpFile.replace(/\\/g, '\\\\')}"

Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrinter
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA
    {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    public static bool SendBytes(string printerName, byte[] bytes)
    {
        IntPtr hPrinter = IntPtr.Zero;
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "RojoPlus Ticket";
        di.pDataType = "RAW";

        if (!OpenPrinter(printerName.Normalize(), out hPrinter, IntPtr.Zero))
        {
            Console.WriteLine("Error abriendo impresora: " + Marshal.GetLastWin32Error());
            return false;
        }

        if (!StartDocPrinter(hPrinter, 1, di))
        {
            Console.WriteLine("Error StartDoc: " + Marshal.GetLastWin32Error());
            ClosePrinter(hPrinter);
            return false;
        }

        if (!StartPagePrinter(hPrinter))
        {
            Console.WriteLine("Error StartPage: " + Marshal.GetLastWin32Error());
            EndDocPrinter(hPrinter);
            ClosePrinter(hPrinter);
            return false;
        }

        IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
        Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
        int dwWritten;
        bool success = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out dwWritten);
        Marshal.FreeCoTaskMem(pUnmanagedBytes);

        if (!success)
            Console.WriteLine("Error WritePrinter: " + Marshal.GetLastWin32Error());

        EndPagePrinter(hPrinter);
        EndDocPrinter(hPrinter);
        ClosePrinter(hPrinter);
        return success;
    }
}
'@

$bytes = [System.IO.File]::ReadAllBytes($filePath)
$result = [RawPrinter]::SendBytes($printerName, $bytes)
if ($result) {
    Write-Output "OK"
    exit 0
} else {
    Write-Output "ERROR"
    exit 1
}
`

    fs.writeFile(psScript, psContent, (writeErr) => {
      if (writeErr) {
        console.error('[Windows] Error escribiendo script:', writeErr.message)
        fs.unlink(tmpFile, () => {})
        callback(writeErr)
        return
      }

      exec(`powershell -ExecutionPolicy Bypass -File "${psScript}"`, {
        windowsHide: true,
        timeout: 30000
      }, (psErr, stdout, stderr) => {
        // Limpiar archivos temporales
        fs.unlink(tmpFile, () => {})
        fs.unlink(psScript, () => {})

        if (psErr || stdout.trim() !== 'OK') {
          console.error('[Windows] Error imprimiendo:', stderr || stdout || psErr?.message)
          callback(psErr || new Error('Error al imprimir'))
        } else {
          console.log(`[Windows] Impreso en ${destino}`)
          callback(null)
        }
      })
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
    case 'WINDOWS':
      imprimirWindows(trabajo.destino, trabajo.datos, callback)
      break
    default:
      console.error(`[Trabajo] Tipo de conexión desconocido: ${trabajo.tipoConexion}`)
      callback(new Error('Tipo de conexión no soportado'))
  }
}

/**
 * Procesa un trabajo de impresión de IMAGEN
 * Convierte la imagen a formato bitmap ESC/POS y la envía a la impresora
 */
async function procesarTrabajoImagen(trabajo) {
  console.log(`[Imagen] Procesando: ${trabajo.id} (${trabajo.tipoConexion} -> ${trabajo.destino})`)

  // Extraer datos base64 de la imagen (quitar prefijo data:image/png;base64,)
  let imagenBase64 = trabajo.imagen
  if (imagenBase64.includes(',')) {
    imagenBase64 = imagenBase64.split(',')[1]
  }

  // Decodificar imagen
  const imageBuffer = Buffer.from(imagenBase64, 'base64')

  // Cargar imagen con Jimp
  const image = await Jimp.read(imageBuffer)

  // Redimensionar para impresora térmica de 80mm (~576 píxeles de ancho a 203 DPI)
  const maxWidth = 576
  if (image.getWidth() > maxWidth) {
    image.resize(maxWidth, Jimp.AUTO)
  }

  // Convertir a escala de grises y luego a blanco/negro
  image.grayscale()
  image.contrast(0.2) // Aumentar contraste

  const width = image.getWidth()
  const height = image.getHeight()

  console.log(`[Imagen] Procesando imagen ${width}x${height}`)

  // Convertir a bitmap ESC/POS usando GS v 0
  // Formato: GS v 0 m xL xH yL yH d1...dk
  // m=0 (normal), cada byte = 8 píxeles horizontales
  const bytesPerLine = Math.ceil(width / 8)
  const imageData = Buffer.alloc(bytesPerLine * height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = Jimp.intToRGBA(image.getPixelColor(x, y))
      const brightness = (pixel.r + pixel.g + pixel.b) / 3

      // Si es oscuro (menos de 128), poner bit en 1 (negro)
      if (brightness < 128) {
        const bytePos = Math.floor(x / 8)
        const bitPos = 7 - (x % 8)
        imageData[y * bytesPerLine + bytePos] |= (1 << bitPos)
      }
    }
  }

  // Construir comando ESC/POS
  const xL = bytesPerLine & 0xFF
  const xH = (bytesPerLine >> 8) & 0xFF
  const yL = height & 0xFF
  const yH = (height >> 8) & 0xFF

  // Comando completo: INIT + CENTER + GS v 0 + imagen + FEED + CUT
  const escposCommand = Buffer.concat([
    Buffer.from([0x1B, 0x40]),                    // ESC @ - Initialize printer
    Buffer.from([0x1B, 0x61, 0x01]),              // ESC a 1 - Center alignment
    Buffer.from([0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH]), // GS v 0 - Raster image
    imageData,                                    // Image data
    Buffer.from([0x1B, 0x64, 0x03]),              // ESC d 3 - Feed 3 lines
    Buffer.from([0x1D, 0x56, 0x41, 0x00])         // GS V A - Partial cut
  ])

  const datosBase64 = escposCommand.toString('base64')

  return new Promise((resolve, reject) => {
    const callback = (err) => {
      if (socket && socket.connected) {
        socket.emit('print-agent:impreso', {
          trabajoId: trabajo.id,
          success: !err,
          error: err?.message
        })
      }
      if (err) reject(err)
      else resolve()
    }

    switch (trabajo.tipoConexion) {
      case 'IP':
        imprimirIP(trabajo.destino, datosBase64, callback)
        break
      case 'USB':
        imprimirUSB(trabajo.destino, datosBase64, callback)
        break
      case 'CUPS':
        imprimirCUPS(trabajo.destino, datosBase64, callback)
        break
      case 'WINDOWS':
        imprimirWindows(trabajo.destino, datosBase64, callback)
        break
      default:
        callback(new Error('Tipo de conexión no soportado'))
    }
  })
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

  // Evento para imprimir imágenes (tickets renderizados como imagen)
  socket.on('imprimir-imagen', async (trabajo) => {
    console.log(`[Imagen] Recibido trabajo: ${trabajo.id}`)
    try {
      await procesarTrabajoImagen(trabajo)
    } catch (err) {
      console.error(`[Imagen] Error procesando trabajo ${trabajo.id}:`, err.message)
      if (socket && socket.connected) {
        socket.emit('print-agent:impreso', {
          trabajoId: trabajo.id,
          success: false,
          error: err.message
        })
      }
    }
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
