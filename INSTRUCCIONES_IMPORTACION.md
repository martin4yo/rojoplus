# Sistema de Importación Masiva de Productos

## Instalación de Dependencias

### Backend
```bash
cd server
npm install multer csv-parser xlsx
```

### Dependencias instaladas:
- **multer**: Para manejo de archivos multipart/form-data
- **csv-parser**: Para parsear archivos CSV
- **xlsx**: Para leer y generar archivos Excel

---

## Integración

### 1. Agregar ruta en el servidor

Editar `server/src/index.js` y agregar:

```javascript
// Importar la ruta
import importacionRoutes from './routes/importacion.js'

// Registrar la ruta (después de las otras rutas)
app.use('/api/importacion', importacionRoutes)
```

### 2. Crear directorio para plantillas

```bash
mkdir -p server/public/templates
```

### 3. Agregar ruta en el frontend

Editar `client/src/App.jsx` y agregar en las rutas de admin:

```javascript
import ImportarProductos from './pages/admin/buffet/ImportarProductos'

// Dentro del AdminLayout
<Route path="/admin/buffet/productos/importar" element={<ImportarProductos />} />
```

### 4. Agregar botón en la lista de productos

Editar `client/src/pages/admin/buffet/BuffetProductos.jsx` y agregar en el header:

```jsx
import { Upload } from 'lucide-react'

// En el header, junto al botón "Nuevo Producto"
{tienePermiso(PERMISOS.BUFFET_PRODUCTOS) && (
  <>
    <Button
      onClick={() => navigate('/admin/buffet/productos/importar')}
      variant="secondary"
      className="flex items-center gap-2"
    >
      <Upload className="w-4 h-4" />
      Importar
    </Button>
    <Button
      onClick={() => setMostrarModal(true)}
      className="flex items-center gap-2"
    >
      <Plus className="w-4 h-4" />
      Nuevo Producto
    </Button>
  </>
)}
```

---

## Uso del Sistema

### 1. Descargar Plantilla
- Los usuarios pueden descargar la plantilla en formato Excel (.xlsx) o CSV
- La plantilla Excel incluye una hoja con ejemplos y otra con instrucciones detalladas

### 2. Completar Plantilla

#### Campos Requeridos:
- **codigo**: Código único del producto (ej: CAFE001)
- **nombre**: Nombre del producto
- **categoria_menu**: Código de la categoría del menú (debe existir)
- **precio**: Precio de venta (número decimal)

#### Campos Opcionales:
- **descripcion**: Descripción detallada
- **codigo_barras**: Código de barras EAN
- **activo**: SI/NO (por defecto SI)
- **disponible**: SI/NO (por defecto SI)
- **destacado**: SI/NO (por defecto NO)
- **venta_buffet**: SI/NO - Se vende en Buffet (por defecto SI)
- **venta_kiosco**: SI/NO - Se vende en Kiosco (por defecto SI)
- **venta_takeaway**: SI/NO - Se vende en TakeAway (por defecto SI)
- **orden**: Número para orden de visualización (por defecto 0)

### 3. Cargar Archivo
- Formatos soportados: CSV, Excel (.xlsx, .xls)
- Tamaño máximo: 5MB
- Opción de sobreescribir productos existentes

### 4. Revisar Resultados
- Resumen con totales: exitosos, errores, advertencias, omitidos
- Detalle de cada registro procesado
- Errores específicos por fila y campo

---

## Ejemplo de Plantilla CSV

```csv
codigo,nombre,descripcion,categoria_menu,precio,codigo_barras,activo,disponible,destacado,venta_buffet,venta_kiosco,venta_takeaway,orden
CAFE001,Café Espresso,Café espresso tradicional,BEBIDAS_CALIENTES,150.00,7790001001234,SI,SI,NO,SI,SI,SI,1
CAFE002,Café con Leche,Café con leche cremoso,BEBIDAS_CALIENTES,180.00,7790001001241,SI,SI,SI,SI,SI,NO,2
MEDIALUNAS,Medialunas (x3),3 Medialunas recién horneadas,PANADERIA,200.00,7790001001258,SI,SI,NO,SI,SI,NO,3
SANDWICH01,Sandwich de Jamón y Queso,Pan francés con jamón cocido y queso,SANDWICHES,350.00,,SI,SI,NO,SI,NO,SI,5
AGUA500,Agua Mineral 500ml,Agua mineral sin gas,BEBIDAS_FRIAS,120.00,7790001001265,SI,SI,NO,NO,SI,NO,10
```

---

## Validaciones Implementadas

