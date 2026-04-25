# Revisión de Código - Clubix

**Fecha:** 2026-04-24 (revisado 2026-04-25 con avances de Fase 1)
**Alcance:** Backend (`server/src`), Frontend (`client/src`), Schema Prisma.

## ✅ Fase 1 ejecutada (2026-04-25)

- **C-1** Tenant leakage cerrado en: `cierreCaja.js`, `tesoreria.js` (transferenciaCaja), `liquidaciones.js`, `movimientosContables.js`, `asientos.js`, `conciliacionBancaria.js`, `eventos.js`. Adicional: se montó `extractTenant + req.db` en `/api/eventos` (antes ese mount no tenía tenant scope).
- **I-2** Doble conteo arreglado en `centros-costo-export-comparativo` y `centros-costo-export-evolucion`. Ahora todas las vistas de CC usan `MovimientoCaja` como única fuente.
- **S-1** Eliminados `eventos.js.backup` y `admin.js.backup`.
- **C-3 parcial** Generación de número MovimientoCaja extraída a helper `generarNumeroMovimientoCaja(db)` en `buffet/helpers.js`. Reemplazado en kiosco, takeaway, comandas y `webhooksMercadoPago.js`. Falta: el race definitivo se resuelve al wrappear el cobro en transacción (C-2) y/o migrar a una secuencia Postgres.
- **C-2 pendiente** Wrap del cobro buffet en `$transaction` queda como sprint aparte: el endpoint mezcla DB con AFIP/ticket que no caben en transacción y requiere extraer la parte DB primero (parte de Fase 2 / `ventasContablesService`).
- Bug colateral detectado y arreglado: `generarAsientoAutomatico` y `generarNumeroAsiento` recibían `prisma` como parámetro pero internamente usaban `req.db` (ReferenceError silencioso). Renombrados a `db` y se usa el parámetro consistentemente.
**Metodología:** Análisis estático con 5 agentes especializados cubriendo distintas dimensiones (endpoints de ventas, reportes CC, patrones frontend, cross-cutting backend, data model).

---

## Resumen ejecutivo

La aplicación está funcional y cubre mucha superficie, pero tiene **deuda técnica significativa** en tres planos:

1. **Riesgos concretos (seguridad + integridad)** — un bug de multi-tenant leakage, múltiples escrituras sin transacción, falta de constraints en el schema.
2. **Duplicación masiva** — cuatro endpoints de ventas reimplementan el mismo flujo, cinco páginas de reportes clonan los mismos filtros, 26 formularios copian el mismo handler.
3. **Inconsistencias** — estados como strings libres, respuestas de API con 4 formatos distintos, permisos hardcoded en strings.

El refactor estimado elimina **~1.500-2.000 líneas** de código duplicado, cierra el bug de tenant leakage y unifica la capa de datos a una sola fuente de verdad (`MovimientoCaja`).

---

## 🔴 Críticos — atender antes que cualquier feature nuevo

### C-1. Tenant leakage en `cierreCaja.js`

**Archivo:** `server/src/routes/cierreCaja.js` — 16 accesos a `prisma` global o `req.prisma` mezclados con `req.db`. Líneas 32, 74, 107, 167, 196, 253, 302, 389, 704, 881, 934.

Mezcla peligrosa: algunos reads usan `req.prisma.admin.findUnique()` (sin filtro de tenant) mientras otros usan `req.db.cajaRol.findMany()` (tenant-scoped). Bajo ciertas rutas esto puede **exponer datos de otros clubs** en operaciones de auditoría/cierre.

**Acción:** reemplazar `req.prisma.*` por `req.db.*` en todos los casos excepto lecturas legítimas de tablas globales (`Admin`, `Rol`, `Permiso`, `MenuItem`). Usar un lint grep para todo el repo: `grep -rn "req\.prisma\." server/src/routes` — todos esos son sospechosos.

**Archivos adicionales con el mismo patrón:** `usuarios.js:18`, `tesoreria.js:25`, `centros-costo.js:857` (export comparativo — `req.prisma.movimientoContable` ahí es un typo).

---

