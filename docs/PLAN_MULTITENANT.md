# Plan de Implementación Multi-Tenant - RojoPlus

**Fecha:** 12 de Febrero 2026
**Estado:** Planificación
**Complejidad:** Alta
**Duración estimada:** 8-10 semanas

---

## 📋 Objetivo

Convertir RojoPlus en una aplicación SaaS multi-tenant donde múltiples clubes/instituciones puedan usar el sistema de forma independiente, cada uno con:
- Datos completamente aislados
- Configuración personalizada (colores, logos, nombre)
- Subdominios propios (ej: `pilar.rojoplus.com`, `belgrano.rojoplus.com`)
- Facturación independiente por institución

---

## 🎯 Estrategia Multi-Tenant

### Tipo de Multi-Tenancy Recomendado: **Híbrido**

**Base de Datos Compartida + Schema por Tenant**

#### Ventajas:
✅ Balance entre aislamiento y costo
✅ Escalabilidad moderada
✅ Migraciones centralizadas
✅ Mejor para 10-100 instituciones

#### Alternativas consideradas:
- ❌ **DB separada por tenant**: Costos altos, difícil mantenimiento
- ❌ **Tabla compartida con tenantId**: Riesgo de filtrado incorrecto, queries complejas

---

## 🗄️ FASE 1: Modelo de Datos

### 1.1 Nuevo Modelo `Institucion` (Tenant)

```prisma
model Institucion {
  id                   Int      @id @default(autoincrement())
  codigo               String   @unique // 'pilar', 'belgrano', etc.
  nombre               String   // "Club Sportivo Pilar"
  nombreCorto          String?  // "CSP"
  subdominio           String   @unique // pilar.rojoplus.com

  // Contacto
  email                String?
  telefono             String?
  direccion            String?
  ciudad               String?
  provincia            String?
  pais                 String   @default("Argentina")

  // Personalización (FASE 2)
  logoUrl              String?
  logoSecundarioUrl    String?
  faviconUrl           String?
  paletaColores        Json?    // { primary: '#DC2626', secondary: '#1F2937', ... }
  configUI             Json?    // Configuraciones adicionales de UI

  // Estado y plan
  estado               String   @default("ACTIVO") // ACTIVO, SUSPENDIDO, CANCELADO
  planId               Int?
  fechaCreacion        DateTime @default(now()) @map("fecha_creacion")
  fechaActivacion      DateTime? @map("fecha_activacion")
  fechaSuspension      DateTime? @map("fecha_suspension")

  // Configuración técnica
  timezone             String   @default("America/Argentina/Buenos_Aires")
  idioma               String   @default("es-AR")
  moneda               String   @default("ARS")

  // Límites (según plan)
  maxSocios            Int?
  maxUsuariosAdmin     Int?
  maxAlmacenamiento    Int?     // En MB

  // Facturación
  cuit                 String?
  razonSocial          String?
  condicionIVA         String?

  // Relaciones
  plan                 Plan? @relation(fields: [planId], references: [id])
  usuarios             Usuario[]
  socios               Socio[]
  configuraciones      ConfiguracionInstitucion[]

  createdAt            DateTime @default(now()) @map("created_at")
  updatedAt            DateTime @updatedAt @map("updated_at")

  @@index([subdominio])
  @@index([codigo])
  @@index([estado])
  @@map("instituciones")
}
```

---

### 1.2 Nuevo Modelo `Plan` (Pricing)

```prisma
model Plan {
  id                   Int      @id @default(autoincrement())
  codigo               String   @unique // 'basico', 'profesional', 'enterprise'
  nombre               String   // "Plan Básico"
  descripcion          String?  @db.Text

  // Pricing
  precioMensual        Decimal  @db.Decimal(10, 2)
  precioAnual          Decimal? @db.Decimal(10, 2)
  moneda               String   @default("ARS")

  // Límites
  maxSocios            Int      // 500, 2000, ilimitado (9999999)
  maxUsuariosAdmin     Int      // 3, 10, ilimitado
  maxAlmacenamiento    Int      // MB: 1000, 5000, 10000

  // Features
  features             Json     // { "buffet": true, "deportes": true, ... }

  // Estado
  activo               Boolean  @default(true)
  visible              Boolean  @default(true)
  orden                Int      @default(0)

  // Relaciones
  instituciones        Institucion[]

  createdAt            DateTime @default(now()) @map("created_at")
  updatedAt            DateTime @updatedAt @map("updated_at")

  @@map("planes")
}
```

