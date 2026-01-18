import { Router } from 'express'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'

const router = Router()

// GET /api/socio/buscar - Buscar socio por DNI o nro socio (acceso público)
router.get('/buscar', asyncHandler(async (req, res) => {
  const { q } = req.query

  if (!q) {
    throw new AppError('Parámetro de búsqueda requerido', 400, 'VALIDATION_ERROR')
  }

  const socio = await req.prisma.socio.findFirst({
    where: {
      OR: [
        { nroSocio: q.trim() },
        { documento: q.trim() },
      ],
    },
    select: {
      tokenPortal: true,
    },
  })

  if (!socio || !socio.tokenPortal) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  res.json({
    success: true,
    data: {
      tokenPortal: socio.tokenPortal,
    },
  })
}))

// GET /api/socio/:tokenPortal - Portal del socio (acceso via link único)
router.get('/:tokenPortal', asyncHandler(async (req, res) => {
  const { tokenPortal } = req.params

  const socio = await req.prisma.socio.findUnique({
    where: { tokenPortal },
    select: {
      id: true,
      nroSocio: true,
      apellidoNombre: true,
      estado: true,
      categoria: true,
      tokenPortal: true,
    },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  // Determinar si está activo
  const estadoUpper = socio.estado?.toUpperCase() || ''
  const esActivo = estadoUpper.includes('ACTIV') || estadoUpper.includes('VIGENT')

  res.json({
    success: true,
    data: {
      id: socio.id,
      nroSocio: socio.nroSocio,
      apellidoNombre: socio.apellidoNombre,
      estado: socio.estado,
      categoria: socio.categoria,
      tokenPortal: socio.tokenPortal,
      esActivo,
    },
  })
}))

export default router
