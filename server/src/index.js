import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import path from 'path'
import { fileURLToPath } from 'url'
import prisma from './lib/prisma.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Routes
import rubrosRoutes from './routes/rubros.js'
import comerciosRoutes from './routes/comercios.js'
import comercioRoutes from './routes/comercio.js'
import adminRoutes from './routes/admin/index.js'
import socioRoutes from './routes/socio.js'
import entrenadorRoutes from './routes/entrenador.js'
import pagosRoutes from './routes/pagos.js'
import contabilidadRoutes from './routes/contabilidad.js'
import tesoreriaRoutes from './routes/tesoreria.js'
import stockRoutes from './routes/stock.js'
import movimientosContablesRoutes from './routes/movimientosContables.js'
import usuariosRoutes from './routes/usuarios.js'
import liquidacionesRoutes from './routes/liquidaciones.js'
import mantenimientoRoutes from './routes/mantenimiento.js'
import asientosRoutes from './routes/asientos.js'
import deportesRoutes from './routes/deportes.js'
import presupuestoRoutes from './routes/presupuesto.js'
import templatesRoutes from './routes/templates.js'
import publicRoutes from './routes/public.js'
import cierreCajaRoutes from './routes/cierreCaja.js'
import dashboardEjecutivoRoutes from './routes/dashboardEjecutivo.js'
import reportesMorosidadRoutes from './routes/reportesMorosidad.js'
import pushSubscriptionRoutes from './routes/pushSubscription.js'
import debitoAutomaticoRoutes from './routes/debitoAutomatico.js'
import paywayRoutes from './routes/payway.js'
import bannersRoutes from './routes/banners.js'
import noticiasRoutes from './routes/noticias.js'
import contactoRoutes from './routes/contacto.js'
import autoridadesRoutes from './routes/autoridades.js'
import reportesDeportivosRoutes from './routes/reportesDeportivos.js'
import pasajeCategoriaRoutes from './routes/pasajeCategoria.js'
import conciliacionBancariaRoutes from './routes/conciliacionBancaria.js'
import buffetRoutes from './routes/buffet/index.js'
import adjuntosRoutes from './routes/adjuntos.js'
import staffTecnicoRoutes from './routes/staffTecnico.js'
import noticiasDeportivasRoutes from './routes/noticiasDeportivas.js'
import reglamentoRoutes from './routes/reglamento.js'
import accesosRoutes from './routes/accesos.js'
import eventosRoutes from './routes/eventos.js'
import reservasRoutes from './routes/reservas.js'
import importacionRoutes from './routes/importacion.js'
import facturacionRoutes from './routes/facturacion.js'
import menuRoutes from './routes/menu.js'
import chatRoutes from './routes/chat.js'
import superAdminRoutes from './routes/super-admin/index.js'
import brandingRoutes from './routes/admin/branding.js'
import authRoutes from './routes/admin/auth.js'
import whatsappRoutes from './routes/whatsapp/webhook.js'
import webhooksMpRoutes from './routes/webhooksMercadoPago.js'
import tiendaRoutes from './routes/tienda/index.js'

// Services
import { verificarConexionSMTP } from './services/email.js'
import { iniciarCronJobs, detenerCronJobs } from './jobs/notificaciones.js'
import { iniciarCronsVigencia } from './jobs/vigenciaSocios.js'
import { iniciarCronTienda, detenerCronTienda } from './jobs/tienda.js'
import { initSocket } from './services/socketService.js'

// Middlewares
import { errorHandler } from './middleware/errorHandler.js'
import { extractTenant, extractTenantOptional, requireSuperAdmin } from './middleware/extractTenant.js'
import { createTenantPrisma } from './lib/tenantPrisma.js'
import rateLimit from 'express-rate-limit'

const app = express()
const httpServer = createServer(app)
const PORT = process.env.PORT || 3000

// Cuando un cliente cierra la conexión durante un res.send/res.end con un buffer
// grande (ej: descarga de Excel/PDF cancelada), el socket emite 'error' (write EOF/ECONNRESET).
// Sin listener, Node mata el proceso. Lo capturamos como warning y seguimos.
httpServer.on('connection', (socket) => {
  socket.on('error', (err) => {
    if (['ECONNRESET', 'EPIPE', 'ECANCELED'].includes(err?.code) || err?.message === 'write EOF') {
      return
    }
    console.warn('[httpServer] socket error:', err?.code || err?.message)
  })
})

// Red de seguridad global: errores de socket benignos (cliente desconectado,
// conexiones outgoing de Prisma/SMTP/etc) NO deben matar el proceso.
process.on('uncaughtException', (err) => {
  const benigno =
    ['ECONNRESET', 'EPIPE', 'ECANCELED', 'EOF'].includes(err?.code) ||
    err?.message === 'write EOF' ||
    err?.syscall === 'write'
  if (benigno) {
    console.warn(`[uncaughtException benigno] ${err?.code || err?.message}`)
    return
  }
  console.error('[uncaughtException]', err)
  // No exit — dejamos que el proceso siga vivo (los handlers de Express siguen funcionando)
})

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason)
})

