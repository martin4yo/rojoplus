# 📅 PLAN DE IMPLEMENTACIÓN MULTI-TENANT - 3 SEMANAS

## 🎯 OBJETIVO
Convertir Clubix en sistema multi-tenant con aislamiento por tenant_id, manteniendo todos los datos de Sportivo Pilar funcionales.

---

## 📊 SEMANA 1: PALETA DE COLORES PARAMETRIZABLE (5 días)

### **DÍA 1: Análisis y Diseño del Sistema de Temas** ✅

**Tareas:**
- [ ] Auditar CSS actual
  - Revisar `client/src/index.css` (Tailwind base)
  - Revisar variables CSS en componentes
  - Listar todos los colores hardcodeados

- [ ] Diseñar modelo de datos
  - Definir estructura JSON de colores (15-20 variables)
  - Decidir: ¿Tabla separada `temas` o campo en `tenants`?
  - **Decisión**: Campo `colores JSONB` en tabla `tenants`

- [ ] Mockup de panel admin
  - Pantalla de configuración de branding
  - Color pickers organizados por categoría
  - Preview en tiempo real

**Entregables:**
- Documento con estructura de colores JSON
- Wireframe del panel de configuración
- Lista de archivos CSS a modificar

---

### **DÍA 2-3: Backend - API de Temas**

**Tareas Día 2:**
- [ ] Actualizar schema Prisma
  ```prisma
  model Tenant {
    // ... campos existentes
    colores Json @default("{}")
    logo_url String?
    favicon_url String?
  }
  ```

- [ ] Migración de base de datos
  ```bash
  npx prisma migrate dev --name add_tenant_branding
  ```

- [ ] Crear servicio de temas
  ```javascript
  // server/src/services/brandingService.js
  - getTenantBranding(tenantId)
  - updateTenantBranding(tenantId, data)
  - uploadLogo(tenantId, file)
  - uploadFavicon(tenantId, file)
  - validateColors(colores) // validar formato hex
  - getDefaultColors() // colores por defecto
  ```

**Tareas Día 3:**
- [ ] Crear endpoints API
  ```javascript
  // server/src/routes/admin/branding.js
  GET    /api/admin/branding           // Obtener branding actual
  PUT    /api/admin/branding/colores   // Actualizar colores
  POST   /api/admin/branding/logo      // Subir logo
  POST   /api/admin/branding/favicon   // Subir favicon
  DELETE /api/admin/branding/logo      // Eliminar logo
  GET    /api/admin/branding/preview   // Preview de colores
  ```

- [ ] Validaciones
  - Colores en formato hex válido
  - Contraste mínimo entre texto/fondo (WCAG)
  - Tamaño máximo de imágenes (2MB logo, 500KB favicon)
  - Formatos aceptados (PNG, JPG, SVG, ICO)

- [ ] Tests básicos
  - Test de validación de colores
  - Test de contraste
  - Test de upload de archivos

**Entregables:**
- API funcional de branding
- Validaciones implementadas
- Tests pasando

---

### **DÍA 4: Frontend - Editor de Colores**

**Tareas:**
- [ ] Crear context de tema
  ```javascript
  // client/src/contexts/TenantThemeContext.jsx
  - Cargar colores del tenant actual
  - Aplicar CSS variables dinámicamente
  - Proveer función para actualizar tema
  ```

- [ ] Hook personalizado
  ```javascript
  // client/src/hooks/useTenantTheme.js
  const { theme, updateTheme, isLoading } = useTenantTheme();
  ```

- [ ] Componente editor de colores
  ```javascript
  // client/src/pages/admin/configuracion/EditorBranding.jsx
  - Secciones: Colores Principales, Secundarios, Estados
  - Color picker por cada variable
  - Preview en tiempo real
  - Botón "Restaurar valores por defecto"
  - Botón "Vista previa" (modal)
  - Botón "Guardar cambios"
  ```

- [ ] Componente upload de logo/favicon
  ```javascript
  // client/src/components/configuracion/LogoUploader.jsx
  - Drag & drop
  - Preview de imagen actual
  - Validación de tamaño/formato
  - Crop/resize opcional
  ```

