# 🚀 RojoPlus Multi-Tenant - Quick Reference Guide

Guía de referencia rápida para desarrolladores y usuarios del sistema RojoPlus/Clubix.

## 📍 Acceso Rápido

### Admin de Club
```
URL:      https://admin.{subdomain}.clubix.com/admin
Login:    admin@club.com / password
Features: Gestión de socios, cuotas, buffet, eventos, etc.
```

### Público (Sitio Web)
```
URL:      https://{subdomain}.clubix.com
Features: Homepage, noticias, actividades, inscripciones
```

### Super-Admin (Gestor de Plataforma)
```
URL:      https://admin.clubix.com/super-admin
Features: CRUD de tenants, aprobaciones, estadísticas
Access:   Solo super-admins
```

### Registro de Club Público
```
URL:      https://clubix.com/registro-club
Features: Formulario multi-paso para nuevos clubs
Result:   Crea club en estado PENDING_APPROVAL
```

## 🔑 Credentials Desarrollo

### Admin Local
```
Email:    admin@sportivo-pilar.com
Password: admin123
Tenant:   sportivo-pilar (default)
```

### Super-Admin Local
```
Email:    superadmin@rojoplus.com
Password: superadmin123
Access:   /super-admin
```

## 📦 Instalación & Setup

### Backend
```bash
cd server
npm install
npm run dev              # http://localhost:3001
```

### Frontend
```bash
cd client
npm install
npm run dev             # http://localhost:5173
```

### Database
```bash
# Crear base de datos
createdb rojoplus

# Seed inicial (si existe)
npm run seed

# Prisma setup
npx prisma db push
npx prisma generate
```

## 🎯 Rutas Principales

### Public Routes
```
/                           Home público
/registro-club              Registro de clubs
/inscripcion-socio          Inscripción de socios
/s/:token                   Portal socio
/c/:token                   Portal comerciante
```

### Admin Routes (requieren autenticación)
```
/admin                      Dashboard
/admin/socios               Gestión de socios
/admin/cuotas               Gestión de cuotas
/admin/buffet               Sistema buffet
/admin/eventos              Eventos
/admin/configuracion        Configuración general
/admin/configuracion/branding    Personalización visual
```

### Super-Admin Routes (requieren super-admin)
```
/super-admin                Dashboard
/super-admin/tenants        Gestión de tenants
/super-admin/tenants/nuevo  Crear tenant
```

## 🔌 API Endpoints Clave

### Branding (Admin)
```
GET    /api/admin/branding                  # Obtener config
PUT    /api/admin/branding/colores          # Actualizar colores
PUT    /api/admin/branding/logo             # Actualizar logo
GET    /api/admin/branding/default-colors   # Colores por defecto
```

### Tenants (Super-Admin)
```
GET    /api/super-admin/tenants             # Listar tenants
POST   /api/super-admin/tenants             # Crear tenant
PUT    /api/super-admin/tenants/:id         # Editar tenant
DELETE /api/super-admin/tenants/:id         # Eliminar
POST   /api/super-admin/tenants/register    # Registro público
POST   /api/super-admin/tenants/:id/approve # Aprobar
POST   /api/super-admin/tenants/:id/reject  # Rechazar
GET    /api/super-admin/stats               # Estadísticas
```

## 🎨 Sistema de Branding

### Acceso
```
URL:  /admin/configuracion/branding
Solo: Admin del club
```

### Qué personalizar
- 16 colores (primarios, secundarios, estados, fondos)
- Logo del club (URL)
- Favicon (URL)
- Los colores se aplican automáticamente en toda la interfaz

### CSS Variables Disponibles
```css
--color-primary          /* Color principal del club */
--color-secondary        /* Color secundario */
--color-success          /* Verde para éxito */
--color-warning          /* Amarillo para advertencia */
--color-error            /* Rojo para error */
--color-bg-primary       /* Fondo principal */
--color-text-primary     /* Texto principal */
/* ... 16 variables totales */
```

## 🏢 Gestión de Tenants

### Estados de Tenant
```
PENDING_APPROVAL    Nuevo, requiere aprobación del super-admin
ACTIVE              En operación
SUSPENDED           Suspendido temporalmente
CANCELLED           Cancelado permanentemente
```

