# AxiomaCloud — Arquitectura del Ecosistema
## Integración entre Aplicaciones sin Duplicar Funcionalidad

**Fecha:** Abril 2026
**Versión:** 1.0
**Origen:** Este documento es la evolución natural del diseño de integración RojoPlus ↔ Mini ERP, extendido a todas las aplicaciones del ecosistema AxiomaCloud.

---

## 1. El Ecosistema Completo

### Mapa de aplicaciones

| App | Propósito | Stack Frontend | Stack Backend | DB | Multi-tenant |
|-----|-----------|---------------|---------------|----|--------------|
| **Core** | SSO + Registry + Admin central | React 18 + Vite + TS | Express + Prisma | PostgreSQL | ✅ |
| **Mini ERP** | ERP general (facturación, compras, contabilidad) | React 18 + Vite + TS | Express + Prisma | PostgreSQL | ✅ |
| **Clubix** | Gestión de clubes deportivos | React 18 + Vite + JS | Express + Prisma | PostgreSQL | ✅ |
| **MediFlow** | Gestión de clínicas médicas | React 19 + Vite + MUI | Express + Prisma | PostgreSQL | ✅ |
| **AxiomaDocs** | Gestión documental y vencimientos | React 18 + Vite + TS | Express + Prisma | MySQL | ❌ |
| **Parse** | Extracción de documentos fiscales con IA | Next.js + React | Express + Prisma | PostgreSQL | ✅ |
| **Tally** | Rendiciones y conciliación de tarjetas | Next.js 15 + React 19 | Express + Prisma | PostgreSQL | ✅ |
| **Checkpoint** | Control de presencia y GPS | Next.js 15 + React 19 | Next.js API Routes | PostgreSQL | ✅ |
| **Elore** | Gestión de proyectos y tareas | Next.js 15 + React 19 | Next.js API Routes | PostgreSQL | ✅ |

### Build tools por app

| Grupo | Apps | Implicancia para federation |
|-------|------|----------------------------|
| React 18 + Vite | Core, Mini ERP, Clubix, AxiomaDocs | Vite Library Mode nativo |
| React 19 + Vite | MediFlow | Vite Library Mode nativo |
| React 19 + Next.js | Parse, Tally, Checkpoint, Elore | Vite Library Mode adicional (build separado) |

---

## 2. Core es el Centro del Ecosistema

### El descubrimiento clave

Core ya resuelve dos de los tres problemas más difíciles de un ecosistema de apps:

```
Problema 1: ¿Cómo se autentica un usuario en múltiples apps?
→ RESUELTO: Core tiene SSO. El usuario se loguea una vez y accede a todas las apps.

Problema 2: ¿Dónde se registra qué apps existen y qué ofrecen?
→ RESUELTO: Core tiene Application Registry. Cada app está registrada con su config.

Problema 3: ¿Cómo se mapean los tenants entre apps?
→ PENDIENTE: Core gestiona tenants y TenantUserApplication. Se puede extender.
```

### Lo que Core ya tiene

- **SSO:** Un JWT de Core es reconocido por todas las apps (o puede serlo con mínima configuración)
- **Application Registry:** `Application` model con config, menú y permisos por tenant
- **Tenant Management:** Tenants centralizados con usuarios asignados por app
- **RBAC:** Roles y permisos que pueden federarse entre apps
- **Audit Log:** Trazabilidad centralizada de acciones cross-app
- **Session Management:** Control de sesiones activas, revocación remota
- **Holdings:** Agrupación de tenants (empresas madre con múltiples subsidiarias)

### Lo que hay que agregar a Core

Solo tres cosas nuevas para soportar la integración de widgets:

```typescript
// 1. Campo federationUrl en el modelo Application
model Application {
  // ... campos existentes ...
  federationUrl    String?   // URL del bundle ESM de widgets
  widgetsManifest  Json?     // Qué widgets expone y su interfaz
}

// 2. Endpoint de service session (para auth de widgets)
// POST /api/sso/service-session
// Body: { applicationId, targetAppId, tenantId, scope: ['invoicing'] }
// Return: { sessionToken, expiresAt }
// Genera un JWT corto de vida para que un widget de App B
// pueda llamar al backend de App B desde dentro de App A

// 3. Endpoint de tenant mapping
// GET /api/tenants/:tenantId/app-mapping/:applicationId
// Return: { remoteTenantId, remoteConfig }
```

