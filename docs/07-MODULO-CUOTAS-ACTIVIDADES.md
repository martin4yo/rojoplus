# Modulo de Cuotas y Actividades - Analisis

## Resumen Ejecutivo

Expansion del sistema RojoPlus para gestionar:
- Cuotas sociales y deportivas
- Actividades deportivas por categoria
- Grupos familiares
- Cuenta corriente de socios
- Recargos por mora
- Caja e ingresos/egresos

---

## 1. Entidades Principales

### 1.1 Grupos Familiares
```
GrupoFamiliar
├── id
├── nombre (ej: "Familia Rodriguez")
├── titularId (socio responsable de pago)
├── activo
├── createdAt
└── miembros[] → Socio
```

**Reglas:**
- Un grupo familiar paga UNA sola cuota social
- Cada miembro paga su propia cuota deportiva
- La cobranza es por grupo (un solo comprobante)
- El titular es responsable del pago

### 1.2 Deportes y Categorias
```
Deporte
├── id
├── nombre (Futbol, Basketball, Voley, etc.)
├── activo
└── categorias[] → Categoria

Categoria
├── id
├── deporteId
├── nombre (Sub-12, Sub-14, Primera, Veteranos)
├── edadMinima (opcional)
├── edadMaxima (opcional)
├── cuotaMensual (monto de la cuota deportiva)
├── activo
└── inscripciones[] → Inscripcion
```

### 1.3 Inscripciones a Actividades
```
Inscripcion
├── id
├── socioId
├── categoriaId
├── rol (DEPORTISTA | ENTRENADOR | DELEGADO)
├── fechaInicio
├── fechaFin (null = vigente)
├── activo
└── exentoCuota (para entrenadores que no pagan)
```

**Reglas:**
- Un socio puede estar en multiples categorias
- Entrenadores pueden estar exentos de cuota deportiva
- Se registra historico (fechaFin cuando deja la actividad)

### 1.4 Configuracion de Cuotas
```
TipoCuota
├── id
├── codigo (SOCIAL, DEPORTIVA)
├── nombre
├── descripcion
└── activo

ConfiguracionCuota
├── id
├── tipoCuotaId
├── categoriaId (null para cuota social)
├── monto
├── vigenciaDesde
├── vigenciaHasta (null = vigente)
└── activo
```

### 1.5 Generacion de Cuotas (Cuenta Corriente)
```
PeriodoCuota
├── id
├── anio
├── mes
├── fechaGeneracion
├── fechaVencimiento
├── estado (GENERADO | CERRADO)
└── cuotas[] → Cuota

Cuota
├── id
├── periodoId
├── socioId (null si es grupo familiar)
├── grupoFamiliarId (null si es socio individual)
├── tipoCuotaId
├── categoriaId (null para cuota social)
├── montoOriginal
├── montoRecargo
├── montoTotal (original + recargo)
├── estado (PENDIENTE | PAGADA | ANULADA)
├── fechaVencimiento
├── fechaPago
├── pagoId
└── observaciones
```

**Reglas:**
- Se genera una cuota SOCIAL por socio individual O por grupo familiar
- Se genera una cuota DEPORTIVA por cada inscripcion activa
- El recargo se calcula al momento del pago segun configuracion

### 1.6 Recargos por Mora
```
ConfiguracionRecargo
├── id
├── nombre (ej: "Recargo 10% despues de vencimiento")
├── diasDespuesVencimiento (0 = desde vencimiento)
├── porcentaje
├── activo
├── vigenciaDesde
└── vigenciaHasta
```

**Ejemplo:**
- Vencimiento: dia 10 del mes
- Recargo 10% desde dia 11
- Recargo 20% desde dia 21 (acumulativo o no?)

### 1.7 Pagos
```
Pago
├── id
├── fecha
├── socioId (quien paga, puede ser titular de grupo)
├── grupoFamiliarId (opcional)
├── montoTotal
├── medioPagoId
├── cajaId
├── comprobanteNro
├── observaciones
├── anulado
├── fechaAnulacion
└── cuotas[] → Cuota (las cuotas que cubre este pago)
```

**Reglas:**
- Un pago puede cubrir multiples cuotas
- No hay pagos parciales de una cuota
- Se registra medio de pago y caja

