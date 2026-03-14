# 🏗️ ARQUITECTURA MULTI-TENANT - CLUBIX

## 📋 RESUMEN EJECUTIVO

Sistema multi-tenant con aislamiento por `tenant_id` en base de datos compartida.

### Decisiones Clave
- ✅ Identificación por subdomain (`sportivo-pilar.clubix.com`)
- ✅ Usuarios compartidos entre tenants con roles por tenant
- ✅ Login fijado por subdomain (contexto automático)
- ✅ Templates email: globales + override por tenant
- ✅ Sitio público integrado simple por tenant
- ✅ Onboarding: auto-registro con aprobación manual
- ✅ Subdomain editable después de creación

---

## 🗄️ MODELO DE BASE DE DATOS

### Nuevas Tablas

#### **1. tenants** (Clubes)
```sql
CREATE TABLE tenants (
  id SERIAL PRIMARY KEY,

  -- Identificación
  nombre VARCHAR(255) NOT NULL,
  subdomain VARCHAR(100) UNIQUE NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,

  -- Branding
  logo_url TEXT,
  favicon_url TEXT,
  colores JSONB NOT NULL DEFAULT '{}',

  -- Contacto
  email VARCHAR(255),
  telefono VARCHAR(50),
  direccion TEXT,
  ciudad VARCHAR(100),
  provincia VARCHAR(100),
  codigo_postal VARCHAR(20),

  -- Sitio público
  descripcion TEXT,
  slogan TEXT,
  horarios TEXT,
  redes_sociales JSONB DEFAULT '{}',

  -- Límites y plan
  plan VARCHAR(50) DEFAULT 'TRIAL',
  max_socios INTEGER DEFAULT NULL,
  max_storage_mb INTEGER DEFAULT NULL,
  max_admins INTEGER DEFAULT NULL,

  -- Estado
  estado VARCHAR(50) DEFAULT 'PENDING_APPROVAL',
  -- PENDING_APPROVAL, ACTIVE, SUSPENDED, CANCELLED

  activo BOOLEAN DEFAULT false,
  fecha_aprobacion TIMESTAMP,
  fecha_suspension TIMESTAMP,
  motivo_suspension TEXT,

  -- Facturación (para futuro)
  razon_social VARCHAR(255),
  cuit VARCHAR(20),
  condicion_iva VARCHAR(50),

  -- Auditoría
  creado_por INTEGER REFERENCES admins(id),
  aprobado_por INTEGER REFERENCES admins(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT subdomain_lowercase CHECK (subdomain = LOWER(subdomain)),
  CONSTRAINT subdomain_format CHECK (subdomain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$')
);

CREATE INDEX idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX idx_tenants_estado ON tenants(estado);
CREATE INDEX idx_tenants_activo ON tenants(activo);
```

#### **2. tenant_usuarios** (Relación usuarios ↔ tenants)
```sql
CREATE TABLE tenant_usuarios (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,

  -- Rol en este tenant específico
  rol VARCHAR(50) NOT NULL DEFAULT 'ADMIN',
  -- SUPER_ADMIN (global), ADMIN, CONTADOR, OPERADOR, READONLY

  permisos JSONB DEFAULT '[]',

  activo BOOLEAN DEFAULT true,
  fecha_ingreso TIMESTAMP DEFAULT NOW(),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(tenant_id, admin_id)
);

CREATE INDEX idx_tenant_usuarios_tenant ON tenant_usuarios(tenant_id);
CREATE INDEX idx_tenant_usuarios_admin ON tenant_usuarios(admin_id);
```

#### **3. tenant_configuracion** (Config específica por tenant)
```sql
CREATE TABLE tenant_configuracion (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  clave VARCHAR(100) NOT NULL,
  valor TEXT,
  tipo VARCHAR(50) DEFAULT 'TEXT', -- TEXT, NUMBER, BOOLEAN, JSON
  descripcion TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(tenant_id, clave)
);

CREATE INDEX idx_tenant_config_tenant ON tenant_configuracion(tenant_id);
```

#### **4. email_templates** (Actualización)
```sql
-- Ya existe, solo agregamos campos
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS es_global BOOLEAN DEFAULT false;

-- Un template es global O de un tenant, no ambos
ALTER TABLE email_templates ADD CONSTRAINT check_template_scope
  CHECK ((tenant_id IS NULL AND es_global = true) OR (tenant_id IS NOT NULL AND es_global = false));

CREATE INDEX idx_email_templates_tenant ON email_templates(tenant_id);
```

### Tablas Existentes - Agregar tenant_id

**Todas estas tablas necesitan tenant_id:**