---

### 1.3 Nuevo Modelo `ConfiguracionInstitucion`

Configuraciones específicas por institución (como las actuales en ConfiguracionSistema pero por tenant):

```prisma
model ConfiguracionInstitucion {
  id              Int      @id @default(autoincrement())
  institucionId   Int      @map("institucion_id")
  clave           String   // 'dia_vencimiento_cuota', 'recargo_mora', etc.
  valor           String   @db.Text
  tipo            String   @default("STRING") // STRING, NUMBER, BOOLEAN, JSON
  descripcion     String?

  institucion     Institucion @relation(fields: [institucionId], references: [id], onDelete: Cascade)

  @@unique([institucionId, clave])
  @@index([institucionId])
  @@map("configuraciones_institucion")
}
```

---

### 1.4 Modificar Modelo `Usuario` (antes `Admin`)

```prisma
model Usuario {
  id              Int      @id @default(autoincrement())
  institucionId   Int      @map("institucion_id")  // NUEVO
  email           String   // Ya no @unique global, solo por institución
  password        String
  nombre          String
  apellido        String?
  rolId           Int?     @map("rol_id")
  activo          Boolean  @default(true)

  // Super Admin (puede acceder a todas las instituciones)
  esSuperAdmin    Boolean  @default(false) @map("es_super_admin")

  institucion     Institucion @relation(fields: [institucionId], references: [id], onDelete: Cascade)
  rol             Rol? @relation(fields: [rolId], references: [id])

  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@unique([institucionId, email]) // Email único por institución
  @@index([institucionId])
  @@index([email])
  @@map("usuarios")
}
```

---

### 1.5 Agregar `institucionId` a TODOS los Modelos Principales

**Modelos a modificar (35+ modelos)**:

```prisma
// Ejemplo con Socio
model Socio {
  id              Int      @id @default(autoincrement())
  institucionId   Int      @map("institucion_id")  // NUEVO
  nroSocio        String
  // ... resto de campos

  institucion     Institucion @relation(fields: [institucionId], references: [id], onDelete: Cascade)

  @@unique([institucionId, nroSocio]) // Nº socio único por institución
  @@index([institucionId])
  @@index([institucionId, estado])
  @@map("socios")
}
```

**Lista completa de modelos a actualizar**:

#### Core
- [x] Socio
- [x] GrupoFamiliar
- [x] Cargo
- [x] Cuota
- [x] Pago
- [x] Inscripcion

#### Actividades
- [x] Actividad
- [x] CategoriaActividad
- [x] Entrenamiento
- [x] Partido
- [x] Convocatoria
- [x] Asistencia

#### Financiero
- [x] Caja
- [x] MovimientoCaja
- [x] CuentaContable
- [x] Asiento
- [x] AsientoLinea
- [x] Presupuesto

#### Comercial
- [x] Comercio
- [x] Venta

#### Stock
- [x] Producto
- [x] CategoriaProducto
- [x] MovimientoStock

#### Buffet
- [x] Mesa
- [x] Comanda
- [x] ItemComanda
- [x] PedidoTakeAway

#### Configuración
- [x] Periodo
- [x] TipoSocio
- [x] CategoriaSocio
- [x] MedioPago
- [x] Concepto
- [x] CentroCosto
- [x] Entidad (Proveedores, Clientes)

#### Contenido
- [x] Noticia
- [x] Autoridad
- [x] EspacioDeportivo

---

### 1.6 Script de Migración

