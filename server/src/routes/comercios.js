import { Router } from 'express'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = Router()

// Función para guardar logo desde base64
function guardarLogo(base64Data, comercioId) {
  if (!base64Data) return null

  try {
    // Extraer tipo y datos
    const matches = base64Data.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/)
    if (!matches) return null

    const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1]
    const data = matches[2]
    const buffer = Buffer.from(data, 'base64')

    // Crear directorio si no existe
    const uploadsDir = path.join(__dirname, '../../uploads/comercios')
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }

    // Guardar archivo
    const filename = `logo_${comercioId}_${Date.now()}.${extension}`
    const filepath = path.join(uploadsDir, filename)
    fs.writeFileSync(filepath, buffer)

    return `/uploads/comercios/${filename}`
  } catch (error) {
    console.error('Error guardando logo:', error)
    return null
  }
}

// Clave secreta de reCAPTCHA (debe estar en .env)
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY || '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe' // Clave de prueba de Google

// Función para verificar el token de reCAPTCHA
async function verificarCaptcha(token) {
  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${RECAPTCHA_SECRET_KEY}&response=${token}`,
    })
    const data = await response.json()
    return data.success === true
  } catch (error) {
    console.error('Error verificando captcha:', error)
    return false
  }
}

// POST /api/comercios/registro - Registrar nuevo comercio
router.post('/registro', asyncHandler(async (req, res) => {
  const { nombre, direccion, rubroId, telefono, email, cuit, responsable, captchaToken, logo, latitud, longitud } = req.body

  // Validar captcha primero
  if (!captchaToken) {
    throw new AppError('El captcha es requerido', 400, 'CAPTCHA_REQUIRED')
  }

  const captchaValido = await verificarCaptcha(captchaToken)
  if (!captchaValido) {
    throw new AppError('Captcha inválido. Por favor, intentá nuevamente.', 400, 'CAPTCHA_INVALID')
  }

  // Validaciones básicas
  if (!nombre || !direccion || !rubroId || !telefono || !email || !cuit || !responsable) {
    throw new AppError('Todos los campos son obligatorios', 400, 'VALIDATION_ERROR')
  }

  // Verificar que el email no exista
  const existente = await req.prisma.comercio.findUnique({
    where: { email },
  })

  if (existente) {
    throw new AppError('Ya existe un comercio con ese email', 409, 'EMAIL_EXISTS')
  }

  // Obtener descuento default
  const config = await req.prisma.configuracion.findUnique({
    where: { clave: 'descuento_default' },
  })
  const descuentoDefault = config ? parseFloat(config.valor) : 10

  // Crear comercio (sin logo primero para tener el ID)
  const comercio = await req.prisma.comercio.create({
    data: {
      nombre,
      direccion,
      rubroId,
      telefono,
      email,
      cuit,
      responsable,
      estado: 'PENDIENTE',
      descuentoPct: descuentoDefault,
      latitud: latitud ? parseFloat(latitud) : null,
      longitud: longitud ? parseFloat(longitud) : null,
    },
  })

  // Guardar logo si se envió
  if (logo) {
    const logoUrl = guardarLogo(logo, comercio.id)
    if (logoUrl) {
      await req.prisma.comercio.update({
        where: { id: comercio.id },
        data: { logo: logoUrl },
      })
    }
  }

  // TODO: Enviar email de notificación al admin

  res.status(201).json({
    success: true,
    data: {
      id: comercio.id,
      mensaje: 'Solicitud enviada correctamente',
      flyerUrl: '/images/flyer-comercio-adherido.png',
    },
  })
}))

// GET /api/comercios - Listar comercios activos (público)
router.get('/', asyncHandler(async (req, res) => {
  const { lat, lng } = req.query

  const comercios = await req.prisma.comercio.findMany({
    where: { estado: 'ACTIVO' },
    include: { rubro: true },
    orderBy: { nombre: 'asc' },
  })

  // Mapear datos
  let resultado = comercios.map(c => ({
    id: c.id,
    nombre: c.nombre,
    direccion: c.direccion,
    telefono: c.telefono,
    rubro: c.rubro?.nombre,
    descuentoPct: Number(c.descuentoPct),
    logo: c.logo,
    latitud: c.latitud ? Number(c.latitud) : null,
    longitud: c.longitud ? Number(c.longitud) : null,
  }))

  // Si se envió ubicación del usuario, calcular distancia y ordenar
  if (lat && lng) {
    const userLat = parseFloat(lat)
    const userLng = parseFloat(lng)

    resultado = resultado.map(c => {
      if (c.latitud && c.longitud) {
        c.distancia = calcularDistancia(userLat, userLng, c.latitud, c.longitud)
      } else {
        c.distancia = null
      }
      return c
    })

    // Ordenar por distancia (los que no tienen ubicación van al final)
    resultado.sort((a, b) => {
      if (a.distancia === null && b.distancia === null) return 0
      if (a.distancia === null) return 1
      if (b.distancia === null) return -1
      return a.distancia - b.distancia
    })
  }

  res.json({
    success: true,
    data: resultado,
  })
}))

// Fórmula de Haversine para calcular distancia en km
function calcularDistancia(lat1, lon1, lat2, lon2) {
  const R = 6371 // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c * 10) / 10 // Redondear a 1 decimal
}

export default router