### Validaciones de Datos:
- ✅ Campos requeridos presentes y no vacíos
- ✅ Código único (no duplicado en el sistema si no se sobreescribe)
- ✅ Categoría de menú existe y está activa
- ✅ Precio es un número válido positivo
- ✅ Valores SI/NO en campos booleanos (activo, disponible, destacado)
- ✅ Valores SI/NO en canales de venta (venta_buffet, venta_kiosco, venta_takeaway)
- ✅ Al menos un canal de venta debe estar activo
- ✅ Código de barras formato correcto (si se proporciona)
- ✅ Orden es un número válido

### Proceso de Importación:
1. **Parsear archivo** (CSV o Excel)
2. **Validar formato** de cada registro
3. **Verificar existencia** de productos por código
4. **Crear o actualizar** según opción de sobreescritura
5. **Generar reporte** detallado de resultados

---

## Estructura de Base de Datos

La importación crea/actualiza registros en dos tablas:

### Tabla `productos` (general)
```javascript
{
  codigo: string (único),
  nombre: string,
  descripcion: string | null,
  precioVenta: decimal,
  activo: boolean
}
```

### Tabla `productos_buffet` (específica)
```javascript
{
  productoId: int (FK → productos.id),
  categoriaMenuId: int (FK → categorias_menu.id),
  nombre: string,
  descripcion: string | null,
  precio: decimal,
  disponible: boolean,
  destacado: boolean,
  activo: boolean,
  codigoBarras: string | null,
  tiposVenta: string[] (["BUFFET", "KIOSCO"]),
  orden: int
}
```

---

## API Endpoints

### GET `/api/importacion/plantilla?formato=xlsx|csv`
Descarga la plantilla de importación

**Parámetros:**
- `formato`: "xlsx" o "csv" (por defecto "csv")

**Response:**
- Archivo binario (Excel o CSV)

---

### POST `/api/importacion/productos`
Importa productos desde archivo

**Headers:**
- `Content-Type: multipart/form-data`
- `Authorization: Bearer {token}`

**Body:**
- `archivo`: File (CSV o Excel)
- `sobreescribir`: boolean (opcional, por defecto false)

**Permisos requeridos:**
- `BUFFET_PRODUCTOS`

**Response:**
```json
{
  "success": true,
  "mensaje": "Importación completada",
  "resultado": {
    "total": 10,
    "exitosos": 8,
    "errores": 1,
    "advertencias": 0,
    "omitidos": 1,
    "detalleExitosos": [...],
    "detalleErrores": [...],
    "detalleAdvertencias": [...],
    "detalleOmitidos": [...]
  }
}
```

---

### GET `/api/importacion/categorias-menu`
Obtiene lista de categorías de menú disponibles

**Response:**
```json
[
  {
    "codigo": "BEBIDAS_CALIENTES",
    "nombre": "Bebidas Calientes",
    "descripcion": "Café, té, chocolate"
  }
]
```

---

## Características Destacadas

✅ **Múltiples formatos**: CSV y Excel
✅ **Plantilla con ejemplos**: Incluye datos de muestra
✅ **Validación robusta**: Valida cada campo antes de importar
✅ **Reporte detallado**: Indica exactamente qué falló y dónde
✅ **Sobreescritura opcional**: Permite actualizar productos existentes
✅ **Transacciones seguras**: Usa transacciones de BD para evitar inconsistencias
✅ **Límite de tamaño**: Previene archivos demasiado grandes (5MB)
✅ **Interfaz intuitiva**: Proceso guiado paso a paso
✅ **Responsive**: Funciona en desktop y móvil

---

## Posibles Mejoras Futuras

- [ ] Soporte para imágenes (URLs o carga desde ZIP)
- [ ] Importación por lotes (procesar en background)
- [ ] Exportación de productos actuales a Excel
- [ ] Importación incremental (solo nuevos)
- [ ] Vista previa antes de importar
- [ ] Plantilla con categorías dinámicas
- [ ] Validación de códigos de barras EAN-13
- [ ] Importación de stock inicial
- [ ] Soporte para múltiples hojas en Excel
- [ ] Historial de importaciones

---

## Testing

### Probar con datos de ejemplo:
```bash
# 1. Iniciar servidor
cd server && npm run dev

# 2. Ir a la aplicación
http://localhost:5173/admin/buffet/productos/importar

# 3. Descargar plantilla Excel
# 4. Cargar el archivo sin modificar (debería importar 3 productos)
# 5. Intentar cargar nuevamente sin sobreescribir (3 omitidos)
# 6. Intentar cargar con sobreescribir (3 actualizados)
```

### Casos de prueba:
- ✅ Archivo vacío
- ✅ Campos requeridos faltantes
- ✅ Categoría inexistente
- ✅ Precio negativo o inválido
- ✅ Código duplicado sin sobreescribir
- ✅ Código duplicado con sobreescribir
- ✅ Formato SI/NO inválido
- ✅ Tipos de venta inválidos
- ✅ Archivo muy grande (>5MB)
- ✅ Formato de archivo inválido