```javascript
// server/prisma/migrations/add-multitenant.js

/**
 * Migración Multi-Tenant
 *
 * IMPORTANTE: Esta migración es DESTRUCTIVA en desarrollo.
 * En producción, requiere migración de datos existentes.
 */

async function migrateToMultiTenant() {
  // Paso 1: Crear modelo Institucion y Plan
  await prisma.$executeRaw`
    CREATE TABLE planes (...)
    CREATE TABLE instituciones (...)
  `

  // Paso 2: Crear institución por defecto para datos existentes
  const defaultInstitution = await prisma.institucion.create({
    data: {
      codigo: 'pilar',
      nombre: 'Club Sportivo Pilar',
      subdominio: 'pilar',
      estado: 'ACTIVO',
      planId: 1 // Plan básico
    }
  })

  // Paso 3: Agregar columna institucionId a todas las tablas
  // (Prisma lo hace automáticamente con db push)

  // Paso 4: Migrar datos existentes a institución default
  await prisma.$executeRaw`
    UPDATE socios SET institucion_id = ${defaultInstitution.id}
  `
  await prisma.$executeRaw`
    UPDATE usuarios SET institucion_id = ${defaultInstitution.id}
  `
  // ... repetir para cada tabla

  // Paso 5: Recrear índices únicos con institucionId
  // Ejemplo: nroSocio único global -> único por institución

  console.log('✅ Migración multi-tenant completada')
}
```

---

## ⚙️ FASE 2: Backend - Middleware y Contexto

### 2.1 Middleware de Tenant Resolution

```javascript
// server/src/middleware/tenantResolver.js

/**
 * Resuelve la institución basándose en:
 * 1. Subdominio (pilar.rojoplus.com)
 * 2. Header X-Tenant-ID (para APIs externas)
 * 3. Token JWT con institucionId (para admin logueado)
 */

export async function resolveTenant(req, res, next) {
  try {
    let institucionId = null
    let institucion = null

    // Opción 1: Por subdominio
    const host = req.hostname // 'pilar.rojoplus.com'
    const subdomain = host.split('.')[0]

    if (subdomain && subdomain !== 'www' && subdomain !== 'rojoplus') {
      institucion = await prisma.institucion.findUnique({
        where: { subdominio: subdomain },
        include: { plan: true }
      })

      if (!institucion) {
        return res.status(404).json({
          error: 'Institución no encontrada',
          code: 'TENANT_NOT_FOUND'
        })
      }

      if (institucion.estado !== 'ACTIVO') {
        return res.status(403).json({
          error: 'Institución suspendida',
          code: 'TENANT_SUSPENDED'
        })
      }

      institucionId = institucion.id
    }

    // Opción 2: Por header (APIs externas)
    if (!institucionId && req.headers['x-tenant-id']) {
      institucionId = parseInt(req.headers['x-tenant-id'])
      institucion = await prisma.institucion.findUnique({
        where: { id: institucionId }
      })
    }

    // Opción 3: Por token JWT (admin logueado)
    if (!institucionId && req.user?.institucionId) {
      institucionId = req.user.institucionId
      institucion = await prisma.institucion.findUnique({
        where: { id: institucionId }
      })
    }

    // Validar que se haya resuelto
    if (!institucionId || !institucion) {
      return res.status(400).json({
        error: 'No se pudo determinar la institución',
        code: 'TENANT_REQUIRED'
      })
    }

    // Agregar al request para uso posterior
    req.institucionId = institucionId
    req.institucion = institucion

    next()
  } catch (error) {
    console.error('Error resolviendo tenant:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}
```

---

### 2.2 Middleware de Tenant Scope (Automático)

```javascript
// server/src/middleware/tenantScope.js

/**
 * Intercepta TODAS las queries de Prisma y agrega automáticamente
 * el filtro WHERE institucionId = X
 */

export function createTenantScopedPrisma(institucionId) {
  return prisma.$extends({
    query: {
      // Para cada modelo
      $allModels: {
        // Interceptar findMany, findFirst, findUnique, etc.
        async findMany({ model, args, query }) {
          // Agregar filtro automático
          args.where = {
            ...args.where,
            institucionId
          }
          return query(args)
        },

        async findFirst({ args, query }) {
          args.where = {
            ...args.where,
            institucionId
          }
          return query(args)
        },

        async findUnique({ args, query }) {
          // Para findUnique con WHERE id, agregar validación posterior
          const result = await query(args)
          if (result && result.institucionId !== institucionId) {
            throw new Error('Acceso denegado a recurso de otra institución')
          }
          return result
        },

        async create({ args, query }) {
          // Agregar institucionId automáticamente
          args.data = {
            ...args.data,
            institucionId
          }
          return query(args)
        },

        async update({ args, query }) {
          // Validar que pertenece a la institución
          args.where = {
            ...args.where,
            institucionId
          }
          return query(args)
        },

        async delete({ args, query }) {
          // Validar que pertenece a la institución
          args.where = {
            ...args.where,
            institucionId
          }
          return query(args)
        }
      }
    }
  })
}

// Uso en rutas:
export async function handler(req, res) {
  const db = createTenantScopedPrisma(req.institucionId)

  // Ahora todas las queries están automáticamente filtradas
  const socios = await db.socio.findMany() // Solo de esta institución
}
```

