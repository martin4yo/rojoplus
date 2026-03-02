# Plan de Refactoring - RojoPlus

## Fecha de Análisis: Marzo 2026
## Estado: EN PROGRESO

---

## Resumen de Impacto

| Métrica | Antes | Después (estimado) |
|---------|-------|-------------------|
| Líneas de código duplicado | ~10,000 | ~2,000 |
| Archivos >1000 líneas | 13 | 3-4 |
| Tiempo de mantenimiento | Alto | Medio-Bajo |
| Riesgo de bugs por duplicación | Alto | Bajo |

---

## FASE 1: Quick Wins (1-2 días)

### 1.1 Crear hook `useSearch`
- **Estado:** ⬜ PENDIENTE
- **Impacto:** 28+ archivos, ~840 líneas eliminadas
- **Riesgo:** Bajo
- **Archivo a crear:** `client/src/hooks/useSearch.js`

**Archivos a migrar:**
- [ ] `Cuotas.jsx` (líneas 110-130)
- [ ] `Inscripciones.jsx` (líneas 143-150)
- [ ] `SocioForm.jsx`
- [ ] `ReciboCobroForm.jsx`
- [ ] `FacturaVentaForm.jsx`
- [ ] `FacturaCompraForm.jsx`
- [ ] `OrdenPagoForm.jsx`
- [ ] `PedidoForm.jsx`
- [ ] (y 20+ más)

**Código del hook:**
```javascript
// client/src/hooks/useSearch.js
import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'

export function useSearch(endpoint, options = {}) {
  const {
    minChars = 2,
    debounce = 300,
    transform = (data) => data,
    params = {}
  } = options

  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (query.length < minChars) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await api.get(endpoint, {
          params: { q: query, ...params }
        })
        const data = response?.data || response || []
        setResults(transform(data))
      } catch (err) {
        setError(err.message)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, debounce)

    return () => clearTimeout(timer)
  }, [query, endpoint, minChars, debounce])

  const clear = useCallback(() => {
    setQuery('')
    setResults([])
  }, [])

  return { query, setQuery, results, loading, error, clear }
}
```

---

### 1.2 Crear hook `useFormState`
- **Estado:** ⬜ PENDIENTE
- **Impacto:** 100+ formularios
- **Riesgo:** Bajo
- **Archivo a crear:** `client/src/hooks/useFormState.js`

**Código del hook:**
```javascript
// client/src/hooks/useFormState.js
import { useState, useCallback } from 'react'

export function useFormState(initialData = {}) {
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target
    setData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }, [])

  const setField = useCallback((name, value) => {
    setData(prev => ({ ...prev, [name]: value }))
  }, [])

  const reset = useCallback(() => {
    setData(initialData)
    setError(null)
    setSuccess(false)
  }, [initialData])

  return {
    data,
    setData,
    loading,
    setLoading,
    saving,
    setSaving,
    error,
    setError,
    success,
    setSuccess,
    handleChange,
    setField,
    reset
  }
}
```

---

### 1.3 Migrar `confirm()` a Modal
- **Estado:** ⬜ PENDIENTE
- **Impacto:** 50+ archivos
- **Riesgo:** Bajo

**Crear hook `useConfirm`:**
```javascript
// client/src/hooks/useConfirm.js
import { useState, useCallback } from 'react'

export function useConfirm() {
  const [state, setState] = useState({
    isOpen: false,
    title: '',
    message: '',
    resolve: null
  })

  const confirm = useCallback((title, message = '') => {
    return new Promise((resolve) => {
      setState({ isOpen: true, title, message, resolve })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    state.resolve?.(true)
    setState(s => ({ ...s, isOpen: false }))
  }, [state.resolve])

  const handleCancel = useCallback(() => {
    state.resolve?.(false)
    setState(s => ({ ...s, isOpen: false }))
  }, [state.resolve])

  return {
    confirm,
    isOpen: state.isOpen,
    title: state.title,
    message: state.message,
    onConfirm: handleConfirm,
    onCancel: handleCancel
  }
}
```

---

## FASE 2: División de Rutas Backend (3-5 días)

### 2.1 Dividir `buffet.js` (5,011 líneas)
- **Estado:** ⬜ PENDIENTE
- **Riesgo:** Medio (requiere testing)

**Estructura propuesta:**
```
server/src/routes/buffet/
├── index.js          # Router principal (imports y exports)
├── config.js         # Configuración (categorías, productos, mesas)
├── productos.js      # CRUD de productos
├── mesas.js          # Gestión de mesas y zonas
├── comandas.js       # Comandas y items
├── pagos.js          # Cobros, facturación, tickets
├── takeaway.js       # Pedidos para llevar
└── dashboard.js      # KPIs y estadísticas
```

**Archivos a crear:**
- [ ] `server/src/routes/buffet/index.js`
- [ ] `server/src/routes/buffet/config.js`
- [ ] `server/src/routes/buffet/productos.js`
- [ ] `server/src/routes/buffet/mesas.js`
- [ ] `server/src/routes/buffet/comandas.js`
- [ ] `server/src/routes/buffet/pagos.js`
- [ ] `server/src/routes/buffet/takeaway.js`
- [ ] `server/src/routes/buffet/dashboard.js`

