# Multi-Tenant Definitivo - Clubix

**Fecha:** 14 de Marzo 2026
**Estado:** Aprobado para implementación
**Consolidado de:** PLAN_MULTITENANT.md, ARQUITECTURA_MULTITENANT.md, PLAN_IMPLEMENTACION_MULTITENANT.md

---

## Decisiones Arquitectónicas

| Decisión | Elección | Justificación |
|----------|----------|---------------|
| Estrategia DB | BD compartida + `tenantId` en cada tabla | Simple, económico, Prisma lo soporta nativamente. Suficiente para 10-100 tenants |
| Nombre del modelo | `Tenant` (tabla `tenants`) | Estándar de la industria. Evita confusión con `Entidad` existente |
| Relación usuarios | Tabla intermedia `TenantUsuario` | Permite que un admin gestione varios clubes |
| Dominio | `*.clubix.com` | Nombre de producto SaaS |
| Prisma scope | `prisma.$extends()` | API moderna, type-safe, no deprecada |
| Onboarding | Registro con aprobación manual | Más seguro en etapa temprana |
| Identificación | Por subdomain (`sportivo-pilar.clubix.com`) | Login fijado por contexto de subdomain |
| Colores | Estructura plana (15 variables CSS) | Simple de gestionar para admins no-técnicos |

---

## FASE 1: Modelo de Datos

### 1.1 Modelo `Tenant`

```prisma
model Tenant {
  id                    Int       @id @default(autoincrement())

  // Identificación
  nombre                String    // "Club Sportivo Pilar"
  subdomain             String    @unique // sportivo-pilar
  slug                  String    @unique // sportivo-pilar

  // Contacto
  email                 String?
  telefono              String?
  direccion             String?
  ciudad                String?
  provincia             String?
  codigoPostal          String?   @map("codigo_postal")

  // Branding
  logoUrl               String?   @map("logo_url")
  faviconUrl            String?   @map("favicon_url")
  colores               Json      @default("{}") // Paleta de colores (ver sección Branding)

  // Sitio público
  descripcion           String?   @db.Text
  slogan                String?
  horarios              String?   @db.Text
  redesSociales         Json      @default("{}") @map("redes_sociales")

  // Configuración técnica
  timezone              String    @default("America/Argentina/Buenos_Aires")
  moneda                String    @default("ARS")

  // Plan y límites
  plan                  String    @default("TRIAL") // TRIAL, BASICO, PROFESIONAL, ENTERPRISE
  maxSocios             Int?      @map("max_socios")
  maxAdmins             Int?      @map("max_admins")
  maxStorageMb          Int?      @map("max_storage_mb")

  // Estado
  estado                String    @default("PENDING_APPROVAL") // PENDING_APPROVAL, ACTIVE, SUSPENDED, CANCELLED
  activo                Boolean   @default(false)
  fechaAprobacion       DateTime? @map("fecha_aprobacion")
  fechaSuspension       DateTime? @map("fecha_suspension")
  motivoSuspension      String?   @map("motivo_suspension") @db.Text

  // Facturación del tenant
  razonSocial           String?   @map("razon_social")
  cuit                  String?
  condicionIva          String?   @map("condicion_iva")

  // Auditoría
  creadoPor             Int?      @map("creado_por")
  aprobadoPor           Int?      @map("aprobado_por")
  createdAt             DateTime  @default(now()) @map("created_at")
  updatedAt             DateTime  @updatedAt @map("updated_at")

  // Relaciones
  tenantUsuarios        TenantUsuario[]
  configuraciones       TenantConfiguracion[]

  @@index([subdomain])
  @@index([estado])
  @@index([activo])
  @@map("tenants")
}
```

### 1.2 Modelo `TenantUsuario` (Relación Admin ↔ Tenant)

