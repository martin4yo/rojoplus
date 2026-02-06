# RojoPlus - Sistema de Gestión Club Sportivo Pilar

Este archivo contiene el contexto necesario para retomar el desarrollo del proyecto.

---

## Descripción

**RojoPlus** es un sistema integral de gestión para el Club Sportivo Pilar ("El Rojo de la Avenida") que incluye:
- **Fidelización**: Descuentos en comercios adheridos para socios
- **Gestión de Socios**: ABM completo con grupos familiares y menores
- **Actividades Deportivas**: Deportes, categorías e inscripciones
- **Sistema de Cuotas**: Generación masiva, recargos y cobranza
- **Portal de Socio**: Pagos online con MercadoPago y MODO
- **Caja y Movimientos**: Plan de cuentas y tesorería completa
- **Módulos Financieros**: Ingresos, Egresos, Stock, Contabilidad

---

## Stack Tecnológico

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express + Prisma
- **Base de datos**: PostgreSQL
- **Email**: Nodemailer con Gmail
- **Templates**: Handlebars (variables dinámicas) + Juice (inline CSS)
- **PDFs**: Puppeteer (generación desde HTML)
- **QR**: qrcode.react (generación) + @yudiel/react-qr-scanner (escaneo)
- **Pagos**: MercadoPago + MODO

---

## Estructura del Proyecto

```
RojoPlus/
├── docs/                           # Documentación completa
│   ├── HISTORIAL-SESIONES.md      # Historial de sesiones anteriores
│   ├── 01-ESPECIFICACION-FUNCIONAL.md
│   ├── 12-PLAN-DE-TRABAJO.md
│   ├── 13-DEBITO-AUTOMATICO.md
│   ├── 14-CONCILIACION-BANCARIA.md
│   └── 19-APP-MOVIL-SOCIOS.md
├── brio/                           # Archivos de referencia (sistema anterior)
├── client/                         # Frontend React
│   └── src/
│       ├── components/
│       └── pages/
│           ├── comercio/
│           ├── socio/
│           ├── public/
│           └── admin/
├── server/                         # Backend Express
│   ├── prisma/
│   │   ├── schema.prisma           # Schema completo (30+ modelos)
│   │   └── seed.js                 # Seeds iniciales
│   └── src/
│       ├── routes/
│       ├── services/
│       └── jobs/
├── ROADMAP.md                      # Fases técnicas completas
└── CLAUDE.md                       # Este archivo
```

---

## 📅 ÚLTIMA SESIÓN (6 Febrero 2026)

**Tema: Débito Automático con Prisma Medios de Pago**

### ✅ DÉBITO AUTOMÁTICO - 100% COMPLETADO

**Backend (1400 líneas en debitoAutomatico.js):**

Endpoints:
- `GET /api/admin/debito/configuraciones` - CRUD configuraciones
- `GET /api/admin/debito/socios-disponibles` - Socios habilitados
- `POST /api/admin/debito/archivos/generar` - Generar archivo Prisma
- `GET /api/admin/debito/archivos/:id/descargar` - Descargar .txt
- `PUT /api/admin/debito/archivos/:id/enviar` - Marcar como enviado
- `POST /api/admin/debito/archivos/:id/importar-respuesta` - Importar respuesta
- `POST /api/admin/debito/archivos/:id/reintentar-rechazados` - Reintentar
- `GET /api/admin/debito/estadisticas` - KPIs

Formatos implementados según especificación Prisma:
- **Generación (100 chars/línea):** DEBLIQC.txt (VISA Crédito), DEBLIQD.txt (VISA Débito), DEBLIMC.txt (Mastercard)
- **Importación respuestas:** RDEBLIQC/RDEBLIMC (300 chars), RDEBLIQD/LDEBLIQD (150 chars)

Funcionalidades:
- [x] Generación de archivos con formato exacto Prisma
- [x] Parseo de respuestas con detección de aprobados/rechazados
- [x] Creación automática de pagos para débitos exitosos
- [x] **Envío de recibos por email** a socios con pagos exitosos
- [x] Códigos de rechazo mapeados (50+ códigos)
- [x] Reintento de rechazados
- [x] Estadísticas y KPIs

**Frontend (850 líneas en DebitoAutomatico.jsx):**

5 pestañas:
1. **Generar** - Selector período, tipo tarjeta, socios, generar archivo
2. **Archivos** - Histórico, marcar enviados, ver detalles
3. **Importar** - Pegar respuesta Prisma, procesar
4. **Estadísticas** - KPIs: cobrados, rechazados, tasa éxito
5. **Configuración** - Números de establecimiento

**Archivos creados:**
```
server/src/routes/debitoAutomatico.js         # NUEVO (1400 líneas)
client/src/pages/admin/DebitoAutomatico.jsx   # NUEVO (850 líneas)
```

