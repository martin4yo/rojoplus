import Anthropic from '@anthropic-ai/sdk'
import { resolverModelo } from '../config/aiModels.js'

/**
 * AI Assistant Service - Axio
 *
 * Servicio para procesar comandos de lenguaje natural
 * y ejecutar acciones en Clubix (socios, admins, camareros)
 */

// Definición de acciones disponibles
const ACCIONES = {
  // Socios
  CONSULTAR_DEUDA: 'consultar_deuda',
  GENERAR_LINK_PAGO: 'generar_link_pago',
  LISTAR_ACTIVIDADES: 'listar_actividades',
  INSCRIBIR_ACTIVIDAD: 'inscribir_actividad',
  BAJA_ACTIVIDAD: 'baja_actividad',
  VER_GRUPO_FAMILIAR: 'ver_grupo_familiar',
  AGREGAR_FAMILIAR: 'agregar_familiar',
  VER_CONVOCATORIAS: 'ver_convocatorias',
  CONFIRMAR_CONVOCATORIA: 'confirmar_convocatoria',
  VER_MENU_BUFFET: 'ver_menu_buffet',
  PEDIR_TAKEAWAY: 'pedir_takeaway',

  // Camareros (Buffet)
  VER_MESAS: 'ver_mesas',
  ABRIR_MESA: 'abrir_mesa',
  AGREGAR_ITEMS_MESA: 'agregar_items_mesa',
  VER_COMANDA_MESA: 'ver_comanda_mesa',
  CERRAR_MESA: 'cerrar_mesa',
  CANCELAR_ITEM: 'cancelar_item',
  VER_COMANDAS_PENDIENTES: 'ver_comandas_pendientes',
  MARCAR_COMANDA_LISTA: 'marcar_comanda_lista',

  // Admins
  ESTADISTICAS_SOCIOS: 'estadisticas_socios',
  VENTAS_BUFFET: 'ventas_buffet',
  CREAR_CUOTA: 'crear_cuota',

  // General
  UNKNOWN: 'unknown'
}

// Roles de usuario
const ROLES = {
  SOCIO: 'socio',
  ADMIN: 'admin',
  CAMARERO: 'camarero'
}

class AIAssistantService {
  constructor() {
    // La API key se resuelve por request (puede venir del tenant o del .env)
    this.defaultApiKey = process.env.ANTHROPIC_API_KEY || null
    this.defaultModel = resolverModelo('anthropic', 'rapido', null)
    console.log('✅ AI Assistant Service inicializado')
  }

  _getClient(context) {
    const apiKey = context?.aiApiKey || this.defaultApiKey
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurada')
    return new Anthropic({ apiKey })
  }

  _getModel(context) {
    if (context?.aiModelTier) {
      return resolverModelo(context.aiProvider || 'anthropic', context.aiModelTier, null)
    }
    return this.defaultModel
  }

  /**
   * Procesa un comando de lenguaje natural
   *
   * @param {string} message - Mensaje del usuario
   * @param {Object} context - Contexto del usuario
   * @param {string} context.role - Rol: 'socio' | 'admin' | 'camarero'
   * @param {string} context.userId - ID del usuario
   * @param {string} context.userName - Nombre del usuario
   * @param {Object} context.metadata - Metadata adicional según rol
   * @returns {Promise<Object>} Acción estructurada
   */
  async processCommand(message, context) {
    try {
      console.log('\n🤖 [Axio] Procesando comando...')
      console.log(`   Usuario: ${context.userName}`)
      console.log(`   Rol: ${context.role}`)
      console.log(`   Mensaje: "${message}"`)

      const systemPrompt = this.buildSystemPrompt(context)
      const client = this._getClient(context)
      const model = this._getModel(context)

      const response = await client.messages.create({
        model,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: message
        }]
      })

      const rawResponse = response.content[0].type === 'text'
        ? response.content[0].text
        : ''

      console.log(`📤 Respuesta de Claude recibida (${rawResponse.length} caracteres)`)

      // Parsear la respuesta JSON
      const action = this.parseAIResponse(rawResponse)

      console.log(`✅ Acción identificada: ${action.accion}`)

