# Changelog - 20 de Enero 2026

## Resumen de Implementaciones

Esta sesion se enfoco en **mejoras de reportes y visualizacion de datos**.

---

## 1. ReporteCuotas - Layout Optimizado

### Cambios
- **Layout reestructurado**: Graficos de torta a la izquierda, tabla de desglose a la derecha
- Graficos compactos con leyenda integrada (sin etiquetas externas)
- Drill-down funcional: Categorias -> Actividades -> Categorias de Actividad
- Responsive: en movil se apilan verticalmente

### Archivos Modificados
- `client/src/pages/admin/ReporteCuotas.jsx`

---

## 2. ReporteActividades - Layout Optimizado

### Cambios
- **Layout lateral**: Grafico de torta a la izquierda (272px), tarjetas de actividades a la derecha
- Graficos compactos con leyenda integrada debajo del grafico
- Drill-down: click en actividad muestra distribucion por categorias
- Boton volver para navegar entre niveles

### Archivos Modificados
- `client/src/pages/admin/ReporteActividades.jsx`

---

## 3. ReporteSocios - Metricas Avanzadas

### Filtro por Estado
- Agregado selector de estado en la lista "Por Tipo"
- **Default: VIGENTE**
- Filtra automaticamente las listas "Por Tipo" y "Por Categoria"
- Muestra cantidad de socios filtrados

### Porcentajes en Barras
- Todas las listas (Por Estado, Por Tipo, Por Categoria) muestran cantidad + porcentaje

### Metricas Generales (fila superior)
| Metrica | Descripcion |
|---------|-------------|
| Total | Cantidad total de socios |
| Activos | Socios en estado VIGENTE |
| Con actividad | Socios inscriptos en al menos una actividad |
| Con deuda | Socios VIGENTES con cuotas pendientes |
| Antiguedad prom. | Promedio de anos como socio |

### Crecimiento por Periodo (nueva seccion)
- **Selector de periodo**: ultimos 24 meses, default mes actual
- **Altas**: Socios con fechaAlta en el periodo seleccionado
- **Bajas**: Socios con fechaBaja en el periodo seleccionado
- **Crecimiento**: Altas - Bajas (con indicador verde/rojo)

### Correcciones
- "Con deuda" solo cuenta socios en estado VIGENTE
- "Altas" solo usa fechaAlta (no createdAt como fallback)
- Antiguedad promedio solo considera socios con fechaAlta definida

### Archivos Modificados
- `client/src/pages/admin/ReporteSocios.jsx`

---

## 4. AdminLayout - Branding

### Cambio
- Header cambiado de "Tu pasion tiene recompensas" a **"El equipo de la ciudad"**

### Archivo Modificado
- `client/src/components/AdminLayout.jsx`

---

## Verificaciones de Datos

### Importacion de Socios
Se verifico que la importacion desde Excel guarda correctamente:
- **fechaAlta**: 4406 socios con fecha de alta guardada
- Distribucion por ano: 472 en 2025, 342 en 2024, 560 en 2023, etc.

---

## Archivos Modificados - Resumen

| Archivo | Cambios |
|---------|---------|
| `client/src/pages/admin/ReporteCuotas.jsx` | Layout lateral, graficos compactos |
| `client/src/pages/admin/ReporteActividades.jsx` | Layout lateral, graficos compactos |
| `client/src/pages/admin/ReporteSocios.jsx` | Filtro estado, metricas, selector periodo |
| `client/src/components/AdminLayout.jsx` | Header text |

---

---

## SESION 2 - Contabilidad y Tesorería

### 5. Plan de Cuentas Contables (CRUD Completo)

**Modelo de datos:**
- `CuentaContable`: codigo, nombre, tipo (ACTIVO/PASIVO/PATRIMONIO/INGRESO/EGRESO)
- Estructura jerárquica con padreId y nivel automático
- Campo esImputable (true = recibe movimientos, false = solo agrupa)

