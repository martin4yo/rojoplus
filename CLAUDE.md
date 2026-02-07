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

## 📅 ÚLTIMA SESIÓN (7 Febrero 2026 - Noche 8)

**Tema: Diseño FASE 39 - Módulo Buffet/Restaurant**

### ✅ ANÁLISIS Y DISEÑO COMPLETADO

Se diseñó el módulo completo de gestión de Buffet/Restaurant con 16 etapas y ~180 items:

**Estructura del módulo:**
- **39.1** Modelos de Datos Base (20 items) - 19 modelos Prisma
- **39.2** Configuración de Impresoras y Destinos (13 items) - Sistema ESC/POS con enrutamiento
- **39.3** Gestión de Carta/Menú (18 items) - CRUD productos, variantes, modificadores, recetas
- **39.4** Gestión de Mesas y Zonas (15 items) - Layout visual con drag & drop
- **39.5** Reservas (12 items) - Sistema de reservas con notificaciones
- **39.6** Turnos de Mozos (12 items) - Control de turnos y asignación de mesas
- **39.7** Toma de Comandas (32 items) - App PWA tablet + versión móvil celular
- **39.8** Pantalla Cocina KDS (17 items) - Kitchen Display System
- **39.9** Cierre de Mesa y Cobro (16 items) - División de cuentas, múltiples pagos
- **39.10** Pedidos Take Away (13 items) - Pedidos para llevar
- **39.11** Punto de Venta Kiosco (10 items) - Venta rápida
- **39.12** Caja del Buffet (15 items) - Apertura, cierre, arqueo
- **39.13** Reportes y Analytics (21 items) - Dashboard y reportes gerenciales
- **39.14** Integraciones Avanzadas (15 items) - Socios, Stock, Contabilidad
- **39.15** Menú y Navegación (4 items) - Rutas y permisos
- **39.16** PWA y Modo Offline (10 items) - Funcionamiento sin conexión

**Sistema de Impresión Térmica:**
- Modelo `ImpresoraTermica` (nombre, tipo, IP, puerto)
- Modelo `DestinoImpresion` (categoría → impresora)
- Al enviar comanda: agrupa items por categoría, envía a impresora correspondiente
- Ejemplo: BEBIDAS → Impresora BARRA, COMIDAS → Impresora COCINA

**Integraciones CRÍTICAS con RojoPlus (especificadas por el usuario):**

1. **Menú en Sidebar (AdminLayout.jsx):**
   - Submenú "Buffet" integrado igual que Deportes, Ingresos, Egresos
   - NO es una aplicación separada, usa el mismo layout admin
   - Acceso controlado por permisos del sistema

2. **Permisos (Sistema existente Fase 38):**
   - Los permisos de Buffet se agregan a `seed.js` junto con los demás
   - Se crean en tabla `Permiso` existente
   - El frontend usa `tienePermiso()` de `permisos.js` existente
   - Códigos: BUFFET_VER, BUFFET_CARTA, BUFFET_MESAS, BUFFET_COBRAR, etc.

3. **Tesorería y Cobranza (100% INTEGRADO):**
   - **NO** se crea CajaBuffet separada - se usa `Caja` existente con tipo BUFFET
   - Cobros generan `MovimientoCaja` en la caja del club
   - Usa `MedioPago` existentes (Efectivo, Tarjeta, QR)
   - Genera `Asiento` contable automático igual que otros cobros
   - Centro de costo BUFFET para análisis separado
   - CierreBuffet permite cierres independientes del buffet

4. **Stock (NO DUPLICAR PRODUCTOS):**
   - Productos del buffet se dan de alta en el módulo Stock **existente**
   - Nuevo campo `esParaBuffet` (boolean) al modelo Producto existente
   - **Usuario con permiso BUFFET solo ve productos con esParaBuffet=true**
   - Usuario con permiso STOCK_VER ve todos los productos
   - El CRUD de productos se reutiliza, solo cambia el filtro por permisos

5. **Otras:**
   - Socios: QR para identificación, descuentos, cuenta corriente con límite
   - Ingredientes: RecetaIngrediente para descuento automático de stock

**App Mozo - Versiones Tablet y Móvil:**

| Versión | Archivo | Características |
|---------|---------|-----------------|
| Tablet | TomaComanda.jsx | Grid categorías, layout horizontal |
| Móvil | TomaComandaMobile.jsx | Chips horizontales, drawer bottom, swipe gestures |

- Detección automática por ancho de pantalla (< 768px = móvil)
- Ambas versiones PWA con modo offline
- Push notifications con vibración en móvil

### 📁 Archivo Modificado

```
ROADMAP.md   # +650 líneas (FASE 39 completa con 16 etapas y ~188 items)
```

---

## 📅 SESIÓN ANTERIOR (7 Febrero 2026 - Noche 7)

**Tema: Completando Items Pendientes de Prioridad Media y Baja**

### ✅ ITEMS COMPLETADOS ESTA SESIÓN

**33.6.23-25 - Pasaje Automático de Categoría (Mejoras Finales):**
- Cron job `sugerirPasajesCron` agregado (1 de diciembre 8:00 AM)
- Función `notificarPasajeCategoria()` para notificar a padres/tutores
- Campo `exceptuadoPasaje` y `motivoExcepcion` en modelo Inscripcion
- Endpoints `/exceptuar/:id` y `/excepciones` en pasajeCategoria.js
- `sugerirPasajesCron.stop()` agregado a `detenerCronJobs()`

