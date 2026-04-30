# Plan de Migración desde Brio → RojoPlus/Clubix

**Carpeta de archivos fuente:** `brio/`
**Scripts:** `server/scripts/`

> Todos los scripts reciben el tenant por parámetro: `--tenant <slug>`.
> Reemplazá `<slug>` en los ejemplos por el tenant donde querés cargar los datos
> (ej. `sportivopilar`, `sportivotest`, etc).

---

## Reglas de negocio para tablas de parámetros

> ⚠️ **Definidas el 2026-04-30** al migrar sportivopilar → sportivotest.

### EstadoSocio
- Se importa **tal cual** del Excel (columna `__EMPTY_10` en el CLI)
- No se normaliza ni renombra
- Si un valor no existe en la tabla se crea automáticamente
- Valores reales del Brio de Sportivo Pilar:
  `VIGENTE`, `BAJA POR MOROSIDAD`, `BAJA POR RENUNCIA`, `BAJA POR FALLECIMIENTO`, `BAJA POR COMISION DIRECTIVA`
- **No usar el seed**: los valores del seed (ACTIVO, SUSPENDIDO, MOROSO, BAJA, INACTIVO) son solo para demo/dev

### CategoriaSocio
- Se importa **tal cual** del Excel (columna `__EMPTY_9` en el CLI)
- No se normaliza
- Si un valor no existe en la tabla se crea automáticamente
- Valores reales del Brio de Sportivo Pilar:
  `ACTIVO`, `INFANTIL`, `CADETE`, `VITALICIO`, `BECADO`, `EXTERNO`, `ACTIVO 2`, `INVITADO`
- **No usar el seed**: los valores del seed (Categoría A, B, C) son solo para demo/dev

### TipoSocio ⚠️ NO viene del Excel
- La columna `__EMPTY_14` del Excel Brio contiene **parentesco familiar** (Hijo/a, Esposo/a, Otro/a), **no es el tipo de socio**.
- TipoSocio tiene exactamente **3 valores fijos del sistema**, siempre los mismos:

| Valor | Descripción |
|-------|-------------|
| `Socio Unico` | Socio sin grupo familiar (default al importar) |
| `Titular Familia` | Cabeza del grupo familiar |
| `Miembro Familia` | Integrante de un grupo familiar |

- Al importar desde el Excel todos los socios ingresan como `Socio Unico`.
- El script `importar-grupos-familiares.js` actualiza a `Titular Familia` / `Miembro Familia`.

### parentescoTitular
- La columna `__EMPTY_14` del Excel (Brio) = parentesco del socio con el titular de su familia
- Va al campo `parentescoTitular` de la tabla `socios`
- Valores conocidos: `Hijo/a`, `Esposo/a`, `Otro/a`, `Padre`, `Hermano/a`, `Conyuge`
- **NO va a TipoSocio**

### Script de sincronización correctiva
Si los parámetros quedaron desincronizados (ej. después de un `clonarTenant` o import manual):

```bash
# Ver qué haría sin escribir
node --env-file=.env scripts/sincronizar-params-socios.js --tenant <slug> --dry-run

# Aplicar
node --env-file=.env scripts/sincronizar-params-socios.js --tenant <slug>
```

El script:
1. Crea en `EstadoSocio`/`CategoriaSocio` los valores que tienen los socios pero no están en la tabla
2. Elimina registros de esas tablas que ningún socio usa
3. Garantiza que `TipoSocio` tenga exactamente los 3 valores del sistema
4. Mueve valores de parentesco que hayan quedado en `tipoSocio` al campo `parentescoTitular`
5. Asigna `Socio Unico` a socios sin tipo válido
6. Actualiza todos los FK (`estadoSocioId`, `categoriaSocioId`, `tipoSocioRelId`)

### Clonar tenant (copiar datos entre ambientes)