```prisma
model TenantUsuario {
  id            Int      @id @default(autoincrement())
  tenantId      Int      @map("tenant_id")
  adminId       Int      @map("admin_id")

  // Rol en este tenant específico
  rol           String   @default("ADMIN") // SUPER_ADMIN, ADMIN, CONTADOR, OPERADOR, READONLY
  permisos      Json     @default("[]")    // Override de permisos específicos

  activo        Boolean  @default(true)
  fechaIngreso  DateTime @default(now()) @map("fecha_ingreso")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  admin         Admin    @relation(fields: [adminId], references: [id], onDelete: Cascade)

  @@unique([tenantId, adminId])
  @@index([tenantId])
  @@index([adminId])
  @@map("tenant_usuarios")
}
```

### 1.3 Modelo `TenantConfiguracion`

Configuración específica por tenant (reemplaza `Configuracion` global para datos por tenant):

```prisma
model TenantConfiguracion {
  id          Int      @id @default(autoincrement())
  tenantId    Int      @map("tenant_id")
  clave       String
  valor       String   @db.Text
  tipo        String   @default("STRING") // STRING, NUMBER, BOOLEAN, JSON
  descripcion String?

  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, clave])
  @@index([tenantId])
  @@map("tenant_configuracion")
}
```

### 1.4 Modificar Modelo `Admin`

Agregar relación con TenantUsuario y campo `esSuperAdmin`:

```prisma
model Admin {
  // ... campos existentes sin cambios ...
  esSuperAdmin          Boolean              @default(false) @map("es_super_admin")
  tenantUsuarios        TenantUsuario[]

  @@map("admins")
}
```

**Nota:** El modelo `Admin` mantiene su nombre actual. No se renombra a `Usuario` para minimizar el impacto en el código existente. El email sigue siendo `@unique` global — un admin se identifica por email y accede a los tenants que tiene asignados vía `TenantUsuario`.

### 1.5 Agregar `tenantId` a Modelos Existentes

Patrón para cada modelo:

```prisma
model Socio {
  // ... campos existentes ...
  tenantId    Int      @map("tenant_id")
  tenant      Tenant   @relation(fields: [tenantId], references: [id])

  @@index([tenantId])
  @@index([tenantId, estado])
  @@map("socios")
}
```

#### Lista completa de modelos que requieren `tenantId`

**Core Socios:**
- [ ] Socio
- [ ] GrupoFamiliar
- [ ] DocumentoSocio
- [ ] AutorizacionMenor
- [ ] SolicitudSocio
- [ ] FamiliarSolicitud
- [ ] PagoInformado

**Configuración:**
- [ ] TipoSocio
- [ ] CategoriaSocio
- [ ] EstadoSocio
- [ ] ConceptoTesoreria
- [ ] MedioPago
- [ ] Cobrador
- [ ] ConfiguracionRecargo
- [ ] Periodo
- [ ] Configuracion (la global, para configs por tenant)
- [ ] MenuItem
- [ ] Rol (roles personalizados por tenant)

**Finanzas:**
- [ ] Cargo
- [ ] Pago
- [ ] SaldoFavor
- [ ] AplicacionSaldo
- [ ] Caja
- [ ] CierreCaja
- [ ] MovimientoCaja
- [ ] TransferenciaCaja
- [ ] CuentaBancaria
- [ ] CuentaContable
- [ ] Asiento
- [ ] AsientoLinea
- [ ] MovimientoContable
- [ ] ItemMovimiento
- [ ] FormatoExtracto
- [ ] ExtractoBancario
- [ ] MovimientoExtracto
- [ ] Conciliacion
- [ ] ECheq
- [ ] LinkPago
- [ ] CentroCosto
- [ ] Presupuesto
- [ ] LineaPresupuesto

**Débito Automático:**
- [ ] ConfiguracionDebito
- [ ] ArchivoDebito
- [ ] DetalleDebito
- [ ] ImportacionCobranza
- [ ] DetalleCobranza

