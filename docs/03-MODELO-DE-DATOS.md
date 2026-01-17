# RojoPlus - Modelo de Datos

---

## 1. Diagrama Entidad-Relacion

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     SOCIOS      │       │     VENTAS      │       │   COMERCIOS     │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │◀──────│ socio_id (FK)   │       │ id (PK)         │
│ nro_socio       │       │ comercio_id (FK)│──────▶│ nombre          │
│ documento       │       │ fecha           │       │ token           │
│ apellido_nombre │       │ importe_original│       │ estado          │
│ estado          │       │ importe_final   │       │ rubro_id (FK)   │──┐
│ email           │       │ descuento_pct   │       │ descuento_pct   │  │
│ ...             │       │ descuento_acum  │       │ acum_activo     │  │
└─────────────────┘       └─────────────────┘       └─────────────────┘  │
                                                                         │
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐  │
│     ADMINS      │       │    CONFIGURACION│       │     RUBROS      │◀─┘
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ clave           │       │ id (PK)         │
│ email           │       │ valor           │       │ nombre          │
│ password_hash   │       │                 │       │ activo          │
│ nombre          │       │                 │       │                 │
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

---

## 2. Tablas del Sistema

### 2.1 Tabla: `socios`

Almacena los datos de socios importados desde Excel.

| Campo | Tipo | Nullable | Descripcion |
|-------|------|----------|-------------|
| id | SERIAL | NO | Primary key |
| nro_socio | VARCHAR(20) | NO | Numero de socio/carnet (UNIQUE) |
| documento | VARCHAR(20) | SI | DNI/Documento (INDEX) |
| apellido_nombre | VARCHAR(200) | NO | Nombre completo |
| estado | VARCHAR(50) | NO | Estado del socio (ACTIVO, etc) |
| email | VARCHAR(200) | SI | Email del socio |
| celular | VARCHAR(50) | SI | Telefono celular |
| fecha_nacimiento | DATE | SI | Fecha de nacimiento |
| categoria | VARCHAR(100) | SI | Categoria de socio |
| tipo_socio | VARCHAR(50) | SI | Tipo de socio |
| domicilio | VARCHAR(300) | SI | Direccion |
| ciudad | VARCHAR(100) | SI | Ciudad |
| created_at | TIMESTAMP | NO | Fecha de creacion |
| updated_at | TIMESTAMP | NO | Ultima actualizacion |

**Indices:**
- `idx_socios_nro_socio` en `nro_socio` (UNIQUE)
- `idx_socios_documento` en `documento`
- `idx_socios_estado` en `estado`

---

### 2.2 Tabla: `comercios`

Almacena los comercios adheridos al programa.

| Campo | Tipo | Nullable | Descripcion |
|-------|------|----------|-------------|
| id | SERIAL | NO | Primary key |
| nombre | VARCHAR(200) | NO | Nombre del comercio |
| direccion | VARCHAR(300) | NO | Direccion fisica |
| rubro_id | INTEGER | NO | FK a rubros |
| telefono | VARCHAR(50) | NO | Telefono de contacto |
| email | VARCHAR(200) | NO | Email (UNIQUE) |
| cuit | VARCHAR(20) | NO | CUIT del comercio |
| responsable | VARCHAR(200) | NO | Nombre del responsable |
| token | UUID | SI | Token de acceso (UNIQUE) |
| estado | VARCHAR(20) | NO | PENDIENTE/ACTIVO/RECHAZADO/INACTIVO |
| descuento_pct | DECIMAL(5,2) | NO | Porcentaje de descuento |
| acumulacion_activa | BOOLEAN | NO | Si usa descuento por acumulacion |
| acum_compras_req | INTEGER | SI | Compras requeridas para acumulacion |
| acum_periodo_dias | INTEGER | SI | Periodo en dias para acumulacion |
| acum_descuento_extra | DECIMAL(5,2) | SI | % descuento extra por acumulacion |
| motivo_rechazo | TEXT | SI | Motivo si fue rechazado |
| created_at | TIMESTAMP | NO | Fecha de solicitud |
| approved_at | TIMESTAMP | SI | Fecha de aprobacion |
| updated_at | TIMESTAMP | NO | Ultima actualizacion |

**Indices:**
- `idx_comercios_token` en `token` (UNIQUE)
- `idx_comercios_email` en `email` (UNIQUE)
- `idx_comercios_estado` en `estado`