- [ ] Actualizar Tailwind config
  ```javascript
  // tailwind.config.js
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        'primary-dark': 'var(--color-primary-dark)',
        // ... todas las variables CSS
      }
    }
  }
  ```

**Entregables:**
- Panel de configuración funcional
- Preview en tiempo real
- Tema aplicado globalmente

---

### **DÍA 5: Testing, Polish y Documentación**

**Tareas:**
- [ ] Testing exhaustivo
  - Cambiar cada color y verificar cambios
  - Probar en todas las páginas principales
  - Verificar contraste en modo light/dark
  - Test de accesibilidad (color blind safe)

- [ ] Validación de accesibilidad
  - Ratio de contraste texto/fondo > 4.5:1
  - Alertas si no cumple WCAG AA
  - Sugerencias automáticas de colores alternativos

- [ ] Persistencia y caché
  - Cachear colores en localStorage
  - Aplicar tema antes de cargar app completa
  - Evitar flash de colores por defecto

- [ ] Documentación
  - Guía de usuario: cómo personalizar colores
  - Guía técnica: cómo agregar nuevas variables
  - Screenshot de cada paso

- [ ] Demo
  - Video corto mostrando la funcionalidad
  - Preparar 3 presets de ejemplo (Rojo, Azul, Verde)

**Entregables:**
- Sistema de colores 100% funcional
- Documentación completa
- Demo lista para mostrar

---

## 🏗️ SEMANA 2-4: MULTI-TENANT (3 SEMANAS)

### **SEMANA 2: Base de Datos y Backend Core**

#### **DÍA 1 (Lunes): Diseño y Planificación BD**

**Tareas:**
- [ ] Crear tablas nuevas
  - `tenants`
  - `tenant_usuarios`
  - `tenant_configuracion`

- [ ] Listar TODAS las tablas existentes que necesitan `tenant_id`
  - Script para generar lista automática desde Prisma schema
  - Categorizar: críticas vs no críticas

- [ ] Diseñar migración
  - Orden de ejecución (por dependencias)
  - Plan de rollback si algo falla
  - Estrategia de datos dummy para testing

**Entregables:**
- Script SQL completo de migración
- Diagrama ER actualizado
- Checklist de tablas a migrar

---

#### **DÍA 2 (Martes): Migración de Base de Datos - Parte 1**

**Tareas:**
- [ ] Crear tenant "sportivo-pilar"
  ```sql
  INSERT INTO tenants (nombre, subdomain, slug, estado, activo)
  VALUES ('Sportivo Pilar', 'sportivo-pilar', 'sportivo-pilar', 'ACTIVE', true);
  ```

- [ ] Migrar tablas core (sin foreign keys)
  ```sql
  ALTER TABLE socios ADD COLUMN tenant_id INTEGER;
  ALTER TABLE admins ADD COLUMN tenant_id INTEGER; -- NO, admins son globales
  ALTER TABLE configuracion ADD COLUMN tenant_id INTEGER;
  ```

- [ ] Poblar tenant_id en datos existentes
  ```sql
  UPDATE socios SET tenant_id = 1;  -- 1 = sportivo-pilar
  UPDATE configuracion SET tenant_id = 1;
  ```

- [ ] Verificar integridad
  ```sql
  SELECT COUNT(*) FROM socios WHERE tenant_id IS NULL;
  -- Debe ser 0
  ```

**Entregables:**
- Tablas core migradas
- Datos de Sportivo Pilar con tenant_id=1
- Log de migración sin errores

---

#### **DÍA 3 (Miércoles): Migración BD - Parte 2 + Constraints**

**Tareas:**
- [ ] Migrar tablas relacionales
  - cargos, pagos
  - actividades, inscripciones
  - productos_buffet, comandas
  - accesos, gestiones_cobranza

- [ ] Agregar constraints NOT NULL
  ```sql
  ALTER TABLE socios ALTER COLUMN tenant_id SET NOT NULL;
  ALTER TABLE cargos ALTER COLUMN tenant_id SET NOT NULL;
  ```

