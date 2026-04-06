# Estado del Proyecto RojoPlus / Clubix
**Última actualización:** 31 de marzo 2026

---

## Resumen Ejecutivo

Sistema de gestión integral para clubes deportivos, con arquitectura multi-tenant (Clubix).
Stack: React + Vite + Tailwind | Node.js + Express + Prisma | PostgreSQL + Socket.io

---

## ✅ Módulos COMPLETADOS (no volver sobre esto)

### Núcleo del Sistema
- [x] **Socios** — CRUD completo, grupos familiares, cuenta corriente
- [x] **Cuotas** — Generación, pagos, bonificaciones, mora
- [x] **Cobranzas** — Con adjuntos, historial, pagos manuales/informados
- [x] **Recupero de morosos** — Acciones, historial, seguimiento
- [x] **Comunicaciones** — Campañas, envíos, historial
- [x] **Portal Socio (PWA)** — Magic Link, autogestión, pagos MercadoPago, chat con entrenadores
- [x] **Deportes** — Espacios, entrenamientos, asistencia, partidos, convocatorias, estadísticas, pasaje de categoría
- [x] **Financiero** — Caja, movimientos, ingresos/egresos, plan de cuentas, asientos contables, libro mayor, presupuesto anual
- [x] **Tesorería** — Cajas, transferencias, conciliación bancaria (OFX/CSV/TXT), ECheqs
- [x] **Stock** — Productos, variantes, fotos, movimientos, alertas
- [x] **Liquidaciones de Sueldos** — Personal, conceptos, liquidación mensual, pago masivo
- [x] **Débito Automático (Prisma)** — Generación archivos TXT, importación respuestas, 50+ códigos rechazo
- [x] **Conciliación Bancaria** — Match automático, manual, multi-formato
- [x] **Sitio Institucional** — Home, noticias, actividades, autoridades, contacto, inscripción pública
- [x] **Control de Accesos** — Molinetes, QR, registro entrada/salida, habilitaciones temporales
- [x] **Buffet MVP** — Mesas, comandas, cocina (KDS), kiosco, take away, impresoras térmicas ESC/POS, tickets fiscales/no fiscales
- [x] **Centro de Costos** — Modelo, reportes por área, dashboard KPIs
- [x] **Eventos** — CRUD, categorías de entrada, venta, validación ingresos
- [x] **Facturación Electrónica** — Emisión, CAE, QR, tipos de factura A/B/C
- [x] **Usuarios, Roles y Permisos** — 30+ permisos, cache, middleware checkPermiso
- [x] **Branding / Personalización Visual** — 16 variables CSS por tenant, logo, favicon
- [x] **Multi-Tenant Core** — Subdomain routing, Prisma $extends, tenant isolation
- [x] **Super-Admin Panel** — CRUD tenants, aprobación/rechazo/suspensión, estadísticas
- [x] **Registro Público de Club** — Formulario multi-paso, PENDING_APPROVAL
- [x] **Sistema de Menú Dinámico** — Menú desde BD, filtrado por rol
- [x] **Templates de Email y PDF** — CRUD desde admin, preview, envío de prueba
- [x] **Chat IA** — Asistente conversacional con contexto del club
- [x] **Notificaciones Push** — Web push, suscripciones, cron jobs automáticos
- [x] **Importación Excel** — Socios, kiosco, actividades
- [x] **Reserva de Espacios** — Canchas/salones/instalaciones, disponibilidad por slots, precios socio/no-socio, MercadoPago, reembolso automático, reservas recurrentes, portal socio, sitio público, calendario admin, config por espacio, emails automáticos, cron jobs

### Bugs corregidos en sesión actual (16/03/2026)
- [x] `req.req.db` → `req.db` (564 instancias en 28 archivos de rutas)
- [x] Fallback `req.db = prisma` para rutas sin tenant middleware
- [x] Login superadmin en localhost sin subdomain (`/api/admin/login` bypasea extractTenant)
- [x] `mis-permisos` y `menu` también bypasean extractTenant (TENANT_FREE_ROUTES)

---

## ⏳ PENDIENTE — Lo que falta implementar

### 1. Payway — Débito Automático vía API REST
**Referencia:** ROADMAP.md FASE 35 tareas 35.10–35.14
**Estado:** Sin iniciar
**Archivos existentes relacionados:** `server/src/routes/debitoAutomatico.js`