```bash
# Ver qué copiará sin escribir
node scripts/clonarTenant.js --from sportivopilar --to sportivotest --dry-run

# Aplicar (borra todos los datos del destino y los reemplaza con los del origen)
node scripts/clonarTenant.js --from sportivopilar --to sportivotest
```

Después del clon, si los socios no se copiaron (tabla con PK compuesta detectada), ejecutar:
```bash
node --env-file=.env scripts/importar-socios.js --tenant sportivotest
node --env-file=.env scripts/importar-grupos-familiares.js --tenant sportivotest
node --env-file=.env scripts/sincronizar-params-socios.js --tenant sportivotest
```

---

## Estado por tenant

### sportivotest — post-migración 2026-04-30

| Tabla | Registros | Valores |
|-------|-----------|---------|
| `estados_socio` | 5 | VIGENTE, BAJA POR MOROSIDAD, BAJA POR RENUNCIA, BAJA POR FALLECIMIENTO, BAJA POR COMISION DIRECTIVA |
| `categorias_socio` | 8 | ACTIVO, INFANTIL, CADETE, VITALICIO, BECADO, EXTERNO, ACTIVO 2, INVITADO |
| `tipos_socio` | 3 | Socio Unico (3922), Miembro Familia (483), Titular Familia (185) |
| `socios` | 4590 | Clonados desde sportivopilar + sincronización de parámetros |

---

## Archivos disponibles

| Archivo | Contenido | Filas |
|---|---|---|
| `Socios.xlsx` | Padrón completo de socios | - |
| `GruposFamiliares.xlsx` | Grupos familiares y titulares | 644 |
| `ActividadesStatus.xlsx` | Inscripciones activas por socio | 440 |
| `Actividades.xlsx` | Historial de pagos de cuotas de actividades | 24.841 |
| `Cuotas.xlsx` | Cuotas generadas y cobradas de socios | 112.806 |
| `Conceptos.xlsx` | Movimientos financieros (socios + proveedores) | 13.385 |

---

## Paso 1 — Socios ✅ (funcionalidad disponible en plataforma)

**Archivo:** `Socios.xlsx`
**Método recomendado:** Importación desde la plataforma (`/admin/socios` → botón Importar Excel)
**Método alternativo (CLI):** `node scripts/importar-socios.js --tenant <slug>`
**Tabla destino:** `socios`

**Columnas mapeadas:**
- Nro. Socio, Apellido y Nombre, DNI, Fecha Nacimiento, Sexo
- Categoría, Tipo de Socio, Estado
- Domicilio, Ciudad, Teléfono, Celular, Email
- Fecha de Alta, Fecha de Baja
- **PIN/RFID/Tarjeta** (si está en el Excel) → `socio.rfidUid` (carnet del molinete)

**Validaciones previas:**
- [ ] Verificar tipos de socio, categorías y estados (se crean automáticamente si no existen)

**Estado:** ⬜ Pendiente

---

## Paso 2 — Grupos Familiares

**Archivo:** `GruposFamiliares.xlsx` (644 filas)
**Script:** `node scripts/importar-grupos-familiares.js --tenant <slug>`
**Tabla destino:** `grupo_familiar`

**Columnas mapeadas:**
- Núm. de Socio → socio
- Núm. del Socio Titular → titular del grupo
- Parentesco, Tipo de Grupo Familiar

**Prerequisito:** Paso 1 completado
**Estado:** ⬜ Pendiente

---

## Paso 3 — Actividades, Categorías e Inscripciones

**Archivo:** `ActividadesStatus.xlsx` (440 filas)

### 3a — Jerarquía Actividad → Categoría
**Script:** `node scripts/importar-actividades.js --tenant <slug>`
**Tablas destino:** `actividades`, `categorias_actividad`

**Actividades y categorías a crear:**

