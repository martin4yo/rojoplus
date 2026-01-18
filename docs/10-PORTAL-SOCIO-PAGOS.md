# Portal del Socio y Pagos Online

## 1. Portal del Socio

Acceso via `/mi-cuenta` o `/s/{tokenPortal}` (ya existente, se amplía).

### 1.1 Pantalla Principal

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ┌──────┐  ROJO PLUS - Portal del Socio                                │
│  │ LOGO │  Club Sportivo Pilar                                         │
│  └──────┘                                                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  👤 Juan Pérez                           Socio #1234            │   │
│  │  ────────────────────────────────────────────────────────────   │   │
│  │  Estado: ✅ ACTIVO          Categoría: PLENO                    │   │
│  │  Grupo Familiar: Familia Pérez (4 miembros)                     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      ESTADO DE CUENTA                            │   │
│  │  ┌─────────────────────────────────────────────────────────┐    │   │
│  │  │  💰 Saldo Actual                                        │    │   │
│  │  │                                                          │    │   │
│  │  │     $45.000                                              │    │   │
│  │  │     ───────                                              │    │   │
│  │  │     3 cuotas pendientes                                  │    │   │
│  │  │                                                          │    │   │
│  │  │  [        PAGAR AHORA        ]                          │    │   │
│  │  └─────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │   📋 MIS     │ │   🏃 MIS     │ │   📄 MI      │ │   📱 MI      │   │
│  │   DATOS      │ │ ACTIVIDADES  │ │  CUENTA      │ │   QR         │   │
│  │              │ │              │ │  CORRIENTE   │ │              │   │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Sección: Mis Datos

```
┌─────────────────────────────────────────────────────────────────────────┐
│  MIS DATOS                                              [Editar]       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  DATOS PERSONALES                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Nombre: Juan Carlos Pérez                                       │   │
│  │ DNI: 35.123.456                                                  │   │
│  │ Fecha Nac.: 15/03/1990 (34 años)                                │   │
│  │ Email: juan.perez@email.com                                      │   │
│  │ Celular: 11-1234-5678                                            │   │
│  │ Dirección: Av. Ejemplo 1234, Pilar                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  GRUPO FAMILIAR                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Familia Pérez (Titular)                                         │   │
│  │ ─────────────────────────────────────────────────────────────   │   │
│  │ • María Pérez (Esposa) - #1235                                  │   │
│  │ • Tomás Pérez (Hijo, 12 años) - #1236 - Fútbol Sub-13          │   │
│  │ • Lucía Pérez (Hija, 9 años) - #1237 - Natación                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  CONTACTOS DE EMERGENCIA                                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 1. María Pérez (Esposa) - 11-9876-5432                          │   │
│  │ 2. Carlos Pérez (Hermano) - 11-5555-4444                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Sección: Mis Actividades

```
┌─────────────────────────────────────────────────────────────────────────┐
│  MIS ACTIVIDADES                                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ACTIVIDADES DEL GRUPO FAMILIAR                                         │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 🏃 Tomás Pérez - Fútbol Sub-13                                  │   │
│  │    Entrenamiento: Lunes y Miércoles 17:00-19:00                 │   │
│  │    Lugar: Cancha 2                                               │   │
│  │    Entrenador: Roberto Gómez                                     │   │
│  │    Cuota: $10.000/mes                                            │   │
│  │    Estado: ✅ Al día                                             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 🏊 Lucía Pérez - Natación Infantil                              │   │
│  │    Entrenamiento: Martes y Jueves 16:00-17:00                   │   │
│  │    Lugar: Pileta cubierta                                        │   │
│  │    Entrenador: Ana Martínez                                      │   │
│  │    Cuota: $12.000/mes                                            │   │
│  │    Estado: ⚠️ 1 cuota pendiente                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.4 Sección: Mi Cuenta Corriente