**33.7.4 - Notificación Nuevo Entrenamiento desde UI:**
- Push payload `NUEVO_ENTRENAMIENTO` agregado
- Función `notificarNuevoEntrenamiento()` en notificacionService.js
- Endpoint `POST /entrenamientos/:id/notificar` en deportes.js
- Botón "Notificar" en modal de entrenamiento (EntrenamientosCalendario.jsx)

**33.7.8 - Notificación Pasaje Categoría:**
- Función `notificarPasajeCategoria()` ya existía - marcado como completado

### 📁 Archivos Modificados

```
# Backend
server/src/jobs/notificaciones.js              # +sugerirPasajesCron.stop()
server/src/services/notificacionService.js     # +NUEVO_ENTRENAMIENTO payload, +notificarNuevoEntrenamiento()
server/src/routes/deportes.js                  # +endpoint /entrenamientos/:id/notificar

# Frontend
client/src/pages/admin/deportes/EntrenamientosCalendario.jsx  # +botón Notificar

# Documentación
ROADMAP.md                                     # Items 33.6.23-25, 33.7.4, 33.7.8 marcados completados
```

---

## 📅 SESIÓN ANTERIOR (7 Febrero 2026 - Noche 6)

**Tema: Páginas Adicionales Sitio Público + Chat con Entrenadores**

### ✅ FASE 37.13-16 - PÁGINAS ADICIONALES SITIO PÚBLICO - 100% COMPLETADO

**Frontend - Nuevas Páginas Públicas:**

1. **ActividadDetalle.jsx** (230 líneas):
   - Hero con imagen de la actividad
   - Listado de categorías con rangos de edad
   - Horarios por categoría (días y horas)
   - Sidebar con CTA de inscripción
   - Links a página de actividades

2. **Calendario.jsx** (250 líneas):
   - Vista mes con navegación
   - Vista lista alternativa
   - Muestra partidos y entrenamientos
   - Colores por tipo de evento
   - Leyenda de tipos

3. **Galeria.jsx** (220 líneas):
   - Grid de álbumes
   - Grid de fotos
   - Lightbox con navegación teclado
   - Contador de fotos
   - Estructura preparada para modelo Album

4. **NotFound.jsx** (70 líneas):
   - Página 404 con logo
   - Botones Ir al inicio / Volver
   - Links útiles a secciones principales

**Backend - Endpoints Públicos:**
- `GET /api/public/calendario?year=&month=` - Eventos del mes
- `GET /api/public/galeria` - Álbumes y fotos
- `GET /api/public/galeria/album/:id` - Fotos de un álbum

**Rutas App.jsx:**
- `/actividades/:id` → ActividadDetalle
- `/calendario` → Calendario
- `/galeria` → Galeria
- `/*` (404) → NotFound

**ActividadesGrid actualizado:**
- Cards ahora son `<Link>` clickeables
- Animación en flecha "Ver más"

### ✅ FASE 34.14-16 - CHAT CON ENTRENADORES - 100% COMPLETADO

**Modelos Prisma (schema.prisma +50 líneas):**

```prisma
model Conversacion {
  id, socioId, entrenadorId, categoriaActividadId
  asunto, estado (ACTIVA/ARCHIVADA/CERRADA)
  ultimoMensaje, mensajesNoLeidos
  relaciones: socio, entrenador, categoriaActividad, mensajes[]
}

model Mensaje {
  id, conversacionId, emisorTipo (SOCIO/ENTRENADOR)
  emisorId, contenido, leido, fechaLeido, createdAt
}
```

**Endpoints (socio.js +400 líneas):**
- `GET /socio/:token/conversaciones` - Lista de conversaciones
- `POST /socio/:token/conversaciones` - Crear conversación + primer mensaje
- `GET /socio/:token/conversaciones/:id/mensajes` - Mensajes de conversación
- `POST /socio/:token/conversaciones/:id/mensajes` - Enviar mensaje
- `GET /socio/:token/entrenadores-disponibles` - Entrenadores contactables

**Funcionalidades:**
- Marcar mensajes como leídos automáticamente
- Contador de mensajes no leídos
- Solo muestra entrenadores de actividades donde está inscripto
- Agrupa entrenadores por categoría

### 📁 Archivos Creados/Modificados Esta Sesión

```
# Frontend - Páginas Públicas
client/src/pages/public/ActividadDetalle.jsx     # NUEVO (230 líneas)
client/src/pages/public/Calendario.jsx           # NUEVO (250 líneas)
client/src/pages/public/Galeria.jsx              # NUEVO (220 líneas)
client/src/pages/public/NotFound.jsx             # NUEVO (70 líneas)
client/src/components/public/ActividadesGrid.jsx # Modificado (Link + animación)
client/src/App.jsx                               # +8 líneas (rutas + imports)

# Backend - Endpoints Públicos
server/src/routes/public.js                      # +100 líneas (calendario, galeria)

# Backend - Chat
server/src/routes/socio.js                       # +400 líneas (5 endpoints chat)
server/prisma/schema.prisma                      # +50 líneas (Conversacion, Mensaje)

# Documentación
ROADMAP.md                                       # Marcados 37.13-16, 34.14-16
```

---

## 📅 SESIÓN ANTERIOR (7 Febrero 2026 - Noche 5)

**Tema: Items de Prioridad Baja + Notificaciones Deportivas**

### ✅ ITEMS COMPLETADOS EN ESTA SESIÓN