### C-2. Escrituras múltiples sin `$transaction`

Endpoints que crean `MovimientoCaja` + `Asiento` + `Entrada`/`Comanda` + actualizan contadores **sin envoltura transaccional**. Si falla en el medio queda estado inconsistente (ingreso registrado sin asiento contable, contador aumentado sin entrada, etc.).

| Archivo | Líneas | Operaciones involucradas |
|---|---|---|
| `server/src/routes/buffet/kiosco.js` | 222-235, 280-293 | MovimientoCaja + Asiento + MovContable |
| `server/src/routes/buffet/takeaway.js` | 968-982, 1043-1057 | idem + distribución por cuenta |
| `server/src/routes/buffet/comandas.js` | 1148-1162, 1224-1238 | idem |
| `server/src/routes/liquidaciones.js` | varios | pago de sueldos |
| `server/src/routes/tesoreria.js` | movimiento manual | MovimientoCaja + actualización saldo |

**Nota:** `eventos.js` (endpoint `/vender`) **sí** usa `prisma.$transaction()` — tomar ese como modelo.

---

### C-3. Race condition en generación de número de movimiento

Patrón inseguro repetido: `const ultimo = await tx.movimientoCaja.findFirst({ orderBy: { id: 'desc' } }); const nuevoNumero = ...(ultimo.id + 1)`.

Bajo carga concurrente dos llamadas pueden leer el mismo `ultimo.id` y generar números duplicados (el unique constraint falla, se pierde la venta con un 500). Aparece en:

- `buffet/kiosco.js:219-220, 277-278`
- `buffet/takeaway.js:965-966, 1040-1041`
- `buffet/comandas.js:1145-1146, 1221-1222`

Existe `generarNumeroMC()` en `helpers.js:66-84` pero **no se usa**. Usarlo siempre (o mejor: secuencia Postgres + campo separado).

---

### C-4. Schema: cascade deletes sin protección

Solo 1 uso de `onDelete: NoAction` en todo el schema; el resto queda en `Restrict` implícito o en `Cascade` explícito. Problemas concretos:

- Borrar una `Caja` cascadea a ~30 tablas (MovimientoCaja, Pago, Venta, Comanda, etc.).
- `MenuItem.parent` usa Cascade → borrar un menú padre borra todos los items hijos (probablemente se quiere `SetNull`).
- Relaciones opcionales como `Pago.cobradorId`, `Venta.cajaId` deberían tener `SetNull` explícito.

**Acción:** auditoría de `onDelete` caso por caso, especialmente en modelos críticos (Caja, MedioPago, CentroCosto, Evento).

---

## 🟡 Importantes — deuda técnica que duele a diario

### I-1. Endpoints de ventas triplican la misma lógica

Cuatro endpoints hacen básicamente lo mismo con variaciones menores:

| Endpoint | Archivo | Lógica |
|---|---|---|
| Cobro buffet mesas | `buffet/comandas.js:1148+, 1224+` | MovCaja + Asiento + MovContable |
| Cobro kiosco | `buffet/kiosco.js:222+, 280+` | MovCaja + Asiento |
| Cobro takeaway | `buffet/takeaway.js:968+, 1043+` | MovCaja + Asiento + MovContable |
| Venta evento | `eventos.js:900+` | MovCaja + Asiento + Entradas |

**Duplicaciones exactas identificadas:**
- Distribución de asientos por cuenta: `takeaway.js:998-1013` ≡ `comandas.js:1179-1194`
- Fallback de cuenta contable: `kiosco.js:177-185` ≡ `takeaway.js:915-930`
- Resolución de cuenta cash: `kiosco.js:238, 296` ≡ `takeaway.js:985, 1060`

**Variaciones legítimas:**
- Kiosco/Takeaway buscan cuenta `BUFFET`; Eventos busca `EVENTOS`. Esta diferencia es conceptual (distinto centro de costo) pero el código que la implementa es copy-paste.
- Eventos crea `Entrada[]`; buffet crea solo ítems de comanda.

**Refactor propuesto:** crear `server/src/services/ventasContablesService.js`:

```js
export async function crearVentaConAsientos(db, {
  cajaId, medioPagoId, monto, concepto, itemsPorCuenta,
  tipoOrigen, origenId, registradoPor, centroCostoId,
  cuentaVentaFallback  // 'BUFFET' | 'EVENTOS' | 'KIOSCO'
}) {
  return db.$transaction(async (tx) => {
    const numero = await generarNumeroMC(tx)
    const mov = await tx.movimientoCaja.create({ ... })
    await tx.caja.update({ saldoActual: { increment: monto } })
    const asiento = await generarAsientoAutomatico(tx, {
      tipoOrigen, origenId, lineas: [...distribuirLineas(itemsPorCuenta)]
    })
    return { mov, asiento, numero }
  })
}
```

Estimado: ~400 líneas eliminadas, un solo lugar para tocar cuando cambie la lógica contable.

---

### I-2. Reportes CC duplican queries y lógica

Seis endpoints en `centros-costo.js` repiten el mismo pattern de agregación:

| Endpoint | Líneas | Fuente |
|---|---|---|
| `:id/reporte` | 214+ | MovCaja |
| `reporte-comparativo` | 311+ | MovCaja |
| `evolucion-temporal` | 405+ | MovCaja |
| `presupuesto-vs-real` | 588+ | MovCaja |
| `dashboard-ejecutivo` | 731+ | MovCaja |
| `export-comparativo` | 817+ | **MovCaja + MovContable** ❌ (quedó con el bug doble) |

**Bugs pendientes:**
- `centros-costo.js:857` — el export-comparativo **aún usa ambas fuentes**, se mantuvo el doble conteo después del fix de los otros 4. Además `req.prisma.movimientoContable` (línea 857) debería ser `req.db.movimientoContable` — typo.
- `export-evolucion` (línea 968) — idem: mezcla `monto` + `montoTotal` de dos modelos sin normalizar.

**Refactor propuesto:**

```js
// server/src/services/reportesCCService.js
export async function getAgregadosPorCC(db, { centroCostoId, fechaDesde, fechaHasta }) {
  const where = { anulado: false, centroCostoId, ...rangoFecha(fechaDesde, fechaHasta) }
  const [ingresos, egresos] = await Promise.all([
    db.movimientoCaja.aggregate({ where: { ...where, tipo: 'INGRESO' }, _sum: { monto: true }, _count: true }),
    db.movimientoCaja.aggregate({ where: { ...where, tipo: 'EGRESO' }, _sum: { monto: true }, _count: true }),
  ])
  return { ingresos, egresos }
}
```

Cada endpoint queda en ~15 líneas.

---

### I-3. Frontend: hook `useFormState` existe pero nadie lo usa

`client/src/hooks/useFormState.js` expone `form`, `handleChange`, `loading`, `saving`, `error` — **0 forms lo usan hoy**. Los 26 forms del admin copian manualmente:

```jsx
function handleChange(e) {
  const { name, value, type, checked } = e.target
  setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
}
```

**Archivos con el patrón duplicado (muestra):** `CajaForm.jsx:107-112`, `SocioForm.jsx:45-129`, `EventoForm.jsx`, `EntidadForm.jsx`, `ProductoForm.jsx`, `FacturaVentaForm.jsx`, `MovimientoCajaForm.jsx`, etc.

**Ganancia:** migrar los 26 forms a `useFormState` = ~130 líneas menos + validación centralizada.

---

### I-4. Frontend: no existe `<FormLayout>` ni `<AdminListPage>`

**Forms — scaffolding duplicado en 26 archivos:**
- Header (ArrowLeft + título + iconos)
- Secciones envueltas en `bg-white rounded-lg shadow-sm border border-gray-200 p-6` — la clase aparece **53 veces** en 23 archivos.
- Footer con botones Cancelar / Guardar.

**Listas — estructura duplicada en 27 archivos:**
- Header (icon + title + contador) → botón "Nuevo"
- Bloque de filtros
- Tabla con `<Table columns={...} data={...} />`
- `<Pagination>`

**Refactor propuesto:**

