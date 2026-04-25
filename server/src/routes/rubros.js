import { Router } from 'express'
import { asyncHandler } from '../middleware/errorHandler.js'

const router = Router()

// GET /api/rubros - Listar rubros activos
router.get('/', asyncHandler(async (req, res) => {
  const rubros = await req.db.rubro.findMany({
    where: { activo: true },
    orderBy: { orden: 'asc' },
    select: { id: true, nombre: true },
  })

  res.json({ success: true, data: rubros })
}))

export default router