**1. Verificación Conciliación Bancaria (Fase 36):**
- Confirmado que ya estaba 100% implementado
- Backend: 919 líneas en `conciliacionBancaria.js`
- Frontend: `ConciliacionBancaria.jsx` (777 líneas) + `ConciliacionDetalle.jsx` (511 líneas)
- Formatos: OFX, CSV, TXT con configuración parametrizable
- Funcionalidades: Importación, matching automático, conciliación manual, historial

**2. Selector Centro de Costo (32.20):**
- Agregado `CentroCostoSelector` a `MovimientoCajaForm.jsx`
- Backend: Actualizado endpoint para aceptar `centroCostoId`
- Facturas e items pendientes (menor prioridad)

**3. Rutas Deportes (33.8.x):**
- Verificado que todas las rutas ya existían
- Marcado como completado en ROADMAP

**4. Notificaciones Deportivas Automáticas (33.7.x):**

Backend (`notificacionService.js` +150 líneas):
- `notificarConvocatoriaPartido()` - Email + Push al convocar
- `notificarRecordatorioPartido()` - Recordatorio 24h antes
- `verificarPartidosProximos()` - Busca partidos de mañana
- `notificarCancelacionEntrenamiento()` - A todos los inscriptos

Push payloads nuevos:
- `CONVOCATORIA_PARTIDO`
- `RECORDATORIO_PARTIDO`
- `CANCELACION_ENTRENAMIENTO`

Cron job (`notificaciones.js`):
- Nuevo job: `verificarPartidosCron` - Todos los días a las 18:00
- Busca partidos de mañana y notifica a convocados confirmados

### 📁 Archivos Modificados Esta Sesión

```
# Backend - Centro de Costo
server/src/routes/tesoreria.js                    # +2 líneas (centroCostoId)

# Frontend - Centro de Costo
client/src/pages/admin/tesoreria/MovimientoCajaForm.jsx  # +10 líneas

# Backend - Notificaciones Deportivas
server/src/services/notificacionService.js        # +150 líneas (4 funciones nuevas)
server/src/jobs/notificaciones.js                 # +20 líneas (cron partidos)

# Documentación
ROADMAP.md                                        # Marcados 33.5.10, 33.7.x, 33.8.x, 32.20, 36
```

---

## 📅 SESIÓN ANTERIOR (7 Febrero 2026 - Noche 4)

**Tema: Verificación Conciliación Bancaria - Ya estaba completa**

---

## 📅 SESIÓN ANTERIOR (7 Febrero 2026 - Noche 3)

**Tema: Fixes API Response Handling + PDF Export Reportes Deportivos**

### ✅ FIXES API RESPONSE HANDLING - USUARIOS Y ROLES

**Problema identificado:** Las páginas de Usuarios y Roles mostraban datos vacíos o errores al editar.

**Causa raíz:** El servicio `api.get()` ya extrae `data.data` de la respuesta (línea 41 de api.js), pero el código esperaba respuestas envueltas.

**Solución aplicada - Patrón universal:**
```javascript
// Antes (incorrecto):
setUsuarios(usrsData.data || [])

// Después (correcto):
setUsuarios(usrsData?.data || usrsData || [])
```

**Archivos corregidos:**
- `UsuariosLista.jsx` líneas 31-32 (usuarios y roles)
- `UsuarioForm.jsx` líneas 38 y 48 (roles y usuario individual)
- `RolesLista.jsx` línea 25 (roles)
- `RolForm.jsx` líneas 35-36 y 48 (permisos y rol individual)

**Fix adicional - Permisos en edición de rol:**
- Problema: Los permisos no se mostraban al editar un rol
- Causa: `api.get('/admin/permisos')` solo retorna `data.data`, perdiendo el campo `agrupados`
- Solución: Cambiar a `api.getFull('/admin/permisos')` que retorna la respuesta completa

### ✅ PDF EXPORT - REPORTES DEPORTIVOS

**Agregado botón "PDF" junto al de "Excel" en ReportesDeportivos.jsx:**

Nueva función `exportarPDF()` (~170 líneas) que:
- Genera HTML formateado con estilos inline
- Abre ventana de impresión del navegador
- Permite guardar como PDF o imprimir

**Características por tab:**
- **Asistencia:** Tabla con socio, categoría, asistencias, %, fechas del reporte
- **Partidos:** KPIs generales + tabla por categoría con G/P/E y goles
- **Ranking:** Tabla de goleadores con medallas (🥇🥈🥉), promedio por partido
- **Jugador:** Ficha completa del jugador seleccionado con todas sus estadísticas

**Iconos:** FileText (lucide-react) para el botón PDF

### 📁 Archivos Modificados Esta Sesión

```
# Frontend - Fixes API Response
client/src/pages/admin/usuarios/UsuariosLista.jsx   # líneas 31-32
client/src/pages/admin/usuarios/UsuarioForm.jsx     # líneas 38, 48
client/src/pages/admin/usuarios/RolesLista.jsx      # línea 25
client/src/pages/admin/usuarios/RolForm.jsx         # líneas 35-36, 48

# Frontend - PDF Export
client/src/pages/admin/ReportesDeportivos.jsx       # +170 líneas (exportarPDF, botón)
```

---

## 📅 SESIÓN ANTERIOR (7 Febrero 2026 - Noche 2)

**Tema: Integración de Permisos en Frontend + Mi Perfil + Exportación Excel**

### ✅ FASE 38.19 - PROTECCIÓN DE RUTAS/BOTONES SEGÚN PERMISOS - COMPLETADO

**Frontend (AdminLayout.jsx):**

