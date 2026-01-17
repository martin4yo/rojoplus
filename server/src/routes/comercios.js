import { Router } from 'express'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'

const router = Router()

// POST /api/comercios/registro - Registrar nuevo comercio
router.post('/registro', asyncHandler(async (req, res) => {
  const { nombre, direccion, rubroId, telefono, email, cuit, responsable } = req.body

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

  // Crear comercio
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
    },
  })

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

export default router
