import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { asyncHandler, AppError } from '../../middleware/errorHandler.js'
import { generateToken } from '../../middleware/auth.js'

const router = Router()

/**
 * POST /api/admin/login
 * Autenticación de administradores
 */
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    throw new AppError('Email y contraseña son requeridos', 400, 'VALIDATION_ERROR')
  }

  const admin = await req.prisma.admin.findUnique({
    where: { email },
    include: { rol: { select: { esSuperAdmin: true } } }
  })

  if (!admin || !admin.activo) {
    throw new AppError('Credenciales inválidas', 401, 'AUTH_INVALID')
  }

  const validPassword = await bcrypt.compare(password, admin.passwordHash)
  if (!validPassword) {
    throw new AppError('Credenciales inválidas', 401, 'AUTH_INVALID')
  }

  // Actualizar último login
  await req.prisma.admin.update({
    where: { id: admin.id },
    data: { lastLogin: new Date() },
  })

  const token = generateToken(admin)

  res.json({
    success: true,
    data: {
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        nombre: admin.nombre,
        apellido: admin.apellido,
        rol: admin.rol,
        permisos: admin.permisos,
        esSuperAdmin: admin.rol?.esSuperAdmin || false,
      },
    },
  })
}))

export default router
