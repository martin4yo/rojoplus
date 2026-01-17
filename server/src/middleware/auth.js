import jwt from 'jsonwebtoken'
import { AppError } from './errorHandler.js'

const JWT_SECRET = process.env.JWT_SECRET || 'rojoplus-secret'

// Middleware para autenticar admin con JWT
export function authAdmin(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Token no proporcionado', 401, 'AUTH_REQUIRED')
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.admin = decoded
    next()
  } catch (err) {
    throw new AppError('Token inválido', 401, 'AUTH_INVALID')
  }
}

// Middleware para autenticar comercio con token UUID
export async function authComercio(req, res, next) {
  const { token } = req.params

  if (!token) {
    throw new AppError('Token no proporcionado', 401, 'AUTH_REQUIRED')
  }

  const comercio = await req.prisma.comercio.findUnique({
    where: { token },
    include: { rubro: true },
  })

  if (!comercio) {
    throw new AppError('Token inválido', 401, 'AUTH_INVALID')
  }

  if (comercio.estado !== 'ACTIVO') {
    throw new AppError('Comercio inactivo', 401, 'COMERCIO_INACTIVO')
  }

  req.comercio = comercio
  next()
}

// Generar token JWT para admin
export function generateToken(admin) {
  return jwt.sign(
    { id: admin.id, email: admin.email },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  )
}
