# 🎨 Sistema de Personalización Visual (Branding)

Guía completa del sistema de branding multi-tenant para RojoPlus/Clubix.

## Overview

El sistema de branding permite a cada tenant (club) personalizar completamente la apariencia visual de su instancia:
- **16 colores CSS** agrupados en 5 categorías
- **Logo del club** con URL personalizada
- **Favicon** dinámico
- **Título y tema** adaptado por tenant

## Backend

### Modelos de Datos

**Tabla `tenants`** (Prisma):
```prisma
model Tenant {
  // ... fields
  logoUrl      String?           // URL del logo
  faviconUrl   String?           // URL del favicon
  colores      Json              // Paleta de colores (JSON object)
}
```

**Colores por defecto** (16 variables):
```json
{
  "primario": "#DC2626",
  "primarioOscuro": "#991B1B",
  "primarioClaro": "#FCA5A5",
  "secundario": "#7C3AED",
  "secundarioOscuro": "#5B21B6",
  "secundarioClaro": "#C4B5FD",
  "acento": "#22D3EE",
  "exito": "#10B981",
  "advertencia": "#F59E0B",
  "error": "#EF4444",
  "info": "#3B82F6",
  "fondoPrincipal": "#FFFFFF",
  "fondoSecundario": "#F9FAFB",
  "textoPrincipal": "#111827",
  "textoSecundario": "#6B7280",
  "borde": "#E5E7EB"
}
```

### API Endpoints

**Base**: `/api/admin/branding` (requiere autenticación + tenant context)

#### GET `/api/admin/branding`
Obtener configuración actual del tenant.

**Response**:
```json
{
  "nombre": "Sportivo Pilar",
  "logoUrl": "https://example.com/logo.png",
  "faviconUrl": "https://example.com/favicon.ico",
  "colores": { "primario": "#DC2626", ... }
}
```

#### PUT `/api/admin/branding/colores`
Actualizar paleta de colores.

**Request**:
```json
{
  "colores": {
    "primario": "#FF0000",
    "primarioOscuro": "#CC0000",
    "primarioClaro": "#FF6666"
  }
}
```

**Validación**:
- Formato hexadecimal válido: `#[0-9A-F]{6}`
- Case-insensitive: `#aabbcc` = `#AABBCC`
- Todos los colores deben incluirse o el request falla

**Response**:
```json
{
  "success": true,
  "colores": { ... }
}
```

#### PUT `/api/admin/branding/logo`
Actualizar URL del logo.

**Request**:
```json
{
  "logoUrl": "https://example.com/new-logo.png"
}
```

**Validación**:
- URL válida (verifica con `new URL()`)
- Debe ser string no-vacío

**Response**:
```json
{
  "success": true,
  "logoUrl": "https://example.com/new-logo.png"
}
```

#### PUT `/api/admin/branding/favicon`
Actualizar URL del favicon.

**Request**:
```json
{
  "faviconUrl": "https://example.com/favicon.ico"
}
```

**Validación**: Idéntica a logo

#### DELETE `/api/admin/branding/logo`
Eliminar logo (volver a por defecto).

**Response**:
```json
{ "success": true }
```

#### GET `/api/admin/branding/default-colors`
Obtener paleta de colores por defecto (sin autenticación).

**Response**:
```json
{
  "primario": "#DC2626",
  "primarioOscuro": "#991B1B",
  ...
}
```

### Validaciones

1. **Colores hexadecimales**: Regex `/^#[0-9A-F]{6}$/i`
2. **URLs**: Constructor `URL()` de JavaScript
3. **Tenant context**: Middleware `extractTenant` valida tenantId
4. **Multi-tenant**: Uso de `req.db` para scoping automático

### Ejemplo de uso desde backend

```javascript
// Obtener branding actual
const tenant = await req.db.tenant.findUnique({
  where: { id: tenantId },
  select: { colores: true, logoUrl: true }
})

// Actualizar colores
await req.db.tenant.update({
  where: { id: tenantId },
  data: {
    colores: {
      primario: '#FF0000',
      primarioOscuro: '#CC0000'
    }
  }
})
```

## Frontend

### Componentes

#### TenantContext (`client/src/contexts/TenantContext.jsx`)
Contexto global que:
- Carga tenant actual desde `GET /api/tenant/current`
- Aplica colores como CSS variables en `<root>`
- Actualiza favicon dinámicamente
- Actualiza título de página

**Hook**:
```javascript
const { tenant, loading, applyTheme } = useTenant()
```

#### TenantStyles (`client/src/components/TenantStyles.jsx`)
Componente que inyecta CSS variables:
```css
:root {
  --color-primary: #DC2626;
  --color-primary-dark: #991B1B;
  --color-secondary: #7C3AED;
  /* ... 16 variables totales */
}
```

#### TenantLogo (`client/src/components/TenantLogo.jsx`)
Muestra logo dinámico con fallbacks:

```javascript
<TenantLogo
  className="h-10"
  showName={false}
  alt="Logo"
/>
```

Fallback chain:
1. Logo URL del tenant
2. Nombre del tenant (si `showName={true}`)
3. Logo por defecto (`/images/logo.png`)

#### Branding Page (`client/src/pages/admin/Branding.jsx`)

Panel de administración completo en `/admin/configuracion/branding`:

**Secciones**:
1. **Logo del Club**: Editor de URL con preview
2. **Favicon**: Editor de URL
3. **Paleta de Colores**: 16 colores en 5 grupos
   - Primarios (3)
   - Secundarios (3)
   - Estados (4)
   - Fondos y Texto (4)
   - Otros (2)