- [ ] 35.10 Configuración de credenciales Payway en tabla `Configuracion`
- [ ] 35.11 Integración con API REST de Payway (autenticación OAuth2)
- [ ] 35.12 Generación de débitos vía API (endpoint `/debito/payway/generar`)
- [ ] 35.13 Webhook para recibir respuestas Payway (`/debito/payway/webhook`)
- [ ] 35.14 Procesamiento de archivo de respuesta alternativo

### 2. Débito Directo Bancario
**Referencia:** ROADMAP.md FASE 35 tareas 35.15–35.20
**Estado:** Sin iniciar
**Contexto:** Actualmente solo Prisma (VISA/Mastercard). Bancos tienen formatos propios.

- [ ] 35.15 Formato Banco Galicia (TXT posicional, specs en `/docs/Debitos/`)
- [ ] 35.16 Formato Banco Macro
- [ ] 35.17 Formato Banco Santander
- [ ] 35.18 Formato Banco Provincia de Buenos Aires
- [ ] 35.19 Importación de respuestas bancarias por banco
- [ ] 35.20 UI: selector de banco en pantalla de generación

### 3. Testing Integral
**Referencia:** ROADMAP.md Tarea #18
**Estado:** Sin iniciar. Tests manuales hechos, automatizados = 0.

- [ ] Tests unitarios backend (Vitest/Jest)
- [ ] Tests de integración API + DB
- [ ] Tests E2E (Cypress/Playwright)
- [ ] Tests de aislamiento multi-tenant
- [ ] Tests de carga
- [ ] Tests de seguridad

### 4. Multi-Tenant FASE 7 — Deploy & Infraestructura
**Referencia:** `MULTITENANT_ROADMAP.md` FASE 7
**Estado:** 0% — la arquitectura está pero no hay infraestructura productiva

#### Qué implica cada tarea:
- **Docker + Docker Compose** — Empaquetar en contenedores (app Node + PostgreSQL + Redis). Permite deploy en cualquier servidor sin instalar dependencias manualmente. Archivo `docker-compose.yml` con los 3 servicios.
- **CI/CD (GitHub Actions)** — Pipeline automático: push a `main` → tests → build imagen Docker → deploy al servidor. Sin esto cada deploy es manual y riesgoso.
- **Migraciones automáticas por tenant** — Reemplazar `prisma db push` manual por migraciones versionadas (`prisma migrate deploy`) que se corren sin downtime ni pérdida de datos.
- **Logging (Winston/Morgan)** — Los `console.log` no son suficientes en producción. Winston: logs en archivos con rotación, niveles (error/warn/info), envío a servicios externos (Datadog, Papertrail).
- **Error tracking (Sentry)** — Captura errores en producción en tiempo real: stack trace completo, contexto del usuario que lo disparó, alertas por email/Slack. Sin esto los errores son invisibles.
- **Redis** — Cache de sesiones/permisos (hoy se consulta la DB en cada request) + rate-limiting distribuido entre múltiples instancias.
- **Prometheus/Grafana** — Métricas en tiempo real: requests/segundo, latencia P95/P99, uso CPU/RAM, errores por endpoint. Grafana los muestra en dashboards.
- **Swagger** — Documentación automática de la API REST. Útil para integración con terceros y debugging.

#### Checklist:
- [ ] Dockerfile + Docker Compose (App + DB + Redis)
- [ ] CI/CD Pipeline (GitHub Actions)
- [ ] Migraciones automáticas (`prisma migrate deploy`)
- [ ] Logging centralizado (Winston/Morgan)
- [ ] Error tracking (Sentry)
- [ ] Métricas (Prometheus/Grafana)
- [ ] Performance: índices DB, caching Redis, lazy loading
- [ ] Documentación API (Swagger)
- [ ] README actualizado con guía de deploy

### 5. Seguridad — Producción Ready
**Estado:** Parcialmente implementado.

- [x] Hash de contraseñas con bcrypt en `/register` (`bcrypt.hash(password, 12)`) — **RESUELTO 31/03/2026**
- [ ] Email verification para nuevos admins/tenants
- [ ] Rate limiting en endpoints públicos (registro, login) — `express-rate-limit`
- [ ] 2FA para super-admin
- [ ] Audit log de cambios sensibles
- [ ] HTTPS obligatorio en producción

### 6. Reportes Centro de Costos — Pendiente menor
**Referencia:** ROADMAP.md tarea 32.10 (marcada como completa pero con deuda)
**Contexto:** La lógica de asignación automática de centro de costo en cobranzas necesita revisión

- [ ] Verificar que cobranza de cuotas asigna centro según actividad inscripta

