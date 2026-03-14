# 🔐 Super-Admin Panel - Guía Completa

Sistema de gestión centralizado para administradores del platform Clubix que permite gestionar múltiples tenants (clubs) y aprobar registros públicos.

## Acceso

**URL**: `/super-admin`

**Requisitos**:
- Token de super-admin en localStorage
- Usuario con rol super-admin

**Login**: `/admin/login` (mismo para admin regular que para super-admin)

## Componentes

### SuperAdminLayout
Componente layout similar a AdminLayout pero optimizado para super-admin.

**Features**:
- Sidebar con navegación principal
- Top bar con fecha actual
- Menú colapsable en móvil
- Logout seguro
- Indicador de usuario conectado

**Rutas internas**:
- Dashboard (/)
- Gestión de Tenants (/tenants)
- Configuración (/configuracion)

## Páginas

### 1. Dashboard (`/super-admin`)

**Stats Cards**:
- Total Tenants
- Tenants Activos
- Total Admins (en el sistema)
- Total Socios (en todos los tenants)

Cada card es clickeable y redirige a vistas filtradas.

**Aprobaciones Pendientes**:
Lista de tenants que aún no fueron aprobados. Muestra:
- Nombre del club
- Email de contacto
- Botón "Revisar" → abre detalle del tenant

**Quick Actions**:
- Ver todos los tenants
- Crear nuevo tenant (acceso rápido)

### 2. Gestión de Tenants (`/super-admin/tenants`)

**Interfaz**:
- Tabla con datos de todos los tenants
- Filtros por estado
- Búsqueda en tiempo real
- Estadísticas en tarjetas

**Columnas de la tabla**:
| Columna | Descripción |
|---------|-------------|
| Nombre | Nombre del club + descripción resumida |
| Subdomain | Identificador único (clickeable para copiar) |
| Email | Email del club |
| Plan | TRIAL, BASIC, PRO, ENTERPRISE |
| Estado | Badge con color según estado |
| Creado | Fecha de creación |
| Acciones | Botones contextuales |

**Filtros**:
- Todos
- Pendientes (PENDING_APPROVAL)
- Activos (ACTIVE)
- Suspendidos (SUSPENDED)

**Búsqueda**:
Busca en:
- Nombre del club
- Subdomain
- Email de contacto

**Acciones contextuales**:

| Estado | Acciones disponibles |
|--------|-------------------|
| PENDING_APPROVAL | Ver, Aprobar ✅, Rechazar ❌ |
| ACTIVE | Ver, Suspender ⚠️, Eliminar 🗑️ |
| SUSPENDED | Ver, Eliminar 🗑️ |
| CANCELLED | Ver |

Notas:
- El tenant "sportivo-pilar" no puede ser eliminado
- Suspender requiere un motivo
- Rechazar requiere una razón

### 3. Detalle del Tenant (`/super-admin/tenants/:id`)

**Secciones**:

#### Información General
- Nombre y subdomain (URL de acceso)
- Estado con indicador de color
- Email y teléfono
- Descripción
- Plan y límites (max socios, max admins)
- Moneda y timezone

#### Ubicación
- Dirección
- Ciudad y provincia
- Código postal

#### Auditoría
- Fecha de creación
- Fecha de última actualización
- Fecha de aprobación (si aplica)
- Fecha de suspensión (si aplica)

#### 3 Tabs adicionales:
1. **Información**: Datos completos del tenant
2. **Administradores**: Lista de admins asignados con roles y fechas de ingreso
3. **Configuración**: Pares clave-valor de configuración del tenant

**Botón "Editar"**:
Abre formulario para modificar datos del tenant.

### 4. Crear/Editar Tenant (`/super-admin/tenants/nuevo` y `/super-admin/tenants/:id/editar`)

**Flujo**:
1. Ingresa datos básicos (nombre, subdomain, email)
2. Configura ubicación
3. Define plan y límites
4. Guarda

**Secciones del Formulario**:

