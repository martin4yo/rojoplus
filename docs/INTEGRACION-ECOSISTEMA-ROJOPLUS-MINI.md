# Integración del Ecosistema RojoPlus ↔ Mini ERP
## Diseño Arquitectónico — Registro de Decisiones

**Fecha:** Abril 2026
**Contexto:** RojoPlus (gestión de clubes deportivos) y Mini ERP (sistema de gestión empresarial) son dos aplicaciones en producción del mismo equipo de desarrollo. Este documento registra la discusión completa que derivó en la arquitectura de integración adoptada.

---

## 1. El Punto de Partida

### El problema original

RojoPlus tiene desarrolladas funcionalidades de facturación electrónica (AFIP), compras y contabilidad. Mini ERP tiene esas mismas funcionalidades desarrolladas de manera más completa y robusta. La pregunta inicial fue:

> "No quiero repetir funcionalidad ni trabajo ni controles o pruebas. Quiero integrar estas funciones sin unificar las aplicaciones, pero que puedan compartirlas."

El objetivo no era fusionar las dos apps en una, sino construir un **ecosistema donde cada app pueda usar las funciones de las otras** sin programar dos veces lo mismo.

### Análisis inicial de ambas apps

#### RojoPlus
- **Stack:** React + Vite (JavaScript) + Node.js + Express + Prisma + PostgreSQL
- **Multi-tenant:** Subdomain-based
- **Especialidad:** Gestión de clubes deportivos — socios, cuotas, cobranzas, buffet, deportes, portal socio (PWA), control de accesos, eventos.
- **Estado:** En producción, multi-tenant activo.

#### Mini ERP
- **Stack:** React + Vite (TypeScript) + Node.js + Express + Prisma + PostgreSQL
- **Multi-tenant:** Row-level isolation
- **Especialidad:** ERP general — facturación electrónica AFIP completa, compras, inventario, contabilidad, cuenta corriente con OIA, e-commerce, impresión térmica y PDF.
- **Estado:** En producción con clientes reales.

### Mapa de solapamiento

| Módulo | Mini ERP | RojoPlus | Decisión |
|--------|----------|----------|----------|
| AFIP / Facturación Electrónica | ✅ Completo (WSAA + WSFEv1 + CAE + QR) | ⚠️ Básico | Usar Mini |
| Notas de Crédito/Débito AFIP | ✅ Full | ❌ No tiene | Usar Mini |
| Compras / Proveedores | ✅ Completo | ❌ No tiene | Usar Mini |
| Contabilidad (PGC, asientos, OIA) | ✅ En desarrollo avanzado | ⚠️ Básico | Usar Mini |
| Cuenta Corriente con OIA | ✅ Full (FIFO automático) | ⚠️ Parcial | Usar Mini |
| Inventario avanzado (Lotes/FIFO) | ✅ Completo | ❌ No tiene | Usar Mini |
| Impresión PDF A4 (Handlebars + Puppeteer) | ✅ Completo | ⚠️ Básico | Usar Mini |
| Buffet / Comandas / Mesas | ❌ No tiene | ✅ Completo | Específico RojoPlus |
| Gestión Socios / Deportes | ❌ No tiene | ✅ Completo | Específico RojoPlus |
| Portal Socio PWA | ❌ No tiene | ✅ Completo | Específico RojoPlus |
| Control de Accesos | ❌ No tiene | ✅ Completo | Específico RojoPlus |

---

## 2. Exploración de Opciones Arquitectónicas

Se evaluaron tres enfoques principales.

### Opción A — API Bridge (Backend a Backend)

```
RojoPlus Frontend
      ↓
RojoPlus Backend  →  [HTTP/REST]  →  Mini Backend
                                          ↓
                                     Mini DB (AFIP, Facturas, etc.)
```

RojoPlus llama a Mini como un servicio externo mediante HTTP. Mini expone endpoints autorizados. Requiere un **tenant mapping** entre sistemas y autenticación de servicio a servicio.

**Pro:** No cambia nada de lo existente. Implementación rápida.
**Contra:** Acoplamiento HTTP. Si Mini no está disponible, RojoPlus pierde la función. Doble roundtrip de red.

---

### Opción B — Shared Services Layer (Microservicios)