```sql
-- Socios y familia
ALTER TABLE socios ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE grupos_familiares ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);

-- Finanzas
ALTER TABLE cargos ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE pagos ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE cajas ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE movimientos_caja ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE cuentas_contables ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE asientos ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE movimientos_contables ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE centros_costo ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE conciliaciones_bancarias ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);

-- Deportes
ALTER TABLE actividades ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE inscripciones ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE equipos ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE partidos ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);

-- Buffet
ALTER TABLE productos_buffet ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE mesas ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE comandas ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE items_comanda ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE zonas_buffet ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);

-- Accesos
ALTER TABLE accesos ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE puntos_acceso ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);

-- Config
ALTER TABLE configuracion ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE menu_items ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE medios_pago ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);

-- Cobranzas (nuevos módulos)
ALTER TABLE gestiones_cobranza ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE acciones_cobranza ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE encuestas_baja ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE campanas_recupero ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE acciones_recupero ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE campanas_comunicacion ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE envios_campana ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);

-- Sitio institucional
ALTER TABLE paginas_sitio ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE noticias ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
```

**Índices compuestos para performance:**
```sql
-- Pattern: (tenant_id, id) para queries comunes
CREATE INDEX idx_{tabla}_tenant_id ON {tabla}(tenant_id, id);

-- Ejemplos:
CREATE INDEX idx_socios_tenant_id ON socios(tenant_id, id);
CREATE INDEX idx_cargos_tenant_id ON cargos(tenant_id, id);
CREATE INDEX idx_actividades_tenant_id ON actividades(tenant_id, id);
```

---

## 🔐 SEGURIDAD Y AISLAMIENTO

### Prisma Middleware (Automático)

```javascript
// server/src/middleware/tenantMiddleware.js

export function createTenantMiddleware() {
  return async (params, next) => {
    const tenantId = params.args.__tenantId;

    if (!tenantId) {
      throw new Error('tenant_id is required');
    }

    // Inyectar tenant_id en todas las queries
    if (params.action === 'create' || params.action === 'createMany') {
      if (params.args.data) {
        if (Array.isArray(params.args.data)) {
          params.args.data = params.args.data.map(item => ({
            ...item,
            tenant_id: tenantId
          }));
        } else {
          params.args.data.tenant_id = tenantId;
        }
      }
    }

    // Filtrar por tenant_id en todas las queries
    if (params.action === 'findMany' || params.action === 'findFirst' ||
        params.action === 'findUnique' || params.action === 'update' ||
        params.action === 'delete' || params.action === 'deleteMany' ||
        params.action === 'updateMany') {

      params.args.where = {
        ...params.args.where,
        tenant_id: tenantId
      };
    }

    return next(params);
  };
}
```

### Express Middleware

```javascript
// server/src/middleware/extractTenant.js

export async function extractTenant(req, res, next) {
  try {
    // Extraer subdomain del host
    const host = req.get('host');
    const subdomain = extractSubdomain(host);

    if (!subdomain) {
      return res.status(400).json({
        error: 'No se pudo identificar el tenant'
      });
    }

    // Buscar tenant
    const tenant = await prisma.tenant.findUnique({
      where: { subdomain, activo: true }
    });

    if (!tenant) {
      return res.status(404).json({
        error: 'Club no encontrado o inactivo'
      });
    }

    // Guardar en request
    req.tenant = tenant;
    req.tenantId = tenant.id;

    next();
  } catch (error) {
    next(error);
  }
}

function extractSubdomain(host) {
  // localhost:3000 → null (desarrollo sin subdomain)
  // sportivo.localhost:3000 → sportivo
  // sportivo-pilar.clubix.com → sportivo-pilar
  // clubix.com → null (sin subdomain)

  const parts = host.split(':')[0].split('.');

  if (parts.length === 1) return null; // localhost
  if (parts.length === 2) return null; // clubix.com
  if (parts[0] === 'www') return null; // www.clubix.com

  return parts[0]; // primer segmento
}
```

---

## 🔄 FLUJOS DE USUARIO

### 1. Onboarding de Nuevo Club

```
┌─────────────────────────────────────────────────────┐
│  1. Usuario va a clubix.com/registro                │
├─────────────────────────────────────────────────────┤
│  2. Formulario de registro:                         │
│     - Nombre del club                               │
│     - Subdomain deseado (verifica disponibilidad)   │
│     - Email admin                                   │
│     - Nombre admin                                  │
│     - Contraseña                                    │
│     - Datos del club (dirección, teléfono, etc)     │
├─────────────────────────────────────────────────────┤
│  3. Sistema crea:                                   │
│     a) Tenant con estado PENDING_APPROVAL           │
│     b) Usuario admin                                │
│     c) Relación tenant_usuarios                     │
├─────────────────────────────────────────────────────┤
│  4. Email a super-admin:                            │
│     "Nuevo club pendiente de aprobación"            │
├─────────────────────────────────────────────────────┤
│  5. Email a usuario registrado:                     │
│     "Registro recibido, pendiente de aprobación"    │
├─────────────────────────────────────────────────────┤
│  6. Super-admin revisa y aprueba/rechaza            │
├─────────────────────────────────────────────────────┤
│  7. Si APRUEBA:                                     │
│     - tenant.estado = ACTIVE                        │
│     - tenant.activo = true                          │
│     - Email: "Club aprobado, ya podés acceder"      │
│     - Link: https://{subdomain}.clubix.com          │
├─────────────────────────────────────────────────────┤
│  8. Si RECHAZA:                                     │
│     - Email explicando motivo                       │
│     - Tenant queda en REJECTED                      │
└─────────────────────────────────────────────────────┘
```

