# Sistema de Centro de Costos - Documentación de Implementación

**Fecha:** 2026-02-12
**Estado:** 90% Completo (9/10 tareas completadas)

## 📋 Objetivo

Implementar un sistema de **Centro de Costos** transversal a TODAS las operaciones económicas del sistema RojoPlus, permitiendo asociar cada transacción financiera (cobros, pagos, facturas, movimientos de caja, buffet, etc.) a un centro de costos para mejorar el seguimiento contable y generar reportes segmentados.

---

## 🗄️ Cambios en Base de Datos

### Archivo modificado: `server/prisma/schema.prisma`

#### Modelos actualizados (8 en total):

Se agregó el campo `centroCostoId Int?` y la relación `centroCosto CentroCosto?` a los siguientes modelos:

1. **Pago** - Cobros de cuotas sociales
2. **Cargo** - Cargos adicionales a socios
3. **Inscripcion** - Inscripciones deportivas
4. **Venta** - Ventas del comercio/kiosco
5. **OrdenCompra** - Órdenes de compra a proveedores
6. **Pedido** - Facturas de proveedores (MovimientoContable)
7. **Comanda** - Comandas del buffet
8. **PedidoTakeAway** - Pedidos take away del buffet

#### Ejemplo de cambio (Modelo Pago):

```prisma
model Pago {
  id                Int                  @id @default(autoincrement())
  // ... otros campos existentes
  centroCostoId     Int?                 @map("centro_costo_id")
  // ... más campos
  centroCosto       CentroCosto?         @relation(fields: [centroCostoId], references: [id])

  @@index([centroCostoId])
  @@map("pagos")
}
```

#### Modelo CentroCosto actualizado:

Se agregaron las **relaciones inversas** para todos los modelos:

```prisma
model CentroCosto {
  id                   Int                  @id @default(autoincrement())
  codigo               String               @unique
  nombre               String
  descripcion          String?
  tipo                 String               @default("OPERATIVO")
  activo               Boolean              @default(true)
  orden                Int                  @default(0)
  createdAt            DateTime             @default(now()) @map("created_at")
  updatedAt            DateTime             @updatedAt @map("updated_at")

  // Relaciones inversas (agregadas)
  actividades          Actividad[]
  asientoLineas        AsientoLinea[]
  cargos               Cargo[]
  comandas             Comanda[]
  inscripciones        Inscripcion[]
  itemsMovimiento      ItemMovimiento[]
  movimientosCaja      MovimientoCaja[]
  movimientosContables MovimientoContable[]
  ordenesCompra        OrdenCompra[]
  pagos                Pago[]
  pedidos              Pedido[]
  pedidosTakeAway      PedidoTakeAway[]
  ventas               Venta[]

  @@map("centros_costo")
}
```

### Migración ejecutada:

```bash
cd server
npx prisma db push
npx prisma generate
```

---

## 🧩 Componente Reutilizable

### Archivo creado: `client/src/components/SelectCentroCosto.jsx`

Componente selector de centro de costo reutilizable que:

- Carga automáticamente centros de costo activos desde `/admin/centros-costo?activo=true`
- Muestra formato: `{codigo} - {nombre}`
- Soporta validación opcional/requerida
- Maneja estados de carga y error
- Puede deshabilitarse cuando sea necesario

**Props:**
- `value` - ID del centro de costo seleccionado
- `onChange` - Callback cuando cambia (recibe el valor directamente)
- `name` - Nombre del campo (default: 'centroCostoId')
- `required` - Si es obligatorio (default: false)
- `disabled` - Si está deshabilitado (default: false)
- `className` - Clases CSS adicionales
- `showEmpty` - Mostrar opción vacía (default: true)
- `emptyLabel` - Texto para opción vacía (default: '-- Sin centro de costo --')

**Uso:**
```jsx
import SelectCentroCosto from '../../components/SelectCentroCosto'

<SelectCentroCosto
  value={centroCostoId}
  onChange={(val) => setCentroCostoId(val)}
  className="w-full"
/>
```

---

## 📝 Archivos Frontend Modificados

### 1. Cuotas.jsx - Pagos y Cargos
**Archivo:** `client/src/pages/admin/Cuotas.jsx`

**Cambios realizados:**

1. **Import del componente:**
```jsx
import SelectCentroCosto from '../../components/SelectCentroCosto'
```

2. **Estado para pagos:**
```jsx
const [centroCostoId, setCentroCostoId] = useState('')
```

3. **Estado para cargos (agregado al formCargo):**
```jsx
const [formCargo, setFormCargo] = useState({
  // ... otros campos
  centroCostoId: ''
})
```