**Actividades y Deportes:**
- [ ] Actividad
- [ ] CategoriaActividad
- [ ] Inscripcion
- [ ] Entrenador
- [ ] EntrenadorCategoria
- [ ] TipoEspacio
- [ ] EspacioDeportivo
- [ ] HorarioDisponibilidad
- [ ] Entrenamiento
- [ ] HorarioRecurrente
- [ ] Asistencia
- [ ] Partido
- [ ] Convocatoria
- [ ] EstadisticaPartido
- [ ] StaffTecnico
- [ ] NoticiaDeportiva
- [ ] ArticuloReglamento
- [ ] AceptacionReglamento
- [ ] MensajeEntrenador

**Buffet:**
- [ ] Mesa
- [ ] CategoriaMenu
- [ ] ProductoBuffet
- [ ] GrupoOpcionProducto
- [ ] OpcionProducto
- [ ] Comanda
- [ ] ItemComanda
- [ ] OpcionItemComanda
- [ ] PedidoTakeAway
- [ ] ItemPedidoTakeAway
- [ ] OpcionItemTakeAway
- [ ] SectorBuffet
- [ ] ImpresoraTermica
- [ ] DestinoImpresion
- [ ] NotificacionBuffet
- [ ] NotificacionVista

**Comercial:**
- [ ] Comercio
- [ ] DescuentoDisponible
- [ ] Rubro
- [ ] Venta

**Stock y Compras:**
- [ ] CategoriaProducto
- [ ] Producto
- [ ] ProductoVariante
- [ ] ProductoFoto
- [ ] MovimientoStock
- [ ] CargoPersonal
- [ ] Entidad
- [ ] OrdenCompra
- [ ] ItemOrdenCompra
- [ ] Pedido (compras)
- [ ] ItemPedido

**RRHH:**
- [ ] ConceptoLiquidacion
- [ ] LiquidacionSueldo
- [ ] ItemLiquidacion

**Control de Accesos:**
- [ ] DispositivoAcceso
- [ ] RegistroAcceso
- [ ] HabilitacionTemporal
- [ ] IntentoAccesoDenegado

**Eventos:**
- [ ] Evento
- [ ] CategoriaEntrada
- [ ] Entrada
- [ ] IngresoEntrada

**Facturación Electrónica:**
- [ ] ConfiguracionFiscal
- [ ] ComprobanteElectronico

**Cobranzas y Comunicaciones:**
- [ ] GestionCobranza
- [ ] AccionCobranza
- [ ] EncuestaBaja
- [ ] AccionRecupero
- [ ] CampanaRecupero
- [ ] CampanaComunicacion
- [ ] EnvioCampana

**Contenido y Sitio:**
- [ ] Noticia
- [ ] Sponsor
- [ ] Banner
- [ ] Autoridad
- [ ] EmailTemplate (con flag `esGlobal`)
- [ ] PdfTemplate
- [ ] NotificacionLog
- [ ] PushSubscription

**Chat:**
- [ ] Conversacion
- [ ] Mensaje

**Auditoría:**
- [ ] AuditLog
- [ ] AdjuntoComprobante

#### Modelos que NO llevan `tenantId` (son globales)

- **Permiso** — Catálogo global de permisos del sistema
- **PermisoRol** — Relación permiso-rol (el Rol sí es por tenant)
- **CajaRol** — Relación caja-rol
- **MenuItemRol** — Relación menuItem-rol

#### Índices únicos que cambian (agregan tenantId)

```prisma
// Antes: @@unique([nroSocio])
// Después:
@@unique([tenantId, nroSocio])

// Antes: @@unique([codigo])  (en TipoSocio, MedioPago, etc)
// Después:
@@unique([tenantId, codigo])

// Antes: @@unique([clave]) (en Configuracion)
// Después:
@@unique([tenantId, clave])
```

---

## FASE 2: Backend - Middleware y Aislamiento

### 2.1 Extracción de Tenant (Express Middleware)