---

## 3. El Patrón de Integración: Tres Capas

### Capa 1 — Identidad (Core como fuente de verdad)

```
Usuario se loguea en Core
  → Core emite JWT principal (7 días, acceso a todas sus apps)
  → Usuario navega a Clubix, Mini, MediFlow, etc.
  → Cada app valida el JWT de Core (shared secret o JWKS endpoint)
  → No hay login separado por app
```

Cuando una app necesita embeber un widget de otra:

```
App A (consumidora) necesita widget de App B (proveedora)
  → App A pide a Core un service session token:
    POST /api/sso/service-session
    { targetApp: 'mini-erp', tenantMapping: {...}, scope: ['invoicing'] }
  → Core valida que el tenant de App A tiene acceso a App B
  → Core emite JWT corto (1 hora) con scope limitado
  → App A pasa ese token al widget de App B como prop
  → El widget llama al backend de App B con ese token
  → App B valida el token contra Core (o localmente con shared secret)
```

### Capa 2 — Federation (widgets compartidos)

Cada app construye un bundle de federation independiente de su build principal:

```
[App]/
├── [build principal]          ← no se toca
└── src/federation/
    ├── index.ts               ← exports de widgets
    └── [Widget]Widget.tsx     ← wrapper con AxiomaWidget interface
```

```bash
# Script adicional en package.json de cada app
"build:federation": "vite build --config vite.federation.config.ts"
```

El bundle resultante es ESM estándar, consumible por cualquier app:

```typescript
// En cualquier app (Vite o Next.js)
const { FacturacionWidget } = await import(
  'https://mini.axiomacloud.com/federation/mini-federation.es.js'
)
```

### Capa 3 — Storage (cada app dueña de sus datos)

```
Regla fundamental del ecosistema:
  Cada app es siempre la dueña primaria de los datos que genera.
  Usar el widget de otra app no implica que esa app sea el repositorio.

Flujo correcto:
  App A genera el evento de negocio
    → Widget de App B ejecuta la lógica compleja
    → Resultado regresa a App A vía callback
    → App A persiste en su propia DB
    → App B puede guardar copia solo si tiene uso propio de esos datos (opt-in)
```

---

## 4. El Protocolo de Widgets

### Interfaz estándar

Todos los widgets exportados por cualquier app del ecosistema implementan esta interfaz:

```typescript
// axioma-commons/types/widget.ts
// (repositorio o package compartido con los tipos del ecosistema)

export interface AxiomaWidgetProps<TPrefill = unknown, TResult = unknown> {
  // Auth — token emitido por Core para esta sesión de widget
  serviceToken: string
  serviceBaseUrl: string        // URL base del backend de la app proveedora

  // Datos pre-cargados desde la app consumidora
  prefill?: TPrefill

  // Callbacks obligatorios
  onComplete: (resultado: TResult) => void
  onCancel: () => void

  // Callbacks opcionales
  onError?: (error: AxiomaWidgetError) => void
  onLoading?: (loading: boolean) => void

  // UX
  mode?: 'modal' | 'inline' | 'fullpage'
  theme?: 'light' | 'dark' | 'inherit'
  locale?: string               // para i18n
}

export interface AxiomaWidgetError {
  code: string
  message: string
  retryable: boolean
}
```

### Axioma Manifest

Cada app publica en una URL fija qué widgets ofrece:

```json
// Disponible en: https://[app-url]/axioma-manifest.json
{
  "app": "mini-erp",
  "displayName": "Mini ERP",
  "version": "2.1.0",
  "federationUrl": "https://mini.axiomacloud.com/federation/mini-federation.es.js",
  "reactVersion": "18",
  "widgets": [
    {
      "name": "FacturacionWidget",
      "description": "Emisión de comprobantes AFIP completa (FA/FB/FC + CAE + QR + PDF)",
      "prefillSchema": {
        "cliente": { "nombre": "string", "cuit": "string", "condicionIva": "string" },
        "items": [{ "descripcion": "string", "cantidad": "number", "precioUnitario": "number" }]
      },
      "resultSchema": {
        "tipo": "string", "numero": "string", "cae": "string",
        "pdfBase64": "string", "qrData": "string"
      }
    },
    {
      "name": "CuentaCorrienteWidget",
      "description": "Consulta de cuenta corriente de una entidad"
    }
  ],
  "serviceEndpoints": [
    { "name": "calcular-impuestos", "path": "/api/service/impuestos", "method": "POST" },
    { "name": "generar-pdf", "path": "/api/service/pdf", "method": "POST" }
  ]
}
```

Core puede leer estos manifests y almacenarlos en su `Application` registry, dando visibilidad centralizada de todo lo que el ecosistema ofrece.

---

## 5. Mapa de Capacidades por App

### Lo que cada app ofrece al ecosistema

