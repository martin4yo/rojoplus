/**
 * Auth de la Tienda Online.
 *
 * Mount: /api/tienda/auth
 *
 * POST /register              - email + password (opcional) + nombre + telefono
 * POST /login                 - email + password
 * POST /magic-link             - solicita link de acceso al email
 * GET  /verify-email          - ?token=...
 * GET  /verify-magic          - ?token=... → devuelve JWT
 * POST /resend-verification   - email
 * GET  /me                     - datos del comprador autenticado
 * POST /logout                 - no-op de servidor (JWT no-stateful)
 */
import express from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { asyncHandler, AppError } from '../../middleware/errorHandler.js'
import { authShopCustomer, generarTokenShopCustomer } from '../../middleware/authShopCustomer.js'
import {
  enviarVerificacionEmailTienda,
  enviarMagicLinkTienda,
} from '../../services/email.js'
import rateLimit from 'express-rate-limit'

const router = express.Router()

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Demasiados intentos. Intentá en 15 minutos.' },
})

const magicRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { success: false, message: 'Demasiados pedidos de magic link. Esperá un minuto.' },
})

function genToken() {
  return crypto.randomBytes(32).toString('hex')
}

function normalizarEmail(e) {
  return String(e || '').trim().toLowerCase()
}

// ---------------------------------------------------------------------------
// POST /register
// ---------------------------------------------------------------------------
router.post('/register', authRateLimit, asyncHandler(async (req, res) => {
  const email = normalizarEmail(req.body?.email)
  const { password, nombre, telefono, documento, tipoDocumento } = req.body || {}

  if (!email || !nombre) throw new AppError('Email y nombre son requeridos', 400)

  // ¿Ya existe?
  const existente = await req.db.shopCustomer.findUnique({
    where: { tenantId_email: { tenantId: req.tenantId, email } },
  })
  if (existente) {
    throw new AppError('Ya existe una cuenta con ese email', 409, 'EMAIL_TAKEN')
  }

  // Vincular socio existente con mismo email (si lo hay)
  const socioMatch = await req.db.socio.findFirst({
    where: { email, estadoSocioRel: { esSocioActivo: true } },
    select: { id: true },
  })

  const passwordHash = password ? await bcrypt.hash(password, 10) : null
  const verifyToken = genToken()
  const verifyTokenExp = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h

  const customer = await req.db.shopCustomer.create({
    data: {
      email,
      passwordHash,
      nombre,
      telefono: telefono || null,
      documento: documento || null,
      tipoDocumento: tipoDocumento || null,
      estado: 'APPROVED', // por defecto aprobado; admin puede bloquear si quiere moderar
      verifyToken,
      verifyTokenExp,
      socioId: socioMatch?.id || null,
      tenantId: req.tenantId,
    },
  })

  try {
    await enviarVerificacionEmailTienda({ shopCustomer: customer, token: verifyToken, tenantId: req.tenantId, db: req.db })
  } catch (err) {
    console.error('[Tienda Auth] Error enviando verificación:', err.message)
  }

  res.status(201).json({
    success: true,
    data: {
      id: customer.id,
      email: customer.email,
      nombre: customer.nombre,
      requiereVerificacion: true,
    },
  })
}))

// ---------------------------------------------------------------------------
// POST /login (con password)
// ---------------------------------------------------------------------------
router.post('/login', authRateLimit, asyncHandler(async (req, res) => {
  const email = normalizarEmail(req.body?.email)
  const { password } = req.body || {}
  if (!email || !password) throw new AppError('Email y contraseña requeridos', 400)

  const customer = await req.db.shopCustomer.findUnique({
    where: { tenantId_email: { tenantId: req.tenantId, email } },
  })
  if (!customer || !customer.passwordHash) {
    throw new AppError('Credenciales inválidas', 401, 'AUTH_INVALID')
  }
  if (customer.estado === 'BLOCKED') {
    throw new AppError('Tu cuenta está bloqueada', 403, 'BLOCKED')
  }

  const ok = await bcrypt.compare(password, customer.passwordHash)
  if (!ok) throw new AppError('Credenciales inválidas', 401, 'AUTH_INVALID')

  await req.db.shopCustomer.update({
    where: { id: customer.id },
    data: { ultimoLogin: new Date() },
  })

  const token = generarTokenShopCustomer({
    customerId: customer.id,
    tenantId: req.tenantId,
    email: customer.email,
    socioId: customer.socioId || null,
  })

  res.json({
    success: true,
    data: {
      token,
      customer: {
        id: customer.id,
        email: customer.email,
        nombre: customer.nombre,
        telefono: customer.telefono,
        emailVerificado: !!customer.emailVerificadoEn,
        socioId: customer.socioId,
      },
    },
  })
}))

