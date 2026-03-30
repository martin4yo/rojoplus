# Pendientes de Configuración — Tenant Sportivo Pilar

> **Relevancia:** Este documento describe la configuración que debe realizarse manualmente
> en la base de datos / panel admin **antes de poner en producción** el tenant `sportivopilar`
> (slug: `sportivopilar.clubix.com.ar`, tenant_id = 1 en `rojoplus_db`).
>
> Generado a partir del análisis del estado actual del tenant migrado (2026-03-29).

---

## Estado Actual (post-migración)

| Elemento | Estado | Detalle |
|---|---|---|
| Plan de Cuentas Contables | ✅ Completo | 50+ cuentas estructuradas (Activo, Pasivo, PN, Ingresos, Egresos) |
| Centros de Costo | ✅ Completo | 14 centros: FUT, BAS, VOL, HOC, NAT, TEN, PAD, GIM, BAR, BUFFET, EVE, MER, ADM, MAN |
| Conceptos de Tesorería | ⚠️ Parcial | 10 conceptos básicos creados, pero sin vincular a cuentas ni centros |
| Configuración global cobranza | ✅ OK | `CONCEPTO_COBRANZA_CUOTAS=1` (COB-CUO), `CONCEPTO_MORA=3` (ING-MORA) |
| Actividades deportivas | ❌ Vacío | Tabla `actividades` sin registros para tenant_id=1 |
| Categorías de actividad | ❌ Vacío | Dependen de actividades — tampoco existen |
| Tipos de Socio — conceptos | ⚠️ Sin vincular | 4 tipos creados pero `concepto_tesoreria_id` y `concepto_mora_id` en NULL |

---

## 1. Vincular Conceptos de Tesorería

Los 10 conceptos existen pero ninguno tiene `cuenta_contable_id` ni `centro_costo_id` asignados.
Esto impide la generación correcta de asientos contables.

### Tabla de asociaciones recomendadas

| Concepto | Código | Cuenta Contable sugerida | Centro de Costo sugerido |
|---|---|---|---|
| Cobranza de Cuotas | COB-CUO | 4.1.01 — Cuotas Social | ADM |
| Cobranza Actividades | COB-ACT | 4.1.02 — Cuota Deportiva | *(por actividad — ver punto 3)* |
| Ingresos por Mora | ING-MORA | 4.x — Ingresos por Mora | ADM |
| Donaciones | DON | 4.x — Otros Ingresos | ADM |
| Otros Ingresos | OTR-ING | 4.x — Otros Ingresos | ADM |
| Sueldos y Jornales | SUE | 5.x — Sueldos | ADM |
| Servicios | SERV | 5.x — Servicios | ADM |
| Mantenimiento | MAN | 5.x — Mantenimiento | MAN |
| Compras | COM | 5.x — Compras | ADM |
| Otros Egresos | OTR-EGR | 5.x — Otros Egresos | ADM |

**Cómo hacerlo:** Panel admin → Finanzas → Conceptos de Tesorería → editar cada uno y asignar cuenta y centro.

> ⚠️ Los códigos de cuenta contable exactos (4.1.01, 5.x, etc.) deben verificarse contra el plan
> de cuentas real del club. Los sugeridos son orientativos.

---

## 2. Vincular Tipos de Socio a Conceptos

Los 4 tipos de socio no tienen conceptos asignados. El sistema funciona con el fallback global
(`CONCEPTO_COBRANZA_CUOTAS=1`), pero es más robusto y permite reportes por tipo si se asigna
explícitamente.

| Tipo | Código | concepto_tesoreria_id sugerido | concepto_mora_id sugerido |
|---|---|---|---|
| Socio Activo | ACTIVO | 1 (COB-CUO) | 3 (ING-MORA) |
| Socio Cadete | CADETE | 1 (COB-CUO) | 3 (ING-MORA) |
| Socio Vitalicio | VITALICIO | 1 (COB-CUO) | 3 (ING-MORA) |
| Socio Adherente | ADHERENTE | 1 (COB-CUO) | 3 (ING-MORA) |

**Cómo hacerlo:** Panel admin → Configuración → Tipos de Socio → editar cada uno.

---

## 3. Crear Actividades Deportivas