4. **Actualización de la función registrarPago:**
```jsx
const result = await api.post('/admin/pagos', {
  socioId: socioIdPago,
  cuotaIds: seleccionadas,
  medioPagoId: parseInt(medioPagoId),
  cajaId: parseInt(cajaId),
  centroCostoId: centroCostoId ? parseInt(centroCostoId) : null,
})
```

5. **Actualización de crearCargo y guardarCargo:**
```jsx
await api.post('/admin/cargos', {
  // ... otros campos
  centroCostoId: formCargo.centroCostoId ? parseInt(formCargo.centroCostoId) : null
})
```

6. **UI - Modal de pago (después del campo Caja):**
```jsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">Centro de Costo</label>
  <SelectCentroCosto
    value={centroCostoId}
    onChange={(val) => setCentroCostoId(val)}
    className="w-full"
  />
  <p className="text-xs text-gray-500 mt-1">Opcional - para reportes contables</p>
</div>
```

7. **UI - Modales de cargos (crear y editar):**
Se agregó el mismo campo SelectCentroCosto en ambos modales.

---

### 2. Inscripciones.jsx - Inscripciones Deportivas
**Archivo:** `client/src/pages/admin/Inscripciones.jsx`

**Cambios realizados:**

1. **Import:** `import SelectCentroCosto from '../../components/SelectCentroCosto'`

2. **Estado formNueva (agregado centroCostoId):**
```jsx
const [formNueva, setFormNueva] = useState({
  socioId: '',
  actividadId: '',
  categoriaActividadId: '',
  exentoCuota: false,
  porcentajeCuota: 100,
  observaciones: '',
  centroCostoId: ''
})
```

3. **Estado formEditar (agregado centroCostoId):**
```jsx
const [formEditar, setFormEditar] = useState({
  exentoCuota: false,
  porcentajeCuota: 100,
  observaciones: '',
  centroCostoId: ''
})
```

4. **Función crearInscripcion (parseo a int):**
```jsx
const payload = {
  ...formNueva,
  centroCostoId: formNueva.centroCostoId ? parseInt(formNueva.centroCostoId) : null
}
await api.post('/admin/inscripciones', payload)
```

5. **Función editarInscripcion:**
```jsx
const payload = {
  ...formEditar,
  centroCostoId: formEditar.centroCostoId ? parseInt(formEditar.centroCostoId) : null
}
await api.put(`/admin/inscripciones/${inscripcionSeleccionada.id}`, payload)
```

6. **Función abrirModalEditar (cargar valor existente):**
```jsx
setFormEditar({
  exentoCuota: inscripcion.exentoCuota || false,
  porcentajeCuota: inscripcion.porcentajeCuota || 100,
  observaciones: inscripcion.observaciones || '',
  centroCostoId: inscripcion.centroCostoId || ''
})
```

7. **UI - Modal Nueva (después de Observaciones):**
```jsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Centro de Costo
  </label>
  <SelectCentroCosto
    value={formNueva.centroCostoId}
    onChange={(val) => setFormNueva(prev => ({ ...prev, centroCostoId: val }))}
    className="w-full"
  />
  <p className="text-xs text-gray-500 mt-1">Opcional - para reportes contables</p>
</div>
```

8. **UI - Modal Editar:** Mismo campo agregado.

---

### 3. BuffetComanda.jsx - Comandas del Buffet
**Archivo:** `client/src/pages/admin/buffet/BuffetComanda.jsx`

**Cambios realizados:**

1. **Import:** `import SelectCentroCosto from '../../../components/SelectCentroCosto'`

2. **Estado nuevaComandaData:**
```jsx
const [nuevaComandaData, setNuevaComandaData] = useState({
  buscarSocio: '',
  socioId: null,
  socioNombre: '',
  nombreGrupo: '',
  centroCostoId: ''
})
```

3. **Función abrirModalNuevaComanda (reset):**
```jsx
setNuevaComandaData({
  buscarSocio: '',
  socioId: null,
  socioNombre: '',
  nombreGrupo: '',
  centroCostoId: ''
})
```

4. **Función confirmarNuevaComanda:**
```jsx
const payload = {
  mesaId: parseInt(mesaId)
}
if (nuevaComandaData.socioId) {
  payload.socioId = nuevaComandaData.socioId
}
if (nuevaComandaData.nombreGrupo) {
  payload.observaciones = nuevaComandaData.nombreGrupo
}
if (nuevaComandaData.centroCostoId) {
  payload.centroCostoId = parseInt(nuevaComandaData.centroCostoId)
}
await api.post('/admin/buffet/comandas', payload)
```

