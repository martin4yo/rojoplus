import { Router } from 'express'
import { asyncHandler, AppError } from '../../middleware/errorHandler.js'
import { authAdmin } from '../../middleware/auth.js'

const router = Router()

const PAGINAS_VALIDAS = ['historia']

// GET /api/admin/paginas/:slug
router.get('/paginas/:slug', authAdmin, asyncHandler(async (req, res) => {
  const { slug } = req.params
  if (!PAGINAS_VALIDAS.includes(slug)) throw new AppError('Página no encontrada', 404)

  const clave = `PAGINA_${slug.toUpperCase()}`
  const config = await req.db.configuracion.findFirst({ where: { clave } })

  res.json({ success: true, data: config?.valor ? JSON.parse(config.valor) : null })
}))

// PUT /api/admin/paginas/:slug
router.put('/paginas/:slug', authAdmin, asyncHandler(async (req, res) => {
  const { slug } = req.params
  if (!PAGINAS_VALIDAS.includes(slug)) throw new AppError('Página no encontrada', 404)

  const { contenido } = req.body
  if (!contenido || typeof contenido !== 'object') throw new AppError('Contenido requerido', 400)

  const clave = `PAGINA_${slug.toUpperCase()}`

  await req.db.configuracion.upsert({
    where: { tenantId_clave: { tenantId: req.tenantId, clave } },
    update: { valor: JSON.stringify(contenido) },
    create: {
      clave,
      valor: JSON.stringify(contenido),
      descripcion: `Contenido editable de la página ${slug}`,
      tipo: 'JSON',
      modulo: 'SITIO',
    },
  })

  res.json({ success: true, message: 'Página guardada correctamente' })
}))

export default router
