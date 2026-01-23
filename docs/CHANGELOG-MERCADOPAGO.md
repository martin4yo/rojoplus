# Changelog - Integración MercadoPago

## 23 Enero 2026 - Integración Completa de Pagos Online

### ✅ Implementado

#### Backend
- **Servicio MercadoPago** (`server/src/services/mercadopago.js`)
  - Función `crearPreferenciaPago()` con validación de URLs
  - Función `obtenerPago()` para consultar estado de pagos
  - Webhook condicional: se deshabilita automáticamente en localhost
  - Auto-return deshabilitado en desarrollo (solo funciona con URLs reales)
  - Logging detallado para debugging

- **Endpoints de Pagos** (`server/src/routes/socio.js`)
  - `POST /socio/:token/cuotas/:id/generar-link-pago` - Pago individual
  - `POST /socio/:token/cuotas/pagar-multiples` - Pago de múltiples cuotas
  - Corrección de queries Prisma para incluir relaciones `periodo` y `categoriaActividad`

- **Endpoints de Dashboard** (`server/src/routes/socio.js`)
  - `GET /socio/:token/estado-cuenta` - Resumen de cuotas, monto pendiente y actividades
  - `GET /socio/:token/proximos-eventos` - Lista de próximos entrenamientos (preparado para FASE 33)

- **Webhook Handler** (`server/src/routes/pagos.js`)
  - Endpoint `POST /api/pagos/webhook/mercadopago`
  - Procesamiento de notificaciones de MercadoPago
  - Actualización automática de estado de pagos
  - Marcado de cargos como PAGADO

- **Configuración**
  - Instalación de dependencia `dotenv`
  - Import de `dotenv/config` en `server/src/index.js`
  - Variables de entorno: `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_PUBLIC_KEY`, `BACKEND_URL`

#### Frontend
- **Componente PagosSocio.jsx**
  - Vista de cuotas pendientes con badges de estado (PENDIENTE/VENCIDO)
  - Resumen con KPIs: cuotas pendientes, vencidas, total a pagar
  - Botones de pago con MercadoPago y MODO
  - Opción de pagar todas las cuotas juntas
  - Historial de pagos con detalles
  - Reemplazo de `alert()` con modales personalizados
  - Manejo de errores con mensajes descriptivos

- **Portal del Socio** (`PortalSocioNuevo.jsx`)
  - Detección de query params `?pago=exito/error/pendiente`
  - Modal de confirmación al volver de MercadoPago
  - Recarga automática de datos después de pago exitoso
  - Integración con `useModal()` hook

- **Dashboard del Socio** (`DashboardSocio.jsx`)
  - Llamadas a endpoints `estado-cuenta` y `proximos-eventos`
  - Cards con estado de cuotas, actividades y acceso a QR
  - Accesos rápidos a funciones principales
  - Notificación de cuotas pendientes

### 🔧 Configuración para Desarrollo

#### Usuarios de Prueba de MercadoPago
- Se requieren usuarios de prueba (Vendedor y Comprador)
- Credenciales del vendedor se configuran en `.env`
- Usuario comprador se usa para hacer los pagos de prueba

#### Limitaciones en localhost
- ❌ Webhook deshabilitado (MercadoPago no puede llamar a localhost)
- ❌ Auto-return deshabilitado (MP no acepta localhost con auto-return)
- ⚠️ Usuario debe hacer click en "Volver al sitio" manualmente
- ⚠️ Pagos no se confirman automáticamente en BD

### 🚀 Para Producción

#### Configuración requerida:
1. Actualizar variables de entorno con URLs reales
2. Descomentar `auto_return: 'approved'` en `mercadopago.js` línea 55
3. Configurar webhook en panel de MercadoPago
4. Usar credenciales productivas (no de usuarios de prueba)

#### Funcionamiento esperado:
- ✅ Webhook se habilita automáticamente
- ✅ Redirección automática después del pago
- ✅ Confirmación automática de pagos en BD
- ✅ Experiencia de usuario completa

### 📝 Archivos Modificados

#### Backend
- `server/package.json` - Agregada dependencia `dotenv`
- `server/src/index.js` - Import de dotenv
- `server/src/services/mercadopago.js` - Nuevo servicio
- `server/src/routes/socio.js` - Endpoints de pagos y dashboard
- `server/src/routes/pagos.js` - Webhook handler
- `server/.env.example` - Variables de MercadoPago documentadas

#### Frontend
- `client/src/pages/socio/sections/PagosSocio.jsx` - Modales personalizados
- `client/src/pages/socio/PortalSocioNuevo.jsx` - Detección de respuesta MP
- `client/src/pages/socio/sections/DashboardSocio.jsx` - Nuevos endpoints

#### Documentación
- `docs/MERCADOPAGO-SETUP.md` - Guía completa actualizada
- `ROADMAP.md` - Items marcados como completados
- `docs/CHANGELOG-MERCADOPAGO.md` - Este archivo

### 🐛 Correcciones
- Fix: Queries Prisma sin incluir relaciones necesarias
- Fix: Frontend accediendo a `response.data.data` cuando solo es `response.data`
- Fix: URLs de redirección usando `/portal-socio/` en lugar de `/s/`
- Fix: Auto-return causando error en localhost
- Fix: Webhook URL con localhost causando error de validación

### 📚 Testing
- ✅ Flujo completo de pago probado en desarrollo
- ✅ Redirección a MercadoPago funcionando
- ✅ Checkout de MercadoPago cargando correctamente
- ✅ Pago con tarjeta de prueba exitoso
- ✅ Redirección de vuelta al portal
- ✅ Modal de confirmación mostrándose

### 🔜 Pendiente
- Implementar confirmación manual de pagos en admin (para desarrollo)
- Probar webhook en producción
- Integración con MODO (cuando esté disponible)
- Sistema de notificaciones por email de pagos confirmados
