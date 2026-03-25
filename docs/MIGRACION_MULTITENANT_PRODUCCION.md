# Guía de Migración a Multi-Tenant — Producción

Este documento describe paso a paso cómo migrar una base de datos RojoPlus
single-tenant existente al modelo multi-tenant de Clubix.

---

## Resumen de la arquitectura

El sistema usa **shared-schema multi-tenancy**: una sola base de datos PostgreSQL
donde cada tabla de negocio tiene una columna `tenant_id`. El aislamiento se
logra en la capa de aplicación mediante un cliente Prisma que inyecta
automáticamente el filtro `WHERE tenant_id = X` en cada query.

```
Browser (sportivopilar.clubix.com)
  → Header X-Tenant-Slug: sportivopilar
  → Express middleware extractTenant()
  → prisma.$extends({ tenantId })   ← req.db
  → Queries filtradas automáticamente
```

---

## Paso 1 — Preparación

### 1.1 Backup obligatorio
```bash
pg_dump -U postgres -d rojoplus -Fc -f backup_pre_multitenant_$(date +%Y%m%d).dump
```

### 1.2 Verificar versión de Node y dependencias
```bash
node -v   # >= 18
cd server && npm install
```

---

## Paso 2 — Migración de la base de datos

Ejecutar el script SQL `server/migrate_tenant.sql` sobre la base de producción.
Este script es **idempotente** (se puede ejecutar más de una vez sin daño).

```bash
psql -U postgres -d rojoplus -f server/migrate_tenant.sql
```

### Qué hace el script:

**2.1 Crea las 3 tablas nuevas del sistema multi-tenant:**

```sql
-- Tabla principal de tenants (clubs)
CREATE TABLE IF NOT EXISTS tenants (
  id                  SERIAL PRIMARY KEY,
  nombre              VARCHAR NOT NULL,
  subdomain           VARCHAR NOT NULL UNIQUE,   -- ej: sportivopilar
  slug                VARCHAR NOT NULL UNIQUE,
  email               VARCHAR,
  telefono            VARCHAR,
  direccion           VARCHAR,
  ciudad              VARCHAR,
  provincia           VARCHAR,
  codigo_postal       VARCHAR,
  logo_url            VARCHAR,
  favicon_url         VARCHAR,
  hero_image_url      VARCHAR,                   -- imagen de fondo hero
  colores             JSONB NOT NULL DEFAULT '{}',
  descripcion         TEXT,
  slogan              VARCHAR,
  horarios            TEXT,
  redes_sociales      JSONB NOT NULL DEFAULT '{}',  -- {facebook, instagram, whatsapp}
  timezone            VARCHAR NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  moneda              VARCHAR NOT NULL DEFAULT 'ARS',
  plan                VARCHAR NOT NULL DEFAULT 'STANDARD',
  max_socios          INT,
  max_admins          INT,
  max_storage_mb      INT,
  estado              VARCHAR NOT NULL DEFAULT 'ACTIVE',
  activo              BOOLEAN NOT NULL DEFAULT true,
  fecha_aprobacion    TIMESTAMP,
  fecha_suspension    TIMESTAMP,
  motivo_suspension   TEXT,
  razon_social        VARCHAR,
  cuit                VARCHAR,
  condicion_iva       VARCHAR,
  creado_por          INT,
  aprobado_por        INT,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tabla de vinculación admin ↔ tenant
CREATE TABLE IF NOT EXISTS tenant_usuarios (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  admin_id    INT NOT NULL,
  rol         VARCHAR NOT NULL DEFAULT 'ADMIN',
  permisos    JSONB NOT NULL DEFAULT '[]',
  activo      BOOLEAN NOT NULL DEFAULT true,
  fecha_ingreso TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, admin_id)
);

-- Configuraciones clave-valor por tenant
CREATE TABLE IF NOT EXISTS tenant_configuracion (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  clave       VARCHAR NOT NULL,
  valor       TEXT NOT NULL,
  tipo        VARCHAR NOT NULL DEFAULT 'STRING',
  descripcion VARCHAR,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, clave)
);
```

**2.2 Inserta el tenant principal:**
```sql
INSERT INTO tenants (nombre, subdomain, slug, estado, activo, plan, fecha_aprobacion)
VALUES ('Club Sportivo Pilar', 'sportivopilar', 'sportivopilar', 'ACTIVE', true, 'STANDARD', NOW())
ON CONFLICT (slug) DO NOTHING;
```

**2.3 Agrega `tenant_id` a ~120 tablas de negocio** y las popula con el id del
tenant recién creado. El script hace esto dinámicamente verificando si la tabla
existe y si la columna ya está presente antes de actuar:

```sql
-- Por cada tabla en el listado:
ALTER TABLE <tabla> ADD COLUMN tenant_id INT;          -- si no existe
UPDATE <tabla> SET tenant_id = <id> WHERE tenant_id IS NULL;
ALTER TABLE <tabla> ALTER COLUMN tenant_id SET NOT NULL;
```

Las tablas incluidas son todas las de negocio:
`socios`, `pagos`, `cuotas`, `cargos`, `inscripciones`, `actividades`,
`comandas`, `productos_buffet`, `mesas`, `caja`, `movimientos_caja`,
`eventos`, `noticias`, `configuracion`, etc. (ver lista completa en el script).

---

## Paso 3 — Columna hero_image_url (agregado posterior al script base)

Si el campo `hero_image_url` no está en el script que tenés, agregar manualmente:

```sql
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS hero_image_url VARCHAR;
```

---

## Paso 4 — Actualizar el schema de Prisma y regenerar el cliente

```bash
cd server
npx prisma db pull     # opcional: verifica que el schema esté sincronizado
npx prisma generate    # regenera el cliente TypeScript/JS
```

Si el schema ya tiene los modelos multi-tenant (ver `prisma/schema.prisma` —
bloque `// ===== MULTI-TENANT CORE =====`), este paso solo regenera el cliente.

---

## Paso 5 — Vincular los admins existentes al tenant

Todos los admins preexistentes deben quedar vinculados en `tenant_usuarios`.

Ejecutar desde el directorio `server/`:

```bash
node -e "
import('./src/lib/prisma.js').then(async ({ default: prisma }) => {
  const tenant = await prisma.tenant.findUnique({
    where: { subdomain: 'sportivopilar' },
    select: { id: true }
  })
  const admins = await prisma.admin.findMany({ select: { id: true, email: true } })
  const existing = await prisma.tenantUsuario.findMany({
    where: { tenantId: tenant.id },
    select: { adminId: true }
  })
  const existingIds = new Set(existing.map(tu => tu.adminId))
  const toLink = admins.filter(a => !existingIds.has(a.id))
  console.log('A vincular:', toLink.map(a => a.email))
  if (toLink.length > 0) {
    await prisma.tenantUsuario.createMany({
      data: toLink.map(a => ({ tenantId: tenant.id, adminId: a.id, rol: 'ADMIN' }))
    })
    console.log('Vinculados:', toLink.length)
  }
  process.exit(0)
}).catch(e => { console.error(e.message); process.exit(1) })
"
```

---

## Paso 6 — Cargar datos del club en el tenant

Actualizar los datos reales del club en la tabla `tenants`.

Usando el Super-Admin Panel (`/admin/tenants` → Editar), o directamente por SQL:

```sql
UPDATE tenants SET
  nombre        = 'Club Sportivo Pilar',
  email         = 'info@sportivo-pilar.com.ar',
  telefono      = '+54 9 2322 123456',
  direccion     = 'Av. Principal 1234',
  ciudad        = 'Pilar',
  provincia     = 'Buenos Aires',
  descripcion   = 'Club fundado en ...',
  slogan        = 'El equipo de la ciudad',
  horarios      = 'Lun-Vie 8-22hs | Sáb-Dom 9-20hs',
  redes_sociales = '{"facebook":"url","instagram":"url","whatsapp":"5492322xxxxxx"}',
  logo_url      = '/uploads/tenants/tenant-1-logo.png',
  hero_image_url = '/uploads/tenants/tenant-1-hero.jpg'
WHERE subdomain = 'sportivopilar';
```

---

## Paso 7 — Configuración del servidor (variables de entorno)

Verificar `.env` en `server/`:

```env
PORT=3000
DATABASE_URL=postgresql://usuario:password@host:5432/rojoplus
DEFAULT_TENANT_SUBDOMAIN=sportivopilar   # fallback en desarrollo sin subdomain
NODE_ENV=production
```

---

## Paso 8 — Configuración DNS / Proxy (Producción)

El sistema detecta el tenant desde el subdominio del host. En producción:

```
sportivopilar.clubix.com  → servidor Node.js
clubix-sport.clubix.com   → mismo servidor Node.js
```

**Nginx (ejemplo):**
```nginx
server {
    server_name *.clubix.com;

    location /api {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        root /var/www/clubix/dist;
        try_files $uri /index.html;
    }
}
```

El middleware `extractSubdomain()` en `server/src/middleware/extractTenant.js`
parsea el host automáticamente:
- `sportivopilar.clubix.com` → subdomain `sportivopilar`
- `localhost:3000` → usa `DEFAULT_TENANT_SUBDOMAIN`
- `sportivopilar.localhost:3000` → subdomain `sportivopilar` (dev)