Cambios realizados:
- Importado servicio de permisos (`cargarPermisos`, `limpiarPermisos`, `tieneAlgunPermiso`, etc.)
- Agregado estado `permisosLoaded` para tracking de carga
- Carga automática de permisos al iniciar sesión (si no están cargados)
- Limpieza de permisos al hacer logout
- **Menú filtrado según permisos del usuario:**
  - Dashboard: visible para todos
  - Dashboard Ejecutivo: requiere `REPORTES_VER`
  - Socios: requiere `SOCIOS_VER`
  - Solicitudes: requiere `SOCIOS_VER` o `SOCIOS_CREAR`
  - Inscripciones: requiere `INSCRIPCIONES_VER`
  - Cuotas: requiere `CUOTAS_VER`
  - Ingresos: requiere `INGRESOS_VER`
  - Egresos: requiere `EGRESOS_VER`
  - Sueldos: requiere `SUELDOS_VER`
  - Tesorería: requiere `CAJA_VER` (subitems con permisos específicos)
  - Stock: requiere `STOCK_VER`
  - Contabilidad: requiere `CONTABILIDAD_VER`
  - Deportes: requiere `DEPORTES_VER` (subitems con permisos específicos)
  - Comercios: requiere `COMERCIOS_GESTIONAR`
  - Publicidad/Noticias: requiere `CONTENIDO_VER`
  - Reportes: requiere `REPORTES_VER`
  - Configuración: requiere `CONFIG_VER`

**Login.jsx:**
- Agregada llamada a `cargarPermisos()` después del login exitoso

### ✅ FASE 38.20 - MI PERFIL Y CAMBIO DE CONTRASEÑA - COMPLETADO

**Frontend (MiPerfil.jsx - NUEVO, 200 líneas):**
- Muestra información del usuario: nombre, email, rol, estado
- Formulario de cambio de contraseña con:
  - Contraseña actual (requerida para cambio propio)
  - Nueva contraseña
  - Confirmación de contraseña
  - Botones para mostrar/ocultar contraseñas
  - Validaciones: longitud mínima 6, coincidencia, diferente a actual
  - Mensajes de éxito/error

**AdminLayout.jsx:**
- Agregado enlace a "Mi Perfil" en header (desktop y mobile)
- Icono User junto al nombre del usuario

**Backend (usuarios.js):**
- Mejorado endpoint `POST /usuarios/:id/cambiar-password`:
  - Si es cambio propio: requiere `passwordActual` y `passwordNueva`
  - Si es admin cambiando otro: solo requiere `password`
  - Verifica contraseña actual con bcrypt antes de cambiar

**App.jsx:**
- Agregada ruta `/admin/mi-perfil` → `MiPerfil`

### ✅ FASE 33.5.10 - EXPORTAR REPORTES DEPORTIVOS A EXCEL/PDF - COMPLETADO

**Frontend (ReportesDeportivos.jsx):**
- Exportación Excel con `xlsx` (ya existía)
- Exportación PDF via ventana de impresión (agregado en sesión posterior)
- Botones "Excel" y "PDF" en el header
- Nombre de archivo incluye fecha actual

### ✅ PROTECCIÓN DE BOTONES SEGÚN PERMISOS - COMPLETADO

**40+ páginas protegidas con el patrón:**
```javascript
import { tienePermiso, PERMISOS } from '../../services/permisos'

{tienePermiso(PERMISOS.XXX) && (
  <button>...</button>
)}
```

**Páginas protegidas (lista completa):**

| Página | Permisos |
|--------|----------|
| Socios.jsx | SOCIOS_CREAR |
| SocioDetalle.jsx | SOCIOS_EDITAR |
| Inscripciones.jsx | INSCRIPCIONES_GESTIONAR |
| Periodos.jsx | CUOTAS_GENERAR |
| Comercios.jsx | COMERCIOS_GESTIONAR |
| Noticias.jsx | CONTENIDO_GESTIONAR |
| Publicidad.jsx | CONTENIDO_GESTIONAR |
| CierreCaja.jsx | CAJA_CIERRE |
| DebitoAutomatico.jsx | DEBITO_AUTOMATICO |
| Autoridades.jsx | CONTENIDO_GESTIONAR |
| Partidos.jsx | DEPORTES_PARTIDOS |
| PartidoDetalle.jsx | DEPORTES_PARTIDOS |
| PasajeCategoria.jsx | DEPORTES_PASAJE |
| UsuariosLista.jsx | USUARIOS_GESTIONAR |
| RolesLista.jsx | USUARIOS_GESTIONAR |
| CajasLista.jsx | CAJA_MOVIMIENTOS |
| MovimientosCajaLista.jsx | CAJA_MOVIMIENTOS, CAJA_ANULAR |
| TransferenciasLista.jsx | CAJA_MOVIMIENTOS |
| ProductosLista.jsx | STOCK_GESTIONAR |
| CategoriasProducto.jsx | STOCK_GESTIONAR |
| MovimientosStockLista.jsx | STOCK_GESTIONAR |
| PlanCuentasLista.jsx | CONTABILIDAD_ASIENTOS |
| AsientosLista.jsx | CONTABILIDAD_ASIENTOS |
| PresupuestosLista.jsx | CONTABILIDAD_PRESUPUESTO |
| LiquidacionesLista.jsx | SUELDOS_GESTIONAR |
| ConceptosLiquidacion.jsx | SUELDOS_GESTIONAR |
| OrdenesCompraLista.jsx | EGRESOS_GESTIONAR |
| FacturasCompraLista.jsx | EGRESOS_GESTIONAR |
| OrdenesPagoLista.jsx | EGRESOS_GESTIONAR |
| PedidosLista.jsx | INGRESOS_GESTIONAR |
| FacturasVentaLista.jsx | INGRESOS_GESTIONAR |
| RecibosCobroLista.jsx | INGRESOS_GESTIONAR |
| EntidadesLista.jsx | Dinámico según tipo |
| EspaciosLista.jsx | DEPORTES_VER |
| HorariosRecurrentes.jsx | DEPORTES_ENTRENAMIENTOS |
| EntrenamientosCalendario.jsx | DEPORTES_ENTRENAMIENTOS |
| AsistenciaEntrenamiento.jsx | DEPORTES_ENTRENAMIENTOS |
| ActividadesLista.jsx | ACTIVIDADES_GESTIONAR |
| ActividadForm.jsx | ACTIVIDADES_GESTIONAR |
| Solicitudes.jsx | SOCIOS_CREAR |
| EntrenadoresLista.jsx | DEPORTES_ENTRENAMIENTOS |
| EmailTemplates.jsx | CONFIG_EDITAR |
| PdfTemplates.jsx | CONFIG_EDITAR |
| ConfiguracionLista.jsx | CONFIG_EDITAR |
| ConfiguracionPagos.jsx | CONFIG_EDITAR |
| TablasAuxiliares.jsx | CONFIG_EDITAR |

