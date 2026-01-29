# RojoPlus - Sistema de Gestion Club Sportivo Pilar

Este archivo contiene el contexto necesario para retomar el desarrollo del proyecto.

## Descripcion

**RojoPlus** es un sistema integral de gestion para el Club Sportivo Pilar ("El Rojo de la Avenida") que incluye:
- **Fidelizacion**: Descuentos en comercios adheridos para socios
- **Gestion de Socios**: ABM completo con grupos familiares y menores
- **Actividades Deportivas**: Deportes, categorias e inscripciones
- **Sistema de Cuotas**: Generacion masiva, recargos y cobranza
- **Portal de Socio**: Pagos online con MercadoPago y MODO
- **Caja y Movimientos**: Plan de cuentas y tesoreria completa
- **Modulos Financieros**: Ingresos, Egresos, Stock, Contabilidad

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
│   ├── 16-CONFIGURACION-BRANDING.md
│   ├── 17-SISTEMA-NOTIFICACIONES-CHAT.md
│   └── 18-SISTEMA-TEMPLATES-NOTIFICACIONES.md
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
│       ├── routes/
│       └── services/
└── CLAUDE.md                       # Este archivo
```

## Estado Actual del Desarrollo

### ✅ COMPLETADO 100%

#### **FASE 0: Base de Datos**
- [x] Schema completo con 30+ modelos
- [x] Migraciones ejecutadas
- [x] Seeds de datos iniciales

#### **FASE 1: Gestion de Socios**
- [x] CRUD completo de socios con todos los campos
- [x] Grupos familiares (190 grupos migrados automáticamente, 634 socios)
- [x] Búsqueda y filtros avanzados
- [x] Exportación a Excel
- [x] QR de socios funcionando
- [x] Categorías de socios con descuentos

#### **FASE 3: Sistema de Cuotas**
- [x] Generación masiva de cuotas por periodo
- [x] Cuotas sociales (GRUPO_FAMILIAR y SOCIO_UNICO)
- [x] Cuotas de actividades deportivas
- [x] Configuración de recargos (FIJO y ACUMULATIVO)
- [x] Cálculo automático de recargos en tiempo real
- [x] Configuración de día de vencimiento
- [x] Página Periodos.jsx para gestión
- [x] Página Cuotas.jsx para visualización y cobro
- [x] Backend: `/admin/periodos`, `/admin/cargos`, `/admin/configuracion-recargo`

#### **FASE 4: Cobranzas y Pagos**
- [x] Registro de pagos múltiples cuotas
- [x] Saldos a favor
- [x] Anulación de pagos
- [x] Generación de comprobantes PDF
- [x] Planes de pago (financiación)
- [x] Reportes de cobranza con KPIs

#### **FASE 5: Caja y Movimientos** (95%)
- [x] CRUD de cajas y cuentas bancarias
- [x] Plan de cuentas contable jerárquico
- [x] Registro de ingresos/egresos
- [x] Transferencias entre cajas
- [x] Movimientos automáticos desde cobranzas
- [ ] Cierre de caja diario (PENDIENTE)
- [ ] Arqueo de efectivo (PENDIENTE)

#### **FASE 6: Portal del Socio** (60%)
- [x] Pagos online con MercadoPago
- [x] Pagos online con MODO
- [x] Informar pago manual con upload de comprobante
- [x] QR para descuentos en comercios
- [x] Configuración de datos bancarios
- [ ] Ver cuenta corriente completa (PENDIENTE)
- [ ] Descargar comprobantes históricos (PENDIENTE)
- [ ] Actualizar datos personales (PENDIENTE)
- [ ] Ver actividades inscriptas (PENDIENTE)

#### **Actividades Deportivas** (Backend + Config)
- [x] CRUD de Actividades (Backend completo)
- [x] CRUD de Categorías de Actividad
- [x] Configuración de cuotas por actividad/categoría
- [x] Integrado en generación de cuotas masivas
- [x] Páginas: ActividadesLista.jsx, ActividadForm.jsx
- [x] Modelo Inscripcion en BD funcionando
- [ ] CRUD de inscripciones (PENDIENTE - ver más abajo)

#### **Sistema de Templates y Notificaciones**
- [x] Modelos EmailTemplate y PdfTemplate en BD
- [x] Servicio de generación de PDFs con Puppeteer
- [x] Servicio de envío de emails con Handlebars
- [x] Endpoints CRUD para templates
- [x] Página admin para editar templates de email
- [x] Página admin para editar templates de PDF
- [x] Preview de templates y envío de pruebas
- [x] Templates predeterminados (COMPROBANTE_PAGO, PAGO_CONFIRMADO, etc.)
- [x] Sistema de variables dinámicas
- [x] Paleta de colores consistente (blue/gray)
- [x] Menú Configuración jerárquico

#### **Módulos Financieros Completos**
- [x] **Tesorería**: Cajas, Movimientos, Transferencias
- [x] **Plan de Cuentas**: Estructura jerárquica con Balance
- [x] **Entidades**: Proveedores, Clientes, Personal (CRUD completo)
- [x] **Stock**: Productos con variantes/talles y fotos múltiples
- [x] **Dashboard CashFlow**: KPIs, gráficos, 4 tabs
- [x] **eCheqs**: Cheques electrónicos emitidos/recibidos
- [x] **Órdenes de Compra**: CRUD + recibir + cancelar
- [x] **Facturas**: Compra y Venta (CRUD completo)
- [x] **Pedidos**: CRUD + cancelar
- [x] **Liquidación Sueldos**: CRUD + pago individual/masivo
- [x] **Órdenes de Pago**: Lista + Form
- [x] **Asientos Contables**: CRUD + Libro Diario
- [x] **Libro Mayor**: Movimientos por cuenta + saldos
- [x] **Balance**: Plan de Cuentas con Debe/Haber/Saldo

#### **Reportes** (30%)
- [x] Reporte de Socios
- [x] Reporte de Cuotas
- [x] Reporte de Actividades

---

### 🔶 PARCIALMENTE IMPLEMENTADO

#### **Sistema de Inscripciones en Actividades** (70%)

**✅ Implementado:**
- Modelo `Inscripcion` en BD (socioId, categoriaActividadId, fechaInicio, estado)
- Relación completa: Socio → Inscripcion → CategoriaActividad → Actividad
- Se usa en generación masiva de cuotas (genera cuota por cada inscripción activa)
- Se muestra en SocioDetalle.jsx (lista de actividades del socio)
- Campo `exentoCuota` y `porcentajeCuota` funcionando

**❌ Falta implementar:**
- [ ] CRUD independiente de inscripciones (endpoints + página)
- [ ] Página "Inscripciones" con listado y filtros
- [ ] Modal/formulario para inscribir socio en actividad
- [ ] Validación de edad (edadMinima, edadMaxima de categoría)
- [ ] Validación de cupos máximos
- [ ] Asignación de entrenadores a categorías (modelo EntrenadorCategoria existe)
- [ ] Vista de "Plantel" por categoría (lista de inscriptos)
- [ ] Exportar plantel a Excel
- [ ] Histórico de inscripciones del socio (mostrar inactivas)
- [ ] Dar de baja de actividad con motivo

**Archivos a crear:**
```
client/src/pages/admin/Inscripciones.jsx          # Listado general
client/src/pages/admin/InscripcionForm.jsx        # Modal de inscripción
client/src/pages/admin/CategoriaDetalle.jsx       # Plantel + entrenadores
```

**Endpoints a crear en admin.js:**
```javascript
GET    /api/admin/inscripciones                   # Listar con filtros
POST   /api/admin/inscripciones                   # Crear (validar edad, cupo)
PUT    /api/admin/inscripciones/:id               # Actualizar
DELETE /api/admin/inscripciones/:id               # Dar de baja
GET    /api/admin/categorias-actividad/:id/plantel  # Ver inscriptos
POST   /api/admin/categorias-actividad/:id/entrenadores  # Asignar entrenador
```

---

#### **Módulo Deportes Avanzado** (40%)

**✅ Implementado:**
- Modelo Entrenamiento en BD
- Modelo Espacio y TipoEspacio
- Endpoints básicos funcionando

**❌ Falta:**
- [ ] Gestión de horarios de entrenamientos
- [ ] Asignación de espacios a categorías
- [ ] Calendario de actividades
- [ ] Asistencia a entrenamientos

---

### ❌ PENDIENTES - PRIORIDAD ALTA

#### **1. Asientos Contables Automáticos**

Generar asientos contables automáticamente al realizar operaciones financieras.

**Operaciones que deben generar asientos:**
- Pago de cuota socio → D: Caja, H: Ingresos por Cuotas
- MovimientoCaja INGRESO → D: Caja, H: Cuenta del Concepto
- MovimientoCaja EGRESO → D: Cuenta del Concepto, H: Caja
- Factura Compra → D: Gasto/Mercadería + IVA CF, H: Proveedores
- Factura Venta → D: Clientes, H: Ventas + IVA DF
- Orden de Pago → D: Proveedores, H: Caja
- Recibo de Cobro → D: Caja, H: Clientes

**Cambios requeridos:**
```prisma
model Caja {
  cuentaContableId Int?  // AGREGAR
  cuentaContable CuentaContable? @relation(...)
}
```

**Archivos a modificar:**
- `server/src/routes/admin.js` → POST /admin/pagos (llamar servicio)
- `server/src/routes/tesoreria.js` → POST /admin/movimientos-caja
- `server/src/routes/movimientosContables.js` → POST facturas/órdenes/recibos

**Archivo a crear:**
- `server/src/services/asientosContables.js` con funciones:
  - `generarAsientoPagoCuota()`
  - `generarAsientoMovimientoCaja()`
  - `generarAsientoFacturaCompra()`
  - `generarAsientoFacturaVenta()`
  - `generarAsientoOrdenPago()`
  - `generarAsientoReciboCobro()`

**Plan detallado:** `C:\Users\marti\.claude\plans\linear-cooking-gosling.md`

---

#### **2. Notificaciones Automáticas Programadas**

**✅ Ya implementado:**
- Templates editables (Email y PDF)
- Servicio de envío de emails
- Generación de PDFs
- Envío manual de comprobantes

**❌ Falta implementar:**
- [ ] Job/cron para notificaciones automáticas
- [ ] Email: Cuota próxima a vencer (5 días antes)
- [ ] Email: Cuota vencida (día del vencimiento)
- [ ] Email: Recordatorio de morosidad (cada 15 días)
- [ ] Email: Confirmación de inscripción en actividad
- [ ] Email: Bienvenida a nuevo socio
- [ ] Centro de preferencias del socio (opt-in/opt-out)
- [ ] Log de notificaciones enviadas (tabla NotificacionLog)

**Archivos a crear:**
```javascript
server/src/jobs/notificaciones.js          # Cron jobs
server/src/services/notificacionService.js # Lógica de envío
```

**Modelo a agregar en schema.prisma:**
```prisma
model NotificacionLog {
  id          Int      @id @default(autoincrement())
  tipo        String   // EMAIL, SMS, WHATSAPP
  eventType   String   // CUOTA_VENCIMIENTO, PAGO_CONFIRMADO, etc.
  destinatario String
  socioId     Int?
  enviado     Boolean  @default(false)
  fechaEnvio  DateTime?
  error       String?
  createdAt   DateTime @default(now())
}
```

---

#### **3. Formulario Público de Alta de Nuevos Socios**

Actualmente los socios se dan de alta manualmente desde el panel admin. Falta crear un formulario público (tipo Google Forms) donde la gente se pueda anotar.

**❌ Pendiente:**
- [ ] Página pública `/inscripcion-socio` (sin login)
- [ ] Formulario con campos del Google Forms del club
- [ ] Envío de solicitud con estado PENDIENTE_APROBACION
- [ ] Admin recibe notificación de nueva solicitud
- [ ] Admin aprueba/rechaza desde panel
- [ ] Al aprobar: crear socio, asignar número, enviar email bienvenida
- [ ] Al rechazar: enviar email con motivo

**Archivos a crear:**
```javascript
client/src/pages/public/InscripcionSocio.jsx
server/src/routes/public.js  // POST /api/public/solicitud-socio
```

**Modelo a agregar:**
```prisma
model SolicitudSocio {
  id              Int      @id @default(autoincrement())
  nombre          String
  apellido        String
  dni             String
  email           String
  telefono        String
  // ... otros campos del formulario
  estado          String   @default("PENDIENTE") // PENDIENTE, APROBADA, RECHAZADA
  motivoRechazo   String?
  fechaSolicitud  DateTime @default(now())
  fechaRespuesta  DateTime?
  socioCreado     Int?     // ID del socio creado al aprobar
}
```

**NOTA:** El usuario tiene un formulario de Google Forms con estos datos. Está pendiente pasarlo para implementar exactamente los mismos campos.

---

### ❌ PENDIENTES - PRIORIDAD MEDIA

#### **4. Débito Automático (Prisma/Payway)**

**Funcionalidad:**
- Generación de archivos de débito según formato de cada procesador
- Importación de archivos de respuesta/rendición
- Registro automático de cobros y rechazos
- Reintento de rechazos

**Modelos ya existentes en BD:**
- ConfiguracionDebito
- ArchivoDebito
- DetalleDebito
- ImportacionCobranza

**Archivos a crear:**
```javascript
server/src/services/debitoAutomatico.js
server/src/routes/debito.js
client/src/pages/admin/DebitoAutomatico.jsx
```

**Documentación:** `docs/13-DEBITO-AUTOMATICO.md`

---

#### **5. Conciliación Bancaria**

**Funcionalidad:**
- Importación de extractos bancarios (OFX, CSV, PDF manual)
- Conciliación automática de movimientos
- Conciliación manual
- Reporte de movimientos no conciliados

**Modelos ya existentes en BD:**
- ExtractoBancario
- MovimientoExtracto
- Conciliacion

**Archivos a crear:**
```javascript
server/src/services/conciliacionBancaria.js
server/src/routes/conciliacion.js
client/src/pages/admin/ConciliacionBancaria.jsx
```

**Documentación:** `docs/14-CONCILIACION-BANCARIA.md`

---

### ❌ PENDIENTES - PRIORIDAD BAJA

#### **6. Cierre de Caja Diario**

- [ ] Resumen diario de movimientos
- [ ] Comparar saldo sistema vs saldo real
- [ ] Registro de diferencias (faltantes/sobrantes)
- [ ] Reporte de cierre de caja PDF

---

#### **7. Reportes Avanzados**

**✅ Ya implementados:**
- Reporte de Socios
- Reporte de Cuotas
- Reporte de Actividades

**❌ Falta:**
- [ ] Dashboard ejecutivo con KPIs (resumen general)
- [ ] Reporte de morosidad general
- [ ] Morosidad por actividad/categoría
- [ ] Reporte de ingresos vs egresos
- [ ] Exportación avanzada (Excel/PDF personalizados)
- [ ] Gráficos de evolución temporal
- [ ] Proyecciones de cobranza

---

#### **8. PWA y Mejoras Mobile**

- [ ] Convertir portal del socio en PWA instalable
- [ ] Funcionalidad offline (datos cacheados)
- [ ] Push notifications
- [ ] Mejoras de UX mobile
- [ ] QR accesible rápidamente desde home screen

---

## ROADMAP DETALLADO - Orden Sugerido

### **Corto Plazo (Próximas 2-4 semanas)**

1. **Completar Sistema de Inscripciones** ⭐ CRÍTICO
   - CRUD de inscripciones
   - Validaciones (edad, cupos)
   - Vista de plantel
   - Asignación de entrenadores
   - **Impacto:** Core del negocio del club

2. **Formulario Público Alta Socios** ⭐ CRÍTICO
   - Recopilar campos del Google Forms
   - Implementar formulario público
   - Workflow de aprobación
   - **Impacto:** Automatización de altas

3. **Asientos Contables Automáticos** ⭐ ALTA
   - Migración: agregar cuentaContableId a Caja
   - Crear servicio asientosContables.js
   - Integrar en endpoints de pagos/movimientos
   - **Impacto:** Control contable automático

4. **Notificaciones Automáticas** ⭐ ALTA
   - Cron jobs para envíos programados
   - Emails de vencimientos
   - Log de notificaciones
   - **Impacto:** Mejora cobranza y experiencia del socio

### **Mediano Plazo (1-2 meses)**

5. **Completar Portal del Socio**
   - Cuenta corriente completa
   - Descarga de comprobantes
   - Actualización de datos
   - **Impacto:** Autogestión del socio

6. **Débito Automático**
   - Prisma y/o Payway
   - **Impacto:** Automatización de cobranza

7. **Conciliación Bancaria**
   - Importación extractos
   - Conciliación automática/manual
   - **Impacto:** Control financiero

### **Largo Plazo (3-6 meses)**

8. **App Móvil Nativa para Socios** ⭐⭐ ESTRATÉGICO
   - React Native (iOS + Android)
   - MVP: Carnet QR, Cuenta corriente, Pagos, Actividades
   - Chat grupal por equipo + comunicación club
   - Reservas de instalaciones
   - Newsfeed y comunidad
   - **Impacto:** Experiencia del socio de clase mundial
   - **Documentación:** `docs/19-APP-MOVIL-SOCIOS.md`

9. Cierre de Caja Diario
10. Reportes Avanzados

---

## Modelos Principales del Schema

| Modulo | Modelos |
|--------|---------|
| Socios | Socio, GrupoFamiliar, AutorizacionMenor, Cobrador |
| Deportes | Actividad, CategoriaActividad, Inscripcion, EntrenadorCategoria, Entrenamiento, Espacio, TipoEspacio |
| Cuotas | Periodo, Cargo (unificado), ConfiguracionRecargo |
| Pagos | MedioPago, Pago, LinkPago |
| Caja | Caja, CuentaBancaria, CuentaContable, MovimientoCaja, Concepto |
| Contabilidad | Asiento, AsientoLinea |
| Financiero | Entidad, MovimientoContable, OrdenCompra, Pedido, LiquidacionSueldo |
| Stock | Producto, CategoriaProducto, VarianteProducto, FotoProducto, MovimientoStock |
| Debito | ConfiguracionDebito, ArchivoDebito, DetalleDebito, ImportacionCobranza |
| Conciliacion | ExtractoBancario, MovimientoExtracto, Conciliacion |
| Usuarios | Admin, Rol, Permiso, PermisoRol |
| Comercios | Comercio, Rubro, Venta |
| Templates | EmailTemplate, PdfTemplate |
| Sistema | Configuracion, AuditLog |

---

## URLs y Rutas

| URL | Descripcion |
|-----|-------------|
| `/mi-qr` | Socio obtiene su QR |
| `/s/{tokenPortal}` | Portal del socio |
| `/c/{token}` | Portal del comerciante |
| `/admin` | Panel de administracion |
| `/admin/socios` | Gestión de socios |
| `/admin/periodos` | Gestión de periodos y cuotas |
| `/admin/configuracion/templates/email` | Editor de templates de email |
| `/admin/configuracion/templates/pdf` | Editor de templates de PDF |
| `/admin/configuracion/pagos` | Configuración de datos bancarios |
| `/registro` | Registro de comercios |

---

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

---

## Configuracion de Branding

Los colores y logo del club son configurables desde BD:

| Clave | Default |
|-------|---------|
| COLOR_PRIMARIO | #DC2626 |
| COLOR_SECUNDARIO | #1F2937 |
| COLOR_FONDO | #F9FAFB |
| CLUB_LOGO_URL | /images/logo.png |

---

## Configuracion de Pagos

Los datos bancarios del club son configurables desde el panel admin:

| Clave | Descripción | Ejemplo |
|-------|-------------|---------|
| PAGO_TITULAR | Titular de la cuenta | Club Sportivo Pilar |
| PAGO_CBU | CBU (22 dígitos) | 22388274837883888438 |
| PAGO_ALIAS | Alias bancario | sportivo.pilar |
| PAGO_TELEFONO | WhatsApp para comprobantes | +54 9 230 4346897 |

**Configurar desde:** `/admin/configuracion/pagos`

---

## Credenciales de Desarrollo

```
Admin: admin@rojoplus.com / admin123
```

---

## Datos del Sistema (Producción)

- **634 socios activos**
- **190 grupos familiares**
- **Sistema de comercios funcionando**
- **QR activo para descuentos**

---

## Documentación Adicional

- `docs/12-PLAN-DE-TRABAJO.md` - Plan de trabajo completo por fases
- `docs/13-DEBITO-AUTOMATICO.md` - Especificación débito automático
- `docs/14-CONCILIACION-BANCARIA.md` - Especificación conciliación
- `docs/15-PORTAL-PAGOS-ONLINE.md` - Portal del socio y pagos
- `docs/16-CONFIGURACION-BRANDING.md` - Configuración de marca
- `docs/18-SISTEMA-TEMPLATES-NOTIFICACIONES.md` - Templates y emails
- `docs/19-APP-MOVIL-SOCIOS.md` - **App móvil nativa (iOS + Android)**
- `C:\Users\marti\.claude\plans\linear-cooking-gosling.md` - Plan módulos financieros

---

*Ultima actualizacion: 29 Enero 2026*
*Sincronizado con código real - Sin inconsistencias*
