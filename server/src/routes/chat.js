import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import AIAssistantService from '../services/aiAssistant.js'
import ActionExecutor from '../services/actionExecutor.js'
import { ROLES } from '../services/aiAssistant.js'
import { enviarFeedbackML } from '../services/axioMLService.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'

const router = Router()

// Configurar multer para uploads
const uploadDir = path.join(process.cwd(), 'uploads/chat')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = path.extname(file.originalname)
    cb(null, `chat-upload-${uniqueSuffix}${ext}`)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Tipo de archivo no soportado. Solo PDF, JPG y PNG.'))
    }
  }
})

// Lazy initialization de AI Assistant
let aiAssistant = null
let aiAssistantInitialized = false

function getAIAssistant() {
  if (!aiAssistantInitialized) {
    aiAssistantInitialized = true
    try {
      aiAssistant = new AIAssistantService()
    } catch (error) {
      console.warn('⚠️  AI Assistant no disponible:', error.message)
    }
  }
  return aiAssistant
}

// ==============================================================================
// ENDPOINT PRINCIPAL - POST /api/chat
// ==============================================================================

/**
 * POST /api/chat
 * Procesa un comando de lenguaje natural
 *
 * Body:
 * {
 *   message: string,
 *   tokenPortal?: string,  // Para socios
 *   role?: 'socio' | 'admin' | 'camarero'
 * }
 */
router.post(
  '/',
  [
    body('message').notEmpty().withMessage('Message is required'),
  ],
  asyncHandler(async (req, res) => {
    // Validar request
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    // Verificar que AI Assistant esté disponible
    const assistant = getAIAssistant()
    if (!assistant) {
      return res.status(503).json({
        success: false,
        message: '🚧 El asistente Axio no está disponible en este momento. Por favor, intentá más tarde.',
        error: 'AI Assistant no está configurado. Verifica ANTHROPIC_API_KEY en .env'
      })
    }

    // Verificar que el chat interno esté habilitado para este tenant
    const chatEnabledCfg = await req.db.configuracion.findFirst({
      where: { clave: 'CHAT_AGENT_ENABLED' }
    }).catch(() => null)
    if (chatEnabledCfg && chatEnabledCfg.valor === 'false') {
      return res.status(503).json({
        success: false,
        message: 'El asistente de chat no está disponible en este momento.',
        error: 'CHAT_AGENT_DISABLED'
      })
    }

    const { message, tokenPortal, role } = req.body

    console.log('\n🎯 ===== NUEVA SOLICITUD AL CHATBOT =====')
    console.log(`Mensaje: "${message}"`)
    console.log(`Role: ${role || 'auto-detect'}`)

    let context = {}

    // Determinar contexto según el token/auth
    if (tokenPortal) {
      // Es un socio
      const socio = await req.db.socio.findFirst({
        where: { tokenPortal }
      })

      if (!socio) {
        throw new AppError('Token inválido', 401, 'INVALID_TOKEN')
      }

      context = {
        role: ROLES.SOCIO,
        userId: socio.id.toString(),
        socioId: socio.id,
        userName: socio.apellidoNombre,
        metadata: {
          nroSocio: socio.nroSocio,
          email: socio.email,
          estado: socio.estado
        }
      }
    } else if (role === ROLES.CAMARERO) {
      // Camarero - TODO: implementar autenticación de camareros
      context = {
        role: ROLES.CAMARERO,
        userId: 'camarero-1', // TODO: obtener del token/auth
        userName: 'Camarero',
        metadata: {}
      }
    } else if (role === ROLES.ADMIN) {
      // Admin - TODO: implementar autenticación de admins
      context = {
        role: ROLES.ADMIN,
        userId: 'admin-1', // TODO: obtener del token/auth
        userName: 'Administrador',
        metadata: {}
      }
    } else {
      throw new AppError('Se requiere tokenPortal o role', 400, 'MISSING_AUTH')
    }

    console.log(`Usuario: ${context.userName} (${context.role})`)

    // Leer config IA del tenant (nombre del bot, modelo, api key)
    const configClaves = ['WA_AGENT_NOMBRE', 'AI_MODEL_TIER', 'AI_API_KEY', 'AI_PROVIDER']
    const configRows = await req.db.configuracion.findMany({
      where: { clave: { in: configClaves } }
    }).catch(() => [])
    const cfg = Object.fromEntries(configRows.map(c => [c.clave, c.valor]))
    context.botName = cfg.WA_AGENT_NOMBRE || null
    context.aiModelTier = cfg.AI_MODEL_TIER || null
    context.aiApiKey = cfg.AI_API_KEY || null
    context.aiProvider = cfg.AI_PROVIDER || 'anthropic'

    // Paso 1: Procesar comando con IA
    const aiResponse = await assistant.processCommand(message, context)

    if (!aiResponse.success) {
      return res.status(400).json({
        success: false,
        message: aiResponse.error || '🤔 Mmm, no logré entender bien qué necesitás. ¿Podrías explicármelo de otra forma?',
        error: aiResponse.error
      })
    }

    // Paso 2: Validar acción
    const validation = assistant.validateAction(aiResponse.action)
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: `📝 Me falta información para continuar: ${validation.errors.join(', ')}. ¿Me podés dar más detalles?`,
        errors: validation.errors
      })
    }

    // Paso 3: Ejecutar acción
    const actionExecutor = new ActionExecutor(req.prisma)
    const executionResult = await actionExecutor.executeAction(
      aiResponse.action,
      context
    )

    console.log('✅ ===== SOLICITUD COMPLETADA =====\n')

    return res.status(executionResult.success ? 200 : 400).json({
      success: executionResult.success,
      message: executionResult.message,
      data: executionResult.data,
      error: executionResult.error,
      requiresUserAction: executionResult.requiresUserAction,
      debug: process.env.NODE_ENV === 'development' ? {
        action: aiResponse.action,
        rawAIResponse: aiResponse.rawResponse
      } : undefined
    })
  })
)