```
┌─────────────────────────────────────────────────────────────────────────┐
│  MI CUENTA CORRIENTE                           Saldo: $45.000 (Deuda)  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  CUOTAS PENDIENTES                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ ☑️ Enero 2026 - Cuota Social Familiar      $15.000    Venc: 10/01│   │
│  │    + Recargo 10%                            $1.500              │   │
│  │ ☑️ Enero 2026 - Natación (Lucía)           $12.000    Venc: 10/01│   │
│  │    + Recargo 10%                            $1.200              │   │
│  │ ☑️ Febrero 2026 - Cuota Social Familiar    $15.000    Venc: 10/02│   │
│  │ ─────────────────────────────────────────────────────────────   │   │
│  │ TOTAL SELECCIONADO:                        $44.700              │   │
│  │                                                                  │   │
│  │ [  PAGAR SELECCIONADAS  ]  [ PAGAR TODO $45.000 ]              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  HISTORIAL DE MOVIMIENTOS                     [Filtrar] [Descargar]    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 15/12/25 │ Pago #P-2025-0456 - Efectivo    │        │ $35.000  │   │
│  │ 01/12/25 │ Dic 2025 - Cuota Social         │$15.000 │          │   │
│  │ 01/12/25 │ Dic 2025 - Fútbol (Tomás)       │$10.000 │          │   │
│  │ 01/12/25 │ Dic 2025 - Natación (Lucía)     │$12.000 │          │   │
│  │ ...      │                                  │        │          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Integración de Pagos Online

### 2.1 Flujo de Pago

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PAGAR CUOTAS                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Cuotas seleccionadas:                                                  │
│  • Enero 2026 - Cuota Social Familiar + Recargo     $16.500            │
│  • Enero 2026 - Natación (Lucía) + Recargo          $13.200            │
│  ─────────────────────────────────────────────────────────────────      │
│  TOTAL A PAGAR:                                     $29.700            │
│                                                                         │
│  SELECCIONA MÉTODO DE PAGO:                                             │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐   │   │
│  │  │               │    │               │    │               │   │   │
│  │  │  MERCADO      │    │     MODO      │    │ TRANSFERENCIA │   │   │
│  │  │    PAGO       │    │               │    │   BANCARIA    │   │   │
│  │  │               │    │               │    │               │   │   │
│  │  └───────────────┘    └───────────────┘    └───────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  💡 El pago se acreditará automáticamente en tu cuenta                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Modelo de Datos para Pagos Online

```prisma
// Agregar al schema

model IntentoPago {
  id                  Int       @id @default(autoincrement())
  uuid                String    @unique @default(uuid()) // Para URLs públicas
  socioId             Int       @map("socio_id")
  grupoFamiliarId     Int?      @map("grupo_familiar_id")

  // Monto y detalle
  montoTotal          Decimal   @map("monto_total") @db.Decimal(12, 2)
  cuotasIds           String    @map("cuotas_ids") // JSON array de IDs

  // Proveedor de pago
  proveedor           String    // MERCADOPAGO, MODO
  proveedorPreferenceId String? @map("proveedor_preference_id")
  proveedorPaymentId  String?   @map("proveedor_payment_id")

  // Estado
  estado              String    @default("PENDIENTE") // PENDIENTE, APROBADO, RECHAZADO, EXPIRADO
  fechaCreacion       DateTime  @default(now()) @map("fecha_creacion")
  fechaExpiracion     DateTime  @map("fecha_expiracion")
  fechaPago           DateTime? @map("fecha_pago")

  // Respuesta del proveedor
  proveedorStatus     String?   @map("proveedor_status")
  proveedorResponse   Json?     @map("proveedor_response")

  // Relación con pago generado
  pagoId              Int?      @unique @map("pago_id")

  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")

  socio               Socio     @relation(fields: [socioId], references: [id])
  pago                Pago?     @relation(fields: [pagoId], references: [id])

  @@index([uuid])
  @@index([estado])
  @@index([proveedorPaymentId])
  @@map("intentos_pago")
}
```

### 2.3 Endpoints de Pago

```
// Crear intento de pago
POST /api/socio/:tokenPortal/pagos/crear
Body: {
  cuotasIds: [1, 2, 3],
  proveedor: "MERCADOPAGO" | "MODO"
}
Response: {
  intentoId: "uuid",
  redirectUrl: "https://mercadopago.com/...",
  qrCode: "base64..." // para MODO
}

// Webhook de notificación (llamado por MercadoPago/MODO)
POST /api/webhooks/mercadopago
POST /api/webhooks/modo

// Verificar estado de pago
GET /api/socio/:tokenPortal/pagos/:intentoId/estado

// Página de retorno post-pago
GET /api/socio/:tokenPortal/pagos/:intentoId/resultado
```

### 2.4 Integración MercadoPago

```javascript
// server/src/services/mercadopago.js

import { MercadoPagoConfig, Preference } from 'mercadopago';

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