---

### 2.3 Modificar Autenticación JWT

```javascript
// server/src/middleware/authAdmin.js

export async function authAdmin(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      return res.status(401).json({ error: 'Token requerido' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // NUEVO: incluir institucionId en el token
    req.user = {
      id: decoded.id,
      email: decoded.email,
      institucionId: decoded.institucionId,  // NUEVO
      esSuperAdmin: decoded.esSuperAdmin,
      permisos: decoded.permisos
    }

    // Si no es super admin, validar que accede a su institución
    if (!req.user.esSuperAdmin && req.institucionId !== req.user.institucionId) {
      return res.status(403).json({
        error: 'No tiene acceso a esta institución'
      })
    }

    next()
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' })
  }
}

// Modificar login para incluir institucionId
export async function login(req, res) {
  const { email, password, institucionId } = req.body

  const usuario = await prisma.usuario.findFirst({
    where: {
      email,
      institucionId, // NUEVO: validar por institución
      activo: true
    },
    include: {
      rol: {
        include: { permisos: true }
      },
      institucion: true
    }
  })

  // ... validar password

  const token = jwt.sign({
    id: usuario.id,
    email: usuario.email,
    institucionId: usuario.institucionId, // NUEVO
    esSuperAdmin: usuario.esSuperAdmin,
    permisos: usuario.rol?.permisos.map(p => p.codigo) || []
  }, process.env.JWT_SECRET)

  res.json({
    token,
    usuario: {
      ...usuario,
      institucion: usuario.institucion // Incluir datos de la institución
    }
  })
}
```

---

### 2.4 Refactorizar TODAS las Rutas

**Patrón antes (ejemplo)**:
```javascript
router.get('/socios', authAdmin, async (req, res) => {
  const socios = await prisma.socio.findMany()
  res.json(socios)
})
```

**Patrón después**:
```javascript
router.get('/socios',
  resolveTenant,      // NUEVO: Resolver institución
  authAdmin,          // Validar auth
  async (req, res) => {
    const db = createTenantScopedPrisma(req.institucionId) // NUEVO
    const socios = await db.socio.findMany() // Automáticamente filtrado
    res.json(socios)
  }
)
```

**O usar middleware global**:
```javascript
// Aplicar a todas las rutas admin
app.use('/admin/*', resolveTenant)
app.use('/admin/*', authAdmin)
app.use('/admin/*', (req, res, next) => {
  // Crear cliente Prisma con scope automático
  req.db = createTenantScopedPrisma(req.institucionId)
  next()
})

// Ahora en las rutas:
router.get('/socios', async (req, res) => {
  const socios = await req.db.socio.findMany() // Ya filtrado!
  res.json(socios)
})
```

---

## 🎨 FASE 3: Frontend - Context y Tenant Awareness

### 3.1 Nuevo Contexto `InstitucionContext`