```
RojoPlus  ──┐
            ├──→  [AFIP Service]      (microservicio independiente)
Mini      ──┘     [Printing Service]  (microservicio independiente)
```

Los módulos más complejos (AFIP, Impresión) se extraen a microservicios propios que ambas apps consumen.

**Pro:** Correcto a largo plazo. Sin duplicación.
**Contra:** Requiere refactorizar ambas apps. Mayor inversión inicial. No aprovecha lo ya construido en Mini.

---

### Opción C — Module Federation (Frontend Compartido)

```
RojoPlus App  →  carga componentes React de Mini en runtime
                 Mini UI corre dentro de RojoPlus
                 Mini Backend procesa (AFIP, contabilidad, etc.)
                 Resultado vuelve a RojoPlus vía callback
                 RojoPlus persiste en su propia DB
```

Mini exporta sus componentes React como módulos federados. RojoPlus los importa y los monta directamente. El usuario opera en la UI de Mini sin saber que está usando otra aplicación.

**Pro:** Experiencia completamente integrada para el usuario. Cero duplicación de UI. Mini sigue siendo dueño de su lógica compleja.
**Contra:** Requiere configuración de build en ambas apps. Más setup inicial.

---

## 3. Decisión Clave: ¿Dónde Vive la Información?

### El problema detectado

En un borrador inicial de la arquitectura se propuso que Mini fuera el sistema de registro primario de las operaciones que origina RojoPlus (facturas, compras, asientos). Esto generó una objeción válida:

> "Me hizo ruido que en los puntos B, C, D la información principal y detallada se guarde en la base de Mini en lugar de RojoPlus, que es quien genera la petición original."

### Análisis del problema

Si Mini es el repositorio primario de datos que originan en RojoPlus:
- RojoPlus pierde acceso a su historial si Mini no está disponible.
- Si se desactiva la integración, RojoPlus queda sin datos propios.
- Mini se convierte en dependencia dura, no en servicio opcional.

### Resolución: dos tipos de servicios

Se estableció la distinción fundamental entre lo que realmente puede ser stateless y lo que requiere configuración:

#### Tipo 1 — Verdaderamente Stateless
Mini ejecuta y devuelve resultado. No persiste nada. RojoPlus guarda todo.

| Función | Parámetros de entrada | Resultado |
|---------|----------------------|-----------|
| Cálculo de IVA / neto / total | monto, alícuota, condición IVA | neto, IVA, total |
| Determinación tipo de factura | condición IVA emisor/receptor | A / B / C |
| Generación PDF A4 | todos los datos de la factura | PDF en base64 |
| Generación QR AFIP | CAE + datos | imagen QR |
| Validación de asiento contable | cuentas + importes | válido/errores |

#### Tipo 2 — Requiere Perfil Fiscal en Mini (configuración mínima, una vez)

| Función | Por qué necesita config |
|---------|------------------------|
| Obtener CAE de AFIP | Certificado X.509 + CUIT + punto de venta |
| Emitir NC/ND con AFIP | Referencia al comprobante original en AFIP |
| Numeración de comprobantes | AFIP lleva secuencia por punto de venta |
| Percepciones / Retenciones | Reglas por jurisdicción y actividad |

#### Tipo 3 — Requiere Tenant Completo en Mini (opt-in)

Solo cuando el club usa Mini activamente como sistema contable paralelo:
- Libro IVA y reportes fiscales consolidados
- Contabilidad completa (libro diario, balance)
- Cuenta corriente de proveedores
- Gestión de compras con AFIP

### Conclusión sobre el storage

> **RojoPlus es siempre dueño de sus datos.**
> Mini actúa como motor de procesamiento, no como repositorio primario.

```
Flujo correcto:
RojoPlus genera el evento
  → llama a Mini para ejecutar (AFIP, cálculos, PDF)
  → recibe resultado completo
  → persiste en su propia DB
  → Mini no guarda nada (o solo log de auditoría)
```

Para AFIP específicamente: RojoPlus guarda el comprobante completo (CAE, número, PDF). Mini guarda copia solo si ese tenant también usa Mini activamente como sistema contable (opt-in, no por defecto).

---

## 4. La Pregunta que Definió Todo