---

### 2.3 Tabla: `ventas`

Registro de todas las transacciones.

| Campo | Tipo | Nullable | Descripcion |
|-------|------|----------|-------------|
| id | SERIAL | NO | Primary key |
| comercio_id | INTEGER | NO | FK a comercios |
| socio_id | INTEGER | NO | FK a socios |
| fecha | TIMESTAMP | NO | Fecha y hora de la venta |
| importe_original | DECIMAL(12,2) | NO | Importe sin descuento |
| importe_final | DECIMAL(12,2) | NO | Importe con descuento |
| descuento_pct | DECIMAL(5,2) | NO | % descuento aplicado |
| descuento_monto | DECIMAL(12,2) | NO | Monto descontado |
| aplico_acumulacion | BOOLEAN | NO | Si se aplico descuento por acumulacion |
| descuento_acum_pct | DECIMAL(5,2) | SI | % extra por acumulacion |
| created_at | TIMESTAMP | NO | Fecha de registro |

**Indices:**
- `idx_ventas_comercio` en `comercio_id`
- `idx_ventas_socio` en `socio_id`
- `idx_ventas_fecha` en `fecha`
- `idx_ventas_comercio_socio_fecha` en `(comercio_id, socio_id, fecha)` para consultas de acumulacion

---

### 2.4 Tabla: `rubros`

Catalogo de rubros comerciales.

| Campo | Tipo | Nullable | Descripcion |
|-------|------|----------|-------------|
| id | SERIAL | NO | Primary key |
| nombre | VARCHAR(100) | NO | Nombre del rubro |
| activo | BOOLEAN | NO | Si esta disponible |
| orden | INTEGER | NO | Orden de visualizacion |

---

### 2.5 Tabla: `admins`

Usuarios administradores del club.

| Campo | Tipo | Nullable | Descripcion |
|-------|------|----------|-------------|
| id | SERIAL | NO | Primary key |
| email | VARCHAR(200) | NO | Email (UNIQUE) |
| password_hash | VARCHAR(200) | NO | Password hasheado con bcrypt |
| nombre | VARCHAR(200) | NO | Nombre del admin |
| activo | BOOLEAN | NO | Si puede acceder |
| created_at | TIMESTAMP | NO | Fecha de creacion |
| last_login | TIMESTAMP | SI | Ultimo acceso |

---

### 2.6 Tabla: `configuracion`

Parametros globales del sistema.

| Campo | Tipo | Nullable | Descripcion |
|-------|------|----------|-------------|
| clave | VARCHAR(50) | NO | Clave del parametro (PK) |
| valor | TEXT | NO | Valor del parametro |
| descripcion | VARCHAR(200) | SI | Descripcion del parametro |
| updated_at | TIMESTAMP | NO | Ultima modificacion |

**Configuraciones iniciales:**
| Clave | Valor | Descripcion |
|-------|-------|-------------|
| descuento_default | 10 | % descuento sugerido para nuevos comercios |
| email_admin | admin@club.com | Email para notificaciones |
| nombre_club | Club Sportivo Pilar | Nombre del club |

---

## 3. Mapeo Excel -> Base de Datos

El archivo Excel de socios tiene las siguientes columnas. Solo importamos las relevantes:

| Columna Excel | Campo BD | Importar |
|---------------|----------|----------|
| Nro.Socio | nro_socio | SI |
| ApellidoNombre | apellido_nombre | SI |
| Fecha Nac. | fecha_nacimiento | SI |
| Edad | - | NO (calculable) |
| Estado | estado | SI |
| Sexo | - | NO |
| Categoria | categoria | SI |
| TipoSocio | tipo_socio | SI |
| Tipo Doc. | - | NO |
| Documento | documento | SI |
| Domicilio | domicilio | SI |
| Telefono | - | NO (usamos celular) |
| Celular | celular | SI |
| Email | email | SI |
| Ciudad | ciudad | SI |
| CP | - | NO |
| Provincia | - | NO |
| Pais | - | NO |
| (resto) | - | NO |

---

## 4. Schema Prisma

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Socio {
  id              Int       @id @default(autoincrement())
  nroSocio        String    @unique @map("nro_socio")
  documento       String?
  apellidoNombre  String    @map("apellido_nombre")
  estado          String
  email           String?
  celular         String?
  fechaNacimiento DateTime? @map("fecha_nacimiento")
  categoria       String?
  tipoSocio       String?   @map("tipo_socio")
  domicilio       String?
  ciudad          String?
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  ventas Venta[]

  @@index([documento])
  @@index([estado])
  @@map("socios")
}