**Backend (server/src/routes/contabilidad.js):**
- GET /cuentas-contables - Lista jerarquica o plana (flat=true)
- GET /cuentas-contables/:id - Detalle con padre, hijos y conceptos vinculados
- POST /cuentas-contables - Crear con nivel automático
- PUT /cuentas-contables/:id - Actualizar
- DELETE /cuentas-contables/:id - Eliminar con validación de integridad

**Frontend:**
- `PlanCuentasLista.jsx` - Vista de árbol expandible, filtro por tipo, acciones
- `CuentaContableForm.jsx` - Formulario con selección de tipo, padre, código sugerido

### 6. ConceptoModal - Crear Concepto Inline

**Componente:** `client/src/components/ConceptoModal.jsx`
- Modal reutilizable para crear conceptos desde cualquier formulario
- Campos: código, nombre, descripción, tipo (INGRESO/EGRESO/AMBOS)
- Checkboxes: usaEnTesoreria, usaEnCompras, usaEnVentas
- Selector de cuenta contable vinculada
- Usado en MovimientoCajaForm con botón "+"

### 7. ConfiguracionForm - Campos para Conceptos

**Archivo:** `client/src/pages/admin/ConfiguracionForm.jsx`
- Agregados campos específicos para tabla "conceptos-tesoreria":
  - Selector de tipo (INGRESO/EGRESO/AMBOS)
  - Checkboxes para "Usar en" (Tesorería, Compras, Ventas)
  - Dropdown de cuenta contable vinculada

**Backend actualizado:**
- POST/PUT /conceptos-tesoreria ahora acepta: usaEnCompras, usaEnVentas, usaEnTesoreria

### 8. TransferenciasLista - Filtro Optimizado

**Antes:** Panel con padding, texto "Periodo:", ocupaba mucho espacio
**Ahora:** Fila compacta inline con inputs de fecha más pequeños y botón "Limpiar"

### 9. TransferenciaForm - Concepto + Descripción

**Cambios en schema.prisma:**
```prisma
model TransferenciaCaja {
  // antes: concepto String?
  // ahora:
  conceptoId    Int?      @map("concepto_id")
  descripcion   String?
  concepto      Concepto? @relation(...)
}
```

**Frontend actualizado:**
- Dropdown de conceptos (tipo AMBOS, usaEnTesoreria=true)
- Campo descripción para texto libre adicional
- Grid de 3 columnas: monto, concepto, descripción

### 10. TablasAuxiliares - Tarjeta Plan de Cuentas

- Agregada tarjeta de Plan de Cuentas en sección Tesorería
- Muestra cantidad total y activas
- Botón "Nueva" y link al listado

---

## Archivos Modificados - Sesión 2

| Archivo | Cambios |
|---------|---------|
| `server/prisma/schema.prisma` | TransferenciaCaja con conceptoId y descripcion, Concepto con transferencias |
| `server/src/routes/contabilidad.js` | CRUD completo cuentas-contables |
| `server/src/routes/tesoreria.js` | Transferencias con conceptoId y descripcion |
| `server/src/routes/admin.js` | conceptos-tesoreria con nuevos campos |
| `client/src/App.jsx` | Rutas contabilidad/plan-cuentas |
| `client/src/pages/admin/TablasAuxiliares.jsx` | Tarjeta Plan de Cuentas |
| `client/src/pages/admin/ConfiguracionForm.jsx` | Campos para conceptos-tesoreria |
| `client/src/pages/admin/contabilidad/PlanCuentasLista.jsx` | NUEVO |
| `client/src/pages/admin/contabilidad/CuentaContableForm.jsx` | NUEVO |
| `client/src/components/ConceptoModal.jsx` | NUEVO |
| `client/src/pages/admin/tesoreria/TransferenciasLista.jsx` | Filtro compacto |
| `client/src/pages/admin/tesoreria/TransferenciaForm.jsx` | conceptoId + descripcion |
| `client/src/pages/admin/tesoreria/MovimientoCajaForm.jsx` | Modal crear concepto |