### Super-Admin: Flujo de Aprobación
```
1. Usuario registra club en /registro-club
2. Se crea en estado PENDING_APPROVAL
3. Super-admin ve en dashboard
4. Revisa datos → /super-admin/tenants/:id
5. Aprueba → estado pasa a ACTIVE
6. Club puede acceder a /admin
```

### Crear Club Manualmente
```
1. Super-admin → /super-admin/tenants/nuevo
2. Completa formulario (4 secciones)
3. Guardar
4. Club listo para usar
```

## 🔐 Seguridad

### Tenant Isolation
- Datos de cada club completamente aislados
- Subdomain extrae automáticamente el tenant_id
- Todas las queries filtradas por tenant_id
- Aislamiento garantizado en BD

### Authentication
- Token JWT en localStorage
- Revalidación en cada request
- Logout limpia datos locales

### Validaciones
- Email formato válido
- Contraseña mínimo 6 caracteres
- Subdomain único
- URLs válidas (HTTPS recomendado)

## 📊 Monitoreo

### Health Check
```bash
curl http://localhost:3001/api/health
```

### Logs
```bash
# Backend
npm run dev         # Muestra logs en consola

# Frontend
F12 → Console      # Console del navegador
```

## 🐛 Troubleshooting

### Puerto en uso
```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:3001 | xargs kill -9
```

### Base de datos no existe
```bash
createdb rojoplus
npx prisma db push
```

### Build falla
```bash
# Limpiar caché
rm -rf node_modules package-lock.json dist
npm install
npm run build
```

### Colores no aplican
1. Verificar TenantStyles en App.jsx
2. Hard refresh (Ctrl+Shift+R)
3. Revisar console (F12)

### Subdomain "ya existe"
El subdomain está en uso. Cambiar a otro.

## 📚 Documentación

### Documentos principales
- `docs/MULTITENANT_DEFINITIVO.md` - Arquitectura completa
- `docs/BRANDING.md` - Sistema de colores
- `docs/SUPER_ADMIN_GUIDE.md` - Panel super-admin
- `MULTITENANT_ROADMAP.md` - Fases de implementación

### Scripts útiles
```bash
# Agregar menu item de branding (cuando BD esté disponible)
DATABASE_URL="..." node server/scripts/addBrandingMenuItem.js

# Testear APIs
DATABASE_URL="..." node server/scripts/testBrandingAPI.js
```

## 🎓 Conceptos Clave

### Multi-Tenant
Múltiples clubs usando el mismo sistema, con datos aislados.

### Subdomain Routing
Cada club accede con su subdomain: `club.clubix.com`

### Tenant ID Scoping
Todas las queries automáticamente filtradas por tenant_id

### CSS Variables
16 colores inyectados dinámicamente según el club

## 🚀 Deploy

### Requisitos
- Node.js 18+
- PostgreSQL 12+
- npm 8+

### Pasos básicos
```bash
# 1. Clonar repo
git clone ...

# 2. Instalar dependencias
npm install
cd client && npm install && cd ..

# 3. Variables de entorno
cp server/.env.example server/.env
# Editar server/.env con credentials

# 4. Database setup
npx prisma db push

# 5. Build frontend
cd client && npm run build && cd ..

# 6. Start
npm run prod
```

### Production Checklist
- [ ] Hash de contraseñas implementado
- [ ] Email verification funcionando
- [ ] Rate limiting activado
- [ ] HTTPS configurado
- [ ] Logging & monitoring en place
- [ ] Backups automáticos
- [ ] SSL certificates válidos

## 📞 Contacto & Support

### Issues
1. Revisar documentación
2. Check logs (F12 o terminal)
3. Buscar en código
4. GitHub Issues

### Rate Limits (TODO)
- Registro: 5 por IP/día
- Login fallido: 10 intentos/hora
- API general: 1000 req/hora

## 🎯 Última Actualización

**Fecha**: 18 de abril 2026
**Versión**: 1.0.0
**Estado**: 85.7% completado (6/7 fases)
**Próxima**: SEMANA 7 - Testing & Deployment

---

**Para más detalles**: Ver documentos en `/docs/` carpeta
