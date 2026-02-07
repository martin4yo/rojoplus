# RojoPlus - Sistema de Gestión Club Sportivo Pilar

Sistema integral de gestión para el Club Sportivo Pilar ("El Rojo de la Avenida").

## Stack Tecnológico

| Capa | Tecnologías |
|------|-------------|
| Frontend | React + Vite + Tailwind CSS |
| Backend | Node.js + Express + Prisma |
| Base de datos | PostgreSQL |
| Email | Nodemailer + Handlebars + Juice |
| PDFs | Puppeteer |
| QR | qrcode.react + @yudiel/react-qr-scanner |
| Pagos | MercadoPago + MODO |

## Estructura del Proyecto

```
RojoPlus/
├── docs/                    # Documentación detallada
├── client/src/              # Frontend React
│   ├── components/
│   ├── pages/{admin,socio,comercio,public}/
│   └── services/
├── server/                  # Backend Express
│   ├── prisma/schema.prisma # 30+ modelos
│   └── src/{routes,services,jobs}/
├── ROADMAP.md              # Fases técnicas (ver para pendientes)
└── CLAUDE.md               # Este archivo
```

## Estado del Proyecto (99% completo)

### Módulos Completados

- **Socios**: CRUD, grupos familiares, QR, solicitudes públicas
- **Cuotas**: Generación masiva, recargos, planes de pago
- **Cobranzas**: Múltiples medios, saldos a favor, PDFs, cierre de caja
- **Portal Socio**: PWA instalable, pagos online, push notifications
- **Deportes**: Actividades, categorías, inscripciones, partidos, estadísticas
- **Financiero**: Tesorería, Stock, Facturas, Pedidos, Sueldos, Contabilidad
- **Débito Automático**: Prisma (VISA/Mastercard), generación/importación archivos
- **Conciliación Bancaria**: OFX/CSV/TXT, matching automático
- **Sitio Institucional**: Historia, Autoridades, Noticias, Comercios, Banners
- **Usuarios y Permisos**: Roles, 30+ permisos, protección frontend/backend

### Pendientes

| Prioridad | Item | Descripción |
|-----------|------|-------------|
| **PRÓXIMO** | Fase 39 | Módulo Buffet/Restaurant (diseñado, listo para implementar) |
| Media | Fase 31 | Control de Accesos (molinetes, lectores QR) |
| Baja | Fase 35.10-20 | Payway y Débito Directo Bancario |
| Futuro | Fase 19 | App Móvil Nativa (React Native) |

## Próxima Implementación: Módulo Buffet (Fase 39)

**26 etapas, ~350 items diseñados en ROADMAP.md**

### Orden de implementación sugerido:
1. **39.1** - Modelos Prisma base
2. **39.3** - Campos `esParaBuffet` y `esIngrediente` en Producto
3. **39.15** - Permisos BUFFET_* y menú en AdminLayout
4. **39.2** - Configuración impresoras térmicas
5. **39.4** - Mesas, zonas, dashboard operativo
6. **39.7** - Toma de comandas (PWA tablet/móvil)
7. **39.8** - Pantalla cocina (KDS)
8. **39.9** - Cobro y cierre de mesa

### Integraciones críticas:
- **Menú**: Submenú en AdminLayout, no app separada
- **Permisos**: Usar sistema existente (Fase 38)
- **Tesorería**: Usar `Caja` y `MovimientoCaja` existentes con tipo BUFFET
- **Stock**: Reutilizar modelo Producto con filtro `esParaBuffet`

## Modelos Principales (schema.prisma)

| Módulo | Modelos |
|--------|---------|
| Socios | Socio, GrupoFamiliar, SolicitudSocio |
| Deportes | Actividad, CategoriaActividad, Inscripcion, Partido, Convocatoria |
| Cuotas | Periodo, Cargo, ConfiguracionRecargo |
| Pagos | MedioPago, Pago, LinkPago |
| Caja | Caja, CierreCaja, MovimientoCaja, CuentaBancaria |
| Contabilidad | CuentaContable, Asiento, AsientoLinea |
| Stock | Producto, VarianteProducto, MovimientoStock |
| Sistema | Configuracion, Admin, Rol, Permiso, AuditLog |

## Patrones de Código

### API Response Handling (frontend)
```javascript
// El servicio api.get() ya extrae data.data
// Usar este patrón para compatibilidad:
const datos = response?.data || response || []
```

### Protección de Permisos (frontend)
```javascript
import { tienePermiso, PERMISOS } from '../../services/permisos'

{tienePermiso(PERMISOS.SOCIOS_CREAR) && <Button>Nuevo</Button>}
```

### Middleware de Permisos (backend)
```javascript
const { checkPermiso } = require('../middleware/auth')
router.get('/ruta', checkPermiso('CODIGO_PERMISO'), handler)
```

## Rutas Principales

| Tipo | URL | Descripción |
|------|-----|-------------|
| Público | `/` | Home institucional |
| Público | `/historia`, `/autoridades`, `/noticias`, `/actividades` | Páginas institucionales |
| Socio | `/mi-qr` | Solicitar QR por email |
| Socio | `/s/{token}` | Portal del socio |
| Comercio | `/c/{token}` | Portal del comerciante |
| Admin | `/admin/*` | Panel de administración |

## Comandos

```bash
# Desarrollo
cd server && npm run dev
cd client && npm run dev

# Base de datos
npx prisma db push      # Aplicar schema
npx prisma db seed      # Seeds (incluye permisos)
npx prisma generate     # Regenerar client
npx prisma studio       # GUI para ver datos
```

## Credenciales Desarrollo

```
Admin: admin@rojoplus.com / admin123

PostgreSQL:
  Host: localhost:5432
  User: postgres
  Pass: Q27G4B98
  DB: rojoplus
```

## Configuración

| Clave | Valor Default |
|-------|---------------|
| COLOR_PRIMARIO | #DC2626 |
| COLOR_SECUNDARIO | #1F2937 |
| CLUB_LOGO_URL | /images/logo.png |

Pagos configurables en `/admin/configuracion/pagos` (CBU, Alias, Titular)

## Documentación de Referencia

| Archivo | Contenido |
|---------|-----------|
| `ROADMAP.md` | Fases técnicas detalladas, items pendientes |
| `docs/13-DEBITO-AUTOMATICO.md` | Especificación Prisma |
| `docs/14-CONCILIACION-BANCARIA.md` | Formatos bancarios |
| `docs/19-APP-MOVIL-SOCIOS.md` | Especificación app nativa |

## Datos Producción

- 634 socios activos
- 190 grupos familiares
- 10 actividades deportivas
- Sistema QR funcionando

---

*Estado: 99% completo - Próximo: Implementar Módulo Buffet (Fase 39)*