Una vez establecido el patrón de storage, surgió la pregunta que cambió el enfoque del frontend:

> "¿No sería posible que RojoPlus cuando vaya a facturar use el frontend y backend de Mini pero tenga toda la información que necesita y guarde los resultados en su propia base de datos?"

Esto es exactamente lo que resuelve Module Federation: RojoPlus usa la UI completa de Mini (con toda su experiencia, validaciones y lógica de AFIP), el usuario opera normalmente, y al finalizar el resultado regresa a RojoPlus vía callback para persistirse allí.

Se evaluaron tres variantes de integración frontend:

**iframe + postMessage:** Simple, cambios mínimos. Mini devuelve datos via `window.parent.postMessage`. RojoPlus escucha y persiste.

**Redirect + Webhook:** Usuario navega a Mini, opera, Mini llama webhook de RojoPlus al terminar, redirige de vuelta.

**Module Federation:** Mini exporta componentes React. RojoPlus los importa en runtime. El usuario nunca sabe que está usando Mini.

**Elegida: Module Federation** por experiencia de usuario completamente integrada y cero duplicación de UI.

---

## 5. Arquitectura Final Adoptada

### Premisas

1. Ambas apps permanecen independientes. Ninguna se fusiona con la otra.
2. RojoPlus es siempre dueño de los datos que genera.
3. Mini aporta capacidad de procesamiento, no storage primario.
4. La experiencia de usuario es continua: no nota que hay dos apps.
5. Mini en producción no se modifica en su flujo principal. La federation es un build adicional.

### Componentes del sistema

```
┌─────────────────────────────────────────────────────────────────┐
│  RojoPlus Frontend                                              │
│    - Página propia de Facturación (wrapper liviano)             │
│    - Carga dinámica del módulo de Mini en runtime               │
│    - Escucha callbacks → persiste en RojoPlus DB                │
└───────────────────┬─────────────────────────────────────────────┘
                    │ import() dinámico
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│  Mini Federation Bundle (mini-federation.es.js)                 │
│    - Build independiente de Mini (no toca el build principal)   │
│    - Exporta: FacturacionWidget, CuentaCorrienteWidget, etc.    │
│    - React/ReactDOM marcados como external (no se duplican)     │
│    - CSS prefijado con "mini-" para evitar conflictos Tailwind  │
└───────────────────┬─────────────────────────────────────────────┘
                    │ llamadas HTTP con sessionToken
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│  Mini Backend                                                   │
│    - Endpoint /service/session (genera tokens de sesión corta)  │
│    - Endpoints AFIP, PDF, contabilidad (sin cambios)            │
│    - Perfil fiscal mínimo por tenant (CUIT, cert, PV)           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  RojoPlus Backend                                               │
│    - Tabla integraciones_externas (tenant mapping)              │
│    - Endpoint /integraciones/mini/session (solicita token)      │
│    - Endpoint /integraciones/mini/factura-recibida (persiste)   │
└─────────────────────────────────────────────────────────────────┘
```

### Flujo completo de facturación

```
1. Usuario en RojoPlus hace clic en "Emitir Factura"

2. RojoPlus Frontend llama a RojoPlus Backend:
   POST /admin/integraciones/mini/session
   → RojoPlus Backend lee integraciones_externas para este tenant
   → Llama a Mini: POST /api/service/session { serviceKey, tenantSlug }
   → Devuelve sessionToken (JWT de vida corta, ej. 1 hora)

3. RojoPlus Frontend importa dinámicamente el bundle de Mini:
   import('http://mini.dominio.com/mini-federation.es.js')
   → Obtiene FacturacionWidget

4. RojoPlus monta el widget pasando props:
   <FacturacionWidget
     serviceToken={sessionToken}
     miniBaseUrl="http://mini.dominio.com"
     datosCliente={{ nombre, cuit, condicionIva }}
     itemsPrefill={venta.items}
     onFacturaEmitida={guardarEnRojoPlus}
     onCancelar={() => cerrarWidget()}
   />

5. El usuario opera en la UI de Mini (que corre dentro de RojoPlus):
   - Revisa/modifica datos del cliente
   - Revisa/modifica ítems y precios
   - Selecciona forma de pago
   - Confirma

6. Mini Backend procesa:
   - Calcula impuestos
   - Determina tipo de comprobante (A/B/C)
   - Llama a AFIP → obtiene CAE
   - Genera PDF A4
   - Genera QR

7. Mini devuelve resultado via callback prop:
   onFacturaEmitida({
     tipo: 'FC', numero: '0001-00000123',
     cae: '71234567890123', vencimientoCae: '2026-04-15',
     pdfBase64: '...', qrData: '...', items: [...]
   })

8. RojoPlus Frontend llama a RojoPlus Backend:
   POST /admin/integraciones/mini/factura-recibida
   { ...resultadoFactura, ventaId, socioId }

9. RojoPlus Backend persiste en su DB:
   comprobantes_afip { cae, tipo, numero, pdfPath, ventaId, ... }

10. El widget se cierra. El usuario sigue en RojoPlus.
    RojoPlus muestra el comprobante en su propia pantalla.
```