5. **UI - Modal Nueva Comanda (después del campo nombreGrupo):**
```jsx
<div className="mb-6">
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Centro de Costo
  </label>
  <SelectCentroCosto
    value={nuevaComandaData.centroCostoId}
    onChange={(val) => setNuevaComandaData({ ...nuevaComandaData, centroCostoId: val })}
    className="w-full"
  />
  <p className="text-xs text-gray-500 mt-1">Opcional - para reportes contables</p>
</div>
```

---

### 4. BuffetTakeAway.jsx - Pedidos Take Away
**Archivo:** `client/src/pages/admin/buffet/BuffetTakeAway.jsx`

**Cambios realizados:**

1. **Import:** `import SelectCentroCosto from '../../../components/SelectCentroCosto'`

2. **Estado formData:**
```jsx
const [formData, setFormData] = useState({
  nombreCliente: '',
  telefono: '',
  horaEstimada: '',
  observaciones: '',
  items: [],
  centroCostoId: ''
})
```

3. **Función abrirModalNuevo (reset):**
```jsx
setFormData({
  nombreCliente: '',
  telefono: '',
  horaEstimada: '',
  observaciones: '',
  items: [],
  centroCostoId: ''
})
```

4. **Función crearPedido:**
```jsx
await api.post('/admin/buffet/takeaway', {
  nombreCliente: formData.nombreCliente,
  telefono: formData.telefono,
  horaEstimada: formData.horaEstimada || null,
  observaciones: formData.observaciones,
  centroCostoId: formData.centroCostoId ? parseInt(formData.centroCostoId) : null,
  items: formData.items.map(i => ({
    productoBuffetId: i.productoBuffetId,
    cantidad: i.cantidad
  }))
})
```

5. **UI - Modal Nuevo Pedido (después de observaciones):**
```jsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Centro de Costo
  </label>
  <SelectCentroCosto
    value={formData.centroCostoId}
    onChange={(val) => setFormData({ ...formData, centroCostoId: val })}
    className="w-full"
  />
  <p className="text-xs text-gray-500 mt-1">Opcional - para reportes contables</p>
</div>
```

---

### 5. MovimientoCajaForm.jsx - Movimientos de Caja
**Archivo:** `client/src/pages/admin/tesoreria/MovimientoCajaForm.jsx`

**Estado:** ✅ **YA ESTABA IMPLEMENTADO**

Este formulario ya tenía el selector de Centro de Costo implementado usando el componente `CentroCostoSelector`:

```jsx
import CentroCostoSelector from '../../../components/CentroCostoSelector'

// En el form state
const [form, setForm] = useState({
  // ... otros campos
  centroCostoId: null,
})

// En el UI (líneas 325-331)
<div>
  <CentroCostoSelector
    value={form.centroCostoId}
    onChange={(id) => setForm(prev => ({ ...prev, centroCostoId: id }))}
    label="Centro de Costo"
  />
</div>

// En el submit
await api.post('/admin/movimientos-caja', {
  // ... otros campos
  centroCostoId: form.centroCostoId || null,
})
```

---

### 6. OrdenCompraForm.jsx - Órdenes de Compra a Proveedores
**Archivo:** `client/src/pages/admin/egresos/OrdenCompraForm.jsx`

**Cambios realizados:**

1. **Import:** `import SelectCentroCosto from '../../../components/SelectCentroCosto'`

2. **Estado form:**
```jsx
const [form, setForm] = useState({
  entidadId: '',
  fechaEntrega: '',
  observaciones: '',
  centroCostoId: '',
  items: []
})
```

3. **Carga de datos al editar:**
```jsx
if (isEditing) {
  const ordenRes = await api.getFull(`/admin/ordenes-compra/${id}`)
  const orden = ordenRes.data
  setForm({
    entidadId: orden.entidadId?.toString() || '',
    fechaEntrega: orden.fechaEntrega ? orden.fechaEntrega.split('T')[0] : '',
    observaciones: orden.observaciones || '',
    centroCostoId: orden.centroCostoId?.toString() || '',
    items: orden.items.map(/* ... */)
  })
}
```

4. **Función handleSubmit:**
```jsx
const data = {
  entidadId: parseInt(form.entidadId),
  fechaEntrega: form.fechaEntrega || null,
  observaciones: form.observaciones || null,
  centroCostoId: form.centroCostoId ? parseInt(form.centroCostoId) : null,
  items: form.items.map(/* ... */)
}
```