### 1.8 Medios de Pago
```
MedioPago
├── id
├── codigo (EFECTIVO, TRANSFERENCIA, DEBITO, CREDITO, MERCADOPAGO)
├── nombre
├── requiereCuenta (true para transferencia)
├── comision (% para tarjetas)
└── activo
```

### 1.9 Caja y Movimientos
```
Caja
├── id
├── nombre (Caja Principal, Caja Cantina, etc.)
├── tipo (EFECTIVO | CUENTA_BANCARIA | BILLETERA_VIRTUAL)
├── saldoActual
├── activo
└── movimientos[] → MovimientoCaja

CuentaBancaria
├── id
├── banco
├── tipoCuenta (CA | CC)
├── numero
├── cbu
├── alias
├── titular
├── activo
└── cajaId (relacionada a una caja)

MovimientoCaja
├── id
├── cajaId
├── fecha
├── tipo (INGRESO | EGRESO | TRANSFERENCIA)
├── concepto
├── categoriaId → CategoriaMovimiento
├── monto
├── pagoId (si es cobro de cuota)
├── comprobanteNro
├── observaciones
├── anulado
└── usuarioId (quien registro)

CategoriaMovimiento
├── id
├── tipo (INGRESO | EGRESO)
├── nombre (Cuotas, Venta Cantina, Sueldos, Servicios, etc.)
├── codigo
└── activo
```

---

## 2. Flujos de Proceso

### 2.1 Generacion Mensual de Cuotas
```
1. Admin selecciona periodo (mes/año)
2. Sistema identifica:
   - Socios activos individuales → genera cuota SOCIAL
   - Grupos familiares activos → genera cuota SOCIAL por grupo
   - Inscripciones activas → genera cuota DEPORTIVA por cada una
3. Aplica montos segun configuracion vigente
4. Establece fecha de vencimiento
5. Genera comprobantes de deuda
```

### 2.2 Cobro de Cuotas
```
1. Buscar socio o grupo familiar
2. Ver cuotas pendientes con recargos calculados
3. Seleccionar cuotas a pagar (completas, no parciales)
4. Seleccionar medio de pago y caja
5. Registrar pago
6. Generar recibo
7. Actualizar estado de cuotas a PAGADA
8. Registrar movimiento de caja
```

### 2.3 Calculo de Recargos
```
Al mostrar/pagar una cuota:
1. Si cuota.estado = PENDIENTE
2. Calcular dias desde vencimiento
3. Buscar configuracion de recargo aplicable
4. Aplicar % de recargo sobre monto original
5. montoTotal = montoOriginal + montoRecargo
```

---

## 3. Modelo de Datos (Prisma)