### Tenant Mapping

> **Nota:** Este diseño fue elaborado antes de definir el rol central de Core en el ecosistema. El diseño final establece que el tenant mapping vive en **Core** vía la tabla `TenantAppMapping`, no en Clubix. Ver `AXIOMACLOUD-ECOSISTEMA-ARQUITECTURA.md` para el diseño definitivo.

El mapeo entre el tenant de Clubix y el tenant correspondiente en Mini se configura en Core:

```typescript
// Core DB — TenantAppMapping
{
  coreTenantId: 17,          // tenant "Club Pilar" en Core
  appName: 'mini-erp',
  remoteTenantId: 'club-pilar-erp',   // slug del tenant en Mini
  remoteBaseUrl: 'https://api.mini.axiomacloud.com',
  config: { /* config adicional */ }
}
```

Cuando Clubix necesita un service token para usar un widget de Mini, lo pide a Core (no a Mini directamente):

```
Clubix Backend → POST /api/sso/service-session a Core
  { coreTenantId: 17, targetApp: 'mini-erp', scope: ['invoicing'] }
Core consulta TenantAppMapping → devuelve sessionToken con remoteTenantId incluido
Clubix pasa el token al widget como prop serviceToken
```

La activación del mapeo es manual por el super-admin en Core: ingresa el slug y configura qué apps tiene habilitadas cada tenant. No hay provisioning automático (decisión explícita: mantener control manual).

---

## 6. Consideraciones Técnicas Clave

### Versiones y compatibilidad

| | RojoPlus | Mini ERP |
|--|----------|----------|
| React | 18.3.1 | 18.2.0 |
| Vite | 7.3.1 | 5.0.8 |
| Lenguaje | JavaScript | TypeScript |

**React 18.x en ambas:** compatible. Los componentes de Mini (TypeScript) compilan a JavaScript estándar.

**Vite 7 vs Vite 5:** `@originjs/vite-plugin-federation` tiene soporte estable hasta Vite 5. Para evitar incompatibilidades con Vite 7 (RojoPlus), se optó por **Vite Library Mode** en lugar del plugin de Module Federation. Mini construye sus componentes como librería ESM independiente. Mismo resultado práctico, sin dependencia de versión.

### CSS Isolation

Ambas apps usan Tailwind CSS. Para evitar que las clases de Mini interfieran con las de RojoPlus, el build de federation de Mini usa prefijo en todas las clases:

```typescript
// tailwind.config del build de federation
export default {
  prefix: 'mini-',  // bg-white → mini-bg-white
}
```

Esta configuración solo aplica al build de federation, no al build principal de Mini.

### Seguridad del session token

El token de sesión que Mini genera para RojoPlus es:
- JWT de vida corta (máximo 1 hora, configurable)
- Permisos acotados (solo las operaciones habilitadas, ej. `['invoicing']`)
- Vinculado al tenant y al serviceKey
- No reutilizable entre sesiones

### Resiliencia en producción

Si Mini no está disponible, el import dinámico falla. RojoPlus debe manejar esto con fallback:
- Mostrar mensaje claro al usuario ("Servicio de facturación temporalmente no disponible")
- No bloquear otras funcionalidades del sistema
- Registrar el error para alertar al operador

---

## 7. Plan de Implementación

### Fase 1 — Infraestructura (sin impacto en producción)

