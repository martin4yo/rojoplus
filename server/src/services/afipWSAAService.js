import prisma from '../lib/prisma.js'
import soap from 'soap'
import { parseStringPromise } from 'xml2js'
import { createRequire } from 'module'
import { AppError } from '../middleware/errorHandler.js'

const require = createRequire(import.meta.url)
const forge = require('node-forge')

// Cache del Ticket de Acceso en memoria
let taCache = {
  token: null,
  sign: null,
  expirationTime: null
}

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
 * Obtiene un TA válido (usa cache si está vigente, o solicita uno nuevo)
 */
export async function getTicketAcceso() {
  // Verificar cache en memoria (con margen de 5 minutos)
  const now = new Date()
  const safetyMargin = 5 * 60 * 1000

  if (
    taCache.token &&
    taCache.sign &&
    taCache.expirationTime &&
    taCache.expirationTime.getTime() > (now.getTime() + safetyMargin)
  ) {
    console.log(`[WSAA] Usando TA en cache, expira: ${taCache.expirationTime}`)
    return {
      token: taCache.token,
      sign: taCache.sign,
      expirationTime: taCache.expirationTime
    }
  }

  // Obtener configuración fiscal
  const config = await prisma.configuracionFiscal.findFirst({
    where: { activo: true }
  })

  if (!config) {
    throw new AppError('Configuración fiscal no encontrada', 404)
  }

  if (!config.certificadoPath || !config.clavePrivadaPath) {
    throw new AppError('Certificado y clave privada no configurados', 400)
  }

  // Leer certificado y clave privada
  const fs = await import('fs/promises')
  let certificate, privateKey

  try {
    certificate = await fs.readFile(config.certificadoPath, 'utf8')
    privateKey = await fs.readFile(config.clavePrivadaPath, 'utf8')
  } catch (err) {
    throw new AppError(`Error leyendo certificado/clave: ${err.message}`, 500)
  }

  // Determinar URL según ambiente
  const wsaaUrl = config.modoProduccion
    ? 'https://wsaa.afip.gov.ar/ws/services/LoginCms?WSDL'
    : 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms?WSDL'

  console.log(`[WSAA] Solicitando nuevo TA (ambiente: ${config.modoProduccion ? 'producción' : 'homologación'})`)

  // Generar y firmar TRA
  const tra = generateTRA(SERVICE)
  const traCMS = signTRA(tra, certificate, privateKey)

  // Solicitar TA
  const ta = await requestTA(wsaaUrl, traCMS)

  // Guardar en cache
  taCache = {
    token: ta.token,
    sign: ta.sign,
    expirationTime: ta.expirationTime
  }

  console.log(`[WSAA] TA obtenido exitosamente, expira: ${ta.expirationTime}`)

  return ta
}

/**
 * Invalida el TA en cache
 */
export function invalidateTicket() {
  taCache = { token: null, sign: null, expirationTime: null }
  console.log('[WSAA] TA invalidado')
}

/**
 * Obtiene la configuración fiscal activa
 */
export async function getConfiguracionFiscal() {
  const config = await prisma.configuracionFiscal.findFirst({
    where: { activo: true }
  })

  if (!config) {
    throw new AppError('Configuración fiscal no encontrada', 404)
  }

  return config
}