```jsx
// client/src/contexts/InstitucionContext.jsx

import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const InstitucionContext = createContext()

export function InstitucionProvider({ children }) {
  const [institucion, setInstitucion] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargarInstitucion()
  }, [])

  async function cargarInstitucion() {
    try {
      // Obtener datos de la institución actual
      const response = await api.get('/public/institucion')
      setInstitucion(response.data)

      // Aplicar personalización
      aplicarTema(response.data.paletaColores)
    } catch (error) {
      console.error('Error cargando institución:', error)
    } finally {
      setLoading(false)
    }
  }

  function aplicarTema(paletaColores) {
    if (!paletaColores) return

    // Aplicar colores personalizados a CSS variables
    const root = document.documentElement
    root.style.setProperty('--color-primary', paletaColores.primary)
    root.style.setProperty('--color-secondary', paletaColores.secondary)
    root.style.setProperty('--color-accent', paletaColores.accent)
    // ... más colores
  }

  if (loading) {
    return <div>Cargando institución...</div>
  }

  return (
    <InstitucionContext.Provider value={{ institucion, setInstitucion }}>
      {children}
    </InstitucionContext.Provider>
  )
}

export function useInstitucion() {
  const context = useContext(InstitucionContext)
  if (!context) {
    throw new Error('useInstitucion debe usarse dentro de InstitucionProvider')
  }
  return context
}
```

---

### 3.2 Modificar App.jsx

```jsx
// client/src/App.jsx

import { InstitucionProvider } from './contexts/InstitucionContext'

function App() {
  return (
    <InstitucionProvider>
      <AuthProvider>
        <Router>
          {/* Rutas */}
        </Router>
      </AuthProvider>
    </InstitucionProvider>
  )
}
```

---

### 3.3 Modificar API Service

```javascript
// client/src/services/api.js

import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
})

// Interceptor para agregar tenant en header (opcional, si no se usa subdominio)
api.interceptors.request.use(config => {
  // El tenant se resuelve por subdominio en el backend
  // Opcionalmente se puede enviar en header
  const hostname = window.location.hostname
  const subdomain = hostname.split('.')[0]

  if (subdomain && subdomain !== 'localhost') {
    config.headers['X-Tenant-Subdomain'] = subdomain
  }

  // Agregar token si existe
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

export default api
```

---

### 3.4 Componente de Logo Dinámico

```jsx
// client/src/components/Logo.jsx

import { useInstitucion } from '../contexts/InstitucionContext'

export function Logo({ className = '', variant = 'primary' }) {
  const { institucion } = useInstitucion()

  const logoUrl = variant === 'secondary'
    ? institucion?.logoSecundarioUrl
    : institucion?.logoUrl

  if (!logoUrl) {
    return (
      <div className={`font-bold text-xl ${className}`}>
        {institucion?.nombreCorto || institucion?.nombre || 'RojoPlus'}
      </div>
    )
  }

  return (
    <img
      src={logoUrl}
      alt={institucion?.nombre}
      className={className}
    />
  )
}
```

---

## 🚀 FASE 4: Panel Super Admin

### 4.1 Nuevo Módulo `/superadmin`

Solo accesible por usuarios con `esSuperAdmin: true`.

**Páginas**:
- `/superadmin/instituciones` - Listado de instituciones
- `/superadmin/instituciones/nueva` - Crear institución
- `/superadmin/instituciones/:id` - Editar institución
- `/superadmin/planes` - Gestión de planes
- `/superadmin/facturacion` - Facturación consolidada
- `/superadmin/estadisticas` - Métricas globales

### 4.2 Componente Selector de Institución (Super Admin)

```jsx
// client/src/components/superadmin/SelectorInstitucion.jsx

export function SelectorInstitucion() {
  const { user } = useAuth()
  const [instituciones, setInstituciones] = useState([])
  const [selected, setSelected] = useState(null)

  if (!user.esSuperAdmin) return null

  async function cambiarInstitucion(institucionId) {
    // Cambiar contexto a otra institución
    // Esto permite que el super admin "se haga pasar" por otra institución
    setSelected(institucionId)
    // Recargar datos con nuevo scope
  }

  return (
    <div className="flex items-center gap-2">
      <label>Institución activa:</label>
      <select
        value={selected}
        onChange={(e) => cambiarInstitucion(e.target.value)}
      >
        {instituciones.map(inst => (
          <option key={inst.id} value={inst.id}>
            {inst.nombre}
          </option>
        ))}
      </select>
    </div>
  )
}
```

---

## 🔐 FASE 5: Seguridad y Aislamiento

### 5.1 Checklist de Seguridad

