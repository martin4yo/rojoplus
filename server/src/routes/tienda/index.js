/**
 * Router principal del módulo Tienda Online.
 * Mount en /api/tienda con extractTenant en index.js.
 */
import express from 'express'
import publicRoutes from './public.js'
import authRoutes from './auth.js'

const router = express.Router()

router.use('/auth', authRoutes)
router.use('/', publicRoutes)

export default router