```javascript
// server/src/middleware/extractTenant.js

export async function extractTenant(req, res, next) {
  try {
    const host = req.get('host')
    const subdomain = extractSubdomain(host)

    if (!subdomain) {
      return res.status(400).json({
        error: 'No se pudo identificar el tenant',
        code: 'TENANT_REQUIRED'
      })
    }

    const tenant = await prisma.tenant.findUnique({
      where: { subdomain }
    })

    if (!tenant || !tenant.activo) {
      return res.status(404).json({
        error: 'Club no encontrado o inactivo',
        code: 'TENANT_NOT_FOUND'
      })
    }

    if (tenant.estado === 'SUSPENDED') {
      return res.status(403).json({
        error: 'Club suspendido',
        code: 'TENANT_SUSPENDED'
      })
    }

    req.tenant = tenant
    req.tenantId = tenant.id
    next()
  } catch (error) {
    next(error)
  }
}

function extractSubdomain(host) {
  // Desarrollo: sportivo.localhost:3000 → sportivo
  if (host.includes('localhost')) {
    const match = host.match(/^([^.]+)\.localhost/)
    return match ? match[1] : null
  }

  // Producción: sportivo-pilar.clubix.com → sportivo-pilar
  const parts = host.split(':')[0].split('.')
  if (parts.length <= 2) return null    // clubix.com
  if (parts[0] === 'www') return null   // www.clubix.com
  return parts[0]
}
```

### 2.2 Prisma Scoped Client

```javascript
// server/src/lib/tenantPrisma.js

export function createTenantPrisma(tenantId) {
  return prisma.$extends({
    query: {
      $allModels: {
        async findMany({ args, query }) {
          args.where = { ...args.where, tenantId }
          return query(args)
        },

        async findFirst({ args, query }) {
          args.where = { ...args.where, tenantId }
          return query(args)
        },

        async findUnique({ args, query }) {
          const result = await query(args)
          if (result && result.tenantId !== undefined && result.tenantId !== tenantId) {
            return null // No devolver datos de otro tenant
          }
          return result
        },

        async create({ args, query }) {
          args.data = { ...args.data, tenantId }
          return query(args)
        },

        async createMany({ args, query }) {
          if (Array.isArray(args.data)) {
            args.data = args.data.map(item => ({ ...item, tenantId }))
          }
          return query(args)
        },

        async update({ args, query }) {
          args.where = { ...args.where, tenantId }
          return query(args)
        },

        async updateMany({ args, query }) {
          args.where = { ...args.where, tenantId }
          return query(args)
        },

        async delete({ args, query }) {
          args.where = { ...args.where, tenantId }
          return query(args)
        },

        async deleteMany({ args, query }) {
          args.where = { ...args.where, tenantId }
          return query(args)
        },

        async count({ args, query }) {
          args.where = { ...args.where, tenantId }
          return query(args)
        },

        async aggregate({ args, query }) {
          args.where = { ...args.where, tenantId }
          return query(args)
        }
      }
    }
  })
}
```

### 2.3 Aplicación Global en Express

```javascript
// server/src/index.js

// Rutas que requieren tenant
app.use('/api/admin/*', extractTenant, (req, res, next) => {
  req.db = createTenantPrisma(req.tenantId)
  next()
})
app.use('/api/socio/*', extractTenant, (req, res, next) => {
  req.db = createTenantPrisma(req.tenantId)
  next()
})
app.use('/api/buffet/*', extractTenant, (req, res, next) => {
  req.db = createTenantPrisma(req.tenantId)
  next()
})

// Rutas públicas con tenant (sitio público, menú, etc)
app.use('/api/public/*', extractTenantOptional, (req, res, next) => {
  if (req.tenantId) {
    req.db = createTenantPrisma(req.tenantId)
  }
  next()
})

// Rutas super-admin (sin tenant scope)
app.use('/api/super-admin/*', requireSuperAdmin)
```

### 2.4 Patrón de Uso en Rutas