#### Información Básica
- **Nombre del Club*** (requerido)
- **Subdomain*** (requerido, única, solo lowercase + números + guiones)
- **Email*** (requerido, formato válido)
- **Teléfono** (opcional)
- **Slogan** (opcional)
- **Descripción** (opcional, text area)

#### Ubicación
- **Dirección** (requerido)
- **Ciudad** (requerido)
- **Provincia** (requerido, dropdown)
- **Código Postal** (opcional)

#### Datos Fiscales (opcionales)
- Razón Social
- CUIT

#### Plan y Límites
- **Plan**: TRIAL, BASIC, PRO, ENTERPRISE
- **Máx Socios**: Número o ilimitado
- **Máx Admins**: Número o ilimitado

#### Configuración Técnica
- **Timezone**: Selector por región Argentina (default: Buenos Aires)
- **Moneda**: ARS o USD (default: ARS)

**Validaciones**:
- Subdomain: solo letras minúsculas, números y guiones
- Subdomain único (no puede existir otro con el mismo)
- Campos requeridos no pueden estar vacíos
- Email válido
- URL válida (si aplica)

**Estados iniciales**:
- Nuevo tenant: `PENDING_APPROVAL`
- Activo: `ACTIVE`
- Suspendido: `SUSPENDED`
- Cancelado: `CANCELLED`

## Registro Público de Clubs (`/registro-club`)

Página accesible por el público para registrar un nuevo club en el sistema.

### Flujo Multi-paso

#### Paso 1: Información del Club
- Nombre del club
- Subdomain (con validación en tiempo real)
- Email del club
- Teléfono (opcional)
- Descripción
- Slogan

#### Paso 2: Ubicación
- Dirección
- Ciudad
- Provincia (dropdown)
- Código Postal
- Datos fiscales opcionales (Razón Social, CUIT)

#### Paso 3: Administrador Principal
- Nombre del administrador
- Email
- Contraseña (mín 6 caracteres)
- Confirmación de contraseña

#### Paso 4: Confirmación
- Mensaje de éxito
- Email de confirmación será enviado
- Link para volver al inicio

### Validaciones

**Paso 1**:
- Nombre requerido
- Subdomain requerido, único, sin caracteres especiales
- Email válido
- Subdomain no puede estar en uso

**Paso 2**:
- Dirección requerida
- Ciudad requerida
- Provincia requerida

**Paso 3**:
- Nombre administrador requerido
- Email válido
- Contraseña mín 6 caracteres
- Contraseñas deben coincidir

### Backend: POST `/api/super-admin/tenants/register`

**Request**:
```json
{
  "nombre": "Club Name",
  "subdomain": "club-name",
  "email": "club@example.com",
  "telefono": "1234567890",
  "direccion": "Calle 123",
  "ciudad": "Pilar",
  "provincia": "Buenos Aires",
  "codigoPostal": "1629",
  "descripcion": "Club description",
  "slogan": "Club slogan",
  "razonSocial": "Club S.A.",
  "cuit": "30-12345678-1",
  "adminData": {
    "nombre": "Admin Name",
    "email": "admin@club.com",
    "password": "securepass",
    "nombreUsuario": "admin"
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Registro enviado. Pendiente de aprobación.",
  "tenant": { /* tenant object */ }
}
```

**Estado inicial**: `PENDING_APPROVAL`

## API Endpoints

### Tenants

```
GET    /api/super-admin/tenants                  # Listar (con filtros)
GET    /api/super-admin/tenants/:id              # Obtener detalle
POST   /api/super-admin/tenants                  # Crear
PUT    /api/super-admin/tenants/:id              # Actualizar
POST   /api/super-admin/tenants/register         # Registro público
DELETE /api/super-admin/tenants/:id              # Eliminar

POST   /api/super-admin/tenants/:id/approve      # Aprobar
POST   /api/super-admin/tenants/:id/reject       # Rechazar
POST   /api/super-admin/tenants/:id/suspend      # Suspender

GET    /api/super-admin/stats                    # Estadísticas
```

