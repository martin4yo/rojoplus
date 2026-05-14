/**
 * hubClient — cliente para AXIO Hub (cuthulu/ml-service).
 *
 * Centraliza la llamada al endpoint /api/ml/query del hub. Se usa para Capa
 * 2.5 (text-to-SQL via Claude) y Capa 2.6 (tool-calling). El hub decide qué
 * capa activar según la pregunta y los tools recibidos.
 *
 * NOTA env vars: clubix usa los nombres legacy AXIO_ML_URL / AXIO_ML_API_KEY
 * por compatibilidad con el deploy productivo existente. mini usa AXIO_HUB_URL
 * / AXIO_API_KEY — esa unificación de nombres queda para Fase C.
 */

const HUB_URL = process.env.AXIO_ML_URL || 'http://axiodemo.axiomacloud.com'
const HUB_API_KEY = process.env.AXIO_ML_API_KEY || ''
const HUB_TIMEOUT_MS = parseInt(process.env.AXIO_HUB_TIMEOUT_MS || '300000', 10)

/**
 * Llama al hub /api/ml/query.
 *
 * @param {Object} params
 * @param {string} params.question         - Pregunta del usuario.
 * @param {string} [params.context]        - Contexto multi-turno (string concatenado).
 * @param {string|number} params.tenantId  - Tenant id del cliente (req.tenant.id).
 * @param {Array}  [params.tools]          - Tools inline para Capa 2.6.
 * @param {string} [params.scopeHint]      - Texto opcional restringiendo scope.
 * @param {boolean} [params.toolsOnly]     - Si true y los tools no matchean, el hub
 *                                          devuelve respuesta neutra y NO ejecuta
 *                                          Capa 2.5 SQL. Usado para roles restringidos
 *                                          (ej. socio).
 * @returns {Promise<Object>} Respuesta del hub. Forma posible:
 *   - { answer, model, time_ms, from_cache, hash_input }            (Capa 2.5/3)
 *   - { tool_call: {name, args}, model, time_ms }                   (Capa 2.6)
 */
export async function callHub({ question, context, tenantId, tools, scopeHint, toolsOnly }) {
  if (!HUB_API_KEY) {
    throw new Error('AXIO_ML_API_KEY no configurada en el servidor')
  }

  // El hub valida tenant_id como string (Pydantic strict). Apps con tenantId
  // numérico (clubix usa Int) o cuid (mini) caen al mismo string acá.
  const body = {
    question,
    context: context || '',
    tenant_id: tenantId != null ? String(tenantId) : null,
  }
  if (tools && tools.length > 0) body.tools = tools
  if (scopeHint) body.scope_hint = scopeHint
  if (toolsOnly) body.tools_only = true

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), HUB_TIMEOUT_MS)

  try {
    const response = await fetch(`${HUB_URL}/api/ml/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': HUB_API_KEY,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`Hub error ${response.status}: ${text || response.statusText}`)
    }

    return await response.json()
  } finally {
    clearTimeout(timeoutId)
  }
}