```jsx
// client/src/components/layout/FormLayout.jsx
<FormLayout title="Nueva Caja" backTo="/admin/tesoreria/cajas" onSubmit={handleSubmit}>
  <FormSection title="Datos básicos">
    <InputField name="nombre" label="Nombre" value={form.nombre} onChange={handleChange} />
  </FormSection>
</FormLayout>

// client/src/components/layout/AdminListPage.jsx
<AdminListPage
  title="Cajas"
  icon={Wallet}
  onNew={() => navigate('/admin/tesoreria/cajas/nueva')}
  permisoNew={PERMISOS.CAJA_GESTIONAR}
  filters={<CajasFiltros value={filtros} onChange={setFiltros} />}
  columns={columns}
  data={cajas}
  pagination={pagination}
/>
```

**Estimado:** elimina ~1.000 líneas en listas + ~200 líneas en forms.

---

### I-5. Frontend: filtros de rango de fecha duplicados

El bloque `RANGOS = [{ id: 'mes', label: '...', getDates: () => {...} }, ...]` aparece idéntico en:

- `pages/admin/ReporteCentrosCosto.jsx:10-28`
- `pages/admin/centros-costo/ReporteMatriz.jsx:9-26`
- Variaciones menores en `EvolucionTemporal.jsx`, `RentabilidadActividades.jsx`, `PresupuestoVsReal.jsx`

**Refactor:** `client/src/hooks/useDateRanges.js` + componente `<FiltrosFechaRango />` que ya exporte los botones de rango + pickers personalizados.

---

### I-6. `toLocaleString('es-AR')` inline en 62 lugares

A pesar de existir `formatCurrency()` en `client/src/utils/formatters.js:14`, hay 62 usos inline de `toLocaleString('es-AR', { minimumFractionDigits: 2 })` en JSX.

**Archivos afectados (muestra):** `CajasLista.jsx:72, 123`, `BuffetDashboardNew.jsx`, `TicketPreview.jsx`, y otros.

**Acción:** codemod simple con jscodeshift o sed → reemplazo masivo. Low effort, alta limpieza.

---

### I-7. Respuestas API con 4 formatos distintos

Inconsistencia concreta entre routers:

| Patrón | Ejemplo | Archivos |
|---|---|---|
| `{success: true, data: x}` | tesoreria.js:74 | ~mayoría |
| `{data: x}` | asientos.js:126 | algunos reportes |
| `res.json(x)` directo | eventos.js:266 | crear evento |
| `{error}` vs `{success: false, error}` | mixed | try/catch ad-hoc |

Y en frontend, el parsing correspondiente:
- `res.data || []`
- `res.data || res || []` (CajaForm.jsx:63 — **bug latente**: si `res` es un array, no entra al OR)
- `response?.data || response || []`

**Acción:** decidir un formato estándar (`{success, data, error, code}`) y refactorizar ambos lados. Middleware `responseNormalizer` en backend facilita.

---

### I-8. Permisos en strings hardcoded

40+ permisos en `checkPermiso('STRING')` sin enum centralizado. Typos no detectables en compile-time. Ejemplo:

```js
// router A
checkPermiso('BUFFET_COCINA')
// router B
checkPermiso('BUFFET_COCINA', 'BUFFET_BARRA')  // OR logic — ¿está implementada?
```

**Acción:** crear `server/src/constants/permissions.js` con un objeto/enum exportado, migrar todas las strings. Paralelamente hay `client/src/services/permisos.js` con `PERMISOS` — unificar con backend.

---

### I-9. Schema: estados como strings libres

38+ campos tipo `estado String @default("PENDIENTE")` sin enum Prisma. Riesgo de valores inconsistentes (PAGADO vs PAGADA, CONFIRMADO vs CONFIRMED). Los valores válidos están en comentarios:

```prisma
// Evento.estado — "// PROGRAMADO, EN_CURSO, FINALIZADO, CANCELADO"
// Entrada.estado — "// VALIDA, USADA, ANULADA"
// IngresoEntrada.modoValidacion — "// QR, MANUAL_PWA"
```

**Acción:** migrar a `enum` Prisma gradualmente. Ejemplo:

```prisma
enum EstadoEvento { PROGRAMADO EN_CURSO FINALIZADO CANCELADO }
model Evento { estado EstadoEvento @default(PROGRAMADO) }
```

---

### I-10. `centroCostoId` duplicado en 18 modelos

El campo aparece literal en: Cargo, Pago, MovimientoCaja, MovimientoContable, Venta, Evento, Entrenamiento, Comanda, PedidoTakeAway, Inscripcion, OrdenCompra, ItemMovimiento, LineaPresupuesto, Actividad, AsientoLinea, Entidad, Caja, más otros.

Cada uno con su `@@index([centroCostoId])` (18 índices). En sí no está mal (imputación directa), pero:

- La lógica de "resolver el CC aplicable" (cajas vs concepto vs default) está repetida en cada endpoint de venta (ver I-1).
- Cambiar una regla de imputación requiere tocar varios routers.

**Acción:** helper `resolverCentroCosto({ caja, concepto, entidad, evento })` en un service.

---

## 🟢 Sugerencias — limpieza continua

### S-1. Archivos `.backup` versionados

```
server/src/routes/eventos.js.backup       (1887 líneas)
server/src/routes/admin.js.backup         (1300+ líneas)
server/src/routes/eventos.js.backup (otro en otro path)
```

**Acción:** borrarlos. Si hace falta histórico, está en git.

---

### S-2. Validación manual sin esquema

Todos los endpoints validan inputs a mano con `if (!x || !y)`. Probable candidato para migrar a **Zod** schemas:

```js
const schema = z.object({
  items: z.array(z.object({ categoriaId: z.number(), cantidad: z.number().positive() })).min(1),
  cajaId: z.number(),
  medioPagoId: z.number(),
})
// middleware
router.post('/vender', validate(schema), handler)
```

Impacto: reducción de defensive code, mejor UX de errores.

---

### S-3. Endpoints monolíticos

Archivos que pasaron los 1000 líneas y conviene subdividir:

| Archivo | Líneas | Sugerencia |
|---|---|---|
| `eventos.js` | 2100+ | Separar en `eventos.js` (CRUD) + `eventos/ventas.js` + `eventos/validacion.js` + `eventos/estadisticas.js` |
| `admin/socios.js` | 1400+ | Separar `socios.js` (CRUD) + `socios/import.js` + `socios/cuenta-corriente.js` |
| `centros-costo.js` | 1400+ | Separar reportes en `centros-costo/reportes.js` |
| `tesoreria.js` | ~1500 | Separar `tesoreria/cajas.js` + `tesoreria/movimientos.js` + `tesoreria/conciliacion.js` |
| `liquidaciones.js` | ~800 | separar pagos en service |

---

### S-4. Multi-tenant: modelos sin `tenantId`

Del schema: 15+ modelos no tienen `tenantId`. Algunos son legítimamente globales (`Rol`, `Permiso`, `PermisoRol`, `MenuItem`), pero otros cuestionables:

- `CargoPersonal` — catálogo de cargos compartido entre clubes
- `Rubro` — catálogo de rubros

**Acción:** decidir explícitamente cuáles son globales y documentarlo.

---

### S-5. Modelos conceptualmente redundantes

- **MovimientoCaja vs MovimientoContable** — ambos registran movimientos. Falta doc clara de "cuándo uno y cuándo el otro". El fix reciente sobre reportes aclaró que la fuente de verdad es `MovimientoCaja`. Conviene documentarlo en `docs/03-MODELO-DE-DATOS.md`.
- **Evento vs Partido** — hoy Partido es "opcional" dentro de Evento (relación @unique). Podría ser un discriminator o subtipo.
- **Entrada vs IngresoEntrada** — relación 1:1. Podría ser un único modelo con `fechaIngreso DateTime?` nullable.

---

### S-6. `console.log` en producción

Ejemplos visibles: `tesoreria.js:37, 45` con `console.log('[CAJAS DEBUG]')`. Reemplazar con un logger estructurado (Winston, Pino) con niveles (debug/info/warn/error) y silenciar debug en prod.

---

### S-7. Dinero con precisión mixta

