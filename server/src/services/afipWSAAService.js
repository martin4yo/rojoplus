import prisma from '../lib/prisma.js'
import soap from 'soap'
import { parseStringPromise } from 'xml2js'
import { createRequire } from 'module'
import { AppError } from '../middleware/errorHandler.js'

const require = createRequire(import.meta.url)
const forge = require('node-forge')

// Cache del Ticket de Acceso en memoria, por connectionId (o '__legacy__' para
// el flujo viejo de ConfiguracionFiscal). Estructura:
//   { [key]: { token, sign, expirationTime } }
const taCacheByConnection = new Map()

const SERVICE = 'wsfe' // Servicio al que se solicita acceso

/**
 * Genera el TRA (Ticket de Requerimiento de Acceso)
 */
function generateTRA(service) {
  // Restar 2 segundos para evitar problemas de sincronización
  const now = new Date(Date.now() - 2000)

  // Formato ISO 8601 con offset de zona horaria
  const formatForAfip = (date) => {
    const offsetMinutes = date.getTimezoneOffset()
    const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60)
    const offsetMins = Math.abs(offsetMinutes) % 60
    const offsetSign = offsetMinutes <= 0 ? '+' : '-'
    const tzOffset = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMins).padStart(2, '0')}`

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${tzOffset}`
  }

  const generationTime = formatForAfip(now)
  const expiration = new Date(now.getTime() + 12 * 60 * 60 * 1000) // 12 horas
  const expirationTime = formatForAfip(expiration)
  const uniqueId = Math.floor(now.getTime() / 1000)

  const tra = `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${uniqueId}</uniqueId>
    <generationTime>${generationTime}</generationTime>
    <expirationTime>${expirationTime}</expirationTime>
  </header>
  <service>${service}</service>
</loginTicketRequest>`

  console.log('[WSAA] TRA generado:', {
    generationTime,
    expirationTime,
    uniqueId
  })

  return tra
}

/**
 * Firma el TRA con el certificado y clave privada (PKCS#7/CMS)
 */
function signTRA(tra, certificate, privateKey) {
  try {
    const cert = forge.pki.certificateFromPem(certificate)
    const key = forge.pki.privateKeyFromPem(privateKey)

    const p7 = forge.pkcs7.createSignedData()
    p7.content = forge.util.createBuffer(tra, 'utf8')

    p7.addCertificate(cert)
    p7.addSigner({
      key: key,
      certificate: cert,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
        { type: forge.pki.oids.messageDigest },
        { type: forge.pki.oids.signingTime }
      ]
    })

    p7.sign()

    const asn1 = p7.toAsn1()
    const der = forge.asn1.toDer(asn1).getBytes()
    const cms = forge.util.encode64(der)

    return cms
  } catch (error) {
    throw new AppError(`Error firmando TRA: ${error.message}`, 500)
  }
}

/**
 * Solicita el TA (Ticket de Acceso) a WSAA
 */