---

### 2.2 Dividir `admin.js` (7,724 líneas)
- **Estado:** ⬜ PENDIENTE
- **Riesgo:** Medio-Alto

**Estructura propuesta:**
```
server/src/routes/admin/
├── index.js          # Router principal
├── auth.js           # Login, logout, sesión
├── dashboard.js      # Dashboard principal
├── socios.js         # Ya existe (1,468 líneas) - subdividir
├── cuotas.js         # Ya existe (1,179 líneas)
├── configuracion.js  # Ya existe (1,247 líneas)
├── reportes.js       # Reportes generales
├── uploads.js        # Manejo de archivos
└── notificaciones.js # Push notifications
```

---

### 2.3 Crear Factory de CRUD
- **Estado:** ⬜ PENDIENTE
- **Impacto:** ~2,000 líneas eliminadas
- **Archivo a crear:** `server/src/utils/crudFactory.js`

**Código:**
```javascript
// server/src/utils/crudFactory.js
import { asyncHandler } from '../middleware/asyncHandler.js'
import { AppError } from '../utils/AppError.js'
import prisma from '../lib/prisma.js'

export function createCrudRoutes(modelName, options = {}) {
  const {
    uniqueField = 'id',
    requiredFields = [],
    orderBy = { id: 'desc' },
    include = undefined,
    filterFn = null
  } = options

  const model = prisma[modelName]

  return {
    list: asyncHandler(async (req, res) => {
      const { activo, ...filters } = req.query
      let where = {}

      if (activo !== undefined) {
        where.activo = activo === 'true'
      }

      if (filterFn) {
        where = { ...where, ...filterFn(req, filters) }
      }

      const items = await model.findMany({ where, orderBy, include })
      res.json({ success: true, data: items })
    }),

    get: asyncHandler(async (req, res) => {
      const item = await model.findUnique({
        where: { id: parseInt(req.params.id) },
        include
      })
      if (!item) throw new AppError('No encontrado', 404)
      res.json({ success: true, data: item })
    }),

    create: asyncHandler(async (req, res) => {
      // Validar campos requeridos
      for (const field of requiredFields) {
        if (!req.body[field]) {
          throw new AppError(`Campo ${field} es requerido`, 400)
        }
      }

      // Verificar unicidad si aplica
      if (uniqueField && uniqueField !== 'id' && req.body[uniqueField]) {
        const existing = await model.findUnique({
          where: { [uniqueField]: req.body[uniqueField] }
        })
        if (existing) {
          throw new AppError(`Ya existe un registro con ese ${uniqueField}`, 400)
        }
      }

      const item = await model.create({ data: req.body })
      res.status(201).json({ success: true, data: item })
    }),

    update: asyncHandler(async (req, res) => {
      const id = parseInt(req.params.id)

      const existing = await model.findUnique({ where: { id } })
      if (!existing) throw new AppError('No encontrado', 404)

      const item = await model.update({
        where: { id },
        data: req.body
      })
      res.json({ success: true, data: item })
    }),

    delete: asyncHandler(async (req, res) => {
      const id = parseInt(req.params.id)

      const existing = await model.findUnique({ where: { id } })
      if (!existing) throw new AppError('No encontrado', 404)

      await model.delete({ where: { id } })
      res.json({ success: true, message: 'Eliminado correctamente' })
    }),

    toggleActive: asyncHandler(async (req, res) => {
      const id = parseInt(req.params.id)

      const existing = await model.findUnique({ where: { id } })
      if (!existing) throw new AppError('No encontrado', 404)

      const item = await model.update({
        where: { id },
        data: { activo: !existing.activo }
      })
      res.json({ success: true, data: item })
    })
  }
}
```

---

### 2.4 Middleware `getUserAllowedCajas`
- **Estado:** ⬜ PENDIENTE
- **Impacto:** 4+ duplicaciones eliminadas
- **Archivo a crear:** `server/src/middleware/filterByCajas.js`

**Código:**
```javascript
// server/src/middleware/filterByCajas.js
import prisma from '../lib/prisma.js'

export async function getUserAllowedCajas(adminId) {
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    include: {
      rol: {
        include: {
          cajas: { select: { cajaId: true } }
        }
      }
    }
  })

  // Super admin tiene acceso a todo
  if (admin?.rol?.esSuperAdmin) return null

  // Retorna array de IDs permitidos o array vacío
  return admin?.rol?.cajas?.map(cr => cr.cajaId) || []
}

export function applyCajasFilter(where, cajasIds) {
  if (cajasIds === null) return where // Sin filtro
  return { ...where, cajaId: { in: cajasIds } }
}
```

---

## FASE 3: Componentes Frontend (4-6 días)

### 3.1 Crear `<CrudList>` Componente Genérico
- **Estado:** ⬜ PENDIENTE
- **Impacto:** 24 páginas *Lista.jsx
- **Archivo a crear:** `client/src/components/CrudList.jsx`

**Funcionalidades:**
- Búsqueda integrada
- Filtros configurables
- Tabla con ordenamiento
- Paginación
- Acciones CRUD
- Estados loading/error/empty

