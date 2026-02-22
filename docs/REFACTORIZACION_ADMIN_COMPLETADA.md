# Refactorización Admin.js - COMPLETADA

## Resumen

El archivo monolítico `server/src/routes/admin.js` (7,724 líneas) ha sido dividido en **14 módulos especializados** más un archivo index.js que los coordina.

## Módulos Creados

### Ya existentes (5)
1. **auth.js** (56 líneas) - Autenticación y login
2. **dashboard.js** (432 líneas) - Dashboard y estadísticas
3. **socios.js** (1,479 líneas) - Gestión de socios y grupos familiares
4. **cuotas.js** (1,179 líneas) - Gestión de cuotas y periodos
5. **reportes.js** (510 líneas) - Reportes y exports

### Nuevos módulos creados (9)
6. **comercios.js** (213 líneas) - Gestión de comercios adheridos
   - Listar, aprobar, rechazar comercios
   - Gestión de descuentos y acumulación
   - Reenvío de links de acceso

7. **actividades.js** (322 líneas) - Actividades deportivas
   - CRUD de actividades
   - CRUD de categorías de actividad
   - Gestión de cuotas por actividad/categoría

8. **personal.js** (529 líneas) - Personal y entrenadores
   - CRUD de cargos de personal
   - CRUD de entrenadores
   - Asignación de entrenadores a categorías
   - Upload de fotos para staff público
   - Integración con entidades PERSONAL

9. **configuracion.js** (1,247 líneas) - Tablas auxiliares y configuración
   - Cobradores
   - Tipos de socio (CRUD)
   - Categorías de socio (CRUD)
   - Estados de socio (CRUD)
   - Descuentos disponibles (CRUD)
   - Rubros (CRUD)
   - Conceptos de tesorería (CRUD)
   - Periodos de cuota (CRUD + generación masiva)
   - Configuración del sistema
   - Modo demo
   - Configuración de recargos

10. **cargos.js** (479 líneas) - Cargos manuales y recargos
    - Categorías de cargo
    - CRUD de cargos manuales
    - Cálculo de recargos por mora
    - Planes de pago
    - Preview de planes de pago
    - Función helper calcularRecargoCargo()

11. **centros-costo.js** (444 líneas) - Centros de costo
    - CRUD de centros de costo
    - Reportes de ingresos/egresos por centro
    - Reporte comparativo de todos los centros

12. **conciliacion.js** (274 líneas) - Conciliación bancaria
    - Listar pagos informados
    - Contador de pendientes
    - Confirmar/rechazar pagos informados
    - Generación de asientos contables

13. **solicitudes.js** (510 líneas) - Solicitudes de alta de socios
    - Listar solicitudes con filtros
    - Detalle de solicitud
    - Aprobar solicitud (crea socio + envía email)
    - Rechazar solicitud (envía email)
    - Estadísticas de solicitudes

14. **inscripciones.js** (506 líneas) - Inscripciones deportivas
    - CRUD de inscripciones
    - Listado de plantel por categoría
    - Export Excel de plantel

## Estructura de Archivos

```
server/src/routes/admin/
├── index.js                 # Router principal (37 líneas)
├── auth.js                  # Autenticación
├── dashboard.js             # Dashboard
├── socios.js                # Socios
├── cuotas.js                # Cuotas
├── reportes.js              # Reportes
├── comercios.js             # ✨ NUEVO
├── actividades.js           # ✨ NUEVO
├── personal.js              # ✨ NUEVO
├── configuracion.js         # ✨ NUEVO
├── cargos.js                # ✨ NUEVO
├── centros-costo.js         # ✨ NUEVO
├── conciliacion.js          # ✨ NUEVO
├── solicitudes.js           # ✨ NUEVO
└── inscripciones.js         # ✨ NUEVO
```

## Estadísticas

- **Total de líneas**: 8,217 (distribuidas en 15 archivos)
- **Archivo más grande**: configuracion.js (1,247 líneas)
- **Archivo más pequeño**: index.js (37 líneas)
- **Promedio por módulo**: ~548 líneas

## Imports Comunes

Todos los módulos comparten esta estructura base:

```javascript
import { Router } from 'express'
import { asyncHandler, AppError } from '../../middleware/errorHandler.js'
import { authAdmin } from '../../middleware/auth.js'

const router = Router()

// ... rutas ...

export default router
```

## Imports Específicos por Módulo

- **comercios.js**: `uuid`, email services
- **actividades.js**: -
- **personal.js**: `uuid`, `multer` (upload)
- **configuracion.js**: -
- **cargos.js**: - (incluye función calcularRecargoCargo)
- **centros-costo.js**: -
- **conciliacion.js**: `generarAsientoPagoCuota` (asientos contables)
- **solicitudes.js**: `bcrypt`, `generateToken`, email templates
- **inscripciones.js**: `xlsx` (exports Excel)

## Funciones Helper

### En configuracion.js
- `calcularRecargoCargo(prisma, cargo)` - Calcula recargos por mora

### En personal.js
- `generarCodigoEntidadPersonal(prisma)` - Genera códigos únicos PERS-XXXX

### En cargos.js
- `calcularRecargoCargo(prisma, cargo)` - Copia de la función para cálculo de recargos

## Constantes

### En cargos.js
```javascript
const CATEGORIAS_CARGO = [
  'CUOTA_SOCIAL',
  'CUOTA_ACTIVIDAD',
  'CARNET',
  'MOROSIDAD',
  'NOTA_CREDITO',
  'FINANCIACION'
]
```

### En personal.js
```javascript
const uploadCache = new Map() // Cache temporal para uploads de fotos
```

## Verificación

Todos los módulos han sido verificados:
- ✅ Sintaxis correcta (node --check)
- ✅ Export default router presente
- ✅ Imports correctos
- ✅ Montados en index.js

## Próximos Pasos

1. Probar el servidor con los nuevos módulos
2. Verificar que todas las rutas funcionen correctamente
3. Eliminar o archivar el archivo `admin.js` original
4. Actualizar documentación si es necesario

## Notas Importantes

- Todos los módulos mantienen la lógica EXACTA del archivo original
- No se modificó ninguna lógica de negocio
- Solo se reorganizó el código en módulos temáticos
- Las rutas mantienen sus paths originales (ej: `/api/admin/comercios`)