async function requestTA(wsaaUrl, traCMS, timeout = 30000) {
  try {
    console.log(`[WSAA] Conectando a: ${wsaaUrl}`)

    const options = {
      wsdl_options: {
        timeout: timeout,
        rejectUnauthorized: false,
        strictSSL: false,
        gzip: true
      },
      forceSoap12Headers: false
    }

    const client = await soap.createClientAsync(wsaaUrl, options)
    console.log('[WSAA] Cliente SOAP creado exitosamente')

    const result = await client.loginCmsAsync({ in0: traCMS })
    console.log('[WSAA] Respuesta recibida de AFIP')

    const response = result[0].loginCmsReturn
    const parsed = await parseStringPromise(response)

    const credentials = parsed.loginTicketResponse.credentials[0]
    const header = parsed.loginTicketResponse.header[0]

    return {
      token: credentials.token[0],
      sign: credentials.sign[0],
      expirationTime: new Date(header.expirationTime[0])
    }
  } catch (error) {
    console.error('[WSAA] Error detallado:', error.message)

    // Errores específicos de AFIP
    if (error.message?.includes('coe.alreadyAuthenticated')) {
      throw new AppError('AFIP indica que ya existe un TA válido. Espere unos minutos.', 400)
    }
    if (error.message?.includes('cert.expired')) {
      throw new AppError('Certificado AFIP expirado. Genere uno nuevo desde AFIP.', 400)
    }
    if (error.message?.includes('cert.invalid')) {
      throw new AppError('Certificado AFIP inválido. Verifique que corresponda al CUIT configurado.', 400)
    }
    if (error.message?.includes('generationTime')) {
      throw new AppError('Error de sincronización de hora con AFIP. Verifique el reloj del servidor.', 400)
    }
    if (error.message?.includes('WSDL')) {
      throw new AppError(`No se pudo cargar el WSDL de AFIP. Verifique conectividad.`, 500)
    }
    if (error.message?.includes('timeout')) {
      throw new AppError('Timeout conectando a AFIP WSAA. Verifique conexión a internet.', 500)
    }

    throw new AppError(`Error solicitando TA a WSAA: ${error.message}`, 500)
  }
}

/**
 * Lee un archivo con fallback al directorio local `certs/` si el path
 * absoluto no existe (típico cuando el cert fue subido en otro entorno).
 */
async function leerCertConFallback(absolutePath) {
  const fs = await import('fs/promises')
  const path = await import('path')
  try {
    return await fs.readFile(absolutePath, 'utf8')
  } catch (err) {
    const basename = path.basename(absolutePath)
    const localPath = path.join(process.cwd(), 'certs', basename)
    try {
      const content = await fs.readFile(localPath, 'utf8')
      console.warn(`[WSAA] Path ${absolutePath} no existe, usando fallback ${localPath}`)
      return content
    } catch {
      throw err
    }
  }
}

/**
 * Resuelve la "conexión AFIP efectiva" — un objeto con cuit/certPath/keyPath/
 * environment/urls — desde una AfipConnection (nuevo modelo) o desde
 * ConfiguracionFiscal (legacy).
 *
 * @param {Object} [opts]
 * @param {number} [opts.connectionId]  - Id de AfipConnection específica
 * @returns {Object} { id, cuit, certificadoPath, clavePrivadaPath, environment, wsaaUrl, wsfeUrl, cacheKey }
 */
export async function resolverConexionAfip(db, { connectionId } = {}) {
  // 1. Si viene id explícito, usar esa AfipConnection
  if (connectionId) {
    const conn = await db.afipConnection.findFirst({ where: { id: parseInt(connectionId) } })
    if (!conn) throw new AppError('Conexión AFIP no encontrada', 404)
    if (!conn.activo) throw new AppError('Conexión AFIP inactiva', 400)
    return {
      id: conn.id,
      cuit: conn.cuit,
      certificadoPath: conn.certificadoPath,
      clavePrivadaPath: conn.clavePrivadaPath,
      environment: conn.environment, // TESTING | PRODUCTION
      wsaaUrl: conn.wsaaUrl,
      wsfeUrl: conn.wsfeUrl,
      cacheKey: `conn:${conn.id}`,
    }
  }

  // 2. Si no, buscar AfipConnection default activa
  const conn = await db.afipConnection.findFirst({
    where: { activo: true, esDefault: true },
  }) || await db.afipConnection.findFirst({ where: { activo: true } })

  if (conn) {
    return {
      id: conn.id,
      cuit: conn.cuit,
      certificadoPath: conn.certificadoPath,
      clavePrivadaPath: conn.clavePrivadaPath,
      environment: conn.environment,
      wsaaUrl: conn.wsaaUrl,
      wsfeUrl: conn.wsfeUrl,
      cacheKey: `conn:${conn.id}`,
    }
  }

  // 3. Fallback legacy: ConfiguracionFiscal (un solo registro por tenant)
  const config = await db.configuracionFiscal.findFirst({ where: { activo: true } })
  if (!config) {
    throw new AppError('Configuración AFIP no encontrada (sin AfipConnection ni ConfiguracionFiscal activa)', 404)
  }
  return {
    id: null,
    cuit: config.cuit,
    certificadoPath: config.certificadoPath,
    clavePrivadaPath: config.clavePrivadaPath,
    environment: config.modoProduccion ? 'PRODUCTION' : 'TESTING',
    wsaaUrl: null,
    wsfeUrl: null,
    cacheKey: '__legacy__',
  }
}

