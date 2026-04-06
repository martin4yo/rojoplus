# AxiomaCloud — Decisiones de Implementación
## Cómo se implementa la integración entre apps

**Fecha:** Abril 2026
**Complementa:** `AXIOMACLOUD-ECOSISTEMA-ARQUITECTURA.md`

Este documento registra las decisiones concretas de implementación tomadas durante el diseño del ecosistema. El foco es el "cómo" — qué base de datos se usa, qué Prisma, cómo fluyen los datos, cómo se persiste el resultado.

---

## 1. Qué base de datos usa el widget

Cuando una app (consumidora) monta un widget de otra app (proveedora), el widget usa **exclusivamente los recursos de la app proveedora**.

```
Clubix monta FacturacionWidget de Mini
  → el widget hace llamadas HTTP a Mini Backend
  → Mini Backend usa PrismaClient de Mini
  → Mini PrismaClient conecta a Mini DB
  → Mini DB usa schema.prisma de Mini

Clubix DB y Clubix schema.prisma no son tocados en ningún momento por el widget.
```

**Regla:** El widget es código de la app proveedora corriendo en el browser del usuario. Sus llamadas siempre van al backend de quien lo construyó. La app consumidora no existe para ese backend — solo recibe un request HTTP con un token válido.

### Los dos Prisma nunca se tocan

```
Mini ERP                          Clubix
─────────────────────────────     ─────────────────────────────
schema.prisma                     schema.prisma
  Sale, SaleItem                    ComprobanteAfip
  AfipConfiguration                 Pago, Socio
  VoucherType, AfipLog              Venta, ...

PrismaClient → Mini DB            PrismaClient → Clubix DB
```

Son dos procesos Node distintos, dos conexiones distintas, dos bases de datos distintas. La única conexión entre ellos es HTTP.

---

## 2. Qué pasa al querer ver el detalle de una factura emitida desde Clubix

### El problema

La factura fue generada por Mini (Mini la tiene completa en su DB). El usuario está en Clubix y quiere ver el detalle: items, impuestos, cliente, totales.

### Las opciones evaluadas

**Opción A — Guardar JSON completo en Clubix al momento de crear**
Clubix guarda todo lo que devuelve el callback. Autónomo para siempre, sin depender de Mini.

**Opción B — Consultar a Mini en tiempo real**
Clubix guarda solo la referencia (`miniFacturaId`). Cuando el usuario pide el detalle, Clubix llama a Mini. Siempre fresco pero dependiente de disponibilidad de Mini.

**Opción C — Híbrido** ← **DECISIÓN ADOPTADA**

### Decisión: patrón híbrido

```
Al emitir la factura (callback onFacturaEmitida):
  → Clubix guarda JSON completo del resultado en su DB  → autonomía
  → Clubix guarda el PDF en su storage                 → autonomía
  → Clubix guarda miniFacturaId como referencia        → trazabilidad

Al consultar el detalle desde Clubix:
  → Clubix lee de su propia DB (rápido, siempre disponible)
  → No llama a Mini para el caso de uso cotidiano

Opcionalmente:
  → Botón "Ver en Mini" para contexto fiscal completo
    (libro IVA, asientos contables, historial AFIP)
    → link directo al comprobante en Mini
```

**Justificación:**
- El callback devuelve todos los datos en el momento de creación — guardarlos no cuesta nada adicional.
- Si Mini está caído o la integración se desactiva, el historial de Clubix sigue intacto.
- Mini sigue siendo la fuente de verdad fiscal (para el contador, reportes AFIP, etc.), pero Clubix no depende de él para su operación diaria.

---

## 3. Modelo Prisma en la app consumidora (ejemplo Clubix)

La app consumidora necesita un modelo para guardar el resultado de cada widget que use. El campo `datosCompletos: Json` es la clave — evita diseñar tablas específicas para cada campo posible de la factura y permite guardar el objeto completo tal como lo devuelve el callback.

