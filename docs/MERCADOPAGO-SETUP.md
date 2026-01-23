# Configuración de MercadoPago

Guía completa para integrar MercadoPago en el Portal del Socio de RojoPlus.

**Estado:** ✅ Implementado y funcionando en desarrollo

---

## 📋 **Requisitos**

1. Cuenta en MercadoPago Argentina
2. Acceso al Panel de Desarrolladores: https://www.mercadopago.com.ar/developers
3. Node.js con dependencias instaladas (`mercadopago`, `dotenv`)

---

## 🔑 **Obtener Credenciales**

### 1. Iniciar sesión en MercadoPago
- Ir a https://www.mercadopago.com.ar/developers
- Iniciar sesión con tu cuenta

### 2. Crear Aplicación
1. En el panel, ir a **"Tus integraciones"**
2. Hacer clic en **"Crear aplicación"**
3. Completar:
   - **Nombre:** RojoPlus - Club Sportivo Pilar
   - **Descripción:** Sistema de pagos de cuotas online para socios
   - **Producto:** Checkout Pro
4. Guardar

### 3. Obtener Credenciales
En la aplicación creada, ir a **"Credenciales"**:

**Modo TEST (Para desarrollo):**
- **Access Token:** `TEST-XXXX...`
- **Public Key:** `TEST-XXXX...`

**Modo PRODUCCIÓN (Para usar en vivo):**
- **Access Token:** `APP_USR-XXXX...`
- **Public Key:** `APP_USR-XXXX...`

---

## ⚙️ **Configuración en RojoPlus**

### 1. Variables de Entorno

Editar el archivo `/server/.env` y agregar:

```bash
# MercadoPago
MERCADOPAGO_ACCESS_TOKEN=TEST-1234567890-123456-abcdef1234567890-123456789
MERCADOPAGO_PUBLIC_KEY=TEST-abcd1234-5678-9abc-def0-123456789abc

# URLs
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3001
```

**IMPORTANTE:** En producción, usar las credenciales de **PRODUCCIÓN**, no TEST.

### 2. Webhook (Notificaciones)

#### Configurar en MercadoPago:
1. Ir a tu aplicación en el Panel de Desarrolladores
2. Ir a **"Webhooks"**
3. Agregar nueva URL:
   - **URL de Producción:** `https://tudominio.com/api/pagos/webhook/mercadopago`
   - **URL de Desarrollo (opcional):** Usar herramientas como ngrok

#### Eventos a suscribirse:
- ✅ **payment** (obligatorio)
- ✅ **merchant_order** (opcional)

---

## 🧪 **Testing en Desarrollo**

### 1. Crear Usuarios de Prueba (OBLIGATORIO)

⚠️ **IMPORTANTE:** Para probar pagos en modo desarrollo, DEBES crear usuarios de prueba en MercadoPago.

1. Andá a https://www.mercadopago.com.ar/developers/panel/test-users
2. Creá dos usuarios:
   - **Usuario Vendedor** (seller)
   - **Usuario Comprador** (buyer)
3. Guardá las credenciales del **Usuario Vendedor** (Access Token y Public Key)
4. Configurá esas credenciales en tu `.env`

### 2. Usar Tarjetas de Prueba

Una vez configurados los usuarios de prueba, usá estas tarjetas:

**Tarjeta Aprobada:**
- Número: `5031 7557 3453 0604`
- CVV: `123`
- Vencimiento: `11/25`
- Titular: `APRO`
- DNI: `12345678`

**Tarjeta Rechazada:**
- Número: `5031 4332 1540 6351`
- Titular: `FAIL`

Más tarjetas de prueba: https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/additional-content/test-cards

### 3. Probar el Flujo

**Opción A - Con usuario comprador logueado (recomendado):**
1. Abrí una ventana de incógnito
2. Andá a https://www.mercadopago.com.ar
3. Iniciá sesión con el **usuario comprador de prueba**
4. Volvé a tu aplicación (en la misma ventana de incógnito)
5. Ingresá al Portal del Socio
6. Ir a la sección **"Pagos"**
7. Seleccionar una o más cuotas pendientes
8. Click en **"Pagar con MercadoPago"**
9. Serás redirigido al checkout (ya logueado)
10. Usar tarjeta de prueba APRO
11. Confirmar pago
12. En localhost, tendrás que cerrar manualmente la ventana de MP y volver a tu portal
13. Deberías ver el modal de éxito

**Opción B - Sin loguear:**
1. Ingresá directamente al portal
2. Hacé el pago sin estar logueado en MercadoPago
3. Usá los datos de la tarjeta de prueba

---

## ⚙️ **Configuración Actual**

### Webhook en Desarrollo (localhost)

El sistema detecta automáticamente si estás en localhost y **NO envía** el `notification_url` a MercadoPago. Esto evita errores ya que MercadoPago no puede llamar a localhost.

**En desarrollo:**
- ❌ Webhook deshabilitado
- ⚠️ Los pagos NO se confirman automáticamente en la BD
- ✅ El flujo de pago funciona correctamente
- ✅ El usuario ve el modal de confirmación