**Uso ejemplo:**
```jsx
<CrudList
  title="Socios"
  endpoint="/admin/socios"
  columns={[
    { key: 'nroSocio', label: 'Nro', sortable: true },
    { key: 'apellidoNombre', label: 'Nombre', sortable: true },
    { key: 'estado', label: 'Estado', render: (v) => <Badge>{v}</Badge> }
  ]}
  filters={[
    { key: 'estado', label: 'Estado', options: estadosOptions },
    { key: 'categoria', label: 'Categoría', endpoint: '/admin/categorias' }
  ]}
  actions={{
    view: (item) => `/admin/socios/${item.id}`,
    edit: (item) => `/admin/socios/${item.id}/editar`,
    delete: true
  }}
  searchPlaceholder="Buscar por nombre o DNI..."
/>
```

---

### 3.2 Dividir `GestionPedido.jsx` (2,233 líneas)
- **Estado:** ⬜ PENDIENTE
- **Riesgo:** Medio

**Estructura propuesta:**
```
client/src/components/buffet/GestionPedido/
├── index.jsx              # Componente principal (orquestador)
├── ProductoSelector.jsx   # Grid de productos por categoría
├── CarritoItems.jsx       # Lista de items en el carrito
├── PanelCobro.jsx         # Panel de cobro y pago
├── ClienteSelector.jsx    # Ya existe - mover aquí
├── useGestionPedido.js    # Hook con toda la lógica de estado
└── utils.js               # Funciones auxiliares
```

---

### 3.3 Dividir `Cuotas.jsx` (1,529 líneas)
- **Estado:** ⬜ PENDIENTE

**Componentes a extraer:**
- [ ] `CuotasFilters.jsx` - Filtros de búsqueda
- [ ] `CuotasTable.jsx` - Tabla principal
- [ ] `CuotasBulkActions.jsx` - Acciones masivas
- [ ] `GenerarCuotasModal.jsx` - Modal de generación
- [ ] `CobrarCuotaModal.jsx` - Modal de cobro
- [ ] `useCuotas.js` - Hook de lógica

---

### 3.4 Dividir `SocioForm.jsx` (1,418 líneas)
- **Estado:** ⬜ PENDIENTE

**Componentes a extraer:**
- [ ] `SocioFormDatosPersonales.jsx`
- [ ] `SocioFormDomicilio.jsx`
- [ ] `SocioFormContacto.jsx`
- [ ] `SocioFormCategoria.jsx`
- [ ] `SocioFormGrupoFamiliar.jsx`
- [ ] `SocioFormFoto.jsx`
- [ ] `useSocioForm.js` - Hook de lógica

---

## FASE 4: Servicios Backend (2-3 días)

### 4.1 Servicio de Generación de Números
- **Estado:** ⬜ PENDIENTE
- **Archivo a crear:** `server/src/services/numberGenerator.js`

**Código:**
```javascript
// server/src/services/numberGenerator.js
import prisma from '../lib/prisma.js'

export async function generateSequentialNumber(model, prefix, options = {}) {
  const { padding = 4, dateFormat = 'YYYYMMDD' } = options

  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  const dateStr = dateFormat === 'YYYYMMDD' ? `${year}${month}${day}` : `${year}${month}`
  const fullPrefix = `${prefix}${dateStr}`

  const last = await prisma[model].findFirst({
    where: { numero: { startsWith: fullPrefix } },
    orderBy: { numero: 'desc' }
  })

  const seq = last ? parseInt(last.numero.split('-')[1] || '0') + 1 : 1
  return `${fullPrefix}-${String(seq).padStart(padding, '0')}`
}

// Uso:
// const numero = await generateSequentialNumber('comanda', 'C')
// Resultado: C20260302-0001
```

---

### 4.2 Query Builder para Prisma
- **Estado:** ⬜ PENDIENTE
- **Archivo a crear:** `server/src/utils/queryBuilder.js`

---

## Progreso General

| Fase | Tareas | Completadas | % |
|------|--------|-------------|---|
| Fase 1 | 3 | 0 | 0% |
| Fase 2 | 4 | 0 | 0% |
| Fase 3 | 4 | 0 | 0% |
| Fase 4 | 2 | 0 | 0% |
| **Total** | **13** | **0** | **0%** |

---

## Notas de Implementación

### Orden de Ejecución Recomendado
1. Hooks nuevos (useSearch, useFormState) - no rompen nada existente
2. Factory de CRUD - se aplica gradualmente
3. División de buffet.js - área activa de desarrollo
4. CrudList componente - mayor impacto visual
5. División de páginas grandes - uno a la vez

### Testing
- Cada refactor debe probarse en desarrollo antes de producción
- Priorizar rutas del buffet ya que están en uso activo
- Mantener backward compatibility durante migración

### Rollback Plan
- Mantener archivos originales con sufijo `.backup` durante migración
- Cada PR debe ser atómico y reversible

---

## Historial de Cambios

| Fecha | Cambio | Autor |
|-------|--------|-------|
| 2026-03-02 | Documento inicial | Claude |

