# RojoPlus - Sistema de Gestión Club Sportivo Pilar

## Stack
Frontend: React + Vite + Tailwind | Backend: Node.js + Express + Prisma + Socket.io | DB: PostgreSQL

## Estructura
```
client/src/pages/{admin,socio,comercio,public}/
server/src/{routes,services,jobs}/
server/prisma/schema.prisma  # 135+ modelos
docs/ROADMAP.md              # Fases técnicas (39 fases)
ESTADO_PROYECTO.md           # ⭐ Estado actualizado con pendientes detallados
```

## Estado: Multi-Tenant Clubix activo

**Completados (100%):** Socios, Cuotas, Cobranzas, Recupero, Comunicaciones, Portal Socio (PWA), Deportes, Financiero, Débito Automático (Prisma), Conciliación Bancaria, Sitio Institucional, Permisos/Roles, Buffet MVP, Control de Accesos, Centro de Costos, Eventos, Facturación Electrónica, Branding, Multi-Tenant (Fases 1-6), Super-Admin Panel, Registro Público Club.

**Pendientes:** Payway (35.10-14), Débito Bancario por banco (35.15-20), Testing automatizado, Deploy (Multi-Tenant Fase 7), bcrypt en `/register`.

## Multi-Tenant — Rutas sin tenant (TENANT_FREE_ROUTES)
```javascript
// server/src/index.js — estas rutas bypasean extractTenant:
const TENANT_FREE_ROUTES = ['/api/admin/login', '/api/admin/mis-permisos', '/api/admin/menu']
// Usan prisma global directamente (no req.db)
// Super-admin usa estas rutas desde localhost sin subdomain
```

## Buffet MVP - Archivos Clave
- `server/src/routes/buffet/` - Rutas divididas: comandas.js, takeaway.js, tickets.js, impresoras.js
- `client/src/pages/admin/buffet/` - Dashboard, Mesas, Comandas, Cocina, Kiosco, TakeAway
- `client/src/components/buffet/` - GestionPedido.jsx (universal mesa/takeaway), CalculadoraVuelto, ClienteSelector
- Contextos: `TicketContext.jsx`, `NotificacionBuffetContext.jsx`

## Sistema de Puntos de Venta

### Tipos de Venta
| Tipo | Página | Productos | Impresora Config |
|------|--------|-----------|------------------|
| Buffet (Mesas) | BuffetMesas → GestionPedido | tiposVenta: ['BUFFET'] | BUFFET_IMPRESORA_TICKETS |
| Kiosco | BuffetKiosco | tiposVenta: ['KIOSCO'] | BUFFET_IMPRESORA_KIOSCO |
| TakeAway | BuffetTakeAway → GestionPedido | tiposVenta: ['BUFFET'] | BUFFET_IMPRESORA_TAKEAWAY |

### Flujo de Tickets al Cobrar
```
┌─────────────────────────────────────────────────────────────────┐
│                         COBRO                                    │
├─────────────────────────────────────────────────────────────────┤
│  emitirFactura = true?                                          │
│    → Backend genera ticket FISCAL con QR (renderTicketFiscal)   │
│    → Devuelve ticket + comprobante con CAE                      │
│                                                                  │
│  emitirFactura = false?                                         │
│    → Backend genera ticket NO FISCAL (renderTicketNoFiscal)     │
│    → Devuelve ticket sin CAE                                    │
├─────────────────────────────────────────────────────────────────┤
│  Frontend recibe ticket en base64                               │
│    → Llama POST /admin/buffet/imprimir-ticket-directo           │
│    → tipoTicket: 'FISCAL' | 'CUENTA' | 'TAKEAWAY' | 'KIOSCO'    │
└─────────────────────────────────────────────────────────────────┘
```

### Comandas de Cocina/Barra
- Buffet: `generarComandaESCPOS()` en comandas.js
- TakeAway: `generarComandaTakeAwayESCPOS()` en takeaway.js (mismo formato)
- Formato: `*** SECTOR ***`, número grande, items en mayúsculas, observaciones con `>>`

### Archivos de Impresión
```
server/src/services/ticketService.js     # Generación ESC/POS
  - renderTicketFiscal()                 # Con CAE y QR
  - renderTicketNoFiscal()               # Sin factura
  - renderTicketComanda()                # Para cocina/barra
  - renderTicketPreCuenta()              # Pre-cuenta mesa

server/src/services/thermalPrinter.js    # Formato alternativo
  - generarTicketCuenta()                # Ticket de cierre

server/src/routes/buffet/impresoras.js   # Endpoints
  - POST /imprimir-ticket                # Genera y envía
  - POST /imprimir-ticket-directo        # Envía base64 directo
```

### Configuración de Impresoras (tabla Configuracion)
| Clave | Uso |
|-------|-----|
| BUFFET_IMPRESORA_TICKETS | Tickets de buffet/mesas |
| BUFFET_IMPRESORA_KIOSCO | Tickets de kiosco |
| BUFFET_IMPRESORA_TAKEAWAY | Tickets de takeaway |

### Selección de Cliente para Facturación
- Componente: `ClienteSelector.jsx`
- Busca en: Socios + Entidades tipo CLIENTE
- Al seleccionar, autocompleta datos fiscales (tipoDoc, documento, condicionIva)
- Tipo de factura según condicionIva:
  - 5 (Consumidor Final) → Factura C
  - 1 (Resp. Inscripto) → Factura A/B
  - 6 (Monotributo) → Factura B/C

## Kiosco - Mobile/Tablet
- `BuffetKiosco.jsx` optimizado para touch
- Desktop: panel lateral de carrito siempre visible
- Mobile: botón flotante + drawer desde abajo
- Grid responsive: 2 cols mobile, 3-4 cols desktop
- Animaciones en `client/src/index.css`: `.animate-slide-up`

## Menú Público
- Página: `client/src/pages/public/MenuBuffet.jsx`
- Solo muestra productos con `tiposVenta: ['BUFFET']`
- Endpoint: `GET /api/buffet/menu-publico`
- Imágenes de productos en Unsplash (ver updateImagenesProductos.js)

## Scripts Útiles
```bash
# Actualizar imágenes de productos (Unsplash)
DATABASE_URL="postgresql://..." node server/updateImagenesProductos.js

# Importar artículos de kiosco con precios estimados
DATABASE_URL="postgresql://..." node server/src/scripts/importarArticulosKiosco.js
```

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
Admin: admin@rojoplus.com / admin123 | DB: ver server/.env (DATABASE_URL)