| Actividad | Categorías |
|---|---|
| BASQUET | Escuelita, Mini, Pre Mini Rojo, Pre-Mini, U13/U15/U17/U19/U21 Rojo, Tira Blanca U15/U17 |
| FUTBOL ESCUELITA | Escuelita Futbol |
| FUTBOL LIGA | Liga Argentina |
| FUTSAL | Futsal |
| TAEKWONDO | Taekwondo |
| VOLEY | Inferiores, Masculino, Mayores, U9/U11/U13/U15 Femenino |

> ⚠️ El script **borra y recrea** actividades, categorías e inscripciones del tenant antes de importar.

### 3b — Inscripciones por Socio
**Script:** `node scripts/importar-inscripciones.js --tenant <slug>`
**Tabla destino:** `inscripciones` (440 inscripciones activas)

**Columnas mapeadas:**
- Nro Socio → socioId
- Actividad + Cat. Actividad → categoriaActividadId
- Fecha de Alta Actividad → fechaInicio
- Becado, Federado, Genera Cuota, Porcentaje, Importe

**Prerequisito:** Pasos 1 y 3a completados
**Estado:** ⬜ Pendiente

---

## Paso 4 — Entidades (desde Conceptos)

**Archivo:** `Conceptos.xlsx`
**Script:** `node scripts/importar-proveedores.js --tenant <slug>`
**Tabla destino:** `entidades` (tipo = PROVEEDOR)

**Lógica:**
- Cruzar `Nro. Socio` de Conceptos contra `Nro. Socio` de **Cuotas.xlsx**
- Si el `Nro. Socio` **NO aparece en Cuotas** → es una entidad (proveedor/empleado/servicio)
- Crear en tabla `entidades` con `tipo = 'PROVEEDOR'`
- Campos: razonSocial (Apelllido y Nombre), documento (Documento), email, telefono, domicilio

**Resultado del análisis:**
- **253 entidades** únicas a importar
- **3.899 movimientos** vinculados a esas entidades
- Incluye: proveedores (EDENOR, AYSA, MOVISTAR), empleados, subcomisiones, bancos, federaciones
- Excepción: nros 1743 y 1786 tienen números altos pero no están en Cuotas — incluirlos como entidades

> ⚠️ El script debe deduplicar por `Nro. Socio` — una entidad puede tener varios movimientos.

**Prerequisito:** Paso 1 (socios) completado
**Estado:** ✅ Listo — `node scripts/importar-proveedores.js --tenant <slug>`

---

## Paso 5 — Cuotas de Socios

**Archivo:** `Cuotas.xlsx` (114.057 filas totales)
**Script:** `node scripts/importar-cuotas.js --tenant <slug> [--desde-anio 2026] [--desde-mes 4]`
**Tabla destino:** `cargos`

### Configuración del script

Argumentos disponibles:

```
--tenant <slug>      Tenant destino (REQUERIDO). Ej: sportivopilar
--desde-anio <YYYY>  Año desde el cual importar. Default: año actual
--desde-mes <M>      Mes desde el cual importar. Default: 4
```

El script **borra y reimporta** los cargos con `origen = 'MIGRACION_BRIO'` del tenant configurado, por lo que es seguro volver a ejecutar.

### Filtro de períodos

Solo se importan registros cuyo `Periodo` sea ≥ `--desde-mes/--desde-anio`.
Ejemplo: `--desde-anio 2026 --desde-mes 4` importa desde **04/2026** en adelante.

### Tipos de cuota

| Tipo Cuota Brio | Mapeo `categoria` | Lógica |
|---|---|---|
| CUOTA SOCIAL | `CUOTA_SOCIAL` | directo |
| ACTIVIDAD | `ACTIVIDAD` | intenta matchear `Desc.Cuota` ("ACT - CAT") contra tablas `actividades`/`categorias_actividad`; si hay match setea `categoriaActividadId`; si no → `CONCEPTO` |
| CONCEPTO | `CONCEPTO` | directo |
| MOROSIDAD | `MORA` | directo |
| FINANCIADO | `FINANCIADO` | directo |
| (otros) | `CONCEPTO` | fallback; `tipoCuota` guarda el texto original |