// ==============================================================================
// HEALTH CHECK
// ==============================================================================

/**
 * GET /api/chat/health
 * Verifica si el servicio de AI está disponible
 */
router.get('/health', asyncHandler(async (req, res) => {
  const assistant = getAIAssistant()
  let agentName = 'Axio'
  let chatEnabled = true

  if (req.db && req.tenantId) {
    const [nombreCfg, enabledCfg] = await Promise.all([
      req.db.configuracion.findFirst({ where: { clave: 'WA_AGENT_NOMBRE' } }).catch(() => null),
      req.db.configuracion.findFirst({ where: { clave: 'CHAT_AGENT_ENABLED' } }).catch(() => null),
    ])
    if (nombreCfg?.valor) agentName = nombreCfg.valor
    // El flag por tenant tiene prioridad sobre la API key global.
    // Si el tenant lo desactivó explícitamente, el chat no se ofrece (UI lo oculta).
    if (enabledCfg?.valor === 'false') chatEnabled = false
  }

  return res.json({
    available: assistant !== null && chatEnabled,
    agentName,
    service: `${agentName} - Chat Assistant`,
    model: (assistant && chatEnabled) ? 'claude-sonnet-4-20250514' : null,
    chatEnabled,
  })
}))

// ==============================================================================
// UPLOAD DE DOCUMENTOS (para socios)
// ==============================================================================

/**
 * POST /api/chat/upload-document
 * Sube un documento (comprobante de pago, etc.)
 */
router.post(
  '/upload-document',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const { tokenPortal } = req.body

    if (!tokenPortal) {
      throw new AppError('Token requerido', 400, 'MISSING_TOKEN')
    }

    if (!req.file) {
      throw new AppError('No se recibió ningún archivo', 400, 'NO_FILE')
    }

    // Validar socio
    const socio = await req.db.socio.findFirst({
      where: { tokenPortal },
      select: { id: true, nroSocio: true, apellidoNombre: true }
    })

    if (!socio) {
      throw new AppError('Token inválido', 401, 'INVALID_TOKEN')
    }

    console.log('\n📤 ===== UPLOAD DE DOCUMENTO VIA CHAT =====')
    console.log(`Usuario: ${socio.apellidoNombre} (${socio.nroSocio})`)
    console.log(`Archivo: ${req.file.originalname}`)
    console.log(`Tamaño: ${(req.file.size / 1024).toFixed(2)} KB`)

    // TODO: Procesar con OCR si es imagen
    // TODO: Guardar en base de datos

    return res.json({
      success: true,
      message: '✅ Archivo subido correctamente',
      data: {
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        path: req.file.path
      }
    })
  })
)

// ==============================================================================
// FEEDBACK — 👍/👎 sobre respuestas del ML service
// ==============================================================================

/**
 * POST /api/chat/feedback
 * Envía feedback al AXIO ML Hub para ajustar el pattern learning
 *
 * Body: { hashInput: string, positive: boolean, correctedResponse?: string }
 */
router.post('/feedback', asyncHandler(async (req, res) => {
  const { hashInput, positive, correctedResponse } = req.body

  if (!hashInput || positive === undefined) {
    throw new AppError('hashInput y positive son requeridos', 400, 'MISSING_PARAMS')
  }

  await enviarFeedbackML(hashInput, positive, correctedResponse || null)

  return res.json({ success: true })
}))

export default router
