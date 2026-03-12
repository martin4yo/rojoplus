import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import cors from 'cors'
import helmet from 'helmet'
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
import pagosRoutes from './routes/pagos.js'
import contabilidadRoutes from './routes/contabilidad.js'
import tesoreriaRoutes from './routes/tesoreria.js'
import stockRoutes from './routes/stock.js'
import movimientosContablesRoutes from './routes/movimientosContables.js'
import usuariosRoutes from './routes/usuarios.js'
import liquidacionesRoutes from './routes/liquidaciones.js'
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
import importacionRoutes from './routes/importacion.js'
import facturacionRoutes from './routes/facturacion.js'
import menuRoutes from './routes/menu.js'
import chatRoutes from './routes/chat.js'

// Services
import { verificarConexionSMTP } from './services/email.js'
import { iniciarCronJobs, detenerCronJobs } from './jobs/notificaciones.js'
import { initSocket } from './services/socketService.js'

// Middlewares
import { errorHandler } from './middleware/errorHandler.js'

const app = express()
const httpServer = createServer(app)
const PORT = process.env.PORT || 3001

// Middlewares globales
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}))
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))

// Servir archivos estáticos (fotos de socios)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

// Servir archivos públicos (plantillas, etc)
app.use('/public', express.static(path.join(__dirname, '../public')))

// Pasar prisma a las rutas
app.use((req, res, next) => {
  req.prisma = prisma
  next()
})

// Rutas
app.use('/api/rubros', rubrosRoutes)
app.use('/api/comercios', comerciosRoutes)
app.use('/api/comercio', comercioRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/admin', contabilidadRoutes)
app.use('/api/admin', tesoreriaRoutes)
app.use('/api/admin', stockRoutes)
app.use('/api/admin', movimientosContablesRoutes)
app.use('/api/admin', usuariosRoutes)
app.use('/api/admin', liquidacionesRoutes)
app.use('/api/admin/asientos', asientosRoutes)
app.use('/api/admin', deportesRoutes)
app.use('/api/admin', presupuestoRoutes)
app.use('/api/admin/templates', templatesRoutes)
app.use('/api/admin/cierres-caja', cierreCajaRoutes)
app.use('/api/admin/dashboard', dashboardEjecutivoRoutes)
app.use('/api/admin/reportes/morosidad', reportesMorosidadRoutes)
app.use('/api/socio', socioRoutes)
app.use('/api/socio', pushSubscriptionRoutes)
app.use('/api/admin/debito', debitoAutomaticoRoutes)
app.use('/api/pagos', pagosRoutes)
app.use('/api/public', publicRoutes)
app.use('/api', bannersRoutes)
app.use('/api', noticiasRoutes)
app.use('/api', contactoRoutes)
app.use('/api/admin/autoridades', autoridadesRoutes)
app.use('/api/autoridades', autoridadesRoutes)
app.use('/api/admin/reportes/deportivos', reportesDeportivosRoutes)
app.use('/api/admin/categorias/pasaje', pasajeCategoriaRoutes)
app.use('/api/admin/conciliacion', conciliacionBancariaRoutes)
app.use('/api/admin/buffet', buffetRoutes)
app.use('/api/admin/adjuntos', adjuntosRoutes)
app.use('/api/admin/staff-tecnico', staffTecnicoRoutes)
app.use('/api/admin/noticias-deportivas', noticiasDeportivasRoutes)
app.use('/api/admin/reglamento', reglamentoRoutes)
app.use('/api/accesos', accesosRoutes)
app.use('/api/eventos', eventosRoutes)
app.use('/api/buffet', buffetRoutes) // Ruta pública para menú
app.use('/api/importacion', importacionRoutes)
app.use('/api/admin/facturacion', facturacionRoutes)
app.use('/api/admin/menu', menuRoutes)
app.use('/api/chat', chatRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date() } })
})

// Error handler
app.use(errorHandler)

// Inicializar Socket.io
const io = initSocket(httpServer)

// Iniciar servidor
httpServer.listen(PORT, 'localhost', async () => {
  console.log(`
🚀 Servidor RojoPlus iniciado
📍 Puerto: ${PORT}
🔗 API: http://localhost:${PORT}/api
🔌 Socket.io: Activo
  `)

  // Verificar conexión SMTP
  await verificarConexionSMTP()

  // Iniciar sistema de notificaciones automáticas
  iniciarCronJobs()
})

// Cerrar conexión de Prisma al salir
process.on('SIGINT', async () => {
  console.log('\n👋 Cerrando servidor...')
  detenerCronJobs()
  await prisma.$disconnect()
  console.log('✅ Servidor cerrado correctamente\n')
  process.exit()
})