- [ ] Crear índices compuestos
  ```sql
  CREATE INDEX idx_socios_tenant_id ON socios(tenant_id, id);
  CREATE INDEX idx_cargos_tenant_id ON cargos(tenant_id, id);
  ```

- [ ] Foreign keys
  ```sql
  ALTER TABLE socios
    ADD CONSTRAINT fk_socios_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  ```

**Entregables:**
- Todas las tablas con tenant_id
- Constraints aplicados
- Índices creados
- 0 errores de integridad referencial

---

#### **DÍA 4 (Jueves): Prisma Schema + Middleware**

**Tareas:**
- [ ] Actualizar Prisma schema
  ```prisma
  model Socio {
    id        Int     @id @default(autoincrement())
    tenant_id Int
    tenant    Tenant  @relation(fields: [tenant_id], references: [id])
    // ... resto de campos

    @@index([tenant_id, id])
  }
  ```

- [ ] Generar cliente Prisma
  ```bash
  npx prisma generate
  ```

- [ ] Crear middleware de tenant
  ```javascript
  // server/src/middleware/prisma/tenantMiddleware.js
  export function createTenantMiddleware() {
    return async (params, next) => {
      // Inyectar tenant_id automáticamente
      // Filtrar por tenant_id en queries
    };
  }
  ```

- [ ] Integrar middleware
  ```javascript
  // server/src/lib/prisma.js
  import { createTenantMiddleware } from '../middleware/prisma/tenantMiddleware.js';

  prisma.$use(createTenantMiddleware());
  ```

- [ ] Tests de middleware
  - Verificar inyección automática de tenant_id
  - Verificar filtrado automático
  - Verificar que no se cruzan datos entre tenants

**Entregables:**
- Prisma schema actualizado
- Middleware funcionando
- Tests de aislamiento pasando

---

#### **DÍA 5 (Viernes): Express Middleware + Extracción de Tenant**

**Tareas:**
- [ ] Middleware de extracción de tenant
  ```javascript
  // server/src/middleware/extractTenant.js
  export async function extractTenant(req, res, next) {
    const subdomain = extractSubdomainFromHost(req.get('host'));
    const tenant = await getTenantBySubdomain(subdomain);

    if (!tenant || !tenant.activo) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    req.tenant = tenant;
    req.tenantId = tenant.id;
    next();
  }
  ```

- [ ] Utilidad de subdomain
  ```javascript
  function extractSubdomainFromHost(host) {
    // Manejar desarrollo local
    if (host.includes('localhost')) {
      // Patrón: tenant.localhost:3000
      const match = host.match(/^([^.]+)\.localhost/);
      return match ? match[1] : null;
    }

    // Producción: tenant.clubix.com
    const parts = host.split('.');
    if (parts.length > 2 && parts[0] !== 'www') {
      return parts[0];
    }

    return null;
  }
  ```

- [ ] Aplicar middleware globalmente
  ```javascript
  // server/src/index.js
  import { extractTenant } from './middleware/extractTenant.js';

  // Aplicar a rutas que requieren tenant
  app.use('/api/admin/*', extractTenant);
  app.use('/api/socio/*', extractTenant);
  app.use('/api/buffet/*', extractTenant);
  ```

- [ ] Actualizar autenticación
  ```javascript
  // Incluir tenant_id en JWT
  const token = jwt.sign({
    userId: user.id,
    tenantId: req.tenantId,
    email: user.email
  }, JWT_SECRET);
  ```

**Entregables:**
- Middleware de tenant funcionando
- Todas las rutas protegidas con tenant
- JWT incluye tenant_id

---

### **SEMANA 3: Frontend Multi-Tenant + Onboarding**

#### **DÍA 1 (Lunes): Context y Hook de Tenant**

