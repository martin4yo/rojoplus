# 📊 PROPUESTA: MÓDULO INTEGRAL DE GESTIÓN

**Sistema Unificado de Cobranzas + Recupero de Socios + Comunicaciones**

---

## 📑 ÍNDICE

1. [Visión General](#visión-general)
2. [PARTE I: Gestión de Cobranzas](#parte-i-gestión-de-cobranzas)
3. [PARTE II: Recupero de Socios](#parte-ii-recupero-de-socios)
4. [PARTE III: Sistema de Comunicaciones](#parte-iii-sistema-de-comunicaciones)
5. [Roadmap de Implementación](#roadmap-de-implementación)
6. [Resumen Ejecutivo](#resumen-ejecutivo)

---

## 🎯 VISIÓN GENERAL

Este módulo integral unifica tres pilares fundamentales de la gestión del club:

### Objetivos Estratégicos

**📈 COBRANZAS**
- Reducir tasa de morosidad en 20-30%
- Sistematizar el seguimiento de deudas
- Crear planes de pago personalizados
- Automatizar recordatorios

**🔄 RECUPERO DE SOCIOS**
- Recuperar 10-15% de socios dados de baja
- Entender motivos de abandono
- Crear campañas de reactivación segmentadas
- Ofrecer incentivos personalizados

**📧 COMUNICACIONES**
- Centralizar todas las comunicaciones del club
- Enviar campañas masivas multicanal
- Medir efectividad (apertura, clicks)
- Automatizar comunicaciones recurrentes

### Beneficios Integrados

- 💰 **Mejora del flujo de caja** - Cobranza más efectiva + recupero de socios
- 📊 **Decisiones basadas en datos** - Métricas de gestión, churn y campañas
- ⏰ **Automatización total** - Recordatorios, seguimientos, emails programados
- 🎯 **Comunicación personalizada** - Segmentación por perfil y comportamiento
- 📈 **ROI medible** - Tracking de cada acción y campaña

---

# PARTE I: GESTIÓN DE COBRANZAS

## 🔍 PROBLEMA ACTUAL

Actualmente el sistema tiene:

✅ **Lo que funciona:**
- Cargos automáticos de cuotas
- Cuenta corriente por socio
- Detección de cuotas vencidas
- Emails automáticos de recordatorio

❌ **Lo que falta:**
- Panel centralizado de morosidad
- Registro de gestiones de cobranza
- Seguimiento de contactos con morosos
- Planes de pago y acuerdos
- Métricas de efectividad de cobranza
- Asignación de responsables

## 1. NUEVOS MODELOS DE BASE DE DATOS

### 📌 A. Gestión de Cobranza

```prisma
model GestionCobranza {
  id              Int       @id @default(autoincrement())

  // Socio relacionado
  socioId         Int
  socio           Socio     @relation(fields: [socioId], references: [id])

  // Estado de la gestión
  estado          EstadoGestion @default(PENDIENTE)
  prioridad       Prioridad     @default(MEDIA)

  // Deuda
  montoDeuda      Float
  cuotasAdeudadas Int
  diasAtraso      Int

  // Última acción
  ultimaAccion    TipoAccionCobranza?
  fechaUltimaAccion DateTime?

  // Próxima acción programada
  proximaAccion   TipoAccionCobranza?
  fechaProximaAccion DateTime?

  // Responsable
  responsableId   Int?
  responsable     Admin?    @relation(fields: [responsableId], references: [id])

  // Acciones realizadas
  acciones        AccionCobranza[]

  // Plan de pago activo
  planPagoId      Int?      @unique
  planPago        PlanPago? @relation(fields: [planPagoId], references: [id])

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([socioId])
  @@index([estado])
  @@index([responsableId])
}

enum EstadoGestion {
  PENDIENTE         // Sin contactar
  EN_GESTION        // Contactado, en proceso
  PLAN_PAGO         // Con plan de pago activo
  PROMESA_PAGO      // Prometió pagar
  NO_CONTACTADO     // No atiende/responde
  RESUELTO          // Deuda saldada
  BAJA              // Socio dado de baja
}

enum Prioridad {
  BAJA    // < 30 días de atraso
  MEDIA   // 30-60 días
  ALTA    // 60-90 días
  CRITICA // > 90 días
}

enum TipoAccionCobranza {
  LLAMADA_TELEFONICA
  EMAIL
  WHATSAPP
  VISITA_CLUB
  CARTA_DOCUMENTO
  PROMESA_PAGO
  PLAN_PAGO
  PAGO_PARCIAL
  PAGO_TOTAL
}
```

### 📌 B. Acciones de Cobranza

```prisma
model AccionCobranza {
  id              Int       @id @default(autoincrement())

  // Gestión relacionada
  gestionId       Int
  gestion         GestionCobranza @relation(fields: [gestionId], references: [id])

  // Tipo de acción
  tipo            TipoAccionCobranza
  fecha           DateTime  @default(now())

  // Resultado
  resultado       ResultadoAccion
  contactado      Boolean   @default(false)

  // Detalles
  observaciones   String?   @db.Text
  monto           Float?    // Si fue un pago
  promesaPago     DateTime? // Si prometió pagar

  // Próxima acción sugerida
  proximaAccion   TipoAccionCobranza?
  fechaProxima    DateTime?

  // Responsable de la acción
  responsableId   Int
  responsable     Admin     @relation(fields: [responsableId], references: [id])

  createdAt       DateTime  @default(now())

  @@index([gestionId])
  @@index([fecha])
}

enum ResultadoAccion {
  EXITOSO           // Contactado y positivo
  PROMESA_PAGO      // Prometió pagar
  SIN_RESPUESTA     // No atiende
  NEGATIVO          // Se niega a pagar
  PENDIENTE         // Pidió más tiempo
  INFORMATIVO       // Solo se informó
}
```

### 📌 C. Plan de Pago

```prisma
model PlanPago {
  id              Int       @id @default(autoincrement())

  // Socio y gestión
  socioId         Int
  socio           Socio     @relation(fields: [socioId], references: [id])
  gestion         GestionCobranza?

  // Deuda original
  deudaOriginal   Float
  montoTotal      Float     // Puede incluir intereses

  // Plan
  cantidadCuotas  Int
  montoCuota      Float
  fechaInicio     DateTime

  // Estado
  estado          EstadoPlanPago @default(ACTIVO)
  cuotasPagadas   Int       @default(0)

  // Cuotas del plan
  cuotas          CuotaPlanPago[]

  // Observaciones
  observaciones   String?   @db.Text

  // Auditoría
  creadoPor       Int
  admin           Admin     @relation(fields: [creadoPor], references: [id])

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([socioId])
  @@index([estado])
}

enum EstadoPlanPago {
  ACTIVO
  CUMPLIDO
  INCUMPLIDO
  CANCELADO
}

model CuotaPlanPago {
  id              Int       @id @default(autoincrement())

  planPagoId      Int
  planPago        PlanPago  @relation(fields: [planPagoId], references: [id], onDelete: Cascade)

  numeroCuota     Int
  monto           Float
  fechaVencimiento DateTime

  // Estado
  pagado          Boolean   @default(false)
  fechaPago       DateTime?
  montoPagado     Float?

  // Relación con pago (si existe)
  pagoId          Int?
  pago            Pago?     @relation(fields: [pagoId], references: [id])

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([planPagoId])
  @@index([fechaVencimiento])
}
```

## 2. PANTALLAS Y FLUJO DE TRABAJO

### 🖥️ Panel Principal de Cobranzas (/admin/cobranzas)

#### Vista General

```
┌────────────────────────────────────────────────────────────┐
│ GESTIÓN DE COBRANZAS                          [Exportar]   │
├────────────────────────────────────────────────────────────┤
│                                                             │
│ 📊 RESUMEN                                                  │
│ ┌─────────────┬─────────────┬─────────────┬─────────────┐  │
│ │ 💰 Deuda    │ 📞 Gestiones│ ✅ Planes   │ ⚠️ Críticos │  │
│ │ Total       │ Activas     │ Activos     │             │  │
│ │ $1.250.000  │ 45          │ 12          │ 8           │  │
│ └─────────────┴─────────────┴─────────────┴─────────────┘  │
│                                                             │
│ FILTROS:                                                    │
│ Estado: [Todos ▼]  Prioridad: [Todas ▼]  Días: [30-60 ▼]  │
│ Responsable: [Todos ▼]                      🔍 Buscar...   │
│                                                             │
├────────────────────────────────────────────────────────────┤
│ SOCIOS EN GESTIÓN                                          │
│                                                             │
│ ⚠️ CRÍTICA - Pérez, Juan (#1234)                          │
│ Deuda: $45.000 | 3 cuotas | 95 días atraso                │
│ Estado: EN_GESTION | Resp: María López                     │
│ Última acción: 10/03 - Llamada (Sin respuesta)            │
│ Próxima: 15/03 - Llamada telefónica                       │
│ [Ver detalle] [Registrar acción] [Crear plan]             │
│                                                             │
│ 🔴 ALTA - González, Ana (#5678)                           │
│ Deuda: $30.000 | 2 cuotas | 75 días atraso                │
│ Estado: PLAN_PAGO (Cuota 2/6 - Al día)                     │
│ [Ver detalle] [Ver plan]                                   │
│                                                             │
│ 🟡 MEDIA - Rodríguez, Carlos (#9012)                      │
│ Deuda: $15.000 | 1 cuota | 45 días atraso                 │
│ Estado: PROMESA_PAGO (Para el 20/03)                      │
│ [Ver detalle] [Registrar acción]                           │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

### 🖥️ Detalle de Gestión de Cobranza

```
┌──────────────────────────────────────────────────────────┐
│ GESTIÓN DE COBRANZA - Juan Pérez (#1234)                 │
├──────────────────────────────────────────────────────────┤
│ 1. 📋 Información del Socio                              │
│                                                           │
│ Socio: Juan Pérez (#1234)                                │
│ Email: juan.perez@email.com                              │
│ Teléfono: 11-5555-1234                                   │
│ Categoría: Activo                                        │
│ Antigüedad: 3 años                                       │
│ Historial de pagos: ⭐ Bueno (90% puntual)              │
│                                                           │
├──────────────────────────────────────────────────────────┤
│ 2. 💰 Deuda Actual                                       │
│                                                           │
│ Total adeudado: $45.000                                  │
│ Cuotas vencidas: 3                                       │
│ Días de atraso: 95 días                                  │
│ Prioridad: ⚠️ CRÍTICA                                    │
│                                                           │
│ Detalle:                                                 │
│ • Enero 2026 - $15.000 (Venc: 10/01)                    │
│ • Febrero 2026 - $15.000 (Venc: 10/02)                  │
│ • Marzo 2026 - $15.000 (Venc: 10/03)                    │
│                                                           │
│ [Ver cuenta corriente completa]                          │
│                                                           │
├──────────────────────────────────────────────────────────┤
│ 3. 📞 Historial de Gestiones                            │
│                                                           │
│ 📋 10/03/2026 14:30 - Llamada telefónica                │
│    Resultado: Sin respuesta                              │
│    Responsable: María López                              │
│    Observaciones: No atiende. Dejé mensaje de voz.      │
│    Próxima acción: 15/03 - Llamada                      │
│                                                           │
│ 📋 05/03/2026 10:15 - Email recordatorio                │
│    Resultado: Informativo                                │
│    Estado del email: Abierto ✓                          │
│                                                           │
│ 📋 28/02/2026 16:00 - Llamada telefónica                │
│    Resultado: Promesa de pago                            │
│    Observaciones: Prometió pagar el 05/03. No cumplió.  │
│                                                           │
│ [Ver historial completo]                                 │
│                                                           │
├──────────────────────────────────────────────────────────┤
│ 4. ⚡ Acciones Rápidas                                   │
│                                                           │
│ [📞 Registrar llamada]  [📧 Enviar email]                │
│ [💬 WhatsApp]  [💵 Crear plan de pago]                   │
│ [✅ Registrar pago]  [📄 Imprimir resumen]               │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

### 🖥️ Modal: Registrar Acción de Cobranza

```
┌──────────────────────────────────────────┐
│ Registrar Acción de Cobranza             │
├──────────────────────────────────────────┤
│ Socio: Juan Pérez (#1234)                │
│ Deuda actual: $45.000 (3 cuotas)         │
│                                          │
│ Tipo de acción:                          │
│ (•) Llamada telefónica                   │
│ ( ) Email                                │
│ ( ) WhatsApp                             │
│ ( ) Visita al club                       │
│ ( ) Pago registrado                      │
│                                          │
│ Fecha y hora: [15/03/2026 10:30]         │
│                                          │
│ ¿Se pudo contactar?                      │
│ (•) Sí   ( ) No                          │
│                                          │
│ Resultado:                               │
│ ( ) Promesa de pago                      │
│ (•) Solicita plan de pago                │
│ ( ) Se niega a pagar                     │
│ ( ) Solicita más tiempo                  │
│                                          │
│ Observaciones:                           │
│ ┌────────────────────────────────────┐   │
│ │ Atendió. Dice que tuvo problemas   │   │
│ │ económicos pero quiere arreglar.   │   │
│ │ Solicita plan de 6 cuotas.         │   │
│ └────────────────────────────────────┘   │
│                                          │
│ Próxima acción: [v] Plan de pago         │
│ Fecha: [18/03/2026]                      │
│ [✓] Recordarme                           │
│                                          │
│      [Cancelar]  [Guardar]               │
│                 [Guardar y crear plan]   │
└──────────────────────────────────────────┘
```

### 🖥️ Modal: Crear Plan de Pago

```
┌──────────────────────────────────────────┐
│ Crear Plan de Pago                       │
├──────────────────────────────────────────┤
│ Socio: Juan Pérez (#1234)                │
│ Deuda total: $45.000                     │
│                                          │
│ Cantidad de cuotas: [6]                  │
│                                          │
│ Interés mensual: [0]%                    │
│ (Opcional - 0% sin interés)              │
│                                          │
│ Fecha primera cuota: [01/04/2026]        │
│                                          │
│ ┌────────────────────────────────────┐   │
│ │ RESUMEN DEL PLAN                   │   │
│ │                                    │   │
│ │ • Deuda original: $45.000          │   │
│ │ • Intereses: $0                    │   │
│ │ • Total a pagar: $45.000           │   │
│ │                                    │   │
│ │ • Cantidad de cuotas: 6            │   │
│ │ • Monto por cuota: $7.500          │   │
│ │                                    │   │
│ │ CRONOGRAMA:                        │   │
│ │ 1. 01/04/2026 - $7.500             │   │
│ │ 2. 01/05/2026 - $7.500             │   │
│ │ 3. 01/06/2026 - $7.500             │   │
│ │ 4. 01/07/2026 - $7.500             │   │
│ │ 5. 01/08/2026 - $7.500             │   │
│ │ 6. 01/09/2026 - $7.500             │   │
│ └────────────────────────────────────┘   │
│                                          │
│ Observaciones:                           │
│ ┌────────────────────────────────────┐   │
│ │ Plan acordado telefónicamente.     │   │
│ │ Socio comprometido a cumplir.      │   │
│ └────────────────────────────────────┘   │
│                                          │
│ [✓] Enviar email con detalle del plan    │
│                                          │
│      [Cancelar]  [Crear Plan de Pago]    │
└──────────────────────────────────────────┘
```

## 3. AUTOMATIZACIONES

### A. Clasificación automática de morosidad

```javascript
// Job diario: Actualizar gestiones de cobranza
async function actualizarGestionesCobranza() {
  const sociosConDeuda = await prisma.socio.findMany({
    where: {
      estado: { in: ['ACTIVO', 'VIGENTE'] },
      cargos: {
        some: {
          saldoPendiente: { gt: 0 },
          fechaVencimiento: { lt: new Date() }
        }
      }
    },
    include: {
      cargos: {
        where: {
          saldoPendiente: { gt: 0 },
          fechaVencimiento: { lt: new Date() }
        }
      }
    }
  })

  for (const socio of sociosConDeuda) {
    const deudaTotal = socio.cargos.reduce((sum, c) => sum + c.saldoPendiente, 0)
    const cuotasAdeudadas = socio.cargos.length
    const fechaVencimientoMasAntigua = Math.min(...socio.cargos.map(c => c.fechaVencimiento))
    const diasAtraso = calcularDias(fechaVencimientoMasAntigua, new Date())

    // Determinar prioridad según días de atraso
    let prioridad = 'BAJA'
    if (diasAtraso > 90) prioridad = 'CRITICA'
    else if (diasAtraso > 60) prioridad = 'ALTA'
    else if (diasAtraso > 30) prioridad = 'MEDIA'

    // Crear o actualizar gestión
    await prisma.gestionCobranza.upsert({
      where: { socioId: socio.id },
      create: {
        socioId: socio.id,
        estado: 'PENDIENTE',
        prioridad,
        montoDeuda: deudaTotal,
        cuotasAdeudadas,
        diasAtraso
      },
      update: {
        prioridad,
        montoDeuda: deudaTotal,
        cuotasAdeudadas,
        diasAtraso
      }
    })
  }
}
```

### B. Recordatorios automáticos

```javascript
// Enviar recordatorios de acciones pendientes
async function enviarRecordatorios() {
  const hoy = new Date()

  const accionesPendientes = await prisma.accionCobranza.findMany({
    where: {
      fechaProxima: {
        gte: startOfDay(hoy),
        lte: endOfDay(hoy)
      }
    },
    include: {
      gestion: { include: { socio: true, responsable: true } }
    }
  })

  for (const accion of accionesPendientes) {
    // Enviar notificación al responsable
    await notificarResponsable({
      adminId: accion.responsableId,
      tipo: 'RECORDATORIO_COBRANZA',
      mensaje: `Acción pendiente: ${accion.proximaAccion} - ${accion.gestion.socio.apellidoNombre}`,
      link: `/admin/cobranzas/${accion.gestionId}`
    })
  }
}
```

### C. Control de planes de pago

```javascript
// Verificar cumplimiento de planes de pago
async function verificarPlanesPago() {
  const hoy = new Date()

  const planesActivos = await prisma.planPago.findMany({
    where: { estado: 'ACTIVO' },
    include: {
      cuotas: true,
      socio: true
    }
  })

  for (const plan of planesActivos) {
    const cuotasVencidas = plan.cuotas.filter(c =>
      !c.pagado && c.fechaVencimiento < hoy
    )

    if (cuotasVencidas.length > 0) {
      // Marcar plan como incumplido
      await prisma.planPago.update({
        where: { id: plan.id },
        data: { estado: 'INCUMPLIDO' }
      })

      // Crear acción de seguimiento
      await prisma.accionCobranza.create({
        data: {
          gestionId: plan.gestion.id,
          tipo: 'PLAN_PAGO',
          resultado: 'NEGATIVO',
          observaciones: `Plan incumplido: ${cuotasVencidas.length} cuota(s) vencida(s)`,
          responsableId: plan.gestion.responsableId
        }
      })
    }
  }
}
```

## 4. REPORTES ESPECÍFICOS DE COBRANZAS

### Dashboard de Cobranzas

- **Métricas principales:**
  - Deuda total del mes
  - Tasa de recupero (%)
  - Efectividad de gestiones (contactados vs resueltos)
  - Tiempo promedio de resolución
  - Planes de pago activos vs cumplidos

- **Gráficos:**
  - Evolución de morosidad (últimos 6 meses)
  - Deuda por antigüedad (0-30, 30-60, 60-90, +90 días)
  - Efectividad por tipo de acción
  - Top 10 morosos

- **Exportaciones:**
  - Lista de morosos con detalle
  - Reporte de gestiones realizadas
  - Estado de planes de pago

---

# PARTE II: RECUPERO DE SOCIOS

## 🔍 PROBLEMA ACTUAL

Cuando un socio se da de baja:

❌ **No se registra:**
- Motivo de la baja
- Nivel de satisfacción
- Posibilidad de retorno

❌ **No hay proceso de:**
- Encuesta de salida
- Seguimiento post-baja
- Ofertas de reactivación
- Campañas de recupero

❌ **Se pierde información valiosa:**
- ¿Por qué se van los socios?
- ¿Qué podríamos mejorar?
- ¿Cuántos podrían volver?

## 1. NUEVOS MODELOS PARA RECUPERO

### 📌 A. Ampliación del modelo Socio

```prisma
model Socio {
  // ... campos existentes ...

  // Recupero
  estadoRecupero      EstadoRecupero?  @default(PENDIENTE)
  motivoBajaCategoria MotivoBaja?
  motivoBajaDetalle   String?          @db.Text
  encuestasBaja       EncuestaBaja[]
  accionesRecupero    AccionRecupero[]
  intentosRecupero    Int              @default(0)
  fechaUltimoContactoRecupero DateTime?
  bajaDefinitiva      Boolean          @default(false)
}

enum EstadoRecupero {
  PENDIENTE         // Recién dado de baja, sin contactar
  CONTACTADO        // Se intentó contactar
  INTERESADO        // Mostró interés en volver
  NO_INTERESADO     // No quiere volver
  RECUPERADO        // Volvió al club
  BAJA_DEFINITIVA   // Baja confirmada, no contactar más
}

enum MotivoBaja {
  ECONOMICO
  MUDANZA
  FALTA_USO
  INSATISFACCION_SERVICIOS
  OTRO_CLUB
  SALUD
  TEMPORARIA
  OTRO
}
```

### 📌 B. Encuesta de Baja

```prisma
model EncuestaBaja {
  id              Int       @id @default(autoincrement())

  socioId         Int
  socio           Socio     @relation(fields: [socioId], references: [id])

  // Motivo principal
  motivoPrincipal MotivoBaja
  motivoDetalle   String?   @db.Text

  // Satisfacción
  satisfaccion    Int       // 1-5 estrellas
  recomendaria    Boolean?

  // Otro club
  seVaOtroClub    Boolean   @default(false)
  nombreOtroClub  String?

  // Posibilidad de retorno
  volveria        Boolean?
  condicionesVolver String? @db.Text

  // Comentarios
  comentarios     String?   @db.Text

  // Contacto futuro
  aceptaContacto  Boolean   @default(true)

  // Metadata
  fechaEncuesta   DateTime  @default(now())

  @@index([socioId])
  @@index([motivoPrincipal])
}
```

### 📌 C. Acciones de Recupero

```prisma
model AccionRecupero {
  id              Int       @id @default(autoincrement())

  socioId         Int
  socio           Socio     @relation(fields: [socioId], references: [id])

  // Campaña relacionada (si aplica)
  campanaId       Int?
  campana         CampanaRecupero? @relation(fields: [campanaId], references: [id])

  // Acción
  tipo            TipoAccionRecupero
  fecha           DateTime  @default(now())

  // Resultado
  resultado       ResultadoRecupero
  nivelInteres    NivelInteres?

  // Detalles
  observaciones   String?   @db.Text
  objeciones      String?   @db.Text
  ofertaRealizada String?   @db.Text

  // Seguimiento
  proximaAccion   TipoAccionRecupero?
  fechaProxima    DateTime?
  recordatorio    Boolean   @default(false)

  // Responsable
  responsableId   Int
  responsable     Admin     @relation(fields: [responsableId], references: [id])

  createdAt       DateTime  @default(now())

  @@index([socioId])
  @@index([fecha])
}

enum TipoAccionRecupero {
  LLAMADA_TELEFONICA
  EMAIL
  WHATSAPP
  VISITA_CLUB
  EVENTO_ESPECIAL
}

enum ResultadoRecupero {
  RECUPERADO        // Volvió al club
  INTERESADO        // Mostró interés
  SIN_RESPUESTA     // No contactado
  NO_INTERESADO     // No quiere volver
  PENDIENTE_DECISION // Evaluando
}

enum NivelInteres {
  ALTO
  MEDIO
  BAJO
  NULO
}
```

### 📌 D. Campañas de Recupero

```prisma
model CampanaRecupero {
  id              Int       @id @default(autoincrement())

  nombre          String
  descripcion     String?   @db.Text

  // Segmentación
  motivosBaja     MotivoBaja[] // Filtrar por motivos
  tiempoBajaMin   Int?      // Días mínimos de baja
  tiempoBajaMax   Int?      // Días máximos de baja

  // Oferta/Incentivo
  oferta          String    @db.Text
  descuento       Float?
  mesesDescuento  Int?
  sinCuotaIngreso Boolean   @default(false)

  // Vigencia
  fechaInicio     DateTime
  fechaFin        DateTime
  activa          Boolean   @default(true)

  // Resultados
  sociosObjetivo  Int       @default(0)
  contactados     Int       @default(0)
  interesados     Int       @default(0)
  recuperados     Int       @default(0)

  // Acciones
  acciones        AccionRecupero[]

  // Auditoría
  creadoPor       Int
  admin           Admin     @relation(fields: [creadoPor], references: [id])

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([activa])
}
```

## 2. PANTALLAS Y FLUJO DE TRABAJO

### 🖥️ Panel de Recupero (/admin/recupero)

```
┌────────────────────────────────────────────────────────────┐
│ RECUPERO DE SOCIOS                            [Exportar]   │
├────────────────────────────────────────────────────────────┤
│                                                             │
│ 📊 RESUMEN                                                  │
│ ┌─────────────┬─────────────┬─────────────┬─────────────┐  │
│ │ 👥 Ex-socios│ 🎯 Alto     │ ✅ Recuper. │ 📅 Campañas │  │
│ │ Recuperables│ Potencial   │ Este mes    │ Activas     │  │
│ │ 85          │ 32          │ 5           │ 2           │  │
│ └─────────────┴─────────────┴─────────────┴─────────────┘  │
│                                                             │
│ FILTROS:                                                    │
│ Estado: [Todos ▼]  Motivo: [Todos ▼]  Tiempo: [3-12 m ▼] │
│ Interés: [Todos ▼]                      🔍 Buscar...       │
│                                                             │
├────────────────────────────────────────────────────────────┤
│ EX-SOCIOS CON POTENCIAL DE RECUPERO                        │
│                                                             │
│ ⭐ ALTO POTENCIAL - Martínez, Laura (#2345)               │
│ Baja: 15/01/2026 (58 días) | Motivo: Económico            │
│ Satisfacción: 5/5 | Volvería: Sí                          │
│ Última acción: 10/03 - Llamada (Interesado - Medio)       │
│ Próxima: 15/03 - Seguimiento                              │
│ [Ver detalle] [Registrar contacto] [Ofrecer promo]        │
│                                                             │
│ 🌟 MEDIO POTENCIAL - Fernández, Roberto (#3456)           │
│ Baja: 01/12/2025 (102 días) | Motivo: Falta de uso        │
│ Satisfacción: 4/5 | Volvería: Tal vez                     │
│ Estado: SIN_CONTACTAR                                      │
│ [Ver detalle] [Contactar]                                  │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

### 🖥️ Detalle de Ex-Socio

```
┌──────────────────────────────────────────────────────────┐
│ RECUPERO - Laura Martínez (#2345)                        │
├──────────────────────────────────────────────────────────┤
│ 1. 📋 Información del Ex-Socio                           │
│                                                           │
│ Ex-socio: Laura Martínez (#2345)                         │
│ Email: laura.martinez@email.com                          │
│ Teléfono: 11-5555-6789                                   │
│ Categoría anterior: Activo                               │
│ Tiempo como socio: 2 años 3 meses                        │
│ Fecha de baja: 15/01/2026 (hace 58 días)                │
│                                                           │
├──────────────────────────────────────────────────────────┤
│ 2. 📝 Encuesta de Baja                                   │
│                                                           │
│ 📋 17/01/2026 - Encuesta completada                      │
│    Motivo: Económico                                     │
│    Satisfacción: ⭐⭐⭐⭐⭐ (5/5)                        │
│    Recomendaría: Sí                                      │
│    Volvería: Sí, cuando pueda                            │
│    Condiciones: "Cuando mejore mi situación económica"   │
│    Acepta contacto: Sí ✓                                 │
│                                                           │
├──────────────────────────────────────────────────────────┤
│ 3. 📞 Historial de Acciones de Recupero                 │
│                                                           │
│ 📋 10/03/2026 15:00 - Llamada telefónica                │
│    Campaña: "Volvé al Club - Otoño 2026"                │
│    Resultado: Interesado                                 │
│    Nivel de interés: Medio                               │
│    Objeciones: "Quiero volver pero aún no puedo pagar"   │
│    Oferta realizada: 3 meses con 50% descuento           │
│    Observaciones: Muy amable, preguntó por los horarios  │
│    Próxima acción: 15/03/2026                            │
│    Responsable: Juan Pérez                               │
│                                                           │
│ [Ver historial completo]                                 │
│                                                           │
├──────────────────────────────────────────────────────────┤
│ 4. 🎯 Estrategia de Recupero                            │
│                                                           │
│ Perfil: ⭐ ALTO POTENCIAL                                │
│ - Buen historial de pagos                               │
│ - Alta satisfacción                                      │
│ - Motivo temporal (económico)                            │
│ - Mostró interés en volver                               │
│                                                           │
│ Acciones sugeridas:                                      │
│ ✅ Oferta personalizada                                  │
│ ✅ Seguimiento mensual                                   │
│ ✅ Invitación a evento familiar                          │
│                                                           │
├──────────────────────────────────────────────────────────┤
│ 5. ⚡ Acciones Rápidas                                   │
│                                                           │
│ [📞 Registrar contacto]  [📧 Enviar oferta especial]     │
│ [💬 WhatsApp]  [🎁 Aplicar promoción]                    │
│ [✅ Marcar como reactivado]                              │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

### 🖥️ Modal: Registrar Contacto de Recupero

```
┌──────────────────────────────────────────┐
│ Registrar Contacto de Recupero           │
├──────────────────────────────────────────┤
│ Socio: Laura Martínez (#2345)            │
│ Dado de baja: 15/01/2026 (58 días)       │
│                                          │
│ Tipo de contacto: [v] Llamada telefónica │
│ Fecha: [15/03/2026 11:45]                │
│                                          │
│ ¿Cómo fue el contacto?                   │
│ ┌────────────────────────────────────┐   │
│ │ Llamé y atendió. Le conté sobre   │   │
│ │ la nueva promo del 50% por 3 meses.│   │
│ │ Se mostró interesado pero dice que │   │
│ │ todavía no consiguió trabajo.      │   │
│ └────────────────────────────────────┘   │
│                                          │
│ Resultado: [v] Interesado                │
│                                          │
│ Nivel de interés: [v] Medio              │
│                                          │
│ Objeciones mencionadas:                  │
│ ┌────────────────────────────────────┐   │
│ │ - Aún sin trabajo                  │   │
│ │ - Preocupado por compromiso largo  │   │
│ └────────────────────────────────────┘   │
│                                          │
│ Oferta realizada:                        │
│ ┌────────────────────────────────────┐   │
│ │ 3 meses con 50% descuento + sin    │   │
│ │ cuota de reingreso                 │   │
│ └────────────────────────────────────┘   │
│                                          │
│ Próxima acción: [v] Seguimiento          │
│ Fecha: [05/04/2026]                      │
│ [✓] Recordarme                           │
│                                          │
│ Observaciones:                           │
│ ┌────────────────────────────────────┐   │
│ │ Muy buena onda. Promete pensarlo. │   │
│ │ Sugiero llamar en 3 semanas.       │   │
│ └────────────────────────────────────┘   │
│                                          │
│      [Cancelar]  [Guardar Contacto]      │
└──────────────────────────────────────────┘
```

### 🖥️ Modal: Encuesta de Baja

```
┌──────────────────────────────────────────┐
│ Encuesta de Baja - Laura Martínez        │
├──────────────────────────────────────────┤
│ ¿Cuál es el motivo principal de la baja? │
│ ( ) Económico                            │
│ ( ) Mudanza                              │
│ (•) Falta de uso                         │
│ ( ) Insatisfacción con servicios         │
│ ( ) Se va a otro club                    │
│ ( ) Problemas de salud                   │
│ ( ) Otro                                 │
│                                          │
│ Detalles del motivo:                     │
│ ┌────────────────────────────────────┐   │
│ │ No tengo tiempo para venir al club │   │
│ │ por trabajo. Prefiero cancelar.    │   │
│ └────────────────────────────────────┘   │
│                                          │
│ Satisfacción general con el club:        │
│ ⭐ ⭐ ⭐ ⭐ ☆                           │
│                                          │
│ ¿Recomendarías el club?                  │
│ (•) Sí   ( ) No   ( ) No sé              │
│                                          │
│ Si se van a otro club, ¿cuál?            │
│ [_____________________]                  │
│                                          │
│ ¿Volverías en el futuro?                 │
│ (•) Sí   ( ) No   ( ) Tal vez            │
│                                          │
│ ¿Qué tendría que pasar para que vuelvas? │
│ ┌────────────────────────────────────┐   │
│ │ Cuando tenga más tiempo libre      │   │
│ └────────────────────────────────────┘   │
│                                          │
│ Comentarios finales (opcional):          │
│ ┌────────────────────────────────────┐   │
│ │ Excelente club, muy buenas         │   │
│ │ instalaciones. Es solo por tiempo. │   │
│ └────────────────────────────────────┘   │
│                                          │
│ ¿Podemos contactarte en el futuro?       │
│ (•) Sí   ( ) No                          │
│                                          │
│      [Cancelar]  [Guardar Encuesta]      │
└──────────────────────────────────────────┘
```

### 🖥️ Campañas de Recupero

```
┌──────────────────────────────────────────────────────┐
│ CAMPAÑA: "Volvé al Club - Promo Otoño 2026"         │
│ Estado: ACTIVA                                       │
│ Período: 01/03/2026 - 31/05/2026                     │
│                                                      │
│ Segmento:                                            │
│ - Motivo baja: Económico, Falta de uso              │
│ - Tiempo de baja: 3-12 meses                         │
│ - Socios objetivo: 45                                │
│                                                      │
│ Oferta: 50% desc. por 3 meses + Sin cuota ingreso   │
│                                                      │
│ Resultados:                                          │
│ - Contactados: 38 (84%)                              │
│ - Interesados: 12 (27%)                              │
│ - Recuperados: 5 (11%)                               │
│ - Ingresos: $78.500                                  │
│                                                      │
│ [Ver detalle] [Pausar] [Enviar recordatorio]         │
└──────────────────────────────────────────────────────┘
```

## 3. AUTOMATIZACIONES

### A. Job automático de segmentación

```javascript
// Ejecutar diariamente
async function clasificarSociosBaja() {
  const hoy = new Date()
  const sociosBaja = await prisma.socio.findMany({
    where: {
      estado: { in: ['BAJA', 'INACTIVO'] },
      bajaDefinitiva: false,
    },
    include: { encuestasBaja: true }
  })

  for (const socio of sociosBaja) {
    const diasBaja = calcularDias(socio.fechaBaja, hoy)

    // Determinar estado de recupero según tiempo
    let estadoRecupero = 'PENDIENTE'

    if (socio.intentosRecupero >= 3 && diasBaja > 180) {
      estadoRecupero = 'NO_INTERESADO'
    } else if (diasBaja <= 90) {
      estadoRecupero = 'PENDIENTE'  // Prioridad alta
    }

    await prisma.socio.update({
      where: { id: socio.id },
      data: { estadoRecupero }
    })
  }
}
```

### B. Email automático post-baja

```javascript
// 7 días después de la baja
async function enviarEncuestaBaja(socioId) {
  const socio = await prisma.socio.findUnique({
    where: { id: socioId },
    include: { encuestasBaja: true }
  })

  if (socio.encuestasBaja.length === 0) {
    await emailService.enviar({
      to: socio.email,
      template: 'encuesta-baja',
      data: {
        nombre: socio.nombre,
        linkEncuesta: `${URL_BASE}/encuesta-baja/${socio.tokenPortal}`
      }
    })
  }
}

// 30 días después de la baja (si motivo es recuperable)
async function enviarPrimeraOfertaRecupero(socioId) {
  const motivosRecuperables = ['ECONOMICO', 'FALTA_USO', 'TEMPORARIA']

  const socio = await prisma.socio.findUnique({
    where: { id: socioId },
    include: { encuestasBaja: true }
  })

  if (motivosRecuperables.includes(socio.motivoBajaCategoria)) {
    await emailService.enviar({
      to: socio.email,
      template: 'te-extranamos',
      data: {
        nombre: socio.nombre,
        oferta: 'Volvé con 3 meses al 50% de descuento'
      }
    })
  }
}
```

## 4. REPORTES ESPECÍFICOS DE RECUPERO

### Dashboard de Recupero

- **Tasa de recupero mensual**
- **Tiempo promedio de recupero**
- **Motivos de baja más comunes**
- **Efectividad por tipo de acción**
- **ROI de campañas**

### Análisis de Churn (Abandono)

- **Tasa de baja mensual/anual**
- **Predicción de bajas** (socios en riesgo)
- **Perfil de socios que se van** (patrón)

### Efectividad de Ofertas

- **Qué ofertas convierten más**
- **Sensibilidad al precio**
- **Mejores incentivos por motivo de baja**

### Portal Socio - Vista de "Reactivación"

URL: `/s/{token}/reactivar`

```
┌──────────────────────────────────────────┐
│ ¡Te extrañamos, Laura!                   │
├──────────────────────────────────────────┤
│ Vimos que te diste de baja hace 2 meses. │
│                                          │
│ 🎁 OFERTA ESPECIAL PARA VOS:             │
│                                          │
│ ✅ 3 meses al 50% de descuento           │
│ ✅ SIN cuota de reingreso                │
│ ✅ Mantené tu número de socio (#2345)    │
│                                          │
│ Oferta válida hasta: 31/05/2026          │
│                                          │
│ [Quiero volver] [Contactar asesor]       │
│                                          │
│ ¿Querés contarnos por qué te fuiste?     │
│ [Completar encuesta (2 min)]             │
└──────────────────────────────────────────┘
```

---

# PARTE III: SISTEMA DE COMUNICACIONES

## 🔍 ESTADO ACTUAL

### ✅ Lo que ya funciona:

- Sistema de templates de email (Handlebars)
- NotificacionLog para programar envíos
- Jobs automáticos (cuotas vencer, vencidas, morosidad)
- Web Push notifications
- SMTP configurado (nodemailer)
- Templates en BD con variables

### ❌ Lo que falta:

- Panel de administración de comunicaciones
- Crear/editar templates desde la UI
- Envío manual de campañas
- Segmentación de destinatarios
- Estadísticas de envíos
- WhatsApp/SMS integration
- Preview de templates

## 1. NUEVOS MODELOS PARA COMUNICACIONES

### 📌 A. Campañas de Comunicación

```prisma
model CampanaComunicacion {
  id              Int       @id @default(autoincrement())

  // Datos básicos
  nombre          String
  descripcion     String?   @db.Text
  tipo            TipoCampana

  // Canal
  canal           CanalComunicacion[]

  // Template
  emailTemplateId String?
  emailTemplate   EmailTemplate? @relation(fields: [emailTemplateId], references: [id])
  whatsappTemplate String?  @db.Text
  smsTemplate      String?  @db.Text
  pushTemplate     String?  @db.Text

  // Segmentación
  segmentacion    Json     // Filtros: estado, categoria, deuda, etc

  // Destinatarios (pre-calculados)
  destinatarios   Json     // Array de {socioId, email, nombre, ...}
  totalDestinatarios Int   @default(0)

  // Programación
  estado          EstadoCampana @default(BORRADOR)
  fechaProgramada DateTime?
  fechaEnvio      DateTime?

  // Resultados
  enviados        Int       @default(0)
  abiertos        Int       @default(0)
  clicks          Int       @default(0)
  rebotados       Int       @default(0)
  errores         Int       @default(0)

  // Tracking individual
  envios          EnvioCampana[]

  // Auditoría
  creadoPor       Int
  admin           Admin     @relation(fields: [creadoPor], references: [id])

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

enum TipoCampana {
  INFORMATIVA      // Novedades generales del club
  COBRANZA         // Recordatorios de pago
  RECUPERO         // Reactivación de ex-socios
  EVENTO           // Invitación a eventos
  MARKETING        // Promociones
  DEPORTIVA        // Convocatorias, entrenamientos
}

enum CanalComunicacion {
  EMAIL
  WHATSAPP
  SMS
  PUSH
}

enum EstadoCampana {
  BORRADOR
  PROGRAMADA
  EN_CURSO
  COMPLETADA
  CANCELADA
  PAUSADA
}
```

### 📌 B. Tracking de Envíos

```prisma
model EnvioCampana {
  id              Int       @id @default(autoincrement())

  campanaId       Int
  campana         CampanaComunicacion @relation(fields: [campanaId], references: [id])

  socioId         Int
  socio           Socio     @relation(fields: [socioId], references: [id])

  canal           CanalComunicacion
  destinatario    String    // email, teléfono, etc

  // Estado
  estado          EstadoEnvio @default(PENDIENTE)
  fechaEnvio      DateTime?
  fechaApertura   DateTime?
  fechaClick      DateTime?

  // Tracking
  abierto         Boolean   @default(false)
  clickeo         Boolean   @default(false)
  rebotado        Boolean   @default(false)

  error           String?   @db.Text
  intentos        Int       @default(0)

  // IDs externos (para tracking)
  messageId       String?   // ID del proveedor (SMTP, WhatsApp, etc)

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([campanaId])
  @@index([socioId])
}

enum EstadoEnvio {
  PENDIENTE
  ENVIADO
  ENTREGADO
  ABIERTO
  CLICKEADO
  REBOTADO
  ERROR
}
```

### 📌 C. Listas de Distribución (opcional)

```prisma
model ListaDistribucion {
  id              Int       @id @default(autoincrement())

  nombre          String
  descripcion     String?   @db.Text

  // Segmentación fija o dinámica
  tipo            TipoLista @default(DINAMICA)

  // Si es dinámica, guardar filtros
  filtros         Json?     // { estado: "ACTIVO", categoria: "ACTIVO", ... }

  // Si es fija, relación con socios
  socios          SocioEnLista[]

  // Contador
  cantidadSocios  Int       @default(0)

  // Auditoría
  creadoPor       Int
  admin           Admin     @relation(fields: [creadoPor], references: [id])

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

enum TipoLista {
  FIJA       // Socios seleccionados manualmente
  DINAMICA   // Basada en criterios que se actualizan
}

model SocioEnLista {
  id              Int       @id @default(autoincrement())

  listaId         Int
  lista           ListaDistribucion @relation(fields: [listaId], references: [id], onDelete: Cascade)

  socioId         Int
  socio           Socio     @relation(fields: [socioId], references: [id], onDelete: Cascade)

  createdAt       DateTime  @default(now())

  @@unique([listaId, socioId])
}
```

## 2. PANTALLAS Y FLUJO DE TRABAJO

### 🖥️ Panel de Comunicaciones (/admin/comunicaciones)

**Tabs principales:**

1. **Campañas** - Crear y gestionar envíos masivos
2. **Templates** - Administrar plantillas
3. **Historial** - Ver envíos realizados
4. **Listas** - Segmentos de destinatarios (opcional)
5. **Estadísticas** - Métricas de efectividad

### 🖥️ Tab 1: Campañas

```
┌─────────────────────────────────────────────────────┐
│ [+ Nueva Campaña]                    🔍 Buscar...   │
├─────────────────────────────────────────────────────┤
│ 📧 Recordatorio Cuotas Marzo 2026                   │
│ Estado: COMPLETADA  │  Email  │  Enviados: 250/250  │
│ Abiertos: 187 (74.8%)  │  Clicks: 45 (18%)          │
│ [Ver detalle] [Ver estadísticas]                    │
├─────────────────────────────────────────────────────┤
│ 💬 Promoción Pileta Verano                          │
│ Estado: PROGRAMADA  │  WhatsApp + Email             │
│ Envío programado: 20/03/2026 10:00                  │
│ Destinatarios: 320 socios                           │
│ [Editar] [Cancelar] [Enviar ahora]                  │
├─────────────────────────────────────────────────────┤
│ 🎉 Te extrañamos - Volvé al club                    │
│ Estado: BORRADOR  │  Email  │  Destinatarios: 85    │
│ [Editar] [Eliminar]                                 │
└─────────────────────────────────────────────────────┘
```

### 🖥️ Wizard: Nueva Campaña (4 pasos)

**PASO 1: Tipo y Canal**

```
┌──────────────────────────────────────────┐
│ Nueva Campaña - Paso 1 de 4              │
├──────────────────────────────────────────┤
│ Nombre: [Recordatorio Cuotas Marzo____]  │
│                                          │
│ Tipo de campaña:                         │
│ ( ) Informativa                          │
│ (•) Cobranza                             │
│ ( ) Recupero                             │
│ ( ) Evento                               │
│ ( ) Marketing                            │
│ ( ) Deportiva                            │
│                                          │
│ Canales:                                 │
│ [✓] Email                                │
│ [✓] Push notification                    │
│ [ ] WhatsApp (próximamente)              │
│ [ ] SMS (próximamente)                   │
│                                          │
│           [Cancelar]  [Siguiente →]      │
└──────────────────────────────────────────┘
```

**PASO 2: Destinatarios (Segmentación)**

```
┌──────────────────────────────────────────┐
│ Nueva Campaña - Paso 2 de 4              │
├──────────────────────────────────────────┤
│ Seleccionar destinatarios:               │
│                                          │
│ (•) Filtros personalizados               │
│ ( ) Lista existente                      │
│ ( ) Selección manual                     │
│                                          │
│ ┌────────────────────────────────────┐   │
│ │ FILTROS                            │   │
│ │                                    │   │
│ │ Estado socio:                      │   │
│ │ [✓] Activo  [✓] Vigente  [ ] Baja │   │
│ │                                    │   │
│ │ Deuda:                             │   │
│ │ [✓] Con cuotas vencidas            │   │
│ │ Días de atraso: [15] a [60]        │   │
│ │                                    │   │
│ │ Categoría:                         │   │
│ │ [✓] Todos                          │   │
│ │                                    │   │
│ │ Zona:                              │   │
│ │ [v] Todas                          │   │
│ │                                    │   │
│ │ [Aplicar filtros]                  │   │
│ └────────────────────────────────────┘   │
│                                          │
│ Destinatarios encontrados: 85 socios     │
│ [Ver lista]                              │
│                                          │
│      [← Atrás]  [Cancelar]  [Siguiente →]│
└──────────────────────────────────────────┘
```

**PASO 3: Contenido**

```
┌──────────────────────────────────────────┐
│ Nueva Campaña - Paso 3 de 4              │
├──────────────────────────────────────────┤
│ 📧 EMAIL                                 │
│                                          │
│ Template: [v] Recordatorio de pago       │
│ [Ver/Editar template]                    │
│                                          │
│ ┌────────────────────────────────────┐   │
│ │ PREVIEW                            │   │
│ │                                    │   │
│ │ Asunto: Recordatorio de pago -     │   │
│ │         Cuotas pendientes          │   │
│ │                                    │   │
│ │ Hola {{nombre}},                   │   │
│ │                                    │   │
│ │ Te recordamos que tenés            │   │
│ │ {{cantidadCuotas}} cuotas          │   │
│ │ pendientes por un total de         │   │
│ │ ${{totalDeuda}}.                   │   │
│ │                                    │   │
│ │ [Ver detalle] [Pagar ahora]        │   │
│ └────────────────────────────────────┘   │
│                                          │
│ 🔔 PUSH NOTIFICATION                     │
│ Título: [Recordatorio de pago_____]      │
│ Mensaje: [Tenés cuotas pendientes__]     │
│                                          │
│      [← Atrás]  [Cancelar]  [Siguiente →]│
└──────────────────────────────────────────┘
```

**PASO 4: Programación y Envío**

```
┌──────────────────────────────────────────┐
│ Nueva Campaña - Paso 4 de 4              │
├──────────────────────────────────────────┤
│ ¿Cuándo enviar?                          │
│                                          │
│ (•) Ahora                                │
│ ( ) Programar                            │
│     Fecha: [20/03/2026]                  │
│     Hora:  [10:00]                       │
│                                          │
│ RESUMEN                                  │
│ ┌────────────────────────────────────┐   │
│ │ Nombre: Recordatorio Cuotas Marzo  │   │
│ │ Tipo: Cobranza                     │   │
│ │ Canales: Email + Push              │   │
│ │ Destinatarios: 85 socios           │   │
│ │ Template: Recordatorio de pago     │   │
│ │ Envío: Inmediato                   │   │
│ └────────────────────────────────────┘   │
│                                          │
│ [ ] Enviar email de prueba antes         │
│                                          │
│      [← Atrás]  [Guardar borrador]       │
│                         [Enviar campaña] │
└──────────────────────────────────────────┘
```

### 🖥️ Tab 2: Templates de Email

```
┌─────────────────────────────────────────────────────┐
│ [+ Nuevo Template]                   🔍 Buscar...   │
├─────────────────────────────────────────────────────┤
│ 📧 Recordatorio de pago                             │
│ Tipo: MOROSIDAD  │  Variables: 8  │  ✅ Activo     │
│ [Editar] [Vista previa] [Desactivar]                │
├─────────────────────────────────────────────────────┤
│ 🎉 Bienvenida nuevo socio                           │
│ Tipo: BIENVENIDA  │  Variables: 5  │  ✅ Activo     │
│ [Editar] [Vista previa] [Desactivar]                │
├─────────────────────────────────────────────────────┤
│ 🏊 Promoción Pileta Verano                          │
│ Tipo: MARKETING  │  Variables: 3  │  ⚠️ Inactivo   │
│ [Editar] [Vista previa] [Activar]                   │
└─────────────────────────────────────────────────────┘
```

**Editor de template:**

```
┌──────────────────────────────────────────┐
│ Editar Template: Recordatorio de pago    │
├──────────────────────────────────────────┤
│ Nombre: [Recordatorio de pago_______]    │
│ Tipo: [v] MOROSIDAD                      │
│                                          │
│ Asunto:                                  │
│ [Recordatorio de pago - {{cantidadCu__]  │
│                                          │
│ Variables disponibles:                   │
│ {{nombre}} {{nroSocio}} {{deuda}}        │
│ {{cantidadCuotas}} {{linkPortal}}        │
│                                          │
│ Cuerpo (HTML):                           │
│ ┌────────────────────────────────────┐   │
│ │ <h1>Hola {{nombre}}</h1>           │   │
│ │                                    │   │
│ │ <p>Te recordamos que tenés         │   │
│ │ <strong>{{cantidadCuotas}}</strong>│   │
│ │ cuotas pendientes...</p>           │   │
│ │                                    │   │
│ │ [Editor visual / Código]           │   │
│ └────────────────────────────────────┘   │
│                                          │
│ [Vista previa]                           │
│                                          │
│ Estado: [✓] Activo                       │
│                                          │
│      [Cancelar]  [Guardar]               │
└──────────────────────────────────────────┘
```

### 🖥️ Tab 3: Historial de Envíos

```
┌─────────────────────────────────────────────────────────┐
│ Filtros: Fecha [Últimos 30 días ▼]  Canal [Todos ▼]   │
├─────────────────────────────────────────────────────────┤
│ Fecha       │ Campaña        │ Canal │ Dest. │ Abiertos │
│ 15/03/2026  │ Recordatorio   │ Email │  85   │  63(74%) │
│ 10/03/2026  │ Promo Pileta   │ Email │ 320   │ 245(76%) │
│ 05/03/2026  │ Cuotas Febrero │ Push  │ 250   │  n/a     │
└─────────────────────────────────────────────────────────┘
```

### 🖥️ Tab 5: Estadísticas

```
┌─────────────────────────────────────────┐
│ MÉTRICAS ÚLTIMOS 30 DÍAS                │
├─────────────────────────────────────────┤
│ Total enviados: 1.250                   │
│ Tasa de apertura: 73.2%                 │
│ Tasa de clicks: 18.5%                   │
│ Rebotes: 2.1%                           │
└─────────────────────────────────────────┘

[Gráfico de líneas: Envíos por día]
[Gráfico de barras: Apertura por tipo de campaña]
[Tabla: Top 5 campañas más efectivas]
```

## 3. INTEGRACIONES DE CANALES

### A. Email ✅ Ya implementado

- SMTP con nodemailer
- Templates con Handlebars
- Tracking con messageId

### B. WhatsApp (integración futura)

```javascript
// API oficial de WhatsApp Business
import { WhatsAppAPI } from 'whatsapp-business-sdk'

async function enviarWhatsApp(telefono, mensaje) {
  const client = new WhatsAppAPI({
    phoneNumberId: process.env.WHATSAPP_PHONE_ID,
    accessToken: process.env.WHATSAPP_TOKEN
  })

  await client.sendMessage({
    to: telefono,
    type: 'text',
    text: { body: mensaje }
  })
}
```

### C. SMS (integración futura)

```javascript
// Twilio u otro proveedor
import twilio from 'twilio'

const client = twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_TOKEN
)

async function enviarSMS(telefono, mensaje) {
  await client.messages.create({
    body: mensaje,
    from: process.env.TWILIO_PHONE,
    to: telefono
  })
}
```

### D. Push Notifications ✅ Ya implementado

- Web Push con service workers
- Ya funciona en portal socio

## 4. AUTOMATIZACIONES

### Job de procesamiento de campañas programadas

```javascript
// Ejecutar cada 15 minutos
async function procesarCampanasProgramadas() {
  const ahora = new Date()

  const campanas = await prisma.campanaComunicacion.findMany({
    where: {
      estado: 'PROGRAMADA',
      fechaProgramada: { lte: ahora }
    }
  })

  for (const campana of campanas) {
    await ejecutarCampana(campana.id)
  }
}

async function ejecutarCampana(campanaId) {
  const campana = await prisma.campanaComunicacion.findUnique({
    where: { id: campanaId },
    include: { emailTemplate: true }
  })

  // Cambiar estado a EN_CURSO
  await prisma.campanaComunicacion.update({
    where: { id: campanaId },
    data: { estado: 'EN_CURSO' }
  })

  // Obtener destinatarios según segmentación
  const destinatarios = await obtenerDestinatarios(campana.segmentacion)

  // Crear envíos individuales
  for (const dest of destinatarios) {
    await prisma.envioCampana.create({
      data: {
        campanaId,
        socioId: dest.id,
        canal: 'EMAIL',
        destinatario: dest.email,
        estado: 'PENDIENTE'
      }
    })
  }

  // Procesar envíos en background
  await procesarEnviosCampana(campanaId)
}
```

---

# ROADMAP DE IMPLEMENTACIÓN

## MÓDULO 1: COBRANZAS (5-6 días)

### Fase 1: Modelos BD + API básica (1-2 días)
- ✅ Crear modelos Prisma
- ✅ Migraciones de BD
- ✅ Endpoints CRUD básicos
- ✅ Job de clasificación automática

### Fase 2: Panel y gestión individual (2 días)
- ✅ Panel principal de cobranzas
- ✅ Vista de detalle de gestión
- ✅ Modal de registro de acciones
- ✅ Timeline de gestiones

### Fase 3: Planes de pago (1 día)
- ✅ Crear plan de pago
- ✅ Seguimiento de cuotas
- ✅ Control de cumplimiento
- ✅ Notificaciones de vencimiento

### Fase 4: Automatizaciones (1 día)
- ✅ Recordatorios automáticos
- ✅ Asignación de responsables
- ✅ Alertas de acciones pendientes

### Fase 5: Reportes (1 día)
- ✅ Dashboard de cobranzas
- ✅ Métricas de efectividad
- ✅ Exportaciones

## MÓDULO 2: RECUPERO (5-6 días)

### Fase 6: Base de Recupero (2 días)
- ✅ Modelos de BD (AccionRecupero, EncuestaBaja)
- ✅ Ampliar modelo Socio con campos de recupero
- ✅ API endpoints básicos
- ✅ Panel principal de recupero

### Fase 7: Encuesta de Baja (1 día)
- ✅ Modal de encuesta al dar de baja
- ✅ Versión web pública para portal socio
- ✅ Registro de respuestas en BD

### Fase 8: Gestión de Recupero (2 días)
- ✅ Detalle de socio dado de baja
- ✅ Timeline de acciones
- ✅ Registrar contactos
- ✅ Seguimiento

### Fase 9: Campañas de Recupero (2 días)
- ✅ Crear campañas con segmentación
- ✅ Templates de comunicación
- ✅ Métricas y resultados
- ✅ Ofertas especiales

### Fase 10: Automatizaciones de Recupero (1-2 días)
- ✅ Job de clasificación por tiempo de baja
- ✅ Emails automáticos (encuesta, ofertas)
- ✅ Recordatorios programados
- ✅ Alertas de seguimiento

### Fase 11: Reportes y Analytics (1 día)
- ✅ Dashboard de churn y recupero
- ✅ Análisis de motivos de baja
- ✅ Efectividad de campañas
- ✅ ROI de acciones

## MÓDULO 3: COMUNICACIONES (4-5 días)

### Fase 12: Modelos BD de campañas (1 día)
- ✅ CampanaComunicacion
- ✅ EnvioCampana
- ✅ ListaDistribucion (opcional)

### Fase 13: UI de gestión de templates (1 día)
- ✅ Lista de templates
- ✅ Editor de templates
- ✅ Preview de templates

### Fase 14: Wizard de creación de campañas (1 día)
- ✅ Paso 1: Tipo y canal
- ✅ Paso 2: Destinatarios
- ✅ Paso 3: Contenido
- ✅ Paso 4: Programación

### Fase 15: Segmentación y destinatarios (1 día)
- ✅ Filtros avanzados
- ✅ Preview de destinatarios
- ✅ Listas de distribución

### Fase 16: Procesamiento y tracking (1 día)
- ✅ Job de envío de campañas
- ✅ Tracking de apertura/clicks
- ✅ Manejo de errores y reintentos

### Fase 17: Estadísticas y reportes (1 día)
- ✅ Dashboard de métricas
- ✅ Reportes de efectividad
- ✅ Exportaciones

## INTEGRACIONES OPCIONALES (+2-3 días c/u)

- WhatsApp Business API
- SMS (Twilio/similar)
- Listas de distribución avanzadas

---

# 📊 RESUMEN EJECUTIVO

## Este sistema integral te da:

### GESTIÓN DE COBRANZAS

✅ Seguimiento sistemático de morosidad
✅ Registro de todas las gestiones
✅ Planes de pago y acuerdos
✅ Métricas de efectividad

### RECUPERO DE SOCIOS

✅ Entender motivos de baja
✅ Campañas segmentadas de reactivación
✅ Ofertas personalizadas
✅ Tracking de conversión

### COMUNICACIONES

✅ Campañas masivas multicanal
✅ Templates profesionales
✅ Segmentación avanzada
✅ Estadísticas de apertura/clicks
✅ Automatización total

## BENEFICIOS

- 📈 **Reducir morosidad en 20-30%**
- 🔄 **Recuperar 10-15% de bajas**
- 💰 **Mejorar flujo de caja**
- 📧 **Comunicación profesional y efectiva**
- 📊 **Tomar decisiones basadas en datos**
- ⏰ **Automatizar tareas repetitivas**

## TIEMPO TOTAL DE IMPLEMENTACIÓN

**15-18 días de desarrollo** (modular, se puede implementar por fases)

## PRÓXIMOS PASOS

1. ✅ Revisar y aprobar la propuesta
2. ✅ Decidir por qué módulo empezar (recomendado: Cobranzas → Recupero → Comunicaciones)
3. ✅ Definir prioridades específicas dentro de cada módulo
4. ✅ Comenzar implementación fase por fase

---

**Versión:** 1.0
**Fecha:** Marzo 2026
**Proyecto:** RojoPlus - Club Sportivo Pilar
