import { Router } from 'express'
import { asyncHandler } from '../../middleware/errorHandler.js'

const router = Router()

/**
 * GET /api/admin/branding
 * Obtener configuración de branding del tenant actual
 */
router.get('/', asyncHandler(async (req, res) => {
  const { tenantId } = req

  const tenant = await req.db.tenant.findUnique({
    where: { id: tenantId },
    select: {
      logoUrl: true,
      faviconUrl: true,
      colores: true,
      nombre: true,
      slogan: true
    }
  })

  if (!tenant) {
    return res.status(404).json({ error: 'Tenant no encontrado' })
  }

  res.json(tenant)
}))

/**
 * PUT /api/admin/branding/colores
 * Actualizar la paleta de colores del tenant
 * Body: { colores: { primario: '#...', ... } }
 */
router.put('/colores', asyncHandler(async (req, res) => {
  const { tenantId } = req
  const { colores } = req.body

  // Validar que sea un objeto
  if (!colores || typeof colores !== 'object') {
    return res.status(400).json({ error: 'colores debe ser un objeto' })
  }

  // Validar colores en formato hex
  const colorRegex = /^#[0-9A-F]{6}$/i
  for (const [key, value] of Object.entries(colores)) {
    if (!colorRegex.test(value)) {
      return res.status(400).json({
        error: `Color inválido para ${key}: ${value}`
      })
    }
  }

  const tenant = await req.db.tenant.update({
    where: { id: tenantId },
    data: { colores }
  })

  res.json({
    success: true,
    colores: tenant.colores
  })
}))

/**
 * PUT /api/admin/branding/logo
 * Actualizar URL del logo
 * Body: { logoUrl: 'https://...' }
 */
router.put('/logo', asyncHandler(async (req, res) => {
  const { tenantId } = req
  const { logoUrl } = req.body

  if (!logoUrl || typeof logoUrl !== 'string') {
    return res.status(400).json({ error: 'logoUrl es requerido y debe ser string' })
  }

  // Validar que sea una URL válida
  try {
    new URL(logoUrl)
  } catch (e) {
    return res.status(400).json({ error: 'logoUrl no es una URL válida' })
  }

  const tenant = await req.db.tenant.update({
    where: { id: tenantId },
    data: { logoUrl }
  })

  res.json({
    success: true,
    logoUrl: tenant.logoUrl
  })
}))

/**
 * PUT /api/admin/branding/favicon
 * Actualizar URL del favicon
 * Body: { faviconUrl: 'https://...' }
 */
router.put('/favicon', asyncHandler(async (req, res) => {
  const { tenantId } = req
  const { faviconUrl } = req.body

  if (!faviconUrl || typeof faviconUrl !== 'string') {
    return res.status(400).json({ error: 'faviconUrl es requerido y debe ser string' })
  }

  try {
    new URL(faviconUrl)
  } catch (e) {
    return res.status(400).json({ error: 'faviconUrl no es una URL válida' })
  }

  const tenant = await req.db.tenant.update({
    where: { id: tenantId },
    data: { faviconUrl }
  })

  res.json({
    success: true,
    faviconUrl: tenant.faviconUrl
  })
}))

/**
 * DELETE /api/admin/branding/logo
 * Eliminar logo (volver a por defecto)
 */
router.delete('/logo', asyncHandler(async (req, res) => {
  const { tenantId } = req

  await req.db.tenant.update({
    where: { id: tenantId },
    data: { logoUrl: null }
  })

  res.json({ success: true })
}))

/**
 * GET /api/admin/branding/default-colors
 * Obtener paleta de colores por defecto
 */
router.get('/default-colors', (req, res) => {
  const defaultColors = {
    primario: '#DC2626',
    primarioOscuro: '#991B1B',
    primarioClaro: '#FCA5A5',
    secundario: '#7C3AED',
    secundarioOscuro: '#5B21B6',
    secundarioClaro: '#C4B5FD',
    acento: '#22D3EE',
    exito: '#10B981',
    advertencia: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
    fondoPrincipal: '#FFFFFF',
    fondoSecundario: '#F9FAFB',
    textoPrincipal: '#111827',
    textoSecundario: '#6B7280',
    borde: '#E5E7EB'
  }

  res.json(defaultColors)
})

export default router