/**
 * Obtiene un TA válido para una conexión AFIP (cache por connectionId).
 */
export async function getTicketAcceso(db, { connectionId } = {}) {
  const conn = await resolverConexionAfip(db, { connectionId })

  // Cache check (margen 5 min)
  const now = new Date()
  const safetyMargin = 5 * 60 * 1000
  const cached = taCacheByConnection.get(conn.cacheKey)
  if (cached && cached.expirationTime && cached.expirationTime.getTime() > (now.getTime() + safetyMargin)) {
    console.log(`[WSAA] Usando TA en cache (${conn.cacheKey}), expira: ${cached.expirationTime}`)
    return cached
  }

  if (!conn.certificadoPath || !conn.clavePrivadaPath) {
    throw new AppError('Certificado y clave privada no configurados', 400)
  }

  let certificate, privateKey
  try {
    certificate = await leerCertConFallback(conn.certificadoPath)
    privateKey = await leerCertConFallback(conn.clavePrivadaPath)
  } catch (err) {
    throw new AppError(`Error leyendo certificado/clave: ${err.message}`, 500)
  }

  const wsaaUrl = conn.wsaaUrl || (conn.environment === 'PRODUCTION'
    ? 'https://wsaa.afip.gov.ar/ws/services/LoginCms?WSDL'
    : 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms?WSDL')

  console.log(`[WSAA] Solicitando nuevo TA (${conn.cacheKey}, ambiente: ${conn.environment})`)

  const tra = generateTRA(SERVICE)
  const traCMS = signTRA(tra, certificate, privateKey)
  const ta = await requestTA(wsaaUrl, traCMS)

  taCacheByConnection.set(conn.cacheKey, {
    token: ta.token,
    sign: ta.sign,
    expirationTime: ta.expirationTime,
  })

  console.log(`[WSAA] TA obtenido (${conn.cacheKey}), expira: ${ta.expirationTime}`)
  return ta
}

/**
 * Invalida el TA en cache (todas las conexiones o una específica)
 */
export function invalidateTicket({ connectionId } = {}) {
  if (connectionId) {
    taCacheByConnection.delete(`conn:${connectionId}`)
    console.log(`[WSAA] TA invalidado para connection ${connectionId}`)
  } else {
    taCacheByConnection.clear()
    console.log('[WSAA] Todos los TA invalidados')
  }
}

/**
 * Devuelve datos fiscales del tenant (razón social, domicilio, condición IVA, etc.)
 * Combina ConfiguracionFiscal (datos del club) con la AfipConnection efectiva
 * para retro-compatibilidad: el resultado incluye cuit/certificadoPath/
 * clavePrivadaPath/modoProduccion del flujo viejo.
 */
export async function getConfiguracionFiscal(db, { connectionId } = {}) {
  const config = await db.configuracionFiscal.findFirst({ where: { activo: true } })
  // Si hay AfipConnection, mergear cert/cuit/ambiente desde ahí
  try {
    const conn = await resolverConexionAfip(db, { connectionId })
    return {
      // Datos del club (si los hay)
      ...(config || {}),
      // Datos de la conexión AFIP (pisan los del club)
      cuit: conn.cuit,
      certificadoPath: conn.certificadoPath,
      clavePrivadaPath: conn.clavePrivadaPath,
      modoProduccion: conn.environment === 'PRODUCTION',
      afipConnectionId: conn.id,
    }
  } catch (err) {
    if (!config) throw err
    return config
  }
}