La tabla `actividades` está **vacía**. Sin actividades no hay categorías, y sin categorías
no se pueden registrar inscripciones ni generar cobranza de actividades deportivas.

### Actividades a crear (basado en centros de costo existentes)

Para cada actividad se deben configurar:
- `nombre`, `codigo`
- `conceptoTesoreriaId` → usar `COB-ACT` (id=2) o crear uno específico por deporte
- `conceptoMoraId` → usar `ING-MORA` (id=3)
- `centroCostoId` → usar el centro de costo correspondiente

| Actividad | Código sugerido | Centro de Costo |
|---|---|---|
| Fútbol | FUT | FUT (id=1) |
| Básquet | BAS | BAS (id=2) |
| Vóley | VOL | VOL (id=3) |
| Natación | NAT | NAT (id=4) |
| Hockey | HOC | HOC (id=5) |
| Tenis | TEN | TEN (id=6) |
| Paddle | PAD | PAD (id=7) |
| Gimnasia | GIM | GIM (id=8) |

**Cómo hacerlo:** Panel admin → Deportes y Actividades → Nueva Actividad.

### Categorías por actividad

Cada actividad necesita al menos una categoría (ej: Infantil, Juvenil, Adultos, etc.)
con su `cuotaMensual` y opcionalmente su propio `conceptoTesoreriaId`.

**Nota:** Si las inscripciones de socios ya migradas referencian `categoria_actividad_id`,
esas categorías deben existir con los mismos IDs que tenían en el sistema original.
Verificar con:
```sql
SELECT DISTINCT categoria_actividad_id, COUNT(*)
FROM inscripciones
WHERE tenant_id = 1
GROUP BY categoria_actividad_id
ORDER BY categoria_actividad_id;
```

---

## 4. Verificar Configuración de Cobranza

Confirmar que estas claves en `configuracion` sean correctas para el club:

| Clave | Valor actual | Verificar |
|---|---|---|
| `CONCEPTO_COBRANZA_CUOTAS` | 1 (COB-CUO) | ✅ Correcto |
| `CONCEPTO_MORA` | 3 (ING-MORA) | ✅ Correcto |
| `CAJA_DEFECTO` | *(no configurada)* | Configurar con la caja principal |
| `BUFFET_IMPRESORA_TICKETS` | *(verificar)* | Asignar impresora de tickets |

---

## 5. Opciones de Impresión Buffet

Verificar/configurar en Panel admin → Buffet → Impresoras → Opciones de Impresión:

| Opción | Default del sistema | Recomendado para producción |
|---|---|---|
| Confirmar ticket antes de imprimir (Mesas) | No | Según preferencia del club |
| Confirmar ticket antes de imprimir (Kiosco) | Sí | Según preferencia del club |
| Confirmar ticket antes de imprimir (TakeAway) | No | Según preferencia del club |
| Imprimir comanda (Mesas) | Sí | Sí |
| Imprimir comanda (Kiosco) | No | Según si hay cocina/barra |
| Imprimir comanda (TakeAway) | Sí | Sí |

---

## Orden de Ejecución Sugerido

1. **Vincular conceptos** a cuentas contables y centros de costo (punto 1)
2. **Vincular tipos de socio** a conceptos (punto 2)
3. **Crear actividades** con centros y conceptos (punto 3)
4. **Crear categorías** por actividad, respetando los IDs referenciados por inscripciones migradas
5. **Verificar configuración** de cajas, impresoras y defaults (punto 4 y 5)
6. **Test end-to-end**: cobrar una cuota de socio + cobrar una inscripción deportiva

---

## Impacto si no se configura

| Flujo | Sin configuración | Con configuración |
|---|---|---|
| Cobrar cuota social | ✅ Funciona (usa fallback COB-CUO) | ✅ Funciona con asientos contables correctos |
| Cobrar inscripción deportiva | ❌ Error: sin categoría de actividad | ✅ Funciona |
| Asientos contables automáticos | ⚠️ Se generan sin cuenta ni centro | ✅ Se generan completos |
| Reportes por deporte/centro | ❌ Sin datos | ✅ Disponibles |
| Mora automática | ✅ Usa ING-MORA global | ✅ Idem |