### 📁 Archivos Creados/Modificados

```
# Frontend
client/src/pages/admin/Login.jsx                 # +2 líneas (import + cargarPermisos)
client/src/components/AdminLayout.jsx            # +120 líneas (permisos en menú, enlace Mi Perfil)
client/src/pages/admin/MiPerfil.jsx              # NUEVO (200 líneas)
client/src/pages/admin/ReportesDeportivos.jsx    # +100 líneas (exportación Excel)
client/src/App.jsx                               # +2 líneas (import + ruta)

# Páginas con protección de botones (46 archivos)
client/src/pages/admin/Socios.jsx
client/src/pages/admin/SocioDetalle.jsx
client/src/pages/admin/Inscripciones.jsx
client/src/pages/admin/Periodos.jsx
client/src/pages/admin/Comercios.jsx
client/src/pages/admin/Noticias.jsx
client/src/pages/admin/Publicidad.jsx
client/src/pages/admin/CierreCaja.jsx
client/src/pages/admin/DebitoAutomatico.jsx
client/src/pages/admin/Autoridades.jsx
client/src/pages/admin/Partidos.jsx
client/src/pages/admin/PartidoDetalle.jsx
client/src/pages/admin/PasajeCategoria.jsx
client/src/pages/admin/usuarios/UsuariosLista.jsx
client/src/pages/admin/usuarios/RolesLista.jsx
client/src/pages/admin/tesoreria/*.jsx
client/src/pages/admin/stock/*.jsx
client/src/pages/admin/contabilidad/*.jsx
client/src/pages/admin/liquidaciones/*.jsx
client/src/pages/admin/egresos/*.jsx
client/src/pages/admin/ingresos/*.jsx
client/src/pages/admin/entidades/*.jsx
client/src/pages/admin/deportes/*.jsx
client/src/pages/admin/ActividadesLista.jsx
client/src/pages/admin/ActividadForm.jsx
client/src/pages/admin/Solicitudes.jsx
client/src/pages/admin/EntrenadoresLista.jsx
client/src/pages/admin/templates/EmailTemplates.jsx
client/src/pages/admin/templates/PdfTemplates.jsx
client/src/pages/admin/ConfiguracionLista.jsx
client/src/pages/admin/ConfiguracionPagos.jsx
client/src/pages/admin/TablasAuxiliares.jsx

# Backend
server/src/routes/usuarios.js                    # +20 líneas (mejora cambio password)
```

---

## 📅 SESIÓN ANTERIOR (7 Febrero 2026 - Noche)

**Tema: FASES 33.5, 33.6 y 38 - Reportes Deportivos, Pasaje Categoría y Permisos**

### ✅ FASE 33.5 - REPORTES DEPORTIVOS - 100% COMPLETADO

**Backend (400+ líneas en reportesDeportivos.js):**

Endpoints:
- `GET /api/admin/reportes/deportivos/asistencia` - Resumen asistencia con stats por socio
- `GET /api/admin/reportes/deportivos/asistencia/socio/:socioId` - Detalle individual
- `GET /api/admin/reportes/deportivos/partidos` - Estadísticas de partidos (ganados/perdidos/empates)
- `GET /api/admin/reportes/deportivos/goleadores` - Ranking de goleadores
- `GET /api/admin/reportes/deportivos/asistidores` - Ranking de asistidores
- `GET /api/admin/reportes/deportivos/jugador/:socioId` - Stats completas de jugador

**Frontend (650 líneas en ReportesDeportivos.jsx):**
- 4 tabs: Asistencia, Partidos, Ranking (goles/asistencias), Jugador individual
- Filtros por actividad, categoría, fechas
- Gráficos con Recharts
- KPIs con colores

### ✅ FASE 33.6 - PASAJE AUTOMÁTICO CATEGORÍA - 100% COMPLETADO

**Backend (350+ líneas en pasajeCategoria.js):**

Endpoints:
- `GET /api/admin/categorias/pasaje/revisar` - Lista socios que necesitan pasaje
- `POST /api/admin/categorias/pasaje/ejecutar` - Ejecutar pasajes seleccionados
- `GET /api/admin/categorias/pasaje/historial` - Ver historial de pasajes
- `GET /api/admin/categorias/pasaje/estadisticas` - Estadísticas anuales