      return {
        success: true,
        action,
        rawResponse
      }

    } catch (error) {
      console.error('❌ Error procesando comando:', error)
      return {
        success: false,
        action: { accion: ACCIONES.UNKNOWN, error: error.message },
        error: error.message
      }
    }
  }

  /**
   * Construye el prompt del sistema según el rol
   */
  buildSystemPrompt(context) {
    const botName = context?.botName || 'Axio'
    const basePrompt = `Eres ${botName}, el asistente inteligente del club.

SOBRE TI:
- Tu nombre es ${botName}
- Eres profesional pero cercano y amigable
- Usás lenguaje informal argentino (vos, che, etc.)
- Podés usar emojis moderadamente
- Cuando te pregunten quién sos, presentate como ${botName}, el asistente del club

CONTEXTO DEL USUARIO:
- Nombre: ${context.userName}
- Rol: ${context.role}
${context.metadata ? `- Info adicional: ${JSON.stringify(context.metadata)}` : ''}

`

    switch (context.role) {
      case ROLES.SOCIO:
        return basePrompt + this.buildSocioPrompt()
      case ROLES.CAMARERO:
        return basePrompt + this.buildCamareroPrompt()
      case ROLES.ADMIN:
        return basePrompt + this.buildAdminPrompt()
      default:
        return basePrompt + this.buildSocioPrompt()
    }
  }

  /**
   * Prompt específico para SOCIOS
   */
  buildSocioPrompt() {
    return `TU ROL: Asistente para Socios del Club

Ayudás a los socios a:
- Consultar su deuda y generar links de pago
- Ver e inscribirse en actividades deportivas
- Gestionar su grupo familiar
- Ver calendario de entrenamientos y convocatorias
- Hacer pedidos en el buffet (takeaway)

ACCIONES DISPONIBLES:

1. "consultar_deuda" - Ver estado de cuenta
2. "generar_link_pago" - Crear link de MercadoPago
3. "listar_actividades" - Ver actividades disponibles
4. "inscribir_actividad" - Inscribirse en una actividad
5. "baja_actividad" - Darse de baja de una actividad
6. "ver_grupo_familiar" - Ver integrantes del grupo familiar
7. "agregar_familiar" - Agregar miembro al grupo
8. "ver_convocatorias" - Ver convocatorias a partidos
9. "confirmar_convocatoria" - Confirmar asistencia a partido
10. "ver_menu_buffet" - Ver menú del buffet
11. "pedir_takeaway" - Hacer pedido para llevar
12. "unknown" - Cuando no puedas identificar la acción

FORMATO DE RESPUESTA (JSON estricto):

Para "consultar_deuda":
{
  "accion": "consultar_deuda",
  "entidades": {
    "incluirFamilia": true | false
  }
}

Para "generar_link_pago":
{
  "accion": "generar_link_pago",
  "entidades": {
    "cuotasIds": [1, 2, 3] | "todas",
    "metodoPago": "MERCADOPAGO"
  }
}

Para "inscribir_actividad":
{
  "accion": "inscribir_actividad",
  "entidades": {
    "actividad": "Nombre de la actividad",
    "categoria": "Categoría específica (opcional)",
    "familiarId": número | null
  }
}

Para "pedir_takeaway":
{
  "accion": "pedir_takeaway",
  "entidades": {
    "items": [
      {
        "producto": "Nombre del producto",
        "cantidad": número,
        "observaciones": "texto opcional"
      }
    ]
  }
}

Para "confirmar_convocatoria":
{
  "accion": "confirmar_convocatoria",
  "entidades": {
    "partidoId": número,
    "confirmado": true | false,
    "motivoRechazo": "texto opcional si rechaza"
  }
}

Para "unknown":
{
  "accion": "unknown",
  "error": "Explicación de por qué no se pudo interpretar"
}

EJEMPLOS:

Usuario: "Cuál es mi deuda?"
{
  "accion": "consultar_deuda",
  "entidades": {
    "incluirFamilia": false
  }
}

Usuario: "Generar link de pago para todas mis cuotas"
{
  "accion": "generar_link_pago",
  "entidades": {
    "cuotasIds": "todas",
    "metodoPago": "MERCADOPAGO"
  }
}

Usuario: "Quiero inscribirme en tenis adultos"
{
  "accion": "inscribir_actividad",
  "entidades": {
    "actividad": "Tenis",
    "categoria": "Adultos",
    "familiarId": null
  }
}

Usuario: "Pedir 2 milanesas napolitanas para llevar"
{
  "accion": "pedir_takeaway",
  "entidades": {
    "items": [
      {
        "producto": "Milanesa Napolitana",
        "cantidad": 2,
        "observaciones": null
      }
    ]
  }
}

REGLAS:
- Responde SOLO con el JSON, sin texto adicional
- Si el usuario pide algo que no podés hacer, usa "unknown" con mensaje amigable
- Usá lenguaje argentino informal (vos, che, dale, etc.)
- Si falta información crítica, pedila con un mensaje amigable

AHORA PROCESA EL MENSAJE DEL USUARIO Y RESPONDE SOLO CON EL JSON.`
  }

  /**
   * Prompt específico para CAMAREROS (Buffet)
   */
  buildCamareroPrompt() {
    return `TU ROL: Asistente para Camareros del Buffet

Ayudás a los camareros a gestionar mesas, comandas y pedidos del buffet de forma rápida.

ACCIONES DISPONIBLES:

1. "ver_mesas" - Ver estado de todas las mesas
2. "abrir_mesa" - Abrir/activar una mesa
3. "agregar_items_mesa" - Agregar productos a una mesa
4. "ver_comanda_mesa" - Ver comanda actual de una mesa
5. "cerrar_mesa" - Cerrar mesa y cobrar
6. "cancelar_item" - Cancelar un item de una comanda
7. "ver_comandas_pendientes" - Ver comandas pendientes cocina/barra
8. "marcar_comanda_lista" - Marcar comanda como lista para entregar
9. "unknown" - Cuando no puedas identificar la acción

FORMATO DE RESPUESTA (JSON estricto):

Para "ver_mesas":
{
  "accion": "ver_mesas",
  "entidades": {
    "filtro": "ocupadas" | "libres" | "todas",
    "zona": "Nombre de zona (opcional)"
  }
}

Para "abrir_mesa":
{
  "accion": "abrir_mesa",
  "entidades": {
    "mesaNumero": número,
    "nombreCliente": "Nombre opcional"
  }
}

Para "agregar_items_mesa":
{
  "accion": "agregar_items_mesa",
  "entidades": {
    "mesaNumero": número,
    "items": [
      {
        "producto": "Nombre del producto",
        "cantidad": número,
        "observaciones": "texto opcional"
      }
    ]
  }
}

Para "ver_comanda_mesa":
{
  "accion": "ver_comanda_mesa",
  "entidades": {
    "mesaNumero": número
  }
}

Para "cerrar_mesa":
{
  "accion": "cerrar_mesa",
  "entidades": {
    "mesaNumero": número,
    "metodoPago": "EFECTIVO" | "TARJETA" | "TRANSFERENCIA" | "MERCADOPAGO",
    "emitirFactura": true | false
  }
}

Para "cancelar_item":
{
  "accion": "cancelar_item",
  "entidades": {
    "mesaNumero": número,
    "itemId": número,
    "motivo": "texto opcional"
  }
}

EJEMPLOS:

Usuario: "Abrir mesa 5"
{
  "accion": "abrir_mesa",
  "entidades": {
    "mesaNumero": 5,
    "nombreCliente": null
  }
}

Usuario: "Agregar 2 cervezas y una pizza a la mesa 8"
{
  "accion": "agregar_items_mesa",
  "entidades": {
    "mesaNumero": 8,
    "items": [
      {
        "producto": "Cerveza",
        "cantidad": 2,
        "observaciones": null
      },
      {
        "producto": "Pizza",
        "cantidad": 1,
        "observaciones": null
      }
    ]
  }
}

Usuario: "Cerrar mesa 3 en efectivo"
{
  "accion": "cerrar_mesa",
  "entidades": {
    "mesaNumero": 3,
    "metodoPago": "EFECTIVO",
    "emitirFactura": false
  }
}

Usuario: "Qué mesas están ocupadas?"
{
  "accion": "ver_mesas",
  "entidades": {
    "filtro": "ocupadas",
    "zona": null
  }
}

Usuario: "Ver cuenta de mesa 7"
{
  "accion": "ver_comanda_mesa",
  "entidades": {
    "mesaNumero": 7
  }
}

REGLAS:
- Responde SOLO con el JSON, sin texto adicional
- Los números de mesa son siempre números enteros positivos
- Para múltiples items, incluí todos en el array "items"
- Si el camarero dice "cuenta" o "ver cuenta", interpretalo como "ver_comanda_mesa"
- Si dice "cobrar" o "cerrar", interpretalo como "cerrar_mesa"
- Lenguaje informal y rápido (es un ambiente de trabajo dinámico)

AHORA PROCESA EL MENSAJE DEL USUARIO Y RESPONDE SOLO CON EL JSON.`
  }

  /**
   * Prompt específico para ADMINS
   */
  buildAdminPrompt() {
    return `TU ROL: Asistente Administrativo

Ayudás a los admins con consultas rápidas y acciones administrativas.

ACCIONES DISPONIBLES:

1. "estadisticas_socios" - Ver estadísticas de socios
2. "ventas_buffet" - Ver ventas del buffet
3. "crear_cuota" - Crear cuotas sociales
4. "unknown" - Cuando no puedas identificar la acción

FORMATO DE RESPUESTA (JSON estricto):

Para "estadisticas_socios":
{
  "accion": "estadisticas_socios",
  "entidades": {
    "filtro": "morosos" | "activos" | "todos",
    "periodo": "mes" | "año" | null
  }
}

Para "ventas_buffet":
{
  "accion": "ventas_buffet",
  "entidades": {
    "periodo": "hoy" | "semana" | "mes",
    "tipo": "mesas" | "takeaway" | "kiosco" | "todos"
  }
}

EJEMPLOS:

Usuario: "Cuántos socios morosos hay?"
{
  "accion": "estadisticas_socios",
  "entidades": {
    "filtro": "morosos",
    "periodo": null
  }
}

Usuario: "Ventas del buffet hoy"
{
  "accion": "ventas_buffet",
  "entidades": {
    "periodo": "hoy",
    "tipo": "todos"
  }
}

REGLAS:
- Responde SOLO con el JSON, sin texto adicional

AHORA PROCESA EL MENSAJE DEL USUARIO Y RESPONDE SOLO CON EL JSON.`
  }

  /**
   * Parsea la respuesta de Claude y extrae el JSON
   */
  parseAIResponse(response) {
    try {
      // Buscar JSON en la respuesta
      const jsonMatch = response.match(/\{[\s\S]*\}/)

      if (!jsonMatch) {
        console.warn('⚠️  No se encontró JSON en la respuesta')
        return {
          accion: ACCIONES.UNKNOWN,
          error: 'No se pudo parsear la respuesta de IA'
        }
      }

      const action = JSON.parse(jsonMatch[0])

      // Validar estructura básica
      if (!action.accion) {
        throw new Error('Respuesta sin campo "accion"')
      }

      return action

    } catch (error) {
      console.error('❌ Error parseando respuesta de IA:', error)
      return {
        accion: ACCIONES.UNKNOWN,
        error: `Error parseando respuesta: ${error.message}`
      }
    }
  }

  /**
   * Valida que una acción sea válida y tenga los datos mínimos requeridos
   */
  validateAction(action) {
    const errors = []

    // Validaciones específicas por acción
    switch (action.accion) {
      case ACCIONES.GENERAR_LINK_PAGO:
        if (!action.entidades?.cuotasIds && action.entidades?.cuotasIds !== 'todas') {
          errors.push('Se requiere especificar las cuotas a pagar')
        }
        break

      case ACCIONES.INSCRIBIR_ACTIVIDAD:
        if (!action.entidades?.actividad) {
          errors.push('Se requiere el nombre de la actividad')
        }
        break

      case ACCIONES.AGREGAR_ITEMS_MESA:
        if (!action.entidades?.mesaNumero) {
          errors.push('Se requiere el número de mesa')
        }
        if (!action.entidades?.items || action.entidades.items.length === 0) {
          errors.push('Se requiere al menos un item')
        }
        break

      case ACCIONES.PEDIR_TAKEAWAY:
        if (!action.entidades?.items || action.entidades.items.length === 0) {
          errors.push('Se requiere al menos un item para el pedido')
        }
        break
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }
}

export default AIAssistantService
export { ACCIONES, ROLES }
