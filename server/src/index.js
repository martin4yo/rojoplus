import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { PrismaClient } from '@prisma/client'

// Routes
import rubrosRoutes from './routes/rubros.js'
import comerciosRoutes from './routes/comercios.js'
import comercioRoutes from './routes/comercio.js'
import adminRoutes from './routes/admin.js'
import socioRoutes from './routes/socio.js'

// Services
import { verificarConexionSMTP } from './services/email.js'

// Middlewares
import { errorHandler } from './middleware/errorHandler.js'

const app = express()
const prisma = new PrismaClient()
const PORT = process.env.PORT || 3001

// Middlewares globales
app.use(helmet())
app.use(cors())
app.use(express.json())

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