// Confiar en el primer proxy (nginx/cloudflare) para que req.ip y X-Forwarded-For funcionen bien con express-rate-limit
app.set('trust proxy', 1)

// Middlewares globales
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}))
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000']

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (Postman, curl, etc.)
    if (!origin) return callback(null, true)
    // Permitir cualquier subdomain de localhost
    if (/^https?:\/\/[^/]*\.localhost(:\d+)?$/.test(origin)) return callback(null, true)
    // Permitir cualquier subdomain de clubix.com.ar (multi-tenant)
    if (/^https:\/\/[^/]*\.clubix\.com\.ar$/.test(origin)) return callback(null, true)
    // Permitir origins configurados
    if (allowedOrigins.includes(origin)) return callback(null, true)
    callback(new Error(`CORS: origin no permitido: ${origin}`))
  },
  credentials: true,
  exposedHeaders: ['Content-Disposition']
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))
app.use(cookieParser())

// Servir archivos estáticos (fotos de socios)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

// Servir archivos públicos (plantillas, etc)
app.use('/public', express.static(path.join(__dirname, '../public')))

// Pasar prisma a las rutas (fallback para req.db si no está configurado)
app.use((req, res, next) => {
  req.prisma = prisma
  // Fallback: si req.db no está configurado, usar prisma global
  if (!req.db) {
    req.db = prisma
  }
  next()
})

// ===== MULTI-TENANT SETUP =====
// Rutas que requieren tenant context
// BUT: login endpoint bypasses extractTenant
// Routes that bypass tenant extraction (work without subdomain)
const TENANT_FREE_ROUTES = ['/api/admin/login', '/api/admin/select-tenant']

app.use('/api/admin/*', (req, res, next) => {
  // Skip extractTenant for routes that work without tenant context
  if (TENANT_FREE_ROUTES.some(route => req.originalUrl.startsWith(route))) {
    return next()
  }
  // Apply tenant extraction for all other admin routes
  extractTenant(req, res, (err) => {
    if (err) return next(err)
    req.db = createTenantPrisma(req.tenantId)
    next()
  })
})

// Rate limiters
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  message: { success: false, message: 'Demasiados intentos de login. Intentá de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
})