**Archivos modificados:**
```
server/src/services/email.js                  # Fix compatibilidad cargos/cuotas
server/src/index.js                           # +2 líneas (ruta)
client/src/App.jsx                            # +2 líneas (ruta)
client/src/components/AdminLayout.jsx         # +1 línea (menú)
```

---

## 📅 SESIÓN ANTERIOR (5 Febrero 2026)

**Tema: Opción A - Reportes Avanzados + PWA + Push Notifications**

### ✅ DASHBOARD EJECUTIVO - 100% COMPLETADO

**Backend (350 líneas):**
- `GET /api/admin/dashboard/ejecutivo` - KPIs consolidados
- `GET /api/admin/dashboard/ejecutivo/socios` - Métricas detalladas de socios
- `GET /api/admin/dashboard/ejecutivo/financiero` - Métricas financieras

**Frontend (600 líneas):**
- 4 tabs: General, Socios, Financiero, Actividades
- Gráficos con Recharts (evolución mensual)
- KPIs con tendencias e indicadores
- Acceso desde menú lateral

### ✅ REPORTES DE MOROSIDAD AVANZADOS - 100% COMPLETADO

**Backend (450 líneas):**
- `GET /api/admin/reportes/morosidad/resumen-kpis` - KPIs de morosidad
- `GET /api/admin/reportes/morosidad/antiguedad` - Análisis por rangos (0-30, 31-60, 61-90, 91-120, +120 días)
- `GET /api/admin/reportes/morosidad/proyeccion` - Simulación de recargos futuros
- `GET /api/admin/reportes/morosidad/detalle` - Lista paginada con filtros
- `GET /api/admin/reportes/morosidad/exportar` - Exportación Excel

**Frontend (700 líneas):**
- 4 tabs: Resumen, Antigüedad, Proyección, Detalle
- Filtros por categoría, actividad, días de atraso
- Tabla de antigüedad de deuda con porcentajes
- Exportación Excel directa
- Detalles expandibles por socio

### ✅ PWA PORTAL DEL SOCIO - 100% COMPLETADO

**Configuración:**
- vite-plugin-pwa configurado
- Manifest con iconos 192x192 y 512x512
- Service worker con cache de fonts, API y uploads
- Meta tags Apple PWA

**Características:**
- [x] Instalable en móviles y escritorio
- [x] Modo standalone (sin barra de navegador)
- [x] Cache offline de recursos estáticos
- [x] Cache NetworkFirst para API del socio
- [x] Iconos generados desde logo

**Botón de Instalación (InstallAppButton.jsx):**
- Banner flotante invitando a instalar
- Botón "Instalar App" que dispara prompt nativo
- Instrucciones paso a paso para iOS (Safari no soporta prompt)
- Detecta si ya está instalada
- Recuerda si el usuario cerró el banner

### ✅ PUSH NOTIFICATIONS - 100% COMPLETADO

**Backend:**
- Modelo `PushSubscription` en Prisma
- Servicio `webPush.js` con web-push
- Rutas para suscripción/desuscripción
- Integración con cron jobs de notificaciones
- VAPID keys generadas

**Frontend:**
- Servicio `pushNotifications.js`
- Componente `PushNotificationBanner.jsx`
- Integrado en portal del socio

**Tipos de notificaciones push:**
- Cuota próxima a vencer
- Cuota vencida
- Recordatorio de morosidad
- Pago confirmado
- Inscripción confirmada

**Archivos creados/modificados:**
```
# Dashboard Ejecutivo
server/src/routes/dashboardEjecutivo.js           # NUEVO (350 líneas)
client/src/pages/admin/DashboardEjecutivo.jsx     # NUEVO (600 líneas)

# Reportes Morosidad
server/src/routes/reportesMorosidad.js            # NUEVO (450 líneas)
client/src/pages/admin/ReporteMorosidadAvanzado.jsx # NUEVO (700 líneas)
client/src/pages/admin/Reportes.jsx               # +15 líneas

# PWA
client/vite.config.js                             # +90 líneas (PWA config)
client/index.html                                 # +8 líneas (meta tags)
client/public/images/icon-192.png                 # NUEVO
client/public/images/icon-512.png                 # NUEVO
client/scripts/generate-icons.js                  # NUEVO

# Push Notifications
server/prisma/schema.prisma                       # +20 líneas (modelo)
server/src/services/webPush.js                    # NUEVO (180 líneas)
server/src/routes/pushSubscription.js             # NUEVO (200 líneas)
server/src/services/notificacionService.js        # +60 líneas
client/src/services/pushNotifications.js          # NUEVO (200 líneas)
client/src/components/PushNotificationBanner.jsx  # NUEVO (150 líneas)
client/src/pages/socio/PortalSocioNuevo.jsx       # +3 líneas

# Común
server/src/index.js                               # +4 líneas
client/src/App.jsx                                # +4 líneas
client/src/components/AdminLayout.jsx             # +1 línea
```

