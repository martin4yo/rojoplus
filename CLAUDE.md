# RojoPlus - Sistema de Gestión Club Sportivo Pilar

## Stack
Frontend: React + Vite + Tailwind | Backend: Node.js + Express + Prisma + Socket.io | DB: PostgreSQL

## Estructura
```
client/src/pages/{admin,socio,comercio,public}/
server/src/{routes,services,jobs}/
server/prisma/schema.prisma  # 35+ modelos
ROADMAP.md                   # Fases técnicas
```

## Estado: 99% Completo

**Completados:** Socios (con Cuenta Corriente), Cuotas, Cobranzas (con Adjuntos), Portal Socio (PWA), Deportes, Financiero, Débito Automático, Conciliación Bancaria, Sitio Institucional, Permisos, Buffet MVP.

**Pendientes:** Control Accesos (31), Payway (35.10-14), Débito Bancario (35.15-20), Testing (18).

## Buffet MVP - Archivos Clave
- `server/src/routes/buffet.js` (~2700 líneas)
- `client/src/pages/admin/buffet/` - Dashboard, Mesas, Comandas, Cocina, POS, TakeAway
- Contextos: `TicketContext.jsx`, `NotificacionBuffetContext.jsx`

## Patrones

```javascript
// API Response (frontend)
const datos = response?.data || response || []

// Permisos frontend
import { tienePermiso, PERMISOS } from '../../services/permisos'
{tienePermiso(PERMISOS.XXX) && <Button />}

// Permisos backend
router.get('/ruta', authAdmin, checkPermiso('CODIGO'), handler)

// Socket.io - Salas: user:{id}, destino:COCINA, destino:BARRA, buffet
import { notificarNuevaComanda } from '../services/socketService.js'
```

## Modelos Principales
Buffet: Mesa, Comanda, ItemComanda, ProductoBuffet, ZonaBuffet
Socios: Socio, GrupoFamiliar, Inscripcion, Cargo, Pago
Finanzas: Caja, MovimientoCaja, CuentaContable, Asiento

## Rutas/Endpoints Clave
`/admin/buffet/*` Buffet | `/admin/*` Admin | `/s/{token}` Portal socio | `/` Público
`GET /admin/socios/:id/cuenta-corriente?incluirFamilia=true` - Cuenta corriente admin
`GET /socio/:token/cuenta-corriente` - Cuenta corriente portal socio

## Dev
```bash
cd server && npm run dev   # Backend :3000
cd client && npm run dev   # Frontend :5173
npx prisma db push && npx prisma generate
```
Admin: admin@rojoplus.com / admin123 | DB: postgres:Q27G4B98@localhost/rojoplus