**Características**:
- Color picker visual
- Input hexadecimal
- Vista previa de colores
- Botón "Guardar" (deshabilitado si no hay cambios)
- Botón "Restaurar a por defecto"
- Indicador de cambios sin guardar
- Toast notifications

### CSS Variables Disponibles

En tailwind.config.js o CSS:

```css
/* Primarios */
--color-primary          /* #DC2626 */
--color-primary-dark     /* #991B1B */
--color-primary-light    /* #FCA5A5 */

/* Secundarios */
--color-secondary        /* #7C3AED */
--color-secondary-dark   /* #5B21B6 */
--color-secondary-light  /* #C4B5FD */

/* Acentos */
--color-accent           /* #22D3EE */

/* Estados */
--color-success          /* #10B981 */
--color-warning          /* #F59E0B */
--color-error            /* #EF4444 */
--color-info             /* #3B82F6 */

/* Fondos */
--color-bg-primary       /* #FFFFFF */
--color-bg-secondary     /* #F9FAFB */

/* Texto */
--color-text-primary     /* #111827 */
--color-text-secondary   /* #6B7280 */

/* Bordes */
--color-border           /* #E5E7EB */
```

### Uso en Componentes

```javascript
import { useTenant } from '../contexts/TenantContext'

export default function MiComponente() {
  const { tenant } = useTenant()

  return (
    <div style={{
      borderColor: `var(--color-primary)`,
      backgroundColor: `var(--color-bg-secondary)`
    }}>
      {tenant?.nombre}
    </div>
  )
}
```

O en Tailwind (si están configurados como custom colors):

```jsx
<div className="border-primary bg-secondary-light text-text-primary">
  Contenido personalizado
</div>
```

## Integración Multi-Tenant

### Flujo de Carga

```
1. App monta → TenantProvider inicia
2. TenantContext carga GET /api/tenant/current
3. extractTenant middleware extrae tenantId del subdomain
4. req.db configurado con tenant scoping automático
5. Datos devueltos corresponden solo a ese tenant
6. Frontend aplica colores como CSS variables
```

### Ejemplo: Subdomain → Branding

```
Client: admin.sportivo-pilar.clubix.com
↓
extractTenant: tenantId = "sportivo-pilar"
↓
GET /api/admin/branding → req.db.tenant.findUnique({ id: tenantId })
↓
Response: { colores: {...}, logoUrl: "...", ... }
↓
TenantContext aplica colores → CSS :root
↓
UI renderiza con colores personalizados
```

## Scripts Útiles

### Agregar Menu Item
```bash
DATABASE_URL="..." node server/scripts/addBrandingMenuItem.js
```

Inserta `Personalización Visual` en el menú de Configuración.

### Testear APIs
```bash
DATABASE_URL="..." node server/scripts/testBrandingAPI.js
```

Valida:
- 16 colores por defecto
- Validación hexadecimal
- Validación de URLs
- Integración con BD
- Menu item

## Testing

### Tests de Frontend

```javascript
// test/Branding.test.jsx
test('Cargar branding actual', async () => {
  render(<Branding />)
  await waitFor(() => {
    expect(screen.getByDisplayValue('#DC2626')).toBeInTheDocument()
  })
})

test('Guardar colores actualiza BD', async () => {
  const { container } = render(<Branding />)
  const input = screen.getByDisplayValue('#DC2626')

  fireEvent.change(input, { target: { value: '#FF0000' } })
  fireEvent.click(screen.getByText('Guardar Colores'))

  await waitFor(() => {
    expect(api.put).toHaveBeenCalledWith(
      '/api/admin/branding/colores',
      { colores: expect.objectContaining({ primario: '#FF0000' }) }
    )
  })
})
```

### Tests de Backend

```javascript
// test/branding.test.js
describe('Branding API', () => {
  test('GET /api/admin/branding retorna config del tenant', async () => {
    const res = await req.get('/api/admin/branding')
    expect(res.body).toHaveProperty('colores')
    expect(res.body).toHaveProperty('logoUrl')
  })

  test('PUT /api/admin/branding/colores valida hex', async () => {
    const res = await req.put('/api/admin/branding/colores')
      .send({ colores: { primario: 'invalid' } })
    expect(res.status).toBe(400)
  })
})
```

## Migración de Datos Existentes

Si el tenant no tiene colores guardados:
1. Frontend detecta `colores: null`
2. Renderiza colores por defecto
3. Usuario puede guardar para persistir

```javascript
// En Branding.jsx
const coloresToDisplay = colores[key] || defaultColors[key] || '#000000'
```

## Próximos Pasos

- [ ] Theme dark mode (colores alternativos en dark)
- [ ] Preview en tiempo real
- [ ] Exportar/importar temas
- [ ] Temas predefinidos (plantillas)
- [ ] Analytics de cambios
- [ ] Revertir a versión anterior

## Troubleshooting

| Problema | Solución |
|----------|----------|
| Colores no aplican | Verificar TenantStyles en App.jsx |
| Logo no carga | Validar URL (HTTPS recomendado) |
| Menu item falta | Ejecutar `addBrandingMenuItem.js` |
| Cambios no persisten | Revisar permisos de BD |
| Favicon no actualiza | Hard refresh (Ctrl+Shift+R) |

## Referencias

- [Prisma multi-tenant](../docs/MULTITENANT_DEFINITIVO.md)
- [CSS Variables (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/--*)
- [TailwindCSS custom colors](https://tailwindcss.com/docs/customizing-colors)