model Comercio {
  id                 Int       @id @default(autoincrement())
  nombre             String
  direccion          String
  rubroId            Int       @map("rubro_id")
  telefono           String
  email              String    @unique
  cuit               String
  responsable        String
  token              String?   @unique @default(uuid())
  estado             String    @default("PENDIENTE")
  descuentoPct       Decimal   @default(10) @map("descuento_pct") @db.Decimal(5, 2)
  acumulacionActiva  Boolean   @default(false) @map("acumulacion_activa")
  acumComprasReq     Int?      @map("acum_compras_req")
  acumPeriodoDias    Int?      @map("acum_periodo_dias")
  acumDescuentoExtra Decimal?  @map("acum_descuento_extra") @db.Decimal(5, 2)
  motivoRechazo      String?   @map("motivo_rechazo")
  createdAt          DateTime  @default(now()) @map("created_at")
  approvedAt         DateTime? @map("approved_at")
  updatedAt          DateTime  @updatedAt @map("updated_at")

  rubro  Rubro   @relation(fields: [rubroId], references: [id])
  ventas Venta[]

  @@index([estado])
  @@map("comercios")
}

model Venta {
  id                Int      @id @default(autoincrement())
  comercioId        Int      @map("comercio_id")
  socioId           Int      @map("socio_id")
  fecha             DateTime @default(now())
  importeOriginal   Decimal  @map("importe_original") @db.Decimal(12, 2)
  importeFinal      Decimal  @map("importe_final") @db.Decimal(12, 2)
  descuentoPct      Decimal  @map("descuento_pct") @db.Decimal(5, 2)
  descuentoMonto    Decimal  @map("descuento_monto") @db.Decimal(12, 2)
  aplicoAcumulacion Boolean  @default(false) @map("aplico_acumulacion")
  descuentoAcumPct  Decimal? @map("descuento_acum_pct") @db.Decimal(5, 2)
  createdAt         DateTime @default(now()) @map("created_at")

  comercio Comercio @relation(fields: [comercioId], references: [id])
  socio    Socio    @relation(fields: [socioId], references: [id])

  @@index([comercioId])
  @@index([socioId])
  @@index([fecha])
  @@index([comercioId, socioId, fecha])
  @@map("ventas")
}

model Rubro {
  id     Int     @id @default(autoincrement())
  nombre String
  activo Boolean @default(true)
  orden  Int     @default(0)

  comercios Comercio[]

  @@map("rubros")
}

model Admin {
  id           Int       @id @default(autoincrement())
  email        String    @unique
  passwordHash String    @map("password_hash")
  nombre       String
  activo       Boolean   @default(true)
  createdAt    DateTime  @default(now()) @map("created_at")
  lastLogin    DateTime? @map("last_login")

  @@map("admins")
}

model Configuracion {
  clave       String   @id
  valor       String
  descripcion String?
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("configuracion")
}
```

---

## 5. Datos Iniciales (Seed)

```javascript
// prisma/seed.js

const rubros = [
  { nombre: 'Gastronomia', orden: 1 },
  { nombre: 'Indumentaria', orden: 2 },
  { nombre: 'Farmacia', orden: 3 },
  { nombre: 'Libreria', orden: 4 },
  { nombre: 'Supermercado/Almacen', orden: 5 },
  { nombre: 'Ferreteria', orden: 6 },
  { nombre: 'Electronica', orden: 7 },
  { nombre: 'Servicios Profesionales', orden: 8 },
  { nombre: 'Belleza y Estetica', orden: 9 },
  { nombre: 'Deportes', orden: 10 },
  { nombre: 'Automotor', orden: 11 },
  { nombre: 'Hogar y Decoracion', orden: 12 },
  { nombre: 'Otros', orden: 99 },
];

const configuracion = [
  { clave: 'descuento_default', valor: '10', descripcion: 'Porcentaje de descuento sugerido' },
  { clave: 'nombre_club', valor: 'Club Sportivo Pilar', descripcion: 'Nombre del club' },
  { clave: 'email_notificaciones', valor: 'admin@clubsportivopilar.com', descripcion: 'Email para notificaciones' },
];
```

---

*Documento creado: Enero 2026*
*Version: 1.0*