const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5,
  message: { success: false, message: 'Demasiados intentos de registro. Intentá de nuevo en 1 hora.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// Rate limit aplicado directamente al endpoint POST /api/admin/login.
// (El montaje real de las rutas de auth se hace via adminRoutes más abajo.)
app.post('/api/admin/login', loginRateLimit, (req, res, next) => next())
app.use('/api/socio/*', extractTenant, (req, res, next) => {
  req.db = createTenantPrisma(req.tenantId)
  next()
})
app.use('/api/entrenador/*', extractTenant, (req, res, next) => {
  req.db = createTenantPrisma(req.tenantId)
  next()
})
app.use('/api/buffet/*', extractTenant, (req, res, next) => {
  req.db = createTenantPrisma(req.tenantId)
  next()
})
app.use('/api/tienda/*', extractTenant, (req, res, next) => {
  req.db = createTenantPrisma(req.tenantId)
  next()
})
app.use('/api/reservas/*', extractTenant, (req, res, next) => {
  req.db = createTenantPrisma(req.tenantId)
  next()
})

// Rutas públicas con tenant opcional
app.use('/api/public/*', extractTenantOptional, (req, res, next) => {
  if (req.tenantId) {
    req.db = createTenantPrisma(req.tenantId)
  }
  next()
})

// Rutas super-admin (sin tenant scope)
app.use('/api/super-admin/tenants/register', registerRateLimit)
app.use('/api/super-admin/*', requireSuperAdmin)

// Endpoint de tenant actual (necesario para frontend)
app.get('/api/tenant/current', extractTenant, async (req, res) => {
  try {
    const db = createTenantPrisma(req.tenantId)
    const [heroConfig, waConfig] = await Promise.all([
      prisma.tenantConfiguracion.findUnique({
        where: { tenantId_clave: { tenantId: req.tenantId, clave: 'HERO_IMAGES' } }
      }),
      db.configuracion.findFirst({ where: { clave: 'WA_AGENT_ENABLED' } }),
    ])
    let heroImages = []
    if (heroConfig?.valor) {
      try { heroImages = JSON.parse(heroConfig.valor) } catch {}
    }
    if (!heroImages.length && req.tenant.heroImageUrl) {
      heroImages = [req.tenant.heroImageUrl]
    }
    res.json({ ...req.tenant, heroImages, waEnabled: waConfig?.valor === 'true' })
  } catch {
    res.json(req.tenant)
  }
})

// ===== FIN MULTI-TENANT SETUP =====

// Auth routes (bypass tenant middleware - login before tenant context)
app.use('/api/auth', authRoutes)

// Rutas
app.use('/api/rubros', rubrosRoutes)
app.use('/api/comercios', extractTenant, (req, res, next) => {
  req.db = createTenantPrisma(req.tenantId)
  next()
}, comerciosRoutes)
app.use('/api/comercio', extractTenant, (req, res, next) => {
  req.db = createTenantPrisma(req.tenantId)
  next()
}, comercioRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/admin', contabilidadRoutes)
app.use('/api/admin', tesoreriaRoutes)
app.use('/api/admin', stockRoutes)
app.use('/api/admin', movimientosContablesRoutes)
app.use('/api/admin', usuariosRoutes)
app.use('/api/admin', liquidacionesRoutes)
app.use('/api/admin', mantenimientoRoutes)
app.use('/api/admin/asientos', asientosRoutes)
app.use('/api/admin', deportesRoutes)
app.use('/api/admin', presupuestoRoutes)
app.use('/api/admin/templates', templatesRoutes)
app.use('/api/admin/cierres-caja', cierreCajaRoutes)
app.use('/api/admin/dashboard', dashboardEjecutivoRoutes)
app.use('/api/admin/reportes/morosidad', reportesMorosidadRoutes)
app.use('/api/socio', socioRoutes)
app.use('/api/socio', pushSubscriptionRoutes)
app.use('/api/entrenador', entrenadorRoutes)
app.use('/api/admin/debito', debitoAutomaticoRoutes)
app.use('/api/admin/payway', paywayRoutes)
app.use('/api/payway', paywayRoutes) // webhook público (sin auth)
app.use('/api/pagos', pagosRoutes)
app.use('/api/public', publicRoutes)
app.use('/api', bannersRoutes)
app.use('/api', noticiasRoutes)
app.use('/api', contactoRoutes)
app.use('/api/admin/autoridades', autoridadesRoutes)
app.use('/api/autoridades', extractTenant, (req, res, next) => {
  req.db = createTenantPrisma(req.tenantId)
  next()
}, autoridadesRoutes)
app.use('/api/admin/reportes/deportivos', reportesDeportivosRoutes)
app.use('/api/admin/categorias/pasaje', pasajeCategoriaRoutes)
app.use('/api/admin/conciliacion', conciliacionBancariaRoutes)
app.use('/api/admin/buffet', buffetRoutes)
app.use('/api/admin/adjuntos', adjuntosRoutes)
app.use('/api/admin/staff-tecnico', staffTecnicoRoutes)
app.use('/api/admin/noticias-deportivas', noticiasDeportivasRoutes)
app.use('/api/admin/reglamento', reglamentoRoutes)
app.use('/api/accesos', accesosRoutes)
app.use('/api/eventos', extractTenant, (req, res, next) => {
  req.db = createTenantPrisma(req.tenantId)
  next()
}, eventosRoutes)
app.use('/api/reservas', reservasRoutes)
app.use('/api/buffet', buffetRoutes) // Ruta pública para menú
app.use('/api/importacion', importacionRoutes)
app.use('/api/admin/facturacion', facturacionRoutes)
app.use('/api/admin/menu', menuRoutes)
app.use('/api/tienda', tiendaRoutes)
app.use('/api/admin/branding', brandingRoutes)
// extractTenantOptional + req.db para TODO /api/chat (incluye POST a /api/chat
// sin sufijo, no solo subpaths como /api/chat/health). Antes el path tenía un
// wildcard `/*` que NO matcheaba el path base, dejando req.tenantId=undefined
// y rompiendo el cache hashing del hub AXIO.
const ensureChatTenantContext = (req, res, next) => {
  if (req.tenantId) req.db = createTenantPrisma(req.tenantId)
  next()
}
app.use('/api/chat', extractTenantOptional, ensureChatTenantContext, chatRoutes)
app.use('/api/super-admin', superAdminRoutes)

// WhatsApp webhook (sin autenticación — Evolution API llama directamente)
// Las rutas admin de WhatsApp usan extractTenant
app.use('/api/whatsapp', whatsappRoutes)

// Webhooks públicos de Mercado Pago (sin auth — MP llama directo)
app.use('/api/webhooks', webhooksMpRoutes)
app.use('/api/admin/whatsapp', extractTenant, (req, res, next) => {
  req.db = createTenantPrisma(req.tenantId)
  next()
}, whatsappRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date() } })
})

// Error handler
app.use(errorHandler)

// Inicializar Socket.io
const io = initSocket(httpServer)

// Exportar app para testing con Supertest
export { app }

// Solo iniciar servidor si no estamos en modo test
if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, 'localhost', async () => {
    console.log(`
🚀 Servidor Clubix iniciado
📍 Puerto: ${PORT}
🔗 API: http://localhost:${PORT}/api
🔌 Socket.io: Activo
    `)

    // Verificar conexión SMTP
    await verificarConexionSMTP()

    // Iniciar sistema de notificaciones automáticas
    iniciarCronJobs()
    // Iniciar cron del módulo Tienda
    iniciarCronTienda()
    // Iniciar crons de vigencia de socios (bloqueo por morosidad + notificación)
    iniciarCronsVigencia()
  })

  // Cerrar conexión de Prisma al salir
  process.on('SIGINT', async () => {
    console.log('\n👋 Cerrando servidor...')
    detenerCronJobs()
    detenerCronTienda()
    await prisma.$disconnect()
    console.log('✅ Servidor cerrado correctamente\n')
    process.exit()
  })
}