**En producción (URL real):**
- ✅ Webhook se habilita automáticamente
- ✅ Los pagos se confirman automáticamente
- ✅ Todo funciona end-to-end

### Auto-return en localhost

El `auto_return: 'approved'` está **deshabilitado** en desarrollo porque MercadoPago no acepta localhost en las back_urls con auto-return.

**En desarrollo:**
- ⚠️ El usuario debe hacer click en "Volver al sitio" manualmente
- ✅ O simplemente cerrar la ventana y volver manualmente

**En producción:**
- ✅ Descomentar `auto_return: 'approved'` en `server/src/services/mercadopago.js`
- ✅ Redirección automática después del pago

---

## 🔐 **Webhooks en Desarrollo (Ngrok) - OPCIONAL**

Si querés probar webhooks en desarrollo local, podés usar **ngrok**:

### Instalar Ngrok
```bash
npm install -g ngrok
```

### Exponer el servidor local
```bash
ngrok http 3001
```

Esto te dará una URL pública como:
```
https://abc123def456.ngrok.io
```

### Configurar Webhook en MercadoPago
Usar la URL:
```
https://abc123def456.ngrok.io/api/pagos/webhook/mercadopago
```

---

## 📊 **Monitorear Pagos**

### Panel de MercadoPago
- Ir a: https://www.mercadopago.com.ar/activities
- Ver todas las transacciones
- Filtrar por estado (aprobadas, pendientes, rechazadas)

### Base de Datos RojoPlus
Consulta SQL para ver pagos recientes:

```sql
SELECT
  lp.id,
  lp.concepto,
  lp.montoTotal,
  lp.estado,
  lp.plataforma,
  lp.fechaPago,
  s.apellidoNombre as socio
FROM "LinkPago" lp
JOIN "Socio" s ON lp.socioId = s.id
ORDER BY lp.createdAt DESC
LIMIT 20;
```

---

## ⚠️ **Errores Comunes**

### 1. "Access token inválido"
**Solución:** Verificar que el `MERCADOPAGO_ACCESS_TOKEN` en `.env` sea correcto.

### 2. "Webhook no recibe notificaciones"
**Solución:**
- Verificar que la URL sea accesible públicamente
- En desarrollo, usar ngrok
- Verificar en Panel MP que el webhook esté activo

### 3. "Pago aprobado pero no se registra"
**Solución:**
- Revisar logs del servidor: `/server/logs`
- Verificar que el webhook esté recibiendo la notificación
- Check que el `external_reference` coincida con el `linkPagoId`

---

## 🚀 **Pase a Producción**

### Checklist antes de ir a producción:

#### 1. Actualizar Variables de Entorno
```bash
# URLs reales
FRONTEND_URL=https://tudominio.com
BACKEND_URL=https://api.tudominio.com

# Credenciales productivas (NO de usuarios de prueba)
MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxxx-produccion
MERCADOPAGO_PUBLIC_KEY=APP_USR-xxxx-produccion
```

#### 2. Habilitar auto_return
Descomentar en `server/src/services/mercadopago.js` línea 55:
```javascript
auto_return: 'approved', // Redirigir automáticamente si fue aprobado
```

#### 3. Configurar Webhook en MercadoPago
1. Ir a https://www.mercadopago.com.ar/developers/panel
2. Seleccionar tu aplicación
3. Ir a **"Webhooks"**
4. Agregar URL: `https://api.tudominio.com/api/pagos/webhook/mercadopago`
5. Marcar evento: ✅ `payment`

#### 4. Verificar dependencias instaladas
```bash
cd server
npm install dotenv mercadopago
```

#### 5. Checklist final
- [ ] Variables de entorno configuradas con URLs reales
- [ ] Credenciales de PRODUCCIÓN (no de prueba)
- [ ] `auto_return` descomentado
- [ ] Webhook configurado en panel de MercadoPago
- [ ] Testear flujo completo con tarjeta real
- [ ] Verificar que el webhook actualice automáticamente los pagos
- [ ] Backup de base de datos antes del cambio

### Diferencias Desarrollo vs Producción

| Feature | Desarrollo (localhost) | Producción (URLs reales) |
|---------|----------------------|--------------------------|
| Webhook | ❌ Deshabilitado | ✅ Habilitado automáticamente |
| Auto-return | ❌ Deshabilitado | ✅ Habilitado (descomentar) |
| Confirmación de pago | ⚠️ Manual | ✅ Automática vía webhook |
| Redirección | ⚠️ Click "Volver" | ✅ Automática |
| Credenciales | Usuarios de prueba | Credenciales productivas |

---

## 📚 **Documentación Oficial**

- [Checkout Pro](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/landing)
- [Webhooks](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/additional-content/your-integrations/notifications/webhooks)
- [Tarjetas de Prueba](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/additional-content/test-cards)
- [API Reference](https://www.mercadopago.com.ar/developers/es/reference)

---

## 💡 **Soporte**

Si tenés problemas con la integración:

1. Revisar logs del servidor
2. Verificar credenciales
3. Consultar documentación oficial
4. Contactar soporte de MercadoPago

---

*Última actualización: Enero 2026*
