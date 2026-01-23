# RojoPlus - Sistema de Gestion Club Sportivo Pilar

Este archivo contiene el contexto necesario para retomar el desarrollo del proyecto.

## Descripcion

**RojoPlus** es un sistema integral de gestion para el Club Sportivo Pilar ("El Rojo de la Avenida") que incluye:
- **Fidelizacion**: Descuentos en comercios adheridos para socios
- **Gestion de Socios**: ABM completo con grupos familiares y menores
- **Actividades Deportivas**: Deportes, categorias e inscripciones
- **Sistema de Cuotas**: Generacion, recargos y cobranza
- **Debito Automatico**: Integracion con Prisma y Payway
- **Portal de Socio**: Pagos online con MercadoPago y MODO
- **Caja y Movimientos**: Plan de cuentas y conciliacion bancaria

## Stack Tecnologico

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express + Prisma
- **Base de datos**: PostgreSQL
- **Email**: Nodemailer con Gmail
- **Templates**: Handlebars (variables dinámicas) + Juice (inline CSS)
- **PDFs**: Puppeteer (generación desde HTML)
- **QR**: qrcode.react (generacion) + @yudiel/react-qr-scanner (escaneo)
- **Pagos**: MercadoPago + MODO

## Estructura del Proyecto

```
RojoPlus/
├── docs/                           # Documentacion completa
│   ├── 01-ESPECIFICACION-FUNCIONAL.md
│   ├── 08-SCHEMA-COMPLETO-CLUB.prisma
│   ├── 12-PLAN-DE-TRABAJO.md
│   ├── 13-DEBITO-AUTOMATICO.md
│   ├── 14-CONCILIACION-BANCARIA.md
│   ├── 15-PORTAL-PAGOS-ONLINE.md
│   └── 16-CONFIGURACION-BRANDING.md
├── brio/                           # Archivos de referencia (sistema anterior)
├── client/                         # Frontend React
│   └── src/
│       ├── components/
│       │   └── QrScanner.jsx
│       └── pages/
│           ├── comercio/
│           ├── socio/
│           └── admin/
├── server/                         # Backend Express
│   ├── prisma/
│   │   ├── schema.prisma           # Schema completo (30+ modelos)
│   │   └── seed.js                 # Seeds iniciales
│   └── src/
│       └── routes/
└── CLAUDE.md                       # Este archivo
```

## Estado Actual del Desarrollo

### Completado

- [x] Sistema base de gestion de socios
- [x] Cuotas y recargos por mora
- [x] Planes de pago (financiacion)
- [x] Reportes de cobranza con KPIs
- [x] Portal del socio con pagos online (MercadoPago/MODO)
- [x] Sistema de caja y movimientos
- [x] Actividades deportivas e inscripciones
- [x] Sistema de templates editables (Email y PDF)

### Ultima Sesion (24 Enero 2026)

**Sistema de Templates y Notificaciones - Parte 2:**
- [x] Corrección de paleta de colores en templates (blue para email, gray para PDF)
- [x] Restructuración del menú Configuración con submenu jerárquico
- [x] Acceso directo a Templates Email y Templates PDF desde sidebar
- [x] Limpieza de navegación redundante en ConfiguracionPagos
- [x] Removida card duplicada de Datos Bancarios en página General
- [x] Removidos botones "Volver" y "Cancelar" de páginas de configuración
- [x] Mejoras de UX: guardar sin auto-navegación

### Sesion Anterior (24 Enero 2026 - Parte 1)

**Sistema de Templates y Notificaciones:**
- [x] Modelos EmailTemplate y PdfTemplate en base de datos
- [x] Servicio de generación de PDFs con Puppeteer
- [x] Servicio de envío de emails con Handlebars
- [x] Endpoints CRUD para templates (email y PDF)
- [x] Página admin para editar templates de email
- [x] Página admin para editar templates de PDF
- [x] Preview de templates y envío de pruebas
- [x] Templates predeterminados (COMPROBANTE_PAGO, PAGO_CONFIRMADO, PAGO_RECHAZADO, RECIBO, FACTURA)
- [x] Sistema de variables dinámicas

### Sesion (23 Enero 2026)

- [x] Sistema de configuración de datos bancarios (CBU, Alias, Teléfono, Titular)
- [x] Portal del Socio: Rediseño completo de opciones de pago (compacto)
- [x] Logos de medios de pago (MP.png, MODO.webp)
- [x] Switch para transferencia con datos bancarios
- [x] Botones independientes para copiar CBU y Alias
- [x] Formulario de informar pago con upload de comprobante (10MB)
- [x] MercadoPago: Campos para conciliación (nroOperacion, fechaOperacion, linkPagoId)
- [x] Backend: Límite de payload aumentado a 10MB
- [x] Corrección de colores (MODO verde, Transferencia naranja)