### Estados

| Est. Cuota Brio | Mapeo `cargo.estado` | Notas |
|---|---|---|
| PAGADA | `PAGADO` | `fechaPago` = Fecha Cobro |
| PENDIENTE | `PENDIENTE` | sin fechaPago |
| NOTA DE CRÉDITO | `PAGADO` | `montoOriginal` y `montoTotal` negativos; `categoria = 'NOTA_CREDITO'` |

### Columnas mapeadas para `cargos`

| Columna Excel | Campo BD |
|---|---|
| Nro. Socio | `socioId` |
| Tipo Cuota | `tipoCuota` (texto original), `categoria` (mapeado) |
| Periodo | `periodoId` (crea el periodo si no existe) |
| Desc. Cuota | `descripcion`, y match actividad+categoría |
| Precio × Porc. Cuota | `montoOriginal` |
| Importe Real | `montoTotal` |
| Precio×Porc − Importe Real | `montoBonificacion` |
| Fecha Gen. | `fechaGeneracion` |
| Fecha Cobro | `fechaPago` (si PAGADA) |
| Categ. Socio / Estado | `observaciones` |

> ⚠️ **Nota sobre Periodos:** la tabla `periodos` tiene unique `[anio, mes]` sin `tenantId` — los períodos son compartidos entre tenants. El script busca primero sin filtrar tenant.

### Prerequisito
Paso 1 (Socios) y Paso 3a (Actividades/Categorías) completados para el tenant destino.

### Ejecución

```bash
cd server
node scripts/importar-cuotas.js --tenant sportivopilar --desde-anio 2026 --desde-mes 4
```

Al finalizar imprime: importados / saltados por período / sin socio / errores / conteo por estado en BD.

### Actualización de cuotaMensual (incluida en el mismo script)

Al terminar la importación de cargos, el script también actualiza `cuotaMensual` en:

- **`TipoSocio`** — calcula el máximo del Excel y lo asigna:

| Código | Lógica | Valor (sportivopilar) |
|---|---|---|
| `SOCIO_UNICO` | Máx. CUOTA SOCIAL sin "GRUPO FAMILIAR", < $40.000 | $23.000 |
| `TITULAR_FAMILIA` | Máx. CUOTA SOCIAL con "GRUPO FAMILIAR" en Desc.Cuota | $43.000 |

- **`CategoriaActividad`** — para cada actividad, toma el máximo importe de las filas con Tipo Cuota = ACTIVIDAD cuyo prefijo (antes del ` - `) coincida con el nombre de la actividad en BD. Aplica el mismo valor a todas las categorías de esa actividad.

| Actividad | Valor (sportivopilar) |
|---|---|
| BASQUET | $38.000 |
| FUTBOL ESCUELITA | $30.000 |
| FUTBOL LIGA | $30.000 |
| FUTSAL | $30.000 |
| VOLEY | $30.000 |

**Estado:** ✅ Listo

---

## Paso 6 — Movimientos Financieros (desde Conceptos)

**Archivo:** `Conceptos.xlsx` (13.385 filas)
**Script:** `node scripts/importar-movimientos.js --tenant <slug> [--desde-anio YYYY] [--desde-mes M]`
**Tabla destino:** `movimientos_caja`
**Filtro de período:** sólo importa movimientos con `Fecha Movimiento >= 1/<mes>/<anio>` (default: 4/<año actual>).

**Lógica de clasificación por fila:**

| Condición | Acción |
|---|---|
| `Estado de la Cuota` = `"Pagada"` y Nro. Socio existe en socios | Movimiento de ingreso vinculado a socio |
| `Estado de la Cuota` = `"Pendiente"` | Movimiento pendiente (no generar movimiento de caja) |
| `Estado de la Cuota` = `"Proveedor"` | Movimiento de egreso vinculado a entidad proveedor |
| `Estado de la Cuota` = `"Nota de Crédito"` | Movimiento de ajuste/devolución |
| Concepto = SUELDOS, ALQUILERES, GASTOS, etc. | Movimiento de egreso general |