**Tareas:**
- [ ] Context de tenant
  ```javascript
  // client/src/contexts/TenantContext.jsx
  export const TenantContext = createContext();

  export function TenantProvider({ children }) {
    const [tenant, setTenant] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      fetchCurrentTenant();
    }, []);

    async function fetchCurrentTenant() {
      const response = await api.get('/api/tenant/current');
      setTenant(response.data);
      setLoading(false);
    }

    return (
      <TenantContext.Provider value={{ tenant, loading }}>
        {children}
      </TenantContext.Provider>
    );
  }
  ```

- [ ] Hook personalizado
  ```javascript
  // client/src/hooks/useTenant.js
  export function useTenant() {
    const context = useContext(TenantContext);
    if (!context) {
      throw new Error('useTenant must be used within TenantProvider');
    }
    return context;
  }
  ```

- [ ] Integrar en App
  ```javascript
  // client/src/App.jsx
  <TenantProvider>
    <TenantThemeProvider>
      <Router>
        {/* rutas */}
      </Router>
    </TenantThemeProvider>
  </TenantProvider>
  ```

- [ ] Endpoint backend
  ```javascript
  // server/src/routes/tenant.js
  router.get('/current', extractTenant, async (req, res) => {
    res.json(req.tenant);
  });
  ```

**Entregables:**
- Context de tenant global
- Info de tenant disponible en toda la app
- Logo y nombre del tenant en header

---

#### **DÍA 2 (Martes): Actualizar Header/Footer con Branding**

**Tareas:**
- [ ] Header dinámico
  ```javascript
  // client/src/components/Header.jsx
  const { tenant } = useTenant();

  return (
    <header>
      <img src={tenant.logo_url || '/default-logo.png'} />
      <span>{tenant.nombre}</span>
    </header>
  );
  ```

- [ ] Favicon dinámico
  ```javascript
  // client/src/hooks/useDynamicFavicon.js
  useEffect(() => {
    if (tenant?.favicon_url) {
      const link = document.querySelector("link[rel~='icon']");
      if (link) {
        link.href = tenant.favicon_url;
      }
    }
  }, [tenant]);
  ```

- [ ] Título de página dinámico
  ```javascript
  useEffect(() => {
    document.title = `${tenant.nombre} - Admin`;
  }, [tenant]);
  ```

- [ ] Footer con datos de contacto
  ```javascript
  <footer>
    <p>{tenant.nombre}</p>
    <p>{tenant.direccion}, {tenant.ciudad}</p>
    <p>{tenant.telefono} | {tenant.email}</p>
  </footer>
  ```

**Entregables:**
- UI completamente personalizada por tenant
- Logo, favicon, nombre dinámicos
- Datos de contacto correctos

---

#### **DÍA 3 (Miércoles): Panel de Registro de Nuevo Club**

**Tareas:**
- [ ] Página de registro público
  ```javascript
  // client/src/pages/public/RegistroClub.jsx
  - Formulario multi-paso:
    1. Datos del club
    2. Subdomain (verificar disponibilidad)
    3. Datos del admin
    4. Confirmación
  ```

- [ ] Validación de subdomain en tiempo real
  ```javascript
  async function checkSubdomainAvailability(subdomain) {
    const response = await api.get(`/api/public/check-subdomain/${subdomain}`);
    return response.data.available;
  }
  ```

- [ ] API de registro
  ```javascript
  // server/src/routes/public/registro.js
  POST /api/public/registro-club
  {
    club: { nombre, subdomain, email, telefono, ... },
    admin: { nombre, email, password }
  }

  // Crea tenant + admin + relación
  // Estado inicial: PENDING_APPROVAL
  ```

- [ ] Email de confirmación
  - Al registrante: "Recibimos tu solicitud"
  - Al super-admin: "Nuevo club pendiente"

**Entregables:**
- Página de registro funcional
- Flujo completo de onboarding
- Emails enviados correctamente

---

#### **DÍA 4 (Jueves): Panel Super-Admin**

**Tareas:**
- [ ] Ruta super-admin
  ```javascript
  // Opción 1: admin.clubix.com
  // Opción 2: super.clubix.com
  // Opción 3: clubix.com/super-admin
  ```

- [ ] Middleware de super-admin
  ```javascript
  export function requireSuperAdmin(req, res, next) {
    if (req.user.rol !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  }
  ```

