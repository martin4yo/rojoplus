# Migración Brio → Clubix — Conciliación de Cuotas

**Fecha:** 2026-05-06 al 2026-05-07
**Tenant afectado:** sportivopilar
**Estado final:** 100% de las familias cuadran (saldoCC = adeudado)

---

## Contexto

Brio fue el sistema de gestión activo del club hasta el **30/4/2026**. Clubix arrancó operativamente el **1/5/2026**. La importación inicial (`importar-cuotas.js`) trajo solo períodos `>= 04/2025`. Para tener el histórico completo y que la cuenta corriente refleje correctamente la deuda real de cada socio, hubo que:

1. Limpiar anticipos duplicados de la importación inicial
2. Importar el histórico completo (cuotas pre-1/4/2025) desde `brio/Cuotas.xlsx`
3. Resolver bugs detectados durante la conciliación
4. Crear cuotas faltantes y ajustes compensatorios para que `saldoCC = adeudado` por familia

---

## Fuente de datos Brio

- Archivo: `brio/Cuotas.xlsx` (sheet `CUOTAS GENERADAS`, headers en fila 3)
- Total: 115.361 filas (2018-06 a 2026-05)
- Columnas relevantes: `Fecha Gen.`, `Nro. Socio`, `Tipo Cuota`, `Periodo`, `Desc. Cuota`, `Importe Real`, `Est. Cuota`, `Fecha Cobro`

---

## Cronología de acciones

### 1. Limpieza de anticipos socios

**Problema:** Brio usa "ANTICIPO SOCIOS" como cuenta de paso. Cada anticipo genera 2 filas (positiva = entrada de plata, negativa = aplicación a la cuota destino). El script `importar-cuotas.js` original trató cada fila como cargo+pago, duplicando contablemente cada flujo.

**Solución:** `server/scripts/limpiar-anticipos-brio.js`

Clasifica cada socio en 3 casos (A: doble import, B: anticipo vigente, C: positivos antes del corte) y anula cargos+pagos correspondientes.

**Resultado aplicado el 2026-05-06:**
- 364 pagos anulados
- 775 cargos anulados
- 26 SaldoFavor creados ($731.400)
- Excluido manualmente socio 20384 (FREDES, ya tenía SaldoFavor manual)

**Backup pre-limpieza:** `backups/backup-pre-limpieza-brio-20260506-133531.dump`

---

### 2. Importación histórica (pre-corte)

**Script:** `server/scripts/importar-cuotas-pre-corte.js`

**Filtros:**
- `Fecha Gen. < 1/4/2025` (corte estricto)
- Salta filas `Desc. Cuota = 'ANTICIPO SOCIOS'` (mismo motivo de duplicación contable)

**Mapeo de Est. Cuota:**
| Est. Cuota Brio | estado Clubix | Acción adicional |
|---|---|---|
| PAGADA | PAGADO | Crea Pago vinculado (origen `MIGRACION_BRIO_HISTORICO`) |
| PENDIENTE | PENDIENTE | - |
| NOTA DE CRÉDITO | ANULADO | - |
| FINANCIADO | ANULADO | (la cuota original fue reemplazada por plan de pago) |

**Identificador:** `origen='MIGRACION_BRIO_HISTORICO'` (distinto de `MIGRACION_BRIO`)

**Modos:**
- Default (sin `--socios`): borra todo `MIGRACION_BRIO_HISTORICO` previo y re-importa
- Incremental (`--socios <nros>`): no borra nada, solo procesa los socios indicados

**Resultado aplicado el 2026-05-06/07:**
- 90.126 cargos importados
- 55.215 pagos creados
- Cobertura: 4286 de 4358 socios cuadraron en primera pasada (98.3%)
- Backup pre-import: `backups/backup-pre-import-historico-20260506-160457.dump`

**Tomó ~6 horas** por la cantidad de inserts e índices crecientes. Hubo una caída de DB que dejó 3.745 filas sin importar; se rescataron con un segundo run en modo incremental.

---

### 3. Bugs detectados y resueltos

#### 3.1. Timezone en cutoff de fecha histórica

**Problema:** `excelDateToJS` interpreta el serial de Excel como UTC (`new Date((val - 25569) * 86400 * 1000)`). El cutoff `< 2025-04-01T00:00 local-time` (Argentina UTC-3) dejaba pasar todas las cuotas con `Fecha Gen. = 1/4/2025` porque su UTC midnight = 2025-03-31 21:00 local-time, que cumple `< 2025-04-01 local`.