- [ ] **Row-Level Security**: Todas las queries filtradas por `institucionId`
- [ ] **Validación de ownership**: En updates/deletes verificar institución
- [ ] **Tokens JWT con institucionId**: No confiar solo en cookies
- [ ] **Validación doble**: Middleware + query scope
- [ ] **Logs de acceso**: Registrar accesos entre instituciones (audit trail)
- [ ] **Rate limiting por institución**: Evitar abuso
- [ ] **Backups separados**: Opción de backup por institución
- [ ] **CORS configurado**: Por subdominio

### 5.2 Tests de Aislamiento

```javascript
// tests/tenant-isolation.test.js

describe('Tenant Isolation', () => {
  it('no debe permitir acceso a datos de otra institución', async () => {
    const inst1 = await crearInstitucion('club-a')
    const inst2 = await crearInstitucion('club-b')

    const socioInst1 = await crearSocio({ institucionId: inst1.id })

    // Intentar acceder desde inst2
    const db = createTenantScopedPrisma(inst2.id)
    const resultado = await db.socio.findUnique({
      where: { id: socioInst1.id }
    })

    expect(resultado).toBeNull()
  })

  it('debe filtrar listados por institución', async () => {
    const inst1 = await crearInstitucion('club-a')
    const inst2 = await crearInstitucion('club-b')

    await crearSocio({ institucionId: inst1.id })
    await crearSocio({ institucionId: inst2.id })

    const db = createTenantScopedPrisma(inst1.id)
    const socios = await db.socio.findMany()

    expect(socios).toHaveLength(1)
    expect(socios[0].institucionId).toBe(inst1.id)
  })
})
```

---

## 🌐 FASE 6: DNS y Subdominios

### 6.1 Configuración DNS

**Wildcard DNS**:
```
*.rojoplus.com  →  A  →  IP_SERVIDOR
```

Esto permite que cualquier subdominio apunte al mismo servidor:
- `pilar.rojoplus.com`
- `belgrano.rojoplus.com`
- `river.rojoplus.com`

### 6.2 Nginx Configuration

```nginx
# /etc/nginx/sites-available/rojoplus-multitenant

server {
  listen 80;
  server_name *.rojoplus.com;

  # Redirigir a HTTPS
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name *.rojoplus.com;

  # SSL Wildcard Certificate
  ssl_certificate /etc/letsencrypt/live/rojoplus.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/rojoplus.com/privkey.pem;

  # Frontend (React)
  location / {
    root /var/www/rojoplus/client/dist;
    try_files $uri /index.html;
  }

  # Backend API
  location /api {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

### 6.3 SSL Wildcard (Let's Encrypt)

```bash
# Obtener certificado wildcard (requiere validación DNS)
sudo certbot certonly --manual \
  --preferred-challenges dns \
  --server https://acme-v02.api.letsencrypt.org/directory \
  -d *.rojoplus.com \
  -d rojoplus.com
```

---

## 📊 FASE 7: Onboarding de Nuevas Instituciones

### 7.1 Proceso de Registro

1. **Landing Page Pública**: `rojoplus.com`
2. **Formulario de Registro**:
   - Nombre de la institución
   - Email de contacto
   - Subdominio deseado (validar disponibilidad)
   - Plan seleccionado
3. **Creación automática**:
   - Institución en BD
   - Usuario admin inicial
   - Configuraciones por defecto
   - Datos semilla (planes, medios de pago básicos)
4. **Email de bienvenida** con:
   - URL de acceso: `https://[subdominio].rojoplus.com`
   - Credenciales admin
   - Guía de primeros pasos

### 7.2 Script de Setup Inicial