- [ ] Panel de tenants
  ```javascript
  // client/src/pages/super-admin/GestionTenants.jsx
  - Lista de todos los tenants
  - Estados: PENDING_APPROVAL, ACTIVE, SUSPENDED
  - Filtros por estado
  - Acciones: Aprobar, Rechazar, Suspender, Activar
  ```

- [ ] Endpoints
  ```javascript
  GET    /api/super-admin/tenants
  POST   /api/super-admin/tenants/:id/approve
  POST   /api/super-admin/tenants/:id/reject
  POST   /api/super-admin/tenants/:id/suspend
  DELETE /api/super-admin/tenants/:id
  ```

- [ ] Vista detalle de tenant
  - Datos completos
  - Estadísticas (socios, cargos, etc)
  - Log de actividad
  - Botón "Acceder como admin" (debug mode)

**Entregables:**
- Panel super-admin funcional
- Gestión completa de tenants
- Aprobación/rechazo de nuevos clubes

---

#### **DÍA 5 (Viernes): Sitio Público Simple por Tenant**

**Tareas:**
- [ ] Página pública de tenant
  ```javascript
  // client/src/pages/public/TenantHome.jsx
  - Hero con logo y nombre del club
  - Descripción
  - Horarios de atención
  - Ubicación (mapa)
  - Formulario de contacto
  - Links a redes sociales
  ```

- [ ] Routing público
  ```javascript
  // Raíz del subdomain = sitio público
  sportivo-pilar.clubix.com/          → TenantHome
  sportivo-pilar.clubix.com/admin     → Login Admin
  sportivo-pilar.clubix.com/s/token   → Portal Socio
  ```

- [ ] API de configuración pública
  ```javascript
  GET /api/public/tenant-info
  // Info pública del tenant (sin autenticación)
  ```

- [ ] Formulario de contacto
  ```javascript
  POST /api/public/contacto
  // Envía email al club
  ```

**Entregables:**
- Sitio público básico funcional
- Cada tenant tiene su landing
- Formulario de contacto operativo

---

### **SEMANA 4: Testing, Migración y Deploy**

#### **DÍA 1 (Lunes): Testing de Aislamiento**

**Tareas:**
- [ ] Crear tenant "demo" para testing
- [ ] Crear datos de prueba en ambos tenants
- [ ] Tests de aislamiento:
  - Verificar que queries de tenant A no devuelven datos de B
  - Intentar acceder a recursos de otro tenant (debe fallar)
  - Verificar JWTs no cruzan tenants

- [ ] Tests de performance:
  - Queries con tenant_id están usando índices
  - EXPLAIN ANALYZE de queries críticas
  - Benchmark antes/después de multi-tenant

**Entregables:**
- Suite de tests de aislamiento
- Reporte de performance
- 0 fugas de datos entre tenants

---

#### **DÍA 2 (Martes): Duplicar Sportivo Pilar → Demo**

**Tareas:**
- [ ] Script de duplicación
  ```javascript
  // server/src/scripts/duplicateTenant.js
  async function duplicateTenant(sourceTenantId, newTenantData) {
    // 1. Crear nuevo tenant
    // 2. Copiar todos los datos:
    //    - Socios (anonimizar emails/docs)
    //    - Actividades
    //    - Productos buffet
    //    - Configuración
    //    - Menu items
    // 3. Ajustar referencias (foreign keys)
    // 4. Crear admin inicial para el nuevo tenant
  }
  ```

- [ ] Ejecutar duplicación
  ```bash
  node server/src/scripts/duplicateTenant.js \
    --source=1 \
    --target-name="Club Demo" \
    --target-subdomain="demo"
  ```

- [ ] Validar datos duplicados
  - Mismo número de socios
  - Mismo número de actividades
  - Configuración copiada correctamente

**Entregables:**
- Tenant "demo" con datos completos
- Datos anonimizados
- Admin de demo funcional

---

#### **DÍA 3 (Miércoles): Configuración DNS y Subdominios**

**Tareas:**
- [ ] Configurar wildcard DNS
  ```
  *.clubix.com → IP del servidor
  ```

