# Portal de Socio - Pagos Online

## Descripción

El portal de socio permite a los socios:
1. Ver su estado de cuenta
2. Ver cuotas pendientes
3. Generar link de pago (MercadoPago o MODO)
4. Ver historial de pagos
5. Descargar su código QR para descuentos

---

## Plataformas de Pago

### MercadoPago
- **Integración**: API Checkout Pro
- **Métodos**: Tarjetas, transferencia, efectivo (Rapipago/PagoFácil)
- **Comisión**: ~4-5% según plan
- **Webhook**: Notificación de pago
- **Acreditación**: Inmediata con tarjeta

### MODO
- **Integración**: API MODO
- **Métodos**: Débito desde cuenta bancaria
- **Bancos**: Galicia, Macro, BBVA, Santander, etc.
- **Comisión**: Menor que MercadoPago
- **Acreditación**: 24-48hs

---

## Flujo de Pago Online

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  1. Socio       │────▶│  2. Generar     │────▶│  3. Redirigir   │
│  selecciona     │     │  preferencia    │     │  a plataforma   │
│  cuotas         │     │  de pago        │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
┌─────────────────┐     ┌─────────────────┐            │
│  5. Registrar   │◀────│  4. Webhook     │◀───────────┘
│  pago y         │     │  de pago        │
│  actualizar     │     │  aprobado       │
└─────────────────┘     └─────────────────┘
```

### 1. Selección de Cuotas
- Socio accede a su portal via token único
- Ve listado de cuotas pendientes
- Selecciona cuotas a pagar
- Sistema calcula total (con recargos si aplican)

### 2. Generar Preferencia
- Sistema crea `LinkPago` en BD
- Llama a API de MercadoPago/MODO
- Obtiene `init_point` (URL de pago)
- Guarda `preference_id` para tracking

### 3. Redirección
- Socio es redirigido a checkout externo
- Completa el pago en MercadoPago/MODO
- Es redirigido de vuelta al portal

### 4. Webhook
- Plataforma notifica estado del pago
- Sistema verifica firma del webhook
- Actualiza estado del LinkPago

### 5. Registro de Pago
- Si pago aprobado:
  - Crear registro en tabla `Pago`
  - Marcar cuotas como pagadas
  - Registrar movimiento de caja
  - Enviar comprobante por email

---

## Modelo de Datos

### LinkPago

| Campo | Descripción |
|-------|-------------|
| codigo | UUID único del link |
| socioId | Socio que generó el link |
| concepto | "Cuotas Enero-Febrero 2026" |
| montoTotal | Total a pagar |
| cuotasIds | JSON con IDs de cuotas |
| plataforma | MERCADOPAGO o MODO |
| preferenceId | ID de la preferencia en MP |
| initPoint | URL para pagar |
| estado | PENDIENTE, PAGADO, EXPIRADO |
| paymentId | ID del pago en la plataforma |
| paymentStatus | Estado del pago externo |

---

## Integración MercadoPago

### Crear Preferencia

```javascript
const preference = {
  items: [{
    title: 'Cuotas Club Sportivo Pilar',
    description: 'Enero 2026, Febrero 2026',
    quantity: 1,
    unit_price: 50000,
    currency_id: 'ARS'
  }],
  payer: {
    email: socio.email,
    name: socio.nombre,
    identification: {
      type: 'DNI',
      number: socio.documento
    }
  },
  external_reference: linkPago.codigo,
  back_urls: {
    success: 'https://club.com/portal/pago-exitoso',
    failure: 'https://club.com/portal/pago-fallido',
    pending: 'https://club.com/portal/pago-pendiente'
  },
  auto_return: 'approved',
  notification_url: 'https://api.club.com/webhooks/mercadopago'
};
```

### Webhook MercadoPago

```javascript
// POST /webhooks/mercadopago
{
  "action": "payment.created",
  "data": {
    "id": "1234567890"
  }
}
```

### Verificar Pago

```javascript
const payment = await mercadopago.payment.get(paymentId);

if (payment.status === 'approved') {
  // Registrar pago
  await registrarPago(payment.external_reference, payment);
}
```

---

## Integración MODO

### Crear Intención de Pago

```javascript
const intencion = {
  amount: 50000,
  description: 'Cuotas Club Sportivo Pilar',
  externalId: linkPago.codigo,
  callbackUrl: 'https://api.club.com/webhooks/modo'
};
```

### Webhook MODO

```javascript
// POST /webhooks/modo
{
  "eventType": "PAYMENT_COMPLETED",
  "paymentId": "modo-123456",
  "externalId": "uuid-del-link",
  "status": "APPROVED"
}
```

---

## Interfaz del Portal

### Vista de Cuenta Corriente

```
┌────────────────────────────────────────────────────────┐
│  CLUB SPORTIVO PILAR - Portal del Socio               │
├────────────────────────────────────────────────────────┤
│  Socio: Juan García (#12345)                          │
│  Estado: ACTIVO                                        │
├────────────────────────────────────────────────────────┤
│  CUOTAS PENDIENTES                                     │
│  ┌────────────────────────────────────────────────┐   │
│  │ [ ] Cuota Social - Enero 2026      $25.000    │   │
│  │ [ ] Cuota Social - Febrero 2026    $25.000    │   │
│  │ [ ] Básquet Sub-14 - Enero 2026    $15.000    │   │
│  └────────────────────────────────────────────────┘   │
│                                                        │
│  Total seleccionado: $0                               │
│                                                        │
│  [Pagar con MercadoPago]  [Pagar con MODO]           │
├────────────────────────────────────────────────────────┤
│  MI CÓDIGO QR                                          │
│  [Ver/Descargar QR para descuentos en comercios]      │
└────────────────────────────────────────────────────────┘
```

### Pantalla Post-Pago

**Éxito:**
```
✓ Pago recibido exitosamente

Monto: $65.000
Fecha: 18/01/2026
Referencia: PAY-2026-00123

Las cuotas han sido marcadas como pagadas.
Recibirás un comprobante por email.

[Volver al Portal]
```

**Pendiente:**
```
⏳ Pago en proceso

Tu pago está siendo procesado.
Te notificaremos cuando se acredite.

[Volver al Portal]
```

---

## Configuración

### Variables de Entorno

```env
# MercadoPago
MP_ACCESS_TOKEN=APP_USR-xxx
MP_PUBLIC_KEY=APP_USR-xxx

# MODO
MODO_CLIENT_ID=xxx
MODO_CLIENT_SECRET=xxx
MODO_MERCHANT_ID=xxx

# URLs
PORTAL_URL=https://sportivo.axiomacloud.com
API_URL=https://api.sportivo.axiomacloud.com
```

### Configuración en BD

| Clave | Valor |
|-------|-------|
| PAGOS_MP_HABILITADO | true |
| PAGOS_MODO_HABILITADO | true |
| PAGOS_MP_COMISION_PCT | 4.5 |
| PAGOS_MODO_COMISION_PCT | 1.2 |

---

## Seguridad

1. **Validación de Webhook**: Verificar firma/origen
2. **Idempotencia**: No procesar el mismo pago dos veces
3. **Token único**: Cada socio accede solo a sus datos
4. **HTTPS**: Todas las comunicaciones encriptadas
5. **Logs**: Registrar todos los intentos de pago