- [ ] Crear `vite.federation.config.ts` en Mini (build independiente del principal)
- [ ] Crear `src/federation/index.ts` con exports de widgets
- [ ] Crear `FacturacionWidget` wrapper con props/callback interface
- [ ] Endpoint `POST /api/service/session` en Mini (nuevo, no modifica nada)
- [ ] Migración aditiva en RojoPlus: tabla `integraciones_externas`
- [ ] Pantalla de configuración de integración en super-admin de RojoPlus

### Fase 2 — Primer widget funcional

- [ ] `miniIntegracion.js` en RojoPlus (cliente de carga dinámica)
- [ ] Página `Facturacion.jsx` en RojoPlus que monta el widget
- [ ] Endpoint `POST /admin/integraciones/mini/factura-recibida` en RojoPlus
- [ ] Modelo `ComprobanteAfip` en Prisma de RojoPlus
- [ ] Prueba end-to-end en entorno local con un tenant piloto

### Fase 3 — Deploy incremental

- [ ] Deploy Mini con `build:federation` (solo agrega archivos estáticos, no modifica el app)
- [ ] Deploy RojoPlus con nueva funcionalidad detrás de permiso (feature flag por tenant)
- [ ] Prueba en producción con un tenant piloto
- [ ] Activación gradual para tenants que tengan la integración configurada

### Fase 4 — Ampliación del ecosistema

- [ ] `CuentaCorrienteWidget` (consulta de cuenta corriente en Mini)
- [ ] `ComprasWidget` (registro de compras a proveedores)
- [ ] `NotaCreditoWidget` (NC/ND desde anulaciones en RojoPlus)
- [ ] Definir qué otras apps del equipo pueden consumir los mismos widgets

---

## 8. Lo que RojoPlus NO Necesita Construir

Gracias a esta integración, quedan fuera del backlog de RojoPlus:

- Gestión de certificados AFIP (WSAA, X.509)
- Lógica de reintentos de CAE
- Determinación de tipo de factura (A/B/C) con todas sus reglas
- Cálculo de IVA multi-alícuota y percepciones
- Notas de crédito/débito con AFIP
- Generación de PDF A4 con Puppeteer/Handlebars
- Libro IVA y reportes fiscales
- Contabilidad completa (PGC, asientos, OIA)
- Cuenta corriente de proveedores

---

## 9. Decisiones Pendientes

Al cierre de esta discusión quedaron abiertas dos preguntas para el diseño detallado:

1. **¿Los componentes actuales de Mini aceptan props de prefill y callback onComplete?** O hay que refactorizarlos para soportar esa interfaz antes de poder exponerlos como widgets.

2. **¿Dónde se sirve el bundle de federation de Mini?** Si lo sirve el mismo servidor de Mini (mismo puerto) o un servidor de assets separado (nginx, S3), eso define la URL que RojoPlus usa para el import dinámico y la configuración de CORS.

---

## 10. Visión a Futuro del Ecosistema

Este diseño no es exclusivo de RojoPlus ↔ Mini. La arquitectura permite que cualquier app del equipo que quiera exponer funcionalidad:

1. Cree un `vite.federation.config.ts` con los widgets a exponer.
2. Agregue endpoints de session/service en su backend.
3. Cualquier otra app del ecosistema puede consumir esos widgets.

La tabla `integraciones_externas` y el `miniIntegracion.js` son patrones reutilizables. A medida que crezca el ecosistema, cada app puede tanto **consumir** como **proveer** widgets al resto.

```
Futuro:

RojoPlus  ──expone──→  Widget de Socios (para otras apps que necesiten validar socios)
RojoPlus  ──consume──→  Facturación, Compras, Contabilidad de Mini

Mini      ──expone──→  Facturación, AFIP, Contabilidad, Compras
Mini      ──consume──→  (si necesita, widgets de otras apps)

OtraApp   ──expone──→  Sus funcionalidades específicas
OtraApp   ──consume──→  Lo que necesite de RojoPlus o Mini
```

El ecosistema crece de manera orgánica, cada app siendo dueña de su dominio y compartiendo lo que sabe hacer mejor.

---

*Documento generado en sesión de diseño — Abril 2026*
*Próximo paso: definir la interfaz de props/callbacks de los widgets de Mini existentes*