```
┌─────────────────────────────────────────────────────────────────────┐
│  MINI ERP                                                           │
│  Ofrece:                                                            │
│    → FacturacionWidget     Emisión AFIP completa (FA/FB/FC)         │
│    → NotaCreditoWidget     NC/ND con AFIP                           │
│    → CuentaCorrienteWidget Cuenta corriente de entidades            │
│    → ComprasWidget         Registro de compras a proveedores        │
│    → Service: calcular-impuestos (stateless)                        │
│    → Service: generar-pdf-a4 (stateless, Handlebars + Puppeteer)    │
│  Consume de:                                                        │
│    ← Parse: parsear facturas de proveedores al cargar compra        │
│    ← Elore: crear tarea cuando falla AFIP                           │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  CLUBIX                                                             │
│  Ofrece:                                                            │
│    → MemberVerificationWidget  Validar si alguien es socio activo   │
│    → AccessControlWidget       Registrar acceso a instalación       │
│    → ActivityScheduleWidget    Ver agenda deportiva                 │
│  Consume de:                                                        │
│    ← Mini: emitir facturas de cuotas/eventos/buffet                 │
│    ← Parse: escanear comprobantes de gastos del club                │
│    ← Checkpoint: control de acceso biométrico socios/empleados      │
│    ← Elore: crear tickets de soporte desde el panel admin           │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  MEDIFLOW                                                           │
│  Ofrece:                                                            │
│    → PatientSearchWidget       Buscar paciente por documento        │
│    → AppointmentWidget         Ver/crear turnos                     │
│    → MedicalRecordWidget       Vista de historia clínica            │
│  Consume de:                                                        │
│    ← Mini: facturar consultas/tratamientos                          │
│    ← Parse: parsear recetas / órdenes de obra social                │
│    ← Checkpoint: registro de llegada del paciente                   │
│    ← AxiomaDocs: gestión de documentos habilitantes del profesional │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  PARSE                                                              │
│  Ofrece:                                                            │
│    → DocumentUploadWidget  Subir comprobante → extraer datos con IA │
│    → Service: parse-invoice  API: PDF/imagen → JSON estructurado    │
│    → Service: parse-receipt  Extracción de tickets/facturas         │
│  Consume de:                                                        │
│    ← Elore: crear tarea de revisión cuando extracción falla         │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  TALLY                                                              │
│  Ofrece:                                                            │
│    → SettlementWidget      Vista de rendición de tarjetas           │
│    → ReconciliationWidget  Conciliación de movimientos              │
│  Consume de:                                                        │
│    ← Parse: extraer datos de resúmenes de tarjeta (OCR + IA)        │
│    ← Mini: generar asientos contables de las rendiciones            │
│    ← Elore: crear tareas de revisión para diferencias               │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  CHECKPOINT                                                         │
│  Ofrece:                                                            │
│    → CheckInWidget         Registrar presencia con GPS y foto       │
│    → BiometricAuthWidget   Autenticación biométrica                 │
│    → EmployeeStatusWidget  Estado de presencia en tiempo real       │
│  Consume de:                                                        │
│    ← Mini: generar recibos de sueldo / facturar horas               │
│    ← Elore: crear tareas de RRHH                                    │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  ELORE                                                              │
│  Ofrece:                                                            │
│    → TaskCreatorWidget     Crear tarea en cualquier proyecto        │
│    → ProjectStatusWidget   Ver estado de proyecto embebido          │
│    → TimeTrackerWidget     Registrar tiempo en tarea                │
│  Consume de:                                                        │
│    ← Mini: facturar proyectos/servicios directamente desde Elore    │
│    ← Parse: crear tarea a partir de documento recibido              │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  AXIOMADOCS                                                         │
│  Ofrece:                                                            │
│    → DocStatusWidget       Estado de documentos de una persona      │
│    → ExpirationAlertWidget Documentos por vencer                    │
│  Consume de:                                                        │
│    ← Elore: crear tarea de renovación cuando documento vence        │
│    ← Parse: extraer datos de documento subido para auto-completar   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. Casos de Uso Cross-App Más Relevantes

| App consumidora | App proveedora | Widget / Servicio | Valor |
|-----------------|----------------|-------------------|-------|
| Clubix | Mini ERP | FacturacionWidget | Facturar cuotas, eventos, ventas del buffet |
| MediFlow | Mini ERP | FacturacionWidget | Facturar consultas y tratamientos |
| Elore | Mini ERP | FacturacionWidget | Facturar proyectos al cliente |
| Tally | Mini ERP | AsientoContableService | Contabilizar rendiciones |
| Clubix | Parse | DocumentUploadWidget | Escanear facturas de gastos del club |
| Mini ERP | Parse | parse-invoice service | Cargar facturas de compra escaneadas |
| MediFlow | Parse | parse-receipt service | Parsear órdenes y recetas |
| Tally | Parse | parse-invoice service | Extraer datos de resúmenes de tarjeta |
| Clubix | Checkpoint | CheckInWidget | Control de acceso de socios |
| MediFlow | Checkpoint | CheckInWidget | Registro de llegada de pacientes |
| Todas | Elore | TaskCreatorWidget | Crear ticket de soporte o tarea interna |
| MediFlow | AxiomaDocs | DocStatusWidget | Ver habilitaciones del médico |
| Todas | Core | SSO / Session | Login único, gestión de sesión |

---

## 7. Implementación Técnica

### Estructura de federation en cada app

```
[app-root]/
├── [build principal - no se toca]
├── src/
│   └── federation/
│       ├── index.ts                    ← exports públicos
│       ├── [Nombre]Widget.tsx          ← wrapper con AxiomaWidget interface
│       └── providers/
│           └── ServiceProvider.tsx     ← inyecta token y baseUrl al árbol
├── vite.federation.config.ts           ← build independiente
└── public/
    └── axioma-manifest.json            ← publicado como asset estático
```

### vite.federation.config.ts (estándar para todas las apps)

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/federation/index.ts'),
      name: '[AppName]Federation',
      fileName: '[app-name]-federation',
      formats: ['es']
    },
    outDir: 'dist-federation',
    rollupOptions: {
      // React siempre external: la app consumidora usa su propio React
      // Esto evita el conflicto entre React 18 y React 19
      external: ['react', 'react-dom', 'react/jsx-runtime'],
    }
  },
  css: {
    // CSS modules para isolation automática
    modules: { scopeBehaviour: 'local' }
  }
})
```

### Widget wrapper estándar