### ✅ SEGURIDAD ACCESO QR - 100% COMPLETADO

**Problema resuelto:**
- Antes: cualquiera con N° socio podía ver el QR
- Ahora: el QR se envía por email al socio

**Cambios realizados:**
- `POST /api/socio/enviar-qr` - Nuevo endpoint seguro
- `enviarEmailQRSocio()` - Email con QR y link al portal
- `/mi-qr` rediseñado para enviar por email
- Email mostrado parcialmente oculto (ma***@gmail.com)

**Archivos adicionales modificados:**
```
server/src/routes/socio.js                        # +70 líneas (endpoint)
server/src/services/email.js                      # +65 líneas (template)
client/src/pages/socio/AccesoSocio.jsx            # Reescrito (200 líneas)
client/src/components/InstallAppButton.jsx        # NUEVO (290 líneas)
```

**Estado:** ✅ OPCIÓN A 100% COMPLETADA + MEJORAS DE SEGURIDAD

---

## Estado General del Proyecto

### ✅ MÓDULOS COMPLETADOS (100%)

| Módulo | Estado |
|--------|--------|
| **Gestión de Socios** | ✅ CRUD completo, grupos familiares, QR |
| **Sistema de Cuotas** | ✅ Generación masiva, recargos, planes de pago |
| **Cobranzas y Pagos** | ✅ Múltiples medios, saldos a favor, PDFs |
| **Cierre de Caja Diario** | ✅ Arqueo, diferencias, doble validación |
| **Portal del Socio** | ✅ Pagos online, cuenta corriente, actividades |
| **Inscripciones** | ✅ CRUD completo, validaciones, plantel, Excel |
| **Solicitudes Alta Socios** | ✅ Formulario público, grupos familiares, workflow |
| **Actividades Deportivas** | ✅ CRUD, categorías, configuración cuotas |
| **Templates y Notificaciones** | ✅ Email/PDF editables, cron jobs, preferencias |
| **Módulos Financieros** | ✅ Tesorería, Stock, Facturas, Pedidos, Sueldos |
| **Plan de Cuentas** | ✅ Jerárquico, Libro Diario, Libro Mayor, Balance |
| **Asientos Contables** | ✅ Automáticos en pagos, facturas, movimientos |
| **Dashboard Ejecutivo** | ✅ KPIs consolidados, gráficos, tendencias |
| **Reportes Morosidad** | ✅ Antigüedad deuda, proyecciones, Excel |
| **PWA Portal Socio** | ✅ Instalable, offline, botón instalar, iOS |
| **Push Notifications** | ✅ Cuotas, pagos, integrado con cron jobs |
| **Seguridad Acceso QR** | ✅ QR enviado por email, no visible público |
| **Débito Automático** | ✅ Prisma: DEBLIQC/D, DEBLIMC, respuestas, recibos |

### 🟡 PENDIENTES - PRIORIDAD MEDIA

- **Conciliación Bancaria** - Modelos existentes en BD

### ⏳ LARGO PLAZO

- **App Móvil Nativa** (React Native iOS + Android) - Especificada en docs/19-APP-MOVIL-SOCIOS.md

---

## Prioridades Próxima Sesión

**✅ OPCIÓN A - Reportes + PWA - COMPLETADA**
**✅ OPCIÓN B - Débito Automático - COMPLETADA**

Próxima opción disponible:

**🟡 OPCIÓN C - Conciliación Bancaria** (3-4 semanas)
1. Importación extractos (OFX, CSV)
2. Conciliación automática/manual
3. Reportes de movimientos no conciliados

**🟢 OPCIÓN D - Testing y QA** (1-2 semanas)
1. Verificar todas las funcionalidades implementadas
2. Pruebas en producción con datos reales
3. Corrección de bugs encontrados

**⏳ LARGO PLAZO - App Móvil Nativa**
- React Native para iOS + Android
- Especificación en docs/19-APP-MOVIL-SOCIOS.md

---

## Modelos Principales del Schema