```javascript
// server/src/services/onboarding.js

export async function crearInstitucion(data) {
  const {
    nombre,
    nombreCorto,
    subdominio,
    emailAdmin,
    nombreAdmin,
    planId
  } = data

  // Validar subdominio disponible
  const existe = await prisma.institucion.findUnique({
    where: { subdominio }
  })
  if (existe) {
    throw new Error('Subdominio no disponible')
  }

  // Crear institución
  const institucion = await prisma.institucion.create({
    data: {
      nombre,
      nombreCorto,
      subdominio,
      planId,
      estado: 'ACTIVO',
      fechaActivacion: new Date()
    }
  })

  // Crear usuario admin inicial
  const passwordTemp = generarPasswordAleatorio()
  const usuario = await prisma.usuario.create({
    data: {
      institucionId: institucion.id,
      email: emailAdmin,
      password: await bcrypt.hash(passwordTemp, 10),
      nombre: nombreAdmin,
      activo: true,
      esSuperAdmin: false,
      rol: {
        connect: { codigo: 'ADMIN' } // Rol con todos los permisos
      }
    }
  })

  // Crear datos semilla
  await crearDatosSemilla(institucion.id)

  // Enviar email
  await enviarEmailBienvenida({
    email: emailAdmin,
    nombre: nombreAdmin,
    institucion: nombre,
    url: `https://${subdominio}.rojoplus.com`,
    password: passwordTemp
  })

  return { institucion, usuario }
}