**Columnas mapeadas:**
- Fecha Movimiento → fecha
- Comprobante → comprobanteNro
- Concepto → concepto
- Importe Total → monto
- Forma Pago → tipo (INGRESO / EGRESO)
- Descripción → descripcion
- Usuario Comprobante → registradoPor
- Nro. Socio → referencia a socio o entidad

**Conceptos detectados en el archivo:**
- **Ingresos de socios:** CUOTA SOCIAL, CUOTA VOLEY, CUOTA BASQUET, CUOTA FUTBOL, CARNET, ANTICIPO SOCIOS
- **Ingresos otros:** ALQUILER TAEKWONDO, ALQUILER GIMNASIO, RECAUDACION LIGA, ENTRADAS EVENTOS, PUBLICIDAD
- **Egresos:** SUELDOS Y JORNALES, LIMPIEZA, GASTOS VARIOS, MATERIALES, VIATICOS, CARGAS SOCIALES, HONORARIO
- **Transferencias:** TRANSFERENCIA DE FONDOS, INICIO DE CAJA, CIERRE CAJA
- **Ajustes:** DEVOLUCIONES, INCOBRABLES, DESCUENTOS CONCEDIDOS, AJUSTE EJERCICIOS ANTERIORES

**Prerequisito:** Pasos 1 y 4 completados
**Estado:** ✅ Listo — `node scripts/importar-movimientos.js --tenant <slug> [--desde-anio YYYY] [--desde-mes M]`

---

## Paso 7 — Historial de Pagos de Actividades

**Archivo:** `Actividades.xlsx` (24.841 filas)
**Script:** `node scripts/importar-pagos-actividades.js`
**Tabla destino:** TBD (confirmar estructura con cliente)

**Prerequisito:** Pasos 1, 3 y 5 completados
**Estado:** 🔴 Script pendiente de desarrollo — confirmar columnas

---

## Orden de ejecución completo

> Reemplazá `<slug>` por el slug del tenant destino (ej. `sportivopilar`).
> Todos los comandos se ejecutan desde la carpeta `server/`.

### Migración completa desde cero (nuevo tenant con datos de Brio)

```bash
cd server

# 1. Socios (crea automáticamente EstadoSocio y CategoriaSocio desde el Excel)
node --env-file=.env scripts/importar-socios.js --tenant <slug>

# 2. Grupos familiares (actualiza tipoSocio a Titular/Miembro y setea titularFamiliaId)
node --env-file=.env scripts/importar-grupos-familiares.js --tenant <slug>

# 3. Sincronizar parámetros (corrige y garantiza consistencia de tablas auxiliares)
node --env-file=.env scripts/sincronizar-params-socios.js --tenant <slug>

# 4a. Actividades y categorías de actividades
node --env-file=.env scripts/importar-actividades.js --tenant <slug> --reset

# 4b. Inscripciones activas por socio
node --env-file=.env scripts/importar-inscripciones.js --tenant <slug>

# 5. Entidades / proveedores (desde Conceptos.xlsx)
node --env-file=.env scripts/importar-proveedores.js --tenant <slug>

# 6. Cuotas de socios (ajustar período según lo que se quiera importar)
node --env-file=.env scripts/importar-cuotas.js --tenant <slug> --desde-anio 2026 --desde-mes 4

# 7. Movimientos financieros (ajustar período según lo que se quiera importar)
node --env-file=.env scripts/importar-movimientos.js --tenant <slug> --desde-anio 2026 --desde-mes 4
```

### Clonar de un tenant a otro + completar socios

