# Inconsistencias a revisar antes de generar cuotas — Club Sportivo Pilar

**Período:** 05/2026
**Generado:** 2026-05-04 23:22

Este documento lista los casos que conviene revisar **antes** de regenerar cuotas en la UI.
Ninguno bloquea la generación, pero pueden ocultar bajas no registradas o socios que ya no deberían facturar.

---

## 1. Socios desincronizados (FK ≠ string legacy) — 5

La FK apunta a un valor distinto del string legacy. **La FK manda** (es la que usa la generación de cuotas), pero la UI antes mostraba el string.
Para resolver: abrir cada socio en el modal, validar el valor correcto, guardar. El backend reescribe el string desde la FK.

| nroSocio | Nombre | Dimensión | String legacy | FK (vigente) |
|---|---|---|---|---|
| 16100 | FIGUEREDO, PEDRO | estado | "BAJA POR RENUNCIA" | "VIGENTE" |
| 20348 | ARCE, DYLAN ELISEO | estado | "BAJA POR RENUNCIA" | "VIGENTE" |
| 20595 | ANTINAO, MATIAS | estado | "VIGENTE" | "BAJA POR MOROSIDAD" |
| 20595 | ANTINAO, MATIAS | categoria | "BECADO" | "ACTIVO" |
| 20815 | MILENS, ALEJO | estado | "BAJA POR RENUNCIA" | "VIGENTE" |
| 168492 | Tischler Agustín caleb | tipoSocio | "GRUPO_FAMILIAR" | "Socio Unico" |

## 2. Huérfanos (string sin FK y sin match en la maestra) — 1

El string legacy no existe en la tabla maestra correspondiente. Hay que crear el valor en la maestra o cambiar el campo a uno válido.

| nroSocio | Nombre | Dimensión | String huérfano | Acción sugerida |
|---|---|---|---|---|
| 168492 | Tischler Agustín caleb | estado | "ACTIVO" | Reasignar desde el modal a un valor válido (o crear "ACTIVO" en la maestra) |

## 3. Sospechosos accionables: con cuota histórica Brio pero no en 05/2026 — 0

Socios titulares marcados como **VIGENTE** por la FK que **sí generarían cuota** (categoría con descuento < 100% y tipo de socio con cuota mensual > 0)
pero que tuvieron cuota Brio en algún período histórico y **no aparecen en 05/2026**.

Filtros aplicados (excluidos automáticamente, no son inconsistencia real):
- Categorías con 100% de descuento (VITALICIO, BECADO, etc.) — por definición no facturan.
- Miembros de familia (paga el titular).
- Tipos de socio sin cuota mensual configurada.

Posibles causas de los listados:
- Baja real no registrada en el sistema.
- Cambio de condición que el operador Brio reflejó pero acá no.

_Ninguno._

## 4. Cuotas de actividad que se generarán — 21

Inscripciones activas que aún no tienen cargo en el período. Cruce contra Brio:
- **NUEVA:** alta/inscripción posterior al último cierre Brio.
- **CAMBIO_CATEGORIA:** Brio facturaba otra categoría de la misma actividad (típicamente promoción de edad).

Todas son legítimas. Listadas a fines informativos.