async function crearDatosSemilla(institucionId) {
  // Medios de pago básicos
  await prisma.medioPago.createMany({
    data: [
      { institucionId, codigo: 'EFECTIVO', nombre: 'Efectivo' },
      { institucionId, codigo: 'TRANSFERENCIA', nombre: 'Transferencia' },
      { institucionId, codigo: 'TARJETA', nombre: 'Tarjeta' }
    ]
  })

  // Caja principal
  await prisma.caja.create({
    data: {
      institucionId,
      codigo: 'PRINCIPAL',
      nombre: 'Caja Principal',
      tipo: 'EFECTIVO',
      activo: true
    }
  })

  // Configuraciones por defecto
  await prisma.configuracionInstitucion.createMany({
    data: [
      { institucionId, clave: 'dia_vencimiento_cuota', valor: '10', tipo: 'NUMBER' },
      { institucionId, clave: 'recargo_mora', valor: '5', tipo: 'NUMBER' },
      // ... más configs
    ]
  })

  // Roles básicos
  // Permisos básicos
  // ...
}
```

---

## 💰 FASE 8: Facturación y Límites

### 8.1 Sistema de Facturación

```javascript
// Cron job mensual
async function facturarInstituciones() {
  const instituciones = await prisma.institucion.findMany({
    where: { estado: 'ACTIVO' },
    include: { plan: true }
  })

  for (const inst of instituciones) {
    const facturaAnterior = await obtenerUltimaFactura(inst.id)

    // Calcular monto según plan
    const monto = inst.plan.precioMensual

    // Crear factura
    await prisma.facturaSaaS.create({
      data: {
        institucionId: inst.id,
        periodo: obtenerPeriodoActual(),
        monto,
        estado: 'PENDIENTE'
      }
    })

    // Enviar email con factura
    await enviarFactura(inst)
  }
}
```

### 8.2 Validación de Límites

```javascript
// Middleware para validar límites del plan
export async function checkPlanLimits(req, res, next) {
  const { institucion } = req
  const { plan } = institucion

  // Ejemplo: validar límite de socios antes de crear uno nuevo
  if (req.path === '/socios' && req.method === 'POST') {
    const countSocios = await prisma.socio.count({
      where: { institucionId: institucion.id }
    })

    if (countSocios >= plan.maxSocios) {
      return res.status(403).json({
        error: 'Límite de socios alcanzado',
        limite: plan.maxSocios,
        actual: countSocios,
        mensaje: 'Upgrade su plan para agregar más socios'
      })
    }
  }

  next()
}
```

---

## 📈 FASE 9: Monitoreo y Analytics

### 9.1 Dashboard Super Admin

Métricas a mostrar:
- Total instituciones activas
- Total usuarios en el sistema
- Total socios gestionados
- Ingresos mensuales
- Instituciones por plan
- Uso de almacenamiento
- Requests por institución
- Errores por institución

### 9.2 Health Check por Institución

```javascript
// GET /superadmin/instituciones/:id/health
export async function healthCheck(req, res) {
  const { id } = req.params

  const stats = {
    socios: await prisma.socio.count({ where: { institucionId: id } }),
    usuarios: await prisma.usuario.count({ where: { institucionId: id } }),
    cuotasPendientes: await prisma.cuota.count({
      where: { institucionId: id, estado: 'PENDIENTE' }
    }),
    ingresosMes: await calcularIngresosMes(id),
    ultimoAcceso: await obtenerUltimoAcceso(id),
    almacenamientoUsado: await calcularAlmacenamiento(id)
  }

  res.json(stats)
}
```

---

## 🔄 FASE 10: Migración de Datos Existentes

### 10.1 Plan de Migración Producción

**Pre-requisitos**:
- Backup completo de BD actual
- Ambiente de testing con datos de producción

**Pasos**:

1. **Crear institución default** para datos actuales
2. **Ejecutar migración Prisma** con nuevos modelos
3. **Popular institucionId** en todos los registros existentes
4. **Validar integridad** de datos migrados
5. **Actualizar índices** únicos
6. **Deploy backend** con nuevo código
7. **Deploy frontend** con nuevo código
8. **Monitorear errores** primeras 24hs

### 10.2 Script de Rollback

Preparar script de rollback en caso de falla:
```sql
-- Revertir cambios si algo sale mal
ALTER TABLE socios DROP COLUMN institucion_id;
-- ... más reversiones
```

---

## ⚠️ CONSIDERACIONES Y RIESGOS

### Riesgos Altos
- **Data leakage**: Un bug podría exponer datos entre instituciones
- **Performance**: Agregar institucionId a cada query puede impactar performance
- **Migración**: Riesgo de pérdida de datos en migración

### Mitigaciones
- Tests exhaustivos de aislamiento
- Índices compuestos bien diseñados
- Backup antes de cada cambio
- Feature flags para rollout gradual

---

## 📅 CRONOGRAMA ESTIMADO

### Semana 1-2: Base de Datos
- Diseño final de modelos
- Migraciones en ambiente dev
- Tests de integridad

### Semana 3-4: Backend Core
- Middleware tenant resolution
- Tenant scoping automático
- Refactorización de rutas críticas

### Semana 5-6: Backend Completo
- Refactorizar todas las rutas
- Sistema de autenticación multi-tenant
- Tests de aislamiento

### Semana 7-8: Frontend
- Context de institución
- Componentes dinámicos
- Panel super admin básico

### Semana 9: Infraestructura
- DNS wildcard
- SSL certificados
- Nginx configuración

### Semana 10: Testing y Deploy
- Tests E2E
- Migración de datos
- Deploy gradual
- Monitoreo

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### Base de Datos
- [ ] Crear modelo `Institucion`
- [ ] Crear modelo `Plan`
- [ ] Agregar `institucionId` a 35+ modelos
- [ ] Actualizar índices únicos
- [ ] Script de migración de datos existentes
- [ ] Tests de integridad referencial

### Backend
- [ ] Middleware `resolveTenant`
- [ ] Función `createTenantScopedPrisma`
- [ ] Modificar JWT para incluir `institucionId`
- [ ] Refactorizar 34 archivos de rutas
- [ ] Endpoints CRUD de instituciones (super admin)
- [ ] Sistema de onboarding
- [ ] Validación de límites por plan
- [ ] Tests de aislamiento

### Frontend
- [ ] `InstitucionContext` y provider
- [ ] Modificar `api.js` para tenant
- [ ] Componente `<Logo>` dinámico
- [ ] Panel super admin (6 páginas)
- [ ] Selector de institución (super admin)
- [ ] Login multi-tenant

### Infraestructura
- [ ] DNS wildcard configurado
- [ ] SSL wildcard obtenido
- [ ] Nginx configurado
- [ ] Variables de entorno actualizadas
- [ ] CI/CD actualizado

### Testing
- [ ] Tests unitarios aislamiento
- [ ] Tests integración multi-tenant
- [ ] Tests E2E por subdominio
- [ ] Load testing por institución

### Documentación
- [ ] Guía de onboarding instituciones
- [ ] Documentación API multi-tenant
- [ ] Guía super admin
- [ ] Plan de rollback

---

**FIN DEL PLAN MULTI-TENANT**

Este plan debe revisarse y ajustarse antes de iniciar la implementación.