### Pendiente - Plan Modulos Financieros

Ver plan detallado: `C:\Users\marti\.claude\plans\linear-cooking-gosling.md`

1. **Ingresos**: Clientes, Facturas emitidas, Recibos de cobro
2. **Egresos**: Proveedores, Personal, Facturas recibidas, Ordenes de pago
3. **Tesoreria**: Cajas, Movimientos, Transferencias
4. **Stock**: Productos con talles, fotos, control de inventario

### Modelos Principales del Schema

| Modulo | Modelos |
|--------|---------|
| Socios | Socio, GrupoFamiliar, AutorizacionMenor, Cobrador |
| Deportes | Deporte, Categoria, Inscripcion, EntrenadorCategoria |
| Cuotas | TipoCuota, ConfiguracionCuota, ConfiguracionRecargo, PeriodoCuota, Cuota |
| Pagos | MedioPago, Pago, SaldoFavor, AplicacionSaldo, LinkPago |
| Caja | Caja, CuentaBancaria, CuentaContable, MovimientoCaja |
| Debito | ConfiguracionDebito, ArchivoDebito, DetalleDebito, ImportacionCobranza |
| Conciliacion | ExtractoBancario, MovimientoExtracto, Conciliacion |
| Usuarios | Admin, Rol, Permiso, PermisoRol |
| Comercios | Comercio, Rubro, Venta |
| Templates | EmailTemplate, PdfTemplate |
| Sistema | Configuracion, AuditLog |

## Funcionalidades del Sistema

### Ya Implementadas (RojoPlus v1)
- Identificacion de socios por QR
- Portal de comercios adheridos
- Gestion basica de socios
- Sistema de descuentos

### En Desarrollo (v2)
- Gestion completa de socios con datos medicos
- Grupos familiares
- Deportes y categorias
- Sistema de cuotas con recargos acumulativos
- Debito automatico (Prisma/Payway)
- Conciliacion bancaria
- Portal de socio con pagos online
- Configuracion de branding

## URLs y Rutas

| URL | Descripcion |
|-----|-------------|
| `/mi-qr` | Socio obtiene su QR |
| `/s/{tokenPortal}` | Portal del socio |
| `/c/{token}` | Portal del comerciante |
| `/admin` | Panel de administracion |
| `/admin/configuracion/templates/email` | Editor de templates de email |
| `/admin/configuracion/templates/pdf` | Editor de templates de PDF |
| `/admin/configuracion/pagos` | Configuración de datos bancarios |
| `/registro` | Registro de comercios |

## Comandos Utiles

```bash
# Desarrollo
cd server && npm run dev
cd client && npm run dev

# Base de datos
npx prisma db push              # Aplicar schema
npx prisma db seed              # Seeds
npx prisma generate             # Regenerar client
npx prisma studio               # Ver datos

# Despues de migrar schema
# 1. Detener servidor
# 2. npx prisma generate
# 3. Reiniciar servidor
```

## Configuracion de Branding

Los colores y logo del club son configurables desde BD:

| Clave | Default |
|-------|---------|
| COLOR_PRIMARIO | #DC2626 |
| COLOR_SECUNDARIO | #1F2937 |
| COLOR_FONDO | #F9FAFB |
| CLUB_LOGO_URL | /images/logo.png |

## Configuracion de Pagos

Los datos bancarios del club son configurables desde el panel admin:

| Clave | Descripción | Ejemplo |
|-------|-------------|---------|
| PAGO_TITULAR | Titular de la cuenta | Club Sportivo Pilar |
| PAGO_CBU | CBU (22 dígitos) | 22388274837883888438 |
| PAGO_ALIAS | Alias bancario | sportivo.pilar |
| PAGO_TELEFONO | WhatsApp para comprobantes | +54 9 230 4346897 |

**Configurar desde:** `/admin/configuracion/pagos`

## Credenciales de Desarrollo

```
Admin: admin@rojoplus.com / admin123
```

## Proximos Pasos

### Prioridad Alta - Modulos Financieros
1. **Fase 7**: Modulo de Entidades (Proveedores, Clientes, Personal)
2. **Fase 8**: MovimientoContable unificado (facturas, pagos, cobros)
3. **Fase 9**: Tesoreria avanzada (transferencias entre cajas)
4. **Fase 10**: Stock con variantes/talles y fotos

### Futuro
- Debito automatico (Prisma/Payway)
- Conciliacion bancaria
- Reportes exportables PDF/Excel

Ver plan completo en `docs/12-PLAN-DE-TRABAJO.md`

---

*Ultima actualizacion: 24 Enero 2026*
