# Plan de Refactorización: admin.js

## Estado Actual
- **Archivo**: `server/src/routes/admin.js`
- **Líneas**: 7,724
- **Problema**: Monolito con 100+ rutas mezcladas

## Estructura Propuesta

### Módulos Principales (server/src/routes/admin/)

| Módulo | Líneas | Rutas | Descripción |
|--------|--------|-------|-------------|
| `auth.js` | ~60 | 1 | POST /login |
| `dashboard.js` | ~430 | 1 | GET /dashboard con estadísticas |
| `comercios.js` | ~200 | 5 | CRUD comercios adheridos |
| `socios.js` | ~1300 | 15+ | CRUD socios + familia + cuenta corriente |
| `actividades.js` | ~300 | 8 | CRUD actividades deportivas |
| `personal.js` | ~500 | 10 | Entrenadores y staff técnico |
| `configuracion.js` | ~750 | 20+ | Tablas de config (tipos socio, categorías, etc) |
| `periodos.js` | ~400 | 6 | CRUD periodos de facturación |
| `cuotas.js` | ~900 | 12 | Generación cuotas + registro pagos |
| `cargos.js` | ~420 | 8 | Cargos manuales + planes de pago |
| `reportes.js` | ~600 | 6 | Reportes de cobranza y evolución |
| `centros-costo.js` | ~440 | 6 | CRUD + reportes centros de costo |
| `conciliacion.js` | ~260 | 4 | Pagos informados (transferencias) |
| `solicitudes.js` | ~500 | 5 | Solicitudes de alta desde público |
| `inscripciones.js` | ~500 | 6 | CRUD inscripciones a actividades |

**Total**: ~7,560 líneas organizadas en 15 módulos

## Beneficios

1. **Mantenibilidad**: Cada módulo es autocontenido y fácil de encontrar
2. **Legibilidad**: Archivos de 200-1300 líneas vs 7,724
3. **Testing**: Más fácil de testear módulos individuales
4. **Colaboración**: Múltiples devs pueden trabajar sin conflictos
5. **Performance**: Carga lazy de módulos si es necesario

## Estructura de Cada Módulo

```javascript
import { Router } from 'express'
import { asyncHandler, AppError } from '../../middleware/errorHandler.js'
import { authAdmin } from '../../middleware/auth.js'
// ... otros imports específicos del módulo

const router = Router()

// Rutas del módulo
router.get('/ruta', authAdmin, asyncHandler(async (req, res) => {
  // ...
}))

export default router
```

## Integración

### Archivo Principal: server/src/routes/admin/index.js

```javascript
import { Router } from 'express'

// Importar todos los módulos
import authRoutes from './auth.js'
import dashboardRoutes from './dashboard.js'
import sociosRoutes from './socios.js'
// ... resto de imports

const router = Router()

// Montar todas las rutas
router.use(authRoutes)
router.use(dashboardRoutes)
router.use(sociosRoutes)
// ... resto de módulos

export default router
```

### Actualización en server/src/index.js

```javascript
// ANTES
import adminRoutes from './routes/admin.js'

// DESPUÉS
import adminRoutes from './routes/admin/index.js'
```

## Implementación

### Fase 1: Crear Estructura ✅
- [x] Crear carpeta `server/src/routes/admin/`
- [x] Crear `auth.js` (módulo más simple)
- [x] Crear `index.js` (integrador)

### Fase 2: Migrar Módulos (En Progreso)
- [ ] `dashboard.js`
- [ ] `socios.js` (crítico - más complejo)
- [ ] `cuotas.js` (crítico)
- [ ] `configuracion.js`
- [ ] `periodos.js`
- [ ] `cargos.js`
- [ ] `reportes.js`
- [ ] `comercios.js`
- [ ] `actividades.js`
- [ ] `personal.js`
- [ ] `centros-costo.js`
- [ ] `conciliacion.js`
- [ ] `solicitudes.js`
- [ ] `inscripciones.js`

### Fase 3: Testing y Validación
- [ ] Probar cada endpoint manualmente
- [ ] Verificar que no se rompan las rutas existentes
- [ ] Actualizar imports en `server/src/index.js`

### Fase 4: Limpieza
- [ ] Renombrar `admin.js` a `admin.js.backup`
- [ ] Actualizar documentación

## Notas Importantes

1. **Imports Compartidos**: Algunos módulos comparten funciones (ej: `calcularRecargoCargo`). Considerar crear `server/src/utils/` si es necesario.

2. **Middleware**: Todos usan `authAdmin` y `asyncHandler` - importarlos consistentemente.

3. **Validaciones**: Mantener las validaciones existentes exactamente igual.

4. **Respuestas**: Mantener el formato `{ success: true, data: ... }` consistente.

5. **Transacciones**: Cuidado especial con operaciones que usan `$transaction`.

## Próximos Pasos

1. Completar la creación de todos los módulos
2. Actualizar el index.js con todos los imports
3. Probar en desarrollo
4. Hacer backup del admin.js original
5. Actualizar la referencia en server/src/index.js
