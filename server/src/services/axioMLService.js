/**
 * axioMLService.js
 *
 * Cliente para el AXIO ML Hub (axiodemo.axiomacloud.com)
 * Envía consultas al servicio de IA local (Ollama) sin exponer datos al exterior.
 */

const ML_SERVICE_URL = process.env.AXIO_ML_URL || 'http://axiodemo.axiomacloud.com'
const ML_SERVICE_API_KEY = process.env.AXIO_ML_API_KEY || ''

// Módulos disponibles en Clubix y su descripción para el scope del asistente
const MODULOS_DESCRIPCION = {
  socios:         'gestión de socios, cuotas, inscripciones y grupos familiares',
  cobranzas:      'cobranzas, pagos, cuentas corrientes y débito automático',
  buffet:         'administración de buffet, comandas, mesas y ventas',
  deportes:       'actividades deportivas, plantel, disciplinas y torneos',
  accesos:        'control de acceso, molinetes y registro de ingresos',
  eventos:        'gestión de eventos y reservas',
  facturacion:    'facturación electrónica AFIP, comprobantes y CAE',
  finanzas:       'caja, movimientos financieros y tesorería',
  comunicaciones: 'envío de mensajes, notificaciones y WhatsApp',
  rrhh:           'recursos humanos, empleados y liquidación de sueldos',
}

/**
 * Lee los módulos activos para un tenant desde la tabla Configuracion.
 * Clave: AI_MODULOS_ACTIVOS — valor: JSON array, ej: ["socios","buffet","facturacion"]
 * Si no está configurada, devuelve todos los módulos disponibles (sin restricción).
 *
 * @param {object} db — instancia prisma del tenant (req.db)
 * @returns {string} — scope_hint listo para enviar al hub
 */
export async function getScopeHint(db) {
  try {
    const config = await db.configuracion.findFirst({
      where: { clave: 'AI_MODULOS_ACTIVOS' },
    })

    let modulos
    if (config?.valor) {
      modulos = JSON.parse(config.valor)
    } else {
      // Sin configuración → sin restricción de scope
      return null
    }

    const descripciones = modulos
      .filter(m => MODULOS_DESCRIPCION[m])
      .map(m => MODULOS_DESCRIPCION[m])

    if (descripciones.length === 0) return null

    return `Este club solo tiene habilitado: ${descripciones.join('; ')}.`
  } catch {
    return null
  }
}

/**
 * Verifica si el AXIO ML Hub está disponible
 * @returns {Promise<boolean>}
 */
export async function isAxioMLAvailable() {
  try {
    const response = await fetch(`${ML_SERVICE_URL}/ml/health`, {
      signal: AbortSignal.timeout(3000),
    })
    const data = await response.json()
    return data.status === 'healthy'
  } catch {
    return false
  }
}

/**
 * Envía una consulta al AXIO ML Hub
 * @param {string} question - Pregunta o instrucción para el modelo
 * @param {string} context - Contexto con los datos del tenant
 * @param {string} [model='phi3:mini'] - Modelo a usar
 * @param {string} [scopeHint=null] - Scope activo del tenant (de getScopeHint)
 * @param {string} [tenantId=null] - ID del tenant (aislamiento de cache)
 * @returns {Promise<{ answer: string, model: string, time_ms: number, from_cache: boolean, hash_input: string }>}
 */
export async function consultarML(question, context, model = 'phi3:mini', scopeHint = null, tenantId = null) {
  const response = await fetch(`${ML_SERVICE_URL}/api/ml/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ML_SERVICE_API_KEY,
    },
    body: JSON.stringify({
      question,
      context,
      model,
      scope_hint: scopeHint,
      tenant_id: tenantId,
    }),
    signal: AbortSignal.timeout(120000), // 2 min — Ollama puede ser lento en CPU
  })

  if (!response.ok) {
    const texto = await response.text().catch(() => '')
    throw new Error(`AXIO ML Hub error ${response.status}: ${texto}`)
  }

  return response.json()
}

/**
 * Envía feedback de usuario sobre una respuesta del ML service
 * @param {string} hashInput - Hash SHA-256 de la pregunta (viene en la respuesta)
 * @param {boolean} positive - true = 👍, false = 👎
 * @param {string} [correctedResponse] - Respuesta corregida (opcional)
 * @param {boolean} [invalidate=false] - Borra pattern+semantic de inmediato (admin override)
 */
export async function enviarFeedbackML(hashInput, positive, correctedResponse = null, invalidate = false) {
  const response = await fetch(`${ML_SERVICE_URL}/api/ml/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ML_SERVICE_API_KEY,
    },
    body: JSON.stringify({
      hash_input: hashInput,
      positive,
      corrected_response: correctedResponse,
      invalidate,
    }),
    signal: AbortSignal.timeout(5000),
  })

  if (!response.ok) {
    const texto = await response.text().catch(() => '')
    throw new Error(`AXIO ML feedback error ${response.status}: ${texto}`)
  }

  return response.json()
}