```prisma
// schema.prisma de Clubix — modelo para facturas emitidas via Mini
model ComprobanteAfip {
  id             Int      @id @default(autoincrement())
  tenantId       Int

  // Referencia a Mini (trazabilidad, no dependencia)
  miniFacturaId  String?

  // Campos básicos indexados para listados y búsquedas
  tipo           String        // FA, FB, FC, NC, ND
  numero         String
  cae            String
  fechaEmision   DateTime
  total          Decimal
  clienteNombre  String
  clienteCuit    String?

  // Datos completos para el detalle — no necesitás ir a Mini
  datosCompletos Json          // objeto completo del callback onFacturaEmitida

  // PDF almacenado localmente
  pdfPath        String?

  // Vínculos al contexto de Clubix
  pagoId         Int?
  socioId        Int?
  ventaId        Int?          // para ventas del buffet, eventos, etc.

  createdAt      DateTime @default(now())

  tenant         Tenant   @relation(fields: [tenantId], references: [id])
}
```

**Criterio de diseño:**
- Los campos indexados (`tipo`, `numero`, `cae`, `clienteNombre`, `total`, `fechaEmision`) permiten listados, filtros y búsquedas eficientes sin parsear el JSON.
- `datosCompletos` guarda todo lo demás — items, impuestos, desglose, metadata de AFIP — sin necesidad de columnas adicionales.
- Los vínculos (`pagoId`, `socioId`, `ventaId`) conectan el comprobante con la operación de negocio que lo originó en el contexto de Clubix.

### El mismo patrón aplica a cada app consumidora

Cada app que use widgets de otras apps replica este patrón con su propio modelo:

```
MediFlow usando FacturacionWidget de Mini:
  → modelo ConsultaFacturada { ..., miniFacturaId, datosCompletos Json, pacienteId, turnoId }

Elore usando FacturacionWidget de Mini:
  → modelo ProyectoFactura { ..., miniFacturaId, datosCompletos Json, proyectoId, clienteId }
```

El patrón es siempre el mismo: campos básicos para operar + JSON completo para el detalle + referencia al sistema de origen.

---

## 4. Flujo completo de datos — diagrama

```
┌─────────────────────────────────────────────────────────────────┐
│  CLUBIX FRONTEND                                                │
│                                                                 │
│  1. Usuario hace clic en "Emitir Factura"                       │
│  2. Se pide serviceToken a Clubix Backend                       │
│  3. Se importa mini-federation.es.js dinámicamente              │
│  4. Se monta <FacturacionWidget prefill={...} />                │
└─────────────────┬───────────────────────────────────────────────┘
                  │ el widget corre en el browser
                  │ sus llamadas HTTP van a Mini
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  MINI BACKEND                                                   │
│                                                                 │
│  5. Recibe request con serviceToken                             │
│  6. Valida token (emitido por Core)                             │
│  7. Usa Mini PrismaClient → Mini DB                             │
│     - Guarda Sale, SaleItems                                    │
│     - Llama a AFIP → obtiene CAE                                │
│     - Guarda AfipLog                                            │
│     - Genera PDF (Puppeteer + Handlebars)                       │
│  8. Retorna resultado al widget                                 │
└─────────────────┬───────────────────────────────────────────────┘
                  │ resultado vía callback prop
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  CLUBIX FRONTEND                                                │
│                                                                 │
│  9. onFacturaEmitida({ cae, numero, tipo, items,                │
│       totales, cliente, pdfBase64, miniFacturaId })             │
│  10. Llama a Clubix Backend con el resultado completo           │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  CLUBIX BACKEND                                                 │
│                                                                 │
│  11. Usa Clubix PrismaClient → Clubix DB                        │
│      - prisma.comprobanteAfip.create({                          │
│          cae, numero, tipo,                                     │
│          datosCompletos: resultadoCompleto,  ← JSON completo    │
│          pdfPath: guardarPdf(pdfBase64),                        │
│          miniFacturaId,                                         │
│          pagoId, socioId                                        │
│        })                                                       │
│  12. Retorna confirmación al frontend                           │
└─────────────────────────────────────────────────────────────────┘

RESULTADO FINAL:
  Mini DB  → tiene la factura completa (fiscal, contable, AFIP)
  Clubix DB → tiene referencia + JSON completo + PDF (operativo, autónomo)
```

---

## 5. Dónde vive cada dato — tabla de responsabilidades

