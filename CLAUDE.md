# RojoPlus - Sistema de Gestión Club Sportivo Pilar

Sistema integral de gestión para el Club Sportivo Pilar.

## Stack

| Capa | Tecnologías |
|------|-------------|
| Frontend | React + Vite + Tailwind CSS |
| Backend | Node.js + Express + Prisma + Socket.io |
| DB | PostgreSQL |
| Extras | Nodemailer, Puppeteer, MercadoPago, QR |

## Estructura

```
client/src/pages/{admin,socio,comercio,public}/
server/src/{routes,services,jobs}/
server/prisma/schema.prisma  # 35+ modelos
ROADMAP.md                   # Fases técnicas detalladas
```

## Estado Actual

### Módulo Buffet (Fase 39) - MVP COMPLETO

- [x] Modelos Prisma (Mesa, Comanda, ProductoBuffet, SectorBuffet, etc.)
- [x] CRUD Mesas, Zonas, Categorías, Productos
- [x] Dashboard operativo con mapa de mesas
- [x] Toma de comandas (responsive tablet/móvil)
- [x] Pantalla cocina (KDS) con sectores dinámicos
- [x] Cobro y cierre de mesa
- [x] Take Away
- [x] POS Kiosco con código de barras
- [x] Asignación de mozos a mesas
- [x] Socket.io + Notificaciones en tiempo real
- [x] Sistema de tickets (modo preview)
- [x] Menú público (/buffet/menu)

**Archivos clave del buffet:**
- `server/src/routes/buffet.js` - Endpoints completos (~2700 líneas)
- `client/src/pages/admin/buffet/` - Páginas del módulo
- `client/src/contexts/TicketContext.jsx` - Sistema de tickets
- `client/src/contexts/NotificacionBuffetContext.jsx` - Notificaciones

### Preferencias de Notificaciones (Fase 33.7.9) - COMPLETADO

Panel en el Portal del Socio para configurar qué notificaciones recibir:
- Cuotas (próxima a vencer, vencida, morosidad)
- General (inscripción, noticias, push)
- Deportivas (convocatoria, recordatorio partido, cancelación/nuevo entrenamiento)

**Archivos:**
- `server/prisma/schema.prisma` - Campos notificar* en modelo Socio
- `server/src/routes/socio.js` - Endpoints GET/PUT preferencias
- `server/src/services/notificacionService.js` - Respeta preferencias
- `client/src/pages/socio/sections/NotificacionesSocio.jsx` - UI

### Módulos Completados (99%)

Socios, Cuotas, Cobranzas, Portal Socio (PWA), Deportes, Financiero, Débito Automático, Conciliación Bancaria, Sitio Institucional, Usuarios/Permisos, Buffet.

### Pendientes Reales

| Prioridad | Fase | Descripción |
|-----------|------|-------------|
| Media | 31 | Control de Accesos (molinetes) - 10 items |
| Media | 35.10-14 | Payway API - 5 items |
| Baja | 35.15-20 | Débito Bancario (Galicia, Macro, etc.) - 6 items |
| Baja | 18 | Testing formal - 7 items |

## Patrones de Código

### API Response (frontend)
```javascript
const datos = response?.data || response || []
```

### Permisos (frontend)
```javascript
import { tienePermiso, PERMISOS } from '../../services/permisos'
{tienePermiso(PERMISOS.BUFFET_MESAS) && <Button>...</Button>}
```

### Permisos (backend)
```javascript
import { checkPermiso } from '../middleware/auth.js'
router.get('/ruta', authAdmin, checkPermiso('BUFFET_VER'), handler)
```

### Socket.io Notificaciones
```javascript
import { notificarNuevaComanda, notificarItemListo } from '../services/socketService.js'
// Salas: user:{id}, destino:COCINA, destino:BARRA, destino:CAJA, buffet
```

## Modelos Principales

| Módulo | Modelos |
|--------|---------|
| Buffet | Mesa, ZonaBuffet, Comanda, ItemComanda, ProductoBuffet, CategoriaMenu, PedidoTakeAway, NotificacionBuffet |
| Socios | Socio, GrupoFamiliar, Inscripcion |
| Cuotas | Periodo, Cargo, Pago |
| Caja | Caja, MovimientoCaja, CierreCaja |
| Contabilidad | CuentaContable, Asiento |

## Rutas

| URL | Descripción |
|-----|-------------|
| `/admin/buffet/*` | Módulo Buffet |
| `/admin/*` | Panel administración |
| `/s/{token}` | Portal socio |
| `/c/{token}` | Portal comercio |
| `/` | Sitio público |

## Comandos

```bash
cd server && npm run dev
cd client && npm run dev
npx prisma db push && npx prisma generate
```

## Credenciales Dev

```
Admin: admin@rojoplus.com / admin123
DB: localhost:5432 / postgres / Q27G4B98 / rojoplus
```

---
*Última actualización: Febrero 2026 - Implementando notificaciones Buffet*
