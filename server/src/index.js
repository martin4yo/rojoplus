import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import path from 'path'
import { fileURLToPath } from 'url'
import { PrismaClient } from '@prisma/client'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Routes
import rubrosRoutes from './routes/rubros.js'
import comerciosRoutes from './routes/comercios.js'
import comercioRoutes from './routes/comercio.js'
import adminRoutes from './routes/admin.js'
import socioRoutes from './routes/socio.js'
import contabilidadRoutes from './routes/contabilidad.js'
import tesoreriaRoutes from './routes/tesoreria.js'
import stockRoutes from './routes/stock.js'
import movimientosContablesRoutes from './routes/movimientosContables.js'
import usuariosRoutes from './routes/usuarios.js'
import liquidacionesRoutes from './routes/liquidaciones.js'
import asientosRoutes from './routes/asientos.js'
import deportesRoutes from './routes/deportes.js'
import presupuestoRoutes from './routes/presupuesto.js'

// Services
import { verificarConexionSMTP } from './services/email.js'

// Middlewares
import { errorHandler } from './middleware/errorHandler.js'

const app = express()
const prisma = new PrismaClient()
const PORT = process.env.PORT || 3001

// Middlewares globales
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}))
app.use(cors())
app.use(express.json())

// Servir archivos estáticos (fotos de socios)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

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
app.use('/api/socio', socioRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date() } })
})

// Error handler
app.use(errorHandler)

// Iniciar servidor
app.listen(PORT, async () => {
  console.log(`
🚀 Servidor RojoPlus iniciado
📍 Puerto: ${PORT}
🔗 API: http://localhost:${PORT}/api
  `)

  // Verificar conexión SMTP
  await verificarConexionSMTP()
})

// Cerrar conexión de Prisma al salir
process.on('SIGINT', async () => {
  await prisma.$disconnect()
  process.exit()
})