export async function crearPreferencia(intento, cuotas, socio) {
  const items = cuotas.map(cuota => ({
    id: cuota.id.toString(),
    title: `${cuota.periodo.nombre} - ${cuota.tipoCuota.nombre}`,
    quantity: 1,
    unit_price: Number(cuota.montoTotal),
    currency_id: 'ARS',
  }));

  const preference = await new Preference(client).create({
    body: {
      items,
      payer: {
        email: socio.email,
        name: socio.nombre,
        surname: socio.apellido,
      },
      external_reference: intento.uuid,
      back_urls: {
        success: `${process.env.FRONTEND_URL}/s/${socio.tokenPortal}/pago-exitoso`,
        failure: `${process.env.FRONTEND_URL}/s/${socio.tokenPortal}/pago-fallido`,
        pending: `${process.env.FRONTEND_URL}/s/${socio.tokenPortal}/pago-pendiente`,
      },
      auto_return: 'approved',
      notification_url: `${process.env.API_URL}/api/webhooks/mercadopago`,
      expires: true,
      expiration_date_to: intento.fechaExpiracion.toISOString(),
    },
  });

  return preference;
}
```

### 2.5 Datos para Transferencia Bancaria

```
┌─────────────────────────────────────────────────────────────────────────┐
│  TRANSFERENCIA BANCARIA                                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Datos para transferir:                                                 │
│                                                                         │
│  Titular: Club Sportivo Pilar                                          │
│  CUIT: 30-12345678-9                                                    │
│  Banco: Banco Galicia                                                   │
│  Tipo: Cuenta Corriente en Pesos                                        │
│  CBU: 0070999030004123456789                                            │
│  Alias: CLUB.SPORTIVO.PILAR                                            │
│                                                                         │
│  Monto exacto: $29.700                                                  │
│  Referencia: SOCIO-1234-ENE26                                          │
│                                                                         │
│  ⚠️ IMPORTANTE:                                                         │
│  • Usa la referencia indicada para identificar tu pago                 │
│  • El pago se acreditará en 24-48 horas hábiles                        │
│  • Envía el comprobante a tesoreria@clubsportivopilar.com             │
│                                                                         │
│  [Copiar CBU]  [Copiar Alias]  [Copiar Referencia]                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Sistema de Temas y Colores Configurables

### 3.1 Modelo de Configuración

```prisma
// Agregar a Configuracion existente

// Claves de configuración de tema:
// TEMA_COLOR_PRIMARIO = "#DC2626"
// TEMA_COLOR_PRIMARIO_HOVER = "#B91C1C"
// TEMA_COLOR_PRIMARIO_LIGHT = "#FEE2E2"
// TEMA_COLOR_SECUNDARIO = "#1F2937"
// TEMA_COLOR_EXITO = "#10B981"
// TEMA_COLOR_ERROR = "#EF4444"
// TEMA_COLOR_ADVERTENCIA = "#F59E0B"
// TEMA_COLOR_INFO = "#3B82F6"
// TEMA_COLOR_FONDO = "#F9FAFB"
// TEMA_COLOR_FONDO_CARD = "#FFFFFF"
// TEMA_COLOR_TEXTO = "#111827"
// TEMA_COLOR_TEXTO_SECUNDARIO = "#6B7280"
// TEMA_LOGO_URL = "/images/logo.png"
// TEMA_FAVICON_URL = "/favicon.ico"
// TEMA_NOMBRE_CLUB = "Club Sportivo Pilar"
// TEMA_SLOGAN = "El Rojo de la Avenida"
```

### 3.2 Endpoint de Configuración

```
GET /api/config/tema
Response: {
  colores: {
    primario: "#DC2626",
    primarioHover: "#B91C1C",
    primarioLight: "#FEE2E2",
    secundario: "#1F2937",
    exito: "#10B981",
    error: "#EF4444",
    advertencia: "#F59E0B",
    info: "#3B82F6",
    fondo: "#F9FAFB",
    fondoCard: "#FFFFFF",
    texto: "#111827",
    textoSecundario: "#6B7280"
  },
  branding: {
    logoUrl: "/images/logo.png",
    faviconUrl: "/favicon.ico",
    nombreClub: "Club Sportivo Pilar",
    slogan: "El Rojo de la Avenida"
  }
}
```

### 3.3 Variables CSS Dinámicas

