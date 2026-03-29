# Plan de Migración desde Brio → RojoPlus/Clubix

**Tenant:** sportivopilar
**Carpeta de archivos fuente:** `brio/`
**Scripts:** `server/scripts/`

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
**Método:** Importación desde la plataforma (`/admin/socios` → botón Importar Excel)
**Tabla destino:** `socios`

**Columnas mapeadas:**
- Nro. Socio, Apellido y Nombre, DNI, Fecha Nacimiento, Sexo
- Categoría, Tipo de Socio, Estado
- Domicilio, Ciudad, Teléfono, Celular, Email
- Fecha de Alta, Fecha de Baja

**Validaciones previas:**
- [ ] Verificar tipos de socio, categorías y estados (se crean automáticamente si no existen)

**Estado:** ⬜ Pendiente

---

## Paso 2 — Grupos Familiares

**Archivo:** `GruposFamiliares.xlsx` (644 filas)
**Script:** `node scripts/importar-grupos-familiares.js`
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
**Script:** `node scripts/importar-actividades.js`
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
**Script:** `node scripts/importar-inscripciones.js`
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
**Script:** `node scripts/importar-proveedores.js`
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
**Estado:** ✅ Listo — `node scripts/importar-proveedores.js`

---

## Paso 5 — Cuotas de Socios

**Archivo:** `Cuotas.xlsx` (112.806 filas)
**Script:** `node scripts/importar-cuotas.js`
**Tablas destino:** `cargos`, `pagos`

**Tipos de cuota en el archivo:**

| Tipo Cuota Brio | Mapeo en RojoPlus |
|---|---|
| CUOTA SOCIAL | `cargo.categoria = 'CUOTA_SOCIAL'` |
| ACTIVIDAD | `cargo.categoria = 'ACTIVIDAD'` |
| CONCEPTO | `cargo.categoria = 'CONCEPTO'` |
| MOROSIDAD | `cargo.categoria = 'MORA'` |
| FINANCIADO | `cargo.categoria = 'FINANCIADO'` |

**Estados:**

| Est. Cuota Brio | Mapeo en RojoPlus |
|---|---|
| PAGADA | `cargo.estado = 'PAGADO'` → crear registro en `pagos` |
| (sin Est. Cuota) | `cargo.estado = 'PENDIENTE'` |

**Columnas mapeadas para `cargos`:**
- Nro. Socio → socioId
- Periodo → descripcion / periodoId
- Desc. Cuota → descripcion
- Precio, Porc. Cuota, Importe Real → montoOriginal, montoBonificacion, montoTotal
- Fecha Gen. → fechaGeneracion
- Tipo Cuota → categoria / tipoCuota

**Columnas mapeadas para `pagos`** (solo cuotas PAGADAS):
- Fecha Cobro → fecha
- Forma Pago / Medio de Pago → medioPagoId
- Caja → cajaId
- Comprobante (Nro. Cuenta) → comprobanteNro
- Importe Real → montoTotal + montoRecibido

**Prerequisito:** Paso 1 completado
**Estado:** ✅ Listo — `node scripts/importar-cuotas.js`

---

## Paso 6 — Movimientos Financieros (desde Conceptos)

**Archivo:** `Conceptos.xlsx` (13.385 filas)
**Script:** `node scripts/importar-movimientos.js`
**Tabla destino:** `movimientos_caja`

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
**Estado:** ✅ Listo — `node scripts/importar-movimientos.js`

---

## Paso 7 — Historial de Pagos de Actividades

**Archivo:** `Actividades.xlsx` (24.841 filas)
**Script:** `node scripts/importar-pagos-actividades.js`
**Tabla destino:** TBD (confirmar estructura con cliente)

**Prerequisito:** Pasos 1, 3 y 5 completados
**Estado:** 🔴 Script pendiente de desarrollo — confirmar columnas

---

## Orden de ejecución

```
1. Importar Socios          (plataforma web)
2. Importar Grupos Familiares
3a. Importar Actividades/Categorías
3b. Importar Inscripciones
4. Importar Proveedores     (desde Conceptos)
5. Importar Cuotas          (cargos + pagos)
6. Importar Movimientos     (desde Conceptos)
7. Importar Pagos Actividades
```

---

## Resumen de estado

| Paso | Descripción | Script | Estado |
|---|---|---|---|
| 1 | Socios | (plataforma) | ⬜ Pendiente |
| 2 | Grupos Familiares | `importar-grupos-familiares.js` | ⬜ Pendiente |
| 3a | Actividades y Categorías | `importar-actividades.js` | ✅ Listo |
| 3b | Inscripciones | `importar-inscripciones.js` | ✅ Listo |
| 4 | Entidades/Proveedores | `importar-proveedores.js` | ✅ Listo |
| 5 | Cuotas de Socios | `importar-cuotas.js` | ✅ Listo |
| 6 | Movimientos Financieros | `importar-movimientos.js` | ✅ Listo |
| 7 | Pagos Actividades | `importar-pagos-actividades.js` | 🔴 Sin script |

**Leyenda:** ✅ Listo · ⬜ Pendiente de ejecutar · 🔧 En progreso · 🔴 Sin desarrollar · ❌ Con errores