**Funcionalidades:**
- Cálculo automático de edades a fecha de referencia (1ro enero próximo año)
- Detección de socios fuera de rango de edad
- Sugerencia de categoría destino
- Ejecución masiva de pasajes
- Manejo de socios sin categoría disponible (alertas)
- Historial y estadísticas

**Frontend (650 líneas en PasajeCategoria.jsx):**
- 3 tabs: Revisar Pasajes, Historial, Estadísticas
- Selección múltiple de pasajes a ejecutar
- Vista de socios en rango vs fuera de rango
- Filtros por actividad y fecha de referencia

### ✅ FASE 38 - USUARIOS, ROLES Y PERMISOS - MEJORADO

**Backend (mejoras en auth.js y usuarios.js):**

Middleware de permisos:
- `checkPermiso(...permisos)` - Middleware para verificar permisos en rutas
- Cache de permisos con TTL de 5 minutos
- `invalidarCachePermisos()` - Función para invalidar cache

Endpoints nuevos:
- `GET /api/admin/mis-permisos` - Obtener permisos del usuario actual

**Permisos expandidos (seed.js):**
```
SOCIOS: VER, CREAR, EDITAR, ELIMINAR
INSCRIPCIONES: VER, GESTIONAR
ACTIVIDADES: VER, GESTIONAR
DEPORTES: VER, PARTIDOS, ENTRENAMIENTOS, PASAJE
CUOTAS: VER, GENERAR, BONIFICAR, DEBITO_AUTOMATICO
TESORERIA: CAJA_VER, CAJA_COBRAR, CAJA_MOVIMIENTOS, CAJA_ANULAR, CAJA_CIERRE
CONTABILIDAD: VER, ASIENTOS, PRESUPUESTO
STOCK: VER, GESTIONAR
INGRESOS/EGRESOS: VER, GESTIONAR
SUELDOS: VER, GESTIONAR
REPORTES: VER, EXPORTAR
CONTENIDO: VER, GESTIONAR
CONFIG: VER, EDITAR
SISTEMA: USUARIOS_GESTIONAR, COMERCIOS_GESTIONAR
```

**Frontend (servicio permisos.js):**
- `cargarPermisos()` - Cargar permisos del usuario al iniciar sesión
- `tienePermiso(codigo)` - Verificar permiso específico
- `tieneAlgunPermiso(...permisos)` - Verificar si tiene alguno
- `tieneTodosLosPermisos(...permisos)` - Verificar si tiene todos
- `esAdmin()` - Verificar si es super admin
- Constantes `PERMISOS` con todos los códigos

### 📁 Archivos Creados/Modificados

```
# Backend
server/src/routes/reportesDeportivos.js          # NUEVO (400 líneas)
server/src/routes/pasajeCategoria.js             # NUEVO (350 líneas)
server/src/routes/usuarios.js                    # +60 líneas (mis-permisos)
server/src/middleware/auth.js                    # +80 líneas (checkPermiso, cache)
server/prisma/seed.js                            # +30 líneas (permisos expandidos)
server/src/index.js                              # +4 líneas (rutas)

# Frontend
client/src/pages/admin/ReportesDeportivos.jsx    # NUEVO (650 líneas)
client/src/pages/admin/PasajeCategoria.jsx       # NUEVO (650 líneas)
client/src/services/permisos.js                  # NUEVO (200 líneas)
client/src/App.jsx                               # +4 líneas
client/src/components/AdminLayout.jsx            # +2 líneas
```

---

## 📅 SESIÓN ANTERIOR (7 Febrero 2026 - Tarde)

**Tema: FASE 33.4 - Gestión de Partidos y Eventos Deportivos**

### ✅ PARTIDOS Y EVENTOS - 100% COMPLETADO

**Backend (650+ líneas en deportes.js):**

Endpoints de Partidos:
- `GET /api/admin/deportes/partidos` - Listar con filtros
- `GET /api/admin/deportes/partidos/:id` - Detalle con convocados y estadísticas
- `POST /api/admin/deportes/partidos` - Crear partido
- `PUT /api/admin/deportes/partidos/:id` - Actualizar
- `POST /api/admin/deportes/partidos/:id/resultado` - Cargar resultado
- `POST /api/admin/deportes/partidos/:id/suspender` - Suspender
- `POST /api/admin/deportes/partidos/:id/cancelar` - Cancelar
- `DELETE /api/admin/deportes/partidos/:id` - Eliminar

Endpoints de Convocatorias:
- `GET /api/admin/deportes/partidos/:id/convocados` - Listar convocables
- `POST /api/admin/deportes/partidos/:id/convocar` - Convocar masivo
- `DELETE /api/admin/deportes/partidos/:id/convocar/:socioId` - Quitar
- `PUT /api/admin/deportes/partidos/:partidoId/convocatoria/:socioId` - Confirmar/rechazar
- `POST /api/admin/deportes/partidos/:id/notificar-convocados` - Notificar (Push, Email, WhatsApp)

Endpoints de Estadísticas:
- `GET /api/admin/deportes/partidos/:id/estadisticas` - Stats del partido
- `POST /api/admin/deportes/partidos/:id/estadisticas` - Guardar masivo
- `GET /api/admin/deportes/estadisticas/jugador/:socioId` - Stats acumuladas
- `GET /api/admin/deportes/estadisticas/ranking` - Ranking goleadores