```javascript
// ANTES:
router.get('/socios', authAdmin, async (req, res) => {
  const socios = await prisma.socio.findMany()
  res.json(socios)
})

// DESPUÉS:
router.get('/socios', authAdmin, async (req, res) => {
  const socios = await req.db.socio.findMany() // Ya filtrado por tenant
  res.json(socios)
})
```

### 2.5 Autenticación con Tenant

```javascript
// Login: validar que el admin tiene acceso al tenant del subdomain
async function login(req, res) {
  const { email, password } = req.body
  const tenantId = req.tenantId // Viene del subdomain

  // 1. Autenticar admin
  const admin = await prisma.admin.findUnique({ where: { email } })
  if (!admin || !await bcrypt.compare(password, admin.passwordHash)) {
    return res.status(401).json({ error: 'Credenciales inválidas' })
  }

  // 2. Verificar acceso al tenant
  const tenantUsuario = await prisma.tenantUsuario.findUnique({
    where: { tenantId_adminId: { tenantId, adminId: admin.id } }
  })

  if (!tenantUsuario || !tenantUsuario.activo) {
    return res.status(403).json({ error: 'No tenés acceso a este club' })
  }

  // 3. Generar JWT con tenantId
  const token = jwt.sign({
    id: admin.id,
    email: admin.email,
    tenantId,
    rol: tenantUsuario.rol,
    esSuperAdmin: admin.esSuperAdmin
  }, process.env.JWT_SECRET)

  res.json({ token, admin: { ...admin, rol: tenantUsuario.rol }, tenant: req.tenant })
}
```

---

## FASE 3: Frontend - Context de Tenant

### 3.1 TenantContext

```javascript
// client/src/contexts/TenantContext.jsx

export const TenantContext = createContext()

export function TenantProvider({ children }) {
  const [tenant, setTenant] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCurrentTenant()
  }, [])

  async function fetchCurrentTenant() {
    try {
      const response = await api.get('/api/tenant/current')
      setTenant(response.data)
      applyTheme(response.data.colores)
    } catch (error) {
      console.error('Error cargando tenant:', error)
    } finally {
      setLoading(false)
    }
  }

  function applyTheme(colores) {
    if (!colores) return
    const root = document.documentElement
    Object.entries(colores).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value)
    })
  }

  return (
    <TenantContext.Provider value={{ tenant, loading }}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  const context = useContext(TenantContext)
  if (!context) throw new Error('useTenant debe usarse dentro de TenantProvider')
  return context
}
```

### 3.2 Integración en App

```jsx
<TenantProvider>
  <AuthProvider>
    <Router>{/* rutas */}</Router>
  </AuthProvider>
</TenantProvider>
```

### 3.3 Header/Footer Dinámico

```jsx
const { tenant } = useTenant()

// Header
<img src={tenant?.logoUrl || '/default-logo.png'} alt={tenant?.nombre} />
<span>{tenant?.nombre}</span>

// Favicon dinámico
useEffect(() => {
  if (tenant?.faviconUrl) {
    document.querySelector("link[rel~='icon']").href = tenant.faviconUrl
  }
  document.title = `${tenant?.nombre} - Admin`
}, [tenant])
```

---

## FASE 4: Branding por Tenant

### Estructura de Colores (campo `colores` JSONB)

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

### Mapeo a CSS Variables

| JSON Key | CSS Variable | Uso |
|----------|-------------|-----|
| primario | --color-primary | Botones principales, header, sidebar |
| primarioOscuro | --color-primary-dark | Hover de botones, acentos |
| primarioClaro | --color-primary-light | Badges, fondos suaves |
| secundario | --color-secondary | Botones secundarios, tabs |
| acento | --color-accent | Links, badges informativos |
| exito | --color-success | Alertas ok, badges activo |
| advertencia | --color-warning | Alertas warning, badges pendiente |
| error | --color-error | Alertas error, badges vencido |
| info | --color-info | Alertas info, tooltips |
| fondoPrincipal | --color-bg-primary | Fondo general |
| fondoSecundario | --color-bg-secondary | Fondo de cards, tablas |
| textoPrincipal | --color-text-primary | Textos principales |
| textoSecundario | --color-text-secondary | Textos secundarios, labels |
| borde | --color-border | Bordes de inputs, cards, tablas |