Resultado: 1190 cargos del período 04/2025 quedaron duplicados (existían en `MIGRACION_BRIO` y también en `MIGRACION_BRIO_HISTORICO`).

**Solución de datos:** `server/scripts/limpiar-historico-post-corte.js`

Borra del histórico todo cargo/pago cuyo `periodoId` corresponda a períodos `>= 04/2025`, manteniendo la importación principal.

**Resultado aplicado:** 1190 cargos + 952 pagos eliminados de `MIGRACION_BRIO_HISTORICO`.

#### 3.2. Notas de crédito mal mapeadas en `importar-cuotas.js`

**Problema:** Línea 429 original tenía `estado: esPagado ? 'PAGADO' : 'PENDIENTE'` y `esPagado = estCuota === 'PAGADA' || esNotaCredito`. Las notas de crédito quedaban como `PAGADO` con `montoTotal` negativo y SIN pago vinculado, generando saldo a favor falso por el monto negativo.

**Fix prospectivo:** ahora `estado: esNotaCredito ? 'ANULADO' : (esPagado ? 'PAGADO' : 'PENDIENTE')`

**Fix de datos one-shot:** `UPDATE Cargo SET estado='ANULADO' WHERE origen='MIGRACION_BRIO' AND categoria='NOTA_CREDITO' AND estado='PAGADO'`

**Resultado:** 2700 cargos actualizados. Eliminó **$58.576.000 de saldo a favor falso**.

#### 3.3. Inconsistencia de naming de `Periodo.nombre`

**Problema:** La BD tenía 33 períodos con formato `"MM/YYYY"` (ej `"04/2025"`) pero el código creaba con 3 formatos distintos:
- `"Mayo 2025"` (en `admin.js:5889`, `cargos.js:603`)
- `"05 / 2025"` con espacios (en `cuotas.js:864`)
- `"Mayo 2025"` con localized month (en `cargos.js:361`)

**Fix prospectivo:** unificado a `${String(mes).padStart(2,'0')}/${anio}` en los 4 lugares.

---

### 4. Conciliación final

#### 4.1. Validación per-socio Brio vs Clubix

**Script:** `server/scripts/comparar-saldo-brio-vs-clubix.js`

Compara saldo deudor por socio entre Brio (xlsx) y Clubix (BD) al 30/4/2026:
- Brio saldoDeudor = `Σ Importe Real` donde `Est. Cuota='PENDIENTE'` y `Fecha Gen. ≤ 30/4/2026`
- Clubix saldoDeudor = `Σ montoTotal` de cargos `estado='PENDIENTE'` y `fechaGeneracion ≤ 30/4/2026`

**Resultado tras los fixes:**
- 4335 de 4358 socios cuadran (99.5%)
- 19 socios Brio > Clubix ($1.132.000) — cuotas con `Fecha Gen ≥ 1/4/2025` pero `Periodo < 4/2025` que ningún script importó (edge case)
- 4 socios Clubix > Brio ($522.500) — VALDEZ 17079, VALDEZ 17080, ROMERO 17066, ALVAREZ 19330 — duplicados originales del primer import (pendiente de investigar)

#### 4.2. Validación de PENDIENTES período 05/2026

**Script:** `server/scripts/validar-pendientes-052026.js`

**Resultado:** Brio total PENDIENTE 05/2026: **$27.232.000**
| Categoría | Cantidad | Suma |
|---|---|---|
| Pendiente en ambos (coincide exacto) | 718 | $22.845.000 |
| Cobradas post-migración en Clubix | 113 | $3.924.000 |
| Solo en Brio (faltan en Clubix) | 15 | $463.000 |
| Solo en Clubix (no en Brio) | 18 | $582.000 |

#### 4.3. Cuotas faltantes 05/2026 generadas

**Script:** `server/scripts/ajuste-cuotas-faltantes-brio.js`

Crea las cuotas Brio PENDIENTE de un período que no existen en Clubix. Mapea categoría/actividad correctamente.

**Identificador para revertir:**
```
origen = 'AJUSTE_CUOTAS_FALTANTES_BRIO_20260507'
```

**Resultado aplicado el 2026-05-07:** 15 cargos creados ($463.000)

#### 4.4. Ajustes compensatorios de saldo CC por familia

**Necesidad:** El usuario pide que `saldoCC = sum(cuotas pendientes)` por socio/familia.