**Frontend (1200+ líneas):**
- `Partidos.jsx` - Lista con filtros, CRUD modal (550 líneas)
- `PartidoDetalle.jsx` - 3 tabs: Convocatoria, Resultado, Estadísticas (650 líneas)

**Modelo Convocatoria actualizado** (tracking notificaciones):
```prisma
notificadoPush     Boolean?
fechaNotifPush     DateTime?
notificadoWhatsapp Boolean?
fechaNotifWhatsapp DateTime?
notificadoEmail    Boolean?
fechaNotifEmail    DateTime?
```

### 📁 Archivos Creados/Modificados

```
server/src/routes/deportes.js                    # +650 líneas
server/prisma/schema.prisma                      # +6 líneas
client/src/pages/admin/Partidos.jsx              # NUEVO
client/src/pages/admin/PartidoDetalle.jsx        # NUEVO
client/src/App.jsx                               # +4 líneas
client/src/components/AdminLayout.jsx            # +1 línea
```

---

## 📅 SESIÓN ANTERIOR (7 Febrero 2026 - Mañana)

**Tema: Mejoras Sitio Institucional + Bugs Fixes**

### ✅ AUTORIDADES CRUD - CORREGIDO

**Problema:** El CRUD de Autoridades mostraba vacío y la página pública usaba datos mock.

**Causa:** El backend no devolvía el formato esperado `{ success: true, data: ... }`.

**Solución:**
- Corregido formato de respuesta en todas las rutas de `autoridades.js`
- Agregadas validaciones `Array.isArray()` y optional chaining en frontend

### ✅ PERÍODO COMISIÓN DIRECTIVA - IMPLEMENTADO

**Requerimiento:** Campo "Período" global para toda la Comisión Directiva (no por integrante).

**Implementación:**
- Nuevo endpoint `GET/PUT /api/admin/autoridades/config/periodo`
- Usa tabla `Configuracion` con clave `PERIODO_COMISION_DIRECTIVA`
- Campo editable en el CRUD de Autoridades
- Se muestra en la página pública de Autoridades

### ✅ BANNERS MULTI-PÁGINA - IMPLEMENTADO

**Requerimiento:** Poder seleccionar múltiples páginas donde mostrar un banner.

**Cambios en schema:**
```prisma
# Antes
ubicacion     String?
# Después
ubicaciones   String[]  @default([])
```

**Cambios en backend:**
- Filtro con `{ ubicaciones: { has: ubicacion } }`
- POST/PUT aceptan array de ubicaciones

**Cambios en frontend:**
- Checkboxes para selección múltiple de páginas
- Páginas disponibles: Home, Actividades, Noticias, Historia, Contacto, Autoridades, Comercios

### ✅ MEJORAS VISUALES SITIO PÚBLICO

| Cambio | Archivo |
|--------|---------|
| "Palmarés" → "Logros Deportivos" | Historia.jsx |
| Agregado banner HEADER | Historia.jsx |
| Fondo unificado `bg-gray-300` | Comercios.jsx, Noticias.jsx, ActividadesGrid.jsx |
| Imágenes noticias sin recortar | Noticias.jsx, NoticiaDetalle.jsx |

**Detalle imágenes noticias:**
- Removidas alturas fijas (`h-48`, `h-72`, `h-40`)
- Cambiado `object-cover` por `h-auto`
- Imagen principal detalle: `max-h-[500px] object-contain`
- Noticias relacionadas: `h-auto` con escala `scale-105`

### 📁 Archivos Modificados

```
# Backend
server/src/routes/autoridades.js              # +50 líneas (formato respuesta, endpoints periodo)
server/src/routes/banners.js                  # Cambio ubicacion → ubicaciones[]
server/prisma/schema.prisma                   # Banner.ubicaciones String[]

# Frontend Admin
client/src/pages/admin/Autoridades.jsx        # Fix undefined, campo periodo global
client/src/pages/admin/Publicidad.jsx         # Multi-select ubicaciones

# Frontend Público
client/src/pages/public/Autoridades.jsx       # Usa periodo desde API
client/src/pages/public/Historia.jsx          # Banner HEADER, "Logros Deportivos"
client/src/pages/public/Noticias.jsx          # bg-gray-300, imágenes sin recortar
client/src/pages/public/NoticiaDetalle.jsx    # Imágenes sin recortar
client/src/pages/public/Comercios.jsx         # bg-gray-300
client/src/components/public/ActividadesGrid.jsx  # bg-gray-300
```

---

## 📅 SESIÓN ANTERIOR (6 Febrero 2026)

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
| **Sitio Institucional** | ✅ Historia, Autoridades, Noticias, Comercios, Banners |
| **Gestión Deportiva (Partidos)** | ✅ CRUD, Convocatorias, Resultados, Estadísticas, Rankings |
| **Reportes Deportivos** | ✅ Asistencia, Partidos, Goleadores, Asistidores, Stats Jugador |
| **Pasaje Categoría** | ✅ Revisión automática, ejecución masiva, historial |
| **Usuarios, Roles y Permisos** | ✅ CRUD, middleware checkPermiso, cache, 30+ permisos |
| **Conciliación Bancaria** | ✅ Formatos parametrizables, importación, conciliación auto/manual |
| **Notificaciones Deportivas** | ✅ Convocatoria, recordatorio 24h, cancelación entrenamiento |

### 🟡 PENDIENTES - PRIORIDAD MEDIA

| Fase | Item | Descripción |
|------|------|-------------|
| 31 | Control de Accesos | Molinetes, lectores QR, registros de entrada/salida |