### 7. Mejoras UX identificadas (opcionales / bajo demanda)
- [ ] Exportación de datos de tenants (Super-Admin)
- [ ] Bulk actions en lista de tenants
- [ ] Dark mode
- [ ] Avatar/Logo del club en tabla de tenants
- [ ] Búsqueda avanzada en tenants
- [ ] Dashboard de uso por tenant (métricas de actividad)

---

## 🔧 Estado Multi-Tenant (Arquitectura)

| Fase | Descripción | Estado |
|------|-------------|--------|
| 1 | Modelo de Datos (Tenant, TenantUsuario, TenantConfig) | ✅ 100% |
| 2 | Backend Core (extractTenant, tenantPrisma) | ✅ 100% |
| 3 | Route Refactoring (req.db en 44 archivos) | ✅ 100% |
| 4 | Frontend Multi-Tenant (TenantContext, CSS vars) | ✅ 100% |
| 5 | Branding System (16 colores, logo, favicon) | ✅ 100% |
| 6 | Super-Admin Panel + Registro Público | ✅ 100% |
| 7 | Testing & Deployment | ⏳ 0% |

### Bugs multi-tenant corregidos hoy (16/03/2026)
- Login endpoint ahora bypasea `extractTenant` — superadmin puede acceder desde localhost
- `TENANT_FREE_ROUTES = ['/api/admin/login', '/api/admin/mis-permisos', '/api/admin/menu']`
- Estas 3 rutas usan `prisma` global directamente (no requieren subdomain)

---

## 📁 Archivos Clave

### Backend
```
server/src/index.js                    # Entry point, middleware setup, TENANT_FREE_ROUTES
server/src/middleware/extractTenant.js # Tenant extraction middleware
server/src/lib/tenantPrisma.js         # Prisma $extends para scoping
server/src/routes/admin/auth.js        # Login (usa req.prisma global)
server/src/routes/usuarios.js          # mis-permisos (usa prisma global)
server/src/routes/menu.js              # Menú dinámico por rol
server/src/routes/super-admin/         # CRUD tenants, stats, register
server/src/routes/admin/branding.js    # 6 endpoints de branding
server/prisma/schema.prisma            # 135+ modelos
```

### Frontend
```
client/src/contexts/TenantContext.jsx  # Estado global del tenant
client/src/components/TenantStyles.jsx # Inyección CSS variables
client/src/components/AdminLayout.jsx  # Layout admin con menú dinámico
client/src/components/SuperAdminLayout.jsx
client/src/pages/super-admin/          # Dashboard, TenantsList, TenantForm, TenantDetail
client/src/pages/registro/RegistroClub.jsx
client/src/pages/admin/Login.jsx       # Login → /api/admin/login
client/src/services/permisos.js        # tienePermiso(), esAdmin(), cargarPermisos()
client/src/services/api.js             # API client con auth header
```

---

## 🏗️ Arquitectura Multi-Tenant

```
Request → extractSubdomain(host) → tenant.sportivo-pilar.clubix.com
                                         ↓
                               prisma.tenant.findUnique({ subdomain })
                                         ↓
                               req.tenant = tenant
                               req.tenantId = tenant.id
                                         ↓
                               createTenantPrisma(tenantId) → Prisma $extends
                                         ↓
                               req.db = scopedPrisma  (WHERE tenantId = X automático)
```

### Rutas sin tenant (TENANT_FREE_ROUTES)
```
POST /api/admin/login       → auth global, usa req.prisma
GET  /api/admin/mis-permisos → permisos del usuario, usa prisma global
GET  /api/admin/menu         → menú por rol, usa prisma global
GET  /api/auth/*             → alias de login
GET  /api/super-admin/*      → sin tenant, requireSuperAdmin middleware
```

---

## 🔑 Credenciales de Desarrollo

```
Admin tenant:    admin@sportivo-pilar.com / admin123  (tenant: sportivo-pilar)
Admin global:    admin@rojoplus.com / admin123
Super-Admin:     superadmin@rojoplus.com / superadmin123
DB:              postgresql://postgres:Q27G4B98@localhost:5432/rojoplus
Backend:         http://localhost:3000
Frontend:        http://localhost:5173
```

---

## 🚀 Próximos pasos recomendados (por prioridad)

1. **Rate limiting** — `express-rate-limit` en login y register (rápido, crítico)
2. **Payway** — si el club lo requiere pronto (35.10–35.14)
3. **Deploy** — Docker + CI/CD para llevar a producción (FASE 7 multi-tenant)
4. **Email verification** — para nuevos tenants registrados