### 2. Login de Usuario Multi-Tenant

```
┌─────────────────────────────────────────────────────┐
│  Usuario: juan@gmail.com                            │
│  Clubes: Sportivo Pilar, Club Atlético             │
└─────────────────────────────────────────────────────┘

CASO A: Login correcto
┌─────────────────────────────────────────────────────┐
│  1. Va a sportivo-pilar.clubix.com/login            │
│  2. Ingresa: juan@gmail.com / pass123               │
│  3. Sistema:                                        │
│     a) Autentica usuario                            │
│     b) Verifica tenant_usuarios:                    │
│        - tenant_id=1 (Sportivo)                     │
│        - admin_id=5 (Juan)                          │
│        - activo=true                                │
│  4. ✅ Genera JWT con:                              │
│     { userId: 5, tenantId: 1, rol: 'ADMIN' }        │
│  5. Redirige a /admin                               │
└─────────────────────────────────────────────────────┘

CASO B: Login en tenant sin acceso
┌─────────────────────────────────────────────────────┐
│  1. Va a club-union.clubix.com/login                │
│  2. Ingresa: juan@gmail.com / pass123               │
│  3. Sistema:                                        │
│     a) Autentica usuario ✅                         │
│     b) Busca en tenant_usuarios:                    │
│        - tenant_id=3 (Club Unión)                   │
│        - admin_id=5 (Juan)                          │
│        - NO EXISTE                                  │
│  4. ❌ Error: "No tenés acceso a este club"         │
│  5. Opción: "Volver a tus clubes"                   │
└─────────────────────────────────────────────────────┘

CASO C: Cambiar de club
┌─────────────────────────────────────────────────────┐
│  1. Juan está en Sportivo Pilar                     │
│  2. Quiere ir a Club Atlético                       │
│  3. Opción A: Menú → "Cambiar club"                 │
│     - Lista clubes disponibles                      │
│     - Click → Redirige a otro subdomain             │
│  4. Opción B: Navega manualmente a                  │
│     club-atletico.clubix.com                        │
│  5. Login automático si tiene sesión activa         │
└─────────────────────────────────────────────────────┘
```

### 3. Super-Admin Global

```
┌─────────────────────────────────────────────────────┐
│  Super-Admin tiene rol especial                     │
├─────────────────────────────────────────────────────┤
│  Login: admin.clubix.com/login                      │
│  (o subdomain especial: super.clubix.com)           │
├─────────────────────────────────────────────────────┤
│  Panel Super-Admin:                                 │
│  - Ver todos los tenants                            │
│  - Aprobar/rechazar registros                       │
│  - Suspender/activar clubes                         │
│  - Ver estadísticas globales                        │
│  - Acceder a cualquier tenant (modo debug)          │
└─────────────────────────────────────────────────────┘
```

---

## 🎨 BRANDING POR TENANT

### Estructura de Colores (JSONB)

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

### Aplicación en Frontend

```javascript
// client/src/hooks/useTenantTheme.js

export function useTenantTheme() {
  const { tenant } = useTenant();

  useEffect(() => {
    if (tenant?.colores) {
      applyTheme(tenant.colores);
    }
  }, [tenant]);

  function applyTheme(colores) {
    const root = document.documentElement;

    root.style.setProperty('--color-primary', colores.primario);
    root.style.setProperty('--color-primary-dark', colores.primarioOscuro);
    root.style.setProperty('--color-secondary', colores.secundario);
    // ... etc
  }
}
```

---

## 📄 TEMPLATES DE EMAIL

### Resolución de Templates

```javascript
async function getEmailTemplate(nombre, tenantId) {
  // 1. Buscar template específico del tenant
  let template = await prisma.emailTemplate.findFirst({
    where: {
      nombre,
      tenant_id: tenantId,
      activo: true
    }
  });

  // 2. Si no existe, usar template global
  if (!template) {
    template = await prisma.emailTemplate.findFirst({
      where: {
        nombre,
        es_global: true,
        activo: true
      }
    });
  }

  return template;
}
```

---

Continúo en el siguiente mensaje con el plan de implementación día por día...