```typescript
// src/federation/FacturacionWidget.tsx (ejemplo en Mini ERP)
import type { AxiomaWidgetProps } from 'axioma-commons'
import { ServiceProvider } from './providers/ServiceProvider'
import NuevaFactura from '../pages/sales/NuevaFactura'  // componente existente

interface FacturacionPrefill {
  cliente?: { nombre: string; cuit: string; condicionIva: string }
  items?: Array<{ descripcion: string; cantidad: number; precioUnitario: number }>
}

interface FacturacionResult {
  tipo: string; numero: string; cae: string
  pdfBase64: string; qrData: string
}

export function FacturacionWidget(
  props: AxiomaWidgetProps<FacturacionPrefill, FacturacionResult>
) {
  return (
    <ServiceProvider token={props.serviceToken} baseUrl={props.serviceBaseUrl}>
      <NuevaFactura
        prefill={props.prefill}
        onComplete={props.onComplete}
        onCancel={props.onCancel}
        mode={props.mode}
      />
    </ServiceProvider>
  )
}
```

### Consumir un widget (cualquier app, Vite o Next.js)

```typescript
// Hook reutilizable para cargar widgets del ecosistema
// src/hooks/useAxiomaWidget.ts

const widgetCache = new Map()

export function useAxiomaWidget(federationUrl: string) {
  const [module, setModule] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = async () => {
    if (widgetCache.has(federationUrl)) {
      setModule(widgetCache.get(federationUrl))
      return
    }
    setLoading(true)
    try {
      const mod = await import(/* @vite-ignore */ federationUrl)
      widgetCache.set(federationUrl, mod)
      setModule(mod)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }

  return { module, loading, error, load }
}
```

```typescript
// Uso en cualquier página de cualquier app
function PaginaFacturacion({ venta, cliente }) {
  const { module, load } = useAxiomaWidget(
    'https://mini.axiomacloud.com/federation/mini-federation.es.js'
  )
  const { serviceToken } = useServiceSession('mini-erp') // pide token a Core

  if (!module) return <button onClick={load}>Emitir Factura</button>

  const { FacturacionWidget } = module
  return (
    <FacturacionWidget
      serviceToken={serviceToken}
      serviceBaseUrl="https://api.mini.axiomacloud.com"
      prefill={{ cliente, items: venta.items }}
      onComplete={guardarEnLocalDB}
      onCancel={cerrar}
      mode="modal"
    />
  )
}
```

### Service session via Core

```typescript
// Hook que pide a Core un token de sesión para usar un widget
// src/hooks/useServiceSession.ts

export function useServiceSession(targetApp: string) {
  const { coreToken } = useAuth() // JWT principal del usuario en Core

  const getServiceToken = async (scope: string[]) => {
    const res = await coreApi.post('/api/sso/service-session', {
      targetApp,
      scope,
      // Core sabe qué tenant de targetApp corresponde al tenant actual
    })
    return res.data.sessionToken
  }

  return { getServiceToken }
}
```

---

## 8. Configuración en Core

### Extensión del modelo Application en Core

```typescript
// Core: agregar a Application model en Prisma
model Application {
  // ... campos existentes ...
  federationUrl     String?   // URL del bundle de widgets
  widgetsManifest   Json?     // Copia del axioma-manifest.json
  serviceAuthConfig Json?     // Config para auth entre apps
  lastManifestSync  DateTime? // Cuándo se sincronizó el manifest
}
```

### Panel de integración en Core

Una sección nueva en el admin de Core: **"Integraciones del Ecosistema"**

- Lista de apps registradas con su `federationUrl`
- Para cada tenant: qué integraciones tiene habilitadas (Clubix puede usar Mini, etc.)
- Botón "Sincronizar manifest" que lee el `axioma-manifest.json` de cada app
- Generación de serviceKeys por tenant por par de apps
- Log de uso de widgets cross-app (auditoría)

---

## 9. Plan de Implementación del Ecosistema

### Fase 0 — Estándares (sin código de producto)
- [ ] Definir `AxiomaWidgetProps` interface en repositorio/package compartido
- [ ] Definir formato de `axioma-manifest.json`
- [ ] Definir headers de service auth: `X-Service-Token`, `X-Axioma-App`
- [ ] Documentar en Core cómo extender `Application` para federation