| Dato | Mini DB | Clubix DB | Motivo |
|------|---------|-----------|--------|
| Factura completa (items, impuestos) | ✅ primario | ✅ copia en Json | Mini es fuente fiscal; Clubix es autónomo |
| CAE y datos AFIP | ✅ primario | ✅ campos indexados | Ambos necesitan el CAE |
| PDF del comprobante | ✅ (genera) | ✅ (guarda copia) | Clubix no depende de Mini para imprimir |
| Numeración AFIP (secuencia) | ✅ único | ❌ | Solo Mini maneja la secuencia AFIP |
| Certificado AFIP | ✅ único | ❌ | Solo Mini necesita el cert para llamar a AFIP |
| Libro IVA / reportes fiscales | ✅ único | ❌ | Competencia de Mini, no de Clubix |
| Asientos contables | ✅ único | ❌ | Competencia de Mini |
| Vínculo factura ↔ socio/pago | ❌ | ✅ único | Solo Clubix conoce sus propias entidades |
| Vínculo factura ↔ venta buffet | ❌ | ✅ único | Solo Clubix conoce sus propias entidades |

---

## 6. Decisiones sobre la autenticación del widget

### Roles, permisos y menú: cada app los gestiona solos

Core no federa roles ni permisos a las apps. Solo provee identidad y contexto de tenant. Cada app recibe del JWT de Core:

- **Quién es el usuario** (userId, email, name)
- **A qué tenant pertenece** (remoteTenantId)

Con eso, cada app decide internamente:
- Qué rol le asigna (puede ser configurable por tenant en la propia app)
- Qué puede hacer (permisos propios de la app)
- Qué menú ve (gestor de menú propio de la app)

**Primer SSO de un usuario nuevo en una app:**
```
Mini recibe el JWT de Core con { email: 'juan@empresa.com', remoteTenantId: 'empresa-abc' }
  → busca el usuario por email en el tenant 'empresa-abc'
  → si no existe: crea el usuario con rol por defecto (configurable por el admin del tenant)
  → si existe: actualiza nombre si cambió, no toca el rol (lo gestiona la app)
```

El admin del tenant en cada app puede luego ajustar el rol del usuario dentro de esa app, sin que afecte a otras apps ni a Core.

---

### El serviceToken

Cuando una app consumidora monta un widget de otra app, necesita un token que el backend de la app proveedora acepte. Este token:

- Lo emite **Core** (fuente de verdad de identidad del ecosistema)
- Tiene **vida corta** (máximo 1 hora)
- Tiene **scope limitado** (solo las operaciones que el widget necesita, ej. `['invoicing']`)
- Es **por sesión de widget** — se pide justo antes de montar el widget

```
Clubix Backend solicita a Core:
  POST /api/sso/service-session
  {
    targetApp: 'mini-erp',
    tenantMapping: { clubixTenantId: 42, miniTenantSlug: 'club-pilar' },
    scope: ['invoicing'],
    expiresIn: 3600
  }
  → Core verifica que el tenant de Clubix tiene integración activa con Mini
  → Core emite JWT corto firmado
  → Clubix pasa ese JWT al widget como prop serviceToken
  → Mini Backend valida el JWT contra Core (o con shared secret)
```

El usuario nunca ve este proceso. Desde su perspectiva, simplemente usa la funcionalidad de facturación dentro de Clubix.

---

## 7. Reglas generales aplicables a cualquier par de apps

Estas decisiones aplican a **cualquier combinación** del ecosistema, no solo Clubix ↔ Mini:

1. **El widget usa el backend y la DB de quien lo construyó.** Siempre.

2. **La app consumidora guarda el resultado completo en su propia DB** usando el campo `datosCompletos: Json`. No diseña tablas específicas por cada campo del resultado.

3. **Los campos básicos se guardan como columnas indexadas** para permitir listados y búsquedas sin parsear JSON.

4. **Los vínculos de negocio solo existen en la app consumidora** (pagoId, socioId, pacienteId, etc.). La app proveedora no sabe ni le importa el contexto de quien la llamó.

5. **El PDF o artefacto generado se guarda en la app consumidora** en el momento de creación. No se consulta a la app proveedora para recuperarlo después.

6. **La referencia al ID remoto (`miniFacturaId`, `parseDocId`, etc.) es opcional** — sirve para trazabilidad y auditoría, no para dependencia operacional.

7. **Si la app proveedora está caída, el historial de la app consumidora sigue intacto.** La integración es un servicio que suma capacidad, no una dependencia crítica para ver datos ya generados.

---

*Documento generado en sesión de diseño — Abril 2026*
*Ver también:*
- *`AXIOMACLOUD-ECOSISTEMA-ARQUITECTURA.md` — arquitectura general del ecosistema*
- *`INTEGRACION-ECOSISTEMA-ROJOPLUS-MINI.md` — diseño detallado del primer par implementado*