---

## Migraciones Pendientes

Ejecutar desde la carpeta `server/`:
```bash
npx prisma db push
npx prisma generate
```

Cambios en BD:
- Tabla `cuentas_contables` (nueva)
- Tabla `transferencias_caja`: columna `concepto` -> `concepto_id` + `descripcion`
- Tabla `conceptos`: campos `usa_en_compras`, `usa_en_ventas`, `usa_en_tesoreria`

---

## Próximos Pasos - Próxima Sesión

1. **Flujo Proveedores**: OrdenCompra -> FacturaCompra -> OrdenPago -> MovimientoCaja
2. **Flujo Clientes**: Pedido -> FacturaVenta -> ReciboCobro -> MovimientoCaja
3. **Flujo Personal**: LiquidacionSueldo (similar a Periodos de cuotas)

Ver plan completo en: `C:\Users\marti\.claude\plans\linear-cooking-gosling.md`

---

*Documentado: 20 de Enero 2026 - Sesión 2*

---

## SESION 3 - Módulo de Stock Completo

### 11. Modelos de Stock (Base de Datos)

**Nuevos modelos en schema.prisma:**
- `CategoriaProducto` - Categorías de productos (Indumentaria, Accesorios, etc.)
- `Producto` - Productos con precio compra/venta y conceptos contables
- `ProductoVariante` - Stock por talle/color con stock mínimo
- `ProductoFoto` - Múltiples fotos por producto con orden y principal
- `MovimientoStock` - Historial de ingresos, egresos y ajustes

**Campos especiales en Producto:**
- `conceptoCompraId` - Concepto contable para compras
- `conceptoVentaId` - Concepto contable para ventas

### 12. Backend Stock (server/src/routes/stock.js)