### Fase 1 — Primer par validado (Mini ↔ Clubix)
*(Diseño detallado ya existe en `INTEGRACION-ECOSISTEMA-ROJOPLUS-MINI.md`)*
- [ ] Mini expone `FacturacionWidget`
- [ ] Core extiende Application con `federationUrl`
- [ ] Core agrega endpoint `/api/sso/service-session`
- [ ] Clubix consume `FacturacionWidget`
- [ ] Validar el protocolo completo en producción

### Fase 2 — Parse como servicio universal
- [ ] Parse expone `DocumentUploadWidget` + service `parse-invoice`
- [ ] Mini lo consume para carga de facturas de compra
- [ ] Clubix lo consume para escanear gastos

### Fase 3 — Elore integrado como sistema de tareas del ecosistema
- [ ] Elore expone `TaskCreatorWidget`
- [ ] Todas las apps pueden crear tareas desde sus propios errores/eventos
- [ ] Elore consume `FacturacionWidget` de Mini

### Fase 4 — Checkpoint + MediFlow
- [ ] Checkpoint expone `CheckInWidget` + `BiometricAuthWidget`
- [ ] MediFlow consume facturación de Mini
- [ ] MediFlow consume documentos de AxiomaDocs

### Fase 5 — Tally + AxiomaDocs
- [ ] Tally consume Parse para extracción de resúmenes
- [ ] AxiomaDocs expone `DocStatusWidget`
- [ ] Tally genera asientos via Mini

### Fase 6 — Registry centralizado en Core
- [ ] Core lee y almacena manifests de todas las apps
- [ ] Panel de integraciones en Core admin
- [ ] Configuración de qué integraciones tiene cada tenant
- [ ] Dashboard de uso cross-app (métricas)

---

## 10. Principios del Ecosistema

Estos principios guían toda decisión de integración:

1. **Cada app es dueña de sus datos.** Usar un widget de otra app no transfiere la propiedad del dato generado.

2. **Core es la única fuente de verdad de identidad.** Auth, sesiones y permisos son responsabilidad de Core.

3. **Los widgets son experiencia, los servicios son lógica.** Un widget es la UI completa. Un service es una función sin UI.

4. **Sin acoplamiento en build time.** Todo es dinámico en runtime. Una app puede desplegarse sin que las otras se enteren.

5. **Cada app tiene su propia base de datos.** No hay base de datos compartida entre apps del ecosistema.

6. **El build de federation es adicional, nunca reemplaza el build principal.** Las apps funcionan perfectamente sin que otras las consuman.

7. **React es siempre external en los bundles de federation.** La app consumidora usa su propio React. Esto resuelve el conflicto React 18 vs React 19.

8. **Preferir stateless.** Si una función puede ejecutarse sin persistir estado, se hace stateless (pasar parámetros, recibir resultado). El storage solo aparece cuando hay valor real en conservarlo.

---

## 11. Árbol de Dependencias del Ecosistema

```
                        ┌─────────┐
                        │  CORE   │ ← SSO, Registry, Auth central
                        └────┬────┘
           ┌─────────────────┼──────────────────────┐
           ↓                 ↓                      ↓
     ┌──────────┐     ┌──────────┐          ┌──────────┐
     │ MINI ERP │     │  PARSE   │          │  ELORE   │
     │(factura) │     │(extrae)  │          │(tareas)  │
     └────┬─────┘     └────┬─────┘          └────┬─────┘
          │                │                     │
    ┌─────┼──────┐    ┌────┴────┐           ┌────┴────┐
    ↓     ↓      ↓    ↓         ↓           ↓         ↓
 Clubix MediFlow Tally Clubix  Mini ERP  Clubix   Mini ERP
                       MediFlow  Tally   MediFlow  Elore

 ┌────────────┐    ┌──────────────┐
 │ CHECKPOINT │    │  AXIOMADOCS  │
 │ (presencia)│    │ (documentos) │
 └─────┬──────┘    └──────┬───────┘
       ↓                  ↓
   Clubix              MediFlow
   MediFlow            Elore
```

---

*Documento generado en sesión de diseño — Abril 2026*
*Ver también: `INTEGRACION-ECOSISTEMA-ROJOPLUS-MINI.md` para el diseño detallado del primer par implementado*