### ⏳ PENDIENTES - PRIORIDAD BAJA

| Fase | Item | Descripción |
|------|------|-------------|
| 18 | Testing y QA | Pruebas completas de flujos |
| 34.14-16 | Portal Socio - Chat | Conversaciones con entrenadores |
| 34.29-30 | Portal Socio - UX | Toast notifications, testing responsive |
| 35.10-20 | Débito Automático | Payway y Débito Directo Bancario |
| 37.13-16 | Sitio Institucional | Detalle actividad, calendario, galería, 404 |

### ⏳ LARGO PLAZO

- **App Móvil Nativa** (React Native iOS + Android) - Especificada en docs/19-APP-MOVIL-SOCIOS.md

---

## 🚀 RESUMEN DE PENDIENTES (desde ROADMAP.md)

### ✅ FASES 100% COMPLETADAS

| Fase | Descripción |
|------|-------------|
| 1-7 | Setup, Backend Base, Auth, Comercios, Socios, Ventas |
| 9-16 | Templates, Frontend Base, Registro, Admin Completo |
| 19-27 | Producción, QR, Familias, Actividades, Cuotas, Comercios Públicos |
| 28-30 | Ingresos/Egresos/Tesorería/Stock, Plan Cuentas, Presupuesto |
| 33.1-33.8 | Gestión Deportiva Completa (Espacios, Entrenamientos, Asistencia, Partidos, Reportes, Pasaje, Notificaciones, Rutas) |
| 35.1-35.9 | Débito Automático Prisma |
| 36 | Conciliación Bancaria (formatos parametrizables, importación, conciliación auto/manual) |
| 37.1-37.12, 37.17 | Sitio Institucional (páginas principales) |
| 38 | Usuarios, Roles y Permisos (CRUD + protección frontend) |

### 🟡 FASES PARCIALMENTE COMPLETADAS

| Fase | Completado | Pendiente |
|------|------------|-----------|
| 8 | Reportes básicos | 8.3 Exportar ventas |
| 17 | Admin Reportes | 17.5 Botón exportar |
| 32 | Centros de Costo + Selector MovCaja | Selector en Facturas |
| 33.7 | Notificaciones convocatoria/recordatorio | Panel config usuario |
| 34 | Portal Socio (login, pagos, actividades) | 34.14-16 Chat, 34.29-30 UX |
| 35 | Prisma Medios de Pago | 35.10-20 Payway, Débito Bancario |
| 37 | Páginas principales | 37.13-16 Detalle actividad, calendario, galería, 404 |

### ⏳ FASES SIN INICIAR

| Fase | Descripción | Prioridad |
|------|-------------|-----------|
| 18 | Testing y QA completo | Baja |
| 31 | Control de Accesos (molinetes) | Media |

### Notas Técnicas para Retomar

1. **Ejecutar seed de permisos:** Si no se ha ejecutado, correr `npx prisma db seed` para poblar los 30+ permisos nuevos.

2. **Cargar permisos al login:** Verificar que `cargarPermisos()` se llame después del login en el frontend.

3. **Archivos clave de referencia:**
   - Backend permisos: `server/src/middleware/auth.js` (checkPermiso, cache)
   - Frontend permisos: `client/src/services/permisos.js`
   - Lista de permisos: `server/prisma/seed.js`

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
| **Públicas** | |
| `/` | Home institucional |
| `/historia` | Historia del club |
| `/autoridades` | Comisión Directiva |
| `/noticias` | Listado de noticias |
| `/noticias/:slug` | Detalle de noticia |
| `/actividades` | Actividades deportivas |
| `/comercios` | Comercios adheridos |
| `/contacto` | Formulario de contacto |
| **Socios** | |
| `/mi-qr` | Socio obtiene su QR |
| `/s/{tokenPortal}` | Portal del socio |
| `/inscripcion-socio` | Formulario público alta socios |
| **Comercios** | |
| `/c/{token}` | Portal del comerciante |
| `/registro` | Registro de comercios |
| **Admin** | |
| `/admin` | Panel de administración |
| `/admin/socios` | Gestión de socios |
| `/admin/solicitudes` | Aprobación solicitudes alta |
| `/admin/inscripciones` | Gestión de inscripciones |
| `/admin/periodos` | Gestión de periodos y cuotas |
| `/admin/cierres-caja` | Cierre de caja diario |
| `/admin/publicidad` | Banners y sponsors |
| `/admin/autoridades` | CRUD Comisión Directiva |
| `/admin/noticias` | CRUD Noticias |
| `/admin/configuracion/templates/email` | Editor templates email |
| `/admin/configuracion/templates/pdf` | Editor templates PDF |

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
M client/src/App.jsx
M client/src/components/AdminLayout.jsx
M client/src/components/public/BannerPublicitario.jsx
M client/src/pages/admin/Publicidad.jsx
M client/src/pages/public/Noticias.jsx
M server/prisma/schema.prisma
M server/src/index.js

Untracked:
?? client/src/pages/admin/Noticias.jsx
?? server/src/routes/noticias.js

Recent commits:
160d961 Ajuste en Noticias
5768059 Ajustes en sitio institucional
dc4a029 Ajustes finales antes de prod
```

---

*Última actualización: 7 Febrero 2026 - Noche 7*
*Estado: Sistema 99% completo - Fases 1-30, 32, 33 (completo), 35 (Prisma), 36, 37, 38 completadas*
*Pendientes: Control Accesos (31), Payway (35.10-20), Panel notificaciones por socio (33.7.9 - futuro)*
