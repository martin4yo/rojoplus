import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import ActionExecutor from '../services/actionExecutor.js'
import { ROLES } from '../services/aiConstants.js'
import { enviarFeedbackML } from '../services/axioMLService.js'
import { callHub, callHubConfirm } from '../axio/hubClient.js'
import { getToolsForRole } from '../axio/tools/index.js'
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

// ==============================================================================
// ENDPOINT PRINCIPAL - POST /api/chat
// ==============================================================================

/**
 * POST /api/chat
 * Procesa un comando de lenguaje natural via AXIO Hub.
 *
 * Body:
 * {
 *   message: string,
 *   tokenPortal?: string,  // Para socios
 *   role?: 'socio' | 'admin' | 'camarero'
 * }
 *
 * El hub resuelve la intent (Capa 2.6 tool-calling o Capa 2.5 SQL libre)
 * y devuelve `tool_call` o `answer`. Acá ejecutamos los tools localmente
 * con ActionExecutor y devolvemos el message al frontend.
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

    // Verificar que el chat esté habilitado para este tenant
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

    // Sin tenantId no podemos consultar al hub — el hub hashea por tenant
    // para aislar cache y datos.
    if (!req.tenantId) {
      console.error('❌ [chat] req.tenantId undefined — middleware extractTenant no aplicó')
      return res.status(500).json({
        success: false,
        message: 'No pude resolver el contexto del club. Recargá la página o avisá al administrador.',
        error: 'TENANT_NOT_RESOLVED',
      })
    }

    let context = {}

    // Determinar contexto según el token/auth
    if (tokenPortal) {
      // Es un socio
      const socio = await req.db.socio.findFirst({
        where: { tokenPortal },
        include: { estadoSocioRel: { select: { nombre: true } } }
      })

      if (!socio) {
        throw new AppError('Token inválido', 401, 'INVALID_TOKEN')
      }

      context = {
        role: ROLES.SOCIO,
        tenantId: req.tenantId,
        userId: socio.id.toString(),
        socioId: socio.id,
        userName: socio.apellidoNombre,
        metadata: {
          nroSocio: socio.nroSocio,
          email: socio.email,
          estado: socio.estadoSocioRel?.nombre || ''
        }
      }
    } else if (role === ROLES.CAMARERO) {
      // Camarero - TODO: implementar autenticación de camareros
      context = {
        role: ROLES.CAMARERO,
        tenantId: req.tenantId,
        userId: 'camarero-1', // TODO: obtener del token/auth
        userName: 'Camarero',
        metadata: {}
      }
    } else if (role === ROLES.ADMIN) {
      // Admin - TODO: implementar autenticación de admins
      context = {
        role: ROLES.ADMIN,
        tenantId: req.tenantId,
        userId: 'admin-1', // TODO: obtener del token/auth
        userName: 'Administrador',
        metadata: {}
      }
    } else {
      throw new AppError('Se requiere tokenPortal o role', 400, 'MISSING_AUTH')
    }

    console.log(`Usuario: ${context.userName} (${context.role})`)

    const actionExecutor = new ActionExecutor(req.db)

    try {
      const tools = getToolsForRole(context.role)

      // Defensa por rol:
      //  - admin/camarero  → tools + Capa 2.5 SQL libre (scope amplio por diseño).
      //  - socio           → tools_only=true. Sin SQL libre. Si el pedido no matchea
      //                       un tool, el hub devuelve mensaje neutro. La lógica de
      //                       filtrado por socioId vive en los handlers locales.
      const isSocio = context.role === ROLES.SOCIO
      const scopeHint = isSocio
        ? `Usuario socio ID=${context.socioId}. Solo podés ejecutar tools — no respondas con datos crudos del club. Si el pedido no matchea un tool, decí que no podés ayudar con eso.`
        : undefined

      console.log(`📡 [HUB→] tenant=${req.tenantId} role=${context.role} toolsOnly=${!!isSocio} toolsCount=${tools.length}`)
      console.log(`   question: "${message}"`)

      const hubResp = await callHub({
        question: message,
        context: '',
        tenantId: req.tenantId,
        tools,
        scopeHint,
        toolsOnly: isSocio,
      })

      // Fase 5 — el hub detectó una operación de escritura y pide confirmación.
      // Pasar el pending_action directo al widget (AxioChat lo renderiza).
      if (hubResp?.pending_action) {
        console.log(`⏳ [HUB←] pending_action=${hubResp.pending_action.operation} id=${hubResp.pending_action.action_id}`)
        return res.status(200).json({
          answer: hubResp.answer,
          pending_action: hubResp.pending_action,
          model: hubResp.model,
          time_ms: hubResp.time_ms,
          from_cache: false,
        })
      }

      // Tool-call de lectura → ejecutar localmente con ActionExecutor.
      if (hubResp?.tool_call?.name) {
        const action = {
          accion: hubResp.tool_call.name,
          entidades: hubResp.tool_call.args || {},
        }
        console.log(`✅ [HUB←] tool_call=${action.accion} model=${hubResp.model} time_ms=${hubResp.time_ms}`)
        console.log(`   args: ${JSON.stringify(action.entidades).slice(0, 300)}`)
        const executionResult = await actionExecutor.executeAction(action, context)
        console.log(`🎬 [Action] ${action.accion} → success=${executionResult.success}`)
        console.log(`   message: ${(executionResult.message || '').slice(0, 200)}`)
        // Devolver en formato AxioChat (answer, no message)
        return res.status(200).json({
          answer: executionResult.message || (executionResult.success ? 'Listo.' : 'No pude ejecutar esa acción.'),
          model: hubResp.model,
          time_ms: hubResp.time_ms,
          from_cache: false,
          hash_input: null,
        })
      }

      // Capa 2.5 / Capa 3 → respuesta de texto del hub.
      if (hubResp?.answer !== undefined) {
        const answerPreview = (hubResp.answer || '').replace(/\s+/g, ' ').slice(0, 300)
        console.log(`✅ [HUB←] answer model=${hubResp.model} time_ms=${hubResp.time_ms} from_cache=${hubResp.from_cache || false} len=${(hubResp.answer || '').length}`)
        console.log(`   preview: ${answerPreview}${(hubResp.answer || '').length > 300 ? '…' : ''}`)
        return res.status(200).json({
          answer: hubResp.answer,
          hash_input: hubResp.hash_input || null,
          model: hubResp.model,
          time_ms: hubResp.time_ms,
          from_cache: hubResp.from_cache || false,
        })
      }

      console.warn('⚠️  [HUB←] respuesta sin tool_call ni answer:', JSON.stringify(hubResp).slice(0, 300))
      return res.status(502).json({
        answer: 'El asistente no devolvió respuesta. Intentá de nuevo.',
        model: 'error',
        time_ms: 0,
        from_cache: false,
      })
    } catch (err) {
      console.error('Error consultando AXIO Hub:', err.message)
      return res.status(502).json({
        success: false,
        message: 'El asistente no está disponible en este momento. Intentá de nuevo en unos segundos.',
        error: err.message,
      })
    }
  })
)

// ==============================================================================
// HEALTH CHECK
// ==============================================================================

/**
 * GET /api/chat/health
 * Verifica si el chat está habilitado para el tenant.
 */