```css
/* client/src/index.css */

:root {
  /* Colores primarios */
  --color-primary: var(--theme-primary, #DC2626);
  --color-primary-hover: var(--theme-primary-hover, #B91C1C);
  --color-primary-light: var(--theme-primary-light, #FEE2E2);

  /* Colores secundarios */
  --color-secondary: var(--theme-secondary, #1F2937);

  /* Estados */
  --color-success: var(--theme-success, #10B981);
  --color-error: var(--theme-error, #EF4444);
  --color-warning: var(--theme-warning, #F59E0B);
  --color-info: var(--theme-info, #3B82F6);

  /* Fondos */
  --color-bg: var(--theme-bg, #F9FAFB);
  --color-bg-card: var(--theme-bg-card, #FFFFFF);

  /* Texto */
  --color-text: var(--theme-text, #111827);
  --color-text-secondary: var(--theme-text-secondary, #6B7280);
}
```

### 3.4 Hook de Tema (React)

```jsx
// client/src/hooks/useTema.js

import { useEffect, useState } from 'react';
import api from '../services/api';

export function useTema() {
  const [tema, setTema] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargarTema() {
      try {
        const data = await api.get('/config/tema');
        setTema(data);
        aplicarTema(data.colores);
      } catch (error) {
        console.error('Error cargando tema:', error);
      } finally {
        setLoading(false);
      }
    }
    cargarTema();
  }, []);

  return { tema, loading };
}

function aplicarTema(colores) {
  const root = document.documentElement;
  root.style.setProperty('--theme-primary', colores.primario);
  root.style.setProperty('--theme-primary-hover', colores.primarioHover);
  root.style.setProperty('--theme-primary-light', colores.primarioLight);
  root.style.setProperty('--theme-secondary', colores.secundario);
  root.style.setProperty('--theme-success', colores.exito);
  root.style.setProperty('--theme-error', colores.error);
  root.style.setProperty('--theme-warning', colores.advertencia);
  root.style.setProperty('--theme-info', colores.info);
  root.style.setProperty('--theme-bg', colores.fondo);
  root.style.setProperty('--theme-bg-card', colores.fondoCard);
  root.style.setProperty('--theme-text', colores.texto);
  root.style.setProperty('--theme-text-secondary', colores.textoSecundario);
}
```

### 3.5 Panel de Configuración de Tema (Admin)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CONFIGURACIÓN DE TEMA                                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  IDENTIDAD                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Logo:          [Subir imagen]  📷 logo.png                      │   │
│  │ Nombre:        [Club Sportivo Pilar                    ]        │   │
│  │ Slogan:        [El Rojo de la Avenida                  ]        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  COLORES                                                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Color Primario:      [■ #DC2626] ← Rojo institucional           │   │
│  │ Primario Hover:      [■ #B91C1C]                                │   │
│  │ Primario Claro:      [■ #FEE2E2]                                │   │
│  │ Color Secundario:    [■ #1F2937]                                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Éxito:               [■ #10B981]                                │   │
│  │ Error:               [■ #EF4444]                                │   │
│  │ Advertencia:         [■ #F59E0B]                                │   │
│  │ Info:                [■ #3B82F6]                                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Fondo:               [■ #F9FAFB]                                │   │
│  │ Fondo Cards:         [■ #FFFFFF]                                │   │
│  │ Texto:               [■ #111827]                                │   │
│  │ Texto Secundario:    [■ #6B7280]                                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  VISTA PREVIA                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  [Botón Primario]  [Botón Secundario]                           │   │
│  │  ✅ Mensaje de éxito                                            │   │
│  │  ❌ Mensaje de error                                            │   │
│  │  ⚠️ Mensaje de advertencia                                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  [Restaurar defaults]                    [Guardar cambios]             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Resumen de Nuevas Funcionalidades

### Portal del Socio (`/s/{token}` ampliado)

| Sección | Funcionalidad |
|---------|---------------|
| Mis Datos | Ver/editar datos personales, grupo familiar |
| Mis Actividades | Ver inscripciones, horarios, entrenadores |
| Mi Cuenta | Ver deuda, historial, descargar comprobantes |
| Pagar | Seleccionar cuotas, pagar con MP/MODO/transferencia |
| Mi QR | Ver y descargar QR para descuentos (existente) |

### Integración de Pagos

| Proveedor | Método |
|-----------|--------|
| MercadoPago | Checkout Pro (redirect) |
| MODO | API de pagos (QR/link) |
| Transferencia | Datos bancarios + referencia única |

### Tema Configurable

- Colores institucionales editables
- Logo y branding customizable
- Vista previa en tiempo real
- Variables CSS dinámicas

---

*Documento creado: Enero 2026*
