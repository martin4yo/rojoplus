import { Router } from 'express'

// Importar módulos
import authRoutes from './auth.js'
import dashboardRoutes from './dashboard.js'
import sociosRoutes from './socios.js'
import cuotasRoutes from './cuotas.js'
import reportesRoutes from './reportes.js'
import actividadesRoutes from './actividades.js'
import personalRoutes from './personal.js'
import configuracionRoutes from './configuracion.js'
import comerciosRoutes from './comercios.js'
import cargosRoutes from './cargos.js'
import centrosCostoRoutes from './centros-costo.js'
import conciliacionRoutes from './conciliacion.js'
import solicitudesRoutes from './solicitudes.js'
import inscripcionesRoutes from './inscripciones.js'
import cobranzasRoutes from './cobranzas.js'
import recuperoRoutes from './recupero.js'
import comunicacionesRoutes from './comunicaciones.js'
import paginasRoutes from './paginas.js'
import reportTemplatesRoutes from './report-templates.js'
import reportPresetsRoutes from './report-presets.js'

const router = Router()

// Montar rutas
router.use(authRoutes)
router.use(dashboardRoutes)
router.use(sociosRoutes)
router.use(cuotasRoutes)
router.use(reportesRoutes)
router.use(actividadesRoutes)
router.use(personalRoutes)
router.use(configuracionRoutes)
router.use(comerciosRoutes)
router.use(cargosRoutes)
router.use(centrosCostoRoutes)
router.use(conciliacionRoutes)
router.use(solicitudesRoutes)
router.use(inscripcionesRoutes)
router.use('/cobranzas', cobranzasRoutes)
router.use('/recupero', recuperoRoutes)
router.use('/comunicaciones', comunicacionesRoutes)
router.use(paginasRoutes)
router.use(reportTemplatesRoutes)
router.use(reportPresetsRoutes)

export default router