### Tailwind Config

```javascript
// tailwind.config.js
theme: {
  extend: {
    colors: {
      primary: 'var(--color-primary)',
      'primary-dark': 'var(--color-primary-dark)',
      'primary-light': 'var(--color-primary-light)',
      secondary: 'var(--color-secondary)',
      accent: 'var(--color-accent)',
    }
  }
}
```

### API de Branding

```
GET    /api/admin/branding           → Obtener branding actual
PUT    /api/admin/branding/colores   → Actualizar colores
POST   /api/admin/branding/logo      → Subir logo (max 2MB, PNG/JPG/SVG)
POST   /api/admin/branding/favicon   → Subir favicon (max 500KB, PNG/ICO)
DELETE /api/admin/branding/logo      → Eliminar logo
```

---

## FASE 5: Flujos de Usuario

### Onboarding de Nuevo Club

```
1. Usuario va a clubix.com/registro
2. Formulario: nombre, subdomain (verifica disponibilidad), email admin, contraseña
3. Sistema crea: Tenant (PENDING_APPROVAL) + Admin + TenantUsuario
4. Email a super-admin: "Nuevo club pendiente"
5. Email al registrante: "Registro recibido, pendiente de aprobación"
6. Super-admin aprueba → estado=ACTIVE, activo=true
7. Email: "Club aprobado, accedé en https://{subdomain}.clubix.com"
```

### Login Multi-Tenant

```
1. Admin va a sportivo-pilar.clubix.com/login
2. Ingresa email + password
3. Sistema autentica admin + verifica TenantUsuario para ese tenant
4. Si tiene acceso → JWT con { userId, tenantId, rol }
5. Si NO tiene acceso → "No tenés acceso a este club"
```

### Cambio de Club (admin con múltiples tenants)

```
1. Menú → "Cambiar club"
2. Lista de clubes disponibles (via TenantUsuario)
3. Click → Redirige a {otro-subdomain}.clubix.com
4. Auto-login si tiene sesión activa
```

### Super-Admin

```
Login en admin.clubix.com
Panel: ver todos los tenants, aprobar/rechazar, suspender/activar
Puede acceder a cualquier tenant en modo debug
```

---

## FASE 6: Panel Super-Admin

### Endpoints

```
GET    /api/super-admin/tenants                → Listar tenants
GET    /api/super-admin/tenants/:id            → Detalle tenant
POST   /api/super-admin/tenants/:id/approve    → Aprobar
POST   /api/super-admin/tenants/:id/reject     → Rechazar
POST   /api/super-admin/tenants/:id/suspend    → Suspender
DELETE /api/super-admin/tenants/:id            → Eliminar
GET    /api/super-admin/stats                  → Estadísticas globales
```

### Middleware

```javascript
export function requireSuperAdmin(req, res, next) {
  if (!req.user?.esSuperAdmin) {
    return res.status(403).json({ error: 'Acceso denegado' })
  }
  next()
}
```

---

## FASE 7: Templates de Email

Los templates pueden ser globales (default) o por tenant (override):

```javascript
async function getEmailTemplate(nombre, tenantId) {
  // 1. Buscar template específico del tenant
  let template = await prisma.emailTemplate.findFirst({
    where: { nombre, tenantId, activo: true }
  })

  // 2. Si no existe, usar template global
  if (!template) {
    template = await prisma.emailTemplate.findFirst({
      where: { nombre, esGlobal: true, activo: true }
    })
  }

  return template
}
```

EmailTemplate necesita:
- Campo `tenantId` (nullable)
- Campo `esGlobal` (Boolean, default false)
- Constraint: `tenantId IS NULL AND esGlobal = true` OR `tenantId IS NOT NULL AND esGlobal = false`

