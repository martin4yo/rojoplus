/**
 * Middleware de autenticación para ShopCustomer (comprador de tienda).
 *
 * JWT payload esperado: { tipo: 'shopCustomer', customerId, tenantId, email, socioId? }
 *
 * Variantes:
 *   - authShopCustomer: requiere token y carga req.shopCustomer
 *   - shopCustomerOptional: si hay token, lo carga; si no, sigue sin req.shopCustomer
 */
import jwt from 'jsonwebtoken'
import { AppError } from './errorHandler.js'

const JWT_SECRET = process.env.JWT_SECRET || 'rojoplus-secret'

function decodeFromHeader(req) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return null
  const token = auth.split(' ')[1]
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    if (decoded.tipo !== 'shopCustomer') return null
    if (decoded.tenantId !== req.tenantId) return null
    return decoded
  } catch {
    return null
  }
}

export function authShopCustomer(req, res, next) {
  const decoded = decodeFromHeader(req)
  if (!decoded) {
    return next(new AppError('Sesión requerida', 401, 'AUTH_REQUIRED'))
  }
  req.shopCustomer = decoded
  next()
}

export function shopCustomerOptional(req, res, next) {
  const decoded = decodeFromHeader(req)
  if (decoded) req.shopCustomer = decoded
  next()
}

export function generarTokenShopCustomer(payload, opts = {}) {
  return jwt.sign(
    { tipo: 'shopCustomer', ...payload },
    JWT_SECRET,
    { expiresIn: opts.expiresIn || '30d' }
  )
}
