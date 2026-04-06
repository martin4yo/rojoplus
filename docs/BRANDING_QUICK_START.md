# 🎨 Branding Quick Start

## Lo que se implementó

Sistema completo de personalización visual para RojoPlus/Clubix que permite a cada club personalizar:
- **16 colores CSS** (primarios, secundarios, estados, fondos, texto)
- **Logo del club** (URL personalizada)
- **Favicon** (icono del navegador)
- Aplicación **automática** en toda la interfaz

## Para el Usuario Final

### Acceder
1. Ir a `/admin/configuracion/branding`
2. O desde el menú Admin → Configuración → Personalización Visual (cuando se ejecute el script de menu)

### Usar
1. **Logo**: Ingresa URL del logo PNG/SVG
2. **Favicon**: Ingresa URL del favicon.ico
3. **Colores**: Usa el color picker o escribe hex (#RRGGBB)
4. **Guardar**: Click en "Guardar" después de cambios
5. **Restaurar**: Vuelve a los colores por defecto

### Colores Disponibles
- Primarios (3): Principal, Oscuro, Claro
- Secundarios (3): Principal, Oscuro, Claro
- Estados (4): Éxito, Advertencia, Error, Info
- Fondos (2): Principal, Secundario
- Texto (2): Principal, Secundario
- Otros (2): Acento, Borde

## Para Developers

### Backend API

```bash
# Obtener configuración actual
GET /api/admin/branding

# Actualizar colores
PUT /api/admin/branding/colores
{ "colores": { "primario": "#FF0000", ... } }

# Actualizar logo
PUT /api/admin/branding/logo
{ "logoUrl": "https://example.com/logo.png" }

# Actualizar favicon
PUT /api/admin/branding/favicon
{ "faviconUrl": "https://example.com/favicon.ico" }

# Eliminar logo
DELETE /api/admin/branding/logo

# Obtener colores por defecto
GET /api/admin/branding/default-colors
```

### Frontend Components

```javascript
// Usar colores en componentes
import { useTenant } from '../contexts/TenantContext'

export default function MiComponente() {
  const { tenant } = useTenant()

  return (
    <div style={{ color: `var(--color-primary)` }}>
      Texto en color primario del club
    </div>
  )
}
```

### CSS Variables Disponibles

```css
/* En cualquier stylesheet */
color: var(--color-primary);
background: var(--color-bg-secondary);
border-color: var(--color-border);
```

## Instalación en BD

**Cuando la BD esté disponible**, ejecutar:

```bash
# 1. Agregar menu item
DATABASE_URL="postgresql://..." node server/scripts/addBrandingMenuItem.js

# 2. (Opcional) Validar APIs
DATABASE_URL="postgresql://..." node server/scripts/testBrandingAPI.js
```

## Archivos Clave

- `/client/src/pages/admin/Branding.jsx` - Panel de administración
- `/server/src/routes/admin/branding.js` - API endpoints
- `/client/src/contexts/TenantContext.jsx` - Contexto de tenant + colores
- `/client/src/components/TenantStyles.jsx` - Inyección de CSS variables
- `/docs/BRANDING.md` - Documentación completa

## Estado: 80% Completado

✅ **Hecho**:
- API completamente funcional
- UI del panel de administración
- Integración con TenantContext
- CSS variables dinámicas
- Validaciones (hex, URL)
- Documentación

⏳ **Pendiente**:
- Ejecutar script de menu item en BD
- Super-admin panel
- Página pública de registro

## Próxima Semana: Super-Admin Panel

Panel para gestionar tenants:
- Crear/editar/eliminar clubs
- Aprobar nuevos registros
- Ver estadísticas por tenant
- Importar datos iniciales