// ---------------------------------------------------------------------------
// POST /magic-link
// Pide un magic link al email. Por seguridad responde 200 aunque no exista.
// ---------------------------------------------------------------------------
router.post('/magic-link', magicRateLimit, asyncHandler(async (req, res) => {
  const email = normalizarEmail(req.body?.email)
  if (!email) throw new AppError('Email requerido', 400)

  const customer = await req.db.shopCustomer.findUnique({
    where: { tenantId_email: { tenantId: req.tenantId, email } },
  })

  if (customer && customer.estado !== 'BLOCKED') {
    const token = genToken()
    const exp = new Date(Date.now() + 15 * 60 * 1000) // 15min
    await req.db.shopCustomer.update({
      where: { id: customer.id },
      data: { magicToken: token, magicTokenExp: exp },
    })
    try {
      await enviarMagicLinkTienda({ shopCustomer: customer, token, tenantId: req.tenantId, db: req.db })
    } catch (err) {
      console.error('[Tienda Auth] Error enviando magic link:', err.message)
    }
  }

  // Respuesta uniforme — no revelar si el email existe
  res.json({ success: true, data: { sent: true } })
}))

// ---------------------------------------------------------------------------
// GET /verify-email?token=...
// ---------------------------------------------------------------------------
router.get('/verify-email', asyncHandler(async (req, res) => {
  const { token } = req.query
  if (!token) throw new AppError('Token requerido', 400)

  const customer = await req.db.shopCustomer.findFirst({
    where: { tenantId: req.tenantId, verifyToken: String(token) },
  })

  if (!customer || !customer.verifyTokenExp || customer.verifyTokenExp < new Date()) {
    throw new AppError('El token es inválido o expiró', 400, 'TOKEN_INVALID')
  }

  await req.db.shopCustomer.update({
    where: { id: customer.id },
    data: {
      emailVerificadoEn: new Date(),
      verifyToken: null,
      verifyTokenExp: null,
    },
  })

  res.json({ success: true, data: { verified: true, email: customer.email } })
}))

// ---------------------------------------------------------------------------
// GET /verify-magic?token=...  → devuelve JWT
// ---------------------------------------------------------------------------
router.get('/verify-magic', asyncHandler(async (req, res) => {
  const { token } = req.query
  if (!token) throw new AppError('Token requerido', 400)

  const customer = await req.db.shopCustomer.findFirst({
    where: { tenantId: req.tenantId, magicToken: String(token) },
  })

  if (!customer || !customer.magicTokenExp || customer.magicTokenExp < new Date()) {
    throw new AppError('El link expiró o no es válido', 400, 'TOKEN_INVALID')
  }

  // Limpiar magic + marcar email verificado (probó que tiene acceso al inbox)
  await req.db.shopCustomer.update({
    where: { id: customer.id },
    data: {
      magicToken: null,
      magicTokenExp: null,
      emailVerificadoEn: customer.emailVerificadoEn || new Date(),
      ultimoLogin: new Date(),
    },
  })

  const jwtToken = generarTokenShopCustomer({
    customerId: customer.id,
    tenantId: req.tenantId,
    email: customer.email,
    socioId: customer.socioId || null,
  })

  res.json({
    success: true,
    data: {
      token: jwtToken,
      customer: {
        id: customer.id,
        email: customer.email,
        nombre: customer.nombre,
        telefono: customer.telefono,
        emailVerificado: true,
        socioId: customer.socioId,
      },
    },
  })
}))

// ---------------------------------------------------------------------------
// POST /resend-verification
// ---------------------------------------------------------------------------
router.post('/resend-verification', authRateLimit, asyncHandler(async (req, res) => {
  const email = normalizarEmail(req.body?.email)
  if (!email) throw new AppError('Email requerido', 400)

  const customer = await req.db.shopCustomer.findUnique({
    where: { tenantId_email: { tenantId: req.tenantId, email } },
  })

  if (customer && !customer.emailVerificadoEn) {
    const token = genToken()
    const exp = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await req.db.shopCustomer.update({
      where: { id: customer.id },
      data: { verifyToken: token, verifyTokenExp: exp },
    })
    try {
      await enviarVerificacionEmailTienda({ shopCustomer: customer, token, tenantId: req.tenantId, db: req.db })
    } catch (err) {
      console.error('[Tienda Auth] Error reenviando verificación:', err.message)
    }
  }

  res.json({ success: true, data: { sent: true } })
}))

// ---------------------------------------------------------------------------
// GET /me
// ---------------------------------------------------------------------------
router.get('/me', authShopCustomer, asyncHandler(async (req, res) => {
  const customer = await req.db.shopCustomer.findUnique({
    where: { id: req.shopCustomer.customerId },
    include: {
      socio: { select: { id: true, nroSocio: true, apellidoNombre: true } },
      entidad: { select: { id: true, codigo: true, razonSocial: true } },
    },
  })
  if (!customer) throw new AppError('Sesión inválida', 401)

  res.json({
    success: true,
    data: {
      id: customer.id,
      email: customer.email,
      nombre: customer.nombre,
      telefono: customer.telefono,
      documento: customer.documento,
      emailVerificado: !!customer.emailVerificadoEn,
      socio: customer.socio,
      entidad: customer.entidad,
    },
  })
}))

// ---------------------------------------------------------------------------
// POST /logout
// JWT es stateless: solo confirma. El frontend descarta el token localmente.
// ---------------------------------------------------------------------------
router.post('/logout', (req, res) => {
  res.json({ success: true })
})

export default router