---

## FASE 8: Migración de Datos Existentes

### Script de migración

```
1. Crear tenant "sportivo-pilar" con estado ACTIVE
2. Agregar columna tenant_id a todas las tablas (nullable primero)
3. UPDATE todas las tablas SET tenant_id = 1
4. ALTER todas las columnas tenant_id SET NOT NULL
5. Crear índices compuestos (tenant_id, id) en cada tabla
6. Actualizar índices únicos para incluir tenant_id
7. Crear TenantUsuario para cada Admin existente → tenant_id=1
8. Validar: SELECT COUNT(*) FROM {tabla} WHERE tenant_id IS NULL = 0
```

### Patrón de índices

```sql
CREATE INDEX idx_{tabla}_tenant ON {tabla}(tenant_id, id);
```

---

## FASE 9: Infraestructura

### DNS Wildcard

```
*.clubix.com  →  A  →  IP_SERVIDOR
```

### Nginx

```nginx
server {
  listen 443 ssl http2;
  server_name *.clubix.com;

  ssl_certificate /etc/letsencrypt/live/clubix.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/clubix.com/privkey.pem;

  location / {
    root /var/www/clubix/client/dist;
    try_files $uri /index.html;
  }

  location /api {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

### SSL Wildcard

```bash
certbot certonly --manual --preferred-challenges dns \
  -d clubix.com -d *.clubix.com
```

---

## Orden de Implementación

### Semana 1-2: Base de datos y backend core
- [ ] Crear modelos Tenant, TenantUsuario, TenantConfiguracion en Prisma
- [ ] Agregar tenantId a todos los modelos (90+)
- [ ] Script de migración de datos existentes
- [ ] Middleware extractTenant
- [ ] Función createTenantPrisma
- [ ] Modificar autenticación (JWT con tenantId)
- [ ] Endpoint GET /api/tenant/current

### Semana 3: Refactorizar rutas
- [ ] Reemplazar `prisma.` por `req.db.` en todas las rutas
- [ ] Verificar que ninguna query escapa del scope del tenant
- [ ] Tests de aislamiento

### Semana 4: Frontend
- [ ] TenantContext y TenantProvider
- [ ] Header/Footer dinámico con logo y nombre del tenant
- [ ] Favicon y título dinámico
- [ ] Login adaptado a multi-tenant

### Semana 5: Branding + Super-Admin
- [ ] API de branding (colores, logo, favicon)
- [ ] Editor de colores en panel admin
- [ ] CSS variables dinámicas desde colores del tenant
- [ ] Panel super-admin (CRUD de tenants, aprobación)
- [ ] Página de registro público

### Semana 6: Testing, infra y deploy
- [ ] Tests de aislamiento entre tenants
- [ ] DNS wildcard + SSL
- [ ] Nginx configurado
- [ ] Crear tenant "demo" con datos de prueba
- [ ] Deploy y monitoreo

---

## Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Fuga de datos entre tenants | Crítico | Tests exhaustivos de aislamiento + Prisma $extends automático |
| Performance por filtro extra | Medio | Índices compuestos (tenant_id, id) en toda tabla |
| Pérdida de datos en migración | Alto | Backup completo antes de cada paso, script de rollback |
| Migración de 90+ modelos es masiva | Alto | Hacer por lotes, validar integridad en cada paso |
| DNS/SSL wildcard | Medio | Configurar y probar en staging primero |

---

## Criterios de Éxito

- [ ] 0 cruces de datos entre tenants
- [ ] Performance igual o mejor que single-tenant
- [ ] Sportivo Pilar funciona 100% igual que antes de la migración
- [ ] Nuevo tenant se puede crear en < 5 minutos
- [ ] Admin puede personalizar colores y logo desde el panel
- [ ] Super-admin puede aprobar/rechazar/suspender tenants
