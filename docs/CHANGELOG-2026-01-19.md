# Changelog - 19 de Enero 2026

## Resumen de Implementaciones

Esta sesión se enfocó en completar funcionalidades de la **Fase 26: Cuotas y Pagos**.

---

## 1. Sistema de Recargos por Mora

### Descripción
Sistema configurable para aplicar recargos automáticos a cuotas vencidas.

### Tipos de Recargo
- **FIJO**: Porcentaje fijo que se aplica una vez vencida la cuota (ej: 10%)
- **ACUMULATIVO**: Porcentaje que se aplica cada X días con tope máximo opcional (ej: 5% cada 30 días, máximo 30%)

### Archivos Modificados

**Backend:**
- `server/prisma/schema.prisma` - Modelo `ConfiguracionRecargo` simplificado
- `server/src/routes/admin.js`:
  - Función `calcularRecargoCargo()` - Calcula recargo según configuración
  - `GET /api/admin/configuracion-recargo` - Obtener configuración
  - `PUT /api/admin/configuracion-recargo` - Actualizar configuración
  - Modificado `/cuotas/cobranza/:socioId` - Incluye recargo calculado
  - Modificado `POST /pagos` - Aplica recargos al registrar pago

**Frontend:**
- `client/src/pages/admin/TablasAuxiliares.jsx`:
  - Nueva tarjeta de configuración "Recargos por Mora"
  - Toggle entre FIJO y ACUMULATIVO
  - Campos para porcentaje, cada_dias y tope_maximo
- `client/src/pages/admin/Cuotas.jsx`:
  - Muestra recargo calculado en cada cuota ("+$X mora")
  - Total de pago incluye desglose de recargos

### Migración
```sql
-- server/prisma/migrations/20260119_recargos_simplificado/migration.sql
ALTER TABLE "configuracion_recargos" ADD COLUMN "tipo" TEXT DEFAULT 'FIJO';
ALTER TABLE "configuracion_recargos" ADD COLUMN "cada_dias" INTEGER;
ALTER TABLE "configuracion_recargos" ADD COLUMN "tope_maximo" DECIMAL(5,2);
```

---

## 2. Planes de Pago (Financiación)

### Descripción
Permite financiar deuda existente generando nuevas cuotas con vencimientos sucesivos.

### Flujo
1. Seleccionar cuotas pendientes de un socio
2. Clic en "Plan de Pagos"
3. Configurar: cantidad de cuotas, interés %, fecha primer vencimiento
4. Ver preview del plan
5. Confirmar generación

### Comportamiento
- Las cuotas originales se marcan como **FINANCIADA**
- Se generan nuevas cuotas con categoría **FINANCIACION**
- Los vencimientos son mensuales a partir de la fecha elegida
- La última cuota ajusta el monto para que el total sea exacto

### Archivos Creados/Modificados

**Backend:**
- `server/src/routes/admin.js`:
  - `POST /api/admin/planes-pago` - Generar plan de pagos
  - `POST /api/admin/planes-pago/preview` - Preview sin crear

**Frontend:**
- `client/src/components/PlanPagosModal.jsx` - Modal completo con:
  - Selector de cantidad de cuotas (2-24)
  - Campo de interés porcentual
  - Selector de fecha primer vencimiento
  - Preview en tiempo real
  - Desglose de deuda original + recargos + interés
  - Lista de cuotas a generar con fechas y montos
- `client/src/pages/admin/Cuotas.jsx`:
  - Botón "Plan de Pagos" junto a "Cobrar"
  - Integración del modal

---

## 3. Configuración de Vencimiento de Cuotas

### Descripción
Permite configurar si las cuotas vencen en el mismo mes del periodo o en el siguiente.

### Archivos Modificados
- `client/src/pages/admin/TablasAuxiliares.jsx`:
  - Nueva configuración `CUOTA_VENCE_MISMO_MES`
  - Switch "Vence en el mismo mes del periodo"
- `client/src/pages/admin/Periodos.jsx`:
  - Usa ambas configuraciones para calcular fecha de vencimiento

---

## 4. Mejoras en UI de Configuración

### Cambios
- Tarjetas de configuración organizadas de izquierda a derecha (flex-wrap)
- Tarjetas más anchas (w-96)
- Tarjeta de email más ancha (w-[500px])
- Botones de guardar como iconos en esquina inferior derecha
- Min-height en tarjetas para consistencia

---

## 5. Mejoras en Pantalla de Cobranza