**Endpoints implementados:**
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/admin/categorias-producto` | Listar categorías |
| POST | `/admin/categorias-producto` | Crear categoría |
| PUT | `/admin/categorias-producto/:id` | Actualizar categoría |
| GET | `/admin/productos` | Listar productos con variantes y fotos |
| GET | `/admin/productos/:id` | Detalle de producto |
| POST | `/admin/productos` | Crear producto con variantes |
| PUT | `/admin/productos/:id` | Actualizar producto |
| DELETE | `/admin/productos/:id` | Eliminar producto |
| POST | `/admin/productos/:id/variantes` | Agregar variante |
| PUT | `/admin/producto-variantes/:id` | Actualizar variante |
| DELETE | `/admin/producto-variantes/:id` | Eliminar variante |
| POST | `/admin/productos/:id/fotos` | Subir foto |
| DELETE | `/admin/productos/:id/fotos/:fotoId` | Eliminar foto |
| GET | `/admin/movimientos-stock` | Listar movimientos |
| POST | `/admin/movimientos-stock/ajuste` | Ajuste manual |
| GET | `/admin/stock/alertas` | Productos bajo mínimo |
| GET | `/admin/stock/resumen` | Resumen de stock |

### 13. Frontend Stock

**Páginas creadas en `client/src/pages/admin/stock/`:**

| Archivo | Descripción |
|---------|-------------|
| `ProductosLista.jsx` | Grid/Lista de productos con switch de vista |
| `ProductoForm.jsx` | Formulario con variantes, fotos, conceptos |
| `CategoriasProducto.jsx` | CRUD inline de categorías |
| `MovimientosStockLista.jsx` | Historial con filtros |
| `AjusteStockForm.jsx` | Ajuste manual (ingreso/egreso/ajuste) |
| `AlertasStock.jsx` | Productos bajo stock mínimo |

### 14. ProductosLista - Vista Dual (Shop/Lista)

**Funcionalidades:**
- **Toggle de vista** guardado en localStorage
- **Vista Shop**: Grid de cards con imágenes, precio, stock por talle
- **Vista Lista**: Tabla ordenable con columnas clickeables
- **Filtros**: búsqueda, categoría, solo activos, con stock, bajo mínimo
- **Acciones**: Ver detalle, Ver movimientos, Editar
- **Exportar CSV** (solo en vista lista)
- **Totales**: Items, Stock total, Valor total

**Columnas ordenables (Vista Lista):**
- Código, Nombre, Categoría, Stock, Precio, Valor Stock

### 15. Datos de Ejemplo (Seeds)

**seed-stock.js:**
- 4 categorías: Indumentaria, Accesorios, Hogar y Cocina, Escolar
- 29 productos de merchandising del club
- 55 variantes con talles y stock

**seed-fotos.js:**
- 35 fotos de productos usando Unsplash
- URLs con keywords relevantes (red tshirt, hoodie, cap, etc.)

### 16. Correcciones de Modelos

**Fixes aplicados:**
- `esSuperAdmin` movido de Admin a Rol (usuarios.js actualizado)
- `concepto` → `conceptoTesoreria` en TipoSocio (admin.js actualizado)
- Frontend actualizado para acceder a `usuario.rol?.esSuperAdmin`
- Checkbox esSuperAdmin removido de UsuarioForm (se hereda del Rol)

---

## Archivos Modificados - Sesión 3

| Archivo | Cambios |
|---------|---------|
| `server/prisma/schema.prisma` | +5 modelos stock, conceptoCompraId/VentaId en Producto |
| `server/src/routes/stock.js` | CRUD completo productos, variantes, fotos, movimientos |
| `server/src/routes/admin.js` | Fix concepto → conceptoTesoreria en TipoSocio |
| `server/src/routes/usuarios.js` | Fix esSuperAdmin (ahora en rol.esSuperAdmin) |
| `server/prisma/seed-stock.js` | NUEVO - Datos de ejemplo productos |
| `server/prisma/seed-fotos.js` | NUEVO - Fotos de productos |
| `client/src/pages/admin/stock/ProductosLista.jsx` | Vista dual Shop/Lista |
| `client/src/pages/admin/stock/ProductoForm.jsx` | Form con variantes y fotos |
| `client/src/pages/admin/stock/CategoriasProducto.jsx` | CRUD inline |
| `client/src/pages/admin/stock/MovimientosStockLista.jsx` | Lista con filtros |
| `client/src/pages/admin/stock/AjusteStockForm.jsx` | Ajuste manual |
| `client/src/pages/admin/stock/AlertasStock.jsx` | Productos bajo mínimo |
| `client/src/pages/admin/usuarios/UsuariosLista.jsx` | Fix esSuperAdmin |
| `client/src/pages/admin/usuarios/UsuarioForm.jsx` | Removido checkbox esSuperAdmin |

---

## Estado del Módulo Stock

| Componente | Estado |
|------------|--------|
| Modelos BD | ✅ Completo |
| Backend API | ✅ Completo |
| Categorías | ✅ Completo |
| Productos CRUD | ✅ Completo |
| Variantes/Talles | ✅ Completo |
| Fotos múltiples | ✅ Completo |
| Movimientos Stock | ✅ Completo |
| Ajuste manual | ✅ Completo |
| Alertas bajo mínimo | ✅ Completo |
| Vista dual Shop/Lista | ✅ Completo |
| Exportar CSV | ✅ Completo |
| Seeds de ejemplo | ✅ Completo |

---

## Próximos Pasos

1. **Flujo Proveedores**: OrdenCompra → FacturaCompra → OrdenPago
2. **Flujo Clientes**: Pedido → FacturaVenta → ReciboCobro
3. **Flujo Personal**: LiquidacionSueldo (similar a Periodos de cuotas)
4. **Integración Stock-Facturas**: Items de factura afectan stock

---

*Documentado: 20 de Enero 2026 - Sesión 3*