| Módulo | Modelos |
|--------|---------|
| Socios | Socio, GrupoFamiliar, SolicitudSocio, FamiliarSolicitud |
| Deportes | Actividad, CategoriaActividad, Inscripcion, EntrenadorCategoria |
| Cuotas | Periodo, Cargo, ConfiguracionRecargo |
| Pagos | MedioPago, Pago, LinkPago |
| Caja | Caja, CuentaBancaria, CierreCaja, MovimientoCaja |
| Contabilidad | CuentaContable, Asiento, AsientoLinea |
| Financiero | Entidad, MovimientoContable, OrdenCompra, Pedido, LiquidacionSueldo |
| Stock | Producto, VarianteProducto, FotoProducto, MovimientoStock |
| Templates | EmailTemplate, PdfTemplate, NotificacionLog |
| Comercios | Comercio, Rubro, Venta |
| Sistema | Configuracion, AuditLog, Admin, Rol, Permiso |

**Total:** 30+ modelos activos

---

## URLs y Rutas Principales

| URL | Descripción |
|-----|-------------|
| `/mi-qr` | Socio obtiene su QR |
| `/s/{tokenPortal}` | Portal del socio |
| `/c/{token}` | Portal del comerciante |
| `/inscripcion-socio` | Formulario público alta socios |
| `/admin` | Panel de administración |
| `/admin/socios` | Gestión de socios |
| `/admin/solicitudes` | Aprobación solicitudes alta |
| `/admin/inscripciones` | Gestión de inscripciones |
| `/admin/periodos` | Gestión de periodos y cuotas |
| `/admin/cierres-caja` | Cierre de caja diario |
| `/admin/configuracion/templates/email` | Editor templates email |
| `/admin/configuracion/templates/pdf` | Editor templates PDF |
| `/registro` | Registro de comercios |

---

## Comandos Útiles

```bash
# Desarrollo
cd server && npm run dev
cd client && npm run dev

# Base de datos
npx prisma db push              # Aplicar schema
npx prisma db seed              # Seeds
npx prisma generate             # Regenerar client
npx prisma studio               # Ver datos

# Después de migrar schema
# 1. Detener servidor
# 2. npx prisma generate
# 3. Reiniciar servidor
```

---

## Configuración de Branding

Colores y logo del club configurables desde BD:

| Clave | Default |
|-------|---------|
| COLOR_PRIMARIO | #DC2626 |
| COLOR_SECUNDARIO | #1F2937 |
| COLOR_FONDO | #F9FAFB |
| CLUB_LOGO_URL | /images/logo.png |

---

## Configuración de Pagos

Datos bancarios configurables desde `/admin/configuracion/pagos`:

| Clave | Descripción | Ejemplo |
|-------|-------------|---------|
| PAGO_TITULAR | Titular de la cuenta | Club Sportivo Pilar |
| PAGO_CBU | CBU (22 dígitos) | 22388274837883888438 |
| PAGO_ALIAS | Alias bancario | sportivo.pilar |
| PAGO_TELEFONO | WhatsApp para comprobantes | +54 9 230 4346897 |

---

## Credenciales de Desarrollo

```
Admin: admin@rojoplus.com / admin123

Base de datos:
Host: localhost
Puerto: 5432
Usuario: postgres
Password: Q27G4B98
Database: rojoplus
```

---

## Datos del Sistema (Producción)

- **634 socios activos**
- **190 grupos familiares**
- **10 actividades deportivas**
- **Sistema de comercios funcionando**
- **QR activo para descuentos**

---

## Documentación de Referencia

| Documento | Contenido |
|-----------|-----------|
| `ROADMAP.md` | Fases técnicas detalladas (28 fases) |
| `docs/HISTORIAL-SESIONES.md` | Historial de sesiones anteriores |
| `docs/12-PLAN-DE-TRABAJO.md` | Plan de trabajo completo |
| `docs/13-DEBITO-AUTOMATICO.md` | Especificación débito automático |
| `docs/14-CONCILIACION-BANCARIA.md` | Especificación conciliación |
| `docs/15-PORTAL-PAGOS-ONLINE.md` | Portal del socio y pagos |
| `docs/18-SISTEMA-TEMPLATES-NOTIFICACIONES.md` | Templates y emails |
| `docs/19-APP-MOVIL-SOCIOS.md` | App móvil nativa (iOS + Android) |

---

## Git Status Actual

```
Current branch: main

Modified:
M client/src/pages/admin/SocioDetalle.jsx

Recent commits:
409dc15 docs: Documentar implementación completa de Cierre de Caja Diario
f82b09a feat: Implementar Sistema de Cierre de Caja Diario (COMPLETO)
fbfef87 docs: Elevar prioridad de Cierre de Caja Diario a URGENTE
c9fbf62 docs: Actualizar CLAUDE.md - Sistema de Inscripciones 100% completo
135d99d feat: Completar Sistema de Inscripciones al 100%
```

---

*Última actualización: 30 Enero 2026 - Noche*
*Estado: Cierre de Caja Diario 100% COMPLETADO*
*Próximo: Evaluar Opción A (Reportes + PWA) vs Opción B (Débito Automático)*