```prisma
// ==================== GRUPOS FAMILIARES ====================
model GrupoFamiliar {
  id         Int      @id @default(autoincrement())
  nombre     String
  titularId  Int      @map("titular_id")
  activo     Boolean  @default(true)
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  titular   Socio   @relation("TitularGrupo", fields: [titularId], references: [id])
  miembros  Socio[] @relation("MiembroGrupo")
  cuotas    Cuota[]
  pagos     Pago[]

  @@map("grupos_familiares")
}

// ==================== DEPORTES Y CATEGORIAS ====================
model Deporte {
  id         Int         @id @default(autoincrement())
  nombre     String
  activo     Boolean     @default(true)
  orden      Int         @default(0)
  categorias Categoria[]

  @@map("deportes")
}

model Categoria {
  id           Int      @id @default(autoincrement())
  deporteId    Int      @map("deporte_id")
  nombre       String
  edadMinima   Int?     @map("edad_minima")
  edadMaxima   Int?     @map("edad_maxima")
  cuotaMensual Decimal  @map("cuota_mensual") @db.Decimal(12, 2)
  activo       Boolean  @default(true)
  orden        Int      @default(0)

  deporte       Deporte       @relation(fields: [deporteId], references: [id])
  inscripciones Inscripcion[]
  cuotas        Cuota[]

  @@map("categorias")
}

model Inscripcion {
  id          Int       @id @default(autoincrement())
  socioId     Int       @map("socio_id")
  categoriaId Int       @map("categoria_id")
  rol         String    // DEPORTISTA, ENTRENADOR, DELEGADO
  fechaInicio DateTime  @map("fecha_inicio")
  fechaFin    DateTime? @map("fecha_fin")
  exentoCuota Boolean   @default(false) @map("exento_cuota")
  activo      Boolean   @default(true)
  createdAt   DateTime  @default(now()) @map("created_at")

  socio     Socio     @relation(fields: [socioId], references: [id])
  categoria Categoria @relation(fields: [categoriaId], references: [id])

  @@map("inscripciones")
}

// ==================== CUOTAS ====================
model TipoCuota {
  id          Int     @id @default(autoincrement())
  codigo      String  @unique // SOCIAL, DEPORTIVA
  nombre      String
  descripcion String?
  activo      Boolean @default(true)

  configuraciones ConfiguracionCuota[]
  cuotas          Cuota[]

  @@map("tipos_cuota")
}

model ConfiguracionCuota {
  id             Int       @id @default(autoincrement())
  tipoCuotaId    Int       @map("tipo_cuota_id")
  monto          Decimal   @db.Decimal(12, 2)
  vigenciaDesde  DateTime  @map("vigencia_desde")
  vigenciaHasta  DateTime? @map("vigencia_hasta")
  activo         Boolean   @default(true)

  tipoCuota TipoCuota @relation(fields: [tipoCuotaId], references: [id])

  @@map("configuracion_cuotas")
}

model PeriodoCuota {
  id               Int      @id @default(autoincrement())
  anio             Int
  mes              Int
  fechaGeneracion  DateTime @map("fecha_generacion")
  fechaVencimiento DateTime @map("fecha_vencimiento")
  estado           String   @default("GENERADO") // GENERADO, CERRADO

  cuotas Cuota[]

  @@unique([anio, mes])
  @@map("periodos_cuota")
}

model Cuota {
  id               Int       @id @default(autoincrement())
  periodoId        Int       @map("periodo_id")
  socioId          Int?      @map("socio_id")
  grupoFamiliarId  Int?      @map("grupo_familiar_id")
  tipoCuotaId      Int       @map("tipo_cuota_id")
  categoriaId      Int?      @map("categoria_id")
  montoOriginal    Decimal   @map("monto_original") @db.Decimal(12, 2)
  montoRecargo     Decimal   @default(0) @map("monto_recargo") @db.Decimal(12, 2)
  montoTotal       Decimal   @map("monto_total") @db.Decimal(12, 2)
  estado           String    @default("PENDIENTE") // PENDIENTE, PAGADA, ANULADA
  fechaVencimiento DateTime  @map("fecha_vencimiento")
  fechaPago        DateTime? @map("fecha_pago")
  pagoId           Int?      @map("pago_id")
  observaciones    String?
  createdAt        DateTime  @default(now()) @map("created_at")

  periodo        PeriodoCuota   @relation(fields: [periodoId], references: [id])
  socio          Socio?         @relation(fields: [socioId], references: [id])
  grupoFamiliar  GrupoFamiliar? @relation(fields: [grupoFamiliarId], references: [id])
  tipoCuota      TipoCuota      @relation(fields: [tipoCuotaId], references: [id])
  categoria      Categoria?     @relation(fields: [categoriaId], references: [id])
  pago           Pago?          @relation(fields: [pagoId], references: [id])

  @@index([periodoId])
  @@index([socioId])
  @@index([grupoFamiliarId])
  @@index([estado])
  @@map("cuotas")
}

// ==================== RECARGOS ====================
model ConfiguracionRecargo {
  id                     Int       @id @default(autoincrement())
  nombre                 String
  diasDespuesVencimiento Int       @map("dias_despues_vencimiento")
  porcentaje             Decimal   @db.Decimal(5, 2)
  acumulativo            Boolean   @default(false)
  activo                 Boolean   @default(true)
  vigenciaDesde          DateTime  @map("vigencia_desde")
  vigenciaHasta          DateTime? @map("vigencia_hasta")

  @@map("configuracion_recargos")
}

// ==================== PAGOS ====================
model MedioPago {
  id             Int     @id @default(autoincrement())
  codigo         String  @unique
  nombre         String
  requiereCuenta Boolean @default(false) @map("requiere_cuenta")
  comision       Decimal @default(0) @db.Decimal(5, 2)
  activo         Boolean @default(true)

  pagos Pago[]

  @@map("medios_pago")
}

model Pago {
  id              Int       @id @default(autoincrement())
  fecha           DateTime  @default(now())
  socioId         Int       @map("socio_id")
  grupoFamiliarId Int?      @map("grupo_familiar_id")
  montoTotal      Decimal   @map("monto_total") @db.Decimal(12, 2)
  medioPagoId     Int       @map("medio_pago_id")
  cajaId          Int       @map("caja_id")
  comprobanteNro  String?   @map("comprobante_nro")
  observaciones   String?
  anulado         Boolean   @default(false)
  fechaAnulacion  DateTime? @map("fecha_anulacion")
  createdAt       DateTime  @default(now()) @map("created_at")

  socio          Socio          @relation(fields: [socioId], references: [id])
  grupoFamiliar  GrupoFamiliar? @relation(fields: [grupoFamiliarId], references: [id])
  medioPago      MedioPago      @relation(fields: [medioPagoId], references: [id])
  caja           Caja           @relation(fields: [cajaId], references: [id])
  cuotas         Cuota[]
  movimientos    MovimientoCaja[]

  @@map("pagos")
}

// ==================== CAJA ====================
model Caja {
  id          Int     @id @default(autoincrement())
  nombre      String
  tipo        String  // EFECTIVO, CUENTA_BANCARIA, BILLETERA_VIRTUAL
  saldoActual Decimal @default(0) @map("saldo_actual") @db.Decimal(12, 2)
  activo      Boolean @default(true)

  cuentaBancaria CuentaBancaria?
  movimientos    MovimientoCaja[]
  pagos          Pago[]

  @@map("cajas")
}

model CuentaBancaria {
  id         Int     @id @default(autoincrement())
  cajaId     Int     @unique @map("caja_id")
  banco      String
  tipoCuenta String  @map("tipo_cuenta") // CA, CC
  numero     String
  cbu        String?
  alias      String?
  titular    String

  caja Caja @relation(fields: [cajaId], references: [id])

  @@map("cuentas_bancarias")
}

model CategoriaMovimiento {
  id     Int     @id @default(autoincrement())
  tipo   String  // INGRESO, EGRESO
  nombre String
  codigo String  @unique
  activo Boolean @default(true)

  movimientos MovimientoCaja[]

  @@map("categorias_movimiento")
}

model MovimientoCaja {
  id             Int       @id @default(autoincrement())
  cajaId         Int       @map("caja_id")
  fecha          DateTime  @default(now())
  tipo           String    // INGRESO, EGRESO, TRANSFERENCIA
  concepto       String
  categoriaId    Int       @map("categoria_id")
  monto          Decimal   @db.Decimal(12, 2)
  pagoId         Int?      @map("pago_id")
  comprobanteNro String?   @map("comprobante_nro")
  observaciones  String?
  anulado        Boolean   @default(false)
  usuarioId      Int       @map("usuario_id")
  createdAt      DateTime  @default(now()) @map("created_at")

  caja      Caja                @relation(fields: [cajaId], references: [id])
  categoria CategoriaMovimiento @relation(fields: [categoriaId], references: [id])
  pago      Pago?               @relation(fields: [pagoId], references: [id])
  usuario   Admin               @relation(fields: [usuarioId], references: [id])

  @@index([cajaId])
  @@index([fecha])
  @@map("movimientos_caja")
}
```