```bash
cd server

# 1. Clonar todos los datos del negocio (sin socios si la tabla tiene PK compuesta)
node --env-file=.env scripts/clonarTenant.js --from sportivopilar --to <slug-destino>

# 2. Si los socios no se clonaron, importarlos desde el Excel
node --env-file=.env scripts/importar-socios.js --tenant <slug-destino>

# 3. Grupos familiares
node --env-file=.env scripts/importar-grupos-familiares.js --tenant <slug-destino>

# 4. Sincronizar parámetros (obligatorio después del clon o import)
node --env-file=.env scripts/sincronizar-params-socios.js --tenant <slug-destino>
```

### Solo re-sincronizar parámetros (correctivo)

```bash
cd server
node --env-file=.env scripts/sincronizar-params-socios.js --tenant <slug> --dry-run  # ver antes
node --env-file=.env scripts/sincronizar-params-socios.js --tenant <slug>
```

---

## Orden de ejecución (original)

```bash
cd server

# 1. Socios — vía plataforma web (recomendado) o CLI:
node scripts/importar-socios.js --tenant <slug>

# 2. Grupos familiares
node scripts/importar-grupos-familiares.js --tenant <slug>

# 3a. Jerarquía actividades + categorías
node scripts/importar-actividades.js --tenant <slug> --reset

# 3b. Inscripciones
node scripts/importar-inscripciones.js --tenant <slug>

# 4. Entidades / proveedores (desde Conceptos.xlsx)
node scripts/importar-proveedores.js --tenant <slug>

# 5. Cuotas — cargos + pagos. Ajustar período si necesario:
node scripts/importar-cuotas.js --tenant <slug> --desde-anio 2026 --desde-mes 4

# 6. Movimientos financieros (desde Conceptos.xlsx). Ajustar período si necesario:
node scripts/importar-movimientos.js --tenant <slug> --desde-anio 2026 --desde-mes 4

# 7. Pagos actividades — script pendiente de desarrollo
```

### Flags comunes

Todos los scripts implementan el helper común `_lib/cli.js`. Comportamiento estándar:

- `--tenant <slug>` (REQUERIDO): tenant destino. Sin él el script aborta con mensaje claro.
- Si el slug no existe en la tabla `tenants`, también aborta con error.
- Algunos scripts soportan flags extra (ver tabla a continuación).

| Script | Flags adicionales |
|---|---|
| `importar-actividades.js` | `--reset` (borra antes de importar), `--dry-run` |
| `importar-cuotas.js` | `--desde-anio <YYYY>`, `--desde-mes <M>` |

---

## Resumen de estado

| Paso | Descripción | Script | Multi-tenant | Estado |
|---|---|---|---|---|
| 1 | Socios | (plataforma) o `importar-socios.js` | ✅ | ⬜ Pendiente |
| 2 | Grupos Familiares | `importar-grupos-familiares.js` | ✅ | ⬜ Pendiente |
| 3a | Actividades y Categorías | `importar-actividades.js` | ✅ | ✅ Listo |
| 3b | Inscripciones | `importar-inscripciones.js` | ✅ | ✅ Listo |
| 4 | Entidades/Proveedores | `importar-proveedores.js` | ✅ | ✅ Listo |
| 5 | Cuotas de Socios | `importar-cuotas.js` | ✅ | ✅ Listo |
| 6 | Movimientos Financieros | `importar-movimientos.js` | ✅ | ✅ Listo |
| 7 | Pagos Actividades | `importar-pagos-actividades.js` | — | 🔴 Sin script |

> Todos los scripts toman el tenant por `--tenant <slug>` (requerido).
> El script auxiliar `importar-cuotas-historicas.js` también está en el repo pero no
> forma parte del flujo principal — `importar-cuotas.js` lo reemplaza.

**Leyenda:** ✅ Listo · ⬜ Pendiente de ejecutar · 🔧 En progreso · 🔴 Sin desarrollar · ❌ Con errores