### Parámetros de Query

**GET /api/super-admin/tenants**:
- `estado`: PENDING_APPROVAL, ACTIVE, SUSPENDED, CANCELLED
- `activo`: true/false

**Response**:
```json
[
  {
    "id": 1,
    "nombre": "Sportivo Pilar",
    "subdomain": "sportivo-pilar",
    "email": "contacto@sportivo.com",
    "estado": "ACTIVE",
    "plan": "PRO",
    "createdAt": "2026-03-14T10:30:00Z",
    "tenantUsuarios": [
      {
        "id": 1,
        "adminId": 1,
        "rol": "ADMIN",
        "admin": { /* admin object */ }
      }
    ],
    "configuraciones": [ /* config array */ ]
  }
]
```

### GET /api/super-admin/stats

**Response**:
```json
{
  "tenants": 5,
  "activeTenants": 4,
  "admins": 12,
  "socios": 2450
}
```

## Flujos de Trabajo

### Aprobar un Registro Nuevo

1. Super-admin accede a `/super-admin`
2. Ve tabla "Aprobaciones Pendientes"
3. Click en "Revisar" → abre `/super-admin/tenants/:id`
4. Revisa datos del club y administrador
5. Click en botón "Aprobar" (verde)
6. Tenant pasa a estado `ACTIVE`
7. Administrador recibe email de confirmación
8. Club puede acceder a su dashboard

### Suspender un Club

1. Super-admin accede a `/super-admin/tenants`
2. Busca el club
3. Click en icono de alerta (⚠️)
4. Ingresa motivo de suspensión
5. Tenant pasa a estado `SUSPENDED`
6. Acceso al club es bloqueado

### Crear Tenant Manualmente

1. Super-admin accede a `/super-admin/tenants`
2. Click "Nuevo Tenant"
3. Completa formulario de 4 secciones
4. Click "Guardar"
5. Tenant se crea en estado `PENDING_APPROVAL` (o `ACTIVE` según necesidad)

## Seguridad

### Autenticación
- Token JWT en localStorage
- Revalidación en cada request
- Logout limpia localStorage

### Autorización
- Solo super-admins pueden acceder a `/super-admin`
- Validación en frontend y backend
- Middleware `requireSuperAdmin` en Express

### Validaciones
- Subdomain único
- Email válido
- Contraseñas mínimo 6 caracteres (TODO: más seguridad)
- SQL Injection: Prisma parameterizado
- XSS: React escapa automáticamente

### TODO (Security)
- [ ] Hash de contraseñas con bcrypt
- [ ] Validación de CUIT/Razón Social
- [ ] Rate limiting en endpoint de registro
- [ ] Email verification
- [ ] 2FA para super-admin
- [ ] Audit log de cambios

## Características Futuras

### Fase 2
- [ ] Importación de datos iniciales
- [ ] Templates de configuración por plan
- [ ] Limite de límites según plan (auditoría)
- [ ] Webhook de aprobación
- [ ] Email templates personalizables

### Fase 3
- [ ] Dashboard de uso (socios, admins, storage)
- [ ] Facturación de tenants
- [ ] Reportes de actividad
- [ ] Migración de tenants
- [ ] Backup automático

## Troubleshooting

| Problema | Solución |
|----------|----------|
| No veo opciones de super-admin | Verificar que el usuario tenga rol super-admin |
| Subdomain "ya existe" | El subdomain está en uso, cambiar a otro |
| Email de registro no llega | TODO: implementar envío de emails |
| No puedo aprobar un tenant | Verificar estado - solo PENDING_APPROVAL se puede aprobar |
| Build falla | npm run build --prefix client |

## Referencias

- [Multi-Tenant Architecture](./MULTITENANT_DEFINITIVO.md)
- [Branding System](./BRANDING.md)
- [API Routes](../server/src/routes/super-admin/)