---

## 4. Modificaciones al Modelo Socio

```prisma
model Socio {
  // ... campos existentes ...

  // Nuevas relaciones
  grupoFamiliarId     Int?            @map("grupo_familiar_id")
  grupoFamiliarTitular GrupoFamiliar? @relation("TitularGrupo")
  grupoFamiliar       GrupoFamiliar?  @relation("MiembroGrupo", fields: [grupoFamiliarId], references: [id])
  inscripciones       Inscripcion[]
  cuotas              Cuota[]
  pagos               Pago[]
}
```

---

## 5. Pantallas Nuevas (Frontend)

### Admin
1. **Deportes y Categorias** - ABM de deportes y sus categorias
2. **Inscripciones** - Inscribir socios a actividades
3. **Grupos Familiares** - Crear y gestionar grupos
4. **Configuracion Cuotas** - Montos de cuota social y deportivas
5. **Configuracion Recargos** - % de recargo por mora
6. **Generacion de Cuotas** - Generar cuotas del periodo
7. **Cobranza** - Buscar socio, ver deuda, cobrar
8. **Cajas** - ABM de cajas y cuentas bancarias
9. **Movimientos de Caja** - Registrar ingresos/egresos
10. **Reportes** - Deuda, recaudacion, morosos, etc.

---