| nroSocio | Nombre | Actividad / Categoría | Monto | Tipo | Brio histórico |
|---|---|---|---:|---|---|
| 15532 | ALMIRON, RAMIRO SANTIAGO | BASQUET / BASQUET U21 ROJO | $45000 | CAMBIO_CATEGORIA | BASQUET - BASQUET CADETE |
| 15865 | MONCLOBA, MATEO | BASQUET / BASQUET U21 ROJO | $45000 | CAMBIO_CATEGORIA | BASQUET - BASQUET CADETE \| BASQUET - BASQUET U17 ROJO \| BASQUET - BASQUET U21 ROJO |
| 16035 | SALDEÑA, JUAN CRUZ | BASQUET / BASQUET U21 ROJO | $45000 | CAMBIO_CATEGORIA | BASQUET - BASQUET CADETE |
| 16348 | DIAZ, CASTRO MARTIN NOAH | BASQUET / BASQUET MINI | $45000 | CAMBIO_CATEGORIA | BASQUET - BASQUET CADETE \| FUTBOL - BABY FUTBOL \| FUTBOL - FUTSAL FUTSAL... |
| 16561 | LOPES, RENATO | BASQUET / BASQUET U17 ROJO | $45000 | CAMBIO_CATEGORIA | BASQUET - BASQUET PRE-MINI |
| 19589 | ODERA, THIAGO BENJAMIN | BASQUET / BASQUET MINI | $45000 | CAMBIO_CATEGORIA | BASQUET - BASQUET PRE-MINI |
| 19823 | PEREZ, FABRICIO SEBASTIAN | FUTSAL / FUTSAL FUTSAL | $33000 | CAMBIO_CATEGORIA | FUTBOL - FUTSAL FUTSAL \| FUTSAL - FUTSAL FUTSAL |
| 19852 | LOPEZ, GUERRERO THIAGO IVAN | BASQUET / BASQUET U15 ROJO | $45000 | CAMBIO_CATEGORIA | BASQUET - BASQUET CADETE \| BASQUET - BASQUET U15 ROJO |
| 19919 | LUNA, CAMILA ROCIO | VOLEY / VOLEY MAYORES | $33000 | CAMBIO_CATEGORIA | VOLEY - VOLEY INFERIORES \| VOLEY - VOLEY MAYORES |
| 19982 | MENDEZ, FELIPE THOMAS | BASQUET / BASQUET TIRA BLANCA U15 | $45000 | CAMBIO_CATEGORIA | BASQUET - BASQUET CADETE \| BASQUET - BASQUET TIRA BLANCA U15 |
| 20183 | MENDEZ, SANTINO VICENTE | BASQUET / BASQUET PRE-MINI | $45000 | CAMBIO_CATEGORIA | BASQUET - BASQUET CADETE \| BASQUET - BASQUET PRE-MINI |
| 20210 | CATALANO, DICIOCCO SUSANA BEATRIZ | VOLEY / VOLEY INFERIORES | $33000 | CAMBIO_CATEGORIA | VOLEY - VOLEY INFERIORES |
| 20224 | ZAMBRANO, PEñA JOSEPH DAVID | VOLEY / VOLEY MASCULINO | $33000 | CAMBIO_CATEGORIA | VOLEY - VOLEY MASCULINO |
| 20492 | HERMOSILLA, AGUSTIN GABRIEL | VOLEY / VOLEY MASCULINO | $33000 | CAMBIO_CATEGORIA | VOLEY - VOLEY MASCULINO |
| 20510 | FLEITAS, JUANA FAUSTINA | VOLEY / VOLEY INFERIORES | $33000 | NUEVA | - |
| 20545 | GUZMAN, BAUTISTA EZEQUIEL | VOLEY / VOLEY MASCULINO | $33000 | CAMBIO_CATEGORIA | VOLEY - VOLEY MASCULINO |
| 20668 | SENDRA, AGUSTINA | BASQUET / U9 FEMENINO | $45000 | NUEVA | - |
| 20806 | ACOSTA, MARCHESSE AVRIL | VOLEY / VOLEY INFERIORES | $33000 | NUEVA | - |
| 19716 | FONTANA, TOBIAS | FUTSAL / FUTSAL FUTSAL | $33000 | CAMBIO_CATEGORIA | FUTBOL - FUTSAL FUTSAL \| FUTSAL - FUTSAL FUTSAL |
| 20830 | MARTINEZ, ALMIRON BRUNO | FUTBOL LIGA / FUTBOL LIGA ARGENTINA | $33000 | NUEVA | - |
| 19961 | MARTINEZ, ALMIRON SIMON | FUTBOL LIGA / FUTBOL LIGA ARGENTINA | $33000 | CAMBIO_CATEGORIA | FUTBOL - FUTBOL LIGA ARGENTINA \| FUTBOL LIGA - FUTBOL LIGA ARGENTINA |

---

## Cómo regenerar después de resolver

1. Tocar cada socio en secciones 1 y 2 desde el modal de Socios y guardar (sin necesidad de cambiar nada — el guardado sincroniza FK ↔ string).
2. Para los sospechosos de la sección 3 que sean baja real: cambiar el estado del socio a "BAJA POR ..." y guardar (también seteará `fechaBaja` cuando exista el flag `esBaja`).
3. Re-correr el preview:
   ```bash
   node server/src/scripts/validarRegeneracionCuotaSocial.js --tenant sportivopilar --periodo 2026-05 --modo preview
   ```
4. Generar desde la UI: **Cuotas → Períodos → 05/2026 → Generar**.