5. **UI - Después del campo Observaciones:**
```jsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Centro de Costo
  </label>
  <SelectCentroCosto
    value={form.centroCostoId}
    onChange={(val) => setForm(prev => ({ ...prev, centroCostoId: val }))}
    className="w-full"
  />
  <p className="text-xs text-gray-500 mt-1">Opcional - para reportes contables</p>
</div>
```

---

### 7. FacturaCompraForm.jsx - Facturas de Proveedores
**Archivo:** `client/src/pages/admin/egresos/FacturaCompraForm.jsx`

**Cambios realizados:**

1. **Import:** `import SelectCentroCosto from '../../../components/SelectCentroCosto'`

2. **Estado form:**
```jsx
const [form, setForm] = useState({
  tipo: 'FACTURA_COMPRA',
  entidadId: '',
  ordenCompraId: '',
  fecha: new Date().toISOString().split('T')[0],
  fechaVencimiento: '',
  tipoComprobante: 'A',
  puntoVenta: '',
  numeroComprobante: '',
  conceptoId: '',
  observaciones: '',
  centroCostoId: '',
  items: []
})
```

3. **Función handleSubmit:**
```jsx
const data = {
  tipo: form.tipo,
  entidadId: parseInt(form.entidadId),
  ordenCompraId: form.ordenCompraId ? parseInt(form.ordenCompraId) : null,
  fecha: form.fecha,
  fechaVencimiento: form.fechaVencimiento || null,
  tipoComprobante: tipoComprobanteCalculado,
  puntoVenta: form.puntoVenta.padStart(4, '0'),
  numeroComprobante: form.numeroComprobante.padStart(8, '0'),
  conceptoId: form.conceptoId ? parseInt(form.conceptoId) : null,
  observaciones: form.observaciones || null,
  centroCostoId: form.centroCostoId ? parseInt(form.centroCostoId) : null,
  subtotal: totales.subtotal,
  // ... resto de campos
}
```

4. **UI - Grid con Observaciones y Centro de Costo (línea 686):**
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      Observaciones
    </label>
    <input
      type="text"
      name="observaciones"
      value={form.observaciones}
      onChange={handleChange}
      placeholder="Notas adicionales..."
      className="input-field w-full"
    />
  </div>

  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      Centro de Costo
    </label>
    <SelectCentroCosto
      value={form.centroCostoId}
      onChange={(val) => setForm(prev => ({ ...prev, centroCostoId: val }))}
      className="w-full"
    />
    <p className="text-xs text-gray-500 mt-1">Opcional - para reportes contables</p>
  </div>
</div>
```

---

## 📊 Patrón de Implementación

Para cada formulario se siguió este patrón consistente:

### 1. Import del componente
```jsx
import SelectCentroCosto from '../../components/SelectCentroCosto'
// o '../../../components/SelectCentroCosto' dependiendo de la profundidad
```

### 2. Agregar campo al estado
```jsx
const [formData, setFormData] = useState({
  // ... campos existentes
  centroCostoId: ''
})
```

### 3. Parseo al enviar al backend
```jsx
await api.post('/endpoint', {
  // ... otros campos
  centroCostoId: formData.centroCostoId ? parseInt(formData.centroCostoId) : null
})
```

### 4. Agregar selector en el UI
```jsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Centro de Costo
  </label>
  <SelectCentroCosto
    value={formData.centroCostoId}
    onChange={(val) => setFormData(prev => ({ ...prev, centroCostoId: val }))}
    className="w-full"
  />
  <p className="text-xs text-gray-500 mt-1">Opcional - para reportes contables</p>