router.get('/health', asyncHandler(async (req, res) => {
  let agentName = 'Axio'
  let chatEnabled = true

  if (req.db && req.tenantId) {
    const [nombreCfg, enabledCfg] = await Promise.all([
      req.db.configuracion.findFirst({ where: { clave: 'WA_AGENT_NOMBRE' } }).catch(() => null),
      req.db.configuracion.findFirst({ where: { clave: 'CHAT_AGENT_ENABLED' } }).catch(() => null),
    ])
    if (nombreCfg?.valor) agentName = nombreCfg.valor
    if (enabledCfg?.valor === 'false') chatEnabled = false
  }

  return res.json({
    available: chatEnabled,
    agentName,
    service: `${agentName} - Chat Assistant`,
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
// CONFIRM — Fase 5: confirmar/cancelar acción de escritura pendiente
// ==============================================================================

/**
 * POST /api/chat/confirm
 * El widget AxioChat llama este endpoint cuando el usuario confirma o cancela
 * una acción de escritura pendiente (crear socio, generar cargo, etc.).
 *
 * Body: { action_id: string, confirmed: boolean }
 * Proxea al hub /api/ml/action/confirm y devuelve { answer, model, ... }
 * en formato AxioChat para que el widget lo renderice como mensaje.
 */
router.post('/confirm', asyncHandler(async (req, res) => {
  const { action_id, confirmed } = req.body

  if (!action_id || confirmed === undefined) {
    return res.status(400).json({ answer: 'Parámetros inválidos.', model: 'error', time_ms: 0, from_cache: false })
  }

  console.log(`\n🔐 ===== CONFIRM ACTION =====`)
  console.log(`action_id: ${action_id} confirmed: ${confirmed}`)

  try {
    const result = await callHubConfirm({ actionId: action_id, confirmed })

    const message = result.message || (result.success ? 'Operación completada.' : 'Error al ejecutar la operación.')
    console.log(`✅ confirm result: success=${result.success} message=${message.slice(0, 100)}`)

    return res.status(200).json({
      answer: message,
      model: 'write-confirmed',
      time_ms: 0,
      from_cache: false,
    })
  } catch (err) {
    console.error('Error en /confirm:', err.message)
    return res.status(200).json({
      answer: 'No pude confirmar la operación. Intentá de nuevo.',
      model: 'error',
      time_ms: 0,
      from_cache: false,
    })
  }
}))

// ==============================================================================
// FEEDBACK — 👍/👎 sobre respuestas del ML service
// ==============================================================================

/**
 * POST /api/chat/feedback
 * Envía feedback al AXIO ML Hub para ajustar el pattern learning
 *
 * Body: { hashInput, positive, correctedResponse?, invalidate? }
 * invalidate=true borra la entrada de cache de inmediato (admin override).
 */
router.post('/feedback', asyncHandler(async (req, res) => {
  const { hashInput, positive, correctedResponse, invalidate } = req.body

  if (!hashInput || positive === undefined) {
    throw new AppError('hashInput y positive son requeridos', 400, 'MISSING_PARAMS')
  }

  await enviarFeedbackML(hashInput, positive, correctedResponse || null, !!invalidate)

  return res.json({ success: true })
}))

export default router