**Solución:** Para cada familia con `delta = saldoCC - adeudado < 0` (pagos en exceso a nivel familia), crear un cargo en la cuenta del titular con:
- `montoTotal = |delta|`
- `estado = 'PAGADO'` (cuenta como `noAnulados` pero no como `adeudado`)
- `categoria = 'AJUSTE'`
- `descripcion = 'Ajuste de saldo - pagos previos no aplicados a cuotas'`
- `fechaGeneracion/fechaPago = 30/4/2026`
- Sin `pagoId` asociado (es un balance contable)

Eso eleva `saldoCC` exactamente al `adeudado`.

**Script:** `server/scripts/ajuste-saldo-cc-familia.js` (con `--socios` para incremental, idempotente)

**Identificador para revertir:**
```
origen = 'AJUSTE_COMPENSACION_SALDO_CC_20260507'
```

**Resultado aplicado el 2026-05-07:** 566 cargos compensatorios ($7.170.781)

---

## Estado final

```
Total familias con movimientos:       3947
✅ Cuadran (saldoCC = adeudado):     3947  (100.0%)
❌ No cuadran:                          0

Saldo CC global (familias):           $79.033.875
Adeudado global (cuotas pend):        $79.033.875
Diferencia neta:                      $0,00
```

---

## Reversión de ajustes

Si en algún momento se necesita revertir los ajustes contables:

```sql
-- Revertir cuotas faltantes 05/2026
DELETE FROM cargos WHERE origen = 'AJUSTE_CUOTAS_FALTANTES_BRIO_20260507';

-- Revertir compensación de saldo CC familia
DELETE FROM cargos WHERE origen = 'AJUSTE_COMPENSACION_SALDO_CC_20260507';
```

Si se necesita revertir TODO al estado pre-migración, restaurar el backup:
```bash
pg_restore -h localhost -p 5434 -U postgres -d clubix_db --clean --if-exists \
  backups/backup-pre-import-historico-20260506-160457.dump
```

---

## Origen identifiers de cargos

| `origen` | Descripción |
|---|---|
| `MANUAL` | Cargo creado manualmente desde la UI |
| `MIGRACION_BRIO` | Importación principal post-corte (período >= 04/2025) |
| `MIGRACION_BRIO_HISTORICO` | Importación histórica pre-corte (Fecha Gen. < 1/4/2025) |
| `AJUSTE_CUOTAS_FALTANTES_BRIO_20260507` | Cuotas Brio PENDIENTE 05/2026 que faltaban en Clubix |
| `AJUSTE_COMPENSACION_SALDO_CC_20260507` | Compensación saldo CC = adeudado a nivel familia |

---

## Scripts disponibles

### Auditoría / informes (read-only)
- `auditar-cuenta-corriente.js` — Audita saldoCC vs adeudado - saldoFavor por socio
- `informe-cc-vs-pendientes.js` — Compara saldoCC vs cuotas pendientes (por socio)
- `informe-cc-vs-pendientes-familia.js` — ⭐ Lo mismo agrupado por grupo familiar (la métrica que cuenta)
- `comparar-saldo-brio-vs-clubix.js` — Compara saldo deudor Brio (xlsx) vs Clubix por socio
- `validar-pendientes-052026.js` — Valida cuotas PENDIENTE de un período Brio vs Clubix

### Aplicación de cambios
- `limpiar-anticipos-brio.js` — Limpia anticipos socios duplicados
- `importar-cuotas-pre-corte.js` — Trae cuotas pre-1/4/2025 desde Brio (con modo incremental)
- `limpiar-historico-post-corte.js` — Borra cargos MIGH cuyo período >= 04/2025 (fix timezone)
- `ajuste-cuotas-faltantes-brio.js` — Crea cuotas faltantes específicas (con código revertible)
- `ajuste-saldo-cc-familia.js` — Crea cargos compensatorios para que saldoCC = adeudado por familia (con código revertible)

Todos soportan `--tenant <slug>` y `--dry-run` / `--apply`.

---

## Pendientes

1. **4 excedentes Clubix > Brio** (VALDEZ 17079/17080, ROMERO 17066, ALVAREZ 19330): $522.500. Probable importación duplicada original — investigar caso por caso.
2. **19 casos Brio > Clubix** con `Fecha Gen ≥ 1/4/2025` pero `Periodo < 4/2025` que ningún script importó ($1.13M).
3. **UX**: A futuro conviene cambiar el endpoint de cuenta corriente para que `saldoActual = adeudado` directamente, sin depender de cargos compensatorios. Eso simplifica.
4. **Performance**: Con ~150k cargos extra, revisar pantallas que listan sin filtrar por fecha y agregar default `fechaGeneracion >= 2025-04-01`.