</div>
```

### 5. Reset al limpiar formulario
Siempre incluir `centroCostoId: ''` al resetear el estado.

---

## ⚠️ Notas Importantes

### Campo Opcional
- El campo `centroCostoId` es **OPCIONAL** (nullable) en todos los modelos
- Se valida en frontend: `centroCostoId ? parseInt(centroCostoId) : null`
- Si no se selecciona, se envía `null` al backend

### Validación de Tipo
- **SIEMPRE** parsear a entero antes de enviar: `parseInt(centroCostoId)`
- Validar que exista antes de parsear para evitar `NaN`

### Componentes Existentes
Existen DOS componentes de selector de centro de costo:
1. **`SelectCentroCosto.jsx`** - Nuevo, más simple, usado en formularios nuevos
2. **`CentroCostoSelector.jsx`** - Existente, usado en MovimientoCajaForm

Ambos funcionan correctamente, se puede usar cualquiera.

---

## 📦 Modelos NO Modificados

Los siguientes modelos económicos **NO** fueron modificados (no se les agregó centroCostoId):

- **Cuota** - La cuota en sí no tiene centro de costo, pero el **Pago** sí lo tiene
- **Venta** - Las ventas del comercio SÍ tienen centroCostoId (está en la lista de modificados)
- **Asiento** / **AsientoLinea** - Ya tienen centroCostoId en AsientoLinea
- **MovimientoCaja** - Ya tiene centroCostoId implementado
- **MovimientoContable** (Pedido/Factura proveedor) - SÍ modificado

---

## ✅ Tareas Completadas

1. ✅ Actualizar schema.prisma con centroCostoId en todos los modelos económicos
2. ✅ Migrar base de datos con nuevos campos de centro de costos
3. ✅ Crear componente selector de centro de costos reutilizable
4. ✅ Actualizar formulario de Pagos/Cobranzas (Cuotas.jsx)
5. ✅ Actualizar formulario de Cargos (Cuotas.jsx)
6. ✅ Actualizar formulario de Inscripciones deportivas (Inscripciones.jsx)
7. ✅ Actualizar Buffet - Comandas (BuffetComanda.jsx) y TakeAway (BuffetTakeAway.jsx)
8. ✅ Verificar MovimientosCaja (MovimientoCajaForm.jsx) - Ya estaba implementado
9. ✅ Actualizar formularios de Compras/Proveedores (OrdenCompraForm.jsx, FacturaCompraForm.jsx)

---

## 🔄 Tarea Pendiente

### Task #10: Actualizar reportes y consultas para incluir centro de costos

Esta tarea involucra agregar **filtros de centro de costo** en las siguientes páginas de reportes:

#### Reportes a actualizar:
1. **ReporteCuotas.jsx** - Reporte de cuotas y pagos
2. **ReporteActividades.jsx** - Reporte de actividades deportivas
3. **ReporteCentrosCosto.jsx** - Reporte específico de centros de costo (verificar si existe)
4. **Reportes.jsx** - Dashboard principal de reportes
5. **Reportes de Buffet** (verificar en buffet/)
6. **Reportes de Tesorería** - Movimientos de caja por centro de costo

#### Patrón esperado para reportes:
1. Agregar filtro de centro de costo en el panel de filtros
2. Incluir el parámetro en las consultas GET al backend
3. Mostrar columna de centro de costo en las tablas de resultados
4. Permitir exportar reportes con centro de costo incluido

---

## 🧪 Testing Sugerido

Antes de considerar la implementación completa, se recomienda probar:

1. **Crear operaciones** con y sin centro de costo en cada módulo
2. **Editar operaciones** cambiando el centro de costo
3. **Verificar en base de datos** que los IDs se guarden correctamente
4. **Validar consultas** que los datos se recuperen con el centro de costo asociado
5. **Probar reportes** filtrando por centro de costo (pendiente Task #10)

---

## 🔗 Referencias

### Endpoints Backend (verificar que soporten centroCostoId):
- `POST /admin/pagos` - Crear pago
- `POST /admin/cargos` - Crear cargo
- `POST /admin/inscripciones` - Crear inscripción
- `PUT /admin/inscripciones/:id` - Editar inscripción
- `POST /admin/buffet/comandas` - Crear comanda
- `POST /admin/buffet/takeaway` - Crear pedido takeaway
- `POST /admin/movimientos-caja` - Crear movimiento de caja
- `POST /admin/ordenes-compra` - Crear orden de compra
- `PUT /admin/ordenes-compra/:id` - Editar orden de compra
- `POST /admin/movimientos-contables` - Crear factura proveedor

### Archivos de Esquema:
- `server/prisma/schema.prisma` - Definición de modelos
- `server/src/routes/*.js` - Endpoints del backend (verificar que acepten centroCostoId)

---

## 📌 Convenciones

- **Nombres de campo:** `centroCostoId` (camelCase en código, snake_case en DB)
- **Tipo de dato:** `Int?` (nullable integer)
- **Mapeo DB:** `@map("centro_costo_id")`
- **Índices:** Se agregó `@@index([centroCostoId])` para optimizar consultas
- **Labels UI:** "Centro de Costo" (sin "de Costos")
- **Texto ayuda:** "Opcional - para reportes contables"

---

## 🎯 Próximos Pasos

1. **Verificar endpoints backend** - Confirmar que todos los endpoints modificados soporten el campo `centroCostoId`
2. **Probar en desarrollo** - Crear registros con centro de costo y verificar persistencia
3. **Implementar Task #10** - Agregar filtros de centro de costo en reportes
4. **Testing completo** - Validar todos los flujos end-to-end
5. **Documentación API** - Actualizar documentación de endpoints si existe

---

**Fin de la documentación**