## 6. Complejidad Estimada

| Modulo | Complejidad | Estimacion |
|--------|-------------|------------|
| Grupos Familiares | Media | 2-3 dias |
| Deportes/Categorias | Baja | 1-2 dias |
| Inscripciones | Media | 2-3 dias |
| Configuracion Cuotas | Media | 2-3 dias |
| Generacion de Cuotas | Alta | 3-4 dias |
| Calculo Recargos | Media | 1-2 dias |
| Cobro de Cuotas | Alta | 3-4 dias |
| Saldos a Favor | Media | 2-3 dias |
| Plan de Cuentas | Media | 2-3 dias |
| Caja y Movimientos | Media | 3-4 dias |
| Roles y Permisos | Media | 2-3 dias |
| Comprobantes/Recibos | Media | 2-3 dias |
| Reportes | Media | 2-3 dias |
| **TOTAL** | | **26-38 dias** |

---

## 7. Definiciones del Negocio (Confirmadas)

| Pregunta | Respuesta |
|----------|-----------|
| Recargos acumulativos | **SI** - 10% + 20% = 30% |
| Cuota social familiar | **Precio diferenciado** - Monto especial para grupos |
| Socio con deuda | **Controlado via Excel** - El padron define el estado |
| Transferencias entre cajas | **SI** - Registrar movimientos |
| Anulacion de pagos | **SI** - Genera egreso compensatorio |
| Comprobantes/Recibos | **SI** - Formato de recibo necesario |
| Roles para caja | **SI** - Permisos diferenciados |
| Integracion descuentos | **SI** - Socio INACTIVO o DE BAJA POR MOROSIDAD pierde beneficios QR |

### Requisitos Adicionales

1. **Pagos a cuenta**: Si una transferencia no cubre una cuota completa, queda como saldo a favor del socio
2. **Plan de cuentas jerarquico**: Conceptos de caja en formato arbol editable

---

## 8. Plan de Cuentas (Conceptos de Caja)

Estructura jerarquica para imputar movimientos:

```
CuentaContable
├── id
├── codigo (010, 011, 012...)
├── nombre
├── tipo (INGRESO | EGRESO)
├── nivel (1, 2, 3...)
├── padreId (null para cuentas raiz)
├── esImputable (solo las hojas son imputables)
├── activo
└── orden

Ejemplos:
010 - SUELDOS (nivel 1, no imputable)
  011 - SUELDOS DE ADMINISTRACION (nivel 2, imputable)
  012 - SUELDOS DE BASQUET (nivel 2, imputable)
  013 - SUELDOS DE VOLEY (nivel 2, imputable)
  014 - SUELDOS DE FUTBOL (nivel 2, imputable)

020 - INGRESOS POR CUOTAS (nivel 1, no imputable)
  021 - CUOTAS SOCIALES (nivel 2, imputable)
  022 - CUOTAS DEPORTIVAS (nivel 2, imputable)

030 - OTROS INGRESOS (nivel 1, no imputable)
  031 - ALQUILERES (nivel 2, imputable)
  032 - CANTINA (nivel 2, imputable)
  033 - EVENTOS (nivel 2, imputable)

040 - SERVICIOS (nivel 1, no imputable)
  041 - LUZ (nivel 2, imputable)
  042 - GAS (nivel 2, imputable)
  043 - AGUA (nivel 2, imputable)
  044 - INTERNET (nivel 2, imputable)
```

### Modelo Prisma Actualizado

```prisma
model CuentaContable {
  id          Int      @id @default(autoincrement())
  codigo      String   @unique
  nombre      String
  tipo        String   // INGRESO, EGRESO
  nivel       Int      @default(1)
  padreId     Int?     @map("padre_id")
  esImputable Boolean  @default(true) @map("es_imputable")
  activo      Boolean  @default(true)
  orden       Int      @default(0)

  padre       CuentaContable?  @relation("CuentaHijos", fields: [padreId], references: [id])
  hijos       CuentaContable[] @relation("CuentaHijos")
  movimientos MovimientoCaja[]

  @@map("cuentas_contables")
}
```

---

## 9. Saldo a Favor (Pagos a Cuenta)

Cuando un pago no cubre cuotas completas:

```prisma
model SaldoFavor {
  id              Int       @id @default(autoincrement())
  socioId         Int?      @map("socio_id")
  grupoFamiliarId Int?      @map("grupo_familiar_id")
  monto           Decimal   @db.Decimal(12, 2)
  montoDisponible Decimal   @map("monto_disponible") @db.Decimal(12, 2)
  origen          String    // PAGO_PARCIAL, DEVOLUCION, AJUSTE
  pagoOrigenId    Int?      @map("pago_origen_id")
  fecha           DateTime  @default(now())
  observaciones   String?
  createdAt       DateTime  @default(now()) @map("created_at")

  socio         Socio?         @relation(fields: [socioId], references: [id])
  grupoFamiliar GrupoFamiliar? @relation(fields: [grupoFamiliarId], references: [id])
  pagoOrigen    Pago?          @relation("SaldoOrigen", fields: [pagoOrigenId], references: [id])
  aplicaciones  AplicacionSaldo[]

  @@map("saldos_favor")
}

model AplicacionSaldo {
  id           Int      @id @default(autoincrement())
  saldoFavorId Int      @map("saldo_favor_id")
  pagoId       Int      @map("pago_id")
  monto        Decimal  @db.Decimal(12, 2)
  fecha        DateTime @default(now())

  saldoFavor SaldoFavor @relation(fields: [saldoFavorId], references: [id])
  pago       Pago       @relation("SaldoAplicado", fields: [pagoId], references: [id])

  @@map("aplicaciones_saldo")
}
```

### Flujo de Pago a Cuenta

```
1. Socio transfiere $5000
2. Tiene cuota de $8000 pendiente
3. Sistema registra:
   - Pago de $5000 (no cubre cuota)
   - Saldo a favor de $5000
   - Cuota sigue PENDIENTE
4. Cuando paga los $3000 restantes:
   - Aplica saldo a favor de $5000
   - Aplica pago de $3000
   - Cuota pasa a PAGADA
```

---

## 10. Sistema de Roles y Permisos

```prisma
model Rol {
  id          Int      @id @default(autoincrement())
  codigo      String   @unique
  nombre      String
  descripcion String?
  activo      Boolean  @default(true)

  permisos    PermisoRol[]
  admins      Admin[]

  @@map("roles")
}

model Permiso {
  id      Int    @id @default(autoincrement())
  codigo  String @unique
  nombre  String
  modulo  String // SOCIOS, CUOTAS, CAJA, REPORTES, CONFIG

  roles PermisoRol[]

  @@map("permisos")
}

model PermisoRol {
  rolId     Int
  permisoId Int

  rol     Rol     @relation(fields: [rolId], references: [id])
  permiso Permiso @relation(fields: [permisoId], references: [id])

  @@id([rolId, permisoId])
  @@map("permisos_roles")
}
```

### Permisos Sugeridos

| Codigo | Nombre | Modulo |
|--------|--------|--------|
| SOCIOS_VER | Ver socios | SOCIOS |
| SOCIOS_EDITAR | Editar socios | SOCIOS |
| CUOTAS_GENERAR | Generar cuotas | CUOTAS |
| CUOTAS_COBRAR | Cobrar cuotas | CUOTAS |
| CUOTAS_ANULAR | Anular pagos | CUOTAS |
| CAJA_VER | Ver movimientos | CAJA |
| CAJA_INGRESOS | Registrar ingresos | CAJA |
| CAJA_EGRESOS | Registrar egresos | CAJA |
| CAJA_TRANSFERIR | Transferir entre cajas | CAJA |
| REPORTES_VER | Ver reportes | REPORTES |
| CONFIG_CUOTAS | Configurar cuotas | CONFIG |
| CONFIG_CUENTAS | Configurar plan cuentas | CONFIG |

---

## 11. Proximos Pasos Sugeridos

1. **Definir respuestas** a las preguntas del punto 7
2. **Priorizar modulos** - Cual es mas urgente?
3. **Implementar en fases**:
   - Fase 1: Deportes, Categorias, Inscripciones
   - Fase 2: Grupos Familiares
   - Fase 3: Cuotas y Generacion
   - Fase 4: Cobros y Recargos
   - Fase 5: Caja y Movimientos
   - Fase 6: Reportes

---

*Documento creado: Enero 2026*