---

## Paso 9 — Crear el rol Super-Admin

El usuario que administra los tenants debe tener un rol con `esSuperAdmin = true`
en la tabla `roles`.

```sql
-- Verificar si existe
SELECT id, nombre, "esSuperAdmin" FROM roles WHERE "esSuperAdmin" = true;

-- Si no existe, crear
INSERT INTO roles (nombre, codigo, descripcion, "esSuperAdmin", activo)
VALUES ('Super Admin', 'SUPERADMIN', 'Administrador global del sistema', true, true);

-- Asignar al admin correspondiente (reemplazar el email)
UPDATE admins SET rol_id = (
  SELECT id FROM roles WHERE "esSuperAdmin" = true LIMIT 1
)
WHERE email = 'admin@rojoplus.com';
```

---

## Paso 10 — Verificación final

```bash
# 1. Arrancar el servidor
cd server && npm run dev

# 2. Verificar que el tenant se resuelve
curl http://localhost:3000/api/tenant/current \
  -H "X-Tenant-Slug: sportivopilar"

# 3. Verificar login
curl -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@rojoplus.com","password":"admin123"}'

# 4. Verificar lista de socios (con token del login anterior)
curl http://localhost:3000/api/admin/socios \
  -H "Authorization: Bearer <token>" \
  -H "X-Tenant-Slug: sportivopilar"
```

---

## Arquitectura del código (referencia)

### Flujo de una request autenticada

```
1. Request llega: POST /api/admin/socios
   Headers: Authorization: Bearer <jwt>, X-Tenant-Slug: sportivopilar

2. Middleware global: req.db = prisma (fallback)

3. Middleware /api/admin/*:
   - No está en TENANT_FREE_ROUTES
   - extractTenant() lee X-Tenant-Slug → busca en tenants WHERE subdomain='sportivopilar'
   - req.tenant = { id: 1, nombre: 'Club Sportivo Pilar', ... }
   - req.tenantId = 1
   - req.db = createTenantPrisma(1)   ← cliente con filtro automático

4. authAdmin() valida JWT → req.admin = { id, email, rolId, ... }

5. Handler: await req.db.socio.findMany({ where: { activo: true } })
   → Prisma ejecuta: SELECT * FROM socios WHERE activo=true AND tenant_id=1
```

### Rutas que bypasean extractTenant (TENANT_FREE_ROUTES)

```javascript
// server/src/index.js
const TENANT_FREE_ROUTES = [
  '/api/admin/login',       // Login no necesita tenant previo
  '/api/admin/mis-permisos', // Permiso usa req.admin.id (global)
  '/api/admin/menu'         // Menú se resuelve por rol (global)
]
```

### Modelos globales (no filtrados por tenant_id)

```javascript
// server/src/lib/tenantPrisma.js — GLOBAL_MODELS
const GLOBAL_MODELS = new Set([
  'tenant', 'tenantUsuario', 'tenantConfiguracion',
  'admin', 'rol', 'permiso', 'permisoRol',
  'cajaRol', 'menuItem', 'menuItemRol', 'rubro'
])
```

---

## Comandos de referencia rápida

```bash
# Ejecutar migración SQL
psql -U postgres -d rojoplus -f server/migrate_tenant.sql

# Regenerar cliente Prisma
cd server && npx prisma generate

# Vincular admins al tenant
cd server && node -e "..." # (ver Paso 5)

# Crear segundo tenant (via API Super-Admin)
curl -X POST http://localhost:3000/api/super-admin/tenants \
  -H "Authorization: Bearer <superadmin-token>" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Nuevo Club","subdomain":"nuevo-club","plan":"TRIAL"}'
```

---

## Resolución de problemas comunes

| Síntoma | Causa probable | Solución |
|---------|---------------|----------|
| `TENANT_NOT_FOUND` en todas las requests | subdomain no existe en `tenants` | Verificar que el subdomain coincida exactamente |
| Queries devuelven datos vacíos | `tenant_id` no populado en las tablas | Re-ejecutar el script SQL |
| Error `column tenant_id does not exist` | Prisma no regenerado | `npx prisma generate` |
| Login devuelve 404 HTML | `extractTenant` interceptando `/api/admin/login` | Verificar `TENANT_FREE_ROUTES` en `index.js` |
| Super-admin da 403 | Admin no tiene rol con `esSuperAdmin=true` | Ver Paso 9 |
| Usuarios muestran todos los tenants | Ruta `GET /admin/usuarios` usa `prisma` global | Verificar que use `req.db` o filtro `tenantUsuarios` |