### Filtros por Socio
- Al seleccionar un socio, se respetan los filtros activos (periodo, estado)
- Si no hay filtro de estado, muestra TODAS las cuotas del socio
- Solo pre-selecciona las cuotas PENDIENTES

### Buscador
- Presionar Enter selecciona automáticamente el primer resultado

### Archivos Modificados
- `server/src/routes/admin.js`:
  - `/cuotas/cobranza/:socioId` acepta parámetros `periodoId` y `estado`
- `client/src/pages/admin/Cuotas.jsx`:
  - Pasa filtros actuales al cargar cuotas de socio
  - Handler de Enter en buscador

---

## Archivos Nuevos

| Archivo | Descripción |
|---------|-------------|
| `client/src/components/PlanPagosModal.jsx` | Modal para generar planes de pago |
| `server/prisma/migrations/20260119_recargos_simplificado/migration.sql` | Migración para recargos |

---

## Archivos Modificados Principales

| Archivo | Cambios |
|---------|---------|
| `server/prisma/schema.prisma` | Modelo ConfiguracionRecargo actualizado |
| `server/src/routes/admin.js` | Endpoints de recargos, planes de pago, filtros cobranza |
| `client/src/pages/admin/TablasAuxiliares.jsx` | UI de configuración de recargos y vencimientos |
| `client/src/pages/admin/Cuotas.jsx` | Mostrar recargos, botón plan pagos, filtros |
| `client/src/pages/admin/Periodos.jsx` | Usa configuración de vencimiento |

---

## Estados de Cuota

| Estado | Descripción |
|--------|-------------|
| PENDIENTE | Cuota por cobrar |
| PAGADO | Cuota cobrada |
| ANULADO | Cuota cancelada |
| FINANCIADA | Cuota incluida en un plan de pagos |

---

## Categorías de Cargo

| Categoría | Descripción |
|-----------|-------------|
| CUOTA_SOCIAL | Cuota mensual de socio |
| ACTIVIDAD | Cuota de actividad/deporte |
| INSCRIPCION | Inscripción a actividad |
| FINANCIACION | Cuota de plan de pagos |
| OTRO | Cargo manual |

---

## 6. Mejoras en Visualización de Cuotas

### Cuotas de Financiación
- Muestran "Cuota X/N" en azul junto al tipo
- Descripción muestra los periodos originales financiados

### Badges de Estado
- **PAGADA**: Verde con checkmark
- **PENDIENTE**: Amarillo con reloj
- **VENCIDA**: Rojo con alerta
- **FINANCIADA**: Azul con icono de tarjeta
- **ANULADA**: Gris con X

---

## 7. Reportes de Cobranza y Morosidad (26.11)

### Descripción
Dashboard completo de cobranza con KPIs, desglose jerárquico por categoría/actividad y lista de morosos.

### KPIs Implementados
- **Generado**: Total facturado (monto y cantidad de cuotas)
- **Cobrado**: Total recaudado
- **Pendiente**: Total pendiente de cobro
- **% Morosidad**: Porcentaje de deuda sobre lo generado
- **Días promedio de pago**: Tiempo entre generación y cobro
- **Recargo acumulado**: Total de recargos en cuotas pendientes

### Desglose Jerárquico
1. **Nivel 1 - Categoría**: Cuota Social, Actividades, Inscripciones, Financiación, Otros
2. **Nivel 2 - Actividad**: Dentro de Actividades, desglose por cada actividad deportiva
3. **Nivel 3 - Categoría de Actividad**: Dentro de cada actividad, desglose por categoría

### Funcionalidades
- Filtro por período
- Tablas expandibles/colapsables
- Barras de progreso de cobranza con colores semáforo
- Botón "Ver" para ver morosos de cada concepto
- Modal con lista de morosos agrupados por socio
- Click en socio navega a su cuenta corriente

### Archivos Creados/Modificados

**Backend:**
- `server/src/routes/admin.js`:
  - `GET /api/admin/reportes/cobranza` - Reporte completo con KPIs y desglose
  - `GET /api/admin/reportes/cobranza/morosos` - Lista de morosos filtrable

**Frontend:**
- `client/src/pages/admin/ReporteCuotas.jsx` - Reescrito completamente con:
  - 6 tarjetas de KPIs
  - Tabla jerárquica expandible
  - Modal de morosos integrado

---

## Fase 26 - Completada

Todos los ítems de la Fase 26 han sido implementados.

---

*Documentado: 19 de Enero 2026*