`@db.Decimal(12, 2)` vs `@db.Decimal(10, 2)` sin criterio aparente. No hay checks SQL `CHECK (monto >= 0)`. Decidir política y aplicar.

---

### S-8. Campos auditoría ad-hoc

`registradoPor`, `createdAt`, `updatedAt`, `anuladoPor`, `fechaAnulacion` aparecen en 100+ modelos, cada uno reimplementando. Existe `AuditLog` pero no está forzado. Opciones:
- Extender con mixin/composable.
- Centralizar en `AuditLog` con middleware Prisma (interceptar todos los writes).

---

## Plan de trabajo sugerido (en orden)

### Fase 1 — Cerrar riesgos (1 sprint, ~1 semana)
1. **C-1** — Fix tenant leakage en `cierreCaja.js` + `usuarios.js`. Grep y reemplazo de `req.prisma` → `req.db`. **Prio alta, dependencia nula.**
2. **C-2, C-3** — Wrappear en `$transaction` los cobros de kiosco/takeaway/comandas + usar `generarNumeroMC()`.
3. Borrar archivos `.backup` (S-1).
4. **I-2 export bugs** — arreglar el doble conteo que quedó en `export-comparativo` + typo `req.prisma`.

### Fase 2 — Refactorizar ventas (1 sprint)
5. **I-1** — crear `ventasContablesService.js`. Migrar kiosco primero (más simple), después takeaway, comandas, eventos. Tests de integración.
6. **I-10** — helper `resolverCentroCosto()` como parte del mismo service.

### Fase 3 — Consolidar reportes (1 sprint corto)
7. **I-2** — `reportesCCService.js` con `getAgregadosPorCC()`. Refactorizar los 6 endpoints.
8. **I-5** — hook `useDateRanges()` + `<FiltrosFechaRango />`.

### Fase 4 — Frontend layouts (1-2 sprints)
9. **I-3, I-4** — `<FormLayout>`, `<FormSection>`, migración progresiva de los 26 forms a `useFormState`.
10. **I-4** — `<AdminListPage>`, migrar las 27 listas.
11. **I-6** — codemod `toLocaleString` → `formatCurrency`.

### Fase 5 — Consistencia API y schema (continuo)
12. **I-7** — estandarizar respuesta `{success, data, error}` + middleware en backend, adaptar frontend.
13. **I-8** — enum de permisos centralizado (back + front).
14. **I-9** — migrar `estado` strings a enums Prisma (se puede hacer por módulo).
15. **C-4** — auditoría de `onDelete` caso por caso.

### Fase 6 — Pulido (continuo)
16. **S-3** — subdividir routers monolíticos.
17. **S-2** — introducir Zod.
18. **S-6** — logger estructurado.

---

## Métricas estimadas del refactor

| Métrica | Antes | Después (estimado) |
|---|---|---|
| Líneas duplicadas | ~2.000 | ~200 |
| Endpoints de ventas | 4 con lógica clonada | 4 thin + 1 service |
| Endpoints reportes CC | 6 con queries clonadas | 6 thin + 1 service |
| Forms del admin con handleChange custom | 26 | 0 (todos vía `useFormState`) |
| Listas admin con scaffolding custom | 27 | 0 (todas vía `<AdminListPage>`) |
| `toLocaleString` inline | 62 | 0 |
| Archivos `.backup` en repo | 3 | 0 |
| Bugs de tenant leakage | 1 confirmado | 0 |
| Writes sin transacción | 6+ | 0 |

---

## Fuera de alcance pero worth mentioning

- **Testing automatizado** — el único test que veo es `__tests__/helpers/setup.js`. El RFC recomendado: tests de integración para `ventasContablesService` y los reportes de CC (hoy la refactorización no tiene red).
- **Performance** — no analizamos el perfil real, pero los `findMany()` sin paginación en listas grandes (socios, movimientos) son candidatos a revisar.
- **Multi-tenant per-tenant config** — hoy `MERCADOPAGO_ACCESS_TOKEN` es global en `.env`. Hay que moverlo a `TenantConfiguracion` antes del primer segundo tenant real.
