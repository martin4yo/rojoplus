# Configuración de MercadoPago

Guía completa para integrar MercadoPago en el Portal del Socio de RojoPlus.

---

## 📋 **Requisitos**

1. Cuenta en MercadoPago Argentina
2. Acceso al Panel de Desarrolladores: https://www.mercadopago.com.ar/developers

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

### 1. Usar Usuarios de Prueba

MercadoPago proporciona tarjetas de prueba:

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

### 2. Probar el Flujo

1. Ingresar al Portal del Socio
2. Ir a la sección **"Pagos"**
3. Seleccionar una o más cuotas pendientes
4. Click en **"Pagar con MercadoPago"**
5. Serás redirigido al checkout de MercadoPago
6. Usar datos de prueba
7. Confirmar pago
8. Serás redirigido de vuelta al portal

---

## 🔐 **Webhooks en Desarrollo (Ngrok)**

Para recibir webhooks en desarrollo local, usa **ngrok**:

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

- [ ] Cambiar credenciales de TEST por PRODUCCIÓN en `.env`
- [ ] Configurar webhook con URL de producción
- [ ] Verificar `FRONTEND_URL` y `BACKEND_URL` apuntan a producción
- [ ] Testear flujo completo con tarjeta real
- [ ] Verificar que los recibos se envíen por email
- [ ] Configurar alertas para pagos fallidos
- [ ] Backup de base de datos antes del cambio

### Variables de Producción (.env)
```bash
MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxxx-real-production-token
MERCADOPAGO_PUBLIC_KEY=APP_USR-xxxx-real-production-key
FRONTEND_URL=https://sportivo.axiomacloud.com
BACKEND_URL=https://api.sportivo.axiomacloud.com
```

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
