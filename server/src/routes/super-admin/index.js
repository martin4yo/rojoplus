import express from 'express'
import tenantsRoutes from './tenants.js'

const router = express.Router()

router.use('/tenants', tenantsRoutes)

export default router