- [ ] Nginx config
  ```nginx
  server {
    listen 80;
    server_name *.clubix.com;

    location / {
      proxy_pass http://localhost:3000;
      proxy_set_header Host $host;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
  }
  ```

- [ ] SSL wildcard certificate
  ```bash
  certbot --nginx -d clubix.com -d *.clubix.com
  ```

- [ ] Testing de subdominios
  - sportivo-pilar.clubix.com
  - demo.clubix.com
  - test.clubix.com

**Entregables:**
- Wildcard DNS configurado
- SSL funcionando
- Subdominios accesibles

---

#### **DÍA 4 (Jueves): Documentación y Capacitación**

**Tareas:**
- [ ] Documentación técnica
  - Arquitectura multi-tenant
  - Guía de creación de nuevo tenant
  - Troubleshooting común

- [ ] Documentación de usuario
  - Cómo registrar un club
  - Cómo personalizar branding
  - Cómo administrar usuarios

- [ ] Video tutoriales
  - Demo de registro de club
  - Demo de personalización
  - Demo de panel super-admin

- [ ] Guía de migración futura
  - Cómo mover a schemas separados
  - Cómo optimizar queries
  - Cómo escalar

**Entregables:**
- Docs completas en /docs
- Videos grabados
- README actualizado

---

#### **DÍA 5 (Viernes): Deploy y Verificación Final**

**Tareas:**
- [ ] Backup completo de BD
- [ ] Deploy a producción
  - Ejecutar migraciones
  - Reiniciar servicios
  - Verificar logs

- [ ] Smoke tests en producción
  - Login en sportivo-pilar
  - Crear registro de prueba
  - Aprobar desde super-admin
  - Login en nuevo tenant

- [ ] Monitoreo
  - Configurar alertas
  - Dashboard de métricas por tenant
  - Logs centralizados

- [ ] Rollback plan
  - Documentar pasos de rollback
  - Tener snapshot de BD pre-migración

**Entregables:**
- Sistema multi-tenant en producción
- Monitoreo activo
- Plan de rollback documentado

---

## 📈 RESUMEN DE ENTREGABLES FINALES

### Semana 1: Colores
✅ Panel de personalización de colores
✅ Tema aplicado en tiempo real
✅ Logo y favicon personalizables

### Semana 2-4: Multi-tenant
✅ Base de datos multi-tenant
✅ Aislamiento completo por tenant_id
✅ Onboarding de nuevos clubes
✅ Panel super-admin
✅ Sitio público por tenant
✅ Subdominios funcionando
✅ 2 tenants operativos: sportivo-pilar + demo

---

## ⚠️ RIESGOS Y MITIGACIONES

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Pérdida de datos en migración | Media | Alto | Backups antes de cada paso |
| Performance degradada | Alta | Medio | Índices compuestos, EXPLAIN queries |
| Fugas entre tenants | Baja | Crítico | Tests exhaustivos de aislamiento |
| DNS/SSL problemas | Media | Alto | Configurar en staging primero |
| Migración toma más tiempo | Alta | Medio | Buffer de 2 días extra |

---

## ✅ CRITERIOS DE ÉXITO

- [ ] 0 cruces de datos entre tenants
- [ ] Performance igual o mejor que single-tenant
- [ ] Nuevo tenant se puede crear en < 5 minutos
- [ ] Panel de colores intuitivo y funcional
- [ ] Documentación completa y clara
- [ ] Sportivo Pilar funciona 100% igual que antes
- [ ] Demo tenant con datos realistas

---

## 🚀 PRÓXIMOS PASOS (POST-IMPLEMENTACIÓN)

1. **Sistema de facturación** (2 semanas)
   - Tabla de suscripciones
   - Integración con gateway de pago
   - Límites por plan

2. **Analytics por tenant** (1 semana)
   - Dashboard de métricas
   - Reportes comparativos

3. **Optimizaciones** (ongoing)
   - Migrar a schemas separados si escala
   - CDN para assets estáticos
   - Cache agresivo de branding
